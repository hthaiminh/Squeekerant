// Furniture, appliances and toys, all tiny. Each piece: id, name, tiles wide and deep, price, level, kind,
// what it attracts (tag), what it does (fx), and how it is painted. Rating points follow the price.
(function (WW) {
  const { Px, C } = WW;
  const T = WW.tone;
  const list = [];
  const d = (id, n, w, h, price, lvl, kind, draw, extra) => list.push(Object.assign({ id, n, w, h, price, lvl, kind, draw, tag: null, rating: Math.round(10 + Math.sqrt(price)) }, extra || {}));

  // Words for what a piece does, kept beside the numbers the engine reads.
  WW.fxText = (fx) => {
    if (!fx) return null;
    const pct = (v) => Math.round(v * 100) + '%';
    const parts = [];
    if (fx.clean) parts.push(`Floor stays tidier: +${fx.clean} tidiness per busy round`);
    if (fx.turns) parts.push(`Tables turn over ${pct(fx.turns)} faster`);
    if (fx.fl) for (const k in fx.fl) parts.push(`${WW.FLAVOURS[k].n} dishes earn ${pct(fx.fl[k])} more`);
    if (fx.stoveFast) parts.push(`Stove dishes cook ${pct(fx.stoveFast)} faster`);
    if (fx.stoveY) parts.push(`Stove batches make ${pct(fx.stoveY)} more`);
    if (fx.wokY) parts.push(`Wok batches make ${pct(fx.wokY)} more`);
    if (fx.potY) parts.push(`Pot batches make ${pct(fx.potY)} more`);
    if (fx.waiter) parts.push(`Waiters tire ${pct(fx.waiter)} slower`);
    if (fx.sous) parts.push(`Sous chefs tire ${pct(fx.sous)} slower`);
    if (fx.lunch) parts.push(`Lunchboxes give +${fx.lunch} energy`);
    if (fx.passive) parts.push(`Earns ${fx.passive} cash per busy round`);
    if (fx.tips) parts.push(`Tips +${pct(fx.tips)}`);
    if (fx.rare) parts.push(`Rare guests ${pct(fx.rare)} more likely`);
    if (fx.winks) parts.push(`+1 Wink every ${fx.winks} quiet rounds`);
    if (fx.market) parts.push(`Market ${pct(fx.market)} cheaper`);
    return parts.join('. ') + '.';
  };

  const spool = (thread) => (p) => {
    p.ell(8, 21, 7, 3, C.honey);
    p.rect(4, 12, 8, 9, thread);
    for (let y = 13; y < 21; y += 2) p.rect(4, y, 8, 1, T(thread, -0.15));
    p.px(5, 14, T(thread, 0.4));
    p.ell(8, 11, 7, 3, C.honey);
    p.ell(8, 11, 5, 2, T(C.honey, 0.25));
    p.disc(8, 11, 1, C.bark);
  };

  // Tables
  d('spool_red', 'Red Spool Table', 1, 1, 90, 1, 'table', spool('#d9503a'), { note: 'A cotton reel from the sewing box.' });
  d('spool_blue', 'Blue Spool Table', 1, 1, 90, 1, 'table', spool('#3f7fb0'));
  d('spool_green', 'Green Spool Table', 1, 1, 120, 2, 'table', spool('#4f9f6a'));
  d('cap_table', 'Bottle Cap Table', 1, 1, 160, 2, 'table', (p) => {
    p.rect(7, 15, 2, 7, C.iron);
    p.ell(8, 22, 4, 1, C.iron);
    p.ell(8, 12, 7, 4, C.tomato);
    p.ell(8, 11, 5, 2, '#f7e8c8');
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      p.px(8 + Math.cos(a) * 8, 12 + Math.sin(a) * 4, C.brick);
    }
  });
  d('jar_lid', 'Jam Lid Table', 1, 1, 200, 3, 'table', (p) => {
    p.rect(7, 16, 2, 6, C.bark);
    p.ell(8, 22, 4, 1, C.cocoa);
    p.ell(8, 12, 7, 4, C.gold);
    p.ell(8, 11, 6, 3, C.butter);
    p.ell(8, 11, 3, 1, C.paper);
  });
  d('block_table', 'Toy Block Table', 1, 1, 260, 3, 'table', (p) => {
    p.rect(2, 10, 12, 12, C.sky);
    p.rect(2, 10, 12, 4, T(C.sky, 0.35));
    p.rect(5, 16, 6, 4, C.tomato);
    p.rect(7, 17, 2, 2, C.paper);
  });
  d('matchbox', 'Matchbox Table', 2, 1, 380, 3, 'table', (p) => {
    p.rect(3, 14, 26, 8, '#d9b870');
    p.rect(3, 10, 26, 5, '#fff1d6');
    p.rect(3, 10, 26, 1, C.tomato);
    p.rect(10, 11, 12, 3, C.tomato);
    p.rect(13, 12, 6, 1, C.butter);
    p.rect(3, 20, 26, 2, '#6d4535');
    p.rect(5, 22, 2, 2, C.cocoa);
    p.rect(25, 22, 2, 2, C.cocoa);
  });
  d('domino', 'Domino Table', 2, 1, 560, 4, 'table', (p) => {
    p.rect(1, 11, 30, 11, C.paper);
    p.rect(1, 18, 30, 4, '#d9cfc0');
    p.rect(15, 11, 2, 7, C.ink);
    for (const [x, y] of [[5, 13], [9, 15], [20, 13], [26, 13], [20, 16], [26, 16]]) p.rect(x, y, 2, 1, C.ink);
    p.rect(4, 22, 2, 2, C.cocoa);
    p.rect(26, 22, 2, 2, C.cocoa);
  });
  d('card_table', 'Playing Card Table', 2, 1, 700, 5, 'table', (p) => {
    p.rect(2, 10, 28, 10, C.paper);
    p.rect(2, 19, 28, 2, C.oat);
    p.rect(3, 11, 2, 2, C.tomato);
    p.rect(27, 16, 2, 2, C.tomato);
    p.disc(16, 15, 3, C.tomato);
    p.rect(4, 21, 2, 3, C.bark);
    p.rect(26, 21, 2, 3, C.bark);
  });
  d('brick_table', 'Toy Brick Table', 2, 1, 900, 6, 'table', (p) => {
    p.rect(2, 11, 28, 11, C.leaf);
    p.rect(2, 11, 28, 3, T(C.leaf, 0.3));
    for (let x = 4; x < 28; x += 6) p.ell(x + 1, 11, 2, 1, T(C.leaf, 0.45));
    p.rect(2, 20, 28, 2, T(C.leaf, -0.25));
  });
  d('tin_table', 'Cookie Tin Table', 2, 2, 1600, 7, 'table', (p) => {
    p.rect(3, 22, 26, 14, '#2f6f9a');
    for (let x = 4; x < 28; x += 4) p.rect(x, 24, 2, 10, '#ffc857');
    p.ell(16, 21, 14, 8, '#3f8fc0');
    p.ell(16, 20, 11, 6, '#6fb0d8');
    p.ell(16, 20, 5, 3, '#fff1d6');
  });
  d('tea_chest', 'Tea Chest Table', 2, 2, 2800, 9, 'table', (p) => {
    p.rect(2, 14, 28, 22, '#8a3a2e');
    p.rect(2, 14, 28, 8, '#b5533e');
    p.rect(2, 14, 28, 1, C.gold);
    p.rect(2, 22, 28, 1, C.gold);
    p.rect(14, 26, 4, 5, C.gold);
    p.ell(16, 18, 5, 2, C.gold);
  });
  d('tile_table', 'Painted Tile Table', 2, 2, 4200, 11, 'table', (p) => {
    p.rect(2, 12, 28, 18, C.paper);
    for (let y = 12; y < 30; y += 6) for (let x = 2; x < 30; x += 7) {
      p.disc(x + 3, y + 3, 2, C.teal);
      p.px(x + 3, y + 3, C.butter);
    }
    p.rect(2, 30, 28, 2, C.iron);
    p.rect(4, 32, 2, 4, C.iron);
    p.rect(26, 32, 2, 4, C.iron);
  });

  // Seats
  d('cork', 'Cork Stool', 1, 1, 30, 1, 'seat', (p) => {
    p.rect(3, 16, 10, 6, '#c9a06a');
    p.ell(8, 22, 5, 1, '#a07a4a');
    p.ell(8, 15, 5, 2, '#e0be88');
    p.ell(8, 15, 3, 1, '#d0ac76');
    for (const [x, y] of [[5, 18], [9, 20], [7, 19], [11, 18]]) p.px(x, y, '#8a6a3a');
  });
  d('button_stool', 'Button Stool', 1, 1, 50, 1, 'seat', (p) => {
    p.rect(7, 17, 2, 5, C.iron);
    p.ell(8, 15, 6, 3, C.rose);
    p.ell(8, 14, 4, 2, T(C.rose, 0.3));
    for (const [x, y] of [[7, 14], [9, 14], [7, 15], [9, 15]]) p.px(x, y, C.plum);
  });
  d('eraser', 'Eraser Stool', 1, 1, 60, 2, 'seat', (p) => {
    p.rect(3, 14, 10, 8, C.paper);
    p.rect(3, 14, 10, 4, C.sky);
    p.rect(3, 14, 10, 1, T(C.sky, 0.4));
  });
  d('thimble_stool', 'Thimble Stool', 1, 1, 80, 2, 'seat', (p) => {
    p.grid(3, 12, ['..######..', '.########.', '.########.', '##########', '##########', '##########', '##########', '##########', '##########', '##########'], { '#': C.steel });
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) p.px(5 + i * 2 + (j % 2), 14 + j * 2, C.iron);
    p.rect(3, 21, 10, 1, C.iron);
  });
  d('acorn_stool', 'Acorn Stool', 1, 1, 100, 3, 'seat', (p) => {
    p.ell(8, 18, 5, 4, C.wood);
    p.ell(8, 14, 6, 3, C.cocoa);
    p.rect(8, 10, 1, 2, C.cocoa);
    p.px(5, 14, C.bark);
    p.px(10, 15, C.bark);
    p.px(6, 18, C.honey);
  });
  d('clothespin', 'Clothespin Chair', 1, 1, 140, 3, 'seat', (p) => {
    p.rect(4, 8, 2, 14, C.wood);
    p.rect(10, 8, 2, 14, C.wood);
    p.rect(4, 12, 8, 2, C.iron);
    p.rect(3, 16, 10, 3, C.honey);
    p.rect(3, 19, 10, 1, C.bark);
    p.rect(4, 8, 8, 1, C.bark);
  });
  d('pin_cushion', 'Pin Cushion Seat', 1, 1, 180, 4, 'seat', (p) => {
    p.ell(8, 18, 6, 4, C.tomato);
    p.ell(8, 16, 4, 2, T(C.tomato, 0.3));
    for (const [x, y, c] of [[5, 13, C.butter], [9, 12, C.sky], [11, 14, C.leaf]]) {
      p.px(x, y, c);
      p.px(x, y + 1, C.steel);
      p.px(x, y + 2, C.steel);
    }
  });
  d('sock_pouf', 'Sock Beanbag', 1, 1, 240, 4, 'seat', (p) => {
    p.ell(8, 17, 7, 5, C.lilac);
    p.mask((q) => {
      for (let y = 12; y < 23; y += 3) q.rect(0, y, 16, 1, C.paper);
    });
    p.ell(8, 14, 3, 1, T(C.lilac, -0.2));
  });
  d('sponge', 'Sponge Sofa', 2, 1, 320, 3, 'seat', (p) => {
    p.rect(2, 12, 28, 10, '#ffd75e');
    p.rect(2, 8, 28, 5, '#6fbf6a');
    for (const [x, y] of [[5, 15], [11, 18], [17, 14], [23, 17], [27, 14], [8, 19], [20, 19]]) p.rect(x, y, 2, 1, '#e8b82f');
    for (const [x, y] of [[6, 10], [14, 9], [22, 11]]) p.rect(x, y, 2, 1, '#4f9f5a');
  }, { seats: 2 });
  d('ruler_bench', 'Ruler Bench', 2, 1, 420, 5, 'seat', (p) => {
    p.rect(1, 14, 30, 5, C.butter);
    p.rect(1, 14, 30, 1, T(C.butter, 0.4));
    for (let x = 2; x < 30; x += 2) p.rect(x, 15, 1, x % 4 ? 1 : 2, C.ink);
    p.rect(4, 19, 3, 4, C.bark);
    p.rect(25, 19, 3, 4, C.bark);
  }, { seats: 2 });
  d('match_bench', 'Matchstick Bench', 2, 1, 560, 6, 'seat', (p) => {
    for (let y = 13; y < 20; y += 2) {
      p.rect(2, y, 28, 1, C.honey);
      p.disc(30, y, 1, C.tomato);
    }
    p.rect(4, 20, 2, 3, C.bark);
    p.rect(25, 20, 2, 3, C.bark);
  }, { seats: 2 });
  d('ring_box', 'Ring Box Throne', 1, 1, 900, 8, 'seat', (p) => {
    p.rect(2, 8, 12, 8, '#5a2a6a');
    p.rect(3, 9, 10, 6, '#f3dfb8');
    p.rect(2, 16, 12, 7, '#7a3a8a');
    p.ell(8, 16, 5, 1, C.paper);
  });

  // Rugs: walkable
  d('stamp_rug', 'Postage Stamp Rug', 1, 1, 50, 1, 'rug', (p) => {
    p.rect(1, 9, 14, 14, C.paper);
    for (let i = 1; i < 15; i += 2) {
      p.px(i, 9, 0);
      p.px(i, 22, 0);
    }
    for (let j = 9; j < 23; j += 2) {
      p.px(1, j, 0);
      p.px(14, j, 0);
    }
    p.rect(3, 11, 10, 10, C.sky);
    p.disc(8, 16, 3, C.tomato);
  });
  d('teabag', 'Tea Bag Mat', 1, 1, 70, 1, 'rug', (p) => {
    p.rect(1, 10, 14, 12, '#c9a880');
    p.rect(3, 12, 10, 8, '#a8805a');
    p.line(8, 10, 8, 7, C.paper);
    p.rect(6, 5, 4, 3, C.tomato);
  });
  d('coaster', 'Felt Coaster', 1, 1, 90, 2, 'rug', (p) => {
    p.ell(8, 16, 7, 6, C.teal);
    p.ell(8, 16, 5, 4, T(C.teal, 0.25));
    p.ell(8, 16, 2, 1, C.butter);
  });
  d('leaf_rug', 'Big Leaf Mat', 1, 1, 120, 2, 'rug', (p) => {
    p.ell(8, 16, 7, 5, C.leaf);
    p.line(2, 16, 14, 16, C.moss);
    p.line(5, 16, 7, 13, C.moss);
    p.line(5, 16, 7, 19, C.moss);
    p.line(9, 16, 11, 13, C.moss);
    p.line(9, 16, 11, 19, C.moss);
  });
  d('gingham', 'Gingham Cloth', 2, 1, 140, 2, 'rug', (p) => {
    p.rect(1, 9, 30, 14, C.paper);
    for (let y = 9; y < 23; y += 4) for (let x = 1; x < 31; x += 4) if ((x + y) % 8 < 4) p.rect(x, y, 4, 4, '#e88a7a');
  });
  d('doily', 'Lace Doily', 2, 2, 180, 2, 'rug', (p) => {
    p.ell(16, 24, 15, 11, C.paper);
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      p.px(16 + Math.cos(a) * 13, 24 + Math.sin(a) * 9, C.oat);
      p.px(16 + Math.cos(a) * 9, 24 + Math.sin(a) * 6, C.oat);
    }
    p.ell(16, 24, 3, 2, C.oat);
  });
  d('bandana', 'Red Bandana Rug', 2, 2, 240, 3, 'rug', (p) => {
    p.rect(2, 11, 28, 24, C.tomato);
    p.rect(4, 13, 24, 20, C.brick);
    for (let y = 15; y < 33; y += 4) for (let x = 6; x < 28; x += 4) p.px(x + (y % 8 ? 2 : 0), y, C.paper);
  });
  d('bubble_mat', 'Bubble Wrap Mat', 2, 1, 260, 3, 'rug', (p) => {
    p.rect(1, 10, 30, 12, C.ice);
    for (let y = 12; y < 21; y += 4) for (let x = 3; x < 30; x += 4) {
      p.disc(x, y, 1, C.white);
    }
  });
  d('card_rug', 'Queen of Hearts Rug', 2, 1, 300, 4, 'rug', (p) => {
    p.rect(1, 9, 30, 14, C.paper);
    p.rect(3, 11, 26, 10, C.tomato);
    p.disc(13, 15, 2, C.paper);
    p.disc(18, 15, 2, C.paper);
    p.rect(13, 16, 6, 2, C.paper);
    p.rect(15, 18, 2, 1, C.paper);
  });
  d('silk_scarf', 'Silk Scarf Rug', 3, 2, 1200, 6, 'rug', (p) => {
    p.rect(1, 10, 46, 25, '#2f5f9a');
    p.rect(3, 12, 42, 21, C.butter);
    p.rect(5, 14, 38, 17, '#2f5f9a');
    p.ell(24, 22, 10, 6, C.tomato);
    p.ell(24, 22, 6, 3, C.butter);
    for (const [x, y] of [[9, 17], [39, 17], [9, 28], [39, 28]]) p.disc(x, y, 2, C.tomato);
  });

  // Plants
  d('thimble_cactus', 'Thimble Cactus', 1, 1, 100, 1, 'plant', (p) => {
    p.rect(6, 7, 4, 10, C.leaf);
    p.rect(3, 10, 3, 2, C.leaf);
    p.rect(3, 8, 2, 3, C.leaf);
    p.rect(10, 11, 3, 2, C.leaf);
    p.rect(11, 9, 2, 3, C.leaf);
    p.px(7, 9, C.mint);
    p.px(8, 13, C.mint);
    p.rect(4, 17, 8, 5, C.steel);
    p.rect(4, 21, 8, 1, C.iron);
  });
  d('teacup_fern', 'Teacup Fern', 1, 1, 130, 1, 'plant', (p) => {
    p.line(8, 14, 3, 5, C.leaf);
    p.line(8, 14, 13, 5, C.leaf);
    p.line(8, 14, 8, 3, C.moss);
    p.line(8, 14, 5, 7, C.moss);
    p.line(8, 14, 11, 7, C.moss);
    p.grid(3, 14, ['##########', '##########.##', '##########..#', '.########.##', '..######...'], { '#': C.paper });
    p.rect(4, 15, 8, 1, C.sky);
  });
  d('carrot_pot', 'Carrot Top Pot', 1, 1, 240, 2, 'plant', (p) => {
    for (const [x, y] of [[4, 6], [8, 3], [12, 6], [6, 8], [10, 8]]) {
      p.line(8, 14, x, y, C.leaf);
    }
    p.rect(4, 14, 8, 8, C.brick);
    p.rect(3, 14, 10, 2, C.tomato);
    p.rect(7, 12, 2, 2, C.gold);
  });
  d('clover', 'Four Leaf Clover', 1, 1, 260, 3, 'plant', (p) => {
    p.rect(7, 12, 2, 8, C.moss);
    for (const [x, y] of [[5, 6], [11, 6], [5, 11], [11, 11]]) p.disc(x, y, 3, C.leaf);
    p.px(8, 8, C.mint);
    p.ell(8, 21, 5, 2, C.tomato);
    p.ell(8, 20, 3, 1, C.oat);
  });
  d('mushrooms', 'Mushroom Patch', 1, 1, 300, 3, 'plant', (p) => {
    for (const [x, y, r, c] of [[5, 14, 4, C.tomato], [11, 16, 3, C.butter], [8, 19, 2, C.tomato]]) {
      p.rect(x - 1, y, 2, 5, C.paper);
      p.ell(x, y, r, Math.max(1, r - 2), c);
      p.px(x - 1, y - 1, C.paper);
    }
    p.ell(8, 22, 7, 1, C.moss);
  });
  d('pine_cone', 'Pine Cone Tree', 1, 1, 340, 3, 'plant', (p) => {
    for (let i = 0; i < 5; i++) p.ell(8, 6 + i * 3, 2 + i, 2, i % 2 ? C.bark : C.wood);
    p.rect(7, 20, 2, 3, C.cocoa);
  });
  d('broccoli_bonsai', 'Broccoli Bonsai', 1, 1, 420, 3, 'plant', (p) => {
    p.rect(6, 12, 4, 6, '#a8d86a');
    for (const [x, y] of [[4, 8], [8, 6], [12, 8], [6, 10], [10, 10]]) p.disc(x, y, 3, '#3f9f5a');
    p.rect(3, 18, 10, 4, C.teal);
    p.rect(3, 18, 10, 1, T(C.teal, 0.3));
  });
  d('sunflower_cup', 'Sunflower in a Cup', 1, 1, 520, 4, 'plant', (p) => {
    p.rect(7, 8, 2, 8, C.moss);
    p.ell(11, 12, 2, 1, C.leaf);
    p.disc(8, 6, 4, C.butter);
    p.disc(8, 6, 2, C.cocoa);
    p.rect(4, 16, 8, 6, C.paper);
    p.rect(12, 17, 2, 3, C.paper);
    p.rect(4, 17, 8, 1, C.tomato);
  });
  d('ivy_frame', 'Ivy Picture Frame', 1, 1, 700, 5, 'plant', (p) => {
    p.rect(3, 6, 10, 16, C.bark);
    p.rect(5, 8, 6, 12, C.oat);
    for (const [x, y] of [[4, 7], [12, 9], [3, 12], [13, 15], [5, 20], [11, 21], [8, 6]]) p.disc(x, y, 1, C.leaf);
  });
  d('palm', 'Thimble Palm', 1, 1, 900, 6, 'plant', (p) => {
    p.rect(7, 8, 2, 9, C.bark);
    p.line(8, 7, 2, 10, C.leaf);
    p.line(8, 7, 14, 10, C.leaf);
    p.line(8, 7, 3, 4, C.moss);
    p.line(8, 7, 13, 4, C.moss);
    p.rect(4, 17, 8, 5, C.steel);
  });
  d('bonsai', 'Old Bonsai', 1, 1, 2200, 8, 'plant', (p) => {
    p.line(5, 19, 8, 12, C.cocoa);
    p.line(6, 19, 9, 12, C.cocoa);
    p.line(8, 12, 12, 8, C.cocoa);
    p.ell(11, 7, 4, 3, C.moss);
    p.ell(6, 10, 3, 2, C.leaf);
    p.rect(2, 19, 12, 3, C.plum);
    p.rect(2, 19, 12, 1, C.lilac);
  });

  // Lights
  d('candle', 'Candle on a Coin', 1, 1, 120, 1, 'light', (p) => {
    p.ell(8, 21, 6, 2, C.gold);
    p.ell(8, 20, 4, 1, C.butter);
    p.rect(6, 9, 4, 11, C.cream);
    p.rect(9, 10, 1, 9, C.oat);
    p.rect(8, 7, 1, 2, C.ink);
    p.ell(8, 4, 1, 3, C.butter);
    p.px(8, 4, C.white);
  }, { glow: 1 });
  d('match_lamp', 'Matchstick Lamp', 1, 1, 220, 2, 'light', (p) => {
    p.rect(7, 8, 2, 14, C.honey);
    p.ell(8, 22, 4, 1, C.bark);
    p.disc(8, 6, 3, C.tomato);
    p.px(7, 5, C.butter);
  }, { glow: 1 });
  d('firefly_jar', 'Firefly Jar', 1, 1, 300, 3, 'light', (p) => {
    p.rrect(4, 9, 8, 13, C.ice);
    p.rect(5, 7, 6, 2, C.bark);
    for (const [x, y] of [[6, 12], [9, 15], [7, 18]]) {
      p.px(x, y, C.butter);
      p.px(x + 1, y, C.white);
    }
    p.px(5, 11, C.white);
  }, { glow: 1 });
  d('paper_lantern', 'Paper Lantern', 1, 1, 380, 3, 'light', (p) => {
    p.rect(7, 2, 2, 4, C.bark);
    p.ell(8, 11, 6, 5, C.tomato);
    for (const y of [8, 11, 14]) p.rect(3, y, 10, 1, T(C.tomato, -0.2));
    p.rect(6, 16, 4, 2, C.gold);
    p.rect(7, 18, 2, 4, C.bark);
  }, { glow: 1 });
  d('fairy_post', 'Fairy Light Post', 1, 1, 520, 4, 'light', (p) => {
    p.rect(7, 4, 2, 18, C.bark);
    p.line(3, 6, 13, 10, C.ink);
    p.line(3, 13, 13, 16, C.ink);
    for (const [x, y, c] of [[4, 7, C.butter], [8, 8, C.tomato], [12, 10, C.sky], [4, 14, C.leaf], [8, 15, C.butter], [12, 16, C.rose]]) p.px(x, y, c);
  }, { glow: 1 });
  d('nightlight', 'Moon Night Light', 1, 1, 650, 5, 'light', (p) => {
    p.disc(8, 11, 6, C.butter);
    p.disc(10, 9, 5, 0);
    p.rect(5, 18, 6, 4, C.iron);
    p.px(5, 7, C.paper);
  }, { glow: 1 });
  d('lava_lamp', 'Lava Lamp', 1, 1, 900, 5, 'light', (p) => {
    p.rect(5, 18, 6, 4, C.iron);
    p.rect(6, 4, 4, 2, C.iron);
    p.rect(5, 6, 6, 12, C.lilac);
    p.disc(8, 10, 2, C.rose);
    p.disc(7, 15, 1, C.rose);
    p.px(9, 7, C.rose);
  }, { glow: 1 });
  d('street_lamp', 'Tiny Street Lamp', 1, 1, 1400, 7, 'light', (p) => {
    p.rect(7, 6, 2, 16, C.iron);
    p.ell(8, 22, 4, 1, C.ink);
    p.rrect(5, 0, 6, 7, C.butter);
    p.rect(5, 0, 6, 1, C.ink);
    p.px(7, 3, C.white);
  }, { glow: 1 });
  d('neon', 'Neon OPEN Sign', 2, 1, 3000, 10, 'light', (p) => {
    p.rect(2, 8, 28, 13, C.deep);
    p.rect(4, 11, 3, 7, C.rose);
    p.rect(5, 12, 1, 5, C.deep);
    p.rect(9, 11, 3, 7, C.sky);
    p.rect(10, 12, 2, 2, C.deep);
    p.rect(10, 15, 2, 3, C.deep);
    p.rect(14, 11, 3, 7, C.butter);
    p.rect(15, 12, 2, 1, C.deep);
    p.rect(15, 16, 2, 1, C.deep);
    p.rect(19, 11, 1, 7, C.mint);
    p.rect(23, 11, 1, 7, C.mint);
    p.line(19, 11, 23, 17, C.mint);
    p.rect(5, 21, 2, 2, C.iron);
    p.rect(25, 21, 2, 2, C.iron);
  }, { glow: 1 });
  d('disco', 'Disco Ball', 1, 1, 6000, 12, 'light', (p) => {
    p.rect(7, 0, 2, 3, C.iron);
    p.disc(8, 8, 6, C.steel);
    for (let y = 3; y < 14; y += 2) for (let x = 3; x < 14; x += 2) p.px(x, y, (x + y) % 4 ? C.white : C.sky);
    p.rect(7, 15, 2, 7, C.iron);
    p.ell(8, 22, 4, 1, C.ink);
  }, { glow: 1 });

  // Kitchen gear: small appliances that really help
  d('tip_jar', 'Tip Jar', 1, 1, 400, 2, 'appliance', (p) => {
    p.rrect(4, 10, 8, 12, C.ice);
    p.rect(5, 8, 6, 2, C.steel);
    p.rect(5, 17, 6, 5, '#6fbf6a');
    p.px(7, 18, C.paper);
    p.px(9, 20, C.paper);
  }, { fx: { tips: 0.02 } });
  d('kettle', 'Tiny Kettle', 1, 1, 500, 3, 'appliance', (p) => {
    p.ell(8, 16, 6, 5, C.steel);
    p.ell(7, 14, 3, 2, C.white);
    p.line(13, 15, 15, 12, C.iron);
    p.line(4, 10, 12, 10, C.ink);
    p.rect(7, 10, 2, 1, C.ink);
    p.rect(2, 21, 12, 1, C.iron);
  }, { fx: { tips: 0.01 } });
  d('toaster', 'Toaster', 1, 1, 700, 3, 'appliance', (p) => {
    p.rrect(2, 12, 12, 10, C.steel);
    p.rect(3, 13, 10, 1, C.white);
    p.rect(4, 8, 3, 5, C.honey);
    p.rect(9, 8, 3, 5, C.honey);
    p.rect(13, 16, 2, 3, C.ink);
    p.rect(2, 22, 2, 1, C.ink);
    p.rect(12, 22, 2, 1, C.ink);
  }, { fx: { fl: { nutty: 0.06 } } });
  d('spice_rack', 'Spice Rack', 1, 1, 900, 4, 'appliance', (p) => {
    p.rect(2, 8, 12, 2, C.bark);
    p.rect(2, 15, 12, 2, C.bark);
    p.rect(2, 8, 1, 14, C.cocoa);
    p.rect(13, 8, 1, 14, C.cocoa);
    for (const [x, y, c] of [[4, 10, C.tomato], [7, 10, C.butter], [10, 10, C.leaf], [4, 17, C.plum], [7, 17, C.gold], [10, 17, C.sky]]) {
      p.rect(x, y, 2, 4, c);
      p.px(x, y, C.paper);
    }
  }, { fx: { fl: { tangy: 0.07 } } });
  d('hand_mill', 'Hand Grain Mill', 1, 1, 1100, 4, 'appliance', (p) => {
    p.rect(4, 12, 8, 10, C.wood);
    p.rect(3, 9, 10, 3, C.iron);
    p.line(8, 9, 13, 5, C.iron);
    p.disc(13, 4, 1, C.bark);
    p.rect(6, 17, 4, 3, C.cocoa);
  }, { fx: { fl: { earthy: 0.08 } } });
  d('microwave', 'Toy Microwave', 1, 1, 1200, 4, 'appliance', (p) => {
    p.rect(1, 10, 14, 11, C.paper);
    p.rect(2, 12, 8, 7, C.deep);
    p.px(4, 14, C.sky);
    p.rect(11, 12, 3, 2, C.ink);
    for (const y of [15, 17, 19]) p.rect(11, y, 3, 1, C.iron);
    p.rect(3, 21, 2, 2, C.iron);
    p.rect(11, 21, 2, 2, C.iron);
  }, { fx: { lunch: 10 } });
  d('fridge', 'Mini Fridge', 1, 1, 1500, 4, 'appliance', (p) => {
    p.rrect(2, 1, 12, 21, C.ice);
    p.rect(2, 8, 12, 1, C.iron);
    p.rect(3, 2, 10, 1, C.white);
    p.rect(11, 4, 1, 3, C.iron);
    p.rect(11, 10, 1, 5, C.iron);
    p.rect(4, 11, 3, 3, C.butter);
    p.rect(3, 22, 2, 1, C.ink);
    p.rect(11, 22, 2, 1, C.ink);
  }, { fx: { fl: { fresh: 0.1 } }, note: 'Keeps greens crisp.' });
  d('gumball', 'Gumball Machine', 1, 1, 1500, 5, 'appliance', (p) => {
    p.rect(5, 14, 6, 8, C.tomato);
    p.rect(4, 21, 8, 2, C.brick);
    p.disc(8, 8, 6, C.ice);
    for (const [x, y, c] of [[6, 7, C.tomato], [9, 6, C.butter], [10, 9, C.leaf], [7, 10, C.sky], [8, 8, C.rose]]) p.px(x, y, c);
    p.rect(7, 16, 2, 2, C.gold);
  }, { fx: { passive: 3 } });
  d('blender', 'Blender', 1, 1, 1600, 5, 'appliance', (p) => {
    p.rect(4, 17, 8, 5, C.iron);
    p.rect(5, 6, 6, 11, C.ice);
    p.rect(5, 12, 6, 5, C.leaf);
    p.rect(4, 4, 8, 2, C.ink);
    p.rect(11, 8, 2, 6, C.ice);
    p.px(8, 19, C.tomato);
  }, { fx: { wokY: 0.08 } });
  d('dishwasher', 'Dishwasher', 1, 1, 1800, 5, 'appliance', (p) => {
    p.rrect(1, 6, 14, 16, C.steel);
    p.rect(2, 7, 12, 3, C.iron);
    p.px(4, 8, C.leaf);
    p.px(6, 8, C.butter);
    p.rect(3, 12, 10, 8, C.white);
    p.rect(3, 12, 10, 1, C.iron);
    p.rect(5, 15, 6, 1, C.iron);
    p.rect(2, 22, 2, 1, C.ink);
    p.rect(12, 22, 2, 1, C.ink);
  }, { fx: { turns: 0.1 }, note: 'Clean plates, faster tables.' });
  d('rice_cooker', 'Rice Cooker', 1, 1, 1900, 5, 'appliance', (p) => {
    p.ell(8, 12, 6, 3, C.paper);
    p.rect(2, 12, 12, 9, C.paper);
    p.rect(2, 16, 12, 1, C.rose);
    p.rect(6, 18, 4, 2, C.ink);
    p.px(7, 19, C.leaf);
    p.rect(7, 8, 2, 2, C.iron);
  }, { fx: { potY: 0.1 } });
  d('air_fryer', 'Air Fryer', 1, 1, 2100, 6, 'appliance', (p) => {
    p.rrect(3, 5, 10, 17, C.ink);
    p.rect(4, 7, 8, 5, C.iron);
    p.px(6, 9, C.tomato);
    p.px(9, 9, C.leaf);
    p.rect(4, 14, 8, 6, C.plum);
    p.rect(6, 16, 4, 1, C.steel);
  }, { fx: { fl: { savory: 0.12 } } });
  d('oven', 'Toy Oven', 1, 1, 2400, 6, 'appliance', (p) => {
    p.rect(1, 5, 14, 17, C.steel);
    for (const x of [3, 7, 11]) p.disc(x, 7, 1, C.ink);
    p.rect(3, 11, 10, 8, C.ink);
    p.rect(4, 12, 8, 6, C.gold);
    p.rect(3, 10, 10, 1, C.iron);
    p.rect(2, 22, 2, 1, C.ink);
    p.rect(12, 22, 2, 1, C.ink);
  }, { fx: { stoveFast: 0.1 } });
  d('mixer', 'Stand Mixer', 1, 1, 2600, 7, 'appliance', (p) => {
    p.rect(3, 20, 11, 2, C.tomato);
    p.rect(3, 8, 3, 12, C.tomato);
    p.rect(3, 6, 10, 4, C.tomato);
    p.rect(8, 10, 1, 4, C.steel);
    p.rect(6, 14, 7, 6, C.steel);
    p.px(11, 7, C.paper);
  }, { fx: { stoveY: 0.12 } });
  d('coffee', 'Espresso Machine', 1, 1, 3000, 8, 'appliance', (p) => {
    p.rect(2, 4, 12, 6, C.steel);
    p.rect(2, 18, 12, 4, C.steel);
    p.rect(3, 10, 2, 8, C.iron);
    p.rect(11, 10, 2, 8, C.iron);
    p.rect(7, 10, 2, 2, C.ink);
    p.rect(6, 15, 4, 3, C.paper);
    p.px(5, 6, C.tomato);
    p.px(8, 6, C.leaf);
  }, { fx: { waiter: 0.2 }, note: 'Waiters only. Nobody gives this to a hamster for real.' });
  d('water_cooler', 'Water Cooler', 1, 1, 1300, 6, 'appliance', (p) => {
    p.rrect(5, 1, 6, 8, C.sky);
    p.px(6, 3, C.white);
    p.rect(4, 9, 8, 13, C.paper);
    p.rect(7, 12, 2, 2, C.tomato);
    p.rect(4, 15, 8, 1, C.oat);
  }, { fx: { sous: 0.1 } });
  d('register', 'Cash Register', 1, 1, 3600, 7, 'appliance', (p) => {
    p.rect(2, 14, 12, 8, C.gold);
    p.rect(3, 6, 10, 8, C.butter);
    p.rect(4, 7, 8, 3, C.deep);
    p.rect(5, 8, 3, 1, C.mint);
    for (let y = 11; y < 14; y += 2) for (let x = 4; x < 12; x += 2) p.px(x, y, C.cocoa);
    p.rect(3, 18, 10, 1, C.bark);
  }, { fx: { tips: 0.05 } });
  d('freezer', 'Chest Freezer', 2, 1, 3200, 7, 'appliance', (p) => {
    p.rect(2, 10, 28, 12, C.ice);
    p.rect(2, 10, 28, 3, C.white);
    p.rect(13, 13, 6, 2, C.iron);
    p.rect(4, 22, 2, 2, C.ink);
    p.rect(26, 22, 2, 2, C.ink);
    p.px(5, 16, C.sky);
    p.px(26, 18, C.sky);
  }, { fx: { fl: { sweet: 0.15 } } });
  d('vending', 'Vending Machine', 1, 1, 5000, 9, 'appliance', (p) => {
    p.rect(1, 0, 14, 22, C.tomato);
    p.rect(2, 1, 9, 15, C.ice);
    for (let y = 2; y < 15; y += 4) for (let x = 3; x < 10; x += 3) p.rect(x, y, 2, 3, y % 3 ? C.butter : C.leaf);
    p.rect(12, 3, 2, 2, C.ink);
    p.rect(12, 7, 2, 4, C.iron);
    p.rect(3, 18, 7, 3, C.ink);
  }, { fx: { passive: 9 } });
  d('ice_cart', 'Frozen Fruit Cart', 2, 1, 7000, 11, 'appliance', (p) => {
    p.rect(4, 10, 24, 10, C.paper);
    p.rect(4, 14, 24, 1, C.rose);
    p.rect(14, 2, 2, 8, C.iron);
    p.ell(15, 2, 11, 2, C.rose);
    p.rect(6, 7, 3, 3, C.tomato);
    p.rect(11, 7, 3, 3, C.butter);
    p.disc(8, 21, 2, C.ink);
    p.disc(24, 21, 2, C.ink);
  }, { fx: { passive: 15 } });

  // Cleaning: keeps the floor tidy, which keeps the tips up
  d('trash_bin', 'Tiny Trash Bin', 1, 1, 150, 1, 'clean', (p) => {
    p.rect(4, 11, 8, 11, C.iron);
    for (const x of [5, 7, 9]) p.rect(x, 13, 1, 7, C.steel);
    p.rect(3, 9, 10, 2, C.steel);
    p.rect(7, 7, 2, 2, C.iron);
  }, { fx: { clean: 0.2 } });
  d('broom_stand', 'Broom Stand', 1, 1, 200, 1, 'clean', (p) => {
    p.rect(4, 3, 1, 15, C.bark);
    p.rect(9, 5, 1, 13, C.bark);
    p.rect(2, 18, 5, 4, C.butter);
    p.rect(7, 18, 5, 4, C.gold);
    p.rect(2, 22, 12, 1, C.cocoa);
  }, { fx: { clean: 0.3 } });
  d('mop_bucket', 'Mop and Bucket', 1, 1, 450, 2, 'clean', (p) => {
    p.rect(11, 3, 1, 13, C.bark);
    p.rect(3, 13, 9, 9, C.sky);
    p.rect(3, 13, 9, 2, C.ice);
    p.rect(9, 15, 5, 3, C.paper);
    p.line(3, 13, 7, 9, C.iron);
    p.line(12, 13, 7, 9, C.iron);
  }, { fx: { clean: 0.5 } });
  d('recycle', 'Recycling Bins', 2, 1, 500, 3, 'clean', (p) => {
    for (const [x, c] of [[2, C.leaf], [12, C.sky], [22, C.butter]]) {
      p.rect(x, 11, 8, 11, c);
      p.rect(x - 1, 9, 10, 2, T(c, -0.25));
      p.rect(x + 3, 15, 2, 3, C.paper);
    }
  }, { fx: { clean: 0.6 } });
  d('sink', 'Hand Wash Sink', 1, 1, 800, 3, 'clean', (p) => {
    p.rect(2, 11, 12, 5, C.paper);
    p.rect(4, 11, 8, 3, C.sky);
    p.rect(7, 16, 2, 6, C.steel);
    p.rect(7, 6, 2, 5, C.steel);
    p.rect(7, 6, 5, 2, C.steel);
    p.px(12, 9, C.sky);
    p.ell(8, 22, 3, 1, C.iron);
  }, { fx: { clean: 0.8 } });
  d('vacuum', 'Upright Vacuum', 1, 1, 1100, 4, 'clean', (p) => {
    p.rect(9, 1, 2, 10, C.ink);
    p.rect(5, 8, 7, 9, C.tomato);
    p.rect(6, 10, 4, 4, C.ice);
    p.rect(3, 17, 11, 4, C.iron);
    p.rect(3, 21, 11, 1, C.ink);
    p.px(5, 19, C.butter);
  }, { fx: { clean: 1 } });
  d('robot_mop', 'Robot Mop', 1, 1, 2600, 6, 'clean', (p) => {
    p.ell(8, 18, 7, 4, C.iron);
    p.ell(8, 17, 6, 3, C.steel);
    p.ell(8, 16, 2, 1, C.teal);
    p.px(8, 16, C.mint);
  }, { fx: { clean: 2 }, roam: 1, note: 'Leaves its dock and roams the floor by itself.' });
  d('washer', 'Washing Machine', 1, 1, 3400, 8, 'clean', (p) => {
    p.rrect(1, 4, 14, 18, C.paper);
    p.rect(2, 5, 12, 3, C.steel);
    p.px(4, 6, C.tomato);
    p.px(11, 6, C.leaf);
    p.disc(8, 14, 5, C.iron);
    p.disc(8, 14, 4, C.sky);
    p.px(6, 12, C.white);
    p.px(9, 15, C.paper);
  }, { fx: { clean: 2.5 } });
  d('floor_washer', 'Floor Washing Machine', 2, 1, 6000, 10, 'clean', (p) => {
    p.rect(20, 2, 2, 12, C.ink);
    p.rect(16, 2, 8, 2, C.ink);
    p.rect(6, 11, 18, 8, C.teal);
    p.rect(8, 13, 7, 4, C.sky);
    p.rect(4, 19, 24, 3, C.iron);
    p.rect(4, 22, 24, 1, C.ink);
    p.px(20, 15, C.butter);
  }, { fx: { clean: 3.5 }, note: 'The serious option.' });

  // Fun
  d('radio', 'Pocket Radio', 1, 1, 400, 2, 'fun', (p) => {
    p.rect(2, 11, 12, 11, C.bark);
    p.rect(3, 12, 6, 9, C.oat);
    for (let y = 13; y < 21; y += 2) p.rect(4, y, 4, 1, C.cocoa);
    p.disc(11, 14, 1, C.butter);
    p.disc(11, 18, 1, C.butter);
    p.line(12, 11, 15, 4, C.iron);
  });
  d('seesaw', 'Ruler Seesaw', 2, 1, 900, 4, 'fun', (p) => {
    p.line(1, 12, 30, 19, C.butter);
    p.line(1, 13, 30, 20, C.gold);
    p.grid(13, 16, ['..##..', '.####.', '######'], { '#': C.tomato });
  });
  d('slide', 'Spoon Slide', 1, 1, 1000, 4, 'fun', (p) => {
    p.rect(2, 3, 1, 19, C.iron);
    p.rect(5, 3, 1, 19, C.iron);
    for (let y = 6; y < 21; y += 4) p.rect(2, y, 4, 1, C.iron);
    p.line(5, 3, 14, 21, C.steel);
    p.line(6, 3, 15, 21, C.white);
  });
  d('globe', 'Marble Globe', 1, 1, 1100, 5, 'fun', (p) => {
    p.disc(8, 10, 6, C.sky);
    p.ell(6, 8, 2, 2, C.leaf);
    p.ell(10, 12, 2, 1, C.leaf);
    p.rect(7, 16, 2, 4, C.gold);
    p.rect(4, 20, 8, 2, C.bark);
    p.line(14, 5, 15, 15, C.gold);
  });
  d('swing', 'Paper Clip Swing', 1, 1, 1300, 5, 'fun', (p) => {
    p.rect(1, 4, 1, 18, C.iron);
    p.rect(14, 4, 1, 18, C.iron);
    p.rect(1, 3, 14, 1, C.iron);
    p.rect(4, 4, 1, 12, C.steel);
    p.rect(11, 4, 1, 12, C.steel);
    p.rect(3, 16, 10, 2, C.tomato);
  });
  d('music_box', 'Music Box', 1, 1, 1400, 4, 'fun', (p) => {
    p.rect(2, 12, 12, 10, C.bark);
    p.rect(2, 10, 12, 3, C.wood);
    p.rect(13, 15, 3, 1, C.steel);
    p.rect(15, 13, 1, 3, C.steel);
    p.px(6, 16, C.butter);
    p.px(9, 18, C.butter);
  });
  d('tv', 'Old Television', 1, 1, 1500, 5, 'fun', (p) => {
    p.rect(1, 6, 14, 12, C.bark);
    p.rect(2, 7, 9, 10, C.deep);
    p.rect(3, 8, 7, 8, C.sky);
    p.px(5, 10, C.butter);
    p.rect(12, 8, 2, 2, C.oat);
    p.rect(12, 11, 2, 2, C.oat);
    p.line(5, 6, 2, 1, C.ink);
    p.line(9, 6, 12, 1, C.ink);
    p.rect(3, 18, 2, 4, C.cocoa);
    p.rect(11, 18, 2, 4, C.cocoa);
  });
  d('bookshelf', 'Tiny Bookshelf', 1, 1, 1600, 6, 'fun', (p) => {
    p.rect(1, 2, 14, 20, C.bark);
    p.rect(2, 3, 12, 5, C.cocoa);
    p.rect(2, 10, 12, 5, C.cocoa);
    p.rect(2, 17, 12, 4, C.cocoa);
    for (const [x, y, c, h] of [[3, 3, C.tomato, 5], [5, 4, C.teal, 4], [7, 3, C.butter, 5], [10, 4, C.lilac, 4], [3, 11, C.leaf, 4], [6, 10, C.rose, 5], [9, 11, C.sky, 4], [4, 18, C.gold, 3], [8, 17, C.paper, 4]]) p.rect(x, y, 2, h, c);
  });
  d('tubes', 'Hamster Tube Maze', 2, 1, 1800, 6, 'fun', (p) => {
    p.rect(2, 16, 28, 5, C.ice);
    p.rect(4, 6, 5, 11, C.ice);
    p.rect(4, 4, 18, 5, C.ice);
    p.rect(22, 4, 5, 13, C.ice);
    p.rect(2, 17, 28, 1, C.white);
    p.rect(8, 15, 3, 7, C.tomato);
    p.rect(21, 15, 3, 7, C.butter);
  });
  d('piano', 'Toy Piano', 1, 1, 2200, 7, 'fun', (p) => {
    p.rect(1, 6, 14, 10, C.ink);
    p.rect(2, 13, 12, 4, C.paper);
    for (let x = 3; x < 13; x += 2) p.rect(x, 13, 1, 2, C.ink);
    p.rect(2, 17, 2, 5, C.ink);
    p.rect(12, 17, 2, 5, C.ink);
    p.rect(4, 8, 8, 3, C.plum);
  });
  d('white_noise', 'White Noise Box', 1, 1, 2400, 7, 'fun', (p) => {
    p.rrect(2, 11, 12, 11, C.paper);
    for (let y = 13; y < 20; y += 2) for (let x = 4; x < 12; x += 2) p.px(x, y, C.iron);
    p.px(11, 20, C.mint);
  }, { fx: { winks: 5 }, note: 'Soothes the player. The real hamster never hears it.' });
  d('jukebox', 'Jukebox', 1, 1, 2600, 7, 'fun', (p) => {
    p.ell(8, 7, 7, 6, C.tomato);
    p.rect(1, 7, 14, 15, C.tomato);
    p.ell(8, 8, 5, 4, C.butter);
    p.rect(3, 12, 10, 4, C.ice);
    for (let x = 4; x < 12; x += 2) p.px(x, 14, C.tomato);
    p.rect(3, 18, 10, 3, C.gold);
  }, { fx: { tips: 0.03 } });
  d('arcade', 'Arcade Cabinet', 1, 1, 3000, 8, 'fun', (p) => {
    p.rect(2, 1, 12, 21, C.plum);
    p.rect(3, 3, 10, 8, C.deep);
    p.rect(5, 5, 2, 2, C.butter);
    p.rect(9, 7, 2, 2, C.mint);
    p.rect(2, 12, 12, 3, C.iron);
    p.px(5, 13, C.tomato);
    p.px(9, 13, C.butter);
    p.rect(3, 1, 10, 1, C.rose);
  });
  d('pinball', 'Pinball Table', 2, 1, 3600, 9, 'fun', (p) => {
    p.rect(2, 9, 28, 10, C.plum);
    p.rect(3, 10, 26, 8, C.deep);
    for (const [x, y, c] of [[8, 13, C.tomato], [15, 12, C.butter], [22, 14, C.mint]]) p.disc(x, y, 1, c);
    p.line(4, 17, 9, 16, C.paper);
    p.rect(4, 19, 2, 4, C.ink);
    p.rect(26, 19, 2, 4, C.ink);
  });
  d('foosball', 'Foosball Table', 2, 1, 4200, 10, 'fun', (p) => {
    p.rect(2, 9, 28, 11, C.bark);
    p.rect(3, 10, 26, 9, C.leaf);
    for (const x of [8, 15, 22]) {
      p.rect(x, 7, 1, 15, C.steel);
      p.rect(x - 1, 13, 3, 3, x === 15 ? C.tomato : C.sky);
    }
    p.rect(4, 20, 2, 3, C.cocoa);
    p.rect(26, 20, 2, 3, C.cocoa);
  });
  d('dream_catcher', 'Dream Catcher', 1, 1, 4800, 10, 'fun', (p) => {
    p.disc(8, 8, 6, C.bark);
    p.disc(8, 8, 5, C.paper);
    p.line(3, 8, 13, 8, C.lilac);
    p.line(8, 3, 8, 13, C.lilac);
    p.line(4, 4, 12, 12, C.lilac);
    p.line(12, 4, 4, 12, C.lilac);
    for (const x of [4, 8, 12]) {
      p.rect(x, 14, 1, 5, C.bark);
      p.rect(x, 19, 1, 3, C.rose);
    }
  }, { fx: { winks: 4 } });
  d('telescope', 'Brass Telescope', 1, 1, 5200, 11, 'fun', (p) => {
    p.line(3, 13, 12, 4, C.gold);
    p.line(4, 14, 13, 5, C.gold);
    p.line(5, 14, 13, 6, C.butter);
    p.line(8, 11, 4, 22, C.bark);
    p.line(8, 11, 12, 22, C.bark);
    p.line(8, 11, 8, 22, C.cocoa);
  }, { fx: { rare: 0.1 }, note: 'Spots rare guests from far away.' });
  d('pool_table', 'Pool Table', 2, 2, 7500, 12, 'fun', (p) => {
    p.rect(1, 14, 30, 18, C.bark);
    p.rect(3, 16, 26, 14, C.moss);
    for (const [x, y, c] of [[10, 20, C.tomato], [14, 23, C.butter], [18, 19, C.sky], [22, 25, C.paper]]) p.disc(x, y, 1, c);
    for (const [x, y] of [[3, 16], [28, 16], [3, 29], [28, 29]]) p.px(x, y, C.ink);
    p.rect(3, 32, 3, 4, C.cocoa);
    p.rect(26, 32, 3, 4, C.cocoa);
  });

  // Things some guests look for
  d('yarn', 'Yarn Ball', 1, 1, 240, 2, 'attract', (p) => {
    p.disc(8, 16, 6, C.rose);
    p.line(4, 12, 12, 20, T(C.rose, -0.25));
    p.line(3, 16, 11, 22, T(C.rose, -0.25));
    p.line(6, 10, 14, 18, T(C.rose, -0.25));
    p.line(12, 12, 4, 20, T(C.rose, 0.25));
    p.line(13, 21, 15, 23, C.rose);
  }, { tag: 'yarn', note: 'Kittens lose all self control.' });
  d('moss_cork', 'Mossy Cork', 1, 1, 280, 2, 'attract', (p) => {
    p.rect(3, 12, 10, 10, '#c9a06a');
    p.ell(8, 12, 5, 3, C.leaf);
    p.ell(5, 16, 3, 2, C.moss);
    p.ell(11, 19, 3, 2, C.leaf);
    p.px(8, 18, '#8a6a3a');
  }, { tag: 'moss', note: 'Beetles, snails and deer settle in.' });
  d('hay_bale', 'Tied Hay Bale', 1, 1, 300, 2, 'attract', (p) => {
    p.rrect(2, 11, 12, 11, '#e0c060');
    p.rect(2, 15, 12, 1, C.bark);
    p.rect(2, 19, 12, 1, C.bark);
    for (const [x, y] of [[4, 12], [8, 13], [11, 12], [5, 17], [10, 17], [6, 21]]) p.px(x, y, '#b8922f');
  }, { tag: 'hay', note: 'Foals and kids come for a nibble.' });
  d('pencil_perch', 'Pencil Perch', 1, 1, 300, 2, 'attract', (p) => {
    p.rect(7, 8, 2, 14, C.butter);
    p.rect(2, 8, 12, 2, C.butter);
    p.rect(2, 8, 12, 1, C.gold);
    p.rect(12, 8, 2, 2, C.rose);
    p.px(2, 8, C.ink);
    p.ell(8, 22, 5, 1, C.bark);
  }, { tag: 'perch', note: 'Songbirds will not sit anywhere else.' });
  d('honey_spoon', 'Honey Spoon', 1, 1, 340, 2, 'attract', (p) => {
    p.line(3, 8, 11, 18, C.steel);
    p.line(4, 8, 12, 18, C.iron);
    p.ell(11, 18, 4, 3, C.steel);
    p.ell(11, 18, 3, 2, C.gold);
    p.px(10, 17, C.butter);
    p.rect(13, 20, 2, 2, C.gold);
  }, { tag: 'honey', note: 'Bees and butterflies follow the smell.' });
  d('book_stack', 'Stamp Book Stack', 1, 1, 360, 3, 'attract', (p) => {
    p.rect(2, 18, 12, 4, C.teal);
    p.rect(3, 14, 11, 4, C.tomato);
    p.rect(2, 10, 10, 4, C.butter);
    p.rect(3, 19, 10, 1, C.paper);
    p.rect(4, 15, 9, 1, C.paper);
    p.rect(3, 11, 8, 1, C.paper);
  }, { tag: 'book', note: 'Owls have read all of them.' });
  d('sock_burrow', 'Odd Sock Burrow', 2, 1, 420, 3, 'attract', (p) => {
    p.ell(13, 16, 11, 7, '#e88a7a');
    p.mask((q) => {
      for (let x = 2; x < 26; x += 4) q.rect(x, 8, 2, 16, C.paper);
    });
    p.rect(22, 11, 7, 11, C.paper);
    p.ell(26, 16, 2, 4, C.ink);
  }, { tag: 'burrow', note: 'Dormice sleep better in it.' });
  d('sand_tin', 'Sand Bath Tin', 2, 1, 450, 3, 'attract', (p) => {
    p.rect(2, 12, 28, 10, C.iron);
    p.rect(3, 12, 26, 8, '#efd9a0');
    p.px(8, 14, C.honey);
    p.px(17, 16, C.honey);
    p.px(24, 13, C.honey);
    p.rect(2, 21, 28, 1, C.ink);
  }, { tag: 'sand', note: 'Desert guests need a dust bath first.' });
  d('bamboo', 'Skewer Bamboo', 1, 1, 480, 4, 'attract', (p) => {
    for (const [x, h] of [[4, 16], [8, 20], [12, 14]]) {
      p.rect(x, 22 - h, 2, h, '#b8c86a');
      for (let y = 22 - h + 3; y < 22; y += 5) p.rect(x, y, 2, 1, '#7f8f3a');
      p.ell(x + 3, 22 - h + 1, 2, 1, C.leaf);
    }
  }, { tag: 'bamboo', note: 'Pandas and koalas look for this.' });
  d('sun_lamp', 'Bulb Sun Lamp', 1, 1, 650, 4, 'attract', (p) => {
    p.rect(7, 12, 2, 10, C.iron);
    p.ell(8, 22, 4, 1, C.ink);
    p.disc(8, 8, 5, C.butter);
    p.disc(7, 7, 2, C.white);
    p.rect(6, 13, 4, 2, C.steel);
  }, { tag: 'sunlamp', glow: 1, note: 'Lizards and chameleons bask here.' });
  d('saucer_pond', 'Saucer Pond', 2, 2, 800, 3, 'attract', (p) => {
    p.ell(16, 24, 15, 11, C.paper);
    p.ell(16, 24, 12, 8, C.sky);
    p.ell(14, 22, 5, 3, C.ice);
    p.ell(22, 28, 3, 2, C.leaf);
    p.px(23, 27, C.rose);
    p.ell(8, 27, 2, 1, C.leaf);
  }, { tag: 'pond', note: 'Everyone who lives in water asks about it.' });
  d('flower_pot', 'Flower Pot Hive', 1, 1, 900, 4, 'attract', (p) => {
    p.rect(4, 15, 8, 7, C.brick);
    p.rect(3, 14, 10, 2, C.tomato);
    for (const [x, y, c] of [[4, 7, C.rose], [8, 4, C.butter], [12, 8, C.lilac], [7, 9, C.paper]]) {
      p.line(8, 14, x, y, C.leaf);
      p.disc(x, y, 2, c);
      p.px(x, y, C.gold);
    }
  }, { tag: 'honey' });
  d('marble_run', 'Marble Run', 2, 1, 1100, 5, 'attract', (p) => {
    p.rect(3, 8, 2, 14, C.wood);
    p.rect(27, 8, 2, 14, C.wood);
    p.line(4, 10, 28, 15, C.steel);
    p.line(28, 16, 4, 21, C.steel);
    p.disc(11, 11, 2, C.sky);
    p.disc(19, 17, 2, C.tomato);
    p.px(10, 10, C.white);
    p.px(18, 16, C.white);
  }, { tag: 'marble', note: 'Pocket elephants have never seen anything so good.' });
  d('log_pile', 'Twig Log Pile', 1, 1, 1100, 5, 'attract', (p) => {
    for (const [x, y] of [[3, 19], [9, 19], [6, 15]]) {
      p.disc(x + 2, y, 3, C.bark);
      p.disc(x + 2, y, 2, C.honey);
      p.px(x + 2, y, C.bark);
    }
    p.ell(6, 12, 3, 1, C.leaf);
  }, { tag: 'moss' });
  d('tissue_cave', 'Tissue Box Cave', 2, 1, 1300, 6, 'attract', (p) => {
    p.rect(2, 9, 28, 13, C.sky);
    p.rect(2, 9, 28, 4, T(C.sky, 0.3));
    p.ell(16, 11, 7, 2, C.ink);
    p.ell(16, 10, 4, 2, C.paper);
    p.ell(6, 17, 2, 3, C.ink);
    for (const x of [12, 18, 24]) p.px(x, 18, C.paper);
  }, { tag: 'burrow' });
  d('bird_swing', 'Bird Swing', 1, 1, 1400, 5, 'attract', (p) => {
    p.ell(8, 9, 7, 8, C.iron);
    p.ell(8, 9, 6, 7, 0);
    p.rect(3, 13, 10, 2, C.honey);
    p.rect(7, 16, 2, 5, C.iron);
    p.ell(8, 22, 4, 1, C.ink);
  }, { tag: 'perch' });
  d('cactus_garden', 'Cactus Sand Garden', 2, 1, 1500, 6, 'attract', (p) => {
    p.rect(2, 14, 28, 8, C.bark);
    p.rect(3, 14, 26, 5, '#efd9a0');
    for (const [x, h] of [[8, 9], [16, 12], [24, 7]]) {
      p.rect(x, 15 - h, 3, h, C.leaf);
      p.px(x + 1, 15 - h + 2, C.mint);
    }
    p.rect(5, 8, 3, 2, C.leaf);
  }, { tag: 'sand' });
  d('heat_rock', 'Warm Basking Rock', 1, 1, 1600, 6, 'attract', (p) => {
    p.ell(8, 17, 7, 5, C.iron);
    p.ell(7, 15, 4, 2, C.steel);
    p.px(11, 19, C.gold);
    p.px(5, 19, C.tomato);
  }, { tag: 'sunlamp' });
  d('hay_cart', 'Hay Cart', 2, 1, 1600, 7, 'attract', (p) => {
    p.ell(15, 11, 12, 6, '#e0c060');
    p.rect(3, 13, 25, 7, C.bark);
    p.rect(3, 13, 25, 1, C.honey);
    p.disc(8, 21, 2, C.cocoa);
    p.disc(23, 21, 2, C.cocoa);
    p.line(28, 14, 31, 19, C.bark);
  }, { tag: 'hay' });
  d('cat_tree', 'Cat Tree', 1, 1, 1700, 7, 'attract', (p) => {
    p.rect(7, 4, 2, 18, C.oat);
    for (let y = 6; y < 22; y += 3) p.rect(7, y, 2, 1, C.honey);
    p.rect(2, 4, 12, 2, C.plum);
    p.rect(3, 11, 10, 2, C.plum);
    p.rect(2, 20, 12, 2, C.plum);
    p.rect(11, 6, 1, 4, C.butter);
  }, { tag: 'yarn' });
  d('reading_nook', 'Reading Nook', 1, 1, 1800, 7, 'attract', (p) => {
    p.rect(2, 3, 12, 8, C.bark);
    p.rect(3, 4, 10, 6, C.cocoa);
    for (let x = 4; x < 12; x += 2) p.rect(x, 5, 1, 5, x % 4 ? C.tomato : C.butter);
    p.rect(2, 14, 12, 8, C.tomato);
    p.rect(2, 14, 12, 3, T(C.tomato, 0.3));
  }, { tag: 'book' });
  d('aquarium', 'Jam Jar Aquarium', 2, 1, 3200, 8, 'attract', (p) => {
    p.rect(2, 6, 28, 16, C.ice);
    p.rect(3, 9, 26, 12, C.sky);
    p.rect(2, 22, 28, 1, C.ink);
    p.ell(11, 14, 3, 2, C.gold);
    p.px(14, 14, C.gold);
    p.ell(21, 17, 2, 1, C.tomato);
    p.rect(6, 15, 1, 6, C.leaf);
    p.rect(25, 13, 1, 8, C.moss);
    p.px(8, 10, C.white);
  }, { tag: 'pond' });
  d('ball_pit', 'Bead Ball Pit', 2, 2, 3800, 9, 'attract', (p) => {
    p.ell(16, 24, 15, 11, C.tomato);
    p.ell(16, 24, 12, 8, C.paper);
    for (let i = 0; i < 26; i++) {
      const a = i * 2.4;
      const r = 1 + (i / 26) * 9;
      p.disc(16 + Math.cos(a) * r * 1.2, 24 + Math.sin(a) * r * 0.8, 1, [C.tomato, C.butter, C.sky, C.leaf, C.rose][i % 5]);
    }
  }, { tag: 'marble' });

  // Prestige
  d('pawn', 'Chess Pawn Statue', 1, 1, 1200, 4, 'prestige', (p) => {
    p.disc(8, 8, 3, C.paper);
    p.rect(7, 11, 2, 6, C.paper);
    p.rect(5, 12, 6, 1, C.oat);
    p.rect(4, 17, 8, 3, C.paper);
    p.rect(3, 20, 10, 2, C.oat);
  });
  d('watch', 'Pocket Watch Clock', 1, 1, 1800, 5, 'prestige', (p) => {
    p.disc(8, 12, 7, C.gold);
    p.disc(8, 12, 5, C.paper);
    p.line(8, 12, 8, 9, C.ink);
    p.line(8, 12, 11, 13, C.ink);
    p.rect(7, 3, 2, 2, C.gold);
    p.rect(5, 19, 6, 3, C.bark);
  });
  d('mini_wheel', 'Little Wheel Model', 1, 1, 3000, 6, 'prestige', (p) => {
    p.disc(8, 12, 7, C.steel);
    p.disc(8, 12, 5, 0);
    p.line(8, 5, 8, 19, C.iron);
    p.line(1, 12, 15, 12, C.iron);
    p.rect(4, 19, 2, 3, C.iron);
    p.rect(10, 19, 2, 3, C.iron);
  });
  d('teapot_fountain', 'Teapot Fountain', 2, 2, 5200, 8, 'prestige', (p) => {
    p.ell(16, 28, 15, 7, C.steel);
    p.ell(16, 27, 12, 5, C.sky);
    p.disc(16, 16, 7, C.paper);
    p.rect(13, 8, 6, 2, C.oat);
    p.line(23, 16, 27, 11, C.paper);
    p.line(23, 17, 27, 12, C.paper);
    p.rect(27, 12, 1, 15, C.ice);
    p.ell(16, 15, 3, 2, C.rose);
  });
  d('chef_statue', 'Golden Chef Statue', 1, 1, 6000, 8, 'prestige', (p) => {
    p.rect(3, 19, 10, 3, C.iron);
    p.disc(8, 13, 4, C.gold);
    p.ell(8, 9, 5, 4, C.butter);
    p.rect(5, 4, 6, 3, C.butter);
    p.ell(8, 3, 4, 2, C.butter);
    p.rect(5, 16, 6, 3, C.gold);
    p.px(6, 9, C.cocoa);
    p.px(10, 9, C.cocoa);
  });
  d('chandelier', 'Paper Clip Chandelier', 1, 1, 9000, 12, 'prestige', (p) => {
    p.rect(7, 0, 2, 5, C.gold);
    p.ell(8, 8, 7, 3, C.gold);
    p.ell(8, 8, 5, 2, 0);
    for (const x of [2, 8, 14]) {
      p.rect(x - 1, 10, 2, 3, C.paper);
      p.px(x - 1, 9, C.butter);
    }
    p.rect(7, 13, 2, 9, C.bark);
  }, { glow: 1 });
  d('grand_clock', 'Grandfather Clock', 1, 1, 14000, 14, 'prestige', (p) => {
    p.rect(3, 0, 10, 22, C.cocoa);
    p.disc(8, 5, 4, C.paper);
    p.line(8, 5, 8, 3, C.ink);
    p.line(8, 5, 10, 6, C.ink);
    p.rect(6, 11, 4, 9, C.deep);
    p.rect(7, 12, 2, 5, C.gold);
    p.disc(8, 17, 1, C.butter);
  });
  d('rocket', 'Toy Rocket', 1, 1, 20000, 16, 'prestige', (p) => {
    p.rect(5, 6, 6, 13, C.paper);
    p.grid(5, 1, ['..##..', '.####.', '.####.', '######', '######'], { '#': C.tomato });
    p.disc(8, 10, 1, C.sky);
    p.grid(2, 15, ['##........##', '###......###', '###......###'].map((s) => s), { '#': C.tomato });
    p.rect(6, 19, 4, 3, C.gold);
  });
  d('gold_wheel', 'Golden Wheel Monument', 2, 1, 40000, 18, 'prestige', (p) => {
    p.disc(16, 11, 10, C.gold);
    p.disc(16, 11, 8, 0);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      p.line(16, 11, 16 + Math.cos(a) * 8, 11 + Math.sin(a) * 8, C.butter);
    }
    p.disc(16, 11, 2, C.paper);
    p.rect(8, 21, 16, 2, C.iron);
  });
  d('castle', 'Toy Castle', 2, 2, 60000, 20, 'prestige', (p) => {
    p.rect(4, 14, 24, 22, C.steel);
    p.grid(4, 11, ['##.##.##.##.##.##.##.##.'], { '#': C.steel });
    p.rect(2, 8, 7, 28, C.iron);
    p.rect(23, 8, 7, 28, C.iron);
    p.grid(2, 5, ['##.##.##'], { '#': C.iron });
    p.grid(23, 5, ['##.##.##'], { '#': C.iron });
    p.ell(16, 30, 4, 6, C.cocoa);
    p.rect(12, 30, 8, 6, C.cocoa);
    p.rect(15, 3, 1, 8, C.ink);
    p.grid(16, 3, ['####', '###.', '##..'], { '#': C.tomato });
  });
  d('crystal', 'Giant Sugar Crystal', 1, 1, 90000, 24, 'prestige', (p) => {
    p.grid(3, 1, ['....##....', '...####...', '..######..', '.########.', '##########', '.########.', '..######..', '..######..', '...####...', '....##....'].concat([]), { '#': C.ice });
    p.line(8, 1, 3, 5, C.white);
    p.line(8, 1, 12, 5, C.sky);
    p.line(8, 10, 8, 2, C.white);
    p.rect(3, 12, 10, 8, C.ice);
    p.rect(4, 14, 3, 5, C.white);
    p.rect(2, 20, 12, 2, C.gold);
  }, { glow: 1, note: 'Decoration only. Nobody here eats sugar.' });
  d('bunting', 'Festival Bunting', 1, 1, 400, 1, 'prestige', (p) => {
    p.rect(2, 6, 1, 16, C.bark);
    p.rect(13, 6, 1, 16, C.bark);
    p.line(2, 6, 13, 9, C.ink);
    for (const [x, y, c] of [[4, 8, C.tomato], [7, 8, C.butter], [10, 9, C.sky]]) p.grid(x, y, ['###', '###', '.#.'], { '#': c });
  }, { festival: 1, note: 'Only comes from a distance milestone.' });

  // Trophies from the guest book. Not for sale.
  [[25, '#b87a4a'], [50, '#9aa7b0'], [75, '#e8b83a'], [100, '#6fd0c0'], [125, '#a99ad6'], [150, '#f49fb0'], [180, '#ffdd4a']].forEach(([n, c]) => {
    d('trophy_' + n, `${n} Guests Trophy`, 1, 1, 2500 + n * 90, 1, 'prestige', (p) => {
      p.rect(4, 4, 8, 7, c);
      p.ell(8, 11, 4, 3, c);
      p.rect(2, 5, 2, 4, c);
      p.rect(12, 5, 2, 4, c);
      p.rect(7, 13, 2, 5, c);
      p.rect(4, 18, 8, 2, T(c, -0.3));
      p.rect(3, 20, 10, 2, C.cocoa);
      p.px(6, 6, C.white);
    }, { festival: 1, note: `Earned by meeting ${n} kinds of guest.` });
  });

  // Yard pieces stand outside and draw guests in. Charm follows the price.
  const yard = (id, n, w, h, price, lvl, draw, extra) => d(id, n, w, h, price, lvl, 'yard', draw, Object.assign({ charm: Math.round(Math.sqrt(price)) }, extra || {}));
  yard('stepping_stones', 'Stepping Stones', 1, 1, 80, 1, (p) => {
    for (const [x, y, r] of [[4, 19, 3], [11, 21, 3], [8, 14, 2]]) {
      p.ell(x, y, r, 2, '#a8a49c');
      p.px(x - 1, y - 1, '#c8c4bc');
    }
  });
  yard('daisy_patch', 'Daisy Patch', 1, 1, 120, 1, (p) => {
    for (const [x, y] of [[4, 18], [10, 16], [12, 21], [6, 22]]) {
      p.rect(x, y + 1, 1, 3, C.leaf);
      p.rect(x - 1, y - 1, 3, 3, C.white);
      p.px(x, y, C.butter);
    }
  });
  yard('mushroom_ring', 'Mushroom Ring', 1, 1, 160, 1, (p) => {
    for (const [x, y, c] of [[4, 18, C.tomato], [11, 16, '#c9875a'], [8, 21, C.tomato]]) {
      p.rect(x, y, 2, 3, C.paper);
      p.ell(x + 1, y, 3, 2, c);
      p.px(x, y - 1, C.white);
    }
  });
  yard('arrow_sign', 'Arrow Sign', 1, 1, 200, 1, (p) => {
    p.rect(7, 10, 2, 13, C.bark);
    p.grid(2, 8, ['..##########', '.###########', '############', '.###########', '..##########'], { '#': C.wood });
    p.rect(6, 10, 6, 1, C.bark);
  });
  yard('tulip_bed', 'Tulip Bed', 1, 1, 300, 2, (p) => {
    p.rect(1, 19, 14, 4, C.cocoa);
    for (let i = 0; i < 4; i++) {
      const x = 2 + i * 4;
      p.rect(x, 14, 1, 5, C.leaf);
      p.rect(x - 1, 11, 3, 3, [C.tomato, C.butter, C.rose, C.lilac][i]);
    }
  });
  yard('picket_fence', 'Picket Fence', 1, 1, 350, 2, (p) => {
    p.rect(0, 15, 16, 2, C.paper);
    p.rect(0, 19, 16, 2, C.paper);
    for (const x of [1, 6, 11]) {
      p.rect(x, 11, 3, 12, C.white);
      p.px(x + 1, 10, C.white);
    }
  });
  yard('windmill', 'Paper Windmill', 1, 1, 420, 2, (p) => {
    p.rect(7, 12, 2, 11, C.wood);
    p.grid(3, 3, ['#...#.....', '##..#...##', '.##.#..##.', '..#####...', '....#####.', '...##.#.##', '.##..#..##', '##...#...#'], { '#': C.sky });
    p.px(8, 7, C.butter);
  });
  yard('lantern_post', 'Lantern Post', 1, 1, 520, 2, (p) => {
    p.rect(7, 9, 2, 14, C.iron);
    p.rect(4, 22, 8, 1, C.iron);
    p.rect(5, 3, 6, 6, C.butter);
    p.rect(4, 2, 8, 1, C.iron);
    p.rect(4, 9, 8, 1, C.iron);
    p.rect(7, 3, 2, 6, C.gold);
  }, { glow: 1 });
  yard('bird_bath', 'Bird Bath', 1, 1, 720, 3, (p) => {
    p.rect(6, 14, 4, 8, '#b8bcc0');
    p.rect(4, 21, 8, 2, '#a0a4a8');
    p.ell(8, 13, 6, 2, '#c8ccd0');
    p.ell(8, 13, 4, 1, C.sky);
  });
  yard('garden_bench', 'Garden Bench', 2, 1, 880, 3, (p) => {
    p.rect(3, 12, 26, 2, C.wood);
    p.rect(3, 15, 26, 2, C.wood);
    p.rect(3, 18, 26, 2, C.honey);
    p.rect(4, 20, 2, 3, C.iron);
    p.rect(26, 20, 2, 3, C.iron);
    p.rect(4, 12, 1, 8, C.iron);
    p.rect(27, 12, 1, 8, C.iron);
  });
  yard('wind_chime', 'Wind Chime', 1, 1, 1000, 3, (p) => {
    p.rect(7, 4, 2, 19, C.bark);
    p.rect(3, 4, 10, 1, C.bark);
    for (const [x, h] of [[3, 7], [6, 9], [10, 7], [12, 5]]) p.rect(x, 5, 1, h, C.steel);
  });
  yard('scarecrow', 'Friendly Scarecrow', 1, 1, 1200, 4, (p) => {
    p.rect(7, 8, 2, 15, C.bark);
    p.rect(2, 11, 12, 2, C.bark);
    p.rect(5, 11, 6, 7, C.tomato);
    p.disc(8, 6, 3, '#e8d0a0');
    p.rect(4, 2, 8, 2, C.honey);
    p.rect(6, 0, 4, 2, C.honey);
    p.px(7, 6, C.ink);
    p.px(9, 6, C.ink);
  });
  yard('chalk_menu', 'Chalkboard Menu', 1, 1, 1500, 4, (p) => {
    p.rect(3, 6, 10, 12, C.bark);
    p.rect(4, 7, 8, 10, '#2f3f3a');
    for (let y = 9; y < 16; y += 2) p.rect(5, y, 6, 1, C.paper);
    p.rect(4, 18, 2, 5, C.bark);
    p.rect(10, 18, 2, 5, C.bark);
  });
  yard('sunflower_row', 'Sunflower Row', 2, 1, 1900, 5, (p) => {
    for (const x of [4, 12, 20, 27]) {
      p.rect(x, 9, 1, 14, C.leaf);
      p.disc(x, 7, 3, C.butter);
      p.disc(x, 7, 1, C.cocoa);
      p.px(x + 1, 14, C.leaf);
    }
  });
  yard('topiary', 'Hedge Rabbit', 1, 1, 2500, 6, (p) => {
    p.disc(8, 16, 6, C.moss);
    p.disc(8, 8, 4, C.moss);
    p.rect(5, 1, 2, 5, C.moss);
    p.rect(9, 1, 2, 5, C.moss);
    p.px(6, 8, C.ink);
    p.px(10, 8, C.ink);
    p.rect(4, 21, 8, 2, C.bark);
  });
  yard('rose_arch', 'Rose Arch', 2, 1, 3200, 6, (p) => {
    p.rect(3, 6, 2, 17, C.moss);
    p.rect(27, 6, 2, 17, C.moss);
    p.ell(16, 6, 13, 5, C.moss);
    p.ell(16, 7, 10, 3, C.oat);
    for (const [x, y] of [[4, 10], [28, 14], [8, 3], [16, 1], [24, 3], [3, 18], [28, 8]]) p.px(x, y, C.rose);
  });
  yard('stone_lantern', 'Stone Lantern', 1, 1, 4000, 7, (p) => {
    p.rect(6, 15, 4, 8, '#a0a4a8');
    p.rect(4, 21, 8, 2, '#8f9398');
    p.rect(4, 9, 8, 6, '#b8bcc0');
    p.rect(6, 10, 4, 4, C.butter);
    p.rect(2, 7, 12, 2, '#a0a4a8');
    p.rect(5, 5, 6, 2, '#a0a4a8');
  }, { glow: 1 });
  yard('picnic_table', 'Picnic Table', 2, 1, 5000, 8, (p) => {
    p.rect(3, 12, 26, 3, C.wood);
    p.rect(3, 12, 26, 1, C.honey);
    p.rect(1, 18, 30, 2, C.wood);
    p.line(8, 15, 5, 23, C.bark);
    p.line(24, 15, 27, 23, C.bark);
    for (let x = 5; x < 28; x += 6) p.rect(x, 12, 3, 1, C.tomato);
  });
  yard('koi_pond', 'Koi Pond', 2, 2, 7000, 9, (p) => {
    p.ell(16, 26, 15, 10, '#a8a49c');
    p.ell(16, 26, 13, 8, C.sky);
    p.ell(16, 28, 10, 5, '#5fa0c0');
    p.rect(9, 25, 4, 2, C.tomato);
    p.rect(19, 29, 4, 2, C.paper);
    p.rect(19, 29, 2, 2, C.tomato);
    p.disc(24, 22, 2, C.leaf);
  });
  yard('fountain', 'Stone Fountain', 2, 2, 11000, 11, (p) => {
    p.ell(16, 32, 15, 6, '#a8acb0');
    p.ell(16, 31, 12, 4, C.sky);
    p.rect(14, 16, 4, 15, '#b8bcc0');
    p.ell(16, 16, 7, 2, '#a8acb0');
    p.rect(15, 8, 2, 8, C.sky);
    p.px(13, 11, C.sky);
    p.px(19, 11, C.sky);
    p.px(11, 14, C.sky);
    p.px(21, 14, C.sky);
  });
  yard('gazebo', 'Little Gazebo', 2, 2, 16000, 12, (p) => {
    p.rect(4, 14, 2, 22, C.paper);
    p.rect(26, 14, 2, 22, C.paper);
    p.rect(15, 14, 2, 22, C.paper);
    p.rect(2, 36, 28, 3, C.wood);
    p.grid(1, 2, ['............##............', '..........######..........', '........##########........', '......##############......', '....##################....', '..######################..', '##########################'], { '#': C.tomato });
    p.rect(2, 12, 28, 2, C.brick);
  });
  yard('wheel_statue', 'Great Wheel Statue', 2, 2, 28000, 14, (p) => {
    p.rect(6, 34, 20, 4, '#a8acb0');
    p.disc(16, 18, 14, C.gold);
    p.disc(16, 18, 11, C.oat);
    for (let k = 0; k < 8; k++) p.line(16, 18, 16 + Math.cos((k * Math.PI) / 4) * 11, 18 + Math.sin((k * Math.PI) / 4) * 11, C.gold);
    p.disc(16, 18, 2, C.brick);
    p.rect(13, 30, 6, 4, C.gold);
  });
  yard('balloon', 'Tethered Balloon', 2, 2, 45000, 16, (p) => {
    p.ell(16, 12, 12, 12, C.tomato);
    p.rect(11, 1, 3, 22, C.butter);
    p.rect(18, 1, 3, 22, C.butter);
    p.line(8, 21, 12, 30, C.bark);
    p.line(24, 21, 20, 30, C.bark);
    p.rect(11, 30, 10, 6, C.wood);
    p.rect(11, 30, 10, 1, C.honey);
    p.rect(14, 36, 4, 3, C.iron);
  });
  yard('clock_tower', 'Tiny Clock Tower', 2, 2, 70000, 19, (p) => {
    p.rect(9, 8, 14, 31, '#c8b08a');
    p.rect(9, 8, 2, 31, '#b09870');
    p.grid(7, 0, ['........##........', '......######......', '....##########....', '..##############..', '##################'], { '#': C.brick });
    p.disc(16, 16, 5, C.paper);
    p.rect(16, 12, 1, 4, C.ink);
    p.rect(16, 16, 3, 1, C.ink);
    p.rect(13, 30, 6, 9, C.bark);
  });

  // Things that turn up when you shake a tree or sweep a floor. No shop sells them.
  const found = (id, n, find, value, rating, note, draw) => d(id, n, 1, 1, value * 2, 1, 'found', draw, { festival: 1, find, sell: value, rating, note });
  found('dust_bunny', 'Dust Bunny', 'junk', 2, 2, 'It was under the stove. It looks at you.', (p) => {
    p.disc(8, 17, 5, '#a8a8b4');
    p.disc(5, 15, 2, '#c4c4d0');
    p.disc(11, 19, 2, '#8e8e9c');
    p.px(6, 16, C.ink);
    p.px(10, 16, C.ink);
  });
  found('bent_pin', 'Bent Pin', 'junk', 2, 2, 'Nobody is going to want this.', (p) => {
    p.line(5, 21, 8, 15, '#b8c0c8');
    p.line(8, 15, 11, 12, '#d8e0e8');
    p.disc(11, 11, 1, C.tomato);
  });
  found('odd_button', 'Odd Button', 'junk', 3, 2, 'From a coat nobody remembers.', (p) => {
    p.disc(8, 17, 4, '#6fb0d8');
    p.disc(8, 17, 2, '#4f90b8');
    p.px(7, 16, C.ink);
    p.px(9, 16, C.ink);
    p.px(7, 18, C.ink);
    p.px(9, 18, C.ink);
  });
  found('lint_ball', 'Ball of Lint', 'junk', 2, 2, 'Soft, grey and of no use at all.', (p) => {
    p.disc(8, 18, 4, '#8f9fb4');
    p.px(6, 16, '#b4c0d0');
    p.px(10, 19, '#6f7f94');
    p.px(8, 15, '#b4c0d0');
    p.px(12, 17, '#8f9fb4');
    p.px(4, 19, '#8f9fb4');
  });
  found('rubber_band', 'Snapped Rubber Band', 'junk', 3, 2, 'It has given all it had.', (p) => {
    p.line(3, 21, 7, 16, '#c9875a');
    p.line(7, 16, 10, 20, '#c9875a');
    p.line(10, 20, 13, 15, '#a8683c');
  });
  found('receipt', 'Old Receipt', 'junk', 4, 3, 'Someone once bought eleven peas.', (p) => {
    p.rect(5, 10, 6, 12, C.paper);
    for (let y = 12; y < 21; y += 2) p.rect(6, y, 4, 1, '#b8a890');
    p.px(10, 22, C.paper);
    p.px(6, 22, C.paper);
  });
  found('pencil_stub', 'Pencil Stub', 'junk', 5, 3, 'Too short to hold, too long to throw away.', (p) => {
    p.rect(6, 12, 4, 8, C.butter);
    p.rect(6, 20, 4, 2, '#e8a0a0');
    p.rect(7, 10, 2, 2, '#efd8b0');
    p.px(7, 9, C.ink);
    p.px(8, 9, C.ink);
  });
  found('paper_clip', 'Bent Paper Clip', 'junk', 3, 2, 'It wanted to be a chandelier.', (p) => {
    p.line(5, 21, 5, 13, '#c8d0d8');
    p.line(5, 13, 10, 13, '#c8d0d8');
    p.line(10, 13, 10, 19, '#c8d0d8');
    p.line(10, 19, 7, 19, '#a8b0b8');
    p.line(7, 19, 7, 15, '#a8b0b8');
  });
  found('lucky_coin', 'Lucky Penny', 'treasure', 300, 34, 'Somebody dropped it long ago. Worth keeping, or worth selling.', (p) => {
    p.disc(8, 16, 5, '#c9783a');
    p.disc(8, 16, 4, '#e49a5a');
    p.rect(7, 13, 2, 6, '#c9783a');
    p.px(6, 14, C.white);
  });
  found('pearl_button', 'Pearl Button', 'treasure', 500, 42, 'It shines like a small moon.', (p) => {
    p.disc(8, 16, 5, '#e8e4f4');
    p.disc(8, 16, 3, '#fff8ff');
    p.px(7, 15, '#a8a0c0');
    p.px(9, 15, '#a8a0c0');
    p.px(7, 17, '#a8a0c0');
    p.px(9, 17, '#a8a0c0');
  });
  found('old_key', 'Old Brass Key', 'treasure', 800, 50, 'Nobody knows what it opens. Everyone wants it.', (p) => {
    p.disc(8, 11, 3, '#c9a03a');
    p.disc(8, 11, 1, C.oat);
    p.rect(7, 14, 2, 8, '#c9a03a');
    p.rect(9, 18, 2, 1, '#e8c04a');
    p.rect(9, 20, 3, 1, '#e8c04a');
  });
  found('silver_spoon', 'Silver Spoon', 'treasure', 1500, 65, 'Stands by itself. Very proud of it.', (p) => {
    p.ell(8, 9, 3, 4, '#c8d4e0');
    p.ell(8, 9, 2, 3, '#e8f0f8');
    p.rect(7, 13, 2, 9, '#a8b4c0');
    p.px(7, 8, C.white);
  });
  found('tiny_ruby', 'Ruby from a Lost Ring', 'treasure', 3000, 87, 'It was in the leaves all along.', (p) => {
    p.grid(4, 11, ['..####..', '.######.', '########', '.######.', '..####..', '...##...'], { '#': '#d8304a' });
    p.rect(6, 12, 2, 2, '#ff8a9a');
    p.rect(5, 19, 6, 3, '#c9a03a');
  });
  found('gold_thimble', 'Gold Thimble', 'treasure', 6000, 120, 'The best find on the street.', (p) => {
    p.rect(5, 11, 6, 10, '#e8b83a');
    p.ell(8, 11, 3, 2, '#ffdd4a');
    p.rect(4, 20, 8, 2, '#c9983a');
    for (const [x, y] of [[6, 14], [9, 14], [7, 17], [10, 17]]) p.px(x, y, '#c9983a');
    p.px(6, 12, C.white);
  });
  const flowerRow = (p, x, y, w) => {
    for (let i = 0; i < w; i += 3) {
      p.px(x + i, y, C.leaf);
      p.px(x + i + 1, y - 1, [C.tomato, C.butter, C.rose, C.lilac][(i / 3) % 4]);
    }
  };
  // Yard pieces from around the world. The dearer ones are bigger and brighter, and some of them move.
  const world = (id, n, w, h, price, lvl, head, draw, extra) => yard(id, n, w, h, price, lvl, draw, Object.assign({ head }, extra || {}));
  world('nonla', 'Conical Hat on a Post', 1, 1, 140, 1, 0, (p) => {
    const b = p.h;
    p.rect(7, b - 12, 2, 12, C.bark);
    for (let i = 0; i < 7; i++) p.rect(7 - i, b - 19 + i, 2 + i * 2, 1, i % 2 ? '#e8d09a' : '#f4e2b4');
    p.rect(1, b - 12, 14, 1, '#c8a870');
    p.rect(4, b - 14, 8, 1, '#3f8a86');
  });
  world('cactus', 'Saguaro Cactus', 1, 1, 240, 1, 0, (p) => {
    const b = p.h;
    p.rrect(6, b - 21, 5, 20, C.moss);
    p.rect(7, b - 20, 1, 18, C.leaf);
    p.rect(2, b - 13, 4, 3, C.moss);
    p.rect(2, b - 17, 3, 5, C.moss);
    p.rect(11, b - 10, 4, 3, C.moss);
    p.rect(12, b - 15, 3, 6, C.moss);
    p.px(8, b - 22, C.rose);
    p.px(3, b - 18, C.butter);
    p.rect(4, b - 2, 9, 2, '#c8a870');
  });
  world('clogs', 'Giant Wooden Clogs', 1, 1, 380, 2, 0, (p) => {
    const b = p.h;
    for (const [x, y, c] of [[1, b - 8, '#f0c848'], [5, b - 14, '#e8b83a']]) {
      p.rrect(x, y, 10, 7, c);
      p.rect(x + 7, y - 1, 3, 4, c);
      p.rect(x + 7, y - 1, 3, 1, T(c, 0.4));
      p.rect(x + 1, y + 5, 8, 1, T(c, -0.3));
      p.px(x + 3, y + 2, C.tomato);
      p.px(x + 4, y + 1, C.tomato);
      p.px(x + 4, y + 3, C.leaf);
    }
  });
  world('rocking_chair', 'Porch Rocking Chair', 1, 1, 460, 2, 0, (p) => {
    const b = p.h;
    p.rect(3, b - 22, 2, 16, C.bark);
    p.rect(3, b - 22, 9, 2, C.wood);
    for (let y = b - 19; y < b - 11; y += 3) p.rect(4, y, 7, 1, C.wood);
    p.rect(3, b - 11, 10, 2, C.wood);
    p.rect(11, b - 11, 2, 6, C.bark);
    p.line(1, b - 5, 7, b - 2, C.cocoa);
    p.line(7, b - 2, 15, b - 4, C.cocoa);
    p.rect(5, b - 13, 6, 2, C.rose);
  });
  world('matryoshka', 'Nesting Dolls', 1, 1, 640, 3, 0, (p) => {
    const b = p.h;
    for (const [x, r, top, c] of [[4, 4, 21, C.tomato], [10, 3, 15, '#3f7fb0'], [14, 2, 10, C.butter]]) {
      p.ell(x, b - top * 0.32 - 2, r, top * 0.32 + 1, c);
      p.disc(x, b - top + r - 1, r - 1, c);
      p.disc(x, b - top + r - 1, r - 2 > 0 ? r - 2 : 1, C.cream);
      p.px(x - 1, b - top + r - 1, C.ink);
      if (r > 2) p.px(x + 1, b - top + r - 1, C.ink);
      p.px(x, b - top * 0.32 - 2, C.white);
    }
  });
  world('jangdok', 'Kimchi Jars', 1, 1, 800, 3, 0, (p) => {
    const b = p.h;
    p.rect(0, b - 3, 16, 3, '#a8a49c');
    p.rect(0, b - 3, 16, 1, '#c8c4bc');
    for (const [x, y, r] of [[8, b - 13, 3], [3, b - 8, 3], [12, b - 7, 3]]) {
      p.ell(x, y, r, r + 1, '#8a4f34');
      p.rect(x - r + 1, y - 1, 1, 3, '#b87a58');
      p.rect(x - r, y + 2, r * 2 + 1, 1, '#6d3f2c');
      p.rect(x - r + 1, y - r - 2, r * 2 - 1, 2, '#5a3626');
      p.px(x, y - r - 3, '#b87a58');
    }
  });
  world('maneki', 'Lucky Cat', 1, 1, 1100, 4, 0, (p, f) => {
    const b = p.h;
    p.rrect(4, b - 13, 9, 12, C.white);
    p.rrect(3, b - 22, 11, 10, C.white);
    p.rect(3, b - 24, 3, 3, C.white);
    p.rect(11, b - 24, 3, 3, C.white);
    p.px(4, b - 23, C.rose);
    p.px(12, b - 23, C.rose);
    p.px(6, b - 18, C.ink);
    p.px(11, b - 18, C.ink);
    p.px(8, b - 16, C.tomato);
    p.px(9, b - 16, C.tomato);
    p.rect(4, b - 13, 9, 2, C.tomato);
    p.disc(8, b - 11, 1, C.butter);
    p.rect(5, b - 8, 7, 5, C.butter);
    p.rect(6, b - 7, 5, 3, C.gold);
    // One paw waves.
    const up = f ? 2 : 0;
    p.rect(13, b - 20 - up, 3, 7, C.white);
    p.rect(13, b - 21 - up, 3, 1, C.rose);
    p.rect(2, b - 8, 3, 4, C.white);
  }, { frames: 2, fps: 2 });
  world('phone_box', 'Red Phone Box', 1, 1, 1400, 4, 14, (p) => {
    const b = p.h;
    const red = '#d0342a';
    p.rect(2, b - 34, 12, 34, red);
    p.rect(2, b - 36, 12, 2, T(red, -0.2));
    p.rect(4, b - 38, 8, 2, red);
    p.rect(4, b - 33, 8, 3, C.paper);
    for (const x of [4, 9]) for (const y of [b - 28, b - 21, b - 14]) p.rect(x, y, 3, 5, '#bfe6ea');
    p.rect(3, b - 2, 10, 2, T(red, -0.3));
    p.px(4, b - 27, C.white);
  });
  world('jangseung', 'Village Guardians', 1, 1, 2100, 5, 10, (p) => {
    const b = p.h;
    const pole = (x, c) => {
      p.rect(x, b - 30, 6, 30, c);
      p.rect(x, b - 31, 6, 1, T(c, 0.3));
      p.rect(x, b - 28, 2, 1, C.ink);
      p.rect(x + 4, b - 28, 2, 1, C.ink);
      p.rect(x + 1, b - 26, 1, 2, C.white);
      p.rect(x + 4, b - 26, 1, 2, C.white);
      p.rect(x + 2, b - 24, 2, 3, T(c, -0.3));
      p.rect(x, b - 20, 6, 2, C.white);
      p.rect(x + 1, b - 19, 4, 1, C.ink);
      p.rect(x + 2, b - 15, 2, 12, T(c, -0.3));
    };
    pole(1, '#b57f4f');
    pole(9, '#c98f5a');
    p.rect(0, b - 34, 8, 3, C.tomato);
    p.rect(8, b - 34, 8, 3, '#3f7fb0');
  });
  world('lantern_frame', 'Silk Lanterns', 2, 1, 2800, 6, 6, (p) => {
    const b = p.h;
    p.rect(2, b - 27, 2, 27, C.bark);
    p.rect(28, b - 27, 2, 27, C.bark);
    p.rect(0, b - 28, 32, 2, C.wood);
    const colors = [C.tomato, C.butter, '#d0408a', '#f28a2e', '#3f9a6a'];
    colors.forEach((c, i) => {
      const x = 6 + i * 5;
      const y = b - 24 + (i % 2) * 5;
      p.rect(x + 1, b - 26, 1, y - (b - 26), C.iron);
      p.ell(x + 1, y + 3, 2, 3, c);
      p.px(x, y + 2, T(c, 0.5));
      p.rect(x + 1, y + 7, 1, 2, C.butter);
    });
  }, { glow: 1 });
  world('spirit_house', 'Spirit House', 1, 1, 3600, 7, 12, (p) => {
    const b = p.h;
    const gold = '#f0c040';
    p.rect(7, b - 12, 2, 12, '#f0ece4');
    p.rect(3, b - 2, 10, 2, '#d8d4cc');
    p.rect(2, b - 14, 12, 2, '#e0d8c8');
    p.rect(4, b - 24, 8, 10, '#d0502e');
    p.rect(4, b - 24, 8, 1, gold);
    p.rect(6, b - 21, 4, 7, gold);
    p.rect(7, b - 20, 2, 5, C.ink);
    for (let i = 0; i < 5; i++) p.rect(2 + i, b - 26 - i, 12 - i * 2, 1, i % 2 ? gold : '#3f9a5a');
    p.rect(7, b - 36, 2, 6, gold);
    p.px(1, b - 27, gold);
    p.px(14, b - 27, gold);
    p.px(3, b - 15, C.rose);
    p.px(12, b - 15, C.tomato);
  });
  world('vespa', 'Little Scooter', 2, 1, 4400, 7, 0, (p) => {
    const b = p.h;
    const c = '#8fd0c0';
    p.disc(7, b - 4, 3, C.ink);
    p.disc(24, b - 4, 3, C.ink);
    p.disc(7, b - 4, 1, C.steel);
    p.disc(24, b - 4, 1, C.steel);
    p.rrect(4, b - 12, 11, 7, c);
    p.rect(12, b - 7, 10, 2, c);
    p.rect(21, b - 18, 3, 13, c);
    p.rect(19, b - 19, 8, 2, C.iron);
    p.disc(25, b - 16, 2, C.butter);
    p.rrect(5, b - 15, 9, 3, C.cocoa);
    // A basket of flowers on the back.
    p.rect(1, b - 18, 5, 4, C.wood);
    p.px(2, b - 19, C.rose);
    p.px(4, b - 19, C.butter);
    p.px(3, b - 20, C.tomato);
    p.px(8, b - 10, C.white);
  });
  world('zen_garden', 'Zen Rock Garden', 2, 2, 6000, 8, 0, (p) => {
    const b = p.h;
    p.rect(0, b - 32, 32, 32, '#6d4535');
    p.rect(1, b - 31, 30, 30, '#efe6d0');
    for (let y = b - 29; y < b - 1; y += 3) p.rect(1, y, 30, 1, '#d8ccb0');
    const ring = (cx, cy, r) => {
      p.ell(cx, cy, r + 4, r + 2, '#d8ccb0');
      p.ell(cx, cy, r + 3, r + 1, '#efe6d0');
      p.ell(cx, cy, r + 1, r, '#d8ccb0');
      p.ell(cx, cy, r, r - 1, '#efe6d0');
    };
    ring(10, b - 22, 3);
    ring(23, b - 10, 3);
    p.ell(10, b - 23, 4, 3, '#7a7e84');
    p.px(8, b - 25, '#a8acb0');
    p.ell(23, b - 11, 3, 2, '#6a6e74');
    p.ell(26, b - 26, 2, 1, '#8f9498');
    // A small bonsai in the corner.
    p.rect(5, b - 8, 2, 5, C.cocoa);
    p.ell(5, b - 10, 4, 2, C.moss);
    p.ell(8, b - 7, 3, 1, C.leaf);
  });
  world('moai', 'Stone Moai', 1, 1, 7800, 9, 16, (p) => {
    const b = p.h;
    const c = '#8f8a84';
    p.rect(3, b - 40, 10, 28, c);
    p.rect(2, b - 12, 12, 12, c);
    p.rect(3, b - 41, 10, 2, '#a8483a');
    p.rect(4, b - 34, 8, 2, '#5f5a56');
    p.rect(7, b - 32, 3, 10, '#a8a39c');
    p.rect(5, b - 21, 7, 2, '#5f5a56');
    p.rect(3, b - 36, 1, 8, '#6f6a64');
    p.rect(12, b - 36, 1, 8, '#6f6a64');
    p.rect(4, b - 10, 2, 8, '#6f6a64');
    p.rect(10, b - 10, 2, 8, '#6f6a64');
    p.rect(11, b - 44 + 2, 2, 2, C.leaf);
  });
  world('torii', 'Red Torii Gate', 2, 1, 9000, 10, 24, (p) => {
    const b = p.h;
    const red = '#d8402a';
    for (const x of [5, 24]) {
      p.rect(x, b - 40, 4, 40, red);
      p.rect(x + 3, b - 40, 1, 40, T(red, -0.3));
      p.rect(x - 1, b - 4, 6, 4, C.ink);
    }
    p.rect(2, b - 34, 28, 3, red);
    p.rect(14, b - 34, 4, 8, red);
    p.rect(13, b - 33, 6, 6, C.ink);
    p.rect(14, b - 32, 4, 4, C.butter);
    for (let x = 0; x < 32; x++) {
      const up = Math.round(Math.pow(Math.abs(x - 15.5) / 15.5, 2.4) * 4);
      p.rect(x, b - 42 - up, 1, 3, C.ink);
      p.rect(x, b - 39 - up, 1, 2, red);
    }
  });
  world('moon_gate', 'Moon Gate', 2, 1, 10000, 10, 18, (p) => {
    const b = p.h;
    p.rect(0, b - 38, 32, 38, '#f4f0e6');
    for (let y = b - 38; y < b; y += 5) p.rect(0, y, 32, 1, '#e4dfd2');
    for (let y = 0; y < 38; y++) {
      for (let x = 0; x < 32; x++) {
        if ((x - 15.5) ** 2 + (y - 21) ** 2 < 170) p.px(x, b - 38 + y, null);
      }
    }
    for (let a = 0; a < 80; a++) {
      const r = a * 0.0785;
      p.px(15.5 + Math.cos(r) * 13.5, b - 17 + Math.sin(r) * 13.5, '#8f4a2c');
    }
    // A curved cap of dark tiles.
    for (let x = -2; x < 34; x++) {
      const up = Math.round(Math.pow(Math.abs(x - 15.5) / 17, 3) * 3);
      p.rect(x, b - 41 - up, 1, 3, (x + 40) % 3 ? '#4f5864' : '#39414c');
    }
    p.rect(1, b - 24, 3, 2, '#3f9a5a');
    p.rect(27, b - 28, 4, 2, '#3f9a5a');
    p.px(28, b - 29, C.rose);
    p.px(2, b - 25, C.rose);
  });
  world('lotus_pond', 'Lotus Pond', 2, 2, 13000, 11, 0, (p) => {
    const b = p.h;
    p.ell(16, b - 15, 15, 13, '#8f8a84');
    p.ell(16, b - 15, 13, 11, '#3f8fb0');
    p.ell(14, b - 18, 8, 5, '#5fa8c8');
    for (const [x, y] of [[8, -20], [22, -9], [12, -8], [24, -20], [18, -14]]) p.ell(x, b + y, 3, 2, '#3f9a5a');
    for (const [x, y] of [[8, -23], [22, -12], [15, -16]]) {
      p.rect(x - 2, b + y + 1, 5, 2, '#f49fb0');
      p.rect(x - 1, b + y - 1, 3, 2, '#fbd0d8');
      p.px(x, b + y + 1, C.butter);
    }
    p.ell(11, b - 10, 2, 1, C.leaf);
    p.px(10, b - 11, C.white);
    p.px(12, b - 11, C.white);
    for (const [x, y] of [[3, -10], [28, -8], [5, -24], [27, -23]]) p.ell(x, b + y, 2, 2, '#a8a39c');
  }, { glow: 0 });
  world('arch_bridge', 'Red Arch Bridge', 3, 1, 18000, 12, 8, (p) => {
    const b = p.h;
    const red = '#d8402a';
    p.rect(0, b - 8, 48, 8, '#3f8fb0');
    for (let x = 0; x < 48; x += 7) p.rect(x, b - 5 + (x % 2), 4, 1, '#8fd0e8');
    for (let x = 2; x < 46; x++) {
      const t = (x - 24) / 22;
      const y = Math.round((1 - t * t) * 13);
      p.rect(x, b - 8 - y, 1, 4, '#b57f4f');
      p.rect(x, b - 12 - y, 1, 1, red);
      if (x % 6 === 2) p.rect(x, b - 15 - y, 2, 8, red);
      if (x % 12 === 2) p.px(x, b - 16 - y, C.butter);
      p.rect(x, b - 15 - y, 1, 1, red);
    }
    for (const x of [8, 24, 40]) p.rect(x, b - 8, 2, 8, T(red, -0.2));
    p.rect(0, b - 3, 3, 3, C.leaf);
    p.rect(45, b - 3, 3, 3, C.leaf);
  });
  // Sails that turn: frame moves them on by a quarter of the gap between two sails.
  world('dutch_mill', 'Dutch Windmill', 3, 2, 23000, 13, 34, (p, f) => {
    const b = p.h;
    const cx = 24;
    for (let y = 0; y < 44; y++) {
      const hw = Math.round(7 + (y / 44) * 7);
      p.rect(cx - hw, b - 46 + y, hw * 2, 1, y % 5 === 4 ? '#7a4e30' : '#8f5f3c');
    }
    p.rect(cx - 15, b - 16, 30, 16, '#a8483a');
    for (let y = b - 16; y < b; y += 3) p.rect(cx - 15, y, 30, 1, '#94402f');
    p.rect(cx - 16, b - 18, 32, 2, C.white);
    p.rect(cx - 4, b - 12, 8, 12, C.moss);
    p.px(cx + 2, b - 6, C.butter);
    p.rect(cx - 12, b - 11, 5, 5, '#bfe6ea');
    p.rect(cx + 7, b - 11, 5, 5, '#bfe6ea');
    for (let y = 0; y < 8; y++) p.rect(cx - 9 + Math.floor(y / 2) * 0 + 0, b - 54 + y, 18, 1, y % 3 ? '#5f6a70' : '#4f5a60');
    p.ell(cx, b - 54, 9, 4, '#5f6a70');
    p.rect(cx - 3, b - 38, 6, 7, '#bfe6ea');
    p.rect(cx - 3, b - 26, 6, 7, '#bfe6ea');
    const hub = [cx, b - 46];
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2 + (f * Math.PI) / 8;
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      for (let r = 2; r < 19; r++) {
        const x = hub[0] + ux * r;
        const y = hub[1] + uy * r;
        p.px(x, y, C.cocoa);
        if (r > 5) {
          for (let w = 1; w <= 4; w++) p.px(x - uy * w, y + ux * w, (r + w) % 2 ? C.cream : '#e8d8b8');
        }
      }
    }
    p.disc(hub[0], hub[1], 2, C.iron);
    flowerRow(p, 0, b - 2, 48);
  }, { frames: 4, fps: 5 });
  world('liberty', 'Little Liberty', 1, 1, 30000, 14, 34, (p) => {
    const b = p.h;
    const g = '#6fb8a0';
    const d = '#4f9a84';
    p.rect(1, b - 9, 14, 9, '#c8c0ac');
    p.rect(0, b - 3, 16, 3, '#a8a08c');
    p.rect(2, b - 11, 12, 2, '#d8d0bc');
    p.rect(5, b - 34, 7, 23, g);
    p.rect(4, b - 26, 9, 15, g);
    for (const x of [6, 9, 11]) p.rect(x, b - 26, 1, 15, d);
    p.rect(6, b - 39, 5, 5, g);
    for (const [x, y] of [[4, -41], [6, -42], [8, -43], [10, -42], [12, -41]]) p.px(x, b + y, d);
    p.rect(5, b - 40, 7, 1, d);
    p.px(7, b - 37, C.ink);
    p.px(9, b - 37, C.ink);
    // The raised arm with a torch, and a tablet in the other.
    p.rect(11, b - 44, 2, 12, g);
    p.rect(10, b - 46, 4, 2, C.butter);
    p.rect(11, b - 49, 2, 3, C.tomato);
    p.px(11, b - 50, C.butter);
    p.rect(3, b - 30, 2, 6, d);
    p.rect(2, b - 28, 3, 5, '#8fd0c0');
  }, { glow: 1 });
  world('pisa', 'Leaning Tower', 2, 2, 38000, 15, 36, (p) => {
    const b = p.h;
    p.rect(0, b - 4, 32, 4, '#c8d088');
    const lean = (y) => Math.round((b - y) * 0.12);
    for (let y = b - 56; y < b - 2; y++) {
      const x = 9 + lean(y);
      const floor = Math.floor((b - y) / 8);
      p.rect(x, y, 14, 1, '#f8f4e8');
      // A row of arches on every storey.
      for (let k = 0; k < 4; k++) {
        const ax = x + 1 + k * 3;
        const row = (b - y) % 8;
        if (row > 1 && row < 7) p.rect(ax, y, 2, 1, row > 5 ? '#d8d0bc' : '#a8a08c');
      }
      if ((b - y) % 8 < 2) p.rect(x - 1, y, 16, 1, floor % 2 ? '#e8e0cc' : '#d8d0bc');
      p.px(x + 13, y, '#d8d0bc');
    }
    const tx = 9 + lean(b - 58);
    p.rect(tx + 2, b - 62, 10, 6, '#f8f4e8');
    p.rect(tx + 3, b - 60, 2, 3, '#a8a08c');
    p.rect(tx + 8, b - 60, 2, 3, '#a8a08c');
    p.rect(tx + 1, b - 63, 12, 1, '#d8d0bc');
    p.rect(tx + 6, b - 67, 2, 4, C.tomato);
  });
  world('pagoda_mini', 'Five Storey Pagoda', 2, 2, 48000, 16, 44, (p) => {
    const b = p.h;
    const red = '#c8382a';
    p.rect(2, b - 5, 28, 5, '#a8a39c');
    p.rect(4, b - 7, 24, 2, '#c8c4bc');
    let y = b - 7;
    for (let k = 0; k < 5; k++) {
      const hw = 11 - k * 1.5;
      const hh = 9 - Math.floor(k / 2);
      p.rect(16 - hw, y - hh, hw * 2, hh, red);
      p.rect(16 - hw + 2, y - hh, 1, hh, '#e0604a');
      p.rect(16 + hw - 2, y - hh, 1, hh, '#8f2420');
      p.rect(14, y - hh + 2, 4, hh - 2, C.butter);
      y -= hh;
      const eave = hw + 5;
      for (let r = 0; r < 4; r++) p.rect(16 - eave + r, y - 1 - r, (eave - r) * 2, 1, r === 0 ? '#39414c' : '#4f5864');
      p.px(16 - eave - 1, y - 2, '#f0c040');
      p.px(16 + eave, y - 2, '#f0c040');
      y -= 3;
    }
    p.rect(15, y - 12, 2, 12, '#f0c040');
    for (const r of [0, 4, 8]) p.rect(13 + r / 4, y - 3 - r, 6 - r / 2, 1, '#f0c040');
    p.px(15, y - 13, C.white);
  }, { glow: 1 });
  world('dragon', 'Golden Dragon', 3, 1, 60000, 18, 22, (p, f) => {
    const b = p.h;
    const gold = '#f0c040';
    const dark = '#c0902a';
    // Two stone stands, with the long body rolling across them.
    for (const x of [7, 19, 32]) p.rect(x, b - 8, 4, 8, '#a8a39c');
    const body = (x) => b - 18 - Math.sin(x / 6 + f * 1.57) * 7;
    for (let x = 4; x < 32; x++) {
      const y = Math.round(body(x));
      const r = 3 + (x > 10 ? 1 : 0);
      p.rect(x, y - r, 1, r * 2 + 1, gold);
      p.px(x, y + r, dark);
      if (x % 3 === 0) p.px(x, y, dark);
      if (x % 4 === 0) p.rect(x, y - r - 2, 1, 2, C.tomato);
    }
    // Head.
    const hy = Math.round(body(32));
    p.rrect(31, hy - 6, 10, 9, gold);
    p.rect(38, hy - 2, 4, 3, gold);
    p.px(35, hy - 3, C.ink);
    p.px(41, hy, C.tomato);
    p.line(32, hy - 7, 28, hy - 12, C.tomato);
    p.line(34, hy - 7, 32, hy - 13, dark);
    p.line(40, hy + 1, 38, hy + 6, C.butter);
    p.rect(33, hy + 3, 6, 2, C.white);
    // Tail.
    p.line(4, Math.round(body(4)), 0, b - 24, gold);
    p.px(0, b - 25, C.tomato);
    p.px(1, b - 26, C.tomato);
    // The pearl it chases.
    p.disc(44, b - 6, 2, C.white);
    p.px(43, b - 7, C.sky);
  }, { frames: 4, fps: 4, glow: 1 });
  world('sphinx', 'Little Sphinx', 3, 2, 85000, 20, 8, (p) => {
    const b = p.h;
    const sand = '#e8c88a';
    const dark = '#c8a468';
    p.rect(0, b - 6, 48, 6, '#d8b878');
    p.rect(0, b - 6, 48, 1, '#f0d8a0');
    // Body and paws.
    p.rrect(4, b - 20, 28, 14, sand);
    p.rect(26, b - 11, 20, 6, sand);
    for (const x of [40, 43]) p.rect(x, b - 8, 1, 3, dark);
    p.rect(26, b - 6, 20, 1, dark);
    p.rect(4, b - 7, 22, 1, dark);
    for (let x = 8; x < 26; x += 5) p.rect(x, b - 19, 1, 12, dark);
    // Head with a striped headdress.
    p.rrect(25, b - 34, 14, 16, '#f4d898');
    p.rect(23, b - 30, 18, 12, '#3f6fa8');
    for (let y = b - 30; y < b - 18; y += 3) p.rect(23, y, 18, 1, C.butter);
    p.rect(27, b - 32, 10, 12, '#f4d898');
    p.rect(26, b - 34, 12, 3, '#3f6fa8');
    p.rect(26, b - 33, 12, 1, C.butter);
    p.px(29, b - 27, C.ink);
    p.px(34, b - 27, C.ink);
    p.rect(31, b - 25, 2, 2, dark);
    p.rect(30, b - 22, 4, 1, dark);
    // An obelisk behind.
    p.rect(8, b - 44, 7, 26, '#d0a868');
    p.rect(9, b - 47, 5, 3, C.butter);
    p.px(11, b - 49, C.butter);
    for (let y = b - 41; y < b - 22; y += 4) p.rect(10, y, 3, 2, '#a88450');
  });
  world('eiffel', 'Eiffel Tower', 2, 2, 110000, 22, 60, (p, f) => {
    const b = p.h;
    const iron = '#7a6a5a';
    const light = '#a8947a';
    const leg = (y) => {
      const t = (b - y) / 86;
      return 15 * Math.pow(1 - t, 2.6) + 1;
    };
    for (let y = b - 84; y < b; y++) {
      const hw = leg(y);
      p.px(16 - hw - 1, y, iron);
      p.px(16 - hw, y, light);
      p.px(16 + hw - 1, y, light);
      p.px(16 + hw, y, iron);
      if (hw > 3) {
        const inner = hw * 0.55;
        p.px(16 - inner, y, y % 4 === 0 ? light : iron);
        p.px(16 + inner, y, y % 4 === 0 ? light : iron);
      }
      // Cross bracing.
      if (y % 6 === 0) {
        p.line(16 - hw, y, 16 + hw, y + 5, iron);
        p.line(16 + hw, y, 16 - hw, y + 5, iron);
      }
    }
    // Big arch at the foot.
    for (let x = -11; x <= 11; x++) p.px(16 + x, b - 12 - Math.sqrt(Math.max(0, 121 - x * x)) * 0.7, light);
    for (const y of [b - 22, b - 46]) p.rect(16 - leg(y) - 2, y, Math.round(leg(y)) * 2 + 5, 2, iron);
    p.rect(14, b - 87, 5, 3, iron);
    p.rect(16, b - 95, 1, 8, iron);
    p.px(16, b - 96, C.tomato);
    // Lights that take turns to twinkle.
    for (let i = 0; i < 16; i++) {
      if ((i + f) % 2) continue;
      const y = b - 6 - i * 5;
      p.px(16 - leg(y), y, C.butter);
      p.px(16 + leg(y), y - 2, C.butter);
    }
  }, { frames: 2, fps: 2, glow: 1 });
  world('pyramid', 'Great Pyramid', 3, 3, 140000, 24, 12, (p) => {
    const b = p.h;
    const sand = '#d8b878';
    p.rect(0, b - 8, 48, 8, '#e8c88a');
    for (let i = 0; i < 40; i++) p.px((i * 37) % 48, b - 1 - ((i * 19) % 7), '#c8a468');
    const top = b - 58;
    for (let y = top; y < b - 6; y++) {
      const hw = Math.round(((y - top) / (b - 6 - top)) * 24);
      const row = Math.floor((y - top) / 4);
      for (let x = -hw; x < hw; x++) {
        const lit = x < hw * 0.1 + (y - top) * 0.05 - hw * 0.1;
        const seam = (y - top) % 4 === 3 || (x + row * 3 + 400) % 8 === 0;
        p.px(24 + x, y, seam ? (lit ? '#c8a468' : '#a88450') : lit ? '#f0d8a0' : sand);
      }
    }
    // A gold cap and a dark doorway.
    for (let y = top; y < top + 9; y++) {
      const hw = Math.round(((y - top) / (b - 6 - top)) * 24);
      p.rect(24 - hw, y, hw * 2, 1, y < top + 4 ? '#fff0a0' : '#f0c040');
    }
    p.rect(21, b - 16, 6, 10, '#6a4a30');
    p.rect(22, b - 15, 4, 9, C.ink);
    // Palms at its feet.
    for (const [x, h] of [[4, 18], [44, 16]]) {
      p.rect(x, b - h, 2, h - 4, C.cocoa);
      for (const [dx, dy] of [[-5, 1], [-3, -1], [3, -1], [5, 1], [0, -2]]) p.line(x + 1, b - h, x + 1 + dx, b - h + dy + 2, C.leaf);
    }
  });
  world('carousel', 'Carousel', 3, 3, 180000, 26, 20, (p, f) => {
    const b = p.h;
    const cx = 24;
    // Base and a turning floor.
    p.ell(cx, b - 8, 23, 7, '#c8c0ac');
    p.ell(cx, b - 10, 22, 7, '#f4e8d0');
    // Centre column and mirrors.
    p.rect(cx - 7, b - 42, 14, 32, '#d0502e');
    for (let k = 0; k < 3; k++) p.rect(cx - 5 + k * 4, b - 38, 2, 22, C.ice);
    // Horses on poles going round.
    const horse = ['#ffffff', '#f49fb0', '#8ed0e8', '#ffc857', '#a8e0b8', '#d8b8f0'];
    const placed = [];
    for (let k = 0; k < 6; k++) {
      const a = ((k + f / 4) * Math.PI) / 3;
      const x = cx + Math.cos(a) * 15;
      const y = b - 10 + Math.sin(a) * 5;
      placed.push({ x, y, k, up: (k + f) % 2 });
    }
    placed.sort((a, c) => a.y - c.y);
    for (const h of placed) {
      const x = Math.round(h.x);
      const y = Math.round(h.y);
      p.rect(x, b - 42, 1, y - (b - 42), C.butter);
      const c = horse[h.k];
      const by = y - 10 - h.up;
      p.rrect(x - 4, by, 9, 5, c);
      p.rect(x + 3, by - 3, 3, 4, c);
      p.rect(x + 5, by - 2, 2, 2, c);
      p.px(x + 5, by - 2, C.ink);
      p.rect(x - 4, by + 5, 1, 3, c);
      p.rect(x + 4, by + 5, 1, 3, c);
      p.rect(x - 6, by + 1, 2, 3, C.tomato);
      p.rect(x - 1, by, 3, 2, C.tomato);
    }
    // A striped canopy with a chasing row of lights.
    for (let y = 0; y < 14; y++) {
      const hw = Math.round(5 + (y / 13) * 19);
      for (let x = -hw; x < hw; x++) p.px(cx + x, b - 58 + y, Math.floor(((x / (hw + 0.1)) * 6 + 12)) % 2 ? C.tomato : C.cream);
    }
    p.rect(cx - 24, b - 44, 48, 3, C.butter);
    for (let x = cx - 23; x < cx + 24; x += 3) p.px(x, b - 43, (x + f) % 3 ? C.gold : C.white);
    for (let x = cx - 24; x < cx + 24; x += 6) p.ell(x + 3, b - 41, 3, 1, x % 12 ? C.tomato : C.cream);
    p.rect(cx - 1, b - 66, 2, 8, C.gold);
    p.rect(cx + 1, b - 66, 6, 4, C.sky);
    p.disc(cx, b - 59, 2, C.butter);
  }, { frames: 4, fps: 4, glow: 1 });
  world('ferris_wheel', 'Ferris Wheel', 4, 3, 240000, 28, 40, (p, f) => {
    const b = p.h;
    const cx = 32;
    const cy = b - 50;
    const R = 27;
    // Stand.
    p.rect(4, b - 4, 56, 4, '#8f9498');
    p.line(cx - 15, b - 4, cx, cy, C.iron);
    p.line(cx + 15, b - 4, cx, cy, C.iron);
    p.line(cx - 14, b - 4, cx + 1, cy, C.steel);
    p.line(cx + 16, b - 4, cx + 1, cy, C.steel);
    p.rect(cx - 10, b - 22, 21, 2, C.iron);
    // Rim and spokes.
    for (let a = 0; a < 220; a++) {
      const r = (a / 220) * Math.PI * 2;
      p.px(cx + Math.cos(r) * R, cy + Math.sin(r) * R, C.white);
      p.px(cx + Math.cos(r) * (R - 2), cy + Math.sin(r) * (R - 2), '#f0a0c0');
    }
    const cabins = ['#e4572e', '#ffc857', '#6fb36b', '#3f7fb0', '#d0408a', '#f28a2e', '#2fa89a', '#7a5ad0'];
    cabins.forEach((c, k) => {
      const a = ((k + f / 4) * Math.PI) / 4;
      const x = cx + Math.cos(a) * R;
      const y = cy + Math.sin(a) * R;
      p.line(cx, cy, x, y, C.steel);
      if ((k + f) % 2) p.px(cx + Math.cos(a) * (R - 8), cy + Math.sin(a) * (R - 8), C.butter);
    });
    cabins.forEach((c, k) => {
      const a = ((k + f / 4) * Math.PI) / 4;
      const x = Math.round(cx + Math.cos(a) * R);
      const y = Math.round(cy + Math.sin(a) * R);
      // Cabins hang level, whatever the wheel does.
      p.rect(x, y, 1, 2, C.iron);
      p.rrect(x - 4, y + 2, 9, 7, c);
      p.rect(x - 3, y + 3, 7, 3, C.ice);
      p.rect(x - 4, y + 2, 9, 1, T(c, 0.4));
    });
    p.disc(cx, cy, 3, C.butter);
    p.disc(cx, cy, 1, C.tomato);
  }, { frames: 4, fps: 3, glow: 1 });
  WW.FINDS = list.filter((x) => x.find);
  WW.TREASURES = WW.FINDS.filter((x) => x.find === 'treasure');
  WW.JUNK = WW.FINDS.filter((x) => x.find === 'junk');

  // A dearer piece of the same kind always rates higher, and draws more if it draws at all, so the extra price always buys something.
  const byKind = {};
  for (const x of list) if (x.kind !== 'found') (byKind[x.kind] = byKind[x.kind] || []).push(x);
  for (const kind in byKind) {
    let last = null;
    for (const x of byKind[kind].slice().sort((a, b) => a.price - b.price)) {
      if (last && x.price === last.price) x.rating = last.rating;
      else if (last && x.rating <= last.rating) x.rating = last.rating + 1;
      if (last && x.charm && x.price > last.price && x.charm <= last.charm) x.charm = last.charm + 1;
      last = x;
    }
  }

  const canvases = {};
  WW.DECOR = list;
  WW.DECOR_BY_ID = Object.fromEntries(list.map((x) => [x.id, x]));
  WW.DECOR_KINDS = [['table', 'Tables'], ['seat', 'Seats'], ['rug', 'Rugs'], ['plant', 'Plants'], ['light', 'Lights'], ['appliance', 'Kitchen gear'], ['clean', 'Cleaning'], ['fun', 'Fun'], ['attract', 'For shy guests'], ['prestige', 'Prestige'], ['yard', 'Yard']];
  // The canvas is w tiles wide and h tiles deep plus 8 pixels of headroom, feet on the bottom edge. Tall pieces ask for more, and some have frames.
  WW.decorCanvas = function (id, frame = 0) {
    const key = frame ? id + ':' + frame : id;
    if (canvases[key]) return canvases[key];
    const def = WW.DECOR_BY_ID[id];
    const p = new Px(def.w * 16, def.h * 16 + 8 + (def.head || 0));
    def.draw(p, frame);
    p.outline();
    canvases[key] = p.canvas();
    return canvases[key];
  };

  // Walls and floors. Rating follows the price like everything else.
  const style = (n, price, lvl, data) => Object.assign({ n, price, lvl, rating: price ? Math.round(10 + Math.sqrt(price)) : 0 }, data);
  WW.ROOM_STYLES = {
    wall: {
      teal: style('Teal Stripe', 0, 1, { base: '#3f8a86', stripe: '#478f8a', dot: '#5fa59e', panel: '#8a5a3c', panel2: '#7a4f33', rail: '#5a3a2a' }),
      rose: style('Rose Stripe', 500, 2, { base: '#c96a78', stripe: '#d27a86', dot: '#f0b4bc', panel: '#6d4535', panel2: '#5e3a2c', rail: '#4a2c28' }),
      mustard: style('Mustard Paper', 700, 3, { base: '#d9a83f', stripe: '#e0b450', dot: '#f4d88a', panel: '#7a4f33', panel2: '#6a432a', rail: '#4a2f22' }),
      mint: style('Mint Check', 1000, 4, { base: '#8fcfae', stripe: '#a0dabc', dot: '#d5f0e0', panel: '#c9a06a', panel2: '#b08850', rail: '#7a5a3c' }),
      plum: style('Plum Velvet', 1600, 5, { base: '#5b3a6e', stripe: '#65437a', dot: '#8a6aa0', panel: '#3a2340', panel2: '#2f1c36', rail: '#22142a' }),
      brick: style('Old Brick', 2400, 7, { base: '#a8513e', stripe: '#b55c48', dot: '#c97a64', panel: '#5a3a2a', panel2: '#4a2f22', rail: '#2f1e18' }),
      sky: style('Sky and Clouds', 3600, 9, { base: '#7cc4e4', stripe: '#88cce8', dot: '#ffffff', panel: '#fff1d6', panel2: '#e8d4b0', rail: '#b09870' }),
      night: style('Starry Night', 6000, 12, { base: '#26305e', stripe: '#2c3768', dot: '#ffdd4a', panel: '#1f4f66', panel2: '#1a4358', rail: '#142f40' }),
    },
    floor: {
      oak: style('Oak Planks', 0, 1, { kind: 'planks', c: ['#c98f5a', '#bf8550', '#d09a66', '#c48a55'], seam: '#a87040' }),
      birch: style('Birch Planks', 500, 2, { kind: 'planks', c: ['#e8cf9e', '#e0c590', '#efd8aa', '#e4ca96'], seam: '#c4a870' }),
      walnut: style('Walnut Planks', 900, 3, { kind: 'planks', c: ['#7a4f33', '#6d452c', '#85583a', '#734a30'], seam: '#54331f' }),
      check: style('Red Check Lino', 1400, 4, { kind: 'check', a: '#e4674a', b: '#f4e6c6' }),
      mono: style('Black and White Tile', 2000, 6, { kind: 'check', a: '#3d3440', b: '#f4f0e6' }),
      terrazzo: style('Terrazzo', 3200, 8, { kind: 'terrazzo', a: '#e8e0d0', specks: ['#c96a78', '#3f8a86', '#d9a83f', '#5b3a6e'] }),
      moss: style('Moss Carpet', 5000, 10, { kind: 'carpet', a: '#6fae68', b: '#649f5e' }),
      royal: style('Royal Carpet', 8000, 13, { kind: 'carpet', a: '#a0304a', b: '#8f2a42' }),
    },
    kitchen: {
      cream: style('Cream Check', 0, 1, { a: '#f4e6c6', b: '#d8c49c', edge: '#a89470' }),
      mono: style('Diner Tile', 800, 3, { a: '#f4f0e6', b: '#3d3440', edge: '#22142a' }),
      terracotta: style('Terracotta', 1200, 5, { a: '#d98c5f', b: '#c47a50', edge: '#8a5236' }),
      blue: style('Blue Tile', 1800, 7, { a: '#cfe8f0', b: '#7cb0cc', edge: '#3f6f8a' }),
      steel: style('Steel Plate', 3000, 10, { a: '#b8c0c8', b: '#a0aab4', edge: '#5e6a78' }),
    },
  };
})((globalThis.WW = globalThis.WW || {}));
