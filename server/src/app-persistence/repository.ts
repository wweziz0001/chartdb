import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import type {
    DiagramDocument,
    DiagramIncludeOptions,
    DiagramStatus,
    DiagramVisibility,
    MembershipRole,
    ProjectStatus,
    ProjectVisibility,
    UserStatus,
} from './contracts.js';

const parseJson = <T>(value: string | null, fallback: T): T =>
    value ? (JSON.parse(value) as T) : fallback;

const hashDocument = (document: DiagramDocument) =>
    createHash('sha256').update(JSON.stringify(document)).digest('hex');

export interface AppUserRecord {
    id: string;
    email: string;
    displayName: string;
    authProvider: string;
    status: UserStatus;
    isAdmin: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface ProjectMembershipRecord {
    id: string;
    projectId: string;
    userId: string;
    role: MembershipRole;
    createdAt: string;
    updatedAt: string;
}

export interface ProjectRecord {
    id: string;
    ownerUserId: string;
    slug: string;
    name: string;
    description: string | null;
    visibility: ProjectVisibility;
    status: ProjectStatus;
    primaryDiagramId: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface DiagramRecord {
    id: string;
    projectId: string;
    ownerUserId: string;
    name: string;
    visibility: DiagramVisibility;
    status: DiagramStatus;
    version: number;
    checksum: string;
    createdAt: string;
    updatedAt: string;
    document: DiagramDocument;
}

export interface DiagramEnvelope {
    project: ProjectRecord;
    diagram: DiagramRecord;
}

export interface SearchResult {
    type: 'project' | 'diagram';
    id: string;
    projectId: string | null;
    name: string;
    visibility: string;
    status: string;
    updatedAt: string;
}

interface UpsertProjectParams {
    id: string;
    ownerUserId: string;
    slug: string;
    name: string;
    description?: string | null;
    visibility: ProjectVisibility;
    status: ProjectStatus;
    primaryDiagramId?: string | null;
    createdAt: string;
    updatedAt: string;
}

interface UpsertDiagramParams {
    id: string;
    projectId: string;
    ownerUserId: string;
    name: string;
    visibility: DiagramVisibility;
    status: DiagramStatus;
    createdAt: string;
    updatedAt: string;
    document: DiagramDocument;
}

const toSlug = (value: string) =>
    value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'project';

export class AppPersistenceRepository {
    private readonly db: Database.Database;

    constructor(filename: string) {
        this.db = new Database(filename);
        this.initialize();
    }

    close() {
        this.db.close();
    }

    private initialize() {
        this.db.exec(`
            PRAGMA journal_mode = WAL;
            CREATE TABLE IF NOT EXISTS app_users (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                display_name TEXT NOT NULL,
                auth_provider TEXT NOT NULL,
                status TEXT NOT NULL,
                is_admin INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS app_projects (
                id TEXT PRIMARY KEY,
                owner_user_id TEXT NOT NULL,
                slug TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                description TEXT,
                visibility TEXT NOT NULL,
                status TEXT NOT NULL,
                primary_diagram_id TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS app_project_memberships (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                role TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(project_id, user_id)
            );
            CREATE TABLE IF NOT EXISTS app_diagrams (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                owner_user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                visibility TEXT NOT NULL,
                status TEXT NOT NULL,
                version INTEGER NOT NULL,
                checksum TEXT NOT NULL,
                document_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_app_projects_owner_updated
                ON app_projects(owner_user_id, updated_at DESC);
            CREATE INDEX IF NOT EXISTS idx_app_projects_status
                ON app_projects(status, visibility);
            CREATE INDEX IF NOT EXISTS idx_app_diagrams_project_updated
                ON app_diagrams(project_id, updated_at DESC);
            CREATE INDEX IF NOT EXISTS idx_app_diagrams_status
                ON app_diagrams(status, visibility);
        `);
    }

    countEntities() {
        const getCount = (table: string) =>
            Number(
                (
                    this.db
                        .prepare(`SELECT COUNT(*) AS count FROM ${table}`)
                        .get() as { count: number }
                ).count
            );

        return {
            users: getCount('app_users'),
            projects: getCount('app_projects'),
            diagrams: getCount('app_diagrams'),
            memberships: getCount('app_project_memberships'),
        };
    }

    ensureUser(user: AppUserRecord) {
        this.db
            .prepare(
                `
                INSERT INTO app_users (
                    id, email, display_name, auth_provider, status, is_admin, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    email = excluded.email,
                    display_name = excluded.display_name,
                    auth_provider = excluded.auth_provider,
                    status = excluded.status,
                    is_admin = excluded.is_admin,
                    updated_at = excluded.updated_at
                `
            )
            .run(
                user.id,
                user.email,
                user.displayName,
                user.authProvider,
                user.status,
                user.isAdmin ? 1 : 0,
                user.createdAt,
                user.updatedAt
            );
    }

    getUser(id: string): AppUserRecord | undefined {
        const row = this.db
            .prepare(
                `
                SELECT id, email, display_name, auth_provider, status, is_admin, created_at, updated_at
                FROM app_users
                WHERE id = ?
                `
            )
            .get(id) as Record<string, unknown> | undefined;

        return row ? this.mapUser(row) : undefined;
    }

    upsertProject(project: UpsertProjectParams) {
        this.db
            .prepare(
                `
                INSERT INTO app_projects (
                    id, owner_user_id, slug, name, description, visibility, status, primary_diagram_id, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    owner_user_id = excluded.owner_user_id,
                    slug = excluded.slug,
                    name = excluded.name,
                    description = excluded.description,
                    visibility = excluded.visibility,
                    status = excluded.status,
                    primary_diagram_id = excluded.primary_diagram_id,
                    updated_at = excluded.updated_at
                `
            )
            .run(
                project.id,
                project.ownerUserId,
                project.slug,
                project.name,
                project.description ?? null,
                project.visibility,
                project.status,
                project.primaryDiagramId ?? null,
                project.createdAt,
                project.updatedAt
            );
    }

    ensureProjectMembership(membership: ProjectMembershipRecord) {
        this.db
            .prepare(
                `
                INSERT INTO app_project_memberships (
                    id, project_id, user_id, role, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(project_id, user_id) DO UPDATE SET
                    role = excluded.role,
                    updated_at = excluded.updated_at
                `
            )
            .run(
                membership.id,
                membership.projectId,
                membership.userId,
                membership.role,
                membership.createdAt,
                membership.updatedAt
            );
    }

    upsertDiagram(params: UpsertDiagramParams): DiagramRecord {
        const existing = this.getDiagram(params.id);
        const version = existing ? existing.version + 1 : 1;
        const checksum = hashDocument(params.document);

        this.db
            .prepare(
                `
                INSERT INTO app_diagrams (
                    id, project_id, owner_user_id, name, visibility, status, version, checksum, document_json, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    project_id = excluded.project_id,
                    owner_user_id = excluded.owner_user_id,
                    name = excluded.name,
                    visibility = excluded.visibility,
                    status = excluded.status,
                    version = excluded.version,
                    checksum = excluded.checksum,
                    document_json = excluded.document_json,
                    updated_at = excluded.updated_at
                `
            )
            .run(
                params.id,
                params.projectId,
                params.ownerUserId,
                params.name,
                params.visibility,
                params.status,
                version,
                checksum,
                JSON.stringify(params.document),
                params.createdAt,
                params.updatedAt
            );

        return this.getDiagram(params.id)!;
    }

    getProject(id: string): ProjectRecord | undefined {
        const row = this.db
            .prepare(
                `
                SELECT id, owner_user_id, slug, name, description, visibility, status, primary_diagram_id, created_at, updated_at
                FROM app_projects
                WHERE id = ?
                `
            )
            .get(id) as Record<string, unknown> | undefined;

        return row ? this.mapProject(row) : undefined;
    }

    listProjects(options: { q?: string } = {}): ProjectRecord[] {
        const query = options.q?.trim();
        const rows = (
            query
                ? this.db
                      .prepare(
                          `
                      SELECT id, owner_user_id, slug, name, description, visibility, status, primary_diagram_id, created_at, updated_at
                      FROM app_projects
                      WHERE name LIKE ? OR COALESCE(description, '') LIKE ?
                      ORDER BY updated_at DESC
                      `
                      )
                      .all(`%${query}%`, `%${query}%`)
                : this.db
                      .prepare(
                          `
                      SELECT id, owner_user_id, slug, name, description, visibility, status, primary_diagram_id, created_at, updated_at
                      FROM app_projects
                      ORDER BY updated_at DESC
                      `
                      )
                      .all()
        ) as Array<Record<string, unknown>>;

        return rows.map((row) => this.mapProject(row));
    }

    getDiagram(id: string): DiagramRecord | undefined {
        const row = this.db
            .prepare(
                `
                SELECT id, project_id, owner_user_id, name, visibility, status, version, checksum, document_json, created_at, updated_at
                FROM app_diagrams
                WHERE id = ?
                `
            )
            .get(id) as Record<string, unknown> | undefined;

        return row ? this.mapDiagram(row) : undefined;
    }

    listDiagrams(options: DiagramIncludeOptions & { q?: string } = {}) {
        const query = options.q?.trim();
        const rows = (
            query
                ? this.db
                      .prepare(
                          `
                      SELECT id, project_id, owner_user_id, name, visibility, status, version, checksum, document_json, created_at, updated_at
                      FROM app_diagrams
                      WHERE name LIKE ?
                      ORDER BY updated_at DESC
                      `
                      )
                      .all(`%${query}%`)
                : this.db
                      .prepare(
                          `
                      SELECT id, project_id, owner_user_id, name, visibility, status, version, checksum, document_json, created_at, updated_at
                      FROM app_diagrams
                      ORDER BY updated_at DESC
                      `
                      )
                      .all()
        ) as Array<Record<string, unknown>>;

        return rows.map((row) => {
            const diagram = this.mapDiagram(row);
            return this.applyIncludeOptions(diagram, options);
        });
    }

    getDiagramEnvelope(
        id: string,
        options: DiagramIncludeOptions = {}
    ): DiagramEnvelope | undefined {
        const diagram = this.getDiagram(id);
        if (!diagram) {
            return undefined;
        }
        const project = this.getProject(diagram.projectId);
        if (!project) {
            return undefined;
        }
        return {
            project,
            diagram: this.applyIncludeOptions(diagram, options),
        };
    }

    deleteDiagram(id: string) {
        const existing = this.getDiagram(id);
        if (!existing) {
            return false;
        }

        this.db.prepare(`DELETE FROM app_diagrams WHERE id = ?`).run(id);

        const remaining = Number(
            (
                this.db
                    .prepare(
                        `SELECT COUNT(*) AS count FROM app_diagrams WHERE project_id = ?`
                    )
                    .get(existing.projectId) as { count: number }
            ).count
        );

        if (remaining === 0) {
            this.db
                .prepare(
                    `DELETE FROM app_project_memberships WHERE project_id = ?`
                )
                .run(existing.projectId);
            this.db
                .prepare(`DELETE FROM app_projects WHERE id = ?`)
                .run(existing.projectId);
        } else {
            this.db
                .prepare(
                    `
                    UPDATE app_projects
                    SET primary_diagram_id = (
                        SELECT id FROM app_diagrams
                        WHERE project_id = ?
                        ORDER BY updated_at DESC
                        LIMIT 1
                    ),
                    updated_at = ?
                    WHERE id = ?
                    `
                )
                .run(
                    existing.projectId,
                    new Date().toISOString(),
                    existing.projectId
                );
        }

        return true;
    }

    search(query: string): SearchResult[] {
        const wildcard = `%${query.trim()}%`;
        const projectRows = this.db
            .prepare(
                `
                SELECT id, NULL AS project_id, name, visibility, status, updated_at
                FROM app_projects
                WHERE name LIKE ? OR COALESCE(description, '') LIKE ?
                ORDER BY updated_at DESC
                LIMIT 10
                `
            )
            .all(wildcard, wildcard) as Array<Record<string, unknown>>;

        const diagramRows = this.db
            .prepare(
                `
                SELECT id, project_id, name, visibility, status, updated_at
                FROM app_diagrams
                WHERE name LIKE ?
                ORDER BY updated_at DESC
                LIMIT 10
                `
            )
            .all(wildcard) as Array<Record<string, unknown>>;

        return [
            ...projectRows.map((row) => ({
                type: 'project' as const,
                id: String(row.id),
                projectId: null,
                name: String(row.name),
                visibility: String(row.visibility),
                status: String(row.status),
                updatedAt: String(row.updated_at),
            })),
            ...diagramRows.map((row) => ({
                type: 'diagram' as const,
                id: String(row.id),
                projectId: String(row.project_id),
                name: String(row.name),
                visibility: String(row.visibility),
                status: String(row.status),
                updatedAt: String(row.updated_at),
            })),
        ];
    }

    nextAvailableProjectSlug(baseName: string, projectId: string) {
        const baseSlug = toSlug(baseName);
        let candidate = baseSlug;
        let suffix = 2;

        while (true) {
            const existing = this.db
                .prepare(
                    `SELECT id FROM app_projects WHERE slug = ? AND id != ? LIMIT 1`
                )
                .get(candidate, projectId) as { id: string } | undefined;

            if (!existing) {
                return candidate;
            }

            candidate = `${baseSlug}-${suffix}`;
            suffix += 1;
        }
    }

    private applyIncludeOptions(
        diagram: DiagramRecord,
        options: DiagramIncludeOptions
    ): DiagramRecord {
        const document: DiagramDocument = {
            ...diagram.document,
        };

        if (!options.includeTables) {
            delete document.tables;
        }
        if (!options.includeRelationships) {
            delete document.relationships;
        }
        if (!options.includeDependencies) {
            delete document.dependencies;
        }
        if (!options.includeAreas) {
            delete document.areas;
        }
        if (!options.includeCustomTypes) {
            delete document.customTypes;
        }
        if (!options.includeNotes) {
            delete document.notes;
        }

        return {
            ...diagram,
            document,
        };
    }

    private mapUser(row: Record<string, unknown>): AppUserRecord {
        return {
            id: String(row.id),
            email: String(row.email),
            displayName: String(row.display_name),
            authProvider: String(row.auth_provider),
            status: row.status as UserStatus,
            isAdmin: Number(row.is_admin) === 1,
            createdAt: String(row.created_at),
            updatedAt: String(row.updated_at),
        };
    }

    private mapProject(row: Record<string, unknown>): ProjectRecord {
        return {
            id: String(row.id),
            ownerUserId: String(row.owner_user_id),
            slug: String(row.slug),
            name: String(row.name),
            description: row.description ? String(row.description) : null,
            visibility: row.visibility as ProjectVisibility,
            status: row.status as ProjectStatus,
            primaryDiagramId: row.primary_diagram_id
                ? String(row.primary_diagram_id)
                : null,
            createdAt: String(row.created_at),
            updatedAt: String(row.updated_at),
        };
    }

    private mapDiagram(row: Record<string, unknown>): DiagramRecord {
        return {
            id: String(row.id),
            projectId: String(row.project_id),
            ownerUserId: String(row.owner_user_id),
            name: String(row.name),
            visibility: row.visibility as DiagramVisibility,
            status: row.status as DiagramStatus,
            version: Number(row.version),
            checksum: String(row.checksum),
            document: parseJson<DiagramDocument>(
                String(row.document_json),
                {} as DiagramDocument
            ),
            createdAt: String(row.created_at),
            updatedAt: String(row.updated_at),
        };
    }
}
