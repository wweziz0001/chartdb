import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/avatar/avatar';
import { Badge } from '@/components/badge/badge';
import { Button } from '@/components/button/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogInternalContent,
    DialogTitle,
} from '@/components/dialog/dialog';
import { Input } from '@/components/input/input';
import { Separator } from '@/components/separator/separator';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/select/select';
import type {
    PersistedSharingSettings,
    PersistedUserSummary,
    SharingAccess,
    SharingScope,
} from '@/features/persistence/api/persistence-client';
import { cn } from '@/lib/utils';
import { Copy, Link2, RotateCw, Search, Trash2, UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type ExpirationPreset = 'never' | '1h' | '1d' | '7d' | 'custom';

interface SharingSettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    subject: {
        type: 'project' | 'diagram';
        id: string;
        name: string;
    } | null;
    loadSharing: (subject: {
        type: 'project' | 'diagram';
        id: string;
    }) => Promise<PersistedSharingSettings>;
    searchUsers: (query: string) => Promise<PersistedUserSummary[]>;
    addPerson: (
        subject: {
            type: 'project' | 'diagram';
            id: string;
        },
        params: {
            userId: string;
            access: SharingAccess;
        }
    ) => Promise<PersistedSharingSettings>;
    updatePerson: (
        subject: {
            type: 'project' | 'diagram';
            id: string;
        },
        userId: string,
        params: {
            access: SharingAccess;
        }
    ) => Promise<PersistedSharingSettings>;
    removePerson: (
        subject: {
            type: 'project' | 'diagram';
            id: string;
        },
        userId: string
    ) => Promise<PersistedSharingSettings>;
    updateGeneralAccess: (
        subject: {
            type: 'project' | 'diagram';
            id: string;
        },
        params: {
            scope: SharingScope;
            access: SharingAccess;
            expiresAt?: string | null;
            rotateLinkToken?: boolean;
        }
    ) => Promise<PersistedSharingSettings>;
    onSaved?: () => Promise<void> | void;
}

const getInitials = (user: PersistedUserSummary | null) => {
    if (!user) {
        return '??';
    }

    const source = user.displayName.trim() || user.email?.trim() || 'User';
    const parts = source.split(/\s+/).filter(Boolean);
    return parts
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('');
};

const toLocalDateTimeValue = (value: string | null) => {
    if (!value) {
        return '';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    const offsetMs = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const inferExpirationPreset = (expiresAt: string | null): ExpirationPreset => {
    if (!expiresAt) {
        return 'never';
    }

    const now = Date.now();
    const diffMs = new Date(expiresAt).getTime() - now;
    const diffMinutes = Math.round(diffMs / 60_000);

    if (Math.abs(diffMinutes - 60) <= 5) {
        return '1h';
    }

    if (Math.abs(diffMinutes - 24 * 60) <= 30) {
        return '1d';
    }

    if (Math.abs(diffMinutes - 7 * 24 * 60) <= 60) {
        return '7d';
    }

    return 'custom';
};

const buildExpirationTimestamp = (
    preset: ExpirationPreset,
    customValue: string
) => {
    const now = Date.now();

    switch (preset) {
        case '1h':
            return new Date(now + 60 * 60 * 1000).toISOString();
        case '1d':
            return new Date(now + 24 * 60 * 60 * 1000).toISOString();
        case '7d':
            return new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
        case 'custom': {
            if (!customValue) {
                return null;
            }

            const customDate = new Date(customValue);
            return Number.isNaN(customDate.getTime())
                ? null
                : customDate.toISOString();
        }
        default:
            return null;
    }
};

const formatExpirationSummary = (
    scope: SharingScope,
    expiresAt: string | null,
    isExpired: boolean
) => {
    if (scope !== 'link') {
        return 'General link access is restricted.';
    }

    if (isExpired) {
        return 'This link has expired and no longer grants access.';
    }

    if (!expiresAt) {
        return 'Anyone with the link can open this item until you disable it.';
    }

    return `Anyone with the link can open this item until ${new Date(
        expiresAt
    ).toLocaleString()}.`;
};

const formatAccessTimestamp = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return 'Recently updated';
    }

    return parsed.toLocaleString();
};

const getAccessLabel = (access: SharingAccess) =>
    access === 'edit' ? 'Editor' : 'Viewer';

export const SharingSettingsDialog: React.FC<SharingSettingsDialogProps> = ({
    open,
    onOpenChange,
    subject,
    loadSharing,
    searchUsers,
    addPerson,
    updatePerson,
    removePerson,
    updateGeneralAccess,
    onSaved,
}) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [savingGeneralAccess, setSavingGeneralAccess] = useState(false);
    const [mutatingUserId, setMutatingUserId] = useState<string | null>(null);
    const [addingPerson, setAddingPerson] = useState(false);
    const [searchingUsers, setSearchingUsers] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sharing, setSharing] = useState<PersistedSharingSettings | null>(
        null
    );
    const [userQuery, setUserQuery] = useState('');
    const [userResults, setUserResults] = useState<PersistedUserSummary[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [personAccess, setPersonAccess] = useState<SharingAccess>('view');
    const [generalAccessScope, setGeneralAccessScope] =
        useState<SharingScope>('private');
    const [generalAccessRole, setGeneralAccessRole] =
        useState<SharingAccess>('view');
    const [expirationPreset, setExpirationPreset] =
        useState<ExpirationPreset>('never');
    const [customExpiration, setCustomExpiration] = useState('');

    const syncLocalState = useCallback(
        (nextSharing: PersistedSharingSettings) => {
            setSharing(nextSharing);
            setGeneralAccessScope(
                nextSharing.generalAccess.scope === 'authenticated'
                    ? 'private'
                    : nextSharing.generalAccess.scope
            );
            setGeneralAccessRole(nextSharing.generalAccess.access);
            setExpirationPreset(
                inferExpirationPreset(nextSharing.generalAccess.expiresAt)
            );
            setCustomExpiration(
                toLocalDateTimeValue(nextSharing.generalAccess.expiresAt)
            );
        },
        []
    );

    useEffect(() => {
        if (!open || !subject) {
            return;
        }

        let cancelled = false;

        const run = async () => {
            setLoading(true);
            setError(null);
            setUserQuery('');
            setUserResults([]);
            setSelectedUserId(null);
            setPersonAccess('view');

            try {
                const nextSharing = await loadSharing(subject);
                if (!cancelled) {
                    syncLocalState(nextSharing);
                }
            } catch (caughtError) {
                if (!cancelled) {
                    setError(
                        caughtError instanceof Error
                            ? caughtError.message
                            : t('open_diagram_dialog.sharing.error_load')
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
    }, [loadSharing, open, subject, syncLocalState, t]);

    useEffect(() => {
        if (!open || !subject) {
            return;
        }

        const normalizedQuery = userQuery.trim();
        if (normalizedQuery.length < 2) {
            setUserResults([]);
            setSelectedUserId(null);
            return;
        }

        let cancelled = false;

        const run = async () => {
            setSearchingUsers(true);

            try {
                const results = await searchUsers(normalizedQuery);
                if (cancelled) {
                    return;
                }

                const excludedUserIds = new Set<string>([
                    sharing?.owner?.id ?? '',
                    ...(sharing?.people ?? []).map((person) => person.user.id),
                ]);
                const filteredResults = results.filter(
                    (user) => !excludedUserIds.has(user.id)
                );
                setUserResults(filteredResults);
                setSelectedUserId((currentSelectedUserId) =>
                    filteredResults.some(
                        (user) => user.id === currentSelectedUserId
                    )
                        ? currentSelectedUserId
                        : (filteredResults[0]?.id ?? null)
                );
            } catch (caughtError) {
                if (!cancelled) {
                    setError(
                        caughtError instanceof Error
                            ? caughtError.message
                            : 'Unable to search users right now.'
                    );
                }
            } finally {
                if (!cancelled) {
                    setSearchingUsers(false);
                }
            }
        };

        void run();

        return () => {
            cancelled = true;
        };
    }, [open, searchUsers, sharing, subject, userQuery]);

    const shareUrl = useMemo(() => {
        const sharePath = sharing?.generalAccess.sharePath;
        if (!sharePath || typeof window === 'undefined') {
            return '';
        }

        return `${window.location.origin}${sharePath}`;
    }, [sharing?.generalAccess.sharePath]);

    const selectedUser = useMemo(
        () =>
            userResults.find((user) => user.id === selectedUserId) ??
            userResults[0] ??
            null,
        [selectedUserId, userResults]
    );

    const pendingGeneralAccessExpiresAt = useMemo(
        () =>
            generalAccessScope === 'link'
                ? buildExpirationTimestamp(expirationPreset, customExpiration)
                : null,
        [customExpiration, expirationPreset, generalAccessScope]
    );

    const pendingGeneralAccessSummary = useMemo(
        () =>
            formatExpirationSummary(
                generalAccessScope,
                pendingGeneralAccessExpiresAt,
                false
            ),
        [generalAccessScope, pendingGeneralAccessExpiresAt]
    );

    const applySharingUpdate = async (
        nextSharingPromise: Promise<PersistedSharingSettings>
    ) => {
        const nextSharing = await nextSharingPromise;
        syncLocalState(nextSharing);
        await onSaved?.();
    };

    const handleAddPerson = async () => {
        if (!subject || !selectedUser) {
            return;
        }

        setAddingPerson(true);
        setError(null);

        try {
            await applySharingUpdate(
                addPerson(subject, {
                    userId: selectedUser.id,
                    access: personAccess,
                })
            );
            setUserQuery('');
            setUserResults([]);
            setSelectedUserId(null);
            setPersonAccess('view');
        } catch (caughtError) {
            setError(
                caughtError instanceof Error
                    ? caughtError.message
                    : t('open_diagram_dialog.sharing.error_save')
            );
        } finally {
            setAddingPerson(false);
        }
    };

    const handleUpdatePerson = async (
        userId: string,
        access: SharingAccess
    ) => {
        if (!subject) {
            return;
        }

        setMutatingUserId(userId);
        setError(null);

        try {
            await applySharingUpdate(updatePerson(subject, userId, { access }));
        } catch (caughtError) {
            setError(
                caughtError instanceof Error
                    ? caughtError.message
                    : t('open_diagram_dialog.sharing.error_save')
            );
        } finally {
            setMutatingUserId(null);
        }
    };

    const handleRemovePerson = async (userId: string) => {
        if (!subject) {
            return;
        }

        setMutatingUserId(userId);
        setError(null);

        try {
            await applySharingUpdate(removePerson(subject, userId));
        } catch (caughtError) {
            setError(
                caughtError instanceof Error
                    ? caughtError.message
                    : t('open_diagram_dialog.sharing.error_save')
            );
        } finally {
            setMutatingUserId(null);
        }
    };

    const handleSaveGeneralAccess = async (rotateLinkToken = false) => {
        if (!subject) {
            return;
        }

        setSavingGeneralAccess(true);
        setError(null);

        try {
            await applySharingUpdate(
                updateGeneralAccess(subject, {
                    scope: generalAccessScope,
                    access: generalAccessRole,
                    expiresAt:
                        generalAccessScope === 'link'
                            ? buildExpirationTimestamp(
                                  expirationPreset,
                                  customExpiration
                              )
                            : null,
                    rotateLinkToken,
                })
            );
        } catch (caughtError) {
            setError(
                caughtError instanceof Error
                    ? caughtError.message
                    : t('open_diagram_dialog.sharing.error_save')
            );
        } finally {
            setSavingGeneralAccess(false);
        }
    };

    const handleCopy = async () => {
        if (!shareUrl) {
            return;
        }

        try {
            await navigator.clipboard.writeText(shareUrl);
        } catch {
            setError(t('open_diagram_dialog.sharing.error_copy'));
        }
    };

    const peopleWithAccess = sharing?.people ?? [];
    const legacyAuthenticatedAccess =
        sharing?.generalAccess.scope === 'authenticated';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>
                        {subject
                            ? t('open_diagram_dialog.sharing.title', {
                                  type: t(
                                      subject.type === 'project'
                                          ? 'open_diagram_dialog.sharing.project'
                                          : 'open_diagram_dialog.sharing.diagram'
                                  ),
                                  name: subject.name,
                              })
                            : t('open_diagram_dialog.sharing.fallback_title')}
                    </DialogTitle>
                    <DialogDescription>
                        Manage invited collaborators and link access for this
                        {subject?.type === 'project'
                            ? ' project.'
                            : ' diagram.'}
                    </DialogDescription>
                </DialogHeader>

                <DialogInternalContent className="space-y-6">
                    {error ? (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                            {error}
                        </div>
                    ) : null}

                    {loading || !sharing ? (
                        <p className="text-sm text-muted-foreground">
                            {t('open_diagram_dialog.sharing.loading')}
                        </p>
                    ) : (
                        <>
                            <section className="space-y-3 rounded-xl border bg-card/40 p-4">
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <div className="rounded-xl border bg-background p-3">
                                        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                                            Owner
                                        </p>
                                        <p className="mt-1 truncate text-sm font-semibold">
                                            {sharing.owner?.displayName ??
                                                'Unknown owner'}
                                        </p>
                                    </div>
                                    <div className="rounded-xl border bg-background p-3">
                                        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                                            Direct access
                                        </p>
                                        <p className="mt-1 text-sm font-semibold">
                                            {peopleWithAccess.length} people
                                        </p>
                                    </div>
                                    <div className="rounded-xl border bg-background p-3">
                                        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                                            General access
                                        </p>
                                        <p className="mt-1 text-sm font-semibold">
                                            {sharing.generalAccess.scope ===
                                            'link'
                                                ? `Anyone with the link (${getAccessLabel(
                                                      sharing.generalAccess
                                                          .access
                                                  )})`
                                                : 'Restricted'}
                                        </p>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-sm font-semibold">
                                        Add people
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                        Search for an existing ChartDB user and
                                        grant viewer or editor access directly.
                                    </p>
                                </div>

                                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_auto]">
                                    <div className="space-y-2">
                                        <div className="relative">
                                            <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
                                            <Input
                                                value={userQuery}
                                                onChange={(event) =>
                                                    setUserQuery(
                                                        event.target.value
                                                    )
                                                }
                                                placeholder="Add people by name or email"
                                                className="pl-9"
                                            />
                                        </div>
                                        <div className="rounded-lg border bg-background">
                                            {searchingUsers ? (
                                                <p className="px-3 py-2 text-sm text-muted-foreground">
                                                    Searching people...
                                                </p>
                                            ) : userQuery.trim().length < 2 ? (
                                                <p className="px-3 py-2 text-sm text-muted-foreground">
                                                    Type at least 2 characters
                                                    to search.
                                                </p>
                                            ) : userResults.length === 0 ? (
                                                <p className="px-3 py-2 text-sm text-muted-foreground">
                                                    No available users matched
                                                    your search.
                                                </p>
                                            ) : (
                                                <div className="max-h-44 overflow-auto py-1">
                                                    {userResults.map((user) => (
                                                        <button
                                                            key={user.id}
                                                            type="button"
                                                            className={cn(
                                                                'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-accent',
                                                                selectedUserId ===
                                                                    user.id &&
                                                                    'bg-accent'
                                                            )}
                                                            onClick={() =>
                                                                setSelectedUserId(
                                                                    user.id
                                                                )
                                                            }
                                                        >
                                                            <div className="min-w-0">
                                                                <span className="block truncate font-medium">
                                                                    {
                                                                        user.displayName
                                                                    }
                                                                </span>
                                                                <span className="block truncate text-xs text-muted-foreground">
                                                                    {user.email ??
                                                                        'No email'}
                                                                </span>
                                                            </div>
                                                            <Badge
                                                                variant="outline"
                                                                className="shrink-0"
                                                            >
                                                                Add
                                                            </Badge>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <span className="text-xs font-medium text-muted-foreground">
                                            Permission
                                        </span>
                                        <Select
                                            value={personAccess}
                                            onValueChange={(value) =>
                                                setPersonAccess(
                                                    value as SharingAccess
                                                )
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="view">
                                                    Viewer
                                                </SelectItem>
                                                <SelectItem value="edit">
                                                    Editor
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="flex items-end">
                                        <Button
                                            type="button"
                                            onClick={() =>
                                                void handleAddPerson()
                                            }
                                            disabled={
                                                !selectedUser || addingPerson
                                            }
                                            className="w-full md:w-auto"
                                        >
                                            <UserPlus className="mr-2 size-4" />
                                            Add person
                                        </Button>
                                    </div>
                                </div>

                                {selectedUser ? (
                                    <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed bg-background px-3 py-2">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium">
                                                {selectedUser.displayName}
                                            </p>
                                            <p className="truncate text-xs text-muted-foreground">
                                                {selectedUser.email ??
                                                    'No email'}
                                            </p>
                                        </div>
                                        <Badge variant="secondary">
                                            {getAccessLabel(personAccess)}
                                        </Badge>
                                    </div>
                                ) : null}
                            </section>

                            <section className="space-y-3 rounded-xl border bg-card/40 p-4">
                                <div>
                                    <h3 className="text-sm font-semibold">
                                        People with access
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                        Owners can update roles or remove direct
                                        access at any time.
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    {sharing.owner ? (
                                        <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed bg-background p-3">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <Avatar className="size-9">
                                                    <AvatarFallback className="text-xs font-semibold">
                                                        {getInitials(
                                                            sharing.owner
                                                        )}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-medium">
                                                        {
                                                            sharing.owner
                                                                .displayName
                                                        }
                                                    </p>
                                                    <p className="truncate text-xs text-muted-foreground">
                                                        {sharing.owner.email ??
                                                            'No email'}
                                                    </p>
                                                </div>
                                            </div>
                                            <Badge variant="secondary">
                                                Owner
                                            </Badge>
                                        </div>
                                    ) : null}

                                    {peopleWithAccess.length === 0 ? (
                                        <div className="rounded-lg border bg-background px-3 py-6 text-center text-sm text-muted-foreground">
                                            Only the owner has direct access
                                            right now.
                                        </div>
                                    ) : (
                                        peopleWithAccess.map((person) => (
                                            <div
                                                key={person.user.id}
                                                className="flex flex-col gap-3 rounded-lg border bg-background p-3 md:flex-row md:items-center md:justify-between"
                                            >
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <Avatar className="size-9">
                                                        <AvatarFallback className="text-xs font-semibold">
                                                            {getInitials(
                                                                person.user
                                                            )}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-medium">
                                                            {
                                                                person.user
                                                                    .displayName
                                                            }
                                                        </p>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <p className="truncate text-xs text-muted-foreground">
                                                                {person.user
                                                                    .email ??
                                                                    'No email'}
                                                            </p>
                                                            <Badge
                                                                variant="outline"
                                                                className="text-[10px] uppercase tracking-[0.14em]"
                                                            >
                                                                {getAccessLabel(
                                                                    person.access
                                                                )}
                                                            </Badge>
                                                        </div>
                                                        <p className="mt-1 text-[11px] text-muted-foreground">
                                                            Updated{' '}
                                                            {formatAccessTimestamp(
                                                                person.updatedAt
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <Select
                                                        value={person.access}
                                                        onValueChange={(
                                                            value
                                                        ) =>
                                                            void handleUpdatePerson(
                                                                person.user.id,
                                                                value as SharingAccess
                                                            )
                                                        }
                                                        disabled={
                                                            mutatingUserId ===
                                                            person.user.id
                                                        }
                                                    >
                                                        <SelectTrigger className="w-[132px]">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="view">
                                                                Viewer
                                                            </SelectItem>
                                                            <SelectItem value="edit">
                                                                Editor
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <Button
                                                        type="button"
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={() =>
                                                            void handleRemovePerson(
                                                                person.user.id
                                                            )
                                                        }
                                                        disabled={
                                                            mutatingUserId ===
                                                            person.user.id
                                                        }
                                                    >
                                                        <Trash2 className="size-4 text-red-600" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </section>

                            <Separator />

                            <section className="space-y-4 rounded-xl border bg-card/40 p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <h3 className="text-sm font-semibold">
                                            General access
                                        </h3>
                                        <p className="text-xs text-muted-foreground">
                                            Choose whether access stays
                                            restricted or can be opened with a
                                            shareable link.
                                        </p>
                                    </div>
                                    <Badge variant="secondary">
                                        <Link2 className="mr-1 size-3" />
                                        {generalAccessScope === 'link'
                                            ? 'Link enabled'
                                            : 'Restricted'}
                                    </Badge>
                                </div>

                                {legacyAuthenticatedAccess ? (
                                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                        This item still has legacy
                                        signed-in-user access enabled. Saving
                                        this section will switch it to the new
                                        restricted or link-based model.
                                    </div>
                                ) : null}

                                <div className="space-y-3">
                                    <span className="text-xs font-medium text-muted-foreground">
                                        Access mode
                                    </span>
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <button
                                            type="button"
                                            className={cn(
                                                'rounded-xl border p-3 text-left transition-colors',
                                                generalAccessScope === 'private'
                                                    ? 'border-primary bg-primary/5'
                                                    : 'bg-background hover:border-primary/40'
                                            )}
                                            onClick={() =>
                                                setGeneralAccessScope('private')
                                            }
                                        >
                                            <p className="text-sm font-semibold">
                                                Restricted
                                            </p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                Only people you add directly can
                                                open this item.
                                            </p>
                                        </button>
                                        <button
                                            type="button"
                                            className={cn(
                                                'rounded-xl border p-3 text-left transition-colors',
                                                generalAccessScope === 'link'
                                                    ? 'border-primary bg-primary/5'
                                                    : 'bg-background hover:border-primary/40'
                                            )}
                                            onClick={() =>
                                                setGeneralAccessScope('link')
                                            }
                                        >
                                            <p className="text-sm font-semibold">
                                                Anyone with the link
                                            </p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                Use a shareable link with a role
                                                and optional expiration.
                                            </p>
                                        </button>
                                    </div>
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <span className="text-xs font-medium text-muted-foreground">
                                            Link role
                                        </span>
                                        <div className="grid grid-cols-2 gap-2">
                                            {(
                                                [
                                                    'view',
                                                    'edit',
                                                ] as SharingAccess[]
                                            ).map((access) => (
                                                <Button
                                                    key={access}
                                                    type="button"
                                                    variant={
                                                        generalAccessRole ===
                                                        access
                                                            ? 'default'
                                                            : 'outline'
                                                    }
                                                    className="justify-start"
                                                    onClick={() =>
                                                        setGeneralAccessRole(
                                                            access
                                                        )
                                                    }
                                                    disabled={
                                                        generalAccessScope !==
                                                        'link'
                                                    }
                                                >
                                                    {getAccessLabel(access)}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <span className="text-xs font-medium text-muted-foreground">
                                            Expiration
                                        </span>
                                        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                                            {(
                                                [
                                                    ['never', 'Never'],
                                                    ['1h', '1 hour'],
                                                    ['1d', '1 day'],
                                                    ['7d', '7 days'],
                                                    ['custom', 'Custom'],
                                                ] satisfies Array<
                                                    [ExpirationPreset, string]
                                                >
                                            ).map(([preset, label]) => (
                                                <Button
                                                    key={preset}
                                                    type="button"
                                                    variant={
                                                        expirationPreset ===
                                                        preset
                                                            ? 'default'
                                                            : 'outline'
                                                    }
                                                    className="justify-start"
                                                    onClick={() =>
                                                        setExpirationPreset(
                                                            preset
                                                        )
                                                    }
                                                    disabled={
                                                        generalAccessScope !==
                                                        'link'
                                                    }
                                                >
                                                    {label}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {generalAccessScope === 'link' &&
                                expirationPreset === 'custom' ? (
                                    <div className="space-y-2">
                                        <span className="text-xs font-medium text-muted-foreground">
                                            Custom expiration
                                        </span>
                                        <Input
                                            type="datetime-local"
                                            value={customExpiration}
                                            onChange={(event) =>
                                                setCustomExpiration(
                                                    event.target.value
                                                )
                                            }
                                        />
                                    </div>
                                ) : null}

                                <div className="rounded-lg border bg-background p-3 text-sm text-muted-foreground">
                                    {pendingGeneralAccessSummary}
                                </div>

                                <div className="space-y-2">
                                    <span className="text-xs font-medium text-muted-foreground">
                                        Share link
                                    </span>
                                    <div className="flex flex-col gap-2 md:flex-row">
                                        <Input
                                            value={shareUrl}
                                            readOnly
                                            placeholder="Link access is not enabled yet."
                                        />
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            onClick={() => void handleCopy()}
                                            disabled={!shareUrl}
                                        >
                                            <Copy className="mr-2 size-4" />
                                            Copy link
                                        </Button>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 md:flex-row md:justify-end">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={() =>
                                            void handleSaveGeneralAccess(true)
                                        }
                                        disabled={
                                            generalAccessScope !== 'link' ||
                                            !shareUrl ||
                                            savingGeneralAccess
                                        }
                                    >
                                        <RotateCw className="mr-2 size-4" />
                                        Rotate link
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={() =>
                                            void handleSaveGeneralAccess()
                                        }
                                        disabled={savingGeneralAccess}
                                    >
                                        Save general access
                                    </Button>
                                </div>
                            </section>
                        </>
                    )}
                </DialogInternalContent>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => onOpenChange(false)}
                    >
                        Done
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
