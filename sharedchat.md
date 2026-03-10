# Shared Chat

Hello developer, I am `gipiti`, the expert developer instance working directly in this local clone of `clawbridge`.

Use this file for current implementation status, active blockers, and exact live validation feedback only.

Archive:
- `docs/archive/sharedchat-history-2026-03-09.md`

## Current State — 2026-03-10

### Repo status
- latest fix implemented locally on top of current `origin/main`
- focused unit coverage updated for the new dispatch path
- local `npm run verify` no longer depends on `sessions_send` allowlisting

### What changed now
- inbound `@agent-name` activation no longer uses OpenClaw `sessions_send`
- ClawBridge now:
  - posts the visible inbound message with the existing `message` bridge path
  - inspects `sessions_list` to find the best matching OpenClaw session row
  - if a matching session row exists, uses its `sessionId`
  - activates the local OpenClaw agent through the native `openclaw agent` command with:
    - explicit `--session-id` when known
    - explicit `--reply-channel`
    - explicit `--reply-to`
- this removes the old best-effort announce dependency and the false-success `accepted` case

### Why this should fix the live bug
- the old path depended on `sessions_send` queueing a hidden run and then guessing the final announce target from session metadata
- the new path activates the target agent directly and tells OpenClaw exactly where the visible reply must be delivered
- `gateway.tools.allow -> sessions_send` is no longer the blocker for `@agent` activation

### Next live validation needed
Please pull latest `main` on the live nodes and re-test:

```js
chat({ target: "@monti-telegram", message: "Hola... contestame..." })
```

Expected result now:
- target side still receives the visible inbound message
- target agent visibly replies in the same destination
- ClawBridge should return `agent_dispatch: "activated"` instead of `accepted` / `manual_reply`

### If it still fails
Please report back with:
- exact returned JSON
- whether the target side received the visible reply or only the inbound message
- output of `openclaw --version`
- target node `config/agent.json`
- target node `config/bridge.json`
- any stderr/stdout from the target node around the `openclaw agent` activation step

---

## Live Result: native activation path now fails with `spawn openclaw ENOENT`

Latest live Discord -> Telegram retest on commit `11fd53d`:

```js
chat({ target: "@monti-telegram", message: "Hola... respondeme..." })
```

Returned:

```json
{
  "error": "Message was delivered, but receiving agent activation failed.",
  "transport_delivered": true,
  "agent_dispatch": "error",
  "details": "spawn openclaw ENOENT"
}
```

### Interpretation
This is now a very concrete runtime issue.
The new native activation path is trying to spawn the `openclaw` CLI, but on the receiving node/runtime environment that binary is not found in PATH.

### What this means
The remaining blocker is no longer logical dispatch design — it is now runtime command resolution for the native `openclaw` activation path.

### Likely fixes
Please make the native activation path robust against PATH differences, e.g.:
- resolve `openclaw` via absolute path when known
- discover it from the current runtime environment
- allow configurable binary path
- fail verify/setup clearly if native activation is enabled but `openclaw` CLI is not resolvable

### Current state summary
- ping ✅
- delivery ✅
- peer routing ✅
- native activation path reached ✅
- actual activation blocked by `spawn openclaw ENOENT` ❌

