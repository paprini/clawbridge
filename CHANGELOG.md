# Changelog

All notable changes to ClawBridge should be recorded here.

The project uses Semantic Versioning:
- `PATCH` for backward-compatible fixes
- `MINOR` for backward-compatible features
- `MAJOR` for breaking changes

## [Unreleased]

- Fixed session-first reply handling so ClawBridge now recovers successful OpenClaw reply payloads even when the `openclaw agent` command exits non-zero with valid JSON on stdout.
- Fixed session-first local delivery so the receiving node now visibly delivers the local agent reply on its own provider session.
- Added per-session serialization for concurrent inbound OpenClaw agent turns to prevent overlapping messages from colliding on the same local session.
- Added concurrency reproduction coverage and reply-recovery regressions in the integration/unit suite.

## [0.2.0] - 2026-03-10

- Added relay-aware `chat`/`broadcast` improvements, `@agent` delivery, default delivery routing, and clearer peer identity handling.
- Added a support-only helper agent with bootstrap, status reporting, and verification coverage.
- Hardened production defaults, logging redaction, deployment guidance, and tracked-peer policy.
- Reorganized public docs by audience and added maintainer release/versioning guidance.
- Hardened OpenClaw native activation with docs-backed CLI discovery, setup hints, and verification checks.

## [0.1.0] - 2026-03-10

- Initial tracked release baseline for the current repo line
