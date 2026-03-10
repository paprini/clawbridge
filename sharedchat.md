# Shared Chat

Hello developer, I am `gipiti`, the expert developer instance working directly in this local clone of `clawbridge`.

Use this file for current implementation status, active blockers, and exact live validation feedback only.

Archive:
- `docs/archive/sharedchat-history-2026-03-09.md`

## Current State — 2026-03-10

### Repo status
- latest follow-up fix implemented after the live `spawn openclaw ENOENT` report
- full local test suite passing: `22` suites / `182` tests
- local `npm run verify` passes

### Latest fix from gipiti
Native `@agent` activation now resolves the OpenClaw CLI more robustly before spawning it.

What changed:
- ClawBridge still supports explicit `OPENCLAW_BIN`
- when `OPENCLAW_BIN` is not set, ClawBridge now searches:
  - the current runtime `PATH`
  - common absolute install locations such as `/opt/homebrew/bin/openclaw`, `/usr/local/bin/openclaw`, `/usr/bin/openclaw`, `~/.local/bin/openclaw`, and `~/bin/openclaw`
- verify now fails with the resolved binary path when native activation is enabled but OpenClaw CLI is not actually discoverable
- docs now expose `OPENCLAW_BIN` as a supported runtime override

Why this matters:
- the live node failure was no longer logic or routing
- it was runtime command resolution under a service environment with a different `PATH`
- this fix removes the PATH-only assumption

### Next live validation needed
Please pull latest `main` on the live nodes and re-test:

```js
chat({ target: "@monti-telegram", message: "Hola... respondeme..." })
```

Expected result now:
- visible inbound delivery still works
- native local agent activation no longer fails with `spawn openclaw ENOENT`
- target agent visibly replies in the same destination
- ClawBridge returns `agent_dispatch: "activated"`

### If it still fails
Please report back with:
- exact returned JSON
- output of `which openclaw`
- output of `openclaw --version`
- whether `OPENCLAW_BIN` is set in the ClawBridge service environment
- receiving node `config/agent.json`
- receiving node `config/bridge.json`
- any stderr/stdout around the activation step

---

## Live Feedback: improve native activation runtime handling + post an update

Latest live Discord -> Telegram result on current build:

```json
{
  "error": "Message was delivered, but receiving agent activation failed.",
  "transport_delivered": true,
  "agent_dispatch": "error",
  "details": "OpenClaw CLI not found at \"openclaw\". Set OPENCLAW_BIN or install the binary in PATH."
}
```

### What this means
This is good progress because the error is now explicit and actionable, but the runtime path still is not robust enough for real-node deployment.

### Requested improvements
Please improve this area so real installs are smoother:

1. make native activation more robust against runtime PATH differences
2. improve setup/verify so this is caught before live testing
3. support/guide `OPENCLAW_BIN` cleanly
4. post a short status update in this file after you push the next fix

### Why
We no longer have a vague dispatch bug — we now have a concrete deployment/runtime integration issue. Please tighten that experience and then tell us exactly what changed and what to test next.

