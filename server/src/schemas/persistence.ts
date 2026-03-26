import { z } from 'zod';

export const userAuthProviderSchema = z.enum(['placeholder', 'local', 'oidc']);
export const userStatusSchema = z.enum(['provisioned', 'active', 'disabled']);
export const userRoleSchema = z.enum(['member', 'admin']);
export const ownershipScopeSchema = z.enum(['personal', 'workspace']);

export const projectVisibilitySchema = z.enum([
    'private',
    'workspace',
    'public',
]);
export const projectStatusSchema = z.enum(['active', 'archived', 'deleted']);
export const sharingScopeSchema = z.enum(['private', 'authenticated', 'link']);
export const sharingAccessSchema = z.enum(['view', 'edit']);

export const diagramVisibilitySchema = z.enum([
    'private',
    'workspace',
    'public',
]);
export const diagramStatusSchema = z.enum(['draft', 'active', 'archived']);
export const diagramSessionModeSchema = z.enum(['view', 'edit']);
export const diagramSessionStatusSchema = z.enum([
    'active',
    'idle',
    'stale',
    'closed',
]);

const diagramRecordSchema = z.record(z.string(), z.unknown());
const optionalDescriptionSchema = z
    .string()
    .trim()
    .max(500)
    .nullable()
    .optional();
const searchQuerySchema = z.string().trim().max(120).optional();

export const diagramDocumentSchema = z.object({
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
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
});

export type DiagramDocument = z.infer<typeof diagramDocumentSchema>;

export const diagramDocumentVersionSchema = z.object({
    version: z.number().int().min(1),
    updatedAt: z.coerce.date(),
    lastSavedSessionId: z.string().trim().min(1).nullable(),
    lastSavedByUserId: z.string().trim().min(1).nullable(),
});

export type DiagramDocumentVersion = z.infer<
    typeof diagramDocumentVersionSchema
>;

export const diagramRealtimeStrategySchema = z.enum([
    'optimistic-http',
    'event-stream',
    'websocket-ready',
]);

export const diagramRealtimeCapabilitySchema = z.object({
    strategy: diagramRealtimeStrategySchema,
    liveSyncEnabled: z.boolean(),
    eventsEndpoint: z.string().trim().min(1).nullable(),
    websocketEndpoint: z.string().trim().min(1).nullable(),
    websocketProtocol: z.string().trim().min(1).nullable(),
    sessionEndpoint: z.string().trim().min(1),
});

export type DiagramRealtimeCapability = z.infer<
    typeof diagramRealtimeCapabilitySchema
>;

export const diagramParticipantCursorSchema = z.object({
    x: z.number(),
    y: z.number(),
    updatedAt: z.coerce.date(),
});

export type DiagramParticipantCursor = z.infer<
    typeof diagramParticipantCursorSchema
>;

export const diagramPresenceParticipantSchema = z.object({
    sessionId: z.string().trim().min(1),
    userId: z.string().trim().min(1).nullable(),
    displayName: z.string().trim().min(1),
    email: z.string().trim().email().nullable(),
    initials: z.string().trim().min(1).max(4),
    color: z.string().trim().min(1),
    mode: diagramSessionModeSchema,
    joinedAt: z.coerce.date(),
    lastSeenAt: z.coerce.date(),
    cursor: diagramParticipantCursorSchema.nullable(),
});

export type DiagramPresenceParticipant = z.infer<
    typeof diagramPresenceParticipantSchema
>;

export const diagramPresenceStateSchema = z.object({
    participants: z.array(diagramPresenceParticipantSchema),
});

export type DiagramPresenceState = z.infer<typeof diagramPresenceStateSchema>;

export const diagramCollaborationStateSchema = z.object({
    document: diagramDocumentVersionSchema,
    realtime: diagramRealtimeCapabilitySchema,
    activeSessionCount: z.number().int().min(0),
    presence: diagramPresenceStateSchema,
});

export type DiagramCollaborationState = z.infer<
    typeof diagramCollaborationStateSchema
>;

export const diagramSessionTransportSchema = z.object({
    syncEndpoint: z.string().trim().min(1),
    heartbeatEndpoint: z.string().trim().min(1),
    eventsEndpoint: z.string().trim().min(1).nullable(),
    websocketEndpoint: z.string().trim().min(1).nullable(),
    websocketProtocol: z.string().trim().min(1).nullable(),
});

export type DiagramSessionTransport = z.infer<
    typeof diagramSessionTransportSchema
>;

export const diagramEditSessionSchema = z.object({
    id: z.string().trim().min(1),
    diagramId: z.string().trim().min(1),
    ownerUserId: z.string().trim().min(1).nullable(),
    mode: diagramSessionModeSchema,
    status: diagramSessionStatusSchema,
    clientId: z.string().trim().min(1).nullable(),
    userAgent: z.string().trim().min(1).nullable(),
    baseVersion: z.number().int().min(1),
    lastSeenDocumentVersion: z.number().int().min(1),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
    lastHeartbeatAt: z.coerce.date(),
    closedAt: z.coerce.date().nullable(),
    transport: diagramSessionTransportSchema,
});

export type DiagramEditSession = z.infer<typeof diagramEditSessionSchema>;

export const createCollectionSchema = z.object({
    name: z.string().trim().min(1).max(120),
    description: optionalDescriptionSchema,
});

export const updateCollectionSchema = z
    .object({
        name: z.string().trim().min(1).max(120).optional(),
        description: optionalDescriptionSchema,
    })
    .refine((value) => Object.keys(value).length > 0, {
        message: 'At least one collection field must be updated.',
    });

export const createProjectSchema = z.object({
    name: z.string().trim().min(1).max(120),
    description: optionalDescriptionSchema,
    collectionId: z.string().trim().min(1).nullable().optional(),
    visibility: projectVisibilitySchema.optional(),
    status: projectStatusSchema.optional(),
});

export const updateProjectSchema = z
    .object({
        name: z.string().trim().min(1).max(120).optional(),
        description: optionalDescriptionSchema,
        collectionId: z.string().trim().min(1).nullable().optional(),
        visibility: projectVisibilitySchema.optional(),
        status: projectStatusSchema.optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
        message: 'At least one project field must be updated.',
    });

export const updateSharingSchema = z.object({
    scope: sharingScopeSchema,
    access: sharingAccessSchema,
    expiresAt: z.string().trim().datetime().nullable().optional(),
    rotateLinkToken: z.coerce.boolean().optional().default(false),
});

export const sharingUserMutationSchema = z.object({
    userId: z.string().trim().min(1),
    access: sharingAccessSchema,
});

export const sharingUserAccessUpdateSchema = z.object({
    access: sharingAccessSchema,
});

export const listProjectsQuerySchema = z
    .object({
        search: searchQuerySchema,
        collectionId: z.string().trim().min(1).optional(),
        unassigned: z.coerce.boolean().optional().default(false),
    })
    .refine((value) => !(value.collectionId && value.unassigned), {
        message: 'collectionId and unassigned filters cannot be combined.',
    });

export const listProjectDiagramsQuerySchema = z.object({
    search: searchQuerySchema,
    view: z.enum(['summary', 'full']).optional().default('summary'),
});

export const upsertDiagramSchema = z.object({
    projectId: z.string().trim().min(1),
    ownerUserId: z.string().trim().min(1).optional(),
    visibility: diagramVisibilitySchema.optional(),
    status: diagramStatusSchema.optional(),
    description: optionalDescriptionSchema,
    sessionId: z.string().trim().min(1).optional(),
    baseVersion: z.number().int().min(1).optional(),
    diagram: diagramDocumentSchema,
});

export const updateDiagramSchema = z
    .object({
        projectId: z.string().trim().min(1).optional(),
        ownerUserId: z.string().trim().min(1).optional(),
        name: z.string().trim().min(1).max(120).optional(),
        description: z.string().trim().max(500).nullable().optional(),
        visibility: diagramVisibilitySchema.optional(),
        status: diagramStatusSchema.optional(),
        sessionId: z.string().trim().min(1).optional(),
        baseVersion: z.number().int().min(1).optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
        message: 'At least one diagram field must be updated.',
    });

export const createDiagramSessionSchema = z.object({
    mode: diagramSessionModeSchema.optional().default('edit'),
    clientId: z.string().trim().min(1).max(120).optional(),
    userAgent: z.string().trim().min(1).max(500).optional(),
});

export const updateDiagramSessionPresenceSchema = z.object({
    cursor: z
        .object({
            x: z.number(),
            y: z.number(),
        })
        .nullable()
        .optional(),
});

export const updateDiagramSessionSchema = z
    .object({
        status: diagramSessionStatusSchema.optional(),
        lastSeenDocumentVersion: z.number().int().min(1).optional(),
        close: z.coerce.boolean().optional().default(false),
    })
    .refine(
        (value) =>
            value.close ||
            value.status !== undefined ||
            value.lastSeenDocumentVersion !== undefined,
        {
            message: 'At least one diagram session field must be updated.',
        }
    );
