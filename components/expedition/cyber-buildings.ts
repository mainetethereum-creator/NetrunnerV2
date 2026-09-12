import * as T from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {mergeGeometries, mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {createConcreteMaterial,prepareConcreteUv} from './cyber-concrete.ts';

export const CYBER_BUILDING_PROPS = [
  {id:'building-neon-residence',name:'Здание · NEON / жилой узел',category:'Здания',description:'7 этажей · неоновые витрины, кабельные стояки и техническая кровля · 12 × 10 м'},
  {id:'building-sector-02',name:'Здание · SECTOR 02 / технофабрика',category:'Здания',description:'Индустриальный корпус на стальном каркасе · галереи, фермы и вытяжные башни · 12 × 9 м'},
  {id:'building-directorate',name:'Здание · Директорат / администрация',category:'Здания',description:'42-метровая бруталистская башня · бетонные капсулы, глубокие рёбра и охраняемый вход'},
] as const;
export type CyberBuildingId = typeof CYBER_BUILDING_PROPS[number]['id'];
export type BuildingLightSource={x:number;y:number;z:number;color:number;power:number};

// Authored in metres. All facades are complete; the entry side faces local +Z.
// The existing photographed/generated building atlas is reused, with UVs baked
// into geometry. Only typography/graphic signage needs a tiny canvas atlas.
export function createCyberBuildingLibrary(atlas:T.Texture) {
  const prototypes = new Map<CyberBuildingId,T.Group>();
  const materials:T.MeshStandardMaterial[] = [];
  let signs:T.CanvasTexture|undefined;
  function prepare() {
    if(materials.length)return;
    materials.push(
      createConcreteMaterial(atlas),
      new T.MeshStandardMaterial({map:atlas,bumpMap:atlas,bumpScale:.01,roughness:.64,metalness:.58,vertexColors:true}),
      new T.MeshStandardMaterial({map:atlas,roughness:.28,metalness:.35,vertexColors:true}),
      new T.MeshStandardMaterial({map:atlas,emissiveMap:atlas,emissive:0xffffff,emissiveIntensity:1.65,roughness:.35,vertexColors:true}),
      new T.MeshStandardMaterial({color:0x182328,roughness:.88,vertexColors:true}),
      new T.MeshStandardMaterial({color:0xffffff,emissive:0xffffff,emissiveIntensity:2.1,roughness:.35,vertexColors:true}),
    );
    // Vertex colour multiplies emissive too, so cyan/pink windows retain colour
    // under ACES without additional materials or point lights per placement.
    for(const i of [3,5])materials[i].onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance *= vColor.rgb;\n#endif');
    };
    signs=makeSignAtlas();
    materials.push(new T.MeshStandardMaterial({map:signs,emissiveMap:signs,emissive:0xffffff,emissiveIntensity:.72,roughness:.42,vertexColors:true}));
  }
  function build(id:CyberBuildingId) {
    prepare();
    const buckets=new Map<number,T.BufferGeometry[]>();
    let local=new T.Matrix4();
    const add=(geometry:T.BufferGeometry,material:number,tile:number,color:T.ColorRepresentation,x=0,y=0,z=0,rx=0,ry=0,rz=0)=>{
      const uv=geometry.getAttribute('uv');
      const columns=material===6?4:3,rows=material===6?2:3;
      if(material===0)prepareConcreteUv(geometry,x,y,z);
      else for(let i=0;i<uv.count;i++)uv.setXY(i,(tile%columns+.012+uv.getX(i)*.976)/columns,(rows-1-Math.floor(tile/columns)+.012+uv.getY(i)*.976)/rows);
      const tint=new T.Color(color),colors=new Float32Array(geometry.getAttribute('position').count*3);
      if(material===0){
        const value=tint.r*.2126+tint.g*.7152+tint.b*.0722;
        tint.setRGB(value*.965,value,value*1.025);
      }
      for(let i=0;i<colors.length;i+=3){colors[i]=tint.r;colors[i+1]=tint.g;colors[i+2]=tint.b;}
      geometry.setAttribute('color',new T.BufferAttribute(colors,3));
      geometry.applyMatrix4(new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromEuler(new T.Euler(rx,ry,rz)),new T.Vector3(1,1,1)));
      geometry.applyMatrix4(local);
      const list=buckets.get(material)??[];list.push(geometry);buckets.set(material,list);
    };
    const box=(w:number,h:number,d:number,x:number,y:number,z:number,m=0,tile=0,tint:T.ColorRepresentation=0xb5b4ae,bevel=0)=>{
      const g=bevel?new RoundedBoxGeometry(w,h,d,1,Math.min(bevel,w/4,h/4,d/4)):new T.BoxGeometry(w,h,d);
      add(g,m,tile,tint,x,y,z);
    };
    const beam=(a:number[],b:number[],r=.045,tint:T.ColorRepresentation=0x7c8382)=>{
      const start=new T.Vector3().fromArray(a),end=new T.Vector3().fromArray(b),delta=end.clone().sub(start);
      const geometry=new T.CylinderGeometry(r,r,delta.length(),8,1);
      geometry.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()));
      const center=start.add(end).multiplyScalar(.5);add(geometry,1,3,tint,center.x,center.y,center.z);
    };
    const cylinder=(r:number,h:number,x:number,y:number,z:number,tint:T.ColorRepresentation=0x929a96,rx=0,n=12)=>add(new T.CylinderGeometry(r,r,h,n),1,4,tint,x,y,z,rx);
    const face=(x:number,z:number,angle:number,fn:()=>void)=>{
      const previous=local;local=new T.Matrix4().makeRotationY(angle);local.setPosition(x,0,z);fn();local=previous;
    };
    const neon=(w:number,h:number,x:number,y:number,z:number,color=0x4ddce8)=>box(w,h,.035,x,y,z,5,0,color);
    const sign=(w:number,h:number,x:number,y:number,z:number,tile:number)=>{
      box(w+.22,h+.22,.19,x,y,z,1,3,0x657276,.025);
      add(new T.PlaneGeometry(w,h),6,tile,0xffffff,x,y,z+.105);
    };
    const rail=(w:number,x:number,y:number,z:number)=>{
      for(const dy of [.48,1])box(w,.055,.055,x,y+dy,z,1,3,0x929c98);
      const n=Math.ceil(w/1.2);for(let i=0;i<=n;i++)box(.045,1,.045,x-w/2+w*i/n,y+.5,z,1,3,0x929c98);
    };
    const grille=(w:number,h:number,x:number,y:number,z:number)=>{
      box(w+.1,h+.1,.14,x,y,z,4,5,0xffffff);
      for(let i=0;i<Math.ceil(h/.17);i++)box(w,.065,.15,x,y-h/2+.06+i*.17,z+.09,1,4,0x9a9f98);
    };
    const window=(w:number,h:number,x:number,y:number,z:number,seed:number)=>{
      box(w+.17,h+.17,.1,x,y,z,4,5,0xffffff);
      const lit=seed%7<3;
      box(w,h,.035,x,y,z+.075,lit?3:2,lit?7:6,lit?(seed%3===0?0x8adce5:seed%3===1?0xffe3bb:0xed99d5):0x8aabaa);
      for(const dx of [-w/2,w/2])box(.055,h+.07,.15,x+dx,y,z+.09,1,3,0x73817e);
      box(w+.14,.075,.23,x,y-h/2-.055,z+.11,0,0,0x9ca39f);
      if(w>1.1)box(.045,h,.12,x,y,z+.13,1,3,0x8a9590);
      // Partial blinds and shadowed interiors break up the repeated window grid.
      if(seed%3===0)for(let i=0;i<3;i++)box(w,.09,.035,x,y+h/2-.15-i*.13,z+.11,1,4,0x90928a);
    };
    const cable=(points:number[][],radius=.07,tint:T.ColorRepresentation=0x414b4a)=>{
      const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3().fromArray(p)));
      add(new T.TubeGeometry(curve,16,radius,6,false),1,3,tint);
    };
    const duct=(points:number[][],radius=.18)=>cable(points,radius,0x949e95);
    const ladder=(x:number,z:number,y:number,h:number)=>{
      for(const dx of [-.32,.32])beam([x+dx,y,z],[x+dx,y+h,z],.03);
      for(let i=0;i<=Math.floor(h/.32);i++)beam([x-.32,y+i*.32,z],[x+.32,y+i*.32,z],.025);
      for(let dy=0;dy<h;dy+=2)for(const dx of [-.32,.32])beam([x+dx,y+dy,z],[x+dx,y+dy,z-.35],.025);
    };
    const hvac=(x:number,y:number,z:number,scale=1)=>{
      box(1.45*scale,.8*scale,1.1*scale,x,y+.4*scale,z,1,4,0xaeb5a9,.045);
      cylinder(.43*scale,.09*scale,x,y+.85*scale,z,0x4b5958,0,16);
      add(new T.TorusGeometry(.36*scale,.035*scale,4,16),1,4,0x9ba49c,x,y+.9*scale,z,Math.PI/2);
      for(let j=0;j<4;j++){const a=j*Math.PI/2;beam([x,y+.9*scale,z],[x+Math.cos(a)*.32*scale,y+.9*scale,z+Math.sin(a)*.32*scale],.05*scale);}
      grille(1.17*scale,.47*scale,x,y+.39*scale,z+.57*scale);
    };
    const roof=(w:number,d:number,y:number,x=0,z=0)=>{
      box(w+.2,.22,d+.2,x,y,z,0,0,0xc0c1b5,.035);
      box(w-.3,.055,d-.3,x,y+.14,z,1,5,0x88948b);
      for(const s of [-1,1]){
        box(w,.25,.2,x,y+.27,z+s*d/2,0,0,0xb4b8b0);
        box(.2,.25,d,x+s*w/2,y+.27,z,0,0,0xb4b8b0);
        face(x,z+s*d/2,s<0?Math.PI:0,()=>rail(w,0,y+.38,0));
        face(x+s*w/2,z,s*Math.PI/2,()=>rail(d,0,y+.38,0));
      }
    };
    const entry=(x:number,z:number,w=2.3)=>{
      box(w+1.1,3.2,.28,x,1.65,z,4,5,0xffffff);
      window(w,2.65,x,1.65,z+.16,0);
      for(const dx of [-w/2-.34,w/2+.34])box(.3,3.5,.75,x+dx,1.83,z+.3,0,0,0xacae9f,.035);
      box(w+1.5,.25,1.4,x,3.55,z+.48,1,3,0x747f78,.025);
      neon(w+.7,.045,x,3.39,z+1.04);
      for(let i=0;i<3;i++)box(w+1.2,.13,1.25-i*.3,x,.065+i*.13,z+.4-i*.15,0,0,0xadb3a8);
      box(.2,.65,.16,x+w/2+.65,1.5,z+.42,1,3,0x616f69);
      neon(.13,.2,x+w/2+.65,1.62,z+.51);
    };

    if(id==='building-neon-residence'){
      box(12,.16,10,0,.08,0,0,0,0x8d9791,.03);
      // Continuous dark backing makes the deeply recessed glazing read as voids.
      box(9.6,21.2,7.9,0,10.75,0,4,5,0xffffff);
      for(const s of [-1,1])face(0,s*4.05,s<0?Math.PI:0,()=>{
        for(let f=0;f<7;f++){
          const y=.2+f*3;
          box(10.1,.42,.72,0,y+.21,.16,0,0,f%2?0xb8bbb0:0xa8b0a8,.025);
          box(9.8,.75,.31,0,y+2.6,.07,0,0,0xaeb4aa);
          for(let c=0;c<5;c++)window(1.64,1.63,-3.9+c*1.95,y+1.4,.15,f*13+c+(s+1)*2);
          if(f===2||f===4||f===6){box(10.55,.17,.92,0,y+.15,.49,0,0,0x9ca89f);rail(10.35,0,y+.25,.9);}
        }
        for(const x of [-4.95,-.08,4.95])box(.18,21.5,.48,x,10.88,.22,0,0,0x899a91);
        for(const x of [-4.1,3.95]){
          duct([[x,.2,.7],[x,4.2,.7],[x+.35,4.8,.7],[x+.35,20.8,.7],[x,22,0],[x,22,-2]],.13);
          for(let y=1;y<21;y+=2.8)box(.48,.1,.38,x+.35,y,.69,1,3,0x8f9586);
        }
        if(s>0){sign(5.45,1.12,-1.6,3.65,1.06,0);entry(1.7,.26,2.4);sign(1.25,3.1,-4.5,5.5,1.16,2);}
        else{grille(2.8,1.2,-2.2,1.3,.4);entry(2,.2,1.8);}
      });
      for(const s of [-1,1])face(s*4.86,0,s*Math.PI/2,()=>{
        for(let f=0;f<7;f++){
          const y=.2+f*3;box(8.2,.42,.65,0,y+.21,.13,0,0,0xa5b0a8);
          for(let c=0;c<4;c++)window(1.42,1.7,-2.94+c*1.96,y+1.39,.1,f*11+c+4);
          box(8.15,.68,.3,0,y+2.58,.09,0,0,0xa5afa6);
        }
        sign(3.65,6.7,-.9,12.1,.51,3);
        for(const x of [2.45,2.72,3.02])cable([[x,.25,.8],[x,8,.85],[x+.15,12,.75],[x+.15,21.7,.75],[x-1.4,22,-1.5]],.065);
        ladder(-3.55,.85,3.25,18.9);
        for(const y of [5.2,8.2,17.2]){box(1.25,.7,.62,2.6,y,.49,1,4,0xa1aa9e,.025);grille(1.06,.48,2.6,y,.83);}
      });
      roof(10.1,8.3,21.45);
      box(4.1,2.5,3,1.4,22.85,-1.7,0,0,0x9ca79f,.055);roof(4.15,3.05,24.12,1.4,-1.7);
      for(const x of [-3,-1.25,.5])hvac(x,21.63,1.4);
      hvac(-2.7,21.65,-1.65,1.3);
      for(const x of [-3.3,-3.08,-2.84])cable([[x,21.7,1],[x+.3,21.7,-.4],[x+.1,21.7,-2],[x+3.3,21.7,-2]],.065);
      sign(7.3,1.8,-.4,23.1,3.93,1);
      for(const x of [-3.5,2.4])beam([x,21.7,3.8],[x,23.95,3.8],.07);
      for(let i=0;i<4;i++){const x=.3+i*.42;beam([x,24.25,-2.4],[x,26.1+(i%3)*.47,-2.4],.025);}
      for(const x of [-4.5,4.5]){hvac(x,.2,3.2,.65);box(.85,.45,1.05,x,.42,-3.55,0,0,0x747e6d);}
    }

    if(id==='building-sector-02'){
      box(12,.16,9,0,.08,0,0,0,0x979f94,.03);
      // Side service spine and rear wall close the collision footprint; open
      // gallery detailing is a facade recess, not a fake traversable doorway.
      box(1.85,13.8,7.4,-4.85,7,0,0,1,0xb2b9ac,.04);
      box(8.6,5.5,5.1,.55,2.85,-1.15,4,5,0xffffff);
      box(10.6,7.5,7.4,.1,9.52,0,0,1,0xbfc2b5,.055);
      for(const s of [-1,1])face(0,s*3.77,s<0?Math.PI:0,()=>{
        for(const x of [-5.4,-3.5,0,3.5,5.4]){
          box(.2,13.2,.27,x,6.8,.08,1,3,0x65736e);
          if(Math.abs(x)<5)for(const y of [1,3.4])beam([x-1.4,y,.16],[x+1.4,y+1.6,.16],.055);
        }
        for(const y of [.48,2.7,5.1,5.6,10.7,13.35])box(10.95,.22,.45,0,y,.12,1,3,0x77837c);
        for(const y of [.64,2.85]){box(9.1,.12,1.05,.7,y,.47,1,4,0x818d82);rail(8.6,.7,y+.08,.94);}
        for(let c=0;c<6;c++)window(1.34,1.45,-3.35+c*1.64,11.65,.19,7+c);
        // Tall pale panel and generous negative space are the reference's main signature.
        for(let i=0;i<4;i++)box(2.57,4.7,.14,-3.9+i*2.64,8.17,.12,0,1,i%2?0xbfc4b5:0xb4c0b2);
        sign(2.45,2.4,3.5,7.73,.31,4);
        box(10.5,.1,.055,0,6.0,.24,1,4,0x487877);
        if(s>0){entry(-4.75,.2,1.2);grille(3.5,1.3,.7,1.7,-1.12);sign(2.4,.52,-.9,5.22,.43,5);}
      });
      for(const s of [-1,1])face(s*5.5,0,s*Math.PI/2,()=>{
        for(const x of [-3.65,0,3.65])box(.16,13.5,.22,x,6.9,.12,1,3,0x718079);
        for(const y of [2.9,5.5,10.7,13.35])box(7.5,.18,.32,0,y,.15,1,3,0x7e8980);
        for(const y of [1.2,3.65])for(const x of [-1.85,1.85]){beam([x-1.5,y,.15],[x+1.5,y+1.5,.15],.065);}
        window(5.7,1.45,0,11.65,.2,8);grille(2.5,1.4,0,7.8,.23);
      });
      roof(11.1,7.7,13.5);
      box(6.3,1.65,4.3,-.9,14.52,-.2,1,4,0xb6bbaa,.035);
      for(const x of [-3.8,-2.3,-.8,.7,2.2]){box(.12,1.8,.16,x,14.6,2.05,1,3,0x636f66);}
      for(const y of [13.78,14.57,15.37])box(6.45,.14,.17,-.8,y,2.09,1,3,0x68766c);
      for(const x of [-2.5,-.5,1.5])hvac(x,15.42,-.2,.85);
      for(const [x,z,r,h] of [[3.75,-1.7,.55,5.2],[-3.8,-1.2,.36,2.9]]){
        cylinder(r,h,x,13.62+h/2,z,0xc8c7ad,0,16);
        for(let dy=.2;dy<h;dy+=1.1)cylinder(r+.07,.1,x,13.62+dy,z,0x9fa998,0,16);
        cylinder(r+.16,.15,x,13.65+h,z,0x637567,0,16);
        for(const dx of [-.9,.9])beam([x+dx,13.6,z],[x+dx,16.3,z],.06);
        beam([x-.9,16.3,z],[x+.9,16.3,z],.065);
      }
      duct([[-3.6,14.3,2],[-3.6,16,2],[-1.5,16,2],[-1.5,15.5,.5]],.16);
      face(-5.65,0,-Math.PI/2,()=>ladder(-2,.5,.2,14.4));
      for(const x of [1.1,1.4,1.7])cable([[x,.4,3.5],[x,3.8,3.5],[x-1.1,5.7,3.7]],.05);
    }

    if(id==='building-directorate'){
      box(13.6,.18,10.8,0,.09,0,0,0,0x93988d,.04);
      box(10,38,7.3,0,19.25,0,4,5,0xffffff);
      box(8.2,3.5,6.2,0,39.1,-.45,0,0,0xa6a999,.055);
      for(const s of [-1,1])face(0,s*3.76,s<0?Math.PI:0,()=>{
        // Four long frame bays with inset glazing and individual sloped eyebrows.
        for(let c=0;c<4;c++){
          const x=-3.6+c*2.4;
          box(1.82,29,.16,x,23,.07,1,3,0x6f7568);
          for(let f=0;f<10;f++){
            const y=9.5+f*2.86;
            window(1.37,1.53,x,y,.2,11+f*7+c);
            box(1.75,.5,.55,x,y-1.03,.38,0,0,0x939785);
            add(new T.BoxGeometry(1.75,.14,.8),0,0,0xa2a28e,x,y+.93,.43,-.3);
          }
          for(const dx of [-1.02,1.02])box(.15,32,.7,x+dx,24,.37,0,0,0xa6a58f,.015);
        }
        for(const x of [-5.03,5.03]){
          box(.42,40.3,.95,x,20.38,.27,0,0,0xafad96,.025);
          box(.1,39.6,.1,x-.15,20.35,.82,1,3,0x7b8378);
        }
        for(const x of [-3.1,3.1]){
          box(2.4,6,1.2,x,3.2,.4,0,0,0xa3a38e,.055);
          box(1.55,2.6,.2,x,7.45,.15,4,5,0xffffff);
          grille(1.25,1.35,x,7.55,.33);
          add(new T.BoxGeometry(2.45,.25,1.5),0,0,0xb1ae94,x,6.25,.54,-.4);
          box(.12,5.7,.075,x,3.2,1.02,1,3,0x717b73);
        }
        entry(0,.4,2.65);sign(3.4,.55,0,4.14,1.19,6);
        for(const x of [-4.3,4.3])neon(.055,1.9,x,2.3,1.02,0xffab57);
      });
      for(const s of [-1,1])face(s*5.2,0,s*Math.PI/2,()=>{
        box(1.8,39.5,.4,0,20,.14,1,3,0x69766e);
        for(const x of [-2.9,-2.5,2.5,2.9])box(.18,40.2,.95,x,20.3,.47,0,0,0xa7a78f,.02);
        for(let f=0;f<12;f++)window(1.1,1.8,0,3.1+f*3,.38,20+f);
        for(let f=0;f<4;f++){
          const y=7.5+f*8.5;
          // Cantilevered blind concrete capsules alternate with open steel throats.
          box(5.8,5.1,1.13,0,y,.72,0,0,f%2?0xa7a692:0xaaa995,.055);
          for(const x of [-2.7,2.7])box(.14,5.15,1.25,x,y,.74,1,3,0x6e796f);
          box(5.85,.19,1.22,0,y-2.5,.75,0,0,0x929b89);
          box(4.4,1.55,.82,0,y+3.32,.62,0,1,0xa1977f,.04);
          grille(3.65,.87,0,y+3.32,1.1);
          for(const x of [-1.9,1.9])box(.18,1.55,.3,x,y+3.32,1.16,1,3,0x798478);
          box(.035,4.8,.026,0,y,1.303,1,3,0x808777);
        }
        for(const x of [-3.55,3.55])box(.22,41.2,.46,x,20.8,.11,0,0,0xb0af97,.025);
        sign(1.4,2.2,0,2.05,.7,7);
      });
      roof(8.25,6.25,40.85,0,-.45);
      for(const x of [-2.8,2.8])hvac(x,41.05,-.4,.85);
      for(const x of [-5.6,5.6])for(const z of [-3.3,3.3])box(.9,6.7,1.3,x,3.55,z,0,0,0xa5a791,.055);
      for(const x of [-1,1])beam([x,41,-1.5],[x,42.55,-1.5],.035);
    }
    const root=new T.Group();
    root.name=CYBER_BUILDING_PROPS.find(p=>p.id===id)!.name;
    root.userData.units='metres';root.userData.referencePlayerHeight=1.85;
    root.userData.front='+Z';root.userData.cyberBuilding=true;
    // Authored district feeds these into the existing nearest-light pool; no
    // per-building lights, animation loops, or extra shadow maps are allocated.
    root.userData.lightSources=id==='building-neon-residence'
      ?[{x:-2,y:3.1,z:5.5,color:0xe278d4,power:11},{x:1.7,y:2.8,z:5.6,color:0x4edee7,power:9}]
      :id==='building-sector-02'?[{x:-4.75,y:2.8,z:5.1,color:0x73d8d9,power:7}]
      :[{x:0,y:3.4,z:5.3,color:0xffbb72,power:11}];
    for(const [material,parts] of buckets){
      const flat=parts.map(g=>g.index?g.toNonIndexed():g),merged=mergeGeometries(flat)!;
      const geometry=mergeVertices(merged);merged.dispose();
      flat.forEach((g,i)=>{if(g!==parts[i])g.dispose();});parts.forEach(g=>g.dispose());
      geometry.computeBoundingBox();geometry.computeBoundingSphere();
      const mesh=new T.Mesh(geometry,materials[material]);mesh.castShadow=material!==5&&material!==6;mesh.receiveShadow=material!==5;
      root.add(mesh);
    }
    return root;
  }
  return {
    create(id:CyberBuildingId){let root=prototypes.get(id);if(!root){root=build(id);prototypes.set(id,root);}return root.clone(true);},
    dispose(){prototypes.forEach(root=>root.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();}));materials.forEach(m=>m.dispose());signs?.dispose();prototypes.clear();},
  };
}

function makeSignAtlas(){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
  const ctx=canvas.getContext('2d')!;
  const labels=[['夜市 / NIGHT MARKET','24H • SERVICE • REPAIRS','#63edf1'],['NEON DISTRICT','LIVE ABOVE THE STATIC','#ef95e0'],['宿 / HOTEL','ROOMS 24H','#ef82d0'],['ALTER / 身体','A NEW YOU. EVERY DAY.','#be8dff'],['02','SECTOR / INDUSTRIAL','#74a5a0'],['RESTRICTED ACCESS','AUTHORIZED PERSONNEL','#e1c58b'],['DIRECTORATE','CIVIC CONTROL / 09','#d3c6a3'],['09','ADMINISTRATION','#b4c4b9']];
  for(let i=0;i<8;i++){
    const x=(i%4)*256,y=Math.floor(i/4)*256,[title,subtitle,color]=labels[i];
    ctx.save();ctx.translate(x,y);ctx.fillStyle=i===4?'#c5c8b8':'#101d25';ctx.fillRect(0,0,256,256);
    ctx.strokeStyle=color;ctx.lineWidth=2;ctx.strokeRect(9,9,238,238);
    ctx.globalAlpha=.16;ctx.strokeStyle=color;
    for(let n=0;n<12;n++){ctx.beginPath();ctx.moveTo(12,14+n*21);ctx.lineTo(244,14+n*21);ctx.stroke();}
    ctx.globalAlpha=1;ctx.fillStyle=color;ctx.textAlign='center';
    if(i===3){
      // Graphic silhouette and scan rings: readable at distance, no external font.
      ctx.strokeStyle=color;for(let j=0;j<3;j++){ctx.beginPath();ctx.ellipse(128,110,48+j*16,69+j*8,0,0,Math.PI*2);ctx.stroke();}
      ctx.fillStyle='#865ab1';ctx.beginPath();ctx.ellipse(128,83,23,32,0,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.moveTo(99,113);ctx.lineTo(157,113);ctx.lineTo(181,188);ctx.lineTo(75,188);ctx.closePath();ctx.fill();ctx.fillStyle=color;
      ctx.font='bold 19px sans-serif';ctx.fillText(title,128,217,228);ctx.font='9px monospace';ctx.fillText(subtitle,128,233,224);
    }else{
      ctx.font=`bold ${i===4||i===7?150:i===2?37:27}px sans-serif`;ctx.fillText(title,128,i===4||i===7?185:128,225);
      ctx.font='12px monospace';ctx.fillText(subtitle,128,216,224);
      ctx.fillRect(22,157,212,3);ctx.font='10px monospace';ctx.fillText('CYBERBASE  /  NETWORK 2089',128,39,220);
    }
    ctx.fillStyle=color;for(let j=0;j<18;j++)ctx.fillRect(23+j*3,232,1+j%2,9);
    ctx.restore();
  }
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;
  return texture;
}
