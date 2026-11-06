// The leaderboard's server and the game's side of it. Run with: npm test
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { privateKeyToAccount } = require('viem/accounts');
const { createApp } = require('../server/app');
const { memoryStore, closedStore, sqlStore } = require('../server/store');
const rules = require('../server/rules');

const src = path.join(__dirname, '..', 'src');
for (const f of ['core/rng.js', 'art/px.js', 'art/scene.js', 'data/recording.js', 'data/animals.js', 'data/food.js', 'data/outside.js', 'data/decor.js', 'core/feed.js', 'core/engine.js', 'core/wallet.js', 'core/counter.js']) require(path.join(src, f));
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
