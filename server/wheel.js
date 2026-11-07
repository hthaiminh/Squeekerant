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

// Reads the wheel's rounds after `from`, or as far back as the game itself reads when `from` is null.
async function read(from = null) {
  const WW = game();
  const feed = await WW.LiveFeed.connect();
  const start = from === null ? Math.max(0, feed.settledRound - READ_BACK) : Math.max(0, Math.min(from, feed.settledRound));
  await feed.syncFrom(start);
  return { wheel: feed.installation, core: feed.core, settled: feed.settledRound, from: start, dreams: dreamsIn(WW, feed, start) };
}

// What a dream is called and how it is made, from the game's own list. The server never translates it.
function dreamDish(dream, gold) {
  return game().Engine.dreamDef(dream, gold);
}

module.exports = { read, dreamsIn, dreamDish, world: game, FILES, READ_BACK };
