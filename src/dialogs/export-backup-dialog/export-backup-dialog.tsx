import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/alert/alert';
import { Button } from '@/components/button/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/dialog/dialog';
import { SelectBox } from '@/components/select-box/select-box';
import { Spinner } from '@/components/spinner/spinner';
import { useToast } from '@/components/toast/use-toast';
import { useDialog } from '@/hooks/use-dialog';
import { useChartDB } from '@/hooks/use-chartdb';
import { useStorage } from '@/hooks/use-storage';
import {
    CHARTDB_BACKUP_FILE_EXTENSION,
    type ExportBackupRequest,
} from '@/lib/project-backup/project-backup-format';
import { useTranslation } from 'react-i18next';
import type { BaseDialogProps } from '../common/base-dialog-props';

type BackupScope = 'diagram' | 'project' | 'all-projects';

export interface ExportBackupDialogProps extends BaseDialogProps {}

const sanitizeFilenamePart = (value: string) =>
    value
        .trim()
        .replace(/[^a-z0-9-_]+/gi, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase();

export const ExportBackupDialog: React.FC<ExportBackupDialogProps> = ({
    dialog,
}) => {
    const { t } = useTranslation();
    const { toast } = useToast();
    const { currentDiagram } = useChartDB();
    const { getSavedDiagram, exportBackup } = useStorage();
    const { closeExportBackupDialog } = useDialog();
    const [scope, setScope] = useState<BackupScope>('all-projects');
    const [currentProjectId, setCurrentProjectId] = useState<string>();
    const [currentDiagramId, setCurrentDiagramId] = useState<string>();
    const [errorMessage, setErrorMessage] = useState<string>();
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!dialog.open) {
            return;
        }

        setErrorMessage(undefined);
        setIsLoading(false);

        void (async () => {
            const savedDiagram = await getSavedDiagram(currentDiagram.id);
            const diagramId = savedDiagram?.localOnly
                ? undefined
                : savedDiagram?.id;
            const projectId = savedDiagram?.localOnly
                ? undefined
                : savedDiagram?.projectId;

            setCurrentDiagramId(diagramId);
            setCurrentProjectId(projectId);
            setScope(projectId ? 'project' : 'all-projects');
        })();
    }, [currentDiagram.id, dialog.open, getSavedDiagram]);

    const scopeOptions = useMemo(
        () => [
            {
                value: 'diagram',
                label: t('backup_export_dialog.scope.diagram'),
            },
            {
                value: 'project',
                label: t('backup_export_dialog.scope.project'),
            },
            {
                value: 'all-projects',
                label: t('backup_export_dialog.scope.all_projects'),
            },
        ],
        [t]
    );

    const selectedScopeUnavailable =
        (scope === 'diagram' && !currentDiagramId) ||
        (scope === 'project' && !currentProjectId);

    const buildRequest = useCallback((): ExportBackupRequest => {
        switch (scope) {
            case 'diagram':
                if (!currentDiagramId) {
                    throw new Error(
                        t('backup_export_dialog.errors.unsaved_diagram')
                    );
                }
                return {
                    scope: 'diagrams',
                    diagramIds: [currentDiagramId],
                };
            case 'project':
                if (!currentProjectId) {
                    throw new Error(
                        t('backup_export_dialog.errors.unsaved_project')
                    );
                }
                return {
                    scope: 'projects',
                    projectIds: [currentProjectId],
                };
            case 'all-projects':
                return { scope: 'all-projects' };
        }
    }, [currentDiagramId, currentProjectId, scope, t]);

    const buildFilename = useCallback(() => {
        const today = new Date().toISOString().slice(0, 10);

        if (scope === 'diagram') {
            return `${sanitizeFilenamePart(currentDiagram.name || 'diagram')}-${today}${CHARTDB_BACKUP_FILE_EXTENSION}`;
        }

        if (scope === 'project') {
            return `chartdb-project-backup-${today}${CHARTDB_BACKUP_FILE_EXTENSION}`;
        }

        return `chartdb-backup-${today}${CHARTDB_BACKUP_FILE_EXTENSION}`;
    }, [currentDiagram.name, scope]);

    const handleExport = useCallback(async () => {
        setErrorMessage(undefined);
        setIsLoading(true);

        try {
            const archive = await exportBackup(buildRequest());
            const blob = new Blob([JSON.stringify(archive, null, 2)], {
                type: 'application/json',
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = buildFilename();
            link.click();
            URL.revokeObjectURL(url);

            toast({
                title: t('backup_export_dialog.success.title'),
                description: t('backup_export_dialog.success.description', {
                    projects: archive.counts.projectCount,
                    diagrams: archive.counts.diagramCount,
                }),
            });
            closeExportBackupDialog();
        } catch (error) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : t('backup_export_dialog.errors.generic')
            );
        } finally {
            setIsLoading(false);
        }
    }, [
        buildFilename,
        buildRequest,
        closeExportBackupDialog,
        exportBackup,
        t,
        toast,
    ]);

    return (
        <Dialog
            {...dialog}
            onOpenChange={(open) => {
                if (!open) {
                    closeExportBackupDialog();
                }
            }}
        >
            <DialogContent className="flex flex-col" showClose>
                <DialogHeader>
                    <DialogTitle>{t('backup_export_dialog.title')}</DialogTitle>
                    <DialogDescription>
                        {t('backup_export_dialog.description')}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-1">
                    <SelectBox
                        options={scopeOptions}
                        multiple={false}
                        value={scope}
                        onChange={(value) => setScope(value as BackupScope)}
                    />

                    {selectedScopeUnavailable ? (
                        <Alert>
                            <AlertCircle className="size-4" />
                            <AlertTitle>
                                {t('backup_export_dialog.warning.title')}
                            </AlertTitle>
                            <AlertDescription>
                                {t('backup_export_dialog.warning.description')}
                            </AlertDescription>
                        </Alert>
                    ) : null}

                    {errorMessage ? (
                        <Alert variant="destructive">
                            <AlertCircle className="size-4" />
                            <AlertTitle>
                                {t('backup_export_dialog.error.title')}
                            </AlertTitle>
                            <AlertDescription>{errorMessage}</AlertDescription>
                        </Alert>
                    ) : null}
                </div>

                <DialogFooter className="flex gap-1 md:justify-between">
                    <DialogClose asChild>
                        <Button variant="secondary">
                            {t('backup_export_dialog.cancel')}
                        </Button>
                    </DialogClose>
                    <Button
                        onClick={handleExport}
                        disabled={isLoading || selectedScopeUnavailable}
                    >
                        {isLoading ? (
                            <Spinner className="mr-1 size-5 text-primary-foreground" />
                        ) : null}
                        {t('backup_export_dialog.export')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
