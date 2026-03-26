import React from 'react';
import { useParams } from 'react-router-dom';
import { LibraryPage } from './library-page';
import { useLibraryCatalog } from '@/features/dashboard/hooks/use-library-catalog';
import { useOutletContext } from 'react-router-dom';
import type { DashboardShellContextValue } from './dashboard-shell-context';

export const CollectionDetailPage: React.FC = () => {
    const { collectionId } = useParams<{ collectionId: string }>();
    const { collections } = useOutletContext<DashboardShellContextValue>();
    const collection = collections.find((item) => item.id === collectionId);
    const catalog = useLibraryCatalog({
        view: 'collection',
        collectionId,
    });

    return (
        <LibraryPage
            emptyState={{
                title: 'No diagrams in this collection',
                description:
                    'Projects saved into this collection will surface here as soon as diagrams are attached to them.',
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
            subtitle={
                collection?.description ??
                'Review the diagrams that belong to this collection and keep related schema work close together.'
            }
            title={collection?.name ?? 'Collection'}
        />
    );
};
