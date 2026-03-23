import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../context/app-context.js';

export const registerHealthRoutes = (
    app: FastifyInstance,
    context: AppContext
) => {
    app.get('/api/health', async () => {
        const bootstrap = context.authService.isEnabled()
            ? null
            : context.persistenceService.bootstrap();
        const authBootstrap = context.authService.getBootstrapStatus();
        return {
            ok: true,
            service: 'chartdb-api',
            environment: context.env.nodeEnv,
            persistence: {
                app: 'sqlite',
                schemaSync: 'sqlite',
            },
            auth: {
                mode: context.env.authMode,
                bootstrapRequired: authBootstrap.required,
                adminInitialized: authBootstrap.completed,
            },
            defaultProjectId: bootstrap?.defaultProject.id ?? null,
            timestamp: new Date().toISOString(),
        };
    });
};
