# Setup Reference

**Audience:** users and operators who want exact behavior of the setup command.

This page documents the setup tool itself.  
If you want the shortest path to a working install, use [QUICKSTART_SIMPLE.md](QUICKSTART_SIMPLE.md).

## Commands

### Conversational setup

```bash
npm run setup
```

Uses an OpenAI-compatible model when configured.

### Prompt-based setup

```bash
npm run setup:auto
```

Skips the LLM and asks direct questions.

## What Setup Produces

- `config/agent.json`
- `config/peers.json`
- `config/skills.json`
- `config/bridge.json`
- `config/contacts.json`

The tracked repo copy of `config/peers.json` is a bootstrap placeholder.  
For production, prefer external runtime config through `A2A_CONFIG_DIR`.

## Setup Modes

### LLM-assisted mode

Useful when you want the tool to guide naming and peer discovery.

Relevant environment variables:
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`

### Prompt mode

Useful when you want a predictable setup flow without an LLM dependency.

Behavior:
- reuses the current agent name and URL as prompt defaults
- prompts for this instance's `default_delivery` target used by `@agent` delivery and broadcasts
- walks existing peers one by one with `Keep / Update / Remove`
- lets you generate or replace peer tokens during updates
- lets you add more peers afterwards
- preserves existing bridge, contacts, and custom skills config when rewriting files
- preserves `agent.json -> openclaw_agent_id` when you already pinned a specific local OpenClaw agent
- if you want inbound `@agent` messages to activate the receiving OpenClaw agent, make sure OpenClaw CLI is installed on that node and reachable as `openclaw` (or via `OPENCLAW_BIN`)
- fresh setup now defaults `bridge.agent_dispatch` on and uses a real wait timeout instead of the old fire-and-forget dispatch path

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `OPENAI_API_KEY` | API key for LLM-assisted setup | none |
| `OPENAI_BASE_URL` | OpenAI-compatible endpoint | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | model name | `gpt-4o-mini` |
| `A2A_PORT` | server port | `9100` |
| `A2A_BIND` | bind address | `0.0.0.0` |
| `A2A_CONFIG_DIR` | config directory | `./config` |

## After Setup

Validate:

```bash
npm run verify
```

Then start:

```bash
npm start
```

Then test:

```bash
npm run ping
```

## Related Docs

- [QUICKSTART_SIMPLE.md](QUICKSTART_SIMPLE.md)
- [USER_GUIDE.md](USER_GUIDE.md)
- [OPERATOR_GUIDE.md](OPERATOR_GUIDE.md)
