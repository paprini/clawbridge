'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const net = require('net');
const { spawn } = require('child_process');

jest.setTimeout(30000);

const projectRoot = path.join(__dirname, '..', '..');

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = address && typeof address === 'object' ? address.port : null;
      server.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(port);
      });
    });
    server.on('error', reject);
  });
}

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString('utf8');
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function createFakeGatewayServer({ token }) {
  const invocations = [];

  function buildSessionRow(sessionKey) {
    const trimmed = typeof sessionKey === 'string' ? sessionKey.trim() : '';
    const parts = trimmed.split(':').filter(Boolean);
    const channel = parts.length >= 5 ? parts[2] : null;
    const peerKind = parts.length >= 5 ? parts[3] : null;
    const to = parts.length >= 5 ? parts.slice(4).join(':') : null;
    const accountId = peerKind === 'direct' && parts.length >= 6 ? null : null;

    return {
      key: trimmed,
      sessionId: `sid-${Buffer.from(trimmed).toString('hex').slice(0, 12)}`,
      deliveryContext: {
        channel,
        to,
        accountId,
      },
      lastChannel: channel,
      lastTo: to,
    };
  }

  const server = http.createServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== '/tools/invoke') {
      res.statusCode = 404;
      res.end('not found');
      return;
    }

    if (req.headers.authorization !== `Bearer ${token}`) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: { message: 'bad auth' } }));
      return;
    }

    try {
      const body = await parseRequestBody(req);
      invocations.push(body);

      if (body.tool === 'sessions_list') {
        const row = buildSessionRow(body.sessionKey);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          ok: true,
          result: {
            details: {
              sessions: [row],
            },
          },
        }));
        return;
      }

      if (body.tool === 'message') {
        if (typeof body.args?.to !== 'string' || body.args.to.trim().length === 0) {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            ok: false,
            error: {
              message: 'message.send requires args.to',
            },
          }));
          return;
        }

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          ok: true,
          result: {
            sent: true,
          },
        }));
        return;
      }

      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: { message: `unknown tool ${body.tool}` } }));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: { message: err.message } }));
    }
  });

  return {
    invocations,
    listen(port) {
      return new Promise((resolve, reject) => {
        server.listen(port, '127.0.0.1', (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    },
    close() {
      return new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}

function writeFakeOpenClawCli(rootDir) {
  const logPath = path.join(rootDir, 'fake-openclaw.log');
  const cliPath = path.join(rootDir, 'fake-openclaw.js');
const script = `#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
function getArg(flag) {
  const index = args.indexOf(flag);
  return index !== -1 && index + 1 < args.length ? args[index + 1] : '';
}
const payload = {
  command: args[0] || '',
  deliver: args.includes('--deliver'),
  agent: getArg('--agent'),
  sessionId: getArg('--session-id'),
  channel: getArg('--channel'),
  to: getArg('--to'),
  replyTo: getArg('--reply-to'),
  replyChannel: getArg('--reply-channel'),
  message: getArg('--message'),
};
fs.appendFileSync(${JSON.stringify(logPath)}, JSON.stringify(payload) + '\\n');
process.stdout.write(JSON.stringify({
  status: 'ok',
  result: {
    status: 'ok',
    payloads: [
      {
        text: 'reply:' + (payload.agent || 'main') + ':' + (payload.replyChannel || 'none') + ':' + (payload.replyTo || payload.to || 'none') + ':' + payload.message,
      },
    ],
  },
}));
`;
  fs.writeFileSync(cliPath, script);
  fs.chmodSync(cliPath, 0o755);
  return { cliPath, logPath };
}

function writeGatewayConfig(filePath, token) {
  writeJson(filePath, {
    gateway: {
      auth: {
        token,
      },
    },
    agents: {
      list: [{ id: 'main' }],
    },
    session: {
      dmScope: 'per-channel-peer',
    },
  });
}

function writeInstanceConfig({
  configDir,
  agentId,
  name,
  url,
  defaultDelivery,
  peer,
  gatewayUrl,
  gatewayTokenPath,
}) {
  mkdirp(configDir);
  writeJson(path.join(configDir, 'agent.json'), {
    id: agentId,
    name,
    description: `${name} test instance`,
    url,
    version: '0.2.0',
    openclaw_agent_id: 'main',
    default_delivery: defaultDelivery,
  });
  writeJson(path.join(configDir, 'peers.json'), {
    peers: [peer],
  });
  fs.chmodSync(path.join(configDir, 'peers.json'), 0o600);
  writeJson(path.join(configDir, 'skills.json'), {
    exposed_skills: [
      { name: 'ping', public: true },
      { name: 'get_status', public: true },
      { name: 'chat', public: true },
    ],
  });
  writeJson(path.join(configDir, 'bridge.json'), {
    enabled: true,
    gateway: {
      url: gatewayUrl,
      tokenPath: gatewayTokenPath,
      sessionKey: 'main',
    },
    agent_dispatch: {
      enabled: true,
      sessionKey: 'auto',
      timeoutSeconds: 30,
    },
    exposed_tools: ['message'],
    timeout_ms: 300000,
    max_concurrent: 5,
  });
  writeJson(path.join(configDir, 'contacts.json'), { aliases: {} });
}

async function waitForHealth(url, child) {
  const started = Date.now();
  const timeoutMs = 10000;

  while (Date.now() - started < timeoutMs) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited early with code ${child.exitCode}`);
    }

    try {
      const res = await fetch(`${url}/health`);
      if (res.ok) {
        return;
      }
    } catch {
      // keep polling
    }

    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  throw new Error(`Timed out waiting for ${url}/health`);
}

function startInstance({ configDir, port, openclawBin, sharedToken }) {
  const child = spawn(process.execPath, ['src/server.js'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      A2A_CONFIG_DIR: configDir,
      A2A_PORT: String(port),
      A2A_BIND: '127.0.0.1',
      OPENCLAW_BIN: openclawBin,
      A2A_SHARED_TOKEN: sharedToken,
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let logs = '';
  child.stdout.on('data', (chunk) => {
    logs += chunk.toString('utf8');
  });
  child.stderr.on('data', (chunk) => {
    logs += chunk.toString('utf8');
  });

  return {
    child,
    url: `http://127.0.0.1:${port}`,
    getLogs() {
      return logs;
    },
  };
}

async function stopInstance(instance) {
  if (!instance || !instance.child || instance.child.exitCode !== null) {
    return;
  }

  instance.child.kill('SIGTERM');
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (instance.child.exitCode === null) {
        instance.child.kill('SIGKILL');
      }
      resolve();
    }, 3000);

    instance.child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

describe('two-instance cross-node chat', () => {
  let rootDir;
  let gateway;
  let gatewayPort;
  let instanceA;
  let instanceB;

  async function cleanup() {
    await stopInstance(instanceA);
    await stopInstance(instanceB);
    if (gateway) {
      await gateway.close();
    }
    if (rootDir) {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
    rootDir = null;
    gateway = null;
    gatewayPort = null;
    instanceA = null;
    instanceB = null;
  }

  afterEach(async () => {
    await cleanup();
  });

  test('relays @agent across two local instances and returns the reply to the origin instance', async () => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawbridge-two-instance-'));
    const { cliPath, logPath } = writeFakeOpenClawCli(rootDir);
    const gatewayToken = 'gateway-token-test';
    gateway = createFakeGatewayServer({ token: gatewayToken });
    gatewayPort = await getFreePort();
    await gateway.listen(gatewayPort);

    const portA = await getFreePort();
    const portB = await getFreePort();
    const sharedToken = 'local-shared-test-token';
    const pairToken = 'pair-peer-token-abcdef1234567890';

    const configDirA = path.join(rootDir, 'instance-a');
    const configDirB = path.join(rootDir, 'instance-b');
    const gatewayConfigA = path.join(rootDir, 'openclaw-a.json');
    const gatewayConfigB = path.join(rootDir, 'openclaw-b.json');
    writeGatewayConfig(gatewayConfigA, gatewayToken);
    writeGatewayConfig(gatewayConfigB, gatewayToken);

    writeInstanceConfig({
      configDir: configDirA,
      agentId: 'monti-telegram',
      name: 'Monti Telegram',
      url: `http://127.0.0.1:${portA}/a2a`,
      defaultDelivery: { type: 'owner', target: '5914004682', channel: 'telegram' },
      peer: { id: 'guali-discord', url: `http://127.0.0.1:${portB}`, token: pairToken },
      gatewayUrl: `http://127.0.0.1:${gatewayPort}`,
      gatewayTokenPath: gatewayConfigA,
    });

    writeInstanceConfig({
      configDir: configDirB,
      agentId: 'guali-discord',
      name: 'Guali Discord',
      url: `http://127.0.0.1:${portB}/a2a`,
      defaultDelivery: { type: 'channel', target: '1480310282961289216', channel: 'discord' },
      peer: { id: 'monti-telegram', url: `http://127.0.0.1:${portA}`, token: pairToken },
      gatewayUrl: `http://127.0.0.1:${gatewayPort}`,
      gatewayTokenPath: gatewayConfigB,
    });

    instanceA = startInstance({ configDir: configDirA, port: portA, openclawBin: cliPath, sharedToken });
    instanceB = startInstance({ configDir: configDirB, port: portB, openclawBin: cliPath, sharedToken });

    await waitForHealth(instanceA.url, instanceA.child);
    await waitForHealth(instanceB.url, instanceB.child);

    const res = await fetch(`${instanceA.url}/a2a`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sharedToken}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'message/send',
        params: {
          message: {
            kind: 'message',
            messageId: 'two-instance-1',
            role: 'user',
            parts: [
              { kind: 'text', text: 'chat' },
              { kind: 'text', text: JSON.stringify({ target: '@guali-discord', message: 'Hola desde Telegram' }) },
            ],
          },
        },
      }),
    });

    const body = await res.json();
    expect(res.status).toBe(200);
    const result = JSON.parse(body.result.parts[0].text);

    expect(result.success).toBe(true);
    expect(result.conversation_id).toEqual(expect.any(String));
    expect(result.relayed_via).toBe('guali-discord');
    expect(result.session_mode).toBe('session_first');
    expect(result.agent_dispatch).toBe('activated');
    expect(result.openclaw_deliver_locally).toBe(false);
    expect(result.response_text).toContain('reply:main:discord:channel:1480310282961289216:Hola desde Telegram');

    const messageCalls = gateway.invocations.filter((entry) => entry.tool === 'message');
    expect(messageCalls).toEqual([]);

    const activationCalls = fs.readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
    expect(activationCalls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        agent: 'main',
        channel: 'discord',
        deliver: false,
        replyTo: 'channel:1480310282961289216',
      }),
    ]));
  });

  test('still relays replies correctly when both installs use the same generic agent id', async () => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawbridge-two-instance-generic-'));
    const { cliPath, logPath } = writeFakeOpenClawCli(rootDir);
    const gatewayToken = 'gateway-token-test';
    gateway = createFakeGatewayServer({ token: gatewayToken });
    gatewayPort = await getFreePort();
    await gateway.listen(gatewayPort);

    const portA = await getFreePort();
    const portB = await getFreePort();
    const sharedToken = 'local-shared-test-token';
    const pairToken = 'pair-peer-token-abcdef1234567890';

    const configDirA = path.join(rootDir, 'instance-a');
    const configDirB = path.join(rootDir, 'instance-b');
    const gatewayConfigA = path.join(rootDir, 'openclaw-a.json');
    const gatewayConfigB = path.join(rootDir, 'openclaw-b.json');
    writeGatewayConfig(gatewayConfigA, gatewayToken);
    writeGatewayConfig(gatewayConfigB, gatewayToken);

    writeInstanceConfig({
      configDir: configDirA,
      agentId: 'main',
      name: 'Monti Telegram',
      url: `http://127.0.0.1:${portA}/a2a`,
      defaultDelivery: { type: 'owner', target: '5914004682', channel: 'telegram' },
      peer: { id: 'main', url: `http://127.0.0.1:${portB}`, token: pairToken },
      gatewayUrl: `http://127.0.0.1:${gatewayPort}`,
      gatewayTokenPath: gatewayConfigA,
    });

    writeInstanceConfig({
      configDir: configDirB,
      agentId: 'main',
      name: 'Guali Discord',
      url: `http://127.0.0.1:${portB}/a2a`,
      defaultDelivery: { type: 'channel', target: '1480310282961289216', channel: 'discord' },
      peer: { id: 'main', url: `http://127.0.0.1:${portA}`, token: pairToken },
      gatewayUrl: `http://127.0.0.1:${gatewayPort}`,
      gatewayTokenPath: gatewayConfigB,
    });

    instanceA = startInstance({ configDir: configDirA, port: portA, openclawBin: cliPath, sharedToken });
    instanceB = startInstance({ configDir: configDirB, port: portB, openclawBin: cliPath, sharedToken });

    await waitForHealth(instanceA.url, instanceA.child);
    await waitForHealth(instanceB.url, instanceB.child);

    const res = await fetch(`${instanceB.url}/a2a`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pairToken}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'message/send',
        params: {
          message: {
            kind: 'message',
            messageId: 'two-instance-2',
            role: 'user',
            parts: [
              { kind: 'text', text: 'chat' },
              {
                kind: 'text',
                text: JSON.stringify({
                  message: 'Hola desde Telegram',
                  _agentDelivery: {
                    activateSession: true,
                    sourcePeerId: 'main',
                    sourceAgentId: 'main',
                    sourceUrl: `http://127.0.0.1:${portA}/a2a`,
                    sourceReplyTarget: '5914004682',
                    sourceReplyChannel: 'telegram',
                    requestedTarget: '@main',
                    conversationId: 'conv-generic-main',
                  },
                }),
              },
            ],
          },
        },
      }),
    });

    const body = await res.json();
    expect(res.status).toBe(200);
    const result = JSON.parse(body.result.parts[0].text);

    expect(result.success).toBe(true);
    expect(result.conversation_id).toBe('conv-generic-main');
    expect(result.session_mode).toBe('session_first');
    expect(result.agent_dispatch).toBe('activated');
    expect(result.openclaw_deliver_locally).toBe(false);
    expect(result.response_text).toContain('reply:main:discord:channel:1480310282961289216:Hola desde Telegram');

    const messageCalls = gateway.invocations.filter((entry) => entry.tool === 'message');
    expect(messageCalls).toEqual([]);

    const activationCalls = fs.readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
    expect(activationCalls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        agent: 'main',
        channel: 'discord',
        deliver: false,
        replyTo: 'channel:1480310282961289216',
      }),
    ]));
  });
});
