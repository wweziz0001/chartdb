import { createContext } from 'react';
import type { Diagram } from '@/lib/domain/diagram';
import { emptyFn } from '@/lib/utils';
import type { DBRelationship } from '@/lib/domain/db-relationship';
import type { DBTable } from '@/lib/domain/db-table';
import type { ChartDBConfig } from '@/lib/domain/config';
import type { DBDependency } from '@/lib/domain/db-dependency';
import type { Area } from '@/lib/domain/area';
import type { DBCustomType } from '@/lib/domain/db-custom-type';
import type { DiagramFilter } from '@/lib/domain/diagram-filter/diagram-filter';
import type { Note } from '@/lib/domain/note';
import type {
    ChartDbBackupArchive,
    ExportBackupRequest,
    ImportBackupResult,
} from '@/lib/project-backup/project-backup-format';
import type {
    PersistedDiagramCollaborationState,
    PersistedDiagramEditSession,
    PersistedSharingSettings,
    PersistedUserSummary,
    ResourceAccess,
    SharingAccess,
    SharingScope,
} from '@/features/persistence/api/persistence-client';

export interface SavedCollection {
    id: string;
    name: string;
    description: string | null;
    ownerUserId: string | null;
    projectCount: number;
    diagramCount: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface SavedProject {
    id: string;
    name: string;
    description: string | null;
    collectionId: string | null;
    ownerUserId: string | null;
    visibility: 'private' | 'workspace' | 'public';
    status: 'active' | 'archived' | 'deleted';
    sharingScope: SharingScope;
    sharingAccess: SharingAccess;
    access: ResourceAccess;
    diagramCount: number;
    createdAt: Date;
    updatedAt: Date;
    localOnly?: boolean;
}

export interface SavedDiagram {
    id: string;
    projectId: string;
    ownerUserId: string | null;
    name: string;
    description: string | null;
    databaseType: string;
    databaseEdition: string | null;
    visibility: 'private' | 'workspace' | 'public';
    status: 'draft' | 'active' | 'archived';
    sharingScope: SharingScope;
    sharingAccess: SharingAccess;
    access: ResourceAccess;
    tableCount: number;
    collaboration?: PersistedDiagramCollaborationState;
    createdAt: Date;
    updatedAt: Date;
    localOnly?: boolean;
}

export interface DiagramSessionState {
    session: PersistedDiagramEditSession;
    collaboration: PersistedDiagramCollaborationState;
}

export interface StorageContext {
    // Config operations
    getConfig: () => Promise<ChartDBConfig | undefined>;
    updateConfig: (config: Partial<ChartDBConfig>) => Promise<void>;

    // Saved project operations
    listCollections: () => Promise<SavedCollection[]>;
    createCollection: (params: {
        name: string;
        description?: string | null;
    }) => Promise<SavedCollection>;
    updateCollection: (
        collectionId: string,
        params: { name?: string; description?: string | null }
    ) => Promise<SavedCollection>;
    deleteCollection: (collectionId: string) => Promise<void>;
    listProjects: (options?: {
        search?: string;
        collectionId?: string;
        unassigned?: boolean;
    }) => Promise<SavedProject[]>;
    createProject: (params: {
        name: string;
        description?: string | null;
        collectionId?: string | null;
    }) => Promise<SavedProject>;
    updateProject: (
        projectId: string,
        params: {
            name?: string;
            description?: string | null;
            collectionId?: string | null;
        }
    ) => Promise<SavedProject>;
    getProjectSharing: (projectId: string) => Promise<PersistedSharingSettings>;
    updateProjectSharing: (
        projectId: string,
        params: {
            scope: SharingScope;
            access: SharingAccess;
            expiresAt?: string | null;
            rotateLinkToken?: boolean;
        }
    ) => Promise<PersistedSharingSettings>;
    searchShareableUsers: (query: string) => Promise<PersistedUserSummary[]>;
    addProjectSharingUser: (
        projectId: string,
        params: {
            userId: string;
            access: SharingAccess;
        }
    ) => Promise<PersistedSharingSettings>;
    updateProjectSharingUser: (
        projectId: string,
        userId: string,
        params: {
            access: SharingAccess;
        }
    ) => Promise<PersistedSharingSettings>;
    removeProjectSharingUser: (
        projectId: string,
        userId: string
    ) => Promise<PersistedSharingSettings>;
    deleteProject: (projectId: string) => Promise<void>;
    listProjectDiagrams: (
        projectId: string,
        options?: {
            search?: string;
        }
    ) => Promise<SavedDiagram[]>;
    getSavedDiagram: (diagramId: string) => Promise<SavedDiagram | undefined>;
    updateSavedDiagram: (
        diagramId: string,
        params: {
            name?: string;
            description?: string | null;
            projectId?: string;
        }
    ) => Promise<SavedDiagram | undefined>;
    getDiagramSharing: (diagramId: string) => Promise<PersistedSharingSettings>;
    updateDiagramSharing: (
        diagramId: string,
        params: {
            scope: SharingScope;
            access: SharingAccess;
            expiresAt?: string | null;
            rotateLinkToken?: boolean;
        }
    ) => Promise<PersistedSharingSettings>;
    addDiagramSharingUser: (
        diagramId: string,
        params: {
            userId: string;
            access: SharingAccess;
        }
    ) => Promise<PersistedSharingSettings>;
    updateDiagramSharingUser: (
        diagramId: string,
        userId: string,
        params: {
            access: SharingAccess;
        }
    ) => Promise<PersistedSharingSettings>;
    removeDiagramSharingUser: (
        diagramId: string,
        userId: string
    ) => Promise<PersistedSharingSettings>;
    saveDiagram: (params: {
        diagramId: string;
        name?: string;
        description?: string | null;
        projectId?: string;
        sessionId?: string;
        baseVersion?: number;
    }) => Promise<SavedDiagram | undefined>;
    activateDiagramSession: (params: {
        diagramId: string;
        mode?: 'view' | 'edit';
    }) => Promise<DiagramSessionState | undefined>;
    getDiagramSessionState: (
        diagramId: string
    ) => Promise<DiagramSessionState | undefined>;
    subscribeToDiagramSessionState: (
        diagramId: string,
        listener: (state: DiagramSessionState | undefined) => void
    ) => () => void;
    updateDiagramSessionAwareness: (
        diagramId: string,
        collaboration: PersistedDiagramCollaborationState
    ) => DiagramSessionState | undefined;
    updateDiagramSessionPresence: (params: {
        diagramId: string;
        sessionId: string;
        cursor?: {
            x: number;
            y: number;
        } | null;
    }) => Promise<DiagramSessionState | undefined>;
    hasPendingDiagramSync: (diagramId: string) => boolean;
    heartbeatDiagramSession: (params: {
        diagramId: string;
        sessionId: string;
        status?: 'active' | 'idle' | 'stale' | 'closed';
        lastSeenDocumentVersion?: number;
        close?: boolean;
    }) => Promise<DiagramSessionState | undefined>;
    releaseDiagramSession: (diagramId: string) => Promise<void>;
    saveDiagramAs: (params: {
        diagramId: string;
        name: string;
        description?: string | null;
        projectId?: string;
        createProject?: {
            name: string;
            description?: string | null;
            collectionId?: string | null;
        };
    }) => Promise<Diagram | undefined>;
    exportBackup: (
        request: ExportBackupRequest
    ) => Promise<ChartDbBackupArchive>;
    importBackup: (
        archive: ChartDbBackupArchive
    ) => Promise<ImportBackupResult>;

    // Diagram filter operations
    getDiagramFilter: (diagramId: string) => Promise<DiagramFilter | undefined>;
    updateDiagramFilter: (
        diagramId: string,
        filter: DiagramFilter
    ) => Promise<void>;
    deleteDiagramFilter: (diagramId: string) => Promise<void>;

    // Diagram operations
    addDiagram: (params: { diagram: Diagram }) => Promise<void>;
    listDiagrams: (options?: {
        includeTables?: boolean;
        includeRelationships?: boolean;
        includeDependencies?: boolean;
        includeAreas?: boolean;
        includeCustomTypes?: boolean;
        includeNotes?: boolean;
    }) => Promise<Diagram[]>;
    getDiagram: (
        id: string,
        options?: {
            includeTables?: boolean;
            includeRelationships?: boolean;
            includeDependencies?: boolean;
            includeAreas?: boolean;
            includeCustomTypes?: boolean;
            includeNotes?: boolean;
        }
    ) => Promise<Diagram | undefined>;
    updateDiagram: (params: {
        id: string;
        attributes: Partial<Diagram>;
    }) => Promise<void>;
    deleteDiagram: (id: string) => Promise<void>;

    // Table operations
    addTable: (params: { diagramId: string; table: DBTable }) => Promise<void>;
    getTable: (params: {
        diagramId: string;
        id: string;
    }) => Promise<DBTable | undefined>;
    updateTable: (params: {
        id: string;
        attributes: Partial<DBTable>;
    }) => Promise<void>;
    putTable: (params: { diagramId: string; table: DBTable }) => Promise<void>;
    deleteTable: (params: { diagramId: string; id: string }) => Promise<void>;
    listTables: (diagramId: string) => Promise<DBTable[]>;
    deleteDiagramTables: (diagramId: string) => Promise<void>;

    // Relationships operations
    addRelationship: (params: {
        diagramId: string;
        relationship: DBRelationship;
    }) => Promise<void>;
    getRelationship: (params: {
        diagramId: string;
        id: string;
    }) => Promise<DBRelationship | undefined>;
    updateRelationship: (params: {
        id: string;
        attributes: Partial<DBRelationship>;
    }) => Promise<void>;
    deleteRelationship: (params: {
        diagramId: string;
        id: string;
    }) => Promise<void>;
    listRelationships: (diagramId: string) => Promise<DBRelationship[]>;
    deleteDiagramRelationships: (diagramId: string) => Promise<void>;

    // Dependencies operations
    addDependency: (params: {
        diagramId: string;
        dependency: DBDependency;
    }) => Promise<void>;
    getDependency: (params: {
        diagramId: string;
        id: string;
    }) => Promise<DBDependency | undefined>;
    updateDependency: (params: {
        id: string;
        attributes: Partial<DBDependency>;
    }) => Promise<void>;
    deleteDependency: (params: {
        diagramId: string;
        id: string;
    }) => Promise<void>;
    listDependencies: (diagramId: string) => Promise<DBDependency[]>;
    deleteDiagramDependencies: (diagramId: string) => Promise<void>;

    // Area operations
    addArea: (params: { diagramId: string; area: Area }) => Promise<void>;
    getArea: (params: {
        diagramId: string;
        id: string;
    }) => Promise<Area | undefined>;
    updateArea: (params: {
        id: string;
        attributes: Partial<Area>;
    }) => Promise<void>;
    deleteArea: (params: { diagramId: string; id: string }) => Promise<void>;
    listAreas: (diagramId: string) => Promise<Area[]>;
    deleteDiagramAreas: (diagramId: string) => Promise<void>;

    // Custom type operations
    addCustomType: (params: {
        diagramId: string;
        customType: DBCustomType;
    }) => Promise<void>;
    getCustomType: (params: {
        diagramId: string;
        id: string;
    }) => Promise<DBCustomType | undefined>;
    updateCustomType: (params: {
        id: string;
        attributes: Partial<DBCustomType>;
    }) => Promise<void>;
    deleteCustomType: (params: {
        diagramId: string;
        id: string;
    }) => Promise<void>;
    listCustomTypes: (diagramId: string) => Promise<DBCustomType[]>;
    deleteDiagramCustomTypes: (diagramId: string) => Promise<void>;

    // Note operations
    addNote: (params: { diagramId: string; note: Note }) => Promise<void>;
    getNote: (params: {
        diagramId: string;
        id: string;
    }) => Promise<Note | undefined>;
    updateNote: (params: {
        id: string;
        attributes: Partial<Note>;
    }) => Promise<void>;
    deleteNote: (params: { diagramId: string; id: string }) => Promise<void>;
    listNotes: (diagramId: string) => Promise<Note[]>;
    deleteDiagramNotes: (diagramId: string) => Promise<void>;
}

export const storageInitialValue: StorageContext = {
    getConfig: emptyFn,
    updateConfig: emptyFn,
    listCollections: emptyFn,
    createCollection: emptyFn,
    updateCollection: emptyFn,
    deleteCollection: emptyFn,
    listProjects: emptyFn,
    createProject: emptyFn,
    updateProject: emptyFn,
    getProjectSharing: emptyFn,
    updateProjectSharing: emptyFn,
    searchShareableUsers: emptyFn,
    addProjectSharingUser: emptyFn,
    updateProjectSharingUser: emptyFn,
    removeProjectSharingUser: emptyFn,
    deleteProject: emptyFn,
    listProjectDiagrams: emptyFn,
    getSavedDiagram: emptyFn,
    updateSavedDiagram: emptyFn,
    getDiagramSharing: emptyFn,
    updateDiagramSharing: emptyFn,
    addDiagramSharingUser: emptyFn,
    updateDiagramSharingUser: emptyFn,
    removeDiagramSharingUser: emptyFn,
    saveDiagram: emptyFn,
    activateDiagramSession: emptyFn,
    getDiagramSessionState: emptyFn,
    subscribeToDiagramSessionState: emptyFn,
    updateDiagramSessionAwareness: emptyFn,
    updateDiagramSessionPresence: emptyFn,
    hasPendingDiagramSync: () => false,
    heartbeatDiagramSession: emptyFn,
    releaseDiagramSession: emptyFn,
    saveDiagramAs: emptyFn,
    exportBackup: emptyFn,
    importBackup: emptyFn,

    getDiagramFilter: emptyFn,
    updateDiagramFilter: emptyFn,
    deleteDiagramFilter: emptyFn,

    addDiagram: emptyFn,
    listDiagrams: emptyFn,
    getDiagram: emptyFn,
    updateDiagram: emptyFn,
    deleteDiagram: emptyFn,

    addTable: emptyFn,
    getTable: emptyFn,
    updateTable: emptyFn,
    putTable: emptyFn,
    deleteTable: emptyFn,
    listTables: emptyFn,
    deleteDiagramTables: emptyFn,

    addRelationship: emptyFn,
    getRelationship: emptyFn,
    updateRelationship: emptyFn,
    deleteRelationship: emptyFn,
    listRelationships: emptyFn,
    deleteDiagramRelationships: emptyFn,

    addDependency: emptyFn,
    getDependency: emptyFn,
    updateDependency: emptyFn,
    deleteDependency: emptyFn,
    listDependencies: emptyFn,
    deleteDiagramDependencies: emptyFn,

    addArea: emptyFn,
    getArea: emptyFn,
    updateArea: emptyFn,
    deleteArea: emptyFn,
    listAreas: emptyFn,
    deleteDiagramAreas: emptyFn,

    // Custom type operations
    addCustomType: emptyFn,
    getCustomType: emptyFn,
    updateCustomType: emptyFn,
    deleteCustomType: emptyFn,
    listCustomTypes: emptyFn,
    deleteDiagramCustomTypes: emptyFn,

    // Note operations
    addNote: emptyFn,
    getNote: emptyFn,
    updateNote: emptyFn,
    deleteNote: emptyFn,
    listNotes: emptyFn,
    deleteDiagramNotes: emptyFn,
};

export const storageContext =
    createContext<StorageContext>(storageInitialValue);
