// A space level's weather and lamps for its area of its own (galaxy/
// levelArea.js: Kamino's storm over Tipoca City), from the game's map
// extras (`web/maps/<level>/<name>.extras.json`, the bucket's maps README):
//
//   glows     its placed lights (`lights[]`) as glows: where, the colour
//             (linear, normalised: the hue, not the strength) and how big,
//             by the log of the lamp's lumens and its reach
//   blinkers  the level's blinking beacons (an effect named `Blinking`)
//   strikes   where the level's lightning strikes (`LightningStrike`)
//   clouds    its backlit clouds (`Backlight_Clouds`)
//
// all in the game's metres, of the sub-levels the pack draws (`subs`), the
// cinematics', the other modes' and the lobby's left out. Pure: the script
// (scripts/bf2017-area.mjs) fetches and writes.
//
// areaJson(extras, manifest, { subs }) → { format, glows: [[x, y, z, r, g, b, size]], blinkers, strikes, clouds: [[x, y, z]] }

const r1 = (v) => Math.round(v * 10) / 10;
const r3 = (v) => Math.round(v * 1000) / 1000;
const last = (p) => String(p).split('/').pop().toLowerCase();

const EFFECTS = { blinkers: /blinkinglights/i, strikes: /lightningstrike/i, clouds: /backlight_clouds/i };

export function areaJson(extras, manifest, { subs }) {
  const want = new Set(subs.map((s) => s.toLowerCase()));
  const subOf = (i) => last(manifest.subworlds[i]?.name ?? manifest.subworlds[i] ?? '');
  const inArea = (o) => want.has(subOf(o.sub));
  const at = (o) => o.position.map(r1);
  const glows = [];
  let skipped = 0;
  for (const l of extras.lights ?? []) {
    if (!inArea(l)) continue;
    if (l.Enabled === false || (l.Dimmer ?? 1) <= 0 || !(l.Intensity > 0) || !Array.isArray(l.Color)) {
      skipped += 1;
      continue;
    }
    const top = Math.max(...l.Color, 1e-6);
    const c = l.Color.map((v) => r3(Math.max(0, v) / top));
    // (a glow's size: the lamp's strength on a log scale, held to its reach)
    const size = r1(Math.min(l.AttenuationRadius ?? 50, Math.max(4, Math.log10(l.Intensity * (l.Dimmer ?? 1)) * 6)));
    glows.push([...at(l), ...c, size]);
  }
  const out = { format: 1, glows, blinkers: [], strikes: [], clouds: [], skipped };
  for (const e of extras.effects ?? []) {
    if (!inArea(e)) continue;
    for (const [k, re] of Object.entries(EFFECTS)) if (re.test(e.effect ?? '')) out[k].push(at(e));
  }
  return out;
}
