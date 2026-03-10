# Shared Chat

Hello developer, I am `gipiti`, the expert developer instance working directly in this local clone of `clawbridge`.

Use this file for the **single current blocker** and the **latest live validation state only**.
Archive everything else.

Archive:
- `docs/archive/sharedchat-history-2026-03-09.md`

## Current State — 2026-03-10

### Repo / release status
- current release line: `0.2.0`
- latest local fix commit: `3887102` plus follow-up generic-id hardening in current local branch
- local verify: `19/19` passing
- full local suite: `23` suites / `203` tests passing
- two-instance relay harness: passing in both unique-id and generic-id scenarios
- install/update path is working

### What is now confirmed working on live nodes
- peer auth ✅
- peer ping ✅
- `@agent-name` routing ✅
- visible inbound delivery ✅
- native/local agent activation ✅
- correct local agent selection (`main`) ✅
- local response generation quality ✅

### Single remaining blocker
**Need one new live retest of cross-agent reply relay after the generic-id relay fix.**

---

## Latest fix from gipiti

### Actual root cause isolated locally
The reply relay path was still dropping a real remote peer when that peer's configured id matched the local `agent.json.id`.

This happened in two places:
- authenticated peer ids were being normalized away when they equaled the local agent id
- URL-based peer matching also discarded the matched peer id for the same reason

That makes generic installations like `main` / `main` fail with:
- `reply_relay: "not_requested"`
- `reply_relay_peer: null`

even though the metadata is present and the remote agent really did activate.

### What changed
- reply relay peer resolution in `src/skills/chat.js` no longer throws away a peer id just because it matches the local `agent.id`
- same-id peers are now allowed when they are backed by:
  - authenticated peer identity
  - URL match to a configured remote peer
  - explicit remote source URL distinct from the local agent URL
- true local self-cases are still suppressed
- `src/verify.js` now fails if `peers.json` reuses the local `agent.json.id`, because `@agent-name` routing becomes ambiguous on the source side even though reply relay can now recover the return leg

### Why this is the right fix
- it matches the real semantics: peer ids and local agent ids are different namespaces
- it fixes the exact `reply_relay: "not_requested"` class without changing the public `chat` contract
- it adds an explicit guard for the separate ambiguous-addressing misconfiguration instead of letting that surface later as a confusing live bug

### Local validation
- `npm test -- --runInBand` → `23` suites / `203` tests passing
- `npm run test:two-instance` → passing
- `npm run verify` → `19/19` passing

### New regression proof added
- unit coverage for reply relay when the remote peer id equals the local agent id
- unit coverage for URL-based fallback in the same-id case
- unit coverage proving true local self-metadata still does **not** trigger reply relay
- two-instance integration coverage where both installations use `agent.id = "main"` and the return-leg relay still succeeds

### Current ask
Please pull latest `main` and re-test the same Telegram ↔ Discord flow.

Expected result now:
- `agent_dispatch: "activated"`
- `openclaw_result: "ok"`
- `reply_relay: "delivered"`
- `reply_relay_peer` set to the real origin peer id

If it still fails, please report only:
- exact returned JSON
- sending node `config/agent.json`
- receiving node `config/agent.json`
- both nodes `config/peers.json`
- both nodes `npm run verify`
- log lines containing:
  - `reply_relay`
  - `reply_relay_peer`
  - `sourceAgentId`
  - `sourceUrl`

The code path is now locally proven. The remaining question is the live-node retest only.

---

## Live Retest After Generic-ID Relay Fix — still no visible return reply

We re-tested on live nodes after pulling the latest version.

### Observed returned JSON on Discord-side outbound test
The local result still reports success on the return path:

```json
{
  "agent_dispatch": "activated",
  "openclaw_result": "ok",
  "reply_relay": "delivered",
  "reply_relay_peer": "guali-discord"
}
```

### But actual user-visible behavior is still wrong
The response still does **not** appear visibly back on the source side.
Messages reach each other and local replies are generated, but visible cross-platform return delivery is still not happening.

### New local log clue
Recent Discord-node logs still show a flat local channel-send path in the same runtime window:

```text
Sending chat message via gateway target=1480310282961289216 resolvedTarget=1480310282961289216 targetAlias=null messageLength=17 channel=discord openclawDispatchAgentId=null openclawTargetSessionKey=null
```

And then the peer-addressed activation path:

```text
Sending chat message via gateway target=@guali-discord resolvedTarget=1480310282961289216 targetAlias=null messageLength=84 channel=discord openclawDispatchAgentId=main openclawTargetSessionKey=agent:main:discord:channel:1480310282961289216
```

### Likely interpretation
Even though the code now reports `reply_relay: "delivered"`, the live runtime may still be falling through to a plain local visible send path somewhere on the return leg.

That would explain the current contradiction:
- relay metadata says delivered
- but human-visible output still stays local instead of appearing on the origin platform

### Current likely causes to inspect
1. the relay function returns success before the provider-visible outbound send is truly completed
2. the return leg still downgrades into a local channel send in some mixed path
3. the wrong delivery target is preserved on the final emit step
4. local two-instance coverage is still missing one real-provider behavior difference present on Discord/Telegram

### Current summary
- peer auth works
- routing works
- activation works
- local response works
- relay status reports delivered
- but visible return-leg output still does not actually appear on the origin platform

So the remaining bug appears to be:
**false-positive relay success or final visible outbound delivery mismatch on the return leg**

