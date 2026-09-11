'use client';
import {useEffect,useRef,useState} from 'react';
import * as T from 'three';
import {createPropLibrary,type PropId} from './prop-assets';
import {animateCityProps} from './city-props';

/** One renderer and library per panel. Render only when the asset, angle or size changes. */
export default function PropPreview({asset,rotation,length=3}:{asset:PropId;rotation:number;length?:number}){
 const host=useRef<HTMLDivElement>(null);
 const [stats,setStats]=useState({triangles:0,geometryBytes:0,drawCalls:0,width:0,height:0,depth:0});
 const update=useRef<((asset:PropId,rotation:number,length:number)=>void)|null>(null);
 const latest=useRef({asset,rotation,length});
 useEffect(()=>{latest.current={asset,rotation,length};},[asset,rotation,length]);
 useEffect(()=>{
  if(!host.current)return;
  const container=host.current,renderer=new T.WebGLRenderer({antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.VSMShadowMap;
  renderer.domElement.style.display='block';renderer.domElement.style.width='100%';renderer.domElement.style.height='200px';container.appendChild(renderer.domElement);
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(32,1,.01,50);
  let disposed=false,frame=0,fireFrame=0,object:T.Group|null=null,current:string|null=null;
  const draw=()=>{if(disposed)return;cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>renderer.render(scene,camera));};
  const library=createPropLibrary(8,draw);
  scene.add(new T.HemisphereLight(0xe1ebf4,0x413a30,2.2));
  const key=new T.DirectionalLight(0xffecd4,3.1);key.position.set(-3,5,5);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-8;key.shadow.camera.right=8;key.shadow.camera.top=8;key.shadow.camera.bottom=-8;key.shadow.bias=-.0005;scene.add(key);
  const rim=new T.DirectionalLight(0xa8c8d8,1.8);rim.position.set(3,3,-3);scene.add(rim);
  const floor=new T.Mesh(new T.CircleGeometry(3,48),new T.ShadowMaterial({opacity:.3}));floor.receiveShadow=true;floor.scale.setScalar(4);floor.rotation.x=-Math.PI/2;floor.position.y=-.018;scene.add(floor);
  function fit(){
   if(!object)return;
   const width=Math.max(container.clientWidth,200);renderer.setSize(width,200,false);camera.aspect=width/200;
   const bounds=new T.Box3().setFromObject(object),center=bounds.getCenter(new T.Vector3());
   const size=bounds.getSize(new T.Vector3()),span=Math.max(size.x,size.y,size.z,2);
   floor.scale.setScalar(Math.max(4,Math.max(size.x,size.z)/4));
   key.position.copy(center).add(new T.Vector3(-span,span*1.4,span));key.target.position.copy(center);scene.add(key.target);
   key.shadow.camera.left=-span;key.shadow.camera.right=span;key.shadow.camera.top=span;key.shadow.camera.bottom=-span;key.shadow.camera.far=span*5+20;key.shadow.camera.updateProjectionMatrix();
   // Fit the projected box with a consistent margin for both wide and upright props.
   const direction=new T.Vector3(.65,.43,1.5).normalize();
   camera.position.copy(center).add(direction);camera.lookAt(center);camera.updateMatrixWorld();
   const inverse=camera.quaternion.clone().invert();
   const tanY=Math.tan(camera.fov*Math.PI/360),tanX=tanY*camera.aspect;
   let distance=0;
   for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
    const p=new T.Vector3(x,y,z).sub(center).applyQuaternion(inverse);
    distance=Math.max(distance,p.z+Math.abs(p.x)/tanX,p.z+Math.abs(p.y)/tanY);
   }
   camera.far=Math.max(50,distance*2+30);camera.position.copy(center).addScaledVector(direction,distance*1.09);camera.lookAt(center);camera.updateProjectionMatrix();draw();
  }
  const animateFire=()=>{if(disposed||!object)return;animateCityProps(object,performance.now()/1000);renderer.render(scene,camera);fireFrame=requestAnimationFrame(animateFire);};
  update.current=(id,angle,len)=>{cancelAnimationFrame(fireFrame);if(id+len!==current){if(object)scene.remove(object);object=library.create(id,len);scene.add(object);current=id+len;setStats(library.metrics(id,len));}object!.rotation.y=angle*Math.PI/180;fit();if(id==='campfire')fireFrame=requestAnimationFrame(animateFire);};
  update.current(latest.current.asset,latest.current.rotation,latest.current.length);
  const resize=new ResizeObserver(fit);resize.observe(container);
  return()=>{disposed=true;update.current=null;resize.disconnect();cancelAnimationFrame(frame);cancelAnimationFrame(fireFrame);floor.geometry.dispose();floor.material.dispose();library.dispose();renderer.dispose();renderer.domElement.remove();};
 },[]);
 useEffect(()=>{update.current?.(asset,rotation,length);},[asset,rotation,length]);
 return <><div ref={host} aria-label="Трёхмерный предпросмотр выбранной модели"/><small>{Math.round(stats.triangles).toLocaleString('ru-RU')} треугольников · {(stats.geometryBytes/1024).toFixed(1)} КБ геометрии · {stats.drawCalls} вызовов отрисовки<br/>{stats.width.toFixed(2)} × {stats.depth.toFixed(2)} × {stats.height.toFixed(2)} м · Ш × Г × В</small></>;
}
