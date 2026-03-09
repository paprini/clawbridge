# Contributing to openclaw-a2a

**Welcome!** We're building agent-to-agent communication for OpenClaw, and we'd love your help.

---

## Quick Start

### 1. **Read the Vision**
Start here: [README.md](README.md)

**TL;DR:** We're democratizing knowledge through AI-augmented human collaboration. This project lets OpenClaw agents share skills across instances.

### 2. **Understand What We're Building**
- **Phase 1 (NOW):** Private agent network (connect your own instances)
- **Phase 2:** Public agent marketplace
- **Phase 3:** Human-in-the-loop knowledge sharing

### 3. **Check Project Status**
See [PROJECT_STATUS.md](PROJECT_STATUS.md) for:
- What's done
- What's in progress
- What needs help

### 4. **Set Up Development**
See [GETTING_STARTED.md](GETTING_STARTED.md) for:
- Dev environment setup
- How to run tests
- How to test locally

---

## What Needs Help (Phase 1)

### **High Priority**

#### 1. **Core Implementation**
**Status:** Starting  
**Who:** Main Agent (lead) + external contributors  
**Files:** `src/server.js`, `src/client.js`, `src/bridge.js`, `src/auth.js`

**What to build:**
- A2A server (Express + SDK middleware)
- A2A client (outbound calls to peers)
- Bearer token authentication
- Config file loading

**See:** [PHASE_1_PLAN.md](PHASE_1_PLAN.md) for detailed implementation plan

---

#### 2. **Setup Agent (Conversational Configuration)**
**Status:** Designed, not implemented  
**Who:** Needs contributor  
**Files:** `src/setup-agent.js`, `config/templates/`

**What to build:**
- Conversational setup flow (see [SETUP_AGENT_V2.md](SETUP_AGENT_V2.md))
- Auto-discovery (network scanning)
- Manual peer configuration (fallback for Docker)
- Skill whitelist configuration

**Skills needed:** Node.js, conversational UX, network programming

---

#### 3. **Docker Support**
**Status:** Designed, not implemented  
**Who:** Needs contributor  
**Files:** `docker-compose.yml`, `Dockerfile`, `scripts/entrypoint.sh`

**What to build:**
- docker-compose examples (host + bridge network)
- Dockerfile with supervisord
- Health check endpoints
- Documentation for containerized deployments

**See:** [DOCKER_CONSIDERATIONS.md](DOCKER_CONSIDERATIONS.md)

**Skills needed:** Docker, networking, process management

---

#### 4. **Testing**
**Status:** Test plan in progress (QA agent)  
**Who:** Needs contributor  
**Files:** `tests/unit/`, `tests/integration/`

**What to build:**
- Unit tests (server, client, auth)
- Integration tests (two-agent communication)
- Docker tests (container-to-container, container-to-host)
- Security tests (auth, skill whitelist)

**See:** `tests/TEST_PLAN.md` (coming soon from QA agent)

**Skills needed:** Jest/Mocha, integration testing, Docker testing

---

#### 5. **Documentation**
**Status:** Partially done  
**Who:** Needs contributor  
**Files:** `docs/quickstart.md`, `docs/architecture.md`, `docs/security.md`

**What to write:**
- Quickstart guide (5-minute setup)
- Architecture deep dive
- Security best practices
- Troubleshooting guide
- API reference (Agent Card schema, JSON-RPC methods)

**Skills needed:** Technical writing, clarity

---

### **Medium Priority**

#### 6. **systemd Service Template**
**Status:** Designed, not implemented  
**Who:** Needs contributor  
**Files:** `scripts/systemd/openclaw-a2a.service`

**What to build:**
- systemd unit file
- Installation script
- Auto-restart configuration
- Logging setup

**Skills needed:** systemd, bash scripting

---

#### 7. **Health Check & Monitoring**
**Status:** Not started  
**Who:** Needs contributor  
**Files:** `src/health.js`, `src/metrics.js`

**What to build:**
- `/health` endpoint (uptime, peer status)
- Prometheus metrics (optional)
- Logging (structured logs)

**Skills needed:** Node.js, monitoring, observability

---

#### 8. **Examples**
**Status:** Not started  
**Who:** Needs contributor  
**Files:** `examples/basic-server/`, `examples/multi-instance/`

**What to build:**
- Minimal A2A server (20 lines of code)
- Two-instance communication demo
- Docker compose example (working demo)

**Skills needed:** Node.js, Docker, clear documentation

---

## How to Contribute

### **Step 1: Pick a Task**
- Check [PROJECT_STATUS.md](PROJECT_STATUS.md) for "Needs Help" items
- Or check GitHub Issues (if we create them)
- Or propose something new (open an issue first)

### **Step 2: Read Relevant Docs**
**Before starting, read:**
- [PHASE_1_PLAN.md](PHASE_1_PLAN.md) — Implementation plan
- [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) — Security model
- [AGENT_CARD_SCHEMA.md](AGENT_CARD_SCHEMA.md) — Agent Card structure
- [SDK_NOTES.md](SDK_NOTES.md) — How the A2A SDK works

**If working on Docker:**
- [DOCKER_CONSIDERATIONS.md](DOCKER_CONSIDERATIONS.md)

**If working on setup agent:**
- [SETUP_AGENT_V2.md](SETUP_AGENT_V2.md)

### **Step 3: Set Up Dev Environment**
See [GETTING_STARTED.md](GETTING_STARTED.md)

### **Step 4: Make Your Changes**
- Write code
- Add tests
- Update docs
- Commit with clear messages

### **Step 5: Submit**
**For external contributors:**
- Fork the repo
- Create a branch (`feature/setup-agent`, `fix/docker-health-check`)
- Submit a PR with description

**For team agents:**
- Push directly to `main` or create a branch
- Announce in Discord #lounge or #pm

---

## Code Style

### **JavaScript/Node.js**
- ES6+ syntax
- Use `async/await` (not callbacks)
- Descriptive variable names (`agentId`, not `a`)
- JSDoc comments for public functions
- No global variables

**Example:**
```javascript
/**
 * Validates a bearer token against configured peers.
 * @param {string} token - The bearer token to validate
 * @returns {Promise<string|null>} Peer ID if valid, null otherwise
 */
async function validateToken(token) {
  const peer = peers.find(p => p.token === token);
  return peer ? peer.id : null;
}
```

### **Documentation**
- Markdown for all docs
- Clear headings (## for sections, ### for subsections)
- Code examples in triple backticks with language
- Use ✅ ❌ for pros/cons
- Use 🎯 📊 🔒 for visual emphasis (sparingly)

### **Git Commits**
**Format:**
```
Short summary (50 chars or less)

Longer explanation if needed. Wrap at 72 chars.

- Bullet points for multiple changes
- Reference issues/PRs if relevant

Why this change matters (optional but helpful).
```

**Example:**
```
Add Docker health check endpoint

- Create /health endpoint in server.js
- Return uptime and peer connectivity status
- Add Docker healthcheck to compose file

This enables container orchestration (K8s, Swarm) to
detect when A2A sidecar is unhealthy and restart.
```

---

## Testing Guidelines

### **Write Tests For:**
- All new features
- Bug fixes
- Security-critical code (auth, skill whitelist)

### **Test Structure:**
```javascript
describe('BearerTokenAuth', () => {
  describe('validateToken', () => {
    it('should return peer ID for valid token', async () => {
      const peerId = await auth.validateToken('a2a_shared_abc123');
      expect(peerId).toBe('openclaw-telegram');
    });
    
    it('should return null for invalid token', async () => {
      const peerId = await auth.validateToken('invalid');
      expect(peerId).toBeNull();
    });
  });
});
```

### **Run Tests:**
```bash
npm test                 # All tests
npm test -- --watch     # Watch mode
npm test -- auth.test.js # Single file
```

---

## Security Guidelines

**CRITICAL:** This project handles cross-agent communication. Security matters.

### **Always:**
- ✅ Validate all inputs (tokens, URLs, skill names)
- ✅ Use bearer tokens for authentication
- ✅ Enforce skill whitelist (never expose unintended skills)
- ✅ Log all A2A calls (audit trail)
- ✅ Default to private network (VPC-only, no public access)

### **Never:**
- ❌ Trust data from remote agents without validation
- ❌ Expose skills not explicitly whitelisted
- ❌ Log bearer tokens or sensitive data
- ❌ Execute arbitrary code from A2A requests
- ❌ Bypass authentication "for convenience"

### **Review Required For:**
- Auth code changes
- Skill exposure logic
- Network configuration
- Input validation

---

## Documentation Requirements

**Every PR should include:**
- Code comments (for non-obvious logic)
- README updates (if adding new features)
- CHANGELOG entry (if user-facing change)
- Test coverage (for new code)

**Bonus points:**
- Examples in `examples/`
- Troubleshooting guide updates
- Architecture diagram updates (Mermaid)

---

## Communication

### **For Team Agents:**
- **Discord #lounge** — General project updates
- **Discord #pm** — Coordination, decisions, blockers
- **GitHub commits** — Code + docs

### **For External Contributors:**
- **GitHub Issues** — Bug reports, feature requests
- **GitHub PRs** — Code contributions
- **GitHub Discussions** (if we enable it) — Questions, ideas

---

## Project Values

We're building this **community-first**:
- **Open by default** — Open source, open collaboration
- **Documentation matters** — Code is read more than written
- **Security is not optional** — Default to safe, opt-in to risk
- **Simplicity over cleverness** — Readable > terse
- **Help others learn** — Explain the "why", not just the "what"

**If in doubt, ask.** Better to clarify than to build the wrong thing.

---

## Resources

### **Project Docs**
- [README.md](README.md) — Project overview
- [VISION.md](VISION.md) — Mission and values
- [PHASE_0_SUMMARY.md](PHASE_0_SUMMARY.md) — How we got here
- [PHASE_1_PLAN.md](PHASE_1_PLAN.md) — What we're building now
- [PROJECT_STATUS.md](PROJECT_STATUS.md) — Current status

### **Technical Docs**
- [SDK_NOTES.md](SDK_NOTES.md) — A2A SDK deep dive
- [AGENT_CARD_SCHEMA.md](AGENT_CARD_SCHEMA.md) — Agent Card structure
- [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) — Security model
- [DOCKER_CONSIDERATIONS.md](DOCKER_CONSIDERATIONS.md) — Container support
- [SETUP_AGENT_V2.md](SETUP_AGENT_V2.md) — Conversational setup design

### **External Links**
- **A2A Spec:** https://github.com/a2aproject/spec
- **A2A JS SDK:** https://github.com/a2aproject/a2a-js
- **OpenClaw:** https://openclaw.ai
- **ClawHub:** https://clawhub.com

---

## Questions?

**Team agents:** Ask in Discord #pm  
**External contributors:** Open a GitHub issue or discussion

---

**Thank you for helping democratize knowledge through AI-augmented collaboration!** 🚀
