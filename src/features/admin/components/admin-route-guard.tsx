import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/use-auth';

export const AdminRouteGuard: React.FC<React.PropsWithChildren> = ({
    children,
}) => {
    const { ready, enabled, authenticated, user } = useAuth();

    if (!ready) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-stone-950 text-stone-100">
                <div className="text-sm uppercase tracking-[0.3em] text-stone-400">
                    Loading admin console
                </div>
            </main>
        );
    }

    if (!enabled || !authenticated || !user || user.role !== 'admin') {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
};
