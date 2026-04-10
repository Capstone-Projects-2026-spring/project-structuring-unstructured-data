/**
 * Shared date utilities used for summary route query validation and normalization.
 */

function parseWeekQuery(weekQuery) {
  if (weekQuery === undefined) {
    return { ok: true, value: undefined };
  }

  const weekNum = Number.parseInt(weekQuery, 10);
  if (!Number.isInteger(weekNum) || weekNum < 0 || weekNum > 53) {
    return { ok: false, error: 'week query must be an integer between 0 and 53.' };
  }

  return { ok: true, value: weekNum };
}

function toCanonicalWeekStartIso(input) {
  if (!input) {
    return null;
  }

  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const utcDateOnly = new Date(Date.UTC(
    parsed.getUTCFullYear(),
    parsed.getUTCMonth(),
    parsed.getUTCDate(),
    0,
    0,
    0,
    0,
  ));

  const daysSinceSunday = utcDateOnly.getUTCDay();
  utcDateOnly.setUTCDate(utcDateOnly.getUTCDate() - daysSinceSunday);

  return utcDateOnly.toISOString().replace('.000Z', 'Z');
}

function toNextWeekIso(weekStartIso) {
  const start = new Date(weekStartIso);
  start.setUTCDate(start.getUTCDate() + 7);
  return start.toISOString().replace('.000Z', 'Z');
}

module.exports = {
  parseWeekQuery,
  toCanonicalWeekStartIso,
  toNextWeekIso,
};
