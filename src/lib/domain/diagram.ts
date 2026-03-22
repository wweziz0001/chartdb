import { z } from 'zod';
import {
    canonicalSchemaSchema,
    type CanonicalSchema,
} from '../../../shared/schema-sync/canonical';
import { DatabaseEdition } from './database-edition';
import { DatabaseType } from './database-type';
import type { DBDependency } from './db-dependency';
import { dbDependencySchema } from './db-dependency';
import type { DBRelationship } from './db-relationship';
import { dbRelationshipSchema } from './db-relationship';
import type { DBTable } from './db-table';
import { dbTableSchema } from './db-table';
import { areaSchema, type Area } from './area';
import type { DBCustomType } from './db-custom-type';
import { dbCustomTypeSchema } from './db-custom-type';
import type { Note } from './note';
import { noteSchema } from './note';

export interface Diagram {
    id: string;
    name: string;
    databaseType: DatabaseType;
    databaseEdition?: DatabaseEdition;
    tables?: DBTable[];
    relationships?: DBRelationship[];
    dependencies?: DBDependency[];
    areas?: Area[];
    customTypes?: DBCustomType[];
    notes?: Note[];
    syncState?: {
        connectionId?: string;
        baselineSchema?: CanonicalSchema;
        importedAt?: string;
        lastImportAuditId?: string;
        previewAuditId?: string;
        lastApplyAuditId?: string;
    };
    createdAt: Date;
    updatedAt: Date;
}

export const diagramSchema = z.object({
    id: z.string(),
    name: z.string(),
    databaseType: z.nativeEnum(DatabaseType),
    databaseEdition: z.nativeEnum(DatabaseEdition).optional(),
    tables: z.array(dbTableSchema).optional(),
    relationships: z.array(dbRelationshipSchema).optional(),
    dependencies: z.array(dbDependencySchema).optional(),
    areas: z.array(areaSchema).optional(),
    customTypes: z.array(dbCustomTypeSchema).optional(),
    notes: z.array(noteSchema).optional(),
    syncState: z
        .object({
            connectionId: z.string().optional(),
            baselineSchema: canonicalSchemaSchema.optional(),
            importedAt: z.string().optional(),
            lastImportAuditId: z.string().optional(),
            previewAuditId: z.string().optional(),
            lastApplyAuditId: z.string().optional(),
        })
        .optional(),
    createdAt: z.date(),
    updatedAt: z.date(),
});

export const typedDiagramSchema =
    diagramSchema as unknown as z.ZodType<Diagram>;
