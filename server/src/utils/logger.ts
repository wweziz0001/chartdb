export const logger = {
    info(event: string, details: Record<string, unknown> = {}) {
        console.log(
            JSON.stringify({
                level: 'info',
                event,
                ...details,
                ts: new Date().toISOString(),
            })
        );
    },
    error(event: string, details: Record<string, unknown> = {}) {
        console.error(
            JSON.stringify({
                level: 'error',
                event,
                ...details,
                ts: new Date().toISOString(),
            })
        );
    },
};
