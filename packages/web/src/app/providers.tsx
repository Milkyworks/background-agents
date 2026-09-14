"use client";

import { ThemeProvider } from "next-themes";
import { SWRConfig } from "swr";
import { Toaster } from "@/components/ui/sonner";
import { SyntaxHighlightTheme } from "@/components/syntax-highlight-theme";
import { browserApiFetch, type BrowserApiPath } from "@/lib/browser-api-fetch";
import { APP_THEMES } from "@/lib/theme";

async function swrFetcher<T>(url: BrowserApiPath): Promise<T> {
  // SWR falls back to this fetcher for every hook that omits its own, including
  // hooks whose key is local state rather than a request path.
  if (!url.startsWith("/api/")) throw new Error(`SWR key is not a BFF API path: ${url}`);
  const res = await browserApiFetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return res.json();
}

export function Providers({ children }: { children: React.ReactNode }) {
  // enableSystem appends "system" to the theme list on its own.
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem themes={[...APP_THEMES]}>
      <SWRConfig value={{ fetcher: swrFetcher, revalidateOnFocus: true, dedupingInterval: 2000 }}>
        {children}
        <SyntaxHighlightTheme />
        <Toaster />
      </SWRConfig>
    </ThemeProvider>
  );
}
