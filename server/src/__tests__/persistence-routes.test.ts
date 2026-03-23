import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import type { ServerEnv } from '../config/env.js';

const tempDirs: string[] = [];

const createTestEnv = (): ServerEnv => {
    const dataDir = mkdtempSync(path.join(os.tmpdir(), 'chartdb-persist-'));
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

describe('persistence routes', () => {
    it('supports project and diagram CRUD flows', async () => {
        const app = buildApp({ env: createTestEnv() });
        const bootstrap = await app.inject({
            method: 'GET',
            url: '/api/app/bootstrap',
        });
        const defaultProjectId = bootstrap.json().defaultProject.id as string;

        const createdCollectionResponse = await app.inject({
            method: 'POST',
            url: '/api/collections',
            payload: {
                name: 'Operations',
                description: 'Runbooks and systems diagrams',
            },
        });
        expect(createdCollectionResponse.statusCode).toBe(200);
        const createdCollection = createdCollectionResponse.json()
            .collection as {
            id: string;
            name: string;
        };
        expect(createdCollection.name).toBe('Operations');

        const createdProjectResponse = await app.inject({
            method: 'POST',
            url: '/api/projects',
            payload: {
                name: 'Team Project',
                description: 'Main project workspace',
                collectionId: createdCollection.id,
            },
        });
        expect(createdProjectResponse.statusCode).toBe(200);
        const createdProject = createdProjectResponse.json().project as {
            id: string;
            name: string;
            collectionId: string | null;
        };
        expect(createdProject.name).toBe('Team Project');
        expect(createdProject.collectionId).toBe(createdCollection.id);

        const projectsByCollectionResponse = await app.inject({
            method: 'GET',
            url: `/api/projects?collectionId=${createdCollection.id}`,
        });
        expect(projectsByCollectionResponse.statusCode).toBe(200);
        expect(projectsByCollectionResponse.json().items).toHaveLength(1);

        const createDiagramResponse = await app.inject({
            method: 'PUT',
            url: '/api/diagrams/diagram-1',
            payload: {
                projectId: createdProject.id,
                description: 'Initial diagram',
                diagram: {
                    id: 'ignored',
                    name: 'Revenue Diagram',
                    databaseType: 'postgresql',
                    tables: [{ id: 'tbl-1', name: 'accounts' }],
                    createdAt: '2026-03-22T12:00:00.000Z',
                    updatedAt: '2026-03-22T12:00:00.000Z',
                },
            },
        });
        expect(createDiagramResponse.statusCode).toBe(200);

        const updatedDiagramResponse = await app.inject({
            method: 'PATCH',
            url: '/api/diagrams/diagram-1',
            payload: {
                name: 'Revenue Diagram v2',
                description: 'Renamed in library',
            },
        });
        expect(updatedDiagramResponse.statusCode).toBe(200);
        expect(updatedDiagramResponse.json().diagram.name).toBe(
            'Revenue Diagram v2'
        );

        const projectDiagramsResponse = await app.inject({
            method: 'GET',
            url: `/api/projects/${createdProject.id}/diagrams`,
        });
        expect(projectDiagramsResponse.statusCode).toBe(200);
        expect(projectDiagramsResponse.json().items).toHaveLength(1);

        const movedProjectResponse = await app.inject({
            method: 'PATCH',
            url: `/api/projects/${createdProject.id}`,
            payload: {
                collectionId: null,
            },
        });
        expect(movedProjectResponse.statusCode).toBe(200);
        expect(movedProjectResponse.json().project.collectionId).toBeNull();

        const unassignedProjectsResponse = await app.inject({
            method: 'GET',
            url: '/api/projects?unassigned=true',
        });
        expect(unassignedProjectsResponse.statusCode).toBe(200);
        expect(
            unassignedProjectsResponse
                .json()
                .items.some(
                    (project: { id: string }) =>
                        project.id === createdProject.id
                )
        ).toBe(true);

        const collectionsResponse = await app.inject({
            method: 'GET',
            url: '/api/collections',
        });
        expect(collectionsResponse.statusCode).toBe(200);
        expect(collectionsResponse.json().items).toEqual([
            expect.objectContaining({
                id: createdCollection.id,
                projectCount: 0,
                diagramCount: 0,
            }),
        ]);

        const deleteDiagramResponse = await app.inject({
            method: 'DELETE',
            url: '/api/diagrams/diagram-1',
        });
        expect(deleteDiagramResponse.statusCode).toBe(200);

        const deleteProjectResponse = await app.inject({
            method: 'DELETE',
            url: `/api/projects/${createdProject.id}`,
        });
        expect(deleteProjectResponse.statusCode).toBe(200);

        const deleteCollectionResponse = await app.inject({
            method: 'DELETE',
            url: `/api/collections/${createdCollection.id}`,
        });
        expect(deleteCollectionResponse.statusCode).toBe(200);

        const projectsResponse = await app.inject({
            method: 'GET',
            url: '/api/projects',
        });
        expect(projectsResponse.statusCode).toBe(200);
        expect(
            projectsResponse
                .json()
                .items.find(
                    (project: { id: string }) => project.id === defaultProjectId
                )
        ).toBeTruthy();
        expect(
            projectsResponse
                .json()
                .items.find(
                    (project: { id: string }) =>
                        project.id === createdProject.id
                )
        ).toBeUndefined();

        await app.close();
    });

    it('supports search queries and validates incompatible project filters', async () => {
        const app = buildApp({ env: createTestEnv() });

        const bootstrap = await app.inject({
            method: 'GET',
            url: '/api/app/bootstrap',
        });
        const defaultProjectId = bootstrap.json().defaultProject.id as string;

        const createdCollectionResponse = await app.inject({
            method: 'POST',
            url: '/api/collections',
            payload: {
                name: 'Analytics Workspace',
            },
        });
        const createdCollection = createdCollectionResponse.json()
            .collection as {
            id: string;
        };

        const createdProjectResponse = await app.inject({
            method: 'POST',
            url: '/api/projects',
            payload: {
                name: 'Revenue Reporting',
                collectionId: createdCollection.id,
            },
        });
        const createdProject = createdProjectResponse.json().project as {
            id: string;
        };

        await app.inject({
            method: 'PUT',
            url: '/api/diagrams/diagram-search-1',
            payload: {
                projectId: createdProject.id,
                description: 'Revenue search fixture',
                diagram: {
                    id: 'ignored',
                    name: 'Revenue Diagram',
                    databaseType: 'postgresql',
                    tables: [
                        { id: 'tbl-1', name: 'accounts', schema: 'finance' },
                    ],
                    createdAt: '2026-03-22T12:00:00.000Z',
                    updatedAt: '2026-03-22T12:00:00.000Z',
                },
            },
        });

        const searchProjectsResponse = await app.inject({
            method: 'GET',
            url: '/api/projects?search=finance',
        });
        expect(searchProjectsResponse.statusCode).toBe(200);
        expect(
            searchProjectsResponse
                .json()
                .items.map((project: { id: string }) => project.id)
        ).toContain(createdProject.id);
        expect(
            searchProjectsResponse
                .json()
                .items.map((project: { id: string }) => project.id)
        ).not.toContain(defaultProjectId);

        const searchDiagramsResponse = await app.inject({
            method: 'GET',
            url: `/api/projects/${createdProject.id}/diagrams?search=analytic`,
        });
        expect(searchDiagramsResponse.statusCode).toBe(200);
        expect(searchDiagramsResponse.json().items).toHaveLength(1);

        const invalidFilterResponse = await app.inject({
            method: 'GET',
            url: `/api/projects?collectionId=${createdCollection.id}&unassigned=true`,
        });
        expect(invalidFilterResponse.statusCode).toBe(400);
        expect(invalidFilterResponse.json().issues).toEqual([
            expect.objectContaining({
                message:
                    'collectionId and unassigned filters cannot be combined.',
            }),
        ]);

        await app.close();
    });

    it('exports and imports versioned backup payloads through the API', async () => {
        const sourceApp = buildApp({ env: createTestEnv() });
        const bootstrap = await sourceApp.inject({
            method: 'GET',
            url: '/api/app/bootstrap',
        });
        const defaultProjectId = bootstrap.json().defaultProject.id as string;

        await sourceApp.inject({
            method: 'PUT',
            url: '/api/diagrams/diagram-backup-1',
            payload: {
                projectId: defaultProjectId,
                description: 'Backup fixture',
                diagram: {
                    id: 'ignored',
                    name: 'Backup Diagram',
                    databaseType: 'postgresql',
                    tables: [{ id: 'tbl-1', name: 'accounts' }],
                    createdAt: '2026-03-22T12:00:00.000Z',
                    updatedAt: '2026-03-22T12:00:00.000Z',
                },
            },
        });

        const exportResponse = await sourceApp.inject({
            method: 'POST',
            url: '/api/backups/export',
            payload: {
                scope: 'projects',
                projectIds: [defaultProjectId],
            },
        });
        expect(exportResponse.statusCode).toBe(200);
        const exportPayload = exportResponse.json() as Record<string, unknown>;
        expect(exportPayload).toEqual(
            expect.objectContaining({
                format: 'chartdb-backup',
                formatVersion: 1,
            })
        );

        const targetApp = buildApp({ env: createTestEnv() });
        const importResponse = await targetApp.inject({
            method: 'POST',
            url: '/api/backups/import',
            payload: exportPayload,
        });
        expect(importResponse.statusCode).toBe(200);
        expect(importResponse.json().import).toEqual(
            expect.objectContaining({
                diagramCount: 1,
                firstDiagramId: expect.any(String),
            })
        );

        const invalidVersionResponse = await targetApp.inject({
            method: 'POST',
            url: '/api/backups/import',
            payload: {
                ...exportPayload,
                formatVersion: 99,
            },
        });
        expect(invalidVersionResponse.statusCode).toBe(400);
        expect(invalidVersionResponse.json()).toEqual(
            expect.objectContaining({
                code: 'BACKUP_VERSION_UNSUPPORTED',
            })
        );

        await sourceApp.close();
        await targetApp.close();
    });
});
