// The one function on Vercel. vercel.json sends every /api/ address here.
const crypto = require('crypto');
const { createApp } = require('../server/app');
const { cloudStore } = require('../server/store');

const url = process.env.DATABASE_URL;
const handle = createApp({
  store: cloudStore(url),
  // Tickets and sessions are signed with a key made from the database's own secret, so there is nothing else to set up.
  secret: crypto.createHash('sha256').update('squeekerant sessions ' + (url || crypto.randomBytes(32).toString('hex'))).digest(),
});

module.exports = async (req, res) => {
  const { pathname } = new URL(req.url, 'http://x');
  // Reading a body that is not valid JSON throws here.
  let body = null;
  try {
    body = req.body;
  } catch (e) {}
  const out = await handle({ method: req.method, path: pathname, headers: req.headers, body });
  res.statusCode = out.status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', out.cache || 'no-store');
  res.end(JSON.stringify(out.json));
};
