import * as T from 'three';
import {RULES,type Point} from './config';
import {FOUNTAIN,RUIN_WALLS} from './nature-layout';
import {TREES} from './world';
import {terrainHeight} from './terrain';
import {createRefugeMaterials} from '../base/materials';

export function createNature(scene:T.Scene,surfaces:ReturnType<typeof createRefugeMaterials>){
  const stone=new T.MeshStandardMaterial({roughness:.94});surfaces.apply(stone,'concrete',.85);stone.color.set('#6f7770');
  const bark=new T.MeshStandardMaterial({color:'#453329',roughness:1});
  const moss=new T.MeshStandardMaterial({color:'#505637',roughness:1});
  const dark=new T.MeshStandardMaterial({color:'#111f22',roughness:.55,metalness:.25});
  const cyan=new T.MeshStandardMaterial({color:'#8ee7ec',emissive:'#56b7c9',emissiveIntensity:1.4});
  const wax=new T.MeshStandardMaterial({color:'#d2c9aa',roughness:.9});
  const fire=new T.MeshBasicMaterial({color:'#ffdb8e'});
  const box=new T.BoxGeometry(1,1,1),branch=new T.CylinderGeometry(.65,1,1,7),rubble=new T.DodecahedronGeometry(1,0);
  type Batch={g:T.BufferGeometry;m:T.Material;data:T.Matrix4[]};
  const batches=new Map<string,Map<string,Batch>>(),groups=new Map<string,T.Group>();
  function add(g:T.BufferGeometry,m:T.Material,p:T.Vector3,scale:T.Vector3,q=new T.Quaternion()){
    const key=`${Math.floor(p.x/RULES.chunkSize)},${Math.floor(p.z/RULES.chunkSize)}`;if(!batches.has(key))batches.set(key,new Map());const map=batches.get(key)!,id=`${g.uuid}:${m.uuid}`;if(!map.has(id))map.set(id,{g,m,data:[]});map.get(id)!.data.push(new T.Matrix4().compose(p,q,scale));
  }
  function beam(a:T.Vector3,b:T.Vector3,r:number){const delta=b.clone().sub(a);add(branch,bark,a.clone().add(b).multiplyScalar(.5),new T.Vector3(r,delta.length(),r),new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()));}
  for(const tree of TREES){const {x,z,scale:s,seed}=tree;const y=terrainHeight(tree),yaw=seed*2.39;
    const base=new T.Vector3(x,y,z),mid=new T.Vector3(x+Math.cos(yaw)*.33*s,y+2.2*s,z+Math.sin(yaw)*.33*s),crown=new T.Vector3(x+Math.sin(yaw)*.8*s,y+4*s,z+Math.cos(yaw)*.7*s);
    beam(base,mid,.32*s);beam(mid,crown,.23*s);
    for(let root=0;root<4;root++){const a=yaw+root*Math.PI/2;beam(new T.Vector3(x+Math.cos(a)*.85*s,y+.07,z+Math.sin(a)*.85*s),mid.clone().lerp(base,.8),.14*s);}
    for(let limb=0;limb<5;limb++){
      const a=yaw+limb*2.4,from=limb<2?mid:crown,end=from.clone().add(new T.Vector3(Math.cos(a)*(1.1+limb*.12)*s,(.6+limb*.25)*s,Math.sin(a)*(1.1+limb*.12)*s));beam(from,end,(limb<2?.14:.09)*s);
      for(let twig=0;twig<3;twig++){const angle=a+(twig-1)*.65,tip=end.clone().add(new T.Vector3(Math.cos(angle)*.8*s,(.7+twig*.23)*s,Math.sin(angle)*.8*s));beam(end,tip,.045*s);beam(tip,tip.clone().add(new T.Vector3(Math.cos(angle+.4)*.4*s,.6*s,Math.sin(angle+.4)*.4*s)),.018*s);}
    }
    for(let i=0;i<12;i++){const a=i*2.4+seed,r=.5+(i%4)*.28;add(box,moss,new T.Vector3(x+Math.cos(a)*r,y+.03,z+Math.sin(a)*r),new T.Vector3(.16,.035,.1),new T.Quaternion().setFromEuler(new T.Euler(0,a,0)));}
  }
  for(const wall of RUIN_WALLS){const along=wall.w>wall.d,length=Math.max(wall.w,wall.d);for(let j=0;j<Math.floor(length/.85);j++)for(let row=0;row<3;row++){
    if(row===2&&j%3===1)continue;const offset=-length/2+.45+j*.85+(row%2)*.18,p=new T.Vector3(wall.x+(along?offset:0),.2+row*.36,wall.z+(along?0:offset));
    add(box,stone,p,new T.Vector3(along?.82:.8,.34,along?.8:.82),new T.Quaternion().setFromEuler(new T.Euler(.025*(j%2),.02*(j%3),.03*(j%2))));
    if(row===0){add(rubble,stone,p.clone().add(new T.Vector3(.65,-.02,1)),new T.Vector3(.28,.19,.35));add(box,moss,p.clone().add(new T.Vector3(.55,-.14,.85)),new T.Vector3(.45,.035,.28));}
  }}
  const {x,z}=FOUNTAIN;
  // Eight-sided basin with staggered stone blocks and a stepped central monument.
  for(let edge=0;edge<8;edge++){const angle=edge*Math.PI/4,quat=new T.Quaternion().setFromEuler(new T.Euler(0,angle,0));
    for(let row=0;row<2;row++)for(let b=0;b<3;b++){const tangent=(b-1)*.89;add(box,stone,new T.Vector3(x+Math.sin(angle)*3.45+Math.cos(angle)*tangent,.25+row*.35,z+Math.cos(angle)*3.45-Math.sin(angle)*tangent),new T.Vector3(.87,.33,.55),quat);}
    add(box,stone,new T.Vector3(x+Math.sin(angle)*3.45,.83,z+Math.cos(angle)*3.45),new T.Vector3(2.83,.18,.73),quat);
    for(let i=0;i<3;i++)add(rubble,stone,new T.Vector3(x+Math.sin(angle+i*.08)*4.1,.15,z+Math.cos(angle+i*.08)*4.1),new T.Vector3(.25,.18,.3));
  }
  const octagon=new T.CylinderGeometry(1,1,1,8);
  for(const [y,r,h] of [[.22,1.15,.44],[.58,.87,.22],[1.35,.63,1.4],[2.1,.87,.18],[2.43,.5,.5]])add(octagon,stone,new T.Vector3(x,y,z),new T.Vector3(r,h,r));
  for(let i=0;i<8;i++){const a=i*Math.PI/4;add(box,dark,new T.Vector3(x+Math.sin(a)*.66,1.35,z+Math.cos(a)*.66),new T.Vector3(.3,.83,.12),new T.Quaternion().setFromEuler(new T.Euler(0,a,0)));add(box,cyan,new T.Vector3(x+Math.sin(a)*.69,.94,z+Math.cos(a)*.69),new T.Vector3(.045,.32,.055));}
  const waterMat=new T.MeshStandardMaterial({color:'#092b31',roughness:.2,metalness:.65,transparent:true,opacity:.91});
  const water=new T.Mesh(new T.CircleGeometry(3.45,8),waterMat);water.rotation.x=-Math.PI/2;water.position.set(x,.46,z);scene.add(water);
  const rings:T.Mesh[]=[];for(let i=0;i<3;i++){const ring=new T.Mesh(new T.RingGeometry(.8,.82,48),new T.MeshBasicMaterial({color:'#68bac4',transparent:true,opacity:.1,depthWrite:false,side:T.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.set(x,.48+i*.001,z);scene.add(ring);rings.push(ring);}
  for(const a of [.7,2.4,4.1])for(let i=0;i<4;i++){const p=new T.Vector3(x+Math.sin(a)*4.5+i*.13,.15+(i%3)*.06,z+Math.cos(a)*4.5);add(branch,wax,p,new T.Vector3(.045,.3+(i%3)*.12,.045));add(rubble,fire,p.clone().add(new T.Vector3(0,.18+(i%3)*.06,0)),new T.Vector3(.04,.09,.04));}
  batches.forEach((map,key)=>{const group=new T.Group();map.forEach(b=>{const mesh=new T.InstancedMesh(b.g,b.m,b.data.length);b.data.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));mesh.castShadow=b.m!==fire&&b.m!==cyan;mesh.receiveShadow=true;mesh.computeBoundingSphere();group.add(mesh);});scene.add(group);groups.set(key,group);});
  return {sources:[{p:new T.Vector3(x,.95,z),color:new T.Color('#79cedb'),power:9,flicker:false}],update(time:number){rings.forEach((r,i)=>{const phase=(time*.18+i/3)%1;r.scale.setScalar(1+phase*2.8);(r.material as T.MeshBasicMaterial).opacity=(1-phase)*.13;});},stream(p:Point){const cx=Math.floor(p.x/RULES.chunkSize),cz=Math.floor(p.z/RULES.chunkSize);groups.forEach((g,key)=>{const [a,b]=key.split(',').map(Number);g.visible=Math.abs(cx-a)<=RULES.activeRadius&&Math.abs(cz-b)<=RULES.activeRadius;});water.visible=Math.hypot(p.x-x,p.z-z)<48;rings.forEach(r=>r.visible=water.visible);},treeCount:TREES.length};
}
