"""A seamless working Y junction with a fractured disused branch, in Blender.
Uses the project's generated concrete/steel textures. Local +X is the approach,
Blender -Y is the old branch; runtime rotates the whole junction by -35 degrees.
"""
from pathlib import Path
import bpy, math, json, struct, re, random, importlib.util
from mathutils import Vector
from mathutils.geometry import tessellate_polygon

ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'output/rail-ruins';PUBLIC=ROOT/'public/game/rail-ruins/v1'
spec=importlib.util.spec_from_file_location('ruin_helpers',ROOT/'scripts/build-canal-kit.py')
kit=importlib.util.module_from_spec(spec);spec.loader.exec_module(kit)
CONCRETE,STEEL,ASPHALT,ALLOY,RUST,AMBER,RED=range(7)
kit.helper.SPECS=[(n,) for n in ['Concrete','Steel','Asphalt','Alloy','Rust','Amber','Red']]

class Builder(kit.helper.Builder):
    def face(self,points,mat,uv=None):
        if uv is None:
            a,b,c=map(Vector,points[:3]);n=(b-a).cross(c-a);axis=max(range(3),key=lambda i:abs(n[i]));axes=[i for i in range(3) if i!=axis]
            period=3.6 if mat==CONCRETE else 2.5
            uv=[(p[axes[0]]/period,p[axes[1]]/period) for p in points]
        super().face(points,mat,uv)

def pt(x,z,y=0):return (x,-z,y)
def old(s,side=0,h=0):
    a=s/32;return pt((32-side)*math.sin(a),32-(32-side)*math.cos(a),h)

def beam(b,a,c,w,h,mat):
    a=Vector(a);c=Vector(c);side=Vector((-(c-a).y,(c-a).x,0)).normalized()*w/2;up=Vector((0,0,h/2))
    v=[a-side-up,a+side-up,c+side-up,c-side-up,a-side+up,a+side+up,c+side+up,c-side+up]
    for face in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]:b.face([tuple(v[i]) for i in face],mat)

def slab(b,outline):
    vertices=[Vector(p) for p in outline]
    area=sum(a.x*c.y-c.x*a.y for a,c in zip(vertices,vertices[1:]+vertices[:1]))
    if area<0:vertices.reverse()
    triangles=tessellate_polygon([vertices])
    for tri in triangles:b.face([tuple(vertices[i]) for i in tri],ASPHALT)
    for a,c in zip(vertices,vertices[1:]+vertices[:1]):
        b.face([tuple(c),tuple(a),tuple(a-Vector((0,0,1.1))),tuple(c-Vector((0,0,1.1)))],CONCRETE)
    for tri in triangles:b.face([tuple(vertices[i]-Vector((0,0,1.1))) for i in reversed(tri)],CONCRETE)

def junction():
    b=Builder('RailJunction')
    # Union outline, not two intersecting decks: the switch has one solid slab.
    join=32*math.acos((32-2.2)/(32+2.2))
    outline=[pt(0,-2.2),pt(24,-2.2),pt(24,2.2),old(join,-2.2)]
    for i in range(1,9):outline.append(old(join+(20-join)*i/8,-2.2))
    for side,s in [(-1.8,19.6),(-1.2,20.4),(-.6,19.5),(0,20.25),(.5,19.4),(1.1,20.35),(1.6,19.8),(2.2,20)]:outline.append(old(s,side))
    for i in range(1,25):outline.append(old(20*(1-i/24),2.2))
    slab(b,outline)
    # Intact rail level and gauge exactly match the existing 8m Blender deck.
    for side in [-.82,.82]:beam(b,pt(0,side,.145),pt(24,side,.145),.105,.09,ALLOY)
    for i in range(30):
        s=.4+i*.8;beam(b,pt(s,-1.175,.075),pt(s,1.175,.075),.15,.08,ALLOY)
    for side in [-.82,.82]:
        for j in range(24):
            s=5+j*.6;beam(b,old(s,side,.145),old(s+.6,side,.145),.105,.09,RUST)
        # The rail tears free and sags over the broken concrete edge.
        points=[old(19.4,side,.145),old(20.6,side+.08,.12),old(21.5,side+.2,-.45),old(22.1,side+.35,-1.45)]
        for a,c in zip(points,points[1:]):beam(b,a,c,.1,.10,RUST)
    for i in range(17):
        s=6+i*.8;beam(b,old(s,-1.175,.075),old(s,1.175,.075),.15,.08,ALLOY)
    # Narrow outside curbs keep the fork legible; the ruined spur has no neon.
    beam(b,pt(0,-2.07,.17),pt(24,-2.07,.17),.26,.3,STEEL)
    beam(b,pt(0,-2.215,.24),pt(24,-2.215,.24),.025,.035,AMBER)
    beam(b,pt(18,2.07,.17),pt(24,2.07,.17),.26,.3,STEEL)
    for i in range(19):beam(b,old(i,2.07,.17),old(i+1,2.07,.17),.26,.3,STEEL)
    for s in [1,8,15,22]:
        for side in [-2.07,2.07] if s<3 or s>19 else [-2.07]:
            p=pt(s,side,.48);b.box(*p,.16,.2,.56,ALLOY,bevel=.015);b.box(p[0],p[1],.79,.2,.23,.08,AMBER)
    # Impact scars: exposed reinforcement, aggregate and broken edge strata.
    rng=random.Random(772)
    for i in range(18):
        side=-1.9+i*.22;a=old(19.4,side,-.23-(i%3)*.23);c=old(20.7+rng.random(),side+rng.uniform(-.2,.2),-.2-rng.random())
        b.pipe([a,c,(c[0]+.16,c[1]-.08,c[2]-.38)],.024,RUST,6)
    for i in range(23):
        p=old(19.8+rng.uniform(-.4,.1),rng.uniform(-2,2),rng.uniform(-.9,-.08))
        b.box(*p,rng.uniform(.12,.3),rng.uniform(.12,.28),rng.uniform(.08,.22),CONCRETE,bevel=.05)
    # A closed old switch, with a modest red warning pair.
    for side in [-1.6,1.6]:
        p=old(15.5,side,.45);b.box(*p,.12,.12,.85,STEEL);b.box(p[0],p[1],.95,.19,.19,.13,RED,bevel=.03)
    beam(b,old(15.5,-1.7,.72),old(15.5,1.7,.72),.16,.27,RUST)
    return b

def cap():
    b=Builder('RuinedPierCap');rng=random.Random(156)
    for i in range(10):
        x=rng.uniform(-.72,.72);z=rng.uniform(1.8,3.7)
        b.box(*pt(x,z,.10),rng.uniform(.25,.55),rng.uniform(.2,.6),rng.uniform(.13,.35),CONCRETE,bevel=.09)
    for x in [-.55,0,.5]:
        for z in [2,3.5]:b.pipe([pt(x,z,.05),pt(x,z,.45),pt(x+.17,z+.13,.66)],.024,RUST,6)
    # Severed cable stays attached to the cap; no intact wires span the void.
    b.pipe([pt(.8,2.7,.1),pt(1.1,2.8,-.25),pt(1.13,2.9,-1.3),pt(1.03,3,-2.15)],.034,STEEL,6)
    return b

def debris():
    b=Builder('RailCrashDebris');rng=random.Random(326)
    for i in range(18):
        x=rng.uniform(-2.3,2.3);z=rng.uniform(-1.5,1.5);w=rng.uniform(.3,1.2)
        b.box(*pt(x,z,.10),w,w*.58,rng.uniform(.15,.45),CONCRETE,bevel=.12)
    for i in range(4):beam(b,pt(-1.7+i*.3,-.4+i*.45,.25),pt(1.4-i*.2,-.2+i*.4,.25+i*.12),.13,.15,RUST)
    for x in [-.8,.3,1.4]:
        beam(b,pt(x,-1,.3),pt(x+.4,1.1,.37),.28,.2,ALLOY)
    return b

def image(name,normal=False):
    im=bpy.data.images.load(str(ROOT/'output/east-district/textures'/name),check_existing=False)
    if normal:im.colorspace_settings.name='Non-Color'
    im.pack();return im

def build():
    previous=bpy.context.window.scene
    containers=[bpy.data.objects,bpy.data.collections,bpy.data.scenes,bpy.data.meshes,bpy.data.materials,bpy.data.images,bpy.data.curves]
    existing=[set(c) for c in containers]
    scene=bpy.data.scenes.new('Railway / ruined fork');bpy.context.window.scene=scene;scene.render.threads_mode='FIXED';scene.render.threads=4
    try:
        coll=bpy.data.collections.new('RAIL RUINS sources');scene.collection.children.link(coll)
        concrete=(image('Concrete.png'),image('Concrete-normal.png',True));steel=(image('Steel.png'),image('Steel-normal.png',True))
        mats=[kit.material('Concrete',(.58,.62,.64),.88,images=concrete),kit.material('Steel',(.20,.25,.27),.62,.65,images=steel),
          kit.material('Asphalt',(.025,.032,.037),.88,.1,images=steel),kit.material('Alloy',(.32,.38,.39),.66,.64),
          kit.material('Rust',(.28,.09,.035),.92,.35,images=steel),kit.material('Amber',(.6,.8,.78),.5,emission=.6),kit.material('Red',(.85,.035,.012),.5,emission=1.2)]
        for mat in mats:mat.name=mat.name.replace('CANAL_','RailRuin_')
        roots=[];metrics={}
        for i,b in enumerate([junction(),cap(),debris()]):
            root=b.finish(coll,mats);root.location=(i*30,0,0);roots.append(root)
            metrics[b.name]={'triangles':sum(len(p.vertices)-2 for ob in root.children for p in ob.data.polygons),'draws':len(root.children)}
        bpy.context.view_layer.update();bpy.ops.object.select_all(action='DESELECT')
        for root in roots:
            root.select_set(True)
            for ob in root.children:ob.select_set(True)
        PUBLIC.mkdir(parents=True,exist_ok=True);path=PUBLIC/'rail-ruins.glb'
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,use_active_scene=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False,export_yup=True)
        raw=path.read_bytes();length=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+length])
        for key in ['nodes','meshes','materials','images']:
            for item in doc.get(key,[]):
                if 'name' in item:item['name']=re.sub(r'\.\d{3}$','',item['name'])
        encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4);tail=raw[20+length:]
        path.write_bytes(struct.pack('<4sII',b'glTF',2,20+len(encoded)+len(tail))+struct.pack('<I4s',len(encoded),b'JSON')+encoded+tail)
        bpy.data.libraries.write(str(OUT/'rail-ruins.blend'),{scene},fake_user=True,compress=True)
        metrics['bytes']=path.stat().st_size;(OUT/'metrics.json').write_text(json.dumps(metrics,indent=2));return metrics
    finally:
        bpy.context.window.scene=previous
        for container,original in zip(containers,existing):
            for block in list(container):
                if block not in original:container.remove(block,do_unlink=True)

if __name__=='__main__':print(json.dumps(build()),flush=True)
