import { describe, it, expect } from "vitest";
import { APP_THEMES, colorSchemeOf } from "./theme";

describe("colorSchemeOf", () => {
  it("maps dark-scheme themes to dark", () => {
    expect(colorSchemeOf("dark")).toBe("dark");
    expect(colorSchemeOf("high-contrast")).toBe("dark");
  });

  it("maps light and unknown themes to light", () => {
    expect(colorSchemeOf("light")).toBe("light");
    expect(colorSchemeOf("system")).toBe("light");
    expect(colorSchemeOf(undefined)).toBe("light");
    expect(colorSchemeOf(null)).toBe("light");
  });

  it("classifies every registered theme", () => {
    for (const theme of APP_THEMES) {
      expect(["light", "dark"]).toContain(colorSchemeOf(theme));
    }
  });
});
