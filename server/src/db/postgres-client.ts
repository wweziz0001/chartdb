/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import crypto from 'node:crypto';
import net from 'node:net';
import tls from 'node:tls';
import { HttpError } from '../utils/http';

export interface PgConnectionConfig {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    ssl?: {
        enabled?: boolean;
        rejectUnauthorized?: boolean;
    };
}

interface QueryResultRow {
    [key: string]: string | null;
}

interface BackendMessage {
    type: string;
    payload: Buffer;
}

const int32 = (value: number) => {
    const buffer = Buffer.alloc(4);
    buffer.writeInt32BE(value, 0);
    return buffer;
};

const cstring = (value: string) => Buffer.from(`${value}\0`, 'utf8');

const buildStartupMessage = (config: PgConnectionConfig) => {
    const params = Buffer.concat([
        cstring('user'),
        cstring(config.username),
        cstring('database'),
        cstring(config.database),
        cstring('client_encoding'),
        cstring('UTF8'),
        Buffer.from([0]),
    ]);
    return Buffer.concat([int32(params.length + 8), int32(196608), params]);
};

const buildPasswordMessage = (password: string) => {
    const payload = cstring(password);
    return Buffer.concat([
        Buffer.from('p'),
        int32(payload.length + 4),
        payload,
    ]);
};

const buildQueryMessage = (sql: string) => {
    const payload = cstring(sql);
    return Buffer.concat([
        Buffer.from('Q'),
        int32(payload.length + 4),
        payload,
    ]);
};

const buildTerminateMessage = () => Buffer.concat([Buffer.from('X'), int32(4)]);

const normalizePassword = (password: string) => password.normalize('NFKC');

const xorBuffers = (left: Buffer, right: Buffer) => {
    const output = Buffer.alloc(left.length);
    for (let index = 0; index < left.length; index += 1) {
        output[index] = left[index] ^ right[index];
    }
    return output;
};

const hi = (password: string, salt: Buffer, iterations: number) =>
    crypto.pbkdf2Sync(
        normalizePassword(password),
        salt,
        iterations,
        32,
        'sha256'
    );

const hmac = (key: Buffer, data: string | Buffer) =>
    crypto.createHmac('sha256', key).update(data).digest();

const hash = (value: Buffer) =>
    crypto.createHash('sha256').update(value).digest();

const randomNonce = () => crypto.randomBytes(18).toString('base64');

const parseScramFields = (message: string) =>
    Object.fromEntries(
        message.split(',').map((part) => {
            const [key, ...rest] = part.split('=');
            return [key, rest.join('=')];
        })
    );

class BufferReader {
    private buffer = Buffer.alloc(0);

    push(chunk: Buffer) {
        this.buffer = Buffer.concat([this.buffer, chunk]);
    }

    tryReadMessage(): BackendMessage | null {
        if (this.buffer.length < 5) return null;
        const type = this.buffer.toString('utf8', 0, 1);
        const length = this.buffer.readInt32BE(1);
        const totalLength = 1 + length;
        if (this.buffer.length < totalLength) return null;
        const payload = this.buffer.subarray(5, totalLength);
        this.buffer = this.buffer.subarray(totalLength);
        return { type, payload };
    }
}

export class PostgresClient {
    private socket: net.Socket | tls.TLSSocket | null = null;
    private reader = new BufferReader();
    private rowDescription: string[] = [];

    constructor(private readonly config: PgConnectionConfig) {}

    private async connectSocket(): Promise<net.Socket | tls.TLSSocket> {
        const socket = this.config.ssl?.enabled
            ? tls.connect({
                  host: this.config.host,
                  port: this.config.port,
                  rejectUnauthorized:
                      this.config.ssl.rejectUnauthorized ?? true,
              })
            : net.connect({ host: this.config.host, port: this.config.port });

        return await new Promise((resolve, reject) => {
            socket.once('error', reject);
            socket.once('connect', () => {
                socket.removeListener('error', reject);
                resolve(socket);
            });
        });
    }

    private async waitForMessage(): Promise<BackendMessage> {
        const existing = this.reader.tryReadMessage();
        if (existing) return existing;

        const socket = this.socket;
        if (!socket)
            throw new HttpError(500, 'PostgreSQL socket is not initialized.');

        return await new Promise((resolve, reject) => {
            const onData = (chunk: Buffer) => {
                this.reader.push(chunk);
                const message = this.reader.tryReadMessage();
                if (message) {
                    cleanup();
                    resolve(message);
                }
            };
            const onError = (error: Error) => {
                cleanup();
                reject(error);
            };
            const onClose = () => {
                cleanup();
                reject(
                    new Error('Connection closed before response was received.')
                );
            };
            const cleanup = () => {
                socket.off('data', onData);
                socket.off('error', onError);
                socket.off('close', onClose);
            };
            socket.on('data', onData);
            socket.on('error', onError);
            socket.on('close', onClose);
        });
    }

    private async authenticate() {
        while (true) {
            const message = await this.waitForMessage();
            if (message.type === 'R') {
                const authType = message.payload.readInt32BE(0);
                if (authType === 0) {
                    continue;
                }
                if (authType === 3) {
                    this.socket?.write(
                        buildPasswordMessage(this.config.password)
                    );
                    continue;
                }
                if (authType === 5) {
                    const salt = message.payload.subarray(4, 8);
                    const inner = crypto
                        .createHash('md5')
                        .update(this.config.password + this.config.username)
                        .digest('hex');
                    const password =
                        'md5' +
                        crypto
                            .createHash('md5')
                            .update(Buffer.concat([Buffer.from(inner), salt]))
                            .digest('hex');
                    this.socket?.write(buildPasswordMessage(password));
                    continue;
                }
                if (authType === 10) {
                    await this.performScramSha256();
                    continue;
                }
                throw new HttpError(
                    400,
                    `Unsupported PostgreSQL authentication method: ${authType}`
                );
            }
            if (message.type === 'E') {
                throw this.parseError(message.payload);
            }
            if (message.type === 'Z') {
                return;
            }
        }
    }

    private async performScramSha256() {
        const clientNonce = randomNonce();
        const clientFirstBare = `n=${this.config.username},r=${clientNonce}`;
        const clientFirst = `n,,${clientFirstBare}`;
        const mechanisms = Buffer.concat([
            cstring('SCRAM-SHA-256'),
            int32(Buffer.byteLength(clientFirst, 'utf8')),
            Buffer.from(clientFirst, 'utf8'),
        ]);
        this.socket?.write(
            Buffer.concat([
                Buffer.from('p'),
                int32(mechanisms.length + 4),
                mechanisms,
            ])
        );

        const continueMessage = await this.waitForMessage();
        if (
            continueMessage.type !== 'R' ||
            continueMessage.payload.readInt32BE(0) !== 11
        ) {
            throw new HttpError(
                400,
                'Unexpected SCRAM continuation from PostgreSQL server.'
            );
        }

        const serverFirst = continueMessage.payload
            .subarray(4)
            .toString('utf8');
        const fields = parseScramFields(serverFirst);
        const salt = Buffer.from(fields.s, 'base64');
        const iterations = Number(fields.i);
        const combinedNonce = fields.r;

        const clientFinalWithoutProof = `c=biws,r=${combinedNonce}`;
        const authMessage = `${clientFirstBare},${serverFirst},${clientFinalWithoutProof}`;
        const saltedPassword = hi(this.config.password, salt, iterations);
        const clientKey = hmac(saltedPassword, 'Client Key');
        const storedKey = hash(clientKey);
        const clientSignature = hmac(storedKey, authMessage);
        const clientProof = xorBuffers(clientKey, clientSignature).toString(
            'base64'
        );
        const clientFinal = `${clientFinalWithoutProof},p=${clientProof}`;
        const payload = Buffer.concat([
            cstring(''),
            Buffer.from(clientFinal, 'utf8'),
        ]);
        this.socket?.write(
            Buffer.concat([
                Buffer.from('p'),
                int32(payload.length + 4),
                payload,
            ])
        );

        const finalMessage = await this.waitForMessage();
        if (finalMessage.type === 'E') {
            throw this.parseError(finalMessage.payload);
        }
        if (
            finalMessage.type !== 'R' ||
            finalMessage.payload.readInt32BE(0) !== 12
        ) {
            throw new HttpError(
                400,
                'Unexpected SCRAM final message from PostgreSQL server.'
            );
        }
    }

    private parseError(payload: Buffer) {
        const chunks = payload.toString('utf8').split('\u0000').filter(Boolean);
        const errorMap = Object.fromEntries(
            chunks.map((entry) => [entry[0], entry.slice(1)])
        );
        return new HttpError(
            400,
            errorMap.M ?? 'PostgreSQL request failed.',
            errorMap
        );
    }

    async connect() {
        this.socket = await this.connectSocket();
        this.socket.write(buildStartupMessage(this.config));
        await this.authenticate();
    }

    async query(sql: string): Promise<QueryResultRow[]> {
        if (!this.socket) {
            await this.connect();
        }
        this.rowDescription = [];
        this.socket?.write(buildQueryMessage(sql));

        const rows: QueryResultRow[] = [];
        while (true) {
            const message = await this.waitForMessage();
            if (message.type === 'T') {
                const fieldCount = message.payload.readInt16BE(0);
                let offset = 2;
                this.rowDescription = [];
                for (let index = 0; index < fieldCount; index += 1) {
                    const zeroIndex = message.payload.indexOf(0, offset);
                    this.rowDescription.push(
                        message.payload.toString('utf8', offset, zeroIndex)
                    );
                    offset = zeroIndex + 19;
                }
                continue;
            }
            if (message.type === 'D') {
                const columnCount = message.payload.readInt16BE(0);
                let offset = 2;
                const row: QueryResultRow = {};
                for (let index = 0; index < columnCount; index += 1) {
                    const size = message.payload.readInt32BE(offset);
                    offset += 4;
                    if (size === -1) {
                        row[this.rowDescription[index]] = null;
                    } else {
                        row[this.rowDescription[index]] =
                            message.payload.toString(
                                'utf8',
                                offset,
                                offset + size
                            );
                        offset += size;
                    }
                }
                rows.push(row);
                continue;
            }
            if (
                message.type === 'C' ||
                message.type === 'I' ||
                message.type === 'N' ||
                message.type === 'S' ||
                message.type === 'K'
            ) {
                continue;
            }
            if (message.type === 'E') {
                throw this.parseError(message.payload);
            }
            if (message.type === 'Z') {
                return rows;
            }
        }
    }

    async close() {
        if (!this.socket) return;
        this.socket.write(buildTerminateMessage());
        this.socket.end();
        this.socket = null;
    }
}

export const withPostgresClient = async <T>(
    config: PgConnectionConfig,
    callback: (client: PostgresClient) => Promise<T>
) => {
    const client = new PostgresClient(config);
    try {
        await client.connect();
        return await callback(client);
    } finally {
        await client.close();
    }
};
