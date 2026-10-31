import { settingsProxy } from "@/lib/settings-proxy";

export const { POST } = settingsProxy<{ id: string }>(
  ({ id }) => `/projects/${encodeURIComponent(id)}/archive`,
  "project"
);
