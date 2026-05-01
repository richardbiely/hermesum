from __future__ import annotations

import subprocess
from datetime import datetime
from pathlib import Path


def assert_iso_timestamp(value: str):
    assert datetime.fromisoformat(value).tzinfo is not None


def git_command(repo: Path, *args: str, capture_output: bool = False):
    return subprocess.run(
        ["git", "-C", str(repo), *args],
        check=True,
        capture_output=capture_output,
        text=capture_output,
    )


def git_repo(tmp_path, name: str = "repo"):
    repo = tmp_path / name
    repo.mkdir()
    git_command(repo, "init", capture_output=True)
    return repo


def committed_git_repo(tmp_path, name: str = "repo", filename: str = "tracked.txt", content: str = "one\n"):
    repo = git_repo(tmp_path, name)
    git_command(repo, "config", "user.email", "test@example.com")
    git_command(repo, "config", "user.name", "Test User")
    (repo / filename).write_text(content, encoding="utf-8")
    git_command(repo, "add", filename)
    git_command(repo, "commit", "-m", "chore: initial", capture_output=True)
    return repo
