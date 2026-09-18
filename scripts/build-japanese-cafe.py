"""Approved Japanese café: batched low-poly geometry, original sign/kitchen artwork.

Run Blender --background --factory-startup --threads 4 --python this-file.
Separate scene/source; no changes to previous assets or the owner's map.
"""
from pathlib import Path
import importlib.util
import hashlib
import json
import math
import struct
import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/building-models/japanese-cafe-v1'
PUBLIC = ROOT / 'public/game/buildings/japanese-cafe-v1'
SOURCE = ROOT / 'output/building-concepts/2026-09-18-japan-wallet-v1/01-japanese-cafe.png'
PREFIX = 'CBJ1_'
CONCRETE, STEEL, GREEN, RED, GLASS, WOOD, GLOW, SILVER, ART, CYAN = range(10)


def module_at(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def materials():
    source = module_at('cafe_materials', ROOT/'scripts/build-media-tower.py')
    source.OUT, source.SOURCE, source.PREFIX = OUT, SOURCE, PREFIX
    mats, specs = source.materials()
    mats[CONCRETE].name = 'CBR1_Concrete_JapaneseCafe'
    for index, name, color, rough, metal, emission in [
        (RED, 'PaperLantern', (.7,.075,.027,1), .82, 0, .65),
        (WOOD, 'DarkTimber', (.17,.085,.035,1), .83, 0, 0),
        (ART, 'ApprovedArtwork', (1,1,1,1), .62, .08, .38),
    ]:
        mat = mats[index]; mat.name = PREFIX+name; mat.diffuse_color = color
        node = mat.node_tree.nodes.get('Principled BSDF')
        node.inputs['Base Color'].default_value = color
        node.inputs['Emission Color'].default_value = color
        node.inputs['Emission Strength'].default_value = emission
        node.inputs['Roughness'].default_value = rough
        node.inputs['Metallic'].default_value = metal
        specs[index] = (name, color, rough, metal, emission)
    cyan = bpy.data.materials.new(PREFIX+'SignCyan'); cyan.use_nodes = True
    cyan.diffuse_color = (.012,.42,.61,1)
    node = cyan.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value = cyan.diffuse_color
    node.inputs['Emission Color'].default_value = cyan.diffuse_color
    node.inputs['Emission Strength'].default_value = 1.6
    mats.append(cyan); specs.append(('SignCyan',tuple(cyan.diffuse_color),.4,0,1.6))
    return mats, specs


def patch(b, x, y, z, w, h, quad, nx=4, nz=4):
    """Small individually rectified details, not a photograph pasted on the whole box."""
    src = [(a/1254,1-c/1254) for a,c in (quad[3],quad[2],quad[1],quad[0])]
    rows, values = [], []
    for (u,v),(s,t) in zip([(0,0),(1,0),(1,1),(0,1)],src):
        rows.extend([[u,v,1,0,0,0,-s*u,-s*v],[0,0,0,u,v,1,-t*u,-t*v]])
        values.extend([s,t])
    hom = np.append(np.linalg.solve(np.array(rows),np.array(values)),1).reshape(3,3)
    for j in range(nz):
        for i in range(nx):
            coords=[(i/nx,j/nz),((i+1)/nx,j/nz),((i+1)/nx,(j+1)/nz),(i/nx,(j+1)/nz)]
            uv=[]
            for u,v in coords:
                q=hom@np.array([u,v,1]);uv.append(tuple(q[:2]/q[2]))
            b.face([(x+(u-.5)*w,y,z+(v-.5)*h) for u,v in coords],ART,uv)


def lantern(b, x):
    y,z=-2.91,2.74
    b.tube((x,-2.52,3.37),(x,y,3.37),.022,STEEL,5)
    b.tube((x,y,3.37),(x,y,3.13),.016,STEEL,5)
    rings=[(-.4,.17),(-.33,.23),(-.2,.265),(.2,.265),(.33,.23),(.4,.17)]
    for (a,r),(c,s) in zip(rings,rings[1:]):b.tube((x,y,z+a),(x,y,z+c),r,RED,12,s)
    for dz in [-.42,.42]:b.tube((x,y,z+dz-.035),(x,y,z+dz+.035),.18,STEEL,12)
    for dz in np.linspace(-.29,.29,9):
        r=.269 if abs(dz)<.21 else .247
        pts=[(x+r*math.cos(t),y+r*math.sin(t),z+dz) for t in np.linspace(0,math.tau,13)]
        for a,c in zip(pts,pts[1:]):b.tube(a,c,.006,RED,4)
    # Front lettering uses the approved lantern's exact glyphs.
    patch(b,x,y-.267,z,.23,.61,[(294,596),(326,597),(326,651),(294,650)],2,4)


def build(module):
    b=module.Builder(PREFIX+'JapaneseCafe')
    # 6.4 x 5.0 m two-storey shell. Closed rear/sides and a compact foundation.
    b.box(0,0,3.3,6.4,5,6.35,CONCRETE)
    b.box(0,-.28,.1,6.65,5.8,.2,CONCRETE,bevel=.035)
    b.box(0,0,6.49,6.6,5.2,.2,SILVER,bevel=.035)
    for x in [-3.17,3.17]:b.box(x,-2.57,3.32,.14,.15,6.26,STEEL)
    for z in [3.65,6.12]:b.box(0,-2.56,z,6.43,.16,.16,STEEL)
    for z in [1.8,3.6,5.45]:
        for x in [-3.215,3.215]:b.box(x,0,z,.025,5,.025,STEEL)
        b.box(0,2.515,z,6.4,.025,.025,STEEL)
    for y in [-1.3,.25,1.8]:
        for x in [-3.218,3.218]:b.box(x,y,3.2,.025,.02,6.2,STEEL)
    # Three separately framed upstairs windows preserve the approved warm blinds.
    for x,quad in [(-2,[(340,290),(450,303),(450,479),(340,463)]),
                   (-.05,[(479,308),(589,322),(589,499),(479,484)]),
                   (1.92,[(620,329),(740,345),(740,518),(620,504)])]:
        b.front(x,-2.545,4.87,1.75,2.03,STEEL)
        patch(b,x,-2.606,4.87,1.58,1.84,quad,4,6)
        b.frame(x,-2.64,4.87,1.72,2.01,STEEL,.075,.11)
    # Actual slat storefront; texture panels only supply signs/interior artwork.
    for x in np.arange(-3.05,3.1,.135):b.box(x,-2.57,1.96,.068,.09,3.16,WOOD)
    b.front(-.15,-2.655,3.17,3.0,.83,WOOD,.11)
    patch(b,-.15,-2.716,3.17,2.85,.71,[(413,558),(591,583),(591,650),(413,625)],6,3)
    b.frame(-.15,-2.73,3.17,2.98,.82,STEEL,.055,.075)
    # Kitchen opening and recessed still-life; shelf, bowls and counter are geometry.
    b.front(-.65,-2.64,1.88,2.94,1.42,STEEL)
    patch(b,-.65,-2.69,1.88,2.8,1.3,[(367,710),(570,739),(568,823),(365,794)],7,4)
    b.frame(-.65,-2.76,1.88,2.99,1.45,WOOD,.095,.2)
    b.box(-.65,-2.94,1.13,3.14,.8,.12,WOOD,bevel=.025)
    b.box(-.65,-2.75,.63,2.98,.25,.85,WOOD)
    b.box(-.65,-2.84,2.66,3.25,.48,.14,WOOD)
    for x in [-1.8,-.6,.62]:b.lamp(x,-2.89,2.54,.11,.05)
    for x in [-1.65,-.74,.35]:
        b.tube((x,-3.09,1.21),(x,-3.09,1.32),.07,SILVER,10,.15)
        b.tube((x,-3.09,1.321),(x,-3.09,1.333),.128,WOOD,10)
    for x in [-1.87,-1.02,-.17,.68]:
        b.box(x,-3.49,.76,.5,.48,.09,WOOD,bevel=.018)
        for dx in [-.18,.18]:
            for dy in [-.16,.16]:b.tube((x+dx,-3.49+dy,.12),(x+dx,-3.49+dy,.72),.025,STEEL,4)
        b.box(x,-3.67,.35,.4,.035,.035,STEEL)
    # Glass entrance with a three-part noren, deliberately layered physical depths.
    b.front(2,-2.67,1.54,1.72,2.66,STEEL)
    patch(b,2,-2.715,1.54,1.59,2.51,[(606,712),(742,733),(743,973),(605,951)],5,8)
    b.frame(2,-2.78,1.54,1.69,2.64,WOOD,.075,.13)
    b.box(2,-2.81,1.24,.045,.09,1.88,STEEL)
    b.box(2.16,-2.88,1.25,.027,.045,.33,SILVER)
    for k in range(3):
        x=1.48+k*.52
        b.front(x,-2.84,2.33,.507,.9,GLASS,.027)
        # Use adjacent subrectangles of the original curtain via a shared homography.
    patch(b,2,-2.864,2.33,1.53,.84,[(604,706),(742,729),(742,809),(604,790)],9,4)
    for x in [1.735,2.255]:b.box(x,-2.87,2.23,.014,.022,.62,STEEL)
    # Original food photographs and Japanese cyan sign; no geometry-heavy glyphs.
    b.front(-2.67,-2.68,1.68,.62,1.47,WOOD)
    patch(b,-2.67,-2.726,1.68,.54,1.34,[(284,707),(334,715),(334,850),(283,841)],2,6)
    b.frame(-2.67,-2.76,1.68,.64,1.49,SILVER,.028,.065)
    b.box(-3.54,-2.49,4.88,.69,.3,2.51,STEEL)
    patch(b,-3.54,-2.65,4.88,.55,2.34,[(220,278),(263,281),(263,503),(219,501)],3,9)
    b.frame(-3.54,-2.67,4.88,.66,2.49,CYAN,.021,.04)
    for z in [3.94,5.83]:b.tube((-3.2,-2.4,z),(-3.52,-2.4,z),.025,STEEL,5)
    for x in [-2.62,2.92]:lantern(b,x)
    # Side balcony/AC and door, built as real geometry and rotated with the building.
    b.box(3.47,-.72,3.63,.65,2.5,.13,SILVER)
    for y in [-1.86,.42]:
        b.tube((3.2,y,3.47),(3.77,y,3.59),.035,STEEL,4)
        b.tube((3.75,y,3.68),(3.75,y,4.48),.025,STEEL,5)
        b.tube((3.2,y,4.48),(3.78,y,4.48),.025,STEEL,5)
    b.tube((3.77,-1.86,4.48),(3.77,.42,4.48),.028,STEEL,5)
    for y in np.arange(-1.7,.4,.36):b.tube((3.77,y,3.69),(3.77,y,4.46),.018,STEEL,4)
    b.box(3.24,-.14,4.51,.065,.91,1.71,GREEN)
    b.box(3.30,-.14,5.47,.11,.7,.085,GLOW)
    # Reuse the low-sided AC helper then rotate its newly appended vertices to +X.
    starts=[len(v) for v in b.v]; b.ac(0,0,0)
    for group,start in zip(b.v,starts):
        for i in range(start,len(group)):
            x,y,z=group[i];group[i]=(3.42-y,-1.12+x,4.06+z)
    # Finished rear and left service elevations with pipes, shutter and upper panes.
    b.box(.45,2.55,1.32,1.2,.1,2.3,GREEN)
    b.box(.45,2.62,2.52,.94,.1,.055,GLOW)
    for x in [-1.9,1.5]:
        b.box(x,2.54,4.72,1.28,.08,1.54,GLASS)
        for z in [4.0,5.46]:b.box(x,2.59,z,1.4,.1,.07,STEEL)
    for y in [-.8,1.5]:
        b.box(-3.23,y,4.7,.065,1.32,1.53,GLASS)
        for z in [4.02,5.4]:b.box(-3.27,y,z,.08,1.4,.065,STEEL)
    for y in [-2.22,1.88]:
        b.pipe([(3.28,y,.22),(3.28,y,6.3),(3.02,y,6.75)],.035,STEEL,6)
    b.box(3.25,.98,1.42,.12,1.25,2.3,GREEN)
    for z in np.arange(2.0,3.2,.13):b.box(3.3,-.86,z,.08,1.27,.047,SILVER)
    for x in [-2.72,2.7]:b.pipe([(x,2.56,.22),(x,2.56,6.28)],.035,STEEL,5)
    for z in [2.9,3.08,3.26]:
        pts=[(-3.27,-2.1+4*t,z-.3*4*t*(1-t)) for t in np.linspace(0,1,13)]
        for a,c in zip(pts,pts[1:]):b.tube(a,c,.015,STEEL,4)
    # Flat roof: two bent box exhausts, service cabinet and light thin railing.
    for y in [-2.37,2.37]:
        b.tube((-3.04,y,7.05),(3.04,y,7.05),.023,STEEL,5)
        for x in [-3,-1.5,0,1.5,3]:b.tube((x,y,6.61),(x,y,7.05),.02,STEEL,4)
    for x in [-3.04,3.04]:
        b.tube((x,-2.37,7.05),(x,2.37,7.05),.023,STEEL,5)
        for y in [-.8,.8]:b.tube((x,y,6.61),(x,y,7.05),.02,STEEL,4)
    for x,w,h in [(-1.35,1.3,.97),(.25,.82,.67)]:
        b.box(x,.62,6.68,w+.18,1.1,.15,STEEL)
        b.box(x,.63,6.69+h/2,w,.89,h,SILVER,bevel=.1)
        b.vent(x,.15,6.68+h*.5,w*.78,h*.6,4)
    b.box(2.04,1.44,7.03,1.12,.84,.92,GREEN,bevel=.03)
    for z in np.arange(6.77,7.31,.09):b.box(2.04,.999,z,.86,.055,.027,SILVER)
    b.tube((1.12,1.8,6.6),(1.12,1.8,7.93),.022,STEEL,5)
    b.box(1.12,1.8,7.86,.06,.06,.08,RED)
    # Small street-level lamp housings; no runtime light objects.
    for x in [-3.07,3.12]:
        b.box(x,-2.75,1.2,.15,.2,.38,STEEL)
        b.box(x,-2.87,1.2,.08,.035,.28,GLOW)
    return b


def review(scene):
    target=Vector((0,0,3.6))
    for name,pos,power,color,size in [('Key',(-9,-13,15),1700,(.68,.82,1),9),
            ('Fill',(10,-8,10),950,(1,.77,.52),8),('Rim',(3,10,13),2200,(.5,.72,1),7)]:
        data=bpy.data.lights.new(PREFIX+name,'AREA');data.energy=power;data.color=color;data.size=size
        obj=bpy.data.objects.new(data.name,data);scene.collection.objects.link(obj);obj.location=pos
        obj.rotation_euler=(target-obj.location).to_track_quat('-Z','Y').to_euler()
    data=bpy.data.cameras.new(PREFIX+'Review');cam=bpy.data.objects.new(data.name,data)
    scene.collection.objects.link(cam);scene.camera=cam
    cam.location=(12,-19,12);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    data.type='ORTHO';data.ortho_scale=11.3
    scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
    scene.render.threads_mode='FIXED';scene.render.threads=4
    scene.render.resolution_x=1100;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG'
    scene.render.filepath=str(OUT/'blender-review.png');bpy.ops.render.render(write_still=True)


def main():
    OUT.mkdir(parents=True,exist_ok=True);PUBLIC.mkdir(parents=True,exist_ok=True)
    scene=bpy.data.scenes.new('CyberBase Japanese Cafe V1');scene['generator']='scripts/build-japanese-cafe.py'
    scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
    previous=bpy.context.window.scene;bpy.context.window.scene=scene
    try:
        module=module_at('cafe_geometry',ROOT/'scripts/build-reference-buildings.py')
        mats,specs=materials();module.SPECS=specs
        collection=bpy.data.collections.new(PREFIX+'Model');scene.collection.children.link(collection)
        root=build(module).finish(collection,mats)
        bpy.context.view_layer.update()
        points=[obj.matrix_world@v.co for obj in root.children for v in obj.data.vertices]
        lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)])
        delta=Vector((-(lo.x+hi.x)/2,-(lo.y+hi.y)/2,-lo.z))
        for obj in root.children:
            for v in obj.data.vertices:v.co+=delta
            obj.data.update();obj.select_set(True)
        root.select_set(True);bpy.context.view_layer.objects.active=root
        path=PUBLIC/'japanese-cafe.glb'
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,use_active_scene=True,
            export_apply=True,export_animations=False,export_cameras=False,export_lights=False,
            export_materials='EXPORT',export_image_format='AUTO',export_yup=True)
        raw=path.read_bytes();length=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+length])
        for mat in doc['materials']:
            index=next(i for i,m in enumerate(mats) if m.name==mat['name'])
            if 'baseColorTexture' in mat.get('pbrMetallicRoughness',{}):
                mat['pbrMetallicRoughness']['baseColorFactor']=list(specs[index][1])
        encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
        tail=raw[20+length:]
        path.write_bytes(struct.pack('<4sII',b'glTF',2,20+len(encoded)+len(tail))+struct.pack('<I4s',len(encoded),b'JSON')+encoded+tail)
        metrics={'triangles':sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives']),
            'drawCalls':sum(len(m['primitives']) for m in doc['meshes']),
            'width':round(hi.x-lo.x,4),'depth':round(hi.y-lo.y,4),'height':round(hi.z-lo.z,4),
            'bytes':path.stat().st_size,'sourceArtworkSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
            'source':str(OUT/'japanese-cafe.blend')}
        scene.world=bpy.data.worlds.new(PREFIX+'World');scene.world.use_nodes=True
        scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.07,.1,.14,1)
        scene.world.node_tree.nodes['Background'].inputs[1].default_value=.4
        bpy.data.libraries.write(str(OUT/'japanese-cafe.blend'),{scene},fake_user=True,compress=True)
        (OUT/'metrics.json').write_text(json.dumps(metrics,indent=2),encoding='utf8')
        print(json.dumps(metrics,indent=2));review(scene)
    finally:bpy.context.window.scene=previous


if __name__=='__main__':main()
