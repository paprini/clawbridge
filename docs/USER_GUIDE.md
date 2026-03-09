# openclaw-a2a User Guide

**For:** New users who want to connect their OpenClaw agents across machines  
**Time to setup:** 5-10 minutes  
**Skill level:** Basic terminal familiarity

---

## What is openclaw-a2a?

**The problem:**
Your OpenClaw agents are isolated on different machines. If you want your laptop agent to use your VPS agent's skills, you have to manually copy files, SSH, or write custom scripts.

**The solution:**
openclaw-a2a lets your agents call each other directly:

```javascript
// Before: Manual SSH and file copying
// After: Direct skill calls
laptop-agent → code-reviewer@vps.review_pr()
```

**Use cases:**
- Your laptop agent calls your VPS agent's GPU-powered skills
- Your Raspberry Pi sensor agent sends data to your cloud processing agent
- Your research agent calls a PDF parser on another machine
- Any agent can use any other agent's skills (with your permission)

---

## What You Need

**Requirements:**
- 2+ machines running OpenClaw (laptop, VPS, Raspberry Pi, etc.)
- Node.js 18+ installed on each machine
- Network connectivity between machines (LAN, VPN, or VPC)
- 5-10 minutes per machine

**Optional:**
- OpenAI API key or local LLM (for conversational setup)
- Docker (if you prefer containers)

---

## Quick Start (5 Minutes)

### Step 1: Install openclaw-a2a

**On each machine:**

```bash
# Clone the repository
git clone https://github.com/paprini/openclaw-a2a.git
cd openclaw-a2a

# Install dependencies
npm install
```

---

### Step 2: Run Setup

**Option A: Conversational Setup (with LLM)**

If you have an OpenAI API key or local LLM:

```bash
export OPENAI_API_KEY="your-api-key"
npm run setup
```

The setup assistant will ask you questions and configure everything automatically.

**Option B: Manual Setup (no LLM required)**

```bash
npm run setup:auto
```

You'll be prompted for:

**1. Agent name** — Give your agent a descriptive name
```
Agent name [hostname]: laptop-agent
```

**2. Agent URL** — Your machine's network address
```
Agent URL [http://YOUR_IP:9100/a2a]: http://192.168.1.10:9100/a2a
```

**3. Add peers** — Other agents you want to connect to
```
Add a peer? (y/n) y
Peer name: vps-agent
Peer URL: http://192.168.1.20:9100/a2a
```

**Setup creates 3 config files:**
- `config/agent.json` — Your agent's info
- `config/peers.json` — Other agents you can call
- `config/skills.json` — Skills you expose (default: ping, get_status)

---

### Step 3: Start Your Agent

```bash
node src/server.js
```

You should see:
```
🔧 Starting A2A agent...
✅ Agent card: laptop-agent
✅ Listening: http://192.168.1.10:9100
✅ Ready to serve 2 skills: ping, get_status
```

**Repeat Steps 1-3 on each machine.**

---

### Step 4: Test Connectivity

**From any machine, test the connection:**

```bash
# Replace with your actual peer URL and token
curl -H "Authorization: Bearer <TOKEN_FROM_PEERS_JSON>" \
     http://192.168.1.20:9100/a2a/jsonrpc \
     -H "Content-Type: application/json" \
     -d '{
       "jsonrpc": "2.0",
       "id": 1,
       "method": "ping",
       "params": {}
     }'
```

**Expected response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "pong": true,
    "timestamp": "2026-03-09T19:43:00.000Z"
  }
}
```

✅ **Your agents are now connected!**

---

## Common Scenarios

### Scenario 1: Two Agents on Your Home Network

**Setup:**
- Laptop: 192.168.1.10
- Desktop: 192.168.1.20

**On laptop:**
```bash
npm run setup:auto
# Agent name: laptop-agent
# URL: http://192.168.1.10:9100/a2a
# Add peer: desktop-agent at http://192.168.1.20:9100/a2a
```

**On desktop:**
```bash
npm run setup:auto
# Agent name: desktop-agent
# URL: http://192.168.1.20:9100/a2a
# Add peer: laptop-agent at http://192.168.1.10:9100/a2a
```

**Result:** Laptop and desktop agents can call each other's skills.

---

### Scenario 2: Local + VPS

**Setup:**
- Laptop: 192.168.1.10 (local)
- VPS: 10.0.1.5 (private VPN or VPC)

**Requirements:**
- VPN or VPC connecting your laptop to VPS private network
- Port 9100 open between machines

**On laptop:**
```bash
npm run setup:auto
# Agent name: laptop-agent
# URL: http://192.168.1.10:9100/a2a
# Add peer: vps-agent at http://10.0.1.5:9100/a2a
```

**On VPS:**
```bash
npm run setup:auto
# Agent name: vps-agent
# URL: http://10.0.1.5:9100/a2a
# Add peer: laptop-agent at http://192.168.1.10:9100/a2a
```

**Result:** Laptop agent can call VPS agent's skills (e.g., GPU-powered processing).

---

### Scenario 3: Three Agents (Full Mesh)

**Setup:**
- Machine A: 192.168.1.10
- Machine B: 192.168.1.20
- Machine C: 192.168.1.30

**On each machine, add the other two as peers:**

**Machine A:**
```bash
# Add peers: B and C
npm run setup:auto
# Peers: agent-b (192.168.1.20), agent-c (192.168.1.30)
```

**Machine B:**
```bash
# Add peers: A and C
npm run setup:auto
# Peers: agent-a (192.168.1.10), agent-c (192.168.1.30)
```

**Machine C:**
```bash
# Add peers: A and B
npm run setup:auto
# Peers: agent-a (192.168.1.10), agent-b (192.168.1.20)
```

**Result:** All 3 agents can call each other.

---

## Understanding the Parts

### Agent Card

Every agent exposes an "agent card" at `/.well-known/agent-card`:

```bash
curl http://192.168.1.20:9100/.well-known/agent-card
```

**Returns:**
```json
{
  "name": "vps-agent",
  "url": "http://192.168.1.20:9100/a2a",
  "skills": ["ping", "get_status"]
}
```

This tells other agents:
- My name
- How to reach me
- What skills I offer

**No authentication required** — anyone on the network can see your agent card.

---

### Bearer Tokens

**What are they?**
Secret passwords that let agents authenticate with each other.

**Where are they?**
- Your token: `config/agent.json` → `bearerToken`
- Peer tokens: `config/peers.json` → each peer has a `token` field

**How they work:**
1. When you add a peer during setup, you're given their token
2. You store it in your `config/peers.json`
3. When you call that peer, you include the token in the `Authorization` header
4. The peer checks the token and either accepts or rejects your call

**Security:**
- Tokens are 64-character random hex strings (256 bits of entropy)
- Stored in plaintext files with 0600 permissions (owner-only access)
- Phase 2 will add per-peer unique tokens (right now all peers share the same token)

---

### Skills

**What are skills?**
Functions that your agent exposes for others to call.

**Default skills (Phase 1):**
- `ping` — Test connectivity (returns `{pong: true}`)
- `get_status` — Get agent info (returns name, uptime, skills list)

**Phase 2 will add:**
- Custom skills (expose any function)
- OpenClaw bridge (call your main agent's tools from A2A)
- Skill permissions (control who can call what)

**For now:** All peers can call `ping` and `get_status` on any agent.

---

### Config Files

**config/agent.json** — Your agent's identity
```json
{
  "name": "laptop-agent",
  "url": "http://192.168.1.10:9100/a2a",
  "bearerToken": "a1b2c3d4..." // 64-char hex
}
```

**config/peers.json** — Other agents you can call
```json
{
  "peers": [
    {
      "name": "vps-agent",
      "url": "http://192.168.1.20:9100/a2a",
      "token": "e5f6g7h8..." // Their token
    }
  ]
}
```

**config/skills.json** — Skills you expose
```json
{
  "exposed_skills": ["ping", "get_status"]
}
```

---

## Advanced Usage

### Running in the Background

**With systemd (Linux):**

```bash
# Create service file
sudo nano /etc/systemd/system/openclaw-a2a.service
```

**Paste:**
```ini
[Unit]
Description=OpenClaw A2A Agent
After=network.target

[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/path/to/openclaw-a2a
ExecStart=/usr/bin/node src/server.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

**Enable and start:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable openclaw-a2a
sudo systemctl start openclaw-a2a
```

---

### Docker Deployment

**Build image:**
```bash
docker build -t openclaw-a2a .
```

**Run container:**
```bash
docker run -d \
  --name my-a2a-agent \
  -p 9100:9100 \
  -v $(pwd)/config:/app/config \
  -e A2A_SHARED_TOKEN="$(openssl rand -hex 32)" \
  openclaw-a2a
```

**Or use docker-compose:**
```bash
# Set token in environment
export A2A_SHARED_TOKEN="$(openssl rand -hex 32)"

# Start
docker-compose up -d
```

See `docker-compose.yml` for multi-agent example.

---

### Network Discovery

**Auto-discover agents on your network:**

```bash
npm run setup
# The setup assistant will scan your local network
# and find other A2A agents automatically
```

**Manual discovery:**
```bash
# Scan a specific subnet
node -e "
const { scanNetwork } = require('./src/setup/tools');
scanNetwork('192.168.1.0/24').then(console.log);
"
```

---

## Troubleshooting

### "Port 9100 already in use"

**Check what's using it:**
```bash
sudo lsof -i :9100
```

**Kill the process or change the port:**
```bash
# Edit config/agent.json
# Change URL to use a different port (e.g., 9101)
```

---

### "Connection refused"

**Test network connectivity:**
```bash
# Can you reach the peer's IP?
ping 192.168.1.20

# Is port 9100 accessible?
nc -zv 192.168.1.20 9100
```

**Common causes:**
- Firewall blocking port 9100
- Peer's server not running
- Wrong IP address in config

**Fix:**
- Open port 9100 in your firewall
- Start the peer's server
- Verify IP addresses in `config/peers.json`

---

### "401 Unauthorized"

**This means the bearer token is wrong.**

**Check:**
1. Is the token in your `config/peers.json` correct?
2. Does it match the peer's token in their `config/agent.json`?

**Fix:**
```bash
# On peer machine, get their token
cat config/agent.json | grep bearerToken

# On your machine, update peers.json with correct token
nano config/peers.json
```

---

### "Agent card not found"

**This means the agent isn't running or the URL is wrong.**

**Test:**
```bash
# Try to fetch the agent card
curl http://192.168.1.20:9100/.well-known/agent-card
```

**If it fails:**
- Check if the peer's server is running (`ps aux | grep node`)
- Verify the URL in `config/peers.json` is correct
- Ensure port 9100 is accessible

---

## Security Best Practices

### Private Networks Only (Phase 1)

**Current recommendation:** Only use openclaw-a2a on private networks (LAN, VPN, VPC).

**Why?**
- Bearer tokens are shared secrets (not per-peer unique yet)
- No rate limiting on public endpoints (yet)
- Agent card is publicly readable (exposes your agent's name and skills)

**Phase 2 will add:**
- Per-peer unique tokens
- Rate limiting
- Public internet deployment support

---

### Token Security

**Keep tokens secret:**
- Don't commit config files to git (add `config/` to `.gitignore`)
- Don't share tokens in Slack/Discord/email
- Rotate tokens periodically

**File permissions:**
- Setup automatically sets `config/peers.json` to 0600 (owner-only)
- Verify: `ls -la config/peers.json` should show `-rw-------`

---

### Exposed Skills

**Phase 1 only exposes:**
- `ping` — Safe (just returns timestamp)
- `get_status` — Safe (only returns agent name, uptime, skills list)

**Phase 2 will let you expose custom skills:**
- Be conservative about what you expose
- Don't expose destructive operations (delete, modify files)
- Use granular permissions (coming in Phase 2)

---

## What's Next

### Phase 2 Features (Coming Soon)

**OpenClaw Bridge:**
- Call your main agent's tools from A2A
- Example: `laptop-agent → vps-agent.run_python_script()`

**Custom Skills:**
- Expose any function as a skill
- Example: `analyze_data`, `process_pdf`, `run_model`

**Granular Permissions:**
- Control who can call which skills
- Per-peer, per-skill access control

**Rate Limiting:**
- Protect against abuse
- Configurable limits per skill

**Health Monitoring:**
- Dashboard showing agent status
- Metrics (calls/sec, errors, latency)

**Multi-Agent Orchestration:**
- Chain calls: A → B → C
- Fan-out: A → [B, C, D] → aggregate results

---

## Getting Help

**Documentation:**
- README.md — Project overview
- GETTING_STARTED.md — Developer setup
- CONTRIBUTING.md — How to contribute
- QA_TESTING_GUIDE.md — Testing guide

**Issues:**
- GitHub Issues: https://github.com/paprini/openclaw-a2a/issues

**Community:**
- OpenClaw Discord: https://discord.com/invite/clawd

---

## Example: Real-World Workflow

**Scenario:** You want your laptop agent to use your VPS agent's GPU for image analysis.

**Setup (5 minutes):**

1. **On VPS (10.0.1.5):**
```bash
git clone https://github.com/paprini/openclaw-a2a.git
cd openclaw-a2a
npm install
npm run setup:auto
# Name: vps-agent
# URL: http://10.0.1.5:9100/a2a
# No peers yet
node src/server.js &
```

2. **On Laptop (192.168.1.10 with VPN to VPS):**
```bash
git clone https://github.com/paprini/openclaw-a2a.git
cd openclaw-a2a
npm install
npm run setup:auto
# Name: laptop-agent
# URL: http://192.168.1.10:9100/a2a
# Add peer: vps-agent at http://10.0.1.5:9100/a2a
node src/server.js &
```

3. **Test:**
```bash
# Get VPS token from laptop's peers.json
TOKEN=$(cat config/peers.json | jq -r '.peers[0].token')

# Call VPS from laptop
curl -H "Authorization: Bearer $TOKEN" \
     http://10.0.1.5:9100/a2a/jsonrpc \
     -d '{"jsonrpc":"2.0","id":1,"method":"ping","params":{}}'
```

**Result:**
```json
{"jsonrpc":"2.0","id":1,"result":{"pong":true,"timestamp":"..."}}
```

✅ **Laptop and VPS are connected!**

**Phase 2:** You'll be able to expose a custom `analyze_image` skill on the VPS and call it from your laptop agent.

---

## Summary

**What you learned:**
- openclaw-a2a connects your OpenClaw agents across machines
- Setup takes 5-10 minutes per machine
- Agents authenticate with bearer tokens
- Default skills: ping, get_status
- Use on private networks (LAN, VPN, VPC)

**Next steps:**
1. Install on 2+ machines
2. Run setup on each
3. Test connectivity
4. Wait for Phase 2 (custom skills, OpenClaw bridge)

**Questions?** Check the docs or ask in Discord.

---

**Welcome to multi-machine OpenClaw! 🚀**
