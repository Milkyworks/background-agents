import { z } from "zod";
import { sessionRepositoriesInputSchema } from "./repositories";

/** Maximum characters in a project's display name. */
export const MAX_PROJECT_NAME_LENGTH = 200;
/** Maximum characters in a project's standing instructions (matches automation instructions). */
export const MAX_PROJECT_INSTRUCTIONS_LENGTH = 15_000;

/** Shape check for stable project ids (`proj_` + generated suffix). */
export function isProjectId(value: string): boolean {
  return /^proj_[A-Za-z0-9_-]+$/.test(value);
}

/**
 * The target a session in the project uses when its create request names none:
 * a saved environment or an ordered repository list. Null means no repository.
 */
export const projectDefaultTargetSchema = z.union([
  z.object({ environmentId: z.string().trim().min(1) }).strict(),
  z.object({ repositories: sessionRepositoriesInputSchema }).strict(),
]);
export type ProjectDefaultTarget = z.infer<typeof projectDefaultTargetSchema>;

export const createProjectInputSchema = z.object({
  name: z.string().trim().min(1).max(MAX_PROJECT_NAME_LENGTH),
  instructions: z.string().max(MAX_PROJECT_INSTRUCTIONS_LENGTH).optional(),
  defaultTarget: projectDefaultTargetSchema.nullish(),
  defaultModel: z.string().trim().min(1).nullish(),
});

export const updateProjectInputSchema = z.object({
  name: z.string().trim().min(1).max(MAX_PROJECT_NAME_LENGTH).optional(),
  instructions: z.string().max(MAX_PROJECT_INSTRUCTIONS_LENGTH).optional(),
  defaultTarget: projectDefaultTargetSchema.nullish(),
  defaultModel: z.string().trim().min(1).nullish(),
});

/** Move a session into a project, or out of one with `projectId: null`. */
export const setSessionProjectInputSchema = z.object({
  projectId: z.string().trim().min(1).nullable(),
});

export type CreateProjectInput = z.input<typeof createProjectInputSchema>;
export type UpdateProjectInput = z.input<typeof updateProjectInputSchema>;
export type SetSessionProjectInput = z.input<typeof setSessionProjectInputSchema>;

export interface Project {
  id: string;
  name: string;
  instructions: string;
  defaultTarget: ProjectDefaultTarget | null;
  defaultModel: string | null;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  archivedAt: number | null;
}

/** What a sandbox in a project session receives at boot. */
export interface SandboxProjectContext {
  project: { id: string; name: string; instructions: string } | null;
}
