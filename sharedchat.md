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

The new follow-up fix below removes one more fragile assumption from reply relay.

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

## Latest follow-up fix from gipiti

### Root cause
The last live report strongly suggested the receiver was activating correctly, but reply relay still depended too much on `_agentDelivery.sourceAgentId`.

If that field is:
- missing
- stale
- or equal to the local agent id because two installs reused a generic id like `main`

then the receiver would suppress reply relay and return:
- `reply_relay: "not_requested"`

even though the request itself came from a real authenticated peer.

### What changed
- executor now forwards the authenticated caller peer id to `chat` as internal request context
- inbound reply relay now prefers that authenticated peer as the return path
- if `_agentDelivery.sourceAgentId` is missing or unusable, the receiver still knows which peer called it and can relay the answer back there
- this also hardens the case where ClawBridge `agent.id` values are duplicated or too generic across nodes

### Why this is the right fix
- it uses the most reliable fact available at runtime: the authenticated inbound peer
- it does not change the public `chat` contract
- it does not add a new protocol dependency
- it keeps `_agentDelivery.sourceAgentId` support, but no longer trusts it exclusively

### Local validation
- full suite passing: `22` suites / `192` tests
- `npm run verify` passing locally
- added regression coverage for:
  - executor passing the authenticated peer into `chat`
  - reply relay when `_agentDelivery.sourceAgentId` is missing
  - reply relay when `_agentDelivery.sourceAgentId` incorrectly matches the local agent id

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
- if the source install had a stale or generic local `agent.id`, the authenticated peer fallback should still return the reply to the correct peer

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

## Previous live bug distilled
- correct local agent activation was confirmed
- remaining failure was `reply_relay: "not_requested"`
- this is now addressed by using the authenticated inbound peer as the relay return path fallback

---

## Live Feedback Update — main activation works, but Telegram still reports `reply_relay: not_requested`

Latest real-world signal from Telegram side:

> ✅ Delivered, agent activated. Reply relay still shows `not_requested` — the `reply_relay` param probably needs to go in the chat params directly, not inside the JSON text. But the message got through and Discord's agent is processing it.

### What we can confirm locally from Discord-node logs
Relevant recent log line:

```text
[INFO] Sending chat message via gateway target=@guali-discord resolvedTarget=1480310282961289216 targetAlias=null messageLength=69 channel=discord openclawDispatchAgentId=main openclawTargetSessionKey=agent:main:discord:channel:1480310282961289216
```

So on the Discord side we can now confirm:
- correct local agent selection (`main`) ✅
- visible inbound processing happens ✅
- the agent is actually processing the message ✅

### Remaining discrepancy
Discord-side outbound test returned `reply_relay: "delivered"`, but Telegram-side observation still says `reply_relay: "not_requested"`.

That suggests one of:
1. the reply-relay intent is not being encoded on the inbound peer-triggered path the same way it is on the local Discord-triggered path
2. the param placement/shape is wrong for one direction
3. there is a mismatch between the transport metadata and the final chat param body

### Current likely bug
**reply relay intent/context is still not consistently propagated across both directions of the peer chat flow**

### Request
Please inspect where `reply_relay` is set for:
- outbound local `chat({ target: "@peer", ... })`
- inbound peer-originated chat activation
- remote peer reply path

Telegram specifically suspects the relay flag/param may need to live in the chat params directly rather than only inside embedded JSON/message content.

