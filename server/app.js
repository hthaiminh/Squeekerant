// The small server behind the leaderboard: proving you own a wallet, taking a score, and reading the board.
// Signing in only ever asks the wallet to sign a message. There is no fee and no transaction.
const crypto = require('crypto');
const { cleanScore } = require('./rules');

const TICKET_MS = 5 * 60000;
const SESSION_MS = 60 * 86400000;
const BOARD_CACHE = 'public, max-age=30, s-maxage=300, stale-while-revalidate=600';
const CLOSED_CACHE = 'public, max-age=30, s-maxage=60';
const PUBLIC_HOSTS = ['www.squeekerant.online', 'squeekerant.online', 'squeekerant.vercel.app'];
const LOCAL_HOST = /^(localhost|127\.0\.0\.1)(:\d+)?$/;

class Refusal extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const b64 = (data) => Buffer.from(data).toString('base64url');

function createApp({ store, secret, local = false, clock = Date.now }) {
  const sign = (kind, data) => {
    const body = b64(JSON.stringify(Object.assign({ k: kind }, data)));
    return body + '.' + crypto.createHmac('sha256', secret).update(body).digest('base64url');
  };
  const read = (kind, token) => {
    const [body, mac] = String(token || '').split('.');
    if (!body || !mac) return null;
    const want = Buffer.from(crypto.createHmac('sha256', secret).update(body).digest('base64url'));
    const got = Buffer.from(mac);
    if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
    let data;
    try {
      data = JSON.parse(Buffer.from(body, 'base64url').toString());
    } catch (e) {
      return null;
    }
    return data.k === kind && data.exp > clock() ? data : null;
  };
  const hostOf = (headers) => {
    const host = String(headers.host || '').toLowerCase();
    if (PUBLIC_HOSTS.includes(host) || (local && LOCAL_HOST.test(host))) return host;
    throw new Refusal(403, 'This site cannot sign in to Squeekerant.');
  };
  const needsBoard = () => {
    if (!store.open) throw new Refusal(503, 'The leaderboard is not open yet.');
  };

  const routes = {
    // The wording follows Sign-In with Ethereum, so a wallet can warn if another site shows this message.
    'POST /api/wallet/ticket': async ({ body, headers }) => {
      needsBoard();
      const address = String((body && body.address) || '').toLowerCase();
      if (!/^0x[0-9a-f]{40}$/.test(address)) throw new Refusal(400, 'That is not a wallet address.');
      const host = hostOf(headers);
      const { getAddress } = await import('viem');
      const now = clock();
      const message = [
        `${host} wants you to sign in with your Ethereum account:`,
        getAddress(address),
        '',
        'Put my restaurant on the Squeekerant leaderboard. This costs nothing and sends no transaction.',
        '',
        `URI: ${LOCAL_HOST.test(host) ? 'http' : 'https'}://${host}`,
        'Version: 1',
        'Chain ID: 1',
        `Nonce: ${crypto.randomBytes(12).toString('hex')}`,
        `Issued At: ${new Date(now).toISOString()}`,
      ].join('\n');
      return { json: { message, ticket: sign('ticket', { a: address, m: message, exp: now + TICKET_MS }) } };
    },
    'POST /api/wallet/verify': async ({ body }) => {
      needsBoard();
      const ticket = read('ticket', body && body.ticket);
      if (!ticket) throw new Refusal(400, 'That took too long. Please try again.');
      const signature = String((body && body.signature) || '');
      if (!/^0x[0-9a-fA-F]{130}$/.test(signature)) throw new Refusal(400, 'The wallet did not give a proper signature.');
      const { recoverMessageAddress } = await import('viem');
      let who;
      try {
        who = await recoverMessageAddress({ message: ticket.m, signature });
      } catch (e) {
        throw new Refusal(400, 'The wallet did not give a proper signature.');
      }
      if (who.toLowerCase() !== ticket.a) throw new Refusal(400, 'That signature is from another wallet.');
      return { json: { wallet: who, token: sign('session', { a: who, exp: clock() + SESSION_MS }) } };
    },
    'POST /api/score': async ({ body, headers }) => {
      needsBoard();
      const session = read('session', String(headers.authorization || '').replace(/^Bearer /, ''));
      if (!session) throw new Refusal(401, 'Connect your wallet again.');
      const now = clock();
      const score = cleanScore(body, now);
      if (score.error) throw new Refusal(400, score.error);
      if (score.impossible) return { json: { accepted: false } };
      const place = await store.saveScore(session.a, score, now);
      return { json: Object.assign({ accepted: true }, place) };
    },
    'GET /api/board': async () => {
      if (!store.open) return { json: { open: false, rows: [], total: 0 }, cache: CLOSED_CACHE };
      const board = await store.board();
      return { json: Object.assign({ open: true }, board), cache: BOARD_CACHE };
    },
  };

  // Takes a plain request and gives back a status, a JSON body and how long it may be cached.
  return async function handle({ method, path, headers, body }) {
    const route = routes[`${method} ${path}`];
    if (!route) return { status: 404, json: { error: 'Not found.' } };
    try {
      const out = await route({ headers: headers || {}, body });
      return { status: 200, json: out.json, cache: out.cache || 'no-store' };
    } catch (e) {
      if (e instanceof Refusal) return { status: e.status, json: { error: e.message }, cache: 'no-store' };
      console.error(`${method} ${path}:`, e);
      return { status: 503, json: { error: 'The leaderboard cannot be reached right now.' }, cache: 'no-store' };
    }
  };
}

module.exports = { createApp, PUBLIC_HOSTS };
