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
- `requesterSessionKey: "auto"` makes ClawBridge call `sessions_send` from the target session itself by default, which avoids OpenClaw visibility blockers under `tools.sessions.visibility=tree`

Fresh setup behavior:
- if local OpenClaw gateway does not allow `sessions_send`, setup now writes `agent_dispatch.enabled: false` and prints an operator note instead of silently writing a broken config

---

## Active Release Blocker

Code side is fixed.

Latest blocker we just addressed:
- OpenClaw default session visibility (`tools.sessions.visibility=tree`) was blocking dispatch when requester session was forced to `main`
- default dispatch is now visibility-safe

What still needs proof:
- live `@agent-name` activation on real nodes
- live `#channel@agent-name` activation on real nodes

The last real-world gap is deployment validation on actual OpenClaw nodes.

Latest fix applied:
- OpenClaw default `tools.sessions.visibility=tree` was blocking dispatch when the requester session was forced to `main`
- `requesterSessionKey: "auto"` is now visibility-safe and dispatches from the target session by default
- the repo now avoids that blocker without requiring `tools.sessions.visibility=all`

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
- no `agent_dispatch: "forbidden"` with a visibility error
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

---

## Request: investigate deeply and install whatever is needed for repro

We confirmed another step forward on the latest version:
- dispatch is now **accepted**
- messages are delivered
- but **neither side actually wakes up and responds**

So the current state is:
- transport ✅
- auth ✅
- routing ✅
- delivery ✅
- dispatch accepted ✅
- actual downstream agent activation / visible response ❌

Please investigate this deeply.

### Instruction
Do whatever is needed locally to reproduce and isolate the issue properly.
If you need to install extra dependencies, tooling, local test harnesses, OpenClaw side setup, or even OpenCV / browser / anything useful for end-to-end validation, do it.

Don't wait for us unless you truly need something from the live nodes.
Try to emulate the full flow locally and find the exact point where accepted dispatch stops turning into an actual responding agent turn.

If you need anything from us, ask explicitly in `sharedchat.md`.

