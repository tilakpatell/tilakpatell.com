// The Worker's code, run for /audio/* and bf2-web's play site alone
// (wrangler.jsonc's run_worker_first); every other path is answered from the
// build's files with no code run and nothing counted. The play site (its
// page under /battlefront/engine/ and the roots it asks for) is read from the
// private bucket (cloudflare/play.js); what isn't its goes to the files. Cloudflare's files answer a request
// for part of a file (`Range`) with the whole file, 200, and Safari plays an
// <audio> only from a server that answers 206: the Music page's sitar
// (/audio/sitar-listen.mp3) is played so. So for audio the file is asked for
// whole and the bytes asked for are cut from it: a 206 with where they sit
// in the file, 416 for a start past its end, and a whole ask told ranges may
// be asked for. The files are under a megabyte, so the cut is in memory.
// What it can't read (several ranges, another unit) goes back whole, as
// before. (docs/stack/cloudflare.md)
//
//   ranged(request, response) → Promise<Response>
//   default.fetch(request, env) → the play site's answer, else env.ASSETS' for the path, ranged

import play from '../src/data/bf2web/play.json';
import { servePlay } from './play.js';

// (the play site's manifests, read once an isolate)
const manifests = new Map();

const ONE = /^bytes=(\d*)-(\d*)$/;

export async function ranged(request, response) {
  if (response.status !== 200) return response;
  const asked = request.headers.get('range');
  const m = asked ? ONE.exec(asked.trim()) : null;
  if (!m || (m[1] === '' && m[2] === '')) {
    const headers = new Headers(response.headers);
    headers.set('accept-ranges', 'bytes');
    return new Response(response.body, { status: 200, headers });
  }
  const body = await response.arrayBuffer();
  const size = body.byteLength;
  // (a suffix, bytes=-n, is the last n bytes)
  const start = m[1] === '' ? Math.max(0, size - Number(m[2])) : Number(m[1]);
  const end = m[1] === '' || m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  if (start >= size || start > end) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}`, 'accept-ranges': 'bytes' } });
  const headers = new Headers(response.headers);
  headers.set('accept-ranges', 'bytes');
  headers.set('content-range', `bytes ${start}-${end}/${size}`);
  headers.set('content-length', String(end - start + 1));
  return new Response(body.slice(start, end + 1), { status: 206, headers });
}

export default {
  async fetch(request, env, ctx) {
    const served = await servePlay(request, env, play, manifests, ctx, globalThis.caches?.default ?? null);
    if (served) return served;
    return ranged(request, await env.ASSETS.fetch(request));
  },
};
