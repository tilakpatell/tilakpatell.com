// A space level's weather and lamps for its area of its own (galaxy/
// levelArea.js), written beside its pack: the map extras' lights, blinking
// beacons, lightning strikes and backlit clouds (scripts/lib/bf2017-area.mjs
// says how), in the game's metres, of the sub-levels the pack draws.
//
//   node scripts/bf2017-area.mjs <map> --world <id> --subs a,b,…
//     e.g. levels/space/sb_kamino_01 --world sb_kamino --subs SB_Kamino_01,Art,Art_LargeGameMode,Level_Design,SpaceBattle
//
// Writes public/models/galaxy/bf2017/levels/<world>/area.json. The keys as
// the fetch takes them (SUPABASE_URL, BF2017_KEY or SUPA_KEY), never printed;
// behind a proxy, NODE_USE_ENV_PROXY=1.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getObject, keys } from './bf2017-fetch.mjs';
import { parseArgs } from './lib/args.mjs';
import { areaJson } from './lib/bf2017-area.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, 'lab', 'assets', 'bf2017');

async function main(args) {
  const [map] = args._;
  if (!map || typeof args.world !== 'string' || typeof args.subs !== 'string') {
    console.error('usage: node scripts/bf2017-area.mjs <map> --world <id> --subs a,b,…');
    process.exit(1);
  }
  const env = keys();
  const name = map.split('/').pop();
  const read = async (ext) => {
    const r = await getObject(env, CACHE, `web/maps/${map}/${name}${ext}`);
    if (!['fetched', 'kept'].includes(r.state)) throw new Error(`web/maps/${map}/${name}${ext}: not in the bucket yet`);
    return JSON.parse(readFileSync(r.file, 'utf8'));
  };
  const out = areaJson(await read('.extras.json'), await read('.json'), { subs: args.subs.split(',') });
  const file = join(ROOT, 'public', 'models', 'galaxy', 'bf2017', 'levels', args.world, 'area.json');
  if (!existsSync(dirname(file))) mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify({ ...out, map, subs: args.subs.split(',') })}\n`);
  console.log(`${args.world}: ${out.glows.length} glows (${out.skipped} lamps off), ${out.blinkers.length} beacons, ${out.strikes.length} lightning strikes, ${out.clouds.length} backlit clouds`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main(parseArgs(process.argv.slice(2)));
