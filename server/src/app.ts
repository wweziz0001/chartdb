import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import { ZodError } from 'zod';
import { serverEnv, type ServerEnv } from './config/env.js';
import { buildLoggerOptions } from './config/logger.js';
import { createAppContext } from './context/app-context.js';
import type { AppRepository } from './repositories/app-repository.js';
import type { MetadataRepository } from './repositories/metadata-repository.js';
import { registerAuthRoutes } from './routes/auth-routes.js';
import { registerHealthRoutes } from './routes/health-routes.js';
import { registerPersistenceRoutes } from './routes/persistence-routes.js';
import { registerSchemaSyncRoutes } from './routes/schema-sync-routes.js';
import { AppError } from './utils/app-error.js';

export const buildApp = (options?: {
    env?: ServerEnv;
    metadataRepository?: MetadataRepository;
    appRepository?: AppRepository;
}) => {
    const env = options?.env ?? serverEnv;
    const app = Fastify({
        logger: buildLoggerOptions(env),
    });
    const context = createAppContext(env, {
        metadataRepository: options?.metadataRepository,
        appRepository: options?.appRepository,
    });

    app.register(cors, {
        origin: env.corsOrigin === '*' ? true : env.corsOrigin,
        credentials: env.authMode !== 'disabled',
    });
    app.register(cookie);

    app.addHook('onRequest', async (request, reply) => {
        request.auth = await context.authService.authenticateRequest(request);

        const isPublicApiRoute =
            request.url === '/api/health' ||
            request.url === '/api/auth/session' ||
            request.url === '/api/auth/login' ||
            request.url === '/api/auth/logout';

        if (
            request.url.startsWith('/api') &&
            context.authService.isEnabled() &&
            !isPublicApiRoute &&
            !request.auth.authenticated
        ) {
            return reply.code(401).send({
                error: 'Authentication required.',
                code: 'AUTH_REQUIRED',
            });
        }
    });

    app.setErrorHandler((error, request, reply) => {
        if (error instanceof ZodError) {
            return reply.code(400).send({
                error: 'Invalid request payload.',
                issues: error.issues.map((issue) => ({
                    path: issue.path.join('.'),
                    message: issue.message,
                })),
            });
        }

        if (error instanceof AppError) {
            return reply.code(error.statusCode).send({
                error: error.message,
                code: error.code,
            });
        }

        request.log.error(error);
        return reply.code(500).send({
            error: 'Internal server error.',
        });
    });

    registerAuthRoutes(app, context);
    registerHealthRoutes(app, context);
    registerPersistenceRoutes(app, context);
    registerSchemaSyncRoutes(app, context);

    app.addHook('onClose', async () => {
        context.close();
    });

    return app;
};
