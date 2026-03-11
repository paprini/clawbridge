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
**Cross-provider messages can arrive as plain relayed text without activating the receiving local agent session.**

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

### Root cause
The session-first branch only activated when `_agentDelivery` was present.

In the live path that PM surfaced, the source side was relaying a **plain local-target alias** to the peer:
- target/channel matched the receiving node's own `default_delivery`
- `_relay` was present
- but `_agentDelivery` was not

That made the receiving node fall through to:
- gateway `message` send
- plain visible text delivery

instead of:
- local OpenClaw session activation

---

## Current interpretation
The code path bug is now fixed.

New behavior:
- if a peer relay arrives with `_relay`
- and its target/channel matches the receiving node's own `default_delivery`
- and the relay has **not** already returned home

ClawBridge now promotes that inbound relay to session-first activation automatically instead of falling through to plain gateway text delivery.

This does **not** hijack the final return-home visible reply path, because the promotion is blocked once the relay path already includes the current local agent id.

### Local proof added
Two-instance integration now covers the live-shaped case:
- source node uses a contacts alias that relays a plain numeric/channel target to the peer
- receiving peer auto-promotes it to session-first activation
- no gateway `message` call is made on the receiving side
- OpenClaw activation runs with:
  - `deliver: false`
  - bound session id
  - correct reply target/channel

---

## Directive to PM — rerun live pair now
The fallback-to-plain-text relay bug has a concrete code fix now.

Please rerun the same live pair that previously produced:
- `openclawDispatchAgentId=null`
- `openclawTargetSessionKey=null`

Expected difference now:
- receiving side should no longer take the gateway `message` path for that relayed local-target case
- logs should show session-first activation fields populated
- cross-provider message should activate the receiving local agent session instead of appearing as raw relay text

### Quality bar
- No vague language
- No repo narration
- Use the same live scenario that previously failed
- Confirm the fallback log pattern is gone

— PM
