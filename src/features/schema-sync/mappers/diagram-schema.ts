import { DatabaseType } from '@/lib/domain/database-type';
import type { Diagram } from '@/lib/domain/diagram';
import type { DBField } from '@/lib/domain/db-field';
import type { DBIndex } from '@/lib/domain/db-index';
import type { DBRelationship } from '@/lib/domain/db-relationship';
import type { DBTable } from '@/lib/domain/db-table';
import { adjustTablePositions } from '@/lib/domain/db-table';
import {
    findDataTypeDataById,
    getPreferredSynonym,
    type DataType,
} from '@/lib/data/data-types/data-types';
import { generateId } from '@/lib/utils';
import type {
    CanonicalColumn,
    CanonicalForeignKey,
    CanonicalSchema,
    CanonicalTable,
} from '../../../../shared/schema-sync/canonical';

const normalizeType = (typeName: string): DataType => {
    const normalized = getPreferredSynonym(typeName, DatabaseType.POSTGRESQL);
    if (normalized) {
        return { id: normalized.id, name: normalized.name };
    }
    const trimmed = typeName.toLowerCase().trim();
    const known = findDataTypeDataById(trimmed, DatabaseType.POSTGRESQL);
    return known
        ? { id: known.id, name: known.name }
        : { id: trimmed.replace(/\s+/g, '_'), name: typeName };
};

const mapIndexColumnsToFieldIds = ({
    columns,
    fields,
}: {
    columns: string[];
    fields: DBField[];
}) =>
    columns
        .map(
            (columnName) =>
                fields.find((field) => field.name === columnName)?.id
        )
        .filter(Boolean) as string[];

export const canonicalToDiagram = ({
    schema,
    existingDiagram,
}: {
    schema: CanonicalSchema;
    existingDiagram?: Diagram;
}): Pick<Diagram, 'databaseType' | 'tables' | 'relationships'> => {
    const tableByName = new Map(
        (existingDiagram?.tables ?? []).map((table) => [
            `${table.schema}.${table.name}`,
            table,
        ])
    );
    const fieldIdByQualifiedName = new Map<string, string>();

    const tables: DBTable[] = schema.tables.map((table, tableIndex) => {
        const existingTable = tableByName.get(`${table.schema}.${table.name}`);
        const fields: DBField[] = table.columns.map((column, columnIndex) => {
            const existingField = existingTable?.fields.find(
                (field) => field.name === column.name
            );
            const field: DBField = {
                id: existingField?.id ?? generateId(),
                name: column.name,
                type: normalizeType(column.type),
                primaryKey:
                    table.primaryKey?.columns.includes(column.name) ?? false,
                unique:
                    table.uniqueConstraints.some(
                        (constraint) =>
                            constraint.columns.length === 1 &&
                            constraint.columns[0] === column.name
                    ) ?? false,
                nullable: column.nullable,
                increment: Boolean(column.identity),
                isArray: column.isArray ?? false,
                createdAt: existingField?.createdAt ?? Date.now() + columnIndex,
                characterMaximumLength: column.length
                    ? String(column.length)
                    : null,
                precision: column.precision ?? null,
                scale: column.scale ?? null,
                default: column.default ?? null,
                comments: column.comments ?? null,
            };
            fieldIdByQualifiedName.set(
                `${table.schema}.${table.name}.${column.name}`,
                field.id
            );
            return field;
        });

        const indexes: DBIndex[] = table.indexes.map((index) => ({
            id:
                existingTable?.indexes.find(
                    (candidate) => candidate.name === index.name
                )?.id ?? generateId(),
            name: index.name,
            unique: index.unique,
            fieldIds: mapIndexColumnsToFieldIds({
                columns: index.columns,
                fields,
            }),
            createdAt: Date.now(),
            type: (index.method?.toLowerCase() as DBIndex['type']) ?? 'btree',
            isPrimaryKey: false,
        }));

        return {
            id: existingTable?.id ?? generateId(),
            name: table.name,
            schema: table.schema,
            x: existingTable?.x ?? 150 + (tableIndex % 4) * 260,
            y: existingTable?.y ?? 120 + Math.floor(tableIndex / 4) * 260,
            fields,
            indexes,
            color: existingTable?.color ?? '#4F46E5',
            isView: table.kind !== 'table',
            isMaterializedView: table.kind === 'materialized_view',
            createdAt: existingTable?.createdAt ?? Date.now(),
            comments: table.comments ?? null,
            checkConstraints: table.checkConstraints.map((constraint) => ({
                id: generateId(),
                expression: constraint.expression,
                createdAt: Date.now(),
            })),
        };
    });

    const tableIdByQualifiedName = new Map(
        tables.map((table) => [`${table.schema}.${table.name}`, table.id])
    );

    const relationships: DBRelationship[] = schema.tables.flatMap(
        (table) =>
            table.foreignKeys
                .map((fk): DBRelationship | null => {
                    const sourceTableId = tableIdByQualifiedName.get(
                        `${table.schema}.${table.name}`
                    );
                    const targetTableId = tableIdByQualifiedName.get(
                        `${fk.referencedSchema}.${fk.referencedTable}`
                    );
                    const sourceFieldId = fieldIdByQualifiedName.get(
                        `${table.schema}.${table.name}.${fk.columns[0]}`
                    );
                    const targetFieldId = fieldIdByQualifiedName.get(
                        `${fk.referencedSchema}.${fk.referencedTable}.${fk.referencedColumns[0]}`
                    );
                    if (
                        !sourceTableId ||
                        !targetTableId ||
                        !sourceFieldId ||
                        !targetFieldId
                    ) {
                        return null;
                    }
                    return {
                        id: generateId(),
                        name: fk.name,
                        sourceSchema: table.schema,
                        targetSchema: fk.referencedSchema,
                        sourceTableId,
                        targetTableId,
                        sourceFieldId,
                        targetFieldId,
                        sourceCardinality: 'many',
                        targetCardinality: 'one',
                        createdAt: Date.now(),
                    };
                })
                .filter(Boolean) as DBRelationship[]
    );

    return {
        databaseType: DatabaseType.POSTGRESQL,
        tables: adjustTablePositions({
            tables,
            relationships,
            mode: 'perSchema',
        }),
        relationships,
    };
};

const buildForeignKeys = ({
    diagram,
    table,
}: {
    diagram: Diagram;
    table: DBTable;
}): CanonicalForeignKey[] =>
    (diagram.relationships ?? [])
        .filter((relationship) => relationship.sourceTableId === table.id)
        .map((relationship) => {
            const sourceTable = diagram.tables?.find(
                (candidate) => candidate.id === relationship.sourceTableId
            );
            const targetTable = diagram.tables?.find(
                (candidate) => candidate.id === relationship.targetTableId
            );
            const sourceField = sourceTable?.fields.find(
                (field) => field.id === relationship.sourceFieldId
            );
            const targetField = targetTable?.fields.find(
                (field) => field.id === relationship.targetFieldId
            );
            if (!sourceTable || !targetTable || !sourceField || !targetField) {
                return null;
            }
            return {
                name:
                    relationship.name ||
                    `${sourceTable.name}_${sourceField.name}_fkey`,
                columns: [sourceField.name],
                referencedSchema: targetTable.schema ?? 'public',
                referencedTable: targetTable.name,
                referencedColumns: [targetField.name],
                onDelete: null,
                onUpdate: null,
            };
        })
        .filter(Boolean) as CanonicalForeignKey[];

const fieldToCanonicalColumn = (field: DBField): CanonicalColumn => ({
    name: field.name,
    type: field.type.name,
    nullable: field.nullable,
    default: field.default ?? null,
    identity: field.increment
        ? { generation: 'BY DEFAULT', sequenceName: null }
        : null,
    isArray: field.isArray ?? false,
    length: field.characterMaximumLength
        ? Number(field.characterMaximumLength)
        : null,
    precision: field.precision ?? null,
    scale: field.scale ?? null,
    comments: field.comments ?? null,
});

const tableToCanonical = (
    diagram: Diagram,
    table: DBTable
): CanonicalTable => ({
    schema: table.schema ?? 'public',
    name: table.name,
    kind: table.isMaterializedView
        ? 'materialized_view'
        : table.isView
          ? 'view'
          : 'table',
    columns: table.fields.map(fieldToCanonicalColumn),
    primaryKey: table.fields.some((field) => field.primaryKey)
        ? {
              columns: table.fields
                  .filter((field) => field.primaryKey)
                  .map((field) => field.name),
              name: `${table.name}_pkey`,
          }
        : null,
    foreignKeys: buildForeignKeys({ diagram, table }),
    uniqueConstraints: [
        ...table.fields
            .filter((field) => field.unique)
            .map((field) => ({
                name: `${table.name}_${field.name}_key`,
                columns: [field.name],
            })),
    ],
    indexes: table.indexes
        .filter((index) => !index.isPrimaryKey)
        .map((index) => ({
            name: index.name || `${table.name}_${index.id}`,
            columns: index.fieldIds
                .map(
                    (fieldId) =>
                        table.fields.find((field) => field.id === fieldId)?.name
                )
                .filter(Boolean) as string[],
            unique: index.unique,
            method: index.type ?? null,
            predicate: null,
            expression: null,
        }))
        .filter((index) => index.columns.length > 0),
    checkConstraints:
        table.checkConstraints?.map((constraint, index) => ({
            name: `${table.name}_check_${index + 1}`,
            expression: constraint.expression,
        })) ?? [],
    comments: table.comments ?? null,
});

export const diagramToCanonical = (diagram: Diagram): CanonicalSchema => ({
    engine: 'postgresql',
    databaseName:
        diagram.syncState?.baselineSchema?.databaseName ??
        (diagram.name || 'chartdb'),
    schemas: [
        ...new Set(
            (diagram.tables ?? []).map((table) => table.schema ?? 'public')
        ),
    ],
    importedAt: new Date().toISOString(),
    metadata: {
        source: 'canvas',
        connectionId: diagram.syncState?.connectionId,
    },
    tables: (diagram.tables ?? []).map((table) =>
        tableToCanonical(diagram, table)
    ),
});
