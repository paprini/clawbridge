'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const net = require('net');

jest.setTimeout(10000);

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawbridge-client-timeout-'));
process.env.A2A_CONFIG_DIR = tmpDir;

const { clearCache } = require('../../src/config');
const { callPeerSkill } = require('../../src/client');

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = address && typeof address === 'object' ? address.port : null;
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
    server.on('error', reject);
  });
}

function writePeersConfig(port) {
  fs.writeFileSync(path.join(tmpDir, 'peers.json'), JSON.stringify({
    peers: [
      { id: 'slow-peer', url: `http://127.0.0.1:${port}`, token: 'peer-token-one' },
    ],
  }));
}

function createSlowPeerServer(delayMs) {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString('utf8');
    });
    req.on('end', () => {
      setTimeout(() => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          id: body ? JSON.parse(body).id : 1,
          result: {
            parts: [
              { kind: 'text', text: JSON.stringify({ ok: true }) },
            ],
          },
        }));
      }, delayMs);
    });
  });

  return {
    async listen(port) {
      await new Promise((resolve, reject) => {
        server.listen(port, '127.0.0.1', (err) => (err ? reject(err) : resolve()));
      });
    },
    async close() {
      await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    },
  };
}

describe('client peer timeout policy', () => {
  let server;

  beforeEach(() => {
    delete process.env.A2A_PEER_TIMEOUT_SHORT_MS;
    delete process.env.A2A_PEER_TIMEOUT_DEFAULT_MS;
    delete process.env.A2A_PEER_TIMEOUT_CHAT_MS;
  });

  afterEach(async () => {
    clearCache();
    if (server) {
      await server.close();
      server = null;
    }
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('chat succeeds on a slow peer when the chat timeout is long enough', async () => {
    const port = await getFreePort();
    writePeersConfig(port);
    clearCache();
    server = createSlowPeerServer(50);
    await server.listen(port);
    process.env.A2A_PEER_TIMEOUT_CHAT_MS = '200';

    await expect(callPeerSkill('slow-peer', 'chat', { message: 'hello' })).resolves.toEqual({ ok: true });
  });

  test('ping times out quickly on the same slow peer', async () => {
    const port = await getFreePort();
    writePeersConfig(port);
    clearCache();
    server = createSlowPeerServer(50);
    await server.listen(port);
    process.env.A2A_PEER_TIMEOUT_SHORT_MS = '10';

    await expect(callPeerSkill('slow-peer', 'ping')).rejects.toThrow(
      'Peer call to ping on slow-peer timed out after 10ms.'
    );
  });
});
