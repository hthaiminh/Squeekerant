// The world on the canvas. One world keeps running underneath; inside, outside and the street are places to look at it from.
(function (WW) {
  const { C, WORLD } = WW;
  const TILE = WORLD.TILE;
  const DY = WORLD.DINING_Y;
  const E = () => WW.Engine;
  const OUT = WW.OUTSIDE;
  const STREET = WW.STREET;
  const FADE = 0.2;
  // Guests walk a little quicker on the open road, it is a long way to the door.
  const ROAD_PACE = 1.35;
  const ROUND_SECONDS = 600;

  const tileCenter = (col, row) => ({ x: col * TILE + 8, y: DY + row * TILE + 13 });
  const inRect = (x, y, r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
  const SKY_DAY = { clear: '#9fd8f0', cloudy: '#b8c8d4', rain: '#8fa4b4', storm: '#6f7f90', fog: '#d0d8d8', snow: '#c8d4dc', petals: '#b4e0f0', leaves: '#b4d4e0' };
  const SUN_SHOWS = { clear: 1, cloudy: 0.5, rain: 0.15, storm: 0, fog: 0.3, snow: 0.3, petals: 1, leaves: 0.8 };
  const TINT = { cloudy: ['#dce0e8', 0.5], rain: ['#b4c0cc', 0.7], storm: ['#8f9aac', 0.85], fog: ['#dde2e4', 0.5], snow: ['#e8eef4', 0.5] };
  const DROPS = { rain: 70, storm: 110, snow: 60, petals: 18, leaves: 18 };

  class Scene {
    constructor(canvas, game) {
      this.canvas = canvas;
      this.game = game;
      this.out = canvas.getContext('2d');
      this.low = WW.makeCanvas(192, 224);
      this.ctx = this.low.getContext('2d');
      this.view = 'in';
      this.cams = { in: { x: 0, y: 0, z: 2 }, out: { x: 0, y: 0, z: 2 }, street: { x: 0, y: 0, z: 2 } };
      this.css = { w: 400, h: 400 };
      this.dpr = 1;
      this.ku = 2;
      this.hover = null;
      this.editing = null;
      this.t = 0;
      this.nightAmt = 0;
      this.wheelAngle = 0;
      this.gearAngle = 0;
      this.visitClock = 0;
      this.treeShake = {};
      this.fading = null;
      this.drops = [];
      this.critters = [];
      this.walkers = [];
      this.flash = 0;
      this.calm = globalThis.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)').matches : false;
      this.reset();
    }

    // What is on screen: your restaurant, or the one you are visiting.
    get st() {
      return this.game.visit ? this.game.visit.home : this.game.s;
    }
    get cam() {
      return this.cams[this.view];
    }

    reset() {
      this.guests = [];
      this.coming = [];
      this.comingClock = 0;
      this.parts = [];
      this.floats = [];
      this.waiters = new Map();
      this.chefs = new Map();
      this.cleaners = new Map();
      this.robots = [];
      this.seatUse = new Map();
      this.orders = [];
      this.dirt = [];
      this.roomKey = null;
      this.imKey = null;
    }

    // The room behind the door, whichever place is on screen.
    inner() {
      const st = this.st;
      const key = st.room.cols + 'x' + st.room.rows;
      if (this.imKey !== key) {
        this.imKey = key;
        this.im = WW.metrics(st.room);
      }
      return this.im;
    }

    // Moving between places

    // Fades out, changes place, fades back in.
    goTo(view, then, done) {
      if (this.fading) return;
      this.fading = { view, then, done, t: 0, swapped: false };
    }
    setView(view) {
      this.view = view;
      this.roomKey = null;
      this.hover = null;
      this.drops = [];
      this.critters = [];
      this.syncRoom();
    }

    // Camera

    syncRoom() {
      const st = this.st;
      if (!st) return;
      const key = this.view === 'in' ? 'in' + st.room.cols + 'x' + st.room.rows : this.view;
      if (key === this.roomKey) return;
      const seen = this.cam.key === key;
      this.roomKey = key;
      this.m = this.view === 'in' ? this.inner() : this.view === 'out' ? OUT : STREET;
      this.low.width = this.m.W;
      this.low.height = this.m.H;
      this.ctx = this.low.getContext('2d');
      this.ctx.imageSmoothingEnabled = false;
      // Coming back to a place finds the camera where you left it.
      if (seen) {
        this.applyZoom();
        this.clamp();
        return;
      }
      this.cam.key = key;
      this.cam.user = false;
      this.fitCamera();
      this.focus();
    }

    setViewport(w, h, dpr) {
      this.css = { w, h };
      this.dpr = dpr;
      this.syncRoom();
      if (this.m) this.fitCamera();
    }

    zoomLimits() {
      const m = this.m;
      // Outside is a whole world, so it always fills the screen. Only the room can be smaller than the view.
      if (this.view !== 'in') {
        const cover = Math.max(this.css.w / m.W, this.css.h / m.H) * 1.001;
        return { fit: cover, min: cover, max: Math.max(6, cover) };
      }
      const fit = Math.min(this.css.w / m.W, this.css.h / m.H);
      return { fit, min: Math.min(fit, 1.2), max: Math.max(6, fit) };
    }

    // Shows the whole place when it fits at a good size, otherwise stays large and lets you drag.
    fitCamera() {
      if (!this.m) return;
      const { fit, min } = this.zoomLimits();
      const wide = this.game.desktop();
      let want;
      if (this.view === 'in') want = Math.max(fit, wide ? 2 : 1.9);
      else {
        // Enough to see what matters at once, at a whole number scale when that is close.
        const area = this.view === 'out' ? [620, 340] : [740, 357];
        want = Math.max(min, wide ? Math.min(this.css.w / area[0], this.css.h / area[1]) : this.view === 'out' ? 1.5 : 1.25);
        const whole = Math.round(want);
        if (whole >= min && Math.abs(want - whole) < 0.12) want = whole;
      }
      if (!this.cam.user) this.cam.z = want;
      this.applyZoom();
      this.clamp();
    }

    // Outside starts with the restaurant and the sky above it in view.
    focus() {
      const cam = this.cam;
      const vw = this.css.w / cam.z;
      const vh = this.css.h / cam.z;
      if (this.view === 'out') {
        // Wide enough for the leaderboard too, or else start at your door.
        cam.x = (vw >= 520 ? 478 : OUT.DOOR.x) - vw / 2;
        cam.y = OUT.DOOR.y + 44 - vh;
      } else if (this.view === 'street') {
        // Wide enough for the whole street, or else start at the first house.
        const lot = this.game.streetLots().slice().sort((a, b) => a.y - b.y || a.x - b.x)[0];
        cam.x = vw >= 680 ? STREET.W / 2 - vw / 2 : lot.x - vw / 2;
        cam.y = vw >= 680 ? 0 : lot.y - vh / 2 - 20;
      } else {
        cam.x = 0;
        cam.y = 0;
      }
      this.clamp();
    }

    applyZoom() {
      const { min, max } = this.zoomLimits();
      const cam = this.cam;
      cam.z = Math.max(min, Math.min(max, cam.z));
      const k = Math.max(1, Math.min(6, Math.ceil(cam.z * this.dpr)));
      this.ku = k;
      const iw = Math.max(1, Math.ceil((this.css.w / cam.z) * k));
      const ih = Math.max(1, Math.ceil((this.css.h / cam.z) * k));
      if (this.canvas.width !== iw || this.canvas.height !== ih) {
        this.canvas.width = iw;
        this.canvas.height = ih;
      }
      this.out.imageSmoothingEnabled = false;
    }

    clamp() {
      const m = this.m;
      const cam = this.cam;
      const vw = this.css.w / cam.z;
      const vh = this.css.h / cam.z;
      cam.x = vw >= m.W ? -(vw - m.W) / 2 : Math.max(0, Math.min(m.W - vw, cam.x));
      cam.y = vh >= m.H ? -(vh - m.H) / 2 : Math.max(0, Math.min(m.H - vh, cam.y));
    }

    panBy(dx, dy) {
      this.cam.x -= dx / this.cam.z;
      this.cam.y -= dy / this.cam.z;
      this.clamp();
    }

    // Zooms about a point on screen, so what is under the pointer stays put.
    zoomAt(factor, cx, cy) {
      const cam = this.cam;
      const before = cam.z;
      const wx = cam.x + cx / before;
      const wy = cam.y + cy / before;
      cam.z = before * factor;
      cam.user = true;
      this.applyZoom();
      cam.x = wx - cx / cam.z;
      cam.y = wy - cy / cam.z;
      this.clamp();
    }

    zoomFit() {
      this.cam.user = true;
      this.cam.z = this.zoomLimits().fit;
      this.applyZoom();
      this.clamp();
    }

    toWorld(cssX, cssY) {
      return { x: this.cam.x + cssX / this.cam.z, y: this.cam.y + cssY / this.cam.z };
    }

    // The tile under a point of the place being arranged.
    tileAt(wx, wy) {
      return { col: Math.floor(wx / TILE), row: Math.floor((wy - (this.view === 'in' ? DY : 0)) / TILE) };
    }

    // Paths

    blockedMap() {
      const blocked = {};
      for (const f of this.st.furniture) {
        const def = WW.DECOR_BY_ID[f.id];
        if (def.kind === 'rug') continue;
        for (let y = f.y; y < f.y + def.h; y++) for (let x = f.x; x < f.x + def.w; x++) blocked[x + ',' + y] = true;
      }
      return blocked;
    }
    // Breadth first over dining tiles. The goal tile may be furniture, that is where they sit.
    // Guests walk round furniture when they can. When it closes the way they squeeze through, crossing as little as they can.
    findPath(from, to) {
      const blocked = this.blockedMap();
      const { cols, rows } = this.inner();
      const key = (x, y) => x + ',' + y;
      const goal = key(to.col, to.row);
      const prev = {};
      let q = [[from.col, from.row]];
      prev[key(from.col, from.row)] = null;
      while (q.length && !(goal in prev)) {
        const through = [];
        for (let i = 0; i < q.length && !(goal in prev); i++) {
          const [x, y] = q[i];
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
            const k = key(nx, ny);
            if (k in prev) continue;
            prev[k] = key(x, y);
            (blocked[k] && k !== goal ? through : q).push([nx, ny]);
          }
        }
        q = through;
      }
      if (!(goal in prev)) return null;
      const out = [];
      let k = goal;
      while (k) {
        const [x, y] = k.split(',').map(Number);
        out.unshift(tileCenter(x, y));
        k = prev[k];
      }
      return out;
    }

    // Guests. One list: they walk the road outside, through the door, to a seat, and back out the same way.

    doorEntry() {
      const m = this.inner();
      return { x: m.doorX + 16, y: m.frontY + 6 };
    }
    doorTile() {
      const m = this.inner();
      return { col: m.cols - 3, row: m.rows - 1 };
    }

    addGuest(res) {
      if (this.guests.length > 70) return;
      const sp = WW.ANIMAL[res.species];
      const local = !this.game.visit;
      const fromLeft = Math.random() < 0.5;
      const g = { sp, frames: WW.animalFrames(sp), res, speed: 17 + Math.random() * 7, fly: sp.a === 'flyer', t: 0, dir: fromLeft ? 1 : -1, seat: null, local };
      if (local) {
        g.zone = 'out';
        g.x = fromLeft ? -16 : OUT.W + 16;
        g.y = OUT.ROAD_Y + Math.random() * 8 - 4;
        g.state = 'approach';
        g.path = [{ x: OUT.DOOR.x + (fromLeft ? -5 : 5), y: OUT.ROAD_Y - 6 }];
      } else {
        const door = this.doorEntry();
        g.zone = 'in';
        g.x = door.x;
        g.y = door.y;
        g.state = 'enter';
        g.path = [];
      }
      this.guests.push(g);
    }

    // A running hamster fills a round's seats in its first few minutes. Those guests stroll up spread over the whole round,
    // so people come and go all the time instead of in waves. Only how it looks: the engine has already counted them.
    guestArrives(res) {
      if (!res.served) return this.addGuest(res);
      this.coming.push(res);
      if (this.coming.length > 80) {
        const late = this.coming.shift();
        if (late.isNew) this.game.onNewSpecies(WW.ANIMAL[late.species]);
      }
    }
    updateArrivals(dt) {
      this.comingClock -= dt;
      if (this.comingClock > 0 || !this.coming.length) return;
      this.addGuest(this.coming.shift());
      this.comingClock = ((ROUND_SECONDS / Math.max(1, E().capacity(this.st))) * (0.4 + Math.random() * 1.2)) / this.pace();
    }
    pace() {
      return Math.max(1, (this.game.speed || 1) / 2);
    }
    // The first anyone hears of a new species is when it pays. One who never sits down is announced on the way past.
    announce(g) {
      if (!g.res.isNew) return;
      g.res.isNew = false;
      this.game.onNewSpecies(g.sp);
    }

    freeSeat() {
      const seats = E().seatsOf(this.st);
      const free = seats.filter((st) => !this.seatUse.has(st.x + ',' + st.y));
      return free.length ? free[Math.floor(Math.random() * free.length)] : null;
    }

    // From anywhere in the room back to the door.
    leavePath() {
      const m = this.inner();
      const door = this.doorEntry();
      return [{ x: door.x, y: m.frontY - 2 }, door];
    }
    // From the front door along the road and away.
    departPath() {
      const left = Math.random() < 0.5;
      return [{ x: OUT.DOOR.x, y: OUT.ROAD_Y + Math.random() * 8 - 4 }, { x: left ? -20 : OUT.W + 20, y: OUT.ROAD_Y + Math.random() * 8 - 4 }];
    }

    updateGuest(g, dt) {
      g.t += dt;
      const m = this.inner();
      switch (g.state) {
        case 'approach':
          if (this.walk(g, dt)) {
            // At the turning for your door. With every seat taken a guest just keeps walking.
            if (g.res.served && !this.freeSeat()) {
              this.announce(g);
              g.state = 'depart';
              g.path = [{ x: g.dir > 0 ? OUT.W + 20 : -20, y: OUT.ROAD_Y + Math.random() * 8 - 4 }];
            } else {
              g.state = 'todoor';
              g.path = [{ x: OUT.DOOR.x, y: OUT.DOOR.y + 6 }];
            }
          }
          break;
        case 'todoor':
          if (this.walk(g, dt)) {
            g.t = 0;
            // Nobody comes in to stand in the doorway.
            if (!g.res.served || !this.freeSeat()) {
              this.announce(g);
              g.state = 'turnaway';
              this.emote(g, g.res.why === 'soldout' ? 'sold' : g.res.why === 'tired' ? 'zz' : 'full');
            } else {
              const door = this.doorEntry();
              g.zone = 'in';
              g.x = door.x;
              g.y = door.y;
              g.state = 'enter';
            }
          }
          break;
        case 'turnaway':
          if (g.t > 1.2) {
            g.state = 'depart';
            g.path = this.departPath();
          }
          break;
        case 'enter': {
          const seat = this.freeSeat();
          if (seat) {
            this.seatUse.set(seat.x + ',' + seat.y, g);
            g.seat = seat;
            const path = this.findPath(this.doorTile(), { col: seat.x, row: seat.y });
            g.path = (path || []).slice();
            g.path.unshift({ x: this.doorEntry().x, y: m.frontY - 2 });
            g.state = 'toseat';
            g.t = 0;
          } else {
            g.state = 'leave';
            g.path = this.leavePath();
            this.emote(g, 'full');
          }
          break;
        }
        case 'toseat':
          if (this.walk(g, dt)) {
            g.state = 'waitfood';
            g.t = 0;
            g.dir = g.seat.face;
            g.bubble = g.res.dish;
            this.orders.push(g);
          }
          break;
        case 'waitfood':
          // Nobody free to carry it over, the kitchen hatch sends it across anyway.
          if (g.t > 12 && !g.plate) this.startEating(g);
          break;
        case 'eat':
          if (Math.random() < dt * 0.8) this.parts.push({ x: g.x + g.dir * 4, y: g.y - 6, vx: Math.random() * 10 - 5, vy: -8, life: 0.5, c: C.oat });
          if (g.t > g.eatFor) {
            this.payUp(g);
            g.plate = null;
            this.seatUse.delete(g.seat.x + ',' + g.seat.y);
            const back = this.findPath({ col: g.seat.x, row: g.seat.y }, this.doorTile()) || [];
            g.path = back.concat(this.leavePath());
            g.state = 'leave';
            g.seat = null;
          }
          break;
        case 'leave':
          if (this.walk(g, dt)) {
            if (g.local && g.zone === 'in') {
              g.zone = 'out';
              g.x = OUT.DOOR.x;
              g.y = OUT.DOOR.y + 4;
              g.state = 'depart';
              g.path = this.departPath();
            } else g.dead = true;
          }
          break;
        case 'depart':
          if (this.walk(g, dt)) g.dead = true;
          break;
        default:
          break;
      }
      if (g.emote) {
        g.emoteT -= dt;
        if (g.emoteT <= 0) g.emote = null;
      }
    }

    // Guests stay about as long as a seat turn lasts, so a full house really looks full.
    startEating(g) {
      g.plate = g.res.dish;
      g.bubble = null;
      g.state = 'eat';
      g.t = 0;
      g.eatFor = (90 + Math.random() * 110) / this.pace();
    }

    walk(a, dt) {
      if (!a.path || !a.path.length) return true;
      const p = a.path[0];
      const dx = p.x - a.x;
      const dy = p.y - a.y;
      const d = Math.hypot(dx, dy);
      const step = a.speed * (a.zone === 'out' ? ROAD_PACE : 1) * dt;
      if (d <= step) {
        a.x = p.x;
        a.y = p.y;
        a.path.shift();
        return a.path.length === 0;
      }
      a.x += (dx / d) * step;
      a.y += (dy / d) * step;
      if (Math.abs(dx) > 0.5) a.dir = dx > 0 ? 1 : -1;
      return false;
    }

    emote(g, kind) {
      g.emote = kind;
      g.emoteT = 1.6;
    }

    payUp(g) {
      if (g.res.coins) {
        this.floats.push({ x: g.x, y: g.y - 22, text: '+' + g.res.coins, c: '#8fd68a', life: 1.2 });
        for (let i = 0; i < 3; i++) this.parts.push({ x: g.x, y: g.y - 10, vx: Math.random() * 16 - 8, vy: -22 - Math.random() * 10, life: 0.6, c: '#6fbf6a', grav: 60 });
        if (this.view === 'in') this.game.sound('coin');
      }
      if (g.res.isNew) {
        this.floats.push({ x: g.x, y: g.y - 30, text: 'NEW!', c: C.butter, life: 1.8 });
        this.game.onNewSpecies(g.sp);
      }
    }

    // How many are in each place, for the tags by the door.
    countIn(zone) {
      let n = 0;
      for (const g of this.guests) if (g.zone === zone) n++;
      return n;
    }

    // Staff

    syncStaff() {
      const st = this.st;
      const m = this.inner();
      for (const w of st.staff) {
        if (w.role === 'waiter' && !this.waiters.has(w.id)) {
          const home = 12 + (this.waiters.size % 10) * 18;
          this.waiters.set(w.id, { id: w.id, x: home, y: 120, speed: 30, job: null, home, path: [], state: 'idle', dir: 1 });
        }
        if ((w.role === 'sous' || w.role === 'head') && !this.chefs.has(w.id)) this.chefs.set(w.id, { id: w.id, x: w.role === 'head' ? 30 : 60 + this.chefs.size * 22, y: 80, speed: 24, path: [], state: 'idle', dir: 1, wander: Math.random() * 4 });
        if (w.role === 'cleaner' && !this.cleaners.has(w.id)) this.cleaners.set(w.id, { id: w.id, x: m.W - 20, y: m.frontY - 12, speed: 20, path: [], state: 'idle', dir: 1, wander: 2 });
      }
      for (const map of [this.waiters, this.chefs, this.cleaners]) {
        for (const id of map.keys()) if (!st.staff.some((w) => w.id === id)) map.delete(id);
      }
      // A robot mop leaves its dock and works the floor.
      const dock = st.furniture.find((f) => WW.DECOR_BY_ID[f.id].roam);
      if (dock && !this.robots.length) this.robots.push({ x: dock.x * TILE + 8, y: DY + dock.y * TILE + 12, speed: 12, path: [], wander: 0, dir: 1 });
      if (!dock) this.robots = [];
    }

    updateWaiters(dt) {
      const m = this.inner();
      for (const w of this.waiters.values()) {
        const staff = this.st.staff.find((x) => x.id === w.id);
        w.asleep = staff && staff.energy < 1;
        if (w.state === 'idle') {
          if (!w.asleep && this.orders.length) {
            const g = this.orders.shift();
            if (g.dead || g.state !== 'waitfood') continue;
            w.job = g;
            w.state = 'tocounter';
            w.path = [{ x: Math.max(10, Math.min(m.W - 10, g.x + (Math.random() * 30 - 15))), y: 112 }];
          } else if (Math.abs(w.x - w.home) > 1 || Math.abs(w.y - 120) > 1) {
            if (!w.path.length) w.path = [{ x: w.home, y: 120 }];
            this.walk(w, dt);
          }
        } else if (w.state === 'tocounter') {
          if (this.walk(w, dt)) {
            const g = w.job;
            if (!g || g.dead || g.state !== 'waitfood') {
              w.state = 'idle';
              w.job = null;
              continue;
            }
            w.state = 'carry';
            const t = g.seat.table;
            const near = { x: t.x * TILE + (t.w * TILE) / 2, y: DY + t.y * TILE + t.h * TILE + 8 };
            w.path = [{ x: Math.max(8, Math.min(m.W - 8, near.x)), y: Math.min(m.frontY - 2, near.y) }];
          }
        } else if (w.state === 'carry') {
          if (this.walk(w, dt)) {
            const g = w.job;
            if (g && !g.dead && g.state === 'waitfood') {
              this.startEating(g);
              if (this.view === 'in') this.game.sound('plate');
            }
            w.job = null;
            w.state = 'idle';
            w.path = [];
          }
        }
      }
    }

    updateChefs(dt) {
      const st = this.st;
      const m = this.inner();
      for (const c of this.chefs.values()) {
        const idx = st.stations.findIndex((x) => x.job && x.job.chef === c.id);
        if (idx >= 0) {
          const want = { x: WORLD.STATION_X + idx * WORLD.STATION_W + 12, y: 78 };
          if (Math.hypot(c.x - want.x, c.y - want.y) > 1) {
            c.path = [want];
            this.walk(c, dt);
            c.state = 'walk';
          } else c.state = 'stir';
        } else {
          c.wander -= dt;
          if (c.path.length) {
            this.walk(c, dt);
            c.state = 'walk';
          } else {
            c.state = 'idle';
            if (c.wander <= 0) {
              c.wander = 4 + Math.random() * 6;
              const home = c.id === 'head' ? 34 : 60;
              c.path = [{ x: home + Math.random() * (m.W - home - 16), y: 72 + Math.random() * 10 }];
            }
          }
        }
      }
      const tidy = (c) => {
        const d = this.dirt[0];
        if (d && !this.game.visit) {
          c.path = [{ x: d.x, y: d.y - 1 }];
          if (this.walk(c, dt)) {
            this.dirt.shift();
            this.game.s.hygiene = Math.min(100, this.game.s.hygiene + 1);
            this.parts.push({ x: d.x, y: d.y, vx: 0, vy: -10, life: 0.5, c: C.ice });
          }
        } else {
          c.wander -= dt;
          if (c.path.length) this.walk(c, dt);
          else if (c.wander <= 0) {
            c.wander = 3 + Math.random() * 5;
            c.path = [{ x: 12 + Math.random() * (m.W - 24), y: 118 + Math.random() * (m.frontY - 124) }];
          }
        }
      };
      for (const c of this.cleaners.values()) tidy(c);
      for (const r of this.robots) tidy(r);
    }

    // The floor shows how tidy the place really is.
    syncDirt() {
      const m = this.inner();
      if (this.game.visit) {
        const v = E().neighbourDay(this.game.s, this.game.visit.nid, this.game.now());
        this.dirt = E().neighbourDirt(this.game.visit.nid, this.game.now(), m).filter((d) => !v.cleaned.includes(d.i));
        return;
      }
      const target = Math.min(14, Math.floor((100 - this.game.s.hygiene) / 6));
      while (this.dirt.length < target) this.dirt.push({ x: 8 + Math.random() * (m.W - 16), y: 112 + Math.random() * (m.frontY - 118) });
      if (this.dirt.length > target) this.dirt.length = target;
    }

    // A neighbour's guests are only for looking at.
    updateVisitLife(dt, service) {
      if (!this.game.visit) return;
      this.visitClock -= dt;
      if (this.visitClock > 0) return;
      this.visitClock = service ? 6 + Math.random() * 6 : 25 + Math.random() * 25;
      const keys = Object.keys(this.st.stock);
      if (!keys.length) return;
      const sp = WW.ANIMALS[Math.floor(Math.random() * WW.ANIMALS.length)];
      this.addGuest({ species: sp.id, served: true, dish: keys[Math.floor(Math.random() * keys.length)], coins: 0 });
    }

    // Animals out on the road, whichever road is on screen. Always some in view, however small the screen, more when the wheel is turning and fewer at night.
    updateWalkers(dt, service) {
      if (this.view === 'in') {
        this.walkers = [];
        this.walkersAt = 'in';
        return;
      }
      const cam = this.cam;
      const wide = this.css.w / cam.z;
      const inView = Math.max(2.5, wide / (service ? 88 : this.game.isAwake() ? 150 : 260));
      if (this.walkersAt !== this.view) {
        this.walkersAt = this.view;
        this.walkers = [];
        // You arrive on a road already in use.
        for (let i = 0; i < inView; i++) this.addWalker(cam.x + Math.random() * wide, Math.random() < 0.5);
      }
      this.walkerClock = (this.walkerClock || 0) - dt;
      if (this.walkerClock <= 0 && this.walkers.length < 30) {
        // New ones come from just out of view. A stroll across the screen takes about wide / 17 seconds.
        this.walkerClock = (wide / 17 / inView) * (0.4 + Math.random() * 1.2);
        const left = Math.random() < 0.5;
        this.addWalker(left ? Math.max(-18, cam.x - 18) : Math.min(this.m.W + 18, cam.x + wide + 18), left);
      }
      for (const p of this.walkers) {
        if (p.wait > 0) p.wait -= dt;
        else if (this.walk(p, dt)) {
          const next = p.legs.shift();
          if (!next) p.dead = true;
          else {
            p.path = [next];
            p.wait = next.rest || 0;
          }
        }
        p.state = p.wait > 0 ? 'look' : 'depart';
      }
      this.walkers = this.walkers.filter((p) => !p.dead);
    }
    addWalker(x, left, lead) {
      const onRoad = this.view === 'out';
      const sp = WW.ANIMALS[Math.floor(Math.random() * WW.ANIMALS.length)];
      const dir = left ? 1 : -1;
      const lane = onRoad ? OUT.ROAD_Y + Math.random() * 20 - 8 : STREET.LANES[Math.floor(Math.random() * STREET.LANES.length)] + Math.random() * 6 - 3;
      const y = lead ? lead.y + (Math.random() < 0.5 ? -5 : 5) : lane;
      const end = { x: left ? this.m.W + 18 : -18, y };
      const p = { sp, frames: WW.animalFrames(sp), x, y, dir, speed: lead ? lead.speed : 10 + Math.random() * 14, fly: sp.a === 'flyer', state: 'depart', seat: null, wait: 0, path: [end], legs: [] };
      this.walkers.push(p);
      if (lead) return;
      if (onRoad) this.planWalker(p, end);
      // Now and then two or three walk along together.
      if (!p.legs.length && Math.random() < 0.2) {
        const friends = Math.random() < 0.4 ? 2 : 1;
        for (let i = 1; i <= friends; i++) this.addWalker(p.x - dir * (i * 14 + Math.random() * 5), left, p);
      }
    }
    // Most just pass. Some stop to read the sign on your door and walk on, some go into the market or the decor shop, some come back out.
    planWalker(p, end) {
      const road = OUT.ROAD_Y - 6;
      const front = OUT.DOOR.y + 6;
      const ahead = (door) => (door - p.x) * p.dir > 30;
      const shop = Math.random() < 0.5 ? OUT.MARKET.door : OUT.SHOP.door;
      const roll = Math.random();
      if (roll < 0.15 && ahead(OUT.DOOR.x)) {
        p.path = [{ x: OUT.DOOR.x - p.dir * 6, y: road }];
        p.legs = [{ x: OUT.DOOR.x - p.dir * 3, y: front + 6 }, { x: OUT.DOOR.x + p.dir * 6, y: road, rest: 1.5 + Math.random() * 2 }, end];
      } else if (roll < 0.28 && ahead(shop)) {
        p.path = [{ x: shop, y: road }];
        p.legs = [{ x: shop, y: front }];
      } else if (roll >= 0.28 && roll < 0.4) {
        p.x = shop;
        p.y = front;
        p.path = [{ x: shop, y: road }];
        p.legs = [end];
      }
    }

    // Rain, snow, petals: only what is in view outside.
    updateWeather(dt, sky) {
      if (this.view === 'in') return;
      const cam = this.cam;
      const vw = this.css.w / cam.z;
      const vh = this.css.h / cam.z;
      const want = DROPS[sky.weather] || 0;
      if (this.dropsFor !== sky.weather) {
        this.dropsFor = sky.weather;
        this.drops = [];
      }
      while (this.drops.length < want) {
        const heavy = sky.weather === 'rain' || sky.weather === 'storm';
        this.drops.push({ x: cam.x + Math.random() * vw, y: cam.y + Math.random() * vh, vx: heavy ? -14 : Math.random() * 10 - 8, vy: heavy ? 150 + Math.random() * 40 : sky.weather === 'snow' ? 14 + Math.random() * 10 : 12 + Math.random() * 8, w: Math.random() * 6 });
      }
      for (const d of this.drops) {
        d.x += d.vx * dt + (sky.weather === 'rain' || sky.weather === 'storm' ? 0 : Math.sin(this.t * 2 + d.w) * dt * 8);
        d.y += d.vy * dt;
        if (d.y > cam.y + vh) d.y = cam.y - 2;
        if (d.y < cam.y - 4) d.y = cam.y + vh;
        if (d.x < cam.x - 4) d.x = cam.x + vw;
        if (d.x > cam.x + vw + 4) d.x = cam.x;
      }
      if (sky.weather === 'storm') {
        this.flash = Math.max(0, this.flash - dt * 3);
        if (Math.random() < dt / 9 && !this.calm) this.flash = 1;
      } else this.flash = 0;
      // Butterflies by day and fireflies by night, away from the winter.
      const count = sky.season === 'winter' || DROPS[sky.weather] ? 0 : 16;
      while (this.critters.length < count) this.critters.push({ x: Math.random() * this.m.W, y: 100 + Math.random() * (this.m.H - 120), p: Math.random() * 6, c: [C.butter, C.rose, C.sky][Math.floor(Math.random() * 3)] });
      if (this.critters.length > count) this.critters.length = count;
      for (const b of this.critters) {
        b.p += dt;
        b.x += Math.sin(b.p * 0.7) * dt * 9;
        b.y += Math.cos(b.p * 1.1) * dt * 6;
      }
    }

    // Main update

    update(dt) {
      this.syncRoom();
      if (!this.m) return;
      this.t += dt;
      const game = this.game;
      const live = game.live || { state: 'quiet', rpm: 0 };
      const service = game.isService();
      const sky = game.sky();
      const m = this.inner();
      this.syncStaff();
      this.syncDirt();
      // Day and night follow whether the real hamster is up.
      this.nightAmt += ((game.isAwake() ? 0 : 1) - this.nightAmt) * Math.min(1, dt * 1.2);

      if (live.state === 'running') {
        const rate = (live.rpm || 70) / 60;
        this.wheelAngle += rate * dt * 8;
        this.gearAngle += rate * dt * 5;
      }
      this.updateArrivals(dt);
      for (const g of this.guests) this.updateGuest(g, dt);
      this.guests = this.guests.filter((g) => !g.dead);
      this.updateWaiters(dt);
      this.updateChefs(dt);
      this.updateVisitLife(dt, service);
      this.updateWalkers(dt, service);
      this.updateWeather(dt, sky);
      for (const k in this.treeShake) {
        this.treeShake[k] -= dt;
        if (this.treeShake[k] <= 0) delete this.treeShake[k];
      }

      for (const p of this.parts) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += (p.grav || 0) * dt;
        p.life -= dt;
      }
      this.parts = this.parts.filter((p) => p.life > 0);
      for (const f of this.floats) {
        f.y -= dt * 10;
        f.life -= dt;
      }
      this.floats = this.floats.filter((f) => f.life > 0);

      this.st.stations.forEach((st, i) => {
        if (!st.job || i >= m.slots) return;
        const x = WORLD.STATION_X + i * WORLD.STATION_W + 12;
        if (this.stationLit(st, live) && Math.random() < dt * 3) this.parts.push({ x: x + Math.random() * 8 - 4, y: WORLD.STATION_Y + 4, vx: Math.random() * 4 - 2, vy: -9, life: 1.2, c: st.type === 'wok' ? C.gold : C.white });
      });
      if (!service && Math.random() < dt * 0.7) this.floats.push({ x: 36 + Math.random() * 4, y: 40, text: 'Z', c: C.paper, life: 2.2 });
      // Chimney smoke, when there is a chimney.
      const home = game.s;
      if (home && !game.visit && this.view === 'out' && Math.random() < dt * 3) {
        const h = this.homeRect();
        if (h.I.smoke) this.parts.push({ zone: 'out', x: h.left + h.I.smoke.x, y: h.top + h.I.smoke.y, vx: 2 + Math.random() * 3, vy: -8, life: 2, c: '#d8d8dc' });
      }

      if (this.fading) {
        const f = this.fading;
        f.t += dt;
        if (!f.swapped && f.t >= FADE) {
          f.swapped = true;
          if (f.then) f.then();
          this.setView(f.view);
          if (f.done) f.done();
        }
        if (f.t >= FADE * 2) this.fading = null;
      }
    }

    stationLit(st, live) {
      if (!st.job) return false;
      if (st.type === 'stove') return true;
      if (st.type === 'wok') return live.state === 'running' || live.state === 'breather';
      return !(live.state === 'running' || live.state === 'breather') && live.state !== 'unknown';
    }

    // Drawing

    draw() {
      if (!this.m) return;
      const ctx = this.ctx;
      ctx.imageSmoothingEnabled = false;
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      const sky = this.game.sky();
      ctx.save();
      // Only what is in view gets painted, the world is far wider than the screen.
      if (this.view !== 'in') {
        const cam = this.cam;
        ctx.beginPath();
        ctx.rect(Math.floor(cam.x) - 2, Math.floor(cam.y) - 2, Math.ceil(this.css.w / cam.z) + 5, Math.ceil(this.css.h / cam.z) + 5);
        ctx.clip();
      }
      if (this.view === 'in') this.drawInside(ctx, sky);
      else if (this.view === 'out') this.drawOutside(ctx, sky);
      else this.drawStreet(ctx, sky);
      for (const p of this.parts) {
        if ((p.zone || 'in') !== this.view) continue;
        ctx.fillStyle = p.c;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
      }
      for (const f of this.floats) {
        if ((f.zone || 'in') !== this.view) continue;
        const w = WW.tinyWidth(f.text);
        WW.tinyText(ctx, f.text, f.x - w / 2 + 1, f.y + 1, C.ink);
        WW.tinyText(ctx, f.text, f.x - w / 2, f.y, f.c);
      }
      if (this.editing) this.drawEditor(ctx);
      this.drawTouchHints(ctx);
      this.drawArrow(ctx);
      this.drawHover(ctx);
      ctx.restore();
      this.blit();
      if (this.fading) {
        const f = this.fading;
        const a = f.t < FADE ? f.t / FADE : Math.max(0, (FADE * 2 - f.t) / FADE);
        this.out.fillStyle = `rgba(30,20,40,${a})`;
        this.out.fillRect(0, 0, this.canvas.width, this.canvas.height);
      }
    }

    // Inside

    drawInside(ctx, sky) {
      const game = this.game;
      const st = this.st;
      const m = this.m;
      const live = game.live || { state: 'quiet', rpm: 0 };
      const frame = Math.floor(this.t * 6);
      ctx.drawImage(WW.backgroundCanvas(st.room, st.style), 0, 0);
      this.drawWindows(ctx, sky);
      this.drawDoorway(ctx, sky);
      this.drawWheel(ctx, live);
      this.drawGears(ctx, live);
      this.drawStations(ctx, live, frame);
      this.drawCounterStock(ctx);
      for (const f of st.furniture) {
        const def = WW.DECOR_BY_ID[f.id];
        if (def.kind === 'rug') this.drawFurniture(ctx, f, def);
      }
      for (const d of this.dirt) this.drawDirt(ctx, d);

      // Everything standing in the room, back to front.
      const items = [];
      for (const f of st.furniture) {
        const def = WW.DECOR_BY_ID[f.id];
        if (def.kind === 'rug') continue;
        items.push({ y: DY + (f.y + def.h) * TILE, draw: () => this.drawFurniture(ctx, f, def) });
      }
      for (const g of this.guests) if (g.zone === 'in') items.push({ y: g.y + (g.seat && g.state !== 'toseat' ? 1 : 0), draw: () => this.drawGuest(ctx, g) });
      for (const c of this.chefs.values()) items.push({ y: c.y, draw: () => this.drawChef(ctx, c, frame) });
      for (const w of this.waiters.values()) items.push({ y: w.y, draw: () => this.drawWaiter(ctx, w, frame) });
      for (const c of this.cleaners.values()) items.push({ y: c.y, draw: () => this.drawCleaner(ctx, c, frame) });
      for (const r of this.robots) items.push({ y: r.y, draw: () => ctx.drawImage(WW.robotCanvas(frame), Math.round(r.x - 7), Math.round(r.y - 9)) });
      items.sort((a, b) => a.y - b.y);
      for (const it of items) it.draw();

      this.drawDoorSign(ctx, live, m.doorX + m.doorW / 2, m.frontY - 9);
      this.drawInsideLight(ctx, st, sky);
    }

    // Through a window: the sky of this hour, with the weather in it.
    drawWindows(ctx, sky) {
      const n = this.nightAmt;
      const A = WW.SEASON_ART[sky.season];
      for (const wx of this.m.windows) {
        ctx.fillStyle = n > 0.5 ? '#26305e' : SKY_DAY[sky.weather];
        ctx.fillRect(wx, 9, 22, 18);
        ctx.fillRect(wx + 3, 7, 16, 2);
        if (n > 0.5) {
          ctx.fillStyle = '#f4f0d8';
          ctx.fillRect(wx + 13, 11, 4, 4);
          ctx.fillStyle = '#26305e';
          ctx.fillRect(wx + 15, 10, 3, 3);
          ctx.fillStyle = C.white;
          for (const [x, y] of [[3, 12], [7, 20], [18, 22], [5, 16]]) if ((Math.floor(this.t * 2) + x) % 5) ctx.fillRect(wx + x, y, 1, 1);
        } else if (SUN_SHOWS[sky.weather] > 0.4) {
          ctx.fillStyle = C.butter;
          ctx.fillRect(wx + 15, 11, 3, 3);
        }
        ctx.fillStyle = A.far;
        ctx.fillRect(wx, 22, 22, 5);
        ctx.fillStyle = A.grass[1];
        ctx.fillRect(wx, 25, 22, 2);
        const heavy = sky.weather === 'rain' || sky.weather === 'storm';
        if (heavy || sky.weather === 'snow' || sky.weather === 'petals' || sky.weather === 'leaves') {
          ctx.fillStyle = heavy ? '#d0e4f0' : sky.weather === 'snow' ? C.white : sky.weather === 'petals' ? C.rose : C.gold;
          const speed = heavy ? 26 : 5;
          for (let i = 0; i < 6; i++) ctx.fillRect(wx + ((i * 7 + 3) % 22), 9 + Math.floor(this.t * speed + i * 5) % 18, 1, heavy ? 2 : 1);
        }
        ctx.fillStyle = '#6d4535';
        ctx.fillRect(wx + 10, 8, 1, 19);
        ctx.fillRect(wx, 17, 22, 1);
      }
    }

    // The way out: what shows through the door is the same hour as everywhere else.
    drawDoorway(ctx, sky) {
      const m = this.m;
      const A = WW.SEASON_ART[sky.season];
      ctx.fillStyle = SKY_DAY[sky.weather];
      ctx.fillRect(m.doorX, m.frontY, m.doorW, 6);
      ctx.fillStyle = A.grass[0];
      ctx.fillRect(m.doorX, m.frontY + 6, m.doorW, 7);
      ctx.fillStyle = A.path;
      ctx.fillRect(m.doorX + 6, m.frontY + 6, m.doorW - 12, 12);
      ctx.fillStyle = '#a87040';
      ctx.fillRect(m.doorX, m.frontY, m.doorW, 1);
    }

    drawWheel(ctx, live) {
      const w = WORLD.WHEEL;
      const size = w.r * 2 + 3;
      ctx.drawImage(WW.wheelCanvas(Math.floor(this.wheelAngle)), w.cx - w.r - 1, w.cy - w.r - 1, size, size);
      if (live.state === 'running') {
        const f = Math.floor((this.t * (live.rpm || 70)) / 6) % 2;
        ctx.drawImage(WW.squeekRun(f), w.cx - 10, w.cy + 3);
      } else if (live.state === 'breather') {
        const f = Math.floor(this.t * 2) % 2;
        ctx.drawImage(WW.squeekRun(0), w.cx - 10, w.cy + 3 + f);
      } else {
        // Asleep in a matchbox nest.
        ctx.fillStyle = C.honey;
        ctx.fillRect(14, 49, 30, 8);
        ctx.fillStyle = C.tomato;
        ctx.fillRect(14, 49, 30, 2);
        ctx.fillStyle = '#efe1b0';
        ctx.fillRect(16, 46, 26, 4);
        ctx.drawImage(WW.squeekSleep(), 18, 38);
      }
    }

    drawGears(ctx, live) {
      const m = this.m;
      const turn = Math.floor(this.gearAngle);
      ctx.drawImage(WW.gearCanvas(5, turn), 40, 2);
      ctx.drawImage(WW.gearCanvas(3, -turn), 50, 5);
      // The drive rod runs along the top rail; a moving mark shows it turning.
      ctx.fillStyle = C.iron;
      ctx.fillRect(57, 7, m.W - 58, 2);
      ctx.fillStyle = live.state === 'running' ? C.butter : '#7c8a96';
      const shift = live.state === 'running' ? Math.floor(this.t * 40) % 8 : 0;
      for (let x = 57 + shift; x < m.W - 2; x += 8) ctx.fillRect(x, 7, 2, 2);
      // Drops down to each wok, so you can see the wheel feeding the fire.
      this.st.stations.forEach((st, i) => {
        if (st.type !== 'wok' || i >= m.slots) return;
        const x = WORLD.STATION_X + i * WORLD.STATION_W + 12;
        ctx.fillStyle = C.iron;
        ctx.fillRect(x, 9, 1, WORLD.STATION_Y + 10);
        if (live.state === 'running') {
          ctx.fillStyle = C.butter;
          for (let y = 9 + (Math.floor(this.t * 30) % 6); y < 40; y += 6) ctx.fillRect(x, y, 1, 2);
        }
      });
    }

    drawStations(ctx, live, frame) {
      const st = this.st;
      const game = this.game;
      for (let i = 0; i < this.m.slots; i++) {
        const x = WORLD.STATION_X + i * WORLD.STATION_W;
        const y = WORLD.STATION_Y;
        const s = st.stations[i];
        if (!s) {
          ctx.drawImage(WW.lockedStationCanvas(), x, y);
          WW.tinyText(ctx, '+', x + 11, y + 15, C.cocoa);
          continue;
        }
        ctx.drawImage(WW.stationCanvas(s.type, this.stationLit(s, live), frame), x, y);
        if (s.job) {
          const def = E().dishDef(s.job.dish);
          const pr = E().stationProgress(st, s, game.feed, game.now());
          ctx.fillStyle = C.ink;
          ctx.fillRect(x + 2, y - 3, 20, 4);
          ctx.fillStyle = '#5a5a68';
          ctx.fillRect(x + 3, y - 2, 18, 2);
          ctx.fillStyle = s.type === 'wok' ? C.gold : s.type === 'pot' ? C.lilac : C.leaf;
          ctx.fillRect(x + 3, y - 2, Math.max(1, Math.round(18 * pr)), 2);
          ctx.drawImage(WW.dishIcon(def, def.gold), x + 4, y - 19);
        } else if (!game.visit) {
          const bob = Math.floor(this.t * 2) % 2;
          WW.tinyText(ctx, '+', x + 10, y - 6 - bob, C.white);
        }
      }
    }

    counterKeys() {
      const st = this.st;
      const room = Math.floor((this.inner().W - 8) / 19);
      return Object.keys(st.stock).filter((k) => st.stock[k] > 0).slice(0, room);
    }

    drawCounterStock(ctx) {
      const st = this.st;
      const keys = this.counterKeys();
      keys.forEach((k, i) => {
        const def = E().dishDef(k);
        const x = 4 + i * 19;
        ctx.drawImage(WW.dishIcon(def, def.gold), x, 80);
        const txt = st.stock[k] > 999 ? '999' : String(st.stock[k]);
        const w = WW.tinyWidth(txt);
        ctx.fillStyle = C.ink;
        ctx.fillRect(x + 15 - w, 90, w + 2, 7);
        WW.tinyText(ctx, txt, x + 16 - w, 91, C.paper);
      });
      if (!keys.length) {
        const txt = this.game.isService() ? 'COUNTER EMPTY! COOK SOMETHING' : 'COUNTER EMPTY';
        WW.tinyText(ctx, txt, this.m.W / 2 - WW.tinyWidth(txt) / 2, 90, C.brick);
      }
    }

    drawFurniture(ctx, f, def) {
      const can = WW.decorCanvas(f.id);
      if (this.editing && this.editing.selected === f && this.editing.ghost) return;
      ctx.drawImage(can, f.x * TILE, DY + (f.y + def.h) * TILE - can.height);
    }

    drawGuest(ctx, g) {
      const moving = g.state === 'approach' || g.state === 'todoor' || g.state === 'toseat' || g.state === 'leave' || g.state === 'depart';
      const idx = (moving ? Math.floor(this.t * 6 + g.speed) % 2 : 0) + (g.dir < 0 ? 2 : 0);
      const can = g.frames[idx];
      let dy = 0;
      if (g.fly) dy = Math.round(Math.sin(this.t * 6 + g.speed) * 2) - 4;
      else if (g.state === 'eat') dy = Math.floor(this.t * 2.5 + g.speed) % 2;
      const x = Math.round(g.x - 10);
      const y = Math.round(g.y - 22 + dy - (g.seat && g.state !== 'toseat' ? 4 : 0));
      ctx.drawImage(can, x, y);
      if (g.plate) {
        const def = E().dishDef(g.plate);
        const t = g.seat.table;
        ctx.drawImage(WW.dishIcon(def, def.gold), t.x * TILE + (t.w * TILE) / 2 - 8 + (g.dir < 0 ? -2 : 2), DY + t.y * TILE - 8);
      }
      if (g.bubble && g.t < 2.2) this.drawBubble(ctx, g.x, y - 2, E().dishDef(g.bubble));
      if (g.emote) this.drawEmote(ctx, g.x, y - 2, g.emote);
    }

    drawBubble(ctx, x, y, def) {
      const bx = Math.round(x - 9);
      const by = Math.round(y - 17);
      ctx.fillStyle = C.ink;
      ctx.fillRect(bx - 1, by, 20, 18);
      ctx.fillRect(bx, by - 1, 18, 20);
      ctx.fillStyle = C.paper;
      ctx.fillRect(bx, by, 18, 18);
      ctx.drawImage(WW.dishIcon(def, def.gold), bx + 1, by + 1);
      ctx.fillStyle = C.ink;
      ctx.fillRect(bx + 8, by + 19, 2, 2);
    }

    drawEmote(ctx, x, y, kind) {
      const txt = kind === 'sold' ? 'SOLD OUT' : kind === 'full' ? 'FULL' : 'TIRED';
      const w = WW.tinyWidth(txt);
      const bx = Math.round(x - w / 2);
      const head = WW.tinyHead || 0;
      ctx.fillStyle = C.ink;
      ctx.fillRect(bx - 2, y - 8 - head, w + 4, 8 + head);
      WW.tinyText(ctx, txt, bx, y - 7, C.paper);
    }

    look(id) {
      const st = this.st;
      if (id === 'head') return { fur: st.chef.fur, hat: st.chef.hat, job: 'chef' };
      const w = st.staff.find((x) => x.id === id);
      if (!w) return { fur: 'golden', job: 'sous' };
      return { fur: w.fur, job: w.role === 'sous' ? 'sous' : w.role };
    }

    drawChef(ctx, c, frame) {
      const look = this.look(c.id);
      const staff = this.st.staff.find((x) => x.id === c.id);
      let pose = 0;
      if (c.state === 'stir') pose = frame % 2 ? 3 : 4;
      else if (c.state === 'walk') pose = frame % 2 ? 1 : 2;
      if (staff && staff.energy < 1) pose = 6;
      ctx.drawImage(WW.hamsterPose(look, pose), Math.round(c.x - 10), Math.round(c.y - 25));
    }

    drawWaiter(ctx, w, frame) {
      const look = this.look(w.id);
      let pose = 0;
      const moving = w.state === 'tocounter' || w.state === 'carry' || (w.path && w.path.length);
      if (w.state === 'carry') pose = 5;
      else if (moving) pose = frame % 2 ? 1 : 2;
      if (w.asleep) pose = 6;
      const x = Math.round(w.x - 10);
      const y = Math.round(w.y - 25 + (w.state === 'carry' ? frame % 2 : 0));
      ctx.drawImage(WW.hamsterPose(look, pose), x, y);
      if (w.state === 'carry' && w.job) {
        const def = E().dishDef(w.job.res.dish);
        ctx.drawImage(WW.dishIcon(def, def.gold), x + 2, y - 6);
      }
    }

    drawCleaner(ctx, c, frame) {
      const pose = c.path && c.path.length ? (frame % 2 ? 1 : 2) : 0;
      ctx.drawImage(WW.hamsterPose(this.look(c.id), pose), Math.round(c.x - 10), Math.round(c.y - 25));
    }

    drawDirt(ctx, d) {
      const x = Math.round(d.x);
      const y = Math.round(d.y);
      ctx.fillStyle = '#6d4f30';
      ctx.fillRect(x - 2, y, 5, 1);
      ctx.fillRect(x - 1, y - 1, 3, 1);
      ctx.fillRect(x + 1, y + 1, 2, 1);
      ctx.fillStyle = '#8a6a4a';
      ctx.fillRect(x - 1, y, 2, 1);
    }

    // The sign on a door. The same words inside and out.
    drawDoorSign(ctx, live, cx, y) {
      const st = this.st;
      const service = this.game.isService();
      const none = !E().inStock(st).length;
      let text = service ? 'OPEN' : 'QUIET';
      let color = service ? C.leaf : C.lilac;
      if (live.state === 'unknown') {
        text = 'NO SIGNAL';
        color = C.steel;
      } else if (service && none) {
        text = 'SOLD OUT';
        color = C.tomato;
      }
      const w = WW.tinyWidth(text);
      const x = Math.round(cx - w / 2);
      const head = WW.tinyHead || 0;
      ctx.fillStyle = C.ink;
      ctx.fillRect(x - 2, y - head, w + 4, 8 + head);
      ctx.fillStyle = color;
      ctx.fillRect(x - 1, y + 1 - head, w + 2, 6 + head);
      WW.tinyText(ctx, text, x, y + 1, C.ink);
    }

    // Lamps at night, the sun through the windows by day.
    drawInsideLight(ctx, st, sky) {
      const n = this.nightAmt;
      const m = this.m;
      const sun = (1 - n) * SUN_SHOWS[sky.weather];
      if (sun > 0.05) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.14 * sun;
        ctx.fillStyle = '#fff2b0';
        for (const wx of m.windows) {
          ctx.beginPath();
          ctx.moveTo(wx, 42);
          ctx.lineTo(wx + 22, 42);
          ctx.lineTo(wx + 36, 86);
          ctx.lineTo(wx + 14, 86);
          ctx.closePath();
          ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      }
      if (n < 0.02) return;
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = n;
      ctx.fillStyle = '#7477c0';
      ctx.fillRect(0, 0, m.W, m.H);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = n;
      const glow = WW.glowCanvas(28, '#ffcf80');
      for (const f of st.furniture) {
        const def = WW.DECOR_BY_ID[f.id];
        if (!def.glow) continue;
        ctx.drawImage(glow, f.x * TILE + (def.w * TILE) / 2 - 28, DY + f.y * TILE - 28);
      }
      st.stations.forEach((s, i) => {
        if (!s.job || i >= m.slots) return;
        const cx = WORLD.STATION_X + i * WORLD.STATION_W + 12;
        if (s.type === 'pot') ctx.drawImage(WW.glowCanvas(18, '#ff9a60'), cx - 18, WORLD.STATION_Y + 2);
        if (s.type === 'stove') ctx.drawImage(WW.glowCanvas(16, '#ffb060'), cx - 16, WORLD.STATION_Y);
      });
      ctx.globalAlpha = n * 0.3;
      for (let lx = 36; lx < m.W; lx += 60) ctx.drawImage(WW.glowCanvas(22, '#ffdf90'), lx - 22, 74);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    // Outside

    drawSky(ctx, W, h, sky) {
      const n = this.nightAmt;
      ctx.fillStyle = SKY_DAY[sky.weather];
      ctx.fillRect(0, 0, W, h);
      const show = SUN_SHOWS[sky.weather];
      if (show > 0 && n < 0.9) {
        ctx.globalAlpha = (1 - n) * show;
        ctx.drawImage(WW.sunCanvas(), Math.round(W / 2 + 70), 2);
        ctx.globalAlpha = 1;
      }
      const clouds = { clear: 2, cloudy: 6, rain: 7, storm: 8, fog: 4, snow: 6, petals: 3, leaves: 3 }[sky.weather];
      ctx.globalAlpha = sky.weather === 'storm' || sky.weather === 'rain' ? 0.55 : 0.85;
      for (let i = 0; i < clouds * 2.5; i++) {
        const span = W + 60;
        const x = ((this.t * (2 + (i % 3)) + i * 83) % span) - 50;
        ctx.drawImage(WW.cloudCanvas(i), Math.round(x), 2 + ((i * 7) % 24));
      }
      ctx.globalAlpha = 1;
    }
    // Stars and the moon stay bright through the night tint, so they go on after it.
    drawNightSky(ctx, W, top, sky) {
      const n = this.nightAmt;
      if (n < 0.05) return;
      const clearish = SUN_SHOWS[sky.weather];
      ctx.globalAlpha = n * Math.max(0.25, clearish);
      ctx.fillStyle = C.white;
      for (let i = 0; i < 110; i++) {
        const x = (i * 97) % W;
        const y = (i * 53) % top;
        if ((Math.floor(this.t * 1.5) + i) % 7) ctx.fillRect(x, y, 1, 1);
      }
      ctx.globalAlpha = n * Math.max(0.3, clearish);
      ctx.drawImage(WW.moonCanvas(), Math.round(W / 2 - 90), top - 40);
      ctx.globalAlpha = 1;
    }
    // Weather falling through what is in view.
    drawWeather(ctx, sky) {
      const heavy = sky.weather === 'rain' || sky.weather === 'storm';
      if (sky.weather === 'fog') {
        ctx.fillStyle = '#eef2f4';
        const cam = this.cam;
        const vw = this.css.w / cam.z;
        const vh = this.css.h / cam.z;
        for (let i = 0; i < 5; i++) {
          ctx.globalAlpha = 0.16;
          ctx.beginPath();
          ctx.ellipse(cam.x + ((this.t * (3 + i) + i * 90) % (vw + 120)) - 60, cam.y + vh * (0.2 + i * 0.16), 90, 16, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        return;
      }
      ctx.fillStyle = heavy ? '#d0e4f0' : sky.weather === 'snow' ? C.white : sky.weather === 'petals' ? C.rose : C.gold;
      if (heavy) ctx.globalAlpha = 0.7;
      for (const d of this.drops) {
        const x = Math.round(d.x);
        const y = Math.round(d.y);
        if (heavy) ctx.fillRect(x, y, 1, 3);
        else if (sky.weather === 'snow') ctx.fillRect(x, y, d.w > 3 ? 2 : 1, d.w > 3 ? 2 : 1);
        else ctx.fillRect(x, y, 2, 1 + (Math.floor(this.t * 3 + d.w) % 2));
      }
      ctx.globalAlpha = 1;
      if (this.flash > 0) {
        const cam = this.cam;
        ctx.globalAlpha = this.flash * 0.45;
        ctx.fillStyle = C.white;
        ctx.fillRect(cam.x, cam.y, this.css.w / cam.z + 1, this.css.h / cam.z + 1);
        ctx.globalAlpha = 1;
      }
    }
    // Sun or moon on everything, and the lights that come on at night.
    drawOutsideLight(ctx, sky, W, H, lights) {
      const n = this.nightAmt;
      const tint = TINT[sky.weather];
      if (tint) {
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = tint[1];
        ctx.fillStyle = tint[0];
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      }
      const sun = (1 - n) * SUN_SHOWS[sky.weather];
      if (sun > 0.05) {
        // Warm light falling from the sun's side.
        const g = ctx.createLinearGradient(W / 2 + 220, 0, W / 2 - 260, H);
        g.addColorStop(0, 'rgba(255,236,160,0.22)');
        g.addColorStop(0.6, 'rgba(255,236,160,0.05)');
        g.addColorStop(1, 'rgba(255,236,160,0)');
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = sun;
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      }
      if (n < 0.02) return;
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = n;
      ctx.fillStyle = '#5a62b0';
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      // Moonlight, cool and thin.
      const g = ctx.createLinearGradient(W / 2 - 120, 0, W / 2 + 100, H);
      g.addColorStop(0, 'rgba(150,170,255,0.2)');
      g.addColorStop(1, 'rgba(150,170,255,0)');
      ctx.globalAlpha = n;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = n * 0.72;
      const glow = WW.glowCanvas(24, '#ffcf80');
      for (const [x, y, r] of lights) {
        if (r === 'window') continue;
        const c = r ? WW.glowCanvas(r, '#ffcf80') : glow;
        ctx.drawImage(c, Math.round(x - c.width / 2), Math.round(y - c.height / 2));
      }
      // Lit windows.
      ctx.fillStyle = '#ffc060';
      ctx.globalAlpha = n * 0.7;
      for (const [x, y, kind, w, h] of lights) if (kind === 'window') ctx.fillRect(x, y, w, h);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    drawLabel(ctx, text, cx, y) {
      const w = WW.tinyWidth(text);
      const x = Math.round(cx - w / 2);
      const head = WW.tinyHead || 0;
      ctx.fillStyle = C.ink;
      ctx.fillRect(x - 3, y - head, w + 6, 9 + head);
      ctx.fillStyle = C.cocoa;
      ctx.fillRect(x - 2, y + 1 - head, w + 4, 7 + head);
      WW.tinyText(ctx, text, x, y + 2, C.paper);
    }
    lotTreeX(lot, I) {
      return lot.x + I.w / 2 + 6;
    }
    treeOffset(key) {
      return this.treeShake[key] > 0 ? Math.round(Math.sin(this.t * 40) * 1.5) : 0;
    }

    // Where a house stands, with its door on the given spot.
    placeHouse(art, x, y) {
      const left = x - (art.doorX + art.doorW / 2);
      const top = y - art.H + 1;
      return { I: art, left, top, rect: { x: left + art.left - 8, y: top + 2, w: art.w + 16, h: art.H - 2 } };
    }
    homeRect() {
      const s = this.game.s;
      return this.placeHouse(WW.exteriorArt(s.exterior, s.room, this.game.sky().season), OUT.DOOR.x, OUT.DOOR.y);
    }
    lotHouse(lot) {
      return this.placeHouse(WW.exteriorArt(lot.ext, lot.room, this.game.sky().season), lot.x, lot.y);
    }

    drawOutside(ctx, sky) {
      const s = this.game.s;
      const live = this.game.live || { state: 'quiet', rpm: 0 };
      this.drawSky(ctx, OUT.W, OUT.SKY + 10, sky);
      ctx.drawImage(WW.outsideCanvas(sky.season), 0, 0);
      const items = [];
      const lights = [];
      const { I, left, top } = this.homeRect();
      items.push({
        y: OUT.DOOR.y,
        draw: () => {
          ctx.drawImage(I.canvas, left, top);
          this.drawDoorSign(ctx, live, OUT.DOOR.x, OUT.DOOR.y - I.lift - I.doorH - 10);
        },
      });
      for (const g of I.windows) lights.push([left + g.x, top + g.y, 'window', g.w, g.h]);
      lights.push([OUT.DOOR.x, OUT.DOOR.y - 8, 18]);
      const market = OUT.MARKET;
      const shop = OUT.SHOP;
      items.push({ y: market.y + market.h, draw: () => ctx.drawImage(WW.marketCanvas(sky.season), market.x, market.y) });
      items.push({ y: shop.y + shop.h, draw: () => ctx.drawImage(WW.shopCanvas(sky.season), shop.x, shop.y) });
      lights.push([market.x + market.w / 2, market.y + 50, 26]);
      for (const x of [14, 58, 102]) lights.push([market.x + x, market.y + 38, 12]);
      for (const g of WW.SHOP_GLOW.windows) lights.push([shop.x + g.x, shop.y + g.y, 'window', g.w, g.h]);
      for (const [x, y, r] of WW.SHOP_GLOW.lamps) lights.push([shop.x + x, shop.y + y, r]);
      const tree = OUT.TREE;
      items.push({ y: tree.y + tree.h, draw: () => ctx.drawImage(WW.shakeTreeCanvas(sky.season), tree.x + this.treeOffset('home'), tree.y) });
      const ranks = OUT.RANKS;
      items.push({ y: ranks.y + ranks.h, draw: () => this.drawRanks(ctx, ranks) });
      lights.push([ranks.x + 48, ranks.y + 50, 30]);
      const board = OUT.BOARD;
      items.push({
        y: board.y + board.h,
        draw: () => {
          ctx.drawImage(WW.boardCanvas(), board.x, board.y);
          if (this.game.boardWaiting()) this.drawFlag(ctx, board.x + 8, board.y - 8);
        },
      });
      const mailbox = OUT.MAILBOX;
      items.push({ y: mailbox.y + mailbox.h, draw: () => ctx.drawImage(WW.mailboxCanvas(E().mailCount(s) > 0), mailbox.x, mailbox.y) });
      const shelf = OUT.SHELF;
      items.push({ y: shelf.y + shelf.h, draw: () => ctx.drawImage(WW.shelfCanvas(s.shelf.length > 0), shelf.x, shelf.y) });
      const gate = OUT.GATE;
      items.push({ y: gate.y + gate.h, draw: () => ctx.drawImage(WW.gateCanvas(false), gate.x, gate.y) });
      const lamp = WW.decorCanvas('lantern_post');
      for (const [x, y] of OUT.LAMPS) {
        items.push({ y, draw: () => ctx.drawImage(lamp, x - 8, y - 23) });
        lights.push([x, y - 19, 22]);
      }
      for (const f of s.yard) {
        const def = WW.DECOR_BY_ID[f.id];
        if (this.editing && this.editing.selected === f && this.editing.ghost) continue;
        const can = WW.decorCanvas(f.id, def.frames ? Math.floor(this.t * (def.fps || 4)) % def.frames : 0);
        const base = (f.y + def.h) * TILE;
        items.push({ y: base, draw: () => ctx.drawImage(can, f.x * TILE, base - can.height) });
        if (def.glow) lights.push([f.x * TILE + (def.w * TILE) / 2, base - Math.min(40, can.height / 2), def.w > 1 ? 30 : 22]);
      }
      for (const g of this.guests) if (g.zone === 'out') items.push({ y: g.y, draw: () => this.drawGuest(ctx, g) });
      for (const p of this.walkers) items.push({ y: p.y, draw: () => this.drawGuest(ctx, p) });
      items.sort((a, b) => a.y - b.y);
      for (const it of items) it.draw();
      this.drawCritters(ctx);
      this.drawWeather(ctx, sky);
      this.drawOutsideLight(ctx, sky, OUT.W, OUT.H, lights);
      this.drawNightSky(ctx, OUT.W, 32, sky);
      this.drawLabel(ctx, 'MARKET', market.x + market.w / 2, market.y + 1);
      const name = 'DECOR SHOP';
      WW.tinyText(ctx, name, Math.round(shop.x + shop.w / 2 - WW.tinyWidth(name) / 2), shop.y + 55, C.butter);
      this.drawLabel(ctx, 'STREET', gate.x + 13, gate.y + 8);
    }

    // The leaderboard stands outside, with the names written on it. Only rewritten when the names change.
    drawRanks(ctx, r) {
      const rows = this.game.topRanks();
      const key = JSON.stringify([rows, rows.length ? null : this.game.ranksNote()]);
      if (this.ranksKey !== key) {
        this.ranksKey = key;
        const c = WW.makeCanvas(r.w, r.h);
        const x = c.getContext('2d');
        x.drawImage(WW.ranksCanvas(), 0, 0);
        const title = 'LEADERBOARD';
        WW.tinyText(x, title, Math.round(r.w / 2 - WW.tinyWidth(title) / 2), 15, C.paper);
        const colors = [C.butter, '#d8dce0', '#e0a070'];
        // No names yet: the board says why.
        if (!rows.length) {
          this.game.ranksNote().forEach((line, i) => WW.tinyText(x, line, Math.round(r.w / 2 - WW.tinyWidth(line) / 2), 40 + i * 11, '#e8f0e0'));
        }
        rows.forEach((row, i) => {
          const y = 29 + i * 11;
          if (row.me) {
            x.fillStyle = '#4f7a70';
            x.fillRect(5, y - 2, r.w - 10, 9);
          }
          const c2 = row.me ? C.white : '#e8f0e0';
          WW.tinyText(x, String(row.place), 7, y, row.place <= 3 ? colors[row.place - 1] : c2);
          WW.tinyText(x, row.name, 7 + (row.place > 9 ? 10 : 6), y, c2);
          const lv = String(row.level);
          WW.tinyText(x, lv, r.w - 8 - WW.tinyWidth(lv), y, C.butter);
        });
        this.ranksArt = c;
      }
      ctx.drawImage(this.ranksArt, r.x, r.y);
    }

    drawCritters(ctx) {
      const n = this.nightAmt;
      for (const b of this.critters) {
        const x = Math.round(b.x);
        const y = Math.round(b.y);
        if (n > 0.5) {
          if (Math.floor(b.p * 2) % 3 === 0) continue;
          ctx.fillStyle = '#e8f08a';
          ctx.fillRect(x, y, 1, 1);
        } else {
          ctx.fillStyle = b.c;
          ctx.fillRect(x - (Math.floor(b.p * 8) % 2), y, 1, 1);
          ctx.fillRect(x + 1, y, 1, 1);
        }
      }
    }

    drawFlag(ctx, x, y) {
      const bob = Math.floor(this.t * 3) % 2;
      ctx.fillStyle = C.ink;
      ctx.fillRect(x - 4, y - bob, 9, 10);
      ctx.fillStyle = C.butter;
      ctx.fillRect(x - 3, y + 1 - bob, 7, 8);
      WW.tinyText(ctx, '!', x - 1, y + 2 - bob, C.ink);
    }

    // The street

    drawStreet(ctx, sky) {
      const A = WW.SEASON_ART[sky.season];
      this.drawSky(ctx, STREET.W, STREET.SKY + 10, sky);
      ctx.drawImage(WW.streetCanvas(sky.season), 0, 0);
      const items = [];
      const lights = [];
      for (const lot of this.game.streetLots()) {
        const { I, left, top } = this.lotHouse(lot);
        ctx.fillStyle = A.path;
        ctx.fillRect(lot.x - 7, lot.y, 14, 16);
        items.push({ y: lot.y, draw: () => ctx.drawImage(I.canvas, left, top) });
        for (const g of I.windows) lights.push([left + g.x, top + g.y, 'window', g.w, g.h]);
        lights.push([lot.x, lot.y - 8, 18]);
        const treeX = this.lotTreeX(lot, I);
        const c = WW.shakeTreeCanvas(sky.season);
        items.push({ y: lot.y + 2, draw: () => ctx.drawImage(c, treeX + this.treeOffset(lot.id), lot.y + 2 - c.height) });
      }
      // Lots nobody is on today stay forest.
      this.game.streetLots();
      this.game.emptyLots.forEach((lot, i) => {
        for (const [dx, dy, kind] of [[-46, -6, i % 3], [-6, -18, (i + 1) % 3], [38, -2, (i + 2) % 3]]) {
          const c = WW.forestTree(sky.season, kind);
          items.push({ y: lot.y + dy, draw: () => ctx.drawImage(c, lot.x + dx - c.width / 2, lot.y + dy - c.height) });
        }
      });
      const lamp = WW.decorCanvas('lantern_post');
      for (const [x, y] of STREET.LAMPS) {
        items.push({ y, draw: () => ctx.drawImage(lamp, x - 8, y - 23) });
        lights.push([x, y - 19, 22]);
      }
      const gate = STREET.GATE;
      items.push({ y: gate.y + gate.h, draw: () => ctx.drawImage(WW.gateCanvas(true), gate.x, gate.y) });
      const next = STREET.NEXT;
      items.push({ y: next.y + next.h, draw: () => ctx.drawImage(WW.gateCanvas(false), next.x, next.y) });
      for (const p of this.walkers) items.push({ y: p.y, draw: () => this.drawGuest(ctx, p) });
      items.sort((a, b) => a.y - b.y);
      for (const it of items) it.draw();
      this.drawCritters(ctx);
      this.drawWeather(ctx, sky);
      this.drawOutsideLight(ctx, sky, STREET.W, STREET.H, lights);
      this.drawNightSky(ctx, STREET.W, 22, sky);
      this.drawLabel(ctx, 'HOME', gate.x + 15, gate.y + 8);
      this.drawLabel(ctx, 'NEXT STREET', next.x + 13, next.y - 3);
      this.drawLabel(ctx, this.game.streetMovesText(), next.x + 13, next.y + 8);
    }

    // Shared layers

    drawEditor(ctx) {
      const ed = this.editing;
      const top = this.view === 'in' ? DY : 0;
      ctx.fillStyle = C.paper;
      if (this.view === 'in') {
        const m = this.m;
        ctx.globalAlpha = 0.5;
        for (let c = 0; c <= m.cols; c++) ctx.fillRect(c * TILE, DY, 1, m.rows * TILE);
        for (let r = 0; r <= m.rows; r++) ctx.fillRect(0, DY + r * TILE, m.cols * TILE, 1);
        ctx.globalAlpha = 1;
      } else if (this.view === 'out') {
        ctx.globalAlpha = 0.28;
        for (let r = 0; r < OUT.rows; r++) for (let c = 0; c < OUT.cols; c++) if (OUT.free(c, r)) ctx.fillRect(c * TILE + 1, r * TILE + 1, TILE - 2, TILE - 2);
        ctx.globalAlpha = 1;
      }
      if (ed.ghost) {
        const def = WW.DECOR_BY_ID[ed.ghost.id];
        const can = WW.decorCanvas(ed.ghost.id);
        ctx.globalAlpha = 0.8;
        ctx.drawImage(can, ed.ghost.x * TILE, top + (ed.ghost.y + def.h) * TILE - can.height);
        ctx.globalAlpha = 1;
        ctx.fillStyle = ed.ghost.bad ? 'rgba(228,87,46,.4)' : 'rgba(111,179,107,.35)';
        ctx.fillRect(ed.ghost.x * TILE, top + ed.ghost.y * TILE, def.w * TILE, def.h * TILE);
      }
    }

    // Phones have no pointer to change, so what can be tapped shows a small icon.
    drawTouchHints(ctx) {
      if (this.game.hasMouse) return;
      const bob = Math.floor(this.t * 2) % 2;
      if (this.view === 'in') for (const d of this.dirt) ctx.drawImage(WW.iconCanvas('broom'), Math.round(d.x) - 4, Math.round(d.y) - 11 - bob, 8, 8);
      if (this.view === 'out' && this.game.treeReady()) ctx.drawImage(WW.iconCanvas('shake'), OUT.TREE.x + 15, OUT.TREE.y + 2 - bob, 10, 10);
    }

    drawArrow(ctx) {
      const target = this.game.nextTarget();
      if (!target || target.view !== this.view) return;
      const bob = Math.floor(this.t * 3) % 2;
      const x = Math.round(target.x);
      const y = Math.round(target.y) - bob;
      ctx.fillStyle = C.ink;
      ctx.fillRect(x - 3, y - 8, 7, 5);
      ctx.fillRect(x - 5, y - 3, 11, 1);
      ctx.fillRect(x - 4, y - 2, 9, 1);
      ctx.fillRect(x - 3, y - 1, 7, 1);
      ctx.fillRect(x - 2, y, 5, 1);
      ctx.fillRect(x - 1, y + 1, 3, 1);
      ctx.fillRect(x, y + 2, 1, 1);
      ctx.fillStyle = C.tomato;
      ctx.fillRect(x - 2, y - 7, 5, 5);
      ctx.fillRect(x - 3, y - 2, 7, 1);
      ctx.fillRect(x - 2, y - 1, 5, 1);
      ctx.fillRect(x - 1, y, 3, 1);
      ctx.fillRect(x, y + 1, 1, 1);
    }

    drawHover(ctx) {
      const r = this.hover && this.hover.rect;
      if (!r) return;
      const x = Math.round(r.x);
      const y = Math.round(r.y);
      const w = Math.round(r.w);
      const h = Math.round(r.h);
      const L = 3;
      ctx.fillStyle = C.butter;
      for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
        ctx.fillRect(sx > 0 ? cx : cx - L, cy, L, 1);
        ctx.fillRect(cx, sy > 0 ? cy : cy - L, 1, L);
      }
    }

    // Around the room the world outside shows through, dimmed. Outside, the forest just carries on.
    paintBackdrop(out) {
      const W = this.canvas.width;
      const H = this.canvas.height;
      const sky = this.game.sky();
      const key = [this.view, sky.season, sky.weather, W, H, this.game.visit ? 1 : 0, this.nightAmt > 0.5 ? 1 : 0].join();
      if (this.backdropKey !== key) {
        this.backdropKey = key;
        const c = WW.makeCanvas(W, H);
        const x = c.getContext('2d');
        x.fillStyle = SKY_DAY[sky.weather];
        x.fillRect(0, 0, W, H);
        const src = this.game.visit ? WW.streetCanvas(sky.season) : WW.outsideCanvas(sky.season);
        const [cx, cy, cw, ch] = [320, 0, 416, 352];
        const sc = Math.max(W / cw, H / ch);
        if ('filter' in x) x.filter = 'blur(3px)';
        x.drawImage(src, cx, cy, cw, ch, (W - cw * sc) / 2, (H - ch * sc) / 2, cw * sc, ch * sc);
        x.filter = 'none';
        x.fillStyle = 'rgba(40,28,60,.5)';
        x.fillRect(0, 0, W, H);
        if (this.nightAmt > 0.5) {
          x.fillStyle = 'rgba(30,34,90,.55)';
          x.fillRect(0, 0, W, H);
        }
        this.backdrop = c;
      }
      out.drawImage(this.backdrop, 0, 0);
    }

    blit() {
      const out = this.out;
      const k = this.ku;
      const m = this.m;
      const cam = this.cam;
      const vw = this.canvas.width / k;
      const vh = this.canvas.height / k;
      if (m.W < vw || m.H < vh) this.paintBackdrop(out);
      const sx = Math.max(0, cam.x);
      const sy = Math.max(0, cam.y);
      const sw = Math.min(m.W - sx, vw - (sx - cam.x));
      const sh = Math.min(m.H - sy, vh - (sy - cam.y));
      const dx = (sx - cam.x) * k;
      const dy = (sy - cam.y) * k;
      if (dx > 0 || dy > 0) {
        out.fillStyle = C.ink;
        out.fillRect(dx - k, dy - k, sw * k + 2 * k, sh * k + 2 * k);
      }
      out.imageSmoothingEnabled = false;
      out.drawImage(this.low, sx, sy, sw, sh, dx, dy, sw * k, sh * k);
    }

    // What is at this spot. Everything comes with a box for the highlight.

    hit(x, y) {
      if (!this.m || !this.st) return { kind: 'none' };
      if (this.view === 'in') return this.hitInside(x, y);
      if (this.view === 'out') return this.hitOutside(x, y);
      return this.hitStreet(x, y);
    }

    hitGuests(x, y, zone) {
      for (const g of this.guests) if (g.zone === zone && Math.abs(g.x - x) < 9 && y > g.y - 24 && y < g.y + 1) return { kind: 'guest', g, rect: { x: g.x - 10, y: g.y - 24, w: 20, h: 24 } };
      return null;
    }
    hitWalkers(x, y) {
      for (const p of this.walkers) if (Math.abs(p.x - x) < 9 && y > p.y - 22 && y < p.y + 1) return { kind: 'walker', p, rect: { x: p.x - 10, y: p.y - 22, w: 20, h: 22 } };
      return null;
    }

    hitInside(x, y) {
      const st = this.st;
      const m = this.m;
      const furnitureAt = (col, row, rugs) =>
        st.furniture.slice().reverse().find((f) => {
          const d = WW.DECOR_BY_ID[f.id];
          return (rugs || d.kind !== 'rug') && col >= f.x && col < f.x + d.w && row >= f.y && row < f.y + d.h;
        });
      if (this.editing) {
        if (y >= DY && y < DY + m.rows * TILE && x >= 0 && x < m.W) {
          const col = Math.floor(x / TILE);
          const row = Math.floor((y - DY) / TILE);
          const item = furnitureAt(col, row) || furnitureAt(col, row, true);
          return { kind: 'tile', col, row, item: item || null, rect: item ? { x: item.x * TILE, y: DY + item.y * TILE, w: WW.DECOR_BY_ID[item.id].w * TILE, h: WW.DECOR_BY_ID[item.id].h * TILE } : null };
        }
        return { kind: 'none' };
      }
      if (x >= m.doorX && x < m.doorX + m.doorW && y >= m.frontY - 9) return { kind: 'door', rect: { x: m.doorX, y: m.frontY - 9, w: m.doorW, h: 27 } };
      for (const d of this.dirt) if (Math.abs(d.x - x) < 7 && Math.abs(d.y - y) < 6) return { kind: 'dirt', d, rect: { x: d.x - 5, y: d.y - 4, w: 10, h: 7 } };
      // Guests and staff on top of the furniture.
      const guest = this.hitGuests(x, y, 'in');
      if (guest) return guest;
      for (const list of [this.chefs, this.waiters, this.cleaners]) {
        for (const c of list.values()) if (Math.abs(c.x - x) < 9 && y > c.y - 25 && y < c.y) return { kind: 'staff', id: c.id, rect: { x: c.x - 10, y: c.y - 25, w: 20, h: 25 } };
      }
      for (let i = 0; i < m.slots; i++) {
        const sx = WORLD.STATION_X + i * WORLD.STATION_W;
        if (x >= sx && x < sx + WORLD.STATION_W && y >= WORLD.STATION_Y - 20 && y < WORLD.STATION_Y + 26) {
          return { kind: i < st.stations.length ? 'station' : 'lockedStation', index: i, rect: { x: sx, y: WORLD.STATION_Y - 4, w: WORLD.STATION_W, h: 30 } };
        }
      }
      if (x < 46 && y < 60) return { kind: 'wheel', rect: { x: 2, y: 6, w: 44, h: 50 } };
      if (y >= 78 && y < 104) {
        const keys = this.counterKeys();
        const i = Math.floor((x - 4) / 19);
        if (i >= 0 && i < keys.length) return { kind: 'dish', key: keys[i], rect: { x: 4 + i * 19, y: 80, w: 17, h: 17 } };
        return { kind: 'counter', rect: { x: 0, y: 88, w: m.W, h: 16 } };
      }
      if (y >= DY && y < m.frontY) {
        const col = Math.floor(x / TILE);
        const row = Math.floor((y - DY) / TILE);
        const item = furnitureAt(col, row) || furnitureAt(col, row, true);
        if (item) {
          const d = WW.DECOR_BY_ID[item.id];
          return { kind: 'furniture', item, def: d, rect: { x: item.x * TILE, y: DY + item.y * TILE - (d.kind === 'rug' ? 0 : 6), w: d.w * TILE, h: d.h * TILE + (d.kind === 'rug' ? 0 : 6) } };
        }
      }
      return { kind: 'floor' };
    }

    hitOutside(x, y) {
      const s = this.game.s;
      const yardAt = (col, row) =>
        s.yard.slice().reverse().find((f) => {
          const d = WW.DECOR_BY_ID[f.id];
          return col >= f.x && col < f.x + d.w && row >= f.y && row < f.y + d.h;
        });
      const col = Math.floor(x / TILE);
      const row = Math.floor(y / TILE);
      if (this.editing) {
        const item = yardAt(col, row);
        if (x < 0 || y < 0 || x >= OUT.W || y >= OUT.H) return { kind: 'none' };
        return { kind: 'tile', col, row, item: item || null, rect: item ? { x: item.x * TILE, y: item.y * TILE, w: WW.DECOR_BY_ID[item.id].w * TILE, h: WW.DECOR_BY_ID[item.id].h * TILE } : null };
      }
      const guest = this.hitGuests(x, y, 'out') || this.hitWalkers(x, y);
      if (guest) return guest;
      const item = yardAt(col, row);
      if (item) {
        const d = WW.DECOR_BY_ID[item.id];
        return { kind: 'yarditem', item, def: d, rect: { x: item.x * TILE, y: item.y * TILE, w: d.w * TILE, h: d.h * TILE } };
      }
      for (const [kind, r] of [['mailbox', OUT.MAILBOX], ['shelf', OUT.SHELF], ['board', OUT.BOARD], ['tree', OUT.TREE], ['gate', OUT.GATE], ['ranks', OUT.RANKS], ['market', OUT.MARKET], ['shop', OUT.SHOP]]) {
        if (inRect(x, y, r)) return { kind, rect: r };
      }
      const home = this.homeRect();
      if (inRect(x, y, home.rect)) return { kind: 'home', rect: home.rect };
      return { kind: 'floor' };
    }

    hitStreet(x, y) {
      if (inRect(x, y, STREET.GATE)) return { kind: 'homegate', rect: STREET.GATE };
      if (inRect(x, y, STREET.NEXT)) return { kind: 'nextstreet', rect: STREET.NEXT };
      for (const lot of this.game.streetLots()) {
        const { I, rect } = this.lotHouse(lot);
        const tree = { x: this.lotTreeX(lot, I), y: lot.y - 42, w: 40, h: 44 };
        if (inRect(x, y, tree)) return { kind: 'ntree', id: lot.id, rect: tree };
        if (inRect(x, y, rect)) return { kind: 'house', id: lot.id, rect };
      }
      return this.hitWalkers(x, y) || { kind: 'floor' };
    }

    // A tree shakes and drops a few leaves.
    shakeTree(key) {
      this.treeShake[key] = 0.6;
      const zone = this.view;
      const at = zone === 'out' ? { x: OUT.TREE.x + 20, y: OUT.TREE.y + 16 } : { x: 0, y: 0 };
      if (zone === 'street') {
        const lot = this.game.streetLots().find((l) => l.id === key);
        if (lot) {
          at.x = this.lotTreeX(lot, this.lotHouse(lot).I) + 20;
          at.y = lot.y - 26;
        }
      }
      const sky = this.game.sky();
      const A = WW.SEASON_ART[sky.season];
      const colors = A.green || [C.white, C.white];
      for (let i = 0; i < 8; i++) this.parts.push({ zone, x: at.x - 14 + Math.random() * 28, y: at.y + Math.random() * 10, vx: Math.random() * 6 - 3, vy: 8, life: 0.8, c: colors[i % 2], grav: 30 });
    }
  }

  WW.Scene = Scene;
})((globalThis.WW = globalThis.WW || {}));
