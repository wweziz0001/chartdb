/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import type { IncomingMessage, ServerResponse } from 'node:http';
import { canonicalSchemaSchema } from '../../../shared/schema-sync/canonical';
import { diffCanonicalSchemas } from '../../../shared/schema-sync/diff';
import { buildPostgresMigrationPlan } from '../../../shared/schema-sync/postgres-sql';
import {
    postgresConnectionInputSchema,
    schemaApplyRequestSchema,
    schemaDiffRequestSchema,
    schemaImportRequestSchema,
} from '../../../shared/schema-sync/validation';
import { auditStore } from '../audit/audit-store';
import { serverEnv } from '../config/env';
import { applyPostgresMigrationPlan } from '../db/postgres-apply';
import { connectionStore } from '../db/connection-store';
import { introspectPostgresSchema } from '../db/postgres-introspection';
import { withPostgresClient } from '../db/postgres-client';
import { HttpError, readJsonBody, sendJson, sha256 } from '../utils/http';
import { logger } from '../utils/logger';

const actorFallback = { id: 'anonymous', name: 'Anonymous User' };

const healthResponse = {
    status: 'ok',
    service: 'chartdb-schema-sync-api',
    now: new Date().toISOString(),
};

export const requestHandler = async (
    req: IncomingMessage,
    res: ServerResponse
) => {
    const url = new URL(
        req.url ?? '/',
        `http://${req.headers.host ?? 'localhost'}`
    );
    try {
        if (req.method === 'OPTIONS') {
            sendJson(res, 200, { ok: true }, serverEnv.corsOrigin);
            return;
        }
        if (req.method === 'GET' && url.pathname === '/api/health') {
            sendJson(res, 200, healthResponse, serverEnv.corsOrigin);
            return;
        }
        if (req.method === 'GET' && url.pathname === '/api/connections') {
            const connections = await connectionStore.list();
            sendJson(res, 200, { connections }, serverEnv.corsOrigin);
            return;
        }
        if (req.method === 'POST' && url.pathname === '/api/connections') {
            const body = postgresConnectionInputSchema.parse(
                await readJsonBody(req)
            );
            const connection = await connectionStore.save(body);
            logger.info('connection_saved', {
                connectionId: connection.id,
                host: connection.host,
                database: connection.database,
            });
            sendJson(res, 201, { connection }, serverEnv.corsOrigin);
            return;
        }
        if (
            req.method === 'DELETE' &&
            url.pathname.startsWith('/api/connections/')
        ) {
            const id = url.pathname.split('/').pop();
            if (!id) throw new HttpError(400, 'Connection id is required.');
            await connectionStore.delete(id);
            sendJson(res, 200, { deleted: true }, serverEnv.corsOrigin);
            return;
        }
        if (req.method === 'POST' && url.pathname === '/api/connections/test') {
            const body = postgresConnectionInputSchema.parse(
                await readJsonBody(req)
            );
            await withPostgresClient(body, async (client) => {
                await client.query('SELECT current_database(), current_user;');
            });
            logger.info('connection_tested', {
                host: body.host,
                database: body.database,
                fingerprint: sha256(
                    `${body.host}:${body.port}:${body.database}:${body.username}`
                ),
            });
            sendJson(res, 200, { ok: true }, serverEnv.corsOrigin);
            return;
        }
        if (
            req.method === 'POST' &&
            url.pathname === '/api/schema/import-live'
        ) {
            const body = schemaImportRequestSchema.parse(
                await readJsonBody(req)
            );
            const connection = await connectionStore.getResolved(
                body.connectionId
            );
            if (!connection) throw new HttpError(404, 'Connection not found.');
            const schema = await introspectPostgresSchema({
                config: connection,
                schemaNames: body.schemaNames?.length
                    ? body.schemaNames
                    : connection.schemaNames?.length
                      ? connection.schemaNames
                      : ['public'],
            });
            const audit = await auditStore.append({
                type: 'import',
                actor: actorFallback,
                connectionId: connection.id,
                payload: { schema },
            });
            logger.info('schema_imported', {
                connectionId: connection.id,
                tableCount: schema.tables.length,
            });
            sendJson(
                res,
                200,
                { schema, auditId: audit.id },
                serverEnv.corsOrigin
            );
            return;
        }
        if (req.method === 'POST' && url.pathname === '/api/schema/diff') {
            const body = schemaDiffRequestSchema.parse(await readJsonBody(req));
            const diff = diffCanonicalSchemas(body.baseline, body.target);
            const plan = buildPostgresMigrationPlan(body.baseline, body.target);
            const audit = await auditStore.append({
                type: 'diff',
                actor: actorFallback,
                payload: {
                    baseline: body.baseline,
                    target: body.target,
                    diff,
                    sql: plan.sql,
                },
            });
            logger.info('schema_diffed', {
                auditId: audit.id,
                destructiveChanges: diff.summary.destructiveChangeCount,
            });
            sendJson(
                res,
                200,
                {
                    diff,
                    sql: plan.sql,
                    statements: plan.statements,
                    auditId: audit.id,
                },
                serverEnv.corsOrigin
            );
            return;
        }
        if (req.method === 'POST' && url.pathname === '/api/schema/apply') {
            const body = schemaApplyRequestSchema.parse(
                await readJsonBody(req)
            );
            const connection = await connectionStore.getResolved(
                body.connectionId
            );
            if (!connection) throw new HttpError(404, 'Connection not found.');
            canonicalSchemaSchema.parse(body.baseline);
            canonicalSchemaSchema.parse(body.target);
            const result = await applyPostgresMigrationPlan({
                config: connection,
                baseline: body.baseline,
                target: body.target,
                approval: body.approval,
            });
            const audit = await auditStore.append({
                type: 'apply',
                actor: body.actor ?? actorFallback,
                connectionId: connection.id,
                payload: {
                    baseline: body.baseline,
                    target: body.target,
                    sql: result.plan.sql,
                    status: result.status,
                    executedStatements: result.executedStatements,
                },
            });
            logger.info('schema_applied', {
                connectionId: connection.id,
                auditId: audit.id,
                status: result.status,
            });
            sendJson(
                res,
                200,
                { ...result, auditId: audit.id },
                serverEnv.corsOrigin
            );
            return;
        }
        if (req.method === 'GET' && url.pathname.startsWith('/api/audit/')) {
            const id = url.pathname.split('/').pop();
            if (!id) throw new HttpError(400, 'Audit id is required.');
            const audit = await auditStore.get(id);
            if (!audit) throw new HttpError(404, 'Audit record not found.');
            sendJson(res, 200, { audit }, serverEnv.corsOrigin);
            return;
        }
        throw new HttpError(404, 'Route not found.');
    } catch (error) {
        const statusCode = error instanceof HttpError ? error.statusCode : 500;
        const message =
            error instanceof Error ? error.message : 'Unexpected server error.';
        logger.error('api_error', {
            path: url.pathname,
            method: req.method,
            statusCode,
            message,
        });
        sendJson(
            res,
            statusCode,
            {
                error: message,
                details: error instanceof HttpError ? error.details : undefined,
            },
            serverEnv.corsOrigin
        );
    }
};
