// What the server accepts as a score. The whole game runs in the player's browser, so a number
// sent from there can be edited. These rules only keep out what cannot have happened.

// The day the game went public. Nobody can have played before this.
const LAUNCH = Date.parse('2026-11-04T00:00:00Z');
const DAY = 86400000;

// The same sum as xpNeed in src/core/engine.js. A test keeps them equal.
const xpNeed = (level) => Math.round(40 * Math.pow(level, 1.7));
const MAX_LEVEL = 200;
const MAX_HOUSE = 14;

function totalXp(level, xp) {
  let total = xp;
  for (let l = 1; l < level; l++) total += xpNeed(l);
  return total;
}

// A full day of his running, 13,000 passes, is 1,950 guests with the best yard, at 6 XP a plate if every
// recipe is at its top level. That is about 11,700 XP on the best day of a finished restaurant, and
// the best bot over 90 days averages about 5,400 a day. 9,000 a day since launch, with room for
// the one time rewards, stays above anything real and below what an edited save would ask for.
const CEILING_BASE = 8000;
const CEILING_PER_DAY = 9000;
function xpCeiling(now) {
  return CEILING_BASE + (Math.max(0, now - LAUNCH) / DAY) * CEILING_PER_DAY;
}

// Names go on a public board. No links, no markup, nothing that flips or hides text.
const LINKS = /https?:|www\.|t\.me|discord|@|\.(com|net|org|io|xyz|me|gg|app|online|site|link|ru|cn|top|fun|tv)\b/i;
function cleanName(value, fallback, max) {
  const text = String(value === undefined || value === null ? '' : value)
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const short = Array.from(text).slice(0, max).join('').trim();
  return short && !LINKS.test(short) ? short : fallback;
}

// Only the look's key is kept. The game checks it against its own list when it draws.
const lookKey = (value, fallback) => (/^[a-z0-9_]{1,20}$/.test(String(value)) ? String(value) : fallback);
const wholeNumber = (value, lo, hi) => Number.isSafeInteger(value) && value >= lo && value <= hi;

// Returns a clean score, or an error to send back.
function cleanScore(body, now) {
  const b = body || {};
  if (!wholeNumber(b.level, 1, MAX_LEVEL)) return { error: 'Bad level.' };
  if (!wholeNumber(b.xp, 0, xpNeed(b.level) - 1)) return { error: 'Bad progress.' };
  if (!wholeNumber(b.house, 1, MAX_HOUSE)) return { error: 'Bad house level.' };
  const total = totalXp(b.level, b.xp);
  if (total > xpCeiling(now)) return { impossible: true };
  return {
    shop: cleanName(b.shop, 'A Tiny Table', 22),
    chef: cleanName(b.chef, 'Bean', 14),
    fur: lookKey(b.fur, 'golden'),
    hat: lookKey(b.hat, 'toque'),
    level: b.level,
    xp: b.xp,
    house: b.house,
    total,
  };
}

module.exports = { xpNeed, totalXp, xpCeiling, cleanName, cleanScore, LAUNCH, MAX_LEVEL, MAX_HOUSE };
