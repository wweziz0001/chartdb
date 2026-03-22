import type { FastifyInstance } from 'fastify';
import type { AppPersistenceService } from './service.js';
import {
    createProjectRequestSchema,
    diagramIncludeOptionsSchema,
    listDiagramsQuerySchema,
    searchQuerySchema,
    updateProjectRequestSchema,
    upsertDiagramRequestSchema,
} from './contracts.js';

export const registerAppPersistenceRoutes = (
    app: FastifyInstance,
    service: AppPersistenceService
) => {
    app.get('/api/app/health', async () => ({
        ok: true,
        service: 'chartdb-app-api',
        persistence: service.getHealth(),
    }));

    app.get('/api/app/me', async () => ({
        user: service.getCurrentUser(),
    }));

    app.get('/api/app/projects', async (request) => {
        const query = searchQuerySchema.partial().parse(request.query);
        return service.listProjects(query.q);
    });

    app.post('/api/app/projects', async (request) => {
        const payload = createProjectRequestSchema.parse(request.body);
        return service.createProject(payload);
    });

    app.get('/api/app/projects/:id', async (request) => {
        const params = request.params as { id: string };
        return service.getProject(params.id);
    });

    app.patch('/api/app/projects/:id', async (request) => {
        const params = request.params as { id: string };
        const payload = updateProjectRequestSchema.parse(request.body);
        return service.updateProject(params.id, payload);
    });

    app.get('/api/app/diagrams', async (request) => {
        const query = listDiagramsQuerySchema.parse(request.query);
        return service.listDiagrams(query);
    });

    app.get('/api/app/diagrams/:id', async (request) => {
        const params = request.params as { id: string };
        const query = diagramIncludeOptionsSchema.parse(request.query);
        return service.getDiagram(params.id, query);
    });

    app.put('/api/app/diagrams/:id', async (request) => {
        const params = request.params as { id: string };
        const payload = upsertDiagramRequestSchema.parse(request.body);
        return service.upsertDiagram({
            ...payload,
            diagram: {
                ...payload.diagram,
                id: params.id,
            },
        });
    });

    app.delete('/api/app/diagrams/:id', async (request) => {
        const params = request.params as { id: string };
        return service.deleteDiagram(params.id);
    });

    app.get('/api/app/search', async (request) => {
        const query = searchQuerySchema.parse(request.query);
        return service.search(query.q);
    });
};
