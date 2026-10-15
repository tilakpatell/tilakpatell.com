// The worlds whose HUD imports nothing from the HUD kit (src/runtime/hud):
// each still draws its own prompt, menu, toast or stick. Lower is better;
// none left means every world speaks the one HUD (docs/health/RULES.md,
// "The worlds' HUDs"). A world counts as on the kit when any file of its own
// folder imports the kit, directly or through a shared part (the towns'
// TownHud.jsx).
import { metric } from './context.mjs';

// one folder a world (the towns of Middle-earth, Scranton and the Citadel
// share TownHud, so they move as one; the galaxy's surface is the galaxy's)
const WORLD_DIRS = ['albuquerque', 'avengers', 'caribbean', 'cybertron', 'deathstar', 'dotmatrix', 'earth', 'galaxy', 'invincible', 'mario64', 'middleearth', 'minecraft', 'music', 'office', 'rickmorty'];

// a world's own page, where its HUD lives there rather than in its folder
// (the galaxy's surface: src/pages/GalaxySurface.jsx)
export const WORLD_PAGES = { galaxy: ['src/pages/GalaxySurface.jsx'] };

const KIT = /from\s+['"][^'"]*runtime\/hud(?:\/[^'"]*)?['"]/;
const TOWNS = /from\s+['"][^'"]*towns\/TownHud['"]/;

export default async function hudKit(ctx, dirs = WORLD_DIRS, pages = WORLD_PAGES) {
  // (the towns' shared HUD counts only once it's on the kit itself)
  const townHud = ctx.src.find((p) => ctx.rel(p).endsWith('/towns/TownHud.jsx'));
  const townsOn = townHud ? KIT.test(await ctx.read(townHud)) : false;
  const onKit = (text) => KIT.test(text) || (townsOn && TOWNS.test(text));
  const detail = [];
  for (const d of dirs) {
    const own = pages[d] ?? [];
    const files = ctx.src.filter((p) => (ctx.rel(p).startsWith(`src/components/${d}/`) || own.includes(ctx.rel(p))) && !/\.test\./.test(p));
    if (!files.length) continue;
    let on = false;
    for (const p of files) if (onKit(await ctx.read(p))) on = true;
    if (!on) detail.push({ file: `src/components/${d}`, n: 1 });
  }
  return metric({ id: 'hud-kit', label: 'worlds whose HUD is off the HUD kit', unit: 'worlds', detail, ordered: true });
}
