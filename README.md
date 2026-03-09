# openclaw-a2a

**Democratize knowledge through AI-augmented human collaboration**

---

## Our Mission

Empower people around the world to share their knowledge and expertise, augmented by AI, making human wisdom accessible to everyone.

**AI does the grunt work. Humans add the wisdom. Knowledge flows freely.**

---

## The Vision

Sarah is a music teacher who loves helping students. She could traditionally tutor 10 people per week.

**With openclaw-a2a:**
- AI researches music theory questions
- Sarah reviews and adds her wisdom (5 minutes each)
- She now helps **60 students per week**
- All free or donation-based

**Sarah's impact: 6x**  
**Students helped: 6x**  
**Knowledge shared: 6x**  
**Cost: $0**

**That's what we're building.**

---

## What This Enables

### 1. Knowledge Sharing Across Instances
Your PM agent on Discord can learn from your Maestro agent on Telegram. Your agents become a **knowledge network**, not isolated islands.

### 2. Community Knowledge Commons
Experts volunteer their time. AI amplifies their impact. Seekers get great answers. Knowledge becomes accessible to everyone, everywhere.

### 3. AI-Augmented Expertise
- AI handles research, drafts, data collection (70-90% of work)
- Human experts add insight, judgment, wisdom (10-30% of work)
- Result: **10x more people helped** with the same expert time

---

## How It Works

```
Knowledge Seeker: "I need help with music theory"
         ↓
AI Agent Network:
├── Finds relevant expertise
├── Gathers context
└── Generates initial response
         ↓
Human Expert (optional):
├── Reviews AI response
├── Adds nuance and wisdom
└── Shares knowledge freely
         ↓
High-Quality Knowledge delivered
(AI research + human wisdom)
```

**Not:** Selling services  
**Instead:** Sharing knowledge freely

---

## Core Values

- **Knowledge is a commons** — Not a commodity, meant to be shared
- **AI amplifies human wisdom** — AI handles scale, humans add value
- **Community-driven** — Built by users, for users
- **Empowerment, not exploitation** — People choose what they share
- **Open by default** — Open protocols, not walled gardens

---

## Use Cases

### Learning & Education
**Traditional:** 1 tutor helps 5 students/week  
**AI-Augmented:** 1 mentor helps 30 students/week (AI provides explanations, human adds insights)

### Open Source Collaboration
**Traditional:** Maintainer reviews 10 PRs/week manually  
**AI-Augmented:** Reviews 60 PRs/week (AI checks style/bugs, human reviews architecture)

### Community Support
**Traditional:** Volunteer answers 20 questions/day  
**AI-Augmented:** Answers 100 questions/day (AI drafts, volunteer personalizes)

---

## Architecture

### Agent-Level Communication

**Not:** Instance-to-instance (discord-bot ↔ whatsapp-bot)  
**Instead:** Agent-to-agent (PM@discord ↔ PM@whatsapp)

Fine-grained, purposeful communication between specific agents.

```
┌─────────────────────────────────────────────┐
│  OpenClaw Instance (Discord)                │
│                                             │
│  Agents:                                    │
│  ├── 🎯 musicate-pm                         │
│  ├── 🎼 musicate-maestro                    │
│  ├── 🏗️ musicate-architect                 │
│  └── ...                                    │
│                                             │
│  ┌──────────────┐      ┌─────────────────┐ │
│  │   Gateway    │◄────►│  A2A Sidecar    │ │
│  │   :18789     │      │  :9100          │ │
│  └──────────────┘      └─────────────────┘ │
└─────────────────────────────────────────────┘
         ↕ A2A Protocol (agent-level)
┌─────────────────────────────────────────────┐
│  OpenClaw Instance (Telegram)               │
│                                             │
│  Agents:                                    │
│  ├── 💬 guali-main                          │
│  ├── 📊 trading-desk                        │
│  └── ...                                    │
└─────────────────────────────────────────────┘
```

Each agent publishes its own **Agent Card** with skills it can share.

---

## Roadmap

### Phase 1: Private Agent Network (10-12 days)
**Goal:** Connect agents across your own instances

**Features:**
- Agent-to-agent communication (not instance-level)
- Auto-discovery (scan network, show available agents)
- Conversational setup (chat with setup agent to configure)
- Security (private network, skill whitelist)

**Success:** PM@discord can coordinate with PM@telegram

---

### Phase 2: Community Knowledge Network (2-3 weeks)
**Goal:** Public knowledge sharing

**Features:**
- Public agent discovery
- Skill-based search
- Community contributions
- Reputation system

**Success:** 100 people helped through shared knowledge

---

### Phase 3: AI-Augmented Expertise (3-4 weeks)
**Goal:** Amplify human experts with AI

**Features:**
- Human-in-the-loop task routing
- Expert dashboard
- AI preprocessing + human refinement
- Community recognition
- Optional donations (Wikipedia model)

**Success:** 10 experts helping 10x more people

---

## Quick Start

*(Phase 1 — Coming Soon)*

**Step 1: Install**
```bash
clawhub install openclaw-a2a
```

**Step 2: Configure (Conversational)**
```
You: Help me set up A2A

Setup Agent: Scanning network...
             Found 3 instances with 8 agents
             
             On discord-bot:
             ├── 🎯 musicate-pm
             ├── 🎼 musicate-maestro
             └── 🏗️ musicate-architect
             
             Connect all PM agents? (Y/n)

You: Y

Setup Agent: ✅ Done! PM@discord can now talk to PM@telegram
```

**Step 3: Use It**
```
PM@discord: "Hey PM@telegram, what's the status?"
PM@telegram: "Paused for openclaw-a2a development"
PM@discord: "Same here. Coordinated!"
```

---

## Technical Details

### A2A Protocol
Based on the open **Agent-to-Agent (A2A)** standard (Linux Foundation, Google, IBM):
- Standard discovery (Agent Cards)
- JSON-RPC task execution
- SSE streaming for long tasks
- Universal interop (LangChain, CrewAI, Claude, Gemini, etc.)

### Security (Phase 1)
- **Network:** Private VPC (no public exposure)
- **Auth:** Bearer tokens per peer
- **Skills:** Whitelist (only exposed skills callable)
- **Behavioral:** Agent instructions prevent data leaks
- **Audit:** All A2A calls logged

### Implementation
- **Runtime:** Node.js 18+
- **Port:** 9100 (A2A standard)
- **Architecture:** Sidecar process (separate from OpenClaw gateway)
- **Service:** systemd unit file
- **SDK:** @a2a-protocol/sdk

---

## Project Structure

```
openclaw-a2a/
├── src/
│   ├── server.js       # A2A server (Agent Cards + JSON-RPC)
│   ├── client.js       # A2A client (outbound calls)
│   ├── bridge.js       # A2A ↔ OpenClaw gateway bridge
│   └── auth.js         # Bearer token authentication
├── scripts/
│   ├── setup.sh        # Automated installation
│   └── systemd/        # Service templates
├── config/
│   ├── a2a-peers.json  # Known peer agents
│   └── a2a-skills.json # Skills this instance exposes
├── docs/
│   ├── VISION.md                    # Mission and values
│   ├── SECURITY_ARCHITECTURE.md     # Network security
│   ├── AGENT_BEHAVIORAL_SECURITY.md # Prevent data leaks
│   ├── AGENT_TO_AGENT_DESIGN.md     # Agent-level communication
│   ├── HUMAN_IN_THE_LOOP.md         # Knowledge sharing model
│   └── PHASE_0_SUMMARY.md           # Complete project overview
├── tests/
│   ├── unit/
│   └── integration/
├── SKILL.md            # Agent instructions
├── package.json
└── LICENSE             # MIT
```

---

## Success Metrics

**We measure impact, not revenue:**

- **Phase 1:** Your agents share knowledge across instances
- **Phase 2:** 100 people helped through community knowledge
- **Phase 3:** 10 experts helping 10x more people

**North Star:** Lives impacted, knowledge shared, community growth

---

## Team

This is a **people-driven startup**. We focus on helping people, and money will follow if we do this right.

- **Main Agent:** SDK research, core implementation
- **PM:** Product vision, coordination, community messaging
- **Architect:** Code review, security design
- **QA:** Testing protocol, edge cases
- **Legal:** License review, compliance
- **Growth:** Launch strategy, community building

---

## Why This Matters

### For Knowledge Seekers
Access to expert knowledge, augmented by AI. Free or low-cost. Available 24/7, any language, any location.

### For Experts
Amplify your impact 10x. Help more people without burnout. Share wisdom, not just time.

### For Society
Democratize access to expertise. Break down knowledge barriers. Accelerate learning and innovation.

---

## How We Introduce Ourselves

**"We built openclaw-a2a to help people share knowledge, augmented by AI."**

**Not:** "We're building agent infrastructure"  
**Not:** "We're monetizing AI expertise"

**Instead:**
- "We're democratizing knowledge with AI"
- "We're helping experts help 10x more people"
- "We're building a knowledge commons, not a marketplace"

---

## Status

**Phase:** 0 ✅ Complete  
**Phase 1:** Starting soon (10-12 days)  
**Target Publish:** March 19-21, 2026

**Documents:** 12 comprehensive design docs  
**Commits:** 12  
**Status:** Ready for Phase 1 execution

---

## Links

- **GitHub:** https://github.com/paprini/openclaw-a2a
- **A2A Spec:** https://github.com/a2a-protocol/spec
- **A2A JS SDK:** https://github.com/a2a-protocol/a2a-js
- **OpenClaw:** https://openclaw.ai
- **ClawHub:** https://clawhub.com

---

## License

MIT

---

**This is a people-driven startup. Money will follow if we do this right.**

Let's build something that matters. 🚀
