// @vitest-environment jsdom
/// <reference types="@testing-library/jest-dom" />

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectSection } from "./project-section";

expect.extend(matchers);

const { mockSessionProject, mockFetch, mockGlobalMutate } = vi.hoisted(() => ({
  mockSessionProject: vi.fn(),
  mockFetch: vi.fn(),
  mockGlobalMutate: vi.fn(),
}));

vi.mock("swr", () => ({ mutate: mockGlobalMutate }));

vi.mock("@/hooks/use-projects", () => ({
  projectSessionsKey: (id: string) => `/api/projects/${id}/sessions`,
  useProjects: () => ({
    projects: [
      { id: "proj_a", name: "Alpha" },
      { id: "proj_b", name: "Beta" },
    ],
  }),
  useSessionProject: mockSessionProject,
}));

vi.mock("@/lib/browser-api-fetch", () => ({ browserApiFetch: mockFetch }));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.ComponentProps<"a">) => (
    <a href={typeof href === "string" ? href : "#"} {...props}>
      {children}
    </a>
  ),
}));

describe("ProjectSection", () => {
  const mutate = vi.fn();

  beforeEach(() => {
    mutate.mockReset();
    mockFetch.mockReset();
    mockGlobalMutate.mockReset();
    mockSessionProject.mockReturnValue({ projectId: "proj_a", loading: false, mutate });
  });

  afterEach(cleanup);

  it("moves the session into another project", async () => {
    mockFetch.mockResolvedValue(new Response("{}", { status: 200 }));
    render(<ProjectSection sessionId="s1" canChange />);

    fireEvent.change(screen.getByLabelText("Project"), { target: { value: "proj_b" } });

    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        { projectId: "proj_b" },
        {
          revalidate: false,
        }
      )
    );
    expect(mockFetch).toHaveBeenCalledWith("/api/sessions/s1/project", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: "proj_b" }),
    });
    expect(mockGlobalMutate).toHaveBeenCalledWith("/api/projects/proj_a/sessions");
    expect(mockGlobalMutate).toHaveBeenCalledWith("/api/projects/proj_b/sessions");
  });

  it("shows an error when the move fails", async () => {
    mockFetch.mockResolvedValue(new Response("{}", { status: 404 }));
    render(<ProjectSection sessionId="s1" canChange />);

    fireEvent.change(screen.getByLabelText("Project"), { target: { value: "" } });

    expect(await screen.findByText("Could not move this session")).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("shows the project read-only without lifecycle access", () => {
    render(<ProjectSection sessionId="s1" canChange={false} />);
    expect(screen.queryByLabelText("Project")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Alpha" })).toHaveAttribute("href", "/projects/proj_a");
  });

  it("renders nothing read-only when the session has no project", () => {
    mockSessionProject.mockReturnValue({ projectId: null, loading: false, mutate });
    const { container } = render(<ProjectSection sessionId="s1" canChange={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});
