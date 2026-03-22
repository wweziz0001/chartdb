import { z } from 'zod';
import {
    diagramDocumentSchema,
    diagramStatusSchema,
    diagramVisibilitySchema,
    projectStatusSchema,
    projectVisibilitySchema,
} from './persistence.js';

const isoDateTimeSchema = z.string().datetime({ offset: true });

const backupDiagramDocumentSchema = diagramDocumentSchema.extend({
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
});

export const chartDbBackupEnvelopeSchema = z.object({
    format: z.string().min(1),
    formatVersion: z.number().int(),
});

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

export const chartDbBackupCollectionSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().nullable(),
    ownerUserId: z.string().nullable(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
});

export const chartDbBackupProjectSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().nullable(),
    collectionId: z.string().min(1).nullable(),
    ownerUserId: z.string().nullable(),
    visibility: projectVisibilitySchema,
    status: projectStatusSchema,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
});

export const chartDbBackupDiagramSchema = z.object({
    id: z.string().min(1),
    projectId: z.string().min(1),
    ownerUserId: z.string().nullable(),
    name: z.string().min(1),
    description: z.string().nullable(),
    databaseType: z.string().min(1),
    databaseEdition: z.string().nullable(),
    visibility: diagramVisibilitySchema,
    status: diagramStatusSchema,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
    diagram: backupDiagramDocumentSchema,
});

export const chartDbBackupArchiveSchema = z.object({
    format: z.literal('chartdb-backup'),
    formatVersion: z.literal(1),
    exportedAt: isoDateTimeSchema,
    chartdbVersion: z.string().min(1).optional(),
    scope: z.enum(['all-projects', 'projects', 'diagrams']),
    counts: z.object({
        collectionCount: z.number().int().nonnegative(),
        projectCount: z.number().int().nonnegative(),
        diagramCount: z.number().int().nonnegative(),
    }),
    collections: z.array(chartDbBackupCollectionSchema),
    projects: z.array(chartDbBackupProjectSchema),
    diagrams: z.array(chartDbBackupDiagramSchema),
});

export type ExportBackupRequest = z.infer<typeof exportBackupRequestSchema>;
export type ChartDbBackupArchive = z.infer<typeof chartDbBackupArchiveSchema>;
