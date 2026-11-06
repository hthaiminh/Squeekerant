// The game's rules, with no drawing in here. Money and progress only move on settled rounds;
// the live wheel only decides when guests walk in and what the till shows until the next settlement.
(function (WW) {
  const CFG = {
    WORK_PER_GUEST: 10,
    TURNS_PER_ROUND: 3,
    QUIET_ENERGY: 1,
    NAP_ROUNDS: 6,
    DREAM_ROUNDS: 60,
    GOLD_ROUNDS: 90,
    WINK_BANK: 400,
    EXPERIMENT_COST: 10,
    HINT_COST: 25,
    DREAM_DISH_COST: 25,
    WAITER_ENERGY: 0.5,
    SOUS_ENERGY: 8,
    LUNCH_ENERGY: 40,
    HYGIENE_PER_GUEST: 0.05,
    SHELF_CALL: 0.02,
    MAIL_MAX: 12,
    OFFER_ROUNDS: 288,
    AGREE: 0.85,
    MILESTONES_KM: [1, 3, 5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100],
    BOOK_TROPHIES: [25, 50, 75, 100, 125, 150, 180],
  };
  WW.CFG = CFG;
  // Where the money came from, kept so the balance can be checked.
  const earn = (s, source, n) => {
    const by = s.stats.by || (s.stats.by = {});
    by[source] = (by[source] || 0) + n;
  };

  // The room grows two columns or one row at a time.
  const EXPANSIONS = [
    { cols: 14, rows: 5, lvl: 2, price: 800 },
    { cols: 14, rows: 6, lvl: 3, price: 1500 },
    { cols: 16, rows: 6, lvl: 4, price: 2500 },
    { cols: 16, rows: 7, lvl: 5, price: 4000 },
    { cols: 18, rows: 7, lvl: 6, price: 6500 },
    { cols: 18, rows: 8, lvl: 8, price: 10000 },
    { cols: 20, rows: 8, lvl: 10, price: 15000 },
    { cols: 20, rows: 9, lvl: 12, price: 22000 },
    { cols: 22, rows: 9, lvl: 14, price: 32000 },
    { cols: 22, rows: 10, lvl: 16, price: 46000 },
    { cols: 24, rows: 10, lvl: 18, price: 65000 },
    { cols: 24, rows: 11, lvl: 20, price: 90000 },
    { cols: 24, rows: 12, lvl: 22, price: 125000 },
  ];
  WW.EXPANSIONS = EXPANSIONS;

  const STATION_SHOP = [
    { type: 'stove', lvl: 2, price: 300 },
    { type: 'pot', lvl: 3, price: 800 },
    { type: 'wok', lvl: 4, price: 1500 },
    { type: 'stove', lvl: 6, price: 3000 },
    { type: 'pot', lvl: 8, price: 5000 },
    { type: 'wok', lvl: 10, price: 8000 },
    { type: 'stove', lvl: 13, price: 12000 },
    { type: 'pot', lvl: 16, price: 18000 },
    { type: 'wok', lvl: 20, price: 26000 },
  ];
  WW.STATION_SHOP = STATION_SHOP;
  const INGREDIENT_LEVELS = { 1: 1, 2: 2, 3: 4, 4: 7 };

  const NEIGHBOURS = [
    ['mochi', 'Mochi', 'cream', "Mochi's Crumb House", 'sous', 'stove', '#e88a7a'],
    ['biscuit', 'Biscuit', 'cinnamon', 'The Biscuit Tin', 'sous', 'wok', '#6fb0d8'],
    ['pepper', 'Pepper', 'black', 'Pepper & Sons', 'waiter', null, '#ffc857'],
    ['noodle', 'Noodle', 'golden', 'Noodle Corner', 'sous', 'fast', '#8fd6a8'],
    ['tofu', 'Tofu', 'white', 'Soft Tofu Table', 'waiter', null, '#f49fb0'],
    ['pickle', 'Pickle', 'rust', 'The Pickle Jar', 'sous', 'wok', '#b8c86a'],
    ['truffle', 'Truffle', 'choc', 'Truffle Under Stairs', 'cleaner', null, '#a99ad6'],
    ['clementine', 'Clementine', 'squeek', "Clementine's", 'sous', 'stove', '#f2a33a'],
    ['pudding', 'Pudding', 'grey', 'Pudding Lane', 'waiter', null, '#d9b870'],
    ['olive', 'Olive', 'panda', 'Olive Branch', 'sous', 'fast', '#6fb36b'],
  ].map(([id, n, fur, shop, role, spec, color]) => ({ id, n, fur, shop, role, spec, color }));
  WW.NEIGHBOURS = NEIGHBOURS;
  WW.NEIGHBOUR = Object.fromEntries(NEIGHBOURS.map((x) => [x.id, x]));

  // Every neighbour grows a few things of their own. Between them the street carries everything.
  const GOODS = (() => {
    const rng = WW.Rng(WW.hash32('street goods'));
    const out = Object.fromEntries(NEIGHBOURS.map((n) => [n.id, []]));
    const deal = (tier, each) => {
      let deck = [];
      for (const n of NEIGHBOURS) {
        for (let k = 0; k < each; k++) {
          if (!deck.length) deck = rng.shuffle(WW.INGREDIENTS.filter((i) => i.tier === tier).map((i) => i.id));
          const at = deck.findIndex((id) => !out[n.id].includes(id));
          out[n.id].push(deck.splice(at < 0 ? 0 : at, 1)[0]);
        }
      }
    };
    deal(1, 2);
    deal(2, 2);
    deal(3, 2);
    deal(4, 1);
    return out;
  })();
  WW.GOODS = GOODS;
  // How much a stall and a neighbour's shelf hold each day, by ingredient level. Better things are always scarce.
  const STALL = { 1: { kinds: 6, min: 14, max: 26 }, 2: { kinds: 3, min: 8, max: 16 }, 3: { kinds: 2, min: 3, max: 6 }, 4: { kinds: 1, min: 1, max: 3 } };
  const SHELF_STOCK = { 1: [8, 14], 2: [4, 8], 3: [2, 4], 4: [1, 2] };
  // What turns up in a tree or on a dirty floor, on top of the money. Chances are per roll.
  const LOOT = {
    tree: { treasure: 0.015, junk: 0.08, ingredient: 0.05 },
    dirt: { treasure: 0.001, junk: 0.03, ingredient: 0.02 },
    neighbourTree: { treasure: 0.02, junk: 0.1, ingredient: 0.08 },
    neighbourSpot: { treasure: 0.002, junk: 0.04, ingredient: 0.03 },
  };
  WW.LOOT = LOOT;

  const dayKey = (t) => new Date(t).toISOString().slice(0, 10);

  function xpNeed(level) {
    return Math.round(40 * Math.pow(level, 1.7));
  }
  function staffLimits(level) {
    return { sous: 1 + Math.floor(level / 3), waiter: 1 + Math.floor(level / 3), cleaner: level >= 2 ? 1 + Math.floor(level / 8) : 0 };
  }

  function gridOf(s) {
    const { cols, rows } = s.room;
    return { cols, rows, doorCols: [cols - 3, cols - 2] };
  }

  function emptyReport(round) {
    return { fromRound: round, toRound: round, active: 0, quiet: 0, unknown: 0, work: 0, served: 0, earned: 0, banked: 0, soldOut: 0, full: 0, tired: 0, newSpecies: [], rares: [], winkGain: 0, dreams: [], naps: 0, jobs: [], levels: 0, festival: null, verdict: null };
  }

  // A sleep already under way counts in full, on feeds that have read it. The practice kitchen's pretend hamster starts from nothing.
  const sleepSoFar = (feed, round) => (feed.quietUpTo ? feed.quietUpTo(round) : 0);

  function newGame(t, feed, opts = {}) {
    const round = feed.settled(t);
    const info = feed.round(round);
    const s = {
      v: 6,
      created: t,
      savedAt: t,
      shop: opts.shop || 'The Tiny Table',
      feedMode: feed.mode,
      wheelCore: feed.core || null,
      chef: { name: opts.name || 'Bean', fur: opts.fur || 'golden', hat: opts.hat || 'toque' },
      cash: 300,
      till: 0,
      winks: 30,
      xp: 0,
      level: 1,
      pantry: { carrot: 8, oats: 16, peas: 6, parsley: 2, romaine: 2 },
      known: {},
      hints: {},
      tried: {},
      stock: { carrot_coins: 24 },
      stations: [
        { type: 'stove', job: null, last: null },
        { type: 'wok', job: null, last: null },
        { type: 'pot', job: null, last: null },
      ],
      staff: [
        { id: 'head', role: 'head', energy: 100 },
        { id: 'starter_sous', role: 'sous', n: 'Pip', fur: 'cream', energy: 100, spec: null },
        { id: 'starter_waiter', role: 'waiter', n: 'Bun', fur: 'grey', energy: 100 },
      ],
      lunch: 2,
      hygiene: 100,
      room: { cols: 12, rows: 5 },
      style: { wall: 'teal', floor: 'oak', kitchen: 'cream' },
      styles: {},
      furniture: [
        { id: 'spool_red', x: 2, y: 1 },
        { id: 'cork', x: 1, y: 1 },
        { id: 'cork', x: 3, y: 1 },
        { id: 'spool_blue', x: 6, y: 2 },
        { id: 'cork', x: 5, y: 2 },
        { id: 'button_stool', x: 7, y: 2 },
        { id: 'teacup_fern', x: 0, y: 4 },
      ],
      bag: {},
      book: {},
      trophies: {},
      // Counted from the wheel as it is now. Passes made before you opened are not your guests.
      clock: { round, cum: info.cum, guestN: Math.floor(feed.live(t).cum / CFG.WORK_PER_GUEST), quietTotal: 0, streak: sleepSoFar(feed, round), hash: feed.hashBefore(round), capRound: 0, capUsed: 0 },
      dreamDish: null,
      journal: {},
      wakes: 0,
      trend: null,
      market: null,
      orders: null,
      quizDay: null,
      tree: { day: null, shakes: 0 },
      visits: {},
      trades: [],
      shelf: [],
      mail: [],
      mailN: 0,
      yard: [],
      exterior: Object.assign({}, WW.EXTERIOR_DEFAULT),
      exteriors: {},
      streetMoves: { day: null, n: 0 },
      line: { day: null, tips: 0, plays: 0, replayDay: null, best: 0 },
      critic: { due: false, picks: [], reserved: {}, last: null, stars: 0, visits: 0, hints: [], taste: null, memory: null, seed: null, wakesAt: 0 },
      festival: null,
      km: 0,
      prep: {},
      away: emptyReport(round),
      log: [],
      stats: { served: 0, earned: 0, soldOut: 0, full: 0, tired: 0, batches: 0, experiments: 0, lineServed: 0, ordersDone: 0, floorsCleaned: 0, trades: 0, finds: 0 },
      flags: {},
      clockOffset: 0,
      soundOn: true,
    };
    for (const id of WW.STARTER_DISHES) s.known[id] = { lvl: 1, made: 0 };
    prepareCritic(s, feed.hashBefore(round));
    return s;
  }

  // Moving to another source of rounds, or to a redeployed wheel: its rounds and running total start somewhere else.
  // The restaurant stays exactly as it is and nothing is counted from the gap. Stoves run on the clock, so the caller moves those.
  function moveToFeed(s, feed, t) {
    const r = feed.settled(t);
    const info = feed.round(r);
    const cum = feed.live(t).cum;
    Object.assign(s.clock, { round: r, cum: info.cum, guestN: Math.floor(cum / CFG.WORK_PER_GUEST), hash: feed.hashBefore(r), streak: sleepSoFar(feed, r), capRound: 0, capUsed: 0 });
    s.km = Math.floor((info.cum * (feed.mmPerPass || 878)) / 1000000);
    s.feedMode = feed.mode;
    s.wheelCore = feed.core || null;
    s.clockOffset = 0;
    // Round numbers kept in the save would mean nothing on the new count.
    s.festival = null;
    for (const m of s.mail) if (m.kind === 'offer') m.round = r;
    for (const st of s.stations) if (st.job && st.type === 'wok') st.job.start = cum;
  }

  // Older saves come forward with their restaurant intact.
  function migrate(save) {
    // Nobody comes in while he sleeps any more, so those who were waiting have gone.
    delete save.quiet;
    delete save.quietTick;
    delete save.quietN;
    if (save.v === 1) {
      save.cash = save.buttons || 0;
      delete save.buttons;
      save.winks = save.dream || 0;
      delete save.dream;
      save.room = { cols: 12, rows: 5 };
      save.style = { wall: 'teal', floor: 'oak', kitchen: 'cream' };
      save.styles = {};
      save.orders = null;
      save.market = null;
      save.trophies = {};
      save.visits = {};
      // Anything the shops no longer list is dropped, so nothing old can trip up the new tables.
      const realDish = (k) => k.startsWith('d:') || WW.DISH[k];
      for (const k of Object.keys(save.known)) if (!WW.DISH[k]) delete save.known[k];
      for (const k of Object.keys(save.stock)) if (!realDish(k)) delete save.stock[k];
      for (const k of Object.keys(save.pantry)) if (!WW.INGREDIENT[k]) delete save.pantry[k];
      for (const k of Object.keys(save.bag)) if (!WW.DECOR_BY_ID[k]) delete save.bag[k];
      for (const st of save.stations) {
        if (st.job && !realDish(st.job.dish)) st.job = null;
        st.last = st.job ? st.job.dish : null;
      }
      save.stats.ordersDone = save.stats.ordersDone || 0;
      save.stats.floorsCleaned = save.stats.floorsCleaned || 0;
      save.critic.reserved = save.critic.reserved || {};
      save.away = emptyReport(save.clock.round);
      save.furniture = save.furniture.filter((f) => WW.DECOR_BY_ID[f.id]);
      save.v = 2;
    }
    if (save.v === 2) {
      save.shelf = [];
      save.mail = [];
      save.mailN = 0;
      save.market = null;
      save.stats.trades = save.stats.trades || 0;
      save.stats.finds = save.stats.finds || 0;
      save.v = 3;
    }
    if (save.v === 3) {
      save.yard = [];
      save.exterior = { wall: 'plaster', roof: 'thatch', awning: 'none', trim: 'none' };
      save.exteriors = {};
      save.streetPage = 0;
      save.v = 4;
    }
    if (save.v === 4) {
      // The forest grew on both sides, so everything in the yard moves along with the map.
      for (const f of save.yard) f.x += WW.OUTSIDE.MID;
      save.exterior.style = 'none';
      save.streetMoves = { day: null, n: 0 };
      delete save.streetPage;
      save.v = 5;
    }
    if (save.v === 5) {
      // Whole houses became parts. What was paid for them comes back, and the chimney moved up to the roof.
      for (const key of Object.keys(save.exteriors)) {
        if (!key.startsWith('style:')) continue;
        save.cash += ({ yurt: 1800, rondavel: 2400, american: 3200, chalet: 5000, tudor: 7500, hanok: 11000, machiya: 15000, hoian: 20000, dutch: 26000, santorini: 33000, hacienda: 42000, riad: 55000, stave: 70000, chinese: 90000, thai: 120000, russian: 150000, castle: 190000, mughal: 240000, kinkaku: 300000 })[key.slice(6)] || 0;
        delete save.exteriors[key];
      }
      delete save.exterior.style;
      if (save.exterior.trim === 'chimney') {
        save.exterior.trim = 'none';
        save.exterior.crown = 'chimney';
      }
      if (save.exteriors['trim:chimney']) {
        delete save.exteriors['trim:chimney'];
        save.exteriors['crown:chimney'] = true;
      }
      save.exterior = Object.assign({}, WW.EXTERIOR_DEFAULT, save.exterior);
      save.v = 6;
    }
    return save;
  }

  // What the placed pieces add up to. Only the first of each kind counts, so variety pays.
  let fxOwner = null;
  let fxCount = -1;
  let fxValue = null;
  function fxOf(s) {
    if (fxOwner === s && fxCount === s.furniture.length) return fxValue;
    const out = { clean: 0, turns: 0, fl: {}, stoveFast: 0, stoveY: 0, wokY: 0, potY: 0, waiter: 0, sous: 0, lunch: 0, passive: 0, tips: 0, rare: 0, winks: 0, market: 0 };
    const seen = new Set();
    for (const f of s.furniture) {
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      const fx = WW.DECOR_BY_ID[f.id] && WW.DECOR_BY_ID[f.id].fx;
      if (!fx) continue;
      for (const k in fx) {
        if (k === 'fl') for (const c in fx.fl) out.fl[c] = (out.fl[c] || 0) + fx.fl[c];
        else if (k === 'winks') out.winks = out.winks ? Math.min(out.winks, fx.winks) : fx.winks;
        else out[k] += fx[k];
      }
    }
    fxOwner = s;
    fxCount = s.furniture.length;
    fxValue = out;
    return out;
  }
  const fxReset = () => {
    fxOwner = null;
  };

  // Seasons and weather come from the round number, so everyone on the street shares them.
  function seasonOf(round) {
    const day = Math.floor(Math.max(0, round - 1) / 144);
    const ids = Object.keys(WW.SEASONS);
    return { id: ids[Math.floor(day / WW.SEASON_DAYS) % ids.length], day: (day % WW.SEASON_DAYS) + 1 };
  }
  function weatherOf(round) {
    const table = WW.SEASONS[seasonOf(round).id].weather;
    let x = WW.Rng(WW.hash32('weather', Math.floor(Math.max(0, round - 1) / 18))).next();
    for (const [id, odds] of table) {
      x -= odds;
      if (x <= 0) return id;
    }
    return 'clear';
  }

  // What the sky adds to a guest's payment: the weather, and a dish in season.
  function skyTips(def, round) {
    return WW.WEATHER[weatherOf(round)].tips + (def.fl.includes(WW.SEASONS[seasonOf(round).id].fl) ? 0.1 : 0);
  }

  // What a building is showing right now, part by part.
  function exteriorParts(ext) {
    if (!ext) return [];
    return Object.keys(WW.EXTERIOR).map((slot) => WW.EXTERIOR[slot][ext[slot]]).filter(Boolean);
  }
  // Charm is worth most at the start, and only the whole yard with the best house reaches the top.
  const CHARM_CURVE = 2800;
  let fullCharmCache = 0;
  function fullCharm() {
    if (!fullCharmCache) {
      const yard = WW.DECOR.filter((d) => d.kind === 'yard').reduce((a, d) => a + d.charm, 0);
      fullCharmCache = yard + Object.values(WW.EXTERIOR).reduce((a, slot) => a + Math.max(...Object.values(slot).map((p) => p.charm)), 0);
    }
    return fullCharmCache;
  }
  // Charm draws guests in: what stands in the yard, the first of each kind, and how the building looks.
  function charmOf(s) {
    const seen = new Set();
    let charm = 0;
    for (const f of s.yard || []) {
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      charm += WW.DECOR_BY_ID[f.id].charm || 0;
    }
    for (const part of exteriorParts(s.exterior)) charm += part.charm;
    return charm;
  }
  function attractOf(s) {
    return (0.5 * (1 - Math.exp(-charmOf(s) / CHARM_CURVE))) / (1 - Math.exp(-fullCharm() / CHARM_CURVE));
  }

  // Lookups

  function dreamDef(idx, gold) {
    const row = WW.DREAMS[idx % WW.DREAMS.length];
    const stKind = idx % 3;
    const st = stKind === 0 ? 'stove' : stKind === 1 ? 'wok' : 'pot';
    const need = st === 'stove' ? 45 : st === 'wok' ? 900 : 18;
    const score = {};
    for (const id in row[2]) {
      const ing = WW.INGREDIENT[id];
      score[ing.fl[0]] = (score[ing.fl[0]] || 0) + 3 * row[2][id];
      score[ing.fl[1]] = (score[ing.fl[1]] || 0) + row[2][id];
    }
    return {
      id: `d:${idx}${gold ? ':g' : ''}`,
      n: (gold ? 'Golden ' : '') + row[0],
      st,
      need,
      y: gold ? 80 : 60,
      p: gold ? 20 : 12,
      ing: row[2],
      shape: row[1],
      lvl: 1,
      fl: Object.keys(score).sort((a, b) => score[b] - score[a]).slice(0, 2),
      dream: true,
      gold: !!gold,
    };
  }
  function dishDef(key) {
    if (key.startsWith('d:')) {
      const [, idx, g] = key.split(':');
      return dreamDef(Number(idx), g === 'g');
    }
    return WW.DISH[key];
  }

  function dishPrice(s, def) {
    const lvl = s.known && s.known[def.id] ? s.known[def.id].lvl : 1;
    return def.p * (1 + 0.15 * (lvl - 1));
  }

  // A seat counts when it touches a table.
  function seatsOf(s) {
    const items = s.furniture.map((f) => Object.assign({}, f, { def: WW.DECOR_BY_ID[f.id] }));
    const tables = items.filter((i) => i.def.kind === 'table');
    const out = [];
    const touches = (x, y, b) => {
      for (let j = b.y; j < b.y + b.def.h; j++) {
        for (let i = b.x; i < b.x + b.def.w; i++) {
          if (Math.abs(x - i) + Math.abs(y - j) === 1) return true;
        }
      }
      return false;
    };
    for (const it of items) {
      if (it.def.kind !== 'seat') continue;
      const n = it.def.seats || 1;
      for (let k = 0; k < n; k++) {
        const x = it.x + (n > 1 ? k : 0);
        const y = it.y;
        const table = tables.find((tb) => touches(x, y, tb));
        if (table) out.push({ x, y, table: { x: table.x, y: table.y, w: table.def.w, h: table.def.h }, item: it.id, face: table.x + (table.def.w - 1) / 2 >= x ? 1 : -1 });
      }
    }
    return out;
  }

  function capacity(s) {
    return Math.round(seatsOf(s).length * CFG.TURNS_PER_ROUND * (1 + fxOf(s).turns));
  }

  function hasDecor(s, tag) {
    return s.furniture.some((f) => WW.DECOR_BY_ID[f.id].tag === tag);
  }

  // The first of a piece counts in full, more of the same only a little.
  const REPEAT_RATING = 0.25;
  // Rating climbs quickly at first and keeps climbing, so the last piece bought still counts.
  const RATING_SCALE = 3500;
  function ratingPoints(s) {
    let pts = 50;
    const seen = new Set();
    for (const f of s.yard ? s.furniture.concat(s.yard) : s.furniture) {
      const rating = WW.DECOR_BY_ID[f.id].rating;
      pts += seen.has(f.id) ? rating * REPEAT_RATING : rating;
      seen.add(f.id);
    }
    for (const part of exteriorParts(s.exterior)) pts += part.rating;
    for (const id in s.known) pts += (s.known[id].lvl - 1) * 10;
    pts += s.critic.stars * 50;
    if (s.hygiene >= 80) pts += 25;
    const S = WW.ROOM_STYLES;
    pts += S.wall[s.style.wall].rating + S.floor[s.style.floor].rating + S.kitchen[s.style.kitchen].rating;
    return pts;
  }
  function ratingStars(s) {
    return 5 * (1 - Math.exp(-ratingPoints(s) / RATING_SCALE));
  }
  // A full five stars tips half the menu price. A nice room is worth having, but it should not print money.
  function tipFactor(s) {
    return ratingStars(s) * 0.1 + fxOf(s).tips;
  }

  function inStock(s) {
    return Object.keys(s.stock).filter((k) => s.stock[k] > 0);
  }

  function meetsNeeds(s, sp) {
    const n = sp.needs;
    if (n.lvl && s.level < n.lvl) return false;
    if (n.decor && !hasDecor(s, n.decor)) return false;
    if (n.flavor && !inStock(s).some((k) => dishDef(k).fl.includes(n.flavor))) return false;
    if (n.dream && !inStock(s).some((k) => k.startsWith('d:'))) return false;
    if (n.gold && !inStock(s).some((k) => k.endsWith(':g'))) return false;
    return true;
  }

  function rollGuest(s, N, hash) {
    const rng = WW.Rng(WW.hash32(hash || 'none', N));
    const roll = rng.next() * 100;
    const boost = 1 + ratingStars(s) * 0.15 + fxOf(s).rare;
    const weights = { l: WW.RARITY.l.w * boost, e: WW.RARITY.e.w * boost, r: WW.RARITY.r.w * boost, u: WW.RARITY.u.w };
    let rar = 'c';
    let acc = 0;
    for (const k of ['l', 'e', 'r', 'u']) {
      acc += weights[k];
      if (roll < acc) {
        rar = k;
        break;
      }
    }
    const pool = WW.ANIMALS_BY_RARITY[rar];
    for (let i = 0; i < 3; i++) {
      const sp = rng.pick(pool);
      if (meetsNeeds(s, sp)) return sp;
    }
    return rng.pick(WW.ANIMALS_BY_RARITY.c);
  }

  // Serving

  // One guest at the door. Returns what happened so the scene can act it out.
  function processGuest(s, N, hash, round, out) {
    if (s.clock.capRound !== round) {
      s.clock.capRound = round;
      s.clock.capUsed = 0;
    }
    const sp = rollGuest(s, N, hash);
    const rng = WW.Rng(WW.hash32(hash || 'none', N, 'dish'));
    const res = { species: sp.id, served: false, why: null, dish: null, coins: 0 };
    if (s.clock.capUsed >= capacity(s)) {
      res.why = 'full';
      s.stats.full++;
      out.full++;
      return res;
    }
    const keys = inStock(s);
    if (!keys.length) {
      res.why = 'soldout';
      s.stats.soldOut++;
      out.soldOut++;
      return res;
    }
    const fx = fxOf(s);
    const cost = CFG.WAITER_ENERGY * (1 - fx.waiter);
    let waiter = s.staff.filter((w) => w.role === 'waiter' && w.energy >= cost).sort((a, b) => b.energy - a.energy)[0];
    if (!waiter && s.lunch > 0) {
      s.lunch--;
      for (const w of s.staff) if (w.role === 'waiter') w.energy = Math.min(100, w.energy + CFG.LUNCH_ENERGY + fx.lunch);
      waiter = s.staff.filter((w) => w.role === 'waiter' && w.energy >= cost)[0];
    }
    if (!waiter) {
      res.why = 'tired';
      s.stats.tired++;
      out.tired++;
      return res;
    }
    const liked = keys.filter((k) => dishDef(k).fl.includes(sp.likes));
    const key = liked.length ? rng.pick(liked) : rng.pick(keys);
    const def = dishDef(key);
    s.stock[key]--;
    if (s.stock[key] <= 0) delete s.stock[key];
    waiter.energy = Math.max(0, waiter.energy - cost);
    s.clock.capUsed++;
    let factor = 1 + tipFactor(s);
    if (liked.length) factor += 0.25;
    if (s.trend && def.fl.some((f) => s.trend.fl.includes(f))) factor += 0.25;
    if (s.hygiene < 50) factor -= 0.25;
    if (s.festival && s.festival.round >= round - 144) factor += 0.25;
    factor += skyTips(def, round);
    for (const f of def.fl) if (fx.fl[f]) factor += fx.fl[f];
    const coins = Math.max(1, Math.round(dishPrice(s, def) * factor));
    s.till += coins;
    earn(s, 'guests', coins);
    s.hygiene = Math.max(0, s.hygiene - CFG.HYGIENE_PER_GUEST);
    s.stats.served++;
    s.stats.earned += coins;
    out.served++;
    out.earned += coins;
    addXp(s, 2 + ((s.known[key] ? s.known[key].lvl : 1) - 1), out);
    const isNew = !s.book[sp.id];
    s.book[sp.id] = (s.book[sp.id] || 0) + 1;
    if (isNew) out.newSpecies.push(sp.id);
    if (sp.rar === 'r' || sp.rar === 'e' || sp.rar === 'l') if (out.rares.length < 30) out.rares.push(sp.id);
    res.served = true;
    res.dish = key;
    res.coins = coins;
    res.isNew = isNew;
    return res;
  }

  function addXp(s, amount, out) {
    s.xp += amount;
    while (s.xp >= xpNeed(s.level)) {
      s.xp -= xpNeed(s.level);
      s.level++;
      s.cash += 40 * s.level;
      earn(s, 'level', 40 * s.level);
      // A neighbour shares a recipe every second level. The rest are for the Test Kitchen.
      if (s.level % 2 === 0) {
        const gift = WW.DISHES.find((d) => !s.known[d.id] && d.lvl <= s.level);
        if (gift) {
          s.known[gift.id] = { lvl: 1, made: 0 };
          addLog(s, `A neighbour sent you the recipe for ${gift.n}.`);
        }
      }
      if (out) out.levels = (out.levels || 0) + 1;
      addLog(s, `Your restaurant reached level ${s.level}.`);
    }
  }

  function addLog(s, text) {
    s.log.unshift(text);
    if (s.log.length > 40) s.log.length = 40;
  }

  // The settled world

  function finishJobs(s, t, cum, quietTotal, out) {
    for (const st of s.stations) {
      if (!st.job) continue;
      const j = st.job;
      const done = st.type === 'stove' ? t >= j.start + j.need * 60000 : st.type === 'wok' ? cum - j.start >= j.need : quietTotal - j.start >= j.need;
      if (done) {
        s.stock[j.dish] = (s.stock[j.dish] || 0) + j.y;
        if (s.known[j.dish]) s.known[j.dish].made++;
        out.jobs.push({ dish: j.dish, y: j.y });
        st.last = j.dish;
        st.job = null;
        s.stats.batches++;
      }
    }
  }

  function prepareCritic(s, hash) {
    const rng = WW.Rng(WW.hash32(hash || 'none', 'critic', s.critic.visits));
    const flavours = Object.keys(WW.FLAVOURS);
    const taste = rng.shuffle(flavours).slice(0, 2);
    const humble = WW.DISHES.filter((d) => d.lvl <= Math.max(2, s.level));
    s.critic.taste = taste;
    s.critic.memory = rng.pick(humble).id;
    s.critic.hints = [];
    s.critic.seed = hash;
  }

  // A hint arrives with each dream, so a week of sleep tells you what he wants.
  function criticHint(s) {
    const c = s.critic;
    const memory = WW.DISH[c.memory];
    const ing = Object.keys(memory.ing);
    const pool = [
      `He always asks whether the kitchen uses ${WW.INGREDIENT[ing[0]].n.toLowerCase()}.`,
      `He likes things ${WW.FLAVOURS[c.taste[0]].n.toLowerCase()}.`,
      `Someone saw him sniff a dish made on the ${memory.st}.`,
      `He also likes things ${WW.FLAVOURS[c.taste[1]].n.toLowerCase()}.`,
      ing[1] ? `He once cried over a plate with ${WW.INGREDIENT[ing[1]].n.toLowerCase()}.` : `He remembers a dish with only one ingredient.`,
      `The name of the dish he misses has ${memory.n.split(' ').length} word${memory.n.split(' ').length > 1 ? 's' : ''}.`,
      `He calls it ${memory.n.slice(0, 3)}...`,
    ];
    if (c.hints.length < pool.length) c.hints.push(pool[c.hints.length]);
  }

  // The critic tastes three dishes. Only what was set aside or is on the counter can be served.
  function criticVerdict(s) {
    const c = s.critic;
    c.reserved = c.reserved || {};
    const picks = c.picks.filter((k) => c.reserved[k] || s.stock[k] > 0).slice(0, 3);
    let score = 0;
    const notes = [];
    for (const key of picks) {
      const def = dishDef(key);
      const lvl = s.known[key] ? s.known[key].lvl : 1;
      let pts = 1 + Math.min(3, def.lvl / 4) + (lvl - 1) * 0.5;
      const hits = def.fl.filter((f) => c.taste.includes(f)).length;
      pts += hits * 1.5;
      if (key === c.memory) {
        pts += 6;
        notes.push(`He went quiet at the ${def.n}. Then he asked to see the chef.`);
      }
      score += pts;
      if (c.reserved[key]) delete c.reserved[key];
      else {
        s.stock[key]--;
        if (s.stock[key] <= 0) delete s.stock[key];
      }
    }
    for (const k in c.reserved) s.stock[k] = (s.stock[k] || 0) + 1;
    c.reserved = {};
    const stars = score >= 14 ? 3 : score >= 9 ? 2 : score >= 4 ? 1 : 0;
    s.critic.stars += stars;
    s.critic.visits++;
    const reward = 80 * stars * Math.max(1, s.level);
    s.cash += reward;
    earn(s, 'critic', reward);
    if (!picks.length) notes.push('He looked at the empty counter, wrote one word, and left.');
    if (stars === 3 && !notes.length) notes.push('Three stars. He finished everything, slowly.');
    if (stars === 2 && !notes.length) notes.push('Competent, he says. He ate the whole plate though.');
    if (stars === 1 && !notes.length) notes.push('He took two bites and said it was a start.');
    if (stars === 0 && !notes.length) notes.push('He said nothing at all, which is worse.');
    const verdict = { stars, score: Math.round(score * 10) / 10, picks, notes, memory: c.memory, taste: c.taste.slice(), reward };
    c.last = verdict;
    c.due = false;
    c.picks = [];
    return verdict;
  }

  // Naming a dish sets a portion aside if there is one; if not, it must be on the counter when he comes.
  function criticPick(s, key) {
    const c = s.critic;
    c.reserved = c.reserved || {};
    if (c.picks.includes(key)) {
      c.picks = c.picks.filter((k) => k !== key);
      if (c.reserved[key]) {
        delete c.reserved[key];
        s.stock[key] = (s.stock[key] || 0) + 1;
      }
      return;
    }
    if (c.picks.length >= 3) return;
    c.picks.push(key);
    if (s.stock[key] > 0) {
      s.stock[key]--;
      if (s.stock[key] <= 0) delete s.stock[key];
      c.reserved[key] = 1;
    }
  }

  // How far this sleep has come toward his dream, in hours. Whatever the screen says about the coming dream reads this.
  function dreamProgress(s) {
    const rounds = s.clock.streak;
    return { hours: rounds / 6, dreamIn: Math.max(0, CFG.DREAM_ROUNDS - rounds) / 6, goldIn: Math.max(0, CFG.GOLD_ROUNDS - rounds) / 6 };
  }

  function onWake(s, info, streak, out) {
    if (streak >= CFG.DREAM_ROUNDS) {
      const gold = streak >= CFG.GOLD_ROUNDS;
      const idx = WW.hash32(info.hash, 'dream') % WW.DREAMS.length;
      const def = dreamDef(idx, gold);
      s.dreamDish = { key: def.id, round: info.r, gold, sleptRounds: streak };
      s.journal[def.id] = (s.journal[def.id] || 0) + 1;
      s.wakes++;
      out.dreams.push({ key: def.id, sleptRounds: streak });
      criticHint(s);
      addLog(s, `He slept ${(streak / 6).toFixed(1)} hours and dreamed of ${def.n}.`);
      if (s.critic.due) {
        out.verdict = criticVerdict(s);
        prepareCritic(s, info.hash);
      } else if (s.wakes - s.critic.wakesAt >= 7) {
        s.critic.due = true;
        s.critic.wakesAt = s.wakes;
        addLog(s, 'Sir Slowbite is coming after the next long sleep. Choose what he will taste.');
      }
    } else if (streak >= CFG.NAP_ROUNDS) {
      const rng = WW.Rng(WW.hash32(info.hash, 'nap'));
      const pool = WW.INGREDIENTS.filter((i) => INGREDIENT_LEVELS[i.tier] <= s.level);
      const gift = rng.pick(pool);
      s.pantry[gift.id] = (s.pantry[gift.id] || 0) + 2;
      out.naps++;
      out.napGift = gift.id;
    }
  }

  function processRound(s, info, feed, out) {
    const t = feed.roundEnd(info.r);
    if (info.unknown) {
      out.unknown++;
      s.clock.round = info.r;
      finishJobs(s, t, s.clock.cum, s.clock.quietTotal, out);
      return;
    }
    const fx = fxOf(s);
    if (info.work > 0) {
      const streak = s.clock.streak;
      out.active++;
      out.work += info.work;
      if (streak > 0) onWake(s, info, streak, out);
      s.clock.streak = 0;
      const target = Math.floor(info.cum / CFG.WORK_PER_GUEST);
      while (s.clock.guestN < target) {
        const N = s.clock.guestN++;
        processGuest(s, N, s.clock.hash, info.r, out);
        if (drawnByCharm(s, N)) processGuest(s, N + 0.5, s.clock.hash, info.r, out);
      }
      s.clock.hash = info.hash;
      s.clock.cum = info.cum;
      // Cleaners and machines tidy up after a busy round; vending machines pay out.
      s.hygiene = Math.min(100, s.hygiene + fx.clean);
      s.till += fx.passive;
      earn(s, 'machines', fx.passive);
      for (const w of s.staff) {
        if (w.role === 'cleaner' && w.energy > 0) {
          s.hygiene = Math.min(100, s.hygiene + 1.5);
          w.energy = Math.max(0, w.energy - 0.5);
        }
      }
      const km = Math.floor((info.cum * (feed.mmPerPass || 878)) / 1000000);
      if (km > s.km) {
        const next = nextMilestone(s.km);
        if (km >= next && s.km > 0) {
          s.festival = { round: info.r, km: next };
          s.bag.bunting = (s.bag.bunting || 0) + 1;
          out.festival = next;
          addLog(s, `He passed ${next} km on the wheel. Festival: 25% more tips for a day, and bunting for your window.`);
        }
        s.km = km;
      }
    } else {
      out.quiet++;
      s.clock.quietTotal++;
      s.clock.streak++;
      if (s.winks < CFG.WINK_BANK) {
        s.winks++;
        out.winkGain++;
        if (fx.winks && s.clock.quietTotal % fx.winks === 0 && s.winks < CFG.WINK_BANK) {
          s.winks++;
          out.winkGain++;
        }
      }
      for (const w of s.staff) w.energy = Math.min(100, w.energy + CFG.QUIET_ENERGY);
      if (s.clock.streak === CFG.NAP_ROUNDS) {
        const rng = WW.Rng(WW.hash32(s.clock.hash || 'none', 'trend'));
        s.trend = { fl: rng.shuffle(Object.keys(WW.FLAVOURS)).slice(0, 2), round: info.r };
      }
    }
    finishJobs(s, t, s.clock.cum, s.clock.quietTotal, out);
    // Everything in the till is banked as soon as a round settles.
    out.banked = (out.banked || 0) + s.till;
    s.cash += s.till;
    s.till = 0;
    s.clock.round = info.r;
    settleTrades(s);
    shelfRound(s, info, out);
    checkBook(s);
  }

  function checkBook(s) {
    const met = Object.keys(s.book).length;
    for (const n of CFG.BOOK_TROPHIES) {
      if (met >= n && !s.trophies[n]) {
        s.trophies[n] = true;
        s.bag['trophy_' + n] = (s.bag['trophy_' + n] || 0) + 1;
        addLog(s, `You have met ${n} kinds of guest. A trophy is in your bag.`);
      }
    }
  }

  function nextMilestone(km) {
    for (const m of CFG.MILESTONES_KM) if (m > km) return m;
    return (Math.floor(km / 50) + 1) * 50;
  }

  function settleTrades(s) {
    if (!s.trades.length) return;
    for (const tr of s.trades) {
      const yes = !tr.give || WW.Rng(WW.hash32(s.clock.hash || 'none', 'agree', tr.from, tr.get, s.clock.round)).next() < CFG.AGREE;
      const n = WW.NEIGHBOUR[tr.from].n;
      if (yes) {
        s.pantry[tr.get] = (s.pantry[tr.get] || 0) + 1;
        s.stats.trades++;
        addNote(s, `${n} agreed: you got ${WW.INGREDIENT[tr.get].n}.`);
      } else {
        s.pantry[tr.give] = (s.pantry[tr.give] || 0) + 1;
        addNote(s, `${n} said no this time. Your ${WW.INGREDIENT[tr.give].n} came back.`);
      }
    }
    s.trades = [];
  }

  // The mailbox holds offers to answer and short notes. Oldest notes fall out first.
  function addNote(s, text) {
    s.mailN++;
    s.mail.push({ id: s.mailN, kind: 'note', text, read: false });
    addLog(s, text);
    const notes = s.mail.filter((m) => m.kind === 'note');
    if (notes.length > 10) s.mail = s.mail.filter((m) => m !== notes[0]);
  }
  function mailCount(s) {
    return s.mail.filter((m) => m.kind === 'offer' || !m.read).length;
  }
  function mailRead(s) {
    for (const m of s.mail) m.read = true;
  }
  function mailClear(s) {
    s.mail = s.mail.filter((m) => m.kind === 'offer');
  }
  function mailDecline(s, id) {
    s.mail = s.mail.filter((m) => m.id !== id);
  }
  function mailAccept(s, id) {
    const m = s.mail.find((x) => x.id === id && x.kind === 'offer');
    if (!m) return 'That offer has expired.';
    s.mail = s.mail.filter((x) => x !== m);
    const stack = s.shelf.find((x) => x.id === m.want);
    if (!stack || stack.n < 1) return 'That is no longer on your shelf.';
    takeFromStack(s, stack, 1);
    s.pantry[m.give] = (s.pantry[m.give] || 0) + 1;
    s.stats.trades++;
    s.flags.traded = true;
    addXp(s, 2, s.away);
    return null;
  }

  // Your shelf: ingredients hung up for neighbours to trade for.
  const shelfSlots = (s) => Math.min(8, 3 + Math.floor(s.level / 4));
  function takeFromStack(s, stack, n) {
    stack.n -= n;
    if (stack.n <= 0) {
      s.shelf = s.shelf.filter((x) => x !== stack);
      s.mail = s.mail.filter((m) => !(m.kind === 'offer' && m.want === stack.id));
    }
  }
  function shelfPut(s, id, n) {
    if (!((s.pantry[id] || 0) >= n)) return `You don't have enough ${WW.INGREDIENT[id].n}.`;
    let stack = s.shelf.find((x) => x.id === id);
    if (!stack) {
      if (s.shelf.length >= shelfSlots(s)) return 'Your shelf is full. More room comes with levels.';
      stack = { id, n: 0, locked: false };
      s.shelf.push(stack);
    }
    s.pantry[id] -= n;
    if (s.pantry[id] <= 0) delete s.pantry[id];
    stack.n += n;
    s.flags.shelved = true;
    return null;
  }
  function shelfTake(s, id, n) {
    const stack = s.shelf.find((x) => x.id === id);
    if (!stack) return 'That is not on your shelf.';
    const take = Math.min(n, stack.n);
    s.pantry[id] = (s.pantry[id] || 0) + take;
    takeFromStack(s, stack, take);
    return null;
  }
  function shelfLock(s, id, locked) {
    const stack = s.shelf.find((x) => x.id === id);
    if (!stack) return 'That is not on your shelf.';
    stack.locked = !!locked;
    return null;
  }
  // Each settled round a neighbour may come by. Unlocked goods swap at once, locked ones wait for your answer.
  function shelfRound(s, info, out) {
    s.mail = s.mail.filter((m) => !(m.kind === 'offer' && info.r - m.round > CFG.OFFER_ROUNDS));
    if (!s.shelf.length) return;
    const rng = WW.Rng(WW.hash32(s.clock.hash || 'none', 'callers', info.r, s.created));
    for (const stack of s.shelf.slice()) {
      if (rng.next() >= CFG.SHELF_CALL) continue;
      const tier = WW.INGREDIENT[stack.id].tier;
      const n = rng.pick(NEIGHBOURS);
      const better = rng.next() < 0.15;
      const goods = GOODS[n.id].filter((id) => id !== stack.id);
      let pool = goods.filter((id) => WW.INGREDIENT[id].tier === (better ? tier + 1 : tier));
      if (!pool.length) pool = goods.filter((id) => WW.INGREDIENT[id].tier >= tier);
      if (!pool.length) continue;
      const give = rng.pick(pool);
      if (stack.locked) {
        if (s.mail.filter((m) => m.kind === 'offer').length >= CFG.MAIL_MAX) continue;
        s.mailN++;
        s.mail.push({ id: s.mailN, kind: 'offer', from: n.id, want: stack.id, give, round: info.r, read: false });
        out.offers = (out.offers || 0) + 1;
      } else {
        takeFromStack(s, stack, 1);
        s.pantry[give] = (s.pantry[give] || 0) + 1;
        s.stats.trades++;
        (out.swaps = out.swaps || []).push({ from: n.id, took: stack.id, gave: give });
        addLog(s, `${n.n} took your ${WW.INGREDIENT[stack.id].n} and left ${WW.INGREDIENT[give].n}.`);
      }
    }
  }

  // Brings the save up to the frontier. Silent, so it handles long absences.
  function advance(s, feed, t) {
    const target = feed.settled(t);
    if (target <= s.clock.round) return null;
    const out = s.away;
    let steps = 0;
    const cap = Math.min(target, s.clock.round + 144 * 21);
    for (let r = s.clock.round + 1; r <= cap; r++) {
      processRound(s, feed.round(r), feed, out);
      steps++;
    }
    if (cap < target) {
      const last = feed.round(target);
      s.clock.round = target;
      if (!last.unknown) {
        s.clock.cum = last.cum;
        s.clock.guestN = Math.floor(last.cum / CFG.WORK_PER_GUEST);
      }
      s.clock.hash = feed.hashBefore(target + 1);
      // Weeks away skip their middle, but a sleep going on now counts in full, so his dream comes the same as for everyone.
      s.clock.streak = sleepSoFar(feed, target);
    }
    out.toRound = s.clock.round;
    return { steps };
  }

  function drawnByCharm(s, N) {
    const a = attractOf(s);
    return a > 0 && WW.Rng(WW.hash32(s.clock.hash || 'none', N, 'charm')).next() < a;
  }

  // Lets guests in as the live wheel passes each tenth turn. Their pay waits in the till until the round settles.
  function pulse(s, feed, t, events) {
    const live = feed.live(t);
    const target = Math.floor(live.cum / CFG.WORK_PER_GUEST);
    let safety = 0;
    const greet = (N) => {
      const out = { served: 0, earned: 0, soldOut: 0, full: 0, tired: 0, newSpecies: [], rares: [], levels: 0 };
      const res = processGuest(s, N, s.clock.hash, live.round, out);
      const a = s.away;
      a.served += out.served;
      a.earned += out.earned;
      a.soldOut += out.soldOut;
      a.full += out.full;
      a.tired += out.tired;
      a.levels += out.levels;
      a.newSpecies.push(...out.newSpecies);
      if (a.rares.length < 30) a.rares.push(...out.rares);
      events.push(res);
    };
    while (s.clock.guestN < target && safety++ < 40) {
      const N = s.clock.guestN++;
      greet(N);
      if (drawnByCharm(s, N)) greet(N + 0.5);
    }
    return live;
  }
  function takeReport(s) {
    const r = s.away;
    s.away = emptyReport(s.clock.round);
    return r;
  }

  // Things the player does

  function stationProgress(s, st, feed, t) {
    const j = st.job;
    if (!j) return 0;
    if (j.fake) return j.pr;
    let done;
    if (st.type === 'stove') done = (t - j.start) / 60000;
    else if (st.type === 'wok') done = feed.live(t).cum - j.start;
    else done = s.clock.quietTotal - j.start;
    return Math.max(0, Math.min(1, done / j.need));
  }

  // The head chef takes one flame station for free; other flames need a rested sous chef.
  function freeCook(s) {
    const busy = s.stations.map((st) => (st.job && st.job.chef ? st.job.chef : null)).filter(Boolean);
    if (!busy.includes('head')) return s.staff.find((w) => w.role === 'head');
    const cost = CFG.SOUS_ENERGY * (1 - fxOf(s).sous);
    return s.staff.find((w) => w.role === 'sous' && !busy.includes(w.id) && w.energy >= cost);
  }

  function canCook(s, key, stationIdx) {
    const def = dishDef(key);
    const st = s.stations[stationIdx];
    if (!def || !st) return 'Nothing to cook.';
    if (st.job) return 'That station is busy.';
    if (def.st !== st.type) return `That dish has to be made ${def.st === 'pot' ? 'in the pot' : 'on the ' + def.st}.`;
    if (def.dream) {
      if (!s.dreamDish || s.dreamDish.key !== key) return 'That dream has faded.';
      if (s.winks < CFG.DREAM_DISH_COST) return `A Dream Dish costs ${CFG.DREAM_DISH_COST} Winks.`;
    } else if (!s.known[key]) return 'You don\'t know that recipe yet.';
    for (const id in def.ing) if ((s.pantry[id] || 0) < def.ing[id]) return `You need more ${WW.INGREDIENT[id].n}.`;
    if (st.type !== 'pot' && !freeCook(s)) return 'Every cook is busy or out of energy. Hire a sous chef, or wait until he next sleeps.';
    return null;
  }

  // What a batch comes to if it starts now. Cooking and every number on screen use this same sum.
  function batchInfo(s, key) {
    const def = dishDef(key);
    const fx = fxOf(s);
    let chef = null;
    let y = def.y;
    let need = def.need;
    if (def.st !== 'pot') {
      chef = freeCook(s) || null;
      if (chef && chef.role === 'sous') {
        if (chef.spec === def.st) y = Math.round(y * 1.2);
        if (chef.spec === 'fast') need = Math.round(need * 0.85);
      } else if (chef) y = Math.round(y * 1.1);
    }
    if (def.st === 'stove') {
      need = Math.max(1, Math.round(need * (1 - fx.stoveFast)));
      y = Math.round(y * (1 + fx.stoveY));
    } else if (def.st === 'wok') y = Math.round(y * (1 + fx.wokY));
    else y = Math.round(y * (1 + fx.potY));
    const lvl = s.known && s.known[key] ? s.known[key].lvl : 1;
    y = Math.round(y * (1 + 0.1 * (lvl - 1)));
    return { y, need, chef };
  }

  function startCook(s, key, stationIdx, feed, t) {
    const err = canCook(s, key, stationIdx);
    if (err) return err;
    const def = dishDef(key);
    const st = s.stations[stationIdx];
    const fx = fxOf(s);
    for (const id in def.ing) {
      s.pantry[id] -= def.ing[id];
      if (s.pantry[id] <= 0) delete s.pantry[id];
    }
    if (def.dream) s.winks -= CFG.DREAM_DISH_COST;
    const { y, need, chef } = batchInfo(s, key);
    if (chef && chef.role === 'sous') chef.energy = Math.max(0, chef.energy - CFG.SOUS_ENERGY * (1 - fx.sous));
    const start = st.type === 'stove' ? t : st.type === 'wok' ? feed.live(t).cum : s.clock.quietTotal;
    st.job = { dish: key, start, need, y, chef: chef ? chef.id : null };
    st.last = key;
    s.flags.cooked = true;
    s.flags['cooked_' + st.type] = true;
    if (def.dream) s.flags.dreamCooked = true;
    return null;
  }

  // Today's price when the stall has it, otherwise the usual one.
  function ingredientPrice(s, id) {
    const item = s.market && s.market.items.find((x) => x.id === id);
    return item ? item.price : WW.INGREDIENT[id].price;
  }

  // What a dish is missing would cost at today's stall, or null when the stall cannot supply it.
  function missingCost(s, def) {
    const market = s.market;
    if (!market) return null;
    let cost = 0;
    for (const id in def.ing) {
      const need = def.ing[id] - (s.pantry[id] || 0);
      if (need <= 0) continue;
      const item = market.items.find((x) => x.id === id);
      if (!item || item.left < need) return null;
      cost += item.price * need;
    }
    return cost;
  }
  function buyMissing(s, def) {
    for (const id in def.ing) {
      const need = def.ing[id] - (s.pantry[id] || 0);
      if (need > 0) {
        const err = buyIngredient(s, id, need);
        if (err) return err;
      }
    }
    return null;
  }

  function buyIngredient(s, id, qty) {
    const item = s.market && s.market.items.find((i) => i.id === id);
    if (!item) return 'Not at the market today.';
    if (item.left < qty) return 'Not enough left at the market.';
    const cost = item.price * qty;
    if (s.cash < cost) return 'Not enough cash.';
    s.cash -= cost;
    item.left -= qty;
    s.pantry[id] = (s.pantry[id] || 0) + qty;
    s.flags.bought = true;
    return null;
  }

  function ensureMarket(s, feed, t) {
    const day = dayKey(t);
    if (!s.market || s.market.day !== day) {
      const r = feed.roundAt(Date.parse(day + 'T00:00:00Z'));
      const hash = feed.hashBefore(r);
      // Every restaurant has its own stall, so nobody has everything and neighbours always have a reason to trade.
      const rng = WW.Rng(WW.hash32(hash, 'market', day, s.created));
      const off = 1 - fxOf(s).market;
      const more = 1 + s.level * 0.05;
      const items = [];
      for (const tier of [1, 2, 3, 4]) {
        if (INGREDIENT_LEVELS[tier] > s.level) continue;
        const { kinds, min, max } = STALL[tier];
        for (const i of rng.shuffle(WW.INGREDIENTS.filter((x) => x.tier === tier)).slice(0, kinds)) {
          items.push({ id: i.id, price: Math.max(1, Math.round(i.price * rng.range(0.75, 1.3) * off)), left: Math.round((min + rng.int(max - min + 1)) * more) });
        }
      }
      s.market = { day, items };
    }
    // Whatever last night's dream calls for is always on sale.
    if (s.dreamDish) {
      const def = dishDef(s.dreamDish.key);
      for (const id in def.ing) {
        if (!s.market.items.some((x) => x.id === id)) s.market.items.push({ id, price: Math.round(WW.INGREDIENT[id].price * 1.2), left: def.ing[id] * 2 });
      }
    }
    return s.market;
  }

  const QUIZ = [
    ['Which lettuce is safe for a hamster?', ['Romaine', 'Iceberg', 'Any lettuce', 'None'], 0, 'Romaine only, never iceberg.'],
    ['What must you remove from an apple slice?', ['The seeds', 'The skin', 'The stalk only', 'Nothing'], 0, 'Apple seeds are toxic.'],
    ['Which potato can a hamster have?', ['Sweet potato', 'White potato', 'Green potato', 'Crisps'], 0, 'Regular potato is unsafe.'],
    ['What kind of pepper is safe for a hamster?', ['Sweet', 'Spicy', 'Pickled', 'Dried with salt'], 0, 'Sweet peppers only.'],
    ['What is the smallest wheel the Squeektoshi care policy allows?', ['30 cm', '15 cm', '20 cm', '60 cm'], 0, 'At least 30 cm, solid surface.'],
    ['How deep does the care policy say bedding should be?', ['25 to 30 cm', '5 cm', '50 cm', 'None needed'], 0, 'Syrian hamsters dig.'],
    ['Does the care policy allow waking him to mine?', ['Never', 'Only at night', 'If blocks are slow', 'On weekends'], 0, 'Only freely chosen running is recorded.'],
    ['What does one work unit count?', ['One accepted wheel magnet passage', 'One Ethereum block', 'One minute of running', 'One SQK'], 0, 'Each passage of the magnet is one work unit.'],
    ['How long is a round?', ['10 minutes', '1 minute', '1 hour', '1 day'], 0, 'Rounds are 600 seconds.'],
    ['What does a round with zero work prove?', ['No accepted work', 'He was definitely asleep', 'The chain stopped', 'He ran backwards'], 0, 'Only that no work was accepted. It doesn\'t prove he was asleep.'],
    ['Why give a hamster a sand bath?', ['To clean his fur', 'To cook in', 'To scare him', 'As food'], 0, 'Low dust, additive free sand keeps coats clean.'],
    ['What should a hamster eat most of?', ['Complete hamster food', 'Mango', 'Seeds only', 'Egg'], 0, 'Everything else here is a small treat.'],
  ];
  // His day on the official stats page runs from 12:00 to 12:00 UTC, while he sleeps, so it holds one whole run.
  // Only the real wheel can answer this truthfully, the recording never asks. Answers are ranges, nobody needs the exact count to play.
  const PASS_RANGES = [[9000, 'Under 9,000'], [11000, '9,000 to 10,999'], [13000, '11,000 to 12,999'], [Infinity, '13,000 or more']];
  function lastFullDay(feed, t) {
    const noon = Date.parse(dayKey(t) + 'T12:00:00Z');
    const last = feed.roundAt(noon <= t ? noon : noon - 86400000) - 1;
    return last <= feed.settled(t) ? last : last - 144;
  }
  function quizFor(s, feed, t) {
    const day = dayKey(t);
    if (s.quizDay === day) return null;
    const rng = WW.Rng(WW.hash32(day, 'quiz'));
    const last = lastFullDay(feed, t);
    if (rng.next() < 0.4 && feed.knows && feed.knows(last - 143, last)) {
      const w = feed.workBetween(last - 143, last);
      if (w > 0) return { q: 'About how many wheel passes did Squeektoshi make on his last full day?', opts: PASS_RANGES.map((x) => x[1]), answer: PASS_RANGES.findIndex((x) => w < x[0]), note: 'His day on the official stats page runs from 12:00 to 12:00 UTC.' };
    }
    const row = QUIZ[rng.int(QUIZ.length)];
    const order = rng.shuffle([0, 1, 2, 3]);
    return { q: row[0], opts: order.map((i) => row[1][i]), answer: order.indexOf(row[2]), note: row[3] };
  }
  function answerQuiz(s, quiz, choice, t) {
    s.quizDay = dayKey(t);
    s.flags.quiz = true;
    if (choice !== quiz.answer) return { right: false };
    const rng = WW.Rng(WW.hash32(dayKey(t), 'quizgift'));
    const pool = WW.INGREDIENTS.filter((i) => INGREDIENT_LEVELS[i.tier] <= Math.max(2, s.level));
    const gift = rng.pick(pool);
    const n = gift.tier >= 3 ? 2 : 5;
    s.pantry[gift.id] = (s.pantry[gift.id] || 0) + n;
    return { right: true, gift: gift.id, n };
  }

  // The more a treasure is worth, the rarer it is.
  function pickTreasure(rng) {
    let x = rng.next() * WW.TREASURES.reduce((a, d) => a + 1 / d.sell, 0);
    for (const d of WW.TREASURES) {
      x -= 1 / d.sell;
      if (x <= 0) return d.id;
    }
    return WW.TREASURES[0].id;
  }
  // Something besides the money, now and then: a treasure, a bit of junk, or a better ingredient.
  function rollLoot(s, rng, table) {
    const odds = LOOT[table];
    const x = rng.next();
    if (x < odds.treasure + odds.junk) {
      const id = x < odds.treasure ? pickTreasure(rng) : rng.pick(WW.JUNK).id;
      s.bag[id] = (s.bag[id] || 0) + 1;
      s.stats.finds++;
      return { find: id };
    }
    if (x < odds.treasure + odds.junk + odds.ingredient) {
      const y = rng.next();
      const wanted = y < 0.6 ? 2 : y < 0.9 ? 3 : 4;
      const tier = Math.min(wanted, ...[4, 3, 2].filter((k) => INGREDIENT_LEVELS[k] <= Math.max(2, s.level)).slice(0, 1));
      const id = rng.pick(WW.INGREDIENTS.filter((i) => i.tier === tier)).id;
      s.pantry[id] = (s.pantry[id] || 0) + 1;
      return { ingredient: id, n: 1 };
    }
    return {};
  }
  function shakeTree(s, t) {
    const day = dayKey(t);
    if (s.tree.day !== day) s.tree = { day, shakes: 0 };
    if (s.tree.shakes >= 3) return null;
    s.tree.shakes++;
    s.flags.tree = true;
    const rng = WW.Rng(WW.hash32(day, 'tree', s.tree.shakes, s.created));
    const b = 5 + rng.int(10 + s.level * 2);
    s.cash += b;
    earn(s, 'chores', b);
    const out = Object.assign({ cash: b }, rollLoot(s, rng, 'tree'));
    if (!out.find && !out.ingredient && rng.next() < 0.25) {
      const seeds = ['oats', 'millet', 'sunflower', 'pumpkinseed'].filter((id) => INGREDIENT_LEVELS[WW.INGREDIENT[id].tier] <= Math.max(2, s.level));
      const id = rng.pick(seeds);
      out.ingredient = id;
      out.n = WW.INGREDIENT[id].tier === 1 ? 4 : 1;
      s.pantry[id] = (s.pantry[id] || 0) + out.n;
    }
    return out;
  }

  function giveHint(s, dishId) {
    const d = WW.DISH[dishId];
    const ids = Object.keys(d.ing);
    const have = s.hints[dishId] || [];
    const next = ids.find((i) => !have.includes(i));
    if (!next) return null;
    s.hints[dishId] = have.concat(next);
    return { dish: dishId, ingredient: next };
  }

  // The test kitchen: taste a combination, spend Winks, maybe discover a recipe.
  function experiment(s, ids) {
    const uniq = Array.from(new Set(ids));
    if (uniq.length < 1 || uniq.length > 3) return { error: 'Pick up to three ingredients.' };
    if (s.winks < CFG.EXPERIMENT_COST) return { error: `A taste costs ${CFG.EXPERIMENT_COST} Winks.` };
    for (const id of uniq) if (!(s.pantry[id] > 0)) return { error: `You are out of ${WW.INGREDIENT[id].n}.` };
    s.winks -= CFG.EXPERIMENT_COST;
    for (const id of uniq) {
      s.pantry[id]--;
      if (s.pantry[id] <= 0) delete s.pantry[id];
    }
    s.stats.experiments++;
    s.flags.experiment = true;
    const sig = uniq.slice().sort().join('+');
    s.tried[sig] = (s.tried[sig] || 0) + 1;
    const flavours = {};
    for (const id of uniq) {
      const f = WW.INGREDIENT[id].fl;
      flavours[f[0]] = (flavours[f[0]] || 0) + 3;
      flavours[f[1]] = (flavours[f[1]] || 0) + 1;
    }
    const matches = WW.DISHES.filter((d) => Object.keys(d.ing).sort().join('+') === sig);
    const exact = matches.find((d) => !s.known[d.id] && d.lvl <= s.level) || matches.find((d) => !s.known[d.id]) || matches[0];
    if (exact && !s.known[exact.id]) {
      if (exact.lvl > s.level) return { flavours, near: true, levelLock: exact.lvl };
      s.known[exact.id] = { lvl: 1, made: 0 };
      addXp(s, 10, s.away);
      addLog(s, `New recipe: ${exact.n}.`);
      return { flavours, found: exact.id };
    }
    if (exact) return { flavours, again: exact.id };
    let best = null;
    let bestHits = 0;
    for (const d of WW.DISHES) {
      if (s.known[d.id]) continue;
      const hits = uniq.filter((i) => d.ing[i]).length;
      if (hits > bestHits) {
        bestHits = hits;
        best = d;
      }
    }
    return { flavours, close: bestHits, of: best ? Object.keys(best.ing).length : 0, closeDish: bestHits > 0 && best ? best.id : null };
  }

  function buyHint(s, dishId) {
    if (s.winks < CFG.HINT_COST) return { error: `A hint costs ${CFG.HINT_COST} Winks.` };
    const hint = giveHint(s, dishId);
    if (!hint) return { error: 'You already know everything that goes in.' };
    s.winks -= CFG.HINT_COST;
    return { hint };
  }

  function upgradeCost(s, id) {
    const d = WW.DISH[id];
    const lvl = s.known[id].lvl;
    const ing = {};
    for (const k in d.ing) ing[k] = Math.ceil(d.ing[k] * (lvl + 1) * 0.5);
    return { cash: Math.round(d.y * d.p * lvl), ing };
  }
  function upgradeDish(s, id) {
    if (!s.known[id]) return 'You don\'t know that recipe.';
    if (s.known[id].lvl >= 5) return 'That dish is as good as it gets.';
    const c = upgradeCost(s, id);
    if (s.cash < c.cash) return 'Not enough cash.';
    for (const k in c.ing) if ((s.pantry[k] || 0) < c.ing[k]) return `You need ${WW.INGREDIENT[k].n} x${c.ing[k]}.`;
    s.cash -= c.cash;
    for (const k in c.ing) {
      s.pantry[k] -= c.ing[k];
      if (s.pantry[k] <= 0) delete s.pantry[k];
    }
    s.known[id].lvl++;
    s.flags.upgraded = true;
    addXp(s, 15 * s.known[id].lvl, s.away);
    return null;
  }

  function packLunch(s) {
    if (s.lunch >= 12) return 'The lunch shelf is full.';
    const cost = 15;
    if (s.cash < cost) return 'Not enough cash.';
    if ((s.pantry.oats || 0) < 1) return 'A lunchbox needs Rolled Oats.';
    s.cash -= cost;
    s.pantry.oats--;
    if (s.pantry.oats <= 0) delete s.pantry.oats;
    s.lunch++;
    s.flags.lunch = true;
    return null;
  }

  function feedStaff(s, staffId) {
    const w = s.staff.find((x) => x.id === staffId);
    if (!w) return 'No such hamster.';
    if (s.lunch <= 0) return 'No lunchboxes packed.';
    s.lunch--;
    w.energy = Math.min(100, w.energy + CFG.LUNCH_ENERGY + fxOf(s).lunch);
    return null;
  }

  function hireFee(s, role) {
    const count = s.staff.filter((w) => w.role === role).length;
    return Math.round(100 * Math.pow(count + 1, 1.5));
  }
  function hire(s, nid, role) {
    const n = WW.NEIGHBOUR[nid];
    if (!n) return 'Nobody by that name.';
    if (s.staff.some((w) => w.id === nid)) return `${n.n} already works here.`;
    const limits = staffLimits(s.level);
    const count = s.staff.filter((w) => w.role === role).length;
    if (count >= limits[role]) return `Level ${s.level} allows ${limits[role]} ${role === 'sous' ? 'sous chef' : role}${limits[role] === 1 ? '' : 's'}.`;
    const fee = hireFee(s, role);
    if (s.cash < fee) return `Hiring costs ${fee} cash.`;
    s.cash -= fee;
    s.staff.push({ id: nid, role, n: n.n, fur: n.fur, energy: 100, spec: role === 'sous' ? n.spec : null });
    s.flags.hired = true;
    if (role === 'cleaner') s.flags.cleaner = true;
    return null;
  }
  function fire(s, id) {
    if (id === 'head') return 'You cannot fire yourself.';
    const w = s.staff.find((x) => x.id === id);
    if (!w) return 'No such hamster.';
    if (s.cash < 200) return 'Firing costs 200 cash.';
    if (s.stations.some((st) => st.job && st.job.chef === id)) return 'They are still cooking.';
    s.cash -= 200;
    s.staff = s.staff.filter((x) => x !== w);
    return null;
  }
  function nextStation(s) {
    const item = STATION_SHOP[s.stations.length - 3];
    if (!item) return null;
    return Object.assign({ slots: WW.metrics ? WW.metrics(s.room).slots : 6 }, item);
  }
  function buyStation(s) {
    const item = nextStation(s);
    if (!item) return 'The kitchen is full.';
    if (s.stations.length >= item.slots) return 'The kitchen wall is full. Expand the room first.';
    if (s.level < item.lvl) return `Reach level ${item.lvl} first.`;
    if (s.cash < item.price) return 'Not enough cash.';
    s.cash -= item.price;
    s.stations.push({ type: item.type, job: null, last: null });
    return null;
  }

  // The room

  // Level 1 is the starting room, each expansion adds one.
  function roomLevel(room) {
    const area = room.cols * room.rows;
    return { level: 1 + EXPANSIONS.filter((e) => e.cols * e.rows <= area).length, top: EXPANSIONS.length + 1 };
  }
  function nextExpansion(s) {
    return EXPANSIONS.find((e) => e.cols >= s.room.cols && e.rows >= s.room.rows && (e.cols > s.room.cols || e.rows > s.room.rows)) || null;
  }
  function expandRoom(s) {
    const e = nextExpansion(s);
    if (!e) return 'The room is as big as it gets.';
    if (s.level < e.lvl) return `Reach level ${e.lvl} first.`;
    if (s.cash < e.price) return 'Not enough cash.';
    s.cash -= e.price;
    s.room = { cols: e.cols, rows: e.rows };
    // The door moves with the wall: anything standing in the new doorway goes back in the bag.
    const door = gridOf(s).doorCols;
    s.furniture = s.furniture.filter((f) => {
      const def = WW.DECOR_BY_ID[f.id];
      if (def.kind === 'rug') return true;
      const blocks = f.y + def.h > s.room.rows - 1 && door.some((c) => c >= f.x && c < f.x + def.w);
      if (blocks) s.bag[f.id] = (s.bag[f.id] || 0) + 1;
      return !blocks;
    });
    fxReset();
    s.flags.expanded = true;
    addXp(s, 25, s.away);
    addLog(s, `The room grew to ${e.cols} by ${e.rows} tiles.`);
    return null;
  }

  function buyStyle(s, kind, id) {
    const st = WW.ROOM_STYLES[kind][id];
    if (!st) return 'Unknown style.';
    const key = kind + ':' + id;
    if (!s.styles[key] && st.price) {
      if (s.level < st.lvl) return `Reach level ${st.lvl} first.`;
      if (s.cash < st.price) return 'Not enough cash.';
      s.cash -= st.price;
      s.styles[key] = true;
    }
    s.style[kind] = id;
    s.flags.styled = true;
    return null;
  }

  function buyExterior(s, slot, id) {
    const part = WW.EXTERIOR[slot] && WW.EXTERIOR[slot][id];
    if (!part) return 'Unknown style.';
    const key = slot + ':' + id;
    if (!s.exteriors[key] && part.price) {
      if (s.level < part.lvl) return `Reach level ${part.lvl} first.`;
      if (s.cash < part.price) return 'Not enough cash.';
      s.cash -= part.price;
      s.exteriors[key] = true;
    }
    s.exterior[slot] = id;
    s.flags.exterior = true;
    return null;
  }

  // Decor

  function occupied(s, ignore) {
    const map = {};
    for (const f of s.furniture) {
      if (f === ignore) continue;
      const def = WW.DECOR_BY_ID[f.id];
      if (def.kind === 'rug') continue;
      for (let y = f.y; y < f.y + def.h; y++) for (let x = f.x; x < f.x + def.w; x++) map[x + ',' + y] = f;
    }
    return map;
  }
  // The yard: pieces stand on free tiles outside, never on a path or a building.
  function canPlaceYard(s, id, x, y, ignore) {
    const def = WW.DECOR_BY_ID[id];
    const taken = {};
    for (const f of s.yard) {
      if (f === ignore) continue;
      const d = WW.DECOR_BY_ID[f.id];
      for (let j = f.y; j < f.y + d.h; j++) for (let i = f.x; i < f.x + d.w; i++) taken[i + ',' + j] = true;
    }
    for (let j = y; j < y + def.h; j++) {
      for (let i = x; i < x + def.w; i++) {
        if (!WW.OUTSIDE.free(i, j)) return 'That spot is not free.';
        if (taken[i + ',' + j]) return 'Something is already there.';
      }
    }
    return null;
  }
  function canPlace(s, id, x, y, ignore) {
    const def = WW.DECOR_BY_ID[id];
    if (def.kind === 'yard') return canPlaceYard(s, id, x, y, ignore);
    const { cols, rows, doorCols } = gridOf(s);
    if (x < 0 || y < 0 || x + def.w > cols || y + def.h > rows) return 'That is outside the room.';
    const blocked = occupied(s, ignore);
    if (def.kind !== 'rug') {
      for (let j = y; j < y + def.h; j++) {
        for (let i = x; i < x + def.w; i++) {
          if (blocked[i + ',' + j]) return 'Something is already there.';
          if (j === rows - 1 && doorCols.includes(i)) return 'Keep the door clear.';
        }
      }
    } else {
      const rug = s.furniture.find((f) => f !== ignore && WW.DECOR_BY_ID[f.id].kind === 'rug' && !(f.x + WW.DECOR_BY_ID[f.id].w <= x || f.x >= x + def.w || f.y + WW.DECOR_BY_ID[f.id].h <= y || f.y >= y + def.h));
      if (rug) return 'There is a rug there already.';
    }
    return null;
  }
  function buyDecor(s, id) {
    const def = WW.DECOR_BY_ID[id];
    if (!def) return 'Unknown item.';
    if (def.festival) return 'This one cannot be bought.';
    if (s.level < def.lvl) return `Reach level ${def.lvl} first.`;
    if (s.cash < def.price) return 'Not enough cash.';
    s.cash -= def.price;
    s.bag[id] = (s.bag[id] || 0) + 1;
    s.flags.boughtDecor = true;
    return null;
  }
  function placeDecor(s, id, x, y) {
    if (!(s.bag[id] > 0)) return 'You don\'t have one.';
    const err = canPlace(s, id, x, y);
    if (err) return err;
    s.bag[id]--;
    if (s.bag[id] <= 0) delete s.bag[id];
    (WW.DECOR_BY_ID[id].kind === 'yard' ? s.yard : s.furniture).push({ id, x, y });
    s.flags.placed = true;
    fxReset();
    return null;
  }
  function moveDecor(s, item, x, y) {
    const err = canPlace(s, item.id, x, y, item);
    if (err) return err;
    item.x = x;
    item.y = y;
    return null;
  }
  function storeDecor(s, item) {
    s.furniture = s.furniture.filter((f) => f !== item);
    s.yard = s.yard.filter((f) => f !== item);
    s.bag[item.id] = (s.bag[item.id] || 0) + 1;
    fxReset();
    return null;
  }
  // Half what the shop asks, or what a find is worth. Trophies and bunting are not for sale.
  function sellValue(id) {
    const def = WW.DECOR_BY_ID[id];
    if (def.find) return def.sell;
    return def.festival ? null : Math.floor(def.price / 2);
  }
  function sellDecor(s, id) {
    if (!(s.bag[id] > 0)) return 'You don\'t have one in your bag.';
    const value = sellValue(id);
    if (value === null) return 'This one cannot be sold.';
    s.bag[id]--;
    if (s.bag[id] <= 0) delete s.bag[id];
    s.cash += value;
    earn(s, 'sold', value);
    return null;
  }

  // Party orders on the notice board: three a day, bigger than a walk in, paid well.
  function ensureOrders(s, feed, t) {
    const day = dayKey(t);
    if (s.orders && s.orders.day === day) return s.orders;
    const r = feed.roundAt(Date.parse(day + 'T00:00:00Z'));
    const rng = WW.Rng(WW.hash32(feed.hashBefore(r), 'orders', day));
    const rarityRoll = () => {
      const x = rng.next();
      return x < 0.5 ? 'c' : x < 0.8 ? 'u' : x < 0.95 ? 'r' : x < 0.995 ? 'e' : 'l';
    };
    const avg = Math.min(11, 4 + s.level * 0.45);
    const items = [];
    for (let i = 0; i < 3; i++) {
      const rar = rarityRoll();
      const sp = rng.pick(WW.ANIMALS_BY_RARITY[rar]);
      const fl = rng.next() < 0.6 ? sp.likes : rng.pick(Object.keys(WW.FLAVOURS));
      // A treat on top of the day's trade, never a living: small parties that pay above the menu.
      const n = Math.max(3, Math.round((4 + s.level * 1.1) * rng.range(0.7, 1.4)));
      const mult = { c: 1.5, u: 1.7, r: 2, e: 2.4, l: 3 }[rar];
      // The grander the party, the better what they bring along.
      const giftTier = rar === 'r' ? 3 : rar === 'e' ? (rng.next() < 0.5 ? 3 : 4) : rar === 'l' ? 4 : 0;
      const open = [2, 3, 4].filter((k) => k <= giftTier && INGREDIENT_LEVELS[k] <= Math.max(2, s.level));
      const gift = open.length ? { id: rng.pick(WW.INGREDIENTS.filter((x) => x.tier === open[open.length - 1])).id, n: rar === 'r' ? 2 : 3 } : null;
      items.push({ id: day + ':' + i, species: sp.id, fl, n, cash: Math.round(n * avg * mult), winks: rar === 'c' ? 0 : rar === 'u' ? 3 : rar === 'r' ? 6 : 12, gift, done: false });
    }
    s.orders = { day, items };
    return s.orders;
  }
  function orderStock(s, order) {
    return inStock(s).filter((k) => dishDef(k).fl.includes(order.fl)).reduce((a, k) => a + s.stock[k], 0);
  }
  function deliverOrder(s, id) {
    const o = s.orders && s.orders.items.find((x) => x.id === id);
    if (!o || o.done) return { error: 'That party has gone home.' };
    if (orderStock(s, o) < o.n) return { error: `You need ${o.n} ${WW.FLAVOURS[o.fl].n.toLowerCase()} portions on the counter.` };
    let left = o.n;
    const keys = inStock(s).filter((k) => dishDef(k).fl.includes(o.fl)).sort((a, b) => s.stock[b] - s.stock[a]);
    for (const k of keys) {
      const take = Math.min(left, s.stock[k]);
      s.stock[k] -= take;
      if (s.stock[k] <= 0) delete s.stock[k];
      left -= take;
      if (!left) break;
    }
    o.done = true;
    s.cash += o.cash;
    earn(s, 'party', o.cash);
    s.winks = Math.min(CFG.WINK_BANK, s.winks + o.winks);
    if (o.gift) s.pantry[o.gift.id] = (s.pantry[o.gift.id] || 0) + o.gift.n;
    s.stats.ordersDone++;
    s.flags.order = true;
    addXp(s, Math.ceil(o.n / 2), s.away);
    const isNew = !s.book[o.species];
    s.book[o.species] = (s.book[o.species] || 0) + 1;
    checkBook(s);
    return { cash: o.cash, winks: o.winks, gift: o.gift || null, isNew, species: o.species };
  }

  // Neighbours

  const homeCache = new Map();
  // A neighbour's restaurant, always the same for the same neighbour. It has the same shape as a save.
  function neighbourHome(nid) {
    if (homeCache.has(nid)) return homeCache.get(nid);
    const n = WW.NEIGHBOUR[nid];
    const rng = WW.Rng(WW.hash32(nid, 'home'));
    // Neighbours grow along the same steps as you, so a house level means the same thing everywhere.
    const step = [{ cols: 12, rows: 5 }, ...EXPANSIONS][rng.int(8)];
    const room = { cols: step.cols, rows: step.rows };
    const pick = (obj) => rng.pick(Object.keys(obj));
    const style = { wall: pick(WW.ROOM_STYLES.wall), floor: pick(WW.ROOM_STYLES.floor), kitchen: pick(WW.ROOM_STYLES.kitchen) };
    const home = {
      room,
      style,
      furniture: [],
      stock: {},
      chef: { name: n.n, fur: n.fur, hat: rng.pick(['toque', 'tall', 'beret', 'bandana', 'acorn']) },
      staff: [{ id: 'head', role: 'head', energy: 100 }],
      stations: [],
      hygiene: 55,
      neighbour: nid,
      shop: n.shop,
      known: {},
      critic: { stars: 0 },
    };
    const of = (kind, maxLvl) => WW.DECOR.filter((d) => d.kind === kind && !d.festival && d.lvl <= maxLvl);
    const put = (id, x, y) => {
      if (!canPlace(home, id, x, y)) {
        home.furniture.push({ id, x, y });
        return true;
      }
      return false;
    };
    const maxLvl = 4 + rng.int(9);
    home.level = maxLvl;
    const tables = of('table', maxLvl).filter((d) => d.w === 1);
    const seats = of('seat', maxLvl).filter((d) => !d.seats);
    for (let y = 0; y < room.rows - 1; y += 2) {
      for (let x = 1; x < room.cols - 2; x += 4) {
        if (rng.next() < 0.75) {
          if (put(rng.pick(tables).id, x, y)) {
            const seat = rng.pick(seats).id;
            put(seat, x - 1, y);
            put(seat, x + 1, y);
          }
        }
      }
    }
    for (const kind of ['rug', 'plant', 'light', 'appliance', 'clean', 'fun', 'attract', 'prestige']) {
      const pool = of(kind, maxLvl);
      const tries = kind === 'rug' ? 2 : 2 + rng.int(3);
      for (let i = 0; i < tries && pool.length; i++) put(rng.pick(pool).id, rng.int(room.cols), rng.int(room.rows));
    }
    const slots = WW.metrics ? WW.metrics(room).slots : 6;
    const count = 3 + rng.int(Math.max(1, slots - 2));
    const types = ['stove', 'wok', 'pot'];
    for (let i = 0; i < Math.min(count, slots); i++) {
      const type = types[i % 3];
      const dishes = WW.DISHES.filter((d) => d.st === type && d.lvl <= maxLvl);
      const job = rng.next() < 0.7 ? { dish: rng.pick(dishes).id, fake: true, pr: rng.next(), chef: i === 0 ? 'head' : null } : null;
      home.stations.push({ type, job, last: null });
    }
    const helpers = 1 + rng.int(3);
    for (let i = 0; i < helpers; i++) {
      const fur = rng.pick(Object.keys(WW.FURS || { golden: 1 }));
      home.staff.push({ id: `${nid}_w${i}`, role: 'waiter', n: 'Helper', fur, energy: 100 });
    }
    const dishes = rng.shuffle(WW.DISHES.filter((d) => d.lvl <= maxLvl)).slice(0, 3 + rng.int(4));
    for (const d of dishes) home.stock[d.id] = 20 + rng.int(200);
    homeCache.set(nid, home);
    return home;
  }

  function neighbourDay(s, nid, t) {
    const day = dayKey(t);
    const v = s.visits[nid] || { first: false, day: null, cleaned: [], shook: false, tasted: false, took: {} };
    if (v.day !== day) {
      v.day = day;
      v.cleaned = [];
      v.shook = false;
      v.tasted = false;
      v.took = {};
    }
    if (!Array.isArray(v.cleaned)) v.cleaned = [];
    if (!v.took) v.took = {};
    s.visits[nid] = v;
    return v;
  }
  // Their floor gets dirty on its own: the same spots for everyone, once a day.
  function neighbourDirt(nid, t, room) {
    const rng = WW.Rng(WW.hash32(nid, dayKey(t), 'dirt'));
    const out = [];
    for (let i = 0; i < 6; i++) out.push({ i, x: 8 + rng.next() * (room.cols * 16 - 16), y: 112 + rng.next() * (room.rows * 16 - 16) });
    return out;
  }
  // What a neighbour hangs out today, from what they grow, with how much is left after your trades.
  function neighbourShelf(s, nid, t) {
    const rng = WW.Rng(WW.hash32(nid, dayKey(t), 'shelf'));
    const v = neighbourDay(s, nid, t);
    const goods = GOODS[nid].filter((id) => INGREDIENT_LEVELS[WW.INGREDIENT[id].tier] <= Math.max(s.level, 2));
    return rng.shuffle(goods).slice(0, 5).map((id) => {
      const [lo, hi] = SHELF_STOCK[WW.INGREDIENT[id].tier];
      const stock = lo + rng.int(hi - lo + 1);
      return { id, locked: rng.next() < 0.4, left: Math.max(0, stock - (v.took[id] || 0)) };
    });
  }
  // Which neighbours have this ingredient out today.
  function whoHas(s, id, t) {
    return NEIGHBOURS.filter((n) => neighbourShelf(s, n.id, t).some((x) => x.id === id && x.left > 0));
  }
  // Neighbours keep growing as the days pass, each at their own pace.
  function neighbourLevel(s, nid, t) {
    const days = Math.max(0, (t - s.created) / 86400000);
    const pace = 0.12 + (WW.hash32(nid, 'pace') % 30) / 100;
    return Math.min(60, neighbourHome(nid).level + Math.floor(days * pace));
  }
  // What a neighbour's building looks like. Better ones open up as they grow, so it changes over the weeks.
  function neighbourExterior(s, nid, t) {
    const level = neighbourLevel(s, nid, t);
    const open = WW.HOUSE_LOOKS.filter((look) => Object.keys(look).every((slot) => WW.EXTERIOR[slot][look[slot]].lvl <= level));
    // Near the best they can afford, and which one is down to taste.
    const taste = WW.hash32(nid, 'outside', open.length) % Math.min(open.length, 5);
    return Object.assign({}, WW.EXTERIOR_DEFAULT, open[open.length - 1 - taste]);
  }
  // How many more times you can go to another street today.
  function streetMovesLeft(s, t) {
    return WW.STREET.MOVES - (s.streetMoves.day === dayKey(t) ? s.streetMoves.n : 0);
  }
  function moveStreet(s, t) {
    if (streetMovesLeft(s, t) <= 0) return 'No more streets today. You can move again tomorrow.';
    const day = dayKey(t);
    if (s.streetMoves.day !== day) s.streetMoves = { day, n: 0 };
    s.streetMoves.n++;
    return null;
  }
  // Five houses at a time, standing wherever the day puts them.
  function streetLots(s, t) {
    const day = dayKey(t);
    const n = s.streetMoves.day === day ? s.streetMoves.n : 0;
    const order = WW.Rng(WW.hash32('street', day, s.created, n >> 1)).shuffle(NEIGHBOURS.slice());
    const start = (n % 2) * 5;
    const lots = WW.Rng(WW.hash32('lots', day, s.created, n)).shuffle(WW.STREET.lots.slice());
    return order.slice(start, start + 5).map((nb, i) => ({ id: nb.id, x: lots[i].x + (WW.hash32(nb.id, day, n) % 25) - 12, y: lots[i].y, ext: neighbourExterior(s, nb.id, t), room: neighbourHome(nb.id).room }));
  }
  function visitFirst(s, nid, t) {
    const v = neighbourDay(s, nid, t);
    s.flags.visited = true;
    if (v.first) return null;
    v.first = true;
    const rng = WW.Rng(WW.hash32(nid, 'first'));
    const pool = WW.INGREDIENTS.filter((i) => i.tier <= 2);
    const gift = rng.pick(pool).id;
    s.pantry[gift] = (s.pantry[gift] || 0) + 4;
    return gift;
  }
  const spotReward = (s) => Math.round(2 + s.level * 0.25);
  const tasteCost = (def) => Math.round(def.p * 8);
  function cleanSpot(s, nid, spot, t) {
    const v = neighbourDay(s, nid, t);
    if (v.cleaned.includes(spot)) return { error: 'Already clean.' };
    v.cleaned.push(spot);
    const b = spotReward(s);
    s.cash += b;
    earn(s, 'chores', b);
    s.stats.floorsCleaned++;
    s.flags.cleanedForFriend = true;
    const loot = rollLoot(s, WW.Rng(WW.hash32(nid, dayKey(t), 'spot', spot, s.created)), 'neighbourSpot');
    return Object.assign({ cash: b, left: 6 - v.cleaned.length }, loot);
  }
  function shakeNeighbour(s, nid, t) {
    const v = neighbourDay(s, nid, t);
    if (v.shook) return { error: 'You already shook their tree today.' };
    v.shook = true;
    const rng = WW.Rng(WW.hash32(nid, dayKey(t), 'tree', s.created));
    const b = 5 + rng.int(10 + s.level * 2);
    s.cash += b;
    earn(s, 'chores', b);
    const out = Object.assign({ cash: b }, rollLoot(s, rng, 'neighbourTree'));
    if (!out.find && !out.ingredient && rng.next() < 0.25) {
      const id = rng.pick(GOODS[nid].filter((x) => INGREDIENT_LEVELS[WW.INGREDIENT[x].tier] <= Math.max(2, s.level)));
      out.ingredient = id;
      out.n = 1;
      s.pantry[id] = (s.pantry[id] || 0) + 1;
    }
    return out;
  }
  // Paying to taste a neighbour's dish whispers something about a recipe you do not know.
  function tasteNeighbour(s, nid, key, t) {
    const v = neighbourDay(s, nid, t);
    if (v.tasted) return { error: 'One taste a day. It is only polite.' };
    const def = WW.DISH[key];
    const cost = tasteCost(def);
    if (s.cash < cost) return { error: `A plate here costs ${cost} cash.` };
    s.cash -= cost;
    v.tasted = true;
    s.winks = Math.min(CFG.WINK_BANK, s.winks + 2);
    if (!s.known[key] && def.lvl <= s.level + 2) {
      const hint = giveHint(s, key);
      if (hint) return { cost, hint, def };
    }
    return { cost, def };
  }
  // You give something of the same level or better. Level is the ingredient's tier, L1 to L4.
  function tradeProblem(give, get) {
    const a = WW.INGREDIENT[give];
    const b = WW.INGREDIENT[get];
    if (a.tier < b.tier) return `${a.n} is L${a.tier}, ${b.n} is L${b.tier}. Give L${b.tier} or better.`;
    return null;
  }
  function tradeWith(s, nid, give, get, t) {
    const shelf = neighbourShelf(s, nid, t);
    const item = shelf.find((i) => i.id === get);
    if (!item) return { error: 'They don\'t have that today.' };
    if (item.left < 1) return { error: 'They have run out of that today.' };
    if (!(s.pantry[give] > 0)) return { error: 'You don\'t have that to give.' };
    const problem = tradeProblem(give, get);
    if (problem) return { error: problem };
    const v = neighbourDay(s, nid, t);
    v.took[get] = (v.took[get] || 0) + 1;
    s.pantry[give]--;
    if (s.pantry[give] <= 0) delete s.pantry[give];
    s.flags.traded = true;
    addXp(s, 2, s.away);
    if (item.locked) {
      s.trades.push({ from: nid, get, give });
      return { pending: true };
    }
    s.pantry[get] = (s.pantry[get] || 0) + 1;
    s.stats.trades++;
    return { done: true };
  }

  function cleanTile(s) {
    s.hygiene = Math.min(100, s.hygiene + 2);
    s.cash += 1;
    earn(s, 'chores', 1);
    s.stats.floorsCleaned++;
    s.flags.cleaned = true;
    return Object.assign({ cash: 1 }, rollLoot(s, WW.Rng(WW.hash32('dirt', s.stats.floorsCleaned, s.created)), 'dirt'));
  }

  // On the Line: the carousel mini game pays tips through the till.
  function lineDay(s, t) {
    const day = dayKey(t);
    if (s.line.day !== day) {
      s.line.day = day;
      s.line.tips = 0;
      s.line.plays = 0;
    }
    return s.line;
  }
  // The carousel is for fun and for XP. It pays less than the dining room, and only so much a day.
  const lineCap = (s) => 70 + s.level * 25;
  function lineTipsLeft(s, t) {
    return Math.max(0, lineCap(s) - lineDay(s, t).tips);
  }
  function lineServe(s, key, combo, replay, t) {
    if (!(s.stock[key] > 0)) return null;
    const line = lineDay(s, t);
    if (line.tips >= lineCap(s)) return null;
    const def = dishDef(key);
    s.stock[key]--;
    if (s.stock[key] <= 0) delete s.stock[key];
    const mult = 0.5 + Math.min(0.5, combo * 0.05);
    const coins = Math.min(lineCap(s) - line.tips, Math.max(1, Math.round(dishPrice(s, def) * mult * (replay ? 0.5 : 1))));
    line.tips += coins;
    if (replay) s.cash += coins;
    else s.till += coins;
    earn(s, 'line', coins);
    s.stats.lineServed++;
    s.stats.earned += coins;
    addXp(s, 1, s.away);
    s.flags.line = true;
    return coins;
  }
  function lineGuest(s, n) {
    return rollGuest(s, n, s.clock.hash + 'line');
  }

  // The prep list: first things to try, with a small reward each. target points at a place in the world.
  const PREP = [
    ['cook', 'Cook something on the stove', (s) => s.flags.cooked_stove, 40, 'stove'],
    ['tree', 'Shake the tree outside', (s) => s.flags.tree, 20, 'tree'],
    ['quiz', 'Answer the daily question on the board', (s) => s.flags.quiz, 20, 'board'],
    ['pot', 'Start a stew in the pot', (s) => s.flags.cooked_pot, 40, 'pot'],
    ['wok', 'Load the wok so it fires when he runs', (s) => s.flags.cooked_wok, 40, 'wok'],
    ['market', 'Buy an ingredient at the market', (s) => s.flags.bought, 20, 'stall'],
    ['visit', 'Walk over to a neighbour on Skirting Street', (s) => s.flags.visited, 30, 'street'],
    ['neighbour_clean', "Clean a spot on a neighbour's floor", (s) => s.flags.cleanedForFriend, 40],
    ['trade', 'Trade an ingredient with a neighbour', (s) => s.flags.traded, 60, 'street'],
    ['shelf', 'Hang something on your trade shelf', (s) => s.flags.shelved, 60],
    ['yard', 'Place something in your yard', (s) => s.yard.length > 0, 60],
    ['exterior', 'Give your restaurant a new look outside', (s) => s.flags.exterior, 80],
    ['first_guest', 'Serve 25 guests', (s) => s.stats.served >= 25, 60],
    ['seat', 'Buy and place a new piece of furniture', (s) => s.flags.placed, 40],
    ['order', 'Deliver a party order from the board', (s) => s.flags.order, 80, 'board'],
    ['experiment', 'Try a new combination in the Test Kitchen', (s) => s.flags.experiment, 40],
    ['lunch', 'Pack a lunchbox', (s) => s.flags.lunch, 20],
    ['line', 'Take a turn On the Line', (s) => s.flags.line, 80],
    ['hire', "Hire a neighbour's hamster", (s) => s.flags.hired, 60],
    ['expand', 'Make the room bigger', (s) => s.flags.expanded, 100],
    ['style', 'Pick a new wall or floor', (s) => s.flags.styled, 60],
    ['dream', 'Cook a Dream Dish', (s) => s.flags.dreamCooked, 80],
    ['book10', 'Meet 10 kinds of guest', (s) => Object.keys(s.book).length >= 10, 60],
    ['upgrade', 'Upgrade a recipe', (s) => s.flags.upgraded, 80],
    ['book25', 'Meet 25 kinds of guest', (s) => Object.keys(s.book).length >= 25, 150],
    ['attract', 'Place something a shy guest looks for', (s) => s.furniture.some((f) => WW.DECOR_BY_ID[f.id].tag), 100],
    ['gear', 'Place a piece of kitchen gear', (s) => s.furniture.some((f) => WW.DECOR_BY_ID[f.id].kind === 'appliance'), 100],
    ['critic', 'Survive a visit from Sir Slowbite', (s) => s.critic.visits > 0, 300],
    ['book50', 'Meet 50 kinds of guest', (s) => Object.keys(s.book).length >= 50, 400],
    ['book100', 'Meet 100 kinds of guest', (s) => Object.keys(s.book).length >= 100, 1000],
  ].map(([id, n, check, reward, target]) => ({ id, n, check, reward, target }));
  WW.PREP = PREP;
  function checkPrep(s) {
    const done = [];
    for (const p of PREP) {
      if (s.prep[p.id]) continue;
      if (p.check(s)) {
        s.prep[p.id] = true;
        s.cash += p.reward;
        earn(s, 'prep', p.reward);
        addXp(s, 8, s.away);
        done.push(p);
      }
    }
    return done;
  }

  WW.Engine = {
    newGame,
    dreamProgress,
    migrate,
    advance,
    pulse,
    takeReport,
    dishDef,
    dreamDef,
    dishPrice,
    seatsOf,
    capacity,
    hasDecor,
    fxOf,
    gridOf,
    ratingPoints,
    ratingStars,
    tipFactor,
    inStock,
    meetsNeeds,
    xpNeed,
    staffLimits,
    stationProgress,
    canCook,
    startCook,
    missingCost,
    buyMissing,
    buyIngredient,
    ensureMarket,
    ensureOrders,
    orderStock,
    deliverOrder,
    quizFor,
    answerQuiz,
    shakeTree,
    experiment,
    buyHint,
    upgradeCost,
    upgradeDish,
    packLunch,
    feedStaff,
    hireFee,
    hire,
    fire,
    nextStation,
    buyStation,
    nextExpansion,
    roomLevel,
    batchInfo,
    ingredientPrice,
    spotReward,
    tasteCost,
    expandRoom,
    buyStyle,
    buyExterior,
    seasonOf,
    weatherOf,
    skyTips,
    charmOf,
    attractOf,
    neighbourExterior,
    streetLots,
    streetMovesLeft,
    moveStreet,
    canPlace,
    moveToFeed,
    buyDecor,
    placeDecor,
    moveDecor,
    storeDecor,
    sellDecor,
    sellValue,
    shelfSlots,
    shelfPut,
    shelfTake,
    shelfLock,
    mailCount,
    mailRead,
    mailClear,
    mailAccept,
    mailDecline,
    whoHas,
    neighbourLevel,
    neighbourHome,
    neighbourDay,
    neighbourDirt,
    neighbourShelf,
    visitFirst,
    cleanSpot,
    shakeNeighbour,
    tasteNeighbour,
    tradeProblem,
    tradeWith,
    cleanTile,
    lineDay,
    lineServe,
    lineCap,
    lineTipsLeft,
    lineGuest,
    criticPick,
    criticVerdict,
    prepareCritic,
    checkPrep,
    addLog,
    dayKey,
  };
})((globalThis.WW = globalThis.WW || {}));
