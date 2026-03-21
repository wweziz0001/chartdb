/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/* @vitest-environment node */
import { describe, expect, it } from 'vitest';
import type { CanonicalSchema } from '../canonical.ts';
import { diffCanonicalSchemas } from '../diff.ts';
import { buildPostgresMigrationPlan } from '../postgres-sql.ts';

const baseline: CanonicalSchema = {
    engine: 'postgresql',
    databaseName: 'app',
    schemas: ['public'],
    tables: [
        {
            schema: 'public',
            name: 'users',
            kind: 'table',
            comments: null,
            columns: [
                {
                    name: 'id',
                    type: 'bigint',
                    nullable: false,
                    default: 'generated always as identity',
                    identity: { generation: 'ALWAYS', sequenceName: null },
                },
                { name: 'email', type: 'text', nullable: false, default: null },
                {
                    name: 'nickname',
                    type: 'text',
                    nullable: true,
                    default: null,
                },
            ],
            primaryKey: { name: 'users_pkey', columns: ['id'] },
            foreignKeys: [],
            uniqueConstraints: [
                { name: 'users_email_key', columns: ['email'] },
            ],
            indexes: [],
            checkConstraints: [],
        },
    ],
};

const target: CanonicalSchema = {
    ...baseline,
    tables: [
        {
            ...baseline.tables[0],
            columns: [
                baseline.tables[0].columns[0],
                {
                    ...baseline.tables[0].columns[1],
                    type: 'varchar',
                    length: 255,
                },
                { ...baseline.tables[0].columns[2], nullable: false },
                {
                    name: 'created_at',
                    type: 'timestamp with time zone',
                    nullable: false,
                    default: 'now()',
                },
            ],
            foreignKeys: [
                {
                    name: 'users_manager_id_fkey',
                    columns: ['id'],
                    referencedSchema: 'public',
                    referencedTable: 'users',
                    referencedColumns: ['id'],
                    onDelete: 'NO ACTION',
                    onUpdate: 'NO ACTION',
                },
            ],
            indexes: [
                {
                    name: 'users_created_at_idx',
                    columns: ['created_at'],
                    unique: false,
                    method: 'btree',
                    predicate: null,
                    expression: null,
                },
            ],
        },
        {
            schema: 'public',
            name: 'projects',
            kind: 'table',
            comments: null,
            columns: [
                { name: 'id', type: 'bigint', nullable: false, default: null },
                {
                    name: 'owner_id',
                    type: 'bigint',
                    nullable: false,
                    default: null,
                },
            ],
            primaryKey: { name: 'projects_pkey', columns: ['id'] },
            foreignKeys: [
                {
                    name: 'projects_owner_id_fkey',
                    columns: ['owner_id'],
                    referencedSchema: 'public',
                    referencedTable: 'users',
                    referencedColumns: ['id'],
                    onDelete: 'CASCADE',
                    onUpdate: 'NO ACTION',
                },
            ],
            uniqueConstraints: [],
            indexes: [],
            checkConstraints: [],
        },
    ],
};

describe('schema diff + SQL generation', () => {
    it('detects additive and destructive changes with safety warnings', () => {
        const diff = diffCanonicalSchemas(baseline, target);
        expect(diff.summary.createTableCount).toBe(1);
        expect(diff.summary.addColumnCount).toBe(1);
        expect(diff.summary.alterColumnCount).toBeGreaterThanOrEqual(2);
        expect(
            diff.warnings.some((warning) => warning.code === 'type_narrowing')
        ).toBe(true);
        expect(
            diff.warnings.some(
                (warning) => warning.code === 'not_null_on_existing_data'
            )
        ).toBe(true);
    });

    it('generates ordered PostgreSQL SQL preview', () => {
        const plan = buildPostgresMigrationPlan(baseline, target);
        expect(plan.sql).toContain('BEGIN;');
        expect(plan.sql).toContain('CREATE TABLE "public"."projects"');
        expect(plan.sql).toContain(
            'ALTER TABLE "public"."users" ADD COLUMN "created_at"'
        );
        expect(plan.sql).toContain(
            'ALTER TABLE "public"."users" ALTER COLUMN "email" TYPE varchar(255)'
        );
        expect(plan.sql).toContain('CREATE INDEX "users_created_at_idx"');
        expect(plan.diff.summary.createTableCount).toBe(1);
    });

    it('flags ambiguous rename-like changes instead of silently renaming', () => {
        const renameTarget: CanonicalSchema = {
            ...baseline,
            tables: [
                {
                    ...baseline.tables[0],
                    columns: [
                        baseline.tables[0].columns[0],
                        {
                            ...baseline.tables[0].columns[1],
                            name: 'email_address',
                        },
                        baseline.tables[0].columns[2],
                    ],
                },
            ],
        };
        const diff = diffCanonicalSchemas(baseline, renameTarget);
        expect(
            diff.renameCandidates.some(
                (candidate) => candidate.scope === 'column'
            )
        ).toBe(true);
        expect(
            diff.warnings.some((warning) => warning.code === 'rename_ambiguity')
        ).toBe(true);
    });
});
