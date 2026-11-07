// The small server behind the leaderboard: proving you own a wallet, taking a score, and reading the board.
// Signing in only ever asks the wallet to sign a message. There is no fee and no transaction.
const crypto = require('crypto');
const { cleanScore, cleanSteps, COUNT_LABELS } = require('./rules');
const push = require('./push');
const { createWake } = require('./wake');

const TICKET_MS = 5 * 60000;
const SESSION_MS = 60 * 86400000;
const BOARD_CACHE = 'public, max-age=30, s-maxage=300, stale-while-revalidate=600';
const CLOSED_CACHE = 'public, max-age=30, s-maxage=60';
const COUNTS_CACHE = 'public, max-age=60, s-maxage=300';
const COUNT_DAYS = 14;
const PUBLIC_HOSTS = ['www.squeekerant.online', 'squeekerant.online', 'squeekerant.vercel.app'];
const LOCAL_HOST = /^(localhost|127\.0\.0\.1)(:\d+)?$/;
// A picture's link and the picture itself. The picture for an address never changes, so it may be kept for good.
const PICTURE_PATH = /^\/p\/([A-Za-z0-9_-]{12})(\.png)?$/;
const PICTURE_CACHE = 'public, max-age=31536000, s-maxage=31536000, immutable';
const PICTURE_PAGE_CACHE = 'public, max-age=300, s-maxage=86400';
const NO_PICTURE_CACHE = 'public, max-age=60, s-maxage=300';
// Enough for anyone sharing or playing, and a ceiling on what a flood could cost the database.
const PICTURES_PER_HOUR = 20;
const PICTURES_PER_DAY = 2000;
const COUNTS_PER_HOUR = 60;
const ALERT_CHANGES_PER_HOUR = 30;
const CHECKS_PER_HOUR = 60;
const HOUR_MS = 3600000;
// /dreams, a dream's own page, and its picture.
const DREAM_PATH = /^\/dreams(?:\/(\d{4}-\d{2}-\d{2}-\d{1,9})(\.png)?)?\/?$/;
const DREAMS_CACHE = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';
const DREAM_PAGE_CACHE = 'public, max-age=300, s-maxage=86400';
const KEY_CACHE = 'public, max-age=300, s-maxage=3600';

class Refusal extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const b64 = (data) => Buffer.from(data).toString('base64url');

// A plain table for looking at by hand. Everything in it comes from the fixed list of steps, so there is nothing to escape.
function countsPage(rows, now) {
  const days = [];
  for (let i = COUNT_DAYS - 1; i >= 0; i--) days.push(new Date(now - i * 86400000).toISOString().slice(0, 10));
  const at = new Map(rows.map((r) => [r.day + ' ' + r.step, r.n]));
  const head = days.map((d) => `<th>${d.slice(5)}</th>`).join('');
  const lines = COUNT_LABELS.map(([step, label]) => {
    const cells = days.map((d) => at.get(d + ' ' + step) || 0);
    const total = cells.reduce((a, b) => a + b, 0);
    return `<tr><td class="l">${label}</td>${cells.map((n) => `<td>${n || ''}</td>`).join('')}<td><b>${total}</b></td></tr>`;
  }).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Squeekerant counts</title><style>body{font:15px/1.3 system-ui,sans-serif;margin:16px;color:#3a2340;background:#fff8e8}h1{font-size:20px;margin:0 0 4px}p{margin:0 0 12px}table{border-collapse:collapse}th,td{padding:3px 8px;text-align:right;border-bottom:1px solid #f0d6a3;white-space:nowrap}.l{text-align:left}div{overflow-x:auto}</style></head><body><h1>Squeekerant counts</h1><p>How many browsers reached each step, per day (UTC), for the last ${COUNT_DAYS} days. Numbers only, nothing about who. Anyone could push these up, so never pay anything on them.</p><div><table><tr><th class="l">Step</th>${head}<th>Total</th></tr>${lines}</table></div></body></html>`;
}

// wheel and send are only given by tests. The alerts' keys come from the same secret as the sessions.
function createApp({ store, secret, local = false, clock = Date.now, wheel = require('./wheel'), send = null }) {
  const pushKeys = push.keysFrom(Buffer.from(secret).toString('hex'));
  const wake = createWake({ store, wheel, clock, send: send || ((sub, message) => push.send(sub, message, pushKeys, { now: clock() })) });
  const sign = (kind, data) => {
    const body = b64(JSON.stringify(Object.assign({ k: kind }, data)));
    return body + '.' + crypto.createHmac('sha256', secret).update(body).digest('base64url');
  };
  const read = (kind, token) => {
    const [body, mac] = String(token || '').split('.');
    if (!body || !mac) return null;
    const want = Buffer.from(crypto.createHmac('sha256', secret).update(body).digest('base64url'));
    const got = Buffer.from(mac);
    if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
    let data;
    try {
      data = JSON.parse(Buffer.from(body, 'base64url').toString());
    } catch (e) {
      return null;
    }
    return data.k === kind && data.exp > clock() ? data : null;
  };
  const hostOf = (headers) => {
    const host = String(headers.host || '').toLowerCase();
    if (PUBLIC_HOSTS.includes(host) || (local && LOCAL_HOST.test(host))) return host;
    throw new Refusal(403, 'This site cannot sign in to Squeekerant.');
  };
  const needsBoard = () => {
    if (!store.open) throw new Refusal(503, 'The leaderboard is not open yet.');
  };
  // Where links on this site start, for whoever asks. Anywhere unknown gets the real site.
  const originOf = (headers) => {
    const host = String(headers.host || '').toLowerCase();
    if (PUBLIC_HOSTS.includes(host)) return 'https://' + host;
    if (local && LOCAL_HOST.test(host)) return 'http://' + host;
    return 'https://' + PUBLIC_HOSTS[0];
  };
  // A count per address for the current hour, only in memory. Nothing about it is kept anywhere.
  const limiter = (most) => {
    const tries = new Map();
    return (headers) => {
      const who = String(headers['x-real-ip'] || String(headers['x-forwarded-for'] || '').split(',')[0] || 'here').trim();
      const hour = Math.floor(clock() / HOUR_MS);
      if (tries.size > 5000) for (const [k, v] of tries) if (v.hour !== hour) tries.delete(k);
      const t = tries.get(who);
      if (!t || t.hour !== hour) {
        tries.set(who, { hour, n: 1 });
        return false;
      }
      t.n++;
      return t.n > most;
    };
  };
  const tooMany = limiter(PICTURES_PER_HOUR);
  const tooManyCounts = limiter(COUNTS_PER_HOUR);
  const tooManyAlertChanges = limiter(ALERT_CHANGES_PER_HOUR);
  const tooManyChecks = limiter(CHECKS_PER_HOUR);
  const pictures = () => require('./picture');
  const dreams = () => require('./dreams');
  const canKeepPictures = () => store.open && typeof store.savePicture === 'function';
  const canKeepAlerts = () => store.open && typeof store.addSub === 'function';

  // GET /dreams lists every dream, GET /dreams/<day>-<round> is one dream's page, and that with .png its picture.
  async function dreamRoute(id, png, headers) {
    const origin = originOf(headers);
    if (!id) return { status: 200, html: await dreams().listPage(await wake.list(), origin), cache: DREAMS_CACHE };
    const d = await wake.one(id);
    if (!d) {
      if (png) return { status: 404, json: { error: 'There is no such dream.' }, cache: NO_PICTURE_CACHE };
      return { status: 404, html: '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>No such dream</title><meta name="robots" content="noindex"></head><body style="font:20px/1.4 system-ui,sans-serif;margin:24px;background:#2a1f48;color:#fff8e8"><p>There is no dream at this address. <a style="color:#ffc857" href="/dreams">Every dream</a> &middot; <a style="color:#ffc857" href="/">Play Squeekerant</a></p></body></html>', cache: NO_PICTURE_CACHE };
    }
    if (png) return { status: 200, body: await dreams().picture(d), type: 'image/png', cache: PICTURE_CACHE };
    return { status: 200, html: dreams().dreamPage(d, origin), cache: DREAM_PAGE_CACHE };
  }

  // GET /p/<id> is the page a shared link opens, GET /p/<id>.png the picture on it.
  async function pictureRoute(id, png, headers) {
    let pic = null;
    try {
      if (canKeepPictures()) pic = await store.picture(id);
    } catch (e) {
      // Without the database the page still opens, with the game's own picture.
      if (png) throw e;
      console.error(`GET /p/${id}:`, e);
    }
    if (png) {
      if (!pic) return { status: 404, json: { error: 'There is no such picture.' }, cache: NO_PICTURE_CACHE };
      return { status: 200, body: await pictures().render(pic, id), type: 'image/png', cache: PICTURE_CACHE };
    }
    return { status: 200, html: pictures().page(pic, id, originOf(headers)), cache: pic ? PICTURE_PAGE_CACHE : NO_PICTURE_CACHE };
  }

  const routes = {
    // The wording follows Sign-In with Ethereum, so a wallet can warn if another site shows this message.
    'POST /api/wallet/ticket': async ({ body, headers }) => {
      needsBoard();
      const address = String((body && body.address) || '').toLowerCase();
      if (!/^0x[0-9a-f]{40}$/.test(address)) throw new Refusal(400, 'That is not a wallet address.');
      const host = hostOf(headers);
      const { getAddress } = await import('viem');
      const now = clock();
      const message = [
        `${host} wants you to sign in with your Ethereum account:`,
        getAddress(address),
        '',
        'Put my restaurant on the Squeekerant leaderboard. This costs nothing and sends no transaction.',
        '',
        `URI: ${LOCAL_HOST.test(host) ? 'http' : 'https'}://${host}`,
        'Version: 1',
        'Chain ID: 1',
        `Nonce: ${crypto.randomBytes(12).toString('hex')}`,
        `Issued At: ${new Date(now).toISOString()}`,
      ].join('\n');
      return { json: { message, ticket: sign('ticket', { a: address, m: message, exp: now + TICKET_MS }) } };
    },
    'POST /api/wallet/verify': async ({ body }) => {
      needsBoard();
      const ticket = read('ticket', body && body.ticket);
      if (!ticket) throw new Refusal(400, 'That took too long. Please try again.');
      const signature = String((body && body.signature) || '');
      if (!/^0x[0-9a-fA-F]{130}$/.test(signature)) throw new Refusal(400, 'The wallet did not give a proper signature.');
      const { recoverMessageAddress } = await import('viem');
      let who;
      try {
        who = await recoverMessageAddress({ message: ticket.m, signature });
      } catch (e) {
        throw new Refusal(400, 'The wallet did not give a proper signature.');
      }
      if (who.toLowerCase() !== ticket.a) throw new Refusal(400, 'That signature is from another wallet.');
      return { json: { wallet: who, token: sign('session', { a: who, exp: clock() + SESSION_MS }) } };
    },
    'POST /api/score': async ({ body, headers }) => {
      needsBoard();
      const session = read('session', String(headers.authorization || '').replace(/^Bearer /, ''));
      if (!session) throw new Refusal(401, 'Connect your wallet again.');
      const now = clock();
      const score = cleanScore(body, now);
      if (score.error) throw new Refusal(400, score.error);
      if (score.impossible) return { json: { accepted: false } };
      const place = await store.saveScore(session.a, score, now);
      return { json: Object.assign({ accepted: true }, place) };
    },
    // How far people get. Numbers only: no address, no name, nothing kept about the request.
    'POST /api/count': async ({ body, headers }) => {
      hostOf(headers);
      if (!store.open) return { json: { ok: false } };
      if (tooManyCounts(headers)) throw new Refusal(429, 'That is a lot of counts for one hour.');
      const steps = cleanSteps(body);
      if (steps.error) throw new Refusal(400, steps.error);
      if (steps.length) await store.addCounts(steps, clock());
      return { json: { ok: true } };
    },
    'GET /api/counts': async () => {
      if (!store.open) return { json: { open: false, rows: [] }, cache: CLOSED_CACHE };
      return { json: { open: true, rows: await store.counts(clock(), COUNT_DAYS) }, cache: COUNTS_CACHE };
    },
    'GET /api/stats': async () => {
      if (!store.open) return { html: countsPage([], clock()), cache: CLOSED_CACHE };
      return { html: countsPage(await store.counts(clock(), COUNT_DAYS), clock()), cache: COUNTS_CACHE };
    },
    'GET /api/board': async () => {
      if (!store.open) return { json: { open: false, rows: [], total: 0 }, cache: CLOSED_CACHE };
      const board = await store.board();
      return { json: Object.assign({ open: true }, board), cache: BOARD_CACHE };
    },
    // A picture to share gets its own link. Only the plain data comes in, and the server paints it itself.
    'POST /api/picture': async ({ body, headers }) => {
      hostOf(headers);
      if (!canKeepPictures()) return { json: { ok: false } };
      if (tooMany(headers)) throw new Refusal(429, 'That is a lot of pictures for one hour. Please try again later.');
      const pic = pictures().clean(body);
      if (!pic) throw new Refusal(400, 'That is not a picture of a restaurant.');
      const id = pictures().idOf(pic);
      const now = clock();
      if (!(await store.picture(id))) {
        if ((await store.picturesToday(now)) >= PICTURES_PER_DAY) return { json: { ok: false } };
        Object.assign(pic, pictures().boardLines(await store.board()));
        // Painted once now: it proves the picture paints, and has it ready for the first look at the link.
        await pictures().render(pic, id);
        await store.savePicture(id, pic, now);
      }
      return { json: { ok: true, id, url: `${originOf(headers)}/p/${id}` } };
    },
    // Wake up alerts. A browser gets the site's public key, then hands over where its push service takes messages for it.
    'GET /api/push/key': async () => ({ json: { key: pushKeys.publicText }, cache: KEY_CACHE }),
    'POST /api/push/subscribe': async ({ body, headers }) => {
      hostOf(headers);
      if (!canKeepAlerts()) return { json: { ok: false } };
      if (tooManyAlertChanges(headers)) throw new Refusal(429, 'That is a lot of changes for one hour.');
      const sub = push.cleanSubscription(body);
      if (!sub) throw new Refusal(400, 'That is not a push subscription this site can use.');
      return { json: { ok: await store.addSub(sub, clock()) } };
    },
    'POST /api/push/unsubscribe': async ({ body, headers }) => {
      hostOf(headers);
      if (!canKeepAlerts()) return { json: { ok: false } };
      if (tooManyAlertChanges(headers)) throw new Refusal(429, 'That is a lot of changes for one hour.');
      const endpoint = push.cleanEndpoint(body && body.endpoint);
      if (!endpoint) throw new Refusal(400, 'That is not a push subscription this site can use.');
      await store.dropSub(endpoint);
      return { json: { ok: true } };
    },
    // A look at the wheel for a new dream. The schedule in vercel.json asks every 15 minutes, and so may anyone:
    // the answer is the same whoever asks, and an alert only ever goes out once.
    'POST /api/wake/check': async ({ headers }) => {
      if (tooManyChecks(headers)) throw new Refusal(429, 'That is a lot of looks for one hour.');
      return { json: await wake.check() };
    },
  };

  // Takes a plain request and gives back a status, a body and how long it may be cached.
  return async function handle({ method, path, headers, body }) {
    const looking = method === 'GET' || method === 'HEAD';
    const shared = looking && PICTURE_PATH.exec(path);
    const dream = looking && !shared && DREAM_PATH.exec(path);
    const route = shared ? () => pictureRoute(shared[1], !!shared[2], headers || {}) : dream ? () => dreamRoute(dream[1], !!dream[2], headers || {}) : routes[`${method} ${path}`];
    if (!route) return { status: 404, json: { error: 'Not found.' } };
    try {
      const out = await route({ headers: headers || {}, body });
      return { status: out.status || 200, json: out.json, html: out.html, body: out.body, type: out.type, cache: out.cache || 'no-store' };
    } catch (e) {
      if (e instanceof Refusal) return { status: e.status, json: { error: e.message }, cache: 'no-store' };
      console.error(`${method} ${path}:`, e);
      return { status: 503, json: { error: 'The leaderboard cannot be reached right now.' }, cache: 'no-store' };
    }
  };
}

module.exports = { createApp, PUBLIC_HOSTS, PICTURES_PER_HOUR, PICTURES_PER_DAY, COUNTS_PER_HOUR };
