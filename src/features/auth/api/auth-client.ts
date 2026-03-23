import { requestJson } from '@/lib/api/request';
import type { PersistedUserSummary } from '@/features/persistence/api/persistence-client';

export interface AuthSessionResponse {
    mode: 'disabled' | 'password';
    enabled: boolean;
    authenticated: boolean;
    user: PersistedUserSummary | null;
}

export const authClient = {
    getSession: async () =>
        requestJson<AuthSessionResponse>('/api/auth/session'),
    login: async (payload: { email: string; password: string }) =>
        requestJson<{ user: PersistedUserSummary }>('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
    logout: async () =>
        requestJson<{ ok: boolean }>('/api/auth/logout', {
            method: 'POST',
        }),
};
