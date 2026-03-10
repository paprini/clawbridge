# Repository Structure Rules

**For:** contributors working on ClawBridge itself  
**Purpose:** keep the repo organized and make it obvious where new code, docs, and runtime-only files belong

## Root Directory

The root should stay focused on entry points, build files, and a small number of coordination files.

Current root files and directories:

```text
clawbridge/
├── README.md
├── SKILL.md
├── package.json
├── package-lock.json
├── Dockerfile
├── docker-compose.yml
├── jest.config.js
├── sharedchat.md
├── memory.md
├── assets/
├── config/
├── deploy/
├── docker/
├── docs/
├── examples/
├── scripts/
├── src/
└── tests/
```

Notes:
- `sharedchat.md` stays in root because it is the active PM/developer coordination file.
- `memory.md` is the local continuity file for the expert developer instance.
- Marketing assets belong in `assets/`, not the root.

## High-Level Directory Map

```text
src/                     application code
src/setup/               setup CLI and setup-agent workflow
src/helper-agent/        helper-agent bootstrap and instruction sync
config/                  tracked bootstrap config defaults
tests/unit/              isolated tests
tests/integration/       server and pipeline integration tests
docs/                    current user, operator, and contributor docs
docs/archive/            historical and superseded material
docs/internal/           internal team memory and notes
deploy/                  production deployment files
docker/                  sample instance config for docker demos
scripts/                 operational helper scripts
assets/                  logos and visual assets
examples/                example configs or usage material
```

## Configuration Files

Tracked config in `config/` should stay safe-by-default and suitable for the repo.

Current tracked config files:
- `config/agent.json`
- `config/skills.json`
- `config/peers.json`
- `config/bridge.json`
- `config/helper-agent.json`

Rules:
- `config/peers.json` in git is bootstrap-only and should remain empty of real peer secrets.
- Real instance config should live in an external directory via `A2A_CONFIG_DIR`.
- New runtime-only state should not be stored under `config/` if it is installation-specific or secret-bearing.

## Documentation Layout

Current active documentation is audience-based.

Primary docs:
- `README.md` — landing page and traffic router
- `docs/README.md` — documentation map
- `docs/QUICKSTART_SIMPLE.md` — simple user path
- `docs/OPERATOR_GUIDE.md` — operator path
- `docs/API_REFERENCE.md` — endpoint and payload reference
- `docs/BRIDGE_SETUP.md` — advanced bridge configuration
- `docs/SERVICE_AGENT_ARCHITECTURE.md` — helper-agent architecture
- `docs/GETTING_STARTED.md` — contributor onboarding

Rules:
- put current docs in `docs/`
- put superseded material in `docs/archive/`
- put team-only notes in `docs/internal/`
- do not create new top-level docs in root unless they are genuine project entry points

## Code Placement Rules

Use these defaults:

- request handling and runtime code -> `src/`
- setup flow -> `src/setup/`
- helper-agent support code -> `src/helper-agent/`
- tests -> `tests/unit/` or `tests/integration/`
- deploy manifests -> `deploy/`
- one-off operational scripts -> `scripts/`
- images/logos -> `assets/`

Avoid:
- temporary scripts in root
- docs in root beyond `README.md` and `SKILL.md`
- secret-bearing local runtime files anywhere under git-managed paths

## Naming Guidance

- JavaScript files: lowercase with dashes or established local style
- Test files: `*.test.js`
- Major docs: uppercase snake-case style already used in this repo, for example `QUICKSTART_SIMPLE.md`
- Config files: lowercase JSON filenames

Match the surrounding directory’s existing style instead of inventing a new one.

## Before You Commit

Check these quickly:

1. Is this file code, config, docs, tests, deploy, or runtime state?
2. Does it belong in an existing directory instead of the root?
3. Is it safe to track in git?
4. If it contains machine-local state or secrets, should it live outside the repo instead?

## Special Cases

- `sharedchat.md` is intentionally tracked and updated as part of coordination.
- `memory.md` is intentionally tracked to preserve continuity for this developer instance.
- `config/helper-agent.json` is tracked because it defines helper-agent bootstrap defaults, not per-installation secret state.
