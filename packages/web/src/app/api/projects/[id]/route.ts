import { settingsProxy } from "@/lib/settings-proxy";

export const { GET, PATCH } = settingsProxy<{ id: string }>(
  ({ id }) => `/projects/${encodeURIComponent(id)}`,
  "project"
);
