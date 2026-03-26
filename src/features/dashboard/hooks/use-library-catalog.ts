import { useAuth } from '@/features/auth/hooks/use-auth';
import { useStorage } from '@/hooks/use-storage';
import type {
    SavedCollection,
    SavedDiagram,
    SavedProject,
} from '@/context/storage-context/storage-context';
import {
    useCallback,
    useDeferredValue,
    useEffect,
    useMemo,
    useState,
} from 'react';

export type LibraryView =
    | 'all'
    | 'shared'
    | 'unorganized'
    | 'trash'
    | 'collection';

export type LibrarySort = 'updated' | 'created' | 'name' | 'tables';

export interface LibraryDiagramItem {
    diagram: SavedDiagram;
    project: SavedProject;
    collection: SavedCollection | null;
    isShared: boolean;
    isOwnedByCurrentUser: boolean;
}

export const normalizeSearchTerm = (value: string) => {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
};

const matchesSharedResource = (
    project: SavedProject,
    diagram: SavedDiagram,
    userId?: string
) => {
    if (!userId) {
        return false;
    }

    return (
        project.access !== 'owner' ||
        diagram.access !== 'owner' ||
        project.ownerUserId !== userId ||
        diagram.ownerUserId !== userId
    );
};

const sortItems = (items: LibraryDiagramItem[], sort: LibrarySort) => {
    return [...items].sort((left, right) => {
        if (sort === 'name') {
            return left.diagram.name.localeCompare(right.diagram.name);
        }

        if (sort === 'created') {
            return (
                right.diagram.createdAt.getTime() -
                left.diagram.createdAt.getTime()
            );
        }

        if (sort === 'tables') {
            return right.diagram.tableCount - left.diagram.tableCount;
        }

        return (
            right.diagram.updatedAt.getTime() - left.diagram.updatedAt.getTime()
        );
    });
};

const filterProjectsForView = (
    projects: SavedProject[],
    view: LibraryView,
    collectionId?: string
) => {
    return projects.filter((project) => {
        if (view === 'trash') {
            return project.status === 'deleted';
        }

        if (project.status === 'deleted') {
            return false;
        }

        if (view === 'unorganized') {
            return project.collectionId === null;
        }

        if (view === 'collection') {
            return project.collectionId === collectionId;
        }

        return true;
    });
};

export const useLibraryCatalog = (options: {
    view: LibraryView;
    collectionId?: string;
    enabled?: boolean;
}) => {
    const { listCollections, listProjects, listProjectDiagrams } = useStorage();
    const { user } = useAuth();
    const [collections, setCollections] = useState<SavedCollection[]>([]);
    const [projects, setProjects] = useState<SavedProject[]>([]);
    const [items, setItems] = useState<LibraryDiagramItem[]>([]);
    const [search, setSearch] = useState('');
    const deferredSearch = useDeferredValue(search);
    const [sort, setSort] = useState<LibrarySort>('updated');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const normalizedSearch = useMemo(
        () => normalizeSearchTerm(deferredSearch),
        [deferredSearch]
    );

    const loadCatalog = useCallback(async () => {
        if (options.enabled === false) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const projectQuery =
                options.view === 'unorganized'
                    ? {
                          search: normalizedSearch,
                          unassigned: true,
                      }
                    : options.view === 'collection' && options.collectionId
                      ? {
                            search: normalizedSearch,
                            collectionId: options.collectionId,
                        }
                      : {
                            search: normalizedSearch,
                        };

            const [nextCollections, nextProjects] = await Promise.all([
                listCollections(),
                listProjects(projectQuery),
            ]);

            const collectionById = new Map(
                nextCollections.map((collection) => [collection.id, collection])
            );
            const visibleProjects = filterProjectsForView(
                nextProjects,
                options.view,
                options.collectionId
            );
            const projectDiagrams = await Promise.all(
                visibleProjects.map(async (project) => ({
                    project,
                    diagrams: await listProjectDiagrams(project.id, {
                        search: normalizedSearch,
                    }),
                }))
            );

            const nextItems = projectDiagrams
                .flatMap(({ project, diagrams }) =>
                    diagrams.map((diagram) => {
                        const isShared = matchesSharedResource(
                            project,
                            diagram,
                            user?.id
                        );

                        return {
                            diagram,
                            project,
                            collection: project.collectionId
                                ? (collectionById.get(project.collectionId) ??
                                  null)
                                : null,
                            isShared,
                            isOwnedByCurrentUser:
                                project.ownerUserId === user?.id &&
                                diagram.ownerUserId === user?.id,
                        };
                    })
                )
                .filter((item) =>
                    options.view === 'shared' ? item.isShared : true
                );

            setCollections(nextCollections);
            setProjects(
                options.view === 'shared'
                    ? visibleProjects.filter((project) =>
                          projectDiagrams.some(
                              ({ project: currentProject, diagrams }) =>
                                  currentProject.id === project.id &&
                                  diagrams.some((diagram) =>
                                      matchesSharedResource(
                                          project,
                                          diagram,
                                          user?.id
                                      )
                                  )
                          )
                      )
                    : visibleProjects
            );
            setItems(sortItems(nextItems, sort));
        } catch (nextError) {
            console.error(nextError);
            setError('Unable to load this library view right now.');
        } finally {
            setLoading(false);
        }
    }, [
        listCollections,
        listProjectDiagrams,
        listProjects,
        normalizedSearch,
        options.collectionId,
        options.enabled,
        options.view,
        sort,
        user?.id,
    ]);

    useEffect(() => {
        void loadCatalog();
    }, [loadCatalog]);

    return {
        collections,
        deferredSearch,
        error,
        items,
        loading,
        normalizedSearch,
        projects,
        refresh: loadCatalog,
        search,
        setSearch,
        sort,
        setSort,
    };
};
