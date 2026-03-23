import { Issuer } from 'openid-client';
import type { ServerEnv } from '../config/env.js';

export interface OidcTokenSet {
    claims(): Record<string, unknown>;
}

export interface OidcClient {
    issuer: string;
    authorizationUrl(params: {
        scope: string;
        response_type: 'code';
        state: string;
        nonce: string;
        code_challenge: string;
        code_challenge_method: 'S256';
    }): string;
    callback(
        params: Record<string, unknown>,
        checks: {
            state: string;
            nonce: string;
            codeVerifier: string;
        }
    ): Promise<OidcTokenSet>;
}

export interface OidcClientProvider {
    getClient(): Promise<OidcClient>;
}

const selectTokenEndpointAuthMethod = (options: {
    hasClientSecret: boolean;
    supported?: string[];
}): 'none' | 'client_secret_basic' | 'client_secret_post' => {
    const supported = options.supported?.filter(Boolean);

    if (!options.hasClientSecret) {
        if (supported && supported.length > 0 && !supported.includes('none')) {
            throw new Error(
                'OIDC client is configured without CHARTDB_OIDC_CLIENT_SECRET, but the provider does not advertise support for public clients.'
            );
        }
        return 'none';
    }

    for (const method of [
        'client_secret_basic',
        'client_secret_post',
    ] as const) {
        if (
            !supported ||
            supported.length === 0 ||
            supported.includes(method)
        ) {
            return method;
        }
    }

    throw new Error(
        'OIDC provider does not advertise a supported client secret authentication method.'
    );
};

export class OpenIdClientProvider implements OidcClientProvider {
    private clientPromise: Promise<OidcClient> | null = null;

    constructor(private readonly env: ServerEnv) {}

    async getClient(): Promise<OidcClient> {
        const issuerUrl = this.env.oidcIssuer;
        const clientId = this.env.oidcClientId;
        const redirectUrl = this.env.oidcRedirectUrl;

        if (!issuerUrl || !clientId || !redirectUrl) {
            throw new Error(
                'OIDC is enabled but provider configuration is incomplete.'
            );
        }

        if (!this.clientPromise) {
            const clientPromise = (async (): Promise<OidcClient> => {
                const issuer = await Issuer.discover(issuerUrl);
                const supportedMethods = (
                    issuer.metadata as Record<string, unknown>
                ).token_endpoint_auth_methods_supported as string[] | undefined;
                const tokenEndpointAuthMethod = selectTokenEndpointAuthMethod({
                    hasClientSecret: Boolean(this.env.oidcClientSecret),
                    supported: supportedMethods,
                });

                const client = new issuer.Client({
                    client_id: clientId,
                    client_secret: this.env.oidcClientSecret ?? undefined,
                    redirect_uris: [redirectUrl],
                    response_types: ['code'],
                    token_endpoint_auth_method: tokenEndpointAuthMethod,
                });

                return {
                    issuer: String(issuer.issuer),
                    authorizationUrl: (params) =>
                        client.authorizationUrl(params),
                    callback: async (params, checks) =>
                        client.callback(redirectUrl, params, {
                            state: checks.state,
                            nonce: checks.nonce,
                            code_verifier: checks.codeVerifier,
                        }),
                };
            })();
            this.clientPromise = clientPromise;
        }

        try {
            return await this.clientPromise;
        } catch (error) {
            this.clientPromise = null;
            throw error;
        }
    }
}
