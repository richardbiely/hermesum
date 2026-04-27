# Hermesum

Hermesum is a native web chat prototype for Hermes Agent: a cleaner, faster, more product-like interface for running agent conversations, streaming responses, tracking tool calls, and reviewing workspace changes in one place.

It combines:

- a modern web frontend built for a focused chat experience
- a FastAPI web-chat API designed to mirror real Hermes runtime behavior
- a local runtime bridge that patches a disposable Hermes copy instead of touching your real checkout

## Preview

<p>
  <img src="docs/assets/agent1.png" alt="Hermesum chat preview" width="49%">
  <img src="docs/assets/agent2.png" alt="Hermesum workspace changes preview" width="49%">
</p>

## Why Hermesum

Hermes Agent is powerful, but the prototype goal here is not just "make it work in a browser". The goal is to make it feel like a real product:

- chat-first UX for day-to-day agent work
- streaming responses over SSE with explicit run lifecycle handling
- queued follow-up messages and steerable in-flight runs
- visible reasoning and tool-call output
- first-class workspace diff and git-changes visibility
- workspace-aware sessions and project switching
- attachment upload and inline preview
- disposable runtime integration for safe local iteration

If someone lands on this repository, they should immediately understand that Hermesum is a serious prototype for a native Hermes chat experience, not a throwaway demo.

## What Exists Today

### Frontend

- web chat UI in [`web/`](web)
- SSE run streaming with explicit stop handling
- queued messages support for chat continuation and steer flows
- authenticated same-origin API access
- workspace/session management flows
- git changes and workspace change review surfaces
- attachment chips, previews, and tool-call detail views

### Backend

- `GET /api/web-chat/sessions`
- `POST /api/web-chat/sessions`
- `GET /api/web-chat/sessions/{session_id}`
- `POST /api/web-chat/runs`
- `GET /api/web-chat/runs/{run_id}/events`
- `POST /api/web-chat/runs/{run_id}/stop`
- `POST /api/web-chat/attachments`
- `GET /api/web-chat/attachments/{attachment_id}`
- `GET /api/web-chat/attachments/{attachment_id}/content`
Attachments uploaded from the UI are stored in the selected project under `.hermes/attachments/`, ignored by git in this prototype. Images render inline, other files use the authenticated content endpoint when supported by the browser, and deleted files remain visible in history as unavailable placeholders.

The backend is built around explicit run management, SSE event streaming, and queue-backed prompt/response handling so interactive runs can be stopped, continued, and coordinated predictably.

Hermesum also emphasizes workspace-aware `git changes` visibility. The prototype is designed to make code and file modifications easier to inspect from the chat experience instead of hiding them behind the agent runtime.

## Safety Model

Hermesum treats this repository as the source of truth for prototype work.

- Do not edit `$HOME/.hermes/hermes-agent` directly.
- Runtime integration happens through the disposable `.runtime/hermes-agent` copy created by [`run-local.sh`](run-local.sh).
- The upstream Hermes checkout is copied from, not mutated as part of normal development.

This keeps the prototype portable and makes later upstreaming into the real Hermes repository much safer.

## Quick Start

### Full dev mode

For normal frontend + backend work:

```bash
./run-local.sh --dev
```

Then open `http://127.0.0.1:3019/`.

This mode:

- starts the Hermes backend/dashboard runtime on `http://127.0.0.1:9119`
- starts the frontend dev server on `http://127.0.0.1:3019`
- proxies `/api/...` requests to Hermes
- shares an ephemeral dev session token for authenticated API and SSE calls
- reloads frontend changes through Vite HMR
- restarts the backend when watched Python files change

Useful override:

```bash
PORT=9120 WEB_DEV_PORT=3020 ./run-local.sh --dev
```

### Frontend-only mode

For isolated UI work:

```bash
cd web
pnpm install
pnpm dev
```

### Hermes-served static preview

For production-style preview through the disposable Hermes runtime:

```bash
./run-local.sh
```

## Repo Structure

```text
backend/
  hermes_cli/web_chat.py                    # thin FastAPI entrypoint
  hermes_cli/web_chat_modules/              # modular backend domains
  tests/hermes_cli/test_web_chat*.py        # split pytest coverage by domain
web/                                        # Nuxt UI prototype
run-local.sh                                # local runtime orchestration
.runtime/                                   # disposable generated runtime state
```

Key frontend areas include chat rendering, queued-message flows, attachments, tool-call details, git changes, and workspace/session UX. Key backend areas include routes, Pydantic models, run lifecycle, SSE streaming, queue-backed prompts, attachments, workspaces, and git-change persistence.

## Development Notes

- Frontend development should normally use `./run-local.sh --dev`, not repeated static builds.
- Python restarts in watch/dev mode can interrupt in-flight SSE streams.
- Shared request/response shapes should stay aligned between backend Pydantic models and frontend TypeScript types.
- When backend payloads change, update backend models, API behavior, frontend types, frontend composables, and tests together.

## Verification

Frontend verification from [`web/`](web):

```bash
pnpm typecheck
pnpm build
```

Backend syntax verification:

```bash
python3 -m py_compile backend/hermes_cli/web_chat.py backend/hermes_cli/web_chat_modules/*.py backend/tests/hermes_cli/test_web_chat*.py backend/tests/hermes_cli/conftest.py backend/tests/hermes_cli/web_chat_test_helpers.py
```

Latest recorded verification status for this prototype:

```bash
pytest: 6 passed in 1.12s
pnpm typecheck: exit 0
pnpm build: complete
```

## Positioning

Hermesum is not trying to replace Hermes Agent internals. It is a prototype for a better operator experience on top of them: more understandable, more approachable, and much closer to something people would actually want to use every day.
