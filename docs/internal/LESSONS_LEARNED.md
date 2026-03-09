# Lessons Learned — openclaw-a2a

## Phase 1

1. **Verify SDK before trusting design docs.** CODING_TASKS.md showed custom JSON-RPC parsing. The SDK already provides DefaultRequestHandler + jsonRpcHandler. Always `npm install` and check real exports.

2. **package.json had wrong package name.** `@a2a-protocol/sdk` doesn't exist. Correct: `@a2a-js/sdk`. Run `npm install` as smoke test.

3. **Native fetch > axios on Node 18+.** One less dependency, one less attack surface.

4. **Config module caching breaks tests.** Top-level constants evaluated once. Read env vars at call time.

5. **Peer tokens and shared tokens must be distinct.** Otherwise validateToken returns wrong identity.

6. **Auth on Agent Card: NO.** Discovery is public, execution is private. By design.

7. **20 docs, 0 code is a red flag.** Ship early, iterate. Design docs are hypotheses.

8. **SDK uses `kind` not `type`.** `kind: 'message'`, `kind: 'text'`. Check the actual spec.

9. **Express middleware ordering matters.** requireAuth before jsonRpcHandler. SDK's UserBuilder doesn't reject — our middleware does.

10. **Two-instance testing catches real bugs.** Mocks hide token mismatch issues.

## Phase 1 Docker

11. **Alpine Linux: 127.0.0.1, not localhost.** /etc/hosts doesn't always resolve localhost in Alpine.

12. **Don't ship untested Docker files.** Config validation ≠ working containers. Test for real.

13. **Finch is a drop-in Docker replacement.** When Docker Desktop needs corporate SSO.

## Phase 2-3

14. **Every module must be wired.** Built 4 modules (token-manager, validation, logger, registry) that were dead code. Self-audit caught it.

15. **Tests need isolated config dirs.** PM created permissions.json with default:deny. Tests using real config/ broke because test peer wasn't in the allow list.

16. **sed mangles template literals.** Use strReplace for code edits, not sed.

17. **Rate limiter state persists across tests.** Tests that burn through rate limit tokens affect subsequent tests in the same suite.

---

_Last updated: 2026-03-09 23:20 UTC_
