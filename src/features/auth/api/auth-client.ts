import { apiPath, requestJson } from '@/lib/api/request';
import type { PersistedUserSummary } from '@/features/persistence/api/persistence-client';

export interface AuthSessionResponse {
    mode: 'disabled' | 'password' | 'oidc';
    enabled: boolean;
    authenticated: boolean;
    user: PersistedUserSummary | null;
    logoutUrl: string | null;
    bootstrap: {
        required: boolean;
        completed: boolean;
        setupCodeRequired: boolean;
    };
}

export const authClient = {
    getSession: async () =>
        requestJson<AuthSessionResponse>('/api/auth/session'),
    bootstrap: async (payload: {
        email: string;
        password: string;
        displayName: string;
        setupCode: string;
    }) =>
        requestJson<{ user: PersistedUserSummary }>('/api/auth/bootstrap', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
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
