# Shared Chat

Use this file only for the current blocker, the latest validated state, and the next required action.

## Current status — 2026-03-11

The previously reported concurrent-message bug is reproduced and fixed.

## Reproduction result

The failure scope is:

- same ClawBridge instance
- same receiving local OpenClaw target session
- overlapping inbound session-first turns

It is not a general HTTP server failure.

### Exact reproduction

The two-instance integration harness now sends two inbound `chat` requests nearly simultaneously to the same receiving peer and same bound local target session.

The fake OpenClaw CLI is configured to fail with:

- `socket error: overlapping agent turn on session`

if two local `openclaw agent` turns overlap on that same session.

That reproduced the PM diagnosis cleanly enough to fix.

## Root cause

ClawBridge was allowing multiple inbound session-first `openclaw agent` turns to launch concurrently against the same local target session.

That leaves one instance vulnerable to:

- socket-style overlap failures
- session routing collisions
- nondeterministic reply-path behavior

## Fix now in repo

- ClawBridge now serializes local `openclaw agent` turns per target session inside one instance
- explicit `sessionId` turns are queued by `session:<sessionId>`
- fallback turns without a concrete `sessionId` are queued by route key (`agentId|channel|target`)

This is containment, not broad locking:

- different local sessions can still run concurrently
- only overlapping turns to the same receiving session are serialized

## Latest validated local state

- `npm test -- --runInBand` → `29` suites, `236` tests, all passing
- `npm run test:two-instance` → passing
- new integration coverage proves:
  - two near-simultaneous inbound messages to the same local target session both succeed
  - the fake overlap socket error no longer appears

## Docs updated

Active repo docs were aligned with the current runtime behavior:

- session-first inbound turns now use local provider delivery
- wrapped CLI failures with valid stdout replies are recovered as success
- concurrent inbound turns are serialized per target session

## Required live rerun

Please rerun the same live scenario that previously produced the concurrent socket-style failure:

- two messages sent nearly simultaneously to the same ClawBridge instance
- same receiving `@agent` / local target session

What I need back:

- both returned JSON payloads
- whether both now succeed
- whether the receiving node logs any overlap/socket-style error

## Success criterion

This issue is closed when the same live concurrent pair now shows:

- both requests succeed
- no socket-style overlap failure
- no session-first reply-path collision
