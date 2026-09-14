"use client";

import { useTheme } from "next-themes";
import {
  useSyntaxHighlightPreferences,
  LIGHT_THEMES,
  DARK_THEMES,
  type ColorSchemeMode,
  type SyntaxHighlightThemeDefinition,
} from "@/hooks/use-syntax-highlight-preferences";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SunIcon, MoonIcon, MonitorIcon, ContrastIcon } from "@/components/ui/icons";

const COLOR_SCHEME_OPTIONS: { value: ColorSchemeMode; label: string; icon: typeof SunIcon }[] = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "high-contrast", label: "High contrast", icon: ContrastIcon },
  { value: "system", label: "System", icon: MonitorIcon },
];

function ThemeRow({
  label,
  description,
  value,
  themes,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  themes: SyntaxHighlightThemeDefinition[];
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <span className="text-sm text-foreground">{label}</span>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground sm:w-auto"
      >
        {themes.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function AppearanceSettings() {
  const { colorSchemeMode, preferredLightTheme, preferredDarkTheme, update } =
    useSyntaxHighlightPreferences();
  const { theme, setTheme } = useTheme();
  const selectedColorScheme = (theme ?? colorSchemeMode) as ColorSchemeMode;

  return (
    <div>
      <h2 className="text-xl font-semibold text-foreground mb-1">Appearance</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Customize the appearance of the application.
      </p>

      {/* Theme section */}
      <div className="mb-8">
        <h3 className="text-base font-medium text-foreground mb-1">Theme</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Controls the colors used across the application.
        </p>

        <div className="overflow-hidden rounded-xl border border-border-muted bg-card">
          <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="text-sm text-foreground">Color scheme</span>
              <p className="text-xs text-muted-foreground mt-0.5">
                Choose light, dark, high contrast, or match your system theme
              </p>
            </div>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={selectedColorScheme}
              className="self-start flex-wrap justify-start"
              onValueChange={(value) => {
                if (!value) return;
                const nextMode = value as ColorSchemeMode;
                setTheme(nextMode);
                update({ colorSchemeMode: nextMode });
              }}
            >
              {COLOR_SCHEME_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <ToggleGroupItem key={opt.value} value={opt.value}>
                    <Icon className="w-3.5 h-3.5" />
                    {opt.label}
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
          </div>
        </div>
      </div>

      {/* Code Highlighting section */}
      <div>
        <h3 className="text-base font-medium text-foreground mb-1">Code highlighting</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Customize how code is displayed in sessions.
        </p>

        <div className="divide-y divide-border-muted overflow-hidden rounded-xl border border-border-muted bg-card">
          <ThemeRow
            label="Light theme"
            description="Used with the light theme"
            value={preferredLightTheme}
            themes={LIGHT_THEMES}
            onChange={(v) => update({ preferredLightTheme: v })}
          />
          <ThemeRow
            label="Dark theme"
            description="Used with the dark and high contrast themes"
            value={preferredDarkTheme}
            themes={DARK_THEMES}
            onChange={(v) => update({ preferredDarkTheme: v })}
          />
        </div>
      </div>
    </div>
  );
}
