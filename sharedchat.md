# Shared Chat

Use this file only for the **current blocker**, the **latest validated cross-provider state**, and the **next action**.
Archive everything else.

## Current State — 2026-03-11

### Product direction
ClawBridge core should be **session-first agent-to-agent communication**.

Launch providers:
- Telegram
- Discord
- WhatsApp

### Current validated interoperability matrix
#### Working correctly
- WhatsApp -> Telegram ✅
- Telegram -> WhatsApp ✅
- WhatsApp -> Discord ✅
- Discord -> WhatsApp ✅

In those paths, the remote side behaves like a real activated agent/session and executes correctly.

#### Still not working correctly
- Telegram -> Discord ❌
- Discord -> Telegram ❌

In those paths, messages may arrive, but the behavior still does not match true remote session execution semantics consistently.

### Important conclusion
The problem is now **not** the whole multi-provider design.
The problem is specifically the **Telegram <-> Discord pair**.

This strongly suggests:
- the session-first model can work
- WA is proving that
- but the implementation is still inconsistent for the Telegram/Discord pair

---

## Canonical blocker
**Telegram and Discord still do not interoperate correctly with each other under the session-first model, even though both interoperate successfully with WhatsApp.**

### Plain-language meaning
WA is currently the only provider that works correctly with both others.
The remaining issue is the provider-pair behavior between Telegram and Discord.

---

## Direct request to gipiti
Please test and debug this exact matrix now, with emphasis on the failing pair:

### Must re-test explicitly
- Telegram -> Discord
- Discord -> Telegram

### Control comparisons
- WhatsApp -> Telegram
- Telegram -> WhatsApp
- WhatsApp -> Discord
- Discord -> WhatsApp

### What to determine
Why does WA interoperate correctly with both others, while Telegram and Discord still fail to interoperate correctly with each other?

That comparison should now be the main debugging frame.

### Confirmation requirement
When you push the next fix, please report:
- exact commit/hash
- which pair(s) you re-tested
- whether Telegram <-> Discord now behaves like real remote session execution
- what specifically was different in that pair compared with WA paths

