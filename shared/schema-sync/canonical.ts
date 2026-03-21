import { z } from 'zod';

export const schemaObjectIdSchema = z.object({
    vendorId: z.string().optional(),
    stableId: z.string().optional(),
});

export const canonicalColumnSchema = z.object({
    name: z.string(),
    type: z.string(),
    typeSchema: z.string().nullable().optional(),
    typeCategory: z.string().nullable().optional(),
    nullable: z.boolean(),
    default: z.string().nullable().optional(),
    identity: z
        .object({
            generation: z.enum(['ALWAYS', 'BY DEFAULT']).optional(),
            sequenceName: z.string().nullable().optional(),
        })
        .nullable()
        .optional(),
    isArray: z.boolean().optional(),
    length: z.number().nullable().optional(),
    precision: z.number().nullable().optional(),
    scale: z.number().nullable().optional(),
    comments: z.string().nullable().optional(),
    objectId: schemaObjectIdSchema.optional(),
});

export const canonicalPrimaryKeySchema = z.object({
    name: z.string().nullable().optional(),
    columns: z.array(z.string()).min(1),
});

export const canonicalUniqueConstraintSchema = z.object({
    name: z.string(),
    columns: z.array(z.string()).min(1),
    deferrable: z.boolean().optional(),
});

export const canonicalIndexSchema = z.object({
    name: z.string(),
    columns: z.array(z.string()).min(1),
    unique: z.boolean(),
    method: z.string().nullable().optional(),
    predicate: z.string().nullable().optional(),
    expression: z.string().nullable().optional(),
    objectId: schemaObjectIdSchema.optional(),
});

export const canonicalForeignKeySchema = z.object({
    name: z.string(),
    columns: z.array(z.string()).min(1),
    referencedSchema: z.string(),
    referencedTable: z.string(),
    referencedColumns: z.array(z.string()).min(1),
    onUpdate: z.string().nullable().optional(),
    onDelete: z.string().nullable().optional(),
    objectId: schemaObjectIdSchema.optional(),
});

export const canonicalCheckConstraintSchema = z.object({
    name: z.string(),
    expression: z.string(),
});

export const canonicalTableSchema = z.object({
    schema: z.string(),
    name: z.string(),
    kind: z.enum(['table', 'view', 'materialized_view']).default('table'),
    columns: z.array(canonicalColumnSchema),
    primaryKey: canonicalPrimaryKeySchema.nullable().optional(),
    foreignKeys: z.array(canonicalForeignKeySchema).default([]),
    uniqueConstraints: z.array(canonicalUniqueConstraintSchema).default([]),
    indexes: z.array(canonicalIndexSchema).default([]),
    checkConstraints: z.array(canonicalCheckConstraintSchema).default([]),
    comments: z.string().nullable().optional(),
    objectId: schemaObjectIdSchema.optional(),
});

export const canonicalSchemaSchema = z.object({
    databaseName: z.string(),
    schemas: z.array(z.string()),
    tables: z.array(canonicalTableSchema),
    importedAt: z.string().datetime().optional(),
    engine: z.literal('postgresql').default('postgresql'),
    metadata: z
        .object({
            source: z.enum(['live-import', 'canvas']).optional(),
            connectionId: z.string().optional(),
        })
        .optional(),
});

export type CanonicalColumn = z.infer<typeof canonicalColumnSchema>;
export type CanonicalPrimaryKey = z.infer<typeof canonicalPrimaryKeySchema>;
export type CanonicalUniqueConstraint = z.infer<
    typeof canonicalUniqueConstraintSchema
>;
export type CanonicalIndex = z.infer<typeof canonicalIndexSchema>;
export type CanonicalForeignKey = z.infer<typeof canonicalForeignKeySchema>;
export type CanonicalCheckConstraint = z.infer<
    typeof canonicalCheckConstraintSchema
>;
export type CanonicalTable = z.infer<typeof canonicalTableSchema>;
export type CanonicalSchema = z.infer<typeof canonicalSchemaSchema>;

export const qualifiedTableName = (
    table: Pick<CanonicalTable, 'schema' | 'name'>
) => `${table.schema}.${table.name}`;

export const qualifiedColumnName = (
    table: Pick<CanonicalTable, 'schema' | 'name'>,
    columnName: string
) => `${qualifiedTableName(table)}.${columnName}`;
