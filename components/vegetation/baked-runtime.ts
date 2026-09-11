import * as T from 'three';
/** Versioned authored geometry, with the exact float32 vertices used by the preview. */
export async function loadRuntimeTrees(signal:AbortSignal):Promise<T.BufferGeometry[]>{
 const response=await fetch('/vegetation/runtime-trees-v1.bin',{signal});
 if(!response.ok)throw new Error('Baked trees unavailable');
 const buffer=await response.arrayBuffer(),view=new DataView(buffer);let offset=8;
 if(buffer.byteLength<8||view.getUint32(0,true)!==0x31544756||view.getUint32(4,true)!==3)throw new Error('Invalid baked trees');
 const result:T.BufferGeometry[]=[];
 try{for(let tree=0;tree<3;tree++){
  if(offset+8>buffer.byteLength)throw new Error('Truncated baked trees');
  const count=view.getUint32(offset,true),indices=view.getUint32(offset+4,true);offset+=8;
  if(!count||count>100000||!indices||indices>180000||indices%3||offset+count*36+indices*4>buffer.byteLength)throw new Error('Invalid tree budget');
  const geometry=new T.BufferGeometry();result.push(geometry);
  for(const name of ['position','normal','color']){geometry.setAttribute(name,new T.BufferAttribute(new Float32Array(buffer,offset,count*3),3));offset+=count*12;}
  geometry.setIndex(new T.BufferAttribute(new Uint32Array(buffer,offset,indices),1));offset+=indices*4;
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
 }if(offset!==buffer.byteLength)throw new Error('Unexpected baked tree data');return result;
 }catch(error){result.forEach(g=>g.dispose());throw error;}
}
