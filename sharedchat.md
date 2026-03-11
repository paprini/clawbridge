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
**HEAD:** pending current push

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
Previous result on `f71b9e7`:
- `provider_bound: false`
- `collapsed_to_non_provider_session: false`
- `matching_rows: []`

That result is now known to be **too narrow**.

The old `session-proof` logic only recognized provider-bound `:direct:` rows.
For Discord local delivery, that is wrong whenever the target is actually a channel route such as:
- `agent:main:discord:channel:1480310282961289216`

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

That means the old proof was under-reporting Discord local session availability.

New local code change:
- `session-proof` now recognizes provider-bound `channel` and `group` rows, not only `direct`
- targeted tests pass for a Discord channel row:
  - `provider_bound: true`
  - `provider_bound_kinds: ["channel"]`

---

## Current interpretation
The earlier Discord-side conclusion was too strong because the probe itself was biased toward direct-session rows.

### What is now proven
- Telegram target is provider-bound on the Telegram node ✅
- Discord target is not provider-bound on the Telegram node ❌
- Discord-node local channel rows do exist for Discord targets ✅
- Telegram target is not provider-bound on the Discord node ❌

### What this means
The real remaining question is narrower:

> Is the live Telegram -> Discord failure actually on the Discord local session match, or was that conclusion caused by a direct-only probe on a channel-targeted provider?

### Important nuance
Discord channel delivery and Discord DM delivery do **not** share the same session shape.
The corrected probe distinguishes them.

---

## Required next action — PM live-node test run
PM, please run these exact tests on the real nodes and paste the full JSON outputs back here.

### On the Discord node
Run:
```bash
node src/cli.js session-proof discord 1480310282961289216
node src/cli.js session-proof telegram 5914004682
```

Paste back:
- both full JSON outputs
- `npm run verify`

### On the Telegram node
Run:
```bash
node src/cli.js session-proof discord 1480310282961289216
node src/cli.js session-proof telegram 5914004682
```

Paste back:
- both full JSON outputs
- `npm run verify`

### Pair test to rerun after the probe
Run one real message each way:
- Telegram -> Discord
- Discord -> Telegram

Paste back for each:
- exact sender node
- exact target used
- returned ClawBridge JSON
- whether the receiving local agent actually answered
- whether a visible local provider message appeared

### What gipiti will decide from that
After those outputs are posted here, I will close the blocker as one of:
1. operator/setup requirement
2. OpenClaw provider/session limitation
3. remaining code fix

### Quality bar
- No vague language
- No repo narration
- No more general verification work
- Use the evidence already gathered
- Close the blocker explanation

— PM
