// A save code: the whole restaurant as one line of text, to carry it to another device or browser by hand.
// It is the save squeezed with the browser's own deflate when there is one, written in URL safe base64,
// with a short check at the end so a code cut short in copying is caught rather than half loaded.
(function (WW) {
  const PREFIX = 'SQK';
  const toB64 = (bytes) => {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const fromB64 = (text) => {
    const s = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  };
  const through = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
  const squeezes = () => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';
  const check = (body) => WW.hash32('save code', body).toString(36);

  // Why a code cannot be opened, in words for the player.
  class CodeError extends Error {}

  async function make(save) {
    const bytes = new TextEncoder().encode(JSON.stringify(save));
    const squeezed = squeezes();
    const body = toB64(squeezed ? await through(bytes, new CompressionStream('deflate-raw')) : bytes);
    return `${PREFIX}${squeezed ? 'Z' : 'P'}1.${body}.${check(body)}`;
  }

  async function read(code) {
    const text = String(code || '').replace(/\s+/g, '');
    const m = /^SQK([ZP])1\.([A-Za-z0-9_-]+)\.([0-9a-z]+)$/.exec(text);
    if (!m) throw new CodeError(text.startsWith(PREFIX) ? 'That code is not complete. Copy the whole code and try again.' : 'That is not a Squeekerant save code.');
    if (check(m[2]) !== m[3]) throw new CodeError('That code is not complete. Copy the whole code and try again.');
    if (m[1] === 'Z' && !squeezes()) throw new CodeError('This browser cannot open that code. Try another browser.');
    let save;
    try {
      const bytes = fromB64(m[2]);
      save = JSON.parse(new TextDecoder().decode(m[1] === 'Z' ? await through(bytes, new DecompressionStream('deflate-raw')) : bytes));
    } catch (e) {
      throw new CodeError('That code is not complete. Copy the whole code and try again.');
    }
    // The shape every save has, so nothing half broken gets into the game.
    const ok = save && typeof save === 'object' && typeof save.v === 'number' && typeof save.shop === 'string' && save.chef && typeof save.chef === 'object' && save.clock && typeof save.clock === 'object' && Number.isFinite(save.clock.round) && Array.isArray(save.stations) && Array.isArray(save.staff) && Array.isArray(save.furniture) && save.room && Number.isFinite(save.room.cols) && Number.isFinite(save.level);
    if (!ok) throw new CodeError('That is not a Squeekerant save code.');
    return save;
  }

  WW.SaveCode = { make, read, CodeError };
})((globalThis.WW = globalThis.WW || {}));
