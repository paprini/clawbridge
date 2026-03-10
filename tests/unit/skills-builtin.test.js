/**
 * Built-in Skills Tests
 */

const { chat } = require('../../src/skills/chat');
const { broadcast } = require('../../src/skills/broadcast');

// Mock dependencies
jest.mock('../../src/bridge');
jest.mock('../../src/client');
jest.mock('../../src/logger');
jest.mock('../../src/openclaw-gateway');
jest.mock('../../src/config', () => ({
  loadAgentConfig: jest.fn(() => ({ id: 'local-agent', url: 'http://10.0.1.10:9100/a2a', openclaw_agent_id: null, default_delivery: null })),
  loadContactsConfig: jest.fn(() => ({ aliases: {} })),
  loadPeersConfig: jest.fn(() => []),
}));

const { callOpenClawTool, loadBridgeConfig } = require('../../src/bridge');
const { callPeerSkill, callPeers } = require('../../src/client');
const { invokeGatewayTool, resolveGatewayDefaultAgentId, runOpenClawAgentTurn } = require('../../src/openclaw-gateway');
const { loadAgentConfig, loadContactsConfig, loadPeersConfig } = require('../../src/config');

describe('Built-in Skills', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loadBridgeConfig.mockReturnValue({
      enabled: true,
      exposed_tools: ['message'],
    });
    loadAgentConfig.mockReturnValue({ id: 'local-agent', url: 'http://10.0.1.10:9100/a2a', openclaw_agent_id: null, default_delivery: null });
    loadContactsConfig.mockReturnValue({ aliases: {} });
    loadPeersConfig.mockReturnValue([]);
    invokeGatewayTool.mockImplementation(async (toolName) => {
      if (toolName === 'sessions_list') {
        return { sessions: [] };
      }
      return {};
    });
    resolveGatewayDefaultAgentId.mockReturnValue('main');
    runOpenClawAgentTurn.mockResolvedValue({ result: { status: 'ok', payloads: [] } });
  });

  describe('chat', () => {
    it('validates parameters', async () => {
      const result = await chat();
      expect(result.error).toContain('Invalid parameters');
    });

    it('requires target when no default delivery is configured', async () => {
      const result = await chat({ message: 'hello' });
      expect(result.error).toContain('Missing target and no default delivery');
    });

    it('requires message', async () => {
      const result = await chat({ target: '#general' });
      expect(result.error).toContain('Missing or invalid message');
    });

    it('rejects empty message', async () => {
      const result = await chat({ target: '#general', message: '' });
      expect(result.error).toContain('Missing or invalid message');
    });

    it('rejects message too long', async () => {
      const longMessage = 'a'.repeat(4001);
      const result = await chat({ target: '#general', message: longMessage });
      expect(result.error).toContain('too long');
      expect(result.max).toBe(4000);
    });

    it('calls OpenClaw gateway message tool', async () => {
      callOpenClawTool.mockResolvedValue({ ok: true });

      const result = await chat({
        target: '5914004682',
        message: 'Hello from chat skill'
      });

      expect(callOpenClawTool).toHaveBeenCalledWith('message', {
        action: 'send',
        to: '5914004682',
        target: '5914004682',
        message: 'Hello from chat skill'
      });

      expect(result.success).toBe(true);
      expect(result.delivered_to).toBe('5914004682');
      expect(result.resolved_target).toBe('5914004682');
    });

    it('uses default delivery when target is omitted', async () => {
      loadAgentConfig.mockReturnValue({
        id: 'local-agent',
        default_delivery: { type: 'owner', target: '5914004682', channel: 'telegram' },
      });
      callOpenClawTool.mockResolvedValue({ ok: true });

      const result = await chat({
        message: 'Hello from default delivery'
      });

      expect(callOpenClawTool).toHaveBeenCalledWith('message', {
        action: 'send',
        to: '5914004682',
        target: '5914004682',
        message: 'Hello from default delivery',
        channel: 'telegram'
      });
      expect(result.success).toBe(true);
      expect(result.resolved_target).toBe('5914004682');
    });

    it('includes optional channel parameter', async () => {
      callOpenClawTool.mockResolvedValue({ ok: true });

      await chat({
        target: '5914004682',
        message: 'Hello',
        channel: 'discord'
      });

      expect(callOpenClawTool).toHaveBeenCalledWith('message', {
        action: 'send',
        to: '5914004682',
        target: '5914004682',
        message: 'Hello',
        channel: 'discord'
      });
    });

    it('rejects unresolved human-readable targets', async () => {
      const result = await chat({
        target: 'Pato',
        message: 'Hello'
      });

      expect(result.error).toContain('No target found');
      expect(result.suggestion).toContain('@agent-name');
      expect(callOpenClawTool).not.toHaveBeenCalled();
    });

    it('returns a clear error when bridge is disabled', async () => {
      loadBridgeConfig.mockReturnValue({ enabled: false, exposed_tools: ['message'] });

      const result = await chat({
        target: '5914004682',
        message: 'Hello'
      });

      expect(result.error).toContain('bridge to be enabled');
      expect(callOpenClawTool).not.toHaveBeenCalled();
    });

    it('relays cross-platform contacts to the configured peer', async () => {
      loadBridgeConfig.mockReturnValue({ enabled: false, exposed_tools: ['message'] });
      loadContactsConfig.mockReturnValue({
        aliases: {
          'telegram:Pato': {
            peerId: 'telegram-agent',
            target: '5914004682',
            channel: 'telegram',
          },
        },
      });
      callPeerSkill.mockResolvedValue({
        success: true,
        delivered_to: '5914004682',
        channel: 'telegram',
      });

      const result = await chat({
        target: 'Pato',
        message: 'Hello',
        channel: 'telegram',
      });

      expect(callPeerSkill).toHaveBeenCalledWith('telegram-agent', 'chat', {
        target: '5914004682',
        message: 'Hello',
        channel: 'telegram',
        _relay: { hops: 1, visited: ['local-agent'] },
      });
      expect(callOpenClawTool).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.relayed_via).toBe('telegram-agent');
      expect(result.resolved_target).toBe('5914004682');
    });

    it('relays @agent targets directly to the named peer', async () => {
      loadPeersConfig.mockReturnValue([{ id: 'discord-agent', url: 'http://10.0.1.11:9100', token: 'abc123' }]);
      callPeerSkill.mockResolvedValue({
        success: true,
        delivered_to: 'default',
        channel: 'discord',
      });

      const result = await chat({
        target: '@discord-agent',
        message: 'Hello from Instagram'
      });

      expect(callPeerSkill).toHaveBeenCalledWith('discord-agent', 'chat', {
        message: 'Hello from Instagram',
        _agentDelivery: {
          activateSession: true,
          sourceAgentId: 'local-agent',
          sourceUrl: 'http://10.0.1.10:9100/a2a',
          requestedTarget: '@discord-agent',
        },
        _relay: { hops: 1, visited: ['local-agent'] },
      });
      expect(callOpenClawTool).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.relayed_via).toBe('discord-agent');
    });

    it('relays #channel@agent targets to the named peer with channel target', async () => {
      loadPeersConfig.mockReturnValue([{ id: 'discord-agent', url: 'http://10.0.1.11:9100', token: 'abc123' }]);
      callPeerSkill.mockResolvedValue({
        success: true,
        delivered_to: '#general',
        channel: 'discord',
      });

      const result = await chat({
        target: '#general@discord-agent',
        message: 'Hello to general'
      });

      expect(callPeerSkill).toHaveBeenCalledWith('discord-agent', 'chat', {
        target: '#general',
        message: 'Hello to general',
        _agentDelivery: {
          activateSession: true,
          sourceAgentId: 'local-agent',
          sourceUrl: 'http://10.0.1.10:9100/a2a',
          requestedTarget: '#general@discord-agent',
          remoteChannelTarget: '#general',
        },
        _relay: { hops: 1, visited: ['local-agent'] },
      });
      expect(result.success).toBe(true);
      expect(result.remote_target).toBe('#general');
    });

    it('treats @self as local default delivery instead of relaying', async () => {
      loadAgentConfig.mockReturnValue({
        id: 'discord-agent',
        openclaw_agent_id: 'discord-agent',
        default_delivery: { type: 'channel', target: '1480310282961289216', channel: 'discord' },
      });
      callOpenClawTool.mockResolvedValue({ ok: true });

      const result = await chat({
        target: '@discord-agent',
        message: 'Loop prevention'
      });

      expect(callPeerSkill).not.toHaveBeenCalled();
      expect(callOpenClawTool).toHaveBeenCalledWith('message', {
        action: 'send',
        to: 'channel:1480310282961289216',
        target: 'channel:1480310282961289216',
        message: 'Loop prevention',
        channel: 'discord'
      }, {
        sessionKey: 'agent:discord-agent:discord:channel:1480310282961289216',
      });
      expect(runOpenClawAgentTurn).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Loop prevention',
        agentId: 'discord-agent',
        target: 'channel:1480310282961289216',
        channel: 'discord',
        deliver: true,
        replyTo: 'channel:1480310282961289216',
        replyChannel: 'discord',
        timeoutSeconds: 30,
      }));
      expect(result.success).toBe(true);
      expect(result.agent_dispatch).toBe('activated');
      expect(result.openclaw_deliver_locally).toBe(true);
    });

    it('returns a clear error for unknown @agent targets', async () => {
      const result = await chat({
        target: '@missing-agent',
        message: 'Hello'
      });

      expect(result.error).toContain('Unknown peer target');
      expect(result.suggestion).toContain('config/peers.json');
      expect(callPeerSkill).not.toHaveBeenCalled();
    });

    it('fails fast on relay loops', async () => {
      loadAgentConfig.mockReturnValue({
        id: 'discord-agent',
        default_delivery: { type: 'channel', target: '1480310282961289216', channel: 'discord' },
      });
      loadPeersConfig.mockReturnValue([{ id: 'instagram-agent', url: 'http://10.0.1.12:9100', token: 'abc123' }]);

      const result = await chat({
        target: '@instagram-agent',
        message: 'Hello',
        _relay: { hops: 2, visited: ['instagram-agent', 'discord-agent'] },
      });

      expect(result.error).toContain('Relay loop detected');
      expect(result.relay_path).toEqual(['instagram-agent', 'discord-agent']);
      expect(callPeerSkill).not.toHaveBeenCalled();
      expect(callOpenClawTool).not.toHaveBeenCalled();
    });

    it('delivers locally when a reply relay returns to the source agent', async () => {
      loadAgentConfig.mockReturnValue({
        id: 'monti-telegram',
        openclaw_agent_id: 'main',
        default_delivery: { type: 'owner', target: '5914004682', channel: 'telegram' },
      });
      callOpenClawTool.mockResolvedValue({ ok: true });

      const result = await chat({
        message: 'Reply from Discord',
        _relay: { hops: 2, visited: ['monti-telegram', 'guali-discord'] },
      });

      expect(result.success).toBe(true);
      expect(callOpenClawTool).toHaveBeenCalledWith('message', {
        action: 'send',
        to: '5914004682',
        target: '5914004682',
        message: 'Reply from Discord',
        channel: 'telegram',
      });
    });

    it('canonicalizes Discord DM reply targets from source delivery metadata on the final local emit', async () => {
      loadAgentConfig.mockReturnValue({
        id: 'guali-discord',
        openclaw_agent_id: 'main',
        default_delivery: { type: 'channel', target: '1480310282961289216', channel: 'discord' },
      });
      callOpenClawTool.mockResolvedValue({ ok: true });

      const result = await chat({
        target: '1480310282961289216',
        channel: 'discord',
        message: 'Reply from Telegram',
        _sourceDelivery: { type: 'owner', target: '1480310282961289216', channel: 'discord' },
        _relay: { hops: 2, visited: ['guali-discord', 'monti-telegram'] },
      });

      expect(result.success).toBe(true);
      expect(callOpenClawTool).toHaveBeenCalledWith('message', {
        action: 'send',
        to: 'user:1480310282961289216',
        target: 'user:1480310282961289216',
        message: 'Reply from Telegram',
        channel: 'discord',
      });
    });

    it('activates the receiving session for inbound @agent deliveries', async () => {
      loadAgentConfig.mockReturnValue({
        id: 'discord-agent',
        openclaw_agent_id: 'discord-agent',
        default_delivery: { type: 'channel', target: '1480310282961289216', channel: 'discord' },
      });
      callOpenClawTool.mockResolvedValue({ ok: true });

      const result = await chat({
        message: 'Hola from Telegram',
        _agentDelivery: {
          activateSession: true,
          sourceAgentId: 'monti-telegram',
          sourceReplyTarget: '5914004682',
          sourceReplyChannel: 'telegram',
          requestedTarget: '@discord-agent',
        },
      });

      expect(callOpenClawTool).toHaveBeenCalledWith('message', expect.objectContaining({
        action: 'send',
        to: 'channel:1480310282961289216',
        target: 'channel:1480310282961289216',
        channel: 'discord',
      }), {
        sessionKey: 'agent:discord-agent:discord:channel:1480310282961289216',
      });
      expect(runOpenClawAgentTurn).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Hola from Telegram',
        agentId: 'discord-agent',
        target: 'channel:1480310282961289216',
        channel: 'discord',
        deliver: false,
        replyTo: 'channel:1480310282961289216',
        replyChannel: 'discord',
        timeoutSeconds: 30,
      }));
      expect(result.success).toBe(true);
      expect(result.agent_dispatch).toBe('activated');
      expect(result.openclaw_deliver_locally).toBe(false);
    });

    it('relays the activated agent reply back to the origin peer', async () => {
      loadAgentConfig.mockReturnValue({
        id: 'discord-agent',
        openclaw_agent_id: 'discord-agent',
        default_delivery: { type: 'channel', target: '1480310282961289216', channel: 'discord' },
      });
      callOpenClawTool.mockResolvedValue({ ok: true });
      runOpenClawAgentTurn.mockResolvedValue({
        result: {
          status: 'ok',
          payloads: [
            { text: 'Hola desde Discord' },
          ],
        },
      });
      callPeerSkill.mockResolvedValue({ success: true });

      const result = await chat({
        message: 'Hola from Telegram',
        _relay: { hops: 1, visited: ['monti-telegram'] },
        _agentDelivery: {
          activateSession: true,
          sourceAgentId: 'monti-telegram',
          sourceReplyTarget: '5914004682',
          sourceReplyChannel: 'telegram',
          requestedTarget: '@discord-agent',
        },
      });

      expect(callPeerSkill).toHaveBeenCalledWith('monti-telegram', 'chat', {
        target: '5914004682',
        channel: 'telegram',
        message: 'Hola desde Discord',
        _sourceDelivery: { type: 'target', target: '5914004682', channel: 'telegram', accountId: null },
        _relay: { hops: 2, visited: ['monti-telegram', 'discord-agent'] },
      });
      expect(result.reply_relay).toBe('delivered');
      expect(result.reply_relay_peer).toBe('monti-telegram');
    });

    it('marks reply relay as error when the origin peer rejects the returned chat', async () => {
      loadAgentConfig.mockReturnValue({
        id: 'discord-agent',
        openclaw_agent_id: 'discord-agent',
        default_delivery: { type: 'channel', target: '1480310282961289216', channel: 'discord' },
      });
      callOpenClawTool.mockResolvedValue({ ok: true });
      runOpenClawAgentTurn.mockResolvedValue({
        result: {
          status: 'ok',
          payloads: [
            { text: 'Hola desde Discord' },
          ],
        },
      });
      callPeerSkill.mockResolvedValue({ error: 'Relay loop detected while delivering chat.' });

      const result = await chat({
        message: 'Hola from Telegram',
        _relay: { hops: 1, visited: ['monti-telegram'] },
        _agentDelivery: {
          activateSession: true,
          sourceAgentId: 'monti-telegram',
          requestedTarget: '@discord-agent',
        },
      });

      expect(result.reply_relay).toBe('error');
      expect(result.reply_relay_error).toContain('Relay loop detected');
    });

    it('falls back to the authenticated peer when inbound relay metadata is missing', async () => {
      loadAgentConfig.mockReturnValue({
        id: 'discord-agent',
        openclaw_agent_id: 'discord-agent',
        default_delivery: { type: 'channel', target: '1480310282961289216', channel: 'discord' },
      });
      callOpenClawTool.mockResolvedValue({ ok: true });
      runOpenClawAgentTurn.mockResolvedValue({
        result: {
          status: 'ok',
          payloads: [
            { text: 'Hola desde Discord' },
          ],
        },
      });
      callPeerSkill.mockResolvedValue({ success: true });

      const result = await chat({
        message: 'Hola from Telegram',
        _requestPeerId: 'monti-telegram',
        _agentDelivery: {
          activateSession: true,
          sourceReplyTarget: '5914004682',
          sourceReplyChannel: 'telegram',
          requestedTarget: '@discord-agent',
        },
      });

      expect(callPeerSkill).toHaveBeenCalledWith('monti-telegram', 'chat', {
        target: '5914004682',
        channel: 'telegram',
        message: 'Hola desde Discord',
        _sourceDelivery: { type: 'target', target: '5914004682', channel: 'telegram', accountId: null },
        _relay: { hops: 1, visited: ['discord-agent'] },
      });
      expect(result.reply_relay).toBe('delivered');
      expect(result.reply_relay_peer).toBe('monti-telegram');
    });

    it('prefers the authenticated peer when sourceAgentId matches the local agent', async () => {
      loadAgentConfig.mockReturnValue({
        id: 'main',
        openclaw_agent_id: 'main',
        default_delivery: { type: 'channel', target: '1480310282961289216', channel: 'discord' },
      });
      callOpenClawTool.mockResolvedValue({ ok: true });
      runOpenClawAgentTurn.mockResolvedValue({
        result: {
          status: 'ok',
          payloads: [
            { text: 'Hola desde Discord' },
          ],
        },
      });
      callPeerSkill.mockResolvedValue({ success: true });

      const result = await chat({
        message: 'Hola from Telegram',
        _requestPeerId: 'monti-telegram',
        _agentDelivery: {
          activateSession: true,
          sourceAgentId: 'main',
          sourceReplyTarget: '1480310282961289216',
          sourceReplyChannel: 'discord',
          requestedTarget: '@guali-discord',
        },
      });

      expect(callPeerSkill).toHaveBeenCalledWith('monti-telegram', 'chat', {
        target: '1480310282961289216',
        channel: 'discord',
        message: 'Hola desde Discord',
        _sourceDelivery: { type: 'target', target: '1480310282961289216', channel: 'discord', accountId: null },
        _relay: { hops: 1, visited: ['main'] },
      });
      expect(result.reply_relay).toBe('delivered');
      expect(result.reply_relay_peer).toBe('monti-telegram');
    });

    it('falls back to sourceUrl matching when the caller is shared and sourceAgentId is generic', async () => {
      loadAgentConfig.mockReturnValue({
        id: 'guali-discord',
        url: 'http://172.31.30.104:9100',
        openclaw_agent_id: 'main',
        default_delivery: { type: 'channel', target: '1480310282961289216', channel: 'discord' },
      });
      loadPeersConfig.mockReturnValue([
        { id: 'monti-telegram', url: 'http://172.31.30.105:9100', token: 'peer-token' },
      ]);
      callOpenClawTool.mockResolvedValue({ ok: true });
      runOpenClawAgentTurn.mockResolvedValue({
        result: {
          status: 'ok',
          payloads: [
            { text: 'Hola desde Discord' },
          ],
        },
      });
      callPeerSkill.mockResolvedValue({ success: true });

      const result = await chat({
        message: 'Hola from Telegram',
        _agentDelivery: {
          activateSession: true,
          sourceAgentId: 'main',
          sourceUrl: 'http://172.31.30.105:9100/a2a',
          sourceReplyTarget: '1480310282961289216',
          sourceReplyChannel: 'discord',
          requestedTarget: '@guali-discord',
        },
      });

      expect(callPeerSkill).toHaveBeenCalledWith('monti-telegram', 'chat', {
        target: '1480310282961289216',
        channel: 'discord',
        message: 'Hola desde Discord',
        _sourceDelivery: { type: 'target', target: '1480310282961289216', channel: 'discord', accountId: null },
        _relay: { hops: 1, visited: ['guali-discord'] },
      });
      expect(result.reply_relay).toBe('delivered');
      expect(result.reply_relay_peer).toBe('monti-telegram');
    });

    it('still relays when the authenticated peer id equals the local agent id but is a configured remote peer', async () => {
      loadAgentConfig.mockReturnValue({
        id: 'main',
        url: 'http://172.31.30.104:9100',
        openclaw_agent_id: 'main',
        default_delivery: { type: 'channel', target: '1480310282961289216', channel: 'discord' },
      });
      loadPeersConfig.mockReturnValue([
        { id: 'main', url: 'http://172.31.30.105:9100', token: 'peer-token' },
      ]);
      callOpenClawTool.mockResolvedValue({ ok: true });
      runOpenClawAgentTurn.mockResolvedValue({
        result: {
          status: 'ok',
          payloads: [
            { text: 'Hola desde Discord' },
          ],
        },
      });
      callPeerSkill.mockResolvedValue({ success: true });

      const result = await chat({
        message: 'Hola from Telegram',
        _requestPeerId: 'main',
        _agentDelivery: {
          activateSession: true,
          sourceAgentId: 'main',
          sourceUrl: 'http://172.31.30.105:9100/a2a',
          sourceReplyTarget: '5914004682',
          sourceReplyChannel: 'telegram',
          requestedTarget: '@guali-discord',
        },
      });

      expect(callPeerSkill).toHaveBeenCalledWith('main', 'chat', {
        target: '5914004682',
        channel: 'telegram',
        message: 'Hola desde Discord',
        _sourceDelivery: { type: 'target', target: '5914004682', channel: 'telegram', accountId: null },
        _relay: { hops: 1, visited: ['main'] },
      });
      expect(result.reply_relay).toBe('delivered');
      expect(result.reply_relay_peer).toBe('main');
    });

    it('still relays when sourceUrl maps to a remote peer whose id equals the local agent id', async () => {
      loadAgentConfig.mockReturnValue({
        id: 'main',
        url: 'http://172.31.30.104:9100',
        openclaw_agent_id: 'main',
        default_delivery: { type: 'channel', target: '1480310282961289216', channel: 'discord' },
      });
      loadPeersConfig.mockReturnValue([
        { id: 'main', url: 'http://172.31.30.105:9100', token: 'peer-token' },
      ]);
      callOpenClawTool.mockResolvedValue({ ok: true });
      runOpenClawAgentTurn.mockResolvedValue({
        result: {
          status: 'ok',
          payloads: [
            { text: 'Hola desde Discord' },
          ],
        },
      });
      callPeerSkill.mockResolvedValue({ success: true });

      const result = await chat({
        message: 'Hola from Telegram',
        _agentDelivery: {
          activateSession: true,
          sourceAgentId: 'main',
          sourceUrl: 'http://172.31.30.105:9100/a2a',
          sourceReplyTarget: '5914004682',
          sourceReplyChannel: 'telegram',
          requestedTarget: '@guali-discord',
        },
      });

      expect(callPeerSkill).toHaveBeenCalledWith('main', 'chat', {
        target: '5914004682',
        channel: 'telegram',
        message: 'Hola desde Discord',
        _sourceDelivery: { type: 'target', target: '5914004682', channel: 'telegram', accountId: null },
        _relay: { hops: 1, visited: ['main'] },
      });
      expect(result.reply_relay).toBe('delivered');
      expect(result.reply_relay_peer).toBe('main');
    });

    it('does not treat the local instance as a reply relay peer when source metadata points back to the same installation', async () => {
      loadAgentConfig.mockReturnValue({
        id: 'main',
        url: 'http://172.31.30.104:9100',
        openclaw_agent_id: 'main',
        default_delivery: { type: 'channel', target: '1480310282961289216', channel: 'discord' },
      });
      callOpenClawTool.mockResolvedValue({ ok: true });
      runOpenClawAgentTurn.mockResolvedValue({
        result: {
          status: 'ok',
          payloads: [
            { text: 'Hola desde Discord' },
          ],
        },
      });

      const result = await chat({
        message: 'Hola from Telegram',
        _agentDelivery: {
          activateSession: true,
          sourceAgentId: 'main',
          sourceUrl: 'http://172.31.30.104:9100/a2a',
          sourceReplyTarget: '5914004682',
          sourceReplyChannel: 'telegram',
          requestedTarget: '@main',
        },
      });

      expect(callPeerSkill).not.toHaveBeenCalled();
      expect(result.reply_relay).toBe('not_requested');
      expect(result.reply_relay_peer).toBeNull();
    });

    it('reuses the source delivery target for reply relay even when the receiver has no opinion about the origin default', async () => {
      loadAgentConfig.mockReturnValue({
        id: 'guali-discord',
        openclaw_agent_id: 'main',
        default_delivery: { type: 'channel', target: '1480310282961289216', channel: 'discord' },
      });
      callOpenClawTool.mockResolvedValue({ ok: true });
      runOpenClawAgentTurn.mockResolvedValue({
        result: {
          status: 'ok',
          payloads: [
            { text: 'Hola desde Discord' },
          ],
        },
      });
      callPeerSkill.mockResolvedValue({ success: true });

      const result = await chat({
        message: 'Hola from Telegram',
        _agentDelivery: {
          activateSession: true,
          sourceAgentId: 'monti-telegram',
          sourceReplyTarget: '5914004682',
          sourceReplyChannel: 'telegram',
          requestedTarget: '@guali-discord',
        },
      });

      expect(callPeerSkill).toHaveBeenCalledWith('monti-telegram', 'chat', {
        target: '5914004682',
        channel: 'telegram',
        message: 'Hola desde Discord',
        _sourceDelivery: { type: 'target', target: '5914004682', channel: 'telegram', accountId: null },
        _relay: { hops: 1, visited: ['guali-discord'] },
      });
      expect(result.reply_relay).toBe('delivered');
      expect(result.reply_relay_peer).toBe('monti-telegram');
    });

    it('returns partial failure when inbound dispatch fails after delivery', async () => {
      loadAgentConfig.mockReturnValue({
        id: 'discord-agent',
        openclaw_agent_id: 'discord-agent',
        default_delivery: { type: 'channel', target: '1480310282961289216', channel: 'discord' },
      });
      callOpenClawTool.mockResolvedValue({ ok: true });
      runOpenClawAgentTurn.mockRejectedValue(new Error('OpenClaw CLI unavailable'));

      const result = await chat({
        message: 'Hola from Telegram',
        _agentDelivery: {
          activateSession: true,
          sourceAgentId: 'monti-telegram',
          requestedTarget: '@discord-agent',
        },
      });

      expect(callOpenClawTool).toHaveBeenCalled();
      expect(result.error).toContain('receiving agent activation failed');
      expect(result.transport_delivered).toBe(true);
      expect(result.details).toContain('OpenClaw CLI unavailable');
    });

    it('uses openclaw_agent_id instead of the ClawBridge peer id for dispatch sessions', async () => {
      loadAgentConfig.mockReturnValue({
        id: 'guali-discord',
        openclaw_agent_id: 'main',
        default_delivery: { type: 'channel', target: '1480310282961289216', channel: 'discord' },
      });
      callOpenClawTool.mockResolvedValue({ ok: true });

      const result = await chat({
        message: 'Hola from Telegram',
        _agentDelivery: {
          activateSession: true,
          sourceAgentId: 'monti-telegram',
          requestedTarget: '@guali-discord',
        },
      });

      expect(callOpenClawTool).toHaveBeenCalledWith('message', expect.objectContaining({
        to: 'channel:1480310282961289216',
        target: 'channel:1480310282961289216',
        channel: 'discord',
      }), {
        sessionKey: 'agent:main:discord:channel:1480310282961289216',
      });
      expect(runOpenClawAgentTurn).toHaveBeenCalledWith(expect.objectContaining({
        agentId: 'main',
        deliver: false,
        replyTo: 'channel:1480310282961289216',
      }));
      expect(result.agent_dispatch).toBe('activated');
    });

    it('retargets inbound activation to the unique OpenClaw session whose delivery context matches the real target', async () => {
      loadAgentConfig.mockReturnValue({
        id: 'telegram-agent',
        openclaw_agent_id: 'main',
        default_delivery: { type: 'owner', target: '5914004682', channel: 'telegram' },
      });
      callOpenClawTool.mockResolvedValue({ ok: true });
      invokeGatewayTool.mockImplementation(async (toolName) => {
        if (toolName === 'sessions_list') {
          return {
            sessions: [
              {
                key: 'agent:main:main',
                deliveryContext: { channel: 'telegram', to: '9999999999' },
                lastChannel: 'telegram',
                lastTo: '9999999999',
              },
              {
                key: 'agent:main:telegram:direct:5914004682',
                deliveryContext: { channel: 'telegram', to: '5914004682' },
                sessionId: 'telegram-session-id',
                lastChannel: 'telegram',
                lastTo: '5914004682',
              },
            ],
          };
        }

        return {};
      });

      const result = await chat({
        message: 'Hola from Discord',
        _agentDelivery: {
          activateSession: true,
          sourceAgentId: 'discord-agent',
          requestedTarget: '@telegram-agent',
        },
      });

      expect(callOpenClawTool).toHaveBeenCalledWith('message', expect.objectContaining({
        to: '5914004682',
        target: '5914004682',
        message: 'Hola from Discord',
        channel: 'telegram',
      }), {
        sessionKey: 'agent:main:telegram:direct:5914004682',
      });
      expect(runOpenClawAgentTurn).toHaveBeenCalledWith(expect.objectContaining({
        sessionId: 'telegram-session-id',
        agentId: 'main',
        target: '5914004682',
        channel: 'telegram',
        deliver: false,
        replyTo: '5914004682',
        replyChannel: 'telegram',
        timeoutSeconds: 30,
      }));
      expect(result.success).toBe(true);
      expect(result.agent_dispatch).toBe('activated');
    });

    it('does not switch to a different local OpenClaw agent just because another binding owns the delivery channel', async () => {
      loadAgentConfig.mockReturnValue({
        id: 'guali-discord',
        openclaw_agent_id: 'main',
        default_delivery: { type: 'channel', target: '1480310282961289216', channel: 'discord' },
      });
      callOpenClawTool.mockResolvedValue({ ok: true });
      invokeGatewayTool.mockImplementation(async (toolName) => {
        if (toolName === 'sessions_list') {
          return {
            sessions: [
              {
                key: 'agent:musicate-pm:discord:channel:1480310282961289216',
                sessionId: 'pm-discord-session',
                deliveryContext: { channel: 'discord', to: '1480310282961289216' },
                lastChannel: 'discord',
                lastTo: '1480310282961289216',
              },
            ],
          };
        }

        return {};
      });

      const result = await chat({
        message: 'Hola from Telegram',
        _agentDelivery: {
          activateSession: true,
          sourceAgentId: 'monti-telegram',
          requestedTarget: '@guali-discord',
        },
      });

      expect(callOpenClawTool).toHaveBeenCalledWith('message', expect.objectContaining({
        to: 'channel:1480310282961289216',
        target: 'channel:1480310282961289216',
        channel: 'discord',
      }), {
        sessionKey: 'agent:main:discord:channel:1480310282961289216',
      });
      expect(runOpenClawAgentTurn).toHaveBeenCalledWith(expect.objectContaining({
        agentId: 'main',
        sessionId: null,
        deliver: false,
        replyTo: 'channel:1480310282961289216',
        replyChannel: 'discord',
      }));
      expect(result.agent_dispatch).toBe('activated');
    });

    it('handles gateway errors gracefully', async () => {
      callOpenClawTool.mockRejectedValue(new Error('Gateway unavailable'));

      const result = await chat({
        target: '5914004682',
        message: 'Hello'
      });

      expect(result.error).toContain('Failed to send message');
      expect(result.details).toContain('Gateway unavailable');
    });
  });

  describe('broadcast', () => {
    it('validates parameters', async () => {
      const result = await broadcast();
      expect(result.error).toContain('Invalid parameters');
    });

    it('requires message', async () => {
      const result = await broadcast({});
      expect(result.error).toContain('Missing or invalid message');
    });

    it('rejects empty message', async () => {
      const result = await broadcast({ message: '' });
      expect(result.error).toContain('Missing or invalid message');
    });

    it('rejects message too long', async () => {
      const longMessage = 'a'.repeat(2001);
      const result = await broadcast({ message: longMessage });
      expect(result.error).toContain('too long');
      expect(result.max).toBe(2000);
    });

    it('validates priority values', async () => {
      const result = await broadcast({ message: 'Test', priority: 'invalid' });
      expect(result.error).toContain('Invalid priority');
    });

    it('validates targets is array', async () => {
      const result = await broadcast({ message: 'Test', targets: 'not-array' });
      expect(result.error).toContain('Must be an array');
    });

    it('rejects empty targets array', async () => {
      const result = await broadcast({ message: 'Test', targets: [] });
      expect(result.error).toContain('empty');
    });

    it('broadcasts to all peers by default', async () => {
      callPeers.mockResolvedValue([
        { peerId: 'peer1', result: { success: true } },
        { peerId: 'peer2', result: { success: true } }
      ]);

      const result = await broadcast({ message: 'Test broadcast' });

      expect(callPeers).toHaveBeenCalledWith(
        undefined, // all peers
        'chat',
        expect.objectContaining({ message: expect.stringContaining('Test broadcast') })
      );

      expect(result.success).toBe(true);
      expect(result.total_peers).toBe(2);
      expect(result.successful_deliveries).toBe(2);
      expect(result.failed_deliveries).toBe(0);
    });

    it('broadcasts to specific targets', async () => {
      callPeers.mockResolvedValue([
        { peerId: 'peer1', result: { success: true } }
      ]);

      await broadcast({
        message: 'Targeted broadcast',
        targets: ['peer1', 'peer2']
      });

      expect(callPeers).toHaveBeenCalledWith(
        ['peer1', 'peer2'],
        'chat',
        expect.any(Object)
      );
    });

    it('adds priority prefix to message', async () => {
      callPeers.mockResolvedValue([
        { peerId: 'peer1', result: { success: true } }
      ]);

      await broadcast({ message: 'Test', priority: 'urgent' });

      expect(callPeers).toHaveBeenCalledWith(
        undefined,
        'chat',
        expect.objectContaining({ message: expect.stringContaining('🚨 URGENT:') })
      );
    });

    it('uses custom skill if provided', async () => {
      callPeers.mockResolvedValue([
        { peerId: 'peer1', result: { success: true } }
      ]);

      await broadcast({
        message: 'Test',
        skill: 'custom_alert'
      });

      expect(callPeers).toHaveBeenCalledWith(
        undefined,
        'custom_alert',
        expect.any(Object)
      );
    });

    it('reports mixed success/failure results', async () => {
      callPeers.mockResolvedValue([
        { peerId: 'peer1', result: { success: true } },
        { peerId: 'peer2', result: { error: 'Peer unavailable' } },
        { peerId: 'peer3', error: 'Peer call failed' }
      ]);

      const result = await broadcast({ message: 'Test' });

      expect(result.total_peers).toBe(3);
      expect(result.successful_deliveries).toBe(1);
      expect(result.failed_deliveries).toBe(2);
      expect(result.results).toHaveLength(3);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(false);
      expect(result.results[2].success).toBe(false);
    });

    it('handles callPeers errors gracefully', async () => {
      callPeers.mockRejectedValue(new Error('Network failure'));

      const result = await broadcast({ message: 'Test' });

      expect(result.error).toContain('Failed to broadcast');
      expect(result.details).toContain('Network failure');
    });
  });
});
