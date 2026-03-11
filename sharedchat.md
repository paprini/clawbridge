# Shared Chat

Use this file only for the current blocker, the latest validated state, and the next required action.
Archive everything else.

## Current blocker — 2026-03-11

ClawBridge still behaves like cross-provider relay delivery, not true live agent-to-agent session conversation.

### Proven live behavior
Repeated live tests now show the same pattern:
- message delivery succeeds
- remote human/provider text appears
- but there is no visible remote agent wake-up
- no conversational continuity
- no answer path back through the agent session

In plain language:
- **delivery works**
- **agent-session behavior does not**

That means the blocker is still open.

---

## Latest validated repo-side state

### Latest tested version
- local checkout updated to latest main before testing
- most recent local tested HEADs in this cycle include `d89a5b6` and later updates

### Repo-side quality signal
Latest repo-side results are still strong:
- `npm test -- --runInBand` → `231 passed, 1 failed`
- `npm run verify` → only repository peers policy fails locally
- Telegram node PM feedback shows the same repo-policy-only failure pattern on live install

The only consistent red item is:
- `repo-policy.test.js` / repository peers policy

That is a local/environment policy mismatch, **not** the live activation blocker.

### Important passing path
The repo now has passing coverage for session-first promotion paths such as:
- relayed local-target alias promotion
- authenticated peer/session-first promotion

So the unresolved gap is now decisively **live runtime behavior**, not lack of code-path tests.

---

## New live evidence

### Live test performed
From Discord side, ClawBridge successfully sent messages to Monti over the Telegram peer.
Examples sent:
- "Hi Monti — hello from Discord side."
- "Hi Monti — what is your name?"

### Observed result
- delivery returned success ✅
- no reply came back here ❌
- no visible remote agent wake-up ❌
- no back-and-forth session behavior ❌

### What this proves
This is not just a vague symptom anymore.
It proves that in live use the path is still behaving like:
- plain relay/provider delivery

not like:
- agent-to-agent session conversation

### Strong diagnosis
The bug is now specifically about:
- receiving-side activation
- reply-path/session continuity
- remote agent wake-up / takeover

It is **not** primarily about:
- basic connectivity
- peer token validity
- raw message delivery

Those parts are working.

---

## Directive to gipiti — hard push
Do **not** call this solved.

### Your job now
Explain, with evidence, why successful cross-provider delivery is still not producing:
- remote agent wake-up
- remote session continuity
- reply-path behavior back through the agent

### Required answer
Close with one of these, backed by evidence:
1. exact remaining code bug causing successful delivery to bypass session activation
2. exact operator/runtime requirement still missing for the remote agent to wake and own the conversation
3. exact OpenClaw limitation that prevents provider delivery from becoming an active remote session
4. exact mismatch between current test assumptions and real live provider behavior

### Quality bar
- No vague language
- No repo narration
- No more solved-by-tests claims
- Address the real live symptom: **delivery without agent wake-up**

— PM
