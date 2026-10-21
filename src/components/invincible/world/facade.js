// The city's towers painted in the shader, as lib/three/facade does for
// Think, Mark!, with more to them for a city you fly right up to: each
// tower its own palette (blue, teal, bronze or smoked glass; limestone,
// sandstone, granite or white concrete; red, brown or tan brick), corner
// a crown band under the roof, a tall glass lobby at the street,
// and the windows faded to their average where they'd be smaller than a
// pixel, so the skyline doesn't crawl when seen from far off. The windows
// reflect the sky by day and light up, floor by floor, at night. (Each
// tower's numbers reach the fragments `flat`: a hash of a value that wobbles
// across a wall, as an interpolated one can, comes out as noise.)

import * as THREE from 'three';

// what a tower's walls are (its style's first number)
export const SKIN = { glass: 0, stone: 1, brick: 2, concrete: 3 };

// The windows. By day, above the street's `street` storeys, a lighter pane
// (`tone`, toward which a glass tower's own tint goes by `tint`) with the
// sky in it at `reflect`, coloured by a glass tower's glass by `sky` (or the
// skyline goes one grey): the view off the glass, turned up if it points at
// the ground, since from over the roofs it would find the photo's earth and
// the windows went black holes again. The street's storeys keep their look,
// and the bake's colour at their feet. At dusk and night (`light`) the lit
// windows, the houses' too, as bright as they were times this.
export const WINDOWS = { reflect: 0.25, tone: [0.24, 0.29, 0.35], tint: 0.4, sky: 0.5, street: 2, light: 1.2 };
const num = (v) => Number(v).toFixed(3);
const glslVec = (c) => `vec3(${c.map(num).join(', ')})`;

export function towerMaterial(uniforms) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = uniforms.uNight;
    shader.uniforms.uBurn = uniforms.uBurn;
    shader.uniforms.uTint = uniforms.uTint;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aStyle;\nattribute float aHurt;\nvarying vec3 vCity;\nvarying vec3 vCityN;\nflat varying vec4 vStyle;\nflat varying float vHurt;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        {
          mat4 im = modelMatrix;
          #ifdef USE_INSTANCING
            im = modelMatrix * instanceMatrix;
          #endif
          vCity = (im * vec4(transformed, 1.0)).xyz;
          vCityN = normalize(mat3(im) * objectNormal);
          vStyle = aStyle;
          vHurt = aHurt;
        }`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uNight;
        uniform float uBurn;
        uniform vec3 uTint;
        varying vec3 vCity;
        varying vec3 vCityN;
        flat varying vec4 vStyle;
        flat varying float vHurt;
        float cityHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float box(vec2 f, vec4 r) { return step(r.x, f.x) * step(f.x, r.y) * step(r.z, f.y) * step(f.y, r.w); }
        vec3 srgb(vec3 c) { return pow(c, vec3(2.2)); }
        vec3 pick4(float k, vec3 a, vec3 b, vec3 c, vec3 d) { return k < 0.25 ? a : k < 0.5 ? b : k < 0.75 ? c : d; }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 cn = normalize(vCityN);
        float kind = vStyle.x;
        float tone = vStyle.y;
        float seed = vStyle.z;
        float top = vStyle.w; // the roof's height
        float roof = step(0.6, cn.y);
        float u = abs(cn.x) > 0.5 ? vCity.z : vCity.x;
        float glassK = 1.0 - step(0.5, kind);
        float stoneK = step(0.5, kind) * (1.0 - step(1.5, kind));
        float brickK = step(1.5, kind) * (1.0 - step(2.5, kind));
        float concK = step(2.5, kind);
        float fh = glassK * 3.9 + stoneK * 3.7 + brickK * 3.2 + concK * 3.5;
        float cw = glassK * 1.6 + stoneK * 2.9 + brickK * 2.6 + concK * 4.2;
        vec2 cell = vec2(u / cw, vCity.y / fh);
        vec2 f = fract(cell);
        vec2 wid = floor(cell);
        float win = glassK * box(f, vec4(0.04, 0.96, 0.1, 0.94))
          + stoneK * box(f, vec4(0.22, 0.78, 0.25, 0.85))
          + brickK * box(f, vec4(0.25, 0.75, 0.28, 0.86))
          + concK * box(f, vec4(0.06, 0.94, 0.32, 0.82));
        // windows smaller than a pixel: their average instead
        vec2 fw = fwidth(cell);
        float avgWin = glassK * 0.8 + stoneK * 0.31 + brickK * 0.28 + concK * 0.44;
        win = mix(win, avgWin, smoothstep(0.22, 0.6, max(fw.x, fw.y)));
        // the street floor: a tall lobby of glass; the top: a crown of plain wall
        float lobby = 1.0 - step(5.2, vCity.y);
        float crown = step(top - 3.2, vCity.y) * step(14.0, top);
        float street = lobby * box(vec2(fract(u / 6.0), vCity.y), vec4(0.06, 0.94, 0.3, 4.6));
        win = mix(win, street, lobby) * (1.0 - roof) * (1.0 - crown);
        // each tower's colours
        float k = fract(seed * 7.13 + tone * 0.37);
        vec3 wall = glassK * srgb(pick4(k, vec3(0.55, 0.62, 0.7), vec3(0.42, 0.6, 0.62), vec3(0.62, 0.55, 0.45), vec3(0.36, 0.38, 0.42)))
          + stoneK * srgb(pick4(k, vec3(0.78, 0.74, 0.66), vec3(0.72, 0.62, 0.48), vec3(0.58, 0.57, 0.56), vec3(0.85, 0.84, 0.8)))
          + brickK * srgb(pick4(k, vec3(0.55, 0.27, 0.2), vec3(0.45, 0.3, 0.24), vec3(0.7, 0.55, 0.42), vec3(0.36, 0.22, 0.2)))
          + concK * srgb(mix(vec3(0.78, 0.78, 0.76), vec3(0.9, 0.89, 0.86), tone));
        wall *= 0.9 + 0.2 * tone;
        // a floor's band of spandrel, the crown a shade lighter, grime toward the street
        wall *= 0.93 + 0.07 * step(0.5, fract(vCity.y / fh + 0.35));
        wall *= mix(1.0, 1.18, crown);
        wall *= 0.78 + 0.22 * smoothstep(0.0, 22.0, vCity.y);
        float pane = cityHash(wid + seed * 13.0);
        vec3 tint = glassK * srgb(pick4(k, vec3(0.2, 0.3, 0.42), vec3(0.12, 0.3, 0.32), vec3(0.32, 0.24, 0.14), vec3(0.1, 0.11, 0.13)))
          + (1.0 - glassK) * srgb(vec3(0.12, 0.15, 0.19));
        vec3 glass = tint * (0.75 + 0.5 * pane);
        // (by day: 1 at noon, gone by dusk; never in the street's storeys)
        float cityDay = (1.0 - smoothstep(0.0, 0.5, uNight)) * step(${num(WINDOWS.street)} * fh, vCity.y);
        vec3 paneTone = srgb(${glslVec(WINDOWS.tone)});
        vec3 dayPane = glassK * mix(tint, paneTone, ${num(WINDOWS.tint)}) + (1.0 - glassK) * paneTone;
        glass = mix(glass, dayPane * (0.85 + 0.3 * pane), cityDay);
        vec3 daySky = mix(vec3(1.0), dayPane / max(dot(dayPane, vec3(0.2126, 0.7152, 0.0722)), 1e-3), ${num(WINDOWS.sky)} * glassK);
        vec3 roofC = srgb(vec3(0.36, 0.36, 0.37)) * (0.8 + 0.35 * cityHash(floor(vCity.xz * 0.4)));
        diffuseColor.rgb = mix(mix(wall, glass, win), roofC, roof);
        float cityWin = win;
        // the damage (./demolish.js, 0 to 1): cracks and dark panes as it climbs,
        // the roof and a band under it scorched once the top is gone
        // (uBurn: a dimension where every tower is hurt this much, ./dimensions.js)
        float hurt = max(vHurt, uBurn);
        if (hurt > 0.0) {
          float crack = step(1.0 - hurt * 0.55, cityHash(floor(vec2(u, vCity.y) * 0.7) + seed)) * (1.0 - roof);
          float gone = smoothstep(0.55, 0.65, hurt);
          float soot = gone * smoothstep(top - 9.0, top - 1.0, vCity.y) * (1.0 - roof);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.35, crack);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.03, 0.028, 0.026), max(soot, hurt * win * 0.6));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.1, 0.095, 0.09), roof * gone);
          cityWin *= 1.0 - hurt * 0.8;
        }
        diffuseColor.rgb *= uTint;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(mix(0.85, 0.5, glassK), 0.05 + 0.1 * pane, cityWin);`,
      )
      .replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>
        metalnessFactor = mix(0.4 * glassK, mix(0.9, 0.15, cityDay), cityWin);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        #if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
        {
          // the sky in the day's panes (WINDOWS)
          vec3 rv = transformDirectionByInverseViewMatrix(reflect(-normalize(vViewPosition), normal), viewMatrix);
          rv.y = abs(rv.y);
          vec3 skyIn = textureCubeUV(envMap, envMapRotation * normalize(rv), 0.2).rgb * envMapIntensity;
          totalEmissiveRadiance += skyIn * daySky * ${num(WINDOWS.reflect)} * cityWin * cityDay;
        }
        #endif
        {
          // a lit window, here and there: whole floors of an office, a few flats
          float floorOn = step(0.55, cityHash(vec2(wid.y, seed * 9.0)));
          float lit = step(mix(0.86, 0.55, floorOn), cityHash(wid * 1.7 + seed * 5.0));
          vec3 warm = mix(vec3(1.0, 0.68, 0.36), vec3(0.72, 0.84, 1.0), step(0.72, cityHash(wid + seed)));
          vec3 glow = lit * warm * (0.22 + 0.4 * cityHash(wid * 3.1 + seed));
          // (where windows are under a pixel, what a wall of them comes to, as
          // by day: one window on or off a pixel at random is noise from the air)
          glow = mix(glow, vec3(0.12, 0.094, 0.07), smoothstep(0.22, 0.6, max(fw.x, fw.y)));
          totalEmissiveRadiance += glow * cityWin * uNight * ${num(WINDOWS.light)};
          totalEmissiveRadiance += street * lobby * uNight * vec3(1.0, 0.85, 0.6) * ${num(0.3 * WINDOWS.light)};
          // the crown lit from below on the tall ones
          totalEmissiveRadiance += crown * step(90.0, top) * uNight * vec3(0.9, 0.85, 0.75) * 0.25;
          diffuseColor.rgb *= 1.0 - 0.5 * uNight * (1.0 - cityWin);
        }`,
      );
  };
  m.customProgramCacheKey = () => 'inv-tower';
  return m;
}

// Boxes as instances, one draw: [{ x, y, z, w, h, d, kind, tone, seed }],
// each standing on its y (0 unless given).
export function towerField(list, material) {
  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  // (no bottoms: nobody sees under a building)
  geo.setIndex(Array.from(geo.index.array).filter((_, i) => i < 18 || i >= 24));
  const style = new Float32Array(list.length * 4);
  const hurt = new Float32Array(list.length); // the damage, 0 to 1 (./demolish.js; ./city.js writes it)
  const mesh = new THREE.InstancedMesh(geo, material, list.length);
  const m = new THREE.Matrix4();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  list.forEach((b, i) => {
    mesh.setMatrixAt(i, m.compose(p.set(b.x, b.y ?? 0, b.z), q, s.set(b.w, b.h, b.d)));
    style.set([b.kind, b.tone, b.seed, (b.y ?? 0) + b.h], i * 4);
  });
  geo.setAttribute('aStyle', new THREE.InstancedBufferAttribute(style, 4));
  geo.setAttribute('aHurt', new THREE.InstancedBufferAttribute(hurt, 1));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}
