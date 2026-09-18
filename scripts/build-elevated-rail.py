"""Blender-authored modular elevated transit, matching the owner's Base reference.

Run main() in the existing Blender instance. Uses the proven metric-UV mesh
builder, creates its own scene, exports four joined-by-material prototypes.
Original scenes, selection and open .blend remain untouched.
"""
from pathlib import Path
import importlib.util
import json
import math
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/elevated-rail/v1'
PUBLIC = ROOT / 'public/base/models/elevated-rail-v1.glb'
PREFIX = 'CBRail_'
CONCRETE, STEEL, BODY, ALLOY, WINDOW, AMBER, CYAN, WHITE, RED = range(9)
SPECS = [
    ('Concrete', (.33975,.3465,.3555,1), .94, 0, 0),
    ('BlackSteel', (.023,.031,.035,1), .7, .6, 0),
    ('MidnightBody', (.075,.11,.14,1), .48, .72, 0),
    ('WornAlloy', (.3,.33,.34,1), .52, .76, 0),
    ('WarmWindows', (.34,.23,.12,1), .3, .15, .65),
    ('AmberSignal', (1,.48,.15,1), .4, 0, 2.4),
    ('CyanGuide', (.24,.69,1,1), .4, .1, 2.1),
    ('Headlight', (.72,.9,1,1), .35, 0, 3),
    ('RedSignal', (.8,.055,.035,1), .4, 0, 2),
]


def builder_module():
    spec = importlib.util.spec_from_file_location('rail_mesh_helpers', ROOT/'scripts/build-reference-buildings.py')
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    module.PREFIX = PREFIX; module.SPECS = SPECS
    return module


def materials():
    surface = bpy.data.images.load(str(ROOT/'output/building-models/v1/surface.png'), check_existing=False)
    concrete = bpy.data.images.load(str(ROOT/'output/building-models/v1/cold-concrete.png'), check_existing=False)
    surface.name=PREFIX+'Weathering';concrete.name=PREFIX+'ConcreteMap'
    surface.pack();concrete.pack()
    mats=[]
    for name,color,rough,metal,emission in SPECS:
        mat=bpy.data.materials.new(PREFIX+name);mat.use_nodes=True;mat.diffuse_color=color
        p=mat.node_tree.nodes.get('Principled BSDF')
        p.inputs['Base Color'].default_value=color;p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
        if emission:
            p.inputs['Emission Color'].default_value=color;p.inputs['Emission Strength'].default_value=emission
        else:
            tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=concrete if name=='Concrete' else surface
            tint=mat.node_tree.nodes.new('ShaderNodeMixRGB');tint.blend_type='MULTIPLY';tint.inputs[0].default_value=1;tint.inputs[2].default_value=color
            mat.node_tree.links.new(tex.outputs['Color'],tint.inputs[1]);mat.node_tree.links.new(tint.outputs[0],p.inputs['Base Color'])
        mats.append(mat)
    return mats


def deck(B):
    b=B('RailDeck')
    # Eight-metre repeat: chamfered concrete box girder with two exposed rails.
    b.box(0,0,-.55,8,4.4,1.1,CONCRETE,.07)
    b.box(0,0,-1.05,8,2.5,.1,STEEL)
    b.box(0,0,.025,8,3.7,.05,STEEL)
    for x in [-3.6,-2.8,-2,-1.2,-.4,.4,1.2,2,2.8,3.6]:
        b.box(x,0,.075,.15,2.35,.08,ALLOY)
    for y in [-.82,.82]:
        b.box(0,y,.145,8,.105,.09,ALLOY)
    for side in [-1,1]:
        y=side*2.07
        b.box(0,y,.17,8,.26,.3,STEEL,.025)
        b.box(0,y+side*.143,.24,8,.025,.035,CYAN)
        b.box(0,side*2.213,-.45,8,.028,.18,STEEL)
        b.box(0,side*2.233,-.45,5.8,.02,.055,AMBER)
        for x in [-3.95,0,3.95]:
            b.box(x,side*2.207,-.55,.036,.025,.93,STEEL)
        for x in [-3.4,3.4]:
            b.box(x,y,.48,.16,.2,.56,ALLOY,.015)
            b.box(x,y,.79,.2,.23,.08,RED)
    # Maintenance conduit and bolted underside ribs.
    for y in [-1.65,1.65]:b.tube((-4,y,-.98),(4,y,-.98),.06,STEEL,6)
    return b


def pier(B):
    b=B('RailPier')
    b.box(0,0,.22,2.85,3.0,.44,CONCRETE,.1)
    b.box(0,0,.84,2.15,2.3,.8,STEEL,.09)
    b.box(0,0,7.5,1.65,1.95,12.5,CONCRETE,.12)
    # Panel recesses, dark collars, vertical light insets, chunky capital.
    for z in [1.4,5.5,9.5,13.3]:b.box(0,0,z,1.78,2.07,.24,STEEL,.04)
    for side in [-1,1]:
        y=side*.985
        b.box(0,y,7.7,.85,.035,10.8,STEEL)
        for x in [-.51,.51]:
            b.box(x,y+side*.025,7.7,.065,.035,10.2,ALLOY)
            for z in [2.0,4.3,7.7,11.2,12.8]:b.box(x,y+side*.05,z,.045,.022,.68 if z==7.7 else 1.15,AMBER)
        for z in [3.2,6.5,10.5]:
            b.box(0,y+side*.03,z,.48,.04,.07,ALLOY)
        b.box(0,y+side*.03,1.5,.68,.08,.27,AMBER)
    b.box(0,0,13.6,2.0,2.7,.55,CONCRETE,.09)
    b.box(0,-1.5,14.35,2.1,7.5,.95,CONCRETE,.08)
    for y in [-4.5,-1.5]:b.box(0,y,14.95,1.6,.8,.1,STEEL)
    return b


def shell(b, sections, mat=BODY):
    # Eight planar facets around each cross-section: low-poly aerodynamic shell.
    rings=[]
    for x,w,top,bottom in sections:
        rings.append([(x,-w*.76,bottom),(x,w*.76,bottom),(x,w,bottom+.25),
                      (x,w,top-.36),(x,w*.74,top),(x,-w*.74,top),
                      (x,-w,top-.36),(x,-w,bottom+.25)])
    b.face(list(reversed(rings[0])),mat);b.face(rings[-1],mat)
    for left,right in zip(rings,rings[1:]):
        for i in range(8):j=(i+1)%8;b.face([left[i],left[j],right[j],right[i]],mat)


def train(B, cab):
    b=B('TrainCar' if cab else 'TrainMiddle')
    if cab:
        sections=[(-4.5,1.08,2.75,.38),(-4.15,1.25,2.92,.32),(2.7,1.25,2.92,.32),(3.65,1.04,2.18,.36),(4.5,.66,1.05,.43)]
    else:
        sections=[(-4.5,1.08,2.75,.38),(-4.15,1.25,2.92,.32),(4.15,1.25,2.92,.32),(4.5,1.08,2.75,.38)]
    shell(b,sections)
    body_end=2.7 if cab else 4.12
    center=(-4.12+body_end)/2;length=body_end+4.12
    for side in [-1,1]:
        y=side*1.257
        # Inset black glazing band, separated amber panes and substantial doors.
        b.box(center,y,1.91,length,.045,1.08,STEEL)
        xs=[-3.62,-2.71,-.88,.02,1.83] if cab else [-3.62,-2.71,-.88,.02,1.83,2.74,3.64]
        for x in xs:
            b.box(x,y+side*.029,1.97,.73,.02,.74,WINDOW)
            # Dark lower silhouettes and a fine upper lamp give each pane depth.
            b.box(x+.16,y+side*.042,1.65,.22,.014,.14,STEEL)
            b.box(x,y+side*.043,2.29,.59,.013,.025,AMBER)
        for x in [-1.8,.93]:
            b.box(x,y+side*.01,1.62,.78,.065,1.97,ALLOY,.04)
            b.box(x,y+side*.05,1.64,.66,.025,1.84,STEEL)
            for shift in [-.17,.17]:b.box(x+shift,y+side*.07,2.02,.26,.02,.6,WINDOW)
            b.box(x,y+side*.085,1.58,.025,.025,1.72,ALLOY)
            b.box(x+.46,y+side*.08,1.32,.055,.02,.09,AMBER)
            b.box(x,y+side*.08,.58,.83,.12,.045,ALLOY)
        b.box(center,y,1.2,length,.05,.075,ALLOY)
        b.box(center,y+side*.032,.89,length,.025,.045,CYAN)
        b.box(center,y,.61,length,.06,.12,STEEL)
        for x in [-3.4,-.6,2.1]:
            b.box(x,y+side*.04,.7,.055,.015,.085,ALLOY)
        # A small operator number and line badge on the broad panel.
        if side==-1:
            b.text('CB / 07',-2.9,y-.064,1.15,.68,ALLOY,.12)
    # Bogies, hubs and suspension: bottom of wheel exactly zero.
    for x in [-2.9,2.6]:
        b.box(x,0,.35,1.6,1.9,.42,STEEL,.08)
        for xx in [x-.49,x+.49]:
            b.tube((xx,-1.05,.26),(xx,1.05,.26),.26,STEEL,10)
            for side in [-1,1]:b.tube((xx,side*1.052,.26),(xx,side*1.078,.26),.14,ALLOY,8)
    # Roof service pods and ribbed HVAC; no unnecessary hidden interior mesh.
    for x in [-2.5,.15]:
        b.box(x,0,2.98,1.65,1.36,.19,STEEL,.05)
        for xx in [x-.55,x-.33,x-.11,x+.11,x+.33,x+.55]:b.box(xx,0,3.084,.075,1.05,.025,ALLOY)
    for y in [-.9,.9]:b.box(center,y,2.89,length,.05,.045,ALLOY)
    # Rear gangway/buffer connection, attached as real geometry.
    for x in ([-4.56] if cab else [-4.56,4.56]):
        b.box(x,0,1.45,.12,1.5,2.1,STEEL,.07)
        for yy in [-.65,-.4,-.15,.15,.4,.65]:b.box(x*1.009,yy,1.45,.03,.045,1.96,ALLOY)
        b.box(x*1.034,0,.5,.22,.4,.2,ALLOY)
    if cab:
        # Sloped windscreen follows the nose section, framed by slim light rails.
        b.face([(2.89,-.82,2.791),(3.62,-.71,2.235),(3.62,.71,2.235),(2.89,.82,2.791)],STEEL)
        b.tube((2.91,0,2.79),(3.63,0,2.24),.018,ALLOY,4)
        for side in [-1,1]:
            b.tube((2.72,side*1.26,2.55),(3.65,side*1.055,1.82),.035,CYAN,6)
            b.tube((3.65,side*1.055,1.82),(4.505,side*.665,.7),.035,WHITE,6)
            b.box(4.525,side*.36,.78,.04,.31,.13,WHITE,.012)
        b.box(4.51,0,.63,.055,.8,.14,STEEL,.02)
    return b


def main():
    OUT.mkdir(parents=True,exist_ok=True);PUBLIC.parent.mkdir(parents=True,exist_ok=True)
    previous=bpy.context.window.scene
    name='CyberBase Elevated Rail V1'
    if bpy.data.scenes.get(name):
        raise RuntimeError('Generated rail scene exists; keep it and choose a new revision before regenerating')
    scene=bpy.data.scenes.new(name);scene['generator']='scripts/build-elevated-rail.py'
    scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
    bpy.context.window.scene=scene
    helpers=builder_module();mats=materials();roots=[];stats={}
    try:
        for build in [deck,pier,lambda B:train(B,True),lambda B:train(B,False)]:
            b=build(helpers.Builder);collection=bpy.data.collections.new(PREFIX+b.name);scene.collection.children.link(collection)
            root=b.finish(collection,mats);roots.append(root)
            if root.name=='RailPier':
                for obj in root.children:
                    for vertex in obj.data.vertices:vertex.co.z*=.92
                    obj.data.update()
            points=[v.co for o in root.children for v in o.data.vertices]
            stats[root.name]={'dimensions':[round(max(p[i] for p in points)-min(p[i] for p in points),4) for i in range(3)],'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in root.children),'draws':len(root.children)}
        bpy.context.view_layer.update()
        for o in scene.objects:o.select_set(True)
        bpy.context.view_layer.objects.active=roots[0]
        bpy.ops.export_scene.gltf(filepath=str(PUBLIC),export_format='GLB',use_selection=True,use_active_scene=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False,export_materials='EXPORT',export_image_format='JPEG',export_image_quality=85,export_jpeg_quality=85,export_yup=True)
        helpers.patch_factors(PUBLIC)
        # Spread prototypes apart in editable source; runtime GLB keeps all local origins zero.
        for root,x in zip(roots,[-16,0,16,29]):root.location.x=x
        scene.world=bpy.data.worlds.new(PREFIX+'World');scene.world.use_nodes=True
        scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.1,.13,.16,1)
        scene.world.node_tree.nodes['Background'].inputs[1].default_value=.45
        scene.render.threads_mode='FIXED';scene.render.threads=4
        bpy.data.libraries.write(str(OUT/'cyberbase-elevated-rail-v1.blend'),{scene},fake_user=True,compress=True)
        stats['bytes']=PUBLIC.stat().st_size
        (OUT/'metrics.json').write_text(json.dumps(stats,indent=2),encoding='utf8')
        return {'scene':scene.name,'file':str(PUBLIC),'metrics':stats}
    finally:bpy.context.window.scene=previous


if __name__=='__main__':
    print(json.dumps(main(),indent=2))
