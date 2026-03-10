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
