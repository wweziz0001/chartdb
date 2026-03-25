import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { CanonicalSchema } from '@chartdb/schema-sync-core';
import { buildApp } from '../app.js';
import type { ServerEnv } from '../config/env.js';
import { AppRepository } from '../repositories/app-repository.js';
import { MetadataRepository } from '../repositories/metadata-repository.js';

const tempDirs: string[] = [];

const createSchemaSyncEnv = (): ServerEnv => {
    const dataDir = mkdtempSync(path.join(os.tmpdir(), 'chartdb-schema-sync-'));
    tempDirs.push(dataDir);
    return {
        nodeEnv: 'test',
        host: '127.0.0.1',
        port: 4010,
        corsOrigin: 'http://localhost:5173',
        logLevel: 'silent',
        authMode: 'password',
        authEmail: 'owner@example.com',
        authPassword: 'super-secret-password',
        authDisplayName: 'Owner',
        bootstrapSetupCode: null,
        bootstrapSetupCodeTtlMs: 15 * 60 * 1000,
        bootstrapSetupCodeMaxAttempts: 10,
        bootstrapAdminEmail: null,
        sessionTtlHours: 24,
        sessionCookieName: 'chartdb_session',
        sessionCookieSecure: false,
        oidcIssuer: null,
        oidcClientId: null,
        oidcClientSecret: null,
        oidcRedirectUrl: null,
        oidcLogoutUrl: null,
        oidcScopes: 'openid profile email',
        dataDir,
        metadataDbPath: path.join(dataDir, 'schema-sync.sqlite'),
        appDbPath: path.join(dataDir, 'chartdb-app.sqlite'),
        encryptionKey: Buffer.from('test-key'),
        defaultOwnerName: 'Test Owner',
        defaultProjectName: 'Test Project',
    };
};

const getSessionCookie = (setCookieHeader: string | string[] | undefined) => {
    const headerValue = Array.isArray(setCookieHeader)
        ? setCookieHeader[0]
        : setCookieHeader;
    const cookie = headerValue?.split(';')[0];
    if (!cookie) {
        throw new Error('Expected a session cookie to be set.');
    }

    return cookie;
};

const createCanonicalSchema = (): CanonicalSchema => ({
    engine: 'postgresql',
    databaseName: 'warehouse',
    defaultSchemaName: 'public',
    schemaNames: ['public'],
    tables: [],
    customTypes: [],
    fingerprint: 'baseline-fingerprint',
    importedAt: '2026-03-25T00:00:00.000Z',
});

afterEach(() => {
    while (tempDirs.length > 0) {
        const dir = tempDirs.pop();
        if (dir) {
            rmSync(dir, { recursive: true, force: true });
        }
    }
});

describe('schema sync routes', () => {
    it('requires an administrator for operational schema-sync routes when auth is enabled', async () => {
        const env = createSchemaSyncEnv();
        const appRepository = new AppRepository(env.appDbPath);
        const metadataRepository = new MetadataRepository(env.metadataDbPath);
        const app = buildApp({
            env,
            appRepository,
            metadataRepository,
        });

        const loginResponse = await app.inject({
            method: 'POST',
            url: '/api/auth/login',
            payload: {
                email: env.authEmail,
                password: env.authPassword,
            },
        });
        const cookie = getSessionCookie(loginResponse.headers['set-cookie']);
        const owner = appRepository.getUserAuthByEmail('owner@example.com');
        appRepository.putUserAuthRecord({
            ...owner!,
            role: 'member',
            updatedAt: new Date().toISOString(),
        });

        const response = await app.inject({
            method: 'GET',
            url: '/api/connections',
            headers: {
                cookie,
            },
        });

        expect(response.statusCode).toBe(403);
        expect(response.json()).toEqual(
            expect.objectContaining({
                code: 'AUTH_FORBIDDEN',
            })
        );

        await app.close();
        metadataRepository.close();
        appRepository.close();
    });

    it('derives the diff audit actor from the authenticated request instead of the client payload', async () => {
        const env = createSchemaSyncEnv();
        const appRepository = new AppRepository(env.appDbPath);
        const metadataRepository = new MetadataRepository(env.metadataDbPath);
        const app = buildApp({
            env,
            appRepository,
            metadataRepository,
        });

        const loginResponse = await app.inject({
            method: 'POST',
            url: '/api/auth/login',
            payload: {
                email: env.authEmail,
                password: env.authPassword,
            },
        });
        const cookie = getSessionCookie(loginResponse.headers['set-cookie']);
        const baselineSchema = createCanonicalSchema();
        metadataRepository.putSnapshot({
            id: 'baseline-snapshot',
            connectionId: 'connection-1',
            kind: 'baseline',
            fingerprint: 'baseline-fingerprint',
            importedSchemas: ['public'],
            schema: baselineSchema,
            createdAt: '2026-03-25T00:00:00.000Z',
        });

        const response = await app.inject({
            method: 'POST',
            url: '/api/schema/diff',
            headers: {
                cookie,
            },
            payload: {
                baselineSnapshotId: 'baseline-snapshot',
                targetSchema: baselineSchema,
                actor: 'spoofed-client-actor',
            },
        });

        expect(response.statusCode).toBe(200);
        const body = response.json() as {
            plan: {
                id: string;
            };
        };
        const audit = metadataRepository.getLatestAuditForChangePlan(
            body.plan.id
        );

        expect(audit).toEqual(
            expect.objectContaining({
                actor: 'admin:owner@example.com',
                changePlanId: body.plan.id,
                status: 'pending',
            })
        );

        await app.close();
        metadataRepository.close();
        appRepository.close();
    });
});
