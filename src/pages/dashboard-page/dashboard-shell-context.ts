import type { SavedCollection } from '@/context/storage-context/storage-context';

export interface DashboardShellContextValue {
    collections: SavedCollection[];
    loadingCollections: boolean;
    refreshCollections: () => Promise<void>;
}
