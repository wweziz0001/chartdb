import { API_BASE_URL } from '@/lib/env';
import { getCurrentShareToken } from '@/features/persistence/share-token';

export const apiPath = (path: string) =>
    `${API_BASE_URL}${path.startsWith('/api') ? path : `/api${path}`}`;

export class RequestError extends Error {
    constructor(
        message: string,
        public readonly status: number
    ) {
        super(message);
        this.name = 'RequestError';
    }
}

export const requestJson = async <T>(
    path: string,
    init?: RequestInit
): Promise<T> => {
    const headers = new Headers(init?.headers ?? {});
    const hasBody = init?.body !== undefined && init.body !== null;

    if (
        hasBody &&
        !(init?.body instanceof FormData) &&
        !headers.has('Content-Type')
    ) {
        headers.set('Content-Type', 'application/json');
    }

    const shareToken = getCurrentShareToken();
    if (shareToken && !headers.has('x-chartdb-share-token')) {
        headers.set('x-chartdb-share-token', shareToken);
    }

    const response = await fetch(apiPath(path), {
        credentials: 'include',
        ...init,
        headers,
    });

    const text = await response.text();
    const payload = text ? (JSON.parse(text) as unknown) : {};

    if (!response.ok) {
        const error =
            typeof payload === 'object' &&
            payload &&
            'error' in payload &&
            typeof payload.error === 'string'
                ? `${payload.error}${
                      'issues' in payload &&
                      Array.isArray(payload.issues) &&
                      payload.issues.length > 0 &&
                      typeof payload.issues[0] === 'object' &&
                      payload.issues[0] &&
                      'message' in payload.issues[0] &&
                      typeof payload.issues[0].message === 'string'
                          ? ` ${payload.issues[0].message}`
                          : ''
                  }`
                : `Request to ${path} failed`;
        if (response.status === 401) {
            window.dispatchEvent(new CustomEvent('chartdb:auth-unauthorized'));
        }
        throw new RequestError(error, response.status);
    }

    return payload as T;
};
