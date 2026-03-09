# Lessons Learned — openclaw-a2a Phase 1

**Date:** 2026-03-09
**Author:** Kiro (Opus coding agent)

---

## 1. Verify the SDK before trusting design docs

The CODING_TASKS.md and PHASE_1_PLAN.md showed custom JSON-RPC parsing code. The actual @a2a-js/sdk already provides `DefaultRequestHandler`, `jsonRpcHandler`, and `agentCardHandler` middleware that handles all protocol mechanics. Writing custom JSON-RPC would have been:
- Redundant (SDK does it better)
- Risky (protocol bugs, missing edge cases)
- More code to maintain

**Lesson:** Always `npm install` and read the actual SDK exports/types before writing code. Design docs go stale.

## 2. package.json had the wrong package name

The original package.json listed `@a2a-protocol/sdk` — that package doesn't exist. The correct one is `@a2a-js/sdk`. This would have been a day-one `npm install` failure for any contributor.

**Lesson:** Validate dependencies actually exist before committing package.json. Run `npm install` as a smoke test.

## 3. Native fetch > axios on Node 18+

Node 18+ has built-in `fetch()`. Adding axios is an unnecessary dependency that increases attack surface and bundle size. The client module uses native fetch with `AbortSignal.timeout()` for request timeouts.

**Lesson:** Check what the runtime provides before adding dependencies.

## 4. Config module caching breaks tests

The config module initially evaluated `CONFIG_DIR` at module load time as a constant. When tests changed `process.env.A2A_CONFIG_DIR`, the already-loaded module still used the old value. Fix: read the env var inside each function call, not at module scope.

**Lesson:** In Node.js modules loaded with `require()`, top-level constants are evaluated once. If tests need to change env vars, the code must read them at call time.

## 5. Peer tokens and shared tokens must be distinct

If a peer's token in peers.json matches the A2A_SHARED_TOKEN env var, `validateToken` returns `__shared__` instead of the peer ID. This caused a test failure. Each peer should have a unique token, and the shared inbound token should be different.

**Lesson:** Don't reuse tokens across different auth paths. Test with distinct values.

## 6. Auth on Agent Card endpoint: no

The Agent Card is a discovery mechanism — it tells other agents what skills you have and how to reach you. It should NOT require authentication. The JSON-RPC endpoint (where actual skill execution happens) requires auth. This matches the A2A spec design.

**Lesson:** Discovery is public, execution is private. This is a deliberate security design, not an oversight.

## 7. 20 docs, 0 code is a red flag

Phase 0 produced 20+ comprehensive design documents but zero implementation code. While planning is valuable, the ratio was off. The actual implementation took 2 hours and deviated from the design docs in important ways (SDK usage pattern, no custom JSON-RPC).

**Lesson:** Ship early, iterate. Design docs are hypotheses — code is truth.

## 8. The SDK uses `kind` not `type` for discriminators

A2A protocol messages use `kind: 'message'`, `kind: 'text'`, `kind: 'task'`, etc. Several design docs used `type` instead. This would cause silent failures at runtime.

**Lesson:** Protocol field names matter. Check the actual spec/types.

## 9. Express middleware ordering matters for auth

The `requireAuth` middleware must run BEFORE the SDK's `jsonRpcHandler`. The SDK's `userBuilder` also runs, but it doesn't reject requests — it just builds a User object. Our `requireAuth` is the actual gate that returns 401/403.

**Lesson:** Understand what each middleware layer does. Don't assume the SDK handles auth rejection — it only provides the hook.

## 10. Two-instance testing catches real bugs

Running two actual server instances on different ports caught the token mismatch issue that unit tests missed. The unit tests mocked config, so they didn't catch that peers.json had a token that didn't match the other server's shared token.

**Lesson:** Integration tests with real servers are worth the setup time. Mocks hide real bugs.

---

_These lessons apply to future phases and any contributor joining the project._


## 11. Alpine Linux: use 127.0.0.1, not localhost

In Alpine-based Docker images, `localhost` doesn't always resolve. The healthcheck `wget --spider http://localhost:9100/health` fails with "can't connect to remote host" while `http://127.0.0.1:9100/health` works fine. Always use the IP in container healthchecks.

## 12. Don't ship untested Docker files

The initial Docker commit said "docker compose config validates successfully" and "Docker daemon not available for build test." That's not good enough. Config validation checks YAML syntax, not whether the image builds, the app starts, or containers can talk to each other. We caught a real bug (the localhost healthcheck issue) only by actually running the containers. No assumptions — test it for real.

## 13. Finch is a drop-in Docker replacement

When Docker Desktop requires corporate SSO and you can't authenticate, Finch (`brew install --cask finch`) works as a drop-in replacement. Same Dockerfile, same docker-compose.yml, just `finch` instead of `docker`. Uses nerdctl + containerd under the hood. `finch vm init` takes ~60 seconds, then you're building and running containers.
