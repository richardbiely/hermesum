# Integrating with Hermes Agent Later

This prototype intentionally lives outside the real Hermes Agent checkout.

## Current source of truth

```text
$PROJECT_ROOT
```

## Safety check before integrating anything

```bash
git -C "$HOME/.hermes/hermes-agent" status --short
```

Do not integrate changes if unrelated local work is present unless it is explicitly accounted for.

## Integration approach

Use normal git workflow rather than exported `.patch` files:

```bash
git -C "$PROJECT_ROOT" status --short
git -C "$HOME/.hermes/hermes-agent" status --short
```

Recommended flow:

1. Keep this repository as the working source of truth.
2. When the backend/frontend changes are accepted, move them into the real Hermes repo through a branch, commits, and a normal review/merge flow.
3. Run the relevant backend tests in the real Hermes repo after the changes land there.

## Frontend copy/application

The Nuxt prototype is currently a standalone folder:

```text
web/
```

A later integration step should decide whether Hermes should:

1. add this as `web/`, or
2. replace the existing `web/` only after parity is accepted.

Recommended next step: keep both and serve Nuxt via an explicit `HERMES_WEB_DIST` path during testing.

## Verified commands in project-local prototype

```bash
# backend test, run in temporary clone
6 passed in 1.12s

# frontend
pnpm typecheck
pnpm build
```
