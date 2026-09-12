import * as T from 'three';

/** Reuses the generated concrete in atlas tile 0. The texture is sampled in
 * metres, never stretched over an entire pier or slab. No extra GPU textures. */
export function prepareConcreteUv(geometry:T.BufferGeometry,x:number,y:number,z:number) {
  geometry.computeBoundingBox();
  const size=geometry.boundingBox!.getSize(new T.Vector3());
  const uv=geometry.getAttribute('uv');
  const surface=new Float32Array(uv.count*4);
  const phase=(Math.sin(x*12.9898+y*7.233+z*37.719)*43758.5453)%1;
  // Torn legacy slabs are extrusions, whose material groups describe caps and
  // sides rather than the six box faces. Project each flat face in metres before
  // its placement rotation; their authored silhouette and normals stay intact.
  if(geometry.type!=='BoxGeometry'&&geometry.type!=='RoundedBoxGeometry'){
    const position=geometry.getAttribute('position'),normal=geometry.getAttribute('normal');
    const min=geometry.boundingBox!.min;
    for(let i=0;i<uv.count;i++){
      const nx=Math.abs(normal.getX(i)),ny=Math.abs(normal.getY(i)),nz=Math.abs(normal.getZ(i));
      const side=nx>=ny&&nx>=nz?0:ny>=nz?2:4;
      const w=side===0?size.z:size.x,h=side===2?size.z:size.y;
      const u=side===0?position.getZ(i)-min.z:position.getX(i)-min.x;
      const v=side===2?position.getZ(i)-min.z:position.getY(i)-min.y;
      surface.set([u,v,w,h],i*4);
      uv.setXY(i,u/2.8+phase*3.1+side*.37,v/2.8+phase*1.7);
    }
    geometry.setAttribute('concreteSurface',new T.BufferAttribute(surface,4));
    return;
  }
  for(const group of geometry.groups){
    const side=group.materialIndex??0;
    const w=side<2?size.z:size.x,h=side<2||side>3?size.y:size.z;
    for(let n=group.start;n<group.start+group.count;n++){
      const i=geometry.index?geometry.index.getX(n):n;
      // Indexed box vertices occur in several triangles. Read the original UV
      // once per face, before replacing it with the metric texture coordinate.
      if(surface[i*4+2]!==0)continue;
      const u=uv.getX(i),v=uv.getY(i);
      surface.set([u*w,v*h,w,h],i*4);
      uv.setXY(i,u*w/2.8+phase*3.1+side*.37,v*h/2.8+phase*1.7);
    }
  }
  geometry.setAttribute('concreteSurface',new T.BufferAttribute(surface,4));
}

export function createConcreteMaterial(atlas:T.Texture) {
  const material=new T.MeshStandardMaterial({map:atlas,bumpMap:atlas,bumpScale:.012,roughness:.94,vertexColors:true});
  material.name='Cyber / cold cast concrete';
  material.customProgramCacheKey=()=> 'cyber-concrete-metric-v1';
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nattribute vec4 concreteSurface;\nvarying vec4 vConcreteSurface;')
      .replace('#include <uv_vertex>','#include <uv_vertex>\nvConcreteSurface = concreteSurface;');
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>','#include <common>\nvarying vec4 vConcreteSurface;')
      .replace('#include <map_pars_fragment>',`#include <map_pars_fragment>
        // Mirror within the padded atlas tile. Explicit gradients avoid coarse
        // mip flashes at wrap boundaries and preserve distant pore filtering.
        vec4 concreteSample(vec2 uv) {
          vec2 tile = abs(fract(uv * 0.5) * 2.0 - 1.0);
          return textureGrad(map, (vec2(0.012, 2.012) + tile * 0.976) / 3.0,
            dFdx(uv) * (0.976 / 3.0), dFdy(uv) * (0.976 / 3.0));
        }
        float concreteLuma(vec3 value) { return dot(value, vec3(0.2126, 0.7152, 0.0722)); }
      `)
      .replace('#include <map_fragment>',`
        float concreteDetail = concreteLuma(concreteSample(vMapUv).rgb);
        // A second, broader offset sample breaks the repeated distinctive
        // stains without procedural grain or additional material buckets.
        float concreteCloud = concreteLuma(concreteSample(vMapUv * 0.371 + vec2(1.73, 0.39)).rgb);
        float concreteTone = 0.105 + concreteDetail * 0.56 + concreteCloud * 0.14;
        vec2 edgeDistance = min(vConcreteSurface.xy, vConcreteSurface.zw - vConcreteSurface.xy);
        float edgeDirt = (1.0 - smoothstep(0.0, 0.11, max(0.0, min(edgeDistance.x, edgeDistance.y))));
        // Formwork joints are millimetre-width marks, not dark repeated boards.
        // Only broad faces receive them; thin frame members stay cast concrete.
        vec2 jointUv = vConcreteSurface.xy / vec2(2.4, 3.0);
        vec2 jointDistance = abs(fract(jointUv + 0.5) - 0.5) * vec2(2.4, 3.0);
        vec2 jointAa = max(fwidth(vConcreteSurface.xy), vec2(0.002));
        vec2 joint = 1.0 - smoothstep(vec2(0.005), vec2(0.005) + jointAa, jointDistance);
        float formwork = max(joint.x * step(2.8, vConcreteSurface.z), joint.y * step(3.6, vConcreteSurface.w));
        concreteTone *= 1.0 - edgeDirt * 0.14 - formwork * 0.20;
        diffuseColor *= vec4(vec3(concreteTone) * vec3(0.98, 1.0, 1.025), 1.0);
      `)
      .replace('#include <roughnessmap_fragment>',`
        // Pores stay matte; accumulated damp grime has a slightly softer sheen.
        float roughnessFactor = clamp(0.91 + (0.4 - concreteDetail) * 0.12 - edgeDirt * 0.035, 0.85, 0.97);
      `)
      .replace('#include <bumpmap_pars_fragment>',T.ShaderChunk.bumpmap_pars_fragment
        .replace('texture2D( bumpMap, vBumpMapUv ).x','concreteLuma(concreteSample(vBumpMapUv).rgb)')
        .replace('texture2D( bumpMap, vBumpMapUv + dSTdx ).x','concreteLuma(concreteSample(vBumpMapUv + dSTdx).rgb)')
        .replace('texture2D( bumpMap, vBumpMapUv + dSTdy ).x','concreteLuma(concreteSample(vBumpMapUv + dSTdy).rgb)'));
  };
  return material;
}
