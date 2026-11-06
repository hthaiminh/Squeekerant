// The first thing anyone sees: the name, the woods with the road through them, and how to come in.
// While it is up the restaurant behind it stands still. Whatever the clock owes is worked out on the way in.
(function (WW) {
  const { el, btn, img } = WW;
  const E = () => WW.Engine;

  // A stand in for the game that only looks: a second camera on the same world, for the landing page.
  WW.standIn = (game, save) => ({
    visit: null,
    speed: 1,
    // Only ever looks. Nobody works in the restaurant from out here.
    still: true,
    hasMouse: true,
    get s() {
      return save();
    },
    get live() {
      return game.live;
    },
    get feed() {
      return game.feed;
    },
    isService: () => game.isService(),
    isAwake: () => game.isAwake(),
    sky: () => game.sky(),
    now: () => game.now(),
    desktop: () => game.desktop(),
    streetLots: () => [],
    nextTarget: () => null,
    boardWaiting: () => false,
    topRanks: () => game.topRanks(),
    ranksNote: () => game.ranksNote(),
    treeReady: () => false,
    sound() {},
    onNewSpecies() {},
  });

  class Landing {
    constructor(game) {
      this.game = game;
      this.root = document.getElementById('landing');
      this.logo = document.getElementById('landingLogo');
      this.card = document.getElementById('landingCard');
      this.status = document.getElementById('landingStatus');
      this.canvas = document.getElementById('landingArt');
      this.open = false;
      this.key = null;
      this.demo = null;
      this.statusKey = null;
      // The woods are drawn by the game's own scene. It looks at this stand in for the game: the same hamster,
      // the same season, and your own restaurant when you have one.
      this.stage = WW.standIn(game, () => game.s || this.demoSave());
      this.scene = null;
      window.addEventListener('resize', () => {
        if (this.open) this.fit();
      });
    }
    demoSave() {
      if (!this.demo) {
        this.demo = E().newGame(this.game.now(), this.game.feed, {});
        Object.assign(this.demo.exterior, WW.HOUSE_LOOKS[1]);
      }
      return this.demo;
    }
    // bare: only the woods and the name, as a backdrop for the first cards.
    show(bare) {
      this.open = true;
      this.key = null;
      this.statusKey = null;
      this.root.hidden = false;
      this.root.classList.toggle('bare', !!bare);
      document.body.classList.add('landing');
      if (!this.scene) {
        this.scene = new WW.Scene(this.canvas, this.stage);
        this.scene.view = 'out';
      }
      this.scene.reset();
      this.scene.roomKey = null;
      this.scene.walkersAt = null;
      // The right sky from the first frame.
      this.game.live = this.game.feed.live(this.game.now());
      this.scene.nightAmt = this.game.isAwake() ? 0 : 1;
      this.fit();
      this.draw();
      this.game.wallet.lookAround();
      this.game.wallet.refreshBoard();
      this.game.updateMusic();
    }
    hide() {
      this.open = false;
      this.root.hidden = true;
      document.body.classList.remove('landing');
    }
    // The whole height of the world fills the screen, with your door in the middle.
    fit() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const dpr = globalThis.devicePixelRatio || 1;
      const sc = this.scene;
      sc.setViewport(w, h, dpr);
      const cam = sc.cam;
      cam.user = true;
      cam.z = sc.zoomLimits().min;
      sc.applyZoom();
      cam.x = WW.OUTSIDE.DOOR.x - w / cam.z / 2;
      cam.y = 0;
      sc.clamp();
      // Whole pixels only, so the letters stay crisp.
      const logo = WW.logoCanvas();
      const k = Math.max(1, Math.floor(Math.min((w - 32) / logo.width, 900 / logo.width, (h * 0.2) / logo.height)));
      if (this.logo.width !== logo.width) {
        this.logo.width = logo.width;
        this.logo.height = logo.height;
        const x = this.logo.getContext('2d');
        x.imageSmoothingEnabled = false;
        x.drawImage(logo, 0, 0);
      }
      this.logo.style.width = logo.width * k + 'px';
      this.logo.style.height = logo.height * k + 'px';
    }
    frame(dt) {
      if (!this.scene) return;
      this.scene.update(dt);
      this.scene.draw();
    }
    tick() {
      this.drawStatus();
    }
    // What he is doing right now, only when that is what is really being read.
    drawStatus() {
      const g = this.game;
      const live = g.feed.mode === 'live';
      const state = live ? g.live.state : null;
      // Only changes when a round settles.
      const settled = live ? g.feed.settled(g.now()) : 0;
      const key = state + ':' + settled;
      if (key === this.statusKey) return;
      this.statusKey = key;
      const words = { running: 'Squeektoshi is running right now.', breather: 'Squeektoshi is catching his breath.', quiet: this.sleepWords(state === 'quiet' && g.feed.quietUpTo ? g.feed.quietUpTo(settled) : 0) }[state];
      const dots = { running: 'var(--leaf)', breather: 'var(--butter)', quiet: 'var(--lilac)' }[state];
      this.status.replaceChildren(...(words ? [el('span', { class: 'dot', style: `background:${dots}` }), el('span', null, words)] : []));
    }
    sleepWords(rounds) {
      const CFG = WW.CFG;
      if (rounds < CFG.NAP_ROUNDS) return 'Squeektoshi is resting right now.';
      const asleep = `Squeektoshi has been asleep for ${(rounds / 6).toFixed(1)} hours.`;
      if (rounds >= CFG.GOLD_ROUNDS) return `${asleep} A golden dream is on its way.`;
      return rounds >= CFG.DREAM_ROUNDS ? `${asleep} His dream is on its way.` : asleep;
    }
    // Comes back on every change of the wallet, so it only rebuilds when something shows differently.
    draw() {
      const g = this.game;
      const w = g.wallet;
      const key = JSON.stringify([w.connected() ? w.address : null, !!g.s]);
      if (key === this.key) return;
      this.key = key;
      const parts = [];
      if (w.connected()) {
        parts.push(
          el('div', { class: 'landingwallet' }, el('span', { class: 'note' }, 'Your wallet'), el('button', { class: 'addr tabnum', type: 'button', 'aria-label': 'Copy address', on: { click: () => g.copyText(w.address, 'Address copied.') } }, w.address)),
          btn(g.s ? 'Keep playing' : 'Play', () => this.enter(), 'tomato', false),
          btn('Disconnect', () => {
            g.sound('tap');
            w.disconnect();
            g.toast('Wallet disconnected. Your place on the board stays.');
          }, 'plain small')
        );
      } else {
        parts.push(
          el('button', { class: 'btn tomato', type: 'button', id: 'landingConnect', on: { click: () => this.connect() } }, img(WW.iconCanvas('wallet'), '', ''), 'Connect wallet'),
          btn(g.s ? 'Keep playing without a wallet' : 'Play without a wallet', () => this.enter(), 'plain'),
          el('p', { class: 'note' }, 'Only restaurants with a connected wallet are on the leaderboard. You only sign a message. It costs nothing and sends no transaction.')
        );
      }
      parts.push(el('p', { class: 'note' }, WW.updatesLink()));
      this.card.replaceChildren(...parts);
    }
    connect() {
      const g = this.game;
      g.sound('tap');
      g.wallet.lookAround();
      g.showWallet();
    }
    // A restaurant carries on. Without one the first cards come up over the woods, and the page goes when they are done.
    enter() {
      const g = this.game;
      g.sound('tap');
      if (g.s) {
        this.hide();
        return g.afterLanding();
      }
      this.root.classList.add('bare');
      g.count.once('play_pressed');
      g.showWelcome();
    }
  }

  WW.Landing = Landing;
})((globalThis.WW = globalThis.WW || {}));
