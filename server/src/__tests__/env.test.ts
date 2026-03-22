import { describe, expect, it } from 'vitest';
import { resolveServerEnv } from '../config/env.js';

describe('resolveServerEnv', () => {
    it('uses a local development secret outside production', () => {
        const env = resolveServerEnv({
            NODE_ENV: 'test',
        });

        expect(env.port).toBe(4010);
        expect(env.defaultUser.id).toBe('local-admin');
        expect(env.metadataDbPath.endsWith('chartdb.sqlite')).toBe(true);
    });

    it('requires a secret key in production', () => {
        expect(() =>
            resolveServerEnv({
                NODE_ENV: 'production',
            })
        ).toThrow(/CHARTDB_SECRET_KEY/);
    });
});
