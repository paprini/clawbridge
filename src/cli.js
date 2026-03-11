#!/usr/bin/env node
'use strict';

const { fetchAgentCard, callPeerSkill, callPeers } = require('./client');
const { loadPeersConfig, loadAgentConfig, loadOptionalConfig } = require('./config');
const { getHelperAgentStatus } = require('./helper-agent/manager');
const { getClawBridgeVersion } = require('./version');
const { inspectDirectSessionEvidence } = require('./session-first-inspection');

const [,, command, ...args] = process.argv;

async function main() {
  switch (command) {
    case 'status': {
      const agent = loadAgentConfig();
      const peers = loadPeersConfig();
      console.log(`ClawBridge: ${getClawBridgeVersion()}`);
      console.log(`Agent: ${agent.name} (${agent.id})`);
      console.log(`URL: ${agent.url}`);
      const helper = getHelperAgentStatus();
      const helperMode = helper.gatewayBootstrap ? ` [${helper.gatewayBootstrap}]` : '';
      console.log(`Helper agent: ${helper.status}${helperMode}${helper.sessionKey ? ` (${helper.sessionKey})` : ''}`);
      if (helper.bootstrapNote) {
        console.log(`  note: ${helper.bootstrapNote}`);
      }
      console.log(`Peers: ${peers.length}`);
      for (const p of peers) {
        process.stdout.write(`  ${p.id} (${p.url}) ... `);
        try {
          const card = await fetchAgentCard(p.url);
          console.log(`✅ ${card.name} [${card.skills?.map(s => s.id || s.name).join(', ')}]`);
        } catch (err) {
          console.log(`❌ ${err.message}`);
        }
      }
      break;
    }

    case 'version': {
      console.log(getClawBridgeVersion());
      break;
    }

    case 'helper': {
      console.log(JSON.stringify(getHelperAgentStatus(), null, 2));
      break;
    }

    case 'session-proof': {
      const [channel, target] = args;
      if (!channel || !target) {
        console.error('Usage: node src/cli.js session-proof <channel> <target>');
        process.exit(1);
      }

      const agent = loadAgentConfig();
      const bridge = loadOptionalConfig('bridge.json', {}) || {};
      const tokenPath = bridge?.gateway?.tokenPath || '~/.openclaw/openclaw.json';
      const evidence = inspectDirectSessionEvidence({
        tokenPath,
        agentId: bridge?.agent_dispatch?.agentId || agent?.openclaw_agent_id || 'main',
        channel,
        target,
      });

      console.log(JSON.stringify({
        channel,
        target,
        openclaw_agent_id: bridge?.agent_dispatch?.agentId || agent?.openclaw_agent_id || 'main',
        store_path: evidence.storePath,
        provider_bound: evidence.hasProviderBound,
        collapsed_to_non_provider_session: evidence.hasCollapsedMatch,
        matching_rows: evidence.matchingRows.map((row) => ({
          key: row.key,
          deliveryContext: row.deliveryContext || null,
          lastChannel: row.lastChannel || null,
          lastTo: row.lastTo || null,
        })),
      }, null, 2));
      break;
    }

    case 'call': {
      const [peerId, skill] = args;
      if (!peerId || !skill) {
        console.error('Usage: node src/cli.js call <peerId> <skill>');
        process.exit(1);
      }
      try {
        const result = await callPeerSkill(peerId, skill);
        console.log(JSON.stringify(result, null, 2));
      } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
      break;
    }

    case 'peers': {
      const peers = loadPeersConfig();
      if (peers.length === 0) {
        console.log('No peers configured. Run: npm run setup');
      } else {
        for (const p of peers) {
          console.log(`${p.id}  ${p.url}`);
        }
      }
      break;
    }

    case 'card': {
      const [url] = args;
      if (!url) {
        console.error('Usage: node src/cli.js card <url>');
        process.exit(1);
      }
      try {
        const card = await fetchAgentCard(url);
        console.log(JSON.stringify(card, null, 2));
      } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
      break;
    }

    case 'ping': {
      const peers = loadPeersConfig();
      if (peers.length === 0) {
        console.log('No peers configured.');
        break;
      }
      const calls = peers.map(p => ({ peerId: p.id, skill: 'ping' }));
      const results = await callPeers(calls);
      for (const r of results) {
        console.log(`${r.peerId}: ${r.result ? '✅ pong' : `❌ ${r.error}`}`);
      }
      break;
    }

    case 'search': {
      const [query] = args;
      if (!query) {
        console.error('Usage: node src/cli.js search <skill>');
        process.exit(1);
      }
      try {
        const { searchPublicAgents } = require('./registry');
        const agents = await searchPublicAgents(query);
        if (agents.length === 0) {
          console.log(`No public agents found with skill "${query}"`);
        } else {
          for (const a of agents) {
            console.log(`${a.name}  ${a.url}  [${(a.skills || []).join(', ')}]`);
          }
        }
      } catch (err) {
        if (err.message.includes('fetch failed') || err.message.includes('ENOTFOUND') || err.message.includes('ECONNREFUSED')) {
          console.log('Public agent registry not available. This is normal for private networks.');
          console.log('Set A2A_REGISTRY_URL to point to your registry, or use `peers` to manage local peers.');
        } else {
          console.error(`Registry error: ${err.message}`);
        }
      }
      break;
    }

    default:
      console.log(`ClawBridge CLI

Commands:
  status    Show agent info and peer connectivity
  version   Show installed ClawBridge version
  peers     List configured peers
  ping      Ping all peers
  call      Call a skill on a peer: call <peerId> <skill>
  card      Fetch agent card: card <url>
  search    Search public agents by skill: search <skill>
  helper    Show helper agent bootstrap status
  session-proof  Inspect whether a local target has a provider-bound direct OpenClaw session

Examples:
  node src/cli.js status
  node src/cli.js version
  node src/cli.js call my-vps ping
  node src/cli.js card http://10.0.1.10:9100
  node src/cli.js search web_search
  node src/cli.js helper
  node src/cli.js session-proof telegram 1234567890
`);
  }
}

main().catch(err => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
