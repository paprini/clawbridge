# Phase 1 Implementation Plan

**Date:** 2026-03-09  
**Tech Lead:** clawbridge engineering  
**Goal:** Working private agent network with ping + get_status  
**SDK:** @a2a-js/sdk v0.3.10 (A2A Protocol v0.3.0)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                  OpenClaw Instance                    │
│                                                       │
│  ┌──────────────┐     ┌──────────────────────────┐   │
│  │  OpenClaw     │     │   A2A Server (:9100)      │   │
│  │  Gateway      │◄───►│                            │   │
│  │  (existing)   │     │  /.well-known/agent-card   │   │
│  │              │ bridge│  /a2a  (JSON-RPC)          │   │
│  └──────────────┘     └──────────────────────────┘   │
│                              │                        │
│                              │ outbound               │
│                              ▼                        │
│                        ┌──────────┐                   │
│                        │ A2A Client│──► Peer Agents    │
│                        └──────────┘                   │
└─────────────────────────────────────────────────────┘
```

---

## Component Breakdown

### 1. A2A Server (`src/server/`)

**What:** Express.js HTTP server exposing A2A endpoints.  
**Port:** 9100 (configurable)  
**Endpoints:**
- `GET /.well-known/agent-card.json` — Agent Card
- `POST /a2a` — JSON-RPC 2.0 (message/send, tasks/get, tasks/cancel)

**Implementation using SDK:**

```typescript
// src/server/index.ts
import express from 'express';
import { DefaultRequestHandler, InMemoryTaskStore } from '@a2a-js/sdk/server';
import { jsonRpcHandler, agentCardHandler, UserBuilder } from '@a2a-js/sdk/server/express';
import { buildAgentCard } from '../config/agent-card-builder.js';
import { OpenClawExecutor } from './executor.js';
import { BearerAuthUserBuilder } from './auth.js';

export async function startServer(config: ServerConfig) {
  const agentCard = buildAgentCard(config);
  const taskStore = new InMemoryTaskStore();
  const executor = new OpenClawExecutor(config);
  const requestHandler = new DefaultRequestHandler(agentCard, taskStore, executor);
  
  const app = express();
  app.use(express.json());
  
  // Agent Card endpoint (public, but can be rate-limited)
  app.use('/.well-known/agent-card.json', 
    agentCardHandler({ agentCardProvider: requestHandler }));
  
  // JSON-RPC endpoint (requires bearer token)
  app.use('/a2a', 
    jsonRpcHandler({ 
      requestHandler, 
      userBuilder: BearerAuthUserBuilder(config.tokens) 
    }));
  
  app.listen(config.port, () => {
    console.log(`A2A server listening on :${config.port}`);
  });
}
```

**Key files:**
- `src/server/index.ts` — Server setup & Express wiring
- `src/server/executor.ts` — AgentExecutor implementation (ping, get_status logic)
- `src/server/auth.ts` — Bearer token validation via UserBuilder

### 2. Agent Executor (`src/server/executor.ts`)

**What:** The brain. Receives A2A messages, routes to skill handlers, returns results.

```typescript
// src/server/executor.ts
import type { AgentExecutor, RequestContext, ExecutionEventBus } from '@a2a-js/sdk/server';
import type { Message } from '@a2a-js/sdk';

export class OpenClawExecutor implements AgentExecutor {
  private skills: Map<string, SkillHandler>;
  
  constructor(config: ServerConfig) {
    this.skills = new Map();
    this.skills.set('ping', new PingHandler());
    this.skills.set('get_status', new StatusHandler(config));
  }
  
  async execute(context: RequestContext, eventBus: ExecutionEventBus) {
    const text = extractText(context.userMessage);
    const skill = this.routeToSkill(text);
    
    if (!skill) {
      // Return error message
      eventBus.publish(createErrorMessage('Unknown skill or request'));
      eventBus.finished();
      return;
    }
    
    const result = await skill.handle(context);
    eventBus.publish(result);
    eventBus.finished();
  }
  
  async cancelTask(taskId: string, eventBus: ExecutionEventBus) {
    // Phase 1 tasks are instant, cancellation is a no-op
    eventBus.finished();
  }
}
```

### 3. A2A Client (`src/client/`)

**What:** Outbound caller to peer agents.

```typescript
// src/client/index.ts
import { A2AClient } from '@a2a-js/sdk/client';
import type { AgentCard } from '@a2a-js/sdk';

export class PeerClient {
  private clients: Map<string, A2AClient> = new Map();
  
  async addPeer(name: string, baseUrl: string, token: string) {
    const client = await A2AClient.fromCardUrl(baseUrl, {
      fetchImpl: (url, init) => fetch(url, {
        ...init,
        headers: {
          ...init?.headers,
          'Authorization': `Bearer ${token}`
        }
      })
    });
    this.clients.set(name, client);
  }
  
  async sendMessage(peerName: string, text: string) {
    const client = this.clients.get(peerName);
    if (!client) throw new Error(`Unknown peer: ${peerName}`);
    
    return client.sendMessage({
      message: {
        role: 'user',
        parts: [{ type: 'text', text }],
        messageId: crypto.randomUUID()
      }
    });
  }
  
  async getAgentCard(peerName: string): Promise<AgentCard> {
    const client = this.clients.get(peerName);
    if (!client) throw new Error(`Unknown peer: ${peerName}`);
    return client.getAgentCard();
  }
}
```

### 4. Bridge: A2A ↔ OpenClaw (`src/bridge/`)

**What:** Translates between A2A protocol and OpenClaw's internal session system.

**Phase 1 scope:** Minimal. The executor handles ping/status directly without needing OpenClaw sessions. The bridge will be needed in Phase 2 when we route A2A messages to actual OpenClaw agents via `sessions_spawn`.

```typescript
// src/bridge/index.ts (Phase 1: stub, Phase 2: real implementation)
export class Bridge {
  // Phase 1: Direct execution (ping/status don't need OpenClaw sessions)
  
  // Phase 2: Will translate A2A messages → sessions_spawn → collect results
  // async routeToOpenClaw(skillId: string, message: Message): Promise<Message> {
  //   const session = await openclawClient.sessionsSpawn({ task: message.text });
  //   return await waitForResult(session);
  // }
}
```

### 5. Configuration (`config/`)

**`config/agent.json`** — This agent's identity:
```json
{
  "name": "openclaw-agent-alpha",
  "description": "OpenClaw agent on laptop",
  "port": 9100,
  "version": "0.1.0",
  "skills": ["ping", "get_status"]
}
```

**`config/peers.json`** — Known peer agents:
```json
{
  "peers": [
    {
      "name": "beta",
      "url": "http://192.168.1.101:9100",
      "token": "${PEER_BETA_TOKEN}"
    },
    {
      "name": "pi",
      "url": "http://192.168.1.102:9100",
      "token": "${PEER_PI_TOKEN}"
    }
  ]
}
```

**`config/skills.json`** — Skill definitions:
```json
{
  "ping": {
    "name": "Ping",
    "description": "Health check. Returns pong with timestamp.",
    "tags": ["health", "status"],
    "examples": ["ping", "are you alive?"]
  },
  "get_status": {
    "name": "Get Status",
    "description": "Returns agent uptime, version, skill count.",
    "tags": ["status", "info"],
    "examples": ["status", "agent info"]
  }
}
```

**`config/tokens.json`** — Accepted inbound tokens (or use env vars):
```json
{
  "tokens": [
    {
      "name": "peer-beta",
      "token": "${INBOUND_TOKEN_BETA}"
    }
  ]
}
```

---

## File Structure

```
clawbridge/
├── src/
│   ├── index.ts              # Entry point: start server + load config
│   ├── server/
│   │   ├── index.ts           # Express server setup
│   │   ├── executor.ts        # AgentExecutor (skill routing)
│   │   └── auth.ts            # Bearer token UserBuilder
│   ├── client/
│   │   └── index.ts           # PeerClient (outbound A2A calls)
│   ├── skills/
│   │   ├── ping.ts            # Ping skill handler
│   │   └── status.ts          # Status skill handler
│   ├── config/
│   │   ├── loader.ts          # Config file loader (JSON + env var substitution)
│   │   └── agent-card-builder.ts  # Build AgentCard from config
│   └── bridge/
│       └── index.ts           # A2A ↔ OpenClaw bridge (stub for Phase 1)
├── config/
│   ├── agent.json             # Agent identity
│   ├── peers.json             # Known peers
│   ├── skills.json            # Skill definitions
│   └── tokens.json            # Accepted inbound tokens
├── package.json
├── tsconfig.json
└── README.md
```

---

## Implementation Order

### Step 1: Project Scaffolding (30 min)
- [ ] `npm init`, install `@a2a-js/sdk`, `express`, `@types/express`, `typescript`
- [ ] `tsconfig.json` with ESM, strict mode
- [ ] Basic file structure

### Step 2: Agent Card Builder (30 min)
- [ ] Config loader (agent.json + skills.json → AgentCard)
- [ ] Environment variable substitution for tokens
- [ ] Validation

### Step 3: A2A Server (1 hour)
- [ ] Express server with SDK middleware
- [ ] Agent Card endpoint
- [ ] JSON-RPC endpoint
- [ ] Bearer token authentication

### Step 4: Skill Handlers (30 min)
- [ ] Ping handler: returns `{ pong: true, timestamp, agent }` 
- [ ] Status handler: returns `{ uptime, version, skills, peers }`
- [ ] AgentExecutor routing

### Step 5: A2A Client (30 min)
- [ ] PeerClient with token auth
- [ ] Load peers from config
- [ ] sendMessage + getAgentCard methods

### Step 6: Integration Test (30 min)
- [ ] Start two instances on different ports
- [ ] Instance A pings Instance B
- [ ] Instance B pings Instance A
- [ ] Verify Agent Card exchange

### Step 7: Docker Support (30 min)
- [ ] Dockerfile
- [ ] docker-compose.yml with two agents
- [ ] Network configuration

**Total estimated: ~4 hours**

---

## Docker Considerations

Per `DOCKER_CONSIDERATIONS.md`, we need to handle:

### Port Mapping
```yaml
# docker-compose.yml
services:
  agent-alpha:
    build: .
    ports:
      - "9100:9100"
    environment:
      - AGENT_NAME=openclaw-agent-alpha
      - AGENT_PORT=9100
    volumes:
      - ./config:/app/config
    networks:
      - a2a-net

  agent-beta:
    build: .
    ports:
      - "9101:9100"
    environment:
      - AGENT_NAME=openclaw-agent-beta
      - AGENT_PORT=9100
    volumes:
      - ./config-beta:/app/config
    networks:
      - a2a-net

networks:
  a2a-net:
    driver: bridge
```

### Key Docker Decisions
1. **Internal port always 9100** — mapped externally as needed
2. **Config via volumes** — mount different configs per container
3. **Docker network for peer communication** — agents reference each other by service name
4. **Environment variables** for secrets — tokens never in config files in production

### Dockerfile
```dockerfile
FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist/ ./dist/
COPY config/ ./config/
EXPOSE 9100
CMD ["node", "dist/index.js"]
```

---

## Security (Phase 1)

Aligned with `SECURITY_ARCHITECTURE.md`:

| Layer | Phase 1 Implementation |
|-------|----------------------|
| Network | VPC/LAN only (no public exposure) |
| Auth | Bearer tokens (pre-shared) |
| Skill whitelist | Only `ping` + `get_status` |
| Agent instructions | N/A (no LLM involved in Phase 1) |
| Sandboxed execution | Skills are pure functions, no side effects |
| Audit trail | Console logging (structured JSON) |

### Token Generation
```bash
# Generate a secure token for peer communication
openssl rand -hex 32
```

Each peer pair shares a unique token. Tokens stored in env vars, referenced in config.

---

## Success Criteria

After Phase 1 is implemented:

- [ ] ✅ `curl http://localhost:9100/.well-known/agent-card.json` returns valid Agent Card
- [ ] ✅ Agent A can ping Agent B and get a pong response
- [ ] ✅ Agent B can query Agent A's status
- [ ] ✅ Unauthenticated requests are rejected (401)
- [ ] ✅ Invalid tokens are rejected (403)
- [ ] ✅ Works in Docker containers
- [ ] ✅ Works across LAN (two different machines)

---

## What's NOT in Phase 1

- ❌ Streaming (SSE) — not needed for instant ping/status
- ❌ Push notifications — overkill for Phase 1
- ❌ Bridge to OpenClaw sessions — Phase 2
- ❌ Agent-level routing (pm@alpha) — Phase 2
- ❌ Auto-discovery — Phase 2
- ❌ Web UI — Phase 3+
- ❌ Public network / trust federation — Phase 3+
- ❌ Extended Agent Cards — Phase 2

---

## Open Questions

1. **Config format:** JSON is simple. Should we support YAML too? → **Decision: JSON only for Phase 1.** YAML adds a dependency for no real benefit yet.

2. **CLI integration:** Should Phase 1 have an `clawbridge` CLI command? → **Decision: Not yet.** Start as a standalone Node.js app. CLI integration in Phase 2 when we understand the UX better.

3. **Task persistence:** InMemoryTaskStore loses state on restart. → **Decision: Fine for Phase 1.** Ping/status are stateless. Add SQLite/file-based store in Phase 2.

4. **Multi-agent per instance:** Phase 1 is one Agent Card per instance. Phase 2 introduces agent-level addressing. → **No action needed for Phase 1.**

---

## Dependencies

```json
{
  "dependencies": {
    "@a2a-js/sdk": "^0.3.10",
    "express": "^5.0.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "typescript": "^5.7.0"
  }
}
```

Minimal. Three production dependencies. That's it.
