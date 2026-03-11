# Shared Chat

Use this file only for the **current blocker**, the **latest validated state**, and the **next required action**.
Archive everything else.

## Current Blocker — 2026-03-11

### Product direction
ClawBridge launch quality requires **session-first agent-to-agent communication** with real provider-bound execution semantics.

Launch providers:
- Telegram
- Discord
- WhatsApp

### Validated interoperability matrix
#### Working
- WhatsApp -> Telegram ✅
- Telegram -> WhatsApp ✅
- WhatsApp -> Discord ✅
- Discord -> WhatsApp ✅

#### Still failing / inconsistent
- Telegram -> Discord ❌
- Discord -> Telegram ❌

### Important conclusion
This is **not** a full architecture failure.
This is a **Telegram <-> Discord pair-specific blocker**.

WhatsApp is proving the session-first model can work.
The remaining problem is that Telegram and Discord still do not interoperate correctly with each other under the same model.

---

## Latest proven repo-side behavior
### Direct-session guard
- Commit: `c622092`
- ClawBridge now fails fast when OpenClaw does not expose a **provider-bound direct session**.
- Expected failure shape:
  - `No provider-bound direct OpenClaw session exists for this target`
  - `agent_dispatch: "binding_required"`

This is correct behavior.
False success through main-session fallback is no longer acceptable.

### New direct-session evidence
- Commit: pending current push
- `verify` now distinguishes:
  - no provider-bound direct session yet
  - provider-bound direct session exists
  - provider/session collapse where the direct target is still stored on `agent:...:main`
- Local OpenClaw evidence on this machine:
  - WhatsApp has a real provider-bound direct session row:
    - `agent:main:whatsapp:direct:+16504604060`
  - Telegram direct conversation for the same user identity currently appears on:
    - `agent:main:main`
    - with `deliveryContext.channel = telegram`
    - with matching `lastTo`
- That is now surfaced by install-time verification instead of only a generic `dmScope` hint.

### Helper agent status
- Commit: `7787dff`
- Helper agent is now **local-only by default**.
- Expected status:
  - `ready_local_only`
  - `gatewayBootstrap: skipped`

Helper behavior is **not** the main launch blocker now.

---

## Directive to gipiti — High Standards

**Stop broad repo work. Stop polishing. Stop speculative changes.**

Your job now is to **test, isolate, and explain** the Telegram <-> Discord failure with the same rigor that already proved the WhatsApp paths.

### Required test matrix
#### Must test explicitly
- Telegram -> Discord
- Discord -> Telegram

#### Control comparisons
- WhatsApp -> Telegram
- Telegram -> WhatsApp
- WhatsApp -> Discord
- Discord -> WhatsApp

### What you must determine
Answer this exact question:

> Why does WhatsApp interoperate correctly with both Telegram and Discord, while Telegram and Discord still fail to interoperate correctly with each other?

That comparison is now the debugging frame.

### Required evidence for EACH failing direction
For **Telegram -> Discord** and **Discord -> Telegram**, report all of the following:

1. **Exact test performed**
   - sender node
   - target node
   - target address used
   - whether a provider-bound DM/direct session already existed beforehand

2. **`npm run verify` output** on the target node

3. **OpenClaw `session.dmScope`** on the target node

4. Whether a provider-bound session row already exists for that target in session storage

5. Whether the result is now:
   - `agent_dispatch: "binding_required"`
   - or a real provider-bound success with `openclaw_session_id`
   - or some other failure shape

6. **What is different from the working WhatsApp control path**
   - not guesses
   - exact observed difference

### Deliverable standard
Do **not** respond with vague conclusions like:
- "seems better"
- "probably provider-specific"
- "might be a binding issue"

Deliver a **tight result report**:
- exact commit/hash
- exact pairs re-tested
- exact observed behavior per pair
- exact difference between failing TG/Discord pair and working WA paths
- exact conclusion
- exact next fix, if one is justified by evidence

### Quality bar
No more broad architecture narration.
No more repo clutter.
No more historical dumping into this file.

This file stays lean:
- current blocker
- current validated state
- next action
- evidence-based result

### Passing condition
This blocker is only considered resolved when one of these is true:

1. **Telegram <-> Discord works correctly as real remote session execution**, or
2. You prove with hard evidence that a specific OpenClaw provider/session constraint is the blocker and document the exact operator requirement to satisfy it.

If the answer is "binding required," prove it clearly.
If the answer is "works now," prove it clearly.
If the answer is "provider limitation," prove it clearly.

No hand-waving.

— PM
