import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import type { ServerEnv } from '../config/env.js';

const tempDirs: string[] = [];

const createAuthEnv = (): ServerEnv => {
    const dataDir = mkdtempSync(path.join(os.tmpdir(), 'chartdb-auth-'));
    tempDirs.push(dataDir);
    return {
        nodeEnv: 'test',
        host: '127.0.0.1',
        port: 4010,
        corsOrigin: 'http://localhost:5173',
        logLevel: 'silent',
        authMode: 'password',
        authEmail: 'owner@example.com',
        authPassword: 'super-secret-password',
        authDisplayName: 'Owner',
        sessionTtlHours: 24,
        sessionCookieName: 'chartdb_session',
        sessionCookieSecure: false,
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

describe('auth routes', () => {
    it('rejects protected routes without an authenticated session', async () => {
        const app = buildApp({ env: createAuthEnv() });

        const sessionResponse = await app.inject({
            method: 'GET',
            url: '/api/auth/session',
        });
        expect(sessionResponse.statusCode).toBe(200);
        expect(sessionResponse.json()).toEqual(
            expect.objectContaining({
                mode: 'password',
                enabled: true,
                authenticated: false,
                user: null,
            })
        );

        const protectedResponse = await app.inject({
            method: 'GET',
            url: '/api/app/bootstrap',
        });
        expect(protectedResponse.statusCode).toBe(401);
        expect(protectedResponse.json()).toEqual(
            expect.objectContaining({
                code: 'AUTH_REQUIRED',
            })
        );

        await app.close();
    });

    it('supports login success and failure flows', async () => {
        const app = buildApp({ env: createAuthEnv() });

        const invalidLoginResponse = await app.inject({
            method: 'POST',
            url: '/api/auth/login',
            payload: {
                email: 'owner@example.com',
                password: 'wrong-password',
            },
        });
        expect(invalidLoginResponse.statusCode).toBe(401);
        expect(invalidLoginResponse.json()).toEqual(
            expect.objectContaining({
                code: 'AUTH_INVALID_CREDENTIALS',
            })
        );

        const loginResponse = await app.inject({
            method: 'POST',
            url: '/api/auth/login',
            payload: {
                email: 'owner@example.com',
                password: 'super-secret-password',
            },
        });
        expect(loginResponse.statusCode).toBe(200);
        expect(loginResponse.json().user).toEqual(
            expect.objectContaining({
                email: 'owner@example.com',
                authProvider: 'local',
            })
        );

        const cookie = getSessionCookie(loginResponse.headers['set-cookie']);
        const bootstrapResponse = await app.inject({
            method: 'GET',
            url: '/api/app/bootstrap',
            headers: {
                cookie,
            },
        });
        expect(bootstrapResponse.statusCode).toBe(200);
        expect(bootstrapResponse.json()).toEqual(
            expect.objectContaining({
                user: expect.objectContaining({
                    email: 'owner@example.com',
                    authProvider: 'local',
                }),
                defaultProject: expect.objectContaining({
                    ownerUserId: expect.any(String),
                }),
            })
        );

        await app.close();
    });

    it('invalidates the current session on logout', async () => {
        const app = buildApp({ env: createAuthEnv() });

        const loginResponse = await app.inject({
            method: 'POST',
            url: '/api/auth/login',
            payload: {
                email: 'owner@example.com',
                password: 'super-secret-password',
            },
        });
        const cookie = getSessionCookie(loginResponse.headers['set-cookie']);

        const logoutResponse = await app.inject({
            method: 'POST',
            url: '/api/auth/logout',
            headers: {
                cookie,
            },
        });
        expect(logoutResponse.statusCode).toBe(200);
        expect(logoutResponse.json()).toEqual({ ok: true });

        const postLogoutResponse = await app.inject({
            method: 'GET',
            url: '/api/app/bootstrap',
            headers: {
                cookie,
            },
        });
        expect(postLogoutResponse.statusCode).toBe(401);

        await app.close();
    });
});
