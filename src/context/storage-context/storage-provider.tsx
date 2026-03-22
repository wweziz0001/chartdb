import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import type { StorageContext } from './storage-context';
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
import { appPersistenceClient } from '@/features/app-persistence/api/app-persistence-client';

const defaultDiagramOptions = {
    includeRelationships: false,
    includeTables: false,
    includeDependencies: false,
    includeAreas: false,
    includeCustomTypes: false,
    includeNotes: false,
};

const fullDiagramOptions = {
    includeRelationships: true,
    includeTables: true,
    includeDependencies: true,
    includeAreas: true,
    includeCustomTypes: true,
    includeNotes: true,
};

export const StorageProvider: React.FC<React.PropsWithChildren> = ({
    children,
}) => {
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
    const remoteSyncTimeoutsRef = useRef<
        Map<string, ReturnType<typeof setTimeout>>
    >(new Map());

    useEffect(() => {
        const remoteSyncTimeouts = remoteSyncTimeoutsRef.current;
        return () => {
            remoteSyncTimeouts.forEach((timeoutId) => {
                clearTimeout(timeoutId);
            });
            remoteSyncTimeouts.clear();
        };
    }, []);

    const buildLocalDiagram = useCallback(
        async (
            id: string,
            options: Parameters<
                StorageContext['getDiagram']
            >[1] = defaultDiagramOptions
        ): Promise<Diagram | undefined> => {
            const mergedOptions = { ...defaultDiagramOptions, ...options };
            const diagram = await db.diagrams.get(id);

            if (!diagram) {
                return undefined;
            }

            const hydratedDiagram: Diagram = { ...diagram };

            if (mergedOptions.includeTables) {
                hydratedDiagram.tables = (await db.db_tables
                    .where('diagramId')
                    .equals(id)
                    .toArray()) as Diagram['tables'];
            }

            if (mergedOptions.includeRelationships) {
                hydratedDiagram.relationships = (await db.db_relationships
                    .where('diagramId')
                    .equals(id)
                    .toArray()) as Diagram['relationships'];
            }

            if (mergedOptions.includeDependencies) {
                hydratedDiagram.dependencies = (await db.db_dependencies
                    .where('diagramId')
                    .equals(id)
                    .toArray()) as Diagram['dependencies'];
            }

            if (mergedOptions.includeAreas) {
                hydratedDiagram.areas = (await db.areas
                    .where('diagramId')
                    .equals(id)
                    .toArray()) as Diagram['areas'];
            }

            if (mergedOptions.includeCustomTypes) {
                hydratedDiagram.customTypes = (await db.db_custom_types
                    .where('diagramId')
                    .equals(id)
                    .toArray()) as Diagram['customTypes'];
            }

            if (mergedOptions.includeNotes) {
                hydratedDiagram.notes = (await db.notes
                    .where('diagramId')
                    .equals(id)
                    .toArray()) as Diagram['notes'];
            }

            return hydratedDiagram;
        },
        [db]
    );

    const listLocalDiagrams = useCallback(
        async (
            options: Parameters<
                StorageContext['listDiagrams']
            >[0] = defaultDiagramOptions
        ): Promise<Diagram[]> => {
            const diagrams = await db.diagrams.toArray();

            return (
                await Promise.all(
                    diagrams.map((diagram) =>
                        buildLocalDiagram(diagram.id, options)
                    )
                )
            ).filter((diagram): diagram is Diagram => !!diagram);
        },
        [db, buildLocalDiagram]
    );

    const replaceLocalDiagram = useCallback(
        async (diagram: Diagram) => {
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

                    if (diagram.tables !== undefined) {
                        await db.db_tables
                            .where('diagramId')
                            .equals(diagram.id)
                            .delete();
                    }
                    if (diagram.relationships !== undefined) {
                        await db.db_relationships
                            .where('diagramId')
                            .equals(diagram.id)
                            .delete();
                    }
                    if (diagram.dependencies !== undefined) {
                        await db.db_dependencies
                            .where('diagramId')
                            .equals(diagram.id)
                            .delete();
                    }
                    if (diagram.areas !== undefined) {
                        await db.areas
                            .where('diagramId')
                            .equals(diagram.id)
                            .delete();
                    }
                    if (diagram.customTypes !== undefined) {
                        await db.db_custom_types
                            .where('diagramId')
                            .equals(diagram.id)
                            .delete();
                    }
                    if (diagram.notes !== undefined) {
                        await db.notes
                            .where('diagramId')
                            .equals(diagram.id)
                            .delete();
                    }

                    if (diagram.tables && diagram.tables.length > 0) {
                        await db.db_tables.bulkPut(
                            diagram.tables.map((table) => ({
                                ...table,
                                diagramId: diagram.id,
                            }))
                        );
                    }

                    if (
                        diagram.relationships &&
                        diagram.relationships.length > 0
                    ) {
                        await db.db_relationships.bulkPut(
                            diagram.relationships.map((relationship) => ({
                                ...relationship,
                                diagramId: diagram.id,
                            }))
                        );
                    }

                    if (
                        diagram.dependencies &&
                        diagram.dependencies.length > 0
                    ) {
                        await db.db_dependencies.bulkPut(
                            diagram.dependencies.map((dependency) => ({
                                ...dependency,
                                diagramId: diagram.id,
                            }))
                        );
                    }

                    if (diagram.areas && diagram.areas.length > 0) {
                        await db.areas.bulkPut(
                            diagram.areas.map((area) => ({
                                ...area,
                                diagramId: diagram.id,
                            }))
                        );
                    }

                    if (diagram.customTypes && diagram.customTypes.length > 0) {
                        await db.db_custom_types.bulkPut(
                            diagram.customTypes.map((customType) => ({
                                ...customType,
                                diagramId: diagram.id,
                            }))
                        );
                    }

                    if (diagram.notes && diagram.notes.length > 0) {
                        await db.notes.bulkPut(
                            diagram.notes.map((note) => ({
                                ...note,
                                diagramId: diagram.id,
                            }))
                        );
                    }
                }
            );
        },
        [db]
    );

    const syncRemoteDiagramNow = useCallback(
        async (diagramId: string) => {
            if (!(await appPersistenceClient.isAvailable())) {
                return;
            }

            const diagram = await buildLocalDiagram(
                diagramId,
                fullDiagramOptions
            );
            if (!diagram) {
                return;
            }

            try {
                const response =
                    await appPersistenceClient.upsertDiagram(diagram);
                await replaceLocalDiagram(response.diagram);
            } catch (error) {
                console.warn(
                    'Unable to sync diagram to backend persistence.',
                    error
                );
            }
        },
        [buildLocalDiagram, replaceLocalDiagram]
    );

    const scheduleRemoteDiagramSync = useCallback(
        (diagramId: string) => {
            if (!appPersistenceClient.isEnabled) {
                return;
            }

            const existingTimeout =
                remoteSyncTimeoutsRef.current.get(diagramId);
            if (existingTimeout) {
                clearTimeout(existingTimeout);
            }

            const timeoutId = setTimeout(() => {
                remoteSyncTimeoutsRef.current.delete(diagramId);
                void syncRemoteDiagramNow(diagramId);
            }, 400);

            remoteSyncTimeoutsRef.current.set(diagramId, timeoutId);
        },
        [syncRemoteDiagramNow]
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

    const addTable: StorageContext['addTable'] = useCallback(
        async ({ diagramId, table }) => {
            await db.db_tables.add({
                ...table,
                diagramId,
            });
            scheduleRemoteDiagramSync(diagramId);
        },
        [db, scheduleRemoteDiagramSync]
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
                scheduleRemoteDiagramSync(diagramId);
            },
            [db, scheduleRemoteDiagramSync]
        );

    const updateTable: StorageContext['updateTable'] = useCallback(
        async ({ id, attributes }) => {
            const existing = await db.db_tables.get(id);
            await db.db_tables.update(id, attributes);
            if (existing) {
                scheduleRemoteDiagramSync(existing.diagramId);
            }
        },
        [db, scheduleRemoteDiagramSync]
    );

    const putTable: StorageContext['putTable'] = useCallback(
        async ({ diagramId, table }) => {
            await db.db_tables.put({ ...table, diagramId });
            scheduleRemoteDiagramSync(diagramId);
        },
        [db, scheduleRemoteDiagramSync]
    );

    const deleteTable: StorageContext['deleteTable'] = useCallback(
        async ({ id, diagramId }) => {
            await db.db_tables.where({ id, diagramId }).delete();
            scheduleRemoteDiagramSync(diagramId);
        },
        [db, scheduleRemoteDiagramSync]
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
            scheduleRemoteDiagramSync(diagramId);
        },
        [db, scheduleRemoteDiagramSync]
    );

    const deleteDiagramRelationships: StorageContext['deleteDiagramRelationships'] =
        useCallback(
            async (diagramId) => {
                await db.db_relationships
                    .where('diagramId')
                    .equals(diagramId)
                    .delete();
                scheduleRemoteDiagramSync(diagramId);
            },
            [db, scheduleRemoteDiagramSync]
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
                const existing = await db.db_relationships.get(id);
                await db.db_relationships.update(id, attributes);
                if (existing) {
                    scheduleRemoteDiagramSync(existing.diagramId);
                }
            },
            [db, scheduleRemoteDiagramSync]
        );

    const deleteRelationship: StorageContext['deleteRelationship'] =
        useCallback(
            async ({ id, diagramId }) => {
                await db.db_relationships.where({ id, diagramId }).delete();
                scheduleRemoteDiagramSync(diagramId);
            },
            [db, scheduleRemoteDiagramSync]
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
            scheduleRemoteDiagramSync(diagramId);
        },
        [db, scheduleRemoteDiagramSync]
    );

    const getDependency: StorageContext['getDependency'] = useCallback(
        async ({ diagramId, id }) => {
            return await db.db_dependencies.get({ id, diagramId });
        },
        [db]
    );

    const updateDependency: StorageContext['updateDependency'] = useCallback(
        async ({ id, attributes }) => {
            const existing = await db.db_dependencies.get(id);
            await db.db_dependencies.update(id, attributes);
            if (existing) {
                scheduleRemoteDiagramSync(existing.diagramId);
            }
        },
        [db, scheduleRemoteDiagramSync]
    );

    const deleteDependency: StorageContext['deleteDependency'] = useCallback(
        async ({ diagramId, id }) => {
            await db.db_dependencies.where({ id, diagramId }).delete();
            scheduleRemoteDiagramSync(diagramId);
        },
        [db, scheduleRemoteDiagramSync]
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
                scheduleRemoteDiagramSync(diagramId);
            },
            [db, scheduleRemoteDiagramSync]
        );

    const addArea: StorageContext['addArea'] = useCallback(
        async ({ area, diagramId }) => {
            await db.areas.add({
                ...area,
                diagramId,
            });
            scheduleRemoteDiagramSync(diagramId);
        },
        [db, scheduleRemoteDiagramSync]
    );

    const getArea: StorageContext['getArea'] = useCallback(
        async ({ diagramId, id }) => {
            return await db.areas.get({ id, diagramId });
        },
        [db]
    );

    const updateArea: StorageContext['updateArea'] = useCallback(
        async ({ id, attributes }) => {
            const existing = await db.areas.get(id);
            await db.areas.update(id, attributes);
            if (existing) {
                scheduleRemoteDiagramSync(existing.diagramId);
            }
        },
        [db, scheduleRemoteDiagramSync]
    );

    const deleteArea: StorageContext['deleteArea'] = useCallback(
        async ({ diagramId, id }) => {
            await db.areas.where({ id, diagramId }).delete();
            scheduleRemoteDiagramSync(diagramId);
        },
        [db, scheduleRemoteDiagramSync]
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
                scheduleRemoteDiagramSync(diagramId);
            },
            [db, scheduleRemoteDiagramSync]
        );

    // Custom type operations
    const addCustomType: StorageContext['addCustomType'] = useCallback(
        async ({ diagramId, customType }) => {
            await db.db_custom_types.add({
                ...customType,
                diagramId,
            });
            scheduleRemoteDiagramSync(diagramId);
        },
        [db, scheduleRemoteDiagramSync]
    );

    const getCustomType: StorageContext['getCustomType'] = useCallback(
        async ({ diagramId, id }): Promise<DBCustomType | undefined> => {
            return await db.db_custom_types.get({ id, diagramId });
        },
        [db]
    );

    const updateCustomType: StorageContext['updateCustomType'] = useCallback(
        async ({ id, attributes }) => {
            const existing = await db.db_custom_types.get(id);
            await db.db_custom_types.update(id, attributes);
            if (existing) {
                scheduleRemoteDiagramSync(existing.diagramId);
            }
        },
        [db, scheduleRemoteDiagramSync]
    );

    const deleteCustomType: StorageContext['deleteCustomType'] = useCallback(
        async ({ diagramId, id }) => {
            await db.db_custom_types.where({ id, diagramId }).delete();
            scheduleRemoteDiagramSync(diagramId);
        },
        [db, scheduleRemoteDiagramSync]
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
                scheduleRemoteDiagramSync(diagramId);
            },
            [db, scheduleRemoteDiagramSync]
        );

    // Note operations
    const addNote: StorageContext['addNote'] = useCallback(
        async ({ note, diagramId }) => {
            await db.notes.add({
                ...note,
                diagramId,
            });
            scheduleRemoteDiagramSync(diagramId);
        },
        [db, scheduleRemoteDiagramSync]
    );

    const getNote: StorageContext['getNote'] = useCallback(
        async ({ diagramId, id }) => {
            return await db.notes.get({ id, diagramId });
        },
        [db]
    );

    const updateNote: StorageContext['updateNote'] = useCallback(
        async ({ id, attributes }) => {
            const existing = await db.notes.get(id);
            await db.notes.update(id, attributes);
            if (existing) {
                scheduleRemoteDiagramSync(existing.diagramId);
            }
        },
        [db, scheduleRemoteDiagramSync]
    );

    const deleteNote: StorageContext['deleteNote'] = useCallback(
        async ({ diagramId, id }) => {
            await db.notes.where({ id, diagramId }).delete();
            scheduleRemoteDiagramSync(diagramId);
        },
        [db, scheduleRemoteDiagramSync]
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
                scheduleRemoteDiagramSync(diagramId);
            },
            [db, scheduleRemoteDiagramSync]
        );

    const addDiagram: StorageContext['addDiagram'] = useCallback(
        async ({ diagram }) => {
            await replaceLocalDiagram(diagram);
            await syncRemoteDiagramNow(diagram.id);
        },
        [replaceLocalDiagram, syncRemoteDiagramNow]
    );

    const listDiagrams: StorageContext['listDiagrams'] = useCallback(
        async (options = defaultDiagramOptions): Promise<Diagram[]> => {
            const localDiagrams = await listLocalDiagrams(options);

            if (!(await appPersistenceClient.isAvailable())) {
                return localDiagrams;
            }

            try {
                const response =
                    await appPersistenceClient.listDiagrams(options);

                if (response.items.length === 0 && localDiagrams.length > 0) {
                    localDiagrams.forEach((diagram) => {
                        scheduleRemoteDiagramSync(diagram.id);
                    });
                    return localDiagrams;
                }

                await Promise.all(
                    response.items.map((diagram) =>
                        replaceLocalDiagram(diagram)
                    )
                );

                return response.items;
            } catch (error) {
                console.warn(
                    'Unable to load diagrams from backend persistence. Falling back to local storage.',
                    error
                );
                return localDiagrams;
            }
        },
        [listLocalDiagrams, replaceLocalDiagram, scheduleRemoteDiagramSync]
    );

    const getDiagram: StorageContext['getDiagram'] = useCallback(
        async (
            id,
            options = defaultDiagramOptions
        ): Promise<Diagram | undefined> => {
            const localDiagram = await buildLocalDiagram(id, options);

            if (!(await appPersistenceClient.isAvailable())) {
                return localDiagram;
            }

            try {
                const response = await appPersistenceClient.getDiagram(
                    id,
                    options
                );
                await replaceLocalDiagram(response.diagram);
                return response.diagram;
            } catch (error) {
                if (localDiagram) {
                    scheduleRemoteDiagramSync(id);
                    return localDiagram;
                }

                if (appPersistenceClient.isNotFoundError(error)) {
                    return undefined;
                }

                console.warn(
                    'Unable to load diagram from backend persistence. Falling back to local storage.',
                    error
                );
                return localDiagram;
            }
        },
        [buildLocalDiagram, replaceLocalDiagram, scheduleRemoteDiagramSync]
    );

    const updateDiagram: StorageContext['updateDiagram'] = useCallback(
        async ({ id, attributes }) => {
            await db.diagrams.update(id, attributes);

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
            }

            scheduleRemoteDiagramSync(attributes.id ?? id);
        },
        [db, scheduleRemoteDiagramSync]
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
            ]);

            if (appPersistenceClient.isEnabled) {
                try {
                    if (await appPersistenceClient.isAvailable()) {
                        await appPersistenceClient.deleteDiagram(id);
                    }
                } catch (error) {
                    console.warn(
                        'Unable to delete diagram from backend persistence.',
                        error
                    );
                }
            }
        },
        [db]
    );

    return (
        <storageContext.Provider
            value={{
                getConfig,
                updateConfig,
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
