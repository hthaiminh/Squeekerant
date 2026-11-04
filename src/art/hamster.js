// The staff: front facing chibi hamsters with fur, a hat and a job.
(function (WW) {
  const { Px, C } = WW;
  const T = WW.tone;
  const W = 20;
  const H = 26;

  WW.FURS = {
    golden: { n: 'Golden', c: '#e8a95a', b: '#fff1d6', d: '#c9863a' },
    cream: { n: 'Cream', c: '#f3dfb8', b: '#fff8e8', d: '#d9bf90' },
    cinnamon: { n: 'Cinnamon', c: '#c9762e', b: '#f0d6a3', d: '#a05a1e' },
    grey: { n: 'Dove Grey', c: '#b8b4b4', b: '#efece8', d: '#8f8a8e' },
    choc: { n: 'Chocolate', c: '#7a553a', b: '#d9c0a0', d: '#5a3a2a' },
    black: { n: 'Black Bear', c: '#4a4250', b: '#8f8894', d: '#2f2838' },
    white: { n: 'Snow', c: '#fff8e8', b: '#ffffff', d: '#e0d4c0' },
    squeek: { n: 'White and Orange', c: '#fff4e0', b: '#ffffff', d: '#e88a3a', patch: '#e88a3a' },
    rust: { n: 'Rust Band', c: '#d9662e', b: '#fff1d6', d: '#a8481e', band: '#fff1d6' },
    panda: { n: 'Panda', c: '#fff8e8', b: '#ffffff', d: '#3d3440', patch: '#3d3440' },
  };

  WW.HATS = {
    toque: { n: 'Chef Toque', lvl: 1 },
    tall: { n: 'Tall Toque', lvl: 4 },
    beret: { n: 'Beret', lvl: 3 },
    bandana: { n: 'Red Bandana', lvl: 2 },
    thimble: { n: 'Thimble Helmet', lvl: 6 },
    acorn: { n: 'Acorn Cap', lvl: 8 },
    flower: { n: 'Daisy', lvl: 10 },
    crown: { n: 'Bottle Cap Crown', lvl: 15 },
    none: { n: 'No Hat', lvl: 1 },
  };

  function hat(p, type, y) {
    const cloth = C.paper;
    switch (type) {
      case 'toque':
        p.rect(5, y - 2, 10, 3, cloth);
        p.ell(6, y - 5, 3, 3, cloth);
        p.ell(14, y - 5, 3, 3, cloth);
        p.ell(10, y - 6, 4, 3, cloth);
        p.rect(5, y, 10, 1, '#e6d8c0');
        break;
      case 'tall':
        p.rect(6, y - 7, 8, 8, cloth);
        p.ell(10, y - 9, 5, 3, cloth);
        p.rect(5, y, 10, 1, '#e6d8c0');
        p.px(8, y - 4, '#e6d8c0');
        p.px(11, y - 6, '#e6d8c0');
        break;
      case 'mini':
        p.rect(6, y - 1, 8, 2, cloth);
        p.ell(10, y - 3, 4, 2, cloth);
        break;
      case 'beret':
        p.ell(10, y - 1, 7, 2, C.tomato);
        p.px(10, y - 4, C.brick);
        p.px(10, y - 3, C.brick);
        break;
      case 'bandana':
        p.rect(4, y - 1, 12, 3, C.tomato);
        p.px(6, y, C.white);
        p.px(10, y, C.white);
        p.px(14, y, C.white);
        p.rect(16, y, 2, 2, C.brick);
        break;
      case 'thimble':
        p.rrect(5, y - 6, 10, 8, C.steel);
        for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) p.px(6 + i * 2 + (j % 2), y - 5 + j * 2, C.iron);
        break;
      case 'acorn':
        p.ell(10, y - 2, 6, 3, C.bark);
        p.rect(10, y - 6, 1, 2, C.cocoa);
        p.px(7, y - 3, C.wood);
        p.px(12, y - 2, C.wood);
        break;
      case 'flower':
        for (const [x, yy] of [[13, y - 2], [16, y - 2], [14, y - 4], [14, y], [16, y - 1]]) p.disc(x, yy, 1, C.white);
        p.px(15, y - 2, C.butter);
        break;
      case 'crown':
        p.grid(5, y - 5, ['#..#.#..#.', '#.##.##.#.', '##########', '##########'], { '#': C.gold });
        p.px(7, y - 2, C.tomato);
        p.px(10, y - 2, C.sky);
        p.px(13, y - 2, C.tomato);
        break;
      case 'kerchief':
        p.rect(4, y, 12, 2, C.sky);
        p.px(6, y, C.white);
        p.px(13, y + 1, C.white);
        break;
      default:
        break;
    }
  }

  // pose: 0 stand, 1 step left, 2 step right, 3 stir up, 4 stir down, 5 carry, 6 sleep
  function paintBody(p, s, pose) {
    const f = WW.FURS[s.fur] || WW.FURS.golden;
    const bob = pose === 1 || pose === 2 || pose === 4 ? 1 : 0;
    const feetY = 24;
    const fc = f.d;
    p.rect(6, feetY - (pose === 1 ? 1 : 0), 3, 2, fc);
    p.rect(11, feetY - (pose === 2 ? 1 : 0), 3, 2, fc);
    p.ell(10, 19 + bob * 0, 6, 5, f.c);
    if (f.band) p.rect(4, 19, 12, 2, f.band);
    p.ell(10, 20, 4, 3, f.b);
    p.disc(10, 11 + bob, 7, f.c);
    if (f.patch) {
      p.mask((q) => {
        q.disc(5, 8 + bob, 3, f.patch);
        q.disc(15, 8 + bob, 3, f.patch);
      });
    }
    p.ell(10, 15 + bob, 4, 2, f.b);
    p.shade(-0.14, 0.14);
    // ears
    p.disc(4, 6 + bob, 2, f.d);
    p.disc(16, 6 + bob, 2, f.d);
    p.rect(4, 6 + bob, 1, 1, C.rose);
    p.rect(16, 6 + bob, 1, 1, C.rose);
    // job clothes
    if (s.job === 'chef' || s.job === 'sous') {
      p.rect(6, 18, 8, 6, C.paper);
      p.rect(6, 18, 8, 1, '#e6d8c0');
      if (s.job === 'chef') p.px(10, 20, C.tomato);
    } else if (s.job === 'waiter') {
      p.rect(8, 18, 4, 1, C.brick);
      p.px(7, 18, C.tomato);
      p.px(12, 18, C.tomato);
      p.rect(7, 20, 6, 4, C.ink);
      p.rect(9, 20, 2, 4, C.paper);
    } else if (s.job === 'cleaner') {
      p.rect(6, 19, 8, 5, C.teal);
      p.rect(8, 21, 4, 2, C.sky);
    }
    if (pose === 6) {
      p.rect(6, 11 + bob, 3, 1, C.ink);
      p.rect(11, 11 + bob, 3, 1, C.ink);
    } else {
      p.rect(6, 10 + bob, 2, 3, C.ink);
      p.rect(12, 10 + bob, 2, 3, C.ink);
      p.px(6, 10 + bob, C.white);
      p.px(12, 10 + bob, C.white);
    }
    p.px(10, 13 + bob, C.brick);
    p.rect(4, 13 + bob, 2, 2, C.rose);
    p.rect(14, 13 + bob, 2, 2, C.rose);
    // arms
    const arm = f.d;
    if (pose === 3) {
      p.rect(3, 17, 2, 3, arm);
      p.rect(15, 15, 2, 3, arm);
    } else if (pose === 4) {
      p.rect(3, 18, 2, 3, arm);
      p.rect(15, 17, 2, 3, arm);
    } else if (pose === 5) {
      p.rect(3, 15, 2, 3, arm);
      p.rect(15, 15, 2, 3, arm);
    } else {
      p.rect(3, 18, 2, 3, arm);
      p.rect(15, 18, 2, 3, arm);
    }
    if (s.job === 'cleaner') {
      p.line(17, 8, 17, 23, C.bark);
      p.rect(15, 23, 5, 2, C.butter);
    }
    const hatType = s.hat || (s.job === 'sous' ? 'mini' : s.job === 'cleaner' ? 'kerchief' : s.job === 'chef' ? 'toque' : 'none');
    hat(p, hatType, 4 + bob);
  }

  const cache = new Map();
  // Returns canvases by pose number for a staff member's look.
  WW.hamsterPose = function (look, pose) {
    const key = `${look.fur}|${look.hat || ''}|${look.job || ''}|${pose}`;
    if (cache.has(key)) return cache.get(key);
    const p = new Px(W, H);
    paintBody(p, look, pose);
    const c = p.outline().canvas();
    cache.set(key, c);
    return c;
  };
  WW.HAMSTER_CELL = { w: W, h: H };

  // Squeektoshi himself: side view runner for the wheel, and a curled up sleeper.
  const runCache = {};
  WW.squeekRun = function (frame) {
    if (runCache[frame]) return runCache[frame];
    const p = new Px(20, 14);
    const body = '#fff4e0';
    const patch = '#e88a3a';
    if (frame === 0) {
      p.rect(3, 11, 3, 2, patch);
      p.rect(12, 11, 3, 2, patch);
    } else {
      p.rect(6, 12, 3, 1, patch);
      p.rect(9, 12, 3, 1, patch);
    }
    p.ell(9, 7, 6, 4, body);
    p.disc(14, 6, 4, body);
    p.mask((q) => {
      q.ell(5, 5, 3, 3, patch);
      q.ell(14, 3, 3, 2, patch);
    });
    p.shade(-0.12, 0.1);
    p.disc(13, 2, 1, patch);
    p.rect(15, 5, 1, 2, C.ink);
    p.px(18, 7, C.brick);
    p.px(15, 8, C.rose);
    runCache[frame] = p.outline().canvas();
    return runCache[frame];
  };
  let sleeper = null;
  WW.squeekSleep = function () {
    if (sleeper) return sleeper;
    const p = new Px(20, 13);
    p.ell(10, 7, 8, 5, '#fff4e0');
    p.mask((q) => {
      q.ell(5, 4, 4, 3, '#e88a3a');
      q.ell(15, 9, 3, 2, '#e88a3a');
    });
    p.shade(-0.12, 0.1);
    p.disc(14, 3, 1, '#e88a3a');
    p.rect(13, 6, 3, 1, C.ink);
    p.px(11, 8, C.rose);
    sleeper = p.outline().canvas();
    return sleeper;
  };
})((globalThis.WW = globalThis.WW || {}));
