// The leaderboard's server and the game's side of it. Run with: npm test
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { privateKeyToAccount } = require('viem/accounts');
const { createApp } = require('../server/app');
const { memoryStore, closedStore, sqlStore } = require('../server/store');
const rules = require('../server/rules');

const src = path.join(__dirname, '..', 'src');
for (const f of ['core/rng.js', 'art/px.js', 'art/scene.js', 'data/recording.js', 'data/animals.js', 'data/food.js', 'data/outside.js', 'data/decor.js', 'core/feed.js', 'core/engine.js', 'core/wallet.js', 'core/counter.js', 'core/savecode.js']) require(path.join(src, f));
const WW = globalThis.WW;
const E = WW.Engine;

const ALICE = privateKeyToAccount('0x' + '11'.repeat(32));
const BOB = privateKeyToAccount('0x' + '22'.repeat(32));
const HOST = { host: 'www.squeekerant.online' };
const AT = Date.parse('2026-12-01T00:00:00Z');

function setup(opts = {}) {
  const clock = { now: AT };
  const store = opts.store || memoryStore();
  const handle = createApp({ store, secret: Buffer.from('test secret'), local: !!opts.local, clock: () => clock.now });
  const call = (method, p, body, headers) => handle({ method, path: p, body, headers: Object.assign({}, HOST, headers) });
  const signIn = async (account, signer = account) => {
    const t = await call('POST', '/api/wallet/ticket', { address: account.address });
    assert.equal(t.status, 200, JSON.stringify(t.json));
    const signature = await signer.signMessage({ message: t.json.message });
    return call('POST', '/api/wallet/verify', { ticket: t.json.ticket, signature });
  };
  const score = (token, body) => call('POST', '/api/score', body, { authorization: 'Bearer ' + token });
  return { clock, store, call, signIn, score };
}
const play = (over) => Object.assign({ shop: 'The Tiny Table', chef: 'Bean', fur: 'golden', hat: 'toque', level: 5, xp: 10, house: 2 }, over);

test('the server counts levels the same way the game does', () => {
  for (let level = 1; level <= rules.MAX_LEVEL; level++) assert.equal(rules.xpNeed(level), E.xpNeed(level), `level ${level}`);
  assert.equal(rules.MAX_HOUSE, E.roomLevel({ cols: 1, rows: 1 }).top, 'the top house level');
});

test('a wallet signs in by signing a message, and only its own owner can', async () => {
  const { call, signIn } = setup();
  const t = await call('POST', '/api/wallet/ticket', { address: ALICE.address.toLowerCase() });
  const lines = t.json.message.split('\n');
  assert.equal(lines[0], 'www.squeekerant.online wants you to sign in with your Ethereum account:');
  assert.equal(lines[1], ALICE.address, 'the wallet sees the address spelled with its checksum');
  assert.ok(t.json.message.includes('URI: https://www.squeekerant.online'));
  assert.ok(t.json.message.includes('This costs nothing and sends no transaction.'));

  const ok = await signIn(ALICE);
  assert.equal(ok.status, 200);
  assert.equal(ok.json.wallet, ALICE.address);
  const wrong = await signIn(ALICE, BOB);
  assert.equal(wrong.status, 400);
  assert.match(wrong.json.error, /another wallet/);
  const junk = await call('POST', '/api/wallet/verify', { ticket: t.json.ticket, signature: '0x1234' });
  assert.equal(junk.status, 400);
  const garbled = await call('POST', '/api/wallet/verify', { ticket: t.json.ticket, signature: '0x' + 'ab'.repeat(65) });
  assert.equal(garbled.status, 400);
  assert.equal((await call('POST', '/api/wallet/ticket', { address: 'nope' })).status, 400);
});

test('tickets and sessions cannot be forged, swapped or kept for ever', async () => {
  const { clock, call, signIn, score } = setup();
  const t = await call('POST', '/api/wallet/ticket', { address: ALICE.address });
  const signature = await ALICE.signMessage({ message: t.json.message });
  const [body, mac] = t.json.ticket.split('.');
  const faked = Buffer.from(JSON.stringify(Object.assign(JSON.parse(Buffer.from(body, 'base64url')), { a: BOB.address.toLowerCase() }))).toString('base64url');
  assert.equal((await call('POST', '/api/wallet/verify', { ticket: faked + '.' + mac, signature })).status, 400, 'an edited ticket');
  assert.equal((await score(t.json.ticket, play())).status, 401, 'a ticket is not a session');

  const session = (await signIn(ALICE)).json.token;
  assert.equal((await call('POST', '/api/wallet/verify', { ticket: session, signature })).status, 400, 'a session is not a ticket');
  assert.equal((await score(session + 'x', play())).status, 401);
  assert.equal((await score('', play())).status, 401);
  assert.equal((await score(session, play())).json.accepted, true);

  clock.now += 6 * 60000;
  assert.equal((await call('POST', '/api/wallet/verify', { ticket: t.json.ticket, signature })).status, 400, 'a ticket lasts minutes');
  clock.now += 61 * 86400000;
  assert.equal((await score(session, play())).status, 401, 'a session lasts weeks');
});

test('signing in only works from the real site', async () => {
  const live = setup();
  for (const host of ['www.squeekerant.online', 'squeekerant.online', 'squeekerant.vercel.app']) {
    assert.equal((await live.call('POST', '/api/wallet/ticket', { address: ALICE.address }, { host })).status, 200, host);
  }
  for (const host of ['evil.example', 'squeekerant-fake.vercel.app', 'localhost:3000', '']) {
    assert.equal((await live.call('POST', '/api/wallet/ticket', { address: ALICE.address }, { host })).status, 403, host);
  }
  const here = setup({ local: true });
  const t = await here.call('POST', '/api/wallet/ticket', { address: ALICE.address }, { host: 'localhost:3000' });
  assert.ok(t.json.message.includes('URI: http://localhost:3000'), 'on this computer it works, for trying things');
});

test('only numbers that can exist are taken', async () => {
  const { signIn, score, call } = setup();
  const token = (await signIn(ALICE)).json.token;
  for (const bad of [{ level: 0 }, { level: 1.5 }, { level: '9' }, { level: 201 }, { xp: -1 }, { xp: 1e9 }, { xp: 0.5 }, { house: 0 }, { house: 15 }, { level: null }]) {
    assert.equal((await score(token, play(bad))).status, 400, JSON.stringify(bad));
  }
  assert.equal((await score(token, null)).status, 400);
  // Far above anything real: no row, and nothing to tell a cheat which number would have passed.
  const high = await score(token, play({ level: 150, xp: 0 }));
  assert.deepEqual(high.json, { accepted: false });
  assert.equal((await call('GET', '/api/board')).json.total, 0);
});

test('the ceiling stays above the best bot and below an edited save', () => {
  // From tests/sim.js with 24 visits a day and busy: level by day.
  const bot = [[0, 6], [1, 9], [7, 15], [14, 21], [29, 28], [44, 34], [84, 46]];
  for (const [day, level] of bot) {
    const at = Date.parse('2026-11-04T00:00:00Z') + day * 86400000;
    assert.ok(rules.totalXp(level + 1, 0) * 1.3 < rules.xpCeiling(at), `day ${day} level ${level}`);
  }
  assert.ok(rules.totalXp(40, 0) > rules.xpCeiling(Date.parse('2026-11-04T00:00:00Z') + 7 * 86400000), 'level 40 in the first week');
});

test('names on the public board are cleaned', () => {
  const clean = (v) => rules.cleanName(v, 'FALLBACK', 22);
  assert.equal(clean('Quán Ăn Nhỏ'), 'Quán Ăn Nhỏ');
  assert.equal(clean('  two   spaces  '), 'two spaces');
  assert.equal(clean('<img src=x>'), 'img src=x');
  assert.equal(clean(['a', 'b', 'c', 'd'].join(String.fromCodePoint(0x202e)).replace(/c/, String.fromCodePoint(0x200b) + 'c' + String.fromCodePoint(7))), 'abcd', 'text that flips or hides');
  assert.equal(clean(''), 'FALLBACK');
  assert.equal(clean(null), 'FALLBACK');
  assert.equal(clean({}), '[object Object]');
  assert.equal(Array.from(clean('x'.repeat(50))).length, 22);
  for (const link of ['free-mint.com', 'https://a', 'www.scam', 't.me/group', 'discord gg', '@someone', 'x.xyz now']) assert.equal(clean(link), 'FALLBACK', link);
  const s = rules.cleanScore(play({ fur: '<b>', hat: 'x'.repeat(30) }), AT);
  assert.deepEqual([s.fur, s.hat], ['golden', 'toque'], 'a look that is not a plain key is dropped');
});

test('a wallet keeps its best restaurant, and the board orders by level then progress', async () => {
  const { clock, signIn, score, call, store } = setup();
  const a = (await signIn(ALICE)).json.token;
  const b = (await signIn(BOB)).json.token;
  const first = await score(a, play({ level: 8, xp: 100, shop: 'Alice One' }));
  assert.deepEqual([first.json.rank, first.json.total, first.json.row.level], [1, 1, 8]);
  clock.now += 60000;
  const second = await score(b, play({ level: 8, xp: 100, shop: 'Bob One' }));
  assert.deepEqual([second.json.rank, second.json.total], [2, 2], 'level with Alice, who got there first');
  clock.now += 60000;
  assert.equal((await score(b, play({ level: 8, xp: 101, shop: 'Bob One' }))).json.rank, 1, 'a little further');

  // Alice starts again. Her best stays on the board, under its old name.
  const restart = await score(a, play({ level: 2, xp: 0, shop: 'Alice Two', house: 1 }));
  assert.equal(restart.json.row.level, 8);
  assert.equal(restart.json.row.shop, 'Alice One');
  assert.equal(restart.json.rank, 2);
  const again = await score(a, play({ level: 9, xp: 0, shop: 'Alice Two' }));
  assert.equal(again.json.row.shop, 'Alice Two');
  assert.equal(again.json.rank, 1);

  const board = await call('GET', '/api/board');
  assert.deepEqual(board.json.rows.map((r) => r.wallet), [ALICE.address, BOB.address]);
  assert.equal(board.json.open, true);
  assert.match(board.cache, /s-maxage/, 'the board is cached so the database can rest');
  assert.equal((await score(a, play({ level: 9, xp: 1 }))).cache, 'no-store');

  // Someone taken off the board by hand keeps playing but is not listed.
  store.players.get(BOB.address).hidden = true;
  const list = await call('GET', '/api/board');
  assert.deepEqual([list.json.rows.length, list.json.total], [1, 1]);
  assert.equal((await score(b, play({ level: 20, xp: 0 }))).json.rank, null);
});

test('until a database is connected the board is simply closed', async () => {
  const { call } = setup({ store: closedStore });
  const board = await call('GET', '/api/board');
  assert.deepEqual([board.status, board.json.open, board.json.rows], [200, false, []]);
  assert.equal((await call('POST', '/api/wallet/ticket', { address: ALICE.address })).status, 503);
  assert.equal((await call('POST', '/api/wallet/verify', {})).status, 503);
  assert.equal((await call('POST', '/api/score', {})).status, 503);
  assert.equal((await call('GET', '/api/nothing')).status, 404);
});

test('a database that fails says so and sends no secrets', async () => {
  const realError = console.error;
  console.error = () => {};
  try {
    const { call } = setup({ store: sqlStore(async () => { throw new Error('password=hunter2 refused'); }) });
    const res = await call('GET', '/api/board');
    assert.equal(res.status, 503);
    assert.ok(!JSON.stringify(res.json).includes('hunter2'));
    assert.equal(res.cache, 'no-store');
  } finally {
    console.error = realError;
  }
});

test('only the steps on the list are counted, each once a request', async () => {
  const { call, clock } = setup();
  const send = (steps, headers) => call('POST', '/api/count', { steps }, headers);
  assert.deepEqual((await send(['first_visit', 'opened', 'first_visit', 'made_up', 7, null, '<b>'])).json, { ok: true });
  const read = async () => (await call('GET', '/api/counts')).json.rows.map((r) => [r.day, r.step, r.n]);
  assert.deepEqual(await read(), [['2026-12-01', 'first_visit', 1], ['2026-12-01', 'opened', 1]]);
  await send(['first_visit']);
  await send(['made_up']);
  assert.deepEqual(await read(), [['2026-12-01', 'first_visit', 2], ['2026-12-01', 'opened', 1]]);
  clock.now += 86400000;
  await send(['opened']);
  assert.deepEqual((await read()).pop(), ['2026-12-02', 'opened', 1], 'a new day starts its own count');
  for (const bad of [null, {}, { steps: 'opened' }, { steps: new Array(61).fill('opened') }]) assert.equal((await call('POST', '/api/count', bad)).status, 400, JSON.stringify(bad));
  assert.equal((await send(['opened'], { host: 'evil.example' })).status, 403, 'only from the real site');
  assert.match((await call('GET', '/api/counts')).cache, /s-maxage/, 'reading rarely reaches the database');
  assert.equal((await send(['opened'])).cache, 'no-store');
});

test('one address can only send so many counts an hour, so a flood cannot keep the database awake', async () => {
  const { call, clock } = setup();
  const most = require('../server/app').COUNTS_PER_HOUR;
  const send = (ip) => call('POST', '/api/count', { steps: ['active'] }, { 'x-real-ip': ip });
  for (let i = 0; i < most; i++) assert.equal((await send('198.51.100.20')).status, 200);
  assert.equal((await send('198.51.100.20')).status, 429);
  assert.equal((await send('198.51.100.21')).status, 200, 'someone else still counts');
  clock.now += 3600000;
  assert.equal((await send('198.51.100.20')).status, 200, 'and the next hour starts again');
});

test('the counts keep nothing about who sent them', async () => {
  const seen = [];
  const store = sqlStore(async (text, params) => {
    seen.push([text, params]);
    return [];
  });
  const { call } = setup({ store });
  await call('POST', '/api/count', { steps: ['opened', 'active'] }, { 'x-forwarded-for': '203.0.113.9', 'user-agent': 'Someone', authorization: 'Bearer abc' });
  const last = seen.pop();
  assert.match(last[0], /INSERT INTO counts/);
  assert.deepEqual(last[1], ['2026-12-01', '["opened","active"]'], 'a day and the steps, nothing else');
  assert.ok(!JSON.stringify(seen).includes('203.0.113.9'));
});

test('the counts page shows every step on the list and escapes nothing it did not write', async () => {
  const { call } = setup();
  await call('POST', '/api/count', { steps: ['opened', 'lesson_wheel'] });
  const page = await call('GET', '/api/stats');
  assert.equal(page.status, 200);
  assert.match(page.html, /noindex/);
  for (const [, label] of rules.COUNT_LABELS) assert.ok(page.html.includes(label), label);
  assert.match(page.html, /Opened a real restaurant<\/td>(<td>[^<]*<\/td>)*<td><b>1<\/b>/);
  const closed = setup({ store: closedStore });
  assert.equal((await closed.call('POST', '/api/count', { steps: ['opened'] })).json.ok, false, 'no database, no count, no error');
  assert.deepEqual((await closed.call('GET', '/api/counts')).json, { open: false, rows: [] });
  assert.equal((await closed.call('GET', '/api/stats')).status, 200);
});

// Shared pictures. The server paints them with the game's own painters, loaded into a world of their own.
const pictures = require('../server/picture');
function snapshot(over = {}) {
  const PW = pictures.world();
  const PE = PW.Engine;
  const feed = { mode: 'live', settled: () => 100, round: () => ({ cum: 0, hash: 'h', work: 0 }), live: () => ({ cum: 0, state: 'running', rpm: 80 }), hashBefore: () => 'h' };
  const s = PE.newGame(0, feed, { shop: 'Bean Burrow', name: 'Mochi' });
  s.level = 9;
  s.stats.served = 1234;
  for (const a of PW.ANIMALS.slice(0, 40)) s.book[a.id] = 2;
  s.dreamDish = { key: 'd:3:g', round: 1, gold: true, sleptRounds: 95 };
  const seat = PE.seatsOf(s)[0];
  const scene = {
    nightAmt: 0,
    guests: [{ sp: PW.ANIMALS[3], x: seat.x * 16 + 8, y: 117 + seat.y * 16, dir: seat.face, state: 'eat', seat, plate: 'carrot_coins', speed: 20, zone: 'in' }],
    chefs: new Map([['head', { id: 'head', x: 70, y: 78, state: 'stir' }]]),
    waiters: new Map([['starter_waiter', { id: 'starter_waiter', x: 60, y: 120, state: 'idle', path: [] }]]),
    cleaners: new Map(),
    robots: [],
    dirt: [],
  };
  const game = { s, scene, feed, live: { state: 'running', rpm: 80 }, visit: null, sky: () => ({ season: 'spring', weather: 'clear' }), now: () => 0, topRanks: () => [], ranksNote: () => ['NOBODY YET'] };
  return Object.assign(JSON.parse(JSON.stringify(PW.pictureOf(game))), over);
}
const pngSize = (buf) => [buf.readUInt32BE(16), buf.readUInt32BE(20)];

test('a shared picture gets its own link, and the server paints it from plain data', async () => {
  const { call } = setup();
  const raw = snapshot();
  const made = await call('POST', '/api/picture', raw);
  assert.equal(made.status, 200, JSON.stringify(made.json));
  assert.equal(made.json.ok, true);
  assert.match(made.json.url, /^https:\/\/www\.squeekerant\.online\/p\/[A-Za-z0-9_-]{12}$/);
  assert.equal((await call('POST', '/api/picture', raw)).json.id, made.json.id, 'the same picture keeps its link');
  const page = await call('GET', '/p/' + made.json.id);
  assert.equal(page.status, 200);
  assert.ok(page.html.includes(`<meta property="og:image" content="https://www.squeekerant.online/p/${made.json.id}.png">`));
  assert.ok(page.html.includes('<meta name="twitter:card" content="summary_large_image">'));
  assert.ok(page.html.includes('Bean Burrow, a tiny restaurant run by a real hamster'));
  assert.ok(page.html.includes('<a href="/">Play Squeekerant</a>'));
  const png = await call('GET', `/p/${made.json.id}.png`);
  assert.equal(png.status, 200);
  assert.equal(png.type, 'image/png');
  assert.match(png.cache, /immutable/, 'the picture for an address never changes');
  assert.deepEqual(pngSize(png.body), [1200, 630]);
  // An address with no picture behind it still opens, with the game's own picture, and is only briefly kept.
  const none = await call('GET', '/p/AAAAAAAAAAAA');
  assert.equal(none.status, 200);
  assert.ok(none.html.includes('content="https://www.squeekerant.online/og.png"'));
  assert.doesNotMatch(none.cache, /immutable|86400/);
  assert.equal((await call('GET', '/p/AAAAAAAAAAAA.png')).status, 404);
  assert.equal((await call('GET', '/p/short')).status, 404);
  // Without a database there is no link, and the game posts the site's own.
  const closed = setup({ store: closedStore });
  assert.equal((await closed.call('POST', '/api/picture', raw)).json.ok, false);
  assert.equal((await closed.call('GET', '/p/' + made.json.id)).status, 200);
  assert.equal((await call('POST', '/api/picture', raw, { host: 'evil.example' })).status, 403, 'only from the real site');
});

test('only the game\'s own pieces get into a picture, and the names follow the board\'s rules', async () => {
  const raw = snapshot();
  for (const bad of [null, 'x', {}, { v: 2 }, snapshot({ room: [99, 99] }), snapshot({ level: 0 }), snapshot({ level: 1.5 }), snapshot({ served: -1 }), snapshot({ seed: 'x' }), snapshot({ chef: 'Mochi' })]) assert.equal(pictures.clean(bad), null, JSON.stringify(bad && bad.room));
  const odd = snapshot({ shop: 'visit scam.xyz now', stars: 99, parade: ['dragon', raw.parade[0], raw.parade[0]], dream: 'd:999', season: 'monsoon', live: 'on fire' });
  odd.chef = ['@mochi', 'neon', 'crown of thorns'];
  odd.furniture.push(['nope', 1, 1], ['cork', 99, 1], ['__proto__', 1, 1], ['stepping_stones', 1, 1], 'cork');
  odd.yard.push(['cork', 30, 10], ['stepping_stones', 30, 10]);
  odd.guests.push(['dragon', 10, 10, 1, 'eat', null, null, 20], [raw.parade[0], 1e9, 10, 1, 'eat', null, null, 20], [raw.parade[0], 10, 10, 1, '<b>', null, null, 20]);
  odd.stock.push(['made_up_dish', 3], ['carrot_coins', -1]);
  odd.ranks = [[1, 'SOMEONE', 30]];
  odd.note = ['GIVEAWAY AT SCAM'];
  const p = pictures.clean(odd);
  assert.equal(p.shop, 'A Tiny Table', 'a link in a name is not shown');
  assert.equal(p.chef[0], 'Bean');
  assert.deepEqual(p.chef.slice(1), ['golden', 'toque']);
  assert.equal(p.stars, 0);
  assert.deepEqual(p.parade, [raw.parade[0]]);
  assert.equal(p.dream, null);
  assert.equal(p.season, 'spring');
  assert.equal(p.live, 'quiet');
  assert.equal(p.furniture.length, raw.furniture.length, 'only real pieces, inside the room');
  assert.deepEqual(p.yard, [['stepping_stones', 30, 10]], 'only yard pieces in the yard');
  assert.equal(p.guests.length, raw.guests.length);
  assert.equal(p.stock.length, raw.stock.length);
  assert.deepEqual([p.ranks, p.note], [[], []], 'the board on a picture is never the sender\'s');
  // A kept picture is checked again before it is painted.
  await assert.rejects(pictures.render(Object.assign({}, p, { room: [1, 1] }), 'BBBBBBBBBBBB'));
});

// The letters a font has, from its own cmap table (format 4, which all three use).
function fontLetters(file) {
  const buf = require('fs').readFileSync(file);
  let at = 0;
  for (let i = 0; i < buf.readUInt16BE(4); i++) if (buf.toString('ascii', 12 + i * 16, 16 + i * 16) === 'cmap') at = buf.readUInt32BE(20 + i * 16);
  for (let i = 0; i < buf.readUInt16BE(at + 2); i++) {
    const t = at + buf.readUInt32BE(at + 8 + i * 8);
    if (buf.readUInt16BE(at + 4 + i * 8) !== 3 || buf.readUInt16BE(at + 6 + i * 8) !== 1 || buf.readUInt16BE(t) !== 4) continue;
    const seg2 = buf.readUInt16BE(t + 6);
    const ends = t + 14;
    const starts = ends + seg2 + 2;
    const deltas = starts + seg2;
    const offsets = deltas + seg2;
    const out = new Set();
    for (let s = 0; s < seg2 / 2; s++) {
      const end = buf.readUInt16BE(ends + s * 2);
      const start = buf.readUInt16BE(starts + s * 2);
      const delta = buf.readInt16BE(deltas + s * 2);
      const ro = buf.readUInt16BE(offsets + s * 2);
      for (let c = start; c <= end && c !== 0xffff; c++) {
        let g = ro ? buf.readUInt16BE(offsets + s * 2 + ro + (c - start) * 2) : c;
        if (g) g = (g + delta) & 0xffff;
        if (g) out.add(c);
      }
    }
    return out;
  }
  throw new Error('no format 4 table in ' + file);
}

test('a picture only has letters its fonts can draw, the same on both sides, and the post keeps the real name', () => {
  const PW = pictures.world();
  const letters = new Set();
  for (const [file] of pictures.FONT_FILES) for (const c of fontLetters(path.join(src, 'fonts', file))) if (c >= 32) letters.add(c);
  for (let c = 32; c <= 0xffff; c++) {
    if (c >= 0xd800 && c <= 0xdfff) continue;
    assert.equal(PW.pictureLetter(String.fromCodePoint(c)), letters.has(c), `U+${c.toString(16)}`);
  }
  assert.equal(PW.pictureLetter('🍜'), false);
  const p = pictures.clean(snapshot({ shop: '🍜 Mì Ơi 麺屋 ', chef: ['Ừm 🐹', 'golden', 'toque'] }));
  assert.equal(p.shop, 'Mì Ơi');
  assert.equal(p.chef[0], 'Ừm');
  assert.equal(pictures.clean(snapshot({ shop: '麺屋 🍜' })).shop, 'The Tiny Table', 'nothing drawable left, so the usual name');
  assert.match(PW.pictureWords(p, '🍜 Mì Ơi 麺屋'), /^My tiny restaurant 🍜 Mì Ơi 麺屋 is level 9\./);
});

test('a picture shows the real board, and pictures have limits', async () => {
  const { call, signIn, score, store } = setup();
  const s = await signIn(ALICE);
  await score(s.json.token, play({ shop: 'Café Ñandú', level: 12 }));
  const made = await call('POST', '/api/picture', snapshot());
  const kept = await store.picture(made.json.id);
  assert.deepEqual(kept.ranks, [[1, 'CAFE NANDU', 12]], 'plain capitals for the sign outside');
  assert.deepEqual(kept.note, []);
  // One address may make so many an hour. Another address may still make its own.
  const from = (ip, seed) => call('POST', '/api/picture', snapshot({ seed }), { 'x-real-ip': ip });
  for (let i = 1; i <= require('../server/app').PICTURES_PER_HOUR; i++) assert.equal((await from('198.51.100.7', i)).status, 200);
  assert.equal((await from('198.51.100.7', 999)).status, 429);
  assert.equal((await from('198.51.100.8', 999)).status, 200);
  // And there is a ceiling for the whole day.
  const full = setup();
  full.store.picturesToday = async () => require('../server/app').PICTURES_PER_DAY;
  assert.equal((await full.call('POST', '/api/picture', snapshot())).json.ok, false);
});

test('the pictures keep nothing about who made them', async () => {
  const seen = [];
  const store = sqlStore(async (text, params) => {
    seen.push([text, params]);
    if (/SELECT pic FROM pictures/.test(text)) return [];
    if (/count\(\*\) AS n FROM pictures/.test(text)) return [{ n: 0 }];
    if (/FROM players/.test(text) && /count\(\*\)/.test(text)) return [{ everyone: 0 }];
    return [];
  });
  const { call } = setup({ store });
  const made = await call('POST', '/api/picture', snapshot(), { 'x-forwarded-for': '203.0.113.9', 'x-real-ip': '203.0.113.9', 'user-agent': 'Someone' });
  assert.equal(made.json.ok, true, JSON.stringify(made.json));
  const insert = seen.find(([text]) => /INSERT INTO pictures/.test(text));
  assert.deepEqual(insert[1].slice(0, 2), [made.json.id, '2026-12-01T00:00:00.000Z']);
  assert.ok(!JSON.stringify(seen).includes('203.0.113.9'));
  assert.ok(!JSON.stringify(seen).includes('Someone'));
});

test('the picture server reads the game in the build\'s own order, with the page\'s own fonts', () => {
  const fs = require('fs');
  const build = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'build.js'), 'utf8');
  const order = Array.from(build.match(/const ORDER = \[(.+)\];/)[1].matchAll(/'([^']+\.js)'/g), (m) => m[1]);
  let at = -1;
  for (const file of pictures.FILES) {
    const i = order.indexOf(file);
    assert.ok(i > at, `${file} comes after the one before it in the build`);
    at = i;
  }
  const css = fs.readFileSync(path.join(src, 'ui/style.css'), 'utf8');
  for (const [name, key] of [['--logo', 'head'], ['--display', 'display'], ['--body', 'body']]) assert.equal(css.match(new RegExp(`${name}: ([^;]+);`))[1], pictures.FONTS[key], name);
  for (const [file, family] of pictures.FONT_FILES) {
    assert.ok(fs.existsSync(path.join(src, 'fonts', file)), file);
    assert.ok(pictures.FONTS.head.includes(family) || pictures.FONTS.display.includes(family) || pictures.FONTS.body.includes(family), family);
  }
  for (const licence of ['OFL-Jersey20.txt', 'OFL-PixelifySans.txt', 'OFL-VT323.txt']) assert.match(fs.readFileSync(path.join(src, 'fonts', licence), 'utf8'), /SIL Open Font License/);
});

test('the lesson on the list is the lesson in the game', () => {
  const text = require('fs').readFileSync(path.join(src, 'ui/practice.js'), 'utf8');
  const ids = Array.from(text.matchAll(/\bid: '([A-Za-z]+)'/g), (m) => m[1]);
  assert.deepEqual(ids, rules.LESSON_STEPS);
});

// The game's side.

test('the game counts each step once, sends them together, and never from a test browser', () => {
  const storage = new Map();
  const realStorage = globalThis.localStorage;
  const realFetch = globalThis.fetch;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k) => (storage.has(k) ? storage.get(k) : null), setItem: (k, v) => storage.set(k, v), removeItem: (k) => storage.delete(k) } });
  const sent = [];
  globalThis.fetch = async (url, opt) => {
    sent.push([url, JSON.parse(opt.body).steps]);
    return { ok: true };
  };
  try {
    const c = new WW.Counter();
    c.usable = true;
    c.once('opened');
    c.once('opened');
    c.daily('active', '2026-12-01');
    c.daily('active', '2026-12-01');
    assert.equal(sent.length, 0, 'waits to send them together');
    c.flush();
    assert.deepEqual(sent.pop(), ['/api/count', ['opened', 'active']]);
    c.flush();
    assert.equal(sent.length, 0, 'nothing new to send');
    // Coming back: what this browser has counted is remembered, and each day counts once.
    const again = new WW.Counter();
    again.usable = true;
    again.once('opened');
    again.daily('active', '2026-12-01');
    again.flush();
    assert.equal(sent.length, 0);
    again.daily('active', '2026-12-02');
    again.flush();
    assert.deepEqual(sent.pop(), ['/api/count', ['active']]);
    assert.ok(!storage.get('squeekerant-counted').includes('2026-12-01'), 'old days are not kept');
    const off = new WW.Counter();
    off.usable = false;
    off.once('first_guest');
    off.flush();
    assert.equal(sent.length, 0, 'switched off where it cannot be sent');
    for (const step of ['first_visit', 'connect_pressed', 'wallet_connected', 'play_pressed', 'lesson_declined', 'lesson_started', 'lesson_left', 'lesson_finished', 'opened', 'first_guest', 'first_dream', 'active', 'back_1', 'back_30', 'share_open', 'share_post', 'share_copy', 'share_save']) assert.deepEqual(rules.cleanSteps({ steps: [step] }), [step], step);
  } finally {
    globalThis.fetch = realFetch;
    if (realStorage === undefined) delete globalThis.localStorage;
    else Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: realStorage });
  }
});

const fresh = () => new WW.Wallet();
const rowsOf = (...list) => list.map(([wallet, total, shop]) => ({ wallet, total, shop: shop || wallet, chef: 'x', fur: 'golden', hat: 'toque', level: 5, house: 1 }));

test('the game shows only what the server listed, with no local names', () => {
  const w = fresh();
  assert.deepEqual(w.rows(), []);
  assert.equal(w.standing(), null);
  w.board = { open: true, rows: rowsOf(['0xa', 30], ['0xb', 20]), total: 2 };
  assert.deepEqual(w.rows().map((r) => [r.wallet, r.place, r.me]), [['0xa', 1, false], ['0xb', 2, false]]);
  assert.equal(w.standing(), null, 'not connected');
});

test('your own latest score shows at once, even before the cached board catches up', () => {
  const w = fresh();
  w.address = '0xB';
  w.token = 't';
  w.board = { open: true, rows: rowsOf(['0xa', 30], ['0xb', 20], ['0xc', 10]), total: 3 };
  assert.deepEqual(w.standing(), { place: 2, total: 3 });
  w.mine = { shop: 'Mine', chef: 'x', fur: 'golden', hat: 'toque', level: 9, house: 1, total: 40, rank: 1, everyone: 3 };
  const rows = w.rows();
  assert.deepEqual(rows.map((r) => [r.place, r.me]), [[1, true], [2, false], [3, false]]);
  assert.equal(rows[0].shop, 'Mine');
  assert.equal(rows.length, 3, 'no second line for the same wallet');
  w.mine = Object.assign({}, w.mine, { total: 1, rank: 5000, everyone: 6000 });
  assert.deepEqual(w.standing(), { place: 5000, total: 6000 }, 'far down the board, the place comes from the server');
});

test('a restaurant taken off the board does not see itself on it', () => {
  const w = fresh();
  w.address = '0xB';
  w.token = 't';
  w.board = { open: true, rows: rowsOf(['0xa', 30]), total: 1 };
  w.mine = { shop: 'Mine', chef: 'x', fur: 'golden', hat: 'toque', level: 9, house: 1, total: 40, rank: null, everyone: 1 };
  assert.deepEqual(w.rows().map((r) => r.wallet), ['0xa']);
  assert.equal(w.standing(), null);
});

test('scores go out soon after a level and rarely otherwise, and only from the real wheel', async () => {
  const w = fresh();
  const s = E.newGame(0, { mode: 'recording', settled: () => 1, round: () => ({ r: 1, cum: 0 }), hashBefore: () => 'h', live: () => ({ cum: 0 }) });
  const sent = [];
  w.send = async (score, key) => {
    sent.push(score);
    w.sent = { key, level: score.level };
    w.sentAt = Date.now();
  };
  w.tick(s, E, true);
  assert.equal(sent.length, 0, 'not connected');
  w.address = '0xa';
  w.token = 't';
  w.tick(s, E, false);
  assert.equal(sent.length, 0, 'the recording never goes on the board');
  w.tick(s, E, true);
  assert.equal(sent.length, 1, 'at once when connected');
  assert.deepEqual(Object.keys(sent[0]).sort(), ['chef', 'fur', 'hat', 'house', 'level', 'shop', 'xp']);
  w.tick(s, E, true);
  assert.equal(sent.length, 1, 'nothing new');
  s.xp += 1;
  w.tick(s, E, true);
  assert.equal(sent.length, 1, 'a little progress waits');
  w.sentAt = Date.now() - 11 * 60000;
  w.tick(s, E, true);
  assert.equal(sent.length, 2, 'and goes after ten minutes');
  s.level += 1;
  w.tick(s, E, true);
  assert.equal(sent.length, 2, 'a new level waits a minute');
  w.sentAt = Date.now() - 61000;
  w.tick(s, E, true);
  assert.equal(sent.length, 3);
});

test('the score the game sends is one the server takes', () => {
  const s = E.newGame(0, { mode: 'recording', settled: () => 1, round: () => ({ r: 1, cum: 0 }), hashBefore: () => 'h', live: () => ({ cum: 0 }) });
  const score = fresh().scoreOf(s, E);
  const clean = rules.cleanScore(score, AT);
  assert.ok(!clean.error && !clean.impossible, JSON.stringify(clean));
  assert.deepEqual([clean.shop, clean.chef, clean.fur, clean.hat, clean.level, clean.house], [s.shop, s.chef.name, s.chef.fur, s.chef.hat, 1, 1]);
});

// The updates page.
test('the updates page lists every release newest first, the big things before the small ones', () => {
  const fs = require('fs');
  const { updatesPage, check } = require('../scripts/updates-page');
  const list = JSON.parse(fs.readFileSync(path.join(src, 'updates.json'), 'utf8'));
  check(list);
  const html = updatesPage(list, { icon: 'x', logo: 'y' });
  const at = list.map((r) => html.indexOf(`id="v${r.v}"`));
  assert.ok(at.every((i, k) => i > 0 && (k === 0 || i > at[k - 1])), 'newest first');
  assert.equal((html.match(/class="now"/g) || []).length, 1, 'one Latest');
  assert.ok(html.indexOf('class="now"') < at[1], 'on the newest');
  for (const r of list) {
    const part = html.slice(html.indexOf(`id="v${r.v}"`), html.indexOf('</article>', html.indexOf(`id="v${r.v}"`)));
    const big = part.indexOf('<ul class="big">');
    const small = part.indexOf('<ul class="small">');
    if (big >= 0 && small >= 0) assert.ok(big < small, `${r.v}: big before small`);
    assert.equal((part.match(/<h3>/g) || []).length, r.items.filter((it) => it.big).length, `${r.v}: every big item has its title`);
  }
  assert.doesNotMatch(html, /[ăđơưĂĐƠƯẠ-ỹ]/, 'English like the rest of the public site');
  assert.match(updatesPage([{ v: '1.0.0', date: '2026-12-01', items: [{ kind: 'new', text: '<b>bold</b>' }] }], { icon: '', logo: '' }), /&lt;b&gt;bold&lt;\/b&gt;/, 'text is only text');
  const one = (over) => [Object.assign({ v: '0.0.2', date: '2026-11-06', items: [{ kind: 'new', text: 'x' }] }, over)];
  for (const bad of [[], one({ v: '2' }), one({ date: 'today' }), one({ items: [] }), one({ items: [{ kind: 'shiny', text: 'x' }] }), one({ items: [{ kind: 'new', big: true, text: 'x' }] }), one({}).concat(one({ v: '0.0.3' }))]) assert.throws(() => check(bad));
});

// Save codes.
test('a save code carries the whole restaurant, and a code cut short or changed is refused', async () => {
  const feed = { mode: 'live', settled: () => 100, round: () => ({ cum: 0, hash: 'h', work: 0 }), live: () => ({ cum: 0 }), hashBefore: () => 'h' };
  const s = E.newGame(Date.parse('2026-11-06T00:00:00Z'), feed, { shop: 'Mì Ơi 🍜', name: 'Ừm' });
  s.level = 17;
  s.cash = 123456;
  for (const a of WW.ANIMALS.slice(0, 90)) s.book[a.id] = 3;
  const code = await WW.SaveCode.make(s);
  assert.match(code, /^SQKZ1\.[A-Za-z0-9_-]+\.[0-9a-z]+$/, 'squeezed, one line, safe to paste anywhere');
  assert.ok(code.length < JSON.stringify(s).length, `shorter than the save itself: ${code.length} for ${JSON.stringify(s).length}`);
  assert.deepEqual(await WW.SaveCode.read(code), JSON.parse(JSON.stringify(s)), 'everything comes back');
  assert.deepEqual(await WW.SaveCode.read(`  ${code.slice(0, 40)}\n${code.slice(40)}\n`), JSON.parse(JSON.stringify(s)), 'spaces and line breaks from pasting do not matter');
  const refused = async (text, why) => {
    await assert.rejects(WW.SaveCode.read(text), (e) => e instanceof WW.SaveCode.CodeError && why.test(e.message), text.slice(0, 20));
  };
  await refused(code.slice(0, code.length - 30), /not complete/);
  await refused(code.slice(0, 200) + 'x' + code.slice(201), /not complete/);
  await refused('hello', /not a Squeekerant save code/);
  await refused('', /not a Squeekerant save code/);
  // Valid code, but not a restaurant inside.
  const real = globalThis.CompressionStream;
  try {
    delete globalThis.CompressionStream;
    const plain = await WW.SaveCode.make({ hello: 1 });
    assert.match(plain, /^SQKP1\./, 'a browser that cannot squeeze writes it plain');
    await refused(plain, /not a Squeekerant save code/);
    const plainSave = await WW.SaveCode.make(s);
    globalThis.CompressionStream = real;
    assert.deepEqual(await WW.SaveCode.read(plainSave), JSON.parse(JSON.stringify(s)), 'and any browser opens a plain one');
  } finally {
    globalThis.CompressionStream = real;
  }
});

test('the app files are there, and the manifest names icons of the sizes it says', () => {
  const fs = require('fs');
  const ui = path.join(src, 'ui');
  const manifest = JSON.parse(fs.readFileSync(path.join(ui, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.display, 'standalone');
  for (const icon of manifest.icons) {
    const png = fs.readFileSync(path.join(ui, icon.src.slice(1)));
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes, icon.src);
  }
  const apple = fs.readFileSync(path.join(ui, 'apple-touch-icon.png'));
  assert.deepEqual([apple.readUInt32BE(16), apple.readUInt32BE(20)], [180, 180]);
  const sw = fs.readFileSync(path.join(ui, 'sw.js'), 'utf8');
  assert.match(sw, /req\.method !== 'GET' \|\| req\.mode !== 'navigate'/, 'the service worker leaves everything but page loads alone');
  for (const step of ['save_code_made', 'save_code_loaded', 'install_pressed', 'installed']) assert.deepEqual(rules.cleanSteps({ steps: [step] }), [step], step);
});

// Wake up alerts and his dreams

const crypto = require('crypto');
const push = require('../server/push');
const wheelReader = require('../server/wheel');
const { createWake, WINDOW_MS, CHECK_GAP_MS, BATCH } = require('../server/wake');

// The browser's side of RFC 8291, to read what the server sent.
function openPush(body, receiver, auth) {
  const salt = body.subarray(0, 16);
  const idlen = body[20];
  const sender = body.subarray(21, 21 + idlen);
  const sealed = body.subarray(21 + idlen);
  const shared = receiver.computeSecret(sender);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', shared, auth, Buffer.concat([Buffer.from('WebPush: info\0'), receiver.getPublicKey(), sender]), 32));
  const key = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const d = crypto.createDecipheriv('aes-128-gcm', key, nonce);
  d.setAuthTag(sealed.subarray(sealed.length - 16));
  const plain = Buffer.concat([d.update(sealed.subarray(0, sealed.length - 16)), d.final()]);
  let end = plain.length - 1;
  while (end > 0 && plain[end] === 0) end--;
  assert.equal(plain[end], 2, 'one record, marked as the last');
  return plain.subarray(0, end).toString();
}
const FCM = 'https://fcm.googleapis.com/fcm/send/';

test('an alert is encrypted the way RFC 8291 says, for that one browser, and signed with the site key', () => {
  // The worked example in RFC 8291, section 5, byte for byte.
  const want = 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN';
  const example = { p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4', auth: 'BTBZMqHH6r4Tts7J_aSIgg' };
  const salt = Buffer.from(want, 'base64url').subarray(0, 16);
  const own = Buffer.from('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw', 'base64url');
  assert.equal(push.encrypt('When I grow up, I want to be a watermelon', example, own, salt).toString('base64url'), want);

  // A browser of our own reads a real message, and another browser cannot.
  const browser = crypto.createECDH('prime256v1');
  browser.generateKeys();
  const auth = crypto.randomBytes(16);
  const sub = { endpoint: FCM + 'abc', p256dh: browser.getPublicKey().toString('base64url'), auth: auth.toString('base64url') };
  const message = JSON.stringify({ title: 'Squeektoshi is awake', body: 'He slept 20.0 hours.' });
  const body = push.encrypt(message, sub);
  assert.equal(openPush(body, browser, auth), message);
  assert.notEqual(push.encrypt(message, sub).toString('hex'), body.toString('hex'), 'every message has its own salt and key');
  const other = crypto.createECDH('prime256v1');
  other.generateKeys();
  assert.throws(() => openPush(body, other, auth));

  // The token: for that push service only, short lived, from this site, and signed by the key the browsers were given.
  const keys = push.keysFrom('a secret');
  assert.equal(keys.publicKey.length, 65);
  assert.equal(push.keysFrom('a secret').publicText, keys.publicText, 'the same secret always gives the same key');
  assert.notEqual(push.keysFrom('another secret').publicText, keys.publicText);
  const now = Date.parse('2026-11-07T04:00:00Z');
  const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(push.vapid(FCM + 'abc', keys, now));
  assert.ok(m, 'the header has the token and the key');
  assert.equal(m[4], keys.publicText);
  const claims = JSON.parse(Buffer.from(m[2], 'base64url').toString());
  assert.deepEqual(claims, { aud: 'https://fcm.googleapis.com', exp: now / 1000 + 12 * 3600, sub: 'https://www.squeekerant.online' });
  const pub = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: keys.publicKey.subarray(1, 33).toString('base64url'), y: keys.publicKey.subarray(33).toString('base64url') }, format: 'jwk' });
  assert.ok(crypto.verify('sha256', Buffer.from(m[1] + '.' + m[2]), { key: pub, dsaEncoding: 'ieee-p1363' }, Buffer.from(m[3], 'base64url')));
});

test('only the push services of real browsers can be signed up, never any other address', () => {
  const browser = crypto.createECDH('prime256v1');
  browser.generateKeys();
  const keys = { p256dh: browser.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') };
  for (const endpoint of [FCM + 'dGVzdA:APA91b', 'https://updates.push.services.mozilla.com/wpush/v2/gAAAAAB', 'https://web.push.apple.com/QGuQyavXutnMoUBTz', 'https://wns2-par02p.notify.windows.com/w/?token=BQYAAAB']) {
    const sub = push.cleanSubscription({ endpoint, keys });
    assert.ok(sub, endpoint);
    assert.equal(sub.p256dh, keys.p256dh);
  }
  for (const endpoint of ['http://fcm.googleapis.com/fcm/send/x', 'https://fcm.googleapis.com.evil.example/x', 'https://evil.example/fcm.googleapis.com', 'https://localhost/x', 'https://127.0.0.1/x', 'https://169.254.169.254/latest', 'https://fcm.googleapis.com:8443/x', 'https://user:pw@fcm.googleapis.com/x', 'ftp://fcm.googleapis.com/x', FCM + 'x'.repeat(2000), '', null, 5]) {
    assert.equal(push.cleanSubscription({ endpoint, keys }), null, String(endpoint).slice(0, 60));
    assert.equal(push.cleanEndpoint(endpoint), null, String(endpoint).slice(0, 60));
  }
  const bad = (k) => push.cleanSubscription({ endpoint: FCM + 'x', keys: Object.assign({}, keys, k) });
  assert.equal(bad({ auth: crypto.randomBytes(8).toString('base64url') }), null, 'an auth secret of the wrong size');
  assert.equal(bad({ p256dh: crypto.randomBytes(65).toString('base64url') }), null, 'a key that is not a point');
  const offCurve = Buffer.concat([Buffer.from([4]), crypto.randomBytes(64)]);
  assert.equal(bad({ p256dh: offCurve.toString('base64url') }), null, 'a point off the curve');
  assert.equal(bad({ p256dh: '<script>' }), null);
  assert.equal(push.cleanSubscription(null), null);
});

test('a browser signs up for alerts and off again, from the real site only, within limits', async () => {
  const { call, store, clock } = setup();
  const key = await call('GET', '/api/push/key');
  assert.equal(key.json.key, push.keysFrom(Buffer.from('test secret').toString('hex')).publicText, 'the key comes from the same secret as the sessions');
  const browser = crypto.createECDH('prime256v1');
  browser.generateKeys();
  const sub = { endpoint: FCM + 'one', keys: { p256dh: browser.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') } };
  assert.deepEqual((await call('POST', '/api/push/subscribe', sub)).json, { ok: true });
  assert.deepEqual((await call('POST', '/api/push/subscribe', sub)).json, { ok: true }, 'the same browser again');
  assert.equal(store.subs.size, 1);
  assert.deepEqual([...store.subs.values()][0].p256dh, sub.keys.p256dh);
  assert.equal((await call('POST', '/api/push/subscribe', { endpoint: 'https://evil.example/x', keys: sub.keys })).status, 400);
  assert.equal((await call('POST', '/api/push/subscribe', sub, { host: 'evil.example' })).status, 403);
  assert.deepEqual((await call('POST', '/api/push/unsubscribe', { endpoint: sub.endpoint })).json, { ok: true });
  assert.equal(store.subs.size, 0);
  assert.equal((await call('POST', '/api/push/unsubscribe', { endpoint: 'https://evil.example/x' })).status, 400);
  let refused = null;
  for (let i = 0; i < 40 && refused === null; i++) {
    const r = await call('POST', '/api/push/subscribe', sub, { 'x-real-ip': '203.0.113.9' });
    if (r.status === 429) refused = i;
  }
  assert.ok(refused !== null && refused >= 27, `one address can only change so much an hour (refused after ${refused})`);
  clock.now += 3600000;
  assert.equal((await call('POST', '/api/push/subscribe', sub, { 'x-real-ip': '203.0.113.9' })).status, 200, 'and again the next hour');
  const closed = createApp({ store: closedStore, secret: Buffer.from('s') });
  assert.deepEqual((await closed({ method: 'POST', path: '/api/push/subscribe', body: sub, headers: HOST })).json, { ok: false });
});

// A wheel with runs and sleeps of every length, read the way the game reads SqueekCore.
function madeUpWheel(seed) {
  const rng = WW.Rng(WW.hash32(seed));
  const genesis = Date.parse('2026-11-01T00:00:00Z') / 1000;
  const feed = new WW.LiveFeed({ genesis, core: '0x' + 'ab'.repeat(20), chainId: '11155111', installation: 'test-wheel', status: { measurement: { cumulativeWorkUnits: '0', rpmMilli: 0, freshness: 'online', coreStatus: 'IDLE' } }, settled: 1, work: 0, rpcs: [] });
  feed.readFrom = 0;
  feed.baseCum = 0;
  feed.baseRound = 0;
  const hex = () => Array.from({ length: 16 }, () => '0123456789abcdef'[Math.floor(rng.next() * 16)]).join('');
  let r = 1;
  let cum = 0;
  for (const sleep of [30, 59, 60, 61, 89, 90, 95, 200, 12, 140, 6, 75, 3, 66]) {
    r += sleep;
    // A run, with rests of under an hour inside it.
    for (let i = 0; i < 8; i++) {
      if (i && rng.next() < 0.3) r += 1 + Math.floor(rng.next() * 4);
      r++;
      const work = 50 + Math.floor(rng.next() * 400);
      cum += work;
      feed.roundsKnown.set(r, { r, work, cum, hash: hex(), unknown: false });
    }
  }
  feed.frontierCum = cum;
  return { feed, end: r + 3 };
}

test('the server finds exactly the dreams the game gives every restaurant', () => {
  const { feed, end } = madeUpWheel('dreams');
  const t = feed.roundEnd(1) + 60000;
  const s = E.newGame(t, feed, {});
  feed.settledRound = end;
  E.advance(s, feed, feed.roundEnd(end) + 60000);
  const found = wheelReader.dreamsIn(WW, feed, 0);
  assert.equal(found.length, 9, 'sleeps of 60 rounds or more: 60, 61, 89, 90, 95, 200, 140, 75 and 66');
  assert.equal(found.filter((d) => d.gold).length, 4, '90 rounds or more: 90, 95, 200 and 140');
  assert.equal(found.length, s.wakes, 'as many dreams as the game had');
  const journal = {};
  for (const d of found) {
    const key = E.dreamDef(d.dream, d.gold).id;
    journal[key] = (journal[key] || 0) + 1;
  }
  assert.deepEqual(journal, s.journal, 'the same dreams');
  const last = found[found.length - 1];
  assert.deepEqual({ key: E.dreamDef(last.dream, last.gold).id, round: last.round, gold: last.gold, sleptRounds: last.slept }, s.dreamDish, 'the same latest dream, round and sleep');
  assert.equal(last.woke, feed.roundEnd(last.round - 1), 'he woke during that round');
  assert.deepEqual([last.wheel, last.core, last.chain], ['test-wheel', '0x' + 'ab'.repeat(20), '11155111']);
  // Read again from a dream already kept, that one is left out and the later ones are the same.
  const later = wheelReader.dreamsIn(WW, feed, found[5].round - 1);
  assert.deepEqual(later, found.slice(6));
});

test('the wheel reader loads the game in the build\'s own order', () => {
  const fs = require('fs');
  const build = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'build.js'), 'utf8');
  const order = Array.from(build.match(/const ORDER = \[(.+)\];/)[1].matchAll(/'([^']+\.js)'/g), (m) => m[1]);
  let at = -1;
  for (const file of wheelReader.FILES) {
    const i = order.indexOf(file);
    assert.ok(i > at, `${file} comes after the one before it in the build`);
    at = i;
  }
  const world = wheelReader.world();
  assert.equal(world.DREAMS.length, WW.DREAMS.length);
  assert.equal(wheelReader.dreamDish(3, true).n, E.dreamDef(3, true).n);
});

// A wheel that only says what it was told, and counts how often it was read.
function toldWheel(dreams) {
  return {
    reads: 0,
    async read(from) {
      this.reads++;
      // Read like the game, 320 rounds back from the latest settled one.
      const start = from === null ? 600 - 320 : from;
      return { wheel: 'test-wheel', core: '0x' + 'ab'.repeat(20), settled: 600, from: start, dreams: dreams.filter((d) => d.round > start) };
    },
    dreamDish: (i, g) => E.dreamDef(i, g),
  };
}
const dreamAt = (round, woke, slept = 120) => ({ wheel: 'test-wheel', core: '0x' + 'ab'.repeat(20), chain: '11155111', round, hash: crypto.createHash('sha256').update(String(round)).digest('hex').slice(0, 16), dream: round % 24, gold: slept >= 90, slept, woke });
// A store that writes down every call to it.
function watched(store) {
  const calls = [];
  return { calls, store: new Proxy(store, { get: (o, k) => (typeof o[k] === 'function' ? (...a) => (calls.push(k), o[k](...a)) : o[k]) }) };
}

test('an alert goes out once, soon after he wakes, and the database rests the rest of the day', async () => {
  const now = Date.parse('2026-11-07T04:00:00Z');
  const clock = { now };
  const base = memoryStore();
  const { calls, store } = watched(base);
  for (let i = 1; i <= 3; i++) await base.addSub({ endpoint: FCM + i, p256dh: 'k' + i, auth: 'a' + i }, now);
  await base.addSub({ endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/gone', p256dh: 'k', auth: 'a' }, now);
  const sent = [];
  const send = async (sub, message) => {
    sent.push([sub.endpoint, message]);
    return sub.endpoint.endsWith('gone') ? 410 : sub.endpoint.endsWith('2') ? 500 : 201;
  };

  // He woke five hours ago: nothing to send, and the database is not even asked.
  const old = toldWheel([dreamAt(300, now - 30 * 3600000), dreamAt(480, now - 5 * 3600000)]);
  const quiet = createWake({ store, wheel: old, send, clock: () => clock.now });
  const r1 = await quiet.check();
  assert.equal(r1.ok, true);
  assert.equal(r1.latest.id, '2026-11-06-480');
  assert.deepEqual(calls, [], 'no database while no alert is due');
  assert.equal(sent.length, 0);

  // He woke ten minutes ago.
  const fresh = toldWheel([dreamAt(300, now - 30 * 3600000), dreamAt(480, now - 5 * 3600000), dreamAt(510, now - 600000, 95)]);
  const wake = createWake({ store, wheel: fresh, send, clock: () => clock.now });
  const r2 = await wake.check();
  assert.equal(r2.latest.id, '2026-11-07-510');
  assert.equal(r2.sent, 2, 'two browsers took it, one failed for now');
  assert.equal(r2.gone, 1);
  assert.equal(sent.length, 4);
  const words = sent[0][1];
  assert.equal(words.title, 'Squeektoshi is awake');
  assert.equal(words.body, `He slept 15.8 hours and dreamed of ${E.dreamDef(510 % 24, true).n}. Your guests are on their way.`);
  assert.equal(words.image, 'https://www.squeekerant.online/dreams/2026-11-07-510.png');
  assert.equal(words.url, '/?from=alert');
  assert.ok(!base.subs.has('https://updates.push.services.mozilla.com/wpush/v2/gone'), 'a browser that is gone is dropped');
  assert.equal(base.subs.size, 3, 'a browser that only failed this time is kept');
  const kept = await base.dreams();
  assert.deepEqual(kept.map((d) => [d.round, d.done, d.sent]), [[510, true, 2], [480, true, 0], [300, true, 0]], 'every dream is kept, the old ones with no alert');

  // Asked again, by this server or a new one: nothing more goes out.
  clock.now += CHECK_GAP_MS + 1000;
  assert.equal((await wake.check()).sent, 0);
  assert.equal((await createWake({ store, wheel: fresh, send, clock: () => clock.now }).check()).sent, 0);
  assert.equal(sent.length, 4);
  // Asked many times at once, the wheel is read once.
  const busy = toldWheel([dreamAt(510, now - 600000, 95)]);
  const once = createWake({ store, wheel: busy, send, clock: () => clock.now });
  await Promise.all([once.check(), once.check(), once.check()]);
  assert.equal(busy.reads, 1);
  // Three hours on, it is old news.
  clock.now = now + WINDOW_MS + 60000;
  calls.length = 0;
  await createWake({ store, wheel: fresh, send, clock: () => clock.now }).check();
  assert.deepEqual(calls, [], 'no database three hours on');
});

test('two servers at once send an alert only once, and a long list of browsers goes out over several looks', async () => {
  const now = Date.parse('2026-11-07T04:00:00Z');
  const store = memoryStore();
  for (let i = 1; i <= BATCH + 20; i++) await store.addSub({ endpoint: FCM + i, p256dh: 'k', auth: 'a' }, now);
  const got = new Map();
  const send = async (sub) => {
    got.set(sub.endpoint, (got.get(sub.endpoint) || 0) + 1);
    await new Promise((r) => setTimeout(r, 1));
    return 201;
  };
  const told = toldWheel([dreamAt(510, now - 600000)]);
  const a = createWake({ store, wheel: told, send, clock: () => now });
  const b = createWake({ store, wheel: told, send, clock: () => now });
  const [ra, rb] = await Promise.all([a.check(), b.check()]);
  assert.equal(ra.sent + rb.sent, BATCH, 'one batch, by whichever server got there first');
  assert.ok([...got.values()].every((n) => n === 1), 'nobody twice');
  const c = createWake({ store, wheel: told, send, clock: () => now + 120000 });
  assert.equal((await c.check()).sent, 20, 'the rest on the next look');
  assert.equal(got.size, BATCH + 20);
  assert.ok([...got.values()].every((n) => n === 1));
  assert.equal((await store.dreams())[0].done, true);
});

test('the dreams page lists every dream with what anyone needs to check it, and each has its own picture', async () => {
  const now = Date.parse('2026-11-07T04:00:00Z');
  const store = memoryStore();
  const told = toldWheel([dreamAt(186, Date.parse('2026-11-05T02:40:00Z'), 185), dreamAt(337, Date.parse('2026-11-06T03:50:00Z'), 126), dreamAt(479, Date.parse('2026-11-07T03:30:00Z'), 64)]);
  const handle = createApp({ store, secret: Buffer.from('s'), clock: () => now, wheel: told, send: async () => 201 });
  const get = (p) => handle({ method: 'GET', path: p, headers: HOST });
  const list = await get('/dreams');
  assert.equal(list.status, 200);
  const html = list.html;
  const names = [479, 337, 186].map((r) => E.dreamDef(r % 24, r !== 479).n);
  let at = -1;
  for (const n of names) {
    const i = html.indexOf(`<h2>${n}`);
    assert.ok(i > at, `${n} is listed, newest first`);
    at = i;
  }
  assert.ok(html.includes(dreamAt(479).hash) && html.includes('Round 479'), 'its round and hash');
  assert.ok(html.includes('0x' + 'ab'.repeat(20)), 'the whole contract address');
  assert.ok(html.includes('https://sepolia.etherscan.io/address/0x' + 'ab'.repeat(20)));
  assert.ok(html.includes('roundPage(uint64,uint64,uint256)') && html.includes("hash32(hash, 'dream') % 24"));
  assert.ok(html.includes('href="/dreams/2026-11-07-479"'));
  assert.ok(html.includes('https://x.com/intent/post?text='));
  assert.ok(html.includes('content="https://www.squeekerant.online/dreams/2026-11-07-479.png"'), 'the newest picture for link previews');
  assert.ok(!/[ăđơưĂĐƠƯẠ-ỹ]/.test(html), 'English only');
  const page = await get('/dreams/2026-11-07-479');
  assert.equal(page.status, 200);
  assert.ok(page.html.includes('<meta property="og:image" content="https://www.squeekerant.online/dreams/2026-11-07-479.png">'));
  assert.ok(page.html.includes('<meta name="twitter:card" content="summary_large_image">'));
  assert.ok(page.html.includes('slept 10.7 hours'));
  const png = await get('/dreams/2026-11-07-479.png');
  assert.equal(png.type, 'image/png');
  assert.equal(png.body.readUInt32BE(16), 1200);
  assert.equal(png.body.readUInt32BE(20), 630);
  assert.match(png.cache, /immutable/);
  for (const p of ['/dreams/2026-11-07-478', '/dreams/2026-11-06-479', '/dreams/2026-11-07-479.jpg', '/dreams/../api/board', '/dreams/x']) assert.equal((await get(p)).status, 404, p);
  assert.equal((await get('/dreams/2026-11-07-478.png')).status, 404);
});

test('his dreams are checked every 15 minutes, as often as the free plan allows, and their pages reach the server', () => {
  const fs = require('fs');
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
  assert.deepEqual(config.schedules['wake-check'], { schedule: '*/15 * * * *', path: '/api/wake/check' });
  for (const source of ['/dreams', '/dreams/(.*)']) assert.ok(config.rewrites.some((r) => r.source === source && r.destination === '/api/index'), source);
  const sw = fs.readFileSync(path.join(src, 'ui/sw.js'), 'utf8');
  for (const event of ['push', 'notificationclick', 'pushsubscriptionchange']) assert.ok(sw.includes(`addEventListener('${event}'`), event);
  for (const step of ['alerts_on', 'alert_opened']) assert.deepEqual(rules.cleanSteps({ steps: [step] }), [step], step);
});

test('with no answer from the official API, the server finds the last settled round on the chain alone', async () => {
  for (const [upTo, last] of [[500, 500], [500, 498], [500, 497], [500, 490], [500, 400], [500, 3], [12, 1]]) {
    let asked = 0;
    const found = await wheelReader.lastSettled(async (r) => (asked++, r <= last), upTo);
    assert.equal(found, last, `${last} of up to ${upTo}`);
    assert.ok(asked <= 30, `in a few looks (${asked})`);
  }
  await assert.rejects(wheelReader.lastSettled(async () => false, 500), /No settled round/);
  const config = require('fs').readFileSync(path.join(src, 'core/feed.js'), 'utf8');
  assert.ok(config.includes('WW.KNOWN_WHEELS = KNOWN_WHEELS') && config.includes('WW.NODES = NODES'), 'the server reads the same wheels through the same nodes');
});

// A restaurant goes with its wallet

test('a restaurant is kept with its wallet, readable and changeable only by that wallet, and a device only replaces the copy it last saw', async () => {
  const { call, signIn, store, clock } = setup();
  const alice = (await signIn(ALICE)).json.token;
  const bob = (await signIn(BOB)).json.token;
  const as = (token) => ({ authorization: 'Bearer ' + token });
  const code = (n) => `SQKZ1.${'Ab_-9'.repeat(n)}.1x`;
  const at = (d) => AT - 100000 + d;
  assert.equal((await call('GET', '/api/save')).status, 401, 'nobody signed in');
  assert.equal((await call('GET', '/api/save', null, as('made.up'))).status, 401);
  assert.deepEqual((await call('GET', '/api/save', null, as(alice))).json, { code: null }, 'nothing kept yet');

  // The first device keeps one, having seen none.
  const first = await call('POST', '/api/save', { code: code(10), at: at(0), base: 0 }, as(alice));
  assert.deepEqual(first.json, { ok: true, kept: true, at: at(0) });
  assert.deepEqual((await call('GET', '/api/save', null, as(alice))).json, { code: code(10), at: at(0) });
  assert.deepEqual((await call('GET', '/api/save', null, as(bob))).json, { code: null }, 'another wallet sees nothing of it');

  // It goes on from the copy it saw. A second device that saw the same copy goes on from it too, and the first is then behind.
  assert.equal((await call('POST', '/api/save', { code: code(11), at: at(500), base: at(0) }, as(alice))).json.kept, true);
  const behind = await call('POST', '/api/save', { code: code(12), at: at(900), base: at(0) }, as(alice));
  assert.deepEqual(behind.json, { ok: true, kept: false, at: at(500) }, 'based on a copy that is no longer the latest: refused, and told what is kept');
  assert.equal((await call('GET', '/api/save', null, as(alice))).json.code, code(11));
  assert.equal((await call('POST', '/api/save', { code: code(13), at: at(1200), base: at(500) }, as(alice))).json.kept, true, 'based on the latest: taken');
  // A device that chose its own restaurant over the kept one says so.
  assert.deepEqual((await call('POST', '/api/save', { code: code(14), at: at(1500), base: 0, force: true }, as(alice))).json, { ok: true, kept: true, at: at(1500) });
  assert.equal((await call('POST', '/api/save', { code: code(15), at: at(1800) }, as(alice))).json.kept, false, 'with no base it is a device that saw nothing, so it cannot replace anything');

  // Only what the game makes, and no time from the future.
  for (const bad of [{ code: 'hello', at: at(0) }, { code: code(1) + '<b>', at: at(0) }, { code: 'SQKZ1..1x', at: at(0) }, { code: code(1), at: 'now' }, { code: code(1), at: 5 }, { code: code(1), at: at(0), base: -1 }, { code: code(1), at: at(0), base: 'x' }, { code: 12345, at: at(0) }, { at: at(0) }, null]) {
    assert.equal((await call('POST', '/api/save', bad, as(alice))).status, 400, JSON.stringify(bad));
  }
  assert.equal((await call('POST', '/api/save', { code: 'SQKZ1.' + 'a'.repeat(rules.MOST_SAVE_CODE) + '.1x', at: at(0) }, as(alice))).status, 400, 'too big');
  const future = await call('POST', '/api/save', { code: code(2), at: AT + 99 * 86400000, base: at(1500) }, as(alice));
  assert.equal(future.json.at, AT, 'a time in the future is taken as now');
  assert.equal((await call('GET', '/api/save', null, as(bob))).json.code, null);

  // Starting over takes it away, and the next first device starts fresh.
  assert.deepEqual((await call('POST', '/api/save', { code: null }, as(alice))).json, { ok: true, kept: true });
  assert.deepEqual((await call('GET', '/api/save', null, as(alice))).json, { code: null });
  assert.equal(store.saves.size, 0);
  assert.equal((await call('POST', '/api/save', { code: code(3), at: at(2000), base: 0 }, as(alice))).json.kept, true);

  // Limits, and the same wallet whichever way its address is spelled.
  let refused = null;
  for (let i = 0; i < 60 && refused === null; i++) if ((await call('POST', '/api/save', { code: code(3), at: at(3000 + i), base: 0, force: true }, Object.assign(as(alice), { 'x-real-ip': '198.51.100.7' }))).status === 429) refused = i;
  assert.ok(refused !== null && refused >= 35, `one address can only save so often an hour (refused after ${refused})`);
  clock.now += 3600000;
  assert.equal((await call('POST', '/api/save', { code: code(3), at: AT + 3600000, base: 0, force: true }, Object.assign(as(alice), { 'x-real-ip': '198.51.100.7' }))).status, 200, 'and again the next hour');
  assert.equal([...store.saves.keys()].every((k) => k === k.toLowerCase()), true, 'kept under the lower case address');
  const closed = createApp({ store: closedStore, secret: Buffer.from('s') });
  assert.equal((await closed({ method: 'GET', path: '/api/save', headers: Object.assign({}, HOST, as(alice)) })).status, 503, 'with no database, closed');
});

test('a restaurant kept with a wallet is one the game itself made and can open again', async () => {
  const feed = new WW.RecordingFeed(WW.RECORDING);
  const s = E.newGame(feed.now(), feed, { shop: "Mina's Den", name: 'Mina' });
  s.savedAt = Date.now();
  const made = await WW.SaveCode.make(s);
  assert.deepEqual(rules.cleanSaveCode({ code: made, at: s.savedAt }, Date.now() + 1000), { code: made, at: s.savedAt, base: 0, force: false }, 'the server takes what the game makes');
  assert.ok(made.length < rules.MOST_SAVE_CODE / 3, 'and a grown restaurant stays far under the limit');
  const back = await WW.SaveCode.read(made);
  assert.equal(back.shop, "Mina's Den");
  assert.equal(back.created, s.created, 'the game tells two restaurants apart by when they were made');
});
