"""Tests for web chat run request options and validation."""

from __future__ import annotations

import time

from web_chat_test_helpers import git_repo


def test_start_run_rejects_missing_workspace(client, tmp_path):
    response = client.post("/api/web-chat/runs", json={
        "input": "Use missing workspace",
        "workspace": str(tmp_path / "missing"),
    })

    assert response.status_code == 400
    assert response.json()["detail"] == "Directory does not exist"


def test_start_run_rejects_unmanaged_non_git_workspace(client, tmp_path):
    directory = tmp_path / "plain-directory"
    directory.mkdir()

    response = client.post("/api/web-chat/runs", json={
        "input": "Use plain directory",
        "workspace": str(directory),
    })

    assert response.status_code == 400
    assert response.json()["detail"] == "Directory is not a managed or git workspace"


def test_start_run_rejects_missing_profile(client, monkeypatch, tmp_path):
    import hermes_cli.web_chat as web_chat

    repo = git_repo(tmp_path)
    monkeypatch.setattr(web_chat, "_profile_dependencies", lambda: (
        lambda: "main",
        lambda: [],
        lambda name: False,
        lambda name: str(tmp_path / "profiles" / name),
        lambda name: None,
        lambda name: None,
    ))

    response = client.post("/api/web-chat/runs", json={"input": "Hi", "workspace": str(repo), "profile": "missing"})

    assert response.status_code == 400
    assert response.json()["detail"] == "Hermes profile does not exist"


def test_start_run_rejects_unsafe_profile_switch_with_clear_message(client, monkeypatch, tmp_path):
    import hermes_cli.web_chat as web_chat

    repo = git_repo(tmp_path)
    monkeypatch.setattr(web_chat, "_profile_dependencies", lambda: (
        lambda: "main",
        lambda: [],
        lambda name: True,
        lambda name: str(tmp_path / "profiles" / name),
        lambda name: None,
        lambda name: None,
    ))

    response = client.post("/api/web-chat/runs", json={"input": "Hi", "workspace": str(repo), "profile": "alt"})

    assert response.status_code == 400
    assert response.json()["detail"] == "Switching Hermes profile requires a backend restart in this prototype. Current profile: main."


def test_start_run_accepts_current_profile(client, monkeypatch, tmp_path):
    import hermes_cli.web_chat as web_chat

    repo = git_repo(tmp_path)
    seen = {}
    monkeypatch.setattr(web_chat, "_profile_dependencies", lambda: (
        lambda: "main",
        lambda: [],
        lambda name: True,
        lambda name: str(tmp_path / "profiles" / name),
        lambda name: None,
        lambda name: None,
    ))

    def fake_executor(context, emit):
        seen["profile"] = context.profile
        return "Done"

    monkeypatch.setattr(web_chat, "run_manager", web_chat.RunManager(fake_executor))

    response = client.post("/api/web-chat/runs", json={"input": "Hi", "workspace": str(repo), "profile": "main"})

    assert response.status_code == 202
    assert seen == {"profile": "main"}


def test_start_run_assigns_selected_workspace_to_new_session(client, monkeypatch, tmp_path):
    import hermes_cli.web_chat as web_chat

    repo = git_repo(tmp_path)

    seen = {}

    def fake_executor(context, emit):
        seen["workspace"] = context.workspace
        return "Done"

    monkeypatch.setattr(web_chat, "run_manager", web_chat.RunManager(fake_executor))

    response = client.post("/api/web-chat/runs", json={"input": "Use workspace", "workspace": str(repo)})

    assert response.status_code == 202
    assert seen["workspace"] == str(repo)

    detail = client.get(f"/api/web-chat/sessions/{response.json()['sessionId']}")
    assert detail.status_code == 200
    assert detail.json()["session"]["workspace"] == str(repo)


def test_start_run_from_edited_message_does_not_append_duplicate_user_message(client, monkeypatch):
    import hermes_cli.web_chat as web_chat
    from hermes_state import SessionDB

    db = SessionDB()
    db.create_session("session-edit", source="web-chat")
    message_id = db.append_message("session-edit", "user", "Edited prompt")
    seen = {}

    def fake_executor(context, emit):
        seen["input"] = context.input
        return "New answer"

    monkeypatch.setattr(web_chat, "run_manager", web_chat.RunManager(fake_executor))

    response = client.post(
        "/api/web-chat/runs",
        json={"sessionId": "session-edit", "input": "Edited prompt", "editedMessageId": str(message_id)},
    )

    assert response.status_code == 202
    assert seen["input"] == "Edited prompt"

    detail = client.get("/api/web-chat/sessions/session-edit")
    messages = detail.json()["messages"]
    assert [message["role"] for message in messages] == ["user", "assistant"]
    assert messages[0]["id"] == str(message_id)
    assert messages[0]["parts"][0]["text"] == "Edited prompt"
    assert messages[1]["parts"][0]["text"] == "New answer"


def test_start_run_from_edited_message_requires_last_user_message(client):
    from hermes_state import SessionDB

    db = SessionDB()
    db.create_session("session-edit", source="web-chat")
    message_id = db.append_message("session-edit", "user", "Prompt")
    db.append_message("session-edit", "assistant", "Answer")

    response = client.post(
        "/api/web-chat/runs",
        json={"sessionId": "session-edit", "input": "Prompt", "editedMessageId": str(message_id)},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Edited message must be the latest message in the chat."


def test_start_run_allows_duplicate_initial_titles(client, monkeypatch, tmp_path):
    import hermes_cli.web_chat as web_chat

    repo = git_repo(tmp_path)

    def fake_executor(context, emit):
        return "Done"

    monkeypatch.setattr(web_chat, "run_manager", web_chat.RunManager(fake_executor))

    first = client.post("/api/web-chat/runs", json={"input": "Repeatable title", "workspace": str(repo)})
    second = client.post("/api/web-chat/runs", json={"input": "Repeatable title", "workspace": str(repo)})

    assert first.status_code == 202
    assert second.status_code == 202
    assert first.json()["sessionId"] != second.json()["sessionId"]


def test_start_run_for_existing_session_updates_saved_model_and_reasoning(client, monkeypatch, tmp_path):
    import hermes_cli.web_chat as web_chat
    from hermes_state import SessionDB

    repo = git_repo(tmp_path)
    db = SessionDB()
    db.create_session("session-existing", source="web-chat", model="gpt-5.4", model_config={"workspace": str(repo)})
    db.append_message("session-existing", "user", "Existing")

    def fake_executor(context, emit):
        return "Updated"

    monkeypatch.setattr(web_chat, "run_manager", web_chat.RunManager(fake_executor))

    response = client.post("/api/web-chat/runs", json={
        "sessionId": "session-existing",
        "input": "Switch models",
        "model": "gpt-5.3-codex",
        "reasoningEffort": "xhigh",
    })

    assert response.status_code == 202

    detail = client.get("/api/web-chat/sessions/session-existing")
    assert detail.status_code == 200
    assert detail.json()["session"]["model"] == "gpt-5.3-codex"
    assert detail.json()["session"]["reasoningEffort"] == "xhigh"


def test_invalid_reasoning_effort_falls_back_safely(client, monkeypatch, tmp_path):
    import hermes_cli.web_chat as web_chat

    repo = git_repo(tmp_path)
    workspace = client.post("/api/web-chat/workspaces", json={"label": "Repo", "path": str(repo)})
    assert workspace.status_code == 201
    seen = {}

    def fake_executor(context, emit):
        seen["model"] = context.model
        seen["reasoningEffort"] = context.reasoning_effort
        return "Done"

    monkeypatch.setattr(web_chat, "_available_model_ids", lambda: ["gpt-5.4"])
    monkeypatch.setattr(web_chat, "run_manager", web_chat.RunManager(fake_executor))

    response = client.post("/api/web-chat/runs", json={
        "input": "Use safe defaults",
        "workspace": str(repo),
        "model": "gpt-5.4",
        "reasoningEffort": "banana",
    })

    assert response.status_code == 202, response.text

    deadline = time.monotonic() + 1
    while not seen and time.monotonic() < deadline:
        time.sleep(0.01)

    assert seen == {"model": "gpt-5.4", "reasoningEffort": "none"}
