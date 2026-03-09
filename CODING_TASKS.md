# Coding Tasks — openclaw-a2a Phase 1

**For:** External coding agent  
**Language:** JavaScript (Node.js 18+)  
**Timeline:** 10-12 days  
**Status:** Ready to start

---

## Before You Start

**Read these first:**
1. [PHASE_1_PLAN.md](PHASE_1_PLAN.md) — Implementation plan
2. [SDK_NOTES.md](SDK_NOTES.md) — How @a2a-js/sdk works
3. [AGENT_CARD_SCHEMA.md](AGENT_CARD_SCHEMA.md) — What to implement
4. [GETTING_STARTED.md](GETTING_STARTED.md) — Dev environment setup

**Setup:**
```bash
cd /home/guali/openclaw-a2a
npm install
cp .env.example .env
```

**Key constraint:** JavaScript (not TypeScript). Keep it simple for Phase 1.

---

## Priority 1: Core Server (Days 1-2)

### Task 1.1: Basic Express Server
**File:** `src/server.js`  
**Time:** 1-2 hours  
**Dependencies:** express, dotenv

**What to build:**
```javascript
// src/server.js
const express = require('express');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.A2A_PORT || 9100;
const BIND = process.env.A2A_BIND || '0.0.0.0';

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, BIND, () => {
  console.log(`[INFO] A2A server listening on http://${BIND}:${PORT}`);
});

module.exports = app; // For testing
```

**Test:**
```bash
npm run dev
curl http://localhost:9100/health
```

**Expected:** `{"status":"healthy", ...}`

**Commit:** "Add basic Express server with health check"

---

### Task 1.2: Config Loading
**File:** `src/config.js`  
**Time:** 1 hour  
**Dependencies:** fs

**What to build:**
```javascript
// src/config.js
const fs = require('fs');
const path = require('path');

/**
 * Load JSON config file
 * @param {string} filename - Config filename (agent.json, peers.json, etc.)
 * @returns {object} Parsed JSON
 */
function loadConfig(filename) {
  const configPath = path.join(__dirname, '../config', filename);
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

/**
 * Load agent configuration
 */
function loadAgentConfig() {
  return loadConfig('agent.json');
}

/**
 * Load peers configuration
 */
function loadPeersConfig() {
  const config = loadConfig('peers.json');
  return config.peers || [];
}

/**
 * Load skills configuration
 */
function loadSkillsConfig() {
  const config = loadConfig('skills.json');
  return config.exposed_skills || [];
}

module.exports = {
  loadAgentConfig,
  loadPeersConfig,
  loadSkillsConfig
};
```

**Test:**
```bash
# Create test configs first (see GETTING_STARTED.md)
node -e "const {loadAgentConfig} = require('./src/config'); console.log(loadAgentConfig());"
```

**Commit:** "Add config loading utilities"

---

### Task 1.3: Agent Card Endpoint
**File:** `src/agent-card.js` + update `src/server.js`  
**Time:** 2 hours  
**Dependencies:** @a2a-js/sdk

**What to build:**
```javascript
// src/agent-card.js
const { loadAgentConfig, loadSkillsConfig } = require('./config');

/**
 * Generate Agent Card (A2A discovery)
 * @returns {object} Agent Card JSON
 */
function generateAgentCard() {
  const agent = loadAgentConfig();
  const skills = loadSkillsConfig();

  return {
    id: agent.id,
    name: agent.name || agent.id,
    description: agent.description || '',
    url: agent.url,
    skills: skills.map(skill => ({
      name: skill.name,
      description: skill.description || ''
    })),
    capabilities: agent.capabilities || {
      streaming: true,
      authentication: ['bearer']
    }
  };
}

module.exports = { generateAgentCard };
```

**Update `src/server.js`:**
```javascript
const { generateAgentCard } = require('./agent-card');

// Agent Card endpoint
app.get('/.well-known/agent-card', (req, res) => {
  try {
    const agentCard = generateAgentCard();
    res.json(agentCard);
  } catch (error) {
    console.error('[ERROR] Failed to generate Agent Card:', error);
    res.status(500).json({ error: 'Failed to generate Agent Card' });
  }
});
```

**Test:**
```bash
curl http://localhost:9100/.well-known/agent-card
```

**Expected:** Valid Agent Card JSON

**Commit:** "Add Agent Card endpoint"

---

### Task 1.4: Bearer Token Auth
**File:** `src/auth.js` + middleware  
**Time:** 2 hours  
**Dependencies:** None (pure logic)

**What to build:**
```javascript
// src/auth.js
const { loadPeersConfig } = require('./config');

/**
 * Validate bearer token against known peers
 * @param {string} token - Bearer token from Authorization header
 * @returns {string|null} Peer ID if valid, null otherwise
 */
function validateToken(token) {
  const peers = loadPeersConfig();
  const peer = peers.find(p => p.token === token);
  return peer ? peer.id : null;
}

/**
 * Express middleware: require bearer token authentication
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  
  const token = authHeader.substring(7); // Remove 'Bearer '
  const peerId = validateToken(token);
  
  if (!peerId) {
    console.warn('[WARN] Authentication failed for token:', token.substring(0, 10) + '...');
    return res.status(403).json({ error: 'Invalid bearer token' });
  }
  
  // Store peer ID in request for later use
  req.peerId = peerId;
  console.log(`[INFO] Authenticated request from peer: ${peerId}`);
  
  next();
}

module.exports = { validateToken, requireAuth };
```

**Update `src/server.js`:**
```javascript
const { requireAuth } = require('./auth');

// JSON-RPC endpoint (protected)
app.post('/a2a/jsonrpc', requireAuth, (req, res) => {
  // TODO: Implement JSON-RPC handler
  res.json({ jsonrpc: '2.0', result: { status: 'not implemented yet' }, id: req.body.id });
});
```

**Test:**
```bash
# Without auth (should fail)
curl -X POST http://localhost:9100/a2a/jsonrpc

# With auth (should succeed)
curl -X POST http://localhost:9100/a2a/jsonrpc \
  -H "Authorization: Bearer a2a_dev_shared_token_456"
```

**Commit:** "Add bearer token authentication"

---

## Priority 2: JSON-RPC Handler (Days 2-3)

### Task 2.1: Ping Skill
**File:** `src/skills.js`  
**Time:** 1 hour

**What to build:**
```javascript
// src/skills.js

/**
 * Ping skill - simple connectivity test
 * @param {object} params - Skill parameters (unused for ping)
 * @returns {Promise<object>} Pong response
 */
async function ping(params) {
  return {
    status: 'pong',
    timestamp: new Date().toISOString()
  };
}

/**
 * Get status skill - agent health and info
 * @param {object} params - Skill parameters (unused)
 * @returns {Promise<object>} Status response
 */
async function getStatus(params) {
  const { loadAgentConfig } = require('./config');
  const agent = loadAgentConfig();
  
  return {
    agent: {
      id: agent.id,
      name: agent.name
    },
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  ping,
  getStatus
};
```

**Commit:** "Add ping and get_status skills"

---

### Task 2.2: JSON-RPC Handler
**File:** `src/jsonrpc.js`  
**Time:** 2-3 hours  
**Dependencies:** @a2a-js/sdk

**What to build:**
```javascript
// src/jsonrpc.js
const { DefaultRequestHandler, AgentExecutor } = require('@a2a-js/sdk');
const { ping, getStatus } = require('./skills');
const { loadSkillsConfig } = require('./config');

/**
 * Check if skill is exposed
 * @param {string} skillName
 * @returns {boolean}
 */
function isSkillExposed(skillName) {
  const skills = loadSkillsConfig();
  return skills.some(s => s.name === skillName && s.public === true);
}

/**
 * Execute a skill
 * @param {string} skillName
 * @param {object} params
 * @returns {Promise<object>}
 */
async function executeSkill(skillName, params) {
  // Check if skill is exposed
  if (!isSkillExposed(skillName)) {
    throw new Error(`Skill not exposed: ${skillName}`);
  }
  
  // Execute skill
  switch (skillName) {
    case 'ping':
      return await ping(params);
    case 'get_status':
      return await getStatus(params);
    default:
      throw new Error(`Unknown skill: ${skillName}`);
  }
}

/**
 * Handle JSON-RPC request
 * @param {object} req - Express request
 * @param {object} res - Express response
 */
async function handleJsonRpc(req, res) {
  const { jsonrpc, method, params, id } = req.body;
  
  // Validate JSON-RPC 2.0 format
  if (jsonrpc !== '2.0') {
    return res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Invalid Request: jsonrpc must be "2.0"' },
      id: id || null
    });
  }
  
  try {
    console.log(`[INFO] JSON-RPC call: ${method} from peer ${req.peerId}`);
    
    // Execute skill
    const result = await executeSkill(method, params || {});
    
    // Return success response
    res.json({
      jsonrpc: '2.0',
      result: result,
      id: id
    });
    
  } catch (error) {
    console.error(`[ERROR] JSON-RPC error:`, error.message);
    
    // Return error response
    res.json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: error.message
      },
      id: id
    });
  }
}

module.exports = { handleJsonRpc };
```

**Update `src/server.js`:**
```javascript
const { handleJsonRpc } = require('./jsonrpc');

// Replace placeholder JSON-RPC endpoint
app.post('/a2a/jsonrpc', requireAuth, handleJsonRpc);
```

**Test:**
```bash
# Test ping
curl -X POST http://localhost:9100/a2a/jsonrpc \
  -H "Authorization: Bearer a2a_dev_shared_token_456" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"ping","params":{},"id":1}'

# Expected: {"jsonrpc":"2.0","result":{"status":"pong",...},"id":1}

# Test get_status
curl -X POST http://localhost:9100/a2a/jsonrpc \
  -H "Authorization: Bearer a2a_dev_shared_token_456" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"get_status","params":{},"id":2}'
```

**Commit:** "Add JSON-RPC handler with skill execution"

---

## Priority 3: A2A Client (Day 3)

### Task 3.1: Outbound Calls to Peers
**File:** `src/client.js`  
**Time:** 2-3 hours  
**Dependencies:** axios, @a2a-js/sdk

**What to build:**
```javascript
// src/client.js
const axios = require('axios');
const { loadPeersConfig } = require('./config');

/**
 * Fetch Agent Card from peer
 * @param {string} peerUrl - Peer's base URL
 * @returns {Promise<object>} Agent Card
 */
async function fetchAgentCard(peerUrl) {
  const url = `${peerUrl}/.well-known/agent-card`;
  const response = await axios.get(url);
  return response.data;
}

/**
 * Call a skill on a remote peer
 * @param {string} peerId - Peer identifier
 * @param {string} skillName - Skill to call
 * @param {object} params - Skill parameters
 * @returns {Promise<object>} Skill result
 */
async function callPeerSkill(peerId, skillName, params = {}) {
  const peers = loadPeersConfig();
  const peer = peers.find(p => p.id === peerId);
  
  if (!peer) {
    throw new Error(`Peer not found: ${peerId}`);
  }
  
  // Fetch Agent Card first (to verify skill exists)
  const agentCard = await fetchAgentCard(peer.url);
  const skill = agentCard.skills.find(s => s.name === skillName);
  
  if (!skill) {
    throw new Error(`Skill ${skillName} not found on peer ${peerId}`);
  }
  
  // Make JSON-RPC call
  const response = await axios.post(`${peer.url}/a2a/jsonrpc`, {
    jsonrpc: '2.0',
    method: skillName,
    params: params,
    id: Date.now()
  }, {
    headers: {
      'Authorization': `Bearer ${peer.token}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (response.data.error) {
    throw new Error(`JSON-RPC error: ${response.data.error.message}`);
  }
  
  return response.data.result;
}

module.exports = { fetchAgentCard, callPeerSkill };
```

**Test:**
```bash
# Start two instances (see GETTING_STARTED.md)
# Terminal 1: A2A_PORT=9100 npm run dev
# Terminal 2: A2A_PORT=9101 npm run dev

# Test client
node -e "
const {callPeerSkill} = require('./src/client');
callPeerSkill('openclaw-test', 'ping', {})
  .then(result => console.log('Result:', result))
  .catch(err => console.error('Error:', err.message));
"
```

**Commit:** "Add A2A client for outbound skill calls"

---

## Priority 4: Unit Tests (Days 4-5)

### Task 4.1: Auth Tests
**File:** `tests/unit/auth.test.js`  
**Time:** 2 hours

**What to build:**
```javascript
// tests/unit/auth.test.js
const { validateToken } = require('../../src/auth');

// Mock config
jest.mock('../../src/config', () => ({
  loadPeersConfig: () => [
    { id: 'peer-1', token: 'token123' },
    { id: 'peer-2', token: 'token456' }
  ]
}));

describe('Bearer Token Authentication', () => {
  describe('validateToken', () => {
    it('should return peer ID for valid token', () => {
      const peerId = validateToken('token123');
      expect(peerId).toBe('peer-1');
    });
    
    it('should return null for invalid token', () => {
      const peerId = validateToken('invalid');
      expect(peerId).toBeNull();
    });
    
    it('should return null for empty token', () => {
      const peerId = validateToken('');
      expect(peerId).toBeNull();
    });
  });
});
```

**Run:**
```bash
npm test
```

**Commit:** "Add auth unit tests"

---

### Task 4.2: JSON-RPC Tests
**File:** `tests/unit/jsonrpc.test.js`  
**Time:** 2-3 hours

**What to build:**
```javascript
// tests/unit/jsonrpc.test.js
const { executeSkill, isSkillExposed } = require('../../src/jsonrpc');

// Mock config
jest.mock('../../src/config', () => ({
  loadSkillsConfig: () => [
    { name: 'ping', public: true },
    { name: 'get_status', public: true },
    { name: 'private_skill', public: false }
  ]
}));

describe('JSON-RPC Handler', () => {
  describe('isSkillExposed', () => {
    it('should return true for exposed skills', () => {
      expect(isSkillExposed('ping')).toBe(true);
      expect(isSkillExposed('get_status')).toBe(true);
    });
    
    it('should return false for non-exposed skills', () => {
      expect(isSkillExposed('private_skill')).toBe(false);
      expect(isSkillExposed('unknown_skill')).toBe(false);
    });
  });
  
  describe('executeSkill', () => {
    it('should execute ping skill', async () => {
      const result = await executeSkill('ping', {});
      expect(result).toHaveProperty('status', 'pong');
      expect(result).toHaveProperty('timestamp');
    });
    
    it('should reject non-exposed skills', async () => {
      await expect(executeSkill('private_skill', {})).rejects.toThrow('Skill not exposed');
    });
  });
});
```

**Commit:** "Add JSON-RPC unit tests"

---

### Task 4.3: Integration Tests
**File:** `tests/integration/two-agents.test.js`  
**Time:** 3-4 hours

**What to build:**
```javascript
// tests/integration/two-agents.test.js
const request = require('supertest');
const { spawn } = require('child_process');

describe('Two-Agent Communication', () => {
  let server1, server2;
  
  beforeAll((done) => {
    // Start two servers
    server1 = spawn('node', ['src/server.js'], {
      env: { ...process.env, A2A_PORT: 9100 }
    });
    server2 = spawn('node', ['src/server.js'], {
      env: { ...process.env, A2A_PORT: 9101 }
    });
    
    // Wait for servers to start
    setTimeout(done, 2000);
  });
  
  afterAll(() => {
    server1.kill();
    server2.kill();
  });
  
  it('should fetch Agent Card from peer', async () => {
    const response = await request('http://localhost:9100')
      .get('/.well-known/agent-card');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('skills');
  });
  
  it('should call ping on peer', async () => {
    const response = await request('http://localhost:9100')
      .post('/a2a/jsonrpc')
      .set('Authorization', 'Bearer a2a_dev_shared_token_456')
      .send({
        jsonrpc: '2.0',
        method: 'ping',
        params: {},
        id: 1
      });
    
    expect(response.status).toBe(200);
    expect(response.body.result).toHaveProperty('status', 'pong');
  });
});
```

**Commit:** "Add two-agent integration tests"

---

## Priority 5: Docker Support (Days 6-7)

### Task 5.1: Dockerfile
**File:** `Dockerfile`  
**Time:** 2 hours

**What to build:**
```dockerfile
FROM node:18-alpine

# Install supervisor for process management
RUN apk add --no-cache supervisor

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy app source
COPY src/ ./src/
COPY config/ ./config/

# Create logs directory
RUN mkdir -p /var/log/supervisor

# Copy supervisor config
COPY docker/supervisord.conf /etc/supervisord.conf

# Expose A2A port
EXPOSE 9100

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:9100/health || exit 1

# Start supervisord
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
```

**Commit:** "Add Dockerfile with supervisord"

---

### Task 5.2: docker-compose.yml
**File:** `docker-compose.yml`  
**Time:** 1 hour

**What to build:**
```yaml
version: '3.8'

services:
  openclaw-discord:
    build: .
    container_name: openclaw-discord
    networks:
      - a2a-network
    ports:
      - "9100:9100"
    environment:
      - A2A_PORT=9100
      - A2A_BIND=0.0.0.0
      - A2A_ENABLED=true
    volumes:
      - ./config:/app/config
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:9100/health"]
      interval: 30s
      timeout: 5s
      retries: 3

  openclaw-telegram:
    build: .
    container_name: openclaw-telegram
    networks:
      - a2a-network
    ports:
      - "9101:9100"
    environment:
      - A2A_PORT=9100
      - A2A_BIND=0.0.0.0
      - A2A_ENABLED=true
    volumes:
      - ./config-telegram:/app/config
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:9100/health"]
      interval: 30s
      timeout: 5s
      retries: 3

networks:
  a2a-network:
    driver: bridge
```

**Commit:** "Add docker-compose with two-agent setup"

---

## After All Tasks Complete

### Final Checklist
- [ ] All unit tests pass (`npm test`)
- [ ] Integration tests pass
- [ ] Docker build succeeds (`docker build -t openclaw-a2a .`)
- [ ] docker-compose works (`docker-compose up`)
- [ ] Two agents can ping each other
- [ ] README updated with installation instructions
- [ ] CHANGELOG.md created

---

## How to Submit Work

**After each task:**
1. Test locally
2. Commit with clear message
3. Push to main branch
4. Update PROJECT_STATUS.md (mark task complete)
5. Post update in sharechat.md (brief status)

**Questions?**
- Post in sharechat.md
- PM will respond within 24 hours
- If blocked, skip to next task and flag blocker

---

## Timeline Estimate

| Priority | Tasks | Days |
|----------|-------|------|
| P1: Core Server | 1.1-1.4 | 2 |
| P2: JSON-RPC | 2.1-2.2 | 1 |
| P3: Client | 3.1 | 1 |
| P4: Tests | 4.1-4.3 | 2 |
| P5: Docker | 5.1-5.2 | 1 |
| **Total** | | **7 days** |

Add 2-3 days buffer for debugging, polish, documentation.

**Target: 10 days to working, tested, Dockerized Phase 1.**

---

**Ready to start coding!** 🚀
