'use strict';

const { formatLog } = require('../../src/logger');

describe('logger', () => {
  test('redacts secret-looking keys and bearer values', () => {
    const output = formatLog('info', 'Authorization: Bearer abcdef1234567890abcdef1234567890', {
      token: 'abcdef1234567890abcdef1234567890',
      nested: {
        apiKey: 'Bearer token-value',
        note: 'plain text',
      },
    });

    expect(output).toContain('Bearer [REDACTED]');
    expect(output).toContain('token=[REDACTED]');
    expect(output).not.toContain('abcdef1234567890abcdef1234567890');
    expect(output).not.toContain('token-value');
  });
});
