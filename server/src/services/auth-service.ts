import {
    createHash,
    createHmac,
    randomInt,
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
import { bootstrapRequestSchema, loginRequestSchema } from '../schemas/auth.js';
import type { OidcClientProvider } from './oidc-provider.js';
import { OpenIdClientProvider } from './oidc-provider.js';
import { AppError } from '../utils/app-error.js';
import { generateId } from '../utils/id.js';

const PASSWORD_HASH_PREFIX = 'scrypt';
const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;
const OIDC_FLOW_COOKIE_NAME = 'chartdb_oidc_flow';
const OIDC_FLOW_TTL_MS = 10 * 60 * 1000;
const BOOTSTRAP_STATE_CONFIG_KEY = 'auth_bootstrap_state';
const BOOTSTRAP_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

type OidcFlowPayload = {
    state: string;
    nonce: string;
    codeVerifier: string;
    returnTo: string;
    expiresAt: number;
};

type AuthBootstrapState = {
    completedAt: string | null;
    adminUserId: string | null;
    setupCodeHash: string | null;
    setupCodeIssuedAt: string | null;
    setupCodeExpiresAt: string | null;
    setupCodeFailedAttempts: number;
    setupCodeSource: 'generated' | 'env' | null;
};

export interface AuthBootstrapStatus {
    required: boolean;
    completed: boolean;
    setupCodeRequired: boolean;
}

export interface RequestAuthContext {
    mode: 'disabled' | 'password' | 'oidc';
    authenticated: boolean;
    user: AppUserRecord | null;
    session: AppSessionRecord | null;
    logoutUrl: string | null;
    bootstrap: AuthBootstrapStatus;
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

const hashBootstrapSetupCode = (normalizedCode: string) =>
    createHash('sha256').update(normalizedCode, 'utf8').digest('hex');

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

const normalizeBootstrapSetupCode = (value: string) =>
    value
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .trim();

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

const createBootstrapSetupCode = () => {
    let value = '';

    for (let index = 0; index < 8; index += 1) {
        value +=
            BOOTSTRAP_CODE_ALPHABET[
                randomInt(0, BOOTSTRAP_CODE_ALPHABET.length)
            ];
    }

    return `${value.slice(0, 4)}-${value.slice(4, 8)}`;
};

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
        case 'bootstrap_required':
            return 'Initial administrator bootstrap is still pending for this deployment.';
        default:
            return 'OIDC sign-in failed.';
    }
};

export class AuthService {
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

    getBootstrapStatus(): AuthBootstrapStatus {
        return this.resolveBootstrapStatus();
    }

    async authenticateRequest(
        request: FastifyRequest
    ): Promise<RequestAuthContext> {
        if (!this.isEnabled()) {
            return this.getUnauthenticatedState('disabled');
        }

        this.prepareBootstrap(request);

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
            bootstrap: this.resolveBootstrapStatus(),
        };
    }

    getSessionState(request: FastifyRequest): RequestAuthContext {
        return request.auth;
    }

    bootstrap(request: FastifyRequest, reply: FastifyReply, input: unknown) {
        if (this.env.authMode !== 'password') {
            throw new AppError(
                'Interactive bootstrap is only available for password authentication.',
                405,
                'AUTH_BOOTSTRAP_UNSUPPORTED'
            );
        }

        if (!this.isEnabled()) {
            throw new AppError(
                'Authentication is disabled.',
                404,
                'AUTH_DISABLED'
            );
        }

        this.prepareBootstrap(request);

        const status = this.resolveBootstrapStatus();
        if (!status.required) {
            request.log.warn(
                'Rejected bootstrap attempt after initialization.'
            );
            throw new AppError(
                'Initial administrator bootstrap has already completed.',
                409,
                'AUTH_BOOTSTRAP_COMPLETED'
            );
        }

        const payload = bootstrapRequestSchema.parse(input);
        const verification = this.verifyBootstrapSetupCode(payload.setupCode);

        if (!verification.ok) {
            throw new AppError(
                verification.message,
                verification.statusCode,
                verification.code
            );
        }

        const normalizedEmail = normalizeEmail(payload.email);
        const now = nowIso();
        const user = this.repository.transaction(() => {
            const existingUser =
                this.repository.getUserAuthByEmail(normalizedEmail);

            if (existingUser) {
                throw new AppError(
                    'A user with that email already exists.',
                    409,
                    'AUTH_BOOTSTRAP_EMAIL_CONFLICT'
                );
            }

            const createdUser: AppUserAuthRecord = {
                id: generateId(),
                email: normalizedEmail,
                displayName: payload.displayName.trim(),
                authProvider: 'local',
                status: 'active',
                role: 'admin',
                ownershipScope: 'personal',
                passwordHash: hashPassword(payload.password),
                passwordUpdatedAt: now,
                lastLoginAt: now,
                createdAt: now,
                updatedAt: now,
            };
            this.repository.putUserAuthRecord(createdUser);
            this.completeBootstrap(createdUser.id);
            return createdUser;
        });

        request.log.info(
            {
                event: 'auth.bootstrap.completed',
                adminUserId: user.id,
                email: user.email,
                authMode: this.env.authMode,
            },
            'Initialized first ChartDB administrator.'
        );

        this.createSession(request, reply, user.id, now);
        return {
            user: this.toPublicUser(user),
        };
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

        this.prepareBootstrap(request);

        const bootstrap = this.resolveBootstrapStatus();
        if (bootstrap.required) {
            throw new AppError(
                'Initial administrator bootstrap must complete before password sign-in is available.',
                403,
                'AUTH_BOOTSTRAP_REQUIRED'
            );
        }

        const payload = loginRequestSchema.parse(input);
        const user = this.repository.getUserAuthByEmail(
            normalizeEmail(payload.email)
        );
        const emailMatches = user?.authProvider === 'local';
        const passwordMatches = verifyPassword(
            payload.password,
            user?.passwordHash
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
            bootstrap: this.resolveBootstrapStatus(),
        };
    }

    private getLogoutUrl() {
        return this.env.authMode === 'oidc' ? this.env.oidcLogoutUrl : null;
    }

    private prepareBootstrap(request: FastifyRequest) {
        if (!this.isEnabled()) {
            return;
        }

        if (this.env.authMode === 'password') {
            this.ensureEnvironmentBootstrap(request);
            this.ensureBootstrapSetupCode(request);
        }
    }

    private readBootstrapState(): AuthBootstrapState {
        const rawValue = this.repository.getConfigValue(
            BOOTSTRAP_STATE_CONFIG_KEY
        );
        if (!rawValue) {
            return {
                completedAt: null,
                adminUserId: null,
                setupCodeHash: null,
                setupCodeIssuedAt: null,
                setupCodeExpiresAt: null,
                setupCodeFailedAttempts: 0,
                setupCodeSource: null,
            };
        }

        try {
            const parsed = JSON.parse(rawValue) as Partial<AuthBootstrapState>;
            return {
                completedAt:
                    typeof parsed.completedAt === 'string'
                        ? parsed.completedAt
                        : null,
                adminUserId:
                    typeof parsed.adminUserId === 'string'
                        ? parsed.adminUserId
                        : null,
                setupCodeHash:
                    typeof parsed.setupCodeHash === 'string'
                        ? parsed.setupCodeHash
                        : null,
                setupCodeIssuedAt:
                    typeof parsed.setupCodeIssuedAt === 'string'
                        ? parsed.setupCodeIssuedAt
                        : null,
                setupCodeExpiresAt:
                    typeof parsed.setupCodeExpiresAt === 'string'
                        ? parsed.setupCodeExpiresAt
                        : null,
                setupCodeFailedAttempts:
                    typeof parsed.setupCodeFailedAttempts === 'number'
                        ? parsed.setupCodeFailedAttempts
                        : 0,
                setupCodeSource:
                    parsed.setupCodeSource === 'generated' ||
                    parsed.setupCodeSource === 'env'
                        ? parsed.setupCodeSource
                        : null,
            };
        } catch {
            return {
                completedAt: null,
                adminUserId: null,
                setupCodeHash: null,
                setupCodeIssuedAt: null,
                setupCodeExpiresAt: null,
                setupCodeFailedAttempts: 0,
                setupCodeSource: null,
            };
        }
    }

    private writeBootstrapState(state: AuthBootstrapState) {
        this.repository.setConfigValue(
            BOOTSTRAP_STATE_CONFIG_KEY,
            JSON.stringify(state)
        );
    }

    private resolveBootstrapStatus(): AuthBootstrapStatus {
        if (!this.isEnabled()) {
            return {
                required: false,
                completed: false,
                setupCodeRequired: false,
            };
        }

        const state = this.readBootstrapState();
        if (state.completedAt) {
            return {
                required: false,
                completed: true,
                setupCodeRequired: false,
            };
        }

        const existingAdmin = this.repository.getFirstActiveAdmin();
        if (existingAdmin) {
            this.completeBootstrap(existingAdmin.id);
            return {
                required: false,
                completed: true,
                setupCodeRequired: false,
            };
        }

        return {
            required: true,
            completed: false,
            setupCodeRequired: this.env.authMode === 'password',
        };
    }

    private completeBootstrap(adminUserId: string) {
        this.writeBootstrapState({
            completedAt: nowIso(),
            adminUserId,
            setupCodeHash: null,
            setupCodeIssuedAt: null,
            setupCodeExpiresAt: null,
            setupCodeFailedAttempts: 0,
            setupCodeSource: null,
        });
    }

    private ensureEnvironmentBootstrap(request: FastifyRequest) {
        if (
            this.env.authMode !== 'password' ||
            !this.env.authEmail ||
            !this.env.authPassword
        ) {
            return;
        }

        const bootstrapEmail = this.env.authEmail;
        const bootstrapPassword = this.env.authPassword;
        const status = this.resolveBootstrapStatus();
        if (!status.required) {
            return;
        }

        const now = nowIso();
        const user = this.repository.transaction(() => {
            const existingUser =
                this.repository.getUserAuthByEmail(bootstrapEmail);

            if (existingUser && existingUser.status !== 'active') {
                throw new AppError(
                    'The configured bootstrap account is inactive.',
                    500,
                    'AUTH_BOOTSTRAP_ENV_INVALID'
                );
            }

            const userRecord: AppUserAuthRecord = existingUser
                ? {
                      ...existingUser,
                      email: bootstrapEmail,
                      displayName: this.env.authDisplayName,
                      authProvider: 'local',
                      status: 'active',
                      role: 'admin',
                      ownershipScope: 'personal',
                      passwordHash: hashPassword(bootstrapPassword),
                      passwordUpdatedAt: now,
                      updatedAt: now,
                  }
                : {
                      id: generateId(),
                      email: bootstrapEmail,
                      displayName: this.env.authDisplayName,
                      authProvider: 'local',
                      status: 'active',
                      role: 'admin',
                      ownershipScope: 'personal',
                      passwordHash: hashPassword(bootstrapPassword),
                      passwordUpdatedAt: now,
                      lastLoginAt: null,
                      createdAt: now,
                      updatedAt: now,
                  };

            this.repository.putUserAuthRecord(userRecord);
            this.completeBootstrap(userRecord.id);
            return userRecord;
        });

        request.log.info(
            {
                event: 'auth.bootstrap.env_completed',
                adminUserId: user.id,
                email: user.email,
            },
            'Initialized first ChartDB administrator from environment settings.'
        );
    }

    private ensureBootstrapSetupCode(request: FastifyRequest) {
        if (this.env.authMode !== 'password') {
            return;
        }

        const status = this.resolveBootstrapStatus();
        if (!status.required) {
            return;
        }

        const state = this.readBootstrapState();
        const codeFromEnv = this.env.bootstrapSetupCode;
        const normalizedEnvCode = codeFromEnv
            ? normalizeBootstrapSetupCode(codeFromEnv)
            : null;
        const envCodeHash = normalizedEnvCode
            ? hashBootstrapSetupCode(normalizedEnvCode)
            : null;
        const hasValidGeneratedCode =
            state.setupCodeSource === 'generated' &&
            Boolean(state.setupCodeHash) &&
            Boolean(state.setupCodeExpiresAt) &&
            Date.parse(state.setupCodeExpiresAt as string) > Date.now();

        if (envCodeHash) {
            if (
                state.setupCodeSource === 'env' &&
                state.setupCodeHash === envCodeHash
            ) {
                return;
            }

            this.writeBootstrapState({
                ...state,
                setupCodeHash: envCodeHash,
                setupCodeIssuedAt: nowIso(),
                setupCodeExpiresAt: null,
                setupCodeFailedAttempts: 0,
                setupCodeSource: 'env',
            });
            request.log.info(
                {
                    event: 'auth.bootstrap.env_code_ready',
                },
                'Interactive bootstrap is ready with the configured setup code.'
            );
            return;
        }

        if (
            hasValidGeneratedCode ||
            state.setupCodeFailedAttempts >=
                this.env.bootstrapSetupCodeMaxAttempts
        ) {
            return;
        }

        const setupCode = createBootstrapSetupCode();
        const normalizedCode = normalizeBootstrapSetupCode(setupCode);
        const issuedAt = nowIso();
        const expiresAt = new Date(
            Date.now() + this.env.bootstrapSetupCodeTtlMs
        ).toISOString();

        this.writeBootstrapState({
            ...state,
            setupCodeHash: hashBootstrapSetupCode(normalizedCode),
            setupCodeIssuedAt: issuedAt,
            setupCodeExpiresAt: expiresAt,
            setupCodeFailedAttempts: 0,
            setupCodeSource: 'generated',
        });

        request.log.warn(
            {
                event: 'auth.bootstrap.generated_code_issued',
                expiresAt,
                setupCode,
            },
            'Generated a one-time setup code for first-admin bootstrap.'
        );
    }

    private verifyBootstrapSetupCode(setupCode: string) {
        const state = this.readBootstrapState();

        if (!state.setupCodeHash) {
            return {
                ok: false as const,
                statusCode: 403,
                code: 'AUTH_BOOTSTRAP_CODE_UNAVAILABLE',
                message:
                    'No bootstrap setup code is available. Check the server configuration and startup logs.',
            };
        }

        if (
            state.setupCodeExpiresAt &&
            Date.parse(state.setupCodeExpiresAt) <= Date.now()
        ) {
            return {
                ok: false as const,
                statusCode: 403,
                code: 'AUTH_BOOTSTRAP_CODE_EXPIRED',
                message:
                    'The bootstrap setup code has expired. Restart the setup flow and use the latest code.',
            };
        }

        if (
            state.setupCodeFailedAttempts >=
            this.env.bootstrapSetupCodeMaxAttempts
        ) {
            return {
                ok: false as const,
                statusCode: 423,
                code: 'AUTH_BOOTSTRAP_LOCKED',
                message:
                    'Bootstrap is locked after too many failed setup code attempts.',
            };
        }

        const normalizedCode = normalizeBootstrapSetupCode(setupCode);
        const providedHash = hashBootstrapSetupCode(normalizedCode);
        const expectedBuffer = Buffer.from(state.setupCodeHash, 'hex');
        const providedBuffer = Buffer.from(providedHash, 'hex');
        const isValid =
            expectedBuffer.length === providedBuffer.length &&
            timingSafeEqual(expectedBuffer, providedBuffer);

        if (!isValid) {
            this.writeBootstrapState({
                ...state,
                setupCodeFailedAttempts: state.setupCodeFailedAttempts + 1,
            });
            return {
                ok: false as const,
                statusCode: 403,
                code: 'AUTH_BOOTSTRAP_CODE_INVALID',
                message: 'The provided bootstrap setup code is invalid.',
            };
        }

        return {
            ok: true as const,
        };
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
        const bootstrap = this.resolveBootstrapStatus();
        const bootstrapEmailMatches =
            this.env.bootstrapAdminEmail === normalizedEmail;

        if (bootstrap.required) {
            if (!this.env.bootstrapAdminEmail) {
                throw new AppError(
                    'Initial OIDC administrator bootstrap is pending. Configure CHARTDB_BOOTSTRAP_ADMIN_EMAIL before signing in.',
                    403,
                    'AUTH_BOOTSTRAP_REQUIRED'
                );
            }

            if (!bootstrapEmailMatches) {
                throw new AppError(
                    'Initial OIDC administrator bootstrap is restricted to the configured bootstrap email.',
                    403,
                    'AUTH_BOOTSTRAP_REQUIRED'
                );
            }
        }

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
                    now,
                    bootstrap.required
                );
                this.repository.putUserAuthRecord(updatedUser);
                this.repository.putUserIdentity({
                    ...linkedIdentity,
                    emailAtLink: normalizedEmail,
                    lastLoginAt: now,
                    updatedAt: now,
                });
                if (bootstrap.required) {
                    this.completeBootstrap(updatedUser.id);
                }

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
                      now,
                      bootstrap.required
                  )
                : this.createOidcUserRecord(
                      normalizedEmail,
                      displayName,
                      now,
                      bootstrap.required
                  );

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
            if (bootstrap.required) {
                this.completeBootstrap(user.id);
            }

            return user;
        });
    }

    private createOidcUserRecord(
        email: string,
        displayName: string,
        now: string,
        isBootstrapAdmin: boolean
    ): AppUserAuthRecord {
        return {
            id: generateId(),
            email,
            displayName,
            authProvider: 'oidc',
            status: 'active',
            role: isBootstrapAdmin ? 'admin' : 'member',
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
        now: string,
        isBootstrapAdmin: boolean
    ): AppUserAuthRecord {
        const emailOwner = this.repository.getUserAuthByEmail(email);
        const canUpdateEmail = !emailOwner || emailOwner.id === user.id;

        return {
            ...user,
            email: canUpdateEmail ? email : user.email,
            displayName,
            authProvider: 'oidc',
            status: 'active',
            role:
                isBootstrapAdmin || user.role === 'admin' ? 'admin' : 'member',
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
            role: user.role,
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
            case 'AUTH_BOOTSTRAP_REQUIRED':
                return 'bootstrap_required';
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
