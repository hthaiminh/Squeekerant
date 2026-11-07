// Wake up alerts on this device: the browser's own push, asked for by the player and allowed by the browser.
// The server sends one when Squeektoshi wakes up from a long sleep, with his dream in it. Only on the real site.
(function (WW) {
  const KEY = 'squeekerant-alerts';
  const PINGED = 'squeekerant-woke';
  // Now and then the server hears again from a browser with alerts on, in case it ever lost it.
  const RENEW_MS = 7 * 86400000;
  const READY_MS = 8000;
  // The first sign up with a push service can take half a minute in a new browser. Longer than this, it is not coming.
  const SIGN_UP_MS = 60000;
  const SLOW_MS = 1500;
  // A game that sees his dream this soon after he woke tells the server to look, ahead of its next scheduled look.
  const PING_WITHIN_MS = 30 * 60000;

  const bytes = (b64) => {
    const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4));
    return Uint8Array.from(s, (c) => c.charCodeAt(0));
  };
  const text = (buf) => (buf ? btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : '');
  const kept = () => {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || null;
    } catch (e) {
      return null;
    }
  };
  const keep = (v) => {
    try {
      if (v) localStorage.setItem(KEY, JSON.stringify(v));
      else localStorage.removeItem(KEY);
    } catch (e) {}
  };
  const post = (path, body) => fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) });
  const within = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('timed out')), ms))]);

  class Alerts {
    constructor(game) {
      this.game = game;
      this.on = false;
      this.busy = false;
      // The Artifact preview and the test build have no service worker, so no alerts.
      this.site = !globalThis.claude && !!document.querySelector('link[rel="manifest"]') && 'serviceWorker' in navigator;
      if (this.site) this.look();
    }
    pushable() {
      return 'PushManager' in window && 'Notification' in window;
    }
    // What this device can do: 'on', 'off', 'blocked' (no to alerts in the browser), 'install' (an iPhone or iPad,
    // where alerts only work for the game on the home screen) or 'none'.
    kind() {
      if (!this.site) return 'none';
      if (!this.pushable()) return this.game.appleDevice() && !this.game.installedApp() ? 'install' : 'none';
      if (this.on) return 'on';
      return Notification.permission === 'denied' ? 'blocked' : 'off';
    }
    // Whether to offer them: they can be turned on from here, now or after putting the game on the home screen.
    offered() {
      const k = this.kind();
      return k === 'off' || k === 'install';
    }
    reg() {
      return within(navigator.serviceWorker.ready, READY_MS);
    }
    async serverKey() {
      const j = await (await fetch('/api/push/key')).json();
      if (!j || !j.key) throw new Error('The server has no key.');
      return j.key;
    }
    // At the start: whether this browser has alerts on, under the server's current key.
    // A new key signs it up again, and the server hears from it again once a week.
    async look() {
      if (!this.pushable()) return;
      try {
        const reg = await this.reg();
        const sub = await reg.pushManager.getSubscription();
        this.on = !!sub && Notification.permission === 'granted';
        if (this.on) {
          const was = kept();
          const key = await this.serverKey();
          const theirs = text(sub.options && sub.options.applicationServerKey);
          if ((theirs && theirs !== key) || (!theirs && was && was.key !== key)) await this.subscribe(reg, key, sub);
          else if (!was || was.key !== key || Date.now() - (was.at || 0) > RENEW_MS) await this.tell(sub, key);
        }
      } catch (e) {}
      this.game.alertsChanged();
    }
    async subscribe(reg, key, old) {
      if (old) {
        post('/api/push/unsubscribe', { endpoint: old.endpoint }).catch(() => {});
        await old.unsubscribe().catch(() => {});
      }
      const sub = await within(reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(key) }), SIGN_UP_MS);
      await this.tell(sub, key);
      return sub;
    }
    async tell(sub, key) {
      const res = await post('/api/push/subscribe', sub.toJSON());
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error || 'The server did not keep it.');
      keep({ key, at: Date.now() });
    }
    async turnOn() {
      const g = this.game;
      if (this.busy) return;
      if (this.kind() === 'install') return g.install('alerts');
      this.busy = true;
      g.alertsChanged();
      // Something on screen while the browser and its push service take their time.
      const slow = setTimeout(() => g.toast('Turning the alerts on. This can take a moment.', null, null, 6000), SLOW_MS);
      try {
        const answer = await Notification.requestPermission();
        if (answer !== 'granted') {
          g.toast(answer === 'denied' ? 'Alerts are blocked for this site. They can be allowed again in the browser settings.' : 'No alerts, then.');
          return;
        }
        const reg = await this.reg();
        const key = await this.serverKey();
        const old = await reg.pushManager.getSubscription();
        const theirs = old && text(old.options && old.options.applicationServerKey);
        if (old && theirs === key) await this.tell(old, key);
        else await this.subscribe(reg, key, old);
        this.on = true;
        g.count.once('alerts_on');
        g.sound('new');
        g.toast("Done. You'll get an alert when he wakes up from a long sleep.", 'good', WW.iconCanvas('moon'));
      } catch (e) {
        g.toast('Alerts could not be turned on in this browser.');
      } finally {
        clearTimeout(slow);
        this.busy = false;
        g.alertsChanged();
      }
    }
    async turnOff() {
      const g = this.game;
      if (this.busy) return;
      this.busy = true;
      try {
        const reg = await this.reg();
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          post('/api/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
          await sub.unsubscribe();
        }
      } catch (e) {}
      keep(null);
      this.on = false;
      this.busy = false;
      g.toast('Wake up alerts are off.');
      g.alertsChanged();
    }
    // Once per dream from this browser, and only soon after he woke.
    ping(round, wokeAt) {
      if (!this.site || Date.now() - wokeAt > PING_WITHIN_MS) return;
      try {
        if (localStorage.getItem(PINGED) === String(round)) return;
        localStorage.setItem(PINGED, String(round));
      } catch (e) {
        return;
      }
      post('/api/wake/check').catch(() => {});
    }
  }

  WW.Alerts = Alerts;
})((globalThis.WW = globalThis.WW || {}));
