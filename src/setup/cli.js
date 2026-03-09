#!/usr/bin/env node
'use strict';

const readline = require('readline');
const os = require('os');
const { runAgent } = require('./agent');
const { generateToken, getLocalSubnet, getCurrentConfig, writeConfig, checkAgent, testConnection } = require('./tools');

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

// --- Non-interactive mode (power user fallback) ---
async function runNonInteractive() {
  console.log('\n🔧 ClawBridge setup (non-interactive)\n');

  const prompt = createPrompt();

  const existing = getCurrentConfig();
  if (existing.exists) {
    console.log(`Existing config found: ${existing.agent.name}`);
    const overwrite = await prompt.ask('Overwrite? (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('Keeping existing config.');
      prompt.close();
      return;
    }
  }

  const hostname = os.hostname().split('.')[0];
  const name = await prompt.ask(`Agent name [${hostname}]: `) || hostname;

  const net = getLocalSubnet();
  const localIp = net ? net.localIp : 'localhost';
  const url = await prompt.ask(`Agent URL [http://${localIp}:9100/a2a]: `) || `http://${localIp}:9100/a2a`;

  const token = generateToken();
  console.log(`\n✅ Generated bearer token (${token.slice(0, 8)}...)`);

  const addPeer = await prompt.ask('\nAdd a peer? (y/N): ');
  const peers = [];

  if (addPeer.toLowerCase() === 'y') {
    let more = true;
    while (more) {
      const peerName = await prompt.ask('  Peer name: ');
      const peerUrl = await prompt.ask('  Peer URL (e.g. http://10.0.1.11:9100): ');
      if (peerName && peerUrl) {
        peers.push({ id: peerName, url: peerUrl, token });
      }
      const another = await prompt.ask('  Add another? (y/N): ');
      more = another.toLowerCase() === 'y';
    }
  }

  writeConfig({ agentName: name, agentUrl: url, peers, token });
  console.log('\n✅ Config written to config/');

  // Test connections
  for (const peer of peers) {
    process.stdout.write(`Testing ${peer.id}... `);
    const result = await testConnection(peer.url, token);
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

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
