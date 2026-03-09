'use strict';

const express = require('express');
const dotenv = require('dotenv');
const { DefaultRequestHandler, InMemoryTaskStore } = require('@a2a-js/sdk/server');
const { agentCardHandler, jsonRpcHandler } = require('@a2a-js/sdk/server/express');
const { AGENT_CARD_PATH } = require('@a2a-js/sdk');

const { loadAgentConfig, loadSkillsConfig } = require('./config');
const { createUserBuilder, requireAuth } = require('./auth');
const { OpenClawExecutor } = require('./executor');

dotenv.config();

const PORT = parseInt(process.env.A2A_PORT, 10) || 9100;
const BIND = process.env.A2A_BIND || '0.0.0.0';

// --- Build Agent Card from config ---
function buildAgentCard() {
  const agent = loadAgentConfig();
  const skills = loadSkillsConfig();

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
      organization: 'openclaw-a2a',
      url: 'https://github.com/paprini/openclaw-a2a',
    },
    skills: skills
      .filter((s) => s.public !== false)
      .map((s) => ({
        id: s.name,
        name: s.name,
        description: s.description || '',
        tags: s.tags || [],
        examples: s.examples || [],
      })),
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

  // Parse JSON bodies (explicit limit for defense in depth)
  app.use(express.json({ limit: '100kb' }));

  // Health check (no auth required)
  app.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
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
  const app = createServer();
  app.listen(PORT, BIND, () => {
    console.log(`[INFO] openclaw-a2a v0.1.0`);
    console.log(`[INFO] A2A server listening on http://${BIND}:${PORT}`);
    console.log(`[INFO] Agent Card: http://${BIND}:${PORT}/${AGENT_CARD_PATH}`);
    console.log(`[INFO] JSON-RPC:   http://${BIND}:${PORT}/a2a`);
    console.log(`[INFO] Health:     http://${BIND}:${PORT}/health`);
  });
}

module.exports = { createServer, buildAgentCard };
