# Shared Chat

Hello developer, I am `gipiti`, the expert developer instance working directly in this local clone of `clawbridge`.

Use this file for **current implementation status, active blockers, and exact live validation feedback only**.
Do not keep stale debugging history here once it has been distilled.

Archive:
- `docs/archive/sharedchat-history-2026-03-09.md`

## Current State — 2026-03-10

### Repo status
- latest follow-up fix for OpenClaw CLI discovery is implemented
- full local test suite passing: `22` suites / `183` tests
- local `npm run verify` passes
- release workflow is now tag-driven
- repo has a real tagged release: `v0.2.0`

### Release status
- `package.json` is now `0.2.0`
- git tag `v0.2.0` was created through the checked release flow
- pushing a `v*` tag now triggers GitHub Actions to run `npm ci`, tests, verify, and publish a GitHub Release page
- maintainers now have:
  - `npm run release:patch`
  - `npm run release:minor`
  - `npm run release:major`
- release process docs are in `docs/RELEASING.md`

### Confirmed working on live nodes
- peer auth ✅
- peer ping ✅
- `@agent-name` routing ✅
- visible message delivery ✅
- native activation path runs ✅
- real inbound activation now happens at least sometimes ✅

### Current blocker summary
ClawBridge has crossed the transport barrier, but it still does **not** deliver correct two-way cross-agent conversation semantics on multi-agent installs.

It is now effectively **one-way per message**.

---

## Live Validation Bug Report

### Environment
Real-node validation between:
- `guali-discord`
- `monti-telegram`

### What now works
- Telegram -> Discord can trigger a real visible inbound message
- Discord can visibly respond
- the native activation path is no longer failing on auth / sessions visibility / `sessions_send` / `ENOENT`

### Bug 1 — wrong local agent gets activated

#### Symptom
When the peer target is:
- `@guali-discord`

The Discord node activates:
- `musicate-pm`

instead of:
- the actual Guali Discord agent (`main`, or explicitly pinned local agent identity)

#### Evidence from Discord-node logs
```text
openclawDispatchAgentId=musicate-pm
openclawTargetSessionKey=agent:musicate-pm:discord:channel:1480310282961289216
```

#### Interpretation
ClawBridge is conflating:
1. **which local agent should answer**
2. **where the answer should be delivered**

Because the visible delivery lands in `#lounge`, and `#lounge` is bound in OpenClaw to `musicate-pm`, ClawBridge ends up waking PM instead of Guali Discord.

#### Expected behavior
If the peer target is:
- `@guali-discord`

then the local agent that gets activated must be the one representing `guali-discord`, not whichever OpenClaw agent happens to own the destination channel binding.

#### Fix direction
Separate:
- **local responding agent identity**
- **delivery destination / reply surface**

On multi-agent OpenClaw installs, those are not the same concept.

---

### Bug 2 — reply stays local instead of relaying back to origin peer

#### Symptom
Telegram -> Discord flow:
- inbound message reaches Discord
- Discord activates and responds visibly
- but the response is posted only in Discord’s own channel
- it is **not relayed back to Telegram automatically**

Feedback from Telegram side:
> No incoming chat from Discord. The response went to Discord's own channel, not back to me. For now the bridge is one-way per message.

#### Interpretation
Current behavior is:
- inbound delivery ✅
- local activation ✅
- local visible response ✅
- reply relay back to origin peer ❌

So the bridge behaves like:
- **one-way per message**

not like:
- **true two-way cross-agent conversation**

#### Expected behavior
If Telegram initiates a conversation toward Discord, then Discord’s reply should route back to Telegram automatically, preserving the conversation origin.

#### Fix direction
Preserve and use the **origin peer / origin route context** during and after activation, so the resulting reply is sent back through ClawBridge to the initiating peer instead of staying local-only.

---

## Current high-level conclusion
ClawBridge is no longer blocked on transport.

The remaining issues are now conversation-semantics issues:
1. wrong local agent identity selected on multi-agent installs
2. reply does not relay back to the origin peer

### Short version
Current state:
- transport works
- delivery works
- activation works
- but true bidirectional agent conversation still fails because:
  - `@guali-discord` may wake the wrong local agent
  - replies stay local instead of returning to the initiating peer

---

## Request to gipiti
Please treat this as the current live blocker and continue from here.

If you need anything from live nodes, ask explicitly here for:
- exact JSON responses
- config snapshots
- log excerpts
- repeated Discord ↔ Telegram validation

