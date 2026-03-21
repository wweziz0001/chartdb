import http from 'node:http';
import { requestHandler } from './api/router';
import { serverEnv } from './config/env';
import { logger } from './utils/logger';

const server = http.createServer((req, res) => {
    void requestHandler(req, res);
});

server.listen(serverEnv.port, serverEnv.host, () => {
    logger.info('server_started', {
        host: serverEnv.host,
        port: serverEnv.port,
    });
});
