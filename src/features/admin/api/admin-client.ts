import { requestJson } from '@/lib/api/request';

export interface AdminOverviewUser {
    id: string;
    email: string | null;
    displayName: string;
    authProvider: 'placeholder' | 'local' | 'oidc';
    status: 'provisioned' | 'active' | 'disabled';
    role: 'member' | 'admin';
    ownershipScope: 'personal' | 'workspace';
    createdAt: string;
    updatedAt: string;
    lastLoginAt: string | null;
}

export interface AdminOverviewResponse {
    generatedAt: string;
    metrics: {
        users: number;
        admins: number;
        collections: number;
        projects: number;
        diagrams: number;
        activeSessions: number;
        sharingRecords: number | null;
    };
    platform: {
        environment: string;
        authMode: 'disabled' | 'password' | 'oidc';
        bootstrapRequired: boolean;
        adminInitialized: boolean;
        oidcConfigured: boolean;
        persistence: {
            app: 'sqlite';
            schemaSync: 'sqlite';
        };
    };
    users: {
        total: number;
        admins: number;
        byStatus: Record<'provisioned' | 'active' | 'disabled', number>;
        items: AdminOverviewUser[];
    };
    projects: {
        total: number;
        byStatus: Record<'active' | 'archived' | 'deleted', number>;
        byVisibility: Record<'private' | 'workspace' | 'public', number>;
    };
    diagrams: {
        total: number;
        byStatus: Record<'draft' | 'active' | 'archived', number>;
        byVisibility: Record<'private' | 'workspace' | 'public', number>;
    };
    sharing: {
        supported: boolean;
        totalRecords: number | null;
    };
}

export const adminClient = {
    getOverview: async () =>
        requestJson<AdminOverviewResponse>('/api/admin/overview'),
};
