export type DiagramCollaborationEventType =
    | 'snapshot'
    | 'session'
    | 'document'
    | 'presence';

export interface DiagramParticipantCursorState {
    x: number;
    y: number;
    updatedAt: string;
}

export interface DiagramPresenceParticipant {
    sessionId: string;
    userId: string | null;
    displayName: string;
    email: string | null;
    initials: string;
    color: string;
    mode: 'view' | 'edit';
    joinedAt: string;
    lastSeenAt: string;
    cursor: DiagramParticipantCursorState | null;
}

interface DiagramPresenceParticipantEntry extends DiagramPresenceParticipant {
    presenceKey: string;
}

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
    presence: {
        participants: DiagramPresenceParticipant[];
    };
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
    private readonly participants = new Map<
        string,
        Map<string, DiagramPresenceParticipantEntry>
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

    upsertParticipant(
        diagramId: string,
        participant: Omit<DiagramPresenceParticipant, 'joinedAt' | 'cursor'> & {
            presenceKey: string;
        }
    ) {
        const diagramParticipants =
            this.participants.get(diagramId) ?? new Map();
        const existingParticipant = diagramParticipants.get(
            participant.sessionId
        );

        for (const [sessionId, currentParticipant] of diagramParticipants) {
            if (
                sessionId !== participant.sessionId &&
                currentParticipant.presenceKey === participant.presenceKey
            ) {
                diagramParticipants.delete(sessionId);
            }
        }

        diagramParticipants.set(participant.sessionId, {
            ...participant,
            joinedAt: existingParticipant?.joinedAt ?? participant.lastSeenAt,
            cursor: existingParticipant?.cursor ?? null,
        });
        this.participants.set(diagramId, diagramParticipants);
        return this.listParticipants(diagramId);
    }

    removeParticipant(diagramId: string, sessionId: string) {
        const diagramParticipants = this.participants.get(diagramId);
        if (!diagramParticipants) {
            return this.listParticipants(diagramId);
        }

        diagramParticipants.delete(sessionId);
        if (diagramParticipants.size === 0) {
            this.participants.delete(diagramId);
        }

        return this.listParticipants(diagramId);
    }

    updateParticipantCursor(
        diagramId: string,
        sessionId: string,
        cursor: DiagramParticipantCursorState | null
    ) {
        const diagramParticipants = this.participants.get(diagramId);
        const existingParticipant = diagramParticipants?.get(sessionId);
        if (!diagramParticipants || !existingParticipant) {
            return this.listParticipants(diagramId);
        }

        diagramParticipants.set(sessionId, {
            ...existingParticipant,
            lastSeenAt: cursor?.updatedAt ?? new Date().toISOString(),
            cursor,
        });

        return this.listParticipants(diagramId);
    }

    listParticipants(diagramId: string): DiagramPresenceParticipant[] {
        const diagramParticipants = this.participants.get(diagramId);
        if (!diagramParticipants) {
            return [];
        }

        return [...diagramParticipants.values()]
            .sort((left, right) => {
                if (left.joinedAt !== right.joinedAt) {
                    return left.joinedAt.localeCompare(right.joinedAt);
                }

                return left.displayName.localeCompare(right.displayName);
            })
            .map((entry) => {
                const { presenceKey, ...participant } = entry;
                void presenceKey;
                return participant;
            });
    }
}
