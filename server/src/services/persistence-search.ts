import type {
    CollectionRecord,
    DiagramRecord,
    ProjectRecord,
} from '../repositories/app-repository.js';

const TABLE_SEARCH_KEYS = [
    'name',
    'tableName',
    'table_name',
    'schema',
    'schemaName',
    'schema_name',
    'fullName',
    'full_name',
] as const;

const normalizeSearchValue = (value: string | null | undefined) =>
    value?.trim().toLowerCase() ?? '';

const includesSearch = (
    values: Array<string | null | undefined>,
    searchTerm?: string
) => {
    if (!searchTerm) {
        return true;
    }

    return values.some((value) =>
        normalizeSearchValue(value).includes(searchTerm)
    );
};

const getTableSearchValues = (diagram: DiagramRecord): string[] => {
    if (!Array.isArray(diagram.document.tables)) {
        return [];
    }

    return diagram.document.tables.flatMap((table) => {
        if (!table || typeof table !== 'object' || Array.isArray(table)) {
            return [];
        }

        const record = table as Record<string, unknown>;
        return TABLE_SEARCH_KEYS.map((key) =>
            typeof record[key] === 'string' ? String(record[key]) : undefined
        ).filter((value): value is string => Boolean(value));
    });
};

export const normalizeSearchTerm = (value?: string) => {
    const normalized = normalizeSearchValue(value);
    return normalized.length > 0 ? normalized : undefined;
};

export const matchesProjectMetadataSearch = (
    project: ProjectRecord,
    collection: CollectionRecord | undefined,
    searchTerm?: string
) =>
    includesSearch(
        [
            project.name,
            project.description,
            collection?.name,
            collection?.description,
            project.visibility,
            project.status,
        ],
        searchTerm
    );

export const matchesDiagramSearch = (
    diagram: DiagramRecord,
    searchTerm?: string
) =>
    includesSearch(
        [
            diagram.name,
            diagram.description,
            diagram.databaseType,
            diagram.databaseEdition,
            diagram.visibility,
            diagram.status,
            ...getTableSearchValues(diagram),
        ],
        searchTerm
    );

export const matchesProjectSearch = (
    project: ProjectRecord,
    options: {
        collection?: CollectionRecord;
        diagrams?: DiagramRecord[];
        searchTerm?: string;
    }
) => {
    if (!options.searchTerm) {
        return true;
    }

    if (
        matchesProjectMetadataSearch(
            project,
            options.collection,
            options.searchTerm
        )
    ) {
        return true;
    }

    return (options.diagrams ?? []).some((diagram) =>
        matchesDiagramSearch(diagram, options.searchTerm)
    );
};
