import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import DotMatrixWorld from '../components/dotmatrix/DotMatrixWorld';
import { cartInfo, useFound } from '../components/dotmatrix/found';
import { CARTRIDGES, H, MAP, START, VILLAGERS, W, legend } from '../components/dotmatrix/rules';
import { PALETTES, PALETTE_ORDER } from '../components/dotmatrix/dither';
import WorldSwitcher from '../components/worlds/WorldSwitcher';
import { projectById } from '../data/projects';
import { useDocumentTitle } from '../lib/hooks';

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

// The dithering, on its own: a ramp from dark to light, in the four shades,
// with the 4 × 4 pattern deciding which pixels go up a shade.
function Ramp({ palette, dither }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    const g = c?.getContext('2d');
    if (!g) return;
    const { width: w, height: h } = c;
    const shades = PALETTES[palette].shades;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = x / (w - 1);
        const b = dither ? (BAYER[(x % 4) + (y % 4) * 4] + 0.5) / 16 : 0.5;
        g.fillStyle = shades[Math.max(0, Math.min(3, Math.floor(v * 3 + b)))];
        g.fillRect(x, y, 1, 1);
      }
    }
  }, [palette, dither]);
  return <canvas ref={ref} width={128} height={20} className="dm-ramp" aria-label={`A ramp from dark to light in the ${PALETTES[palette].name} palette, ${dither ? 'dithered' : 'without dithering'}`} role="img" />;
}

// The island from above, as the Game Boy would have drawn its map: a tile
// of 6 pixels for each of the map's, in the four shades, with the
// cartridges marked (found, or a ? where one is still hidden), the
// villagers' beats, and the dock you come ashore at.
const S = 6;
const Q = ['111', '001', '011', '000', '010']; // a ? in 3 × 5
function IslandMap({ palette, found }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    const g = c?.getContext('2d');
    if (!g) return;
    const sh = PALETTES[palette].shades;
    const fill = (k, x, y, w = 1, h = 1) => {
      g.fillStyle = sh[k];
      g.fillRect(x, y, w, h);
    };
    const groundAt = (ix, iz) => (ix < 0 || iz < 0 || ix >= W || iz >= H ? -1 : legend(MAP[iz][ix]).ground);
    for (let iz = 0; iz < H; iz++) {
      for (let ix = 0; ix < W; ix++) {
        const t = legend(MAP[iz][ix]);
        const x = ix * S;
        const y = iz * S;
        const checker = (ix + iz) % 2;
        if (t.kind === 'sea') {
          fill(1, x, y, S, S);
          if (checker) fill(2, x + 2, y + 3, 1, 1);
          continue;
        }
        if (t.kind === 'dock') {
          fill(3, x, y, S, S);
          fill(1, x, y + 2, S, 1);
          fill(1, x, y + 5, S, 1);
          continue;
        }
        if (t.kind === 'stone') {
          fill(1, x, y, S, S);
          fill(2, x + 1, y + 1, 4, 4);
          continue;
        }
        // the ground, and a cliff's edge wherever the next tile is lower
        fill(t.kind === 'sand' || t.kind === 'path' ? 3 : 2, x, y, S, S);
        if (t.kind === 'long') {
          fill(1, x + 1 + checker, y + 2, 1, 2);
          fill(1, x + 4 - checker, y + 3, 1, 2);
        }
        if (groundAt(ix, iz + 1) < t.ground && t.ground > 0) fill(1, x, y + S - 1, S, 1);
        if (groundAt(ix + 1, iz) < t.ground && t.ground > 0) fill(1, x + S - 1, y, 1, S);
        if (t.kind === 'tree') {
          fill(1, x + 1, y + 1, 4, 4);
          fill(0, x + 2, y + 2, 2, 2);
        } else if (t.kind === 'boulder') fill(1, x + 1, y + 2, 4, 3);
        else if (t.kind === 'wall') fill(0, x, y, S, S);
        else if (t.kind === 'house') {
          fill(0, x, y, S, S);
          fill(3, x + 1, y + 1, S - 2, S - 2);
        } else if (t.kind === 'gameboy') {
          fill(0, x, y, S, S);
          fill(2, x + 1, y + 1, S - 2, S - 2);
        } else if (t.kind === 'pipe') {
          fill(1, x + 1, y + 1, 4, 4);
          fill(0, x + 2, y + 2, 2, 2);
        } else if (t.kind === 'sign') fill(0, x + 2, y + 2, 2, 2);
        else if (t.kind === 'lighthouse') {
          fill(0, x + 1, y, 4, S);
          fill(3, x + 1, y + 2, 4, 1);
          fill(3, x + 1, y + 4, 4, 1);
        } else if (t.kind === 'mill') {
          fill(0, x + 2, y, 2, S);
          fill(0, x, y + 2, S, 2);
        }
      }
    }
    // the villagers' beats, dotted
    for (const v of VILLAGERS) {
      const n = Math.ceil(Math.hypot(v.to[0] - v.from[0], v.to[1] - v.from[1]) * 2);
      for (let i = 0; i <= n; i += 2) {
        const k = i / n;
        fill(0, Math.floor((v.from[0] + (v.to[0] - v.from[0]) * k) * S), Math.floor((v.from[1] + (v.to[1] - v.from[1]) * k) * S), 1, 1);
      }
    }
    // where you come ashore
    fill(0, Math.floor(START.x * S) - 1, Math.floor(START.z * S) - 1, 3, 3);
    // the cartridges: a mark where one's found, a ? where it's still hidden
    for (const c of CARTRIDGES) {
      const x = Math.floor(c.at[0]) * S;
      const y = Math.floor(c.at[2]) * S;
      fill(0, x, y, S, S);
      if (found.includes(c.id)) fill(3, x + 1, y + 1, S - 2, S - 2);
      else Q.forEach((row, j) => [...row].forEach((b, i) => b === '1' && fill(3, x + 1 + i, y + j, 1, 1)));
    }
  }, [palette, found]);
  return <canvas ref={ref} width={W * S} height={H * S} className="dm-map" role="img" aria-label={`The island from above: ${found.length} of ${CARTRIDGES.length} cartridges found, the rest marked where they're hidden`} />;
}

const KEYS = [
  ['Arrows or W A S D', 'Walk, the way the camera faces'],
  ['Space (Z, K; A on a pad)', 'Jump. Let go early for a short hop; land on a walker to flatten it'],
  ['X (F, J, Enter; B on a pad)', 'Talk to a villager, read a sign, play the Game Boy, go down a pipe'],
  ['Q / E (LB / RB)', 'Turn the camera an eighth of the way round; drag the island, or the right stick, to turn it freely'],
  ['Wheel, pinch, + / − (the triggers)', 'Zoom in and out'],
  ['M (Start)', 'The cartridges found so far, and where the rest are'],
  ['Esc', 'Put the Game Boy down, or close what’s open'],
];

export default function DotMatrix() {
  useDocumentTitle('Dot Matrix');
  const found = useFound();
  const [palette, setPalette] = useState('dmg');
  const [dither, setDither] = useState(true);
  const emulator = projectById('gameboy-emulator');

  return (
    <div className="dm-page relative">
      <DotMatrixWorld />

      <section className="shell relative z-10 grid gap-6 pb-4 pt-10 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div>
          <p className="eyebrow">Dot Matrix · Gaming</p>
          <p className="lead mt-4 max-w-[64ch]">
            Games got me into code. This island is drawn the way a Game Boy drew things: four shades of green and a lot of patience. Eight cartridges are hidden on it, each something I’ve built, and the giant Game Boy in the square plays for real.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link to="/projects/gameboy-emulator" className="btn btn-primary">
            The Game Boy emulator
          </Link>
          <Link to="/" className="btn btn-ghost">
            Back to the site
          </Link>
        </div>
      </section>
      <section className="shell relative z-10 pb-2">
        <WorldSwitcher />
      </section>

      <section className="shell relative z-10 py-12 md:py-16" aria-labelledby="dm-carts-title">
        <h2 id="dm-carts-title" className="title">
          The cartridges
        </h2>
        <p className="lead mt-4 max-w-[58ch]">
          {found.length === CARTRIDGES.length ? 'You found them all.' : `${found.length} of ${CARTRIDGES.length} found so far.`} Every one is a project page, found or not.
        </p>
        <ul className="dm-shelf mt-8">
          <li className="dm-shelf-console">
            <p className="dm-shelf-tag">The console</p>
            <Link to="/projects/gameboy-emulator" className="dm-shelf-name">
              {emulator?.title}
            </Link>
            <p className="dm-shelf-text">{emulator?.summary}</p>
          </li>
          {CARTRIDGES.map((c, i) => {
            const info = cartInfo(c.id);
            const got = found.includes(c.id);
            return (
              <li key={c.id} data-got={got || undefined}>
                <p className="dm-shelf-tag">
                  {String(i + 1).padStart(2, '0')} · {got ? 'Found' : c.where}
                </p>
                <Link to={info.link} className="dm-shelf-name">
                  {info.title}
                </Link>
                <p className="dm-shelf-text">{info.text}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="shell relative z-10 py-12 md:py-16" aria-labelledby="dm-island-title">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start">
          <div>
            <h2 id="dm-island-title" className="title">
              The island
            </h2>
            <p className="lead mt-4 max-w-[54ch]">From the dock in the south, a road up to the square and the giant Game Boy; the long grass and the plateau to the west, the pipe garden and the snake’s pen to the east, Block Drop tower to the north and the islet with its lighthouse off the north-east shore.</p>
            <p className="mt-4 max-w-[60ch] leading-relaxed text-body">Four islanders walk their beats (the dotted lines) and stop to talk: each knows where a cartridge is. Every fifteen coins give a heart back, and the last coin is an achievement. Found cartridges are marked; a ? is one still hidden.</p>
            <IslandMap palette={palette} found={found} />
          </div>
          <div className="dm-how card">
            <h3 className="text-base font-semibold text-ink">The controls</h3>
            <table className="guide-keys mt-3">
              <tbody>
                {KEYS.map(([k, what]) => (
                  <tr key={k}>
                    <th scope="row">
                      <kbd>{k}</kbd>
                    </th>
                    <td>{what}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-4 text-sm text-muted">On a phone: the pad walks, A jumps, B talks and plays, a drag turns the camera and a pinch zooms.</p>
          </div>
        </div>
      </section>

      <section className="shell relative z-10 py-12 md:py-16" aria-labelledby="dm-how-title">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
          <div>
            <h2 id="dm-how-title" className="title">
              How it’s drawn
            </h2>
            <p className="lead mt-4 max-w-[54ch]">The island is a real 3D scene, lit and shadowed, drawn a few hundred pixels across. A last pass turns each pixel’s brightness into one of four shades.</p>
            <p className="mt-4 max-w-[60ch] leading-relaxed text-body">
              Between two shades, a 4 × 4 Bayer matrix decides which pixels step up: half-way gives a checkerboard, a quarter every fourth pixel. Edges where one thing stands in front of another come from the depth buffer, drawn in the darkest shade, the way sprites were outlined. The giant Game Boy’s screen is already in four shades, so it skips the pattern.
            </p>
          </div>
          <div className="dm-how card">
            <Ramp palette={palette} dither={dither} />
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <div className="seg" role="group" aria-label="Palette">
                {PALETTE_ORDER.map((id) => (
                  <button key={id} type="button" aria-pressed={palette === id} onClick={() => setPalette(id)}>
                    {PALETTES[id].name}
                  </button>
                ))}
              </div>
              <button type="button" className="btn btn-ghost btn-sm" aria-pressed={dither} onClick={() => setDither((d) => !d)}>
                {dither ? 'Dithering on' : 'Dithering off'}
              </button>
            </div>
            <div className="mt-5 flex items-center gap-5">
              <ol className="dm-bayer" aria-label="The 4 by 4 Bayer matrix">
                {BAYER.map((n, i) => (
                  <li key={i} style={{ '--k': n * 5 }}>
                    {n}
                  </li>
                ))}
              </ol>
              <ul className="dm-swatches" aria-label={`The ${PALETTES[palette].name} palette`}>
                {PALETTES[palette].shades.map((s) => (
                  <li key={s} style={{ background: s }}>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="shell relative z-10 pb-24 md:pb-28">
        <p className="text-xs leading-relaxed text-muted">The island, its people and its tune are made in code for this site, so nothing is downloaded. The lettering is Press Start 2P (SIL Open Font License). Game Boy is a trademark of Nintendo; this page isn’t affiliated with Nintendo.</p>
      </section>
    </div>
  );
}
