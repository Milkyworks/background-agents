// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_MODEL, type ModelCategory } from "@open-inspect/shared/models";
import {
  MODE_MODEL_MAP_STORAGE_KEY,
  clearModeModelMap,
  readModeModelMap,
  resolveModeModelSwitch,
  writeModeModelPreference,
} from "./mode-model-map";

const ANTHROPIC_MODEL = "anthropic/claude-sonnet-4-6";
const OPENAI_MODEL = "openai/gpt-5.4";

const options: ModelCategory[] = [
  {
    category: "Anthropic",
    models: [{ id: ANTHROPIC_MODEL, name: "Claude Sonnet 4.6", description: "" }],
  },
  {
    category: "OpenAI",
    models: [{ id: OPENAI_MODEL, name: "GPT-5.4", description: "" }],
  },
];

afterEach(() => {
  localStorage.clear();
});

describe("mode model map", () => {
  it("returns an empty map when nothing is stored", () => {
    expect(readModeModelMap()).toEqual({});
  });

  it("tolerates malformed JSON", () => {
    localStorage.setItem(MODE_MODEL_MAP_STORAGE_KEY, "not-json{{{");
    expect(readModeModelMap()).toEqual({});
  });

  it("round-trips a written preference", () => {
    writeModeModelPreference("plan", { model: ANTHROPIC_MODEL, reasoningEffort: "high" });
    expect(readModeModelMap()).toEqual({
      plan: { model: ANTHROPIC_MODEL, reasoningEffort: "high" },
    });
    clearModeModelMap();
    expect(readModeModelMap()).toEqual({});
  });

  it("returns null for an absent map entry so the caller keeps the current model", () => {
    expect(
      resolveModeModelSwitch({
        mode: "plan",
        harness: "opencode",
        map: {},
        enabledModels: [ANTHROPIC_MODEL, OPENAI_MODEL],
        enabledModelOptions: options,
      })
    ).toBeNull();
  });

  it("returns the mapped model when harness-compatible and enabled", () => {
    const resolved = resolveModeModelSwitch({
      mode: "plan",
      harness: "opencode",
      map: { plan: { model: ANTHROPIC_MODEL } },
      enabledModels: [ANTHROPIC_MODEL, OPENAI_MODEL],
      enabledModelOptions: options,
    });
    expect(resolved?.model).toBe(ANTHROPIC_MODEL);
  });

  it("returns null when the harness cannot run the mapped model", () => {
    // The claude harness only runs anthropic models.
    expect(
      resolveModeModelSwitch({
        mode: "plan",
        harness: "claude",
        map: { plan: { model: OPENAI_MODEL } },
        enabledModels: [ANTHROPIC_MODEL, OPENAI_MODEL],
        enabledModelOptions: options,
      })
    ).toBeNull();
  });

  it("returns null when the mapped model is no longer enabled", () => {
    expect(
      resolveModeModelSwitch({
        mode: "plan",
        harness: "opencode",
        map: { plan: { model: OPENAI_MODEL } },
        enabledModels: [ANTHROPIC_MODEL],
        enabledModelOptions: options,
      })
    ).toBeNull();
  });

  it("returns null for an unknown mapped model", () => {
    expect(
      resolveModeModelSwitch({
        mode: "build",
        harness: "opencode",
        map: { build: { model: "nope/unknown-model" } },
        enabledModels: [DEFAULT_MODEL],
        enabledModelOptions: options,
      })
    ).toBeNull();
  });
});
