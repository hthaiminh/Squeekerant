// The forest outside: seasons painted by code, the buildings, signs and the sky.
(function (WW) {
  const { Px, C } = WW;
  const T = WW.tone;

  const ART = {
    spring: { grass: ['#8fd07a', '#7fc26c', '#a0dc88'], tuft: '#6fb25e', far: '#7fbf7a', leaf: ['#f7b8cc', '#ffd8e4', '#e898b4'], green: ['#6fb86a', '#8fd07a', '#4f9a56'], pine: '#4f8f5a', path: '#dcc090', edge: '#b89a6a', flower: ['#ffd8e4', '#fff1a8', '#ffffff', '#f49fb0'], fruit: '#e8304a' },
    summer: { grass: ['#6fb65e', '#5fa852', '#7fc46a'], tuft: '#4f9446', far: '#3f8a56', leaf: ['#3f9a4e', '#56b05e', '#2f8048'], green: ['#3f9a4e', '#56b05e', '#2f8048'], pine: '#2f7048', path: '#d9b98a', edge: '#ad8f60', flower: ['#ffc857', '#e4572e', '#ffffff', '#a99ad6'], fruit: '#e4372e' },
    autumn: { grass: ['#b8b05a', '#a8a04e', '#c8bc66'], tuft: '#958c42', far: '#a8783a', leaf: ['#e88a2e', '#d9602e', '#f2b23e'], green: ['#c9882e', '#e8a03e', '#a8682a'], pine: '#3f6f48', path: '#c9a878', edge: '#a08458', flower: ['#e8802e', '#c9502e'], fruit: '#c9502e' },
    winter: { grass: ['#eaf2f6', '#dde8ee', '#f6fafc'], tuft: '#c8d6de', far: '#a8bcc8', leaf: null, green: null, pine: '#3f6f68', path: '#c8c6c0', edge: '#a8a8a4', flower: [], fruit: '#e4372e', snow: true },
  };
  WW.SEASON_ART = ART;

  const seeded = (seed) => {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  };

  // Trees. Kind 0 and 1 are broadleaf, 2 a pine, 3 a bush.
  const trees = {};
  WW.forestTree = function (season, kind) {
    const key = season + kind;
    if (trees[key]) return trees[key];
    const A = ART[season];
    let p;
    if (kind === 2) {
      p = new Px(24, 38);
      p.rect(10, 30, 4, 8, C.cocoa);
      for (let i = 0; i < 4; i++) {
        const y = 1 + i * 7;
        for (let r = 0; r < 11; r++) {
          const half = Math.round(((3 + i * 2.4) * (r + 2)) / 11);
          p.rect(12 - half, y + r, half * 2, 1, T(A.pine, r < 4 ? 0.12 : -0.04));
        }
        if (A.snow) p.rect(12 - 2 - i, y + 1, 4 + i * 2, 2, C.white);
      }
    } else if (kind === 3) {
      p = new Px(24, 16);
      if (A.snow) {
        p.ell(12, 10, 10, 6, '#7f9a94');
        p.ell(12, 7, 9, 4, C.white);
      } else {
        const g = A.green || A.leaf;
        p.ell(12, 10, 11, 6, g[2]);
        p.ell(9, 8, 6, 5, g[0]);
        p.ell(16, 8, 6, 5, g[1]);
      }
    } else if (A.leaf) {
      const g = kind === 1 && A.green ? A.green : A.leaf;
      p = new Px(34, 42);
      p.rect(15, 26, 5, 16, C.cocoa);
      p.rect(17, 26, 2, 16, C.bark);
      p.disc(17, 13, 12, g[2]);
      p.disc(9, 19, 8, g[2]);
      p.disc(25, 19, 8, g[2]);
      p.disc(14, 10, 8, g[0]);
      p.disc(23, 15, 6, g[0]);
      p.disc(8, 17, 5, g[0]);
      for (const [x, y] of [[12, 7], [20, 9], [7, 15], [25, 13]]) p.disc(x, y, 2, g[1]);
    } else {
      p = new Px(34, 42);
      p.rect(15, 22, 4, 20, C.cocoa);
      p.line(17, 26, 7, 14, C.cocoa);
      p.line(17, 22, 27, 10, C.cocoa);
      p.line(17, 18, 17, 4, C.cocoa);
      p.line(10, 18, 5, 18, C.bark);
      p.line(24, 14, 30, 16, C.bark);
      for (const [x, y] of [[7, 13], [27, 9], [17, 3], [5, 17], [30, 15]]) p.rect(x - 1, y - 1, 3, 2, C.white);
    }
    trees[key] = p.outline().canvas();
    return trees[key];
  };

  // The tree you can shake, with something in it worth shaking for.
  const shakers = {};
  WW.shakeTreeCanvas = function (season) {
    if (shakers[season]) return shakers[season];
    const A = ART[season];
    const p = new Px(40, 44);
    p.rect(17, 24, 6, 18, C.cocoa);
    p.rect(19, 24, 2, 18, C.bark);
    p.rect(13, 40, 14, 3, C.cocoa);
    if (A.green) {
      const g = A.green;
      p.disc(20, 13, 12, g[2]);
      p.disc(10, 18, 8, g[2]);
      p.disc(30, 18, 8, g[2]);
      for (const [x, y, r] of [[16, 10, 7], [26, 12, 6], [9, 16, 5], [31, 17, 4]]) p.disc(x, y, r, g[0]);
      for (const [x, y] of [[12, 8], [24, 7], [30, 14], [8, 18], [20, 18]]) p.disc(x, y, 2, g[1]);
    } else {
      p.line(20, 24, 8, 12, C.cocoa);
      p.line(20, 22, 32, 10, C.cocoa);
      p.line(20, 20, 20, 3, C.cocoa);
      for (const [x, y] of [[8, 11], [32, 9], [20, 2], [13, 16], [27, 15]]) p.rect(x - 2, y - 1, 5, 2, C.white);
    }
    for (const [x, y] of [[16, 15], [26, 19], [10, 13], [22, 8]]) {
      p.rect(x, y, 2, 2, A.fruit);
      p.px(x, y, C.white);
    }
    shakers[season] = p.outline().canvas();
    return shakers[season];
  };

  function paintGround(x, W, H, top, A, rnd) {
    x.fillStyle = A.grass[0];
    x.fillRect(0, top, W, H - top);
    for (let j = top; j < H; j += 2) {
      for (let i = 0; i < W; i += 2) {
        const r = rnd();
        if (r < 0.14) x.fillStyle = A.grass[1];
        else if (r < 0.24) x.fillStyle = A.grass[2];
        else continue;
        x.fillRect(i, j, 2, 2);
      }
    }
    x.fillStyle = A.tuft;
    for (let n = 0; n < (W * (H - top)) / 500; n++) {
      const i = Math.floor(rnd() * W);
      const j = top + Math.floor(rnd() * (H - top));
      x.fillRect(i, j, 1, 2);
      x.fillRect(i + 2, j + 1, 1, 1);
    }
    for (let n = 0; n < (W * (H - top)) / 1400 && A.flower.length; n++) {
      const i = Math.floor(rnd() * W);
      const j = top + Math.floor(rnd() * (H - top));
      x.fillStyle = A.flower[Math.floor(rnd() * A.flower.length)];
      x.fillRect(i, j, 2, 2);
    }
  }
  function paintPath(x, rx, ry, rw, rh, A, rnd) {
    x.fillStyle = A.path;
    x.fillRect(rx, ry, rw, rh);
    x.fillStyle = A.edge;
    const wide = rw >= rh;
    const len = wide ? rw : rh;
    for (let i = 0; i < len; i += 2) {
      const a = Math.floor(rnd() * 3);
      const b = Math.floor(rnd() * 3);
      if (wide) {
        x.fillRect(rx + i, ry - 1 + a, 2, 1);
        x.fillRect(rx + i, ry + rh - b, 2, 1);
      } else {
        x.fillRect(rx - 1 + a, ry + i, 1, 2);
        x.fillRect(rx + rw - b, ry + i, 1, 2);
      }
    }
    for (let n = 0; n < (rw * rh) / 60; n++) x.fillRect(rx + Math.floor(rnd() * rw), ry + Math.floor(rnd() * rh), 2, 1);
  }
  function paintHills(x, W, y, h, color, rnd) {
    x.fillStyle = color;
    for (let i = -10; i < W + 10; i += 14) {
      const r = 8 + Math.floor(rnd() * 8);
      x.beginPath();
      x.ellipse(i, y, r + 4, r, 0, 0, Math.PI * 2);
      x.fill();
    }
    x.fillRect(0, y, W, h);
  }
  function plantTrees(x, season, spots) {
    spots.sort((a, b) => a[1] - b[1]);
    for (const [px, py, kind] of spots) {
      const c = WW.forestTree(season, kind);
      x.drawImage(c, Math.round(px - c.width / 2), Math.round(py - c.height));
    }
  }

  const outsideCache = {};
  WW.outsideCanvas = function (season) {
    if (outsideCache[season]) return outsideCache[season];
    const O = WW.OUTSIDE;
    const A = ART[season];
    const rnd = seeded(7);
    const c = WW.makeCanvas(O.W, O.H);
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    paintHills(x, O.W, 58, 16, A.far, rnd);
    paintGround(x, O.W, O.H, O.SKY, A, rnd);
    paintPath(x, 0, 240, O.W, 32, A, rnd);
    paintPath(x, O.DOOR.x - 16, 208, 32, 32, A, rnd);
    paintPath(x, O.MARKET.door - 16, 208, 32, 32, A, rnd);
    paintPath(x, O.SHOP.door - 16, 208, 32, 32, A, rnd);
    paintPath(x, O.RANKS.door - 14, 232, 28, 8, A, rnd);
    const spots = [];
    for (let i = -6; i < O.W + 10; i += 20) spots.push([i + rnd() * 10, 72 + rnd() * 18, Math.floor(rnd() * 3)]);
    for (let i = 4; i < O.W; i += 26) spots.push([i + rnd() * 12, 94 + rnd() * 16, Math.floor(rnd() * 3)]);
    // The lawns either side open up behind a last row of trees.
    for (let i = 6; i < O.W; i += 24) if (i < 215 || i > 745) spots.push([i + rnd() * 10, 118 + rnd() * 8, Math.floor(rnd() * 4)]);
    for (let j = 136; j < 236; j += 24) {
      spots.push([2 + rnd() * 6, j, 2]);
      spots.push([O.W - 2 - rnd() * 6, j, 2]);
    }
    for (let j = 290; j < 372; j += 26) {
      spots.push([2 + rnd() * 6, j, 2]);
      spots.push([O.W - 2 - rnd() * 6, j, 2]);
    }
    for (let i = -4; i < O.W + 10; i += 22) spots.push([i + rnd() * 10, 406 + rnd() * 12, Math.floor(rnd() * 4)]);
    plantTrees(x, season, spots);
    outsideCache[season] = c;
    return c;
  };

  const streetCache = {};
  WW.streetCanvas = function (season) {
    if (streetCache[season]) return streetCache[season];
    const S = WW.STREET;
    const A = ART[season];
    const rnd = seeded(23);
    const c = WW.makeCanvas(S.W, S.H);
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    paintHills(x, S.W, 40, 12, A.far, rnd);
    paintGround(x, S.W, S.H, S.SKY, A, rnd);
    for (const lane of S.LANES) paintPath(x, 0, lane - 9, S.W, 18, A, rnd);
    paintPath(x, 196, S.LANES[0], 18, S.LANES[1] - S.LANES[0], A, rnd);
    paintPath(x, 852, S.LANES[0], 18, S.LANES[1] - S.LANES[0], A, rnd);
    const spots = [];
    for (let i = -6; i < S.W + 10; i += 22) spots.push([i + rnd() * 10, 58 + rnd() * 10, Math.floor(rnd() * 3)]);
    // Forest out past the last lots on each side.
    for (let i = 0; i < 180; i += 24) {
      spots.push([i + rnd() * 10, 110 + rnd() * 40, Math.floor(rnd() * 4)]);
      spots.push([i + rnd() * 10, 216 + rnd() * 90, Math.floor(rnd() * 4)]);
    }
    for (let i = 880; i < S.W + 4; i += 24) {
      spots.push([i + rnd() * 10, 110 + rnd() * 40, Math.floor(rnd() * 4)]);
      spots.push([i + rnd() * 10, 216 + rnd() * 90, Math.floor(rnd() * 4)]);
    }
    for (let i = -4; i < S.W + 10; i += 22) spots.push([i + rnd() * 10, 378 + rnd() * 30, Math.floor(rnd() * 4)]);
    plantTrees(x, season, spots);
    streetCache[season] = c;
    return c;
  };

  const snowCap = (p, x, y, w) => {
    p.rect(x, y, w, 2, C.white);
    for (let i = x; i < x + w; i += 5) p.px(i + 2, y + 2, C.white);
  };

  // The market: a long stall under a big scalloped canopy, with everything in season piled high.
  const markets = {};
  WW.marketCanvas = function (season) {
    if (markets[season]) return markets[season];
    const W = 116;
    const p = new Px(W, 100);
    const b = 100;
    const cx = W / 2;
    // Back wall and shelves of jars.
    p.rect(8, 30, W - 16, b - 34, '#a8743e');
    for (let y = 34; y < b - 4; y += 5) p.rect(8, y, W - 16, 1, '#946432');
    for (const y of [44, 56]) {
      p.rect(9, y, W - 18, 2, C.honey);
      p.rect(9, y + 2, W - 18, 1, C.cocoa);
    }
    const jars = ['#f28a2e', '#e4372e', '#8fd06a', '#ffdd4a', '#a99ad6', '#f0d6a3', '#3f9a6a'];
    for (let i = 0; i < 13; i++) {
      const x = 11 + i * 7.3;
      const c = jars[i % jars.length];
      p.rect(x, 38, 5, 6, c);
      p.rect(x + 1, 36, 3, 2, C.paper);
      p.px(x + 1, 39, T(c, 0.5));
      const c2 = jars[(i + 3) % jars.length];
      if (i % 2 === 0) {
        p.rect(x, 50, 5, 6, c2);
        p.rect(x + 1, 48, 3, 2, C.bark);
        p.px(x + 1, 51, T(c2, 0.5));
      }
    }
    // Posts.
    for (const x of [5, 38, W - 41, W - 8]) {
      p.rect(x, 26, 3, b - 26, C.cocoa);
      p.rect(x, 26, 1, b - 26, C.bark);
    }
    // Counter with crates heaped with produce.
    p.rect(2, 72, W - 4, 3, C.honey);
    p.rect(2, 72, W - 4, 1, C.oat);
    p.rect(4, 75, W - 8, b - 75, C.bark);
    for (let x = 4; x < W - 4; x += 12) p.rect(x, 75, 1, b - 75, C.cocoa);
    for (const y of [82, 90]) p.rect(4, y, W - 8, 1, C.cocoa);
    for (let x = 4; x < W - 4; x += 12) {
      const cloth = (x - 4) % 24 < 12 ? '#3f8a86' : C.butter;
      p.rect(x, 75, 12, 5, cloth);
      p.ell(x + 6, 80, 6, 3, cloth);
      p.rect(x + 1, 76, 10, 1, T(cloth, 0.3));
    }
    p.rect(4, 75, W - 8, 1, C.gold);
    const heap = (x, w, c, dark, y = 62) => {
      p.rect(x, y + 4, w, 6, C.wood);
      p.rect(x, y + 6, w, 1, C.bark);
      for (let i = 0; i < w; i += 3) {
        p.disc(x + i + 1, y + 3 - (i % 2), 2, i % 6 < 3 ? c : dark);
        p.px(x + i, y + 1 - (i % 2), T(c, 0.55));
      }
    };
    heap(5, 12, '#e4372e', '#c8281e');
    heap(19, 11, '#f28a2e', '#d86e1e');
    heap(32, 11, '#8fd06a', '#6fb84e');
    heap(45, 11, '#ffdd4a', '#e8c030');
    heap(58, 11, '#a058c0', '#7e3ea0');
    heap(71, 11, '#f49fb0', '#e07a90');
    heap(84, 13, '#e8d0a0', '#c8a878');
    heap(99, 12, '#3f9a5a', '#2f7f48');
    // Carrot tops and leaves sticking out.
    for (const x of [21, 25, 28]) p.rect(x, 58, 1, 3, C.leaf);
    for (const x of [34, 38, 42]) p.px(x, 60, C.moss);
    // Canopy, sweeping down over the stall.
    for (let y = 8; y < 30; y++) {
      const hw = Math.round(38 + (y - 8) * 0.95);
      for (let x = -hw; x < hw; x++) {
        const stripe = Math.floor(((x / hw) * 5 + 5) * 1) % 2;
        const shade = y < 12 ? 0.18 : y > 26 ? -0.12 : 0;
        const c = stripe ? C.paper : C.tomato;
        p.px(cx + x, y, shade ? T(c, shade) : c);
      }
    }
    const edge = Math.round(38 + 22 * 0.95);
    const stripeW = (edge * 2) / 10;
    for (let k = 0; k < 10; k++) {
      const sx = cx - edge + k * stripeW;
      p.ell(sx + stripeW / 2, 30, stripeW / 2, 3, k % 2 ? C.paper : C.tomato);
      p.px(sx + stripeW / 2, 33, C.butter);
    }
    p.rect(cx - 38, 7, 76, 1, C.brick);
    // Lanterns and strings of peppers under the edge.
    for (const x of [14, W / 2 - 1, W - 17]) {
      p.rect(x + 1, 33, 1, 3, C.iron);
      p.rect(x, 36, 3, 4, C.butter);
      p.px(x + 1, 37, C.white);
    }
    for (const x of [28, W - 31]) {
      p.rect(x, 33, 1, 12, C.moss);
      for (let y = 35; y < 45; y += 2) p.rect(x - 1 + ((y >> 1) % 2) * 2, y, 2, 2, C.tomato);
    }
    // A carved board at the top for the name.
    p.rect(cx - 25, 0, 50, 11, C.cocoa);
    p.rect(cx - 24, 1, 48, 9, C.honey);
    p.rect(cx - 24, 1, 48, 1, C.oat);
    p.rect(cx - 27, 3, 2, 5, C.cocoa);
    p.rect(cx + 25, 3, 2, 5, C.cocoa);
    // Baskets, sacks and a pumpkin pile out front.
    const basket = (x, y, c) => {
      p.rect(x, y, 15, 9, C.wood);
      for (let i = 0; i < 15; i += 3) p.rect(x + i, y, 1, 9, C.bark);
      p.rect(x, y + 4, 15, 1, C.bark);
      for (let i = 1; i < 14; i += 3) p.disc(x + i, y - 1, 2, c);
      p.px(x + 2, y - 2, T(c, 0.6));
    };
    basket(8, b - 10, '#e4372e');
    p.ell(96, b - 6, 8, 6, '#e8d8b8');
    p.rect(92, b - 13, 8, 3, '#c8b890');
    p.ell(108, b - 5, 6, 5, '#d8c8a8');
    for (const [x, r] of [[34, 5], [44, 4], [39, 3]]) {
      p.ell(x, b - r - (r === 3 ? 7 : 0), r + 1, r, '#f28a2e');
      p.px(x - 2, b - r - 1 - (r === 3 ? 7 : 0), '#ffb060');
      p.rect(x, b - r * 2 - 1 - (r === 3 ? 7 : 0), 1, 2, C.moss);
    }
    if (ART[season].snow) WW.snowCap(p);
    markets[season] = p.outline().canvas();
    return markets[season];
  };

  // The decor shop: a grand boutique in white marble and gold, with its treasures lit up in tall windows.
  const SHOP_W = 112;
  const SHOP_H = 116;
  // Where its windows are, so they can glow at night.
  WW.SHOP_GLOW = { windows: [{ x: 10, y: 66, w: 26, h: 38 }, { x: 76, y: 66, w: 26, h: 38 }, { x: 46, y: 68, w: 20, h: 12 }], lamps: [[23, 74, 14], [89, 74, 14], [7, 72, 8], [105, 72, 8], [40, 72, 7], [72, 72, 7]] };
  const shops = {};
  WW.shopCanvas = function (season) {
    if (shops[season]) return shops[season];
    const p = new Px(SHOP_W, SHOP_H);
    const b = SHOP_H;
    const cx = SHOP_W / 2;
    const marble = '#f8f4ea';
    const vein = '#e6dfd0';
    const gold = '#e8b83a';
    const goldL = '#ffe08a';
    const goldD = '#b8862a';
    const plum = '#3a2450';
    const plumL = '#54386e';
    // Mansard roof of plum slate, in fish scale rows.
    const roofTop = 22;
    const roofBase = 46;
    for (let y = roofTop; y < roofBase; y++) {
      const hw = Math.round(40 + ((y - roofTop) / (roofBase - roofTop)) * 15);
      for (let x = -hw; x < hw; x++) {
        const row = (y - roofTop) >> 1;
        p.px(cx + x, y, (x + row * 2 + 400) % 4 === 0 || (y - roofTop) % 2 === 1 ? plum : plumL);
      }
    }
    // Iron and gold cresting along the ridge.
    p.rect(cx - 41, roofTop - 1, 82, 2, gold);
    for (let x = cx - 40; x < cx + 40; x += 6) {
      p.rect(x, roofTop - 5, 1, 4, goldD);
      p.px(x, roofTop - 6, goldL);
    }
    for (const x of [cx - 41, cx + 40]) {
      p.rect(x, roofTop - 9, 2, 8, gold);
      p.disc(x + 0.5, roofTop - 10, 2, goldL);
    }
    // Round dormers with gold rings.
    for (const x of [cx - 31, cx + 31]) {
      p.rect(x - 7, 31, 14, 13, marble);
      p.disc(x - 0.5, 34, 7, marble);
      p.disc(x - 0.5, 36, 5, gold);
      p.disc(x - 0.5, 36, 4, '#ffe9b0');
      p.rect(x - 1, 32, 1, 8, goldD);
      p.rect(x - 5, 36, 9, 1, goldD);
      p.px(x - 1, 27, goldL);
      p.rect(x - 2, 28, 3, 1, gold);
    }
    // A pediment in the middle with a gold crest.
    for (let i = 0; i < 18; i++) {
      const hw = Math.round(4 + i * 1.25);
      p.rect(cx - hw, 18 + i, hw * 2, 1, marble);
      p.px(cx - hw, 18 + i, gold);
      p.px(cx + hw - 1, 18 + i, gold);
    }
    p.rect(cx - 26, 36, 52, 2, gold);
    p.disc(cx - 0.5, 28, 5, gold);
    p.disc(cx - 0.5, 28, 4, plum);
    p.rect(cx - 3, 26, 6, 1, goldL);
    p.px(cx - 3, 25, goldL);
    p.px(cx - 1, 24, goldL);
    p.px(cx + 1, 24, goldL);
    p.px(cx + 2, 25, goldL);
    p.rect(cx - 2, 28, 4, 2, goldL);
    p.rect(cx - 1, 10, 2, 8, gold);
    p.disc(cx - 0.5, 9, 2, goldL);
    // Marble walls.
    p.rect(2, 46, SHOP_W - 4, b - 54, marble);
    for (let y = 50; y < b - 8; y += 6) p.line(2 + ((y * 7) % 40), y, 12 + ((y * 7) % 40), y + 2, vein);
    for (let y = 53; y < b - 8; y += 8) p.line(60 + ((y * 5) % 40), y, 70 + ((y * 5) % 40), y + 2, vein);
    // Gold cornice with dentils.
    p.rect(0, 46, SHOP_W, 2, gold);
    p.rect(0, 46, SHOP_W, 1, goldL);
    for (let x = 1; x < SHOP_W - 1; x += 3) p.rect(x, 48, 2, 2, marble);
    p.rect(1, 50, SHOP_W - 2, 1, goldD);
    // The sign band, dark plum with a gold edge. The scene writes the name on it.
    p.rect(26, 51, 60, 12, gold);
    p.rect(27, 52, 58, 10, plum);
    p.rect(28, 53, 56, 1, plumL);
    // Pilasters with gold capitals.
    for (const x of [3, 39, 69, 105]) {
      const y = x === 3 || x === 105 ? 54 : 66;
      p.rect(x, y, 4, b - 8 - y, C.white);
      p.rect(x + 3, y, 1, b - 8 - y, vein);
      p.rect(x + 1, y + 2, 1, b - 12 - y, vein);
      p.rect(x - 1, y - 2, 6, 2, gold);
      p.rect(x, y - 3, 4, 1, goldL);
      p.rect(x - 1, b - 10, 6, 2, gold);
    }
    // Tall arched display windows.
    const showcase = (x) => {
      const y = 64;
      const w = 28;
      const h = 42;
      const shape = (xx, yy, ww, hh, c) => {
        const r = Math.floor(ww / 2);
        p.rect(xx, yy + r, ww, hh - r, c);
        for (let j = 0; j < r; j++) {
          const half = Math.round(Math.sqrt(r * r - (r - j) * (r - j)));
          p.rect(xx + r - half, yy + j, half * 2, 1, c);
        }
      };
      shape(x - 1, y - 1, w + 2, h + 2, goldD);
      shape(x, y, w, h, gold);
      shape(x + 1, y + 1, w - 2, h - 2, '#ffeec8');
      // Velvet wall and a polished floor.
      for (let yy = y + 2; yy < y + h - 8; yy += 2) p.rect(x + 2, yy, w - 4, 1, '#ffe4b0');
      p.rect(x + 1, y + h - 8, w - 2, 7, '#8a5040');
      p.rect(x + 1, y + h - 8, w - 2, 1, '#c88a60');
      return { x, y, w, h };
    };
    const a = showcase(9);
    const c = showcase(75);
    // A chandelier in each window.
    for (const win of [a, c]) {
      const mx = win.x + 14;
      p.rect(mx, win.y + 4, 1, 5, goldD);
      p.rect(mx - 5, win.y + 9, 11, 1, gold);
      p.rect(mx - 3, win.y + 11, 7, 1, gold);
      for (const dx of [-5, -2, 1, 4]) {
        p.px(mx + dx, win.y + 8, goldL);
        p.px(mx + dx, win.y + 10, C.white);
      }
      p.px(mx, win.y + 12, C.ice);
      p.px(mx, win.y + 13, C.white);
    }
    // Left window: a plum velvet sofa and a tall lamp.
    const sy = a.y + a.h - 8;
    p.rrect(a.x + 4, sy - 9, 15, 7, '#7a3a7e');
    p.rect(a.x + 3, sy - 6, 2, 5, '#6a2e6e');
    p.rect(a.x + 18, sy - 6, 2, 5, '#6a2e6e');
    p.rect(a.x + 5, sy - 5, 13, 3, '#94509a');
    p.px(a.x + 4, sy - 1, gold);
    p.px(a.x + 19, sy - 1, gold);
    p.rect(a.x + 23, sy - 16, 1, 16, goldD);
    p.rect(a.x + 21, sy - 20, 5, 4, C.butter);
    // Right window: a gilded mirror and a great vase on a stand.
    const my = c.y + 17;
    p.ell(c.x + 8, my + 6, 5, 8, gold);
    p.ell(c.x + 8, my + 6, 3, 6, '#cfe8f0');
    p.px(c.x + 7, my + 3, C.white);
    p.rect(c.x + 17, sy - 5, 8, 5, C.white);
    p.rect(c.x + 17, sy - 5, 8, 1, gold);
    p.ell(c.x + 21, sy - 11, 4, 6, '#3f6fb8');
    p.rect(c.x + 18, sy - 12, 7, 1, C.white);
    p.rect(c.x + 19, sy - 18, 4, 2, '#3f6fb8');
    for (const [dx, col] of [[-3, C.rose], [0, C.tomato], [3, C.butter]]) p.px(c.x + 21 + dx, sy - 20, col);
    // Grand double doors of glass and gold.
    const dy = 66;
    const dh = b - 8 - dy;
    p.rect(44, dy - 2, 24, dh + 2, gold);
    p.rect(43, dy - 2, 26, 1, goldL);
    p.rect(46, dy, 20, dh, '#fff4d4');
    p.rect(56, dy, 1, dh, gold);
    for (let y = dy + 12; y < dy + dh; y += 8) p.rect(46, y, 20, 1, gold);
    p.rect(46, dy + 12, 20, 2, gold);
    // Fan light.
    for (let k = 0; k < 5; k++) p.line(56, dy + 11, 46 + k * 5, dy + 1, gold);
    p.rect(52, dy + dh - 14, 2, 5, goldD);
    p.rect(59, dy + dh - 14, 2, 5, goldD);
    // A small canopy over the doors, with gold fringe.
    for (let i = 0; i < 5; i++) p.rect(42 - i, 62 + i, 28 + i * 2, 1, i % 2 ? plum : plumL);
    for (let x = 38; x < 74; x += 2) p.px(x, 67, goldL);
    p.rect(38, 66, 36, 1, gold);
    // Plinth, marble steps and a red carpet.
    p.rect(0, b - 8, SHOP_W, 2, gold);
    p.rect(0, b - 6, SHOP_W, 4, '#d8d2c4');
    p.rect(0, b - 6, SHOP_W, 1, C.white);
    for (let k = 0; k < 3; k++) p.rect(38 - k * 3, b - 6 + k * 2, 36 + k * 6, 2, k % 2 ? '#e8e2d4' : C.white);
    p.rect(48, b - 8, 16, 8, '#b82030');
    p.rect(48, b - 8, 1, 8, gold);
    p.rect(63, b - 8, 1, 8, gold);
    // Round topiaries in gold urns either side of the doors.
    for (const x of [41, 71]) {
      p.rect(x - 2, b - 14, 5, 6, gold);
      p.rect(x - 3, b - 15, 7, 1, goldL);
      p.rect(x, b - 21, 1, 6, C.cocoa);
      p.disc(x, b - 24, 4, C.moss);
      p.disc(x - 1, b - 25, 2, C.leaf);
    }
    // Gold wall lamps.
    for (const x of [5, 107]) {
      p.rect(x - 1, 62, 3, 1, gold);
      p.rect(x - 1, 63, 3, 4, C.butter);
      p.px(x, 64, C.white);
      p.rect(x - 1, 67, 3, 1, gold);
    }
    if (ART[season].snow) WW.snowCap(p);
    shops[season] = p.outline().canvas();
    return shops[season];
  };

  let board = null;
  WW.boardCanvas = function () {
    if (board) return board;
    const p = new Px(24, 26);
    p.rect(4, 14, 2, 12, C.cocoa);
    p.rect(18, 14, 2, 12, C.cocoa);
    p.rect(2, 1, 20, 15, C.bark);
    p.rect(3, 2, 18, 13, '#d9b48a');
    p.rect(5, 4, 7, 8, C.paper);
    p.rect(14, 5, 5, 6, C.butter);
    p.px(7, 6, C.ink);
    p.px(9, 8, C.ink);
    p.px(8, 10, C.ink);
    board = p.outline().canvas();
    return board;
  };

  // The leaderboard: a big chalkboard with a trophy on top. The scene writes the names on it.
  let ranks = null;
  WW.ranksCanvas = function () {
    if (ranks) return ranks;
    const p = new Px(96, 106);
    for (const x of [8, 82]) {
      p.rect(x, 30, 6, 76, C.cocoa);
      p.rect(x + 1, 30, 2, 76, C.bark);
      p.rect(x - 2, 100, 10, 6, '#8f9498');
      p.rect(x - 2, 100, 10, 1, '#a8acb0');
    }
    p.rect(1, 22, 94, 68, C.gold);
    p.rect(1, 22, 94, 1, C.butter);
    p.rect(3, 24, 90, 64, C.cocoa);
    p.rect(4, 25, 88, 62, '#2f4a48');
    for (let i = 0; i < 90; i += 11) p.rect(4 + ((i * 7) % 80), 30 + (i % 50), 6, 1, '#375450');
    // The ribbon for the title.
    p.rect(10, 12, 76, 12, C.tomato);
    p.rect(10, 12, 76, 1, '#ff8a6a');
    p.rect(10, 23, 76, 1, C.brick);
    p.rect(5, 15, 6, 9, C.brick);
    p.rect(85, 15, 6, 9, C.brick);
    // The trophy.
    p.rect(42, 2, 12, 7, C.butter);
    p.rect(43, 3, 2, 5, '#fff0a0');
    p.rect(39, 3, 3, 3, C.butter);
    p.rect(54, 3, 3, 3, C.butter);
    p.rect(40, 4, 1, 1, C.cocoa);
    p.rect(55, 4, 1, 1, C.cocoa);
    p.rect(46, 9, 4, 2, C.gold);
    p.rect(43, 11, 10, 2, C.gold);
    ranks = p.outline().canvas();
    return ranks;
  };

  const shelves = {};
  WW.shelfCanvas = function (full) {
    const key = full ? 'full' : 'bare';
    if (shelves[key]) return shelves[key];
    const p = new Px(30, 24);
    p.rect(2, 4, 2, 20, C.bark);
    p.rect(26, 4, 2, 20, C.bark);
    p.rect(1, 2, 28, 3, C.wood);
    p.rect(2, 12, 26, 2, C.honey);
    p.rect(2, 21, 26, 2, C.honey);
    if (full) {
      for (const [x, y, c] of [[6, 8, C.tomato], [13, 8, C.butter], [20, 8, C.leaf], [8, 17, '#e8d0a0'], [16, 17, '#f28a2e']]) p.rect(x, y, 5, 4, c);
    }
    shelves[key] = p.outline().canvas();
    return shelves[key];
  };

  // A signpost. The arrow points where it leads.
  const gates = {};
  WW.gateCanvas = function (left) {
    const key = left ? 'l' : 'r';
    if (gates[key]) return gates[key];
    let p = new Px(28, 44);
    p.rect(13, 8, 3, 36, C.bark);
    const rows = ['....################....', '...#################....', '..##################....', '...#################....', '....################....'];
    p.grid(2, 8, rows.concat(rows.slice(0, 2)).map((r) => r), { '#': C.wood });
    for (let i = 0; i < 12; i++) p.px(8 + i, 11, C.honey);
    if (!left) p = p.flip();
    p.rect(11, 42, 7, 2, C.cocoa);
    gates[key] = p.outline().canvas();
    return gates[key];
  };

  // Where things sit on a building of this size.
  WW.exteriorInfo = function (room) {
    const w = 88 + (room.cols - 12) * 6;
    const h = 44 + (room.rows - 5) * 6;
    const roofH = 26;
    const W = w + 28;
    const H = h + roofH + 14;
    const left = 14;
    const base = H - 1;
    const top = base - h;
    const doorX = Math.round(left + w / 2 - 8);
    const windows = [];
    for (let x = left + 7; x + 14 <= doorX - 3; x += 20) windows.push({ x, y: base - 28, w: 14, h: 14 });
    for (let x = left + w - 21; x >= doorX + 19; x -= 20) windows.push({ x, y: base - 28, w: 14, h: 14 });
    if (h >= 62) for (let x = left + 9; x + 14 <= left + w - 7; x += 24) windows.push({ x, y: top + 5, w: 14, h: 12 });
    return { w, h, roofH, W, H, left, base, top, doorX, doorW: 16, doorH: 24, windows, chimney: { x: left + w - 24, y: top - roofH + 2 } };
  };
  const outsides = new Map();
  // A building, from what its owner has picked and how far the room has grown: its picture and where its windows are.
  WW.exteriorArt = function (ext, room, season) {
    const key = Object.keys(WW.EXTERIOR).map((slot) => ext[slot]).join() + `:${room.cols}x${room.rows}:${season}`;
    if (outsides.has(key)) return outsides.get(key);
    const art = WW.paintHouse(ext, room, season);
    if (outsides.size > 150) outsides.clear();
    outsides.set(key, art);
    return art;
  };
  WW.exteriorCanvas = (ext, room, season) => WW.exteriorArt(ext, room, season).canvas;

  const skies = {};
  WW.sunCanvas = function () {
    if (skies.sun) return skies.sun;
    const c = WW.makeCanvas(40, 40);
    const x = c.getContext('2d');
    for (const [r, a] of [[19, 0.12], [15, 0.2], [11, 0.5]]) {
      x.fillStyle = `rgba(255,224,130,${a})`;
      x.beginPath();
      x.arc(20, 20, r, 0, Math.PI * 2);
      x.fill();
    }
    const p = new Px(16, 16);
    p.disc(8, 8, 6, '#ffd84a');
    p.disc(7, 7, 4, '#ffec9a');
    x.drawImage(p.canvas(), 12, 12);
    skies.sun = c;
    return c;
  };
  WW.moonCanvas = function () {
    if (skies.moon) return skies.moon;
    const c = WW.makeCanvas(40, 40);
    const x = c.getContext('2d');
    for (const [r, a] of [[19, 0.08], [14, 0.14]]) {
      x.fillStyle = `rgba(210,220,255,${a})`;
      x.beginPath();
      x.arc(20, 20, r, 0, Math.PI * 2);
      x.fill();
    }
    const p = new Px(16, 16);
    p.disc(8, 8, 6, '#f4f0d8');
    for (let j = 0; j < 16; j++) {
      for (let i = 0; i < 16; i++) {
        if ((i - 11) ** 2 + (j - 6) ** 2 < 24) p.px(i, j, null);
      }
    }
    x.drawImage(p.canvas(), 12, 12);
    skies.moon = c;
    return c;
  };
  WW.cloudCanvas = function (i) {
    const key = 'cloud' + (i % 3);
    if (skies[key]) return skies[key];
    const p = new Px(44, 18);
    const blobs = [[[12, 11, 8, 5], [24, 9, 10, 7], [34, 12, 7, 4]], [[10, 12, 7, 4], [20, 10, 9, 6], [30, 11, 8, 5]], [[16, 11, 11, 5], [28, 11, 9, 5]]][i % 3];
    for (const [x, y, rx, ry] of blobs) p.ell(x, y, rx, ry, C.white);
    skies[key] = p.canvas();
    return skies[key];
  };
})((globalThis.WW = globalThis.WW || {}));
