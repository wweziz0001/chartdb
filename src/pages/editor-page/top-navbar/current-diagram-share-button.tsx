import React, { useEffect, useState } from 'react';
import { Button } from '@/components/button/button';
import { SharingSettingsDialog } from '@/dialogs/open-diagram-dialog/sharing-settings-dialog';
import { useChartDB } from '@/hooks/use-chartdb';
import { useStorage } from '@/hooks/use-storage';
import { useSharingDialogApi } from '@/features/persistence/hooks/use-sharing-dialog-api';
import type { SavedDiagram } from '@/context/storage-context/storage-context';
import { Share2 } from 'lucide-react';

export const CurrentDiagramShareButton: React.FC = () => {
    const { currentDiagram } = useChartDB();
    const { getSavedDiagram } = useStorage();
    const sharingApi = useSharingDialogApi();
    const [open, setOpen] = useState(false);
    const [savedDiagram, setSavedDiagram] = useState<
        SavedDiagram | undefined
    >();

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            if (!currentDiagram?.id) {
                setSavedDiagram(undefined);
                return;
            }

            try {
                const nextSavedDiagram = await getSavedDiagram(
                    currentDiagram.id
                );
                if (!cancelled) {
                    setSavedDiagram(nextSavedDiagram);
                }
            } catch {
                if (!cancelled) {
                    setSavedDiagram(undefined);
                }
            }
        };

        void run();

        return () => {
            cancelled = true;
        };
    }, [currentDiagram?.id, getSavedDiagram]);

    const canShare = Boolean(
        savedDiagram &&
        !savedDiagram.localOnly &&
        savedDiagram.access === 'owner'
    );

    return (
        <>
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(true)}
                disabled={!canShare}
            >
                <Share2 className="mr-2 size-4" />
                Share
            </Button>

            <SharingSettingsDialog
                open={open}
                onOpenChange={setOpen}
                subject={
                    savedDiagram && !savedDiagram.localOnly
                        ? {
                              type: 'diagram',
                              id: savedDiagram.id,
                              name: savedDiagram.name,
                          }
                        : null
                }
                loadSharing={sharingApi.loadSharing}
                searchUsers={sharingApi.searchUsers}
                addPerson={sharingApi.addPerson}
                updatePerson={sharingApi.updatePerson}
                removePerson={sharingApi.removePerson}
                updateGeneralAccess={sharingApi.updateGeneralAccess}
            />
        </>
    );
};
