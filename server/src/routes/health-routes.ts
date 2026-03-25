import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AppContext } from '../context/app-context.js';

const resolveReadiness = (context: AppContext) => {
    const checks = {
        appDatabase: {
            status: context.appRepository.ping() ? 'up' : 'down',
            path: context.env.appDbPath,
        },
        metadataDatabase: {
            status: context.metadataRepository.ping() ? 'up' : 'down',
            path: context.env.metadataDbPath,
        },
    } as const;

    return {
        ok: Object.values(checks).every((check) => check.status === 'up'),
        checks,
    };
};

const sendWithStatus = (
    reply: FastifyReply,
    statusCode: number,
    payload: Record<string, unknown>
) => reply.code(statusCode).send(payload);

export const registerHealthRoutes = (
    app: FastifyInstance,
    context: AppContext
) => {
    app.get('/api/livez', async (_, reply) => {
        return sendWithStatus(reply, 200, {
            ok: true,
            service: 'chartdb-api',
            environment: context.env.nodeEnv,
            timestamp: new Date().toISOString(),
            uptimeSeconds: Math.round(process.uptime()),
        });
    });

    app.get('/api/readyz', async (_, reply) => {
        const readiness = resolveReadiness(context);

        return sendWithStatus(reply, readiness.ok ? 200 : 503, {
            ok: readiness.ok,
            service: 'chartdb-api',
            checks: readiness.checks,
            timestamp: new Date().toISOString(),
        });
    });

    app.get('/api/health', async (_, reply) => {
        const readiness = resolveReadiness(context);
        const authBootstrap = context.authService.getBootstrapStatus();

        return sendWithStatus(reply, readiness.ok ? 200 : 503, {
            ok: readiness.ok,
            service: 'chartdb-api',
            environment: context.env.nodeEnv,
            persistence: {
                app: {
                    adapter: 'sqlite',
                    path: context.env.appDbPath,
                    status: readiness.checks.appDatabase.status,
                },
                schemaSync: {
                    adapter: 'sqlite',
                    path: context.env.metadataDbPath,
                    status: readiness.checks.metadataDatabase.status,
                },
            },
            auth: {
                mode: context.env.authMode,
                bootstrapRequired: authBootstrap.required,
                adminInitialized: authBootstrap.completed,
            },
            proxy: {
                trustProxy: context.env.trustProxy ?? false,
            },
            uptimeSeconds: Math.round(process.uptime()),
            timestamp: new Date().toISOString(),
        });
    });
};
