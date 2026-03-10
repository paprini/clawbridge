# Service Agent Architecture

**Audience:** contributors, operators, and maintainers  
**Status:** target architecture  
**Purpose:** replace the current raw OpenClaw HTTP bridge with a managed ClawBridge-owned service agent

## Why This Exists

ClawBridge currently succeeds at:
- receiving A2A requests
- authenticating and authorizing them
- routing them to local skills

The weak point is the last mile:
- a local ClawBridge skill calls the OpenClaw gateway directly
- the host OpenClaw agent may have stale assumptions or stale memory
- updates to ClawBridge do not automatically update the runtime execution context

This document defines the replacement architecture.

## Core Decision

ClawBridge will use **one managed service agent per installation**.

That service agent becomes the execution runtime for ClawBridge-originated local actions.

This replaces the current "raw HTTP bridge as primary execution path" model.

## Goals

- make ClawBridge execution deterministic after code updates
- isolate ClawBridge execution from the host bot's main memory/context
- give ClawBridge a runtime it can bootstrap, inspect, and heal
- preserve clean separation between network orchestration and local execution
- make startup, verification, and troubleshooting operationally meaningful

## Non-Goals

- keep dual execution paths long-term
- treat direct gateway HTTP tool calls as the primary future model
- store service-agent state inside the git working tree

## Service Agent Model

Each installation owns one service agent/session:

- stable identity
- stable session key
- stable workspace/state location
- ClawBridge-managed instructions
- background healing on startup
- visible to the main agent by default

Suggested stable identity:

- session key: `clawbridge-service`
- display name: `ClawBridge Service Agent`

## Execution Boundary

ClawBridge keeps:
- A2A transport
- auth
- rate limiting
- permissions
- peer orchestration
- response normalization

The service agent owns:
- local execution of action-taking tasks
- native OpenClaw tool usage
- ClawBridge-specific execution context
- bridge/runtime self-test

This means:

- `chat` routes into the service agent
- `broadcast` stays orchestrated by ClawBridge across peers, but local execution on each installation goes through the service agent
- future local bridge-backed operations also route through the same runtime

## Storage Model

Service-agent state lives outside the repository.

Recommended default:

```text
~/.clawbridge/
  service-agent/
    instructions.md
    state.json
    logs/
  runtime/
    bootstrap.json
```

Why:
- avoids git churn
- avoids accidental config loss on repo operations
- makes installation-local state explicit
- keeps runtime concerns separate from source control

## Configuration Model

Add explicit service-agent config instead of relying on convention.

Suggested shape:

```json
{
  "enabled": true,
  "mode": "service_agent",
  "gateway": {
    "url": "http://127.0.0.1:18789",
    "tokenPath": "~/.openclaw/openclaw.json"
  },
  "service_agent": {
    "sessionKey": "clawbridge-service",
    "workspaceDir": "~/.clawbridge/service-agent",
    "healInBackground": true,
    "visibleTo": ["main"],
    "alertSession": "main"
  }
}
```

## Instruction Model

Do not rely on a human-managed agent session remembering ClawBridge rules.

ClawBridge will generate and sync service-agent instructions on startup from:

- a base instruction template in the repo
- the installed ClawBridge version
- the local config
- current policy settings
- allowed capabilities

`SKILL.md` may still exist for packaging and human understanding, but the runtime instruction source should be generated and synchronized by ClawBridge itself.

## Startup Lifecycle

On startup:

1. start the HTTP server
2. initialize the service-agent manager in background
3. verify gateway connectivity and auth
4. ensure the managed session exists
5. sync current instructions
6. run a runtime self-test
7. publish status as `ready`, `degraded`, or `failed`

If startup bootstrap fails:
- ClawBridge should keep the server up
- action-taking skills should return a clear degraded error
- the main agent should be alerted

## Health Model

The service runtime should expose:

- current lifecycle state
- last successful sync time
- last self-test time
- last failure reason
- current session key / runtime id

This state should be visible in:
- logs
- `/health`
- `/status`
- `npm run verify`

## Verification Requirements

`npm run verify` must become operational, not just structural.

It should validate:
- config files are valid
- gateway is reachable
- gateway auth token loads correctly
- managed service session exists or can be created
- instruction sync succeeds
- service runtime self-test succeeds

Additional commands should be added:
- `npm run test-service-agent`
- `npm run test-chat-e2e`
- optional `npm run doctor`

## Runtime Abstraction

Before migration, ClawBridge should introduce a local abstraction layer:

- `service runtime`

This gives the code a single local execution seam.

Suggested methods:

```js
executeChat(params)
executeBroadcastStep(params)
executeToolCall(toolName, args)
healthCheck()
selfTest()
```

## Module Layout

Suggested new modules:

- `src/service-runtime/index.js`
- `src/service-runtime/manager.js`
- `src/service-runtime/gateway-control.js`
- `src/service-runtime/instructions.js`
- `src/service-runtime/health.js`

Existing files likely to change:

- `src/server.js`
- `src/executor.js`
- `src/skills/chat.js`
- `src/skills/broadcast.js`
- `src/verify.js`
- config loader / config docs

Current `src/bridge.js` should be reduced from "business execution path" to "low-level gateway control helper" or be retired after migration.

## Migration Order

This architecture is a full replacement, but the implementation should still be staged:

1. add service-runtime abstraction
2. add service-agent manager and background bootstrap
3. route `chat` through the service runtime
4. route `broadcast` local execution through the service runtime
5. migrate other bridge-backed execution paths
6. remove the old direct execution path

## Operational Behavior

Background healing is required.

That means:
- startup should not hard-fail the whole server just because the service agent is temporarily unhealthy
- but the unhealthy state must be loud and explicit

Main-agent alerting should happen when:
- service session cannot be ensured
- instruction sync fails
- self-test fails
- runtime degrades after startup

## Risks

Main architectural risks:

- OpenClaw session APIs may not support all desired lifecycle guarantees cleanly
- hidden runtime indirection can make debugging harder without explicit health surfaces
- partial migration would create two execution models and confuse operations

## What “Done” Means

This architecture is done when:
- ClawBridge owns one managed service agent per installation
- startup can ensure and sync that runtime automatically
- `chat` succeeds through the service agent on real deployed nodes
- `broadcast` succeeds through the same execution model
- health and verify surfaces show real runtime state
- repo-managed config no longer acts like hidden runtime state

## Open Questions To Resolve During Implementation

- which exact OpenClaw primitive will represent the managed runtime
- which gateway/session API guarantees are real and stable
- how instruction updates are attached to the runtime in practice
- what exact structured task/result protocol the service agent should use

Those questions affect implementation detail, not the core architecture direction.
