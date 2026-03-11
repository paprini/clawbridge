# Built-in Skills

**Audience:** advanced users, integrators, and contributors

If you are new to ClawBridge, start with [QUICKSTART_SIMPLE.md](QUICKSTART_SIMPLE.md) first.

ClawBridge comes with built-in skills for connectivity, inspection, messaging, and fan-out.

---

## 1. Health Check Skills

### `ping`

**Purpose:** Test connectivity and verify agent is alive.

**Usage:**
```javascript
callPeerSkill('whatsapp-agent', 'ping')
```

**Response:**
```json
{
  "result": "pong",
  "timestamp": "2026-03-09T23:12:05Z"
}
```

**When to use:**
- Verify agent is reachable
- Test ClawBridge connectivity
- Health monitoring

---

### `get_status`

**Purpose:** Get agent status, uptime, and system information.

**Usage:**
```javascript
callPeerSkill('discord-agent', 'get_status')
```

**Response:**
```json
{
  "agent": "discord-agent",
  "status": "healthy",
  "uptime_seconds": 3600,
  "version": "1.0.0",
  "timestamp": "2026-03-09T23:12:05Z"
}
```

**When to use:**
- Check agent health
- Monitor uptime
- Version verification

---

## 2. Chat Skill

### `chat`

**Purpose:** Send a message locally, to another agent, or to a remote agent's channel via the target agent's OpenClaw gateway.

**How it works:**
1. Peer agent receives `chat` skill call via ClawBridge
2. ClawBridge interprets the target:
   - `@agent-name` relays to that peer and lets the receiving agent choose its `default_delivery`
   - `#channel@agent-name` relays to that peer with a local channel target like `#general`
   - `#channel` or a plain alias resolves locally through `config/contacts.json`
   - direct platform IDs are sent locally
3. For direct local platform targets, the local peer uses its own OpenClaw gateway `message` tool
4. For `@agent-name` and `#channel@agent-name`, the receiving peer runs a session-first `openclaw agent` turn in the resolved local OpenClaw session
5. The receiving peer returns structured result data such as `conversation_id`, `response_text`, and OpenClaw session metadata to the caller
6. This keeps agent-to-agent traffic as explicit session communication instead of visible-send plus inferred reply relay
7. When a concrete OpenClaw `sessionId` is reused, ClawBridge preserves that exact session and does not add `--agent`, because the OpenClaw CLI can otherwise fall back to the agent's main session

For provider-specific delivery, ClawBridge now uses `default_delivery.type` to canonicalize the final local target.
- Discord DMs: `owner` -> `user:<id>`
- Discord channels: `channel` -> `channel:<id>`
- Telegram / WhatsApp keep their native target formats

**Usage:**
```javascript
// Agent-to-agent delivery
callPeerSkill('instagram-agent', 'chat', {
  target: '@discord-agent',
  message: 'Hello from Instagram!'
})

// Agent-to-agent delivery to a named remote channel
callPeerSkill('instagram-agent', 'chat', {
  target: '#general@discord-agent',
  message: 'Hello Discord general'
})

// Direct local-platform target ID
callPeerSkill('discord-agent', 'chat', {
  target: '111111111111111111',
  message: 'Hello from Discord!'
})

// Cross-platform relay via config/contacts.json
callPeerSkill('discord-agent', 'chat', {
  target: 'Example User',
  message: 'Relay this to Telegram',
  channel: 'telegram'
})

// Explicit target on a known peer
callPeerSkill('telegram-agent', 'chat', {
  target: '1234567890',
  message: 'Direct message from another agent',
  channel: 'telegram'
})
```

**Parameters:**
- `target` (optional): one of:
  - `@agent-name`
  - `#channel@agent-name`
  - a local `#channel` alias
  - a platform-specific target ID
  - an alias defined in `config/contacts.json`
- `message` (required): Message text (max 4000 characters)
- `channel` (optional): Specific channel/platform ('discord', 'whatsapp', 'telegram', etc.)

If `target` is omitted, the receiving agent uses `config/agent.json -> default_delivery`.

**Response (success):**
```json
{
  "success": true,
  "delivered_to": "Example User",
  "resolved_target": "1234567890",
  "relayed_via": "telegram-agent",
  "channel": "telegram",
  "message_length": 20,
  "timestamp": "2026-03-09T23:12:05Z"
}
```

**Response (error):**
```json
{
  "error": "Failed to relay message to the correct peer",
  "target": "Example User",
  "relay_peer": "telegram-agent",
  "suggestion": "Check the relay peer in config/contacts.json and confirm that peer is reachable."
}
```

**When to use:**
- Cross-platform messaging (Discord → WhatsApp, etc.)
- Automated notifications
- Agent-to-agent communication

**Requirements:**
- Peer agent must have OpenClaw gateway configured
- Bridge must be enabled
- `message` tool must be allowed in bridge config
- Configure `config/agent.json -> default_delivery` if you want `@agent-name` delivery to resolve to a stable local OpenClaw session and if you want incoming broadcasts to land somewhere by default
- If you want `@agent-name` to activate the receiving agent, OpenClaw CLI must be installed on that node and reachable as `openclaw`; ClawBridge checks the current `PATH`, `npm prefix -g`, `~/.openclaw/bin/openclaw`, and `~/.local/bin/openclaw` before falling back to `OPENCLAW_BIN`
- Do not reuse the local `config/agent.json -> id` as a peer id in `config/peers.json`; `npm run verify` now rejects that because source-side `@agent-name` routing becomes ambiguous
- Use a platform-specific target ID directly for the local platform when you already know it
- For local `#channel` names or cross-platform human aliases, define aliases in `config/contacts.json`

---

## 3. Broadcast Skill

### `broadcast`

**Purpose:** Send alert/message to multiple peers simultaneously (fan-out pattern).

**How it works:**
1. Agent calls `broadcast` with message and optional targets
2. ClawBridge sends message to all specified peers (or all peers if no targets)
3. Each peer receives the broadcast via `chat` and delivers it using that peer's `default_delivery`
4. Results are aggregated and returned

**Usage:**
```javascript
// Broadcast to all peers
broadcast({
  message: 'System maintenance in 5 minutes',
  priority: 'high'
})

// Broadcast to specific peers
broadcast({
  message: 'Update available',
  targets: ['discord-agent', 'whatsapp-agent'],
  priority: 'medium'
})

// Urgent broadcast
broadcast({
  message: 'Critical: Service degradation detected',
  priority: 'urgent',
  targets: ['all-agents']
})
```

**Parameters:**
- `message` (required): Message to broadcast (max 2000 characters)
- `targets` (optional): Array of peer IDs (omit for all peers)
- `priority` (optional): Priority level (`low`, `medium`, `high`, `urgent`). Default: `medium`
- `skill` (optional): Skill to invoke on peers. Default: `chat`

**Priority prefixes:**
- `urgent` → 🚨 URGENT: {message}
- `high` → ⚠️ {message}
- `medium` → ℹ️ {message}
- `low` → {message}

**Response:**
```json
{
  "success": true,
  "broadcast_complete": true,
  "message_sent": "⚠️ System maintenance in 5 minutes",
  "priority": "high",
  "skill_used": "chat",
  "total_peers": 3,
  "successful_deliveries": 2,
  "failed_deliveries": 1,
  "results": [
    {
      "peer": "discord-agent",
      "success": true,
      "error": null,
      "timestamp": "2026-03-09T23:12:05Z"
    },
    {
      "peer": "whatsapp-agent",
      "success": true,
      "error": null,
      "timestamp": "2026-03-09T23:12:05Z"
    },
    {
      "peer": "telegram-agent",
      "success": false,
      "error": "Peer unavailable",
      "timestamp": "2026-03-09T23:12:05Z"
    }
  ],
  "duration_ms": 245,
  "timestamp": "2026-03-09T23:12:05Z"
}
```

**When to use:**
- System-wide alerts
- Coordinated notifications
- Health status updates
- Emergency broadcasts

**Requirements:**
- Peers must have `chat` skill (or custom skill) exposed
- Permissions must allow peer-to-peer calls
- Each receiving peer should configure `config/agent.json -> default_delivery`

---

## Enabling Built-in Skills

**Edit `config/skills.json`:**

```json
{
  "exposed_skills": [
    {
      "name": "ping",
      "description": "Health check",
      "public": true
    },
    {
      "name": "get_status",
      "description": "Agent status",
      "public": true
    },
    {
      "name": "chat",
      "description": "Send message via gateway",
      "public": false
    },
    {
      "name": "broadcast",
      "description": "Send alert to multiple peers",
      "public": false
    }
  ]
}
```

**Security notes:**
- `public: true` → Any peer with valid token can call
- `public: false` → Only peers explicitly allowed in permissions can call
- Recommended: Keep `chat` and `broadcast` as `public: false`

---

## Permission Configuration

**Allow specific peer to use chat:**

Edit `config/permissions.json`:
```json
{
  "default_policy": "deny",
  "peers": [
    {
      "id": "discord-agent",
      "allowed_skills": ["ping", "get_status", "chat"]
    }
  ]
}
```

**Allow all peers to broadcast:**

```json
{
  "default_policy": "deny",
  "peers": [
    {
      "id": "*",
      "allowed_skills": ["ping", "get_status", "broadcast"]
    }
  ]
}
```

---

## Real-World Examples

### Cross-Platform Alerting

**Scenario:** Discord agent needs to notify WhatsApp users of system event.

```javascript
// From Discord agent:
await callPeerSkill('whatsapp-agent', 'chat', {
  target: '#alerts',
  message: '🔴 Production deployment starting in 2 minutes'
})
```

### Emergency Broadcast

**Scenario:** PM agent needs to alert all agents of critical issue.

```javascript
// From PM agent:
const result = await broadcast({
  message: 'Database connection lost. Switching to read-only mode.',
  priority: 'urgent'
})

console.log(`Notified ${result.successful_deliveries}/${result.total_peers} agents`)
```

### Health Monitoring

**Scenario:** Monitor all peers health every 5 minutes.

```javascript
// From monitoring agent:
const peers = ['discord-agent', 'whatsapp-agent', 'telegram-agent']

for (const peer of peers) {
  const status = await callPeerSkill(peer, 'get_status')
  if (!status.result || status.result.status !== 'healthy') {
    await broadcast({
      message: `⚠️ ${peer} is unhealthy`,
      priority: 'high'
    })
  }
}
```

---

## Troubleshooting

### Chat Skill Fails

**Error:** "Failed to send message via gateway"

**Causes:**
1. OpenClaw gateway not running on peer
2. Bridge not configured
3. `message` tool not allowed in bridge whitelist

**Solutions:**
1. Verify gateway: `openclaw status`
2. Check bridge config: `config/bridge.json`
3. Add `message` to allowed tools

### Broadcast Returns Zero Deliveries

**Causes:**
1. No peers configured
2. Peers not reachable
3. `chat` skill not exposed on peers

**Solutions:**
1. Check `config/peers.json` has peer entries
2. Test connectivity: `npm run ping`
3. Add `chat` to peers' `config/skills.json`

### Permission Denied

**Error:** "Permission denied: peer X is not allowed to call skill Y"

**Solution:**
Add peer to `config/permissions.json`:
```json
{
  "peers": [
    {
      "id": "peer-x",
      "allowed_skills": ["ping", "chat", "broadcast"]
    }
  ]
}
```

---

## Next Steps

- **Add custom skills:** See `docs/CUSTOM_SKILLS.md` (coming soon)
- **Advanced orchestration:** See `docs/ORCHESTRATION.md`
- **Security best practices:** See `docs/SECURITY_ARCHITECTURE.md`
