/**
 * Chat skill - Send message to another platform via OpenClaw gateway
 */

const { callOpenClawTool, loadBridgeConfig } = require('../bridge');
const { loadContactsConfig } = require('../config');
const { callPeerSkill } = require('../client');
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

function normalizeAliasEntry(entry, fallbackChannel) {
  if (typeof entry === 'string' && entry.trim().length > 0) {
    return {
      resolvedTarget: entry.trim(),
      relayPeerId: null,
      resolvedChannel: fallbackChannel || null,
    };
  }

  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return null;
  }

  if (typeof entry.target !== 'string' || entry.target.trim().length === 0) {
    return null;
  }

  return {
    resolvedTarget: entry.target.trim(),
    relayPeerId: typeof entry.peerId === 'string' && entry.peerId.trim().length > 0
      ? entry.peerId.trim()
      : null,
    resolvedChannel: typeof entry.channel === 'string' && entry.channel.trim().length > 0
      ? entry.channel.trim()
      : (fallbackChannel || null),
  };
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
    const resolved = normalizeAliasEntry(aliases[key], channel);
    if (resolved) {
      return {
        requestedTarget: target,
        alias: key,
        ...resolved,
      };
    }
  }

  return {
    requestedTarget: target,
    resolvedTarget: target,
    relayPeerId: null,
    resolvedChannel: channel || null,
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

  const requestedTarget = target.trim();
  const resolved = resolveTarget(requestedTarget, channel);
  const resolvedTarget = resolved.resolvedTarget;

  if (resolved.relayPeerId) {
    try {
      logger.info('Relaying chat message to peer', {
        target: requestedTarget,
        resolvedTarget,
        relayPeerId: resolved.relayPeerId,
        targetAlias: resolved.alias,
        channel: resolved.resolvedChannel || channel || 'auto',
      });

      const relayResult = await callPeerSkill(resolved.relayPeerId, 'chat', {
        target: resolvedTarget,
        message,
        channel: resolved.resolvedChannel || channel,
      });

      return {
        ...relayResult,
        delivered_to: requestedTarget,
        resolved_target: resolvedTarget,
        relayed_via: resolved.relayPeerId,
        channel: resolved.resolvedChannel || channel || relayResult.channel || 'auto',
      };
    } catch (err) {
      logger.error('Chat relay failed', {
        error: err.message,
        target: requestedTarget,
        resolvedTarget,
        relayPeerId: resolved.relayPeerId,
        channel: resolved.resolvedChannel || channel,
      });

      return {
        error: 'Failed to relay message to the correct peer',
        details: err.message,
        target: requestedTarget,
        resolved_target: resolvedTarget,
        relay_peer: resolved.relayPeerId,
        suggestion: 'Check the relay peer in config/contacts.json and confirm that peer is reachable.',
      };
    }
  }

  const bridgeError = getChatBridgeError();
  if (bridgeError) {
    return bridgeError;
  }

  if (!looksLikeDirectTargetId(resolvedTarget)) {
    return {
      error: 'Target could not be resolved to a platform-specific ID.',
      target: requestedTarget,
      suggestion: 'Use the local platform target ID directly, or add an alias in config/contacts.json. For cross-platform delivery, include a relay peer in the alias entry.',
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
    if (resolved.resolvedChannel || channel) {
      messageArgs.channel = resolved.resolvedChannel || channel;
    }

    logger.info('Sending chat message via gateway', {
      target: requestedTarget,
      resolvedTarget,
      targetAlias: resolved.alias,
      messageLength: message.length,
      channel: resolved.resolvedChannel || channel || 'auto'
    });

    await callOpenClawTool('message', messageArgs);

    return {
      success: true,
      delivered_to: requestedTarget,
      resolved_target: resolvedTarget,
      channel: resolved.resolvedChannel || channel || 'auto',
      message_length: message.length,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    logger.error('Chat skill failed', {
      error: err.message,
      target: requestedTarget,
      resolvedTarget,
      channel: resolved.resolvedChannel || channel
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
