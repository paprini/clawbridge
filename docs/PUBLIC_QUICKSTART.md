# Public Agent Quickstart — Zero to Public in 15 Minutes

## Prerequisites
- clawbridge installed and working locally
- A domain name pointing to your server
- Port 80 and 443 open on your firewall

## Step 1: Generate a strong token (1 min)

```bash
export A2A_SHARED_TOKEN=$(openssl rand -hex 32)
echo "Save this token: $A2A_SHARED_TOKEN"
```

## Step 2: Configure your agent (2 min)

```bash
npm run setup:auto
```

Or edit config files manually — see [API_REFERENCE.md](API_REFERENCE.md).

## Step 3: Set up permissions (2 min)

Create `config/permissions.json`:
```json
{
  "default": "deny",
  "permissions": {
    "trusted-friend": ["ping", "get_status", "openclaw_web_search"],
    "public": ["ping"]
  }
}
```

## Step 4: Deploy with HTTPS (5 min)

```bash
export A2A_DOMAIN=a2a.yourdomain.com
docker compose -f deploy/docker-compose.production.yml up -d
```

Caddy handles TLS certificates automatically.

## Step 5: Verify (2 min)

```bash
# Public status (no auth)
curl https://a2a.yourdomain.com/status

# Agent Card (no auth)
curl https://a2a.yourdomain.com/.well-known/agent-card.json

# Ping (with auth)
curl -X POST https://a2a.yourdomain.com/a2a \
  -H "Authorization: Bearer $A2A_SHARED_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"message/send","params":{"message":{"kind":"message","messageId":"test","role":"user","parts":[{"kind":"text","text":"ping"}]}},"id":1}'
```

## Step 6: Share with peers (3 min)

Give your peers:
1. Your agent URL: `https://a2a.yourdomain.com`
2. A bearer token (generate one per peer for security)
3. Your Agent Card URL: `https://a2a.yourdomain.com/.well-known/agent-card.json`

## Security Checklist

Before going public:
- [ ] Strong token (64 chars, generated with openssl)
- [ ] Permissions configured (default: deny)
- [ ] Rate limits configured
- [ ] Only safe skills exposed
- [ ] TLS enabled (Caddy or nginx)
- [ ] Logs monitored
- [ ] `npm run verify` passes

## What NOT to Expose Publicly

- `openclaw_exec` — arbitrary command execution
- `openclaw_Write` / `openclaw_Edit` — file modification
- `openclaw_Read` without path validation — file access
- Any skill that accesses private data

See [COMMUNITY_GUIDELINES.md](COMMUNITY_GUIDELINES.md) for full guidance.
