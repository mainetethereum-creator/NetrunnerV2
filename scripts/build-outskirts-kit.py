"""Approved corner/tower quartet and modular outskirts. Blender, four threads.

Only private scenes are authored. Reuses existing material/geometry helpers;
exports grounded, material-batched GLBs and editable .blend sources.
Run blender --background --factory-startup --threads 4 --python this-file.
Pass slugs and/or --no-render after -- to rebuild selected models.
"""
from pathlib import Path
import importlib.util
import json
import math
import random
import struct
import sys
import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
REFERENCES = ROOT/'output/imagegen/building-references-2026-09-19'

def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result

trio = module('outskirts_helpers', ROOT/'scripts/build-city-trio.py')
C, S, SERVICE, RED, GLASS, AMBER, WARM, ROOF, ART, NEON = range(10)
BRICK, EARTH, ASPHALT, RUST, RUBBER, WATER, PAINT = range(10, 17)

def add_material(mats, specs, name, color, roughness, metal=0, image=None):
    spec = (name, (*color, 1), roughness, metal, 0)
    mat = bpy.data.materials.new('CBOK1_'+name)
    mat.use_nodes = True
    p = mat.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = spec[1]
    p.inputs['Roughness'].default_value = roughness
    p.inputs['Metallic'].default_value = metal
    if image:
        tex = mat.node_tree.nodes.new('ShaderNodeTexImage'); tex.image = image
        tint = mat.node_tree.nodes.new('ShaderNodeMixRGB'); tint.blend_type = 'MULTIPLY'
        tint.inputs[0].default_value = 1; tint.inputs[2].default_value = spec[1]
        mat.node_tree.links.new(tex.outputs['Color'], tint.inputs[1])
        mat.node_tree.links.new(tint.outputs[0], p.inputs['Base Color'])
    mats.append(mat); specs.append(spec)

def asphalt_surface(out):
    """Portable authored asphalt: aggregate and branching cracks, no tile joints."""
    n=1024;rng=np.random.default_rng(190919)
    yy,xx=np.mgrid[0:n,0:n]
    tone=np.clip(.65+rng.normal(0,.065,(n,n)),.25,.95)
    # Coarse mottling and worn patches; the texture spans twelve metres.
    for _ in range(60):
        x,y=rng.uniform(0,n,2);r=rng.uniform(14,120)
        tone+=np.exp(-((xx-x)**2+(yy-y)**2)/(r*r))*rng.uniform(-.12,.1)
    for _ in range(12):
        px,py=rng.uniform(0,n,2);angle=rng.uniform(0,math.tau)
        for _ in range(14):
            angle+=rng.uniform(-.75,.75)
            qx=px+math.cos(angle)*rng.uniform(12,35);qy=py+math.sin(angle)*rng.uniform(12,35)
            vx,vy=qx-px,qy-py
            t=np.clip(((xx-px)*vx+(yy-py)*vy)/max(vx*vx+vy*vy,1),0,1)
            distance=np.hypot(xx-(px+t*vx),yy-(py+t*vy))
            tone-=np.maximum(0,1-distance/rng.uniform(1.1,2.3))*.5
            px,py=qx,qy
    rgba=np.ones((n,n,4),np.float32);rgba[:,:,:3]=np.clip(tone,.09,1)[:,:,None]
    image=bpy.data.images.new('CBOK1_AsphaltAggregate',width=n,height=n,alpha=True)
    image.pixels.foreach_set(rgba.ravel());image.filepath_raw=str(out/'asphalt-surface.png')
    image.file_format='PNG';image.save();image.pack()
    return image

def prism(b, points, bottom, top, mat):
    b.face([(x,y,bottom) for x,y in reversed(points)], mat)
    b.face([(x,y,top) for x,y in points], mat)
    for a,c in zip(points, points[1:]+points[:1]):
        b.face([(*a,bottom),(*c,bottom),(*c,top),(*a,top)], mat)

def facade(b, a, c, z0, z1, quad, size, divisions=3):
    dx,dy=c[0]-a[0],c[1]-a[1]; length=math.hypot(dx,dy)
    nx,ny=dy/length,-dx/length
    a=(a[0]+nx*.035,a[1]+ny*.035);c=(c[0]+nx*.035,c[1]+ny*.035)
    trio.artwork(b,a,c,z0,z1,quad,size,nx=max(2,divisions*2),nz=2)
    for z in [z0,z1]: b.tube((*a,z),(*c,z),.065,S,4)
    for i in range(divisions+1):
        x=a[0]+dx*i/divisions+nx*.035;y=a[1]+dy*i/divisions+ny*.035
        b.tube((x,y,z0),(x,y,z1),.045,S,4)

def patch_slice(quad,start,end):
    def lerp(a,b,t):return (a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t)
    return [lerp(quad[0],quad[1],start),lerp(quad[0],quad[1],end),
            lerp(quad[3],quad[2],end),lerp(quad[3],quad[2],start)]

def corner(m,size,rounded=False):
    b=m.Builder('CBOK1_RoundedCorner' if rounded else 'CBOK1_ChamferCorner')
    w,d,h=9.4,7.2,10.5
    r=1.65
    arc=[(w/2-r+r*math.cos(t),-d/2+r+r*math.sin(t))
         for t in [(-math.pi/2+i*math.pi/10) for i in range(6)]] if rounded else [(w/2-r,-d/2),(w/2,-d/2+r)]
    poly=[(-w/2,-d/2)]+arc+[(w/2,d/2),(-w/2,d/2)]
    prism(b,poly,0,h,BRICK if rounded else C)
    prism(b,poly,h,h+.24,C)
    b.box(0,0,.09,w+.4,d+.4,.18,C)
    # Source patches are individual windows/interiors, never a photo billboard.
    q=[(239,292),(476,306),(476,420),(239,399)] if rounded else [(198,279),(414,320),(414,420),(198,365)]
    shop=[(177,817),(453,868),(453,1024),(177,954)] if rounded else [(144,693),(338,764),(338,939),(144,842)]
    for z0,z1 in [(3.85,5.92),(7.03,9.13)]:
        facade(b,(-4.3,-d/2),(2.7,-d/2),z0,z1,q,size,4)
        facade(b,(w/2,-1.65),(w/2,3.15),z0,z1,q,size,3)
        facade(b,(4.2,d/2),(-4.2,d/2),z0,z1,q,size,4)
        facade(b,(-w/2,3.2),(-w/2,-3.2),z0,z1,q,size,3)
        for i,(a,c) in enumerate(zip(arc,arc[1:])):
            facade(b,a,c,z0,z1,patch_slice(q,i/(len(arc)-1),(i+1)/(len(arc)-1)),size,1)
    for z in [3.25,6.45,9.85]:
        for a,c in zip(poly,poly[1:]+poly[:1]): b.tube((*a,z),(*c,z),.12,C,4)
    facade(b,(-4.2,-d/2),(2.75,-d/2),.3,2.95,shop,size,4)
    facade(b,(w/2,-1.7),(w/2,3.1),.3,2.95,shop,size,3)
    for i,(a,c) in enumerate(zip(arc,arc[1:])):
        facade(b,a,c,.24,2.95,patch_slice(shop,i/(len(arc)-1),(i+1)/(len(arc)-1)),size,1)
    for a,c in zip(poly[:len(arc)+2],poly[1:len(arc)+3]):
        b.tube((*a,3.16),(*c,3.16),.3,ROOF,4)
        if rounded:b.tube((*a,3.08),(*c,3.08),.026,NEON,4)
    b.front(2.55,-3.96,7.95,.46,2.05,S)
    b.frame(2.55,-4.015,7.95,.4,1.99,NEON,.024,.025)
    b.tube((2.55,-4.05,7.18),(2.55,-4.05,8.7),.018,NEON,4)
    trio.roof_plant(b,w,d,h);trio.service_details(b,w,d,h)
    for a,c in zip(poly,poly[1:]+poly[:1]):
        b.tube((*a,h+.53),(*c,h+.53),.025,S,5)
        b.tube((*a,h+.2),(*a,h+.53),.025,S,5)
    if rounded:
        # Real external staircase and landings, not printed into the facade.
        for level in [3.45,6.6,9.7]:
            b.box(w/2+.65,1.55,level,1.25,2.05,.1,S)
            for yy in [.5,2.6]:b.tube((w/2+.65,yy,level),(w/2+.65,yy,level+1),.026,S,5)
            b.tube((w/2+1.23,.5,level+1),(w/2+1.23,2.6,level+1),.025,S,5)
            for i in range(13):b.box(w/2+.65,-1.65+i*.17,level-2.95+i*.225,1.1,.21,.07,S)
        # Brick courses are quiet geometric mortar seams on the two solid edges.
        for z in [3.4+i*.24 for i in range(29)]:
            b.box(-4.5,-3.605,z,.38,.012,.014,S)
    else:
        for x in [-3.8,-.4]:b.ac(x,-3.86,6.8)
    return b

def tower(m,size,terraces=False):
    b=m.Builder('CBOK1_TerraceTower' if terraces else 'CBOK1_GlassTower')
    w,d,h=6.2,7.2,31.8 if terraces else 35.8
    # Pale facade intentionally does not opt into the dark-concrete replacement.
    trio.shell(b,w,d,h)
    q=[(411,652),(493,683),(493,742),(411,715)] if terraces else [(398,585),(510,614),(510,678),(398,648)]
    shop=[(371,1259),(451,1290),(451,1370),(371,1324)] if terraces else [(384,1153),(503,1186),(503,1309),(384,1250)]
    levels=10 if terraces else 12
    step=(h-3.8)/levels
    for i in range(levels):
        z0=3.75+i*step;z1=z0+step-.4
        facade(b,(-2.75,-3.63),(2.75,-3.63),z0,z1,q,size,3)
        facade(b,(3.13,-3.1),(3.13,3.1),z0,z1,q,size,3)
        facade(b,(2.75,3.63),(-2.75,3.63),z0,z1,q,size,3)
        facade(b,(-3.13,3.1),(-3.13,-3.1),z0,z1,q,size,3)
        b.box(0,-3.72,z0-.16,w,.22,.24,C if terraces else S)
        if terraces and i in [2,5,8]:
            b.box(-1.64,-4.05,z0-.05,2.3,1.2,.18,C)
            for x in [-2.7,-.6]:b.tube((x,-4.58,z0),(x,-4.58,z0+.92),.03,S,5)
            b.tube((-2.7,-4.58,z0+.92),(-.6,-4.58,z0+.92),.035,S,5)
            b.box(-1.7,-4.28,z0+.18,1.4,.4,.35,SERVICE)
            for j in range(7):
                b.tube((-2.22+j*.17,-4.28,z0+.3),(-2.2+j*.17,-4.28,z0+.67+.1*(j%3)),.06,SERVICE,5,r2=.015)
    for x in [-3,3]+([-.3] if terraces else [-1,1]):
        b.box(x,-3.78,h/2,w*.07 if terraces else .07,.3 if terraces else .09,h,C if terraces else S)
    facade(b,(-2.5,-3.64),(2.5,-3.64),.22,3.18,shop,size,3)
    b.box(0,-4,3.35,3.5,1,.14,ROOF)
    b.box(0,-4.51,3.37,3.4,.035,.04,NEON)
    if not terraces: b.box(-3.13,-3.81,18,.035,.035,34.5,NEON)
    else:
        b.box(0,.6,h+.7,4.1,4.5,1.4,C)
        b.box(0,-1.72,h+.25,4.2,.035,.04,NEON)
    trio.roof_plant(b,w,d,h+(1.4 if terraces else 0))
    trio.service_details(b,w,d,h)
    return b

def wreck(m,size):
    b=m.Builder('CBOK1_WreckSedan')
    b.box(0,0,.62,1.86,4.3,.5,RUST,bevel=.12)
    b.box(0,-1.52,.99,1.75,1.25,.24,RUST,bevel=.09)
    # Tapered passenger cell, dark openings, missing passenger door.
    bottom=[(-.84,-.88),(.84,-.88),(.84,1.24),(-.84,1.24)]
    top=[(-.66,-.43),(.66,-.43),(.66,.85),(-.66,.85)]
    for i in range(4):
        j=(i+1)%4;b.face([(*bottom[i],.86),(*bottom[j],.86),(*top[j],1.58),(*top[i],1.58)],RUBBER)
        b.tube((*bottom[i],.87),(*top[i],1.58),.055,RUST,5)
    b.face([(*p,1.61) for p in top],RUST)
    for side in [-1,1]:
        for y in [-1.28,1.36]:
            b.tube((side*.79,y,.39),(side*1.03,y,.39),.34,RUBBER,14)
            b.tube((side*1.035,y,.39),(side*1.05,y,.39),.17,ROOF,10)
        b.tube((side*.86,-.8,.88),(side*.86,1.2,.88),.05,RUST,5)
        b.tube((side*.75,.35,.95),(side*.67,.35,1.56),.045,RUST,5)
    for y in [-2.18,2.18]:b.box(0,y,.53,1.93,.13,.18,ROOF)
    for x in [-.66,.66]:b.box(x,-2.173,.86,.34,.024,.19,GLASS)
    for i in range(13):b.box(-.5+i*.083,-2.244,.62,.024,.028,.17,S)
    rng=random.Random(912)
    for _ in range(38):
        front=rng.choice([True,False])
        b.box(rng.uniform(-.8,.8),(-1.55 if front else 1.7)+rng.uniform(-.27,.27),
              1.115 if front else .873,rng.uniform(.025,.18),rng.uniform(.05,.24),.006,S)
    return b

def prop_review(scene,out,metrics):
    """Frame shallow/long props by their entire bounds, with an elevated camera."""
    w,d,h=metrics['width'],metrics['depth'],metrics['height']
    target=Vector((0,0,h*.4));extent=max(w,d,h)
    cam_data=bpy.data.cameras.new('KitReview');cam=bpy.data.objects.new('KitReview',cam_data)
    scene.collection.objects.link(cam);scene.camera=cam
    cam.location=(extent*.85,-extent*1.15,extent*1.05)
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    cam_data.type='ORTHO';cam_data.ortho_scale=extent*1.45
    for pos,color in [((-extent,-extent,extent*1.5),(.8,.88,1)),((extent,0,extent),(1,.8,.59))]:
        data=bpy.data.lights.new('KitArea','AREA');data.energy=extent*extent*90;data.color=color;data.size=extent
        obj=bpy.data.objects.new('KitArea',data);scene.collection.objects.link(obj);obj.location=pos
        obj.rotation_euler=(target-obj.location).to_track_quat('-Z','Y').to_euler()
    scene.render.engine='CYCLES';scene.cycles.samples=20;scene.cycles.use_denoising=True
    scene.render.threads_mode='FIXED';scene.render.threads=4
    scene.render.resolution_x=1100;scene.render.resolution_y=900;scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX';scene.render.filepath=str(out/'blender-review.png')
    bpy.ops.render.render(write_still=True)

def barrier(m,size):
    b=m.Builder('CBOK1_BrokenJersey')
    # Tapered road block with broken end, rusty exposed reinforcement.
    profile=[(-.38,0),(.38,0),(.23,.43),(.12,1.08),(-.12,1.08),(-.23,.43)]
    for x,reverse in [(-1.5,True),(1.22,False)]:
        b.face([(x,y,z) for y,z in (list(reversed(profile)) if reverse else profile)],C)
    for i,a in enumerate(profile):
        c=profile[(i+1)%len(profile)]
        b.face([(-1.5,*a),(-1.5,*c),(1.22,*c),(1.22,*a)],C)
    for x in [-1.3,-.7,-.1,.5]:b.box(x,-.26,.55,.24,.03,.45,RED)
    for z in [.27,.7]:b.tube((.95,0,z),(1.63,.12,z+.13),.025,RUST,6)
    return b

def ground(m,size):
    b=m.Builder('CBOK1_OutskirtsGround');rng=random.Random(190926)
    # 64 x 26 m dressing module. Origin centred; -Y is toward the camera.
    b.box(0,0,-.21,64,26,.42,EARTH)
    # Continuous road with ragged shoulders; no paving-block pattern.
    rows=[(-13+i,7.1+rng.uniform(-.6,.6),7.1+rng.uniform(-.6,.6)) for i in range(27)]
    for a,c in zip(rows,rows[1:]):
        points=[(-a[1],a[0],.045),(a[2],a[0],.045),(c[2],c[0],.045),(-c[1],c[0],.045)]
        b.face(points,ASPHALT,[(p[0]/12,p[1]/12) for p in points])
    # Potholes expose earth and loose aggregate inside the asphalt surface.
    for _ in range(24):
        x=rng.uniform(-7,7);y=rng.uniform(-12.7,12.7);r=rng.uniform(.12,.7)
        pts=[(x+math.cos(i*math.tau/7)*r*rng.uniform(.7,1.2),y+math.sin(i*math.tau/7)*r,.048) for i in range(7)]
        b.face(pts,EARTH)
    # Worn centre line fragments lead away from the city.
    for y in [-11,-7,-3,1,5,9]:
        for i in range(5):b.box(.1+(i%2)*.025,y+i*.18,.063,.13,.12,.008,PAINT)
    for _ in range(440):
        x=rng.uniform(-31.7,31.7);y=rng.uniform(-12.7,12.7)
        if abs(x)<5 and rng.random()<.85:continue
        r=rng.uniform(.04,.24)
        pts=[(x+math.cos(t)*r,y+math.sin(t)*r) for t in [0,1.3,2.6,4,5.2]]
        prism(b,pts,-.015,rng.uniform(.035,.14),C if rng.random()<.35 else RUST if rng.random()<.1 else EARTH)
    for _ in range(28):
        x=rng.uniform(-25,25);y=rng.uniform(-12,12);r=rng.uniform(.3,1.2)
        b.face([(x+math.cos(i*math.tau/9)*r,y+math.sin(i*math.tau/9)*r*.45,.068) for i in range(9)],WATER)
    for _ in range(95):
        x=rng.uniform(-30,30);y=rng.uniform(-12,12)
        if abs(x)<8:continue
        for k in range(3):
            b.face([(x-.07,y,.05),(x+.07,y,.05),(x+.08*math.sin(k*3),y+.12*math.cos(k*3),rng.uniform(.18,.4))],SERVICE)
    return b

CONFIGS=[
 ('corner-chamfer','corner-01-chamfered-concrete.png',lambda m,s:corner(m,s)),
 ('corner-rounded','corner-02-rounded-brick.png',lambda m,s:corner(m,s,True)),
 ('slender-glass','tower-01-blue-glass.png',lambda m,s:tower(m,s)),
 ('slender-terrace','tower-02-concrete-terraces.png',lambda m,s:tower(m,s,True)),
 ('outskirts-wreck','outskirts-approved.png',wreck),
 ('outskirts-barrier','outskirts-approved.png',barrier),
 ('outskirts-ground','outskirts-approved.png',ground),
]

def build(slug,filename,create,render=True):
    out=ROOT/'output/building-models'/f'{slug}-v1';out.mkdir(parents=True,exist_ok=True)
    public=ROOT/'public/game/buildings'/f'{slug}-v1';public.mkdir(parents=True,exist_ok=True)
    previous=bpy.context.window.scene
    scene=bpy.data.scenes.new('Outskirts '+slug);bpy.context.window.scene=scene
    try:
        m=module('outskirts_geometry_'+slug,ROOT/'scripts/build-reference-buildings.py')
        mats,specs=trio.materials(out,REFERENCES/filename,'CBOK1_'+slug,slug=='corner-rounded')
        if slug=='outskirts-barrier':
            p=mats[RED].node_tree.nodes.get('Principled BSDF')
            p.inputs['Base Color'].default_value=(.42,.15,.07,1)
            p.inputs['Emission Strength'].default_value=0
        surface=next(n.image for n in mats[S].node_tree.nodes if n.type=='TEX_IMAGE')
        source=next(n.image for n in mats[ART].node_tree.nodes if n.type=='TEX_IMAGE')
        for args in [('Brick',(.34,.19,.12),.9),('Earth',(.17,.125,.085),.97),
                     ('Asphalt',(.07,.075,.077),.73),('Rust',(.31,.12,.047),.9),
                     ('Rubber',(.016,.019,.018),.97),('Water',(.025,.045,.052),.12),
                     ('RoadPaint',(.58,.47,.24),.82)]:
            texture=asphalt_surface(out) if slug=='outskirts-ground' and args[0]=='Asphalt' else surface
            add_material(mats,specs,*args,image=None if args[0]=='Water' else texture)
        if slug=='slender-terrace':
            mats[C].name='CBOK1_PaleConcrete'
            specs[C]=('PaleConcrete',(.72,.69,.63,1),.88,0,0)
            tint=next(n for n in mats[C].node_tree.nodes if n.type=='MIX_RGB')
            tint.inputs[2].default_value=specs[C][1]
        m.SPECS=specs
        coll=bpy.data.collections.new(slug);scene.collection.children.link(coll)
        root=create(m,tuple(source.size)).finish(coll,mats)
        bpy.context.view_layer.update()
        points=[o.matrix_world@v.co for o in root.children for v in o.data.vertices]
        lo=Vector([min(p[i] for p in points) for i in range(3)])
        hi=Vector([max(p[i] for p in points) for i in range(3)])
        shift=Vector((-(hi.x+lo.x)/2,-(hi.y+lo.y)/2,-lo.z))
        # Ground module top remains at 0; it is placed at the city pavement height.
        if slug=='outskirts-ground':shift.z=0
        bpy.ops.object.select_all(action='DESELECT')
        for obj in root.children:
            for v in obj.data.vertices:v.co+=shift
            obj.data.update();obj.select_set(True)
        root.select_set(True);bpy.context.view_layer.objects.active=root
        path=public/f'{slug}.glb'
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,
            use_active_scene=True,export_apply=True,export_animations=False,
            export_cameras=False,export_lights=False,export_yup=True)
        raw=path.read_bytes();length=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+length])
        for mat in doc['materials']:
            index=next(i for i,item in enumerate(mats) if item.name==mat['name'])
            if 'baseColorTexture' in mat.get('pbrMetallicRoughness',{}):
                mat['pbrMetallicRoughness']['baseColorFactor']=list(specs[index][1])
        encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
        tail=raw[20+length:]
        path.write_bytes(struct.pack('<4sII',b'glTF',2,20+len(encoded)+len(tail))+struct.pack('<I4s',len(encoded),b'JSON')+encoded+tail)
        metrics={'triangles':sum(doc['accessors'][p['indices']]['count']//3 for mesh in doc['meshes'] for p in mesh['primitives']),
            'drawCalls':sum(len(mesh['primitives']) for mesh in doc['meshes']),
            'width':round(hi.x-lo.x,4),'depth':round(hi.y-lo.y,4),'height':round(hi.z-lo.z,4),'bytes':path.stat().st_size}
        assert metrics['triangles']<16000 and metrics['drawCalls']<=12,metrics
        (out/'metrics.json').write_text(json.dumps(metrics,indent=2),encoding='utf8')
        scene.world=bpy.data.worlds.new(slug+'World');scene.world.use_nodes=True
        scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.09,.11,.15,1)
        scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
        bpy.data.libraries.write(str(out/f'{slug}.blend'),{scene},fake_user=True,compress=True)
        print(slug,json.dumps(metrics),flush=True)
        if render:
            if slug.startswith('outskirts-'):prop_review(scene,out,metrics)
            else:trio.review(scene,out,'CBOK1_',metrics)
    finally:
        bpy.context.window.scene=previous
        bpy.data.scenes.remove(scene)

if __name__=='__main__':
    args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    selected=[a for a in args if not a.startswith('--')]
    for config in CONFIGS:
        if not selected or config[0] in selected:build(*config,render='--no-render' not in args)
