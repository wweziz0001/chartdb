import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AppRepository } from '../repositories/app-repository.js';
import { diagramDocumentSchema } from '../schemas/persistence.js';
import { PersistenceService } from '../services/persistence-service.js';

const tempDirs: string[] = [];

const createService = () => {
    const dataDir = mkdtempSync(path.join(os.tmpdir(), 'chartdb-persist-'));
    tempDirs.push(dataDir);
    const repository = new AppRepository(
        path.join(dataDir, 'chartdb-app.sqlite')
    );
    const service = new PersistenceService(repository, {
        defaultOwnerName: 'Test Owner',
        defaultProjectName: 'Test Project',
    });

    return { repository, service };
};

afterEach(() => {
    while (tempDirs.length > 0) {
        const dir = tempDirs.pop();
        if (dir) {
            rmSync(dir, { recursive: true, force: true });
        }
    }
});

describe('persistence foundation', () => {
    it('bootstraps a placeholder owner and default project', () => {
        const { repository, service } = createService();
        const bootstrap = service.bootstrap();

        expect(bootstrap.user.authProvider).toBe('placeholder');
        expect(bootstrap.defaultProject.ownerUserId).toBe(bootstrap.user.id);
        expect(bootstrap.defaultProject.collectionId).toBeNull();

        repository.close();
    });

    it('supports collection CRUD and project assignment', () => {
        const { repository, service } = createService();
        service.bootstrap();
        const collection = service.createCollection({
            name: 'Platform Team',
            description: 'Shared architecture work',
        });

        const project = service.createProject({
            name: 'Service Map',
            collectionId: collection.id,
        });

        expect(project.collectionId).toBe(collection.id);
        expect(service.listCollections()).toEqual([
            expect.objectContaining({
                id: collection.id,
                name: 'Platform Team',
                projectCount: 1,
                diagramCount: 0,
            }),
        ]);

        const updatedCollection = service.updateCollection(collection.id, {
            name: 'Platform Architecture',
        });
        expect(updatedCollection.name).toBe('Platform Architecture');

        const movedProject = service.updateProject(project.id, {
            collectionId: null,
        });
        expect(movedProject.collectionId).toBeNull();
        expect(
            service.listProjects({ unassigned: true }).map((item) => item.id)
        ).toContain(project.id);
        expect(
            service.listProjects({ collectionId: collection.id })
        ).toHaveLength(0);

        service.deleteCollection(collection.id);
        expect(service.listCollections()).toHaveLength(0);

        const persistedProject = repository.getProject(project.id);
        expect(persistedProject?.collectionId).toBeNull();

        repository.close();
    });

    it('validates and stores diagram documents with ownership and visibility metadata', () => {
        const { repository, service } = createService();
        const bootstrap = service.bootstrap();
        const now = new Date('2026-03-22T12:00:00.000Z');

        const saved = service.upsertDiagram('diagram-1', {
            projectId: bootstrap.defaultProject.id,
            ownerUserId: bootstrap.user.id,
            visibility: 'private',
            status: 'active',
            diagram: {
                id: 'ignored-by-route',
                name: 'Backend Foundation',
                databaseType: 'postgresql',
                tables: [{ id: 'tbl-1', name: 'users' }],
                createdAt: now.toISOString(),
                updatedAt: now.toISOString(),
            },
        });

        expect(saved.id).toBe('diagram-1');
        expect(saved.projectId).toBe(bootstrap.defaultProject.id);
        expect(saved.visibility).toBe('private');
        expect(
            diagramDocumentSchema.parse(saved.diagram).createdAt.toISOString()
        ).toBe(now.toISOString());

        repository.close();
    });

    it('updates saved diagram metadata without replacing the stored document', () => {
        const { repository, service } = createService();
        const bootstrap = service.bootstrap();
        const now = new Date('2026-03-22T12:00:00.000Z');

        service.upsertDiagram('diagram-1', {
            projectId: bootstrap.defaultProject.id,
            description: 'Original description',
            diagram: {
                id: 'ignored-by-route',
                name: 'Original Diagram',
                databaseType: 'postgresql',
                tables: [{ id: 'tbl-1', name: 'users' }],
                createdAt: now.toISOString(),
                updatedAt: now.toISOString(),
            },
        });

        const updated = service.updateDiagram('diagram-1', {
            name: 'Renamed Diagram',
            description: 'Updated description',
            status: 'archived',
        });

        expect(updated.name).toBe('Renamed Diagram');
        expect(updated.description).toBe('Updated description');
        expect(updated.status).toBe('archived');
        expect(updated.diagram.name).toBe('Renamed Diagram');
        expect(updated.diagram.tables).toEqual([
            { id: 'tbl-1', name: 'users' },
        ]);

        repository.close();
    });

    it('re-points the default project after deleting the current default', () => {
        const { repository, service } = createService();
        const bootstrap = service.bootstrap();
        const secondaryProject = service.createProject({
            name: 'Secondary Project',
        });

        service.deleteProject(bootstrap.defaultProject.id);
        const nextBootstrap = service.bootstrap();

        expect(nextBootstrap.defaultProject.id).toBe(secondaryProject.id);
        expect(nextBootstrap.defaultProject.name).toBe('Secondary Project');

        repository.close();
    });
});
