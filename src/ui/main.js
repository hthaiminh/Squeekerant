// Starts the game, runs the clock, keeps the save, handles the pointer, and shows the big moments.
(function (WW) {
  const { C, WORLD, el, img, btn, fmt, money } = WW;
  const E = WW.Engine;
  const SAVE_KEY = 'squeekerant-save-v2';
  const DRAG_PX = 6;
  const HOLD_MS = 420;
  const AWAKE_MS = 20 * 60000;
  // The official API says it is unavailable for a short while now and then, so the first tries come quickly.
  const RECONNECT_MS = [2000, 3000, 5000, 10000, 20000, 30000];
  const guestCount = (n) => `${n} guest${n === 1 ? '' : 's'}`;

  class Game {
    constructor() {
      this.feed = new WW.RecordingFeed(WW.RECORDING);
      this.wallet = new WW.Wallet();
      this.count = new WW.Counter();
      this.sfx = new WW.Sound();
      this.music = new WW.Music(this.sfx);
      this.s = null;
      this.visit = null;
      this.practice = null;
      this.live = { state: 'quiet', rpm: 0, cum: 0, agoMs: 1e9 };
      this.panelOpen = false;
      this.queue = [];
      this.speed = 1;
      this.dirty = false;
      this.tickN = 0;
      this.pointers = new Map();
      this.hasMouse = globalThis.matchMedia ? matchMedia('(hover: hover) and (pointer: fine)').matches : true;
    }

    now() {
      return this.feed.now();
    }
    isService() {
      return this.live.state === 'running' || this.live.state === 'breather';
    }
    // Day and night follow him: up on the wheel or just off it is day, asleep is night.
    isAwake() {
      return this.isService() || this.live.agoMs < AWAKE_MS;
    }
    // The season and weather of this round, the same for everyone on the street.
    sky() {
      const round = this.feed.roundAt(this.now());
      if (!this.skyNow || this.skyNow.round !== round) {
        const season = E.seasonOf(round);
        this.skyNow = { round, season: season.id, day: season.day, weather: E.weatherOf(round) };
      }
      return this.skyNow;
    }
    // The five houses standing on the street today.
    streetLots() {
      const key = E.dayKey(this.now()) + ':' + E.streetMovesLeft(this.s, this.now());
      if (this.lotsKey !== key) {
        this.lotsKey = key;
        this.lots = E.streetLots(this.s, this.now());
        this.emptyLots = WW.STREET.lots.filter((l) => !this.lots.some((o) => o.y === l.y && Math.abs(o.x - l.x) <= 12));
      }
      return this.lots;
    }
    // The top of the leaderboard board, with you on the last line if you are further down.
    topRanks() {
      const key = this.tickN >> 3;
      if (this.ranksKey !== key || !this.ranksNow) {
        this.ranksKey = key;
        const w = this.wallet;
        w.refreshBoard();
        const rows = w.rows();
        // The little sign font only has plain letters. A name it cannot write at all shows the start of the wallet.
        const short = (r) => {
          const plain = String(r.shop).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\u0110\u0111]/g, 'D').toUpperCase();
          return { place: r.place, name: (/[A-Z0-9]/.test(plain) ? plain : String(r.wallet).toUpperCase()).slice(0, 15).trim(), level: r.level, me: r.me };
        };
        const top = rows.slice(0, 5).map(short);
        const mine = rows.findIndex((r) => r.me);
        if (mine >= 5) top[4] = short(rows[mine]);
        this.ranksNow = top;
        const standing = w.standing();
        this.rankOfMe = standing ? standing.place : 0;
        this.rankCount = standing ? standing.total : w.board ? w.board.total : 0;
      }
      return this.ranksNow;
    }
    // What the board outside says when it has no names to show.
    ranksNote() {
      const w = this.wallet;
      if (!w.usable) return ['SEE THE BOARD', 'ON THE REAL SITE'];
      if (!w.board) return w.boardFailed ? ['CANNOT REACH', 'THE BOARD'] : ['READING...'];
      if (!w.board.open) return ['OPENING SOON'];
      return ['NOBODY YET', 'CONNECT A WALLET', 'TO BE THE FIRST'];
    }
    copyText(text, done) {
      const fail = () => this.toast('Could not copy that here.', 'bad');
      if (!navigator.clipboard) return fail();
      navigator.clipboard.writeText(text).then(() => this.toast(done, 'good'), fail);
    }
    // The wallet button and everything showing the board follow the wallet.
    walletChanged() {
      const w = this.wallet;
      const button = document.getElementById('btnWallet');
      const text = document.getElementById('walletText');
      if (w.expired) {
        w.expired = false;
        this.toast('Your wallet sign in ended. Connect again to keep your place up to date.', 'bad');
      }
      button.classList.toggle('on', w.connected());
      // Short here because of the space. The full address is one click away.
      text.textContent = w.connected() ? `${w.address.slice(0, 6)}...${w.address.slice(-4)}` : WW.tr('Connect wallet');
      this.ranksNow = null;
      this.dockKey = null;
      if (this.s && this.panels && this.panels.tab === 'street' && this.panels.streetView() === 'board') this.panels.render();
      if (this.walletTicket) this.showWallet();
      if (this.landing && this.landing.open) this.landing.draw();
    }
    closeWallet() {
      this.walletWait = null;
      this.wallet.cancel();
      this.closeOverlay();
    }
    // Everything about the wallet happens on one card.
    showWallet() {
      const w = this.wallet;
      const close = () => this.closeWallet();
      if (!w.usable) {
        this.walletTicket = 'info';
        return this.showTicket(el('h2', null, 'Connect a wallet'), el('p', null, 'The leaderboard and wallets work on the real site, www.squeekerant.online. This preview cannot reach them.'), this.actions(btn('Close', close, 'plain')));
      }
      w.refreshBoard();
      if (w.board && !w.board.open) {
        this.walletTicket = 'info';
        return this.showTicket(el('h2', null, 'Connect a wallet'), el('p', null, 'The leaderboard is not open yet. Wallets can connect as soon as it is.'), this.actions(btn('Close', close, 'plain')));
      }
      if (w.connected()) {
        this.walletTicket = 'mine';
        const standing = w.standing();
        const copy = () => this.copyText(w.address, 'Address copied.');
        return this.showTicket(
          el('h2', null, 'Your wallet'),
          el('button', { class: 'addr tabnum', type: 'button', tip: { title: 'Copy address', lines: [] }, on: { click: copy } }, w.address),
          el('p', null, standing ? `You are #${fmt(standing.place)} of ${fmt(standing.total)} on the leaderboard.` : 'Your restaurant joins the leaderboard as soon as it is on the real wheel.'),
          this.actions(
            btn('Copy address', copy, 'plain'),
            btn('Disconnect', () => {
              w.disconnect();
              close();
              this.toast('Wallet disconnected. Your place on the board stays.');
              this.landing.show();
            }, 'plain'),
            btn('Close', close, 'tomato')
          )
        );
      }
      this.walletTicket = 'list';
      this.count.once('connect_pressed');
      const list = w.list();
      if (!list.length) {
        const here = encodeURIComponent(location.href);
        const phone = !this.hasMouse;
        return this.showTicket(
          el('h2', null, 'Connect a wallet'),
          el('p', null, 'No wallet found in this browser.'),
          el('p', { class: 'note' }, phone ? "On a phone, open this page in your wallet app's browser." : 'Install a browser wallet such as MetaMask or Rabby, then reload this page.'),
          el(
            'div',
            { class: 'wallethelp' },
            phone
              ? [el('a', { class: 'btn small', href: `https://metamask.app.link/dapp/${location.host}${location.pathname}`, rel: 'noopener noreferrer' }, 'Open in MetaMask'), el('a', { class: 'btn small', href: `https://link.trustwallet.com/open_url?coin_id=60&url=${here}`, rel: 'noopener noreferrer' }, 'Open in Trust Wallet')]
              : [el('a', { class: 'btn small', href: 'https://metamask.io/download/', target: '_blank', rel: 'noopener noreferrer' }, 'MetaMask'), el('a', { class: 'btn small', href: 'https://rabby.io/', target: '_blank', rel: 'noopener noreferrer' }, 'Rabby')]
          ),
          this.actions(btn('Close', close, 'plain'))
        );
      }
      const pick = async (entry, i) => {
        this.walletWait = i;
        this.showWallet();
        try {
          const done = await w.connect(entry);
          if (!done) return;
          this.walletWait = null;
          this.walletTicket = null;
          this.count.once('wallet_connected');
          this.closeOverlay();
          this.toast(this.s && this.feed.mode === 'live' ? 'Wallet connected. Your restaurant is on the leaderboard.' : 'Wallet connected. Your restaurant joins the leaderboard as soon as it is on the real wheel.', 'good');
          this.walletChanged();
          if (this.landing.open) this.landing.enter();
        } catch (e) {
          this.walletWait = null;
          if (this.walletTicket === 'list') this.showWallet();
          this.toast(e && e.code === 4001 ? 'Cancelled in your wallet.' : e && e.code === -32002 ? 'Your wallet already has a request waiting. Open it to answer.' : (e && e.message) || 'That wallet could not sign in.', 'bad');
        }
      };
      this.showTicket(
        el('h2', null, 'Connect a wallet'),
        el('p', null, 'Only restaurants with a connected wallet are on the leaderboard.'),
        el(
          'div',
          { class: 'walletlist' },
          list.map((entry, i) => {
            const name = String(entry.info.name || 'Wallet');
            const icon = /^data:image\/(svg\+xml|png|webp|jpeg|gif)[;,]/i.test(entry.info.icon || '');
            return el('button', { class: 'walletrow', type: 'button', on: { click: () => pick(entry, i) } }, icon ? el('img', { src: entry.info.icon, alt: '' }) : el('span', { class: 'walletmark' }, name[0]), el('span', null, el('b', null, name), el('small', null, this.walletWait === i ? 'Check your wallet...' : 'Installed')));
          })
        ),
        el('p', { class: 'note' }, 'You only sign a message. It costs nothing and sends no transaction.'),
        this.actions(btn('Close', close, 'plain'))
      );
    }
    streetMovesText() {
      return `${E.streetMovesLeft(this.s, this.now())} LEFT`;
    }
    sound(name) {
      this.sfx.play(name);
    }
    // One tune for each place, and silence while the tab is away, on the Line, or with sound off.
    updateMusic() {
      if (!this.music) return;
      const quiet = !this.s || !this.sfx.on || document.hidden || (this.linegame && this.linegame.active) || (this.landing && this.landing.open);
      this.music.play(quiet ? null : this.scene.view);
    }
    desktop() {
      return window.innerWidth > 860;
    }

    // Boot

    async boot(data) {
      this.buildShell();
      this.scene = new WW.Scene(document.getElementById('world'), this);
      this.panels = new WW.Panels(this);
      this.linegame = new WW.Line(this);
      this.landing = new WW.Landing(this);
      this.share = new WW.Share(this);
      this.alerts = new WW.Alerts(this);
      window.addEventListener('resize', () => this.fit());
      this.fit();

      this.landing.show();
      const saved = (data && data.save) || this.loadLocal();
      if (saved) this.useSave(saved);
      if (!this.s) this.count.once('first_visit');
      // Opened from a wake up alert. The address goes back to plain, so a reload or a shared link does not count it again.
      if (/[?&]from=alert(&|$)/.test(location.search)) {
        this.count.daily('alert_opened');
        try {
          history.replaceState(null, '', location.pathname);
        } catch (e) {}
      }
      this.watchTabs();
      this.landing.draw();
      this.connectLive();
      this.connectCloud();
      this.last = performance.now();
      requestAnimationFrame((t) => this.frame(t));
      setInterval(() => this.tick(), 250);
      setInterval(() => this.autosave(), 20000);
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) this.autosave(true);
      });
      window.addEventListener('pagehide', () => this.autosave(true));
      if (window.claude && window.claude.hot && window.claude.hot.snapshot) {
        try {
          window.claude.hot.snapshot(() => ({ save: this.s }));
        } catch (e) {}
      }
      const unlock = () => {
        this.sfx.unlock();
        this.updateMusic();
      };
      window.addEventListener('pointerdown', unlock);
      window.addEventListener('keydown', unlock);
      this.wireTips();
      this.watchInstall();
    }

    // Installing the game as an app: the browser's own prompt where it has one, the steps on an iPhone or iPad.
    // The service worker only lets the page open with no network. The real site only, never the Artifact preview.
    watchInstall() {
      if (window.claude || !document.querySelector('link[rel="manifest"]')) return;
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
        // A wake up alert tapped while the game was already open brings this tab forward.
        navigator.serviceWorker.addEventListener('message', (e) => {
          if (e.data && e.data.kind === 'alert-opened') this.count.daily('alert_opened');
        });
      }
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        this.installPrompt = e;
        this.installChanged();
      });
      window.addEventListener('appinstalled', () => {
        this.installPrompt = null;
        this.count.once('installed');
        this.installChanged();
      });
    }
    installedApp() {
      return (globalThis.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
    }
    appleDevice() {
      return /iPad|iPhone|iPod/.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }
    canInstall() {
      return !window.claude && !!document.querySelector('link[rel="manifest"]') && !this.installedApp() && (!!this.installPrompt || this.appleDevice());
    }
    installChanged() {
      if (this.landing && this.landing.open) this.landing.draw();
      if (this.panels && this.panels.tab === 'howto' && this.panelVisible()) this.panels.render();
    }
    // Alerts turned on or off, or found on at the start: the same places show it.
    alertsChanged() {
      this.installChanged();
    }
    // why: 'alerts' when the steps are shown because alerts on an iPhone or iPad need the game on the home screen.
    async install(why) {
      this.sound('tap');
      this.count.once('install_pressed');
      if (this.installPrompt && why !== 'alerts') {
        const prompt = this.installPrompt;
        this.installPrompt = null;
        try {
          await prompt.prompt();
          await prompt.userChoice;
        } catch (e) {}
        return this.installChanged();
      }
      this.showTicket(
        el('h2', null, 'Add it to your home screen'),
        why === 'alerts' ? el('p', null, 'On an iPhone or iPad, alerts only work for the game on your home screen.') : null,
        el('p', null, 'Tap the Share button of your browser, then Add to Home Screen.'),
        el('p', { class: 'note', style: 'margin-top:6px' }, why === 'alerts' ? 'Then open Squeekerant from its icon and turn the alerts on there.' : 'Squeekerant then opens from its own icon, like an app.'),
        this.actions(btn('Got it', () => this.closeOverlay(), 'tomato'))
      );
    }

    // One tab plays at a time. A newly opened tab takes over and an older one stops, so it can never save an older restaurant over a newer one.
    watchTabs() {
      if (typeof BroadcastChannel !== 'function') return;
      let channel;
      try {
        channel = new BroadcastChannel('squeekerant-tabs');
      } catch (e) {
        return;
      }
      const me = Math.random().toString(36).slice(2);
      const announce = () => channel.postMessage({ kind: 'here', id: me });
      channel.onmessage = (e) => {
        const m = e.data;
        if (!m || m.kind !== 'here' || m.id === me || this.elsewhere) return;
        this.elsewhere = true;
        if (this.music) this.music.play(null);
        this.showTicket(el('h2', null, 'Open in another tab'), el('p', null, 'Squeekerant is playing in another tab now. This one has stopped, so the two can never save over each other.'), this.actions(btn('Play here', () => location.reload(), 'tomato')));
      };
      // Back from the browser's history, a page may have missed a newer tab. If that one saved since, this one starts again from its save.
      window.addEventListener('pageshow', (e) => {
        if (!e.persisted || this.elsewhere) return;
        const stored = this.loadLocal();
        if (stored && this.s && stored.savedAt > (this.s.savedAt || 0)) return location.reload();
        announce();
      });
      announce();
    }

    useSave(save) {
      const migrated = E.migrate(save);
      // A save from a version too old to carry forward counts as no save.
      if (migrated.v !== 6) return;
      this.s = migrated;
      // A save on the real wheel waits for it. The recording must never be counted into it.
      if (migrated.feedMode === 'live' && !window.claude) this.feed = this.liveFeed && migrated.wheelCore === this.liveFeed.core ? this.liveFeed : new WW.HeldFeed(WW.RECORDING, migrated.clock);
      else if (this.feed.mode !== 'recording') this.feed = new WW.RecordingFeed(WW.RECORDING);
      this.feed.offset = migrated.clockOffset || 0;
      this.sfx.on = migrated.soundOn !== false;
      this.refreshSoundIcon();
      this.afterLoad();
      // Already connected, and this save is from a replay or another wheel, as one brought by a save code can be: it moves across now.
      if (this.liveFeed && this.feed !== this.liveFeed && !this.practice) this.useLive(this.liveFeed);
    }

    // Save codes: the whole restaurant as one line of text, to take it to another device by hand.
    async showSaveCode() {
      if (!this.s || this.practice) return;
      this.sound('tap');
      this.autosave(true);
      let code;
      try {
        code = await WW.SaveCode.make(this.s);
      } catch (e) {
        return this.toast('A save code could not be made here.', 'bad');
      }
      this.count.once('save_code_made');
      const box = el('textarea', { class: 'savecode', readonly: true, rows: 5, 'aria-label': 'Your save code', spellcheck: 'false' });
      box.value = code;
      box.addEventListener('focus', () => box.select());
      const copy = () => {
        box.select();
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(() => this.toast('Save code copied.', 'good'), () => this.toast('Could not copy it here. Select the code and copy it yourself.', 'bad'));
        else this.toast('Select the code and copy it yourself.', 'bad');
      };
      this.showTicket(
        el('h2', null, 'Your save code'),
        el('p', null, 'Your restaurant lives in this browser. This code is all of it as it is now. Keep it somewhere safe, or open it on another device with Load a save code.'),
        box,
        el('p', { class: 'note', style: 'margin-top:6px' }, 'Anyone with the code can open a copy of your restaurant. Your place on the leaderboard stays with your wallet.'),
        this.actions(btn('Close', () => this.closeOverlay(), 'plain'), btn('Copy code', copy, 'tomato'))
      );
    }
    showLoadCode() {
      if (this.practice) return;
      this.sound('tap');
      const box = el('textarea', { class: 'savecode', rows: 5, 'aria-label': 'Save code', spellcheck: 'false', placeholder: 'SQK...' });
      const said = el('p', { class: 'note', style: 'margin-top:6px;color:var(--brick)' });
      const back = () => (this.s ? this.closeOverlay() : this.showWelcome());
      const load = async () => {
        let save;
        try {
          save = await WW.SaveCode.read(box.value);
        } catch (e) {
          said.textContent = WW.tr(e instanceof WW.SaveCode.CodeError ? e.message : 'That is not a Squeekerant save code.');
          return;
        }
        if (E.migrate(JSON.parse(JSON.stringify(save))).v !== 6) {
          said.textContent = WW.tr('That save is from a version too old to open.');
          return;
        }
        if (!this.s) return this.useCode(save);
        this.showTicket(
          el('h2', null, 'Replace your restaurant?'),
          el('p', null, `${this.s.shop}, level ${this.s.level}, is replaced on this device by ${save.shop}, level ${save.level}.`),
          this.actions(btn('Keep mine', () => this.closeOverlay(), 'plain'), btn('Replace', () => this.useCode(save), 'tomato'))
        );
      };
      this.showTicket(
        el('h2', null, 'Load a save code'),
        el('p', null, this.s ? 'Paste a code made with Make a save code. It replaces the restaurant on this device.' : 'Paste a code made with Make a save code, and your restaurant opens here.'),
        box,
        said,
        this.actions(btn(this.s ? 'Cancel' : 'Back', back, 'plain'), btn('Open it', load, 'tomato'))
      );
      setTimeout(() => box.focus(), 50);
    }
    useCode(save) {
      this.visit = null;
      this.queue = [];
      document.getElementById('overlay').classList.remove('show');
      if (this.landing.open) this.landing.hide();
      this.useSave(save);
      this.dirty = true;
      this.autosave(true);
      this.count.once('save_code_loaded');
      this.noteVisit();
      this.toast(`${this.s.shop} is open on this device.`, 'good');
      this.pumpQueue();
    }

    afterLoad() {
      const s = this.s;
      const t = this.now();
      this.live = this.feed.live(t);
      // "While you were away" only if a round has passed. A plain reload has nothing to report.
      if (E.advance(s, this.feed, t)) this.handleReport(E.takeReport(s), true);
      this.scene.reset();
      this.scene.fading = null;
      this.scene.editing = null;
      this.scene.view = 'in';
      this.lotsKey = null;
      this.missed = [];
      this.fit();
      this.panels.open(this.desktop() ? 'kitchen' : this.panels.tab);
      if (!this.desktop()) this.setPanelOpen(false);
      this.updateHud();
      if (E.checkPrep(s).length) this.dirty = true;
    }

    buildShell() {
      const tabs = [
        ['kitchen', 'Kitchen', 'kitchen', 'Your stations, the counter, your bag and last night\'s dream.'],
        ['recipes', 'Recipes', 'book', 'Your dishes, upgrades and the Test Kitchen.'],
        ['staff', 'Staff', 'staff', 'Your hamster, sous chefs, waiters and cleaners.'],
        ['guests', 'Guests', 'paw', 'Every tiny animal you have met, and the ones you haven\'t.'],
        ['diary', 'Diary', 'diary', 'Prep list, the critic, trophies and dreams.'],
        ['howto', 'How To Play', 'help', 'How everything works in short, and the practice kitchen again.'],
      ];
      const nav = document.getElementById('tabs');
      nav.replaceChildren(...tabs.map(([id, label, ic, tip]) => el('button', { class: 'tab', type: 'button', 'data-tab': id, tip: { title: label, lines: [tip] }, on: { click: () => this.tabClick(id) } }, img(WW.iconCanvas(ic), '', ''), label)));
      document.getElementById('hudCashIcon').src = WW.iconCanvas('cash').toDataURL();
      document.getElementById('hudWinkIcon').src = WW.iconCanvas('wink').toDataURL();
      document.getElementById('houseIcon').src = WW.iconCanvas('expand').toDataURL();
      document.getElementById('arrangeIcon').src = WW.iconCanvas('arrange').toDataURL();
      document.getElementById('shareIcon').src = WW.iconCanvas('camera').toDataURL();
      document.getElementById('btnShare').addEventListener('click', () => this.share.open());
      document.getElementById('btnDoor').addEventListener('click', () => this.doorButton());
      document.getElementById('btnArrange').addEventListener('click', () => {
        this.sound('tap');
        this.toggleArrange();
      });
      this.refreshSoundIcon();
      document.getElementById('walletIcon').src = WW.iconCanvas('wallet').toDataURL();
      document.getElementById('btnWallet').addEventListener('click', () => {
        this.sound('tap');
        this.wallet.lookAround();
        this.showWallet();
      });
      this.wallet.onChange = () => this.walletChanged();
      this.walletChanged();
      document.getElementById('btnSound').addEventListener('click', () => {
        this.sfx.on = !this.sfx.on;
        if (this.s) this.s.soundOn = this.sfx.on;
        this.refreshSoundIcon();
        this.sound('tap');
        this.updateMusic();
      });
      document.getElementById('ribbon').addEventListener('click', () => this.panels.open('wheel'));
      document.getElementById('houseinfo').addEventListener('click', () => this.panels.open(this.visit ? 'street' : 'decor', this.visit ? { view: 'here' } : undefined));
      const tipOf = (id, data) => {
        const n = document.getElementById(id);
        n._tip = data;
        n.setAttribute('data-tip', '');
      };
      tipOf('statCash', () => ({ icon: WW.iconCanvas('cash'), title: 'Cash', lines: ['What tiny animals pay with. Game money only, no real value.', this.s && this.s.till ? `${fmt(this.s.till)} more is in the till and reaches you when this round settles.` : 'Guests pay into the till, which is banked each time a round settles.'] }));
      tipOf('statWink', () => ({ icon: WW.iconCanvas('wink'), title: 'Winks', lines: ['You earn one for every round he isn\'t running.', 'Spend them in the Test Kitchen, on hints and on Dream Dishes.', `Holds up to ${WW.CFG.WINK_BANK}.`] }));
      tipOf('statLevel', () => (this.s ? { title: `Restaurant level ${this.s.level}`, lines: [`${fmt(this.s.xp)} of ${fmt(E.xpNeed(this.s.level))} toward the next level.`, 'Guests, orders and upgrades all count.'] } : null));
      tipOf('btnSound', { title: 'Music and sound', lines: ['Turn music and sound on or off.'] });
      tipOf('btnWallet', () => ({ icon: WW.iconCanvas('wallet'), title: 'Wallet', lines: this.wallet.connected() ? [this.wallet.address, 'Click for your place on the leaderboard.'] : ['Connect a wallet to put your restaurant on the leaderboard.', 'You only sign a message. It costs nothing and sends no transaction.'] }));
      tipOf('ribbon', () => ({ title: 'The Wheel', lines: [this.feed.mode === 'practice' ? 'A pretend hamster for the practice kitchen. Nothing here counts.' : this.feed.mode === 'recording' ? 'A replay of his real rounds, because the real wheel cannot be reached right now.' : 'What he is doing right now. Click for the numbers.', ...(this.s && this.live.state === 'quiet' ? [this.dreamNote()] : [])] }));
      tipOf('houseinfo', () => this.houseTip());
      tipOf('skybadge', () => this.skyTip());
      tipOf('btnDoor', () => this.doorTip());
      tipOf('btnShare', () => ({ icon: WW.iconCanvas('camera'), title: 'Share your restaurant', lines: ['A picture of your restaurant, ready to post or send.'] }));
      tipOf('btnArrange', () => ({ icon: WW.iconCanvas('arrange'), title: 'Arrange', lines: [this.scene.editing ? 'Click to finish.' : 'Move things around, or place something from your bag. Your furniture opens in the Kitchen.'] }));
      const world = document.getElementById('world');
      world.addEventListener('pointerdown', (e) => this.onDown(e));
      world.addEventListener('pointermove', (e) => this.onMove(e));
      world.addEventListener('pointerup', (e) => this.onUp(e));
      world.addEventListener('pointercancel', (e) => this.onUp(e, true));
      world.addEventListener('pointerleave', () => this.onLeave());
      world.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
      document.getElementById('zoomIn').addEventListener('click', () => this.zoomButton(1.25));
      document.getElementById('zoomOut').addEventListener('click', () => this.zoomButton(0.8));
      document.getElementById('zoomFit').addEventListener('click', () => this.scene.zoomFit());
      tipOf('zoomIn', { title: 'Zoom in', lines: ['Or use the mouse wheel, or pinch on a phone.'] });
      tipOf('zoomOut', { title: 'Zoom out', lines: ['Drag the map to look around.'] });
      tipOf('zoomFit', { title: 'Show everything', lines: [] });
    }

    refreshSoundIcon() {
      const n = document.getElementById('hudSound');
      if (n) n.src = WW.iconCanvas(this.sfx.on ? 'sound' : 'mute').toDataURL();
    }

    tabClick(id) {
      if (!this.s) return;
      this.sound('tap');
      if (!this.desktop() && this.panelOpen && this.panels.tab === id) return this.setPanelOpen(false);
      this.panels.open(id);
    }
    setPanelOpen(open) {
      this.panelOpen = open;
      document.getElementById('panel').classList.toggle('open', open);
      document.getElementById('dock').style.display = open ? 'none' : '';
      document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', (open || this.desktop()) && t.dataset.tab === this.panels.tab));
      this.fit();
      if (this.s) this.updateDock();
    }

    // The canvas fills its space; the camera decides how much of the room shows.
    fit() {
      const stage = document.getElementById('stage');
      const view = document.getElementById('viewport');
      const dpr = globalThis.devicePixelRatio || 1;
      const phone = !this.desktop();
      const rect = stage.getBoundingClientRect();
      const ribbonH = (document.getElementById('ribbon').offsetHeight || 26) + (document.getElementById('houseinfo').offsetHeight || 22);
      const w = Math.floor(rect.width - (phone ? 0 : 16));
      let h;
      if (phone) h = this.panelOpen ? Math.floor(window.innerHeight * 0.36) - ribbonH : Math.floor(Math.min(window.innerWidth * 1.17, window.innerHeight * 0.6));
      else h = Math.floor(rect.height - ribbonH - 16);
      view.style.width = w + 'px';
      view.style.height = h + 'px';
      document.getElementById('world').style.width = w + 'px';
      document.getElementById('world').style.height = h + 'px';
      if (this.scene) this.scene.setViewport(w, h, dpr);
      const dock = document.getElementById('dock');
      const cta = document.getElementById('cta');
      const home = phone ? stage : view;
      if (cta.parentElement !== home) {
        if (phone) stage.insertBefore(cta, dock);
        else view.append(cta);
      }
    }

    // Pointer: drag moves the map, or a piece of furniture while arranging. A short press is a tap.

    localPoint(e) {
      const r = document.getElementById('world').getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    onDown(e) {
      if (!this.s) return;
      e.preventDefault();
      const world = document.getElementById('world');
      try {
        world.setPointerCapture(e.pointerId);
      } catch (err) {}
      const p = this.localPoint(e);
      this.pointers.set(e.pointerId, { x: p.x, y: p.y, sx: p.x, sy: p.y, moved: false, type: e.pointerType });
      this.hideTip();
      if (e.pointerType !== 'mouse') this.hasMouse = false;
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) };
        clearTimeout(this.holdTimer);
        return;
      }
      // Arranging: pressing on a piece picks it up, ready to drag.
      const ed = this.scene.editing;
      this.dragPiece = null;
      if (ed && !(ed.ghost && ed.ghost.fromBag)) {
        const w = this.scene.toWorld(p.x, p.y);
        const hit = this.scene.hit(w.x, w.y);
        if (hit.kind === 'tile' && hit.item) {
          ed.selected = hit.item;
          ed.ghost = { id: hit.item.id, x: hit.item.x, y: hit.item.y, bad: false };
          const def = WW.DECOR_BY_ID[hit.item.id];
          this.dragPiece = { def, offX: hit.col - hit.item.x, offY: hit.row - hit.item.y };
          this.sound('tap');
          this.updateCta();
          if (this.panelVisible()) this.panels.render();
        }
      }
      // A long press on a touch screen shows details.
      if (e.pointerType !== 'mouse') {
        clearTimeout(this.holdTimer);
        this.holdTimer = setTimeout(() => {
          const ptr = this.pointers.get(e.pointerId);
          if (!ptr || ptr.moved) return;
          ptr.held = true;
          const w = this.scene.toWorld(ptr.x, ptr.y);
          const data = this.describeHit(this.scene.hit(w.x, w.y));
          if (data) this.showTip(data, e.clientX, e.clientY);
        }, HOLD_MS);
      }
    }

    onMove(e) {
      if (!this.s) return;
      const p = this.localPoint(e);
      const ptr = this.pointers.get(e.pointerId);
      if (!ptr) {
        if (e.pointerType === 'mouse') this.hoverAt(p, e);
        return;
      }
      const dx = p.x - ptr.x;
      const dy = p.y - ptr.y;
      ptr.x = p.x;
      ptr.y = p.y;
      if (!ptr.moved && Math.hypot(p.x - ptr.sx, p.y - ptr.sy) > DRAG_PX) {
        ptr.moved = true;
        clearTimeout(this.holdTimer);
        this.hideTip();
      }
      if (this.pointers.size === 2 && this.pinch) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinch.d > 0) this.scene.zoomAt(d / this.pinch.d, (a.x + b.x) / 2, (a.y + b.y) / 2);
        this.pinch.d = d;
        return;
      }
      if (!ptr.moved) return;
      if (this.dragPiece) {
        const w = this.scene.toWorld(p.x, p.y);
        const ed = this.scene.editing;
        const tile = this.scene.tileAt(w.x, w.y);
        const col = tile.col - this.dragPiece.offX;
        const row = tile.row - this.dragPiece.offY;
        ed.ghost.x = col;
        ed.ghost.y = row;
        ed.ghost.bad = !!E.canPlace(this.s, ed.ghost.id, col, row, ed.selected);
        return;
      }
      this.scene.panBy(dx, dy);
      document.getElementById('world').style.cursor = 'grabbing';
    }

    onUp(e, cancelled) {
      const ptr = this.pointers.get(e.pointerId);
      this.pointers.delete(e.pointerId);
      clearTimeout(this.holdTimer);
      if (this.pointers.size < 2) this.pinch = null;
      if (!ptr || cancelled || !this.s) return;
      if (ptr.held) {
        this.hideTip();
        return;
      }
      if (this.dragPiece) {
        const ed = this.scene.editing;
        this.dragPiece = null;
        if (ptr.moved && ed && ed.selected) {
          const err = E.moveDecor(this.s, ed.selected, ed.ghost.x, ed.ghost.y);
          if (err) this.toast(err, 'bad');
          else {
            this.sound('plate');
            this.seatsChanged();
            this.afterAction();
          }
          ed.selected = null;
          ed.ghost = null;
          this.updateCta();
          if (this.panelVisible()) this.panels.render();
        }
        return;
      }
      if (!ptr.moved) this.worldTap(ptr.x, ptr.y);
    }

    onLeave() {
      if (this.scene) this.scene.hover = null;
      this.hideTip();
    }

    onWheel(e) {
      if (!this.s) return;
      e.preventDefault();
      const p = this.localPoint(e);
      this.scene.zoomAt(e.deltaY < 0 ? 1.12 : 0.89, p.x, p.y);
    }

    zoomButton(f) {
      const c = this.scene.css;
      this.scene.zoomAt(f, c.w / 2, c.h / 2);
    }

    // Mouse hover: highlight, a pointer that says what a click does, and the details box.
    hoverAt(p, e) {
      const w = this.scene.toWorld(p.x, p.y);
      const hit = this.scene.hit(w.x, w.y);
      this.scene.hover = hit.rect ? hit : null;
      const ed = this.scene.editing;
      if (ed && ed.ghost && ed.ghost.fromBag && hit.kind === 'tile') {
        ed.ghost.x = hit.col;
        ed.ghost.y = hit.row;
        ed.ghost.bad = !!E.canPlace(this.s, ed.ghost.id, hit.col, hit.row);
      }
      document.getElementById('world').style.cursor = this.cursorFor(hit);
      const data = this.describeHit(hit);
      if (data) this.showTip(data, e.clientX, e.clientY);
      else this.hideTip();
    }

    cursorFor(hit) {
      const by = { ranks: 'trophy', nextstreet: 'street', mailbox: 'mail', shelf: 'basket', dirt: 'broom', tree: 'shake', ntree: 'shake', market: 'basket', shop: 'chair', board: 'orders', door: 'door', home: 'door', house: 'door', gate: 'street', homegate: 'street', station: 'pan', lockedStation: 'expand', dish: 'plate', counter: 'plate', staff: 'hand', guest: 'magnify', walker: 'magnify', wheel: 'wheel', furniture: 'magnify', yarditem: 'magnify' };
      if (hit.kind === 'tile') {
        const ghost = this.scene.editing && this.scene.editing.ghost;
        // With a piece from the bag in hand, a click places it rather than grabbing what is underneath.
        return WW.cursorFor(hit.item && !(ghost && ghost.fromBag) ? 'grab' : ghost ? 'move' : 'hand');
      }
      if (hit.kind === 'floor' || hit.kind === 'none') return 'grab';
      return WW.cursorFor(by[hit.kind] || 'pointer');
    }

    // The words for whatever the pointer is on.
    describeHit(hit) {
      const s = this.s;
      const home = this.scene.st;
      const visiting = !!this.visit;
      const T = WW.tips;
      switch (hit.kind) {
        case 'mailbox': {
          const n = E.mailCount(s);
          return { icon: WW.iconCanvas('mail'), title: 'Your mailbox', lines: [n ? `${n} waiting. Click to read.` : 'Empty. Click to open.'] };
        }
        case 'shelf':
          return { icon: WW.iconCanvas('basket'), title: 'Your trade shelf', lines: [`${s.shelf.length} of ${E.shelfSlots(s)} spots in use.`, 'Click to hang up ingredients for neighbours.'] };
        case 'dirt':
          return { icon: WW.iconCanvas('broom'), title: visiting ? 'A dirty spot on their floor' : 'A dirty spot', lines: visiting ? [`Click to clean it for ${fmt(E.spotReward(s))} cash.`] : ['Click to clean it: +2 tidiness, +1 cash.', 'Tidy floors keep tips up.'] };
        case 'tree': {
          const left = 3 - (s.tree.day === E.dayKey(this.now()) ? s.tree.shakes : 0);
          return { icon: WW.iconCanvas('shake'), title: 'The tree outside', lines: [left ? `Click to shake it. ${left} shake${left > 1 ? 's' : ''} left today.` : 'Bare until tomorrow.'] };
        }
        case 'ntree': {
          const v = E.neighbourDay(s, hit.id, this.now());
          return { icon: WW.iconCanvas('shake'), title: `${WW.NEIGHBOUR[hit.id].n}'s tree`, lines: [v.shook ? 'You already shook it today.' : 'Click to shake it. Something usually falls out.'] };
        }
        case 'market':
          return { icon: WW.iconCanvas('basket'), title: 'The market', lines: ['Click to buy ingredients. Goods change every day.'] };
        case 'shop':
          return { icon: WW.iconCanvas('chair'), title: 'The decor shop', lines: ['Click for yard pieces, furniture, walls and a new look for your building.'] };
        case 'board':
          return { icon: WW.iconCanvas('orders'), title: 'The notice board', lines: ['Click for party orders and the daily question.'] };
        case 'ranks': {
          this.topRanks();
          return { icon: WW.iconCanvas('trophy'), title: 'Leaderboard', lines: [this.rankOfMe ? `You are #${this.rankOfMe} of ${this.rankCount}.` : 'Only restaurants with a connected wallet are listed.', 'Click to see everyone.'] };
        }
        case 'gate':
          return { icon: WW.iconCanvas('street'), title: 'Skirting Street', lines: ['Click to walk over to your neighbours.'] };
        case 'nextstreet': {
          const left = E.streetMovesLeft(s, this.now());
          return { icon: WW.iconCanvas('street'), title: 'Another street', lines: [left ? 'Click to walk to another street, with five other houses.' : 'No more streets today. You can move again tomorrow.', `${left} of ${WW.STREET.MOVES} moves left today.`] };
        }
        case 'homegate':
          return { icon: WW.iconCanvas('street'), title: 'The way home', lines: ['Click to walk back to your restaurant.'] };
        case 'home':
          return { icon: WW.iconCanvas('door'), title: s.shop, lines: [this.isService() ? 'Open. Guests come in while he runs.' : 'Quiet hours. Nobody comes in until he runs again.', `${guestCount(this.scene.countIn('in'))} inside, ${this.scene.countIn('out')} on the road.`, 'Click to go in.'] };
        case 'door':
          return { icon: WW.iconCanvas('door'), title: visiting ? 'Their door' : 'Your front door', lines: visiting ? ['Click to go back to the street.'] : ['Click to go outside.', `${guestCount(this.scene.countIn('out'))} on the road.`] };
        case 'house': {
          const n = WW.NEIGHBOUR[hit.id];
          const lv = E.roomLevel(E.neighbourHome(hit.id).room);
          const v = s.visits[hit.id];
          return { icon: WW.iconCanvas('door'), title: n.shop, lines: [`Run by ${n.n}.`, `House level ${lv.level} of ${lv.top}.`, v && v.first ? null : 'Your first visit earns a welcome gift.', 'Click to go in.'] };
        }
        case 'yarditem':
          return T.decor(hit.def);
        case 'wheel':
          return { icon: WW.iconCanvas('wheel'), title: 'Squeektoshi and his wheel', lines: [this.live.state === 'running' ? `Running at ${this.live.rpm} turns a minute.` : this.quietText(), 'Click for the numbers.'] };
        case 'station': {
          const st = home.stations[hit.index];
          const info = WW.STATION_INFO[st.type];
          if (st.job) {
            const def = E.dishDef(st.job.dish);
            return { icon: WW.dishIcon(def, def.gold), title: def.n, lines: [info.n, st.job.fake ? 'Their kitchen is busy.' : this.jobText(st), st.job.fake ? null : `${fmt(st.job.y)} portions when it is done`] };
          }
          return { icon: WW.stationCanvas(st.type, false, 0), title: info.n, lines: [info.clock, visiting ? null : 'Click to cook.'] };
        }
        case 'lockedStation': {
          if (visiting) return null;
          const next = E.nextStation(s);
          return { icon: WW.lockedStationCanvas(), title: 'Room for another station', lines: [next ? `Next: ${WW.STATION_INFO[next.type].n}, ${money(next.price)}, level ${next.lvl}.` : 'The kitchen is full.', 'Click to open the kitchen.'] };
        }
        case 'dish': {
          const def = E.dishDef(hit.key);
          const data = T.dish(def, home);
          if (visiting) data.lines = [`Click to taste it for ${fmt(E.tasteCost(def))} cash, once a day. It may give away a recipe.`].concat(data.lines);
          return data;
        }
        case 'counter':
          return { icon: WW.iconCanvas('plate'), title: 'The counter', lines: ['Guests can only eat what is here.'] };
        case 'staff': {
          const w = home.staff.find((x) => x.id === hit.id);
          return w ? T.staff(w, home) : null;
        }
        case 'guest': {
          const data = T.species(hit.g.sp, s);
          const dish = hit.g.res.dish ? E.dishDef(hit.g.res.dish) : null;
          const status = { approach: 'On the way in', todoor: 'On the way in', enter: 'Looking for a seat', toseat: 'Going to a seat', waitfood: dish ? `Waiting for ${dish.n}` : 'Waiting', eat: dish ? `Eating ${dish.n}` : 'Eating', leave: 'Heading home', depart: 'Heading home', turnaway: 'Turning back' }[hit.g.state];
          data.title = hit.g.sp.n;
          data.icon = WW.animalFrames(hit.g.sp)[0];
          data.lines = [status].concat(data.lines);
          return data;
        }
        case 'walker': {
          const data = T.species(hit.p.sp, s);
          data.lines = ['Just passing by'].concat(data.lines);
          return data;
        }
        case 'furniture':
          return T.decor(hit.def);
        case 'tile':
          return hit.item ? T.decor(WW.DECOR_BY_ID[hit.item.id]) : null;
        default:
          return null;
      }
    }

    // Details box

    wireTips() {
      const box = document.getElementById('tip');
      this.tipBox = box;
      // Mouse over anything marked with a tip.
      document.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        this.mouseAt = { x: e.clientX, y: e.clientY };
        if (e.target === document.getElementById('world')) return;
        const t = this.tipHolder(e.target);
        if (!t) {
          if (this.tipFrom) this.hideTip();
          return;
        }
        this.tipFrom = t;
        const data = typeof t._tip === 'function' ? t._tip() : t._tip;
        if (data) this.showTip(data, e.clientX, e.clientY, true);
      });
      // A long press on a touch screen.
      document.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse') return;
        const t = this.tipHolder(e.target);
        clearTimeout(this.domHold);
        if (!t || e.target === document.getElementById('world')) return;
        this.swallowClick = false;
        this.domHold = setTimeout(() => {
          const data = typeof t._tip === 'function' ? t._tip() : t._tip;
          if (data) {
            this.swallowClick = true;
            this.showTip(data, e.clientX, e.clientY, true);
          }
        }, HOLD_MS);
      });
      document.addEventListener(
        'click',
        (e) => {
          if (!this.swallowClick) return;
          this.swallowClick = false;
          e.stopPropagation();
          e.preventDefault();
        },
        true
      );
      for (const ev of ['pointerup', 'pointercancel']) {
        document.addEventListener(ev, (e) => {
          if (e.pointerType === 'mouse') return;
          clearTimeout(this.domHold);
          this.hideTip();
        });
      }
    }

    // A button speaks for itself and never borrows the details of the row around it.
    tipHolder(node) {
      if (!node.closest) return null;
      const t = node.closest('[data-tip]');
      const button = node.closest('button');
      return button && t && !button.contains(t) ? null : t;
    }

    showTip(data, x, y, fromDom) {
      const box = this.tipBox;
      if (!box || !data) return;
      if (!fromDom) this.tipFrom = null;
      const key = JSON.stringify([data.title, data.lines && data.lines.map((l) => (l && l.flavours ? l.flavours.join() : l && l.text ? l.text : l))]);
      if (key !== this.tipKey) {
        this.tipKey = key;
        const lines = (data.lines || []).filter(Boolean).map((l) => {
          if (l.flavours) return el('div', { class: 'tipline' }, l.prefix || '', l.flavours.map(WW.flChip));
          if (l.text) return el('div', { class: 'tipline', style: `color:${l.color}` }, l.text);
          return el('div', { class: 'tipline' }, this.hasMouse ? l : l.replace(/\bClick\b/g, 'Tap'));
        });
        box.replaceChildren(el('div', { class: 'tiphead' }, data.icon ? img(data.icon, '', '') : null, el('b', null, data.title)), ...lines);
      }
      box.classList.add('show');
      const r = box.getBoundingClientRect();
      const gap = 14;
      let left = x + gap;
      let top = y + gap;
      if (left + r.width > window.innerWidth - 6) left = x - r.width - gap;
      if (top + r.height > window.innerHeight - 6) top = y - r.height - gap;
      box.style.left = Math.max(6, left) + 'px';
      box.style.top = Math.max(6, top) + 'px';
    }
    hideTip() {
      this.tipFrom = null;
      this.tipKey = null;
      if (this.tipBox) this.tipBox.classList.remove('show');
    }
    // A panel can be rebuilt under a resting mouse. The box then follows whatever is there now.
    refreshTip() {
      if (!this.tipFrom || this.tipFrom.isConnected) return;
      const under = this.mouseAt && document.elementFromPoint(this.mouseAt.x, this.mouseAt.y);
      const t = under && this.tipHolder(under);
      if (!t) return this.hideTip();
      this.tipFrom = t;
      const data = typeof t._tip === 'function' ? t._tip() : t._tip;
      if (data) this.showTip(data, this.mouseAt.x, this.mouseAt.y, true);
      else this.hideTip();
    }

    // Live data

    async connectLive() {
      if (window.claude || this.connecting || this.elsewhere) return; // The Artifact viewer has no network, the recording stays in charge.
      this.connecting = true;
      try {
        const live = await WW.LiveFeed.connect();
        // Only a save from this same wheel carries on from where it was. Its rounds and count mean nothing on a redeployed one.
        const mine = this.practice ? this.practice.real : this.s;
        const resume = mine && mine.feedMode === 'live' && mine.wheelCore === live.core ? mine.clock.round : null;
        // Always far enough back for his last full day, whatever the save needs.
        const back = Math.max(0, live.settledRound - 320);
        await live.syncFrom(resume !== null ? Math.min(resume, back) : back);
        this.liveFeed = live;
        // The practice kitchen keeps its pretend hamster. The real wheel takes over when it closes.
        if (!this.practice) {
          if (!this.landing.open) this.toast('Connected to the real wheel.', 'good');
          this.useLive(live);
        }
        this.reconnecting = false;
        this.connectFails = 0;
        if (!this.polling) {
          this.polling = true;
          this.pollLive();
        }
      } catch (e) {
        // A save on the real wheel keeps waiting, anything else stays on the recording, and this tries again.
        this.connectFails = this.connectFails || 0;
        setTimeout(() => this.connectLive(), RECONNECT_MS[Math.min(this.connectFails++, RECONNECT_MS.length - 1)]);
      } finally {
        this.connecting = false;
      }
    }
    // A save from this same wheel carries straight on, anything else moves across and keeps the restaurant.
    useLive(live) {
      const s = this.s;
      if (s && s.feedMode === 'live' && s.wheelCore === live.core) this.feed = live;
      else this.switchFeed(live);
    }
    pollLive() {
      // A tab that another one took over asks nothing more of the API.
      if (this.elsewhere) return;
      const feed = this.practice ? this.liveFeed : this.feed;
      if (feed && feed.mode === 'live') {
        if (!feed.replaced) feed.poll();
        else if (!this.reconnecting) {
          this.reconnecting = true;
          this.connectLive();
        }
      }
      setTimeout(() => this.pollLive(), this.linegame && this.linegame.active ? 1000 : 2500);
    }
    // Going from one data source to another moves the clock but keeps the restaurant.
    switchFeed(feed) {
      const before = this.now();
      this.feed = feed;
      if (feed.mode !== 'recording') this.speed = 1;
      if (!this.s) return;
      const t = this.now();
      for (const st of this.s.stations) {
        if (st.job && st.type === 'stove') st.job.start += t - before;
      }
      E.moveToFeed(this.s, feed, t);
      this.dirty = true;
    }
    // Saves

    loadLocal() {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    }
    autosave(force) {
      if (!this.s || this.practice || this.elsewhere || (!this.dirty && !force)) return;
      this.dirty = false;
      this.s.savedAt = Date.now();
      this.s.clockOffset = this.feed.mode === 'recording' ? this.feed.offset : 0;
      const raw = JSON.stringify(this.s);
      try {
        localStorage.setItem(SAVE_KEY, raw);
      } catch (e) {}
      if (this.cloudDoc && !this.cloudBusy) {
        this.cloudBusy = true;
        this.cloudDoc
          .set({ save: raw, at: this.s.savedAt })
          .catch(() => {})
          .finally(() => (this.cloudBusy = false));
      }
    }
    async connectCloud() {
      const c = window.claude;
      if (!c || !c.use) return;
      try {
        const [db, user] = await Promise.all([c.use('db'), c.use('user')]);
        if (!db || !user) return;
        const id = await user.id();
        if (!id) return;
        this.cloudDoc = db.collection('data/users/' + id).doc('save');
        const snap = await Promise.race([this.cloudDoc.get(), new Promise((res) => setTimeout(() => res(null), 10000))]);
        const data = snap && snap.exists ? snap.data() : null;
        const mine = this.practice ? this.practice.real : this.s;
        if (data && data.save && (!mine || data.at > (mine.savedAt || 0))) {
          const remote = JSON.parse(data.save);
          if (this.practice) this.practice.finishNow();
          if (!this.s) document.getElementById('overlay').classList.remove('show');
          this.visit = null;
          this.useSave(remote);
          // Whatever first cards were up have gone, so the landing page needs its way in back.
          if (this.landing.open) this.landing.show();
          this.toast('Your restaurant was restored from your other device.', 'good');
        }
      } catch (e) {
        this.cloudDoc = null;
      }
    }

    // The clock

    frame(ts) {
      const dt = Math.min(0.1, (ts - this.last) / 1000);
      this.last = ts;
      // Stopped because another tab took over: nothing moves here any more.
      if (this.elsewhere) return requestAnimationFrame((t) => this.frame(t));
      if (this.landing.open) this.landing.frame(dt);
      else if (this.s) {
        if (this.speed > 1 && this.feed.mode === 'recording') this.feed.offset += dt * 1000 * (this.speed - 1);
        this.scene.update(dt);
        this.scene.draw();
        if (this.practice) this.practice.place();
      }
      requestAnimationFrame((t) => this.frame(t));
    }

    tick() {
      if (this.elsewhere) return;
      if (this.landing.open) {
        this.live = this.feed.live(this.now());
        this.tickN++;
        return this.landing.tick();
      }
      this.wallet.tick(this.s, E, this.feed.mode === 'live');
      if (!this.s) return;
      const s = this.s;
      const t = this.now();
      this.tickN++;
      const adv = E.advance(s, this.feed, t);
      if (s.stats.served > 0 && this.feed.mode === 'live' && !this.practice) this.count.once('first_guest');
      if (adv) {
        const rep = E.takeReport(s);
        this.handleReport(rep, adv.steps >= 18);
        this.dirty = true;
        // Fresh money can switch on buttons in whatever panel is open.
        if (this.panelVisible() && !this.panels.pressing) this.panels.render();
      }
      // Stoves finish on real time, not at the end of a round.
      this.finishStoves(t);
      const events = [];
      this.live = E.pulse(s, this.feed, t, events);
      if (events.length) {
        this.dirty = true;
        const stride = this.speed > 10 ? 4 : 1;
        events.forEach((res, i) => {
          if (i % stride) return;
          if (!res.served && Math.random() < 0.6) return;
          if (!this.visit) return this.scene.guestArrives(res);
          // Out visiting: they are still on their way when you get back.
          this.missed.push(Object.assign({}, res, { isNew: false }));
          if (this.missed.length > 16) this.missed.shift();
        });
      }
      const rep = s.away;
      if (rep.levels) {
        this.celebrateLevel();
        rep.levels = 0;
      }
      if (rep.newSpecies.length) {
        // One still on the way is announced when it pays.
        for (const id of rep.newSpecies) if (!this.scene.guests.some((g) => g.sp.id === id) && !this.scene.coming.some((r) => r.species === id)) this.onNewSpecies(WW.ANIMAL[id]);
        rep.newSpecies = [];
      }
      const done = E.checkPrep(s);
      if (done.length) {
        const sum = done.reduce((a, p) => a + p.reward, 0);
        this.toast(done.length === 1 ? `Done: ${done[0].n}. +${sum} cash` : `${done.length} prep list jobs done. +${sum} cash`, 'good');
        this.sound('coin');
        this.dirty = true;
      }
      this.updateHud();
      if (this.tickN % 4 === 0 && this.panelVisible()) this.panels.refresh();
      this.updateMusic();
      if (this.tickN % 2 === 0) {
        this.updateCta();
        this.updateDock();
      }
      if (this.practice) this.practice.tick();
    }

    panelVisible() {
      return this.desktop() || this.panelOpen;
    }

    finishStoves(t) {
      const s = this.s;
      for (const st of s.stations) {
        if (st.type === 'stove' && st.job && t >= st.job.start + st.job.need * 60000) {
          const j = st.job;
          s.stock[j.dish] = (s.stock[j.dish] || 0) + j.y;
          if (s.known[j.dish]) s.known[j.dish].made++;
          st.last = j.dish;
          st.job = null;
          s.stats.batches++;
          this.dishReady(j);
        }
      }
    }
    dishReady(job) {
      const def = E.dishDef(job.dish);
      this.toast(`${def.n} is ready: ${fmt(job.y)} portions on the counter.`, 'good', WW.dishIcon(def, def.gold));
      this.sound('plate');
      this.dirty = true;
      if (this.panels.tab === 'kitchen') this.panels.render();
    }

    handleReport(rep, big) {
      const interesting = rep.served + rep.soldOut + rep.winkGain + rep.jobs.length > 0;
      if (rep.banked > 0 && !big) {
        this.toast(`Round settled. ${money(rep.banked)} banked.`, 'good');
        this.sound('bank');
      }
      if (rep.jobs.length && !big) for (const j of rep.jobs) this.dishReady(j);
      if (!big) {
        for (const sw of rep.swaps || []) this.toast(`${WW.NEIGHBOUR[sw.from].n} took your ${WW.INGREDIENT[sw.took].n} and left ${WW.INGREDIENT[sw.gave].n}.`, 'good', WW.ingredientIcon(sw.gave));
        if (rep.offers) this.toast('A new trade offer is in your mailbox.', 'good', WW.iconCanvas('mail'));
      }
      if (rep.levels && !big) this.celebrateLevel();
      if (rep.newSpecies.length && !big) for (const id of rep.newSpecies) this.onNewSpecies(WW.ANIMAL[id]);
      rep.levels = 0;
      if (big && interesting) this.enqueue(() => this.showReceipt(rep));
      for (const d of big ? rep.dreams.slice(-1) : rep.dreams) this.enqueue(() => this.showDream(d));
      if (rep.verdict) this.enqueue(() => this.showVerdict(rep.verdict));
      if (rep.festival) this.toast(`He passed ${rep.festival} km! Festival: 25% more tips for a day. Bunting is in your bag.`, 'good');
      if (rep.napGift && !big) this.toast(`He napped and woke up. You found ${WW.INGREDIENT[rep.napGift].n} x2.`, 'good');
      this.pumpQueue();
    }

    onNewSpecies(sp) {
      this.toast(`New guest: ${sp.n}`, 'good', WW.animalFrames(sp)[0]);
      this.sound('new');
      this.dirty = true;
    }
    celebrateLevel() {
      this.toast(`Level ${this.s.level}! New things in the shops.`, 'good', WW.iconCanvas('star'));
      this.sound('level');
      this.dirty = true;
      if (this.panelVisible()) this.panels.render();
    }

    afterAction() {
      this.dirty = true;
      if (E.checkPrep(this.s).length) this.sound('coin');
      this.updateHud();
    }

    // The facts of the restaurant on screen, yours or the one you are visiting.
    houseFacts(st = this.scene.st) {
      const lv = E.roomLevel(st.room);
      return { st, level: lv.level, top: lv.top, seats: E.seatsOf(st).length, stars: E.ratingStars(st) };
    }
    updateHouseInfo() {
      const f = this.houseFacts();
      // A phone has room for about forty letters here.
      const house = this.desktop() ? `House level ${f.level} of ${f.top} · Room ${f.st.room.cols}x${f.st.room.rows}` : `House ${f.level}/${f.top} · ${f.st.room.cols}x${f.st.room.rows}`;
      const text = `${house} · ${f.seats} seat${f.seats === 1 ? '' : 's'} · Rating ${f.stars.toFixed(1)}`;
      if (text === this.houseText) return;
      this.houseText = text;
      document.getElementById('houseText').textContent = WW.tr(text);
    }
    houseTip(st = this.scene.st) {
      if (!this.s) return null;
      const f = this.houseFacts(st);
      const room = f.st.room;
      const lines = [`House level ${f.level} of ${f.top}. It goes up each time the room expands.`, `Room ${room.cols} by ${room.rows} tiles, ${f.seats} seat${f.seats === 1 ? '' : 's'}, up to ${E.capacity(f.st)} guests a round.`, `Rating ${f.stars.toFixed(1)} of 5.`];
      if (st !== this.s) lines.push('Click here for trades and hiring.');
      else {
        const next = E.nextExpansion(this.s);
        lines.push(next ? `Next: ${next.cols} by ${next.rows} tiles for ${money(next.price)}, from level ${next.lvl}.` : 'Your room is as big as it gets.');
      }
      return { icon: WW.iconCanvas('expand'), title: f.st.shop, lines };
    }

    // HUD

    updateHud() {
      const s = this.s;
      if (!s) return;
      document.getElementById('hudCash').textContent = fmt(s.cash);
      document.getElementById('hudTill').textContent = s.till > 0 ? `+${fmt(s.till)}` : '';
      document.getElementById('hudWinks').textContent = fmt(s.winks);
      document.getElementById('hudLevel').textContent = WW.tr(`Lv ${s.level}`);
      document.getElementById('hudXp').style.width = Math.round((s.xp / E.xpNeed(s.level)) * 100) + '%';
      const live = this.live;
      const t = this.now();
      const left = Math.max(0, this.feed.roundEnd(this.feed.roundAt(t)) - t);
      const mm = String(Math.floor(left / 60000)).padStart(2, '0');
      const ss = String(Math.floor(left / 1000) % 60).padStart(2, '0');
      const colors = { running: C.leaf, breather: C.butter, quiet: C.lilac, unknown: C.steel };
      const labels = { running: `RUNNING ${live.rpm} RPM`, breather: 'CATCHING HIS BREATH', quiet: this.quietText().toUpperCase(), unknown: 'NO SIGNAL' };
      const state = WW.tr(this.visit ? `AT ${this.visit.home.shop.toUpperCase()}` : labels[live.state]);
      // A replay must never pass for the real hamster.
      const tag = this.feed.mode === 'practice' ? 'PRACTICE' : this.feed.mode === 'recording' ? 'REPLAY' : null;
      document.getElementById('ribbonState').textContent = tag && !this.visit ? `${WW.tr(tag)} · ${state}` : state;
      document.getElementById('ribbonDot').style.background = colors[live.state];
      // While he sleeps there is nothing to bank, and the dream is what is coming.
      document.getElementById('ribbonRound').textContent = WW.tr(live.state === 'quiet' ? this.dreamLine() : `Round ends ${mm}:${ss}`);
      this.updateHouseInfo();
      this.setBadge(document.querySelector('.tab[data-tab="kitchen"]'), s.stations.filter((st) => !st.job).length);
      this.updatePlaceBar();
    }
    // Which way the door button goes from here.
    doorPlace() {
      const view = this.scene.view;
      if (this.visit) return { to: 'street', text: 'Back to the street', icon: 'out' };
      if (view === 'in') return { to: 'out', text: 'Go outside', icon: 'out' };
      if (view === 'out') return { to: 'in', text: 'Go inside', icon: 'inn' };
      return { to: 'out', text: 'Go home', icon: 'inn' };
    }
    doorButton() {
      this.walkTo(this.doorPlace().to);
    }
    doorTip() {
      if (!this.s) return null;
      const place = this.doorPlace();
      const lines = [];
      const mail = E.mailCount(this.s);
      if (!this.visit && this.scene.view === 'in') {
        lines.push(`${guestCount(this.scene.countIn('out'))} on the road.`);
        if (mail) lines.push(`${mail} waiting in your mailbox.`);
        if (this.boardWaiting()) lines.push('The notice board has something for you.');
      } else if (!this.visit && this.scene.view === 'out') lines.push(`${guestCount(this.scene.countIn('in'))} inside.`);
      return { icon: WW.iconCanvas(place.icon), title: place.text, lines };
    }
    skyIconName() {
      const sky = this.sky();
      if (sky.weather === 'clear') return this.isAwake() ? 'sun' : 'moon';
      return WW.WEATHER[sky.weather].icon;
    }
    skyTip() {
      if (!this.s) return null;
      const sky = this.sky();
      const season = WW.SEASONS[sky.season];
      const weather = WW.WEATHER[sky.weather];
      return {
        icon: WW.iconCanvas(this.skyIconName()),
        title: `${season.n}, day ${sky.day} of ${WW.SEASON_DAYS}`,
        lines: [
          this.isAwake() ? 'Daytime. He\'s up.' : 'Night. He\'s asleep, so the lamps are on.',
          { flavours: [season.fl], prefix: 'In season, +10% tips on ' },
          weather.tips ? `${weather.n}: tips +${Math.round(weather.tips * 100)}%.` : `${weather.n}: no change to tips.`,
          'The weather changes every 3 hours, for the whole street at once.',
        ],
      };
    }
    updatePlaceBar() {
      const s = this.s;
      const place = this.doorPlace();
      const text = document.getElementById('doorText');
      const label = WW.tr(place.text);
      if (text.textContent !== label) {
        text.textContent = label;
        document.getElementById('doorIcon').src = WW.iconCanvas(place.icon).toDataURL();
      }
      const inside = !this.visit && this.scene.view === 'in';
      this.setBadge(document.getElementById('btnDoor'), inside ? E.mailCount(s) + (this.boardWaiting() ? 1 : 0) : 0);
      const arrange = document.getElementById('btnArrange');
      arrange.style.display = this.visit || this.scene.view === 'street' ? 'none' : '';
      document.getElementById('btnShare').style.display = this.visit ? 'none' : '';
      arrange.classList.toggle('on', !!this.scene.editing);
      const sky = this.sky();
      const key = [sky.season, sky.weather, this.isAwake()].join();
      if (key !== this.skyKey) {
        this.skyKey = key;
        document.getElementById('skyIcon').src = WW.iconCanvas(this.skyIconName()).toDataURL();
        document.getElementById('skyText').textContent = WW.tr(WW.SEASONS[sky.season].n) + ' · ' + WW.tr(WW.WEATHER[sky.weather].n);
      }
    }
    setBadge(tab, n) {
      if (!tab) return;
      let b = tab.querySelector('.badge');
      if (!n) {
        if (b) b.remove();
        return;
      }
      if (!b) {
        b = el('span', { class: 'badge' });
        tab.append(b);
      }
      b.textContent = n;
    }
    quietText() {
      const s = this.s;
      if (!s) return 'Asleep';
      const hrs = s.clock.streak / 6;
      if (hrs >= 1) return `Quiet for ${hrs.toFixed(1)} hours`;
      return 'Quiet hours';
    }
    // What the sleep is worth so far, on the same count his dream will use.
    dreamLine() {
      const d = E.dreamProgress(this.s);
      if (!d.goldIn) return 'Golden dream waiting';
      if (!d.dreamIn) return this.desktop() ? `Dream Dish waiting, golden in ${d.goldIn.toFixed(1)} h` : `Golden dream in ${d.goldIn.toFixed(1)} h`;
      return `Dream Dish in ${d.dreamIn.toFixed(1)} h`;
    }
    dreamNote() {
      const d = E.dreamProgress(this.s);
      const CFG = WW.CFG;
      return `${d.hours >= 1 ? `He has slept ${d.hours.toFixed(1)} hours so far. ` : ''}When he wakes after ${CFG.DREAM_ROUNDS / 6} hours or more, every player gets the same Dream Dish, golden after ${CFG.GOLD_ROUNDS / 6} hours. Nothing can wake him, so nobody knows when.`;
    }
    jobText(st) {
      const s = this.s;
      const t = this.now();
      const j = st.job;
      if (st.type === 'stove') {
        const left = Math.max(0, j.start + j.need * 60000 - t);
        return left > 3600000 ? `${(left / 3600000).toFixed(1)} h left` : `${Math.ceil(left / 60000)} min left`;
      }
      if (st.type === 'wok') {
        const left = Math.max(0, j.need - (this.live.cum - j.start));
        if (left === 0) return 'Plated when the round settles';
        return this.isService() ? `${fmt(left)} pass${left === 1 ? '' : 'es'} left` : `${fmt(left)} pass${left === 1 ? '' : 'es'} left, waiting for the wheel`;
      }
      const left = Math.max(0, j.need - (s.clock.quietTotal - j.start));
      return this.isService() ? `${left} sleeping round${left === 1 ? '' : 's'} left, on hold until he stops running` : `${left} sleeping round${left === 1 ? '' : 's'} left, about ${(left / 6).toFixed(1)} h`;
    }
    staffName(id) {
      if (id === 'head') return this.s.chef.name;
      const w = this.s.staff.find((x) => x.id === id);
      return w ? w.n : '';
    }
    quizWaiting() {
      return this.s && this.s.quizDay !== E.dayKey(this.now());
    }
    boardWaiting() {
      if (!this.s) return false;
      if (this.quizWaiting()) return true;
      const o = E.ensureOrders(this.s, this.feed, this.now());
      return o.items.some((it) => !it.done && E.orderStock(this.s, it) >= it.n);
    }
    treeReady() {
      if (this.visit) return !E.neighbourDay(this.s, this.visit.nid, this.now()).shook;
      return (this.s.tree.day === E.dayKey(this.now()) ? this.s.tree.shakes : 0) < 3;
    }

    // Points at the next thing on the prep list, or at the way there.
    nextTarget() {
      const s = this.s;
      if (!s || this.visit || this.scene.editing) return null;
      const next = WW.PREP.find((p) => !s.prep[p.id]);
      if (!next || !next.target) return null;
      const view = this.scene.view;
      const O = WW.OUTSIDE;
      const kind = next.target;
      const station = kind === 'stove' || kind === 'wok' || kind === 'pot';
      const free = station ? s.stations.findIndex((st) => st.type === kind && !st.job) : -1;
      if (station && free < 0) return null;
      const where = station ? 'in' : kind === 'street' ? 'street' : 'out';
      if (where !== view) {
        if (view === 'street') return { view, x: WW.STREET.GATE.x + 14, y: WW.STREET.GATE.y + 2 };
        if (view === 'out') return where === 'in' ? { view, x: O.DOOR.x, y: O.DOOR.y - 34 } : { view, x: O.GATE.x + 14, y: O.GATE.y + 2 };
        const m = this.scene.m;
        return { view, x: m.doorX + m.doorW / 2, y: m.frontY - 12 };
      }
      if (station) return { view, x: WORLD.STATION_X + free * WORLD.STATION_W + 12, y: WORLD.STATION_Y - 8 };
      if (kind === 'tree') return { view, x: O.TREE.x + 20, y: O.TREE.y };
      if (kind === 'board') return { view, x: O.BOARD.x + 12, y: O.BOARD.y - 2 };
      if (kind === 'stall') return { view, x: O.MARKET.door, y: O.MARKET.y + 42 };
      const lot = this.streetLots()[0];
      return { view, x: lot.x, y: lot.y - 8 };
    }

    // On phones the space under the world shows what is going on at a glance.
    updateDock() {
      const dock = document.getElementById('dock');
      if (this.desktop() || this.panelOpen || !this.s) return;
      if (this.practice) {
        this.dockKey = null;
        return dock.replaceChildren();
      }
      const s = this.s;
      if (this.visit) return this.updateVisitDock(dock);
      if (this.scene.view === 'out') return this.updateOutDock(dock);
      if (this.scene.view === 'street') return this.updateStreetDock(dock);
      const next = WW.PREP.find((p) => !s.prep[p.id]);
      const stockN = E.inStock(s).reduce((a, k) => a + s.stock[k], 0);
      const key = JSON.stringify([next && next.id, s.stations.map((st) => (st.job ? [st.job.dish, this.jobText(st), Math.round(E.stationProgress(s, st, this.feed, this.now()) * 100)] : 0)), stockN, E.seatsOf(s).length, s.lunch]);
      if (key === this.dockKey) return;
      this.dockKey = key;
      const rows = s.stations.map((st) => {
        const def = st.job ? E.dishDef(st.job.dish) : null;
        const pr = st.job ? E.stationProgress(s, st, this.feed, this.now()) : 0;
        return el('div', { class: 'dockrow' }, img(def ? WW.dishIcon(def, def.gold) : WW.stationCanvas(st.type, false, 0), '', ''), el('div', { class: 'grow' }, el('div', { class: 'sub' }, def ? def.n + ': ' + this.jobText(st) : 'Free. Tap to cook.'), def ? el('div', { class: 'bar ' + st.type }, el('i', { style: 'width:' + Math.round(pr * 100) + '%' })) : null));
      });
      const card = el(
        'button',
        { class: 'dockcard', type: 'button', style: 'width:100%;border:0;text-align:left;cursor:pointer', on: { click: () => this.panels.open('kitchen') } },
        next ? el('div', { class: 'dockrow' }, el('div', { class: 'grow' }, el('b', { style: 'font:400 20px/1 var(--display)' }, 'Next: '), next.n), el('b', { class: 'tabnum' }, `+${next.reward} cash`)) : null,
        rows,
        el('div', { class: 'dockrow note' }, `${fmt(stockN)} portion${stockN === 1 ? '' : 's'} on the counter, ${E.seatsOf(s).length} seat${E.seatsOf(s).length === 1 ? '' : 's'}, ${s.lunch} lunchbox${s.lunch === 1 ? '' : 'es'}`)
      );
      dock.replaceChildren(card);
    }

    placeButton(ic, label, fn, n) {
      return el('button', { class: 'place', type: 'button', on: { click: fn } }, img(WW.iconCanvas(ic), '', ''), label, n ? el('span', { class: 'badge' }, n) : null);
    }
    // A small screen cannot show the whole forest, so the dock lists what is out here.
    updateOutDock(dock) {
      const s = this.s;
      const mail = E.mailCount(s);
      const board = this.boardWaiting();
      this.topRanks();
      const key = JSON.stringify(['out', mail, board, E.charmOf(s), this.rankOfMe]);
      if (key === this.dockKey) return;
      this.dockKey = key;
      const open = (tab, sub) => () => this.panels.open(tab, sub);
      dock.replaceChildren(
        el(
          'div',
          { class: 'dockcard' },
          el('div', { class: 'places' }, this.placeButton('basket', 'Market', open('market')), this.placeButton('chair', 'Decor Shop', open('decor', { kind: 'yard' })), this.placeButton('street', 'Street', () => this.walkTo('street')), this.placeButton('orders', 'Notice Board', open('orders'), board ? '!' : 0), this.placeButton('mail', 'Mailbox', open('street', { view: 'mail' }), mail), this.placeButton('basket', 'Your shelf', open('street', { view: 'shelf' })), this.placeButton('trophy', this.rankOfMe ? `Leaderboard #${this.rankOfMe}` : 'Leaderboard', open('street', { view: 'board' }))),
          el('div', { class: 'dockrow note' }, `Charm ${E.charmOf(s)}: about ${Math.round(E.attractOf(s) * 100)}% more guests walk in.`)
        )
      );
    }
    updateStreetDock(dock) {
      const key = JSON.stringify(['street', this.lotsKey]);
      if (key === this.dockKey) return;
      this.dockKey = key;
      dock.replaceChildren(el('div', { class: 'dockcard' }, el('div', { class: 'dockrow note' }, 'Tap a house to go in. Drag the map to look along the street.')));
    }

    // At a neighbour's the dock says what can be done here.
    updateVisitDock(dock) {
      const s = this.s;
      const nid = this.visit.nid;
      const v = E.neighbourDay(s, nid, this.now());
      const left = 6 - v.cleaned.length;
      const key = JSON.stringify(['visit', nid, left, v.shook, v.tasted]);
      if (key === this.dockKey) return;
      this.dockKey = key;
      const row = (ic, text) => el('div', { class: 'dockrow' }, img(WW.iconCanvas(ic), '', ''), el('div', { class: 'grow sub' }, text));
      dock.replaceChildren(
        el(
          'button',
          { class: 'dockcard', type: 'button', style: 'width:100%;border:0;text-align:left;cursor:pointer', on: { click: () => this.panels.open('street', { view: 'here' }) } },
          el('div', { class: 'dockrow' }, el('b', { style: 'font:400 20px/1 var(--display)' }, this.visit.home.shop)),
          row('broom', left ? `Tap the dirt to clean it: ${left} spot${left > 1 ? 's' : ''} left.` : 'Their floor is spotless.'),
          row('shake', v.shook ? 'You shook their tree today.' : 'Their tree is out on the street.'),
          row('plate', v.tasted ? 'You tasted a dish today.' : 'Tap a dish on their counter to taste it.'),
          row('basket', 'Tap here to trade or hire.')
        )
      );
    }

    updateCta() {
      const box = document.getElementById('cta');
      const s = this.s;
      const parts = [];
      const ed = this.scene.editing;
      if (ed) {
        if (ed.selected) parts.push(['store', 'Store in bag', 'plain']);
        if (ed.ghost) parts.push(['cancel', 'Cancel', 'plain']);
        parts.push(['done', 'Done', 'teal']);
      } else if (!this.visit) {
        if (this.scene.view === 'street' && !this.desktop()) parts.push(['others', `Another street (${E.streetMovesLeft(s, this.now())} left)`, 'plain']);
        const running = this.live.state === 'running' || (this.live.state === 'breather' && this.live.agoMs < 8000);
        const tipsLeft = E.lineTipsLeft(s, this.now()) > 0;
        if (this.practice) {
          const step = this.practice.step;
          if (step && step.line && running && tipsLeft) parts.push(['live', 'On the Line: he is running!', 'tomato pulse']);
        } else if (running && tipsLeft) parts.push(['live', 'On the Line: he is running!', 'tomato pulse']);
        else if (!running && tipsLeft) {
          const day = E.dayKey(this.now());
          if (s.line.replayDay !== day && this.replayFeed().lastSession(this.now())) parts.push(['replay', 'Replay his last run', 'plain']);
        }
      }
      const key = parts.map((p) => p[0] + p[1]).join('|');
      if (key === this.ctaKey) return;
      this.ctaKey = key;
      box.replaceChildren(
        ...parts.map(([id, label, cls]) =>
          btn(label, () => {
            if (id === 'live') this.linegame.start(null);
            else if (id === 'replay') this.startReplay();
            else if (id === 'store') this.storeSelected();
            else if (id === 'cancel') this.cancelHeld();
            else if (id === 'done') this.toggleArrange();
            else this.moveStreet();
          }, cls + ' small')
        )
      );
    }

    replayFeed() {
      if (this.feed.mode === 'recording') return this.feed;
      this.recordingForReplay = this.recordingForReplay || new WW.RecordingFeed(WW.RECORDING);
      return this.recordingForReplay;
    }

    startReplay() {
      const s = this.s;
      const source = this.replayFeed();
      const session = source.lastSession(this.now());
      if (!session) return this.toast('No recorded run to replay yet.', 'bad');
      const raw = source.sessionPasses(session);
      // Trim long pauses so the turn stays lively, but every pass is a real one.
      const out = [];
      let t = 0;
      for (let i = 0; i < raw.length; i++) {
        const gap = i ? raw[i] - raw[i - 1] : 0;
        t += gap > 3000 ? 1500 : gap;
        out.push(t);
      }
      s.line.replayDay = E.dayKey(this.now());
      this.linegame.start(out);
    }

    showLineResult(r) {
      this.showTicket(
        el('h2', null, 'Off the line'),
        el('p', { class: 'note' }, r.reason),
        el('div', { class: 'line' }, 'Orders served', el('b', { class: 'tabnum' }, r.served)),
        el('div', { class: 'line' }, 'Best combo', el('b', { class: 'tabnum' }, r.best)),
        el('div', { class: 'line' }, 'Missed', el('b', { class: 'tabnum' }, r.missed)),
        // Short numbers stay on one line, however long the words beside them.
        el('div', { class: 'line' }, r.replay ? 'Tips (half for a replay)' : 'Tips (banked when the round settles)', el('b', { class: 'tabnum', style: 'white-space:nowrap' }, money(r.tips))),
        el('div', { class: 'line' }, 'Tips today', el('b', { class: 'tabnum', style: 'white-space:nowrap' }, `${fmt(this.s.line.tips)} of ${fmt(E.lineCap(this.s))}`)),
        this.actions(btn('Back to the kitchen', () => this.closeOverlay()))
      );
    }

    // Tapping the world

    worldTap(x, y) {
      if (this.scene.fading) return;
      const w = this.scene.toWorld(x, y);
      const hit = this.scene.hit(w.x, w.y);
      if (this.visit) return this.visitTap(hit);
      switch (hit.kind) {
        case 'tile':
          return this.arrangeTap(hit.col, hit.row, hit.item);
        case 'station':
          this.sound('tap');
          if (this.s.stations[hit.index].job) return this.panels.open('kitchen');
          return this.panels.open('kitchen', { station: hit.index });
        case 'lockedStation':
          return this.panels.open('kitchen');
        case 'wheel':
          return this.panels.open('wheel');
        case 'counter':
        case 'dish':
          return this.panels.open('kitchen');
        case 'dirt':
          this.scene.dirt = this.scene.dirt.filter((d) => d !== hit.d);
          this.lootToast(E.cleanTile(this.s));
          this.sound('tap');
          this.scene.parts.push({ x: hit.d.x, y: hit.d.y, vx: 0, vy: -12, life: 0.6, c: C.ice });
          return this.afterAction();
        case 'door':
          return this.walkTo('out');
        case 'home':
          return this.walkTo('in');
        case 'gate':
          return this.walkTo('street');
        case 'homegate':
          return this.walkTo('out');
        case 'house':
          return this.visitNeighbour(hit.id);
        case 'nextstreet':
          return this.moveStreet();
        case 'ranks':
          return this.panels.open('street', { view: 'board' });
        case 'ntree':
          return this.shakeNeighbourTree(hit.id);
        case 'tree':
          return this.shakeTree();
        case 'market':
          return this.panels.open('market');
        case 'shop':
        case 'yarditem':
          return this.panels.open('decor', { kind: 'yard' });
        case 'board':
          return this.panels.open('orders');
        case 'mailbox':
          return this.panels.open('street', { view: 'mail' });
        case 'shelf':
          return this.panels.open('street', { view: 'shelf' });
        case 'staff':
          return this.panels.open('staff');
        case 'guest':
        case 'walker':
          return this.panels.open('guests');
        case 'furniture':
          // Its own shelf in the shop, or the bag for things no shop sells.
          if (hit.def.find) return this.panels.open('kitchen', { bag: 'finds' }) || this.panels.showBag();
          return this.panels.open('decor', { kind: hit.def.kind });
        default:
          return;
      }
    }

    visitTap(hit) {
      const s = this.s;
      const nid = this.visit.nid;
      const t = this.now();
      switch (hit.kind) {
        case 'dirt': {
          const r = E.cleanSpot(s, nid, hit.d.i, t);
          if (r.error) return this.toast(r.error, 'bad');
          this.sound('coin');
          this.scene.floats.push({ x: hit.d.x, y: hit.d.y - 6, text: '+' + r.cash, c: '#8fd68a', life: 1.1 });
          this.scene.parts.push({ x: hit.d.x, y: hit.d.y, vx: 0, vy: -12, life: 0.6, c: C.ice });
          this.lootToast(r);
          this.afterAction();
          if (!r.left) this.toast(`${WW.NEIGHBOUR[nid].n}'s floor is spotless. Thank you!`, 'good');
          this.updateDock();
          return this.panels.render();
        }
        case 'dish': {
          const r = E.tasteNeighbour(s, nid, hit.key, t);
          if (r.error) return this.toast(r.error, 'bad');
          this.sound('serve');
          this.toast(r.hint ? `${r.def.n}: you can taste ${WW.INGREDIENT[r.hint.ingredient].n} in it. A recipe clue!` : `${r.def.n}. Lovely. +2 Winks`, 'good', WW.dishIcon(r.def));
          this.afterAction();
          return this.panels.render();
        }
        case 'door':
          return this.walkTo('street');
        case 'staff':
          return this.panels.open('street', { view: 'here' });
        default:
          return;
      }
    }

    // Moving between places. Darkness first, then the change, so nothing jumps on screen.
    walkTo(view, then) {
      if (!this.s || this.scene.fading) return;
      this.endArrange();
      this.hideTip();
      this.sound('tap');
      this.scene.goTo(
        view,
        () => {
          if (this.visit) this.endVisit();
          if (then) then();
        },
        () => this.arrived()
      );
    }
    arrived() {
      this.ctaKey = null;
      this.dockKey = null;
      this.updateHud();
      this.updateCta();
      this.updateDock();
      this.updateMusic();
      if (this.panelVisible()) this.panels.render();
    }
    endVisit() {
      this.visit = null;
      this.scene.reset();
      this.fit();
      for (const res of this.missed) this.scene.guestArrives(res);
      this.missed = [];
      // That house's page goes with the visit.
      if (this.panels.tab === 'street' && this.panels.sub.view === 'here') {
        this.panels.open('kitchen');
        if (!this.desktop()) this.setPanelOpen(false);
      }
    }
    visitNeighbour(nid) {
      this.walkTo('in', () => {
        const gift = E.visitFirst(this.s, nid, this.now());
        this.visit = { nid, home: E.neighbourHome(nid) };
        // Whoever was still on the way is still coming when you get back.
        this.missed.push(...this.scene.coming);
        this.scene.reset();
        this.fit();
        if (gift) this.toast(`${WW.NEIGHBOUR[nid].n} welcomes you with ${WW.INGREDIENT[gift].n} x4.`, 'good', WW.ingredientIcon(gift));
        this.afterAction();
        this.panels.open('street', { view: 'here' });
        if (!this.desktop()) this.setPanelOpen(false);
      });
    }
    // Another street, with five other houses, a few times a day.
    moveStreet() {
      const left = E.streetMovesLeft(this.s, this.now());
      if (left <= 0) return this.toast('No more streets today. You can move again tomorrow.', 'bad');
      this.walkTo('street', () => {
        E.moveStreet(this.s, this.now());
        this.dirty = true;
        this.lotsKey = null;
        this.scene.cam.key = null;
        this.toast(`Another street. ${left - 1} move${left === 2 ? '' : 's'} left today.`, 'good', WW.iconCanvas('street'));
      });
    }

    shakeTree() {
      const res = E.shakeTree(this.s, this.now());
      if (!res) return this.toast('The tree is bare until tomorrow.');
      this.scene.shakeTree('home');
      this.toast(`${money(res.cash)} fell out.`, 'good', WW.iconCanvas('cash'));
      this.lootToast(res);
      this.sound('coin');
      this.afterAction();
    }
    shakeNeighbourTree(nid) {
      const r = E.shakeNeighbour(this.s, nid, this.now());
      if (r.error) return this.toast(r.error, 'bad');
      this.scene.shakeTree(nid);
      this.sound('coin');
      this.toast(`${money(r.cash)} fell out.`, 'good', WW.iconCanvas('cash'));
      this.lootToast(r);
      this.afterAction();
      if (this.panelVisible()) this.panels.render();
    }

    // Whatever turned up besides the money.
    lootToast(r) {
      if (r.find) {
        const def = WW.DECOR_BY_ID[r.find];
        this.toast(def.find === 'treasure' ? `A real find: ${def.n}! It is in your bag.` : `You picked up ${def.n}. It is in your bag.`, 'good', WW.decorCanvas(r.find));
        this.sound(def.find === 'treasure' ? 'new' : 'tap');
      }
      if (r.ingredient) this.toast(`Found ${WW.INGREDIENT[r.ingredient].n} x${r.n}.`, 'good', WW.ingredientIcon(r.ingredient));
    }

    // Decor mode

    endArrange() {
      if (!this.scene.editing) return;
      this.scene.editing = null;
      this.dragPiece = null;
      if (this.panelVisible() && (this.panels.tab === 'decor' || this.panels.tab === 'kitchen')) this.panels.render();
    }
    // Arranges the place you are in, or the one asked for.
    toggleArrange(view) {
      if (this.scene.fading) return;
      if (this.scene.editing) {
        this.endArrange();
        return this.updateCta();
      }
      const where = view || (this.visit || this.scene.view === 'street' ? 'out' : this.scene.view);
      const begin = () => {
        this.scene.editing = { selected: null, ghost: null };
        this.panels.open('kitchen', { bag: 'furniture' });
        this.panels.showBag();
        this.updateCta();
      };
      if (this.visit || this.scene.view !== where) this.walkTo(where, begin);
      else begin();
    }
    // Yard pieces go outside, everything else goes in the room.
    pickFromBag(id) {
      if (this.scene.fading) return;
      const where = WW.DECOR_BY_ID[id].kind === 'yard' ? 'out' : 'in';
      const begin = () => {
        const sc = this.scene;
        if (!sc.editing) sc.editing = { selected: null, ghost: null, auto: true };
        sc.editing.selected = null;
        // It starts where you are looking, and follows the pointer from there.
        const spot = sc.toWorld(sc.css.w / 2, sc.css.h * 0.7);
        const tile = where === sc.view ? sc.tileAt(spot.x, spot.y) : where === 'out' ? { col: WW.OUTSIDE.MID + 8, row: 18 } : { col: 0, row: 2 };
        sc.editing.ghost = { id, x: tile.col, y: tile.row, fromBag: true, bad: !!E.canPlace(this.s, id, tile.col, tile.row) };
        if (!this.desktop()) {
          this.setPanelOpen(false);
          this.toast('Tap a tile to place it.');
        }
        this.updateCta();
        if (this.panelVisible()) this.panels.render();
      };
      if (this.visit || this.scene.view !== where) this.walkTo(where, begin);
      else begin();
    }
    // Lets go of the piece in hand and stays in Arrange, so something else can be moved. Nothing changes place.
    cancelHeld() {
      const ed = this.scene.editing;
      if (!ed || !ed.ghost) return;
      ed.selected = null;
      ed.ghost = null;
      ed.auto = false;
      this.dragPiece = null;
      this.sound('tap');
      this.updateCta();
      if (this.panelVisible()) this.panels.render();
    }
    storeSelected() {
      const ed = this.scene.editing;
      if (!ed || !ed.selected) return;
      E.storeDecor(this.s, ed.selected);
      ed.selected = null;
      ed.ghost = null;
      this.seatsChanged();
      this.afterAction();
      this.updateCta();
      this.panels.render();
    }
    seatsChanged() {
      // Anyone whose seat or table has gone stands up and leaves politely. Everyone else stays put.
      const key = (st) => `${st.x},${st.y},${st.table.x},${st.table.y}`;
      const seats = new Set(E.seatsOf(this.s).map(key));
      for (const g of this.scene.guests) {
        if (!g.seat || seats.has(key(g.seat))) continue;
        this.scene.seatUse.delete(g.seat.x + ',' + g.seat.y);
        g.seat = null;
        g.plate = null;
        g.bubble = null;
        g.state = 'leave';
        g.path = this.scene.leavePath();
      }
    }
    arrangeTap(col, row, item) {
      const ed = this.scene.editing;
      const s = this.s;
      if (ed.ghost && ed.ghost.fromBag) {
        const err = E.placeDecor(s, ed.ghost.id, col, row);
        if (err) return this.toast(err, 'bad');
        this.sound('plate');
        if (!s.bag[ed.ghost.id]) ed.ghost = null;
        if (!ed.ghost && ed.auto) this.scene.editing = null;
        this.seatsChanged();
        this.afterAction();
        this.updateCta();
        if (this.panelVisible()) this.panels.render();
        return;
      }
      if (ed.selected && !(item && item === ed.selected)) {
        const err = E.moveDecor(s, ed.selected, col, row);
        if (err) return this.toast(err, 'bad');
        this.sound('plate');
        ed.selected = null;
        ed.ghost = null;
        this.seatsChanged();
        this.afterAction();
        this.updateCta();
        if (this.panelVisible()) this.panels.render();
      }
    }

    // Overlays

    enqueue(fn) {
      this.queue.push(fn);
    }
    pumpQueue() {
      if (this.landing.open || document.getElementById('overlay').classList.contains('show')) return;
      const next = this.queue.shift();
      if (next) next();
    }
    showTicket(...kids) {
      const ov = document.getElementById('overlay');
      this.hideTip();
      const opts = kids[0] && kids[0].ticketClass ? kids.shift() : null;
      ov.replaceChildren(el('div', { class: 'ticket ' + (opts ? opts.ticketClass : '') }, ...kids));
      ov.classList.add('show');
    }
    closeOverlay() {
      this.walletTicket = null;
      document.getElementById('overlay').classList.remove('show');
      this.pumpQueue();
    }
    actions(...buttons) {
      return el('div', { class: 'actions' }, ...buttons);
    }
    toast(text, kind, canvas, ms = 3000) {
      const box = document.getElementById('toasts');
      const n = el('div', { class: 'toast ' + (kind || '') }, canvas ? img(canvas, '', '') : null, text);
      box.append(n);
      while (box.children.length > 3) box.firstChild.remove();
      setTimeout(() => n.remove(), ms);
    }

    // Back to a restaurant from the landing page. Whatever the clock owes is worked out on the next tick.
    afterLanding() {
      this.noteVisit();
      this.last = performance.now();
      this.fit();
      this.updateHud();
      this.updateMusic();
      this.pumpQueue();
    }
    // For the counts of how many come back, by how long ago the restaurant opened. Nothing about who.
    noteVisit() {
      if (!this.s || this.practice) return;
      this.count.daily('active');
      const days = (Date.now() - this.s.created) / 86400000;
      for (const n of [1, 3, 7, 14, 30]) if (days >= n) this.count.once('back_' + n);
    }
    showWelcome() {
      this.showTicket(
        el('h2', null, 'First time here?'),
        el('p', null, 'Try the practice kitchen. A pretend hamster runs and sleeps when the lesson asks, so you can see how everything works in a few minutes.'),
        el('p', { class: 'note', style: 'margin-top:6px' }, 'Nothing there counts and nothing is saved.'),
        el('p', { style: 'margin:8px 0 0;text-align:center' }, btn('I have a save code', () => this.showLoadCode(), 'plain small')),
        this.actions(
          btn('Skip, I have played before', () => {
            this.sound('tap');
            this.count.once('lesson_declined');
            this.showIntro();
          }, 'plain'),
          btn('Start practice', () => {
            this.sound('tap');
            this.startPractice();
          }, 'tomato')
        )
      );
    }
    startPractice() {
      this.count.once('lesson_started');
      if (this.landing.open) this.landing.hide();
      new WW.Practice(this).begin();
    }

    showIntro() {
      const state = { name: 'Bean', shop: WW.tr('The Tiny Table'), fur: 'golden', hat: 'toque' };
      const draw = () => {
        const furs = Object.keys(WW.FURS).map((f) =>
          el('button', { class: 'swatch' + (state.fur === f ? ' on' : ''), type: 'button', tip: { title: WW.FURS[f].n, lines: [] }, on: { click: () => { state.fur = f; draw(); } } }, img(WW.hamsterPose({ fur: f, hat: state.hat, job: 'chef' }, 0), '', WW.FURS[f].n))
        );
        this.showTicket(
          el('div', { class: 'logo' }, 'Squeekerant'),
          el('p', { style: 'margin:8px 0' }, 'A tiny restaurant in the woods. Your hamster runs the kitchen. A real hamster named Squeektoshi runs the wheel that powers it.'),
          el('p', { class: 'note' }, 'When he runs, guests walk in and the woks fire. When he sleeps, the pots simmer and he dreams up new dishes.'),
          el('div', { class: 'sec' }, el('h3', null, 'Your head chef'), el('input', { id: 'introName', type: 'text', maxlength: 14, value: state.name, 'aria-label': 'Hamster name', on: { input: (e) => (state.name = e.target.value) } })),
          el('div', { class: 'sec' }, el('div', { class: 'swatches' }, furs)),
          el('div', { class: 'sec' }, el('h3', null, 'Your restaurant'), el('input', { id: 'introShop', type: 'text', maxlength: 22, value: state.shop, 'aria-label': 'Restaurant name', on: { input: (e) => (state.shop = e.target.value) } })),
          this.actions(btn('Open the doors', () => this.startNew(state), 'tomato'))
        );
      };
      draw();
    }
    startNew(st) {
      const t = this.now();
      this.s = E.newGame(t, this.feed, { name: st.name.trim() || 'Bean', shop: st.shop.trim() || WW.tr('The Tiny Table'), fur: st.fur, hat: st.hat });
      this.s.soundOn = this.sfx.on;
      this.dirty = true;
      if (this.landing.open) this.landing.hide();
      document.getElementById('overlay').classList.remove('show');
      this.sound('wake');
      this.afterLoad();
      this.autosave(true);
      this.count.once('opened');
      this.noteVisit();
      // An empty room looks broken to someone who has just arrived, and most of the day he is asleep.
      if (this.live.state !== 'quiet') return;
      if (!this.alerts.offered()) return this.toast("He's asleep, so nobody comes in yet. Cook now for when he wakes.", null, WW.iconCanvas('moon'), 7000);
      this.enqueue(() => this.showAsleep());
      this.pumpQueue();
    }
    // Just opened while he sleeps: what to do until he wakes, and an offer to be told when he does.
    showAsleep() {
      this.showTicket(
        el('h2', null, "He's asleep right now"),
        el('p', null, 'Nobody comes in until he runs again. Cook now, and your restaurant serves on its own when he does, even with the game closed.'),
        el('p', { class: 'note', style: 'margin-top:6px' }, 'An alert can tell you when he wakes up, with the dream he had.'),
        this.actions(
          btn('Not now', () => this.closeOverlay(), 'plain'),
          btn('Tell me when he wakes up', () => {
            this.closeOverlay();
            this.alerts.turnOn();
          }, 'tomato')
        )
      );
    }

    showChefEditor() {
      const s = this.s;
      const draw = () => {
        const hats = Object.keys(WW.HATS).filter((h) => s.level >= WW.HATS[h].lvl).map((h) =>
          el('button', { class: 'swatch' + (s.chef.hat === h ? ' on' : ''), type: 'button', tip: { title: WW.HATS[h].n, lines: [] }, on: { click: () => { s.chef.hat = h; this.dirty = true; draw(); } } }, img(WW.hamsterPose({ fur: s.chef.fur, hat: h, job: 'chef' }, 0), '', WW.HATS[h].n))
        );
        const furs = Object.keys(WW.FURS).map((f) =>
          el('button', { class: 'swatch' + (s.chef.fur === f ? ' on' : ''), type: 'button', tip: { title: WW.FURS[f].n, lines: [] }, on: { click: () => { s.chef.fur = f; this.dirty = true; draw(); } } }, img(WW.hamsterPose({ fur: f, hat: s.chef.hat, job: 'chef' }, 0), '', WW.FURS[f].n))
        );
        this.showTicket(
          el('h2', null, 'Your head chef'),
          el('input', { id: 'chefName', type: 'text', maxlength: 14, value: s.chef.name, 'aria-label': 'Hamster name', on: { input: (e) => { s.chef.name = e.target.value.trim() || 'Bean'; this.dirty = true; } } }),
          el('div', { class: 'sec' }, el('h3', null, 'Fur'), el('div', { class: 'swatches' }, furs)),
          el('div', { class: 'sec' }, el('h3', null, 'Hat (more come with levels)'), el('div', { class: 'swatches' }, hats)),
          el('div', { class: 'sec' }, el('h3', null, 'Restaurant name'), el('input', { id: 'shopName', type: 'text', maxlength: 22, value: s.shop, 'aria-label': 'Restaurant name', on: { input: (e) => { s.shop = e.target.value.trim() || WW.tr('The Tiny Table'); this.dirty = true; } } })),
          this.actions(btn('Done', () => { this.closeOverlay(); this.panels.render(); }))
        );
      };
      draw();
    }

    showReceipt(r) {
      const lines = [];
      const add = (a, b) => lines.push(el('div', { class: 'line' }, a, el('b', { class: 'tabnum' }, b)));
      add('He ran', `${fmt(r.work)} passes in ${r.active} round${r.active === 1 ? '' : 's'}`);
      add('He rested', `${r.quiet} round${r.quiet === 1 ? '' : 's'}`);
      if (r.unknown) add('No signal', `${r.unknown} round${r.unknown === 1 ? '' : 's'}`);
      add('Guests fed', fmt(r.served));
      if (r.soldOut) add('Left hungry (sold out)', fmt(r.soldOut));
      if (r.full) add('Left (no seats)', fmt(r.full));
      if (r.tired) add('Left (staff too tired)', fmt(r.tired));
      add('Cash earned', fmt(r.banked));
      add('Winks gained', fmt(r.winkGain));
      if (r.swaps && r.swaps.length) add('Swapped on your shelf', fmt(r.swaps.length));
      if (r.offers) add('New offers in your mailbox', fmt(r.offers));
      const dishes = r.jobs.map((j) => E.dishDef(j.dish));
      const newOnes = r.newSpecies.map((id) => WW.ANIMAL[id]);
      this.showTicket(
        { ticketClass: 'receipt' },
        el('h2', null, 'While you were away'),
        lines,
        dishes.length ? el('div', { class: 'sec' }, el('h3', null, 'Finished cooking'), el('div', { class: 'grid' }, dishes.map((d) => el('div', { class: 'cell food', tip: () => WW.tips.dish(d, this.s) }, WW.dishImg(d))))) : null,
        newOnes.length ? el('div', { class: 'sec' }, el('h3', null, `New guests: ${newOnes.length}`), el('div', { class: 'grid' }, newOnes.slice(0, 18).map((a) => el('div', { class: 'cell ' + a.rar, tip: () => WW.tips.species(a, this.s) }, img(WW.animalFrames(a)[0], '', a.n), el('span', { class: 'cap' }, a.n))))) : null,
        r.soldOut > r.served ? el('p', { class: 'note', style: 'margin-top:8px' }, 'The counter ran out early. Longer dishes make more portions, so cook those before you leave.') : null,
        r.full > r.served / 3 ? el('p', { class: 'note', style: 'margin-top:8px' }, 'Guests left for lack of seats. More tables and chairs, or a bigger room, would catch them.') : null,
        this.actions(btn('Back to the kitchen', () => this.closeOverlay()))
      );
      this.sound('bank');
    }

    // again: back from sharing it, without the fanfare.
    showDream(d, again) {
      const def = E.dishDef(d.key);
      const hrs = (d.sleptRounds / 6).toFixed(1);
      if (!again) this.sound('dream');
      if (!this.practice) this.count.once('first_dream');
      // Seen soon after he woke, the server is told to look too, so the alerts go out sooner.
      if (!again && !this.practice && this.feed.mode === 'live' && this.s.dreamDish) this.alerts.ping(this.s.dreamDish.round, this.feed.roundEnd(this.s.dreamDish.round - 1));
      // Sharing opens over the card, and closing the picture brings the card back with its Cook button.
      const share = () => {
        if (this.share.busy) return;
        this.queue.unshift(() => this.showDream(d, true));
        this.share.open();
      };
      const s = this.s;
      this.showTicket(
        { ticketClass: 'dreamcard' },
        el('p', { class: 'note' }, `He slept ${hrs} hours and woke at round ${fmt(s.dreamDish ? s.dreamDish.round : 0)}.`),
        el('h2', null, def.n),
        img(WW.dishIcon(def, def.gold), 'bigdish', def.n),
        el('p', null, def.gold ? 'A golden dream, which only comes after 15 hours of sleep or more. It sells for twice as much.' : 'Every player sees this same dream, picked by the hash of the round he woke on.'),
        el('p', { class: 'note', style: 'margin-top:6px' }, `Cook it ${def.st === 'pot' ? 'in the pot' : 'on the ' + def.st} for ${WW.CFG.DREAM_DISH_COST} Winks until his next long sleep. Legendary guests only come for dream dishes.`),
        s.critic.hints.length ? el('p', { class: 'note', style: 'margin-top:6px' }, `Also in the dream: ${s.critic.hints[s.critic.hints.length - 1]}`) : null,
        this.practice ? null : el('p', { class: 'note', style: 'margin-top:6px' }, WW.dreamsLink()),
        this.actions(this.practice ? null : btn('Share', share, 'plain'), btn('Good morning', () => this.closeOverlay(), 'plain'), btn('Cook it', () => { this.closeOverlay(); this.panels.cookDreamNow(); }, 'lilac'))
      );
    }

    showVerdict(v) {
      const names = v.picks.map((k) => E.dishDef(k).n);
      this.sound(v.stars ? 'level' : 'miss');
      this.showTicket(
        el('h2', null, `Sir Slowbite: ${v.stars} star${v.stars === 1 ? '' : 's'}`),
        img(WW.animalFrames(WW.ANIMAL.tortoise)[0], 'critter', 'Sir Slowbite'),
        el('p', { class: 'stars', style: 'font-size:34px;text-align:center' }, '*'.repeat(v.stars) || '.'),
        v.notes.map((n) => el('p', { style: 'margin:4px 0' }, n)),
        names.length ? el('p', { class: 'note' }, `He tasted: ${names.join(', ')}.`) : null,
        el('p', { class: 'note', style: 'margin-top:6px' }, `He likes ${WW.FLAVOURS[v.taste[0]].n.toLowerCase()} and ${WW.FLAVOURS[v.taste[1]].n.toLowerCase()} dishes. The dish he missed most was ${WW.DISH[v.memory].n}.`),
        v.reward ? el('p', null, `Reward: ${money(v.reward)}.`) : null,
        this.actions(btn('Back to the kitchen', () => this.closeOverlay()))
      );
    }

    showQuiz() {
      const quiz = E.quizFor(this.s, this.feed, this.now());
      if (!quiz) return this.toast('Answered today. A new question comes tomorrow.');
      this.showTicket(
        el('h2', null, 'Daily question'),
        el('p', { style: 'margin:6px 0 10px' }, quiz.q),
        quiz.opts.map((o, i) =>
          el('div', null, btn(o, () => {
            const r = E.answerQuiz(this.s, quiz, i, this.now());
            this.afterAction();
            this.sound(r.right ? 'new' : 'miss');
            this.showTicket(
              el('h2', null, r.right ? 'Correct!' : 'Not quite.'),
              el('p', { class: 'note' }, quiz.note),
              r.right ? el('p', { style: 'margin-top:6px' }, `You got ${WW.INGREDIENT[r.gift].n} x${r.n}.`) : el('p', { style: 'margin-top:6px' }, `The answer was: ${quiz.opts[quiz.answer]}.`),
              this.actions(btn('Back', () => { this.closeOverlay(); if (this.panels.tab === 'orders') this.panels.render(); }))
            );
          }, 'plain'))
        ),
        this.actions(btn('Later', () => this.closeOverlay(), 'plain'))
      );
    }

    confirmReset() {
      this.showTicket(el('h2', null, 'Start over?'), el('p', null, 'This deletes your restaurant, guest book and recipes on this device.'), this.actions(btn('Keep it', () => this.closeOverlay(), 'plain'), btn('Delete and start over', () => this.reset(), 'tomato')));
    }
    reset() {
      if (this.practice) return;
      try {
        localStorage.removeItem(SAVE_KEY);
      } catch (e) {}
      if (this.cloudDoc) this.cloudDoc.delete().catch(() => {});
      this.s = null;
      this.visit = null;
      // Cards still waiting belong to the restaurant that is gone.
      this.queue = [];
      this.scene.reset();
      this.scene.fading = null;
      if (this.feed.mode === 'held') this.feed = new WW.RecordingFeed(WW.RECORDING);
      this.feed.offset = 0;
      this.landing.show(true);
      this.showIntro();
    }
  }

  WW.Game = Game;
  const start = (data) => {
    const game = new Game();
    WW.game = game;
    game.boot(data || {});
  };
  const hot = globalThis.window && window.claude && window.claude.hot;
  if (hot && hot.ready) hot.ready(start);
  else start((hot && hot.data) || {});
})((globalThis.WW = globalThis.WW || {}));
