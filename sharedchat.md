# Shared Chat

Hello developer, I am `gipiti`, the expert developer instance working directly in this local clone of `clawbridge`.

Use this file for **current implementation status, active blockers, and exact live validation feedback only**.
Do not keep stale debugging history here once it has been distilled.

Archive:
- `docs/archive/sharedchat-history-2026-03-09.md`

## Current State — 2026-03-10

### Repo status
- latest follow-up fix for OpenClaw CLI discovery is implemented
- full local test suite passing: `22` suites / `183` tests
- local `npm run verify` passes
- release workflow is now tag-driven
- repo has a real tagged release: `v0.2.0`

### Release status
- `package.json` is now `0.2.0`
- git tag `v0.2.0` was created through the checked release flow
- pushing a `v*` tag now triggers GitHub Actions to run `npm ci`, tests, verify, and publish a GitHub Release page
- maintainers now have:
  - `npm run release:patch`
  - `npm run release:minor`
  - `npm run release:major`
- release process docs are in `docs/RELEASING.md`

### Confirmed working on live nodes
- peer auth ✅
- peer ping ✅
- `@agent-name` routing ✅
- visible message delivery ✅
- native activation path runs ✅
- real inbound activation now happens at least sometimes ✅
- repo release/tag flow ✅

### Current blocker summary
Latest pass implemented the two live blockers reported after transport started working:
- pinned local agent identity on multi-agent installs
- reply relay back to the origin peer after activation

This now needs live-node confirmation, not more local speculation.

---

## Latest fix from gipiti

### What changed
- inbound `@agent` activation no longer lets delivery-channel bindings override the chosen local OpenClaw agent identity
- runtime now prefers:
  1. `bridge.agent_dispatch.agentId`
  2. `agent.json.openclaw_agent_id`
  3. the OpenClaw default agent
- it no longer falls back to "whoever owns the destination channel binding" when choosing the answering local agent
- `npm run setup` now detects local OpenClaw agents and asks which one this ClawBridge installation should bind to
- conversational setup can list the local OpenClaw agents before writing config
- `npm run verify` now fails on multi-agent installs if no explicit communications agent is pinned
- after local activation, ClawBridge now extracts reply text from the OpenClaw `--json` result and relays that reply back to the origin peer through normal `chat`

### Why this should fix the last two live bugs
- Bug 1 was caused by conflating:
  - who should answer
  - where the answer should be delivered
- those are now separated
- Bug 2 was caused by stopping at local visible activation
- the activated reply is now mirrored back to the source ClawBridge peer instead of staying local-only

### Local validation
- full suite passing: `22` suites / `189` tests
- `npm run verify` passing locally
- added regression coverage for:
  - wrong local agent selection on multi-agent installs
  - setup prompting for the local OpenClaw agent
  - reply relay back to the origin peer after activation

## Next live validation needed
Please pull latest `main` on the real nodes and re-test:

```js
chat({ target: "@guali-discord", message: "Hola... respondeme..." })
```

Expected result now:
- visible inbound delivery still happens on the receiving node
- the pinned local communications agent answers, not another agent that merely owns the destination channel binding
- the reply is relayed back to the origin peer instead of staying local-only
- ClawBridge returns `agent_dispatch: "activated"`
- result metadata should now include `reply_relay: "delivered"` when the reply text could be extracted and sent back

---

## If it still fails
Please report back with:
- exact returned JSON from both sides
- receiving node `config/agent.json`
- receiving node `config/bridge.json`
- source node `config/agent.json`
- source node `npm run verify`
- receiving node `npm run verify`
- log lines showing:
  - `openclawDispatchAgentId`
  - `openclawTargetSessionKey`
  - any `reply_relay` status or error
  - any remaining `⚠️ ✉️ Message` artifact

---

## Live Bug Update — correct agent now activates, but reply relay is still missing

Latest cross-node validation adds an important improvement from the Telegram side:

### Confirmed improvement
Telegram reported:
- message delivered ✅
- local agent `main` activated ✅
- this time it did **not** activate `musicate-pm`

So the multi-agent local routing bug appears improved/fixed in this path.

### Remaining bug
The reply still went to Discord locally instead of coming back through ClawBridge to Telegram.

Telegram-side feedback:
- response was sent to Discord
- no reply came back to Telegram via ClawBridge
- returned metadata suggested:
  - `reply_relay: "not_requested"`

### Interpretation
This strongly suggests the new version has a reply-relay capability/path, but the current flow is still not explicitly requesting or preserving reply relay for this peer-initiated exchange.

### Current state now
- peer auth ✅
- ping ✅
- routing ✅
- delivery ✅
- correct local agent activation (main) ✅
- reply relay back to origin peer ❌

### Updated blocker
The principal remaining blocker now appears to be:
**reply relay is not being requested / preserved / executed for peer-initiated conversations**

### What to inspect
Please inspect the path that sets or forwards reply-relay intent/context for:
- `chat({ target: "@peer", ... })`
- peer-initiated inbound activation
- downstream visible reply handling

The system now seems close: activation works, but the reply is still treated as local-only instead of being bridged back to the initiating peer.

