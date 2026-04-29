"""Git commit helpers for the web chat API."""

from __future__ import annotations

import hashlib
import re
import subprocess
from pathlib import Path, PurePosixPath
from typing import Callable, Iterable

from fastapi import HTTPException, status

from .git_changes import count_text_lines, workspace_root
from .git_patches import untracked_file_patch
from .models import (
    CommitMessageSuggestion,
    GenerateCommitMessageRequest,
    GitDiffFile,
    GitDiffResponse,
    GitFileSelection,
    GitStatusFile,
    GitStatusResponse,
)

MAX_PATCH_BYTES_PER_FILE = 120 * 1024
_CONVENTIONAL_SUBJECT = re.compile(
    r"^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9._-]+\))?!?: .+"
)
_RULE_FILES = (
    "AGENTS.md",
    "CLAUDE.md",
    "SOUL.md",
    "docs/commit-messages.md",
    ".commitlintrc",
    ".commitlintrc.json",
    "commitlint.config.js",
    "commitlint.config.cjs",
    "commitlint.config.mjs",
)
_SENSITIVE_NAMES = {".env", ".env.local", ".env.production", "id_rsa", "id_ed25519"}
_SENSITIVE_SUFFIXES = (".pem", ".key", ".p12", ".pfx")
_STATUS_LABELS = {
    "A": "created",
    "M": "edited",
    "D": "deleted",
    "R": "renamed",
    "C": "copied",
}


def git_status(workspace: str | None = None, *, workspace_root_func=workspace_root) -> GitStatusResponse:
    root = _require_git_root(workspace, workspace_root_func)
    result = _git(root, ["status", "--porcelain=v1", "--branch"])
    branch, ahead, behind = _parse_branch(result.stdout)
    files = _parse_status_files(root, result.stdout)
    _attach_numstat(root, files)
    return GitStatusResponse(
        workspace=str(root),
        root=str(root),
        head=_git(root, ["rev-parse", "HEAD"]).stdout.strip(),
        branch=branch,
        ahead=ahead,
        behind=behind,
        files=files,
        hasStagedChanges=any(file.area == "staged" for file in files),
        hasUnstagedChanges=any(file.area == "unstaged" for file in files),
        hasUntrackedChanges=any(file.area == "untracked" for file in files),
    )


def git_diff(
    workspace: str | None = None,
    selection: list[GitFileSelection] | None = None,
    *,
    workspace_root_func=workspace_root,
    max_patch_bytes_per_file: int = MAX_PATCH_BYTES_PER_FILE,
) -> GitDiffResponse:
    root = _require_git_root(workspace, workspace_root_func)
    selected = _validate_selection(root, selection or [], workspace_root_func=workspace_root_func)
    files = [_diff_file(root, item, max_patch_bytes_per_file=max_patch_bytes_per_file) for item in selected]
    return GitDiffResponse(
        workspace=str(root),
        root=str(root),
        fingerprint=_diff_fingerprint(files),
        files=files,
        totalAdditions=sum(file.additions for file in files),
        totalDeletions=sum(file.deletions for file in files),
        truncated=any(file.truncated for file in files),
    )


def generate_commit_message(
    payload: GenerateCommitMessageRequest,
    *,
    workspace_root_func=workspace_root,
    conversation_history: list[dict[str, str]] | None = None,
    hidden_agent: Callable[[str], str] | None = None,
) -> CommitMessageSuggestion:
    root = _require_git_root(payload.workspace, workspace_root_func)
    diff = git_diff(payload.workspace, payload.selection, workspace_root_func=workspace_root_func)
    if not diff.files:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Select at least one file to generate a commit message")
    if hidden_agent is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Commit message generation is not available")

    warnings = _selection_warnings([GitFileSelection(path=file.path, area=file.area) for file in diff.files])
    rules_source = _commit_rules_source(root)
    prompt = _commit_message_prompt(root, diff, conversation_history or [], payload.chatContext)
    try:
        raw_message = hidden_agent(prompt)
        subject, body = _parse_agent_commit_message(raw_message)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to generate commit message") from exc

    if _should_enforce_conventional_subject(root) and not _CONVENTIONAL_SUBJECT.match(subject):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to generate a commit message that satisfies project rules",
        )

    if diff.truncated:
        warnings.append("Diff was truncated; review the selected files before committing.")

    return CommitMessageSuggestion(
        subject=subject,
        body=body,
        warnings=warnings,
        rulesSource=rules_source,
        contextSummary="current chat and selected Git changes" if conversation_history or payload.chatContext else "selected Git changes",
    )


def _commit_message_prompt(
    root: Path,
    diff: GitDiffResponse,
    conversation_history: list[dict[str, str]],
    chat_context: str | None,
) -> str:
    rules = _read_commit_rules(root).strip()
    if not rules:
        rules = (
            "Use Conventional Commits v1.0.0. Format the subject as "
            "<type>[optional scope]: <description>. Use one of: feat, fix, docs, style, "
            "refactor, perf, test, build, ci, chore, revert."
        )

    history_note = "The real chat history is already provided as conversation history. Use it to infer intent."
    if not conversation_history and chat_context:
        history_note = f"Additional chat context:\n{chat_context.strip()[:12000]}"
    elif not conversation_history:
        history_note = "No chat history is available; rely on the selected Git changes."

    return "\n\n".join([
        "You are helping inside the current Hermes chat, but this is a private background request. Do not mention this request in the chat history.",
        "Generate the best Git commit message for the selected changes.",
        "Use the current chat history to infer the user's intent, but the selected Git diff is the source of truth.",
        "Follow the project commit-message rules exactly.",
        "Return only the commit message text: first line subject, optional blank line, optional body. Do not wrap it in Markdown or JSON. Do not explain.",
        f"Project commit-message rules source: {_commit_rules_source(root)}\n{rules}",
        history_note,
        f"Selected changes summary:\n{_format_diff_summary(diff)}",
        f"Selected diff:\n{_format_diff_for_prompt(diff)}",
    ])


def _format_diff_summary(diff: GitDiffResponse) -> str:
    lines = [
        f"- {file.area} {file.status}: {file.path} (+{file.additions}/-{file.deletions})"
        for file in diff.files
    ]
    return "\n".join(lines)


def _format_diff_for_prompt(diff: GitDiffResponse) -> str:
    chunks: list[str] = []
    for file in diff.files:
        chunks.append(f"### {file.area} {file.status}: {file.path}")
        if file.oldPath:
            chunks.append(f"Old path: {file.oldPath}")
        if is_sensitive_path(file.path):
            chunks.append("[REDACTED: sensitive file diff omitted]")
            continue
        if file.binary:
            chunks.append("[Binary file]")
            continue
        chunks.append(file.patch or "[No textual patch available]")
    return "\n".join(chunks)[:180_000]


def _parse_agent_commit_message(value: str) -> tuple[str, str | None]:
    message = _strip_markdown_fence(value).strip()
    if not message:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to generate commit message")
    lines = [line.rstrip() for line in message.splitlines()]
    while lines and not lines[0].strip():
        lines.pop(0)
    while lines and not lines[-1].strip():
        lines.pop()
    if not lines:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to generate commit message")
    subject = lines[0].strip()
    body = "\n".join(lines[1:]).strip() or None
    if not subject or len(subject) > 200 or (body and len(body) > 20_000):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to generate commit message")
    return subject, body


def _strip_markdown_fence(value: str) -> str:
    stripped = value.strip()
    if not stripped.startswith("```"):
        return stripped
    lines = stripped.splitlines()
    if len(lines) >= 2 and lines[-1].strip() == "```":
        return "\n".join(lines[1:-1])
    return stripped


def is_sensitive_path(path: str) -> bool:
    name = Path(path).name.lower()
    return name in _SENSITIVE_NAMES or name.startswith(".env.") or name.endswith(_SENSITIVE_SUFFIXES)


def _require_git_root(workspace: str | None, workspace_root_func) -> Path:
    if not workspace:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Select a workspace before using Git commit tools")
    root = workspace_root_func(workspace)
    if not root:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selected workspace is not a Git repository")
    return root


def _git(
    root: Path,
    args: list[str],
    *,
    input_text: str | None = None,
    env: dict[str, str] | None = None,
) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(
            ["git", "-C", str(root), *args],
            check=True,
            capture_output=True,
            text=True,
            input=input_text,
            env=env,
            timeout=20,
        )
    except subprocess.CalledProcessError as exc:
        detail = (exc.stderr or exc.stdout or "Git command failed").strip()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail) from exc
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Git command timed out") from exc


def _parse_branch(output: str) -> tuple[str | None, int | None, int | None]:
    first = next((line for line in output.splitlines() if line.startswith("## ")), None)
    if not first:
        return None, None, None
    value = first[3:]
    branch = value.split("...", 1)[0].strip() or None
    ahead = _parse_count(value, "ahead")
    behind = _parse_count(value, "behind")
    return branch, ahead, behind


def _parse_count(value: str, label: str) -> int | None:
    match = re.search(rf"{label} (\d+)", value)
    return int(match.group(1)) if match else None


def _parse_status_files(root: Path, output: str) -> list[GitStatusFile]:
    files: list[GitStatusFile] = []
    for line in output.splitlines():
        if not line or line.startswith("## ") or len(line) < 3:
            continue
        x, y = line[0], line[1]
        value = line[3:]
        old_path = None
        path = value
        if " -> " in value:
            old_path, path = value.split(" -> ", 1)

        if x == "A" and y == "D":
            # A file that was added to the index and then removed from the working
            # tree has no net working-tree change. IDE commit panels hide this
            # ghost entry instead of showing the same path as created + deleted.
            continue
        if x == "?" and y == "?":
            files.append(GitStatusFile(path=_safe_relative_path(path), area="untracked", status="untracked", untracked=True))
            continue
        if x != " " and x != "?":
            files.append(GitStatusFile(
                path=_safe_relative_path(path),
                oldPath=old_path,
                area="staged",
                status=_STATUS_LABELS.get(x, "edited"),
                staged=True,
                binary=_is_binary_path(root / path),
            ))
        if y != " " and y != "?":
            files.append(GitStatusFile(
                path=_safe_relative_path(path),
                oldPath=old_path,
                area="unstaged",
                status=_STATUS_LABELS.get(y, "edited"),
                unstaged=True,
                binary=_is_binary_path(root / path),
            ))
    return files


def _attach_numstat(root: Path, files: list[GitStatusFile]) -> None:
    stat_by_key: dict[tuple[str, str], tuple[int | None, int | None]] = {}
    for area, args in (("staged", ["diff", "--cached", "--numstat", "--"]), ("unstaged", ["diff", "--numstat", "--"])):
        result = _git(root, args)
        for line in result.stdout.splitlines():
            parts = line.split("\t")
            if len(parts) < 3:
                continue
            additions, deletions, path = parts[0], parts[1], parts[-1]
            stat_by_key[(area, path)] = (_parse_numstat(additions), _parse_numstat(deletions))
    for file in files:
        if file.area == "untracked":
            file.additions = count_text_lines(root / file.path)
            file.deletions = 0
            file.binary = _is_binary_path(root / file.path)
            continue
        additions, deletions = stat_by_key.get((file.area, file.path), (None, None))
        file.additions = additions
        file.deletions = deletions
        if additions is None or deletions is None:
            file.binary = True


def _parse_numstat(value: str) -> int | None:
    return None if value == "-" else int(value)


def _validate_selection(root: Path, selection: list[GitFileSelection], *, workspace_root_func) -> list[GitFileSelection]:
    status_response = git_status(str(root), workspace_root_func=workspace_root_func)
    available = {(file.area, file.path) for file in status_response.files}
    selected: list[GitFileSelection] = []
    for item in selection:
        path = _safe_relative_path(item.path)
        if (item.area, path) not in available:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Selected file is not changed: {path}")
        selected.append(GitFileSelection(path=path, area=item.area))
    return selected


def _diff_file(root: Path, item: GitFileSelection, *, max_patch_bytes_per_file: int) -> GitDiffFile:
    status_file = next(file for file in git_status(str(root)).files if file.area == item.area and file.path == item.path)
    if item.area == "untracked":
        patch = untracked_file_patch(root, item.path)
    else:
        args = ["diff", "--binary"]
        if item.area == "staged":
            args.append("--cached")
        args.extend(["--", item.path])
        patch = _git(root, args).stdout or None

    truncated = False
    if patch:
        encoded = patch.encode("utf-8", errors="ignore")
        if len(encoded) > max_patch_bytes_per_file:
            patch = encoded[:max_patch_bytes_per_file].decode("utf-8", errors="ignore")
            truncated = True

    return GitDiffFile(
        path=item.path,
        oldPath=status_file.oldPath,
        area=item.area,
        status=status_file.status,
        patch=patch,
        additions=status_file.additions or 0,
        deletions=status_file.deletions or 0,
        truncated=truncated,
        binary=status_file.binary,
    )


def _diff_fingerprint(files: list[GitDiffFile]) -> str:
    digest = hashlib.sha256()
    for file in files:
        digest.update(file.area.encode())
        digest.update(b"\0")
        digest.update(file.path.encode())
        digest.update(b"\0")
        digest.update(file.status.encode())
        digest.update(b"\0")
        digest.update(str(file.additions).encode())
        digest.update(b"\0")
        digest.update(str(file.deletions).encode())
        digest.update(b"\0")
        digest.update((file.patch or "").encode())
        digest.update(b"\0")
    return digest.hexdigest()

def _safe_relative_path(path: str) -> str:
    if path.startswith("/") or "\0" in path:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid file path")
    candidate = PurePosixPath(path)
    if any(part == ".." for part in candidate.parts):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid file path")
    return path


def _is_binary_path(path: Path) -> bool:
    try:
        return b"\0" in path.read_bytes()[:8192]
    except Exception:
        return False


def _selection_warnings(selection: Iterable[GitFileSelection]) -> list[str]:
    sensitive = [item.path for item in selection if is_sensitive_path(item.path)]
    return [f"Sensitive files selected: {', '.join(sensitive)}"] if sensitive else []


def _commit_rules_source(root: Path) -> str:
    for relative, _content in _commit_rule_files(root):
        return relative
    return "Conventional Commits"


def _should_enforce_conventional_subject(root: Path | None) -> bool:
    if root is None:
        return True
    rules = _read_commit_rules(root)
    if not rules:
        return True
    return "conventional commit" in rules.lower() or "commitlint" in rules.lower()


def _read_commit_rules(root: Path) -> str:
    return "\n\n".join(content for _relative, content in _commit_rule_files(root))


def _commit_rule_files(root: Path) -> list[tuple[str, str]]:
    files: list[tuple[str, str]] = []
    for relative in _RULE_FILES:
        path = root / relative
        if not path.is_file():
            continue
        try:
            content = path.read_text(encoding="utf-8", errors="ignore")[:40_000]
        except Exception:
            continue
        if _is_commit_rule_content(relative, content):
            files.append((relative, content))
    return files


def _is_commit_rule_content(relative: str, content: str) -> bool:
    if relative.startswith(".commitlintrc") or relative.startswith("commitlint.config") or relative == "docs/commit-messages.md":
        return True
    normalized = content.lower()
    return any(marker in normalized for marker in ("commit message", "commit messages", "conventional commit", "conventional commits"))
