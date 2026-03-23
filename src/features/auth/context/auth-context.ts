import { createContext } from 'react';
import type { PersistedUserSummary } from '@/features/persistence/api/persistence-client';

export interface AuthContextValue {
    ready: boolean;
    serverReachable: boolean;
    mode: 'disabled' | 'password' | 'oidc';
    enabled: boolean;
    authenticated: boolean;
    user: PersistedUserSummary | null;
    login: (payload: { email: string; password: string }) => Promise<void>;
    startOidcLogin: (returnTo?: string) => void;
    logout: () => Promise<void>;
    refreshSession: () => Promise<void>;
}

export const authContext = createContext<AuthContextValue | null>(null);
