"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { colorSchemeOf } from "@/lib/theme";

function Toaster(props: ToasterProps) {
  const { theme = "system", resolvedTheme } = useTheme();
  // Sonner only understands light/dark/system, so custom themes resolve to
  // their color scheme.
  const sonnerTheme: ToasterProps["theme"] =
    theme === "system" || theme === "light" || theme === "dark"
      ? theme
      : colorSchemeOf(resolvedTheme);

  return (
    <Sonner
      theme={sonnerTheme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-accent group-[.toast]:text-accent-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
