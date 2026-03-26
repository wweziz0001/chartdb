import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { FolderKanban, Search } from 'lucide-react';
import { Link, useOutletContext } from 'react-router-dom';
import { Input } from '@/components/input/input';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/card/card';
import { Button } from '@/components/button/button';
import type { DashboardShellContextValue } from './dashboard-shell-context';
import { normalizeSearchTerm } from '@/features/dashboard/hooks/use-library-catalog';

export const CollectionsPage: React.FC = () => {
    const { collections, loadingCollections } =
        useOutletContext<DashboardShellContextValue>();
    const [search, setSearch] = useState('');
    const normalizedSearch = useMemo(
        () => normalizeSearchTerm(search)?.toLowerCase(),
        [search]
    );

    const filteredCollections = useMemo(() => {
        if (!normalizedSearch) {
            return collections;
        }

        return collections.filter((collection) =>
            [collection.name, collection.description]
                .filter(Boolean)
                .some((value) =>
                    value?.toLowerCase().includes(normalizedSearch)
                )
        );
    }, [collections, normalizedSearch]);

    return (
        <div className="space-y-6">
            <Helmet>
                <title>ChartDB - Collections</title>
            </Helmet>

            <section className="rounded-[28px] border border-stone-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(245,245,244,0.92))] p-6 shadow-sm dark:border-stone-800/80 dark:bg-[linear-gradient(135deg,rgba(28,25,23,0.94),rgba(12,10,9,0.9))]">
                <div className="space-y-3">
                    <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                        Collections
                    </h1>
                    <p className="max-w-3xl text-sm leading-6 text-stone-600 dark:text-stone-300 sm:text-base">
                        Collections give your saved projects a durable
                        information architecture, making it easier to browse
                        teams, domains, and long-lived schema work.
                    </p>
                </div>
            </section>

            <section className="rounded-[24px] border border-stone-200/80 bg-white/80 p-4 shadow-sm dark:border-stone-800/80 dark:bg-stone-900/80">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
                    <Input
                        aria-label="Collections search"
                        className="h-11 rounded-xl border-stone-200 bg-white pl-10 dark:border-stone-700 dark:bg-stone-950/70"
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search collections"
                        value={search}
                    />
                </div>
            </section>

            {loadingCollections ? (
                <Card className="border-dashed border-stone-200/80 bg-white/70 dark:border-stone-800/80 dark:bg-stone-900/70">
                    <CardContent className="py-16 text-center text-sm uppercase tracking-[0.24em] text-stone-400">
                        Loading collections
                    </CardContent>
                </Card>
            ) : null}

            {!loadingCollections && filteredCollections.length === 0 ? (
                <Card className="border-dashed border-stone-200/80 bg-white/70 dark:border-stone-800/80 dark:bg-stone-900/70">
                    <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                        <div className="rounded-2xl bg-stone-100 p-4 dark:bg-stone-800">
                            <FolderKanban className="size-6 text-stone-500" />
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-xl font-semibold">
                                No collections found
                            </h2>
                            <p className="max-w-xl text-sm leading-6 text-stone-500">
                                Collections created through the saved project
                                flows will show up here automatically.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            ) : null}

            {!loadingCollections && filteredCollections.length > 0 ? (
                <section className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                    {filteredCollections.map((collection) => (
                        <Card
                            key={collection.id}
                            className="border-stone-200/80 bg-white/85 shadow-sm dark:border-stone-800/80 dark:bg-stone-900/80"
                        >
                            <CardHeader>
                                <CardTitle>{collection.name}</CardTitle>
                                <CardDescription>
                                    {collection.description ??
                                        'Use this collection to group related ChartDB projects.'}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-3 text-sm text-stone-600 dark:text-stone-300 sm:grid-cols-2">
                                    <div>
                                        {collection.projectCount} projects
                                    </div>
                                    <div>
                                        {collection.diagramCount} diagrams
                                    </div>
                                </div>
                                <Button
                                    asChild
                                    variant="outline"
                                    className="w-full rounded-xl border-stone-200 bg-transparent text-stone-700 hover:bg-stone-100 hover:text-stone-950 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800 dark:hover:text-stone-50"
                                >
                                    <Link to={`/collections/${collection.id}`}>
                                        Open collection
                                    </Link>
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </section>
            ) : null}
        </div>
    );
};
