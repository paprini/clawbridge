/**
 * Chat skill - Send message to another platform via OpenClaw gateway
 */

const { callOpenClawTool } = require('../bridge');
const logger = require('../logger');

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
      error: 'Missing or invalid target. Must be a string (channel ID, username, or channel name).',
      usage: 'chat({ target: "#general", message: "Hello" })'
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

  try {
    // Call OpenClaw gateway's message/send tool
    const messageArgs = {
      action: 'send',
      target,
      message
    };

    // Add optional channel if provided
    if (channel) {
      messageArgs.channel = channel;
    }

    logger.info('Sending chat message via gateway', {
      target,
      messageLength: message.length,
      channel: channel || 'auto'
    });

    await callOpenClawTool('message', messageArgs);

    return {
      success: true,
      delivered_to: target,
      channel: channel || 'auto',
      message_length: message.length,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    logger.error('Chat skill failed', {
      error: err.message,
      target,
      channel
    });

    return {
      error: 'Failed to send message via gateway',
      details: err.message,
      target,
      suggestion: 'Check that OpenClaw gateway is running and bridge is configured'
    };
  }
}

module.exports = { chat };
