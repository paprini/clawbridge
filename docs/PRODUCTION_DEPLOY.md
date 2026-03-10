# Production Deployment Guide

## Option 1: Bare Metal (systemd)

```bash
# Install
sudo bash deploy/install.sh

# Configure
cd /opt/clawbridge
sudo -u openclaw npm run setup:auto

# Set token in .env
echo "A2A_SHARED_TOKEN=$(openssl rand -hex 32)" | sudo tee .env

# Start
sudo systemctl start clawbridge
sudo systemctl status clawbridge

# Logs
journalctl -u clawbridge -f
```

Operational notes:
- The systemd unit now includes restart policy, reload support (`SIGHUP`), `UMask=0077`, and stronger sandboxing.
- Keep runtime config in `/opt/clawbridge/config` or another external directory, not in a git working tree.

## Option 2: Docker with HTTPS (Caddy)

```bash
# Set your domain and token
export A2A_DOMAIN=a2a.yourdomain.com
export A2A_SHARED_TOKEN=$(openssl rand -hex 32)

# Start
docker compose -f deploy/docker-compose.production.yml up -d

# Verify
curl https://a2a.yourdomain.com/health
```

Caddy handles TLS certificates automatically via Let's Encrypt.
The production compose file now runs the app read-only, drops Linux capabilities, enables container init, and adds a health check.

## Option 3: Docker without HTTPS (private network)

Use the standard `docker-compose.yml` for private network deployments where TLS isn't needed (VPC, LAN).

```bash
export A2A_SHARED_TOKEN=$(openssl rand -hex 32)
docker compose up -d
```

## Security Checklist

Before going to production:

- [ ] Generate a real token: `openssl rand -hex 32`
- [ ] Run `npm run verify` — all checks pass
- [ ] `A2A_CONFIG_DIR` points to runtime config outside the git checkout
- [ ] `peers.json` has 0600 permissions if it contains peer tokens
- [ ] Bridge disabled or only safe tools exposed
- [ ] Permissions.json configured (if multi-peer)
- [ ] Rate limits configured
- [ ] Firewall: port 9100 only accessible from trusted IPs (or behind Caddy)
- [ ] Logs monitored (journalctl or Docker logs)

## Secrets Handling Policy

- The tracked repository file [config/peers.json](../config/peers.json) is a bootstrap-only placeholder and must remain empty in git.
- Real peer definitions and tokens should live in an external runtime config directory referenced by `A2A_CONFIG_DIR`.
- If you intentionally keep real peers in the repository config directory, `npm run verify` will fail unless you set `ALLOW_REPO_MANAGED_PEERS=1`.
- Never commit bearer tokens, gateway tokens, or `.env` files.

## Log Hygiene

- ClawBridge now redacts token-like values and common secret fields in structured logs.
- Do not log full request headers, bearer tokens, or gateway credentials in custom code.
- Centralize logs through `journalctl`, Docker logs, or your log aggregator; avoid ad hoc file logging with loose permissions.

## Failure Recovery And Supervision

- Docker: `restart: unless-stopped`, health checks, and `init: true` are enabled in the production stack.
- systemd: automatic restarts, reload support, and graceful stop timeouts are configured in `deploy/clawbridge.service`.
- Graceful shutdown is handled in the Node process on `SIGTERM` and `SIGINT`.

## Upgrade And Rollback

Recommended upgrade flow:

```bash
git fetch origin
git checkout <release-tag-or-commit>
npm ci --omit=dev
A2A_SHARED_TOKEN=... npm run verify
sudo systemctl restart clawbridge
```

Rollback flow:

```bash
git checkout <previous-known-good-tag-or-commit>
npm ci --omit=dev
A2A_SHARED_TOKEN=... npm run verify
sudo systemctl restart clawbridge
```

If you deploy with Docker:

```bash
git checkout <release-tag-or-commit>
docker compose -f deploy/docker-compose.production.yml build --pull
docker compose -f deploy/docker-compose.production.yml up -d
```

## Monitoring

- Health: `curl http://localhost:9100/health`
- Metrics: `curl http://localhost:9100/metrics` (Prometheus format)
- Status: `curl http://localhost:9100/status` (public-safe info)
- Logs: `journalctl -u clawbridge -f` or `docker logs -f <container>`
