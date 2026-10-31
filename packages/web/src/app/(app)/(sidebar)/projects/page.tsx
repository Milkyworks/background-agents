"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MAX_PROJECT_NAME_LENGTH, type Project } from "@open-inspect/shared/types/projects";
import { CollapsedSidebarControls, useSidebarContext } from "@/components/sidebar-layout";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FolderIcon, PlusIcon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { useCurrentUserAuthorization } from "@/hooks/use-current-user-authorization";
import { useProjects } from "@/hooks/use-projects";
import { browserApiFetch } from "@/lib/browser-api-fetch";

export default function ProjectsPage() {
  const { isOpen } = useSidebarContext();
  const router = useRouter();
  const { projects, loading, error, mutate } = useProjects();
  const { hasPermission } = useCurrentUserAuthorization();
  const canCreate = hasPermission("sessions.create");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await browserApiFetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = (await res.json()) as { project?: Project; error?: string };
      if (!res.ok || !data.project) {
        setCreateError(data.error ?? "Failed to create project");
        return;
      }
      setName("");
      await mutate();
      router.push(`/projects/${data.project.id}`);
    } catch {
      setCreateError("Failed to create project");
    } finally {
      setCreating(false);
    }
  };

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
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Projects</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              A project groups sessions and gives each of them standing instructions and a default
              target.
            </p>
          </div>

          {canCreate && (
            <form onSubmit={handleCreate} className="mb-6 flex gap-2">
              <Input
                aria-label="New project name"
                placeholder="New project name"
                value={name}
                maxLength={MAX_PROJECT_NAME_LENGTH}
                onChange={(event) => setName(event.target.value)}
                disabled={creating}
              />
              <Button type="submit" disabled={!name.trim() || creating}>
                <PlusIcon className="w-4 h-4" />
                Create
              </Button>
            </form>
          )}

          {createError && (
            <ErrorBanner className="mb-4" role="alert">
              {createError}
            </ErrorBanner>
          )}
          {error && (
            <ErrorBanner className="mb-4" role="alert">
              Failed to load projects.
            </ErrorBanner>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-current border-t-transparent text-muted-foreground" />
            </div>
          ) : projects.length === 0 && !error ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No projects yet.</p>
          ) : (
            <ul className="divide-y divide-border-muted border border-border-muted">
              {projects.map((project) => (
                <li key={project.id}>
                  <Link
                    href={`/projects/${project.id}`}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-muted"
                  >
                    <FolderIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="font-medium text-foreground truncate">{project.name}</div>
                      {project.instructions && (
                        <div className="text-sm text-muted-foreground truncate">
                          {project.instructions}
                        </div>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
