// Connecting a wallet puts your restaurant on the leaderboard. It only ever signs a message: no fee, no transaction.
// The board lives on the server and only lists wallets that proved they are theirs. Everything else in the game stays in the browser.
(function (WW) {
  const KEY = 'squeekerant-wallet';
  const BOARD_EVERY = 5 * 60000;
  const LEVEL_EVERY = 60000;
  const SCORE_EVERY = 10 * 60000;

  const legacyName = (p) => (p.isRabby ? 'Rabby' : p.isBraveWallet ? 'Brave Wallet' : p.isCoinbaseWallet ? 'Coinbase Wallet' : p.isTrust || p.isTrustWallet ? 'Trust Wallet' : p.isOkxWallet || p.isOKExWallet ? 'OKX Wallet' : p.isMetaMask ? 'MetaMask' : 'Browser wallet');

  // Wallets are outside the game. Their answers are read with care and never trusted as markup.
  const askJson = async (path, opt) => {
    const res = await fetch(path, Object.assign({ signal: AbortSignal.timeout(10000) }, opt));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || 'The leaderboard cannot be reached right now.');
      err.status = res.status;
      throw err;
    }
    return data;
  };
  const postJson = (path, body, token) =>
    askJson(path, {
      method: 'POST',
      headers: Object.assign({ 'content-type': 'application/json' }, token ? { authorization: 'Bearer ' + token } : {}),
      body: JSON.stringify(body),
    });

  class Wallet {
    constructor() {
      this.found = new Map();
      this.address = null;
      this.token = null;
      this.board = null;
      this.boardAt = 0;
      this.boardBusy = false;
      this.boardFailed = false;
      this.mine = null;
      this.sent = null;
      this.sentAt = 0;
      this.sending = false;
      this.run = 0;
      this.onChange = null;
      // The Artifact viewer has no network and no wallet. There the board simply points to the real site.
      this.usable = !globalThis.claude && typeof fetch === 'function';
      if (!this.usable || typeof addEventListener !== 'function') return;
      try {
        const saved = JSON.parse(localStorage.getItem(KEY));
        if (saved && /^0x[0-9a-fA-F]{40}$/.test(saved.address) && saved.token) {
          this.address = saved.address;
          this.token = saved.token;
        }
      } catch (e) {}
      addEventListener('eip6963:announceProvider', (e) => {
        const d = e.detail;
        if (!d || !d.info || !d.provider || typeof d.provider.request !== 'function') return;
        this.found.set(d.info.rdns || d.info.uuid || d.info.name, d);
        this.changed();
      });
      this.lookAround();
    }
    changed() {
      if (this.onChange) this.onChange();
    }
    lookAround() {
      if (typeof dispatchEvent === 'function' && typeof Event === 'function') dispatchEvent(new Event('eip6963:requestProvider'));
    }
    // Every wallet in this browser. Newer ones introduce themselves, older ones only set window.ethereum.
    list() {
      if (this.found.size) return Array.from(this.found.values());
      const eth = globalThis.ethereum;
      if (!eth) return [];
      return (Array.isArray(eth.providers) && eth.providers.length ? eth.providers : [eth]).map((p) => ({ info: { name: legacyName(p) }, provider: p }));
    }
    connected() {
      return !!(this.address && this.token);
    }
    // A wallet may never answer, so picking another one or closing the list simply drops this attempt.
    async connect(entry) {
      const run = ++this.run;
      const live = () => run === this.run;
      const eth = entry.provider;
      const accounts = await eth.request({ method: 'eth_requestAccounts' });
      if (!live()) return false;
      const address = accounts && accounts[0];
      if (!address) throw new Error('This wallet did not share an account.');
      const ticket = await postJson('/api/wallet/ticket', { address });
      if (!live()) return false;
      // The wallet only ever signs our own sign in message for this address, whatever the server sends.
      const lines = String(ticket.message).split('\n');
      if (lines[0] !== `${location.host} wants you to sign in with your Ethereum account:` || String(lines[1]).toLowerCase() !== address.toLowerCase() || !ticket.message.includes('This costs nothing and sends no transaction.')) throw new Error('The sign in message looks wrong, so nothing was signed.');
      const hex = '0x' + Array.from(new TextEncoder().encode(ticket.message), (b) => b.toString(16).padStart(2, '0')).join('');
      const signature = await eth.request({ method: 'personal_sign', params: [hex, address] });
      if (!live()) return false;
      const done = await postJson('/api/wallet/verify', { ticket: ticket.ticket, signature });
      if (!live()) return false;
      this.address = done.wallet;
      this.token = done.token;
      this.sent = null;
      this.sentAt = 0;
      this.mine = null;
      this.keep();
      this.changed();
      return true;
    }
    cancel() {
      this.run++;
    }
    keep() {
      try {
        if (this.connected()) localStorage.setItem(KEY, JSON.stringify({ address: this.address, token: this.token }));
        else localStorage.removeItem(KEY);
      } catch (e) {}
    }
    disconnect() {
      this.run++;
      this.address = null;
      this.token = null;
      this.mine = null;
      this.sent = null;
      this.keep();
      this.changed();
    }
    // The board comes from the server now and then. Vercel caches the reply, so this rarely reaches the database.
    async refreshBoard(force) {
      if (!this.usable || this.boardBusy) return;
      const now = Date.now();
      if (!force && this.board && now - this.boardAt < BOARD_EVERY) return;
      if (!force && this.boardFailed && now - this.boardAt < LEVEL_EVERY) return;
      this.boardBusy = true;
      this.boardAt = now;
      try {
        const data = await askJson('/api/board');
        if (!Array.isArray(data.rows)) throw new Error('No board in that reply.');
        this.board = { open: !!data.open, rows: data.rows, total: Number(data.total) || 0 };
        this.boardFailed = false;
      } catch (e) {
        this.boardFailed = true;
      } finally {
        this.boardBusy = false;
        this.changed();
      }
    }
    // The board as this player should see it: what the server had, with their own latest score already in place.
    rows() {
      const rows = this.board ? this.board.rows.slice() : [];
      const me = this.address && this.address.toLowerCase();
      const at = rows.findIndex((r) => String(r.wallet).toLowerCase() === me);
      if (this.mine) {
        const fresh = Object.assign({}, this.mine, { wallet: this.address });
        if (at >= 0) rows.splice(at, 1);
        let place = rows.findIndex((r) => r.total < fresh.total);
        if (place < 0) place = rows.length;
        rows.splice(place, 0, fresh);
      }
      // Further down than the part of the board the server sends: the place is the one the server worked out.
      const deep = this.mine && this.mine.rank > rows.length ? this.mine.rank : 0;
      return rows.map((r, i) => {
        const mine = !!me && String(r.wallet).toLowerCase() === me;
        return Object.assign({}, r, { place: mine && deep ? deep : i + 1, me: mine });
      });
    }
    // How this player stands, or null when they are not on the board yet.
    standing() {
      if (!this.connected()) return null;
      const row = this.rows().find((r) => r.me);
      if (!row) return null;
      return { place: row.place, total: Math.max(row.place, this.mine ? this.mine.everyone || 0 : 0, this.board ? this.board.total : 0) };
    }
    // What the board shows for a save.
    scoreOf(s, E) {
      return { shop: s.shop, chef: s.chef.name, fur: s.chef.fur, hat: s.chef.hat, level: s.level, xp: Math.floor(s.xp), house: E.roomLevel(s.room).level };
    }
    // Called often. Sends right after connecting, soon after a new level, and otherwise rarely so the database can rest.
    tick(s, E, liveWheel) {
      if (!this.usable || !this.connected() || !s || !liveWheel || this.sending) return;
      const score = this.scoreOf(s, E);
      const key = JSON.stringify(score);
      if (this.sent && this.sent.key === key) return;
      const elapsed = Date.now() - this.sentAt;
      const newLevel = !this.sent || this.sent.level !== score.level;
      if (elapsed < (newLevel ? LEVEL_EVERY : SCORE_EVERY)) return;
      this.send(score, key);
    }
    async send(score, key) {
      this.sending = true;
      this.sentAt = Date.now();
      try {
        const out = await postJson('/api/score', score, this.token);
        this.sent = { key, level: score.level };
        // What the server keeps is this wallet's best restaurant, which may not be the one being played now.
        if (out.accepted) this.mine = Object.assign({}, out.row, { rank: out.rank, everyone: out.total });
        this.changed();
      } catch (e) {
        // The session ran out. Connecting again signs a new one, and the board keeps the restaurant meanwhile.
        if (e.status === 401) {
          this.token = null;
          this.keep();
          this.expired = true;
          this.changed();
        }
      } finally {
        this.sending = false;
      }
    }
  }
  WW.Wallet = Wallet;
})((globalThis.WW = globalThis.WW || {}));
