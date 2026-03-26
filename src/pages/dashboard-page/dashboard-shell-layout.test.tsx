import React from 'react';
import {
    RouterProvider,
    createMemoryRouter,
    type RouteObject,
} from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { HelmetProvider } from 'react-helmet-async';
import {
    authContext,
    type AuthContextValue,
} from '@/features/auth/context/auth-context';
import { ConfigContext } from '@/context/config-context/config-context';
import { LocalConfigContext } from '@/context/local-config-context/local-config-context';
import { useStorage } from '@/hooks/use-storage';
import { DashboardShellFrame } from './dashboard-shell-layout';
import { AllDiagramsPage } from './all-diagrams-page';
import { SharedWithMePage } from './shared-with-me-page';
import { UnorganizedPage } from './unorganized-page';
import { CollectionsPage } from './collections-page';
import { CollectionDetailPage } from './collection-detail-page';
import { TrashPage } from './trash-page';
import { ProfilePage } from './profile-page';
import { SettingsPage } from './settings-page';
import { AdminRouteGuard } from '@/features/admin/components/admin-route-guard';
import { AdminPage } from '@/pages/admin-page/admin-page';
import {
    adminClient,
    type AdminOverviewResponse,
} from '@/features/admin/api/admin-client';

vi.mock('@/hooks/use-storage', () => ({
    useStorage: vi.fn(),
}));

vi.mock('@/features/admin/api/admin-client', () => ({
    adminClient: {
        getOverview: vi.fn(),
    },
}));

const mockedUseStorage = vi.mocked(useStorage);
const mockedAdminClient = vi.mocked(adminClient);

const collections = [
    {
        id: 'collection-1',
        name: 'Product Core',
        description: 'Main application schemas',
        ownerUserId: 'user-1',
        projectCount: 1,
        diagramCount: 1,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-01T00:00:00.000Z'),
    },
];

const projects = [
    {
        id: 'project-1',
        name: 'Warehouse',
        description: 'Primary inventory domain',
        collectionId: 'collection-1',
        ownerUserId: 'user-1',
        visibility: 'workspace' as const,
        status: 'active' as const,
        sharingScope: 'authenticated' as const,
        sharingAccess: 'edit' as const,
        access: 'owner' as const,
        diagramCount: 1,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-20T00:00:00.000Z'),
    },
    {
        id: 'project-2',
        name: 'Shared CRM',
        description: 'Shared customer model',
        collectionId: null,
        ownerUserId: 'user-2',
        visibility: 'workspace' as const,
        status: 'active' as const,
        sharingScope: 'authenticated' as const,
        sharingAccess: 'view' as const,
        access: 'view' as const,
        diagramCount: 1,
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        updatedAt: new Date('2026-03-19T00:00:00.000Z'),
    },
    {
        id: 'project-3',
        name: 'Scratchpad',
        description: 'Needs a collection',
        collectionId: null,
        ownerUserId: 'user-1',
        visibility: 'private' as const,
        status: 'active' as const,
        sharingScope: 'private' as const,
        sharingAccess: 'view' as const,
        access: 'owner' as const,
        diagramCount: 1,
        createdAt: new Date('2026-01-03T00:00:00.000Z'),
        updatedAt: new Date('2026-03-18T00:00:00.000Z'),
    },
    {
        id: 'project-4',
        name: 'Retired ERP',
        description: 'Deleted project sample',
        collectionId: null,
        ownerUserId: 'user-1',
        visibility: 'private' as const,
        status: 'deleted' as const,
        sharingScope: 'private' as const,
        sharingAccess: 'view' as const,
        access: 'owner' as const,
        diagramCount: 1,
        createdAt: new Date('2026-01-04T00:00:00.000Z'),
        updatedAt: new Date('2026-03-17T00:00:00.000Z'),
    },
];

const diagramsByProjectId = {
    'project-1': [
        {
            id: 'diagram-1',
            projectId: 'project-1',
            ownerUserId: 'user-1',
            name: 'Warehouse ERD',
            description: 'Inventory tables',
            databaseType: 'postgresql',
            databaseEdition: null,
            visibility: 'workspace' as const,
            status: 'active' as const,
            sharingScope: 'authenticated' as const,
            sharingAccess: 'edit' as const,
            access: 'owner' as const,
            tableCount: 14,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedAt: new Date('2026-03-20T00:00:00.000Z'),
        },
    ],
    'project-2': [
        {
            id: 'diagram-2',
            projectId: 'project-2',
            ownerUserId: 'user-2',
            name: 'CRM Share',
            description: 'Shared contact schema',
            databaseType: 'mysql',
            databaseEdition: null,
            visibility: 'workspace' as const,
            status: 'active' as const,
            sharingScope: 'authenticated' as const,
            sharingAccess: 'view' as const,
            access: 'view' as const,
            tableCount: 8,
            createdAt: new Date('2026-01-02T00:00:00.000Z'),
            updatedAt: new Date('2026-03-19T00:00:00.000Z'),
        },
    ],
    'project-3': [
        {
            id: 'diagram-3',
            projectId: 'project-3',
            ownerUserId: 'user-1',
            name: 'Scratchpad ERD',
            description: 'Unorganized project diagram',
            databaseType: 'sqlite',
            databaseEdition: null,
            visibility: 'private' as const,
            status: 'draft' as const,
            sharingScope: 'private' as const,
            sharingAccess: 'view' as const,
            access: 'owner' as const,
            tableCount: 3,
            createdAt: new Date('2026-01-03T00:00:00.000Z'),
            updatedAt: new Date('2026-03-18T00:00:00.000Z'),
        },
    ],
    'project-4': [
        {
            id: 'diagram-4',
            projectId: 'project-4',
            ownerUserId: 'user-1',
            name: 'Retired ERP ERD',
            description: 'Trashed project diagram',
            databaseType: 'sqlserver',
            databaseEdition: null,
            visibility: 'private' as const,
            status: 'archived' as const,
            sharingScope: 'private' as const,
            sharingAccess: 'view' as const,
            access: 'owner' as const,
            tableCount: 21,
            createdAt: new Date('2026-01-04T00:00:00.000Z'),
            updatedAt: new Date('2026-03-17T00:00:00.000Z'),
        },
    ],
} as const;

const overviewFixture: AdminOverviewResponse = {
    generatedAt: '2026-03-23T12:00:00.000Z',
    metrics: {
        users: 2,
        admins: 1,
        collections: 1,
        projects: 4,
        diagrams: 4,
        activeSessions: 2,
        sharingRecords: 1,
    },
    platform: {
        environment: 'test',
        authMode: 'password',
        bootstrapRequired: false,
        adminInitialized: true,
        oidcConfigured: false,
        persistence: {
            app: 'sqlite',
            schemaSync: 'sqlite',
        },
    },
    users: {
        total: 2,
        admins: 1,
        byStatus: {
            provisioned: 0,
            active: 2,
            disabled: 0,
        },
        items: [
            {
                id: 'admin-1',
                email: 'admin@example.com',
                displayName: 'Ada Admin',
                authProvider: 'local',
                status: 'active',
                role: 'admin',
                ownershipScope: 'workspace',
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-03-22T00:00:00.000Z',
                lastLoginAt: '2026-03-23T11:45:00.000Z',
            },
            {
                id: 'member-1',
                email: 'member@example.com',
                displayName: 'Grace Hopper',
                authProvider: 'oidc',
                status: 'active',
                role: 'member',
                ownershipScope: 'workspace',
                createdAt: '2026-02-01T00:00:00.000Z',
                updatedAt: '2026-03-22T00:00:00.000Z',
                lastLoginAt: null,
            },
        ],
    },
    projects: {
        total: 4,
        byStatus: {
            active: 3,
            archived: 0,
            deleted: 1,
        },
        byVisibility: {
            private: 2,
            workspace: 2,
            public: 0,
        },
    },
    diagrams: {
        total: 4,
        byStatus: {
            draft: 1,
            active: 2,
            archived: 1,
        },
        byVisibility: {
            private: 2,
            workspace: 2,
            public: 0,
        },
    },
    sharing: {
        supported: true,
        totalRecords: 1,
    },
};

const createAuthValue = (
    overrides?: Partial<AuthContextValue>
): AuthContextValue => ({
    ready: true,
    serverReachable: true,
    mode: 'password',
    enabled: true,
    authenticated: true,
    user: {
        id: 'user-1',
        email: 'member@example.com',
        displayName: 'Mia Member',
        authProvider: 'local',
        status: 'active',
        role: 'member',
        ownershipScope: 'workspace',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
    },
    bootstrap: {
        required: false,
        completed: true,
        setupCodeRequired: false,
    },
    bootstrapAdmin: vi.fn(),
    login: vi.fn(),
    startOidcLogin: vi.fn(),
    logout: vi.fn(),
    refreshSession: vi.fn(),
    ...overrides,
});

const routes: RouteObject[] = [
    {
        path: '/',
        element: <DashboardShellFrame />,
        children: [
            {
                index: true,
                element: <AllDiagramsPage />,
            },
            {
                path: 'shared-with-me',
                element: <SharedWithMePage />,
            },
            {
                path: 'unorganized',
                element: <UnorganizedPage />,
            },
            {
                path: 'collections',
                element: <CollectionsPage />,
            },
            {
                path: 'collections/:collectionId',
                element: <CollectionDetailPage />,
            },
            {
                path: 'trash',
                element: <TrashPage />,
            },
            {
                path: 'profile',
                element: <ProfilePage />,
            },
            {
                path: 'settings',
                element: <SettingsPage />,
            },
            {
                path: 'admin',
                element: (
                    <AdminRouteGuard>
                        <AdminPage />
                    </AdminRouteGuard>
                ),
            },
        ],
    },
];

const filterProjects = (search?: string) => {
    const normalized = search?.trim().toLowerCase();

    return projects.filter((project) => {
        if (!normalized) {
            return true;
        }

        return [project.name, project.description]
            .filter(Boolean)
            .some((value) => value?.toLowerCase().includes(normalized));
    });
};

const renderShell = (
    authValue: AuthContextValue,
    initialEntries: string[] = ['/']
) => {
    const router = createMemoryRouter(routes, {
        initialEntries,
    });

    return render(
        <HelmetProvider>
            <authContext.Provider value={authValue}>
                <ConfigContext.Provider
                    value={{
                        config: {
                            defaultDiagramId: 'diagram-1',
                        },
                        updateConfig: vi.fn(),
                    }}
                >
                    <LocalConfigContext.Provider
                        value={{
                            theme: 'system',
                            setTheme: vi.fn(),
                            scrollAction: 'pan',
                            setScrollAction: vi.fn(),
                            showDBViews: true,
                            setShowDBViews: vi.fn(),
                            showCardinality: true,
                            setShowCardinality: vi.fn(),
                            showFieldAttributes: true,
                            setShowFieldAttributes: vi.fn(),
                            githubRepoOpened: false,
                            setGithubRepoOpened: vi.fn(),
                            starUsDialogLastOpen: 0,
                            setStarUsDialogLastOpen: vi.fn(),
                            showMiniMapOnCanvas: true,
                            setShowMiniMapOnCanvas: vi.fn(),
                        }}
                    >
                        <RouterProvider router={router} />
                    </LocalConfigContext.Provider>
                </ConfigContext.Provider>
            </authContext.Provider>
        </HelmetProvider>
    );
};

beforeEach(() => {
    mockedAdminClient.getOverview.mockReset();
    mockedAdminClient.getOverview.mockResolvedValue(overviewFixture);
    mockedUseStorage.mockReturnValue({
        listCollections: vi.fn(async () => collections),
        listProjects: vi.fn(
            async (options?: {
                search?: string;
                collectionId?: string;
                unassigned?: boolean;
            }) => {
                let nextProjects = filterProjects(options?.search);

                if (options?.collectionId) {
                    nextProjects = nextProjects.filter(
                        (project) =>
                            project.collectionId === options.collectionId
                    );
                }

                if (options?.unassigned) {
                    nextProjects = nextProjects.filter(
                        (project) => project.collectionId === null
                    );
                }

                return nextProjects;
            }
        ),
        listProjectDiagrams: vi.fn(
            async (projectId: string, options?: { search?: string }) => {
                const normalized = options?.search?.trim().toLowerCase();
                const diagrams = [
                    ...(diagramsByProjectId[
                        projectId as keyof typeof diagramsByProjectId
                    ] ?? []),
                ];

                if (!normalized) {
                    return diagrams;
                }

                return diagrams.filter((diagram) =>
                    [diagram.name, diagram.description]
                        .filter(Boolean)
                        .some((value) =>
                            value?.toLowerCase().includes(normalized)
                        )
                );
            }
        ),
    } as never);
});

describe('dashboard shell layout', () => {
    it('lands authenticated users on the main library page', async () => {
        renderShell(createAuthValue());

        expect(
            await screen.findByRole('heading', { name: 'All Diagrams' })
        ).toBeInTheDocument();
        expect(screen.getByText('Warehouse ERD')).toBeInTheDocument();
    });

    it('shows standard sidebar tabs for members and hides the admin tab', async () => {
        renderShell(createAuthValue());

        expect(
            await screen.findByRole('link', { name: 'All Diagrams' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: 'Shared with Me' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: 'Unorganized' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: 'Collections' })
        ).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Trash' })).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: 'Profile' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: 'Settings' })
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('link', { name: 'Admin' })
        ).not.toBeInTheDocument();
    });

    it('shows the admin tab for admin users', async () => {
        renderShell(
            createAuthValue({
                user: {
                    ...createAuthValue().user!,
                    id: 'admin-1',
                    email: 'admin@example.com',
                    displayName: 'Ada Admin',
                    role: 'admin',
                },
            })
        );

        expect(
            await screen.findByRole('link', { name: 'Admin' })
        ).toBeInTheDocument();
    });

    it('redirects non-admin users away from the admin route', async () => {
        renderShell(createAuthValue(), ['/admin']);

        expect(
            await screen.findByRole('heading', { name: 'All Diagrams' })
        ).toBeInTheDocument();
        expect(
            screen.queryByText('ChartDB admin dashboard')
        ).not.toBeInTheDocument();
    });

    it('allows admin users to open the admin route', async () => {
        renderShell(
            createAuthValue({
                user: {
                    ...createAuthValue().user!,
                    id: 'admin-1',
                    email: 'admin@example.com',
                    displayName: 'Ada Admin',
                    role: 'admin',
                },
            }),
            ['/admin']
        );

        expect(
            await screen.findByText('ChartDB admin dashboard')
        ).toBeInTheDocument();
        expect(mockedAdminClient.getOverview).toHaveBeenCalledTimes(1);
    });

    it('navigates sidebar links to working authenticated pages and updates the active state', async () => {
        const user = userEvent.setup();

        renderShell(createAuthValue());

        await user.click(
            await screen.findByRole('link', { name: 'Shared with Me' })
        );
        expect(
            await screen.findByRole('heading', { name: 'Shared with Me' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: 'Shared with Me' })
        ).toHaveAttribute('aria-current', 'page');

        await user.click(screen.getByRole('link', { name: 'Trash' }));
        expect(
            await screen.findByRole('heading', { name: 'Trash' })
        ).toBeInTheDocument();
        expect(screen.getByText('Retired ERP')).toBeInTheDocument();

        await user.click(screen.getByRole('link', { name: 'Settings' }));
        expect(
            await screen.findByRole('heading', { name: 'Settings' })
        ).toBeInTheDocument();

        await user.click(screen.getByRole('link', { name: 'Profile' }));
        expect(
            await screen.findByRole('heading', { name: 'Profile' })
        ).toBeInTheDocument();

        await user.click(screen.getByRole('link', { name: 'Collections' }));
        expect(
            await screen.findByRole('heading', { name: 'Collections' })
        ).toBeInTheDocument();

        await user.click(screen.getByRole('link', { name: /Product Core/ }));
        await waitFor(() =>
            expect(
                screen.getByRole('heading', { name: 'Product Core' })
            ).toBeInTheDocument()
        );
        expect(screen.getByText('Warehouse ERD')).toBeInTheDocument();
    });
});
