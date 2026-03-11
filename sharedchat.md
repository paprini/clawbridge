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

### Current live bug
Messages can be delivered across providers, but live behavior is still reporting cases where the destination receives plain text without clearly activating the receiving agent session.

That means the launch blocker is **not solved** until live activation behavior is proven, not just repo-side tests.

---

## Latest validated repo-side state

### Telegram node (from PM GDrive feedback)
**Node:** `monti-telegram`
**HEAD:** `d89a5b6`

#### Verify
- `21 passed, 0 failed`

#### Test suite
- `28 suites passed`
- `1 suite failed`
- `231 tests passed`
- `1 test failed`

#### Only failing test
- `tests/unit/repo-policy.test.js`

#### Meaning
This is explicitly a **repo-policy / environment mismatch** because `config/peers.json` exists on a live install as active runtime config.
It is **not** evidence of runtime/protocol failure.

---

### Discord node (local rerun)
**Node:** Discord/local node
**HEAD:** `d89a5b6`

#### Verify
- `20 passed, 1 failed`
- only failing check:
  - repository peers policy

#### Test suite
- `28 suites passed`
- `1 suite failed`
- `231 tests passed`
- `1 test failed`

#### Only failing test
- `tests/unit/repo-policy.test.js`

#### Meaning
Same conclusion as Telegram node:
- local/config policy mismatch only
- not a runtime/protocol failure

---

## Important repo-side signal
A new integration path is now passing on latest code:

- `promotes relayed local-target aliases into session-first activation on the receiving peer` ✅

This is relevant because it is directly aimed at the live bug we were chasing.

Repo-side code/tests are now strong enough that the remaining uncertainty is **live behavior**, not basic internal coverage.

---

## Live blocker evidence still open
PM reports the same live symptom still needs resolution:
- both sides can receive messages
- but some paths still look like plain relay text
- not clearly activated agent-to-agent sessions

Discord-side local logs previously showed lines like:
```text
openclawDispatchAgentId=null
openclawTargetSessionKey=null
```

That remains the most important live-side clue.

---

## Directive to gipiti — hard push
Stop treating repo-side green as blocker closure.

### What is now true
- repo-side tests are strong
- both nodes show the same single non-runtime red item: repository peers policy
- that failure is environmental / policy only
- it does **not** explain the live activation bug

### Your job now
Focus only on the live activation mismatch.

### Required next answer
Explain, with evidence, why live cross-provider delivery can still appear as plain text relay instead of activated local agent session behavior, despite:
- repo-side session-first tests passing
- relay-to-local-target promotion test passing
- verify passing except for repo policy

### Required evidence
Use actual live logs / runtime traces, not just test reasoning.
Specifically address whether the live path is still falling back to gateway text send because:
1. `openclawDispatchAgentId` is not being set
2. `openclawTargetSessionKey` is not being resolved
3. a required live alias/default-delivery/session binding is still missing
4. or the runtime path differs from the tested integration assumptions

### Quality bar
- No vague language
- No repo narration
- No more claiming solved from tests alone
- Close the **live activation** blocker, not just the code-path theory

— PM
