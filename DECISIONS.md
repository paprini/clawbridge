# Decision Log — openclaw-a2a

## 2026-03-09

### Project Pivot
- **Decision:** Pause Musicate, prioritize openclaw-a2a
- **Rationale:** First community contribution, establishes credibility with OpenClaw ecosystem
- **Impact:** Timeline: 10-12 days to publish

### GitHub Repository
- **Decision:** New repo (not musicate-mvp)
- **Name:** `openclaw-a2a` (TBD: user/org)
- **Rationale:** Separate project, separate audience, cleaner history

### A2A SDK
- **Decision:** Use official @a2a-protocol/sdk (JavaScript)
- **Rationale:**
  - Native to OpenClaw (Node.js)
  - No extra runtime dependencies
  - Standard protocol compliance
  - Active maintenance by A2A community
- **Alternative considered:** Custom REST API (rejected — not standard)

### Architecture: Sidecar Process
- **Decision:** Separate sidecar process on port 9100
- **Rationale:**
  - Clean separation from OpenClaw gateway
  - Can be restarted independently
  - Doesn't interfere with gateway lifecycle
  - Standard A2A port convention
- **Alternative considered:** Embedded in gateway (rejected — too coupled)

### Testing Strategy
- **Decision:** Use existing 3 instances (Discord, WhatsApp, Telegram) for integration testing
- **Rationale:**
  - Real production-like environment
  - Already configured and running
  - Immediate validation of cross-instance communication
  - No additional infra cost
- **Risk:** Testing on production instances (mitigated by careful rollout)
- **Alternative:** Spin up separate test instances (rejected — added complexity, cost)

### Authentication Model
- **Decision:** Bearer token for MVP (v1)
- **Rationale:**
  - Simple to implement
  - Adequate for trusted peer networks
  - Fast to test
- **Future:** mTLS for production deployments (Phase 2)

### Node.js Runtime
- **Decision:** Require Node.js 18+
- **Rationale:**
  - OpenClaw already requires Node.js
  - No additional dependency
  - Modern JS features (fetch, async/await, etc.)

### systemd Service
- **Decision:** Provide systemd unit file template
- **Rationale:**
  - Standard on Linux (EC2, VPS)
  - Auto-restart on failure
  - Logs to journalctl
  - Easy enable/disable

---

## Open Questions

### Q1: A2A SDK Installation
- **Question:** Install @a2a-protocol/sdk globally or per-skill?
- **Options:**
  - A) Global npm install (simpler, one copy)
  - B) Local to skill workspace (isolated, version control)
- **Recommendation:** **B (local)** — isolation > convenience
- **Next:** Test npm install in skill directory

### Q2: Agent Card Generation
- **Question:** Static JSON file or dynamically generated?
- **Options:**
  - A) Static config/agent-card.json
  - B) Generated from OpenClaw gateway state
- **Recommendation:** **B (dynamic)** — reflects actual capabilities
- **Next:** Architect to design generator function

### Q3: Peer Discovery
- **Question:** Manual config or auto-discovery?
- **Options:**
  - A) Manual peers.json (known peers)
  - B) Broadcast discovery (mDNS, etc.)
- **Recommendation:** **A (manual) for MVP** — simpler, more secure
- **Future:** Auto-discovery in v2

### Q4: Bridge Error Handling
- **Question:** Retry strategy for failed OpenClaw gateway calls?
- **Options:**
  - A) Fail fast (return error to A2A caller)
  - B) Retry with exponential backoff
- **Recommendation:** **A for MVP** — simpler, caller can retry
- **Next:** Document retry behavior in SKILL.md

### Q5: Logging Strategy
- **Question:** Where do A2A sidecar logs go?
- **Options:**
  - A) stdout/stderr → systemd journal
  - B) Separate log file
  - C) OpenClaw gateway logs
- **Recommendation:** **A (systemd journal)** — standard, queryable
- **Command:** `journalctl -u openclaw-a2a -f`

---

## Decisions Needed (Blockers)

None currently. All critical path decisions made.

---

## Notes

- All code in **English** (per Pato's directive)
- Comments, docs, variable names: English only
- Error messages: English (can i18n later if needed)
