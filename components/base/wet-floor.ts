import * as T from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { WETNESS_GLSL } from "./wetness";
import { courtyardFloorGeometry } from "./metro";
import { FLOOR_EAST, FLOOR_NORTH } from './layout.ts';
import { SAKURA_PARK } from '../../src/renderer/environment/sakura-park-layout.ts';
import { createParkPathMask } from '../../src/renderer/environment/park-ground.ts';
import type { MetroOpening } from '../../src/renderer/environment/metro-opening.ts';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { EAST_DISTRICT } from '../../src/renderer/environment/east-district-layout.ts';

/** One bounded planar reflection for the courtyard; patch mask preserves stone. */
export function createWetFloor(mobile: boolean, opening?: MetroOpening) {
  const courtyard=courtyardFloorGeometry(SAKURA_PARK.south);
  const extension=new T.PlaneGeometry(EAST_DISTRICT.east-FLOOR_EAST,EAST_DISTRICT.south-EAST_DISTRICT.north);
  extension.translate((EAST_DISTRICT.east+FLOOR_EAST)/2,-(EAST_DISTRICT.south+EAST_DISTRICT.north)/2,0);
  const geometry=mergeGeometries([courtyard,extension]);courtyard.dispose();extension.dispose();
  const floor = new Reflector(geometry, {
    // The floor covers a large area, but the rain-wet reflection is soft and
    // low contrast. A half-size desktop capture is visually close while greatly
    // reducing the extra scene render's fill cost.
    color: 0x88969b, textureWidth: mobile ? 384 : 512, textureHeight: mobile ? 384 : 512,
    clipBias: 0.001, multisample: 0,
  });
  // Reflector renders the visible scene into a second target from its reflected
  // camera in onBeforeRender. Refresh it at 25 Hz for gameplay; the main scene
  // still renders every frame and samples the last completed reflection.
  // Cinematic capture opts out below so offline frame sequences stay exact.
  const renderReflection = floor.onBeforeRender.bind(floor);
  let lastReflectionAt = Number.NEGATIVE_INFINITY;
  floor.userData.reflectionIntervalMs = mobile ? 0 : 40;
  floor.userData.forceReflectionUpdate = false;
  floor.onBeforeRender = (renderer, scene, camera, renderGeometry, renderMaterial, group) => {
    const now = performance.now();
    if (!floor.userData.forceReflectionUpdate && now - lastReflectionAt < floor.userData.reflectionIntervalMs) return;
    renderReflection(renderer, scene, camera, renderGeometry, renderMaterial, group);
    lastReflectionAt = now;
  };
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
  const parkMask=createParkPathMask();mat.uniforms.parkMask={value:parkMask};
  mat.addEventListener('dispose',()=>parkMask.dispose());
  mat.vertexShader = mat.vertexShader.replace("uniform mat4 textureMatrix;", "varying vec2 floorPoint; uniform mat4 textureMatrix;")
    .replace("vUv = textureMatrix", "floorPoint = position.xy; vUv = textureMatrix");
  mat.fragmentShader = mat.fragmentShader.replace("uniform vec3 color;", `
    uniform vec3 color; uniform float waterTime; uniform sampler2D parkMask; varying vec2 floorPoint;
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
      *(1.-smoothstep(${(SAKURA_PARK.south-1).toFixed(2)},${SAKURA_PARK.south.toFixed(2)},-floorPoint.y))
      *(1.-smoothstep(${(-FLOOR_NORTH-1).toFixed(2)},${(-FLOOR_NORTH).toFixed(2)},floorPoint.y));
    float parkPath=texture2D(parkMask,vec2((floorPoint.x+32.)/64.,(-floorPoint.y-12.)/22.)).r;
    float pathMask=-floorPoint.y>12.?parkPath:1.;
    if(floorPoint.x>31.0 && -floorPoint.y>${EAST_DISTRICT.north.toFixed(1)}) {
      float east=1.-smoothstep(${(EAST_DISTRICT.east-.8).toFixed(1)},${EAST_DISTRICT.east.toFixed(1)},floorPoint.x);
      float south=1.-smoothstep(33.,34.,-floorPoint.y);
      edge=max(edge,east*south);pathMask=1.;
    }
    gl_FragColor=vec4(base.rgb*.9,edge*pathMask*(.01+patches*(-floorPoint.y>12.?.48:.3)));
  `);
  return floor;
}
