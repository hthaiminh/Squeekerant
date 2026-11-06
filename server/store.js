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
];
// Only the newest pictures are kept. An older link still opens, with the game's own picture.
const KEEP_PICTURES = 20000;

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
  const sorted = () => Array.from(players.values()).filter((p) => !p.hidden).sort((a, b) => b.total - a.total || a.reachedAt - b.reachedAt);
  return {
    open: true,
    players,
    pictures,
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

module.exports = { sqlStore, memoryStore, cloudStore, closedStore, BOARD_SIZE, KEEP_PICTURES };
