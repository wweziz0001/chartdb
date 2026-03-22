/* eslint-disable react-refresh/only-export-components */
import React, {
    createContext,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';
import { useToast } from '@/components/toast/use-toast';
import { useChartDB } from '@/hooks/use-chartdb';
import type { Diagram } from '@/lib/domain/diagram';
import type { CanonicalSchema } from '../../../../shared/schema-sync/canonical';
import type { SchemaDiffResult } from '../../../../shared/schema-sync/diff';
import type { MigrationStatement } from '../../../../shared/schema-sync/postgres-sql';
import type {
    PostgresConnectionInput,
    StoredConnectionMetadata,
} from '../../../../shared/schema-sync/validation';
import { schemaSyncApi, type ApplyResponse } from '../api/schema-sync-api';
import {
    canonicalToDiagram,
    diagramToCanonical,
} from '../mappers/diagram-schema';

export interface SchemaPreviewState {
    diff: SchemaDiffResult;
    sql: string;
    statements: MigrationStatement[];
    auditId?: string;
}

export interface SchemaSyncContextValue {
    connections: StoredConnectionMetadata[];
    selectedConnectionId?: string;
    baselineSchema?: CanonicalSchema;
    preview?: SchemaPreviewState;
    lastApplyResult?: ApplyResponse;
    loading: boolean;
    saveConnection: (
        connection: PostgresConnectionInput
    ) => Promise<StoredConnectionMetadata>;
    deleteConnection: (id: string) => Promise<void>;
    testConnection: (connection: PostgresConnectionInput) => Promise<void>;
    selectConnection: (id: string) => Promise<void>;
    refreshConnections: () => Promise<void>;
    importLiveSchema: (options?: { schemaNames?: string[] }) => Promise<void>;
    previewChanges: () => Promise<SchemaPreviewState | undefined>;
    applyChanges: (options: {
        allowDestructiveChanges: boolean;
        typedConfirmation?: string;
    }) => Promise<ApplyResponse | undefined>;
    clearPreview: () => void;
    refreshFromDatabase: () => Promise<void>;
    getTargetSchema: () => CanonicalSchema;
}

export const schemaSyncContext = createContext<
    SchemaSyncContextValue | undefined
>(undefined);

const syncStateChanged = (
    diagram: Diagram,
    nextState: Diagram['syncState']
): Diagram => ({
    ...diagram,
    syncState: nextState,
});

export const SchemaSyncProvider: React.FC<React.PropsWithChildren> = ({
    children,
}) => {
    const chartdb = useChartDB();
    const { toast } = useToast();
    const [connections, setConnections] = useState<StoredConnectionMetadata[]>(
        []
    );
    const [selectedConnectionId, setSelectedConnectionId] = useState<
        string | undefined
    >();
    const [baselineSchema, setBaselineSchema] = useState<
        CanonicalSchema | undefined
    >(chartdb.currentDiagram.syncState?.baselineSchema);
    const [preview, setPreview] = useState<SchemaPreviewState | undefined>();
    const [lastApplyResult, setLastApplyResult] = useState<
        ApplyResponse | undefined
    >();
    const [loading, setLoading] = useState(false);

    const persistSyncState = useCallback(
        async (nextState: Diagram['syncState']) => {
            await chartdb.updateDiagramData(
                syncStateChanged(chartdb.currentDiagram, nextState),
                { forceUpdateStorage: true }
            );
        },
        [chartdb]
    );

    const refreshConnections = useCallback(async () => {
        const items = await schemaSyncApi.listConnections();
        setConnections(items);
        const persistedConnectionId =
            chartdb.currentDiagram.syncState?.connectionId;
        const activeConnectionId =
            selectedConnectionId ?? persistedConnectionId;
        if (!activeConnectionId) {
            return;
        }

        const connectionStillExists = items.some(
            (connection) => connection.id === activeConnectionId
        );
        if (connectionStillExists) {
            setSelectedConnectionId(activeConnectionId);
            return;
        }

        setSelectedConnectionId(undefined);
        setBaselineSchema(undefined);
        setPreview(undefined);
        setLastApplyResult(undefined);
        await persistSyncState(undefined);
    }, [
        chartdb.currentDiagram.syncState?.connectionId,
        persistSyncState,
        selectedConnectionId,
    ]);

    useEffect(() => {
        void refreshConnections();
    }, [refreshConnections]);

    useEffect(() => {
        setBaselineSchema(chartdb.currentDiagram.syncState?.baselineSchema);
        setSelectedConnectionId(chartdb.currentDiagram.syncState?.connectionId);
    }, [chartdb.currentDiagram.syncState]);

    const saveConnection = useCallback(
        async (connection: PostgresConnectionInput) => {
            setLoading(true);
            try {
                const saved = await schemaSyncApi.saveConnection(connection);
                await refreshConnections();
                setSelectedConnectionId(saved.id);
                toast({
                    title: 'Connection saved',
                    description: `${saved.name} is ready for live imports.`,
                });
                return saved;
            } finally {
                setLoading(false);
            }
        },
        [refreshConnections, toast]
    );

    const deleteConnection = useCallback(
        async (id: string) => {
            setLoading(true);
            try {
                await schemaSyncApi.deleteConnection(id);
                await refreshConnections();
                if (selectedConnectionId === id) {
                    setSelectedConnectionId(undefined);
                    setBaselineSchema(undefined);
                    setPreview(undefined);
                    setLastApplyResult(undefined);
                    await persistSyncState(undefined);
                }
                toast({ title: 'Connection removed' });
            } finally {
                setLoading(false);
            }
        },
        [persistSyncState, refreshConnections, selectedConnectionId, toast]
    );

    const testConnection = useCallback(
        async (connection: PostgresConnectionInput) => {
            setLoading(true);
            try {
                await schemaSyncApi.testConnection(connection);
                toast({
                    title: 'Connection successful',
                    description: 'ChartDB can reach the PostgreSQL database.',
                });
            } finally {
                setLoading(false);
            }
        },
        [toast]
    );

    const selectConnection = useCallback(
        async (id: string) => {
            const connectionChanged = selectedConnectionId !== id;
            setSelectedConnectionId(id);
            if (connectionChanged) {
                setBaselineSchema(undefined);
                setPreview(undefined);
                setLastApplyResult(undefined);
                await persistSyncState({ connectionId: id });
                toast({
                    title: 'Connection switched',
                    description:
                        'Import the live schema again before previewing or applying changes.',
                });
                return;
            }
            await persistSyncState({
                ...chartdb.currentDiagram.syncState,
                connectionId: id,
                baselineSchema,
                previewAuditId:
                    chartdb.currentDiagram.syncState?.previewAuditId,
                lastApplyAuditId:
                    chartdb.currentDiagram.syncState?.lastApplyAuditId,
            });
        },
        [
            baselineSchema,
            chartdb.currentDiagram.syncState,
            persistSyncState,
            selectedConnectionId,
            toast,
        ]
    );

    const getTargetSchema = useCallback(
        () => diagramToCanonical(chartdb.currentDiagram),
        [chartdb.currentDiagram]
    );

    const importLiveSchema = useCallback(
        async ({ schemaNames }: { schemaNames?: string[] } = {}) => {
            if (!selectedConnectionId) {
                throw new Error('Select a saved PostgreSQL connection first.');
            }
            setLoading(true);
            try {
                const { schema, auditId } =
                    await schemaSyncApi.importLiveSchema({
                        connectionId: selectedConnectionId,
                        schemaNames,
                    });
                const importedDiagram = canonicalToDiagram({
                    schema,
                    existingDiagram: chartdb.currentDiagram,
                });
                const updatedDiagram: Diagram = {
                    ...chartdb.currentDiagram,
                    databaseType: importedDiagram.databaseType,
                    tables: importedDiagram.tables,
                    relationships: importedDiagram.relationships,
                    syncState: {
                        connectionId: selectedConnectionId,
                        baselineSchema: schema,
                        importedAt: schema.importedAt,
                        lastImportAuditId: auditId,
                        previewAuditId: undefined,
                        lastApplyAuditId:
                            chartdb.currentDiagram.syncState?.lastApplyAuditId,
                    },
                };
                await chartdb.updateDiagramData(updatedDiagram, {
                    forceUpdateStorage: true,
                });
                setBaselineSchema(schema);
                setPreview(undefined);
                setLastApplyResult(undefined);
                toast({
                    title: 'Schema imported',
                    description: `Imported ${schema.tables.length} database objects into the canvas.`,
                });
            } finally {
                setLoading(false);
            }
        },
        [chartdb, selectedConnectionId, toast]
    );

    const previewChanges = useCallback(async () => {
        if (!baselineSchema) {
            toast({
                title: 'No baseline schema',
                description: 'Import a live schema before generating a diff.',
                variant: 'destructive',
            });
            return undefined;
        }
        setLoading(true);
        try {
            const target = getTargetSchema();
            const payload = await schemaSyncApi.previewDiff({
                baseline: baselineSchema,
                target,
            });
            const nextPreview = {
                diff: payload.diff,
                sql: payload.sql,
                statements: payload.statements,
                auditId: payload.auditId,
            };
            setPreview(nextPreview);
            await persistSyncState({
                ...chartdb.currentDiagram.syncState,
                connectionId: selectedConnectionId,
                baselineSchema,
                previewAuditId: payload.auditId,
                lastApplyAuditId:
                    chartdb.currentDiagram.syncState?.lastApplyAuditId,
            });
            return nextPreview;
        } finally {
            setLoading(false);
        }
    }, [
        baselineSchema,
        chartdb.currentDiagram.syncState,
        getTargetSchema,
        persistSyncState,
        selectedConnectionId,
        toast,
    ]);

    const applyChanges = useCallback(
        async ({
            allowDestructiveChanges,
            typedConfirmation,
        }: {
            allowDestructiveChanges: boolean;
            typedConfirmation?: string;
        }) => {
            if (!baselineSchema || !selectedConnectionId) {
                toast({
                    title: 'Schema apply is not ready',
                    description:
                        'Import a baseline schema and select a saved connection first.',
                    variant: 'destructive',
                });
                return undefined;
            }
            setLoading(true);
            try {
                const result = await schemaSyncApi.applyChanges({
                    connectionId: selectedConnectionId,
                    baseline: baselineSchema,
                    target: getTargetSchema(),
                    allowDestructiveChanges,
                    typedConfirmation,
                });
                setLastApplyResult(result);
                await persistSyncState({
                    ...chartdb.currentDiagram.syncState,
                    connectionId: selectedConnectionId,
                    baselineSchema:
                        result.status === 'applied'
                            ? getTargetSchema()
                            : baselineSchema,
                    previewAuditId: undefined,
                    lastApplyAuditId: result.auditId,
                    importedAt: new Date().toISOString(),
                });
                if (result.status === 'applied') {
                    setBaselineSchema(getTargetSchema());
                }
                setPreview(undefined);
                toast({
                    title:
                        result.status === 'applied'
                            ? 'Changes applied'
                            : 'No schema changes',
                    description:
                        result.status === 'applied'
                            ? `Executed ${result.executedStatements.length} migration step(s).`
                            : 'The target schema already matches the baseline.',
                });
                return result;
            } finally {
                setLoading(false);
            }
        },
        [
            baselineSchema,
            chartdb.currentDiagram.syncState,
            getTargetSchema,
            persistSyncState,
            selectedConnectionId,
            toast,
        ]
    );

    const refreshFromDatabase = useCallback(async () => {
        await importLiveSchema();
    }, [importLiveSchema]);

    const clearPreview = useCallback(() => setPreview(undefined), []);

    const value = useMemo<SchemaSyncContextValue>(
        () => ({
            connections,
            selectedConnectionId,
            baselineSchema,
            preview,
            lastApplyResult,
            loading,
            saveConnection,
            deleteConnection,
            testConnection,
            selectConnection,
            refreshConnections,
            importLiveSchema,
            previewChanges,
            applyChanges,
            clearPreview,
            refreshFromDatabase,
            getTargetSchema,
        }),
        [
            applyChanges,
            baselineSchema,
            clearPreview,
            connections,
            getTargetSchema,
            importLiveSchema,
            lastApplyResult,
            loading,
            preview,
            previewChanges,
            refreshConnections,
            refreshFromDatabase,
            saveConnection,
            selectedConnectionId,
            selectConnection,
            testConnection,
            deleteConnection,
        ]
    );

    return (
        <schemaSyncContext.Provider value={value}>
            {children}
        </schemaSyncContext.Provider>
    );
};
