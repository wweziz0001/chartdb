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

export const BootstrapPage: React.FC = () => {
    const { bootstrap, bootstrapAdmin, mode, startOidcLogin } = useAuth();
    const [displayName, setDisplayName] = useState('ChartDB Admin');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [setupCode, setSetupCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        setSubmitting(true);

        try {
            if (mode === 'oidc') {
                startOidcLogin(
                    `${window.location.pathname}${window.location.search}${window.location.hash}`
                );
                return;
            }

            await bootstrapAdmin({
                email,
                password,
                displayName,
                setupCode,
            });
        } catch (nextError) {
            if (nextError instanceof RequestError) {
                setError(nextError.message);
            } else {
                setError('Unable to initialize the first administrator.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main className="flex min-h-screen items-center justify-center bg-stone-950 px-4 py-10 text-stone-100">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.18),transparent_35%),linear-gradient(135deg,rgba(24,24,27,0.95),rgba(12,10,9,1))]" />
            <div className="relative z-10 w-full max-w-md">
                <div className="mb-6 flex items-center justify-center gap-3">
                    <img
                        src={ChartDBLogo}
                        alt="ChartDB"
                        className="h-5 w-auto"
                    />
                    <span className="text-sm uppercase tracking-[0.3em] text-stone-400">
                        Initial Admin Setup
                    </span>
                </div>
                <Card className="border-stone-800/80 bg-stone-900/90 shadow-2xl shadow-black/40">
                    <CardHeader>
                        <CardTitle className="text-2xl text-stone-50">
                            Initialize the first administrator
                        </CardTitle>
                        <CardDescription className="text-stone-400">
                            {mode === 'oidc'
                                ? 'Use the operator-approved OIDC identity to finish first-run bootstrap for this deployment.'
                                : 'Create the first administrator account. This bootstrap flow locks after a successful setup.'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form className="space-y-4" onSubmit={handleSubmit}>
                            {mode === 'password' ? (
                                <>
                                    <div className="space-y-2">
                                        <label
                                            className="text-sm font-medium text-stone-200"
                                            htmlFor="chartdb-bootstrap-name"
                                        >
                                            Display name
                                        </label>
                                        <Input
                                            id="chartdb-bootstrap-name"
                                            value={displayName}
                                            onChange={(event) =>
                                                setDisplayName(
                                                    event.target.value
                                                )
                                            }
                                            autoComplete="name"
                                            required
                                            className="border-stone-700 bg-stone-950/70 text-stone-50"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label
                                            className="text-sm font-medium text-stone-200"
                                            htmlFor="chartdb-bootstrap-email"
                                        >
                                            Email
                                        </label>
                                        <Input
                                            id="chartdb-bootstrap-email"
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
                                            htmlFor="chartdb-bootstrap-password"
                                        >
                                            Password
                                        </label>
                                        <Input
                                            id="chartdb-bootstrap-password"
                                            type="password"
                                            value={password}
                                            onChange={(event) =>
                                                setPassword(event.target.value)
                                            }
                                            autoComplete="new-password"
                                            minLength={12}
                                            required
                                            className="border-stone-700 bg-stone-950/70 text-stone-50"
                                        />
                                    </div>
                                    {bootstrap.setupCodeRequired ? (
                                        <div className="space-y-2">
                                            <label
                                                className="text-sm font-medium text-stone-200"
                                                htmlFor="chartdb-bootstrap-setup-code"
                                            >
                                                Setup code
                                            </label>
                                            <Input
                                                id="chartdb-bootstrap-setup-code"
                                                value={setupCode}
                                                onChange={(event) =>
                                                    setSetupCode(
                                                        event.target.value
                                                    )
                                                }
                                                autoCapitalize="characters"
                                                autoCorrect="off"
                                                required
                                                className="border-stone-700 bg-stone-950/70 font-mono uppercase tracking-[0.2em] text-stone-50"
                                            />
                                        </div>
                                    ) : null}
                                </>
                            ) : (
                                <p className="text-sm leading-6 text-stone-300">
                                    Continue with the bootstrap-approved
                                    identity provider account. Non-bootstrap
                                    OIDC users are blocked until the first
                                    administrator is created.
                                </p>
                            )}
                            {error ? (
                                <p className="text-sm text-amber-300">
                                    {error}
                                </p>
                            ) : null}
                            <Button
                                type="submit"
                                className="w-full bg-sky-400 text-stone-950 hover:bg-sky-300"
                                disabled={submitting}
                            >
                                {submitting
                                    ? mode === 'oidc'
                                        ? 'Redirecting...'
                                        : 'Initializing...'
                                    : mode === 'oidc'
                                      ? 'Continue with Single Sign-On'
                                      : 'Create first administrator'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </main>
    );
};
