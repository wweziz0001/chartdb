import { useContext } from 'react';
import { schemaSyncContext } from './schema-sync-context';

export const useSchemaSync = () => {
    const context = useContext(schemaSyncContext);
    if (!context) {
        throw new Error(
            'useSchemaSync must be used inside SchemaSyncProvider.'
        );
    }
    return context;
};
