from __future__ import annotations

import sys
from pathlib import Path

import pytest


RUNTIME_ROOT = Path(__file__).resolve().parents[2] / ".runtime" / "hermes-agent"
if str(RUNTIME_ROOT) not in sys.path:
    sys.path.insert(0, str(RUNTIME_ROOT))


@pytest.fixture(autouse=True)
def _isolate_hermes_home(tmp_path, monkeypatch):
    fake_hermes_home = tmp_path / "hermes_test"
    fake_hermes_home.mkdir()
    (fake_hermes_home / "sessions").mkdir()
    (fake_hermes_home / "cron").mkdir()
    (fake_hermes_home / "memories").mkdir()
    (fake_hermes_home / "skills").mkdir()

    monkeypatch.setenv("HERMES_HOME", str(fake_hermes_home))
    monkeypatch.setenv("TZ", "UTC")
    monkeypatch.setenv("LANG", "C.UTF-8")
    monkeypatch.setenv("LC_ALL", "C.UTF-8")
    monkeypatch.setenv("PYTHONHASHSEED", "0")
    monkeypatch.setenv("AWS_EC2_METADATA_DISABLED", "true")
    monkeypatch.setenv("AWS_METADATA_SERVICE_TIMEOUT", "1")
    monkeypatch.setenv("AWS_METADATA_SERVICE_NUM_ATTEMPTS", "1")
