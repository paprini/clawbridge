# openclaw-a2a

**Connect your OpenClaw agents across machines. Share skills. Build a network.**

---

## What You Can Do

### 1. **Connect Your Own Instances**
You have OpenClaw on your laptop, VPS, and Raspberry Pi. Now they can talk.

**Before:**
```
Laptop agent: "I need to analyze this song"
→ Can't access your music expert on the VPS
→ Have to switch machines manually
```

**After:**
```
Laptop agent: "Hey music-expert@vps, analyze this song"
→ VPS processes it
→ Result comes back automatically
```

**Setup:** One command. Auto-discovers your agents. Done.

---

### 2. **Agent-to-Agent Communication**
Not instance-to-instance. **Specific agents talk to specific agents.**

**Example:**
- Your **PM agent on Discord** coordinates with **PM agent on Telegram**
- Your **Legal agent** consults **Architect agent** on another machine
- Your **Research agent** queries **Data agent** on your home server

**Why this matters:** Fine-grained control. Only the agents that need to talk, talk.

---

### 3. **Share Skills Across Your Network**
Your music expert agent has chord detection. Your writing agent needs it.

**Before:**
```
Writing agent: Wants to analyze song lyrics
Music agent: Has chord detection skill
→ Skills are trapped on separate machines
```

**After:**
```
Writing agent → calls chord_detect skill on music agent
→ Gets chords back
→ Correlates lyrics with musical structure
```

**Security:** You control which skills each agent exposes. Whitelist only.

---

### 4. **Make Agents Public (Optional)**
Want to share your music expert with the community? Publish it.

**What happens:**
- Your agent appears in public registry
- Others can discover it by skill ("find agents that detect chords")
- You control what's exposed (ping + status only? Or full skill set?)
- Community reputation system (like Stack Overflow)

**Business model:** Free for community. Optional donations. Or charge if you want.

**Phase:** This is Phase 3 (weeks away). Phase 1 is private network only.

---

## How Easy Is It?

### **Setup: 5 Minutes**

**Step 1: Install**
```bash
clawhub install openclaw-a2a
```

**Step 2: Chat with setup agent**
```
You: Set up A2A

Agent: Scanning your network...
       Found 3 OpenClaw instances:
       
       1. laptop (10.0.1.5)
          ├── 💬 main-agent
          └── 📝 writing-assistant
       
       2. vps (10.0.1.10)
          ├── 🎼 music-expert
          └── 🏗️ architect
       
       3. pi (10.0.1.15)
          └── 🔔 notification-bot
       
       Connect all? (Y/n)

You: Y

Agent: ✅ Connected! All agents can now talk to each other.
       
       Security: Private network (VPC-only)
       Auth: Bearer tokens generated
       Skills: None exposed yet (you choose what to share)
       
       Want to expose some skills? (Y/n)
```

**Step 3: Choose what to share**
```
Agent: Which skills should music-expert expose?
       
       Available skills:
       ├── analyze_song ✓ Safe
       ├── detect_chords ✓ Safe
       ├── search_lyrics ✓ Safe
       └── access_database ✗ Private data
       
       Recommend exposing: analyze_song, detect_chords
       
       Expose these? (Y/n)

You: Y

Agent: ✅ Done!
       
       music-expert now shares:
       - analyze_song
       - detect_chords
       
       Other agents can now call these skills.
       
       Test: "Hey writing-assistant, ask music-expert to detect chords in song.mp3"
```

**That's it. 5 minutes. Your network is live.**

---

## Real-World Examples

### **Example 1: Multi-Machine Workflow**

**Scenario:** You're writing about music. Need to analyze songs.

**Setup:**
- **Laptop:** Writing assistant agent (where you work)
- **VPS:** Music expert agent (has GPU for audio processing)

**Workflow:**
```
You: "Analyze the chord progression in Hotel California"

Writing assistant (laptop):
├── Doesn't have audio processing
├── Calls music-expert@vps.analyze_song("Hotel California")
└── Gets back: "Am, E7, G, D, F, C, Dm, E"

Writing assistant:
├── Incorporates chords into article
└── "The song uses a distinctive Am-E7-G-D progression..."

You: Perfect!
```

**Without A2A:** Copy file to VPS, SSH in, run command, copy results back. Manual.  
**With A2A:** Instant. Automatic. Your laptop agent just calls the skill.

---

### **Example 2: Cross-Agent Expertise**

**Scenario:** PM agent needs legal review of a contract.

**Setup:**
- **Discord instance:** PM agent (project management)
- **Telegram instance:** Legal agent (contract expertise)

**Workflow:**
```
PM@discord: "I need this contract reviewed"

PM agent:
├── Knows legal-expert@telegram has review_contract skill
├── Calls legal-expert@telegram.review_contract(contract.pdf)
└── Waits for response

Legal agent@telegram:
├── Receives contract
├── Reviews (AI + human expert if needed)
└── Returns: "3 issues found: [details]"

PM@discord: Gets review instantly
```

**Without A2A:** PM has to manually coordinate (email, Slack, etc.)  
**With A2A:** Automated. Cross-instance expertise on demand.

---

### **Example 3: Home Automation + Cloud**

**Scenario:** Raspberry Pi at home triggers cloud processing.

**Setup:**
- **Raspberry Pi:** Sensor monitoring agent
- **VPS:** Data analysis agent

**Workflow:**
```
Sensor agent@pi:
├── Detects temperature spike
├── Calls data-analyst@vps.analyze_pattern(sensor_data)
└── Gets prediction: "AC failure likely in 48 hours"

Sensor agent:
└── Sends alert to your phone

You: Call repair service before AC dies
```

**Without A2A:** Pi can't access cloud processing. Manual data export.  
**With A2A:** Pi agent directly calls VPS agent. Automatic.

---

## Security (Simple & Clear)

### **Phase 1: Private Network Only**

**Default setup:**
- ✅ **Private network:** Agents only accessible within your VPC (no public internet)
- ✅ **Bearer tokens:** Each peer authenticates with unique token
- ✅ **Skill whitelist:** You choose exactly which skills are exposed
- ✅ **Agent instructions:** Built-in rules prevent data leaks
- ✅ **Audit log:** All A2A calls logged (who, what, when, allowed/denied)

**What this means:**
- Your laptop agent can't accidentally expose your database to the internet
- Even if someone gets on your network, they need bearer tokens
- You explicitly whitelist "detect_chords" — nothing else is callable

**Example whitelist:**
```json
{
  "exposed_skills": ["ping", "get_status", "detect_chords"],
  "blocked_skills": ["search_database", "read_files", "send_email"]
}
```

Only the 3 exposed skills are callable via A2A. Everything else: blocked.

---

### **Phase 3: Public Agents (Optional)**

**If you choose to publish an agent publicly:**

**What's exposed:**
- Only the skills you explicitly mark as `public: true`
- Agent Card shows capabilities (like an API doc)
- Rate limits enforced
- Usage tracked

**What's NOT exposed:**
- Private data
- Internal skills
- Other agents on your instance
- Your conversations or files

**Example:**
```json
{
  "agent": "music-expert",
  "public_skills": [
    {
      "name": "detect_chords",
      "description": "Analyze audio, return chord progression",
      "public": true,
      "price": "Free"
    }
  ],
  "private_skills": [
    {
      "name": "search_my_music_library",
      "public": false  // Never exposed
    }
  ]
}
```

**Community agents:** Free by default. Optional donations. Or charge if you want (Phase 3).

---

## What Makes This Different?

### **vs. SSH / Manual Coordination**
- **SSH:** Copy files, run commands manually, copy results back
- **A2A:** Agents call each other directly. Automatic.

### **vs. Shared Database**
- **Database:** All agents write/read from one place (tight coupling)
- **A2A:** Agents stay independent, collaborate on demand (loose coupling)

### **vs. REST APIs**
- **REST API:** You write custom endpoints for every integration
- **A2A:** Standard protocol. Write once, works with any A2A agent.

### **vs. Webhooks**
- **Webhooks:** One-way notifications
- **A2A:** Two-way task execution with streaming updates

---

## Technical Overview

### **Architecture**

```
┌─────────────────────────────────────────────┐
│  OpenClaw Instance (Laptop)                 │
│                                             │
│  Agents:                                    │
│  ├── 💬 main-agent                          │
│  └── 📝 writing-assistant                   │
│                                             │
│  ┌──────────────┐      ┌─────────────────┐ │
│  │   Gateway    │◄────►│  A2A Sidecar    │ │
│  │   :18789     │      │  :9100          │ │
│  └──────────────┘      └─────────────────┘ │
│                              ↓              │
│                    /.well-known/agent-card  │
│                    /a2a/jsonrpc             │
└─────────────────────────────────────────────┘
         ↕ A2A Protocol (JSON-RPC + SSE)
┌─────────────────────────────────────────────┐
│  OpenClaw Instance (VPS)                    │
│                                             │
│  Agents:                                    │
│  ├── 🎼 music-expert                        │
│  └── 🏗️ architect                           │
└─────────────────────────────────────────────┘
```

**How it works:**
1. **Sidecar process** runs on each instance (port 9100)
2. **Agent Card** published at `/.well-known/agent-card` (lists skills)
3. **JSON-RPC** endpoint at `/a2a/jsonrpc` (task execution)
4. **SSE streaming** for long-running tasks
5. **Bridge** translates between A2A protocol and OpenClaw's `sessions_send`

---

### **A2A Protocol (Standard)**

Based on open A2A spec (Linux Foundation, Google, IBM):
- **Agent Cards:** Discovery (what skills does this agent have?)
- **JSON-RPC:** Task execution (call a skill, get a result)
- **SSE:** Streaming updates (for tasks that take time)
- **Universal:** Works with LangChain, CrewAI, Claude, Gemini, etc.

**Why use a standard?**
- Your OpenClaw agents can talk to **any** A2A-compatible agent
- Not locked into OpenClaw ecosystem
- Future-proof

---

### **Implementation**

**Tech stack:**
- **Runtime:** Node.js 18+
- **Port:** 9100 (A2A standard)
- **SDK:** @a2a-protocol/sdk
- **Service:** systemd (auto-start, auto-restart)
- **Auth:** Bearer tokens (one per peer)
- **Storage:** JSON config files (peers.json, skills.json)

**Install size:** ~5 MB  
**Memory:** ~50 MB per instance  
**CPU:** Minimal (idle unless processing tasks)

---

## Roadmap & Timeline

### **Phase 1: Private Network** (10-12 days) ← **WE ARE HERE**
**Goal:** Connect your own instances. Prove agent-to-agent works.

**Features:**
- ✅ Agent-to-agent communication (not instance-level)
- ✅ Auto-discovery (scan network, find agents)
- ✅ Conversational setup (chat-based config)
- ✅ Security (private network, bearer tokens, skill whitelist)
- ✅ Skill exposure control (choose what to share)

**Deliverables:**
- A2A sidecar (server + client)
- Setup agent (conversational config)
- systemd service template
- Security defaults (VPC-only)
- Documentation

**Success:** Your PM@laptop talks to PM@vps. Done in 5 minutes.

---

### **Phase 2: Community Knowledge** (2-3 weeks later)
**Goal:** Public agent discovery. Free knowledge sharing.

**Features:**
- Public agent registry (browse agents by skill)
- Skill-based search ("find agents that detect chords")
- Community contributions (free by default)
- Reputation system (like Stack Overflow)

**Example:**
```
You: Find public agents with music analysis skills

Registry:
├── music-expert@community (free, 4.8★, 1.2K uses)
├── chord-detective@open (free, 4.6★, 856 uses)
└── audio-analyzer@lab (free, 4.9★, 234 uses)

You: Use music-expert@community
```

**Success:** 100 people helped through shared agent skills.

---

### **Phase 3: AI-Augmented Expertise** (3-4 weeks later)
**Goal:** Human experts + AI. Knowledge at scale.

**Features:**
- Human-in-the-loop (AI drafts, human refines)
- Expert dashboard (receive tasks, add wisdom)
- Community recognition (reputation, ratings)
- Optional donations (Wikipedia model)

**Example:**
```
Music teacher Sarah publishes music-expert agent:
├── AI analyzes songs (5 min)
├── Sarah reviews + adds insights (5 min)
└── Result: Professional-grade analysis

Sarah helps 60 students/week (vs 10 traditionally)
All free or donation-based
```

**Success:** 10 experts helping 10x more people.

---

## Installation (Phase 1)

**Coming March 19-21, 2026**

```bash
# Install from ClawHub
clawhub install openclaw-a2a

# Run conversational setup
openclaw-a2a setup

# Done! Agents are connected.
```

**Manual setup (advanced):**
```bash
cd ~/.openclaw/skills/openclaw-a2a
npm install
sudo systemctl enable openclaw-a2a
sudo systemctl start openclaw-a2a
```

---

## FAQ

### **Do I need multiple machines?**
No! You can run multiple OpenClaw instances on one machine (different ports). A2A works the same.

### **Can I connect to non-OpenClaw agents?**
Yes! Any A2A-compatible agent works. LangChain, CrewAI, custom implementations — all compatible.

### **Is my data safe?**
Yes. Phase 1 is **private network only** (no public access). You control which skills are exposed. Audit logs track everything.

### **What if I don't want to share anything publicly?**
Don't! Phase 1 is private network. Phase 2-3 (public agents) are optional.

### **Can I charge for my agent's skills?**
Eventually (Phase 3). Not in Phase 1-2. We're focused on community-first, free knowledge sharing.

### **How much does it cost?**
Free. Open source (MIT license).

### **What if my agents leak data?**
Multi-layer protection:
1. Skill whitelist (only exposed skills callable)
2. Agent instructions (built-in "don't share private data" rules)
3. Sandboxed execution (limited permissions)
4. Audit log (track what was accessed)

We take security seriously.

---

## Why This Matters

**Short version:**
- Your agents are isolated. A2A connects them.
- SSH and manual coordination suck. A2A is automatic.
- Share skills across your network. Build once, use everywhere.
- Community knowledge sharing (optional). Help others, get help.

**Long version:**
- AI agents are powerful but isolated. A2A makes them collaborative.
- Experts can amplify their impact 10x (AI does grunt work, humans add wisdom).
- Knowledge should be accessible to everyone, not locked behind paywalls.
- This is how we introduce ourselves to the OpenClaw community.

---

## Status

**Phase:** 0 ✅ Complete (vision, architecture, security design)  
**Phase 1:** Starting this week (10-12 days to ship)  
**Target Publish:** March 19-21, 2026

**Documents:** 12 design docs written  
**Commits:** 13  
**Ready:** Yes

---

## Links

- **GitHub:** https://github.com/paprini/openclaw-a2a
- **A2A Spec:** https://github.com/a2a-protocol/spec
- **A2A SDK:** https://github.com/a2a-protocol/a2a-js
- **OpenClaw:** https://openclaw.ai
- **ClawHub:** https://clawhub.com

---

## Contributing

We're a **people-driven project**. Community-first, open by default.

Want to help?
- Test Phase 1 when it ships (March 19-21)
- Share feedback (GitHub issues)
- Contribute code (PRs welcome)
- Publish your agents (Phase 2-3)
- Help others set up (community support)

---

## License

MIT

---

**Connect your agents. Share skills. Build a network.**

Let's make agent collaboration effortless. 🚀
