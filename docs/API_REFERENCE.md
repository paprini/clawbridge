# API Reference — clawbridge

## HTTP Endpoints

### GET /health
Health check. No auth required.

```json
{
  "status": "healthy",
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
  "version": "0.1.0",
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
Response text part: `{"agent": {"id": "...", "name": "..."}, "version": "0.1.0", "uptime": 123, "skills": ["ping", "get_status"]}`

### openclaw_* (bridged tools)
When bridge is enabled, OpenClaw tools are exposed with `openclaw_` prefix. Pass JSON args in the message text.

Example: `"text": "openclaw_web_search {\"query\": \"test\"}"` 

---

## Config Files

### config/agent.json
Agent identity.
```json
{"id": "my-agent", "name": "My Agent", "description": "...", "url": "http://IP:9100/a2a", "version": "0.1.0", "default_delivery": {"type": "channel", "target": "#general", "channel": "discord"}}
```

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
{"enabled": true, "gateway": {"url": "http://127.0.0.1:18789", "tokenPath": "~/.openclaw/openclaw.json", "sessionKey": "main"}, "agent_dispatch": {"enabled": true, "sessionKey": "auto", "requesterSessionKey": "auto", "timeoutSeconds": 0}, "exposed_tools": ["message", "web_search"], "timeout_ms": 300000, "max_concurrent": 5}
```

`agent_dispatch` is used for inbound `@agent-name` delivery. It dispatches the received message into the local OpenClaw session via `sessions_send` after the visible message is posted.

- `sessionKey: "auto"` means ClawBridge derives the correct agent-scoped OpenClaw target session.
- `requesterSessionKey: "auto"` means it invokes `sessions_send` from that same target session by default, which avoids OpenClaw visibility blockers under the default `tools.sessions.visibility=tree`.
- For inbound agent delivery, ClawBridge now also posts the visible `message` from that same target session so OpenClaw keeps delivery context aligned with the activated session.
- If OpenClaw reports a risky target session state, such as `sendPolicy: "deny"` or a direct session with no delivery target metadata, ClawBridge switches to a manual reply fallback: it waits for the hidden agent reply and posts that reply itself through the known target.
- ClawBridge peer ID and OpenClaw agent ID are different concepts. If you need to pin the receiving OpenClaw agent explicitly, set `config/agent.json -> openclaw_agent_id` or `config/bridge.json -> agent_dispatch.agentId`.

### config/agent.json
Primary local identity and delivery config.
```json
{"id": "guali-discord", "name": "Guali Discord", "openclaw_agent_id": "main", "default_delivery": {"type": "channel", "target": "1480310282961289216", "channel": "discord"}}
```

- `id` is the ClawBridge peer ID used by other ClawBridge instances.
- `openclaw_agent_id` is optional and refers to the local OpenClaw agent to activate for inbound `@agent` delivery.
- If `openclaw_agent_id` is omitted, ClawBridge auto-resolves from OpenClaw bindings or the default OpenClaw agent.

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
| `OPENAI_API_KEY` | LLM API key (setup agent) | (none) |
| `OPENAI_BASE_URL` | LLM API URL (setup agent) | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | LLM model (setup agent) | `gpt-4o-mini` |

---

## Client Library

### callPeerSkill(peerId, skillText, params?)
Call a skill on a remote peer.

For `chat`, the supported target forms are:
- `@agent-name`
- `#channel@agent-name`
- `#channel`
- direct local platform IDs
- aliases from `config/contacts.json`

### callPeers([{peerId, skill, params}])
Fan-out using explicit call objects.

### callPeers(peerIds, skill, params?)
Fan-out to a peer list using a shared skill and params. Returns array of results.

### chainCalls([{peerId, skill}])
Pipeline: call peers sequentially, passing results forward.

### fetchAgentCard(baseUrl)
Fetch a peer's Agent Card for discovery.
