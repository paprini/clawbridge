# API Reference — clawbridge

## HTTP Endpoints

### GET /health
Health check. No auth required.

```json
{
  "status": "healthy",
  "uptime": 12345.67,
  "timestamp": "2026-03-09T20:00:00.000Z",
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

### GET /.well-known/agent-card.json
A2A Agent Card (discovery). No auth required. Returns skills, capabilities, auth requirements.

### POST /a2a
A2A JSON-RPC endpoint. Bearer token required.

---

## Skills

### ping
Health check. Returns pong with timestamp.

Request: `"text": "ping"`
Response: `{"status": "pong", "timestamp": "..."}`

### get_status
Agent info: name, version, uptime, available skills.

Request: `"text": "get_status"`
Response: `{"agent": {"id": "...", "name": "..."}, "version": "0.1.0", "uptime": 123, "skills": ["ping", "get_status"]}`

### openclaw_* (bridged tools)
When bridge is enabled, OpenClaw tools are exposed with `openclaw_` prefix. Pass JSON args in the message text.

Example: `"text": "openclaw_web_search {\"query\": \"test\"}"` 

---

## Config Files

### config/agent.json
Agent identity.
```json
{"id": "my-agent", "name": "My Agent", "description": "...", "url": "http://IP:9100/a2a", "version": "0.1.0"}
```

### config/peers.json
Known peers with auth tokens. File permissions: 0600.
```json
{"peers": [{"id": "peer-name", "url": "http://IP:9100", "token": "64-char-hex"}]}
```

### config/skills.json
Exposed skills whitelist.
```json
{"exposed_skills": [{"name": "ping", "description": "...", "tags": [...], "public": true}]}
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
OpenClaw gateway bridge config. Disabled by default.
```json
{"enabled": false, "gateway": {"url": "http://127.0.0.1:18789", "tokenPath": "~/.openclaw/openclaw.json"}, "exposed_tools": ["web_search"], "timeout_ms": 300000, "max_concurrent": 5}
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `A2A_PORT` | Server port | `9100` |
| `A2A_BIND` | Bind address | `0.0.0.0` |
| `A2A_SHARED_TOKEN` | Shared bearer token | (none) |
| `A2A_CONFIG_DIR` | Config directory | `./config` |
| `OPENAI_API_KEY` | LLM API key (setup agent) | (none) |
| `OPENAI_BASE_URL` | LLM API URL (setup agent) | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | LLM model (setup agent) | `gpt-4o-mini` |

---

## Client Library

### callPeerSkill(peerId, skillText)
Call a skill on a remote peer.

### callPeers([{peerId, skill}])
Fan-out: call multiple peers in parallel. Returns array of results.

### chainCalls([{peerId, skill}])
Pipeline: call peers sequentially, passing results forward.

### fetchAgentCard(baseUrl)
Fetch a peer's Agent Card for discovery.
