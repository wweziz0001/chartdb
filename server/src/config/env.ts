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
        .enum(['disabled', 'password'])
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
    CHARTDB_DEFAULT_PROJECT_NAME: z.string().optional().default('My Diagrams'),
    CHARTDB_DEFAULT_OWNER_NAME: z.string().optional().default('Local Owner'),
});

const parsedEnv = envSchema.parse(process.env);

const dataDir = parsedEnv.CHARTDB_DATA_DIR
    ? path.resolve(parsedEnv.CHARTDB_DATA_DIR)
    : path.resolve(repoRoot, '.chartdb-data');

mkdirSync(dataDir, { recursive: true });

const resolveSecretKey = (): string => {
    const provided = parsedEnv.CHARTDB_SECRET_KEY?.trim();
    const isPlaceholder =
        !provided || provided === 'change-me-before-production';

    if (!isPlaceholder) {
        return provided;
    }

    if (parsedEnv.NODE_ENV === 'production') {
        throw new Error(
            'CHARTDB_SECRET_KEY must be set to a non-placeholder value in production.'
        );
    }

    console.warn(
        '[config] CHARTDB_SECRET_KEY is not configured. Using an ephemeral development key.'
    );
    return randomBytes(32).toString('hex');
};

const rawEncryptionKey = resolveSecretKey();
const authCookieSecure =
    parsedEnv.CHARTDB_SESSION_COOKIE_SECURE === undefined
        ? parsedEnv.NODE_ENV === 'production'
        : parsedEnv.CHARTDB_SESSION_COOKIE_SECURE === 'true';

if (
    parsedEnv.CHARTDB_AUTH_MODE === 'password' &&
    (!parsedEnv.CHARTDB_AUTH_EMAIL || !parsedEnv.CHARTDB_AUTH_PASSWORD)
) {
    throw new Error(
        'CHARTDB_AUTH_EMAIL and CHARTDB_AUTH_PASSWORD must be set when CHARTDB_AUTH_MODE=password.'
    );
}

if (
    parsedEnv.CHARTDB_AUTH_MODE === 'password' &&
    parsedEnv.NODE_ENV === 'production' &&
    parsedEnv.CHARTDB_CORS_ORIGIN === '*'
) {
    throw new Error(
        'CHARTDB_CORS_ORIGIN must be set to an explicit origin in production when password authentication is enabled.'
    );
}

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
    authMode: 'disabled' | 'password';
    authEmail: string | null;
    authPassword: string | null;
    authDisplayName: string;
    sessionTtlHours: number;
    sessionCookieName: string;
    sessionCookieSecure: boolean;
    dataDir: string;
    metadataDbPath: string;
    appDbPath: string;
    encryptionKey: Buffer;
    defaultProjectName: string;
    defaultOwnerName: string;
}

export const serverEnv: ServerEnv = {
    nodeEnv: parsedEnv.NODE_ENV,
    host: parsedEnv.CHARTDB_API_HOST,
    port: parsedEnv.CHARTDB_API_PORT,
    corsOrigin: parsedEnv.CHARTDB_CORS_ORIGIN,
    logLevel: parsedEnv.CHARTDB_LOG_LEVEL,
    authMode: parsedEnv.CHARTDB_AUTH_MODE,
    authEmail: parsedEnv.CHARTDB_AUTH_EMAIL?.toLowerCase() ?? null,
    authPassword: parsedEnv.CHARTDB_AUTH_PASSWORD ?? null,
    authDisplayName: parsedEnv.CHARTDB_AUTH_DISPLAY_NAME,
    sessionTtlHours: parsedEnv.CHARTDB_SESSION_TTL_HOURS,
    sessionCookieName: parsedEnv.CHARTDB_SESSION_COOKIE_NAME,
    sessionCookieSecure: authCookieSecure,
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
