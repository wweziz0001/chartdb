import {
    createHash,
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
import { AppError } from '../utils/app-error.js';
import { generateId } from '../utils/id.js';

const PASSWORD_HASH_PREFIX = 'scrypt';
const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export interface RequestAuthContext {
    mode: 'disabled' | 'password';
    authenticated: boolean;
    user: AppUserRecord | null;
    session: AppSessionRecord | null;
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

export class AuthService {
    private configuredUserId: string | null = null;

    constructor(
        private readonly repository: AppRepository,
        private readonly env: ServerEnv
    ) {}

    isEnabled(): boolean {
        return this.env.authMode !== 'disabled';
    }

    async authenticateRequest(
        request: FastifyRequest
    ): Promise<RequestAuthContext> {
        if (!this.isEnabled()) {
            return {
                mode: 'disabled',
                authenticated: false,
                user: null,
                session: null,
            };
        }

        this.ensureConfiguredLocalUser();

        const token = request.cookies[this.env.sessionCookieName];
        if (!token) {
            return {
                mode: 'password',
                authenticated: false,
                user: null,
                session: null,
            };
        }

        const session = this.repository.getSessionByTokenHash(
            hashSessionToken(token)
        );

        if (!session) {
            return {
                mode: 'password',
                authenticated: false,
                user: null,
                session: null,
            };
        }

        const now = nowIso();
        const expired =
            session.invalidatedAt !== null ||
            Date.parse(session.expiresAt) <= Date.now();

        if (expired) {
            if (!session.invalidatedAt) {
                this.repository.invalidateSession(session.id, now);
            }
            return {
                mode: 'password',
                authenticated: false,
                user: null,
                session: null,
            };
        }

        const user = this.repository.getUserAuthById(session.userId);
        if (
            !user ||
            user.status !== 'active' ||
            !user.passwordHash ||
            (user.passwordUpdatedAt &&
                Date.parse(session.createdAt) <
                    Date.parse(user.passwordUpdatedAt))
        ) {
            this.repository.invalidateSession(session.id, now);
            return {
                mode: 'password',
                authenticated: false,
                user: null,
                session: null,
            };
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
            mode: 'password',
            authenticated: true,
            user: this.toPublicUser(user),
            session,
        };
    }

    getSessionState(request: FastifyRequest): RequestAuthContext {
        return request.auth;
    }

    login(request: FastifyRequest, reply: FastifyReply, input: unknown) {
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

        const now = nowIso();
        const updatedUser: AppUserAuthRecord = {
            ...user,
            lastLoginAt: now,
            updatedAt: now,
        };
        this.repository.putUserAuthRecord(updatedUser);

        const rawToken = randomBytes(32).toString('base64url');
        const session: AppSessionRecord = {
            id: generateId(),
            userId: user.id,
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

        return {
            user: this.toPublicUser(updatedUser),
        };
    }

    logout(request: FastifyRequest, reply: FastifyReply) {
        if (request.auth.session) {
            this.repository.invalidateSession(
                request.auth.session.id,
                nowIso()
            );
        }
        this.clearSessionCookie(reply);

        return { ok: true };
    }

    requireUser(request: FastifyRequest): AppUserRecord {
        if (request.auth.user) {
            return request.auth.user;
        }

        throw new AppError('Authentication required.', 401, 'AUTH_REQUIRED');
    }

    private ensureConfiguredLocalUser(): AppUserAuthRecord {
        if (
            !this.isEnabled() ||
            !this.env.authEmail ||
            !this.env.authPassword
        ) {
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
