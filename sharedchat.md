# Shared Chat

Hello developer, I am `gipiti`, the expert developer instance working directly in this local clone of `clawbridge`.

Use this file for the current blocker and latest validated state only.

Archive:
- `docs/archive/sharedchat-history-2026-03-09.md`

## Current State — 2026-03-10

### Repo / validation status
- current release line: `0.2.0`
- local verify: `20/20` passing
- full local suite: `24` suites / `216` tests passing
- two-instance relay harness: passing
- delayed-peer timeout harness: passing

### What was fixed now
- ClawBridge no longer relies only on implicit return-path inference from `sourceAgentId`, `sourceUrl`, and auth context
- cross-agent relay metadata now carries an explicit `sourcePeerId`
- cross-agent relay metadata now carries a `conversationId`
- inbound reply relay now resolves the return peer in this order:
  - authenticated peer id
  - explicit `sourcePeerId`
  - source URL match
  - legacy `sourceAgentId`
- outbound `@agent` relay returns now include `conversation_id` so the flow is traceable end-to-end

### Why this was necessary
The old model still depended too much on reconstructing intent later from loose internal fields.

That was the weak abstraction:
- source peer was sometimes inferred instead of declared
- conversation identity was missing
- logs and returned JSON were harder to correlate across nodes

This change keeps the public `chat` contract the same, but makes the internal agent-to-agent return path explicit and deterministic.

### Local proof added
- unit coverage for explicit `sourcePeerId` winning over legacy `sourceAgentId` inference
- existing same-id and source-URL fallback coverage still passing
- two-instance integration harness now proves:
  - cross-node relay still works
  - generic `main` / `main` installs still work
  - `conversation_id` is preserved through the explicit return-path model

## Current ask

Please pull latest `main` and re-test the same real Telegram ↔ Discord flow using the normal built-in peer client path.

What to report back if it still fails:
- exact returned JSON
- `conversation_id` from the returned JSON if present
- elapsed wall-clock time until the caller returned
- whether the visible reply appeared later anyway
- log lines containing:
  - `conversationId`
  - `sourcePeerId`
  - `reply_relay`
  - `reply_relay_peer`
  - `Relaying activated agent reply to source peer`
  - `Inbound agent reply relayed back to source peer`

## Current expectation

If the remaining fragility was the implicit return-path model, the same flow should now be easier to trace and should stop depending on ambiguous peer/agent reconstruction on the receiving side.

---

## Strong architectural push — stop optimizing the wrong abstraction

We may be fighting the wrong problem now.

The live behavior keeps feeling like this:
- message arrives
- something activates
- something responds somewhere
- but the whole exchange still behaves like fire-and-forget

That strongly suggests an architectural mismatch, not just another edge-case bug.

### Current concern
ClawBridge still seems to be modeling this as:
- message delivery
- local agent activation
- best-effort reply relay

But what we actually need for real agent-to-agent conversation is closer to:
- explicit cross-agent conversation/session state
- explicit origin tracking
- explicit return path
- explicit ownership of who answers and where that answer goes

### In plain terms
We do **not** need elegance right now.
We need something explicit, robust, and correct.

If the current abstraction keeps producing fragile behavior, stop polishing it.
Re-think it.

### Suggested reframe
Do not treat this mainly as “relay a message and infer the rest.”
Instead, consider modeling it as:
- a real cross-agent conversation/thread/session
- with preserved conversation identity
- preserved origin peer
- preserved delivery destination
- preserved reply destination
- and a deterministic return path

### Why this matters
Right now each fix improves a symptom, but the system still feels like:
- loosely coupled message passing
- not a true two-agent conversation loop

That is usually a sign that the abstraction itself is too weak.

### Direct request
Please stop optimizing the current implicit relay model if it is fundamentally too fragile.
If needed, pause and redesign the agent-to-agent loop in a more explicit way.

We do not need elegance.
We need a design that is:
- explicit
- traceable
- testable
- robust

---

## Product-direction push — move toward session-first A2A, not message-first relay

Strong product feedback from the live operator:

The current message-first model is feeling too patchy, too inferential, and too fragile.
Even when individual bugs get fixed, the overall system still behaves like:
- message delivery
- local activation
- inferred return path
- accumulated edge-case handling

That may be the wrong primary abstraction.

### Strong recommendation
Please seriously consider shifting ClawBridge toward a **session-first A2A model**.

Meaning:
- explicit cross-agent conversation/session identity
- explicit origin peer
- explicit destination peer
- explicit ownership of who should answer
- explicit return path
- explicit continuity across turns

And only treat raw message relay as:
- compatibility layer
- bootstrap path
- or simple fire-and-forget transport mode

### Why this matters
Sessions are a better product model because they are:
- more natural for agents
- easier to trace
- easier to debug
- easier to reason about
- better for persistent/open agents later
- better foundation for future A2A phases than patching implicit message semantics forever

### Product statement
We do not need elegance right now.
We need a model that is:
- explicit
- robust
- testable
- operable in real multi-agent environments

### Directional ask
Please spend real time on whether ClawBridge should pivot from:
- message-to-message relay with inferred reply behavior

to:
- session-to-session agent communication as the primary design

You do not need to implement the full redesign immediately.
But please work the problem from that frame now, not from endless message-relay patching.

