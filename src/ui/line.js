// On the Line: a dish carousel turned by the hamster's real wheel passes, one step per pass.
(function (WW) {
  const { C } = WW;
  const E = () => WW.Engine;
  const SLOTS = 10;
  const R = 62;
  const CX = 96;
  const CY = 128;
  const PATIENCE = 28;
  const TURN_PASSES = 90;

  class Line {
    constructor(game) {
      this.game = game;
      this.root = document.getElementById('line');
      this.canvas = document.getElementById('linecanvas');
      this.bar = document.getElementById('linebar');
      this.low = WW.makeCanvas(192, 224);
      this.ctx = this.low.getContext('2d');
      this.out = this.canvas.getContext('2d');
      this.active = false;
      this.canvas.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.serve();
      });
      document.getElementById('lineserve').addEventListener('click', () => this.serve());
      document.getElementById('linequit').addEventListener('click', () => this.finish('You stepped off the line.'));
      window.addEventListener('keydown', (e) => {
        if (this.active && (e.code === 'Space' || e.code === 'Enter')) {
          e.preventDefault();
          this.serve();
        } else if (this.active && e.code === 'Escape') this.finish('You stepped off the line.');
      });
    }

    // replay: pass times in ms from zero, null when following the wheel right now.
    start(replay) {
      const g = this.game;
      if (!E().inStock(g.s).length) return g.toast('The counter is empty. Cook something first.', 'bad');
      this.replay = replay;
      this.t0 = performance.now();
      this.clockAt = g.now();
      this.passIdx = 0;
      this.steps = 0;
      this.drawnPos = 0;
      this.plates = new Array(SLOTS).fill(null);
      this.tickets = [];
      this.combo = 0;
      this.best = 0;
      this.tips = 0;
      this.served = 0;
      this.missed = 0;
      this.idleMs = 0;
      this.shake = 0;
      this.flash = 0;
      this.fx = [];
      this.liveCumAt = g.feed.mode === 'live' ? g.live.cum : null;
      this.active = true;
      for (let i = 0; i < SLOTS; i++) if (i % 2 === 0) this.plates[i] = this.nextPlate();
      this.addTicket();
      E().lineDay(g.s, g.now());
      g.s.line.plays++;
      this.root.classList.add('show');
      this.fit();
      this.bar.textContent = WW.tr(replay ? 'A replay of his last run at his real pace, with long pauses trimmed. Half tips.' : 'Live. Every turn of the real wheel moves the plates one step.');
      this.last = performance.now();
      requestAnimationFrame(() => this.loop());
    }

    fit() {
      const dpr = globalThis.devicePixelRatio || 1;
      const availW = Math.min(window.innerWidth - 20, 620);
      const availH = window.innerHeight - 150;
      const scale = Math.max(1, Math.min(availW / 192, availH / 224));
      this.canvas.style.width = Math.floor(192 * scale) + 'px';
      this.canvas.style.height = Math.floor(224 * scale) + 'px';
      const k = Math.ceil(scale * dpr);
      this.canvas.width = 192 * k;
      this.canvas.height = 224 * k;
    }

    nextPlate() {
      const keys = E().inStock(this.game.s);
      if (!keys.length) return null;
      // Keep a little variety on the carousel: what is plentiful shows up more.
      const onWheel = this.plates ? this.plates.filter(Boolean) : [];
      const pool = keys.filter((k) => this.game.s.stock[k] > onWheel.filter((x) => x === k).length);
      if (!pool.length) return null;
      return pool[Math.floor(Math.random() * pool.length)];
    }

    addTicket() {
      if (this.tickets.length >= 3) return;
      const onWheel = this.plates.filter(Boolean);
      if (!onWheel.length) return;
      const key = onWheel[Math.floor(Math.random() * onWheel.length)];
      this.ticketN = (this.ticketN || 0) + 1;
      this.tickets.push({ key, left: PATIENCE, sp: E().lineGuest(this.game.s, Math.floor(Math.random() * 1e9)) });
    }

    atHatch() {
      return ((SLOTS - (this.steps % SLOTS)) % SLOTS + SLOTS) % SLOTS;
    }

    serve() {
      if (!this.active) return;
      const i = this.atHatch();
      const plate = this.plates[i];
      const t = plate ? this.tickets.findIndex((x) => x.key === plate) : -1;
      if (t < 0) {
        this.combo = 0;
        this.missed++;
        this.shake = 0.25;
        this.game.sound('miss');
        return;
      }
      const ticket = this.tickets[t];
      this.tickets.splice(t, 1);
      const coins = E().lineServe(this.game.s, plate, this.combo, !!this.replay, this.game.now());
      this.plates[i] = null;
      if (E().lineTipsLeft(this.game.s, this.game.now()) <= 0) {
        if (coins) {
          this.served++;
          this.tips += coins;
        }
        return this.finish("That's all the tips for today. Come back tomorrow.");
      }
      if (coins === null) {
        this.game.sound('miss');
        return;
      }
      this.combo++;
      this.best = Math.max(this.best, this.combo);
      this.served++;
      this.tips += coins;
      this.flash = 0.25;
      this.fx.push({ x: CX, y: CY - R - 12, text: '+' + coins, life: 0.9 });
      const isNew = !this.game.s.book[ticket.sp.id];
      this.game.s.book[ticket.sp.id] = (this.game.s.book[ticket.sp.id] || 0) + 1;
      if (isNew) this.game.onNewSpecies(ticket.sp);
      this.game.sound('serve');
      this.addTicket();
    }

    // One real wheel pass.
    step() {
      this.steps++;
      this.game.sound('tick');
      // The slot passing the kitchen window at the bottom gets refilled.
      const kitchen = (this.atHatch() + SLOTS / 2) % SLOTS;
      if (!this.plates[kitchen]) this.plates[kitchen] = this.nextPlate();
      for (const t of this.tickets) t.left--;
      const gone = this.tickets.filter((t) => t.left <= 0);
      if (gone.length) {
        this.combo = 0;
        this.missed += gone.length;
        this.game.sound('miss');
      }
      this.tickets = this.tickets.filter((t) => t.left > 0);
      if (this.tickets.length < 3 && this.steps % 7 === 0) this.addTicket();
      if (!this.tickets.length) this.addTicket();
    }

    pump(dt) {
      if (this.replay) {
        const elapsed = performance.now() - this.t0;
        while (this.passIdx < this.replay.length && this.replay[this.passIdx] <= elapsed) {
          this.passIdx++;
          this.step();
        }
        if (this.passIdx >= this.replay.length || this.steps >= TURN_PASSES) return this.finish('That was the whole run.');
        return;
      }
      const g = this.game;
      let n;
      if (g.feed.mode === 'live') {
        const cum = g.live.cum;
        this.backlog = (this.backlog || 0) + Math.max(0, cum - this.liveCumAt);
        this.liveCumAt = cum;
        this.stepTimer = (this.stepTimer || 0) + dt * 1000;
        const every = 60000 / Math.max(40, g.live.rpm || 70) / (this.backlog > 6 ? 2 : 1);
        n = 0;
        while (this.backlog > 0 && this.stepTimer >= every) {
          this.stepTimer -= every;
          this.backlog--;
          n++;
        }
        if (!this.backlog) this.stepTimer = Math.min(this.stepTimer, every);
      } else {
        const now = g.now();
        n = g.feed.passesBetween(this.clockAt, now);
        this.clockAt = now;
      }
      for (let i = 0; i < n; i++) this.step();
      if (n === 0 && !this.backlog) this.idleMs += dt * 1000;
      else this.idleMs = 0;
      if (this.idleMs > 8000) return this.finish('He stopped for a breather, so the line stops too.');
      if (this.steps >= TURN_PASSES) return this.finish('Your turn is over. The plates are still warm.');
    }

    finish(reason) {
      if (!this.active) return;
      this.active = false;
      this.root.classList.remove('show');
      const g = this.game;
      g.s.line.best = Math.max(g.s.line.best || 0, this.best);
      g.afterAction();
      g.showLineResult({ reason, served: this.served, tips: this.tips, best: this.best, missed: this.missed, replay: !!this.replay });
    }

    loop() {
      if (!this.active) return;
      const now = performance.now();
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.pump(dt);
      if (!this.active) return;
      this.draw(dt);
      requestAnimationFrame(() => this.loop());
    }

    draw(dt) {
      const x = this.ctx;
      const g = this.game;
      x.imageSmoothingEnabled = false;
      this.drawnPos += (this.steps - this.drawnPos) * Math.min(1, dt * 14);
      this.shake = Math.max(0, this.shake - dt);
      this.flash = Math.max(0, this.flash - dt);
      const sx = this.shake > 0 ? Math.round(Math.sin(performance.now() / 20) * 2) : 0;

      x.fillStyle = '#3f8a86';
      x.fillRect(0, 0, 192, 224);
      x.fillStyle = '#478f8a';
      for (let i = 0; i < 192; i += 12) x.fillRect(i, 0, 6, 224);
      x.fillStyle = '#8a5a3c';
      x.fillRect(0, 202, 192, 22);
      x.fillStyle = '#c98f5a';
      x.fillRect(0, 202, 192, 1);

      // tickets on a rail
      x.fillStyle = C.iron;
      x.fillRect(4, 6, 184, 2);
      this.tickets.forEach((t, i) => {
        const tx = 8 + i * 60;
        x.fillStyle = C.ink;
        x.fillRect(tx - 1, 7, 56, 42);
        x.fillStyle = C.paper;
        x.fillRect(tx, 8, 54, 40);
        const def = E().dishDef(t.key);
        x.drawImage(WW.dishIcon(def, def.gold), tx + 3, 11);
        x.drawImage(WW.animalFrames(t.sp)[0], tx + 28, 8, 20, 24);
        x.fillStyle = '#d8cfc0';
        x.fillRect(tx + 3, 40, 48, 4);
        const pr = t.left / PATIENCE;
        x.fillStyle = pr < 0.3 ? C.tomato : C.leaf;
        x.fillRect(tx + 3, 40, Math.round(48 * pr), 4);
      });

      // carousel
      const cx = CX + sx;
      x.fillStyle = C.ink;
      x.beginPath();
      x.arc(cx, CY, R + 13, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = '#d9a860';
      x.beginPath();
      x.arc(cx, CY, R + 11, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = '#e8c088';
      x.beginPath();
      x.arc(cx, CY, R - 11, 0, Math.PI * 2);
      x.fill();
      const hatch = -Math.PI / 2;
      // Spoke marks turn with the wheel.
      for (let i = 0; i < SLOTS; i++) {
        const a = hatch + ((i + this.drawnPos) / SLOTS) * Math.PI * 2;
        const px = cx + Math.cos(a) * R;
        const py = CY + Math.sin(a) * R;
        x.fillStyle = C.paper;
        x.fillRect(Math.round(px) - 9, Math.round(py) - 8, 18, 16);
        const plate = this.plates[i];
        if (plate) {
          const def = E().dishDef(plate);
          x.drawImage(WW.dishIcon(def, def.gold), Math.round(px) - 8, Math.round(py) - 8);
        }
      }
      // Hatch marker at the top.
      x.fillStyle = this.flash > 0 ? C.butter : C.tomato;
      x.fillRect(cx - 13, CY - R - 12, 26, 3);
      x.fillRect(cx - 13, CY - R - 12, 3, 24);
      x.fillRect(cx + 10, CY - R - 12, 3, 24);
      x.fillRect(cx - 13, CY - R + 9, 26, 3);
      // Kitchen window at the bottom.
      WW.tinyText(x, 'KITCHEN', cx - Math.floor(WW.tinyWidth('KITCHEN') / 2), CY + R + 14, C.paper);

      // The wheel in the middle, the same real wheel.
      const wheel = WW.wheelCanvas(Math.floor(this.drawnPos * 2));
      const size = 41;
      x.drawImage(wheel, cx - size / 2, CY - size / 2, size, size);
      x.drawImage(WW.squeekRun(this.steps % 2), cx - 10, CY + 3);

      // Score
      WW.tinyText(x, `TIPS ${this.tips}`, 6, 207, C.paper);
      WW.tinyText(x, `COMBO ${this.combo}`, 6, 215, C.butter);
      const left = Math.max(0, TURN_PASSES - this.steps);
      const lt = `${left} TURNS LEFT`;
      WW.tinyText(x, lt, 186 - WW.tinyWidth(lt), 207, C.paper);
      for (const f of this.fx) {
        f.life -= dt;
        f.y -= dt * 18;
        WW.tinyText(x, f.text, f.x - 6, f.y, C.butter);
      }
      this.fx = this.fx.filter((f) => f.life > 0);
      this.out.imageSmoothingEnabled = false;
      this.out.drawImage(this.low, 0, 0, this.canvas.width, this.canvas.height);
    }
  }
  WW.Line = Line;
})((globalThis.WW = globalThis.WW || {}));
