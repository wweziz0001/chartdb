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
    createdAt: string;
    updatedAt: string;
    diagram: DiagramDto;
}

export interface PersistedSharingSettings {
    scope: SharingScope;
    access: SharingAccess;
    sharePath: string | null;
    shareUpdatedAt: string | null;
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
}

export interface PersistedSharingUpdateInput {
    scope: SharingScope;
    access: SharingAccess;
    rotateLinkToken?: boolean;
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
