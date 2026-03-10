'use strict';

const fs = require('fs');
const path = require('path');

describe('Repository policy', () => {
  test('tracked config/peers.json remains an empty bootstrap file', () => {
    const peersPath = path.join(__dirname, '..', '..', 'config', 'peers.json');
    const peersConfig = JSON.parse(fs.readFileSync(peersPath, 'utf8'));

    expect(Array.isArray(peersConfig.peers)).toBe(true);
    expect(peersConfig.peers).toHaveLength(0);
  });
});
