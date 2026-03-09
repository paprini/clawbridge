# Kiro — Agent Memory

**Who:** Kiro, external coding agent (Opus, 1M context). Developer/contractor for openclaw-a2a.
**Boss:** Pato (human, project owner)
**PM:** Sonnet 4.5 agent (communicates via sharechat.md at repo root)
**Repo:** https://github.com/paprini/openclaw-a2a

---

## Rules

1. Security first. No data leaks, no unvalidated input, no full tokens in logs.
2. Don't over-engineer. Minimum code that works correctly.
3. Use the SDK properly. DefaultRequestHandler + AgentExecutor + Express middleware.
4. Test before pushing. Every commit has passing tests.
5. Read actual APIs before coding. Design docs go stale — verify against real exports.
6. JavaScript, not TypeScript.
7. Communicate via sharechat.md. Keep updates short.
8. No assumptions. Test on real containers, real networks.

---

## Architecture

```
Request → DDoS protection → express.json (100kb limit)
  → /health, /status, /metrics (no auth)
  → /.well-known/agent-card.json (no auth, discovery)
  → /a2a (requireAuth → jsonRpcHandler → executor)

Executor pipeline:
  Input validation → Rate limiting → Permission check → Skill execution → Audit log + Metrics

Skills: ping, get_status, openclaw_* (bridged tools)
Bridge: HTTP POST to OpenClaw gateway /tools/invoke
```

---

## File Map (19 source files)

```
src/server.js        — Express app, wires all middleware, endpoints
src/auth.js          — Bearer token auth (basic + advanced), rate limit on failures
src/executor.js      — AgentExecutor: validation → rate limit → permissions → skill → audit
src/client.js        — Outbound: fetchAgentCard, callPeerSkill, callPeers, chainCalls
src/config.js        — Config loader with cache + SIGHUP reload
src/bridge.js        — OpenClaw gateway bridge (HTTP /tools/invoke)
src/permissions.js   — Per-peer, per-skill access control
src/rate-limiter.js  — Token bucket (global, per-peer, per-skill)
src/metrics.js       — Call counters, latency percentiles, Prometheus export
src/ddos-protection.js — Per-IP connection limits, blocklist, slowloris protection
src/token-manager.js — Token expiry, scopes (read/write/execute/admin), revocation
src/validation.js    — Input sanitization (strings, URLs, paths, messages)
src/logger.js        — Structured JSON (production) / human-readable (dev)
src/registry.js      — Public agent registry client (fetch/search)
src/cli.js           — CLI: status, peers, ping, call, card, search
src/verify.js        — Pre-flight config verification (npm run verify)
src/setup/agent.js   — Conversational setup agent (OpenAI-compatible LLM)
src/setup/cli.js     — Setup entry point with model selection + fallback
src/setup/tools.js   — 8 tools: scan, check, generate, write, test, rotate, etc.
```

---

## Tests (14 suites, 116 tests)

```
tests/unit/auth.test.js          — 11 tests (token validation, UserBuilder)
tests/unit/config.test.js        — 4 tests (loading, missing file)
tests/unit/executor.test.js      — 5 tests (ping, status, unknown, empty, cancel)
tests/unit/bridge.test.js        — 7 tests (config, tools, whitelist, disabled)
tests/unit/permissions.test.js   — 6 tests (allow, deny, wildcard, default policy)
tests/unit/rate-limiter.test.js  — 4 tests (burst, per-peer, per-skill)
tests/unit/metrics.test.js       — 5 tests (counters, percentiles, Prometheus)
tests/unit/ddos.test.js          — 5 tests (block, unblock, allowlist, timeout)
tests/unit/token-manager.test.js — 8 tests (expiry, revocation, scopes, generation)
tests/unit/validation.test.js    — 10 tests (strings, URLs, paths, messages, sanitize)
tests/unit/security.test.js      — 9 tests (auth bypass, oversized body, injection)
tests/unit/setup-tools.test.js   — 13 tests (token gen, config write, rotation)
tests/integration/server.test.js — 8 tests (health, agent card, JSON-RPC, auth)
tests/integration/pipeline.test.js — 7+ tests (permissions, rate limit, DDoS, validation in full HTTP)
```

---

## Config Files

```
config/agent.json       — Agent identity (required)
config/peers.json       — Known peers with tokens (required, 0600 perms)
config/skills.json      — Exposed skills whitelist (required)
config/bridge.json      — OpenClaw bridge (optional, disabled by default)
config/permissions.json — Access control (optional, default: allow all)
config/rate-limits.json — Rate limits (optional, sensible defaults)
config/tokens.json      — Advanced tokens with expiry/scopes (optional)
```

---

## Deploy Files

```
deploy/docker-compose.production.yml — Caddy + A2A (auto HTTPS)
deploy/Caddyfile                     — TLS termination config
deploy/openclaw-a2a.service          — systemd unit (security hardened)
deploy/install.sh                    — One-command bare metal install
Dockerfile                           — node:18-alpine, non-root, healthcheck
docker-compose.yml                   — Dev: two agents on bridge network
docker/alpha/, docker/beta/          — Per-agent Docker configs
```

---

## Key Lessons

1. Verify SDK exports before coding — design docs go stale
2. Alpine Linux: use 127.0.0.1, not localhost in healthchecks
3. Config module: read env vars at call time, not module load time (tests break)
4. Peer tokens and shared tokens must be distinct values
5. Auth on Agent Card: NO (discovery is public, execution is private)
6. Don't ship untested Docker files — test on real containers
7. Every module must be wired into the pipeline — audit for dead code
8. Tests need isolated config dirs when real config has restrictive permissions

---

## Git Config

```
user.name: Opus Agent
user.email: opus-agent@openclaw-a2a.dev
```

---

_Last updated: 2026-03-09 23:20 UTC_
