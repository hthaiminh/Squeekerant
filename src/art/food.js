// Ingredient and dish icons, 16 x 16.
(function (WW) {
  const { Px, C } = WW;
  const T = WW.tone;

  const leafy = (p, c, d) => {
    p.ell(8, 8, 5, 6, c);
    p.line(8, 3, 8, 13, d);
    p.line(8, 6, 5, 4, d);
    p.line(8, 6, 11, 4, d);
    p.line(8, 9, 5, 7, d);
    p.line(8, 9, 11, 7, d);
  };
  const berry = (p, x, y, r, c) => {
    p.disc(x, y, r, c);
    p.px(x - 1, y - 1, T(c, 0.5));
  };
  const stem = (p, x, y, c = C.bark) => {
    p.rect(x, y, 1, 3, c);
    p.ell(x + 2, y, 2, 1, C.leaf);
  };

  const ING = {
    romaine: (p) => leafy(p, '#8fd06a', '#4f9f5a'),
    cucumber: (p) => {
      p.disc(8, 8, 6, '#3f8f4a');
      p.disc(8, 8, 5, '#d5e8a8');
      for (const [x, y] of [[6, 6], [10, 6], [6, 10], [10, 10], [8, 8]]) p.px(x, y, '#8fbf6a');
    },
    parsley: (p) => {
      p.rect(7, 9, 2, 6, '#3f7f5a');
      for (const [x, y] of [[5, 5], [10, 5], [8, 3], [4, 8], [11, 8], [8, 7]]) p.disc(x, y, 2, '#4f9f5a');
    },
    basil: (p) => {
      p.ell(5, 8, 4, 3, '#3f8f4a');
      p.ell(11, 8, 4, 3, '#4f9f5a');
      p.ell(8, 4, 3, 3, '#5fb36a');
      p.rect(7, 10, 2, 5, '#3f7f5a');
    },
    dandelion: (p) => {
      p.rect(7, 8, 2, 7, '#5f9f4a');
      p.ell(4, 12, 3, 1, '#7cb35a');
      p.ell(11, 11, 3, 1, '#7cb35a');
      p.disc(8, 5, 4, '#ffdd4a');
      p.disc(8, 5, 2, '#f2b02e');
    },
    carrot: (p) => {
      p.grid(3, 1, ['...#.#....', '....#.#...', '.....##...'], { '#': '#4f9f5a' });
      p.grid(4, 4, ['.#####.', '#######', '.#####.', '.#####.', '..###..', '..###..', '...#...', '...#...'], { '#': '#f28a2e' });
      p.px(6, 6, '#c9662e');
      p.px(8, 8, '#c9662e');
    },
    peas: (p) => {
      p.ell(8, 8, 7, 4, '#6fae3a');
      p.rect(3, 7, 10, 2, '#a8d86a');
      berry(p, 4, 8, 2, '#8fd06a');
      berry(p, 8, 8, 2, '#8fd06a');
      berry(p, 12, 8, 2, '#8fd06a');
    },
    oats: (p) => {
      for (const [x, y] of [[4, 5], [9, 3], [12, 8], [6, 10], [10, 12], [3, 12]]) p.ell(x, y, 2, 1, '#f0d6a3');
      for (const [x, y] of [[7, 7], [11, 5], [8, 13]]) p.ell(x, y, 2, 1, '#d9b870');
    },
    broccoli: (p) => {
      p.rect(6, 9, 4, 6, '#a8d86a');
      for (const [x, y] of [[4, 6], [8, 4], [12, 6], [6, 8], [10, 8]]) p.disc(x, y, 3, '#3f9f5a');
      p.px(5, 4, '#6fc37a');
      p.px(9, 2, '#6fc37a');
    },
    zucchini: (p) => {
      p.ell(8, 8, 7, 3, '#4f8f3a');
      p.line(2, 7, 13, 7, '#7fb35a');
      p.rect(0, 7, 2, 2, '#c9d86a');
    },
    sweetpotato: (p) => {
      p.ell(8, 8, 7, 4, '#c9562a');
      p.px(4, 6, '#8a3a1e');
      p.px(9, 7, '#8a3a1e');
      p.px(12, 9, '#8a3a1e');
    },
    parsnip: (p) => {
      p.grid(5, 1, ['..#.#.', '...##.'], { '#': '#6fae5a' });
      p.grid(4, 3, ['.#####.', '#######', '.#####.', '.#####.', '..###..', '..###..', '..##...', '..#....', '..#....'], { '#': '#efe1b0' });
      p.px(6, 6, '#c9b880');
    },
    beans: (p) => {
      p.line(3, 3, 12, 12, '#6fae3a');
      p.line(4, 3, 13, 12, '#8fd06a');
      p.line(8, 2, 13, 7, '#6fae3a');
      p.line(9, 2, 14, 7, '#8fd06a');
      p.line(2, 8, 7, 13, '#6fae3a');
      p.line(3, 8, 8, 13, '#8fd06a');
    },
    pepper: (p) => {
      p.rect(7, 1, 2, 3, '#4f8f3a');
      p.ell(5, 9, 3, 5, '#e4372e');
      p.ell(11, 9, 3, 5, '#e4372e');
      p.ell(8, 9, 2, 5, '#c92a22');
      p.px(4, 6, '#ff9a8a');
    },
    millet: (p) => {
      p.line(11, 15, 7, 2, '#c9a23f');
      for (let i = 0; i < 8; i++) {
        p.disc(7 + i * 0.5 - 1, 3 + i, 1, '#e8c04a');
        p.disc(9 + i * 0.5, 3 + i, 1, '#f2d05a');
      }
    },
    cauliflower: (p) => {
      p.ell(8, 12, 6, 3, '#6fb36b');
      for (const [x, y] of [[4, 8], [8, 6], [12, 8], [6, 10], [10, 10]]) p.disc(x, y, 3, '#fff8e0');
      p.px(8, 8, '#e6d8b0');
      p.px(5, 10, '#e6d8b0');
    },
    apple: (p) => {
      p.disc(8, 9, 6, '#e4372e');
      p.rect(7, 3, 2, 2, '#c92a22');
      stem(p, 8, 1);
      p.px(5, 7, '#ff9a8a');
      p.px(5, 8, '#ff9a8a');
    },
    pear: (p) => {
      p.disc(8, 11, 5, '#c9d04a');
      p.disc(8, 6, 3, '#c9d04a');
      stem(p, 8, 1);
      p.px(6, 9, '#e8ec8a');
    },
    strawberry: (p) => {
      p.grid(3, 4, ['.########.', '##########', '##########', '.########.', '.########.', '..######..', '...####...', '....##....'], { '#': '#e8304a' });
      p.ell(8, 3, 4, 1, '#4f9f5a');
      for (const [x, y] of [[5, 6], [9, 6], [7, 8], [11, 8], [8, 10]]) p.px(x, y, '#ffe27a');
    },
    blueberry: (p) => {
      berry(p, 5, 6, 3, '#4a5fc0');
      berry(p, 11, 7, 3, '#3f50a8');
      berry(p, 8, 11, 3, '#5a70d0');
    },
    blackberry: (p) => {
      for (const [x, y] of [[6, 5], [10, 5], [4, 8], [8, 8], [12, 8], [6, 11], [10, 11], [8, 13]]) berry(p, x, y, 2, '#4a2f6a');
      p.ell(8, 2, 3, 1, '#4f9f5a');
    },
    peach: (p) => {
      p.disc(8, 9, 6, '#f7a06a');
      p.ell(10, 10, 3, 3, '#f0705a');
      p.line(8, 3, 8, 8, '#d9604a');
      p.ell(11, 3, 3, 1, '#4f9f5a');
    },
    mango: (p) => {
      p.ell(8, 8, 5, 7, '#f2b02e');
      p.ell(10, 5, 3, 3, '#f0705a');
      p.rect(9, 0, 1, 2, C.bark);
    },
    banana: (p) => {
      p.grid(2, 2, ['............#.', '...........##.', '...........##.', '..........###.', '.........####.', '#.......#####.', '##....######..', '.##########...', '..########....', '....####......'], { '#': '#ffdd4a' });
      p.px(14, 2, C.bark);
      p.px(2, 7, C.bark);
    },
    watermelon: (p) => {
      p.grid(1, 4, ['##############', '.############.', '..##########..', '....######....'], { '#': '#f0505a' });
      p.rect(2, 8, 12, 1, '#fff1d6');
      p.grid(1, 8, ['#............#', '.##........##.', '...########...'], { '#': '#3f8f4a' });
      for (const x of [4, 7, 10]) p.px(x, 5, C.ink);
    },
    sunflower: (p) => {
      for (const [x, y] of [[4, 5], [10, 4], [7, 9], [12, 10], [3, 11]]) {
        p.ell(x, y, 1, 2, '#3d3440');
        p.px(x, y, '#d9d2c0');
      }
    },
    pumpkinseed: (p) => {
      for (const [x, y] of [[5, 5], [11, 5], [8, 10], [3, 11]]) {
        p.ell(x, y, 2, 3, '#8fa85a');
        p.px(x, y - 1, '#bfd08a');
      }
    },
    tofu: (p) => {
      p.rect(3, 6, 10, 8, '#fff8e0');
      p.rect(3, 4, 10, 2, '#fffdf2');
      p.rect(3, 12, 10, 2, '#e8dcb0');
    },
    mealworm: (p) => {
      for (let i = 0; i < 6; i++) p.disc(3 + i * 2, 7 + Math.round(Math.sin(i) * 2), 1, i % 2 ? '#c9a050' : '#d9b870');
      for (let i = 0; i < 5; i++) p.disc(4 + i * 2, 12 + Math.round(Math.cos(i)), 1, i % 2 ? '#c9a050' : '#d9b870');
    },
    egg: (p) => {
      p.ell(8, 9, 5, 6, '#fff4d0');
      p.disc(8, 10, 3, '#ffc83d');
      p.px(7, 9, '#ffe27a');
    },
    chicken: (p) => {
      p.ell(8, 8, 6, 5, '#e8c8a0');
      p.line(4, 6, 12, 6, '#d9b080');
      p.line(4, 9, 12, 9, '#d9b080');
    },
  };

  const ingCache = {};
  WW.ingredientIcon = function (id) {
    if (ingCache[id]) return ingCache[id];
    const p = new Px(16, 16);
    (ING[id] || ING.oats)(p);
    ingCache[id] = p.outline().canvas();
    return ingCache[id];
  };

  // Dishes are arranged from the colours of what went into them.
  const SHAPES = {
    plate(p, a, b) {
      p.ell(8, 11, 7, 3, C.paper);
      p.ell(8, 11, 5, 2, '#e8dcc0');
      p.ell(8, 9, 4, 3, a);
      p.px(6, 8, T(a, 0.4));
      p.px(10, 10, b);
      p.px(8, 7, b);
      p.px(5, 10, b);
    },
    bowl(p, a, b) {
      p.grid(1, 7, ['##############', '##############', '.############.', '.############.', '..##########..', '...########...'], { '#': '#c9dce0' });
      p.ell(8, 7, 6, 2, a);
      p.px(6, 6, T(a, 0.4));
      p.px(9, 7, b);
      p.px(5, 8, b);
      p.px(11, 6, b);
      p.px(3, 9, C.white);
      p.px(3, 10, C.white);
    },
    pot(p, a, b) {
      p.rect(3, 6, 10, 8, '#5e6a78');
      p.rect(1, 8, 2, 2, '#5e6a78');
      p.rect(13, 8, 2, 2, '#5e6a78');
      p.rect(2, 4, 12, 3, '#7c8a96');
      p.ell(8, 5, 5, 1, a);
      p.px(6, 5, b);
      p.px(10, 5, b);
      p.px(4, 8, '#9aa7b0');
      p.px(4, 9, '#9aa7b0');
    },
    coins(p, a, b) {
      p.ell(4, 11, 3, 2, a);
      p.ell(12, 11, 3, 2, a);
      p.ell(8, 8, 3, 2, T(a, 0.15));
      p.ell(8, 11, 3, 2, T(a, -0.1));
      p.px(8, 7, b);
      p.px(4, 10, b);
      p.px(12, 10, b);
    },
    tart(p, a, b) {
      p.ell(8, 10, 7, 4, C.honey);
      p.ell(8, 9, 6, 3, a);
      for (const [x, y] of [[5, 8], [9, 7], [11, 10], [7, 10]]) p.px(x, y, b);
      p.line(2, 11, 14, 11, T(C.honey, -0.2));
    },
    wrap(p, a, b) {
      p.ell(5, 9, 3, 4, a);
      p.ell(11, 9, 3, 4, T(a, -0.1));
      p.disc(5, 9, 1, b);
      p.disc(11, 9, 1, b);
    },
    cubes(p, a, b) {
      p.rect(2, 8, 5, 5, a);
      p.rect(9, 8, 5, 5, T(a, -0.1));
      p.rect(5, 3, 6, 5, T(a, 0.15));
      p.px(3, 9, b);
      p.px(11, 10, b);
      p.px(7, 5, b);
    },
  };

  const dishCache = {};
  // def needs shape and ing; gold adds a shine for golden dream dishes.
  WW.dishIcon = function (def, gold) {
    const key = def.id + (gold ? ':g' : '');
    if (dishCache[key]) return dishCache[key];
    const ids = Object.keys(def.ing);
    const a = WW.INGREDIENT[ids[0]].col;
    const b = ids[1] ? WW.INGREDIENT[ids[1]].col : T(a, -0.3);
    const p = new Px(16, 16);
    (SHAPES[def.shape] || SHAPES.plate)(p, a, b);
    p.outline();
    if (gold) {
      p.px(2, 2, C.butter);
      p.px(13, 1, C.butter);
      p.px(14, 3, C.white);
    }
    dishCache[key] = p.canvas();
    return dishCache[key];
  };
})((globalThis.WW = globalThis.WW || {}));
