import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const envSchema = z.object({
    NODE_ENV: z.string().optional(),
    CHARTDB_API_HOST: z.string().optional(),
    CHARTDB_API_PORT: z.coerce.number().int().min(1).max(65535).optional(),
    CHARTDB_CORS_ORIGIN: z.string().optional(),
    CHARTDB_DATA_DIR: z.string().optional(),
    CHARTDB_SECRET_KEY: z.string().min(16).optional(),
    CHARTDB_LOG_LEVEL: z
        .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
        .optional(),
    CHARTDB_DEFAULT_USER_ID: z.string().min(1).optional(),
    CHARTDB_DEFAULT_USER_EMAIL: z.string().email().optional(),
    CHARTDB_DEFAULT_USER_NAME: z.string().min(1).optional(),
});

export interface ServerEnv {
    nodeEnv: string;
    host: string;
    port: number;
    corsOrigin: string;
    dataDir: string;
    metadataDbPath: string;
    encryptionKey: Buffer;
    logLevel:
        | 'fatal'
        | 'error'
        | 'warn'
        | 'info'
        | 'debug'
        | 'trace'
        | 'silent';
    defaultUser: {
        id: string;
        email: string;
        name: string;
    };
}

export const resolveServerEnv = (
    input: NodeJS.ProcessEnv = process.env
): ServerEnv => {
    const parsed = envSchema.parse(input);
    const cwd = process.cwd();
    const dataDir = parsed.CHARTDB_DATA_DIR
        ? path.resolve(parsed.CHARTDB_DATA_DIR)
        : path.resolve(cwd, '.chartdb-data');

    mkdirSync(dataDir, { recursive: true });

    const isProduction = parsed.NODE_ENV === 'production';
    const rawEncryptionKey =
        parsed.CHARTDB_SECRET_KEY ??
        (isProduction ? '' : 'chartdb-local-dev-secret');

    if (rawEncryptionKey.length === 0) {
        throw new Error(
            'CHARTDB_SECRET_KEY must be set in production and be at least 16 characters long.'
        );
    }

    return {
        nodeEnv: parsed.NODE_ENV ?? 'development',
        host: parsed.CHARTDB_API_HOST ?? '0.0.0.0',
        port: parsed.CHARTDB_API_PORT ?? 4010,
        corsOrigin: parsed.CHARTDB_CORS_ORIGIN ?? '*',
        dataDir,
        metadataDbPath: path.join(dataDir, 'chartdb.sqlite'),
        encryptionKey: createHash('sha256').update(rawEncryptionKey).digest(),
        logLevel: parsed.CHARTDB_LOG_LEVEL ?? 'info',
        defaultUser: {
            id: parsed.CHARTDB_DEFAULT_USER_ID ?? 'local-admin',
            email: parsed.CHARTDB_DEFAULT_USER_EMAIL ?? 'owner@chartdb.local',
            name: parsed.CHARTDB_DEFAULT_USER_NAME ?? 'ChartDB Local Admin',
        },
    };
};

export const serverEnv = resolveServerEnv();
