import type {createPropEditor,EditorState} from './prop-editor';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { PoseController } from '../game/pose-controller';
import { CombatDriver } from '../game/combat-driver';
import { buildEnvironment } from './environment';
import { findRoute, move, makeWorld, type Point } from './world';
import { ExpeditionSession } from './session';
import { POIS, EXTRACTIONS, sectorAt } from './config';

export type Snapshot=Point & {room:string;fps:number;draws:number;near:string|null;ready:boolean;hp:number;bag:ExpeditionSession['bag'];status:ExpeditionSession['status'];message:string;discovered:string[];activeNPC:number;chunks:number;extraction:number;kills:number};
export function createExpedition(host:HTMLElement,onState:(s:Snapshot)=>void,onError:(s:string)=>void,onEditor:(s:EditorState)=>void=()=>{}) {
  const session=new ExpeditionSession(); let debug=false,autoFire=false,landscapeMode=false;
  const world=makeWorld(),elevationAt=world.elevationAt,scene=new T.Scene();scene.background=new T.Color('#111b2b');scene.fog=new T.FogExp2('#192738',.014);
  const mobile=matchMedia('(pointer:coarse)').matches,reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
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
  const env=buildEnvironment(scene,world,1,renderer.capabilities.getMaxAnisotropy());
  // The normal gameplay path never creates the authoring library, drafts, ghosts or outline.
  let editorInstance:ReturnType<typeof createPropEditor>|undefined,editorLoading:Promise<void>|undefined,masterRequested=false;
  const editor=new Proxy({} as ReturnType<typeof createPropEditor>,{get(_target,key){if(editorInstance)return Reflect.get(editorInstance,key);if(key==='active'||key==='placing')return false;return ()=>{};}});
  function enableMaster(value:boolean){masterRequested=value;if(editorInstance){editorInstance.setActive(value);env.landscape.studio.setActive(value&&landscapeMode);return;}if(!value)return;
    editorLoading??=import('./prop-editor').then(({createPropEditor})=>{if(disposed)return;editorInstance=createPropEditor(scene,onEditor,renderer.capabilities.getMaxAnisotropy(),elevationAt,pads=>{world.landscape.setEditorPads(pads);env.landscape.studio.refreshPads();});editorInstance.setActive(masterRequested);env.landscape.studio.setActive(masterRequested&&landscapeMode);}).catch(()=>{editorLoading=undefined;onError('Не удалось загрузить MASTER. Повторите попытку.');});
  }
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
  const draco=new DRACOLoader();draco.setDecoderPath('/game/draco/');const loader=new GLTFLoader();loader.setDRACOLoader(draco);
  function disposeTree(root:T.Object3D) {
    const gs=new Set<T.BufferGeometry>(),ms=new Set<T.Material>(),ts=new Set<T.Texture>();
    root.traverse(o=>{const mesh=o as T.Mesh;if(mesh.geometry)gs.add(mesh.geometry);if(mesh.material)for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material]){ms.add(mat);for(const value of Object.values(mat))if(value instanceof T.Texture)ts.add(value);}});
    gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());ts.forEach(t=>t.dispose());
  }
  loader.loadAsync('/game/models/mixamo/neon-sentinel-mixamo-test.glb').then(gltf=>{
    if(disposed){disposeTree(gltf.scene);return;}
    const root=gltf.scene;root.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(root);
    root.scale.multiplyScalar(1.85/bounds.getSize(new T.Vector3()).y);root.updateMatrixWorld(true);root.position.y-=new T.Box3().setFromObject(root).min.y;
    root.traverse(o=>{const mesh=o as T.Mesh;if(!mesh.isMesh)return;mesh.castShadow=true;mesh.receiveShadow=false;mesh.frustumCulled=false;for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material])if(mat instanceof T.MeshStandardMaterial){mat.normalScale.setScalar(.55);if(mat.map){mat.map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());mat.map.needsUpdate=true;}}});
    hero=new T.Group();hero.add(root);player.add(hero);pose=new PoseController(root);pose.buildIdle(root);mixer=new T.AnimationMixer(root);combat.attach(root,mixer,gltf.animations);
    const clip=gltf.animations.find(a=>/run/i.test(a.name));if(clip){const inPlace=clip.clone();for(const track of inPlace.tracks)if(/hips\.position$/i.test(track.name))for(let i=0;i<track.values.length;i+=3){track.values[i]=track.values[0];track.values[i+2]=track.values[2];}run=mixer.clipAction(inPlace).setEffectiveWeight(0).play();}
    ready=true;renderer.shadowMap.needsUpdate=true;
  }).catch(()=>{if(!disposed)onError('Character could not load. Return to the refuge and try again.');});
  const enemyGeo=new T.BoxGeometry(.7,1.2,.55),enemyMat=new T.MeshStandardMaterial({color:'#79664b',roughness:.72,metalness:.4}),eyeGeo=new T.BoxGeometry(.5,.12,.08),eyeMat=new T.MeshStandardMaterial({color:'#f27742',emissive:'#df4222',emissiveIntensity:2});
  const enemyPool=Array.from({length:14},()=>{const body=new T.Mesh(enemyGeo,enemyMat);body.castShadow=true;const eye=new T.Mesh(eyeGeo,eyeMat);eye.position.set(0,.3,.3);body.add(eye);const legGeo=new T.BoxGeometry(.16,.6,.18);for(const x of [-.23,.23]){const leg=new T.Mesh(legGeo,enemyMat);leg.position.set(x,-.75,0);body.add(leg);}scene.add(body);body.visible=false;return body;});
  const beamGeo=new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3()]),beam=new T.Line(beamGeo,new T.LineBasicMaterial({color:'#8ff3ff',transparent:true,opacity:.9}));beam.visible=false;scene.add(beam);let beamUntil=0;
  const combat=new CombatDriver(skill=>{if(session.status!=='active')return;const target=session.useSkill(player.position,skill);if(target){if(hero)hero.rotation.y=Math.atan2(target.x-player.position.x,target.z-player.position.z);const points=beamGeo.attributes.position as T.BufferAttribute;points.setXYZ(0,player.position.x,player.position.y+1.3,player.position.z);points.setXYZ(1,target.x,elevationAt(target)+1.2,target.z);points.needsUpdate=true;beamGeo.computeBoundingSphere();beam.visible=skill.range>5;beamUntil=performance.now()+150;}},()=>session.hp);
  function fire(){combat.cast(0);}
  // Resolution is the final quality lever: keep mobile silhouettes sharp first.
  let qualityTier=mobile?1:2,qualityWindow=0,qualityFrames=0,qualityElapsed=0;
  const applyQuality=()=>env.landscape.studio.setQuality(qualityTier===0?.55:qualityTier===1?.8:1);
  const resize=()=>{const w=host.clientWidth,h=host.clientHeight,ratio=Math.min(devicePixelRatio,mobile?(qualityTier===0?1.5:2):1.35,Math.sqrt((mobile?(qualityTier===0?1800000:2800000):1500000)/Math.max(1,w*h)));renderer.setPixelRatio(ratio);composer?.setPixelRatio(ratio);renderer.setSize(w,h);composer?.setSize(w,h);camera.aspect=w/Math.max(1,h);camera.updateProjectionMatrix();};
  const observer=new ResizeObserver(resize);observer.observe(host);resize();applyQuality();
  const keys=new Set<string>();let stick={x:0,z:0},route:Point[]=[];
  const reset=()=>{keys.clear();stick={x:0,z:0};route=[];destination.visible=false;};
  const editable=(e:KeyboardEvent)=>e.target instanceof HTMLElement&&!!e.target.closest('button,a,input,select,textarea');
  const keydown=(e:KeyboardEvent)=>{if(editable(e)||document.querySelector('[aria-modal="true"]'))return;const k=e.key.toLowerCase();if(editor.active){if(k==='escape')editor.cancel();if(k==='delete'||k==='backspace'){editor.remove();e.preventDefault();}if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift'].includes(k)){keys.add(k);e.preventDefault();}return;}if(k==='e'&&!e.repeat){session.interact(player.position);e.preventDefault();}if(k===' '){fire();e.preventDefault();}if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift'].includes(k)){e.preventDefault();keys.add(k);}};
  const keyup=(e:KeyboardEvent)=>keys.delete(e.key.toLowerCase());
  window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',reset);document.addEventListener('visibilitychange',reset);
  let pointerDown:Point|null=null;
  const down=(e:PointerEvent)=>{pointerDown={x:e.clientX,z:e.clientY};renderer.domElement.focus({preventScroll:true});};
  const ray=new T.Raycaster(),hit=new T.Vector3(),plane=new T.Plane(new T.Vector3(0,1,0),-.06);
  const up=(e:PointerEvent)=>{if(!pointerDown)return;const tap=Math.hypot(pointerDown.x-e.clientX,pointerDown.z-e.clientY)<12;pointerDown=null;if(!tap||(!ready&&!editor.active))return;const r=renderer.domElement.getBoundingClientRect();ray.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),camera);plane.constant=-.06;if(ray.ray.intersectPlane(plane,hit)){for(let i=0;i<4;i++){plane.constant=-elevationAt(hit)-.06;ray.ray.intersectPlane(plane,hit);}if(editor.active){if(landscapeMode)env.landscape.studio.click(hit);else editor.click(ray,hit);return;}route=findRoute(world,player.position,hit);destination.visible=!!route.length;destination.position.set(hit.x,elevationAt(hit)+.09,hit.z);}};
  const hover=(e:PointerEvent)=>{if(!editor.active||landscapeMode)return;const r=renderer.domElement.getBoundingClientRect();ray.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),camera);plane.constant=-.06;if(ray.ray.intersectPlane(plane,hit)){for(let i=0;i<4;i++){plane.constant=-elevationAt(hit);ray.ray.intersectPlane(plane,hit);}editor.hover(hit);}};
  let editorZoom=22;const wheel=(e:WheelEvent)=>{if(editor.active){e.preventDefault();editorZoom=T.MathUtils.clamp(editorZoom+e.deltaY*.015,5,42);}};
  renderer.domElement.addEventListener('pointermove',hover);renderer.domElement.addEventListener('wheel',wheel,{passive:false});
  renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointerup',up);
  const lost=(e:Event)=>{e.preventDefault();onError('Graphics connection lost. Reload this level.');};renderer.domElement.addEventListener('webglcontextlost',lost);
  const pivot=new T.Vector3(world.spawn.x,1,world.spawn.z),azimuth=.48;
  let frame=0,last=performance.now(),report=last,windowStart=last,count=0,fps=0,lastShadow=0,lastLights=0;
  let selected:typeof env.lightSources=[];
  function animate(now:number) {
    if(disposed)return;frame=requestAnimationFrame(animate);if(document.hidden){last=now;return;}
    const elapsed=now-last;const dt=document.querySelector('[aria-modal="true"]')?0:Math.min(elapsed/1000,.05);last=now;
    if(mobile&&ready&&elapsed<150){qualityFrames++;qualityElapsed+=elapsed;if(now-qualityWindow>5000){const mean=qualityElapsed/Math.max(1,qualityFrames);const nextTier=mean>29?0:mean<20?1:qualityTier;if(nextTier!==qualityTier){qualityTier=nextTier;applyQuality();resize();}qualityFrames=0;qualityElapsed=0;qualityWindow=now;}}const time=now/1000;
    let sx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)+stick.x;
    let sz=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0)+stick.z;
    let dx=0,dz=0;const len=Math.hypot(sx,sz);
    if(len>.1){sx/=Math.max(1,len);sz/=Math.max(1,len);dx=sx*Math.cos(azimuth)+sz*Math.sin(azimuth);dz=-sx*Math.sin(azimuth)+sz*Math.cos(azimuth);route=[];destination.visible=false;}
    else if(route.length){const p=route[0],distance=Math.hypot(p.x-player.position.x,p.z-player.position.z);if(distance<.14)route.shift();else{dx=(p.x-player.position.x)/distance;dz=(p.z-player.position.z)/distance;}}
    if(editor.active){pivot.x=T.MathUtils.clamp(pivot.x+dx*dt*12,0,144);pivot.z=T.MathUtils.clamp(pivot.z+dz*dt*12,0,72);dx=0;dz=0;route=[];}
    const speed=keys.has('shift')?6:4,next=ready&&session.status==='active'?move(world,player.position,dx*speed*dt,dz*speed*dt):player.position;
    const walking=Math.hypot(next.x-player.position.x,next.z-player.position.z)>.0001;player.position.x=next.x;player.position.z=next.z;player.position.y=elevationAt(next)+.09;
    if(hero&&walking){const angle=Math.atan2(dx,dz)-hero.rotation.y;hero.rotation.y+=Math.atan2(Math.sin(angle),Math.cos(angle))*Math.min(1,dt*14);}
    combat.tick(dt,session.status!=='active');blend=T.MathUtils.damp(blend,walking?1:0,16,dt);run?.setEffectiveWeight(blend*(1-combat.weight));mixer?.update(dt);pose?.apply((1-blend)*(1-combat.weight));if(!route.length)destination.visible=false;
    if(!editor.active)pivot.lerp(new T.Vector3(player.position.x,player.position.y+1,player.position.z),reduced?1:1-Math.exp(-dt*8));
    const distance=editor.active?editorZoom:camera.aspect<.85?28:22;
    camera.position.set(pivot.x+Math.sin(azimuth)*distance*.86,pivot.y+distance*.62,pivot.z+Math.cos(azimuth)*distance*.86);camera.lookAt(pivot);
    if(now>beamUntil)beam.visible=false;
    if(!editor.active){session.tick(dt,player.position);if(autoFire)fire();}
    editor.stream(editor.active?pivot:player.position);
    env.landscape.studio.update(now*.001,editor.active?pivot:player.position,camera.position);
    env.stream(editor.active?pivot:player.position,debug,session.events.has('drop')&&!session.opened.has('drop'));
    const visibleEnemies=session.enemies.filter(e=>e.hp>0&&Math.hypot(e.x-player.position.x,e.z-player.position.z)<30);
    enemyPool.forEach((body,i)=>{const enemy=visibleEnemies[i];body.visible=!!enemy;if(enemy){body.position.set(enemy.x,elevationAt(enemy)+(enemy.elite?1.35:1),enemy.z);body.scale.setScalar(enemy.elite?1.5:1);body.rotation.y=Math.atan2(player.position.x-enemy.x,player.position.z-enemy.z);}});
    env.update(reduced?0:time);
    if(now-lastLights>200){selected=[...env.lightSources].sort((a,b)=>a.p.distanceToSquared(player.position)-b.p.distanceToSquared(player.position)).slice(0,lights.length);lastLights=now;}
    lights.forEach((l,i)=>{const source=selected[i];if(!source){l.intensity=0;return;}l.position.copy(source.p);l.color.copy(source.color);l.intensity=source.power*(source.flicker&&!reduced?.88+.08*Math.sin(time*7+i)+.04*Math.sin(time*17):1);});
    if(now-lastShadow>(mobile?90:45)){const anchor=editor.active?pivot:player.position;keyLight.position.set(anchor.x-16,32,anchor.z+12);keyLight.target.position.set(anchor.x,anchor.y+4,anchor.z);renderer.shadowMap.needsUpdate=true;lastShadow=now;}
    renderer.info.reset();if(mobile)renderer.render(scene,camera);else composer?.render();
    count++;if(now-windowStart>2000){fps=Math.round(count*1000/(now-windowStart));count=0;windowStart=now;}
    if(now-report>180){const target=[...EXTRACTIONS,...POIS].find(o=>Math.hypot(o.x-player.position.x,o.z-player.position.z)<3);onState({x:player.position.x,z:player.position.z,room:sectorAt(player.position).name,fps,draws:renderer.info.render.calls,near:target?.name??null,ready,hp:session.hp,bag:{...session.bag},status:session.status,message:session.message,discovered:[...session.discovered],activeNPC:session.enemies.filter(e=>e.hp>0&&Math.hypot(e.x-player.position.x,e.z-player.position.z)<25).length,chunks:env.activeChunks,extraction:session.extraction,kills:session.kills});report=now;}

  }
  frame=requestAnimationFrame(animate);
  return {editor,landscape:env.landscape.studio,setLandscapeMode(value:boolean){landscapeMode=value;editor.cancel();env.landscape.studio.setActive(value&&editor.active);},setMaster(value:boolean){reset();enableMaster(value);},setAutoFire(value:boolean){autoFire=value;},interact(){session.interact(player.position);},attack(){fire();},setDebug(value:boolean){debug=value;},teleport(p:Point){if(world.canStand(p)){player.position.set(p.x,.09,p.z);reset();}},setStick(x:number,z:number){stick={x,z};},dispose(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',reset);document.removeEventListener('visibilitychange',reset);renderer.domElement.removeEventListener('pointerdown',down);renderer.domElement.removeEventListener('pointerup',up);renderer.domElement.removeEventListener('webglcontextlost',lost);renderer.domElement.removeEventListener('pointermove',hover);renderer.domElement.removeEventListener('wheel',wheel);editor.dispose();combat.dispose();env.dispose();mixer?.stopAllAction();disposeTree(scene);env.surfaces.dispose();environment.dispose();draco.dispose();bloom?.dispose();output?.dispose();composer?.dispose();renderer.dispose();renderer.domElement.remove();}};
}
