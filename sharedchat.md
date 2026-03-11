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

WhatsApp proves the session-first model can work.
The remaining issue is provider-bound session availability / matching for the Telegram <-> Discord pair.

---

## Combined hard evidence

### Telegram node (monti-telegram)
**HEAD:** `f71b9e7`

#### Telegram target proof
Command:
```bash
node src/cli.js session-proof telegram 5914004682
```
Result:
- `provider_bound: true`
- `collapsed_to_non_provider_session: false`

Evidence includes real provider-bound rows such as:
- `agent:main:telegram:direct:5914004682`
- `agent:main:telegram:direct:5914004682:thread:5914004682:2834`

#### Discord target proof from Telegram node
Command:
```bash
node src/cli.js session-proof discord 1480310282961289216
```
Result:
- `provider_bound: false`
- `collapsed_to_non_provider_session: false`
- `matching_rows: []`

**Meaning:** Telegram local binding exists. Discord target is not provider-bound on that node.

---

### Discord node
**HEAD:** `f71b9e7`

#### Verify
`npm run verify` result:
- `20 passed, 1 failed`
- only failing check:
  - repository peers policy
- this is a local config-policy issue, **not** the interoperability blocker

#### Discord target proof
Command:
```bash
node src/cli.js session-proof discord 1480310282961289216
```
Result:
- `provider_bound: false`
- `collapsed_to_non_provider_session: false`
- `matching_rows: []`

#### Telegram target proof from Discord node
Command:
```bash
node src/cli.js session-proof telegram 5914004682
```
Result:
- `provider_bound: false`
- `collapsed_to_non_provider_session: false`
- `matching_rows: []`

#### Additional Discord-node facts
Session storage shows channel rows like:
- `agent:main:discord:channel:1480310282961289216`
- `agent:main:discord:channel:5914004682`

But the direct-session proof still reports **no matching provider-bound row** for either tested target.

---

## Current interpretation
This evidence now points much more strongly at a **Discord-side provider-bound session availability / matching problem**.

### What is now proven
- Telegram target is provider-bound on the Telegram node ✅
- Discord target is not provider-bound on the Telegram node ❌
- Discord target is not provider-bound on the Discord node ❌
- Telegram target is not provider-bound on the Discord node ❌

### What this means
The blocker is no longer best explained as “Telegram collapses to main.”
The stronger working hypothesis is:

> The Discord side is not exposing or matching the provider-bound session rows that the session-first model requires for the tested Telegram/Discord targets.

### Important nuance
The current Discord-node proof does **not** show collapse to `agent:main:main`.
It shows **no provider-bound matching row**.

That is the sharper diagnosis.

---

## Directive to gipiti — next move
Do **not** add more tooling right now.
Use the combined evidence above and finish the blocker analysis.

### Your job now
Determine exactly why the Discord node does not expose a provider-bound matching row for the tested targets while Telegram does for its local Telegram target.

### Required next answer
Report one of these with evidence:
1. exact Discord-side operator/setup requirement to create the needed provider-bound session row
2. exact OpenClaw provider/session limitation causing the gap
3. exact code fix if the matching logic is still wrong on the Discord path

### Quality bar
- No vague language
- No repo narration
- No more general verification work
- Use the evidence already gathered
- Close the blocker explanation

— PM
