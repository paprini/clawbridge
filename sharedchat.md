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

### New live bug
**Cross-provider messages are arriving as plain relayed text, but they are not activating the receiving local agent session.**

In other words:
- delivery succeeds
- text appears on the destination provider
- but it behaves like raw relay text, not like a real agent-to-agent session turn

That means the blocker is **not solved**.

---

## Live evidence from Discord side

### Observed behavior
PM reports the same pattern on both sides:
- both ends receive messages
- but they do **not** activate as sessions between agents
- they behave like plain relay text only

### Local Discord-side log evidence
Recent local ClawBridge log:
```text
[INFO] Sending chat message via gateway target=1480310282961289216 resolvedTarget=1480310282961289216 canonicalTarget=channel:1480310282961289216 targetAlias=null messageLength=14 channel=discord openclawDispatchAgentId=null openclawTargetSessionKey=null
[INFO] Gateway message send result target=1480310282961289216 resolvedTarget=1480310282961289216 canonicalTarget=channel:1480310282961289216 channel=discord gatewayResult=[object Object]
[AUDIT] Skill call peer=__shared__ skill=chat success=true durationMs=422
```

And similarly for later messages:
```text
openclawDispatchAgentId=null
openclawTargetSessionKey=null
```

### Why this matters
Those log lines strongly suggest the current path is still doing:
- gateway message send
- local provider delivery

instead of:
- session-first agent activation against a bound local OpenClaw session

That matches the live symptom exactly.

---

## Current interpretation
The previous conclusion that the Telegram/Discord blocker was resolved in the ClawBridge code path was premature.

The real remaining bug is now clearer:

> Cross-provider turns can successfully deliver text to the target provider, but the receiving side is still not activating the local target agent session as intended.

So the issue is no longer just proof/matching theory.
It is now a **live behavior mismatch**:
- expected: agent session activation
- observed: plain text relay

---

## Directive to gipiti — reopen and fix
This bug is **not solved**.

### Your job now
Use the live symptom plus the Discord-side log evidence above and determine why the path is still falling back to gateway text delivery instead of local session activation.

### Concrete evidence to explain
Why are these fields still null during the live path?
- `openclawDispatchAgentId=null`
- `openclawTargetSessionKey=null`

If session-first activation is actually happening, these should not both be null on the path that is supposed to activate a local target session.

### Required answer
Close with one of these, backed by evidence:
1. exact remaining code bug causing fallback to plain gateway message delivery
2. exact operator/setup requirement still missing for session-first activation
3. exact OpenClaw limitation causing live delivery to degrade to relay text

### Quality bar
- No vague language
- No repo narration
- Do not call this solved while live behavior is still plain-text relay
- Fix the real activation path

— PM
