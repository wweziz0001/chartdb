import React from 'react';
import { Link } from 'react-router-dom';
import ChartDBLogo from '@/assets/logo-light.png';
import { Button } from '@/components/button/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/card/card';
import { useAuth } from '@/features/auth/hooks/use-auth';

const AccessCopy = ({
    title,
    description,
}: {
    title: string;
    description: string;
}) => (
    <main className="flex min-h-screen items-center justify-center bg-stone-950 px-4 py-10 text-stone-100">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.16),transparent_35%),linear-gradient(135deg,rgba(24,24,27,0.95),rgba(12,10,9,1))]" />
        <div className="relative z-10 w-full max-w-lg">
            <div className="mb-6 flex items-center justify-center gap-3">
                <img src={ChartDBLogo} alt="ChartDB" className="h-5 w-auto" />
                <span className="text-sm uppercase tracking-[0.3em] text-stone-400">
                    Admin Console
                </span>
            </div>
            <Card className="border-stone-800/80 bg-stone-900/90 shadow-2xl shadow-black/40">
                <CardHeader>
                    <CardTitle className="text-2xl text-stone-50">
                        {title}
                    </CardTitle>
                    <CardDescription className="text-stone-400">
                        {description}
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 sm:flex-row">
                    <Button
                        asChild
                        className="bg-amber-400 text-stone-950 hover:bg-amber-300"
                    >
                        <Link to="/">Return to workspace</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    </main>
);

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

    if (!enabled) {
        return (
            <AccessCopy
                title="Admin dashboard unavailable"
                description="The admin dashboard is only available when self-hosted authentication is enabled."
            />
        );
    }

    if (!authenticated || !user || user.role !== 'admin') {
        return (
            <AccessCopy
                title="Administrator access required"
                description="This route is reserved for ChartDB administrators."
            />
        );
    }

    return <>{children}</>;
};
