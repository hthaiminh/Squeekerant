// Rule tests on a small made up wheel, so each case states exactly what the hamster did.
// Run with: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const src = path.join(__dirname, '..', 'src');
for (const f of ['core/rng.js', 'art/px.js', 'art/scene.js', 'data/animals.js', 'data/food.js', 'data/outside.js', 'data/decor.js', 'core/engine.js']) require(path.join(src, f));
const WW = globalThis.WW;
const E = WW.Engine;
const ROUND = 600000;

// A fake feed: rounds[i] is the work in round i+1; null means the record is missing.
function feedOf(rounds) {
  const cumAt = [0];
  let cum = 0;
  rounds.forEach((w) => {
    cum += w || 0;
    cumAt.push(cum);
  });
  return {
    mode: 'test',
    mmPerPass: 878,
    roundEnd: (r) => r * ROUND,
    roundAt: (t) => Math.floor(t / ROUND) + 1,
    settled: (t) => Math.floor(t / ROUND),
    round: (r) => ({ r, work: rounds[r - 1] || 0, cum: cumAt[Math.min(r, rounds.length)], hash: rounds[r - 1] ? 'h' + r : null, unknown: rounds[r - 1] === null }),
    hashBefore: () => 'h0',
    workBetween: () => 0,
    live: (t) => ({ state: 'quiet', rpm: 0, cum: cumAt[Math.min(Math.floor(t / ROUND), rounds.length)], agoMs: 1e9, round: Math.floor(t / ROUND) + 1 }),
  };
}
const fresh = (feed, t = 0) => {
  const s = E.newGame(t, feed);
  s.away = { fromRound: 0, toRound: 0, active: 0, quiet: 0, unknown: 0, work: 0, served: 0, earned: 0, soldOut: 0, full: 0, tired: 0, newSpecies: [], rares: [], winkGain: 0, dreams: [], naps: 0, jobs: [], levels: 0, festival: null, verdict: null };
  return s;
};

test('one guest per ten wheel passes, paid when the round settles', () => {
  const feed = feedOf([100]);
  const s = fresh(feed);
  s.stock = { carrot_coins: 50 };
  const start = s.cash;
  E.advance(s, feed, ROUND);
  assert.equal(s.stats.served, 10);
  assert.equal(s.stock.carrot_coins, 40);
  assert.ok(s.cash > start, 'money reached the bank');
  assert.equal(s.till, 0, 'till is empty once the round settled');
});

test('guests beyond the seats are turned away, and counted', () => {
  const feed = feedOf([1000]);
  const s = fresh(feed);
  s.stock = { carrot_coins: 500 };
  const cap = E.capacity(s);
  assert.equal(cap, 12, 'four seats, three turns each');
  E.advance(s, feed, ROUND);
  assert.equal(s.stats.served, 12);
  assert.equal(s.stats.full, 88);
});

test('an empty counter sends guests away without any cost', () => {
  const feed = feedOf([50]);
  const s = fresh(feed);
  s.stock = {};
  const start = s.cash;
  E.advance(s, feed, ROUND);
  assert.equal(s.stats.soldOut, 5);
  assert.equal(s.cash, start);
});

test('a quiet round gives Dream, rest and a pot tick, and nothing else', () => {
  const feed = feedOf([0, 0, 0]);
  const s = fresh(feed);
  s.staff.find((w) => w.role === 'waiter').energy = 50;
  const dream = s.winks;
  E.advance(s, feed, 3 * ROUND);
  assert.equal(s.winks, dream + 3);
  assert.equal(s.staff.find((w) => w.role === 'waiter').energy, 53);
  assert.equal(s.clock.quietTotal, 3);
  assert.equal(s.stats.served, 0);
});

test('missing rounds count for nothing and do not break a sleep', () => {
  const feed = feedOf([0, 0, null, null, 0]);
  const s = fresh(feed);
  const dream = s.winks;
  E.advance(s, feed, 5 * ROUND);
  assert.equal(s.winks, dream + 3);
  assert.equal(s.clock.streak, 3, 'the streak waits through the gap');
  assert.equal(s.clock.quietTotal, 3);
});

test('a wok only moves on passes and a pot only moves on quiet rounds', () => {
  const feed = feedOf([0, 0, 0, 0, 0, 0, 0, 0, 300, 0]);
  const s = fresh(feed);
  s.pantry = { peas: 10, oats: 20 };
  assert.equal(E.startCook(s, 'tossed_peas', 1, feed, 0), null);
  assert.equal(E.startCook(s, 'oat_porridge', 2, feed, 0), null);
  E.advance(s, feed, 8 * ROUND);
  assert.ok(s.stations[1].job, 'the wok waits while he sleeps');
  assert.equal(s.stations[2].job, null, 'six quiet rounds finished the pot');
  assert.ok(s.stock.oat_porridge > 0);
  E.advance(s, feed, 9 * ROUND);
  assert.equal(s.stations[1].job, null, '300 passes finished a 200 pass wok');
});

test('food never spoils however long he sleeps', () => {
  const rounds = new Array(144 * 5).fill(0);
  const feed = feedOf(rounds);
  const s = fresh(feed);
  s.stock = { carrot_coins: 12 };
  E.advance(s, feed, rounds.length * ROUND);
  assert.equal(s.stock.carrot_coins, 12);
});

test('dreams follow how long he slept, using the hash of the round he woke on', () => {
  const nap = feedOf([...new Array(10).fill(0), 100]);
  const a = fresh(nap);
  E.advance(a, nap, 11 * ROUND);
  assert.equal(a.dreamDish, null, 'under ten hours brings no dream');
  assert.equal(a.away.naps, 1, 'a nap of an hour or more leaves a gift');

  const long = feedOf([...new Array(60).fill(0), 100]);
  const b = fresh(long);
  E.advance(b, long, 61 * ROUND);
  assert.ok(b.dreamDish && !b.dreamDish.gold, 'ten hours brings a dream');

  const gold = feedOf([...new Array(90).fill(0), 100]);
  const c = fresh(gold);
  E.advance(c, gold, 91 * ROUND);
  assert.ok(c.dreamDish.gold, 'fifteen hours brings a golden one');

  const again = fresh(long);
  E.advance(again, long, 61 * ROUND);
  assert.equal(again.dreamDish.key, b.dreamDish.key, 'two players see the same dream');
});

test('the same rounds give two players the same guests', () => {
  const feed = feedOf([300, 0, 250]);
  const a = fresh(feed);
  const b = fresh(feed);
  a.stock = { carrot_coins: 500 };
  b.stock = { carrot_coins: 500 };
  E.advance(a, feed, 3 * ROUND);
  E.advance(b, feed, 3 * ROUND);
  assert.deepEqual(a.book, b.book);
  assert.equal(a.cash, b.cash);
});

test('waiters run out of energy, lunchboxes step in, then guests leave', () => {
  const feed = feedOf([8000]);
  const s = fresh(feed);
  s.furniture = [];
  s.room = { cols: 24, rows: 12 };
  for (let x = 0; x < 24; x++) s.furniture.push({ id: 'spool_red', x, y: 0 }, { id: 'cork', x, y: 1 }, { id: 'spool_red', x, y: 3 }, { id: 'cork', x, y: 2 });
  s.stock = { carrot_coins: 2000 };
  s.lunch = 1;
  s.staff.find((w) => w.role === 'waiter').energy = 5;
  E.advance(s, feed, ROUND);
  assert.equal(s.lunch, 0, 'the lunchbox was eaten');
  assert.ok(s.stats.tired > 0, 'some guests left when nobody could serve');
  assert.equal(s.stats.served, 90, '10 guests from 5% energy plus 80 from the lunchbox');
});

test('rare guests need what they need', () => {
  const s = fresh(feedOf([0]));
  const otter = WW.ANIMAL.otter;
  assert.equal(E.meetsNeeds(s, otter), false, 'no pond yet');
  s.furniture.push({ id: 'saucer_pond', x: 0, y: 2 });
  assert.equal(E.meetsNeeds(s, otter), true);
  const owl = WW.ANIMAL.owlet;
  assert.equal(E.meetsNeeds(s, owl), false, 'no perch yet');
  const perch = WW.DECOR.find((d) => d.tag === 'perch');
  s.furniture.push({ id: perch.id, x: 0, y: 3 });
  assert.equal(E.meetsNeeds(s, owl), true, 'every species comes through the door');
});

test('while he sleeps nobody comes in, and every species can still be met', () => {
  const feed = feedOf(new Array(200).fill(0));
  const s = fresh(feed);
  s.stock = { carrot_coins: 40 };
  E.advance(s, feed, ROUND * 200);
  const events = [];
  E.pulse(s, feed, ROUND * 200, events);
  assert.equal(s.clock.quietTotal, 200, 'two hundred rounds asleep');
  assert.equal(events.length, 0);
  assert.equal(s.stats.served + s.stats.full + s.stats.soldOut + s.stats.tired, 0, 'no guests');
  assert.equal(s.stock.carrot_coins, 40, 'nothing eaten');
  assert.equal(s.quiet, undefined, 'nobody waiting either');
  assert.ok(s.winks > 30, 'Winks still fill');
  const old = JSON.parse(JSON.stringify(s));
  old.quiet = [{ id: 1, species: 'field_mouse', want: ['sweet', 'earthy'], line: '' }];
  old.quietTick = 2;
  old.quietN = 4;
  const moved = E.migrate(old);
  assert.equal(moved.quiet, undefined, 'those waiting in an old save have gone');
  for (const a of WW.ANIMALS) assert.equal(a.needs.quiet, undefined, a.id);
  assert.equal(WW.ANIMALS.length, 180);
});

test('a seat only counts beside a table, and the door stays clear', () => {
  const s = fresh(feedOf([0]));
  const before = E.seatsOf(s).length;
  s.furniture.push({ id: 'cork', x: 11, y: 0 });
  assert.equal(E.seatsOf(s).length, before, 'a stool alone is not a seat');
  assert.ok(E.canPlace(s, 'cork', 9, 4), 'cannot block the door');
});

test('furniture may close off a seat, and guests squeeze through as little of it as they can', () => {
  require(path.join(src, 'ui/scene.js'));
  const s = fresh(feedOf([0]));
  const { cols, rows } = s.room;
  s.furniture = [{ id: 'cork', x: 0, y: 0 }, { id: 'spool_green', x: 1, y: 0 }];
  for (let y = 0; y < rows - 1; y++) s.furniture.push({ id: 'cork', x: 3, y });
  const scene = { st: s, inner: () => s.room, blockedMap: WW.Scene.prototype.blockedMap };
  const door = { col: cols - 3, row: rows - 1 };
  const seat = { col: 0, row: 0 };
  const crossed = (way) => way.slice(0, -1).filter((p) => s.furniture.some((f) => f.x * 16 + 8 === p.x && WW.WORLD.DINING_Y + f.y * 16 + 13 === p.y)).length;
  const walk = (a, b) => WW.Scene.prototype.findPath.call(scene, a, b);
  assert.equal(crossed(walk(door, seat)), 0, 'walks round while there is a gap');
  assert.equal(E.canPlace(s, 'cork', 3, rows - 1), null, 'the last piece closes the gap');
  s.furniture.push({ id: 'cork', x: 3, y: rows - 1 });
  const way = walk(door, seat);
  assert.equal(crossed(way), 1, 'crosses the wall once');
  way.forEach((p, i) => i && assert.equal(Math.abs(p.x - way[i - 1].x) + Math.abs(p.y - way[i - 1].y), 16, 'one tile at a time'));
  assert.equal(crossed(walk(seat, door).reverse()), 1, 'and back the same way');
});

test('the daily question asks about his last full day in ranges, and only on the real wheel', () => {
  const DAY = 86400000;
  const roundAt = (t) => Math.floor(t / 600000) + 1;
  const s = fresh(feedOf([0]));
  const wanted = 'About how many wheel passes did Squeektoshi make on his last full day?';
  const ranges = ['Under 9,000', '9,000 to 10,999', '11,000 to 12,999', '13,000 or more'];
  let asked = 0;
  for (let d = 0; d < 60; d++) {
    for (const hour of [1, 11, 13, 23]) {
      const t = Date.parse('2026-11-01T00:00:00Z') + d * DAY + hour * 3600000;
      const windows = [];
      const wheel = { roundAt, settled: (x) => roundAt(x) - 3, knows: () => true, workBetween: (a, b) => (windows.push([a, b]), 10000) };
      const quiz = E.quizFor(s, wheel, t);
      assert.equal(E.quizFor(s, { roundAt, settled: wheel.settled, workBetween: () => 10000 }, t).q === wanted, false, 'the recording never asks');
      assert.equal(E.quizFor(s, Object.assign({}, wheel, { knows: () => false }), t).q === wanted, false, 'nor does a wheel missing part of the day');
      if (quiz.q !== wanted) continue;
      asked++;
      assert.deepEqual(quiz.opts, ranges);
      assert.equal(quiz.answer, 1);
      const [a, b] = windows[0];
      assert.equal(b - a, 143, 'a whole day');
      assert.equal(new Date(b * 600000).toISOString().slice(11, 16), '12:00', 'ends at noon UTC, as the official stats do');
      assert.ok(b * 600000 <= t && t - b * 600000 <= DAY, 'the latest one that has finished');
    }
  }
  assert.ok(asked > 20, `asked ${asked} times`);
  const day = Date.parse('2026-11-01T00:00:00Z');
  let t = day;
  const asks = (w) => E.quizFor(s, { roundAt, settled: (x) => roundAt(x) - 3, knows: () => true, workBetween: () => w }, t);
  while (asks(1).q !== wanted) t += DAY;
  for (const [w, i] of [[1, 0], [8999, 0], [9000, 1], [10999, 1], [11000, 2], [12999, 2], [13000, 3], [99999, 3]]) assert.equal(asks(w).answer, i, `${w} passes`);
  assert.notEqual(asks(0).q, wanted, 'a day with no passes asks something else');
  // Just after noon the last rounds are not settled yet, so it stays on the day before.
  const windows = [];
  const noon = Date.parse(new Date(t).toISOString().slice(0, 10) + 'T12:00:00Z');
  E.quizFor(s, { roundAt, settled: (x) => roundAt(x) - 3, knows: () => true, workBetween: (a, b) => (windows.push(b), 10000) }, noon + 300000);
  assert.equal(windows[0] * 600000, noon - DAY);
});

test('a round only counts as settled once its work has been read', async () => {
  require(path.join(src, 'core/feed.js'));
  const status = { measurement: { cumulativeWorkUnits: '100' }, builder: { anchor: {} } };
  const feed = new WW.LiveFeed({ genesis: 0, core: '0x0', rpc: '', status, settled: 10, work: 100 });
  const hex = (n) => BigInt(n).toString(16).padStart(64, '0');
  // A page from SqueekCore: words 1, 2, 5 and 9 are certified through, starting total, ending total and how many rounds, then five words a round.
  const page = (cert, start, rows) => {
    const words = new Array(10).fill(hex(0));
    words[1] = hex(cert);
    words[2] = hex(start);
    words[5] = hex(rows.length ? rows[rows.length - 1][1] : start);
    words[9] = hex(rows.length);
    for (const [r, cum] of rows) words.push(hex(r), hex(cum), hex(0), hex(0), hex(r + 1000));
    return '0x' + words.join('');
  };
  let reply;
  feed.call = () => new Promise((resolve, reject) => (reply = { resolve, reject }));
  const reading = feed.syncTo(12);
  assert.equal(feed.settled(), 10, 'the game must not reach those rounds before their work is in');
  reply.resolve(page(12, 100, [[11, 150]]));
  await reading;
  assert.equal(feed.settled(), 12);
  assert.equal(feed.round(11).work, 50);
  assert.equal(feed.round(12).work, 0);
  assert.ok(feed.knows(11, 12));
  assert.equal(feed.knows(10, 12), false, 'nothing was read from before that');

  const failing = feed.syncTo(13);
  reply.reject(new Error('no network'));
  await assert.rejects(failing);
  assert.equal(feed.settled(), 12, 'a failed read stays unsettled and is tried again');
  const again = feed.syncTo(13);
  reply.resolve(page(13, 150, [[13, 170]]));
  await again;
  assert.equal(feed.settled(), 13);
  assert.equal(feed.round(13).work, 20);

  // A node behind the chain is not asked again and again.
  let calls = 0;
  feed.call = async () => (calls++, page(13, 170, []));
  await assert.rejects(feed.syncTo(16));
  assert.equal(calls, 1);
  assert.equal(feed.settled(), 13);
});

test('a bad reply from the API changes nothing', async () => {
  require(path.join(src, 'core/feed.js'));
  const good = { measurement: { freshness: 'online', coreStatus: 'IDLE', rpmMilli: 60000, cumulativeWorkUnits: '500' }, builder: { anchor: { settledThroughRound: '10', cumulativeWork: '500' } } };
  const feed = new WW.LiveFeed({ genesis: 0, core: '0x0', rpcs: [], status: good, settled: 10, work: 500 });
  feed.api = '';
  for (const reply of [{ status: 'unavailable' }, { error: 'server' }, { measurement: { status: 'unavailable' } }, null]) {
    feed.timed = async () => ({ json: async () => reply });
    await feed.poll();
    assert.ok(feed.lastError, JSON.stringify(reply));
    assert.equal(feed.live(1000).cum, 500);
    assert.equal(feed.live(1000).state, 'running');
  }
  feed.timed = async () => ({ json: async () => { throw new SyntaxError('not JSON'); } });
  await feed.poll();
  feed.timed = async () => { throw new TypeError('no network'); };
  await feed.poll();
  assert.equal(feed.live(1000).cum, 500);
  feed.timed = async () => ({ json: async () => Object.assign({}, good, { measurement: Object.assign({}, good.measurement, { cumulativeWorkUnits: '510' }) }) });
  await feed.poll();
  assert.equal(feed.lastError, null, 'and it recovers');
  assert.equal(feed.live(1000).cum, 510);
});

test('after a reload the wheel state comes from what was read, not from nothing', async () => {
  require(path.join(src, 'core/feed.js'));
  const status = (cum) => ({ measurement: { freshness: 'online', rpmMilli: 0, cumulativeWorkUnits: String(cum) }, builder: { anchor: {} } });
  const hex = (n) => BigInt(n).toString(16).padStart(64, '0');
  const page = (cert, start, rows) => {
    const words = new Array(10).fill(hex(0));
    words[1] = hex(cert);
    words[2] = hex(start);
    words[5] = hex(rows.length ? rows[rows.length - 1][1] : start);
    words[9] = hex(rows.length);
    for (const [r, cum] of rows) words.push(hex(r), hex(cum), hex(0), hex(0), hex(r + 1000));
    return '0x' + words.join('');
  };
  const settledAgo = new WW.LiveFeed({ genesis: 0, core: '0x0', rpcs: [], status: status(150), settled: 12, work: 150 });
  settledAgo.call = async () => page(12, 100, [[11, 150]]);
  await settledAgo.syncFrom(10);
  assert.equal(settledAgo.lastPassAt, 11 * 600000, 'the end of his last active round');
  const ahead = new WW.LiveFeed({ genesis: 0, core: '0x0', rpcs: [], status: status(170), settled: 12, work: 150 });
  ahead.call = async () => page(12, 100, [[11, 150]]);
  await ahead.syncFrom(10);
  assert.equal(ahead.lastPassAt, 12 * 600000, 'passes not settled yet came after all of it');
});

test('a save on the real wheel does not move while it waits for the wheel', () => {
  require(path.join(src, 'core/feed.js'));
  require(path.join(src, 'data/recording.js'));
  const s = fresh(feedOf([0]));
  s.clock.round = 1000;
  s.clock.cum = 90000;
  s.clock.guestN = 9000;
  s.stock = { carrot_coins: 40 };
  const before = JSON.stringify(s);
  const held = new WW.HeldFeed(WW.RECORDING, s.clock);
  const t = held.roundEnd(1200);
  assert.equal(E.advance(s, held, t), null, 'no rounds');
  const events = [];
  const live = E.pulse(s, held, t, events);
  assert.equal(events.length, 0, 'no guests');
  assert.equal(live.state, 'unknown');
  assert.equal(JSON.stringify(s), before);
});

test('a new game counts guests from the wheel as it is now', () => {
  const feed = feedOf([300, 300]);
  feed.live = (t) => ({ state: 'running', rpm: 60, cum: 900, agoMs: 0, round: 3 });
  const s = E.newGame(ROUND * 2, feed);
  assert.equal(s.clock.guestN, 90, 'not from the last settled round');
  const events = [];
  E.pulse(s, feed, ROUND * 2, events);
  assert.equal(events.length, 0, 'no rush of guests on the first look');
});

// A scene without a canvas, for the guests' side of it.
function sceneOf(s, more) {
  require(path.join(src, 'ui/scene.js'));
  const scene = Object.create(WW.Scene.prototype);
  return Object.assign(scene, { game: { s, visit: null, speed: 1, sound() {}, onNewSpecies() {}, isAwake: () => true }, seatUse: new Map(), orders: [], guests: [], parts: [], floats: [], coming: [], comingClock: 0, view: 'in' }, more);
}
const walkingGuest = (more) => Object.assign({ sp: WW.ANIMALS[0], frames: [], res: { served: true, dish: 'carrot_coins', coins: 1 }, speed: 20, fly: false, t: 0, dir: 1, seat: null, local: true, zone: 'out', x: WW.OUTSIDE.DOOR.x, y: WW.OUTSIDE.DOOR.y + 6, state: 'approach', path: [] }, more);

test('with every seat taken guests walk on, and nobody stands in the doorway', () => {
  const s = fresh(feedOf([0]));
  const scene = sceneOf(s);
  for (const seat of E.seatsOf(s)) scene.seatUse.set(seat.x + ',' + seat.y, {});
  const passing = walkingGuest();
  scene.updateGuest(passing, 0.25);
  assert.equal(passing.state, 'depart', 'keeps walking at the turning');
  const late = walkingGuest({ state: 'todoor' });
  scene.updateGuest(late, 0.25);
  assert.equal(late.state, 'turnaway', 'the last seat went while it walked up');
  assert.equal(late.zone, 'out');
  const inside = walkingGuest({ state: 'enter', zone: 'in' });
  scene.updateGuest(inside, 0.25);
  assert.equal(inside.state, 'leave', 'one caught inside turns back at once');
  scene.seatUse.clear();
  const lucky = walkingGuest();
  scene.updateGuest(lucky, 0.25);
  assert.equal(lucky.state, 'todoor');
  scene.updateGuest(lucky, 100);
  assert.equal(lucky.zone, 'in');
  scene.updateGuest(lucky, 0.25);
  assert.equal(lucky.state, 'toseat');
  assert.equal(scene.seatUse.size, 1);
});

test('a guest gets to a closed off seat, eats and goes home', () => {
  const s = fresh(feedOf([0]));
  const { cols, rows } = s.room;
  s.furniture = [{ id: 'cork', x: 0, y: 0 }, { id: 'spool_green', x: 1, y: 0 }];
  for (let y = 0; y < rows; y++) s.furniture.push({ id: 'cork', x: 3, y });
  const scene = sceneOf(s);
  const g = walkingGuest({ state: 'enter', zone: 'in', x: cols * 16 - 32, y: 104 + rows * 16 });
  const states = new Set();
  let atSeat = null;
  for (let i = 0; i < 4000 && !g.dead; i++) {
    scene.updateGuest(g, 0.25);
    states.add(g.state);
    if (g.state === 'waitfood' && !atSeat) atSeat = { x: g.x, y: g.y };
  }
  assert.deepEqual(atSeat, { x: 8, y: WW.WORLD.DINING_Y + 13 }, 'at the seat, not by the door');
  for (const state of ['toseat', 'waitfood', 'eat', 'leave', 'depart']) assert.ok(states.has(state), state);
  assert.ok(g.dead, 'gone home');
  assert.equal(scene.seatUse.size, 0, 'the seat is free again');
});

test('a round of guests strolls up over the round, not all at once', () => {
  const s = fresh(feedOf([0]));
  const shown = [];
  const scene = sceneOf(s, { addGuest: (res) => shown.push({ res, at: clock }) });
  let clock = 0;
  const round = E.capacity(s);
  for (let i = 0; i < round; i++) scene.guestArrives({ served: true });
  const turned = { served: false };
  const fresher = { served: true, isNew: true, species: WW.ANIMALS[0].id };
  scene.guestArrives(turned);
  scene.guestArrives(fresher);
  assert.deepEqual(shown.map((x) => x.res), [turned], 'bad news does not wait, but a new species walks up with the rest, a new game is nearly all new species');
  shown.length = 0;
  for (; clock < 1200 && scene.coming.length; clock += 0.25) scene.updateArrivals(0.25);
  assert.equal(shown.length, round + 1);
  const span = shown[round].at - shown[0].at;
  assert.ok(span > 300 && span < 800, `${round + 1} guests over ${span} s`);

  // A new species dropped from a long line is still announced.
  const heard = [];
  scene.game.onNewSpecies = (sp) => heard.push(sp.id);
  scene.guestArrives(fresher);
  for (let i = 0; i < 80; i++) scene.guestArrives({ served: true });
  assert.equal(scene.coming.length, 80);
  assert.deepEqual(heard, [WW.ANIMALS[0].id]);
});

test('the road outside is never empty, and nobody on it comes in', () => {
  const s = fresh(feedOf([0]));
  const O = WW.OUTSIDE;
  const frames = WW.animalFrames;
  WW.animalFrames = () => [];
  const watch = (cssWidth, service, awake) => {
    const scene = sceneOf(s, { view: 'out', walkers: [], m: O, css: { w: cssWidth, h: 400 }, cams: { out: { x: 400, y: 0, z: 1.5 } } });
    scene.game.isAwake = () => awake;
    let empty = 0;
    let seen = 0;
    const steps = 4800;
    for (let i = 0; i < steps; i++) {
      scene.updateWalkers(0.25, service);
      const inView = scene.walkers.filter((p) => p.x > 400 && p.x < 400 + cssWidth / 1.5).length;
      seen += inView;
      if (!inView) empty++;
      for (const p of scene.walkers) {
        assert.ok(p.x >= -60 && p.x <= O.W + 60, 'stays on the map, friends start a little behind');
        assert.ok(p.y >= O.DOOR.y + 5 && p.y <= O.ROAD_Y + 20, 'on the road or a path to a door');
      }
    }
    assert.equal(scene.guests.length, 0, 'nobody on the road turns into a guest');
    return { empty: empty / steps, seen: seen / steps };
  };
  // A phone at night is the hardest case: a short stretch of road and the fewest animals.
  const phoneNight = watch(390, false, false);
  assert.ok(phoneNight.empty < 0.05, `a phone at night is empty ${phoneNight.empty}`);
  const wideNight = watch(1000, false, false);
  const wideBusy = watch(1000, true, true);
  assert.ok(wideNight.empty < 0.05, `a wide screen at night is empty ${wideNight.empty}`);
  assert.ok(wideBusy.seen > wideNight.seen + 2, `busier when he runs: ${wideBusy.seen} against ${wideNight.seen}`);
  WW.animalFrames = frames;
});

test('the critic only tastes what is on the counter, and the memory dish moves him', () => {
  const s = fresh(feedOf([0]));
  s.critic.memory = 'oat_porridge';
  s.critic.taste = ['nutty', 'earthy'];
  s.critic.picks = ['oat_porridge', 'carrot_coins', 'tossed_peas'];
  s.stock = { oat_porridge: 5, carrot_coins: 5 };
  const v = E.criticVerdict(s);
  assert.deepEqual(v.picks, ['oat_porridge', 'carrot_coins'], 'peas were not on the counter');
  assert.ok(v.stars >= 2, 'the memory dish is worth a lot');
  assert.equal(s.critic.due, false);
});

test('a test kitchen hit teaches the recipe, a miss still costs the try', () => {
  const s = fresh(feedOf([0]));
  s.pantry = { oats: 5, peas: 5, carrot: 5 };
  s.winks = 100;
  const miss = E.experiment(s, ['peas', 'carrot']);
  assert.equal(miss.found, undefined);
  assert.equal(s.winks, 90);
  const hit = E.experiment(s, ['peas', 'oats']);
  assert.equal(hit.found, 'pea_pancakes');
  assert.ok(s.known.pea_pancakes);
});

test('long absences catch up without trouble', () => {
  const rounds = [];
  for (let i = 0; i < 144 * 30; i++) rounds.push(i % 7 === 0 ? 400 : 0);
  const feed = feedOf(rounds);
  const s = fresh(feed);
  s.stock = { carrot_coins: 100 };
  const t0 = Date.now();
  E.advance(s, feed, rounds.length * ROUND);
  assert.ok(Date.now() - t0 < 2000, 'under two seconds');
  assert.ok(s.clock.round === rounds.length);
});

test('an ingredient trade needs the same level or better, and says why', () => {
  assert.equal(E.tradeProblem('apple', 'carrot'), null, 'L3 for L1 is fine');
  assert.equal(E.tradeProblem('carrot', 'peas'), null, 'L1 for L1 is fine');
  assert.match(E.tradeProblem('carrot', 'apple'), /L1.*L3/, 'L1 for L3 is refused with both levels named');
});

test('the room grows, moves the door and bags whatever stood in the new doorway', () => {
  const s = fresh(feedOf([0]));
  s.level = 2;
  s.cash = 9000;
  s.furniture.push({ id: 'cork', x: 11, y: 4 });
  assert.equal(E.expandRoom(s), null);
  assert.deepEqual(s.room, { cols: 14, rows: 5 });
  assert.equal(s.furniture.some((f) => f.x === 11 && f.y === 4), false, 'the stool left the new doorway');
  assert.equal(s.bag.cork, 1);
  assert.equal(E.expandRoom(s), 'Reach level 3 first.');
});

test('appliances work once each, and only while placed', () => {
  const s = fresh(feedOf([0]));
  const base = E.capacity(s);
  s.furniture.push({ id: 'dishwasher', x: 10, y: 0 });
  s.bag = {};
  s.furniture.push({ id: 'dishwasher', x: 10, y: 1 });
  assert.equal(E.fxOf(s).turns, 0.1, 'a second dishwasher adds nothing');
  assert.ok(E.capacity(s) >= base);
});

test('a v1 save comes forward with its restaurant', () => {
  const feed = feedOf([0, 0]);
  const old = JSON.parse(JSON.stringify(fresh(feed)));
  old.v = 1;
  old.buttons = 777;
  old.dream = 44;
  delete old.cash;
  delete old.winks;
  delete old.room;
  delete old.style;
  const up = E.migrate(old);
  assert.equal(up.v, 6);
  assert.deepEqual(up.yard, []);
  assert.deepEqual(up.shelf, []);
  assert.deepEqual(up.mail, []);
  assert.equal(up.cash, 777);
  assert.equal(up.winks, 44);
  assert.deepEqual(up.room, { cols: 12, rows: 5 });
});

test('party orders use stock of the right flavour and pay well', () => {
  const feed = feedOf([0]);
  const s = fresh(feed);
  E.ensureOrders(s, feed, 0);
  const o = s.orders.items[0];
  o.fl = 'sweet';
  o.n = 10;
  s.stock = { carrot_coins: 12 };
  const before = s.cash;
  const r = E.deliverOrder(s, o.id);
  assert.equal(r.cash, o.cash);
  assert.equal(s.cash, before + o.cash);
  assert.equal(s.stock.carrot_coins, 2);
  assert.ok(E.deliverOrder(s, o.id).error, 'cannot deliver twice');
});

test('a neighbour floor can be cleaned spot by spot, once each a day', () => {
  const s = fresh(feedOf([0]));
  const a = E.cleanSpot(s, 'mochi', 0, 0);
  assert.ok(a.cash > 0);
  assert.equal(a.left, 5);
  assert.ok(E.cleanSpot(s, 'mochi', 0, 0).error);
  const home = E.neighbourHome('mochi');
  assert.ok(E.seatsOf(home).length > 0, 'their restaurant has real seats');
  assert.equal(E.neighbourHome('mochi'), home, 'and stays the same');
});

test('a house level counts expansions, from the starting room to the largest', () => {
  assert.deepEqual(E.roomLevel({ cols: 12, rows: 5 }), { level: 1, top: 14 });
  assert.equal(E.roomLevel({ cols: 14, rows: 5 }).level, 2);
  assert.equal(E.roomLevel({ cols: 16, rows: 6 }).level, 4);
  assert.equal(E.roomLevel({ cols: 24, rows: 12 }).level, 14);
  const ladder = [{ cols: 12, rows: 5 }, ...WW.EXPANSIONS];
  for (const n of WW.NEIGHBOURS) {
    const home = E.neighbourHome(n.id);
    assert.ok(ladder.some((e) => e.cols === home.room.cols && e.rows === home.room.rows), n.id + ' sits on a real step');
    assert.ok(E.seatsOf(home).length > 0, n.id + ' has seats');
    assert.ok(E.ratingStars(home) > 0, n.id + ' can be rated');
  }
});

test('a batch preview matches the batch that gets cooked, whoever cooks it', () => {
  const feed = feedOf([0]);
  const s = fresh(feed);
  s.pantry = { carrot: 50, oats: 50, peas: 50 };
  s.known.carrot_coins = { lvl: 3, made: 0 };
  s.furniture.push({ id: 'mixer', x: 10, y: 0 }, { id: 'oven', x: 9, y: 0 });
  s.stations.push({ type: 'stove', job: null, last: null });
  const first = E.batchInfo(s, 'carrot_coins');
  assert.equal(first.chef.role, 'head');
  assert.equal(E.startCook(s, 'carrot_coins', 0, feed, 0), null);
  assert.equal(s.stations[0].job.y, first.y);
  assert.equal(s.stations[0].job.need, first.need);
  assert.ok(first.y > WW.DISH.carrot_coins.y, 'the head chef, the mixer and the recipe level all count');
  const sous = s.staff.find((w) => w.role === 'sous');
  sous.spec = 'stove';
  const second = E.batchInfo(s, 'carrot_coins');
  assert.equal(second.chef.id, sous.id);
  const idx = s.stations.findIndex((x, i) => i > 0 && x.type === 'stove' && !x.job);
  assert.equal(E.startCook(s, 'carrot_coins', idx, feed, 0), null);
  assert.equal(s.stations[idx].job.y, second.y);
  assert.equal(s.stations[idx].job.chef, sous.id);
  assert.notEqual(second.y, first.y, 'a stove specialist makes a different batch from the head chef');
});

test('the price shown for an ingredient is the price paid today', () => {
  const feed = feedOf([0]);
  const s = fresh(feed);
  E.ensureMarket(s, feed, 0);
  s.cash = 100000;
  for (const it of s.market.items) {
    const before = s.cash;
    assert.equal(E.ingredientPrice(s, it.id), it.price);
    assert.equal(E.buyIngredient(s, it.id, 1), null);
    assert.equal(before - s.cash, it.price);
  }
  const absent = WW.INGREDIENTS.find((i) => !s.market.items.some((x) => x.id === i.id));
  assert.equal(E.ingredientPrice(s, absent.id), absent.price);
});

test('the report says what actually reached the wallet', () => {
  const feed = feedOf([100, 0]);
  const s = fresh(feed);
  s.stock = { carrot_coins: 50 };
  s.furniture.push({ id: 'gumball', x: 10, y: 0 });
  s.till = 7;
  const before = s.cash;
  E.advance(s, feed, ROUND);
  const rep = E.takeReport(s);
  assert.equal(s.cash - before, rep.banked);
  assert.ok(rep.banked > rep.earned, 'the till and the machines count too');
});

test('within a kind of decor, paying more always buys something', () => {
  const byKind = {};
  for (const d of WW.DECOR) if (d.kind !== 'found') (byKind[d.kind] = byKind[d.kind] || []).push(d);
  for (const kind in byKind) {
    const list = byKind[kind].slice().sort((a, b) => a.price - b.price);
    for (let i = 1; i < list.length; i++) {
      if (list[i].price === list[i - 1].price) assert.equal(list[i].rating, list[i - 1].rating, list[i].id);
      else assert.ok(list[i].rating > list[i - 1].rating, list[i].id + ' costs more than ' + list[i - 1].id + ' but rates no higher');
    }
  }
  const effects = {};
  for (const d of WW.DECOR) {
    if (!d.fx) continue;
    const key = d.kind + JSON.stringify(d.fx);
    assert.ok(!effects[key], d.id + ' does exactly what ' + effects[key] + ' does');
    effects[key] = d.id;
  }
});

test('each restaurant has its own stall, and better goods are scarce', () => {
  const feed = feedOf([0]);
  const a = E.newGame(0, feed);
  const b = E.newGame(5000, feed);
  a.level = 12;
  b.level = 12;
  E.ensureMarket(a, feed, 0);
  E.ensureMarket(b, feed, 0);
  assert.notDeepEqual(a.market.items.map((i) => i.id), b.market.items.map((i) => i.id));
  const count = (s, tier) => s.market.items.filter((i) => WW.INGREDIENT[i.id].tier === tier);
  assert.equal(count(a, 1).length, 6);
  assert.equal(count(a, 2).length, 3);
  assert.equal(count(a, 3).length, 2);
  assert.equal(count(a, 4).length, 1);
  assert.ok(count(a, 4)[0].left <= 5, 'the best goods come in ones and twos');
  assert.ok(a.market.items.length < WW.INGREDIENTS.length / 2, 'no stall has most of what there is');
});

test('every ingredient is grown by someone on the street', () => {
  const grown = new Set(Object.values(WW.GOODS).flat());
  for (const i of WW.INGREDIENTS) assert.ok(grown.has(i.id), i.id);
});

test('a neighbour shelf runs out, and a locked one can say no', () => {
  const feed = feedOf([0, 0, 0, 0]);
  const s = fresh(feed);
  s.level = 12;
  const unlocked = E.neighbourShelf(s, 'mochi', 0).find((x) => !x.locked) || E.neighbourShelf(s, 'mochi', 0)[0];
  const stock = unlocked.left;
  s.pantry = { chicken: 99 };
  for (let i = 0; i < stock; i++) assert.ok(!E.tradeWith(s, 'mochi', 'chicken', unlocked.id, 0).error);
  assert.equal(E.neighbourShelf(s, 'mochi', 0).find((x) => x.id === unlocked.id).left, 0);
  assert.ok(E.tradeWith(s, 'mochi', 'chicken', unlocked.id, 0).error, 'nothing left to swap');
  s.trades = [{ from: 'mochi', get: 'apple', give: 'pear' }];
  s.pantry = {};
  E.advance(s, feed, ROUND);
  const note = s.mail.find((m) => m.kind === 'note');
  assert.ok(note, 'the answer comes by mail');
  assert.ok((s.pantry.apple || 0) + (s.pantry.pear || 0) === 1, 'either the swap or your own goods back');
});

test('your shelf: unlocked swaps on its own, locked waits in the mailbox', () => {
  const rounds = new Array(1500).fill(0);
  const feed = feedOf(rounds);
  const s = fresh(feed);
  s.pantry = { carrot: 40, apple: 40 };
  assert.equal(E.shelfPut(s, 'carrot', 30), null);
  assert.equal(E.shelfPut(s, 'apple', 30), null);
  assert.equal(s.pantry.carrot, 10);
  assert.equal(E.shelfLock(s, 'apple', true), null);
  E.advance(s, feed, ROUND * 1400);
  const rep = E.takeReport(s);
  assert.ok(rep.swaps.length > 0, 'neighbours swapped for the unlocked carrots');
  for (const sw of rep.swaps) {
    assert.equal(sw.took, 'carrot');
    assert.ok(WW.INGREDIENT[sw.gave].tier >= 1);
  }
  const carrots = s.shelf.find((x) => x.id === 'carrot');
  assert.equal((carrots ? carrots.n : 0), 30 - rep.swaps.length);
  assert.equal(s.shelf.find((x) => x.id === 'apple').n, 30, 'locked goods never leave without your answer');
  const offers = s.mail.filter((m) => m.kind === 'offer');
  assert.ok(offers.length > 0 && offers.length <= WW.CFG.MAIL_MAX);
  for (const o of offers) assert.ok(WW.INGREDIENT[o.give].tier >= WW.INGREDIENT[o.want].tier, 'same level or better');
  const first = offers[0];
  const had = s.pantry[first.give] || 0;
  assert.equal(E.mailAccept(s, first.id), null);
  assert.equal(s.pantry[first.give], had + 1);
  assert.equal(s.shelf.find((x) => x.id === 'apple').n, 29);
  if (offers[1]) {
    E.mailDecline(s, offers[1].id);
    assert.equal(s.shelf.find((x) => x.id === 'apple').n, 29);
    assert.ok(!s.mail.some((m) => m.id === offers[1].id));
  }
  E.shelfTake(s, 'apple', 999);
  assert.ok(!s.shelf.some((x) => x.id === 'apple'));
  assert.ok(!s.mail.some((m) => m.kind === 'offer' && m.want === 'apple'), 'offers go when the goods do');
  assert.ok(E.shelfPut(s, 'apple', 9999), 'you can only hang what you have');
});

test('the shelf has a limited number of spots', () => {
  const s = fresh(feedOf([0]));
  s.pantry = { carrot: 1, peas: 1, oats: 1, basil: 1, parsley: 1 };
  const slots = E.shelfSlots(s);
  const ids = Object.keys(s.pantry);
  for (let i = 0; i < slots; i++) assert.equal(E.shelfPut(s, ids[i], 1), null);
  assert.ok(E.shelfPut(s, ids[slots], 1));
});

test('trees and floors pay money every time and sometimes more', () => {
  const s = fresh(feedOf([0]));
  let finds = 0;
  let treasures = 0;
  let cashEvery = true;
  for (let i = 0; i < 20000; i++) {
    const before = s.cash;
    const r = E.cleanTile(s);
    if (s.cash !== before + 1) cashEvery = false;
    if (r.find) {
      finds++;
      if (WW.DECOR_BY_ID[r.find].find === 'treasure') treasures++;
    }
  }
  assert.ok(cashEvery);
  assert.ok(finds > 400 && finds < 900, 'junk and treasure together about 3%: ' + finds);
  assert.ok(treasures > 2 && treasures < 60, 'treasure is rare: ' + treasures);
  const t = E.shakeTree(s, 0);
  assert.ok(t.cash > 0);
  const n = E.shakeNeighbour(s, 'mochi', 0);
  assert.ok(n.cash > 0);
  const c = E.cleanSpot(s, 'mochi', 0, 0);
  assert.ok(c.cash > 0);
});

test('finds sell for what they say, trophies do not sell', () => {
  const s = fresh(feedOf([0]));
  s.bag = { gold_thimble: 1, trophy_25: 1, cork: 1 };
  const before = s.cash;
  assert.equal(E.sellDecor(s, 'gold_thimble'), null);
  assert.equal(s.cash, before + WW.DECOR_BY_ID.gold_thimble.sell);
  assert.ok(E.sellDecor(s, 'trophy_25'));
  assert.equal(E.sellDecor(s, 'cork'), null);
  assert.equal(s.cash, before + WW.DECOR_BY_ID.gold_thimble.sell + Math.floor(WW.DECOR_BY_ID.cork.price / 2));
  assert.ok(E.sellDecor(s, 'cork'), 'nothing left to sell');
});

test('the leaderboard ranks by level and includes you', () => {
  const s = fresh(feedOf([0]));
  const rows = E.leaderboard(s, 0);
  assert.equal(rows.length, WW.NEIGHBOURS.length + 1);
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].level >= rows[i].level);
  assert.equal(rows.filter((r) => r.me).length, 1);
  s.level = 99;
  assert.ok(E.leaderboard(s, 0)[0].me);
  const later = E.leaderboard(s, 86400000 * 30);
  const mochiThen = rows.find((r) => r.id === 'mochi').level;
  assert.ok(later.find((r) => r.id === 'mochi').level > mochiThen, 'neighbours grow too');
});

test('a very long absence does not replay every guest it missed', () => {
  const rounds = new Array(144 * 30).fill(100);
  const feed = feedOf(rounds);
  const s = fresh(feed);
  E.advance(s, feed, ROUND * (144 * 30));
  assert.equal(s.clock.round, 144 * 30);
  assert.equal(s.clock.guestN, Math.floor(s.clock.cum / 10));
});

test('two recipes with the same ingredients can both be found', () => {
  const s = fresh(feedOf([0]));
  s.level = 2;
  s.winks = 100;
  s.pantry = { sweetpotato: 9 };
  assert.equal(E.experiment(s, ['sweetpotato']).found, 'sweet_mash', 'the one this level can make');
  assert.equal(E.experiment(s, ['sweetpotato']).levelLock, 3, 'the other one waits for its level');
  s.level = 3;
  assert.equal(E.experiment(s, ['sweetpotato']).found, 'sweet_chips');
  assert.ok(E.experiment(s, ['sweetpotato']).again);
  delete s.known.oat_biscuits;
  s.pantry.oats = 3;
  assert.equal(E.experiment(s, ['oats']).found, 'oat_biscuits', 'even when the first of them is already known');
});

test('the wink bank holds at its ceiling even with a dream catcher', () => {
  const feed = feedOf(new Array(50).fill(0));
  const s = fresh(feed);
  s.furniture.push({ id: 'dream_catcher', x: 10, y: 0 });
  s.winks = WW.CFG.WINK_BANK - 3;
  E.advance(s, feed, ROUND * 50);
  assert.equal(s.winks, WW.CFG.WINK_BANK);
});

// The world outside

test('yard pieces stand only on free tiles, and go back to the bag', () => {
  const s = fresh(feedOf([0]));
  const M = WW.OUTSIDE.MID;
  s.bag.fountain = 1;
  s.bag.daisy_patch = 2;
  assert.ok(E.placeDecor(s, 'daisy_patch', 3, 15), 'not on the road');
  assert.ok(E.placeDecor(s, 'daisy_patch', M + 12, 13), 'not on the path to the door');
  assert.ok(E.placeDecor(s, 'daisy_patch', M + 6, 13), 'not under the shake tree');
  assert.ok(E.placeDecor(s, 'daisy_patch', 16, 13), 'not under the leaderboard');
  assert.ok(E.placeDecor(s, 'daisy_patch', 3, 3), 'not in the forest');
  assert.ok(E.placeDecor(s, 'fountain', 64, 18), 'a big piece must fit whole');
  assert.equal(E.placeDecor(s, 'fountain', 3, 18), null);
  assert.ok(E.placeDecor(s, 'daisy_patch', 4, 19), 'not on top of another piece');
  assert.equal(E.placeDecor(s, 'daisy_patch', 8, 18), null);
  assert.equal(s.yard.length, 2);
  assert.equal(s.furniture.filter((f) => f.id === 'fountain').length, 0, 'the room is left alone');
  const piece = s.yard.find((f) => f.id === 'daisy_patch');
  assert.ok(E.moveDecor(s, piece, 3, 15));
  assert.equal(E.moveDecor(s, piece, 9, 18), null);
  assert.equal(piece.x, 9);
  E.storeDecor(s, piece);
  assert.equal(s.bag.daisy_patch, 2);
  assert.equal(s.yard.length, 1);
  // The lawns either side have room too.
  assert.equal(E.placeDecor(s, 'daisy_patch', 5, 10), null);
  assert.equal(E.placeDecor(s, 'daisy_patch', 50, 10), null);
});

test('lamps and props keep their tiles, and every big piece has somewhere to go', () => {
  const O = WW.OUTSIDE;
  for (const [x, y] of O.LAMPS) assert.equal(O.free(Math.floor(x / 16), Math.floor(y / 16)), false);
  for (const r of [O.TREE, O.BOARD, O.MAILBOX, O.SHELF, O.RANKS]) {
    const base = Math.floor((r.y + r.h - 1) / 16);
    for (let c = Math.floor(r.x / 16); c <= Math.floor((r.x + r.w - 1) / 16); c++) assert.equal(O.free(c, base), false, `tile ${c},${base}`);
  }
  const s = fresh(feedOf([0]));
  for (const d of WW.DECOR.filter((x) => x.kind === 'yard')) assert.equal(E.canPlace(s, d.id, 2, 17), null, d.id);
});

test('the yard has rising prices and charm', () => {
  const yard = WW.DECOR.filter((d) => d.kind === 'yard').sort((a, b) => a.price - b.price);
  assert.ok(yard.length >= 20);
  for (let i = 1; i < yard.length; i++) {
    assert.ok(yard[i].charm > yard[i - 1].charm, yard[i].id + ' charm');
    assert.ok(yard[i].rating > yard[i - 1].rating, yard[i].id + ' rating');
    assert.ok(yard[i].lvl >= yard[i - 1].lvl, yard[i].id + ' level');
  }
});

test('building parts cost once, stay yours, and add rating and charm while in use', () => {
  const s = fresh(feedOf([0]));
  const rating = E.ratingPoints(s);
  assert.equal(E.charmOf(s), 0);
  s.cash = 700;
  assert.ok(E.buyExterior(s, 'wall', 'planks'), 'level comes first');
  s.level = 2;
  assert.equal(E.buyExterior(s, 'wall', 'planks'), null);
  assert.equal(s.cash, 100);
  assert.equal(s.exterior.wall, 'planks');
  assert.ok(E.ratingPoints(s) > rating);
  assert.equal(E.charmOf(s), WW.EXTERIOR.wall.planks.charm);
  assert.equal(E.buyExterior(s, 'wall', 'plaster'), null, 'the free one is always there');
  assert.equal(E.charmOf(s), 0);
  assert.equal(E.buyExterior(s, 'wall', 'planks'), null, 'going back is free');
  assert.equal(s.cash, 100);
  assert.ok(E.buyExterior(s, 'wall', 'nonsense'));
  s.level = 99;
  assert.ok(E.buyExterior(s, 'roof', 'gold'), 'cash still counts');
  assert.equal(s.exterior.roof, 'thatch');
});

test('charm: only the first of a kind counts, and it stops at half again as many guests', () => {
  const s = fresh(feedOf([0]));
  s.yard.push({ id: 'daisy_patch', x: 1, y: 17 });
  const one = E.charmOf(s);
  assert.equal(one, WW.DECOR_BY_ID.daisy_patch.charm);
  s.yard.push({ id: 'daisy_patch', x: 2, y: 17 });
  assert.equal(E.charmOf(s), one, 'a second daisy patch adds nothing');
  s.yard = WW.DECOR.filter((d) => d.kind === 'yard').map((d, i) => ({ id: d.id, x: i, y: 17 }));
  for (const slot in WW.EXTERIOR) s.exterior[slot] = Object.keys(WW.EXTERIOR[slot]).pop();
  assert.ok(E.attractOf(s) <= 0.5 + 1e-9);
  assert.ok(E.attractOf(s) > 0.49, 'everything bought reaches the top');
  s.yard = [{ id: 'daisy_patch', x: 1, y: 17 }];
  s.exterior = Object.assign({}, WW.EXTERIOR_DEFAULT);
  const small = E.attractOf(s);
  assert.ok(small > 0 && small < 0.01, 'a daisy patch is a start');
  s.yard = WW.DECOR.filter((d) => d.kind === 'yard').slice(0, 16).map((d, i) => ({ id: d.id, x: i, y: 17 }));
  assert.ok(E.attractOf(s) > 0.06, 'the first dozen pieces make a real difference');
});

test('charm brings more guests for the same running', () => {
  const rounds = new Array(144).fill(100);
  const run = (attract) => {
    const feed = feedOf(rounds);
    const s = fresh(feed);
    s.stock = { carrot_coins: 100000 };
    if (attract) s.yard = WW.DECOR.filter((d) => d.kind === 'yard').map((d, i) => ({ id: d.id, x: i, y: 17 }));
    E.advance(s, feed, ROUND * 144);
    const rep = E.takeReport(s);
    return rep.served + rep.soldOut + rep.full + rep.tired;
  };
  const plain = run(false);
  const charmed = run(true);
  assert.ok(plain > 0);
  assert.ok(charmed > plain * 1.1, `${charmed} against ${plain}`);
  assert.ok(charmed <= plain * 1.55, `${charmed} against ${plain}`);
});

test('seasons turn every week and weather always fits the season', () => {
  const ids = Object.keys(WW.SEASONS);
  const dayRounds = 144;
  for (let week = 0; week < 8; week++) {
    const r = 1 + week * WW.SEASON_DAYS * dayRounds;
    assert.equal(E.seasonOf(r).id, ids[week % 4]);
    assert.equal(E.seasonOf(r).day, 1);
    assert.equal(E.seasonOf(r + WW.SEASON_DAYS * dayRounds - 1).id, ids[week % 4], 'the last round of the week');
    assert.equal(E.seasonOf(r + WW.SEASON_DAYS * dayRounds - 1).day, WW.SEASON_DAYS);
  }
  const seen = {};
  for (let r = 1; r < 144 * 28 * 2; r += 18) {
    const season = E.seasonOf(r).id;
    const w = E.weatherOf(r);
    assert.ok(WW.SEASONS[season].weather.some(([id]) => id === w), `${w} in ${season}`);
    assert.ok(WW.WEATHER[w], w);
    seen[w] = (seen[w] || 0) + 1;
    assert.equal(E.weatherOf(r), w, 'the same round always has the same weather');
  }
  for (const id in WW.WEATHER) assert.ok(seen[id], id + ' should turn up');
  for (const id in WW.SEASONS) {
    const sum = WW.SEASONS[id].weather.reduce((a, [, odds]) => a + odds, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, id + ' odds add up');
  }
  assert.equal(E.weatherOf(1), E.weatherOf(18), 'it holds for three hours');
});

test('rain and the season both raise what a guest pays', () => {
  const find = (pick) => {
    for (let r = 2; r < 144 * 28; r++) if (pick(r)) return r;
    return null;
  };
  const clearSpring = find((r) => E.seasonOf(r).id === 'spring' && E.weatherOf(r) === 'clear');
  const rainySpring = find((r) => E.seasonOf(r).id === 'spring' && E.weatherOf(r) === 'rain');
  const clearSummer = find((r) => E.seasonOf(r).id === 'summer' && E.weatherOf(r) === 'clear');
  const fresh_ = WW.DISHES.find((d) => d.fl.includes('fresh') && !d.fl.includes('tangy'));
  assert.equal(E.skyTips(fresh_, clearSpring), 0.1, 'a fresh dish in spring');
  assert.equal(E.skyTips(fresh_, clearSummer), 0, 'the same dish out of season');
  assert.ok(Math.abs(E.skyTips(fresh_, rainySpring) - 0.15) < 1e-9, 'in season and raining');
  // The same guest on the same round, so only the weather changes what they pay.
  const pay = () => {
    const rounds = new Array(clearSpring).fill(0);
    rounds[clearSpring - 1] = 100;
    const feed = feedOf(rounds);
    const s = fresh(feed, ROUND * (clearSpring - 1));
    s.stock = { [fresh_.id]: 100 };
    const start = s.stats.earned;
    E.advance(s, feed, ROUND * clearSpring);
    return s.stats.earned - start;
  };
  const plain = pay();
  WW.WEATHER.clear.tips = 1;
  const boosted = pay();
  WW.WEATHER.clear.tips = 0;
  assert.ok(plain > 0);
  assert.ok(boosted > plain * 1.3, `${boosted} against ${plain}`);
});

test('the street shows five different neighbours, with real buildings, the same all day', () => {
  const feed = feedOf([0]);
  const s = fresh(feed);
  const t = ROUND * 144 * 3;
  const lots = E.streetLots(s, t);
  assert.equal(lots.length, 5);
  assert.equal(new Set(lots.map((l) => l.id)).size, 5);
  const spots = new Set();
  for (const lot of lots) {
    assert.ok(WW.NEIGHBOUR[lot.id]);
    const base = WW.STREET.lots.find((b) => b.y === lot.y && Math.abs(b.x - lot.x) <= 12);
    assert.ok(base, `${lot.x},${lot.y} is on a lot`);
    spots.add(base.x + ',' + base.y);
    for (const slot in WW.EXTERIOR) assert.ok(WW.EXTERIOR[slot][lot.ext[slot]], slot);
  }
  assert.equal(spots.size, 5, 'no two houses on one lot');
  assert.deepEqual(E.streetLots(s, t + ROUND), lots, 'the same all day');
  assert.equal(E.moveStreet(s, t), null);
  const other = E.streetLots(s, t).map((l) => l.id);
  assert.equal(other.filter((id) => lots.some((l) => l.id === id)).length, 0, 'the other five');
  s.streetMoves = { day: null, n: 0 };
  const later = E.streetLots(s, t + ROUND * 144);
  assert.notDeepEqual(later.map((l) => l.x + l.id), lots.map((l) => l.x + l.id), 'a new day moves them');
});

test('another street three times a day, and no more', () => {
  const feed = feedOf([0]);
  const s = fresh(feed);
  const t = ROUND * 144 * 3;
  assert.equal(E.streetMovesLeft(s, t), 3);
  const seen = [JSON.stringify(E.streetLots(s, t))];
  for (let i = 2; i >= 0; i--) {
    assert.equal(E.moveStreet(s, t + i), null);
    assert.equal(E.streetMovesLeft(s, t), i);
    const now = JSON.stringify(E.streetLots(s, t));
    assert.ok(!seen.includes(now), 'each street is a new one');
    seen.push(now);
  }
  assert.ok(E.moveStreet(s, t), 'the fourth is refused');
  assert.equal(E.streetMovesLeft(s, t), 0);
  const tomorrow = t + ROUND * 144;
  assert.equal(E.streetMovesLeft(s, tomorrow), 3, 'a new day, three more');
  assert.equal(E.moveStreet(s, tomorrow), null);
  assert.equal(E.streetMovesLeft(s, tomorrow), 2);
});

test('every building part has a painter and works with every room size and season', () => {
  require(path.join(src, 'art/outside.js'));
  require(path.join(src, 'art/houses.js'));
  // Enough of a canvas for the painters to finish.
  const canvas = () => ({ width: 0, height: 0, getContext: () => ({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) });
  const had = globalThis.document;
  globalThis.document = { createElement: canvas };
  try {
    const rooms = [{ cols: 12, rows: 5 }, { cols: 18, rows: 8 }, { cols: 24, rows: 12 }];
    for (const slot of Object.keys(WW.EXTERIOR)) {
      assert.ok(WW.PART_ART[slot], slot + ' has painters');
      for (const id of Object.keys(WW.EXTERIOR[slot])) {
        assert.ok(WW.PART_ART[slot][id], `${slot} ${id} has a painter`);
        for (const room of rooms) {
          const art = WW.paintHouse(Object.assign({}, WW.EXTERIOR_DEFAULT, { [slot]: id }), room, room.cols === 24 ? 'winter' : 'summer');
          assert.ok(art.H > room.rows * 6, `${slot} ${id}`);
          for (const g of art.windows) assert.ok(Number.isFinite(g.x + g.y + g.w + g.h), `${slot} ${id} windows`);
        }
      }
    }
    for (const look of WW.HOUSE_LOOKS) {
      for (const slot in look) assert.ok(WW.EXTERIOR[slot][look[slot]], `${slot} ${look[slot]}`);
      for (const room of rooms) WW.paintHouse(Object.assign({}, WW.EXTERIOR_DEFAULT, look), room, 'autumn');
    }
  } finally {
    globalThis.document = had;
  }
});

test('within each part, dearer means later and counts for more', () => {
  for (const slot of Object.keys(WW.EXTERIOR)) {
    const list = Object.values(WW.EXTERIOR[slot]).sort((a, b) => a.price - b.price);
    assert.equal(list[0].price, 0, slot + ' starts free');
    assert.ok(list.length >= 6, slot + ' has real choice');
    for (let i = 1; i < list.length; i++) {
      assert.ok(list[i].price > list[i - 1].price, list[i].n + ' price');
      assert.ok(list[i].lvl >= list[i - 1].lvl, list[i].n + ' level');
      assert.ok(list[i].charm > list[i - 1].charm, list[i].n + ' charm');
      assert.ok(list[i].rating > list[i - 1].rating, list[i].n + ' rating');
    }
  }
  assert.ok(Object.keys(WW.EXTERIOR).length >= 8, 'more categories than the first four');
});

test('the carousel pays less than the dining room, and only so much a day', () => {
  const s = fresh(feedOf([0]));
  s.level = 10;
  s.known.carrot_coins = { lvl: 1, made: 0 };
  s.stock = { carrot_coins: 5000 };
  const def = E.dishDef('carrot_coins');
  const price = E.dishPrice(s, def);
  const first = E.lineServe(s, 'carrot_coins', 0, false, 0);
  assert.ok(first <= Math.ceil(price * 0.5), 'half the menu price with no combo');
  const best = E.lineServe(s, 'carrot_coins', 50, false, 0);
  assert.ok(best <= Math.ceil(price), 'never more than the menu price');
  let guard = 0;
  while (E.lineTipsLeft(s, 0) > 0 && guard++ < 5000) assert.ok(E.lineServe(s, 'carrot_coins', 50, false, 0) > 0);
  assert.equal(s.line.tips, E.lineCap(s), 'tips stop exactly at the limit');
  const stock = s.stock.carrot_coins;
  assert.equal(E.lineServe(s, 'carrot_coins', 50, false, 0), null, 'nothing more today');
  assert.equal(s.stock.carrot_coins, stock, 'and no plate is wasted');
  const tomorrow = ROUND * 144 * 2;
  assert.ok(E.lineTipsLeft(s, tomorrow) > 0, 'a new day, a new limit');
});

test('a day of parties stays a treat, and the ledger knows where money came from', () => {
  const rounds = new Array(144).fill(0);
  const feed = feedOf(rounds);
  for (const level of [1, 5, 10, 20, 30, 40]) {
    const s = fresh(feed);
    s.level = level;
    const o = E.ensureOrders(s, feed, 0);
    for (const it of o.items) {
      assert.ok(it.n >= 3 && it.n <= Math.ceil((4 + level * 1.1) * 1.4) + 1, `level ${level}: ${it.n} portions`);
      assert.ok(it.cash / it.n <= 11 * 3 + 1, `level ${level}: ${it.cash / it.n} a portion`);
    }
    // A day of three parties is worth less than a day of guests at any level, going by what the bot measures.
    const day = o.items.reduce((a, it) => a + it.cash, 0);
    assert.ok(day < 300 + level * 200, `level ${level}: ${day} cash a day`);
  }
  const s = fresh(feed);
  s.stock = { carrot_coins: 500 };
  const before = s.cash;
  const tree = E.shakeTree(s, 0);
  assert.equal(s.cash - before, tree.cash + (tree.coins || 0));
  assert.equal(s.stats.by.chores, tree.cash);
});

test('side jobs pay little, and machines pay a fixed amount only on rounds he runs', () => {
  const s = fresh(feedOf([0]));
  for (const level of [1, 10, 30]) {
    s.level = level;
    assert.ok(E.spotReward(s) <= 3 + level / 4, `a dirty spot at level ${level}`);
  }
  const passive = WW.DECOR.filter((d) => d.fx && d.fx.passive);
  assert.equal(passive.reduce((a, d) => a + d.fx.passive, 0), 27);
  for (const d of passive) assert.ok(d.price / (d.fx.passive * 24) >= 8, `${d.id} takes more than a week to pay for itself`);
  const run = (work) => {
    const feed = feedOf([work]);
    const t = fresh(feed);
    t.furniture.push({ id: 'ice_cart', x: 0, y: 0 });
    E.advance(t, feed, ROUND);
    return t.stats.by ? t.stats.by.machines || 0 : 0;
  };
  assert.equal(run(50), 15, 'a round he runs');
  assert.equal(run(0), 0, 'a round he rests');
});

test('stars tip half the menu price at most, and better dishes leave a thinner margin', () => {
  const s = fresh(feedOf([0]));
  for (const d of WW.DECOR) if (!d.find && !d.festival) s.furniture.push({ id: d.id, x: 0, y: 0 });
  assert.ok(E.ratingStars(s) > 4, 'a room with one of everything');
  const fromDecor = WW.DECOR.reduce((a, d) => a + ((d.fx && d.fx.tips) || 0), 0);
  assert.ok(E.tipFactor(s) <= 0.5 + fromDecor + 1e-9);
  const share = (d) => Object.keys(d.ing).reduce((a, k) => a + WW.INGREDIENT[k].price * d.ing[k], 0) / (d.y * d.p);
  for (const d of WW.DISHES) assert.ok(share(d) >= 0.2 && share(d) <= 0.6, `${d.id}: ingredients are ${Math.round(share(d) * 100)}% of a batch`);
  for (let i = 0; i < WW.DREAMS.length; i++) {
    for (const key of [`d:${i}`, `d:${i}:g`]) assert.ok(share(E.dishDef(key)) <= 0.6, `${key}: leaves a profit`);
  }
  const mean = (list) => list.reduce((a, d) => a + share(d), 0) / list.length;
  assert.ok(mean(WW.DISHES.filter((d) => d.lvl >= 7)) > mean(WW.DISHES.filter((d) => d.lvl <= 2)) + 0.1);
  // A later recipe that takes at least as long always leaves more, or nobody would want it.
  const profit = (d) => d.y * d.p - Object.keys(d.ing).reduce((a, k) => a + WW.INGREDIENT[k].price * d.ing[k], 0);
  for (const a of WW.DISHES) {
    for (const b of WW.DISHES) {
      if (a.st === b.st && b.lvl > a.lvl && b.need >= a.need) assert.ok(profit(b) > profit(a), `${b.id} leaves ${profit(b)}, ${a.id} leaves ${profit(a)}`);
    }
  }
});

test('every tune adds up, bar by bar, in its key', () => {
  require(path.join(src, 'ui/music.js'));
  const { TUNES, compile, midi, chordOf } = WW.MUSIC;
  assert.deepEqual(Object.keys(TUNES).sort(), ['in', 'out', 'street']);
  for (const name in TUNES) {
    const tune = TUNES[name];
    assert.equal(tune.melody.length, tune.chords.length, name + ' has a chord for every bar');
    const scale = new Set(tune.key.map((k) => midi(k + '4') % 12));
    tune.melody.forEach((bar, b) => {
      let beats = 0;
      for (const token of bar.split(' ')) {
        const [note, len] = token.split(':');
        beats += Number(len);
        if (note !== 'r') assert.ok(scale.has(midi(note) % 12), `${name} bar ${b + 1}: ${note} is in the key`);
      }
      assert.equal(beats, tune.meter, `${name} bar ${b + 1} adds up`);
    });
    for (const c of tune.chords) for (const n of chordOf(c).notes) assert.ok(scale.has(n % 12), `${name}: ${c} is in the key`);
    const plan = compile(tune);
    assert.equal(plan.beats, tune.chords.length * tune.meter);
    assert.ok(plan.events.every((e) => e.beat >= 0 && e.beat < plan.beats), name + ' stays inside the loop');
    // At least half the notes on the first beat of a bar belong to its chord, so the tune sits on the harmony.
    let on = 0;
    tune.melody.forEach((bar, b) => {
      const first = midi(bar.split(':')[0]) % 12;
      if (chordOf(tune.chords[b]).notes.some((n) => n % 12 === first)) on++;
    });
    assert.ok(on >= tune.melody.length * 0.7, `${name}: ${on} of ${tune.melody.length}`);
    const secs = plan.beats * plan.secPerBeat;
    assert.ok(secs > 25 && secs < 90, `${name} loops every ${secs} seconds`);
    assert.ok(tune.bpm <= 110, name + ' stays gentle');
  }
});

test('neighbours only have building parts their level allows, and improve as weeks pass', () => {
  const feed = feedOf([0]);
  const s = fresh(feed);
  let changed = 0;
  for (const n of WW.NEIGHBOURS) {
    const a = E.neighbourExterior(s, n.id, ROUND);
    const later = ROUND * 144 * 200;
    const b = E.neighbourExterior(s, n.id, later);
    for (const slot in a) {
      assert.ok(WW.EXTERIOR[slot][a[slot]].lvl <= E.neighbourLevel(s, n.id, ROUND), `${n.id} ${slot}`);
      assert.ok(WW.EXTERIOR[slot][b[slot]].lvl <= E.neighbourLevel(s, n.id, later), `${n.id} ${slot}`);
    }
    if (JSON.stringify(a) !== JSON.stringify(b)) changed++;
    assert.deepEqual(E.neighbourExterior(s, n.id, ROUND), a, 'the same until they grow');
  }
  assert.ok(changed >= WW.NEIGHBOURS.length / 2, `${changed} changed`);
});

test('an old save gets a yard, a plain building and keeps everything else', () => {
  const feed = feedOf([0]);
  const s = fresh(feed);
  const old = JSON.parse(JSON.stringify(s));
  old.v = 3;
  delete old.yard;
  delete old.exterior;
  delete old.exteriors;
  delete old.streetMoves;
  old.cash = 1234;
  old.furniture.push({ id: 'cork', x: 0, y: 0 });
  const up = E.migrate(old);
  assert.equal(up.v, 6);
  assert.deepEqual(up.yard, []);
  assert.deepEqual(up.exterior, WW.EXTERIOR_DEFAULT);
  assert.deepEqual(up.exteriors, {});
  assert.deepEqual(up.streetMoves, { day: null, n: 0 });
  assert.ok(!('streetPage' in up));
  assert.equal(up.cash, 1234);
  assert.equal(up.furniture.filter((f) => f.id === 'cork').length, s.furniture.filter((f) => f.id === 'cork').length + 1);
});

test('what stood in the yard moves along with the wider map', () => {
  const feed = feedOf([0]);
  const s = fresh(feed);
  const old = JSON.parse(JSON.stringify(s));
  old.v = 4;
  old.yard = [{ id: 'fountain', x: 3, y: 18 }, { id: 'daisy_patch', x: 1, y: 13 }];
  old.exterior = { wall: 'brick', roof: 'blue', awning: 'gold', trim: 'lights' };
  old.streetPage = 3;
  delete old.streetMoves;
  const up = E.migrate(old);
  assert.equal(up.v, 6);
  assert.deepEqual(up.yard, [{ id: 'fountain', x: 3 + WW.OUTSIDE.MID, y: 18 }, { id: 'daisy_patch', x: 1 + WW.OUTSIDE.MID, y: 13 }]);
  for (const f of up.yard) {
    const d = WW.DECOR_BY_ID[f.id];
    for (let j = f.y; j < f.y + d.h; j++) for (let i = f.x; i < f.x + d.w; i++) assert.ok(WW.OUTSIDE.free(i, j), `${f.id} at ${i},${j}`);
  }
  assert.equal(up.exterior.wall, 'brick', 'the look they chose stays');
  assert.equal(up.exterior.door, 'plank', 'new parts start plain');
  assert.ok(!('style' in up.exterior));
  assert.ok(!('streetPage' in up));
});

test('whole houses bought in the last build are paid back, and the chimney moves up', () => {
  const s = fresh(feedOf([0]));
  const old = JSON.parse(JSON.stringify(s));
  old.v = 5;
  old.cash = 100;
  old.exterior = { style: 'hanok', wall: 'brick', roof: 'blue', awning: 'none', trim: 'chimney' };
  old.exteriors = { 'style:hanok': true, 'style:yurt': true, 'wall:brick': true, 'trim:chimney': true };
  const up = E.migrate(old);
  assert.equal(up.v, 6);
  assert.equal(up.cash, 100 + 11000 + 1800);
  assert.ok(!Object.keys(up.exteriors).some((k) => k.startsWith('style:')));
  assert.ok(up.exteriors['wall:brick']);
  assert.equal(up.exterior.crown, 'chimney');
  assert.equal(up.exterior.trim, 'none');
  assert.ok(up.exteriors['crown:chimney']);
  for (const slot of Object.keys(WW.EXTERIOR)) assert.ok(WW.EXTERIOR[slot][up.exterior[slot]], slot);
});
