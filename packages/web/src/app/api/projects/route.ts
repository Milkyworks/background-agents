import { settingsProxy } from "@/lib/settings-proxy";

function listPath(request: { nextUrl: URL }): string {
  return request.nextUrl.searchParams.get("includeArchived") === "true"
    ? "/projects?includeArchived=true"
    : "/projects";
}

export const { GET, POST } = settingsProxy((_params, request) => listPath(request), "projects");
