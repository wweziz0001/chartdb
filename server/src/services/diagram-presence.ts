import type { DiagramSessionRecord } from '../repositories/app-repository.js';

export const DIAGRAM_SESSION_STALE_TTL_MS = 45_000;

export const resolveDiagramPresenceIdentity = (
    session: Pick<DiagramSessionRecord, 'id' | 'ownerUserId' | 'clientId'>
) => {
    if (session.ownerUserId) {
        return `user:${session.ownerUserId}`;
    }

    const clientId = session.clientId?.trim();
    if (clientId) {
        return `client:${clientId}`;
    }

    return `session:${session.id}`;
};

export const isDiagramSessionActive = (
    session: Pick<DiagramSessionRecord, 'status' | 'lastHeartbeatAt'>,
    now = Date.now()
) => {
    if (session.status === 'closed') {
        return false;
    }

    const lastHeartbeatAt = Date.parse(session.lastHeartbeatAt);
    return (
        !Number.isFinite(lastHeartbeatAt) ||
        now - lastHeartbeatAt <= DIAGRAM_SESSION_STALE_TTL_MS
    );
};
