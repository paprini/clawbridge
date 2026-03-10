# Shared Chat

Hello developer, I am `gipiti`, the expert developer instance working directly in this local clone of `clawbridge`.

Use this file for the **single current blocker** and the **latest live validation state only**.
Archive everything else.

Archive:
- `docs/archive/sharedchat-history-2026-03-09.md`

## Current State — 2026-03-10

### Repo / release status
- current release line: `0.2.0`
- latest live-tested commit on Discord node: `3887102`
- verify on live node: `18/18` passing
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
**Cross-agent chat reply relay is still not propagating back to the source peer.**

The system now behaves like this:
- remote message arrives
- remote agent activates
- remote agent replies locally on its own platform
- but the reply does **not** get relayed back to the originating peer

So transport and activation are working, but the return-leg reply relay is not.

---

## Canonical Bug Report

### Title
**Reply relay not propagated in cross-agent chat dispatch**

### One-line description
When sending chat to `@peer`, the remote agent activates and replies locally, but the reply is not relayed back to the source peer because relay metadata is missing by the time the reply is processed.

### Observed flow
1. Telegram sends chat to `@guali-discord`
2. Discord agent activates successfully
3. Discord agent replies locally in Discord
4. No reply comes back to Telegram

### Confirmed result fields seen during live tests
- `agent_dispatch: "activated"`
- `openclaw_result: "ok"`
- `reply_relay: "not_requested"`
- `reply_relay_peer: null`

### What this means
The dispatch path works.
The return path does not.

This is **not** a transport failure anymore.
This is **not** an agent-activation failure anymore.
This is now specifically a **reply-relay metadata propagation** problem.

### Likely root cause
In `src/skills/chat.js`, reply relay depends on source-peer metadata still being available when the local agent reply is processed.

The relevant metadata appears to be:
- `sourceAgentId`
- `sourceReplyTarget`
- `sourceReplyChannel`

The likely failure is that this metadata is not being preserved through the dispatch flow, so by the time the local reply is ready, the relay step has no source peer to send back to.

### Relevant code paths
- `relayActivationReplyToSourcePeer(...)`
- `resolveReplyRelayPeerId(...)`
- dispatch path around `runOpenClawAgentTurn(...)`

### Additional live evidence
From Discord-node behavior:
- inbound peer message activates `main` correctly
- local reply content is good and useful
- the reply appears on Discord locally
- it does **not** reappear on Telegram

From Telegram-side feedback:
- messages are reaching the Discord side
- replies are happening on Discord
- no visible reply is coming back to Telegram

### Expected behavior
For cross-agent chat:
1. peer A sends to `@peer-b`
2. peer B activates local agent and generates reply
3. that reply is relayed back to peer A automatically
4. peer A sees the visible return message on its own platform

### Actual behavior
1. peer A sends to `@peer-b`
2. peer B activates local agent and generates reply
3. reply stays local on peer B’s platform
4. nothing visible returns to peer A

### Request to gipiti
Please treat this as the one current live blocker.
The next fix should preserve and carry reply-relay source metadata all the way through the dispatch lifecycle so the final local agent reply can be relayed back to the originating peer.

If you need more live data, ask here for:
- exact JSON outputs
- logs
- config snapshots
- repeated Discord ↔ Telegram validation

