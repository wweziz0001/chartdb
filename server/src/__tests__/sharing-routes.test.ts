import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scryptSync } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import type { ServerEnv } from '../config/env.js';
import {
    AppRepository,
    type AppUserAuthRecord,
} from '../repositories/app-repository.js';

const tempDirs: string[] = [];

const createAuthEnv = (): ServerEnv => {
    const dataDir = mkdtempSync(path.join(os.tmpdir(), 'chartdb-share-'));
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

const createPasswordHash = (password: string) => {
    const salt = '0123456789abcdef0123456789abcdef';
    const digest = scryptSync(password, salt, 64).toString('hex');
    return `scrypt:${salt}:${digest}`;
};

const createMemberUser = (
    overrides?: Partial<AppUserAuthRecord>
): AppUserAuthRecord => {
    const now = new Date().toISOString();

    return {
        id: overrides?.id ?? 'member-user',
        email: overrides?.email ?? 'member@example.com',
        displayName: overrides?.displayName ?? 'Member',
        authProvider: overrides?.authProvider ?? 'local',
        status: overrides?.status ?? 'active',
        role: overrides?.role ?? 'member',
        ownershipScope: overrides?.ownershipScope ?? 'personal',
        passwordHash:
            overrides?.passwordHash ?? createPasswordHash('member-password'),
        passwordUpdatedAt: overrides?.passwordUpdatedAt ?? null,
        lastLoginAt: overrides?.lastLoginAt ?? null,
        createdAt: overrides?.createdAt ?? now,
        updatedAt: overrides?.updatedAt ?? now,
    };
};

const login = async (
    app: ReturnType<typeof buildApp>,
    email: string,
    password: string
) => {
    const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
            email,
            password,
        },
    });

    expect(response.statusCode).toBe(200);
    return getSessionCookie(response.headers['set-cookie']);
};

afterEach(() => {
    while (tempDirs.length > 0) {
        const dir = tempDirs.pop();
        if (dir) {
            rmSync(dir, { recursive: true, force: true });
        }
    }
});

describe('sharing routes', () => {
    it('protects private diagrams from other authenticated users', async () => {
        const env = createAuthEnv();
        const repository = new AppRepository(env.appDbPath);
        const app = buildApp({
            env,
            appRepository: repository,
        });
        repository.putUserAuthRecord(createMemberUser());

        const ownerCookie = await login(
            app,
            'owner@example.com',
            'super-secret-password'
        );
        const memberCookie = await login(
            app,
            'member@example.com',
            'member-password'
        );

        const bootstrapResponse = await app.inject({
            method: 'GET',
            url: '/api/app/bootstrap',
            headers: {
                cookie: ownerCookie,
            },
        });
        const projectId = bootstrapResponse.json().defaultProject.id as string;

        await app.inject({
            method: 'PUT',
            url: '/api/diagrams/private-diagram',
            headers: {
                cookie: ownerCookie,
            },
            payload: {
                projectId,
                diagram: {
                    id: 'ignored',
                    name: 'Private ERD',
                    databaseType: 'postgresql',
                    createdAt: '2026-03-25T12:00:00.000Z',
                    updatedAt: '2026-03-25T12:00:00.000Z',
                },
            },
        });

        const listProjectsResponse = await app.inject({
            method: 'GET',
            url: '/api/projects',
            headers: {
                cookie: memberCookie,
            },
        });
        expect(listProjectsResponse.statusCode).toBe(200);
        expect(listProjectsResponse.json().items).toHaveLength(0);

        const privateDiagramResponse = await app.inject({
            method: 'GET',
            url: '/api/diagrams/private-diagram',
            headers: {
                cookie: memberCookie,
            },
        });
        expect(privateDiagramResponse.statusCode).toBe(404);
        expect(privateDiagramResponse.json()).toEqual(
            expect.objectContaining({
                code: 'DIAGRAM_NOT_FOUND',
            })
        );

        await app.close();
    });

    it('serves valid shared links and rejects invalid tokens', async () => {
        const env = createAuthEnv();
        const repository = new AppRepository(env.appDbPath);
        const app = buildApp({
            env,
            appRepository: repository,
        });

        const ownerCookie = await login(
            app,
            'owner@example.com',
            'super-secret-password'
        );
        const bootstrapResponse = await app.inject({
            method: 'GET',
            url: '/api/app/bootstrap',
            headers: {
                cookie: ownerCookie,
            },
        });
        const projectId = bootstrapResponse.json().defaultProject.id as string;

        await app.inject({
            method: 'PUT',
            url: '/api/diagrams/shared-diagram',
            headers: {
                cookie: ownerCookie,
            },
            payload: {
                projectId,
                diagram: {
                    id: 'ignored',
                    name: 'Shared ERD',
                    databaseType: 'postgresql',
                    createdAt: '2026-03-25T12:00:00.000Z',
                    updatedAt: '2026-03-25T12:00:00.000Z',
                },
            },
        });

        const shareResponse = await app.inject({
            method: 'PATCH',
            url: '/api/diagrams/shared-diagram/sharing',
            headers: {
                cookie: ownerCookie,
            },
            payload: {
                scope: 'link',
                access: 'view',
            },
        });
        expect(shareResponse.statusCode).toBe(200);
        const sharePath = shareResponse.json().sharing.sharePath as string;
        const shareToken = sharePath.split('/').pop() as string;

        const sharedDiagramResponse = await app.inject({
            method: 'GET',
            url: `/api/shared/diagrams/shared-diagram/${shareToken}`,
        });
        expect(sharedDiagramResponse.statusCode).toBe(200);
        expect(sharedDiagramResponse.json()).toEqual(
            expect.objectContaining({
                id: 'shared-diagram',
                access: 'view',
            })
        );

        const invalidSharedDiagramResponse = await app.inject({
            method: 'GET',
            url: '/api/shared/diagrams/shared-diagram/not-the-right-token',
        });
        expect(invalidSharedDiagramResponse.statusCode).toBe(404);

        const sharedProjectResponse = await app.inject({
            method: 'PATCH',
            url: `/api/projects/${projectId}/sharing`,
            headers: {
                cookie: ownerCookie,
            },
            payload: {
                scope: 'link',
                access: 'view',
            },
        });
        const sharedProjectToken = (
            sharedProjectResponse.json().sharing.sharePath as string
        )
            .split('/')
            .pop() as string;

        const projectViewerResponse = await app.inject({
            method: 'GET',
            url: `/api/shared/projects/${projectId}/${sharedProjectToken}`,
        });
        expect(projectViewerResponse.statusCode).toBe(200);
        expect(projectViewerResponse.json().items).toEqual([
            expect.objectContaining({
                id: 'shared-diagram',
            }),
        ]);

        await app.close();
    });

    it('enforces authenticated permission modes for shared workspaces', async () => {
        const env = createAuthEnv();
        const repository = new AppRepository(env.appDbPath);
        const app = buildApp({
            env,
            appRepository: repository,
        });
        repository.putUserAuthRecord(createMemberUser());

        const ownerCookie = await login(
            app,
            'owner@example.com',
            'super-secret-password'
        );
        const memberCookie = await login(
            app,
            'member@example.com',
            'member-password'
        );

        const bootstrapResponse = await app.inject({
            method: 'GET',
            url: '/api/app/bootstrap',
            headers: {
                cookie: ownerCookie,
            },
        });
        const projectId = bootstrapResponse.json().defaultProject.id as string;

        await app.inject({
            method: 'PUT',
            url: '/api/diagrams/team-diagram',
            headers: {
                cookie: ownerCookie,
            },
            payload: {
                projectId,
                diagram: {
                    id: 'ignored',
                    name: 'Team ERD',
                    databaseType: 'postgresql',
                    createdAt: '2026-03-25T12:00:00.000Z',
                    updatedAt: '2026-03-25T12:00:00.000Z',
                },
            },
        });

        const viewShareResponse = await app.inject({
            method: 'PATCH',
            url: `/api/projects/${projectId}/sharing`,
            headers: {
                cookie: ownerCookie,
            },
            payload: {
                scope: 'authenticated',
                access: 'view',
            },
        });
        expect(viewShareResponse.statusCode).toBe(200);

        const visibleProjectsResponse = await app.inject({
            method: 'GET',
            url: '/api/projects',
            headers: {
                cookie: memberCookie,
            },
        });
        expect(visibleProjectsResponse.statusCode).toBe(200);
        expect(visibleProjectsResponse.json().items).toEqual([
            expect.objectContaining({
                id: projectId,
                access: 'view',
            }),
        ]);

        const rejectedUpdateResponse = await app.inject({
            method: 'PATCH',
            url: '/api/diagrams/team-diagram',
            headers: {
                cookie: memberCookie,
            },
            payload: {
                name: 'Should Not Save',
            },
        });
        expect(rejectedUpdateResponse.statusCode).toBe(404);

        const editShareResponse = await app.inject({
            method: 'PATCH',
            url: `/api/projects/${projectId}/sharing`,
            headers: {
                cookie: ownerCookie,
            },
            payload: {
                scope: 'authenticated',
                access: 'edit',
            },
        });
        expect(editShareResponse.statusCode).toBe(200);

        const allowedUpdateResponse = await app.inject({
            method: 'PATCH',
            url: '/api/diagrams/team-diagram',
            headers: {
                cookie: memberCookie,
            },
            payload: {
                name: 'Edited By Member',
            },
        });
        expect(allowedUpdateResponse.statusCode).toBe(200);
        expect(allowedUpdateResponse.json().diagram).toEqual(
            expect.objectContaining({
                name: 'Edited By Member',
                access: 'edit',
            })
        );

        const forbiddenSharingSettingsResponse = await app.inject({
            method: 'GET',
            url: `/api/projects/${projectId}/sharing`,
            headers: {
                cookie: memberCookie,
            },
        });
        expect(forbiddenSharingSettingsResponse.statusCode).toBe(404);

        await app.close();
    });
});
