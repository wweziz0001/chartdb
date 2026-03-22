import type { Diagram } from '@/lib/domain/diagram';
import { API_BASE_URL, ENABLE_SERVER_PERSISTENCE } from '@/lib/env';

export interface RemoteDiagram extends Diagram {
    projectId: string;
    ownerUserId: string;
    visibility: string;
    status: string;
    version: number;
    checksum: string;
}

export interface RemoteProject {
    id: string;
    ownerUserId: string;
    slug: string;
    name: string;
    description: string | null;
    visibility: string;
    status: string;
    primaryDiagramId: string | null;
    createdAt: string;
    updatedAt: string;
}

class ApiClientError extends Error {
    constructor(
        message: string,
        readonly statusCode: number
    ) {
        super(message);
        this.name = 'ApiClientError';
    }
}

const apiPath = (path: string) =>
    `${API_BASE_URL}${path.startsWith('/api') ? path : `/api${path}`}`;

const buildQuery = (params: Record<string, unknown>) => {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null) {
            return;
        }

        query.set(key, String(value));
    });

    const serialized = query.toString();
    return serialized.length > 0 ? `?${serialized}` : '';
};

const reviveIsoDates = <T>(value: T): T => {
    if (Array.isArray(value)) {
        return value.map((item) => reviveIsoDates(item)) as T;
    }

    if (value instanceof Date) {
        return value;
    }

    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [
                key,
                reviveIsoDates(item),
            ])
        ) as T;
    }

    if (
        typeof value === 'string' &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
    ) {
        return new Date(value) as T;
    }

    return value;
};

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(apiPath(path), {
        headers: {
            'Content-Type': 'application/json',
            ...(init?.headers ?? {}),
        },
        ...init,
    });

    const text = await response.text();
    const payload = text ? (JSON.parse(text) as unknown) : {};

    if (!response.ok) {
        const message =
            typeof payload === 'object' &&
            payload &&
            'error' in payload &&
            typeof payload.error === 'string'
                ? payload.error
                : `Request to ${path} failed`;
        throw new ApiClientError(message, response.status);
    }

    return payload as T;
};

const toRemoteDiagram = (payload: unknown) =>
    reviveIsoDates(payload) as RemoteDiagram;

let availabilityPromise: Promise<boolean> | null = null;

export const appPersistenceClient = {
    isEnabled: ENABLE_SERVER_PERSISTENCE,
    isAvailable: async () => {
        if (!ENABLE_SERVER_PERSISTENCE) {
            return false;
        }

        if (!availabilityPromise) {
            availabilityPromise = request('/api/app/health')
                .then(() => true)
                .catch(() => false);
        }

        return await availabilityPromise;
    },
    getCurrentUser: async () =>
        request<{ user: { id: string; email: string; displayName: string } }>(
            '/api/app/me'
        ),
    listProjects: async (query?: string) =>
        request<{ items: RemoteProject[] }>(
            `/api/app/projects${buildQuery({ q: query })}`
        ),
    listDiagrams: async (options: Record<string, unknown> = {}) => {
        const response = await request<{ items: RemoteDiagram[] }>(
            `/api/app/diagrams${buildQuery(options)}`
        );

        return {
            items: response.items.map((diagram) => toRemoteDiagram(diagram)),
        };
    },
    getDiagram: async (id: string, options: Record<string, unknown> = {}) => {
        const response = await request<{
            project: RemoteProject;
            diagram: RemoteDiagram;
        }>(`/api/app/diagrams/${id}${buildQuery(options)}`);

        return {
            project: response.project,
            diagram: toRemoteDiagram(response.diagram),
        };
    },
    upsertDiagram: async (diagram: Diagram) => {
        const response = await request<{
            project: RemoteProject;
            diagram: RemoteDiagram;
        }>(`/api/app/diagrams/${diagram.id}`, {
            method: 'PUT',
            body: JSON.stringify({ diagram }),
        });

        return {
            project: response.project,
            diagram: toRemoteDiagram(response.diagram),
        };
    },
    deleteDiagram: async (id: string) =>
        request<{ ok: boolean }>(`/api/app/diagrams/${id}`, {
            method: 'DELETE',
        }),
    search: async (query: string) =>
        request<{
            items: Array<{
                type: 'project' | 'diagram';
                id: string;
                projectId: string | null;
                name: string;
                visibility: string;
                status: string;
                updatedAt: string;
            }>;
        }>(`/api/app/search${buildQuery({ q: query })}`),
    isNotFoundError: (error: unknown) =>
        error instanceof ApiClientError && error.statusCode === 404,
};
