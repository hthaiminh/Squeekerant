// Builds src/data/recording.js from Squeektoshi's real data: every recorded wheel pass from the
// official API and every settled round with its data hash from SqueekCore on Sepolia.
// The page cannot reach the network inside an Artifact, so this recording is what it replays there.
const fs = require('fs');
const path = require('path');

const API = 'https://api.squeekchain.com/v1';
const RPCS = ['https://ethereum-sepolia-rpc.publicnode.com', 'https://sepolia.drpc.org'];
const SEL_STATE = '0xc19d93fb';
const SEL_PAGE = '0xc8b9e08f';
const ROUND_MS = 600000;
const CONFIRMATIONS = 12;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hex64 = (n) => BigInt(n).toString(16).padStart(64, '0');
const words = (r) => r.slice(2).match(/.{64}/g) || [];
const num = (w) => Number(BigInt('0x' + w));

async function getJson(url) {
  for (let i = 0; i < 6; i++) {
    const res = await fetch(url);
    if (res.status === 429 || res.status >= 500) {
      await sleep(1000 * Number(res.headers.get('retry-after') || 2));
      continue;
    }
    if (!res.ok) throw new Error(url + ' HTTP ' + res.status);
    return res.json();
  }
  throw new Error('Gave up on ' + url);
}

async function rpc(method, params) {
  let last;
  for (const url of RPCS) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(20000) });
      const j = await r.json();
      if (j.error) throw new Error(j.error.message);
      return j.result;
    } catch (e) {
      last = e;
    }
  }
  throw last;
}

async function readRounds(core) {
  const head = parseInt(await rpc('eth_blockNumber', []), 16);
  const tag = '0x' + (head - CONFIRMATIONS).toString(16);
  const st = words(await rpc('eth_call', [{ to: core, data: SEL_STATE }, tag]));
  const settled = num(st[0]);
  const totalWork = num(st[1]);
  const out = [];
  let after = 0;
  let cum = 0;
  while (after < settled) {
    const w = words(await rpc('eth_call', [{ to: core, data: SEL_PAGE + hex64(after) + hex64(settled) + hex64(16) }, tag]));
    const cert = num(w[1]);
    const n = num(w[9]);
    for (let i = 0; i < n; i++) {
      const o = 10 + i * 5;
      const round = num(w[o]);
      const c = num(w[o + 1]);
      out.push({ round, work: c - cum, hash: w[o + 4].slice(0, 16) });
      cum = c;
    }
    after = Math.max(cert, n ? out[out.length - 1].round : after);
    if (!n && cert <= after && cert >= settled) break;
    await sleep(120);
  }
  if (cum !== totalWork) throw new Error(`Rounds add up to ${cum} but the chain says ${totalWork}`);
  return { settled, rounds: out, totalWork };
}

async function readPasses() {
  let cursor = null;
  const passes = [];
  for (let page = 0; page < 2000; page++) {
    const j = await getJson(`${API}/measurement/runs?limit=100` + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''));
    for (const s of j.items) if (s.measurementEligible) for (const p of s.passages) passes.push(Date.parse(p.at));
    if (!j.nextCursor || !j.items.length) break;
    cursor = j.nextCursor;
    await sleep(700);
  }
  return passes.sort((a, b) => a - b);
}

// Gaps in centiseconds, two base 64 digits each. Gaps too long for two digits (over 68 s) are written as ~digits~.
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function encodeGaps(passes) {
  let s = '';
  for (let i = 1; i < passes.length; i++) {
    const cs = Math.max(0, Math.round((passes[i] - passes[i - 1]) / 10));
    if (cs < 4096) s += B64[cs >> 6] + B64[cs & 63];
    else s += '~' + cs.toString(36) + '~';
  }
  return s;
}

async function main() {
  const econ = await getJson(`${API}/economy/state`);
  const core = econ.identities.core;
  const coreInfo = await getJson(`${API}/core`);
  const genesis = Number(coreInfo.configuration.genesisTimestamp);
  const stats = await getJson(`${API}/measurement/stats?range=30d`);
  console.log('core', core, 'genesis', genesis);

  const { settled, rounds, totalWork } = await readRounds(core);
  console.log('settled through', settled, 'active rounds', rounds.length, 'work', totalWork);
  const passes = await readPasses();
  console.log('passes', passes.length);

  // Whole cycles from one 12:00 UTC to another, so a looped replay keeps the time of day.
  const roundStart = (r) => genesis * 1000 + (r - 1) * ROUND_MS;
  const roundOf = (ms) => Math.floor((ms - genesis * 1000) / ROUND_MS) + 1;
  const firstPass = passes[0];
  const dayMs = 86400000;
  const noon = (ms) => Math.floor((ms - 12 * 3600000) / dayMs) * dayMs + 12 * 3600000;
  const loopStartMs = noon(firstPass) + dayMs;
  const lastSettledEnd = roundStart(settled + 1);
  const days = Math.floor((lastSettledEnd - loopStartMs) / dayMs);
  const startRound = roundOf(loopStartMs);
  const length = days * 144;
  const endRound = startRound + length - 1;
  console.log('loop', new Date(loopStartMs).toISOString(), 'days', days, 'rounds', startRound, 'to', endRound);

  // Half hours the official statistics call missing are unknown, not zero.
  // A statistics day runs from 12:00 UTC to 12:00 UTC, so its morning buckets fall on the next calendar date.
  const unknown = [];
  for (const d of stats.activity.days) {
    for (const b of d.buckets) {
      if (b.coverage !== 'missing') continue;
      const ms = Date.parse(d.date + 'T00:00:00Z') + b.startMinuteUtc * 60000 + (b.startMinuteUtc < 720 ? dayMs : 0);
      if (ms < loopStartMs || ms >= loopStartMs + days * dayMs) continue;
      const a = roundOf(ms);
      for (let r = a; r < a + 3; r++) unknown.push(r);
    }
  }

  const inLoop = rounds.filter((x) => x.round >= startRound && x.round <= endRound);
  const loopPasses = passes.filter((t) => t >= loopStartMs && t < loopStartMs + days * dayMs);
  const sumWork = inLoop.reduce((s, x) => s + x.work, 0);
  if (sumWork !== loopPasses.length) console.warn('Warning: rounds say', sumWork, 'work but passes say', loopPasses.length);

  const out = {
    source: 'Squeektoshi, real settled rounds and device passes',
    core,
    genesis,
    builtAt: new Date().toISOString(),
    startRound,
    length,
    days,
    totalWork: sumWork,
    distancePerPassMm: Math.round(Number(stats.lifetime.observedDistanceMm) / Number(stats.lifetime.acceptedWorkUnits)),
    rounds: inLoop.map((x) => [x.round, x.work, x.hash]),
    unknown,
    firstPassMs: loopPasses[0],
    gaps: encodeGaps(loopPasses),
  };
  const file = path.join(__dirname, '..', 'src', 'data', 'recording.js');
  fs.writeFileSync(file, '// Generated by scripts/fetch-recording.js, do not edit.\n(globalThis.WW = globalThis.WW || {}).RECORDING = ' + JSON.stringify(out) + ';\n');
  console.log('wrote', file, Math.round(fs.statSync(file).size / 1024) + ' KB', 'unknown rounds', unknown.length, 'active', inLoop.length, 'work', sumWork);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
