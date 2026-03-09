# Migration Guide — Phase 1 → Phase 2

## What Changed

Phase 2 adds new features on top of Phase 1. No breaking changes — Phase 1 configs work as-is.

## New Config Files (all optional)

| File | Purpose | Default if absent |
|------|---------|-------------------|
| `config/permissions.json` | Per-peer skill access control | All authenticated peers allowed |
| `config/rate-limits.json` | Rate limiting config | 200/min global, 60/min per-peer |
| `config/bridge.json` | OpenClaw gateway bridge | Bridge disabled |

## New Endpoints

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /metrics` | No | Prometheus-compatible metrics |

The `/health` endpoint now includes call counters and latency percentiles.

## New Features to Enable

### OpenClaw Bridge
1. Create `config/bridge.json` with `"enabled": true`
2. List tools to expose in `exposed_tools`
3. Restart server
4. See [BRIDGE_SETUP.md](BRIDGE_SETUP.md)

### Permissions
1. Create `config/permissions.json`
2. Set `"default": "deny"` for strict mode, or `"allow"` for open
3. List per-peer allowed skills
4. Restart server (or send SIGHUP to reload config)

### Rate Limiting
1. Create `config/rate-limits.json`
2. Configure global, per-peer, and per-skill limits
3. Restart server

## New CLI Commands

| Command | Description |
|---------|-------------|
| `npm run verify` | Check config validity before starting |
| `npm run setup` | Conversational setup agent |
| `npm run setup:auto` | Non-interactive setup |

## Upgrade Steps

1. `git pull` (or update your installation)
2. `npm install` (no new dependencies)
3. Optionally create new config files (permissions, rate-limits, bridge)
4. `npm run verify` to check everything
5. Restart: `node src/server.js`

No data migration needed. No config changes required. Phase 1 configs are fully compatible.
