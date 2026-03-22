import Fastify from 'fastify';
import cors from '@fastify/cors';
import { ZodError } from 'zod';
import {
    applySchemaRequestSchema,
    connectionTestRequestSchema,
    connectionUpsertSchema,
    diffSchemaRequestSchema,
    importLiveSchemaRequestSchema,
} from '@chartdb/schema-sync-core';
import { serverEnv } from './config/env.js';
import { MetadataRepository } from './repositories/metadata-repository.js';
import { ConnectionsService } from './services/connections-service.js';
import { SchemaSyncService } from './services/schema-sync-service.js';
import { ApplyService } from './services/apply-service.js';
import { AppError } from './utils/app-error.js';
import { AppPersistenceRepository } from './app-persistence/repository.js';
import { AppPersistenceService } from './app-persistence/service.js';
import { registerAppPersistenceRoutes } from './app-persistence/routes.js';

export const buildApp = (env = serverEnv) => {
    const app = Fastify({
        logger: {
            level: env.logLevel,
            base: {
                service: 'chartdb-api',
                environment: env.nodeEnv,
            },
            redact: ['req.body.connection.secret.password', 'password'],
        },
    });
    const repository = new MetadataRepository(env.metadataDbPath);
    const appRepository = new AppPersistenceRepository(env.metadataDbPath);
    const connectionsService = new ConnectionsService(
        repository,
        env.encryptionKey
    );
    const schemaSyncService = new SchemaSyncService(
        repository,
        connectionsService
    );
    const applyService = new ApplyService(
        repository,
        connectionsService,
        schemaSyncService
    );
    const appPersistenceService = new AppPersistenceService(appRepository, env);

    app.register(cors, {
        origin: env.corsOrigin === '*' ? true : env.corsOrigin,
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

    app.addHook('onClose', async () => {
        repository.close();
        appRepository.close();
    });

    app.get('/api/health', async () => ({
        ok: true,
        service: 'chartdb-api',
        schemaSync: {
            storage: 'sqlite',
        },
        appPersistence: appPersistenceService.getHealth(),
    }));

    registerAppPersistenceRoutes(app, appPersistenceService);

    app.get('/api/connections', async () => ({
        items: connectionsService.listConnections(),
    }));

    app.post('/api/connections', async (request) => {
        const payload = connectionUpsertSchema.parse(request.body);
        return {
            connection: connectionsService.createConnection(payload),
        };
    });

    app.patch('/api/connections/:id', async (request) => {
        const payload = connectionUpsertSchema.parse(request.body);
        const params = request.params as { id: string };
        return {
            connection: connectionsService.updateConnection(params.id, payload),
        };
    });

    app.delete('/api/connections/:id', async (request) => {
        const params = request.params as { id: string };
        connectionsService.deleteConnection(params.id);
        return { ok: true };
    });

    app.post('/api/connections/test', async (request) => {
        const payload = connectionTestRequestSchema.parse(request.body);
        return await connectionsService.testConnection(payload);
    });

    app.post('/api/connections/:id/test', async (request) => {
        const params = request.params as { id: string };
        return await connectionsService.testConnection({
            connectionId: params.id,
        });
    });

    app.post('/api/schema/import-live', async (request) => {
        const payload = importLiveSchemaRequestSchema.parse(request.body);
        return await schemaSyncService.importLiveSchema(payload);
    });

    app.post('/api/schema/diff', async (request) => {
        const payload = diffSchemaRequestSchema.parse(request.body);
        return await schemaSyncService.diffSchema(payload);
    });

    app.post('/api/schema/apply', async (request) => {
        const payload = applySchemaRequestSchema.parse(request.body);
        return await applyService.applyPlan(payload);
    });

    app.get('/api/schema/jobs/:id', async (request, reply) => {
        const params = request.params as { id: string };
        const job = repository.getApplyJob(params.id);
        if (!job) {
            return reply.code(404).send({ error: 'Job not found' });
        }
        return {
            id: job.id,
            status: job.status,
            logs: job.logs,
            error: job.error ?? null,
            executedStatements: job.executedStatements,
            auditId: job.auditId,
        };
    });

    app.get('/api/audit/:id', async (request, reply) => {
        const params = request.params as { id: string };
        const audit = repository.getAudit(params.id);
        if (!audit) {
            return reply.code(404).send({ error: 'Audit record not found' });
        }
        return audit;
    });

    return app;
};
