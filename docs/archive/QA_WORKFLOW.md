# QA Workflow — Review After Each Kiro Delivery

**QA Agent:** example-project-qa  
**When:** After Kiro completes each task/feature  
**How:** PM spawns QA with specific focus

---

## Process

### **1. Kiro Finishes a Feature**
Example: Docker support complete

### **2. PM Spawns QA**
```
Task: Review Docker implementation
- Test docker-compose.yml
- Verify health checks work
- Test container-to-container communication
- Check for edge cases
```

### **3. QA Reviews & Tests**
**Deliverables:**
- Test the feature manually
- Run automated tests (if any)
- Document findings in sharechat.md (short format)
- Flag issues (CRITICAL / HIGH / MEDIUM / LOW)

**Post in sharechat.md:**
```
## [Date Time] QA → PM

Status: Reviewed Docker implementation.

Tested:
- docker-compose up ✅
- Health checks ✅
- Container-to-container ping ✅

Issues:
- [None / List them]

Recommendation: [Ship it / Fix X first]
```

### **4. PM Coordinates**
- If issues: Kiro fixes
- If clean: Move to next feature

---

## What QA Checks

### **Functional Testing**
- Does it work as specified?
- Edge cases handled?
- Error messages clear?

### **Integration Testing**
- Works with existing code?
- No regressions?
- Cross-environment (bare metal + Docker)?

### **Security**
- Auth enforced?
- Input validation?
- No data leaks?

### **Usability**
- Setup clear?
- Error messages helpful?
- Docs match reality?

---

## QA Schedule (Phase 1)

### **After Docker Complete** ← NEXT
- Test Dockerfile builds
- Test docker-compose works
- Test two containers talking
- Test health checks

### **After Setup Agent Complete**
- Test conversational flow
- Test auto-discovery
- Test manual config fallback
- Test error handling

### **Before Ship (Final QA)**
- Full end-to-end test
- Install on fresh machine
- Follow README from scratch
- Test all documented features
- Regression test (all tests still pass)

---

## QA Philosophy

**We're moving fast. Focus on:**
- Blockers (will this break for users?)
- Security (could this leak data?)
- UX (will users be confused?)

**Don't focus on:**
- Perfect code style
- Minor UI polish
- Features not promised

**Goal:** Ship working, secure, usable software fast.

---

## Communication Format

**In sharechat.md (keep it short):**
```
## [Date Time] QA → PM

Tested: [Feature name]

Results:
✅ Thing 1
✅ Thing 2
❌ Thing 3 (severity: HIGH)

Recommendation: [Ship / Fix X / Needs discussion]
```

**If critical issues:**
```
## [Date Time] QA → PM + Kiro

CRITICAL: [Issue description]

Impact: [What breaks]
Reproduce: [Steps]
Recommend: [Fix approach]

Blocking ship: YES
```

---

## Current Status

**Waiting for:** Docker completion (Kiro working on it now)  
**Next QA task:** Review Docker when Kiro finishes  
**PM will spawn:** QA agent when Docker is ready

---

_This workflow ensures quality without slowing down shipping._
