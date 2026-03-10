# Helper Agent Architecture

**Audience:** contributors, operators, and maintainers  
**Status:** target architecture  
**Purpose:** define the ClawBridge helper agent that supports installation, diagnostics, and ClawBridge-specific context

## Critical Clarification

The ClawBridge helper agent is **not** the runtime bridge for incoming A2A requests.

It does **not** replace:
- the HTTP server
- the executor
- the auth layer
- the current request routing path
- the live bridge behavior used by skills such as `chat`

ClawBridge request execution stays in the ClawBridge application.

## What The Helper Agent Is

The helper agent is:

- one managed helper agent per installation
- owned by ClawBridge
- backed by its own OpenClaw workspace/session
- responsible for helping operators and main agents with ClawBridge-specific tasks

Its job is to preserve and provide ClawBridge context so the main bot does not drift or forget how ClawBridge works.

## What The Helper Agent Helps With

- installation guidance
- config help
- diagnostics
- bridge troubleshooting
- explaining ClawBridge commands
- preserving relevant ClawBridge operational context

## What It Does Not Do

- it is not the gateway for every message
- it is not the execution bridge for `chat` or `broadcast`
- it is not the handler for incoming A2A traffic
- it is not the replacement for `src/bridge.js`

## Core Decision

ClawBridge will manage one helper agent per installation, but the live request path remains unchanged.

That means:

- helper agent = support brain
- ClawBridge app = request executor

## Storage Model

The helper agent should have external, installation-local state outside the repo.

Recommended default:

```text
~/.clawbridge/helper-agent/
  instructions.md
  state.json
```

Why:
- avoids git churn
- avoids accidental repo resets affecting helper state
- makes installation-local context explicit

## Configuration Model

Use explicit helper config.

Suggested file:

`config/helper-agent.json`

Suggested fields:

- `enabled`
- `agentId`
- `sessionKey`
- `workspaceDir`
- `healInBackground`
- `visibleTo`
- `alertSession`
- `bootstrapViaGateway`

## Lifecycle Model

On ClawBridge startup:

1. the HTTP server starts normally
2. the helper-agent manager starts in background
3. helper workspace and instructions are synchronized
4. ClawBridge attempts to ensure the OpenClaw helper session exists
5. status becomes `ready`, `degraded`, or `failed`

If bootstrap fails:
- ClawBridge should stay up
- request execution should still work as before
- helper status should show degraded state clearly

## Instruction Model

ClawBridge should generate the helper instructions it wants the helper agent to use.

Those instructions should emphasize:
- how ClawBridge is installed
- how it is configured
- how to diagnose common issues
- the boundary that the helper is support-only, not the live bridge

## Status Surfaces

Helper-agent status should be visible in:

- logs
- `/health`
- `/status`
- CLI status output
- `npm run verify`

## Suggested OpenClaw Integration

If available, ClawBridge should bootstrap the helper session through OpenClaw session APIs such as `sessions_spawn`.

That bootstrap is for helper availability and context continuity only.

It should not alter the live A2A request pipeline.

## Implementation Targets

Suggested modules:

- `src/helper-agent/config.js`
- `src/helper-agent/instructions.js`
- `src/helper-agent/manager.js`
- `src/openclaw-gateway.js`

Likely touched files:

- `src/server.js`
- `src/cli.js`
- `src/verify.js`
- docs and config

## What “Done” Means

This helper-agent architecture is done when:

- each installation gets one helper agent
- its workspace and instructions are synced automatically
- its status is visible operationally
- it preserves ClawBridge-specific context for the local main agent
- the live request execution path remains unchanged
