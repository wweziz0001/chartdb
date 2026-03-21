/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import {
    type CanonicalColumn,
    type CanonicalForeignKey,
    type CanonicalIndex,
    type CanonicalSchema,
    type CanonicalTable,
    type CanonicalUniqueConstraint,
    qualifiedColumnName,
    qualifiedTableName,
} from './canonical';

export type ChangeRiskLevel = 'low' | 'medium' | 'high';
export type SchemaChangeKind =
    | 'create_table'
    | 'drop_table'
    | 'rename_table_candidate'
    | 'add_column'
    | 'drop_column'
    | 'rename_column_candidate'
    | 'alter_column_type'
    | 'alter_column_nullability'
    | 'alter_column_default'
    | 'add_primary_key'
    | 'drop_primary_key'
    | 'add_foreign_key'
    | 'drop_foreign_key'
    | 'add_unique_constraint'
    | 'drop_unique_constraint'
    | 'add_index'
    | 'drop_index';

export interface SchemaWarning {
    code:
        | 'destructive_change'
        | 'type_narrowing'
        | 'not_null_on_existing_data'
        | 'rename_ambiguity'
        | 'manual_review';
    message: string;
    level: ChangeRiskLevel;
    destructive: boolean;
    target: string;
}

export interface SchemaChange {
    kind: SchemaChangeKind;
    table: string;
    summary: string;
    risk: ChangeRiskLevel;
    destructive: boolean;
    details?: Record<string, unknown>;
}

export interface RenameCandidate {
    scope: 'table' | 'column';
    source: string;
    target: string;
    confidence: number;
    reason: string;
}

export interface SchemaDiffSummary {
    createTableCount: number;
    dropTableCount: number;
    addColumnCount: number;
    dropColumnCount: number;
    alterColumnCount: number;
    addConstraintCount: number;
    dropConstraintCount: number;
    destructiveChangeCount: number;
}

export interface SchemaDiffResult {
    changes: SchemaChange[];
    warnings: SchemaWarning[];
    renameCandidates: RenameCandidate[];
    summary: SchemaDiffSummary;
    hasDestructiveChanges: boolean;
}

const tableMap = (schema: CanonicalSchema) =>
    new Map(schema.tables.map((table) => [qualifiedTableName(table), table]));

const columnMap = (table: CanonicalTable) =>
    new Map(table.columns.map((column) => [column.name, column]));

const byName = <T extends { name: string }>(items: T[]) =>
    new Map(items.map((item) => [item.name, item]));

const signatureForColumns = (columns: CanonicalColumn[]) =>
    columns
        .map((column) => `${column.name}:${column.type}:${column.nullable}`)
        .sort()
        .join('|');

const isLikelyNarrowingTypeChange = (fromType: string, toType: string) => {
    const pair = `${fromType.toLowerCase()}->${toType.toLowerCase()}`;
    return [
        'bigint->integer',
        'integer->smallint',
        'text->varchar',
        'text->char',
        'numeric->integer',
        'timestamp with time zone->timestamp without time zone',
    ].includes(pair);
};

const pushWarning = (
    warnings: SchemaWarning[],
    warning: SchemaWarning | undefined
) => {
    if (warning) {
        warnings.push(warning);
    }
};

const compareNamedCollections = <T extends { name: string }>(
    baselineItems: T[],
    targetItems: T[],
    onAdded: (item: T) => void,
    onRemoved: (item: T) => void
) => {
    const baselineByName = byName(baselineItems);
    const targetByName = byName(targetItems);

    for (const [name, item] of targetByName) {
        if (!baselineByName.has(name)) {
            onAdded(item);
        }
    }

    for (const [name, item] of baselineByName) {
        if (!targetByName.has(name)) {
            onRemoved(item);
        }
    }
};

const detectTableRenameCandidates = (
    baselineOnly: CanonicalTable[],
    targetOnly: CanonicalTable[]
): RenameCandidate[] => {
    const candidates: RenameCandidate[] = [];
    for (const source of baselineOnly) {
        for (const target of targetOnly) {
            const sameSchema = source.schema === target.schema;
            const sameSignature =
                signatureForColumns(source.columns) ===
                signatureForColumns(target.columns);
            if (sameSchema && sameSignature) {
                candidates.push({
                    scope: 'table',
                    source: qualifiedTableName(source),
                    target: qualifiedTableName(target),
                    confidence: 0.84,
                    reason: 'Matching column signature in the same schema.',
                });
            }
        }
    }
    return candidates;
};

const detectColumnRenameCandidates = (
    baselineTable: CanonicalTable,
    targetTable: CanonicalTable
): RenameCandidate[] => {
    const baselineColumns = baselineTable.columns.filter(
        (column) =>
            !targetTable.columns.some(
                (candidate) => candidate.name === column.name
            )
    );
    const targetColumns = targetTable.columns.filter(
        (column) =>
            !baselineTable.columns.some(
                (candidate) => candidate.name === column.name
            )
    );

    const candidates: RenameCandidate[] = [];
    for (const source of baselineColumns) {
        for (const target of targetColumns) {
            if (
                source.type === target.type &&
                source.nullable === target.nullable &&
                source.default === target.default
            ) {
                candidates.push({
                    scope: 'column',
                    source: qualifiedColumnName(baselineTable, source.name),
                    target: qualifiedColumnName(targetTable, target.name),
                    confidence: 0.72,
                    reason: 'Matching column type, nullability, and default.',
                });
            }
        }
    }
    return candidates;
};

const comparePrimaryKey = (
    baselineTable: CanonicalTable,
    targetTable: CanonicalTable,
    changes: SchemaChange[]
) => {
    const baselinePk = baselineTable.primaryKey;
    const targetPk = targetTable.primaryKey;
    if (!baselinePk && targetPk) {
        changes.push({
            kind: 'add_primary_key',
            table: qualifiedTableName(targetTable),
            summary: `Add primary key on ${targetPk.columns.join(', ')}.`,
            risk: 'medium',
            destructive: false,
            details: { columns: targetPk.columns },
        });
    } else if (baselinePk && !targetPk) {
        changes.push({
            kind: 'drop_primary_key',
            table: qualifiedTableName(baselineTable),
            summary: 'Drop primary key.',
            risk: 'high',
            destructive: true,
            details: { columns: baselinePk.columns },
        });
    } else if (
        baselinePk &&
        targetPk &&
        baselinePk.columns.join('|') !== targetPk.columns.join('|')
    ) {
        changes.push({
            kind: 'drop_primary_key',
            table: qualifiedTableName(baselineTable),
            summary: 'Replace primary key definition.',
            risk: 'high',
            destructive: true,
            details: { from: baselinePk.columns, to: targetPk.columns },
        });
        changes.push({
            kind: 'add_primary_key',
            table: qualifiedTableName(targetTable),
            summary: `Add primary key on ${targetPk.columns.join(', ')}.`,
            risk: 'medium',
            destructive: false,
            details: { columns: targetPk.columns },
        });
    }
};

export const diffCanonicalSchemas = (
    baseline: CanonicalSchema,
    target: CanonicalSchema
): SchemaDiffResult => {
    const changes: SchemaChange[] = [];
    const warnings: SchemaWarning[] = [];
    const renameCandidates: RenameCandidate[] = [];

    const baselineTables = tableMap(baseline);
    const targetTables = tableMap(target);

    const baselineOnlyTables = baseline.tables.filter(
        (table) => !targetTables.has(qualifiedTableName(table))
    );
    const targetOnlyTables = target.tables.filter(
        (table) => !baselineTables.has(qualifiedTableName(table))
    );

    renameCandidates.push(
        ...detectTableRenameCandidates(baselineOnlyTables, targetOnlyTables)
    );
    for (const candidate of renameCandidates.filter(
        (c) => c.scope === 'table'
    )) {
        warnings.push({
            code: 'rename_ambiguity',
            message: `Possible table rename detected from ${candidate.source} to ${candidate.target}.`,
            level: 'medium',
            destructive: false,
            target: candidate.target,
        });
    }

    for (const table of targetOnlyTables) {
        changes.push({
            kind: 'create_table',
            table: qualifiedTableName(table),
            summary: `Create table ${qualifiedTableName(table)}.`,
            risk: 'low',
            destructive: false,
            details: { table },
        });
    }

    for (const table of baselineOnlyTables) {
        changes.push({
            kind: 'drop_table',
            table: qualifiedTableName(table),
            summary: `Drop table ${qualifiedTableName(table)}.`,
            risk: 'high',
            destructive: true,
            details: { table },
        });
        warnings.push({
            code: 'destructive_change',
            message: `Dropping ${qualifiedTableName(table)} will permanently remove its data.`,
            level: 'high',
            destructive: true,
            target: qualifiedTableName(table),
        });
    }

    for (const [tableKey, baselineTable] of baselineTables) {
        const targetTable = targetTables.get(tableKey);
        if (!targetTable) continue;

        const baselineColumns = columnMap(baselineTable);
        const targetColumns = columnMap(targetTable);

        renameCandidates.push(
            ...detectColumnRenameCandidates(baselineTable, targetTable)
        );

        for (const column of targetTable.columns) {
            if (!baselineColumns.has(column.name)) {
                changes.push({
                    kind: 'add_column',
                    table: tableKey,
                    summary: `Add column ${column.name} to ${tableKey}.`,
                    risk: column.nullable ? 'low' : 'medium',
                    destructive: false,
                    details: { column },
                });
            }
        }

        for (const column of baselineTable.columns) {
            const targetColumn = targetColumns.get(column.name);
            if (!targetColumn) {
                changes.push({
                    kind: 'drop_column',
                    table: tableKey,
                    summary: `Drop column ${column.name} from ${tableKey}.`,
                    risk: 'high',
                    destructive: true,
                    details: { column },
                });
                warnings.push({
                    code: 'destructive_change',
                    message: `Dropping ${qualifiedColumnName(baselineTable, column.name)} will remove existing data.`,
                    level: 'high',
                    destructive: true,
                    target: qualifiedColumnName(baselineTable, column.name),
                });
                continue;
            }

            if (column.type !== targetColumn.type) {
                const narrowing = isLikelyNarrowingTypeChange(
                    column.type,
                    targetColumn.type
                );
                changes.push({
                    kind: 'alter_column_type',
                    table: tableKey,
                    summary: `Alter type of ${column.name} from ${column.type} to ${targetColumn.type}.`,
                    risk: narrowing ? 'high' : 'medium',
                    destructive: narrowing,
                    details: { from: column, to: targetColumn },
                });
                pushWarning(
                    warnings,
                    narrowing
                        ? {
                              code: 'type_narrowing',
                              message: `Type change on ${qualifiedColumnName(baselineTable, column.name)} may truncate or reject existing values.`,
                              level: 'high',
                              destructive: true,
                              target: qualifiedColumnName(
                                  baselineTable,
                                  column.name
                              ),
                          }
                        : undefined
                );
            }

            if (column.nullable !== targetColumn.nullable) {
                const makingNotNull = column.nullable && !targetColumn.nullable;
                changes.push({
                    kind: 'alter_column_nullability',
                    table: tableKey,
                    summary: `${makingNotNull ? 'Set' : 'Drop'} NOT NULL on ${column.name}.`,
                    risk: makingNotNull ? 'high' : 'medium',
                    destructive: makingNotNull,
                    details: {
                        from: column.nullable,
                        to: targetColumn.nullable,
                        column: targetColumn.name,
                    },
                });
                pushWarning(
                    warnings,
                    makingNotNull
                        ? {
                              code: 'not_null_on_existing_data',
                              message: `Setting ${qualifiedColumnName(baselineTable, column.name)} to NOT NULL requires validating existing rows.`,
                              level: 'high',
                              destructive: true,
                              target: qualifiedColumnName(
                                  baselineTable,
                                  column.name
                              ),
                          }
                        : undefined
                );
            }

            if ((column.default ?? null) !== (targetColumn.default ?? null)) {
                changes.push({
                    kind: 'alter_column_default',
                    table: tableKey,
                    summary: `Change default of ${column.name}.`,
                    risk: 'low',
                    destructive: false,
                    details: {
                        from: column.default ?? null,
                        to: targetColumn.default ?? null,
                        column: targetColumn.name,
                    },
                });
            }
        }

        comparePrimaryKey(baselineTable, targetTable, changes);

        compareNamedCollections<CanonicalForeignKey>(
            baselineTable.foreignKeys,
            targetTable.foreignKeys,
            (fk) => {
                changes.push({
                    kind: 'add_foreign_key',
                    table: tableKey,
                    summary: `Add foreign key ${fk.name}.`,
                    risk: 'medium',
                    destructive: false,
                    details: { foreignKey: fk },
                });
            },
            (fk) => {
                changes.push({
                    kind: 'drop_foreign_key',
                    table: tableKey,
                    summary: `Drop foreign key ${fk.name}.`,
                    risk: 'medium',
                    destructive: true,
                    details: { foreignKey: fk },
                });
            }
        );

        compareNamedCollections<CanonicalUniqueConstraint>(
            baselineTable.uniqueConstraints,
            targetTable.uniqueConstraints,
            (constraint) => {
                changes.push({
                    kind: 'add_unique_constraint',
                    table: tableKey,
                    summary: `Add unique constraint ${constraint.name}.`,
                    risk: 'low',
                    destructive: false,
                    details: { constraint },
                });
            },
            (constraint) => {
                changes.push({
                    kind: 'drop_unique_constraint',
                    table: tableKey,
                    summary: `Drop unique constraint ${constraint.name}.`,
                    risk: 'medium',
                    destructive: true,
                    details: { constraint },
                });
            }
        );

        compareNamedCollections<CanonicalIndex>(
            baselineTable.indexes,
            targetTable.indexes,
            (index) => {
                changes.push({
                    kind: 'add_index',
                    table: tableKey,
                    summary: `Add index ${index.name}.`,
                    risk: 'low',
                    destructive: false,
                    details: { index },
                });
            },
            (index) => {
                changes.push({
                    kind: 'drop_index',
                    table: tableKey,
                    summary: `Drop index ${index.name}.`,
                    risk: 'low',
                    destructive: true,
                    details: { index },
                });
            }
        );
    }

    for (const candidate of renameCandidates.filter(
        (c) => c.scope === 'column'
    )) {
        warnings.push({
            code: 'rename_ambiguity',
            message: `Possible column rename detected from ${candidate.source} to ${candidate.target}.`,
            level: 'medium',
            destructive: false,
            target: candidate.target,
        });
    }

    const summary: SchemaDiffSummary = {
        createTableCount: changes.filter(
            (change) => change.kind === 'create_table'
        ).length,
        dropTableCount: changes.filter((change) => change.kind === 'drop_table')
            .length,
        addColumnCount: changes.filter((change) => change.kind === 'add_column')
            .length,
        dropColumnCount: changes.filter(
            (change) => change.kind === 'drop_column'
        ).length,
        alterColumnCount: changes.filter((change) =>
            [
                'alter_column_type',
                'alter_column_nullability',
                'alter_column_default',
            ].includes(change.kind)
        ).length,
        addConstraintCount: changes.filter((change) =>
            [
                'add_primary_key',
                'add_foreign_key',
                'add_unique_constraint',
                'add_index',
            ].includes(change.kind)
        ).length,
        dropConstraintCount: changes.filter((change) =>
            [
                'drop_primary_key',
                'drop_foreign_key',
                'drop_unique_constraint',
                'drop_index',
            ].includes(change.kind)
        ).length,
        destructiveChangeCount: changes.filter((change) => change.destructive)
            .length,
    };

    return {
        changes,
        warnings,
        renameCandidates,
        summary,
        hasDestructiveChanges: changes.some((change) => change.destructive),
    };
};
