from __future__ import annotations

import subprocess
from datetime import datetime


def assert_iso_timestamp(value: str):
    assert datetime.fromisoformat(value).tzinfo is not None


def git_repo(tmp_path, name: str = "repo"):
    repo = tmp_path / name
    repo.mkdir()
    subprocess.run(["git", "-C", str(repo), "init"], check=True, capture_output=True)
    return repo
