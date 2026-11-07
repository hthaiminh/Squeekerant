// Where the board is kept. In the cloud it is Postgres. On this computer `npm start` keeps it in memory.
const dayOf = (now) => new Date(now).toISOString().slice(0, 10);
const BOARD_SIZE = 100;
const DAY_MS = 86400000;

const TABLES = [
  `CREATE TABLE IF NOT EXISTS players (
    wallet text PRIMARY KEY,
    shop text NOT NULL,
    chef text NOT NULL,
    fur text NOT NULL,
    hat text NOT NULL,
    level integer NOT NULL,
    xp bigint NOT NULL,
    total_xp bigint NOT NULL,
    house integer NOT NULL,
    first_seen timestamptz NOT NULL,
    last_seen timestamptz NOT NULL,
    reached_at timestamptz NOT NULL,
    hidden boolean NOT NULL DEFAULT false
  )`,
  'CREATE INDEX IF NOT EXISTS players_board ON players (total_xp DESC, reached_at ASC) WHERE NOT hidden',
  // One line per wallet per day, so any later reward can look at how someone got there and how often they came.
  `CREATE TABLE IF NOT EXISTS player_days (
    wallet text NOT NULL,
    day date NOT NULL,
    total_xp bigint NOT NULL,
    PRIMARY KEY (wallet, day)
  )`,
  // How far people get: one number per step per day. Nothing here says who.
  `CREATE TABLE IF NOT EXISTS counts (
    day date NOT NULL,
    step text NOT NULL,
    n bigint NOT NULL,
    PRIMARY KEY (day, step)
  )`,
  // Shared pictures, kept as the plain data they are painted from. Nothing here says who made them.
  `CREATE TABLE IF NOT EXISTS pictures (
    id text PRIMARY KEY,
    made timestamptz NOT NULL,
    pic jsonb NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS pictures_made ON pictures (made)',
  // Browsers that asked for wake up alerts: where their push service takes messages for them, and the keys to encrypt to.
  // Nothing here says who, and the address only works for sending to that one browser.
  `CREATE TABLE IF NOT EXISTS push_subs (
    id bigserial PRIMARY KEY,
    endpoint text NOT NULL UNIQUE,
    p256dh text NOT NULL,
    auth text NOT NULL,
    made timestamptz NOT NULL,
    seen timestamptz NOT NULL
  )`,
  // Every Dream Dish, as the game's own rule finds it in the wheel's rounds, and how far its alert has gone out.
  `CREATE TABLE IF NOT EXISTS dreams (
    wheel text NOT NULL,
    core text NOT NULL,
    chain text NOT NULL,
    round integer NOT NULL,
    hash text NOT NULL,
    dream integer NOT NULL,
    gold boolean NOT NULL,
    slept integer NOT NULL,
    woke timestamptz NOT NULL,
    found timestamptz NOT NULL,
    done boolean NOT NULL,
    sent integer NOT NULL DEFAULT 0,
    sent_to bigint NOT NULL DEFAULT 0,
    held_until timestamptz,
    PRIMARY KEY (wheel, round)
  )`,
  'CREATE INDEX IF NOT EXISTS dreams_woke ON dreams (woke DESC)',
];
// Only the newest pictures are kept. An older link still opens, with the game's own picture.
const KEEP_PICTURES = 20000;
// A ceiling on browsers with alerts, so a flood of made up ones cannot fill the database.
const MOST_SUBS = 100000;
const DREAMS_LISTED = 500;
const dreamRow = (r) => ({ wheel: r.wheel, core: r.core, chain: r.chain, round: Number(r.round), hash: r.hash, dream: Number(r.dream), gold: !!r.gold, slept: Number(r.slept), woke: new Date(r.woke).getTime(), done: !!r.done, sent: Number(r.sent) });
const DREAM_COLUMNS = 'wheel, core, chain, round, hash, dream, gold, slept, woke, done, sent';

// `query(text, params)` runs one statement and gives back its rows.
function sqlStore(query) {
  let ready = null;
  const prepare = () => {
    if (!ready) {
      ready = (async () => {
        for (const statement of TABLES) await query(statement, []);
      })().catch((e) => {
        ready = null;
        throw e;
      });
    }
    return ready;
  };
  return {
    open: true,
    async saveScore(wallet, score, now) {
      await prepare();
      const at = new Date(now).toISOString();
      // A wallet keeps its best restaurant. A new game that is still behind it changes nothing on the board.
      const rows = await query(
        `INSERT INTO players (wallet, shop, chef, fur, hat, level, xp, total_xp, house, first_seen, last_seen, reached_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10, $10)
         ON CONFLICT (wallet) DO UPDATE SET
           last_seen = excluded.last_seen,
           shop = CASE WHEN excluded.total_xp >= players.total_xp THEN excluded.shop ELSE players.shop END,
           chef = CASE WHEN excluded.total_xp >= players.total_xp THEN excluded.chef ELSE players.chef END,
           fur = CASE WHEN excluded.total_xp >= players.total_xp THEN excluded.fur ELSE players.fur END,
           hat = CASE WHEN excluded.total_xp >= players.total_xp THEN excluded.hat ELSE players.hat END,
           house = CASE WHEN excluded.total_xp >= players.total_xp THEN excluded.house ELSE players.house END,
           level = CASE WHEN excluded.total_xp >= players.total_xp THEN excluded.level ELSE players.level END,
           xp = CASE WHEN excluded.total_xp >= players.total_xp THEN excluded.xp ELSE players.xp END,
           reached_at = CASE WHEN excluded.total_xp > players.total_xp THEN excluded.last_seen ELSE players.reached_at END,
           total_xp = GREATEST(players.total_xp, excluded.total_xp)
         RETURNING shop, chef, fur, hat, level, house, total_xp, reached_at, hidden`,
        [wallet, score.shop, score.chef, score.fur, score.hat, score.level, score.xp, score.total, score.house, at]
      );
      const best = rows[0];
      await query(
        `INSERT INTO player_days (wallet, day, total_xp) VALUES ($1, $2, $3)
         ON CONFLICT (wallet, day) DO UPDATE SET total_xp = GREATEST(player_days.total_xp, excluded.total_xp)`,
        [wallet, dayOf(now), best.total_xp]
      );
      const place = await query(
        `SELECT
           (SELECT count(*) FROM players WHERE NOT hidden AND (total_xp > $1 OR (total_xp = $1 AND reached_at < $2))) AS ahead,
           (SELECT count(*) FROM players WHERE NOT hidden) AS everyone`,
        [best.total_xp, best.reached_at]
      );
      return {
        row: { shop: best.shop, chef: best.chef, fur: best.fur, hat: best.hat, level: Number(best.level), house: Number(best.house), total: Number(best.total_xp) },
        rank: best.hidden ? null : Number(place[0].ahead) + 1,
        total: Number(place[0].everyone),
      };
    },
    // The steps have been cleaned and are all different, which one statement needs.
    async addCounts(steps, now) {
      await prepare();
      await query(
        `INSERT INTO counts (day, step, n)
         SELECT $1::date, value, 1 FROM jsonb_array_elements_text($2::jsonb)
         ON CONFLICT (day, step) DO UPDATE SET n = counts.n + 1`,
        [dayOf(now), JSON.stringify(steps)]
      );
    },
    async counts(now, days) {
      await prepare();
      const rows = await query(`SELECT to_char(day, 'YYYY-MM-DD') AS day, step, n FROM counts WHERE day >= $1::date ORDER BY day, step`, [dayOf(now - (days - 1) * DAY_MS)]);
      return rows.map((r) => ({ day: r.day, step: r.step, n: Number(r.n) }));
    },
    async savePicture(id, pic, now) {
      await prepare();
      await query('INSERT INTO pictures (id, made, pic) VALUES ($1, $2, $3::jsonb) ON CONFLICT (id) DO NOTHING', [id, new Date(now).toISOString(), JSON.stringify(pic)]);
      await query(`DELETE FROM pictures WHERE made < (SELECT made FROM pictures ORDER BY made DESC OFFSET ${KEEP_PICTURES - 1} LIMIT 1)`, []);
    },
    async picture(id) {
      await prepare();
      const rows = await query('SELECT pic FROM pictures WHERE id = $1', [id]);
      if (!rows.length) return null;
      const pic = rows[0].pic;
      return typeof pic === 'string' ? JSON.parse(pic) : pic;
    },
    async picturesToday(now) {
      await prepare();
      const rows = await query('SELECT count(*) AS n FROM pictures WHERE made >= $1::date', [dayOf(now)]);
      return Number(rows[0].n);
    },
    // A browser that said yes. The same browser again only refreshes its keys.
    async addSub(sub, now) {
      await prepare();
      const at = new Date(now).toISOString();
      const known = await query('SELECT 1 FROM push_subs WHERE endpoint = $1', [sub.endpoint]);
      if (!known.length && Number((await query('SELECT count(*) AS n FROM push_subs', []))[0].n) >= MOST_SUBS) return false;
      await query(
        `INSERT INTO push_subs (endpoint, p256dh, auth, made, seen) VALUES ($1, $2, $3, $4, $4)
         ON CONFLICT (endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, seen = excluded.seen`,
        [sub.endpoint, sub.p256dh, sub.auth, at]
      );
      return true;
    },
    async dropSub(endpoint) {
      await prepare();
      await query('DELETE FROM push_subs WHERE endpoint = $1', [endpoint]);
    },
    async subsAfter(id, limit) {
      await prepare();
      const rows = await query(`SELECT id, endpoint, p256dh, auth FROM push_subs WHERE id > $1 ORDER BY id LIMIT ${Math.floor(limit)}`, [id]);
      return rows.map((r) => ({ id: Number(r.id), endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth }));
    },
    async lastDream(wheel) {
      await prepare();
      const rows = await query('SELECT round FROM dreams WHERE wheel = $1 ORDER BY round DESC LIMIT 1', [wheel]);
      return rows.length ? Number(rows[0].round) : null;
    },
    // Dreams found in the rounds. One that woke before `oldFrom` is too old for an alert and is kept as already done.
    async addDreams(list, now, oldFrom) {
      await prepare();
      for (const d of list) {
        await query(
          `INSERT INTO dreams (wheel, core, chain, round, hash, dream, gold, slept, woke, found, done) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (wheel, round) DO NOTHING`,
          [d.wheel, d.core, d.chain, d.round, d.hash, d.dream, d.gold, d.slept, new Date(d.woke).toISOString(), new Date(now).toISOString(), d.woke < oldFrom]
        );
      }
    },
    // Only one sender at a time works on a dream's alert. Gives back how far it has gone, or null when someone else has it or it is done.
    async claimDream(wheel, round, now, holdMs) {
      await prepare();
      const rows = await query(
        `UPDATE dreams SET held_until = $4 WHERE wheel = $1 AND round = $2 AND NOT done AND (held_until IS NULL OR held_until < $3)
         RETURNING sent, sent_to`,
        [wheel, round, new Date(now).toISOString(), new Date(now + holdMs).toISOString()]
      );
      return rows.length ? { sent: Number(rows[0].sent), sentTo: Number(rows[0].sent_to) } : null;
    },
    async dreamSent(wheel, round, sentTo, sent, done) {
      await prepare();
      await query('UPDATE dreams SET sent = sent + $3, sent_to = $4, done = $5, held_until = NULL WHERE wheel = $1 AND round = $2', [wheel, round, sent, sentTo, done]);
    },
    async dreams() {
      await prepare();
      const rows = await query(`SELECT ${DREAM_COLUMNS} FROM dreams ORDER BY woke DESC LIMIT ${DREAMS_LISTED}`, []);
      return rows.map(dreamRow);
    },
    // One dream by its round and the day (UTC) he woke, which together never repeat even if the wheel starts again.
    async dream(round, day) {
      await prepare();
      const rows = await query(`SELECT ${DREAM_COLUMNS} FROM dreams WHERE round = $1 AND to_char(woke AT TIME ZONE 'UTC', 'YYYY-MM-DD') = $2 LIMIT 1`, [round, day]);
      return rows.length ? dreamRow(rows[0]) : null;
    },
    async board() {
      await prepare();
      const rows = await query(
        `SELECT wallet, shop, chef, fur, hat, level, house, total_xp FROM players
         WHERE NOT hidden ORDER BY total_xp DESC, reached_at ASC LIMIT ${BOARD_SIZE}`,
        []
      );
      const count = await query('SELECT count(*) AS everyone FROM players WHERE NOT hidden', []);
      return {
        rows: rows.map((r) => ({ wallet: r.wallet, shop: r.shop, chef: r.chef, fur: r.fur, hat: r.hat, level: Number(r.level), house: Number(r.house), total: Number(r.total_xp) })),
        total: Number(count[0].everyone),
      };
    },
  };
}

function memoryStore() {
  const players = new Map();
  const counted = new Map();
  const pictures = new Map();
  const subs = new Map();
  const dreams = new Map();
  let nextSub = 1;
  const sorted = () => Array.from(players.values()).filter((p) => !p.hidden).sort((a, b) => b.total - a.total || a.reachedAt - b.reachedAt);
  const dreamKey = (wheel, round) => wheel + ' ' + round;
  const plainDream = (d) => ({ wheel: d.wheel, core: d.core, chain: d.chain, round: d.round, hash: d.hash, dream: d.dream, gold: d.gold, slept: d.slept, woke: d.woke, done: d.done, sent: d.sent });
  return {
    open: true,
    players,
    pictures,
    subs,
    dreamsKept: dreams,
    async addSub(sub, now) {
      const known = subs.get(sub.endpoint);
      if (!known && subs.size >= MOST_SUBS) return false;
      subs.set(sub.endpoint, Object.assign(known || { id: nextSub++, made: now }, { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth, seen: now }));
      return true;
    },
    async dropSub(endpoint) {
      subs.delete(endpoint);
    },
    async subsAfter(id, limit) {
      return Array.from(subs.values()).filter((s) => s.id > id).sort((a, b) => a.id - b.id).slice(0, limit).map(({ id: n, endpoint, p256dh, auth }) => ({ id: n, endpoint, p256dh, auth }));
    },
    async lastDream(wheel) {
      let best = null;
      for (const d of dreams.values()) if (d.wheel === wheel && (best === null || d.round > best)) best = d.round;
      return best;
    },
    async addDreams(list, now, oldFrom) {
      for (const d of list) {
        const key = dreamKey(d.wheel, d.round);
        if (!dreams.has(key)) dreams.set(key, Object.assign({}, d, { found: now, done: d.woke < oldFrom, sent: 0, sentTo: 0, heldUntil: 0 }));
      }
    },
    async claimDream(wheel, round, now, holdMs) {
      const d = dreams.get(dreamKey(wheel, round));
      if (!d || d.done || d.heldUntil >= now) return null;
      d.heldUntil = now + holdMs;
      return { sent: d.sent, sentTo: d.sentTo };
    },
    async dreamSent(wheel, round, sentTo, sent, done) {
      const d = dreams.get(dreamKey(wheel, round));
      if (!d) return;
      Object.assign(d, { sent: d.sent + sent, sentTo, done, heldUntil: 0 });
    },
    async dreams() {
      return Array.from(dreams.values()).sort((a, b) => b.woke - a.woke).slice(0, DREAMS_LISTED).map(plainDream);
    },
    async dream(round, day) {
      for (const d of dreams.values()) if (d.round === round && dayOf(d.woke) === day) return plainDream(d);
      return null;
    },
    async savePicture(id, pic, now) {
      if (!pictures.has(id)) pictures.set(id, { made: now, pic: JSON.parse(JSON.stringify(pic)) });
      while (pictures.size > KEEP_PICTURES) pictures.delete(pictures.keys().next().value);
    },
    async picture(id) {
      const p = pictures.get(id);
      return p ? JSON.parse(JSON.stringify(p.pic)) : null;
    },
    async picturesToday(now) {
      const from = Date.parse(dayOf(now));
      let n = 0;
      for (const p of pictures.values()) if (p.made >= from) n++;
      return n;
    },
    async addCounts(steps, now) {
      for (const step of steps) {
        const key = dayOf(now) + ' ' + step;
        counted.set(key, (counted.get(key) || 0) + 1);
      }
    },
    async counts(now, days) {
      const from = dayOf(now - (days - 1) * DAY_MS);
      const rows = [];
      for (const [key, n] of counted) {
        const [day, step] = key.split(' ');
        if (day >= from) rows.push({ day, step, n });
      }
      return rows.sort((a, b) => a.day.localeCompare(b.day) || a.step.localeCompare(b.step));
    },
    async saveScore(wallet, score, now) {
      const p = players.get(wallet);
      if (!p) players.set(wallet, Object.assign({ wallet, firstSeen: now, lastSeen: now, reachedAt: now, hidden: false, days: { [dayOf(now)]: score.total } }, score));
      else {
        p.lastSeen = now;
        if (score.total > p.total) p.reachedAt = now;
        if (score.total >= p.total) Object.assign(p, score);
        p.days[dayOf(now)] = p.total;
      }
      const list = sorted();
      const me = players.get(wallet);
      const { shop, chef, fur, hat, level, house, total } = me;
      return { row: { shop, chef, fur, hat, level, house, total }, rank: me.hidden ? null : list.indexOf(me) + 1, total: list.length };
    },
    async board() {
      const list = sorted();
      return { rows: list.slice(0, BOARD_SIZE).map(({ wallet, shop, chef, fur, hat, level, house, total }) => ({ wallet, shop, chef, fur, hat, level, house, total })), total: list.length };
    },
  };
}

// Until a database is connected the board is simply closed, and the game says so.
const closedStore = { open: false };

function cloudStore(url) {
  if (!url) return closedStore;
  let sql = null;
  return sqlStore(async (text, params) => {
    if (!sql) sql = require('@neondatabase/serverless').neon(url);
    return sql.query(text, params);
  });
}

module.exports = { sqlStore, memoryStore, cloudStore, closedStore, BOARD_SIZE, KEEP_PICTURES, MOST_SUBS, DREAMS_LISTED, dayOf };
