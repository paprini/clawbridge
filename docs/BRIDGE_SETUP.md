# OpenClaw Bridge Setup

Connect your A2A agent to the local OpenClaw gateway so peers can call OpenClaw tools remotely.

## Prerequisites

- OpenClaw installed and gateway running (`openclaw gateway start`)
- A2A server running (`node src/server.js`)

## 1. Enable the bridge

Edit `config/bridge.json`:

```json
{
  "enabled": true,
  "gateway": {
    "url": "http://127.0.0.1:18789",
    "tokenPath": "~/.openclaw/openclaw.json",
    "sessionKey": "main"
  },
  "exposed_tools": [
    "web_search",
    "web_fetch",
    "memory_search",
    "session_status"
  ],
  "timeout_ms": 300000,
  "max_concurrent": 5
}
```

## 2. Choose which tools to expose

Only tools in `exposed_tools` are callable via A2A. Safe defaults:

| Tool | Risk | Description |
|------|------|-------------|
| `web_search` | Low | Search the web (read-only) |
| `web_fetch` | Low | Fetch URL content (read-only) |
| `memory_search` | Low | Search agent memory (read-only) |
| `session_status` | Low | Get session info (read-only) |
| `Read` | Medium | Read files (validate paths) |
| `image` | Medium | Analyze images |
| `pdf` | Medium | Analyze PDFs |
| `exec` | **HIGH** | Run shell commands — do NOT expose unless you trust all peers |
| `Write` | **HIGH** | Write files — do NOT expose unless you trust all peers |

## 3. Restart the A2A server

```bash
node src/server.js
```

Bridged tools appear in the Agent Card with `openclaw_` prefix (e.g. `openclaw_web_search`).

## 4. Test from a peer

```bash
curl -X POST http://YOUR_IP:9100/a2a \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "params": {
      "message": {
        "kind": "message",
        "messageId": "test",
        "role": "user",
        "parts": [{"kind": "text", "text": "openclaw_web_search {\"query\": \"OpenClaw docs\"}"}]
      }
    },
    "id": 1
  }'
```

## Troubleshooting

- **"Bridge not configured"** — Set `enabled: true` in config/bridge.json
- **"Tool not in whitelist"** — Add the tool name to `exposed_tools`
- **"Gateway not running"** — Run `openclaw gateway start`
- **"Gateway auth failed"** — Check token in `~/.openclaw/openclaw.json`
- **"Tool not found on gateway"** — The tool may be in the gateway's HTTP deny list. Edit `~/.openclaw/openclaw.json` to add it to `gateway.tools.allow`
