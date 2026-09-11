import * as T from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {mergeGeometries,mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {MICROBUS} from './microbus-layout';

/** Authored T2-style wreck: apertures, curved roof, recessed lamps and interior are geometry. */
export function createMicrobus(scene:T.Scene,height:number,anisotropy:number){
  const root=new T.Group();root.name='Abandoned ivory microbus';
  const textures:T.Texture[]=[];
  const atlas=new T.TextureLoader().load('/game/vehicles/microbus/weathering-atlas.webp',loaded=>{textures.forEach(t=>{t.source=loaded.source;t.needsUpdate=true;});});
  atlas.colorSpace=T.SRGBColorSpace;textures.push(atlas);
  function texture(x:number,y:number){const t=new T.Texture();t.colorSpace=atlas.colorSpace;t.offset.set(x*.5+.002,y*.5+.002);t.repeat.set(.496,.496);t.anisotropy=Math.min(8,anisotropy);textures.push(t);return t;}
  // Populate each quadrant texture only after the atlas image has loaded.
  const paintMap=texture(0,1),rustMap=texture(1,1),glassMap=texture(0,0),rubberMap=texture(1,0);
  const paint=new T.MeshStandardMaterial({map:paintMap,bumpMap:paintMap,bumpScale:.022,roughness:.91,metalness:.18});
  const rust=new T.MeshStandardMaterial({map:rustMap,bumpMap:rustMap,bumpScale:.018,roughness:.96,metalness:.3});
  const rubber=new T.MeshStandardMaterial({map:rubberMap,bumpMap:rubberMap,bumpScale:.012,roughness:1});
  const glass=new T.MeshStandardMaterial({map:glassMap,color:'#94a5a8',roughness:.48,metalness:.12,transparent:true,opacity:.72,side:T.DoubleSide,depthWrite:false});
  const seal=new T.MeshStandardMaterial({color:'#222420',roughness:1});
  const seat=new T.MeshStandardMaterial({map:rubberMap,color:'#807461',roughness:1});
  const lens=new T.MeshStandardMaterial({color:'#ae582b',roughness:.48,metalness:.08});
  const silver=new T.MeshStandardMaterial({map:paintMap,color:'#a5a390',roughness:.57,metalness:.58});
  const crack=new T.MeshStandardMaterial({color:'#a6b1ad',transparent:true,opacity:.34,roughness:.8});
  const mats=[paint,rust,rubber,glass,seal,seat,lens,silver,crack];
  function add(g:T.BufferGeometry,m:T.Material,x=0,y=0,z=0,rx=0,ry=0,rz=0){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.rotation.set(rx,ry,rz);o.castShadow=m!==glass&&m!==crack;o.receiveShadow=true;root.add(o);return o;}
  function box(m:T.Material,x:number,y:number,z:number,w:number,h:number,d:number,r=.025){const geometry=r<=.015||Math.min(w,h,d)<.06?new T.BoxGeometry(w,h,d):new RoundedBoxGeometry(w,h,d,1,Math.min(r,w/3,h/3,d/3));return add(geometry,m,x,y,z);}
  function rod(m:T.Material,a:number[],b:number[],r:number){const av=new T.Vector3(...a as [number,number,number]),bv=new T.Vector3(...b as [number,number,number]),v=bv.clone().sub(av);const o=add(new T.CylinderGeometry(r,r,v.length(),7),m);o.position.copy(av.add(bv).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return o;}
  function ring(m:T.Material,x:number,y:number,z:number,r:number,t:number,ry=0){return add(new T.TorusGeometry(r,t,6,24),m,x,y,z,0,ry);}
  function rounded(w:number,h:number,r:number){const s=new T.Shape();s.moveTo(-w/2+r,-h/2);s.lineTo(w/2-r,-h/2);s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);s.lineTo(w/2,h/2-r);s.quadraticCurveTo(w/2,h/2,w/2-r,h/2);s.lineTo(-w/2+r,h/2);s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);s.lineTo(-w/2,-h/2+r);s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);return s;}
  function panel(s:T.Shape,m:T.Material,depth:number,x:number,y:number,z:number,ry=0){const g=new T.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:10});g.computeBoundingBox();const bounds=g.boundingBox!,size=bounds.getSize(new T.Vector3()),p=g.getAttribute('position'),uv=g.getAttribute('uv');for(let i=0;i<p.count;i++)uv.setXY(i,(p.getX(i)-bounds.min.x)/Math.max(size.x,.01),(p.getY(i)-bounds.min.y)/Math.max(size.y,.01));return add(g,m,x,y,z,0,ry);}
  // Side panels have actual wheel arches cut into the lower outline.
  for(const side of [-1,1]){
    const s=new T.Shape();s.moveTo(-2.62,.53);
    for(const cx of [-1.65,1.65]){s.lineTo(cx-.61,.53);for(let i=0;i<=24;i++){const a=Math.PI-i*Math.PI/24;s.lineTo(cx+Math.cos(a)*.61,.53+Math.sin(a)*.61);}}
    s.lineTo(2.62,.53);s.lineTo(2.7,1.5);s.quadraticCurveTo(2.68,1.65,2.56,1.67);s.lineTo(-2.64,1.67);s.closePath();panel(s,paint,.075,0,0,side>0?1.015:-1.09);
    for(const cx of [-1.65,1.65])for(let i=0;i<24;i++){const a=i*Math.PI/24,b=(i+1)*Math.PI/24;rod(rust,[cx+Math.cos(a)*.614,.53+Math.sin(a)*.614,side*1.095],[cx+Math.cos(b)*.614,.53+Math.sin(b)*.614,side*1.095],.025);}
    // Continuous rain gutter and beltline, separate black window gaskets.
    box(paint,0,2.68,side*1.005,5.34,.09,.13);box(rust,0,1.64,side*1.105,5.33,.065,.055);
    for(const [cx,w] of [[-2.03,.91],[-.99,.94],[.07,.94],[1.1,.88],[2.09,.87]]){
      const frame=rounded(w,1.0,.08),hole=rounded(w-.10,.87,.055);frame.holes.push(new T.Path(hole.getPoints()));panel(frame,paint,.065,cx,2.16,side>0?1.0:-1.065);
      const gasket=rounded(w-.07,.9,.065);gasket.holes.push(new T.Path(rounded(w-.12,.85,.055).getPoints()));panel(gasket,seal,.02,cx,2.16,side*1.025);
      panel(rounded(w-.13,.85,.05),glass,.008,cx,2.16,side*1.018);
    }
    // Door outlines, hinge knuckles, pull handles, sliding-door track.
    for(const x of [.55,1.57,2.59])rod(rust,[x,.65,side*1.10],[x,1.60,side*1.10],.012);
    box(rust,-.08,.62,side*1.108,2.55,.025,.018);box(silver,.25,1.37,side*1.14,.22,.06,.055);box(rust,.25,1.38,side*1.155,.11,.012,.03);
    box(silver,1.78,1.37,side*1.14,.20,.055,.065);
    for(const y of [.77,1.46])box(rust,2.56,y,side*1.12,.06,.12,.07);
    // Mirror brackets are bent metal tubes, with a separate recessed glass insert.
    rod(rust,[2.35,1.77,side*1.1],[2.25,1.93,side*1.32],.024);rod(rust,[2.25,1.93,side*1.32],[2.32,2.08,side*1.34],.024);
    box(paint,2.33,2.1,side*1.34,.24,.32,.075,.055);box(silver,2.33,2.1,side*1.385,.18,.25,.008,.04);
  }
  // Rounded bowed roof: sixteen crosswise strips curve into the gutters.
  const roofPos:number[]=[],roofUv:number[]=[],roofIndex:number[]=[];
  for(let i=0;i<=24;i++){const z=-1.07+i*2.14/24,y=2.68+.20*Math.sqrt(Math.max(0,1-(z/1.08)**2));for(const x of [-2.68,2.65]){roofPos.push(x,y,z);roofUv.push((x+2.68)/5.33,i/24);}if(i<24){const n=i*2;roofIndex.push(n,n+2,n+1,n+1,n+2,n+3);}}
  const roofGeo=new T.BufferGeometry();roofGeo.setAttribute('position',new T.Float32BufferAttribute(roofPos,3));roofGeo.setAttribute('uv',new T.Float32BufferAttribute(roofUv,2));roofGeo.setIndex(roofIndex);roofGeo.computeVertexNormals();add(roofGeo,paint);
  // Front nose and back wall; hollow passenger cabin remains visible through glass.
  box(paint,2.58,1.08,0,.23,1.15,2.1,.15);box(paint,-2.62,1.1,0,.15,1.15,2.10,.08);
  // Pressed front service panel seam follows the rounded apron instead of a flat decal.
  rod(rust,[2.713,.68,-.60],[2.713,.64,0],.009);rod(rust,[2.713,.64,0],[2.713,.68,.60],.009);
  for(const z of [-.60,.60])rod(rust,[2.713,.68,z],[2.713,1.18,z],.008);
  box(paint,-2.61,2.15,0,.12,1.02,2.08,.08);box(seal,-2.686,2.18,0,.025,.79,1.77,.10);box(glass,-2.704,2.18,0,.008,.70,1.65,.10);
  // Windshield is a sloped rounded shape with a real jagged missing region.
  const wind=rounded(1.94,.94,.16),wHole=new T.Path();const shards=[[.25,-.06],[.37,-.12],[.39,-.26],[.52,-.14],[.69,-.15],[.60,-.03],[.75,.07],[.58,.10],[.62,.24],[.49,.17],[.41,.29],[.36,.15],[.22,.17],[.26,.06],[.11,.04]];shards.forEach(([x,y],i)=>i?wHole.lineTo(x,y):wHole.moveTo(x,y));wHole.closePath();wind.holes.push(wHole);
  const win=panel(wind,glass,.008,2.515,2.16,0,Math.PI/2);win.rotation.order='ZYX';win.rotation.z=.19;
  const surround=rounded(2.10,1.10,.18);surround.holes.push(new T.Path(rounded(1.98,.98,.15).getPoints()));const frontFrame=panel(surround,paint,.07,2.52,2.16,0,Math.PI/2);frontFrame.rotation.order='ZYX';frontFrame.rotation.z=.19;
  const gasket=rounded(1.98,.98,.15);gasket.holes.push(new T.Path(rounded(1.93,.93,.14).getPoints()));const frontSeal=panel(gasket,seal,.015,2.528,2.16,0,Math.PI/2);frontSeal.rotation.order='ZYX';frontSeal.rotation.z=.19;
  // Spider cracks radiate from the missing glass, individually modeled hairlines.
  for(let i=0;i<13;i++){const a=i*2.399;const sy=.10+Math.sin(a)*.22,sz=-.43+Math.cos(a)*.22;const ey=T.MathUtils.clamp(sy+Math.sin(a)*.38,-.40,.40),ez=T.MathUtils.clamp(sz+Math.cos(a)*.48,-.9,.9);rod(crack,[2.54-sy*.19,2.16+sy,sz],[2.54-ey*.19,2.16+ey,ez],.003);}
  for(const z of [-.52,.48]){rod(rust,[2.64,1.73,z],[2.60,1.91,z+.28],.012);rod(seal,[2.63,1.80,z+.1],[2.56,2.07,z+.46],.015);}
  // Front indicator / grille band, circular recessed headlights and rolled bumpers.
  box(seal,2.712,1.39,0,.024,.25,1.86,.035);box(rust,2.731,1.39,0,.025,.19,1.35,.025);
  for(let i=0;i<38;i++)box(silver,2.75,1.39,-.64+i*.035,.018,.17,.009,.002);
  for(const side of [-1,1]){
    box(lens,2.75,1.39,side*.84,.045,.21,.28,.045);
    add(new T.CylinderGeometry(.235,.235,.055,24),seal,2.714,.88,side*.72,0,0,Math.PI/2);
    ring(rust,2.755,.88,side*.72,.232,.032,Math.PI/2);
    add(new T.SphereGeometry(.195,16,8),silver,2.725,.88,side*.72).scale.set(.20,1,1);
    box(lens,-2.725,1.17,side*.87,.035,.27,.13,.025);
    // Tires are compressed slightly into the ground and have individual tread blocks.
    for(const cx of [-1.65,1.65]){
      const wheel=add(new T.CylinderGeometry(.49,.49,.26,24),rubber,cx,.46,side*1.055,Math.PI/2);wheel.scale.z=.95;
      ring(rubber,cx,.46,side*1.198,.365,.095);ring(rust,cx,.46,side*1.217,.295,.036);
      add(new T.CylinderGeometry(.292,.292,.036,24),rust,cx,.46,side*1.23,Math.PI/2);
      add(new T.SphereGeometry(.235,16,8),silver,cx,.46,side*1.264).scale.set(1,1,.22);
      for(let i=0;i<5;i++){const a=i*Math.PI*2/5;add(new T.CylinderGeometry(.022,.022,.025,6),rust,cx+Math.cos(a)*.16,.46+Math.sin(a)*.16,side*1.285,Math.PI/2);}
      for(let i=0;i<40;i++){const a=i*Math.PI*2/40;for(const dz of [-.072,.072]){const tread=box(rubber,cx+Math.sin(a)*.489,.46+Math.cos(a)*.467,side*1.055+dz,.037,.022,.105,.003);tread.rotation.z=-a;tread.rotation.y=dz>0?.23:-.23;}}
    }
  }
  for(const x of [-2.75,2.79]){box(paint,x,.48,0,.22,.21,2.24,.09);box(silver,x+(x>0?.07:-.07),.56,0,.14,.045,2.2,.02);for(const z of [-.71,.71])box(rust,x,.46,z,.24,.17,.11,.035);}
  box(rust,0,.56,0,4.9,.12,1.87);box(seal,0,.67,0,4.9,.05,1.87);
  for(const x of [-1.67,-.6,.55,1.8])for(const z of [-.52,.52]){box(seat,x,.98,z,.54,.19,.69,.09);box(seat,x-.20,1.28,z,.16,.64,.69,.08);rod(rust,[x-.17,.7,z],[x-.17,.96,z],.025);}
  box(seal,2.16,1.63,0,.40,.15,1.91,.06);rod(rust,[1.98,1.1,.54],[2.08,1.7,.54],.027);const steering=ring(seal,2.08,1.72,.54,.20,.023);steering.rotation.y=Math.PI/2;steering.rotation.z=-.45;
  // Exhaust and rear engine vents are independent silhouette details.
  rod(rust,[-2.15,.28,-.65],[-2.91,.24,-.65],.041);
  for(let i=0;i<12;i++)box(seal,-2.711,1.49+i*.025,0,.014,.009,.85,.002);
  box(rust,-2.714,.98,0,.02,.025,1.45);box(seal,-2.733,.74,0,.018,.18,.5,.01);
  // Merge opaque detail by material, keeping the transparent glazing a separate batch.
  root.updateMatrixWorld(true);
  for(const m of mats){const meshes=root.children.filter(o=>o instanceof T.Mesh&&o.material===m) as T.Mesh[];if(!meshes.length)continue;const gs=meshes.map(o=>{let g=o.geometry.clone();g.applyMatrix4(o.matrixWorld);if(g.index){const expanded=g.toNonIndexed();g.dispose();g=expanded;}return g;});const merged=mergeGeometries(gs,false);gs.forEach(g=>g.dispose());if(merged){meshes.forEach(o=>{o.geometry.dispose();root.remove(o);});const indexed=mergeVertices(merged,1e-5);merged.dispose();add(indexed,m);}}
  root.position.set(MICROBUS.x,height,MICROBUS.z);scene.add(root);
  return {stream(p:{x:number;z:number}){root.visible=Math.hypot(p.x-MICROBUS.x,p.z-MICROBUS.z)<45;},dispose(){scene.remove(root);root.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});mats.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}};
}
