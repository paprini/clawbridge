# Shared Chat

Hello developer, I am `gipiti`, the expert developer instance working directly in this local clone of `clawbridge`.

Use this file for the **single current blocker** and the **latest live validation state only**.
Archive everything else.

Archive:
- `docs/archive/sharedchat-history-2026-03-09.md`

## Current State — 2026-03-10

### Repo / release status
- current release line: `0.2.0`
- latest local fix commit: `3887102` plus follow-up generic-id hardening in current local branch
- local verify: `19/19` passing
- full local suite: `23` suites / `203` tests passing
- two-instance relay harness: passing in both unique-id and generic-id scenarios
- install/update path is working

### What is now confirmed working on live nodes
- peer auth ✅
- peer ping ✅
- `@agent-name` routing ✅
- visible inbound delivery ✅
- native/local agent activation ✅
- correct local agent selection (`main`) ✅
- local response generation quality ✅

### Single remaining blocker
**Need one new live retest of cross-agent reply relay after the generic-id relay fix.**

---

## Latest fix from gipiti

### Actual root cause isolated locally
The reply relay path was still dropping a real remote peer when that peer's configured id matched the local `agent.json.id`.

This happened in two places:
- authenticated peer ids were being normalized away when they equaled the local agent id
- URL-based peer matching also discarded the matched peer id for the same reason

That makes generic installations like `main` / `main` fail with:
- `reply_relay: "not_requested"`
- `reply_relay_peer: null`

even though the metadata is present and the remote agent really did activate.

### What changed
- reply relay peer resolution in `src/skills/chat.js` no longer throws away a peer id just because it matches the local `agent.id`
- same-id peers are now allowed when they are backed by:
  - authenticated peer identity
  - URL match to a configured remote peer
  - explicit remote source URL distinct from the local agent URL
- true local self-cases are still suppressed
- `src/verify.js` now fails if `peers.json` reuses the local `agent.json.id`, because `@agent-name` routing becomes ambiguous on the source side even though reply relay can now recover the return leg

### Why this is the right fix
- it matches the real semantics: peer ids and local agent ids are different namespaces
- it fixes the exact `reply_relay: "not_requested"` class without changing the public `chat` contract
- it adds an explicit guard for the separate ambiguous-addressing misconfiguration instead of letting that surface later as a confusing live bug

### Local validation
- `npm test -- --runInBand` → `23` suites / `203` tests passing
- `npm run test:two-instance` → passing
- `npm run verify` → `19/19` passing

### New regression proof added
- unit coverage for reply relay when the remote peer id equals the local agent id
- unit coverage for URL-based fallback in the same-id case
- unit coverage proving true local self-metadata still does **not** trigger reply relay
- two-instance integration coverage where both installations use `agent.id = "main"` and the return-leg relay still succeeds

### Current ask
Please pull latest `main` and re-test the same Telegram ↔ Discord flow.

Expected result now:
- `agent_dispatch: "activated"`
- `openclaw_result: "ok"`
- `reply_relay: "delivered"`
- `reply_relay_peer` set to the real origin peer id

If it still fails, please report only:
- exact returned JSON
- sending node `config/agent.json`
- receiving node `config/agent.json`
- both nodes `config/peers.json`
- both nodes `npm run verify`
- log lines containing:
  - `reply_relay`
  - `reply_relay_peer`
  - `sourceAgentId`
  - `sourceUrl`

The code path is now locally proven. The remaining question is the live-node retest only.
