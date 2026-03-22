/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/* @vitest-environment node */
import { describe, expect, it } from 'vitest';
import { mapPostgresIntrospectionToCanonical } from '../db/postgres-introspection.ts';
import { validateApplyRequest } from '../db/postgres-apply.ts';
import type { CanonicalSchema } from '../../../shared/schema-sync/canonical.ts';

const introspectionPayload = {
    tables: [
        {
            schema_name: 'public',
            table_name: 'users',
            table_kind: 'table',
            table_comment: 'Application users',
            column_name: 'id',
            data_type: 'bigint',
            type_schema: 'pg_catalog',
            type_category: 'N',
            is_nullable: false,
            column_default: null,
            column_comment: null,
            identity_kind: 'a',
            character_maximum_length: null,
            numeric_precision: 64,
            numeric_scale: 0,
            is_array: false,
        },
        {
            schema_name: 'public',
            table_name: 'users',
            table_kind: 'table',
            table_comment: 'Application users',
            column_name: 'email',
            data_type: 'text',
            type_schema: 'pg_catalog',
            type_category: 'S',
            is_nullable: false,
            column_default: null,
            column_comment: null,
            identity_kind: '',
            character_maximum_length: null,
            numeric_precision: null,
            numeric_scale: null,
            is_array: false,
        },
    ],
    primary_keys: [
        {
            schema_name: 'public',
            table_name: 'users',
            constraint_name: 'users_pkey',
            columns: ['id'],
        },
    ],
    foreign_keys: [],
    unique_constraints: [
        {
            schema_name: 'public',
            table_name: 'users',
            constraint_name: 'users_email_key',
            columns: ['email'],
        },
    ],
    indexes: [
        {
            schema_name: 'public',
            table_name: 'users',
            indexname: 'users_email_idx',
            indexdef:
                'CREATE UNIQUE INDEX users_email_idx ON public.users USING btree (email)',
        },
    ],
    check_constraints: [
        {
            schema_name: 'public',
            table_name: 'users',
            constraint_name: 'users_email_check',
            expression: 'CHECK ((email <>  ))',
        },
    ],
};

describe('postgres introspection mapping', () => {
    it('maps PostgreSQL metadata into the canonical schema model', () => {
        const schema = mapPostgresIntrospectionToCanonical({
            databaseName: 'app',
            schemaNames: ['public'],
            payload: introspectionPayload,
        });
        expect(schema.tables).toHaveLength(1);
        expect(schema.tables[0].columns[0].identity?.generation).toBe('ALWAYS');
        expect(schema.tables[0].primaryKey?.columns).toEqual(['id']);
        expect(schema.tables[0].uniqueConstraints[0].name).toBe(
            'users_email_key'
        );
        expect(schema.tables[0].indexes[0].columns).toEqual(['email']);
        expect(schema.tables[0].checkConstraints[0].expression).toContain(
            'email <>'
        );
    });
});

describe('apply validation', () => {
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
                        default: null,
                    },
                ],
                primaryKey: { columns: ['id'], name: 'users_pkey' },
                foreignKeys: [],
                uniqueConstraints: [],
                indexes: [],
                checkConstraints: [],
            },
        ],
    };

    it('blocks destructive apply until explicit approval is provided', () => {
        const target: CanonicalSchema = { ...baseline, tables: [] };
        expect(() =>
            validateApplyRequest({
                baseline,
                target,
                approval: {
                    allowDestructiveChanges: false,
                    typedConfirmation: '',
                },
            })
        ).toThrowError(
            /Destructive schema changes require explicit typed confirmation/
        );
    });

    it('allows non-destructive apply previews without confirmation', () => {
        const target: CanonicalSchema = {
            ...baseline,
            tables: [
                {
                    ...baseline.tables[0],
                    columns: [
                        ...baseline.tables[0].columns,
                        {
                            name: 'email',
                            type: 'text',
                            nullable: true,
                            default: null,
                        },
                    ],
                },
            ],
        };
        const plan = validateApplyRequest({
            baseline,
            target,
            approval: { allowDestructiveChanges: false, typedConfirmation: '' },
        });
        expect(plan.diff.summary.addColumnCount).toBe(1);
    });
});
