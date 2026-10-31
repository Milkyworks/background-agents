import { settingsProxy } from "@/lib/settings-proxy";

export const { GET, PUT } = settingsProxy<{ id: string }>(
  ({ id }) => `/sessions/${encodeURIComponent(id)}/project`,
  "session project"
);
