import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../context/app-context.js';

export const registerPersistenceRoutes = (
    app: FastifyInstance,
    context: AppContext
) => {
    app.post('/api/backups/export', async (request) => {
        return context.persistenceService.exportBackup(request.body);
    });

    app.post('/api/backups/import', async (request) => {
        return {
            import: context.persistenceService.importBackup(
                request.body,
                request.auth.user
            ),
        };
    });

    app.get('/api/app/bootstrap', async (request) => {
        return context.persistenceService.bootstrap(request.auth.user);
    });

    app.get('/api/collections', async (request) => {
        return {
            items: context.persistenceService.listCollections(
                request.auth.user
            ),
        };
    });

    app.post('/api/collections', async (request) => {
        return {
            collection: context.persistenceService.createCollection(
                request.body,
                request.auth.user
            ),
        };
    });

    app.patch('/api/collections/:id', async (request) => {
        const params = request.params as { id: string };
        return {
            collection: context.persistenceService.updateCollection(
                params.id,
                request.body
            ),
        };
    });

    app.delete('/api/collections/:id', async (request) => {
        const params = request.params as { id: string };
        context.persistenceService.deleteCollection(params.id);
        return { ok: true };
    });

    app.get('/api/projects', async (request) => {
        const query = request.query as {
            search?: string;
            collectionId?: string;
            unassigned?: boolean;
        };
        return {
            items: context.persistenceService.listProjects(
                {
                    search: query.search,
                    collectionId: query.collectionId,
                    unassigned: query.unassigned,
                },
                request.auth.user
            ),
        };
    });

    app.post('/api/projects', async (request) => {
        return {
            project: context.persistenceService.createProject(
                request.body,
                request.auth.user
            ),
        };
    });

    app.patch('/api/projects/:id', async (request) => {
        const params = request.params as { id: string };
        return {
            project: context.persistenceService.updateProject(
                params.id,
                request.body,
                request.auth.user
            ),
        };
    });

    app.delete('/api/projects/:id', async (request) => {
        const params = request.params as { id: string };
        context.persistenceService.deleteProject(params.id, request.auth.user);
        return { ok: true };
    });

    app.get('/api/projects/:id/sharing', async (request) => {
        const params = request.params as { id: string };
        return {
            sharing: context.persistenceService.getProjectSharing(
                params.id,
                request.auth.user
            ),
        };
    });

    app.patch('/api/projects/:id/sharing', async (request) => {
        const params = request.params as { id: string };
        return {
            sharing: context.persistenceService.updateProjectSharing(
                params.id,
                request.body,
                request.auth.user
            ),
        };
    });

    app.get('/api/projects/:id/diagrams', async (request) => {
        const params = request.params as { id: string };
        return {
            items: context.persistenceService.listProjectDiagrams(
                params.id,
                request.query,
                request.auth.user
            ),
        };
    });

    app.get('/api/diagrams/:id', async (request) => {
        const params = request.params as { id: string };
        return context.persistenceService.getDiagram(
            params.id,
            request.auth.user
        );
    });

    app.post('/api/diagrams/:id/sessions', async (request) => {
        const params = request.params as { id: string };
        return context.persistenceService.createDiagramSession(
            params.id,
            request.body,
            request.auth.user
        );
    });

    app.get('/api/diagrams/:id/sessions/:sessionId', async (request) => {
        const params = request.params as { id: string; sessionId: string };
        return context.persistenceService.getDiagramSession(
            params.id,
            params.sessionId,
            request.auth.user
        );
    });

    app.get('/api/diagrams/:id/events', async (request, reply) => {
        const params = request.params as { id: string };
        const query = request.query as { sessionId?: string };
        const sessionId = query.sessionId?.trim();

        if (!sessionId) {
            return reply.code(400).send({
                error: 'Diagram session id is required.',
                code: 'DIAGRAM_SESSION_ID_REQUIRED',
            });
        }

        const snapshot =
            context.persistenceService.assertCanSubscribeToDiagramEvents(
                params.id,
                sessionId,
                request.auth.user
            );

        reply.hijack();
        reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
        });
        reply.raw.flushHeaders?.();

        const sendEvent = (event: { type: string; payload: unknown }) => {
            reply.raw.write(`event: ${event.type}\n`);
            reply.raw.write(`data: ${JSON.stringify(event.payload)}\n\n`);
        };

        sendEvent({
            type: 'snapshot',
            payload: {
                type: 'snapshot',
                diagramId: params.id,
                sessionId: snapshot.collaboration.document.lastSavedSessionId,
                emittedAt: new Date().toISOString(),
                collaboration: snapshot.collaboration,
            },
        });

        const unsubscribe = context.diagramCollaborationBroker.subscribe(
            params.id,
            (event) => {
                sendEvent({
                    type: event.type,
                    payload: event,
                });
            }
        );

        const heartbeat = setInterval(() => {
            reply.raw.write(': keep-alive\n\n');
        }, 15000);

        const cleanup = () => {
            clearInterval(heartbeat);
            unsubscribe();
        };

        request.raw.on('close', cleanup);
        request.raw.on('aborted', cleanup);
    });

    app.patch('/api/diagrams/:id/sessions/:sessionId', async (request) => {
        const params = request.params as { id: string; sessionId: string };
        return context.persistenceService.updateDiagramSession(
            params.id,
            params.sessionId,
            request.body,
            request.auth.user
        );
    });

    app.put('/api/diagrams/:id', async (request) => {
        const params = request.params as { id: string };
        return {
            diagram: context.persistenceService.upsertDiagram(
                params.id,
                request.body,
                request.auth.user
            ),
        };
    });

    app.patch('/api/diagrams/:id', async (request) => {
        const params = request.params as { id: string };
        return {
            diagram: context.persistenceService.updateDiagram(
                params.id,
                request.body,
                request.auth.user
            ),
        };
    });

    app.delete('/api/diagrams/:id', async (request) => {
        const params = request.params as { id: string };
        context.persistenceService.deleteDiagram(params.id, request.auth.user);
        return { ok: true };
    });

    app.get('/api/diagrams/:id/sharing', async (request) => {
        const params = request.params as { id: string };
        return {
            sharing: context.persistenceService.getDiagramSharing(
                params.id,
                request.auth.user
            ),
        };
    });

    app.patch('/api/diagrams/:id/sharing', async (request) => {
        const params = request.params as { id: string };
        return {
            sharing: context.persistenceService.updateDiagramSharing(
                params.id,
                request.body,
                request.auth.user
            ),
        };
    });

    app.get('/api/shared/projects/:id/:shareToken', async (request) => {
        const params = request.params as { id: string; shareToken: string };
        return context.persistenceService.getSharedProject(
            params.id,
            params.shareToken
        );
    });

    app.get(
        '/api/shared/projects/:id/:shareToken/diagrams/:diagramId',
        async (request) => {
            const params = request.params as {
                id: string;
                shareToken: string;
                diagramId: string;
            };
            return context.persistenceService.getSharedProjectDiagram(
                params.id,
                params.diagramId,
                params.shareToken
            );
        }
    );

    app.get('/api/shared/diagrams/:id/:shareToken', async (request) => {
        const params = request.params as { id: string; shareToken: string };
        return context.persistenceService.getSharedDiagram(
            params.id,
            params.shareToken
        );
    });
};
