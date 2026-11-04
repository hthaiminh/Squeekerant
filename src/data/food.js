// Flavours, ingredients and recipes. Every ingredient is named safe for hamsters in at least one
// published care guide (PetMD, Chewy, Woodgreen, Burgess, or the Squeektoshi care policy), small amounts, plain.
(function (WW) {
  // Each flavour is a colour and a note: tasting a dish draws and plays them.
  WW.FLAVOURS = {
    sweet: { n: 'Sweet', c: '#f0709a', note: 523.25 },
    tangy: { n: 'Tangy', c: '#e8b820', note: 587.33 },
    fresh: { n: 'Fresh', c: '#4fb86a', note: 659.25 },
    earthy: { n: 'Earthy', c: '#a4663a', note: 392.0 },
    nutty: { n: 'Nutty', c: '#d0963a', note: 440.0 },
    savory: { n: 'Savory', c: '#d9502c', note: 329.63 },
  };

  const I = (id, n, tier, a, b, price, col, note) => ({ id, n, tier, fl: [a, b], price, col, note });
  WW.INGREDIENTS = [
    I('romaine', 'Romaine', 1, 'fresh', 'earthy', 7, '#7cc36a', 'Romaine only, never iceberg.'),
    I('cucumber', 'Cucumber', 1, 'fresh', 'sweet', 7, '#6fb36b', 'A thin washed slice.'),
    I('parsley', 'Parsley', 1, 'fresh', 'earthy', 6, '#4f9f5a', 'A small washed sprig.'),
    I('basil', 'Basil', 1, 'fresh', 'sweet', 8, '#3f8f4a', 'A small washed leaf.'),
    I('dandelion', 'Dandelion', 1, 'fresh', 'tangy', 8, '#a8c84a', 'Clean greens, never from a sprayed lawn.'),
    I('carrot', 'Carrot', 1, 'sweet', 'earthy', 8, '#f28a2e', 'An occasional treat. Carrots are sugary.'),
    I('peas', 'Garden Peas', 1, 'sweet', 'fresh', 8, '#8fd06a', 'A small amount.'),
    I('oats', 'Rolled Oats', 1, 'nutty', 'earthy', 7, '#e8d0a0', 'Rolled flakes. Whole oats can hurt cheek pouches.'),
    I('broccoli', 'Broccoli', 2, 'earthy', 'fresh', 20, '#3f9f5a', 'A small washed piece.'),
    I('zucchini', 'Courgette', 2, 'fresh', 'earthy', 20, '#5f9f4a', 'A small washed slice.'),
    I('sweetpotato', 'Sweet Potato', 2, 'sweet', 'earthy', 22, '#d9662e', 'Sweet potato only. Regular potato is unsafe.'),
    I('parsnip', 'Parsnip', 2, 'earthy', 'sweet', 22, '#efe1b0', 'Raw or cooked, plain.'),
    I('beans', 'Green Beans', 2, 'fresh', 'earthy', 20, '#6fae3a', 'Raw or lightly cooked, plain.'),
    I('pepper', 'Sweet Pepper', 2, 'sweet', 'tangy', 24, '#e4372e', 'Sweet peppers only, never spicy ones.'),
    I('millet', 'Millet', 2, 'nutty', 'sweet', 24, '#e8c04a', 'A small treat, not a meal.'),
    I('cauliflower', 'Cauliflower', 2, 'earthy', 'nutty', 24, '#fff1d6', 'Floret only, no leaves.'),
    I('apple', 'Apple', 3, 'sweet', 'tangy', 70, '#e4372e', 'Remove the seeds. They are toxic.'),
    I('pear', 'Pear', 3, 'sweet', 'fresh', 70, '#c9d04a', 'Remove the seeds. They are toxic.'),
    I('strawberry', 'Strawberry', 3, 'sweet', 'tangy', 80, '#e8304a', 'A tiny washed piece.'),
    I('blueberry', 'Blueberry', 3, 'tangy', 'sweet', 80, '#4a5fc0', 'A tiny washed piece.'),
    I('blackberry', 'Blackberry', 3, 'tangy', 'earthy', 85, '#4a2f6a', 'A tiny washed piece.'),
    I('peach', 'Peach', 3, 'sweet', 'tangy', 85, '#f7a06a', 'Remove the pit. It is toxic.'),
    I('mango', 'Mango', 3, 'sweet', 'tangy', 90, '#f2b02e', 'A tiny piece, no pit.'),
    I('banana', 'Banana', 3, 'sweet', 'nutty', 80, '#ffdd4a', 'A tiny piece. Bananas are sugary.'),
    I('watermelon', 'Watermelon', 3, 'sweet', 'fresh', 65, '#f0505a', 'A tiny piece, no rind or seeds.'),
    I('sunflower', 'Sunflower Seeds', 4, 'nutty', 'savory', 180, '#5a4a4a', 'Plain and unsalted, an occasional treat.'),
    I('pumpkinseed', 'Pumpkin Seeds', 4, 'nutty', 'earthy', 180, '#8fa85a', 'Plain and unsalted, an occasional treat.'),
    I('tofu', 'Tofu', 4, 'savory', 'fresh', 195, '#fff8e0', 'Plain, a very small amount.'),
    I('mealworm', 'Dried Mealworms', 4, 'savory', 'nutty', 225, '#c9a050', 'Dried, one or two at a time.'),
    I('egg', 'Boiled Egg', 4, 'savory', 'nutty', 225, '#fff4d0', 'Plain, a very small amount.'),
    I('chicken', 'Plain Chicken', 4, 'savory', 'earthy', 255, '#e8c8a0', 'Cooked and unseasoned, a very small amount.'),
  ];
  WW.INGREDIENT = Object.fromEntries(WW.INGREDIENTS.map((i) => [i.id, i]));

  // id, name, station, how long, portions, price per portion, ingredients, art shape, level it can be found from
  // need is minutes on the stove, wheel passes on the wok, sleeping rounds in the pot.
  // Ingredients come to a quarter to a half of what a batch sells for at menu price, before tips. The better the dish, the thinner the margin.
  const R = (id, n, st, need, y, p, ing, shape, lvl) => ({ id, n, st, need, y, p, ing, shape, lvl: lvl || 1 });
  WW.DISHES = [
    // Stove: real time, works whatever the hamster is doing.
    R('carrot_coins', 'Carrot Coins', 'stove', 5, 18, 4, { carrot: 2 }, 'coins', 1),
    R('cucumber_boats', 'Cucumber Boats', 'stove', 5, 16, 5, { cucumber: 2, parsley: 1 }, 'plate', 1),
    R('pea_pancakes', 'Pea Pancakes', 'stove', 15, 30, 4, { peas: 3, oats: 1 }, 'coins', 1),
    R('romaine_wraps', 'Romaine Wraps', 'stove', 15, 32, 4, { romaine: 3, carrot: 2 }, 'wrap', 1),
    R('oat_biscuits', 'Oat Biscuits', 'stove', 30, 54, 4, { oats: 8 }, 'coins', 1),
    R('basil_bites', 'Basil Bites', 'stove', 30, 50, 5, { basil: 4, oats: 5 }, 'cubes', 2),
    R('melon_cubes', 'Melon Cubes', 'stove', 15, 28, 6, { watermelon: 1 }, 'cubes', 4),
    R('millet_cakes', 'Millet Cakes', 'stove', 60, 84, 5, { millet: 5 }, 'tart', 3),
    R('sweet_chips', 'Sweet Potato Chips', 'stove', 60, 88, 5, { sweetpotato: 6 }, 'plate', 3),
    R('banana_coins', 'Banana Coins', 'stove', 30, 56, 7, { banana: 2, oats: 2 }, 'coins', 5),
    R('mango_mash', 'Mango Mash', 'stove', 60, 90, 8, { mango: 2, banana: 2 }, 'bowl', 6),
    R('apple_crisp', 'Apple Crisp', 'stove', 120, 130, 7, { apple: 5, oats: 6 }, 'tart', 5),
    R('berry_tart', 'Berry Tart', 'stove', 120, 130, 8, { strawberry: 3, blueberry: 3, oats: 4 }, 'tart', 6),
    R('peach_pockets', 'Peach Pockets', 'stove', 240, 200, 8, { peach: 6, oats: 8, millet: 4 }, 'wrap', 7),
    R('seed_bar', 'Seed Bars, No Sugar', 'stove', 240, 190, 11, { sunflower: 3, pumpkinseed: 2, oats: 10 }, 'cubes', 8),
    R('egg_toast', 'Egg on Oat Toast', 'stove', 360, 260, 10, { egg: 5, oats: 14 }, 'plate', 9),

    // Wok: cooks only on real wheel passes, so it waits while he sleeps.
    R('tossed_peas', 'Tossed Peas', 'wok', 200, 32, 5, { peas: 5 }, 'plate', 1),
    R('seared_romaine', 'Seared Romaine', 'wok', 300, 42, 5, { romaine: 6, basil: 2 }, 'plate', 1),
    R('courgette_ribbons', 'Courgette Ribbons', 'wok', 500, 60, 5, { zucchini: 5 }, 'wrap', 2),
    R('bean_fry', 'Green Bean Fry', 'wok', 600, 70, 6, { beans: 6, parsley: 2 }, 'plate', 2),
    R('broccoli_toss', 'Broccoli Toss', 'wok', 800, 86, 6, { broccoli: 8, carrot: 3 }, 'plate', 3),
    R('pepper_stir', 'Sweet Pepper Stir', 'wok', 1000, 104, 7, { pepper: 8, beans: 3 }, 'bowl', 4),
    R('cauli_steaks', 'Cauliflower Steaks', 'wok', 1500, 136, 8, { cauliflower: 12 }, 'plate', 5),
    R('seared_tofu', 'Seared Tofu', 'wok', 2000, 165, 10, { tofu: 3, broccoli: 6 }, 'cubes', 7),
    R('egg_ribbons', 'Egg Ribbon Stir', 'wok', 2500, 190, 10, { egg: 3, peas: 10, carrot: 10 }, 'bowl', 8),
    R('worm_crunch', 'Mealworm Crunch', 'wok', 3000, 215, 11, { mealworm: 5, oats: 10 }, 'plate', 9),
    R('chicken_toss', 'Chicken Toss', 'wok', 4000, 265, 12, { chicken: 5, pepper: 12 }, 'bowl', 10),
    R('full_wheel', 'Full Wheel Stir', 'wok', 8000, 430, 13, { broccoli: 16, pepper: 16, tofu: 12 }, 'bowl', 11),

    // Pot: cooks only on rounds with no wheel passes, so it finishes while he sleeps.
    R('oat_porridge', 'Oat Porridge', 'pot', 6, 36, 5, { oats: 8 }, 'bowl', 1),
    R('carrot_soup', 'Carrot Soup', 'pot', 12, 56, 5, { carrot: 10, parsley: 2 }, 'bowl', 1),
    R('sweet_mash', 'Sweet Potato Mash', 'pot', 18, 76, 6, { sweetpotato: 6 }, 'bowl', 2),
    R('sleepy_stew', 'Sleepy Stew', 'pot', 24, 96, 6, { parsnip: 5, carrot: 6, oats: 6 }, 'pot', 2),
    R('millet_congee', 'Millet Congee', 'pot', 30, 116, 7, { millet: 10, peas: 5 }, 'bowl', 3),
    R('green_bean_pot', 'Green Bean Pot', 'pot', 30, 116, 7, { beans: 9, parsnip: 4 }, 'pot', 4),
    R('pear_compote', 'Moonlit Pear Compote', 'pot', 36, 130, 8, { pear: 7 }, 'bowl', 5),
    R('steamed_egg', 'Steamed Egg', 'pot', 36, 130, 9, { egg: 2, millet: 5 }, 'pot', 7),
    R('broccoli_soup', 'Broccoli Soup', 'pot', 40, 150, 8, { broccoli: 14, cauliflower: 6 }, 'bowl', 5),
    R('apple_spread', 'Slow Apple Spread', 'pot', 48, 180, 9, { apple: 8, banana: 3 }, 'bowl', 6),
    R('blackberry_jam', 'Blackberry Jam, No Sugar', 'pot', 48, 180, 10, { blackberry: 10 }, 'bowl', 7),
    R('tofu_soup', 'Silken Tofu Soup', 'pot', 48, 185, 11, { tofu: 4, romaine: 10, basil: 8 }, 'bowl', 8),
    R('chicken_broth', 'Chicken Broth', 'pot', 60, 230, 12, { chicken: 5, carrot: 10, parsley: 6 }, 'pot', 9),
    R('hundred_stew', 'Hundred Round Stew', 'pot', 100, 360, 14, { chicken: 8, parsnip: 10, sweetpotato: 10 }, 'pot', 11),
  ];
  // Flavours of a dish come from what is in it, most used first.
  for (const d of WW.DISHES) {
    const score = {};
    for (const id in d.ing) {
      const ing = WW.INGREDIENT[id];
      score[ing.fl[0]] = (score[ing.fl[0]] || 0) + 3 * d.ing[id];
      score[ing.fl[1]] = (score[ing.fl[1]] || 0) + 1 * d.ing[id];
    }
    d.fl = Object.keys(score).sort((a, b) => score[b] - score[a]).slice(0, 2);
  }
  WW.DISH = Object.fromEntries(WW.DISHES.map((d) => [d.id, d]));
  WW.STARTER_DISHES = ['carrot_coins', 'tossed_peas', 'oat_porridge'];

  // Dreams: one of these on every long sleep, picked by the hash of the round he woke on.
  WW.DREAMS = [
    ['Cloud Oats', 'bowl', { oats: 6 }],
    ['Moonbeam Pear', 'tart', { pear: 2, oats: 3 }],
    ['Stardust Millet', 'bowl', { millet: 4 }],
    ['Pillow Dumplings', 'wrap', { romaine: 4, oats: 4 }],
    ['Midnight Berry Bowl', 'bowl', { blueberry: 2, blackberry: 1 }],
    ['Snore Soup', 'pot', { parsnip: 3, carrot: 4 }],
    ['Nest Porridge', 'pot', { oats: 5, millet: 3 }],
    ['Curled Carrot Dream', 'plate', { carrot: 6, basil: 3 }],
    ['Feather Tofu', 'cubes', { tofu: 1, parsley: 4 }],
    ['Lullaby Broth', 'pot', { chicken: 1, parsley: 4 }],
    ['Sleepwalker Salad', 'plate', { cucumber: 5, peas: 3, dandelion: 3 }],
    ['Yawn Buns', 'coins', { oats: 6, peas: 3 }],
    ['Nap Cake', 'tart', { banana: 2, oats: 5 }],
    ['Blanket Wrap', 'wrap', { romaine: 5, sweetpotato: 3 }],
    ['Twitching Whisker Stir', 'bowl', { beans: 3, pepper: 3 }],
    ['Slumber Peach', 'tart', { peach: 2, millet: 2 }],
    ['Drowsy Blueberry Cups', 'cubes', { blueberry: 3 }],
    ['Soft Snow Cauliflower', 'plate', { cauliflower: 5, basil: 3 }],
    ['Hibernation Hotpot', 'pot', { broccoli: 4, sweetpotato: 3, egg: 1 }],
    ['Far Away Mango', 'bowl', { mango: 2, strawberry: 1 }],
    ['Warm Burrow Stew', 'pot', { parsnip: 4, beans: 3 }],
    ['Falling Star Seeds', 'cubes', { sunflower: 1, pumpkinseed: 1 }],
    ['The Same Dream Again', 'coins', { carrot: 5, oats: 4 }],
    ['Wheel Stops Turning', 'bowl', { apple: 2, pear: 2 }],
  ];

})((globalThis.WW = globalThis.WW || {}));
