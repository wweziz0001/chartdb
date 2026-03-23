import type { AppRepository } from '../repositories/app-repository.js';
import {
    type AppUserRecord,
    type CollectionRecord,
    type DiagramRecord,
    type ProjectRecord,
} from '../repositories/app-repository.js';
import {
    createCollectionSchema,
    createProjectSchema,
    diagramDocumentSchema,
    type DiagramDocument,
    listProjectsQuerySchema,
    listProjectDiagramsQuerySchema,
    updateCollectionSchema,
    updateDiagramSchema,
    upsertDiagramSchema,
    updateProjectSchema,
} from '../schemas/persistence.js';
import {
    chartDbBackupArchiveSchema,
    chartDbBackupEnvelopeSchema,
    exportBackupRequestSchema,
    type ChartDbBackupArchive,
} from '../schemas/project-backup.js';
import {
    matchesDiagramSearch,
    matchesProjectMetadataSearch,
    matchesProjectSearch,
    normalizeSearchTerm,
} from './persistence-search.js';
import { AppError } from '../utils/app-error.js';
import { generateId } from '../utils/id.js';

export interface BootstrapResult {
    user: AppUserRecord;
    defaultProject: ProjectRecord;
}

export interface CollectionSummary extends CollectionRecord {
    projectCount: number;
    diagramCount: number;
}

const DEFAULT_USER_CONFIG_KEY = 'default_user_id';
const DEFAULT_PROJECT_CONFIG_KEY = 'default_project_id';
const DEFAULT_PROJECT_CONFIG_PREFIX = 'default_project_id:';
const CHARTDB_BACKUP_FORMAT = 'chartdb-backup';
const CHARTDB_BACKUP_FORMAT_VERSION = 1;

const findFirstDuplicate = (values: string[]): string | undefined => {
    const seen = new Set<string>();

    for (const value of values) {
        if (seen.has(value)) {
            return value;
        }

        seen.add(value);
    }

    return undefined;
};

export class PersistenceService {
    constructor(
        private readonly repository: AppRepository,
        private readonly defaults: {
            defaultOwnerName: string;
            defaultProjectName: string;
        }
    ) {}

    bootstrap(actor?: AppUserRecord | null): BootstrapResult {
        if (actor) {
            return this.bootstrapForUser(actor);
        }

        return this.bootstrapAnonymous();
    }

    private bootstrapAnonymous(): BootstrapResult {
        const now = new Date().toISOString();
        let userId = this.repository.getConfigValue(DEFAULT_USER_CONFIG_KEY);
        let projectId = this.repository.getConfigValue(
            DEFAULT_PROJECT_CONFIG_KEY
        );

        if (!userId) {
            userId = generateId();
            this.repository.setConfigValue(DEFAULT_USER_CONFIG_KEY, userId);
        }

        let user = this.repository.getUser(userId);
        if (!user) {
            user = {
                id: userId,
                email: null,
                displayName: this.defaults.defaultOwnerName,
                authProvider: 'placeholder',
                status: 'provisioned',
                role: 'admin',
                ownershipScope: 'personal',
                createdAt: now,
                updatedAt: now,
            };
            this.repository.putUser(user);
        }

        if (!projectId) {
            projectId = generateId();
            this.repository.setConfigValue(
                DEFAULT_PROJECT_CONFIG_KEY,
                projectId
            );
        }

        let defaultProject = this.repository.getProject(projectId);
        if (!defaultProject) {
            defaultProject = {
                id: projectId,
                name: this.defaults.defaultProjectName,
                description: 'Default self-hosted ChartDB project',
                collectionId: null,
                ownerUserId: user.id,
                visibility: 'private',
                status: 'active',
                createdAt: now,
                updatedAt: now,
            };
            this.repository.putProject(defaultProject);
        }

        return { user, defaultProject };
    }

    private bootstrapForUser(actor: AppUserRecord): BootstrapResult {
        const now = new Date().toISOString();
        const user = this.repository.getUser(actor.id) ?? actor;

        if (!this.repository.getUser(actor.id)) {
            this.repository.putUser(user);
        }

        const configKey = `${DEFAULT_PROJECT_CONFIG_PREFIX}${user.id}`;
        let projectId = this.repository.getConfigValue(configKey);
        if (!projectId) {
            projectId = generateId();
            this.repository.setConfigValue(configKey, projectId);
        }

        let defaultProject = this.repository.getProject(projectId);
        if (!defaultProject) {
            defaultProject = {
                id: projectId,
                name: this.defaults.defaultProjectName,
                description: 'Default self-hosted ChartDB project',
                collectionId: null,
                ownerUserId: user.id,
                visibility: 'private',
                status: 'active',
                createdAt: now,
                updatedAt: now,
            };
            this.repository.putProject(defaultProject);
        }

        return { user, defaultProject };
    }

    listProjects(options?: {
        search?: string;
        collectionId?: string;
        unassigned?: boolean;
    }): Array<ProjectRecord & { diagramCount: number }> {
        const resolvedOptions = listProjectsQuerySchema.parse(options ?? {});
        const searchTerm = normalizeSearchTerm(resolvedOptions.search);
        const collectionsById = new Map(
            this.repository
                .listCollections()
                .map((collection) => [collection.id, collection] as const)
        );
        const diagramsByProjectId = this.repository
            .listDiagrams()
            .reduce((accumulator, diagram) => {
                const diagrams = accumulator.get(diagram.projectId) ?? [];
                diagrams.push(diagram);
                accumulator.set(diagram.projectId, diagrams);
                return accumulator;
            }, new Map<string, DiagramRecord[]>());

        return this.repository
            .listProjects()
            .filter((project) => {
                if (resolvedOptions.unassigned) {
                    return project.collectionId === null;
                }

                if (resolvedOptions.collectionId) {
                    return (
                        project.collectionId === resolvedOptions.collectionId
                    );
                }

                return true;
            })
            .filter((project) =>
                matchesProjectSearch(project, {
                    searchTerm,
                    collection: project.collectionId
                        ? collectionsById.get(project.collectionId)
                        : undefined,
                    diagrams: diagramsByProjectId.get(project.id) ?? [],
                })
            )
            .map((project) => ({
                ...project,
                diagramCount: diagramsByProjectId.get(project.id)?.length ?? 0,
            }));
    }

    listCollections(): CollectionSummary[] {
        const projects = this.repository.listProjects();
        const collections = this.repository.listCollections();
        const diagramsByProjectId = this.repository
            .listDiagrams()
            .reduce((accumulator, diagram) => {
                accumulator.set(
                    diagram.projectId,
                    (accumulator.get(diagram.projectId) ?? 0) + 1
                );
                return accumulator;
            }, new Map<string, number>());
        const diagramCounts = new Map(
            projects.map((project) => [
                project.id,
                diagramsByProjectId.get(project.id) ?? 0,
            ])
        );

        return collections.map((collection) => {
            const collectionProjects = projects.filter(
                (project) => project.collectionId === collection.id
            );

            return {
                ...collection,
                projectCount: collectionProjects.length,
                diagramCount: collectionProjects.reduce(
                    (count, project) =>
                        count + (diagramCounts.get(project.id) ?? 0),
                    0
                ),
            };
        });
    }

    createCollection(
        input: unknown,
        actor?: AppUserRecord | null
    ): CollectionRecord {
        const payload = createCollectionSchema.parse(input);
        const bootstrap = this.bootstrap(actor);
        const now = new Date().toISOString();
        const collection: CollectionRecord = {
            id: generateId(),
            name: payload.name,
            description: payload.description ?? null,
            ownerUserId: bootstrap.user.id,
            createdAt: now,
            updatedAt: now,
        };

        this.repository.putCollection(collection);
        return collection;
    }

    updateCollection(collectionId: string, input: unknown): CollectionRecord {
        const collection = this.repository.getCollection(collectionId);
        if (!collection) {
            throw new AppError(
                'Collection not found.',
                404,
                'COLLECTION_NOT_FOUND'
            );
        }

        const payload = updateCollectionSchema.parse(input);
        const updatedCollection: CollectionRecord = {
            ...collection,
            name: payload.name ?? collection.name,
            description:
                payload.description !== undefined
                    ? (payload.description ?? null)
                    : collection.description,
            updatedAt: new Date().toISOString(),
        };

        this.repository.putCollection(updatedCollection);
        return updatedCollection;
    }

    deleteCollection(collectionId: string) {
        const collection = this.repository.getCollection(collectionId);
        if (!collection) {
            throw new AppError(
                'Collection not found.',
                404,
                'COLLECTION_NOT_FOUND'
            );
        }

        this.repository.deleteCollection(collectionId);
    }

    createProject(input: unknown, actor?: AppUserRecord | null): ProjectRecord {
        const payload = createProjectSchema.parse(input);
        const bootstrap = this.bootstrap(actor);
        const now = new Date().toISOString();
        const collectionId = this.resolveCollectionId(payload.collectionId);
        const project: ProjectRecord = {
            id: generateId(),
            name: payload.name,
            description: payload.description ?? null,
            collectionId,
            ownerUserId: bootstrap.user.id,
            visibility: payload.visibility ?? 'private',
            status: payload.status ?? 'active',
            createdAt: now,
            updatedAt: now,
        };
        this.repository.putProject(project);
        return project;
    }

    updateProject(projectId: string, input: unknown): ProjectRecord {
        const project = this.repository.getProject(projectId);
        if (!project) {
            throw new AppError('Project not found.', 404, 'PROJECT_NOT_FOUND');
        }

        const payload = updateProjectSchema.parse(input);
        const collectionId =
            payload.collectionId !== undefined
                ? this.resolveCollectionId(payload.collectionId)
                : project.collectionId;
        const updatedProject: ProjectRecord = {
            ...project,
            name: payload.name ?? project.name,
            description:
                payload.description !== undefined
                    ? (payload.description ?? null)
                    : project.description,
            collectionId,
            visibility: payload.visibility ?? project.visibility,
            status: payload.status ?? project.status,
            updatedAt: new Date().toISOString(),
        };
        this.repository.putProject(updatedProject);
        return updatedProject;
    }

    deleteProject(projectId: string) {
        const project = this.repository.getProject(projectId);
        if (!project) {
            throw new AppError('Project not found.', 404, 'PROJECT_NOT_FOUND');
        }
        this.repository.deleteProject(projectId);

        const defaultProjectId = this.repository.getConfigValue(
            DEFAULT_PROJECT_CONFIG_KEY
        );
        if (defaultProjectId === projectId) {
            const fallbackProject = this.repository.listProjects()[0];
            this.repository.setConfigValue(
                DEFAULT_PROJECT_CONFIG_KEY,
                fallbackProject?.id ?? ''
            );
        }
    }

    listProjectDiagrams(projectId: string, query: unknown) {
        const project = this.repository.getProject(projectId);
        if (!project) {
            throw new AppError('Project not found.', 404, 'PROJECT_NOT_FOUND');
        }

        const options = listProjectDiagramsQuerySchema.parse(query ?? {});
        const searchTerm = normalizeSearchTerm(options.search);
        const collection = project.collectionId
            ? this.repository.getCollection(project.collectionId)
            : undefined;
        const projectMetadataMatches = matchesProjectMetadataSearch(
            project,
            collection,
            searchTerm
        );
        const diagrams = this.repository
            .listProjectDiagrams(projectId)
            .filter((diagram) =>
                projectMetadataMatches
                    ? true
                    : matchesDiagramSearch(diagram, searchTerm)
            );

        if (options.view === 'full') {
            return diagrams.map((diagram) => this.toDiagramResponse(diagram));
        }

        return diagrams.map((diagram) => ({
            id: diagram.id,
            projectId: diagram.projectId,
            ownerUserId: diagram.ownerUserId,
            name: diagram.name,
            description: diagram.description,
            databaseType: diagram.databaseType,
            databaseEdition: diagram.databaseEdition,
            visibility: diagram.visibility,
            status: diagram.status,
            tableCount: Array.isArray(diagram.document.tables)
                ? diagram.document.tables.length
                : 0,
            createdAt: diagram.createdAt,
            updatedAt: diagram.updatedAt,
        }));
    }

    getDiagram(diagramId: string) {
        const diagram = this.repository.getDiagram(diagramId);
        if (!diagram) {
            throw new AppError('Diagram not found.', 404, 'DIAGRAM_NOT_FOUND');
        }
        return this.toDiagramResponse(diagram);
    }

    upsertDiagram(
        diagramId: string,
        input: unknown,
        actor?: AppUserRecord | null
    ) {
        const payload = upsertDiagramSchema.parse(input);
        const project = this.repository.getProject(payload.projectId);
        if (!project) {
            throw new AppError('Project not found.', 404, 'PROJECT_NOT_FOUND');
        }

        const document = diagramDocumentSchema.parse({
            ...payload.diagram,
            id: diagramId,
        });
        const existing = this.repository.getDiagram(diagramId);
        const now = new Date().toISOString();

        const record: DiagramRecord = {
            id: diagramId,
            projectId: payload.projectId,
            ownerUserId:
                payload.ownerUserId ??
                existing?.ownerUserId ??
                actor?.id ??
                project.ownerUserId ??
                null,
            name: document.name,
            description:
                payload.description !== undefined
                    ? (payload.description ?? null)
                    : (existing?.description ?? null),
            databaseType: document.databaseType,
            databaseEdition: document.databaseEdition ?? null,
            visibility: payload.visibility ?? existing?.visibility ?? 'private',
            status: payload.status ?? existing?.status ?? 'active',
            document: this.normalizeDocument({
                ...document,
                createdAt: existing?.document.createdAt ?? document.createdAt,
                updatedAt: document.updatedAt,
            }),
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
        };

        this.repository.putDiagram(record);
        return this.toDiagramResponse(record);
    }

    updateDiagram(diagramId: string, input: unknown) {
        const existing = this.repository.getDiagram(diagramId);
        if (!existing) {
            throw new AppError('Diagram not found.', 404, 'DIAGRAM_NOT_FOUND');
        }

        const payload = updateDiagramSchema.parse(input);
        const nextProject = payload.projectId
            ? this.repository.getProject(payload.projectId)
            : this.repository.getProject(existing.projectId);

        if (!nextProject) {
            throw new AppError('Project not found.', 404, 'PROJECT_NOT_FOUND');
        }

        const now = new Date().toISOString();
        const nowDate = new Date(now);
        const name = payload.name ?? existing.name;
        const description =
            payload.description !== undefined
                ? (payload.description ?? null)
                : existing.description;
        const record: DiagramRecord = {
            ...existing,
            projectId: payload.projectId ?? existing.projectId,
            ownerUserId: payload.ownerUserId ?? existing.ownerUserId,
            name,
            description,
            visibility: payload.visibility ?? existing.visibility,
            status: payload.status ?? existing.status,
            document: this.normalizeDocument({
                ...existing.document,
                name,
                updatedAt: nowDate,
            }),
            updatedAt: now,
        };

        this.repository.putDiagram(record);
        return this.toDiagramResponse(record);
    }

    deleteDiagram(diagramId: string) {
        const diagram = this.repository.getDiagram(diagramId);
        if (!diagram) {
            throw new AppError('Diagram not found.', 404, 'DIAGRAM_NOT_FOUND');
        }
        this.repository.deleteDiagram(diagramId);
    }

    exportBackup(input: unknown): ChartDbBackupArchive {
        const request = exportBackupRequestSchema.parse(input);
        const allProjects = this.repository.listProjects();
        const allDiagrams = this.repository.listDiagrams();

        let projects: ProjectRecord[] = [];
        let diagrams: DiagramRecord[] = [];

        switch (request.scope) {
            case 'all-projects': {
                projects = allProjects;
                diagrams = allDiagrams.filter((diagram) =>
                    projects.some((project) => project.id === diagram.projectId)
                );
                break;
            }
            case 'projects': {
                const requestedProjectIds = [...new Set(request.projectIds)];
                projects = requestedProjectIds.map((projectId) => {
                    const project = this.repository.getProject(projectId);
                    if (!project) {
                        throw new AppError(
                            `Project "${projectId}" not found.`,
                            404,
                            'PROJECT_NOT_FOUND'
                        );
                    }

                    return project;
                });
                const requestedProjectIdSet = new Set(
                    projects.map((project) => project.id)
                );
                diagrams = allDiagrams.filter((diagram) =>
                    requestedProjectIdSet.has(diagram.projectId)
                );
                break;
            }
            case 'diagrams': {
                const requestedDiagramIds = [...new Set(request.diagramIds)];
                diagrams = requestedDiagramIds.map((diagramId) => {
                    const diagram = this.repository.getDiagram(diagramId);
                    if (!diagram) {
                        throw new AppError(
                            `Diagram "${diagramId}" not found.`,
                            404,
                            'DIAGRAM_NOT_FOUND'
                        );
                    }

                    return diagram;
                });
                const requestedProjectIds = [
                    ...new Set(diagrams.map((diagram) => diagram.projectId)),
                ];
                projects = requestedProjectIds.map((projectId) => {
                    const project = this.repository.getProject(projectId);
                    if (!project) {
                        throw new AppError(
                            `Project "${projectId}" not found.`,
                            404,
                            'PROJECT_NOT_FOUND'
                        );
                    }

                    return project;
                });
                break;
            }
        }

        const collectionIds = [
            ...new Set(
                projects
                    .map((project) => project.collectionId)
                    .filter((collectionId) => collectionId !== null)
            ),
        ];
        const collections = collectionIds.map((collectionId) => {
            const collection = this.repository.getCollection(collectionId);
            if (!collection) {
                throw new AppError(
                    `Collection "${collectionId}" not found.`,
                    404,
                    'COLLECTION_NOT_FOUND'
                );
            }

            return collection;
        });

        return {
            format: CHARTDB_BACKUP_FORMAT,
            formatVersion: CHARTDB_BACKUP_FORMAT_VERSION,
            exportedAt: new Date().toISOString(),
            scope: request.scope,
            counts: {
                collectionCount: collections.length,
                projectCount: projects.length,
                diagramCount: diagrams.length,
            },
            collections: collections.map((collection) => ({
                id: collection.id,
                name: collection.name,
                description: collection.description,
                ownerUserId: collection.ownerUserId,
                createdAt: collection.createdAt,
                updatedAt: collection.updatedAt,
            })),
            projects: projects.map((project) => ({
                id: project.id,
                name: project.name,
                description: project.description,
                collectionId: project.collectionId,
                ownerUserId: project.ownerUserId,
                visibility: project.visibility,
                status: project.status,
                createdAt: project.createdAt,
                updatedAt: project.updatedAt,
            })),
            diagrams: diagrams.map((diagram) => ({
                id: diagram.id,
                projectId: diagram.projectId,
                ownerUserId: diagram.ownerUserId,
                name: diagram.name,
                description: diagram.description,
                databaseType: diagram.databaseType,
                databaseEdition: diagram.databaseEdition,
                visibility: diagram.visibility,
                status: diagram.status,
                createdAt: diagram.createdAt,
                updatedAt: diagram.updatedAt,
                diagram: {
                    ...diagram.document,
                    createdAt: diagram.document.createdAt.toISOString(),
                    updatedAt: diagram.document.updatedAt.toISOString(),
                },
            })),
        };
    }

    importBackup(input: unknown, actor?: AppUserRecord | null) {
        const envelope = chartDbBackupEnvelopeSchema.parse(input);

        if (envelope.format !== CHARTDB_BACKUP_FORMAT) {
            throw new AppError(
                `Unsupported backup format "${envelope.format}".`,
                400,
                'BACKUP_FORMAT_UNSUPPORTED'
            );
        }

        if (envelope.formatVersion !== CHARTDB_BACKUP_FORMAT_VERSION) {
            throw new AppError(
                `Unsupported backup format version ${envelope.formatVersion}. Supported versions: ${CHARTDB_BACKUP_FORMAT_VERSION}.`,
                400,
                'BACKUP_VERSION_UNSUPPORTED'
            );
        }

        const archive = chartDbBackupArchiveSchema.parse(input);
        this.validateBackupArchive(archive);

        const bootstrap = this.bootstrap(actor);

        return this.repository.transaction(() => {
            const collectionIdMap = new Map<string, string>();
            const projectIdMap = new Map<string, string>();
            const importedDiagramIds: string[] = [];

            for (const collection of archive.collections) {
                const importedCollectionId = generateId();
                collectionIdMap.set(collection.id, importedCollectionId);
                this.repository.putCollection({
                    id: importedCollectionId,
                    name: collection.name,
                    description: collection.description,
                    ownerUserId: bootstrap.user.id,
                    createdAt: collection.createdAt,
                    updatedAt: collection.updatedAt,
                });
            }

            for (const project of archive.projects) {
                const importedProjectId = generateId();
                projectIdMap.set(project.id, importedProjectId);
                this.repository.putProject({
                    id: importedProjectId,
                    name: project.name,
                    description: project.description,
                    collectionId: project.collectionId
                        ? (collectionIdMap.get(project.collectionId) ?? null)
                        : null,
                    ownerUserId: bootstrap.user.id,
                    visibility: project.visibility,
                    status: project.status,
                    createdAt: project.createdAt,
                    updatedAt: project.updatedAt,
                });
            }

            for (const diagram of archive.diagrams) {
                const importedDiagramId = generateId();
                const mappedProjectId = projectIdMap.get(diagram.projectId);

                if (!mappedProjectId) {
                    throw new AppError(
                        `Imported diagram "${diagram.id}" references an unknown project.`,
                        400,
                        'BACKUP_INTEGRITY_ERROR'
                    );
                }

                const document = this.normalizeDocument(
                    diagramDocumentSchema.parse({
                        ...diagram.diagram,
                        id: importedDiagramId,
                        name: diagram.name,
                        databaseType: diagram.databaseType,
                        databaseEdition:
                            diagram.databaseEdition ??
                            diagram.diagram.databaseEdition ??
                            undefined,
                    })
                );

                this.repository.putDiagram({
                    id: importedDiagramId,
                    projectId: mappedProjectId,
                    ownerUserId: bootstrap.user.id,
                    name: diagram.name,
                    description: diagram.description,
                    databaseType: diagram.databaseType,
                    databaseEdition: diagram.databaseEdition,
                    visibility: diagram.visibility,
                    status: diagram.status,
                    document,
                    createdAt: diagram.createdAt,
                    updatedAt: diagram.updatedAt,
                });
                importedDiagramIds.push(importedDiagramId);
            }

            return {
                collectionCount: archive.collections.length,
                projectCount: archive.projects.length,
                diagramCount: archive.diagrams.length,
                firstDiagramId: importedDiagramIds[0] ?? null,
            };
        });
    }

    private normalizeDocument(document: DiagramDocument): DiagramDocument {
        return {
            ...document,
            createdAt: new Date(document.createdAt),
            updatedAt: new Date(document.updatedAt),
        };
    }

    private resolveCollectionId(collectionId?: string | null) {
        if (collectionId === undefined || collectionId === null) {
            return null;
        }

        const collection = this.repository.getCollection(collectionId);
        if (!collection) {
            throw new AppError(
                'Collection not found.',
                404,
                'COLLECTION_NOT_FOUND'
            );
        }

        return collection.id;
    }

    private validateBackupArchive(archive: ChartDbBackupArchive) {
        if (archive.counts.collectionCount !== archive.collections.length) {
            throw new AppError(
                'Backup collection count does not match the payload.',
                400,
                'BACKUP_COUNT_MISMATCH'
            );
        }

        if (archive.counts.projectCount !== archive.projects.length) {
            throw new AppError(
                'Backup project count does not match the payload.',
                400,
                'BACKUP_COUNT_MISMATCH'
            );
        }

        if (archive.counts.diagramCount !== archive.diagrams.length) {
            throw new AppError(
                'Backup diagram count does not match the payload.',
                400,
                'BACKUP_COUNT_MISMATCH'
            );
        }

        const duplicateCollectionId = findFirstDuplicate(
            archive.collections.map((collection) => collection.id)
        );
        if (duplicateCollectionId) {
            throw new AppError(
                `Duplicate collection id "${duplicateCollectionId}" found in backup.`,
                400,
                'BACKUP_DUPLICATE_COLLECTION'
            );
        }

        const duplicateProjectId = findFirstDuplicate(
            archive.projects.map((project) => project.id)
        );
        if (duplicateProjectId) {
            throw new AppError(
                `Duplicate project id "${duplicateProjectId}" found in backup.`,
                400,
                'BACKUP_DUPLICATE_PROJECT'
            );
        }

        const duplicateDiagramId = findFirstDuplicate(
            archive.diagrams.map((diagram) => diagram.id)
        );
        if (duplicateDiagramId) {
            throw new AppError(
                `Duplicate diagram id "${duplicateDiagramId}" found in backup.`,
                400,
                'BACKUP_DUPLICATE_DIAGRAM'
            );
        }

        const collectionIds = new Set(
            archive.collections.map((collection) => collection.id)
        );
        const projectIds = new Set(
            archive.projects.map((project) => project.id)
        );

        for (const project of archive.projects) {
            if (
                project.collectionId &&
                !collectionIds.has(project.collectionId)
            ) {
                throw new AppError(
                    `Project "${project.id}" references missing collection "${project.collectionId}".`,
                    400,
                    'BACKUP_INTEGRITY_ERROR'
                );
            }
        }

        for (const diagram of archive.diagrams) {
            if (!projectIds.has(diagram.projectId)) {
                throw new AppError(
                    `Diagram "${diagram.id}" references missing project "${diagram.projectId}".`,
                    400,
                    'BACKUP_INTEGRITY_ERROR'
                );
            }
        }
    }

    private toDiagramResponse(diagram: DiagramRecord) {
        return {
            id: diagram.id,
            projectId: diagram.projectId,
            ownerUserId: diagram.ownerUserId,
            name: diagram.name,
            description: diagram.description,
            databaseType: diagram.databaseType,
            databaseEdition: diagram.databaseEdition,
            visibility: diagram.visibility,
            status: diagram.status,
            createdAt: diagram.createdAt,
            updatedAt: diagram.updatedAt,
            diagram: {
                ...diagram.document,
                createdAt: diagram.document.createdAt.toISOString(),
                updatedAt: diagram.document.updatedAt.toISOString(),
            },
        };
    }
}
