// Wake up alerts go out as the browsers' own push messages, with nothing but node's crypto.
// Each message is encrypted for the one browser it goes to (RFC 8291), so the push service in between cannot read it,
// and it carries a token signed with the site's key (RFC 8292), so the push service knows it comes from this site.
const crypto = require('crypto');

// The order of the P-256 curve. A private key is a number from 1 up to one below it.
const ORDER = BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551');
const RECORD_SIZE = 4096;
const TOKEN_HOURS = 12;
// Who the push services can write to about these messages. A page of the site, never anyone's address.
const SUBJECT = 'https://www.squeekerant.online';
// Only the push services of the browsers people use. A browser names where its messages go, so without this list
// anyone could make the server post to any address on the internet.
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^web\.push\.apple\.com$/, /^[a-z0-9-]+\.push\.apple\.com$/, /^[a-z0-9-]+\.notify\.windows\.com$/];
const MOST_ENDPOINT = 1024;

const b64 = (data) => Buffer.from(data).toString('base64url');
const big = (bytes) => BigInt('0x' + Buffer.from(bytes).toString('hex'));

// The site's key pair, made from a secret so there is nothing more to set up. A new secret makes new keys,
// and a browser that said yes under the old ones signs up again by itself the next time the game opens.
function keysFrom(secret) {
  let d = crypto.createHash('sha256').update('squeekerant push ' + secret).digest();
  while (big(d) === 0n || big(d) >= ORDER) d = crypto.createHash('sha256').update(d).digest();
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.setPrivateKey(d);
  const publicKey = ecdh.getPublicKey();
  const signer = crypto.createPrivateKey({ key: { kty: 'EC', crv: 'P-256', d: b64(d), x: b64(publicKey.subarray(1, 33)), y: b64(publicKey.subarray(33)) }, format: 'jwk' });
  return { publicKey, signer, publicText: b64(publicKey) };
}

// The token that says the message is from this site, for the push service at that address.
function vapid(endpoint, keys, now) {
  const head = b64(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = b64(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + TOKEN_HOURS * 3600, sub: SUBJECT }));
  const signed = head + '.' + claims;
  const signature = crypto.sign('sha256', Buffer.from(signed), { key: keys.signer, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${signed}.${b64(signature)}, k=${keys.publicText}`;
}

// The message, encrypted so only that one browser can read it. `own` and `salt` are only given by the test that checks RFC 8291's example.
function encrypt(text, sub, own, salt = crypto.randomBytes(16)) {
  const theirs = Buffer.from(sub.p256dh, 'base64url');
  const auth = Buffer.from(sub.auth, 'base64url');
  const ecdh = crypto.createECDH('prime256v1');
  if (own) ecdh.setPrivateKey(own);
  else ecdh.generateKeys();
  const mine = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(theirs);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', shared, auth, Buffer.concat([Buffer.from('WebPush: info\0'), theirs, mine]), 32));
  const key = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const cipher = crypto.createCipheriv('aes-128-gcm', key, nonce);
  // One record: the message, then 2 to say it is the last.
  const sealed = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(text), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const head = Buffer.alloc(21);
  salt.copy(head, 0);
  head.writeUInt32BE(RECORD_SIZE, 16);
  head[20] = mine.length;
  return Buffer.concat([head, mine, sealed]);
}

// A push service's address for one browser, or null when it is anything else.
function cleanEndpoint(value) {
  const endpoint = typeof value === 'string' ? value : '';
  if (!endpoint || endpoint.length > MOST_ENDPOINT) return null;
  let url;
  try {
    url = new URL(endpoint);
  } catch (e) {
    return null;
  }
  if (url.protocol !== 'https:' || url.port || url.username || url.password || !PUSH_HOSTS.some((host) => host.test(url.hostname))) return null;
  return url.href;
}

// What a browser sends when it says yes, kept only when it is a real push address and real keys.
function cleanSubscription(body) {
  if (!body || typeof body !== 'object') return null;
  const endpoint = cleanEndpoint(body.endpoint);
  if (!endpoint) return null;
  const keys = body.keys && typeof body.keys === 'object' ? body.keys : {};
  const words = [keys.p256dh, keys.auth].map((k) => (typeof k === 'string' && /^[A-Za-z0-9_-]{16,100}={0,2}$/.test(k) ? Buffer.from(k, 'base64url') : null));
  const [p256dh, auth] = words;
  if (!p256dh || !auth || p256dh.length !== 65 || p256dh[0] !== 4 || auth.length !== 16) return null;
  // A point that is not on the curve cannot be encrypted to.
  try {
    const probe = crypto.createECDH('prime256v1');
    probe.generateKeys();
    probe.computeSecret(p256dh);
  } catch (e) {
    return null;
  }
  return { endpoint, p256dh: b64(p256dh), auth: b64(auth) };
}

// Sends one message. Gives back the push service's answer: 201 is taken, 404 and 410 mean that browser is gone for good.
async function send(sub, message, keys, { ttl = 3 * 3600, topic = 'wake', now = Date.now(), timeout = 8000 } = {}) {
  const body = encrypt(JSON.stringify(message), sub);
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: { authorization: vapid(sub.endpoint, keys, now), 'content-encoding': 'aes128gcm', 'content-type': 'application/octet-stream', ttl: String(ttl), urgency: 'normal', topic },
    body,
    signal: AbortSignal.timeout(timeout),
  });
  return res.status;
}

module.exports = { keysFrom, vapid, encrypt, cleanEndpoint, cleanSubscription, send, PUSH_HOSTS, SUBJECT };
