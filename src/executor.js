'use strict';

const crypto = require('crypto');
const { loadAgentConfig, loadSkillsConfig } = require('./config');
const { checkPermission } = require('./permissions');
const { callOpenClawTool, isBridgedTool, getBridgedTools } = require('./bridge');
const { getRateLimiter } = require('./rate-limiter');
const { getMetrics } = require('./metrics');
const { validateString } = require('./validation');
const { validateAdvancedToken, scopeAllowsSkill } = require('./token-manager');
const logger = require('./logger');
const { chat } = require('./skills/chat');
const { broadcast } = require('./skills/broadcast');
const { getClawBridgeVersion } = require('./version');

/**
 * AgentExecutor implementation for ClawBridge.
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

    // Guard against missing message
    if (!context.userMessage || !context.userMessage.parts) {
      this._respond(eventBus, context, { error: 'Invalid request: missing message content' });
      return;
    }

    // Input validation
    const textCheck = validateString(this._extractText(context.userMessage) || '', 5000);
    if (!textCheck.valid) {
      this._respond(eventBus, context, { error: `Invalid input: ${textCheck.reason}` });
      return;
    }

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
        this._respond(eventBus, context, { error: perm.reason });
        return;
      }

      // Check token scopes (if advanced tokens configured)
      const token = context.context?.user?._token;
      if (token) {
        const adv = validateAdvancedToken(token);
        if (adv.valid && adv.scopes && !scopeAllowsSkill(adv.scopes, skillName)) {
          logger.warn(`Scope denied: peer=${peer} skill=${skillName} scopes=${adv.scopes}`);
          getMetrics().recordDenied();
          this._respond(eventBus, context, { error: `Token scope does not allow skill "${skillName}"` });
          return;
        }
      }
    }

    let result;
    try {
      if (skillName === 'ping') {
        result = this._handlePing();
      } else if (skillName === 'get_status') {
        result = this._handleGetStatus();
      } else if (skillName === 'chat') {
        const params = this._extractArgs(context.userMessage);
        result = await chat(params);
      } else if (skillName === 'broadcast') {
        const params = this._extractArgs(context.userMessage);
        result = await broadcast(params);
      } else if (isBridgedTool(skillName)) {
        // Route to OpenClaw bridge
        const toolName = skillName.replace(/^openclaw_/, '');
        const args = this._extractArgs(context.userMessage);
        result = await callOpenClawTool(toolName, args);
      } else {
        result = { error: 'Unknown skill. Run `npm run status` to see available skills.' };
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
   * Send a JSON response message and finish.
   */
  _respond(eventBus, context, result) {
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

    for (const part of message.parts) {
      if (part.kind !== 'text' || typeof part.text !== 'string') continue;

      const text = part.text.trim();
      if (!text) continue;

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) continue;

      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        // Ignore malformed JSON in one part and continue scanning the rest.
      }
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
      version: getClawBridgeVersion(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      skills: skills.filter((s) => s.public !== false).map((s) => s.name),
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = { OpenClawExecutor };
