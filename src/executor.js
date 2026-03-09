'use strict';

const crypto = require('crypto');
const { loadAgentConfig, loadSkillsConfig } = require('./config');
const { checkPermission } = require('./permissions');
const { callOpenClawTool, isBridgedTool, getBridgedTools } = require('./bridge');
const { getRateLimiter } = require('./rate-limiter');
const { getMetrics } = require('./metrics');
const { validateString } = require('./validation');
const logger = require('./logger');

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
    const startTime = Date.now();
    const text = this._extractText(context.userMessage);
    const skillName = this._routeToSkill(text);
    const peer = context.context?.user?.userName || 'unknown';

    // Rate limiting check
    const rateLimiter = getRateLimiter();
    const rateCheck = rateLimiter.check(peer, skillName || 'unknown');
    if (!rateCheck.allowed) {
      getMetrics().recordRateLimited();
      logger.warn(`Rate limited: peer=${peer} retryAfter=${rateCheck.retryAfter}s`);
      const response = {
        kind: 'message',
        messageId: crypto.randomUUID(),
        role: 'agent',
        parts: [{ kind: 'text', text: JSON.stringify({ error: 'Rate limited. Try again later.', retryAfter: rateCheck.retryAfter }) }],
        contextId: context.contextId,
      };
      eventBus.publish(response);
      eventBus.finished();
      return;
    }

    // Check permissions BEFORE execution
    if (skillName) {
      const perm = checkPermission(peer, skillName);
      if (!perm.allowed) {
        logger.warn(`Permission denied: ${perm.reason}`);
        getMetrics().recordDenied();
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
      } else if (isBridgedTool(skillName)) {
        // Route to OpenClaw bridge
        const toolName = skillName.replace(/^openclaw_/, '');
        const args = this._extractArgs(context.userMessage);
        result = await callOpenClawTool(toolName, args);
      } else {
        result = { error: `Unknown skill or request. Available skills: ping, get_status` };
      }
    } catch (err) {
      logger.error('Skill execution error', { error: err.message });
      result = { error: 'Internal skill execution error' };
    }

    // Audit log + metrics
    const durationMs = Date.now() - startTime;
    logger.audit('Skill call', { peer, skill: skillName || 'none', success: !result.error, durationMs });
    getMetrics().recordCall(!result.error, durationMs);

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
    const exposed = loadSkillsConfig();
    const exposedNames = exposed.filter((s) => s.public !== false).map((s) => s.name);

    if (text === 'ping' && exposedNames.includes('ping')) return 'ping';
    if ((text === 'get_status' || text === 'status') && exposedNames.includes('get_status')) return 'get_status';
    if (exposedNames.includes(text)) return text;

    // Check bridged tools (openclaw_exec, openclaw_web_search, etc.)
    if (isBridgedTool(text)) return text;

    return null;
  }

  /**
   * Extract JSON args from message text (for bridged tool calls).
   * Expects format: "openclaw_toolname {json_args}" or just the skill name.
   */
  _extractArgs(message) {
    if (!message || !message.parts) return {};
    const textPart = message.parts.find((p) => p.kind === 'text');
    if (!textPart) return {};

    const text = textPart.text.trim();
    // Try to find JSON in the message
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { return JSON.parse(jsonMatch[0]); } catch { /* not valid JSON */ }
    }
    return {};
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
