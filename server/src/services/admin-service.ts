import type { ServerEnv } from '../config/env.js';
import type {
    AppRepository,
    AppUserAuthRecord,
    DiagramRecord,
    ProjectRecord,
} from '../repositories/app-repository.js';
import type { AuthService } from './auth-service.js';

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

const countProjectStatus = (
    projects: ProjectRecord[],
    status: ProjectRecord['status']
) => projects.filter((project) => project.status === status).length;

const countProjectVisibility = (
    projects: ProjectRecord[],
    visibility: ProjectRecord['visibility']
) => projects.filter((project) => project.visibility === visibility).length;

const countDiagramStatus = (
    diagrams: DiagramRecord[],
    status: DiagramRecord['status']
) => diagrams.filter((diagram) => diagram.status === status).length;

const countDiagramVisibility = (
    diagrams: DiagramRecord[],
    visibility: DiagramRecord['visibility']
) => diagrams.filter((diagram) => diagram.visibility === visibility).length;

const countUserStatus = (
    users: AppUserAuthRecord[],
    status: AppUserAuthRecord['status']
) => users.filter((user) => user.status === status).length;

const mapUser = (user: AppUserAuthRecord): AdminOverviewUser => ({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    authProvider: user.authProvider,
    status: user.status,
    role: user.role,
    ownershipScope: user.ownershipScope,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt,
});

export class AdminService {
    constructor(
        private readonly repository: AppRepository,
        private readonly authService: AuthService,
        private readonly env: ServerEnv
    ) {}

    getOverview(): AdminOverviewResponse {
        const generatedAt = new Date().toISOString();
        const users = this.repository.listUserAuthRecords();
        const projects = this.repository.listProjects();
        const diagrams = this.repository.listDiagrams();
        const collections = this.repository.listCollections();
        const bootstrap = this.authService.getBootstrapStatus();

        return {
            generatedAt,
            metrics: {
                users: users.length,
                admins: users.filter((user) => user.role === 'admin').length,
                collections: collections.length,
                projects: projects.length,
                diagrams: diagrams.length,
                activeSessions:
                    this.repository.countActiveSessions(generatedAt),
                sharingRecords: null,
            },
            platform: {
                environment: this.env.nodeEnv,
                authMode: this.env.authMode,
                bootstrapRequired: bootstrap.required,
                adminInitialized: bootstrap.completed,
                oidcConfigured:
                    Boolean(this.env.oidcIssuer) &&
                    Boolean(this.env.oidcClientId) &&
                    Boolean(this.env.oidcRedirectUrl),
                persistence: {
                    app: 'sqlite',
                    schemaSync: 'sqlite',
                },
            },
            users: {
                total: users.length,
                admins: users.filter((user) => user.role === 'admin').length,
                byStatus: {
                    provisioned: countUserStatus(users, 'provisioned'),
                    active: countUserStatus(users, 'active'),
                    disabled: countUserStatus(users, 'disabled'),
                },
                items: users.map(mapUser),
            },
            projects: {
                total: projects.length,
                byStatus: {
                    active: countProjectStatus(projects, 'active'),
                    archived: countProjectStatus(projects, 'archived'),
                    deleted: countProjectStatus(projects, 'deleted'),
                },
                byVisibility: {
                    private: countProjectVisibility(projects, 'private'),
                    workspace: countProjectVisibility(projects, 'workspace'),
                    public: countProjectVisibility(projects, 'public'),
                },
            },
            diagrams: {
                total: diagrams.length,
                byStatus: {
                    draft: countDiagramStatus(diagrams, 'draft'),
                    active: countDiagramStatus(diagrams, 'active'),
                    archived: countDiagramStatus(diagrams, 'archived'),
                },
                byVisibility: {
                    private: countDiagramVisibility(diagrams, 'private'),
                    workspace: countDiagramVisibility(diagrams, 'workspace'),
                    public: countDiagramVisibility(diagrams, 'public'),
                },
            },
            sharing: {
                supported: false,
                totalRecords: null,
            },
        };
    }
}
