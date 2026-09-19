import * as T from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { WETNESS_GLSL } from "./wetness";
import { courtyardFloorGeometry } from "./metro";
import { FLOOR_EAST, FLOOR_NORTH, FLOOR_SOUTH } from './layout.ts';
import type { MetroOpening } from '../../src/renderer/environment/metro-opening.ts';

/** One bounded planar reflection for the courtyard; patch mask preserves stone. */
export function createWetFloor(mobile: boolean, opening?: MetroOpening) {
  const floor = new Reflector(courtyardFloorGeometry(), {
    color: 0x88969b, textureWidth: mobile ? 384 : 768, textureHeight: mobile ? 384 : 768,
    clipBias: 0.001, multisample: 0,
  });
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.092;
  const mat = floor.material as T.ShaderMaterial;
  mat.transparent = true; mat.depthWrite = false;
  // Reflector uses a custom shader: opt into the same local clipping planes as
  // the stone/slab so reflected water cannot seal the stairwell in High mode.
  if (opening) {
    opening.apply(mat);
    mat.clipping = true;
    mat.vertexShader = mat.vertexShader
      .replace('#include <logdepthbuf_pars_vertex>', '#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>')
      .replace('#include <logdepthbuf_vertex>', '#include <logdepthbuf_vertex>\nvec4 mvPosition = modelViewMatrix * vec4(position, 1.0);\n#include <clipping_planes_vertex>');
    mat.fragmentShader = mat.fragmentShader
      .replace('#include <logdepthbuf_pars_fragment>', '#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>')
      .replace('#include <logdepthbuf_fragment>', '#include <clipping_planes_fragment>\n#include <logdepthbuf_fragment>');
  }
  mat.uniforms.waterTime = { value: 0 };
  mat.vertexShader = mat.vertexShader.replace("uniform mat4 textureMatrix;", "varying vec2 floorPoint; uniform mat4 textureMatrix;")
    .replace("vUv = textureMatrix", "floorPoint = position.xy; vUv = textureMatrix");
  mat.fragmentShader = mat.fragmentShader.replace("uniform vec3 color;", `
    uniform vec3 color; uniform float waterTime; varying vec2 floorPoint;
    ${WETNESS_GLSL}
  `).replace("vec4 base = texture2DProj( tDiffuse, vUv );", `
    vec2 uv=vUv.xy/vUv.w;
    vec2 ripple=vec2(sin(floorPoint.y*19.+waterTime*.7),cos(floorPoint.x*16.-waterTime*.6))*.00035;
    vec4 base=texture2D(tDiffuse,uv+ripple)*.40;
    base+=texture2D(tDiffuse,uv+ripple+vec2(.0014,0))*.15;
    base+=texture2D(tDiffuse,uv+ripple-vec2(.0014,0))*.15;
    base+=texture2D(tDiffuse,uv+ripple+vec2(0,.0014))*.15;
    base+=texture2D(tDiffuse,uv+ripple-vec2(0,.0014))*.15;
  `).replace("gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );", `
    float patches=refugeWetness(vec2(floorPoint.x,-floorPoint.y));
    float edge=(1.-smoothstep(${(FLOOR_EAST-1).toFixed(2)},${FLOOR_EAST.toFixed(2)},abs(floorPoint.x)))
      *(1.-smoothstep(${(FLOOR_SOUTH-1).toFixed(2)},${FLOOR_SOUTH.toFixed(2)},-floorPoint.y))
      *(1.-smoothstep(${(-FLOOR_NORTH-1).toFixed(2)},${(-FLOOR_NORTH).toFixed(2)},floorPoint.y));
    gl_FragColor=vec4(base.rgb*.82,edge*(.01+patches*.3));
  `);
  return floor;
}
