import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Trash2 } from 'lucide-react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/card/card';
import { useLibraryCatalog } from '@/features/dashboard/hooks/use-library-catalog';

const dateFormatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
});

export const TrashPage: React.FC = () => {
    const { collections, error, loading, projects } = useLibraryCatalog({
        view: 'trash',
    });

    return (
        <div className="space-y-6">
            <Helmet>
                <title>ChartDB - Trash</title>
            </Helmet>

            <section className="rounded-[28px] border border-stone-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(245,245,244,0.92))] p-6 shadow-sm dark:border-stone-800/80 dark:bg-[linear-gradient(135deg,rgba(28,25,23,0.94),rgba(12,10,9,0.9))]">
                <div className="space-y-3">
                    <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                        Trash
                    </h1>
                    <p className="max-w-3xl text-sm leading-6 text-stone-600 dark:text-stone-300 sm:text-base">
                        Deleted projects stay visible here so you can audit what
                        has been removed from the main library without losing
                        context about its saved diagram inventory.
                    </p>
                </div>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
                <Card className="border-stone-200/80 bg-white/80 shadow-sm dark:border-stone-800/80 dark:bg-stone-900/80">
                    <CardHeader className="pb-3">
                        <CardDescription>Deleted projects</CardDescription>
                        <CardTitle className="text-3xl">
                            {projects.length}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 text-sm text-stone-500">
                        Currently held in trash.
                    </CardContent>
                </Card>
                <Card className="border-stone-200/80 bg-white/80 shadow-sm dark:border-stone-800/80 dark:bg-stone-900/80">
                    <CardHeader className="pb-3">
                        <CardDescription>Contained diagrams</CardDescription>
                        <CardTitle className="text-3xl">
                            {projects.reduce(
                                (count, project) =>
                                    count + project.diagramCount,
                                0
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 text-sm text-stone-500">
                        Diagram summaries still available for audit.
                    </CardContent>
                </Card>
                <Card className="border-stone-200/80 bg-white/80 shadow-sm dark:border-stone-800/80 dark:bg-stone-900/80">
                    <CardHeader className="pb-3">
                        <CardDescription>
                            Collections in workspace
                        </CardDescription>
                        <CardTitle className="text-3xl">
                            {collections.length}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 text-sm text-stone-500">
                        Active collection taxonomy remains intact.
                    </CardContent>
                </Card>
            </section>

            {error ? (
                <Card className="border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                    <CardHeader>
                        <CardTitle>Trash unavailable</CardTitle>
                        <CardDescription className="text-current">
                            {error}
                        </CardDescription>
                    </CardHeader>
                </Card>
            ) : null}

            {loading ? (
                <Card className="border-dashed border-stone-200/80 bg-white/70 dark:border-stone-800/80 dark:bg-stone-900/70">
                    <CardContent className="py-16 text-center text-sm uppercase tracking-[0.24em] text-stone-400">
                        Loading trash
                    </CardContent>
                </Card>
            ) : null}

            {!loading && projects.length === 0 ? (
                <Card className="border-dashed border-stone-200/80 bg-white/70 dark:border-stone-800/80 dark:bg-stone-900/70">
                    <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                        <div className="rounded-2xl bg-stone-100 p-4 dark:bg-stone-800">
                            <Trash2 className="size-6 text-stone-500" />
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-xl font-semibold">
                                Trash is empty
                            </h2>
                            <p className="max-w-xl text-sm leading-6 text-stone-500">
                                Deleted projects will appear here when they are
                                removed from the main library.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            ) : null}

            {!loading && projects.length > 0 ? (
                <section className="grid gap-4 xl:grid-cols-2">
                    {projects.map((project) => (
                        <Card
                            key={project.id}
                            className="border-stone-200/80 bg-white/85 shadow-sm dark:border-stone-800/80 dark:bg-stone-900/80"
                        >
                            <CardHeader>
                                <CardTitle>{project.name}</CardTitle>
                                <CardDescription>
                                    {project.description ??
                                        'Deleted project retained for workspace audit.'}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-3 text-sm text-stone-600 dark:text-stone-300 sm:grid-cols-2">
                                <div>{project.diagramCount} diagrams</div>
                                <div>{project.visibility} visibility</div>
                                <div>{project.access} access</div>
                                <div>
                                    Updated{' '}
                                    {dateFormatter.format(project.updatedAt)}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </section>
            ) : null}
        </div>
    );
};
