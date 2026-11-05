// The restaurant itself: a cutaway inside a skirting board that grows as the room is expanded.
(function (WW) {
  const { Px, C } = WW;
  const T = WW.tone;

  const WORLD = {
    TILE: 16,
    DINING_Y: 104,
    STATION_X: 48,
    STATION_W: 24,
    STATION_Y: 34,
    WHEEL: { cx: 23, cy: 27, r: 19 },
  };
  WW.WORLD = WORLD;

  // Everything that depends on how big the room is.
  WW.metrics = function (room) {
    const W = room.cols * WORLD.TILE;
    const frontY = WORLD.DINING_Y + room.rows * WORLD.TILE;
    return {
      W,
      H: frontY + 18,
      cols: room.cols,
      rows: room.rows,
      frontY,
      doorX: (room.cols - 3) * WORLD.TILE,
      doorW: 32,
      slots: Math.min(14, Math.floor((W - WORLD.STATION_X) / WORLD.STATION_W)),
      windows: windowsFor(W),
    };
  };
  function windowsFor(W) {
    const out = [W - 42];
    for (let x = W - 42 - 110; x > 150; x -= 110) out.push(x);
    return out;
  }

  const FONT = {
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100',
    G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
    M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101',
    S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
    Y: '101101010010010', Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
    4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001110',
    '+': '000010111010000', '-': '000000111000000', '!': '010010010000010', '?': '110001010000010', '.': '000000000000010', ':': '000010000010000', '/': '001001010100100', ',': '000000000010100', "'": '010010000000000', '&': '010101010101011',
  };
  // Draws tiny pixel text straight onto a 2d context.
  WW.tinyText = function (ctx, text, x, y, color) {
    ctx.fillStyle = color || C.ink;
    let cx = Math.round(x);
    const yy = Math.round(y);
    for (const ch of String(text).toUpperCase()) {
      if (ch === ' ') {
        cx += 3;
        continue;
      }
      const g = FONT[ch];
      if (g) for (let i = 0; i < 15; i++) if (g[i] === '1') ctx.fillRect(cx + i % 3, yy + Math.floor(i / 3), 1, 1);
      cx += 4;
    }
    return cx - x;
  };
  WW.tinyWidth = (text) => {
    let w = 0;
    for (const ch of String(text)) w += ch === ' ' ? 3 : 4;
    return w - 1;
  };

  function paintFloorKitchen(p, m, st) {
    for (let y = 40; y < 88; y += 8) {
      for (let x = 0; x < m.W; x += 8) {
        const odd = ((x + y) / 8) % 2 === 0;
        p.rect(x, y, 8, 8, odd ? st.a : st.b);
        if (odd) p.px(x + 2, y + 3, T(st.a, -0.06));
        else p.px(x + 5, y + 5, T(st.b, -0.08));
      }
    }
    p.rect(0, 40, m.W, 2, st.edge);
    p.rect(0, 86, m.W, 2, T(st.edge, 0.15));
  }

  function paintFloorDining(p, m, st) {
    const top = WORLD.DINING_Y;
    const height = m.rows * WORLD.TILE;
    if (st.kind === 'planks') {
      for (let row = 0; row < height / 8; row++) {
        const y = top + row * 8;
        const shift = (row * 13) % 32;
        for (let x = -32; x < m.W; x += 32) {
          const c = st.c[(row * 3 + (x + 32) / 32) % st.c.length | 0];
          p.rect(x + shift, y, 32, 8, c);
          p.rect(x + shift, y + 7, 32, 1, st.seam);
          p.rect(x + shift, y, 1, 8, st.seam);
          p.px(x + shift + 8, y + 3, T(c, -0.15));
          p.px(x + shift + 20, y + 5, T(c, -0.15));
          p.px(x + shift + 3, y + 2, T(c, 0.2));
        }
      }
    } else if (st.kind === 'check') {
      for (let y = 0; y < height; y += 8) {
        for (let x = 0; x < m.W; x += 8) {
          const a = ((x + y) / 8) % 2 === 0;
          p.rect(x, top + y, 8, 8, a ? st.a : st.b);
          p.px(x + 2, top + y + 2, T(a ? st.a : st.b, 0.15));
        }
      }
    } else if (st.kind === 'terrazzo') {
      p.rect(0, top, m.W, height, st.a);
      for (let i = 0; i < (m.W * height) / 40; i++) {
        const x = (i * 37) % m.W;
        const y = (i * 53) % height;
        p.px(x, top + y, st.specks[i % st.specks.length]);
        if (i % 3 === 0) p.px(x + 1, top + y, st.specks[i % st.specks.length]);
      }
    } else {
      p.rect(0, top, m.W, height, st.a);
      for (let y = 0; y < height; y += 2) for (let x = (y % 4) * 1; x < m.W; x += 4) p.px(x, top + y, st.b);
    }
    p.rect(0, top, m.W, 2, T(st.seam || st.b || st.a, -0.3));
  }

  function paintBackWall(p, m, st) {
    p.rect(0, 0, m.W, 40, st.base);
    for (let x = 0; x < m.W; x += 12) {
      p.rect(x, 0, 6, 30, st.stripe);
      for (let y = 3; y < 30; y += 8) p.px(x + 2 + ((y >> 3) % 2) * 2, y, st.dot);
    }
    // wainscot
    p.rect(0, 28, m.W, 12, st.panel);
    p.rect(0, 28, m.W, 1, T(st.panel, 0.3));
    p.rect(0, 39, m.W, 1, st.rail);
    for (let x = 6; x < m.W; x += 16) p.rect(x, 30, 12, 7, st.panel2);
    // top rail where the gears sit
    p.rect(0, 0, m.W, 3, st.rail);
    p.rect(0, 3, m.W, 1, C.ink);
    // arched mouse hole windows
    for (const wx of m.windows) {
      p.rect(wx - 3, 7, 28, 22, '#6d4535');
      p.ell(wx + 11, 9, 14, 7, '#6d4535');
    }
    // shelf with jars, broken by the windows
    const left = 52;
    const right = m.windows[m.windows.length - 1] - 8;
    p.rect(left, 18, right - left, 2, '#c98f5a');
    p.rect(left, 20, right - left, 1, '#5a3a2a');
    for (let x = left + 6; x < right; x += 78) p.rect(x, 21, 2, 4, '#5a3a2a');
    const jars = [['#e8d0a0', C.iron], ['#f28a2e', C.brick], ['#8fd06a', C.moss], ['#e4372e', C.ink], ['#ffdd4a', C.bark], ['#a99ad6', C.plum], ['#fff1d6', C.tomato], ['#6fb0d8', C.deep]];
    for (let i = 0, x = left + 4; x < right - 8; x += 10 + (i % 3), i++) {
      const [c, lid] = jars[i % jars.length];
      p.rect(x, 11, 7, 7, c);
      p.rect(x + 1, 9, 5, 2, lid);
      p.px(x + 1, 12, C.white);
      p.px(x + 1, 13, C.white);
      p.rect(x, 17, 7, 1, T(c, -0.3));
    }
  }

  function paintWheelNook(p) {
    p.rect(0, 4, 47, 56, '#2a3f54');
    p.ell(23, 10, 23, 9, '#2a3f54');
    p.rect(46, 4, 2, 56, '#5a3a2a');
    for (let y = 8; y < 56; y += 7) {
      for (let x = 2 + (y % 2) * 3; x < 44; x += 9) p.rect(x, y, 4, 1, '#34506a');
    }
    p.rect(9, 44, 4, 12, C.iron);
    p.rect(33, 44, 4, 12, C.iron);
    p.rect(5, 54, 36, 3, C.iron);
    p.rect(5, 54, 36, 1, C.steel);
    p.rect(0, 57, 47, 3, '#5a3a2a');
  }

  function paintCounter(p, m) {
    const y = 88;
    p.rect(0, y, m.W, 8, '#e0b070');
    p.rect(0, y, m.W, 1, '#f4d8a0');
    p.rect(0, y + 7, m.W, 1, '#8a5a3c');
    for (let x = 12; x < m.W; x += 40) p.px(x, y + 3, '#c49a58');
    p.rect(0, y + 8, m.W, 8, '#8a5a3c');
    for (let x = 0; x < m.W; x += 4) {
      p.rect(x, y + 9, 2, 2, x % 8 === 0 ? C.tomato : C.paper);
      p.rect(x + 2, y + 9, 2, 2, x % 8 === 0 ? C.paper : C.tomato);
    }
    p.rect(0, y + 15, m.W, 1, '#5a3a2a');
  }

  // The front wall closes the room. The door gap is left for the scene, what shows through it depends on the hour.
  function paintFront(p, m) {
    const y = m.frontY;
    p.rect(0, y, m.W, 18, '#8a5a3c');
    p.rect(0, y, m.W, 1, '#c98f5a');
    p.rect(0, y + 14, m.W, 4, '#6d4535');
    for (let x = 0; x < m.W; x += 8) p.px(x + 2, y + 15, '#5a3a2a');
    p.rect(m.doorX - 2, y - 2, 2, 20, '#5a3a2a');
    p.rect(m.doorX + m.doorW, y - 2, 2, 20, '#5a3a2a');
    p.rect(m.doorX + 3, y - 6, m.doorW - 6, 5, '#a8805a');
    for (let x = m.doorX + 4; x < m.doorX + m.doorW - 4; x += 2) p.px(x, y - 4, '#7a553a');
  }

  const bgCache = new Map();
  // Paints a room of this size and style once, then reuses it.
  WW.backgroundCanvas = function (room, style) {
    const key = `${room.cols}x${room.rows}:${style.wall}:${style.floor}:${style.kitchen}`;
    if (bgCache.has(key)) return bgCache.get(key);
    const S = WW.ROOM_STYLES;
    const m = WW.metrics(room);
    const p = new Px(m.W, m.H);
    paintBackWall(p, m, S.wall[style.wall] || S.wall.teal);
    paintFloorKitchen(p, m, S.kitchen[style.kitchen] || S.kitchen.cream);
    paintWheelNook(p);
    paintFloorDining(p, m, S.floor[style.floor] || S.floor.oak);
    paintCounter(p, m);
    paintFront(p, m);
    const c = p.canvas();
    if (bgCache.size > 12) bgCache.clear();
    bgCache.set(key, c);
    return c;
  };

  // Small square previews for the style shop.
  const previewCache = {};
  WW.stylePreview = function (kind, id) {
    const key = kind + id;
    if (previewCache[key]) return previewCache[key];
    const room = { cols: 3, rows: 2 };
    const m = { W: 48, H: 32, rows: 2 };
    const p = new Px(48, 48);
    const S = WW.ROOM_STYLES[kind][id];
    if (kind === 'wall') {
      p.rect(0, 0, 48, 48, S.base);
      for (let x = 0; x < 48; x += 12) {
        p.rect(x, 0, 6, 34, S.stripe);
        for (let y = 3; y < 34; y += 8) p.px(x + 2, y, S.dot);
      }
      p.rect(0, 34, 48, 14, S.panel);
      p.rect(4, 37, 16, 8, S.panel2);
      p.rect(26, 37, 16, 8, S.panel2);
      p.rect(0, 34, 48, 1, T(S.panel, 0.3));
    } else if (kind === 'kitchen') {
      for (let y = 0; y < 48; y += 8) for (let x = 0; x < 48; x += 8) p.rect(x, y, 8, 8, ((x + y) / 8) % 2 === 0 ? S.a : S.b);
    } else {
      const tmp = new Px(48, 104 + 48);
      paintFloorDining(tmp, { W: 48, rows: 3 }, S);
      for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) p.d[y * 48 + x] = tmp.d[(y + 104) * 48 + x];
    }
    previewCache[key] = p.canvas();
    return previewCache[key];
  };

  // Stations: tea tin stove, bottle cap wok, thimble pot. The pose is the fire state.
  const stCache = {};
  WW.stationCanvas = function (type, lit, frame) {
    const key = type + (lit ? 1 : 0) + (lit ? frame % 2 : 0);
    if (stCache[key]) return stCache[key];
    const p = new Px(24, 26);
    if (type === 'stove') {
      p.rect(2, 13, 20, 12, '#2f7f86');
      p.rect(3, 15, 18, 1, C.butter);
      p.rect(3, 22, 18, 1, C.butter);
      for (let x = 4; x < 20; x += 4) p.px(x, 18, C.butter);
      p.rect(8, 18, 8, 3, C.deep);
      p.rect(1, 11, 22, 3, C.steel);
      p.rect(1, 11, 22, 1, C.white);
      p.rect(5, 6, 14, 5, C.iron);
      p.rect(5, 6, 14, 1, C.steel);
      p.rect(19, 7, 5, 1, C.ink);
      if (lit) {
        const fl = frame % 2 ? ['.#..#.#.', '##.###.#'] : ['#..#..#.', '#.###.##'];
        p.grid(8, 9, fl, { '#': C.gold });
        p.px(10, 10, C.butter);
        p.px(14, 10, C.butter);
      }
    } else if (type === 'wok') {
      p.rect(4, 16, 16, 9, C.iron);
      p.rect(5, 18, 14, 1, lit ? (frame % 2 ? C.tomato : C.gold) : '#3a3a48');
      p.rect(5, 20, 14, 1, lit ? (frame % 2 ? C.gold : C.tomato) : '#3a3a48');
      p.rect(5, 22, 14, 1, lit ? C.tomato : '#3a3a48');
      p.rect(3, 15, 18, 2, C.ink);
      p.ell(12, 11, 9, 4, lit ? C.brick : '#8f3a2e');
      p.ell(12, 10, 7, 2, '#e8d0a8');
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        p.px(12 + Math.cos(a) * 10, 11 + Math.sin(a) * 5, C.brick);
      }
      if (lit) {
        const fl = frame % 2 ? ['#.#..#.#', '.##.##.#'] : ['.#.#..#.', '##.#.##.'];
        p.grid(8, 13, fl, { '#': C.gold });
      }
    } else {
      p.rect(5, 21, 14, 4, C.ink);
      p.rect(6, 22, 12, 2, lit ? C.tomato : '#3a3a48');
      if (lit) p.px(9 + (frame % 2) * 4, 22, C.butter);
      p.grid(4, 7, ['..############..', '.##############.', '.##############.', '################', '################', '################', '################', '################', '################', '################', '################', '.##############.', '..############..', '...##########...'], { '#': C.steel });
      for (let j = 0; j < 5; j++) for (let i = 0; i < 7; i++) p.px(5 + i * 2 + (j % 2), 10 + j * 2, C.iron);
      p.rect(5, 8, 14, 1, C.white);
      p.ell(12, 8, 6, 1, lit ? C.oat : '#7f8a94');
      if (lit && frame % 2) p.px(10, 7, C.white);
      if (lit && !(frame % 2)) p.px(14, 7, C.white);
    }
    const c = p.outline().canvas();
    stCache[key] = c;
    return c;
  };
  let lockedStation = null;
  WW.lockedStationCanvas = function () {
    if (lockedStation) return lockedStation;
    const p = new Px(24, 26);
    p.rect(4, 12, 16, 13, C.wood);
    p.rect(4, 12, 16, 1, C.honey);
    p.rect(4, 18, 16, 1, C.bark);
    p.rect(11, 12, 2, 13, C.bark);
    lockedStation = p.outline().canvas();
    return lockedStation;
  };

  // The wheel, turned by real passes. Eight rotation frames of spokes.
  const wheelFrames = [];
  WW.wheelCanvas = function (i) {
    const n = ((i % 8) + 8) % 8;
    if (wheelFrames[n]) return wheelFrames[n];
    const r = WORLD.WHEEL.r;
    const size = r * 2 + 3;
    const p = new Px(size, size);
    const cx = r + 1;
    const cy = r + 1;
    p.disc(cx, cy, r, C.steel);
    p.disc(cx, cy, r - 2, '#1f3040');
    for (let k = 0; k < 8; k++) {
      const a = ((k + n / 8) / 8) * Math.PI * 2;
      p.line(cx, cy, cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2), C.iron);
    }
    p.disc(cx, cy, 2, C.gold);
    p.px(cx, cy, C.white);
    for (let k = 0; k < 24; k++) {
      const a = ((k + n / 3) / 24) * Math.PI * 2;
      p.px(cx + Math.cos(a) * (r - 1), cy + Math.sin(a) * (r - 1), k % 2 ? C.white : C.iron);
    }
    wheelFrames[n] = p.canvas();
    return wheelFrames[n];
  };

  const gearFrames = {};
  WW.gearCanvas = function (r, i) {
    const n = ((i % 4) + 4) % 4;
    const key = r + ':' + n;
    if (gearFrames[key]) return gearFrames[key];
    const size = r * 2 + 3;
    const p = new Px(size, size);
    const c = r + 1;
    p.disc(c, c, r - 1, C.gold);
    for (let k = 0; k < 8; k++) {
      const a = ((k + n / 4) / 8) * Math.PI * 2;
      p.px(c + Math.cos(a) * r, c + Math.sin(a) * r, C.gold);
      p.px(c + Math.cos(a) * (r - 1), c + Math.sin(a) * (r - 1), C.butter);
    }
    p.disc(c, c, 1, C.bark);
    gearFrames[key] = p.outline().canvas();
    return gearFrames[key];
  };

  // Robot mop body, roaming the floor.
  const robotFrames = [];
  WW.robotCanvas = function (f) {
    const n = f % 2;
    if (robotFrames[n]) return robotFrames[n];
    const p = new Px(14, 10);
    p.ell(7, 5, 6, 4, C.iron);
    p.ell(7, 4, 5, 3, C.steel);
    p.ell(7, 3, 2, 1, C.teal);
    p.px(7, 3, n ? C.mint : C.leaf);
    p.px(2, 7, n ? C.sky : C.ice);
    p.px(12, 7, n ? C.ice : C.sky);
    robotFrames[n] = p.outline().canvas();
    return robotFrames[n];
  };

  // Soft round glows for lamps during quiet hours.
  const glowCache = {};
  WW.glowCanvas = function (r, color) {
    const key = r + color;
    if (glowCache[key]) return glowCache[key];
    const size = r * 2;
    const c = WW.makeCanvas(size, size);
    const x = c.getContext('2d');
    for (const [rr, a] of [[1, 0.1], [0.75, 0.14], [0.5, 0.2], [0.28, 0.3]]) {
      x.fillStyle = color;
      x.globalAlpha = a;
      x.beginPath();
      x.arc(r, r, r * rr, 0, Math.PI * 2);
      x.fill();
    }
    glowCache[key] = c;
    return c;
  };

  // Icons used across the page and as mouse pointers.
  const uiCache = {};
  // The mailbox by the door. The flag goes up when something is waiting.
  const mailboxes = {};
  WW.mailboxCanvas = function (flag) {
    const key = flag ? 'up' : 'down';
    if (mailboxes[key]) return mailboxes[key];
    const p = new WW.Px(16, 24);
    p.rect(7, 12, 2, 12, C.bark);
    p.rect(2, 4, 12, 8, '#3f7fb0');
    p.ell(8, 4, 6, 2, '#5f9fd0');
    p.rect(2, 4, 12, 1, '#5f9fd0');
    p.rect(4, 7, 8, 1, '#2f5f88');
    if (flag) {
      p.rect(13, 0, 1, 6, C.ink);
      p.rect(14, 0, 2, 3, C.tomato);
    } else p.rect(13, 7, 3, 1, C.tomato);
    p.outline();
    mailboxes[key] = p.canvas();
    return mailboxes[key];
  };

  const ICONS = {
    sun(p) {
      p.disc(8, 8, 4, C.butter);
      p.disc(7, 7, 2, '#ffec9a');
      for (const [x, y] of [[8, 1], [8, 15], [1, 8], [15, 8], [3, 3], [13, 3], [3, 13], [13, 13]]) p.px(x, y, C.gold);
    },
    moon(p) {
      p.disc(8, 8, 6, '#f4f0d8');
      for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) if ((i - 11) ** 2 + (j - 6) ** 2 < 24) p.px(i, j, null);
      p.px(13, 3, C.butter);
      p.px(11, 13, C.butter);
    },
    cloud(p) {
      p.ell(8, 9, 6, 3, C.white);
      p.ell(5, 9, 3, 2, C.white);
      p.ell(10, 7, 4, 3, C.white);
    },
    rain(p) {
      p.ell(8, 5, 6, 3, '#c8d4dc');
      p.ell(5, 5, 3, 2, '#c8d4dc');
      for (const [x, y] of [[4, 10], [8, 11], [12, 10], [6, 13], [10, 14]]) p.rect(x, y, 1, 2, C.sky);
    },
    storm(p) {
      p.ell(8, 4, 6, 3, '#8f9fac');
      p.ell(5, 5, 3, 2, '#8f9fac');
      p.grid(6, 7, ['..##', '.##.', '####', '..#.', '.#..'], { '#': C.butter });
    },
    fog(p) {
      for (const [x, y, w] of [[2, 4, 11], [4, 7, 10], [1, 10, 12], [5, 13, 8]]) p.rect(x, y, w, 1, '#d8dee2');
    },
    snow(p) {
      for (const [x, y] of [[4, 4], [11, 3], [7, 8], [3, 12], [12, 11]]) {
        p.rect(x - 1, y, 3, 1, C.white);
        p.rect(x, y - 1, 1, 3, C.white);
      }
    },
    petal(p) {
      for (const [x, y] of [[4, 4], [11, 6], [6, 11], [12, 12]]) p.rect(x, y, 2, 2, C.rose);
    },
    leaf(p) {
      for (const [x, y, c] of [[4, 4, C.gold], [11, 6, C.tomato], [6, 11, C.tomato], [12, 12, C.gold]]) p.rect(x, y, 3, 2, c);
    },
    out(p) {
      p.rect(2, 1, 8, 14, C.bark);
      p.rect(3, 2, 6, 12, C.wood);
      p.px(8, 8, C.butter);
      p.rect(9, 7, 5, 2, C.leaf);
      p.rect(12, 5, 1, 6, C.leaf);
      p.rect(13, 6, 1, 4, C.leaf);
    },
    inn(p) {
      p.grid(1, 1, ['......##......', '....######....', '..##########..', '##############'], { '#': C.tomato });
      p.rect(3, 5, 10, 9, C.oat);
      p.rect(6, 8, 4, 6, C.bark);
    },
    arrange(p) {
      p.rect(3, 2, 2, 12, C.bark);
      p.rect(3, 8, 9, 2, C.wood);
      p.rect(10, 8, 2, 6, C.bark);
      p.rect(3, 2, 7, 2, C.wood);
    },
    mail(p) {
      p.rect(1, 4, 14, 9, C.paper);
      p.line(1, 4, 8, 9, '#b8a890');
      p.line(15, 4, 8, 9, '#b8a890');
      p.px(8, 9, C.tomato);
    },
    wallet(p) {
      p.rect(1, 4, 14, 10, C.cocoa);
      p.rect(2, 3, 11, 2, '#8a5a3c');
      p.rect(9, 7, 6, 4, C.butter);
      p.px(11, 9, C.ink);
    },
    trophy(p) {
      p.rect(5, 2, 6, 6, C.butter);
      p.rect(3, 3, 2, 3, C.gold);
      p.rect(11, 3, 2, 3, C.gold);
      p.rect(7, 8, 2, 3, C.gold);
      p.rect(5, 11, 6, 2, C.cocoa);
    },
    lock(p) {
      p.rect(4, 7, 8, 7, C.butter);
      p.rect(5, 3, 1, 4, C.steel);
      p.rect(10, 3, 1, 4, C.steel);
      p.rect(5, 2, 6, 1, C.steel);
      p.px(8, 10, C.ink);
    },
    unlock(p) {
      p.rect(4, 7, 8, 7, C.leaf);
      p.rect(10, 3, 1, 4, C.steel);
      p.rect(5, 2, 6, 1, C.steel);
      p.rect(5, 3, 1, 1, C.steel);
      p.px(8, 10, C.ink);
    },
    // A folded green banknote.
    cash(p) {
      p.rect(0, 5, 14, 8, '#3f8f4a');
      p.rect(2, 3, 14, 8, '#6fbf6a');
      p.rect(3, 4, 12, 6, '#8fd68a');
      p.disc(9, 7, 2, '#3f8f4a');
      p.rect(9, 5, 1, 5, C.paper);
      p.rect(8, 6, 3, 1, C.paper);
      p.rect(8, 8, 3, 1, C.paper);
      p.px(4, 5, '#3f8f4a');
      p.px(14, 9, '#3f8f4a');
    },
    // A sleeping eye with a little z.
    wink(p) {
      p.grid(0, 6, ['##..........##', '.##........##.', '..##########..', '....######....'], { '#': '#d9ccff' });
      for (const x of [2, 6, 10]) p.rect(x, 10, 2, 3, '#d9ccff');
      p.grid(10, 0, ['#####', '...#.', '..#..', '.#...', '#####'], { '#': C.butter });
    },
    star(p) {
      p.grid(1, 2, ['......#.......', '.....###......', '.....###......', '##############', '.############.', '..##########..', '...########...', '...###..###...', '..##......##..'], { '#': C.butter });
    },
    kitchen(p) {
      p.rect(3, 6, 10, 7, C.iron);
      p.rect(1, 8, 2, 2, C.iron);
      p.rect(13, 8, 2, 2, C.iron);
      p.rect(2, 4, 12, 2, C.steel);
      p.rect(7, 2, 2, 2, C.ink);
      p.px(5, 8, C.steel);
    },
    basket(p) {
      p.rect(2, 8, 12, 6, C.honey);
      for (let x = 3; x < 13; x += 3) p.rect(x, 8, 1, 6, C.bark);
      p.rect(2, 10, 12, 1, C.bark);
      p.line(4, 8, 6, 2, C.bark);
      p.line(12, 8, 10, 2, C.bark);
      p.rect(6, 2, 4, 1, C.bark);
    },
    book(p) {
      p.rect(2, 3, 12, 11, C.tomato);
      p.rect(3, 4, 10, 8, C.paper);
      p.rect(8, 4, 1, 8, C.oat);
      p.rect(4, 6, 3, 1, C.iron);
      p.rect(4, 8, 3, 1, C.iron);
      p.rect(10, 6, 2, 1, C.iron);
    },
    staff(p) {
      p.disc(8, 8, 5, '#e8a95a');
      p.rect(5, 2, 6, 3, C.paper);
      p.rect(6, 7, 1, 2, C.ink);
      p.rect(9, 7, 1, 2, C.ink);
      p.px(8, 10, C.brick);
      p.rect(4, 13, 8, 2, C.paper);
    },
    chair(p) {
      p.rect(4, 2, 2, 12, C.wood);
      p.rect(4, 8, 9, 2, C.honey);
      p.rect(11, 9, 2, 5, C.wood);
      p.rect(4, 2, 8, 2, C.wood);
    },
    paw(p) {
      p.ell(8, 10, 4, 3, C.rose);
      for (const [x, y] of [[3, 7], [6, 4], [10, 4], [13, 7]]) p.disc(x, y, 1, C.rose);
    },
    street(p) {
      p.rect(7, 2, 2, 13, C.iron);
      p.rect(2, 3, 11, 4, C.teal);
      p.rect(5, 8, 10, 4, C.tomato);
      p.px(13, 5, C.teal);
    },
    orders(p) {
      p.rect(3, 1, 10, 14, C.paper);
      p.rect(5, 4, 6, 1, C.iron);
      p.rect(5, 6, 6, 1, C.iron);
      p.rect(5, 8, 4, 1, C.iron);
      p.rect(9, 11, 3, 2, C.tomato);
      p.rect(7, 0, 2, 2, C.tomato);
    },
    diary(p) {
      p.rect(3, 2, 10, 12, C.lilac);
      p.rect(4, 3, 8, 10, C.paper);
      p.rect(5, 5, 6, 1, C.iron);
      p.rect(5, 7, 6, 1, C.iron);
      p.rect(5, 9, 4, 1, C.iron);
    },
    wheel(p) {
      p.disc(8, 8, 6, C.steel);
      p.disc(8, 8, 4, 0);
      p.line(8, 2, 8, 14, C.iron);
      p.line(2, 8, 14, 8, C.iron);
      p.px(8, 8, C.gold);
    },
    gear(p) {
      p.disc(8, 8, 4, C.iron);
      for (const [x, y] of [[8, 2], [8, 14], [2, 8], [14, 8], [4, 4], [12, 4], [4, 12], [12, 12]]) p.rect(x - 1, y - 1, 2, 2, C.iron);
      p.disc(8, 8, 1, C.paper);
    },
    sound(p) {
      p.rect(3, 6, 3, 4, C.iron);
      p.grid(6, 3, ['..#', '.##', '###', '###', '###', '.##', '..#'], { '#': C.iron });
      p.px(11, 6, C.iron);
      p.px(12, 8, C.iron);
      p.px(11, 10, C.iron);
    },
    mute(p) {
      p.rect(3, 6, 3, 4, C.iron);
      p.grid(6, 3, ['..#', '.##', '###', '###', '###', '.##', '..#'], { '#': C.iron });
      p.line(10, 6, 14, 10, C.tomato);
      p.line(14, 6, 10, 10, C.tomato);
    },
    lunch(p) {
      p.rect(2, 6, 12, 8, C.teal);
      p.rect(2, 6, 12, 2, T(C.teal, 0.2));
      p.rect(7, 3, 2, 3, C.iron);
      p.rect(5, 3, 6, 1, C.iron);
      p.rect(7, 8, 2, 2, C.butter);
    },
    // Pointer shapes, the hot spot is the top left.
    broom(p) {
      p.line(2, 1, 9, 9, C.bark);
      p.line(3, 1, 10, 9, C.wood);
      p.grid(7, 8, ['..###.', '.#####', '######', '#####.', '.###..', '.#.#..'], { '#': C.butter });
      p.line(8, 12, 10, 14, C.gold);
    },
    hand(p) {
      p.grid(2, 1, ['..#.......', '.###.#....', '.###.##.#.', '.###.##.##', '.#########', '.#########', '##########', '##########', '.#########', '..#######.', '...#####..'], { '#': '#f7c4a0' });
      p.px(4, 2, C.white);
    },
    shake(p) {
      p.grid(1, 1, ['..####....', '.######...', '########..', '.######...', '...##.....'], { '#': C.leaf });
      p.rect(4, 6, 2, 8, C.bark);
      p.px(9, 7, C.gold);
      p.px(11, 10, C.leaf);
      p.px(8, 12, C.gold);
      p.line(12, 2, 14, 4, C.ink);
      p.line(13, 6, 15, 7, C.ink);
    },
    pointer(p) {
      p.grid(1, 1, ['#.......', '##......', '###.....', '####....', '#####...', '######..', '#######.', '####....', '#.##....', '...##...', '...##...'], { '#': C.paper });
    },
    pan(p) {
      p.ell(7, 7, 6, 4, C.iron);
      p.ell(7, 6, 5, 3, C.steel);
      p.rect(12, 8, 4, 2, C.bark);
      p.px(5, 5, C.butter);
      p.px(8, 6, C.tomato);
    },
    plate(p) {
      p.ell(7, 8, 6, 4, C.paper);
      p.ell(7, 8, 4, 2, C.oat);
      p.px(6, 7, C.tomato);
      p.px(8, 8, C.leaf);
    },
    chat(p) {
      p.rrect(1, 2, 13, 9, C.paper);
      p.rect(4, 11, 3, 2, C.paper);
      p.rect(4, 13, 1, 1, C.paper);
      for (const x of [4, 7, 10]) p.px(x, 6, C.ink);
    },
    magnify(p) {
      p.disc(6, 6, 4, C.iron);
      p.disc(6, 6, 3, C.ice);
      p.line(9, 9, 14, 14, C.bark);
      p.line(10, 9, 15, 14, C.wood);
      p.px(5, 4, C.white);
    },
    door(p) {
      p.rect(3, 1, 10, 14, C.bark);
      p.rect(4, 2, 8, 12, C.wood);
      p.px(10, 8, C.butter);
      p.rect(2, 14, 12, 1, C.cocoa);
    },
    grab(p) {
      p.grid(2, 3, ['.##.##.##.', '##########', '##########', '##########', '##########', '.########.', '..######..'], { '#': '#f7c4a0' });
      for (const x of [4, 7, 10]) p.px(x, 3, C.cocoa);
    },
    move(p) {
      p.grid(1, 1, ['......##......', '.....####.....', '......##......', '......##......', '..#...##...#..', '.##...##...##.', '##############', '##############', '.##...##...##.', '..#...##...#..', '......##......', '......##......', '.....####.....', '......##......'], { '#': C.paper });
    },
    tree(p) {
      p.disc(8, 6, 5, C.leaf);
      p.rect(7, 10, 2, 5, C.bark);
      p.px(6, 5, C.tomato);
    },
    expand(p) {
      p.rect(2, 2, 12, 12, C.oat);
      p.rect(2, 2, 12, 1, C.bark);
      p.rect(2, 13, 12, 1, C.bark);
      p.rect(2, 2, 1, 12, C.bark);
      p.rect(13, 2, 1, 12, C.bark);
      p.rect(7, 5, 2, 6, C.tomato);
      p.rect(5, 7, 6, 2, C.tomato);
    },
  };
  WW.iconCanvas = function (name) {
    if (uiCache[name]) return uiCache[name];
    const p = new Px(16, 16);
    (ICONS[name] || ICONS.pointer)(p);
    uiCache[name] = p.outline().canvas();
    return uiCache[name];
  };

  // Turns an icon into a mouse pointer, doubled so it reads at normal pointer size.
  const cursorCache = {};
  WW.cursorFor = function (name) {
    if (cursorCache[name] !== undefined) return cursorCache[name];
    let css = 'pointer';
    try {
      const icon = WW.iconCanvas(name);
      const c = WW.makeCanvas(32, 32);
      const x = c.getContext('2d');
      x.imageSmoothingEnabled = false;
      x.drawImage(icon, 0, 0, 32, 32);
      css = `url(${c.toDataURL()}) 4 4, pointer`;
    } catch (e) {
      css = 'pointer';
    }
    cursorCache[name] = css;
    return css;
  };
})((globalThis.WW = globalThis.WW || {}));
