/**
 * Project routes over serviceFetch: CRUD, creator-or-admin updates, moving a
 * session into a project, listing a project's sessions, and the sandbox
 * context endpoint that delivers standing instructions to the sandbox.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { SELF, env } from "cloudflare:test";
import { ProjectStore } from "../../src/db/projects";
import { SessionIndexStore } from "../../src/db/session-index";
import { cleanD1Tables } from "./cleanup";
import { initNamedSessionDO, seedSandboxAuthHash, serviceFetch } from "./helpers";

const BASE = "https://test.local";

async function createProject(body: Record<string, unknown>): Promise<Response> {
  return serviceFetch(`${BASE}/projects`, { method: "POST", body: JSON.stringify(body) });
}

async function seedSessionRow(id: string, projectId: string | null = null): Promise<void> {
  const now = Date.now();
  await new SessionIndexStore(env.DB).create({
    id,
    title: id,
    repoOwner: "acme",
    repoName: "web-app",
    model: "anthropic/claude-haiku-4-5",
    reasoningEffort: null,
    baseBranch: "main",
    status: "created",
    projectId,
    createdAt: now,
    updatedAt: now,
  });
}

describe("project routes", () => {
  beforeEach(cleanD1Tables);

  it("creates, lists, reads, updates and archives a project", async () => {
    const created = await createProject({
      name: "Payments",
      instructions: "Always run the payments test suite.",
      defaultTarget: { environmentId: "env_payments" },
    });
    expect(created.status).toBe(201);
    const { project } = await created.json<{ project: { id: string; createdBy: string } }>();
    expect(project.id).toMatch(/^proj_/);

    const list = await serviceFetch(`${BASE}/projects`);
    const listed = await list.json<{ projects: { id: string; name: string }[] }>();
    expect(listed.projects.map((p) => p.name)).toEqual(["Payments"]);

    const patched = await serviceFetch(`${BASE}/projects/${project.id}`, {
      method: "PATCH",
      body: JSON.stringify({ instructions: "Run the full suite.", defaultTarget: null }),
    });
    expect(patched.status).toBe(200);
    const { project: updated } = await patched.json<{
      project: { instructions: string; defaultTarget: unknown };
    }>();
    expect(updated.instructions).toBe("Run the full suite.");
    expect(updated.defaultTarget).toBeNull();

    const archived = await serviceFetch(`${BASE}/projects/${project.id}/archive`, {
      method: "POST",
    });
    expect(archived.status).toBe(200);
    const afterArchive = await (
      await serviceFetch(`${BASE}/projects`)
    ).json<{
      projects: unknown[];
    }>();
    expect(afterArchive.projects).toEqual([]);
    const withArchived = await (
      await serviceFetch(`${BASE}/projects?includeArchived=true`)
    ).json<{ projects: unknown[] }>();
    expect(withArchived.projects).toHaveLength(1);
  });

  it("rejects invalid input", async () => {
    expect((await createProject({ name: "" })).status).toBe(400);
    expect(
      (await createProject({ name: "X", defaultTarget: { environmentId: "a", repositories: [] } }))
        .status
    ).toBe(400);
    expect((await serviceFetch(`${BASE}/projects/proj_missing`)).status).toBe(404);
  });

  async function seedOtherUsersProject(): Promise<void> {
    const now = Date.now();
    await new ProjectStore(env.DB).create({
      id: "proj_other",
      name: "Someone else's",
      instructions: "",
      default_target_json: null,
      default_model: null,
      created_by: "99999999999999999999999999999999",
      created_at: now,
      updated_at: now,
      archived_at: null,
    });
  }

  it("refuses changes from a member who did not create the project", async () => {
    await seedOtherUsersProject();
    const asMember = await serviceFetch(`${BASE}/projects/proj_other`, {
      method: "PATCH",
      body: JSON.stringify({ name: "Renamed" }),
      initialUserRole: "member",
    });
    expect(asMember.status).toBe(403);
    const archive = await serviceFetch(`${BASE}/projects/proj_other/archive`, {
      method: "POST",
      initialUserRole: "member",
    });
    expect(archive.status).toBe(403);
  });

  it("allows an owner to change any project", async () => {
    await seedOtherUsersProject();
    const asOwner = await serviceFetch(`${BASE}/projects/proj_other`, {
      method: "PATCH",
      body: JSON.stringify({ name: "Renamed" }),
    });
    expect(asOwner.status).toBe(200);
  });

  it("moves sessions into a project and lists them", async () => {
    const { project } = await (
      await createProject({ name: "Web" })
    ).json<{
      project: { id: string };
    }>();
    await seedSessionRow("session-in");
    await seedSessionRow("session-out");

    const moved = await serviceFetch(`${BASE}/sessions/session-in/project`, {
      method: "PUT",
      body: JSON.stringify({ projectId: project.id }),
    });
    expect(moved.status).toBe(200);
    const current = await serviceFetch(`${BASE}/sessions/session-in/project`);
    await expect(current.json()).resolves.toEqual({
      sessionId: "session-in",
      projectId: project.id,
    });
    expect((await serviceFetch(`${BASE}/sessions/missing/project`)).status).toBe(404);

    const sessions = await (
      await serviceFetch(`${BASE}/projects/${project.id}/sessions`)
    ).json<{ sessions: { id: string; projectId: string | null }[] }>();
    expect(sessions.sessions.map((s) => s.id)).toEqual(["session-in"]);
    expect(sessions.sessions[0].projectId).toBe(project.id);

    const unknownProject = await serviceFetch(`${BASE}/sessions/session-out/project`, {
      method: "PUT",
      body: JSON.stringify({ projectId: "proj_missing" }),
    });
    expect(unknownProject.status).toBe(404);

    const removed = await serviceFetch(`${BASE}/sessions/session-in/project`, {
      method: "PUT",
      body: JSON.stringify({ projectId: null }),
    });
    expect(removed.status).toBe(200);
    const after = await (
      await serviceFetch(`${BASE}/projects/${project.id}/sessions`)
    ).json<{ sessions: unknown[] }>();
    expect(after.sessions).toEqual([]);
  });

  it("serves the project's instructions to the session's sandbox only", async () => {
    const { project } = await (
      await createProject({ name: "Docs", instructions: "Write in British English." })
    ).json<{ project: { id: string } }>();
    await seedSessionRow("project-session", project.id);
    await seedSessionRow("plain-session");

    const { stub } = await initNamedSessionDO("project-session");
    await seedSandboxAuthHash(stub, { authToken: "project-token", sandboxId: "sandbox-p" });
    const response = await SELF.fetch(`${BASE}/sessions/project-session/sandbox-project-context`, {
      headers: { Authorization: "Bearer project-token" },
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      project: { id: project.id, name: "Docs", instructions: "Write in British English." },
    });

    const wrongSession = await SELF.fetch(
      `${BASE}/sessions/plain-session/sandbox-project-context`,
      { headers: { Authorization: "Bearer project-token" } }
    );
    expect(wrongSession.status).toBe(401);

    const { stub: plainStub } = await initNamedSessionDO("plain-session");
    await seedSandboxAuthHash(plainStub, { authToken: "plain-token", sandboxId: "sandbox-q" });
    const plain = await SELF.fetch(`${BASE}/sessions/plain-session/sandbox-project-context`, {
      headers: { Authorization: "Bearer plain-token" },
    });
    await expect(plain.json()).resolves.toEqual({ project: null });
  });
});
