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

    app.get('/api/collections', async () => {
        return {
            items: context.persistenceService.listCollections(),
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
            items: context.persistenceService.listProjects({
                search: query.search,
                collectionId: query.collectionId,
                unassigned: query.unassigned,
            }),
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
                request.body
            ),
        };
    });

    app.delete('/api/projects/:id', async (request) => {
        const params = request.params as { id: string };
        context.persistenceService.deleteProject(params.id);
        return { ok: true };
    });

    app.get('/api/projects/:id/diagrams', async (request) => {
        const params = request.params as { id: string };
        return {
            items: context.persistenceService.listProjectDiagrams(
                params.id,
                request.query
            ),
        };
    });

    app.get('/api/diagrams/:id', async (request) => {
        const params = request.params as { id: string };
        return context.persistenceService.getDiagram(params.id);
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
                request.body
            ),
        };
    });

    app.delete('/api/diagrams/:id', async (request) => {
        const params = request.params as { id: string };
        context.persistenceService.deleteDiagram(params.id);
        return { ok: true };
    });
};
