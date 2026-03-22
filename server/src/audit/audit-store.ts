import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { serverEnv } from '../config/env.ts';

export interface AuditRecord {
    id: string;
    type: 'import' | 'diff' | 'apply';
    actor: { id: string; name: string };
    connectionId?: string;
    createdAt: string;
    payload: Record<string, unknown>;
}

const ensureDir = async () => fs.mkdir(serverEnv.auditDir, { recursive: true });

export const auditStore = {
    async append(record: Omit<AuditRecord, 'id' | 'createdAt'>) {
        await ensureDir();
        const auditRecord: AuditRecord = {
            id: randomUUID(),
            createdAt: new Date().toISOString(),
            ...record,
        };
        await fs.writeFile(
            path.join(serverEnv.auditDir, `${auditRecord.id}.json`),
            JSON.stringify(auditRecord, null, 2)
        );
        return auditRecord;
    },
    async get(id: string): Promise<AuditRecord | null> {
        try {
            const payload = await fs.readFile(
                path.join(serverEnv.auditDir, `${id}.json`),
                'utf8'
            );
            return JSON.parse(payload) as AuditRecord;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return null;
            }
            throw error;
        }
    },
};
