import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {existsSync} from 'node:fs';
import * as T from 'three';

// controller.ts imports siblings without extensions, as the Next bundler allows.
registerHooks({resolve(specifier,context,next){
 if(specifier.startsWith('.')&&context.parentURL&&!/\.[a-z]+$/i.test(specifier))for(const extension of ['.ts','.tsx']){const url=new URL(specifier+extension,context.parentURL);if(existsSync(url))return next(url.href,context);}
 return next(specifier,context);
}});
// The prop library draws sign canvases and requests atlases; neither needs a GPU here.
const canvasContext=new Proxy({measureText:()=>({width:100}),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})},{get:(target,key)=>target[key]??(()=>{})});
globalThis.document??={createElement:()=>({width:512,height:512,getContext:()=>canvasContext})};
T.TextureLoader.prototype.load=function(){return new T.Texture();};
const frames=[];
globalThis.requestAnimationFrame=callback=>frames.push(callback);
globalThis.cancelAnimationFrame=handle=>{frames[handle-1]=null;};
let clock=0;
const drain=()=>{for(let i=0;i<20&&frames.some(Boolean);i++){clock+=100;const pending=frames.splice(0);for(const callback of pending)callback?.(clock);}};
const {createWorldEditor}=await import('../components/world-editor/controller.ts');

test('selecting and cancelling never republish unchanged pads; a real move publishes once',()=>{
 const scene=new T.Scene(),object=new T.Mesh(new T.BoxGeometry(2,2,2),new T.MeshBasicMaterial());
 object.position.set(5,0,5);scene.add(object);
 const calls={pads:0,colliders:0,authored:0};
 const editor=createWorldEditor(scene,()=>{},{map:'expedition',anisotropy:1,height:()=>0,
  authored:[{id:'authored:0',name:'box',object,collision:{w:2,d:2,h:2}}],
  onPads:()=>calls.pads++,onColliders:()=>calls.colliders++,onAuthoredColliders:()=>calls.authored++});
 drain();
 const settled={...calls};
 assert.equal(settled.authored,1,'the first refresh publishes the authored footprint');
 editor.setActive(true);drain();
 editor.select('authored:0');editor.cancel();editor.select('authored:0');drain();
 assert.deepEqual(calls,settled,'selection must not rebuild terrain, grass or navigation');
 editor.change({x:9});drain();
 assert.equal(calls.authored,settled.authored+1);
 editor.undo();drain();
 assert.equal(calls.authored,settled.authored+2);
 editor.dispose();object.geometry.dispose();object.material.dispose();
});
