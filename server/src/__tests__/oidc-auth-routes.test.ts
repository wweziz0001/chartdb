import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import type { ServerEnv } from '../config/env.js';
import {
    AppRepository,
    type AppUserAuthRecord,
} from '../repositories/app-repository.js';
import type {
    OidcClient,
    OidcClientProvider,
    OidcTokenSet,
} from '../services/oidc-provider.js';

const tempDirs: string[] = [];

const createOidcEnv = (): ServerEnv => {
    const dataDir = mkdtempSync(path.join(os.tmpdir(), 'chartdb-oidc-'));
    tempDirs.push(dataDir);
    return {
        nodeEnv: 'test',
        host: '127.0.0.1',
        port: 4010,
        corsOrigin: 'http://localhost:5173',
        logLevel: 'silent',
        authMode: 'oidc',
        authEmail: null,
        authPassword: null,
        authDisplayName: 'ChartDB Owner',
        sessionTtlHours: 24,
        sessionCookieName: 'chartdb_session',
        sessionCookieSecure: false,
        oidcIssuer: 'https://sso.example.com/realms/chartdb',
        oidcClientId: 'chartdb',
        oidcClientSecret: 'oidc-client-secret',
        oidcRedirectUrl: 'http://localhost:4010/api/auth/oidc/callback',
        oidcLogoutUrl: 'https://sso.example.com/logout',
        oidcScopes: 'openid profile email',
        dataDir,
        metadataDbPath: path.join(dataDir, 'schema-sync.sqlite'),
        appDbPath: path.join(dataDir, 'chartdb-app.sqlite'),
        encryptionKey: Buffer.from('test-key'),
        defaultOwnerName: 'Test Owner',
        defaultProjectName: 'Test Project',
    };
};

const getCookieByName = (
    setCookieHeader: string | string[] | undefined,
    name: string
) => {
    const values = Array.isArray(setCookieHeader)
        ? setCookieHeader
        : setCookieHeader
          ? [setCookieHeader]
          : [];
    const match = values.find((value) => value.startsWith(`${name}=`));
    if (!match) {
        throw new Error(`Expected cookie ${name} to be set.`);
    }

    return match.split(';')[0];
};

const createOidcProvider = (state: {
    authorizationUrl: string;
    claims: Record<string, unknown>;
    callbackInvocations: Array<{
        params: Record<string, unknown>;
        checks: {
            state: string;
            nonce: string;
            codeVerifier: string;
        };
    }>;
}): OidcClientProvider => ({
    getClient: async (): Promise<OidcClient> => ({
        issuer: 'https://sso.example.com/realms/chartdb',
        authorizationUrl: (params) => {
            expect(params.scope).toBe('openid profile email');
            expect(params.response_type).toBe('code');
            return state.authorizationUrl;
        },
        callback: async (
            params: Record<string, unknown>,
            checks: {
                state: string;
                nonce: string;
                codeVerifier: string;
            }
        ): Promise<OidcTokenSet> => {
            state.callbackInvocations.push({ params, checks });
            return {
                claims: () => state.claims,
            };
        },
    }),
});

afterEach(() => {
    while (tempDirs.length > 0) {
        const dir = tempDirs.pop();
        if (dir) {
            rmSync(dir, { recursive: true, force: true });
        }
    }
});

describe('oidc auth routes', () => {
    it('supports oidc start, callback, session creation, and provisioning', async () => {
        const env = createOidcEnv();
        const appRepository = new AppRepository(env.appDbPath);
        const providerState = {
            authorizationUrl: 'https://sso.example.com/auth',
            claims: {
                sub: 'oidc-user-1',
                email: 'owner@example.com',
                name: 'OIDC Owner',
            },
            callbackInvocations: [] as Array<{
                params: Record<string, unknown>;
                checks: {
                    state: string;
                    nonce: string;
                    codeVerifier: string;
                };
            }>,
        };
        const app = buildApp({
            env,
            appRepository,
            oidcProvider: createOidcProvider(providerState),
        });

        const startResponse = await app.inject({
            method: 'GET',
            url: '/api/auth/oidc/start?returnTo=/projects',
        });
        expect(startResponse.statusCode).toBe(302);
        expect(startResponse.headers.location).toBe(
            'https://sso.example.com/auth'
        );

        const flowCookie = getCookieByName(
            startResponse.headers['set-cookie'],
            'chartdb_oidc_flow'
        );

        const callbackResponse = await app.inject({
            method: 'GET',
            url: '/api/auth/oidc/callback?code=test-code',
            headers: {
                cookie: flowCookie,
            },
        });
        expect(callbackResponse.statusCode).toBe(302);
        expect(callbackResponse.headers.location).toBe('/projects');
        expect(providerState.callbackInvocations).toHaveLength(1);
        expect(providerState.callbackInvocations[0]?.params.code).toBe(
            'test-code'
        );

        const sessionCookie = getCookieByName(
            callbackResponse.headers['set-cookie'],
            'chartdb_session'
        );
        const sessionResponse = await app.inject({
            method: 'GET',
            url: '/api/auth/session',
            headers: {
                cookie: sessionCookie,
            },
        });
        expect(sessionResponse.statusCode).toBe(200);
        expect(sessionResponse.json()).toEqual(
            expect.objectContaining({
                mode: 'oidc',
                enabled: true,
                authenticated: true,
                logoutUrl: 'https://sso.example.com/logout',
                user: expect.objectContaining({
                    email: 'owner@example.com',
                    authProvider: 'oidc',
                }),
            })
        );

        const identity = appRepository.getUserIdentityByProviderSubject(
            'oidc',
            'https://sso.example.com/realms/chartdb',
            'oidc-user-1'
        );
        expect(identity?.emailAtLink).toBe('owner@example.com');

        const bootstrapResponse = await app.inject({
            method: 'GET',
            url: '/api/app/bootstrap',
            headers: {
                cookie: sessionCookie,
            },
        });
        expect(bootstrapResponse.statusCode).toBe(200);
        expect(bootstrapResponse.json()).toEqual(
            expect.objectContaining({
                user: expect.objectContaining({
                    authProvider: 'oidc',
                }),
                defaultProject: expect.objectContaining({
                    ownerUserId: expect.any(String),
                }),
            })
        );

        await app.close();
    });

    it('links an oidc identity onto an existing user by email', async () => {
        const env = createOidcEnv();
        const appRepository = new AppRepository(env.appDbPath);
        const now = new Date().toISOString();
        const existingUser: AppUserAuthRecord = {
            id: 'user-local-owner',
            email: 'owner@example.com',
            displayName: 'Existing Owner',
            authProvider: 'local',
            status: 'active',
            ownershipScope: 'personal',
            passwordHash: null,
            passwordUpdatedAt: null,
            lastLoginAt: null,
            createdAt: now,
            updatedAt: now,
        };
        appRepository.putUserAuthRecord(existingUser);

        const providerState = {
            authorizationUrl: 'https://sso.example.com/auth',
            claims: {
                sub: 'oidc-linked-owner',
                email: 'owner@example.com',
                name: 'Linked Owner',
            },
            callbackInvocations: [] as Array<{
                params: Record<string, unknown>;
                checks: {
                    state: string;
                    nonce: string;
                    codeVerifier: string;
                };
            }>,
        };

        const app = buildApp({
            env,
            appRepository,
            oidcProvider: createOidcProvider(providerState),
        });

        const startResponse = await app.inject({
            method: 'GET',
            url: '/api/auth/oidc/start',
        });
        const flowCookie = getCookieByName(
            startResponse.headers['set-cookie'],
            'chartdb_oidc_flow'
        );

        const callbackResponse = await app.inject({
            method: 'GET',
            url: '/api/auth/oidc/callback?code=test-code',
            headers: {
                cookie: flowCookie,
            },
        });
        const sessionCookie = getCookieByName(
            callbackResponse.headers['set-cookie'],
            'chartdb_session'
        );
        const sessionResponse = await app.inject({
            method: 'GET',
            url: '/api/auth/session',
            headers: {
                cookie: sessionCookie,
            },
        });

        expect(sessionResponse.json().user.id).toBe(existingUser.id);

        const linkedIdentity = appRepository.getUserIdentityByProviderSubject(
            'oidc',
            'https://sso.example.com/realms/chartdb',
            'oidc-linked-owner'
        );
        expect(linkedIdentity?.userId).toBe(existingUser.id);
        expect(appRepository.getUserAuthById(existingUser.id)).toEqual(
            expect.objectContaining({
                authProvider: 'oidc',
                displayName: 'Linked Owner',
            })
        );

        await app.close();
    });

    it('rejects oidc callbacks that do not include a valid flow cookie', async () => {
        const env = createOidcEnv();
        const app = buildApp({
            env,
            oidcProvider: createOidcProvider({
                authorizationUrl: 'https://sso.example.com/auth',
                claims: {
                    sub: 'oidc-user-1',
                    email: 'owner@example.com',
                },
                callbackInvocations: [],
            }),
        });

        const response = await app.inject({
            method: 'GET',
            url: '/api/auth/oidc/callback?code=test-code',
        });

        expect(response.statusCode).toBe(302);
        expect(response.headers.location).toContain('authError=missing_flow');

        await app.close();
    });
});
