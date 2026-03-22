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

    it('searches projects by exact term, partial matches, and combined filters', () => {
        const { repository, service } = createService();
        service.bootstrap();
        const collection = service.createCollection({
            name: 'Analytics Workspace',
            description: 'Revenue reporting and finance diagrams',
        });
        const project = service.createProject({
            name: 'Revenue Reporting',
            description: 'Quarterly finance rollups',
            collectionId: collection.id,
        });
        const unassignedProject = service.createProject({
            name: 'Operations Runbook',
            description: 'Incident response flows',
        });

        service.upsertDiagram('diagram-1', {
            projectId: project.id,
            description: 'Revenue data model',
            diagram: {
                id: 'ignored',
                name: 'Customer Revenue Model',
                databaseType: 'postgresql',
                databaseEdition: '16',
                tables: [
                    {
                        id: 'tbl-1',
                        name: 'accounts',
                        schema: 'finance',
                    },
                ],
                createdAt: '2026-03-22T12:00:00.000Z',
                updatedAt: '2026-03-22T12:00:00.000Z',
            },
        });

        expect(
            service
                .listProjects({ search: 'Revenue Reporting' })
                .map((item) => item.id)
        ).toContain(project.id);
        expect(
            service.listProjects({ search: 'analytic' }).map((item) => item.id)
        ).toContain(project.id);
        expect(
            service.listProjects({ search: 'accounts' }).map((item) => item.id)
        ).toContain(project.id);
        expect(
            service.listProjects({
                search: 'finance',
                collectionId: collection.id,
            })
        ).toEqual([
            expect.objectContaining({
                id: project.id,
            }),
        ]);
        expect(
            service
                .listProjects({ search: 'operations', unassigned: true })
                .map((item) => item.id)
        ).toEqual([unassignedProject.id]);
        expect(service.listProjects({ search: 'does-not-exist' })).toHaveLength(
            0
        );

        repository.close();
    });

    it('searches project diagrams by diagram metadata and project context', () => {
        const { repository, service } = createService();
        service.bootstrap();
        const collection = service.createCollection({
            name: 'Finance Workspace',
        });
        const project = service.createProject({
            name: 'Revenue Reporting',
            collectionId: collection.id,
        });

        service.upsertDiagram('diagram-1', {
            projectId: project.id,
            description: 'Primary reporting model',
            diagram: {
                id: 'ignored',
                name: 'Revenue Diagram',
                databaseType: 'postgresql',
                databaseEdition: '16',
                tables: [
                    {
                        id: 'tbl-1',
                        name: 'accounts',
                        schemaName: 'finance',
                    },
                ],
                createdAt: '2026-03-22T12:00:00.000Z',
                updatedAt: '2026-03-22T12:00:00.000Z',
            },
        });
        service.upsertDiagram('diagram-2', {
            projectId: project.id,
            description: 'Reference model',
            diagram: {
                id: 'ignored',
                name: 'Ledger Diagram',
                databaseType: 'mysql',
                tables: [
                    {
                        id: 'tbl-2',
                        name: 'entries',
                        schema: 'finance',
                    },
                ],
                createdAt: '2026-03-22T13:00:00.000Z',
                updatedAt: '2026-03-22T13:00:00.000Z',
            },
        });

        expect(
            service.listProjectDiagrams(project.id, {
                search: 'Revenue Diagram',
            })
        ).toHaveLength(1);
        expect(
            service.listProjectDiagrams(project.id, { search: 'account' })
        ).toHaveLength(1);
        expect(
            service.listProjectDiagrams(project.id, { search: 'finance' })
        ).toHaveLength(2);
        expect(
            service.listProjectDiagrams(project.id, { search: 'workspace' })
        ).toHaveLength(2);
        expect(
            service.listProjectDiagrams(project.id, { search: 'warehouse' })
        ).toHaveLength(0);

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

    it('exports a versioned backup payload for selected projects', () => {
        const { repository, service } = createService();
        service.bootstrap();
        const collection = service.createCollection({
            name: 'Platform',
            description: 'Shared diagrams',
        });
        const project = service.createProject({
            name: 'Service Map',
            collectionId: collection.id,
        });

        service.upsertDiagram('diagram-backup-1', {
            projectId: project.id,
            description: 'Topology diagram',
            diagram: {
                id: 'ignored',
                name: 'Core Services',
                databaseType: 'postgresql',
                tables: [{ id: 'tbl-1', name: 'services' }],
                createdAt: '2026-03-22T12:00:00.000Z',
                updatedAt: '2026-03-22T12:00:00.000Z',
            },
        });

        const archive = service.exportBackup({
            scope: 'projects',
            projectIds: [project.id],
        });

        expect(archive.format).toBe('chartdb-backup');
        expect(archive.formatVersion).toBe(1);
        expect(archive.scope).toBe('projects');
        expect(archive.counts).toEqual({
            collectionCount: 1,
            projectCount: 1,
            diagramCount: 1,
        });
        expect(archive.projects[0]).toMatchObject({
            id: project.id,
            collectionId: collection.id,
            name: 'Service Map',
        });
        expect(archive.diagrams[0]).toMatchObject({
            id: 'diagram-backup-1',
            projectId: project.id,
            name: 'Core Services',
        });

        repository.close();
    });

    it('imports a valid backup and recreates collections, projects, and diagrams with new ids', () => {
        const source = createService();
        source.service.bootstrap();
        const collection = source.service.createCollection({
            name: 'Analytics',
        });
        const project = source.service.createProject({
            name: 'Revenue',
            collectionId: collection.id,
        });
        source.service.upsertDiagram('diagram-import-1', {
            projectId: project.id,
            description: 'Imported from backup',
            diagram: {
                id: 'ignored',
                name: 'Revenue Diagram',
                databaseType: 'postgresql',
                databaseEdition: '16',
                tables: [{ id: 'tbl-1', name: 'accounts' }],
                createdAt: '2026-03-22T12:00:00.000Z',
                updatedAt: '2026-03-22T12:00:00.000Z',
            },
        });
        const archive = source.service.exportBackup({ scope: 'all-projects' });
        source.repository.close();

        const target = createService();
        const result = target.service.importBackup(archive);

        expect(result.collectionCount).toBe(1);
        expect(result.projectCount).toBe(2);
        expect(result.diagramCount).toBe(1);
        expect(result.firstDiagramId).toBeTruthy();

        const importedDiagram = result.firstDiagramId
            ? target.repository.getDiagram(result.firstDiagramId)
            : undefined;
        expect(importedDiagram).toBeTruthy();
        expect(importedDiagram?.id).not.toBe('diagram-import-1');
        expect(importedDiagram?.name).toBe('Revenue Diagram');
        expect(importedDiagram?.databaseEdition).toBe('16');

        const importedProject = importedDiagram
            ? target.repository.getProject(importedDiagram.projectId)
            : undefined;
        expect(importedProject).toBeTruthy();
        expect(importedProject?.name).toBe('Revenue');
        expect(importedProject?.id).not.toBe(project.id);

        const importedCollection =
            importedProject?.collectionId !== null &&
            importedProject?.collectionId !== undefined
                ? target.repository.getCollection(importedProject.collectionId)
                : undefined;
        expect(importedCollection).toBeTruthy();
        expect(importedCollection?.name).toBe('Analytics');

        target.repository.close();
    });

    it('rejects malformed backups with broken project references', () => {
        const { repository, service } = createService();
        const archive = {
            format: 'chartdb-backup',
            formatVersion: 1,
            exportedAt: '2026-03-22T12:00:00.000Z',
            scope: 'projects',
            counts: {
                collectionCount: 0,
                projectCount: 0,
                diagramCount: 1,
            },
            collections: [],
            projects: [],
            diagrams: [
                {
                    id: 'diagram-1',
                    projectId: 'missing-project',
                    ownerUserId: null,
                    name: 'Broken Diagram',
                    description: null,
                    databaseType: 'postgresql',
                    databaseEdition: null,
                    visibility: 'private',
                    status: 'active',
                    createdAt: '2026-03-22T12:00:00.000Z',
                    updatedAt: '2026-03-22T12:00:00.000Z',
                    diagram: {
                        id: 'diagram-1',
                        name: 'Broken Diagram',
                        databaseType: 'postgresql',
                        tables: [],
                        createdAt: '2026-03-22T12:00:00.000Z',
                        updatedAt: '2026-03-22T12:00:00.000Z',
                    },
                },
            ],
        };

        expect(() => service.importBackup(archive)).toThrowError(
            /references missing project/
        );

        repository.close();
    });

    it('rejects unsupported backup format versions explicitly', () => {
        const { repository, service } = createService();

        expect(() =>
            service.importBackup({
                format: 'chartdb-backup',
                formatVersion: 2,
            })
        ).toThrowError(/Unsupported backup format version 2/);

        repository.close();
    });
});
