import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
    authContext,
    type AuthContextValue,
} from '@/features/auth/context/auth-context';
import { AdminRouteGuard } from '@/features/admin/components/admin-route-guard';
import { AdminPage } from './admin-page';
import {
    adminClient,
    type AdminOverviewResponse,
} from '@/features/admin/api/admin-client';

vi.mock('@/features/admin/api/admin-client', () => ({
    adminClient: {
        getOverview: vi.fn(),
    },
}));

const mockedAdminClient = vi.mocked(adminClient);

const createAuthValue = (
    overrides?: Partial<AuthContextValue>
): AuthContextValue => ({
    ready: true,
    serverReachable: true,
    mode: 'password',
    enabled: true,
    authenticated: true,
    user: {
        id: 'admin-1',
        email: 'admin@example.com',
        displayName: 'Ada Admin',
        authProvider: 'local',
        status: 'active',
        role: 'admin',
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

const overviewFixture: AdminOverviewResponse = {
    generatedAt: '2026-03-23T12:00:00.000Z',
    metrics: {
        users: 2,
        admins: 1,
        collections: 1,
        projects: 3,
        diagrams: 4,
        activeSessions: 2,
        sharingRecords: 2,
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
        total: 3,
        byStatus: {
            active: 2,
            archived: 1,
            deleted: 0,
        },
        byVisibility: {
            private: 1,
            workspace: 2,
            public: 0,
        },
    },
    diagrams: {
        total: 4,
        byStatus: {
            draft: 1,
            active: 3,
            archived: 0,
        },
        byVisibility: {
            private: 1,
            workspace: 2,
            public: 1,
        },
    },
    sharing: {
        supported: true,
        totalRecords: 2,
    },
};

beforeEach(() => {
    mockedAdminClient.getOverview.mockReset();
});

describe('admin page', () => {
    it('redirects non-admin users away from protected admin content', () => {
        render(
            <MemoryRouter initialEntries={['/admin']}>
                <authContext.Provider
                    value={createAuthValue({
                        user: {
                            ...createAuthValue().user!,
                            role: 'member',
                        },
                    })}
                >
                    <Routes>
                        <Route path="/" element={<div>dashboard home</div>} />
                        <Route
                            path="/admin"
                            element={
                                <AdminRouteGuard>
                                    <div>secret admin content</div>
                                </AdminRouteGuard>
                            }
                        />
                    </Routes>
                </authContext.Provider>
            </MemoryRouter>
        );

        expect(screen.getByText('dashboard home')).toBeInTheDocument();
        expect(
            screen.queryByText('secret admin content')
        ).not.toBeInTheDocument();
    });

    it('loads and renders the admin overview', async () => {
        mockedAdminClient.getOverview.mockResolvedValue(overviewFixture);

        render(
            <MemoryRouter>
                <authContext.Provider value={createAuthValue()}>
                    <AdminPage />
                </authContext.Provider>
            </MemoryRouter>
        );

        expect(await screen.findByText('Grace Hopper')).toBeInTheDocument();
        expect(screen.getByText('ChartDB admin dashboard')).toBeInTheDocument();
        expect(screen.getByText('Platform health')).toBeInTheDocument();
        expect(screen.getByText('Project inventory')).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: 'Users' })
        ).toBeInTheDocument();
        expect(screen.getByText('OIDC')).toBeInTheDocument();
        expect(mockedAdminClient.getOverview).toHaveBeenCalledTimes(1);
    });
});
