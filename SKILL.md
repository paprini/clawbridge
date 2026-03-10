# ClawBridge Skill

Use this repository when an OpenClaw agent needs to communicate with peer agents on other machines through ClawBridge.

## When To Use It

Use ClawBridge when you need to:

- ping a peer or inspect its status
- send a chat message through another instance's local gateway
- broadcast a message to multiple peers
- expose a tightly controlled subset of OpenClaw gateway tools over A2A

## Core Skills

- `ping`
- `get_status`
- `chat`
- `broadcast`

The `chat` skill expects a JSON payload such as:

```json
{ "target": "#general", "message": "hello" }
```

The A2A message may send the skill name and JSON args in separate text parts. ClawBridge supports that format.

## Safe Usage Rules

- Prefer built-in skills before exposing gateway tools.
- Keep `config/bridge.json` limited to safe tools like `message`, `web_search`, `web_fetch`, `memory_search`, and `session_status`.
- Do not expose `exec`, `Write`, `Edit`, `Read`, or `browser` unless the operator explicitly accepts the risk.
- Run `npm run verify` before starting the server.

## Operator Workflow

```bash
npm install
npm run setup
npm run verify
npm start
```

## Key Files

- `src/server.js`: A2A server entry point
- `src/executor.js`: skill routing and argument extraction
- `src/bridge.js`: OpenClaw gateway bridge
- `config/bridge.json`: gateway tool exposure policy
- `docs/PUBLIC_QUICKSTART.md`: public deployment guide
