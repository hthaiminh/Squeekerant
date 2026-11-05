// Where the hamster's data comes from. Two sources behind one interface:
// RecordingFeed replays his real rounds and passes on a loop that keeps the time of day (used in the
// Artifact, which has no network), LiveFeed reads the official API and SqueekCore when the network is there.
(function (WW) {
  const ROUND_MS = 600000;
  const SETTLE_LAG_MS = 40000;
  const QUIET_AFTER_MS = 600000;
  const RUN_GAP_MS = 5000;

  const B64 = {};
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.split('').forEach((c, i) => (B64[c] = i));

  function decodePasses(first, gaps) {
    const out = [first];
    let t = first;
    for (let i = 0; i < gaps.length; ) {
      let cs;
      if (gaps[i] === '~') {
        const end = gaps.indexOf('~', i + 1);
        cs = parseInt(gaps.slice(i + 1, end), 36);
        i = end + 1;
      } else {
        cs = B64[gaps[i]] * 64 + B64[gaps[i + 1]];
        i += 2;
      }
      t += cs * 10;
      out.push(t);
    }
    return Float64Array.from(out);
  }

  function lowerBound(arr, x) {
    let lo = 0;
    let hi = arr.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (arr[m] <= x) lo = m + 1;
      else hi = m;
    }
    return lo; // how many entries are <= x
  }

  class RecordingFeed {
    constructor(rec) {
      this.mode = 'recording';
      this.rec = rec;
      this.genesisMs = rec.genesis * 1000;
      this.base = rec.startRound;
      this.len = rec.length;
      this.passes = decodePasses(rec.firstPassMs, rec.gaps);
      this.work = new Int32Array(rec.length);
      this.hash = new Array(rec.length).fill(null);
      for (const [r, w, h] of rec.rounds) {
        this.work[r - this.base] = w;
        this.hash[r - this.base] = h;
      }
      this.unknown = new Set(rec.unknown || []);
      this.prefix = new Int32Array(rec.length + 1);
      for (let i = 0; i < rec.length; i++) this.prefix[i + 1] = this.prefix[i] + this.work[i];
      this.total = this.prefix[rec.length];
      this.mmPerPass = rec.distancePerPassMm || 878;
      this.offset = 0;
      this.loopMs = rec.length * ROUND_MS;
      // The real rounds are replayed only from this point on, so nothing feels pre-empted.
      this.originMs = this.genesisMs + (this.base - 1) * ROUND_MS;
    }
    now() {
      return Date.now() + this.offset;
    }
    roundAt(t) {
      return Math.floor((t - this.genesisMs) / ROUND_MS) + 1;
    }
    roundEnd(r) {
      return this.genesisMs + r * ROUND_MS;
    }
    settled(t) {
      return Math.floor((t - this.genesisMs - SETTLE_LAG_MS) / ROUND_MS);
    }
    _map(r) {
      const i = r - this.base;
      const k = Math.floor(i / this.len);
      return { k, i: i - k * this.len };
    }
    // One settled round: work, running total, data hash, and whether its record is missing.
    round(r) {
      const { k, i } = this._map(r);
      const work = this.work[i];
      const h = this.hash[i];
      const unknown = this.unknown.has(this.base + i);
      return {
        r,
        work,
        cum: k * this.total + this.prefix[i + 1],
        hash: h ? (k === 0 ? h : h + k.toString(16)) : null,
        unknown,
      };
    }
    hashBefore(r) {
      for (let q = r; q > r - this.len; q--) {
        const { k, i } = this._map(q);
        if (this.hash[i]) return k === 0 ? this.hash[i] : this.hash[i] + k.toString(16);
      }
      return 'none';
    }
    workBetween(r0, r1) {
      let w = 0;
      for (let r = r0; r <= r1; r++) w += this.round(r).work;
      return w;
    }
    _loopTime(t) {
      const d = t - this.originMs;
      const k = Math.floor(d / this.loopMs);
      return { k, tt: this.originMs + (d - k * this.loopMs) };
    }
    // What the wheel is doing right now, before anything has settled.
    live(t) {
      const { k, tt } = this._loopTime(t);
      const n = lowerBound(this.passes, tt);
      const last = n > 0 ? this.passes[n - 1] : -Infinity;
      const ago = tt - last;
      const r = this.roundAt(t);
      const unknown = this.round(r).unknown;
      let rpm = 0;
      if (ago < RUN_GAP_MS && n >= 8) rpm = (60000 * 7) / (this.passes[n - 1] - this.passes[n - 8]);
      return {
        state: unknown ? 'unknown' : ago < RUN_GAP_MS ? 'running' : ago < QUIET_AFTER_MS ? 'breather' : 'quiet',
        rpm: Math.round(rpm),
        cum: k * this.total + n,
        agoMs: ago,
        round: r,
      };
    }
    // Passes between two moments, for the carousel. Times are real page time on this loop.
    passesBetween(t0, t1) {
      const a = this._loopTime(t0);
      const b = this._loopTime(t1);
      if (a.k !== b.k) return 0;
      return lowerBound(this.passes, b.tt) - lowerBound(this.passes, a.tt);
    }
    // Finds the latest sprint session before t that lasted long enough to play, for the replay.
    lastSession(t, minPasses = 120) {
      const { tt } = this._loopTime(t);
      let end = lowerBound(this.passes, tt) - 1;
      if (end < 0) end = this.passes.length - 1;
      for (let guard = 0; guard < 40 && end > 0; guard++) {
        let start = end;
        while (start > 0 && this.passes[start] - this.passes[start - 1] < 60000) start--;
        if (end - start >= minPasses) return { startMs: this.passes[start], endMs: this.passes[end], passes: end - start + 1 };
        end = start - 1;
      }
      return null;
    }
    // Real pass times of a replay, offset from zero.
    sessionPasses(session) {
      const a = lowerBound(this.passes, session.startMs - 1);
      const b = lowerBound(this.passes, session.endMs);
      return Array.from(this.passes.subarray(a, b), (x) => x - session.startMs);
    }
    // Real time of the first pass of a round on this loop.
    firstPassTime(r) {
      const { k, i } = this._map(r);
      const start = this.originMs + i * ROUND_MS;
      const n = lowerBound(this.passes, start);
      return (n < this.passes.length ? this.passes[n] : start) + k * this.loopMs;
    }
    // Next moment he starts running, or stops, used by the test clock.
    nextChange(t, wantRunning) {
      const r0 = this.roundAt(t);
      for (let r = r0 + 1; r < r0 + this.len + 2; r++) {
        const { i } = this._map(r);
        const running = this.work[i] > 0;
        const prev = this.work[this._map(r - 1).i] > 0;
        if (wantRunning && running && !prev) return this.firstPassTime(r) - 1000;
        if (!wantRunning && !running && prev) return this.genesisMs + (r - 1) * ROUND_MS + 60000;
      }
      return t + ROUND_MS;
    }
    // Just after the first round of the next wake settles, which is when his dream appears.
    nextWake(t, minQuietRounds = 60) {
      const r0 = this.roundAt(t);
      let streak = 0;
      for (let r = r0; r < r0 + this.len + 2; r++) {
        const { i } = this._map(r);
        if (this.work[i] > 0) {
          if (streak >= minQuietRounds && r > r0) return this.roundEnd(r) + SETTLE_LAG_MS + 2000;
          streak = 0;
        } else streak++;
      }
      return t + ROUND_MS;
    }
    describe() {
      const from = new Date(this.originMs).toISOString().slice(0, 10);
      const to = new Date(this.originMs + this.loopMs - 1).toISOString().slice(0, 10);
      return `Replaying Squeektoshi's real rounds from ${from} to ${to}, keeping the time of day.`;
    }
  }

  // Public nodes that answer a browser, by chain. The wheel says which chain it is on.
  const NODES = {
    11155111: ['https://ethereum-sepolia-rpc.publicnode.com', 'https://sepolia.gateway.tenderly.co'],
    1: ['https://ethereum-rpc.publicnode.com', 'https://eth.drpc.org'],
  };

  // What never changes for one installation of the wheel. /core depends on an indexer that drops out for a few seconds many times an
  // hour, so it is only asked about an installation that is not listed here. /status keeps working and says which one is running.
  const KNOWN_WHEELS = {
    'sepolia-core-sepolia-20261103': { core: '0xfd6c166d4b8e2962e65746a13e5a0797cd4de0c4', chainId: '11155111', genesis: 1793735400 },
  };

  // Reads the official API for the live state, and SqueekCore for settled rounds.
  class LiveFeed {
    constructor(boot) {
      this.mode = 'live';
      this.genesisMs = boot.genesis * 1000;
      this.core = boot.core;
      this.rpcs = boot.rpcs;
      this.installation = boot.installation;
      this.status = boot.status;
      this.settledRound = boot.settled;
      this.roundsKnown = new Map();
      this.cumAt = new Map();
      this.frontierCum = boot.work;
      this.lastActive = { r: 0, hash: 'none' };
      this.mmPerPass = 878;
      this.offset = 0;
      this.rpmHistory = [];
      this.liveCum = Number(boot.status.measurement.cumulativeWorkUnits);
      this.lastSeenAt = Date.now();
      this.lastPassAt = 0;
      this.anchorCum = boot.work;
      this.anchorRound = boot.settled;
    }
    static async connect() {
      const API = 'https://api.squeekchain.com/v1';
      const timed = (url, opt) => fetch(url, Object.assign({ signal: AbortSignal.timeout(6000) }, opt));
      const status = await (await timed(API + '/status')).json();
      const anchor = status.builder && status.builder.anchor;
      if (!status.measurement || !anchor) throw new Error('API unavailable');
      let wheel = KNOWN_WHEELS[status.installationId];
      if (!wheel) {
        const coreInfo = await (await timed(API + '/core')).json();
        if (coreInfo.status === 'unavailable') throw new Error('API unavailable');
        wheel = { core: coreInfo.identities.core, chainId: coreInfo.chain.chainId, genesis: Number(coreInfo.configuration.genesisTimestamp) };
      }
      const rpcs = NODES[wheel.chainId];
      if (!rpcs) throw new Error('No node for this chain.');
      const boot = {
        core: wheel.core,
        installation: status.installationId,
        genesis: wheel.genesis,
        status,
        settled: Number(anchor.settledThroughRound),
        work: Number(anchor.cumulativeWork),
        rpcs,
      };
      const feed = new LiveFeed(boot);
      feed.api = API;
      feed.timed = timed;
      return feed;
    }
    async poll() {
      if (this.polling) return;
      this.polling = true;
      try {
        const st = await (await this.timed(this.api + '/status')).json();
        // An error or an "unavailable" reply has no count in it. The last good one stands.
        const cum = Number(st.measurement && st.measurement.cumulativeWorkUnits);
        if (!Number.isFinite(cum)) throw new Error('No count in this reply.');
        // Redeployed while the page is open. The game connects again and moves across.
        if (st.installationId && st.installationId !== this.installation) {
          this.replaced = true;
          return;
        }
        this.status = st;
        if (cum > this.liveCum) this.lastPassAt = Date.now();
        this.liveCum = cum;
        const settled = Number(st.builder && st.builder.anchor && st.builder.anchor.settledThroughRound);
        if (settled > this.settledRound) await this.syncTo(settled);
        this.lastError = null;
      } catch (e) {
        this.lastError = e;
      } finally {
        this.polling = false;
      }
    }
    async call(data) {
      let failure;
      for (const rpc of this.rpcs) {
        try {
          const r = await this.timed(rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: this.core, data }, 'latest'] }) });
          const j = await r.json();
          if (j.error) throw new Error(j.error.message);
          return j.result;
        } catch (e) {
          failure = e;
        }
      }
      throw failure;
    }
    // Reads active rounds after afterRound, up to the frontier.
    async syncFrom(afterRound, through = this.settledRound) {
      const hex64 = (n) => BigInt(n).toString(16).padStart(64, '0');
      const words = (r) => r.slice(2).match(/.{64}/g) || [];
      const num = (w) => Number(BigInt('0x' + w));
      let after = afterRound;
      while (after < through) {
        const w = words(await this.call('0xc8b9e08f' + hex64(after) + hex64(through) + hex64(16)));
        const cert = num(w[1]);
        const startCum = num(w[2]);
        const endCum = num(w[5]);
        const n = num(w[9]);
        let cum = startCum;
        if (this.baseCum === undefined || after < this.baseRound) {
          this.baseCum = startCum;
          this.baseRound = after;
        }
        for (let i = 0; i < n; i++) {
          const o = 10 + i * 5;
          const r = num(w[o]);
          const c = num(w[o + 1]);
          this.roundsKnown.set(r, { r, work: c - cum, cum: c, hash: w[o + 4].slice(0, 16), unknown: false });
          cum = c;
          this.lastActive = { r, hash: w[o + 4].slice(0, 16) };
        }
        this.cumAt.set(cert, endCum);
        this.frontierCum = endCum;
        if (!n && cert >= through) break;
        const next = Math.max(cert, n ? num(w[10 + (n - 1) * 5]) : after);
        // A node behind the chain has nothing more for now. Without this it would be asked again at once, for ever.
        if (next <= after) throw new Error('The node is behind the chain.');
        after = next;
      }
      if (this.readFrom === undefined || afterRound < this.readFrom) this.readFrom = afterRound;
      // Until a pass is seen live, the last one known is in the latest active round, or after it all if the running total is ahead.
      if (!this.lastPassAt) {
        const last = this.liveCum > this.frontierCum ? this.settledRound : this.lastActive.r;
        if (last) this.lastPassAt = this.roundEnd(last);
      }
    }
    // A round only counts as settled once its work has been read. Until then the game would take it for a quiet one.
    async syncTo(settled) {
      await this.syncFrom(this.settledRound, settled);
      this.settledRound = settled;
    }
    // Whether every round from r0 to r1 has been read, so a total over them is the real one.
    knows(r0, r1) {
      return this.readFrom !== undefined && r0 > this.readFrom && r1 <= this.settledRound;
    }
    now() {
      return Date.now();
    }
    roundAt(t) {
      return Math.floor((t - this.genesisMs) / ROUND_MS) + 1;
    }
    roundEnd(r) {
      return this.genesisMs + r * ROUND_MS;
    }
    settled() {
      return this.settledRound;
    }
    round(r) {
      const known = this.roundsKnown.get(r);
      if (known) return known;
      // A certified round with no record is a zero work round.
      let cum = this.baseCum === undefined ? this.anchorCum : this.baseCum;
      for (const [q, v] of this.roundsKnown) if (q <= r && v.cum > cum) cum = v.cum;
      return { r, work: 0, cum, hash: null, unknown: false };
    }
    hashBefore(r) {
      let best = null;
      for (const [q, v] of this.roundsKnown) if (q <= r && (!best || q > best.r)) best = v;
      return best ? best.hash : this.lastActive.hash;
    }
    workBetween(r0, r1) {
      let w = 0;
      for (const [q, v] of this.roundsKnown) if (q >= r0 && q <= r1) w += v.work;
      return w;
    }
    live(t) {
      const m = this.status.measurement;
      const rpm = Math.round((m.rpmMilli || 0) / 1000);
      const stale = m.freshness !== 'online' || m.coreStatus === 'COUNTER_FAULT';
      const seen = rpm > 0 || Date.now() - this.lastPassAt < RUN_GAP_MS;
      const ago = this.lastPassAt ? Date.now() - this.lastPassAt : Infinity;
      return {
        state: stale ? 'unknown' : seen ? 'running' : ago < QUIET_AFTER_MS ? 'breather' : 'quiet',
        rpm,
        cum: this.liveCum,
        agoMs: ago,
        round: this.roundAt(t),
      };
    }
    passesBetween() {
      return 0;
    }
    lastSession() {
      return null;
    }
    sessionPasses() {
      return [];
    }
    nextChange(t) {
      return t;
    }
    nextWake(t) {
      return t;
    }
    describe() {
      return 'Live from the official Squeekchain API and SqueekCore on Sepolia.';
    }
  }

  // A save on the real wheel, before the wheel can be reached. Nothing moves, and the recording is never counted into it.
  class HeldFeed extends RecordingFeed {
    constructor(rec, clock) {
      super(rec);
      this.mode = 'held';
      this.clock = clock;
    }
    now() {
      return Date.now();
    }
    settled() {
      return this.clock.round;
    }
    round(r) {
      return { r, work: 0, cum: this.clock.cum, hash: null, unknown: true };
    }
    hashBefore() {
      return this.clock.hash;
    }
    workBetween() {
      return 0;
    }
    live(t) {
      return { state: 'unknown', rpm: 0, cum: this.clock.guestN * WW.CFG.WORK_PER_GUEST, agoMs: Infinity, round: this.roundAt(t) };
    }
    passesBetween() {
      return 0;
    }
    lastSession() {
      return null;
    }
    describe() {
      return 'Waiting for the real wheel. Nothing counts, nothing is lost.';
    }
  }

  // The practice kitchen's pretend hamster. The lesson says when he runs, when he sleeps and how fast time goes.
  // He never touches the real wheel, and the rules of the game cannot tell him from the real one.
  const PRACTICE_PASSES_A_SECOND = 5;
  const PRACTICE_LINE_PASSES_A_SECOND = 1.25;
  class PracticeFeed {
    constructor(realNow = () => Date.now()) {
      this.mode = 'practice';
      this.real = realNow;
      const start = this.real();
      this.genesisMs = Math.floor(start / ROUND_MS) * ROUND_MS - 5000 * ROUND_MS;
      this.virtual = start;
      this.since = start;
      this.rate = 1;
      this.running = false;
      // Guests eat and the room empties on this clock, so a seat turns over in seconds and not minutes.
      this.pace = 30;
      this.mmPerPass = 878;
      this.offset = 0;
      this.stoppedAt = start - 40 * ROUND_MS;
      this.segments = [{ t: 0, cum: 0, perMs: 0 }];
      // One hash for every round, picked so his dream is one the practice pantry can cook.
      let n = 0;
      while (WW.hash32('practice' + n, 'dream') % WW.DREAMS.length !== 0) n++;
      this.hash = 'practice' + n;
    }
    now() {
      return this.virtual + (this.real() - this.since) * this.rate;
    }
    anchor() {
      const t = this.now();
      this.virtual = t;
      this.since = this.real();
      return t;
    }
    cumAt(t) {
      for (let i = this.segments.length - 1; i >= 0; i--) {
        const seg = this.segments[i];
        if (seg.t <= t) return seg.cum + (t - seg.t) * seg.perMs;
      }
      return 0;
    }
    // Passes come at the same speed on screen however fast the lesson runs time.
    flow(t) {
      this.segments.push({ t, cum: this.cumAt(t), perMs: this.running ? PRACTICE_PASSES_A_SECOND / 1000 / this.rate : 0 });
    }
    setRate(rate) {
      const t = this.anchor();
      this.rate = rate;
      this.flow(t);
    }
    run() {
      const t = this.anchor();
      this.running = true;
      this.flow(t);
    }
    sleep() {
      const t = this.anchor();
      this.running = false;
      this.stoppedAt = t;
      this.flow(t);
    }
    // Time jumps forward and he does nothing during the jump, so no pile of guests arrives at once.
    jump(ms) {
      const t = this.anchor();
      const cum = this.cumAt(t);
      this.segments.push({ t, cum, perMs: 0 });
      this.virtual = t + ms;
      this.segments.push({ t: t + ms, cum, perMs: this.running ? PRACTICE_PASSES_A_SECOND / 1000 / this.rate : 0 });
    }
    finishRound() {
      const t = this.now();
      this.jump(this.roundEnd(this.roundAt(t)) + SETTLE_LAG_MS + 50 - t);
    }
    roundAt(t) {
      return Math.floor((t - this.genesisMs) / ROUND_MS) + 1;
    }
    roundEnd(r) {
      return this.genesisMs + r * ROUND_MS;
    }
    settled(t) {
      return Math.floor((t - this.genesisMs - SETTLE_LAG_MS) / ROUND_MS);
    }
    round(r) {
      const before = Math.floor(this.cumAt(this.roundEnd(r - 1)));
      const after = Math.floor(this.cumAt(this.roundEnd(r)));
      return { r, work: after - before, cum: after, hash: after > before ? this.hash : null, unknown: false };
    }
    hashBefore() {
      return this.hash;
    }
    workBetween(r0, r1) {
      return Math.floor(this.cumAt(this.roundEnd(r1))) - Math.floor(this.cumAt(this.roundEnd(r0 - 1)));
    }
    live(t) {
      const ago = this.running ? 0 : t - this.stoppedAt;
      return {
        state: this.running ? 'running' : ago < QUIET_AFTER_MS ? 'breather' : 'quiet',
        rpm: this.running ? 72 : 0,
        cum: Math.floor(this.cumAt(t)),
        agoMs: ago,
        round: this.roundAt(t),
      };
    }
    // The carousel turns at his real speed, so the quick game feels the way it really does.
    passesBetween(t0, t1) {
      if (!this.running) return 0;
      const k = PRACTICE_LINE_PASSES_A_SECOND / 1000 / this.rate;
      return Math.floor(t1 * k) - Math.floor(t0 * k);
    }
    lastSession() {
      return null;
    }
    sessionPasses() {
      return [];
    }
    nextChange(t) {
      return t;
    }
    nextWake(t) {
      return t;
    }
    describe() {
      return 'A pretend hamster for the practice kitchen. Nothing here counts.';
    }
  }

  WW.RecordingFeed = RecordingFeed;
  WW.LiveFeed = LiveFeed;
  WW.HeldFeed = HeldFeed;
  WW.PracticeFeed = PracticeFeed;
  WW.ROUND_MS = ROUND_MS;
})((globalThis.WW = globalThis.WW || {}));
