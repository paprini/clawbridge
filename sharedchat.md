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

**Meaning:** on latest code, Telegram node now recognizes both the Telegram target and the tested Discord target as provider-bound.

---

### Discord node rerun after latest update
**Node:** Discord/local node
**HEAD:** `50e9881`

#### Verify
- `20 passed, 1 failed`
- only failing check:
  - repository peers policy
- this is a local config-policy issue, **not** the Telegram/Discord interoperability blocker

#### Discord target proof
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

#### Telegram target proof from Discord node
Command:
```bash
node src/cli.js session-proof telegram 5914004682
```
Result after latest update:
- `provider_bound: false`
- `provider_bound_kinds: []`
- `collapsed_to_non_provider_session: false`
- `matching_rows: []`

**Meaning:** after the latest update, the Discord node now correctly recognizes the Discord target as provider-bound, but it still does **not** recognize the tested Telegram target as provider-bound.

---

## Current interpretation
### What is now proven
- Telegram target is provider-bound on the Telegram node ✅
- Discord target is provider-bound on the Telegram node ✅
- Discord target is provider-bound on the Discord node ✅
- Telegram target is **not** provider-bound on the Discord node ❌

### Sharper diagnosis now
The previous broad Discord-side hypothesis is no longer correct.
The latest code materially changed the results.

The remaining asymmetry is now much narrower:

> The unresolved gap is specifically the **Telegram target on the Discord node**.

That is the only tested target in this pair that still does not show a provider-bound matching row after the latest update.

### Additional compatibility fix pushed after this evidence
ClawBridge now treats both OpenClaw direct-key styles as equivalent for matching:
- `:direct:`
- `:dm:`

That matters because a real row like:
- `agent:main:telegram:dm:5914004682`

would previously have been missed even if it existed.

Targeted and full tests pass with `:dm:` rows.

### New compatibility fix now pushed locally
One more OpenClaw session-key compatibility gap existed:
- current code matched direct rows as `:direct:`
- official OpenClaw docs also describe DM rows as `:dm:`

That matters for the remaining Discord-node Telegram target proof because a real row like:
- `agent:main:telegram:dm:5914004682`

would have been missed before even if it existed.

New fix:
- `session-proof` now treats both `:direct:` and `:dm:` as provider-bound direct rows
- live session retargeting in `chat` now does the same
- targeted and full test suite pass

---

## Directive to gipiti — close the blocker
Do **not** add more tooling.
Use the latest reruns above.

### Your job now
Explain exactly why the Discord node still has no provider-bound matching row for:
- `telegram 5914004682`

while all three of the other tested proofs now succeed.

### Required answer
Close with one of these:
1. exact operator/setup requirement for the Discord node to create a reusable Telegram-target session row
2. exact OpenClaw provider/session limitation for this reverse direction
3. exact remaining code fix if the Telegram-target matching on the Discord node is still wrong

### Quality bar
- No vague language
- No repo narration
- No more tool-building
- Close the blocker explanation from the evidence already gathered

— PM
