/**
 * Broadcast skill - Send alert/message to multiple peers simultaneously
 */

const { callPeers } = require('../client');
const logger = require('../logger');

/**
 * Broadcast a message to multiple peer agents simultaneously
 * @param {Object} params - Broadcast parameters
 * @param {string} params.message - Message to broadcast
 * @param {string[]} [params.targets] - List of peer IDs (omit for all peers)
 * @param {string} [params.priority] - Priority level (low/medium/high/urgent)
 * @param {string} [params.skill] - Skill to invoke on peers (default: 'chat')
 * @returns {Promise<Object>} Results with delivery status per peer
 */
async function broadcast(params) {
  // Validate parameters
  if (!params || typeof params !== 'object') {
    return {
      error: 'Invalid parameters. Expected object with message.',
      usage: 'broadcast({ message: "text", targets: ["peer1", "peer2"], priority: "high" })'
    };
  }

  const { message, targets, priority, skill } = params;

  if (!message || typeof message !== 'string' || message.length === 0) {
    return {
      error: 'Missing or invalid message. Must be a non-empty string.',
      usage: 'broadcast({ message: "Alert: System maintenance in 5 minutes" })'
    };
  }

  if (message.length > 2000) {
    return {
      error: 'Broadcast message too long. Maximum 2000 characters.',
      length: message.length,
      max: 2000
    };
  }

  // Validate priority if provided
  const validPriorities = ['low', 'medium', 'high', 'urgent'];
  const messagePriority = priority || 'medium';
  if (!validPriorities.includes(messagePriority)) {
    return {
      error: `Invalid priority "${priority}". Must be one of: ${validPriorities.join(', ')}`,
      usage: 'broadcast({ message: "text", priority: "high" })'
    };
  }

  // Validate targets if provided
  if (targets && !Array.isArray(targets)) {
    return {
      error: 'Invalid targets. Must be an array of peer IDs.',
      usage: 'broadcast({ message: "text", targets: ["peer1", "peer2"] })'
    };
  }

  if (targets && targets.length === 0) {
    return {
      error: 'Targets array is empty. Omit targets to broadcast to all peers, or provide at least one peer ID.',
      usage: 'broadcast({ message: "text" })  // all peers\nbroadcast({ message: "text", targets: ["peer1"] })'
    };
  }

  const skillToInvoke = skill || 'chat';
  const startTime = Date.now();

  try {
    logger.info('Broadcasting message', {
      messageLength: message.length,
      priority: messagePriority,
      targets: targets || 'all',
      skill: skillToInvoke
    });

    // Format message with priority prefix
    const priorityPrefix = messagePriority === 'urgent' ? '🚨 URGENT: ' :
                          messagePriority === 'high' ? '⚠️ ' :
                          messagePriority === 'medium' ? 'ℹ️ ' : '';
    
    const formattedMessage = `${priorityPrefix}${message}`;

    // Call peers (callPeers handles fan-out)
    const results = await callPeers(
      targets, // undefined = all peers
      skillToInvoke,
      { message: formattedMessage }
    );

    // Analyze results
    const successful = results.filter(r => r.success && !r.result?.error);
    const failed = results.filter(r => !r.success || r.result?.error);

    const duration = Date.now() - startTime;

    return {
      success: true,
      broadcast_complete: true,
      message_sent: formattedMessage,
      priority: messagePriority,
      skill_used: skillToInvoke,
      total_peers: results.length,
      successful_deliveries: successful.length,
      failed_deliveries: failed.length,
      results: results.map(r => ({
        peer: r.peer,
        success: r.success && !r.result?.error,
        error: r.result?.error || (r.success ? null : 'Peer call failed'),
        timestamp: new Date().toISOString()
      })),
      duration_ms: duration,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    logger.error('Broadcast skill failed', {
      error: err.message,
      targets,
      priority: messagePriority
    });

    return {
      error: 'Failed to broadcast message',
      details: err.message,
      suggestion: 'Check peer connectivity and permissions'
    };
  }
}

module.exports = { broadcast };
