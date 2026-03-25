import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestJson } from './request';

describe('requestJson', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('does not send an application/json content-type for delete requests without a body', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            text: async () => JSON.stringify({ ok: true }),
        });
        vi.stubGlobal('fetch', fetchMock);

        await requestJson<{ ok: boolean }>('/test-delete', {
            method: 'DELETE',
        });

        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining('/api/test-delete'),
            expect.objectContaining({
                method: 'DELETE',
                credentials: 'include',
                headers: expect.any(Headers),
            })
        );

        const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        const headers = init.headers as Headers;
        expect(headers.has('Content-Type')).toBe(false);
    });

    it('still sends application/json when a request body is present', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            text: async () => JSON.stringify({ ok: true }),
        });
        vi.stubGlobal('fetch', fetchMock);

        await requestJson<{ ok: boolean }>('/test-post', {
            method: 'POST',
            body: JSON.stringify({ hello: 'world' }),
        });

        const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        const headers = init.headers as Headers;
        expect(headers.get('Content-Type')).toBe('application/json');
    });
});
