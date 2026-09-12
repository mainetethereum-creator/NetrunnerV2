import * as T from 'three';
import type {Point} from './config';

/** Small decorative props fade out with opaque screen-door coverage. The full
 * mesh/material remains untouched within 27 m; architectural silhouettes never
 * enter this detail LOD. No transparent duplicate or per-frame material clone. */
export function createDistanceDetail(){
  const focus={value:new T.Vector2()},materials=new Map<T.Material,T.Material>();
  const entries:{root:T.Object3D;sphere:T.Sphere;detail:boolean}[]=[],frustum=new T.Frustum(),matrix=new T.Matrix4();
  let culled=0;
  function material(source:T.Material){
    const existing=materials.get(source);if(existing)return existing;
    const copy=source.clone(),compile=source.onBeforeCompile,cacheKey=source.customProgramCacheKey();
    copy.onBeforeCompile=(shader,renderer)=>{
      compile.call(source,shader,renderer);shader.uniforms.detailFocus=focus;
      shader.vertexShader=`varying vec2 detailWorldXZ;\n${shader.vertexShader}`.replace('#include <project_vertex>',`detailWorldXZ=(modelMatrix*vec4(transformed,1.)).xz;\n#include <project_vertex>`);
      shader.fragmentShader=`uniform vec2 detailFocus;varying vec2 detailWorldXZ;\n${shader.fragmentShader}`.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
        float detailCoverage=1.-smoothstep(27.,44.,distance(detailWorldXZ,detailFocus));
        float detailNoise=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
        if(detailCoverage<detailNoise)discard;
      `);
    };
    copy.customProgramCacheKey=()=>`${cacheKey}|distance-detail-v1`;materials.set(source,copy);return copy;
  }
  return {
    add(root:T.Object3D){
      root.updateWorldMatrix(true,true);const bounds=new T.Box3().setFromObject(root),size=bounds.getSize(new T.Vector3());
      // Fire deformation must remain owned by its animation; buildings, fences
      // and containers retain their geometry. Only sub-3.5 m props fade.
      const detail=Math.max(size.x,size.y,size.z)<3.5&&root.userData.authoredAsset!=='campfire';
      if(detail)root.traverse(o=>{if(o instanceof T.Mesh&&!(o instanceof T.InstancedMesh)){o.material=Array.isArray(o.material)?o.material.map(material):material(o.material);}});
      const sphere=bounds.getBoundingSphere(new T.Sphere());sphere.radius+=1;
      entries.push({root,sphere,detail});
    },
    update(p:Point,camera?:T.Camera){
      focus.value.set(p.x,p.z);culled=0;
      if(camera){camera.updateMatrixWorld();frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));}
      for(const entry of entries){const {root,sphere,detail}=entry,distance=Math.hypot(p.x-sphere.center.x,p.z-sphere.center.z)-sphere.radius;
        // Offscreen nearby casters stay in the shadow pass. Far groups can be
        // skipped altogether (Three's per-mesh frustum test remains enabled).
        root.visible=(!detail||distance<44)&&(distance<28||!camera||frustum.intersectsSphere(sphere));
        if(!root.visible)culled++;
      }
    },
    get culled(){return culled;},
    dispose(){for(const material of materials.values())material.dispose();materials.clear();entries.length=0;},
  };
}
