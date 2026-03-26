import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { ShieldCheck, UserRound } from 'lucide-react';
import { Badge } from '@/components/badge/badge';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/card/card';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useStorage } from '@/hooks/use-storage';

export const ProfilePage: React.FC = () => {
    const { user, enabled, authenticated, mode } = useAuth();
    const { listCollections, listProjects } = useStorage();
    const [projectCount, setProjectCount] = useState(0);
    const [collectionCount, setCollectionCount] = useState(0);

    useEffect(() => {
        const loadSummary = async () => {
            const [collections, projects] = await Promise.all([
                listCollections(),
                listProjects(),
            ]);

            setCollectionCount(collections.length);
            setProjectCount(
                projects.filter((project) => project.status !== 'deleted')
                    .length
            );
        };

        void loadSummary();
    }, [listCollections, listProjects]);

    return (
        <div className="space-y-6">
            <Helmet>
                <title>ChartDB - Profile</title>
            </Helmet>

            <section className="rounded-[28px] border border-stone-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(245,245,244,0.92))] p-6 shadow-sm dark:border-stone-800/80 dark:bg-[linear-gradient(135deg,rgba(28,25,23,0.94),rgba(12,10,9,0.9))]">
                <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex size-16 items-center justify-center rounded-3xl bg-stone-950 text-stone-50 dark:bg-amber-300 dark:text-stone-950">
                            <UserRound className="size-7" />
                        </div>
                        <div className="space-y-2">
                            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                                Profile
                            </h1>
                            <p className="text-sm leading-6 text-stone-600 dark:text-stone-300">
                                Account identity, self-hosted access mode, and
                                the workspace scope currently attached to this
                                ChartDB session.
                            </p>
                        </div>
                    </div>
                    <Badge
                        variant="outline"
                        className="w-fit border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
                    >
                        {enabled
                            ? 'Authenticated deployment'
                            : 'Local workspace'}
                    </Badge>
                </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.5fr,1fr]">
                <Card className="border-stone-200/80 bg-white/80 shadow-sm dark:border-stone-800/80 dark:bg-stone-900/80">
                    <CardHeader>
                        <CardTitle>Identity</CardTitle>
                        <CardDescription>
                            The current user context returned by the ChartDB
                            authentication session.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 text-sm text-stone-600 dark:text-stone-300 sm:grid-cols-2">
                        <div>
                            <div className="text-xs uppercase tracking-[0.2em] text-stone-400">
                                Display name
                            </div>
                            <div className="mt-1 font-medium text-stone-950 dark:text-stone-50">
                                {user?.displayName ?? 'Local ChartDB user'}
                            </div>
                        </div>
                        <div>
                            <div className="text-xs uppercase tracking-[0.2em] text-stone-400">
                                Email
                            </div>
                            <div className="mt-1 font-medium text-stone-950 dark:text-stone-50">
                                {user?.email ?? 'Not applicable'}
                            </div>
                        </div>
                        <div>
                            <div className="text-xs uppercase tracking-[0.2em] text-stone-400">
                                Role
                            </div>
                            <div className="mt-1 font-medium capitalize text-stone-950 dark:text-stone-50">
                                {user?.role ?? 'local'}
                            </div>
                        </div>
                        <div>
                            <div className="text-xs uppercase tracking-[0.2em] text-stone-400">
                                Auth provider
                            </div>
                            <div className="mt-1 font-medium uppercase text-stone-950 dark:text-stone-50">
                                {user?.authProvider ?? mode}
                            </div>
                        </div>
                        <div>
                            <div className="text-xs uppercase tracking-[0.2em] text-stone-400">
                                Status
                            </div>
                            <div className="mt-1 font-medium capitalize text-stone-950 dark:text-stone-50">
                                {user?.status ??
                                    (authenticated ? 'active' : 'local')}
                            </div>
                        </div>
                        <div>
                            <div className="text-xs uppercase tracking-[0.2em] text-stone-400">
                                Ownership scope
                            </div>
                            <div className="mt-1 font-medium capitalize text-stone-950 dark:text-stone-50">
                                {user?.ownershipScope ?? 'personal'}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-stone-200/80 bg-white/80 shadow-sm dark:border-stone-800/80 dark:bg-stone-900/80">
                    <CardHeader>
                        <CardTitle>Workspace snapshot</CardTitle>
                        <CardDescription>
                            A quick summary of the saved workspace tied to this
                            session.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm text-stone-600 dark:text-stone-300">
                        <div className="flex items-center justify-between rounded-2xl bg-stone-100 px-4 py-3 dark:bg-stone-800/80">
                            <span>Collections</span>
                            <span className="font-semibold text-stone-950 dark:text-stone-50">
                                {collectionCount}
                            </span>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl bg-stone-100 px-4 py-3 dark:bg-stone-800/80">
                            <span>Active projects</span>
                            <span className="font-semibold text-stone-950 dark:text-stone-50">
                                {projectCount}
                            </span>
                        </div>
                        <div className="flex items-center gap-3 rounded-2xl bg-stone-100 px-4 py-3 dark:bg-stone-800/80">
                            <ShieldCheck className="size-4 text-stone-500" />
                            <span>
                                {enabled
                                    ? 'Access is governed by the current auth session.'
                                    : 'This workspace is running without server-side authentication.'}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </section>
        </div>
    );
};
