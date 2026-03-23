import React, { useCallback, useEffect, useState } from 'react';
import { RequestError } from '@/lib/api/request';
import { authClient, type AuthSessionResponse } from '../api/auth-client';
import { authContext } from './auth-context';

const defaultSessionState: AuthSessionResponse = {
    mode: 'disabled',
    enabled: false,
    authenticated: false,
    user: null,
};

export const AuthProvider: React.FC<React.PropsWithChildren> = ({
    children,
}) => {
    const [ready, setReady] = useState(false);
    const [serverReachable, setServerReachable] = useState(true);
    const [session, setSession] =
        useState<AuthSessionResponse>(defaultSessionState);

    const refreshSession = useCallback(async () => {
        try {
            const nextSession = await authClient.getSession();
            setSession(nextSession);
            setServerReachable(true);
        } catch (error) {
            if (error instanceof RequestError && error.status === 401) {
                setSession({
                    mode: 'password',
                    enabled: true,
                    authenticated: false,
                    user: null,
                });
                setServerReachable(true);
            } else {
                setSession(defaultSessionState);
                setServerReachable(false);
            }
        } finally {
            setReady(true);
        }
    }, []);

    const login = useCallback(
        async (payload: { email: string; password: string }) => {
            await authClient.login(payload);
            await refreshSession();
        },
        [refreshSession]
    );

    const logout = useCallback(async () => {
        try {
            await authClient.logout();
        } finally {
            setSession((currentSession) => ({
                mode: currentSession.mode,
                enabled: currentSession.enabled,
                authenticated: false,
                user: null,
            }));
        }
    }, []);

    useEffect(() => {
        void refreshSession();
    }, [refreshSession]);

    useEffect(() => {
        const handleUnauthorized = () => {
            void refreshSession();
        };

        window.addEventListener(
            'chartdb:auth-unauthorized',
            handleUnauthorized
        );
        return () => {
            window.removeEventListener(
                'chartdb:auth-unauthorized',
                handleUnauthorized
            );
        };
    }, [refreshSession]);

    return (
        <authContext.Provider
            value={{
                ready,
                serverReachable,
                mode: session.mode,
                enabled: session.enabled,
                authenticated: session.authenticated,
                user: session.user,
                login,
                logout,
                refreshSession,
            }}
        >
            {children}
        </authContext.Provider>
    );
};
