import * as T from 'three';
/** Local-space attachments follow placed building transforms, including editor moves. */
export function attachGardenSign(root:T.Group, sign:T.MeshStandardMaterial) {
  const bounds=new T.Box3().setFromObject(root),width=bounds.max.x-bounds.min.x;
  const group=new T.Group();group.name='Garden district / neon blade';
  const frame=new T.MeshStandardMaterial({color:0x26353d,roughness:.35,metalness:.8});
  const trim=new T.MeshStandardMaterial({color:0xe969b8,emissive:0xf13baa,emissiveIntensity:2.2,roughness:.3});
  const body=new T.Mesh(new T.BoxGeometry(.92,2.65,.18),frame);body.name='Garden sign / case';group.add(body);
  const face=new T.Mesh(new T.PlaneGeometry(.78,2.48),sign);face.name='Garden sign / print';face.position.z=.095;group.add(face);
  const railGeometry=new T.BoxGeometry(.025,2.53,.028);
  for(const x of [-.445,.445]) {const rail=new T.Mesh(railGeometry,trim);rail.name=`Garden sign / edge ${x}`;rail.position.set(x,0,.11);group.add(rail);}
  group.position.set(bounds.min.x+Math.min(1.1,width*.12),Math.min(8,bounds.max.y*.67),bounds.max.z+.12);
  root.add(group);
}
