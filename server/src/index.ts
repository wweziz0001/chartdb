import { buildApp } from './app.js';
import { serverEnv } from './config/env.js';

const app = buildApp();

for (const warning of serverEnv.runtimeWarnings ?? []) {
    app.log.warn(
        {
            event: 'config.warning',
        },
        warning
    );
}

app.log.info(
    {
        host: serverEnv.host,
        port: serverEnv.port,
        appDbPath: serverEnv.appDbPath,
        metadataDbPath: serverEnv.metadataDbPath,
        trustProxy: serverEnv.trustProxy ?? false,
    },
    'Starting ChartDB API'
);

app.listen({ host: serverEnv.host, port: serverEnv.port }).catch((error) => {
    app.log.error(error);
    process.exit(1);
});
