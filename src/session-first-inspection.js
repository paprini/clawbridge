'use strict';

const fs = require('fs');
const path = require('path');
const { expandHome } = require('./openclaw-gateway');

function normalizeAgentId(value) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) {
    return '';
  }

  return trimmed.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
}

function normalizeComparableDeliveryChannel(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!normalized) {
    return '';
  }

  if (normalized === 'tg') {
    return 'telegram';
  }

  return normalized;
}

function normalizeComparableDeliveryTarget(channel, value) {
  let normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!normalized) {
    return '';
  }

  const normalizedChannel = normalizeComparableDeliveryChannel(channel);
  const providerPrefixes = [
    `${normalizedChannel}:`,
    'telegram:',
    'tg:',
    'discord:',
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

function resolveDefaultOpenClawSessionStore(tokenPath, agentId) {
  const openclawRoot = path.dirname(expandHome(tokenPath || '~/.openclaw/openclaw.json'));
  const normalizedAgentId = normalizeAgentId(agentId || 'main') || 'main';
  return path.join(openclawRoot, 'agents', normalizedAgentId, 'sessions', 'sessions.json');
}

function loadOpenClawSessionRows(tokenPath, agentId) {
  const storePath = resolveDefaultOpenClawSessionStore(tokenPath, agentId);
  if (!fs.existsSync(storePath)) {
    return { storePath, sessions: [] };
  }

  try {
    const raw = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    const sessions = raw && typeof raw === 'object' && !Array.isArray(raw)
      ? Object.entries(raw).map(([key, value]) => ({ key, ...(value || {}) }))
      : [];
    return { storePath, sessions };
  } catch {
    return { storePath, sessions: [] };
  }
}

function resolveSessionDeliveryContext(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return { channel: '', to: '' };
  }

  return {
    channel: typeof row?.deliveryContext?.channel === 'string' && row.deliveryContext.channel.trim().length > 0
      ? row.deliveryContext.channel.trim()
      : (typeof row?.lastChannel === 'string' ? row.lastChannel.trim() : ''),
    to: typeof row?.deliveryContext?.to === 'string' && row.deliveryContext.to.trim().length > 0
      ? row.deliveryContext.to.trim()
      : (typeof row?.lastTo === 'string' ? row.lastTo.trim() : ''),
  };
}

function findMatchingDirectSessionRows(rows, { channel, target }) {
  const expectedChannel = normalizeComparableDeliveryChannel(channel);
  const expectedTarget = normalizeComparableDeliveryTarget(channel, target);
  if (!expectedChannel || !expectedTarget) {
    return [];
  }

  return rows.filter((row) => {
    const delivery = resolveSessionDeliveryContext(row);
    return normalizeComparableDeliveryChannel(delivery.channel) === expectedChannel
      && normalizeComparableDeliveryTarget(expectedChannel, delivery.to) === expectedTarget;
  });
}

function isProviderBoundDirectSessionRow(row, channel, target) {
  const key = typeof row?.key === 'string' ? row.key.trim().toLowerCase() : '';
  if (!key) {
    return false;
  }

  const expectedChannel = normalizeComparableDeliveryChannel(channel);
  const expectedTarget = normalizeComparableDeliveryTarget(channel, target);
  if (!expectedChannel || !expectedTarget) {
    return false;
  }

  return key.includes(`:${expectedChannel}:direct:${expectedTarget}`);
}

function inspectDirectSessionEvidence({ tokenPath, agentId, channel, target }) {
  const sessionStore = loadOpenClawSessionRows(tokenPath, agentId);
  const matchingRows = findMatchingDirectSessionRows(sessionStore.sessions, { channel, target });
  const providerBoundRows = matchingRows.filter((row) => isProviderBoundDirectSessionRow(row, channel, target));
  const collapsedRows = matchingRows.filter((row) => !isProviderBoundDirectSessionRow(row, channel, target));

  return {
    storePath: sessionStore.storePath,
    matchingRows,
    providerBoundRows,
    collapsedRows,
    hasProviderBound: providerBoundRows.length > 0,
    hasCollapsedMatch: collapsedRows.length > 0,
  };
}

module.exports = {
  inspectDirectSessionEvidence,
  loadOpenClawSessionRows,
  findMatchingDirectSessionRows,
  isProviderBoundDirectSessionRow,
  normalizeComparableDeliveryChannel,
  normalizeComparableDeliveryTarget,
  resolveDefaultOpenClawSessionStore,
  resolveSessionDeliveryContext,
};
