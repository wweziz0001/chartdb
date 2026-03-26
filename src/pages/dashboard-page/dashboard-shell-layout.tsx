import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Archive,
    ChevronRight,
    FolderKanban,
    LayoutGrid,
    LogOut,
    Menu,
    Settings,
    Shield,
    Trash2,
    UserRound,
    X,
} from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import ChartDBLogo from '@/assets/logo-light.png';
import { Button } from '@/components/button/button';
import { Avatar, AvatarFallback } from '@/components/avatar/avatar';
import { cn } from '@/lib/utils';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { LocalConfigProvider } from '@/context/local-config-context/local-config-provider';
import { ThemeProvider } from '@/context/theme-context/theme-provider';
import { StorageProvider } from '@/context/storage-context/storage-provider';
import { ConfigProvider } from '@/context/config-context/config-provider';
import { useStorage } from '@/hooks/use-storage';
import type { DashboardShellContextValue } from './dashboard-shell-context';

const initialsFromName = (value?: string | null) => {
    const resolved = value?.trim();
    if (!resolved) {
        return 'CB';
    }

    const segments = resolved.split(/\s+/).filter(Boolean).slice(0, 2);

    return segments.map((segment) => segment[0]?.toUpperCase() ?? '').join('');
};

const baseLinkClassName =
    'group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800/80 dark:hover:text-stone-50';
const activeLinkClassName =
    'bg-stone-950 text-stone-50 shadow-lg shadow-stone-950/10 hover:bg-stone-900 hover:text-stone-50 dark:bg-amber-300 dark:text-stone-950 dark:hover:bg-amber-200';

const PrimaryNavLink = ({
    icon: Icon,
    label,
    to,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    to: string;
}) => (
    <NavLink
        to={to}
        end={to === '/'}
        className={({ isActive }) =>
            cn(baseLinkClassName, isActive && activeLinkClassName)
        }
    >
        {({ isActive }) => (
            <>
                <Icon
                    className={cn(
                        'size-4 transition',
                        isActive
                            ? 'text-current'
                            : 'text-stone-400 group-hover:text-stone-700 dark:text-stone-500 dark:group-hover:text-stone-200'
                    )}
                />
                <span className="flex-1">{label}</span>
            </>
        )}
    </NavLink>
);

const CollectionNavLink = ({
    count,
    label,
    to,
}: {
    count: number;
    label: string;
    to: string;
}) => (
    <NavLink
        to={to}
        className={({ isActive }) =>
            cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800/70 dark:hover:text-stone-50',
                isActive &&
                    'bg-stone-100 text-stone-900 dark:bg-stone-800 dark:text-stone-50'
            )
        }
    >
        <FolderKanban className="size-4 text-stone-400 dark:text-stone-500" />
        <span className="flex-1 truncate">{label}</span>
        <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[11px] font-semibold text-stone-700 dark:bg-stone-800 dark:text-stone-300">
            {count}
        </span>
    </NavLink>
);

const DashboardShellFrame = () => {
    const { authenticated, enabled, logout, user } = useAuth();
    const { listCollections } = useStorage();
    const [collections, setCollections] = useState<
        DashboardShellContextValue['collections']
    >([]);
    const [loadingCollections, setLoadingCollections] = useState(true);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const refreshCollections = useCallback(async () => {
        setLoadingCollections(true);

        try {
            const nextCollections = await listCollections();
            setCollections(nextCollections);
        } finally {
            setLoadingCollections(false);
        }
    }, [listCollections]);

    useEffect(() => {
        void refreshCollections();
    }, [refreshCollections]);

    const sidebarContext = useMemo<DashboardShellContextValue>(
        () => ({
            collections,
            loadingCollections,
            refreshCollections,
        }),
        [collections, loadingCollections, refreshCollections]
    );

    const utilityLinks = [
        { icon: Trash2, label: 'Trash', to: '/trash' },
        { icon: UserRound, label: 'Profile', to: '/profile' },
        { icon: Settings, label: 'Settings', to: '/settings' },
    ];
    const adminLink =
        enabled && user?.role === 'admin'
            ? {
                  icon: Shield,
                  label: 'Admin',
                  to: '/admin',
              }
            : null;

    const sidebar = (
        <div className="flex h-full flex-col">
            <div className="border-b border-stone-200/80 p-5 dark:border-stone-800/80">
                <Link to="/" className="flex items-center gap-3">
                    <div className="flex size-11 items-center justify-center rounded-2xl bg-stone-950 shadow-lg shadow-stone-950/10 dark:bg-amber-300">
                        <img
                            src={ChartDBLogo}
                            alt="ChartDB"
                            className="h-5 w-auto brightness-[3] dark:brightness-100"
                        />
                    </div>
                    <div className="min-w-0">
                        <div className="text-sm font-semibold text-stone-950 dark:text-stone-50">
                            ChartDB
                        </div>
                        <div className="text-xs uppercase tracking-[0.24em] text-stone-400">
                            Diagram Library
                        </div>
                    </div>
                </Link>
            </div>

            <div className="flex-1 space-y-8 overflow-y-auto px-4 py-5">
                <div className="space-y-2">
                    <div className="px-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-400">
                        Library
                    </div>
                    <div className="space-y-1">
                        <PrimaryNavLink
                            icon={LayoutGrid}
                            label="All Diagrams"
                            to="/"
                        />
                        <PrimaryNavLink
                            icon={ChevronRight}
                            label="Shared with Me"
                            to="/shared-with-me"
                        />
                        <PrimaryNavLink
                            icon={Archive}
                            label="Unorganized"
                            to="/unorganized"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="px-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-400">
                        Collections
                    </div>
                    <div className="space-y-1">
                        <PrimaryNavLink
                            icon={FolderKanban}
                            label="Collections"
                            to="/collections"
                        />
                        {loadingCollections ? (
                            <div className="px-3 py-2 text-sm text-stone-400">
                                Loading collections...
                            </div>
                        ) : collections.length > 0 ? (
                            collections.map((collection) => (
                                <CollectionNavLink
                                    key={collection.id}
                                    count={collection.projectCount}
                                    label={collection.name}
                                    to={`/collections/${collection.id}`}
                                />
                            ))
                        ) : (
                            <div className="px-3 py-2 text-sm text-stone-400">
                                No collections yet.
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="px-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-400">
                        Workspace
                    </div>
                    <div className="space-y-1">
                        {utilityLinks.map((item) => (
                            <PrimaryNavLink
                                key={item.to}
                                icon={item.icon}
                                label={item.label}
                                to={item.to}
                            />
                        ))}
                        {adminLink ? (
                            <PrimaryNavLink
                                icon={adminLink.icon}
                                label={adminLink.label}
                                to={adminLink.to}
                            />
                        ) : null}
                    </div>
                </div>
            </div>

            <div className="border-t border-stone-200/80 p-4 dark:border-stone-800/80">
                <div className="rounded-2xl border border-stone-200 bg-white/80 p-3 shadow-sm dark:border-stone-800 dark:bg-stone-900/70">
                    <div className="flex items-center gap-3">
                        <Avatar className="size-10 border border-stone-200 dark:border-stone-700">
                            <AvatarFallback className="bg-stone-950 text-xs font-semibold text-stone-50 dark:bg-amber-300 dark:text-stone-950">
                                {initialsFromName(
                                    user?.displayName ??
                                        user?.email ??
                                        'ChartDB'
                                )}
                            </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-stone-950 dark:text-stone-50">
                                {user?.displayName ??
                                    user?.email ??
                                    (enabled
                                        ? 'Authenticated user'
                                        : 'Local workspace')}
                            </div>
                            <div className="truncate text-xs text-stone-500">
                                {authenticated
                                    ? (user?.email ??
                                      user?.role ??
                                      'Workspace member')
                                    : 'Self-hosted diagram workspace'}
                            </div>
                        </div>
                    </div>
                    {enabled ? (
                        <Button
                            variant="outline"
                            className="mt-3 w-full justify-start rounded-xl border-stone-200 bg-transparent text-stone-700 hover:bg-stone-100 hover:text-stone-950 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800 dark:hover:text-stone-50"
                            onClick={() => void logout()}
                        >
                            <LogOut className="mr-2 size-4" />
                            Log out
                        </Button>
                    ) : null}
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.12),transparent_32%),linear-gradient(180deg,#f8fafc_0%,#f5f5f4_100%)] text-stone-950 dark:bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.18),transparent_28%),linear-gradient(180deg,#171717_0%,#0c0a09_100%)] dark:text-stone-50">
            <div className="mx-auto flex min-h-screen max-w-[1600px] gap-4 p-3 sm:p-4 lg:gap-6 lg:px-6">
                <aside className="hidden w-[300px] shrink-0 overflow-hidden rounded-[28px] border border-stone-200/80 bg-white/90 shadow-xl shadow-stone-950/5 backdrop-blur dark:border-stone-800/80 dark:bg-stone-950/80 dark:shadow-black/20 lg:block">
                    {sidebar}
                </aside>

                <div className="flex min-h-[calc(100vh-1.5rem)] flex-1 flex-col overflow-hidden rounded-[28px] border border-stone-200/80 bg-white/90 shadow-xl shadow-stone-950/5 backdrop-blur dark:border-stone-800/80 dark:bg-stone-950/80 dark:shadow-black/20">
                    <header className="flex items-center justify-between border-b border-stone-200/80 p-4 dark:border-stone-800/80 lg:px-6">
                        <div>
                            <div className="text-xs uppercase tracking-[0.24em] text-stone-400">
                                Authenticated workspace
                            </div>
                            <div className="text-lg font-semibold text-stone-950 dark:text-stone-50">
                                Diagram library
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                asChild
                                variant="outline"
                                className="hidden rounded-xl border-stone-200 bg-transparent text-stone-700 hover:bg-stone-100 hover:text-stone-950 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800 dark:hover:text-stone-50 md:inline-flex"
                            >
                                <Link to="/workspace?action=create">
                                    Create diagram
                                </Link>
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="rounded-xl border-stone-200 bg-transparent text-stone-700 hover:bg-stone-100 hover:text-stone-950 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800 dark:hover:text-stone-50 lg:hidden"
                                onClick={() => setMobileMenuOpen(true)}
                                aria-label="Open navigation"
                            >
                                <Menu className="size-4" />
                            </Button>
                        </div>
                    </header>

                    <main className="flex-1 overflow-y-auto p-4 lg:p-6">
                        <Outlet context={sidebarContext} />
                    </main>
                </div>
            </div>

            {mobileMenuOpen ? (
                <div className="fixed inset-0 z-50 bg-stone-950/40 backdrop-blur-sm lg:hidden">
                    <div className="flex h-full max-w-sm">
                        <div className="size-full overflow-hidden border-r border-stone-200/80 bg-white shadow-2xl dark:border-stone-800/80 dark:bg-stone-950">
                            <div className="flex items-center justify-end border-b border-stone-200/80 p-4 dark:border-stone-800/80">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="rounded-xl"
                                    onClick={() => setMobileMenuOpen(false)}
                                    aria-label="Close navigation"
                                >
                                    <X className="size-4" />
                                </Button>
                            </div>
                            {sidebar}
                        </div>
                        <button
                            type="button"
                            className="flex-1"
                            aria-label="Close navigation overlay"
                            onClick={() => setMobileMenuOpen(false)}
                        />
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export const DashboardShellLayout = () => (
    <LocalConfigProvider>
        <ThemeProvider>
            <StorageProvider>
                <ConfigProvider>
                    <DashboardShellFrame />
                </ConfigProvider>
            </StorageProvider>
        </ThemeProvider>
    </LocalConfigProvider>
);
