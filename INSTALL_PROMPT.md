# Install ClawBridge on Your Instance

Bridge your OpenClaw agents across machines.

## Quick Install

```bash
# Clone repo
cd ~
git clone https://github.com/paprini/clawbridge.git
cd clawbridge

# Install dependencies
npm install

# Run setup (interactive)
npm run setup

# Start server
npm start
```

## What This Does

- Bridges your agents across machines (not instance-level)
- Enables remote skill execution
- Connects to your OpenClaw gateway
- Uses standard A2A protocol

## After Setup

Test connectivity:
```bash
npm run ping
```

Your agent is now bridged to the network.

---

**Repo:** https://github.com/paprini/clawbridge  
**Docs:** See README.md for full features
