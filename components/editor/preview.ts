import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {bakeVegetation,type BakeSettings} from './bake';
import {buildVegetation} from '../vegetation/render';
export function createPreview(host:HTMLElement){
 const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.toneMapping=T.ACESFilmicToneMapping;host.appendChild(renderer.domElement);
 const scene=new T.Scene();scene.background=new T.Color('#101c20');const camera=new T.PerspectiveCamera(42,1,.1,150);camera.position.set(36,15,74);const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(22,1,55);controls.enableDamping=true;controls.update();
 scene.add(new T.HemisphereLight('#c8e0e4','#394131',2.8));const sun=new T.DirectionalLight('#dce5d4',3);sun.position.set(20,18,40);sun.target.position.set(22,0,55);scene.add(sun,sun.target);
 const floor=new T.Mesh(new T.BoxGeometry(18,.12,12),new T.MeshStandardMaterial({color:'#333e37',roughness:.95}));floor.position.set(22,-.1,55);scene.add(floor);const grid=new T.GridHelper(18,18,'#5b7866','#3f534c');grid.position.set(22,0,55);scene.add(grid);
 let plants:T.Group|null=null,frame=0;
 const disposeGroup=(group:T.Object3D)=>{const materials=new Set<T.Material>();group.traverse(o=>{const mesh=o as T.Mesh;mesh.geometry?.dispose();if(mesh.material)for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])materials.add(m);});materials.forEach(m=>m.dispose());};
 const resize=()=>{const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(host);resize();
 const animate=()=>{frame=requestAnimationFrame(animate);controls.update();renderer.render(scene,camera);};animate();
 return {generate(settings:BakeSettings){const asset=bakeVegetation(settings);if(plants){scene.remove(plants);disposeGroup(plants);}plants=buildVegetation(asset);scene.add(plants);return asset;},dispose(){cancelAnimationFrame(frame);observer.disconnect();controls.dispose();disposeGroup(scene);renderer.dispose();renderer.domElement.remove();}};
}
