import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../context/app-context.js';

export const registerAuthRoutes = (
    app: FastifyInstance,
    context: AppContext
) => {
    app.get('/api/auth/session', async (request) => {
        const session = context.authService.getSessionState(request);

        return {
            mode: session.mode,
            enabled: session.mode !== 'disabled',
            authenticated: session.authenticated,
            user: session.user,
            logoutUrl: session.logoutUrl,
            bootstrap: session.bootstrap,
        };
    });

    app.post('/api/auth/bootstrap', async (request, reply) => {
        reply.code(201);
        return context.authService.bootstrap(request, reply, request.body);
    });

    app.post('/api/auth/login', async (request, reply) => {
        return context.authService.login(request, reply, request.body);
    });

    app.post('/api/auth/logout', async (request, reply) => {
        return context.authService.logout(request, reply);
    });

    app.get('/api/auth/oidc/start', async (request, reply) => {
        const query = request.query as { returnTo?: unknown };
        return context.authService.startOidcLogin(request, reply, query);
    });

    app.get('/api/auth/oidc/callback', async (request, reply) => {
        return context.authService.handleOidcCallback(request, reply);
    });
};
