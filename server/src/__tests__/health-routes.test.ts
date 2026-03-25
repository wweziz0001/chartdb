import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import type { ServerEnv } from '../config/env.js';

const tempDirs: string[] = [];

const createTestEnv = (): ServerEnv => {
    const dataDir = mkdtempSync(path.join(os.tmpdir(), 'chartdb-health-'));
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

describe('health routes', () => {
    it('returns backend liveness, readiness, and health details', async () => {
        const app = buildApp({ env: createTestEnv() });
        const livez = await app.inject({
            method: 'GET',
            url: '/api/livez',
        });
        const readyz = await app.inject({
            method: 'GET',
            url: '/api/readyz',
        });
        const health = await app.inject({
            method: 'GET',
            url: '/api/health',
        });

        expect(livez.statusCode).toBe(200);
        expect(livez.json()).toMatchObject({
            ok: true,
            service: 'chartdb-api',
        });

        expect(readyz.statusCode).toBe(200);
        expect(readyz.json()).toMatchObject({
            ok: true,
            checks: {
                appDatabase: {
                    status: 'up',
                },
                metadataDatabase: {
                    status: 'up',
                },
            },
        });

        expect(health.statusCode).toBe(200);
        expect(health.json()).toMatchObject({
            ok: true,
            service: 'chartdb-api',
            persistence: {
                app: {
                    adapter: 'sqlite',
                    status: 'up',
                },
                schemaSync: {
                    adapter: 'sqlite',
                    status: 'up',
                },
            },
        });

        await app.close();
    });
});
