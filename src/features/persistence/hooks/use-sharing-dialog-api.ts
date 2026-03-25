import { useCallback } from 'react';
import { useStorage } from '@/hooks/use-storage';
import type {
    PersistedSharingSettings,
    PersistedUserSummary,
    SharingAccess,
    SharingScope,
} from '@/features/persistence/api/persistence-client';

export interface SharingDialogSubject {
    type: 'project' | 'diagram';
    id: string;
    name: string;
}

export const useSharingDialogApi = () => {
    const storage = useStorage();

    const loadSharing = useCallback(
        async (subject: Pick<SharingDialogSubject, 'type' | 'id'>) =>
            subject.type === 'project'
                ? await storage.getProjectSharing(subject.id)
                : await storage.getDiagramSharing(subject.id),
        [storage]
    );

    const searchUsers = useCallback(
        async (query: string): Promise<PersistedUserSummary[]> =>
            await storage.searchShareableUsers(query),
        [storage]
    );

    const addPerson = useCallback(
        async (
            subject: Pick<SharingDialogSubject, 'type' | 'id'>,
            params: {
                userId: string;
                access: SharingAccess;
            }
        ): Promise<PersistedSharingSettings> =>
            subject.type === 'project'
                ? await storage.addProjectSharingUser(subject.id, params)
                : await storage.addDiagramSharingUser(subject.id, params),
        [storage]
    );

    const updatePerson = useCallback(
        async (
            subject: Pick<SharingDialogSubject, 'type' | 'id'>,
            userId: string,
            params: {
                access: SharingAccess;
            }
        ): Promise<PersistedSharingSettings> =>
            subject.type === 'project'
                ? await storage.updateProjectSharingUser(
                      subject.id,
                      userId,
                      params
                  )
                : await storage.updateDiagramSharingUser(
                      subject.id,
                      userId,
                      params
                  ),
        [storage]
    );

    const removePerson = useCallback(
        async (
            subject: Pick<SharingDialogSubject, 'type' | 'id'>,
            userId: string
        ): Promise<PersistedSharingSettings> =>
            subject.type === 'project'
                ? await storage.removeProjectSharingUser(subject.id, userId)
                : await storage.removeDiagramSharingUser(subject.id, userId),
        [storage]
    );

    const updateGeneralAccess = useCallback(
        async (
            subject: Pick<SharingDialogSubject, 'type' | 'id'>,
            params: {
                scope: SharingScope;
                access: SharingAccess;
                expiresAt?: string | null;
                rotateLinkToken?: boolean;
            }
        ): Promise<PersistedSharingSettings> =>
            subject.type === 'project'
                ? await storage.updateProjectSharing(subject.id, params)
                : await storage.updateDiagramSharing(subject.id, params),
        [storage]
    );

    return {
        loadSharing,
        searchUsers,
        addPerson,
        updatePerson,
        removePerson,
        updateGeneralAccess,
    };
};
