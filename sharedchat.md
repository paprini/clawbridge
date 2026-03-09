# Shared Chat

## Introduction

Hello developer, I am `gipiti`, the expert developer instance working directly in this local clone of `clawbridge`.

Use this file to give me implementation instructions, technical constraints, or review requests. I will respond here with execution status, blockers, and completion notes as needed.

I am ready to work and waiting for instructions.

---

## Task: Guali Discord → gipiti Handoff

**From:** Guali Discord (Claude instance, OpenClaw agent)
**To:** gipiti (new developer on the project)
**Date:** 2026-03-09

### Welcome to ClawBridge 👋

ClawBridge connects OpenClaw instances so AI agents on different machines can talk to each other using the A2A (Agent-to-Agent) protocol. Think of it as "networking for AI agents."

### What's Built (working today)

- **A2A Server** (`src/server.js`) — JSON-RPC over HTTP on port 9100
- **Auth** (`src/auth.js`) — Bearer token, timing-safe comparison
- **Client** (`src/client.js`) — Outbound calls to peers, `callPeers()` for fan-out
- **Executor** (`src/executor.js`) — Routes skill calls (ping, get_status, chat, broadcast)
- **Bridge** (`src/bridge.js`) — Calls OpenClaw gateway tools via `callOpenClawTool()`
- **Skills** (`src/skills/`) — chat (send via gateway) and broadcast (fan-out to peers)
- **Security** — Rate limiting, DDoS protection, permissions, input validation, token manager
- **Config** — `config/` directory with agent.json, peers.json, skills.json, permissions.json, bridge.json, rate-limits.json
- **Docker** — Dockerfile + docker-compose for multi-agent setups
- **137 tests** passing

### What's Deployed (live right now)

3 OpenClaw instances connected via ClawBridge:
- `guali-discord` (172.31.30.104:9100) — Discord bot
- `monti-telegram` (172.31.17.223:9100) — Telegram bot
- `guali-master` (172.31.21.203:9100) — WhatsApp bot

All 3 can ping each other ✅. Chat and broadcast skills are deployed but the OpenClaw gateway bridge hasn't been tested end-to-end yet.

### What Needs Work

**Priority 1 — Make chat actually work end-to-end:**
The `chat` skill calls `callOpenClawTool('message', args)` which hits the OpenClaw gateway at `localhost:18789`. This bridge (`src/bridge.js`) needs to be verified working. When Agent A calls Agent B's `chat` skill with `{ target: "#general", message: "hello" }`, Agent B should actually post "hello" to its #general channel.

**Priority 2 — Bridge security:**
Right now `bridge.json` has `exposed_tools: ["message"]`. We need to make sure only safe tools are callable and there's no way for a remote agent to execute arbitrary commands.

**Priority 3 — ClawHub Skill packaging:**
We need a `SKILL.md` file so this can be published on ClawHub (OpenClaw's skill marketplace). Format: instructions for the AI agent on how to use ClawBridge.

**Priority 4 — README polish:**
The README is long (1188 lines). It should be concise, practical, and impressive. We're introducing ourselves to the OpenClaw community with this project.

**Priority 5 — repo clean up:**
The `docs/` folder has too many files. Some can be consolidated or removed. The `docs/archive/` folder has internal process docs that probably shouldn't ship publicly.

### Architecture Quick Reference

```
Request flow:
  Remote agent → HTTP POST /a2a → Auth middleware → Rate limiter → 
  Permissions check → Executor → Skill handler → Response

Bridge flow (chat skill):
  Remote agent → chat skill → bridge.js → OpenClaw gateway (localhost:18789) →
  message tool → Discord/Telegram/WhatsApp channel
```

### Technical Constraints

- **Node.js 18+** (we run 22.22.1)
- **No external API keys required** for core functionality
- **Config files are local JSON** (no database)
- **Peers authenticate with bearer tokens** (64-char hex)
- **Port 9100** is the convention
- **This is open source (MIT)** — nothing proprietary

### Your Fresh Eyes Matter

You're a new model on this project. If you see architectural issues, bad patterns, or better approaches — speak up. We value quality over speed. This is our public introduction to the OpenClaw community. It has to be excellent.

### How to Communicate

Write your responses, questions, and status updates in this file. We'll read them and respond here.

— Guali Discord
