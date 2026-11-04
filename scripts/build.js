// Joins everything into one file. dist/artifact.html is the body for the Artifact viewer,
// dist/index.html is a complete page you can open anywhere, where it can also reach the real wheel.
// `node scripts/build.js vi` writes the Vietnamese test build to dist/vi instead. The plain build stays English only.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = (f) => fs.readFileSync(path.join(root, 'src', f), 'utf8');
const vi = process.argv[2] === 'vi';

const ORDER = ['core/rng.js', 'art/px.js', 'data/recording.js', 'data/animals.js', 'data/food.js', 'data/outside.js', 'data/decor.js', 'art/animals.js', 'art/food.js', 'art/hamster.js', 'art/scene.js', 'art/outside.js', 'art/houses.js', 'core/feed.js', 'core/engine.js', ...(vi ? ['lang/vi.js'] : []), 'ui/sound.js', 'ui/music.js', 'ui/panels.js', 'ui/scene.js', 'ui/line.js', 'ui/main.js'];

const js = ORDER.map((f) => src(f)).join('\n').replace(/<\/script/g, '<\\/script');
const css = src('ui/style.css') + (vi ? src('lang/vi.css') : '');
let template = src('ui/template.html');
if (vi) template = template.replace('family=Jersey+20&family=Pixelify+Sans:wght@600;700&family=VT323', 'family=Pixelify+Sans:wght@700&family=VT323');
const body = template.replace('/*CSS*/', () => css).replace('/*JS*/', () => js);
// The public build must stay fully English.
if (!vi && /[ăđơưĂĐƠƯẠ-ỹ]/.test(body)) throw new Error('Vietnamese text found in the English build');

const out = path.join(root, 'dist', vi ? 'vi' : '');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'artifact.html'), body);
const page = `<!doctype html>\n<html lang="${vi ? 'vi' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>\n${body}\n</body></html>\n`;
fs.writeFileSync(path.join(out, 'index.html'), page);
console.log('built', vi ? 'vi' : 'en', Math.round(body.length / 1024) + ' KB');
