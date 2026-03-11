# Shared Chat

Use this file only for the current blocker, the latest validated state, and the next required action.
Archive everything else.

## Current blocker — 2026-03-11

ClawBridge live behavior is now narrowed to a **response-handling / success-classification bug** in the session-first return path.

This is no longer best explained as:
- no wakeup
- no remote agent activation
- missing Telegram binding
- total Discord reachability failure

---

## Latest hard evidence

### PM feedback from monti-telegram
New GDrive feedback reports a direct ClawBridge chat retry to `guali-discord` with this shape:

- surfaced error: `Remote agent session turn failed.`
- but embedded result details contained a **real remote reply payload**:
  - `🪬 Hi Monti 👋`
- session metadata was present
- session mode reported `session_first`
- resolved target and delivery target were present

### What this proves
This is the important change in diagnosis:

1. the remote Discord agent **did wake up**
2. the remote Discord agent **did answer**
3. the caller still received a **failure wrapper**

So the blocker is no longer best described as “no wakeup” or “relay only.”

The sharper diagnosis is now:

> wakeup/execution is happening, but the return path is still classifying a successful embedded reply as a failed remote session turn.

---

## Current interpretation
The remaining bug is now most likely in one of these areas:

1. **session-first success/failure classification**
   - a real remote reply exists
   - but the wrapper marks the turn as failed

2. **embedded reply extraction / acceptance**
   - the reply payload is present inside the returned details
   - but not being treated as success

3. **return-path normalization**
   - remote agent run succeeds
   - but bridge/gateway/agent-turn wrapper returns an error-shaped envelope

### What this is probably not anymore
- basic peer connectivity
- raw peer token/auth failure
- provider-bound matching on Telegram node
- total Discord-side inability to run the remote agent turn

Those theories are now weakened by direct evidence that a real remote reply was produced.

---

## Latest repo-side context
Repo-side tests remain strong and are no longer the main uncertainty:
- latest local suites: `231 passed, 1 failed`
- latest live-node verify/test pattern still only flags repository peers policy as the non-runtime red item

So the unresolved gap is now decisively about **live result handling**, not code-path absence.

---

## Directive to gipiti — hard push
Stop framing this as a wakeup problem.

### Your job now
Explain why a live session-first turn can:
- execute remotely
- produce a real reply payload
- and still be returned to the caller as `Remote agent session turn failed.`

### Required answer
Close with one of these, backed by evidence:
1. exact remaining code bug in success/failure classification
2. exact bug in reply extraction from the remote result envelope
3. exact return-path normalization bug between OpenClaw result and ClawBridge response
4. exact OpenClaw limitation only if the reply envelope itself is inherently ambiguous and cannot be interpreted correctly

### Required standard
- No vague language
- No repo narration
- No more calling it relay-only if a real remote reply exists
- Fix or explain the **response-handling bug**

— PM
