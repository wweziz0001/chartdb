import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
    AuditRecord,
    CanonicalSchema,
    ChangePlan,
} from '@chartdb/schema-sync-core';
import { hashCanonicalSchema } from '@chartdb/schema-sync-core';
import { MetadataRepository } from '../repositories/metadata-repository.js';

const introspectPostgresSchemaMock = vi.fn();
const connectMock = vi.fn();
const queryMock = vi.fn();
const endMock = vi.fn();

vi.mock('../postgres/introspection.js', () => ({
    introspectPostgresSchema: introspectPostgresSchemaMock,
}));

vi.mock('pg', () => ({
    Client: vi.fn().mockImplementation(() => ({
        connect: connectMock,
        query: queryMock,
        end: endMock,
    })),
}));

const { ApplyService } = await import('../services/apply-service.js');

const tempDirs: string[] = [];

const createCanonicalSchema = (): CanonicalSchema => ({
    engine: 'postgresql',
    databaseName: 'warehouse',
    defaultSchemaName: 'public',
    schemaNames: ['public'],
    tables: [],
    customTypes: [],
    importedAt: '2026-03-25T00:00:00.000Z',
});

afterEach(() => {
    vi.clearAllMocks();
    while (tempDirs.length > 0) {
        const dir = tempDirs.pop();
        if (dir) {
            rmSync(dir, { recursive: true, force: true });
        }
    }
});

describe('apply service audit hardening', () => {
    it('reuses the preview audit record when the plan is applied', async () => {
        const dataDir = mkdtempSync(path.join(os.tmpdir(), 'chartdb-apply-'));
        tempDirs.push(dataDir);

        const repository = new MetadataRepository(
            path.join(dataDir, 'schema-sync.sqlite')
        );
        const baselineSchema = createCanonicalSchema();
        const baselineFingerprint = hashCanonicalSchema(baselineSchema);

        repository.putSnapshot({
            id: 'baseline-snapshot',
            connectionId: 'connection-1',
            kind: 'baseline',
            fingerprint: baselineFingerprint,
            importedSchemas: ['public'],
            schema: baselineSchema,
            createdAt: '2026-03-25T00:00:00.000Z',
        });

        const plan: ChangePlan = {
            id: 'plan-1',
            baselineSnapshotId: 'baseline-snapshot',
            connectionId: 'connection-1',
            engine: 'postgresql',
            baselineFingerprint,
            targetFingerprint: baselineFingerprint,
            changes: [],
            warnings: [],
            sqlStatements: [],
            summary: {
                totalChanges: 0,
                safeChanges: 0,
                warningChanges: 0,
                destructiveChanges: 0,
                blockedChanges: 0,
            },
            requiresConfirmation: false,
            blocked: false,
            createdAt: '2026-03-25T00:00:00.000Z',
        };

        const previewAudit: AuditRecord = {
            id: 'audit-preview-1',
            actor: 'admin:owner@example.com',
            connectionId: 'connection-1',
            baselineSnapshotId: 'baseline-snapshot',
            targetSnapshotId: 'target-snapshot-1',
            preApplySnapshotId: null,
            postApplySnapshotId: null,
            changePlanId: plan.id,
            sqlStatements: [],
            warnings: [],
            status: 'pending',
            logs: ['Preview generated'],
            error: null,
            createdAt: '2026-03-25T00:01:00.000Z',
            updatedAt: '2026-03-25T00:01:00.000Z',
        };
        repository.putAudit(previewAudit);

        introspectPostgresSchemaMock.mockResolvedValue(baselineSchema);
        connectMock.mockResolvedValue(undefined);
        queryMock.mockResolvedValue({ rows: [] });
        endMock.mockResolvedValue(undefined);

        const service = new ApplyService(
            repository,
            {
                getDecryptedSecret: vi.fn().mockReturnValue({
                    host: 'localhost',
                    port: 5432,
                    database: 'warehouse',
                    username: 'postgres',
                    password: 'postgres',
                    sslMode: 'disable',
                }),
            } as never,
            {
                getChangePlan: vi.fn().mockReturnValue(plan),
            } as never
        );

        const result = await service.applyPlan({
            planId: plan.id,
            actor: 'admin:owner@example.com',
            destructiveApproval: {
                confirmed: true,
                confirmationText: '',
            },
        });

        const audit = repository.getLatestAuditForChangePlan(plan.id);
        expect(result.auditId).toBe(previewAudit.id);
        expect(audit).toEqual(
            expect.objectContaining({
                id: previewAudit.id,
                targetSnapshotId: 'target-snapshot-1',
                status: 'succeeded',
            })
        );
        expect(audit?.logs).toEqual(
            expect.arrayContaining(['Preview generated', 'Apply requested'])
        );

        repository.close();
    });
});
