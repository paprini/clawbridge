# Shared Chat

Hello developer, I am `gipiti`, the expert developer instance working directly in this local clone of `clawbridge`.

Use this file for current implementation status, remaining blockers, and live validation only.

Archive:
- `docs/archive/sharedchat-history-2026-03-09.md`

## Current State — 2026-03-10

Status:
- code-side investigation completed
- latest downstream activation bug is fixed locally
- full test suite passing

Validation:
- `21` test suites passing
- `178` tests passing
- `npm run verify` still fails on this machine only because local `~/.openclaw/openclaw.json` does not allow `sessions_send`

## Latest Root Cause And Fix

Problem we isolated:
- ClawBridge was incorrectly treating `config/agent.json.id` as if it were the local OpenClaw agent ID
- visible inbound delivery was being posted from the bridge default session instead of the same target session later used for `sessions_send`

Why that matters:
- OpenClaw agent IDs and ClawBridge peer IDs are different concepts
- with the wrong OpenClaw agent ID, dispatch could be accepted against the wrong session tree
- with visible delivery and `sessions_send` on different sessions, OpenClaw could lose the delivery context needed for the receiving agent to wake up and reply correctly

What changed:
- ClawBridge now resolves the OpenClaw agent from:
  - `config/agent.json -> openclaw_agent_id`, or
  - `config/bridge.json -> agent_dispatch.agentId`, or
  - OpenClaw bindings / default agent
- inbound visible `message` delivery now runs from the same target session that ClawBridge dispatches into with `sessions_send`
- setup now preserves or auto-populates `openclaw_agent_id` when possible
- verify now checks explicit OpenClaw agent IDs and warns when multi-agent OpenClaw installs are ambiguous
- ClawBridge now detects two unsafe OpenClaw announce states:
  - `sendPolicy: "deny"`
  - direct/main sessions missing or mismatching delivery target metadata
- when those are detected, ClawBridge waits for the hidden agent reply and posts the reply itself instead of relying on OpenClaw's best-effort announce step

## What Needs Live Validation

On a real node:

1. Pull latest `main`
2. Ensure `~/.openclaw/openclaw.json` includes `gateway.tools.allow: ["sessions_send"]`
3. Restart the OpenClaw gateway
4. If the node has multiple local OpenClaw agents and you want to pin one explicitly, set:
   - `config/agent.json -> openclaw_agent_id`
5. Re-test:
   - `chat({ target: "@agent-name", message: "hello" })`
   - `chat({ target: "#channel@agent-name", message: "hello" })`

Expected result:
- visible message arrives
- receiving OpenClaw agent wakes up as a real new turn
- receiving agent posts a visible response

## If It Still Fails

Please report back with:
- exact returned JSON from the failing `chat`
- receiving node `config/agent.json`
- receiving node `config/bridge.json`
- receiving node relevant `~/.openclaw/openclaw.json` sections:
  - `agents`
  - `bindings`
  - `gateway.tools.allow`
  - `tools.sessions.visibility`
- any OpenClaw gateway logs around `sessions_send`
