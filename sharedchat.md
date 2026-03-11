# Shared Chat

Use this file only for the **current blocker**, the **latest validated state**, and the **next required action**.
Archive everything else.

## Current blocker — 2026-03-11

### Product direction
ClawBridge launch quality requires real **session-first agent-to-agent activation** across providers, not plain text relay.

Launch providers:
- Telegram
- Discord
- WhatsApp

### Live behavior diagnosis
We now have a clearer live diagnosis:

- cross-peer delivery works
- remote text appears on the destination provider
- but there is **no real back-and-forth**
- no visible receiving-agent activation
- no conversational continuity

In practice, current live behavior is acting like:
- **relay-style messaging**

not like:
- **session-first agent-to-agent communication**

This means the blocker is **not solved**.

---

## Latest repo-side state

### Latest tested version
- **HEAD:** `d89a5b6`

### Telegram node (from PM GDrive feedback)
- `npm run verify` → `21 passed, 0 failed`
- `npm test -- --runInBand` → `231 passed, 1 failed`
- only failing test: `tests/unit/repo-policy.test.js`
- failure is explicitly a repo-policy / environment mismatch, not runtime failure

### Discord node (local)
- `npm run verify` → `20 passed, 1 failed`
- `npm test -- --runInBand` → `231 passed, 1 failed`
- only failing item is the same repository peers policy mismatch

### Important passing repo-side signal
This integration path now passes:
- `promotes relayed local-target aliases into session-first activation on the receiving peer` ✅

So repo-side logic is stronger now.
That still does **not** prove the live activation path is correct.

---

## Live evidence from Discord side

### Observed symptom
PM confirms the same live symptom repeatedly:
- both sides receive messages
- but neither side behaves like an activated agent session
- there is no real interaction loop
- it looks like relay text only

### Discord-side log evidence
Recent local ClawBridge log on the Discord node:

```text
[INFO] Sending chat message via gateway target=1480310282961289216 resolvedTarget=1480310282961289216 canonicalTarget=channel:1480310282961289216 targetAlias=null messageLength=14 channel=discord openclawDispatchAgentId=null openclawTargetSessionKey=null
[INFO] Gateway message send result target=1480310282961289216 resolvedTarget=1480310282961289216 canonicalTarget=channel:1480310282961289216 channel=discord gatewayResult=[object Object]
[AUDIT] Skill call peer=__shared__ skill=chat success=true durationMs=422

[INFO] Sending chat message via gateway target=1480310282961289216 resolvedTarget=1480310282961289216 canonicalTarget=channel:1480310282961289216 targetAlias=null messageLength=118 channel=discord openclawDispatchAgentId=null openclawTargetSessionKey=null
[INFO] Gateway message send result target=1480310282961289216 resolvedTarget=1480310282961289216 canonicalTarget=channel:1480310282961289216 channel=discord gatewayResult=[object Object]
[AUDIT] Skill call peer=__shared__ skill=chat success=true durationMs=383

[INFO] Sending chat message via gateway target=1480310282961289216 resolvedTarget=1480310282961289216 canonicalTarget=channel:1480310282961289216 targetAlias=null messageLength=69 channel=discord openclawDispatchAgentId=null openclawTargetSessionKey=null
[INFO] Gateway message send result target=1480310282961289216 resolvedTarget=1480310282961289216 canonicalTarget=channel:1480310282961289216 channel=discord gatewayResult=[object Object]
[AUDIT] Skill call peer=__shared__ skill=chat success=true durationMs=454
```

### Why this matters
The most important fields in those logs are still:
- `openclawDispatchAgentId=null`
- `openclawTargetSessionKey=null`

That strongly suggests the live path is still doing:
- gateway message send
- plain provider text delivery

instead of:
- session-first local target-session activation

That matches the live symptom exactly.

---

## Current interpretation
The previous conclusion that the blocker was solved in the ClawBridge code path was premature.

The real remaining bug is now clearer:

> Cross-provider turns can deliver text successfully, but the receiving side is still not reliably activating the local target agent session.

So the blocker is now explicitly:
- **live activation / conversational continuity**
- not just proof logic
- not just session-key matching theory

---

## Directive to gipiti — hard push
Do **not** call this solved.

### Your job now
Explain, with evidence, why live cross-provider delivery is still degrading to relay-style text behavior instead of activated local agent session behavior.

### Concrete evidence you must address
Why are these still null in the live path?
- `openclawDispatchAgentId=null`
- `openclawTargetSessionKey=null`

If session-first activation is truly happening live, these should not both stay null on the path that is supposed to activate a receiving local session.

### Required answer
Close with one of these, backed by evidence:
1. exact remaining code bug causing fallback to plain gateway message delivery
2. exact operator/setup requirement still missing for live session-first activation
3. exact OpenClaw limitation causing live delivery to degrade to relay text
4. exact mismatch between the tested integration assumptions and the real live runtime path

### Quality bar
- No vague language
- No repo narration
- No more claiming solved from tests alone
- Fix or explain the **live activation path**, not just the code-path theory

— PM
