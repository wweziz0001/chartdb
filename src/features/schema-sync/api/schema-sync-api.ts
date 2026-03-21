import type { CanonicalSchema } from '../../../../shared/schema-sync/canonical';
import type { SchemaDiffResult } from '../../../../shared/schema-sync/diff';
import type { MigrationStatement } from '../../../../shared/schema-sync/postgres-sql';
import type {
    PostgresConnectionInput,
    StoredConnectionMetadata,
} from '../../../../shared/schema-sync/validation';

const API_BASE_URL = import.meta.env.VITE_SCHEMA_SYNC_API_BASE_URL ?? '';

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        headers: {
            'Content-Type': 'application/json',
            ...(init?.headers ?? {}),
        },
        ...init,
    });
    const payload = (await response.json()) as T & { error?: string };
    if (!response.ok) {
        throw new Error(payload.error ?? 'Schema sync request failed.');
    }
    return payload;
};

export interface DiffPreviewResponse {
    diff: SchemaDiffResult;
    sql: string;
    statements: MigrationStatement[];
    auditId: string;
}

export interface ApplyResponse {
    status: 'applied' | 'noop';
    executedStatements: Array<{ id: string; summary: string }>;
    plan: {
        sql: string;
        warnings: string[];
        summary: string[];
        diff: SchemaDiffResult;
    };
    auditId: string;
}

export const schemaSyncApi = {
    listConnections: async () =>
        request<{ connections: StoredConnectionMetadata[] }>(
            '/api/connections'
        ).then((payload) => payload.connections),
    saveConnection: async (connection: PostgresConnectionInput) =>
        request<{ connection: StoredConnectionMetadata }>('/api/connections', {
            method: 'POST',
            body: JSON.stringify(connection),
        }).then((payload) => payload.connection),
    deleteConnection: async (id: string) =>
        request<{ deleted: boolean }>(`/api/connections/${id}`, {
            method: 'DELETE',
        }),
    testConnection: async (connection: PostgresConnectionInput) =>
        request<{ ok: true }>('/api/connections/test', {
            method: 'POST',
            body: JSON.stringify(connection),
        }),
    importLiveSchema: async ({
        connectionId,
        schemaNames,
    }: {
        connectionId: string;
        schemaNames?: string[];
    }) =>
        request<{ schema: CanonicalSchema; auditId: string }>(
            '/api/schema/import-live',
            {
                method: 'POST',
                body: JSON.stringify({ connectionId, schemaNames }),
            }
        ),
    previewDiff: async ({
        baseline,
        target,
    }: {
        baseline: CanonicalSchema;
        target: CanonicalSchema;
    }) =>
        request<DiffPreviewResponse>('/api/schema/diff', {
            method: 'POST',
            body: JSON.stringify({ baseline, target }),
        }),
    applyChanges: async ({
        connectionId,
        baseline,
        target,
        allowDestructiveChanges,
        typedConfirmation,
    }: {
        connectionId: string;
        baseline: CanonicalSchema;
        target: CanonicalSchema;
        allowDestructiveChanges: boolean;
        typedConfirmation?: string;
    }) =>
        request<ApplyResponse>('/api/schema/apply', {
            method: 'POST',
            body: JSON.stringify({
                connectionId,
                baseline,
                target,
                approval: {
                    allowDestructiveChanges,
                    typedConfirmation,
                },
                actor: {
                    id: 'anonymous',
                    name: 'Anonymous User',
                },
            }),
        }),
    getAudit: async (id: string) =>
        request<{ audit: unknown }>(`/api/audit/${id}`),
};
