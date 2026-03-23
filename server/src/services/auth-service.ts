import {
    createHash,
    createHmac,
    randomBytes,
    scryptSync,
    timingSafeEqual,
} from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ServerEnv } from '../config/env.js';
import type {
    AppRepository,
    AppSessionRecord,
    AppUserAuthRecord,
    AppUserRecord,
} from '../repositories/app-repository.js';
import { loginRequestSchema } from '../schemas/auth.js';
import type { OidcClientProvider } from './oidc-provider.js';
import { OpenIdClientProvider } from './oidc-provider.js';
import { AppError } from '../utils/app-error.js';
import { generateId } from '../utils/id.js';

const PASSWORD_HASH_PREFIX = 'scrypt';
const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;
const OIDC_FLOW_COOKIE_NAME = 'chartdb_oidc_flow';
const OIDC_FLOW_TTL_MS = 10 * 60 * 1000;

type OidcFlowPayload = {
    state: string;
    nonce: string;
    codeVerifier: string;
    returnTo: string;
    expiresAt: number;
};

export interface RequestAuthContext {
    mode: 'disabled' | 'password' | 'oidc';
    authenticated: boolean;
    user: AppUserRecord | null;
    session: AppSessionRecord | null;
    logoutUrl: string | null;
}

declare module 'fastify' {
    interface FastifyRequest {
        auth: RequestAuthContext;
    }
}

const nowIso = () => new Date().toISOString();

const addHours = (value: string, hours: number) =>
    new Date(Date.parse(value) + hours * 60 * 60 * 1000).toISOString();

const hashSessionToken = (token: string) =>
    createHash('sha256').update(token).digest('hex');

const hashPassword = (password: string): string => {
    const salt = randomBytes(16).toString('hex');
    const digest = scryptSync(password, salt, 64).toString('hex');
    return `${PASSWORD_HASH_PREFIX}:${salt}:${digest}`;
};

const verifyPassword = (
    password: string,
    storedHash: string | null | undefined
): boolean => {
    if (!storedHash) {
        return false;
    }

    const [prefix, salt, digest] = storedHash.split(':');
    if (!prefix || !salt || !digest || prefix !== PASSWORD_HASH_PREFIX) {
        return false;
    }

    const derivedDigest = scryptSync(password, salt, 64);
    const storedDigest = Buffer.from(digest, 'hex');

    if (storedDigest.byteLength !== derivedDigest.byteLength) {
        return false;
    }

    return timingSafeEqual(storedDigest, derivedDigest);
};

const trimMetadata = (value: string | undefined, maxLength = 255) => {
    const normalized = value?.trim();
    if (!normalized) {
        return null;
    }

    return normalized.slice(0, maxLength);
};

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const sanitizeReturnTo = (rawValue: unknown) => {
    if (typeof rawValue !== 'string') {
        return '/';
    }

    const value = rawValue.trim();
    if (!value.startsWith('/') || value.startsWith('//')) {
        return '/';
    }

    if (/[\r\n]/.test(value) || value.length > 2048) {
        return '/';
    }

    return value;
};

const base64UrlEncode = (value: Buffer | string) => {
    const buffer =
        typeof value === 'string' ? Buffer.from(value, 'utf8') : value;
    return buffer.toString('base64url');
};

const base64UrlDecode = (value: string) => Buffer.from(value, 'base64url');

const createRandomBase64Url = (bytes = 32) =>
    randomBytes(bytes).toString('base64url');

const createPkceChallenge = (codeVerifier: string) =>
    createHash('sha256').update(codeVerifier).digest('base64url');

const readStringClaim = (claims: Record<string, unknown>, key: string) => {
    const value = claims[key];
    if (typeof value !== 'string') {
        return null;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
};

const getOidcErrorMessage = (errorCode: string) => {
    switch (errorCode) {
        case 'missing_flow':
            return 'Missing or expired OIDC login flow. Please try again.';
        case 'provider_error':
            return 'OIDC provider returned an error.';
        case 'missing_subject':
            return 'OIDC response is missing the subject claim.';
        case 'missing_email':
            return 'OIDC response is missing the email claim.';
        case 'account_inactive':
            return 'Your account is inactive.';
        default:
            return 'OIDC sign-in failed.';
    }
};

export class AuthService {
    private configuredUserId: string | null = null;

    constructor(
        private readonly repository: AppRepository,
        private readonly env: ServerEnv,
        private readonly oidcProvider: OidcClientProvider = new OpenIdClientProvider(
            env
        )
    ) {}

    isEnabled(): boolean {
        return this.env.authMode !== 'disabled';
    }

    async authenticateRequest(
        request: FastifyRequest
    ): Promise<RequestAuthContext> {
        if (!this.isEnabled()) {
            return this.getUnauthenticatedState('disabled');
        }

        if (this.env.authMode === 'password') {
            this.ensureConfiguredLocalUser();
        }

        const token = request.cookies[this.env.sessionCookieName];
        if (!token) {
            return this.getUnauthenticatedState(this.env.authMode);
        }

        const session = this.repository.getSessionByTokenHash(
            hashSessionToken(token)
        );

        if (!session) {
            return this.getUnauthenticatedState(this.env.authMode);
        }

        const now = nowIso();
        const expired =
            session.invalidatedAt !== null ||
            Date.parse(session.expiresAt) <= Date.now();

        if (expired) {
            if (!session.invalidatedAt) {
                this.repository.invalidateSession(session.id, now);
            }
            return this.getUnauthenticatedState(this.env.authMode);
        }

        const user = this.repository.getUserAuthById(session.userId);
        const sessionIsInvalidForMode =
            !user ||
            user.status !== 'active' ||
            (this.env.authMode === 'password' &&
                (!user.passwordHash ||
                    (user.passwordUpdatedAt &&
                        Date.parse(session.createdAt) <
                            Date.parse(user.passwordUpdatedAt))));

        if (sessionIsInvalidForMode) {
            this.repository.invalidateSession(session.id, now);
            return this.getUnauthenticatedState(this.env.authMode);
        }

        if (
            Date.now() - Date.parse(session.lastSeenAt) >
            SESSION_TOUCH_INTERVAL_MS
        ) {
            this.repository.putSession({
                ...session,
                lastSeenAt: now,
            });
        }

        return {
            mode: this.env.authMode,
            authenticated: true,
            user: this.toPublicUser(user),
            session,
            logoutUrl: this.getLogoutUrl(),
        };
    }

    getSessionState(request: FastifyRequest): RequestAuthContext {
        return request.auth;
    }

    login(request: FastifyRequest, reply: FastifyReply, input: unknown) {
        if (this.env.authMode === 'oidc') {
            throw new AppError(
                'Password login is disabled for this deployment.',
                405,
                'AUTH_USE_OIDC'
            );
        }

        if (!this.isEnabled()) {
            throw new AppError(
                'Authentication is disabled.',
                404,
                'AUTH_DISABLED'
            );
        }

        const payload = loginRequestSchema.parse(input);
        const user = this.ensureConfiguredLocalUser();
        const normalizedEmail = payload.email.toLowerCase();
        const emailMatches = user.email?.toLowerCase() === normalizedEmail;
        const passwordMatches = verifyPassword(
            payload.password,
            user.passwordHash
        );

        if (!emailMatches || !passwordMatches || user.status !== 'active') {
            throw new AppError(
                'Invalid email or password.',
                401,
                'AUTH_INVALID_CREDENTIALS'
            );
        }

        const authenticatedUser = this.repository.transaction(() => {
            const now = nowIso();
            const updatedUser: AppUserAuthRecord = {
                ...user,
                lastLoginAt: now,
                updatedAt: now,
            };
            this.repository.putUserAuthRecord(updatedUser);
            this.createSession(request, reply, updatedUser.id, now);
            return updatedUser;
        });

        return {
            user: this.toPublicUser(authenticatedUser),
        };
    }

    async startOidcLogin(
        request: FastifyRequest,
        reply: FastifyReply,
        input: { returnTo?: unknown }
    ) {
        this.ensureOidcEnabled();

        const client = await this.oidcProvider.getClient();
        const state = createRandomBase64Url();
        const nonce = createRandomBase64Url();
        const codeVerifier = createRandomBase64Url(48);
        const flow: OidcFlowPayload = {
            state,
            nonce,
            codeVerifier,
            returnTo: sanitizeReturnTo(input.returnTo),
            expiresAt: Date.now() + OIDC_FLOW_TTL_MS,
        };

        this.setOidcFlowCookie(reply, flow);

        return reply.redirect(
            client.authorizationUrl({
                scope: this.env.oidcScopes,
                response_type: 'code',
                state,
                nonce,
                code_challenge: createPkceChallenge(codeVerifier),
                code_challenge_method: 'S256',
            })
        );
    }

    async handleOidcCallback(request: FastifyRequest, reply: FastifyReply) {
        this.ensureOidcEnabled();

        const flow = this.readOidcFlowCookie(request);
        this.clearOidcFlowCookie(reply);

        if (!flow) {
            return this.redirectToOidcError(reply, 'missing_flow');
        }

        const query = request.query as Record<string, unknown>;
        if (typeof query.error === 'string') {
            return this.redirectToOidcError(
                reply,
                'provider_error',
                flow.returnTo
            );
        }

        try {
            const client = await this.oidcProvider.getClient();
            const tokenSet = await client.callback(query, {
                state: flow.state,
                nonce: flow.nonce,
                codeVerifier: flow.codeVerifier,
            });
            const user = this.provisionOidcUser(
                client.issuer,
                tokenSet.claims()
            );
            const now = nowIso();
            this.createSession(request, reply, user.id, now);
            return reply.redirect(flow.returnTo);
        } catch (error) {
            if (error instanceof AppError) {
                return this.redirectToOidcError(
                    reply,
                    this.mapOidcErrorCode(error.code),
                    flow.returnTo
                );
            }

            request.log.error(error);
            return this.redirectToOidcError(
                reply,
                'callback_failed',
                flow.returnTo
            );
        }
    }

    logout(request: FastifyRequest, reply: FastifyReply) {
        if (request.auth.session) {
            this.repository.invalidateSession(
                request.auth.session.id,
                nowIso()
            );
        }
        this.clearSessionCookie(reply);

        return {
            ok: true,
            logoutUrl: this.getLogoutUrl(),
        };
    }

    requireUser(request: FastifyRequest): AppUserRecord {
        if (request.auth.user) {
            return request.auth.user;
        }

        throw new AppError('Authentication required.', 401, 'AUTH_REQUIRED');
    }

    private getUnauthenticatedState(
        mode: RequestAuthContext['mode']
    ): RequestAuthContext {
        return {
            mode,
            authenticated: false,
            user: null,
            session: null,
            logoutUrl: this.getLogoutUrl(),
        };
    }

    private getLogoutUrl() {
        return this.env.authMode === 'oidc' ? this.env.oidcLogoutUrl : null;
    }

    private ensureConfiguredLocalUser(): AppUserAuthRecord {
        if (this.env.authMode !== 'password') {
            throw new AppError(
                'Authentication is not configured for password login.',
                500,
                'AUTH_NOT_CONFIGURED'
            );
        }

        if (!this.env.authEmail || !this.env.authPassword) {
            throw new AppError(
                'Authentication is not configured.',
                500,
                'AUTH_NOT_CONFIGURED'
            );
        }

        if (this.configuredUserId) {
            const configuredUser = this.repository.getUserAuthById(
                this.configuredUserId
            );
            if (configuredUser) {
                return configuredUser;
            }
        }

        const existing = this.repository.getUserAuthByEmail(this.env.authEmail);
        const passwordHash = hashPassword(this.env.authPassword);
        const now = nowIso();

        if (!existing) {
            const createdUser: AppUserAuthRecord = {
                id: generateId(),
                email: this.env.authEmail,
                displayName: this.env.authDisplayName,
                authProvider: 'local',
                status: 'active',
                ownershipScope: 'personal',
                passwordHash,
                passwordUpdatedAt: now,
                lastLoginAt: null,
                createdAt: now,
                updatedAt: now,
            };
            this.repository.putUserAuthRecord(createdUser);
            this.configuredUserId = createdUser.id;
            return createdUser;
        }

        const needsPasswordRefresh = !verifyPassword(
            this.env.authPassword,
            existing.passwordHash
        );

        if (
            needsPasswordRefresh ||
            existing.displayName !== this.env.authDisplayName ||
            existing.authProvider !== 'local' ||
            existing.status !== 'active'
        ) {
            const updatedUser: AppUserAuthRecord = {
                ...existing,
                email: this.env.authEmail,
                displayName: this.env.authDisplayName,
                authProvider: 'local',
                status: 'active',
                ownershipScope: 'personal',
                passwordHash: needsPasswordRefresh
                    ? passwordHash
                    : existing.passwordHash,
                passwordUpdatedAt: needsPasswordRefresh
                    ? now
                    : (existing.passwordUpdatedAt ?? now),
                updatedAt: now,
            };
            this.repository.putUserAuthRecord(updatedUser);
            this.configuredUserId = updatedUser.id;
            return updatedUser;
        }

        this.configuredUserId = existing.id;
        return existing;
    }

    private ensureOidcEnabled() {
        if (this.env.authMode !== 'oidc') {
            throw new AppError(
                'OIDC authentication is not enabled.',
                404,
                'AUTH_OIDC_DISABLED'
            );
        }
    }

    private provisionOidcUser(
        issuer: string,
        claims: Record<string, unknown>
    ): AppUserAuthRecord {
        const subject = readStringClaim(claims, 'sub');
        if (!subject) {
            throw new AppError(
                'OIDC response is missing the subject claim.',
                400,
                'OIDC_MISSING_SUBJECT'
            );
        }

        const email = readStringClaim(claims, 'email');
        if (!email) {
            throw new AppError(
                'OIDC response is missing the email claim.',
                400,
                'OIDC_MISSING_EMAIL'
            );
        }

        const normalizedEmail = normalizeEmail(email);
        const displayName = this.resolveOidcDisplayName(
            claims,
            normalizedEmail
        );
        const now = nowIso();

        return this.repository.transaction(() => {
            const linkedIdentity =
                this.repository.getUserIdentityByProviderSubject(
                    'oidc',
                    issuer,
                    subject
                );

            if (linkedIdentity) {
                const linkedUser = this.repository.getUserAuthById(
                    linkedIdentity.userId
                );

                if (!linkedUser || linkedUser.status !== 'active') {
                    throw new AppError(
                        'Your account is inactive.',
                        403,
                        'AUTH_ACCOUNT_INACTIVE'
                    );
                }

                const updatedUser = this.buildOidcUserRecord(
                    linkedUser,
                    normalizedEmail,
                    displayName,
                    now
                );
                this.repository.putUserAuthRecord(updatedUser);
                this.repository.putUserIdentity({
                    ...linkedIdentity,
                    emailAtLink: normalizedEmail,
                    lastLoginAt: now,
                    updatedAt: now,
                });

                return updatedUser;
            }

            const existingUser =
                this.repository.getUserAuthByEmail(normalizedEmail);

            if (existingUser && existingUser.status !== 'active') {
                throw new AppError(
                    'Your account is inactive.',
                    403,
                    'AUTH_ACCOUNT_INACTIVE'
                );
            }

            const user = existingUser
                ? this.buildOidcUserRecord(
                      existingUser,
                      normalizedEmail,
                      displayName,
                      now
                  )
                : this.createOidcUserRecord(normalizedEmail, displayName, now);

            this.repository.putUserAuthRecord(user);
            this.repository.putUserIdentity({
                id: generateId(),
                userId: user.id,
                provider: 'oidc',
                issuer,
                subject,
                emailAtLink: normalizedEmail,
                lastLoginAt: now,
                createdAt: now,
                updatedAt: now,
            });

            return user;
        });
    }

    private createOidcUserRecord(
        email: string,
        displayName: string,
        now: string
    ): AppUserAuthRecord {
        return {
            id: generateId(),
            email,
            displayName,
            authProvider: 'oidc',
            status: 'active',
            ownershipScope: 'personal',
            passwordHash: null,
            passwordUpdatedAt: null,
            lastLoginAt: now,
            createdAt: now,
            updatedAt: now,
        };
    }

    private buildOidcUserRecord(
        user: AppUserAuthRecord,
        email: string,
        displayName: string,
        now: string
    ): AppUserAuthRecord {
        const emailOwner = this.repository.getUserAuthByEmail(email);
        const canUpdateEmail = !emailOwner || emailOwner.id === user.id;

        return {
            ...user,
            email: canUpdateEmail ? email : user.email,
            displayName,
            authProvider: 'oidc',
            status: 'active',
            lastLoginAt: now,
            updatedAt: now,
        };
    }

    private resolveOidcDisplayName(
        claims: Record<string, unknown>,
        email: string
    ) {
        return (
            readStringClaim(claims, 'name') ??
            readStringClaim(claims, 'preferred_username') ??
            email.split('@')[0] ??
            'ChartDB User'
        );
    }

    private toPublicUser(user: AppUserRecord): AppUserRecord {
        return {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            authProvider: user.authProvider,
            status: user.status,
            ownershipScope: user.ownershipScope,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };
    }

    private createSession(
        request: FastifyRequest,
        reply: FastifyReply,
        userId: string,
        now: string
    ) {
        const rawToken = randomBytes(32).toString('base64url');
        const session: AppSessionRecord = {
            id: generateId(),
            userId,
            tokenHash: hashSessionToken(rawToken),
            createdAt: now,
            lastSeenAt: now,
            expiresAt: addHours(now, this.env.sessionTtlHours),
            invalidatedAt: null,
            ipAddress: trimMetadata(request.ip),
            userAgent: trimMetadata(request.headers['user-agent']),
        };
        this.repository.putSession(session);
        this.setSessionCookie(reply, rawToken);
    }

    private signOidcFlowPayload(encodedPayload: string) {
        return base64UrlEncode(
            createHmac('sha256', this.env.encryptionKey)
                .update(encodedPayload, 'utf8')
                .digest()
        );
    }

    private setOidcFlowCookie(reply: FastifyReply, payload: OidcFlowPayload) {
        const encodedPayload = base64UrlEncode(JSON.stringify(payload));
        const encoded = `${encodedPayload}.${this.signOidcFlowPayload(
            encodedPayload
        )}`;

        reply.setCookie(OIDC_FLOW_COOKIE_NAME, encoded, {
            httpOnly: true,
            sameSite: 'lax',
            secure: this.env.sessionCookieSecure,
            path: '/',
            maxAge: Math.floor(OIDC_FLOW_TTL_MS / 1000),
        });
    }

    private readOidcFlowCookie(request: FastifyRequest) {
        const cookieValue = request.cookies[OIDC_FLOW_COOKIE_NAME];
        if (!cookieValue) {
            return null;
        }

        const [encodedPayload, providedSignature] = cookieValue.split('.');
        if (!encodedPayload || !providedSignature) {
            return null;
        }

        const expectedSignature = this.signOidcFlowPayload(encodedPayload);
        const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
        const providedBuffer = Buffer.from(providedSignature, 'utf8');

        if (expectedBuffer.length !== providedBuffer.length) {
            return null;
        }

        if (!timingSafeEqual(expectedBuffer, providedBuffer)) {
            return null;
        }

        try {
            const parsed = JSON.parse(
                base64UrlDecode(encodedPayload).toString('utf8')
            ) as Partial<OidcFlowPayload>;

            if (
                typeof parsed.state !== 'string' ||
                typeof parsed.nonce !== 'string' ||
                typeof parsed.codeVerifier !== 'string' ||
                typeof parsed.returnTo !== 'string' ||
                typeof parsed.expiresAt !== 'number'
            ) {
                return null;
            }

            if (Date.now() > parsed.expiresAt) {
                return null;
            }

            return {
                state: parsed.state,
                nonce: parsed.nonce,
                codeVerifier: parsed.codeVerifier,
                returnTo: sanitizeReturnTo(parsed.returnTo),
                expiresAt: parsed.expiresAt,
            } satisfies OidcFlowPayload;
        } catch {
            return null;
        }
    }

    private clearOidcFlowCookie(reply: FastifyReply) {
        reply.clearCookie(OIDC_FLOW_COOKIE_NAME, {
            httpOnly: true,
            sameSite: 'lax',
            secure: this.env.sessionCookieSecure,
            path: '/',
        });
    }

    private redirectToOidcError(
        reply: FastifyReply,
        errorCode: string,
        returnTo = '/'
    ) {
        const url = new URL(sanitizeReturnTo(returnTo), 'http://chartdb.local');
        url.searchParams.set('authError', errorCode);
        url.searchParams.set(
            'authErrorMessage',
            getOidcErrorMessage(errorCode)
        );
        return reply.redirect(`${url.pathname}${url.search}${url.hash}`);
    }

    private mapOidcErrorCode(code?: string) {
        switch (code) {
            case 'OIDC_MISSING_SUBJECT':
                return 'missing_subject';
            case 'OIDC_MISSING_EMAIL':
                return 'missing_email';
            case 'AUTH_ACCOUNT_INACTIVE':
                return 'account_inactive';
            default:
                return 'callback_failed';
        }
    }

    private setSessionCookie(reply: FastifyReply, value: string) {
        reply.setCookie(this.env.sessionCookieName, value, {
            httpOnly: true,
            sameSite: 'lax',
            secure: this.env.sessionCookieSecure,
            path: '/',
            maxAge: this.env.sessionTtlHours * 60 * 60,
        });
    }

    private clearSessionCookie(reply: FastifyReply) {
        reply.clearCookie(this.env.sessionCookieName, {
            httpOnly: true,
            sameSite: 'lax',
            secure: this.env.sessionCookieSecure,
            path: '/',
        });
    }
}
