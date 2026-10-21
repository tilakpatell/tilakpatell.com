// The GLSL ./props.js's kit patches its materials with, kept apart so the
// node renderer's twin (../nodes/shire/propsShaders.js) can stand in for it.

// the flowers' heads take an instance's colour, their stems don't: the
// geometry's `tint` (1 on the petals) says how much
export function flowerTint(material) {
  material.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <color_pars_vertex>', '#include <color_pars_vertex>\nattribute float tint;').replace(
      '#include <color_vertex>',
      `#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR )
        vColor = vec4( 1.0 );
      #endif
      #if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
        vColor.rgb *= color.rgb;
      #endif
      #ifdef USE_INSTANCING_COLOR
        vColor.rgb *= mix( vec3( 1.0 ), instanceColor.rgb, tint );
      #endif`,
    );
  };
}
