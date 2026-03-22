import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { resolveServerEnv } from '../config/env.js';

const tempDirs: string[] = [];

const makeEnv = () => {
    const dataDir = mkdtempSync(path.join(os.tmpdir(), 'chartdb-server-'));
    tempDirs.push(dataDir);

    return resolveServerEnv({
        NODE_ENV: 'test',
        CHARTDB_DATA_DIR: dataDir,
        CHARTDB_SECRET_KEY: 'chartdb-test-secret-1234',
        CHARTDB_DEFAULT_USER_EMAIL: 'owner@example.com',
        CHARTDB_DEFAULT_USER_NAME: 'Owner',
    });
};

afterEach(() => {
    while (tempDirs.length > 0) {
        const dir = tempDirs.pop();
        if (dir) {
            rmSync(dir, { recursive: true, force: true });
        }
    }
});

describe('app persistence api', () => {
    it('exposes app health and default user bootstrap', async () => {
        const app = buildApp(makeEnv());

        const health = await app.inject({
            method: 'GET',
            url: '/api/app/health',
        });
        expect(health.statusCode).toBe(200);
        expect(health.json()).toEqual(
            expect.objectContaining({
                ok: true,
                persistence: expect.objectContaining({
                    storage: 'sqlite',
                }),
            })
        );

        const me = await app.inject({
            method: 'GET',
            url: '/api/app/me',
        });
        expect(me.statusCode).toBe(200);
        expect(me.json()).toEqual(
            expect.objectContaining({
                user: expect.objectContaining({
                    email: 'owner@example.com',
                }),
            })
        );

        await app.close();
    });

    it('validates diagram payloads and persists diagrams/projects', async () => {
        const app = buildApp(makeEnv());

        const invalid = await app.inject({
            method: 'PUT',
            url: '/api/app/diagrams/demo',
            payload: {
                diagram: {
                    id: 'demo',
                    name: '',
                },
            },
        });
        expect(invalid.statusCode).toBe(400);

        const createdAt = new Date('2026-03-22T12:00:00.000Z').toISOString();
        const updatedAt = new Date('2026-03-22T12:05:00.000Z').toISOString();
        const upsert = await app.inject({
            method: 'PUT',
            url: '/api/app/diagrams/demo',
            payload: {
                diagram: {
                    id: 'demo',
                    name: 'Demo Diagram',
                    databaseType: 'postgresql',
                    tables: [{ id: 'users' }],
                    relationships: [],
                    dependencies: [],
                    areas: [],
                    customTypes: [],
                    notes: [],
                    createdAt,
                    updatedAt,
                },
            },
        });

        expect(upsert.statusCode).toBe(200);
        expect(upsert.json()).toEqual(
            expect.objectContaining({
                diagram: expect.objectContaining({
                    id: 'demo',
                    name: 'Demo Diagram',
                    version: 1,
                    projectId: 'demo',
                }),
                project: expect.objectContaining({
                    id: 'demo',
                    primaryDiagramId: 'demo',
                }),
            })
        );

        const list = await app.inject({
            method: 'GET',
            url: '/api/app/diagrams?includeTables=true',
        });
        expect(list.statusCode).toBe(200);
        expect(list.json()).toEqual(
            expect.objectContaining({
                items: [
                    expect.objectContaining({
                        id: 'demo',
                        tables: [{ id: 'users' }],
                    }),
                ],
            })
        );

        const search = await app.inject({
            method: 'GET',
            url: '/api/app/search?q=Demo',
        });
        expect(search.statusCode).toBe(200);
        expect(search.json()).toEqual(
            expect.objectContaining({
                items: expect.arrayContaining([
                    expect.objectContaining({
                        type: 'project',
                        id: 'demo',
                    }),
                    expect.objectContaining({
                        type: 'diagram',
                        id: 'demo',
                    }),
                ]),
            })
        );

        const remove = await app.inject({
            method: 'DELETE',
            url: '/api/app/diagrams/demo',
        });
        expect(remove.statusCode).toBe(200);

        const missing = await app.inject({
            method: 'GET',
            url: '/api/app/diagrams/demo',
        });
        expect(missing.statusCode).toBe(404);

        await app.close();
    });
});
