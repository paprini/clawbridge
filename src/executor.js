'use strict';

const crypto = require('crypto');
const { loadAgentConfig, loadSkillsConfig } = require('./config');
const { checkPermission } = require('./permissions');

/**
 * AgentExecutor implementation for openclaw-a2a.
 * Handles incoming A2A messages, routes to skill handlers.
 */
class OpenClawExecutor {
  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Execute agent logic based on incoming message.
   * @param {import('@a2a-js/sdk/server').RequestContext} context
   * @param {import('@a2a-js/sdk/server').ExecutionEventBus} eventBus
   */
  async execute(context, eventBus) {
    const text = this._extractText(context.userMessage);
    const skillName = this._routeToSkill(text);
    const peer = context.context?.user?.userName || 'unknown';

    // Check permissions BEFORE execution
    if (skillName) {
      const perm = checkPermission(peer, skillName);
      if (!perm.allowed) {
        console.warn(`[PERM] Denied: ${perm.reason}`);
        const response = {
          kind: 'message',
          messageId: crypto.randomUUID(),
          role: 'agent',
          parts: [{ kind: 'text', text: JSON.stringify({ error: perm.reason }) }],
          contextId: context.contextId,
        };
        eventBus.publish(response);
        eventBus.finished();
        return;
      }
    }

    let result;
    try {
      if (skillName === 'ping') {
        result = this._handlePing();
      } else if (skillName === 'get_status') {
        result = this._handleGetStatus();
      } else {
        result = { error: `Unknown skill or request. Available skills: ping, get_status` };
      }
    } catch (err) {
      console.error('[EXECUTOR] Skill execution error:', err.message);
      result = { error: 'Internal skill execution error' };
    }

    // Audit log
    console.log(`[AUDIT] peer=${peer} skill=${skillName || 'none'} success=${!result.error}`);

    // Respond with a message
    const response = {
      kind: 'message',
      messageId: crypto.randomUUID(),
      role: 'agent',
      parts: [{ kind: 'text', text: JSON.stringify(result) }],
      contextId: context.contextId,
    };

    eventBus.publish(response);
    eventBus.finished();
  }

  /**
   * Cancel a running task. Phase 1 tasks are instant, so this is a no-op.
   */
  async cancelTask(_taskId, eventBus) {
    eventBus.finished();
  }

  /**
   * Extract text content from a Message.
   * @param {object} message
   * @returns {string}
   */
  _extractText(message) {
    if (!message || !message.parts) return '';
    const textPart = message.parts.find((p) => p.kind === 'text');
    return textPart ? textPart.text.trim().toLowerCase() : '';
  }

  /**
   * Route text input to a skill name.
   * @param {string} text
   * @returns {string|null}
   */
  _routeToSkill(text) {
    // Check if the skill is in the exposed list
    const exposed = loadSkillsConfig();
    const exposedNames = exposed.filter((s) => s.public !== false).map((s) => s.name);

    if (text === 'ping' && exposedNames.includes('ping')) return 'ping';
    if ((text === 'get_status' || text === 'status') && exposedNames.includes('get_status')) return 'get_status';

    // Also accept the skill name directly if it's exposed
    if (exposedNames.includes(text)) return text;

    return null;
  }

  _handlePing() {
    return {
      status: 'pong',
      timestamp: new Date().toISOString(),
    };
  }

  _handleGetStatus() {
    const agent = loadAgentConfig();
    const skills = loadSkillsConfig();

    return {
      agent: { id: agent.id, name: agent.name },
      version: agent.version || '0.1.0',
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      skills: skills.filter((s) => s.public !== false).map((s) => s.name),
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = { OpenClawExecutor };
