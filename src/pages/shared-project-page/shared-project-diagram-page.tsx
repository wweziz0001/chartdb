import React, { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { EditorPage } from '../editor-page/editor-page';
import { useSharedDiagram, persistenceClient } from './shared-diagram-loader';

export const SharedProjectDiagramPage: React.FC = () => {
    const { projectId, diagramId, shareToken } = useParams<{
        projectId: string;
        diagramId: string;
        shareToken: string;
    }>();

    const loadDiagram = useCallback(async () => {
        if (!projectId || !diagramId || !shareToken) {
            throw new Error('Shared project link is incomplete.');
        }

        return await persistenceClient.getSharedProjectDiagram(
            projectId,
            shareToken,
            diagramId
        );
    }, [diagramId, projectId, shareToken]);

    const { loading, error, diagram } = useSharedDiagram(loadDiagram);

    if (loading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-background">
                <div className="text-sm text-muted-foreground">
                    Loading shared project diagram...
                </div>
            </main>
        );
    }

    if (error || !diagram) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
                <div className="max-w-md space-y-2">
                    <h1 className="text-xl font-semibold">
                        Shared project diagram unavailable
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {error ??
                            'This shared project diagram is missing, expired, or no longer available.'}
                    </p>
                </div>
            </main>
        );
    }

    return <EditorPage initialDiagram={diagram} readonly />;
};
