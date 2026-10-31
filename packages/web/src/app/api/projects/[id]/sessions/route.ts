import { settingsProxy } from "@/lib/settings-proxy";

const FORWARDED_PARAMS = ["limit", "offset"] as const;

export const { GET } = settingsProxy<{ id: string }>(({ id }, request) => {
  const query = new URLSearchParams();
  for (const name of FORWARDED_PARAMS) {
    const value = request.nextUrl.searchParams.get(name);
    if (value) query.set(name, value);
  }
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return `/projects/${encodeURIComponent(id)}/sessions${suffix}`;
}, "project sessions");
