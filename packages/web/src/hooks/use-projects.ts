import useSWR from "swr";
import { useAuthSession } from "@/lib/auth-session";
import type { Project } from "@open-inspect/shared/types/projects";

export const PROJECTS_KEY = "/api/projects";

export function projectKey(projectId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}`;
}

export function projectSessionsKey(projectId: string): string {
  return `${projectKey(projectId)}/sessions`;
}

export function sessionProjectKey(sessionId: string): string {
  return `/api/sessions/${encodeURIComponent(sessionId)}/project`;
}

/** The fields of a session that a project page lists. */
export interface ProjectSessionSummary {
  id: string;
  title: string | null;
  status: string;
  repoOwner: string | null;
  repoName: string | null;
  updatedAt: number;
}

export function useProjects() {
  const { data: session, status } = useAuthSession();
  const { data, isLoading, error, mutate } = useSWR<{ projects: Project[] }>(
    session ? PROJECTS_KEY : null
  );
  return {
    projects: data?.projects ?? [],
    // Gated on the auth session, so the list is loading while the session resolves.
    loading: status === "loading" || isLoading,
    error,
    mutate,
  };
}

export function useProject(projectId: string | null) {
  const { data: session } = useAuthSession();
  const { data, isLoading, error, mutate } = useSWR<{ project: Project }>(
    session && projectId ? projectKey(projectId) : null
  );
  return { project: data?.project ?? null, loading: isLoading, error, mutate };
}

export function useProjectSessions(projectId: string | null) {
  const { data: session } = useAuthSession();
  const { data, isLoading, error, mutate } = useSWR<{ sessions: ProjectSessionSummary[] }>(
    session && projectId ? projectSessionsKey(projectId) : null
  );
  return { sessions: data?.sessions ?? [], loading: isLoading, error, mutate };
}

export function useSessionProject(sessionId: string | null) {
  const { data: session } = useAuthSession();
  const { data, isLoading, error, mutate } = useSWR<{ projectId: string | null }>(
    session && sessionId ? sessionProjectKey(sessionId) : null
  );
  return { projectId: data?.projectId ?? null, loading: isLoading, error, mutate };
}
