import React, { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { EditorPage } from '../editor-page/editor-page';
import { useSharedDiagram, persistenceClient } from './shared-diagram-loader';

export const SharedDiagramPage: React.FC = () => {
    const { diagramId, shareToken } = useParams<{
        diagramId: string;
        shareToken: string;
    }>();

    const loadDiagram = useCallback(async () => {
        if (!diagramId || !shareToken) {
            throw new Error('Shared diagram link is incomplete.');
        }

        return await persistenceClient.getSharedDiagram(diagramId, shareToken);
    }, [diagramId, shareToken]);

    const { loading, error, diagram } = useSharedDiagram(loadDiagram);

    if (loading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-background">
                <div className="text-sm text-muted-foreground">
                    Loading shared diagram...
                </div>
            </main>
        );
    }

    if (error || !diagram) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
                <div className="max-w-md space-y-2">
                    <h1 className="text-xl font-semibold">
                        Shared diagram unavailable
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {error ??
                            'This shared diagram link is missing, expired, or no longer available.'}
                    </p>
                </div>
            </main>
        );
    }

    return <EditorPage initialDiagram={diagram} readonly />;
};
