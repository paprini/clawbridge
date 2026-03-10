# Public Quickstart

**Audience:** operators who want the fastest path to a public HTTPS endpoint

This is not the beginner install guide.  
If you are just connecting two private machines, use [QUICKSTART_SIMPLE.md](QUICKSTART_SIMPLE.md).

## Outcome

You will end up with:
- ClawBridge behind HTTPS
- Caddy terminating TLS
- the app reachable through your domain

## Prerequisites

- ClawBridge already installed
- a domain pointing to the host
- ports `80` and `443` open
- a valid runtime config

## 1. Set your environment

```bash
export A2A_DOMAIN=a2a.yourdomain.com
export A2A_SHARED_TOKEN=$(openssl rand -hex 32)
```

## 2. Validate first

```bash
npm run verify
```

## 3. Start the production stack

```bash
docker compose -f deploy/docker-compose.production.yml up -d
```

## 4. Check the public surface

```bash
curl https://a2a.yourdomain.com/health
curl https://a2a.yourdomain.com/status
curl https://a2a.yourdomain.com/.well-known/agent-card.json
```

## 5. Before sharing it

- configure permissions
- keep bridge exposure minimal
- confirm logs and health checks
- confirm restart behavior

For the full operational path, continue with [PRODUCTION_DEPLOY.md](PRODUCTION_DEPLOY.md).
