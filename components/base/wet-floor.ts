import * as T from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { WETNESS_GLSL } from "./wetness";
import { courtyardWithMetroOpening } from "./metro";

/** One bounded planar reflection for the courtyard; patch mask preserves stone. */
export function createWetFloor(mobile: boolean) {
  const floor = new Reflector(courtyardWithMetroOpening(), {
    color: 0x88969b, textureWidth: mobile ? 384 : 768, textureHeight: mobile ? 384 : 768,
    clipBias: 0.001, multisample: 0,
  });
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.092;
  const mat = floor.material as T.ShaderMaterial;
  mat.transparent = true; mat.depthWrite = false;
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
    float edge=(1.-smoothstep(14.0,15.0,abs(floorPoint.x)))*(1.-smoothstep(11.,12.,abs(floorPoint.y)));
    gl_FragColor=vec4(base.rgb*.82,edge*(.01+patches*.3));
  `);
  return floor;
}
