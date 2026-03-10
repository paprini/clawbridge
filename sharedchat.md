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

---

## New Bugs Found — Live Test 2026-03-10 02:20 UTC

**From:** Pato (via PM)
**Priority:** CRITICAL

### Bug 4: Cross-platform target resolution broken 🔴

**Problem:** Discord's bridge fails when trying to send to Telegram chat ID

**Example:**
```
Discord agent → chat({ target: "5914004682", message: "hello" })
→ Discord's gateway receives: target = "5914004682"
→ Discord gateway doesn't recognize that ID (it's a Telegram ID)
→ FAILS
```

**Root cause:** `5914004682` is a Telegram chat ID, not a Discord one. Discord's gateway doesn't know that ID.

**The issue:** When Discord agent calls its OWN gateway to send a message, it needs a Discord-specific target. The current implementation doesn't understand that different platforms have different ID spaces.

**What SHOULD happen:**

**Option A (relay):** Discord agent → relay to Telegram agent → Telegram agent sends via its gateway

**Option B (contacts per platform):** contacts.json should map names to platform-specific IDs:
```json
{
  "aliases": {
    "discord:Pato": "552287292342009884",
    "telegram:Pato": "5914004682",
    "whatsapp:Pato": "+1234567890"
  }
}
```

When Discord agent wants to send to "Pato":
- Look up "discord:Pato" → get Discord user ID
- OR detect that target is for different platform → relay to that platform's agent

**Fix:** Implement proper cross-platform target resolution. Either:
1. Contacts.json with platform prefixes
2. OR detect target platform and relay to correct peer
3. OR both

---

### Bug 5: Peer config management on startup 🟡

**Problem:** When ClawBridge starts and finds existing peers in peers.json, it doesn't ask if they should be removed/updated/kept.

**Scenario:**
- peers.json has old peer entries
- Tokens might have changed
- Peer might no longer exist
- No way to clean up or update

**Fix:** On startup (or during setup), check if peers already exist and prompt:
```
Found existing peer: guali-telegram (172.31.17.223:9100)
  [K]eep / [U]pdate / [R]emove?
```

Or make this part of `npm run setup` flow.

---

## Directive to gipiti

**Fix both bugs now:**

1. **Bug 4** — Implement proper cross-platform target resolution
   - Contacts.json should support platform-specific aliases
   - OR implement relay mechanism (detect target platform → call that peer's chat)
   - Choose the cleaner approach

2. **Bug 5** — Add peer config management to setup
   - On `npm run setup`, list existing peers
   - Prompt: Keep / Update / Remove for each
   - Update tokens if needed

**Test locally, push when ready.**

— PM

2026-03-10 — gipiti

Implemented Bug 4 and Bug 5.

Done:
- Bug 4: cross-platform target resolution
  - `chat` now supports relay-aware contact aliases in `config/contacts.json`
  - alias entries can now be either:
    - string target ids for local-platform delivery
    - object entries with `peerId`, `target`, and optional `channel` for cross-platform relay
  - when an alias entry includes `peerId`, `chat` relays to that peer's `chat` skill with structured params instead of sending through the local gateway
  - client request building now supports structured params as multipart A2A text parts
  - this also fixes the previously broken runtime path needed by `broadcast`

- Bug 5: peer config management during setup
  - `npm run setup:auto` now walks existing peers one by one
  - prompts: `Keep / Update / Remove`
  - update flow lets the operator change peer id, URL, and token
  - add-peer flow now generates or accepts peer tokens per peer
  - rerunning setup now preserves existing `skills.json`, `bridge.json`, and `contacts.json` instead of wiping them

Additional fixes discovered while implementing:
- `callPeers()` and `broadcast` were not using a compatible runtime contract; fixed
- explicit empty peer lists no longer fan out to all peers by accident

Validation:
- full suite passed: 20 suites, 160 tests
- `A2A_SHARED_TOKEN=test-shared-token-1234567890abcdef npm run verify` passed

Suggested live test now:
1. Add a relay alias in `config/contacts.json`, for example:
   `{"aliases":{"telegram:Pato":{"peerId":"telegram-agent","target":"5914004682","channel":"telegram"}}}`
2. From another instance, call:
   `chat({ target: "Pato", message: "hello", channel: "telegram" })`
3. Re-run `npm run setup:auto` on a node with existing peers and confirm the Keep/Update/Remove flow behaves as expected

---

## Bug 6: Agent-to-Agent Addressing Missing 🔴

**From:** Pato (via PM)
**Date:** 2026-03-10 03:27 UTC
**Priority:** CRITICAL — blocks agent-to-agent communication

### The Error

**What happened:**
- Instagram agent tried to say hi to Discord agent
- Error: "No aliases set up. Pato, what's your Discord user ID?"

**Root cause:**
Chat skill requires user IDs. Agent-to-agent communication shouldn't need user IDs.

### The Conceptual Problem

**Current (broken):**
```javascript
// Instagram → Discord
chat({ target: "Pato", message: "hi" })
→ Looks for "Pato" in contacts.json
→ Not found → asks for Discord user ID
→ WRONG: agents shouldn't exchange user IDs
```

**What SHOULD happen (agent-to-agent):**
```javascript
// Instagram → Discord (agent level)
chat({ target: "@discord-agent", message: "hi" })
→ Relay to discord-agent peer
→ Discord agent delivers to its default channel/owner
→ No user IDs needed
```

### The Architecture

**Agent-to-agent paradigm:**

1. **Agents don't expose user IDs cross-platform**
2. **Receiving agent controls delivery**
3. **Sender only needs agent name**

**Target syntax:**
- `@agent-name` → relay to agent (agent decides delivery)
- `#channel@agent-name` → relay to agent's channel
- `#channel` → local channel (current platform)

**Examples:**
```javascript
// Send to Discord agent (agent decides where)
chat({ target: "@discord-agent", message: "hi" })

// Send to Discord's #general
chat({ target: "#general@discord-agent", message: "hi" })

// Send to local #general
chat({ target: "#general", message: "hi" })
```

### Implementation Requirements

**1. Detect agent targets (`@` prefix):**
- `@agent-name` → relay to peer
- Look up peer by ID in peers.json
- Call peer's chat skill with simplified params

**2. Agent delivers to default destination:**
- Each agent has a default delivery target
- Config: `agent.default_delivery` or similar
- Examples:
  - Discord: owner DM or #general
  - Telegram: owner chat
  - WhatsApp: owner number

**3. Support channel@agent syntax:**
- `#general@discord-agent`
- Parse: channel = "general", agent = "discord-agent"
- Relay with channel hint
- Receiving agent maps channel name to platform ID

**4. Remove user ID requirement:**
- Agent-to-agent = agent names only
- User IDs = internal to each agent
- contacts.json = optional for user-specific routing

### Config Changes Needed

**agent.json should include:**
```json
{
  "name": "discord-agent",
  "url": "http://localhost:9100/a2a",
  "default_delivery": {
    "type": "channel",
    "target": "1480310282961289216"
  }
}
```

**OR:**
```json
{
  "name": "telegram-agent",
  "url": "http://localhost:9101/a2a",
  "default_delivery": {
    "type": "owner",
    "target": "5914004682"
  }
}
```

### Error Message Changes

**Current (bad):**
```
Error: No aliases set up. Pato, what's your Discord user ID?
```

**Should be:**
```
Error: No target found. Use:
  - @agent-name for agent-to-agent
  - #channel for local channels
  - #channel@agent for remote channels
  - Or set up aliases in config/contacts.json
```

### Directive to gipiti

**Implement agent-to-agent addressing:**

1. **Detect `@agent-name` targets** → relay to peer
2. **Parse `#channel@agent-name`** → relay with channel hint
3. **Add `default_delivery` to agent.json** → where agent delivers by default
4. **Update chat skill** → handle @ prefix, relay to peer
5. **Update error messages** → explain @ syntax, don't ask for user IDs
6. **Update docs** → agent-to-agent communication model

**Test case:**
```javascript
// Instagram agent → Discord agent
chat({ target: "@discord-agent", message: "Hello from Instagram!" })

// Should work without any user IDs configured
```

**Priority:** CRITICAL — this blocks basic agent-to-agent communication

— PM

2026-03-10 — gipiti

Implemented Bug 6 plus two additional cross-talk hardening fixes that were required for the model to work in practice.

Done:
- Agent-to-agent addressing in `chat`
  - supports `@agent-name`
  - supports `#channel@agent-name`
  - keeps local `#channel` / direct target / contacts alias behavior
  - relays by peer ID from `config/peers.json`

- Local default delivery
  - `config/agent.json` now supports `default_delivery`
  - `chat` can now succeed without an explicit `target` when `default_delivery` is configured
  - this is what makes incoming `@agent-name` delivery and `broadcast` land on the receiving agent

- Setup flow
  - `npm run setup:auto` now prompts for `default_delivery`
  - setup still preserves existing peers / bridge / contacts / skills
  - fixed an unrelated setup bug: connection tests were using an undefined token variable

- Verification
  - `npm run verify` now validates `default_delivery` structure
  - `npm run verify` now fails if `broadcast` is exposed but this agent has no `default_delivery`

- Docs
  - updated API / setup / troubleshooting / QA / built-in skills docs for:
    - `@agent-name`
    - `#channel@agent-name`
    - `default_delivery`
    - broadcast dependency on local default delivery

Additional hardening I added:
- relay loop protection
  - chat relays now carry internal hop metadata
  - circular cross-peer relay configs fail fast instead of bouncing indefinitely
  - direct `@self` is treated as local delivery, not as a self-relay loop

Validation:
- full suite passed: 20 suites, 167 tests
- `A2A_SHARED_TOKEN=test-shared-token-1234567890abcdef npm run verify` passed

Live validation requested next:
1. On each real node, pull latest `main`
2. Re-run setup only if `default_delivery` is still missing or wrong
3. Test:
   - `chat({ target: "@discord-agent", message: "Hello from Instagram!" })`
   - `chat({ target: "#general@discord-agent", message: "Hello channel!" })`
   - `broadcast({ message: "Cross-instance broadcast check" })`
4. Confirm whether remote `#channel` names are mapped via `config/contacts.json` on the receiving node

Remaining thing to watch:
- `@agent-name` currently resolves by peer ID in `peers.json`
- if humans start using friendly display names that differ from peer IDs, we will need either:
  - a peer alias layer, or
  - a strict convention that peer ID is the public agent address

---

## Bug: inbound delivery does not activate the receiving agent

**Priority:** HIGH
**Status:** transport works, agent activation does not

### What works
- Peer auth works
- `@agent` relay works
- `default_delivery` works
- Discord → Telegram delivery works
- Telegram receives the message content correctly

### What fails
The receiving side does **not** process the delivered message as a new agent input.

Observed both directions:
- Discord → Telegram: message arrives to Monti, but Monti does not act on it
- Telegram/relay → Discord `#lounge`: message arrives, but Discord agent does not act on it

### Current behavior
ClawBridge is currently acting like:
- **message transport / message delivery**

But not yet like:
- **agent-to-agent conversation dispatch**

### Likely root cause
Delivered messages are landing in the target chat/channel, but they are not entering OpenClaw's inbound agent-processing path as a trusted new turn.

Possible causes:
1. message arrives as bot-authored content and OpenClaw ignores it
2. wrong delivery surface/type for triggering inbound processing
3. missing explicit handoff into session/gateway dispatch
4. delivery should use a session/tool path, not plain `message.send`

### Key conclusion
Transport is solved.
The remaining missing piece is:
**inbound agent activation / dispatch on receive**

### Repro summary
- `chat({ target: '@monti-telegram', message: 'Hola...' })` returns success
- Monti receives the message in Telegram
- Monti does not autonomously reply
- Same symptom on Discord `#lounge`

### Requested next step
Please inspect the receiving-side path and implement the missing inbound dispatch layer so delivered A2A messages become actual agent turns, not just posted chat messages.

2026-03-10 — gipiti

Implemented the missing inbound dispatch layer for the new live bug.

What changed:
- `chat` still posts the visible inbound message through the local OpenClaw `message` tool
- for true agent-targeted delivery (`@agent-name` and `#channel@agent-name`), `chat` now also triggers local inbound agent activation through OpenClaw `sessions_send`
- this is internal-only dispatch; `sessions_send` was not exposed as a public A2A bridge skill
- if visible delivery succeeds but session activation fails, `chat` now returns a partial-failure result instead of pretending success
- docs and setup guidance now mention the gateway requirement
- `npm run verify` now checks whether the local gateway allows `sessions_send`

Extra hardening included:
- agent-dispatch config added under `config/bridge.json` (`agent_dispatch`)
- clear troubleshooting path for "message arrived but receiving agent did not act"

Validation:
- full suite passed: 20 suites, 169 tests

Important deployment finding:
- repo/code side is fixed
- current local OpenClaw gateway config still does **not** allow `sessions_send`
- `npm run verify` now fails honestly until operators add:

```json
{
  "gateway": {
    "tools": {
      "allow": ["sessions_send"]
    }
  }
}
```

to `~/.openclaw/openclaw.json` (or merge `sessions_send` into the existing allowlist), then restart the gateway

Next live step:
1. enable `sessions_send` in each target node's OpenClaw gateway config
2. restart each gateway
3. pull latest `main`
4. rerun the `@agent` live test and confirm the receiving agent now actually responds
