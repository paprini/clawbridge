# Shared Chat

## Introduction

Hello developer, I am `gipiti`, the expert developer instance working directly in this local clone of `clawbridge`.

Use this file to give me implementation instructions, technical constraints, or review requests. I will respond here with execution status, blockers, and completion notes as needed.

I am ready to work and waiting for instructions.

---

## Current Status — 2026-03-10

**Project:** ClawBridge (agent-to-agent networking for OpenClaw)

**Deployed:**
- 3 live instances (Discord, Telegram, WhatsApp)
- Full mesh ping working ✅
- Helper agent implemented ✅
- 137 tests passing ✅

**Recent work:**
- Fixed multipart args parsing
- Added helper agent (config/support for main agents)
- Hardened bridge security
- Improved docs structure

---

## Live Test Findings — 3 Bugs (HIGH Priority)

**From:** Monti (Telegram instance) via Guali Discord  
**Date:** 2026-03-10  
**Status:** Needs implementation

### Bug 1: `bridge.enabled` defaults to `false` 🔴

**Problem:** Silent failure — chat/broadcast fail with "tool execution failed"

**Root cause:** Bridge disabled by default

**Fix options:**
1. Default `enabled: true` in bridge.json
2. OR setup process enables it explicitly
3. OR skills check `bridge.enabled` and return clear error message

**Impact:** Users complete install, test ping ✅, then chat fails cryptically

---

### Bug 2: Chat skill target resolution 🔴

**Problem:** Can't send to human names like "Pato"

**Root cause:** Gateway needs platform-specific ID (e.g. `5914004682`), not display name

**Example:**
```javascript
chat({ target: "Pato", message: "hello" })
// → gateway gets "Pato" → can't resolve → fails
```

**Fix options:**
- **A (minimal):** Document that target must be numeric ID + clear error message
- **B (better):** Add `config/contacts.json` mapping: `{ "Pato": "5914004682" }`
- **C (ideal):** Service agent resolves names natively

**Impact:** Users can't send messages at all without platform IDs

---

### Bug 3: Peer identity shows `__shared__` 🟡

**Problem:** Can't identify which peer is calling

**Root cause:** Using shared token instead of peer-specific token

**Example:**
```
Discord → Telegram
Telegram sees: peer = "__shared__" (should be "guali-discord")
```

**Fix:** Peer A should send its OWN token (the one B has in peers.json for A), not shared token

**Impact:**
- Broken audit logs (can't see who called what)
- Broken per-peer rate limiting
- Broken per-peer permissions

---

## Priority (gipiti's assessment)

1. **Bug 2** — blocking users from sending messages
2. **Bug 1** — silent failure = terrible UX
3. **Bug 3** — security/audit issue

---

## PM Response — 2026-03-10 01:48 UTC

**From:** PM (via Guali Discord)

**Status:** Bugs confirmed and prioritized ✅

### Acknowledgment

Great work on the live testing and clear bug documentation. All 3 are real "last mile" problems — infrastructure works, user-facing functionality doesn't.

### Implementation Direction

**Approved priorities:**
1. Bug 2 (target resolution) — CRITICAL
2. Bug 1 (bridge default) — HIGH
3. Bug 3 (peer identity) — MEDIUM

**Approach:**

**Bug 2 (target resolution):**
- **Phase 1:** Option A (minimal) — document ID requirement + clear error
- **Phase 2:** Option B (better) — add contacts.json mapping
- Service agent (Option C) is future work, don't block on it

**Bug 1 (bridge default):**
- Change `bridge.enabled: true` by default
- Add validation in skills: check bridge.enabled before accepting call
- Return clear error: "Bridge not enabled. Set bridge.enabled:true in config/bridge.json"

**Bug 3 (peer identity):**
- Client should use peer-specific token when calling peers
- Auth layer should map token → peer ID from peers.json
- Shared token should only be fallback for unknown callers

### Next Steps

**For gipiti:**
1. Propose implementation plan for all 3 bugs
2. Estimate scope (files touched, test coverage needed)
3. Identify any blockers or unknowns

**After alignment:**
- Implement fixes
- Test locally
- Coordinate live deployment test

### Additional Context

- Helper agent is approved and validated ✅
- These bugs are separate from helper agent work
- Focus on user-facing functionality first
- Security/audit (Bug 3) can be second pass if needed

**We're in the final stretch — let's ship working cross-instance messaging.** 🚀

— PM

---

## Archive

Historical context moved to: `docs/archive/sharedchat-history-2026-03-09.md`

Includes:
- Initial handoff
- Service agent architecture discussion
- Bug reports (multipart args, extractArgs)
- Deployment lessons learned
- Documentation updates
- Production hardening notes

---

---

## PM Directive — Implement Now

**From:** PM
**Date:** 2026-03-10 01:50 UTC

### Direction

Implement all 3 bugs **now**. No plan needed.

You're the expert developer. You know the codebase. You know the fixes.

**Just do it:**

1. **Bug 2** (target resolution) — implement Option A first (doc + error), then Option B (contacts.json) if time allows
2. **Bug 1** (bridge default) — change default to true + add validation + clear errors
3. **Bug 3** (peer identity) — peer-specific tokens + map to peer IDs

**Test locally, push when ready.**

No need to post plan. No need to wait for approval. Ship it.

— PM

2026-03-10 — gipiti

Implemented the 3 bug fixes plus the setup/verification path needed to keep them fixed on fresh installs.

Done:
- Bug 1: bridge default and error path
  - `config/bridge.json` now defaults to `"enabled": true`
  - `npm run setup:auto` now writes `bridge.json` enabled by default
  - `chat` now fails early with a clear bridge error if bridge is disabled or `message` is not exposed
  - `npm run verify` now fails if `chat`/`broadcast` are exposed but the message bridge is missing or disabled

- Bug 2: target resolution
  - `chat` now rejects unresolved human-readable targets with a clear error instead of passing them blindly to the gateway
  - added optional `config/contacts.json` alias support
  - aliases support both plain names and channel-specific keys like `telegram:Pato`
  - `chat` returns `resolved_target` on success/error paths

- Bug 3: peer identity
  - auth now resolves peer-specific tokens before falling back to `A2A_SHARED_TOKEN`
  - this prevents peer calls from collapsing to `__shared__` when a peer token matches the shared token value

Additional alignment:
- `npm run setup:auto` now writes `chat` and `broadcast` into default `skills.json`
- active docs updated for bridge defaults, contacts aliases, and current setup behavior

Validation:
- targeted unit tests passed
- full suite passed: 18 suites, 150 tests
- `A2A_SHARED_TOKEN=test-shared-token-1234567890abcdef npm run verify` passed

Repo status after this note: ready to commit and push the bug-fix pass.
