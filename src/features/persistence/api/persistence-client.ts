import { requestJson } from '@/lib/api/request';
import type { Diagram } from '@/lib/domain/diagram';
import type {
    ChartDbBackupArchive,
    ExportBackupRequest,
    ImportBackupResult,
} from '@/lib/project-backup/project-backup-format';

export type SharingScope = 'private' | 'authenticated' | 'link';
export type SharingAccess = 'view' | 'edit';
export type ResourceAccess = 'view' | 'edit' | 'owner';

export interface PersistedUserSummary {
    id: string;
    email: string | null;
    displayName: string;
    authProvider: 'placeholder' | 'local' | 'oidc';
    status: 'provisioned' | 'active' | 'disabled';
    role: 'member' | 'admin';
    ownershipScope: 'personal' | 'workspace';
    createdAt: string;
    updatedAt: string;
}

export interface PersistedProjectSummary {
    id: string;
    name: string;
    description: string | null;
    collectionId: string | null;
    ownerUserId: string | null;
    visibility: 'private' | 'workspace' | 'public';
    status: 'active' | 'archived' | 'deleted';
    sharingScope: SharingScope;
    sharingAccess: SharingAccess;
    access: ResourceAccess;
    createdAt: string;
    updatedAt: string;
    diagramCount: number;
}

export interface PersistedCollectionSummary {
    id: string;
    name: string;
    description: string | null;
    ownerUserId: string | null;
    createdAt: string;
    updatedAt: string;
    projectCount: number;
    diagramCount: number;
}

export type DiagramDto = Omit<Diagram, 'createdAt' | 'updatedAt'> & {
    createdAt: string;
    updatedAt: string;
};

export interface PersistedDiagramSummary {
    id: string;
    projectId: string;
    ownerUserId: string | null;
    name: string;
    description: string | null;
    databaseType: string;
    databaseEdition: string | null;
    visibility: 'private' | 'workspace' | 'public';
    status: 'draft' | 'active' | 'archived';
    sharingScope: SharingScope;
    sharingAccess: SharingAccess;
    access: ResourceAccess;
    tableCount: number;
    collaboration?: PersistedDiagramCollaborationState;
    createdAt: string;
    updatedAt: string;
}

export interface PersistedDiagramRecord {
    id: string;
    projectId: string;
    ownerUserId: string | null;
    name: string;
    description: string | null;
    databaseType: string;
    databaseEdition: string | null;
    visibility: 'private' | 'workspace' | 'public';
    status: 'draft' | 'active' | 'archived';
    sharingScope: SharingScope;
    sharingAccess: SharingAccess;
    access: ResourceAccess;
    collaboration: PersistedDiagramCollaborationState;
    createdAt: string;
    updatedAt: string;
    diagram: DiagramDto;
}

export interface PersistedDiagramDocumentState {
    version: number;
    updatedAt: string;
    lastSavedSessionId: string | null;
    lastSavedByUserId: string | null;
}

export interface PersistedDiagramRealtimeCapability {
    strategy: 'optimistic-http' | 'event-stream' | 'websocket-ready';
    liveSyncEnabled: boolean;
    eventsEndpoint: string | null;
    websocketEndpoint: string | null;
    websocketProtocol: string | null;
    sessionEndpoint: string;
}

export interface PersistedDiagramCollaborationState {
    document: PersistedDiagramDocumentState;
    realtime: PersistedDiagramRealtimeCapability;
    activeSessionCount: number;
}

export interface PersistedDiagramSessionTransport {
    syncEndpoint: string;
    heartbeatEndpoint: string;
    eventsEndpoint: string | null;
    websocketEndpoint: string | null;
    websocketProtocol: string | null;
}

export interface PersistedDiagramEditSession {
    id: string;
    diagramId: string;
    ownerUserId: string | null;
    mode: 'view' | 'edit';
    status: 'active' | 'idle' | 'stale' | 'closed';
    clientId: string | null;
    userAgent: string | null;
    baseVersion: number;
    lastSeenDocumentVersion: number;
    createdAt: string;
    updatedAt: string;
    lastHeartbeatAt: string;
    closedAt: string | null;
    transport: PersistedDiagramSessionTransport;
}

export interface PersistedDiagramSessionResponse {
    session: PersistedDiagramEditSession;
    collaboration: PersistedDiagramCollaborationState;
}

export interface PersistedDiagramCollaborationEvent {
    type: 'snapshot' | 'session' | 'document';
    diagramId: string;
    sessionId: string | null;
    emittedAt: string;
    collaboration: PersistedDiagramCollaborationState;
}

export interface PersistedSharingSettings {
    owner: PersistedUserSummary | null;
    people: PersistedSharingParticipant[];
    generalAccess: PersistedGeneralAccessSettings;
}

export interface PersistedSharingParticipant {
    user: PersistedUserSummary;
    access: SharingAccess;
    createdAt: string;
    updatedAt: string;
}

export interface PersistedGeneralAccessSettings {
    scope: SharingScope;
    access: SharingAccess;
    sharePath: string | null;
    shareUpdatedAt: string | null;
    expiresAt: string | null;
    isExpired: boolean;
}

export interface SharedProjectResponse {
    project: PersistedProjectSummary;
    items: PersistedDiagramSummary[];
}

export interface PersistedProjectInput {
    name: string;
    description?: string | null;
    collectionId?: string | null;
    visibility?: 'private' | 'workspace' | 'public';
    status?: 'active' | 'archived' | 'deleted';
}

export interface PersistedCollectionInput {
    name: string;
    description?: string | null;
}

export interface PersistedDiagramUpdateInput {
    projectId?: string;
    ownerUserId?: string;
    name?: string;
    description?: string | null;
    visibility?: 'private' | 'workspace' | 'public';
    status?: 'draft' | 'active' | 'archived';
    sessionId?: string;
    baseVersion?: number;
}

export interface PersistedSharingUpdateInput {
    scope: SharingScope;
    access: SharingAccess;
    expiresAt?: string | null;
    rotateLinkToken?: boolean;
}

export interface PersistedSharingUserInput {
    userId: string;
    access: SharingAccess;
}

export interface PersistedCreateDiagramSessionInput {
    mode?: 'view' | 'edit';
    clientId?: string;
    userAgent?: string;
}

export interface PersistedUpdateDiagramSessionInput {
    status?: 'active' | 'idle' | 'stale' | 'closed';
    lastSeenDocumentVersion?: number;
    close?: boolean;
}

export interface BootstrapResponse {
    user: PersistedUserSummary;
    defaultProject: PersistedProjectSummary;
}

export const serializeDiagram = (diagram: Diagram): DiagramDto => ({
    ...diagram,
    createdAt: diagram.createdAt.toISOString(),
    updatedAt: diagram.updatedAt.toISOString(),
});

export const deserializeDiagram = (diagram: DiagramDto): Diagram => ({
    ...diagram,
    createdAt: new Date(diagram.createdAt),
    updatedAt: new Date(diagram.updatedAt),
});

export const deserializeProjectSummary = (
    project: PersistedProjectSummary
): PersistedProjectSummary => ({
    ...project,
});

export const deserializeCollectionSummary = (
    collection: PersistedCollectionSummary
): PersistedCollectionSummary => ({
    ...collection,
});

export const deserializeDiagramSummary = (
    diagram: PersistedDiagramSummary
): PersistedDiagramSummary => ({
    ...diagram,
});

export const persistenceClient = {
    exportBackup: async (payload: ExportBackupRequest) =>
        requestJson<ChartDbBackupArchive>('/api/backups/export', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
    importBackup: async (payload: ChartDbBackupArchive) =>
        requestJson<{ import: ImportBackupResult }>('/api/backups/import', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
    bootstrap: async () => requestJson<BootstrapResponse>('/api/app/bootstrap'),
    listCollections: async () =>
        requestJson<{ items: PersistedCollectionSummary[] }>(
            '/api/collections'
        ),
    createCollection: async (payload: PersistedCollectionInput) =>
        requestJson<{ collection: PersistedCollectionSummary }>(
            '/api/collections',
            {
                method: 'POST',
                body: JSON.stringify(payload),
            }
        ),
    updateCollection: async (
        collectionId: string,
        payload: Partial<PersistedCollectionInput>
    ) =>
        requestJson<{ collection: PersistedCollectionSummary }>(
            `/api/collections/${collectionId}`,
            {
                method: 'PATCH',
                body: JSON.stringify(payload),
            }
        ),
    deleteCollection: async (collectionId: string) =>
        requestJson<{ ok: boolean }>(`/api/collections/${collectionId}`, {
            method: 'DELETE',
        }),
    listProjects: async (options?: {
        search?: string;
        collectionId?: string;
        unassigned?: boolean;
    }) => {
        const params = new URLSearchParams();
        if (options?.search) {
            params.set('search', options.search);
        }
        if (options?.collectionId) {
            params.set('collectionId', options.collectionId);
        }
        if (options?.unassigned) {
            params.set('unassigned', 'true');
        }

        return requestJson<{ items: PersistedProjectSummary[] }>(
            `/api/projects${params.size > 0 ? `?${params.toString()}` : ''}`
        );
    },
    createProject: async (payload: PersistedProjectInput) =>
        requestJson<{ project: PersistedProjectSummary }>('/api/projects', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
    updateProject: async (
        projectId: string,
        payload: Partial<PersistedProjectInput>
    ) =>
        requestJson<{ project: PersistedProjectSummary }>(
            `/api/projects/${projectId}`,
            {
                method: 'PATCH',
                body: JSON.stringify(payload),
            }
        ),
    deleteProject: async (projectId: string) =>
        requestJson<{ ok: boolean }>(`/api/projects/${projectId}`, {
            method: 'DELETE',
        }),
    searchShareableUsers: async (query: string) => {
        const params = new URLSearchParams();
        const normalizedQuery = query.trim();
        if (normalizedQuery) {
            params.set('query', normalizedQuery);
        }

        return requestJson<{ items: PersistedUserSummary[] }>(
            `/api/sharing/users${params.size > 0 ? `?${params.toString()}` : ''}`
        );
    },
    getProjectSharing: async (projectId: string) =>
        requestJson<{ sharing: PersistedSharingSettings }>(
            `/api/projects/${projectId}/sharing`
        ),
    updateProjectSharing: async (
        projectId: string,
        payload: PersistedSharingUpdateInput
    ) =>
        requestJson<{ sharing: PersistedSharingSettings }>(
            `/api/projects/${projectId}/sharing`,
            {
                method: 'PATCH',
                body: JSON.stringify(payload),
            }
        ),
    addProjectSharingUser: async (
        projectId: string,
        payload: PersistedSharingUserInput
    ) =>
        requestJson<{ sharing: PersistedSharingSettings }>(
            `/api/projects/${projectId}/sharing/people`,
            {
                method: 'POST',
                body: JSON.stringify(payload),
            }
        ),
    updateProjectSharingUser: async (
        projectId: string,
        userId: string,
        payload: Pick<PersistedSharingUserInput, 'access'>
    ) =>
        requestJson<{ sharing: PersistedSharingSettings }>(
            `/api/projects/${projectId}/sharing/people/${userId}`,
            {
                method: 'PATCH',
                body: JSON.stringify(payload),
            }
        ),
    removeProjectSharingUser: async (projectId: string, userId: string) =>
        requestJson<{ sharing: PersistedSharingSettings }>(
            `/api/projects/${projectId}/sharing/people/${userId}`,
            {
                method: 'DELETE',
            }
        ),
    listProjectDiagrams: async (
        projectId: string,
        options?: { view?: 'summary' | 'full'; search?: string }
    ) => {
        const params = new URLSearchParams();
        if (options?.view) {
            params.set('view', options.view);
        }
        if (options?.search) {
            params.set('search', options.search);
        }

        return requestJson<{
            items: Array<PersistedDiagramSummary | PersistedDiagramRecord>;
        }>(
            `/api/projects/${projectId}/diagrams${
                params.size > 0 ? `?${params.toString()}` : ''
            }`
        );
    },
    getDiagram: async (diagramId: string) =>
        requestJson<PersistedDiagramRecord>(`/api/diagrams/${diagramId}`),
    updateDiagram: async (
        diagramId: string,
        payload: PersistedDiagramUpdateInput
    ) =>
        requestJson<{ diagram: PersistedDiagramRecord }>(
            `/api/diagrams/${diagramId}`,
            {
                method: 'PATCH',
                body: JSON.stringify(payload),
            }
        ),
    upsertDiagram: async (
        diagramId: string,
        payload: {
            projectId: string;
            ownerUserId?: string;
            visibility?: 'private' | 'workspace' | 'public';
            status?: 'draft' | 'active' | 'archived';
            description?: string;
            sessionId?: string;
            baseVersion?: number;
            diagram: DiagramDto;
        }
    ) =>
        requestJson<{ diagram: PersistedDiagramRecord }>(
            `/api/diagrams/${diagramId}`,
            {
                method: 'PUT',
                body: JSON.stringify(payload),
            }
        ),
    createDiagramSession: async (
        diagramId: string,
        payload: PersistedCreateDiagramSessionInput
    ) =>
        requestJson<PersistedDiagramSessionResponse>(
            `/api/diagrams/${diagramId}/sessions`,
            {
                method: 'POST',
                body: JSON.stringify(payload),
            }
        ),
    getDiagramSession: async (diagramId: string, sessionId: string) =>
        requestJson<PersistedDiagramSessionResponse>(
            `/api/diagrams/${diagramId}/sessions/${sessionId}`
        ),
    updateDiagramSession: async (
        diagramId: string,
        sessionId: string,
        payload: PersistedUpdateDiagramSessionInput
    ) =>
        requestJson<PersistedDiagramSessionResponse>(
            `/api/diagrams/${diagramId}/sessions/${sessionId}`,
            {
                method: 'PATCH',
                body: JSON.stringify(payload),
            }
        ),
    deleteDiagram: async (diagramId: string) =>
        requestJson<{ ok: boolean }>(`/api/diagrams/${diagramId}`, {
            method: 'DELETE',
        }),
    getDiagramSharing: async (diagramId: string) =>
        requestJson<{ sharing: PersistedSharingSettings }>(
            `/api/diagrams/${diagramId}/sharing`
        ),
    updateDiagramSharing: async (
        diagramId: string,
        payload: PersistedSharingUpdateInput
    ) =>
        requestJson<{ sharing: PersistedSharingSettings }>(
            `/api/diagrams/${diagramId}/sharing`,
            {
                method: 'PATCH',
                body: JSON.stringify(payload),
            }
        ),
    addDiagramSharingUser: async (
        diagramId: string,
        payload: PersistedSharingUserInput
    ) =>
        requestJson<{ sharing: PersistedSharingSettings }>(
            `/api/diagrams/${diagramId}/sharing/people`,
            {
                method: 'POST',
                body: JSON.stringify(payload),
            }
        ),
    updateDiagramSharingUser: async (
        diagramId: string,
        userId: string,
        payload: Pick<PersistedSharingUserInput, 'access'>
    ) =>
        requestJson<{ sharing: PersistedSharingSettings }>(
            `/api/diagrams/${diagramId}/sharing/people/${userId}`,
            {
                method: 'PATCH',
                body: JSON.stringify(payload),
            }
        ),
    removeDiagramSharingUser: async (diagramId: string, userId: string) =>
        requestJson<{ sharing: PersistedSharingSettings }>(
            `/api/diagrams/${diagramId}/sharing/people/${userId}`,
            {
                method: 'DELETE',
            }
        ),
    getSharedProject: async (projectId: string, shareToken: string) =>
        requestJson<SharedProjectResponse>(
            `/api/shared/projects/${projectId}/${shareToken}`
        ),
    getSharedProjectDiagram: async (
        projectId: string,
        shareToken: string,
        diagramId: string
    ) =>
        requestJson<PersistedDiagramRecord>(
            `/api/shared/projects/${projectId}/${shareToken}/diagrams/${diagramId}`
        ),
    getSharedDiagram: async (diagramId: string, shareToken: string) =>
        requestJson<PersistedDiagramRecord>(
            `/api/shared/diagrams/${diagramId}/${shareToken}`
        ),
};
