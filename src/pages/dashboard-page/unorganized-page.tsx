import React from 'react';
import { LibraryPage } from './library-page';
import { useLibraryCatalog } from '@/features/dashboard/hooks/use-library-catalog';

export const UnorganizedPage: React.FC = () => {
    const catalog = useLibraryCatalog({
        view: 'unorganized',
    });

    return (
        <LibraryPage
            emptyState={{
                title: 'Nothing is unorganized',
                description:
                    'Projects without a collection show up here, so it is easy to spot work that still needs a home.',
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
            subtitle="Catch projects that have not been assigned to a collection yet and keep the saved workspace tidy as your library grows."
            title="Unorganized"
        />
    );
};
