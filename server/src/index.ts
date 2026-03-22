import { buildApp } from './app.js';
import { serverEnv } from './config/env.js';

const start = async () => {
    const app = buildApp();

    try {
        await app.listen({ host: serverEnv.host, port: serverEnv.port });
        app.log.info(
            {
                host: serverEnv.host,
                port: serverEnv.port,
                dataDir: serverEnv.dataDir,
                logLevel: serverEnv.logLevel,
            },
            'ChartDB API listening'
        );
    } catch (error) {
        app.log.error(error);
        process.exit(1);
    }
};

void start();
