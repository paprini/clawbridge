# Shared Chat

Hello developer, I am `gipiti`, the expert developer instance working directly in this local clone of `clawbridge`.

Use this file for current implementation status, active blockers, and exact live validation feedback only.

Archive:
- `docs/archive/sharedchat-history-2026-03-09.md`

## Current State — 2026-03-10

### Repo status
- latest follow-up fix for OpenClaw CLI discovery is implemented
- full local test suite passing: `22` suites / `183` tests
- local `npm run verify` passes

### Latest fix from gipiti
Native `@agent` activation now resolves the OpenClaw CLI using the documented OpenClaw install paths before spawning it.

What changed:
- ClawBridge still supports explicit `OPENCLAW_BIN`
- when `OPENCLAW_BIN` is not set, ClawBridge now searches:
  - the current runtime `PATH`
  - `npm prefix -g`
  - `~/.openclaw/bin/openclaw`
  - `~/.local/bin/openclaw`
  - standard service-safe locations such as `/opt/homebrew/bin/openclaw` and `/usr/local/bin/openclaw`
- the resolver now caches proven command paths only; it does not cache a missing bare command
- setup and verify now tell operators these exact locations instead of only saying "check PATH"
- docs now expose `OPENCLAW_BIN` as the explicit override when those documented locations are not enough

Why this matters:
- the live node failure is no longer treated as a vague dispatch bug
- it is now handled as a documented install/runtime path issue
- the fix follows the real OpenClaw install docs instead of adding broad guesswork

### Next live validation needed
Please pull latest `main` on the live nodes and re-test:

```js
chat({ target: "@monti-telegram", message: "Hola... respondeme..." })
```

Expected result now:
- visible inbound delivery still works
- native local agent activation no longer fails with `spawn openclaw ENOENT`
- target agent visibly replies in the same destination
- ClawBridge returns `agent_dispatch: "activated"`

### If it still fails
Please report back with:
- exact returned JSON
- output of `which openclaw`
- output of `openclaw --version`
- output of `npm prefix -g`
- whether `OPENCLAW_BIN` is set in the ClawBridge service environment
- receiving node `config/agent.json`
- receiving node `config/bridge.json`
- any stderr/stdout around the activation step

---

## New Live Bug: activation works, but local agent identity routing is wrong

We finally got a real visible round-trip on live nodes, but the result exposed a new bug.

### What happened
Telegram -> Discord produced a visible inbound message in Discord lounge and a visible reply.
So this confirms:
- inbound activation can now work
- visible reply can now happen

### But the reply came from the wrong local agent
Relevant Discord-node log lines:

```text
[INFO] Sending chat message via gateway target=@guali-discord resolvedTarget=1480310282961289216 targetAlias=null messageLength=75 channel=discord openclawDispatchAgentId=musicate-pm openclawTargetSessionKey=agent:musicate-pm:discord:channel:1480310282961289216
```

And then again:

```text
[INFO] Sending chat message via gateway target=@guali-discord resolvedTarget=1480310282961289216 targetAlias=null messageLength=89 channel=discord openclawDispatchAgentId=musicate-pm openclawTargetSessionKey=agent:musicate-pm:discord:channel:1480310282961289216
```

### Why this is wrong
The peer target was:
- `@guali-discord`

But ClawBridge activated:
- `musicate-pm`

because the visible target resolved into Discord `#lounge`, and `#lounge` is bound in OpenClaw to `musicate-pm`.

### Meaning
This is no longer a dispatch-failure bug.
This is now an **agent identity / local target-agent selection bug**.

ClawBridge is currently overfitting to the destination channel/session binding and losing the intended agent identity.

### What should happen instead
If the peer target is `@guali-discord`, the activated local OpenClaw agent should be the one representing Guali Discord (main / explicitly pinned local agent), not whichever agent happens to own the destination channel session.

### Current incorrect behavior
- peer identity says: `@guali-discord`
- delivery target says: `#lounge`
- session lookup picks: `musicate-pm`
- visible response therefore comes from the wrong persona/agent

### Likely fix direction
You probably need to separate:
1. **who should answer** (local OpenClaw agent identity)
2. **where the answer should be delivered** (channel / reply target)

Those are not always the same thing on multi-agent OpenClaw installs.

### Important extra signal
Discord lounge also showed:
- visible inbound message from Monti
- visible reply from PM persona
- then `⚠️ ✉️ Message: \`📌\` failed`

So there may also be a follow-up message formatting / delivery artifact after the wrong-agent activation.

### Request
Please fix the local agent-selection logic for peer-addressed targets like `@guali-discord`.
On multi-agent OpenClaw installs, ClawBridge must preserve the intended local agent identity rather than blindly selecting whichever session binding matches the delivery channel.

