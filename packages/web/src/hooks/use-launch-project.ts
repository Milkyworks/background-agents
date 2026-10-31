"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Project } from "@open-inspect/shared/types/projects";
import type { SessionTargetSelection } from "@/hooks/use-session-target-picker";
import { useProject } from "@/hooks/use-projects";
import { environmentOptionValue } from "@/lib/session-target";

export const LAUNCH_PROJECT_QUERY_PARAM = "project";

/**
 * The project a new session will join, chosen by `/?project=<id>` (the "New
 * session" button on a project page). Once the project loads, its default
 * target is applied to the picker a single time; the user can still change it.
 */
export function useLaunchProject(picker: SessionTargetSelection): {
  project: Project | null;
  clear: () => void;
} {
  const [projectId, setProjectId] = useState<string | null>(null);
  const appliedRef = useRef<string | null>(null);

  // Read the query once on mount rather than through useSearchParams, which
  // would force the home page into a Suspense boundary.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get(LAUNCH_PROJECT_QUERY_PARAM);
    if (id) setProjectId(id);
  }, []);

  const { project } = useProject(projectId);
  const activeProject = project && !project.archivedAt ? project : null;

  const { sessionTarget, repos, loadingRepos, pickerProps } = picker;
  useEffect(() => {
    // Wait for the picker to settle its own restored target, then override it.
    if (!activeProject || !sessionTarget || appliedRef.current === activeProject.id) return;
    const target = activeProject.defaultTarget;
    if (target && "repositories" in target && loadingRepos) return;
    appliedRef.current = activeProject.id;
    if (!target) return;
    if ("environmentId" in target) {
      pickerProps.onTargetSelectValueChange(environmentOptionValue(target.environmentId));
      return;
    }
    const fullNames = target.repositories.flatMap((repository) => {
      const wanted = `${repository.repoOwner}/${repository.repoName}`.toLowerCase();
      const match = repos.find((repo) => repo.fullName.toLowerCase() === wanted);
      return match ? [match.fullName] : [];
    });
    if (fullNames.length === 1) pickerProps.onTargetSelectValueChange(fullNames[0]);
    else if (fullNames.length > 1) pickerProps.onMultiSelectionChange(fullNames);
  }, [activeProject, sessionTarget, repos, loadingRepos, pickerProps]);

  const clear = useCallback(() => {
    setProjectId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete(LAUNCH_PROJECT_QUERY_PARAM);
    window.history.replaceState(null, "", url.toString());
  }, []);

  return { project: activeProject, clear };
}
