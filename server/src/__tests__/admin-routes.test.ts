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

const tempDirs: string[] = [];

const createAdminEnv = (): ServerEnv => {
    const dataDir = mkdtempSync(path.join(os.tmpdir(), 'chartdb-admin-'));
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

const createMemberUser = (
    overrides?: Partial<AppUserAuthRecord>
): AppUserAuthRecord => {
    const now = new Date().toISOString();
    return {
        id: overrides?.id ?? 'member-user-1',
        email: overrides?.email ?? 'member@example.com',
        displayName: overrides?.displayName ?? 'Member User',
        authProvider: overrides?.authProvider ?? 'local',
        status: overrides?.status ?? 'disabled',
        role: overrides?.role ?? 'member',
        ownershipScope: overrides?.ownershipScope ?? 'workspace',
        passwordHash: overrides?.passwordHash ?? null,
        passwordUpdatedAt: overrides?.passwordUpdatedAt ?? null,
        lastLoginAt: overrides?.lastLoginAt ?? null,
        createdAt: overrides?.createdAt ?? now,
        updatedAt: overrides?.updatedAt ?? now,
    };
};

const createDiagramDocument = (id: string, name: string) => {
    const now = new Date();
    return {
        id,
        name,
        databaseType: 'postgresql',
        tables: [],
        relationships: [],
        dependencies: [],
        areas: [],
        customTypes: [],
        notes: [],
        createdAt: now,
        updatedAt: now,
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

describe('admin routes', () => {
    it('requires an authenticated administrator for the overview route', async () => {
        const env = createAdminEnv();
        const repository = new AppRepository(env.appDbPath);
        const app = buildApp({
            env,
            appRepository: repository,
        });

        const unauthenticatedResponse = await app.inject({
            method: 'GET',
            url: '/api/admin/overview',
        });
        expect(unauthenticatedResponse.statusCode).toBe(401);
        expect(unauthenticatedResponse.json()).toEqual(
            expect.objectContaining({
                code: 'AUTH_REQUIRED',
            })
        );

        const loginResponse = await app.inject({
            method: 'POST',
            url: '/api/auth/login',
            payload: {
                email: env.authEmail,
                password: env.authPassword,
            },
        });
        const cookie = getSessionCookie(loginResponse.headers['set-cookie']);
        const adminUser = repository.getUserAuthByEmail('owner@example.com');
        repository.putUserAuthRecord({
            ...adminUser!,
            role: 'member',
            updatedAt: new Date().toISOString(),
        });

        const forbiddenResponse = await app.inject({
            method: 'GET',
            url: '/api/admin/overview',
            headers: {
                cookie,
            },
        });
        expect(forbiddenResponse.statusCode).toBe(403);
        expect(forbiddenResponse.json()).toEqual(
            expect.objectContaining({
                code: 'AUTH_FORBIDDEN',
            })
        );

        await app.close();
    });

    it('returns an admin overview with platform and inventory counts', async () => {
        const env = createAdminEnv();
        const repository = new AppRepository(env.appDbPath);
        const app = buildApp({
            env,
            appRepository: repository,
        });

        const loginResponse = await app.inject({
            method: 'POST',
            url: '/api/auth/login',
            payload: {
                email: env.authEmail,
                password: env.authPassword,
            },
        });
        const cookie = getSessionCookie(loginResponse.headers['set-cookie']);
        const owner = repository.getUserAuthByEmail('owner@example.com');
        const now = new Date().toISOString();

        repository.putUserAuthRecord(
            createMemberUser({
                status: 'disabled',
                createdAt: now,
                updatedAt: now,
            })
        );
        repository.putCollection({
            id: 'collection-1',
            name: 'Operations',
            description: 'Ops work',
            ownerUserId: owner!.id,
            createdAt: now,
            updatedAt: now,
        });
        repository.putProject({
            id: 'project-1',
            name: 'Warehouse',
            description: 'Warehouse domain',
            collectionId: 'collection-1',
            ownerUserId: owner!.id,
            visibility: 'workspace',
            status: 'active',
            sharingScope: 'private',
            sharingAccess: 'view',
            shareToken: null,
            shareUpdatedAt: null,
            createdAt: now,
            updatedAt: now,
        });
        repository.putProject({
            id: 'project-2',
            name: 'Legacy',
            description: null,
            collectionId: null,
            ownerUserId: owner!.id,
            visibility: 'private',
            status: 'archived',
            sharingScope: 'private',
            sharingAccess: 'view',
            shareToken: null,
            shareUpdatedAt: null,
            createdAt: now,
            updatedAt: now,
        });
        repository.putDiagram({
            id: 'diagram-1',
            projectId: 'project-1',
            ownerUserId: owner!.id,
            name: 'Warehouse ERD',
            description: null,
            databaseType: 'postgresql',
            databaseEdition: null,
            visibility: 'workspace',
            status: 'active',
            sharingScope: 'private',
            sharingAccess: 'view',
            shareToken: null,
            shareUpdatedAt: null,
            document: createDiagramDocument('diagram-1', 'Warehouse ERD'),
            createdAt: now,
            updatedAt: now,
        });
        repository.putDiagram({
            id: 'diagram-2',
            projectId: 'project-2',
            ownerUserId: owner!.id,
            name: 'Legacy ERD',
            description: null,
            databaseType: 'postgresql',
            databaseEdition: null,
            visibility: 'private',
            status: 'draft',
            sharingScope: 'private',
            sharingAccess: 'view',
            shareToken: null,
            shareUpdatedAt: null,
            document: createDiagramDocument('diagram-2', 'Legacy ERD'),
            createdAt: now,
            updatedAt: now,
        });

        const response = await app.inject({
            method: 'GET',
            url: '/api/admin/overview',
            headers: {
                cookie,
            },
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual(
            expect.objectContaining({
                metrics: expect.objectContaining({
                    users: 2,
                    admins: 1,
                    collections: 1,
                    projects: 2,
                    diagrams: 2,
                    activeSessions: 1,
                    sharingRecords: null,
                }),
                platform: expect.objectContaining({
                    authMode: 'password',
                    adminInitialized: true,
                    persistence: {
                        app: 'sqlite',
                        schemaSync: 'sqlite',
                    },
                }),
                users: expect.objectContaining({
                    total: 2,
                    admins: 1,
                    byStatus: {
                        provisioned: 0,
                        active: 1,
                        disabled: 1,
                    },
                    items: expect.arrayContaining([
                        expect.objectContaining({
                            email: 'owner@example.com',
                            role: 'admin',
                        }),
                        expect.objectContaining({
                            email: 'member@example.com',
                            status: 'disabled',
                        }),
                    ]),
                }),
                projects: {
                    total: 2,
                    byStatus: {
                        active: 1,
                        archived: 1,
                        deleted: 0,
                    },
                    byVisibility: {
                        private: 1,
                        workspace: 1,
                        public: 0,
                    },
                },
                diagrams: {
                    total: 2,
                    byStatus: {
                        draft: 1,
                        active: 1,
                        archived: 0,
                    },
                    byVisibility: {
                        private: 1,
                        workspace: 1,
                        public: 0,
                    },
                },
                sharing: {
                    supported: false,
                    totalRecords: null,
                },
            })
        );

        await app.close();
    });
});
