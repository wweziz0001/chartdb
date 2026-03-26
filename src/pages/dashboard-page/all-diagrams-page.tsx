import React from 'react';
import { LibraryPage } from './library-page';
import { useLibraryCatalog } from '@/features/dashboard/hooks/use-library-catalog';

export const AllDiagramsPage: React.FC = () => {
    const {
        collections,
        error,
        items,
        loading,
        projects,
        search,
        setSearch,
        sort,
        setSort,
    } = useLibraryCatalog({
        view: 'all',
    });

    return (
        <LibraryPage
            emptyState={{
                title: 'No saved diagrams yet',
                description:
                    'Create a new diagram or import an existing schema to turn this library into your main ChartDB workspace.',
            }}
            error={error}
            items={items}
            loading={loading}
            metrics={{
                collections: collections.length,
                diagrams: items.length,
                projects: projects.length,
            }}
            search={search}
            setSearch={setSearch}
            sort={sort}
            setSort={setSort}
            subtitle="Browse every saved diagram you can access, keep projects organized, and jump back into schema work from one intentional landing page."
            title="All Diagrams"
        />
    );
};
