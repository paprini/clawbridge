# Production Deployment Guide

## Option 1: Bare Metal (systemd)

```bash
# Install
sudo bash deploy/install.sh

# Configure
cd /opt/openclaw-a2a
sudo -u openclaw npm run setup:auto

# Set token in .env
echo "A2A_SHARED_TOKEN=$(openssl rand -hex 32)" | sudo tee .env

# Start
sudo systemctl start openclaw-a2a
sudo systemctl status openclaw-a2a

# Logs
journalctl -u openclaw-a2a -f
```

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
- [ ] peers.json has 0600 permissions
- [ ] Bridge disabled or only safe tools exposed
- [ ] Permissions.json configured (if multi-peer)
- [ ] Rate limits configured
- [ ] Firewall: port 9100 only accessible from trusted IPs (or behind Caddy)
- [ ] Logs monitored (journalctl or Docker logs)

## Monitoring

- Health: `curl http://localhost:9100/health`
- Metrics: `curl http://localhost:9100/metrics` (Prometheus format)
- Status: `curl http://localhost:9100/status` (public-safe info)
- Logs: `journalctl -u openclaw-a2a -f` or `docker logs -f <container>`
