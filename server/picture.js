// Shared pictures, painted here by the game's own painters from the same plain data the game paints from.
// Nothing a player sends is ever shown as it came: the game's own check keeps only its own pieces,
// and the two names go through the leaderboard's rules on top. Only loaded by the picture routes.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const { cleanName } = require('./rules');

// vercel.json puts all of src in the function, these files and the fonts included.
const SRC = path.join(__dirname, '..', 'src');
const FONT_DIR = path.join(SRC, 'fonts');
// What the pictures need from the game, in the build's own order. A test keeps it that way.
const FILES = ['core/rng.js', 'art/px.js', 'data/animals.js', 'data/food.js', 'data/outside.js', 'data/decor.js', 'art/animals.js', 'art/food.js', 'art/hamster.js', 'art/scene.js', 'art/outside.js', 'art/houses.js', 'art/logo.js', 'core/feed.js', 'core/engine.js', 'ui/panels.js', 'ui/scene.js', 'ui/share.js'];
// The same three fonts the page loads, under the same names, written the way the page's style sheet writes them.
const FONT_FILES = [
  ['PixelifySans-Bold.ttf', 'Pixelify Sans'],
  ['Jersey20-Regular.ttf', 'Jersey 20'],
  ['VT323-Regular.ttf', 'VT323'],
];
// The server has no other fonts, so VT323 in each list is what writes the letters the other two lack, the same as on the page.
const FONTS = {
  head: "'Pixelify Sans', 'VT323', 'Courier New', monospace",
  display: "'Jersey 20', 'Pixelify Sans', 'VT323', 'Courier New', monospace",
  body: "'VT323', 'Courier New', monospace",
};
const MOST_BYTES = 100000;
const KEEP_PAINTED = 30;

let world = null;
function game() {
  if (world) return world;
  const { createCanvas, GlobalFonts, ImageData } = require('@napi-rs/canvas');
  for (const [file, family] of FONT_FILES) GlobalFonts.registerFromPath(path.join(FONT_DIR, file), family);
  const box = { console, ImageData };
  vm.createContext(box);
  vm.runInContext('globalThis.WW = {};', box);
  for (const file of FILES) {
    vm.runInContext(fs.readFileSync(path.join(SRC, file), 'utf8'), box, { filename: file });
    if (file === 'art/px.js') box.WW.makeCanvas = (w, h) => createCanvas(w, h);
  }
  world = box.WW;
  return world;
}

// The picture the server will paint, or null when what came is not a restaurant.
function clean(body) {
  if (!body || typeof body !== 'object' || JSON.stringify(body).length > MOST_BYTES) return null;
  const pic = game().cleanPicture(body);
  if (!pic) return null;
  // Plain copies, so nothing from inside the game's own world leaks out.
  const out = JSON.parse(JSON.stringify(pic));
  out.shop = cleanName(out.shop, 'A Tiny Table', 22);
  out.chef[0] = cleanName(out.chef[0], 'Bean', 14);
  // The board on the picture is the server's own, written in when the picture is kept.
  out.ranks = [];
  out.note = [];
  return out;
}

// The same picture always gets the same address.
const idOf = (pic) => crypto.createHash('sha256').update(JSON.stringify(pic)).digest('base64url').slice(0, 12);

// The top of the real board, as the sign outside writes it: plain capitals, the start of the wallet when a name has none.
function boardLines(board) {
  if (!board || !board.rows) return { ranks: [], note: ['OPENING SOON'] };
  const ranks = board.rows.slice(0, 5).map((r, i) => {
    const plain = String(r.shop).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[Đđ]/g, 'D').toUpperCase();
    return [i + 1, (/[A-Z0-9]/.test(plain) ? plain : String(r.wallet).toUpperCase()).slice(0, 15).trim(), r.level];
  });
  return { ranks, note: ranks.length ? [] : ['NOBODY YET', 'CONNECT A WALLET', 'TO BE THE FIRST'] };
}

const painted = new Map();
async function render(pic, id) {
  if (painted.has(id)) return painted.get(id);
  const WW = game();
  // Back through the game's own check, so even a kept picture is only ever painted from clean pieces.
  const again = WW.cleanPicture(JSON.parse(JSON.stringify(pic)));
  if (!again) throw new Error('A kept picture no longer passes the check.');
  const png = await WW.paintPicture(again, FONTS).encode('png');
  painted.set(id, png);
  if (painted.size > KEEP_PAINTED) painted.delete(painted.keys().next().value);
  return png;
}

const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// The page a picture's link opens: what X, Discord and Telegram read for the preview, and the picture with a way into the game for people.
// Without the picture, the game's own preview, so an old link still shows something and still leads in.
function page(pic, id, origin) {
  const shop = pic ? escape(pic.shop) : '';
  const title = pic ? `${shop}, a tiny restaurant run by a real hamster` : 'Squeekerant, a tiny restaurant run by a real hamster';
  const about = pic ? `Level ${pic.level} on Squeekerant, a free pixel restaurant game run live by Squeektoshi, a real hamster on a real wheel.` : 'A free pixel restaurant game run live by Squeektoshi, a real hamster on a real wheel. No token, no fees.';
  const image = pic ? `${origin}/p/${id}.png` : `${origin}/og.png`;
  const alt = pic ? `A picture of ${shop} on Squeekerant` : 'Squeekerant: a pixel restaurant in the woods with tiny animal guests';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><meta name="robots" content="noindex"><meta name="description" content="${about}"><meta property="og:type" content="website"><meta property="og:url" content="${origin}/p/${id}"><meta property="og:site_name" content="Squeekerant"><meta property="og:title" content="${title}"><meta property="og:description" content="${about}"><meta property="og:image" content="${image}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${alt}"><meta name="twitter:card" content="summary_large_image"><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#3a2340;color:#fff8e8;font:18px/1.35 system-ui,sans-serif}main{width:min(100% - 32px,960px);margin:24px auto;text-align:center}img{display:block;width:100%;height:auto;image-rendering:pixelated;box-shadow:6px 6px 0 #1f1424}a{display:inline-block;margin-top:20px;padding:12px 22px;background:#e4572e;color:#fff8e8;font-weight:700;text-decoration:none;box-shadow:3px 3px 0 #1f1424}p{margin:14px 0 0;color:#f0d6a3}</style></head>
<body><main><img src="${image}" width="1200" height="630" alt="${alt}"><a href="/">Play Squeekerant</a><p>A free pixel restaurant game, run live by a real hamster on a real wheel.</p></main></body></html>
`;
}

module.exports = { clean, idOf, render, page, boardLines, world: game, FILES, FONTS, FONT_FILES };
