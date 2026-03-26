import React from 'react';
import type { RouteObject } from 'react-router-dom';
import { createBrowserRouter } from 'react-router-dom';
import type { TemplatePageLoaderData } from './pages/template-page/template-page';
import type { TemplatesPageLoaderData } from './pages/templates-page/templates-page';
import { getTemplatesAndAllTags } from './templates-data/template-utils';

export const routes: RouteObject[] = [
    {
        path: '',
        async lazy() {
            const { DashboardShellLayout } =
                await import('./pages/dashboard-page/dashboard-shell-layout');

            return {
                element: <DashboardShellLayout />,
            };
        },
        children: [
            {
                index: true,
                async lazy() {
                    const { AllDiagramsPage } =
                        await import('./pages/dashboard-page/all-diagrams-page');

                    return {
                        element: <AllDiagramsPage />,
                    };
                },
            },
            {
                path: 'shared-with-me',
                async lazy() {
                    const { SharedWithMePage } =
                        await import('./pages/dashboard-page/shared-with-me-page');

                    return {
                        element: <SharedWithMePage />,
                    };
                },
            },
            {
                path: 'unorganized',
                async lazy() {
                    const { UnorganizedPage } =
                        await import('./pages/dashboard-page/unorganized-page');

                    return {
                        element: <UnorganizedPage />,
                    };
                },
            },
            {
                path: 'collections',
                async lazy() {
                    const { CollectionsPage } =
                        await import('./pages/dashboard-page/collections-page');

                    return {
                        element: <CollectionsPage />,
                    };
                },
            },
            {
                path: 'collections/:collectionId',
                async lazy() {
                    const { CollectionDetailPage } =
                        await import('./pages/dashboard-page/collection-detail-page');

                    return {
                        element: <CollectionDetailPage />,
                    };
                },
            },
            {
                path: 'trash',
                async lazy() {
                    const { TrashPage } =
                        await import('./pages/dashboard-page/trash-page');

                    return {
                        element: <TrashPage />,
                    };
                },
            },
            {
                path: 'profile',
                async lazy() {
                    const { ProfilePage } =
                        await import('./pages/dashboard-page/profile-page');

                    return {
                        element: <ProfilePage />,
                    };
                },
            },
            {
                path: 'settings',
                async lazy() {
                    const { SettingsPage } =
                        await import('./pages/dashboard-page/settings-page');

                    return {
                        element: <SettingsPage />,
                    };
                },
            },
            {
                path: 'admin',
                async lazy() {
                    const { AdminRouteGuard } =
                        await import('./features/admin/components/admin-route-guard');
                    const { AdminPage } =
                        await import('./pages/admin-page/admin-page');

                    return {
                        element: (
                            <AdminRouteGuard>
                                <AdminPage />
                            </AdminRouteGuard>
                        ),
                    };
                },
            },
        ],
    },
    ...['workspace', 'diagrams/:diagramId'].map((path) => ({
        path,
        async lazy() {
            const { EditorPage } =
                await import('./pages/editor-page/editor-page');

            return {
                element: <EditorPage />,
            };
        },
    })),
    {
        path: 'shared/projects/:projectId/:shareToken',
        async lazy() {
            const { SharedProjectPage } =
                await import('./pages/shared-project-page/shared-project-page');
            return {
                element: <SharedProjectPage />,
            };
        },
    },
    {
        path: 'shared/projects/:projectId/:shareToken/diagrams/:diagramId',
        async lazy() {
            const { SharedProjectDiagramPage } =
                await import('./pages/shared-project-page/shared-project-diagram-page');
            return {
                element: <SharedProjectDiagramPage />,
            };
        },
    },
    {
        path: 'shared/diagrams/:diagramId/:shareToken',
        async lazy() {
            const { SharedDiagramPage } =
                await import('./pages/shared-project-page/shared-diagram-page');
            return {
                element: <SharedDiagramPage />,
            };
        },
    },
    {
        path: 'examples',
        async lazy() {
            const { ExamplesPage } =
                await import('./pages/examples-page/examples-page');
            return {
                element: <ExamplesPage />,
            };
        },
    },
    {
        id: 'templates',
        path: 'templates',
        async lazy() {
            const { TemplatesPage } =
                await import('./pages/templates-page/templates-page');
            return {
                element: <TemplatesPage />,
            };
        },

        loader: async (): Promise<TemplatesPageLoaderData> => {
            const { tags, templates } = await getTemplatesAndAllTags();

            return {
                allTags: tags,
                templates,
            };
        },
    },
    {
        id: 'templates_featured',
        path: 'templates/featured',
        async lazy() {
            const { TemplatesPage } =
                await import('./pages/templates-page/templates-page');
            return {
                element: <TemplatesPage />,
            };
        },
        loader: async (): Promise<TemplatesPageLoaderData> => {
            const { tags, templates } = await getTemplatesAndAllTags({
                featured: true,
            });

            return {
                allTags: tags,
                templates,
            };
        },
    },
    {
        id: 'templates_tags',
        path: 'templates/tags/:tag',
        async lazy() {
            const { TemplatesPage } =
                await import('./pages/templates-page/templates-page');
            return {
                element: <TemplatesPage />,
            };
        },
        loader: async ({ params }): Promise<TemplatesPageLoaderData> => {
            const { tags, templates } = await getTemplatesAndAllTags({
                tag: params.tag?.replace(/-/g, ' '),
            });

            return {
                allTags: tags,
                templates,
            };
        },
    },
    {
        id: 'templates_templateSlug',
        path: 'templates/:templateSlug',
        async lazy() {
            const { TemplatePage } =
                await import('./pages/template-page/template-page');
            return {
                element: <TemplatePage />,
            };
        },
        loader: async ({ params }): Promise<TemplatePageLoaderData> => {
            const { templates } =
                await import('./templates-data/templates-data');
            return {
                template: templates.find(
                    (template) => template.slug === params.templateSlug
                ),
            };
        },
    },
    {
        id: 'templates_load',
        path: 'templates/clone/:templateSlug',
        async lazy() {
            const { CloneTemplatePage } =
                await import('./pages/clone-template-page/clone-template-page');
            return {
                element: <CloneTemplatePage />,
            };
        },
        loader: async ({ params }) => {
            const { templates } =
                await import('./templates-data/templates-data');
            return {
                template: templates.find(
                    (template) => template.slug === params.templateSlug
                ),
            };
        },
    },
    {
        path: '*',
        async lazy() {
            const { NotFoundPage } =
                await import('./pages/not-found-page/not-found-page');
            return {
                element: <NotFoundPage />,
            };
        },
    },
];

export const createAppRouter = () => createBrowserRouter(routes);

export const router = createAppRouter();
