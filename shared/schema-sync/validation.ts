import { z } from 'zod';
import { canonicalSchemaSchema } from './canonical.ts';

export const connectionSslSchema = z.object({
    enabled: z.boolean().default(false),
    rejectUnauthorized: z.boolean().default(true),
});

export const postgresConnectionInputSchema = z.object({
    name: z.string().min(1).max(100),
    host: z.string().min(1),
    port: z.number().int().min(1).max(65535).default(5432),
    database: z.string().min(1),
    username: z.string().min(1),
    password: z.string().min(1),
    ssl: connectionSslSchema.optional(),
    schemaNames: z.array(z.string().min(1)).optional(),
});

export const storedConnectionMetadataSchema = postgresConnectionInputSchema
    .omit({ password: true })
    .extend({
        id: z.string(),
        engine: z.literal('postgresql').default('postgresql'),
        createdAt: z.string(),
        updatedAt: z.string(),
        hasPassword: z.boolean().default(true),
    });

export const schemaImportRequestSchema = z.object({
    connectionId: z.string().min(1),
    schemaNames: z.array(z.string().min(1)).optional(),
});

export const schemaDiffRequestSchema = z.object({
    baseline: canonicalSchemaSchema,
    target: canonicalSchemaSchema,
});

export const schemaApplyRequestSchema = z.object({
    connectionId: z.string().min(1),
    baseline: canonicalSchemaSchema,
    target: canonicalSchemaSchema,
    approval: z.object({
        typedConfirmation: z.string().optional(),
        allowDestructiveChanges: z.boolean().default(false),
    }),
    actor: z
        .object({
            id: z.string().default('anonymous'),
            name: z.string().default('Anonymous User'),
        })
        .optional(),
});

export type PostgresConnectionInput = z.infer<
    typeof postgresConnectionInputSchema
>;
export type StoredConnectionMetadata = z.infer<
    typeof storedConnectionMetadataSchema
>;
export type SchemaImportRequest = z.infer<typeof schemaImportRequestSchema>;
export type SchemaDiffRequest = z.infer<typeof schemaDiffRequestSchema>;
export type SchemaApplyRequest = z.infer<typeof schemaApplyRequestSchema>;
