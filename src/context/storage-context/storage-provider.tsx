import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import type {
    SavedCollection,
    SavedDiagram,
    SavedProject,
    StorageContext,
} from './storage-context';
import { storageContext } from './storage-context';
import Dexie, { type EntityTable } from 'dexie';
import type { Diagram } from '@/lib/domain/diagram';
import type { DBTable } from '@/lib/domain/db-table';
import type { DBRelationship } from '@/lib/domain/db-relationship';
import { determineCardinalities } from '@/lib/domain/db-relationship';
import type { ChartDBConfig } from '@/lib/domain/config';
import type { DBDependency } from '@/lib/domain/db-dependency';
import type { Area } from '@/lib/domain/area';
import type { DBCustomType } from '@/lib/domain/db-custom-type';
import type { DiagramFilter } from '@/lib/domain/diagram-filter/diagram-filter';
import type { Note } from '@/lib/domain/note';
import {
    deserializeCollectionSummary,
    deserializeDiagram,
    deserializeProjectSummary,
    type PersistedCollectionSummary,
    type PersistedDiagramSummary,
    type PersistedProjectSummary,
    persistenceClient,
    serializeDiagram,
    type PersistedDiagramRecord,
} from '@/features/persistence/api/persistence-client';
import { cloneDiagram } from '@/lib/clone';

interface CachedCollectionRecord extends Omit<
    SavedCollection,
    'projectCount' | 'diagramCount'
> {}
interface CachedProjectRecord extends Omit<SavedProject, 'diagramCount'> {}

interface CachedDiagramRecord extends SavedDiagram {}

const LOCAL_ONLY_PROJECT_ID = '__local_browser_storage__';
const LOCAL_ONLY_PROJECT_NAME = 'Local Browser Storage';

const DEFAULT_DIAGRAM_INCLUDE_OPTIONS = {
    includeRelationships: false,
    includeTables: false,
    includeDependencies: false,
    includeAreas: false,
    includeCustomTypes: false,
    includeNotes: false,
};

const FULL_DIAGRAM_INCLUDE_OPTIONS = {
    includeRelationships: true,
    includeTables: true,
    includeDependencies: true,
    includeAreas: true,
    includeCustomTypes: true,
    includeNotes: true,
};

const normalizeIncludeOptions = (
    options?: Partial<typeof DEFAULT_DIAGRAM_INCLUDE_OPTIONS>
) => ({
    ...DEFAULT_DIAGRAM_INCLUDE_OPTIONS,
    ...(options ?? {}),
});

const toCachedCollection = (
    collection: PersistedCollectionSummary
): CachedCollectionRecord => ({
    id: collection.id,
    name: collection.name,
    description: collection.description,
    ownerUserId: collection.ownerUserId,
    createdAt: new Date(collection.createdAt),
    updatedAt: new Date(collection.updatedAt),
});

const toSavedCollection = (
    collection: CachedCollectionRecord,
    counts?: {
        projectCount?: number;
        diagramCount?: number;
    }
): SavedCollection => ({
    ...collection,
    projectCount: counts?.projectCount ?? 0,
    diagramCount: counts?.diagramCount ?? 0,
});

const toCachedProject = (
    project: PersistedProjectSummary
): CachedProjectRecord => ({
    id: project.id,
    name: project.name,
    description: project.description,
    collectionId: project.collectionId,
    ownerUserId: project.ownerUserId,
    visibility: project.visibility,
    status: project.status,
    createdAt: new Date(project.createdAt),
    updatedAt: new Date(project.updatedAt),
});

const toSavedProject = (
    project: CachedProjectRecord,
    diagramCount: number
): SavedProject => ({
    ...project,
    diagramCount,
});

const toCachedDiagram = (
    diagram: PersistedDiagramSummary | PersistedDiagramRecord
): CachedDiagramRecord => ({
    id: diagram.id,
    projectId: diagram.projectId,
    ownerUserId: diagram.ownerUserId,
    name: diagram.name,
    description: diagram.description,
    databaseType: diagram.databaseType,
    databaseEdition: diagram.databaseEdition,
    visibility: diagram.visibility,
    status: diagram.status,
    tableCount:
        'tableCount' in diagram
            ? diagram.tableCount
            : (diagram.diagram.tables?.length ?? 0),
    createdAt: new Date(diagram.createdAt),
    updatedAt: new Date(diagram.updatedAt),
});

const toSavedDiagram = (
    diagram: CachedDiagramRecord,
    tableCount = diagram.tableCount,
    localOnly = false
): SavedDiagram => ({
    ...diagram,
    tableCount,
    localOnly,
});

const normalizeSearchTerm = (value?: string) => {
    const normalized = value?.trim().toLowerCase() ?? '';
    return normalized.length > 0 ? normalized : undefined;
};

const matchesSearch = (
    values: Array<string | null | undefined>,
    searchTerm?: string
) => {
    if (!searchTerm) {
        return true;
    }

    return values.some((value) => value?.toLowerCase().includes(searchTerm));
};

export const StorageProvider: React.FC<React.PropsWithChildren> = ({
    children,
}) => {
    const remoteProjectIdRef = useRef<string>();
    const remoteReadyRef = useRef(false);
    const remoteInitializedRef = useRef(false);
    const remoteInitPromiseRef = useRef<Promise<void> | null>(null);
    const syncTimersRef = useRef<Map<string, number>>(new Map());

    const db = useMemo(() => {
        const dexieDB = new Dexie('ChartDB') as Dexie & {
            diagrams: EntityTable<
                Diagram,
                'id' // primary key "id" (for the typings only)
            >;
            db_tables: EntityTable<
                DBTable & { diagramId: string },
                'id' // primary key "id" (for the typings only)
            >;
            db_relationships: EntityTable<
                DBRelationship & { diagramId: string },
                'id' // primary key "id" (for the typings only)
            >;
            db_dependencies: EntityTable<
                DBDependency & { diagramId: string },
                'id' // primary key "id" (for the typings only)
            >;
            areas: EntityTable<
                Area & { diagramId: string },
                'id' // primary key "id" (for the typings only)
            >;
            db_custom_types: EntityTable<
                DBCustomType & { diagramId: string },
                'id' // primary key "id" (for the typings only)
            >;
            notes: EntityTable<
                Note & { diagramId: string },
                'id' // primary key "id" (for the typings only)
            >;
            config: EntityTable<
                ChartDBConfig & { id: number },
                'id' // primary key "id" (for the typings only)
            >;
            diagram_filters: EntityTable<
                DiagramFilter & { diagramId: string },
                'diagramId' // primary key "id" (for the typings only)
            >;
            saved_collections: EntityTable<
                CachedCollectionRecord,
                'id' // primary key "id" (for the typings only)
            >;
            saved_projects: EntityTable<
                CachedProjectRecord,
                'id' // primary key "id" (for the typings only)
            >;
            saved_diagrams: EntityTable<
                CachedDiagramRecord,
                'id' // primary key "id" (for the typings only)
            >;
        };

        // Schema declaration:
        dexieDB.version(1).stores({
            diagrams: '++id, name, databaseType, createdAt, updatedAt',
            db_tables:
                '++id, diagramId, name, x, y, fields, indexes, color, createdAt, width',
            db_relationships:
                '++id, diagramId, name, sourceTableId, targetTableId, sourceFieldId, targetFieldId, type, createdAt',
            config: '++id, defaultDiagramId',
        });

        dexieDB.version(2).upgrade((tx) =>
            tx
                .table<DBTable & { diagramId: string }>('db_tables')
                .toCollection()
                .modify((table) => {
                    for (const field of table.fields) {
                        field.type = {
                            // @ts-expect-error string before
                            id: (field.type as string).split(' ').join('_'),
                            // @ts-expect-error string before
                            name: field.type,
                        };
                    }
                })
        );

        dexieDB.version(3).stores({
            diagrams:
                '++id, name, databaseType, databaseEdition, createdAt, updatedAt',
            db_tables:
                '++id, diagramId, name, x, y, fields, indexes, color, createdAt, width',
            db_relationships:
                '++id, diagramId, name, sourceTableId, targetTableId, sourceFieldId, targetFieldId, type, createdAt',
            config: '++id, defaultDiagramId',
        });

        dexieDB.version(4).stores({
            diagrams:
                '++id, name, databaseType, databaseEdition, createdAt, updatedAt',
            db_tables:
                '++id, diagramId, name, x, y, fields, indexes, color, createdAt, width, comment',
            db_relationships:
                '++id, diagramId, name, sourceTableId, targetTableId, sourceFieldId, targetFieldId, type, createdAt',
            config: '++id, defaultDiagramId',
        });

        dexieDB.version(5).stores({
            diagrams:
                '++id, name, databaseType, databaseEdition, createdAt, updatedAt',
            db_tables:
                '++id, diagramId, name, schema, x, y, fields, indexes, color, createdAt, width, comment',
            db_relationships:
                '++id, diagramId, name, sourceSchema, sourceTableId, targetSchema, targetTableId, sourceFieldId, targetFieldId, type, createdAt',
            config: '++id, defaultDiagramId',
        });

        dexieDB.version(6).upgrade((tx) =>
            tx
                .table<DBRelationship & { diagramId: string }>(
                    'db_relationships'
                )
                .toCollection()
                .modify((relationship, ref) => {
                    const { sourceCardinality, targetCardinality } =
                        determineCardinalities(
                            // @ts-expect-error string before
                            relationship.type ?? 'one_to_one'
                        );

                    relationship.sourceCardinality = sourceCardinality;
                    relationship.targetCardinality = targetCardinality;

                    // @ts-expect-error string before
                    delete ref.value.type;
                })
        );

        dexieDB.version(7).stores({
            diagrams:
                '++id, name, databaseType, databaseEdition, createdAt, updatedAt',
            db_tables:
                '++id, diagramId, name, schema, x, y, fields, indexes, color, createdAt, width, comment',
            db_relationships:
                '++id, diagramId, name, sourceSchema, sourceTableId, targetSchema, targetTableId, sourceFieldId, targetFieldId, type, createdAt',
            db_dependencies:
                '++id, diagramId, schema, tableId, dependentSchema, dependentTableId, createdAt',
            config: '++id, defaultDiagramId',
        });

        dexieDB.version(8).stores({
            diagrams:
                '++id, name, databaseType, databaseEdition, createdAt, updatedAt',
            db_tables:
                '++id, diagramId, name, schema, x, y, fields, indexes, color, createdAt, width, comment, isView, isMaterializedView, order',
            db_relationships:
                '++id, diagramId, name, sourceSchema, sourceTableId, targetSchema, targetTableId, sourceFieldId, targetFieldId, type, createdAt',
            db_dependencies:
                '++id, diagramId, schema, tableId, dependentSchema, dependentTableId, createdAt',
            config: '++id, defaultDiagramId',
        });

        dexieDB.version(9).upgrade((tx) =>
            tx
                .table<DBTable & { diagramId: string }>('db_tables')
                .toCollection()
                .modify((table) => {
                    for (const field of table.fields) {
                        if (typeof field.nullable === 'string') {
                            field.nullable =
                                (field.nullable as string).toLowerCase() ===
                                'true';
                        }
                    }
                })
        );

        dexieDB.version(10).stores({
            diagrams:
                '++id, name, databaseType, databaseEdition, createdAt, updatedAt',
            db_tables:
                '++id, diagramId, name, schema, x, y, fields, indexes, color, createdAt, width, comment, isView, isMaterializedView, order',
            db_relationships:
                '++id, diagramId, name, sourceSchema, sourceTableId, targetSchema, targetTableId, sourceFieldId, targetFieldId, type, createdAt',
            db_dependencies:
                '++id, diagramId, schema, tableId, dependentSchema, dependentTableId, createdAt',
            areas: '++id, diagramId, name, x, y, width, height, color',
            config: '++id, defaultDiagramId',
        });

        dexieDB.version(11).stores({
            diagrams:
                '++id, name, databaseType, databaseEdition, createdAt, updatedAt',
            db_tables:
                '++id, diagramId, name, schema, x, y, fields, indexes, color, createdAt, width, comment, isView, isMaterializedView, order',
            db_relationships:
                '++id, diagramId, name, sourceSchema, sourceTableId, targetSchema, targetTableId, sourceFieldId, targetFieldId, type, createdAt',
            db_dependencies:
                '++id, diagramId, schema, tableId, dependentSchema, dependentTableId, createdAt',
            areas: '++id, diagramId, name, x, y, width, height, color',
            db_custom_types:
                '++id, diagramId, schema, type, kind, values, fields',
            config: '++id, defaultDiagramId',
        });

        dexieDB
            .version(12)
            .stores({
                diagrams:
                    '++id, name, databaseType, databaseEdition, createdAt, updatedAt',
                db_tables:
                    '++id, diagramId, name, schema, x, y, fields, indexes, color, createdAt, width, comment, isView, isMaterializedView, order',
                db_relationships:
                    '++id, diagramId, name, sourceSchema, sourceTableId, targetSchema, targetTableId, sourceFieldId, targetFieldId, type, createdAt',
                db_dependencies:
                    '++id, diagramId, schema, tableId, dependentSchema, dependentTableId, createdAt',
                areas: '++id, diagramId, name, x, y, width, height, color',
                db_custom_types:
                    '++id, diagramId, schema, type, kind, values, fields',
                config: '++id, defaultDiagramId',
                diagram_filters: 'diagramId, tableIds, schemasIds',
            })
            .upgrade((tx) => {
                tx.table('config').clear();
            });

        dexieDB.version(13).stores({
            diagrams:
                '++id, name, databaseType, databaseEdition, createdAt, updatedAt',
            db_tables:
                '++id, diagramId, name, schema, x, y, fields, indexes, color, createdAt, width, comment, isView, isMaterializedView, order',
            db_relationships:
                '++id, diagramId, name, sourceSchema, sourceTableId, targetSchema, targetTableId, sourceFieldId, targetFieldId, type, createdAt',
            db_dependencies:
                '++id, diagramId, schema, tableId, dependentSchema, dependentTableId, createdAt',
            areas: '++id, diagramId, name, x, y, width, height, color',
            db_custom_types:
                '++id, diagramId, schema, type, kind, values, fields',
            config: '++id, defaultDiagramId',
            diagram_filters: 'diagramId, tableIds, schemasIds',
            notes: '++id, diagramId, content, x, y, width, height, color',
        });

        dexieDB.version(14).stores({
            diagrams:
                '++id, name, databaseType, databaseEdition, createdAt, updatedAt',
            db_tables:
                '++id, diagramId, name, schema, x, y, fields, indexes, color, createdAt, width, comment, isView, isMaterializedView, order',
            db_relationships:
                '++id, diagramId, name, sourceSchema, sourceTableId, targetSchema, targetTableId, sourceFieldId, targetFieldId, type, createdAt',
            db_dependencies:
                '++id, diagramId, schema, tableId, dependentSchema, dependentTableId, createdAt',
            areas: '++id, diagramId, name, x, y, width, height, color',
            db_custom_types:
                '++id, diagramId, schema, type, kind, values, fields',
            config: '++id, defaultDiagramId',
            diagram_filters: 'diagramId, tableIds, schemasIds',
            notes: '++id, diagramId, content, x, y, width, height, color',
            saved_projects: 'id, name, updatedAt, createdAt',
            saved_diagrams: 'id, projectId, name, updatedAt, createdAt',
        });

        dexieDB.version(15).stores({
            diagrams:
                '++id, name, databaseType, databaseEdition, createdAt, updatedAt',
            db_tables:
                '++id, diagramId, name, schema, x, y, fields, indexes, color, createdAt, width, comment, isView, isMaterializedView, order',
            db_relationships:
                '++id, diagramId, name, sourceSchema, sourceTableId, targetSchema, targetTableId, sourceFieldId, targetFieldId, type, createdAt',
            db_dependencies:
                '++id, diagramId, schema, tableId, dependentSchema, dependentTableId, createdAt',
            areas: '++id, diagramId, name, x, y, width, height, color',
            db_custom_types:
                '++id, diagramId, schema, type, kind, values, fields',
            config: '++id, defaultDiagramId',
            diagram_filters: 'diagramId, tableIds, schemasIds',
            notes: '++id, diagramId, content, x, y, width, height, color',
            saved_collections: 'id, name, updatedAt, createdAt',
            saved_projects: 'id, collectionId, name, updatedAt, createdAt',
            saved_diagrams: 'id, projectId, name, updatedAt, createdAt',
        });

        dexieDB.on('ready', async () => {
            const config = await dexieDB.config.get(1);

            if (!config) {
                const diagrams = await dexieDB.diagrams.toArray();

                await dexieDB.config.add({
                    id: 1,
                    defaultDiagramId: diagrams?.[0]?.id ?? '',
                });
            }
        });
        return dexieDB;
    }, []);

    useEffect(
        () => () => {
            for (const timer of syncTimersRef.current.values()) {
                window.clearTimeout(timer);
            }
            syncTimersRef.current.clear();
        },
        []
    );

    const getConfig: StorageContext['getConfig'] =
        useCallback(async (): Promise<ChartDBConfig | undefined> => {
            return await db.config.get(1);
        }, [db]);

    const updateConfig: StorageContext['updateConfig'] = useCallback(
        async (config) => {
            await db.config.update(1, config);
        },
        [db]
    );

    const removeLocalDiagramSnapshot = useCallback(
        async (diagramId: string): Promise<void> => {
            await Promise.all([
                db.diagrams.delete(diagramId),
                db.db_tables.where('diagramId').equals(diagramId).delete(),
                db.db_relationships
                    .where('diagramId')
                    .equals(diagramId)
                    .delete(),
                db.db_dependencies
                    .where('diagramId')
                    .equals(diagramId)
                    .delete(),
                db.areas.where('diagramId').equals(diagramId).delete(),
                db.db_custom_types
                    .where('diagramId')
                    .equals(diagramId)
                    .delete(),
                db.notes.where('diagramId').equals(diagramId).delete(),
                db.diagram_filters
                    .where('diagramId')
                    .equals(diagramId)
                    .delete(),
            ]);
        },
        [db]
    );

    const cacheProject = useCallback(
        async (project: PersistedProjectSummary): Promise<SavedProject> => {
            const cached = toCachedProject(deserializeProjectSummary(project));
            await db.saved_projects.put(cached);
            return toSavedProject(cached, project.diagramCount);
        },
        [db]
    );

    const cacheCollection = useCallback(
        async (
            collection: PersistedCollectionSummary
        ): Promise<SavedCollection> => {
            const normalized = deserializeCollectionSummary(collection);
            const cached = toCachedCollection(normalized);
            await db.saved_collections.put(cached);
            return toSavedCollection(cached, {
                projectCount: normalized.projectCount,
                diagramCount: normalized.diagramCount,
            });
        },
        [db]
    );

    const cacheDiagram = useCallback(
        async (
            diagram: PersistedDiagramSummary | PersistedDiagramRecord
        ): Promise<SavedDiagram> => {
            const cached = toCachedDiagram(diagram);
            await db.saved_diagrams.put(cached);
            return toSavedDiagram(cached);
        },
        [db]
    );

    const deleteProjectCache = useCallback(
        async (projectId: string): Promise<void> => {
            const diagrams = await db.saved_diagrams
                .where('projectId')
                .equals(projectId)
                .toArray();

            await Promise.all(
                diagrams.map(async (diagram) => {
                    await removeLocalDiagramSnapshot(diagram.id);
                    await db.saved_diagrams.delete(diagram.id);
                })
            );
            await db.saved_projects.delete(projectId);
        },
        [db, removeLocalDiagramSnapshot]
    );

    const deleteCollectionCache = useCallback(
        async (collectionId: string): Promise<void> => {
            await db.saved_collections.delete(collectionId);
            await db.saved_projects
                .where('collectionId')
                .equals(collectionId)
                .modify({ collectionId: null });
        },
        [db]
    );

    const readCachedCollections = useCallback(async (): Promise<
        SavedCollection[]
    > => {
        const collections = await db.saved_collections.toArray();
        const projects = await db.saved_projects.toArray();
        const diagrams = await db.saved_diagrams.toArray();
        const projectById = new Map(
            projects.map((project) => [project.id, project])
        );

        const projectCounts = new Map<string, number>();
        const diagramCounts = new Map<string, number>();

        for (const project of projects) {
            if (!project.collectionId) {
                continue;
            }

            projectCounts.set(
                project.collectionId,
                (projectCounts.get(project.collectionId) ?? 0) + 1
            );
        }

        for (const diagram of diagrams) {
            const project = projectById.get(diagram.projectId);
            if (!project?.collectionId) {
                continue;
            }

            diagramCounts.set(
                project.collectionId,
                (diagramCounts.get(project.collectionId) ?? 0) + 1
            );
        }

        return collections
            .map((collection) =>
                toSavedCollection(collection, {
                    projectCount: projectCounts.get(collection.id) ?? 0,
                    diagramCount: diagramCounts.get(collection.id) ?? 0,
                })
            )
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }, [db]);

    const readCachedProjects = useCallback(async (): Promise<
        SavedProject[]
    > => {
        const projects = await db.saved_projects.toArray();
        const diagrams = await db.saved_diagrams.toArray();
        const diagramCounts = diagrams.reduce((acc, diagram) => {
            acc.set(diagram.projectId, (acc.get(diagram.projectId) ?? 0) + 1);
            return acc;
        }, new Map<string, number>());

        return projects
            .map((project) =>
                toSavedProject(project, diagramCounts.get(project.id) ?? 0)
            )
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }, [db]);

    const readCachedProjectDiagrams = useCallback(
        async (projectId: string): Promise<SavedDiagram[]> => {
            const diagrams = await db.saved_diagrams
                .where('projectId')
                .equals(projectId)
                .toArray();

            return diagrams
                .map((diagram) => toSavedDiagram(diagram))
                .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        },
        [db]
    );

    const getDiagramFilter: StorageContext['getDiagramFilter'] = useCallback(
        async (diagramId: string): Promise<DiagramFilter | undefined> => {
            const filter = await db.diagram_filters.get({ diagramId });

            return filter;
        },
        [db]
    );

    const updateDiagramFilter: StorageContext['updateDiagramFilter'] =
        useCallback(
            async (diagramId, filter): Promise<void> => {
                await db.diagram_filters.put({
                    diagramId,
                    ...filter,
                });
            },
            [db]
        );

    const deleteDiagramFilter: StorageContext['deleteDiagramFilter'] =
        useCallback(
            async (diagramId: string): Promise<void> => {
                await db.diagram_filters.where({ diagramId }).delete();
            },
            [db]
        );

    const hydrateDiagram = useCallback(
        async (
            inputDiagram: Diagram,
            options?: Partial<typeof DEFAULT_DIAGRAM_INCLUDE_OPTIONS>
        ): Promise<Diagram> => {
            const resolvedOptions = normalizeIncludeOptions(options);
            const diagram = { ...inputDiagram };

            if (resolvedOptions.includeTables) {
                diagram.tables = await db.db_tables
                    .where('diagramId')
                    .equals(diagram.id)
                    .toArray();
            }

            if (resolvedOptions.includeRelationships) {
                diagram.relationships = (
                    await db.db_relationships
                        .where('diagramId')
                        .equals(diagram.id)
                        .toArray()
                ).sort((a, b) => a.name.localeCompare(b.name));
            }

            if (resolvedOptions.includeDependencies) {
                diagram.dependencies = await db.db_dependencies
                    .where('diagramId')
                    .equals(diagram.id)
                    .toArray();
            }

            if (resolvedOptions.includeAreas) {
                diagram.areas = await db.areas
                    .where('diagramId')
                    .equals(diagram.id)
                    .toArray();
            }

            if (resolvedOptions.includeCustomTypes) {
                diagram.customTypes = (
                    await db.db_custom_types
                        .where('diagramId')
                        .equals(diagram.id)
                        .toArray()
                ).sort((a, b) => a.name.localeCompare(b.name));
            }

            if (resolvedOptions.includeNotes) {
                diagram.notes = await db.notes
                    .where('diagramId')
                    .equals(diagram.id)
                    .toArray();
            }

            return diagram;
        },
        [db]
    );

    const readLocalDiagram = useCallback(
        async (
            id: string,
            options?: Partial<typeof DEFAULT_DIAGRAM_INCLUDE_OPTIONS>
        ): Promise<Diagram | undefined> => {
            const diagram = await db.diagrams.get(id);
            if (!diagram) {
                return undefined;
            }

            return await hydrateDiagram(diagram, options);
        },
        [db, hydrateDiagram]
    );

    const readLocalDiagrams = useCallback(
        async (
            options?: Partial<typeof DEFAULT_DIAGRAM_INCLUDE_OPTIONS>
        ): Promise<Diagram[]> => {
            const diagrams = await db.diagrams.toArray();
            return await Promise.all(
                diagrams.map((diagram) => hydrateDiagram(diagram, options))
            );
        },
        [db, hydrateDiagram]
    );

    const replaceLocalDiagramSnapshot = useCallback(
        async (diagram: Diagram): Promise<void> => {
            await db.transaction(
                'rw',
                [
                    db.diagrams,
                    db.db_tables,
                    db.db_relationships,
                    db.db_dependencies,
                    db.areas,
                    db.db_custom_types,
                    db.notes,
                ],
                async () => {
                    await db.diagrams.put({
                        id: diagram.id,
                        name: diagram.name,
                        databaseType: diagram.databaseType,
                        databaseEdition: diagram.databaseEdition,
                        schemaSync: diagram.schemaSync,
                        createdAt: diagram.createdAt,
                        updatedAt: diagram.updatedAt,
                    });

                    await Promise.all([
                        db.db_tables
                            .where('diagramId')
                            .equals(diagram.id)
                            .delete(),
                        db.db_relationships
                            .where('diagramId')
                            .equals(diagram.id)
                            .delete(),
                        db.db_dependencies
                            .where('diagramId')
                            .equals(diagram.id)
                            .delete(),
                        db.areas.where('diagramId').equals(diagram.id).delete(),
                        db.db_custom_types
                            .where('diagramId')
                            .equals(diagram.id)
                            .delete(),
                        db.notes.where('diagramId').equals(diagram.id).delete(),
                    ]);

                    const tables = (diagram.tables ?? []).map((table) => ({
                        ...table,
                        diagramId: diagram.id,
                    }));
                    const relationships = (diagram.relationships ?? []).map(
                        (relationship) => ({
                            ...relationship,
                            diagramId: diagram.id,
                        })
                    );
                    const dependencies = (diagram.dependencies ?? []).map(
                        (dependency) => ({
                            ...dependency,
                            diagramId: diagram.id,
                        })
                    );
                    const areas = (diagram.areas ?? []).map((area) => ({
                        ...area,
                        diagramId: diagram.id,
                    }));
                    const customTypes = (diagram.customTypes ?? []).map(
                        (customType) => ({
                            ...customType,
                            diagramId: diagram.id,
                        })
                    );
                    const notes = (diagram.notes ?? []).map((note) => ({
                        ...note,
                        diagramId: diagram.id,
                    }));

                    if (tables.length > 0) {
                        await db.db_tables.bulkPut(tables);
                    }
                    if (relationships.length > 0) {
                        await db.db_relationships.bulkPut(relationships);
                    }
                    if (dependencies.length > 0) {
                        await db.db_dependencies.bulkPut(dependencies);
                    }
                    if (areas.length > 0) {
                        await db.areas.bulkPut(areas);
                    }
                    if (customTypes.length > 0) {
                        await db.db_custom_types.bulkPut(customTypes);
                    }
                    if (notes.length > 0) {
                        await db.notes.bulkPut(notes);
                    }
                }
            );
        },
        [db]
    );

    const buildLocalOnlyProject = useCallback(async (): Promise<
        SavedProject[]
    > => {
        const localDiagrams = await readLocalDiagrams({
            includeTables: true,
        });

        if (localDiagrams.length === 0) {
            return [];
        }

        return [
            {
                id: LOCAL_ONLY_PROJECT_ID,
                name: LOCAL_ONLY_PROJECT_NAME,
                description:
                    'Fallback browser-only project when the ChartDB API is unavailable.',
                collectionId: null,
                ownerUserId: null,
                visibility: 'private',
                status: 'active',
                diagramCount: localDiagrams.length,
                createdAt: localDiagrams
                    .map((diagram) => diagram.createdAt)
                    .sort((a, b) => a.getTime() - b.getTime())[0],
                updatedAt: localDiagrams
                    .map((diagram) => diagram.updatedAt)
                    .sort((a, b) => b.getTime() - a.getTime())[0],
                localOnly: true,
            },
        ];
    }, [readLocalDiagrams]);

    const buildLocalOnlyProjectDiagrams = useCallback(async (): Promise<
        SavedDiagram[]
    > => {
        const localDiagrams = await readLocalDiagrams({
            includeTables: true,
        });

        return localDiagrams
            .map(
                (diagram) =>
                    ({
                        id: diagram.id,
                        projectId: LOCAL_ONLY_PROJECT_ID,
                        ownerUserId: null,
                        name: diagram.name,
                        description: null,
                        databaseType: diagram.databaseType,
                        databaseEdition: diagram.databaseEdition ?? null,
                        visibility: 'private',
                        status: 'active',
                        tableCount: diagram.tables?.length ?? 0,
                        createdAt: diagram.createdAt,
                        updatedAt: diagram.updatedAt,
                        localOnly: true,
                    }) satisfies SavedDiagram
            )
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }, [readLocalDiagrams]);

    const syncRemoteCatalog = useCallback(async (): Promise<void> => {
        const [collectionsResponse, projectsResponse] = await Promise.all([
            persistenceClient.listCollections(),
            persistenceClient.listProjects(),
        ]);
        const remoteCollections = collectionsResponse.items;
        const remoteProjects = projectsResponse.items;
        const seenCollectionIds = new Set(
            remoteCollections.map((collection) => collection.id)
        );
        const cachedCollections = await db.saved_collections.toArray();
        const seenProjectIds = new Set(
            remoteProjects.map((project) => project.id)
        );
        const cachedProjects = await db.saved_projects.toArray();

        await Promise.all(
            remoteCollections.map((collection) => cacheCollection(collection))
        );
        await Promise.all(
            remoteProjects.map((project) => cacheProject(project))
        );

        await Promise.all(
            cachedCollections
                .filter((collection) => !seenCollectionIds.has(collection.id))
                .map((collection) => deleteCollectionCache(collection.id))
        );

        await Promise.all(
            cachedProjects
                .filter((project) => !seenProjectIds.has(project.id))
                .map((project) => deleteProjectCache(project.id))
        );

        const cachedDiagrams = await db.saved_diagrams.toArray();
        const seenDiagramIds = new Set<string>();

        for (const project of remoteProjects) {
            const projectDiagramsResponse =
                await persistenceClient.listProjectDiagrams(project.id);
            const projectDiagrams =
                projectDiagramsResponse.items as PersistedDiagramSummary[];

            for (const diagram of projectDiagrams) {
                seenDiagramIds.add(diagram.id);
                await cacheDiagram(diagram);
            }
        }

        await Promise.all(
            cachedDiagrams
                .filter((diagram) => !seenDiagramIds.has(diagram.id))
                .map(async (diagram) => {
                    await removeLocalDiagramSnapshot(diagram.id);
                    await db.saved_diagrams.delete(diagram.id);
                })
        );
    }, [
        cacheDiagram,
        cacheCollection,
        cacheProject,
        db,
        deleteCollectionCache,
        deleteProjectCache,
        removeLocalDiagramSnapshot,
    ]);

    const ensureRemotePersistenceReady =
        useCallback(async (): Promise<void> => {
            if (remoteInitializedRef.current) {
                return;
            }

            if (remoteInitPromiseRef.current) {
                return await remoteInitPromiseRef.current;
            }

            remoteInitPromiseRef.current = (async () => {
                try {
                    const bootstrap = await persistenceClient.bootstrap();
                    remoteProjectIdRef.current = bootstrap.defaultProject.id;
                    await syncRemoteCatalog();

                    const localDiagrams = await readLocalDiagrams(
                        FULL_DIAGRAM_INCLUDE_OPTIONS
                    );
                    const savedDiagramIds = new Set(
                        (await db.saved_diagrams.toArray()).map(
                            (item) => item.id
                        )
                    );

                    for (const localDiagram of localDiagrams) {
                        if (savedDiagramIds.has(localDiagram.id)) {
                            continue;
                        }

                        const savedDiagram =
                            await persistenceClient.upsertDiagram(
                                localDiagram.id,
                                {
                                    projectId: bootstrap.defaultProject.id,
                                    diagram: serializeDiagram(localDiagram),
                                }
                            );
                        await cacheDiagram(savedDiagram.diagram);
                    }

                    remoteReadyRef.current = true;
                } catch (error) {
                    remoteReadyRef.current = false;
                    console.warn(
                        'ChartDB server persistence is unavailable; continuing with local browser storage only.',
                        error
                    );
                } finally {
                    remoteInitializedRef.current = true;
                }
            })();

            return await remoteInitPromiseRef.current;
        }, [cacheDiagram, db, readLocalDiagrams, syncRemoteCatalog]);

    useEffect(() => {
        void ensureRemotePersistenceReady();
    }, [ensureRemotePersistenceReady]);

    const syncDiagramToRemote = useCallback(
        async (diagramId: string): Promise<void> => {
            await ensureRemotePersistenceReady();
            if (!remoteReadyRef.current || !remoteProjectIdRef.current) {
                return;
            }

            const diagram = await readLocalDiagram(
                diagramId,
                FULL_DIAGRAM_INCLUDE_OPTIONS
            );
            if (!diagram) {
                return;
            }

            const savedDiagram = await db.saved_diagrams.get(diagramId);
            const response = await persistenceClient.upsertDiagram(diagramId, {
                projectId:
                    savedDiagram?.projectId ?? remoteProjectIdRef.current,
                description: savedDiagram?.description ?? undefined,
                diagram: serializeDiagram(diagram),
            });
            await cacheDiagram(response.diagram);
        },
        [cacheDiagram, db, ensureRemotePersistenceReady, readLocalDiagram]
    );

    const scheduleDiagramSync = useCallback(
        (diagramId: string): void => {
            const existingTimer = syncTimersRef.current.get(diagramId);
            if (existingTimer !== undefined) {
                window.clearTimeout(existingTimer);
            }

            const timer = window.setTimeout(() => {
                syncTimersRef.current.delete(diagramId);
                void syncDiagramToRemote(diagramId).catch((error) => {
                    console.warn(
                        'Failed to synchronize diagram to ChartDB API.',
                        {
                            diagramId,
                            error,
                        }
                    );
                });
            }, 400);

            syncTimersRef.current.set(diagramId, timer);
        },
        [syncDiagramToRemote]
    );

    const flushDiagramSync = useCallback(
        async (diagramId: string): Promise<void> => {
            const existingTimer = syncTimersRef.current.get(diagramId);
            if (existingTimer !== undefined) {
                window.clearTimeout(existingTimer);
                syncTimersRef.current.delete(diagramId);
            }

            await syncDiagramToRemote(diagramId);
        },
        [syncDiagramToRemote]
    );

    const addTable: StorageContext['addTable'] = useCallback(
        async ({ diagramId, table }) => {
            await db.db_tables.add({
                ...table,
                diagramId,
            });
            scheduleDiagramSync(diagramId);
        },
        [db, scheduleDiagramSync]
    );

    const getTable: StorageContext['getTable'] = useCallback(
        async ({ id, diagramId }): Promise<DBTable | undefined> => {
            return await db.db_tables.get({ id, diagramId });
        },
        [db]
    );

    const deleteDiagramTables: StorageContext['deleteDiagramTables'] =
        useCallback(
            async (diagramId) => {
                await db.db_tables
                    .where('diagramId')
                    .equals(diagramId)
                    .delete();
                scheduleDiagramSync(diagramId);
            },
            [db, scheduleDiagramSync]
        );

    const updateTable: StorageContext['updateTable'] = useCallback(
        async ({ id, attributes }) => {
            await db.db_tables.update(id, attributes);
            const table = await db.db_tables.get(id);
            if (table?.diagramId) {
                scheduleDiagramSync(table.diagramId);
            }
        },
        [db, scheduleDiagramSync]
    );

    const putTable: StorageContext['putTable'] = useCallback(
        async ({ diagramId, table }) => {
            await db.db_tables.put({ ...table, diagramId });
            scheduleDiagramSync(diagramId);
        },
        [db, scheduleDiagramSync]
    );

    const deleteTable: StorageContext['deleteTable'] = useCallback(
        async ({ id, diagramId }) => {
            await db.db_tables.where({ id, diagramId }).delete();
            scheduleDiagramSync(diagramId);
        },
        [db, scheduleDiagramSync]
    );

    const listTables: StorageContext['listTables'] = useCallback(
        async (diagramId): Promise<DBTable[]> => {
            // Fetch all tables associated with the diagram
            const tables = await db.db_tables
                .where('diagramId')
                .equals(diagramId)
                .toArray();

            return tables;
        },
        [db]
    );

    const addRelationship: StorageContext['addRelationship'] = useCallback(
        async ({ diagramId, relationship }) => {
            await db.db_relationships.add({
                ...relationship,
                diagramId,
            });
            scheduleDiagramSync(diagramId);
        },
        [db, scheduleDiagramSync]
    );

    const deleteDiagramRelationships: StorageContext['deleteDiagramRelationships'] =
        useCallback(
            async (diagramId) => {
                await db.db_relationships
                    .where('diagramId')
                    .equals(diagramId)
                    .delete();
                scheduleDiagramSync(diagramId);
            },
            [db, scheduleDiagramSync]
        );

    const getRelationship: StorageContext['getRelationship'] = useCallback(
        async ({ id, diagramId }): Promise<DBRelationship | undefined> => {
            return await db.db_relationships.get({ id, diagramId });
        },
        [db]
    );

    const updateRelationship: StorageContext['updateRelationship'] =
        useCallback(
            async ({ id, attributes }) => {
                await db.db_relationships.update(id, attributes);
                const relationship = await db.db_relationships.get(id);
                if (relationship?.diagramId) {
                    scheduleDiagramSync(relationship.diagramId);
                }
            },
            [db, scheduleDiagramSync]
        );

    const deleteRelationship: StorageContext['deleteRelationship'] =
        useCallback(
            async ({ id, diagramId }) => {
                await db.db_relationships.where({ id, diagramId }).delete();
                scheduleDiagramSync(diagramId);
            },
            [db, scheduleDiagramSync]
        );

    const listRelationships: StorageContext['listRelationships'] = useCallback(
        async (diagramId): Promise<DBRelationship[]> => {
            // Sort relationships alphabetically
            return (
                await db.db_relationships
                    .where('diagramId')
                    .equals(diagramId)
                    .toArray()
            ).sort((a, b) => {
                return a.name.localeCompare(b.name);
            });
        },
        [db]
    );

    const addDependency: StorageContext['addDependency'] = useCallback(
        async ({ diagramId, dependency }) => {
            await db.db_dependencies.add({
                ...dependency,
                diagramId,
            });
            scheduleDiagramSync(diagramId);
        },
        [db, scheduleDiagramSync]
    );

    const getDependency: StorageContext['getDependency'] = useCallback(
        async ({ diagramId, id }) => {
            return await db.db_dependencies.get({ id, diagramId });
        },
        [db]
    );

    const updateDependency: StorageContext['updateDependency'] = useCallback(
        async ({ id, attributes }) => {
            await db.db_dependencies.update(id, attributes);
            const dependency = await db.db_dependencies.get(id);
            if (dependency?.diagramId) {
                scheduleDiagramSync(dependency.diagramId);
            }
        },
        [db, scheduleDiagramSync]
    );

    const deleteDependency: StorageContext['deleteDependency'] = useCallback(
        async ({ diagramId, id }) => {
            await db.db_dependencies.where({ id, diagramId }).delete();
            scheduleDiagramSync(diagramId);
        },
        [db, scheduleDiagramSync]
    );

    const listDependencies: StorageContext['listDependencies'] = useCallback(
        async (diagramId) => {
            return await db.db_dependencies
                .where('diagramId')
                .equals(diagramId)
                .toArray();
        },
        [db]
    );

    const deleteDiagramDependencies: StorageContext['deleteDiagramDependencies'] =
        useCallback(
            async (diagramId) => {
                await db.db_dependencies
                    .where('diagramId')
                    .equals(diagramId)
                    .delete();
                scheduleDiagramSync(diagramId);
            },
            [db, scheduleDiagramSync]
        );

    const addArea: StorageContext['addArea'] = useCallback(
        async ({ area, diagramId }) => {
            await db.areas.add({
                ...area,
                diagramId,
            });
            scheduleDiagramSync(diagramId);
        },
        [db, scheduleDiagramSync]
    );

    const getArea: StorageContext['getArea'] = useCallback(
        async ({ diagramId, id }) => {
            return await db.areas.get({ id, diagramId });
        },
        [db]
    );

    const updateArea: StorageContext['updateArea'] = useCallback(
        async ({ id, attributes }) => {
            await db.areas.update(id, attributes);
            const area = await db.areas.get(id);
            if (area?.diagramId) {
                scheduleDiagramSync(area.diagramId);
            }
        },
        [db, scheduleDiagramSync]
    );

    const deleteArea: StorageContext['deleteArea'] = useCallback(
        async ({ diagramId, id }) => {
            await db.areas.where({ id, diagramId }).delete();
            scheduleDiagramSync(diagramId);
        },
        [db, scheduleDiagramSync]
    );

    const listAreas: StorageContext['listAreas'] = useCallback(
        async (diagramId) => {
            return await db.areas
                .where('diagramId')
                .equals(diagramId)
                .toArray();
        },
        [db]
    );

    const deleteDiagramAreas: StorageContext['deleteDiagramAreas'] =
        useCallback(
            async (diagramId) => {
                await db.areas.where('diagramId').equals(diagramId).delete();
                scheduleDiagramSync(diagramId);
            },
            [db, scheduleDiagramSync]
        );

    // Custom type operations
    const addCustomType: StorageContext['addCustomType'] = useCallback(
        async ({ diagramId, customType }) => {
            await db.db_custom_types.add({
                ...customType,
                diagramId,
            });
            scheduleDiagramSync(diagramId);
        },
        [db, scheduleDiagramSync]
    );

    const getCustomType: StorageContext['getCustomType'] = useCallback(
        async ({ diagramId, id }): Promise<DBCustomType | undefined> => {
            return await db.db_custom_types.get({ id, diagramId });
        },
        [db]
    );

    const updateCustomType: StorageContext['updateCustomType'] = useCallback(
        async ({ id, attributes }) => {
            await db.db_custom_types.update(id, attributes);
            const customType = await db.db_custom_types.get(id);
            if (customType?.diagramId) {
                scheduleDiagramSync(customType.diagramId);
            }
        },
        [db, scheduleDiagramSync]
    );

    const deleteCustomType: StorageContext['deleteCustomType'] = useCallback(
        async ({ diagramId, id }) => {
            await db.db_custom_types.where({ id, diagramId }).delete();
            scheduleDiagramSync(diagramId);
        },
        [db, scheduleDiagramSync]
    );

    const listCustomTypes: StorageContext['listCustomTypes'] = useCallback(
        async (diagramId): Promise<DBCustomType[]> => {
            return (
                await db.db_custom_types
                    .where('diagramId')
                    .equals(diagramId)
                    .toArray()
            ).sort((a, b) => {
                return a.name.localeCompare(b.name);
            });
        },
        [db]
    );

    const deleteDiagramCustomTypes: StorageContext['deleteDiagramCustomTypes'] =
        useCallback(
            async (diagramId) => {
                await db.db_custom_types
                    .where('diagramId')
                    .equals(diagramId)
                    .delete();
                scheduleDiagramSync(diagramId);
            },
            [db, scheduleDiagramSync]
        );

    // Note operations
    const addNote: StorageContext['addNote'] = useCallback(
        async ({ note, diagramId }) => {
            await db.notes.add({
                ...note,
                diagramId,
            });
            scheduleDiagramSync(diagramId);
        },
        [db, scheduleDiagramSync]
    );

    const getNote: StorageContext['getNote'] = useCallback(
        async ({ diagramId, id }) => {
            return await db.notes.get({ id, diagramId });
        },
        [db]
    );

    const updateNote: StorageContext['updateNote'] = useCallback(
        async ({ id, attributes }) => {
            await db.notes.update(id, attributes);
            const note = await db.notes.get(id);
            if (note?.diagramId) {
                scheduleDiagramSync(note.diagramId);
            }
        },
        [db, scheduleDiagramSync]
    );

    const deleteNote: StorageContext['deleteNote'] = useCallback(
        async ({ diagramId, id }) => {
            await db.notes.where({ id, diagramId }).delete();
            scheduleDiagramSync(diagramId);
        },
        [db, scheduleDiagramSync]
    );

    const listNotes: StorageContext['listNotes'] = useCallback(
        async (diagramId) => {
            return await db.notes
                .where('diagramId')
                .equals(diagramId)
                .toArray();
        },
        [db]
    );

    const deleteDiagramNotes: StorageContext['deleteDiagramNotes'] =
        useCallback(
            async (diagramId) => {
                await db.notes.where('diagramId').equals(diagramId).delete();
                scheduleDiagramSync(diagramId);
            },
            [db, scheduleDiagramSync]
        );

    const listProjects: StorageContext['listProjects'] = useCallback(
        async (options) => {
            const searchTerm = normalizeSearchTerm(options?.search);
            await ensureRemotePersistenceReady();
            if (!remoteReadyRef.current) {
                const localProjects = await buildLocalOnlyProject();
                return localProjects.filter((project) =>
                    matchesSearch(
                        [project.name, project.description],
                        searchTerm
                    )
                );
            }

            if (
                options?.search ||
                options?.collectionId ||
                options?.unassigned
            ) {
                const response = await persistenceClient.listProjects(options);
                return await Promise.all(
                    response.items.map((project) => cacheProject(project))
                );
            }

            await syncRemoteCatalog();
            const cachedProjects = await readCachedProjects();
            return cachedProjects.length > 0
                ? cachedProjects
                : await buildLocalOnlyProject();
        },
        [
            buildLocalOnlyProject,
            cacheProject,
            ensureRemotePersistenceReady,
            readCachedProjects,
            syncRemoteCatalog,
        ]
    );

    const listCollections: StorageContext['listCollections'] =
        useCallback(async () => {
            await ensureRemotePersistenceReady();
            if (!remoteReadyRef.current) {
                return [];
            }

            await syncRemoteCatalog();
            return await readCachedCollections();
        }, [
            ensureRemotePersistenceReady,
            readCachedCollections,
            syncRemoteCatalog,
        ]);

    const createCollection: StorageContext['createCollection'] = useCallback(
        async ({ name, description }) => {
            await ensureRemotePersistenceReady();
            if (!remoteReadyRef.current) {
                throw new Error(
                    'ChartDB server persistence is unavailable. Collections can only be created when the API is reachable.'
                );
            }

            const response = await persistenceClient.createCollection({
                name,
                description,
            });

            return await cacheCollection(response.collection);
        },
        [cacheCollection, ensureRemotePersistenceReady]
    );

    const updateCollection: StorageContext['updateCollection'] = useCallback(
        async (collectionId, params) => {
            await ensureRemotePersistenceReady();
            if (!remoteReadyRef.current) {
                throw new Error(
                    'ChartDB server persistence is unavailable. Collection metadata cannot be updated right now.'
                );
            }

            const response = await persistenceClient.updateCollection(
                collectionId,
                params
            );

            return await cacheCollection(response.collection);
        },
        [cacheCollection, ensureRemotePersistenceReady]
    );

    const deleteCollection: StorageContext['deleteCollection'] = useCallback(
        async (collectionId) => {
            await ensureRemotePersistenceReady();
            if (!remoteReadyRef.current) {
                throw new Error(
                    'ChartDB server persistence is unavailable. Collections cannot be deleted right now.'
                );
            }

            await persistenceClient.deleteCollection(collectionId);
            await deleteCollectionCache(collectionId);
        },
        [deleteCollectionCache, ensureRemotePersistenceReady]
    );

    const createProject: StorageContext['createProject'] = useCallback(
        async ({ name, description, collectionId }) => {
            await ensureRemotePersistenceReady();
            if (!remoteReadyRef.current) {
                throw new Error(
                    'ChartDB server persistence is unavailable. Projects can only be created when the API is reachable.'
                );
            }

            const response = await persistenceClient.createProject({
                name,
                description,
                collectionId,
            });

            return await cacheProject(response.project);
        },
        [cacheProject, ensureRemotePersistenceReady]
    );

    const updateProject: StorageContext['updateProject'] = useCallback(
        async (projectId, params) => {
            await ensureRemotePersistenceReady();
            if (!remoteReadyRef.current) {
                throw new Error(
                    'ChartDB server persistence is unavailable. Project metadata cannot be updated right now.'
                );
            }

            const response = await persistenceClient.updateProject(
                projectId,
                params
            );

            return await cacheProject(response.project);
        },
        [cacheProject, ensureRemotePersistenceReady]
    );

    const deleteProject: StorageContext['deleteProject'] = useCallback(
        async (projectId) => {
            await ensureRemotePersistenceReady();
            if (!remoteReadyRef.current) {
                throw new Error(
                    'ChartDB server persistence is unavailable. Projects cannot be deleted right now.'
                );
            }

            await persistenceClient.deleteProject(projectId);
            await deleteProjectCache(projectId);
        },
        [deleteProjectCache, ensureRemotePersistenceReady]
    );

    const listProjectDiagrams: StorageContext['listProjectDiagrams'] =
        useCallback(
            async (projectId, options) => {
                const searchTerm = normalizeSearchTerm(options?.search);
                await ensureRemotePersistenceReady();
                if (!remoteReadyRef.current) {
                    if (projectId !== LOCAL_ONLY_PROJECT_ID) {
                        return [];
                    }

                    const localDiagrams = await buildLocalOnlyProjectDiagrams();
                    return localDiagrams.filter((diagram) =>
                        matchesSearch(
                            [
                                diagram.name,
                                diagram.description,
                                diagram.databaseType,
                                diagram.databaseEdition,
                            ],
                            searchTerm
                        )
                    );
                }

                const response = await persistenceClient.listProjectDiagrams(
                    projectId,
                    options
                );
                const diagrams = response.items as PersistedDiagramSummary[];
                const cachedDiagrams = await Promise.all(
                    diagrams.map((diagram) => cacheDiagram(diagram))
                );
                return options?.search
                    ? cachedDiagrams
                    : await readCachedProjectDiagrams(projectId);
            },
            [
                buildLocalOnlyProjectDiagrams,
                cacheDiagram,
                ensureRemotePersistenceReady,
                readCachedProjectDiagrams,
            ]
        );

    const getSavedDiagram: StorageContext['getSavedDiagram'] = useCallback(
        async (diagramId) => {
            await ensureRemotePersistenceReady();
            const cachedDiagram = await db.saved_diagrams.get(diagramId);
            if (cachedDiagram) {
                return toSavedDiagram(cachedDiagram);
            }

            if (!remoteReadyRef.current) {
                const localDiagram = await readLocalDiagram(diagramId, {
                    includeTables: true,
                });
                if (!localDiagram) {
                    return undefined;
                }

                return {
                    id: localDiagram.id,
                    projectId: LOCAL_ONLY_PROJECT_ID,
                    ownerUserId: null,
                    name: localDiagram.name,
                    description: null,
                    databaseType: localDiagram.databaseType,
                    databaseEdition: localDiagram.databaseEdition ?? null,
                    visibility: 'private',
                    status: 'active',
                    tableCount: localDiagram.tables?.length ?? 0,
                    createdAt: localDiagram.createdAt,
                    updatedAt: localDiagram.updatedAt,
                    localOnly: true,
                };
            }

            try {
                const response = await persistenceClient.getDiagram(diagramId);
                await cacheDiagram(response);
                return toSavedDiagram(toCachedDiagram(response));
            } catch (error) {
                console.warn('Failed to resolve saved diagram metadata.', {
                    diagramId,
                    error,
                });
                return undefined;
            }
        },
        [cacheDiagram, db, ensureRemotePersistenceReady, readLocalDiagram]
    );

    const updateSavedDiagram: StorageContext['updateSavedDiagram'] =
        useCallback(
            async (diagramId, params) => {
                await ensureRemotePersistenceReady();
                const localDiagram = await readLocalDiagram(
                    diagramId,
                    FULL_DIAGRAM_INCLUDE_OPTIONS
                );

                if (!localDiagram) {
                    return undefined;
                }

                const nextName = params.name?.trim() || localDiagram.name;
                const updatedAt = new Date();
                const nextDiagram: Diagram = {
                    ...localDiagram,
                    name: nextName,
                    updatedAt,
                };
                await replaceLocalDiagramSnapshot(nextDiagram);

                if (!remoteReadyRef.current) {
                    return {
                        id: nextDiagram.id,
                        projectId: LOCAL_ONLY_PROJECT_ID,
                        ownerUserId: null,
                        name: nextDiagram.name,
                        description: params.description ?? null,
                        databaseType: nextDiagram.databaseType,
                        databaseEdition: nextDiagram.databaseEdition ?? null,
                        visibility: 'private',
                        status: 'active',
                        tableCount: nextDiagram.tables?.length ?? 0,
                        createdAt: nextDiagram.createdAt,
                        updatedAt: nextDiagram.updatedAt,
                        localOnly: true,
                    };
                }

                const response = await persistenceClient.updateDiagram(
                    diagramId,
                    {
                        name: nextName,
                        description: params.description,
                        projectId: params.projectId,
                    }
                );
                await cacheDiagram(response.diagram);
                return toSavedDiagram(toCachedDiagram(response.diagram));
            },
            [
                cacheDiagram,
                ensureRemotePersistenceReady,
                readLocalDiagram,
                replaceLocalDiagramSnapshot,
            ]
        );

    const saveDiagram: StorageContext['saveDiagram'] = useCallback(
        async ({ diagramId, name, description, projectId }) => {
            const localDiagram = await readLocalDiagram(
                diagramId,
                FULL_DIAGRAM_INCLUDE_OPTIONS
            );
            if (!localDiagram) {
                return undefined;
            }

            const nextDiagram: Diagram = {
                ...localDiagram,
                name: name?.trim() || localDiagram.name,
                updatedAt: new Date(),
            };
            await replaceLocalDiagramSnapshot(nextDiagram);

            const savedDiagram = await getSavedDiagram(diagramId);
            const nextProjectId =
                projectId ??
                savedDiagram?.projectId ??
                remoteProjectIdRef.current;

            if (!nextProjectId) {
                return undefined;
            }

            if (!remoteReadyRef.current) {
                return {
                    id: nextDiagram.id,
                    projectId: LOCAL_ONLY_PROJECT_ID,
                    ownerUserId: null,
                    name: nextDiagram.name,
                    description:
                        description ?? savedDiagram?.description ?? null,
                    databaseType: nextDiagram.databaseType,
                    databaseEdition: nextDiagram.databaseEdition ?? null,
                    visibility: 'private',
                    status: 'active',
                    tableCount: nextDiagram.tables?.length ?? 0,
                    createdAt: nextDiagram.createdAt,
                    updatedAt: nextDiagram.updatedAt,
                    localOnly: true,
                };
            }

            const existingSavedDiagram = await db.saved_diagrams.get(diagramId);
            await db.saved_diagrams.put({
                ...(existingSavedDiagram ?? {}),
                id: diagramId,
                projectId: nextProjectId,
                ownerUserId: savedDiagram?.ownerUserId ?? null,
                name: nextDiagram.name,
                description: description ?? savedDiagram?.description ?? null,
                databaseType: nextDiagram.databaseType,
                databaseEdition: nextDiagram.databaseEdition ?? null,
                visibility: savedDiagram?.visibility ?? 'private',
                status: savedDiagram?.status ?? 'active',
                tableCount: nextDiagram.tables?.length ?? 0,
                createdAt: savedDiagram?.createdAt ?? nextDiagram.createdAt,
                updatedAt: nextDiagram.updatedAt,
            });

            await flushDiagramSync(diagramId);
            return await getSavedDiagram(diagramId);
        },
        [
            db,
            flushDiagramSync,
            getSavedDiagram,
            readLocalDiagram,
            replaceLocalDiagramSnapshot,
        ]
    );

    const saveDiagramAs: StorageContext['saveDiagramAs'] = useCallback(
        async ({
            diagramId,
            name,
            description,
            projectId,
            createProject: nextProjectToCreate,
        }) => {
            const localDiagram = await readLocalDiagram(
                diagramId,
                FULL_DIAGRAM_INCLUDE_OPTIONS
            );
            if (!localDiagram) {
                return undefined;
            }

            let targetProjectId = projectId;
            if (nextProjectToCreate) {
                const createdProject = await createProject(nextProjectToCreate);
                targetProjectId = createdProject.id;
            }

            const duplicatedDiagram = cloneDiagram(localDiagram).diagram;
            const now = new Date();
            const nextDiagram: Diagram = {
                ...duplicatedDiagram,
                name: name.trim(),
                createdAt: now,
                updatedAt: now,
            };

            await replaceLocalDiagramSnapshot(nextDiagram);

            if (targetProjectId) {
                await db.saved_diagrams.put({
                    id: nextDiagram.id,
                    projectId: targetProjectId,
                    ownerUserId: null,
                    name: nextDiagram.name,
                    description: description ?? null,
                    databaseType: nextDiagram.databaseType,
                    databaseEdition: nextDiagram.databaseEdition ?? null,
                    visibility: 'private',
                    status: 'active',
                    tableCount: nextDiagram.tables?.length ?? 0,
                    createdAt: nextDiagram.createdAt,
                    updatedAt: nextDiagram.updatedAt,
                });
            }

            if (targetProjectId && remoteReadyRef.current) {
                await flushDiagramSync(nextDiagram.id);
            }

            return nextDiagram;
        },
        [
            createProject,
            db,
            flushDiagramSync,
            readLocalDiagram,
            replaceLocalDiagramSnapshot,
        ]
    );

    const addDiagram: StorageContext['addDiagram'] = useCallback(
        async ({ diagram }) => {
            await replaceLocalDiagramSnapshot(diagram);
            void syncDiagramToRemote(diagram.id);
        },
        [replaceLocalDiagramSnapshot, syncDiagramToRemote]
    );

    const listDiagrams: StorageContext['listDiagrams'] = useCallback(
        async (
            options = DEFAULT_DIAGRAM_INCLUDE_OPTIONS
        ): Promise<Diagram[]> => {
            await ensureRemotePersistenceReady();
            return await readLocalDiagrams(options);
        },
        [ensureRemotePersistenceReady, readLocalDiagrams]
    );

    const getDiagram: StorageContext['getDiagram'] = useCallback(
        async (
            id,
            options = DEFAULT_DIAGRAM_INCLUDE_OPTIONS
        ): Promise<Diagram | undefined> => {
            await ensureRemotePersistenceReady();

            if (remoteReadyRef.current) {
                try {
                    const remoteDiagram =
                        await persistenceClient.getDiagram(id);
                    await replaceLocalDiagramSnapshot(
                        deserializeDiagram(remoteDiagram.diagram)
                    );
                    await cacheDiagram(remoteDiagram);
                } catch (error) {
                    console.warn(
                        'Failed to refresh diagram from ChartDB API.',
                        {
                            id,
                            error,
                        }
                    );
                }
            }

            return await readLocalDiagram(id, options);
        },
        [
            cacheDiagram,
            ensureRemotePersistenceReady,
            readLocalDiagram,
            replaceLocalDiagramSnapshot,
        ]
    );

    const updateDiagram: StorageContext['updateDiagram'] = useCallback(
        async ({ id, attributes }) => {
            await db.diagrams.update(id, attributes);
            const nextDiagramId = attributes.id ?? id;

            if (attributes.id) {
                await Promise.all([
                    db.db_tables
                        .where('diagramId')
                        .equals(id)
                        .modify({ diagramId: attributes.id }),
                    db.db_relationships
                        .where('diagramId')
                        .equals(id)
                        .modify({ diagramId: attributes.id }),
                    db.db_dependencies
                        .where('diagramId')
                        .equals(id)
                        .modify({ diagramId: attributes.id }),
                    db.areas.where('diagramId').equals(id).modify({
                        diagramId: attributes.id,
                    }),
                    db.db_custom_types
                        .where('diagramId')
                        .equals(id)
                        .modify({ diagramId: attributes.id }),
                    db.notes.where('diagramId').equals(id).modify({
                        diagramId: attributes.id,
                    }),
                ]);

                const savedDiagram = await db.saved_diagrams.get(id);
                if (savedDiagram) {
                    await db.saved_diagrams.delete(id);
                    await db.saved_diagrams.put({
                        ...savedDiagram,
                        id: attributes.id,
                        name: attributes.name ?? savedDiagram.name,
                    });
                }

                await ensureRemotePersistenceReady();
                if (remoteReadyRef.current) {
                    void persistenceClient.deleteDiagram(id).catch((error) => {
                        console.warn(
                            'Failed to remove previous remote diagram id.',
                            {
                                id,
                                error,
                            }
                        );
                    });
                }
            }

            scheduleDiagramSync(nextDiagramId);
        },
        [db, ensureRemotePersistenceReady, scheduleDiagramSync]
    );

    const deleteDiagram: StorageContext['deleteDiagram'] = useCallback(
        async (id) => {
            await Promise.all([
                db.diagrams.delete(id),
                db.db_tables.where('diagramId').equals(id).delete(),
                db.db_relationships.where('diagramId').equals(id).delete(),
                db.db_dependencies.where('diagramId').equals(id).delete(),
                db.areas.where('diagramId').equals(id).delete(),
                db.db_custom_types.where('diagramId').equals(id).delete(),
                db.notes.where('diagramId').equals(id).delete(),
                db.diagram_filters.where('diagramId').equals(id).delete(),
                db.saved_diagrams.delete(id),
            ]);

            await ensureRemotePersistenceReady();
            if (remoteReadyRef.current) {
                try {
                    await persistenceClient.deleteDiagram(id);
                } catch (error) {
                    console.warn('Failed to delete remote diagram.', {
                        id,
                        error,
                    });
                }
            }
        },
        [db, ensureRemotePersistenceReady]
    );

    return (
        <storageContext.Provider
            value={{
                getConfig,
                updateConfig,
                listCollections,
                createCollection,
                updateCollection,
                deleteCollection,
                listProjects,
                createProject,
                updateProject,
                deleteProject,
                listProjectDiagrams,
                getSavedDiagram,
                updateSavedDiagram,
                saveDiagram,
                saveDiagramAs,
                addDiagram,
                listDiagrams,
                getDiagram,
                updateDiagram,
                deleteDiagram,
                addTable,
                getTable,
                updateTable,
                putTable,
                deleteTable,
                listTables,
                addRelationship,
                getRelationship,
                updateRelationship,
                deleteRelationship,
                listRelationships,
                deleteDiagramTables,
                deleteDiagramRelationships,
                addDependency,
                getDependency,
                updateDependency,
                deleteDependency,
                listDependencies,
                deleteDiagramDependencies,
                addArea,
                getArea,
                updateArea,
                deleteArea,
                listAreas,
                deleteDiagramAreas,
                addCustomType,
                getCustomType,
                updateCustomType,
                deleteCustomType,
                listCustomTypes,
                deleteDiagramCustomTypes,
                addNote,
                getNote,
                updateNote,
                deleteNote,
                listNotes,
                deleteDiagramNotes,
                getDiagramFilter,
                updateDiagramFilter,
                deleteDiagramFilter,
            }}
        >
            {children}
        </storageContext.Provider>
    );
};
