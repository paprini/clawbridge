# ClawBridge Uninstall Guide

**This guide is written FOR AGENTS, not humans.**

You are an AI agent being instructed to uninstall ClawBridge from this machine. Follow these steps carefully. This will completely remove ClawBridge and all associated files.

---

## Important Safety Notes

⚠️ **BEFORE YOU START:**

1. **Confirm with human** — Ask: "Should I proceed with ClawBridge uninstall? This will stop the server, remove all config, and disconnect from the network."
2. **Data backup** — Config files will be deleted. If needed, ask: "Should I backup config files before uninstalling?"
3. **Network impact** — Other agents will lose connection to this instance
4. **Irreversible** — After completion, complete reinstall required to rejoin network

**DO NOT proceed without confirmation.**

---

## Quick Uninstall (Recommended)

If the automated uninstall script is available:

```bash
cd /path/to/clawbridge
npm run uninstall
```

This will guide you through the process with confirmations at each step.

**Continue to Manual Uninstall below if:**
- Script is not available
- Script fails
- You need more control over the process

---

## Manual Uninstall

### Step 1: Notify Peers (Graceful Shutdown)

**IMPORTANT: Tell other agents you're going offline**

This prevents connection errors and allows peers to update their configs.

```bash
# Send disconnect notification to all peers
curl -X POST http://localhost:9100/api/disconnect \
  -H "Content-Type: application/json" \
  -d '{"reason": "Uninstalling ClawBridge", "permanent": true}'
```

**Report:**
- ✅ "Disconnect notification sent to [X] peers"
- ⚠️ "Server not responding, skipping notification"
- ❌ "Notification failed: [error]"

**If notification fails:** Continue anyway (server may already be stopped)

### Step 2: Stop ClawBridge Server

**Check how ClawBridge is running:**

#### Option A: Running as systemd Service

```bash
# Check if systemd service exists
sudo systemctl status clawbridge 2>/dev/null
```

**If service exists:**
```bash
# Stop the service
sudo systemctl stop clawbridge

# Disable auto-start
sudo systemctl disable clawbridge

# Verify it stopped
sudo systemctl status clawbridge
```

**Report:**
- ✅ "Systemd service stopped and disabled"
- ❌ "Failed to stop service: [error]"

#### Option B: Running as Background Process

```bash
# Find ClawBridge process
ps aux | grep "src/server.js" | grep -v grep
```

**If process found:**
```bash
# Get PID (from ps output or PID file)
PID=$(cat clawbridge.pid 2>/dev/null || ps aux | grep "src/server.js" | grep -v grep | awk '{print $2}')

# Graceful shutdown (SIGTERM)
kill -TERM $PID

# Wait 5 seconds for graceful shutdown
sleep 5

# Verify it stopped
ps -p $PID > /dev/null 2>&1
if [ $? -eq 0 ]; then
    # Still running, force kill
    kill -9 $PID
    echo "Force killed process $PID"
fi
```

**Report:**
- ✅ "Background process stopped (PID: [X])"
- ⚠️ "Required force kill (process didn't stop gracefully)"
- ❌ "Failed to stop process: [error]"

#### Option C: Running in Foreground

If running in an active terminal session:
- Press `Ctrl+C` to stop
- Wait for graceful shutdown message

**Report:**
- ✅ "Server stopped via Ctrl+C"

#### Verify Server is Stopped

```bash
# Check if port 9100 is still in use
lsof -i :9100 2>/dev/null || echo "Port 9100 is free"

# Or using netstat
netstat -tuln | grep 9100 || echo "Port 9100 is free"
```

**Report:**
- ✅ "ClawBridge server confirmed stopped"
- ❌ "Server still running on port 9100"

### Step 3: Remove systemd Service (if installed)

**Only if installed as systemd service:**

```bash
# Check if service file exists
if [ -f /etc/systemd/system/clawbridge.service ]; then
    # Stop and disable (already done in Step 2, but double-check)
    sudo systemctl stop clawbridge 2>/dev/null
    sudo systemctl disable clawbridge 2>/dev/null
    
    # Remove service file
    sudo rm /etc/systemd/system/clawbridge.service
    
    # Reload systemd
    sudo systemctl daemon-reload
    
    # Reset failed state
    sudo systemctl reset-failed clawbridge 2>/dev/null
    
    echo "systemd service removed"
fi
```

**Report:**
- ✅ "systemd service file removed and daemon reloaded"
- ⚠️ "No systemd service found, skipping"

### Step 4: Remove ClawBridge Directory

**⚠️ CRITICAL: Confirm before deleting**

```bash
# Confirm current location
pwd
# Should show something like: /home/user/clawbridge or /opt/clawbridge

# Ask human for confirmation
# "About to delete ClawBridge directory at: [path]"
# "This will remove all config files. Proceed? (yes/no)"
```

**After confirmation:**

```bash
# Navigate OUT of ClawBridge directory
cd ~

# Remove directory (use absolute path to be safe)
rm -rf /path/to/clawbridge
# Or wherever it's installed: /opt/clawbridge, /path/to/clawbridge, etc.
```

**Report:**
- ✅ "ClawBridge directory removed: [path]"
- ❌ "Failed to remove directory: [error]"

**Common install locations to check:**
- `/path/to/clawbridge/`
- `/opt/clawbridge/`
- `/usr/local/clawbridge/`
- `/var/www/clawbridge/`

### Step 5: Remove Logs

**ClawBridge may have created log files in various locations:**

```bash
# Remove logs in ClawBridge directory (if separate)
rm -f /var/log/clawbridge/*.log 2>/dev/null

# Remove journald logs (systemd)
sudo journalctl --vacuum-time=1s --unit=clawbridge 2>/dev/null

# Remove any standalone log files
rm -f /path/to/clawbridge.log 2>/dev/null
rm -f /tmp/clawbridge*.log 2>/dev/null
```

**Report:**
- ✅ "Log files removed"
- ⚠️ "No log files found"

### Step 6: Clean Up User/Group (if created)

**Only if you created dedicated user/group for ClawBridge:**

```bash
# Check if openclaw user exists
id openclaw 2>/dev/null

# If exists and used ONLY for ClawBridge:
# sudo userdel -r openclaw  # Removes user and home directory
```

**⚠️ DO NOT remove user/group if:**
- Used by other services (like OpenClaw itself)
- Uncertain about its purpose

**Ask human:** "Found system user 'openclaw'. Is this used ONLY for ClawBridge, or also by other services?"

**Report:**
- ✅ "User/group removed (if dedicated)"
- ⚠️ "User/group preserved (shared with other services)"
- ⚠️ "No dedicated user found, skipping"

### Step 7: Remove from Peer Configs (Network Cleanup)

**⚠️ MANUAL STEP — Cannot be automated**

This agent instance must be removed from OTHER agents' configs.

**Instructions for human:**
```
On each peer machine, edit their ClawBridge config:

1. Open: /path/to/clawbridge/config/peers.json
2. Remove this agent's entry:
   {
     "id": "[this-agent-id]",
     "url": "http://[this-IP]:9100",
     "token": "..."
   }
3. Save and restart their ClawBridge service

Alternatively, ask their agent to remove this peer.
```

**Report:**
```
⚠️ Network cleanup required

This agent has been removed locally, but peer agents still have it configured.

Other agents in the network:
- [peer-1-name] at [peer-1-url]
- [peer-2-name] at [peer-2-url]

Action needed:
Remove this agent ("[this-agent-name]") from each peer's config/peers.json

Or send this command to each peer agent:
"Remove peer '[this-agent-name]' from your ClawBridge config"
```

### Step 8: Remove Firewall Rules (if added)

**Only if firewall rules were specifically added for ClawBridge:**

```bash
# Check current firewall rules
sudo ufw status numbered 2>/dev/null | grep 9100
# Or
sudo firewall-cmd --list-ports 2>/dev/null | grep 9100
```

**If ClawBridge rule exists:**

```bash
# Ubuntu/Debian (ufw)
sudo ufw delete allow 9100/tcp

# CentOS/RHEL (firewalld)
sudo firewall-cmd --permanent --remove-port=9100/tcp
sudo firewall-cmd --reload
```

**⚠️ DO NOT remove firewall rules if:**
- Port 9100 is used by other services
- You didn't add the rule specifically for ClawBridge
- Uncertain about the rule's purpose

**Ask human:** "Found firewall rule for port 9100. Was this added for ClawBridge? Should I remove it?"

**Report:**
- ✅ "Firewall rule removed for port 9100"
- ⚠️ "No firewall rule found, skipping"
- ⚠️ "Firewall rule preserved (may be used by other services)"

### Step 9: Remove Docker/Caddy Configs (if installed)

#### If Docker was used:

```bash
# Stop and remove container
docker stop clawbridge 2>/dev/null
docker rm clawbridge 2>/dev/null

# Remove image
docker rmi clawbridge 2>/dev/null

# Remove volume (if any)
docker volume rm clawbridge-config 2>/dev/null
```

#### If Caddy reverse proxy was configured:

```bash
# Check if Caddy config exists
if [ -f /etc/caddy/Caddyfile ]; then
    # Remove ClawBridge section from Caddyfile
    # (Manual edit required - cannot automate safely)
    echo "⚠️ Manual action required: Remove ClawBridge config from /etc/caddy/Caddyfile"
fi
```

**Report:**
- ✅ "Docker container/image removed"
- ✅ "Caddy config needs manual cleanup"
- ⚠️ "Docker/Caddy not used, skipping"

### Step 10: Verify Complete Removal

**Run these checks to confirm ClawBridge is fully removed:**

```bash
# 1. Server not running
lsof -i :9100 && echo "❌ Port 9100 still in use" || echo "✅ Port 9100 free"

# 2. Process not found
ps aux | grep "src/server.js" | grep -v grep && echo "❌ Process still running" || echo "✅ No ClawBridge process"

# 3. systemd service removed
systemctl list-units --all | grep clawbridge && echo "❌ Service still exists" || echo "✅ Service removed"

# 4. Directory removed
[ -d /path/to/clawbridge ] && echo "❌ Directory still exists" || echo "✅ Directory removed"
[ -d /opt/clawbridge ] && echo "❌ Directory still exists" || echo "✅ Directory removed"

# 5. Logs cleaned
ls /var/log/clawbridge 2>/dev/null && echo "❌ Logs still exist" || echo "✅ Logs removed"
```

**Report:**
```
Verification Results:
- Port 9100: [✅ Free / ❌ Still in use]
- Process: [✅ Stopped / ❌ Still running]
- systemd service: [✅ Removed / ❌ Still exists]
- Directory: [✅ Removed / ❌ Still exists]
- Logs: [✅ Removed / ❌ Still exist]
```

---

## Success Criteria

✅ **Uninstall is complete when ALL of these are true:**

1. ClawBridge server stopped (no process on port 9100)
2. systemd service removed (if it was installed)
3. ClawBridge directory deleted
4. Log files removed
5. Firewall rules removed (if specifically added for ClawBridge)
6. Verification checks all pass

**⚠️ Follow-up actions required:**

1. Remove this agent from peer configs on OTHER machines
2. Update any documentation that references this agent
3. Remove Caddy config (if applicable) — manual step
4. Backup any important config before final deletion (if requested)

---

## Final Report Template

```
✅ ClawBridge uninstall complete

Summary:
- Server: Stopped ✅
- systemd service: Removed ✅
- Directory: Deleted (/path/to/clawbridge) ✅
- Logs: Cleaned ✅
- Firewall rules: [Removed ✅ / Not applicable]
- Docker containers: [Removed ✅ / Not applicable]

⚠️ Manual follow-up required:
1. Remove this agent from peer configs:
   - Peer: [peer-1] → Edit config/peers.json
   - Peer: [peer-2] → Edit config/peers.json
   
2. Update network documentation

Verification:
- Port 9100: ✅ Free
- Process: ✅ Not running
- Directory: ✅ Removed
- Service: ✅ Removed

ClawBridge has been completely uninstalled from this system.
Reinstall from: https://github.com/paprini/clawbridge
```

---

## Troubleshooting Uninstall Issues

### "Cannot stop service - permission denied"
```bash
# Use sudo
sudo systemctl stop clawbridge
```

### "Process won't stop gracefully"
```bash
# Find process
ps aux | grep "src/server.js"

# Force kill
kill -9 [PID]
```

### "Directory won't delete - permission denied"
```bash
# Check ownership
ls -la /path/to/clawbridge

# Use sudo if needed (confirm first)
sudo rm -rf /path/to/clawbridge
```

### "Port still in use after stopping"
```bash
# Find what's using it
lsof -i :9100

# May be another process, not ClawBridge
# Check PID and process name before killing
```

### "systemd service file won't delete"
```bash
# Requires sudo
sudo rm /etc/systemd/system/clawbridge.service
sudo systemctl daemon-reload
```

---

## Partial Uninstall Options

### Keep Config, Remove Application

If you want to preserve configuration for later reinstall:

```bash
# Stop server
npm run stop  # or: sudo systemctl stop clawbridge

# Remove application code only
rm -rf src/ node_modules/ tests/ docs/ deploy/

# Keep: config/, .env, package.json
```

### Remove Service, Keep Application

If you want to stop running as a service but keep ClawBridge installed:

```bash
# Stop and disable service
sudo systemctl stop clawbridge
sudo systemctl disable clawbridge

# Remove service file
sudo rm /etc/systemd/system/clawbridge.service
sudo systemctl daemon-reload

# ClawBridge code remains, can be run manually with: npm start
```

---

## Reinstallation

If you need to reinstall ClawBridge later:

```bash
# Full reinstall
git clone https://github.com/paprini/clawbridge.git
cd clawbridge
npm install
npm run setup

# Or ask your agent
"Install ClawBridge from https://github.com/paprini/clawbridge"
```

**Note:** You'll need to:
1. Reconfigure all settings (agent name, peer tokens, etc.)
2. Notify peers you're back online
3. Re-exchange bearer tokens with peers

**Unless you backed up config files:**
```bash
# Before uninstalling
cp -r config/ /path/to/clawbridge-config-backup/

# After reinstalling
cp -r /path/to/clawbridge-config-backup/* config/
npm run verify
npm start
```

---

## Remember

1. **Confirm before deleting** — All config is lost
2. **Notify peers** — Graceful disconnect prevents errors
3. **Stop service first** — Don't delete while running
4. **Verify completion** — Check all steps passed
5. **Update network** — Remove from peer configs
6. **Backup if needed** — Config files for future reinstall

**Uninstalling is permanent. Proceed carefully.**
