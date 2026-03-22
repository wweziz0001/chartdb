import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/button/button';
import { DiagramIcon } from '@/components/diagram-icon/diagram-icon';
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/table/table';
import { useConfig } from '@/hooks/use-config';
import { useDialog } from '@/hooks/use-dialog';
import { useStorage } from '@/hooks/use-storage';
import type {
    SavedDiagram,
    SavedProject,
} from '@/context/storage-context/storage-context';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { BaseDialogProps } from '../common/base-dialog-props';
import { DiagramRowActionsMenu } from './diagram-row-actions-menu/diagram-row-actions-menu';
import { useAlert } from '@/context/alert-context/alert-context';
import { cn } from '@/lib/utils';
import { useChartDB } from '@/hooks/use-chartdb';
import type { DatabaseType } from '@/lib/domain/database-type';
import type { DatabaseEdition } from '@/lib/domain/database-edition';

export interface OpenDiagramDialogProps extends BaseDialogProps {
    canClose?: boolean;
}

export const OpenDiagramDialog: React.FC<OpenDiagramDialogProps> = ({
    dialog,
    canClose = true,
}) => {
    const { closeOpenDiagramDialog, openCreateDiagramDialog } = useDialog();
    const { t } = useTranslation();
    const { updateConfig } = useConfig();
    const navigate = useNavigate();
    const {
        listProjects,
        createProject,
        updateProject,
        deleteProject,
        listProjectDiagrams,
        updateSavedDiagram,
        deleteDiagram,
    } = useStorage();
    const { showAlert } = useAlert();
    const { diagramId: currentDiagramId, loadDiagram } = useChartDB();
    const [projects, setProjects] = useState<SavedProject[]>([]);
    const [diagrams, setDiagrams] = useState<SavedDiagram[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<
        string | undefined
    >();
    const [selectedDiagramId, setSelectedDiagramId] = useState<
        string | undefined
    >();

    const selectedProject = useMemo(
        () => projects.find((project) => project.id === selectedProjectId),
        [projects, selectedProjectId]
    );

    const fetchProjects = useCallback(async () => {
        const nextProjects = await listProjects();
        setProjects(nextProjects);
        setSelectedProjectId((currentProjectId) => {
            if (
                currentProjectId &&
                nextProjects.some((project) => project.id === currentProjectId)
            ) {
                return currentProjectId;
            }

            return nextProjects[0]?.id;
        });
    }, [listProjects]);

    const fetchProjectDiagrams = useCallback(
        async (projectId: string) => {
            const nextDiagrams = await listProjectDiagrams(projectId);
            setDiagrams(nextDiagrams);
            setSelectedDiagramId((currentDiagramSelection) => {
                if (
                    currentDiagramSelection &&
                    nextDiagrams.some(
                        (diagram) => diagram.id === currentDiagramSelection
                    )
                ) {
                    return currentDiagramSelection;
                }

                return nextDiagrams[0]?.id;
            });
        },
        [listProjectDiagrams]
    );

    useEffect(() => {
        if (!dialog.open) {
            return;
        }

        setDiagrams([]);
        setSelectedDiagramId(undefined);
        void fetchProjects();
    }, [dialog.open, fetchProjects]);

    useEffect(() => {
        if (!dialog.open || !selectedProjectId) {
            return;
        }

        void fetchProjectDiagrams(selectedProjectId);
    }, [dialog.open, fetchProjectDiagrams, selectedProjectId]);

    const openDiagram = useCallback(
        (diagramId: string) => {
            if (!diagramId) {
                return;
            }

            updateConfig({ config: { defaultDiagramId: diagramId } });
            navigate(`/diagrams/${diagramId}`);
        },
        [navigate, updateConfig]
    );

    const promptForName = useCallback((title: string, value = '') => {
        const result = window.prompt(title, value)?.trim();
        return result && result.length > 0 ? result : undefined;
    }, []);

    const handleCreateProject = useCallback(async () => {
        const name = promptForName(
            t('open_diagram_dialog.project_actions.create_prompt')
        );
        if (!name) {
            return;
        }

        const description =
            window
                .prompt(
                    t('open_diagram_dialog.project_actions.description_prompt'),
                    ''
                )
                ?.trim() ?? '';
        const project = await createProject({
            name,
            description: description || null,
        });
        await fetchProjects();
        setSelectedProjectId(project.id);
    }, [createProject, fetchProjects, promptForName, t]);

    const handleRenameProject = useCallback(async () => {
        if (!selectedProject) {
            return;
        }

        const name = promptForName(
            t('open_diagram_dialog.project_actions.rename_prompt'),
            selectedProject.name
        );
        if (!name) {
            return;
        }

        await updateProject(selectedProject.id, {
            name,
            description: selectedProject.description,
        });
        await fetchProjects();
    }, [fetchProjects, promptForName, selectedProject, t, updateProject]);

    const handleDeleteProject = useCallback(() => {
        if (!selectedProject) {
            return;
        }

        showAlert({
            title: t('open_diagram_dialog.project_actions.delete'),
            description: t(
                'open_diagram_dialog.project_actions.delete_description',
                {
                    name: selectedProject.name,
                }
            ),
            closeLabel: t('clear_diagram_alert.cancel'),
            actionLabel: t('delete_diagram_alert.delete'),
            onAction: async () => {
                const diagramsInProject = await listProjectDiagrams(
                    selectedProject.id
                );
                await deleteProject(selectedProject.id);
                if (
                    diagramsInProject.some(
                        (diagram) => diagram.id === currentDiagramId
                    )
                ) {
                    navigate('/');
                }
                await fetchProjects();
            },
        });
    }, [
        currentDiagramId,
        deleteProject,
        fetchProjects,
        listProjectDiagrams,
        navigate,
        selectedProject,
        showAlert,
        t,
    ]);

    const handleRenameDiagram = useCallback(
        async (diagram: SavedDiagram) => {
            const name = promptForName(
                t('open_diagram_dialog.diagram_actions.rename_prompt'),
                diagram.name
            );
            if (!name) {
                return;
            }

            await updateSavedDiagram(diagram.id, {
                name,
                description: diagram.description,
                projectId: diagram.projectId,
            });

            if (diagram.id === currentDiagramId) {
                await loadDiagram(diagram.id);
            }

            await fetchProjectDiagrams(diagram.projectId);
        },
        [
            currentDiagramId,
            fetchProjectDiagrams,
            loadDiagram,
            promptForName,
            t,
            updateSavedDiagram,
        ]
    );

    const handleDeleteDiagram = useCallback(
        (diagram: SavedDiagram) => {
            showAlert({
                title: t('delete_diagram_alert.title'),
                description: t('delete_diagram_alert.description'),
                closeLabel: t('delete_diagram_alert.cancel'),
                actionLabel: t('delete_diagram_alert.delete'),
                onAction: async () => {
                    await deleteDiagram(diagram.id);
                    if (diagram.id === currentDiagramId) {
                        navigate('/');
                    }
                    await fetchProjects();
                    await fetchProjectDiagrams(diagram.projectId);
                },
            });
        },
        [
            currentDiagramId,
            deleteDiagram,
            fetchProjectDiagrams,
            fetchProjects,
            navigate,
            showAlert,
            t,
        ]
    );

    const selectedDiagram = diagrams.find(
        (diagram) => diagram.id === selectedDiagramId
    );

    return (
        <Dialog
            {...dialog}
            onOpenChange={(open) => {
                if (!open && canClose) {
                    closeOpenDiagramDialog();
                }
            }}
        >
            <DialogContent
                className="flex h-[36rem] max-h-screen flex-col overflow-y-auto md:min-w-[88vw] xl:min-w-[68vw]"
                showClose={canClose}
            >
                <DialogHeader>
                    <DialogTitle>{t('open_diagram_dialog.title')}</DialogTitle>
                    <DialogDescription>
                        {t('open_diagram_dialog.description')}
                    </DialogDescription>
                </DialogHeader>
                <DialogInternalContent className="pr-2">
                    <div className="grid h-full gap-4 md:grid-cols-[260px_minmax(0,1fr)]">
                        <div className="flex flex-col gap-3 rounded-lg border p-3">
                            <div className="flex items-center justify-between gap-2">
                                <h2 className="text-sm font-semibold">
                                    {t('open_diagram_dialog.projects')}
                                </h2>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    onClick={handleCreateProject}
                                >
                                    {t(
                                        'open_diagram_dialog.project_actions.create'
                                    )}
                                </Button>
                            </div>
                            <div className="flex flex-col gap-1">
                                {projects.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                        {t(
                                            'open_diagram_dialog.empty_projects'
                                        )}
                                    </p>
                                ) : (
                                    projects.map((project) => (
                                        <button
                                            key={project.id}
                                            type="button"
                                            className={cn(
                                                'rounded-md border px-3 py-2 text-left transition-colors',
                                                selectedProjectId === project.id
                                                    ? 'border-foreground/20 bg-accent'
                                                    : 'hover:bg-accent/50'
                                            )}
                                            onClick={() =>
                                                setSelectedProjectId(project.id)
                                            }
                                        >
                                            <div className="truncate text-sm font-medium">
                                                {project.name}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {t(
                                                    'open_diagram_dialog.project_count',
                                                    {
                                                        count: project.diagramCount,
                                                    }
                                                )}
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="flex min-h-0 flex-col rounded-lg border p-3">
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <h2 className="text-sm font-semibold">
                                        {selectedProject?.name ??
                                            t(
                                                'open_diagram_dialog.no_project_selected'
                                            )}
                                    </h2>
                                    {selectedProject?.description ? (
                                        <p className="text-sm text-muted-foreground">
                                            {selectedProject.description}
                                        </p>
                                    ) : null}
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="secondary"
                                        disabled={
                                            !selectedProject ||
                                            selectedProject.localOnly
                                        }
                                        onClick={handleRenameProject}
                                    >
                                        {t(
                                            'open_diagram_dialog.project_actions.rename'
                                        )}
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="secondary"
                                        disabled={
                                            !selectedProject ||
                                            selectedProject.localOnly
                                        }
                                        onClick={handleDeleteProject}
                                    >
                                        {t(
                                            'open_diagram_dialog.project_actions.delete'
                                        )}
                                    </Button>
                                </div>
                            </div>

                            <div className="min-h-0 flex-1 overflow-auto">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-background">
                                        <TableRow>
                                            <TableHead />
                                            <TableHead>
                                                {t(
                                                    'open_diagram_dialog.table_columns.name'
                                                )}
                                            </TableHead>
                                            <TableHead className="hidden sm:table-cell">
                                                {t(
                                                    'open_diagram_dialog.table_columns.created_at'
                                                )}
                                            </TableHead>
                                            <TableHead>
                                                {t(
                                                    'open_diagram_dialog.table_columns.last_modified'
                                                )}
                                            </TableHead>
                                            <TableHead className="text-center">
                                                {t(
                                                    'open_diagram_dialog.table_columns.tables_count'
                                                )}
                                            </TableHead>
                                            <TableHead />
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {diagrams.map((diagram) => (
                                            <TableRow
                                                key={diagram.id}
                                                data-state={
                                                    selectedDiagramId ===
                                                    diagram.id
                                                        ? 'selected'
                                                        : undefined
                                                }
                                                className="cursor-pointer"
                                                onClick={() =>
                                                    setSelectedDiagramId(
                                                        diagram.id
                                                    )
                                                }
                                                onDoubleClick={() => {
                                                    openDiagram(diagram.id);
                                                    closeOpenDiagramDialog();
                                                }}
                                            >
                                                <TableCell>
                                                    <div className="flex justify-center">
                                                        <DiagramIcon
                                                            databaseType={
                                                                diagram.databaseType as DatabaseType
                                                            }
                                                            databaseEdition={
                                                                (diagram.databaseEdition ??
                                                                    undefined) as
                                                                    | DatabaseEdition
                                                                    | undefined
                                                            }
                                                        />
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {diagram.name}
                                                </TableCell>
                                                <TableCell className="hidden sm:table-cell">
                                                    {diagram.createdAt.toLocaleString()}
                                                </TableCell>
                                                <TableCell>
                                                    {diagram.updatedAt.toLocaleString()}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {diagram.tableCount}
                                                </TableCell>
                                                <TableCell className="p-0 pr-1 text-right">
                                                    <DiagramRowActionsMenu
                                                        onOpen={() => {
                                                            openDiagram(
                                                                diagram.id
                                                            );
                                                            closeOpenDiagramDialog();
                                                        }}
                                                        onRename={() =>
                                                            void handleRenameDiagram(
                                                                diagram
                                                            )
                                                        }
                                                        onDelete={() =>
                                                            handleDeleteDiagram(
                                                                diagram
                                                            )
                                                        }
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>

                                {diagrams.length === 0 ? (
                                    <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                                        {t(
                                            'open_diagram_dialog.empty_diagrams'
                                        )}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </DialogInternalContent>

                <DialogFooter className="flex !justify-between gap-2">
                    {canClose ? (
                        <DialogClose asChild>
                            <Button type="button" variant="secondary">
                                {t('open_diagram_dialog.cancel')}
                            </Button>
                        </DialogClose>
                    ) : (
                        <div />
                    )}
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                                closeOpenDiagramDialog();
                                openCreateDiagramDialog();
                            }}
                        >
                            {t('open_diagram_dialog.new_database')}
                        </Button>
                        <DialogClose asChild>
                            <Button
                                type="submit"
                                disabled={!selectedDiagram}
                                onClick={() => {
                                    if (selectedDiagram) {
                                        openDiagram(selectedDiagram.id);
                                    }
                                }}
                            >
                                {t('open_diagram_dialog.open')}
                            </Button>
                        </DialogClose>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
