#!/usr/bin/env node
'use strict';

const readline = require('readline');
const os = require('os');
const { runAgent } = require('./agent');
const {
  generateToken,
  getAvailableOpenClawAgents,
  getLocalSubnet,
  getCurrentConfig,
  writeConfig,
  checkAgent,
  testConnection,
} = require('./tools');

// --- Parse args ---
const args = process.argv.slice(2);
const flags = {};
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--model' && args[i + 1]) { flags.model = args[++i]; continue; }
  if (args[i] === '--base-url' && args[i + 1]) { flags.baseUrl = args[++i]; continue; }
  if (args[i] === '--api-key' && args[i + 1]) { flags.apiKey = args[++i]; continue; }
  if (args[i] === '--non-interactive') { flags.nonInteractive = true; continue; }
  if (args[i] === '--help' || args[i] === '-h') { flags.help = true; continue; }
}

if (flags.help) {
  console.log(`
ClawBridge setup agent

Usage: node src/setup/cli.js [options]

Options:
  --model <name>       LLM model name (default: gpt-4o-mini or OPENAI_MODEL env)
  --base-url <url>     OpenAI-compatible API base URL (default: OPENAI_BASE_URL env)
  --api-key <key>      API key (default: OPENAI_API_KEY env)
  --non-interactive    Skip LLM, write default configs directly
  --help               Show this help

Environment variables:
  OPENAI_BASE_URL      API base URL (e.g. http://localhost:11434/v1 for Ollama)
  OPENAI_API_KEY       API key
  OPENAI_MODEL         Model name

Examples:
  node src/setup/cli.js                                    # Use env vars
  node src/setup/cli.js --model ollama/llama3              # Use Ollama
  node src/setup/cli.js --non-interactive                  # Power user mode
`);
  process.exit(0);
}

// --- Readline helper ---
function createPrompt() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return {
    ask(question) {
      return new Promise((resolve) => rl.question(question, resolve));
    },
    close() { rl.close(); },
  };
}

function normalizeChoice(value, fallback) {
  const normalized = (value || '').trim().toLowerCase();
  return normalized === '' ? fallback : normalized[0];
}

function tokenPreview(token) {
  if (!token || typeof token !== 'string') return 'none';
  return `${token.slice(0, 8)}...`;
}

function inferDefaultDeliveryType(target, existingType) {
  if (existingType && typeof existingType === 'string' && existingType.trim().length > 0) {
    return existingType.trim();
  }

  if (typeof target !== 'string' || target.trim().length === 0) {
    return 'target';
  }

  if (target.trim().startsWith('#')) {
    return 'channel';
  }

  return 'owner';
}

async function promptForOpenClawAgent(prompt, existingAgent, availableAgents) {
  const existingChoice = typeof existingAgent?.openclaw_agent_id === 'string'
    ? existingAgent.openclaw_agent_id.trim()
    : '';
  const defaultChoice = existingChoice || availableAgents?.defaultAgentId || '';

  console.log('\nOpenClaw agent');
  console.log('ClawBridge should stay pinned to one local OpenClaw agent for inbound @agent communication.');

  if (availableAgents?.detected && Array.isArray(availableAgents.agents) && availableAgents.agents.length > 0) {
    console.log(`Detected local OpenClaw agents: ${availableAgents.agents.join(', ')}`);
  } else {
    console.log('Could not detect local OpenClaw agents automatically. Using the existing value or the OpenClaw default if available.');
  }

  while (true) {
    const label = defaultChoice || 'auto';
    const answer = await prompt.ask(`OpenClaw agent id [${label}]: `);
    const selected = answer.trim() || defaultChoice;

    if (!selected) {
      console.log('  No explicit OpenClaw agent selected. ClawBridge will use the OpenClaw default agent.');
      return null;
    }

    if (!availableAgents?.detected || !Array.isArray(availableAgents.agents) || availableAgents.agents.length === 0
      || availableAgents.agents.includes(selected)) {
      return selected;
    }

    console.log(`  Invalid choice. Pick one of: ${availableAgents.agents.join(', ')}`);
  }
}

async function promptForPeerToken(prompt, mode, existingToken) {
  const isUpdate = mode === 'update';
  const defaultChoice = isUpdate ? 'k' : 'g';
  const question = isUpdate
    ? `  Token [K]eep ${existingToken ? `(${tokenPreview(existingToken)}) ` : ''}/ [G]enerate / [E]nter manually? [K]: `
    : '  Token [G]enerate / [E]nter manually? [G]: ';

  const choice = normalizeChoice(await prompt.ask(question), defaultChoice);

  if (isUpdate && choice === 'k') {
    return existingToken;
  }

  if (choice === 'e') {
    const manual = await prompt.ask(`  Peer token${existingToken ? ` [${tokenPreview(existingToken)}]` : ''}: `);
    if (manual.trim()) return manual.trim();
    if (existingToken) return existingToken;
  }

  const generated = generateToken();
  console.log(`  ✅ Generated peer token (${generated.slice(0, 8)}...)`);
  return generated;
}

async function manageExistingPeers(prompt, existingPeers) {
  const peers = [];

  if (!Array.isArray(existingPeers) || existingPeers.length === 0) {
    return peers;
  }

  console.log('\nExisting peers:');

  for (const peer of existingPeers) {
    console.log(`- ${peer.id} (${peer.url})`);
    const action = normalizeChoice(await prompt.ask('  [K]eep / [U]pdate / [R]emove? [K]: '), 'k');

    if (action === 'r') {
      console.log(`  Removed ${peer.id}`);
      continue;
    }

    if (action === 'u') {
      const peerName = (await prompt.ask(`  Peer name [${peer.id}]: `)).trim() || peer.id;
      const peerUrl = (await prompt.ask(`  Peer URL [${peer.url}]: `)).trim() || peer.url;
      const peerToken = await promptForPeerToken(prompt, 'update', peer.token);
      peers.push({ id: peerName, url: peerUrl, token: peerToken });
      continue;
    }

    peers.push(peer);
  }

  return peers;
}

async function collectAdditionalPeers(prompt, existingCount = 0) {
  const peers = [];
  const firstQuestion = existingCount > 0 ? '\nAdd another peer? (y/N): ' : '\nAdd a peer? (y/N): ';
  let addPeer = normalizeChoice(await prompt.ask(firstQuestion), 'n');

  while (addPeer === 'y') {
    const peerName = (await prompt.ask('  Peer name: ')).trim();
    const peerUrl = (await prompt.ask('  Peer URL (e.g. http://10.0.1.11:9100): ')).trim();

    if (!peerName || !peerUrl) {
      console.log('  Skipping peer with missing name or URL.');
    } else {
      const peerToken = await promptForPeerToken(prompt, 'new');
      peers.push({ id: peerName, url: peerUrl, token: peerToken });
    }

    addPeer = normalizeChoice(await prompt.ask('  Add another? (y/N): '), 'n');
  }

  return peers;
}

async function promptForDefaultDelivery(prompt, existingAgent) {
  const existingDelivery = existingAgent?.default_delivery || null;
  const existingTarget = typeof existingDelivery?.target === 'string' ? existingDelivery.target : '';
  const existingType = typeof existingDelivery?.type === 'string' ? existingDelivery.type : '';
  const existingChannel = typeof existingDelivery?.channel === 'string' ? existingDelivery.channel : '';

  console.log('\nDefault delivery');
  console.log('Used for @agent messages and broadcasts received by this instance.');

  const targetAnswer = await prompt.ask(`Default delivery target [${existingTarget || 'none'}]: `);
  const normalizedTarget = targetAnswer.trim();

  if (!normalizedTarget && !existingTarget) {
    console.log('  No default delivery configured.');
    return null;
  }

  const finalTarget = normalizedTarget || existingTarget;
  if (finalTarget.toLowerCase() === 'none') {
    console.log('  Default delivery disabled.');
    return null;
  }

  const inferredType = inferDefaultDeliveryType(finalTarget, existingType);
  const typeAnswer = await prompt.ask(`Default delivery type [${inferredType}]: `);
  const finalType = typeAnswer.trim() || inferredType;

  const channelPromptLabel = existingChannel || 'optional';
  const channelAnswer = await prompt.ask(`Default delivery channel [${channelPromptLabel}]: `);
  const finalChannel = channelAnswer.trim() || existingChannel;

  return {
    type: finalType,
    target: finalTarget,
    ...(finalChannel ? { channel: finalChannel } : {}),
  };
}

// --- Non-interactive mode (power user fallback) ---
async function runNonInteractive() {
  console.log('\n🔧 ClawBridge setup (non-interactive)\n');

  const prompt = createPrompt();

  const existing = getCurrentConfig();
  if (existing.exists) {
    console.log(`Existing config found: ${existing.agent.name}`);
  }

  const hostname = os.hostname().split('.')[0];
  const nameDefault = existing.agent?.name || hostname;
  const name = (await prompt.ask(`Agent name [${nameDefault}]: `)).trim() || nameDefault;

  const net = getLocalSubnet();
  const localIp = net ? net.localIp : 'localhost';
  const urlDefault = existing.agent?.url || `http://${localIp}:9100/a2a`;
  const url = (await prompt.ask(`Agent URL [${urlDefault}]: `)).trim() || urlDefault;
  const availableOpenClawAgents = getAvailableOpenClawAgents(existing.bridge);
  const openclawAgentId = await promptForOpenClawAgent(prompt, existing.agent, availableOpenClawAgents);
  const defaultDelivery = await promptForDefaultDelivery(prompt, existing.agent);

  const managedPeers = await manageExistingPeers(prompt, existing.peers);
  const newPeers = await collectAdditionalPeers(prompt, managedPeers.length);
  const peers = [...managedPeers, ...newPeers];

  const result = writeConfig({
    agentName: name,
    agentUrl: url,
    peers,
    token: generateToken(),
    defaultDelivery,
    openclawAgentId,
  });
  console.log('\n✅ Config written to config/');

  if (Array.isArray(result.notes) && result.notes.length > 0) {
    console.log('\nNotes:');
    for (const note of result.notes) {
      console.log(`- ${note}`);
    }
  }

  // Test connections
  for (const peer of peers) {
    process.stdout.write(`Testing ${peer.id}... `);
    const result = await testConnection(peer.url, peer.token);
    console.log(result.success ? '✅ connected' : `❌ ${result.error}`);
  }

  console.log('\n✅ Setup complete!\n');
  console.log('Next step: Start your agent');
  console.log('  node src/server.js\n');
  prompt.close();
}

// --- Agent mode (conversational) ---
async function runConversational() {
  const baseUrl = flags.baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const apiKey = flags.apiKey || process.env.OPENAI_API_KEY || '';
  const model = flags.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';

  console.log('\n🤖 ClawBridge setup agent');
  console.log(`   Model: ${model}`);
  console.log(`   API: ${baseUrl}`);
  console.log('   Type "exit" to quit\n');
  console.log('Starting setup conversation...\n');

  const prompt = createPrompt();

  try {
    await runAgent({
      baseUrl,
      apiKey,
      model,
      onText(text) {
        console.log(`\n${text}\n`);
      },
      async getInput() {
        return prompt.ask('You: ');
      },
    });
  } catch (err) {
    console.error(`\nAgent error: ${err.message}`);
    console.log('Falling back to non-interactive mode...\n');
    await runNonInteractive();
  } finally {
    prompt.close();
  }
}

// --- Main ---
async function main() {
  if (flags.nonInteractive) {
    await runNonInteractive();
  } else {
    const hasModel = flags.model || process.env.OPENAI_API_KEY || process.env.OPENAI_BASE_URL;
    if (!hasModel) {
      console.log('No AI model configured. Set OPENAI_API_KEY and OPENAI_BASE_URL (or use --model).');
      console.log('This enables conversational setup. Falling back to manual setup...\n');
      await runNonInteractive();
    } else {
      await runConversational();
    }
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal:', err.message);
    process.exit(1);
  });
}

module.exports = {
  createPrompt,
  promptForOpenClawAgent,
  promptForPeerToken,
  promptForDefaultDelivery,
  manageExistingPeers,
  collectAdditionalPeers,
  runNonInteractive,
  runConversational,
  main,
};
