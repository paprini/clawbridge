'use strict';

const express = require('express');
const dotenv = require('dotenv');
const { DefaultRequestHandler, InMemoryTaskStore } = require('@a2a-js/sdk/server');
const { agentCardHandler, jsonRpcHandler } = require('@a2a-js/sdk/server/express');
const { AGENT_CARD_PATH } = require('@a2a-js/sdk');

const { loadAgentConfig, loadSkillsConfig } = require('./config');
const { createUserBuilder, requireAuth } = require('./auth');
const { OpenClawExecutor } = require('./executor');
const logger = require('./logger');

dotenv.config();

const PORT = parseInt(process.env.A2A_PORT, 10) || 9100;
const BIND = process.env.A2A_BIND || '0.0.0.0';

// --- Build Agent Card from config ---
function buildAgentCard() {
  const agent = loadAgentConfig();
  const skills = loadSkillsConfig();
  const { getBridgedTools } = require('./bridge');

  const nativeSkills = skills
    .filter((s) => s.public !== false)
    .map((s) => ({
      id: s.name,
      name: s.name,
      description: s.description || '',
      tags: s.tags || [],
      examples: s.examples || [],
    }));

  // Add bridged OpenClaw tools
  const bridgedSkills = getBridgedTools().map((t) => ({
    id: t.name,
    name: t.name,
    description: t.description,
    tags: ['openclaw', 'bridge'],
    examples: [],
  }));

  return {
    name: agent.name || agent.id,
    description: agent.description || 'OpenClaw A2A agent',
    url: agent.url || `http://localhost:${PORT}/a2a`,
    version: agent.version || '0.1.0',
    protocolVersion: '0.3.0',
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false,
    },
    defaultInputModes: ['text/plain'],
    defaultOutputModes: ['text/plain'],
    provider: {
      organization: 'clawbridge',
      url: 'https://github.com/paprini/clawbridge',
    },
    skills: [...nativeSkills, ...bridgedSkills],
    securitySchemes: {
      bearer: {
        type: 'http',
        scheme: 'bearer',
        description: 'Pre-shared bearer token for private network',
      },
    },
    security: [{ bearer: [] }],
  };
}

// --- Create server ---
function createServer() {
  const agentCard = buildAgentCard();
  const taskStore = new InMemoryTaskStore();
  const executor = new OpenClawExecutor();
  const requestHandler = new DefaultRequestHandler(agentCard, taskStore, executor);
  const userBuilder = createUserBuilder();

  const app = express();

  // DDoS protection (before everything else)
  const { ddosProtection } = require('./ddos-protection');
  app.use(ddosProtection);

  // Parse JSON bodies (explicit limit for defense in depth)
  app.use(express.json({ limit: '100kb' }));

  // Health check (no auth required) — includes metrics
  app.get('/health', (_req, res) => {
    const m = require('./metrics').getMetrics().getSnapshot();
    res.json({
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      ...m,
    });
  });

  // Public status endpoint (safe info only, no auth)
  app.get('/status', (_req, res) => {
    const agent = loadAgentConfig();
    const skills = loadSkillsConfig();
    res.json({
      name: agent.name || agent.id,
      version: agent.version || '0.1.0',
      uptime: Math.floor(process.uptime()),
      skills: skills.filter(s => s.public !== false).map(s => s.name),
      protocol: '0.3.0',
    });
  });

  // Prometheus metrics endpoint (no auth)
  app.get('/metrics', (_req, res) => {
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send(require('./metrics').getMetrics().toPrometheus());
  });

  // Agent Card endpoint (no auth — this is discovery)
  app.use(
    `/${AGENT_CARD_PATH}`,
    agentCardHandler({ agentCardProvider: requestHandler })
  );

  // Also serve at /.well-known/agent-card (without .json) for convenience
  app.use(
    '/.well-known/agent-card',
    agentCardHandler({ agentCardProvider: requestHandler })
  );

  // JSON-RPC endpoint (auth required)
  app.use('/a2a', requireAuth, jsonRpcHandler({ requestHandler, userBuilder }));

  return app;
}

// --- Start if run directly ---
if (require.main === module) {
  let app;
  try {
    // L3 — Reject known-bad tokens
    if (process.env.A2A_SHARED_TOKEN && process.env.A2A_SHARED_TOKEN.includes('CHANGE_ME')) {
      logger.error('A2A_SHARED_TOKEN contains "CHANGE_ME". Generate a real token: openssl rand -hex 32');
      process.exit(1);
    }
    app = createServer();
  } catch (err) {
    logger.error(`Startup failed: ${err.message}`);
    if (err.message.includes('Config file not found')) {
      logger.error('Run `npm run setup` to create config files first.');
    }
    process.exit(1);
  }

  const server = app.listen(PORT, BIND, () => {
    logger.info('ClawBridge started', { version: '0.1.0', port: PORT, bind: BIND });
  });

  // M5 — Graceful shutdown
  function shutdown() {
    logger.info('Shutting down...');
    server.close(() => process.exit(0));
    // Force exit after 5s if connections don't close
    setTimeout(() => process.exit(1), 5000);
  }
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

module.exports = { createServer, buildAgentCard };
