import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/button/button';
import {
    persistenceClient,
    type PersistedDiagramSummary,
    type PersistedProjectSummary,
} from '@/features/persistence/api/persistence-client';

export const SharedProjectPage: React.FC = () => {
    const { projectId, shareToken } = useParams<{
        projectId: string;
        shareToken: string;
    }>();
    const [project, setProject] = useState<PersistedProjectSummary | null>(
        null
    );
    const [diagrams, setDiagrams] = useState<PersistedDiagramSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            if (!projectId || !shareToken) {
                setError('Shared project link is incomplete.');
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);
            try {
                const response = await persistenceClient.getSharedProject(
                    projectId,
                    shareToken
                );
                if (!cancelled) {
                    setProject(response.project);
                    setDiagrams(response.items);
                }
            } catch (caughtError) {
                if (!cancelled) {
                    setError(
                        caughtError instanceof Error
                            ? caughtError.message
                            : 'Unable to load the shared project.'
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void run();

        return () => {
            cancelled = true;
        };
    }, [projectId, shareToken]);

    const title = useMemo(() => project?.name ?? 'Shared project', [project]);

    if (loading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-background">
                <div className="text-sm text-muted-foreground">
                    Loading shared project...
                </div>
            </main>
        );
    }

    if (error || !project || !projectId || !shareToken) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
                <div className="max-w-md space-y-2">
                    <h1 className="text-xl font-semibold">
                        Shared project unavailable
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {error ??
                            'This shared project link is missing, expired, or no longer available.'}
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-background px-4 py-8 md:px-8">
            <section className="mx-auto flex max-w-5xl flex-col gap-6">
                <header className="space-y-2">
                    <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
                        Shared project
                    </p>
                    <h1 className="text-3xl font-semibold">{title}</h1>
                    <p className="max-w-2xl text-sm text-muted-foreground">
                        {project.description ??
                            'Open individual diagrams from this shared project in a read-only viewer.'}
                    </p>
                </header>

                <div className="rounded-xl border bg-card">
                    {diagrams.length === 0 ? (
                        <div className="px-6 py-10 text-sm text-muted-foreground">
                            No shared diagrams are available in this project.
                        </div>
                    ) : (
                        <div className="divide-y">
                            {diagrams.map((diagram) => (
                                <div
                                    key={diagram.id}
                                    className="flex flex-col gap-3 px-6 py-4 md:flex-row md:items-center md:justify-between"
                                >
                                    <div className="min-w-0">
                                        <div className="truncate font-medium">
                                            {diagram.name}
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            {diagram.description ??
                                                `${diagram.databaseType}${
                                                    diagram.databaseEdition
                                                        ? ` ${diagram.databaseEdition}`
                                                        : ''
                                                }`}
                                        </div>
                                    </div>

                                    <Button asChild size="sm">
                                        <Link
                                            to={`/shared/projects/${projectId}/${shareToken}/diagrams/${diagram.id}`}
                                        >
                                            Open diagram
                                        </Link>
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </main>
    );
};
