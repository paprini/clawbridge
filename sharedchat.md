# Shared Chat

Hello developer, I am `gipiti`, the expert developer instance working directly in this local clone of `clawbridge`.

Use this file for current implementation instructions, blockers, and live validation results only.
Older discussion was intentionally removed from this active thread.

Archive:
- `docs/archive/sharedchat-history-2026-03-09.md`

---

## Current State — 2026-03-10

Project:
- ClawBridge agent-to-agent networking for OpenClaw

Live shape:
- 3 deployed instances: Discord, Telegram, WhatsApp
- full-mesh ping working
- helper agent implemented
- cross-instance `chat` / `broadcast` path implemented

Validation:
- `21` test suites passing
- `172` tests passing

---

## Done

- bridge defaults and bridge-readiness errors fixed
- peer-specific token identity fixed
- contacts aliases and cross-platform relay support added
- peer management in setup added
- `@agent-name` and `#channel@agent-name` support added
- `default_delivery` added to `agent.json`
- inbound visible delivery plus OpenClaw agent activation path added
- `sessions_send` gateway allowlist verification added
- helper agent implemented as support-only, not as the live bridge
- docs and setup flow cleaned up

---

## Current Important Config

`config/bridge.json`

```json
{
  "enabled": true,
  "agent_dispatch": {
    "enabled": true,
    "sessionKey": "auto",
    "requesterSessionKey": "auto",
    "timeoutSeconds": 0
  }
}
```

Meaning:
- `sessionKey: "auto"` makes ClawBridge derive the correct agent-scoped OpenClaw target session
- `requesterSessionKey: "auto"` makes ClawBridge call `sessions_send` from the correct local agent main session

Fresh setup behavior:
- if local OpenClaw gateway does not allow `sessions_send`, setup now writes `agent_dispatch.enabled: false` and prints an operator note instead of silently writing a broken config

---

## Active Release Blocker

Code side is fixed.

What still needs proof:
- live `@agent-name` activation on real nodes
- live `#channel@agent-name` activation on real nodes

The last real-world gap is deployment validation on actual OpenClaw nodes.

---

## Required Live Validation

On each real node:

1. Pull latest `main`
2. Ensure `~/.openclaw/openclaw.json` includes:

```json
{
  "gateway": {
    "tools": {
      "allow": ["sessions_send"]
    }
  }
}
```

3. Restart the OpenClaw gateway
4. If setup was run before that allowlist existed:
   - re-run setup, or
   - set `config/bridge.json -> agent_dispatch.enabled = true`
5. Confirm `config/bridge.json -> agent_dispatch.sessionKey = "auto"`
6. Re-test:
   - `chat({ target: "@monti-telegram", message: "hello" })`
   - `chat({ target: "#lounge@guali-discord", message: "hello" })`
   - `broadcast({ message: "cross-instance check" })`

Expected result:
- no fake `Unknown dispatch error`
- visible delivery succeeds
- receiving agent is actually activated as a new turn

---

## If It Still Fails

Please report back with:
- exact returned JSON from the failing `chat`
- `config/bridge.json` from the receiving node
- relevant `~/.openclaw/openclaw.json` gateway section
- any OpenClaw gateway logs around `sessions_send`
- whether the failure is for:
  - `@agent-name`
  - `#channel@agent-name`
  - both

---

## Working Note

If live validation passes, the next step is not more architecture work.
It is final production confidence checks and release polish.
