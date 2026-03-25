import http from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scryptSync } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import type { ServerEnv } from '../config/env.js';
import {
    AppRepository,
    type AppUserAuthRecord,
} from '../repositories/app-repository.js';

const tempDirs: string[] = [];

const createAuthEnv = (): ServerEnv => {
    const dataDir = mkdtempSync(path.join(os.tmpdir(), 'chartdb-collab-'));
    tempDirs.push(dataDir);
    return {
        nodeEnv: 'test',
        host: '127.0.0.1',
        port: 4020,
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

const createPasswordHash = (password: string) => {
    const salt = '0123456789abcdef0123456789abcdef';
    const digest = scryptSync(password, salt, 64).toString('hex');
    return `scrypt:${salt}:${digest}`;
};

const createMemberUser = (
    overrides?: Partial<AppUserAuthRecord>
): AppUserAuthRecord => {
    const now = new Date().toISOString();

    return {
        id: overrides?.id ?? 'member-user',
        email: overrides?.email ?? 'member@example.com',
        displayName: overrides?.displayName ?? 'Member',
        authProvider: overrides?.authProvider ?? 'local',
        status: overrides?.status ?? 'active',
        role: overrides?.role ?? 'member',
        ownershipScope: overrides?.ownershipScope ?? 'personal',
        passwordHash:
            overrides?.passwordHash ?? createPasswordHash('member-password'),
        passwordUpdatedAt: overrides?.passwordUpdatedAt ?? null,
        lastLoginAt: overrides?.lastLoginAt ?? null,
        createdAt: overrides?.createdAt ?? now,
        updatedAt: overrides?.updatedAt ?? now,
    };
};

const login = async (
    app: ReturnType<typeof buildApp>,
    email: string,
    password: string
) => {
    const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
            email,
            password,
        },
    });

    expect(response.statusCode).toBe(200);
    return getSessionCookie(response.headers['set-cookie']);
};

const createSharedDiagramFixture = async (
    app: ReturnType<typeof buildApp>,
    ownerCookie: string,
    access: 'view' | 'edit' = 'edit'
) => {
    const bootstrapResponse = await app.inject({
        method: 'GET',
        url: '/api/app/bootstrap',
        headers: {
            cookie: ownerCookie,
        },
    });
    const projectId = bootstrapResponse.json().defaultProject.id as string;

    const shareResponse = await app.inject({
        method: 'PATCH',
        url: `/api/projects/${projectId}/sharing`,
        headers: {
            cookie: ownerCookie,
        },
        payload: {
            scope: 'authenticated',
            access,
        },
    });
    expect(shareResponse.statusCode).toBe(200);

    const createDiagramResponse = await app.inject({
        method: 'PUT',
        url: '/api/diagrams/collab-diagram',
        headers: {
            cookie: ownerCookie,
        },
        payload: {
            projectId,
            diagram: {
                id: 'ignored',
                name: 'Realtime ERD',
                databaseType: 'postgresql',
                tables: [{ id: 'tbl-1', name: 'users' }],
                createdAt: '2026-03-25T12:00:00.000Z',
                updatedAt: '2026-03-25T12:00:00.000Z',
            },
        },
    });

    expect(createDiagramResponse.statusCode).toBe(200);
    return {
        projectId,
        diagramId: 'collab-diagram',
    };
};

const createDirectlySharedDiagramFixture = async (
    app: ReturnType<typeof buildApp>,
    ownerCookie: string
) => {
    const bootstrapResponse = await app.inject({
        method: 'GET',
        url: '/api/app/bootstrap',
        headers: {
            cookie: ownerCookie,
        },
    });
    const projectId = bootstrapResponse.json().defaultProject.id as string;

    const createDiagramResponse = await app.inject({
        method: 'PUT',
        url: '/api/diagrams/direct-collab-diagram',
        headers: {
            cookie: ownerCookie,
        },
        payload: {
            projectId,
            diagram: {
                id: 'ignored',
                name: 'Direct Share ERD',
                databaseType: 'postgresql',
                tables: [{ id: 'tbl-1', name: 'users' }],
                createdAt: '2026-03-25T12:00:00.000Z',
                updatedAt: '2026-03-25T12:00:00.000Z',
            },
        },
    });

    expect(createDiagramResponse.statusCode).toBe(200);

    const shareResponse = await app.inject({
        method: 'POST',
        url: '/api/diagrams/direct-collab-diagram/sharing/people',
        headers: {
            cookie: ownerCookie,
        },
        payload: {
            userId: 'member-user',
            access: 'edit',
        },
    });
    expect(shareResponse.statusCode).toBe(200);

    return {
        projectId,
        diagramId: 'direct-collab-diagram',
    };
};

const createDiagramSession = async (
    app: ReturnType<typeof buildApp>,
    diagramId: string,
    cookie: string,
    mode: 'view' | 'edit' = 'edit'
) => {
    const response = await app.inject({
        method: 'POST',
        url: `/api/diagrams/${diagramId}/sessions`,
        headers: {
            cookie,
        },
        payload: {
            mode,
            clientId: `${mode}-${Math.random().toString(36).slice(2, 8)}`,
            userAgent: 'vitest',
        },
    });

    expect(response.statusCode).toBe(200);
    return response.json() as {
        session: {
            id: string;
            baseVersion: number;
        };
        collaboration: {
            document: {
                version: number;
            };
        };
    };
};

const requestText = async (url: string, cookie: string) =>
    await new Promise<{ status: number; body: string }>((resolve, reject) => {
        const request = http.request(
            url,
            {
                headers: {
                    cookie,
                },
            },
            (response) => {
                response.setEncoding('utf8');
                let body = '';
                response.on('data', (chunk) => {
                    body += chunk;
                });
                response.on('end', () => {
                    resolve({
                        status: response.statusCode ?? 0,
                        body,
                    });
                });
            }
        );

        request.on('error', reject);
        request.end();
    });

const openEventStream = async (url: string, cookie: string) =>
    await new Promise<{
        nextEvent: () => Promise<{
            event: string;
            data: {
                type: 'snapshot' | 'session' | 'document';
                diagramId: string;
                sessionId: string | null;
                collaboration: {
                    activeSessionCount: number;
                    document: {
                        version: number;
                    };
                };
            };
        }>;
        close: () => void;
    }>((resolve, reject) => {
        const bufferedEvents: Array<{
            event: string;
            data: {
                type: 'snapshot' | 'session' | 'document';
                diagramId: string;
                sessionId: string | null;
                collaboration: {
                    activeSessionCount: number;
                    document: {
                        version: number;
                    };
                };
            };
        }> = [];
        const waiters: Array<
            (value: {
                event: string;
                data: {
                    type: 'snapshot' | 'session' | 'document';
                    diagramId: string;
                    sessionId: string | null;
                    collaboration: {
                        activeSessionCount: number;
                        document: {
                            version: number;
                        };
                    };
                };
            }) => void
        > = [];
        let buffer = '';

        const pushEvent = (event: {
            event: string;
            data: {
                type: 'snapshot' | 'session' | 'document';
                diagramId: string;
                sessionId: string | null;
                collaboration: {
                    activeSessionCount: number;
                    document: {
                        version: number;
                    };
                };
            };
        }) => {
            const waiter = waiters.shift();
            if (waiter) {
                waiter(event);
                return;
            }

            bufferedEvents.push(event);
        };

        const request = http.request(
            url,
            {
                headers: {
                    cookie,
                },
            },
            (response) => {
                if (response.statusCode !== 200) {
                    response.setEncoding('utf8');
                    let body = '';
                    response.on('data', (chunk) => {
                        body += chunk;
                    });
                    response.on('end', () => {
                        reject(
                            new Error(
                                `Expected 200 SSE response, received ${response.statusCode}: ${body}`
                            )
                        );
                    });
                    return;
                }

                response.setEncoding('utf8');
                response.on('data', (chunk) => {
                    buffer += chunk;

                    while (buffer.includes('\n\n')) {
                        const separatorIndex = buffer.indexOf('\n\n');
                        const rawEvent = buffer.slice(0, separatorIndex);
                        buffer = buffer.slice(separatorIndex + 2);

                        if (
                            rawEvent.trim().length === 0 ||
                            rawEvent.startsWith(':')
                        ) {
                            continue;
                        }

                        const payload = rawEvent.split('\n').reduce(
                            (state, line) => {
                                if (line.startsWith('event:')) {
                                    state.event = line.slice(6).trim();
                                }
                                if (line.startsWith('data:')) {
                                    state.data += line.slice(5).trim();
                                }
                                return state;
                            },
                            { event: 'message', data: '' }
                        );

                        if (!payload.data) {
                            continue;
                        }

                        pushEvent({
                            event: payload.event,
                            data: JSON.parse(payload.data) as {
                                type: 'snapshot' | 'session' | 'document';
                                diagramId: string;
                                sessionId: string | null;
                                collaboration: {
                                    activeSessionCount: number;
                                    document: {
                                        version: number;
                                    };
                                };
                            },
                        });
                    }
                });

                resolve({
                    nextEvent: async () => {
                        const existingEvent = bufferedEvents.shift();
                        if (existingEvent) {
                            return existingEvent;
                        }

                        return await new Promise((nextResolve) => {
                            waiters.push(nextResolve);
                        });
                    },
                    close: () => {
                        request.destroy();
                        response.destroy();
                    },
                });
            }
        );

        request.on('error', reject);
        request.end();
    });

afterEach(() => {
    while (tempDirs.length > 0) {
        const dir = tempDirs.pop();
        if (dir) {
            rmSync(dir, { recursive: true, force: true });
        }
    }
});

describe('collaboration routes', () => {
    it('rejects event subscriptions for users without diagram access', async () => {
        const env = createAuthEnv();
        const repository = new AppRepository(env.appDbPath);
        const app = buildApp({
            env,
            appRepository: repository,
        });
        repository.putUserAuthRecord(createMemberUser());

        const ownerCookie = await login(
            app,
            'owner@example.com',
            'super-secret-password'
        );
        const memberCookie = await login(
            app,
            'member@example.com',
            'member-password'
        );
        const bootstrapResponse = await app.inject({
            method: 'GET',
            url: '/api/app/bootstrap',
            headers: {
                cookie: ownerCookie,
            },
        });
        const projectId = bootstrapResponse.json().defaultProject.id as string;

        await app.inject({
            method: 'PUT',
            url: '/api/diagrams/private-collab',
            headers: {
                cookie: ownerCookie,
            },
            payload: {
                projectId,
                diagram: {
                    id: 'ignored',
                    name: 'Private Collaboration Diagram',
                    databaseType: 'postgresql',
                    createdAt: '2026-03-25T12:00:00.000Z',
                    updatedAt: '2026-03-25T12:00:00.000Z',
                },
            },
        });

        const ownerSession = await createDiagramSession(
            app,
            'private-collab',
            ownerCookie
        );

        const baseUrl = await app.listen({ port: 0, host: '127.0.0.1' });
        const response = await requestText(
            `${baseUrl}/api/diagrams/private-collab/events?sessionId=${ownerSession.session.id}`,
            memberCookie
        );

        expect(response.status).toBe(404);
        expect(JSON.parse(response.body)).toEqual(
            expect.objectContaining({
                code: 'DIAGRAM_NOT_FOUND',
            })
        );

        await app.close();
    });

    it('broadcasts participant presence changes across a shared diagram session', async () => {
        const env = createAuthEnv();
        const repository = new AppRepository(env.appDbPath);
        const app = buildApp({
            env,
            appRepository: repository,
        });
        repository.putUserAuthRecord(createMemberUser());

        const ownerCookie = await login(
            app,
            'owner@example.com',
            'super-secret-password'
        );
        const memberCookie = await login(
            app,
            'member@example.com',
            'member-password'
        );
        const { diagramId } = await createSharedDiagramFixture(
            app,
            ownerCookie
        );
        const ownerSession = await createDiagramSession(
            app,
            diagramId,
            ownerCookie
        );

        const baseUrl = await app.listen({ port: 0, host: '127.0.0.1' });
        const stream = await openEventStream(
            `${baseUrl}/api/diagrams/${diagramId}/events?sessionId=${ownerSession.session.id}`,
            ownerCookie
        );

        const snapshotEvent = await stream.nextEvent();
        expect(snapshotEvent.event).toBe('snapshot');
        expect(snapshotEvent.data.collaboration.activeSessionCount).toBe(1);

        const memberSession = await createDiagramSession(
            app,
            diagramId,
            memberCookie
        );
        const joinedEvent = await stream.nextEvent();
        expect(joinedEvent.event).toBe('session');
        expect(joinedEvent.data.sessionId).toBe(memberSession.session.id);
        expect(joinedEvent.data.collaboration.activeSessionCount).toBe(2);

        const closeResponse = await app.inject({
            method: 'PATCH',
            url: `/api/diagrams/${diagramId}/sessions/${memberSession.session.id}`,
            headers: {
                cookie: memberCookie,
            },
            payload: {
                close: true,
                status: 'closed',
                lastSeenDocumentVersion:
                    memberSession.collaboration.document.version,
            },
        });
        expect(closeResponse.statusCode).toBe(200);

        const leftEvent = await stream.nextEvent();
        expect(leftEvent.event).toBe('session');
        expect(leftEvent.data.sessionId).toBe(memberSession.session.id);
        expect(leftEvent.data.collaboration.activeSessionCount).toBe(1);

        await stream.close();
        await app.close();
    });

    it('broadcasts document updates from one collaborator to another', async () => {
        const env = createAuthEnv();
        const repository = new AppRepository(env.appDbPath);
        const app = buildApp({
            env,
            appRepository: repository,
        });
        repository.putUserAuthRecord(createMemberUser());

        const ownerCookie = await login(
            app,
            'owner@example.com',
            'super-secret-password'
        );
        const memberCookie = await login(
            app,
            'member@example.com',
            'member-password'
        );
        const { diagramId } = await createSharedDiagramFixture(
            app,
            ownerCookie
        );
        const memberSession = await createDiagramSession(
            app,
            diagramId,
            memberCookie
        );
        const ownerSession = await createDiagramSession(
            app,
            diagramId,
            ownerCookie
        );

        const baseUrl = await app.listen({ port: 0, host: '127.0.0.1' });
        const stream = await openEventStream(
            `${baseUrl}/api/diagrams/${diagramId}/events?sessionId=${memberSession.session.id}`,
            memberCookie
        );

        const snapshotEvent = await stream.nextEvent();
        expect(snapshotEvent.event).toBe('snapshot');
        expect(snapshotEvent.data.collaboration.document.version).toBe(1);

        const updateResponse = await app.inject({
            method: 'PATCH',
            url: `/api/diagrams/${diagramId}`,
            headers: {
                cookie: ownerCookie,
            },
            payload: {
                name: 'Realtime ERD Updated',
                sessionId: ownerSession.session.id,
                baseVersion: ownerSession.session.baseVersion,
            },
        });
        expect(updateResponse.statusCode).toBe(200);

        const documentEvent = await stream.nextEvent();
        expect(documentEvent.event).toBe('document');
        expect(documentEvent.data.sessionId).toBe(ownerSession.session.id);
        expect(documentEvent.data.collaboration.document.version).toBe(2);

        await stream.close();
        await app.close();
    });

    it('keeps viewers read-only while still allowing live document updates', async () => {
        const env = createAuthEnv();
        const repository = new AppRepository(env.appDbPath);
        const app = buildApp({
            env,
            appRepository: repository,
        });
        repository.putUserAuthRecord(createMemberUser());

        const ownerCookie = await login(
            app,
            'owner@example.com',
            'super-secret-password'
        );
        const memberCookie = await login(
            app,
            'member@example.com',
            'member-password'
        );
        const { diagramId } = await createSharedDiagramFixture(
            app,
            ownerCookie,
            'view'
        );

        const forbiddenEditSessionResponse = await app.inject({
            method: 'POST',
            url: `/api/diagrams/${diagramId}/sessions`,
            headers: {
                cookie: memberCookie,
            },
            payload: {
                mode: 'edit',
                clientId: 'viewer-edit-attempt',
                userAgent: 'vitest',
            },
        });
        expect(forbiddenEditSessionResponse.statusCode).toBe(403);
        expect(forbiddenEditSessionResponse.json()).toEqual(
            expect.objectContaining({
                code: 'DIAGRAM_EDIT_SESSION_FORBIDDEN',
            })
        );

        const viewerSession = await createDiagramSession(
            app,
            diagramId,
            memberCookie,
            'view'
        );
        const ownerSession = await createDiagramSession(
            app,
            diagramId,
            ownerCookie
        );

        const baseUrl = await app.listen({ port: 0, host: '127.0.0.1' });
        const stream = await openEventStream(
            `${baseUrl}/api/diagrams/${diagramId}/events?sessionId=${viewerSession.session.id}`,
            memberCookie
        );

        const snapshotEvent = await stream.nextEvent();
        expect(snapshotEvent.event).toBe('snapshot');
        expect(snapshotEvent.data.collaboration.document.version).toBe(1);

        const forbiddenUpdateResponse = await app.inject({
            method: 'PATCH',
            url: `/api/diagrams/${diagramId}`,
            headers: {
                cookie: memberCookie,
            },
            payload: {
                name: 'Viewer Attempted Rename',
                sessionId: viewerSession.session.id,
                baseVersion: viewerSession.session.baseVersion,
            },
        });
        expect(forbiddenUpdateResponse.statusCode).toBe(404);
        expect(forbiddenUpdateResponse.json()).toEqual(
            expect.objectContaining({
                code: 'DIAGRAM_NOT_FOUND',
            })
        );

        const ownerUpdateResponse = await app.inject({
            method: 'PATCH',
            url: `/api/diagrams/${diagramId}`,
            headers: {
                cookie: ownerCookie,
            },
            payload: {
                name: 'Owner Updated Shared Diagram',
                sessionId: ownerSession.session.id,
                baseVersion: ownerSession.session.baseVersion,
            },
        });
        expect(ownerUpdateResponse.statusCode).toBe(200);

        const documentEvent = await stream.nextEvent();
        expect(documentEvent.event).toBe('document');
        expect(documentEvent.data.sessionId).toBe(ownerSession.session.id);
        expect(documentEvent.data.collaboration.document.version).toBe(2);

        const viewerReloadResponse = await app.inject({
            method: 'GET',
            url: `/api/diagrams/${diagramId}`,
            headers: {
                cookie: memberCookie,
            },
        });
        expect(viewerReloadResponse.statusCode).toBe(200);
        expect(viewerReloadResponse.json()).toEqual(
            expect.objectContaining({
                name: 'Owner Updated Shared Diagram',
                access: 'view',
            })
        );

        await stream.close();
        await app.close();
    });

    it('persists direct-share editor saves and exposes them to the owner', async () => {
        const env = createAuthEnv();
        const repository = new AppRepository(env.appDbPath);
        const app = buildApp({
            env,
            appRepository: repository,
        });
        repository.putUserAuthRecord(createMemberUser());

        const ownerCookie = await login(
            app,
            'owner@example.com',
            'super-secret-password'
        );
        const memberCookie = await login(
            app,
            'member@example.com',
            'member-password'
        );
        const { projectId, diagramId } =
            await createDirectlySharedDiagramFixture(app, ownerCookie);
        const ownerSession = await createDiagramSession(
            app,
            diagramId,
            ownerCookie
        );
        const memberSession = await createDiagramSession(
            app,
            diagramId,
            memberCookie
        );

        const baseUrl = await app.listen({ port: 0, host: '127.0.0.1' });
        const stream = await openEventStream(
            `${baseUrl}/api/diagrams/${diagramId}/events?sessionId=${ownerSession.session.id}`,
            ownerCookie
        );
        const initialEvent = await stream.nextEvent();
        expect(initialEvent.event).toBe('snapshot');
        expect(initialEvent.data.collaboration.document.version).toBe(1);

        const memberUpdateResponse = await app.inject({
            method: 'PUT',
            url: `/api/diagrams/${diagramId}`,
            headers: {
                cookie: memberCookie,
            },
            payload: {
                projectId,
                sessionId: memberSession.session.id,
                baseVersion: memberSession.session.baseVersion,
                diagram: {
                    id: 'ignored',
                    name: 'Direct Share ERD',
                    databaseType: 'postgresql',
                    tables: [
                        { id: 'tbl-1', name: 'users' },
                        { id: 'tbl-2', name: 'projects' },
                    ],
                    createdAt: '2026-03-25T12:00:00.000Z',
                    updatedAt: '2026-03-25T12:05:00.000Z',
                },
            },
        });
        expect(memberUpdateResponse.statusCode).toBe(200);
        expect(memberUpdateResponse.json().diagram).toEqual(
            expect.objectContaining({
                access: 'edit',
            })
        );

        const ownerDocumentEvent = await stream.nextEvent();
        expect(ownerDocumentEvent.event).toBe('document');
        expect(ownerDocumentEvent.data.sessionId).toBe(
            memberSession.session.id
        );
        expect(ownerDocumentEvent.data.collaboration.document.version).toBe(2);

        const ownerReloadResponse = await app.inject({
            method: 'GET',
            url: `/api/diagrams/${diagramId}`,
            headers: {
                cookie: ownerCookie,
            },
        });
        expect(ownerReloadResponse.statusCode).toBe(200);
        expect(ownerReloadResponse.json().diagram.tables).toEqual([
            expect.objectContaining({
                id: 'tbl-1',
                name: 'users',
            }),
            expect.objectContaining({
                id: 'tbl-2',
                name: 'projects',
            }),
        ]);
        expect(ownerReloadResponse.json().collaboration.document.version).toBe(
            2
        );

        await stream.close();
        await app.close();
    });
});
