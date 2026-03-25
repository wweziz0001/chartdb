export type DiagramCollaborationEventType = 'snapshot' | 'session' | 'document';

export interface DiagramCollaborationEventState {
    document: {
        version: number;
        updatedAt: string;
        lastSavedSessionId: string | null;
        lastSavedByUserId: string | null;
    };
    realtime: {
        strategy: 'optimistic-http' | 'event-stream' | 'websocket-ready';
        liveSyncEnabled: boolean;
        eventsEndpoint: string | null;
        websocketEndpoint: string | null;
        websocketProtocol: string | null;
        sessionEndpoint: string;
    };
    activeSessionCount: number;
}

export interface DiagramCollaborationEvent {
    type: DiagramCollaborationEventType;
    diagramId: string;
    sessionId: string | null;
    emittedAt: string;
    collaboration: DiagramCollaborationEventState;
}

type DiagramCollaborationListener = (
    event: DiagramCollaborationEvent
) => void | Promise<void>;

export class DiagramCollaborationBroker {
    private readonly listeners = new Map<
        string,
        Set<DiagramCollaborationListener>
    >();

    subscribe(diagramId: string, listener: DiagramCollaborationListener) {
        const listeners = this.listeners.get(diagramId) ?? new Set();
        listeners.add(listener);
        this.listeners.set(diagramId, listeners);

        return () => {
            const nextListeners = this.listeners.get(diagramId);
            if (!nextListeners) {
                return;
            }

            nextListeners.delete(listener);
            if (nextListeners.size === 0) {
                this.listeners.delete(diagramId);
            }
        };
    }

    publish(event: DiagramCollaborationEvent) {
        const listeners = this.listeners.get(event.diagramId);
        if (!listeners || listeners.size === 0) {
            return;
        }

        for (const listener of listeners) {
            void Promise.resolve(listener(event)).catch((error) => {
                console.warn('Failed to deliver diagram collaboration event.', {
                    diagramId: event.diagramId,
                    type: event.type,
                    error,
                });
            });
        }
    }
}
