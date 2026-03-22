import { z } from 'zod';

const isoDateTimeSchema = z.string().datetime({ offset: true });

const diagramRecordSchema = z.record(z.string(), z.unknown());

export const CHARTDB_BACKUP_FORMAT = 'chartdb-backup';
export const CHARTDB_BACKUP_FORMAT_VERSION = 1;
export const CHARTDB_BACKUP_FILE_EXTENSION = '.chartdb-backup.json';

export const exportBackupRequestSchema = z.discriminatedUnion('scope', [
    z.object({
        scope: z.literal('all-projects'),
    }),
    z.object({
        scope: z.literal('projects'),
        projectIds: z.array(z.string().trim().min(1)).min(1),
    }),
    z.object({
        scope: z.literal('diagrams'),
        diagramIds: z.array(z.string().trim().min(1)).min(1),
    }),
]);

export const chartDbBackupArchiveSchema = z.object({
    format: z.literal(CHARTDB_BACKUP_FORMAT),
    formatVersion: z.literal(CHARTDB_BACKUP_FORMAT_VERSION),
    exportedAt: isoDateTimeSchema,
    chartdbVersion: z.string().min(1).optional(),
    scope: z.enum(['all-projects', 'projects', 'diagrams']),
    counts: z.object({
        collectionCount: z.number().int().nonnegative(),
        projectCount: z.number().int().nonnegative(),
        diagramCount: z.number().int().nonnegative(),
    }),
    collections: z.array(
        z.object({
            id: z.string().min(1),
            name: z.string().min(1),
            description: z.string().nullable(),
            ownerUserId: z.string().nullable(),
            createdAt: isoDateTimeSchema,
            updatedAt: isoDateTimeSchema,
        })
    ),
    projects: z.array(
        z.object({
            id: z.string().min(1),
            name: z.string().min(1),
            description: z.string().nullable(),
            collectionId: z.string().min(1).nullable(),
            ownerUserId: z.string().nullable(),
            visibility: z.enum(['private', 'workspace', 'public']),
            status: z.enum(['active', 'archived', 'deleted']),
            createdAt: isoDateTimeSchema,
            updatedAt: isoDateTimeSchema,
        })
    ),
    diagrams: z.array(
        z.object({
            id: z.string().min(1),
            projectId: z.string().min(1),
            ownerUserId: z.string().nullable(),
            name: z.string().min(1),
            description: z.string().nullable(),
            databaseType: z.string().min(1),
            databaseEdition: z.string().nullable(),
            visibility: z.enum(['private', 'workspace', 'public']),
            status: z.enum(['draft', 'active', 'archived']),
            createdAt: isoDateTimeSchema,
            updatedAt: isoDateTimeSchema,
            diagram: z.object({
                id: z.string().min(1),
                name: z.string().min(1),
                databaseType: z.string().min(1),
                databaseEdition: z.string().min(1).optional(),
                tables: z.array(diagramRecordSchema).optional(),
                relationships: z.array(diagramRecordSchema).optional(),
                dependencies: z.array(diagramRecordSchema).optional(),
                areas: z.array(diagramRecordSchema).optional(),
                customTypes: z.array(diagramRecordSchema).optional(),
                notes: z.array(diagramRecordSchema).optional(),
                schemaSync: diagramRecordSchema.optional(),
                createdAt: isoDateTimeSchema,
                updatedAt: isoDateTimeSchema,
            }),
        })
    ),
});

export type ExportBackupRequest = z.infer<typeof exportBackupRequestSchema>;
export type ChartDbBackupArchive = z.infer<typeof chartDbBackupArchiveSchema>;

export interface ImportBackupResult {
    collectionCount: number;
    projectCount: number;
    diagramCount: number;
    firstDiagramId: string | null;
}

export const parseChartDbBackupArchive = (value: unknown) =>
    chartDbBackupArchiveSchema.parse(value);
