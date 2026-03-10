/**
 * Chat skill - Send message to another platform via OpenClaw gateway
 */

const { callOpenClawTool, loadBridgeConfig } = require('../bridge');
const { loadAgentConfig, loadContactsConfig, loadPeersConfig } = require('../config');
const { callPeerSkill } = require('../client');
const {
  invokeGatewayTool,
  loadGatewayConfig,
  resolveGatewayDefaultAgentId,
  runOpenClawAgentTurn,
} = require('../openclaw-gateway');
const logger = require('../logger');

const MAX_RELAY_HOPS = 4;
const DEFAULT_OPENCLAW_MAIN_KEY = 'main';
const DEFAULT_OPENCLAW_ACCOUNT_ID = 'default';
const DEFAULT_AGENT_DISPATCH_TIMEOUT_SECONDS = 30;
const SESSION_LIST_LIMIT = 200;

function getTargetingSuggestion() {
  return 'Use @agent-name for agent-to-agent, #channel for local channels, #channel@agent for remote channels, or configure config/contacts.json aliases.';
}

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

function normalizeDefaultDelivery(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return null;
  }

  if (typeof entry.target !== 'string' || entry.target.trim().length === 0) {
    return null;
  }

  return {
    type: typeof entry.type === 'string' && entry.type.trim().length > 0
      ? entry.type.trim()
      : 'target',
    target: entry.target.trim(),
    channel: typeof entry.channel === 'string' && entry.channel.trim().length > 0
      ? entry.channel.trim()
      : null,
  };
}

function getLocalAgentContext() {
  try {
    const config = loadAgentConfig();
    return {
      agentId: typeof config?.id === 'string' && config.id.trim().length > 0
        ? config.id.trim()
        : null,
      openclawAgentId: typeof config?.openclaw_agent_id === 'string' && config.openclaw_agent_id.trim().length > 0
        ? config.openclaw_agent_id.trim()
        : null,
      agentUrl: typeof config?.url === 'string' && config.url.trim().length > 0
        ? config.url.trim()
        : null,
      defaultDelivery: normalizeDefaultDelivery(config?.default_delivery),
    };
  } catch {
    return {
      agentId: null,
      openclawAgentId: null,
      agentUrl: null,
      defaultDelivery: null,
    };
  }
}

function parseAgentTarget(target) {
  if (typeof target !== 'string') {
    return null;
  }

  const trimmed = target.trim();
  if (!trimmed) {
    return null;
  }

  const remoteChannelMatch = trimmed.match(/^(#[^@\s]+)@([^@\s]+)$/);
  if (remoteChannelMatch) {
    return {
      peerId: remoteChannelMatch[2],
      channelTarget: remoteChannelMatch[1],
    };
  }

  const remoteAgentMatch = trimmed.match(/^@([^@\s]+)$/);
  if (remoteAgentMatch) {
    return {
      peerId: remoteAgentMatch[1],
      channelTarget: null,
    };
  }

  return null;
}

function peerExists(peerId) {
  try {
    return loadPeersConfig().some((peer) => peer?.id === peerId);
  } catch {
    return false;
  }
}

function normalizeRelayMeta(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return { hops: 0, visited: [] };
  }

  const hops = Number.isInteger(entry.hops) && entry.hops >= 0 ? entry.hops : 0;
  const visited = Array.isArray(entry.visited)
    ? entry.visited.filter((value) => typeof value === 'string' && value.trim().length > 0)
    : [];

  return { hops, visited };
}

function buildRelayMeta(currentMeta, agentId) {
  const visited = [...currentMeta.visited];
  if (agentId && !visited.includes(agentId)) {
    visited.push(agentId);
  }

  return {
    hops: currentMeta.hops + 1,
    visited,
  };
}

function normalizeAgentDeliveryMeta(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry) || entry.activateSession !== true) {
    return null;
  }

  return {
    activateSession: true,
    sourceAgentId: typeof entry.sourceAgentId === 'string' && entry.sourceAgentId.trim().length > 0
      ? entry.sourceAgentId.trim()
      : null,
    sourceUrl: typeof entry.sourceUrl === 'string' && entry.sourceUrl.trim().length > 0
      ? entry.sourceUrl.trim()
      : null,
    requestedTarget: typeof entry.requestedTarget === 'string' && entry.requestedTarget.trim().length > 0
      ? entry.requestedTarget.trim()
      : null,
    remoteChannelTarget: typeof entry.remoteChannelTarget === 'string' && entry.remoteChannelTarget.trim().length > 0
      ? entry.remoteChannelTarget.trim()
      : null,
  };
}

function buildAgentDeliveryMeta({ sourceAgentId, sourceUrl, requestedTarget, remoteChannelTarget }) {
  return {
    activateSession: true,
    ...(sourceAgentId ? { sourceAgentId } : {}),
    ...(sourceUrl ? { sourceUrl } : {}),
    ...(requestedTarget ? { requestedTarget } : {}),
    ...(remoteChannelTarget ? { remoteChannelTarget } : {}),
  };
}

function normalizeRequestPeerId(value, localAgentId) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed || ['__shared__', 'anonymous', 'unknown'].includes(trimmed)) {
    return null;
  }

  if (localAgentId && trimmed === localAgentId) {
    return null;
  }

  return trimmed;
}

function normalizePeerBaseUrl(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return '';
  }

  try {
    const url = new URL(value.trim());
    const normalizedPath = url.pathname.replace(/\/+$/, '').replace(/\/a2a$/, '');
    return `${url.origin}${normalizedPath}`;
  } catch {
    return '';
  }
}

function findPeerIdBySourceUrl(sourceUrl, localAgentId) {
  const normalizedSourceUrl = normalizePeerBaseUrl(sourceUrl);
  if (!normalizedSourceUrl) {
    return null;
  }

  try {
    const peer = loadPeersConfig().find((entry) => normalizePeerBaseUrl(entry?.url) === normalizedSourceUrl);
    if (!peer || typeof peer.id !== 'string' || peer.id.trim().length === 0) {
      return null;
    }

    return normalizeRequestPeerId(peer.id, localAgentId);
  } catch {
    return null;
  }
}

function resolveReplyRelayPeerId({ requestPeerId, sourceAgentId, sourceUrl, localAgentId }) {
  const requestPeer = normalizeRequestPeerId(requestPeerId, localAgentId);
  if (requestPeer) {
    return requestPeer;
  }

  const sourceUrlPeer = findPeerIdBySourceUrl(sourceUrl, localAgentId);
  if (sourceUrlPeer) {
    return sourceUrlPeer;
  }

  return normalizeRequestPeerId(sourceAgentId, localAgentId);
}

function normalizeSessionToken(value, fallback) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) {
    return fallback;
  }

  const normalized = trimmed.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
  return normalized || fallback;
}

function normalizeDmScope(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (['per-account-channel-peer', 'per-channel-peer', 'per-peer', 'main'].includes(normalized)) {
    return normalized;
  }

  return 'main';
}

function buildAgentMainSessionKey(agentId, mainKey = DEFAULT_OPENCLAW_MAIN_KEY) {
  return `agent:${normalizeSessionToken(agentId, 'main')}:${normalizeSessionToken(mainKey, DEFAULT_OPENCLAW_MAIN_KEY)}`;
}

function buildAgentPeerSessionKey({ agentId, channel, accountId, peerKind, peerId, dmScope, mainKey }) {
  const normalizedAgentId = normalizeSessionToken(agentId, 'main');
  const normalizedChannel = normalizeSessionToken(channel, 'unknown');
  const normalizedPeerId = typeof peerId === 'string' && peerId.trim().length > 0
    ? peerId.trim().toLowerCase()
    : 'unknown';

  if (peerKind === 'direct') {
    if (dmScope === 'per-account-channel-peer') {
      return `agent:${normalizedAgentId}:${normalizedChannel}:${normalizeSessionToken(accountId, DEFAULT_OPENCLAW_ACCOUNT_ID)}:direct:${normalizedPeerId}`;
    }

    if (dmScope === 'per-channel-peer') {
      return `agent:${normalizedAgentId}:${normalizedChannel}:direct:${normalizedPeerId}`;
    }

    if (dmScope === 'per-peer') {
      return `agent:${normalizedAgentId}:direct:${normalizedPeerId}`;
    }

    return buildAgentMainSessionKey(normalizedAgentId, mainKey);
  }

  return `agent:${normalizedAgentId}:${normalizedChannel}:${peerKind}:${normalizedPeerId}`;
}

function loadGatewaySessionSettings(gateway) {
  try {
    const config = loadGatewayConfig(gateway?.tokenPath || '~/.openclaw/openclaw.json');
    return {
      mainKey: normalizeSessionToken(config?.session?.mainKey, DEFAULT_OPENCLAW_MAIN_KEY),
      dmScope: normalizeDmScope(config?.session?.dmScope),
    };
  } catch {
    return {
      mainKey: DEFAULT_OPENCLAW_MAIN_KEY,
      dmScope: 'main',
    };
  }
}

function resolveConfiguredSessionKey(rawValue, fallback) {
  const trimmed = typeof rawValue === 'string' ? rawValue.trim() : '';
  if (!trimmed || trimmed.toLowerCase() === 'auto' || trimmed.toLowerCase() === 'main') {
    return fallback;
  }

  return trimmed;
}

function normalizeRequesterSessionMode(rawValue) {
  const trimmed = typeof rawValue === 'string' ? rawValue.trim().toLowerCase() : '';

  if (!trimmed || trimmed === 'auto' || trimmed === 'target') {
    return 'target';
  }

  if (trimmed === 'main') {
    return 'main';
  }

  return 'custom';
}

function resolveRequesterSessionKey(rawValue, { targetSessionKey, mainSessionKey }) {
  const mode = normalizeRequesterSessionMode(rawValue);

  if (mode === 'target') {
    return targetSessionKey;
  }

  if (mode === 'main') {
    return mainSessionKey;
  }

  return rawValue.trim();
}

function resolveDispatchAgentId({ tokenPath, configuredAgentId, fallbackAgentId }) {
  const configured = typeof configuredAgentId === 'string' && configuredAgentId.trim().length > 0
    ? configuredAgentId.trim()
    : '';
  if (configured) {
    return configured;
  }

  const fallback = typeof fallbackAgentId === 'string' && fallbackAgentId.trim().length > 0
    ? fallbackAgentId.trim()
    : '';
  if (fallback) {
    return fallback;
  }

  return resolveGatewayDefaultAgentId(tokenPath);
}

function resolveDispatchSessionKeys({ dispatchConfig, openclawAgentId, defaultDelivery, resolvedTarget, deliveryChannel, agentDeliveryMeta }) {
  const { mainKey, dmScope } = loadGatewaySessionSettings(dispatchConfig.gateway);
  const explicitTargetSessionKey = resolveConfiguredSessionKey(dispatchConfig.sessionKey, null);
  const tokenPath = dispatchConfig.gateway?.tokenPath || '~/.openclaw/openclaw.json';
  const deliveryType = typeof defaultDelivery?.type === 'string'
    ? defaultDelivery.type.trim().toLowerCase()
    : 'target';
  const routeChannel = (deliveryChannel || defaultDelivery?.channel || '').trim().toLowerCase();
  const shouldUseChannelRoute = Boolean(agentDeliveryMeta?.remoteChannelTarget) || deliveryType === 'channel';
  const peerKind = shouldUseChannelRoute ? 'channel' : 'direct';
  const dispatchAgentId = resolveDispatchAgentId({
    tokenPath,
    configuredAgentId: dispatchConfig.agentId,
    fallbackAgentId: openclawAgentId,
  });
  const mainSessionKey = buildAgentMainSessionKey(dispatchAgentId, mainKey);
  const targetSessionKey = explicitTargetSessionKey || (
    routeChannel && typeof resolvedTarget === 'string' && resolvedTarget.trim().length > 0
      ? buildAgentPeerSessionKey({
          agentId: dispatchAgentId,
          channel: routeChannel,
          accountId: dispatchConfig.accountId || DEFAULT_OPENCLAW_ACCOUNT_ID,
          peerKind,
          peerId: resolvedTarget,
          dmScope,
          mainKey,
        })
      : mainSessionKey
  );

  return {
    dispatchAgentId,
    mainSessionKey,
    requesterSessionKey: resolveRequesterSessionKey(dispatchConfig.requesterSessionKey, {
      targetSessionKey,
      mainSessionKey,
    }),
    targetSessionKey,
  };
}

function getAgentDispatchConfig({ openclawAgentId, defaultDelivery, resolvedTarget, deliveryChannel, agentDeliveryMeta }) {
  const bridgeConfig = loadBridgeConfig();
  const dispatchConfig = bridgeConfig?.agent_dispatch || {};

  if (!bridgeConfig || !bridgeConfig.enabled || dispatchConfig.enabled === false) {
    return null;
  }

  const resolvedSessions = resolveDispatchSessionKeys({
    dispatchConfig: {
      ...dispatchConfig,
      gateway: bridgeConfig.gateway,
    },
    openclawAgentId,
    defaultDelivery,
    resolvedTarget,
    deliveryChannel,
    agentDeliveryMeta,
  });

  return {
    dispatchAgentId: resolvedSessions.dispatchAgentId,
    requesterSessionBehavior: normalizeRequesterSessionMode(dispatchConfig.requesterSessionKey),
    requesterSessionKey: resolvedSessions.requesterSessionKey,
    targetSessionKey: resolvedSessions.targetSessionKey,
    timeoutSeconds: typeof dispatchConfig.timeoutSeconds === 'number' && Number.isFinite(dispatchConfig.timeoutSeconds)
      ? Math.max(0, Math.floor(dispatchConfig.timeoutSeconds))
      : 0,
    timeoutMs: bridgeConfig.timeout_ms || 300000,
    gateway: bridgeConfig.gateway,
  };
}

function stripAgentSessionPrefix(sessionKey) {
  const trimmed = typeof sessionKey === 'string' ? sessionKey.trim() : '';
  if (!trimmed) {
    return '';
  }

  const parts = trimmed.split(':').filter(Boolean);
  if (parts.length >= 3 && parts[0] === 'agent') {
    return parts.slice(2).join(':');
  }

  return trimmed;
}

function normalizeSessionComparisonValue(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeComparableDeliveryChannel(value) {
  const normalized = normalizeSessionComparisonValue(value);
  if (!normalized) {
    return '';
  }

  if (normalized === 'tg') {
    return 'telegram';
  }

  return normalized;
}

function normalizeComparableDeliveryTarget(channel, value) {
  let normalized = normalizeSessionComparisonValue(value);
  if (!normalized) {
    return '';
  }

  const normalizedChannel = normalizeComparableDeliveryChannel(channel);
  const providerPrefixes = [
    `${normalizedChannel}:`,
    'telegram:',
    'tg:',
    'discord:',
    'slack:',
    'whatsapp:',
    'signal:',
    'line:',
  ].filter(Boolean);

  for (const prefix of providerPrefixes) {
    if (normalized.startsWith(prefix)) {
      normalized = normalized.slice(prefix.length);
    }
  }

  if (normalized.startsWith('user:')) {
    normalized = normalized.slice(5);
  } else if (normalized.startsWith('channel:')) {
    normalized = normalized.slice(8);
  } else if (normalized.startsWith('group:')) {
    normalized = normalized.slice(6);
  }

  if (normalized.startsWith('@') || normalized.startsWith('#')) {
    normalized = normalized.slice(1);
  }

  return normalized;
}

function extractAgentIdFromSessionKey(sessionKey) {
  const trimmed = typeof sessionKey === 'string' ? sessionKey.trim() : '';
  if (!trimmed.startsWith('agent:')) {
    return '';
  }

  const parts = trimmed.split(':').filter(Boolean);
  if (parts.length < 2) {
    return '';
  }

  return normalizeSessionComparisonValue(parts[1]);
}

function matchesGatewaySessionRow(rowKey, targetSessionKey) {
  const normalizedRowKey = normalizeSessionComparisonValue(rowKey);
  const normalizedTarget = normalizeSessionComparisonValue(targetSessionKey);
  if (!normalizedRowKey || !normalizedTarget) {
    return false;
  }

  return normalizedRowKey === normalizedTarget
    || normalizedRowKey === normalizeSessionComparisonValue(stripAgentSessionPrefix(targetSessionKey));
}

function resolveSessionDeliveryTarget(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return { channel: null, to: null, accountId: null };
  }

  return {
    channel: typeof row?.deliveryContext?.channel === 'string' && row.deliveryContext.channel.trim().length > 0
      ? row.deliveryContext.channel.trim()
      : (typeof row?.lastChannel === 'string' && row.lastChannel.trim().length > 0 ? row.lastChannel.trim() : null),
    to: typeof row?.deliveryContext?.to === 'string' && row.deliveryContext.to.trim().length > 0
      ? row.deliveryContext.to.trim()
      : (typeof row?.lastTo === 'string' && row.lastTo.trim().length > 0 ? row.lastTo.trim() : null),
    accountId: typeof row?.deliveryContext?.accountId === 'string' && row.deliveryContext.accountId.trim().length > 0
      ? row.deliveryContext.accountId.trim()
      : (typeof row?.lastAccountId === 'string' && row.lastAccountId.trim().length > 0 ? row.lastAccountId.trim() : null),
  };
}

async function inspectDispatchSession(dispatchConfig) {
  if (!dispatchConfig?.targetSessionKey) {
    return { row: null, sessions: [] };
  }

  try {
    const result = await invokeGatewayTool('sessions_list', {
      limit: SESSION_LIST_LIMIT,
      messageLimit: 0,
    }, {
      gateway: dispatchConfig.gateway,
      sessionKey: dispatchConfig.targetSessionKey,
      timeoutMs: dispatchConfig.timeoutMs,
    });
    const sessions = Array.isArray(result?.sessions) ? result.sessions : [];
    return {
      row: sessions.find((row) => matchesGatewaySessionRow(row?.key, dispatchConfig.targetSessionKey)) || null,
      sessions,
    };
  } catch (err) {
    logger.warn('Unable to inspect target OpenClaw session before dispatch', {
      error: err.message,
      targetSessionKey: dispatchConfig.targetSessionKey,
    });
    return { row: null, sessions: [] };
  }
}

function findMatchingDeliverySessionRows(sessions, { resolvedTarget, deliveryChannel }) {
  const expectedChannel = normalizeComparableDeliveryChannel(deliveryChannel);
  const expectedTarget = normalizeComparableDeliveryTarget(expectedChannel, resolvedTarget);
  if (!expectedChannel || !expectedTarget) {
    return [];
  }

  return sessions.filter((row) => {
    const delivery = resolveSessionDeliveryTarget(row);
    return normalizeComparableDeliveryChannel(delivery.channel) === expectedChannel
      && normalizeComparableDeliveryTarget(expectedChannel, delivery.to) === expectedTarget;
  });
}

function maybeRetargetDispatchSession({ dispatchConfig, inspection, resolvedTarget, deliveryChannel }) {
  if (!dispatchConfig?.targetSessionKey) {
    return {
      dispatchConfig,
      sessionRow: null,
      sessions: [],
      retargeted: false,
    };
  }

  const sessions = Array.isArray(inspection?.sessions) ? inspection.sessions : [];
  const exactRow = inspection?.row || null;
  const matchingRows = findMatchingDeliverySessionRows(sessions, {
    resolvedTarget,
    deliveryChannel,
  });

  if (matchingRows.length === 0) {
    return {
      dispatchConfig,
      sessionRow: exactRow,
      sessions,
      retargeted: false,
    };
  }

  const currentAgentId = extractAgentIdFromSessionKey(dispatchConfig.targetSessionKey);
  const sameAgentRows = currentAgentId
    ? matchingRows.filter((row) => extractAgentIdFromSessionKey(row?.key) === currentAgentId)
    : [];
  const preferredRows = currentAgentId ? sameAgentRows : matchingRows;

  if (preferredRows.length !== 1) {
    return {
      dispatchConfig,
      sessionRow: exactRow,
      sessions,
      retargeted: false,
    };
  }

  const candidate = preferredRows[0];
  if (!candidate?.key || matchesGatewaySessionRow(candidate.key, dispatchConfig.targetSessionKey)) {
    return {
      dispatchConfig,
      sessionRow: exactRow || candidate,
      sessions,
      retargeted: false,
    };
  }

  logger.info('Retargeting OpenClaw agent dispatch to matching session context', {
    previousTargetSessionKey: dispatchConfig.targetSessionKey,
    nextTargetSessionKey: candidate.key,
    deliveryChannel: deliveryChannel || null,
    resolvedTarget,
  });

  return {
    dispatchConfig: {
      ...dispatchConfig,
      targetSessionKey: candidate.key,
      requesterSessionKey: dispatchConfig.requesterSessionBehavior === 'target'
        ? candidate.key
        : dispatchConfig.requesterSessionKey,
    },
    sessionRow: candidate,
    sessions,
    retargeted: true,
  };
}

function resolveAgentDispatchTimeoutSeconds(dispatchConfig) {
  if (typeof dispatchConfig?.timeoutSeconds === 'number' && Number.isFinite(dispatchConfig.timeoutSeconds)) {
    const normalized = Math.floor(dispatchConfig.timeoutSeconds);
    if (normalized > 0) {
      return normalized;
    }
  }

  return DEFAULT_AGENT_DISPATCH_TIMEOUT_SECONDS;
}

function resolveAgentActivationOptions({ dispatchConfig, sessionRow, resolvedTarget, deliveryChannel }) {
  const delivery = resolveSessionDeliveryTarget(sessionRow);
  const replyChannel = delivery.channel || deliveryChannel || null;
  const replyTo = delivery.to || resolvedTarget;

  return {
    agentId: dispatchConfig?.dispatchAgentId || null,
    sessionId: typeof sessionRow?.sessionId === 'string' && sessionRow.sessionId.trim().length > 0
      ? sessionRow.sessionId.trim()
      : null,
    target: replyTo,
    channel: replyChannel,
    replyTo,
    replyChannel,
    replyAccountId: delivery.accountId || null,
    timeoutSeconds: resolveAgentDispatchTimeoutSeconds(dispatchConfig),
  };
}

function extractTextFragments(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => extractTextFragments(entry));
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  if (Array.isArray(value.parts)) {
    return value.parts.flatMap((part) => {
      if (typeof part?.text === 'string') {
        return extractTextFragments(part.text);
      }
      if (typeof part?.content === 'string') {
        return extractTextFragments(part.content);
      }
      return [];
    });
  }

  if (Array.isArray(value.content)) {
    return value.content.flatMap((part) => {
      if (typeof part?.text === 'string') {
        return extractTextFragments(part.text);
      }
      if (typeof part?.content === 'string') {
        return extractTextFragments(part.content);
      }
      return [];
    });
  }

  return [
    ...extractTextFragments(value.text),
    ...extractTextFragments(value.message),
    ...extractTextFragments(value.output_text),
    ...extractTextFragments(value.content),
  ];
}

function extractOpenClawReplyText(dispatchResult) {
  const candidates = [
    dispatchResult?.result?.payloads,
    dispatchResult?.payloads,
    dispatchResult?.result?.messages,
    dispatchResult?.messages,
    dispatchResult?.result,
    dispatchResult,
  ];

  const fragments = candidates.flatMap((candidate) => extractTextFragments(candidate));
  if (fragments.length === 0) {
    return null;
  }

  return fragments.join('\n').trim() || null;
}

async function relayActivationReplyToSourcePeer({ sourceAgentId, message, relayMeta, agentId }) {
  if (typeof sourceAgentId !== 'string' || sourceAgentId.trim().length === 0) {
    return { status: 'not_requested' };
  }

  const normalizedSourceAgentId = sourceAgentId.trim();
  if (normalizedSourceAgentId === agentId) {
    return { status: 'not_requested' };
  }

  const relayMessage = typeof message === 'string' ? message.trim() : '';
  if (!relayMessage) {
    return { status: 'skipped_no_text' };
  }

  try {
    const result = await callPeerSkill(normalizedSourceAgentId, 'chat', {
      message: relayMessage,
      _relay: buildRelayMeta(relayMeta, agentId),
    });

    return {
      status: 'delivered',
      peerId: normalizedSourceAgentId,
      result,
    };
  } catch (err) {
    return {
      status: 'error',
      peerId: normalizedSourceAgentId,
      error: err.message,
    };
  }
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
  const requestedChannel = typeof channel === 'string' && channel.trim().length > 0
    ? channel.trim()
    : null;
  const { agentId, openclawAgentId, agentUrl, defaultDelivery } = getLocalAgentContext();
  const relayMeta = normalizeRelayMeta(params._relay);
  let agentDeliveryMeta = normalizeAgentDeliveryMeta(params._agentDelivery);
  const requestPeerId = normalizeRequestPeerId(params._requestPeerId, agentId);

  if (target !== undefined && typeof target !== 'string') {
    return {
      error: 'Invalid target. Must be a string when provided.',
      suggestion: getTargetingSuggestion(),
      usage: 'chat({ target: "@discord-agent", message: "Hello" })'
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

  if (agentId && relayMeta.visited.includes(agentId)) {
    return {
      error: 'Relay loop detected while delivering chat.',
      suggestion: 'Check config/contacts.json relay aliases and @agent routing to avoid circular peer delivery.',
      relay_hops: relayMeta.hops,
      relay_path: relayMeta.visited,
    };
  }

  if (relayMeta.hops >= MAX_RELAY_HOPS) {
    return {
      error: 'Relay hop limit exceeded while delivering chat.',
      suggestion: 'Check config/contacts.json and peer routing for circular or overly indirect delivery paths.',
      relay_hops: relayMeta.hops,
      max_hops: MAX_RELAY_HOPS,
      relay_path: relayMeta.visited,
    };
  }

  const requestedTarget = typeof target === 'string' ? target.trim() : '';
  let effectiveTarget = requestedTarget;
  let effectiveChannel = requestedChannel;

  if (!effectiveTarget) {
    if (!defaultDelivery) {
      return {
        error: 'Missing target and no default delivery is configured.',
        suggestion: `${getTargetingSuggestion()} Configure config/agent.json -> default_delivery to support @agent delivery and broadcasts.`,
        usage: 'chat({ target: "@discord-agent", message: "Hello" })'
      };
    }

    effectiveTarget = defaultDelivery.target;
    effectiveChannel = effectiveChannel || defaultDelivery.channel;
  }

  const agentTarget = parseAgentTarget(effectiveTarget);
  if (agentTarget) {
    if (agentTarget.peerId === agentId) {
      agentDeliveryMeta = agentDeliveryMeta || buildAgentDeliveryMeta({
        sourceAgentId: agentId,
        sourceUrl: agentUrl,
        requestedTarget: requestedTarget || effectiveTarget,
        remoteChannelTarget: agentTarget.channelTarget,
      });

      if (agentTarget.channelTarget) {
        effectiveTarget = agentTarget.channelTarget;
      } else if (defaultDelivery) {
        effectiveTarget = defaultDelivery.target;
        effectiveChannel = effectiveChannel || defaultDelivery.channel;
      } else {
        return {
          error: 'Agent target resolved to this agent, but no default delivery is configured.',
          target: requestedTarget || effectiveTarget,
          suggestion: 'Configure config/agent.json -> default_delivery so this agent knows where to deliver @agent messages.',
        };
      }
    } else {
      if (!peerExists(agentTarget.peerId)) {
        return {
          error: `Unknown peer target "${agentTarget.peerId}".`,
          target: requestedTarget || effectiveTarget,
          suggestion: 'Add the peer to config/peers.json or re-run npm run setup to register it.',
        };
      }

      const relayParams = { message };
      if (agentTarget.channelTarget) {
        relayParams.target = agentTarget.channelTarget;
      }
      relayParams._relay = buildRelayMeta(relayMeta, agentId);
      relayParams._agentDelivery = buildAgentDeliveryMeta({
        sourceAgentId: agentId,
        sourceUrl: agentUrl,
        requestedTarget: requestedTarget || effectiveTarget,
        remoteChannelTarget: agentTarget.channelTarget,
      });

      try {
        logger.info('Relaying chat message to peer agent', {
          target: requestedTarget || effectiveTarget,
          relayPeerId: agentTarget.peerId,
          relayChannelTarget: agentTarget.channelTarget || null,
        });

        const relayResult = await callPeerSkill(agentTarget.peerId, 'chat', relayParams);
        return {
          ...relayResult,
          delivered_to: requestedTarget || effectiveTarget,
          relayed_via: agentTarget.peerId,
          remote_target: agentTarget.channelTarget || null,
          channel: relayResult.channel || effectiveChannel || 'default',
        };
      } catch (err) {
        logger.error('Agent-target chat relay failed', {
          error: err.message,
          target: requestedTarget || effectiveTarget,
          relayPeerId: agentTarget.peerId,
          relayChannelTarget: agentTarget.channelTarget || null,
        });

        return {
          error: 'Failed to relay message to the target agent',
          details: err.message,
          target: requestedTarget || effectiveTarget,
          relay_peer: agentTarget.peerId,
          suggestion: 'Check that the target peer exists, is reachable, and exposes the chat skill.',
        };
      }
    }
  }

  const resolved = resolveTarget(effectiveTarget, effectiveChannel);
  const resolvedTarget = resolved.resolvedTarget;

  if (resolved.relayPeerId && resolved.relayPeerId !== agentId) {
    try {
      logger.info('Relaying chat message to peer', {
        target: requestedTarget || effectiveTarget,
        resolvedTarget,
        relayPeerId: resolved.relayPeerId,
        targetAlias: resolved.alias,
        channel: resolved.resolvedChannel || effectiveChannel || 'auto',
      });

      const relayResult = await callPeerSkill(resolved.relayPeerId, 'chat', {
        target: resolvedTarget,
        message,
        channel: resolved.resolvedChannel || effectiveChannel,
        _relay: buildRelayMeta(relayMeta, agentId),
      });

      return {
        ...relayResult,
        delivered_to: requestedTarget || effectiveTarget,
        resolved_target: resolvedTarget,
        relayed_via: resolved.relayPeerId,
        channel: resolved.resolvedChannel || effectiveChannel || relayResult.channel || 'auto',
      };
    } catch (err) {
      logger.error('Chat relay failed', {
        error: err.message,
        target: requestedTarget || effectiveTarget,
        resolvedTarget,
        relayPeerId: resolved.relayPeerId,
        channel: resolved.resolvedChannel || effectiveChannel,
      });

      return {
        error: 'Failed to relay message to the correct peer',
        details: err.message,
        target: requestedTarget || effectiveTarget,
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
      error: 'No target found.',
      target: requestedTarget || effectiveTarget,
      suggestion: `${getTargetingSuggestion()} Configure config/contacts.json for local channel aliases, or configure agent.json -> default_delivery for agent-level delivery.`,
      usage: 'chat({ target: "@discord-agent", message: "Hello" })'
    };
  }

  try {
    let dispatchConfig = agentDeliveryMeta?.activateSession
      ? getAgentDispatchConfig({
          openclawAgentId,
          defaultDelivery,
          resolvedTarget,
          deliveryChannel: resolved.resolvedChannel || effectiveChannel,
          agentDeliveryMeta,
        })
      : null;
    let preDispatchInspection = dispatchConfig
      ? await inspectDispatchSession(dispatchConfig)
      : { row: null, sessions: [] };

    if (dispatchConfig) {
      const retargeted = maybeRetargetDispatchSession({
        dispatchConfig,
        inspection: preDispatchInspection,
        resolvedTarget,
        deliveryChannel: resolved.resolvedChannel || effectiveChannel,
      });
      dispatchConfig = retargeted.dispatchConfig;
      if (retargeted.retargeted) {
        preDispatchInspection = {
          row: retargeted.sessionRow,
          sessions: retargeted.sessions,
        };
      }
    }

    // The gateway expects a platform-specific target identifier.
    const messageArgs = {
      action: 'send',
      target: resolvedTarget,
      message
    };

    // Add optional channel if provided
    if (resolved.resolvedChannel || effectiveChannel) {
      messageArgs.channel = resolved.resolvedChannel || effectiveChannel;
    }

    logger.info('Sending chat message via gateway', {
      target: requestedTarget || effectiveTarget,
      resolvedTarget,
      targetAlias: resolved.alias,
      messageLength: message.length,
      channel: resolved.resolvedChannel || effectiveChannel || 'auto',
      openclawDispatchAgentId: dispatchConfig?.dispatchAgentId || null,
      openclawTargetSessionKey: dispatchConfig?.targetSessionKey || null,
    });

    if (dispatchConfig?.targetSessionKey) {
      await callOpenClawTool('message', messageArgs, { sessionKey: dispatchConfig.targetSessionKey });
    } else {
      await callOpenClawTool('message', messageArgs);
    }

    if (agentDeliveryMeta?.activateSession) {
      const inspection = dispatchConfig
        ? await inspectDispatchSession(dispatchConfig)
        : { row: null, sessions: [] };
      const sessionRow = inspection.row || preDispatchInspection.row || null;
      const activationOptions = resolveAgentActivationOptions({
        dispatchConfig,
        sessionRow,
        resolvedTarget,
        deliveryChannel: resolved.resolvedChannel || effectiveChannel,
      });

      try {
        const dispatchResult = await runOpenClawAgentTurn({
          message,
          ...activationOptions,
        });
        const replyRelayPeerId = resolveReplyRelayPeerId({
          requestPeerId,
          sourceAgentId: agentDeliveryMeta.sourceAgentId,
          sourceUrl: agentDeliveryMeta.sourceUrl,
          localAgentId: agentId,
        });
        const replyRelay = await relayActivationReplyToSourcePeer({
          sourceAgentId: replyRelayPeerId,
          message: extractOpenClawReplyText(dispatchResult),
          relayMeta,
          agentId,
        });

        if (replyRelay.status === 'error') {
          logger.error('Inbound agent reply relay failed', {
            error: replyRelay.error,
            sourceAgentId: replyRelay.peerId,
            target: requestedTarget || effectiveTarget,
            resolvedTarget,
          });
        } else if (replyRelay.status === 'delivered') {
          logger.info('Inbound agent reply relayed back to source peer', {
            sourceAgentId: replyRelay.peerId,
            target: requestedTarget || effectiveTarget,
            resolvedTarget,
          });
        }

        return {
          success: true,
          delivered_to: requestedTarget || effectiveTarget,
          resolved_target: resolvedTarget,
          channel: resolved.resolvedChannel || effectiveChannel || 'auto',
          message_length: message.length,
          agent_dispatch: 'activated',
          openclaw_session_id: activationOptions.sessionId,
          openclaw_agent_id: activationOptions.agentId,
          openclaw_reply_channel: activationOptions.replyChannel,
          openclaw_reply_to: activationOptions.replyTo,
          openclaw_result: dispatchResult?.result?.status || dispatchResult?.status || null,
          reply_relay: replyRelay.status,
          reply_relay_peer: replyRelay.peerId || null,
          ...(replyRelay.status === 'error'
            ? { reply_relay_error: replyRelay.error }
            : {}),
          timestamp: new Date().toISOString()
        };
      } catch (err) {
        logger.error('Inbound agent dispatch failed', {
          error: err.message,
          target: requestedTarget || effectiveTarget,
          resolvedTarget,
          sourceAgentId: agentDeliveryMeta.sourceAgentId || null,
          dispatchAgentId: dispatchConfig?.dispatchAgentId || null,
          targetSessionKey: dispatchConfig?.targetSessionKey || null,
          targetSessionId: activationOptions.sessionId,
        });

        return {
          error: 'Message was delivered, but receiving agent activation failed.',
          delivered_to: requestedTarget || effectiveTarget,
          resolved_target: resolvedTarget,
          transport_delivered: true,
          agent_dispatch: 'error',
          details: err.message,
          suggestion: 'Confirm the local OpenClaw CLI is installed, agent.json.openclaw_agent_id or bridge.agent_dispatch.agentId matches the receiving OpenClaw agent, and the target session or default delivery is valid.',
        };
      }
    }

    return {
      success: true,
      delivered_to: requestedTarget || effectiveTarget,
      resolved_target: resolvedTarget,
      channel: resolved.resolvedChannel || effectiveChannel || 'auto',
      message_length: message.length,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    logger.error('Chat skill failed', {
      error: err.message,
      target: requestedTarget || effectiveTarget,
      resolvedTarget,
      channel: resolved.resolvedChannel || effectiveChannel
    });

    return {
      error: 'Failed to send message via gateway',
      details: err.message,
      target: requestedTarget || effectiveTarget,
      resolved_target: resolvedTarget,
      suggestion: 'Check that OpenClaw gateway is running, bridge is enabled, and the target is a platform-specific ID or contacts alias.'
    };
  }
}

module.exports = { chat };
