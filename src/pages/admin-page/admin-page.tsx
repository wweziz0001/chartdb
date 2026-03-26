import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Activity,
    Database,
    FolderKanban,
    LayoutPanelTop,
    RefreshCw,
    Shield,
    Users,
} from 'lucide-react';
import { Button } from '@/components/button/button';
import { Badge } from '@/components/badge/badge';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/card/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/table/table';
import {
    adminClient,
    type AdminOverviewResponse,
} from '@/features/admin/api/admin-client';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { RequestError } from '@/lib/api/request';

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
});

const formatDateTime = (value: string | null) => {
    if (!value) {
        return 'Never';
    }

    return dateTimeFormatter.format(new Date(value));
};

const statusBadgeClassNames: Record<
    'provisioned' | 'active' | 'disabled',
    string
> = {
    provisioned:
        'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/10',
    active: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/10',
    disabled:
        'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-50 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-200 dark:hover:bg-rose-500/10',
};

const roleBadgeClassNames: Record<'member' | 'admin', string> = {
    member: 'border-stone-200 bg-stone-100 text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-800',
    admin: 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-50 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-200 dark:hover:bg-sky-500/10',
};

const authProviderLabels: Record<'placeholder' | 'local' | 'oidc', string> = {
    placeholder: 'Placeholder',
    local: 'Password',
    oidc: 'OIDC',
};

const surfaceCardClassName =
    'border-stone-200/80 bg-white/80 shadow-sm dark:border-stone-800/80 dark:bg-stone-900/80';
const insetSurfaceClassName =
    'flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-stone-100/80 px-4 py-3 dark:border-stone-800 dark:bg-stone-950/60';

const MetricCard = ({
    title,
    value,
    description,
    icon: Icon,
}: {
    title: string;
    value: number | string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
}) => (
    <Card className={surfaceCardClassName}>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
            <div>
                <CardDescription>{title}</CardDescription>
                <CardTitle className="mt-2 text-3xl">{value}</CardTitle>
            </div>
            <div className="rounded-full border border-stone-200 bg-stone-100 p-3 dark:border-stone-700 dark:bg-stone-950/80">
                <Icon className="size-4 text-amber-500 dark:text-amber-300" />
            </div>
        </CardHeader>
        <CardContent>
            <p className="text-sm text-stone-500">{description}</p>
        </CardContent>
    </Card>
);

const SummaryList = ({
    items,
}: {
    items: Array<{ label: string; value: string | number }>;
}) => (
    <dl className="space-y-3">
        {items.map((item) => (
            <div key={item.label} className={insetSurfaceClassName}>
                <dt className="text-sm text-stone-500">{item.label}</dt>
                <dd className="text-sm font-medium text-stone-950 dark:text-stone-100">
                    {item.value}
                </dd>
            </div>
        ))}
    </dl>
);

export const AdminPage: React.FC = () => {
    const { user } = useAuth();
    const [overview, setOverview] = useState<AdminOverviewResponse | null>(
        null
    );
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const loadOverview = useCallback(async () => {
        setError(null);
        setRefreshing(true);

        try {
            const response = await adminClient.getOverview();
            setOverview(response);
        } catch (nextError) {
            if (nextError instanceof RequestError) {
                setError(nextError.message);
            } else {
                setError('Unable to load the admin dashboard right now.');
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        void loadOverview();
    }, [loadOverview]);

    return (
        <div className="space-y-6">
            <section className="rounded-[28px] border border-stone-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(245,245,244,0.92))] p-6 shadow-sm dark:border-stone-800/80 dark:bg-[linear-gradient(135deg,rgba(28,25,23,0.94),rgba(12,10,9,0.9))]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="space-y-3">
                        <Badge
                            variant="outline"
                            className="border-amber-500/30 bg-amber-500/10 text-amber-200"
                        >
                            Self-hosted admin
                        </Badge>
                        <div className="space-y-2">
                            <h1 className="text-3xl font-semibold tracking-tight text-stone-950 dark:text-stone-50 sm:text-4xl">
                                ChartDB admin dashboard
                            </h1>
                            <p className="max-w-3xl text-sm leading-6 text-stone-600 dark:text-stone-300 sm:text-base">
                                Monitor authenticated users, saved workspace
                                inventory, and the core health of this
                                deployment without introducing extra role
                                management.
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                        <div className="text-sm text-stone-500 dark:text-stone-400">
                            Signed in as{' '}
                            <span className="font-medium text-stone-950 dark:text-stone-100">
                                {user?.displayName ?? user?.email ?? 'Admin'}
                            </span>
                        </div>
                        <Button asChild variant="outline">
                            <Link to="/">Back to library</Link>
                        </Button>
                        <Button
                            onClick={() => void loadOverview()}
                            disabled={refreshing}
                            className="bg-amber-400 text-stone-950 hover:bg-amber-300"
                        >
                            <RefreshCw
                                className={`mr-2 size-4 ${
                                    refreshing ? 'animate-spin' : ''
                                }`}
                            />
                            Refresh
                        </Button>
                    </div>
                </div>
            </section>

            {error ? (
                <Card className="border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                    <CardHeader>
                        <CardTitle>Dashboard unavailable</CardTitle>
                        <CardDescription className="text-current">
                            {error}
                        </CardDescription>
                    </CardHeader>
                </Card>
            ) : null}

            {loading && !overview ? (
                <Card className={surfaceCardClassName}>
                    <CardContent className="py-10 text-center text-sm uppercase tracking-[0.3em] text-stone-400">
                        Loading admin overview
                    </CardContent>
                </Card>
            ) : null}

            {overview ? (
                <>
                    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                        <MetricCard
                            title="Users"
                            value={overview.metrics.users}
                            description={`${overview.users.byStatus.active} active accounts`}
                            icon={Users}
                        />
                        <MetricCard
                            title="Admins"
                            value={overview.metrics.admins}
                            description="Administrators with access to this deployment"
                            icon={Shield}
                        />
                        <MetricCard
                            title="Collections"
                            value={overview.metrics.collections}
                            description="Top-level project groupings"
                            icon={FolderKanban}
                        />
                        <MetricCard
                            title="Projects"
                            value={overview.metrics.projects}
                            description="Saved workspaces persisted in ChartDB"
                            icon={LayoutPanelTop}
                        />
                        <MetricCard
                            title="Diagrams"
                            value={overview.metrics.diagrams}
                            description={`${overview.metrics.activeSessions} active sessions right now`}
                            icon={Database}
                        />
                    </section>

                    <section className="grid gap-4 xl:grid-cols-3">
                        <Card className={surfaceCardClassName}>
                            <CardHeader>
                                <CardTitle>Platform health</CardTitle>
                                <CardDescription>
                                    Core deployment readiness and auth posture.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <SummaryList
                                    items={[
                                        {
                                            label: 'Environment',
                                            value: overview.platform
                                                .environment,
                                        },
                                        {
                                            label: 'Auth mode',
                                            value: overview.platform.authMode,
                                        },
                                        {
                                            label: 'Bootstrap state',
                                            value: overview.platform
                                                .adminInitialized
                                                ? 'Complete'
                                                : overview.platform
                                                        .bootstrapRequired
                                                  ? 'Pending'
                                                  : 'Not required',
                                        },
                                        {
                                            label: 'OIDC config',
                                            value: overview.platform
                                                .oidcConfigured
                                                ? 'Configured'
                                                : 'Not configured',
                                        },
                                        {
                                            label: 'Persistence',
                                            value: `${overview.platform.persistence.app} / ${overview.platform.persistence.schemaSync}`,
                                        },
                                        {
                                            label: 'Generated',
                                            value: formatDateTime(
                                                overview.generatedAt
                                            ),
                                        },
                                    ]}
                                />
                            </CardContent>
                        </Card>

                        <Card className={surfaceCardClassName}>
                            <CardHeader>
                                <CardTitle>Project inventory</CardTitle>
                                <CardDescription>
                                    Saved project visibility and lifecycle
                                    counts.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <SummaryList
                                    items={[
                                        {
                                            label: 'Active projects',
                                            value: overview.projects.byStatus
                                                .active,
                                        },
                                        {
                                            label: 'Archived projects',
                                            value: overview.projects.byStatus
                                                .archived,
                                        },
                                        {
                                            label: 'Deleted projects',
                                            value: overview.projects.byStatus
                                                .deleted,
                                        },
                                        {
                                            label: 'Private visibility',
                                            value: overview.projects
                                                .byVisibility.private,
                                        },
                                        {
                                            label: 'Workspace visibility',
                                            value: overview.projects
                                                .byVisibility.workspace,
                                        },
                                        {
                                            label: 'Public visibility',
                                            value: overview.projects
                                                .byVisibility.public,
                                        },
                                    ]}
                                />
                            </CardContent>
                        </Card>

                        <Card className={surfaceCardClassName}>
                            <CardHeader>
                                <CardTitle>Diagram inventory</CardTitle>
                                <CardDescription>
                                    Diagram status and sharing-readiness
                                    signals.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <SummaryList
                                    items={[
                                        {
                                            label: 'Draft diagrams',
                                            value: overview.diagrams.byStatus
                                                .draft,
                                        },
                                        {
                                            label: 'Active diagrams',
                                            value: overview.diagrams.byStatus
                                                .active,
                                        },
                                        {
                                            label: 'Archived diagrams',
                                            value: overview.diagrams.byStatus
                                                .archived,
                                        },
                                        {
                                            label: 'Public visibility',
                                            value: overview.diagrams
                                                .byVisibility.public,
                                        },
                                        {
                                            label: 'Workspace visibility',
                                            value: overview.diagrams
                                                .byVisibility.workspace,
                                        },
                                        {
                                            label: 'Sharing records',
                                            value: overview.sharing.supported
                                                ? (overview.sharing
                                                      .totalRecords ?? 0)
                                                : 'Not available',
                                        },
                                    ]}
                                />
                            </CardContent>
                        </Card>
                    </section>

                    <section className="grid gap-4 xl:grid-cols-[2fr,1fr]">
                        <Card className={surfaceCardClassName}>
                            <CardHeader>
                                <CardTitle>Users</CardTitle>
                                <CardDescription>
                                    Read-only visibility into role, status,
                                    provider, and recent sign-in activity.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="border-stone-200 hover:bg-transparent dark:border-stone-800">
                                                <TableHead>Name</TableHead>
                                                <TableHead>Email</TableHead>
                                                <TableHead>Role</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Auth</TableHead>
                                                <TableHead>
                                                    Last login
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {overview.users.items.map(
                                                (account) => (
                                                    <TableRow
                                                        key={account.id}
                                                        className="border-stone-200/80 hover:bg-stone-100/70 dark:border-stone-800/80 dark:hover:bg-stone-800/40"
                                                    >
                                                        <TableCell className="min-w-40">
                                                            <div className="font-medium text-stone-950 dark:text-stone-100">
                                                                {
                                                                    account.displayName
                                                                }
                                                            </div>
                                                            <div className="text-xs text-stone-500 dark:text-stone-400">
                                                                Created{' '}
                                                                {formatDateTime(
                                                                    account.createdAt
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-stone-600 dark:text-stone-300">
                                                            {account.email ??
                                                                'No email'}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge
                                                                variant="outline"
                                                                className={
                                                                    roleBadgeClassNames[
                                                                        account
                                                                            .role
                                                                    ]
                                                                }
                                                            >
                                                                {account.role}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge
                                                                variant="outline"
                                                                className={
                                                                    statusBadgeClassNames[
                                                                        account
                                                                            .status
                                                                    ]
                                                                }
                                                            >
                                                                {account.status}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-stone-600 dark:text-stone-300">
                                                            {
                                                                authProviderLabels[
                                                                    account
                                                                        .authProvider
                                                                ]
                                                            }
                                                        </TableCell>
                                                        <TableCell className="text-stone-600 dark:text-stone-300">
                                                            {formatDateTime(
                                                                account.lastLoginAt
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className={surfaceCardClassName}>
                            <CardHeader>
                                <CardTitle>Scope and limits</CardTitle>
                                <CardDescription>
                                    This dashboard intentionally stays small.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm leading-6 text-stone-600 dark:text-stone-300">
                                <div className="rounded-2xl border border-stone-200 bg-stone-100/80 p-4 dark:border-stone-800 dark:bg-stone-950/60">
                                    <div className="mb-2 flex items-center gap-2 font-medium text-stone-950 dark:text-stone-100">
                                        <Activity className="size-4 text-amber-500 dark:text-amber-300" />
                                        Included now
                                    </div>
                                    <p>
                                        User visibility, saved-project and
                                        diagram counts, sharing availability
                                        status, and a basic platform health
                                        summary.
                                    </p>
                                </div>
                                <div className="rounded-2xl border border-stone-200 bg-stone-100/80 p-4 dark:border-stone-800 dark:bg-stone-950/60">
                                    <div className="mb-2 flex items-center gap-2 font-medium text-stone-950 dark:text-stone-100">
                                        <Shield className="size-4 text-amber-500 dark:text-amber-300" />
                                        Not included
                                    </div>
                                    <p>
                                        No user editing, impersonation, password
                                        resets, or advanced role workflows were
                                        added in this first pass.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </section>
                </>
            ) : null}
        </div>
    );
};
