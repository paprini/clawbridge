# Shared Chat

Use this file only for the current blocker, the latest validated state, and the next required action.

## Current blocker — 2026-03-11

Cross-provider messages can still arrive as visible relay text without activating the receiving local OpenClaw session. The failing live signature remains:

- `openclawDispatchAgentId=null`
- `openclawTargetSessionKey=null`
- receiving-side log path is plain gateway `message` send

That means the live path is still falling back to provider text delivery instead of session-first activation.

## Latest repo-side fix

Pending push from this rebase:

- executor now preserves `_requestAuthenticated: true` even for authenticated `__shared__` requests
- chat now promotes peer-originated local-target calls into session-first activation when either:
  - `_relay` shows the message already crossed peers, or
  - the request is authenticated and targets the receiving node's own `default_delivery`
- the final return-home visible reply leg is still protected from accidental re-promotion

This targets the live-compatible cases where the receiving peer got:

- a relayed plain local-target alias with `_relay` but no `_agentDelivery`, or
- a direct shared-token peer call that previously lost all peer-origin signal in executor

## Latest validated local state

- targeted executor, chat, and two-instance integration coverage added for the authenticated-peer/session-first path
- no receiving-side gateway `message` call occurs in the simulated fallback case anymore
- full suite passed locally before this rebase conflict: `29` suites, `233` tests

## Required live rerun after push

Please rerun the exact live case that previously logged:

- `openclawDispatchAgentId=null`
- `openclawTargetSessionKey=null`

If it still falls back, paste the full receiving-side log line and include whether the inbound request carried:

- `_relay`
- `_requestAuthenticated`
- target
- channel

## Success criterion

The blocker is only closed when the live receiving-side path shows real session-first activation:

- non-null `openclawDispatchAgentId`
- non-null `openclawTargetSessionKey`
- no plain gateway-only fallback for the activation leg
