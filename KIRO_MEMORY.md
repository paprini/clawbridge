# Kiro — Agent Memory

**Who I am:** Kiro, the external coding agent (Opus, 1M context). I'm the developer/contractor for openclaw-a2a.

**My role:** Build, test, ship. Security-first, minimal code, no over-engineering. I read docs before coding, verify assumptions against actual APIs, and test everything before pushing.

---

## Key Rules

1. **Security first.** No data leaks, no unvalidated input, no logging full tokens. Auth required on all data endpoints. Skill whitelist enforced.
2. **Don't over-engineer.** Write the minimum code that works correctly. No abstractions for future phases.
3. **Use the SDK properly.** The @a2a-js/sdk provides DefaultRequestHandler + AgentExecutor + Express middleware. Don't reinvent protocol handling.
4. **Test before pushing.** Every commit should have passing tests. Manual verification for integration scenarios.
5. **Read docs/APIs before coding.** Check actual SDK exports, not what design docs assume. The CODING_TASKS.md had wrong patterns — I verified against the real SDK.
6. **JavaScript, not TypeScript** for Phase 1. Keep it simple.
7. **Communicate via sharechat.md.** Keep updates short and action-focused per PM's format guide.
8. **Commit messages matter.** Descriptive, explain what and why.

---

## Project Context

- **Repo:** https://github.com/paprini/openclaw-a2a
- **What:** Agent-to-agent communication for OpenClaw using the A2A protocol
- **Phase:** 1 (private agent network — connect your own instances)
- **Stack:** Node.js 18+, Express, @a2a-js/sdk v0.3.10, Jest
- **PM:** Sonnet 4.5 agent (communicates via sharechat.md)
- **Boss:** Pato (human, project owner)

---

## Architecture Decisions Made

- **SDK pattern:** DefaultRequestHandler + custom AgentExecutor (not custom JSON-RPC)
- **Auth:** Bearer token via custom UserBuilder + requireAuth Express middleware
- **Agent Card:** Served at /.well-known/agent-card.json (no auth, it's discovery)
- **JSON-RPC:** Served at /a2a (auth required), handled by SDK's jsonRpcHandler
- **Client:** Native fetch() (no axios dependency), callPeerSkill sends message/send JSON-RPC
- **Config:** JSON files in config/ dir, loaded at call time (not module load time)
- **Skills:** Ping and get_status only for Phase 1 (ultra-conservative security)

---

## File Map

```
src/server.js    — Express app, wires SDK middleware, health endpoint
src/auth.js      — validateToken, createUserBuilder, requireAuth middleware
src/executor.js  — OpenClawExecutor (AgentExecutor impl), ping + get_status
src/client.js    — fetchAgentCard, callPeerSkill (outbound calls)
src/config.js    — loadAgentConfig, loadPeersConfig, loadSkillsConfig

config/          — Default config (agent.json, peers.json, skills.json)
config-beta/     — Second instance config for testing

tests/unit/      — auth, config, executor tests
tests/integration/ — Full HTTP server tests with supertest
```

---

## What's Done

- [x] Core server with SDK middleware (Tasks 1.1-1.4)
- [x] Ping and get_status skills (Task 2.1-2.2)
- [x] A2A client for outbound calls (Task 3.1)
- [x] 28 tests passing (Tasks 4.1-4.3)
- [x] Two-agent communication verified manually

## What's Next

- [ ] Docker support (Dockerfile + docker-compose.yml) — Tasks 5.1-5.2
- [ ] Setup agent (conversational config) — future task
- [ ] Polish + final docs

---

## Gotchas & Traps

1. **SDK is ESM but works with require()** on Node 18+. Don't add "type": "module" to package.json.
2. **SDK message format uses `kind` not `type`:** `kind: 'message'`, `kind: 'text'`, etc.
3. **Agent Card path is `.well-known/agent-card.json`** (with .json). SDK exports `AGENT_CARD_PATH` constant.
4. **Config module caching:** CONFIG_DIR must be read at call time (not module load) or tests break when changing env vars.
5. **Peer tokens must differ from shared token** or validateToken returns wrong identity.
6. **The PM's CODING_TASKS.md patterns are wrong** — they show custom JSON-RPC parsing instead of using the SDK. Always verify against actual SDK API.
7. **axios is in package.json but not needed** — native fetch works fine on Node 18+.

---

## Git Config

```
user.name: Opus Agent
user.email: opus-agent@openclaw-a2a.dev
```

---

_Last updated: 2026-03-09 18:15 UTC_
