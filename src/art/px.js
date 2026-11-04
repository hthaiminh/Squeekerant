// A tiny pixel buffer. Everything in the game is painted with this, then cached as a canvas.
(function (WW) {
  const toInt = (c) => (typeof c === 'number' ? c : parseInt(c.slice(1), 16) + 1);
  const rgb = (v) => {
    const n = v - 1;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const clamp = (x) => (x < 0 ? 0 : x > 255 ? 255 : x);

  // Moves a colour toward warm highlights or plum shadows instead of plain lighter or darker.
  function tone(v, amount) {
    const [r, g, b] = rgb(v);
    let nr, ng, nb;
    if (amount >= 0) {
      nr = r + (255 - r) * amount;
      ng = g + (244 - g) * amount;
      nb = b + (214 - b) * amount;
    } else {
      const a = -amount;
      nr = r + (58 - r) * a;
      ng = g + (32 - g) * a;
      nb = b + (70 - b) * a;
    }
    return ((clamp(nr | 0) << 16) | (clamp(ng | 0) << 8) | clamp(nb | 0)) + 1;
  }
  WW.tone = (hex, amount) => {
    const v = tone(toInt(hex), amount) - 1;
    return '#' + v.toString(16).padStart(6, '0');
  };

  class Px {
    constructor(w, h) {
      this.w = w;
      this.h = h;
      this.d = new Int32Array(w * h);
    }
    get(x, y) {
      return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.d[y * this.w + x];
    }
    px(x, y, c) {
      x = Math.round(x);
      y = Math.round(y);
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
      this.d[y * this.w + x] = c ? toInt(c) : 0;
      return this;
    }
    rect(x, y, w, h, c) {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
      return this;
    }
    // Rectangle with its four corners cut, the shape of most tiny furniture.
    rrect(x, y, w, h, c) {
      this.rect(x + 1, y, w - 2, h, c);
      this.rect(x, y + 1, w, h - 2, c);
      return this;
    }
    ell(cx, cy, rx, ry, c) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x - cx) / (rx + 0.3);
          const dy = (y - cy) / (ry + 0.3);
          if (dx * dx + dy * dy <= 1) this.px(x, y, c);
        }
      }
      return this;
    }
    disc(cx, cy, r, c) {
      return this.ell(cx, cy, r, r, c);
    }
    line(x0, y0, x1, y1, c) {
      x0 = Math.round(x0);
      y0 = Math.round(y0);
      x1 = Math.round(x1);
      y1 = Math.round(y1);
      if (Number.isNaN(x0 + y0 + x1 + y1)) throw new Error('line got NaN');
      const dx = Math.abs(x1 - x0);
      const dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1;
      const sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        this.px(x0, y0, c);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) {
          err += dy;
          x0 += sx;
        }
        if (e2 <= dx) {
          err += dx;
          y0 += sy;
        }
      }
      return this;
    }
    // rows of characters, map from character to colour, space and dot are clear
    grid(x, y, rows, map) {
      rows.forEach((row, j) => {
        for (let i = 0; i < row.length; i++) {
          const ch = row[i];
          if (ch === '.' || ch === ' ') continue;
          if (map[ch]) this.px(x + i, y + j, map[ch]);
        }
      });
      return this;
    }
    // Paints only where something is already painted, used for markings that follow the body.
    mask(fn) {
      const copy = this.d.slice();
      fn(this);
      for (let i = 0; i < copy.length; i++) if (!copy[i]) this.d[i] = 0;
      return this;
    }
    // Rounds a form: the lower edge falls into shadow and the upper edge catches the light.
    shade(dark = -0.22, light = 0.2) {
      const w = this.w;
      const h = this.h;
      const src = this.d.slice();
      const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : src[y * w + x]);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const v = src[y * w + x];
          if (!v) continue;
          if (!at(x, y + 1) || !at(x + 1, y + 1) || !at(x - 1, y + 1)) this.d[y * w + x] = tone(v, dark);
          else if (!at(x, y - 1)) this.d[y * w + x] = tone(v, light);
        }
      }
      return this;
    }
    outline(c = '#3a2340') {
      const w = this.w;
      const h = this.h;
      const src = this.d.slice();
      const o = toInt(c);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (src[y * w + x]) continue;
          const near = (x > 0 && src[y * w + x - 1]) || (x < w - 1 && src[y * w + x + 1]) || (y > 0 && src[(y - 1) * w + x]) || (y < h - 1 && src[(y + 1) * w + x]);
          if (near) this.d[y * w + x] = o;
        }
      }
      return this;
    }
    flip() {
      const o = new Px(this.w, this.h);
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) o.d[y * this.w + (this.w - 1 - x)] = this.d[y * this.w + x];
      return o;
    }
    // Stamps another buffer on top of this one.
    stamp(other, ox = 0, oy = 0) {
      for (let y = 0; y < other.h; y++) {
        for (let x = 0; x < other.w; x++) {
          const v = other.d[y * other.w + x];
          if (v) {
            const tx = x + ox;
            const ty = y + oy;
            if (tx >= 0 && ty >= 0 && tx < this.w && ty < this.h) this.d[ty * this.w + tx] = v;
          }
        }
      }
      return this;
    }
    canvas() {
      const c = WW.makeCanvas(this.w, this.h);
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(this.w, this.h);
      for (let i = 0; i < this.d.length; i++) {
        const v = this.d[i];
        if (!v) continue;
        const [r, g, b] = rgb(v);
        img.data[i * 4] = r;
        img.data[i * 4 + 1] = g;
        img.data[i * 4 + 2] = b;
        img.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      return c;
    }
  }

  WW.Px = Px;
  WW.makeCanvas = function (w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  };

  // Palette names used across art and UI, so everything stays one world.
  WW.C = {
    ink: '#3a2340',
    plum: '#5b3a5e',
    cocoa: '#6d4535',
    bark: '#8a5a3c',
    wood: '#b57f4f',
    honey: '#d9a860',
    oat: '#f0d6a3',
    cream: '#fff1d6',
    paper: '#fff8e8',
    tomato: '#e4572e',
    brick: '#b53a2b',
    rose: '#f49fb0',
    blush: '#f7c4c0',
    butter: '#ffc857',
    gold: '#f2a33a',
    leaf: '#6fb36b',
    moss: '#3f7f5a',
    mint: '#a8e0b8',
    teal: '#2f7f86',
    deep: '#1f4f66',
    sky: '#8ed0e8',
    ice: '#d5f0f2',
    lilac: '#a99ad6',
    night: '#3a3a78',
    steel: '#9aa7b0',
    iron: '#5e6a78',
    white: '#ffffff',
  };
})((globalThis.WW = globalThis.WW || {}));
