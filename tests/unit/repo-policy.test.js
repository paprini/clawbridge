'use strict';

const fs = require('fs');
const path = require('path');

describe('Repository policy', () => {
  test('runtime peer config is untracked and the example file stays sanitized', () => {
    const peersPath = path.join(__dirname, '..', '..', 'config', 'peers.json');
    const peersExamplePath = path.join(__dirname, '..', '..', 'config', 'peers.json.example');

    expect(fs.existsSync(peersPath)).toBe(false);
    expect(fs.existsSync(peersExamplePath)).toBe(true);

    const peersConfig = JSON.parse(fs.readFileSync(peersExamplePath, 'utf8'));
    expect(Array.isArray(peersConfig.peers)).toBe(true);
    expect(peersConfig.peers[0]).toHaveProperty('id');
    expect(peersConfig.peers[0]).toHaveProperty('url');
    expect(peersConfig.peers[0]).toHaveProperty('token');
  });
});
