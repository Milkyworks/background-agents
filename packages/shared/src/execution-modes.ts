/**
 * Plan / Build execution mode catalog.
 *
 * Orthogonal to the agent harness axis (`harnesses.ts`): the harness selects
 * *which* agent runs a session, the execution mode selects *how much* it may
 * change the repo. `build` runs with full write access; `plan` must not write.
 * `writesAllowed` is the one declared fact both harnesses derive enforcement
 * from, so `plan` cannot come to mean two different things in two languages.
 */

import { z } from "zod";

export const EXECUTION_MODE_IDS = ["build", "plan"] as const;
export type ExecutionMode = (typeof EXECUTION_MODE_IDS)[number];
export const DEFAULT_EXECUTION_MODE: ExecutionMode = "build";
export const executionModeSchema = z.enum(EXECUTION_MODE_IDS);

export interface ExecutionModeCapabilities {
  /** User-facing name. */
  readonly label: string;
  readonly description: string;
  readonly writesAllowed: boolean;
}

export const EXECUTION_MODE_CATALOG = {
  build: {
    label: "Build",
    description: "Full write access; the agent may edit the repo.",
    writesAllowed: true,
  },
  plan: {
    label: "Plan",
    description: "Read-only; the agent plans without touching the repo.",
    writesAllowed: false,
  },
} as const satisfies Record<ExecutionMode, ExecutionModeCapabilities>;

export function isValidExecutionMode(value: unknown): value is ExecutionMode {
  return typeof value === "string" && (EXECUTION_MODE_IDS as readonly string[]).includes(value);
}

/** Resolve an execution mode from an optional wire value; absent means build. */
export function getValidExecutionModeOrDefault(value: string | null | undefined): ExecutionMode {
  return isValidExecutionMode(value) ? value : DEFAULT_EXECUTION_MODE;
}
