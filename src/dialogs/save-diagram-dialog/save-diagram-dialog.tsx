import React, { useEffect, useMemo, useState } from 'react';
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
import { Input } from '@/components/input/input';
import { Label } from '@/components/label/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/select/select';
import { Textarea } from '@/components/textarea/textarea';
import { useChartDB } from '@/hooks/use-chartdb';
import { useConfig } from '@/hooks/use-config';
import { useDialog } from '@/hooks/use-dialog';
import { useStorage } from '@/hooks/use-storage';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { BaseDialogProps } from '../common/base-dialog-props';

const NEW_PROJECT_VALUE = '__new_project__';

export interface SaveDiagramDialogProps extends BaseDialogProps {}

export const SaveDiagramDialog: React.FC<SaveDiagramDialogProps> = ({
    dialog,
}) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { currentDiagram } = useChartDB();
    const { updateConfig } = useConfig();
    const { closeSaveDiagramDialog } = useDialog();
    const { listProjects, getSavedDiagram, saveDiagramAs } = useStorage();
    const [projects, setProjects] = useState<
        Array<{ id: string; name: string }>
    >([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [newProjectName, setNewProjectName] = useState('');
    const [newProjectDescription, setNewProjectDescription] = useState('');
    const [error, setError] = useState<string>();
    const isCreatingProject = selectedProjectId === NEW_PROJECT_VALUE;

    useEffect(() => {
        if (!dialog.open) {
            return;
        }

        const load = async () => {
            const [savedDiagram, savedProjects] = await Promise.all([
                getSavedDiagram(currentDiagram.id),
                listProjects(),
            ]);
            setProjects(
                savedProjects.map((project) => ({
                    id: project.id,
                    name: project.name,
                }))
            );
            setSelectedProjectId(
                savedDiagram?.projectId ??
                    savedProjects[0]?.id ??
                    NEW_PROJECT_VALUE
            );
            setName(`${currentDiagram.name} Copy`);
            setDescription(savedDiagram?.description ?? '');
            setNewProjectName('');
            setNewProjectDescription('');
            setError(undefined);
        };

        void load();
    }, [
        currentDiagram.id,
        currentDiagram.name,
        dialog.open,
        getSavedDiagram,
        listProjects,
    ]);

    const canSubmit = useMemo(() => {
        if (!name.trim()) {
            return false;
        }

        if (isCreatingProject) {
            return newProjectName.trim().length > 0;
        }

        return selectedProjectId.trim().length > 0;
    }, [isCreatingProject, name, newProjectName, selectedProjectId]);

    return (
        <Dialog
            {...dialog}
            onOpenChange={(open) => {
                if (!open) {
                    closeSaveDiagramDialog();
                }
            }}
        >
            <DialogContent className="sm:max-w-[560px]" showClose>
                <DialogHeader>
                    <DialogTitle>{t('save_diagram_dialog.title')}</DialogTitle>
                    <DialogDescription>
                        {t('save_diagram_dialog.description')}
                    </DialogDescription>
                </DialogHeader>

                <form
                    className="grid gap-4"
                    onSubmit={async (event) => {
                        event.preventDefault();
                        setError(undefined);

                        try {
                            const nextDiagram = await saveDiagramAs({
                                diagramId: currentDiagram.id,
                                name: name.trim(),
                                description: description.trim() || null,
                                projectId: isCreatingProject
                                    ? undefined
                                    : selectedProjectId,
                                createProject: isCreatingProject
                                    ? {
                                          name: newProjectName.trim(),
                                          description:
                                              newProjectDescription.trim() ||
                                              null,
                                      }
                                    : undefined,
                            });

                            if (!nextDiagram) {
                                return;
                            }

                            await updateConfig({
                                config: { defaultDiagramId: nextDiagram.id },
                            });
                            closeSaveDiagramDialog();
                            navigate(`/diagrams/${nextDiagram.id}`);
                        } catch (submitError) {
                            setError(
                                submitError instanceof Error
                                    ? submitError.message
                                    : t('save_diagram_dialog.error')
                            );
                        }
                    }}
                >
                    <div className="grid gap-2">
                        <Label htmlFor="save-diagram-name">
                            {t('save_diagram_dialog.fields.name')}
                        </Label>
                        <Input
                            id="save-diagram-name"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="save-diagram-description">
                            {t('save_diagram_dialog.fields.description')}
                        </Label>
                        <Textarea
                            id="save-diagram-description"
                            value={description}
                            onChange={(event) =>
                                setDescription(event.target.value)
                            }
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label>{t('save_diagram_dialog.fields.project')}</Label>
                        <Select
                            value={selectedProjectId}
                            onValueChange={setSelectedProjectId}
                        >
                            <SelectTrigger>
                                <SelectValue
                                    placeholder={t(
                                        'save_diagram_dialog.fields.project_placeholder'
                                    )}
                                />
                            </SelectTrigger>
                            <SelectContent>
                                {projects.map((project) => (
                                    <SelectItem
                                        key={project.id}
                                        value={project.id}
                                    >
                                        {project.name}
                                    </SelectItem>
                                ))}
                                <SelectItem value={NEW_PROJECT_VALUE}>
                                    {t(
                                        'save_diagram_dialog.fields.create_project'
                                    )}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {isCreatingProject ? (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="save-diagram-project-name">
                                    {t(
                                        'save_diagram_dialog.fields.project_name'
                                    )}
                                </Label>
                                <Input
                                    id="save-diagram-project-name"
                                    value={newProjectName}
                                    onChange={(event) =>
                                        setNewProjectName(event.target.value)
                                    }
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="save-diagram-project-description">
                                    {t(
                                        'save_diagram_dialog.fields.project_description'
                                    )}
                                </Label>
                                <Textarea
                                    id="save-diagram-project-description"
                                    value={newProjectDescription}
                                    onChange={(event) =>
                                        setNewProjectDescription(
                                            event.target.value
                                        )
                                    }
                                />
                            </div>
                        </>
                    ) : null}

                    {error ? (
                        <p className="text-sm text-red-700">{error}</p>
                    ) : null}

                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="secondary">
                                {t('delete_diagram_alert.cancel')}
                            </Button>
                        </DialogClose>
                        <Button type="submit" disabled={!canSubmit}>
                            {t('save_diagram_dialog.submit')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
