import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import type { ServerEnv } from '../config/env.js';
import { AppRepository } from '../repositories/app-repository.js';

const tempDirs: string[] = [];

const createBootstrapEnv = (): ServerEnv => {
    const dataDir = mkdtempSync(path.join(os.tmpdir(), 'chartdb-bootstrap-'));
    tempDirs.push(dataDir);
    return {
        nodeEnv: 'test',
        host: '127.0.0.1',
        port: 4010,
        corsOrigin: 'http://localhost:5173',
        logLevel: 'silent',
        authMode: 'password',
        authEmail: null,
        authPassword: null,
        authDisplayName: 'ChartDB Owner',
        bootstrapSetupCode: 'INIT-2026',
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

const getSessionCookie = (setCookieHeader: string | string[] | undefined) => {
    const headerValue = Array.isArray(setCookieHeader)
        ? setCookieHeader[0]
        : setCookieHeader;
    const cookie = headerValue?.split(';')[0];
    if (!cookie) {
        throw new Error('Expected a session cookie to be set.');
    }

    return cookie;
};

afterEach(() => {
    while (tempDirs.length > 0) {
        const dir = tempDirs.pop();
        if (dir) {
            rmSync(dir, { recursive: true, force: true });
        }
    }
});

describe('admin bootstrap routes', () => {
    it('allows first-admin bootstrap only while the system is uninitialized', async () => {
        const env = createBootstrapEnv();
        const app = buildApp({ env });

        const sessionResponse = await app.inject({
            method: 'GET',
            url: '/api/auth/session',
        });
        expect(sessionResponse.statusCode).toBe(200);
        expect(sessionResponse.json()).toEqual(
            expect.objectContaining({
                authenticated: false,
                bootstrap: expect.objectContaining({
                    required: true,
                    completed: false,
                    setupCodeRequired: true,
                }),
            })
        );

        const bootstrapResponse = await app.inject({
            method: 'POST',
            url: '/api/auth/bootstrap',
            payload: {
                email: 'admin@example.com',
                password: 'super-strong-admin-password',
                displayName: 'Initial Admin',
                setupCode: 'INIT-2026',
            },
        });
        expect(bootstrapResponse.statusCode).toBe(201);
        expect(bootstrapResponse.json()).toEqual(
            expect.objectContaining({
                user: expect.objectContaining({
                    email: 'admin@example.com',
                    authProvider: 'local',
                    role: 'admin',
                }),
            })
        );

        const cookie = getSessionCookie(
            bootstrapResponse.headers['set-cookie']
        );
        const appBootstrapResponse = await app.inject({
            method: 'GET',
            url: '/api/app/bootstrap',
            headers: {
                cookie,
            },
        });
        expect(appBootstrapResponse.statusCode).toBe(200);

        await app.close();
    });

    it('blocks repeated bootstrap after the first administrator is created', async () => {
        const app = buildApp({ env: createBootstrapEnv() });

        const firstResponse = await app.inject({
            method: 'POST',
            url: '/api/auth/bootstrap',
            payload: {
                email: 'admin@example.com',
                password: 'super-strong-admin-password',
                displayName: 'Initial Admin',
                setupCode: 'INIT-2026',
            },
        });
        expect(firstResponse.statusCode).toBe(201);

        const secondResponse = await app.inject({
            method: 'POST',
            url: '/api/auth/bootstrap',
            payload: {
                email: 'another-admin@example.com',
                password: 'another-super-strong-password',
                displayName: 'Another Admin',
                setupCode: 'INIT-2026',
            },
        });
        expect(secondResponse.statusCode).toBe(409);
        expect(secondResponse.json()).toEqual(
            expect.objectContaining({
                code: 'AUTH_BOOTSTRAP_COMPLETED',
            })
        );

        await app.close();
    });

    it('blocks password login until bootstrap completes and persists the admin role', async () => {
        const env = createBootstrapEnv();
        const repository = new AppRepository(env.appDbPath);
        const app = buildApp({
            env,
            appRepository: repository,
        });

        const blockedLogin = await app.inject({
            method: 'POST',
            url: '/api/auth/login',
            payload: {
                email: 'admin@example.com',
                password: 'super-strong-admin-password',
            },
        });
        expect(blockedLogin.statusCode).toBe(403);
        expect(blockedLogin.json()).toEqual(
            expect.objectContaining({
                code: 'AUTH_BOOTSTRAP_REQUIRED',
            })
        );

        const bootstrapResponse = await app.inject({
            method: 'POST',
            url: '/api/auth/bootstrap',
            payload: {
                email: 'admin@example.com',
                password: 'super-strong-admin-password',
                displayName: 'Initial Admin',
                setupCode: 'INIT-2026',
            },
        });
        expect(bootstrapResponse.statusCode).toBe(201);

        const adminUser = repository.getUserAuthByEmail('admin@example.com');
        expect(adminUser?.role).toBe('admin');
        expect(repository.countActiveAdmins()).toBe(1);

        await app.close();
    });
});
