// Anonymous counts of how far people get, so the lesson and the balance can be judged on more than a bot.
// Only a number per step per day reaches the server. No address, no name, no cookie, nothing that tells one person from another.
// This browser keeps a short list of what it has already counted, so nobody is counted twice. The steps are listed in server/rules.js.
(function (WW) {
  const KEY = 'squeekerant-counted';
  const SEND_AFTER_MS = 30000;

  class Counter {
    constructor() {
      this.queue = [];
      this.done = {};
      this.timer = null;
      // The Artifact viewer has no network. A browser run by a program, a test browser included, is not a person.
      const nav = globalThis.navigator;
      const robot = !!nav && (nav.webdriver === true || /HeadlessChrome|bot|crawl|spider|Lighthouse/i.test(String(nav.userAgent || '')));
      this.usable = !globalThis.claude && typeof fetch === 'function' && !robot;
      if (!this.usable) return;
      try {
        this.done = JSON.parse(localStorage.getItem(KEY)) || {};
      } catch (e) {}
      if (typeof addEventListener === 'function' && globalThis.document) {
        addEventListener('pagehide', () => this.flush());
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) this.flush();
        });
      }
    }
    keep() {
      try {
        localStorage.setItem(KEY, JSON.stringify(this.done));
      } catch (e) {}
    }
    mark(key, step) {
      if (!this.usable || this.done[key]) return;
      this.done[key] = 1;
      this.keep();
      this.queue.push(step);
      if (!this.timer && typeof setTimeout === 'function') {
        this.timer = setTimeout(() => this.flush(), SEND_AFTER_MS);
        // Under the test runner a waiting timer must not keep the process alive.
        if (this.timer && this.timer.unref) this.timer.unref();
      }
    }
    // Once ever from this browser.
    once(step) {
      this.mark(step, step);
    }
    // Once a day from this browser. Only today's marks are kept.
    daily(step, day = new Date().toISOString().slice(0, 10)) {
      const prefix = `${step}@`;
      for (const key of Object.keys(this.done)) if (key.startsWith(prefix) && key !== prefix + day) delete this.done[key];
      this.mark(prefix + day, step);
    }
    // Together, in one small request, so one visit wakes the database once at most.
    flush() {
      clearTimeout(this.timer);
      this.timer = null;
      if (!this.usable || !this.queue.length) return;
      const body = JSON.stringify({ steps: this.queue.splice(0) });
      let sent = false;
      try {
        sent = !!globalThis.navigator && typeof navigator.sendBeacon === 'function' && typeof Blob === 'function' && globalThis.document && navigator.sendBeacon('/api/count', new Blob([body], { type: 'application/json' }));
      } catch (e) {}
      if (!sent) Promise.resolve(fetch('/api/count', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true })).catch(() => {});
    }
  }
  WW.Counter = Counter;
})((globalThis.WW = globalThis.WW || {}));
