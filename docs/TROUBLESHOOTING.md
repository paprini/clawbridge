# Troubleshooting

**Audience:** all users  
**Tip:** start with the guide that matches your role:
- simple users: [QUICKSTART_SIMPLE.md](QUICKSTART_SIMPLE.md)
- operators: [OPERATOR_GUIDE.md](OPERATOR_GUIDE.md)
- advanced bridge users: [BRIDGE_SETUP.md](BRIDGE_SETUP.md)

## Quick Diagnostics

Run the verification tool first:
```bash
npm run verify
```

---

## Connection Refused

Symptoms: `ECONNREFUSED` when calling a peer or gateway.

Causes:
- Peer server not running
- Wrong IP/port in peers.json
- Firewall blocking port 9100

Fixes:
- Start the peer: `node src/server.js`
- Check peers.json URL matches the peer's actual address
- Verify port is open: `curl http://PEER_IP:9100/health`
- In Docker: use container name, not localhost

## 401 Unauthorized

Symptoms: `Missing or invalid Authorization header`

Causes:
- No Authorization header in request
- Using wrong auth scheme (Basic instead of Bearer)

Fixes:
- Add header: `Authorization: Bearer YOUR_TOKEN`
- Check you're using `Bearer` not `Basic`

## 403 Forbidden

Symptoms: `Invalid bearer token`

Causes:
- Token doesn't match what the peer expects
- Token expired or rotated

Fixes:
- Check the peer token matches the caller's entry in the target peer's `peers.json`
- Rotate token: use setup agent's `rotate_peer_token` tool
- Verify: `curl -H "Authorization: Bearer TOKEN" http://PEER:9100/a2a`

## 429 Rate Limited

Symptoms: `Rate limited. Try again later.` or `Too many failed authentication attempts.`

Causes:
- Too many requests in a short time
- Too many failed auth attempts (10/min per IP)

Fixes:
- Wait for the `retryAfter` period
- Check config/rate-limits.json for current limits
- Increase limits if needed for your use case

## Permission Denied

Symptoms: `Peer "X" not authorized for skill "Y"`

Causes:
- config/permissions.json restricts this peer's access

Fixes:
- Check permissions.json — add the skill to the peer's allowed list
- Use wildcard `["*"]` for admin peers
- Remove permissions.json entirely to allow all (Phase 1 default)

## Bridge Failures

Symptoms: `Bridge not configured`, `Gateway not running`, `Tool not in whitelist`

Causes:
- bridge.json missing or not enabled
- OpenClaw gateway not running
- Tool not in exposed_tools list

Fixes:
- Re-run `npm run setup:auto` to regenerate default config, or set `"enabled": true` in config/bridge.json
- Start gateway: `openclaw gateway start`
- Add tool to `exposed_tools` array
- Check gateway token: `cat ~/.openclaw/openclaw.json | jq '.gateway.auth.token'`

## Chat Target Not Resolved

Symptoms: `No target found`

Causes:
- Using a display name like `Pato` instead of a direct target, alias, or `@agent`
- Missing alias in `config/contacts.json`
- Missing `default_delivery` in `config/agent.json` for `@agent` delivery or broadcast landing

Fixes:
- Use `@agent-name` for agent-to-agent delivery
- Use `#channel@agent-name` for a named remote channel
- Use the platform-specific numeric ID directly
- Or define an alias in `config/contacts.json`, for example:
  `{"aliases":{"Pato":"552287292342009884","#general":"1480310282961289216","telegram:Pato":{"peerId":"telegram-agent","target":"5914004682","channel":"telegram"}}}`
- Configure `config/agent.json -> default_delivery` if this instance should receive target-less chat or broadcasts
- Run `npm run verify` after editing config

## Broadcast Reaches Peer But Does Not Deliver

Symptoms: peer accepts `broadcast`, but nothing is delivered on that platform

Causes:
- receiving peer exposes `broadcast`, but `config/agent.json` has no `default_delivery`
- `default_delivery.target` uses a local alias like `#general`, but that alias is missing in `config/contacts.json`

Fixes:
- set `config/agent.json -> default_delivery`
- if you use `#channel` names, map them in `config/contacts.json`
- run `npm run verify`

## Message Arrives But Receiving Agent Does Not Act

Symptoms: the message appears in Telegram / Discord / WhatsApp, but the receiving OpenClaw agent does not reply or continue the conversation

Causes:
- visible delivery succeeded, but inbound agent dispatch did not happen
- OpenClaw CLI is missing or not reachable as `openclaw`
- `bridge.agent_dispatch` is still disabled after setup
- `bridge.agent_dispatch.sessionKey` was forced to a wrong literal session instead of `auto`
- ClawBridge is targeting the wrong local OpenClaw agent because `config/agent.json.id` was assumed to be the OpenClaw agent ID
- ClawBridge could not find or reuse the right OpenClaw `sessionId` for the target destination
- the local OpenClaw agent activated, but its own delivery target was misconfigured

Fixes:
- ensure `config/bridge.json -> agent_dispatch.enabled` is `true`
- prefer `config/bridge.json -> agent_dispatch.sessionKey = "auto"` unless you have a known custom OpenClaw session key
- ensure `openclaw --version` works on that node, or set `OPENCLAW_BIN` to the full OpenClaw binary path
- if your OpenClaw install has multiple local agents, set `config/agent.json -> openclaw_agent_id` to the one that should wake up
- inspect `sessions_list` and confirm the target session has a row whose `deliveryContext` matches the real local destination; ClawBridge now reuses that row's `sessionId` when it can
- if there is no matching row yet, confirm `config/agent.json -> default_delivery` points to the real local destination where that agent should answer
- keep ClawBridge on the current version so visible delivery and agent activation share the same target session and reply destination
- run `npm run verify`

## Config Not Found

Symptoms: `Config file not found: agent.json`

Fixes:
- Run setup: `npm run setup`
- Or create configs manually (see docs/API_REFERENCE.md)
- Check A2A_CONFIG_DIR env var points to the right directory

## Docker Issues

Symptoms: Container starts but peers can't connect.

Fixes:
- Use container names in peers.json (not localhost): `http://openclaw-beta:9100`
- Ensure both containers are on the same Docker network
- Check healthcheck: `docker exec CONTAINER wget -qO- http://127.0.0.1:9100/health`
- Use `A2A_BIND=0.0.0.0` (not 127.0.0.1) in container env
