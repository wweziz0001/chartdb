import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../context/app-context.js';
import { requireAdminUser } from '../security/request-access.js';

export const registerAdminRoutes = (
    app: FastifyInstance,
    context: AppContext
) => {
    app.get('/api/admin/overview', async (request) => {
        requireAdminUser(request);
        return context.adminService.getOverview();
    });
};
