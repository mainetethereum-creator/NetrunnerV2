import type {EditorState} from './prop-editor';
import {createLazyEditor} from '../world-editor/lazy-editor';
import * as T from 'three';
import { createGltfLoader } from '../../src/renderer/three/gltf-loader';
import { disposeObjectTree } from '../../src/renderer/three/dispose';
import { ASSET_URLS } from '../../src/assets/registry';
import { createFrameLoop, type FrameTick } from '../../src/core/loop/frame-loop';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { PoseController } from '../game/pose-controller';
import { CombatDriver } from '../game/combat-driver';
import { buildEnvironment } from './environment';
import { findRoute, move, makeWorld, DEFAULT_VEGETATION_TREES, type Point } from './world';
import { ExpeditionSession } from './session';
import { POIS, EXTRACTIONS, EXPEDITION_ENEMIES_ENABLED, RULES, sectorAt } from './config';
import {adaptMobileBudget,initialMobileBudget,mobileRenderRatio,usesTouchProfile} from './mobile-performance';

export type Snapshot=Point & {room:string;fps:number;draws:number;near:string|null;ready:boolean;hp:number;bag:ExpeditionSession['bag'];status:ExpeditionSession['status'];message:string;discovered:string[];activeNPC:number;chunks:number;extraction:number;kills:number;performance:{ratio:number;scale:number;target:number;frameMs:number;triangles:number;textures:number;geometries:number;detailCulled:number}};
export function createExpedition(host:HTMLElement,onState:(s:Snapshot)=>void,onError:(s:string)=>void,onEditor:(s:EditorState)=>void=()=>{},onTreeEditor:(s:EditorState)=>void=()=>{}) {
  const session=new ExpeditionSession(Math.random,EXPEDITION_ENEMIES_ENABLED); let debug=false,autoFire=false,landscapeMode=false,treeMode=false,masterActive=false;
  const world=makeWorld(),elevationAt=world.elevationAt,scene=new T.Scene();scene.background=new T.Color('#111b2b');scene.fog=new T.FogExp2('#192738',.014);
  scene.matrixAutoUpdate=false;
  // Choose the renderer path once. any-pointer covers mouse + touchscreen
  // hybrids; the same phone fallback is used by the CSS controls.
  const mobile=usesTouchProfile({pointerCoarse:matchMedia('(pointer:coarse)').matches,anyPointerCoarse:matchMedia('(any-pointer:coarse)').matches,hoverNone:matchMedia('(hover:none)').matches,width:window.innerWidth,height:window.innerHeight}),reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
  const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.VSMShadowMap;renderer.shadowMap.autoUpdate=false;
  renderer.info.autoReset=false;
  renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','Expedition. Click to move, WASD to walk, Space to fire, E to interact.');host.appendChild(renderer.domElement);
  const camera=new T.PerspectiveCamera(38,1,.15,130);
  const composer=mobile?undefined:new EffectComposer(renderer,new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,samples:Math.min(4,renderer.capabilities.maxSamples)}));
  composer?.addPass(new RenderPass(scene,camera));
  const bloom=mobile?undefined:new UnrealBloomPass(new T.Vector2(800,600),.24,.6,1.1);if(bloom)composer?.addPass(bloom);
  const output=mobile?undefined:new OutputPass();if(output)composer?.addPass(output);
  const anisotropy=Math.min(mobile?4:8,renderer.capabilities.getMaxAnisotropy());
  const env=buildEnvironment(scene,world,1,anisotropy);
  // The normal gameplay path never creates the authoring library, drafts, ghosts or outline.
  const editor=createLazyEditor(()=>import('./prop-editor').then(({createPropEditor})=>()=>createPropEditor(scene,onEditor,renderer.capabilities.getMaxAnisotropy(),elevationAt,pads=>{world.landscape.setEditorPads(pads);env.landscape.studio.refreshPads();},colliders=>world.setEditorColliders(colliders),env.editable,colliders=>world.setAuthoredColliders(colliders),(x,z)=>{pivot.x=T.MathUtils.clamp(pivot.x+x,0,144);pivot.z=T.MathUtils.clamp(pivot.z+z,0,72);},(x,z)=>{pivot.x=x;pivot.z=z;})),()=>onError('Не удалось загрузить MASTER. Повторите попытку.'),value=>env.landscape.studio.setActive(value&&landscapeMode));
  const treeEditor=createLazyEditor(()=>import('./tree-editor').then(({prepareTreeEditor})=>prepareTreeEditor(scene,onTreeEditor,DEFAULT_VEGETATION_TREES,elevationAt,world.canStand,trees=>env.vegetation.replaceTrees(trees),colliders=>world.setTreeColliders(colliders),(x,z)=>{pivot.x=T.MathUtils.clamp(pivot.x+x,0,144);pivot.z=T.MathUtils.clamp(pivot.z+z,0,72);},(x,z)=>{pivot.x=x;pivot.z=z;})),()=>onError('Не удалось загрузить редактор деревьев.'),value=>env.vegetation.setEditorActive(value));
  const generator=new T.PMREMGenerator(renderer),environment=generator.fromEquirectangular(env.surfaces.skyTexture);generator.dispose();
  scene.environment=environment.texture;scene.environmentIntensity=.48;
  scene.add(new T.HemisphereLight('#a9c5ef','#272b30',.7));
  const softFill=new T.DirectionalLight('#99b7df',.56);softFill.position.set(3,12,18);scene.add(softFill);
  const keyLight=new T.DirectionalLight('#b7d2ff',3.4);keyLight.castShadow=true;keyLight.shadow.mapSize.set(mobile?1024:2048,mobile?1024:2048);keyLight.shadow.normalBias=.035;keyLight.shadow.bias=-.00008;
  Object.assign(keyLight.shadow.camera,{left:-23,right:23,top:25,bottom:-22,near:1,far:110});scene.add(keyLight,keyLight.target);
  keyLight.shadow.radius=2.4;keyLight.shadow.blurSamples=mobile?3:6;
  const lights=Array.from({length:mobile?4:7},()=>{const light=new T.PointLight('#ffffff',0,13,2);scene.add(light);return light;});
  const player=new T.Group();player.position.set(world.spawn.x,.09,world.spawn.z);scene.add(player);
  const fill=new T.PointLight('#b7d4c7',3.2,4.5,2);fill.position.set(.4,2.8,1.1);player.add(fill);
  const ring=new T.Mesh(new T.RingGeometry(.35,.39,36),new T.MeshBasicMaterial({color:'#b9d6c5',transparent:true,opacity:.65,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.015;player.add(ring);
  const destination=new T.Mesh(new T.RingGeometry(.17,.21,32),new T.MeshBasicMaterial({color:'#e1d4b1',depthWrite:false}));destination.rotation.x=-Math.PI/2;destination.position.y=.08;destination.visible=false;scene.add(destination);
  let hero:T.Object3D|null=null,mixer:T.AnimationMixer|null=null,run:T.AnimationAction|null=null,pose:PoseController|null=null,blend=0,ready=false,disposed=false;
  const {loader,draco}=createGltfLoader();
  loader.loadAsync(ASSET_URLS.heroModel).then(gltf=>{
    if(disposed){disposeObjectTree(gltf.scene);return;}
    const root=gltf.scene;root.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(root);
    root.scale.multiplyScalar(1.85/bounds.getSize(new T.Vector3()).y);root.updateMatrixWorld(true);root.position.y-=new T.Box3().setFromObject(root).min.y;
    root.traverse(o=>{const mesh=o as T.Mesh;if(!mesh.isMesh)return;mesh.castShadow=true;mesh.receiveShadow=false;mesh.frustumCulled=false;for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material])if(mat instanceof T.MeshStandardMaterial){mat.normalScale.setScalar(.55);if(mat.map){mat.map.anisotropy=anisotropy;mat.map.needsUpdate=true;}}});
    hero=new T.Group();hero.add(root);player.add(hero);pose=new PoseController(root);pose.buildIdle(root);mixer=new T.AnimationMixer(root);combat.attach(root,mixer,gltf.animations);
    const clip=gltf.animations.find(a=>/run/i.test(a.name));if(clip){const inPlace=clip.clone();for(const track of inPlace.tracks)if(/hips\.position$/i.test(track.name))for(let i=0;i<track.values.length;i+=3){track.values[i]=track.values[0];track.values[i+2]=track.values[2];}run=mixer.clipAction(inPlace).setEffectiveWeight(0).play();}
    ready=true;renderer.shadowMap.needsUpdate=true;
  }).catch(()=>{if(!disposed)onError('Character could not load. Return to the refuge and try again.');});
  const enemyPool:T.Mesh[]=[];
  if(EXPEDITION_ENEMIES_ENABLED){
    const enemyGeo=new T.BoxGeometry(.7,1.2,.55),enemyMat=new T.MeshStandardMaterial({color:'#79664b',roughness:.72,metalness:.4}),eyeGeo=new T.BoxGeometry(.5,.12,.08),eyeMat=new T.MeshStandardMaterial({color:'#f27742',emissive:'#df4222',emissiveIntensity:2}),legGeo=new T.BoxGeometry(.16,.6,.18);
    for(let i=0;i<RULES.maxEnemies;i++){const body=new T.Mesh(enemyGeo,enemyMat);body.castShadow=true;const eye=new T.Mesh(eyeGeo,eyeMat);eye.position.set(0,.3,.3);body.add(eye);for(const x of [-.23,.23]){const leg=new T.Mesh(legGeo,enemyMat);leg.position.set(x,-.75,0);body.add(leg);}scene.add(body);body.visible=false;enemyPool.push(body);}
  }
  const beamGeo=new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3()]),beam=new T.Line(beamGeo,new T.LineBasicMaterial({color:'#8ff3ff',transparent:true,opacity:.9}));beam.visible=false;scene.add(beam);let beamUntil=0;
  const combat=new CombatDriver(skill=>{if(session.status!=='active')return;const target=session.useSkill(player.position,skill);if(target){if(hero)hero.rotation.y=Math.atan2(target.x-player.position.x,target.z-player.position.z);const points=beamGeo.attributes.position as T.BufferAttribute;points.setXYZ(0,player.position.x,player.position.y+1.3,player.position.z);points.setXYZ(1,target.x,elevationAt(target)+1.2,target.z);points.needsUpdate=true;beamGeo.computeBoundingSphere();beam.visible=skill.range>5;beamUntil=performance.now()+150;}},()=>session.hp,false);
  function fire(){combat.cast(0);}
  let budget=initialMobileBudget(),resolutionScale=1,qualityWindow=0,qualityFrames=0,qualityElapsed=0,frameMs=0,lastResolution=0;
  // Full near grass/materials; only distant density is reduced by the mobile profile.
  env.landscape.studio.setQuality(mobile?.8:1);
  let renderWidth=0,renderHeight=0,renderDpr=0;
  const resize=()=>{const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight),ratio=mobile?mobileRenderRatio(w,h,devicePixelRatio,resolutionScale):Math.min(devicePixelRatio,1.35,Math.sqrt(1500000/(w*h)));if(w===renderWidth&&h===renderHeight&&Math.abs(ratio-renderDpr)<.005)return;renderWidth=w;renderHeight=h;renderDpr=ratio;renderer.setPixelRatio(ratio);composer?.setPixelRatio(ratio);renderer.setSize(w,h);composer?.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();};
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  const keys=new Set<string>();const stick={x:0,z:0};let route:Point[]=[];
  const reset=()=>{keys.clear();stick.x=stick.z=0;route.length=0;destination.visible=false;};
  const editable=(e:KeyboardEvent)=>e.target instanceof HTMLElement&&!!e.target.closest('button,a,input,select,textarea');
  const keydown=(e:KeyboardEvent)=>{if(editable(e)||document.querySelector('[aria-modal="true"]'))return;const k=e.key.toLowerCase();if(editor.active){if((treeMode?treeEditor:editor).keyDown(e))return;if(['w','a','d','q','shift'].includes(k)){keys.add(k);e.preventDefault();}return;}if(k==='e'&&!e.repeat){session.interact(player.position);e.preventDefault();}if(k===' '){fire();e.preventDefault();}if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift'].includes(k)){e.preventDefault();keys.add(k);}};
  const keyup=(e:KeyboardEvent)=>keys.delete(e.key.toLowerCase());
  window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',reset);window.addEventListener('netrunner:input-reset',reset);
  let pointerDown:Point|null=null;
  const down=(e:PointerEvent)=>{pointerDown={x:e.clientX,z:e.clientY};renderer.domElement.focus({preventScroll:true});};
  const ray=new T.Raycaster(),hit=new T.Vector3(),plane=new T.Plane(new T.Vector3(0,1,0),-.06);
  const up=(e:PointerEvent)=>{if(!pointerDown)return;const tap=Math.hypot(pointerDown.x-e.clientX,pointerDown.z-e.clientY)<12;pointerDown=null;if(!tap||(!ready&&!editor.active))return;const r=renderer.domElement.getBoundingClientRect();ray.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),camera);plane.constant=-.06;if(ray.ray.intersectPlane(plane,hit)){for(let i=0;i<4;i++){plane.constant=-elevationAt(hit)-.06;ray.ray.intersectPlane(plane,hit);}if(editor.active){if(landscapeMode)env.landscape.studio.click(hit);else if(treeMode)treeEditor.click(ray,hit);else editor.click(ray,hit);return;}route=findRoute(world,player.position,hit);destination.visible=!!route.length;destination.position.set(hit.x,elevationAt(hit)+.09,hit.z);}};
  const hover=(e:PointerEvent)=>{if(!editor.active||landscapeMode)return;const r=renderer.domElement.getBoundingClientRect();ray.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),camera);plane.constant=-.06;if(ray.ray.intersectPlane(plane,hit)){for(let i=0;i<4;i++){plane.constant=-elevationAt(hit);ray.ray.intersectPlane(plane,hit);}(treeMode?treeEditor:editor).hover(hit);}};
  let editorZoom=22;const wheel=(e:WheelEvent)=>{if(editor.active){e.preventDefault();editorZoom=T.MathUtils.clamp(editorZoom+e.deltaY*.015,5,42);}};
  renderer.domElement.addEventListener('pointermove',hover);renderer.domElement.addEventListener('wheel',wheel,{passive:false});
  renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointerup',up);
  const lost=(e:Event)=>{e.preventDefault();onError('Graphics connection lost. Reload this level.');};renderer.domElement.addEventListener('webglcontextlost',lost);
  const pivot=new T.Vector3(world.spawn.x,1,world.spawn.z),followTarget=new T.Vector3(),shadowAnchor=new T.Vector3(Infinity,0,0),azimuth=.48;
  let modalOpen=false;const modalObserver=new MutationObserver(()=>{modalOpen=!!document.querySelector('[aria-modal="true"]');if(modalOpen)reset();});modalObserver.observe(host.parentElement??host,{childList:true,subtree:true});
  const loopStart=performance.now();
  let report=loopStart,windowStart=loopStart,count=0,fps=0,lastShadow=0,lastLights=0,lastStream=0;
  const visibleEnemies:typeof session.enemies=[];
  const selected:typeof env.lightSources=[];const lightDistances:number[]=[];
  // The shared loop (src/core/loop) owns rAF, hidden-tab handling, the mobile cadence
  // cap and the delta clamp. Open modals freeze simulation time.
  function updateFrame({now,frameMs:elapsed,dt:frameDt}:FrameTick) {
    const dt=modalOpen?0:frameDt;
    if(mobile&&ready&&!modalOpen&&!editor.active&&elapsed>0&&elapsed<250){qualityFrames++;qualityElapsed+=Math.min(elapsed,80);if(now-qualityWindow>2000){frameMs=qualityElapsed/Math.max(1,qualityFrames);if(qualityFrames>=10)budget=adaptMobileBudget(budget,frameMs);qualityFrames=0;qualityElapsed=0;qualityWindow=now;}}
    if(mobile&&now-lastResolution>600&&Math.abs(resolutionScale-budget.scale)>.001){resolutionScale+=T.MathUtils.clamp(budget.scale-resolutionScale,-.025,.025);resize();lastResolution=now;}
    const time=now/1000;
    let sx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)+stick.x;
    let sz=((keys.has('s')||editor.active&&keys.has('q'))||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0)+stick.z;
    let dx=0,dz=0;const len=Math.hypot(sx,sz);
    if(len>.1){sx/=Math.max(1,len);sz/=Math.max(1,len);dx=sx*Math.cos(azimuth)+sz*Math.sin(azimuth);dz=-sx*Math.sin(azimuth)+sz*Math.cos(azimuth);route.length=0;destination.visible=false;}
    else if(route.length){const p=route[0],distance=Math.hypot(p.x-player.position.x,p.z-player.position.z);if(distance<.14)route.shift();else{dx=(p.x-player.position.x)/distance;dz=(p.z-player.position.z)/distance;}}
    if(editor.active){pivot.x=T.MathUtils.clamp(pivot.x+dx*dt*12,0,144);pivot.z=T.MathUtils.clamp(pivot.z+dz*dt*12,0,72);dx=0;dz=0;route=[];}
    const speed=keys.has('shift')?6:4,next=ready&&session.status==='active'?move(world,player.position,dx*speed*dt,dz*speed*dt):player.position;
    const walking=Math.hypot(next.x-player.position.x,next.z-player.position.z)>.0001;player.position.x=next.x;player.position.z=next.z;player.position.y=elevationAt(next)+.09;
    if(hero&&walking){const angle=Math.atan2(dx,dz)-hero.rotation.y;hero.rotation.y+=Math.atan2(Math.sin(angle),Math.cos(angle))*Math.min(1,dt*14);}
    combat.tick(dt,session.status!=='active');blend=T.MathUtils.damp(blend,walking?1:0,16,dt);run?.setEffectiveWeight(blend*(1-combat.weight));mixer?.update(dt);pose?.apply((1-blend)*(1-combat.weight));if(!route.length)destination.visible=false;
    if(!editor.active)pivot.lerp(followTarget.set(player.position.x,player.position.y+1,player.position.z),reduced?1:1-Math.exp(-dt*8));
    const distance=editor.active?editorZoom:camera.aspect<.85?28:22;
    camera.position.set(pivot.x+Math.sin(azimuth)*distance*.86,pivot.y+distance*.62,pivot.z+Math.cos(azimuth)*distance*.86);camera.lookAt(pivot);
    if(now>beamUntil)beam.visible=false;
    if(!editor.active){session.tick(dt,player.position);if(autoFire)fire();}
    editor.stream(editor.active?pivot:player.position);treeEditor.stream(editor.active?pivot:player.position);
    env.landscape.studio.update(now*.001,editor.active?pivot:player.position,camera.position);
    if(now-lastStream>100){env.stream(editor.active?pivot:player.position,debug,session.events.has('drop')&&!session.opened.has('drop'),camera);lastStream=now;}
    let enemyIndex=0;for(const enemy of session.enemies)if(enemy.hp>0&&(enemy.x-player.position.x)**2+(enemy.z-player.position.z)**2<900&&enemyIndex<enemyPool.length)visibleEnemies[enemyIndex++]=enemy;visibleEnemies.length=enemyIndex;
    enemyPool.forEach((body,i)=>{const enemy=visibleEnemies[i];body.visible=!!enemy;if(enemy){body.position.set(enemy.x,elevationAt(enemy)+(enemy.elite?1.35:1),enemy.z);body.scale.setScalar(enemy.elite?1.5:1);body.rotation.y=Math.atan2(player.position.x-enemy.x,player.position.z-enemy.z);}});
    env.update(reduced?0:time);
    if(now-lastLights>300){selected.length=0;lightDistances.length=0;for(const source of env.lightSources){const distance=source.p.distanceToSquared(player.position);if(distance>42*42)continue;let index=0;while(index<lightDistances.length&&lightDistances[index]<distance)index++;if(index>=lights.length)continue;selected.splice(index,0,source);lightDistances.splice(index,0,distance);if(selected.length>lights.length){selected.pop();lightDistances.pop();}}lastLights=now;}
    lights.forEach((l,i)=>{const source=selected[i];if(!source){l.intensity=0;return;}l.position.copy(source.p);l.color.copy(source.color);l.intensity=source.power*(source.flicker&&!reduced?.88+.08*Math.sin(time*7+i)+.04*Math.sin(time*17):1);});
    const anchor=editor.active?pivot:player.position;const shadowMoving=walking||visibleEnemies.length>0||editor.active||shadowAnchor.distanceToSquared(anchor)>.09;if(now-lastShadow>(mobile?(shadowMoving?100:700):45)){keyLight.position.set(anchor.x-16,32,anchor.z+12);keyLight.target.position.set(anchor.x,anchor.y+4,anchor.z);renderer.shadowMap.needsUpdate=true;shadowAnchor.copy(anchor);lastShadow=now;}
  }
  function renderFrame({now}:FrameTick) {
    renderer.info.reset();if(mobile)renderer.render(scene,camera);else composer?.render();
    count++;if(now-windowStart>2000){fps=Math.round(count*1000/(now-windowStart));count=0;windowStart=now;}
    if(now-report>180){const target=[...EXTRACTIONS,...POIS].find(o=>Math.hypot(o.x-player.position.x,o.z-player.position.z)<3);onState({x:player.position.x,z:player.position.z,room:sectorAt(player.position).name,fps,draws:renderer.info.render.calls,near:target?.name??null,ready,hp:session.hp,bag:{...session.bag},status:session.status,message:session.message,discovered:[...session.discovered],activeNPC:session.enemies.filter(e=>e.hp>0&&Math.hypot(e.x-player.position.x,e.z-player.position.z)<25).length,chunks:env.activeChunks,extraction:session.extraction,kills:session.kills,performance:{ratio:renderDpr,scale:resolutionScale,target:mobile?budget.target:60,frameMs,triangles:renderer.info.render.triangles,textures:renderer.info.memory.textures,geometries:renderer.info.memory.geometries,detailCulled:env.detailCulled}});report=now;}

  }
  const loop=createFrameLoop({
    startTime:loopStart,
    targetFps:()=>mobile?budget.target:null,
    onVisibilityChange(now){reset();window.dispatchEvent(new Event('netrunner:input-reset'));windowStart=qualityWindow=now;count=qualityFrames=qualityElapsed=0;},
    update:updateFrame,
    render:renderFrame,
  });
  loop.start();
  return {editor,treeEditor,landscape:env.landscape.studio,setLandscapeMode(value:boolean){landscapeMode=value;treeMode=false;treeEditor.setActive(false);editor.cancel();env.landscape.studio.setActive(value&&editor.active);},setTreeMode(value:boolean){treeMode=value;landscapeMode=false;env.landscape.studio.setActive(false);editor.cancel();treeEditor.setActive(value&&masterActive);},setMaster(value:boolean){masterActive=value;reset();editor.setActive(value);treeEditor.setActive(value&&treeMode)},setAutoFire(value:boolean){autoFire=value;},interact(){session.interact(player.position);},attack(){fire();},setDebug(value:boolean){debug=value;},teleport(p:Point){if(world.canStand(p)){player.position.set(p.x,.09,p.z);reset();}},setStick(x:number,z:number){if(modalOpen||editor.active||session.status!=='active'){stick.x=stick.z=0;return;}stick.x=Number.isFinite(x)?T.MathUtils.clamp(x,-1,1):0;stick.z=Number.isFinite(z)?T.MathUtils.clamp(z,-1,1):0;},dispose(){disposed=true;loop.dispose();observer.disconnect();window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',reset);window.removeEventListener('netrunner:input-reset',reset);modalObserver.disconnect();renderer.domElement.removeEventListener('pointerdown',down);renderer.domElement.removeEventListener('pointerup',up);renderer.domElement.removeEventListener('webglcontextlost',lost);renderer.domElement.removeEventListener('pointermove',hover);renderer.domElement.removeEventListener('wheel',wheel);editor.dispose();treeEditor.dispose();combat.dispose();env.dispose();mixer?.stopAllAction();disposeObjectTree(scene);env.surfaces.dispose();environment.dispose();draco.dispose();bloom?.dispose();output?.dispose();composer?.dispose();renderer.dispose();renderer.domElement.remove();}};
}
