// A world seen from across the map, shaded by its own star: keyHook(mat,
// key, sun) swaps the scene's key light's direction for `sun` (the world's
// own, a Vector3 in world space) inside three's light loop. The key is found
// by its direction (`key`: { value: Vector3 }, shared, set from the key light
// each frame), whatever order the lights are in; the fill and any other light
// are left alone. Apply it last of a material's hooks: it expands three's
// light loop, so a hook after it couldn't find that include. (It defines
// KEY_SUN, so a hook before it can tell its sun from the fill: celShade.)

import * as THREE from 'three';

export function keyHook(mat, key, sun) {
  const prev = mat.onBeforeCompile;
  const prevKey = Object.hasOwn(mat, 'customProgramCacheKey') ? mat.customProgramCacheKey : null;
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    shader.uniforms.uKeyW = key;
    shader.uniforms.uKeySunW ??= { value: sun };
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\n#define KEY_SUN\nuniform vec3 uKeyW;\nuniform vec3 uKeySunW;').replace(
      '#include <lights_fragment_begin>',
      THREE.ShaderChunk.lights_fragment_begin.replace(
        'getDirectionalLightInfo( directionalLight, directLight );',
        `getDirectionalLightInfo( directionalLight, directLight );
        if ( dot( directLight.direction, normalize( ( viewMatrix * vec4( uKeyW, 0.0 ) ).xyz ) ) > 0.9999 ) directLight.direction = normalize( ( viewMatrix * vec4( uKeySunW, 0.0 ) ).xyz );`,
      ),
    );
  };
  mat.customProgramCacheKey = () => `sun${prevKey ? `-${prevKey.call(mat)}` : ''}`;
}
