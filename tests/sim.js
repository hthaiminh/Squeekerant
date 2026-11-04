// Plays the game with a simple bot over the hamster's real recorded rounds, looped.
// Usage: node tests/sim.js [days] [visits per day] [busy], busy also works every neighbour, plays On the Line each day and buys the machines first
const assert = require('assert');
const path = require('path');
const src = path.join(__dirname, '..', 'src');
for (const f of ['core/rng.js', 'art/px.js', 'art/scene.js', 'data/recording.js', 'data/animals.js', 'data/food.js', 'data/outside.js', 'data/decor.js', 'core/feed.js', 'core/engine.js']) require(path.join(src, f));
const WW = globalThis.WW;
const E = WW.Engine;

const DAY = 86400000;
const days = Number(process.argv[2] || 30);
const visits = Number(process.argv[3] || 1);
const busy = process.argv[4] === 'busy';

// What the bot pays for ingredients. Cooking has to cost something.
let ingredients = 0;
for (const k of ['buyMissing', 'buyIngredient']) {
  const call = E[k];
  E[k] = (s, ...rest) => {
    const before = s.cash;
    const r = call(s, ...rest);
    ingredients += before - s.cash;
    return r;
  };
}

// Swaps whatever is plentiful for what a dish lacks, from whoever on the street has it out.
function tradeFor(s, def, t) {
  for (const id in def.ing) {
    let need = def.ing[id] - (s.pantry[id] || 0);
    if (need <= 0) continue;
    if (s.market && s.market.items.some((x) => x.id === id && x.left >= need)) continue;
    const tier = WW.INGREDIENT[id].tier;
    for (const n of E.whoHas(s, id, t)) {
      while (need > 0) {
        const item = E.neighbourShelf(s, n.id, t).find((x) => x.id === id);
        if (!item || item.left < 1) break;
        const give = Object.keys(s.pantry).filter((k) => !def.ing[k] && s.pantry[k] > 0 && WW.INGREDIENT[k].tier >= tier).sort((a, b) => WW.INGREDIENT[a].tier - WW.INGREDIENT[b].tier || s.pantry[b] - s.pantry[a])[0];
        if (!give) return;
        const r = E.tradeWith(s, n.id, give, id, t);
        if (r.error) break;
        trades++;
        if (r.done) need--;
        else break;
      }
    }
  }
}

function cookBest(s, st, i, feed, t) {
  // Choose the known dish with the most value it can supply, from the stall or by trading.
  const known = Object.keys(s.known).map((k) => WW.DISH[k]).filter((d) => d && d.st === st.type).sort((a, b) => b.y * b.p - a.y * a.p);
  for (const def of known) {
    if (st.type !== 'pot' && !E.batchInfo(s, def.id).chef) return false;
    if (visits > 0) tradeFor(s, def, t);
    const cost = E.missingCost(s, def);
    if (cost === null || cost > s.cash) continue;
    E.buyMissing(s, def);
    if (!E.startCook(s, def.id, i, feed, t)) return true;
  }
  return false;
}

function findSpot(s) {
  for (let y = 0; y < s.room.rows; y++) {
    for (let x = 1; x < s.room.cols - 1; x++) {
      if (!E.canPlace(s, 'spool_green', x, y) && !E.canPlace(s, 'cork', x - 1, y) && !E.canPlace(s, 'cork', x + 1, y)) return { x, y };
    }
  }
  return null;
}
function findDecorSpot(s, id) {
  for (let y = s.room.rows - 1; y >= 0; y--) {
    for (let x = 0; x < s.room.cols; x++) if (!E.canPlace(s, id, x, y)) return { x, y };
  }
  return null;
}

let trades = 0;
let finds = 0;
const firsts = {};
const mark = (name, d) => {
  if (firsts[name] === undefined) firsts[name] = d;
};

function findYardSpot(s, id) {
  for (let y = 18; y <= 22; y++) for (let x = 1; x <= 64; x++) if (!E.canPlace(s, id, x, y)) return { x, y };
  for (let y = 8; y <= 14; y++) for (let x = 1; x <= 64; x++) if (!E.canPlace(s, id, x, y)) return { x, y };
  return null;
}

function visit(s, feed, t, day) {
  E.advance(s, feed, t);
  const rep = E.takeReport(s);
  E.ensureMarket(s, feed, t);
  E.ensureOrders(s, feed, t);
  for (;;) {
    const r = E.shakeTree(s, t);
    if (!r) break;
    if (r.find) finds++;
  }
  // Works the street: three neighbours a visit, or all of them when busy.
  for (const n of busy ? WW.NEIGHBOURS : WW.NEIGHBOURS.slice(day % 8, day % 8 + 3)) {
    E.visitFirst(s, n.id, t);
    for (let spot = 0; spot < 6; spot++) {
      const r = E.cleanSpot(s, n.id, spot, t);
      if (r.find) finds++;
    }
    const r = E.shakeNeighbour(s, n.id, t);
    if (r.find) finds++;
  }
  // Holds food back for what is coming: parties and the carousel, at about what the ingredients cost.
  const holdBack = (fl, n) => {
    const known = Object.keys(s.known).map((k) => WW.DISH[k]).filter((d) => d && (!fl || d.fl.includes(fl))).sort((a, b) => b.p - a.p)[0];
    if (!known) return false;
    const price = Object.entries(known.ing).reduce((a, [k, q]) => a + WW.INGREDIENT[k].price * q, 0) / known.y;
    if (s.cash < price * n) return false;
    s.cash -= Math.ceil(price * n);
    ingredients += Math.ceil(price * n);
    s.stock[known.id] = (s.stock[known.id] || 0) + n;
    return true;
  };
  if (busy) {
    if (!E.inStock(s).length) holdBack(null, 6);
    for (const it of s.orders.items) if (!it.done && E.orderStock(s, it) < it.n) holdBack(it.fl, it.n - E.orderStock(s, it));
    holdBack(null, 40);
    // Turns On the Line until the day's tips are used up, with the combo building to its best.
    for (let combo = 0; combo < 200 && E.lineTipsLeft(s, t) > 0; combo++) {
      const keys = E.inStock(s).sort((a, b) => E.dishDef(b).p - E.dishDef(a).p);
      if (keys.length) E.lineServe(s, keys[0], combo % 30, false, t);
    }
  }
  // Junk goes straight to the shop, treasure too, this bot is not sentimental.
  for (const id of Object.keys(s.bag)) if (WW.DECOR_BY_ID[id].find) while (s.bag[id] > 0) E.sellDecor(s, id);
  // Hangs spare low level goods out for swapping.
  for (const id of Object.keys(s.pantry)) if (s.pantry[id] > 30 && WW.INGREDIENT[id].tier === 1) E.shelfPut(s, id, 5);
  const quiz = E.quizFor(s, feed, t);
  if (quiz) E.answerQuiz(s, quiz, quiz.answer, t);
  for (const it of s.orders.items) if (!it.done && E.orderStock(s, it) >= it.n) E.deliverOrder(s, it.id);
  // Dream dish first, then whatever pays best.
  if (s.dreamDish && s.winks >= WW.CFG.DREAM_DISH_COST) {
    const def = E.dishDef(s.dreamDish.key);
    const idx = s.stations.findIndex((st) => !st.job && st.type === def.st);
    const cost = E.missingCost(s, def);
    if (idx >= 0 && cost !== null && cost <= s.cash) {
      E.buyMissing(s, def);
      E.startCook(s, def.id, idx, feed, t);
    }
  }
  s.stations.forEach((st, i) => {
    if (!st.job) cookBest(s, st, i, feed, t);
  });
  // Keep working capital for tomorrow's ingredients, then grow.
  const reserve = () => 150 + s.level * 120;
  // Saves up for the next station, or the room it needs, before spending on looks.
  const goal = () => {
    const next = E.nextStation(s);
    if (!next || s.level < next.lvl) return 0;
    if (s.stations.length < next.slots) return next.price;
    const room = E.nextExpansion(s);
    return room && s.level >= room.lvl ? room.price : 0;
  };
  const spare = (price) => s.cash - goal() - price > reserve();
  for (let i = 0; i < 60; i++) {
    let acted = false;
    const spend = (price) => s.cash - price > reserve();
    const limits = E.staffLimits(s.level);
    for (const role of ['waiter', 'sous', 'cleaner']) {
      if (s.staff.filter((w) => w.role === role).length < limits[role] && spend(E.hireFee(s, role))) {
        const free = WW.NEIGHBOURS.find((n) => !s.staff.some((w) => w.id === n.id));
        if (free && !E.hire(s, free.id, role)) acted = true;
      }
    }
    const ns = E.nextStation(s);
    if (ns && spend(ns.price) && !E.buyStation(s)) acted = true;
    const nr = E.nextExpansion(s);
    // A full kitchen wall needs a bigger room before the next station fits.
    const wallFull = ns && s.stations.length >= ns.slots;
    if (nr && s.level >= nr.lvl && spend(nr.price) && (wallFull || !findSpot(s)) && !E.expandRoom(s)) {
      mark(`room ${nr.cols}x${nr.rows}`, day);
      acted = true;
    }
    // Seats up to what the busiest rounds need.
    if (E.capacity(s) < 70 && spend(240)) {
      const spot = findSpot(s);
      if (spot) {
        E.buyDecor(s, 'spool_green');
        E.placeDecor(s, 'spool_green', spot.x, spot.y);
        E.buyDecor(s, 'cork');
        E.placeDecor(s, 'cork', spot.x - 1, spot.y);
        E.buyDecor(s, 'cork');
        E.placeDecor(s, 'cork', spot.x + 1, spot.y);
        acted = true;
      }
    }
    // A busy player goes after the money machines first.
    if (busy) {
      for (const def of WW.DECOR.filter((d) => d.fx && d.fx.passive)) {
        if (s.furniture.some((f) => f.id === def.id) || s.level < def.lvl || !spend(def.price)) continue;
        const spot = findDecorSpot(s, def.id);
        if (!spot) continue;
        E.buyDecor(s, def.id);
        if (!E.placeDecor(s, def.id, spot.x, spot.y)) acted = true;
      }
    }
    // The building, cheapest part first, always keeping the better one on show.
    for (const slot of Object.keys(WW.EXTERIOR)) {
      for (const id of Object.keys(WW.EXTERIOR[slot])) {
        const part = WW.EXTERIOR[slot][id];
        if (s.exteriors[slot + ':' + id] || !part.price || s.level < part.lvl || !spare(part.price * 2)) continue;
        if (!E.buyExterior(s, slot, id)) {
          mark('first part', day);
          acted = true;
        }
        break;
      }
    }
    // Everything else in the shop, cheapest first.
    for (const def of WW.DECOR.filter((d) => !d.festival && !d.find && d.kind !== 'table' && d.kind !== 'seat').sort((a, b) => a.price - b.price)) {
      const placed = def.kind === 'yard' ? s.yard : s.furniture;
      if (placed.some((f) => f.id === def.id) || s.bag[def.id] || s.level < def.lvl || !spare(def.price * 2)) continue;
      const spot = def.kind === 'yard' ? findYardSpot(s, def.id) : findDecorSpot(s, def.id);
      if (!spot) continue;
      E.buyDecor(s, def.id);
      if (!E.placeDecor(s, def.id, spot.x, spot.y)) {
        acted = true;
        mark('first ' + def.kind, day);
        if (def.id === 'fridge' || def.id === 'robot_mop' || def.id === 'gold_wheel') mark(def.n, day);
      }
      break;
    }
    if (!acted) break;
  }
  while (s.lunch < 4 && s.cash > reserve() && !E.packLunch(s)) {}
  for (const k of Object.keys(s.known)) {
    const c = E.upgradeCost(s, k);
    if (s.known[k].lvl < 5 && s.cash - c.cash > reserve() * 3) {
      const def = WW.DISH[k];
      for (const id in c.ing) {
        const need = c.ing[id] - (s.pantry[id] || 0);
        if (need > 0) E.buyIngredient(s, id, need);
      }
      E.upgradeDish(s, k);
    }
  }
  if (s.critic.due && !s.critic.picks.length) {
    for (const st of s.stations) if (st.job && st.type !== 'wok' && !st.job.dish.startsWith('d:') && s.critic.picks.length < 3 && !s.critic.picks.includes(st.job.dish)) E.criticPick(s, st.job.dish);
  }
  // Learn recipes with spare Winks, as a player with hints would.
  for (const d of WW.DISHES) {
    if (s.known[d.id] || d.lvl > s.level || s.winks < 40) continue;
    for (const id of Object.keys(d.ing)) if (!(s.pantry[id] > 0)) E.buyIngredient(s, id, 1);
    E.experiment(s, Object.keys(d.ing));
    break;
  }
  E.checkPrep(s);
  return rep;
}

const feed = new WW.RecordingFeed(WW.RECORDING);
const start = Date.parse('2026-11-05T13:00:00Z');
const s = E.newGame(start, feed);
let income = 0;
const ledger = { 0: {} };
const cooking = { 0: 0 };
const levels = {};
const total = (by) => Object.values(by).reduce((a, b) => a + b, 0);
for (let d = 0; d < days; d++) {
  let rep = null;
  const before = s.stats.earned;
  for (let v = 0; v < visits; v++) rep = visit(s, feed, start + d * DAY + (v * DAY) / visits, d);
  income = s.stats.earned - before;
  ledger[d + 1] = Object.assign({}, s.stats.by);
  cooking[d + 1] = ingredients;
  const atLevel = levels[s.level] || (levels[s.level] = { cash: 0, days: 0 });
  atLevel.cash += total(ledger[d + 1]) - total(ledger[d]);
  atLevel.days++;
  if (d < 10 || d % 5 === 4) console.log(`day ${String(d).padStart(2)} lvl ${String(s.level).padStart(2)} cash ${String(Math.round(s.cash)).padStart(8)} earned ${String(income).padStart(6)} fed ${String(rep.served).padStart(4)} soldout ${String(rep.soldOut).padStart(4)} full ${String(rep.full).padStart(4)} tired ${String(rep.tired).padStart(3)} seats ${String(E.seatsOf(s).length).padStart(2)} room ${s.room.cols}x${s.room.rows} st ${String(s.stations.length).padStart(2)} staff ${String(s.staff.length).padStart(2)} decor ${String(s.furniture.length).padStart(3)} book ${String(Object.keys(s.book).length).padStart(3)} known ${String(Object.keys(s.known).length).padStart(2)} tip ${Math.round(E.tipFactor(s) * 100)}% stars ${s.critic.stars} tidy ${Math.round(s.hygiene)} yard ${String(s.yard.length).padStart(2)} charm ${String(E.charmOf(s)).padStart(4)} +${Math.round(E.attractOf(s) * 100)}%`);
}
assert(Object.keys(s.book).every((id) => WW.ANIMAL[id]), 'guest book holds only real species');
assert(s.cash >= 0, 'never negative');
const byRar = {};
for (const id in s.book) byRar[WW.ANIMAL[id].rar] = (byRar[WW.ANIMAL[id].rar] || 0) + 1;
console.log('species by rarity', JSON.stringify(byRar), 'of', JSON.stringify(Object.fromEntries(Object.entries(WW.ANIMALS_BY_RARITY).map(([k, v]) => [k, v.length]))));
console.log('first reached on day', JSON.stringify(firsts));
console.log('trades', trades, 'with shelf and mail', s.stats.trades, 'finds', finds, 'hanging', s.shelf.reduce((a, x) => a + x.n, 0));
// What each source brought in, for each stretch of the game. Selling food in the restaurant must stay the main income.
const SOURCES = ['guests', 'party', 'line', 'chores', 'machines', 'critic', 'prep', 'level', 'sold'];
console.log('income share by stretch:', 'cash a day |', SOURCES.join(' '));
for (const [a, b] of [[0, 3], [3, 7], [7, 14], [14, 30], [30, 60], [60, 90]]) {
  if (days < b) continue;
  const delta = SOURCES.map((k) => (ledger[b][k] || 0) - (ledger[a][k] || 0));
  const sum = delta.reduce((x, y) => x + y, 0) || 1;
  const food = delta[0];
  console.log(`days ${String(a).padStart(2)} to ${String(b).padStart(2)}: ${String(Math.round(sum / (b - a))).padStart(6)} a day | food ${String(Math.round((food / sum) * 100)).padStart(3)}% |`, SOURCES.map((k, i) => `${k} ${Math.round((delta[i] / sum) * 100)}`).join(' '), `| ingredients cost ${Math.round(((cooking[b] - cooking[a]) / sum) * 100)}%`);
  if (a >= 3) assert(food / sum >= 0.75, `selling food must be the main income, days ${a} to ${b}: ${Math.round((food / sum) * 100)}%`);
  if (a >= 7) assert((cooking[b] - cooking[a]) / sum >= 0.07, `cooking must cost something, days ${a} to ${b}: ${Math.round(((cooking[b] - cooking[a]) / sum) * 100)}%`);
}
// What a day's income buys. At one visit a day, the dearest new thing at a level should take more than a day to save for.
const onOffer = [...WW.DECOR.filter((d) => !d.festival && !d.find), ...Object.values(WW.EXTERIOR).flatMap((slot) => Object.values(slot)), ...WW.EXPANSIONS, ...WW.STATION_SHOP];
const dearest = [];
for (const L of Object.keys(levels).map(Number).sort((a, b) => a - b)) {
  const top = Math.max(0, ...onOffer.filter((c) => c.lvl === L).map((c) => c.price));
  if (!top) continue;
  const saving = top / (levels[L].cash / levels[L].days);
  dearest.push(`${L}: ${saving.toFixed(1)}`);
  if (visits === 1 && !busy && L >= 8) assert(saving >= 1.2, `level ${L}: a day's income nearly buys the dearest new thing, ${saving.toFixed(1)} days`);
}
console.log('dearest new thing by level, in days of income |', dearest.join(' | '));
console.log('dreams', Object.keys(s.journal).length, 'wakes', s.wakes, 'critic visits', s.critic.visits, 'stars', s.critic.stars);
const decorTotal = WW.DECOR.filter((d) => !d.festival && !d.find).reduce((a, d) => a + d.price, 0);
const yardTotal = WW.DECOR.filter((d) => d.kind === 'yard').reduce((a, d) => a + d.price, 0);
const exteriorTotal = Object.values(WW.EXTERIOR).flatMap((k) => Object.values(k)).reduce((a, p) => a + p.price, 0);
const unbought = WW.DECOR.filter((d) => !d.festival && !d.find && d.kind !== 'table' && d.kind !== 'seat' && !(d.kind === 'yard' ? s.yard : s.furniture).some((f) => f.id === d.id));
console.log('still unbought', unbought.length, unbought.slice(0, 8).map((d) => d.id + ' ' + d.price + ' lv' + d.lvl).join(', '));
const roomTotal = WW.EXPANSIONS.reduce((a, e) => a + e.price, 0);
const stationTotal = WW.STATION_SHOP.reduce((a, e) => a + e.price, 0);
const styleTotal = Object.values(WW.ROOM_STYLES).flatMap((k) => Object.values(k)).reduce((a, st) => a + st.price, 0);
const upgradeTotal = WW.DISHES.reduce((a, d) => a + d.y * d.p * (1 + 2 + 3 + 4), 0);
console.log('things to buy: decor', WW.DECOR.length, 'items', decorTotal, 'of which yard', yardTotal, '| building', exteriorTotal, '| room', roomTotal, '| stations', stationTotal, '| styles', styleTotal, '| recipe upgrades', upgradeTotal, '| total', decorTotal + exteriorTotal + roomTotal + stationTotal + styleTotal + upgradeTotal);
const pct = WW.DISHES.map((d) => Math.round((Object.entries(d.ing).reduce((a, [k, n]) => a + WW.INGREDIENT[k].price * n, 0) / (d.y * d.p)) * 100)).sort((a, b) => a - b);
console.log('ingredient cost as % of a batch: min', pct[0], 'median', pct[pct.length >> 1], 'max', pct[pct.length - 1], '| biggest batch', Math.max(...WW.DISHES.map((d) => d.y)));
