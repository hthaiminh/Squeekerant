// His dreams and the wake up alerts. A look at the wheel finds every Dream Dish with the game's own rule.
// When he has just woken from a long sleep, every browser that asked gets one alert with the dream in it.
// Looking at the wheel needs no database, so the database is only woken in the hours right after he wakes.
const { dayOf } = require('./store');

// An alert only goes out within this long of his waking. Later than that it is old news.
const WINDOW_MS = 3 * 3600000;
// In one server, one look at the wheel at a time, and at most one every 20 seconds however often it is asked.
const CHECK_GAP_MS = 20000;
// The dreams page looks for new dreams at most this often in one server. In between it shows what is kept.
const SYNC_GAP_MS = 5 * 60000;
const BATCH = 300;
const AT_ONCE = 20;
const HOLD_MS = 90000;

// A dream's own address: the day he woke (UTC) and the round. The two never come round again, even on a new wheel.
const idOf = (d) => `${dayOf(d.woke)}-${d.round}`;
const DREAM_ID = /^(\d{4}-\d{2}-\d{2})-(\d{1,9})$/;

function createWake({ store, wheel, send, clock = Date.now, origin = 'https://www.squeekerant.online' }) {
  let lastCheck = -Infinity;
  let lastSync = -Infinity;
  let checking = null;
  // Dreams this server has seen through to the end, so it does not ask the database about them again.
  const finished = new Set();

  // Keeps every dream since the last one kept. `seen` is a look at the wheel already taken, used when it reaches back far enough.
  async function record(seen, now) {
    const last = await store.lastDream(seen.wheel);
    const newest = seen.dreams.length ? seen.dreams[seen.dreams.length - 1].round : null;
    if (last !== null && (newest === null || newest <= last)) return;
    // From the round before the last kept dream, that dream counts no sleep and only later ones are new.
    const base = last === null ? 0 : last - 1;
    const reading = seen.from <= base ? seen : await wheel.read(base);
    const fresh = reading.dreams.filter((d) => last === null || d.round > last);
    if (fresh.length) await store.addDreams(fresh, now, now - WINDOW_MS);
  }

  function message(d) {
    const dish = wheel.dreamDish(d.dream, d.gold);
    return {
      title: 'Squeektoshi is awake',
      body: `He slept ${(d.slept / 6).toFixed(1)} hours and dreamed of ${dish.n}. Your guests are on their way.`,
      url: '/?from=alert',
      image: `${origin}/dreams/${idOf(d)}.png`,
      tag: 'wake',
    };
  }

  // One batch of alerts for a dream, by whoever holds it. The rest go on the next look.
  async function sendFor(d, now) {
    const job = await store.claimDream(d.wheel, d.round, now, HOLD_MS);
    if (!job) return { sent: 0, gone: 0 };
    const words = message(d);
    const subs = await store.subsAfter(job.sentTo, BATCH);
    let sentTo = job.sentTo;
    let sent = 0;
    let gone = 0;
    let through = false;
    try {
      for (let i = 0; i < subs.length; i += AT_ONCE) {
        const part = subs.slice(i, i + AT_ONCE);
        const codes = await Promise.all(part.map((sub) => send(sub, words).catch(() => 0)));
        for (let k = 0; k < part.length; k++) {
          // Gone for good: that browser took its yes back, or was reset. Anything else is not tried again for this dream.
          if (codes[k] === 404 || codes[k] === 410) {
            await store.dropSub(part[k].endpoint);
            gone++;
          } else if (codes[k] >= 200 && codes[k] < 300) sent++;
        }
        sentTo = part[part.length - 1].id;
      }
      through = true;
    } finally {
      // Done when this batch was the last. Stopped part way, the next look carries on after the last one sent.
      const done = through && subs.length < BATCH;
      await store.dreamSent(d.wheel, d.round, sentTo, sent, done);
      if (done) finished.add(d.wheel + ' ' + d.round);
    }
    return { sent, gone };
  }

  // Looks at the wheel. Called every 15 minutes by the schedule in vercel.json, and by a game that has just seen his dream.
  async function check() {
    const now = clock();
    if (checking) return checking;
    if (now - lastCheck < CHECK_GAP_MS) return { ok: true, waited: true };
    lastCheck = now;
    checking = (async () => {
      let seen;
      try {
        seen = await wheel.read(null);
      } catch (e) {
        return { ok: false };
      }
      const latest = seen.dreams.length ? seen.dreams[seen.dreams.length - 1] : null;
      const out = { ok: true, latest: latest ? { id: idOf(latest), slept: latest.slept, gold: latest.gold } : null, sent: 0 };
      if (!latest || now - latest.woke > WINDOW_MS || !store.open || finished.has(latest.wheel + ' ' + latest.round)) return out;
      await record(seen, now);
      Object.assign(out, await sendFor(latest, now));
      return out;
    })().finally(() => {
      checking = null;
    });
    return checking;
  }

  // Every dream kept, newest first, after a look for new ones when it has been a while.
  // With no database the list is read straight from the wheel each time.
  async function list() {
    const now = clock();
    if (!store.open || typeof store.dreams !== 'function') return (await wheel.read(0)).dreams.reverse();
    if (now - lastSync >= SYNC_GAP_MS) {
      lastSync = now;
      try {
        await record(await wheel.read(null), now);
      } catch (e) {
        console.error('Looking for new dreams:', e.message);
      }
    }
    return store.dreams();
  }

  // One dream by its address, or null.
  async function one(id) {
    const m = DREAM_ID.exec(id);
    if (!m) return null;
    const round = Number(m[2]);
    if (!store.open || typeof store.dream !== 'function') return (await list()).find((d) => d.round === round && dayOf(d.woke) === m[1]) || null;
    const found = await store.dream(round, m[1]);
    if (found || dayOf(clock()) !== m[1]) return found;
    // Asked for on the day it happened, perhaps before any look found it.
    await list();
    return store.dream(round, m[1]);
  }

  return { check, list, one, message };
}

module.exports = { createWake, idOf, DREAM_ID, WINDOW_MS, CHECK_GAP_MS, SYNC_GAP_MS, BATCH, HOLD_MS };
