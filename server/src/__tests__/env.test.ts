import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseServerEnv } from '../config/env.js';

const tempDirs: string[] = [];

const createEnvInput = (overrides: NodeJS.ProcessEnv = {}) => {
    const dataDir =
        overrides.CHARTDB_DATA_DIR ??
        mkdtempSync(path.join(os.tmpdir(), 'chartdb-env-'));

    if (!overrides.CHARTDB_DATA_DIR) {
        tempDirs.push(dataDir);
    }

    return {
        NODE_ENV: 'test',
        CHARTDB_API_HOST: '127.0.0.1',
        CHARTDB_API_PORT: '4010',
        CHARTDB_CORS_ORIGIN: 'http://localhost:5173',
        CHARTDB_SECRET_KEY: 'development-secret-key',
        CHARTDB_DATA_DIR: dataDir,
        CHARTDB_AUTH_MODE: 'disabled',
        ...overrides,
    };
};

afterEach(() => {
    while (tempDirs.length > 0) {
        const dir = tempDirs.pop();
        if (dir) {
            rmSync(dir, { recursive: true, force: true });
        }
    }
});

describe('parseServerEnv', () => {
    it('resolves persistence paths inside the data directory by default', () => {
        const env = parseServerEnv(createEnvInput());

        expect(env.appDbPath.endsWith('chartdb-app.sqlite')).toBe(true);
        expect(env.metadataDbPath.endsWith('schema-sync.sqlite')).toBe(true);
    });

    it('exposes validated runtime settings', () => {
        const env = parseServerEnv(createEnvInput());

        expect(env.port).toBeGreaterThan(0);
        expect(env.host.length).toBeGreaterThan(0);
        expect(env.logLevel.length).toBeGreaterThan(0);
        expect(env.encryptionKey.byteLength).toBeGreaterThan(0);
        expect(env.sessionTtlHours).toBeGreaterThan(0);
        expect(env.sessionCookieName.length).toBeGreaterThan(0);
        expect(env.oidcScopes).toBe('openid profile email');
        expect(env.bootstrapSetupCodeTtlMs).toBeGreaterThan(0);
        expect(env.bootstrapSetupCodeMaxAttempts).toBeGreaterThan(0);
    });

    it('requires env-assisted password bootstrap credentials to be set together', () => {
        expect(() =>
            parseServerEnv(
                createEnvInput({
                    CHARTDB_AUTH_MODE: 'password',
                    CHARTDB_AUTH_EMAIL: 'owner@example.com',
                })
            )
        ).toThrow(
            /CHARTDB_AUTH_EMAIL and CHARTDB_AUTH_PASSWORD must be set together/
        );
    });

    it('requires issuer, client id, and redirect url when oidc mode is enabled', () => {
        expect(() =>
            parseServerEnv(
                createEnvInput({
                    CHARTDB_AUTH_MODE: 'oidc',
                })
            )
        ).toThrow(
            /CHARTDB_AUTH_MODE=oidc requires OIDC configuration\. Missing: CHARTDB_OIDC_ISSUER, CHARTDB_OIDC_CLIENT_ID, CHARTDB_OIDC_REDIRECT_URL/
        );
    });

    it('requires https redirect urls for oidc in production', () => {
        expect(() =>
            parseServerEnv(
                createEnvInput({
                    NODE_ENV: 'production',
                    CHARTDB_CORS_ORIGIN: 'https://chartdb.example.com',
                    CHARTDB_SECRET_KEY:
                        'production-secret-key-that-is-long-enough',
                    CHARTDB_AUTH_MODE: 'oidc',
                    CHARTDB_OIDC_ISSUER:
                        'https://sso.example.com/realms/chartdb',
                    CHARTDB_OIDC_CLIENT_ID: 'chartdb',
                    CHARTDB_OIDC_REDIRECT_URL:
                        'http://chartdb.example.com/api/auth/oidc/callback',
                })
            )
        ).toThrow(/CHARTDB_OIDC_REDIRECT_URL must use HTTPS in production/);
    });

    it('treats blank optional env values as unset', () => {
        const env = parseServerEnv(
            createEnvInput({
                CHARTDB_AUTH_EMAIL: '',
                CHARTDB_AUTH_PASSWORD: '',
                CHARTDB_BOOTSTRAP_SETUP_CODE: '',
                CHARTDB_BOOTSTRAP_ADMIN_EMAIL: '',
                CHARTDB_SESSION_COOKIE_SECURE: '',
                CHARTDB_OIDC_ISSUER: '',
                CHARTDB_OIDC_CLIENT_ID: '',
                CHARTDB_OIDC_CLIENT_SECRET: '',
                CHARTDB_OIDC_REDIRECT_URL: '',
                CHARTDB_OIDC_LOGOUT_URL: '',
            })
        );

        expect(env.authEmail).toBeNull();
        expect(env.authPassword).toBeNull();
        expect(env.bootstrapSetupCode).toBeNull();
        expect(env.bootstrapAdminEmail).toBeNull();
        expect(env.oidcIssuer).toBeNull();
        expect(env.oidcClientId).toBeNull();
        expect(env.oidcClientSecret).toBeNull();
        expect(env.oidcRedirectUrl).toBeNull();
        expect(env.oidcLogoutUrl).toBeNull();
        expect(env.sessionCookieSecure).toBe(false);
    });
});
