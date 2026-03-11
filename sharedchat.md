# Shared Chat

Use this file only for the current blocker, the latest validated state, and the next required action.
Archive everything else.

## Current blocker — 2026-03-11

ClawBridge was still running the receiving-side OpenClaw session turn as a hidden turn.

### Root cause
Real local OpenClaw CLI behavior confirms:

- `openclaw agent --deliver` is what makes the agent reply visibly send on the selected channel
- default behavior is hidden (`default: false`)

ClawBridge's session-first receiving path was still invoking:

- provider-bound session targeting
- but with `deliver: false`

That matches the PM symptom exactly:

- inbound message can land on the remote session
- but the remote local agent never visibly wakes up on its own provider channel
- so the path looks like delivery-only, not conversation

---

## Latest validated repo-side state

### Latest tested version
- local checkout updated to latest main before testing
- latest local tested HEAD in this cycle: `9c8a1a7`

### Repo-side quality signal
Latest repo-side results are still strong:
- `npm test -- --runInBand` → `231 passed, 1 failed`
- `npm run verify` → only repository peers policy fails locally
- Telegram node PM feedback shows the same repo-policy-only failure pattern on live install

The only consistent red item is:
- `repo-policy.test.js` / repository peers policy

That is a local/environment policy mismatch, **not** the live activation blocker.

### New fix now in repo
- session-first inbound agent turns now run with local delivery enabled
- ClawBridge still targets the bound local session
- the visible reply now belongs to the receiving node's own local provider session
- structured `response_text` is still returned too

This is the smallest fix that matches real OpenClaw CLI semantics instead of fake hidden-turn assumptions.

---

### Local validation after the fix
- `npm test -- --runInBand` → `29` suites, `233` tests, all passing
- `npm run test:two-instance` passes with the session-first receiving leg now asserting `deliver: true`
- targeted unit coverage updated for inbound session-first turns

---

## Required live rerun

Please rerun the same Discord -> Telegram and Telegram -> Discord cases that previously showed:

- delivery success
- no visible remote agent wake-up
- no conversational continuity

What I need back:
- whether the receiving local provider now shows the agent's visible reply
- the returned JSON, especially:
  - `agent_dispatch`
  - `openclaw_session_id`
  - `openclaw_agent_id`
  - `openclaw_deliver_locally`
- the receiving-side log line for the session-first turn

## Success criterion

This blocker is only closed when the receiving node shows all of:

- provider-bound session activation
- `openclaw_deliver_locally: true`
- visible local agent reply on the receiving provider
- no fallback to plain gateway-only delivery for the activation leg
