# Hermes Agent Nuxt Chat Prototype

This directory contains the project-local prototype for a native Nuxt UI chat interface for Hermes Agent.

Do **not** edit `$HOME/.hermes/hermes-agent` directly during prototype work. Treat this repository as the source of truth and move changes with normal git workflow.

## Layout

```text
backend/
  hermes_cli/web_chat.py                    # proposed FastAPI router
  tests/hermes_cli/test_web_chat.py         # proposed pytest coverage
web/                                        # Nuxt UI prototype
```

## Implemented backend prototype

- `GET /api/web-chat/sessions`
- `POST /api/web-chat/sessions`
- `GET /api/web-chat/sessions/{session_id}`
- `POST /api/web-chat/runs`
- `GET /api/web-chat/runs/{run_id}/events` via SSE
- `POST /api/web-chat/runs/{run_id}/stop`

The run executor is intentionally injectable. The current default emits a placeholder assistant response; wiring to the real `AIAgent` should happen only after explicit approval to integrate these changes into the real Hermes repo or in a disposable worktree.

## Implemented Nuxt prototype

- Nuxt 4 static SPA in `web/`.
- Nuxt UI dashboard shell/sidebar.
- New chat page.
- Chat detail page using `UChatMessages`, `UChatPrompt`, `UChatPromptSubmit`, `UChatReasoning`, `UChatTool`, and `Comark`.
- EventSource/SSE composable for run streaming and stop handling.
- Authenticated `$fetch` helper using injected `window.__HERMES_SESSION_TOKEN__`.

## Development workflow

Use two different run modes depending on whether you need live UI iteration or a static Hermes-integrated preview.

### 1. Nuxt watch mode for frontend development

Use this when editing files under `web/` and you want automatic refresh without restarting the server.

```bash
cd web
pnpm install
pnpm dev
```

Nuxt starts on `http://127.0.0.1:3019/`.

- This is the normal frontend development mode.
- Changes in `web/app/**` are picked up automatically via Nuxt/Vite HMR.
- You do not need to rerun the command after each change.
- API requests still target the current origin under `/api/...`, so this mode is best for UI work unless you also wire a backend alongside it.

### 2. Hermes-integrated local preview

Use this when you want to launch the disposable Hermes runtime and serve the built Nuxt app through Hermes:

```bash
./run-local.sh
```

Important behavior:

- `run-local.sh` does not run Nuxt in watch mode.
- It installs dependencies if needed and serves the built output from `web/.output/public`.
- If you change frontend files while `run-local.sh` is already running, those changes will not appear until you rebuild and restart.

### 3. Backend watch mode for Python changes

Use this when you are editing Python files and want Hermes to restart automatically:

```bash
./run-local.sh --watch
```

Important behavior:

- This watches Python files in `backend/` and in the upstream Hermes checkout from `HERMES_AGENT_SOURCE` or `$HOME/.hermes/hermes-agent`.
- When a watched `.py` file changes, the Hermes dashboard process is restarted automatically.
- This is an autorestart loop, not hot module replacement. Existing in-memory session state is lost on each restart.
- Frontend files are still static in this mode. For live frontend refresh, keep using `pnpm dev` in `web/`.

If you need to refresh the static build manually:

```bash
cd web
pnpm build
```

Then stop and start `./run-local.sh` again.

### Recommended day-to-day loop

For normal UI development:

1. Run `pnpm dev` inside `web/`.
2. Keep that process running while editing.
3. Open `http://127.0.0.1:3019/`.
4. Use `./run-local.sh --watch` when you are iterating on Python backend changes.
5. Use `./run-local.sh` only when you specifically need to verify the Hermes-served static integration without the watcher.

## Verification run

Backend verified by applying the prototype into a temporary local clone of `$HOME/.hermes/hermes-agent`, using the real Hermes venv, and deleting the temporary clone afterwards:

```bash
6 passed in 1.12s
```

Frontend verification from `web/`:

```bash
pnpm typecheck
# exit 0, with existing vue-router/volar package export warning

pnpm build
# Build complete
```

Real Hermes repo cleanliness check after verification:

```bash
git -C "$HOME/.hermes/hermes-agent" status --short
# M web/package-lock.json
```

Only the pre-existing `web/package-lock.json` change remains in the real Hermes repo.
