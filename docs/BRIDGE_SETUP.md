# Bridge Setup

**Audience:** advanced users and operators  
**Do not start here first:** get a normal peer connection working before enabling bridge tools

ClawBridge can expose a limited subset of local OpenClaw gateway tools to trusted peers.

## Before You Enable It

You should already have:
- `ping` working between peers
- a clear permission model
- a reason to expose a bridge tool at all

## What The Bridge Does

It maps approved local OpenClaw tools into A2A-visible skills like:
- `openclaw_web_search`
- `openclaw_web_fetch`
- `openclaw_memory_search`

## Safe Starting Point

Example `config/bridge.json`:

```json
{
  "enabled": true,
  "gateway": {
    "url": "http://127.0.0.1:18789",
    "tokenPath": "~/.openclaw/openclaw.json",
    "sessionKey": "main"
  },
  "agent_dispatch": {
    "enabled": true,
    "sessionKey": "auto",
    "timeoutSeconds": 30
  },
  "exposed_tools": [
    "message",
    "web_search",
    "web_fetch",
    "memory_search",
    "session_status"
  ],
  "timeout_ms": 300000,
  "max_concurrent": 5
}
```

## Risk Model

Start with low-risk tools:

| Tool | Recommended default | Notes |
|------|---------------------|-------|
| `message` | Yes | required for `chat` delivery |
| `web_search` | Yes | read-oriented |
| `web_fetch` | Yes | read-oriented |
| `memory_search` | Yes | read-oriented |
| `session_status` | Yes | inspection only |
| `image` | Maybe | depends on data sensitivity |
| `pdf` | Maybe | depends on document sensitivity |
| `Read` | Usually no | only after path review |
| `exec` | No | dangerous |
| `Write` | No | dangerous |
| `Edit` | No | dangerous |
| `browser` | No | dangerous |

High-risk tools are blocked by default unless you explicitly opt in.

For inbound `@agent-name` delivery, ClawBridge now activates the receiving OpenClaw agent through the native `openclaw agent` path after posting the visible inbound message. It no longer depends on `sessions_send` being allowed on the local gateway.

ClawBridge peer IDs are not OpenClaw agent IDs. If the receiving OpenClaw instance has multiple local agents and you want to pin which one wakes up for inbound `@agent` delivery, set either:

- `config/agent.json -> openclaw_agent_id`
- `config/bridge.json -> agent_dispatch.agentId`
- On multi-agent OpenClaw installs, one of those should be set explicitly so ClawBridge keeps one local answering agent instead of inferring it from the delivery channel binding.

If neither is set:
- single-agent installs fall back to the OpenClaw default agent
- multi-agent installs should be considered misconfigured until one local communications agent is pinned explicitly

When OpenClaw already has a matching session row for the target destination, ClawBridge reuses that row's `sessionId` and delivery metadata so the activated agent replies into the correct local chat destination explicitly.

## Restart And Validate

After changing bridge config:

```bash
npm run verify
npm start
```

Then confirm the bridge-backed skills appear in the agent card.

## Test From A Peer

Example:

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "message/send",
  "params": {
    "message": {
      "messageId": "bridge-test",
      "role": "user",
      "parts": [
        { "kind": "text", "text": "openclaw_web_search" },
        { "kind": "text", "text": "{\"query\":\"OpenClaw docs\"}" }
      ]
    }
  }
}
```

## Related Docs

- [OPERATOR_GUIDE.md](OPERATOR_GUIDE.md)
- [PRODUCTION_DEPLOY.md](PRODUCTION_DEPLOY.md)
- [API_REFERENCE.md](API_REFERENCE.md)
