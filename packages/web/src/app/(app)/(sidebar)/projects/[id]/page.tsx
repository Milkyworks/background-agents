"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  MAX_PROJECT_INSTRUCTIONS_LENGTH,
  type Project,
  type ProjectDefaultTarget,
} from "@open-inspect/shared/types/projects";
import { CollapsedSidebarControls, useSidebarContext } from "@/components/sidebar-layout";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { PlusIcon } from "@/components/ui/icons";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useEnvironments } from "@/hooks/use-environments";
import { PROJECTS_KEY, useProject, useProjectSessions } from "@/hooks/use-projects";
import { browserApiFetch } from "@/lib/browser-api-fetch";
import { formatRelativeTime } from "@/lib/time";
import { mutate as globalMutate } from "swr";

const NO_ENVIRONMENT = "";

function describeDefaultTarget(target: ProjectDefaultTarget | null): string | null {
  if (!target || "environmentId" in target) return null;
  return target.repositories
    .map((repository) => `${repository.repoOwner}/${repository.repoName}`)
    .join(", ");
}

export default function ProjectDetailPage() {
  const { isOpen } = useSidebarContext();
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const { project, loading, error, mutate } = useProject(projectId);
  const { sessions, loading: sessionsLoading } = useProjectSessions(projectId);
  const { environments } = useEnvironments();

  const [instructions, setInstructions] = useState("");
  const [environmentId, setEnvironmentId] = useState(NO_ENVIRONMENT);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!project) return;
    setInstructions(project.instructions);
    setEnvironmentId(
      project.defaultTarget && "environmentId" in project.defaultTarget
        ? project.defaultTarget.environmentId
        : NO_ENVIRONMENT
    );
  }, [project]);

  const repositoriesDefault = project ? describeDefaultTarget(project.defaultTarget) : null;

  const send = async (path: `/api/${string}`, init: RequestInit): Promise<Project | null> => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await browserApiFetch(path, {
        ...init,
        headers: { "Content-Type": "application/json" },
      });
      const data = (await res.json()) as { project?: Project; error?: string };
      if (!res.ok || !data.project) {
        setSaveError(data.error ?? "Failed to save project");
        return null;
      }
      await mutate({ project: data.project }, { revalidate: false });
      void globalMutate(PROJECTS_KEY);
      return data.project;
    } catch {
      setSaveError("Failed to save project");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!project) return;
    const saved = await send(`/api/projects/${encodeURIComponent(project.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        instructions,
        // Leave a repository default set through the API alone unless an
        // environment replaces it here.
        ...(repositoriesDefault !== null && environmentId === NO_ENVIRONMENT
          ? {}
          : { defaultTarget: environmentId ? { environmentId } : null }),
      }),
    });
    if (saved) setSavedAt(Date.now());
  };

  const handleArchiveToggle = async () => {
    if (!project) return;
    const action = project.archivedAt ? "unarchive" : "archive";
    await send(`/api/projects/${encodeURIComponent(project.id)}/${action}`, {
      method: "POST",
      body: "{}",
    });
  };

  const dirty =
    !!project &&
    (instructions !== project.instructions ||
      environmentId !==
        (project.defaultTarget && "environmentId" in project.defaultTarget
          ? project.defaultTarget.environmentId
          : NO_ENVIRONMENT));

  return (
    <div className="h-full flex flex-col">
      {!isOpen && (
        <header className="border-b border-border-muted flex-shrink-0">
          <div className="px-4 py-3">
            <CollapsedSidebarControls />
          </div>
        </header>
      )}

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-3xl mx-auto">
          <Link href="/projects" className="text-sm text-muted-foreground hover:text-foreground">
            Projects
          </Link>

          {error && (
            <ErrorBanner className="my-4" role="alert">
              Failed to load this project.
            </ErrorBanner>
          )}

          {loading || !project ? (
            !error && (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-current border-t-transparent text-muted-foreground" />
              </div>
            )
          ) : (
            <>
              <div className="mt-2 mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
                  {project.name}
                  {project.archivedAt && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">Archived</span>
                  )}
                </h1>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleArchiveToggle}
                    disabled={saving}
                  >
                    {project.archivedAt ? "Unarchive" : "Archive"}
                  </Button>
                  {!project.archivedAt && (
                    <Button size="sm" asChild>
                      <Link
                        href={`/?project=${encodeURIComponent(project.id)}`}
                        className="flex items-center gap-1.5"
                      >
                        <PlusIcon className="w-4 h-4" />
                        New session
                      </Link>
                    </Button>
                  )}
                </div>
              </div>

              {saveError && (
                <ErrorBanner className="mb-4" role="alert">
                  {saveError}
                </ErrorBanner>
              )}

              <section className="mb-8 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="project-instructions">Instructions</Label>
                  <p className="text-sm text-muted-foreground">
                    Every session in this project starts with these instructions.
                  </p>
                  <Textarea
                    id="project-instructions"
                    rows={8}
                    value={instructions}
                    maxLength={MAX_PROJECT_INSTRUCTIONS_LENGTH}
                    onChange={(event) => setInstructions(event.target.value)}
                    disabled={saving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="project-environment">Default environment</Label>
                  <select
                    id="project-environment"
                    className="flex h-9 w-full rounded-sm border border-border bg-input px-3 text-sm text-foreground"
                    value={environmentId}
                    onChange={(event) => setEnvironmentId(event.target.value)}
                    disabled={saving}
                  >
                    <option value={NO_ENVIRONMENT}>
                      {repositoriesDefault ? `Repositories: ${repositoriesDefault}` : "None"}
                    </option>
                    {environments.map((environment) => (
                      <option key={environment.id} value={environment.id}>
                        {environment.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-sm text-muted-foreground">
                    Used when a session in this project is started without choosing a target.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <Button onClick={handleSave} disabled={!dirty || saving}>
                    {saving ? "Saving..." : "Save"}
                  </Button>
                  {savedAt && !dirty && (
                    <span className="text-sm text-muted-foreground">Saved</span>
                  )}
                </div>
              </section>

              <section>
                <h2 className="mb-3 text-lg font-semibold text-foreground">Sessions</h2>
                {sessionsLoading ? null : sessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No sessions yet. Start one here, or move an existing session into this project
                    from its sidebar.
                  </p>
                ) : (
                  <ul className="divide-y divide-border-muted border border-border-muted">
                    {sessions.map((session) => (
                      <li key={session.id}>
                        <Link
                          href={`/session/${session.id}`}
                          className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted"
                        >
                          <span className="min-w-0 truncate text-foreground">
                            {session.title || "Untitled session"}
                          </span>
                          <span className="flex-shrink-0 text-sm text-muted-foreground">
                            {formatRelativeTime(session.updatedAt)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
