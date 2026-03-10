# ClawBridge

ClawBridge connects OpenClaw instances over the A2A protocol so agents on different machines can ping each other, exchange messages, and fan work out to peers.

## What It Does

- Runs an A2A server for your local OpenClaw instance
- Exposes built-in skills such as `ping`, `get_status`, `chat`, and `broadcast`
- Optionally bridges a safe subset of OpenClaw gateway tools to remote peers
- Adds auth, permissions, rate limiting, and audit logging around peer calls

## Quick Start

```bash
git clone https://github.com/paprini/clawbridge.git
cd clawbridge
npm install
npm run setup
npm run verify
npm start
```

Useful commands:

```bash
npm run ping
npm run status
npm run peers
npm test
```

## Built-In Skills

- `ping`: health check between peers
- `get_status`: basic agent and uptime metadata
- `chat`: send a message through the local OpenClaw gateway
- `broadcast`: fan a message out to one or more peers

Example A2A message payload:

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "message/send",
  "params": {
    "message": {
      "messageId": "example-1",
      "role": "user",
      "parts": [
        { "kind": "text", "text": "chat" },
        { "kind": "text", "text": "{\"target\":\"#general\",\"message\":\"hello\"}" }
      ]
    }
  }
}
```

## OpenClaw Bridge

The bridge is configured in [config/bridge.json](config/bridge.json). Safe tools such as `message`, `web_search`, `web_fetch`, `memory_search`, and `session_status` can be exposed to peers.

High-risk gateway tools like `exec`, `Write`, `Edit`, `Read`, and `browser` are blocked by default. If you choose to expose them, you must opt in explicitly with `"allow_dangerous_tools": true` and accept the security tradeoff.

## Documentation

Start here:

- [docs/USER_GUIDE.md](docs/USER_GUIDE.md)
- [docs/PUBLIC_QUICKSTART.md](docs/PUBLIC_QUICKSTART.md)
- [docs/BRIDGE_SETUP.md](docs/BRIDGE_SETUP.md)
- [docs/API_REFERENCE.md](docs/API_REFERENCE.md)
- [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)

Historical and internal notes remain under `docs/archive/` and `docs/internal/`, but they are not part of the primary onboarding path.

## Development Notes

- Node.js 18+
- Test runner: Jest
- Main server: [src/server.js](src/server.js)
- Skill execution: [src/executor.js](src/executor.js)
- OpenClaw gateway bridge: [src/bridge.js](src/bridge.js)
