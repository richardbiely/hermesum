from __future__ import annotations

import subprocess


def init_repo(path):
    path.mkdir()
    subprocess.run(["git", "-C", str(path), "init"], check=True, capture_output=True)
    subprocess.run(["git", "-C", str(path), "config", "user.email", "test@example.com"], check=True)
    subprocess.run(["git", "-C", str(path), "config", "user.name", "Test User"], check=True)
    (path / "tracked.txt").write_text("one\n", encoding="utf-8")
    subprocess.run(["git", "-C", str(path), "add", "tracked.txt"], check=True)
    subprocess.run(["git", "-C", str(path), "commit", "-m", "chore: initial"], check=True, capture_output=True)
    return path


def test_git_status_separates_staged_unstaged_and_untracked(tmp_path):
    from hermes_cli.web_chat_modules.git_commit import git_status

    repo = init_repo(tmp_path / "repo")
    (repo / "tracked.txt").write_text("one\nstaged\n", encoding="utf-8")
    subprocess.run(["git", "-C", str(repo), "add", "tracked.txt"], check=True)
    (repo / "tracked.txt").write_text("one\nstaged\nunstaged\n", encoding="utf-8")
    (repo / "new.txt").write_text("new\n", encoding="utf-8")

    status = git_status(str(repo))

    files = {(file.area, file.path): file for file in status.files}
    assert ("staged", "tracked.txt") in files
    assert ("unstaged", "tracked.txt") in files
    assert ("untracked", "new.txt") in files
    assert status.hasStagedChanges is True
    assert status.hasUnstagedChanges is True
    assert status.hasUntrackedChanges is True


def test_git_status_hides_staged_add_then_worktree_delete_phantoms(tmp_path):
    from hermes_cli.web_chat_modules.git_commit import git_status

    repo = init_repo(tmp_path / "repo")
    (repo / "phantom.txt").write_text("temporary\n", encoding="utf-8")
    subprocess.run(["git", "-C", str(repo), "add", "phantom.txt"], check=True)
    (repo / "phantom.txt").unlink()

    raw_status = subprocess.run(["git", "-C", str(repo), "status", "--porcelain=v1"], check=True, capture_output=True, text=True).stdout
    status = git_status(str(repo))

    assert "AD phantom.txt" in raw_status
    assert [file.path for file in status.files] == []
    assert status.hasStagedChanges is False
    assert status.hasUnstagedChanges is False


def test_git_diff_returns_selected_patches_only(tmp_path):
    from hermes_cli.web_chat_modules.git_commit import git_diff
    from hermes_cli.web_chat_modules.models import GitFileSelection

    repo = init_repo(tmp_path / "repo")
    (repo / "tracked.txt").write_text("one\ntwo\n", encoding="utf-8")
    (repo / "new.txt").write_text("new\n", encoding="utf-8")

    diff = git_diff(str(repo), [GitFileSelection(path="tracked.txt", area="unstaged")])

    assert [file.path for file in diff.files] == ["tracked.txt"]
    assert diff.totalAdditions == 1
    assert "two" in (diff.files[0].patch or "")


def test_generate_commit_message_asks_hidden_agent_with_project_rules_and_chat_context(tmp_path):
    from hermes_cli.web_chat_modules.git_commit import generate_commit_message
    from hermes_cli.web_chat_modules.models import GenerateCommitMessageRequest, GitFileSelection

    repo = init_repo(tmp_path / "repo")
    (repo / "AGENTS.md").write_text("Commit messages must follow Conventional Commits.\n", encoding="utf-8")
    (repo / "tracked.txt").write_text("one\nchanged\n", encoding="utf-8")
    captured: dict[str, str] = {}

    def hidden_agent(prompt: str) -> str:
        captured["prompt"] = prompt
        return "fix: update checkout flow"

    suggestion = generate_commit_message(GenerateCommitMessageRequest(
        workspace=str(repo),
        selection=[GitFileSelection(path="tracked.txt", area="unstaged")],
    ), conversation_history=[{"role": "user", "content": "Fix the checkout flow"}], hidden_agent=hidden_agent)

    assert suggestion.rulesSource == "AGENTS.md"
    assert suggestion.contextSummary == "current chat and selected Git changes"
    assert suggestion.subject == "fix: update checkout flow"
    assert "Commit messages must follow Conventional Commits" in captured["prompt"]
    assert "tracked.txt" in captured["prompt"]
    assert "real chat history is already provided" in captured["prompt"]


def test_generate_commit_message_reports_conventional_rules_without_project_rules(tmp_path):
    from hermes_cli.web_chat_modules.git_commit import generate_commit_message
    from hermes_cli.web_chat_modules.models import GenerateCommitMessageRequest, GitFileSelection

    repo = init_repo(tmp_path / "repo")
    (repo / "tracked.txt").write_text("one\nchanged\n", encoding="utf-8")

    suggestion = generate_commit_message(GenerateCommitMessageRequest(
        workspace=str(repo),
        selection=[GitFileSelection(path="tracked.txt", area="unstaged")],
    ), hidden_agent=lambda _prompt: "fix: update tracked file")

    assert suggestion.rulesSource == "Conventional Commits"
    assert suggestion.subject == "fix: update tracked file"


def test_generate_commit_message_fails_without_hidden_agent(tmp_path):
    from fastapi import HTTPException
    from hermes_cli.web_chat_modules.git_commit import generate_commit_message
    from hermes_cli.web_chat_modules.models import GenerateCommitMessageRequest, GitFileSelection

    repo = init_repo(tmp_path / "repo")
    (repo / "tracked.txt").write_text("one\nchanged\n", encoding="utf-8")

    try:
        generate_commit_message(GenerateCommitMessageRequest(
            workspace=str(repo),
            selection=[GitFileSelection(path="tracked.txt", area="unstaged")],
        ))
    except HTTPException as exc:
        assert exc.status_code == 503
        assert "not available" in str(exc.detail)
    else:
        raise AssertionError("Expected commit message generation to fail without hidden agent")


def test_generate_commit_message_fails_when_agent_output_violates_rules(tmp_path):
    from fastapi import HTTPException
    from hermes_cli.web_chat_modules.git_commit import generate_commit_message
    from hermes_cli.web_chat_modules.models import GenerateCommitMessageRequest, GitFileSelection

    repo = init_repo(tmp_path / "repo")
    (repo / "tracked.txt").write_text("one\nchanged\n", encoding="utf-8")

    try:
        generate_commit_message(GenerateCommitMessageRequest(
            workspace=str(repo),
            selection=[GitFileSelection(path="tracked.txt", area="unstaged")],
        ), hidden_agent=lambda _prompt: "Update tracked file")
    except HTTPException as exc:
        assert exc.status_code == 502
        assert "project rules" in str(exc.detail)
    else:
        raise AssertionError("Expected invalid agent output to fail")


def test_git_routes_expose_status(client, tmp_path):
    repo = init_repo(tmp_path / "repo")
    (repo / "tracked.txt").write_text("one\ntwo\n", encoding="utf-8")

    status_response = client.get("/api/web-chat/git/status", params={"workspace": str(repo)})
    assert status_response.status_code == 200
    assert status_response.json()["files"][0]["path"] == "tracked.txt"
