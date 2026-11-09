// /dreams: every Dream Dish Squeektoshi has dreamed up, with what anyone needs to check that nobody picked it,
// and a picture for each one to post. The pictures are painted here with the game's own art.
const fs = require('fs');
const path = require('path');
const pictures = require('./picture');
const { idOf } = require('./wake');
const { dateText } = require('../scripts/updates-page');

const SRC = path.join(__dirname, '..', 'src');
const CODE = 'https://github.com/hthaiminh/Squeekerant/blob/main/src';
const EXPLORERS = { 11155111: ['Sepolia', 'https://sepolia.etherscan.io/address/'], 1: ['Ethereum', 'https://etherscan.io/address/'] };
const W = 1200;
const H = 630;

const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const hours = (d) => (d.slept / 6).toFixed(1);
const clock = (t) => new Date(t).toISOString().slice(11, 16);
const dish = (d) => pictures.world().Engine.dreamDef(d.dream, d.gold);
const postText = (d) => `@squeekchain's Squeektoshi, a real hamster, slept ${hours(d)} hours and dreamed of ${dish(d).n}. Every restaurant in Squeekerant got this same dish.`;
const postLink = (d, origin) => `https://x.com/intent/post?text=${encodeURIComponent(postText(d))}&url=${encodeURIComponent(`${origin}/dreams/${idOf(d)}`)}`;
let files = null;
const own = () => files || (files = { icon: fs.readFileSync(path.join(SRC, 'ui', 'icon.png')).toString('base64'), logo: fs.readFileSync(path.join(SRC, 'ui', 'logo.png')).toString('base64') });

// The dish as the game draws it, small, for the list.
const icons = new Map();
async function iconOf(d) {
  const key = d.dream + (d.gold ? 'g' : '');
  if (!icons.has(key)) {
    const WW = pictures.world();
    const art = WW.dishIcon(dish(d), d.gold);
    const canvas = WW.makeCanvas(art.width, art.height);
    canvas.getContext('2d').drawImage(art, 0, 0);
    icons.set(key, (await canvas.encode('png')).toString('base64'));
  }
  return icons.get(key);
}

// The picture for a dream, 1200 by 630 like every other picture of the game.
async function paint(d) {
  const WW = pictures.world();
  const C = WW.C;
  const f = pictures.FONTS;
  const def = dish(d);
  const card = WW.makeCanvas(W, H);
  const x = card.getContext('2d');
  x.imageSmoothingEnabled = false;
  const scaled = (art, left, top, k) => x.drawImage(art, Math.round(left), Math.round(top), art.width * k, art.height * k);
  const fit = (text, family, weight, size, room, least) => {
    let s = size;
    for (; s > least; s -= 2) {
      x.font = `${weight} ${s}px ${family}`;
      if (x.measureText(text).width <= room) break;
    }
    return s;
  };

  // The night he slept through, in bands, with stars of its own.
  const bands = ['#251a3d', '#2a1f48', '#2f2452', '#33295d', '#363068', '#3a3a78'];
  bands.forEach((c, i) => {
    x.fillStyle = c;
    x.fillRect(0, Math.round((i * H) / bands.length), W, Math.ceil(H / bands.length) + 1);
  });
  const rng = WW.Rng(WW.hash32('stars', d.round, d.hash));
  for (let i = 0; i < 90; i++) {
    const big = rng.next() < 0.2;
    x.fillStyle = [C.paper, C.butter, C.lilac, C.ice][Math.floor(rng.next() * 4)];
    x.fillRect(Math.floor(rng.next() * (W / 3)) * 3, Math.floor(rng.next() * (H / 3)) * 3, big ? 6 : 3, big ? 6 : 3);
  }
  // A crescent moon, drawn in big pixels.
  const moon = WW.makeCanvas(18, 18);
  const m = moon.getContext('2d');
  for (let yy = 0; yy < 18; yy++) {
    for (let xx = 0; xx < 18; xx++) {
      const inMoon = (xx - 8.5) ** 2 + (yy - 8.5) ** 2 <= 64;
      const inBite = (xx - 12.5) ** 2 + (yy - 6.5) ** 2 <= 49;
      if (inMoon && !inBite) {
        m.fillStyle = C.butter;
        m.fillRect(xx, yy, 1, 1);
      }
    }
  }
  scaled(moon, W - 150, 34, 6);

  // The name of the game over the sky.
  scaled(WW.logoCanvas(), 44, 34, 3);

  // The dish, as big as whole pixels allow, on a ticket.
  const tl = 74;
  const tt = 176;
  const ts = 372;
  x.fillStyle = 'rgba(20, 12, 30, 0.5)';
  x.fillRect(tl + 10, tt + 12, ts + 4, ts + 4);
  x.fillStyle = C.ink;
  x.fillRect(tl, tt - 4, ts, ts + 8);
  x.fillRect(tl - 4, tt, ts + 8, ts);
  x.fillStyle = d.gold ? '#fff3c4' : C.paper;
  x.fillRect(tl, tt, ts, ts);
  const art = WW.dishIcon(def, d.gold);
  const k = Math.floor((ts - 52) / art.width);
  scaled(art, tl + (ts - art.width * k) / 2, tt + (ts - art.height * k) / 2, k);

  // What he dreamed, and what proves it.
  const left = 508;
  const room = W - left - 48;
  x.textBaseline = 'alphabetic';
  x.textAlign = 'left';
  x.fillStyle = C.oat;
  x.font = `34px ${f.body}`;
  x.fillText('Squeektoshi dreamed of', left, 222);
  const size = fit(def.n, f.display, 400, 88, room, 40);
  x.fillStyle = d.gold ? C.butter : C.paper;
  x.fillText(def.n, left, 222 + size * 0.95);
  let y = 222 + size * 0.95 + 26;
  const label = d.gold ? 'GOLDEN DREAM DISH' : 'DREAM DISH';
  x.font = `400 24px ${f.display}`;
  const lw = Math.ceil(x.measureText(label).width) + 20;
  x.fillStyle = d.gold ? C.butter : C.lilac;
  x.fillRect(left, y, lw, 32);
  x.fillStyle = C.ink;
  x.fillText(label, left + 10, y + 24);
  y += 32 + 52;
  x.font = `32px ${f.body}`;
  x.fillStyle = C.paper;
  x.fillText(`He slept ${hours(d)} hours.`, left, y);
  x.font = `28px ${f.body}`;
  x.fillStyle = C.oat;
  x.fillText(`Woke ${dateText(new Date(d.woke).toISOString().slice(0, 10))}, round ${d.round}`, left, y + 40);
  x.fillStyle = C.lilac;
  x.fillText(`Hash ${d.hash}`, left, y + 76);
  x.fillStyle = C.paper;
  x.fillText('Every restaurant got this same dish.', left, y + 112);

  // Back to sleep already, at the corner.
  const sleeper = WW.squeekSleep();
  scaled(sleeper, W - 190, H - 118, 6);
  x.fillStyle = C.lilac;
  x.font = `30px ${f.body}`;
  x.fillText('z', W - 82, H - 124);
  x.font = `40px ${f.body}`;
  x.fillText('Z', W - 58, H - 150);
  x.font = `24px ${f.body}`;
  x.fillStyle = C.oat;
  x.textAlign = 'left';
  x.fillText('www.squeekerant.online', 74, H - 30);
  return card.encode('png');
}

const painted = new Map();
async function picture(d) {
  const key = d.wheel + ' ' + d.round;
  if (!painted.has(key)) {
    painted.set(key, await paint(d));
    if (painted.size > 20) painted.delete(painted.keys().next().value);
  }
  return painted.get(key);
}

const STYLE = `:root { color-scheme: dark; --ink: #3a2340; --plum: #5b3a5e; --paper: #fff8e8; --cream: #fff1d6; --oat: #f0d6a3; --tomato: #e4572e; --brick: #b53a2b; --butter: #ffc857; --lilac: #a99ad6; --night: #2a1f48; --logo: 'Pixelify Sans', 'VT323', 'Courier New', monospace; --display: 'Jersey 20', 'Pixelify Sans', 'VT323', 'Courier New', monospace; --body: 'VT323', 'Courier New', monospace; --edge: 0 -3px 0 var(--ink), 0 3px 0 var(--ink), -3px 0 0 var(--ink), 3px 0 0 var(--ink); }
* { box-sizing: border-box; }
body { margin: 0; color: var(--paper); font: 400 20px/1.3 var(--body); background: #3a3a78 linear-gradient(180deg, #251a3d, #3a3a78 900px) no-repeat; }
a { color: var(--butter); }
.page { width: min(820px, 100% - 32px); margin: 0 auto; padding: max(24px, env(safe-area-inset-top, 0px)) 0 40px; }
.top { display: grid; justify-items: center; gap: 6px; text-align: center; margin-bottom: 22px; }
.top img { width: 324px; max-width: 100%; height: auto; image-rendering: pixelated; }
h1 { font: 700 40px/1 var(--logo); margin: 4px 0 0; color: var(--butter); text-shadow: 3px 3px 0 var(--ink); }
.top p { margin: 0; color: var(--oat); max-width: 640px; }
.btn { display: inline-flex; align-items: center; justify-content: center; min-height: 40px; margin: 8px 3px 3px; padding: 8px 16px; font: 400 22px/1 var(--display); color: var(--paper); background: var(--tomato); text-decoration: none; box-shadow: var(--edge), inset 0 -3px 0 rgba(58, 35, 64, 0.22); }
.btn.plain { color: var(--ink); background: var(--paper); }
.btn:hover { filter: brightness(1.08); }
.hero { margin: 0 0 26px; }
.hero img { display: block; width: 100%; height: auto; image-rendering: pixelated; box-shadow: var(--edge), 8px 8px 0 2px rgba(20, 12, 30, 0.5); }
.hero p { margin: 10px 0 0; text-align: center; }
.dream { display: flex; gap: 16px; align-items: center; margin: 0 0 18px; padding: 14px 16px; color: var(--ink); background: var(--paper); box-shadow: var(--edge), 6px 6px 0 2px rgba(20, 12, 30, 0.5); }
.dream.gold { background: #fff3c4; }
.dream .dish { flex: none; width: 64px; height: 64px; image-rendering: pixelated; }
.dream h2 { font: 700 24px/1.1 var(--logo); margin: 0; color: var(--brick); }
.dream p { margin: 4px 0 0; font-size: 19px; line-height: 1.2; }
.dream code { font: inherit; overflow-wrap: anywhere; }
.dream a { color: var(--brick); }
.tag { display: inline-block; font: 400 15px/1 var(--display); padding: 3px 6px 2px; margin-left: 8px; vertical-align: 3px; color: var(--ink); background: var(--butter); }
.how { margin: 30px 0 0; padding: 16px 18px; background: rgba(20, 12, 30, 0.45); box-shadow: var(--edge); }
.how h2 { font: 700 24px/1.1 var(--logo); margin: 0 0 6px; color: var(--butter); }
.how p { margin: 8px 0 0; }
.how code { font: inherit; color: var(--oat); overflow-wrap: anywhere; }
footer { margin-top: 26px; text-align: center; color: var(--oat); font-size: 18px; }
@media (max-width: 480px) {
  .page { padding-top: max(18px, env(safe-area-inset-top, 0px)); }
  h1 { font-size: 34px; }
  .dream { gap: 12px; padding: 12px; }
  .dream .dish { width: 48px; height: 48px; }
  .dream h2 { font-size: 21px; }
}`;

function head(title, about, url, image, origin) {
  const { icon } = own();
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${escape(title)}</title><meta name="description" content="${escape(about)}"><meta property="og:type" content="website"><meta property="og:url" content="${origin}${url}"><meta property="og:site_name" content="Squeekerant"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(about)}"><meta property="og:image" content="${image}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><link rel="icon" type="image/png" href="data:image/png;base64,${icon}"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jersey+20&family=Pixelify+Sans:wght@600;700&family=VT323&display=swap"><style>${STYLE}</style></head>`;
}
// Times are written in UTC on the server. The page then shows them in the reader's own time.
// The post's words with the dream's own link, and its picture to save, so a morning post takes seconds.
const COPY = '<script>for(const b of document.querySelectorAll("[data-copy]")){b.addEventListener("click",async()=>{const t=b.dataset.copy;try{await navigator.clipboard.writeText(t);const o=b.textContent;b.textContent="Copied";setTimeout(()=>{b.textContent=o;},1800);}catch(e){window.prompt("Copy this post:",t);}});}</script>';
const postTools = (d, origin) => `<a class="btn plain" href="/dreams/${idOf(d)}.png" download="squeektoshi-dream-${idOf(d)}.png">Save picture</a><button class="btn plain" type="button" data-copy="${escape(`${postText(d)}
${origin}/dreams/${idOf(d)}`)}">Copy post</button>`;
const LOCAL = '<script>for(const t of document.querySelectorAll("time[data-local]")){const d=new Date(t.dateTime);if(!isNaN(d))t.textContent=d.toLocaleString(undefined,{day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"});}</script>';
const when = (d) => `<time datetime="${new Date(d.woke).toISOString()}" data-local>${dateText(new Date(d.woke).toISOString().slice(0, 10))}, ${clock(d.woke)} UTC</time>`;

// How anyone can check a dream: where the hash is kept, and the code that turns it into a dish.
function howTo(rows) {
  const cores = [];
  for (const d of rows) if (d.core && !cores.some((c) => c.core === d.core)) cores.push({ core: d.core, chain: d.chain });
  const where = cores.length
    ? cores.map(({ core, chain }) => {
        const ex = EXPLORERS[chain];
        return ex ? `<a href="${ex[1]}${escape(core)}" rel="noopener noreferrer"><code>${escape(core)}</code></a> on ${ex[0]}` : `<code>${escape(core)}</code>`;
      }).join(', and before that ')
    : 'SqueekCore';
  return `<section class="how"><h2>Check it yourself</h2>
<p>A dream comes when he wakes after 10 hours or more with no passes on the wheel, counted in 10 minute rounds. After 15 hours it is golden.</p>
<p>The wheel's contract, ${where}, keeps a hash for every round with passes. <code>roundPage(uint64,uint64,uint256)</code> reads them. The game takes the first 16 characters of the hash of the round he woke on and turns them into one of ${pictures.world().DREAMS.length} dreams with <code>hash32(hash, 'dream') % ${pictures.world().DREAMS.length}</code>.</p>
<p>Nobody can pick it, and every restaurant gets the same one. The code is open: <a href="${CODE}/core/feed.js" rel="noopener noreferrer">reading the rounds</a>, <a href="${CODE}/core/engine.js" rel="noopener noreferrer">the dream rule</a> and <a href="${CODE}/core/rng.js" rel="noopener noreferrer">hash32</a>.</p></section>`;
}

async function listPage(rows, origin) {
  const { logo } = own();
  const latest = rows[0];
  const about = latest ? `Every Dream Dish of Squeektoshi, a real hamster on a real wheel. Latest: ${dish(latest).n}, after ${hours(latest)} hours of sleep.` : 'Every Dream Dish of Squeektoshi, a real hamster on a real wheel.';
  const items = [];
  for (const d of rows) {
    const def = dish(d);
    items.push(`<article class="dream${d.gold ? ' gold' : ''}" id="d${idOf(d)}"><img class="dish" src="data:image/png;base64,${await iconOf(d)}" width="64" height="64" alt="${escape(def.n)}"><div><h2>${escape(def.n)}${d.gold ? '<span class="tag">Golden</span>' : ''}</h2><p>${when(d)}, after ${hours(d)} hours of sleep</p><p>Round ${d.round}, hash <code>${escape(d.hash)}</code></p><p><a href="/dreams/${idOf(d)}">Its picture</a> &middot; <a href="${escape(postLink(d, origin))}" target="_blank" rel="noopener noreferrer">Post on X</a></p></div></article>`);
  }
  return `${head("Squeektoshi's dreams", about, '/dreams', latest ? `${origin}/dreams/${idOf(latest)}.png` : `${origin}/og.png`, origin)}
<body><div class="page">
<header class="top"><a href="/" aria-label="Squeekerant"><img src="data:image/png;base64,${logo}" alt="Squeekerant" width="324" height="78"></a><h1>His dreams</h1><p>Every time Squeektoshi wakes up from a long sleep, every restaurant in the game gets the same Dream Dish. Here is each one, newest first.</p><a class="btn" href="/">Play Squeekerant</a></header>
<main>
${latest ? `<div class="hero"><a href="/dreams/${idOf(latest)}"><img src="/dreams/${idOf(latest)}.png" width="1200" height="630" alt="${escape(dish(latest).n)}, the latest dream"></a><p>${postTools(latest, origin)}</p></div>` : ''}
${items.length ? items.join('\n') : '<p class="dream">No dreams yet. His first long sleep will bring the first one.</p>'}
${howTo(rows)}
</main>
<footer><p>A tiny restaurant run by a real hamster. <a href="/">Play Squeekerant</a> &middot; <a href="/updates">What's new</a></p></footer>
</div>${LOCAL}${COPY}</body></html>
`;
}

function dreamPage(d, origin) {
  const def = dish(d);
  const title = `${def.n}, a dream of Squeektoshi`;
  const about = `Squeektoshi, a real hamster, slept ${hours(d)} hours and dreamed of ${def.n}. Every restaurant in Squeekerant got this same dish.`;
  return `${head(title, about, `/dreams/${idOf(d)}`, `${origin}/dreams/${idOf(d)}.png`, origin)}
<body><div class="page">
<main class="hero"><img src="/dreams/${idOf(d)}.png" width="1200" height="630" alt="${escape(def.n)}: Squeektoshi slept ${hours(d)} hours and dreamed of it">
<p>${when(d)}. Round ${d.round}, hash <code>${escape(d.hash)}</code>.</p>
<p><a class="btn" href="/">Play Squeekerant</a><a class="btn plain" href="/dreams">Every dream</a><a class="btn plain" href="${escape(postLink(d, origin))}" target="_blank" rel="noopener noreferrer">Post on X</a></p>
<p>${postTools(d, origin)}</p></main>
</div>${LOCAL}${COPY}</body></html>
`;
}

module.exports = { listPage, dreamPage, picture, paint, postText };
