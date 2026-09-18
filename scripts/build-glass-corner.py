"""Approved second concept -> a portable, material-batched Blender game prop.

Run with Blender --background --factory-startup --threads 4 --python this-file.
Only the builder's own scene is authored. The approved PNG remains byte-identical;
projective facade UVs preserve its advertising while the shell/hardware are real 3D.
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
OUT = ROOT / 'output/building-models/glass-corner-v1'
PUBLIC = ROOT / 'public/game/buildings/glass-corner-v1'
SOURCE = ROOT / 'output/building-concepts/2026-09-18-glass-neon-v1/02-glass-corner.png'
PREFIX = 'CBC1_'
SCENE = 'CyberBase Glass Corner V1'
CONCRETE, STEEL, GREEN, RED, GLASS, WARM, GLOW, SILVER, MEDIA, CYAN = range(10)
FOOTPRINT = [(-7.2,-3.8),(-5.6,-5.4),(7.2,-5.4),(7.2,4.8),(-7.2,4.8)]


def module_at(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def materials():
    tower = module_at('corner_material_source', ROOT/'scripts/build-media-tower.py')
    tower.OUT, tower.SOURCE, tower.PREFIX = OUT, SOURCE, PREFIX
    mats, specs = tower.materials()
    mats[CONCRETE].name = 'CBR1_Concrete_GlassCorner'
    mats[MEDIA].node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value = .68
    cyan = bpy.data.materials.new(PREFIX+'HologramCyan')
    cyan.use_nodes = True
    cyan.diffuse_color = (.025,.65,.82,1)
    bsdf = cyan.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = cyan.diffuse_color
    bsdf.inputs['Emission Color'].default_value = cyan.diffuse_color
    bsdf.inputs['Emission Strength'].default_value = 2.4
    bsdf.inputs['Roughness'].default_value = .4
    mats.append(cyan)
    specs.append(('HologramCyan',tuple(cyan.diffuse_color),.4,0,2.4))
    return mats, specs


def facade(b, a, c, quad, nu=12, nv=16):
    """Planar building panel -> approved picture, with perspective-correct source UVs."""
    source = [(x/1254,1-y/1254) for x,y in (quad[3],quad[2],quad[1],quad[0])]
    rows, values = [], []
    for (u,v),(x,y) in zip([(0,0),(1,0),(1,1),(0,1)],source):
        rows.extend([[u,v,1,0,0,0,-x*u,-x*v],[0,0,0,u,v,1,-y*u,-y*v]])
        values.extend([x,y])
    h = np.append(np.linalg.solve(np.array(rows),np.array(values)),1).reshape(3,3)
    def point(u,v): return (a[0]+(c[0]-a[0])*u,a[1]+(c[1]-a[1])*u,5.2+12.9*v)
    def uv(u,v):
        q = h @ np.array([u,v,1])
        return tuple(q[:2]/q[2])
    for j in range(nv):
        for i in range(nu):
            coords = [(i/nu,j/nv),((i+1)/nu,j/nv),((i+1)/nu,(j+1)/nv),(i/nu,(j+1)/nv)]
            b.face([point(*p) for p in coords],MEDIA,[uv(*p) for p in coords])


def outline(b,z,r=.055,mat=STEEL):
    for i,a in enumerate(FOOTPRINT):
        c=FOOTPRINT[(i+1)%len(FOOTPRINT)]
        b.tube((*a,z),(*c,z),r,mat,4)


def hologram(b):
    # Open luminous strokes, no solid bottle and no transparent billboard layers.
    # The icon hangs 0.9 m in front of the entrance on a small physical projector.
    cx,cy,cz=1.65,-6.28,4.05
    def point(x,z): return (cx+x+.2*z,cy,cz+z)
    def stroke(points,mat=GLOW,r=.022):
        for a,c in zip(points,points[1:]): b.tube(point(*a),point(*c),r,mat,4)
    for side in [-1,1]: stroke([(side*.42,-.78),(side*.48,-.62),(side*.48,.66),(side*.34,.8)])
    for z,w in [(-.76,.41),(.78,.36),(1.01,.21)]:
        stroke([(w*math.cos(t),z+.085*math.sin(t)) for t in np.linspace(0,math.tau,25)])
    stroke([(-.21,.81),(-.21,1.01)]);stroke([(.21,.81),(.21,1.01)])
    for z in np.linspace(-.61,.61,15):
        stroke([(-.36,z),(.36,z)],GLOW,.009)
    for offset in [0,math.pi]:
        stroke([(1.24*math.cos(t),.7*math.sin(t)) for t in np.linspace(offset+.18,offset+2.65,19)],CYAN,.018)
    for x,z in [(-1.3,.58),(.83,-.53),(-.8,-.94),(1.17,.7)]:
        stroke([(x,z),(x+.26,z)],CYAN if x<0 else GLOW,.015)
    b.box(-.12,-5.63,3.94,.66,.3,.9,GREEN,bevel=.045)
    b.tube((-.1,-5.75,4.05),(.18,-6.08,4.05),.13,STEEL,8)
    b.tube((.18,-6.08,4.05),(.3,-6.23,4.05),.10,CYAN,8)


def build(module):
    b=module.Builder(PREFIX+'GlassCorner')
    # Grounded five-sided closed shell with a real cut corner and flat usable roof.
    for i,a in enumerate(FOOTPRINT):
        c=FOOTPRINT[(i+1)%len(FOOTPRINT)]
        b.face([(*a,0),(*c,0),(*c,5.2),(*a,5.2)],CONCRETE)
    b.face([(x,y,0) for x,y in reversed(FOOTPRINT)],CONCRETE)
    b.face([(x,y,18.1) for x,y in FOOTPRINT],SILVER)
    facade(b,(-5.6,-5.4),(7.2,-5.4),[(646,243),(1014,181),(1014,720),(646,781)])
    facade(b,(-7.2,-3.8),(-5.6,-5.4),[(484,230),(646,243),(646,781),(483,744)],6,16)
    facade(b,(-7.2,4.8),(-7.2,-3.8),[(256,165),(484,230),(483,744),(256,667)],10,16)
    # Remaining elevations are complete glass walls, with real mullions and office panes.
    b.face([(7.2,-5.4,5.2),(7.2,4.8,5.2),(7.2,4.8,18.1),(7.2,-5.4,18.1)],GLASS)
    b.face([(7.2,4.8,5.2),(-7.2,4.8,5.2),(-7.2,4.8,18.1),(7.2,4.8,18.1)],GLASS)
    for z in [5.2,8.42,11.65,14.87,18.1]: outline(b,z,.065)
    for x,y in FOOTPRINT: b.box(x,y,11.65,.095,.095,12.9,STEEL)
    for x in np.linspace(-7.2,7.2,13): b.box(x,4.82,11.65,.055,.09,12.9,STEEL)
    for y in np.linspace(-5.4,4.8,10): b.box(7.22,y,11.65,.09,.055,12.9,STEEL)
    for row,col in [(0,1),(0,8),(1,5),(2,3),(3,9)]:
        x=-6.6+col*1.2; z=6.81+row*3.225
        b.box(x,4.855,z,1.07,.025,2.94,WARM)
        for dz in [-.5,-.25,0,.25,.5]: b.box(x,4.875,z+dz,1.06,.02,.025,STEEL)
    for row,col in [(0,2),(1,7),(2,4),(3,1)]:
        b.box(7.255,-4.84+col*1.133,6.81+row*3.225,.025,1.02,2.94,WARM)
    # Foundation stays within the building footprint, not a large unwalkable diorama pad.
    b.box(0,-.3,.12,14.9,10.85,.24,CONCRETE,bevel=.035)
    for z in [1.7,3.4,5.1]: outline(b,z,.016)
    for x in [-5.3,-3.3,-1.4,.5,2.7,4.8,6.9]: b.box(x,-5.422,2.6,.022,.025,5.1,STEEL)
    for y in [-3.4,-1.4,.6,2.6,4.5]: b.box(-7.222,y,2.6,.025,.022,5.1,STEEL)
    # Human-scale recessed shop entrance, service shutter and meter cabinets.
    b.front(1.6,-5.445,1.65,2.95,3.05,STEEL,.04)
    b.front(1.6,-5.49,1.65,2.58,2.82,WARM,.04)
    b.frame(1.6,-5.55,1.65,2.71,2.94,SILVER,.065,.11)
    b.box(1.6,-5.61,1.65,.065,.1,2.8,STEEL)
    for x in [1.43,1.77]: b.box(x,-5.69,1.57,.028,.05,.42,SILVER)
    b.box(1.6,-5.7,3.26,3.27,.78,.18,STEEL,bevel=.035)
    b.lamp(1.6,-5.57,3.16,2.5,.085)
    b.vent(5.35,-5.5,1.95,1.8,1.65,9)
    b.vent(5.58,-5.5,4.1,1.36,.8,6)
    b.front(-3.05,-5.47,1.56,1.28,2.86,GREEN)
    b.frame(-3.05,-5.54,1.56,1.35,2.94,STEEL,.07,.12)
    b.box(-2.68,-5.65,1.55,.035,.035,.24,SILVER)
    b.vent(-3.15,-5.5,4.12,1.27,1.0,7)
    for x,z in [(-.58,1.1),(-4.7,3.78),(6.65,3.8)]:
        b.box(x,-5.52,z,.46,.19,.62,GREEN,bevel=.025)
        b.lamp(x+.11,-5.64,z+.17,.04,.035)
    for y in [-2.6,3.5]:
        b.box(-7.31,y,2.6,.2,.62,1.1,GREEN,bevel=.035)
        b.pipe([(-7.34,y,.25),(-7.34,y,4.75),(-7.34,y+.4,5.0)],.045,STEEL,6)
    # A loading entrance and grilles also give the rear a finished service elevation.
    b.box(.8,4.86,1.75,2.35,.08,3.25,STEEL)
    for z in np.arange(.25,3.35,.23): b.box(.8,4.93,z,2.2,.065,.055,SILVER)
    for x in [-4,4.2]: b.box(x,4.87,2.5,1.4,.14,1.05,GREEN)
    hologram(b)
    # Three modest drooping wires with insulators, all attached within this model's bounds.
    for x in [-5.47,7.07]:
        b.box(x,-5.57,8.28,.47,.26,1.25,GREEN,bevel=.025)
        for z in [7.94,8.5]:
            b.tube((x,-5.62,z),(x,-5.97,z),.065,SILVER,6)
            b.tube((x,-5.97,z),(x,-6.04,z),.105,STEEL,8)
        b.lamp(x,-5.74,8.7,.07,.07)
    for k in range(3):
        pts=[(-5.47+12.54*t,-6.01,8.56-k*.25-1.06*4*t*(1-t)) for t in np.linspace(0,1,23)]
        for a,c in zip(pts,pts[1:]): b.tube(a,c,.026,STEEL,5)
    # Roof terrace, two fan housings, handrails and antennas.
    outline(b,18.15,.115,SILVER)
    inset=[(x*.965,y*.95) for x,y in FOOTPRINT]
    for i,a in enumerate(inset):
        c=inset[(i+1)%len(inset)]
        b.tube((*a,18.84),(*c,18.84),.027,STEEL,5)
        steps=math.ceil(math.dist(a,c)/1.85)
        for t in np.linspace(0,1,steps+1):
            x=a[0]+(c[0]-a[0])*t;y=a[1]+(c[1]-a[1])*t
            b.tube((x,y,18.22),(x,y,18.84),.025,STEEL,5)
    for x in np.arange(-6,7,1.8): b.box(x,-.2,18.11,.013,9.8,.012,STEEL)
    for y in np.arange(-4,5,1.8): b.box(.2,y,18.115,13.5,.013,.012,STEEL)
    b.box(-3.3,2.65,19.1,4.8,2.65,1.85,SILVER,bevel=.06)
    b.vent(-3.3,1.27,19.1,4.25,1.43,9)
    b.box(-2.7,.65,18.68,1.65,1.1,1.1,GREEN,bevel=.045)
    for x in [-4.52,-2.1]:
        b.tube((x,2.65,20.025),(x,2.65,20.12),.87,STEEL,16)
        # Thin rim + crossed fan bars; center remains visibly recessed.
        pts=[(x+.8*math.cos(t),2.65+.8*math.sin(t),20.13) for t in np.linspace(0,math.tau,25)]
        for a,c in zip(pts,pts[1:]): b.tube(a,c,.025,SILVER,4)
        for i in range(6):
            a=i*math.tau/6
            b.tube((x,2.65,20.14),(x+.73*math.cos(a),2.65+.73*math.sin(a),20.14),.025,SILVER,4)
    b.box(3.4,2.3,18.59,2.1,2.0,.84,GREEN,bevel=.045)
    for x,y,top in [(.25,2.2,21.05),(1,2.5,20.55),(1.65,2.55,19.7)]:
        b.box(x,y,18.31,.32,.32,.32,STEEL)
        b.tube((x,y,18.3),(x,y,top),.03,STEEL,6)
    b.box(.42,2.2,19.65,.32,.17,1.2,SILVER)
    b.box(.25,2.2,21.05,.09,.09,.17,RED)
    return b


def review(scene):
    center=Vector((0,0,10.2))
    for name,pos,power,color,size in [('Key',(-20,-26,34),6200,(.72,.84,1),18),
            ('Fill',(22,-16,24),3200,(1,.79,.54),16),('Rim',(5,22,32),8000,(.53,.74,1),16)]:
        data=bpy.data.lights.new(PREFIX+name,'AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size
        obj=bpy.data.objects.new(data.name,data);scene.collection.objects.link(obj);obj.location=pos
        obj.rotation_euler=(center-obj.location).to_track_quat('-Z','Y').to_euler()
    data=bpy.data.cameras.new(PREFIX+'ReviewCamera');cam=bpy.data.objects.new(data.name,data)
    scene.collection.objects.link(cam);scene.camera=cam
    cam.location=(-30,-46,32);cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
    data.type='ORTHO';data.ortho_scale=29
    scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
    scene.render.threads_mode='FIXED';scene.render.threads=4
    scene.render.resolution_x=1100;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG'
    scene.render.filepath=str(OUT/'blender-review.png')
    bpy.ops.render.render(write_still=True)


def main():
    OUT.mkdir(parents=True,exist_ok=True);PUBLIC.mkdir(parents=True,exist_ok=True)
    scene=bpy.data.scenes.new(SCENE);scene['generator']='scripts/build-glass-corner.py'
    scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
    previous=bpy.context.window.scene;bpy.context.window.scene=scene
    try:
        module=module_at('corner_geometry',ROOT/'scripts/build-reference-buildings.py')
        mats,specs=materials();module.SPECS=specs
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
        path=PUBLIC/'glass-corner.glb'
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
            'source':str(OUT/'glass-corner.blend')}
        scene.world=bpy.data.worlds.new(PREFIX+'World');scene.world.use_nodes=True
        scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.075,.1,.13,1)
        scene.world.node_tree.nodes['Background'].inputs[1].default_value=.4
        bpy.data.libraries.write(str(OUT/'glass-corner.blend'),{scene},fake_user=True,compress=True)
        (OUT/'metrics.json').write_text(json.dumps(metrics,indent=2),encoding='utf8')
        print(json.dumps(metrics,indent=2))
        review(scene)
    finally:bpy.context.window.scene=previous


if __name__=='__main__':main()
