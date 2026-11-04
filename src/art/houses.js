// A building made of parts. Each part has its own painter, so any wall can go with any roof, on any size of room.
(function (WW) {
  const { Px, C } = WW;
  const T = WW.tone;
  const INK = '#3a2340';

  // Shapes used by several parts.

  function gable(p, cx, top, base, half, a, b, c, inset = 0.25) {
    const H = base - top;
    for (let i = 0; i < H; i++) {
      const t = (i + 1) / H;
      const hw = Math.round(half * (inset + (1 - inset) * t));
      p.rect(cx - hw, top + i, hw * 2, 1, i % 4 === 3 ? c : i % 8 < 4 ? a : b);
    }
  }
  // The curved roof of East Asia: a concave slope with tile lines, corners lifting at the eaves.
  function curvedRoof(p, cx, top, base, half, tile, line, ridge, opts = {}) {
    const H = base - top;
    const ridgeHalf = Math.max(6, Math.round(half * (opts.ridge || 0.42)));
    const lift = opts.lift === undefined ? 5 : opts.lift;
    for (let i = 0; i < H; i++) {
      const t = (i + 1) / H;
      const hw = Math.round(ridgeHalf + (half - ridgeHalf) * Math.pow(t, 2.1));
      for (let x = -hw; x < hw; x++) {
        const row = Math.floor(i / 3) % 2;
        p.px(cx + x, top + i, (x + row * 2 + 400) % 4 === 0 ? line : i % 3 === 2 && opts.bands ? line : tile);
      }
    }
    for (let d = 0; d <= lift; d++) {
      const y = base - 1 - Math.round((d * d) / Math.max(1, lift));
      for (const s of [-1, 1]) {
        const x = s < 0 ? cx - half - d : cx + half - 1 + d;
        p.px(x, y, ridge);
        p.px(x, y + 1, line);
      }
    }
    p.rect(cx - ridgeHalf - 1, top - 2, ridgeHalf * 2 + 2, 3, ridge);
    p.rect(cx - ridgeHalf - 3, top - 4, 3, 3, ridge);
    p.rect(cx + ridgeHalf, top - 4, 3, 3, ridge);
    p.rect(cx - half, base - 1, half * 2, 1, line);
  }
  function bracketBand(p, x, y, w, a, b, c) {
    p.rect(x, y, w, 4, a);
    for (let i = x; i < x + w; i += 4) {
      p.rect(i, y, 2, 2, b);
      p.px(i + 2, y + 2, c);
    }
    p.rect(x, y + 4, w, 1, INK);
  }
  function dome(p, cx, base, rx, ry, c) {
    const dark = T(c, -0.3);
    const light = T(c, 0.35);
    for (let y = 0; y < ry; y++) {
      const t = (ry - y) / ry;
      const hw = Math.round(rx * Math.sqrt(1 - t * t));
      for (let x = -hw; x < hw; x++) {
        const u = (x + hw) / (2 * hw || 1);
        p.px(cx + x, base - ry + y, u < 0.28 ? light : u > 0.78 ? dark : c);
      }
    }
  }
  function onion(p, cx, base, rx, H, a, b, finial = true) {
    for (let y = 0; y < H; y++) {
      const t = y / (H - 1);
      const swell = t < 0.72 ? Math.pow(t / 0.72, 1.7) : Math.cos(((t - 0.72) / 0.28) * 1.25);
      const hw = Math.max(1, Math.round(rx * swell));
      for (let x = -hw; x < hw; x++) {
        const band = b ? Math.floor((x + hw * 0.3 + y * 0.8 + 100) / 3) % 2 : 0;
        const u = (x + hw) / (2 * hw);
        const c = band ? b : a;
        p.px(cx + x, base - H + y, u < 0.22 ? T(c, 0.35) : u > 0.8 ? T(c, -0.25) : c);
      }
    }
    if (finial) {
      p.rect(cx - 1, base - H - 5, 1, 5, C.butter);
      p.px(cx - 1, base - H - 7, C.butter);
      p.rect(cx - 2, base - H - 6, 3, 1, C.butter);
    }
  }
  function cone(p, cx, base, half, H, a, b) {
    for (let y = 0; y < H; y++) {
      const hw = Math.max(1, Math.round((half * (y + 1)) / H));
      for (let x = -hw; x < hw; x++) p.px(cx + x, base - H + y, x < -hw * 0.3 ? T(a, 0.2) : x > hw * 0.5 ? b : a);
    }
  }
  function archShape(p, x, y, w, h, c) {
    const r = Math.floor(w / 2);
    p.rect(x, y + r, w, h - r, c);
    for (let j = 0; j < r; j++) {
      const hw = Math.round(Math.sqrt(r * r - (r - j) * (r - j)));
      p.rect(x + r - hw, y + j, hw * 2 + (w % 2), 1, c);
    }
  }
  function pointArch(p, x, y, w, h, c) {
    const r = Math.ceil(w / 2);
    p.rect(x, y + r + 1, w, h - r - 1, c);
    for (let j = 0; j <= r; j++) {
      const hw = Math.round((j / (r + 1)) * (w / 2) * (1 + 0.25 * Math.sin((j / r) * 3.1)));
      p.rect(Math.round(x + w / 2 - hw), y + j, Math.max(1, hw * 2), 1, c);
    }
  }
  function lantern(p, x, y, c, cord = C.iron) {
    p.px(x + 1, y - 1, cord);
    p.rect(x, y, 3, 4, c);
    p.px(x - 1, y + 1, c);
    p.px(x + 3, y + 1, c);
    p.px(x - 1, y + 2, c);
    p.px(x + 3, y + 2, c);
    p.px(x, y, T(c, 0.4));
    p.px(x + 1, y + 4, C.butter);
  }
  function pennant(p, x, y, h, c) {
    p.rect(x, y, 1, h, C.iron);
    for (let i = 0; i < 4; i++) p.rect(x + 1, y + i, 7 - i * 2, 1, c);
    p.rect(x + 1, y + 4, 1, 1, c);
  }
  function speckle(p, x, y, w, h, n, a, b, seed0 = 9) {
    let seed = seed0;
    for (let i = 0; i < n; i++) {
      seed = (seed * 41 + 7) % 8191;
      p.rect(x + (seed % w), y + ((seed >> 3) % h), 2 + (seed % 3), 1, seed % 2 ? a : b);
    }
  }
  const lines = (p, x, y, w, h, step, c) => {
    for (let k = y; k < y + h; k += step) p.rect(x, k, w, 1, c);
  };
  const posts = (p, x, y, w, h, step, pw, c) => {
    for (let k = x; k <= x + w - pw; k += step) p.rect(k, y, pw, h, c);
  };
  function blocks(p, x, y, w, h, stone, dark) {
    p.rect(x, y, w, h, stone);
    for (let yy = y; yy < y + h; yy += 5) {
      p.rect(x, yy, w, 1, dark);
      for (let xx = x + ((yy - y) % 10 ? 4 : 0); xx < x + w; xx += 9) p.rect(xx, yy, 1, 5, dark);
    }
  }

  // Outside walls.
  const plankWall = (a, b, beam) => (p, G) => {
    p.rect(G.left, G.top, G.w, G.h, a);
    lines(p, G.left, G.top, G.w, G.h, 5, b);
    p.rect(G.left, G.base - 3, G.w, 3, beam);
  };
  const WALL = {
    plaster(p, G) {
      p.rect(G.left, G.top, G.w, G.h, '#f4e4c4');
      for (let x = G.left; x <= G.right; x += 22) p.rect(x, G.top, 2, G.h, '#a87848');
      p.rect(G.left, G.top, G.w, 2, '#a87848');
      p.rect(G.left, G.base - 3, G.w, 3, '#a87848');
    },
    felt(p, G) {
      p.rrect(G.left + 1, G.top, G.w - 2, G.h + 1, '#f2ecdc');
      for (let x = G.left + 8; x < G.right - 4; x += 14) p.rect(x, G.top, 1, G.h, '#ddd4bc');
      for (const [y, c] of [[G.top + 3, '#c0392b'], [G.base - 7, '#2f6f9f']]) {
        p.rect(G.left + 1, y, G.w - 2, 3, c);
        for (let x = G.left + 3; x < G.right - 3; x += 4) p.px(x, y + 1, C.butter);
      }
    },
    clapboard(p, G) {
      p.rect(G.left, G.top, G.w, G.h, '#f6f2e6');
      lines(p, G.left, G.top + 2, G.w, G.h - 2, 4, '#ddd6c4');
      p.rect(G.left, G.top, 2, G.h, C.white);
      p.rect(G.right - 2, G.top, 2, G.h, C.white);
    },
    planks: plankWall('#8fc4c0', '#7fb4b0', '#5a8a88'),
    rose: plankWall('#e8a0a0', '#d89090', '#a86060'),
    earth(p, G) {
      p.rrect(G.left + 1, G.top, G.w - 2, G.h + 1, '#d0945a');
      p.rect(G.left + 1, G.base - 5, G.w - 2, 5, '#a86f3e');
      const by = G.top + 3;
      p.rect(G.left + 1, by, G.w - 2, 10, '#f4ecd8');
      for (let x = G.left + 2; x < G.right - 8; x += 10) {
        const c = ['#c0392b', '#2f6f9f', '#e8a83a', INK][Math.floor((x - G.left) / 10) % 4];
        for (let k = 0; k < 5; k++) p.rect(x + k, by + 9 - k * 2, 9 - k * 2, 1, c);
        p.rect(x + 1, by + 8, 8, 1, c);
      }
      p.rect(G.left + 1, by + 10, G.w - 2, 1, INK);
    },
    logs(p, G) {
      p.rect(G.left, G.top, G.w, G.h, '#a8743e');
      for (let y = G.top; y < G.base; y += 6) {
        p.rect(G.left, y + 4, G.w, 2, '#8f6030');
        p.px(G.left - 1, y + 2, '#6d4522');
        p.px(G.right, y + 2, '#6d4522');
      }
    },
    alpine(p, G) {
      const low = Math.max(12, Math.round(G.h * 0.28));
      p.rect(G.left, G.top, G.w, G.h, '#8f5a30');
      lines(p, G.left, G.top, G.w, G.h, 5, '#7a4a26');
      p.rect(G.left, G.base - low, G.w, low, '#b8b4a8');
      let seed = 5;
      for (let y = G.base - low; y < G.base; y += 4) {
        for (let x = G.left + (y % 8 ? 0 : 3); x < G.right - 2; x += 7) {
          seed = (seed * 31 + 11) % 89;
          p.rect(x, y, 6, 3, seed % 2 ? '#c8c4b8' : '#a8a498');
        }
      }
    },
    tudor(p, G) {
      const beam = '#4a2f22';
      p.rect(G.left, G.top, G.w, G.h, '#f4e8cc');
      p.rect(G.left, G.top, G.w, 2, beam);
      p.rect(G.left, G.base - 2, G.w, 2, beam);
      const mid = G.top + Math.round(G.h * 0.46);
      p.rect(G.left, mid, G.w, 2, beam);
      for (let x = G.left; x <= G.right; x += 20) {
        p.rect(x, G.top, 2, G.h, beam);
        if (x + 20 <= G.right) {
          p.line(x + 1, mid, x + 20, G.top + 2, beam);
          p.line(x + 1, G.top + 2, x + 20, mid, beam);
        }
      }
    },
    brick(p, G) {
      p.rect(G.left, G.top, G.w, G.h, '#b8583e');
      for (let y = G.top; y < G.base; y += 4) {
        p.rect(G.left, y, G.w, 1, '#e8d8c0');
        for (let x = G.left + ((y - G.top) / 4) % 2 * 4; x < G.right; x += 8) p.rect(x, y, 1, 4, '#e8d8c0');
      }
    },
    hanok(p, G) {
      const post = '#5a3a24';
      p.rect(G.left, G.top, G.w, G.h, '#f6f0e0');
      const spans = Math.max(3, Math.round(G.w / 24));
      for (let i = 0; i <= spans; i++) p.rect(Math.round(G.left + (i * (G.w - 3)) / spans), G.top, 3, G.h, post);
      p.rect(G.left, G.top, G.w, 3, post);
      p.rect(G.left, G.base - 6, G.w, 3, post);
    },
    lattice(p, G) {
      const wood = '#4a3024';
      const mid = G.floor - Math.max(30, Math.round(G.h * 0.56));
      p.rect(G.left, G.top, G.w, G.h, '#efe6d0');
      p.rect(G.left, mid, G.w, G.base - mid, wood);
      for (let x = G.left + 2; x < G.right; x += 3) p.rect(x, mid + 4, 1, G.base - mid - 6, '#6d4a36');
      p.rect(G.left, G.base - 4, G.w, 4, '#2f2420');
      posts(p, G.left, G.top, G.w, G.h, Math.round(G.w / 4), 3, wood);
    },
    stone(p, G) {
      let seed = 11;
      p.rect(G.left, G.top, G.w, G.h, '#6f7478');
      for (let y = G.top; y < G.base; y += 6) {
        for (let x = G.left + ((y - G.top) % 12 ? 0 : 4); x < G.right - 2; x += 9) {
          seed = (seed * 31 + 7) % 97;
          p.rrect(x, y, 8, 5, seed % 2 ? '#a8acb0' : '#8f9498');
        }
      }
    },
    mustard(p, G) {
      p.rect(G.left, G.top, G.w, G.h, '#e8b83f');
      speckle(p, G.left, G.top, G.w, G.h, G.w * G.h * 0.03, '#d8a830', '#f0c858');
      p.rect(G.left, G.base - 5, G.w, 5, '#c89a3a');
    },
    whitewash(p, G) {
      p.rect(G.left, G.top, G.w, G.h, '#fbf8f0');
      p.rect(G.left, G.base - 3, G.w, 3, '#e8e4d8');
      for (let x = G.left + 4; x < G.right; x += 26) p.rect(x, G.top + 2, 1, G.h - 3, '#efece0');
    },
    adobe(p, G) {
      p.rect(G.left, G.top, G.w, G.h, '#efc49a');
      speckle(p, G.left, G.top, G.w, G.h, G.w * G.h * 0.015, '#e4b488', '#f6d0ac', 33);
      p.rect(G.left, G.base - 4, G.w, 4, '#c89a70');
    },
    sandstone(p, G) {
      const dark = '#c8a878';
      p.rect(G.left, G.top, G.w, G.h, '#e8cda0');
      for (let x = G.left + 8; x < G.right; x += 24) p.rect(x, G.top, 1, G.h, dark);
      const zy = G.top + 2;
      p.rect(G.left, zy, G.w, 8, C.white);
      for (let x = G.left; x < G.right; x += 8) {
        p.rect(x + 3, zy + 1, 2, 6, '#1f7f6a');
        p.rect(x + 1, zy + 3, 6, 2, '#1f7f6a');
        p.px(x + 3, zy + 3, C.butter);
        p.px(x + 4, zy + 4, C.butter);
        p.px(x, zy, '#2f5fa8');
        p.px(x + 7, zy + 7, C.tomato);
      }
      p.rect(G.left, zy + 8, G.w, 1, INK);
    },
    staves(p, G) {
      p.rect(G.left, G.top, G.w, G.h, '#7a4e30');
      for (let x = G.left + 2; x < G.right; x += 4) p.rect(x, G.top, 1, G.h, '#6a4226');
      p.rect(G.left, G.base - 3, G.w, 3, '#6f6660');
    },
    kremlin(p, G) {
      const white = '#f4ecdc';
      p.rect(G.left, G.top, G.w, G.h, '#b84a3a');
      lines(p, G.left, G.top, G.w, G.h, 4, '#a0402f');
      p.rect(G.left, G.top, G.w, 3, white);
      p.rect(G.left, G.base - 4, G.w, 4, white);
      for (let x = G.left + 1; x < G.right - 6; x += 9) {
        archShape(p, x, G.top + 3, 7, 9, white);
        archShape(p, x + 1, G.top + 5, 5, 7, '#2f8a78');
      }
    },
    lacquer(p, G) {
      p.rect(G.left, G.top, G.w, G.h, '#b8302a');
      const spans = Math.max(3, Math.round(G.w / 24));
      for (let i = 0; i <= spans; i++) {
        const x = Math.round(G.left + (i * (G.w - 4)) / spans);
        p.rect(x, G.top, 4, G.h, '#d0403a');
        p.rect(x + 3, G.top, 1, G.h, '#8f2420');
      }
    },
    blocks(p, G) {
      blocks(p, G.left, G.top, G.w, G.h, '#b0b4b8', '#90949a');
      p.rect(G.left, G.top + 1, G.w, 2, T('#b0b4b8', 0.3));
    },
    marble(p, G) {
      const inlay = ['#c0392b', '#2f7f6a', '#2f5fa8', C.gold];
      p.rect(G.left, G.top, G.w, G.h, '#fbf8f2');
      p.rect(G.left, G.top, G.w, 4, '#e4dfd2');
      for (let x = G.left, i = 0; x < G.right; x += 4, i++) p.rect(x + 1, G.top + 1, 2, 2, inlay[i % 4]);
      p.rect(G.left, G.base - 3, G.w, 3, '#e4dfd2');
      for (let x = G.left + 12; x < G.right; x += 24) p.rect(x, G.top + 4, 1, G.h - 7, '#efe9dc');
    },
    goldleaf(p, G) {
      const gold = '#f4c83a';
      p.rect(G.left, G.top, G.w, G.h, gold);
      for (let k = 0; k < (G.w * G.h) / 22; k++) p.px(G.left + ((k * 37) % G.w), G.top + ((k * 53) % G.h), k % 3 ? '#d8a428' : '#fff0a0');
      posts(p, G.left, G.top, G.w, G.h, 12, 2, '#d8a428');
      p.rect(G.left, G.top, G.w, 2, '#d8a428');
      p.rect(G.left, G.base - 3, G.w, 3, '#d8a428');
    },
  };

  // Roofs. Each one says how tall it stands, so what goes on top of it knows where to start.
  const plainRoof = (a, b, c) => ({
    h: () => 26,
    paint(p, G) {
      const H = 26;
      for (let i = 0; i < H; i++) {
        const inset = Math.round((H - i) * 1.3);
        p.rect(G.left - 10 + inset, G.top - H + i, G.w + 20 - inset * 2, 1, i % 4 === 3 ? c : i % 8 < 4 ? a : b);
      }
      p.rect(G.left - 11, G.top, G.w + 22, 2, c);
    },
  });
  const ROOF = {
    thatch: plainRoof('#d9b85a', '#c0a048', '#a88a3c'),
    felt: {
      h: (G) => Math.max(18, Math.round(G.w * 0.2)),
      paint(p, G, H) {
        for (let y = 0; y < H; y++) {
          const t = (y + 1) / H;
          const hw = Math.round((G.w / 2 + 2) * Math.sqrt(t) * (0.2 + 0.8 * t) + 6);
          p.rect(G.cx - hw, G.top - H + y, hw * 2, 1, y % 5 === 4 ? '#ddd4bc' : '#efe8d6');
        }
        p.rect(G.left, G.top - 2, G.w, 3, '#2f6f9f');
        for (let x = G.left + 2; x < G.right - 2; x += 5) p.px(x, G.top - 1, C.butter);
        p.rect(G.cx - 7, G.top - H - 3, 14, 4, '#c98a4e');
        p.rect(G.cx - 5, G.top - H - 2, 10, 2, '#e8c48a');
      },
    },
    red: plainRoof('#d0553a', '#b84530', '#8f3424'),
    shingle: {
      h: (G) => 22 + Math.round(G.w * 0.06),
      paint(p, G, H) {
        gable(p, G.cx, G.top - H, G.top + 2, G.w / 2 + 11, '#6f7680', '#646b75', '#555c66', 0.42);
      },
    },
    blue: plainRoof('#5a7fa8', '#4a6c94', '#3a5678'),
    deep: {
      h: (G) => Math.max(26, Math.round(G.w * 0.3)),
      paint(p, G, H) {
        for (let y = 0; y < H; y++) {
          const t = (y + 1) / H;
          const hw = Math.round(3 + (G.w / 2 + 9) * t);
          for (let x = -hw; x < hw; x++) p.px(G.cx + x, G.top - H + y + 2, (x * (H / (y + 3)) + 1000) % 5 < 1 ? '#a88a3c' : y % 6 === 5 ? '#c0a048' : '#d9b85a');
        }
        for (let x = G.left - 9; x < G.right + 9; x += 3) p.rect(x, G.top + 2, 2, 2 + (x % 2), '#a88a3c');
        p.rect(G.cx - 1, G.top - H - 2, 2, 6, C.cocoa);
      },
    },
    moss: plainRoof('#6f9a5a', '#5f8a4e', '#4a7040'),
    wide: {
      h: (G) => 22 + Math.round(G.w * 0.08),
      paint(p, G, H) {
        const half = G.w / 2 + 15;
        gable(p, G.cx, G.top - H, G.top + 2, half, '#6d4a2c', '#5e3f26', '#4f3420', 0.12);
        for (let i = 0; i < H; i += 2) {
          const hw = Math.round(half * (0.12 + 0.88 * ((i + 1) / H)));
          p.px(G.cx - hw, G.top - H + i, C.cream);
          p.px(G.cx + hw - 1, G.top - H + i, C.cream);
        }
        p.rect(G.left - 15, G.top + 2, G.w + 30, 1, C.cream);
        for (let x = G.left - 15; x < G.right + 15; x += 4) p.rect(x, G.top + 3, 2, 2, C.cream);
      },
    },
    steep: {
      h: (G) => 30 + Math.round(G.w * 0.1),
      paint(p, G, H) {
        gable(p, G.cx, G.top - H, G.top + 2, G.w / 2 + 8, '#7a4a30', '#6d4028', '#5a3320', 0.3);
      },
    },
    giwa: {
      h: (G) => 24 + Math.round(G.w * 0.08),
      paint(p, G, H) {
        curvedRoof(p, G.cx, G.top - H, G.top - 1, G.w / 2 + 14, '#5a6470', '#454e5a', '#e8e4d8', { lift: 6 });
      },
    },
    oldtile: {
      h: (G) => 22 + Math.round(G.w * 0.06),
      paint(p, G, H) {
        curvedRoof(p, G.cx, G.top - H, G.top + 2, G.w / 2 + 11, '#9a6a44', '#7a4e30', '#7a4e30', { ridge: 0.7, lift: 2 });
        let seed = 21;
        for (let i = 0; i < G.w * 0.5; i++) {
          seed = (seed * 41 + 13) % 8191;
          p.rect(G.cx - G.w / 2 + (seed % G.w), G.top - H + 2 + ((seed >> 4) % (H - 3)), 2, 1, '#6f8a48');
        }
      },
    },
    terrace: {
      h: () => 9,
      paint(p, G) {
        p.rect(G.left - 2, G.top - 2, G.w + 4, 3, '#e8e4d8');
        for (let x = G.left - 2; x < G.right + 2; x += 3) p.rect(x, G.top - 8, 1, 6, '#2f6fb8');
        p.rect(G.left - 2, G.top - 9, G.w + 4, 1, '#2f6fb8');
      },
    },
    gold: plainRoof('#e8c04a', '#d0a83a', '#a8842c'),
    barrel: {
      h: (G) => 14 + Math.round(G.w * 0.03),
      paint(p, G, H) {
        for (let y = 0; y < H; y++) {
          const hw = Math.round(G.w / 2 + 9 - (H - y) * 0.5);
          for (let x = -hw; x < hw; x++) p.px(G.cx + x, G.top - H + y + 1, (x + 400) % 5 === 0 ? '#9a4628' : (x + 400) % 5 === 2 ? '#e0805a' : '#c8603a');
        }
        for (let x = G.left - 9; x < G.right + 9; x += 5) p.ell(x + 2, G.top + 1, 2, 2, '#c8603a');
      },
    },
    stepped: {
      h: () => 30,
      paint(p, G) {
        const n = Math.max(2, Math.round(G.w / 44));
        const each = Math.floor(G.w / n);
        const bricks = ['#a8503a', '#7a4e3a', '#b8683a', '#5f4a4a', '#94503e'];
        for (let k = 0; k < n; k++) {
          const x = G.left + k * each;
          const w = k === n - 1 ? G.w - each * k : each;
          const brick = bricks[(k + 1) % bricks.length];
          const gableH = 18 + ((k * 7) % 3) * 4;
          for (let s = 0; s < 4; s++) {
            const inset = Math.round((s * w) / 9);
            const sh = Math.round(gableH / 4);
            const y = G.top - (s + 1) * sh;
            p.rect(x + inset, y, w - inset * 2, sh, brick);
            lines(p, x + inset, y + 1, w - inset * 2, sh - 1, 3, T(brick, -0.12));
            p.rect(x + inset, y, w - inset * 2, 1, C.white);
            p.rect(x + inset, y, 1, sh, C.white);
            p.rect(x + w - inset - 1, y, 1, sh, C.white);
          }
          p.rect(x + Math.floor(w / 2) - 1, G.top - gableH - 1, 2, 5, C.cocoa);
          p.rect(x + Math.floor(w / 2) - 3, G.top - gableH + 2, 6, 1, C.cocoa);
          const glass = { x: x + Math.floor(w / 2) - 4, y: G.top - gableH + 8, w: 8, h: 8 };
          p.rect(glass.x - 1, glass.y - 1, glass.w + 2, glass.h + 2, C.white);
          p.rect(glass.x, glass.y, glass.w, glass.h, '#6f94aa');
          G.windows.push(glass);
        }
      },
    },
    battlement: {
      h: () => 8,
      paint(p, G) {
        p.rect(G.left, G.top - 3, G.w, 4, '#b0b4b8');
        for (let x = G.left; x < G.right; x += 7) p.rect(x, G.top - 7, 4, 4, '#b0b4b8');
        p.rect(G.left, G.top, G.w, 1, '#90949a');
      },
    },
    greentile: {
      h: (G) => 22 + Math.round(G.w * 0.08),
      paint(p, G, H) {
        const R = H - 6;
        for (let y = 0; y < R; y++) {
          const hw = Math.round((G.w / 2 - 4) * (0.2 + (0.8 * (y + 1)) / R));
          for (let x = -hw; x < hw; x++) p.px(G.cx + x, G.top - H + y, (x + 400) % 4 === 0 ? '#1f6f54' : y % 4 === 3 ? '#2f8a68' : '#3fa880');
        }
        p.rect(G.cx - 1, G.top - H - 7, 2, 7, C.butter);
        p.ell(G.cx - 0.5, G.top - H - 3, 2, 2, C.butter);
        p.rect(G.left, G.top - 3, G.w, 4, '#e8cda0');
        for (let x = G.left; x < G.right; x += 8) {
          p.rect(x, G.top - 7, 5, 4, '#e8cda0');
          p.px(x + 2, G.top - 8, '#e8cda0');
        }
      },
    },
    tarred: {
      h: () => 22,
      paint(p, G, H) {
        const half = G.w / 2 + 10;
        for (let i = 0; i < H; i++) {
          const hw = Math.round(half * (0.25 + (0.75 * (i + 1)) / H));
          for (let x = -hw; x < hw; x++) p.px(G.cx + x, G.top - H + i, (x + (Math.floor(i / 3) % 2) * 2 + 400) % 4 === 0 || i % 3 === 2 ? '#4a3020' : '#5a3a26');
        }
        for (const s of [-1, 1]) {
          const x = G.cx + s * half;
          p.line(x, G.top - 1, x + s * 5, G.top - 7, '#4a3020');
          p.rect(x + s * 5 - (s < 0 ? 2 : 0), G.top - 9, 3, 2, C.butter);
          p.px(x + s * 7, G.top - 9, C.tomato);
        }
        p.rect(G.cx - half, G.top, half * 2, 1, INK);
      },
    },
    temple: {
      h: (G) => 30 + Math.round(G.w * 0.04),
      paint(p, G, H) {
        const gold = '#f0c040';
        const tier = (top, base, half, a, b) => {
          const R = base - top;
          for (let i = 0; i < R; i++) {
            const hw = Math.round(half * (0.35 + (0.65 * (i + 1)) / R));
            for (let x = -hw; x < hw; x++) p.px(G.cx + x, top + i, i % 3 === 2 ? b : a);
            p.rect(G.cx - hw - 1, top + i, 2, 1, gold);
            p.rect(G.cx + hw - 1, top + i, 2, 1, gold);
          }
          p.rect(G.cx - half, base - 1, half * 2, 1, gold);
          for (const s of [-1, 1]) {
            const x = G.cx + s * half;
            p.line(x, base - 1, x + s * 3, base - 3, gold);
            p.line(x + s * 3, base - 3, x + s * 3, base - 8, gold);
            p.px(x + s * 2, base - 9, gold);
          }
        };
        tier(G.top - H, G.top - H + 17, Math.round(G.w * 0.36) + 8, '#3f9a5a', '#2f7f48');
        tier(G.top - H + 14, G.top + 2, G.w / 2 + 10, '#d0502e', '#a83c24');
      },
    },
    golden: {
      h: (G) => 15 + Math.round(G.w * 0.03),
      paint(p, G, H) {
        curvedRoof(p, G.cx, G.top - H, G.top + 1, G.w / 2 + 15, '#f0c040', '#c0902a', '#d0a030', { ridge: 0.78, lift: 7 });
      },
    },
    pavilion: {
      h: () => 14,
      paint(p, G, H) {
        curvedRoof(p, G.cx, G.top - H, G.top + 1, G.w / 2 + 12, '#6a5a4a', '#4f4238', '#4f4238', { ridge: 0.8, lift: 6 });
        p.rect(G.left - 12, G.top, G.w + 24, 1, '#f4c83a');
      },
    },
  };

  // What stands on top of the roof. Most go up behind it, a few sit on the slope in front.
  const CROWN = {
    none: {},
    vane: {
      paint(p, G, peak) {
        p.rect(G.cx, peak - 12, 1, 14, C.iron);
        p.rect(G.cx - 5, peak - 9, 11, 1, C.iron);
        p.rect(G.cx + 3, peak - 10, 3, 3, C.gold);
        p.rect(G.cx - 2, peak - 15, 5, 3, C.gold);
        p.px(G.cx + 3, peak - 16, C.tomato);
      },
    },
    chimney: {
      paint(p, G, peak) {
        const x = G.right - 26;
        p.rect(x, peak - 4, 11, 30, '#a04a34');
        p.rect(x - 1, peak - 6, 13, 3, '#6d3a2a');
        for (let y = peak - 1; y < peak + 24; y += 3) p.rect(x, y, 11, 1, '#8a3c2a');
        G.smoke = { x: x + 5, y: peak - 8 };
      },
    },
    dormer: {
      over: true,
      paint(p, G) {
        const dw = 20;
        const y = G.top - 15;
        p.rect(G.cx - dw / 2, y, dw, 14, '#f6f2e6');
        gable(p, G.cx, y - 9, y + 2, dw / 2 + 4, '#6f7680', '#646b75', '#555c66', 0.1);
        const g = { x: G.cx - 5, y: y + 3, w: 10, h: 9 };
        p.rect(g.x - 1, g.y - 1, g.w + 2, g.h + 2, C.white);
        p.rect(g.x, g.y, g.w, g.h, '#7fa0b4');
        p.rect(g.x + 5, g.y, 1, g.h, C.white);
        G.windows.push(g);
      },
    },
    bell: {
      paint(p, G, peak) {
        const x = G.right - 32;
        p.rect(x, peak - 18, 22, 44, '#f6e6c8');
        p.rect(x - 2, peak - 20, 26, 3, '#c8603a');
        p.ell(x + 11, peak - 22, 3, 3, '#c8603a');
        archShape(p, x + 6, peak - 15, 10, 16, '#7a4e30');
        p.rect(x + 9, peak - 10, 4, 5, C.butter);
      },
    },
    dome: {
      paint(p, G, peak) {
        const rx = Math.round(G.w * 0.2) + 6;
        const white = '#fbf8f0';
        p.rect(G.cx - rx, peak - 5, rx * 2, 14, white);
        p.rect(G.cx - rx - 1, peak - 6, rx * 2 + 2, 2, '#e8e4d8');
        for (let x = G.cx - rx + 4; x < G.cx + rx - 4; x += 8) archShape(p, x, peak - 3, 4, 8, '#2f6fb8');
        dome(p, G.cx, peak - 5, rx, rx - 2, '#2f6fb8');
        p.rect(G.cx - 1, peak - 5 - rx - 3, 2, 6, C.butter);
      },
    },
    hall: {
      paint(p, G, peak) {
        const up = Math.round(G.w * 0.3);
        const y = peak - 12;
        p.rect(G.cx - up, y, up * 2, 22, '#f6f0e0');
        posts(p, G.cx - up, y, up * 2, 22, 9, 2, '#5a3a24');
        p.rect(G.cx - up, y, up * 2, 2, '#5a3a24');
        for (let x = G.cx - up + 4; x < G.cx + up - 6; x += 9) p.rect(x, y + 3, 4, 7, '#f8ecc8');
        curvedRoof(p, G.cx, y - 13, y + 1, up + 11, '#5a6470', '#454e5a', '#e8e4d8', { ridge: 0.36, lift: 5 });
      },
    },
    turret: {
      paint(p, G, peak) {
        const y = peak - 16;
        p.rect(G.cx - 8, y, 16, 26, '#f4e8cc');
        p.rect(G.cx - 9, y - 1, 18, 2, '#6d4535');
        p.disc(G.cx, y + 8, 5, C.white);
        p.disc(G.cx, y + 8, 4, '#fff8e8');
        p.rect(G.cx, y + 5, 1, 4, INK);
        p.rect(G.cx, y + 8, 3, 1, INK);
        cone(p, G.cx, y - 1, 11, 15, '#3f6fb8', '#2f5a98');
        pennant(p, G.cx - 1, y - 24, 9, C.tomato);
      },
    },
    spire: {
      paint(p, G, peak) {
        const gold = '#f0c040';
        for (let i = 0; i < 30; i++) {
          const hw = Math.max(1, Math.round(6 * (1 - i / 30)));
          p.rect(G.cx - hw, peak + 4 - i, hw * 2, 1, i % 4 === 3 ? '#c0902a' : gold);
        }
        p.px(G.cx - 1, peak - 27, C.white);
      },
    },
    tiers: {
      paint(p, G, peak) {
        const tar = '#4a3020';
        const shingle = '#5a3a26';
        const tier = (top, base, half) => {
          const H = base - top;
          for (let i = 0; i < H; i++) {
            const hw = Math.round(half * (0.25 + (0.75 * (i + 1)) / H));
            for (let x = -hw; x < hw; x++) p.px(G.cx + x, top + i, (x + (Math.floor(i / 3) % 2) * 2 + 400) % 4 === 0 || i % 3 === 2 ? tar : shingle);
          }
          for (const s of [-1, 1]) {
            const x = G.cx + s * half;
            p.line(x, base - 1, x + s * 4, base - 6, tar);
            p.rect(x + s * 4 - (s < 0 ? 2 : 0), base - 8, 3, 2, C.butter);
          }
          p.rect(G.cx - half, base - 1, half * 2, 1, INK);
        };
        const tw = Math.round(G.w * 0.32);
        p.rect(G.cx - tw / 2, peak - 18, tw, 26, '#7a4e30');
        for (let x = G.cx - tw / 2 + 2; x < G.cx + tw / 2; x += 4) p.rect(x, peak - 18, 1, 26, '#6a4226');
        const tw2 = Math.round(tw * 0.45);
        p.rect(G.cx - tw2 / 2, peak - 44, tw2, 28, '#7a4e30');
        for (const x of [G.cx - 9, G.cx + 3]) {
          archShape(p, x - 1, peak - 15, 8, 11, tar);
          archShape(p, x, peak - 14, 6, 9, '#e8c48a');
          G.windows.push({ x, y: peak - 11, w: 6, h: 6 });
        }
        tier(peak - 20, peak, tw / 2 + 9);
        tier(peak - 46, peak - 28, tw2 / 2 + 7);
        cone(p, G.cx, peak - 44, 4, 16, shingle, tar);
        p.rect(G.cx - 1, peak - 62, 2, 4, C.butter);
      },
    },
    goldhall: {
      paint(p, G, peak) {
        const gold = '#f0c040';
        const up = Math.round(G.w * 0.32);
        const y = peak - 12;
        p.rect(G.cx - up, y, up * 2, 24, '#b8302a');
        posts(p, G.cx - up, y, up * 2, 24, 9, 2, '#d0403a');
        bracketBand(p, G.cx - up - 2, y - 3, up * 2 + 4, '#2f7f8a', C.butter, '#c0392b');
        const r = 15 + Math.round(G.w * 0.03);
        curvedRoof(p, G.cx, y - 3 - r, y - 2, up + 13, gold, '#c0902a', '#d0a030', { ridge: 0.4, lift: 7 });
        p.rect(G.cx - 11, y + 3, 22, 8, gold);
        p.rect(G.cx - 10, y + 4, 20, 6, '#8f2420');
        for (let x = G.cx - 8; x < G.cx + 8; x += 4) p.rect(x, y + 5, 2, 4, gold);
        p.disc(G.cx, y - 3 - r - 6, 2, gold);
        G.windows.push({ x: G.cx - 10, y: y + 4, w: 20, h: 6 });
      },
    },
    onions: {
      paint(p, G, peak) {
        const white = '#f4ecdc';
        const tower = (cx, tw, th, rx, a, b) => {
          const y = peak + 8 - th;
          p.rect(cx - tw / 2, y, tw, th, white);
          lines(p, cx - tw / 2, y, tw, th, 4, '#d8ccb4');
          p.rect(cx - tw / 2 - 1, y - 1, tw + 2, 2, C.butter);
          archShape(p, cx - 2, y + 4, 5, 10, '#3f6f9f');
          onion(p, cx, y, rx, Math.round(rx * 2.5), a, b);
        };
        const big = Math.round(G.w * 0.13) + 6;
        tower(G.left + 10, 14, 12, 9, '#e8b83a', '#d0502e');
        tower(G.right - 11, 14, 14, 9, '#3f9a5a', '#f4ecdc');
        tower(Math.round(G.left + G.w * 0.3), 16, 26, 11, '#2f6fb8', '#f4ecdc');
        tower(Math.round(G.left + G.w * 0.7), 16, 22, 11, '#d0408a', '#f0c040');
        tower(G.cx, 22, 36, big, '#f0c040', '#e0a030');
      },
    },
    keep: {
      paint(p, G, peak) {
        const keepW = Math.round(G.w * 0.52);
        const y = peak - 18;
        blocks(p, G.cx - keepW / 2, y, keepW, 30, '#b0b4b8', '#90949a');
        for (let k = G.cx - keepW / 2; k < G.cx + keepW / 2; k += 7) p.rect(k, y - 4, 4, 4, '#b0b4b8');
        for (const x of [G.cx - keepW / 4 - 3, G.cx + keepW / 4 - 3]) {
          archShape(p, Math.round(x) - 1, y + 7, 8, 12, '#90949a');
          archShape(p, Math.round(x), y + 8, 6, 11, '#5a6878');
          G.windows.push({ x: Math.round(x), y: y + 11, w: 6, h: 8 });
        }
        const r = 9;
        const ty = y - 24;
        blocks(p, G.cx - r, ty, r * 2, 26, '#b0b4b8', '#90949a');
        p.rect(G.cx - r, ty, 2, 26, T('#b0b4b8', 0.3));
        p.rect(G.cx + r - 3, ty, 3, 26, T('#b0b4b8', -0.25));
        cone(p, G.cx, ty - 1, r + 3, 24, '#3f6fb8', T('#3f6fb8', -0.25));
        pennant(p, G.cx - 1, ty - 34, 11, C.tomato);
      },
    },
    whitedome: {
      paint(p, G, peak) {
        const white = '#fbf8f2';
        const shade = '#e4dfd2';
        const big = Math.round(G.w * 0.2) + 8;
        const y = peak + 2;
        const kiosk = (cx, r) => {
          p.rect(cx - r, y - 8, r * 2, 11, shade);
          for (let x = cx - r; x <= cx + r - 2; x += Math.max(4, r - 1)) p.rect(x, y - 8, 2, 11, white);
          p.rect(cx - r - 1, y - 9, r * 2 + 2, 2, white);
          onion(p, cx, y - 9, r, Math.round(r * 1.9), white, null);
        };
        kiosk(G.left + Math.round(G.w * 0.16), 8);
        kiosk(G.left + Math.round(G.w * 0.84), 8);
        p.rect(G.cx - big + 3, y - 9, big * 2 - 6, 12, white);
        for (let x = G.cx - big + 6; x < G.cx + big - 8; x += 9) pointArch(p, x, y - 7, 5, 9, shade);
        onion(p, G.cx, y - 9, big, Math.round(big * 1.8), white, null);
        p.rect(G.cx - 1, y - 9 - Math.round(big * 1.8) - 7, 2, 7, C.butter);
      },
    },
    phoenix: {
      paint(p, G, peak) {
        const gold = '#f4c83a';
        const gold2 = '#d8a428';
        const shine = '#fff0a0';
        const leaf = (x, y, w, h) => {
          p.rect(x, y, w, h, gold);
          for (let k = 0; k < (w * h) / 22; k++) p.px(x + ((k * 37) % w), y + ((k * 53) % h), k % 3 ? gold2 : shine);
        };
        const roofC = '#6a5a4a';
        const roofL = '#4f4238';
        const w2 = Math.round(G.w * 0.76);
        const y2 = peak - 16;
        leaf(G.cx - w2 / 2, y2, w2, 28);
        posts(p, G.cx - w2 / 2, y2, w2, 28, 10, 2, gold2);
        p.rect(G.cx - w2 / 2 - 3, y2 + 15, w2 + 6, 2, gold2);
        for (let x = G.cx - w2 / 2 - 3; x < G.cx + w2 / 2 + 3; x += 3) p.rect(x, y2 + 17, 1, 5, gold2);
        for (let x = G.cx - w2 / 2 + 5; x < G.cx + w2 / 2 - 12; x += 18) {
          p.rect(x, y2 + 4, 10, 10, '#f8ecc8');
          lines(p, x, y2 + 6, 10, 8, 3, gold2);
          G.windows.push({ x, y: y2 + 4, w: 10, h: 10 });
        }
        curvedRoof(p, G.cx, y2 - 13, y2 + 1, w2 / 2 + 11, roofC, roofL, roofL, { ridge: 0.7, lift: 6 });
        p.rect(G.cx - w2 / 2 - 11, y2, w2 + 22, 1, gold);
        const w3 = Math.round(G.w * 0.44);
        const y3 = y2 - 13 - 20;
        leaf(G.cx - w3 / 2, y3, w3, 20);
        pointArch(p, G.cx - 6, y3 + 3, 12, 15, gold2);
        pointArch(p, G.cx - 5, y3 + 4, 10, 13, '#f8ecc8');
        G.windows.push({ x: G.cx - 4, y: y3 + 9, w: 8, h: 8 });
        curvedRoof(p, G.cx, y3 - 15, y3 + 1, w3 / 2 + 11, gold, gold2, gold2, { ridge: 0.14, lift: 7 });
        const py = y3 - 15;
        p.rect(G.cx - 1, py - 5, 2, 5, gold2);
        p.grid(G.cx - 6, py - 12, ['#..........#', '##........##', '.##..##..##.', '..########..', '...######...', '....####....', '.....##.....'], { '#': shine });
      },
    },
  };

  // Awnings, porches and the like. A few go behind the windows, the rest in front.
  const stripes = (a, b) => ({
    paint(p, G) {
      const ay = G.floor - 38;
      for (let x = G.left + 2; x < G.right - 2; x += 6) {
        const c = ((x - G.left) / 6) % 2 < 1 ? a : b;
        p.rect(x, ay, 6, 7, c);
        p.rect(x + 1, ay + 7, 4, 1, c);
      }
      p.rect(G.left + 1, ay - 1, G.w - 2, 1, T(a, -0.3));
    },
  });
  const AWNING = {
    none: {},
    red: stripes('#e4572e', '#fff1d6'),
    blue: stripes('#3f7fb0', '#fff1d6'),
    green: stripes('#4f9a5a', '#fff1d6'),
    scallop: {
      paint(p, G) {
        const ay = G.floor - 38;
        p.rect(G.left + 1, ay, G.w - 2, 6, '#f4ecd8');
        p.rect(G.left + 1, ay - 1, G.w - 2, 1, '#b8a888');
        for (let x = G.left + 1; x < G.right - 2; x += 8) p.ell(x + 4, ay + 6, 4, 3, (x - G.left) % 16 < 8 ? '#d0408a' : '#f4ecd8');
      },
    },
    porch: {
      paint(p, G) {
        const py = G.floor - 32;
        for (let x = G.left - 2; x < G.right + 2; x++) p.rect(x, py, 1, 4, (x + 400) % 6 < 3 ? '#646b75' : '#6f7680');
        p.rect(G.left - 3, py + 4, G.w + 6, 1, INK);
        for (let x = G.left + 1; x < G.right; x += Math.round((G.w - 2) / 4)) p.rect(x, py + 5, 2, G.floor - py - 5, C.white);
        for (let x = G.left; x < G.right; x += 3) if (Math.abs(x - G.cx) > G.doorW / 2 + 2) p.rect(x, G.floor - 8, 1, 8, '#efe9d8');
        p.rect(G.left, G.floor - 8, G.w, 1, C.white);
      },
    },
    skirt: {
      paint(p, G) {
        const y = G.floor - 39;
        curvedRoof(p, G.cx, y, y + 11, G.w / 2 + 5, '#6a7480', '#4f5864', '#4f5864', { ridge: 0.92, lift: 2, bands: true });
      },
    },
    gold: stripes('#e8b83a', '#5b3a5e'),
    arcade: {
      under: true,
      paint(p, G) {
        const archTop = G.floor - 32;
        const spans = Math.max(3, Math.round(G.w / 26));
        const aw = Math.floor(G.w / spans);
        for (let i = 0; i < spans; i++) {
          const ax = G.left + i * aw + 3;
          archShape(p, ax, archTop, aw - 6, 32, '#7a4e30');
          archShape(p, ax + 2, archTop + 2, aw - 10, 30, '#a87048');
        }
      },
    },
    silk: {
      paint(p, G) {
        const ay = G.floor - 40;
        for (let x = G.left + 1; x < G.right - 1; x += 7) {
          for (let i = 0; i < 8; i++) p.rect(x, ay + i, 7, 1, ((x - G.left) / 7) % 2 < 1 ? '#7a2a6e' : '#e8b83a');
          p.rect(x + 2, ay + 8, 3, 1, C.gold);
        }
        p.rect(G.left, ay - 1, G.w, 2, C.gold);
      },
    },
    frieze: {
      paint(p, G) {
        bracketBand(p, G.left - 2, G.top + 1, G.w + 4, '#3f8a7a', '#c0392b', C.butter);
      },
    },
    brackets: {
      paint(p, G) {
        bracketBand(p, G.left - 3, G.top + 1, G.w + 6, '#2f7f8a', C.butter, '#c0392b');
        bracketBand(p, G.left - 3, G.top + 6, G.w + 6, '#c0392b', '#2f7f8a', C.butter);
      },
    },
  };

  // Windows. Each paints into the place the building gives it and says which part lights up at night.
  const fullLit = (g) => [{ x: g.x, y: g.y, w: g.w, h: g.h }];
  const paneOf = (frame, glass) => (p, g) => {
    p.rect(g.x - 1, g.y - 1, g.w + 2, g.h + 2, frame);
    p.rect(g.x, g.y, g.w, g.h, glass);
    p.rect(g.x + Math.floor(g.w / 2), g.y, 1, g.h, frame);
    p.rect(g.x, g.y + Math.floor(g.h / 2), g.w, 1, frame);
    p.px(g.x + 1, g.y + 1, T(glass, 0.6));
    p.px(g.x + 2, g.y + 2, T(glass, 0.6));
  };
  const panesLit = (g) => {
    const midX = Math.floor(g.w / 2);
    const midY = Math.floor(g.h / 2);
    return [
      { x: g.x, y: g.y, w: midX, h: midY },
      { x: g.x + midX + 1, y: g.y, w: g.w - midX - 1, h: midY },
      { x: g.x, y: g.y + midY + 1, w: midX, h: g.h - midY - 1 },
      { x: g.x + midX + 1, y: g.y + midY + 1, w: g.w - midX - 1, h: g.h - midY - 1 },
    ];
  };
  const latticeOf = (frame, paper, step) => (p, g) => {
    p.rect(g.x - 1, g.y - 1, g.w + 2, g.h + 2, frame);
    p.rect(g.x, g.y, g.w, g.h, paper);
    for (let x = g.x + step; x < g.x + g.w; x += step) p.rect(x, g.y, 1, g.h, frame);
    for (let y = g.y + step; y < g.y + g.h; y += step) p.rect(g.x, y, g.w, 1, frame);
  };
  const shuttered = (c, dark) => (p, g) => {
    p.rect(g.x - 5, g.y, 4, g.h, c);
    p.rect(g.x + g.w + 1, g.y, 4, g.h, c);
    for (let y = g.y + 1; y < g.y + g.h; y += 2) {
      p.rect(g.x - 5, y, 4, 1, dark);
      p.rect(g.x + g.w + 1, y, 4, 1, dark);
    }
    paneOf('#5a3a24', '#bfd8e0')(p, g);
  };
  const arched = (frame, glass, shape) => (p, g) => {
    shape(p, g.x - 1, g.y - 1, g.w + 2, g.h + 2, frame);
    shape(p, g.x, g.y, g.w, g.h, glass);
    p.rect(g.x + Math.floor(g.w / 2), g.y + 1, 1, g.h - 1, frame);
  };
  const lowerLit = (g) => [{ x: g.x + 1, y: g.y + 5, w: g.w - 2, h: g.h - 5 }];
  function archMask(p, g, x, y, c) {
    const r = g.w / 2;
    for (let j = y; j < Math.min(y + 2, g.h); j++) {
      for (let i = x; i < Math.min(x + 2, g.w); i++) {
        const dy = r - j;
        if (dy > 0 && (i + 0.5 - r) ** 2 + dy * dy > r * r) continue;
        p.px(g.x + i, g.y + j, c);
      }
    }
  }
  const WINDOWS = {
    pane: { paint: paneOf('#a87848', '#7fa0b4'), lit: panesLit },
    white: { paint: paneOf(C.white, '#7fa0b4'), lit: panesLit },
    shutters: { paint: shuttered(C.moss, '#2f6048'), lit: panesLit },
    round: {
      paint(p, g) {
        p.disc(g.x + g.w / 2 - 0.5, g.y + g.h / 2 - 0.5, g.h / 2 + 0.5, C.iron);
        p.disc(g.x + g.w / 2 - 0.5, g.y + g.h / 2 - 0.5, g.h / 2 - 1, '#8fc0d4');
        p.px(g.x + 4, g.y + 4, C.white);
      },
      lit: (g) => [{ x: g.x + 3, y: g.y + 3, w: g.w - 6, h: g.h - 6 }],
    },
    diamond: {
      paint(p, g) {
        p.rect(g.x - 1, g.y - 1, g.w + 2, g.h + 2, '#4a2f22');
        p.rect(g.x, g.y, g.w, g.h, '#9fc0cc');
        for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) if ((i + j) % 4 === 0 || (i - j + 400) % 4 === 0) p.px(g.x + i, g.y + j, '#4a2f22');
      },
      lit: fullLit,
    },
    paper: { paint: latticeOf('#5a3a24', '#f8ecc8', 4), lit: fullLit },
    louvre: { paint: shuttered('#2f7f86', '#1f5f66'), lit: panesLit },
    bluearch: {
      paint(p, g) {
        p.rect(g.x - 4, g.y + 2, 3, g.h - 2, '#2f6fb8');
        p.rect(g.x + g.w + 1, g.y + 2, 3, g.h - 2, '#2f6fb8');
        arched('#2f6fb8', '#bfe6ea', archShape)(p, g);
      },
      lit: lowerLit,
    },
    woodarch: { paint: arched('#7a4e30', '#f8ecc8', archShape), lit: lowerLit },
    keyhole: {
      paint(p, g) {
        pointArch(p, g.x - 2, g.y - 3, g.w + 4, g.h + 4, '#1f7f6a');
        pointArch(p, g.x, g.y, g.w, g.h, '#8a5a3c');
        for (let y = g.y + 5; y < g.y + g.h; y += 3) p.rect(g.x, y, g.w, 1, '#5a3a24');
        for (let x = g.x + 2; x < g.x + g.w; x += 3) p.rect(x, g.y + 4, 1, g.h - 4, '#5a3a24');
      },
      lit: lowerLit,
    },
    goldlattice: { paint: latticeOf('#f0c040', '#f8ecc8', 3), lit: fullLit },
    templearch: {
      paint(p, g) {
        pointArch(p, g.x - 2, g.y - 6, g.w + 4, g.h + 7, '#f0c040');
        pointArch(p, g.x - 1, g.y - 4, g.w + 2, g.h + 5, '#b8302a');
        p.rect(g.x + 1, g.y + 2, g.w - 2, g.h - 2, '#f8ecc8');
        p.rect(g.x + Math.floor(g.w / 2), g.y + 2, 1, g.h - 2, '#f0c040');
      },
      lit: (g) => [{ x: g.x + 1, y: g.y + 2, w: g.w - 2, h: g.h - 2 }],
    },
    inlaid: {
      paint(p, g) {
        pointArch(p, g.x - 3, g.y - 3, g.w + 6, g.h + 4, '#2f7f6a');
        pointArch(p, g.x - 2, g.y - 2, g.w + 4, g.h + 3, '#fbf8f2');
        pointArch(p, g.x, g.y, g.w, g.h, '#7fa0b4');
      },
      lit: lowerLit,
    },
    stained: {
      paint(p, g) {
        archShape(p, g.x - 1, g.y - 1, g.w + 2, g.h + 2, C.iron);
        const colors = ['#d0342a', '#3f7fb0', '#e8b83a', '#3f9a5a', '#a040a0'];
        for (let y = 0; y < g.h; y += 3) for (let x = 0; x < g.w; x += 3) archMask(p, g, x, y, colors[(x + y * 2) % 5]);
      },
      lit: lowerLit,
    },
  };

  // Doors.
  const plainDoor = (frame, leaf, glass) => (p, G) => {
    const y = G.doorTop;
    p.rect(G.doorX - 2, y - 2, G.doorW + 4, G.doorH + 2, frame);
    p.rect(G.doorX, y, G.doorW, G.doorH, T(leaf, -0.2));
    p.rect(G.doorX + 1, y + 1, G.doorW - 2, G.doorH - 1, leaf);
    if (glass) p.rect(G.doorX + 3, y + 4, G.doorW - 6, 7, glass);
    p.px(G.doorX + G.doorW - 3, G.floor - 10, C.butter);
  };
  const archDoor = (frame, leaf, shape = archShape) => (p, G) => {
    const y = G.doorTop;
    shape(p, G.doorX - 3, y - 5, G.doorW + 6, G.doorH + 5, frame);
    shape(p, G.doorX, y - 2, G.doorW, G.doorH + 2, leaf);
    p.rect(G.cx, y + 2, 1, G.doorH - 2, T(leaf, -0.3));
    p.px(G.doorX + G.doorW - 4, G.floor - 11, C.butter);
    p.px(G.doorX + 3, G.floor - 11, C.butter);
  };
  const DOOR = {
    plank: plainDoor('#a87848', '#b57f4f', '#bfe6ea'),
    blue: plainDoor(C.white, '#3f6f9f', '#bfe6ea'),
    painted(p, G) {
      const y = G.doorTop;
      p.rect(G.doorX - 3, y - 3, G.doorW + 6, G.doorH + 3, '#c8501e');
      p.rect(G.doorX, y, G.doorW, G.doorH, '#e8762e');
      p.rect(G.doorX + 3, y + 3, G.doorW - 6, G.doorH - 6, '#c8501e');
      p.rect(G.doorX + 5, y + 6, G.doorW - 10, G.doorH - 12, C.butter);
    },
    green: plainDoor(C.white, '#2f6f4f', '#bfe6ea'),
    teal: plainDoor('#5a3a24', '#2f7f86', '#f8ecc8'),
    paperdoor(p, G) {
      const y = G.doorTop;
      p.rect(G.doorX - 2, y - 2, G.doorW + 4, G.doorH + 2, '#5a3a24');
      latticeOf('#5a3a24', '#f8ecc8', 3)(p, { x: G.doorX, y, w: 7, h: G.doorH - 1 });
      latticeOf('#5a3a24', '#f8ecc8', 3)(p, { x: G.doorX + 9, y, w: 7, h: G.doorH - 1 });
    },
    noren(p, G) {
      const y = G.doorTop;
      p.rect(G.doorX - 2, y - 2, G.doorW + 4, G.doorH + 2, '#2f2420');
      p.rect(G.doorX, y, G.doorW, G.doorH, '#8a5a3c');
      p.rect(G.doorX - 2, y - 3, G.doorW + 4, 11, '#26406e');
      for (const x of [G.doorX + 3, G.doorX + 9]) p.rect(x, y - 3, 1, 11, '#1a2f52');
      p.ell(G.cx, y + 2, 2, 2, C.cream);
    },
    wood: archDoor(C.cocoa, '#8a5a3c'),
    bluearch: archDoor('#e8e4d8', '#2f6fb8'),
    horseshoe(p, G) {
      const y = G.doorTop;
      pointArch(p, G.doorX - 7, y - 11, G.doorW + 14, G.doorH + 11, C.white);
      pointArch(p, G.doorX - 5, y - 9, G.doorW + 10, G.doorH + 9, '#1f7f6a');
      for (let k = 0; k < 9; k++) p.px(G.doorX - 4 + k * 3, y - 2 + (k % 2), C.butter);
      archDoor('#8a5a3c', '#2f5fa8', pointArch)(p, G);
      for (let yy = y + 4; yy < G.floor - 2; yy += 5) for (let x = G.doorX + 2; x < G.doorX + G.doorW - 1; x += 4) p.px(x, yy, C.butter);
    },
    portcullis(p, G) {
      const y = G.doorTop;
      archShape(p, G.doorX - 6, y - 8, G.doorW + 12, G.doorH + 8, '#90949a');
      archShape(p, G.doorX - 2, y - 4, G.doorW + 4, G.doorH + 4, '#4a2f22');
      p.rect(G.doorX, y, G.doorW, G.doorH, '#8a5a3c');
      for (let x = G.doorX + 2; x < G.doorX + G.doorW; x += 3) p.rect(x, y, 1, G.doorH, '#6d4535');
      for (let yy = y + 3; yy < G.floor; yy += 5) p.rect(G.doorX, yy, G.doorW, 1, C.iron);
    },
    studded(p, G) {
      const y = G.doorTop;
      const gold = '#f0c040';
      p.rect(G.doorX - 2, y - 2, G.doorW + 4, G.doorH + 2, gold);
      p.rect(G.doorX, y, G.doorW, G.doorH, '#8f2420');
      for (let yy = y + 2; yy < G.floor - 2; yy += 4) for (let x = G.doorX + 2; x < G.doorX + G.doorW; x += 4) p.px(x, yy, gold);
      p.rect(G.cx, y, 1, G.doorH, INK);
    },
    goldarch(p, G) {
      const gold = '#f0c040';
      const y = G.doorTop;
      pointArch(p, G.doorX - 7, y - 13, G.doorW + 14, G.doorH + 13, gold);
      pointArch(p, G.doorX - 4, y - 8, G.doorW + 8, G.doorH + 8, '#b8302a');
      p.rect(G.doorX, y, G.doorW, G.doorH, '#8f2420');
      for (let yy = y + 2; yy < G.floor - 2; yy += 5) for (let x = G.doorX + 2; x < G.doorX + G.doorW; x += 4) p.px(x, yy, gold);
      p.rect(G.cx, y, 1, G.doorH, gold);
    },
  };

  // Foundations. A raised one lifts the door up a few steps.
  const steps = (p, G, c) => {
    p.rect(G.doorX - 3, G.base - 1, G.doorW + 6, 2, c);
  };
  const BASE = {
    none: { lift: 0, paint: (p, G) => steps(p, G, '#a8a49c') },
    fieldstone: {
      lift: 0,
      paint(p, G) {
        let seed = 3;
        for (let y = G.base - 7; y < G.base; y += 3) {
          for (let x = G.left - 3 + ((y - G.base) % 6 ? 0 : 2); x < G.right + 3; x += 6) {
            seed = (seed * 37 + 3) % 97;
            if (Math.abs(x + 2 - G.cx) < G.doorW / 2 + 1) continue;
            p.rect(x, y, 5, 2, seed % 2 ? '#b8b4ac' : '#98948c');
          }
        }
        steps(p, G, '#c8c4b8');
      },
    },
    deck: {
      lift: 3,
      paint(p, G) {
        p.rect(G.left - 5, G.base - 3, G.w + 10, 4, '#b57f4f');
        for (let x = G.left - 5; x < G.right + 5; x += 5) p.rect(x, G.base - 3, 1, 4, '#8a5a3c');
        p.rect(G.left - 5, G.base - 3, G.w + 10, 1, '#d9a860');
      },
    },
    tile: {
      lift: 0,
      paint(p, G) {
        for (let x = G.left; x < G.right; x += 6) {
          if (Math.abs(x + 3 - G.cx) < G.doorW / 2 + 1) continue;
          p.rect(x, G.base - 6, 6, 6, C.white);
          p.rect(x + 2, G.base - 5, 2, 4, '#2f6fb8');
          p.rect(x + 1, G.base - 4, 4, 2, '#2f6fb8');
          p.px(x + 2, G.base - 4, C.butter);
          p.px(x + 3, G.base - 3, C.butter);
        }
        steps(p, G, '#c89a70');
      },
    },
    water: {
      lift: 0,
      paint(p, G) {
        p.rect(G.left - 22, G.base - 3, G.w + 44, 4, '#5fa8c8');
        for (let x = G.left - 20; x < G.right + 18; x += 7) p.rect(x, G.base - 2, 3, 1, '#a8d8e8');
        p.ell(G.left - 12, G.base - 3, 7, 3, '#8f9498');
        p.ell(G.right + 12, G.base - 3, 6, 3, '#8f9498');
        p.rect(G.doorX - 3, G.base - 2, G.doorW + 6, 3, '#a8a49c');
      },
    },
    marble: {
      lift: 8,
      paint(p, G) {
        const y = G.base - 8;
        p.rect(G.left - 8, y, G.w + 16, 9, '#f0ece4');
        p.rect(G.left - 8, y, G.w + 16, 1, C.white);
        for (let x = G.left - 8; x < G.right + 8; x += 5) {
          if (Math.abs(x + 1 - G.cx) < G.doorW / 2 + 5) continue;
          p.rect(x, y - 5, 2, 5, '#f0ece4');
          p.px(x, y - 6, C.white);
        }
        p.rect(G.left - 8, y - 3, G.cx - G.doorW / 2 - 4 - (G.left - 8), 1, '#d8d4cc');
        p.rect(G.cx + G.doorW / 2 + 4, y - 3, G.right + 8 - (G.cx + G.doorW / 2 + 4), 1, '#d8d4cc');
        p.rect(G.doorX - 6, y, G.doorW + 12, 9, '#e8e4dc');
        for (let k = 0; k < 3; k++) p.rect(G.doorX - 6, y + 2 + k * 3, G.doorW + 12, 1, '#c8c4bc');
      },
    },
    giltmarble: {
      lift: 8,
      paint(p, G) {
        BASE.marble.paint(p, G);
        const y = G.base - 8;
        p.rect(G.left - 8, y, G.w + 16, 1, '#f0c040');
        p.rect(G.left - 8, G.base - 2, G.w + 16, 2, '#f0c040');
        for (let x = G.left - 8; x < G.right + 8; x += 5) {
          if (Math.abs(x + 1 - G.cx) < G.doorW / 2 + 5) continue;
          p.px(x, y - 6, C.butter);
        }
      },
    },
  };

  // Balconies across the front, above the door.
  const BALCONY = {
    none: {},
    flowers: {
      paint(p, G, y) {
        p.rect(G.left + 3, y, G.w - 6, 2, '#b57f4f');
        for (let x = G.left + 3; x < G.right - 4; x += 3) p.rect(x, y + 2, 2, 5, x % 6 ? '#a06c3e' : '#b57f4f');
        p.rect(G.left + 3, y + 7, G.w - 6, 1, '#6d4a2c');
        for (let x = G.left + 4; x < G.right - 4; x += 2) {
          p.px(x, y - 1, C.leaf);
          p.px(x + 1, y - 2, [C.tomato, C.rose][(x >> 1) % 2]);
        }
      },
    },
    wood: {
      paint(p, G, y) {
        const wood = '#5a3a24';
        p.rect(G.left - 2, y, G.w + 4, 2, wood);
        for (let x = G.left - 2; x < G.right + 2; x += 3) p.rect(x, y + 2, 1, 5, wood);
        p.rect(G.left - 2, y + 7, G.w + 4, 2, wood);
      },
    },
    iron: {
      paint(p, G, y) {
        p.rect(G.left + 2, y, G.w - 4, 1, INK);
        p.rect(G.left + 2, y + 7, G.w - 4, 2, '#5e6a78');
        for (let x = G.left + 2; x < G.right - 2; x += 4) {
          p.rect(x, y + 1, 1, 6, INK);
          p.px(x + 2, y + 3, INK);
          p.px(x + 2, y + 5, INK);
        }
      },
    },
    blue: {
      paint(p, G, y) {
        p.rect(G.left, y + 7, G.w, 2, '#e8e4d8');
        p.rect(G.left, y, G.w, 1, '#2f6fb8');
        for (let x = G.left; x < G.right; x += 3) p.rect(x, y + 1, 1, 6, '#2f6fb8');
      },
    },
    gallery: {
      paint(p, G, y) {
        const gold = '#f0c040';
        p.rect(G.left - 3, y + 7, G.w + 6, 2, '#b8302a');
        p.rect(G.left - 3, y, G.w + 6, 2, gold);
        for (let x = G.left - 3; x < G.right + 3; x += 6) {
          p.rect(x, y + 2, 1, 5, gold);
          p.rect(x + 1, y + 4, 5, 1, gold);
          p.px(x + 3, y + 3, '#b8302a');
          p.px(x + 3, y + 5, '#b8302a');
        }
      },
    },
  };

  // Towers and tall things beside the building. Some stand in front of its corners.
  const TOWERS = {
    none: {},
    bamboo: {
      front: true,
      paint(p, G) {
        for (const [x, h] of [[G.left - 8, 34], [G.left - 5, 26], [G.left - 11, 22], [G.right + 7, 30], [G.right + 4, 22]]) {
          p.rect(x, G.base - h, 2, h, C.leaf);
          for (let y = G.base - h + 4; y < G.base; y += 7) p.px(x, y, C.moss);
          p.line(x, G.base - h + 3, x + 4, G.base - h, C.moss);
          p.line(x + 1, G.base - h + 6, x - 3, G.base - h + 3, C.moss);
        }
      },
    },
    palms: {
      front: true,
      paint(p, G) {
        for (const [x, h] of [[G.left - 7, 30], [G.right + 7, 26]]) {
          p.rect(x - 4, G.base - 5, 9, 6, '#c8603a');
          p.rect(x - 4, G.base - 5, 9, 1, '#e0805a');
          p.rect(x, G.base - h, 2, h - 5, C.cocoa);
          for (const [dx, dy] of [[-8, 3], [-5, -3], [5, -3], [8, 3], [0, -5], [-7, 7], [8, 7]]) p.line(x + 1, G.base - h, x + 1 + dx, G.base - h + dy + 2, C.leaf);
        }
      },
    },
    belltower: {
      paint(p, G) {
        const x = G.right - 4;
        const top = G.top - 36;
        p.rect(x, top, 18, G.base - top, '#efc49a');
        p.rect(x - 2, top - 2, 22, 3, '#c8603a');
        p.ell(x + 9, top - 3, 3, 3, '#c8603a');
        archShape(p, x + 4, top + 3, 10, 14, '#7a4e30');
        p.rect(x + 7, top + 8, 4, 5, C.butter);
        p.rect(x, G.base - 4, 18, 4, '#c89a70');
      },
    },
    round: {
      front: true,
      paint(p, G) {
        const r = Math.max(10, Math.round(G.w * 0.11));
        for (const cx of [G.left + 2, G.right - 2]) {
          const y = G.top - 16;
          blocks(p, cx - r, y, r * 2, G.base - y + 1, '#b0b4b8', '#90949a');
          p.rect(cx - r, y, 2, G.base - y + 1, T('#b0b4b8', 0.3));
          p.rect(cx + r - 3, y, 3, G.base - y + 1, T('#b0b4b8', -0.25));
          p.rect(cx - r - 1, y - 1, r * 2 + 2, 3, '#90949a');
          cone(p, cx, y - 1, r + 3, Math.round(r * 2.6), '#3f6fb8', T('#3f6fb8', -0.25));
          pennant(p, cx - 1, y - 1 - Math.round(r * 2.6) - 9, 11, C.tomato);
          archShape(p, cx - 4, y + 8, 7, 12, '#90949a');
          archShape(p, cx - 3, y + 9, 5, 11, '#5a6878');
          G.windows.push({ x: cx - 3, y: y + 12, w: 5, h: 8 });
        }
      },
    },
    minarets: {
      paint(p, G) {
        const inlay = ['#c0392b', '#2f7f6a', '#2f5fa8', C.gold];
        for (const cx of [G.left - 11, G.right + 10]) {
          const top = G.top - 26;
          p.rect(cx - 4, top, 8, G.base - top, '#fbf8f2');
          p.rect(cx + 2, top, 2, G.base - top, '#e4dfd2');
          for (let yy = top + 12; yy < G.base; yy += 16) {
            p.rect(cx - 5, yy, 10, 2, '#e4dfd2');
            p.rect(cx - 5, yy, 10, 1, inlay[(yy >> 4) % 4]);
          }
          p.rect(cx - 5, top - 2, 10, 2, '#e4dfd2');
          onion(p, cx, top - 2, 5, 10, '#fbf8f2', null);
        }
      },
    },
    onion: {
      paint(p, G) {
        const set = [[G.left - 9, '#2f6fb8', '#f4ecdc'], [G.right + 8, '#d0408a', '#f0c040']];
        for (const [cx, a, b] of set) {
          const top = G.top - 22;
          p.rect(cx - 7, top, 14, G.base - top, '#f4ecdc');
          lines(p, cx - 7, top, 14, G.base - top, 4, '#d8ccb4');
          p.rect(cx - 8, top - 1, 16, 2, C.butter);
          archShape(p, cx - 2, top + 6, 5, 11, '#3f6f9f');
          onion(p, cx, top, 10, 24, a, b);
        }
      },
    },
    pagoda: {
      paint(p, G) {
        for (const cx of [G.left - 12, G.right + 11]) {
          let y = G.base;
          for (let k = 0; y > G.top - 30 && k < 7; k++) {
            const hw = Math.max(4, 8 - k);
            const hh = 13;
            p.rect(cx - hw, y - hh, hw * 2, hh, '#c8382a');
            p.rect(cx - 1, y - hh + 2, 2, hh - 3, C.butter);
            y -= hh;
            for (let r = 0; r < 3; r++) p.rect(cx - hw - 4 + r, y - 1 - r, (hw + 4 - r) * 2, 1, r === 0 ? '#39414c' : '#4f5864');
            y -= 3;
          }
          p.rect(cx - 1, y - 9, 2, 9, '#f0c040');
          p.px(cx - 1, y - 10, C.white);
        }
      },
    },
  };

  // Finishing touches.
  const TRIM = {
    none: {},
    flowers: {
      paint(p, G) {
        for (const g of G.windows) {
          if (g.w < 12 || g.y > G.floor) continue;
          p.rect(g.x - 1, g.y + g.h + 1, g.w + 2, 3, C.brick);
          for (let k = 0; k < g.w; k += 2) {
            p.px(g.x + k, g.y + g.h, C.leaf);
            p.px(g.x + k + 1, g.y + g.h - 1, k % 4 ? C.butter : C.rose);
          }
        }
      },
    },
    ivy: {
      paint(p, G) {
        let seed = 3;
        for (let i = 0; i < 44; i++) {
          seed = (seed * 41 + 3) % 8191;
          p.rect(G.left + (seed % 18) - 2, G.base - 2 - ((seed >> 3) % Math.round(G.h * 0.85)), 2, 2, i % 3 ? C.moss : C.leaf);
        }
      },
    },
    lights: {
      paint(p, G) {
        for (let x = G.left - 8; x < G.right + 8; x += 5) p.px(x, G.top + 2 + (x % 2), [C.butter, C.tomato, C.sky, C.leaf][((x + 800) / 5) & 3]);
      },
    },
    banner: {
      paint(p, G) {
        for (let x = G.left - 6; x < G.right + 4; x += 8) {
          const c = [C.tomato, C.butter, C.sky][((x + 800) / 8) % 3 | 0];
          p.rect(x, G.top + 3, 5, 2, c);
          p.rect(x + 1, G.top + 5, 3, 1, c);
          p.px(x + 2, G.top + 6, c);
        }
      },
    },
    silk: {
      paint(p, G) {
        const colors = [C.tomato, C.butter, '#d0408a', '#f28a2e', '#3f9a6a'];
        const ly = G.top + 2;
        p.rect(G.left - 8, ly, G.w + 16, 1, '#5a3a24');
        let n = 0;
        for (let x = G.left - 6; x < G.right + 4; x += 10) lantern(p, x, ly + 2, colors[n++ % colors.length], '#5a3a24');
      },
    },
    paperflags: {
      paint(p, G) {
        const colors = [C.tomato, '#e0408a', C.butter, '#2fa89a', '#7a5ad0'];
        const fy = G.top - 2;
        for (let x = G.left - 8, i = 0; x < G.right + 8; x += 7, i++) {
          p.rect(x, fy, 6, 5, colors[i % 5]);
          p.px(x + 1, fy + 5, colors[i % 5]);
          p.px(x + 4, fy + 5, colors[i % 5]);
        }
        p.rect(G.left - 8, fy, G.w + 16, 1, C.white);
      },
    },
    vines: {
      paint(p, G) {
        let seed = 17;
        for (let i = 0; i < 70; i++) {
          seed = (seed * 41 + 3) % 8191;
          const side = i % 2 ? G.left - 3 : G.right - 12;
          p.rect(side + (seed % 15), G.top - 2 + ((seed >> 3) % Math.round(G.h * 0.6)), 2, 2, i % 4 ? '#e0408a' : '#6fb36b');
        }
      },
    },
    redlanterns: {
      paint(p, G) {
        const gold = '#f0c040';
        const n = Math.max(4, Math.round(G.w / 26));
        for (let i = 0; i < n; i++) {
          const x = Math.round(G.left + 4 + (i * (G.w - 10)) / (n - 1));
          p.rect(x + 1, G.top - 1, 1, 4, gold);
          p.ell(x + 1, G.top + 6, 3, 3, C.tomato);
          p.px(x, G.top + 5, '#ff9a7a');
          p.rect(x + 1, G.top + 9, 1, 3, gold);
        }
      },
    },
    garlands: {
      paint(p, G) {
        const gold = '#f0c040';
        const n = Math.max(3, Math.round(G.w / 22));
        const span = G.w / n;
        for (let i = 0; i < n; i++) {
          for (let k = 0; k <= span; k++) {
            const x = G.left + i * span + k;
            const dip = Math.round(Math.sin((k / span) * Math.PI) * 6);
            p.px(x, G.top + 3 + dip, k % 2 ? gold : '#fff0a0');
            if (k % 5 === 2) p.px(x, G.top + 4 + dip, C.rose);
          }
          p.rect(G.left + i * span - 1, G.top + 2, 3, 3, C.tomato);
        }
        p.rect(G.right - 1, G.top + 2, 3, 3, C.tomato);
      },
    },
  };

  // Signs for the shop.
  const SIGN = {
    none: {},
    board: {
      paint(p, G) {
        const y = G.doorTop - 16;
        p.rect(G.cx - 16, y, 32, 9, C.cocoa);
        p.rect(G.cx - 15, y + 1, 30, 7, C.honey);
        for (let x = G.cx - 12; x < G.cx + 12; x += 4) p.rect(x, y + 3, 2, 3, C.cocoa);
      },
    },
    hanging: {
      paint(p, G) {
        const sx = G.right - 4;
        const y = G.floor - 42;
        p.rect(sx, y, 12, 2, C.iron);
        p.rect(sx + 3, y + 2, 10, 12, C.cocoa);
        p.rect(sx + 4, y + 3, 8, 10, C.butter);
        p.rect(sx + 6, y + 5, 4, 5, C.tomato);
      },
    },
    neon: {
      paint(p, G) {
        const y = G.doorTop - 17;
        p.rect(G.cx - 17, y, 34, 10, INK);
        for (let x = G.cx - 14; x < G.cx + 14; x += 4) {
          p.rect(x, y + 2, 2, 6, '#ff5a9a');
          p.px(x + 2, y + 2, '#8ff0ff');
          p.px(x + 2, y + 7, '#8ff0ff');
        }
      },
    },
    plaque: {
      paint(p, G) {
        const y = G.doorTop - 18;
        const gold = '#f0c040';
        p.rect(G.cx - 16, y, 32, 11, gold);
        p.rect(G.cx - 15, y + 1, 30, 9, '#8f2420');
        for (let x = G.cx - 12; x < G.cx + 12; x += 4) p.rect(x, y + 3, 2, 5, gold);
        p.px(G.cx - 17, y + 5, gold);
        p.px(G.cx + 16, y + 5, gold);
      },
    },
    marquee: {
      paint(p, G) {
        const y = G.doorTop - 21;
        p.rect(G.cx - 22, y, 44, 14, C.tomato);
        p.rect(G.cx - 20, y + 2, 40, 10, C.paper);
        for (let x = G.cx - 22; x < G.cx + 22; x += 4) {
          p.px(x, y, C.butter);
          p.px(x, y + 13, C.butter);
        }
        for (let x = G.cx - 16; x < G.cx + 16; x += 4) p.rect(x, y + 4, 2, 6, INK);
      },
    },
    banner: {
      paint(p, G) {
        const y = G.doorTop - 30;
        p.rect(G.cx - 7, y, 14, 18, C.tomato);
        p.rect(G.cx - 7, y, 14, 2, C.butter);
        for (let k = 0; k < 4; k++) p.rect(G.cx - 7 + k, y + 18 + k, 14 - k * 2, 1, C.tomato);
        p.rect(G.cx - 2, y + 6, 4, 6, C.butter);
      },
    },
  };

  WW.PART_ART = { wall: WALL, roof: ROOF, crown: CROWN, awning: AWNING, windows: WINDOWS, door: DOOR, base: BASE, balcony: BALCONY, towers: TOWERS, trim: TRIM, sign: SIGN };

  // Where the windows of this building go.
  function placeWindows(G, ext) {
    const out = [];
    const lowY = G.floor - 24;
    const clear = G.doorW / 2 + 6;
    const step = 22;
    for (let x = G.cx - clear - 14; x >= G.left + 4; x -= step) out.push({ x: Math.round(x), y: lowY, w: 14, h: 14 });
    for (let x = G.cx + clear; x + 14 <= G.right - 4; x += step) out.push({ x: Math.round(x), y: lowY, w: 14, h: 14 });
    const stop = lowY - 14 - (ext.awning !== 'none' ? 6 : 0);
    const n = Math.max(1, Math.floor((G.w - 8) / step));
    const start = G.cx - (n * step - (step - 14)) / 2;
    for (let y = G.top + 6; y + 12 <= stop; y += 20) {
      for (let i = 0; i < n; i++) out.push({ x: Math.round(start + i * step), y, w: 14, h: 12 });
    }
    return out;
  }
  // Snow settles on whatever is highest in each column.
  function snowCap(p) {
    for (let x = 0; x < p.w; x++) {
      for (let y = 0; y < p.h; y++) {
        if (!p.get(x, y)) continue;
        p.px(x, y, C.white);
        if (p.get(x, y + 1)) p.px(x, y + 1, C.white);
        break;
      }
    }
  }
  WW.snowCap = snowCap;
  const rowHasPaint = (p, y) => {
    for (let x = 0; x < p.w; x++) if (p.get(x, y)) return true;
    return false;
  };

  // Paints a building from its parts, cropped to what is really there.
  WW.paintHouse = function (extIn, room, season) {
    const ext = Object.assign({}, WW.EXTERIOR_DEFAULT, extIn);
    const I = WW.exteriorInfo(room);
    const margin = 36;
    const W = I.w + margin * 2;
    const H = I.h + 150;
    const left = margin;
    const base = H - 2;
    const top = base - I.h + 1;
    const cx = Math.round(left + I.w / 2);
    const lift = BASE[ext.base].lift;
    const floor = base - lift;
    const G = { w: I.w, h: I.h, left, right: left + I.w, base, top, cx, lift, floor, doorW: 16, doorH: 24, doorX: cx - 8, doorTop: floor - 24, windows: [], smoke: null };
    const p = new Px(W, H);
    const roof = ROOF[ext.roof];
    const roofH = roof.h(G);
    const peak = top - roofH;
    const crown = CROWN[ext.crown];
    const towers = TOWERS[ext.towers];
    const awning = AWNING[ext.awning];
    if (towers.paint && !towers.front) towers.paint(p, G);
    if (crown.paint && !crown.over) crown.paint(p, G, peak);
    WALL[ext.wall](p, G);
    roof.paint(p, G, roofH);
    if (crown.paint && crown.over) crown.paint(p, G, peak);
    if (awning.paint && awning.under) awning.paint(p, G);
    const placed = placeWindows(G, ext);
    const look = WINDOWS[ext.windows];
    for (const g of placed) look.paint(p, g);
    if (BALCONY[ext.balcony].paint) BALCONY[ext.balcony].paint(p, G, floor - 46);
    if (awning.paint && !awning.under) awning.paint(p, G);
    DOOR[ext.door](p, G);
    BASE[ext.base].paint(p, G);
    if (TRIM[ext.trim].paint) {
      const own = G.windows;
      G.windows = placed;
      TRIM[ext.trim].paint(p, G);
      G.windows = own;
    }
    if (SIGN[ext.sign].paint) SIGN[ext.sign].paint(p, G);
    if (towers.paint && towers.front) towers.paint(p, G);
    if (WW.SEASON_ART[season].snow) snowCap(p);
    p.outline();
    let first = 0;
    while (first < H - 1 && !rowHasPaint(p, first)) first++;
    first = Math.max(0, first - 1);
    const out = new Px(W, H - first);
    out.stamp(p, 0, -first);
    const lit = [];
    for (const g of placed) for (const r of look.lit(g)) lit.push(r);
    for (const g of G.windows) lit.push({ x: g.x, y: g.y, w: g.w, h: g.h });
    return {
      canvas: out.canvas(),
      W,
      H: H - first,
      w: I.w,
      h: I.h,
      left,
      base: base - first,
      top: top - first,
      doorX: G.doorX,
      doorW: G.doorW,
      doorH: G.doorH,
      lift,
      windows: lit.map((g) => Object.assign({}, g, { y: g.y - first })),
      smoke: G.smoke ? { x: G.smoke.x, y: G.smoke.y - first } : null,
    };
  };
})((globalThis.WW = globalThis.WW || {}));
