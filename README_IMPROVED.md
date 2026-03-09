# openclaw-a2a

**Your AI agents are isolated on separate machines.**  
**A2A makes them collaborate.**

Your laptop agent can now call your VPS agent's music analysis — instantly, automatically, securely.  
No SSH. No manual file copying. Just: `music-expert@vps.analyze_song()`

---

## Before A2A → After A2A

### Before: Manual Coordination
```mermaid
graph TB
    A[Laptop Agent<br/>needs music analysis] -->|1. Manual SSH| B[VPS]
    B -->|2. Copy file| C[Music Expert Agent]
    C -->|3. Run command| D[Process audio]
    D -->|4. Copy results back| B
    B -->|5. Manual transfer| A
    
    style A fill:#ff6b6b,stroke:#c92a2a,color:#fff
    style D fill:#ff6b6b,stroke:#c92a2a,color:#fff
    
    Note[❌ 5 manual steps<br/>❌ Context switching<br/>❌ Error-prone]
    
    style Note fill:#ffe066,stroke:#f59f00,stroke-width:2px
```

### After: A2A Communication
```mermaid
graph LR
    A[Laptop Agent] -->|"analyze_song()"| B[Music Expert<br/>@VPS]
    B -->|results| A
    
    style A fill:#51cf66,stroke:#2f9e44,color:#fff
    style B fill:#51cf66,stroke:#2f9e44,color:#fff
    
    Note[✅ One function call<br/>✅ Automatic<br/>✅ Seamless]
    
    style Note fill:#d0ebff,stroke:#1971c2,stroke-width:2px
```

---

## What You Can Do

### 1. **Connect Your Own Instances**
You have OpenClaw on your laptop, VPS, and Raspberry Pi. Now they talk to each other.

**Example:**
```
Laptop agent: "Hey music-expert@vps, analyze this song"
→ VPS processes it
→ Result comes back automatically
```

**Setup:** One command. Auto-discovers your agents. Done in 5 minutes.

---

### 2. **Agent-to-Agent Communication**
Not instance-to-instance. **Specific agents talk to specific agents.**

**Example:**
- Your **PM agent on Discord** coordinates with **Architect agent on VPS**
- Your **Research agent** queries **Data agent** on your home server
- Your **Writing agent** asks **Music expert** for chord analysis

**Why this matters:** Fine-grained control. Only the agents that need to talk, talk.

---

### 3. **Share Skills Across Your Network**
Your music expert has chord detection. Your writing agent needs it. Now they connect.

**Before:**
```
Writing agent: Wants to analyze song lyrics
Music agent: Has chord detection skill
→ Skills trapped on separate machines
```

**After:**
```
Writing agent → calls chord_detect skill on music agent
→ Gets chords back
→ Correlates lyrics with musical structure
```

**Security:** You control which skills each agent exposes. Whitelist only.

---

### 4. **Collaborate with Friends (Phase 2)**
Want to share your music expert with trusted friends? Connect their instances.

**What happens:**
- Your agent appears in their private network
- They can call your exposed skills
- You control what's shared (whitelist specific skills)
- Audit logs track everything

**Timeline:** Phase 2 (2-3 weeks after Phase 1 ships).

---

### 5. **Publish to the Community (Phase 3)**
Want to share your agent with everyone? Make it public.

**What happens:**
- Your agent appears in public registry
- Others discover it by skill ("find agents that detect chords")
- Community reputation system (like Stack Overflow)
- Free by default. Optional donations.

**Timeline:** Phase 3 (3-4 weeks after Phase 1 ships).

---

## Why This Matters

**Short version:**
Your agents are brilliant in isolation. A2A makes them collaborative. Share skills across your network. Help others. Build the agent ecosystem we all want.

**Long version:**

### The Problem
AI agents are powerful but trapped:
- Your music expert lives on your VPS (has GPU)
- Your writing agent lives on your laptop (where you work)
- They can't talk to each other without manual SSH, file copying, context switching

This is 2026. We can do better.

### The Solution
**A2A protocol:** Standard way for agents to discover each other, expose skills, and execute tasks.

**openclaw-a2a:** A2A implementation for OpenClaw. Install it once, your agents collaborate forever.

### The Vision
**Phase 1 (now):** Connect your own instances. Prove agent-to-agent collaboration works.

**Phase 2:** Share agents with trusted friends. Build private expert networks.

**Phase 3:** Publish agents to the community. Free knowledge sharing at scale.

**Long-term:** Human experts + AI agents. Amplify expertise 10x. Knowledge accessible to everyone.

**Why community-first?**
- Knowledge should be free and accessible
- Experts can help 10x more people (AI does grunt work, humans add wisdom)
- We're building the agent ecosystem we all want
- This is how we introduce ourselves to the OpenClaw community

---

## Security (Simple & Clear)

### Phase 1: Private Network Only

```mermaid
graph TB
    subgraph Public["🌐 Public Internet"]
        Attacker[❌ Attacker]
    end
    
    subgraph VPC["🔒 Private Network (VPC)"]
        subgraph Instance1["Instance 1"]
            Agent1[Agent A]
            Sidecar1[A2A Sidecar]
            Whitelist1[Skill Whitelist:<br/>✅ ping<br/>✅ detect_chords<br/>❌ read_files]
            
            Agent1 --> Sidecar1
            Sidecar1 -.checks.-> Whitelist1
        end
        
        subgraph Instance2["Instance 2"]
            Agent2[Agent B]
            Sidecar2[A2A Sidecar]
            Token2[Bearer Token]
            
            Agent2 --> Sidecar2
            Sidecar2 -.requires.-> Token2
        end
        
        Sidecar1 <-->|✅ Authenticated<br/>✅ Whitelisted| Sidecar2
    end
    
    Attacker -.->|❌ Blocked<br/>No route to VPC| Sidecar1
    Attacker -.->|❌ Blocked<br/>No route to VPC| Sidecar2
    
    style Attacker fill:#ff6b6b,stroke:#c92a2a,color:#fff
    style VPC fill:#d0f4de,stroke:#2d6a4f,stroke-width:3px
    style Whitelist1 fill:#ffe066,stroke:#f59f00
    style Token2 fill:#ffe066,stroke:#f59f00
```

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

### Phase 3: Public Agents (Optional)

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

---

## How Easy Is It?

### 5-Minute Setup

```mermaid
gantt
    title 5-Minute Setup Timeline
    dateFormat mm:ss
    axisFormat %M:%S
    
    section Install
    clawhub install openclaw-a2a :a1, 00:00, 90s
    
    section Discovery
    Agent scans network :a2, after a1, 30s
    Display found agents :a3, after a2, 10s
    
    section Configuration
    User confirms: connect all :a4, after a3, 20s
    Generate bearer tokens :a5, after a4, 30s
    
    section Skills
    Choose skills to expose :a6, after a5, 60s
    Save configuration :a7, after a6, 20s
    
    section Launch
    Start A2A sidecar :a8, after a7, 40s
    ✅ Agents connected! :milestone, after a8, 0s
```

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

Agent: ✅ Done! Your agents can now collaborate.
```

**That's it. 5 minutes. Your network is live.**

---

## Real-World Examples

### Example 1: Multi-Machine Workflow

**Scenario:** Writing about music. Need to analyze songs.

**Setup:**
- **Laptop:** Writing assistant agent (where you work)
- **VPS:** Music expert agent (has GPU for audio processing)

**Workflow:**

```mermaid
sequenceDiagram
    participant User
    participant Writing as 📝 Writing Agent<br/>(Laptop)
    participant Music as 🎼 Music Expert<br/>(VPS)
    
    User->>Writing: "Analyze chords in Hotel California"
    Writing->>Music: analyze_song("Hotel California")
    Music->>Music: Process audio (GPU)
    Music->>Writing: "Am, E7, G, D, F, C, Dm, E"
    Writing->>User: "The song uses a distinctive Am-E7-G-D progression..."
```

**Without A2A:** Copy file to VPS, SSH in, run command, copy results back. Manual.  
**With A2A:** Instant. Automatic. Your laptop agent just calls the skill.

---

### Example 2: Multi-Agent Collaboration

**Scenario:** Write an article about a song. Need chords AND historical context.

```mermaid
graph TB
    User[👤 User: "Write article about<br/>Hotel California"]
    
    User --> WA[📝 Writing Assistant<br/>Laptop]
    
    WA -->|"I need chord analysis"| ME[🎼 Music Expert<br/>VPS]
    WA -->|"I need historical context"| RE[🔍 Research Agent<br/>Pi]
    
    ME -->|"Am-E7-G-D progression<br/>+ music theory"| WA
    RE -->|"Released 1976<br/>Eagles' best-selling single"| WA
    
    WA -->|Synthesizes all inputs| Draft[📄 Complete Article]
    
    Draft --> User
    
    style User fill:#e7f5ff,stroke:#1971c2
    style WA fill:#51cf66,stroke:#2f9e44,color:#fff
    style ME fill:#ffd8a8,stroke:#e67700
    style RE fill:#ffd8a8,stroke:#e67700
    style Draft fill:#b2f2bb,stroke:#2b8a3e
```

**Without A2A:** Manual coordination across 3 machines.  
**With A2A:** Writing agent orchestrates automatically.

---

### Example 3: Home Automation + Cloud

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

## What Makes This Different?

| Feature | SSH | REST API | Webhooks | **A2A** |
|---------|-----|----------|----------|---------|
| **Setup time** | Manual | Days (custom code) | Hours | **5 minutes** |
| **Two-way communication** | ✅ | ✅ | ❌ | **✅** |
| **Automatic discovery** | ❌ | ❌ | ❌ | **✅** |
| **Streaming updates** | ❌ | ❌ | ❌ | **✅** |
| **Standard protocol** | ❌ | ❌ | ❌ | **✅** |
| **Agent-level control** | ❌ | ❌ | ❌ | **✅** |

### vs. SSH / Manual Coordination
- **SSH:** Copy files, run commands manually, copy results back
- **A2A:** Agents call each other directly. Automatic.

### vs. Shared Database
- **Database:** All agents write/read from one place (tight coupling)
- **A2A:** Agents stay independent, collaborate on demand (loose coupling)

### vs. REST APIs
- **REST API:** You write custom endpoints for every integration
- **A2A:** Standard protocol. Write once, works with any A2A agent.

### vs. Webhooks
- **Webhooks:** One-way notifications
- **A2A:** Two-way task execution with streaming updates

---

## Technical Overview

### Architecture

```mermaid
graph TB
    subgraph Laptop["🖥️ OpenClaw Instance (Laptop)"]
        LA1[💬 main-agent]
        LA2[📝 writing-assistant]
        LGW[Gateway :18789]
        LSC[A2A Sidecar :9100]
        
        LA1 & LA2 --> LGW
        LGW <--> LSC
    end
    
    subgraph VPS["☁️ OpenClaw Instance (VPS)"]
        VA1[🎼 music-expert]
        VA2[🏗️ architect]
        VGW[Gateway :18789]
        VSC[A2A Sidecar :9100]
        
        VA1 & VA2 --> VGW
        VGW <--> VSC
    end
    
    subgraph RPI["🔌 OpenClaw Instance (Raspberry Pi)"]
        RA1[🔔 notification-bot]
        RGW[Gateway :18789]
        RSC[A2A Sidecar :9100]
        
        RA1 --> RGW
        RGW <--> RSC
    end
    
    LSC <-->|A2A Protocol<br/>JSON-RPC + SSE| VSC
    LSC <-->|A2A Protocol| RSC
    VSC <-->|A2A Protocol| RSC
    
    style LSC fill:#4c6ef5,stroke:#364fc7,color:#fff
    style VSC fill:#4c6ef5,stroke:#364fc7,color:#fff
    style RSC fill:#4c6ef5,stroke:#364fc7,color:#fff
```

**How it works:**
1. **Sidecar process** runs on each instance (port 9100)
2. **Agent Card** published at `/.well-known/agent-card` (lists skills)
3. **JSON-RPC** endpoint at `/a2a/jsonrpc` (task execution)
4. **SSE streaming** for long-running tasks
5. **Bridge** translates between A2A protocol and OpenClaw's `sessions_send`

---

### A2A Protocol (Standard)

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

### Implementation

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

```mermaid
graph TB
    subgraph Phase1["Phase 1: Private Network<br/>(Shipping March 19-21)"]
        P1A[Your laptop]
        P1B[Your VPS]
        P1C[Your Raspberry Pi]
        
        P1A <--> P1B
        P1B <--> P1C
        P1A <--> P1C
        
        P1Note[🔒 Private only<br/>✅ Your instances<br/>✅ Bearer tokens<br/>✅ VPC-only]
    end
    
    subgraph Phase3["Phase 3: Community Network<br/>(Weeks later)"]
        P3You[Your agent]
        P3Comm1[Community agent 1]
        P3Comm2[Community agent 2]
        P3Comm3[Community agent 3]
        Registry[Public Registry<br/>🔍 Searchable by skill]
        
        P3You <--> P3Comm1
        P3You <--> P3Comm2
        P3You --> Registry
        P3Comm3 --> Registry
        
        P3Note[🌐 Optional public<br/>✅ Skill-based search<br/>✅ Reputation system<br/>✅ Free + donations]
    end
    
    style Phase1 fill:#d0f4de,stroke:#2d6a4f,stroke-width:2px
    style Phase3 fill:#e7f5ff,stroke:#1971c2,stroke-width:2px
    style P1Note fill:#ffe066,stroke:#f59f00
    style P3Note fill:#ffe066,stroke:#f59f00
```

### Phase 1: Private Network (10-12 days) ← **WE ARE HERE**
**Goal:** Connect your own instances. Prove agent-to-agent works.

**Features:**
- ✅ Agent-to-agent communication (not instance-level)
- ✅ Auto-discovery (scan network, find agents)
- ✅ Conversational setup (chat-based config)
- ✅ Security (private network, bearer tokens, skill whitelist)
- ✅ Skill exposure control (choose what to share)

**Success:** Your PM@laptop talks to PM@vps. Done in 5 minutes.

**Ships:** March 19-21, 2026

---

### Phase 2: Community Knowledge (2-3 weeks later)
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
```

**Success:** 100 people helped through shared agent skills.

---

### Phase 3: AI-Augmented Expertise (3-4 weeks later)
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

## FAQ

### Do I need multiple machines?
No! You can run multiple OpenClaw instances on one machine (different ports). A2A works the same.

### Can I connect to non-OpenClaw agents?
Yes! Any A2A-compatible agent works. LangChain, CrewAI, custom implementations — all compatible.

### Is my data safe?
Yes. Phase 1 is **private network only** (no public access). You control which skills are exposed. Audit logs track everything.

### What if I don't want to share anything publicly?
Don't! Phase 1 is private network. Phase 2-3 (public agents) are optional.

### Can I charge for my agent's skills?
Eventually (Phase 3). Not in Phase 1-2. We're focused on community-first, free knowledge sharing.

### How much does it cost?
Free forever. Open source (MIT license).

### What if my agents leak data?
Multi-layer protection:
1. Skill whitelist (only exposed skills callable)
2. Agent instructions (built-in "don't share private data" rules)
3. Sandboxed execution (limited permissions)
4. Audit log (track what was accessed)

We take security seriously.

### Can I use this with existing OpenClaw agents?
Yes! No code changes needed. Install openclaw-a2a, configure which skills to expose, done.

---

## 🚀 Get Started

Phase 1 ships **March 19-21, 2026**. Here's how to get involved:

### Right Now
- ⭐ **[Star this repo](https://github.com/paprini/openclaw-a2a)** to follow progress
- 👀 **Watch for releases** (click "Watch" → "Custom" → "Releases")
- 💬 **Join the discussion** in GitHub Discussions

### When Phase 1 Ships (March 19-21)
- 🧪 **Test the setup** (should take 5 minutes)
- 🐛 **Report bugs** (GitHub Issues)
- 📝 **Share your use case** (we want to learn!)
- 🎉 **Tell the community** (spread the word!)

### Phase 2-3 (Weeks Later)
- 🤖 **Publish your agent** to the community registry
- 🎓 **Share knowledge** (teach your agent's skills to others)
- 🌟 **Build the ecosystem** (let's make agent collaboration effortless)

---

## Contributing

We're a **people-driven project**. Community-first, open by default.

Want to help?
- Test Phase 1 when it ships (March 19-21)
- Share feedback (GitHub issues)
- Contribute code (PRs welcome)
- Publish your agents (Phase 2-3)
- Help others set up (community support)

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

---

## Links

- **GitHub:** https://github.com/paprini/openclaw-a2a
- **Documentation:** [GETTING_STARTED.md](GETTING_STARTED.md)
- **Project Status:** [PROJECT_STATUS.md](PROJECT_STATUS.md)
- **Phase Plan:** [PHASE_1_PLAN.md](PHASE_1_PLAN.md)
- **A2A Spec:** https://github.com/a2a-protocol/spec
- **A2A SDK:** https://github.com/a2a-protocol/a2a-js
- **OpenClaw:** https://openclaw.ai
- **ClawHub:** https://clawhub.com

---

## License

MIT

---

**Connect your agents. Share skills. Build a network.**

Let's make agent collaboration effortless. 🚀
