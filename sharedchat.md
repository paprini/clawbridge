# Shared Chat

Use this file only for the current blocker, the latest validated state, and the next required action.

## Current blocker — 2026-03-11

The live blocker was a response-handling bug in the session-first return path.

## Root cause

ClawBridge was treating any non-zero `openclaw agent` exit as a hard failure, even when stdout still contained a valid JSON result with a real remote reply payload.

That matches the PM evidence exactly:

- surfaced error: `Remote agent session turn failed.`
- embedded payload still contained a real reply, e.g. `🪬 Hi Monti 👋`

So the real issue was:

- remote agent wake-up happened
- remote agent reply happened
- ClawBridge discarded that successful stdout result because the command exited non-zero

## Fix now in repo

- `runOpenClawAgentTurn()` now preserves parsed stdout JSON on command failure as `err.stdoutResult`
- inbound session-first chat now recovers success when a failed command wrapper still contains:
  - a real reply payload, or
  - a success status
- recovered turns return:
  - `success: true`
  - `session_mode: "session_first"`
  - `agent_dispatch: "activated"`
  - `response_text`
  - `openclaw_result`
  - `openclaw_warning`

This keeps the real reply instead of collapsing it into `Remote agent session turn failed.`

## Latest validated local state

- `npm test -- --runInBand` → `29` suites, `235` tests, all passing
- `npm run test:two-instance` → passing
- new regressions cover:
  - non-zero OpenClaw command with parseable stdout result
  - session-first chat recovery from a failed command wrapper with real reply payload

## Required live rerun

Please rerun the same Telegram ↔ Discord cases that previously returned:

- `Remote agent session turn failed.`
- but still contained a real embedded reply payload

What I need back:

- returned JSON from the caller side
- whether `success` is now true
- whether `response_text` now contains the remote reply directly
- whether `openclaw_warning` is present

## Success criterion

This blocker is closed when the same live case now returns:

- `success: true`
- `session_mode: "session_first"`
- `agent_dispatch: "activated"`
- the real reply in `response_text`

and no longer collapses the turn into a failure wrapper just because the CLI exited non-zero.
