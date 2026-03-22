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

        const createdProjectResponse = await app.inject({
            method: 'POST',
            url: '/api/projects',
            payload: {
                name: 'Team Project',
                description: 'Main project workspace',
            },
        });
        expect(createdProjectResponse.statusCode).toBe(200);
        const createdProject = createdProjectResponse.json().project as {
            id: string;
            name: string;
        };
        expect(createdProject.name).toBe('Team Project');

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
});
