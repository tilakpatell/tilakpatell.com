import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { FROM, SIDE_EFFECT, resolve, uncomment } from '../../../../scripts/health/graph.mjs';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

// every file a module brings with it as it loads: its imports and side-effect
// imports, followed (an import() loads later, so it's left out); repo paths
async function loadsWith(entry) {
  const seen = new Set([entry]);
  const todo = [entry];
  while (todo.length) {
    const file = todo.pop();
    if (!/\.(m?js|jsx)$/.test(file)) continue;
    const text = uncomment(await readFile(file, 'utf8'));
    for (const re of [FROM, SIDE_EFFECT]) {
      for (const m of text.matchAll(re)) {
        for (const f of await resolve(m[2], file)) {
          if (!seen.has(f)) {
            seen.add(f);
            todo.push(f);
          }
        }
      }
    }
  }
  return [...seen].map((f) => f.slice(ROOT.length));
}

describe('CompoundWorld, what it loads with it', () => {
  it('takes the HUD kit’s parts and tokens, not its barrel, so no Battlefront screen or data comes with it', async () => {
    const files = await loadsWith(`${ROOT}src/components/avengers/world/CompoundWorld.jsx`);
    expect(files).toEqual(expect.arrayContaining(['src/runtime/hud/hud.css', 'src/runtime/hud/Hud.jsx', 'src/runtime/hud/Menu.jsx', 'src/runtime/hud/canvas.js']));
    expect(files.filter((f) => /^src\/runtime\/hud\/(index\.js|Screen\.jsx|ScreenCanvas\.jsx|Film\.jsx)$/.test(f))).toEqual([]);
    expect(files.filter((f) => /^src\/(lib|data)\/bf2017\//.test(f))).toEqual([]);
  });

  it('loads the kit’s tokens before its parts, where the barrel loaded them', () => {
    const src = readFileSync(new URL('./CompoundHud.jsx', import.meta.url), 'utf8');
    const css = src.indexOf("import '../../../runtime/hud/hud.css';");
    expect(css).toBeGreaterThan(-1);
    expect(src.slice(0, css)).not.toMatch(/runtime\/hud/);
  });
});

describe('the compound’s HUD', () => {
  it('counts Things to do from progress()’s count, as the ops board does', () => {
    const hud = readFileSync(new URL('./CompoundHud.jsx', import.meta.url), 'utf8');
    expect(hud).toMatch(/const won = prog\.count;/);
    expect(hud).toMatch(/Things to do · \{won\}\/\{prog\.places\.length\}/);
  });
});

describe('the compound and its board', () => {
  const world = readFileSync(new URL('./CompoundWorld.jsx', import.meta.url), 'utf8');
  it('puts the ops board directly under the compound, in place of the cards, with the pins finding its cards', () => {
    const open = world.indexOf('<section id="hq-world"');
    expect(open).toBeGreaterThan(-1);
    expect(world.indexOf('<OpsBoard')).toBeGreaterThan(world.indexOf('</section>', open));
    expect(world).not.toMatch(/function Cards\(/);
    expect(world).toMatch(/function Air\(/);
    expect(world).toMatch(/onPick=\{\(id\) => jumpTo\(null, `hq-card-\$\{id\}`/);
    expect(world).toMatch(/travelTo\.current = travel;/);
  });
  it('tries 3D one game at a time, and never touches the site’s 3D setting', () => {
    expect(world).toContain("writeLocal3D(GAME_AT[id], 'on')");
    expect(world).not.toMatch(/three\.set\(|setMode3D/);
  });
  it('brings the board with it, and no game’s rules', async () => {
    const files = await loadsWith(`${ROOT}src/components/avengers/world/CompoundWorld.jsx`);
    expect(files).toEqual(expect.arrayContaining(['src/components/avengers/board/OpsBoard.jsx', 'src/components/avengers/board/records.js']));
    expect(files.filter((f) => /^src\/components\/avengers\/(ricochet|widow|tesseract)\/rules\.js$/.test(f))).toEqual([]);
  });
  it('tells the guide’s readers the same', () => {
    expect(readFileSync(new URL('../../guide/pages.js', import.meta.url), 'utf8')).toMatch(/\['Without 3D', '[^']*the ops board below[^']*'\]/);
  });
});
