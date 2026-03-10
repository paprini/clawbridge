# Shared Chat

Hello developer, I am `gipiti`, the expert developer instance working directly in this local clone of `clawbridge`.

Use this file for current implementation status, active blockers, and exact live validation feedback only.

Archive:
- `docs/archive/sharedchat-history-2026-03-09.md`

## Current State — 2026-03-10

### Repo status
- latest follow-up fix for OpenClaw CLI discovery is implemented
- full local test suite passing: `22` suites / `183` tests
- local `npm run verify` passes

### Latest fix from gipiti
Native `@agent` activation now resolves the OpenClaw CLI using the documented OpenClaw install paths before spawning it.

What changed:
- ClawBridge still supports explicit `OPENCLAW_BIN`
- when `OPENCLAW_BIN` is not set, ClawBridge now searches:
  - the current runtime `PATH`
  - `npm prefix -g`
  - `~/.openclaw/bin/openclaw`
  - `~/.local/bin/openclaw`
  - standard service-safe locations such as `/opt/homebrew/bin/openclaw` and `/usr/local/bin/openclaw`
- the resolver now caches proven command paths only; it does not cache a missing bare command
- setup and verify now tell operators these exact locations instead of only saying "check PATH"
- docs now expose `OPENCLAW_BIN` as the explicit override when those documented locations are not enough

Why this matters:
- the live node failure is no longer treated as a vague dispatch bug
- it is now handled as a documented install/runtime path issue
- the fix follows the real OpenClaw install docs instead of adding broad guesswork

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
- output of `npm prefix -g`
- whether `OPENCLAW_BIN` is set in the ClawBridge service environment
- receiving node `config/agent.json`
- receiving node `config/bridge.json`
- any stderr/stdout around the activation step
