import * as T from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {mergeGeometries,mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {fenceLength} from './fence-layout.ts';

export const SECURITY_FENCE_PROPS=[
  {id:'concrete-security-fence',name:'Забор · сборный бетон',category:'Ограждения',description:'Секции 3 м · литые панели, опорные башмаки и монтажные петли'},
  {id:'powered-mesh-fence',name:'Забор · энергопериметр',category:'Ограждения',description:'Секции 3 м · бетон, стальная решётка, кабелепровод и голубые маяки'},
] as const;
export type SecurityFenceId=typeof SECURITY_FENCE_PROPS[number]['id'];

/** Owns only geometry/materials. Reuses the city's generated atlas and does not
 * download textures, allocate lights, or create a texture per section. */
export function createSecurityFenceLibrary(atlas:T.Texture){
  const surface=(tile:number,color:string,metalness:number)=>{
    const m=new T.MeshStandardMaterial({map:atlas,bumpMap:atlas,bumpScale:.009,color,roughness:metalness?.8:.95,metalness,vertexColors:true});
    m.name=metalness?'Fence / weathered steel':'Fence / cast concrete';
    m.customProgramCacheKey=()=>`security-fence-surface-${tile}`;
    m.onBeforeCompile=shader=>{
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_pars_fragment>',`#include <map_pars_fragment>
        vec4 fenceSample(vec2 uv) {
          vec2 tileUv=abs(fract(uv*.5)*2.0-1.0);
          return textureGrad(map,(vec2(${tile%3}.012,${2-Math.floor(tile/3)}.012)+tileUv*.976)/3.0,dFdx(uv)*(.976/3.0),dFdy(uv)*(.976/3.0));
        }
      `).replace('#include <map_fragment>','diffuseColor *= fenceSample(vMapUv);')
      .replace('#include <bumpmap_pars_fragment>',T.ShaderChunk.bumpmap_pars_fragment
        .replace('texture2D( bumpMap, vBumpMapUv ).x','fenceSample(vBumpMapUv).x')
        .replace('texture2D( bumpMap, vBumpMapUv + dSTdx ).x','fenceSample(vBumpMapUv + dSTdx).x')
        .replace('texture2D( bumpMap, vBumpMapUv + dSTdy ).x','fenceSample(vBumpMapUv + dSTdy).x'));
    };return m;
  };
  const mats=[surface(1,'#b7b8b1',0),surface(5,'#9caaa9',.68),new T.MeshStandardMaterial({color:'#323b3b',metalness:.66,roughness:.74,vertexColors:true}),new T.MeshStandardMaterial({color:'#62e7ef',emissive:'#09e6f4',emissiveIntensity:2.2,roughness:.38,vertexColors:true})];
  const cache=new Map<string,T.Group>();
  function build(id:SecurityFenceId,length:number){
    const buckets=new Map<number,T.BufferGeometry[]>(),powered=id==='powered-mesh-fence';
    function add(g:T.BufferGeometry,m:number,x=0,y=0,z=0,rx=0,ry=0,rz=0){
      g.applyMatrix4(new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromEuler(new T.Euler(rx,ry,rz)),new T.Vector3(1,1,1)));
      const pos=g.getAttribute('position'),normal=g.getAttribute('normal'),uv=g.getAttribute('uv'),colors=[];
      for(let i=0;i<pos.count;i++){
        const nx=Math.abs(normal.getX(i)),ny=Math.abs(normal.getY(i)),nz=Math.abs(normal.getZ(i));
        // Metre-space projection keeps concrete pores and corrosion the same size
        // on small caps, piers and long panels, even at the maximum fence length.
        uv.setXY(i,(nx>nz?pos.getZ(i):pos.getX(i))/1.7, (ny>.7?pos.getZ(i):pos.getY(i))/1.7);
        const foot=T.MathUtils.smoothstep(pos.getY(i),0,.48),tone=m===0?.72+.25*foot:1;
        colors.push(tone,tone,m===0?tone*.985:tone);
      }
      g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
      const list=buckets.get(m)??[];list.push(g);buckets.set(m,list);
    }
    const box=(w:number,h:number,d:number,m:number,x=0,y=0,z=0,rz=0)=>add(new T.BoxGeometry(w,h,d),m,x,y,z,0,0,rz);
    const cast=(w:number,h:number,d:number,x:number,y:number,z=0)=>add(new RoundedBoxGeometry(w,h,d,1,.025),0,x,y,z);
    const rod=(a:number[],b:number[],r:number,m=1)=>{const start=new T.Vector3().fromArray(a),end=new T.Vector3().fromArray(b),g=new T.CylinderGeometry(r,r,start.distanceTo(end),6);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),end.clone().sub(start).normalize()));g.translate(...start.add(end).multiplyScalar(.5).toArray());add(g,m);};
    const bolt=(x:number,y:number,z:number)=>add(new T.CylinderGeometry(.025,.025,.025,6),1,x,y,z,Math.PI/2);
    // A chamfered buttress with an actual forklift notch, not a painted square.
    function foot(x:number){
      const w=powered?.68:.58,d=powered?.84:.92;
      const shape=new T.Shape();shape.moveTo(-w/2,0);shape.lineTo(-.09,0);shape.lineTo(-.09,.085);shape.lineTo(.09,.085);shape.lineTo(.09,0);shape.lineTo(w/2,0);shape.lineTo(w/2,.28);shape.lineTo(w*.36,.61);shape.lineTo(-w*.36,.61);shape.lineTo(-w/2,.28);shape.closePath();
      const g=new T.ExtrudeGeometry(shape,{depth:d-.03,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.015,bevelThickness:.015,curveSegments:1});g.translate(0,.015,-d/2+.015);add(g,0,x);
      if(powered)for(const z of [-1,1]){box(w*.78,.14,.025,1,x,.25,z*d/2);for(const dx of [-.19,.19])bolt(x+dx,.25,z*(d/2+.019));}
    }
    const count=length/3;
    for(let k=0;k<=count;k++){
      const x=-length/2+k*3;foot(x);cast(.44,2.55,.48,x,1.48);
      if(powered){
        box(.52,.3,.56,1,x,2.61);box(.56,.055,.6,2,x,2.46);box(.56,.055,.6,1,x,2.77);
        // Both sides carry a beacon; rotation never turns the detail into a blank back.
        for(const side of [-1,1]){
          box(.145,.53,.055,1,x,2.08,side*.275);box(.074,.34,.019,2,x,2.12,side*.311);box(.032,.285,.02,3,x,2.12,side*.324);
          for(const dx of [-.17,.17])for(const y of [2.54,2.69])bolt(x+dx,y,side*.294);
          rod([x-.035,1.82,side*.29],[x-.035,1.35,side*.29],.02);
          bolt(x,1.87,side*.315);
        }
      }else{
        cast(.48,.075,.52,x,2.8);
        for(const z of [-.11,.11]){box(.038,.16,.045,1,x-.11,2.91,z);box(.038,.16,.045,1,x+.11,2.91,z);box(.258,.04,.045,1,x,2.99,z);}
        for(const side of [-1,1])for(const dx of [-.11,.11])box(.007,2.02,.005,2,x+dx,1.58,side*.242);
      }
    }
    for(let k=0;k<count;k++){
      const x=-length/2+1.5+k*3;
      if(!powered){
        cast(2.58,.42,.34,x,.25);cast(2.58,1.04,.25,x,.999);cast(2.58,1.04,.25,x,2.059);
        cast(2.62,.075,.3,x,2.62);
        for(const side of [-1,1])for(const px of [-.9,.9])for(const y of [.63,2.37]){
          box(.025,.036,.004,2,x+px,y,side*.129);
        }
      }else{
        cast(2.58,1.3,.32,x,.675);cast(2.63,.08,.4,x,1.36);
        for(const y of [1.46,2.58])box(2.59,.065,.065,1,x,y);
        for(const dx of [-1.275,0,1.275]){box(.055,1.16,.085,1,x+dx,2.02);for(const y of [1.52,2.52])for(const side of [-1,1])bolt(x+dx,y,side*.06);}
        // Real open diamond lattice, clipped to its frame. Each strip is a
        // four-sided low-poly beam, merged into the steel material bucket.
        const left=-1.25,right=1.25,bottom=1.5,top=2.54,slope=.64;
        for(const sign of [-1,1])for(let j=-16;j<=16;j++){
          const intercept=2.02+j*.145;
          const a=Math.max(left,Math.min((bottom-intercept)/(sign*slope),(top-intercept)/(sign*slope)));
          const b=Math.min(right,Math.max((bottom-intercept)/(sign*slope),(top-intercept)/(sign*slope)));
          if(b-a<.02)continue;
          const ya=intercept+sign*slope*a,yb=intercept+sign*slope*b;
          box(Math.hypot(b-a,yb-ya),.017,.02,1,x+(a+b)/2,(ya+yb)/2,sign*.012,Math.atan2(yb-ya,b-a));
        }
        for(const side of [-1,1]){
          const z=side*.21;
          for(const y of [1.13,1.23])rod([x-1.25,y,z],[x+.82,y,z],.019);
          rod([x+.81,1.13,z],[x+.81,.86,z],.019);rod([x+.84,.4,z],[x+.84,.08,z],.022);
          box(.36,.46,.13,1,x+.86,.85,z);box(.285,.37,.018,2,x+.86,.85,z+side*.08);box(.105,.14,.02,1,x+.86,.9,z+side*.1);
          for(const dx of [-.13,.13])for(const dy of [-.17,.17])bolt(x+.86+dx,.85+dy,z+side*.103);
          for(const dx of [-1.03,-.2,.58]){box(.07,.21,.07,1,x+dx,1.18,z);bolt(x+dx,1.18,z+side*.045);}
        }
      }
    }
    const root=new T.Group();root.name=SECURITY_FENCE_PROPS.find(p=>p.id===id)!.name;
    for(const [m,gs]of buckets){const flat=gs.map(g=>g.index?g.toNonIndexed():g),merged=mergeGeometries(flat)!;const geo=mergeVertices(merged);merged.dispose();flat.forEach((g,i)=>{if(g!==gs[i])g.dispose();});gs.forEach(g=>g.dispose());const mesh=new T.Mesh(geo,mats[m]);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);}
    return root;
  }
  return {create(id:SecurityFenceId,length=3){const l=fenceLength(length),key=id+':'+l;let root=cache.get(key);if(!root){root=build(id,l);cache.set(key,root);}return root.clone(true);},dispose(){cache.forEach(root=>root.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();}));mats.forEach(m=>m.dispose());}};
}
