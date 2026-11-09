// The practice kitchen: a throwaway restaurant with a pretend hamster, and a coach who walks you through it.
// It runs on the real rules and the real screens. It is never saved and never reaches the leaderboard, and a real restaurant waits untouched.
(function (WW) {
  const { el, img, btn, WORLD } = WW;
  const E = () => WW.Engine;
  const OUT = WW.OUTSIDE;
  const FAST = 180;
  const SLOW = 10;
  const ROUND_A_SECOND = 600;

  const first = (selector) => document.querySelector(selector);
  const panelButton = () => first('#panelinner .row .btn:not([aria-disabled="true"])');

  class Practice {
    constructor(game) {
      this.game = game;
      this.box = document.getElementById('coach');
      this.ring = document.getElementById('coachring');
      this.i = -1;
      this.stepKey = null;
    }

    // Everything real is put aside first and comes back as it was.
    begin() {
      const g = this.game;
      if (g.s) g.autosave(true);
      this.real = g.s;
      this.realFeed = g.feed;
      this.realQueue = g.queue;
      g.queue = [];
      g.endArrange();
      g.visit = null;
      g.practice = this;
      this.feed = new WW.PracticeFeed();
      g.feed = this.feed;
      const s = E().newGame(this.feed.now(), this.feed, { name: 'Bean', shop: WW.tr('Practice Kitchen'), fur: 'golden', hat: 'toque' });
      // An empty counter, so cooking comes first. The prep list and its rewards are for the real thing.
      s.stock = {};
      for (const p of WW.PREP) s.prep[p.id] = true;
      s.cash = 600;
      Object.assign(s.pantry, { carrot: 12, peas: 12, oats: 30 });
      s.soundOn = g.sfx.on;
      g.s = s;
      document.body.classList.add('practice');
      this.resetCameras();
      document.getElementById('overlay').classList.remove('show');
      g.afterLoad();
      if (!g.desktop()) g.setPanelOpen(false);
      this.steps = this.lesson();
      this.box.hidden = false;
      this.go(0);
    }
    resetCameras() {
      for (const cam of Object.values(this.game.scene.cams)) {
        cam.key = null;
        cam.user = false;
      }
    }

    get s() {
      return this.game.s;
    }
    get scene() {
      return this.game.scene;
    }
    station(type) {
      return this.s.stations.findIndex((st) => st.type === type);
    }
    picking(type) {
      const p = this.game.panels;
      return p.tab === 'kitchen' && p.sub.station === this.station(type) && this.game.panelVisible();
    }
    closeSheet() {
      if (!this.game.desktop()) this.game.setPanelOpen(false);
    }
    stationRect(type) {
      return { view: 'in', x: WORLD.STATION_X + this.station(type) * WORLD.STATION_W, y: WORLD.STATION_Y - 4, w: WORLD.STATION_W, h: 30 };
    }
    hasDish() {
      return E().inStock(this.s).length > 0;
    }
    // Comes back through the door if the player wandered off, or the step was skipped.
    goTo(view) {
      const g = this.game;
      if (g.scene.view !== view || g.visit) g.walkTo(view);
    }
    // How a cooking step points: at the station, then at the Cook button once the dish list is open.
    cookStep(type, def, extra) {
      return Object.assign(
        {
          view: 'in',
          todo: () => (this.picking(type) ? `Click Cook next to ${def.n}.` : `Click the ${WW.STATION_INFO[type].n}.`),
          ring: () => (this.picking(type) ? { el: panelButton() } : this.stationRect(type)),
          done: () => this.s.flags['cooked_' + type],
          skip: true,
        },
        extra
      );
    }

    lesson() {
      const g = this.game;
      const CFG = WW.CFG;
      const f = this.feed;
      const stove = WW.DISH.carrot_coins;
      const wok = WW.DISH.tossed_peas;
      const pot = WW.DISH.oat_porridge;
      const dreamHours = CFG.DREAM_ROUNDS / 6;
      const goldHours = CFG.GOLD_ROUNDS / 6;
      return [
        {
          id: 'wheel',
          title: 'Meet Squeektoshi',
          body: 'He is a real hamster on a real wheel, and your restaurant moves with him. In this practice kitchen he is only pretending, so everything can happen quickly. Right now he is asleep.',
          view: 'in',
          ring: () => ({ view: 'in', x: 2, y: 6, w: 44, h: 50 }),
          next: true,
        },
        this.cookStep('stove', stove, {
          id: 'stove',
          title: 'Cook first',
          body: 'Guests can only eat what is on the counter, and yours is empty. The stove runs on plain time, whatever he is doing.',
          enter: () => {
            f.setRate(FAST);
            this.stoveAt = performance.now();
            this.stoveOpened = false;
          },
          // Most people who stopped here never found the stove. After a few seconds the dish list opens by itself.
          every: () => {
            if (this.stoveOpened || performance.now() - this.stoveAt < 3000) return;
            this.stoveOpened = true;
            if (!this.picking('stove')) this.game.panels.open('kitchen', { station: this.station('stove') });
          },
        }),
        {
          id: 'stoveWait',
          title: 'Your chef is on it',
          body: `This batch takes ${stove.need} minutes in the real game. Time runs fast in practice, so keep an eye on the counter. Food never spoils, so you can cook ahead before you leave.`,
          view: 'in',
          enter: () => this.closeSheet(),
          ring: () => this.stationRect('stove'),
          done: () => this.hasDish(),
          skip: true,
        },
        {
          id: 'run',
          title: 'He wakes up',
          body: 'The real Squeektoshi runs when he feels like it, and nobody can make him. Just this once, the button is yours.',
          view: 'in',
          enter: () => {
            this.closeSheet();
            f.setRate(SLOW);
          },
          action: ['Make him run', () => f.run(), 'tomato'],
          done: () => f.running,
        },
        {
          id: 'guests',
          title: 'Guests walk in',
          body: `Every ${CFG.WORK_PER_GUEST} passes of the wheel bring one guest. They sit down, eat what is on the counter and pay. Each seat feeds ${CFG.TURNS_PER_ROUND} guests a round, and a round lasts 10 minutes.`,
          view: 'in',
          enter: () => {
            f.running || f.run();
            if (!this.hasDish()) this.s.stock.carrot_coins = 20;
            this.servedAt = this.s.stats.served;
          },
          done: () => this.s.stats.served >= this.servedAt + 4 && this.scene.guests.some((x) => x.state === 'eat' || x.state === 'leave'),
          skip: true,
        },
        {
          id: 'till',
          title: 'The till',
          body: 'What guests pay goes into the till first. That is the plus number next to your cash. It is banked each time a round settles.',
          ring: () => ({ el: first('#statCash') }),
          enter: () => (this.cashAt = this.s.cash),
          action: ['End this round', () => f.finishRound(), 'tomato'],
          done: () => this.s.cash > this.cashAt,
          skip: true,
        },
        {
          id: 'sleep',
          title: 'Bedtime',
          body: 'When he stops, the restaurant goes quiet and no guests come in. That is normal. He is off the wheel most of the day. The wok, your second station, only cooks on his wheel passes. The pot, the third, only simmers while he sleeps.',
          view: 'in',
          enter: () => this.closeSheet(),
          action: ['Let him sleep', () => { f.sleep(); f.setRate(ROUND_A_SECOND); }, 'lilac'],
          done: () => !f.running,
        },
        {
          id: 'night',
          title: 'While he sleeps',
          body: 'Each quiet round earns 1 Wink and your staff get their energy back. Watch your Winks go up.',
          ring: () => ({ el: first('#statWink') }),
          enter: () => {
            if (f.running) {
              f.sleep();
              f.setRate(ROUND_A_SECOND);
            }
            this.nightAt = performance.now();
          },
          done: () => performance.now() - this.nightAt > 5000,
          skip: true,
        },
        {
          id: 'dream',
          title: 'A long sleep brings a dream',
          body: `After ${dreamHours} hours of sleep he wakes up with a Dream Dish, the same for every player. It costs ${CFG.DREAM_DISH_COST} Winks to cook, and legendary guests only come for dream dishes. After ${goldHours} hours the dream is golden.`,
          action: [
            'Skip to the morning',
            () => {
              f.setRate(FAST);
              f.jump(Math.max(2, CFG.DREAM_ROUNDS + 2 - this.s.clock.streak) * WW.ROUND_MS);
              f.run();
              this.wokeAt = performance.now();
              this.dreamSet = false;
              this.step.acted = true;
              this.stepKey = null;
            },
            'lilac',
          ],
          every: () => {
            if (this.wokeAt && !this.dreamSet && performance.now() - this.wokeAt > 1200) {
              this.dreamSet = true;
              f.finishRound();
            }
          },
          done: () => !!this.s.dreamDish && !g.queue.length && !document.getElementById('overlay').classList.contains('show'),
        },
        {
          id: 'market',
          title: 'The market',
          body: 'Your door leads outside. Ingredients come from the market, and every restaurant has its own stall. The goods change each day, and better things are scarce.',
          view: 'out',
          enter: () => {
            this.closeSheet();
            f.setRate(SLOW);
            f.running || f.run();
            this.goTo('out');
          },
          todo: () => (g.panels.tab === 'market' && g.panelVisible() ? 'Click +1 to buy something.' : 'Click the market.'),
          ring: () => (g.panels.tab === 'market' && g.panelVisible() ? { el: panelButton() } : { view: 'out', x: OUT.MARKET.x, y: OUT.MARKET.y, w: OUT.MARKET.w, h: OUT.MARKET.h }),
          done: () => this.s.flags.bought,
          skip: true,
        },
        {
          id: 'howto',
          title: 'If you forget',
          body: 'Out here are also the decor shop, the notice board, the leaderboard and your neighbours. How To Play has all of it in short, and it can bring you back to this practice kitchen at any time.',
          enter: () => this.closeSheet(),
          ring: () => ({ el: first('.tab[data-tab="howto"]') }),
          next: true,
          nextLabel: 'Finish',
        },
      ];
    }

    get step() {
      return this.steps[this.i];
    }
    go(i) {
      const before = this.step;
      if (before && before.leave) before.leave();
      this.i = i;
      if (i >= this.steps.length) return this.finishCard();
      this.stepKey = null;
      this.lookedAt = null;
      const step = this.step;
      this.game.count.once('lesson_' + step.id);
      if (step.enter) step.enter();
      this.game.ctaKey = null;
      this.game.updateCta();
      this.draw();
      this.place();
    }
    next() {
      this.game.sound('tap');
      this.go(this.i + 1);
    }
    // A step can be off in the wrong place. The coach then says how to get back.
    astray() {
      const step = this.step;
      if (!step || !step.view || this.scene.fading || (step.done && step.done())) return false;
      if (this.game.visit) return !step.visit;
      return this.scene.view !== step.view;
    }
    // On a phone a sheet can cover the map. The coach then says how to close it.
    sheetInWay() {
      const step = this.step;
      const g = this.game;
      if (g.desktop() || !g.panelOpen || !step || !step.ring) return false;
      const aim = step.ring();
      return !!aim && !aim.el;
    }
    todoText() {
      const step = this.step;
      if (this.sheetInWay()) return 'Click Close to see the map.';
      if (this.astray()) return `Click the ${this.game.doorPlace().text} button.`;
      return step.todo ? step.todo() : null;
    }
    draw() {
      const step = this.step;
      if (!step) return;
      const todo = this.todoText();
      const key = JSON.stringify([this.i, todo]);
      if (key === this.stepKey) return;
      this.stepKey = key;
      const g = this.game;
      const said = todo ? (g.hasMouse ? todo : todo.replace(/^Click /, 'Tap ')) : null;
      const actions = [];
      if (step.action && !step.acted) actions.push(btn(step.action[0], () => { g.sound('tap'); step.action[1](); this.draw(); }, step.action[2] + ' small'));
      if (step.next) actions.push(btn(step.nextLabel || 'Next', () => this.next(), 'tomato small'));
      const percent = Math.round((this.i / this.steps.length) * 100);
      const parts = [
        el('div', { class: 'coachhead' }, img(WW.hamsterPose({ fur: 'golden', hat: 'toque', job: 'chef' }, 0), '', ''), el('b', null, step.title), el('button', { class: 'coachskip', type: 'button', on: { click: () => { this.game.count.once('lesson_left'); this.finishNow(); } } }, 'Skip practice')),
        el('div', { class: 'coachbar' }, el('i', { style: `width:${percent}%` })),
        el('p', null, step.body),
        said ? el('p', { class: 'coachtodo' }, said) : null,
        actions.length || step.skip ? el('div', { class: 'coachactions' }, step.skip ? el('button', { class: 'coachskip', type: 'button', on: { click: () => this.next() } }, 'Skip this step') : null, actions) : null,
      ];
      this.box.replaceChildren(...parts.filter(Boolean));
    }
    // Every quarter second: has the player done it yet.
    tick() {
      const step = this.step;
      if (!step) return;
      if (step.every) step.every();
      if (step.done && step.done()) return this.go(this.i + 1);
      this.draw();
    }
    // Every frame: the ring stays on its target, wherever the camera or the page has moved it.
    place() {
      const step = this.step;
      const g = this.game;
      if (!step || this.box.hidden) return;
      this.box.classList.toggle('top', !g.desktop() && g.panelOpen);
      let aim = null;
      if (step.done && step.done()) aim = null;
      else if (this.sheetInWay()) aim = { el: first('#closepanel') };
      else if (this.astray()) aim = { el: first('#btnDoor') };
      else if (step.ring) aim = step.ring();
      let box = null;
      if (aim && aim.el) {
        const r = aim.el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) box = r;
      } else if (aim && aim.view === this.scene.view && !this.scene.fading) {
        // Off screen targets are brought into view once. After that the player may drag the map freely.
        const key = this.i + ':' + aim.x + ',' + aim.y;
        if (this.lookedAt !== key) {
          this.lookedAt = key;
          this.scene.lookAt(aim);
          // On a small screen the coach can cover the lower part of the map. What he points at moves clear of him.
          if (!this.box.classList.contains('top')) {
            const over = this.scene.screenRect(aim);
            const coach = this.box.getBoundingClientRect();
            const across = over.left < coach.right && over.left + over.width > coach.left;
            const under = over.top + over.height + 8 - coach.top;
            if (across && under > 0) this.scene.panBy(0, -under);
          }
        }
        box = this.scene.screenRect(aim);
      }
      const hide = !box || document.getElementById('overlay').classList.contains('show');
      this.ring.hidden = hide;
      if (hide) return;
      // All of it stays on the page, even around something at the very edge.
      const pad = 4;
      const edge = 10;
      const left = Math.max(edge, box.left - pad);
      const top = Math.max(edge, box.top - pad);
      const right = Math.min(window.innerWidth - edge, box.left + box.width + pad);
      const bottom = Math.min(window.innerHeight - edge, box.top + box.height + pad);
      Object.assign(this.ring.style, { left: Math.round(left) + 'px', top: Math.round(top) + 'px', width: Math.round(right - left) + 'px', height: Math.round(bottom - top) + 'px' });
    }

    finishCard() {
      const g = this.game;
      this.box.hidden = true;
      this.ring.hidden = true;
      g.count.once('lesson_finished');
      g.showTicket(
        el('h2', null, 'That is the whole kitchen'),
        el('p', null, this.real ? 'Your own restaurant has been running with the real Squeektoshi all along.' : 'From now on everything follows the real Squeektoshi. He may be asleep when you open, and that is fine. Cook ahead, because food never spoils, and guests come when he runs.'),
        el('p', { class: 'note', style: 'margin-top:6px' }, 'How To Play has all of this in short.'),
        g.actions(btn(this.real ? 'Back to my restaurant' : 'Name my restaurant', () => this.finishNow(), 'tomato'))
      );
    }
    // The practice kitchen is thrown away here, and what was real comes back.
    finishNow() {
      const g = this.game;
      g.sound('tap');
      g.hideTip();
      this.steps = [];
      this.box.hidden = true;
      this.ring.hidden = true;
      document.body.classList.remove('practice');
      if (g.linegame.active) {
        g.linegame.active = false;
        g.linegame.root.classList.remove('show');
      }
      document.getElementById('overlay').classList.remove('show');
      document.getElementById('toasts').replaceChildren();
      g.practice = null;
      g.visit = null;
      g.queue = this.realQueue;
      g.scene.editing = null;
      g.scene.fading = null;
      g.scene.reset();
      this.resetCameras();
      g.ctaKey = null;
      g.dockKey = null;
      g.s = this.real;
      g.feed = this.realFeed;
      if (g.liveFeed && g.feed !== g.liveFeed) g.useLive(g.liveFeed);
      if (g.s) {
        g.s.soundOn = g.sfx.on;
        g.afterLoad();
        g.pumpQueue();
      } else {
        g.landing.show(true);
        g.showIntro();
      }
    }
  }

  WW.Practice = Practice;
})((globalThis.WW = globalThis.WW || {}));
