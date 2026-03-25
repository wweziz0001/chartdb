import type { FastifyServerOptions } from 'fastify';
import type { ServerEnv } from './env.js';

export const buildLoggerOptions = (
    env: Pick<ServerEnv, 'logLevel' | 'nodeEnv'>
): FastifyServerOptions['logger'] => ({
    level: env.logLevel,
    messageKey: 'message',
    timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
    base: {
        service: 'chartdb-api',
        env: env.nodeEnv,
    },
    formatters: {
        level: (label) => ({ level: label }),
    },
    redact: [
        'req.headers.cookie',
        'req.headers.authorization',
        'req.body.connection.secret',
        'req.body.connection.secret.password',
        'req.body.password',
        'req.body.setupCode',
        'req.body.secret',
        'req.body.clientSecret',
        'res.headers.set-cookie',
        'password',
        'setupCode',
        'secret',
    ],
    serializers: {
        req: (request) => ({
            id: request.id,
            method: request.method,
            url: request.url,
            hostname: request.hostname,
            remoteAddress: request.ip,
            remotePort: request.socket.remotePort,
        }),
        res: (reply) => ({
            statusCode: reply.statusCode,
        }),
        err: (error) => ({
            type: error.name,
            message: error.message,
            stack: error.stack ?? '',
        }),
    },
});
