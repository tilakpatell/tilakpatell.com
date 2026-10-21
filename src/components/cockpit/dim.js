// What's out of the glass fading as the jump takes it, rather than gone in a
// frame: every light under it, every surface's colour and glow and an
// atmosphere's strength (space.js's planet: its `uStrength`), scaled from
// what each was when it was made. Nothing's program changes, only values.
//
// dimmer(...roots) → dim(k)   (k: 1 as made … 0 dark)

export function dimmer(...roots) {
  const was = [];
  const seen = new Set();
  const keep = (o, key, value) => {
    const id = `${o.uuid ?? ''}:${key}`;
    if (o.uuid && seen.has(id)) return;
    seen.add(id);
    was.push([o, key, value]);
  };
  for (const root of roots) {
    root?.traverse?.((o) => {
      if (o.isLight) keep(o, 'intensity', o.intensity);
      for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
        if (m.uniforms?.uStrength) keep(m, 'uStrength', m.uniforms.uStrength.value);
        else if (m.color?.isColor) keep(m, 'color', m.color.clone());
        if (typeof m.emissiveIntensity === 'number') keep(m, 'emissiveIntensity', m.emissiveIntensity);
      }
    });
  }
  return (k) => {
    for (const [o, key, value] of was) {
      if (key === 'color') o.color.copy(value).multiplyScalar(k);
      else if (key === 'uStrength') o.uniforms.uStrength.value = value * k;
      else o[key] = value * k;
    }
  };
}
