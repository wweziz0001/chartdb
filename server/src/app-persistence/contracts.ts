import { z } from 'zod';

export const projectVisibilitySchema = z.enum(['private', 'shared', 'public']);
export const projectStatusSchema = z.enum(['active', 'archived', 'deleted']);
export const diagramVisibilitySchema = z.enum(['private', 'shared', 'public']);
export const diagramStatusSchema = z.enum(['draft', 'active', 'archived']);
export const membershipRoleSchema = z.enum(['owner', 'editor', 'viewer']);
export const userStatusSchema = z.enum(['active', 'invited', 'disabled']);

export const diagramDocumentSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    databaseType: z.string().min(1),
    databaseEdition: z.string().optional(),
    tables: z.array(z.unknown()).optional(),
    relationships: z.array(z.unknown()).optional(),
    dependencies: z.array(z.unknown()).optional(),
    areas: z.array(z.unknown()).optional(),
    customTypes: z.array(z.unknown()).optional(),
    notes: z.array(z.unknown()).optional(),
    schemaSync: z.unknown().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});

export const projectInputSchema = z.object({
    id: z.string().min(1).optional(),
    name: z.string().min(1),
    description: z.string().max(2000).optional(),
    visibility: projectVisibilitySchema.optional(),
    status: projectStatusSchema.optional(),
    ownerUserId: z.string().min(1).optional(),
});

export const upsertDiagramRequestSchema = z.object({
    diagram: diagramDocumentSchema,
    project: projectInputSchema.optional(),
    ownerUserId: z.string().min(1).optional(),
});

export const createProjectRequestSchema = z.object({
    name: z.string().min(1),
    description: z.string().max(2000).optional(),
    visibility: projectVisibilitySchema.optional(),
    status: projectStatusSchema.optional(),
    ownerUserId: z.string().min(1).optional(),
});

export const updateProjectRequestSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().max(2000).nullable().optional(),
    visibility: projectVisibilitySchema.optional(),
    status: projectStatusSchema.optional(),
});

export const listDiagramsQuerySchema = z.object({
    includeTables: z.coerce.boolean().optional(),
    includeRelationships: z.coerce.boolean().optional(),
    includeDependencies: z.coerce.boolean().optional(),
    includeAreas: z.coerce.boolean().optional(),
    includeCustomTypes: z.coerce.boolean().optional(),
    includeNotes: z.coerce.boolean().optional(),
    q: z.string().optional(),
});

export const searchQuerySchema = z.object({
    q: z.string().trim().min(1).max(200),
});

export const diagramIncludeOptionsSchema = listDiagramsQuerySchema.pick({
    includeTables: true,
    includeRelationships: true,
    includeDependencies: true,
    includeAreas: true,
    includeCustomTypes: true,
    includeNotes: true,
});

export type DiagramDocument = z.infer<typeof diagramDocumentSchema>;
export type ProjectInput = z.infer<typeof projectInputSchema>;
export type UpsertDiagramRequest = z.infer<typeof upsertDiagramRequestSchema>;
export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;
export type UpdateProjectRequest = z.infer<typeof updateProjectRequestSchema>;
export type DiagramIncludeOptions = z.infer<typeof diagramIncludeOptionsSchema>;
export type ProjectVisibility = z.infer<typeof projectVisibilitySchema>;
export type ProjectStatus = z.infer<typeof projectStatusSchema>;
export type DiagramVisibility = z.infer<typeof diagramVisibilitySchema>;
export type DiagramStatus = z.infer<typeof diagramStatusSchema>;
export type MembershipRole = z.infer<typeof membershipRoleSchema>;
export type UserStatus = z.infer<typeof userStatusSchema>;
