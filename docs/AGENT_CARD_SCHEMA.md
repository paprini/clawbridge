# Agent Card Schema — Phase 1 (Minimal)

**Date:** 2026-03-09  
**Based on:** A2A Protocol RC v1.0, @a2a-js/sdk v0.3.10

---

## What Is an Agent Card?

An Agent Card is a JSON metadata document served at `/.well-known/agent-card.json`. It tells other agents:
- Who you are
- What you can do (skills)
- Where to reach you (URL)
- How to authenticate
- What communication modes you support

Think of it as a business card + API contract for agents.

---

## Required Fields (per A2A spec)

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Human-readable agent name |
| `description` | string | What this agent does |
| `url` | string | JSON-RPC endpoint URL |
| `version` | string | Agent's own version |
| `protocolVersion` | string | A2A protocol version (use `"0.3.0"`) |
| `capabilities` | object | What features are supported |
| `skills` | AgentSkill[] | List of exposed skills |
| `defaultInputModes` | string[] | Default accepted input types |
| `defaultOutputModes` | string[] | Default output types |

---

## Phase 1 Minimal Agent Card

For Phase 1, we expose only two skills: `ping` and `get_status`. This is our "ultra-conservative" MVP per the security architecture.

```json
{
  "name": "openclaw-agent-alpha",
  "description": "OpenClaw agent on laptop (Alpha instance)",
  "url": "http://192.168.1.100:9100/a2a",
  "version": "0.1.0",
  "protocolVersion": "0.3.0",
  
  "capabilities": {
    "streaming": false,
    "pushNotifications": false,
    "stateTransitionHistory": false
  },
  
  "defaultInputModes": ["text/plain"],
  "defaultOutputModes": ["text/plain"],
  
  "provider": {
    "organization": "openclaw-a2a",
    "url": "https://github.com/paprini/openclaw-a2a"
  },
  
  "securitySchemes": {
    "bearer": {
      "type": "http",
      "scheme": "bearer",
      "description": "Pre-shared bearer token for private network"
    }
  },
  "security": [
    { "bearer": [] }
  ],
  
  "skills": [
    {
      "id": "ping",
      "name": "Ping",
      "description": "Health check. Returns pong with timestamp and agent info.",
      "tags": ["health", "status", "connectivity"],
      "examples": ["ping", "are you alive?", "health check"]
    },
    {
      "id": "get_status",
      "name": "Get Status",
      "description": "Returns agent status including uptime, version, and available skill count.",
      "tags": ["status", "info", "monitoring"],
      "examples": ["status", "what's your status?", "agent info"]
    }
  ]
}
```

---

## Skill Design Principles

### Phase 1: Only Safe Skills
- `ping` — Zero risk, confirms connectivity
- `get_status` — Read-only, no sensitive data

### Phase 2+: Progressive Skill Exposure
Skills will be defined in `skills.json` and mapped to OpenClaw capabilities:

```json
{
  "id": "analyze_chords",
  "name": "Chord Analysis",
  "description": "Analyze chord progressions in audio files",
  "tags": ["music", "analysis", "chords"],
  "inputModes": ["text/plain", "audio/wav"],
  "outputModes": ["text/plain", "application/json"],
  "examples": [
    "analyze the chords in this song",
    "what chord progression is this?"
  ]
}
```

---

## Agent Card Generation

Agent Cards are NOT hand-written in production. They're generated from config:

### Input: `agent-config.json`

```json
{
  "name": "openclaw-agent-alpha",
  "description": "OpenClaw agent on laptop",
  "port": 9100,
  "version": "0.1.0",
  "skills": ["ping", "get_status"]
}
```

### Input: `skills.json` (skill definitions library)

```json
{
  "ping": {
    "name": "Ping",
    "description": "Health check. Returns pong with timestamp and agent info.",
    "tags": ["health", "status", "connectivity"],
    "examples": ["ping", "are you alive?"]
  },
  "get_status": {
    "name": "Get Status",
    "description": "Returns agent status including uptime, version, and skill count.",
    "tags": ["status", "info", "monitoring"],
    "examples": ["status", "what's your status?"]
  }
}
```

### Output: Auto-generated Agent Card (served at `/.well-known/agent-card.json`)

The server reads these configs at startup and constructs the `AgentCard` object passed to `DefaultRequestHandler`.

---

## Extended Agent Card (Phase 2+)

The A2A spec supports `supportsAuthenticatedExtendedCard: true`. This means:

- **Public card:** Only `ping` and `get_status` (what unauthenticated peers see)
- **Extended card:** Full skill list (what authenticated peers see after token validation)

This maps perfectly to our security model:
1. Unknown agents see minimal card
2. Trusted peers (with valid token) see the full skill set

We'll implement this in Phase 2.

---

## Agent Naming Convention

For our private network, agent names follow:

```
openclaw-agent-{name}
```

Examples:
- `openclaw-agent-alpha` (laptop)
- `openclaw-agent-beta` (VPS)
- `openclaw-agent-pi` (Raspberry Pi)

For agent-level addressing (Phase 2+):
```
{agent-name}@{instance-name}
```

Examples:
- `pm@alpha`
- `music-expert@beta`
- `researcher@pi`

---

## Validation

We'll validate Agent Cards using the TypeScript types from `@a2a-js/sdk`:

```typescript
import type { AgentCard } from '@a2a-js/sdk';

function validateAgentCard(card: unknown): card is AgentCard {
  const c = card as any;
  return (
    typeof c.name === 'string' &&
    typeof c.description === 'string' &&
    typeof c.url === 'string' &&
    typeof c.version === 'string' &&
    typeof c.protocolVersion === 'string' &&
    Array.isArray(c.skills) &&
    Array.isArray(c.defaultInputModes) &&
    Array.isArray(c.defaultOutputModes) &&
    c.capabilities !== undefined
  );
}
```

TypeScript compilation handles this at build time. Runtime validation is a nice-to-have for incoming peer cards.
