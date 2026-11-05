// The leaderboard's server and the game's side of it. Run with: npm test
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { privateKeyToAccount } = require('viem/accounts');
const { createApp } = require('../server/app');
const { memoryStore, closedStore, sqlStore } = require('../server/store');
const rules = require('../server/rules');

const src = path.join(__dirname, '..', 'src');
for (const f of ['core/rng.js', 'art/px.js', 'art/scene.js', 'data/recording.js', 'data/animals.js', 'data/food.js', 'data/outside.js', 'data/decor.js', 'core/feed.js', 'core/engine.js', 'core/wallet.js']) require(path.join(src, f));
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

// The game's side.

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
