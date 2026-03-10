/**
 * Built-in Skills Tests
 */

const { chat } = require('../../src/skills/chat');
const { broadcast } = require('../../src/skills/broadcast');

// Mock dependencies
jest.mock('../../src/bridge');
jest.mock('../../src/client');
jest.mock('../../src/logger');
jest.mock('../../src/config', () => ({
  loadContactsConfig: jest.fn(() => ({ aliases: {} })),
}));

const { callOpenClawTool, loadBridgeConfig } = require('../../src/bridge');
const { callPeerSkill, callPeers } = require('../../src/client');
const { loadContactsConfig } = require('../../src/config');

describe('Built-in Skills', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loadBridgeConfig.mockReturnValue({
      enabled: true,
      exposed_tools: ['message'],
    });
    loadContactsConfig.mockReturnValue({ aliases: {} });
  });

  describe('chat', () => {
    it('validates parameters', async () => {
      const result = await chat();
      expect(result.error).toContain('Invalid parameters');
    });

    it('requires target', async () => {
      const result = await chat({ message: 'hello' });
      expect(result.error).toContain('Missing or invalid target');
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
        target: '5914004682',
        message: 'Hello from chat skill'
      });

      expect(result.success).toBe(true);
      expect(result.delivered_to).toBe('5914004682');
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

      expect(result.error).toContain('could not be resolved');
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
      });
      expect(callOpenClawTool).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.relayed_via).toBe('telegram-agent');
      expect(result.resolved_target).toBe('5914004682');
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
