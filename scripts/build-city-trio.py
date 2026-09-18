"""Three approved CyberBase concepts; Blender 5.2, one four-thread process.

Closed low-poly shells, metric concrete, original concept patches on framed
windows/signage. No render lights/cameras exported. Sources saved per building.
Run --background --factory-startup --threads 4 --python scripts/build-city-trio.py.
Optional arguments after --: a single model slug, --no-render.
"""
from pathlib import Path
import importlib.util
import hashlib
import json
import math
import struct
import sys
import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
CONCEPTS = ROOT/'output/building-concepts/2026-09-18-cyberbase-parts-office-v1'
CONCRETE, STEEL, SERVICE, RED, GLASS, AMBER, WARM, ROOF, ART, NEON = range(10)
MODELS = [
    ('cyberbase-tower','01-cyberbase-tower.png','CBCT1_',28.0),
    ('japanese-parts-shop','02-japanese-parts-shop.png','CBPS1_',10.7),
    ('urban-office','03-urban-office.png','CBOF1_',11.0),
]


def module(name, path):
    spec=importlib.util.spec_from_file_location(name,path)
    result=importlib.util.module_from_spec(spec);spec.loader.exec_module(result)
    return result


def artwork(b, a, c, z0, z1, quad, size, mat=ART, nx=4, nz=4):
    """Rectify an individual detail using the exact concept, not a whole facade."""
    source=[(x/size[0],1-y/size[1]) for x,y in (quad[3],quad[2],quad[1],quad[0])]
    rows,values=[],[]
    for (u,v),(s,t) in zip([(0,0),(1,0),(1,1),(0,1)],source):
        rows.extend([[u,v,1,0,0,0,-s*u,-s*v],[0,0,0,u,v,1,-t*u,-t*v]])
        values.extend([s,t])
    hom=np.append(np.linalg.solve(np.array(rows),np.array(values)),1).reshape(3,3)
    for j in range(nz):
        for i in range(nx):
            coords=[(i/nx,j/nz),((i+1)/nx,j/nz),((i+1)/nx,(j+1)/nz),(i/nx,(j+1)/nz)]
            uv=[]
            for u,v in coords:
                p=hom@np.array([u,v,1]);uv.append(tuple(p[:2]/p[2]))
            b.face([(a[0]+(c[0]-a[0])*u,a[1]+(c[1]-a[1])*u,z0+(z1-z0)*v)
                for u,v in coords],mat,uv)


def front_art(b,x,y,z,w,h,quad,size,nx=4,nz=4):
    artwork(b,(x-w/2,y),(x+w/2,y),z-h/2,z+h/2,quad,size,nx=nx,nz=nz)


def materials(out, source, prefix, violet):
    base=module('trio_materials',ROOT/'scripts/build-media-tower.py')
    base.OUT,base.SOURCE,base.PREFIX=out,source,prefix
    mats,specs=base.materials()
    mats[CONCRETE].name='CBR1_Concrete_'+prefix
    p=mats[ART].node_tree.nodes.get('Principled BSDF')
    p.inputs['Emission Strength'].default_value=.42
    p.inputs['Metallic'].default_value=.08
    p.inputs['Roughness'].default_value=.5
    specs[ART]=('ApprovedMedia',(1,1,1,1),.5,.08,.42)
    color=(.42,.035,1,1) if violet else (.015,.62,.95,1)
    neon=bpy.data.materials.new(prefix+'Neon');neon.use_nodes=True;neon.diffuse_color=color
    p=neon.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=color;p.inputs['Emission Color'].default_value=color
    p.inputs['Emission Strength'].default_value=2.4
    mats.append(neon);specs.append(('Neon',color,.4,0,2.4))
    return mats,specs


def shell(b,w,d,h):
    b.box(0,0,h/2,w,d,h,CONCRETE)
    b.box(0,-.05,.11,w+.3,d+.25,.22,CONCRETE,bevel=.03)
    for y in [-d/2+.12,d/2-.12]:b.box(0,y,h+.16,w,.24,.32,CONCRETE)
    for x in [-w/2+.12,w/2-.12]:b.box(x,0,h+.16,.24,d,.32,CONCRETE)
    b.box(0,0,h+.02,w-.4,d-.4,.05,ROOF)
    b.panels(w,d,h)


def roof_plant(b,w,d,h):
    b.box(-w*.15,.2,h+.52,2.05,1.55,.96,SERVICE,bevel=.06)
    b.vent(-w*.15,-.61,h+.51,1.65,.68,5)
    for x in [-w*.15-.48,-w*.15+.48]:
        b.tube((x,.2,h+1),(x,.2,h+1.08),.37,STEEL,12)
        for k in range(4):
            angle=k*math.pi/2
            b.tube((x,.2,h+1.09),(x+math.cos(angle)*.3,.2+math.sin(angle)*.3,h+1.09),.021,ROOF,4)
    b.box(w*.28,d*.23,h+.47,1.1,.9,.86,SERVICE,bevel=.04)
    for x in [-.35,.2]:b.pipe([(x,d*.28,h),(x,d*.28,h+.38),(x,d*.42,h+.44)],.07,STEEL,6)


def service_details(b,w,d,h):
    # Side/rear are fully authored too; cables stay within a compact footprint.
    for y in [-d*.3,-d*.23]:
        b.pipe([(w/2+.09,y,.3),(w/2+.09,y,h-.3),(w/2-.2,y,h+.32)],.045,STEEL,6)
    for z in np.linspace(2.2,h-1.4,3):
        b.ac(-w*.32,d/2+.24,z)
        b.box(w/2+.16,d*.13,z,.3,.92,.65,ROOF,bevel=.035)
        for j in range(5):b.box(w/2+.319,d*.13,z-.22+j*.105,.019,.72,.024,STEEL)
    b.front(w*.25,d/2+.04,1.25,1.0,2.35,SERVICE)
    b.box(w*.25,d/2+.12,2.58,.6,.12,.07,WARM)
    for offset in [0,.12]:
        pts=[(w/2+.21,-d*.15+t*d*.8, h*.63-.65*math.sin(t*math.pi)+offset) for t in np.linspace(0,1,9)]
        b.pipe(pts,.028,STEEL,5)


def side_windows(b,w,d,levels,quad,size):
    for z0,z1 in levels:
        for a,c in [((w/2+.025,-d/2+.4),(w/2+.025,d/2-.4)),
                    ((-w/2-.025,d/2-.4),(-w/2-.025,-d/2+.4)),
                    ((w/2-.4,d/2+.025),(-w/2+.4,d/2+.025))]:
            artwork(b,a,c,z0,z1,quad,size,nx=5,nz=2)
            for t in np.linspace(0,1,5):
                x=a[0]+(c[0]-a[0])*t;y=a[1]+(c[1]-a[1])*t
                b.box(x,y,(z0+z1)/2,.06,.06,z1-z0+.05,STEEL)


def tower(m,size):
    b=m.Builder('CBCT1_CyberbaseTower');w,d,h=8.0,6.8,26
    shell(b,w,d,h)
    b.front(0,-d/2-.02,14.45,7.8,22.3,GLASS,depth=.01)
    for x in [-4.011,4.011]:b.box(x,0,14.45,.01,6.8,22.3,GLASS)
    # Six separate office strips from the approved right-hand facade.
    quads=[[(443,226),(663,212),(663,328),(443,340)],
           [(443,396),(663,384),(663,491),(443,504)],
           [(443,566),(663,549),(663,660),(443,680)],
           [(443,737),(663,716),(663,824),(443,847)],
           [(443,908),(663,884),(663,981),(443,1010)],
           [(443,1041),(663,1014),(663,1082),(443,1108)]]
    levels=[]
    for i,q in enumerate(reversed(quads)):
        z0=3.55+i*3.6;z1=z0+2.45;levels.append((z0,z1))
        front_art(b,1.0,-3.437,(z0+z1)/2,5.05,z1-z0,q,size,7,3)
        b.frame(1,-3.49,(z0+z1)/2,5.13,z1-z0+.04,STEEL,.085,.13)
        for x in [-.35,1.35,2.85]:b.box(x,-3.525,(z0+z1)/2,.048,.08,z1-z0,STEEL)
        front_art(b,-3.48,-3.44,(z0+z1)/2,.75,z1-z0,q,size,2,3)
    side_windows(b,w,d,levels,quads[2],size)
    for z in [3.3,7,10.6,14.2,17.8,21.4,25.8]:
        b.box(0,-3.48,z,8.08,.18,.18,STEEL)
        for x in [-4.03,4.03]:b.box(x,0,z,.12,6.8,.18,STEEL)
    for x in [-4,-2.9,-1.55,4]:b.box(x,-3.53,14.45,.14,.23,22.6,STEEL)
    # Dedicated opaque media ribbon: exact CYBERBASE artwork and continuous UV1.
    sign=m.Builder('CBCT1_VerticalTicker')
    artwork(sign,(-2.82,-3.66),(-1.63,-3.66),6.25,25.4,
        [(325,231),(392,228),(392,980),(325,987)],size,nx=3,nz=27)
    for x in [-2.87,-1.58]:b.box(x,-3.68,15.82,.028,.025,19.35,NEON)
    b.front(0,-3.43,1.6,2.6,2.85,STEEL)
    front_art(b,0,-3.49,1.6,2.36,2.68,[(441,1170),(657,1149),(657,1297),(441,1301)],size,5,4)
    b.frame(0,-3.57,1.6,2.5,2.8,STEEL,.1,.14)
    b.box(0,-3.61,1.65,.055,.06,2.5,STEEL)
    b.box(0,-3.69,3.18,3.05,.68,.13,ROOF)
    b.vent(-2.6,-3.5,1.6,1.1,1.95,9)
    for x in [-3.63,3.6]:b.lamp(x,-3.6,2.9,.18,.36)
    roof_plant(b,w,d,h);service_details(b,w,d,h)
    for x in [-3.4,2.9]:b.tube((x,2.5,h+.2),(x,2.5,28),.035,STEEL,6)
    return b,sign


def parts(m,size):
    b=m.Builder('CBPS1_JapanesePartsShop');w,d,h=9.3,6.7,9.25
    shell(b,w,d,h)
    q1=[(430,289),(924,303),(924,407),(430,407)]
    q2=[(430,514),(924,510),(924,605),(430,624)]
    for z,q in [(7.55,q1),(5.13,q2)]:
        b.front(.05,-3.38,z,8.05,1.65,STEEL)
        front_art(b,.05,-3.43,z,7.88,1.49,q,size,10,3)
        b.frame(.05,-3.5,z,8,1.61,STEEL,.09,.12)
        for x in [-2.85,-1.4,.05,1.5,2.95]:b.box(x,-3.52,z,.07,.1,1.54,STEEL)
    side_windows(b,w,d,[(4.4,5.85),(6.8,8.28)],q1,size)
    # Sign is the original approved Japanese lettering, separate from windows.
    b.front(.15,-3.49,3.75,8.9,.9,STEEL,.15)
    front_art(b,.25,-3.585,3.75,5.5,.73,[(622,666),(892,664),(892,724),(622,725)],size,8,2)
    b.box(0,-3.65,3.23,9.7,.92,.18,ROOF,bevel=.035)
    b.box(0,-4.12,3.24,9.6,.025,.035,NEON)
    for x in [-4.72,4.72]:b.box(x,-3.68,3.24,.026,.89,.035,NEON)
    # Divided shopfront: product shelves are source artwork; frames are geometry.
    shop=[[(416,792),(568,779),(568,983),(416,1013)],
          [(593,789),(777,777),(777,966),(593,996)],
          [(817,774),(1017,765),(1017,948),(817,974)]]
    for x,q in zip([-2.86,0,2.86],shop):
        b.front(x,-3.42,1.65,2.6,2.9,STEEL)
        front_art(b,x,-3.5,1.65,2.46,2.72,q,size,5,5)
        b.frame(x,-3.59,1.65,2.58,2.83,STEEL,.095,.14)
    for x in [-4.3,4.3]:b.box(x,-3.66,1.63,.035,.027,2.95,NEON)
    b.box(0,-3.63,1.64,.06,.09,2.7,STEEL)
    for x in [-.17,.17]:b.box(x,-3.72,1.42,.025,.065,.48,ROOF)
    # Projecting violet gear light, seen from facade and street side.
    b.box(4.9,-3.33,4.7,.83,.2,1.0,STEEL,bevel=.03)
    front_art(b,4.9,-3.445,4.7,.71,.87,[(1038,574),(1108,577),(1108,659),(1038,655)],size,3,3)
    b.frame(4.9,-3.47,4.7,.78,.94,NEON,.025,.03)
    for x in [-4.22,4.17]:b.lamp(x,-3.57,2.86,.14,.27)
    # Low-poly cable spools and crates flanking the entrance.
    for x in [3.42,3.99]:
        b.box(x,-3.93,.38,.49,.52,.65,SERVICE,bevel=.025)
        b.tube((x,-4.04,.92),(x,-3.69,.92),.21,STEEL,10)
        for y in [-4.06,-3.67]:b.tube((x,y-.025,.92),(x,y+.025,.92),.29,ROOF,10)
    roof_plant(b,w,d,h);service_details(b,w,d,h)
    b.tube((2.8,1.9,h),(2.8,1.9,10.65),.52,SERVICE,12)
    b.tube((2.8,1.9,10.61),(2.8,1.9,10.7),.59,ROOF,12)
    # Simple roof safety rail.
    for z in [h+.45,h+.88]:
        for y in [-3,3]:b.tube((-4.35,y,z),(4.35,y,z),.026,STEEL,5)
    for x in np.linspace(-4.35,4.35,7):
        for y in [-3,3]:b.tube((x,y,h+.1),(x,y,h+.88),.025,STEEL,5)
    return b,None


def office(m,size):
    b=m.Builder('CBOF1_UrbanOffice');w,d,h=10.8,7.8,9.45
    shell(b,w,d,h)
    # Glass corner extends in front of the closed shell, with authored depth.
    b.box(3.43,-4.15,5.66,3.8,.68,6.53,GLASS)
    q=[[(224,255),(600,288),(600,361),(224,324)],
       [(224,404),(600,440),(600,515),(224,471)],
       [(224,554),(600,603),(600,679),(224,625)]]
    cq=[[(705,237),(925,260),(925,404),(705,383)],
        [(705,420),(925,441),(925,579),(705,555)],
        [(705,594),(925,624),(925,754),(705,728)]]
    levels=[]
    for i in range(3):
        z=7.7-i*2.35;levels.append((z-.75,z+.75))
        front_art(b,-1.8,-3.94,z,5.62,1.34,q[i],size,8,3)
        b.frame(-1.8,-4.01,z,5.78,1.48,STEEL,.065,.1)
        for x in [-3.55,-1.8,-.05]:b.box(x,-4.055,z,.043,.07,1.43,STEEL)
        front_art(b,3.4,-4.51,z-.02,3.55,2.14,cq[i],size,6,4)
        b.frame(3.4,-4.56,z-.02,3.65,2.24,STEEL,.075,.1)
        b.box(3.4,-4.59,z-.02,.055,.065,2.12,STEEL)
        artwork(b,(5.425,-4.43),(5.425,-1.8),z-1.05,z+1.05,cq[i],size,nx=4,nz=3)
    side_windows(b,w,d,levels,q[0],size)
    for x in [-5.12,1.25]:b.box(x,-4.13,5.2,.4,.48,8.5,CONCRETE,bevel=.025)
    for z in [4.65,7]:b.box(1.07,-4.385,z,.025,.026,1.62,NEON)
    b.front(-.1,-3.99,1.35,2.8,2.5,STEEL)
    front_art(b,-.1,-4.06,1.37,2.66,2.36,[(466,793),(706,820),(706,936),(466,899)],size,5,4)
    b.frame(-.1,-4.13,1.37,2.77,2.48,STEEL,.08,.12)
    b.box(-.1,-4.19,1.38,.06,.07,2.36,STEEL)
    for i in range(3):b.box(-.1,-4.53+i*.19,.055+i*.055,3.33,.95-i*.18,.11,CONCRETE)
    b.vent(-3.25,-3.99,1.35,2.13,1.94,9)
    b.box(-.1,-4.3,2.77,3.4,.9,.24,CONCRETE,bevel=.025)
    for x in [-1.45,1.25]:b.lamp(x,-4.4,2.54,.3,.06)
    roof_plant(b,w,d,h);service_details(b,w,d,h)
    b.box(.8,1.5,10.16,2.7,2.2,1.38,CONCRETE)
    b.box(.8,1.5,10.94,2.85,2.35,.12,ROOF)
    b.front(.4,.375,10.13,.72,1.21,SERVICE)
    b.lamp(.4,.26,10.77,.3,.07)
    for x in [-4.88,4.99]:b.box(x,-4.18,1.37,.045,.03,1.57,NEON)
    return b,None


def export_and_review(slug, filename, prefix, maxheight, render):
    out=ROOT/'output/building-models'/f'{slug}-v1';out.mkdir(parents=True,exist_ok=True)
    public=ROOT/'public/game/buildings'/f'{slug}-v1';public.mkdir(parents=True,exist_ok=True)
    source=CONCEPTS/filename
    previous=bpy.context.window.scene
    scene=bpy.data.scenes.new('CyberBase '+slug+' V1');bpy.context.window.scene=scene
    scene.unit_settings.system='METRIC';scene['generator']='scripts/build-city-trio.py'
    try:
        m=module('trio_geometry',ROOT/'scripts/build-reference-buildings.py')
        mats,specs=materials(out,source,prefix,slug=='japanese-parts-shop');m.SPECS=specs
        image=next(n.image for n in mats[ART].node_tree.nodes if n.type=='TEX_IMAGE');size=tuple(image.size)
        b,sign={'cyberbase-tower':tower,'japanese-parts-shop':parts,'urban-office':office}[slug](m,size)
        coll=bpy.data.collections.new(prefix+'Model');scene.collection.children.link(coll)
        root=b.finish(coll,mats)
        if sign:
            ticker=sign.finish(coll,mats)
            ticker.name=prefix+'TickerAssembly'
            for obj in list(ticker.children):
                obj.parent=root;obj.name=prefix+'VerticalTicker';obj['static_ticker']=True
                uv1=obj.data.uv_layers.new(name='TickerFlow')
                for poly in obj.data.polygons:
                    for loop in poly.loop_indices:
                        co=obj.data.vertices[obj.data.loops[loop].vertex_index].co
                        uv1.data[loop].uv=((co.x+2.82)/1.19,(co.z-6.25)/19.15)
            bpy.data.objects.remove(ticker,do_unlink=True)
        bpy.context.view_layer.update()
        points=[obj.matrix_world@v.co for obj in root.children for v in obj.data.vertices]
        lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)])
        assert hi.z-lo.z <= maxheight+.01, (slug,hi.z)
        shift=Vector((-(lo.x+hi.x)/2,-(lo.y+hi.y)/2,-lo.z))
        for obj in root.children:
            for v in obj.data.vertices:v.co+=shift
            obj.data.update();obj.select_set(True)
        root.select_set(True);bpy.context.view_layer.objects.active=root
        path=public/f'{slug}.glb'
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,use_active_scene=True,
            export_apply=True,export_animations=False,export_cameras=False,export_lights=False,
            export_extras=True,export_materials='EXPORT',export_image_format='AUTO',export_yup=True)
        raw=path.read_bytes();length=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+length])
        # Blender exporter cannot infer the tint behind the Multiply node.
        for mat in doc['materials']:
            index=next(i for i,m in enumerate(mats) if m.name==mat['name'])
            if 'baseColorTexture' in mat.get('pbrMetallicRoughness',{}):
                mat['pbrMetallicRoughness']['baseColorFactor']=list(specs[index][1])
        encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
        tail=raw[20+length:]
        path.write_bytes(struct.pack('<4sII',b'glTF',2,20+len(encoded)+len(tail))+struct.pack('<I4s',len(encoded),b'JSON')+encoded+tail)
        metrics={'triangles':sum(doc['accessors'][p['indices']]['count']//3 for mesh in doc['meshes'] for p in mesh['primitives']),
            'drawCalls':sum(len(mesh['primitives']) for mesh in doc['meshes']),
            'width':round(hi.x-lo.x,4),'depth':round(hi.y-lo.y,4),'height':round(hi.z-lo.z,4),
            'bytes':path.stat().st_size,'sourceArtworkSha256':hashlib.sha256(source.read_bytes()).hexdigest()}
        assert metrics['triangles']<10000 and metrics['drawCalls']<=11,metrics
        (out/'metrics.json').write_text(json.dumps(metrics,indent=2),encoding='utf8')
        scene.world=bpy.data.worlds.new(prefix+'World');scene.world.use_nodes=True
        scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.055,.08,.115,1)
        scene.world.node_tree.nodes['Background'].inputs[1].default_value=.45
        bpy.data.libraries.write(str(out/f'{slug}.blend'),{scene},fake_user=True,compress=True)
        print(slug,json.dumps(metrics),flush=True)
        if render:review(scene,out,prefix,metrics)
    finally:bpy.context.window.scene=previous


def review(scene,out,prefix,metrics):
    h=metrics['height'];w=metrics['width'];target=Vector((0,0,h*.46))
    factor=max(1,h/11)
    for name,pos,power,color,size in [('Key',(-12,-17,h+8),2100,(.67,.82,1),12),
        ('Fill',(13,-10,h*.65),1400,(1,.77,.53),10),('Rim',(4,12,h+5),2500,(.5,.74,1),9)]:
        data=bpy.data.lights.new(prefix+name,'AREA');data.energy=power*factor;data.color=color;data.size=size
        obj=bpy.data.objects.new(data.name,data);scene.collection.objects.link(obj);obj.location=pos
        obj.rotation_euler=(target-obj.location).to_track_quat('-Z','Y').to_euler()
    data=bpy.data.cameras.new(prefix+'Review');cam=bpy.data.objects.new(data.name,data)
    scene.collection.objects.link(cam);scene.camera=cam
    cam.location=(max(w,12)*1.35,-max(w,12)*2.1,h*.85)
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    data.type='ORTHO';data.ortho_scale=max(h*1.18,w*1.7)
    scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
    scene.render.threads_mode='FIXED';scene.render.threads=4
    scene.render.resolution_x=960;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG'
    scene.render.filepath=str(out/'blender-review.png');bpy.ops.render.render(write_still=True)


if __name__=='__main__':
    args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    for config in MODELS:
        if not args or config[0] in args or args==['--no-render']:
            export_and_review(*config,render='--no-render' not in args)
