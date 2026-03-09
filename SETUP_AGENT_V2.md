# Setup Agent V2 — Intelligent Discovery + Session Integration

## Pato's Key Improvements

### 1. **Call from main session (like this conversation)**
Instead of running a separate script, just ask your current agent:

```
You (in Discord): Hey, help me set up A2A

PM Agent: I'll spawn the A2A setup agent for you. One moment...

[Setup Agent spawns]

Setup Agent: Hi! I'm the A2A setup agent. I can see you're running 
             OpenClaw on this machine (discord-bot on ip-172-31-30-104).
             
             Let me scan for other OpenClaw instances in your network...
             
             🔍 Found 2 other instances:
             ├── whatsapp-bot (10.0.1.11) — OpenClaw v1.2.3
             └── telegram-bot (10.0.1.12) — OpenClaw v1.2.3
             
             Want to connect all 3 instances?

You: Yes

Setup Agent: Perfect! I'll configure A2A for all 3...
             [continues setup]
```

**Result:** No need to SSH, no need to run scripts. Just ask.

---

### 2. **Auto-discover existing agents**
Instead of asking "what's the agent name?", the agent should:
- Scan network for OpenClaw instances
- Show discovered agents
- Let you pick which ones to connect
- Or add manual IPs if needed

```
Setup Agent: Let me scan your network for OpenClaw instances...
             
             🔍 Scanning 10.0.1.0/24...
             
             Found 3 instances:
             ┌─────────────────────────────────────────┐
             │ ✅ discord-bot (10.0.1.10)              │
             │    OpenClaw v1.2.3 — This instance      │
             └─────────────────────────────────────────┘
             ┌─────────────────────────────────────────┐
             │ ⚪ whatsapp-bot (10.0.1.11)             │
             │    OpenClaw v1.2.3 — No A2A yet         │
             │    [Connect]                            │
             └─────────────────────────────────────────┘
             ┌─────────────────────────────────────────┐
             │ ⚪ telegram-bot (10.0.1.12)             │
             │    OpenClaw v1.2.3 — No A2A yet         │
             │    [Connect]                            │
             └─────────────────────────────────────────┘
             
             Select instances to connect:
             1. All (whatsapp-bot + telegram-bot)
             2. Pick individually
             3. Add manual IP
             
You: All

Setup Agent: Got it. Connecting all 3 instances...
```

**Result:** Zero manual input for network topology. Agent figures it out.

---

## Architecture V2

### Integration with Main Session

```
┌─────────────────────────────────────────────┐
│  User (Discord/WhatsApp/Telegram)           │
└──────────────┬──────────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────────┐
│  Main Agent Session (e.g., PM Agent)        │
│  - Handles user request                     │
│  - Spawns A2A Setup Agent as sub-agent      │
└──────────────┬──────────────────────────────┘
               │
               ↓ sessions_spawn
┌─────────────────────────────────────────────┐
│  A2A Setup Agent (Sub-agent)                │
│  - Scans network for peers                  │
│  - Discovers existing agents                │
│  - Configures A2A network                   │
│  - Reports back to main session             │
└──────────────┬──────────────────────────────┘
               │
               ↓ writes config
┌─────────────────────────────────────────────┐
│  A2A Sidecar (:9100)                        │
│  - Runs on all instances                    │
│  - Handles A2A protocol                     │
└─────────────────────────────────────────────┘
```

---

## Discovery Methods

### Method 1: Network Scan (Auto-Discovery)

**How it works:**
```javascript
async function discoverPeers() {
  // 1. Get current network (e.g., 10.0.1.0/24)
  const network = await getCurrentNetwork();
  
  // 2. Scan for OpenClaw gateway (port 18789)
  const instances = [];
  for (const ip of network) {
    try {
      const response = await fetch(`http://${ip}:18789/status`, { timeout: 1000 });
      if (response.ok) {
        const info = await response.json();
        instances.push({
          name: info.agentName || `agent-${ip}`,
          ip: ip,
          version: info.version,
          hasA2A: await checkA2A(ip)
        });
      }
    } catch (e) {
      // Not an OpenClaw instance
    }
  }
  
  return instances;
}

async function checkA2A(ip) {
  try {
    await fetch(`http://${ip}:9100/.well-known/agent-card.json`, { timeout: 500 });
    return true;
  } catch (e) {
    return false;
  }
}
```

**What user sees:**
```
Setup Agent: Scanning network... 🔍
             
             Found 3 OpenClaw instances:
             ✅ discord-bot (10.0.1.10) — You
             ⚪ whatsapp-bot (10.0.1.11) — Not connected
             ⚪ telegram-bot (10.0.1.12) — Not connected
```

---

### Method 2: Agent Directory (Centralized)

**If you have multiple networks (e.g., AWS + home):**

```javascript
// Optional: Query agent directory
async function queryDirectory() {
  const response = await fetch('https://your-registry.com/agents', {
    headers: { 'Authorization': 'Bearer your-token' }
  });
  
  return response.json();
  // Returns: All your OpenClaw instances across networks
}
```

**What user sees:**
```
Setup Agent: Checking agent directory... 🔍
             
             Found 5 OpenClaw instances:
             
             AWS VPC (10.0.1.0/24):
             ├── discord-bot (10.0.1.10) — You
             ├── whatsapp-bot (10.0.1.11)
             └── telegram-bot (10.0.1.12)
             
             Home Network (192.168.1.0/24):
             ├── desktop-agent (192.168.1.100)
             └── laptop-agent (192.168.1.101)
             
             Which ones should I connect?
```

---

### Method 3: Manual Entry (Fallback)

**If auto-discovery fails:**
```
Setup Agent: I couldn't find any other OpenClaw instances.
             
             Options:
             1. They're on a different network (enter IPs manually)
             2. They're not running yet (I'll wait)
             3. This is the only instance (skip peer setup)
             
You: 1

Setup Agent: Got it. Enter peer info:
             
             Peer 1:
             - Name? (e.g., whatsapp-bot)
             - IP address?
             - Port? (default: 9100)
```

---

## Calling from Main Session

### User Experience:

**In Discord (talking to PM agent):**
```
You: Can you help me set up A2A?

PM: Sure! I'll bring in the A2A setup agent.

[PM spawns setup agent as sub-agent]

Setup Agent: Hi! I'm here to help with A2A setup.
             
             I can see you're the PM agent running on discord-bot.
             Let me scan for other instances...
             
             🔍 Found 2 peers: whatsapp-bot, telegram-bot
             
             Want to connect all 3?

You: Yes

Setup Agent: Great! Configuring now...
             
             ✅ Generated shared token
             ✅ Wrote config.yaml
             ✅ Starting sidecar...
             ✅ Testing connections...
             
             All done! Your agents can now talk via A2A.
             
             To test:
             "Send a message to whatsapp-bot: ping"

[Setup agent exits, returns control to PM]

PM: A2A is set up! Your 3 instances are connected.
    
    Want me to test it?

You: Yes

PM: [Uses A2A to ping whatsapp-bot]
    
    ✅ whatsapp-bot responded (24ms latency)
    ✅ telegram-bot responded (31ms latency)
    
    All systems operational!
```

**Result:** Entire setup done conversationally, no context switch.

---

## Implementation

### File: `~/.openclaw/skills/openclaw-a2a/setup-agent/index.js`

```javascript
#!/usr/bin/env node

const { discoverPeers } = require('./discovery');
const { setupA2A } = require('./setup');
const { Claude } = require('@anthropic-ai/sdk');

async function main() {
  // Can be called as sub-agent or standalone
  const isSubAgent = process.env.OPENCLAW_SESSION_TYPE === 'subagent';
  
  // Discover peers automatically
  console.log('🔍 Scanning for OpenClaw instances...\n');
  const peers = await discoverPeers();
  
  // Initialize agent
  const agent = new Claude({
    model: 'claude-sonnet-4-5',
    system: `You are the A2A setup agent.

Available peers on network:
${JSON.stringify(peers, null, 2)}

Your job:
1. Present discovered peers to user
2. Let them select which to connect
3. Configure A2A network
4. Test connections
5. Report success

Tools available:
- write_config(config)
- generate_token()
- test_connection(peer)
- start_sidecar()`,
    tools: [
      {
        name: 'write_config',
        description: 'Write A2A configuration',
        input_schema: { /* ... */ }
      },
      {
        name: 'select_peers',
        description: 'User selected which peers to connect',
        input_schema: { /* ... */ }
      },
      // More tools...
    ]
  });
  
  // Start conversation
  const greeting = await agent.chat(`
    I discovered ${peers.length} OpenClaw instances on this network.
    Present them to the user and ask which ones to connect.
  `);
  
  console.log(greeting);
  
  // Continue conversation...
}

if (require.main === module) {
  // Standalone mode
  main();
} else {
  // Called as module (from main agent)
  module.exports = { setupA2A };
}
```

---

### Calling from Main Agent

**In PM Agent's SKILL.md:**

```markdown
## A2A Setup

If user asks to set up A2A or connect agents:

1. Spawn the A2A setup agent:
   ```javascript
   sessions_spawn({
     runtime: 'subagent',
     agentId: 'a2a-setup',
     mode: 'run',
     task: 'Help user set up A2A network',
     streamTo: 'parent'
   });
   ```

2. Setup agent will:
   - Auto-discover peers
   - Guide user through config
   - Test connections
   - Report back

3. After completion, you can use A2A via:
   ```javascript
   a2a_call({
     peer: 'whatsapp-bot',
     skill: 'ping'
   });
   ```
```

**User just says:** "Help me set up A2A"  
**Agent handles everything.**

---

## Smart First Question

### OLD (Manual):
```
Agent: What should I call this agent?

You: discord-bot

Agent: Where is the other agent?

You: 10.0.1.11
```

### NEW (Auto-Discovery):
```
Agent: Let me scan for OpenClaw instances...
       
       🔍 Found 3 instances on 10.0.1.0/24:
       
       ┌──────────────────────────────────────┐
       │ ✅ discord-bot (10.0.1.10) — You     │
       └──────────────────────────────────────┘
       ┌──────────────────────────────────────┐
       │ ⚪ whatsapp-bot (10.0.1.11)          │
       │    Status: Running, no A2A yet       │
       │    [Select to connect]               │
       └──────────────────────────────────────┘
       ┌──────────────────────────────────────┐
       │ ⚪ telegram-bot (10.0.1.12)          │
       │    Status: Running, no A2A yet       │
       │    [Select to connect]               │
       └──────────────────────────────────────┘
       
       Select instances to connect:
       1. All (recommended for private network)
       2. Pick individually
       3. None (skip peer setup)

You: 1

Agent: Perfect! Connecting all 3 instances...
```

**Result:** Agent already knows the topology. User just confirms.

---

## Edge Cases Handled

### Case 1: No peers found
```
Agent: I scanned 10.0.1.0/24 but only found this instance.
       
       Options:
       1. Your other agents are on a different network
          → Enter IPs manually
       2. They're not running yet
          → I can set you up now, add peers later
       3. This is a solo agent
          → Skip A2A setup
       
       What's your situation?
```

### Case 2: Peer already has A2A
```
Agent: Found 2 instances:
       
       ✅ whatsapp-bot — Already has A2A configured
       ⚪ telegram-bot — No A2A yet
       
       I can:
       1. Connect to whatsapp-bot's existing network
       2. Create new network (whatsapp will need to reconfigure)
       
       Recommendation: Option 1 (less disruption)
```

### Case 3: Mixed versions
```
Agent: Found 3 instances:
       
       ✅ discord-bot (v1.2.3) — You
       ⚠️  whatsapp-bot (v1.1.0) — Older version, may not support A2A
       ✅ telegram-bot (v1.2.3)
       
       Recommendation: Upgrade whatsapp-bot to v1.2.3 first
       
       Connect telegram-bot now? (y/N)
```

---

## Recommendation

### MVP (Phase 1):
**Terminal setup agent with auto-discovery**
- Network scan (Method 1)
- Can be called from main session
- Discovers peers automatically
- Smart defaults based on discovered topology

**Timeline:** 4-5 days (including discovery logic)

### Phase 2:
**Web UI + Agent Directory**
- Visual peer selection
- Cross-network discovery (Method 2)
- Drag-and-drop configuration

### Phase 3:
**Zero-touch setup**
```
You: Set up A2A

Agent: Done. All 3 instances connected automatically.
```

---

## Answer to Your Questions

**Q1: Can setup agent be called from main session?**

**A: YES!** Like right now, you could say:
```
You: Help me set up A2A

PM: I'll spawn the setup agent for you...

[Setup agent takes over, completes setup, returns control to PM]

PM: All set! Your agents are connected.
```

No SSH, no separate script. Just ask.

---

**Q2: Should agent auto-discover existing agents?**

**A: ABSOLUTELY!** Agent should:
1. Scan network automatically
2. Show discovered instances
3. Let you pick which to connect
4. Handle edge cases (mixed versions, existing A2A, etc.)

**Not:** "What's the agent name?" (manual input)  
**Instead:** "I found 3 agents: select which to connect" (smart discovery)

---

**Want me to add this to the roadmap? This makes setup 10x easier.** 🚀