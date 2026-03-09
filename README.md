# openclaw-a2a

**Agent-to-Agent Communication for OpenClaw**

Turn any OpenClaw instance into an A2A-compatible agent. Your agents are islands. openclaw-a2a connects them.

---

## Status

**Phase:** 0 — Project Setup  
**Timeline:** 10-12 days to publish  
**Start Date:** March 9, 2026

---

## What It Does

Install this skill on any OpenClaw instance, run setup, and your agent can:
- **Discover** other A2A agents (via Agent Cards)
- **Send messages** to peer agents in real-time
- **Execute tasks** on remote agents
- **Stream** long-running task updates
- **Interoperate** with any A2A-compatible system (not just OpenClaw)

---

## Architecture

```
┌─────────────────────────────────────────────┐
│  OpenClaw Instance                          │
│                                             │
│  ┌──────────────┐      ┌─────────────────┐ │
│  │   Gateway    │◄────►│  A2A Sidecar    │ │
│  │   :18789     │      │  :9100          │ │
│  └──────────────┘      └─────────────────┘ │
│                              │              │
│                              ↓              │
│                   /.well-known/agent-card   │
│                   /a2a/jsonrpc              │
└─────────────────────────────────────────────┘
         ↕ A2A Protocol (HTTP + JSON-RPC)
┌─────────────────────────────────────────────┐
│  Peer Agent (Another OpenClaw or anything)  │
└─────────────────────────────────────────────┘
```

---

## Quick Start

*(Coming soon after Phase 2)*

```bash
# Install from ClawHub
clawhub install openclaw-a2a

# Run automated setup
cd ~/.openclaw/skills/openclaw-a2a
./setup.sh

# Configure peers
nano config/peers.json

# Start sidecar
sudo systemctl start openclaw-a2a
```

---

## Project Structure

```
openclaw-a2a/
├── src/
│   ├── server.js       # A2A server (Agent Card + JSON-RPC)
│   ├── client.js       # A2A client (outbound calls)
│   ├── bridge.js       # A2A ↔ OpenClaw gateway translator
│   └── auth.js         # Bearer token authentication
├── scripts/
│   ├── setup.sh        # Automated installation
│   └── systemd/        # Service templates
├── config/
│   ├── peers.json      # Known peer agents
│   └── skills.json     # Skills this instance exposes
├── docs/
│   ├── architecture.md # How it works
│   ├── quickstart.md   # 5-minute setup guide
│   └── security.md     # Auth & best practices
├── examples/
│   ├── basic-server/   # Minimal A2A server
│   └── multi-instance/ # Cross-instance communication
├── tests/
│   ├── unit/
│   └── integration/
├── SKILL.md            # Agent instructions
├── package.json
├── .gitignore
└── LICENSE             # MIT
```

---

## Roadmap

- [x] **Phase 0:** Project setup, research, scope definition
- [ ] **Phase 1:** Architecture & design (2 days)
- [ ] **Phase 2:** Core implementation (3-4 days)
- [ ] **Phase 3:** Internal testing (2-3 days)
- [ ] **Phase 4:** Documentation (1-2 days)
- [ ] **Phase 5:** Polish & publish (1 day)

**Target publish:** March 19-21, 2026

---

## Team

- **Main Agent:** Architecture, core implementation, testing
- **PM:** Project management, coordination, timeline
- **Architect:** Code review, design decisions
- **QA:** Testing protocol, edge cases
- **Legal:** License review
- **Growth:** Launch strategy

---

## Why A2A?

**Agent-to-Agent (A2A)** is an open protocol (Linux Foundation, Google, IBM) for agent communication. It provides:

- **Standard discovery** (Agent Cards)
- **Typed task lifecycle** (pending → working → completed)
- **Streaming support** (SSE for long tasks)
- **Universal interop** (works with LangChain, CrewAI, Claude, Gemini, etc.)

Using A2A means your OpenClaw agents can talk to *anything* speaking the protocol — not just other OpenClaw instances.

---

## License

MIT (pending legal review)

---

## Links

- **A2A Spec:** https://github.com/a2a-protocol/spec
- **A2A JS SDK:** https://github.com/a2a-protocol/a2a-js
- **OpenClaw:** https://openclaw.ai
- **ClawHub:** https://clawhub.com

---

**Status:** Phase 0 in progress. Documentation will be updated as we build.
