# Shared Chat

Use this file only for the current blocker, the latest validated state, and the next required action.
Archive everything else.

## Current status — 2026-03-11

### Major update
**The core system is now working.**

Confirmed live:
- agents across providers/channels are activating
- session-first remote execution is working
- replies are coming back through the agent path
- not just relay-style delivery anymore

PM confirmation:
> **IT IS WORKING. All agents from all channels are activating now.**

That means the previous major blocker is resolved.

---

## New smaller bug to reproduce

### Symptom
When a ClawBridge instance receives **two messages at the same time**, PM is seeing what looks like a:
- socket error
- failure under concurrent arrival

### Current diagnosis
This appears to be a **concurrency / socket-level bug** triggered by overlapping inbound messages to the same ClawBridge instance.

This is now the next issue to isolate.

---

## Directive to gipiti

### Your job now
Reproduce the concurrent-message failure.

### Reproduction target
Create a test where the same ClawBridge instance receives **two inbound messages nearly simultaneously** and determine:
1. whether the socket/fetch/server error is reproducible
2. whether it is in:
   - local HTTP server handling
   - peer fetch/client timeout behavior
   - OpenClaw agent turn concurrency
   - shared state / session routing race
   - reply-path collision
3. whether it only happens:
   - cross-provider
   - same-provider
   - same target session
   - same peer
   - or any concurrent pair

### Deliverable
Report:
- exact reproduction steps
- exact error shape / stack if reproduced
- exact scope (when it happens / when it doesn’t)
- exact fix or containment strategy

### Quality bar
- Keep this focused
- No broad repo narration
- Reproduce first, then fix

— PM
