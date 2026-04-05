/**
 * Shared Channel Utilities
 * 
 * This module contains utilities for working with Slack channel data
 * and is designed to be used by both bolt_slack and mongo_storage services.
 * It has NO dependencies on either service to avoid circular imports.
 */

// Normalizes channel names to create consistent database keys
const normalizeChannelName = (channelName) => {
  const sanitized = String(channelName || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!sanitized) {
    throw new Error('A valid channel name is required');
  }

  return sanitized;
};

/**
 * Builds a unique channel key by combining the channel ID and normalized name
 * @param {string} channelName - The Slack channel name
 * @param {string} channelId - The Slack channel ID
 * @returns {string} The unique channel key
 */
function buildChannelKey(channelName, channelId) {
  if (!channelId) {
    throw new Error(`Channel ID is required to build channel key`);
  }

  const normalizedName = normalizeChannelName(channelName);
  return `${normalizedName}_${channelId}`;
}

/**
 * Builds a database key from just the channel name
 * Used when the channel ID is not available (e.g., in mongo_storage lookups)
 * This assumes the channel name has already been normalized during initial storage
 * @param {string} channelName - The Slack channel name
 * @returns {string} A database key pattern for querying
 */
function buildDatabaseKeyFromName(channelName) {
  const normalizedName = normalizeChannelName(channelName);
  // Return pattern that starts with normalized name (followed by _channelId in actual db)
  return normalizedName;
}

module.exports = {
  normalizeChannelName,
  buildChannelKey,
  buildDatabaseKeyFromName,
};
