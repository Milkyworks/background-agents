"""Project context: fetch the session's project and write its standing instructions."""

from __future__ import annotations

import json
from typing import TYPE_CHECKING
from unittest.mock import MagicMock

import httpx

from sandbox_runtime.harness import _system_prompt_append
from sandbox_runtime.project_context import (
    ProjectContextClient,
    ProjectContextMaterializer,
    read_project_instructions,
    render_project_instructions,
)

if TYPE_CHECKING:
    from pathlib import Path


def _client(body: object, status: int = 200, seen: list[httpx.Request] | None = None):
    def handler(request: httpx.Request) -> httpx.Response:
        if seen is not None:
            seen.append(request)
        return httpx.Response(status, content=json.dumps(body))

    return ProjectContextClient(
        "https://cp.example/",
        "session/1",
        "sandbox-token",
        transport=httpx.MockTransport(handler),
    )


async def test_writes_project_instructions(tmp_path: Path) -> None:
    seen: list[httpx.Request] = []
    destination = tmp_path / "nested" / "project-instructions.md"
    client = _client(
        {"project": {"id": "proj_1", "name": "Payments", "instructions": "Run the suite."}},
        seen=seen,
    )

    await ProjectContextMaterializer(client, MagicMock(), destination=destination).materialize()

    assert seen[0].url == "https://cp.example/sessions/session%2F1/sandbox-project-context"
    assert seen[0].headers["Authorization"] == "Bearer sandbox-token"
    text = destination.read_text()
    assert text.startswith("# Project instructions: Payments")
    assert "Run the suite." in text


async def test_removes_stale_file_when_session_has_no_project(tmp_path: Path) -> None:
    destination = tmp_path / "project-instructions.md"
    destination.write_text("old instructions")

    await ProjectContextMaterializer(
        _client({"project": None}), MagicMock(), destination=destination
    ).materialize()

    assert not destination.exists()


async def test_removes_file_when_instructions_are_blank(tmp_path: Path) -> None:
    destination = tmp_path / "project-instructions.md"
    destination.write_text("old instructions")

    await ProjectContextMaterializer(
        _client({"project": {"id": "proj_1", "name": "Empty", "instructions": "  "}}),
        MagicMock(),
        destination=destination,
    ).materialize()

    assert not destination.exists()


async def test_fetch_failure_keeps_boot_going(tmp_path: Path) -> None:
    destination = tmp_path / "project-instructions.md"
    log = MagicMock()

    await ProjectContextMaterializer(
        _client({"error": "nope"}, status=500), log, destination=destination
    ).materialize()

    assert not destination.exists()
    log.warn.assert_called_once()


def test_render_returns_none_without_instructions() -> None:
    assert render_project_instructions({"name": "X", "instructions": ""}) is None


def test_read_project_instructions(tmp_path: Path) -> None:
    path = tmp_path / "project-instructions.md"
    assert read_project_instructions(path) is None
    path.write_text("\n  Be brief.  \n")
    assert read_project_instructions(path) == "Be brief."


def test_claude_system_prompt_includes_project_instructions(tmp_path: Path, monkeypatch) -> None:
    instructions = tmp_path / "project-instructions.md"
    instructions.write_text("Use British English.")
    monkeypatch.setattr(
        "sandbox_runtime.harness.read_project_instructions",
        lambda: read_project_instructions(instructions),
    )
    workdir = tmp_path / "workspace"
    workdir.mkdir()
    (workdir / "AGENTS.md").write_text("Workspace notes.")

    prompt = _system_prompt_append(workdir)

    assert prompt is not None
    assert "Workspace notes." in prompt
    assert prompt.endswith("Use British English.")


def test_claude_system_prompt_without_project(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr("sandbox_runtime.harness.read_project_instructions", lambda: None)
    assert _system_prompt_append(tmp_path) is None
