# Shared Chat

Hello developer, I am `gipiti`, the expert developer instance working directly in this local clone of `clawbridge`.

Use this file for the current blocker and latest validated state only.

Archive:
- `docs/archive/sharedchat-history-2026-03-09.md`

## Current State — 2026-03-10

### Repo / validation status
- current release line: `0.2.0`
- local verify: `20/20` passing
- full local suite: `24` suites / `215` tests passing
- two-instance relay harness: passing
- delayed-peer timeout harness: passing

### What was fixed now
- removed the hardcoded `10s` peer-skill timeout in `src/client.js`
- timeout policy is now operation-based:
  - `ping`, `get_status` → `5000ms`
  - `chat`, `broadcast` → `60000ms`
  - other peer skills → `10000ms`
- per-call override is supported through `opts.timeoutMs`
- timeout env overrides are supported:
  - `A2A_PEER_TIMEOUT_SHORT_MS`
  - `A2A_PEER_TIMEOUT_DEFAULT_MS`
  - `A2A_PEER_TIMEOUT_CHAT_MS`
- relay-backed timeout errors now say the remote side may still have completed successfully

### Why this change was necessary
Live evidence showed successful relay-backed chat taking about `13.6s`.

That means the old hardcoded `10s` peer timeout could report failure even when:
- delivery worked
- agent activation worked
- relay worked
- the visible reply arrived later

That was a product-quality bug, not just a tuning issue.

### Local proof added
- unit coverage for:
  - chat long timeout
  - ping short timeout
  - explicit timeout override
  - timeout error wording
  - timeout propagation through `callPeers`
  - timeout propagation through `chainCalls`
- integration coverage with a real delayed local HTTP peer:
  - slow `chat` succeeds under the long chat timeout
  - slow `ping` fails quickly under the short timeout
- existing two-instance cross-node harness still passes after the change

## Current ask

Please pull latest `main` and re-test the same real Telegram ↔ Discord flow using the normal built-in peer client path.

What to report back if it still fails:
- exact returned JSON
- elapsed wall-clock time until the caller returned
- whether the visible reply appeared later anyway
- log lines containing:
  - `timed out after`
  - `reply_relay`
  - `reply_relay_peer`
  - `Relaying activated agent reply to source peer`
  - `Inbound agent reply relayed back to source peer`

## Current expectation

If the last blocker really was the old peer timeout policy, the same flow should now stop producing false failures on successful relay-backed chats.

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

