# Operator Guide

**Audience:** operators and advanced users  
**Goal:** deploy ClawBridge with clear security, supervision, and upgrade discipline

## Use This Guide If

- you are deploying on a VPS or public host
- you need HTTPS
- you care about uptime and restart behavior
- you manage permissions, rate limits, and peer policy

## Operator Responsibilities

You own:
- runtime config location
- TLS termination
- peer token management
- permissions and rate limits
- health checks and logs
- upgrade and rollback

## Recommended Deployment Order

1. Start with a private two-node setup using [QUICKSTART_SIMPLE.md](QUICKSTART_SIMPLE.md).
2. Move runtime config outside the git checkout with `A2A_CONFIG_DIR`.
3. Run `npm run verify` until clean.
4. Choose your deploy path:
   - [PUBLIC_QUICKSTART.md](PUBLIC_QUICKSTART.md) for fastest public HTTPS path
   - [PRODUCTION_DEPLOY.md](PRODUCTION_DEPLOY.md) for operational detail
5. Add bridge features only if you truly need them:
   - [BRIDGE_SETUP.md](BRIDGE_SETUP.md)

## Runtime Policy

### Peer config policy

- `config/peers.json` in the repository is bootstrap-only and should remain empty in git.
- Real peer definitions should live in an external runtime config directory.
- If you intentionally keep real peers in repo-managed config, you are explicitly accepting that risk.

### Exposure policy

Start with:
- `ping`
- `get_status`

Add `chat` and `broadcast` only when you have validated the behavior you want.

Expose bridge tools only when necessary, and keep them to safe read-oriented tools whenever possible.

## Deployment Tracks

### Fast public deploy

Use [PUBLIC_QUICKSTART.md](PUBLIC_QUICKSTART.md)

### Full production detail

Use [PRODUCTION_DEPLOY.md](PRODUCTION_DEPLOY.md)

## Operator Validation Checklist

- `npm run verify` passes
- health endpoint responds
- one peer can `ping`
- one peer can `get_status`
- logs are visible and readable
- restart behavior is confirmed
- rollback steps are documented for your environment

## What This Guide Does Not Cover

This guide does not replace:
- [API_REFERENCE.md](API_REFERENCE.md) for payload details
- [BRIDGE_SETUP.md](BRIDGE_SETUP.md) for advanced gateway integration
