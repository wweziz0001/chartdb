import Database from 'better-sqlite3';
import {
    diagramDocumentSchema,
    diagramStatusSchema,
    diagramVisibilitySchema,
    ownershipScopeSchema,
    projectStatusSchema,
    projectVisibilitySchema,
    type DiagramDocument,
    userAuthProviderSchema,
    userRoleSchema,
    userStatusSchema,
} from '../schemas/persistence.js';

export interface AppUserRecord {
    id: string;
    email: string | null;
    displayName: string;
    authProvider: 'placeholder' | 'local' | 'oidc';
    status: 'provisioned' | 'active' | 'disabled';
    role: 'member' | 'admin';
    ownershipScope: 'personal' | 'workspace';
    createdAt: string;
    updatedAt: string;
}

export interface AppUserAuthRecord extends AppUserRecord {
    passwordHash: string | null;
    passwordUpdatedAt: string | null;
    lastLoginAt: string | null;
}

export interface AppSessionRecord {
    id: string;
    userId: string;
    tokenHash: string;
    createdAt: string;
    lastSeenAt: string;
    expiresAt: string;
    invalidatedAt: string | null;
    ipAddress: string | null;
    userAgent: string | null;
}

export interface AppUserIdentityRecord {
    id: string;
    userId: string;
    provider: 'oidc';
    issuer: string;
    subject: string;
    emailAtLink: string;
    lastLoginAt: string;
    createdAt: string;
    updatedAt: string;
}

export interface ProjectRecord {
    id: string;
    name: string;
    description: string | null;
    collectionId: string | null;
    ownerUserId: string | null;
    visibility: 'private' | 'workspace' | 'public';
    status: 'active' | 'archived' | 'deleted';
    createdAt: string;
    updatedAt: string;
}

export interface CollectionRecord {
    id: string;
    name: string;
    description: string | null;
    ownerUserId: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface DiagramRecord {
    id: string;
    projectId: string;
    ownerUserId: string | null;
    name: string;
    description: string | null;
    databaseType: string;
    databaseEdition: string | null;
    visibility: 'private' | 'workspace' | 'public';
    status: 'draft' | 'active' | 'archived';
    document: DiagramDocument;
    createdAt: string;
    updatedAt: string;
}

const parseJson = <T>(value: string): T => JSON.parse(value) as T;

export class AppRepository {
    private readonly db: Database.Database;

    constructor(filename: string) {
        this.db = new Database(filename);
        this.initialize();
    }

    close() {
        this.db.close();
    }

    transaction<T>(callback: () => T): T {
        return this.db.transaction(callback)();
    }

    private initialize() {
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('foreign_keys = ON');
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS app_migrations (
                version INTEGER PRIMARY KEY,
                applied_at TEXT NOT NULL
            );
        `);

        const appliedVersions = new Set(
            (
                this.db
                    .prepare(
                        `SELECT version FROM app_migrations ORDER BY version ASC`
                    )
                    .all() as Array<{ version: number }>
            ).map((row) => row.version)
        );

        const migrations = [
            {
                version: 1,
                sql: `
                    CREATE TABLE IF NOT EXISTS app_config (
                        key TEXT PRIMARY KEY,
                        value TEXT NOT NULL,
                        updated_at TEXT NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS app_users (
                        id TEXT PRIMARY KEY,
                        email TEXT UNIQUE,
                        display_name TEXT NOT NULL,
                        auth_provider TEXT NOT NULL,
                        status TEXT NOT NULL,
                        ownership_scope TEXT NOT NULL,
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS app_projects (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        description TEXT,
                        owner_user_id TEXT,
                        visibility TEXT NOT NULL,
                        status TEXT NOT NULL,
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL,
                        FOREIGN KEY(owner_user_id) REFERENCES app_users(id) ON DELETE SET NULL
                    );

                    CREATE TABLE IF NOT EXISTS app_diagrams (
                        id TEXT PRIMARY KEY,
                        project_id TEXT NOT NULL,
                        owner_user_id TEXT,
                        name TEXT NOT NULL,
                        description TEXT,
                        database_type TEXT NOT NULL,
                        database_edition TEXT,
                        visibility TEXT NOT NULL,
                        status TEXT NOT NULL,
                        document_json TEXT NOT NULL,
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL,
                        FOREIGN KEY(project_id) REFERENCES app_projects(id) ON DELETE CASCADE,
                        FOREIGN KEY(owner_user_id) REFERENCES app_users(id) ON DELETE SET NULL
                    );

                    CREATE INDEX IF NOT EXISTS idx_app_projects_owner_updated
                    ON app_projects(owner_user_id, updated_at DESC);

                    CREATE INDEX IF NOT EXISTS idx_app_diagrams_project_updated
                    ON app_diagrams(project_id, updated_at DESC);

                    CREATE INDEX IF NOT EXISTS idx_app_diagrams_project_name
                    ON app_diagrams(project_id, name);
                `,
            },
            {
                version: 2,
                sql: `
                    CREATE TABLE IF NOT EXISTS app_collections (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        description TEXT,
                        owner_user_id TEXT,
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL,
                        FOREIGN KEY(owner_user_id) REFERENCES app_users(id) ON DELETE SET NULL
                    );

                    CREATE INDEX IF NOT EXISTS idx_app_collections_owner_updated
                    ON app_collections(owner_user_id, updated_at DESC);

                    ALTER TABLE app_projects
                    ADD COLUMN collection_id TEXT
                    REFERENCES app_collections(id) ON DELETE SET NULL;

                    CREATE INDEX IF NOT EXISTS idx_app_projects_collection_updated
                    ON app_projects(collection_id, updated_at DESC);
                `,
            },
            {
                version: 3,
                sql: `
                    ALTER TABLE app_users
                    ADD COLUMN password_hash TEXT;

                    ALTER TABLE app_users
                    ADD COLUMN password_updated_at TEXT;

                    ALTER TABLE app_users
                    ADD COLUMN last_login_at TEXT;

                    CREATE TABLE IF NOT EXISTS app_sessions (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        token_hash TEXT NOT NULL UNIQUE,
                        created_at TEXT NOT NULL,
                        last_seen_at TEXT NOT NULL,
                        expires_at TEXT NOT NULL,
                        invalidated_at TEXT,
                        ip_address TEXT,
                        user_agent TEXT,
                        FOREIGN KEY(user_id) REFERENCES app_users(id) ON DELETE CASCADE
                    );

                    CREATE INDEX IF NOT EXISTS idx_app_sessions_user
                    ON app_sessions(user_id, expires_at DESC);
                `,
            },
            {
                version: 4,
                sql: `
                    CREATE TABLE IF NOT EXISTS app_user_identities (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        provider TEXT NOT NULL,
                        issuer TEXT NOT NULL,
                        subject TEXT NOT NULL,
                        email_at_link TEXT NOT NULL,
                        last_login_at TEXT NOT NULL,
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL,
                        FOREIGN KEY(user_id) REFERENCES app_users(id) ON DELETE CASCADE
                    );

                    CREATE UNIQUE INDEX IF NOT EXISTS idx_app_user_identities_provider_subject
                    ON app_user_identities(provider, issuer, subject);

                    CREATE INDEX IF NOT EXISTS idx_app_user_identities_user
                    ON app_user_identities(user_id, provider);
                `,
            },
            {
                version: 5,
                sql: `
                    ALTER TABLE app_users
                    ADD COLUMN role TEXT NOT NULL DEFAULT 'member';
                `,
            },
        ] as const;

        for (const migration of migrations) {
            if (appliedVersions.has(migration.version)) {
                continue;
            }

            const now = new Date().toISOString();
            const applyMigration = this.db.transaction(() => {
                this.db.exec(migration.sql);
                this.db
                    .prepare(
                        `
                        INSERT INTO app_migrations (version, applied_at)
                        VALUES (?, ?)
                        `
                    )
                    .run(migration.version, now);
            });
            applyMigration();
        }
    }

    getConfigValue(key: string): string | undefined {
        const row = this.db
            .prepare(`SELECT value FROM app_config WHERE key = ?`)
            .get(key) as { value: string } | undefined;

        return row?.value;
    }

    setConfigValue(key: string, value: string) {
        const now = new Date().toISOString();
        this.db
            .prepare(
                `
                INSERT INTO app_config (key, value, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET
                    value = excluded.value,
                    updated_at = excluded.updated_at
                `
            )
            .run(key, value, now);
    }

    putUser(user: AppUserRecord) {
        this.putUserAuthRecord({
            ...user,
            passwordHash: null,
            passwordUpdatedAt: null,
            lastLoginAt: null,
        });
    }

    putUserAuthRecord(user: AppUserAuthRecord) {
        this.db
            .prepare(
                `
                INSERT INTO app_users (
                    id, email, display_name, auth_provider, status, role,
                    ownership_scope, password_hash, password_updated_at,
                    last_login_at, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    email = excluded.email,
                    display_name = excluded.display_name,
                    auth_provider = excluded.auth_provider,
                    status = excluded.status,
                    role = excluded.role,
                    ownership_scope = excluded.ownership_scope,
                    password_hash = excluded.password_hash,
                    password_updated_at = excluded.password_updated_at,
                    last_login_at = excluded.last_login_at,
                    updated_at = excluded.updated_at
                `
            )
            .run(
                user.id,
                user.email,
                user.displayName,
                user.authProvider,
                user.status,
                user.role,
                user.ownershipScope,
                user.passwordHash,
                user.passwordUpdatedAt,
                user.lastLoginAt,
                user.createdAt,
                user.updatedAt
            );
    }

    getUser(id: string): AppUserRecord | undefined {
        const row = this.db
            .prepare(
                `
                SELECT id, email, display_name, auth_provider, status,
                    role, ownership_scope, created_at, updated_at
                FROM app_users
                WHERE id = ?
                `
            )
            .get(id) as Record<string, unknown> | undefined;

        return row ? this.mapUser(row) : undefined;
    }

    getUserAuthById(id: string): AppUserAuthRecord | undefined {
        const row = this.db
            .prepare(
                `
                SELECT
                    id, email, display_name, auth_provider, status,
                    role, ownership_scope, password_hash, password_updated_at,
                    last_login_at, created_at, updated_at
                FROM app_users
                WHERE id = ?
                `
            )
            .get(id) as Record<string, unknown> | undefined;

        return row ? this.mapUserAuth(row) : undefined;
    }

    getUserAuthByEmail(email: string): AppUserAuthRecord | undefined {
        const row = this.db
            .prepare(
                `
                SELECT
                    id, email, display_name, auth_provider, status,
                    role, ownership_scope, password_hash, password_updated_at,
                    last_login_at, created_at, updated_at
                FROM app_users
                WHERE lower(email) = lower(?)
                `
            )
            .get(email) as Record<string, unknown> | undefined;

        return row ? this.mapUserAuth(row) : undefined;
    }

    countActiveAdmins(): number {
        const row = this.db
            .prepare(
                `
                SELECT count(*) AS count
                FROM app_users
                WHERE role = 'admin' AND status = 'active'
                `
            )
            .get() as { count: number };

        return Number(row.count);
    }

    getFirstActiveAdmin(): AppUserAuthRecord | undefined {
        const row = this.db
            .prepare(
                `
                SELECT
                    id, email, display_name, auth_provider, status,
                    role, ownership_scope, password_hash, password_updated_at,
                    last_login_at, created_at, updated_at
                FROM app_users
                WHERE role = 'admin' AND status = 'active'
                ORDER BY created_at ASC
                LIMIT 1
                `
            )
            .get() as Record<string, unknown> | undefined;

        return row ? this.mapUserAuth(row) : undefined;
    }

    putSession(session: AppSessionRecord) {
        this.db
            .prepare(
                `
                INSERT INTO app_sessions (
                    id, user_id, token_hash, created_at, last_seen_at,
                    expires_at, invalidated_at, ip_address, user_agent
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    user_id = excluded.user_id,
                    token_hash = excluded.token_hash,
                    last_seen_at = excluded.last_seen_at,
                    expires_at = excluded.expires_at,
                    invalidated_at = excluded.invalidated_at,
                    ip_address = excluded.ip_address,
                    user_agent = excluded.user_agent
                `
            )
            .run(
                session.id,
                session.userId,
                session.tokenHash,
                session.createdAt,
                session.lastSeenAt,
                session.expiresAt,
                session.invalidatedAt,
                session.ipAddress,
                session.userAgent
            );
    }

    getSessionByTokenHash(tokenHash: string): AppSessionRecord | undefined {
        const row = this.db
            .prepare(
                `
                SELECT
                    id, user_id, token_hash, created_at, last_seen_at,
                    expires_at, invalidated_at, ip_address, user_agent
                FROM app_sessions
                WHERE token_hash = ?
                `
            )
            .get(tokenHash) as Record<string, unknown> | undefined;

        return row ? this.mapSession(row) : undefined;
    }

    invalidateSession(id: string, invalidatedAt: string) {
        this.db
            .prepare(
                `
                UPDATE app_sessions
                SET invalidated_at = ?,
                    last_seen_at = ?
                WHERE id = ?
                `
            )
            .run(invalidatedAt, invalidatedAt, id);
    }

    putUserIdentity(identity: AppUserIdentityRecord) {
        this.db
            .prepare(
                `
                INSERT INTO app_user_identities (
                    id, user_id, provider, issuer, subject, email_at_link,
                    last_login_at, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    user_id = excluded.user_id,
                    provider = excluded.provider,
                    issuer = excluded.issuer,
                    subject = excluded.subject,
                    email_at_link = excluded.email_at_link,
                    last_login_at = excluded.last_login_at,
                    updated_at = excluded.updated_at
                `
            )
            .run(
                identity.id,
                identity.userId,
                identity.provider,
                identity.issuer,
                identity.subject,
                identity.emailAtLink,
                identity.lastLoginAt,
                identity.createdAt,
                identity.updatedAt
            );
    }

    getUserIdentityByProviderSubject(
        provider: AppUserIdentityRecord['provider'],
        issuer: string,
        subject: string
    ): AppUserIdentityRecord | undefined {
        const row = this.db
            .prepare(
                `
                SELECT
                    id, user_id, provider, issuer, subject, email_at_link,
                    last_login_at, created_at, updated_at
                FROM app_user_identities
                WHERE provider = ? AND issuer = ? AND subject = ?
                `
            )
            .get(provider, issuer, subject) as
            | Record<string, unknown>
            | undefined;

        return row ? this.mapUserIdentity(row) : undefined;
    }

    listCollections(): CollectionRecord[] {
        const rows = this.db
            .prepare(
                `
                SELECT id, name, description, owner_user_id, created_at, updated_at
                FROM app_collections
                ORDER BY updated_at DESC, created_at DESC
                `
            )
            .all() as Array<Record<string, unknown>>;

        return rows.map((row) => this.mapCollection(row));
    }

    getCollection(id: string): CollectionRecord | undefined {
        const row = this.db
            .prepare(
                `
                SELECT id, name, description, owner_user_id, created_at, updated_at
                FROM app_collections
                WHERE id = ?
                `
            )
            .get(id) as Record<string, unknown> | undefined;

        return row ? this.mapCollection(row) : undefined;
    }

    putCollection(collection: CollectionRecord) {
        this.db
            .prepare(
                `
                INSERT INTO app_collections (
                    id, name, description, owner_user_id, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    description = excluded.description,
                    owner_user_id = excluded.owner_user_id,
                    updated_at = excluded.updated_at
                `
            )
            .run(
                collection.id,
                collection.name,
                collection.description,
                collection.ownerUserId,
                collection.createdAt,
                collection.updatedAt
            );
    }

    deleteCollection(id: string) {
        this.db.prepare(`DELETE FROM app_collections WHERE id = ?`).run(id);
    }

    listProjects(): ProjectRecord[] {
        const rows = this.db
            .prepare(
                `
                SELECT
                    id, name, description, collection_id, owner_user_id,
                    visibility, status, created_at, updated_at
                FROM app_projects
                ORDER BY updated_at DESC, created_at DESC
                `
            )
            .all() as Array<Record<string, unknown>>;

        return rows.map((row) => this.mapProject(row));
    }

    getProject(id: string): ProjectRecord | undefined {
        const row = this.db
            .prepare(
                `
                SELECT
                    id, name, description, collection_id, owner_user_id,
                    visibility, status, created_at, updated_at
                FROM app_projects
                WHERE id = ?
                `
            )
            .get(id) as Record<string, unknown> | undefined;

        return row ? this.mapProject(row) : undefined;
    }

    putProject(project: ProjectRecord) {
        this.db
            .prepare(
                `
                INSERT INTO app_projects (
                    id, name, description, collection_id, owner_user_id,
                    visibility, status, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    description = excluded.description,
                    collection_id = excluded.collection_id,
                    owner_user_id = excluded.owner_user_id,
                    visibility = excluded.visibility,
                    status = excluded.status,
                    updated_at = excluded.updated_at
                `
            )
            .run(
                project.id,
                project.name,
                project.description,
                project.collectionId,
                project.ownerUserId,
                project.visibility,
                project.status,
                project.createdAt,
                project.updatedAt
            );
    }

    deleteProject(id: string) {
        this.db.prepare(`DELETE FROM app_projects WHERE id = ?`).run(id);
    }

    listDiagrams(): DiagramRecord[] {
        const rows = this.db
            .prepare(
                `
                SELECT
                    id, project_id, owner_user_id, name, description,
                    database_type, database_edition, visibility, status,
                    document_json, created_at, updated_at
                FROM app_diagrams
                ORDER BY updated_at DESC, created_at DESC
                `
            )
            .all() as Array<Record<string, unknown>>;

        return rows.map((row) => this.mapDiagram(row));
    }

    listProjectDiagrams(projectId: string): DiagramRecord[] {
        const rows = this.db
            .prepare(
                `
                SELECT
                    id, project_id, owner_user_id, name, description,
                    database_type, database_edition, visibility, status,
                    document_json, created_at, updated_at
                FROM app_diagrams
                WHERE project_id = ?
                ORDER BY updated_at DESC, created_at DESC
                `
            )
            .all(projectId) as Array<Record<string, unknown>>;

        return rows.map((row) => this.mapDiagram(row));
    }

    getDiagram(id: string): DiagramRecord | undefined {
        const row = this.db
            .prepare(
                `
                SELECT
                    id, project_id, owner_user_id, name, description,
                    database_type, database_edition, visibility, status,
                    document_json, created_at, updated_at
                FROM app_diagrams
                WHERE id = ?
                `
            )
            .get(id) as Record<string, unknown> | undefined;

        return row ? this.mapDiagram(row) : undefined;
    }

    putDiagram(diagram: DiagramRecord) {
        this.db
            .prepare(
                `
                INSERT INTO app_diagrams (
                    id, project_id, owner_user_id, name, description, database_type,
                    database_edition, visibility, status, document_json, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    project_id = excluded.project_id,
                    owner_user_id = excluded.owner_user_id,
                    name = excluded.name,
                    description = excluded.description,
                    database_type = excluded.database_type,
                    database_edition = excluded.database_edition,
                    visibility = excluded.visibility,
                    status = excluded.status,
                    document_json = excluded.document_json,
                    updated_at = excluded.updated_at
                `
            )
            .run(
                diagram.id,
                diagram.projectId,
                diagram.ownerUserId,
                diagram.name,
                diagram.description,
                diagram.databaseType,
                diagram.databaseEdition,
                diagram.visibility,
                diagram.status,
                JSON.stringify(diagram.document),
                diagram.createdAt,
                diagram.updatedAt
            );
    }

    deleteDiagram(id: string) {
        this.db.prepare(`DELETE FROM app_diagrams WHERE id = ?`).run(id);
    }

    private mapUser(row: Record<string, unknown>): AppUserRecord {
        return {
            id: String(row.id),
            email: row.email ? String(row.email) : null,
            displayName: String(row.display_name),
            authProvider: userAuthProviderSchema.parse(row.auth_provider),
            status: userStatusSchema.parse(row.status),
            role: userRoleSchema.parse(row.role),
            ownershipScope: ownershipScopeSchema.parse(row.ownership_scope),
            createdAt: String(row.created_at),
            updatedAt: String(row.updated_at),
        };
    }

    private mapUserAuth(row: Record<string, unknown>): AppUserAuthRecord {
        return {
            ...this.mapUser(row),
            passwordHash: row.password_hash ? String(row.password_hash) : null,
            passwordUpdatedAt: row.password_updated_at
                ? String(row.password_updated_at)
                : null,
            lastLoginAt: row.last_login_at ? String(row.last_login_at) : null,
        };
    }

    private mapSession(row: Record<string, unknown>): AppSessionRecord {
        return {
            id: String(row.id),
            userId: String(row.user_id),
            tokenHash: String(row.token_hash),
            createdAt: String(row.created_at),
            lastSeenAt: String(row.last_seen_at),
            expiresAt: String(row.expires_at),
            invalidatedAt: row.invalidated_at
                ? String(row.invalidated_at)
                : null,
            ipAddress: row.ip_address ? String(row.ip_address) : null,
            userAgent: row.user_agent ? String(row.user_agent) : null,
        };
    }

    private mapUserIdentity(
        row: Record<string, unknown>
    ): AppUserIdentityRecord {
        return {
            id: String(row.id),
            userId: String(row.user_id),
            provider: 'oidc',
            issuer: String(row.issuer),
            subject: String(row.subject),
            emailAtLink: String(row.email_at_link),
            lastLoginAt: String(row.last_login_at),
            createdAt: String(row.created_at),
            updatedAt: String(row.updated_at),
        };
    }

    private mapCollection(row: Record<string, unknown>): CollectionRecord {
        return {
            id: String(row.id),
            name: String(row.name),
            description: row.description ? String(row.description) : null,
            ownerUserId: row.owner_user_id ? String(row.owner_user_id) : null,
            createdAt: String(row.created_at),
            updatedAt: String(row.updated_at),
        };
    }

    private mapProject(row: Record<string, unknown>): ProjectRecord {
        return {
            id: String(row.id),
            name: String(row.name),
            description: row.description ? String(row.description) : null,
            collectionId: row.collection_id ? String(row.collection_id) : null,
            ownerUserId: row.owner_user_id ? String(row.owner_user_id) : null,
            visibility: projectVisibilitySchema.parse(row.visibility),
            status: projectStatusSchema.parse(row.status),
            createdAt: String(row.created_at),
            updatedAt: String(row.updated_at),
        };
    }

    private mapDiagram(row: Record<string, unknown>): DiagramRecord {
        return {
            id: String(row.id),
            projectId: String(row.project_id),
            ownerUserId: row.owner_user_id ? String(row.owner_user_id) : null,
            name: String(row.name),
            description: row.description ? String(row.description) : null,
            databaseType: String(row.database_type),
            databaseEdition: row.database_edition
                ? String(row.database_edition)
                : null,
            visibility: diagramVisibilitySchema.parse(row.visibility),
            status: diagramStatusSchema.parse(row.status),
            document: diagramDocumentSchema.parse(
                parseJson<DiagramDocument>(String(row.document_json))
            ),
            createdAt: String(row.created_at),
            updatedAt: String(row.updated_at),
        };
    }
}
