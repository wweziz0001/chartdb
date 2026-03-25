import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import type { ServerEnv } from '../config/env.js';

const tempDirs: string[] = [];

const createTestEnv = (): ServerEnv => {
    const dataDir = mkdtempSync(path.join(os.tmpdir(), 'chartdb-apply-'));
    tempDirs.push(dataDir);
    return {
        nodeEnv: 'test',
        host: '127.0.0.1',
        port: 4010,
        corsOrigin: '*',
        logLevel: 'silent',
        authMode: 'disabled',
        authEmail: null,
        authPassword: null,
        authDisplayName: 'Test Owner',
        bootstrapSetupCode: null,
        bootstrapSetupCodeTtlMs: 15 * 60 * 1000,
        bootstrapSetupCodeMaxAttempts: 10,
        bootstrapAdminEmail: null,
        sessionTtlHours: 24,
        sessionCookieName: 'chartdb_session',
        sessionCookieSecure: false,
        oidcIssuer: null,
        oidcClientId: null,
        oidcClientSecret: null,
        oidcRedirectUrl: null,
        oidcLogoutUrl: null,
        oidcScopes: 'openid profile email',
        dataDir,
        metadataDbPath: path.join(dataDir, 'schema-sync.sqlite'),
        appDbPath: path.join(dataDir, 'chartdb-app.sqlite'),
        encryptionKey: Buffer.from('test-key'),
        defaultOwnerName: 'Test Owner',
        defaultProjectName: 'Test Project',
    };
};

afterEach(() => {
    while (tempDirs.length > 0) {
        const dir = tempDirs.pop();
        if (dir) {
            rmSync(dir, { recursive: true, force: true });
        }
    }
});

describe('schema sync api', () => {
    it('exposes a health endpoint', async () => {
        const app = buildApp({ env: createTestEnv() });
        const response = await app.inject({
            method: 'GET',
            url: '/api/health',
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual(expect.objectContaining({ ok: true }));
    });

    it('allows connection test drafts without a saved connection name', async () => {
        const app = buildApp({ env: createTestEnv() });
        const response = await app.inject({
            method: 'POST',
            url: '/api/connections/test',
            payload: {
                connection: {
                    name: '',
                    engine: 'postgresql',
                    defaultSchemas: ['public'],
                    secret: {
                        host: '127.0.0.1',
                        port: 1,
                        database: 'postgres',
                        username: 'postgres',
                        password: 'postgres',
                        sslMode: 'disable',
                    },
                },
            },
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual(
            expect.objectContaining({
                ok: false,
                availableSchemas: [],
            })
        );
    });

    it('returns 400 for invalid request payloads', async () => {
        const app = buildApp({ env: createTestEnv() });
        const response = await app.inject({
            method: 'POST',
            url: '/api/connections/test',
            payload: {
                connection: {
                    secret: {
                        host: '',
                        port: 5432,
                        database: '',
                        username: '',
                        password: '',
                        sslMode: 'prefer',
                    },
                },
            },
        });

        expect(response.statusCode).toBe(400);
        expect(response.json()).toEqual(
            expect.objectContaining({
                error: 'Invalid request payload.',
            })
        );
    });
});
