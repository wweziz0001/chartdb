import React from 'react';
import {
    ArrowRight,
    Clock3,
    Database,
    FolderKanban,
    Layers3,
    Search,
    Upload,
} from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/badge/badge';
import { Button } from '@/components/button/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/card/card';
import { Input } from '@/components/input/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/select/select';
import type {
    LibraryDiagramItem,
    LibrarySort,
} from '@/features/dashboard/hooks/use-library-catalog';

const dateFormatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
});

const sortOptions: Array<{ label: string; value: LibrarySort }> = [
    { label: 'Last updated', value: 'updated' },
    { label: 'Created', value: 'created' },
    { label: 'Name', value: 'name' },
    { label: 'Table count', value: 'tables' },
];

const MetricCard = ({
    description,
    title,
    value,
}: {
    description: string;
    title: string;
    value: number;
}) => (
    <Card className="border-stone-200/80 bg-white/80 shadow-sm dark:border-stone-800/80 dark:bg-stone-900/80">
        <CardHeader className="pb-3">
            <CardDescription>{title}</CardDescription>
            <CardTitle className="text-3xl">{value}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 text-sm text-stone-500">
            {description}
        </CardContent>
    </Card>
);

const DiagramLibraryCard = ({ item }: { item: LibraryDiagramItem }) => (
    <Card className="group border-stone-200/80 bg-white/85 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-stone-800/80 dark:bg-stone-900/80">
        <CardHeader className="space-y-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <CardTitle className="truncate text-xl">
                        {item.diagram.name}
                    </CardTitle>
                    <CardDescription className="mt-2 line-clamp-2 min-h-10 text-sm leading-6">
                        {item.diagram.description ??
                            item.project.description ??
                            'Saved schema diagram ready for editing, review, and sharing.'}
                    </CardDescription>
                </div>
                <Badge
                    variant="outline"
                    className="border-stone-200 bg-stone-100 text-stone-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300"
                >
                    {item.diagram.databaseType}
                </Badge>
            </div>

            <div className="flex flex-wrap gap-2">
                {item.isShared ? (
                    <Badge
                        variant="outline"
                        className="border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200"
                    >
                        Shared access
                    </Badge>
                ) : null}
                <Badge
                    variant="outline"
                    className="border-stone-200 bg-stone-100 text-stone-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300"
                >
                    {item.project.name}
                </Badge>
                <Badge
                    variant="outline"
                    className="border-stone-200 bg-stone-100 text-stone-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300"
                >
                    {item.collection?.name ?? 'Unorganized'}
                </Badge>
            </div>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="grid gap-3 text-sm text-stone-600 dark:text-stone-300 sm:grid-cols-2">
                <div className="flex items-center gap-2">
                    <Database className="size-4 text-stone-400" />
                    <span>{item.diagram.tableCount} tables</span>
                </div>
                <div className="flex items-center gap-2">
                    <Layers3 className="size-4 text-stone-400" />
                    <span>{item.diagram.visibility}</span>
                </div>
                <div className="flex items-center gap-2">
                    <FolderKanban className="size-4 text-stone-400" />
                    <span>{item.project.diagramCount} saved diagrams</span>
                </div>
                <div className="flex items-center gap-2">
                    <Clock3 className="size-4 text-stone-400" />
                    <span>{dateFormatter.format(item.diagram.updatedAt)}</span>
                </div>
            </div>

            <Button
                asChild
                variant="outline"
                className="w-full justify-between rounded-xl border-stone-200 bg-transparent text-stone-700 hover:bg-stone-100 hover:text-stone-950 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800 dark:hover:text-stone-50"
            >
                <Link to={`/diagrams/${item.diagram.id}`}>
                    Open diagram
                    <ArrowRight className="size-4" />
                </Link>
            </Button>
        </CardContent>
    </Card>
);

export const LibraryPage = ({
    emptyState,
    error,
    items,
    loading,
    metrics,
    search,
    setSearch,
    sort,
    setSort,
    subtitle,
    title,
}: {
    emptyState: {
        description: string;
        title: string;
    };
    error: string | null;
    items: LibraryDiagramItem[];
    loading: boolean;
    metrics: {
        collections: number;
        diagrams: number;
        projects: number;
    };
    search: string;
    setSearch: (value: string) => void;
    sort: LibrarySort;
    setSort: (value: LibrarySort) => void;
    subtitle: string;
    title: string;
}) => (
    <div className="space-y-6">
        <Helmet>
            <title>{`ChartDB - ${title}`}</title>
        </Helmet>

        <section className="rounded-[28px] border border-stone-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(245,245,244,0.92))] p-6 shadow-sm dark:border-stone-800/80 dark:bg-[linear-gradient(135deg,rgba(28,25,23,0.94),rgba(12,10,9,0.9))]">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                <div className="max-w-3xl space-y-3">
                    <Badge
                        variant="outline"
                        className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
                    >
                        Main library
                    </Badge>
                    <div className="space-y-2">
                        <h1 className="text-3xl font-semibold tracking-tight text-stone-950 dark:text-stone-50 sm:text-4xl">
                            {title}
                        </h1>
                        <p className="text-sm leading-6 text-stone-600 dark:text-stone-300 sm:text-base">
                            {subtitle}
                        </p>
                    </div>
                </div>

                <div className="flex flex-col gap-3 md:flex-row">
                    <Button
                        asChild
                        variant="outline"
                        className="rounded-xl border-stone-200 bg-transparent text-stone-700 hover:bg-stone-100 hover:text-stone-950 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800 dark:hover:text-stone-50"
                    >
                        <Link to="/workspace?action=import">
                            <Upload className="mr-2 size-4" />
                            Import
                        </Link>
                    </Button>
                    <Button
                        asChild
                        className="rounded-xl bg-stone-950 text-stone-50 hover:bg-stone-900 dark:bg-amber-300 dark:text-stone-950 dark:hover:bg-amber-200"
                    >
                        <Link to="/workspace?action=create">
                            Create diagram
                        </Link>
                    </Button>
                </div>
            </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
            <MetricCard
                description="Visible in this view."
                title="Diagrams"
                value={metrics.diagrams}
            />
            <MetricCard
                description="Projects represented here."
                title="Projects"
                value={metrics.projects}
            />
            <MetricCard
                description="Collections currently synced."
                title="Collections"
                value={metrics.collections}
            />
        </section>

        <section className="rounded-[24px] border border-stone-200/80 bg-white/80 p-4 shadow-sm dark:border-stone-800/80 dark:bg-stone-900/80">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
                    <Input
                        aria-label={`${title} search`}
                        className="h-11 rounded-xl border-stone-200 bg-white pl-10 dark:border-stone-700 dark:bg-stone-950/70"
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search diagrams, projects, descriptions, and collections"
                        value={search}
                    />
                </div>
                <Select
                    onValueChange={(value) => setSort(value as LibrarySort)}
                    value={sort}
                >
                    <SelectTrigger className="h-11 w-full rounded-xl border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-950/70 lg:w-[220px]">
                        <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                        {sortOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </section>

        {error ? (
            <Card className="border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                <CardHeader>
                    <CardTitle>Library unavailable</CardTitle>
                    <CardDescription className="text-current">
                        {error}
                    </CardDescription>
                </CardHeader>
            </Card>
        ) : null}

        {loading ? (
            <Card className="border-dashed border-stone-200/80 bg-white/70 dark:border-stone-800/80 dark:bg-stone-900/70">
                <CardContent className="py-16 text-center text-sm uppercase tracking-[0.24em] text-stone-400">
                    Loading library data
                </CardContent>
            </Card>
        ) : null}

        {!loading && items.length === 0 ? (
            <Card className="border-dashed border-stone-200/80 bg-white/70 dark:border-stone-800/80 dark:bg-stone-900/70">
                <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                    <div className="rounded-2xl bg-stone-100 p-4 dark:bg-stone-800">
                        <Database className="size-6 text-stone-500" />
                    </div>
                    <div className="space-y-1">
                        <h2 className="text-xl font-semibold">
                            {emptyState.title}
                        </h2>
                        <p className="max-w-xl text-sm leading-6 text-stone-500">
                            {emptyState.description}
                        </p>
                    </div>
                </CardContent>
            </Card>
        ) : null}

        {!loading && items.length > 0 ? (
            <section className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                {items.map((item) => (
                    <DiagramLibraryCard
                        key={`${item.project.id}-${item.diagram.id}`}
                        item={item}
                    />
                ))}
            </section>
        ) : null}
    </div>
);
