import { useEffect, useState } from 'react';
import {
    deserializeDiagram,
    persistenceClient,
    type PersistedDiagramRecord,
} from '@/features/persistence/api/persistence-client';
import type { Diagram } from '@/lib/domain/diagram';

export const useSharedDiagram = (
    load: () => Promise<PersistedDiagramRecord>
): {
    loading: boolean;
    error: string | null;
    diagram: Diagram | null;
} => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [diagram, setDiagram] = useState<Diagram | null>(null);

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            setLoading(true);
            setError(null);

            try {
                const response = await load();
                if (!cancelled) {
                    setDiagram(deserializeDiagram(response.diagram));
                }
            } catch (caughtError) {
                if (!cancelled) {
                    setError(
                        caughtError instanceof Error
                            ? caughtError.message
                            : 'Unable to load the shared diagram.'
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
    }, [load]);

    return {
        loading,
        error,
        diagram,
    };
};

export { persistenceClient };
