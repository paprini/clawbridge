# PM Recommendations — openclaw-a2a

## Phase 0 Decisions & Recommendations

---

## ✅ DECISION: A2A SDK Installation Strategy

**Recommendation:** **Local installation** (per-skill workspace)

### Why Local?
1. **Version control:** Each skill controls its SDK version
2. **Isolation:** No conflicts with other skills
3. **Portability:** `npm install` in skill directory = done
4. **Standard practice:** Node.js best practice for project dependencies

### Implementation:
```bash
cd /home/guali/openclaw-a2a
npm install @a2a-protocol/sdk express body-parser dotenv axios
```

**Alternative rejected:** Global npm install  
**Why:** Version conflicts, harder to reproduce environment, not portable

---

## ✅ DECISION: Testing Strategy

**Recommendation:** **Use existing 3 instances** for integration testing

### Test Environment:
- **Discord instance** (EC2 — this machine): 10.0.1.10:9100
- **WhatsApp instance** (EC2): 10.0.1.11:9100 (assumed)
- **Telegram instance** (EC2): 10.0.1.12:9100 (assumed)

### Why Existing Instances?
1. **Real production-like environment**
2. **Already configured and running**
3. **Zero additional infra cost**
4. **Validates actual use case** (GualiShares replacement)
5. **Immediate value** — if it works, we can use it right away

### Rollout Plan:
1. **Phase 3 Week 1:** Deploy to Discord (this instance) only — validate sidecar works
2. **Phase 3 Week 2:** Deploy to WhatsApp — test cross-instance communication
3. **Phase 3 Week 3:** Deploy to Telegram — test 3-way mesh

### Risk Mitigation:
- **Sidecar runs on separate port** (9100) — doesn't interfere with gateway
- **Can be stopped independently** — no impact on main OpenClaw function
- **Bearer token auth** — unauthorized agents can't connect
- **Rollback:** `sudo systemctl stop openclaw-a2a` — back to GualiShares

**Alternative rejected:** Spin up separate test instances  
**Why:** Added complexity, cost ($30-50/month), slower iteration

---

## 📋 Phase 0 Checklist (Status)

- [x] Project plan created (`tasks/todo.md` in main agent workspace)
- [x] PM activated (me)
- [x] Broadcast to family (Musicate paused)
- [x] Workspace structure created (`/home/guali/openclaw-a2a/`)
- [x] Initial decisions documented (`DECISIONS.md`)
- [x] Git repository initialized
- [ ] **NEXT:** A2A SDK research (Main Agent)
- [ ] **NEXT:** Create GitHub repo
- [ ] **NEXT:** Define scope (what's v1, what's later)

---

## 🚀 Next Actions (Priority Order)

### 1. **Main Agent: A2A SDK Deep Dive** (1-2 hours)
**Task:** Research `@a2a-protocol/sdk` capabilities
**Questions to answer:**
- What's included in the SDK?
- Agent Card schema — required vs optional fields
- JSON-RPC methods — which are mandatory?
- Streaming support — how does SSE work?
- Auth model — bearer token flow
- Error handling — what error codes are defined?

**Output:** Architecture decisions doc

### 2. **PM: Create GitHub Repo** (15 minutes)
**Name:** `openclaw-a2a`
**Owner:** Pato's account (paprini) OR create openclaw-team org?
**Steps:**
1. Go to https://github.com/new
2. Name: `openclaw-a2a`
3. Description: "Agent-to-Agent communication for OpenClaw"
4. Private (for now, public at publish)
5. Initialize: NO (we have local repo already)
6. Create repo
7. Push local commit

**Command:**
```bash
cd /home/guali/openclaw-a2a
git remote add origin https://${GITHUB_TOKEN}@github.com/paprini/openclaw-a2a.git
git branch -M main
git push -u origin main
```

### 3. **Architect: Review Architecture Proposal** (1 hour)
**Task:** Review sidecar vs embedded decision
**Questions:**
- Port 9100 — any conflicts?
- systemd service — best practices?
- Bridge design — latency concerns?
- Security — bearer token sufficient for MVP?

**Output:** Architecture approval OR suggested changes

### 4. **QA: Test Planning** (2 hours)
**Task:** Draft test plan for Phase 3
**Scope:**
- Unit tests (src/ modules)
- Integration tests (cross-instance)
- Stress tests (rapid fire messages)
- Security tests (unauthorized access)

**Output:** `tests/TEST_PLAN.md`

---

## 📊 Timeline Confidence

**Phase 0:** ✅ ON TRACK (complete today)

**Phase 1 (2 days):** HIGH confidence
- A2A SDK research is straightforward
- Architecture decisions mostly made
- Main blockers resolved

**Phase 2 (3-4 days):** MEDIUM confidence
- SDK integration unknown complexity
- Bridge design may need iteration
- Potential SDK bugs/quirks

**Phase 3 (2-3 days):** MEDIUM confidence
- Depends on AWS network config (VPC, security groups)
- Cross-instance testing may reveal edge cases
- Debugging distributed systems can be time-consuming

**Phase 4-5 (2-3 days):** HIGH confidence
- Documentation is well-scoped
- Polish is predictable

**Overall:** **10-12 days realistic** with 2-day buffer for unknowns

---

## 🎯 Success Metrics

### Phase 0 (Today):
- [x] Workspace created
- [x] Initial docs written
- [x] Decisions logged
- [ ] GitHub repo created
- [ ] Main agent has SDK research started

### Phase 1 (2 days):
- [ ] Architecture doc complete
- [ ] Agent Card schema defined
- [ ] Security model documented
- [ ] All agents reviewed and approved

### Phase 2 (3-4 days):
- [ ] A2A server responds to Agent Card requests
- [ ] A2A client can call peer agents
- [ ] Bridge translates A2A ↔ OpenClaw gateway
- [ ] Unit tests pass

### Phase 3 (2-3 days):
- [ ] Deployed on all 3 instances
- [ ] Discord → WhatsApp message delivered <1 second
- [ ] Agent Card discovery working
- [ ] Security audit passed (no unauthorized access)

### Phase 4-5 (2-3 days):
- [ ] README is beautiful and clear
- [ ] `clawhub install openclaw-a2a && ./setup.sh` works
- [ ] Published to ClawHub
- [ ] Announcement posted

---

## 💰 Budget & Resources

**Infrastructure:**
- $0 additional (using existing EC2 instances)

**Time:**
- Main Agent: ~40-60 hours (architecture + implementation + testing)
- PM: ~10-15 hours (coordination + tracking)
- Architect: ~5-8 hours (code review + design review)
- QA: ~8-12 hours (test planning + execution)
- Legal: ~1-2 hours (license review)
- Growth: ~2-4 hours (launch strategy)

**Total team effort:** ~70-100 hours over 10-12 days

---

## 🔥 Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| A2A SDK bugs/gaps | Medium | High | Research early (Phase 0/1), have fallback plan |
| Cross-instance networking issues | Medium | Medium | Test early in Phase 3 Week 1 |
| Agent Card discovery complexity | Low | Medium | Start simple (manual config), iterate later |
| Security vulnerabilities | Low | High | Security audit in Phase 3, external review |
| Timeline slip (unknown unknowns) | Medium | Low | Built-in 2-day buffer |

---

## ✅ Sign-Off

**PM Assessment:** Project is well-scoped, timeline realistic, team aligned.

**Recommendation:** **GREEN LIGHT — Proceed to Phase 1**

---

_Last updated: 2026-03-09 16:00 UTC_
