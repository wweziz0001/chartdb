import { getWorkspaceId } from '@/lib/utils/utils';

const COLLABORATION_CLIENT_ID_PREFIX = 'presence';

export const getCollaborationClientId = () => {
    if (typeof window === 'undefined') {
        return null;
    }

    return `${COLLABORATION_CLIENT_ID_PREFIX}:${getWorkspaceId()}`;
};
