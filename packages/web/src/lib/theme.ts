/**
 * App-level themes.
 *
 * next-themes writes the selected theme id onto `<html>` as a single class, so
 * every theme needs its own self-contained token block in `globals.css` — a
 * theme cannot layer on top of `.dark`. Tailwind's `dark:` variant is widened
 * in `tailwind.config.ts` to match every dark-scheme theme class.
 */
export const APP_THEMES = ["light", "dark", "high-contrast"] as const;

export type AppTheme = (typeof APP_THEMES)[number];

/** Theme selection, including following the OS preference. */
export type ThemePreference = AppTheme | "system";

const DARK_SCHEME_THEMES = new Set<string>(["dark", "high-contrast"]);

/**
 * Maps a resolved theme id to the color scheme it renders in. Used for
 * components that only understand light/dark (diff renderer, toasts, syntax
 * highlighting). Unknown/unresolved themes fall back to light.
 */
export function colorSchemeOf(theme: string | undefined | null): "light" | "dark" {
  return theme && DARK_SCHEME_THEMES.has(theme) ? "dark" : "light";
}
