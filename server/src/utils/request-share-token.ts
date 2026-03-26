import type { FastifyRequest } from 'fastify';

export const SHARE_TOKEN_HEADER = 'x-chartdb-share-token';

const readShareToken = (value: string | string[] | undefined) => {
    const token = Array.isArray(value) ? value[0] : value;
    const normalized = token?.trim();
    return normalized ? normalized : null;
};

export const resolveRequestShareToken = (request: FastifyRequest) => {
    const fromHeader = readShareToken(request.headers[SHARE_TOKEN_HEADER]);
    if (fromHeader) {
        return fromHeader;
    }

    const query = request.query as { shareToken?: string | string[] } | undefined;
    return readShareToken(query?.shareToken);
};

export const isShareTokenApiRoute = (
    request: Pick<FastifyRequest, 'method' | 'url'>
) => {
    const requestPath = request.url.split('?')[0];
    const pathSegments = requestPath.split('/').filter(Boolean);

    if (pathSegments[0] !== 'api' || pathSegments[1] !== 'diagrams') {
        return false;
    }

    const [, , diagramId, resource, resourceId, subresource] = pathSegments;
    if (!diagramId) {
        return false;
    }

    if (!resource) {
        return ['GET', 'PATCH', 'PUT'].includes(request.method);
    }

    if (resource === 'events') {
        return request.method === 'GET';
    }

    if (resource !== 'sessions') {
        return false;
    }

    if (!resourceId) {
        return request.method === 'POST';
    }

    if (!subresource) {
        return ['GET', 'PATCH'].includes(request.method);
    }

    return subresource === 'presence' && request.method === 'PATCH';
};
