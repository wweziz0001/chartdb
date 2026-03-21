/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import {
    diffCanonicalSchemas,
    type SchemaChange,
    type SchemaDiffResult,
} from './diff';
import {
    type CanonicalColumn,
    type CanonicalSchema,
    type CanonicalTable,
    qualifiedTableName,
} from './canonical';

export interface MigrationStatement {
    id: string;
    statement: string;
    summary: string;
    transactional: boolean;
    destructive: boolean;
}

export interface MigrationPlan {
    sql: string;
    statements: MigrationStatement[];
    warnings: string[];
    summary: string[];
    diff: SchemaDiffResult;
}

const quoteIdentifier = (value: string) => `"${value.replace(/"/g, '""')}"`;
const qName = (schema: string, name: string) =>
    `${quoteIdentifier(schema)}.${quoteIdentifier(name)}`;
const qCol = (name: string) => quoteIdentifier(name);

const renderType = (column: CanonicalColumn) => {
    if (
        column.precision &&
        column.scale !== undefined &&
        column.scale !== null
    ) {
        return `${column.type}(${column.precision}, ${column.scale})`;
    }
    if (column.precision) {
        return `${column.type}(${column.precision})`;
    }
    if (column.length) {
        return `${column.type}(${column.length})`;
    }
    return column.type;
};

const renderDefault = (column: CanonicalColumn) =>
    column.default ? ` DEFAULT ${column.default}` : '';

const renderNullability = (column: CanonicalColumn) =>
    column.nullable ? '' : ' NOT NULL';

const renderColumnDefinition = (column: CanonicalColumn) =>
    `${qCol(column.name)} ${renderType(column)}${renderDefault(column)}${renderNullability(column)}`;

const createTableSql = (table: CanonicalTable) => {
    const columnLines = table.columns.map(renderColumnDefinition);
    if (table.primaryKey) {
        columnLines.push(
            `PRIMARY KEY (${table.primaryKey.columns.map(qCol).join(', ')})`
        );
    }
    for (const uniqueConstraint of table.uniqueConstraints) {
        columnLines.push(
            `CONSTRAINT ${quoteIdentifier(uniqueConstraint.name)} UNIQUE (${uniqueConstraint.columns
                .map(qCol)
                .join(', ')})`
        );
    }
    for (const check of table.checkConstraints) {
        columnLines.push(
            `CONSTRAINT ${quoteIdentifier(check.name)} CHECK (${check.expression})`
        );
    }
    return `CREATE TABLE ${qName(table.schema, table.name)} (\n  ${columnLines.join(',\n  ')}\n);`;
};

const indexSql = (
    table: CanonicalTable,
    index: CanonicalTable['indexes'][number]
) => {
    const unique = index.unique ? 'UNIQUE ' : '';
    const using = index.method ? ` USING ${index.method}` : '';
    const predicate = index.predicate ? ` WHERE ${index.predicate}` : '';
    return `CREATE ${unique}INDEX ${quoteIdentifier(index.name)} ON ${qName(table.schema, table.name)}${using} (${index.columns
        .map(qCol)
        .join(', ')})${predicate};`;
};

const fkSql = (
    table: CanonicalTable,
    fk: CanonicalTable['foreignKeys'][number]
) => {
    const onDelete = fk.onDelete ? ` ON DELETE ${fk.onDelete}` : '';
    const onUpdate = fk.onUpdate ? ` ON UPDATE ${fk.onUpdate}` : '';
    return `ALTER TABLE ${qName(table.schema, table.name)} ADD CONSTRAINT ${quoteIdentifier(fk.name)} FOREIGN KEY (${fk.columns
        .map(qCol)
        .join(
            ', '
        )}) REFERENCES ${qName(fk.referencedSchema, fk.referencedTable)} (${fk.referencedColumns
        .map(qCol)
        .join(', ')})${onDelete}${onUpdate};`;
};

const constraintDropSql = (tableName: string, constraintName: string) =>
    `ALTER TABLE ${tableName} DROP CONSTRAINT ${quoteIdentifier(constraintName)};`;

const locateTable = (schema: CanonicalSchema, tableName: string) =>
    schema.tables.find((table) => qualifiedTableName(table) === tableName);

const toStatementId = (index: number) => `step-${index + 1}`;

export const buildPostgresMigrationPlan = (
    baseline: CanonicalSchema,
    target: CanonicalSchema
): MigrationPlan => {
    const diff = diffCanonicalSchemas(baseline, target);
    const statements: MigrationStatement[] = [];
    const summary = diff.changes.map((change) => change.summary);
    const warnings = diff.warnings.map((warning) => warning.message);

    const push = (
        statement: string,
        change: SchemaChange,
        transactional = true
    ) => {
        statements.push({
            id: toStatementId(statements.length),
            statement,
            summary: change.summary,
            transactional,
            destructive: change.destructive,
        });
    };

    for (const change of diff.changes.filter(
        (item) => item.kind === 'create_table'
    )) {
        const table = locateTable(target, change.table);
        if (!table) continue;
        push(createTableSql(table), change);
    }

    for (const change of diff.changes.filter(
        (item) => item.kind === 'add_column'
    )) {
        const column = change.details?.column as CanonicalColumn | undefined;
        if (!column) continue;
        const [schema, tableName] = change.table.split('.');
        push(
            `ALTER TABLE ${qName(schema, tableName)} ADD COLUMN ${renderColumnDefinition(column)};`,
            change
        );
    }

    for (const change of diff.changes.filter(
        (item) => item.kind === 'alter_column_type'
    )) {
        const details = change.details as {
            from: CanonicalColumn;
            to: CanonicalColumn;
        };
        const [schema, tableName] = change.table.split('.');
        push(
            `ALTER TABLE ${qName(schema, tableName)} ALTER COLUMN ${qCol(details.to.name)} TYPE ${renderType(details.to)} USING ${qCol(details.to.name)}::${details.to.type};`,
            change
        );
    }

    for (const change of diff.changes.filter(
        (item) => item.kind === 'alter_column_nullability'
    )) {
        const details = change.details as { column: string; to: boolean };
        const [schema, tableName] = change.table.split('.');
        push(
            `ALTER TABLE ${qName(schema, tableName)} ALTER COLUMN ${qCol(details.column)} ${details.to ? 'DROP' : 'SET'} NOT NULL;`,
            change
        );
    }

    for (const change of diff.changes.filter(
        (item) => item.kind === 'alter_column_default'
    )) {
        const details = change.details as { column: string; to: string | null };
        const [schema, tableName] = change.table.split('.');
        push(
            details.to === null
                ? `ALTER TABLE ${qName(schema, tableName)} ALTER COLUMN ${qCol(details.column)} DROP DEFAULT;`
                : `ALTER TABLE ${qName(schema, tableName)} ALTER COLUMN ${qCol(details.column)} SET DEFAULT ${details.to};`,
            change
        );
    }

    for (const change of diff.changes.filter(
        (item) => item.kind === 'drop_foreign_key'
    )) {
        const fk = change.details?.foreignKey as { name: string } | undefined;
        if (!fk) continue;
        push(
            constraintDropSql(
                qName(...(change.table.split('.') as [string, string])),
                fk.name
            ),
            change
        );
    }

    for (const change of diff.changes.filter(
        (item) => item.kind === 'drop_unique_constraint'
    )) {
        const constraint = change.details?.constraint as
            | { name: string }
            | undefined;
        if (!constraint) continue;
        push(
            constraintDropSql(
                qName(...(change.table.split('.') as [string, string])),
                constraint.name
            ),
            change
        );
    }

    for (const change of diff.changes.filter(
        (item) => item.kind === 'drop_primary_key'
    )) {
        push(
            `ALTER TABLE ${qName(...(change.table.split('.') as [string, string]))} DROP CONSTRAINT IF EXISTS ${quoteIdentifier(`${change.table.split('.').pop()}_pkey`)};`,
            change
        );
    }

    for (const change of diff.changes.filter(
        (item) => item.kind === 'drop_index'
    )) {
        const index = change.details?.index as { name: string } | undefined;
        if (!index) continue;
        push(`DROP INDEX IF EXISTS ${quoteIdentifier(index.name)};`, change);
    }

    for (const change of diff.changes.filter(
        (item) => item.kind === 'drop_column'
    )) {
        const column = change.details?.column as CanonicalColumn | undefined;
        if (!column) continue;
        push(
            `ALTER TABLE ${qName(...(change.table.split('.') as [string, string]))} DROP COLUMN ${qCol(column.name)};`,
            change
        );
    }

    for (const change of diff.changes.filter(
        (item) => item.kind === 'drop_table'
    )) {
        push(
            `DROP TABLE ${qName(...(change.table.split('.') as [string, string]))};`,
            change
        );
    }

    for (const change of diff.changes.filter(
        (item) => item.kind === 'add_primary_key'
    )) {
        const details = change.details as { columns: string[] };
        const [schema, tableName] = change.table.split('.');
        push(
            `ALTER TABLE ${qName(schema, tableName)} ADD PRIMARY KEY (${details.columns.map(qCol).join(', ')});`,
            change
        );
    }

    for (const change of diff.changes.filter(
        (item) => item.kind === 'add_unique_constraint'
    )) {
        const constraint = change.details?.constraint as
            | { name: string; columns: string[] }
            | undefined;
        if (!constraint) continue;
        push(
            `ALTER TABLE ${qName(...(change.table.split('.') as [string, string]))} ADD CONSTRAINT ${quoteIdentifier(constraint.name)} UNIQUE (${constraint.columns.map(qCol).join(', ')});`,
            change
        );
    }

    for (const change of diff.changes.filter(
        (item) => item.kind === 'add_foreign_key'
    )) {
        const table = locateTable(target, change.table);
        const fk = change.details?.foreignKey as
            | CanonicalTable['foreignKeys'][number]
            | undefined;
        if (!table || !fk) continue;
        push(fkSql(table, fk), change);
    }

    for (const change of diff.changes.filter(
        (item) => item.kind === 'add_index'
    )) {
        const table = locateTable(target, change.table);
        const index = change.details?.index as
            | CanonicalTable['indexes'][number]
            | undefined;
        if (!table || !index) continue;
        push(
            indexSql(table, index),
            change,
            !index.method?.toLowerCase().includes('concurrently')
        );
    }

    const wrappedSql = statements.length
        ? [
              'BEGIN;',
              ...statements.map((statement) => statement.statement),
              'COMMIT;',
          ].join('\n')
        : '-- No schema changes detected.';

    return {
        sql: wrappedSql,
        statements,
        warnings,
        summary,
        diff,
    };
};
