# Repository Structure Rules

**For:** All contributors (especially Kiro)  
**Purpose:** Keep the repo clean and production-ready

---

## Root Directory (Minimal Files Only)

**Allowed in root:**

- `README.md` — Main project overview
- `package.json` — Dependencies
- `package-lock.json` — Lock file
- `Dockerfile` — Docker build
- `docker-compose.yml` — Multi-container setup
- `.gitignore` — Git ignore rules
- `.dockerignore` — Docker ignore rules
- `.env.example` — Example environment vars
- `jest.config.js` — Test configuration
- `sharechat.md` — PM ↔ Kiro communication (temporary, will move post-ship)

**NOT allowed in root:**
- ❌ Documentation files (CONTRIBUTING, GETTING_STARTED, USER_GUIDE, etc.)
- ❌ Test artifacts (qa-test-results.log, coverage/)
- ❌ Build artifacts (dist/, build/)
- ❌ Temporary scripts (qa-test-setup.sh)

**If you create a file, ask yourself: "Does this belong in docs/, tests/, or config/?"**

---

## Directory Structure

```
clawbridge/
├── README.md                  ← Main overview
├── package.json               ← Dependencies
├── Dockerfile                 ← Docker build
├── docker-compose.yml         ← Multi-container
├── jest.config.js             ← Test config
├── sharechat.md               ← PM ↔ Kiro communication
├── .gitignore
├── .dockerignore
├── .env.example
│
├── src/                       ← Source code
│   ├── server.js              ← Main server
│   ├── client.js              ← Outbound peer calls
│   ├── auth.js                ← Authentication
│   ├── executor.js            ← Skill execution
│   ├── config.js              ← Config loader
│   ├── bridge.js              ← OpenClaw bridge (Phase 2)
│   └── setup/                 ← Setup agent
│       ├── agent.js
│       ├── cli.js
│       └── tools.js
│
├── config/                    ← User config files
│   ├── agent.json             ← Agent identity
│   ├── peers.json             ← Peer list
│   ├── skills.json            ← Exposed skills
│   └── bridge.json            ← OpenClaw bridge config (Phase 2)
│
├── tests/                     ← All tests
│   ├── unit/                  ← Unit tests
│   │   ├── auth.test.js
│   │   ├── config.test.js
│   │   └── setup-tools.test.js
│   └── integration/           ← Integration tests
│       └── two-agents.test.js
│
├── docs/                      ← All documentation
│   ├── GETTING_STARTED.md     ← Dev setup
│   ├── USER_GUIDE.md          ← User walkthrough
│   ├── CONTRIBUTING.md        ← Contribution guide
│   ├── SETUP.md               ← Setup agent guide
│   ├── QA_TESTING_GUIDE.md    ← Testing checklist
│   ├── OPENCLAW_GATEWAY_API.md ← OpenClaw API reference
│   │
│   ├── archive/               ← Phase 0/1 history
│   │   ├── CODING_TASKS.md
│   │   ├── ARCH_REVIEW.md
│   │   ├── PHASE_0_SUMMARY.md
│   │   └── ...
│   │
│   └── internal/              ← Internal docs
│       ├── KIRO_MEMORY.md
│       └── LESSONS_LEARNED.md
│
└── docker/                    ← Docker configs (optional)
    ├── alpha/
    └── beta/
```

---

## File Placement Rules

### Source Code → `src/`

**All JavaScript source files go in `src/`.**

**Examples:**
- Server: `src/server.js`
- Client: `src/client.js`
- Bridge: `src/bridge.js`
- Utils: `src/utils.js`
- Submodules: `src/setup/`, `src/skills/`

---

### Configuration → `config/`

**User-facing config files go in `config/`.**

**Examples:**
- `config/agent.json` — Agent identity
- `config/peers.json` — Peer list
- `config/skills.json` — Exposed skills
- `config/bridge.json` — OpenClaw bridge
- `config/permissions.json` — Access control (Phase 2)

**Not in config/:**
- `.env` files (root)
- Build config (root: `jest.config.js`, `Dockerfile`)

---

### Tests → `tests/`

**All test files go in `tests/`.**

**Structure:**
```
tests/
├── unit/              ← Fast, isolated tests
│   ├── auth.test.js
│   └── config.test.js
└── integration/       ← Multi-component tests
    └── two-agents.test.js
```

**Naming:**
- `*.test.js` — Jest tests
- `*.spec.js` — Also acceptable

**Not in tests/:**
- QA scripts for manual testing → `docs/` (as guides, not scripts)
- Test artifacts → `.gitignore`

---

### Documentation → `docs/`

**All documentation files go in `docs/`.**

**Categories:**

**Main docs (docs/):**
- `GETTING_STARTED.md` — Developer setup
- `USER_GUIDE.md` — End-user walkthrough
- `CONTRIBUTING.md` — Contribution guide
- `SETUP.md` — Setup agent instructions
- `QA_TESTING_GUIDE.md` — Testing checklist
- `API_REFERENCE.md` — API docs (future)
- `BRIDGE_SETUP.md` — Bridge setup (future)

**Archive (docs/archive/):**
- Phase 0/1 work
- Historical decisions
- Old specs

**Internal (docs/internal/):**
- Team memory
- Lessons learned
- Internal process docs

**Not in docs/:**
- README.md (stays in root — it's the entry point)

---

## What Goes Where (Quick Reference)

| File Type | Location | Examples |
|-----------|----------|----------|
| Main README | Root | `README.md` |
| Dependencies | Root | `package.json` |
| Docker | Root | `Dockerfile`, `docker-compose.yml` |
| Source code | `src/` | `server.js`, `client.js`, `bridge.js` |
| User config | `config/` | `agent.json`, `peers.json` |
| Tests | `tests/unit/` or `tests/integration/` | `auth.test.js` |
| User docs | `docs/` | `USER_GUIDE.md`, `SETUP.md` |
| Dev docs | `docs/` | `GETTING_STARTED.md`, `CONTRIBUTING.md` |
| Historical | `docs/archive/` | `CODING_TASKS.md`, `ARCH_REVIEW.md` |
| Internal | `docs/internal/` | `KIRO_MEMORY.md` |
| Build config | Root | `jest.config.js` |
| Env template | Root | `.env.example` |
| Ignore files | Root | `.gitignore`, `.dockerignore` |

---

## Before You Commit

**Ask yourself:**

1. **Is this file necessary?**
   - If it's a temp file → delete or `.gitignore`
   - If it's build output → `.gitignore`
   - If it's test artifacts → `.gitignore`

2. **Where does this file belong?**
   - Documentation → `docs/`
   - Source code → `src/`
   - Tests → `tests/`
   - User config → `config/`
   - Build/env → root (only if essential)

3. **Is the root directory clean?**
   - Maximum ~10 files in root
   - If you see 20+ files in root, something is wrong

---

## Moving Files (Current Cleanup Needed)

**Files that need to move:**

From root → `docs/`:
- ❌ `CONTRIBUTING.md` → `docs/CONTRIBUTING.md`
- ❌ `GETTING_STARTED.md` → `docs/GETTING_STARTED.md`
- ❌ `USER_GUIDE.md` → `docs/USER_GUIDE.md`
- ❌ `SETUP.md` → `docs/SETUP.md`
- ❌ `QA_TESTING_GUIDE.md` → `docs/QA_TESTING_GUIDE.md`

**Files to delete:**
- ❌ `qa-test-results.log` (test artifact)
- ❌ `qa-test-setup.sh` (temp script)

**After cleanup, root should have ~10 files:**
1. README.md
2. package.json
3. package-lock.json
4. Dockerfile
5. docker-compose.yml
6. .gitignore
7. .dockerignore
8. .env.example
9. jest.config.js
10. sharechat.md

---

## .gitignore Best Practices

**Always ignore:**
- `node_modules/`
- `config/agent.json` (contains tokens)
- `config/peers.json` (contains tokens)
- `*.log` (test artifacts)
- `coverage/` (test coverage)
- `.env` (environment vars)
- `dist/`, `build/` (build output)

**Current .gitignore should have:**
```gitignore
# Dependencies
node_modules/

# Config (contains secrets)
config/agent.json
config/peers.json
config/bridge.json

# Environment
.env

# Test artifacts
coverage/
*.log
.nyc_output/

# Build output
dist/
build/

# Editor
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db
```

---

## Naming Conventions

### Files

- **Lowercase with dashes:** `setup-tools.js`, `two-agents.test.js`
- **Or camelCase:** `authMiddleware.js`, `configLoader.js`
- **Pick one style and be consistent**

### Directories

- **Lowercase, no dashes:** `src/`, `tests/`, `config/`, `docs/`
- **Subdirectories:** `tests/unit/`, `docs/archive/`

### Documentation

- **UPPERCASE for root docs:** `README.md`, `CONTRIBUTING.md`
- **UPPERCASE for major docs:** `GETTING_STARTED.md`, `USER_GUIDE.md`
- **Lowercase for specific topics:** `bridge-setup.md`, `troubleshooting.md`

---

## When You Add a New Feature

**Phase 2 example: Adding OpenClaw Bridge**

**Source code:**
- `src/bridge.js` — Bridge implementation
- `src/bridge-utils.js` — Helper functions (if needed)

**Config:**
- `config/bridge.json` — Bridge configuration

**Tests:**
- `tests/unit/bridge.test.js` — Unit tests
- `tests/integration/bridge-openclaw.test.js` — Integration test

**Documentation:**
- `docs/BRIDGE_SETUP.md` — Setup guide
- Update `docs/USER_GUIDE.md` — Add bridge examples
- Update `README.md` — Mention bridge in features

**NOT:**
- ❌ `BRIDGE.md` in root
- ❌ `bridge-test.js` in root
- ❌ `bridge-config.json` in root

---

## Exceptions

**sharechat.md stays in root temporarily:**
- It's for PM ↔ Kiro communication
- Easier to find in root during active development
- Will move to `docs/internal/` after Phase 2 ships

---

## Enforcement

**PM will check:**
- Root directory file count (<12 files)
- Docs in `docs/`
- Source in `src/`
- Tests in `tests/`
- Config in `config/`

**If you create a file in the wrong place, PM will ask you to move it.**

---

## Summary

**One rule to remember:**

> **If it's not essential build/run infrastructure, it goes in a subdirectory.**

**Essential (root):**
- README.md
- package.json
- Dockerfile
- docker-compose.yml
- Build config (jest.config.js)

**Everything else:**
- Docs → `docs/`
- Code → `src/`
- Tests → `tests/`
- Config → `config/`

**Keep root clean. This is a production repo.**

---

**Questions? Ask in sharechat.md.**
