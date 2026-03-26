import React from 'react';
import { LibraryPage } from './library-page';
import { useLibraryCatalog } from '@/features/dashboard/hooks/use-library-catalog';
import { useAuth } from '@/features/auth/hooks/use-auth';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/card/card';

export const SharedWithMePage: React.FC = () => {
    const { enabled, user } = useAuth();
    const catalog = useLibraryCatalog({
        view: 'shared',
        enabled: enabled && Boolean(user),
    });

    if (!enabled || !user) {
        return (
            <Card className="border-stone-200/80 bg-white/80 dark:border-stone-800/80 dark:bg-stone-900/80">
                <CardHeader>
                    <CardTitle>Shared access appears here</CardTitle>
                    <CardDescription>
                        Enable authenticated accounts to surface projects and
                        diagrams shared by other workspace members.
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-sm leading-6 text-stone-500">
                    This deployment is currently running without signed-in
                    sharing context.
                </CardContent>
            </Card>
        );
    }

    return (
        <LibraryPage
            emptyState={{
                title: 'Nothing shared with you yet',
                description:
                    'Shared diagrams and projects from other workspace members will appear here as soon as access is granted.',
            }}
            error={catalog.error}
            items={catalog.items}
            loading={catalog.loading}
            metrics={{
                collections: catalog.collections.length,
                diagrams: catalog.items.length,
                projects: catalog.projects.length,
            }}
            search={catalog.search}
            setSearch={catalog.setSearch}
            sort={catalog.sort}
            setSort={catalog.setSort}
            subtitle="Review diagrams that were shared into your workspace, including items you can view or edit without owning the underlying project."
            title="Shared with Me"
        />
    );
};
