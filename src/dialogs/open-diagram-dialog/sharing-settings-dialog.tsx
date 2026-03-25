import React, { useEffect, useMemo, useState } from 'react';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/select/select';
import type {
    PersistedSharingSettings,
    SharingAccess,
    SharingScope,
} from '@/features/persistence/api/persistence-client';
import { useTranslation } from 'react-i18next';

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
    saveSharing: (
        subject: { type: 'project' | 'diagram'; id: string },
        params: {
            scope: SharingScope;
            access: SharingAccess;
            rotateLinkToken?: boolean;
        }
    ) => Promise<PersistedSharingSettings>;
    onSaved?: () => Promise<void> | void;
}

export const SharingSettingsDialog: React.FC<SharingSettingsDialogProps> = ({
    open,
    onOpenChange,
    subject,
    loadSharing,
    saveSharing,
    onSaved,
}) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [scope, setScope] = useState<SharingScope>('private');
    const [access, setAccess] = useState<SharingAccess>('view');
    const [sharePath, setSharePath] = useState<string | null>(null);

    useEffect(() => {
        if (!open || !subject) {
            return;
        }

        let cancelled = false;

        const run = async () => {
            setLoading(true);
            setError(null);

            try {
                const sharing = await loadSharing(subject);
                if (!cancelled) {
                    setScope(sharing.scope);
                    setAccess(sharing.access);
                    setSharePath(sharing.sharePath);
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
    }, [loadSharing, open, subject, t]);

    const shareUrl = useMemo(() => {
        if (!sharePath || typeof window === 'undefined') {
            return '';
        }

        return `${window.location.origin}${sharePath}`;
    }, [sharePath]);

    const handleSave = async (rotateLinkToken = false) => {
        if (!subject) {
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const nextSharing = await saveSharing(subject, {
                scope,
                access: scope === 'link' ? 'view' : access,
                rotateLinkToken,
            });
            setScope(nextSharing.scope);
            setAccess(nextSharing.access);
            setSharePath(nextSharing.sharePath);
            await onSaved?.();
        } catch (caughtError) {
            setError(
                caughtError instanceof Error
                    ? caughtError.message
                    : t('open_diagram_dialog.sharing.error_save')
            );
        } finally {
            setSaving(false);
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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl">
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
                        {t('open_diagram_dialog.sharing.description')}
                    </DialogDescription>
                </DialogHeader>

                <DialogInternalContent className="space-y-4">
                    {loading ? (
                        <p className="text-sm text-muted-foreground">
                            {t('open_diagram_dialog.sharing.loading')}
                        </p>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">
                                    {t(
                                        'open_diagram_dialog.sharing.mode_label'
                                    )}
                                </label>
                                <Select
                                    value={scope}
                                    onValueChange={(value) =>
                                        setScope(value as SharingScope)
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="private">
                                            {t(
                                                'open_diagram_dialog.sharing.mode_private'
                                            )}
                                        </SelectItem>
                                        <SelectItem value="authenticated">
                                            {t(
                                                'open_diagram_dialog.sharing.mode_authenticated'
                                            )}
                                        </SelectItem>
                                        <SelectItem value="link">
                                            {t(
                                                'open_diagram_dialog.sharing.mode_link'
                                            )}
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    {scope === 'private'
                                        ? t(
                                              'open_diagram_dialog.sharing.mode_private_help'
                                          )
                                        : scope === 'authenticated'
                                          ? t(
                                                'open_diagram_dialog.sharing.mode_authenticated_help'
                                            )
                                          : t(
                                                'open_diagram_dialog.sharing.mode_link_help'
                                            )}
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">
                                    {t(
                                        'open_diagram_dialog.sharing.access_label'
                                    )}
                                </label>
                                <Select
                                    value={scope === 'link' ? 'view' : access}
                                    onValueChange={(value) =>
                                        setAccess(value as SharingAccess)
                                    }
                                    disabled={scope === 'link'}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="view">
                                            {t(
                                                'open_diagram_dialog.sharing.access_view'
                                            )}
                                        </SelectItem>
                                        <SelectItem value="edit">
                                            {t(
                                                'open_diagram_dialog.sharing.access_edit'
                                            )}
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    {scope === 'link'
                                        ? t(
                                              'open_diagram_dialog.sharing.link_read_only'
                                          )
                                        : t(
                                              'open_diagram_dialog.sharing.access_help'
                                          )}
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">
                                    {t(
                                        'open_diagram_dialog.sharing.link_label'
                                    )}
                                </label>
                                <div className="flex gap-2">
                                    <Input value={shareUrl} readOnly />
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={() => void handleCopy()}
                                        disabled={!shareUrl}
                                    >
                                        {t(
                                            'open_diagram_dialog.sharing.copy_link'
                                        )}
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {shareUrl
                                        ? t(
                                              'open_diagram_dialog.sharing.link_ready'
                                          )
                                        : t(
                                              'open_diagram_dialog.sharing.link_inactive'
                                          )}
                                </p>
                            </div>

                            {error ? (
                                <p className="text-sm text-red-700">{error}</p>
                            ) : null}
                        </>
                    )}
                </DialogInternalContent>

                <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => onOpenChange(false)}
                        >
                            {t('open_diagram_dialog.cancel')}
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => void handleSave(true)}
                            disabled={saving || loading || scope !== 'link'}
                        >
                            {t('open_diagram_dialog.sharing.rotate_link')}
                        </Button>
                    </div>
                    <Button
                        type="button"
                        onClick={() => void handleSave(false)}
                        disabled={saving || loading}
                    >
                        {t('open_diagram_dialog.sharing.save')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
