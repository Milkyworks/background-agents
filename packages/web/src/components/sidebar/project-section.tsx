"use client";

import { useState } from "react";
import Link from "next/link";
import { mutate as globalMutate } from "swr";
import { FolderIcon } from "@/components/ui/icons";
import { projectSessionsKey, useProjects, useSessionProject } from "@/hooks/use-projects";
import { browserApiFetch } from "@/lib/browser-api-fetch";

const NO_PROJECT = "";

interface ProjectSectionProps {
  sessionId: string;
  canChange: boolean;
}

/** Shows the session's project and, with lifecycle access, moves it into another one. */
export function ProjectSection({ sessionId, canChange }: ProjectSectionProps) {
  const { projects } = useProjects();
  const { projectId, loading, mutate } = useSessionProject(sessionId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = projects.find((project) => project.id === projectId) ?? null;

  const handleChange = async (nextProjectId: string) => {
    const next = nextProjectId === NO_PROJECT ? null : nextProjectId;
    if (next === projectId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await browserApiFetch(`/api/sessions/${encodeURIComponent(sessionId)}/project`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: next }),
      });
      if (!res.ok) {
        setError("Could not move this session");
        return;
      }
      const previous = projectId;
      await mutate({ projectId: next }, { revalidate: false });
      for (const id of [previous, next]) {
        if (id) void globalMutate(projectSessionsKey(id));
      }
    } catch {
      setError("Could not move this session");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;
  if (!canChange && !current) return null;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <FolderIcon className="h-4 w-4" />
        <span className="font-medium">Project</span>
      </div>
      {canChange ? (
        <select
          aria-label="Project"
          className="flex h-8 w-full rounded-sm border border-border bg-input px-2 text-sm text-foreground"
          value={projectId ?? NO_PROJECT}
          onChange={(event) => void handleChange(event.target.value)}
          disabled={saving}
        >
          <option value={NO_PROJECT}>No project</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      ) : null}
      {current && (
        <Link
          href={`/projects/${current.id}`}
          className="block text-sm text-foreground hover:underline"
        >
          {canChange ? "Open project" : current.name}
        </Link>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
