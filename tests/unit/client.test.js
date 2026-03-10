'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

const tmpDir = path.join(os.tmpdir(), `a2a-client-test-${Date.now()}`);
fs.mkdirSync(tmpDir, { recursive: true });
fs.writeFileSync(path.join(tmpDir, 'peers.json'), JSON.stringify({
  peers: [
    { id: 'peer-one', url: 'http://10.0.1.11:9100', token: 'peer-token-one' },
    { id: 'peer-two', url: 'http://10.0.1.12:9100', token: 'peer-token-two' },
  ],
}));
process.env.A2A_CONFIG_DIR = tmpDir;

const { clearCache } = require('../../src/config');
const { buildMessageParts, callPeerSkill, callPeers, chainCalls, resolvePeerCallTimeoutMs } = require('../../src/client');

describe('client', () => {
  const originalFetch = global.fetch;
  const originalTimeout = AbortSignal.timeout;
  let timeoutSpy;

  beforeEach(() => {
    clearCache();
    delete process.env.A2A_PEER_TIMEOUT_SHORT_MS;
    delete process.env.A2A_PEER_TIMEOUT_DEFAULT_MS;
    delete process.env.A2A_PEER_TIMEOUT_CHAT_MS;
    timeoutSpy = jest.spyOn(AbortSignal, 'timeout');
    global.fetch = jest.fn(async (_url, options) => ({
      ok: true,
      json: async () => ({
        result: {
          parts: [
            { kind: 'text', text: JSON.stringify({ ok: true, echo: JSON.parse(options.body).params.message.parts }) },
          ],
        },
      }),
    }));
  });

  afterAll(() => {
    global.fetch = originalFetch;
    AbortSignal.timeout = originalTimeout;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  afterEach(() => {
    timeoutSpy.mockRestore();
  });

  test('buildMessageParts appends JSON params as a second text part', () => {
    expect(buildMessageParts('chat', { target: '123', message: 'hello' })).toEqual([
      { kind: 'text', text: 'chat' },
      { kind: 'text', text: '{"target":"123","message":"hello"}' },
    ]);
  });

  test('callPeerSkill sends multipart params for structured calls', async () => {
    const result = await callPeerSkill('peer-one', 'chat', { target: '123', message: 'hello' });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [, options] = global.fetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.params.message.parts).toEqual([
      { kind: 'text', text: 'chat' },
      { kind: 'text', text: '{"target":"123","message":"hello"}' },
    ]);
    expect(result.ok).toBe(true);
  });

  test('callPeerSkill uses a long timeout for chat', async () => {
    process.env.A2A_PEER_TIMEOUT_CHAT_MS = '42000';

    await callPeerSkill('peer-one', 'chat', { message: 'hello' });

    expect(timeoutSpy).toHaveBeenCalledWith(42000);
  });

  test('callPeerSkill uses a short timeout for ping', async () => {
    process.env.A2A_PEER_TIMEOUT_SHORT_MS = '2500';

    await callPeerSkill('peer-one', 'ping');

    expect(timeoutSpy).toHaveBeenCalledWith(2500);
  });

  test('callPeerSkill allows an explicit timeout override', async () => {
    await callPeerSkill('peer-one', 'chat', { message: 'hello' }, { timeoutMs: 1234 });

    expect(timeoutSpy).toHaveBeenCalledWith(1234);
  });

  test('callPeerSkill reports timeouts clearly for relay-backed chat', async () => {
    global.fetch = jest.fn(async () => {
      const err = new Error('The operation was aborted due to timeout');
      err.name = 'TimeoutError';
      throw err;
    });

    await expect(callPeerSkill('peer-one', 'chat', { message: 'hello' }, { timeoutMs: 99 }))
      .rejects
      .toThrow('Peer call to chat on peer-one timed out after 99ms. The remote side may still have completed successfully.');
  });

  test('callPeerSkill preserves nested relay metadata in the JSON text part', async () => {
    await callPeerSkill('peer-one', 'chat', {
      message: 'hello',
      _agentDelivery: {
        activateSession: true,
        sourceAgentId: 'monti-telegram',
        requestedTarget: '@guali-discord',
      },
      _relay: {
        hops: 1,
        visited: ['monti-telegram'],
      },
    });

    const [, options] = global.fetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.params.message.parts).toEqual([
      { kind: 'text', text: 'chat' },
      { kind: 'text', text: JSON.stringify({
        message: 'hello',
        _agentDelivery: {
          activateSession: true,
          sourceAgentId: 'monti-telegram',
          requestedTarget: '@guali-discord',
        },
        _relay: {
          hops: 1,
          visited: ['monti-telegram'],
        },
      }) },
    ]);
  });

  test('callPeers supports peer lists plus shared params', async () => {
    const results = await callPeers(['peer-one', 'peer-two'], 'chat', { target: '123', message: 'hello' });

    expect(results).toHaveLength(2);
    expect(results[0].peerId).toBe('peer-one');
    expect(results[1].peerId).toBe('peer-two');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('callPeers preserves the existing array-of-calls contract', async () => {
    const results = await callPeers([{ peerId: 'peer-one', skill: 'ping' }]);

    expect(results).toEqual([
      expect.objectContaining({ peerId: 'peer-one', result: expect.any(Object) }),
    ]);
  });

  test('callPeers returns empty for an explicit empty peer list', async () => {
    const results = await callPeers([], 'chat', { target: '123', message: 'hello' });
    expect(results).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('callPeers propagates a shared timeout override to peer lists', async () => {
    await callPeers(['peer-one', 'peer-two'], 'chat', { message: 'hello' }, { timeoutMs: 777 });

    expect(timeoutSpy).toHaveBeenCalledWith(777);
    expect(timeoutSpy).toHaveBeenCalledTimes(2);
  });

  test('callPeers preserves per-call timeout overrides in explicit fan-out lists', async () => {
    await callPeers([
      { peerId: 'peer-one', skill: 'chat', params: { message: 'hello' }, timeoutMs: 321 },
      { peerId: 'peer-two', skill: 'ping' },
    ]);

    expect(timeoutSpy).toHaveBeenCalledWith(321);
    expect(timeoutSpy).toHaveBeenCalledWith(5000);
  });

  test('chainCalls propagates step-level timeout overrides', async () => {
    await chainCalls([
      { peerId: 'peer-one', skill: 'ping', timeoutMs: 222 },
      { peerId: 'peer-two', skill: 'get_status' },
    ]);

    expect(timeoutSpy).toHaveBeenCalledWith(222);
    expect(timeoutSpy).toHaveBeenCalledWith(5000);
  });

  test('resolvePeerCallTimeoutMs applies operation-specific defaults', () => {
    expect(resolvePeerCallTimeoutMs('chat')).toBe(60000);
    expect(resolvePeerCallTimeoutMs('ping')).toBe(5000);
    expect(resolvePeerCallTimeoutMs('get_status')).toBe(5000);
    expect(resolvePeerCallTimeoutMs('openclaw_sessions_list')).toBe(10000);
  });
});
