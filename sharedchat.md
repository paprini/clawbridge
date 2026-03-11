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

## Latest validated evidence

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

### Discord node — corrected probe rerun
**HEAD:** `c4e2809`

#### Corrected Discord target proof
Command:
```bash
node src/cli.js session-proof discord 1480310282961289216
```
Result:
```json
{
  "provider_bound": false,
  "provider_bound_kinds": [],
  "collapsed_to_non_provider_session": false,
  "matching_rows": []
}
```

#### Corrected Telegram target proof from Discord node
Command:
```bash
node src/cli.js session-proof telegram 5914004682
```
Result:
```json
{
  "provider_bound": false,
  "provider_bound_kinds": [],
  "collapsed_to_non_provider_session": false,
  "matching_rows": []
}
```

#### Additional Discord-node facts
- `npm run verify` on this node still reports only one unrelated local config-policy failure:
  - repository peers policy
- this is **not** the Telegram/Discord interoperability blocker

### What this rerun means
The corrected probe did **not** overturn the Discord-side problem on this node.
Even after recognizing `channel` and `group` provider-bound rows, the rerun still finds:
- no provider-bound match for the tested Discord target
- no provider-bound match for the tested Telegram target

That means the blocker remains real on this node after the probe correction.

### New code fix after reviewing the Discord evidence
The corrected probe still had one more blind spot:
- it relied on `deliveryContext.to` / `lastTo`
- but real Discord provider-bound rows can still be identifiable only by the **session key**
- that includes rows like:
  - `agent:main:discord:channel:<id>:thread:<threadId>`
  - or key-only channel rows without a populated `deliveryContext.to`

New fix now pushed locally:
- probe and session retargeting both match provider-bound rows by **session key** as well as delivery metadata
- targeted and full test suite pass with key-only Discord thread/channel rows

This matters because the earlier Discord rerun may still have under-reported a real channel/thread route if the route lived only in the key.

---

## Current interpretation
### What is now proven
- Telegram target is provider-bound on the Telegram node ✅
- Discord target is not provider-bound on the Telegram node ❌
- Discord target is still not provider-bound on the Discord node after the corrected probe ❌
- Telegram target is still not provider-bound on the Discord node after the corrected probe ❌

### Strongest current reading
The blocker is still on the Discord side, but the remaining question is now even narrower:

> does the Discord node still show no provider-bound match after key-based channel/thread matching, or was the gap caused by rows that existed only in the session key?

---

## Required next action — PM live-node rerun
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
After those outputs are posted here, close the blocker as one of:
1. operator/setup requirement
2. OpenClaw provider/session limitation
3. remaining code fix

### Quality bar
- No vague language
- No repo narration
- No more tool-building
- Close the blocker explanation from evidence already gathered

— PM
