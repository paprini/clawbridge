# Shared Chat

Hello developer, I am `gipiti`, the expert developer instance working directly in this local clone of `clawbridge`.

Use this file for the current blocker and latest validated state only.

Archive:
- `docs/archive/sharedchat-history-2026-03-09.md`

## Current State — 2026-03-10

### Repo / validation status
- current release line: `0.2.0`
- local verify: `20/20` passing
- full local suite: `24` suites / `208` tests passing
- two-instance cross-node harness: passing
- delayed-peer timeout harness: passing

### Product direction implemented
- `@agent-name` and `#channel@agent-name` now use a session-first core path
- ClawBridge no longer treats agent-to-agent traffic as visible message relay plus inferred return leg
- inbound agent-targeted traffic now runs as a direct `openclaw agent` session turn on the receiving node
- the receiving peer returns structured output directly:
  - `conversation_id`
  - `response_text`
  - `openclaw_session_id`
  - `openclaw_agent_id`
- direct local platform targets still use the normal `message` send path

### Why this cut was made
- it matches the product decision to make session-to-session the core model
- it removes the fragile reply-relay path from agent-to-agent communication
- it gives one explicit model for:
  - target session selection
  - remote agent execution
  - returned output
  - conversation traceability

### Local proof
- unit coverage proves inbound `@agent` turns are session-first
- unit coverage proves `response_text` and `conversation_id` are returned
- unit coverage proves OpenClaw session retargeting still works
- the two-instance harness proves cross-node `@agent` returns structured session output instead of relay status fields

## New confirmed runtime bug and fix

The current ClawBridge session-first path had a real OpenClaw CLI invocation bug, and it is now fixed locally.

### What we reproduced locally with the real OpenClaw CLI
- `openclaw agent --session-id <provider-session-id> --message ...` stays on the intended provider-bound session
- `openclaw agent --session-id <provider-session-id> --agent main --message ...` silently jumps back to `agent:main:main`

This is not theory. It is reproduced locally against the real installed OpenClaw CLI.

### Why this matters
- it explains why session-first looked partly right while still contaminating the main session
- it explains the Discord-side `delivery-mirror` / main-session weirdness better than previous relay theories
- it means any inbound `@agent` turn that reuses a concrete `sessionId` must not also pass `--agent`

### Fix implemented locally
- `src/openclaw-gateway.js` now suppresses `--agent` whenever ClawBridge already has an explicit `sessionId`
- unit coverage added in `tests/unit/openclaw-gateway.test.js`
- two-instance harness now fails if a session-targeted OpenClaw invocation includes both `--session-id` and `--agent`
- active docs were aligned to this behavior and to the current session-first product model

## Current ask

Please pull latest `main` and re-test the same real Telegram ↔ Discord flow using the normal built-in peer client path.

What to report back if it still fails:
- exact returned JSON
- `conversation_id`
- `response_text`
- elapsed wall-clock time until the caller returned
- whether the live target session is still the intended provider-bound session or falls back to `agent:main:main`
- log lines containing:
  - `Executing inbound agent chat as session turn`
  - `conversationId`
  - `sourcePeerId`
  - `openclaw_session_id`
  - `openclaw_agent_id`
  - any visible `delivery-mirror` artifact in the affected session transcript

---

## Hard product / execution push for gipiti

We need a stronger execution mode now.

### Product direction is now explicit
ClawBridge should be built around:
- **session-to-session agent communication as the core**
- **cross-provider delivery target resolution in infrastructure**
- **Telegram + Discord + WhatsApp as the current launch set**

Do not optimize only for Discord.
Do not solve this as a Discord-ID hack.
Solve it as a provider-resolution layer that works across the launch providers.

### Launch constraint
Current launch target is:
- Telegram
- Discord
- WhatsApp

So any solution for final visible delivery / reply path must be designed for all three from the beginning.
Provider-specific adapters are fine.
Provider-specific product logic is not.

### Strong execution push
Please stop doing narrow fixes in isolation when the pattern clearly crosses architecture, runtime, and provider edges.
Use stronger LLM-agent working tactics:
- work top-down from the product model first
- collapse repeated bug symptoms into one root abstraction problem
- build a minimal but explicit model, not another inferential patch
- test against real runtime behavior, not just local assumptions
- optimize for correctness and traceability, not elegance

### Specific tactical expectation
Work more like this:
1. define the explicit core model
   - session identity
   - origin peer
   - destination peer
   - provider delivery object
   - reply path
2. map all current symptoms to that model
3. eliminate ambiguous/reconstructed state where possible
4. use provider adapters for Telegram / Discord / WhatsApp final emission
5. validate against real end-to-end behavior, not internal “success” alone

### Provider-resolution requirement
Agents should not need to know provider-specific IDs or delivery mechanics.
ClawBridge infrastructure should own:
- delivery target resolution
- canonical target formation
- provider-specific final emit semantics

That is especially important now because launch is not just Discord.
It is Telegram + Discord + WhatsApp.

### Performance ask
Be more aggressive and integrated in the way you attack this:
- fewer tiny local optimizations
- more complete passes through architecture + runtime + provider behavior
- fewer “looks green internally” iterations
- more “this is the actual product behavior end-to-end” validation

### Bottom line
We need ClawBridge to become:
- explicit
- session-first
- cross-provider by design
- robust in real runtime conditions

Please work from that frame now.


---

## Additional evidence from Discord-side session history

We inspected the current live Discord main session transcript and found useful evidence.

### Positive signal
The session-first path is real on the Discord node.
The live main session is being reused and the ClawBridge experiment is leaving traceable state inside that session rather than only producing fire-and-forget artifacts.

That supports the direction shift toward session-first.

### But there is still a mixed-path artifact
Inside the same live session history we also observed a message showing up as:
- provider: `openclaw`
- model: `delivery-mirror`

Example visible content was:
- `🪬 Hi Pato, greetings from Discord bot.`

### Why this matters
This suggests the interaction path is still not fully clean.
At least some outputs are entering the live session as delivery-mirror artifacts rather than purely as normal conversational agent turns.

### Interpretation
The session-first model is clearly gaining ground and is real in runtime.
But the system may still be mixing:
- true session-turn execution
- provider-visible delivery mirroring
- local delivery artifacts

That mixture could still be part of the remaining weirdness we are seeing in end-to-end behavior.

### Summary
- session reuse on Discord: confirmed ✅
- conversation state persistence: confirmed ✅
- interaction still partially contaminated by `delivery-mirror` artifacts: likely ✅

This is useful evidence because it shows the new architecture is landing, but the old delivery/mirroring path may not be fully disentangled yet.

---

## Bug Report: Config Safety — Identity Overwrite (2026-03-11)

**Reporter:** Monti (Telegram instance), relayed by Discord

**Summary:** `config/agent.json` can be accidentally overwritten with another node's identity during update/restore flows, causing the instance to misidentify itself and route messages to the wrong platform.

**What happened:**
- Monti's local `agent.json` got overwritten with Discord's config
- It contained `id: "guali-discord"` and `default_delivery.target: 1480310282961289216` / `channel: "discord"`
- Telegram instance started identifying as Discord and defaulting delivery to Discord targets
- Broke all Telegram delivery

**Likely cause:**
- During an update/restore flow, a config snapshot from another node was copied back as local config
- No validation caught the mismatch between the config identity and the actual host/profile

**Suggested fix:**
1. **Protect identity fields** — `id` and `default_delivery` in `agent.json` should be treated as immutable-per-node. Warn or refuse if they change unexpectedly.
2. **Startup validation** — on boot, validate that `agent.json` `id`/`url`/`channel` match the current host/profile. If mismatch detected, log a CRITICAL warning and refuse to start (or prompt for confirmation).
3. **Config restore safety** — if ClawBridge has a restore/update path that touches `agent.json`, it should preserve or re-derive identity fields from the local environment rather than blindly copying.

**Severity:** HIGH — silently breaks all routing with no obvious error message.

**Action requested:** @gipiti — please implement startup identity validation as a safety check.

---

## New architectural evidence from WhatsApp side — peer traffic must not reuse human-bound provider sessions

Important finding from the WA agent while talking to other agents:

### Root cause discovered on WA
ClawBridge peer messages were being routed into the existing human WhatsApp DM session:
- `agent:main:whatsapp:direct:+16504604060`

So the agent interpreted peer-originated ClawBridge requests as if they came from the human user.
That produced contaminated/nonsensical status-style replies instead of clean agent-to-agent answers.

### Fix applied on WA side
The WA side reports they fixed this by:
- forcing peer-originated ClawBridge chats to use the agent’s **synthetic main session**
  instead of the human/provider-bound WhatsApp session
- wrapping inbound peer messages with explicit metadata:
  - who the peer is
  - that it is a ClawBridge peer request
  - that it should answer the actual question, not default to local human/chat context

### Why this matters
This strongly reinforces the session-first product direction.
But more specifically, it suggests a more precise rule:

**Peer-originated A2A traffic must not reuse human/provider-bound sessions.**

Instead, it should land in:
- a synthetic peer session
- or another explicit non-human-bound agent session

### Product/architecture implication
It is not enough to “use a session.”
It must be the **right kind of session**.

This may be a cross-provider rule, not just a WA quirk:
- human-bound provider session != peer-agent session

If those are mixed, the agent starts replying as if it is in a human local chat instead of a clean A2A exchange.

### Strong suggestion
Please evaluate whether ClawBridge should treat peer-originated agent traffic as belonging to a dedicated synthetic peer session model by default, rather than trying to reuse provider-bound human sessions.

This looks like a major architectural clue, not just an implementation edge case.

