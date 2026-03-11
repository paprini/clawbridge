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

## Latest hard evidence
### Commit: `10206ab`
Verification is now stronger and exposes a key difference:

- **WhatsApp** has a real provider-bound direct session row, e.g.
  - `agent:main:whatsapp:direct:+16504604060`
- **Telegram** for the same user identity is currently appearing on:
  - `agent:main:main`
  - with `deliveryContext.channel = telegram`
  - and matching `lastTo`

### Current interpretation
This strongly suggests Telegram direct conversations may still be collapsing into the **main session**, while WhatsApp is not.

### New direct-session probe
- `node src/cli.js session-proof telegram <target>`
- `node src/cli.js session-proof discord <target>`
- output shows:
  - pinned local OpenClaw agent id
  - session store path
  - whether a provider-bound direct session exists
  - whether the target currently collapses into `agent:...:main`
  - exact matching session rows

### Network note
- From this machine, the documented private node addresses `10.0.1.10`, `10.0.1.11`, and `10.0.1.12` timed out.
- The real pair report evidence must be collected on those nodes with `session-proof`.

That is important evidence.
It is **not yet** a final blocker resolution.

---

## Directive to gipiti — Finish the job
Good. The verification work was useful.
Now stop changing abstractions and use that evidence to close the blocker.

### Required next action
You must now run the real pair-by-pair result report.

#### Test these failing directions explicitly
- Telegram -> Discord
- Discord -> Telegram

#### Keep these as controls
- WhatsApp -> Telegram
- Telegram -> WhatsApp
- WhatsApp -> Discord
- Discord -> WhatsApp

### Deliver exactly this
For **Telegram -> Discord** and **Discord -> Telegram**, report:

1. **Exact test performed**
   - sender node
   - target node
   - target used
   - whether a provider-bound direct session already existed beforehand

2. **Result shape**
   - `binding_required`
   - real success with provider-bound `openclaw_session_id`
   - or another exact failure

3. **Target-side facts**
   - `npm run verify` output
   - OpenClaw `session.dmScope`
   - whether the target session row is provider-bound or collapsed onto `agent:...:main`

4. **Exact difference from the working WhatsApp control path**
   - observed difference only
   - not guesses

5. **Final conclusion**
   - works now
   - binding/operator requirement
   - provider limitation
   - or exact next code fix justified by evidence

### Quality bar
Do not respond with vague language.
Do not respond with repo narration.
Do not respond with another verification-only pass.

This task is only complete when you provide the actual pair result report.

### Passing condition
This blocker is only resolved when one of these is true:
1. Telegram <-> Discord works as real remote session execution, proven.
2. You prove with hard evidence that a specific provider/session constraint is the blocker and document the exact operator requirement.

No hand-waving.
No more clutter.
Finish the pair report.

— PM
