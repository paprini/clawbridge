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

### Local transport check completed
I validated the exact transport concern locally:
- `callPeerSkill('chat', params)` still sends params as the second `text` part
- nested `_agentDelivery` and `_relay` metadata survive intact in that JSON payload
- executor reconstructs those nested params correctly from `message/send`
- when the caller is peer-authenticated, executor also forwards the authenticated peer id into `chat`

So the current local evidence says:
- the param placement in the multipart A2A request is working as designed
- `_agentDelivery` is not being lost by the local client/executor transport path

### What this means
The latest PM suspicion about “reply_relay needs to be outside the JSON text” is **not reproduced locally**.

The remaining live discrepancy is therefore more likely to be one of:
1. node config drift between the real installs
2. shared-token identity ambiguity on one node
3. different peer ids / local agent ids than the ones assumed by the relay metadata

## Latest runtime hardening from gipiti

### New likely root cause addressed
There is one realistic live path where reply relay can still lose identity even though activation succeeds:
- peer-to-peer requests authenticated as `__shared__` because a node is still using `A2A_SHARED_TOKEN`
- `_agentDelivery.sourceAgentId` is generic, stale, or not the same id the receiver uses in `peers.json`

That combination makes the receiver unable to identify which peer should receive the reply.

### What changed
- outbound `@agent` relay metadata now also carries the sender `agent.json.url`
- inbound reply relay now resolves the return peer in this order:
  1. authenticated peer id
  2. peer entry whose configured URL matches the sender URL from `_agentDelivery.sourceUrl`
  3. legacy `_agentDelivery.sourceAgentId`
- `npm run verify` now fails if any peer token reuses `A2A_SHARED_TOKEN`

### Why this matters
This gives the receiver a second reliable identity path even when:
- auth is shared-token based
- peer ids differ from local assumptions
- `sourceAgentId` is too generic to route safely

### Local validation
- full suite passing: `22` suites / `195` tests
- `npm run verify` passing locally
- added regression coverage for:
  - reply relay by source URL when auth is shared and source agent id is generic
  - multipart transport preserving nested relay metadata

---

## Additional Telegram-side feedback — reply may be entering session context instead of visible channel send

New feedback from Telegram side:

> Los mensajes de Discord se enviaron a mi gateway para delivery por Telegram a tu chat `5914004682`. Uno de 83 chars y otro de 114 chars. Pero parece que se despacharon a mi sesión principal en vez de llegar como mensaje directo a vos.
>
> El dispatch fue a `agent:main:telegram:direct:5914004682` — eso es mi sesión principal contigo. Probablemente llegó como contexto a mi sesión pero no se envió como mensaje de Telegram.

### Interpretation
This is highly consistent with the live Discord-side symptoms.

What may be happening now:
- ClawBridge successfully routes the reply back toward the origin-side OpenClaw session
- but the relay is landing as **session context / injected turn** rather than becoming a visible outbound Telegram message to the end user

### Why this matters
If true, then the remaining bug is not pure routing anymore.
It is now likely about the **final delivery mode on the return leg**:
- reply reaches the correct origin-side session
- but does not get emitted as a visible provider message to the chat surface

### Updated likely root cause
The return path may be targeting the correct origin session key, but not using the right mechanism to force a visible provider send back to the original peer/user chat.

### Request
Please inspect the return-leg behavior after successful activation:
- is the reply being injected into the origin session as context only?
- is it missing the final visible send step?
- is it using the wrong OpenClaw mode/path for provider-visible output on the origin side?

This seems like the next most likely explanation for why we now see:
- correct local activation
- correct local visible response
- but no visible message returning to Telegram

## Latest two-instance validation from gipiti

I built a reproducible local two-instance test harness in the repo:
- two real ClawBridge server processes
- separate config dirs
- fake OpenClaw gateway HTTP server
- fake OpenClaw CLI
- full `@agent` cross-instance flow including reply relay back to the origin instance

Command:
```bash
npm run test:two-instance
```

### What this found
The first real two-instance run exposed a bug that the unit tests had missed:
- the return-to-origin relay reached the source instance
- but the source instance rejected it as a loop because `_relay.visited` already contained that agent id
- the sender still treated that as delivered because the peer returned a normal JSON-RPC response carrying an application-level `error`

### What was fixed
- relay-loop protection now applies only when ClawBridge is about to relay to another peer, not when the message has already returned to the source instance for local delivery
- reply relay now treats peer payloads containing `error` as relay failures, not successful delivery

### Validation now
- full suite passing: `23` suites / `198` tests
- `npm run verify` passing locally
- `npm run test:two-instance` passing locally

### Meaning
This is the strongest local proof so far:
- two real ClawBridge instances can now complete:
  - outbound `@agent` relay
  - inbound visible delivery
  - local OpenClaw activation
  - reply relay back to the source instance
  - final local delivery on the source instance

---

## Live Follow-up — final reply likely dies on the last visible outbound leg

Additional consolidated live diagnosis from the Discord side:

### What Discord logs show
We now consistently see inbound peer chat reach the correct local agent:

```text
openclawDispatchAgentId=main
openclawTargetSessionKey=agent:main:discord:channel:1480310282961289216
```

So the wrong-agent bug appears fixed in this path.

But we also see separate flat channel-send paths like:

```text
target=1480310282961289216
resolvedTarget=1480310282961289216
openclawDispatchAgentId=null
openclawTargetSessionKey=null
```

That strongly suggests the runtime is still mixing:
- true agent activation
- and plain visible channel delivery sends

### Telegram-side outcome
Telegram reports no explicit error now.
It just does **not receive the visible reply** from Discord.

So current behavior looks like:
- inbound message reaches Discord ✅
- local agent activation happens ✅
- local processing happens ✅
- but final visible reply back to Telegram never appears ❌

### Updated likely root cause
The remaining bug is probably on the **last outbound leg of the reply path**.

It no longer looks like activation failure.
It looks more like the reply relay is being lost, downgraded to local-only output, or turned into non-visible session/context handling before it reaches provider-visible Telegram delivery.

### Current best summary
- peer auth works
- routing works
- activation works
- correct local agent selection works
- Telegram sees no explicit error
- but the final visible outbound reply to the originating peer still does not happen

### Request
Please inspect the final reply emission path and specifically where activated-agent output transitions into:
- peer-relayed visible send
vs
- local channel send
vs
- session/context-only handling

At this point the remaining bug looks like a final-leg visible outbound emission problem, not a transport or activation problem.

---

## Latest fix from gipiti — preserve explicit source delivery on the reply leg

### Root cause
The final reply path was still under-specified.

When instance A sent `@agent-name` to instance B, B could activate and extract the reply, but the return leg back to A only carried:
- the source peer identity
- relay metadata

It did **not** carry the original visible delivery target/channel that A should use when showing the reply to the user.

That meant the source instance had to guess the final visible destination again at reply time, typically by falling back to whatever `config/agent.json -> default_delivery` looked like then.

If that default was missing, stale, or simply not the right live chat surface, the last visible outbound leg could fail silently from the user’s point of view even though cross-instance relay itself succeeded.

### What changed
- outbound `@agent` relay metadata now also carries:
  - `sourceReplyTarget`
  - `sourceReplyChannel`
- inbound reply relay now sends those back to the origin peer as explicit top-level `chat` params
- the origin peer therefore no longer has to infer the visible destination for the reply leg
- it can send the return message directly to the same local delivery target/channel that the originating installation declared when it started the cross-instance conversation

### Why this is the right fix
- it is narrow
- it does not change the public user-facing `chat` contract
- it does not add a new runtime dependency
- it makes the final outbound leg deterministic instead of configuration-dependent at reply time

### Local validation
- full suite passing: `23` suites / `199` tests
- `npm run verify` passing locally
- `npm run test:two-instance` passing locally
- added regression coverage for:
  - preserving reply target/channel across `@agent` relay metadata
  - using explicit reply target/channel on the return leg
  - still handling older metadata that does not include those fields

### Next live validation needed
Please pull latest `main` and re-test the same cross-instance flow.

Expected difference now:
- the reply leg should no longer depend on the origin node re-deriving where to send the visible response
- the reply should be emitted to the explicit source-side target/channel captured when the original `@agent` relay was initiated
