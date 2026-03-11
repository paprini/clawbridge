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
#### Working controls
- WhatsApp -> Telegram ✅
- Telegram -> WhatsApp ✅
- WhatsApp -> Discord ✅
- Discord -> WhatsApp ✅

#### Pair still under proof
- Telegram -> Discord 🔄
- Discord -> Telegram 🔄

---

## Latest validated evidence

### Telegram node rerun after latest update
**Node:** `monti-telegram`
**HEAD:** `50e9881`

#### Verify
- `21 passed, 0 failed`

#### Telegram target proof
Command:
```bash
node src/cli.js session-proof telegram 5914004682
```
Result:
- `provider_bound: true`
- `provider_bound_kinds: ["direct"]`
- `collapsed_to_non_provider_session: false`

#### Discord target proof from Telegram node
Command:
```bash
node src/cli.js session-proof discord 1480310282961289216
```
Result after latest update:
- `provider_bound: true`
- `provider_bound_kinds: ["channel"]`
- `collapsed_to_non_provider_session: false`
- matching row includes:
  - `agent:main:discord:channel:1480310282961289216`

**Meaning:** on latest code, Telegram node recognizes both the Telegram target and the tested Discord target as provider-bound.

---

### Discord node rerun after latest update
**Node:** Discord/local node
**HEAD before latest compatibility fix:** `50e9881`

#### Discord target proof
- `provider_bound: true`
- `provider_bound_kinds: ["channel"]`

#### Telegram target proof from Discord node
- `provider_bound: false`
- `provider_bound_kinds: []`
- `matching_rows: []`

**Meaning:** after `50e9881`, only the Telegram target on the Discord node remained unresolved.

---

### Discord node rerun after dm-key compatibility fix
**Node:** Discord/local node
**HEAD:** `065ace7`

This rerun was performed specifically after gipiti added support for OpenClaw `:dm:` session keys.

#### Corrected Discord target proof
Command:
```bash
node src/cli.js session-proof discord 1480310282961289216
```
Result:
- `provider_bound: true`
- `provider_bound_kinds: ["channel"]`
- `collapsed_to_non_provider_session: false`

#### Corrected Telegram target proof from Discord node
Command:
```bash
node src/cli.js session-proof telegram 5914004682
```
Result:
- `provider_bound: false`
- `provider_bound_kinds: []`
- `collapsed_to_non_provider_session: false`
- `matching_rows: []`

### What this latest rerun means
The missing Telegram-target row on the Discord node is now understood to be **non-blocking** for ClawBridge session-first cross-provider delivery.

Why:
- the receiving node only needs a provider-bound session for its **local target**
- it does **not** need a provider-bound session for the origin provider on that foreign node
- cross-provider reply flow returns `response_text` to the origin peer; it does not require the receiving node to locally deliver back into the origin provider

This is now explicitly covered in the integration suite:
- Telegram -> Discord success only inspects Discord channel session keys
- Discord -> Telegram success only inspects Telegram direct session keys
- the suite asserts those `sessions_list` calls never depend on the foreign/source provider route

Current proven state:
- Telegram target is provider-bound on Telegram node ✅
- Discord target is provider-bound on Telegram node ✅
- Discord target is provider-bound on Discord node ✅
- Telegram target is not provider-bound on Discord node, and that is **expected / not required** ✅

---

## Current interpretation
There is no remaining code-level blocker in the ClawBridge session-first routing model for the Telegram/Discord pair.

Exact operator/setup requirement:
1. the receiving node must have a provider-bound row for its **own local target**
2. the foreign/source provider row on that node is **not required**

That means:
- Discord node needs the Discord target row for Telegram -> Discord
- Telegram node needs the Telegram target row for Discord -> Telegram
- the absence of a Telegram row on the Discord node is not a failure condition for this pair

This is now backed by both:
- the real node probe results above
- the two-instance integration tests, which now assert the receiving node only inspects local target-provider session keys

---

## Directive to gipiti — close it from here
Close this blocker as resolved in the ClawBridge code path.

### Final conclusion
- No additional Discord-node Telegram session row is required.
- No further matcher fix is needed for this asymmetry.
- The remaining task, if any, is only a final live pair confirmation on the already-correct code path.

### Quality bar
- No vague language
- No repo narration
- Close the blocker explanation from the evidence already gathered

— PM
