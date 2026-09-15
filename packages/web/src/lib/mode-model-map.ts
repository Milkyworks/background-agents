import {
  EXECUTION_MODE_IDS,
  isValidExecutionMode,
  type ExecutionMode,
} from "@open-inspect/shared/execution-modes";
import { harnessSupportsModel, type HarnessId } from "@open-inspect/shared/harnesses";
import { isValidModel, type ModelCategory } from "@open-inspect/shared/models";
import { resolveHarnessModelSelection } from "@/lib/session-harness";
import type { ModelPreference } from "@/lib/model-selection";

export const MODE_MODEL_MAP_STORAGE_KEY = "open-inspect-mode-model-map";

export type ModeModelMap = Partial<Record<ExecutionMode, ModelPreference>>;

function isModelPreference(value: unknown): value is ModelPreference {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { model?: unknown; reasoningEffort?: unknown };
  if (typeof candidate.model !== "string") return false;
  return candidate.reasoningEffort === undefined || typeof candidate.reasoningEffort === "string";
}

/** Remembered model per execution mode; tolerant of missing storage or bad JSON. */
export function readModeModelMap(): ModeModelMap {
  try {
    const raw = localStorage.getItem(MODE_MODEL_MAP_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const map: ModeModelMap = {};
    for (const mode of EXECUTION_MODE_IDS) {
      const entry = (parsed as Record<string, unknown>)[mode];
      if (isModelPreference(entry) && isValidExecutionMode(mode)) {
        map[mode] = {
          model: entry.model,
          ...(entry.reasoningEffort === undefined
            ? {}
            : { reasoningEffort: entry.reasoningEffort }),
        };
      }
    }
    return map;
  } catch {
    return {};
  }
}

export function writeModeModelPreference(mode: ExecutionMode, pref: ModelPreference): void {
  try {
    const map = readModeModelMap();
    map[mode] = {
      model: pref.model,
      ...(pref.reasoningEffort === undefined ? {} : { reasoningEffort: pref.reasoningEffort }),
    };
    localStorage.setItem(MODE_MODEL_MAP_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Storage is optional; the pin only lasts for this page when it is unavailable.
  }
}

export function clearModeModelMap(): void {
  try {
    localStorage.removeItem(MODE_MODEL_MAP_STORAGE_KEY);
  } catch {
    // Storage is optional; nothing to clear when it is unavailable.
  }
}

export function clearModeModelPreference(mode: ExecutionMode): void {
  try {
    const map = readModeModelMap();
    if (map[mode] === undefined) return;
    delete map[mode];
    localStorage.setItem(MODE_MODEL_MAP_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Storage is optional; nothing to clear when it is unavailable.
  }
}

/**
 * The remembered model for `mode` when the harness can run it and it is still
 * enabled, else null (the caller keeps the current model). Delegates the final
 * availability verdict to `resolveHarnessModelSelection`.
 */
export function resolveModeModelSwitch({
  mode,
  harness,
  map,
  enabledModels,
  enabledModelOptions,
}: {
  mode: ExecutionMode;
  harness: HarnessId;
  map: ModeModelMap;
  enabledModels: readonly string[];
  enabledModelOptions: ModelCategory[];
}): ModelPreference | null {
  const mapped = map[mode];
  if (!mapped || !isValidModel(mapped.model)) return null;
  if (!harnessSupportsModel(harness, mapped.model)) return null;
  if (enabledModels.length > 0 && !enabledModels.includes(mapped.model)) return null;
  const selection = resolveHarnessModelSelection({
    harness,
    preference: mapped,
    enabledModels,
    enabledModelOptions,
    loading: false,
  });
  if (selection.availability.status !== "available") return null;
  if (selection.model !== mapped.model) return null;
  return {
    model: selection.model,
    ...(selection.reasoningEffort === undefined
      ? {}
      : { reasoningEffort: selection.reasoningEffort }),
  };
}
