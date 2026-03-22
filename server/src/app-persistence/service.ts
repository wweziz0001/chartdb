import { randomUUID } from 'node:crypto';
import type { ServerEnv } from '../config/env.js';
import { AppError } from '../utils/app-error.js';
import type {
    CreateProjectRequest,
    DiagramIncludeOptions,
    UpsertDiagramRequest,
    UpdateProjectRequest,
} from './contracts.js';
import type {
    AppPersistenceRepository,
    AppUserRecord,
    DiagramEnvelope,
} from './repository.js';

export class AppPersistenceService {
    constructor(
        private readonly repository: AppPersistenceRepository,
        private readonly env: ServerEnv
    ) {
        this.ensureDefaultUser();
    }

    getHealth() {
        return {
            storage: 'sqlite',
            databasePath: this.env.metadataDbPath,
            defaultUserId: this.env.defaultUser.id,
            counts: this.repository.countEntities(),
        };
    }

    getCurrentUser() {
        const user = this.repository.getUser(this.env.defaultUser.id);
        if (!user) {
            throw new AppError(
                'Default user not configured.',
                500,
                'user_missing'
            );
        }
        return user;
    }

    listProjects(query?: string) {
        return {
            items: this.repository.listProjects({ q: query }),
        };
    }

    createProject(payload: CreateProjectRequest) {
        const now = new Date().toISOString();
        const ownerUserId = payload.ownerUserId ?? this.getCurrentUser().id;
        const projectId = randomUUID();
        const slug = this.repository.nextAvailableProjectSlug(
            payload.name,
            projectId
        );

        this.repository.upsertProject({
            id: projectId,
            ownerUserId,
            slug,
            name: payload.name,
            description: payload.description ?? null,
            visibility: payload.visibility ?? 'private',
            status: payload.status ?? 'active',
            primaryDiagramId: null,
            createdAt: now,
            updatedAt: now,
        });
        this.repository.ensureProjectMembership({
            id: randomUUID(),
            projectId,
            userId: ownerUserId,
            role: 'owner',
            createdAt: now,
            updatedAt: now,
        });

        return {
            project: this.repository.getProject(projectId)!,
        };
    }

    getProject(projectId: string) {
        const project = this.repository.getProject(projectId);
        if (!project) {
            throw new AppError('Project not found.', 404, 'project_not_found');
        }

        return {
            project,
            diagrams: this.repository
                .listDiagrams({
                    includeTables: true,
                    includeRelationships: true,
                    includeDependencies: true,
                    includeAreas: true,
                    includeCustomTypes: true,
                    includeNotes: true,
                })
                .filter((diagram) => diagram.projectId === projectId),
        };
    }

    updateProject(projectId: string, payload: UpdateProjectRequest) {
        const existing = this.repository.getProject(projectId);
        if (!existing) {
            throw new AppError('Project not found.', 404, 'project_not_found');
        }

        const updatedAt = new Date().toISOString();
        this.repository.upsertProject({
            id: existing.id,
            ownerUserId: existing.ownerUserId,
            slug: this.repository.nextAvailableProjectSlug(
                payload.name ?? existing.name,
                existing.id
            ),
            name: payload.name ?? existing.name,
            description:
                payload.description === undefined
                    ? existing.description
                    : payload.description,
            visibility: payload.visibility ?? existing.visibility,
            status: payload.status ?? existing.status,
            primaryDiagramId: existing.primaryDiagramId,
            createdAt: existing.createdAt,
            updatedAt,
        });

        return {
            project: this.repository.getProject(projectId)!,
        };
    }

    listDiagrams(
        options: DiagramIncludeOptions & {
            q?: string;
        } = {}
    ) {
        return {
            items: this.repository
                .listDiagrams(options)
                .map((record) => this.toDiagramResponse(record)),
        };
    }

    getDiagram(diagramId: string, options: DiagramIncludeOptions = {}) {
        const envelope = this.repository.getDiagramEnvelope(diagramId, options);
        if (!envelope) {
            throw new AppError('Diagram not found.', 404, 'diagram_not_found');
        }

        return {
            project: envelope.project,
            diagram: this.toDiagramResponse(envelope.diagram),
        };
    }

    upsertDiagram(payload: UpsertDiagramRequest) {
        const ownerUserId = payload.ownerUserId ?? this.getCurrentUser().id;
        const now = new Date().toISOString();
        const existing = this.repository.getDiagram(payload.diagram.id);
        const projectId =
            payload.project?.id ?? existing?.projectId ?? payload.diagram.id;
        const project = this.repository.getProject(projectId);
        const projectName = payload.project?.name ?? payload.diagram.name;
        const projectCreatedAt = project?.createdAt ?? now;
        const primaryDiagramId =
            project?.primaryDiagramId ?? payload.diagram.id;

        this.repository.upsertProject({
            id: projectId,
            ownerUserId: payload.project?.ownerUserId ?? ownerUserId,
            slug: this.repository.nextAvailableProjectSlug(
                projectName,
                projectId
            ),
            name: projectName,
            description:
                payload.project?.description ?? project?.description ?? null,
            visibility:
                payload.project?.visibility ?? project?.visibility ?? 'private',
            status: payload.project?.status ?? project?.status ?? 'active',
            primaryDiagramId,
            createdAt: projectCreatedAt,
            updatedAt: payload.diagram.updatedAt,
        });
        this.repository.ensureProjectMembership({
            id: randomUUID(),
            projectId,
            userId: ownerUserId,
            role: 'owner',
            createdAt: projectCreatedAt,
            updatedAt: now,
        });

        const storedDiagram = this.repository.upsertDiagram({
            id: payload.diagram.id,
            projectId,
            ownerUserId,
            name: payload.diagram.name,
            visibility:
                payload.project?.visibility ??
                existing?.visibility ??
                'private',
            status: existing?.status ?? 'active',
            createdAt: existing?.createdAt ?? payload.diagram.createdAt,
            updatedAt: payload.diagram.updatedAt,
            document: payload.diagram,
        });

        const envelope = this.repository.getDiagramEnvelope(storedDiagram.id, {
            includeTables: true,
            includeRelationships: true,
            includeDependencies: true,
            includeAreas: true,
            includeCustomTypes: true,
            includeNotes: true,
        });

        if (!envelope) {
            throw new AppError(
                'Diagram could not be reloaded after save.',
                500,
                'diagram_reload_failed'
            );
        }

        return {
            project: envelope.project,
            diagram: this.toDiagramResponse(envelope.diagram),
        };
    }

    deleteDiagram(diagramId: string) {
        const deleted = this.repository.deleteDiagram(diagramId);
        if (!deleted) {
            throw new AppError('Diagram not found.', 404, 'diagram_not_found');
        }

        return { ok: true as const };
    }

    search(query: string) {
        return {
            items: this.repository.search(query),
        };
    }

    private ensureDefaultUser() {
        const existing = this.repository.getUser(this.env.defaultUser.id);
        const now = new Date().toISOString();
        const user: AppUserRecord = {
            id: this.env.defaultUser.id,
            email: this.env.defaultUser.email,
            displayName: this.env.defaultUser.name,
            authProvider: 'local-placeholder',
            status: 'active',
            isAdmin: true,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
        };

        this.repository.ensureUser(user);
    }

    private toDiagramResponse(envelope: DiagramEnvelope['diagram']) {
        return {
            ...envelope.document,
            projectId: envelope.projectId,
            ownerUserId: envelope.ownerUserId,
            visibility: envelope.visibility,
            status: envelope.status,
            version: envelope.version,
            checksum: envelope.checksum,
        };
    }
}
