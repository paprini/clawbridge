# Shared Chat

Use this file only for the **current blocker**, the **latest validated live behavior**, and the **next action**.
Archive everything else.

Archive:
- `docs/archive/sharedchat-history-2026-03-09.md`

## Current State — 2026-03-11

### Product direction
ClawBridge should be treated as **session-first agent-to-agent communication**, not message-relay-first.
Launch scope remains:
- Telegram
- Discord
- WhatsApp

### Latest validated reality from live nodes
So far, only **WhatsApp** looks like it is truly activating the remote agent in a meaningful way when receiving peer-originated messages.

Current practical summary:
- **WhatsApp**: seems to activate on inbound peer traffic and is the only node currently showing signs of real execution
- **Discord**: may return internal/session-first output, but does not appear to complete real remote bound-channel execution reliably
- **Telegram**: may return internal/session-first output, but does not appear to complete real remote bound-channel execution reliably

### Important distinction
What we are seeing on Discord/Telegram is not enough:
- they can receive messages
- they can sometimes answer back with `response_text`
- but they do **not** seem to execute the requested action as a real remote agent turn in the bound session/channel

So the current bug is **not** just reply wording or relay cosmetics.
It is a deeper bug in:

## Canonical blocker
**Session-first inbound traffic is still stopping at internal response/message reception instead of completing real remote bound-session agent execution on Discord and Telegram.**

### In plain terms
Current observed pattern on Discord/Telegram:
1. peer message arrives
2. session-first path activates something / returns internal output
3. but the remote agent does not reliably behave like a truly executing bound agent
4. requested actions are not consistently carried out as real remote work

### Current strongest contrast
- WA: looks closest to real execution
- Discord / Telegram: still look like “message received + internal answer” more than “real remote agent executed the task”

### Architectural hint from WA
WA found a very important clue:
peer-originated A2A traffic must not reuse human/provider-bound sessions.
That appears to be part of why WA improved.

### What we need from gipiti now
Please stop broad churn and focus on this exact product-level question:

**How do we guarantee that peer-originated session-first traffic executes as a real remote bound-agent turn, not just an internal response artifact?**

Specifically:
1. reproduce the Discord and Telegram failure modes directly
2. compare them against the stronger WA behavior
3. identify why WA is closer to true execution
4. make Discord and Telegram match that execution semantics
5. push a real fix with a real commit/hash

### Delivery requirement for confirmation
When you believe this is fixed, confirm with:
- exact commit/hash
- what changed
- which node pairs were re-tested
- evidence that the remote agent actually executed the requested action, not merely returned internal text

