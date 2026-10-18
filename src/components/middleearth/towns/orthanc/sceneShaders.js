// Orthanc’s scene’s shader: Saruman’s robe of many colours, its patch
// moved here whole from ./scene.js, and ../../nodes/towns/orthanc/
// sceneShaders.js its twin on the node renderer.

// Bands of every colour down the robe, moving, and turning with the angle:
// `manyColours` patched, `robeTime` the scene’s clock for it.
export function manyColoursRobe(manyColours, robeTime) {
  manyColours.onBeforeCompile = (sh) => {
    sh.uniforms.uRobeTime = robeTime;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vRobe;")
      .replace(
        "#include <project_vertex>",
        "#include <project_vertex>\nvRobe = (modelMatrix * vec4(transformed, 1.0)).xyz;",
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float uRobeTime;\nvarying vec3 vRobe;\nvec3 robeHue(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }",
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float robeAngle = 1.0 - abs(dot(normalize(vViewPosition), normalize(vNormal)));
        diffuseColor.rgb *= mix(vec3(1.0), robeHue(fract(vRobe.y * 1.3 + robeAngle * 0.9 + uRobeTime * 0.2)), 0.6);`,
      );
  };
  manyColours.customProgramCacheKey = () => "orthanc-many-colours";
  return manyColours;
}
