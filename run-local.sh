#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UPSTREAM="${HERMES_AGENT_SOURCE:-/Users/pavolbiely/.hermes/hermes-agent}"
RUNTIME="$ROOT/.runtime/hermes-agent"
WEB="$ROOT/web"
PORT="${PORT:-9119}"
PYTHON="$UPSTREAM/venv/bin/python"

if [[ ! -x "$PYTHON" ]]; then
  echo "Missing Hermes venv python: $PYTHON" >&2
  exit 1
fi

if [[ ! -f "$UPSTREAM/hermes_cli/web_server.py" ]]; then
  echo "Missing Hermes source checkout: $UPSTREAM" >&2
  exit 1
fi

echo "Preparing disposable Hermes runtime copy under: $RUNTIME"
mkdir -p "$ROOT/.runtime"
rsync -a --delete \
  --exclude '.git' \
  --exclude '.mypy_cache' \
  --exclude '.pytest_cache' \
  --exclude '__pycache__' \
  "$UPSTREAM/" "$RUNTIME/"

cp "$ROOT/backend/hermes_cli/web_chat.py" "$RUNTIME/hermes_cli/web_chat.py"
mkdir -p "$RUNTIME/tests/hermes_cli"
cp "$ROOT/backend/tests/hermes_cli/test_web_chat.py" "$RUNTIME/tests/hermes_cli/test_web_chat.py"

RUNTIME_WEB_SERVER="$RUNTIME/hermes_cli/web_server.py" RUNTIME_HERMES_STATE="$RUNTIME/hermes_state.py" "$PYTHON" - <<'PY'
from pathlib import Path
import os

path = Path(os.environ["RUNTIME_WEB_SERVER"])
text = path.read_text()

if "from hermes_cli.web_chat import router as web_chat_router" not in text:
    needle = 'WEB_DIST = Path(os.environ["HERMES_WEB_DIST"]) if "HERMES_WEB_DIST" in os.environ else Path(__file__).parent / "web_dist"'
    text = text.replace(needle, 'from hermes_cli.web_chat import router as web_chat_router\n\n' + needle, 1)

if "app.include_router(web_chat_router)" not in text:
    text = text.replace(
        "# Mount plugin API routes before the SPA catch-all.\n_mount_plugin_api_routes()",
        "# Mount built-in and plugin API routes before the SPA catch-all.\napp.include_router(web_chat_router)\n_mount_plugin_api_routes()",
        1,
    )

if 'request.query_params.get("session_token", "")' not in text:
    needle = """    if session_header and hmac.compare_digest(\n        session_header.encode(),\n        _SESSION_TOKEN.encode(),\n    ):\n        return True\n\n"""
    replacement = needle + """    if request.url.path.startswith("/api/web-chat/runs/") and request.url.path.endswith("/events"):\n        session_token = request.query_params.get("session_token", "")\n        if session_token and hmac.compare_digest(session_token.encode(), _SESSION_TOKEN.encode()):\n            return True\n\n"""
    text = text.replace(needle, replacement, 1)

path.write_text(text)

state_path = Path(os.environ["RUNTIME_HERMES_STATE"])
state_text = state_path.read_text()

if "def update_session_model_settings(" not in state_text:
    needle = """    def update_system_prompt(self, session_id: str, system_prompt: str) -> None:\n        \"\"\"Store the full assembled system prompt snapshot.\"\"\"\n        def _do(conn):\n            conn.execute(\n                \"UPDATE sessions SET system_prompt = ? WHERE id = ?\",\n                (system_prompt, session_id),\n            )\n        self._execute_write(_do)\n"""
    replacement = needle + '''

    def update_session_model_settings(
        self,
        session_id: str,
        *,
        model: Optional[str] = None,
        model_config_updates: Optional[Dict[str, Any]] = None,
    ) -> None:
        \"\"\"Update session-level model settings while preserving other config.\"\"\"

        def _do(conn):
            cursor = conn.execute(
                \"SELECT model_config FROM sessions WHERE id = ?\",
                (session_id,),
            )
            row = cursor.fetchone()
            model_config: Dict[str, Any] = {}
            if row and row[\"model_config\"]:
                try:
                    parsed = json.loads(row[\"model_config\"])
                except Exception:
                    parsed = None
                if isinstance(parsed, dict):
                    model_config = parsed

            if model_config_updates:
                for key, value in model_config_updates.items():
                    if value is None:
                        model_config.pop(key, None)
                    else:
                        model_config[key] = value

            conn.execute(
                \"\"\"UPDATE sessions
                   SET model = COALESCE(?, model),
                       model_config = ?
                   WHERE id = ?\"\"\",
                (
                    model,
                    json.dumps(model_config) if model_config else None,
                    session_id,
                ),
            )

        self._execute_write(_do)
'''
    state_text = state_text.replace(needle, replacement, 1)

state_path.write_text(state_text)
PY

if [[ ! -d "$WEB/node_modules" ]]; then
  echo "Installing Nuxt dependencies..."
  (cd "$WEB" && pnpm install --frozen-lockfile)
fi

if [[ ! -d "$WEB/.output/public" ]]; then
  echo "Building Nuxt static app..."
  (cd "$WEB" && pnpm build)
fi

# Hermes' current SPA mount expects /assets to exist. Nuxt static output mainly uses /_nuxt.
mkdir -p "$WEB/.output/public/assets"

echo "Starting Hermes dashboard with Nuxt prototype on http://127.0.0.1:$PORT"
echo "Runtime copy: $RUNTIME"
echo "Source checkout is only read/copied, not modified: $UPSTREAM"
cd "$RUNTIME"
HERMES_WEB_DIST="$WEB/.output/public" "$PYTHON" -m hermes_cli.main dashboard --port "$PORT"
