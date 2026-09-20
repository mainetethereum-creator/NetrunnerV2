"""Grounded east service district, authored in a temporary Blender scene.
The current user's scene and selection are restored; the deliverable is a separate
editable .blend plus a UV-mapped, material-batched runtime GLB.
"""
from pathlib import Path
import bpy, math, random, json, struct, importlib.util, re
import numpy as np
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/east-district'; PUBLIC=ROOT/'public/game/east-district/v1'
spec=importlib.util.spec_from_file_location('east_helpers',ROOT/'scripts/build-canal-kit.py')
kit=importlib.util.module_from_spec(spec);spec.loader.exec_module(kit)
kit.REF=OUT/'references';kit.TEX=OUT/'textures'
CONCRETE,METAL,EARTH,WINDOW,MOSS,DARK,AMBER,CYAN,PINK,RUST,RUBBER=range(11)
names=['Concrete','Steel','Earth','WorkshopInterior','Moss','Black','Amber','Cyan','Pink','Rust','Rubber']
kit.helper.SPECS=[(n,) for n in names]

class Builder(kit.helper.Builder):
    def face(self,points,mat,uv=None):
        if uv is None:
            a,b,c=map(Vector,points[:3]);n=(b-a).cross(c-a)
            axis=max(range(3),key=lambda i:abs(n[i]));axes=[i for i in range(3) if i!=axis]
            period={CONCRETE:3.6,METAL:2.5,EARTH:4.8,MOSS:3}.get(mat,1)
            uv=[(p[axes[0]]/period,p[axes[1]]/period) for p in points]
        super().face(points,mat,uv)

def vent(b,x,y,z,w=1.1,h=.75):
    b.box(x,y,z,w,.25,h,METAL,bevel=.04)
    for k in range(7):b.box(x,y-.145,z-h*.38+k*h*.126,w*.85,.085,.037,DARK,bevel=.006)

def window(b,x,y,z,w,h):
    b.box(x,y+.08,z,w+.18,.25,h+.18,METAL,bevel=.03)
    b.face([(x-w/2,y-.07,z-h/2),(x+w/2,y-.07,z-h/2),(x+w/2,y-.07,z+h/2),(x-w/2,y-.07,z+h/2)],WINDOW,[(0,0),(1,0),(1,1),(0,1)])
    for a in [-.5,0,.5]:b.box(x+a*w,y-.11,z,.065,.09,h+.07,METAL)
    b.box(x,y-.14,z+h*.15,w,.08,.055,METAL)
    b.box(x,y-.23,z-h*.5,w+.35,.44,.11,CONCRETE,bevel=.025)

def workshop():
    b=Builder('Workshop');b.box(0,0,2.65,8,6,5.3,CONCRETE,bevel=.07)
    for z in [.18,3.6,5.15]:b.box(0,0,z,8.15,6.15,.19,CONCRETE,bevel=.035)
    for x in [-3.83,3.83]:b.box(x,-3.08,2.6,.3,.25,5.15,CONCRETE,bevel=.03)
    window(b,-2.25,-3.10,1.73,2.3,2.65)
    b.box(1.4,-3.1,1.78,3.25,.20,3.15,METAL,bevel=.04)
    for k in range(22):b.box(1.4,-3.24,.29+k*.138,3.05,.12,.085,METAL,bevel=.012)
    b.box(1.4,-3.36,.33,.55,.08,.11,DARK,bevel=.015)
    b.box(0,-3.38,3.5,7.35,.85,.14,METAL,bevel=.035)
    for x in [-2.3,1.5]:window(b,x,-3.13,4.36,2.4,.77)
    b.box(-.12,-3.43,3.17,.62,.15,.14,AMBER)
    # Neon blade with actual depth, small recessed lettering, and power cable.
    b.box(-3.35,-3.55,2.85,.6,.24,2.22,DARK,bevel=.035)
    for x in [-3.64,-3.06]:b.box(x,-3.69,2.85,.025,.028,2.2,PINK)
    b.text('修\n理\n店',-3.57,-3.71,2.08,.40,PINK,height=1.51,chinese=True)
    b.text('REPAIR / 09',-.2,-3.71,3.48,2.1,AMBER,height=.14)
    for x in [-3.92,3.9]:b.pipe([(x,-3.19,.15),(x,-3.19,4.9),(x,-2.2,5.45)],.055,METAL)
    # Parapet, patched roof, vents, trunking, exhaust and condenser grills.
    b.box(0,0,5.35,7.7,5.7,.18,DARK)
    for x in [-3.87,3.87]:b.box(x,0,5.58,.24,6,.65,CONCRETE,bevel=.035)
    for y in [-2.86,2.86]:b.box(0,y,5.58,7.6,.22,.65,CONCRETE,bevel=.035)
    for x,y in [(-2.2,-.8),(1.1,1.2)]:
        b.box(x,y,5.84,1.62,1.35,.92,METAL,bevel=.06);vent(b,x,y-.72,5.84,1.45,.72)
        b.tube((x+.3,y,6.32),(x+.3,y,6.37),.43,DARK,20)
        for i in range(7):b.box(x+.3,y-.36+i*.12,6.395,.77,.03,.025,METAL)
    b.box(.2,-.7,5.6,4.2,.56,.42,METAL,bevel=.045)
    b.tube((2.8,1.9,5.4),(2.8,1.9,7.15),.14,METAL,12)
    b.box(2.8,1.9,7.17,.56,.56,.12,METAL,bevel=.04)
    for x in [-3.84,-3.49]:
        b.tube((x,2.94,.2),(x,2.94,5.7),.036,RUST,8)
    for z in np.arange(.4,5.7,.32):b.tube((-3.84,2.94,z),(-3.49,2.94,z),.026,METAL,8)
    return b

def annex():
    b=Builder('ServiceAnnex');b.box(0,0,1.8,4.8,5.2,3.6,CONCRETE,bevel=.055)
    b.box(0,0,3.7,5.04,5.44,.24,METAL,bevel=.04)
    window(b,-.8,-2.69,1.68,2.38,2.45)
    b.box(1.39,-2.66,1.51,.89,.18,2.85,METAL,bevel=.035)
    window(b,1.39,-2.8,1.85,.55,1.1)
    b.box(0,-3.02,3.05,4.5,1,.16,METAL,bevel=.03)
    b.box(-.8,-3.04,3.02,2.5,.09,.035,AMBER)
    b.box(-2.05,-2.86,2.35,.49,.18,1.72,DARK,bevel=.02)
    b.text('部\n品',-2.23,-2.97,1.82,.36,PINK,height=1.0,chinese=True)
    b.box(.7,.3,4.13,1.4,1.4,.75,METAL,bevel=.05);vent(b,.7,-.45,4.13,1.2,.6)
    for x in [-2.2,2.2]:b.pipe([(x,-2.73,.1),(x,-2.73,3.8),(x,-1.4,3.8)],.052,METAL)
    for i in range(3):b.box(-1.3+i*.34,1.2,3.98,.28,2.3,.42,METAL,bevel=.015)
    return b

def fence():
    b=Builder('EastFence')
    b.box(0,0,.54,4,.5,1.08,CONCRETE,bevel=.045)
    for x in [-1.94,1.94]:
        b.box(x,0,1.18,.19,.25,2.36,METAL,bevel=.02)
        b.box(x,0,2.38,.27,.32,.10,METAL,bevel=.025)
    for z in [1.15,2.16]:b.box(0,0,z,4,.07,.065,METAL)
    for x in np.arange(-1.68,1.75,.28):b.box(x,0,1.7,.04,.055,1.18,METAL,bevel=.007)
    b.box(0,0,1.1,4.06,.64,.12,CONCRETE,bevel=.03)
    return b

def breach():
    b=Builder('ExpeditionBreach');rng=random.Random(713)
    for side in [-1,1]:
        # Jagged masonry wedges retain the former wall line without closing the gap.
        xs=[side*1.85,side*2.45,side*3.15,side*4]
        for j in range(3):
            x=(xs[j]+xs[j+1])/2;w=abs(xs[j+1]-xs[j]);h=.3+j*.34
            b.box(x,0,h*.5,w,.61,h,CONCRETE,bevel=.09)
            b.pipe([(x,-.1,h),(x,-.1,h+.6),(x-side*.25,-.06,h+.75)],.022,RUST)
        b.box(side*3.92,0,1.05,.23,.3,2.1,METAL,bevel=.02)
        for z in [1.13,2.12]:b.pipe([(side*4,0,z),(side*2.75,0,z-.1),(side*2.05,.2,z-.55)],.036,METAL)
        for x in [2.5,2.85,3.2,3.55]:b.pipe([(side*x,0,.85),(side*(x-.08),0,1.4),(side*(x-.25),.15,1.95)],.024,METAL)
        for i in range(14):
            x=side*rng.uniform(1.5,3.9);y=rng.uniform(-1.0,1.1)
            b.box(x,y,.08+rng.random()*.08,rng.uniform(.15,.5),rng.uniform(.15,.5),rng.uniform(.12,.27),CONCRETE,bevel=.07)
    # Sign faces the refuge: the destination is an interaction at the fence.
    b.box(0,0,2.63,3.45,.19,.62,DARK,bevel=.045)
    b.text('OUTLANDS',-1.42,-.111,2.48,2.85,AMBER,height=.31)
    b.text('EXPEDITION ACCESS',-1.1,-.113,2.32,2.2,AMBER,height=.11)
    for x in [-1.76,1.76]:b.box(x,0,1.4,.085,.085,2.8,METAL)
    return b

def barrel():
    b=Builder('BurnBarrel')
    # Open, rolled rim and interior; no lid hiding the flames.
    for j in range(32):
        a=j*math.tau/32;c=(j+1)*math.tau/32
        for r,z0,z1,mat in [(.39,.08,1.13,RUST),(.36,.5,1.13,DARK)]:
            p=[(r*math.cos(a),r*math.sin(a),z0),(r*math.cos(c),r*math.sin(c),z0),(r*math.cos(c),r*math.sin(c),z1),(r*math.cos(a),r*math.sin(a),z1)]
            b.face(p if r==.39 else list(reversed(p)),mat)
    for z in [.08,.37,.83,1.12]:
        for j in range(32):
            a=j*math.tau/32;c=(j+1)*math.tau/32
            b.tube((.391*math.cos(a),.391*math.sin(a),z),(.391*math.cos(c),.391*math.sin(c),z),.025,METAL,6)
    b.tube((0,0,.74),(0,0,.78),.34,AMBER,20)
    return b

def tires():
    b=Builder('TirePile')
    profile=[(.22,-.15),(.32,-.17),(.43,-.13),(.46,-.07),(.46,.07),(.43,.13),(.32,.17),(.22,.15)]
    for tire,(x,y,z,tilt) in enumerate([(0,0,.22,0),(.04,-.02,.57,.07),(-.6,.2,.37,.8)]):
        def pt(r,a,h):
            qy=r*math.sin(a);return (x+r*math.cos(a),y+qy*math.cos(tilt)-h*math.sin(tilt),z+qy*math.sin(tilt)+h*math.cos(tilt))
        for j in range(36):
            a=j*math.tau/36;c=(j+1)*math.tau/36
            for k in range(len(profile)):
                r,h=profile[k];rr,hh=profile[(k+1)%len(profile)]
                b.face([pt(r,a,h),pt(r,c,h),pt(rr,c,hh),pt(rr,a,hh)],RUBBER)
            for h in [-.065,.065]:b.tube(pt(.46,a,h),pt(.46,a+.09,h+.03),.013,DARK,5)
    return b

def terrain():
    b=Builder('EastGround')
    def pt(x,z):return (x,-z,-.14-max(0,x-64)*.04+math.sin(x*.57)*math.cos(z*.39)*.08)
    # A continuous earth shoulder supports the outer railway all the way to the
    # far bank. The existing canal remains open west of x=48.7.
    for x0,x1,z0,z1 in [(30,48.7,-44,34.1),(48.7,98,-44,90)]:
        nx=math.ceil((x1-x0)/2);nz=math.ceil((z1-z0)/2)
        for i in range(nx):
            for j in range(nz):
                x=x0+(x1-x0)*i/nx;xx=x0+(x1-x0)*(i+1)/nx
                z=z0+(z1-z0)*j/nz;zz=z0+(z1-z0)*(j+1)/nz
                b.face([pt(x,z),pt(x,zz),pt(xx,zz),pt(xx,z)],EARTH)
    return b

def rocks():
    b=Builder('EastRubble');rng=random.Random(485)
    for i in range(12):
        x=rng.uniform(-1.4,1.4);y=rng.uniform(-.7,.7);w=rng.uniform(.16,.6);h=w*.6
        b.box(x,y,h*.35,w,w*.7,h,CONCRETE,bevel=w*.2)
    return b

def planter():
    b=Builder('EastPlanter');b.box(0,0,.07,1,1,.15,MOSS)
    for x in [-.49,.49]:b.box(x,0,.1,.02,1,.22,CONCRETE,bevel=.006)
    for y in [-.49,.49]:b.box(0,y,.1,1,.02,.22,CONCRETE,bevel=.006)
    return b

def build():
    previous=bpy.context.window.scene
    containers=[bpy.data.objects,bpy.data.collections,bpy.data.scenes,bpy.data.meshes,bpy.data.materials,bpy.data.images,bpy.data.curves]
    existing=[set(c) for c in containers]
    scene=bpy.data.scenes.new('East district / grounded railway');bpy.context.window.scene=scene
    scene.render.threads_mode='FIXED';scene.render.threads=4
    try:
        coll=bpy.data.collections.new('EAST game-ready kit');scene.collection.children.link(coll)
        moss=bpy.data.images.load(str(ROOT/'output/sakura-park/textures/Moss.png'),check_existing=False);moss.pack()
        concrete=kit.crop('Concrete',0,0);steel=kit.crop('Steel',1,0);earth=kit.crop('Earth',0,1);interior=kit.crop('WorkshopInterior',1,1)
        mats=[kit.material('Concrete',(.62,.66,.68),.83,images=concrete),kit.material('Steel',(.35,.4,.42),.53,.65,images=steel),
          kit.material('Earth',(.6,.62,.48),.94,images=earth),kit.material('WorkshopInterior',(1,.8,.52),.56,emission=.52,images=(interior[0],None)),
          kit.material('Moss',(.25,.35,.19),.95,images=(moss,None)),kit.material('Black',(.015,.023,.028),.7,.3),
          kit.material('Amber',(1,.48,.13),.5,emission=1.5),kit.material('Cyan',(.12,.72,.9),.5,emission=1.5),
          kit.material('Pink',(.78,.12,1),.5,emission=2),kit.material('Rust',(.32,.1,.035),.83,.4,images=steel),kit.material('Rubber',(.025,.028,.027),.98)]
        for mat in mats:mat.name=mat.name.replace('CANAL_','EAST_')
        builders=[workshop(),annex(),fence(),breach(),barrel(),tires(),terrain(),rocks(),planter()]
        roots=[];metrics={}
        for i,b in enumerate(builders):
            root=b.finish(coll,mats);root.location=(i*20,0,0);roots.append(root)
            metrics[b.name]={'triangles':sum(len(p.vertices)-2 for ob in root.children for p in ob.data.polygons),'draws':len(root.children)}
        bpy.context.view_layer.update();bpy.ops.object.select_all(action='DESELECT')
        for root in roots:
            root.select_set(True)
            for ob in root.children:ob.select_set(True)
        PUBLIC.mkdir(parents=True,exist_ok=True);path=PUBLIC/'east-district.glb'
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,use_active_scene=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False,export_yup=True)
        raw=path.read_bytes();length=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+length])
        for key in ['nodes','meshes','materials','images']:
            for item in doc.get(key,[]):
                if 'name' in item:item['name']=re.sub(r'\.\d{3}$','',item['name'])
        for mat in doc['materials']:
            if mat['name'] in ['EAST_Pink','EAST_Amber']:mat['doubleSided']=True
        encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4);tail=raw[20+length:]
        path.write_bytes(struct.pack('<4sII',b'glTF',2,20+len(encoded)+len(tail))+struct.pack('<I4s',len(encoded),b'JSON')+encoded+tail)
        bpy.data.libraries.write(str(OUT/'east-district.blend'),{scene},fake_user=True,compress=True)
        metrics['bytes']=path.stat().st_size;(OUT/'metrics.json').write_text(json.dumps(metrics,indent=2));return metrics
    finally:
        bpy.context.window.scene=previous
        for container,original in zip(containers,existing):
            for block in list(container):
                if block not in original:container.remove(block,do_unlink=True)

if __name__=='__main__':print(json.dumps(build()),flush=True)
