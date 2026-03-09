# ClawBridge Repository Access Options

**Current status:** Private repo at https://github.com/paprini/openclaw-a2a

**For new user testing, choose one:**

---

## Option 1: Make Repository Public ✅ RECOMMENDED

**Pros:**
- Zero friction for testing
- Anyone can clone and install
- Marketing-ready ("just install from GitHub")
- Standard open source distribution

**Cons:**
- Code is public (but that's the plan for community launch anyway)

**How:**
```bash
gh repo edit paprini/openclaw-a2a --visibility public
```

**Rename while public:**
```bash
gh repo rename paprini/openclaw-a2a clawbridge
```

**Result:** https://github.com/paprini/clawbridge (public)

---

## Option 2: Add Test Users as Collaborators

**Pros:**
- Keeps repo private during testing
- Control who has access

**Cons:**
- Each test user needs GitHub account
- Must manually add each collaborator
- Agent needs GitHub auth (PAT or SSH key)
- Friction in onboarding

**How:**
```bash
gh repo add-collaborator paprini/openclaw-a2a @username
```

---

## Option 3: Beta Access with Private Link

**Pros:**
- Private but shareable
- No per-user management

**Cons:**
- Not standard open source flow
- Still requires auth

**How:**
- Generate personal access token (PAT) with repo access
- Share clone URL with token:
  ```
  git clone https://TOKEN@github.com/paprini/openclaw-a2a.git
  ```

---

## Recommendation: Option 1 (Public)

**Why:**
- ClawBridge is intended for community launch
- Testing with real users requires public access
- "Marketing-ready" means zero friction
- Standard open source distribution

**Timeline:**
1. Now: Make repo public
2. Now: Rename to "clawbridge"
3. Test: Agent onboarding with natural language prompt
4. After testing: Announce to OpenClaw community

**Command:**
```bash
gh repo edit paprini/openclaw-a2a --visibility public
gh repo rename paprini/openclaw-a2a clawbridge
```

**Result:** https://github.com/paprini/clawbridge (public, ready for testing)
