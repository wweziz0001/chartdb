/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { serverEnv } from '../config/env.ts';
import type {
    PostgresConnectionInput,
    StoredConnectionMetadata,
} from '../../../shared/schema-sync/validation.ts';

interface StoredConnectionRecord extends StoredConnectionMetadata {
    encryptedPassword: string;
}

const ensureParentDirectory = async (filePath: string) => {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
};

const deriveKey = () =>
    crypto.createHash('sha256').update(serverEnv.encryptionKey).digest();

const encrypt = (value: string) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(), iv);
    const encrypted = Buffer.concat([
        cipher.update(value, 'utf8'),
        cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
};

const decrypt = (value: string) => {
    const raw = Buffer.from(value, 'base64');
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const encrypted = raw.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
    ]).toString('utf8');
};

const readStore = async (): Promise<StoredConnectionRecord[]> => {
    try {
        const payload = await fs.readFile(
            serverEnv.connectionStorePath,
            'utf8'
        );
        return JSON.parse(payload) as StoredConnectionRecord[];
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return [];
        }
        throw error;
    }
};

const writeStore = async (records: StoredConnectionRecord[]) => {
    await ensureParentDirectory(serverEnv.connectionStorePath);
    await fs.writeFile(
        serverEnv.connectionStorePath,
        JSON.stringify(records, null, 2)
    );
};

export const connectionStore = {
    async list(): Promise<StoredConnectionMetadata[]> {
        const records = await readStore();
        return records.map((record) => ({
            id: record.id,
            engine: record.engine,
            name: record.name,
            host: record.host,
            port: record.port,
            database: record.database,
            username: record.username,
            ssl: record.ssl,
            schemaNames: record.schemaNames,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            hasPassword: record.hasPassword,
        }));
    },
    async save(
        connection: PostgresConnectionInput
    ): Promise<StoredConnectionMetadata> {
        const records = await readStore();
        const now = new Date().toISOString();
        const existingIndex = records.findIndex(
            (record) => record.name === connection.name
        );
        const metadata: StoredConnectionMetadata = {
            id: existingIndex >= 0 ? records[existingIndex].id : randomUUID(),
            engine: 'postgresql',
            name: connection.name,
            host: connection.host,
            port: connection.port,
            database: connection.database,
            username: connection.username,
            ssl: connection.ssl,
            schemaNames: connection.schemaNames,
            createdAt:
                existingIndex >= 0 ? records[existingIndex].createdAt : now,
            updatedAt: now,
            hasPassword: true,
        };
        const record: StoredConnectionRecord = {
            ...metadata,
            encryptedPassword: encrypt(connection.password),
        };
        if (existingIndex >= 0) {
            records[existingIndex] = record;
        } else {
            records.push(record);
        }
        await writeStore(records);
        return metadata;
    },
    async delete(id: string): Promise<void> {
        const records = await readStore();
        await writeStore(records.filter((record) => record.id !== id));
    },
    async getResolved(id: string) {
        const records = await readStore();
        const record = records.find((item) => item.id === id);
        if (!record) {
            return null;
        }
        const { encryptedPassword, ...metadata } = record;
        return {
            ...metadata,
            password: decrypt(encryptedPassword),
        };
    },
};
