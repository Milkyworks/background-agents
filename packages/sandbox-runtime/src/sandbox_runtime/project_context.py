"""Fetch the session's project context and write its standing instructions.

A session that belongs to a project receives the project's standing
instructions at boot. They are written to a fixed file outside every repository
checkout, so nothing lands in a working tree, and each harness reads that file:
OpenCode through its ``instructions`` config, the Claude harness through its
appended system prompt.

The file is rewritten on every boot (including snapshot restores), and removed
when the session has no project, so edits to a project reach the next boot.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any
from urllib.parse import quote

import httpx

PROJECT_CONTEXT_FETCH_TIMEOUT_SECONDS = 10.0
PROJECT_CONTEXT_REQUEST_ATTEMPTS = 3

#: Standing instructions for the session's project, read by both harnesses.
PROJECT_INSTRUCTIONS_PATH = Path(
    os.environ.get("OPENINSPECT_PROJECT_INSTRUCTIONS_PATH")
    or Path.home() / ".openinspect" / "project-instructions.md"
)


class ProjectContextClient:
    """Async client for the sandbox-only project context endpoint."""

    def __init__(
        self,
        control_plane_url: str,
        session_id: str,
        sandbox_token: str,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._url = (
            f"{control_plane_url.rstrip('/')}/sessions/"
            f"{quote(session_id, safe='')}/sandbox-project-context"
        )
        self._headers = {"Authorization": f"Bearer {sandbox_token}"}
        self._transport = transport

    async def fetch(self) -> dict[str, Any]:
        last_error: Exception | None = None
        for _ in range(PROJECT_CONTEXT_REQUEST_ATTEMPTS):
            try:
                async with httpx.AsyncClient(transport=self._transport) as client:
                    response = await client.get(
                        self._url,
                        headers=self._headers,
                        timeout=PROJECT_CONTEXT_FETCH_TIMEOUT_SECONDS,
                    )
                    response.raise_for_status()
                    body = response.json()
                    return body if isinstance(body, dict) else {}
            except (httpx.HTTPError, ValueError) as error:
                last_error = error
        raise RuntimeError(f"failed to fetch project context: {last_error}")


def render_project_instructions(project: dict[str, Any]) -> str | None:
    """The instructions file body, or None when the project has nothing to say."""
    instructions = str(project.get("instructions") or "").strip()
    if not instructions:
        return None
    name = str(project.get("name") or "this project").strip()
    return (
        f"# Project instructions: {name}\n\n"
        "This session belongs to a project. Follow these standing instructions "
        "unless the user's own message says otherwise.\n\n"
        f"{instructions}\n"
    )


class ProjectContextMaterializer:
    """Write (or clear) the project instructions file before the harness starts."""

    def __init__(
        self,
        client: ProjectContextClient,
        log: Any,
        *,
        destination: Path = PROJECT_INSTRUCTIONS_PATH,
    ) -> None:
        self.client = client
        self.log = log
        self.destination = destination

    async def materialize(self) -> None:
        """Best effort: a failed fetch leaves the session running without instructions."""
        try:
            context = await self.client.fetch()
        except Exception as error:
            self.log.warn("project_context.fetch_failed", exc=error)
            return

        project = context.get("project")
        body = render_project_instructions(project) if isinstance(project, dict) else None
        try:
            if body is None:
                self.destination.unlink(missing_ok=True)
                return
            self.destination.parent.mkdir(parents=True, exist_ok=True)
            self.destination.write_text(body)
            self.log.info(
                "project_context.instructions_written",
                project_id=str(project.get("id", "")) if isinstance(project, dict) else "",
            )
        except OSError as error:
            self.log.warn("project_context.write_failed", exc=error)


def read_project_instructions(path: Path = PROJECT_INSTRUCTIONS_PATH) -> str | None:
    """The written instructions, or None when the session has no project instructions."""
    try:
        text = path.read_text().strip()
    except OSError:
        return None
    return text or None
