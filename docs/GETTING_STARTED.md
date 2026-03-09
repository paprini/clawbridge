# Getting Started — openclaw-a2a Development

**Quick guide for contributors and external agents to set up development environment.**

---

## Prerequisites

### **Required:**
- **Node.js 18+** (this project uses ES6+ and async/await)
- **npm 8+** (comes with Node.js)
- **Git**
- **OpenClaw instance** (for testing)

### **Optional:**
- **Docker** (if testing containerized deployments)
- **curl** or **Postman** (for manual API testing)

---

## Installation

### **Step 1: Clone the Repo**
```bash
git clone https://github.com/paprini/openclaw-a2a.git
cd openclaw-a2a
```

### **Step 2: Install Dependencies**
```bash
npm install
```

**This installs:**
- `@a2a-js/sdk` — A2A protocol SDK
- `express` — Web server
- `dotenv` — Environment variables
- `winston` — Logging
- `jest` (dev) — Testing framework

### **Step 3: Configure**

**Option A: Use the setup agent (recommended)**
```bash
npm run setup
```

The setup agent will create all config files for you. See [SETUP.md](SETUP.md) for details.

**Option B: Create config files manually**

**Create `config/agent.json`:**
```json
{
  "id": "openclaw-dev",
  "name": "OpenClaw Development Instance",
  "description": "Local development A2A agent",
  "url": "http://localhost:9100",
  "capabilities": {
    "streaming": true,
    "authentication": ["bearer"]
  }
}
```

**Create `config/peers.json`:**
```json
{
  "peers": [
    {
      "id": "openclaw-test",
      "url": "http://localhost:9101",
      "token": "a2a_dev_test_token_123",
      "description": "Test peer for local development"
    }
  ]
}
```

**Create `config/skills.json`:**
```json
{
  "exposed_skills": [
    {
      "name": "ping",
      "description": "Simple ping to test connectivity",
      "public": true
    },
    {
      "name": "get_status",
      "description": "Get agent status and uptime",
      "public": true
    }
  ]
}
```

### **Step 4: Create `.env` File**
```bash
cp .env.example .env
```

**Edit `.env`:**
```env
# A2A Server Configuration
A2A_PORT=9100
A2A_BIND=0.0.0.0
A2A_ENABLED=true

# Security
A2A_AUTH_REQUIRED=true
A2A_SHARED_TOKEN=a2a_dev_shared_token_456

# Logging
LOG_LEVEL=debug
LOG_FILE=logs/openclaw-a2a.log

# Development
NODE_ENV=development
```

---

## Running Locally

### **Option 1: Development Mode (Recommended)**
```bash
npm run dev
```

**What this does:**
- Starts A2A server on port 9100
- Watches for file changes (auto-restart)
- Logs to console (debug level)

**You should see:**
```
[INFO] Starting openclaw-a2a v0.1.0
[INFO] A2A server listening on http://localhost:9100
[INFO] Agent Card: http://localhost:9100/.well-known/agent-card
[INFO] JSON-RPC endpoint: http://localhost:9100/a2a/jsonrpc
[DEBUG] Loaded 2 peers from config/peers.json
[DEBUG] Exposed skills: ping, get_status
```

### **Option 2: Production Mode**
```bash
npm start
```

**What this does:**
- Starts A2A server on port 9100
- No auto-restart
- Logs to file + console

### **Option 3: Manual Start (For Debugging)**
```bash
node src/server.js
```

---

## Testing the Setup

### **1. Check Agent Card**
```bash
curl http://localhost:9100/.well-known/agent-card
```

**Expected response:**
```json
{
  "id": "openclaw-dev",
  "name": "OpenClaw Development Instance",
  "description": "Local development A2A agent",
  "url": "http://localhost:9100",
  "skills": [
    {
      "name": "ping",
      "description": "Simple ping to test connectivity"
    },
    {
      "name": "get_status",
      "description": "Get agent status and uptime"
    }
  ],
  "capabilities": {
    "streaming": true,
    "authentication": ["bearer"]
  }
}
```

### **2. Test Ping (JSON-RPC)**
```bash
curl -X POST http://localhost:9100/a2a/jsonrpc \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer a2a_dev_shared_token_456" \
  -d '{
    "jsonrpc": "2.0",
    "method": "ping",
    "params": {},
    "id": 1
  }'
```

**Expected response:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "status": "pong",
    "timestamp": "2026-03-09T17:45:00.000Z"
  },
  "id": 1
}
```

### **3. Test Health Check**
```bash
curl http://localhost:9100/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "uptime": 42.5,
  "peers": [
    {
      "id": "openclaw-test",
      "reachable": false
    }
  ]
}
```

---

## Running Tests

### **All Tests**
```bash
npm test
```

### **Watch Mode (Auto-Rerun on Changes)**
```bash
npm test -- --watch
```

### **Single Test File**
```bash
npm test -- auth.test.js
```

### **Coverage Report**
```bash
npm test -- --coverage
```

**Coverage goal:** >80% for Phase 1

---

## Testing with Two Instances

**To test agent-to-agent communication, you need two running instances.**

### **Terminal 1: First Instance**
```bash
A2A_PORT=9100 npm run dev
```

### **Terminal 2: Second Instance**
**Edit config:**
```bash
cp config/agent.json config/agent2.json
```

**Change port in `agent2.json`:**
```json
{
  "id": "openclaw-dev-2",
  "url": "http://localhost:9101"
}
```

**Start second instance:**
```bash
A2A_PORT=9101 A2A_CONFIG=config/agent2.json npm run dev
```

### **Test Communication**
**From instance 1, call instance 2:**
```bash
curl -X POST http://localhost:9100/a2a/call \
  -H "Content-Type: application/json" \
  -d '{
    "peer": "openclaw-dev-2",
    "skill": "ping"
  }'
```

**Expected:** Instance 1 discovers instance 2's Agent Card, calls ping, gets pong back.

---

## Docker Testing

### **Build Image**
```bash
docker build -t openclaw-a2a:dev .
```

### **Run Container (Host Network)**
```bash
docker run --network host \
  -v $(pwd)/config:/config \
  -e A2A_PORT=9100 \
  openclaw-a2a:dev
```

### **Run Container (Bridge Network)**
```bash
docker run -p 9100:9100 \
  -v $(pwd)/config:/config \
  -e A2A_PORT=9100 \
  openclaw-a2a:dev
```

### **Run with docker-compose**
```bash
docker-compose up
```

**This starts:**
- `openclaw-discord` on port 9100
- `openclaw-telegram` on port 9101
- Both on custom bridge network `a2a-network`

**Test:**
```bash
curl http://localhost:9100/.well-known/agent-card
curl http://localhost:9101/.well-known/agent-card
```

---

## Development Workflow

### **Daily Workflow:**
1. Pull latest changes: `git pull`
2. Install new deps (if any): `npm install`
3. Start dev server: `npm run dev`
4. Make changes
5. Test: `npm test`
6. Commit: `git add . && git commit -m "..."`
7. Push: `git push`

### **Before Committing:**
- ✅ Run tests: `npm test`
- ✅ Check linting: `npm run lint` (if configured)
- ✅ Update docs (if adding features)
- ✅ Clear commit message

### **Debugging:**
**Enable debug logs:**
```bash
LOG_LEVEL=debug npm run dev
```

**Check logs:**
```bash
tail -f logs/openclaw-a2a.log
```

**Use Node.js debugger:**
```bash
node --inspect src/server.js
```

Then open Chrome DevTools: `chrome://inspect`

---

## Common Issues

### **"Address already in use" Error**
**Problem:** Port 9100 is already bound

**Solution:**
```bash
# Find process using port 9100
lsof -i :9100

# Kill it
kill -9 <PID>

# Or use different port
A2A_PORT=9200 npm run dev
```

### **"Module not found" Error**
**Problem:** Dependencies not installed

**Solution:**
```bash
rm -rf node_modules package-lock.json
npm install
```

### **Agent Card Not Found**
**Problem:** Server not fully started or wrong URL

**Solution:**
- Wait 2-3 seconds after server starts
- Check logs for startup errors
- Verify URL: `http://localhost:9100/.well-known/agent-card` (note the dot)

### **Authentication Failed**
**Problem:** Wrong bearer token

**Solution:**
- Check `config/peers.json` has correct token
- Verify `Authorization: Bearer <token>` header format
- Check server logs for auth errors

### **Peer Not Reachable**
**Problem:** Second instance not running or wrong URL

**Solution:**
- Verify peer is running: `curl <peer_url>/.well-known/agent-card`
- Check `config/peers.json` has correct URL
- If in Docker, use container name: `http://openclaw-telegram:9100`

---

## File Structure

```
openclaw-a2a/
├── src/
│   ├── server.js       # Main A2A server (Express + SDK)
│   ├── client.js       # A2A client (outbound calls)
│   ├── auth.js         # Bearer token validation
│   ├── bridge.js       # A2A ↔ OpenClaw gateway bridge (Phase 2)
│   ├── health.js       # Health check endpoint
│   └── utils/          # Helper functions
│
├── config/
│   ├── agent.json      # This agent's configuration
│   ├── peers.json      # Known peer agents
│   └── skills.json     # Exposed skills whitelist
│
├── tests/
│   ├── unit/           # Unit tests (individual functions)
│   ├── integration/    # Integration tests (multi-agent)
│   └── docker/         # Docker-specific tests
│
├── scripts/
│   ├── setup.sh        # Installation script
│   └── systemd/        # systemd service files
│
├── docs/               # Detailed documentation
├── examples/           # Example implementations
├── logs/               # Log files (gitignored)
│
├── .env                # Environment variables (gitignored)
├── .env.example        # Example env file
├── package.json        # Dependencies and scripts
├── README.md           # Project overview
└── CONTRIBUTING.md     # How to contribute
```

---

## Next Steps

1. **Read the docs:**
   - [PHASE_1_PLAN.md](PHASE_1_PLAN.md) — What we're building
   - [SDK_NOTES.md](SDK_NOTES.md) — How the A2A SDK works
   - [CONTRIBUTING.md](CONTRIBUTING.md) — How to help

2. **Pick a task:**
   - Check [PROJECT_STATUS.md](PROJECT_STATUS.md)
   - Or check [CONTRIBUTING.md](CONTRIBUTING.md) for "What Needs Help"

3. **Start coding:**
   - Follow the implementation plan
   - Write tests
   - Update docs
   - Submit PR or push to main

---

## Getting Help

**Stuck? Ask:**
- **Team agents:** Discord #pm
- **External contributors:** GitHub Issues

**Common resources:**
- A2A SDK docs: https://github.com/a2aproject/a2a-js
- Express docs: https://expressjs.com
- Jest docs: https://jestjs.io

---

**Ready to build? Let's go!** 🚀


---

## Phase 2 Features

Phase 2 adds production-grade features on top of the core A2A server:

- **OpenClaw Bridge** — Call OpenClaw gateway tools from remote peers. See [BRIDGE_SETUP.md](BRIDGE_SETUP.md).
- **Permissions** — Per-peer, per-skill access control via `config/permissions.json`.
- **Rate Limiting** — Token bucket rate limiter (global, per-peer, per-skill) via `config/rate-limits.json`.
- **Health Monitoring** — `/health` with call counters and latency percentiles. `/metrics` in Prometheus format.
- **Multi-Agent Orchestration** — `callPeers()` for fan-out, `chainCalls()` for pipelines.
- **Token Rotation** — Rotate peer tokens via setup agent.

See [API_REFERENCE.md](API_REFERENCE.md) for full details.
