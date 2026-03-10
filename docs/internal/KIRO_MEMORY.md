# Kiro Memory

**Who:** internal developer memory for the ClawBridge coding agent  
**Boss:** Pato  
**Repo:** https://github.com/paprini/clawbridge  
**Coordination file:** `sharedchat.md` at repo root

## Working Rules

1. Security first.
2. Prefer small, correct changes over speculative rewrites.
3. Verify behavior against code and tests, not only older docs.
4. Keep `sharedchat.md` updated when work finishes.
5. Treat helper-agent support as separate from the live A2A execution path.

## Current Architecture

```text
Request
  -> DDoS protection
  -> express.json (100kb)
  -> /health, /status, /metrics
  -> /.well-known/agent-card(.json)
  -> /a2a
       -> requireAuth
       -> jsonRpcHandler
       -> executor

Executor
  -> validation
  -> rate limiting
  -> permission checks
  -> skill routing
  -> audit logging + metrics
```

Current built-in skills:
- `ping`
- `get_status`
- `chat`
- `broadcast`
- `openclaw_*` when bridge tools are enabled

Important boundary:
- helper agent = installation support and context continuity
- ClawBridge app = live HTTP/A2A execution path

## Important Files

```text
src/server.js                 main Express app and endpoints
src/executor.js               skill routing and responses
src/client.js                 outbound peer calls via POST /a2a
src/bridge.js                 OpenClaw gateway bridge
src/skills/chat.js            message delivery skill
src/skills/broadcast.js       peer fan-out skill
src/helper-agent/manager.js   helper-agent bootstrap and status
src/openclaw-gateway.js       gateway control helper
src/verify.js                 operational verification
config/helper-agent.json      helper-agent bootstrap defaults
sharedchat.md                 PM/developer coordination
memory.md                     local continuity for gipiti
```

## Operational Notes

- `config/peers.json` in the repo is bootstrap-only and should not hold real peer secrets in git.
- Real deployments should prefer external runtime config via `A2A_CONFIG_DIR`.
- Logs redact token-like values and sensitive fields.
- `npm run verify` is required before calling a change done.

## Current Doc Model

Audience split:
- simple users -> `README.md`, `docs/QUICKSTART_SIMPLE.md`
- operators -> `docs/OPERATOR_GUIDE.md`, `docs/PRODUCTION_DEPLOY.md`
- advanced integrators -> `docs/API_REFERENCE.md`, `docs/BRIDGE_SETUP.md`
- contributors -> `docs/GETTING_STARTED.md`
- helper-agent design -> `docs/SERVICE_AGENT_ARCHITECTURE.md`

## Known Reality Checks

- Local tests and docs can be green while live gateway behavior still needs validation.
- The helper agent is support-only. It must not silently become the runtime bridge.
- Archive docs are historical and may describe old endpoints like `/a2a/jsonrpc`.

_Last updated: 2026-03-10_
