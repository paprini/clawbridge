# Setup Agent — openclaw-a2a

## The Idea

**Instead of CLI commands or web forms, just talk to an agent that configures everything.**

```
User: I want to set up A2A for my 3 OpenClaw instances

Agent: Great! I'll help you set up a private network for your instances.

       First, what should we call this agent?
       (I can see you're running on 'ip-172-31-30-104')

User: Call it discord-bot

Agent: Perfect. discord-bot it is.

       Now, do you want:
       1. Private network (just your instances) — most secure
       2. Public (discoverable by anyone) — for community agents
       3. Hybrid (private peers + public discovery)

User: Private for now

Agent: Smart choice. I'll set up a private network.

       Do you have other OpenClaw instances you want to connect?

User: Yes, two more: WhatsApp and Telegram

Agent: Got it. I'll need their info:

       WhatsApp instance:
       - IP address or hostname?
       - Bearer token? (I can generate one if you don't have it)

User: IP is 10.0.1.11, generate the token

Agent: ✅ Generated token: a2a_whatsapp_x7K9mP2nQ...
       
       Save this token securely. You'll need it to configure WhatsApp.

       Telegram instance:
       - IP address or hostname?

User: 10.0.1.12, generate token too

Agent: ✅ Generated token: a2a_telegram_b5L3rW8pN...

       Perfect! Let me configure everything:
       
       ✅ Created config.yaml
       ✅ Generated your bearer token
       ✅ Added WhatsApp peer (testing connection... ⏳)
       ⚠️  WhatsApp not reachable yet (expected - set it up there first)
       ✅ Added Telegram peer (testing connection... ⏳)
       ⚠️  Telegram not reachable yet
       ✅ Configured firewall (VPC-only on port 9100)
       ✅ Created systemd service
       ✅ Started A2A sidecar
       
       Your Agent Card: http://10.0.1.10:9100/.well-known/agent-card.json

       Next steps:
       1. On WhatsApp instance, run: setup-a2a --peer discord-bot
          Token: a2a_discord_j4M7kL2wP... (generated for you)
       
       2. On Telegram instance, run: setup-a2a --peer discord-bot
          Token: a2a_discord_j4M7kL2wP... (same token)

       Want me to help you with anything else?
```

**Result:** Entire setup done conversationally, no commands to remember.

---

## Architecture

### The Setup Agent

**What it is:**
- Self-contained agent (runs locally)
- Conversational interface (text-based)
- Can run in terminal OR web chat
- Guides you through configuration
- Validates choices in real-time
- Tests configuration as you go

**How it works:**
```
┌────────────────────────────────────────┐
│  Setup Agent (Node.js + Claude API)   │
│                                        │
│  ├── config-wizard.js                 │
│  ├── validation.js                    │
│  ├── network-test.js                  │
│  └── apply-config.js                  │
└────────────────────────────────────────┘
         ↓ writes
┌────────────────────────────────────────┐
│  config.yaml                           │
│  .secrets/                             │
│  systemd service                       │
└────────────────────────────────────────┘
         ↓ starts
┌────────────────────────────────────────┐
│  A2A Sidecar (:9100)                   │
└────────────────────────────────────────┘
```

---

## User Experiences

### Experience 1: Interactive Terminal

```bash
cd ~/.openclaw/skills/openclaw-a2a
./setup-agent

╔══════════════════════════════════════════╗
║  openclaw-a2a Setup Agent                ║
║  I'll help you configure A2A             ║
╚══════════════════════════════════════════╝

Agent: Hi! I'm here to help you set up Agent-to-Agent communication.
       
       I can see you're running OpenClaw on this machine.
       Have you used A2A before?

You: No, first time

Agent: No problem! I'll explain as we go.
       
       A2A lets your OpenClaw instances talk to each other in real-time.
       Think of it like a direct phone line between your agents.
       
       First, let's choose a security model.
       
       Since you control all instances, I recommend:
       📱 Private Network — only your instances can connect
       
       Sound good?

You: Yes

Agent: Great! Now, how many other OpenClaw instances do you have?

You: 2 more

Agent: Perfect. Let's add them one by one.
       
       Instance 1:
       - What's it called? (e.g., whatsapp-bot, telegram-agent)

You: whatsapp

Agent: Got it. Where is whatsapp running?
       - IP address? (e.g., 10.0.1.11)
       - Or hostname? (e.g., whatsapp.internal)

You: 10.0.1.11

Agent: ✅ Found it! Testing connectivity... SUCCESS
       
       I can see whatsapp is already running A2A on :9100
       
       Do you have its bearer token, or should I help you set it up?

You: Set it up

Agent: I'll generate a new token for both of you to use.
       
       🔑 Generated: a2a_shared_x7K9mP2nQ4vB8wL3rN6sT
       
       Save this token securely!
       
       Now, I'll test the connection with this token... SUCCESS ✅
       
       Instance 2:
       - What's it called?

[continues...]
```

**Benefits:**
- Natural conversation
- Explains as it goes
- Tests immediately
- Catches mistakes early
- No docs needed

---

### Experience 2: Web Chat UI

**Access:** `http://localhost:9100/setup`

```
┌──────────────────────────────────────────────┐
│  openclaw-a2a Setup                          │
├──────────────────────────────────────────────┤
│                                              │
│  Agent: Hi! Let's set up A2A. First, what   │
│         should I call this agent?            │
│                                              │
│  [Type your answer...]                       │
│                                              │
│  Suggestions: discord-bot, main-agent        │
└──────────────────────────────────────────────┘
```

**After configuration:**
```
┌──────────────────────────────────────────────┐
│  ✅ Setup Complete!                           │
├──────────────────────────────────────────────┤
│                                              │
│  Your agent: discord-bot                     │
│  Network: Private                            │
│  Peers: 2 (whatsapp, telegram)              │
│                                              │
│  Status:                                     │
│  ✅ Sidecar running (:9100)                   │
│  ⏳ whatsapp (not connected yet)              │
│  ⏳ telegram (not connected yet)              │
│                                              │
│  Next: Configure your other instances        │
│  [Show Instructions] [Test Connection]       │
└──────────────────────────────────────────────┘
```

---

## Advanced: Post-Setup Management

**The agent doesn't disappear after setup. It stays available for management:**

```bash
./setup-agent manage

Agent: Welcome back! Your A2A network is running.

       Current status:
       ✅ discord-bot (this instance)
       ✅ whatsapp (connected, 23ms latency)
       ❌ telegram (offline since 2h ago)

       What would you like to do?
       1. Add a new peer
       2. Remove a peer
       3. Change network mode (private → public)
       4. Expose more skills
       5. Test connections
       6. View logs
       7. Troubleshoot issues

You: Why is telegram offline?

Agent: Let me check... 🔍

       Telegram's last heartbeat: 2h 14m ago
       
       Possible reasons:
       ├── Instance stopped (check: systemctl status openclaw-a2a)
       ├── Network issue (firewall blocking?)
       └── Token mismatch (wrong bearer token?)
       
       Want me to run diagnostics?

You: Yes

Agent: Running diagnostics on telegram (10.0.1.12:9100)...

       ❌ Connection timeout
       ✅ Firewall allows port 9100
       ⏳ Checking if service is running...
       
       Diagnosis: Service not running on telegram instance
       
       Fix: SSH into telegram instance and run:
            sudo systemctl start openclaw-a2a
       
       Want me to generate an SSH command for you?
```

**The agent becomes your A2A ops assistant.**

---

## Implementation

### Phase 1: Terminal Agent (MVP)

**File:** `scripts/setup-agent.js`

```javascript
#!/usr/bin/env node

const readline = require('readline');
const { Claude } = require('@anthropic-ai/sdk');

const agent = new Claude({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-sonnet-4-5'
});

const systemPrompt = `
You are the openclaw-a2a setup agent.

Your role:
- Help users configure A2A for their OpenClaw instances
- Ask clarifying questions
- Explain trade-offs (private vs public, security implications)
- Test configurations as you build them
- Generate tokens, config files, systemd services
- Provide clear next steps

When user wants to:
- Add peer → ask for IP/hostname, generate or accept token, test connection
- Go public → warn about security, check exposed skills, update firewall
- Expose skill → explain data access, warn if risky, get confirmation

Be conversational but concise. Use emojis sparingly for status (✅❌⏳).
`;

async function chat(userMessage, context) {
  const response = await agent.messages.create({
    system: systemPrompt,
    messages: [
      ...context,
      { role: 'user', content: userMessage }
    ],
    tools: [
      {
        name: 'write_config',
        description: 'Write configuration to config.yaml',
        input_schema: { /* ... */ }
      },
      {
        name: 'test_connection',
        description: 'Test connection to peer',
        input_schema: { /* ... */ }
      },
      {
        name: 'generate_token',
        description: 'Generate bearer token',
        input_schema: { /* ... */ }
      },
      // More tools...
    ]
  });
  
  return response;
}

// Main loop
async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  openclaw-a2a Setup Agent                ║');
  console.log('╚══════════════════════════════════════════╝\n');
  
  const context = [];
  
  // Initial greeting
  const greeting = await chat('Hello', context);
  console.log(`Agent: ${greeting.content}\n`);
  context.push({ role: 'assistant', content: greeting.content });
  
  rl.on('line', async (input) => {
    context.push({ role: 'user', content: input });
    
    const response = await chat(input, context);
    
    // Handle tool calls (write_config, test_connection, etc.)
    if (response.tool_calls) {
      for (const toolCall of response.tool_calls) {
        await executeTool(toolCall);
      }
    }
    
    console.log(`Agent: ${response.content}\n`);
    context.push({ role: 'assistant', content: response.content });
  });
}

main();
```

**Tools the agent can use:**
- `write_config(config)` — writes config.yaml
- `test_connection(ip, port, token)` — tests peer
- `generate_token()` — creates bearer token
- `update_firewall(mode)` — configures security group
- `create_systemd_service()` — installs service
- `start_sidecar()` — starts A2A server
- `run_diagnostics(peer)` — troubleshoots issues

---

### Phase 2: Web Chat UI

**File:** `src/setup-ui.html` (embedded in sidecar)

```html
<!DOCTYPE html>
<html>
<head>
  <title>openclaw-a2a Setup</title>
  <style>
    /* Beautiful chat UI */
  </style>
</head>
<body>
  <div id="chat-container">
    <div id="messages"></div>
    <input id="user-input" placeholder="Type your message..." />
  </div>
  
  <script>
    // Connect to agent via WebSocket
    const ws = new WebSocket('ws://localhost:9100/setup-ws');
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      addMessage('agent', message.content);
    };
    
    document.getElementById('user-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const text = e.target.value;
        addMessage('user', text);
        ws.send(JSON.stringify({ message: text }));
        e.target.value = '';
      }
    });
  </script>
</body>
</html>
```

**Access:** `http://localhost:9100/setup`

---

### Phase 3: Voice Agent (Future)

**Even simpler — just talk:**

```bash
./setup-agent --voice

🎤 Listening...

You: "Hey, I want to add a new peer called telegram at 10.0.1.12"

Agent: "Got it. I'll add telegram at 10.0.1.12. 
        Do you have a bearer token for it, or should I generate one?"

You: "Generate it"

Agent: "Token generated. It's a2a_telegram_b5L3rW8pN. 
        Testing connection... Connection successful. 
        Telegram is now configured."
```

---

## Benefits Over Traditional Config

| Method | Pros | Cons |
|--------|------|------|
| **Manual config** | Full control | Error-prone, no validation |
| **CLI commands** | Scriptable | Need to remember commands |
| **Web forms** | Visual | Still forms, not intuitive |
| **Setup Agent** | ✅ Natural<br>✅ Validates<br>✅ Explains<br>✅ Tests | Needs API key |

**The agent approach:**
- Explains trade-offs in plain English
- Catches mistakes before you make them
- Tests as you go
- Adapts to your answers
- No docs needed

---

## Example: Complex Scenario

**User wants hybrid mode (private + public):**

```
You: I want my Discord agent public but keep WhatsApp private

Agent: Interesting setup! So you want:
       - Discord ↔ WhatsApp: private (full access)
       - Discord ↔ World: public (limited access)
       
       This is called "hybrid mode".
       
       Here's what will happen:
       1. Private Agent Card at http://10.0.1.10:9100
          (only WhatsApp can access, full skills)
       
       2. Public Agent Card at https://discord-bot.a2a.openclaw.ai
          (anyone can access, limited skills)
       
       Which skills should be public?
       
       Currently exposed to WhatsApp:
       ├── ping
       ├── get_status
       ├── search (PRIVATE DATA - not safe for public)
       └── send_message (CAN SPAM - not safe for public)
       
       Recommended for public:
       ├── ping ✅
       └── get_status ✅
       
       Sound good?

You: Yes

Agent: Perfect. I'll set up hybrid mode with conservative public skills.
       
       ⏳ Configuring...
       ✅ Updated config.yaml (network_mode: hybrid)
       ✅ Generated public Agent Card
       ✅ Updated firewall (9100 open to internet)
       ✅ Registered with A2A directory
       ✅ Set up HTTPS (Let's Encrypt)
       
       Your agent is now:
       - Private: http://10.0.1.10:9100 (WhatsApp only)
       - Public: https://discord-bot.a2a.openclaw.ai
       
       Test it:
       curl https://discord-bot.a2a.openclaw.ai/.well-known/agent-card.json
       
       Done! Anything else?
```

**Result:** Complex config explained and applied conversationally.

---

## Recommendation

### MVP (Phase 1):
**Terminal agent** (`setup-agent.js`)
- Conversational setup
- Validates choices
- Tests connections
- Generates all configs

**Time to build:** 3-4 days (during Phase 2 implementation)

### Phase 2:
**Web chat UI** (`/setup` endpoint)
- Same agent, web interface
- Better for non-technical users

### Phase 3:
**Management mode** (post-setup)
- `setup-agent manage` for ops
- Troubleshooting assistant
- Continuous config updates

---

## Answer to Your Question

**Q: Can we have a self-contained agent to help configure?**

**A: YES! That's perfect for OpenClaw users.**

**How it works:**
- Chat with agent (terminal or web)
- Agent asks clarifying questions
- Explains trade-offs
- Validates choices
- Tests as you go
- Applies configuration
- Stays available for management

**Benefits:**
- Natural for OpenClaw users (already talk to agents)
- No commands to remember
- No docs needed
- Catches mistakes early
- Explains security implications

**When:**
- MVP: Terminal agent (Phase 1, 3-4 days)
- Phase 2: Web chat UI
- Phase 3: Voice + management mode

---

**Want me to prototype the terminal agent during Phase 2?** 🎯