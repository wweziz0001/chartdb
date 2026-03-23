import React, { useCallback, useEffect, useState } from 'react';
import { RequestError } from '@/lib/api/request';
import { authClient, type AuthSessionResponse } from '../api/auth-client';
import { authContext } from './auth-context';

const defaultSessionState: AuthSessionResponse = {
    mode: 'disabled',
    enabled: false,
    authenticated: false,
    user: null,
    logoutUrl: null,
    bootstrap: {
        required: false,
        completed: false,
        setupCodeRequired: false,
    },
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
                setSession((currentSession) => ({
                    ...defaultSessionState,
                    mode:
                        currentSession.mode === 'disabled'
                            ? 'password'
                            : currentSession.mode,
                    enabled: true,
                    logoutUrl: currentSession.logoutUrl,
                    bootstrap: currentSession.bootstrap,
                }));
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

    const bootstrapAdmin = useCallback(
        async (payload: {
            email: string;
            password: string;
            displayName: string;
            setupCode: string;
        }) => {
            await authClient.bootstrap(payload);
            await refreshSession();
        },
        [refreshSession]
    );

    const startOidcLogin = useCallback((returnTo?: string) => {
        authClient.startOidcLogin(returnTo);
    }, []);

    const logout = useCallback(async () => {
        const currentLogoutUrl = session.logoutUrl;
        try {
            const response = await authClient.logout();
            const redirectUrl = response.logoutUrl ?? currentLogoutUrl;
            if (redirectUrl) {
                window.location.assign(redirectUrl);
                return;
            }
        } finally {
            setSession((currentSession) => ({
                mode: currentSession.mode,
                enabled: currentSession.enabled,
                authenticated: false,
                user: null,
                logoutUrl: currentSession.logoutUrl,
                bootstrap: currentSession.bootstrap,
            }));
        }
    }, [session.logoutUrl]);

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
                bootstrap: session.bootstrap,
                bootstrapAdmin,
                login,
                startOidcLogin,
                logout,
                refreshSession,
            }}
        >
            {children}
        </authContext.Provider>
    );
};
