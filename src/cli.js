#!/usr/bin/env node
'use strict';

const { fetchAgentCard, callPeerSkill, callPeers } = require('./client');
const { loadPeersConfig, loadAgentConfig } = require('./config');

const [,, command, ...args] = process.argv;

async function main() {
  switch (command) {
    case 'status': {
      const agent = loadAgentConfig();
      const peers = loadPeersConfig();
      console.log(`Agent: ${agent.name} (${agent.id})`);
      console.log(`URL: ${agent.url}`);
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

    default:
      console.log(`openclaw-a2a CLI

Commands:
  status    Show agent info and peer connectivity
  peers     List configured peers
  ping      Ping all peers
  call      Call a skill on a peer: call <peerId> <skill>
  card      Fetch agent card: card <url>

Examples:
  node src/cli.js status
  node src/cli.js call my-vps ping
  node src/cli.js card http://10.0.1.10:9100
`);
  }
}

main().catch(err => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
