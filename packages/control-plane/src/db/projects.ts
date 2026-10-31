/**
 * ProjectStore — D1 persistence for projects (phase 1 of the projects model).
 *
 * A project groups sessions and gives them standing instructions and a default
 * target. Snake_case rows in the database, camelCase at the API boundary, the
 * same split as EnvironmentStore.
 */

import {
  projectDefaultTargetSchema,
  type Project,
  type ProjectDefaultTarget,
} from "@open-inspect/shared/types/projects";
import type { SqlDatabase } from "./sql-database";

export interface ProjectRow {
  id: string;
  name: string;
  instructions: string;
  default_target_json: string | null;
  default_model: string | null;
  created_by: string;
  created_at: number;
  updated_at: number;
  archived_at: number | null;
}

/** Parse the stored default target, treating unreadable JSON as no default. */
export function parseProjectDefaultTarget(json: string | null): ProjectDefaultTarget | null {
  if (!json) return null;
  try {
    const parsed = projectDefaultTargetSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function serializeProjectDefaultTarget(
  target: ProjectDefaultTarget | null | undefined
): string | null {
  return target ? JSON.stringify(target) : null;
}

export function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    instructions: row.instructions,
    defaultTarget: parseProjectDefaultTarget(row.default_target_json),
    defaultModel: row.default_model,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  };
}

/** The mutable columns of a project row. */
export type ProjectScalarFields = Partial<
  Pick<ProjectRow, "name" | "instructions" | "default_target_json" | "default_model">
>;

const MUTABLE_COLUMNS = [
  "name",
  "instructions",
  "default_target_json",
  "default_model",
] as const satisfies readonly (keyof ProjectScalarFields)[];

export class ProjectStore {
  constructor(private readonly db: SqlDatabase) {}

  async create(row: ProjectRow): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO projects
         (id, name, instructions, default_target_json, default_model, created_by, created_at, updated_at, archived_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        row.id,
        row.name,
        row.instructions,
        row.default_target_json,
        row.default_model,
        row.created_by,
        row.created_at,
        row.updated_at,
        row.archived_at
      )
      .run();
  }

  async getById(id: string): Promise<ProjectRow | null> {
    return this.db.prepare("SELECT * FROM projects WHERE id = ?").bind(id).first<ProjectRow>();
  }

  /** Active projects first by most recent update; archived ones only when asked. */
  async list(options: { includeArchived?: boolean } = {}): Promise<ProjectRow[]> {
    const where = options.includeArchived ? "" : "WHERE archived_at IS NULL";
    const result = await this.db
      .prepare(`SELECT * FROM projects ${where} ORDER BY updated_at DESC`)
      .all<ProjectRow>();
    return result.results || [];
  }

  /** Apply the given fields and bump updated_at. Returns the refreshed row, or null if gone. */
  async update(id: string, fields: ProjectScalarFields): Promise<ProjectRow | null> {
    const setClauses: string[] = [];
    const params: unknown[] = [];
    for (const column of MUTABLE_COLUMNS) {
      if (column in fields) {
        setClauses.push(`${column} = ?`);
        params.push(fields[column] as unknown);
      }
    }
    setClauses.push("updated_at = ?");
    params.push(Date.now(), id);
    await this.db
      .prepare(`UPDATE projects SET ${setClauses.join(", ")} WHERE id = ?`)
      .bind(...params)
      .run();
    return this.getById(id);
  }

  /** Archive (archived = true) or restore a project. Returns the refreshed row, or null if gone. */
  async setArchived(id: string, archived: boolean): Promise<ProjectRow | null> {
    const now = Date.now();
    await this.db
      .prepare("UPDATE projects SET archived_at = ?, updated_at = ? WHERE id = ?")
      .bind(archived ? now : null, now, id)
      .run();
    return this.getById(id);
  }

  /** Record (or clear) the project a session belongs to. Returns false when the session is unknown. */
  async setSessionProject(sessionId: string, projectId: string | null): Promise<boolean> {
    const result = await this.db
      .prepare("UPDATE sessions SET project_id = ? WHERE id = ?")
      .bind(projectId, sessionId)
      .run();
    return result.meta.changes > 0;
  }

  /** The project id a session belongs to; undefined when the session is unknown. */
  async getSessionProjectId(sessionId: string): Promise<string | null | undefined> {
    const row = await this.db
      .prepare("SELECT project_id FROM sessions WHERE id = ?")
      .bind(sessionId)
      .first<{ project_id: string | null }>();
    return row ? row.project_id : undefined;
  }

  /** The project a session belongs to, or null. */
  async getProjectForSession(sessionId: string): Promise<ProjectRow | null> {
    return this.db
      .prepare(
        `SELECT projects.* FROM sessions
         JOIN projects ON projects.id = sessions.project_id
         WHERE sessions.id = ?`
      )
      .bind(sessionId)
      .first<ProjectRow>();
  }
}
