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

// What the game may count, in the order a person gets there, with what each one means. Only these reach the database.
// The practice kitchen's steps follow the lesson in src/ui/practice.js. A test keeps them equal.
const LESSON_STEPS = ['wheel', 'stove', 'stoveWait', 'run', 'guests', 'till', 'wok', 'wokWait', 'line', 'pot', 'sleep', 'night', 'dream', 'door', 'tree', 'market', 'board', 'shop', 'ranks', 'street', 'house', 'clean', 'trade', 'arrange', 'recipes', 'howto'];
const COUNT_LABELS = [
  ['first_visit', 'Opened the page for the first time'],
  ['connect_pressed', 'Looked at connecting a wallet'],
  ['wallet_connected', 'Connected a wallet'],
  ['play_pressed', 'Pressed play with no restaurant yet'],
  ['lesson_declined', 'Skipped the practice kitchen at the start'],
  ['lesson_started', 'Started the practice kitchen'],
  ...LESSON_STEPS.map((id, i) => ['lesson_' + id, `Lesson step ${i + 1}: ${id}`]),
  ['lesson_left', 'Left the practice kitchen before the end'],
  ['lesson_finished', 'Finished the practice kitchen'],
  ['opened', 'Opened a real restaurant'],
  ['first_guest', 'Served a first real guest'],
  ['first_dream', 'Got a first Dream Dish'],
  ['active', 'Played today'],
  ['back_1', 'Still coming back after 1 day'],
  ['back_3', 'Still coming back after 3 days'],
  ['back_7', 'Still coming back after 7 days'],
  ['back_14', 'Still coming back after 14 days'],
  ['back_30', 'Still coming back after 30 days'],
  ['share_open', 'Opened the share picture'],
  ['share_post', 'Pressed post or share'],
  ['share_copy', 'Copied the picture'],
  ['share_save', 'Saved the picture'],
  ['save_code_made', 'Made a save code'],
  ['save_code_loaded', 'Opened a restaurant from a save code'],
  ['install_pressed', 'Pressed install'],
  ['installed', 'Installed the game as an app'],
];
const COUNT_STEPS = new Set(COUNT_LABELS.map(([step]) => step));
const MOST_STEPS = 60;

// One request may carry several steps. Each counts once, and anything else is ignored rather than stored.
function cleanSteps(body) {
  const list = body && body.steps;
  if (!Array.isArray(list) || list.length > MOST_STEPS) return { error: 'That is not a list of steps.' };
  return Array.from(new Set(list.filter((step) => typeof step === 'string' && COUNT_STEPS.has(step))));
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

module.exports = {
  COUNT_LABELS,
  LESSON_STEPS,
  cleanSteps, xpNeed, totalXp, xpCeiling, cleanName, cleanScore, LAUNCH, MAX_LEVEL, MAX_HOUSE };
