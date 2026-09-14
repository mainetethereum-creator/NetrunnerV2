import * as T from 'three';
import {createGrass} from './grass-system/grass';
import {noiseGLSL} from './grass-system/noise';

import {landscapeDefaults,landscapeWeight,sanitizeLandscape,type LandscapePatch,type LandscapeState} from './landscape-state';
import {createThrottledScheduler} from './frame-throttle';
import type {Point} from './config';

const KEY='netrunner.landscape.v1';
type GrassRuntime=ReturnType<typeof createGrass>;
type GrassField={grass:GrassRuntime;baseHeights:Float32Array;clearances:Float32Array;wind:T.IUniform<number>;patchId:string;quadrant:number};

export function createLandscapeStudio(scene:T.Scene,ground:T.Mesh<T.PlaneGeometry,T.MeshStandardMaterial>,state:LandscapeState,terrainHeight:(p:Point,clearance?:number)=>number){
  let landscapePatches=state.patches;
  const landscapeClearance=state.clearance;
  const replaceLandscape=(patches:LandscapePatch[])=>{state.replace(patches);landscapePatches=state.patches;};

  const time={value:0},sun=new T.Object3D();sun.position.set(-16,32,12);
  const fields=new Map<string,GrassField>();let selected=landscapePatches[0].id,active=false,listener=()=>{},pendingStyle=false,pendingShape=false;
  const pendingPositions=new Set<string>();
  let outline:T.LineLoop<T.BufferGeometry,T.LineBasicMaterial>|undefined;
  const cameraPosition=new T.Vector3();let quality=1,authoringLoaded=false;
  function ensureOutline(){if(!outline){outline=new T.LineLoop(new T.BufferGeometry(),new T.LineBasicMaterial({color:'#e7d38a',depthTest:false}));outline.renderOrder=10;outline.visible=false;scene.add(outline);}return outline;}
  const soil=ground.material,baseCompile=soil.onBeforeCompile;soil.vertexColors=true;soil.color.set('#ffffff');
  soil.onBeforeCompile=(shader,renderer)=>{baseCompile.call(soil,shader,renderer);shader.vertexShader=`attribute vec3 soilParams;varying vec3 vSoilParams;varying vec2 soilXZ;\n${shader.vertexShader}`.replace('#include <begin_vertex>','#include <begin_vertex>\n vSoilParams=soilParams;soilXZ=position.xz;');shader.fragmentShader=`varying vec3 vSoilParams;varying vec2 soilXZ;\n${noiseGLSL}\n${shader.fragmentShader}`.replace('#include <color_fragment>',`#include <color_fragment>
    float soilDistance=distance(cameraPosition.xz,soilXZ);
    float detail=1.-smoothstep(22.,42.,soilDistance);
    float tone=.5;float wet=vSoilParams.y*.35;float moss=vSoilParams.x*.35;float cracks=0.;
    if(detail>0.01){
    tone=fbm(soilXZ*.23)*.5+.5;
    wet=smoothstep(.55-vSoilParams.y,.8-vSoilParams.y,fbm(soilXZ*.32+8.1)*.5+.5)*vSoilParams.y;
    moss=smoothstep(.62-vSoilParams.x,.9-vSoilParams.x,fbm(soilXZ*.45+31.7)*.5+.5)*vSoilParams.x;
    vec2 warp=vec2(fbm(soilXZ*.5+3.1),fbm(soilXZ*.5+7.7))*.65;
    vec2 cell=worleyF1F2(soilXZ*1.3+warp);vec2 fineCell=worleyF1F2((soilXZ*1.3+warp)*2.7+13.);
    cracks=max(1.-smoothstep(0.,.085,cell.y-cell.x),(1.-smoothstep(0.,.136,fineCell.y-fineCell.x))*.5)*vSoilParams.z;
    cracks*=detail;
    }
    diffuseColor.rgb*=.65+tone*.7;
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.18,.24,.075),moss);
    diffuseColor.rgb*=1.-wet*.45;diffuseColor.rgb*=1.-cracks*.7;
  `).replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\n roughnessFactor=mix(.96,.28,wet);').replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\n normal=normalize(normal+vec3(dFdx(cracks),dFdy(cracks),0.)*.7);');};
  soil.customProgramCacheKey=()=> 'grass-system-soil-distance-v3';soil.needsUpdate=true;

  const positions=ground.geometry.getAttribute('position') as T.BufferAttribute;
  const groundXZ=new Float32Array(positions.count*2),groundClearances=new Float32Array(positions.count);
  for(let i=0;i<positions.count;i++){const x=positions.getX(i),z=positions.getZ(i);groundXZ[i*2]=x;groundXZ[i*2+1]=z;groundClearances[i]=landscapeClearance({x,z});}
  const colors=new T.BufferAttribute(new Float32Array(positions.count*3),3),soilParams=new T.BufferAttribute(new Float32Array(positions.count*3),3);
  ground.geometry.setAttribute('color',colors);ground.geometry.setAttribute('soilParams',soilParams);

  function mark(){if(!active){if(outline)outline.visible=false;return;}const line=ensureOutline();const p=landscapePatches.find(item=>item.id===selected);line.visible=active&&!!p;if(!p)return;const vertices=[];for(let i=0;i<96;i++){const a=i/96*Math.PI*2,x=p.x+Math.cos(a)*p.radius,z=p.z+Math.sin(a)*p.radius;vertices.push(x,terrainHeight({x,z})+.08,z);}line.geometry.dispose();line.geometry=new T.BufferGeometry();line.geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));}
  function updateGroundStyle(){const base=new T.Color('#514938'),palette=landscapePatches.map(p=>new T.Color(p.soil));for(let i=0;i<positions.count;i++){const point={x:groundXZ[i*2],z:groundXZ[i*2+1]},clearance=groundClearances[i];let r=base.r,g=base.g,b=base.b,moss=0,wet=0,cracks=.25;for(let j=0;j<landscapePatches.length;j++){const patch=landscapePatches[j],w=landscapeWeight(point,patch,clearance),c=palette[j];r+=(c.r-r)*w;g+=(c.g-g)*w;b+=(c.b-b)*w;moss+=(patch.moss-moss)*w;wet+=(patch.moisture-wet)*w;cracks+=(patch.cracks-cracks)*w;}colors.setXYZ(i,r,g,b);soilParams.setXYZ(i,moss,wet,cracks);}colors.needsUpdate=true;soilParams.needsUpdate=true;}
  function updateGroundShape(){for(let i=0;i<positions.count;i++){const point={x:groundXZ[i*2],z:groundXZ[i*2+1]};positions.setY(i,terrainHeight(point,groundClearances[i])-.055);}positions.needsUpdate=true;ground.geometry.computeVertexNormals();ground.geometry.computeBoundingSphere();}
  function applyFieldLook(field:GrassField,p:LandscapePatch){field.grass.uniforms.uHeight.value=p.height;field.grass.uniforms.uCurl.value=p.curl;field.grass.uniforms.uCoverage.value=.8;field.grass.uniforms.uMaskSeed.value.set(p.seed*.31,p.seed*.17);field.wind.value=p.wind;field.grass.setDensity(p.density);}
  function updateFieldGround(field:GrassField){const coords=field.grass.mesh.geometry.getAttribute('iPos') as T.BufferAttribute,heights=field.grass.mesh.geometry.getAttribute('iGround') as T.BufferAttribute;for(let i=0;i<field.grass.maxCount;i++){const point={x:coords.getX(i),z:coords.getY(i)};heights.setX(i,terrainHeight(point,field.clearances[i])-.045);}heights.needsUpdate=true;}
  function positionField(field:GrassField,p:LandscapePatch){const geometry=field.grass.mesh.geometry,coords=geometry.getAttribute('iPos') as T.BufferAttribute,bladeHeight=geometry.getAttribute('iHeight') as T.BufferAttribute;let heights=geometry.getAttribute('iGround') as T.BufferAttribute|undefined;if(!heights){heights=new T.InstancedBufferAttribute(new Float32Array(field.grass.maxCount),1);geometry.setAttribute('iGround',heights);}let state=(731+Math.floor(p.seed*1000)+field.quadrant*1709)>>>0;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};for(let i=0;i<field.grass.maxCount;i++){const a=(field.quadrant+random())*Math.PI/2,r=Math.sqrt(random())*p.radius,point={x:p.x+Math.cos(a)*r,z:p.z+Math.sin(a)*r},clearance=landscapeClearance(point);coords.setXY(i,point.x,point.z);field.clearances[i]=clearance;bladeHeight.setX(i,random()<=landscapeWeight(point,p,clearance)?field.baseHeights[i]:0);heights.setX(i,terrainHeight(point,clearance)-.045);}coords.needsUpdate=true;bladeHeight.needsUpdate=true;heights.needsUpdate=true;field.grass.mesh.geometry.boundingSphere=new T.Sphere(new T.Vector3(p.x+Math.cos((field.quadrant+.5)*Math.PI/2)*p.radius*.5,0,p.z+Math.sin((field.quadrant+.5)*Math.PI/2)*p.radius*.5),p.radius*.85+3);}
  function createField(p:LandscapePatch,quadrant:number){const maxCount=750,wind={value:p.wind};const grass=createGrass({sharedUniforms:{uTime:time},soilUniforms:{},mossUniforms:{},windUniforms:{uWindDir:{value:new T.Vector2(.8,.6)},uWindStrength:wind,uWindSpeed:{value:1.8},uWindScale:{value:.7},uGust:{value:.6}},noiseGLSL,heightGLSL:'',sunLight:sun,maxCount,area:p.radius*2,segments:4});const blades=grass.mesh.geometry.getAttribute('iHeight') as T.BufferAttribute,baseHeights=new Float32Array(maxCount);for(let i=0;i<maxCount;i++)baseHeights[i]=blades.getX(i);const field={grass,baseHeights,clearances:new Float32Array(maxCount),wind,patchId:p.id,quadrant};grass.uniforms.uColorBase.value.set('#29381a');grass.uniforms.uColorTip.value.set('#819047');grass.mesh.name=`Landscape grass ${p.name}`;applyFieldLook(field,p);positionField(field,p);scene.add(grass.mesh);fields.set(`${p.id}:${quadrant}`,field);}
  function disposeFields(){for(const field of fields.values()){scene.remove(field.grass.mesh);field.grass.mesh.geometry.dispose();field.grass.material.dispose();}fields.clear();}
  function rebuildAll(){updateGroundShape();updateGroundStyle();disposeFields();for(const p of landscapePatches)for(let quadrant=0;quadrant<4;quadrant++)createField(p,quadrant);mark();listener();}
  function flush(){const positionIds=[...pendingPositions];pendingPositions.clear();if(pendingShape)updateGroundShape();for(const id of positionIds){const patch=landscapePatches.find(p=>p.id===id);if(patch)for(const field of fields.values())if(field.patchId===id)positionField(field,patch);}if(pendingShape)for(const field of fields.values())if(!positionIds.includes(field.patchId))updateFieldGround(field);if(pendingStyle)updateGroundStyle();pendingShape=false;pendingStyle=false;mark();}
  // updateGroundShape/updateGroundStyle walk every ground vertex through FBM
  // noise (~66k vertices x patches x octaves). A slider drag fires an input
  // event roughly once per animation frame, so gate the actual recompute to
  // ~11 Hz instead of running it on every frame — the same budget already
  // used for streaming/shadow refresh elsewhere in this scene. The final
  // dragged value still always lands: schedule() re-arms until the limiter
  // allows a flush, and flush() always reads the latest pending state.
  const scheduler=createThrottledScheduler(flush,90);
  function schedule(){scheduler.schedule();}
  rebuildAll();
  return {get patches(){return landscapePatches;},get selected(){return selected;},subscribe(fn:()=>void){listener=fn;return()=>{listener=()=>{};};},setActive(v:boolean){active=v;if(v&&!authoringLoaded){authoringLoaded=true;try{const saved=localStorage.getItem(KEY);if(saved){replaceLandscape(sanitizeLandscape(JSON.parse(saved)));selected=landscapePatches[0].id;rebuildAll();}}catch{/* Keep authored defaults if an editor draft is invalid. */}}mark();},select(id:string){selected=id;mark();listener();},click(p:Point){const match=landscapePatches.find(a=>Math.hypot(a.x-p.x,a.z-p.z)<a.radius);if(match){selected=match.id;mark();listener();}},change(id:string,values:Partial<LandscapePatch>){replaceLandscape(landscapePatches.map(p=>p.id===id?{...p,...values}:p));const patch=landscapePatches.find(p=>p.id===id),keys=Object.keys(values);if(!patch)return;const matchingFields=[...fields.values()].filter(field=>field.patchId===id);if(keys.some(k=>['density','height','curl','wind','seed'].includes(k)))for(const field of matchingFields)applyFieldLook(field,patch);if(keys.some(k=>['soil','moss','moisture','cracks','x','z','radius'].includes(k)))pendingStyle=true;if(keys.some(k=>['x','z','radius','seed'].includes(k))){pendingPositions.add(id);pendingShape=true;}if(keys.some(k=>['mound','scale','relief'].includes(k)))pendingShape=true;mark();listener();if(pendingStyle||pendingShape||pendingPositions.size)schedule();},save(){try{localStorage.setItem(KEY,JSON.stringify(landscapePatches));return 'Черновик сохранён · загрузится при следующем открытии MASTER → Ландшафт';}catch{return 'Не удалось сохранить: хранилище браузера недоступно';}},load(){try{const saved=localStorage.getItem(KEY);if(!saved)return 'В этом браузере нет сохранения';replaceLandscape(sanitizeLandscape(JSON.parse(saved)));selected=landscapePatches[0].id;rebuildAll();return 'Загружено из этого браузера';}catch{return 'Не удалось прочитать сохранение';}},reset(){replaceLandscape(landscapeDefaults());selected=landscapePatches[0].id;rebuildAll();},refreshPads(){for(let i=0;i<positions.count;i++)groundClearances[i]=landscapeClearance({x:groundXZ[i*2],z:groundXZ[i*2+1]});rebuildAll();},setQuality(value:number){quality=value;},update(t:number,p:Point,camera?:T.Vector3){time.value=t;if(camera)cameraPosition.copy(camera);else cameraPosition.set(p.x,18,p.z+18);for(const field of fields.values()){const patch=landscapePatches.find(item=>item.id===field.patchId);if(!patch)continue;const center=field.grass.mesh.geometry.boundingSphere!.center,distance=Math.hypot(p.x-center.x,p.z-center.z);field.grass.mesh.visible=distance<(quality<.7?36:48)+patch.radius*.5;if(!field.grass.mesh.visible)continue;const lod=1-.35*T.MathUtils.smoothstep(distance,16,28)-.35*T.MathUtils.smoothstep(distance,28,42);const distantQuality=T.MathUtils.lerp(1,quality,T.MathUtils.smoothstep(distance,16,32));field.grass.setDensity(patch.density*lod*distantQuality);field.grass.update(cameraPosition);}},dispose(){scheduler.cancel();disposeFields();if(outline){scene.remove(outline);outline.geometry.dispose();outline.material.dispose();}}};
}
export type LandscapeStudio=ReturnType<typeof createLandscapeStudio>;
