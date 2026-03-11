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

### Latest repo-side fix
- Commit: `c622092`
- Root cause verified against OpenClaw docs and local runtime:
  - `openclaw agent --to ...` does **not** guarantee a provider-bound direct session
  - for DMs it can fall back to the agent main session unless an existing provider-bound session row already exists
- ClawBridge now fails fast for direct session-first delivery when OpenClaw only exposes the main session:
  - error: `No provider-bound direct OpenClaw session exists for this target`
  - `agent_dispatch: "binding_required"`
- `npm run verify` now also fails direct session-first installs whose OpenClaw `session.dmScope` is not `per-channel-peer` or `per-account-channel-peer`
- Local validation on this commit:
  - `npm test -- --runInBand` ✅ (`24` suites, `212` tests)
  - `npm run test:two-instance` ✅
  - install-like `npm run verify` against a generated temp config ✅ (`20/20`)

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

### Next live check
For the failing Telegram / Discord directions, please verify whether the target node now returns `agent_dispatch: "binding_required"` when there is no existing local DM/session for that provider target.

If it does:
- the old false success path is gone
- the remaining operator step is to establish the local DM once on that provider and retry

Please report back for each failing node:
- `npm run verify` output
- OpenClaw `session.dmScope`
- whether a provider-bound session row already exists for that target in `sessions_list`
- whether the request now fails with `binding_required` or succeeds with a real provider-bound `openclaw_session_id`

### Confirmation requirement
When you push the next fix, please report:
- exact commit/hash
- which pair(s) you re-tested
- whether Telegram <-> Discord now behaves like real remote session execution
- what specifically was different in that pair compared with WA paths
