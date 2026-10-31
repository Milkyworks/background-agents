/**
 * Project routes (phase 1 of the projects model).
 *
 * A project groups sessions and gives each one standing instructions and a
 * default target. Projects are workspace resources like sessions: anyone with
 * session read access sees them, anyone who can create sessions can create a
 * project, and a project is changed by its creator or by an administrator.
 */

import { Hono } from "hono";
import type { EffectiveAuthorization } from "@open-inspect/shared/rbac";
import {
  createProjectInputSchema,
  setSessionProjectInputSchema,
  updateProjectInputSchema,
  type SandboxProjectContext,
} from "@open-inspect/shared/types/projects";
import { parseBody } from "./body";
import { admit, dispatch } from "../routing/admit";
import type { ControlPlaneHonoEnv } from "../routing/hono-env";
import { generateId } from "../auth/crypto";
import {
  ProjectStore,
  serializeProjectDefaultTarget,
  toProject,
  type ProjectRow,
  type ProjectScalarFields,
} from "../db/projects";
import { SessionIndexStore } from "../db/session-index";
import { createLogger } from "../logger";
import type { Env } from "../types";
import {
  error,
  json,
  NO_AUTHORIZATION,
  requirePermission,
  SCM_AGNOSTIC_HUMAN_USER_ROUTE,
  SCM_AGNOSTIC_SANDBOX_ROUTE,
  type SandboxRouteContext,
  type UserRouteContext,
} from "./shared";

const logger = createLogger("router:projects");

/** Upper bound on sessions returned for one project page. */
const MAX_PROJECT_SESSIONS_PAGE = 100;

/**
 * A project is changed by its creator, or by anyone who can bulk-archive
 * sessions (the Owner and Administrator roles).
 */
export function canManageProject(
  project: Pick<ProjectRow, "created_by">,
  authorization: Pick<EffectiveAuthorization, "userId" | "permissions"> | undefined
): boolean {
  if (!authorization) return false;
  return (
    authorization.userId === project.created_by ||
    authorization.permissions.includes("sessions.bulk_archive")
  );
}

async function handleListProjects(
  request: Request,
  _env: Env,
  _params: object,
  ctx: UserRouteContext
): Promise<Response> {
  const includeArchived = new URL(request.url).searchParams.get("includeArchived") === "true";
  const rows = await new ProjectStore(ctx.db).list({ includeArchived });
  return json({ projects: rows.map(toProject) });
}

async function handleCreateProject(
  request: Request,
  _env: Env,
  _params: object,
  ctx: UserRouteContext
): Promise<Response> {
  const parsed = await parseBody(request, createProjectInputSchema);
  if (parsed instanceof Response) return parsed;

  const createdBy = ctx.authorization?.userId;
  if (!createdBy) return error("A signed-in user is required to create a project", 403);

  const now = Date.now();
  const row: ProjectRow = {
    id: `proj_${generateId()}`,
    name: parsed.name,
    instructions: parsed.instructions ?? "",
    default_target_json: serializeProjectDefaultTarget(parsed.defaultTarget),
    default_model: parsed.defaultModel ?? null,
    created_by: createdBy,
    created_at: now,
    updated_at: now,
    archived_at: null,
  };
  await new ProjectStore(ctx.db).create(row);

  logger.info("project.created", {
    event: "project.created",
    project_id: row.id,
    request_id: ctx.request_id,
    trace_id: ctx.trace_id,
  });
  return json({ project: toProject(row) }, 201);
}

async function handleGetProject(
  _request: Request,
  _env: Env,
  params: { id: string },
  ctx: UserRouteContext
): Promise<Response> {
  const row = await new ProjectStore(ctx.db).getById(params.id);
  if (!row) return error("Project not found", 404);
  return json({ project: toProject(row) });
}

async function handleUpdateProject(
  request: Request,
  _env: Env,
  params: { id: string },
  ctx: UserRouteContext
): Promise<Response> {
  const store = new ProjectStore(ctx.db);
  const existing = await store.getById(params.id);
  if (!existing) return error("Project not found", 404);
  if (!canManageProject(existing, ctx.authorization)) {
    return error("Only the project's creator or an administrator can change it", 403);
  }

  const parsed = await parseBody(request, updateProjectInputSchema);
  if (parsed instanceof Response) return parsed;

  const fields: ProjectScalarFields = {};
  if (parsed.name !== undefined) fields.name = parsed.name;
  if (parsed.instructions !== undefined) fields.instructions = parsed.instructions;
  if (parsed.defaultTarget !== undefined) {
    fields.default_target_json = serializeProjectDefaultTarget(parsed.defaultTarget);
  }
  if (parsed.defaultModel !== undefined) fields.default_model = parsed.defaultModel;

  const updated = await store.update(params.id, fields);
  if (!updated) return error("Project not found", 404);
  return json({ project: toProject(updated) });
}

function archiveHandler(archived: boolean) {
  return async function handleSetArchived(
    _request: Request,
    _env: Env,
    params: { id: string },
    ctx: UserRouteContext
  ): Promise<Response> {
    const store = new ProjectStore(ctx.db);
    const existing = await store.getById(params.id);
    if (!existing) return error("Project not found", 404);
    if (!canManageProject(existing, ctx.authorization)) {
      return error("Only the project's creator or an administrator can change it", 403);
    }
    const updated = await store.setArchived(params.id, archived);
    if (!updated) return error("Project not found", 404);
    return json({ project: toProject(updated) });
  };
}

async function handleListProjectSessions(
  request: Request,
  _env: Env,
  params: { id: string },
  ctx: UserRouteContext
): Promise<Response> {
  const project = await new ProjectStore(ctx.db).getById(params.id);
  if (!project) return error("Project not found", 404);

  const url = new URL(request.url);
  const limit = Math.min(
    Math.max(Number.parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 1),
    MAX_PROJECT_SESSIONS_PAGE
  );
  const offset = Math.max(Number.parseInt(url.searchParams.get("offset") ?? "0", 10) || 0, 0);

  const result = await new SessionIndexStore(ctx.db).list({
    projectId: project.id,
    excludeStatus: "archived",
    limit,
    offset,
    viewerUserId: ctx.authorization?.userId,
  });
  return json(result);
}

async function handleSetSessionProject(
  request: Request,
  _env: Env,
  params: { id: string },
  ctx: UserRouteContext
): Promise<Response> {
  const parsed = await parseBody(request, setSessionProjectInputSchema);
  if (parsed instanceof Response) return parsed;

  const store = new ProjectStore(ctx.db);
  if (parsed.projectId !== null) {
    const project = await store.getById(parsed.projectId);
    if (!project || project.archived_at !== null) return error("Project not found", 404);
  }
  const updated = await store.setSessionProject(params.id, parsed.projectId);
  if (!updated) return error("Session not found", 404);
  return json({ sessionId: params.id, projectId: parsed.projectId });
}

async function handleGetSessionProject(
  _request: Request,
  _env: Env,
  params: { id: string },
  ctx: UserRouteContext
): Promise<Response> {
  const projectId = await new ProjectStore(ctx.db).getSessionProjectId(params.id);
  if (projectId === undefined) return error("Session not found", 404);
  return json({ sessionId: params.id, projectId });
}

/** What a sandbox needs at boot: the project's name and standing instructions. */
async function handleSandboxProjectContext(
  _request: Request,
  _env: Env,
  params: { id: string },
  ctx: SandboxRouteContext
): Promise<Response> {
  const project = await new ProjectStore(ctx.db).getProjectForSession(params.id);
  const body: SandboxProjectContext = {
    project: project
      ? { id: project.id, name: project.name, instructions: project.instructions }
      : null,
  };
  const response = json(body);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

const READ = admit({
  ...SCM_AGNOSTIC_HUMAN_USER_ROUTE,
  authorization: requirePermission("sessions.read"),
});
const CREATE = admit({
  ...SCM_AGNOSTIC_HUMAN_USER_ROUTE,
  authorization: requirePermission("sessions.create"),
});
const LIFECYCLE = admit({
  ...SCM_AGNOSTIC_HUMAN_USER_ROUTE,
  authorization: requirePermission("sessions.lifecycle"),
});

export const projectRoutes = new Hono<ControlPlaneHonoEnv>();

projectRoutes.get("/projects", READ, (c) => dispatch(c, handleListProjects));
projectRoutes.post("/projects", CREATE, (c) => dispatch(c, handleCreateProject));
projectRoutes.get("/projects/:id", READ, (c) => dispatch(c, handleGetProject));
projectRoutes.patch("/projects/:id", CREATE, (c) => dispatch(c, handleUpdateProject));
projectRoutes.post("/projects/:id/archive", CREATE, (c) => dispatch(c, archiveHandler(true)));
projectRoutes.post("/projects/:id/unarchive", CREATE, (c) => dispatch(c, archiveHandler(false)));
projectRoutes.get("/projects/:id/sessions", READ, (c) => dispatch(c, handleListProjectSessions));
projectRoutes.get("/sessions/:id/project", READ, (c) => dispatch(c, handleGetSessionProject));
projectRoutes.put("/sessions/:id/project", LIFECYCLE, (c) => dispatch(c, handleSetSessionProject));
projectRoutes.get(
  "/sessions/:id/sandbox-project-context",
  admit({ ...SCM_AGNOSTIC_SANDBOX_ROUTE, authorization: NO_AUTHORIZATION }),
  (c) => dispatch(c, handleSandboxProjectContext)
);
