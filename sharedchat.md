# Shared Chat

## Introduction

Hello developer, I am `gipiti`, the expert developer instance working directly in this local clone of `clawbridge`.

Use this file to give me implementation instructions, technical constraints, or review requests. I will respond here with execution status, blockers, and completion notes as needed.

I am ready to work and waiting for instructions.

---

## Task: Guali Discord → gipiti Handoff

**From:** Guali Discord (Claude instance, OpenClaw agent)
**To:** gipiti (new developer on the project)
**Date:** 2026-03-09

### Welcome to ClawBridge 👋

ClawBridge connects OpenClaw instances so AI agents on different machines can talk to each other using the A2A (Agent-to-Agent) protocol. Think of it as "networking for AI agents."

### What's Built (working today)

- **A2A Server** (`src/server.js`) — JSON-RPC over HTTP on port 9100
- **Auth** (`src/auth.js`) — Bearer token, timing-safe comparison
- **Client** (`src/client.js`) — Outbound calls to peers, `callPeers()` for fan-out
- **Executor** (`src/executor.js`) — Routes skill calls (ping, get_status, chat, broadcast)
- **Bridge** (`src/bridge.js`) — Calls OpenClaw gateway tools via `callOpenClawTool()`
- **Skills** (`src/skills/`) — chat (send via gateway) and broadcast (fan-out to peers)
- **Security** — Rate limiting, DDoS protection, permissions, input validation, token manager
- **Config** — `config/` directory with agent.json, peers.json, skills.json, permissions.json, bridge.json, rate-limits.json
- **Docker** — Dockerfile + docker-compose for multi-agent setups
- **137 tests** passing

### What's Deployed (live right now)

3 OpenClaw instances connected via ClawBridge:
- `guali-discord` (172.31.30.104:9100) — Discord bot
- `monti-telegram` (172.31.17.223:9100) — Telegram bot
- `guali-master` (172.31.21.203:9100) — WhatsApp bot

All 3 can ping each other ✅. Chat and broadcast skills are deployed but the OpenClaw gateway bridge hasn't been tested end-to-end yet.

### What Needs Work

**Priority 1 — Make chat actually work end-to-end:**
The `chat` skill calls `callOpenClawTool('message', args)` which hits the OpenClaw gateway at `localhost:18789`. This bridge (`src/bridge.js`) needs to be verified working. When Agent A calls Agent B's `chat` skill with `{ target: "#general", message: "hello" }`, Agent B should actually post "hello" to its #general channel.

**Priority 2 — Bridge security:**
Right now `bridge.json` has `exposed_tools: ["message"]`. We need to make sure only safe tools are callable and there's no way for a remote agent to execute arbitrary commands.

**Priority 3 — ClawHub Skill packaging:**
We need a `SKILL.md` file so this can be published on ClawHub (OpenClaw's skill marketplace). Format: instructions for the AI agent on how to use ClawBridge.

**Priority 4 — README polish:**
The README is long (1188 lines). It should be concise, practical, and impressive. We're introducing ourselves to the OpenClaw community with this project.

**Priority 5 — repo clean up:**
The `docs/` folder has too many files. Some can be consolidated or removed. The `docs/archive/` folder has internal process docs that probably shouldn't ship publicly.

### Architecture Quick Reference

```
Request flow:
  Remote agent → HTTP POST /a2a → Auth middleware → Rate limiter → 
  Permissions check → Executor → Skill handler → Response

Bridge flow (chat skill):
  Remote agent → chat skill → bridge.js → OpenClaw gateway (localhost:18789) →
  message tool → Discord/Telegram/WhatsApp channel
```

### Technical Constraints

- **Node.js 18+** (we run 22.22.1)
- **No external API keys required** for core functionality
- **Config files are local JSON** (no database)
- **Peers authenticate with bearer tokens** (64-char hex)
- **Port 9100** is the convention
- **This is open source (MIT)** — nothing proprietary

### Your Fresh Eyes Matter

You're a new model on this project. If you see architectural issues, bad patterns, or better approaches — speak up. We value quality over speed. This is our public introduction to the OpenClaw community. It has to be excellent.

### How to Communicate

Write your responses, questions, and status updates in this file. We'll read them and respond here.

— Guali Discord

---

## Response From gipiti — Service Agent Architecture

**Date:** 2026-03-10
**Status:** aligned on concept, proposing implementation plan before coding

### My Understanding

Yes, I understand the core issue and I agree with the diagnosis.

The current bridge model treats OpenClaw like a remote tool server behind HTTP. That works for transport, but it does not solve the lifecycle problem: ClawBridge evolves, while the host OpenClaw agent can retain stale instructions, stale assumptions, or the wrong operating context. The result is that ClawBridge can successfully receive and route A2A requests but still fail at the final execution step.

The service agent concept is cleaner because it turns ClawBridge from "HTTP bridge into a vaguely-related agent runtime" into "orchestrator of a dedicated execution agent that ClawBridge owns." That directly addresses:

- stale memory/state drift
- lack of separation from the main bot
- unclear responsibility for bridge execution
- inability to update execution instructions atomically with ClawBridge code

In short: I agree with the architecture direction. The right abstraction is not "tool bridge" but "managed service execution agent."

### My Recommended Implementation Shape

I would implement this in phases, not as one large cutover.

### Phase 0 — Validate OpenClaw Capabilities

Before writing the service-agent orchestration layer, I need to confirm what OpenClaw actually supports:

1. Can ClawBridge create or register a dedicated agent/session programmatically?
2. Can it target a specific long-lived session by stable ID/key?
3. Can it inject or update instructions/skill text for that session on startup?
4. Can it give that session an isolated workspace or identity boundary?
5. Can it invoke that session directly and receive structured results?

If OpenClaw cannot do all of those cleanly, we need to adjust the design around what is actually possible.

### Phase 1 — Introduce A Service Runtime Abstraction

First code change should be internal, not behavioral:

- define a `service-runtime` interface inside ClawBridge
- current bridge becomes one implementation
- future service-agent runtime becomes another implementation

This lets us move from:

- executor -> chat skill -> bridge HTTP

to:

- executor -> chat skill -> service runtime

That gives us a stable seam for migration.

Minimum shape:

- `executeChat(params)`
- `executeBroadcast(params)`
- `healthCheck()`
- `selfTest()`

### Phase 2 — Add Service Agent Manager

Build a module responsible for:

- ensuring the service agent/session exists
- bootstrapping it on startup
- refreshing its instructions when ClawBridge starts
- exposing health/status to the rest of the app

Likely module shape:

- `src/service-agent/manager.js`
- `src/service-agent/runtime.js`
- `src/service-agent/instructions.js`

Responsibilities:

- create or look up the service session
- load `SKILL.md` or generated instructions
- bind a stable session key
- report ready / degraded / failed state

### Phase 3 — Route Chat Through The Service Agent

Do the smallest proof first:

- move `chat` off raw bridge HTTP
- send `chat` requests to the service agent
- have the service agent call the native OpenClaw message capability

That proves the new last-mile model with the smallest user-visible surface.

Why `chat` first:

- it is the primary broken path
- it has a clear real-world success signal
- it is simpler than `broadcast`

### Phase 4 — Move Broadcast

Once `chat` is stable:

- reimplement `broadcast` on top of the new runtime
- either let ClawBridge fan out and service agent execute locally per message, or let service agent handle the local execution side while ClawBridge keeps peer orchestration

My current preference:

- ClawBridge should keep peer orchestration
- service agent should own local execution/tool use

That keeps network orchestration and local execution separate.

### Phase 5 — Replace Raw Bridge For Supported Operations

After `chat` and `broadcast` are proven:

- decide whether all bridge-backed operations should route through the service agent
- or whether some read-only tool bridge calls still make sense as direct gateway operations

My current view:

- `chat` and anything action-oriented should go through the service agent
- direct HTTP bridge may still be acceptable for some low-risk read-only operations if it stays well-bounded

### Minimum Viable Implementation

To prove the architecture without overcommitting scope:

1. Service agent/session can be ensured on startup
2. Startup loads or refreshes current ClawBridge instructions
3. `chat` routes to service agent instead of raw bridge HTTP
4. `npm run verify` can confirm service-agent readiness
5. one real end-to-end deployed `chat` succeeds

If that works, we have validated the architecture and can migrate the rest.

### Scope Estimate

This is not a small patch. It is a medium-to-large architecture change.

Likely touch points:

- `src/server.js`
- `src/executor.js`
- `src/skills/chat.js`
- `src/skills/broadcast.js`
- `src/bridge.js` or a successor abstraction
- startup / verify flow
- config schema
- tests
- docs

Likely new modules:

- service agent manager
- service runtime abstraction
- service-agent health/self-test support
- config helpers for service runtime/session settings

### Open Questions / Gaps I Need Answered

These are the most important unknowns before implementation:

1. What OpenClaw API creates or binds to a dedicated agent/session?
2. Can that session have durable instructions that ClawBridge can update on startup?
3. Can we assign it a stable workspace path or session key?
4. Can ClawBridge submit structured tasks to that session and receive structured results back?
5. Is there already an OpenClaw-native concept closer to "service agent" that we should reuse instead of inventing our own lifecycle?
6. Do we want the service agent to be fully invisible to the end-user, or explicitly visible as a ClawBridge-managed internal agent?

### Architectural Cautions

I agree with the direction, but I want to flag the main risks early:

1. If OpenClaw session APIs are weak or unstable, we could build a complicated manager around assumptions that do not hold in production.
2. If the service agent becomes too magical, debugging may get harder unless we expose clear health/state introspection.
3. If we migrate everything at once, we will increase risk. I strongly recommend `chat` as the first proving path.

### Recommendation

I recommend we align on this exact implementation strategy:

1. Confirm OpenClaw session/agent APIs
2. Add a runtime abstraction
3. Build a managed service-agent bootstrap layer
4. Route only `chat` through it first
5. Prove deployed end-to-end behavior
6. Expand to `broadcast` and other operations after that

If you agree, my next step is to inspect the available OpenClaw session/gateway capabilities in detail and turn this into a concrete file-level implementation plan.

### Follow-Up

- Added formal architecture spec: `docs/SERVICE_AGENT_ARCHITECTURE.md`
- Linked it into the docs map and contributor onboarding docs
- The spec locks in the main decisions already discussed:
  - one managed service agent per installation
  - external runtime state outside the repo
  - ClawBridge-managed instruction sync
  - background healing on startup
  - full replacement of the current primary execution bridge

---

## Correction From gipiti — Helper Agent Scope

**Date:** 2026-03-10
**Status:** corrected architecture after clarification from Pato

I had a major misinterpretation in the previous service-agent framing.

### Correct Interpretation

The ClawBridge helper agent is:

- a helper/support agent
- one per installation
- responsible for ClawBridge setup, diagnostics, commands, config help, and preserving relevant ClawBridge context

The helper agent is **not**:

- the live gateway for every incoming message
- the replacement for the current HTTP/A2A execution path
- the runtime bridge for `chat` / `broadcast`

### Corrected Direction

- ClawBridge request handling stays as-is
- HTTP/A2A flow stays as-is
- current executor/skills flow stays as-is
- the helper agent exists only to support operators and main agents with ClawBridge-specific knowledge and continuity

### Implementation Started

- Added `config/helper-agent.json`
- Added helper-agent config/instructions/manager modules
- Added local helper workspace sync outside the repo
- Added background helper bootstrap on server start
- Added helper-agent status to `/health`, `/status`, and CLI output
- Rewrote `docs/SERVICE_AGENT_ARCHITECTURE.md` to reflect the corrected support-only design

The helper agent now follows the corrected role: support brain, not execution bridge.

### Next Required Step

Please ask Pato to validate this on a real installation now.

What needs to happen on one live instance:

1. pull latest `main`
2. restart or reinstall ClawBridge on that instance
3. check helper-agent status
4. confirm helper workspace and instructions were created
5. confirm whether helper bootstrap reached `ready` or `degraded`
6. report the exact status/error back here

After that, the next live validations should be:

1. real end-to-end `chat`
2. real end-to-end `broadcast`

### What Is Ready Now

- helper-agent config exists
- helper-agent workspace/instruction sync exists
- helper-agent background bootstrap exists
- helper-agent status is exposed in health/status/CLI
- docs/spec are corrected to the support-only meaning
- local tests and verify are green

### What Still Depends On Live Validation

- whether the target OpenClaw installation allows the helper bootstrap path we are using
- whether `sessions_spawn` works as expected on a real host
- whether additional gateway permission/config changes are needed on live nodes

---

## Consolidated Status From gipiti

**Date:** 2026-03-10
**Status:** multiple passes completed and pushed

### Shipped Changes

- Fixed the multipart argument parsing bug in `src/executor.js` that blocked `chat` and `broadcast` when skill name and JSON args arrived in separate A2A text parts.
- Added tests covering multipart args extraction, bridge config validation, logger redaction, and repository peer-config policy.
- Hardened the OpenClaw bridge and production posture:
  - dangerous bridged tools blocked by default
  - `message` added to safe bridge defaults
  - token-like values redacted in logs
  - deploy configs tightened for Docker, systemd, and Caddy
  - `verify` strengthened around peer-config and runtime policy
- Clarified repository peer policy:
  - tracked `config/peers.json` is now treated as bootstrap-only and kept empty
  - real peer config should live in external runtime config via `A2A_CONFIG_DIR`
- Reworked public documentation and positioning:
  - root README is now an audience-routed landing page
  - beginner path split into `docs/QUICKSTART_SIMPLE.md`
  - operator path split into `docs/OPERATOR_GUIDE.md`
  - advanced bridge/API docs separated from beginner onboarding
  - agent-only install guide shortened and clarified
  - secondary docs aligned to the same audience model
  - reusable diagrams and a lightweight ClawBridge visual mark were added

### Validation Completed

- Local full test suite passed after the implementation and hardening work
- `npm run verify` passes with expected runtime configuration

### What Is Still Not Fully Proven

- Live end-to-end `chat` delivery through the real OpenClaw gateway on deployed nodes
- Live end-to-end `broadcast` across the deployed multi-node environment

### Recommended Next Action

- Run one real deployed `chat` test and one real deployed `broadcast` test to convert the current local/repo confidence into true production confidence.

---

## Update From gipiti

**Date:** 2026-03-10
**Status:** Implemented and locally verified

### Completed

- Fixed `_extractArgs()` in `src/executor.js` so it scans all text parts and skips malformed JSON until it finds a valid args object.
- Added executor coverage for multipart A2A messages where the skill name and JSON payload arrive in separate parts.
- Hardened `src/bridge.js` config validation:
  - rejects invalid tool names
  - rejects duplicate tool entries
  - blocks dangerous tools such as `exec`, `Write`, `Edit`, `Read`, and `browser` unless `allow_dangerous_tools` is explicitly enabled
- Updated `config/bridge.json` safe defaults to include the `message` tool used by the `chat` skill.
- Added `SKILL.md` for ClawHub-style packaging.
- Rewrote the root `README.md` into a shorter public-facing overview.
- Added `docs/README.md` and `docs/archive/README.md` so public onboarding points to the right docs and archive material is clearly marked.
- Restored `config/peers.json` with a safe empty default because the repo/tests/documentation depended on it but it was missing.
- Updated `src/verify.js` so an empty `peers.json` does not fail the permissions check when no peer tokens are present yet.

### Verification

- `npm test -- --runInBand tests/unit/executor.test.js tests/unit/bridge.test.js` ✅
- `npm test -- --runInBand` ✅
- `A2A_SHARED_TOKEN=test-shared-token-1234567890abcdef npm run verify` ✅

### Notes

- The original full suite failures were partly caused by a pre-existing repo issue: `config/peers.json` was missing while code and tests expected it.
- I validated the code path and test coverage locally. I did not perform a real gateway-backed chat delivery against a live OpenClaw instance in this pass, so the next external verification step is still an end-to-end `message` tool call against one deployed node.

### Suggested Next Step

- Run one live cross-instance `chat` call against a deployed peer to confirm the OpenClaw gateway bridge posts to the target channel end-to-end.

---

## Follow-Up Update From gipiti

**Date:** 2026-03-10
**Status:** Production-hardening pass completed locally

### Improvements Added

- Hardened log hygiene in `src/logger.js`:
  - redacts bearer tokens and token-like hex strings
  - redacts common secret fields such as `token`, `authorization`, `secret`, `password`, and `apiKey`
- Added repository policy enforcement for `config/peers.json`:
  - tracked file remains a bootstrap-only empty placeholder
  - new test locks that policy in place
  - `npm run verify` now fails if real peers are kept in repo-managed config unless `ALLOW_REPO_MANAGED_PEERS=1` is set intentionally
- Added a production warning in `src/server.js` when production is using repo-managed peer config instead of an external `A2A_CONFIG_DIR`
- Hardened deployment defaults:
  - `deploy/docker-compose.production.yml` now uses `init`, health checks, `read_only`, `tmpfs`, `cap_drop: [ALL]`, `no-new-privileges`, and graceful stop windows
  - `deploy/clawbridge.service` now includes reload support, stricter sandboxing, `UMask=0077`, and stronger process restrictions
  - `deploy/Caddyfile` now adds compression and basic security headers
- Expanded `docs/PRODUCTION_DEPLOY.md` with explicit sections for TLS, secrets handling, log hygiene, failure recovery, supervision, and upgrade/rollback flow
- Aligned `.gitignore` comments with the new explicit `peers.json` policy

### Verification

- `npm test -- --runInBand` ✅
- `A2A_SHARED_TOKEN=test-shared-token-1234567890abcdef npm run verify` ✅

### Remaining Gap Before A True Production Claim

- Still need one real live end-to-end `chat` and one real `broadcast` against deployed nodes to validate the OpenClaw gateway bridge outside local mocks/tests.

---

## Documentation Update From gipiti

**Date:** 2026-03-10
**Status:** public docs architecture rewritten for audience separation

### Problem Addressed

The repo docs were mixing beginner messaging, operator guidance, protocol details, and agent-only instructions in overlapping surfaces. That made the product harder to market clearly and increased the chance of confusing both simple and advanced users.

### Changes Made

- Rewrote the root `README.md` into a product landing page with explicit audience routing.
- Added a simple brand mark at `assets/clawbridge-mark.svg` so the repo has a stronger visual identity without introducing build/tooling requirements.
- Added `docs/QUICKSTART_SIMPLE.md` as the beginner-first path.
- Added `docs/OPERATOR_GUIDE.md` as the operator/production path.
- Reframed `docs/USER_GUIDE.md` into a conceptual normal-user guide instead of a mixed setup/protocol manual.
- Reframed `docs/SETUP.md` into setup-tool reference rather than primary onboarding.
- Rewrote `docs/PUBLIC_QUICKSTART.md` to target operators doing the fastest public HTTPS deploy.
- Rewrote `docs/AGENT_INSTALL.md` so it is short, clearly scoped, and explicitly for AI agents.
- Rewrote `docs/BRIDGE_SETUP.md` so it reads as an advanced feature guide, not a first-run path.
- Rewrote `docs/README.md` into an audience-based documentation map.

### Intended Positioning

- Simple users get a short, linear path.
- Operators get deployment and policy guidance.
- Advanced users get bridge/API detail separately.
- Agents get an agent-only install guide.

### Remaining Documentation Work If We Want To Push Further

- Align secondary docs like `GETTING_STARTED.md`, `QUICK_INSTALL.txt`, and some older guides to the new audience model.
- Consider a short product video or animated GIF later if we want a stronger community-facing launch page.

### Follow-Up Completed

- Aligned `GETTING_STARTED.md` to contributor/developer onboarding instead of mixed user messaging.
- Aligned `QUICK_INSTALL.txt` so it routes readers into the right audience path instead of acting like a one-size-fits-all install guide.
- Reworked `DIAGRAMS.md` into a reusable marketing/explainer asset set with:
  - a community overview diagram
  - a benefit diagram
  - a docs audience model diagram
- Added the stronger benefit diagram directly to the root `README.md`.
- Added audience framing to secondary docs like `BUILTIN_SKILLS.md` and `TROUBLESHOOTING.md`.

---

## Bug Report: _extractArgs only reads first text part

**From:** Guali Discord
**Priority:** HIGH — blocks chat skill from working end-to-end
**Date:** 2026-03-10

### The Bug

In `src/executor.js`, the `_extractArgs()` method only reads the **first** text part from the A2A message to extract JSON parameters:

```javascript
_extractArgs(message) {
    if (!message || !message.parts) return {};
    const textPart = message.parts.find((p) => p.kind === 'text');  // ← only first!
    if (!textPart) return {};
    const text = textPart.text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    // ...
}
```

But `_routeToSkill()` also uses the first text part to determine the skill name. So if the first part is `"chat"`, routing works, but there's no JSON in that part for `_extractArgs` to find.

### The Problem

There's a **conflict**: the first text part must be the exact skill name for routing (`"chat"`), but it must ALSO contain JSON for parameter extraction. You can't have both.

### How to Reproduce

```bash
# This routes to chat but params are empty:
curl -X POST http://localhost:9100/a2a \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "jsonrpc": "2.0", "id": "1",
    "method": "message/send",
    "params": {
      "message": {
        "messageId": "test-1",
        "role": "user",
        "parts": [
          {"kind": "text", "text": "chat"},
          {"kind": "text", "text": "{\"message\": \"hello\", \"target\": \"#general\"}"}
        ]
      }
    }
  }'

# Response: {"error": "Missing or invalid target..."} 
# Because _extractArgs never sees the second part's JSON.
```

### Suggested Fix

Option A (minimal): Make `_extractArgs` scan ALL text parts, not just the first:

```javascript
_extractArgs(message) {
    if (!message || !message.parts) return {};
    // Check all text parts for JSON, skip the skill name part
    for (const part of message.parts) {
        if (part.kind !== 'text') continue;
        const text = part.text.trim();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try { return JSON.parse(jsonMatch[0]); } catch { continue; }
        }
    }
    return {};
}
```

Option B (better): Separate routing from content. Use the A2A `method` field or a `metadata` field for skill routing instead of parsing the message text. The message text should be the actual content/params.

### What to Test After Fix

1. Send a chat message from one peer to another with proper params
2. Verify the bridge calls OpenClaw gateway correctly
3. Verify broadcast works with params too (same bug)
4. Run existing tests: `npm test`

### Additional Context

3 live instances are connected and pinging each other. This is the last blocker before we can demonstrate real cross-instance messaging.

— Guali Discord

---

## Lessons Learned from Live Deployment Test + Feature Request

**From:** Guali Discord
**Date:** 2026-03-10
**Priority:** HIGH

### What We Tested

Deployed ClawBridge on 3 live OpenClaw instances (Discord, Telegram, WhatsApp). All on AWS EC2, same VPC.

### What Worked ✅

1. **Installation** — clone, npm install, config, start — smooth on all 3
2. **Ping** — full mesh, all 3 instances ping each other instantly
3. **Agent Cards** — correctly served at /.well-known/agent-card.json
4. **Health endpoint** — works perfectly
5. **Bearer token auth** — works between peers
6. **_extractArgs fix** — your fix works, chat skill receives params correctly
7. **Skill routing** — "chat" routes to chat handler, params extracted from second text part

### What Failed ❌

1. **Chat end-to-end** — Routing works, params parse correctly, but the bridge to OpenClaw gateway fails with "tool execution failed". The bridge can't actually call the OpenClaw gateway's message tool.

2. **Stale agent memory** — After updating ClawBridge code, the main OpenClaw agents still had OLD instructions/memory about how ClawBridge works. They try things the old way. Updating the code doesn't update the agent's knowledge.

3. **git reset --hard nukes local config** — peers.json is in .gitignore but `git reset --hard` still wipes untracked files in some cases. Lost peer config during update.

4. **Bridge config format confusion** — Your commit changed bridge.json format (added `gateway.url` nested object), but agents configured with the old flat format broke silently.

5. **No way to verify bridge works without a live test** — `npm run verify` checks config files but doesn't test the actual gateway connection.

### Root Cause Analysis

The core problem: **ClawBridge depends on the host OpenClaw agent to do things, but has no control over that agent's knowledge or state.** When we update ClawBridge code, the OpenClaw agent doesn't know about the changes. It has stale memory, old instructions, wrong assumptions.

### Feature Request: ClawBridge Service Agent

**The Idea:** When ClawBridge starts, it should register/create a dedicated OpenClaw agent (or session) that:

1. **Is always up-to-date** — ClawBridge controls its SKILL.md / instructions, not the main bot
2. **Handles all A2A operations** — incoming chat, broadcast, bridge calls go through this agent
3. **Has its own workspace** — doesn't pollute the main agent's memory
4. **Can be updated independently** — update ClawBridge code → service agent gets new instructions automatically
5. **Orchestrates bridge calls** — instead of raw HTTP to gateway, the service agent uses OpenClaw tools natively

**Why this is better:**
- No dependency on main bot's memory or state
- Clean separation of concerns
- Service agent can be tested independently
- Updates are atomic — new code = new agent instructions
- The service agent becomes the "ClawBridge brain" on each instance

**How it could work:**
```
ClawBridge starts →
  1. Check if service agent exists in OpenClaw config
  2. If not, create it (register via gateway API or config)
  3. Load latest SKILL.md into service agent's workspace
  4. All incoming A2A requests → routed to service agent session
  5. Service agent uses OpenClaw tools (message, web_search, etc.) natively
  6. No more raw bridge HTTP calls needed
```

**This solves:**
- ❌ Stale memory problem → service agent always has current instructions
- ❌ Bridge authentication issues → service agent authenticates natively
- ❌ Config format confusion → service agent reads its own config
- ❌ "tool execution failed" → service agent calls tools directly, not via HTTP bridge

### Other Improvements Needed

1. **`npm run verify` should test gateway connection** — not just check config files exist, actually try to call the gateway and report if it works

2. **Protect local config from git operations** — `peers.json` should be in a separate directory (like `local/` or `instance/`) that's clearly marked as "never touch"

3. **Bridge should have a test mode** — `npm run test-bridge` that sends a test message through the full pipeline and reports each step (auth → gateway → tool → result)

4. **Config migration** — when bridge.json format changes, auto-migrate old format to new format on startup instead of silently breaking

5. **Startup self-test** — on `npm start`, automatically ping all peers and test bridge, report status

### Summary for gipiti

The architecture works. Networking works. Auth works. Skill routing works. What doesn't work is the last mile — getting from ClawBridge into the actual OpenClaw agent to DO something. The service agent idea is the clean solution. Think about it, give us your perspective, and propose an implementation plan.

— Guali Discord

---

## Task: Service Agent Implementation — PM Directive

**From:** PM (via Guali Discord)
**To:** gipiti
**Date:** 2026-03-10
**Priority:** CRITICAL — Pato's directive

### Context

You've done excellent work fixing the multipart args bug, hardening the bridge, and improving docs. The core issue now is **the last mile** — ClawBridge can route requests and parse params, but can't reliably execute actions through the OpenClaw gateway.

**The problem:** ClawBridge depends on the host OpenClaw agent's knowledge/state, which becomes stale when ClawBridge code updates. The agent has old instructions, wrong assumptions, and outdated memory.

### Pato's Directive: Service Agent Architecture

**Instead of** ClawBridge calling the OpenClaw gateway via raw HTTP bridge...

**Build** a dedicated "service agent" (or session) that ClawBridge controls:

1. **Always up-to-date** — ClawBridge loads its SKILL.md into the service agent on startup
2. **Handles all A2A operations** — Incoming chat/broadcast requests → routed to service agent
3. **Isolated workspace** — Doesn't pollute main bot's memory
4. **Native tool access** — Service agent calls OpenClaw tools natively (message, web_search, etc.)
5. **Updateable independently** — Update ClawBridge code → service agent gets new instructions automatically

### Why This Solves Everything

**Current problems:**
- ❌ Main agent has stale memory after ClawBridge updates
- ❌ Bridge HTTP calls fail with "tool execution failed"
- ❌ No separation between main bot logic and ClawBridge logic
- ❌ Config changes break silently

**Service agent benefits:**
- ✅ Clean separation — main bot doesn't need to know about ClawBridge
- ✅ No stale memory — service agent always has current instructions
- ✅ No "tool execution failed" — direct tool access, not HTTP bridge
- ✅ Testable independently — can verify service agent works without main bot
- ✅ Atomic updates — new code = new instructions automatically

### Flow Comparison

**Current (broken):**
```
Remote peer → ClawBridge A2A server → parse skill "chat" → 
extract params → src/skills/chat.js → bridge.js HTTP call → 
OpenClaw gateway → ??? (fails with "tool execution failed")
```

**Service Agent (proposed):**
```
Remote peer → ClawBridge A2A server → parse skill "chat" → 
extract params → route to service agent session → 
service agent receives task → uses OpenClaw tools natively → 
message/send executes → success
```

### Your Tasks

**Before coding:**

1. **Understand the concept** — Read the service agent proposal above. Do you understand why this solves the stale memory problem? Do you see how it's cleaner than raw HTTP bridge calls?

2. **Propose an implementation plan** — How would you implement this? Consider:
   - How does ClawBridge create/register a service agent on startup?
   - How does it route incoming A2A requests to the service agent?
   - How does the service agent get its instructions (SKILL.md)?
   - How does ClawBridge communicate with the service agent?
   - What's the minimum viable implementation to prove this works?

3. **Identify gaps** — What information do you need about OpenClaw's session/agent architecture to implement this?

4. **Estimate scope** — How big is this change? What files need modification?

**After we agree on the plan, then code.**

### Additional Improvements (Lower Priority)

After the service agent is working, also implement:

1. **`npm run verify` should test gateway connection** — Not just check config files, actually call the gateway and report if it works

2. **Local config in separate `local/` dir** — Protected from git operations, clearly marked as instance-specific

3. **`npm run test-bridge` for full pipeline testing** — Send test message through full pipeline, report each step

4. **Config auto-migration on startup** — When bridge.json format changes, auto-upgrade old config instead of breaking

5. **Startup self-test** — On `npm start`, automatically ping peers + test bridge, report status

### Critical: Get Alignment First

**Do not start coding the service agent yet.**

Post your understanding of the concept, your proposed implementation plan, and any questions/concerns here. We'll review and align before you write code.

This is the path forward. It's Pato's directive and it's the right architectural choice.

— PM
