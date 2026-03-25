import type { FastifyRequest } from 'fastify';
import { AppError } from '../utils/app-error.js';

export const requireAuthenticatedUser = (request: FastifyRequest) => {
    if (!request.auth.authenticated || !request.auth.user) {
        throw new AppError('Authentication required.', 401, 'AUTH_REQUIRED');
    }

    return request.auth.user;
};

export const requireAdminUser = (request: FastifyRequest) => {
    const user = requireAuthenticatedUser(request);

    if (user.role !== 'admin') {
        throw new AppError(
            'Administrator access required.',
            403,
            'AUTH_FORBIDDEN'
        );
    }

    return user;
};

export const requireOperationalAccess = (request: FastifyRequest) => {
    if (request.auth.mode === 'disabled') {
        return request.auth.user;
    }

    return requireAdminUser(request);
};

export const resolveRequestActor = (request: FastifyRequest) => {
    const user = request.auth.user;
    if (!user) {
        return request.auth.mode === 'disabled'
            ? 'local-owner'
            : 'anonymous-user';
    }

    const identity = user.email ?? user.displayName ?? user.id;
    return `${user.role}:${identity}`;
};
