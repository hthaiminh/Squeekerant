// Joins everything into one file. dist/artifact.html is the body for the Artifact viewer,
// dist/index.html is a complete page you can open anywhere, where it can also reach the real wheel.
// `node scripts/build.js vi` writes the Vietnamese test build to dist/vi instead. The plain build stays English only.
// `node scripts/build.js public` writes only the page visitors get to public/, which is all Vercel serves as files.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = (f) => fs.readFileSync(path.join(root, 'src', f), 'utf8');
// Squeekchain Genesis looks for this tag in the head of the live page every day, so it must stay. See the end of the README.
const GENESIS_TAG = '<meta name="squeekchain-project" content="59c16db5-e31e-4532-966b-35152d96700f">';
// What a link to the site shows when it is pasted into X, Discord or Telegram. Only the English page goes public.
const SITE = 'https://www.squeekerant.online';
const PREVIEW = [
  '<meta name="description" content="A free pixel restaurant game run live by Squeektoshi, a real hamster on a real wheel. When he runs, guests walk in. When he sleeps, he dreams up new dishes.">',
  '<meta property="og:type" content="website">',
  `<meta property="og:url" content="${SITE}/">`,
  '<meta property="og:site_name" content="Squeekerant">',
  '<meta property="og:title" content="Squeekerant, a tiny restaurant run by a real hamster">',
  '<meta property="og:description" content="A free pixel restaurant game run live by Squeektoshi, a real hamster on a real wheel. No token, no fees.">',
  `<meta property="og:image" content="${SITE}/og.png">`,
  '<meta property="og:image:width" content="1200">',
  '<meta property="og:image:height" content="630">',
  '<meta property="og:image:alt" content="Squeekerant: a pixel restaurant in the woods with tiny animal guests">',
  '<meta name="twitter:card" content="summary_large_image">',
].join('');
const vi = process.argv[2] === 'vi';
const pub = process.argv[2] === 'public';

const ORDER = ['core/rng.js', 'art/px.js', 'data/recording.js', 'data/animals.js', 'data/food.js', 'data/outside.js', 'data/decor.js', 'art/animals.js', 'art/food.js', 'art/hamster.js', 'art/scene.js', 'art/outside.js', 'art/houses.js', 'art/logo.js', 'core/feed.js', 'core/engine.js', 'core/wallet.js', 'core/counter.js', ...(vi ? ['lang/vi.js'] : []), 'ui/sound.js', 'ui/music.js', 'ui/panels.js', 'ui/scene.js', 'ui/line.js', 'ui/landing.js', 'ui/share.js', 'ui/practice.js', 'ui/main.js'];

const js = ORDER.map((f) => src(f)).join('\n').replace(/<\/script/g, '<\\/script');
const css = src('ui/style.css') + (vi ? src('lang/vi.css') : '');
let template = src('ui/template.html');
if (vi) template = template.replace('family=Jersey+20&family=Pixelify+Sans:wght@600;700&family=VT323', 'family=Pixelify+Sans:wght@700&family=VT323');
const body = template.replace('/*CSS*/', () => css).replace('/*JS*/', () => js);
// The public build must stay fully English.
if (!vi && /[ăđơưĂĐƠƯẠ-ỹ]/.test(body)) throw new Error('Vietnamese text found in the English build');

const out = path.join(root, pub ? 'public' : 'dist', vi ? 'vi' : '');
fs.mkdirSync(out, { recursive: true });
if (!pub) fs.writeFileSync(path.join(out, 'artifact.html'), body);
// The tab icon, the head chef from the game, stays inside the page so going live is still one file.
const icon = fs.readFileSync(path.join(root, 'src', 'ui', 'icon.png')).toString('base64');
// The Artifact body starts with its title. A whole page keeps it in the head, where link previews look for it.
const title = (body.match(/<title>[^<]*<\/title>\n?/) || [''])[0];
const page = `<!doctype html>\n<html lang="${vi ? 'vi' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">${title.trim()}${GENESIS_TAG}${vi ? '' : PREVIEW}<link rel="icon" type="image/png" href="data:image/png;base64,${icon}"></head><body>\n${body.replace(title, '')}\n</body></html>\n`;
fs.writeFileSync(path.join(out, 'index.html'), page);
// The preview picture sits next to the page. It is made from the game itself, see the README. The public build must have it.
const og = path.join(root, 'src', 'ui', 'og.png');
if (!vi && (pub || fs.existsSync(og))) fs.copyFileSync(og, path.join(out, 'og.png'));
console.log('built', vi ? 'vi' : 'en', Math.round(body.length / 1024) + ' KB');
