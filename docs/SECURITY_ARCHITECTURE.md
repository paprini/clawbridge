# Security Architecture — clawbridge

## Critical Questions (From Pato)

### Q1: Data Leaks
**Question:** If agents are A2A-discoverable by anyone, how do we prevent data leaks?

### Q2: Access Control
**Question:** What if we don't want certain agents to talk to each other?

### Q3: Universal Discoverability
**Question:** How do we make an agent universally discoverable vs. private?

---

## Security Model Options

### Option A: Private Network (Trusted Peers Only)
**Model:** All agents are in a trusted network (VPC, VPN, or whitelist)

**Discovery:**
- Agent Card published at `/.well-known/agent-card.json`
- **BUT:** Only accessible from trusted network (firewall/security group)
- Peers are manually configured in `config/peers.json`

**Authentication:**
- Shared bearer token per peer
- Each peer has a unique token
- No token = rejected at API gateway

**Data Protection:**
- Agents can only talk to peers in `peers.json`
- No data exposed to public internet
- Network-level isolation (VPC)

**Pros:**
- ✅ Maximum security
- ✅ No accidental exposure
- ✅ Simple to implement

**Cons:**
- ❌ Not universally discoverable
- ❌ Requires manual peer config
- ❌ Can't talk to external A2A agents (LangChain, etc.)

**Use case:** Guali family (Discord, WhatsApp, Telegram) — trusted network

---

### Option B: Public with Allowlist
**Model:** Agent Card is publicly accessible, but tasks require authorization

**Discovery:**
- Agent Card publicly accessible (anyone can see what skills you have)
- **BUT:** Executing tasks requires bearer token
- Token = proof of authorization

**Authentication:**
- Public bearer tokens (like API keys)
- Each external agent gets a unique token
- Token has permissions: `["read", "send_message", "execute_task"]`

**Data Protection:**
- Agent Card shows capabilities, NOT data
- Actual task execution requires valid token
- Token can be revoked
- Rate limiting per token

**Pros:**
- ✅ Universally discoverable
- ✅ Can interop with external agents
- ✅ Fine-grained permissions

**Cons:**
- ❌ Agent Card metadata is public (skills, version, etc.)
- ❌ More complex auth system
- ❌ Risk of token leak

**Use case:** Public A2A agent (e.g., "Musicate QA agent" that other devs can query)

---

### Option C: Hybrid (Private by Default, Opt-In Public)
**Model:** Private network by default, with opt-in public exposure

**Discovery:**
- **Private mode (default):** Agent Card only accessible from VPC
- **Public mode (opt-in):** Agent Card published to A2A registry

**Authentication:**
- **Private peers:** Mutual shared tokens (pre-configured)
- **Public access:** Public bearer tokens with scoped permissions

**Data Protection:**
- Agent decides what to expose publicly vs. privately
- Public Agent Card has limited skill list
- Private Agent Card has full capabilities
- Public tasks: limited scope (e.g., "query_status" only)
- Private tasks: full access (e.g., "send_message", "execute_code")

**Pros:**
- ✅ Best of both worlds
- ✅ Secure by default
- ✅ Can opt-in to public when needed

**Cons:**
- ❌ Most complex to implement
- ❌ Two auth systems
- ❌ Potential for misconfiguration

**Use case:** Guali family (private) + Musicate public beta testing agent (public)

---

## Recommended Approach for MVP

### **Phase 1 (MVP): Option A — Private Network**

**Why:**
1. **Your use case:** Guali family (3 instances) — all trusted
2. **Simplest:** No public exposure, no complex auth
3. **Fastest:** Can ship in 10 days
4. **Secure by default:** No risk of data leak

**Implementation:**
```
┌──────────────────────────────────────────────────┐
│  AWS VPC (Private Network)                       │
│                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────┐│
│  │ Discord     │  │ WhatsApp    │  │ Telegram ││
│  │ :9100       │  │ :9100       │  │ :9100    ││
│  └─────────────┘  └─────────────┘  └──────────┘│
│         ↕                 ↕                ↕     │
│    Private IPs: 10.0.1.10, 10.0.1.11, 10.0.1.12 │
│                                                  │
│  Security Group: Allow port 9100 from VPC only  │
└──────────────────────────────────────────────────┘
         ↕
   Public Internet: NO ACCESS to :9100
```

**Security:**
- Firewall: Port 9100 only accessible from VPC
- Auth: Shared bearer token (one token for all 3 instances)
- Config: `peers.json` has hardcoded peer list
- Discovery: Manual (no auto-discovery)

**Access Control:**
- "Don't want agents to talk?" → Remove from `peers.json`
- "Data leak?" → Impossible (no public access)
- "Universal discovery?" → Not in MVP (Phase 2 feature)

---

### **Phase 2 (Future): Option C — Hybrid**

**When:** After MVP proven, if we need public agents

**Use case:** Musicate launches → public "Musicate QA Agent" that other devs can query

**Example:**
- `musicate-qa.openclaw.ai:9100` → publicly accessible
- Agent Card: `{"skills": ["query_bug_status", "search_docs"]}`
- Auth: Public bearer token (scoped permissions)
- No access to internal data (GualiShares, personal convos)

---

## Answers to Your Questions

### Q1: How do we ensure no data leaks?

**Answer (MVP):** **Network isolation + no public exposure**

1. **Port 9100 not exposed to internet** (security group)
2. **Only accessible from VPC** (private IPs)
3. **Agent Card doesn't contain sensitive data** (only capabilities)
4. **Tasks require bearer token** (pre-shared, not guessable)

**What if token leaks?**
- Rotate token → update `config/peers.json` on all 3 instances
- Temp workaround: Restart sidecar with new token

**Future (Phase 2):**
- mTLS (mutual TLS certificates)
- Token rotation automation
- Audit logs (who called what, when)

---

### Q2: What if we don't want agents to talk?

**Answer (MVP):** **Remove from peers.json**

**Example:**
```json
// Discord's config/peers.json
{
  "peers": [
    {
      "id": "whatsapp",
      "name": "Guali WhatsApp",
      "url": "http://10.0.1.11:9100",
      "token": "bearer_token_whatsapp",
      "enabled": true
    },
    {
      "id": "telegram",
      "name": "Guali Telegram",
      "url": "http://10.0.1.12:9100",
      "token": "bearer_token_telegram",
      "enabled": false  // ← DISABLED
    }
  ]
}
```

**If Discord shouldn't talk to Telegram:**
- Set `"enabled": false`
- OR remove entry entirely
- Restart sidecar: `sudo systemctl restart clawbridge`

**Future (Phase 2):**
- Dynamic peer management via API
- Per-skill permissions (e.g., "WhatsApp can only call `send_message`, not `execute_code`")

---

### Q3: How do we make an agent universally discoverable?

**Answer (MVP):** **You don't.** Private network only.

**Answer (Phase 2):** **Opt-in public exposure**

**Options for Phase 2:**

#### Option 3a: A2A Registry
- Publish to central A2A registry (e.g., `a2a.directory`)
- Agent Card becomes publicly searchable
- Example: "Search for agents that can analyze music"
- Registry returns: `musicate-qa.openclaw.ai:9100`

#### Option 3b: DNS + Well-Known URL
- Public DNS: `musicate-qa.openclaw.ai`
- Agent Card at: `https://musicate-qa.openclaw.ai/.well-known/agent-card.json`
- Anyone can fetch and discover capabilities
- Tasks still require bearer token

#### Option 3c: Discord/Slack Bot Marketplace
- Publish to app marketplace
- Users install "Musicate QA Agent" → get bearer token
- Token scoped to public skills only

**For now (MVP):** Skip universal discovery. Solve internal use case first.

---

## Security Checklist (MVP)

### Network Security
- [ ] Port 9100 only accessible from VPC (security group)
- [ ] No public IP for A2A sidecar
- [ ] Firewall rules tested (try accessing from internet → should fail)

### Authentication
- [ ] Bearer token generated (random, 32+ chars)
- [ ] Token stored in `.env` (not in code)
- [ ] Token shared with peers via secure channel (not Discord/Telegram chat)
- [ ] Token rotation documented (how to update if leaked)

### Data Protection
- [ ] Agent Card doesn't expose sensitive data (no personal info, credentials)
- [ ] Agent Card only lists skills (not data, not keys)
- [ ] Task responses don't leak internal paths, IPs, tokens
- [ ] Error messages don't reveal system details

### Access Control
- [ ] `peers.json` only contains trusted instances
- [ ] Each peer has unique token (or at least document single-token risk)
- [ ] Disabled peers actually rejected (test with `enabled: false`)

### Audit & Monitoring
- [ ] Sidecar logs all incoming requests (who called what)
- [ ] Failed auth attempts logged
- [ ] Alerting on suspicious activity (e.g., 10+ failed auth in 1 min)

---

## Recommendations for Phase 0

### Immediate Decisions Needed:

1. **✅ DECISION: MVP is Private Network (Option A)**
   - Rationale: Your use case (Guali family), simplest, fastest, most secure
   - Timeline: Fits 10-day window
   - Future: Can add public mode later

2. **✅ DECISION: Single shared token for MVP**
   - Rationale: Only 3 trusted instances, simpler config
   - Risk: If one instance compromised, rotate token on all 3
   - Future: Unique token per peer in Phase 2

3. **✅ DECISION: Manual peer config (no auto-discovery)**
   - Rationale: Only 3 instances, rarely changes
   - Future: Auto-discovery in Phase 2 if needed

4. **⏳ DECISION NEEDED: Agent Card schema**
   - Question: What skills do we expose in Agent Card?
   - Options:
     - A) Full list (send_message, search, execute_task, etc.)
     - B) Minimal (ping, status only)
   - Recommendation: **B (minimal) for MVP** — expand later

5. **⏳ DECISION NEEDED: Task permission model**
   - Question: Can any peer execute any task? Or permission per task?
   - Options:
     - A) All-or-nothing (peer can do everything)
     - B) Per-task permissions (send_message: yes, execute_code: no)
   - Recommendation: **A for MVP** — all peers trusted

---

## Next Steps

1. **PM (me):** Document these decisions in `DECISIONS.md`
2. **Main Agent:** Design Agent Card schema (minimal skills for MVP)
3. **Architect:** Review security model, approve or suggest changes
4. **QA:** Add security tests to test plan (unauthorized access, token leak simulation)

---

**Does this address your concerns? Any other security questions?**
