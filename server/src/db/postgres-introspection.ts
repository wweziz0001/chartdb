/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import type {
    CanonicalSchema,
    CanonicalTable,
} from '../../../shared/schema-sync/canonical.ts';
import {
    withPostgresClient,
    type PgConnectionConfig,
} from './postgres-client.ts';

export const POSTGRES_INTROSPECTION_QUERY = `
WITH table_rows AS (
    SELECT
        n.nspname AS schema_name,
        c.relname AS table_name,
        CASE c.relkind
            WHEN 'r' THEN 'table'
            WHEN 'v' THEN 'view'
            WHEN 'm' THEN 'materialized_view'
            ELSE 'table'
        END AS table_kind,
        obj_description(c.oid) AS table_comment,
        a.attnum AS ordinal_position,
        a.attname AS column_name,
        pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
        tn.nspname AS type_schema,
        t.typcategory AS type_category,
        NOT a.attnotnull AS is_nullable,
        pg_get_expr(ad.adbin, ad.adrelid) AS column_default,
        col_description(a.attrelid, a.attnum) AS column_comment,
        a.attidentity AS identity_kind,
        information_schema._pg_char_max_length(information_schema._pg_truetypid(a.*, t.*), information_schema._pg_truetypmod(a.*, t.*)) AS character_maximum_length,
        information_schema._pg_numeric_precision(information_schema._pg_truetypid(a.*, t.*), information_schema._pg_truetypmod(a.*, t.*)) AS numeric_precision,
        information_schema._pg_numeric_scale(information_schema._pg_truetypid(a.*, t.*), information_schema._pg_truetypmod(a.*, t.*)) AS numeric_scale,
        a.attndims > 0 AS is_array
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    JOIN pg_type t ON t.oid = a.atttypid
    JOIN pg_namespace tn ON tn.oid = t.typnamespace
    LEFT JOIN pg_attrdef ad ON ad.adrelid = c.oid AND ad.adnum = a.attnum
    WHERE c.relkind IN ('r', 'v', 'm')
      AND n.nspname = ANY($SCHEMAS)
),
primary_keys AS (
    SELECT
        n.nspname AS schema_name,
        c.relname AS table_name,
        con.conname AS constraint_name,
        array_agg(a.attname ORDER BY ord.ordinality) AS columns
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN unnest(con.conkey) WITH ORDINALITY AS ord(attnum, ordinality) ON TRUE
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ord.attnum
    WHERE con.contype = 'p'
      AND n.nspname = ANY($SCHEMAS)
    GROUP BY 1, 2, 3
),
foreign_keys AS (
    SELECT
        src_ns.nspname AS schema_name,
        src.relname AS table_name,
        con.conname AS constraint_name,
        array_agg(src_attr.attname ORDER BY src_ord.ordinality) AS columns,
        ref_ns.nspname AS referenced_schema,
        ref.relname AS referenced_table,
        array_agg(ref_attr.attname ORDER BY ref_ord.ordinality) AS referenced_columns,
        con.confupdtype AS on_update,
        con.confdeltype AS on_delete
    FROM pg_constraint con
    JOIN pg_class src ON src.oid = con.conrelid
    JOIN pg_namespace src_ns ON src_ns.oid = src.relnamespace
    JOIN pg_class ref ON ref.oid = con.confrelid
    JOIN pg_namespace ref_ns ON ref_ns.oid = ref.relnamespace
    JOIN unnest(con.conkey) WITH ORDINALITY AS src_ord(attnum, ordinality) ON TRUE
    JOIN unnest(con.confkey) WITH ORDINALITY AS ref_ord(attnum, ordinality) ON ref_ord.ordinality = src_ord.ordinality
    JOIN pg_attribute src_attr ON src_attr.attrelid = src.oid AND src_attr.attnum = src_ord.attnum
    JOIN pg_attribute ref_attr ON ref_attr.attrelid = ref.oid AND ref_attr.attnum = ref_ord.attnum
    WHERE con.contype = 'f'
      AND src_ns.nspname = ANY($SCHEMAS)
    GROUP BY 1,2,3,5,6,8,9
),
unique_constraints AS (
    SELECT
        n.nspname AS schema_name,
        c.relname AS table_name,
        con.conname AS constraint_name,
        array_agg(a.attname ORDER BY ord.ordinality) AS columns
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN unnest(con.conkey) WITH ORDINALITY AS ord(attnum, ordinality) ON TRUE
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ord.attnum
    WHERE con.contype = 'u'
      AND n.nspname = ANY($SCHEMAS)
    GROUP BY 1, 2, 3
),
indexes AS (
    SELECT
        schemaname AS schema_name,
        tablename AS table_name,
        indexname,
        indexdef
    FROM pg_indexes
    WHERE schemaname = ANY($SCHEMAS)
),
check_constraints AS (
    SELECT
        n.nspname AS schema_name,
        c.relname AS table_name,
        con.conname AS constraint_name,
        pg_get_constraintdef(con.oid) AS expression
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.contype = 'c'
      AND n.nspname = ANY($SCHEMAS)
)
SELECT json_build_object(
    'tables', (SELECT json_agg(row_to_json(table_rows)) FROM table_rows),
    'primary_keys', (SELECT json_agg(row_to_json(primary_keys)) FROM primary_keys),
    'foreign_keys', (SELECT json_agg(row_to_json(foreign_keys)) FROM foreign_keys),
    'unique_constraints', (SELECT json_agg(row_to_json(unique_constraints)) FROM unique_constraints),
    'indexes', (SELECT json_agg(row_to_json(indexes)) FROM indexes),
    'check_constraints', (SELECT json_agg(row_to_json(check_constraints)) FROM check_constraints)
) AS payload;
`;

const replaceSchemaToken = (sql: string, schemaNames: string[]) => {
    const quoted = schemaNames
        .map((name) => `'${name.replace(/'/g, "''")}'`)
        .join(', ');
    return sql.replace(/\$SCHEMAS/g, `ARRAY[${quoted}]::text[]`);
};

export interface RawIntrospectionPayload {
    tables: Array<Record<string, string | number | boolean | null>>;
    primary_keys: Array<Record<string, string | string[] | null>>;
    foreign_keys: Array<Record<string, string | string[] | null>>;
    unique_constraints: Array<Record<string, string | string[] | null>>;
    indexes: Array<Record<string, string | null>>;
    check_constraints: Array<Record<string, string | null>>;
}

const parseIndexColumns = (indexDef: string) => {
    const match = indexDef.match(/\((.+)\)/);
    if (!match) return [];
    return match[1]
        .split(',')
        .map((value) => value.trim().replace(/^"|"$/g, ''));
};

const constraintActionMap: Record<string, string> = {
    a: 'NO ACTION',
    r: 'RESTRICT',
    c: 'CASCADE',
    n: 'SET NULL',
    d: 'SET DEFAULT',
};

export const mapPostgresIntrospectionToCanonical = ({
    databaseName,
    schemaNames,
    payload,
}: {
    databaseName: string;
    schemaNames: string[];
    payload: RawIntrospectionPayload;
}): CanonicalSchema => {
    const tableMap = new Map<string, CanonicalTable>();
    const payloadTables = payload.tables ?? [];
    for (const row of payloadTables) {
        const key = `${row.schema_name}.${row.table_name}`;
        if (!tableMap.has(key)) {
            tableMap.set(key, {
                schema: String(row.schema_name),
                name: String(row.table_name),
                kind: (row.table_kind as CanonicalTable['kind']) ?? 'table',
                columns: [],
                indexes: [],
                foreignKeys: [],
                uniqueConstraints: [],
                checkConstraints: [],
                comments: row.table_comment ? String(row.table_comment) : null,
            });
        }
        tableMap.get(key)?.columns.push({
            name: String(row.column_name),
            type: String(row.data_type),
            typeSchema: row.type_schema ? String(row.type_schema) : null,
            typeCategory: row.type_category ? String(row.type_category) : null,
            nullable: Boolean(row.is_nullable),
            default: row.column_default ? String(row.column_default) : null,
            identity:
                row.identity_kind && String(row.identity_kind).trim() !== ''
                    ? {
                          generation:
                              String(row.identity_kind) === 'a'
                                  ? 'ALWAYS'
                                  : 'BY DEFAULT',
                          sequenceName: null,
                      }
                    : null,
            isArray: Boolean(row.is_array),
            length: row.character_maximum_length
                ? Number(row.character_maximum_length)
                : null,
            precision: row.numeric_precision
                ? Number(row.numeric_precision)
                : null,
            scale: row.numeric_scale ? Number(row.numeric_scale) : null,
            comments: row.column_comment ? String(row.column_comment) : null,
        });
    }

    for (const pk of payload.primary_keys ?? []) {
        tableMap.get(`${pk.schema_name}.${pk.table_name}`)!.primaryKey = {
            name: pk.constraint_name ? String(pk.constraint_name) : null,
            columns: (pk.columns as string[]) ?? [],
        };
    }

    for (const fk of payload.foreign_keys ?? []) {
        tableMap.get(`${fk.schema_name}.${fk.table_name}`)?.foreignKeys.push({
            name: String(fk.constraint_name),
            columns: (fk.columns as string[]) ?? [],
            referencedSchema: String(fk.referenced_schema),
            referencedTable: String(fk.referenced_table),
            referencedColumns: (fk.referenced_columns as string[]) ?? [],
            onUpdate: fk.on_update
                ? constraintActionMap[String(fk.on_update)]
                : null,
            onDelete: fk.on_delete
                ? constraintActionMap[String(fk.on_delete)]
                : null,
        });
    }

    for (const uniqueConstraint of payload.unique_constraints ?? []) {
        tableMap
            .get(
                `${uniqueConstraint.schema_name}.${uniqueConstraint.table_name}`
            )
            ?.uniqueConstraints.push({
                name: String(uniqueConstraint.constraint_name),
                columns: (uniqueConstraint.columns as string[]) ?? [],
            });
    }

    for (const index of payload.indexes ?? []) {
        tableMap.get(`${index.schema_name}.${index.table_name}`)?.indexes.push({
            name: String(index.indexname),
            columns: parseIndexColumns(String(index.indexdef)),
            unique: /^CREATE UNIQUE INDEX/.test(String(index.indexdef)),
            method: String(index.indexdef).match(/USING (\w+)/)?.[1] ?? null,
            predicate: String(index.indexdef).split(' WHERE ')[1] ?? null,
            expression: null,
        });
    }

    for (const checkConstraint of payload.check_constraints ?? []) {
        tableMap
            .get(`${checkConstraint.schema_name}.${checkConstraint.table_name}`)
            ?.checkConstraints.push({
                name: String(checkConstraint.constraint_name),
                expression: String(checkConstraint.expression).replace(
                    /^CHECK \((.*)\)$/,
                    '$1'
                ),
            });
    }

    return {
        engine: 'postgresql',
        databaseName,
        schemas: schemaNames,
        importedAt: new Date().toISOString(),
        tables: [...tableMap.values()].sort((left, right) =>
            `${left.schema}.${left.name}`.localeCompare(
                `${right.schema}.${right.name}`
            )
        ),
    };
};

export const introspectPostgresSchema = async ({
    config,
    schemaNames,
}: {
    config: PgConnectionConfig;
    schemaNames: string[];
}) => {
    const sql = replaceSchemaToken(POSTGRES_INTROSPECTION_QUERY, schemaNames);
    return await withPostgresClient(config, async (client) => {
        const rows = await client.query(sql);
        const payloadRaw = rows[0]?.payload;
        if (!payloadRaw) {
            return {
                engine: 'postgresql' as const,
                databaseName: config.database,
                schemas: schemaNames,
                tables: [],
                importedAt: new Date().toISOString(),
            };
        }
        return mapPostgresIntrospectionToCanonical({
            databaseName: config.database,
            schemaNames,
            payload: JSON.parse(payloadRaw),
        });
    });
};
