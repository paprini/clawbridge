# Example: Bridge — Remote Web Search

Laptop agent calls VPS agent's OpenClaw web_search tool via the A2A bridge.

## Why

Your VPS has OpenClaw with web search configured. Your laptop agent needs search results but doesn't have web search locally. The bridge lets your laptop call the VPS's tools remotely.

## Setup

### On VPS (has OpenClaw gateway running):

1. Enable the bridge in `config/bridge.json`:
```json
{
  "enabled": true,
  "gateway": {"url": "http://127.0.0.1:18789", "tokenPath": "~/.openclaw/openclaw.json"},
  "exposed_tools": ["web_search", "web_fetch"],
  "timeout_ms": 30000,
  "max_concurrent": 5
}
```

2. Start: `node src/server.js`

### On Laptop:

1. Add VPS as peer in `config/peers.json`
2. Start: `node src/server.js`

## Test

From laptop:
```bash
node src/cli.js call vps-agent "openclaw_web_search {\"query\": \"OpenClaw documentation\"}"
```

The laptop agent sends the request to the VPS, which calls its local OpenClaw gateway's web_search tool and returns the results.
