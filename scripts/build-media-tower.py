"""Build the approved glass tower in the existing Blender session.

The approved portrait is used verbatim as an embedded image with projective UVs.
No face regeneration or destructive changes to the user's Blender scene.
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
OUT = ROOT / 'output/building-models/media-tower-v1'
PUBLIC = ROOT / 'public/game/buildings/media-tower-v1'
SOURCE = ROOT / 'output/building-concepts/2026-09-18-glass-neon-v1/01-media-tower.png'
PREFIX = 'CBM1_'
SCENE = 'CyberBase Media Tower V1'
CONCRETE, STEEL, GREEN, RED, GLASS, WARM, GLOW, SILVER, MEDIA = range(9)


def builder_module():
    spec = importlib.util.spec_from_file_location('media_tower_geometry', ROOT / 'scripts/build-reference-buildings.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.SPECS = module.SPECS + [('ApprovedMedia', (1,1,1,1), .36, .25, .8)]
    return module


def materials():
    # Reuse the approved compressed surface maps verbatim from the existing armory.
    # Keep the portrait PNG lossless; don't spend its budget on repeated concrete.
    old=(ROOT/'public/game/buildings/reference-v1/armory.glb').read_bytes()
    length=struct.unpack_from('<I',old,12)[0];doc=json.loads(old[20:20+length]);binary=old[28+length:]
    for image in doc['images']:
        view=doc['bufferViews'][image['bufferView']]
        (OUT/(image['name']+'.jpg')).write_bytes(binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']])
    surface = bpy.data.images.load(str(OUT/'surface.jpg'), check_existing=False)
    concrete = bpy.data.images.load(str(OUT/'cold-concrete.jpg'), check_existing=False)
    approved = bpy.data.images.load(str(SOURCE), check_existing=False)
    for image in (surface, concrete, approved):
        image.name = PREFIX + image.name
        image.pack()
    specs = [
        ('Concrete', (.33975,.3465,.3555,1), .92, 0, 0),
        ('BlackFrame', (.055,.069,.075,1), .52, .7, 0),
        ('ServiceMetal', (.075,.105,.11,1), .67, .5, 0),
        ('BeaconRed', (.95,.045,.008,1), .3, 0, 2.0),
        ('SmokedGlass', (.018,.059,.074,1), .23, .58, 0),
        ('OfficeAmber', (.27,.14,.045,1), .5, .15, .32),
        ('WarmLight', (1,.49,.16,1), .36, 0, 1.8),
        ('RoofMetal', (.21,.245,.26,1), .64, .65, 0),
        ('ApprovedMedia', (1,1,1,1), .36, .25, .8),
    ]
    result=[]
    for index,(name,color,rough,metal,emission) in enumerate(specs):
        mat=bpy.data.materials.new('CBR1_Concrete_MediaTower' if index==CONCRETE else PREFIX+name)
        mat.diffuse_color=color;mat.use_nodes=True
        p=mat.node_tree.nodes.get('Principled BSDF')
        p.inputs['Base Color'].default_value=color
        p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
        p.inputs['Emission Strength'].default_value=emission
        p.inputs['Emission Color'].default_value=color
        if index in (CONCRETE,STEEL,GREEN,SILVER,MEDIA):
            texture=mat.node_tree.nodes.new('ShaderNodeTexImage')
            texture.image=approved if index==MEDIA else concrete if index==CONCRETE else surface
            if index==MEDIA:
                mat.node_tree.links.new(texture.outputs['Color'],p.inputs['Base Color'])
                # Same source pixels in diffuse and emission; no reinterpretation of her face.
                mat.node_tree.links.new(texture.outputs['Color'],p.inputs['Emission Color'])
            else:
                tint=mat.node_tree.nodes.new('ShaderNodeMixRGB');tint.blend_type='MULTIPLY'
                tint.inputs[0].default_value=1;tint.inputs[2].default_value=color
                mat.node_tree.links.new(texture.outputs['Color'],tint.inputs[1])
                mat.node_tree.links.new(tint.outputs[0],p.inputs['Base Color'])
        result.append(mat)
    return result,specs


def projective_facade(b, a, c, quad, nu=12, nv=24):
    """Rectangle on a real building -> approved concept quadrilateral, pixel exact source.

    a/c are bottom-left/bottom-right. quad is TL,TR,BR,BL in source pixel space.
    Subdivision approximates homogeneous interpolation in standard glTF UVs.
    """
    source=[(x/1024,1-y/1536) for x,y in (quad[3],quad[2],quad[1],quad[0])]
    rows=[];values=[]
    for (u,v),(x,y) in zip([(0,0),(1,0),(1,1),(0,1)],source):
        rows.extend([[u,v,1,0,0,0,-x*u,-x*v],[0,0,0,u,v,1,-y*u,-y*v]])
        values.extend([x,y])
    h=np.append(np.linalg.solve(np.array(rows),np.array(values)),1).reshape(3,3)
    def point(u,v):return (a[0]+(c[0]-a[0])*u,a[1]+(c[1]-a[1])*u,5.8+24.2*v)
    def uv(u,v):
        q=h@np.array([u,v,1]);return tuple(q[:2]/q[2])
    for j in range(nv):
        for i in range(nu):
            coords=[(i/nu,j/nv),((i+1)/nu,j/nv),((i+1)/nu,(j+1)/nv),(i/nu,(j+1)/nv)]
            b.face([point(*p) for p in coords],MEDIA,[uv(*p) for p in coords])


def build(module):
    b=module.Builder(PREFIX+'MediaTower')
    # Simple five-sided footprint: the street corner is chamfered, not rounded high-poly.
    footprint=[(-5.2,-3.2),(-4,-4.4),(5.2,-4.4),(5.2,4.4),(-5.2,4.4)]
    for i,a in enumerate(footprint):
        c=footprint[(i+1)%len(footprint)]
        b.face([(a[0],a[1],0),(c[0],c[1],0),(c[0],c[1],5.8),(a[0],a[1],5.8)],CONCRETE)
    b.face([(x,y,30) for x,y in footprint],STEEL)
    # Exact approved front / chamfer / left glass artwork. Remaining sides are actual glass panels.
    projective_facade(b,(-4,-4.4),(5.2,-4.4),[(491,215),(747,173),(749,980),(489,1044)])
    projective_facade(b,(-5.2,-3.2),(-4,-4.4),[(399,200),(491,215),(489,1044),(399,1050)],4,24)
    projective_facade(b,(-5.2,4.4),(-5.2,-3.2),[(237,156),(399,200),(399,1050),(235,975)],8,24)
    # Repeat the advertising-side treatment on the elevation seen by the saved game camera.
    projective_facade(b,(5.2,-4.4),(5.2,4.4),[(237,156),(399,200),(399,1050),(235,975)],8,24)
    b.face([(5.2,4.4,5.8),(-5.2,4.4,5.8),(-5.2,4.4,30),(5.2,4.4,30)],GLASS)
    # Structural seams on all elevations; the fine advertising pixel grid stays in the texture.
    for z in [5.8,30]:
        for i,a in enumerate(footprint):
            c=footprint[(i+1)%len(footprint)];b.tube((*a,z),(*c,z),.095,STEEL,4)
    for x,y in footprint:b.box(x,y,17.9,.105,.105,24.2,STEEL)
    for z in np.linspace(5.8,30,13):
        b.box(0,4.42,z,10.4,.085,.095,STEEL)
    for x in np.linspace(-5.2,5.2,9):b.box(x,4.43,17.9,.055,.085,24.2,STEEL)
    # A few warm back/side offices. No modeled rooms or transparent sorting burden.
    for row,col in [(0,2),(2,5),(5,1),(6,6),(8,3),(10,5)]:
        z=6.85+row*2.0167;x=-4.52+col*1.3
        b.box(x,4.445,z,1.17,.025,1.78,WARM)
        for k in range(4):b.box(x,4.47,z+.15*k,1.15,.02,.025,STEEL)
    # Grounded compact foundation; user's existing city paving continues around it.
    b.box(0,0,.10,11.2,9.6,.20,CONCRETE,bevel=.035)
    b.box(0,0,.25,10.7,9.1,.13,STEEL)
    for z in [1.85,3.75,5.45]:
        b.box(.6,-4.425,z,9.2,.035,.045,STEEL)
        b.box(-5.22,.6,z,.035,7.6,.045,STEEL)
    for x in [-3.3,-1.7,.1,2.5,4.7]:b.box(x,-4.43,2.7,.035,.035,5.4,STEEL)
    for y in [-2.4,-.5,1.5,3.6]:b.box(-5.23,y,2.7,.035,.035,5.4,STEEL)
    # Warm recessed front door, canopy, louvres, utility panels.
    b.front(.9,-4.46,1.6,2.0,2.8,STEEL)
    b.front(.9,-4.51,1.6,1.66,2.55,WARM)
    b.frame(.9,-4.56,1.6,1.88,2.72,SILVER,.055,.11)
    b.box(.9,-4.60,1.6,.055,.07,2.5,STEEL)
    for x in [.65,1.15]:b.box(x,-4.64,1.6,.025,.04,.42,SILVER)
    b.box(.9,-4.75,3.2,2.35,.85,.12,STEEL,bevel=.025)
    b.lamp(.9,-4.56,3.07,1.85,.10)
    b.vent(-2.8,-4.50,3.85,1.05,.72,6)
    b.vent(-2.65,-4.50,1.3,1.35,.95,7)
    for x,z in [(3.2,3.7),(3.6,1.2),(-.6,4.2)]:
        b.box(x,-4.53,z,.54,.23,.82,GREEN,bevel=.025)
        b.lamp(x+.12,-4.66,z-.18,.045,.04)
    for y in [-2.2,3.1]:b.pipe([(-5.27,y,.4),(-5.27,y,5.35),(-5.27,y+.35,5.55)],.067,STEEL,6)
    # Thin amber ticker recessed below the glass.
    b.front(.6,-4.51,5.48,9.1,.35,STEEL)
    rng=np.random.default_rng(1809)
    for i in range(68):
        if rng.random()>.28:b.front(-3.85+i*.13,-4.565,5.48,.09,.105,GLOW,.018)
    # Real loose wires align with the existing cables in the approved facade photo.
    for x,z in [(5.24,17.7)]:
        b.box(x,-4.62,z,.48,.32,1.38,GREEN,bevel=.035)
        b.lamp(x,-4.8,z+.44,.085,.085)
    for k in range(3):
        pts=[]
        for i in range(21):
            t=i/20;pts.append((-4+9.24*t,-4.64,16.0+1.7*t-.8*4*t*(1-t)-k*.28))
        for a,c in zip(pts,pts[1:]):b.tube(a,c,.032,STEEL,5)
    # Roof: flat deck, practical guardrails, large twin-fan unit and antenna group.
    b.box(0,.1,30.08,10.65,8.8,.16,SILVER,bevel=.025)
    for y in [-4.0,4.0]:
        b.tube((-4.8,y,30.65),(4.8,y,30.65),.03,STEEL,5)
        for x in np.linspace(-4.8,4.8,7):b.tube((x,y,30.18),(x,y,30.65),.025,STEEL,5)
    for x in [-4.8,4.8]:
        b.tube((x,-4,30.65),(x,4,30.65),.03,STEEL,5)
        for y in [-2.7,-1.3,0,1.3,2.7]:b.tube((x,y,30.18),(x,y,30.65),.025,STEEL,5)
    b.box(-1.65,1,31.18,4.0,2.5,2.0,SILVER,bevel=.09)
    b.vent(-1.65,-.30,31.2,3.6,1.58,11)
    b.box(-.2,-.85,30.85,1.2,1.2,1.35,GREEN,bevel=.045)
    for x in [-2.65,-.7]:
        b.tube((x,1,32.18),(x,1,32.28),.78,STEEL,16)
        b.tube((x,1,32.28),(x,1,32.32),.67,SILVER,16)
        for i in range(8):
            angle=i*math.tau/8
            b.tube((x,1,32.35),(x+.63*math.cos(angle),1+.63*math.sin(angle),32.35),.028,STEEL,5)
    for x,y,top in [(1.05,1.6,34.6),(1.9,1.8,33.9),(2.6,2.2,32.5)]:
        b.box(x,y,30.4,.35,.35,.42,STEEL)
        b.tube((x,y,30.4),(x,y,top),.035,STEEL,6)
        b.box(x+.16,y,32.1,.26,.17,.9,SILVER)
    b.box(1.05,1.6,34.62,.09,.09,.18,RED)
    b.box(3.6,.7,30.45,.85,.85,.55,GREEN,bevel=.04)
    return b


def main():
    OUT.mkdir(parents=True,exist_ok=True);PUBLIC.mkdir(parents=True,exist_ok=True)
    previous=bpy.context.window.scene
    old=bpy.data.scenes.get(SCENE)
    if old:
        if old.get('generator')!='scripts/build-media-tower.py' or old==previous:
            raise RuntimeError('Generated scene is active or not owned by this builder')
        for collection in list(old.collection.children):
            for obj in list(collection.objects):
                data=obj.data;bpy.data.objects.remove(obj,do_unlink=True)
                if isinstance(data,bpy.types.Mesh) and not data.users:bpy.data.meshes.remove(data)
            bpy.data.collections.remove(collection)
        bpy.data.scenes.remove(old)
        for mat in list(bpy.data.materials):
            if (mat.name.startswith(PREFIX) or mat.name.startswith('CBR1_Concrete_MediaTower')) and not mat.users:
                bpy.data.materials.remove(mat)
        for image in list(bpy.data.images):
            if image.name.startswith(PREFIX) and not image.users:bpy.data.images.remove(image)
    scene=bpy.data.scenes.new(SCENE);scene['generator']='scripts/build-media-tower.py'
    scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
    bpy.context.window.scene=scene
    try:
        module=builder_module();mats,specs=materials()
        collection=bpy.data.collections.new(PREFIX+'Model');scene.collection.children.link(collection)
        root=build(module).finish(collection,mats)
        bpy.context.view_layer.update()
        points=[obj.matrix_world@v.co for obj in root.children for v in obj.data.vertices]
        lo=Vector([min(p[i] for p in points) for i in range(3)])
        hi=Vector([max(p[i] for p in points) for i in range(3)])
        delta=Vector((-(lo.x+hi.x)/2,-(lo.y+hi.y)/2,-lo.z))
        for obj in root.children:
            for v in obj.data.vertices:v.co+=delta
            obj.data.update();obj.select_set(True)
        root.select_set(True);bpy.context.view_layer.objects.active=root
        path=PUBLIC/'media-tower.glb'
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,use_active_scene=True,
            export_apply=True,export_animations=False,export_cameras=False,export_lights=False,
            export_materials='EXPORT',export_image_format='AUTO',export_yup=True)
        # Direct texture links keep the original image bytes. Preserve authored tint factors.
        raw=path.read_bytes();length=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+length])
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
            'bytes':path.stat().st_size,'sourcePortraitSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
            'portrait':'Original approved concept embedded, projective UVs; no regenerated face',
            'source':str(OUT/'media-tower.blend')}
        scene.world=bpy.data.worlds.new(PREFIX+'World');scene.world.use_nodes=True
        scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.075,.10,.13,1)
        scene.world.node_tree.nodes['Background'].inputs[1].default_value=.4
        bpy.data.libraries.write(str(OUT/'media-tower.blend'),{scene},fake_user=True,compress=True)
        (OUT/'metrics.json').write_text(json.dumps(metrics,indent=2),encoding='utf8')
        return metrics
    finally:bpy.context.window.scene=previous


if __name__=='__main__':print(json.dumps(main(),indent=2))
