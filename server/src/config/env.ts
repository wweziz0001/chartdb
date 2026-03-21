import path from 'node:path';

const parsePort = (value: string | undefined, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

export const serverEnv = {
    port: parsePort(process.env.PORT, 4010),
    host: process.env.HOST ?? '0.0.0.0',
    auditDir:
        process.env.CHARTDB_AUDIT_DIR ??
        path.resolve(process.cwd(), '.chartdb-data', 'audits'),
    connectionStorePath:
        process.env.CHARTDB_CONNECTION_STORE ??
        path.resolve(process.cwd(), '.chartdb-data', 'connections.enc.json'),
    encryptionKey:
        process.env.CHARTDB_SECRET_KEY ??
        'development-only-secret-key-change-me',
    corsOrigin: process.env.CHARTDB_CORS_ORIGIN ?? '*',
};
