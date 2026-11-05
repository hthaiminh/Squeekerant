// The game's name, drawn by hand so it looks the same on every screen, with the head chef beside it.
(function (WW) {
  const { Px, C } = WW;
  const GLYPHS = {
    S: { top: 0, rows: ['.XXXXX.', 'XXXXXXX', 'XX...XX', 'XX.....', 'XXXXX..', '.XXXXX.', '.....XX', 'XX...XX', 'XXXXXXX', '.XXXXX.'] },
    q: { top: 3, rows: ['.XXXXX', 'XXXXXX', 'XX..XX', 'XX..XX', 'XX..XX', 'XXXXXX', '.XXXXX', '....XX', '....XX', '....XX'] },
    u: { top: 3, rows: ['XX..XX', 'XX..XX', 'XX..XX', 'XX..XX', 'XX..XX', 'XXXXXX', '.XXXXX'] },
    e: { top: 3, rows: ['.XXXX.', 'XXXXXX', 'XX..XX', 'XXXXXX', 'XX....', 'XXXXXX', '.XXXX.'] },
    k: { top: 0, rows: ['XX....', 'XX....', 'XX....', 'XX..XX', 'XX.XX.', 'XXXX..', 'XXX...', 'XXXX..', 'XX.XX.', 'XX..XX'] },
    r: { top: 3, rows: ['XX.XX', 'XXXXX', 'XXX..', 'XX...', 'XX...', 'XX...', 'XX...'] },
    a: { top: 3, rows: ['.XXXX.', 'XXXXXX', '....XX', '.XXXXX', 'XX..XX', 'XXXXXX', '.XXXXX'] },
    n: { top: 3, rows: ['XXXXX.', 'XXXXXX', 'XX..XX', 'XX..XX', 'XX..XX', 'XX..XX', 'XX..XX'] },
    t: { top: 1, rows: ['.XX..', '.XX..', 'XXXXX', 'XXXXX', '.XX..', '.XX..', '.XX..', '.XXXX', '..XXX'] },
  };
  const WORD = 'Squeekerant';
  const FIRST = 6; // "Squeek" and "erant" get their own colours.

  function title() {
    const glyphs = [...WORD].map((ch) => GLYPHS[ch]);
    const width = glyphs.reduce((a, g) => a + g.rows[0].length + 1, -1);
    const height = 13;
    const pad = 2;
    const p = new Px(width + pad * 2 + 1, height + pad * 2 + 2);
    let x = pad;
    const lay = (from, to, colour) => {
      const layer = new Px(p.w, p.h);
      let cx = x;
      for (let i = from; i < to; i++) {
        const g = glyphs[i];
        layer.grid(cx, pad + g.top, g.rows, { X: colour });
        cx += g.rows[0].length + 1;
      }
      x = cx;
      p.stamp(layer);
    };
    lay(0, FIRST, C.tomato);
    lay(FIRST, WORD.length, C.butter);
    p.outline(C.ink);
    p.outline(C.paper);
    const shadow = new Px(p.w, p.h);
    for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) if (p.get(i, j)) shadow.px(i + 1, j + 1, C.ink);
    return shadow.stamp(p);
  }

  function badge() {
    const size = 26;
    const p = new Px(size, size);
    p.rrect(2, 2, size - 4, size - 4, C.teal);
    p.rect(2, size - 9, size - 4, 7, C.deep);
    p.rect(4, 2, size - 8, 1, WW.tone(C.teal, 0.25));
    p.outline(C.ink);
    p.outline(C.paper);
    return p;
  }

  let cached = null;
  WW.logoCanvas = function () {
    if (cached) return cached;
    const word = title();
    const mark = badge();
    const gap = 2;
    const w = mark.w + gap + word.w;
    const h = Math.max(mark.h, word.h);
    const c = WW.makeCanvas(w, h);
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.drawImage(mark.canvas(), 0, Math.floor((h - mark.h) / 2));
    // Only the top of him shows, as if he is looking out of a little window.
    const chef = WW.hamsterPose({ fur: 'golden', hat: 'toque', job: 'chef' }, 0);
    const top = Math.floor((h - mark.h) / 2) + 3;
    x.drawImage(chef, 0, 0, chef.width, 20, 3, top, chef.width, 20);
    x.drawImage(word.canvas(), mark.w + gap, Math.floor((h - word.h) / 2));
    cached = c;
    return c;
  };
})((globalThis.WW = globalThis.WW || {}));
