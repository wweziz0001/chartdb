import React, { useState } from 'react';
import ChartDBLogo from '@/assets/logo-light.png';
import { Button } from '@/components/button/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/card/card';
import { Input } from '@/components/input/input';
import { RequestError } from '@/lib/api/request';
import { useAuth } from '../hooks/use-auth';

export const SignInPage: React.FC = () => {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        setSubmitting(true);

        try {
            await login({ email, password });
        } catch (nextError) {
            if (nextError instanceof RequestError) {
                setError(nextError.message);
            } else {
                setError('Unable to sign in right now.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main className="flex min-h-screen items-center justify-center bg-stone-950 px-4 py-10 text-stone-100">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.24),transparent_35%),linear-gradient(135deg,rgba(24,24,27,0.95),rgba(12,10,9,1))]" />
            <div className="relative z-10 w-full max-w-md">
                <div className="mb-6 flex items-center justify-center gap-3">
                    <img
                        src={ChartDBLogo}
                        alt="ChartDB"
                        className="h-5 w-auto"
                    />
                    <span className="text-sm uppercase tracking-[0.3em] text-stone-400">
                        Self-Hosted Access
                    </span>
                </div>
                <Card className="border-stone-800/80 bg-stone-900/90 shadow-2xl shadow-black/40">
                    <CardHeader>
                        <CardTitle className="text-2xl text-stone-50">
                            Sign in to ChartDB
                        </CardTitle>
                        <CardDescription className="text-stone-400">
                            Password authentication is enabled for this
                            deployment.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form className="space-y-4" onSubmit={handleSubmit}>
                            <div className="space-y-2">
                                <label
                                    className="text-sm font-medium text-stone-200"
                                    htmlFor="chartdb-email"
                                >
                                    Email
                                </label>
                                <Input
                                    id="chartdb-email"
                                    type="email"
                                    value={email}
                                    onChange={(event) =>
                                        setEmail(event.target.value)
                                    }
                                    autoComplete="email"
                                    required
                                    className="border-stone-700 bg-stone-950/70 text-stone-50"
                                />
                            </div>
                            <div className="space-y-2">
                                <label
                                    className="text-sm font-medium text-stone-200"
                                    htmlFor="chartdb-password"
                                >
                                    Password
                                </label>
                                <Input
                                    id="chartdb-password"
                                    type="password"
                                    value={password}
                                    onChange={(event) =>
                                        setPassword(event.target.value)
                                    }
                                    autoComplete="current-password"
                                    required
                                    className="border-stone-700 bg-stone-950/70 text-stone-50"
                                />
                            </div>
                            {error ? (
                                <p className="text-sm text-amber-300">
                                    {error}
                                </p>
                            ) : null}
                            <Button
                                type="submit"
                                className="w-full bg-amber-400 text-stone-950 hover:bg-amber-300"
                                disabled={submitting}
                            >
                                {submitting ? 'Signing in...' : 'Sign in'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </main>
    );
};
