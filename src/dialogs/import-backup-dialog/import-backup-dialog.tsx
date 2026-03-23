import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/alert/alert';
import { Button } from '@/components/button/button';
import { FileUploader } from '@/components/file-uploader/file-uploader';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogInternalContent,
    DialogTitle,
} from '@/components/dialog/dialog';
import { Spinner } from '@/components/spinner/spinner';
import { useToast } from '@/components/toast/use-toast';
import { useDialog } from '@/hooks/use-dialog';
import { useStorage } from '@/hooks/use-storage';
import {
    parseChartDbBackupArchive,
    CHARTDB_BACKUP_FILE_EXTENSION,
} from '@/lib/project-backup/project-backup-format';
import { ZodError } from 'zod';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { BaseDialogProps } from '../common/base-dialog-props';

export interface ImportBackupDialogProps extends BaseDialogProps {}

export const ImportBackupDialog: React.FC<ImportBackupDialogProps> = ({
    dialog,
}) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { toast } = useToast();
    const { importBackup } = useStorage();
    const { closeImportBackupDialog } = useDialog();
    const [file, setFile] = useState<File | null>(null);
    const [errorMessage, setErrorMessage] = useState<string>();
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!dialog.open) {
            return;
        }

        setFile(null);
        setErrorMessage(undefined);
        setIsLoading(false);
    }, [dialog.open]);

    const onFileChange = useCallback((files: File[]) => {
        setFile(files[0] ?? null);
        setErrorMessage(undefined);
    }, []);

    const handleImport = useCallback(async () => {
        if (!file) {
            return;
        }

        setErrorMessage(undefined);
        setIsLoading(true);

        try {
            const rawText = await file.text();
            const parsedJson = JSON.parse(rawText) as unknown;
            const archive = parseChartDbBackupArchive(parsedJson);
            const result = await importBackup(archive);

            toast({
                title: t('backup_import_dialog.success.title'),
                description: t('backup_import_dialog.success.description', {
                    projects: result.projectCount,
                    diagrams: result.diagramCount,
                }),
            });

            closeImportBackupDialog();

            if (result.firstDiagramId) {
                navigate(`/diagrams/${result.firstDiagramId}`);
            }
        } catch (error) {
            if (error instanceof ZodError) {
                setErrorMessage(
                    error.issues[0]?.message ??
                        t('backup_import_dialog.error.description')
                );
            } else if (error instanceof SyntaxError) {
                setErrorMessage(t('backup_import_dialog.errors.invalid_json'));
            } else {
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : t('backup_import_dialog.error.description')
                );
            }
        } finally {
            setIsLoading(false);
        }
    }, [closeImportBackupDialog, file, importBackup, navigate, t, toast]);

    return (
        <Dialog
            {...dialog}
            onOpenChange={(open) => {
                if (!open) {
                    closeImportBackupDialog();
                }
            }}
        >
            <DialogContent className="flex max-h-screen flex-col" showClose>
                <DialogHeader>
                    <DialogTitle>{t('backup_import_dialog.title')}</DialogTitle>
                    <DialogDescription>
                        {t('backup_import_dialog.description')}
                    </DialogDescription>
                </DialogHeader>
                <DialogInternalContent>
                    <div className="flex flex-col p-1">
                        <FileUploader
                            supportedExtensions={[
                                CHARTDB_BACKUP_FILE_EXTENSION,
                                '.json',
                            ]}
                            onFilesChange={onFileChange}
                        />
                        {errorMessage ? (
                            <Alert variant="destructive" className="mt-2">
                                <AlertCircle className="size-4" />
                                <AlertTitle>
                                    {t('backup_import_dialog.error.title')}
                                </AlertTitle>
                                <AlertDescription>
                                    {errorMessage}
                                </AlertDescription>
                            </Alert>
                        ) : null}
                    </div>
                </DialogInternalContent>
                <DialogFooter className="flex gap-1 md:justify-between">
                    <DialogClose asChild>
                        <Button variant="secondary">
                            {t('backup_import_dialog.cancel')}
                        </Button>
                    </DialogClose>
                    <Button
                        onClick={handleImport}
                        disabled={file === null || isLoading}
                    >
                        {isLoading ? (
                            <Spinner className="mr-1 size-5 text-primary-foreground" />
                        ) : null}
                        {t('backup_import_dialog.import')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
