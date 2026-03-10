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
const { buildMessageParts, callPeerSkill, callPeers } = require('../../src/client');

describe('client', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    clearCache();
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
    fs.rmSync(tmpDir, { recursive: true, force: true });
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
});
