import {
  EXECUTION_MODE_CATALOG,
  getValidExecutionModeOrDefault,
  type ExecutionMode,
} from "@open-inspect/shared/execution-modes";
import { EXECUTION_MODE_MINIMUM_GENERATION } from "../sandbox/runtime-manifest";
import { parseRuntimeVersionNumber } from "../image-builds/model";

/** A plan prompt the sandbox cannot honour: rejected, never silently downgraded. */
export class ExecutionModeNotSupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExecutionModeNotSupportedError";
  }
}

/**
 * Fail closed when a read-only turn cannot be enforced. `build` always
 * passes; `plan` requires a sandbox runtime at or above the floor, because
 * an older bridge ignores the field and would run with write access while
 * the UI promises read-only.
 */
export function assertExecutionModeSupported(
  mode: ExecutionMode,
  runtimeVersion: string | null
): void {
  if (EXECUTION_MODE_CATALOG[getValidExecutionModeOrDefault(mode)].writesAllowed) return;
  const generation = runtimeVersion === null ? null : parseRuntimeVersionNumber(runtimeVersion);
  if (generation === null || generation < EXECUTION_MODE_MINIMUM_GENERATION) {
    throw new ExecutionModeNotSupportedError(
      `Plan mode requires sandbox runtime generation ${EXECUTION_MODE_MINIMUM_GENERATION} or newer` +
        (runtimeVersion ? ` (running ${runtimeVersion})` : " (no sandbox runtime reported)") +
        ". Rebuild the sandbox image; the prompt was rejected, not run with write access."
    );
  }
}
