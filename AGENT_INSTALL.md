# ClawBridge Agent Installation Guide

**This guide is written FOR AGENTS, not humans.**

You are an AI agent being instructed to install ClawBridge on this machine. Follow these steps exactly. Report progress at each stage.

---

## What is ClawBridge?

ClawBridge is an agent-to-agent (A2A) communication system that lets OpenClaw agents on different machines call each other's skills remotely. After installation, this agent instance will be able to communicate with other agents in the network.

---

## Prerequisites Check

**Before starting, verify these requirements are met:**

### 1. Node.js and npm
```bash
node --version  # Must be 18.0.0 or higher
npm --version   # Must be 8.0.0 or higher
```

**If not installed:**
- Report: "Node.js 18+ required but not found. Cannot proceed."
- Ask human to install Node.js first

### 2. Git
```bash
git --version
```

**If not installed:**
- Report: "Git required but not found. Cannot proceed."
- Ask human to install git first

### 3. Network Access
```bash
ping -c 1 github.com  # Test GitHub connectivity
```

**If fails:**
- Report: "Cannot reach GitHub. Check network connection or firewall."
- Ask human to verify network access

### 4. Disk Space
```bash
df -h .  # Check available disk space
```

**Required:** At least 50MB free space

**If insufficient:**
- Report: "Insufficient disk space (need 50MB). Cannot proceed."

---

## Installation Steps

### Step 1: Clone Repository

```bash
cd ~  # Or appropriate install location
git clone https://github.com/paprini/clawbridge.git
cd clawbridge
```

**Report:**
- ✅ "Repository cloned successfully to ~/clawbridge"
- ❌ "Clone failed: [error message]. Check repository access."

**If clone fails:**
- Verify repository is accessible (public or you have access)
- Check git credentials if private
- Report exact error and ask for guidance

### Step 2: Install Dependencies

```bash
npm install
```

**This will install:**
- @a2a-js/sdk (A2A protocol implementation)
- express (web server)
- dotenv (environment config)
- winston (logging)
- Other required dependencies

**Report:**
- ✅ "Dependencies installed successfully ([X] packages)"
- ❌ "npm install failed: [error message]"

**If install fails:**
- Check npm registry connectivity
- Verify Node.js version compatibility
- Report exact error

**Expected time:** 30-60 seconds

### Step 3: Run Interactive Setup

```bash
npm run setup
```

**The setup wizard will ask:**

1. **Agent name** — Use this OpenClaw instance's name (suggest: hostname)
2. **Agent URL** — Use `http://[this machine's IP]:9100`
3. **Peers to connect to** — List other agent instances to connect with
4. **Skills to expose** — Start with safe defaults: `ping`, `get_status`

**Answer based on:**
- This machine's network configuration
- The agent network topology you're joining
- Security preferences (only expose necessary skills)

**Report:**
- ✅ "Setup completed. Config files created."
- ❌ "Setup failed: [error message]"

**Config files created:**
- `config/agent.json` — This agent's identity
- `config/peers.json` — Known peer agents
- `config/skills.json` — Exposed skills

### Step 4: Verify Configuration

**CRITICAL: Test configuration BEFORE starting the server**

```bash
npm run verify
```

**This checks:**
- ✅ All required config files exist
- ✅ JSON syntax is valid
- ✅ Required fields are present
- ✅ Bearer tokens are properly formatted
- ✅ URLs are reachable

**Report:**
- ✅ "Configuration valid. Ready to start."
- ❌ "Configuration errors found: [list errors]"

**If verification fails:**
- DO NOT start the server yet
- Review and fix reported errors
- Run `npm run verify` again
- Only proceed when verification passes

### Step 5: Check if Server Already Running

**IMPORTANT: Avoid breaking existing setup**

```bash
# Check if ClawBridge is already running
lsof -i :9100  # Or: netstat -tuln | grep 9100
```

**If port 9100 is in use:**
- Report: "ClawBridge may already be running on port 9100"
- Check if it's this installation: `ps aux | grep "clawbridge\|src/server.js"`
- Ask human: "Should I restart the existing instance, or use a different port?"

**Do NOT blindly kill processes. Ask first.**

### Step 6: Start ClawBridge Server

**Option A: Foreground (for testing)**
```bash
npm start
```

**Option B: Background (production)**
```bash
# Using systemd (if available)
sudo cp deploy/clawbridge.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable clawbridge
sudo systemctl start clawbridge
```

**OR using nohup:**
```bash
nohup npm start > clawbridge.log 2>&1 &
echo $! > clawbridge.pid
```

**Report:**
- ✅ "ClawBridge server started on port 9100"
- ❌ "Server start failed: [error message]"

**Expected output when starting:**
```
ClawBridge A2A Server
Agent: [your-agent-name]
URL: http://[IP]:9100
Listening on port 9100...
✅ Server ready
```

### Step 7: Test Connectivity

**Wait 2-3 seconds for server to fully initialize, then:**

```bash
# Test 1: Health endpoint
curl -s http://localhost:9100/health

# Expected response:
# {"status":"healthy","uptime":...}
```

**Report:**
- ✅ "Health check passed. Server is responding."
- ❌ "Health check failed: [error]"

```bash
# Test 2: Agent Card
curl -s http://localhost:9100/.well-known/agent-card.json

# Expected: JSON with agent info
```

**Report:**
- ✅ "Agent Card accessible. Configuration valid."
- ❌ "Agent Card not found: [error]"

```bash
# Test 3: Ping peers
npm run ping

# Expected: Status for each configured peer
```

**Report:**
- ✅ "Connected to [X] peers: [list peer names]"
- ⚠️ "Connected to [X] peers, [Y] unreachable: [list unreachable]"
- ❌ "All peers unreachable. Check network/firewall."

### Step 8: Verify Network Accessibility

**Test if OTHER agents can reach THIS agent:**

```bash
# Get this machine's IP
hostname -I  # Or: ip addr show

# Test from another machine (if available)
# curl http://[this-IP]:9100/health
```

**Report:**
- ✅ "Agent is network-accessible at http://[IP]:9100"
- ⚠️ "Agent only accessible locally. Firewall may be blocking port 9100."

**Common firewall commands (if needed):**
```bash
# Check firewall status
sudo ufw status  # Ubuntu/Debian
sudo firewall-cmd --list-ports  # CentOS/RHEL

# Open port 9100 (ask human first)
sudo ufw allow 9100/tcp
# OR
sudo firewall-cmd --permanent --add-port=9100/tcp && sudo firewall-cmd --reload
```

**DO NOT modify firewall without explicit permission.**

---

## Success Criteria

✅ **Installation is successful when ALL of these are true:**

1. Repository cloned without errors
2. Dependencies installed (`npm install` succeeded)
3. Setup completed (config files created)
4. Configuration verified (`npm run verify` passed)
5. Server started without errors
6. Health endpoint responding (`/health` returns 200 OK)
7. Agent Card accessible (`/.well-known/agent-card.json` returns data)
8. At least one peer reachable (or zero peers configured is OK if this is first instance)

**Final Report Template:**
```
✅ ClawBridge installation complete

Summary:
- Agent name: [name]
- Agent URL: http://[IP]:9100
- Peers configured: [X]
- Peers reachable: [Y]
- Status: Running (PID: [process-id] or systemd service: active)

Next steps:
- Other agents can now connect to this instance
- Add more peers via config/peers.json
- Expose additional skills via config/skills.json
- Monitor logs: journalctl -u clawbridge -f (systemd) or tail -f clawbridge.log
```

---

## Troubleshooting Common Issues

### "Authentication failed" during setup
- Setup uses OpenAI-compatible LLM for conversational mode
- Either set OPENAI_API_KEY, or use `npm run setup:auto` (non-interactive)

### "Port 9100 already in use"
- Check what's using it: `lsof -i :9100`
- If it's another ClawBridge instance, decide: restart or use different port
- To use different port: set `A2A_PORT=9101` in `.env` file

### "Cannot reach peers"
- Verify peer URLs are correct in `config/peers.json`
- Check network connectivity: `ping [peer-IP]`
- Check firewall rules on both sides
- Verify peer agents are actually running

### "npm install fails"
- Check Node.js version: `node --version` (must be 18+)
- Clear npm cache: `npm cache clean --force`
- Try again: `npm install`
- Check npm registry access: `npm ping`

### "Permission denied" errors
- If installing globally: use sudo (ask first)
- If port < 1024: requires root (use port 9100, no sudo needed)
- If systemd service: requires sudo for systemctl commands

### "Configuration invalid" after setup
- Run `npm run verify` to see specific errors
- Check config/*.json files for syntax errors
- Validate JSON: `cat config/agent.json | jq .`
- Fix reported issues and verify again

---

## Configuration Files Reference

### `config/agent.json` (Required)
```json
{
  "id": "my-agent-id",
  "name": "My Agent Name",
  "description": "What this agent does",
  "url": "http://10.0.1.5:9100",
  "version": "0.1.0"
}
```

### `config/peers.json` (Required)
```json
{
  "peers": [
    {
      "id": "peer-agent-id",
      "url": "http://10.0.1.10:9100",
      "token": "bearer_token_64_characters_hex"
    }
  ]
}
```

### `config/skills.json` (Required)
```json
{
  "exposed_skills": [
    {
      "name": "ping",
      "description": "Health check",
      "public": true
    },
    {
      "name": "get_status",
      "description": "Agent status",
      "public": true
    }
  ]
}
```

### `config/bridge.json` (Optional)
Only needed if exposing OpenClaw Gateway tools to remote agents:
```json
{
  "enabled": true,
  "gateway_url": "http://localhost:18789",
  "exposed_tools": ["Read", "web_search", "web_fetch"]
}
```

**⚠️ Security Warning:** Only enable bridge features if you understand the security implications. Remote agents will be able to execute exposed tools on this machine.

---

## Restart Instructions

**If you need to restart ClawBridge:**

### Check Current Status First
```bash
# If using systemd
sudo systemctl status clawbridge

# If using background process
ps aux | grep "src/server.js"
```

### Safe Restart (systemd)
```bash
sudo systemctl restart clawbridge
sudo systemctl status clawbridge  # Verify it restarted
```

### Safe Restart (background process)
```bash
# Get PID
cat clawbridge.pid  # Or: ps aux | grep "src/server.js"

# Graceful shutdown
kill -TERM [PID]

# Wait a few seconds
sleep 3

# Verify it stopped
ps aux | grep [PID]

# Start again
nohup npm start > clawbridge.log 2>&1 &
echo $! > clawbridge.pid
```

### Verify After Restart
```bash
# Always verify after restarting
curl http://localhost:9100/health
npm run ping
```

**Report:**
- ✅ "ClawBridge restarted successfully. All health checks passed."
- ❌ "Restart failed: [error]. Server may not be running."

---

## Security Best Practices

**When configuring this agent:**

1. **Limit exposed skills** — Only expose what's necessary
2. **Use strong tokens** — Let setup generate random tokens (64-char hex)
3. **Private network preferred** — Deploy in VPC if possible, not public internet
4. **Review bridge config** — If enabling OpenClaw Bridge, carefully review which tools to expose
5. **Monitor access** — Check logs regularly for suspicious activity

**Report any security concerns to the human operator.**

---

## What to Report Back

**At each stage, report:**

1. **What you're doing** — "Installing dependencies..."
2. **Progress** — "50 packages installed, 12 remaining..."
3. **Success or failure** — "✅ Dependencies installed" or "❌ Install failed: [error]"
4. **Next step** — "Proceeding to configuration setup"

**At completion, provide:**
- Summary of installation status (see Success Criteria template above)
- Any warnings or issues encountered
- Configuration details (agent name, URL, peer count)
- Instructions for human to verify from other machines
- Any follow-up actions needed

---

## Example Installation Flow

**Full example of what a successful installation looks like:**

```
Agent: Starting ClawBridge installation...

[Step 1: Prerequisites]
✓ Node.js v18.16.0 detected
✓ npm v9.5.1 detected
✓ Git v2.39.2 detected
✓ GitHub connectivity verified
✓ Disk space: 2.3GB available

[Step 2: Clone Repository]
Executing: git clone https://github.com/paprini/clawbridge.git
✓ Repository cloned to ~/clawbridge

[Step 3: Install Dependencies]
Executing: npm install
Installing 47 packages...
✓ Dependencies installed (47 packages, 2.1MB)

[Step 4: Run Setup]
Executing: npm run setup
Agent name: work-laptop
Agent URL: http://192.168.1.100:9100
Scanning network for peers... found 1 peer (home-vps)
Configuring peer connection...
Generating bearer tokens...
✓ Setup completed

[Step 5: Verify Configuration]
Executing: npm run verify
Checking config/agent.json... ✓
Checking config/peers.json... ✓
Checking config/skills.json... ✓
Validating bearer tokens... ✓
Testing URLs... ✓
✓ Configuration valid

[Step 6: Check for Existing Server]
Checking port 9100... available
✓ No existing server found

[Step 7: Start Server]
Executing: npm start
ClawBridge A2A Server
Agent: work-laptop
URL: http://192.168.1.100:9100
Listening on port 9100...
✓ Server started (PID: 12345)

[Step 8: Test Connectivity]
Testing /health endpoint... ✓
Testing /agent-card endpoint... ✓
Pinging peers... 
  - home-vps: ✓ Connected (5ms)
✓ All connectivity tests passed

[Installation Complete]
✅ ClawBridge installation successful

Summary:
- Agent name: work-laptop
- Agent URL: http://192.168.1.100:9100
- Peers configured: 1
- Peers reachable: 1 (home-vps)
- Status: Running (PID: 12345)

This agent is now part of the A2A network and can communicate with:
- home-vps (http://192.168.1.50:9100)

To verify from another machine:
curl http://192.168.1.100:9100/health

To view logs:
tail -f clawbridge.log

Next steps:
- Configure additional skills in config/skills.json
- Add more peers in config/peers.json
- Set up systemd service for auto-start (deploy/clawbridge.service)
```

---

## Remember

1. **Test before starting** — Always run `npm run verify`
2. **Be careful with restarts** — Check if already running first
3. **Report everything** — Keep human informed of progress
4. **Ask when uncertain** — Better to ask than break existing setup
5. **Verify after changes** — Run health checks after every significant change

**You are installing a network service. Precision matters.**
