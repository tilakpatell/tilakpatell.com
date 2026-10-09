// Walks the durable world's schema by hand against the real project: an
// anonymous visitor places three things, finds them by envelope, is refused
// inside Echo Base, shoots one to nothing and sees it gone, and a second
// visitor cannot remove the other two (their owner then does). One line a
// step; exit 1 on any failure, 2 when no project is set. It needs the schema
// and seed applied (supabase/README.md) and anonymous sign-ins on; CI never
// runs it (the client's tests use a fake).
//
//   node scripts/supabase-check.mjs [--env <file>]   # default .env.local
//
// The URL and anon key are read from the file (or the VITE_ names in the
// environment) and used, never printed.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const NAMES = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];

// KEY=value lines, as Vite reads them: comments and blanks skipped, one pair
// of quotes taken off
export function parseEnv(text) {
  const out = {};
  for (const line of text.split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trimStart().startsWith('#')) continue;
    out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

export function projectFrom(file, env = process.env) {
  const fromFile = file && existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : {};
  const [url, key] = NAMES.map((n) => fromFile[n] || env[n] || '');
  return url && key ? { url, key } : null;
}

async function main() {
  const at = process.argv.indexOf('--env');
  const file = at > 0 ? process.argv[at + 1] : join(ROOT, '.env.local');
  const project = projectFrom(file);
  if (!project) {
    console.log('no project linked: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local');
    process.exit(2);
  }
  const { createClient } = await import('@supabase/supabase-js');
  const { client, signIn } = await import('../src/lib/durable/supabase.js');
  const { createEntityLoader } = await import('../src/lib/durable/entityLoader.js');
  // a fresh anonymous visitor each run, kept nowhere
  const make = (url, key) => createClient(url, key, { auth: { persistSession: false } });

  let failed = 0;
  const step = async (name, fn) => {
    try {
      const said = await fn();
      console.log(`ok    ${name}${said ? `: ${said}` : ''}`);
      return true;
    } catch (e) {
      failed++;
      console.log(`FAIL  ${name}: ${e.message}`);
      return false;
    }
  };
  const must = (cond, msg) => {
    if (!cond) throw new Error(msg);
  };

  const c = client({ ...project, make });
  const errors = [];
  const loader = createEntityLoader({ client: c, planetId: 'hoth', radius: 0, realtime: false });
  loader.on((e) => e.type === 'error' && errors.push(e));
  // far from Echo Base and from other runs: a random spot in cell (10..19, 10..19)
  const ox = (10 + Math.floor(Math.random() * 10)) * 2048 + 500;
  const oz = (10 + Math.floor(Math.random() * 10)) * 2048 + 500;
  const placed = [];
  // the steps after placing act on what was placed: with nothing placed they say so, not a TypeError
  const three = () => must(placed.length === 3, 'nothing to act on: the place step failed');

  const signedIn = await step('signed in anonymously', async () => {
    const id = await signIn(c);
    must(id, 'no user: are anonymous sign-ins enabled in the project’s Auth settings?');
  });
  if (!signedIn) process.exit(1);

  await step('placed three on hoth', async () => {
    for (let i = 0; i < 3; i++) {
      const e = await loader.place({ type: 'turret', x: ox + i * 40, y: 0, z: oz, metadata: { check: true } });
      must(e, errors.at(-1)?.error?.message ?? 'refused');
      placed.push(e);
    }
    return placed.map((e) => e.id.slice(0, 8)).join(' ');
  });

  await step('the envelope finds the three, and refuses one too large', async () => {
    const box = { planet_id: 'hoth', min_x: ox - 100, max_x: ox + 200, min_z: oz - 100, max_z: oz + 100 };
    const { data, error } = await c.rpc('get_entities_in_bounding_box', box);
    must(!error, error?.message);
    three();
    const ids = new Set(data.map((r) => r.id));
    must(placed.every((e) => ids.has(e.id)), `found ${data.length}, not the three`);
    const big = await c.rpc('get_entities_in_bounding_box', { ...box, max_x: box.min_x + 9000 });
    must(big.error, 'a 9 km envelope was answered');
  });

  await step('refused inside Echo Base', async () => {
    const e = await loader.place({ type: 'turret', x: 1200, y: 12, z: -800 });
    // let in by mistake: taken out again, so a failed run leaves nothing inside
    if (e) await loader.remove(e.id);
    must(e === null, 'a turret was placed inside Echo Base');
    must(/point of interest/.test(errors.at(-1)?.error?.message ?? ''), errors.at(-1)?.error?.message ?? 'no error');
  });

  await step('damaged one to nothing, and it is gone', async () => {
    three();
    let hp = placed[0]?.hp ?? 100;
    for (let i = 0; i < 10 && hp > 0; i++) {
      hp = await loader.damage(placed[0].id, 30);
      must(hp !== null, errors.at(-1)?.error?.message ?? 'no answer');
    }
    must(hp === 0, `hp ${hp} after ten hits`);
    const { data } = await c.from('world_entities').select('id').eq('id', placed[0].id);
    must(data?.length === 0, 'still in the table');
  });

  await step('another visitor cannot remove them; their owner can', async () => {
    three();
    const other = make(project.url, project.key);
    const id = await signIn(other);
    must(id, 'the second visitor could not sign in');
    const rest = placed.slice(1).map((e) => e.id);
    const { data } = await other.from('world_entities').delete().in('id', rest).select('id');
    must(!data?.length, `a stranger removed ${data.length}`);
    for (const id of rest) must(await loader.remove(id), errors.at(-1)?.error?.message ?? 'not removed');
  });

  // a failed damage step leaves its target standing, owned by a visitor no
  // one can be again: taken out here so a failed run leaves nothing behind
  // (the loader holds no cell here, so the table is asked directly; a delete
  // of a row already gone deletes nothing)
  if (placed[0]) await c.from('world_entities').delete().eq('id', placed[0].id);
  loader.dispose();
  process.exit(failed ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
