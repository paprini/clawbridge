/**
 * Chat skill - Send message to another platform via OpenClaw gateway
 */

const { callOpenClawTool, loadBridgeConfig } = require('../bridge');
const { loadContactsConfig } = require('../config');
const logger = require('../logger');

function getChatBridgeError() {
  try {
    const config = loadBridgeConfig();

    if (!config || !config.enabled) {
      return {
        error: 'Chat requires the OpenClaw bridge to be enabled.',
        suggestion: 'Enable config/bridge.json with "enabled": true and expose the "message" tool.',
      };
    }

    if (!Array.isArray(config.exposed_tools) || !config.exposed_tools.includes('message')) {
      return {
        error: 'Chat requires the "message" bridge tool to be exposed.',
        suggestion: 'Add "message" to config/bridge.json -> exposed_tools and restart ClawBridge.',
      };
    }
  } catch (err) {
    return {
      error: 'Chat bridge configuration is invalid.',
      details: err.message,
      suggestion: 'Fix config/bridge.json and run `npm run verify`.',
    };
  }

  return null;
}

function resolveTarget(target, channel) {
  const contacts = loadContactsConfig();
  const aliases = contacts?.aliases && typeof contacts.aliases === 'object'
    ? contacts.aliases
    : {};

  const lookupKeys = [];
  if (channel) {
    lookupKeys.push(`${channel}:${target}`);
  }
  lookupKeys.push(target);

  for (const key of lookupKeys) {
    const resolved = aliases[key];
    if (typeof resolved === 'string' && resolved.trim().length > 0) {
      return {
        requestedTarget: target,
        resolvedTarget: resolved.trim(),
        alias: key,
      };
    }
  }

  return {
    requestedTarget: target,
    resolvedTarget: target,
    alias: null,
  };
}

function looksLikeDirectTargetId(target) {
  return /\d/.test(target);
}

/**
 * Send a chat message to another channel/user via this agent's OpenClaw gateway
 * @param {Object} params - Message parameters
 * @param {string} params.target - Target channel/user
 * @param {string} params.message - Message text
 * @param {string} [params.channel] - Optional channel (discord/whatsapp/telegram)
 * @returns {Promise<Object>} Result with success status and delivery info
 */
async function chat(params) {
  // Validate parameters
  if (!params || typeof params !== 'object') {
    return {
      error: 'Invalid parameters. Expected object with target and message.',
      usage: 'chat({ target: "#channel", message: "text" })'
    };
  }

  const { target, message, channel } = params;

  if (!target || typeof target !== 'string') {
    return {
      error: 'Missing or invalid target. Must be a string.',
      usage: 'chat({ target: "5914004682", message: "Hello" })'
    };
  }

  if (!message || typeof message !== 'string') {
    return {
      error: 'Missing or invalid message. Must be a non-empty string.',
      usage: 'chat({ target: "#general", message: "Hello" })'
    };
  }

  if (message.length === 0) {
    return {
      error: 'Message cannot be empty.',
      usage: 'chat({ target: "#general", message: "Hello" })'
    };
  }

  if (message.length > 4000) {
    return {
      error: 'Message too long. Maximum 4000 characters.',
      length: message.length,
      max: 4000
    };
  }

  const bridgeError = getChatBridgeError();
  if (bridgeError) {
    return bridgeError;
  }

  const requestedTarget = target.trim();
  const resolved = resolveTarget(requestedTarget, channel);
  const resolvedTarget = resolved.resolvedTarget;

  if (!looksLikeDirectTargetId(resolvedTarget)) {
    return {
      error: 'Target could not be resolved to a platform-specific ID.',
      target: requestedTarget,
      suggestion: 'Use the platform-specific numeric ID directly, or add an alias in config/contacts.json.',
      usage: 'chat({ target: "5914004682", message: "Hello" })'
    };
  }

  try {
    // The gateway expects a platform-specific target identifier.
    const messageArgs = {
      action: 'send',
      target: resolvedTarget,
      message
    };

    // Add optional channel if provided
    if (channel) {
      messageArgs.channel = channel;
    }

    logger.info('Sending chat message via gateway', {
      target: requestedTarget,
      resolvedTarget,
      targetAlias: resolved.alias,
      messageLength: message.length,
      channel: channel || 'auto'
    });

    await callOpenClawTool('message', messageArgs);

    return {
      success: true,
      delivered_to: requestedTarget,
      resolved_target: resolvedTarget,
      channel: channel || 'auto',
      message_length: message.length,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    logger.error('Chat skill failed', {
      error: err.message,
      target: requestedTarget,
      resolvedTarget,
      channel
    });

    return {
      error: 'Failed to send message via gateway',
      details: err.message,
      target: requestedTarget,
      resolved_target: resolvedTarget,
      suggestion: 'Check that OpenClaw gateway is running, bridge is enabled, and the target is a platform-specific ID or contacts alias.'
    };
  }
}

module.exports = { chat };
