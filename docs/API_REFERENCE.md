# API Reference — clawbridge

## HTTP Endpoints

### GET /health
Health check. No auth required.

```json
{
  "status": "healthy",
  "version": "<installed-clawbridge-version>",
  "uptime": 12345.67,
  "timestamp": "2026-03-09T20:00:00.000Z",
  "helper_agent": {
    "status": "ready",
    "sessionKey": "clawbridge-helper"
  },
  "calls_total": 100,
  "calls_success": 95,
  "calls_failed": 5,
  "calls_denied": 2,
  "rate_limited": 1,
  "auth_failures": 3,
  "latency_p50_ms": 5,
  "latency_p95_ms": 25,
  "latency_p99_ms": 100
}
```

### GET /metrics
Prometheus-compatible metrics. No auth required.

### GET /status
Public-safe runtime status. No auth required.

```json
{
  "name": "My Agent",
  "version": "<installed-clawbridge-version>",
  "uptime": 12345,
  "skills": ["ping", "get_status"],
  "protocol": "0.3.0",
  "helper_agent": {
    "status": "ready",
    "sessionKey": "clawbridge-helper"
  }
}
```

### GET /.well-known/agent-card.json
A2A Agent Card (discovery). No auth required. Returns skills, capabilities, auth requirements.

### POST /a2a
A2A JSON-RPC endpoint. Bearer token required.

Example request:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "message/send",
  "params": {
    "message": {
      "kind": "message",
      "messageId": "req-1",
      "role": "user",
      "parts": [
        { "kind": "text", "text": "ping" }
      ]
    }
  }
}
```

Example response:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "kind": "message",
    "parts": [
      {
        "kind": "text",
        "text": "{\"status\":\"pong\",\"timestamp\":\"2026-03-09T20:00:00.000Z\"}"
      }
    ]
  }
}
```

---

## Skills

### ping
Health check. Returns pong with timestamp.

Request text part: `"ping"`
Response text part: `{"status": "pong", "timestamp": "..."}`

### get_status
Agent info: name, version, uptime, available skills.

Request text part: `"get_status"`
Response text part: `{"agent": {"id": "...", "name": "..."}, "version": "<installed-clawbridge-version>", "uptime": 123, "skills": ["ping", "get_status"]}`

### openclaw_* (bridged tools)
When bridge is enabled, OpenClaw tools are exposed with `openclaw_` prefix. Pass JSON args in the message text.

Example: `"text": "openclaw_web_search {\"query\": \"test\"}"` 

---

## Config Files

### config/agent.json
Agent identity.
```json
{"id": "my-agent", "name": "My Agent", "description": "...", "url": "http://IP:9100/a2a", "version": "<installed-clawbridge-version>", "default_delivery": {"type": "channel", "target": "#general", "channel": "discord"}}
```

`version` is written from the installed ClawBridge package version during setup and reported at runtime from `package.json`.

`default_delivery` is used when this instance receives:
- `chat` without an explicit `target`
- `chat` addressed as `@my-agent`
- `broadcast` fan-out that lands on this instance

### config/peers.json
Known peers with auth tokens. File permissions: 0600.
```json
{"peers": [{"id": "peer-name", "url": "http://IP:9100", "token": "64-char-hex"}]}
```

### config/skills.json
Exposed skills whitelist.
```json
{"exposed_skills": [{"name": "ping", "description": "...", "tags": ["health"], "public": true}, {"name": "get_status", "description": "...", "tags": ["status"], "public": true}, {"name": "chat", "description": "...", "tags": ["messaging"], "public": true}, {"name": "broadcast", "description": "...", "tags": ["messaging"], "public": true}]}
```

### config/permissions.json (optional)
Per-peer skill access control. If absent, all authenticated peers can call all skills.
```json
{"default": "deny", "permissions": {"laptop": ["ping", "get_status"], "admin": ["*"]}}
```

### config/rate-limits.json (optional)
Rate limiting config. If absent, sensible defaults apply (200/min global, 60/min per-peer).
```json
{"global": {"requests_per_minute": 200, "burst": 50}, "per_peer": {"requests_per_minute": 60, "burst": 15}, "per_skill": {"expensive_tool": {"requests_per_minute": 5, "burst": 2}}}
```

### config/bridge.json (optional)
OpenClaw gateway bridge config. Enabled by default in the tracked repo config and by `npm run setup`.
```json
{"enabled": true, "gateway": {"url": "http://127.0.0.1:18789", "tokenPath": "~/.openclaw/openclaw.json", "sessionKey": "main"}, "agent_dispatch": {"enabled": true, "sessionKey": "auto", "timeoutSeconds": 30}, "exposed_tools": ["message", "web_search"], "timeout_ms": 300000, "max_concurrent": 5}
```

`agent_dispatch` is used for inbound `@agent-name` delivery. ClawBridge now treats that path as a session-first agent turn: it resolves the target OpenClaw session, runs the local `openclaw agent` turn without local provider delivery, and returns the resulting reply text as structured output.

- `sessionKey: "auto"` means ClawBridge derives the correct agent-scoped OpenClaw target session.
- `timeoutSeconds` is the maximum time ClawBridge will wait for the local OpenClaw agent to complete the activated turn.
- Before the turn runs, ClawBridge inspects `sessions_list` and, when OpenClaw already has a unique session row whose delivery context matches the real target, reuses that row's `sessionId`.
- For `@agent-name` and `#channel@agent-name`, the remote peer returns structured session output such as `conversation_id`, `response_text`, and the OpenClaw session metadata instead of trying to mix visible provider delivery with a cross-peer reply relay.
- ClawBridge peer ID and OpenClaw agent ID are different concepts. If you need to pin the receiving OpenClaw agent explicitly, set `config/agent.json -> openclaw_agent_id` or `config/bridge.json -> agent_dispatch.agentId`.
- On multi-agent OpenClaw installs, pin one local communications agent explicitly. ClawBridge should not guess that from channel bindings.

### config/agent.json
Primary local identity and delivery config.
```json
{"id": "guali-discord", "name": "Guali Discord", "openclaw_agent_id": "main", "default_delivery": {"type": "channel", "target": "1480310282961289216", "channel": "discord"}}
```

- `id` is the ClawBridge peer ID used by other ClawBridge instances.
- `openclaw_agent_id` is the local OpenClaw agent ClawBridge activates for inbound `@agent` delivery.
- Setup now asks for this value from the detected local OpenClaw agent list.
- If it is omitted on a multi-agent install, `npm run verify` fails because agent identity cannot be guaranteed safely.
- `id` must not collide with any configured peer id in `config/peers.json`; `npm run verify` now fails that configuration because `@agent-name` routing becomes ambiguous.
- `default_delivery.type` matters on provider-specific final sends. For Discord:
  - `owner` means ClawBridge emits `user:<id>`
  - `channel` means ClawBridge emits `channel:<id>`
  - `npm run verify` now rejects ambiguous Discord defaults

### config/contacts.json (optional)
Alias map for human-friendly names and local channel names used by `chat`. Channel-specific aliases can be declared as `channel:name`. Entries may be simple target strings or relay objects with `peerId`.
```json
{"aliases": {"Pato": "552287292342009884", "#general": "1480310282961289216", "telegram:Pato": {"peerId": "telegram-agent", "target": "5914004682", "channel": "telegram"}}}
```

### config/helper-agent.json (optional)
Helper-agent bootstrap config. Used only for the local support helper, not for request routing.
```json
{"enabled": true, "agentId": "clawbridge-helper", "sessionKey": "clawbridge-helper", "workspaceDir": "~/.clawbridge/helper-agent", "healInBackground": true, "visibleTo": ["main"], "alertSession": "main", "bootstrapViaGateway": true, "retryIntervalMs": 60000, "gateway": {"url": "http://127.0.0.1:18789", "tokenPath": "~/.openclaw/openclaw.json"}}
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `A2A_PORT` | Server port | `9100` |
| `A2A_BIND` | Bind address | `0.0.0.0` |
| `A2A_SHARED_TOKEN` | Shared bearer token | (none) |
| `A2A_CONFIG_DIR` | Config directory | `./config` |
| `ALLOW_REPO_MANAGED_PEERS` | Allow real peers in tracked `config/peers.json` | (unset) |
| `A2A_PEER_TIMEOUT_SHORT_MS` | Timeout for lightweight peer calls such as `ping` and `get_status` | `5000` |
| `A2A_PEER_TIMEOUT_DEFAULT_MS` | Timeout for other peer skill calls | `10000` |
| `A2A_PEER_TIMEOUT_CHAT_MS` | Timeout for conversational/relay-backed peer calls such as `chat` and `broadcast` | `60000` |
| `OPENCLAW_BIN` | Override path to the OpenClaw CLI used for inbound `@agent` activation when PATH, `npm prefix -g`, `~/.openclaw/bin/openclaw`, and `~/.local/bin/openclaw` are not enough | auto-discover |
| `OPENAI_API_KEY` | LLM API key (setup agent) | (none) |
| `OPENAI_BASE_URL` | LLM API URL (setup agent) | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | LLM model (setup agent) | `gpt-4o-mini` |

---

## Client Library

### callPeerSkill(peerId, skillText, params?, opts?)
Call a skill on a remote peer.

For `chat`, the supported target forms are:
- `@agent-name`
- `#channel@agent-name`
- `#channel`
- direct local platform IDs
- aliases from `config/contacts.json`

Timeout policy:
- `ping`, `get_status` → short timeout (`A2A_PEER_TIMEOUT_SHORT_MS`, default `5000`)
- `chat`, `broadcast` → long timeout (`A2A_PEER_TIMEOUT_CHAT_MS`, default `60000`)
- everything else → default timeout (`A2A_PEER_TIMEOUT_DEFAULT_MS`, default `10000`)
- pass `opts.timeoutMs` to override per call

When a relay-backed `chat` or `broadcast` times out locally, the thrown error says the remote side may still have completed successfully.

### callPeers([{peerId, skill, params, timeoutMs}])
Fan-out using explicit call objects.

### callPeers(peerIds, skill, params?, opts?)
Fan-out to a peer list using a shared skill and params. Returns array of results.

`opts.timeoutMs` applies a shared override to all peers in that call.

### chainCalls([{peerId, skill, params, timeoutMs}])
Pipeline: call peers sequentially, passing results forward.

### fetchAgentCard(baseUrl)
Fetch a peer's Agent Card for discovery.
