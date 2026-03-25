import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AppContext } from '../context/app-context.js';
import { AppError } from '../utils/app-error.js';

const requireAdmin = (request: FastifyRequest) => {
    if (!request.auth.authenticated || !request.auth.user) {
        throw new AppError('Authentication required.', 401, 'AUTH_REQUIRED');
    }

    if (request.auth.user.role !== 'admin') {
        throw new AppError(
            'Administrator access required.',
            403,
            'AUTH_FORBIDDEN'
        );
    }
};

export const registerAdminRoutes = (
    app: FastifyInstance,
    context: AppContext
) => {
    app.get('/api/admin/overview', async (request) => {
        requireAdmin(request);
        return context.adminService.getOverview();
    });
};
