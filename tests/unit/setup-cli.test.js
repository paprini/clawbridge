'use strict';

const {
  promptForOpenClawAgent,
  promptForPeerToken,
  promptForDefaultDelivery,
  manageExistingPeers,
  collectAdditionalPeers,
} = require('../../src/setup/cli');

function makePrompt(answers) {
  let index = 0;
  return {
    async ask() {
      const answer = answers[index];
      index += 1;
      return answer ?? '';
    },
  };
}

describe('Setup CLI helpers', () => {
  test('promptForOpenClawAgent selects one detected local agent', async () => {
    const prompt = makePrompt(['example-discord-agent']);

    const selected = await promptForOpenClawAgent(prompt, {}, {
      detected: true,
      agents: ['main', 'example-discord-agent', 'example-project-pm'],
      defaultAgentId: 'main',
    });

    expect(selected).toBe('example-discord-agent');
  });

  test('keeps, updates, and removes existing peers', async () => {
    const prompt = makePrompt([
      'k',
      'u',
      'peer-two-updated',
      'http://10.0.1.22:9100',
      'e',
      'updated-token',
      'r',
    ]);

    const peers = await manageExistingPeers(prompt, [
      { id: 'peer-one', url: 'http://10.0.1.11:9100', token: 'token-one' },
      { id: 'peer-two', url: 'http://10.0.1.12:9100', token: 'token-two' },
      { id: 'peer-three', url: 'http://10.0.1.13:9100', token: 'token-three' },
    ]);

    expect(peers).toEqual([
      { id: 'peer-one', url: 'http://10.0.1.11:9100', token: 'token-one' },
      { id: 'peer-two-updated', url: 'http://10.0.1.22:9100', token: 'updated-token' },
    ]);
  });

  test('collects new peers with generated and manual tokens', async () => {
    const prompt = makePrompt([
      'y',
      'peer-one',
      'http://10.0.1.11:9100',
      'g',
      'y',
      'peer-two',
      'http://10.0.1.12:9100',
      'e',
      'manual-token',
      'n',
    ]);

    const peers = await collectAdditionalPeers(prompt, 0);

    expect(peers).toHaveLength(2);
    expect(peers[0].id).toBe('peer-one');
    expect(peers[0].token).toMatch(/^[0-9a-f]{64}$/);
    expect(peers[1]).toEqual({
      id: 'peer-two',
      url: 'http://10.0.1.12:9100',
      token: 'manual-token',
    });
  });

  test('promptForPeerToken keeps the existing token by default on update', async () => {
    const prompt = makePrompt(['']);
    const token = await promptForPeerToken(prompt, 'update', 'existing-token');
    expect(token).toBe('existing-token');
  });

  test('promptForDefaultDelivery preserves and updates default delivery', async () => {
    const prompt = makePrompt([
      '',
      '',
      'telegram',
    ]);

    const defaultDelivery = await promptForDefaultDelivery(prompt, {
      default_delivery: { type: 'owner', target: '1234567890', channel: 'whatsapp' },
    });

    expect(defaultDelivery).toEqual({
      type: 'owner',
      target: '1234567890',
      channel: 'telegram',
    });
  });
});
