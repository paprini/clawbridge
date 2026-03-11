'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  inspectDirectSessionEvidence,
  normalizeComparableDeliveryTarget,
} = require('../../src/session-first-inspection');

describe('session-first inspection', () => {
  test('normalizes provider-style targets for comparison', () => {
    expect(normalizeComparableDeliveryTarget('discord', 'channel:12345')).toBe('12345');
    expect(normalizeComparableDeliveryTarget('discord', 'user:12345')).toBe('12345');
    expect(normalizeComparableDeliveryTarget('telegram', '@ExampleUser')).toBe('exampleuser');
  });

  test('distinguishes provider-bound direct rows from collapsed main-session rows', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawbridge-session-inspect-'));
    const openclawConfigPath = path.join(rootDir, 'openclaw.json');
    const sessionStorePath = path.join(rootDir, 'agents', 'main', 'sessions', 'sessions.json');

    fs.mkdirSync(path.dirname(sessionStorePath), { recursive: true });
    fs.writeFileSync(openclawConfigPath, JSON.stringify({ gateway: { auth: { token: 't' } } }, null, 2));
    fs.writeFileSync(sessionStorePath, JSON.stringify({
      'agent:main:main': {
        deliveryContext: {
          channel: 'telegram',
          to: '1234567890',
        },
        lastChannel: 'telegram',
        lastTo: '1234567890',
      },
      'agent:main:telegram:direct:9999999999': {
        deliveryContext: {
          channel: 'telegram',
          to: '9999999999',
        },
      },
    }, null, 2));

    const collapsed = inspectDirectSessionEvidence({
      tokenPath: openclawConfigPath,
      agentId: 'main',
      channel: 'telegram',
      target: '1234567890',
    });
    expect(collapsed.hasProviderBound).toBe(false);
    expect(collapsed.hasCollapsedMatch).toBe(true);
    expect(collapsed.collapsedRows[0].key).toBe('agent:main:main');

    const bound = inspectDirectSessionEvidence({
      tokenPath: openclawConfigPath,
      agentId: 'main',
      channel: 'telegram',
      target: '9999999999',
    });
    expect(bound.hasProviderBound).toBe(true);
    expect(bound.providerBoundRows[0].key).toBe('agent:main:telegram:direct:9999999999');
  });
});
