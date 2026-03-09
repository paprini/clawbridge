# Installation Instructions for EC2 Instances

**For Pato:** Manual testing on 3 real instances (Discord, WhatsApp, Telegram)

---

## Prerequisites

**3 EC2 instances:**
- Discord EC2: `10.0.1.10` (assumed private IP)
- WhatsApp EC2: `10.0.1.11`
- Telegram EC2: `10.0.1.12`

**Each instance should have:**
- OpenClaw gateway running
- Node.js 18+ installed
- Git installed
- Network connectivity on port 9100

---

## Installation (Run on EACH Instance)

### 1. Clone Repository

```bash
# SSH to instance
ssh user@10.0.1.10  # (or .11, .12)

# Navigate to install location
cd /opt  # or wherever you want it

# Clone repo
git clone https://github.com/paprini/openclaw-a2a.git
cd openclaw-a2a

# Install dependencies
npm install --production
```

---

### 2. Run Setup Agent

**Interactive mode (if you have LLM configured):**
```bash
npm run setup
```

**Non-interactive mode (recommended for testing):**
```bash
npm run setup:auto
```

**You'll be prompted for:**

**Agent name:** Use descriptive names
- Discord instance: `discord-agent`
- WhatsApp instance: `whatsapp-agent`
- Telegram instance: `telegram-agent`

**Agent URL:** Use private IPs
- Discord: `http://10.0.1.10:9100/a2a`
- WhatsApp: `http://10.0.1.11:9100/a2a`
- Telegram: `http://10.0.1.12:9100/a2a`

**Add peers:** Yes (add the other 2 instances)

**For each peer:**
- Peer name: `whatsapp-agent`, `telegram-agent`, etc.
- Peer URL: `http://10.0.1.11:9100/a2a` (the other instances)

**Generated config files:**
- `config/agent.json` — Your agent info
- `config/peers.json` — Other agents you can call
- `config/skills.json` — Skills you expose (ping, get_status)

---

### 3. Start A2A Server

**Simple start (foreground):**
```bash
node src/server.js
```

**Should see:**
```
🔧 Starting A2A agent...
✅ Agent card: discord-agent
✅ Listening: http://10.0.1.10:9100
✅ Ready to serve 2 skills: ping, get_status
```

**Background (with systemd - optional):**
```bash
# Create systemd service (adjust paths)
sudo tee /etc/systemd/system/openclaw-a2a.service << 'UNIT'
[Unit]
Description=OpenClaw A2A Agent
After=network.target

[Service]
Type=simple
User=openclaw
WorkingDirectory=/opt/openclaw-a2a
ExecStart=/usr/bin/node src/server.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
UNIT

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable openclaw-a2a
sudo systemctl start openclaw-a2a

# Check status
sudo systemctl status openclaw-a2a
```

---

## Testing Connectivity

### 1. Test Agent Card (No Auth Required)

```bash
# From any instance, check another instance's agent card
curl http://10.0.1.11:9100/.well-known/agent-card

# Should return JSON:
# {
#   "name": "whatsapp-agent",
#   "url": "http://10.0.1.11:9100/a2a",
#   "skills": ["ping", "get_status"]
# }
```

---

### 2. Test Ping (Auth Required)

**Get bearer token from peer's config:**
```bash
# On Discord instance, check WhatsApp peer's token
cat config/peers.json | grep -A 5 "whatsapp-agent"
```

**Call peer with token:**
```bash
# From Discord → WhatsApp
curl -H "Authorization: Bearer <TOKEN_FROM_PEERS_JSON>" \
     http://10.0.1.11:9100/a2a/jsonrpc \
     -H "Content-Type: application/json" \
     -d '{
       "jsonrpc": "2.0",
       "id": 1,
       "method": "ping",
       "params": {}
     }'

# Should return:
# {"jsonrpc":"2.0","id":1,"result":{"pong":true,"timestamp":"..."}}
```

---

### 3. Test Get Status

```bash
curl -H "Authorization: Bearer <TOKEN>" \
     http://10.0.1.11:9100/a2a/jsonrpc \
     -H "Content-Type: application/json" \
     -d '{
       "jsonrpc": "2.0",
       "id": 2,
       "method": "get_status",
       "params": {}
     }'

# Should return:
# {"jsonrpc":"2.0","id":2,"result":{"status":"ok","agent":"whatsapp-agent","uptime":...}}
```

---

### 4. Test All 6 Combinations

**Test matrix:**
- Discord → WhatsApp (ping + get_status)
- Discord → Telegram (ping + get_status)
- WhatsApp → Discord (ping + get_status)
- WhatsApp → Telegram (ping + get_status)
- Telegram → Discord (ping + get_status)
- Telegram → WhatsApp (ping + get_status)

**All 12 calls (6 pairs × 2 methods) should succeed.**

---

## Expected Results

### ✅ Success Indicators

1. **Setup completes without errors**
2. **Config files created in config/ directory**
3. **Server starts on port 9100**
4. **Agent card accessible (no auth)**
5. **Ping returns pong (with auth)**
6. **Get_status returns agent info (with auth)**
7. **All 6 instance pairs communicate**
8. **No auth = 401 Unauthorized**
9. **Bad token = 401 Unauthorized**
10. **Invalid skill = 404 Not Found**

### ❌ Failure Indicators

1. **Setup fails (missing deps, config errors)**
2. **Server won't start (port in use, permission denied)**
3. **Agent card 404 (URL wrong, server not running)**
4. **Ping fails (network issue, auth problem, firewall)**
5. **Any instance can't reach another**

---

## Troubleshooting

### Server Won't Start

**Port 9100 already in use:**
```bash
# Check what's using port 9100
sudo lsof -i :9100

# Kill process or change port in config/agent.json
```

**Permission denied:**
```bash
# Run as different user or adjust permissions
sudo chown -R $USER:$USER /opt/openclaw-a2a
```

---

### Connectivity Issues

**Can't reach peer:**
```bash
# Test network connectivity
ping 10.0.1.11

# Test port accessibility
nc -zv 10.0.1.11 9100

# Check firewall rules
sudo iptables -L -n | grep 9100

# Check security group (AWS)
# Ensure port 9100 is open from VPC CIDR (10.0.1.0/24)
```

**401 Unauthorized:**
```bash
# Verify token is correct
cat config/peers.json | grep -A 2 "whatsapp-agent"

# Ensure Authorization header format:
# Authorization: Bearer <64-char-hex-token>
```

---

### Config Issues

**Wrong peer URL:**
```bash
# Edit peers.json manually
nano config/peers.json

# Fix URL format: http://<ip>:9100/a2a
# Must include /a2a path
```

**Token mismatch:**
```bash
# Regenerate token on peer instance
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Update both sides:
# - Peer's agent.json (bearerToken)
# - Your peers.json (token for that peer)
```

---

## Clean Uninstall

```bash
# Stop service
sudo systemctl stop openclaw-a2a
sudo systemctl disable openclaw-a2a
sudo rm /etc/systemd/system/openclaw-a2a.service
sudo systemctl daemon-reload

# Or kill process
pkill -f "node src/server.js"

# Remove files
cd /opt
rm -rf openclaw-a2a
```

---

## Real-World Testing Checklist

**Before you start:**
- [ ] All 3 instances accessible via SSH
- [ ] Port 9100 open in security groups
- [ ] Git + Node.js 18+ installed
- [ ] ~10 min per instance for setup

**Per instance:**
- [ ] Clone repo
- [ ] Run `npm install`
- [ ] Run `npm run setup:auto`
- [ ] Configure agent name + URL
- [ ] Add 2 peers
- [ ] Start server
- [ ] Verify agent card accessible

**Cross-instance testing:**
- [ ] Test all 6 combinations (ping)
- [ ] Test all 6 combinations (get_status)
- [ ] Test auth rejection (no token)
- [ ] Test auth rejection (bad token)
- [ ] Test invalid skill call

**Document results:**
- [ ] Response times
- [ ] Any errors
- [ ] Friction points
- [ ] Performance issues

---

## Notes

- **Private network only** — No public IPs, VPC-only access
- **Bearer tokens are shared secrets** — Phase 2 will add unique tokens per peer
- **Only 2 skills exposed** — ping, get_status (ultra-conservative for Phase 1)
- **No OpenClaw integration yet** — Phase 2 will add bridge to call main agent tools

---

**When ready to test, follow steps above. Post results in Discord #pm.**
