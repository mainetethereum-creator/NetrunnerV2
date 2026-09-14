import * as T from 'three';
import { createGltfLoader } from '../../src/renderer/three/gltf-loader';
import { disposeObjectTree } from '../../src/renderer/three/dispose';
import { ASSET_URLS } from '../../src/assets/registry';
import { createFrameLoop, type FrameTick } from '../../src/core/loop/frame-loop';
import { createMovementInput } from '../../src/input/movement-input';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { PoseController } from '../game/pose-controller';
import { buildEnvironment } from './environment';
import { findRoute, move, makeWorld, type Point } from './world';

export type Snapshot=Point & {room:string;fps:number;draws:number;near:'entry'|'exit'|null;ready:boolean};
export function createMetro(host:HTMLElement,level:number,onState:(s:Snapshot)=>void,onError:(s:string)=>void) {
  const world=makeWorld(level),scene=new T.Scene();scene.background=new T.Color('#0c161d');scene.fog=new T.FogExp2('#0c191e',.025);
  const mobile=matchMedia('(pointer:coarse)').matches,reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
  const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.VSMShadowMap;renderer.shadowMap.autoUpdate=false;
  renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','Metro 3D. Click to move, WASD to walk.');host.appendChild(renderer.domElement);
  const camera=new T.PerspectiveCamera(38,1,.15,130);
  const composer=new EffectComposer(renderer,new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,samples:Math.min(mobile?2:4,renderer.capabilities.maxSamples)}));
  composer.addPass(new RenderPass(scene,camera));
  const bloom=new UnrealBloomPass(new T.Vector2(800,600),.24,.6,1.1);composer.addPass(bloom);
  const output=new OutputPass();composer.addPass(output);
  const env=buildEnvironment(scene,world,level,renderer.capabilities.getMaxAnisotropy());
  const generator=new T.PMREMGenerator(renderer),environment=generator.fromEquirectangular(env.surfaces.skyTexture);generator.dispose();
  scene.environment=environment.texture;scene.environmentIntensity=.32;
  scene.add(new T.HemisphereLight('#9bbac8','#292720',.60));
  const keyLight=new T.DirectionalLight('#b5d1cf',1.5);keyLight.castShadow=true;keyLight.shadow.mapSize.set(mobile?1024:2048,mobile?1024:2048);keyLight.shadow.normalBias=.045;keyLight.shadow.bias=-.0001;
  Object.assign(keyLight.shadow.camera,{left:-17,right:17,top:17,bottom:-17,near:1,far:60});scene.add(keyLight,keyLight.target);
  keyLight.shadow.radius=2;keyLight.shadow.blurSamples=mobile?4:8;
  const lights=Array.from({length:mobile?4:7},()=>{const light=new T.PointLight('#ffffff',0,10,2);scene.add(light);return light;});
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
    root.traverse(o=>{const mesh=o as T.Mesh;if(!mesh.isMesh)return;mesh.castShadow=true;mesh.receiveShadow=false;mesh.frustumCulled=false;for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material])if(mat instanceof T.MeshStandardMaterial){mat.normalScale.setScalar(.55);if(mat.map){mat.map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());mat.map.needsUpdate=true;}}});
    hero=new T.Group();hero.add(root);player.add(hero);pose=new PoseController(root);pose.buildIdle(root);mixer=new T.AnimationMixer(root);
    const clip=gltf.animations.find(a=>/run/i.test(a.name));if(clip){const inPlace=clip.clone();for(const track of inPlace.tracks)if(/hips\.position$/i.test(track.name))for(let i=0;i<track.values.length;i+=3){track.values[i]=track.values[0];track.values[i+2]=track.values[2];}run=mixer.clipAction(inPlace).setEffectiveWeight(0).play();}
    ready=true;renderer.shadowMap.needsUpdate=true;
  }).catch(()=>{if(!disposed)onError('Character could not load. Return to the refuge and try again.');});
  const resize=()=>{const w=host.clientWidth,h=host.clientHeight,ratio=Math.min(devicePixelRatio,mobile?1:1.35,Math.sqrt((mobile?850000:1500000)/Math.max(1,w*h)));renderer.setPixelRatio(ratio);composer.setPixelRatio(ratio);renderer.setSize(w,h);composer.setSize(w,h);camera.aspect=w/Math.max(1,h);camera.updateProjectionMatrix();};
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  const input=createMovementInput(),moveDirection={x:0,z:0};let route:Point[]=[];
  const reset=()=>{input.clear();route=[];destination.visible=false;};
  const editable=(e:KeyboardEvent)=>e.target instanceof HTMLElement&&!!e.target.closest('button,a,input,select,textarea');
  const keydown=(e:KeyboardEvent)=>{if(editable(e))return;const k=e.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift'].includes(k)){e.preventDefault();input.keys.add(k);}};
  const keyup=(e:KeyboardEvent)=>input.keys.delete(e.key.toLowerCase());
  window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',reset);document.addEventListener('visibilitychange',reset);
  let pointerDown:Point|null=null;
  const down=(e:PointerEvent)=>{pointerDown={x:e.clientX,z:e.clientY};renderer.domElement.focus({preventScroll:true});};
  const ray=new T.Raycaster(),hit=new T.Vector3(),plane=new T.Plane(new T.Vector3(0,1,0),-.06);
  const up=(e:PointerEvent)=>{if(!pointerDown)return;const tap=Math.hypot(pointerDown.x-e.clientX,pointerDown.z-e.clientY)<12;pointerDown=null;if(!tap||!ready)return;const r=renderer.domElement.getBoundingClientRect();ray.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),camera);if(ray.ray.intersectPlane(plane,hit)){route=findRoute(world,player.position,hit);destination.visible=!!route.length;destination.position.set(hit.x,.09,hit.z);}};
  renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointerup',up);
  const lost=(e:Event)=>{e.preventDefault();onError('Graphics connection lost. Reload this level.');};renderer.domElement.addEventListener('webglcontextlost',lost);
  const pivot=new T.Vector3(world.spawn.x,1,world.spawn.z),azimuth=.48;
  const loopStart=performance.now();
  let report=loopStart,windowStart=loopStart,count=0,fps=0,lastShadow=0,lastLights=0;
  let selected:typeof env.lightSources=[];
  // The shared loop keeps scheduling while hidden and skips those frames (metro's original behaviour).
  function updateFrame({now,dt}:FrameTick) {
    const time=now/1000;
    let dx=0,dz=0;
    if(input.resolve(moveDirection,azimuth,.1)){dx=moveDirection.x;dz=moveDirection.z;route=[];destination.visible=false;}
    else if(route.length){const p=route[0],distance=Math.hypot(p.x-player.position.x,p.z-player.position.z);if(distance<.14)route.shift();else{dx=(p.x-player.position.x)/distance;dz=(p.z-player.position.z)/distance;}}
    const speed=input.running?5:3.1,next=ready?move(world,player.position,dx*speed*dt,dz*speed*dt):player.position;
    const walking=Math.hypot(next.x-player.position.x,next.z-player.position.z)>.0001;player.position.x=next.x;player.position.z=next.z;
    if(hero&&walking){const angle=Math.atan2(dx,dz)-hero.rotation.y;hero.rotation.y+=Math.atan2(Math.sin(angle),Math.cos(angle))*Math.min(1,dt*14);}
    blend=T.MathUtils.damp(blend,walking?1:0,16,dt);run?.setEffectiveWeight(blend);mixer?.update(dt);pose?.apply(1-blend);if(!route.length)destination.visible=false;
    pivot.lerp(new T.Vector3(player.position.x,1,player.position.z),reduced?1:1-Math.exp(-dt*8));
    const distance=camera.aspect<.85?28:22;
    camera.position.set(pivot.x+Math.sin(azimuth)*distance*.86,pivot.y+distance*.62,pivot.z+Math.cos(azimuth)*distance*.86);camera.lookAt(pivot);
    env.update(reduced?0:time);
    if(now-lastLights>200){selected=[...env.lightSources].sort((a,b)=>a.p.distanceToSquared(player.position)-b.p.distanceToSquared(player.position)).slice(0,lights.length);lastLights=now;}
    lights.forEach((l,i)=>{const source=selected[i];if(!source){l.intensity=0;return;}l.position.copy(source.p);l.color.copy(source.color);l.intensity=source.power*(source.flicker&&!reduced?.88+.08*Math.sin(time*7+i)+.04*Math.sin(time*17):1);});
    if(now-lastShadow>(mobile?90:45)){keyLight.position.set(player.position.x-9,18,player.position.z+6);keyLight.target.position.copy(player.position);renderer.shadowMap.needsUpdate=true;lastShadow=now;}
  }
  function renderFrame({now}:FrameTick) {
    if(mobile)renderer.render(scene,camera);else composer.render();
    count++;if(now-windowStart>2000){fps=Math.round(count*1000/(now-windowStart));count=0;windowStart=now;}
    if(now-report>180){const exitDist=Math.hypot(player.position.x-world.exit.x,player.position.z-world.exit.z),entryDist=Math.hypot(player.position.x-world.spawn.x,player.position.z-world.spawn.z);onState({x:player.position.x,z:player.position.z,room:world.roomAt(player.position)?.name??'Connecting tunnel',fps,draws:renderer.info.render.calls,near:exitDist<2?'exit':entryDist<2?'entry':null,ready});report=now;}
  }
  const loop=createFrameLoop({startTime:loopStart,hidden:'skip',update:updateFrame,render:renderFrame});
  loop.start();
  return {setStick(x:number,z:number){input.setStick(x,z);},dispose(){disposed=true;loop.dispose();observer.disconnect();window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',reset);document.removeEventListener('visibilitychange',reset);renderer.domElement.removeEventListener('pointerdown',down);renderer.domElement.removeEventListener('pointerup',up);renderer.domElement.removeEventListener('webglcontextlost',lost);mixer?.stopAllAction();disposeObjectTree(scene);env.surfaces.dispose();environment.dispose();draco.dispose();bloom.dispose();output.dispose();composer.dispose();renderer.dispose();renderer.domElement.remove();}};
}
