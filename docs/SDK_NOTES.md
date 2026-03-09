# SDK Notes: @a2a-js/sdk

**Date:** 2026-03-09  
**SDK Version:** 0.3.10  
**A2A Protocol Version:** RC v1.0 (latest released: 0.3.0)  
**Package:** `@a2a-js/sdk` (NOT `@a2a-protocol/sdk` — that doesn't exist)  
**Source:** https://github.com/a2aproject/a2a-js

---

## Package Structure

The SDK is well-organized into subpath exports:

```
@a2a-js/sdk              → Core types, constants (AgentCard, Task, Message, etc.)
@a2a-js/sdk/server        → Server-side: DefaultRequestHandler, AgentExecutor, TaskStore, etc.
@a2a-js/sdk/server/express → Express.js middleware: jsonRpcHandler, agentCardHandler, restHandler
@a2a-js/sdk/server/grpc    → gRPC server adapter
@a2a-js/sdk/client         → Client class, Transport, ClientConfig, interceptors
@a2a-js/sdk/client/transports/grpc → gRPC client transport
```

**ESM only** (`"type": "module"` in package.json). Node.js ≥ 18 required.

---

## Key Types

### AgentCard (complete field list)

```typescript
interface AgentCard {
  name: string;                          // REQUIRED - Human-readable name
  description: string;                   // REQUIRED - Purpose description
  url: string;                           // REQUIRED - Preferred endpoint URL
  version: string;                       // REQUIRED - Agent's own version
  protocolVersion: string;               // REQUIRED - A2A protocol version (e.g., "0.3.0")
  capabilities: AgentCapabilities;       // REQUIRED - What the agent supports
  skills: AgentSkill[];                  // REQUIRED - List of skills
  defaultInputModes: string[];           // REQUIRED - Default input MIME types
  defaultOutputModes: string[];          // REQUIRED - Default output MIME types
  
  // Optional
  provider?: AgentProvider;              // Organization info
  preferredTransport?: string;           // "JSONRPC" | "GRPC" | "HTTP+JSON" (default: JSONRPC)
  additionalInterfaces?: AgentInterface[]; // Multiple transport endpoints
  securitySchemes?: Record<string, SecurityScheme>;
  security?: Record<string, string[]>[]; // OpenAPI 3.0 security requirements
  signatures?: AgentCardSignature[];     // JWS signatures
  supportsAuthenticatedExtendedCard?: boolean;
  iconUrl?: string;
  documentationUrl?: string;
}
```

### AgentSkill

```typescript
interface AgentSkill {
  id: string;                            // REQUIRED - Unique identifier
  name: string;                          // REQUIRED - Human-readable name
  description: string;                   // REQUIRED - What it does
  tags: string[];                        // REQUIRED - Keywords for discovery
  
  // Optional
  examples?: string[];                   // Example prompts
  inputModes?: string[];                 // Override agent's default input MIME types
  outputModes?: string[];                // Override agent's default output MIME types
  security?: Record<string, string[]>[]; // Skill-specific security requirements
}
```

### AgentCapabilities

```typescript
interface AgentCapabilities {
  streaming?: boolean;                   // SSE support
  pushNotifications?: boolean;           // Webhook push updates
  stateTransitionHistory?: boolean;      // Task state history
  extensions?: AgentExtension[];         // Protocol extensions
}
```

### Task States

```typescript
type TaskState = 
  | "submitted"      // Just created
  | "working"        // Agent is processing
  | "input-required" // Agent needs more input
  | "completed"      // Done successfully
  | "canceled"       // Canceled by client
  | "failed"         // Agent encountered error
  | "rejected"       // Agent refused the task
  | "auth-required"  // Needs authentication
  | "unknown";       // Indeterminate state
```

---

## Server-Side Architecture

### Core Pattern: AgentExecutor + DefaultRequestHandler

The SDK uses a clean separation:

1. **AgentExecutor** — You implement this. It's your agent logic.
2. **DefaultRequestHandler** — SDK provides this. It handles A2A protocol mechanics.
3. **Express middleware** — SDK provides this. HTTP transport layer.

```typescript
import { DefaultRequestHandler, InMemoryTaskStore, AgentExecutor, RequestContext, ExecutionEventBus } from '@a2a-js/sdk/server';
import { jsonRpcHandler, agentCardHandler, UserBuilder } from '@a2a-js/sdk/server/express';
import express from 'express';

// 1. Define your agent executor
const executor: AgentExecutor = {
  async execute(context: RequestContext, eventBus: ExecutionEventBus) {
    // Your agent logic here
    // Publish events: Message, Task, TaskStatusUpdateEvent, TaskArtifactUpdateEvent
    eventBus.publish({ /* Message or Task */ });
    eventBus.finished();
  },
  async cancelTask(taskId: string, eventBus: ExecutionEventBus) {
    // Handle cancellation
  }
};

// 2. Create request handler
const taskStore = new InMemoryTaskStore();
const requestHandler = new DefaultRequestHandler(agentCard, taskStore, executor);

// 3. Wire up Express
const app = express();
app.use(express.json());
app.use('/.well-known/agent-card.json', agentCardHandler({ agentCardProvider: requestHandler }));
app.use('/', jsonRpcHandler({ requestHandler, userBuilder: UserBuilder.noAuthentication }));
app.listen(9100);
```

### TaskStore

Two options:
- `InMemoryTaskStore` — provided, good for dev/simple use
- Custom `TaskStore` — implement `save(task)` and `load(taskId)` for persistent storage

### ExecutionEventBus

The event bus is how your executor communicates results:
- `eventBus.publish(event)` — Send a Message, Task, or update event
- `eventBus.finished()` — Signal execution complete

### Push Notifications

Optional. Requires:
- `InMemoryPushNotificationStore` (or custom)
- `DefaultPushNotificationSender`
- Set `capabilities.pushNotifications: true` in AgentCard

---

## Client-Side Architecture

### New Client (recommended)

```typescript
import { Client } from '@a2a-js/sdk/client';

// Client is constructed with a Transport + AgentCard
// Use ClientFactory or construct manually
```

### Legacy A2AClient (deprecated but simpler)

```typescript
import { A2AClient } from '@a2a-js/sdk/client';

// From URL (fetches agent card automatically)
const client = await A2AClient.fromCardUrl('http://peer-agent:9100');

// Or from AgentCard object
const client = new A2AClient(agentCard);

// Send message (blocking)
const response = await client.sendMessage({
  message: {
    role: 'user',
    parts: [{ type: 'text', text: 'Hello!' }],
    messageId: 'msg-1'
  }
});

// Send message (streaming via SSE)
for await (const event of client.sendMessageStream(params)) {
  // event: Message | Task | TaskStatusUpdateEvent | TaskArtifactUpdateEvent
}

// Get task status
const task = await client.getTask({ id: 'task-123' });

// Cancel task
await client.cancelTask({ id: 'task-123' });
```

### Client Interceptors

The new `Client` class supports interceptors for auth, logging, etc:

```typescript
const client = new Client(transport, agentCard, {
  interceptors: [{
    async before(args) { /* add auth headers */ },
    async after(args) { /* log responses */ }
  }]
});
```

---

## Agent Card Discovery

**Well-known path:** `/.well-known/agent-card.json`

Constant exported: `AGENT_CARD_PATH = ".well-known/agent-card.json"`

The client fetches this automatically when constructed with a base URL.

---

## Transport Protocols

The SDK supports three bindings:

| Protocol | Middleware | Client Transport |
|----------|-----------|------------------|
| JSON-RPC 2.0 | `jsonRpcHandler()` | Default (HTTP fetch) |
| HTTP+JSON/REST | `restHandler()` | Not yet seen |
| gRPC | `@a2a-js/sdk/server/grpc` | `@a2a-js/sdk/client/transports/grpc` |

**Our choice: JSON-RPC** — simplest, most widely supported, default in the spec.

---

## SSE Streaming

- Server uses `sendMessageStream()` which returns an `AsyncGenerator<AgentExecutionEvent>`
- The Express `jsonRpcHandler` automatically handles SSE response format
- Client consumes via `sendMessageStream()` which returns `AsyncGenerator<A2AStreamEventData>`

---

## Authentication

The SDK doesn't enforce authentication — it provides the hooks:

1. **AgentCard declares** security schemes (OpenAPI 3.0 format)
2. **Server uses** `UserBuilder` to extract user from request
3. **Client uses** interceptors or custom fetch to add auth headers
4. **Extended Agent Card** — authenticated users can get more skills

For our Phase 1 (private network): Bearer token via `APIKeySecurityScheme`.

---

## Key Findings & Implications for clawbridge

### ✅ Good News
1. SDK is well-designed, clean TypeScript, ESM
2. Express middleware makes server setup trivial
3. Agent Card schema is exactly what we need for skill exposure
4. In-memory stores work fine for our MVP
5. The `AgentExecutor` pattern maps cleanly to OpenClaw's `sessions_spawn`

### ⚠️ Watch Out
1. **No built-in peer discovery** — we need to handle this ourselves (peers.json)
2. **No built-in auth middleware** — we need to implement Bearer token validation via UserBuilder
3. **Task state is in-memory** — fine for MVP, need persistence later
4. **ESM only** — need `"type": "module"` in our package.json
5. **The deprecated `A2AClient` is simpler** but the new `Client` class is more flexible

### 🚫 Blockers
None identified. The SDK does exactly what we need.
