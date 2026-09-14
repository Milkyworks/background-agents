// @vitest-environment jsdom
/// <reference types="@testing-library/jest-dom" />

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as matchers from "@testing-library/jest-dom/matchers";
import { AppearanceSettings } from "./appearance-settings";

expect.extend(matchers);

const theme = vi.hoisted(() => ({ current: "system", setTheme: vi.fn() }));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: theme.current, setTheme: theme.setTheme }),
}));

describe("AppearanceSettings", () => {
  beforeEach(() => {
    theme.setTheme.mockClear();
    theme.current = "system";
    localStorage.clear();
  });

  afterEach(cleanup);

  it("switches the app to the high contrast theme", async () => {
    const user = userEvent.setup();
    render(<AppearanceSettings />);

    await user.click(screen.getByRole("radio", { name: "High contrast" }));

    expect(theme.setTheme).toHaveBeenCalledWith("high-contrast");
    expect(JSON.parse(localStorage.getItem("syntax-highlight-preferences:v1")!)).toMatchObject({
      colorSchemeMode: "high-contrast",
    });
  });

  it("offers the high contrast code theme for dark schemes", () => {
    render(<AppearanceSettings />);

    const darkSelect = screen.getByLabelText("Dark theme") as HTMLSelectElement;
    const options = Array.from(darkSelect.options).map((o) => o.value);

    expect(options).toContain("monokai-charcoal");
    expect(screen.getByLabelText("Light theme")).toBeInTheDocument();
  });
});
