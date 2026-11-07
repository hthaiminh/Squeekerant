// The server's own look at the wheel, through the game's own code: the same reader of SqueekCore and the same rule for dreams,
// so the dreams it lists and the alerts it sends are always the ones every restaurant in the game gets.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
// What reading the wheel and naming a dream need from the game, in the build's own order. A test keeps it that way.
const FILES = ['core/rng.js', 'art/px.js', 'data/animals.js', 'data/food.js', 'data/outside.js', 'data/decor.js', 'core/feed.js', 'core/engine.js'];
// The game reads this far back when it connects, so a dream found in it is one a player connecting now would get too.
const READ_BACK = 320;
// More public nodes, after the game's own, for when one does not answer a server.
const MORE_NODES = { 11155111: ['https://1rpc.io/sepolia', 'https://rpc.sepolia.ethpandaops.io', 'https://sepolia.rpc.thirdweb.com'] };
const ROUND_PAGE = '0xc8b9e08f';
const ROUND_MS = 600000;
const SETTLE_LAG_MS = 40000;
const hex64 = (n) => BigInt(n).toString(16).padStart(64, '0');

let world = null;
function game() {
  if (world) return world;
  // The reader asks the official API and a public node, so it gets the network and its timers. Nothing else from outside.
  const box = { console, fetch, AbortSignal, setTimeout, clearTimeout };
  vm.createContext(box);
  vm.runInContext('globalThis.WW = {};', box);
  for (const file of FILES) vm.runInContext(fs.readFileSync(path.join(SRC, file), 'utf8'), box, { filename: file });
  world = box.WW;
  return world;
}

// Every wake with a dream among the rounds read after `from`: a round with passes after at least DREAM_ROUNDS quiet ones.
// Rounds from `from` on were all read, and a read round with no record is a quiet one, the way the game counts them.
// Started on a round that already had its dream, that round counts no sleep and is left out.
function dreamsIn(WW, feed, from) {
  const CFG = WW.CFG;
  const active = [...feed.roundsKnown.values()].filter((info) => info.work > 0 && info.r > from).sort((a, b) => a.r - b.r);
  const out = [];
  let before = from;
  for (const info of active) {
    const slept = info.r - before - 1;
    if (slept >= CFG.DREAM_ROUNDS) {
      const gold = slept >= CFG.GOLD_ROUNDS;
      const dream = WW.hash32(info.hash, 'dream') % WW.DREAMS.length;
      // He woke during this round, so its start is when he woke, to the 10 minutes.
      out.push({ wheel: feed.installation, core: feed.core, chain: feed.chainId || '', round: info.r, hash: info.hash, dream, gold, slept, woke: feed.roundEnd(info.r - 1) });
    }
    before = info.r;
  }
  return out;
}

// One eth_call on the first node that gives a clear answer. A node that reverts has answered: that round is not settled yet.
async function ethCall(rpcs, core, data) {
  let failure = new Error('No node to ask.');
  for (const rpc of rpcs) {
    try {
      const res = await fetch(rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: core, data }, 'latest'] }), signal: AbortSignal.timeout(6000) });
      const j = await res.json();
      if (j.result) return { result: j.result };
      if (j.error && /revert/i.test(String(j.error.message))) return { reverted: true };
      throw new Error((j.error && j.error.message) || 'No answer in it.');
    } catch (e) {
      failure = e;
    }
  }
  throw failure;
}

// The last round SqueekCore has settled, found with nothing but `settled(r)`, which says whether a round is settled yet.
// Rounds settle in order, so it starts from what the clock allows and steps back, then narrows down.
async function lastSettled(settled, upTo) {
  let hi = upTo;
  for (let i = 0; i < 3 && hi > 0; i++, hi--) if (await settled(hi)) return hi;
  let step = 4;
  let lo = hi - step;
  while (lo > 0 && !(await settled(lo))) {
    hi = lo - 1;
    step *= 2;
    if (step > 8192) throw new Error('No settled round found.');
    lo = Math.max(1, hi - step);
  }
  if (lo < 1) throw new Error('No settled round found.');
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (await settled(mid)) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

// The wheel from the chain alone, for when the official API does not answer this server.
// Its contract and chain come from the game's own list of wheels, the newest one.
async function fromChain(WW) {
  const [installation, wheel] = Object.entries(WW.KNOWN_WHEELS).sort((a, b) => b[1].genesis - a[1].genesis)[0];
  const rpcs = [...(WW.NODES[wheel.chainId] || []), ...(MORE_NODES[wheel.chainId] || [])];
  const genesisMs = wheel.genesis * 1000;
  const pages = new Map();
  const page = async (r) => {
    if (!pages.has(r)) pages.set(r, await ethCall(rpcs, wheel.core, ROUND_PAGE + hex64(Math.max(0, r - 1)) + hex64(r) + hex64(1)));
    return pages.get(r);
  };
  const settled = await lastSettled(async (r) => !(await page(r)).reverted, Math.floor((Date.now() - genesisMs - SETTLE_LAG_MS) / ROUND_MS));
  const words = (await page(settled)).result.slice(2).match(/.{64}/g) || [];
  const work = Number(BigInt('0x' + words[5]));
  const feed = new WW.LiveFeed({
    core: wheel.core,
    chainId: String(wheel.chainId),
    installation,
    genesis: wheel.genesis,
    status: { measurement: { cumulativeWorkUnits: String(work), rpmMilli: 0, freshness: 'online', coreStatus: 'IDLE' } },
    settled,
    work,
    rpcs,
  });
  feed.timed = (url, opt) => fetch(url, Object.assign({ signal: AbortSignal.timeout(6000) }, opt));
  return feed;
}

// Reads the wheel's rounds after `from`, or as far back as the game itself reads when `from` is null.
// The official API says which wheel and how far it has settled. When it does not answer, the chain alone says so.
async function read(from = null, { api = true } = {}) {
  const WW = game();
  let feed = null;
  let source = 'api';
  if (api) {
    try {
      feed = await WW.LiveFeed.connect();
    } catch (e) {
      console.error('The Squeekchain API did not answer the server:', e.message);
    }
  }
  if (!feed) {
    feed = await fromChain(WW);
    source = 'chain';
  }
  feed.rpcs = [...new Set([...feed.rpcs, ...(MORE_NODES[feed.chainId] || [])])];
  const start = from === null ? Math.max(0, feed.settledRound - READ_BACK) : Math.max(0, Math.min(from, feed.settledRound));
  await feed.syncFrom(start);
  return { wheel: feed.installation, core: feed.core, settled: feed.settledRound, from: start, source, dreams: dreamsIn(WW, feed, start) };
}

// What a dream is called and how it is made, from the game's own list. The server never translates it.
function dreamDish(dream, gold) {
  return game().Engine.dreamDef(dream, gold);
}

module.exports = { read, dreamsIn, dreamDish, lastSettled, world: game, FILES, READ_BACK, MORE_NODES };
