import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotEnv } from 'dotenv';
import { z } from 'zod';

const serverRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../..'
);
const repoRoot = path.resolve(serverRoot, '..');

loadDotEnv({ path: path.join(repoRoot, '.env'), override: false, quiet: true });
loadDotEnv({
    path: path.join(serverRoot, '.env'),
    override: false,
    quiet: true,
});

const envSchema = z.object({
    NODE_ENV: z
        .enum(['development', 'test', 'production'])
        .optional()
        .default('development'),
    CHARTDB_API_HOST: z.string().optional().default('0.0.0.0'),
    CHARTDB_API_PORT: z.coerce
        .number()
        .int()
        .positive()
        .optional()
        .default(4010),
    CHARTDB_CORS_ORIGIN: z.string().optional().default('*'),
    CHARTDB_DATA_DIR: z.string().optional(),
    CHARTDB_METADATA_DB_PATH: z.string().optional(),
    CHARTDB_APP_DB_PATH: z.string().optional(),
    CHARTDB_SECRET_KEY: z.string().optional(),
    CHARTDB_LOG_LEVEL: z
        .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
        .optional()
        .default('info'),
    CHARTDB_AUTH_MODE: z
        .enum(['disabled', 'password', 'oidc'])
        .optional()
        .default('disabled'),
    CHARTDB_AUTH_EMAIL: z.string().trim().email().optional(),
    CHARTDB_AUTH_PASSWORD: z.string().min(8).optional(),
    CHARTDB_AUTH_DISPLAY_NAME: z
        .string()
        .trim()
        .min(1)
        .max(120)
        .optional()
        .default('ChartDB Owner'),
    CHARTDB_BOOTSTRAP_SETUP_CODE: z.string().trim().min(8).max(120).optional(),
    CHARTDB_BOOTSTRAP_SETUP_CODE_TTL_MS: z.coerce
        .number()
        .int()
        .positive()
        .optional()
        .default(15 * 60 * 1000),
    CHARTDB_BOOTSTRAP_SETUP_CODE_MAX_ATTEMPTS: z.coerce
        .number()
        .int()
        .positive()
        .optional()
        .default(10),
    CHARTDB_BOOTSTRAP_ADMIN_EMAIL: z.string().trim().email().optional(),
    CHARTDB_SESSION_TTL_HOURS: z.coerce
        .number()
        .int()
        .positive()
        .optional()
        .default(24 * 7),
    CHARTDB_SESSION_COOKIE_NAME: z
        .string()
        .trim()
        .min(1)
        .max(120)
        .optional()
        .default('chartdb_session'),
    CHARTDB_SESSION_COOKIE_SECURE: z.enum(['true', 'false']).optional(),
    CHARTDB_OIDC_ISSUER: z.string().trim().url().optional(),
    CHARTDB_OIDC_CLIENT_ID: z.string().trim().min(1).max(255).optional(),
    CHARTDB_OIDC_CLIENT_SECRET: z.string().min(1).optional(),
    CHARTDB_OIDC_REDIRECT_URL: z.string().trim().url().optional(),
    CHARTDB_OIDC_LOGOUT_URL: z.string().trim().url().optional(),
    CHARTDB_OIDC_SCOPES: z
        .string()
        .trim()
        .min(1)
        .optional()
        .default('openid profile email'),
    CHARTDB_DEFAULT_PROJECT_NAME: z.string().optional().default('My Diagrams'),
    CHARTDB_DEFAULT_OWNER_NAME: z.string().optional().default('Local Owner'),
});

const resolveSecretKey = (
    parsedEnv: z.infer<typeof envSchema>,
    nodeEnv: 'development' | 'test' | 'production'
): string => {
    const provided = parsedEnv.CHARTDB_SECRET_KEY?.trim();
    const isPlaceholder =
        !provided || provided === 'change-me-before-production';

    if (!isPlaceholder) {
        return provided;
    }

    if (nodeEnv === 'production') {
        throw new Error(
            'CHARTDB_SECRET_KEY must be set to a non-placeholder value in production.'
        );
    }

    console.warn(
        '[config] CHARTDB_SECRET_KEY is not configured. Using an ephemeral development key.'
    );
    return randomBytes(32).toString('hex');
};

export interface ServerEnv {
    nodeEnv: 'development' | 'test' | 'production';
    host: string;
    port: number;
    corsOrigin: string;
    logLevel:
        | 'fatal'
        | 'error'
        | 'warn'
        | 'info'
        | 'debug'
        | 'trace'
        | 'silent';
    authMode: 'disabled' | 'password' | 'oidc';
    authEmail: string | null;
    authPassword: string | null;
    authDisplayName: string;
    bootstrapSetupCode: string | null;
    bootstrapSetupCodeTtlMs: number;
    bootstrapSetupCodeMaxAttempts: number;
    bootstrapAdminEmail: string | null;
    sessionTtlHours: number;
    sessionCookieName: string;
    sessionCookieSecure: boolean;
    oidcIssuer: string | null;
    oidcClientId: string | null;
    oidcClientSecret: string | null;
    oidcRedirectUrl: string | null;
    oidcLogoutUrl: string | null;
    oidcScopes: string;
    dataDir: string;
    metadataDbPath: string;
    appDbPath: string;
    encryptionKey: Buffer;
    defaultProjectName: string;
    defaultOwnerName: string;
}

export const parseServerEnv = (
    input: NodeJS.ProcessEnv = process.env
): ServerEnv => {
    const normalizedInput = Object.fromEntries(
        Object.entries(input).map(([key, value]) => [
            key,
            typeof value === 'string' && value.trim().length === 0
                ? undefined
                : value,
        ])
    );
    const parsedEnv = envSchema.parse(normalizedInput);
    const dataDir = parsedEnv.CHARTDB_DATA_DIR
        ? path.resolve(parsedEnv.CHARTDB_DATA_DIR)
        : path.resolve(repoRoot, '.chartdb-data');

    mkdirSync(dataDir, { recursive: true });

    const authCookieSecure =
        parsedEnv.CHARTDB_SESSION_COOKIE_SECURE === undefined
            ? parsedEnv.NODE_ENV === 'production'
            : parsedEnv.CHARTDB_SESSION_COOKIE_SECURE === 'true';

    const hasBootstrapEmail = Boolean(parsedEnv.CHARTDB_AUTH_EMAIL);
    const hasBootstrapPassword = Boolean(parsedEnv.CHARTDB_AUTH_PASSWORD);

    if (
        parsedEnv.CHARTDB_AUTH_MODE === 'password' &&
        hasBootstrapEmail !== hasBootstrapPassword
    ) {
        throw new Error(
            'CHARTDB_AUTH_EMAIL and CHARTDB_AUTH_PASSWORD must be set together when using environment-assisted password bootstrap.'
        );
    }

    if (parsedEnv.CHARTDB_AUTH_MODE === 'oidc') {
        const missing = [
            ['CHARTDB_OIDC_ISSUER', parsedEnv.CHARTDB_OIDC_ISSUER],
            ['CHARTDB_OIDC_CLIENT_ID', parsedEnv.CHARTDB_OIDC_CLIENT_ID],
            ['CHARTDB_OIDC_REDIRECT_URL', parsedEnv.CHARTDB_OIDC_REDIRECT_URL],
        ]
            .filter(([, value]) => !value)
            .map(([name]) => name);

        if (missing.length > 0) {
            throw new Error(
                `CHARTDB_AUTH_MODE=oidc requires OIDC configuration. Missing: ${missing.join(
                    ', '
                )}`
            );
        }
    }

    if (
        parsedEnv.CHARTDB_AUTH_MODE !== 'disabled' &&
        parsedEnv.NODE_ENV === 'production' &&
        parsedEnv.CHARTDB_CORS_ORIGIN === '*'
    ) {
        throw new Error(
            'CHARTDB_CORS_ORIGIN must be set to an explicit origin in production when authentication is enabled.'
        );
    }

    if (
        parsedEnv.CHARTDB_AUTH_MODE === 'oidc' &&
        parsedEnv.NODE_ENV === 'production' &&
        parsedEnv.CHARTDB_OIDC_REDIRECT_URL &&
        !/^https:\/\//i.test(parsedEnv.CHARTDB_OIDC_REDIRECT_URL)
    ) {
        throw new Error(
            'CHARTDB_OIDC_REDIRECT_URL must use HTTPS in production.'
        );
    }

    if (
        parsedEnv.NODE_ENV === 'production' &&
        parsedEnv.CHARTDB_OIDC_LOGOUT_URL &&
        !/^https:\/\//i.test(parsedEnv.CHARTDB_OIDC_LOGOUT_URL)
    ) {
        throw new Error(
            'CHARTDB_OIDC_LOGOUT_URL must use HTTPS in production.'
        );
    }

    const rawEncryptionKey = resolveSecretKey(parsedEnv, parsedEnv.NODE_ENV);

    return {
        nodeEnv: parsedEnv.NODE_ENV,
        host: parsedEnv.CHARTDB_API_HOST,
        port: parsedEnv.CHARTDB_API_PORT,
        corsOrigin: parsedEnv.CHARTDB_CORS_ORIGIN,
        logLevel: parsedEnv.CHARTDB_LOG_LEVEL,
        authMode: parsedEnv.CHARTDB_AUTH_MODE,
        authEmail: parsedEnv.CHARTDB_AUTH_EMAIL?.toLowerCase() ?? null,
        authPassword: parsedEnv.CHARTDB_AUTH_PASSWORD ?? null,
        authDisplayName: parsedEnv.CHARTDB_AUTH_DISPLAY_NAME,
        bootstrapSetupCode: parsedEnv.CHARTDB_BOOTSTRAP_SETUP_CODE ?? null,
        bootstrapSetupCodeTtlMs: parsedEnv.CHARTDB_BOOTSTRAP_SETUP_CODE_TTL_MS,
        bootstrapSetupCodeMaxAttempts:
            parsedEnv.CHARTDB_BOOTSTRAP_SETUP_CODE_MAX_ATTEMPTS,
        bootstrapAdminEmail:
            parsedEnv.CHARTDB_BOOTSTRAP_ADMIN_EMAIL?.toLowerCase() ?? null,
        sessionTtlHours: parsedEnv.CHARTDB_SESSION_TTL_HOURS,
        sessionCookieName: parsedEnv.CHARTDB_SESSION_COOKIE_NAME,
        sessionCookieSecure: authCookieSecure,
        oidcIssuer: parsedEnv.CHARTDB_OIDC_ISSUER ?? null,
        oidcClientId: parsedEnv.CHARTDB_OIDC_CLIENT_ID ?? null,
        oidcClientSecret: parsedEnv.CHARTDB_OIDC_CLIENT_SECRET ?? null,
        oidcRedirectUrl: parsedEnv.CHARTDB_OIDC_REDIRECT_URL ?? null,
        oidcLogoutUrl: parsedEnv.CHARTDB_OIDC_LOGOUT_URL ?? null,
        oidcScopes: parsedEnv.CHARTDB_OIDC_SCOPES,
        dataDir,
        metadataDbPath: parsedEnv.CHARTDB_METADATA_DB_PATH
            ? path.resolve(parsedEnv.CHARTDB_METADATA_DB_PATH)
            : path.join(dataDir, 'schema-sync.sqlite'),
        appDbPath: parsedEnv.CHARTDB_APP_DB_PATH
            ? path.resolve(parsedEnv.CHARTDB_APP_DB_PATH)
            : path.join(dataDir, 'chartdb-app.sqlite'),
        encryptionKey: createHash('sha256').update(rawEncryptionKey).digest(),
        defaultProjectName: parsedEnv.CHARTDB_DEFAULT_PROJECT_NAME,
        defaultOwnerName: parsedEnv.CHARTDB_DEFAULT_OWNER_NAME,
    };
};

export const serverEnv: ServerEnv = parseServerEnv();
