import { apiPath, requestJson } from '@/lib/api/request';
import type { PersistedUserSummary } from '@/features/persistence/api/persistence-client';

export interface AuthSessionResponse {
    mode: 'disabled' | 'password' | 'oidc';
    enabled: boolean;
    authenticated: boolean;
    user: PersistedUserSummary | null;
    logoutUrl: string | null;
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
        requestJson<{ ok: boolean; logoutUrl: string | null }>(
            '/api/auth/logout',
            {
                method: 'POST',
            }
        ),
    startOidcLogin: (returnTo?: string) => {
        const search = new URLSearchParams();
        if (returnTo) {
            search.set('returnTo', returnTo);
        }
        window.location.assign(
            apiPath(
                `/auth/oidc/start${
                    search.size > 0 ? `?${search.toString()}` : ''
                }`
            )
        );
    },
};
