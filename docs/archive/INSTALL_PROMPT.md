# ClawBridge Installation Instructions (For Agents)

**Target audience:** OpenClaw agents performing installation  
**Human users:** See README.md Quick Start for the prompt to give your agent

---

## Agent Installation Procedure

You are an OpenClaw agent tasked with installing ClawBridge on this machine. Follow these steps in order.

### Prerequisites Check

Before starting, verify:
- [ ] Node.js 18+ is installed (`node --version`)
- [ ] npm is installed (`npm --version`)
- [ ] git is installed (`git --version`)
- [ ] Port 9100 is available
- [ ] You have shell/exec access

If any prerequisite is missing, report to the user and ask for guidance.

### Step 1: Clone Repository

```bash
cd ~
git clone https://github.com/paprini/clawbridge.git
cd clawbridge
```

**Expected outcome:** Repository cloned successfully, you are in the `clawbridge` directory.

### Step 2: Install Dependencies

```bash
npm install
```

**Expected outcome:** Dependencies installed without errors. This may take 30-60 seconds.

### Step 3: Run Interactive Setup

```bash
npm run setup
```

**What this does:** Conversational setup agent will guide you through configuration.

**When prompted, provide:**

1. **Agent name:** Use this OpenClaw instance's name (e.g., "laptop-agent", "vps-agent")
2. **Agent URL:** `http://[this machine's IP address]:9100`
   - To find IP: `hostname -I | awk '{print $1}'`
   - Example: `http://192.168.1.100:9100`
3. **Peer agents:** Add other ClawBridge instances you want to connect to
   - Ask the user if you don't know which peers to add
   - Each peer needs: name, URL, bearer token
4. **Skills to expose:** At minimum, enable:
   - `ping` (connectivity testing)
   - `get_status` (health checks)
   - Additional skills as appropriate for this agent's role

**Expected outcome:** Configuration files created in `config/` directory.

### Step 4: Verify Configuration

```bash
npm run verify
```

**What this checks:**
- All required config files exist
- JSON syntax is valid
- Required fields are present
- Bearer tokens are properly formatted
- OpenClaw gateway is reachable (if bridge enabled)

**Expected outcome:** "✅ Configuration is valid"

If errors are reported, fix them before proceeding.

### Step 5: Start Server

```bash
npm start
```

**Expected outcome:** Server starts successfully on port 9100.

**What to report:**
- Server is running
- Listening on port 9100
- Agent name and URL
- Number of configured peers

### Step 6: Test Connectivity

```bash
npm run ping
```

**What this does:** Pings all configured peers to verify connectivity.

**Expected outcome:** Status for each peer showing:
- ✅ Reachable (200 OK)
- ❌ Unreachable (connection failed)

### Step 7: Report Back to User

Provide a summary with this structure:

```
ClawBridge installation complete.

Status:
- ✅ Server running on port 9100
- ✅ Agent name: [name]
- ✅ Agent URL: [url]

Connectivity test results:
- [peer-1]: ✅ Connected
- [peer-2]: ❌ Unreachable (reason)
- [peer-3]: ✅ Connected

Next steps:
[If all peers connected] → Ready to use. Try: "Execute skill X on [peer]"
[If some peers failed] → Check network connectivity and bearer tokens for failed peers.
[If no peers configured] → Add peers by editing config/peers.json and restarting.
```

---

## Post-Installation

### Production Deployment (Optional)

If this is a production instance, suggest:

1. **systemd service** (auto-start on boot):
   ```bash
   sudo cp deploy/clawbridge.service /etc/systemd/system/
   sudo systemctl enable clawbridge
   sudo systemctl start clawbridge
   ```

2. **HTTPS with Caddy** (if accessible from internet):
   ```bash
   sudo apt install caddy
   sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
   # Edit Caddyfile with domain name
   sudo systemctl restart caddy
   ```

### Monitoring

Suggest these health checks to the user:

- **Health endpoint:** `curl http://localhost:9100/health`
- **Metrics:** `curl http://localhost:9100/metrics`
- **Logs:** `journalctl -u clawbridge -f` (if systemd service)

---

## Troubleshooting

### Installation Fails

**Issue:** npm install errors  
**Solution:** Check Node.js version (`node --version` should be 18+)

**Issue:** Port 9100 already in use  
**Solution:** Check if ClawBridge is already running, or choose different port in config

**Issue:** Permission denied  
**Solution:** Ensure you're not trying to use privileged ports (<1024) without sudo

### Connectivity Test Fails

**Issue:** All peers show "Unreachable"  
**Possible causes:**
1. Peer servers not running
2. Network firewall blocking port 9100
3. Incorrect peer URLs in config
4. Invalid bearer tokens

**Solution:** Verify peer status, check firewall rules, validate config/peers.json

**Issue:** Authentication errors (403)  
**Solution:** Bearer tokens must match on both sides. Regenerate tokens if needed.

### Server Won't Start

**Issue:** "Address already in use"  
**Solution:** Another process is using port 9100. Kill it or use different port.

**Issue:** Config validation fails  
**Solution:** Run `npm run verify` to see specific errors, then fix config files.

---

## Key Differences from Traditional Software

**Traditional install:** User runs commands manually  
**ClawBridge install:** Agent runs commands automatically

**Traditional config:** User edits config files  
**ClawBridge config:** Agent answers conversational setup questions

**Traditional deployment:** User sets up systemd, firewalls, etc.  
**ClawBridge deployment:** Agent handles everything, reports status

**Key principle:** Your agent installs itself into the network. The installation process is itself agent-to-agent native.

---

## Security Notes for Agents

When configuring ClawBridge, follow these security principles:

1. **Skill whitelist:** Only expose skills that are safe for remote execution
2. **Bearer tokens:** Generate strong tokens, never reuse across peers
3. **Network isolation:** Prefer private networks (VPC) over public internet
4. **Audit logging:** Enabled by default, ensure user knows where logs are
5. **Rate limiting:** Default limits are conservative; adjust if user has specific needs

**Never expose high-risk skills without explicit user approval:**
- `exec` (arbitrary command execution)
- `read` (file system access)
- `write` (file system modification)

---

## Repository Information

- **GitHub:** https://github.com/paprini/clawbridge
- **Documentation:** See `docs/` directory for detailed guides
- **Support:** GitHub Issues for bugs, Discussions for questions
- **License:** MIT

---

**This file is for agent consumption. Human users should reference README.md.**
