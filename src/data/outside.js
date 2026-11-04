// The world outside the restaurant: where things stand, the seasons, the weather, and what a building can look like.
(function (WW) {
  const TILE = 16;
  // A wide forest that fills any screen. Rows 15 and 16 are the road. The branches to each door run down rows 13 and 14.
  const MID = 20;
  const OUTSIDE = {
    TILE,
    W: 1056,
    H: 416,
    cols: 66,
    rows: 26,
    SKY: 64,
    ROAD_Y: 256,
    DOOR: { x: 528, y: 208 },
    MARKET: { x: 326, y: 108, w: 116, h: 100, door: 384 },
    SHOP: { x: 616, y: 92, w: 112, h: 116, door: 672 },
    TREE: { x: 404, y: 194, w: 40, h: 44 },
    BOARD: { x: 468, y: 212, w: 24, h: 26 },
    MAILBOX: { x: 560, y: 214, w: 16, h: 24 },
    SHELF: { x: 578, y: 214, w: 30, h: 24 },
    GATE: { x: 706, y: 222, w: 28, h: 44 },
    RANKS: { x: 226, y: 132, w: 96, h: 106, door: 274 },
  };
  // Lamp posts along the road, for the night.
  OUTSIDE.LAMPS = [[344, 238], [460, 238], [598, 238], [692, 276], [440, 276], [620, 276], [60, 238], [200, 238], [130, 276], [270, 276], [790, 238], [930, 238], [860, 276], [1000, 276]];
  const LAMP_TILES = OUTSIDE.LAMPS.map(([x, y]) => Math.floor(x / TILE) + ',' + Math.floor(y / TILE));
  const PATH_COLS = [3, 4, 12, 13, 21, 22];
  const PROP_COLS = [5, 6, 7, 9, 10, 15, 16, 17];
  // Tiles where yard pieces can stand: the lawns either side, the strip in front of the buildings, and everything below the road.
  OUTSIDE.free = function (col, row) {
    if (col < 1 || col > 64 || row < 8 || row > 23 || row === 15 || row === 16) return false;
    if (LAMP_TILES.includes(col + ',' + row)) return false;
    if (row > 14 || col <= 13 || col >= 46) return true;
    if (row < 13 || col < MID + 1 || col > MID + 23) return false;
    return !PATH_COLS.includes(col - MID) && !PROP_COLS.includes(col - MID);
  };
  OUTSIDE.MID = MID;
  WW.OUTSIDE = OUTSIDE;

  // Skirting Street: two lanes through the same forest, with signposts in the middle where every screen can see them.
  const LANES = [181, 331];
  const flatMap = (rows, fn) => rows.reduce((out, row) => out.concat(fn(row)), []);
  WW.STREET = {
    W: 1056,
    H: 416,
    SKY: 40,
    LANES,
    lots: flatMap(LANES, (lane) => [318, 528, 738].map((x) => ({ x, y: lane - 21 }))),
    LAMPS: flatMap(LANES, (lane) => [232, 423, 633, 846].map((x) => [x, lane - 10])),
    GATE: { x: 408, y: 198, w: 28, h: 44 },
    NEXT: { x: 620, y: 198, w: 28, h: 44 },
    MOVES: 3,
  };

  // A year on the street is four weeks. fl is the flavour guests want more of, weather the odds of each kind.
  WW.SEASON_DAYS = 7;
  WW.SEASONS = {
    spring: { n: 'Spring', fl: 'fresh', weather: [['clear', 0.4], ['cloudy', 0.2], ['rain', 0.2], ['petals', 0.2]] },
    summer: { n: 'Summer', fl: 'tangy', weather: [['clear', 0.55], ['cloudy', 0.15], ['rain', 0.2], ['storm', 0.1]] },
    autumn: { n: 'Autumn', fl: 'nutty', weather: [['clear', 0.35], ['cloudy', 0.2], ['rain', 0.15], ['leaves', 0.2], ['fog', 0.1]] },
    winter: { n: 'Winter', fl: 'savory', weather: [['clear', 0.25], ['cloudy', 0.25], ['snow', 0.4], ['fog', 0.1]] },
  };
  // Bad weather keeps guests in their seats a little longer, and they tip for it.
  WW.WEATHER = {
    clear: { n: 'Clear', tips: 0, icon: 'sun' },
    cloudy: { n: 'Cloudy', tips: 0, icon: 'cloud' },
    rain: { n: 'Rain', tips: 0.05, icon: 'rain' },
    storm: { n: 'Storm', tips: 0.1, icon: 'storm' },
    fog: { n: 'Fog', tips: 0.02, icon: 'fog' },
    snow: { n: 'Snow', tips: 0.08, icon: 'snow' },
    petals: { n: 'Falling Petals', tips: 0.03, icon: 'petal' },
    leaves: { n: 'Falling Leaves', tips: 0.03, icon: 'leaf' },
  };

  // What the building can look like from outside, part by part. Rating and charm follow the price, and any part goes with any other.
  const part = (n, price, lvl) => ({ n, price, lvl, rating: price ? Math.round(10 + Math.sqrt(price)) : 0, charm: price ? Math.round(Math.sqrt(price)) : 0 });
  const parts = (rows) => Object.fromEntries(rows.map(([id, n, price, lvl]) => [id, part(n, price, lvl)]));
  WW.EXTERIOR = {
    wall: parts([
      ['plaster', 'Cream Plaster', 0, 1],
      ['felt', 'Painted Felt', 300, 2],
      ['clapboard', 'White Clapboard', 450, 2],
      ['planks', 'Painted Planks', 600, 2],
      ['earth', 'Patterned Earth', 900, 3],
      ['rose', 'Rose Planks', 1200, 3],
      ['logs', 'Log Cabin', 2200, 5],
      ['alpine', 'Timber on Stone', 2900, 5],
      ['tudor', 'Half Timber', 3600, 6],
      ['brick', 'Red Brick', 4500, 8],
      ['hanok', 'White Walls and Dark Posts', 6000, 8],
      ['lattice', 'Dark Wood Lattice', 7500, 9],
      ['stone', 'River Stone', 9000, 10],
      ['mustard', 'Old Town Mustard', 11000, 10],
      ['whitewash', 'Island Whitewash', 14000, 11],
      ['adobe', 'Warm Adobe', 18000, 12],
      ['sandstone', 'Sandstone and Mosaic', 24000, 14],
      ['staves', 'Tarred Staves', 30000, 15],
      ['kremlin', 'Red Brick and White Arches', 38000, 16],
      ['lacquer', 'Red Lacquer Pillars', 48000, 17],
      ['blocks', 'Castle Stone', 60000, 19],
      ['marble', 'Inlaid Marble', 80000, 21],
      ['goldleaf', 'Gold Leaf', 110000, 24],
    ]),
    roof: parts([
      ['thatch', 'Straw Thatch', 0, 1],
      ['felt', 'Felt Dome', 500, 2],
      ['red', 'Red Tiles', 800, 2],
      ['shingle', 'Grey Shingles', 1300, 3],
      ['blue', 'Blue Slate', 2000, 4],
      ['deep', 'Deep Thatch', 2800, 4],
      ['moss', 'Mossy Shingles', 4000, 6],
      ['wide', 'Wide Carved Eaves', 5500, 7],
      ['steep', 'Steep Brown Tiles', 7000, 8],
      ['giwa', 'Curved Grey Tiles', 9000, 9],
      ['oldtile', 'Old Mossy Clay', 12000, 10],
      ['terrace', 'Railed Terrace', 15000, 11],
      ['barrel', 'Terracotta Barrel Tiles', 18000, 12],
      ['gold', 'Gilded Shingles', 22000, 13],
      ['stepped', 'Stepped Gables', 26000, 14],
      ['battlement', 'Battlements', 30000, 15],
      ['greentile', 'Green Glazed Pyramid', 38000, 16],
      ['tarred', 'Dragon Shingles', 48000, 17],
      ['temple', 'Tiered Temple Roof', 65000, 19],
      ['pavilion', 'Sweeping Pavilion Roof', 80000, 21],
      ['golden', 'Golden Glazed Eaves', 100000, 23],
    ]),
    crown: parts([
      ['none', 'Bare Roof', 0, 1],
      ['vane', 'Weather Vane', 350, 2],
      ['chimney', 'Smoking Chimney', 1300, 4],
      ['dormer', 'Dormer Window', 2200, 5],
      ['bell', 'Bell Gable', 4500, 7],
      ['dome', 'Blue Dome', 9000, 9],
      ['turret', 'Clock Turret', 13000, 11],
      ['hall', 'Upper Hall', 18000, 12],
      ['spire', 'Golden Spire', 26000, 14],
      ['tiers', 'Stacked Shingle Tiers', 36000, 15],
      ['goldhall', 'Golden Upper Hall', 52000, 17],
      ['keep', 'Castle Keep', 70000, 19],
      ['onions', 'Onion Domes', 90000, 21],
      ['whitedome', 'Great White Dome', 120000, 23],
      ['phoenix', 'Phoenix Pavilion', 160000, 26],
    ]),
    awning: parts([
      ['none', 'No Awning', 0, 1],
      ['red', 'Red Stripes', 400, 2],
      ['blue', 'Blue Stripes', 900, 3],
      ['green', 'Green Stripes', 1600, 4],
      ['scallop', 'Scalloped Canvas', 2400, 5],
      ['porch', 'Front Porch', 3400, 6],
      ['skirt', 'Tiled Skirt Roof', 5000, 8],
      ['gold', 'Gold and Plum', 6500, 9],
      ['frieze', 'Painted Frieze', 9000, 10],
      ['arcade', 'Arched Arcade', 16000, 12],
      ['silk', 'Silk Canopy', 28000, 15],
      ['brackets', 'Gilded Brackets', 45000, 18],
    ]),
    windows: parts([
      ['pane', 'Plain Panes', 0, 1],
      ['white', 'White Sashes', 300, 2],
      ['shutters', 'Green Shutters', 700, 3],
      ['round', 'Round Portholes', 1200, 4],
      ['diamond', 'Leaded Diamonds', 2500, 5],
      ['paper', 'Paper Lattice', 4500, 7],
      ['louvre', 'Teal Louvres', 7000, 9],
      ['woodarch', 'Wooden Arches', 10000, 10],
      ['bluearch', 'Blue Arches', 14000, 11],
      ['keyhole', 'Carved Screens', 22000, 14],
      ['goldlattice', 'Gold Lattice', 34000, 16],
      ['templearch', 'Temple Arches', 48000, 18],
      ['inlaid', 'Inlaid Arches', 65000, 20],
      ['stained', 'Stained Glass', 85000, 22],
    ]),
    door: parts([
      ['plank', 'Plank Door', 0, 1],
      ['blue', 'Blue Door', 350, 2],
      ['painted', 'Painted Orange Door', 700, 3],
      ['green', 'Green Door', 1100, 4],
      ['teal', 'Teal Door', 2000, 5],
      ['paperdoor', 'Paper Sliding Doors', 3500, 6],
      ['noren', 'Door Curtain', 5500, 7],
      ['wood', 'Arched Oak Door', 8000, 8],
      ['bluearch', 'Blue Arched Door', 13000, 11],
      ['horseshoe', 'Horseshoe Arch', 20000, 13],
      ['portcullis', 'Portcullis Gate', 28000, 15],
      ['studded', 'Studded Red Door', 40000, 17],
      ['goldarch', 'Golden Arch', 60000, 20],
    ]),
    base: parts([
      ['none', 'Bare Ground', 0, 1],
      ['fieldstone', 'Fieldstone Footing', 1500, 4],
      ['deck', 'Wooden Deck', 2800, 5],
      ['tile', 'Painted Tile Band', 9000, 10],
      ['water', 'Still Water', 20000, 13],
      ['marble', 'Marble Terrace', 40000, 17],
      ['giltmarble', 'Gilded Terrace', 80000, 22],
    ]),
    balcony: parts([
      ['none', 'No Balcony', 0, 1],
      ['flowers', 'Flower Balcony', 3000, 5],
      ['wood', 'Carved Wood Balcony', 6000, 8],
      ['iron', 'Wrought Iron Balcony', 10000, 10],
      ['blue', 'Blue Railed Balcony', 16000, 12],
      ['gallery', 'Golden Gallery', 42000, 18],
    ]),
    towers: parts([
      ['none', 'No Towers', 0, 1],
      ['bamboo', 'Bamboo Clumps', 1200, 3],
      ['palms', 'Potted Palms', 2400, 5],
      ['belltower', 'Bell Tower', 12000, 11],
      ['round', 'Round Stone Towers', 30000, 15],
      ['minarets', 'Slim Minarets', 50000, 19],
      ['onion', 'Onion Towers', 70000, 21],
      ['pagoda', 'Pagoda Towers', 95000, 23],
    ]),
    trim: parts([
      ['none', 'Plain', 0, 1],
      ['flowers', 'Window Flower Boxes', 500, 2],
      ['ivy', 'Climbing Ivy', 1500, 4],
      ['lights', 'String Lights', 2800, 6],
      ['banner', 'Festival Pennants', 7000, 9],
      ['silk', 'Silk Lanterns', 11000, 10],
      ['paperflags', 'Paper Flags', 15000, 12],
      ['vines', 'Bougainvillea', 20000, 13],
      ['redlanterns', 'Red Lanterns', 30000, 15],
      ['garlands', 'Gilded Garlands', 60000, 20],
    ]),
    sign: parts([
      ['none', 'No Sign', 0, 1],
      ['board', 'Painted Board', 600, 2],
      ['hanging', 'Hanging Inn Sign', 2500, 5],
      ['neon', 'Neon Sign', 8000, 9],
      ['banner', 'Long Banner', 14000, 11],
      ['plaque', 'Gold Plaque', 25000, 14],
      ['marquee', 'Light Bulb Marquee', 60000, 20],
    ]),
  };
  WW.EXTERIOR_SLOTS = [['wall', 'Walls'], ['roof', 'Roof'], ['crown', 'Roof top'], ['awning', 'Awning'], ['windows', 'Windows'], ['door', 'Door'], ['base', 'Foundation'], ['balcony', 'Balcony'], ['towers', 'Towers'], ['trim', 'Trim'], ['sign', 'Sign']];
  // Everyone starts with the first of each.
  WW.EXTERIOR_DEFAULT = Object.fromEntries(Object.keys(WW.EXTERIOR).map((slot) => [slot, Object.keys(WW.EXTERIOR[slot])[0]]));
  // Neighbours dress their buildings with a sense of style. Players mix parts however they like.
  WW.HOUSE_LOOKS = [
    {},
    { wall: 'planks', roof: 'red', awning: 'red', trim: 'flowers', door: 'blue' },
    { wall: 'felt', roof: 'felt', door: 'painted' },
    { wall: 'earth', roof: 'deep' },
    { wall: 'clapboard', roof: 'shingle', crown: 'dormer', awning: 'porch', windows: 'white', door: 'blue' },
    { wall: 'logs', roof: 'moss', crown: 'chimney', windows: 'shutters', door: 'green' },
    { wall: 'alpine', roof: 'wide', balcony: 'flowers', windows: 'shutters', door: 'teal' },
    { wall: 'tudor', roof: 'steep', crown: 'chimney', windows: 'diamond', door: 'wood', sign: 'hanging' },
    { wall: 'hanok', roof: 'giwa', awning: 'frieze', windows: 'paper', door: 'paperdoor', base: 'fieldstone' },
    { wall: 'lattice', roof: 'giwa', awning: 'skirt', windows: 'paper', door: 'noren' },
    { wall: 'mustard', roof: 'oldtile', balcony: 'wood', windows: 'louvre', door: 'teal', trim: 'silk' },
    { wall: 'brick', roof: 'stepped', windows: 'white', door: 'green', trim: 'flowers' },
    { wall: 'whitewash', roof: 'terrace', crown: 'dome', windows: 'bluearch', door: 'bluearch', trim: 'vines' },
    { wall: 'adobe', roof: 'barrel', towers: 'belltower', awning: 'arcade', windows: 'woodarch', door: 'wood', base: 'tile', trim: 'paperflags' },
    { wall: 'sandstone', roof: 'greentile', windows: 'keyhole', door: 'horseshoe' },
    { wall: 'staves', roof: 'tarred', crown: 'tiers', windows: 'woodarch', door: 'wood' },
    { wall: 'lacquer', roof: 'golden', crown: 'goldhall', awning: 'brackets', windows: 'goldlattice', door: 'studded', base: 'marble', trim: 'redlanterns' },
    { wall: 'whitewash', roof: 'temple', crown: 'spire', windows: 'templearch', door: 'goldarch', base: 'marble' },
    { wall: 'kremlin', roof: 'battlement', crown: 'onions', windows: 'woodarch', door: 'wood' },
    { wall: 'blocks', roof: 'battlement', crown: 'keep', towers: 'round', windows: 'woodarch', door: 'portcullis', sign: 'banner' },
    { wall: 'marble', roof: 'terrace', crown: 'whitedome', towers: 'minarets', windows: 'inlaid', door: 'goldarch', base: 'giltmarble' },
    { wall: 'hanok', roof: 'pavilion', crown: 'phoenix', windows: 'paper', door: 'studded', base: 'water' },
  ];
})((globalThis.WW = globalThis.WW || {}));
