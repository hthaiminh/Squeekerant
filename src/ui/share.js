// A picture of your restaurant to show people, painted by the game's own painters from what is really there.
// What it shows is first written down as plain data. The game paints that data for you to look at, and the server
// paints the very same data for the picture's own link, which X, Discord and Telegram show as a large picture.
// On a phone the picture itself goes to the share sheet.
(function (WW) {
  const { C, el, btn, fmt } = WW;
  const E = () => WW.Engine;
  const W = 1200;
  const H = 630;
  const SITE = 'www.squeekerant.online';
  const RARITY = { l: 5, e: 4, r: 3, u: 2, c: 1 };
  const OUT = WW.OUTSIDE;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // The page's own fonts. The test build writes everything in VT323, the only one with the Vietnamese letters.
  function fonts() {
    const css = getComputedStyle(document.documentElement);
    const pick = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
    const body = pick('--body', 'monospace');
    if (WW.I18N) return { head: body, display: body, body };
    return { head: pick('--logo', 'monospace'), display: pick('--display', 'monospace'), body };
  }
  // Loaded for the very letters on the picture, so a name with letters the pixel fonts lack is written the same way the server writes it.
  async function fontsReady(f, texts) {
    if (!document.fonts || !document.fonts.load) return;
    const all = Promise.all([[`700 40px ${f.head}`, texts.head], [`40px ${f.display}`, texts.display], [`40px ${f.body}`, texts.body]].map(([spec, text]) => document.fonts.load(spec, text || 'Aa').catch(() => null)));
    await Promise.race([all, wait(1500)]);
  }

  // What is in the picture

  const tenth = (n) => Math.round(n * 10) / 10;
  const hundredth = (n) => Math.round(n * 100) / 100;

  // The restaurant from the save, and this moment from the screen, as plain data.
  function snapshot(game) {
    const s = game.s;
    const main = game.scene;
    const live = game.live || { state: 'quiet', rpm: 0 };
    const sky = game.sky();
    // Out visiting, the people on screen are someone else's, so your own staff stand at their usual places.
    const home = !game.visit;
    const met = Object.keys(s.book).map((id) => WW.ANIMAL[id]).filter(Boolean);
    met.sort((a, b) => RARITY[b.rar] - RARITY[a.rar] || (s.book[b.id] || 0) - (s.book[a.id] || 0));
    const at = (a) => [tenth(a.x), tenth(a.y)];
    const moving = (a) => (a.path && a.path.length ? 1 : 0);
    const ranks = game.topRanks();
    return {
      v: 1,
      seed: Math.floor(Math.random() * 2147483647),
      shop: s.shop,
      chef: [s.chef.name, s.chef.fur, s.chef.hat],
      level: s.level,
      served: s.stats.served,
      met: met.length,
      stars: tenth(E().ratingStars(s)),
      parade: met.slice(0, 7).map((a) => a.id),
      dream: game.feed.mode === 'live' && s.dreamDish ? s.dreamDish.key : null,
      room: [s.room.cols, s.room.rows],
      style: [s.style.wall, s.style.floor, s.style.kitchen],
      furniture: s.furniture.map((f) => [f.id, f.x, f.y]),
      yard: s.yard.map((f) => [f.id, f.x, f.y]),
      exterior: Object.assign({}, s.exterior),
      stations: s.stations.map((st) => [st.type, st.job ? st.job.dish : null, st.job ? hundredth(E().stationProgress(s, st, game.feed, game.now())) : 0]),
      stock: E().inStock(s).map((k) => [k, s.stock[k]]),
      staff: s.staff.map((w) => [w.id, w.role, w.fur || '', w.energy < 1 ? 1 : 0]),
      shelf: s.shelf.length ? 1 : 0,
      mail: E().mailCount(s) ? 1 : 0,
      season: sky.season,
      weather: sky.weather,
      night: hundredth(main.nightAmt),
      live: live.state,
      rpm: Math.round(live.rpm || 0),
      guests: home ? main.guests.filter((g) => g.zone === 'in').map((g) => [g.sp.id, ...at(g), g.dir < 0 ? -1 : 1, g.state, g.seat ? [g.seat.x, g.seat.y] : null, g.plate || null, tenth(g.speed)]) : [],
      road: home ? main.guests.filter((g) => g.zone === 'out').map((g) => [g.sp.id, ...at(g), g.dir < 0 ? -1 : 1, g.state]) : [],
      chefs: home ? [...main.chefs.values()].map((c) => [c.id, ...at(c), c.state]) : [],
      waiters: home ? [...main.waiters.values()].map((w) => [w.id, ...at(w), w.state, w.state === 'carry' && w.job ? w.job.res.dish : null, moving(w)]) : [],
      cleaners: home ? [...main.cleaners.values()].map((c) => [c.id, ...at(c), moving(c)]) : [],
      robots: home ? main.robots.map(at) : [],
      dirt: home ? main.dirt.map(at) : [],
      ranks: ranks.map((r) => [r.place, r.name, r.level]),
      note: ranks.length ? [] : game.ranksNote(),
    };
  }

  // Checking a picture. The server paints only what passes, so nothing in it can be other than the game's own pieces.
  // Whatever is not one of them is left out. A picture without a proper restaurant is no picture at all.
  const has = (table, key) => typeof key === 'string' && Object.prototype.hasOwnProperty.call(table, key);
  const whole = (v, lo, hi) => Number.isSafeInteger(v) && v >= lo && v <= hi;
  const real = (v, lo, hi) => typeof v === 'number' && v >= lo && v <= hi;
  const word = (v) => (typeof v === 'string' && /^[a-z]{1,12}$/.test(v) ? v : null);
  const text = (v, max, fallback) => {
    const plain = typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, '').replace(/\s+/g, ' ').trim() : '';
    return Array.from(plain).slice(0, max).join('').trim() || fallback;
  };
  const rows = (v, max, each) => (Array.isArray(v) ? v.slice(0, max).map((r) => (Array.isArray(r) ? each(r) : null)).filter(Boolean) : []);
  const isDream = (k) => typeof k === 'string' && /^d:\d{1,3}(:g)?$/.test(k) && Number(k.split(':')[1]) < WW.DREAMS.length;
  const isDish = (k) => isDream(k) || has(WW.DISH, k);
  const ROLES = ['head', 'sous', 'waiter', 'cleaner'];
  const STATIONS = ['stove', 'wok', 'pot'];
  const LIVE = ['running', 'breather', 'quiet', 'unknown'];

  function cleanPicture(raw) {
    const p = raw && typeof raw === 'object' ? raw : {};
    if (p.v !== 1 || !Array.isArray(p.room) || !Array.isArray(p.style) || !Array.isArray(p.chef)) return null;
    const room = { cols: p.room[0], rows: p.room[1] };
    if (![{ cols: 12, rows: 5 }].concat(WW.EXPANSIONS).some((e) => e.cols === room.cols && e.rows === room.rows)) return null;
    if (!whole(p.level, 1, 200) || !whole(p.served, 0, 1e12) || !whole(p.seed, 0, 2147483647)) return null;
    const styles = WW.ROOM_STYLES;
    const m = WW.metrics(room);
    const inRoom = (x, y) => real(x, -40, m.W + 40) && real(y, -40, m.H + 40);
    const onRoad = (x, y) => real(x, -60, OUT.W + 60) && real(y, -40, OUT.H + 40);
    const staff = rows(p.staff, 80, ([id, role, fur, asleep]) => (typeof id === 'string' && /^[a-z0-9_]{1,32}$/.test(id) && ROLES.includes(role) ? [id, role, has(WW.FURS, fur) ? fur : 'golden', asleep ? 1 : 0] : null));
    if (!staff.some((w) => w[1] === 'head')) staff.unshift(['head', 'head', 'golden', 0]);
    const ids = new Set(staff.map((w) => w[0]));
    const exterior = {};
    for (const slot of Object.keys(WW.EXTERIOR)) exterior[slot] = p.exterior && has(WW.EXTERIOR[slot], p.exterior[slot]) ? p.exterior[slot] : WW.EXTERIOR_DEFAULT[slot];
    const animal = (id) => has(WW.ANIMAL, id);
    return {
      v: 1,
      seed: p.seed,
      shop: text(p.shop, 22, 'The Tiny Table'),
      chef: [text(p.chef[0], 14, 'Bean'), has(WW.FURS, p.chef[1]) ? p.chef[1] : 'golden', has(WW.HATS, p.chef[2]) ? p.chef[2] : 'toque'],
      level: p.level,
      served: p.served,
      met: whole(p.met, 0, WW.ANIMALS.length) ? p.met : 0,
      stars: real(p.stars, 0, 5) ? tenth(p.stars) : 0,
      parade: Array.isArray(p.parade) ? Array.from(new Set(p.parade.filter(animal))).slice(0, 7) : [],
      dream: isDream(p.dream) ? p.dream : null,
      room: [room.cols, room.rows],
      style: [has(styles.wall, p.style[0]) ? p.style[0] : 'teal', has(styles.floor, p.style[1]) ? p.style[1] : 'oak', has(styles.kitchen, p.style[2]) ? p.style[2] : 'cream'],
      furniture: rows(p.furniture, 300, ([id, x, y]) => (has(WW.DECOR_BY_ID, id) && WW.DECOR_BY_ID[id].kind !== 'yard' && whole(x, 0, room.cols - 1) && whole(y, 0, room.rows - 1) ? [id, x, y] : null)),
      yard: rows(p.yard, 300, ([id, x, y]) => (has(WW.DECOR_BY_ID, id) && WW.DECOR_BY_ID[id].kind === 'yard' && whole(x, 0, OUT.W / 16 - 1) && whole(y, 0, OUT.H / 16 - 1) ? [id, x, y] : null)),
      exterior,
      stations: rows(p.stations, 14, ([type, dish, pr]) => (STATIONS.includes(type) ? [type, isDish(dish) ? dish : null, real(pr, 0, 1) ? pr : 0] : null)),
      stock: rows(p.stock, 40, ([dish, n]) => (isDish(dish) && whole(n, 1, 1e9) ? [dish, n] : null)),
      staff,
      shelf: p.shelf ? 1 : 0,
      mail: p.mail ? 1 : 0,
      season: has(WW.SEASONS, p.season) ? p.season : Object.keys(WW.SEASONS)[0],
      weather: has(WW.WEATHER, p.weather) ? p.weather : 'clear',
      night: real(p.night, 0, 1) ? p.night : 0,
      live: LIVE.includes(p.live) ? p.live : 'quiet',
      rpm: real(p.rpm, 0, 300) ? Math.round(p.rpm) : 0,
      guests: rows(p.guests, 70, ([id, x, y, dir, state, seat, plate, speed]) =>
        animal(id) && inRoom(x, y) && word(state) ? [id, x, y, dir < 0 ? -1 : 1, state, Array.isArray(seat) && whole(seat[0], 0, room.cols - 1) && whole(seat[1], 0, room.rows - 1) ? [seat[0], seat[1]] : null, isDish(plate) ? plate : null, real(speed, 0, 60) ? speed : 20] : null
      ),
      road: rows(p.road, 70, ([id, x, y, dir, state]) => (animal(id) && onRoad(x, y) && word(state) ? [id, x, y, dir < 0 ? -1 : 1, state] : null)),
      chefs: rows(p.chefs, 40, ([id, x, y, state]) => (ids.has(id) && inRoom(x, y) && word(state) ? [id, x, y, state] : null)),
      waiters: rows(p.waiters, 40, ([id, x, y, state, dish, moving]) => (ids.has(id) && inRoom(x, y) && word(state) ? [id, x, y, state, isDish(dish) ? dish : null, moving ? 1 : 0] : null)),
      cleaners: rows(p.cleaners, 20, ([id, x, y, moving]) => (ids.has(id) && inRoom(x, y) ? [id, x, y, moving ? 1 : 0] : null)),
      robots: rows(p.robots, 4, ([x, y]) => (inRoom(x, y) ? [x, y] : null)),
      dirt: rows(p.dirt, 20, ([x, y]) => (inRoom(x, y) ? [x, y] : null)),
      ranks: rows(p.ranks, 10, ([place, name, level]) => (whole(place, 1, 1e7) && whole(level, 1, 200) ? [place, text(name, 15, '?').toUpperCase(), level] : null)),
      note: Array.isArray(p.note) ? p.note.slice(0, 3).map((line) => text(line, 24, '').toUpperCase()).filter(Boolean) : [],
    };
  }

  // Painting a picture

  // The little lives in a scene run on Math.random. In a picture they follow its own seed, so both painters agree.
  function seeded(seed, paint) {
    const own = Math.random;
    Math.random = WW.Rng(seed).next;
    try {
      return paint();
    } finally {
      Math.random = own;
    }
  }

  // Only what a scene reads to draw a restaurant.
  function pictureSave(p) {
    return {
      shop: p.shop,
      chef: { name: p.chef[0], fur: p.chef[1], hat: p.chef[2] },
      level: p.level,
      room: { cols: p.room[0], rows: p.room[1] },
      style: { wall: p.style[0], floor: p.style[1], kitchen: p.style[2] },
      furniture: p.furniture.map(([id, x, y]) => ({ id, x, y })),
      yard: p.yard.map(([id, x, y]) => ({ id, x, y })),
      exterior: Object.assign({}, p.exterior),
      stations: p.stations.map(([type, dish, pr]) => ({ type, job: dish ? { dish, fake: true, pr } : null, last: null })),
      stock: Object.fromEntries(p.stock),
      staff: p.staff.map(([id, role, fur, asleep]) => ({ id, role, fur, energy: asleep ? 0 : 100 })),
      shelf: p.shelf ? [{}] : [],
      mail: p.mail ? [{ kind: 'note', read: false }] : [],
      hygiene: 100,
    };
  }

  // A stand in for the game that only looks, at a moment that is already over.
  function stageFor(p, s) {
    const service = p.live === 'running' || p.live === 'breather';
    const sky = { round: 0, season: p.season, day: 1, weather: p.weather };
    const ranks = p.ranks.map(([place, name, level]) => ({ place, name, level }));
    return {
      s,
      visit: null,
      speed: 1,
      still: true,
      hasMouse: true,
      live: { state: p.live, rpm: p.rpm, agoMs: 0 },
      feed: { mode: 'picture' },
      isService: () => service,
      isAwake: () => p.night < 0.5,
      sky: () => sky,
      now: () => 0,
      desktop: () => true,
      streetLots: () => [],
      nextTarget: () => null,
      boardWaiting: () => false,
      topRanks: () => ranks,
      ranksNote: () => p.note,
      treeReady: () => false,
      sound() {},
      onNewSpecies() {},
    };
  }

  const animal = (id, x, y, dir, state, zone) => {
    const sp = WW.ANIMAL[id];
    return { sp, frames: WW.animalFrames(sp), x, y, dir, state, zone, speed: 20, fly: sp.a === 'flyer', seat: null, t: 9 };
  };

  // Everyone in the room where they were.
  function dressRoom(sc, p, s) {
    if (!p.chefs.length) return sc.syncStaff();
    const seats = E().seatsOf(s);
    sc.guests = p.guests.map(([id, x, y, dir, state, seat, plate, speed]) => {
      const g = animal(id, x, y, dir, state, 'in');
      g.seat = (seat && seats.find((q) => q.x === seat[0] && q.y === seat[1])) || null;
      g.plate = g.seat ? plate : null;
      g.speed = speed;
      return g;
    });
    const asleep = new Set(p.staff.filter((w) => w[3]).map((w) => w[0]));
    sc.chefs = new Map(p.chefs.map(([id, x, y, state]) => [id, { id, x, y, state, path: [] }]));
    sc.waiters = new Map(p.waiters.map(([id, x, y, state, dish, moving]) => [id, { id, x, y, state, job: dish ? { res: { dish } } : null, path: moving ? [{ x, y }] : [], asleep: asleep.has(id) }]));
    sc.cleaners = new Map(p.cleaners.map(([id, x, y, moving]) => [id, { id, x, y, path: moving ? [{ x, y }] : [] }]));
    sc.robots = p.robots.map(([x, y]) => ({ x, y, path: [] }));
    sc.dirt = p.dirt.map(([x, y]) => ({ x, y }));
  }

  // One of the game's places, seen by a camera of its own.
  function look(stage, p, view, w, h, z, aim) {
    const sc = new WW.Scene(WW.makeCanvas(w, h), stage);
    // No lightning in a still picture.
    sc.calm = true;
    sc.view = view;
    sc.setViewport(w, h, 1);
    sc.cam.user = true;
    sc.cam.z = z;
    sc.applyZoom();
    aim(sc);
    sc.clamp();
    // One short step fills the road with passers by.
    sc.update(0.05);
    sc.nightAmt = p.night;
    if (view === 'in') dressRoom(sc, p, stage.s);
    else sc.guests = p.road.map(([id, x, y, dir, state]) => animal(id, x, y, dir, state, 'out'));
    sc.draw();
    return sc;
  }

  // The same cut corners and hard shadow as every ticket in the game.
  function ticket(x, left, top, w, h, fill = C.paper, line = 4) {
    x.fillStyle = 'rgba(58,35,64,0.45)';
    x.fillRect(left + 10, top + 12, w + line, h + line);
    x.fillStyle = C.ink;
    x.fillRect(left, top - line, w, h + line * 2);
    x.fillRect(left - line, top, w + line * 2, h);
    x.fillStyle = fill;
    x.fillRect(left, top, w, h);
  }
  function dots(x, left, right, y, colour = C.oat) {
    x.fillStyle = colour;
    for (let i = left; i < right; i += 8) x.fillRect(i, y, 4, 3);
  }
  function scaled(x, canvas, left, top, k) {
    x.imageSmoothingEnabled = false;
    x.drawImage(canvas, Math.round(left), Math.round(top), canvas.width * k, canvas.height * k);
  }
  // Writes a line no wider than the room it has, shrinking it if it must.
  function fitText(x, line, family, weight, size, maxW, min = 16) {
    let s = size;
    for (; s > min; s -= 2) {
      x.font = `${weight} ${s}px ${family}`;
      if (x.measureText(line).width <= maxW) break;
    }
    return s;
  }

  // The whole picture: your building in the woods as they were, a look inside, and the facts on a ticket.
  function paintPicture(p, f) {
    return seeded(p.seed, () => paintCard(p, f));
  }
  function paintCard(p, f) {
    const s = pictureSave(p);
    const stage = stageFor(p, s);
    const card = WW.makeCanvas(W, H);
    const x = card.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.textBaseline = 'alphabetic';
    const tr = WW.tr;
    const tw = 384;
    const tl = W - tw - 40;

    // Inside first, to know how much room its frame takes. As big as whole pixels allow.
    const inside = look(stage, p, 'in', 400, 300, 1, () => {});
    const room = inside.low;
    const zoom = Math.max(1, Math.min(2, Math.floor(Math.min(440 / room.width, 440 / room.height))));
    const rw = room.width * zoom;
    const rh = room.height * zoom;
    const frameL = 44;
    const frameT = H - rh - 62;

    // Outside, with your door between the frame and the ticket and the road along the bottom.
    const z = 2;
    const doorAt = Math.round((frameL + rw + tl) / 2);
    const outside = look(stage, p, 'out', W, H, z, (sc) => {
      sc.cam.x = Math.round(OUT.DOOR.x - doorAt / z);
      sc.cam.y = Math.round(OUT.DOOR.y + 58 - H / z);
    });
    x.drawImage(outside.canvas, 0, 0, W, H);

    // The name of the game, over the trees.
    scaled(x, WW.logoCanvas(), 40, 30, 3);

    ticket(x, frameL - 12, frameT - 12, rw + 24, rh + 46, C.paper, 4);
    scaled(x, room, frameL, frameT, zoom);
    x.fillStyle = C.plum;
    x.font = `22px ${f.body}`;
    x.textAlign = 'left';
    x.fillText(tr('Inside, right now'), frameL, frameT + rh + 26);

    // The ticket with the facts.
    const tt = 34;
    const th = H - tt * 2;
    ticket(x, tl, tt, tw, th);
    const cx = tl + tw / 2;
    const pad = 22;
    let y = tt + 20;
    x.textAlign = 'center';
    const nameSize = fitText(x, p.shop, f.head, 700, 42, tw - pad * 2, 22);
    x.fillStyle = C.brick;
    x.fillText(p.shop, cx, y + nameSize * 0.82);
    y += nameSize + 12;
    dots(x, tl + pad, tl + tw - pad, y);
    y += 14;

    // The head chef, with the level beside them.
    const chef = WW.hamsterPose({ fur: s.chef.fur, hat: s.chef.hat, job: 'chef' }, 0);
    scaled(x, chef, tl + pad, y, 4);
    x.textAlign = 'left';
    const tx = tl + pad + chef.width * 4 + 18;
    x.fillStyle = C.plum;
    x.font = `22px ${f.body}`;
    x.fillText(tr('Head chef'), tx, y + 26);
    fitText(x, s.chef.name, f.display, 400, 32, tl + tw - pad - tx, 18);
    x.fillStyle = C.ink;
    x.fillText(s.chef.name, tx, y + 56);
    x.font = `400 36px ${f.display}`;
    x.fillStyle = C.tomato;
    x.fillText(tr(`Level ${p.level}`), tx, y + 92);
    y += chef.height * 4 + 14;

    const house = E().roomLevel(s.room);
    const none = tr('none yet');
    const line = (label, value) => {
      dots(x, tl + pad, tl + tw - pad, y);
      x.font = `22px ${f.body}`;
      x.fillStyle = C.plum;
      x.textAlign = 'left';
      x.fillText(tr(label), tl + pad, y + 24);
      x.font = `400 24px ${f.display}`;
      x.fillStyle = C.ink;
      x.textAlign = 'right';
      x.fillText(value, tl + tw - pad, y + 24);
      y += 32;
    };
    line('Guests fed', p.served ? fmt(p.served) : none);
    line('Kinds of guests met', p.met ? tr(`${p.met} of ${WW.ANIMALS.length}`) : none);
    line('Rating', tr(`${p.stars.toFixed(1)} of 5`));
    line('House', tr(`Level ${house.level} of ${house.top}`));
    dots(x, tl + pad, tl + tw - pad, y);
    y += 14;

    const dream = p.dream ? E().dishDef(p.dream) : null;
    if (dream) {
      scaled(x, WW.dishIcon(dream, dream.gold), tl + pad, y, 3);
      x.textAlign = 'left';
      x.fillStyle = C.plum;
      x.font = `22px ${f.body}`;
      x.fillText(tr('His latest dream'), tl + pad + 62, y + 19);
      fitText(x, dream.n, f.display, 400, 26, tw - pad * 2 - 62, 16);
      x.fillStyle = dream.gold ? C.gold : C.ink;
      x.fillText(dream.n, tl + pad + 62, y + 44);
      y += 58;
    }

    // The guests you have met, rarest first, just above the foot of the ticket and never over it.
    const foot = tt + th - 76;
    if (p.parade.length && y <= foot - 50) {
      const step = Math.min(48, Math.floor((tw - pad * 2) / p.parade.length));
      const left = cx - (step * p.parade.length) / 2 + (step - 40) / 2;
      p.parade.forEach((id, i) => scaled(x, WW.animalFrames(WW.ANIMAL[id])[0], left + i * step, foot - 50, 2));
    }

    // The way in, at the foot of the ticket.
    dots(x, tl + pad, tl + tw - pad, foot + 2);
    x.textAlign = 'center';
    x.fillStyle = C.plum;
    x.font = `22px ${f.body}`;
    x.fillText(tr('Run by a real hamster'), cx, tt + th - 44);
    fitText(x, SITE, f.display, 400, 30, tw - pad * 2, 18);
    x.fillStyle = C.brick;
    x.fillText(SITE, cx, tt + th - 14);
    return card;
  }

  // The words that go with it. The player can change them before posting.
  function words(p) {
    const main = WW.tr(`My tiny restaurant ${p.shop} is level ${p.level}. A real hamster, @squeekchain's Squeektoshi, decides when guests walk in.`);
    const dream = p.dream ? E().dishDef(p.dream) : null;
    return dream ? `${main} ${WW.tr(`His latest dream: ${dream.n}.`)}` : main;
  }

  const fileName = (shop) => {
    const plain = String(shop).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `squeekerant-${plain || 'my-restaurant'}.png`;
  };

  // Sharing it

  class Share {
    constructor(game) {
      this.game = game;
      this.busy = false;
    }
    async open() {
      const g = this.game;
      if (!g.s || g.practice || this.busy) return;
      this.busy = true;
      g.sound('tap');
      g.count.daily('share_open');
      g.showTicket(el('h2', null, 'Share your restaurant'), el('p', { class: 'note' }, 'Painting your picture...'));
      try {
        const f = fonts();
        const pic = cleanPicture(snapshot(g));
        if (!pic) throw new Error('This restaurant cannot be painted.');
        const dream = pic.dream ? E().dishDef(pic.dream).n : '';
        const labels = ['Inside, right now', 'Head chef', 'Guests fed', 'Kinds of guests met', 'Rating', 'House', 'none yet', 'His latest dream', 'Run by a real hamster'].map((l) => WW.tr(l)).join(' ');
        await fontsReady(f, { head: pic.shop, display: `${pic.chef[0]} ${WW.tr(dream)} ${SITE} ${WW.tr(`Level ${pic.level}`)} 0123456789`, body: labels });
        const card = paintPicture(pic, f);
        const blob = await new Promise((res) => card.toBlob(res, 'image/png'));
        this.show(card, blob, pic);
      } catch (e) {
        g.showTicket(el('h2', null, 'Share your restaurant'), el('p', null, 'The picture could not be painted here.'), g.actions(btn('Close', () => g.closeOverlay(), 'plain')));
      } finally {
        this.busy = false;
      }
    }
    // The picture's own address, so a post can show it. The server checks it and paints its own copy.
    // Null when that cannot happen, and the post links the game instead.
    async linkFor(pic) {
      try {
        const res = await fetch('/api/picture', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(pic), signal: AbortSignal.timeout(12000) });
        const out = await res.json();
        return res.ok && out && out.ok && typeof out.url === 'string' ? out.url : null;
      } catch (e) {
        return null;
      }
    }
    show(card, blob, pic) {
      const g = this.game;
      const text = words(pic);
      const url = card.toDataURL('image/png');
      const name = fileName(pic.shop);
      const file = blob && typeof File === 'function' ? new File([blob], name, { type: 'image/png' }) : null;
      const sheet = !g.hasMouse && file && navigator.canShare && navigator.share && navigator.canShare({ files: [file] });
      const copyable = !!(blob && navigator.clipboard && navigator.clipboard.write && globalThis.ClipboardItem);
      let link = null;
      const post = async () => {
        g.count.daily('share_post');
        // The tab opens at once, while the browser still counts the press, and goes to X when the picture has its link.
        const tab = window.open('', '_blank');
        if (!tab) return g.toast('This browser stopped X from opening.', 'bad', null, 6000);
        try {
          tab.opener = null;
          tab.document.title = 'Opening X...';
        } catch (e) {}
        link = link || this.linkFor(pic);
        const address = await link;
        if (!address) link = null;
        tab.location.href = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(address || 'https://' + SITE)}`;
        if (!address) g.toast('The picture could not go with the post this time. Save it, then add it to your post.', 'bad', null, 7000);
      };
      const viaSheet = async () => {
        g.count.daily('share_post');
        try {
          await navigator.share({ files: [file], text: `${text} https://${SITE}` });
        } catch (e) {
          if (e && e.name !== 'AbortError') g.toast('That could not be shared from here.', 'bad');
        }
      };
      const save = () => {
        g.count.daily('share_save');
        const a = el('a', { href: url, download: name });
        document.body.append(a);
        a.click();
        a.remove();
      };
      const copyOnly = async () => {
        g.count.daily('share_copy');
        let ok = false;
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          ok = true;
        } catch (e) {}
        g.toast(ok ? 'Picture copied.' : 'Could not copy the picture here. Save it instead.', ok ? 'good' : 'bad');
      };
      const close = () => g.closeOverlay();
      // The Artifact viewer cannot reach X or save files. The picture still shows, for a look.
      const preview = !!globalThis.claude;
      g.showTicket(
        { ticketClass: 'sharecard' },
        el('h2', null, 'Share your restaurant'),
        el('img', { class: 'sharepic', src: url, alt: `A picture of ${pic.shop}` }),
        el('p', { class: 'note', style: 'margin-top:8px' }, preview ? 'Sharing works on the real site, www.squeekerant.online.' : sheet ? 'Send it to any app, X included.' : 'Post on X shows this picture in your post.'),
        g.actions(
          btn('Close', close, 'plain'),
          preview ? null : btn('Save picture', save, 'plain'),
          preview || sheet || !copyable ? null : btn('Copy picture', copyOnly, 'plain'),
          preview ? null : sheet ? btn('Share picture', viaSheet, 'tomato') : btn('Post on X', post, 'tomato')
        )
      );
    }
  }

  WW.Share = Share;
  WW.pictureOf = snapshot;
  WW.cleanPicture = cleanPicture;
  WW.paintPicture = paintPicture;
  WW.pictureWords = words;
})((globalThis.WW = globalThis.WW || {}));
