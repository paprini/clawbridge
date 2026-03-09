# OpenClaw Gateway API Reference

**For:** Kiro (OpenClaw Bridge implementation)  
**Purpose:** Integrate A2A with OpenClaw gateway to call main agent tools

---

## Gateway Architecture Overview

**OpenClaw Gateway:**
- Process: Node.js daemon running as systemd service
- Port: 18789 (default, configurable)
- Protocols: WebSocket (primary) + HTTP (tools invoke)
- Auth: Bearer token (from config)
- Config: `~/.openclaw/openclaw.json`

**This machine's gateway:**
```
URL: http://127.0.0.1:18789 (local loopback)
WebSocket: ws://127.0.0.1:18789
Auth: Bearer token (see below)
```

---

## Authentication

**Get the auth token:**

```bash
cat ~/.openclaw/openclaw.json | jq -r '.gateway.auth.token'
```

**Example token:**
```
436a8f2a5d41e994f384bea93a605baf0f4992702f0c72b6
```

**Use in HTTP requests:**
```
Authorization: Bearer 436a8f2a5d41e994f384bea93a605baf0f4992702f0c72b6
```

---

## HTTP API: /tools/invoke

**The simplest way to call OpenClaw tools from A2A.**

### Endpoint

```
POST http://127.0.0.1:18789/tools/invoke
```

### Headers

```
Authorization: Bearer <token-from-config>
Content-Type: application/json
```

### Request Body

```json
{
  "tool": "tool_name",
  "action": "action_name",
  "args": {
    "param1": "value1",
    "param2": "value2"
  },
  "sessionKey": "main"
}
```

**Fields:**
- `tool` (string, required): Name of the tool to invoke (e.g., `exec`, `Read`, `web_search`)
- `action` (string, optional): Action for tools that support multiple actions
- `args` (object, optional): Tool-specific arguments
- `sessionKey` (string, optional): Target session key. Default: "main" (the main agent session)

### Response

**Success (200):**
```json
{
  "ok": true,
  "result": {
    // Tool-specific result
  }
}
```

**Error (400):**
```json
{
  "ok": false,
  "error": {
    "type": "error_type",
    "message": "Error description"
  }
}
```

**Other status codes:**
- `401` — Unauthorized (bad token)
- `404` — Tool not found or not allowed
- `429` — Rate limited (too many auth failures)
- `500` — Unexpected tool execution error

---

## Example Tool Calls

### 1. Execute Shell Command

```bash
curl -sS http://127.0.0.1:18789/tools/invoke \
  -H "Authorization: Bearer $(cat ~/.openclaw/openclaw.json | jq -r '.gateway.auth.token')" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "exec",
    "args": {
      "command": "ls -la /tmp"
    }
  }'
```

**Response:**
```json
{
  "ok": true,
  "result": {
    "stdout": "total 8\ndrwxrwxrwt...",
    "stderr": "",
    "exitCode": 0
  }
}
```

---

### 2. Read File

```bash
curl -sS http://127.0.0.1:18789/tools/invoke \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "Read",
    "args": {
      "path": "/home/user/file.txt"
    }
  }'
```

**Response:**
```json
{
  "ok": true,
  "result": {
    "content": "file contents here..."
  }
}
```

---

### 3. Web Search

```bash
curl -sS http://127.0.0.1:18789/tools/invoke \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "web_search",
    "args": {
      "query": "OpenClaw documentation",
      "count": 5
    }
  }'
```

**Response:**
```json
{
  "ok": true,
  "result": {
    "results": [
      {
        "title": "...",
        "url": "...",
        "snippet": "..."
      }
    ]
  }
}
```

---

### 4. Spawn Subagent

```bash
curl -sS http://127.0.0.1:18789/tools/invoke \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "sessions_spawn",
    "args": {
      "runtime": "subagent",
      "mode": "run",
      "task": "Analyze this data and return insights"
    }
  }'
```

**Note:** `sessions_spawn` is in the default HTTP deny list. To enable it, you need to configure `gateway.tools.allow` in `~/.openclaw/openclaw.json`.

---

## Available Tools

**Common tools you can expose via A2A:**

| Tool | Description | Example Args |
|------|-------------|--------------|
| `exec` | Run shell commands | `{ command: "ls -la" }` |
| `Read` | Read file contents | `{ path: "/path/to/file" }` |
| `Write` | Write file contents | `{ path: "/path", content: "..." }` |
| `Edit` | Edit file (replace text) | `{ path: "/path", oldText: "...", newText: "..." }` |
| `web_search` | Search the web (Brave) | `{ query: "...", count: 5 }` |
| `web_fetch` | Fetch URL content | `{ url: "https://..." }` |
| `browser` | Control browser | `{ action: "open", url: "..." }` |
| `memory_search` | Search memory | `{ query: "..." }` |
| `image` | Analyze images | `{ image: "/path/to/img.jpg", prompt: "..." }` |
| `pdf` | Analyze PDFs | `{ pdf: "/path/to/doc.pdf", prompt: "..." }` |
| `session_status` | Get session stats | `{}` |
| `sessions_list` | List active sessions | `{}` |

**Full list:** Check OpenClaw docs or run `openclaw help` locally.

---

## Tool Policy & Security

**Default HTTP deny list (cannot be called via /tools/invoke):**
- `sessions_spawn`
- `sessions_send`
- `gateway`
- `whatsapp_login`

**Why?** These are sensitive operations that should not be exposed over HTTP without explicit configuration.

**To allow a denied tool:**

Edit `~/.openclaw/openclaw.json`:

```json
{
  "gateway": {
    "tools": {
      "allow": ["sessions_spawn"]
    }
  }
}
```

Then restart the gateway:
```bash
openclaw gateway restart
```

**To deny additional tools over HTTP:**

```json
{
  "gateway": {
    "tools": {
      "deny": ["browser", "exec"]
    }
  }
}
```

---

## Bridge Implementation Strategy

### Option 1: Direct HTTP (Recommended for Phase 2)

**Pros:**
- Simplest to implement
- No WebSocket complexity
- Works with existing /tools/invoke endpoint
- Same auth as gateway

**Cons:**
- HTTP deny list (some tools blocked by default)
- Need to restart gateway to change allowed tools

**Implementation:**

```javascript
// src/bridge.js
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

async function loadGatewayConfig() {
  const configPath = path.join(process.env.HOME, '.openclaw/openclaw.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  return {
    url: `http://127.0.0.1:${config.gateway.port || 18789}`,
    token: config.gateway.auth.token
  };
}

async function callOpenClawTool(toolName, args, sessionKey = 'main') {
  const { url, token } = await loadGatewayConfig();
  
  const response = await fetch(`${url}/tools/invoke`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      tool: toolName,
      args: args || {},
      sessionKey: sessionKey
    })
  });
  
  const result = await response.json();
  
  if (!result.ok) {
    throw new Error(result.error?.message || 'Tool execution failed');
  }
  
  return result.result;
}

module.exports = { callOpenClawTool };
```

**Usage in A2A executor:**

```javascript
// src/executor.js (add OpenClaw bridge skills)
const { callOpenClawTool } = require('./bridge');

async function executeSkill(skillName, params, context) {
  // Check if skill is an OpenClaw tool (from bridge config)
  if (isOpenClawTool(skillName)) {
    return await callOpenClawTool(skillName, params);
  }
  
  // Otherwise handle as native A2A skill
  // ... existing skill execution logic
}
```

---

### Option 2: WebSocket Client (Future)

**For real-time integration, bidirectional communication.**

**Not needed for Phase 2.** Stick with HTTP for now.

---

## Configuration: config/bridge.json

**Create this file to configure OpenClaw bridge:**

```json
{
  "enabled": true,
  "gateway": {
    "url": "http://127.0.0.1:18789",
    "tokenPath": "~/.openclaw/openclaw.json",
    "sessionKey": "main"
  },
  "exposed_tools": [
    "exec",
    "Read",
    "Write",
    "web_search",
    "web_fetch",
    "memory_search",
    "image",
    "pdf",
    "session_status"
  ],
  "timeout_ms": 300000,
  "max_concurrent": 5
}
```

**Fields:**
- `enabled` — Enable/disable bridge
- `gateway.url` — OpenClaw gateway HTTP endpoint
- `gateway.tokenPath` — Path to OpenClaw config (for auth token)
- `gateway.sessionKey` — Which session to use (usually "main")
- `exposed_tools` — Which OpenClaw tools to expose as A2A skills
- `timeout_ms` — Max time per tool call (5 minutes default)
- `max_concurrent` — Max simultaneous bridge calls

---

## Error Handling

**Common errors:**

| Error | Cause | Fix |
|-------|-------|-----|
| `ECONNREFUSED` | Gateway not running | Start gateway: `openclaw gateway start` |
| `401 Unauthorized` | Wrong token | Check token in `~/.openclaw/openclaw.json` |
| `404 Not Found` | Tool not allowed | Add to `gateway.tools.allow` in config |
| `Timeout` | Tool took too long | Increase `timeout_ms` in bridge config |
| `Tool execution failed` | Tool-specific error | Check tool args, permissions |

---

## Testing Bridge Locally

**1. Test /tools/invoke directly:**

```bash
# Get token
TOKEN=$(cat ~/.openclaw/openclaw.json | jq -r '.gateway.auth.token')

# Test exec
curl -sS http://127.0.0.1:18789/tools/invoke \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tool": "exec", "args": {"command": "echo hello"}}'

# Should return: {"ok":true,"result":{"stdout":"hello\n",...}}
```

**2. Test from Node.js:**

```javascript
const fetch = require('node-fetch');
const fs = require('fs');

async function test() {
  const config = JSON.parse(fs.readFileSync(
    require('os').homedir() + '/.openclaw/openclaw.json', 'utf8'
  ));
  
  const response = await fetch('http://127.0.0.1:18789/tools/invoke', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.gateway.auth.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      tool: 'exec',
      args: { command: 'ls -la /tmp | head -3' }
    })
  });
  
  const result = await response.json();
  console.log(JSON.stringify(result, null, 2));
}

test().catch(console.error);
```

**3. Test bridge module:**

```javascript
const { callOpenClawTool } = require('./src/bridge');

async function test() {
  const result = await callOpenClawTool('exec', {
    command: 'echo "Bridge working!"'
  });
  console.log(result);
}

test().catch(console.error);
```

---

## Next Steps for Bridge Implementation

### Phase 1: Basic Bridge (2 hours)

1. Create `src/bridge.js`:
   - `loadGatewayConfig()` — Read OpenClaw config
   - `callOpenClawTool(tool, args, sessionKey)` — HTTP call to /tools/invoke
   - Error handling (timeout, connection refused, auth errors)

2. Create `config/bridge.json`:
   - List of allowed OpenClaw tools
   - Timeout settings
   - Concurrency limits

3. Test bridge module:
   - Unit tests for config loading
   - Integration test: call `exec` tool
   - Test error cases (bad token, tool not found)

### Phase 2: Skill Discovery (2 hours)

4. Auto-discover available tools:
   - Query OpenClaw for tool list (or hardcode common tools)
   - Generate A2A skill definitions from OpenClaw tool schemas
   - Update agent card with discovered skills

5. Add `list_skills` endpoint:
   - Return detailed info about each bridged tool
   - Include: tool name, description, parameters, return type

### Phase 3: Executor Integration (2 hours)

6. Modify `src/executor.js`:
   - Check if skill is OpenClaw tool (from bridge config)
   - If yes: route to `callOpenClawTool()`
   - If no: execute as native A2A skill

7. Add timeout handling:
   - Respect `timeout_ms` from bridge config
   - Cancel long-running tool calls
   - Return timeout error to peer

### Phase 4: Testing (2 hours)

8. Integration tests:
   - A2A peer calls bridged OpenClaw tool
   - Verify result matches expected format
   - Test error propagation (tool error → A2A error)

9. Performance tests:
   - Multiple concurrent bridge calls
   - Verify max_concurrent limit enforced
   - Measure latency (A2A call → OpenClaw tool → response)

### Phase 5: Documentation (1 hour)

10. Create BRIDGE_SETUP.md:
    - How to configure bridge
    - Which tools to expose (recommendations)
    - Security considerations
    - Troubleshooting

11. Update USER_GUIDE.md:
    - Add bridge examples
    - Show real-world use cases (laptop → VPS bridge)

---

## Security Considerations

**OpenClaw tools have full system access.** Only expose tools that are safe for remote peers to call.

**Safe tools (recommended for Phase 2):**
- `web_search` — No local system access
- `web_fetch` — Read-only web access
- `memory_search` — Read-only memory access
- `session_status` — Read-only status info
- `image`, `pdf` — Analysis only (if paths are validated)

**Risky tools (DO NOT EXPOSE):**
- `exec` — Arbitrary command execution
- `Write` — Can overwrite any file
- `Edit` — Can modify files
- `gateway` — Can change OpenClaw config
- `sessions_spawn` — Can spawn arbitrary agents

**Medium-risk tools (expose with caution):**
- `Read` — Can read any file (validate paths)
- `browser` — Can access web on your behalf

**Validation strategy:**
- Whitelist only safe tools in `config/bridge.json`
- Add path validation for file operations
- Add input sanitization for exec-like tools
- Log all bridge calls (audit trail)
- Add per-peer permissions (which peer can call which tools)

---

## OpenClaw Gateway Documentation

**Full docs:** `/home/guali/.nvm/versions/node/v22.22.1/lib/node_modules/openclaw/docs/gateway/`

**Key files:**
- `tools-invoke-http-api.md` — HTTP endpoint reference
- `protocol.md` — WebSocket protocol (for future)
- `configuration-reference.md` — Config options
- `authentication.md` — Auth modes

**Or online:** https://docs.openclaw.ai

---

## Questions?

Post in sharechat.md if you need:
- Clarification on any endpoint
- Help with specific tool call
- Config examples
- Debugging assistance

---

**You have everything you need to build the bridge. Start with the HTTP endpoint (`/tools/invoke`) — it's the simplest path.**
