// Paints tiny animals from a spec. Every animal faces right on a 20 x 24 cell, feet on row 22.
(function (WW) {
  const { Px, C } = WW;
  const W = 20;
  const H = 24;
  const EYE = C.ink;

  function eye(p, x, y, big) {
    if (big) {
      p.rect(x - 1, y - 1, 3, 3, EYE);
      p.px(x - 1, y - 1, C.white);
      p.px(x, y - 1, C.white);
    } else {
      p.rect(x, y, 2, 2, EYE);
      p.px(x, y, C.white);
    }
  }
  const cheek = (p, x, y, c) => p.px(x, y, c || C.rose);

  // Ear shapes, sitting on a head centred at hx, hy with radius r.
  function ears(p, type, hx, hy, r, c, inner) {
    const top = hy - r;
    switch (type) {
      case 'round':
        p.disc(hx - 2, top + 1, 2, c);
        p.disc(hx + 3, top + 1, 2, c);
        p.px(hx - 2, top + 1, inner);
        p.px(hx + 3, top + 1, inner);
        break;
      case 'big':
        p.disc(hx - 3, top + 1, 3, c);
        p.disc(hx + 3, top, 3, c);
        p.rect(hx - 3, top, 2, 2, inner);
        p.rect(hx + 3, top - 1, 2, 2, inner);
        break;
      case 'huge':
        p.disc(hx - 4, top, 4, c);
        p.disc(hx + 4, top - 1, 4, c);
        p.disc(hx - 4, top, 2, inner);
        p.disc(hx + 4, top - 1, 2, inner);
        break;
      case 'point':
        p.grid(hx - 4, top - 3, ['#.....#.', '##....##', '##....##', '###..###'].map((s) => s), { '#': c });
        p.px(hx - 3, top - 1, inner);
        p.px(hx + 2, top - 1, inner);
        break;
      case 'tall':
        p.rect(hx - 3, top - 5, 2, 6, c);
        p.rect(hx + 1, top - 5, 2, 6, c);
        p.rect(hx - 3 + 1, top - 4, 1, 4, inner);
        p.rect(hx + 1 + 1, top - 4, 1, 4, inner);
        break;
      case 'droop':
        p.rect(hx - 4, top + 1, 2, 5, c);
        p.rect(hx - 1, top - 1, 3, 2, c);
        break;
      case 'tiny':
        p.px(hx - 2, top, c);
        p.px(hx + 2, top, c);
        break;
      default:
        break;
    }
  }

  function tail(p, type, x, y, c, c2) {
    switch (type) {
      case 'thin':
        p.line(x, y, x - 3, y + 1, c2 || C.rose);
        p.line(x - 3, y + 1, x - 4, y - 2, c2 || C.rose);
        break;
      case 'stub':
        p.rect(x - 1, y - 1, 2, 2, c);
        break;
      case 'short':
        p.line(x, y, x - 2, y - 2, c);
        p.line(x + 1, y, x - 1, y - 2, c);
        break;
      case 'long':
        p.line(x, y, x - 3, y - 2, c);
        p.line(x - 3, y - 2, x - 3, y - 6, c);
        break;
      case 'curl':
        p.grid(x - 3, y - 3, ['.##', '#.#', '..#', '.##'], { '#': c });
        break;
      case 'bushy':
        p.ell(x - 2, y - 3, 2, 4, c);
        if (c2) p.ell(x - 2, y - 6, 1, 1, c2);
        break;
      case 'big':
        p.ell(x - 2, y - 5, 3, 6, c);
        if (c2) p.ell(x - 2, y - 9, 2, 2, c2);
        break;
      case 'ring':
        p.ell(x - 2, y - 3, 2, 4, c);
        p.rect(x - 4, y - 5, 5, 1, c2);
        p.rect(x - 4, y - 2, 5, 1, c2);
        break;
      case 'tuft':
        p.line(x, y, x - 3, y + 1, c);
        p.disc(x - 4, y + 1, 1, c2 || c);
        break;
      case 'flat':
        p.ell(x - 2, y + 2, 3, 1, c2 || c);
        break;
      case 'taper':
        p.rect(x - 2, y, 3, 2, c);
        p.rect(x - 4, y + 1, 2, 1, c);
        p.px(x - 5, y + 1, c);
        break;
      default:
        break;
    }
  }

  function pattern(p, s, x, y, w, h) {
    const c = s.c2 || C.ink;
    const m = s.mark;
    if (!m) return;
    p.mask((q) => {
      if (m === 'stripes') for (let i = x + 1; i < x + w; i += 3) q.rect(i, y, 1, h, c);
      else if (m === 'bands') for (let i = y + 1; i < y + h; i += 2) q.rect(x, i, w, 1, c);
      else if (m === 'spots') {
        for (let i = 0; i < 7; i++) q.px(x + ((i * 5 + 2) % w), y + ((i * 3 + 1) % h), c);
        for (let i = 0; i < 4; i++) q.rect(x + ((i * 7 + 4) % w), y + ((i * 5 + 3) % h), 2, 1, c);
      } else if (m === 'patch') {
        q.ell(x + 2, y + 2, 2, 2, c);
        q.ell(x + w - 3, y + h - 2, 3, 2, c);
      } else if (m === 'saddle') q.rect(x + 2, y, w - 4, Math.ceil(h / 2), c);
      else if (m === 'stripe') q.rect(x, y, w, 1, c);
      else if (m === 'scale') {
        for (let j = 0; j < h; j += 2) for (let i = (j % 4) / 2; i < w; i += 2) q.px(x + i, y + j, c);
      } else if (m === 'dapple') {
        for (let j = 0; j < h; j += 2) for (let i = j % 4 ? 0 : 1; i < w; i += 3) q.px(x + i, y + j, c);
      }
    });
  }

  const AR = {};

  // Round fluffball, the hamster family.
  AR.ball = (p, s, f) => {
    const c = s.c;
    const r = s.r || 6;
    const cy = 22 - r - 1;
    tail(p, s.tail, 4, cy + 3, c, s.c3);
    p.rect(6, 21, 2 + (f ? 1 : 0), 2, s.feet || WW.tone(c, -0.15));
    p.rect(12 - (f ? 1 : 0), 21, 2, 2, s.feet || WW.tone(c, -0.15));
    p.disc(10, cy, r, c);
    if (s.spiky) {
      for (let a = 0; a < 15; a++) {
        const ang = Math.PI * (0.55 + a * 0.095);
        p.px(10 + Math.cos(ang) * (r + 1), cy + Math.sin(ang) * (r + 1), s.c2);
        p.line(10 + Math.cos(ang) * (r - 2), cy + Math.sin(ang) * (r - 2), 10 + Math.cos(ang) * r, cy + Math.sin(ang) * r, s.c2);
      }
      p.disc(14, cy + 2, 3, s.b || C.oat);
    }
    pattern(p, s, 4, cy - r, 13, r * 2);
    if (s.b && !s.spiky) p.ell(12, cy + 3, 3, 2, s.b);
    p.shade();
    ears(p, s.ear, 11, cy, r, c, s.inner || C.rose);
    const ex = 13;
    eye(p, ex, cy - 2);
    p.px(16, cy, s.nose || C.brick);
    cheek(p, 13, cy + 1, s.cheek);
    if (s.whisk) {
      p.px(17, cy + 1, C.iron);
    }
  };

  // Chibi four legged animal.
  AR.quad = (p, s, f) => {
    const c = s.c;
    const neck = s.neck || 0;
    const hr = s.hr || 5;
    const hx = s.snout === 'trunk' || hr > 5 ? 11 : s.snout === 'long' || s.snout === 'thin' ? 12 : 13;
    const hy = 10 - neck + (5 - hr) + (s.lowHead || 0);
    tail(p, s.tail, 4, 13, c, s.c3);
    const ly = f ? 0 : 1;
    const leg = s.legc || WW.tone(c, -0.12);
    const ll = 18;
    const lh = 5;
    p.rect(5, ll, 2, lh - ly, leg);
    p.rect(9, ll, 2, lh - (f ? 1 : 0), leg);
    p.rect(11, ll, 2, lh - ly, s.legc || c);
    p.rect(7, ll, 2, lh - (f ? 1 : 0), s.legc || c);
    p.ell(9, 15, 6, 4, c);
    pattern(p, s, 3, 11, 13, 8);
    if (s.wool) {
      for (const [x, y] of [[5, 12], [9, 11], [13, 12], [4, 16], [8, 16], [12, 16]]) p.disc(x, y, 3, s.wool);
    }
    if (s.b) p.ell(10, 18, 4, 1, s.b);
    if (neck) p.rect(11, hy + 2, 4, neck + 4, c);
    if (neck) pattern(p, s, 11, hy + 2, 4, neck + 4);
    if (s.mane) p.disc(hx - 2, hy + 1, hr + 2, s.mane);
    if (s.bigEar) p.disc(hx - 4, hy + 1, 4, s.c2 || WW.tone(c, -0.15));
    p.disc(hx, hy, hr, c);
    if (s.facemark === 'mask') p.rect(hx + 1, hy - 1, 5, 2, s.c2);
    if (s.facemark === 'stripe') p.rect(hx + 1, hy - 4, 1, 7, s.c2);
    if (s.facemark === 'patch') p.disc(hx + 3, hy - 1, 2, s.c2);
    pattern(p, Object.assign({}, s, { mark: s.mark === 'stripes' ? 'stripes' : null }), hx - hr, hy - hr, hr * 2, 3);
    p.shade();
    if (s.bigEar) {
      p.ell(hx - 3, hy, 3, 4, s.c2 || WW.tone(c, -0.15));
      p.ell(hx - 3, hy, 1, 2, WW.tone(c, -0.3));
    }
    ears(p, s.ear, hx, hy, hr, s.earc || c, s.inner || C.rose);
    if (s.mane && s.ear) p.disc(hx - 1, hy - hr + 1, 1, s.inner || C.rose);
    // muzzle
    const snoutY = hy + 2;
    const mc = s.b || WW.tone(c, 0.35);
    if (s.snout === 'long') {
      p.rect(hx + 3, snoutY - 1, 5, 3, mc);
      p.px(hx + 7, snoutY - 1, s.nose || C.ink);
    } else if (s.snout === 'pig') {
      p.rrect(hx + 3, snoutY - 2, 4, 4, s.nosec || C.rose);
      p.px(hx + 5, snoutY - 1, C.ink);
      p.px(hx + 5, snoutY + 1, C.ink);
    } else if (s.snout === 'wide') {
      p.rrect(hx + 2, snoutY - 1, 6, 4, mc);
      p.px(hx + 6, snoutY, C.ink);
    } else if (s.snout === 'trunk') {
      const sw = f ? 1 : 0;
      p.rect(hx + 4, hy, 2, 5, c);
      p.rect(hx + 5, hy + 4, 2, 3, c);
      p.rect(hx + 6, hy + 6 - sw, 2, 2, c);
    } else if (s.snout === 'thin') {
      p.rect(hx + 3, snoutY, 6, 1, mc);
      p.px(hx + 8, snoutY, C.ink);
    } else {
      p.rect(hx + 3, snoutY - 1, 3, 3, mc);
      p.px(hx + 5, snoutY - 1, s.nose || C.ink);
    }
    eye(p, hx + 2, hy - 2);
    if (!s.nocheek) cheek(p, hx + 1, hy + 2, s.cheek);
    if (s.horn === 'nose') {
      p.rect(hx + 5, snoutY - 3, 1, 2, C.oat);
      p.px(hx + 5, snoutY - 4, C.oat);
    } else if (s.horn === 'curve') {
      p.grid(hx - 3, hy - hr - 3, ['##..##', '#....#', '#....#'], { '#': s.hornc || C.oat });
    } else if (s.horn === 'stub') {
      p.rect(hx - 2, hy - hr - 1, 1, 2, s.hornc || C.cocoa);
      p.rect(hx + 2, hy - hr - 1, 1, 2, s.hornc || C.cocoa);
      p.px(hx - 2, hy - hr - 2, C.ink);
      p.px(hx + 2, hy - hr - 2, C.ink);
    } else if (s.horn === 'antler') {
      p.grid(hx - 5, hy - hr - 5, ['#.#...#.#', '###...###', '.#.....#.', '.##...##.', '..#...#..'], { '#': s.hornc || C.bark });
    } else if (s.horn === 'single') {
      p.line(hx + 3, hy - hr + 1, hx + 6, hy - hr - 4, s.hornc || C.butter);
    }
    if (s.tusk) p.line(hx + 4, snoutY + 2, hx + 5, snoutY + 5, C.cream);
    if (s.frill) {
      p.disc(hx - 4, hy - 1, 5, s.frill);
      p.disc(hx, hy, hr, c);
      eye(p, hx + 2, hy - 2);
      p.px(hx + 2, hy - hr - 1, C.oat);
      p.line(hx + 5, hy - 3, hx + 7, hy - 5, C.oat);
    }
    if (s.plates) for (let i = 0; i < 4; i++) p.grid(3 + i * 3, 8 + (i === 0 || i === 3 ? 1 : 0), ['.#.', '###'], { '#': s.plates });
    if (s.hump) {
      p.ell(7, 10, 3, 3, WW.tone(c, 0.12));
      p.rect(4, 12, 7, 2, c);
    }
  };

  // Stands up on hind legs.
  AR.up = (p, s, f) => {
    const c = s.c;
    tail(p, s.tail, 6, 18, c, s.c3);
    p.rect(7, 20, 2, 3 - (f ? 1 : 0), s.feet || WW.tone(c, -0.15));
    p.rect(11, 20, 2, f ? 3 : 2, s.feet || WW.tone(c, -0.15));
    if (s.bigfoot) p.rect(10, 21, 6, 2, s.feet || WW.tone(c, -0.15));
    p.ell(10, 16, 4, 5, c);
    if (s.b) p.ell(11, 17, 2, 3, s.b);
    pattern(p, s, 6, 11, 9, 10);
    const hy = s.hy || 8;
    const hr = s.hr || 4;
    p.disc(11, hy, hr, c);
    if (s.face) p.disc(13, hy + 1, 2, s.face);
    if (s.facemark === 'mask') p.rect(11, hy - 1, 5, 2, s.c2);
    p.shade();
    ears(p, s.ear, 11, hy, hr, s.earc || c, s.inner || C.rose);
    p.rect(13, 14, 2, 2 + (f ? 1 : 0), WW.tone(c, -0.1));
    eye(p, 13, hy - 1, s.bigeye);
    p.px(15, hy + 1, s.nose || C.ink);
    if (s.beak) p.rect(15, hy, 3, 2, s.beak);
  };

  // Long and low: weasels, lizards, crocodiles, seals.
  AR.long = (p, s, f) => {
    const c = s.c;
    const y = s.y || 16;
    const hr = s.hr || 4;
    const hx = 14 - (hr > 4 ? 1 : 0) - (s.snout === 'long' ? 2 : 0);
    const hy = y - 2;
    if (s.tail !== 'none') {
      const tc = s.tailc || c;
      if (s.tail === 'lizard') {
        p.rect(0, y + 3, 5, 2, tc);
        p.rect(0, y + 2, 2, 1, tc);
        p.px(0, y + 1, tc);
      } else tail(p, s.tail || 'taper', 3, y + 1, tc, s.c3);
    }
    if (!s.nolegs) {
      const lc = WW.tone(c, -0.18);
      p.rect(3 + (f ? 1 : 0), y + 4, 3, 3, lc);
      p.rect(7 - (f ? 1 : 0), y + 4, 2, 3, c);
      p.rect(10 + (f ? 1 : 0), y + 4, 3, 3, lc);
    }
    p.ell(8, y + 2, 6, 3, c);
    pattern(p, s, 2, y - 1, 12, 7);
    if (s.b) p.rect(5, y + 4, 8, 1, s.b);
    p.disc(hx, hy, hr, c);
    if (s.snout === 'long') p.rrect(hx + 2, hy, 5, 4, s.mc || c);
    else if (s.b) p.rect(hx + 1, hy + 1, 3, 2, s.b);
    p.shade();
    ears(p, s.ear, hx, hy, hr, c, s.inner || C.rose);
    if (s.bumpEye) {
      p.disc(hx + 1, hy - hr, 2, c);
      p.rect(hx + 1, hy - hr - 1, 2, 2, EYE);
      p.px(hx + 1, hy - hr - 1, C.white);
    } else eye(p, hx + 1, hy - 2);
    if (s.snout !== 'long') p.px(hx + hr - 1, hy, s.nose || C.ink);
    else p.px(hx + 6, hy, s.nose || C.ink);
    if (!s.bumpEye && !s.nocheek) cheek(p, hx, hy + 1, s.cheek);
    if (s.gills) {
      p.line(hx - 4, hy - 5, hx - 2, hy - 3, s.gills);
      p.line(hx - 6, hy - 2, hx - 3, hy - 2, s.gills);
      p.line(hx - 5, hy + 2, hx - 3, hy + 1, s.gills);
    }
    if (s.tusk) p.rect(hx + 2, hy + 3, 1, 4, C.cream);
    if (s.spines) for (let i = 3; i < 12; i += 2) p.px(i, y - 2, s.spines);
    if (s.flipper) {
      p.rect(9, y + 4, 4, 2, s.flipper);
      p.rect(1, y + 3, 3, 2, s.flipper);
    }
  };

  // Jumping legs and feelers: crickets, grasshoppers, mantises.
  AR.insect = (p, s, f) => {
    const c = s.c;
    const leg = s.leg2 || WW.tone(c, -0.25);
    const j = f ? 1 : 0;
    if (s.kind === 'mantis') {
      p.line(6, 20, 5 - j, 22, leg);
      p.line(10, 20, 11 + j, 22, leg);
      p.ell(5, 18, 4, 2, c);
      p.rect(8, 11, 3, 8, c);
      p.grid(9, 7, ['.####.', '######', '.####.', '..##..'], { '#': c });
      p.shade();
      p.grid(12, 12 - j, ['.##.', '#..#', '...#', '..#.'], { '#': s.c2 || leg });
      p.px(10, 8, EYE);
      p.px(13, 8, EYE);
      p.line(10, 6, 8, 3, leg);
      p.line(13, 6, 15, 3, leg);
      return;
    }
    p.line(11, 19, 10 + j, 22, leg);
    p.line(14, 19, 15 - j, 22, leg);
    p.ell(9, 17, 7, 3, c);
    p.disc(15, 15, 3, c);
    if (s.wing) p.ell(7, 16, 5, 1, s.wing);
    p.shade();
    p.grid(1, 9 + j, ['..###.', '.#...#', '#....#', '#...#.', '#.....', '#.....'], { '#': leg });
    p.line(1, 15 + j, 0, 22, leg);
    p.rect(0, 22, 3, 1, leg);
    p.rect(15, 14, 2, 2, EYE);
    p.px(15, 14, C.white);
    p.line(15, 12, 12, 7, leg);
    p.line(17, 12, 18, 7, leg);
  };

  // Front facing squat body with bulging eyes.
  AR.frog = (p, s, f) => {
    const c = s.c;
    const j = f ? 1 : 0;
    p.ell(10, 18 - j, 7, 4, c);
    p.rect(2, 21, 4, 2, WW.tone(c, -0.15));
    p.rect(14, 21, 4, 2, WW.tone(c, -0.15));
    p.ell(10, 19 - j, 4, 2, s.b || C.oat);
    pattern(p, s, 4, 14 - j, 12, 7);
    p.shade();
    p.disc(6, 13 - j, 2, c);
    p.disc(14, 13 - j, 2, c);
    p.rect(5, 12 - j, 3, 3, s.eyec || C.cream);
    p.rect(13, 12 - j, 3, 3, s.eyec || C.cream);
    p.rect(6, 13 - j, 2, 2, EYE);
    p.rect(14, 13 - j, 2, 2, EYE);
    p.rect(7, 18 - j, 6, 1, C.ink);
    cheek(p, 4, 17 - j, s.cheek);
    cheek(p, 16, 17 - j, s.cheek);
  };

  AR.bird = (p, s, f) => {
    const c = s.c;
    const up = s.leg ? s.leg : 0;
    const by = 14 - up;
    const legc = s.legc || C.gold;
    p.rect(9 - (f ? 1 : 0), by + 5, 1, 4 + up, legc);
    p.rect(12, by + 5, 1, 4 + up, legc);
    p.rect(9 - (f ? 1 : 0), 22, 3, 1, legc);
    p.rect(12, 22, 3, 1, legc);
    if (s.fan) {
      p.ell(5, by - 2, 5, 7, s.fan);
      for (let i = 0; i < 5; i++) p.px(2 + i * 2, by - 6 + (i % 2), s.c3 || C.butter);
    } else if (s.longtail) p.rect(0, by + 1, 6, 2, s.c2 || c);
    else p.grid(1, by - 1, ['##...', '.###.', '..###'], { '#': s.c2 || WW.tone(c, -0.2) });
    p.ell(9, by, 6, 5, c);
    p.disc(12, by - 4, 4, c);
    if (s.b) p.ell(11, by + 2, 4, 2, s.b);
    if (s.cap) p.ell(12, by - 7, 3, 1, s.cap);
    if (s.mask) p.rect(12, by - 5, 5, 2, s.mask);
    p.shade();
    const flap = f ? 1 : 0;
    p.ell(7, by + flap, 3, 2, s.wing || s.c2 || WW.tone(c, -0.2));
    if (s.tufts) {
      p.line(9, by - 8, 9, by - 10, c);
      p.line(14, by - 8, 15, by - 10, c);
    }
    if (s.crest) p.grid(9, by - 11, ['#..#', '.##.', '.##.', '..#.'], { '#': s.crest });
    if (s.comb) p.grid(10, by - 10, ['#.#', '###'], { '#': C.tomato });
    if (s.owl) {
      p.disc(13, by - 4, 2, C.cream);
      p.disc(10, by - 4, 2, C.cream);
      p.rect(13, by - 5, 2, 2, EYE);
      p.rect(10, by - 5, 2, 2, EYE);
      p.px(12, by - 2, C.gold);
    } else {
      eye(p, 13, by - 5);
      const beak = s.beakc || C.gold;
      if (s.beak === 'flat') p.rect(16, by - 4, 3, 2, beak);
      else if (s.beak === 'big') {
        p.rrect(15, by - 6, 5, 4, beak);
        p.rect(17, by - 4, 3, 1, s.c3 || C.brick);
      } else if (s.beak === 'needle') p.rect(16, by - 4, 4, 1, beak);
      else if (s.beak === 'hook') p.grid(16, by - 5, ['##.', '###', '.#.'], { '#': beak });
      else p.rect(16, by - 4, 2, 1, beak);
    }
    if (s.wattle) p.rect(14, by - 2, 1, 2, C.tomato);
  };

  // Domed beetles.
  AR.bug = (p, s, f) => {
    const c = s.c;
    const legc = s.legc || C.ink;
    const j = f ? 1 : 0;
    for (const x of [5, 9, 13]) p.line(x, 20, x - 1 + j, 22, legc);
    p.disc(16, 17, 2, s.head || C.ink);
    p.ell(9, 16, 7, 5, c);
    pattern(p, s, 3, 11, 13, 9);
    p.shade(-0.2, 0.28);
    p.line(10, 12, 13, 20, s.line || WW.tone(c, -0.35));
    p.px(17, 16, C.white);
    p.line(16, 15, 18, 12, legc);
    p.line(17, 15, 19, 13, legc);
    if (s.mandible) p.grid(17, 13, ['#.#', '#..', '.##'], { '#': s.mandible });
    if (s.horn) p.grid(15, 9, ['..##', '.#..', '##..', '#...'], { '#': s.horn });
    if (s.glow) {
      p.ell(4, 18, 2, 2, s.glow);
      p.px(4, 18, C.white);
    }
  };

  // Three bead body.
  AR.ant = (p, s, f) => {
    const c = s.c;
    const legc = s.legc || C.ink;
    const j = f ? 1 : 0;
    p.line(6, 19, 4 + j, 22, legc);
    p.line(9, 19, 9 - j, 22, legc);
    p.line(11, 19, 13 - j, 22, legc);
    p.ell(5, 17, 4, 3, c);
    p.disc(10, 17, 2, c);
    p.disc(14, 15, 3, s.c2 || c);
    p.shade();
    p.px(15, 14, C.white);
    p.line(15, 12, 18, 10, legc);
    p.line(13, 12, 14, 9, legc);
    if (s.wings) p.ell(8, 11, 5, 2, s.wings);
  };

  // Flying things keep bobbing and flap on the second frame.
  AR.flyer = (p, s, f) => {
    const c = s.c;
    const by = 12;
    const w = s.wing || C.ice;
    if (s.kind === 'butterfly') {
      if (f) {
        p.ell(6, by - 3, 4, 5, w);
        p.ell(7, by + 4, 3, 3, s.c2 || w);
        pattern(p, Object.assign({}, s, { c2: s.c3 || C.ink }), 2, by - 8, 8, 9);
        p.disc(6, by - 3, 1, s.c3 || C.ink);
      } else {
        p.ell(6, by - 5, 5, 3, w);
        p.ell(5, by + 3, 4, 2, s.c2 || w);
        p.disc(5, by - 5, 1, s.c3 || C.ink);
      }
      p.shade(-0.15, 0.2);
      p.rect(9, by - 2, 7, 2, c);
      p.px(16, by - 3, C.ink);
      p.line(15, by - 3, 18, by - 7, C.ink);
      p.line(16, by - 3, 19, by - 6, C.ink);
    } else if (s.kind === 'bee') {
      p.ell(8, by - 6 + (f ? 2 : 0), 4, 3, w);
      p.ell(12, by - 6 + (f ? 2 : 0), 3, 2, w);
      p.ell(10, by, 6, 4, c);
      p.mask((q) => {
        for (let i = 6; i < 15; i += 3) q.rect(i, by - 5, 1, 10, s.c2 || C.ink);
      });
      p.shade(-0.15, 0.25);
      p.disc(16, by, 2, s.c2 || C.ink);
      p.px(17, by - 1, C.white);
      p.px(3, by + 1, C.ink);
      p.line(16, by - 2, 18, by - 5, C.ink);
    } else if (s.kind === 'dragonfly') {
      p.rect(1, by + 1, 13, 2, c);
      p.disc(15, by + 1, 2, s.c2 || c);
      if (f) {
        p.ell(5, by - 2, 5, 1, w);
        p.ell(10, by - 2, 5, 1, w);
        p.ell(5, by + 5, 5, 1, w);
        p.ell(10, by + 5, 5, 1, w);
      } else {
        p.line(9, by, 4, by - 7, w);
        p.line(10, by, 5, by - 7, w);
        p.line(11, by, 7, by - 8, w);
        p.line(12, by, 8, by - 8, w);
        p.line(9, by + 3, 5, by + 8, w);
        p.line(11, by + 3, 8, by + 8, w);
      }
      p.px(16, by, C.white);
    } else if (s.kind === 'bat') {
      const flap = f ? 2 : -1;
      p.grid(0, by - 2 + flap, ['######.', '.#####.', '.#.#.#.'], { '#': s.c2 || WW.tone(c, -0.2) });
      p.grid(13, by - 2 + flap, ['.######', '.#####.', '.#.#.#.'], { '#': s.c2 || WW.tone(c, -0.2) });
      p.disc(10, by, 4, c);
      p.shade();
      p.grid(6, by - 7, ['#.......#', '##.....##', '##.....##'], { '#': c });
      p.rect(8, by - 1, 2, 2, EYE);
      p.rect(12, by - 1, 2, 2, EYE);
      p.px(10, by + 2, C.white);
    } else if (s.kind === 'fly') {
      p.ell(8, by - 5 + (f ? 2 : 0), 4, 2, w);
      p.ell(10, by, 5, 3, c);
      p.shade();
      p.disc(15, by, 2, s.c2 || C.brick);
      p.px(16, by - 1, C.white);
    }
  };

  // Wavy segmented body.
  AR.worm = (p, s, f) => {
    const c = s.c;
    const seg = s.seg || 2;
    const n = s.segs || 7;
    for (let i = 0; i < n; i++) {
      const x = 2 + i * 2;
      const y = 19 + Math.round(Math.sin(i * 1.1 + (f ? 1.5 : 0)) * 1.4);
      p.disc(x, y, seg, i % 2 && s.c2 ? s.c2 : c);
      if (s.legs && i % 1 === 0) p.px(x, 22, C.ink);
    }
    const hx = 2 + n * 2 + 1;
    const hy = 17 + (f ? 1 : 0);
    p.disc(hx, hy, s.hr || 3, s.head || c);
    p.shade();
    p.rect(hx + 1, hy - 1, 1, 2, EYE);
    if (s.tongue) p.line(hx + 3, hy + 1, hx + 4, hy + 2, C.tomato);
    if (s.stalks) {
      p.line(hx, hy - 3, hx - 1, hy - 6, c);
      p.line(hx + 2, hy - 3, hx + 3, hy - 6, c);
      p.px(hx - 1, hy - 6, EYE);
      p.px(hx + 3, hy - 6, EYE);
    }
    if (s.ant) {
      p.line(hx, hy - 3, hx - 1, hy - 6, C.ink);
      p.line(hx + 2, hy - 3, hx + 3, hy - 6, C.ink);
    }
  };

  // Domes and shells with a head poking out.
  AR.shell = (p, s, f) => {
    const c = s.c;
    if (s.kind === 'snail') {
      p.rect(2, 20, 15, 3, s.body);
      p.rect(14, 15, 3, 6, s.body);
      p.px(14, 13, s.body);
      p.px(16, 13, s.body);
      p.line(14, 15, 14, 13, s.body);
      p.line(16, 15, 17, 13, s.body);
      p.shade(-0.2, 0.2);
      p.disc(8, 14, 6, c);
      p.grid(5, 11, ['.####.', '#....#', '#.##.#', '#.#..#', '#.###.', '.#....'], { '#': s.c2 });
      p.px(14, 12, EYE);
      p.px(17, 12, EYE);
    } else if (s.kind === 'crab') {
      p.disc(9, 15, 6, c);
      p.grid(6, 12, ['.####.', '#....#', '#.##.#', '#.#..#', '#.###.'], { '#': s.c2 });
      p.rect(14, 18, 4, 3, s.body);
      p.rect(3, 21, 3, 2, s.body);
      p.rect(9, 21, 3, 2, s.body);
      p.grid(15 + (f ? 1 : 0), 14, ['##.', '.##', '###'], { '#': s.body });
      p.px(16, 17, EYE);
    } else {
      const j = f ? 1 : 0;
      p.rect(4, 20, 3, 3 - j, s.body);
      p.rect(12, 20, 3, 2 + j, s.body);
      if (s.kind !== 'pill') p.disc(16, 17, 3, s.body);
      p.ell(9, 16, 7, 5, c);
      pattern(p, s, 2, 11, 15, 10);
      if (s.bands) p.mask((q) => { for (let i = 4; i < 16; i += 3) q.rect(i, 11, 1, 10, s.bands); });
      p.shade(-0.2, 0.25);
      if (s.kind !== 'pill') {
        p.px(17, 16, EYE);
        if (s.snoutlong) p.rect(18, 18, 2, 1, s.body);
      } else {
        p.px(15, 16, EYE);
      }
      if (s.ear) p.rect(14, 12, 2, 3, s.body);
    }
  };

  // Crabs and spiders from the front.
  AR.crab = (p, s, f) => {
    const c = s.c;
    const j = f ? 1 : 0;
    if (s.kind === 'spider') {
      for (let i = 0; i < 4; i++) {
        p.line(10, 16, 1 + i * 2 - j, 11 + i * 3, c);
        p.line(10, 16, 19 - i * 2 + j, 11 + i * 3, c);
      }
      p.disc(10, 15, 5, s.b || c);
      pattern(p, s, 5, 10, 11, 11);
      p.shade();
      p.disc(8, 14, 1, C.white);
      p.disc(12, 14, 1, C.white);
      p.px(8, 14, EYE);
      p.px(12, 14, EYE);
      return;
    }
    for (let i = 0; i < 3; i++) {
      p.line(5, 18 + i, 2 - j, 20 + i, c);
      p.line(15, 18 + i, 18 + j, 20 + i, c);
    }
    p.ell(10, 17, 6, 4, c);
    pattern(p, s, 4, 13, 13, 8);
    p.shade();
    p.grid(0, 8 + j, ['.##', '#.#', '.##', '..#', '..#'], { '#': c });
    p.grid(17, 8 + j, ['##.', '#.#', '##.', '#..', '#..'], { '#': c });
    p.line(3, 13 + j, 5, 16, c);
    p.line(17, 13 + j, 15, 16, c);
    p.rect(8, 11, 1, 3, c);
    p.rect(12, 11, 1, 3, c);
    p.px(8, 10, EYE);
    p.px(12, 10, EYE);
    p.rect(9, 18, 3, 1, C.ink);
    if (s.kind === 'lobster') {
      p.rect(8, 20, 5, 3, s.c2 || c);
    }
    if (s.kind === 'scorpion') {
      p.grid(6, 2, ['..###.', '.#...#', '#.....', '#.....', '#.....', '.#....', '..#...', '..#...'], { '#': c });
    }
  };

  // A glass bowl on tiny wheels, for anyone who needs water.
  AR.bowl = (p, s, f) => {
    const glass = C.ice;
    p.rect(6, 21, 8, 1, C.iron);
    p.rect(5, 21, 2, 2, C.ink);
    p.rect(13, 21, 2, 2, C.ink);
    p.disc(10, 13, 8, glass);
    p.mask((q) => q.rect(0, 9, 20, 16, s.water || '#a9dfee'));
    p.outline(C.iron);
    const sway = f ? 1 : 0;
    const c = s.c;
    if (s.kind === 'fish') {
      p.ell(10 + sway, 14, 4, 3, c);
      p.grid(3 + sway, 11, ['#..', '##.', '###', '##.', '#..'], { '#': s.c2 || c });
      p.px(12 + sway, 13, EYE);
      if (s.mark === 'bands') {
        p.rect(9 + sway, 11, 1, 6, C.white);
        p.rect(12 + sway, 11, 1, 6, C.white);
        p.px(13 + sway, 13, EYE);
      }
    } else if (s.kind === 'whale') {
      p.ell(10 + sway, 14, 5, 3, c);
      p.grid(3 + sway, 11, ['#.#', '.#.', '.#.', '##.'], { '#': c });
      p.rect(9 + sway, 16, 6, 1, s.b || C.ice);
      p.px(13 + sway, 13, EYE);
      p.rect(11, 6, 1, 2, C.sky);
      p.px(10, 4 - sway, C.sky);
      p.px(12, 4 - sway, C.sky);
    } else if (s.kind === 'narwhal') {
      p.ell(9 + sway, 15, 5, 3, c);
      p.line(13 + sway, 13, 17 + sway, 8, C.cream);
      p.px(12 + sway, 14, EYE);
    } else if (s.kind === 'jelly') {
      p.ell(10, 11 + sway, 5, 3, c);
      p.rect(5, 12 + sway, 11, 2, c);
      for (let i = 6; i < 15; i += 2) p.rect(i, 14 + sway, 1, 4 - (i % 4 ? 1 : 0), s.c2 || c);
      p.px(8, 11 + sway, EYE);
      p.px(12, 11 + sway, EYE);
    } else if (s.kind === 'octopus') {
      p.disc(10, 11 + sway, 4, c);
      for (let i = 6; i < 15; i += 2) p.line(i, 14 + sway, i + (i % 4 ? 1 : -1), 18, c);
      p.px(8, 11 + sway, EYE);
      p.px(12, 11 + sway, EYE);
    } else if (s.kind === 'seahorse') {
      p.grid(7, 7 + sway, ['..###.', '.#####', '.###..', '..##..', '.###..', '.###..', '..##..', '...#..', '..##..', '..#...'], { '#': c });
      p.px(11, 8 + sway, EYE);
    } else if (s.kind === 'puffer') {
      p.disc(10, 13 + sway, 4, c);
      for (const [x, y] of [[5, 13], [15, 13], [10, 8], [10, 18], [6, 9], [14, 9], [6, 17], [14, 17]]) p.px(x, y + sway, s.c2 || C.ink);
      p.ell(11, 15 + sway, 2, 1, C.cream);
      p.px(12, 12 + sway, EYE);
    } else if (s.kind === 'star') {
      p.grid(6, 9 + sway, ['....#....', '...###...', '#########', '.#######.', '..#####..', '.###.###.', '.##...##.'], { '#': c });
      p.px(9, 12 + sway, EYE);
      p.px(11, 12 + sway, EYE);
    } else if (s.kind === 'shrimp') {
      p.grid(6, 10 + sway, ['..####..', '.######.', '.#...###', '.....###', '....###.', '...###..', '..#.#.#.'], { '#': c });
      p.px(12, 11 + sway, EYE);
    }
    // glass shine and rim
    p.px(5, 8, C.white);
    p.px(4, 10, C.white);
    p.px(5, 9, C.white);
    p.rect(6, 5, 8, 1, C.steel);
  };

  // Big head on a little dinosaur.
  AR.rex = (p, s, f) => {
    const c = s.c;
    p.rect(1, 15, 6, 3, c);
    p.px(0, 14, c);
    p.rect(7, 19, 3, 4 - (f ? 1 : 0), WW.tone(c, -0.15));
    p.rect(11, 19, 3, f ? 4 : 3, WW.tone(c, -0.15));
    p.ell(9, 15, 5, 5, c);
    p.rrect(9, 3, 10, 9, c);
    p.rect(9, 11, 5, 3, c);
    if (s.b) p.ell(11, 17, 3, 3, s.b);
    pattern(p, s, 4, 10, 10, 9);
    p.shade();
    p.rect(13, 15, 2, 1, WW.tone(c, -0.2));
    p.rect(11, 8, 8, 1, C.ink);
    p.px(13, 9, C.white);
    p.px(16, 9, C.white);
    p.rect(13, 5, 2, 2, EYE);
    p.px(18, 5, C.ink);
  };

  function paint(spec, frame) {
    const p = new Px(W, H);
    (AR[spec.a] || AR.ball)(p, spec, frame);
    return p.outline();
  }

  const cache = new Map();
  // Returns [right frame 0, right frame 1, left frame 0, left frame 1] as canvases.
  WW.animalFrames = function (spec) {
    const key = spec.id;
    if (cache.has(key)) return cache.get(key);
    const a = paint(spec, 0);
    const b = paint(spec, 1);
    const frames = [a.canvas(), b.canvas(), a.flip().canvas(), b.flip().canvas()];
    cache.set(key, frames);
    return frames;
  };
  WW.ANIMAL_CELL = { w: W, h: H };
})((globalThis.WW = globalThis.WW || {}));
