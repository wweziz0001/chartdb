import { API_BASE_URL } from '@/lib/env';

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
    const response = await fetch(apiPath(path), {
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...(init?.headers ?? {}),
        },
        ...init,
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
