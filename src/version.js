'use strict';

const packageJson = require('../package.json');

function getClawBridgeVersion() {
  return packageJson.version || '0.0.0';
}

module.exports = { getClawBridgeVersion };
