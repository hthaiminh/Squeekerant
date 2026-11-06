// The updates page, /updates: every release, newest first, written in src/updates.json.
// Each release is one ticket. What matters most comes first and big, the small things follow in small print.
const KINDS = { new: 'New', better: 'Better', fixed: 'Fixed' };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const dateText = (day) => {
  const [y, m, d] = day.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};
const order = (v) => v.split('.').map(Number).reduce((a, n) => a * 1000 + n, 0);

// Stops the build on anything the page could not show properly.
function check(list) {
  if (!Array.isArray(list) || !list.length) throw new Error('src/updates.json has no releases');
  list.forEach((r, i) => {
    const where = `release ${i + 1} in src/updates.json`;
    if (!/^\d+\.\d+\.\d+$/.test(r.v)) throw new Error(`${where}: the version must look like 0.0.1`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date) || Number.isNaN(Date.parse(r.date))) throw new Error(`${where}: the date must look like 2026-11-06`);
    if (i && order(r.v) >= order(list[i - 1].v)) throw new Error(`${where}: releases go newest first, ${r.v} comes after ${list[i - 1].v}`);
    if (!Array.isArray(r.items) || !r.items.length) throw new Error(`${where}: it has no items`);
    for (const it of r.items) {
      if (!KINDS[it.kind]) throw new Error(`${where}: kind must be one of ${Object.keys(KINDS).join(', ')}`);
      if (!it.text) throw new Error(`${where}: an item has no text`);
      if (it.big && !it.title) throw new Error(`${where}: a big item needs a title`);
    }
  });
}

function release(r, latest) {
  const big = r.items.filter((it) => it.big);
  const small = r.items.filter((it) => !it.big);
  const tag = (kind) => `<span class="tag ${kind}">${KINDS[kind]}</span>`;
  return `<article class="release${latest ? ' latest' : ''}" id="v${r.v}">
<header><a class="ver" href="#v${r.v}">${r.v}</a>${latest ? '<span class="now">Latest</span>' : ''}<time datetime="${r.date}">${dateText(r.date)}</time></header>
${r.title ? `<h2>${escape(r.title)}</h2>` : ''}${big.length ? `<ul class="big">${big.map((it) => `<li>${tag(it.kind)}<h3>${escape(it.title)}</h3><p>${escape(it.text)}</p></li>`).join('')}</ul>` : ''}${small.length ? `<ul class="small">${small.map((it) => `<li>${tag(it.kind)}<span>${escape(it.text)}</span></li>`).join('')}</ul>` : ''}
</article>`;
}

function updatesPage(list, { icon, logo, site = 'https://www.squeekerant.online' }) {
  check(list);
  const latest = list[0];
  const about = `What changed in Squeekerant, newest first. Latest: ${latest.v}, ${dateText(latest.date)}.`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Squeekerant updates</title><meta name="description" content="${escape(about)}"><meta property="og:type" content="website"><meta property="og:url" content="${site}/updates"><meta property="og:site_name" content="Squeekerant"><meta property="og:title" content="Squeekerant updates"><meta property="og:description" content="${escape(about)}"><meta property="og:image" content="${site}/og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><link rel="icon" type="image/png" href="data:image/png;base64,${icon}"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jersey+20&family=Pixelify+Sans:wght@600;700&family=VT323&display=swap">
<style>
:root { color-scheme: light; --ink: #3a2340; --plum: #5b3a5e; --paper: #fff8e8; --cream: #fff1d6; --oat: #f0d6a3; --tomato: #e4572e; --brick: #b53a2b; --butter: #ffc857; --leaf: #6fb36b; --mint: #a8e0b8; --teal: #2f7f86; --lilac: #a99ad6; --cloth: rgba(228, 87, 46, 0.2); --logo: 'Pixelify Sans', 'VT323', 'Courier New', monospace; --display: 'Jersey 20', 'Pixelify Sans', 'VT323', 'Courier New', monospace; --body: 'VT323', 'Courier New', monospace; --edge: 0 -3px 0 var(--ink), 0 3px 0 var(--ink), -3px 0 0 var(--ink), 3px 0 0 var(--ink); }
* { box-sizing: border-box; }
body { margin: 0; color: var(--ink); font: 400 20px/1.25 var(--body); background: linear-gradient(90deg, var(--cloth) 50%, transparent 50%) 0 0 / 32px 32px, linear-gradient(0deg, var(--cloth) 50%, transparent 50%) 0 0 / 32px 32px, var(--cream); }
.page { width: min(760px, 100% - 32px); margin: 0 auto; padding: max(24px, env(safe-area-inset-top, 0px)) 0 40px; }
.top { display: grid; justify-items: center; gap: 6px; text-align: center; margin-bottom: 26px; }
.top img { width: 324px; max-width: 100%; height: auto; image-rendering: pixelated; }
h1 { font: 700 40px/1 var(--logo); margin: 4px 0 0; color: var(--tomato); text-shadow: 3px 3px 0 var(--ink); }
.top p { margin: 0; color: var(--plum); }
.btn { display: inline-flex; align-items: center; justify-content: center; min-height: 40px; margin: 8px 3px 3px; padding: 8px 16px; font: 400 22px/1 var(--display); color: var(--paper); background: var(--tomato); text-decoration: none; box-shadow: var(--edge), inset 0 -3px 0 rgba(58, 35, 64, 0.22); }
.btn:hover { filter: brightness(1.08); }
.release { background: var(--paper); padding: 18px 20px 20px; margin: 0 0 28px; box-shadow: var(--edge), 8px 8px 0 2px rgba(58, 35, 64, 0.4); }
.release > header { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; padding-bottom: 10px; border-bottom: 3px dotted var(--oat); }
.ver { font: 400 36px/1 var(--display); color: var(--tomato); text-decoration: none; }
.now { font: 400 18px/1 var(--display); padding: 4px 8px 3px; background: var(--butter); box-shadow: var(--edge); }
time { margin-left: auto; color: var(--plum); font-size: 19px; }
h2 { font: 700 26px/1.1 var(--logo); margin: 14px 0 4px; color: var(--brick); }
ul { list-style: none; margin: 0; padding: 0; }
.big li { padding: 14px 0 2px; }
.big h3 { display: inline; font: 700 24px/1.15 var(--logo); margin: 0; }
.big p { margin: 6px 0 0; font-size: 21px; line-height: 1.3; }
.small { margin-top: 14px; padding-top: 10px; border-top: 3px dotted var(--oat); }
.small li { display: flex; align-items: baseline; gap: 8px; padding: 3px 0; font-size: 18px; line-height: 1.25; color: var(--plum); }
.tag { flex: none; display: inline-block; font: 400 15px/1 var(--display); padding: 3px 6px 2px; color: var(--ink); vertical-align: 3px; margin-right: 8px; }
.small .tag { min-width: 46px; text-align: center; font-size: 13px; padding: 2px 5px 1px; margin-right: 0; vertical-align: 1px; opacity: 0.85; }
.tag.new { background: var(--butter); }
.tag.better { background: var(--mint); }
.tag.fixed { background: var(--lilac); }
.release:not(.latest) .ver { font-size: 32px; }
footer { text-align: center; color: var(--plum); font-size: 18px; }
footer a { color: var(--brick); }
@media (max-width: 480px) {
  .page { width: calc(100% - 32px); padding-top: max(18px, env(safe-area-inset-top, 0px)); }
  h1 { font-size: 34px; }
  .release { padding: 14px 14px 16px; margin-bottom: 22px; }
  .ver { font-size: 32px; }
  time { margin-left: 0; width: 100%; }
  h2 { font-size: 23px; }
  .big h3 { font-size: 21px; }
  .big p { font-size: 20px; }
  .small li { font-size: 17px; }
}
</style></head>
<body><div class="page">
<header class="top"><a href="/" aria-label="Squeekerant"><img src="data:image/png;base64,${logo}" alt="Squeekerant" width="324" height="78"></a><h1>Updates</h1><p>What changed in the game, newest first.</p><a class="btn" href="/">Play Squeekerant</a></header>
<main>
${list.map((r, i) => release(r, i === 0)).join('\n')}
</main>
<footer><p>A tiny restaurant run by a real hamster. <a href="/">Play Squeekerant</a></p></footer>
</div></body></html>
`;
}

module.exports = { updatesPage, check, dateText, KINDS };
