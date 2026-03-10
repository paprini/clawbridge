# QA Testing Guide — Phase 1 Real Instance Testing

**For:** Pato (manual testing on 3 EC2 instances)  
**Goal:** Verify clawbridge works on real production-like instances before ship  
**Instances:** Discord (10.0.1.10), WhatsApp (10.0.1.11), Telegram (10.0.1.12)

---

## Prerequisites Checklist

Before starting, verify:

- [ ] SSH access to all 3 instances
- [ ] Node.js 18+ installed on each instance (`node --version`)
- [ ] Git installed on each instance (`git --version`)
- [ ] Port 9100 available on each instance (`sudo lsof -i :9100` should return nothing)
- [ ] Security group allows port 9100 from VPC CIDR (10.0.1.0/24)
- [ ] Network connectivity between instances (`ping 10.0.1.11`, etc.)

---

## Test Plan Overview

**Total time:** ~45-60 minutes

1. **Installation (15 min)** — Install on all 3 instances
2. **Setup (15 min)** — Configure each instance
3. **Connectivity (15 min)** — Test all 6 agent pairs
4. **Security (10 min)** — Test auth + invalid requests
5. **Documentation (5 min)** — Verify docs match reality

---

## PART 1: Installation (15 minutes)

### Test Case 1.1: Clone Repository

**On Discord instance (10.0.1.10):**
```bash
ssh user@10.0.1.10
cd /opt
git clone https://github.com/paprini/clawbridge.git
cd clawbridge
```

**Expected:**
- ✅ Repository clones without errors
- ✅ Directory structure visible (`ls -la` shows src/, config/, tests/, etc.)

**On failure:** Check network access to GitHub, SSH keys if private repo

---

**Repeat on WhatsApp (10.0.1.11) and Telegram (10.0.1.12)**

---

### Test Case 1.2: Install Dependencies

**On each instance:**
```bash
cd /opt/clawbridge
npm install --production
```

**Expected:**
- ✅ Dependencies install without errors
- ✅ `node_modules/` directory created
- ✅ No security warnings (or only audit warnings, which are acceptable)

**On failure:**
- Check Node.js version (`node --version` >= 18)
- Check npm version (`npm --version` >= 8)
- Check disk space (`df -h`)

---

## PART 2: Setup (15 minutes)

### Test Case 2.1: Run Setup Agent (Discord Instance)

**On Discord instance:**
```bash
cd /opt/clawbridge
npm run setup:auto
```

**Prompts and responses:**

**Prompt:** `Agent name [hostname]:`  
**Enter:** `discord-agent`

**Prompt:** `Agent URL [http://YOUR_IP:9100/a2a]:`  
**Enter:** `http://10.0.1.10:9100/a2a`

**Prompt:** `Add a peer? (y/n)`  
**Enter:** `y`

**Prompt:** `Peer name:`  
**Enter:** `whatsapp-agent`

**Prompt:** `Peer URL:`  
**Enter:** `http://10.0.1.11:9100/a2a`

**Prompt:** `Add another peer? (y/n)`  
**Enter:** `y`

**Prompt:** `Peer name:`  
**Enter:** `telegram-agent`

**Prompt:** `Peer URL:`  
**Enter:** `http://10.0.1.12:9100/a2a`

**Prompt:** `Add another peer? (y/n)`  
**Enter:** `n`

**Expected output:**
```text
🔧 ClawBridge setup (non-interactive)

Agent name [hostname]: discord-agent
Agent URL [http://10.0.1.10:9100/a2a]: http://10.0.1.10:9100/a2a

✅ Generated bearer token (4ee91249...)

Add a peer? (y/N): y
  Peer name: whatsapp-agent
  Peer URL (e.g. http://10.0.1.11:9100): http://10.0.1.11:9100
  Add another? (y/N): y
  Peer name: telegram-agent
  Peer URL (e.g. http://10.0.1.12:9100): http://10.0.1.12:9100
  Add another? (y/N): n

✅ Config written to config/
Testing whatsapp-agent... ✅ connected
Testing telegram-agent... ✅ connected

✅ Setup complete!

Next step: Start your agent
  node src/server.js
```

**Expected files created:**
```bash
ls -la config/
# Should show:
# agent.json (your agent config)
# peers.json (other agents you can call)
# skills.json (skills you expose)
```

**Verify config contents:**
```bash
cat config/agent.json
# Should show:
# {
#   "id": "discord-agent",
#   "name": "discord-agent",
#   "description": "A2A agent: discord-agent",
#   "url": "http://10.0.1.10:9100/a2a",
#   "version": "0.1.0"
# }

cat config/peers.json
# Should show:
# {
#   "peers": [
#     { "id": "whatsapp-agent", "url": "http://10.0.1.11:9100", "token": "64-char-hex-string" },
#     { "id": "telegram-agent", "url": "http://10.0.1.12:9100", "token": "64-char-hex-string" }
#   ]
# }

cat config/skills.json
# Should show:
# {
#   "exposed_skills": [
#     { "name": "ping", "public": true, ... },
#     { "name": "get_status", "public": true, ... },
#     { "name": "chat", "public": true, ... },
#     { "name": "broadcast", "public": true, ... }
#   ]
# }
```

**On failure:**
- If setup fails: Check error message, verify Node.js version
- If files not created: Check permissions on config/ directory
- If wrong values in config: Re-run setup, verify input carefully

---

### Test Case 2.2: Setup WhatsApp Instance

**Repeat setup on WhatsApp instance (10.0.1.11):**
- Agent name: `whatsapp-agent`
- URL: `http://10.0.1.11:9100/a2a`
- Peers: `discord-agent` (10.0.1.10), `telegram-agent` (10.0.1.12)

---

### Test Case 2.3: Setup Telegram Instance

**Repeat setup on Telegram instance (10.0.1.12):**
- Agent name: `telegram-agent`
- URL: `http://10.0.1.12:9100/a2a`
- Peers: `discord-agent` (10.0.1.10), `whatsapp-agent` (10.0.1.11)

---

## PART 3: Start Servers (5 minutes)

### Test Case 3.1: Start A2A Server (All Instances)

**On Discord instance (in tmux or screen):**
```bash
cd /opt/clawbridge
node src/server.js
```

**Expected output:**
- ✅ Process starts without exiting
- ✅ Log includes `ClawBridge started`
- ✅ `curl http://10.0.1.10:9100/health` returns 200 OK

**Repeat on WhatsApp and Telegram instances**

**Expected:** All 3 servers running without errors

**On failure:**
- Port already in use: `sudo lsof -i :9100` and kill process
- Permission denied: Check user permissions
- Config error: Verify config files valid JSON

---

## PART 4: Connectivity Testing (15 minutes)

### Test Case 4.1: Agent Card (No Auth Required)

**From any machine, test each instance's agent card:**

```bash
# Discord agent card
curl http://10.0.1.10:9100/.well-known/agent-card

# WhatsApp agent card
curl http://10.0.1.11:9100/.well-known/agent-card

# Telegram agent card
curl http://10.0.1.12:9100/.well-known/agent-card
```

**Expected output (example for Discord):**
```json
{
  "name": "discord-agent",
  "url": "http://10.0.1.10:9100/a2a",
  "skills": ["ping", "get_status"]
}
```

**Verify:**
- ✅ Name matches what you configured
- ✅ URL is correct
- ✅ Skills array shows ["ping", "get_status"]

**On failure:**
- 404 Not Found: Server not running or wrong URL
- Connection refused: Firewall blocking port 9100

---

### Test Case 4.2: Ping (With Auth)

**Get bearer token for WhatsApp from Discord's peers.json:**
```bash
# On Discord instance
cat config/peers.json | grep -A 5 "whatsapp-agent"
# Copy the "token" value (64-char hex string)
```

**Test ping from Discord to WhatsApp:**
```bash
# Replace <TOKEN> with actual token from peers.json
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  http://10.0.1.11:9100/a2a \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "message/send",
    "params": {
      "message": {
        "kind": "message",
        "messageId": "qa-ping-1",
        "role": "user",
        "parts": [
          { "kind": "text", "text": "ping" }
        ]
      }
    }
  }'
```

**Expected output:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "kind": "message",
    "parts": [
      {
        "kind": "text",
        "text": "{\"status\":\"pong\",\"timestamp\":\"2026-03-09T19:42:00.000Z\"}"
      }
    ]
  }
}
```

**On failure:**
- 401 Unauthorized: Wrong token, check peers.json
- 404 Not Found: Wrong URL or server not running
- Connection timeout: Network/firewall issue

---

### Test Case 4.3: Get Status (With Auth)

**Test get_status from Discord to WhatsApp:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  http://10.0.1.11:9100/a2a \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "message/send",
    "params": {
      "message": {
        "kind": "message",
        "messageId": "qa-status-1",
        "role": "user",
        "parts": [
          { "kind": "text", "text": "get_status" }
        ]
      }
    }
  }'
```

**Expected output:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "kind": "message",
    "parts": [
      {
        "kind": "text",
        "text": "{\"agent\":{\"id\":\"whatsapp-agent\",\"name\":\"whatsapp-agent\"},\"uptime\":123.456,\"skills\":[\"ping\",\"get_status\"]}"
      }
    ]
  }
}
```

---

### Test Case 4.4: All 6 Agent Pairs

**Complete test matrix (12 total calls: 6 pairs × 2 methods):**

| From     | To       | Ping | Get Status |
|----------|----------|------|------------|
| Discord  | WhatsApp | [ ]  | [ ]        |
| Discord  | Telegram | [ ]  | [ ]        |
| WhatsApp | Discord  | [ ]  | [ ]        |
| WhatsApp | Telegram | [ ]  | [ ]        |
| Telegram | Discord  | [ ]  | [ ]        |
| Telegram | WhatsApp | [ ]  | [ ]        |

**For each combination:**
1. Get token from source's peers.json
2. Call target's `/a2a` endpoint with JSON-RPC `message/send`
3. Verify response is valid JSON-RPC 2.0
4. Parse `result.parts[0].text` as JSON and check the expected fields

**Expected:** All 12 calls succeed (200 OK, valid response)

---

## PART 5: Security Testing (10 minutes)

### Test Case 5.1: No Authorization Header

```bash
# Attempt ping without auth
curl -X POST \
  -H "Content-Type: application/json" \
  http://10.0.1.11:9100/a2a \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "message/send",
    "params": {
      "message": {
        "kind": "message",
        "messageId": "qa-auth-missing",
        "role": "user",
        "parts": [
          { "kind": "text", "text": "ping" }
        ]
      }
    }
  }'
```

**Expected:** HTTP `401 Unauthorized`

**Verify:** ✅ 401 response from the server

---

### Test Case 5.2: Invalid Token

```bash
# Attempt ping with bad token
curl -X POST \
  -H "Authorization: Bearer invalid_token_12345" \
  -H "Content-Type: application/json" \
  http://10.0.1.11:9100/a2a \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "message/send",
    "params": {
      "message": {
        "kind": "message",
        "messageId": "qa-auth-invalid",
        "role": "user",
        "parts": [
          { "kind": "text", "text": "ping" }
        ]
      }
    }
  }'
```

**Expected:** HTTP `403 Forbidden`

---

### Test Case 5.3: Invalid Skill Call

```bash
# Attempt to call non-existent skill
curl -X POST \
  -H "Authorization: Bearer <VALID_TOKEN>" \
  -H "Content-Type: application/json" \
  http://10.0.1.11:9100/a2a \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "message/send",
    "params": {
      "message": {
        "kind": "message",
        "messageId": "qa-invalid-skill",
        "role": "user",
        "parts": [
          { "kind": "text", "text": "delete_all_files" }
        ]
      }
    }
  }'
```

**Expected:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "kind": "message",
    "parts": [
      {
        "kind": "text",
        "text": "{\"error\":\"Unknown skill. Run `npm run status` to see available skills.\"}"
      }
    ]
  }
}
```

**Verify:** ✅ Skill whitelist is enforced and unknown skills are rejected cleanly

---

## PART 6: Documentation Verification (5 minutes)

### Test Case 6.1: README Accuracy

**Check:** Does INSTALL_INSTANCES.md match reality?

- [ ] Clone command works
- [ ] npm install works
- [ ] Setup prompts match doc
- [ ] Server start command works
- [ ] Example curl commands work
- [ ] Expected outputs match doc

**On mismatch:** Document discrepancy in test results

---

### Test Case 6.2: Error Messages

**Check:** Are error messages helpful?

Test a few error scenarios:
- Setup with existing config
- Start server when port in use
- Call with bad token

**Verify:**
- [ ] Error messages explain what went wrong
- [ ] Error messages suggest how to fix
- [ ] No cryptic stack traces shown to user

---

## Test Results Template

**Copy this template and fill in results:**

```markdown
# QA Test Results — Phase 1 Real Instance Testing

**Date:** 2026-03-09  
**Tester:** Pato  
**Instances:** Discord (10.0.1.10), WhatsApp (10.0.1.11), Telegram (10.0.1.12)

---

## Installation (15 min)

- [ ] Repository cloned on all 3 instances
- [ ] Dependencies installed without errors
- [ ] Config directories created

**Issues:** (none / list)

---

## Setup (15 min)

- [ ] Discord agent configured correctly
- [ ] WhatsApp agent configured correctly
- [ ] Telegram agent configured correctly
- [ ] Config files valid JSON
- [ ] Tokens generated (64-char hex)

**Issues:** (none / list)

---

## Server Startup (5 min)

- [ ] Discord server started on port 9100
- [ ] WhatsApp server started on port 9100
- [ ] Telegram server started on port 9100
- [ ] All servers show "Ready to serve" message

**Issues:** (none / list)

---

## Connectivity Testing (15 min)

### Agent Cards (No Auth)
- [ ] Discord agent card accessible
- [ ] WhatsApp agent card accessible
- [ ] Telegram agent card accessible

### Ping (With Auth)
- [ ] Discord → WhatsApp
- [ ] Discord → Telegram
- [ ] WhatsApp → Discord
- [ ] WhatsApp → Telegram
- [ ] Telegram → Discord
- [ ] Telegram → WhatsApp

### Get Status (With Auth)
- [ ] Discord → WhatsApp
- [ ] Discord → Telegram
- [ ] WhatsApp → Discord
- [ ] WhatsApp → Telegram
- [ ] Telegram → Discord
- [ ] Telegram → WhatsApp

**Issues:** (none / list)

---

## Security Testing (10 min)

- [ ] No auth = 401 Unauthorized
- [ ] Bad token = 401 Unauthorized
- [ ] Invalid skill = 404 Not Found
- [ ] Only ping + get_status exposed

**Issues:** (none / list)

---

## Documentation (5 min)

- [ ] INSTALL_INSTANCES.md accurate
- [ ] Setup prompts match doc
- [ ] Error messages helpful

**Issues:** (none / list)

---

## Overall Results

**Total test time:** ___ minutes  
**Tests passed:** ___ / 12  
**Tests failed:** ___ / 12

**Recommendation:**
- [ ] Ship it (all tests pass)
- [ ] Fix issues first (list blockers)
- [ ] Needs discussion (unclear results)

**Blocking issues:** (none / list with severity)

**Nice-to-have improvements:** (optional polish)

---

**Notes:**
(Any observations, performance issues, friction points, suggestions)
```

---

## Troubleshooting

### Server Won't Start

**Error:** "Port 9100 already in use"
```bash
# Find what's using port 9100
sudo lsof -i :9100

# Kill the process
sudo kill -9 <PID>

# Or change port in config/agent.json
```

---

### Can't Reach Peer

**Error:** "Connection refused" or timeout

```bash
# Test network connectivity
ping 10.0.1.11

# Test port connectivity
nc -zv 10.0.1.11 9100

# Check firewall (AWS Security Group)
# Ensure port 9100 open from 10.0.1.0/24
```

---

### 401 Unauthorized

**Error:** "Missing or invalid bearer token"

```bash
# Verify token in peers.json
cat config/peers.json | grep -A 2 "whatsapp-agent"

# Ensure Authorization header format:
# Authorization: Bearer <64-char-hex-token>
# NOT: "Bearer: <token>"
# NOT: just "<token>"
```

---

### Wrong Agent Card

**Error:** Agent card shows wrong name/URL

```bash
# Check agent.json
cat config/agent.json

# If wrong, re-run setup:
rm -rf config/
npm run setup:auto
```

---

## After Testing

**Post results in Discord #pm:**

```
QA Results — Phase 1 Real Instance Testing

Installation: ✅ / ❌
Setup: ✅ / ❌
Connectivity: X / 12 tests passed
Security: ✅ / ❌

Blocking issues:
- (none / list)

Nice-to-have:
- (optional improvements)

Recommendation: Ship it / Fix X first
```

---

**Then PM will coordinate next steps (fixes if needed, or ship if clean).**
