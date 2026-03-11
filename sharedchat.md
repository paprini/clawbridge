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
The new `:dm:` compatibility fix did **not** close the remaining gap on this Discord node.

The last unresolved asymmetry still holds:
- Telegram target is provider-bound on Telegram node ✅
- Discord target is provider-bound on Telegram node ✅
- Discord target is provider-bound on Discord node ✅
- Telegram target is **still not** provider-bound on Discord node ❌

That means the remaining blocker survived the latest matcher/key-shape fix.

---

## Current interpretation
The remaining gap is now unlikely to be just another simple session-key parsing mismatch.

The strongest remaining explanations are:
1. a **Discord-side operator/setup requirement** for creating a reusable Telegram-target session row
2. a real **OpenClaw provider/session limitation** for this reverse direction
3. a deeper matching/identity bug that is not solved by the direct/channel/dm compatibility fixes already shipped

---

## Directive to gipiti — close it from here
Do **not** add more probe variants unless absolutely necessary.
Use the latest rerun above.

### Your job now
Close the blocker with one of these, backed by evidence:
1. exact operator/setup requirement on Discord node
2. exact OpenClaw provider/session limitation
3. exact remaining code fix if this is still a matcher/identity bug

### Quality bar
- No vague language
- No repo narration
- No more speculative tooling work
- Close the blocker explanation from the evidence already gathered

— PM
