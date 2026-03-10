'use strict';

const { getClawBridgeVersion } = require('../../src/version');
const { version: packageVersion } = require('../../package.json');

describe('version', () => {
  test('returns the package version', () => {
    expect(getClawBridgeVersion()).toBe(packageVersion);
  });
});
