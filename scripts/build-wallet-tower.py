"""Approved slim Coinbase wallet tower, static low-poly game asset.

Run Blender --background --factory-startup --threads 4 --python this-file.
Uses original concept pixels; the closed-perimeter ribbon is a separate mesh.
No animations, lights or scripts are exported into the runtime model.
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
OUT = ROOT / 'output/building-models/wallet-tower-v1'
PUBLIC = ROOT / 'public/game/buildings/wallet-tower-v1'
SOURCE = ROOT / 'output/building-concepts/2026-09-18-japan-wallet-v1/02-wallet-tower.png'
PREFIX = 'CBW1_'
CONCRETE, STEEL, GREEN, RED, GLASS, WARM, GLOW, SILVER, MEDIA, RIBBON, CYAN = range(11)
FOOTPRINT = [(-3.7,-2.8),(-3.2,-3.3),(3.2,-3.3),(3.7,-2.8),(3.7,3.3),(-3.7,3.3)]


def module_at(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def materials():
    source = module_at('wallet_material_source', ROOT/'scripts/build-media-tower.py')
    source.OUT, source.SOURCE, source.PREFIX = OUT, SOURCE, PREFIX
    mats, specs = source.materials()
    mats[CONCRETE].name = 'CBR1_Concrete_WalletTower'
    mats[MEDIA].node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value = .55
    specs[MEDIA] = ('ApprovedMedia',(1,1,1,1),.36,.25,.55)
    ribbon = mats[MEDIA].copy();ribbon.name=PREFIX+'StaticHologramRibbon'
    node=ribbon.node_tree.nodes.get('Principled BSDF')
    node.inputs['Alpha'].default_value=.84
    node.inputs['Emission Strength'].default_value=1.35
    node.inputs['Roughness'].default_value=.5
    node.inputs['Metallic'].default_value=0
    ribbon.surface_render_method='DITHERED'
    mats.append(ribbon);specs.append(('StaticHologramRibbon',(1,1,1,.84),.5,0,1.35))
    cyan=bpy.data.materials.new(PREFIX+'BlueContour');cyan.use_nodes=True
    cyan.diffuse_color=(.012,.28,1,1)
    node=cyan.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value=cyan.diffuse_color
    node.inputs['Emission Color'].default_value=cyan.diffuse_color
    node.inputs['Emission Strength'].default_value=2
    mats.append(cyan);specs.append(('BlueContour',tuple(cyan.diffuse_color),.4,0,2))
    return mats,specs


def panel(b, a, c, z0, z1, quad, mat=MEDIA, nu=8, nv=12):
    """Perspective-correct approved facade crop onto a real vertical building plane."""
    uv=[(x/1024,1-y/1536) for x,y in (quad[3],quad[2],quad[1],quad[0])]
    rows,values=[],[]
    for (u,v),(x,y) in zip([(0,0),(1,0),(1,1),(0,1)],uv):
        rows.extend([[u,v,1,0,0,0,-x*u,-x*v],[0,0,0,u,v,1,-y*u,-y*v]])
        values.extend([x,y])
    hom=np.append(np.linalg.solve(np.array(rows),np.array(values)),1).reshape(3,3)
    for j in range(nv):
        for i in range(nu):
            coords=[(i/nu,j/nv),((i+1)/nu,j/nv),((i+1)/nu,(j+1)/nv),(i/nu,(j+1)/nv)]
            points=[(a[0]+(c[0]-a[0])*u,a[1]+(c[1]-a[1])*u,z0+(z1-z0)*v) for u,v in coords]
            tex=[]
            for u,v in coords:
                q=hom@np.array([u,v,1]);tex.append(tuple(q[:2]/q[2]))
            b.face(points,mat,tex)


def outline(b,z,mat=STEEL,r=.04,points=FOOTPRINT):
    for i,a in enumerate(points):b.tube((*a,z),(*points[(i+1)%len(points)],z),r,mat,4)


def build(module):
    b=module.Builder(PREFIX+'WalletTower')
    # Six-sided tower with restrained chamfers, grounded plinth, closed elevations.
    for i,a in enumerate(FOOTPRINT):
        c=FOOTPRINT[(i+1)%len(FOOTPRINT)]
        b.face([(*a,0),(*c,0),(*c,5.2),(*a,5.2)],CONCRETE)
        b.face([(*a,5.2),(*c,5.2),(*c,29.2),(*a,29.2)],GLASS)
    b.face([(x,y,0) for x,y in reversed(FOOTPRINT)],CONCRETE)
    b.face([(x,y,29.2) for x,y in FOOTPRINT],SILVER)
    b.box(0,0,.1,8.05,7.35,.2,CONCRETE,bevel=.035)
    # Upper / lower glass separated around the ticker: no second baked text underneath.
    front_upper=[(477,213),(687,181),(687,749),(477,793)]
    front_lower=[(477,908),(687,866),(687,1024),(477,1069)]
    left_upper=[(303,181),(428,204),(428,773),(303,721)]
    left_lower=[(303,863),(428,915),(428,1060),(303,1007)]
    panel(b,(-3.2,-3.312),(3.2,-3.312),13.45,29.2,front_upper,nu=12,nv=20)
    panel(b,(-3.2,-3.312),(3.2,-3.312),5.2,10.65,front_lower,nu=12,nv=8)
    for a,c in [((-3.712,3.3),(-3.712,-2.8)),((3.712,-2.8),(3.712,3.3)),((3.7,3.312),(-3.7,3.312))]:
        panel(b,a,c,13.45,29.2,left_upper,nu=8,nv=15)
        panel(b,a,c,5.2,10.65,left_lower,nu=8,nv=6)
    # Chamfers use the narrow adjacent glass strip, so the front logo is undistorted.
    for a,c in [((-3.705,-2.805),(-3.205,-3.305)),((3.205,-3.305),(3.705,-2.805))]:
        panel(b,a,c,13.45,29.2,[(435,207),(469,213),(469,792),(435,779)],nu=2,nv=16)
        panel(b,a,c,5.2,10.65,[(435,918),(469,910),(469,1069),(435,1063)],nu=2,nv=6)
    for z in [5.2,10.65,13.45,29.2]:outline(b,z,r=.055)
    for x,y in FOOTPRINT:b.box(x*1.003,y*1.003,17.2,.065,.065,24,STEEL)
    for z in [1.7,3.4,5.05]:outline(b,z,r=.012)
    for x in [-2.5,-1.3,.15,1.55,2.8]:b.box(x,-3.325,2.65,.017,.023,5.1,STEEL)
    for y in [-2,0,2]:
        for x in [-3.717,3.717]:b.box(x,y,2.6,.018,.02,5.1,STEEL)
    # Human-scale entrance and industrial base details, independent of facade photo.
    b.front(.65,-3.36,1.68,2.09,2.92,STEEL)
    panel(b,(-.31,-3.412),(1.61,-3.412),.25,3.08,[(548,1185),(614,1173),(613,1310),(548,1324)],nu=4,nv=6)
    b.frame(.65,-3.46,1.67,2.01,2.89,SILVER,.055,.08)
    b.box(.65,-3.50,1.67,.055,.06,2.7,STEEL)
    for x in [.48,.82]:b.box(x,-3.55,1.56,.025,.035,.35,SILVER)
    b.box(.65,-3.61,3.22,2.34,.66,.13,STEEL,bevel=.025)
    b.lamp(.65,-3.49,3.10,1.9,.065)
    b.vent(-2.07,-3.36,1.55,1.37,1.1,7)
    b.vent(-2.14,-3.36,3.76,1.05,.8,5)
    for x,z in [(2.75,1.35),(2.65,3.9),(-.62,4.37)]:
        b.box(x,-3.43,z,.36,.2,.62,GREEN,bevel=.025)
        b.lamp(x,-3.54,z+.15,.03,.028)
    b.box(0,3.36,1.62,1.25,.12,2.9,GREEN)
    b.box(0,3.44,3.17,1,.1,.07,GLOW)
    for x in [-2.2,2.1]:
        b.pipe([(x,3.36,.2),(x,3.36,5.03),(x+.24,3.36,5.17)],.042,STEEL,5)
    for y in [-1.8,1.8]:
        for x in [-3.78,3.78]:
            b.box(x,y,2.2,.16,.66,.98,GREEN,bevel=.025)
            b.pipe([(x,y,.25),(x,y,4.75),(x,y+.27,5.08)],.045,STEEL,6)
    # Compact drooping cable bundle on service side, below the advertising band.
    for k in range(3):
        pts=[(3.84,-2.35+4.7*t,7.65-k*.18-.6*4*t*(1-t)) for t in np.linspace(0,1,17)]
        for a,c in zip(pts,pts[1:]):b.tube(a,c,.021,STEEL,5)
    for y in [-2.35,2.35]:b.box(3.84,y,7.4,.24,.36,.92,GREEN,bevel=.025)
    # A separate closed perimeter ribbon. Opaque glass underneath avoids layered rooms.
    # UV0 uses exact source artwork; UV1 is a continuous perimeter coordinate for later motion.
    band=[(-4.0,-2.9),(-3.35,-3.6),(3.35,-3.6),(4,-2.9),(4,3.6),(-4,3.6)]
    ribbon_crop=[(432,811),(681,768),(681,860),(432,903)]
    edge_crop=[(477,808),(483,807),(483,894),(477,895)]
    for i,a in enumerate(band):
        c=band[(i+1)%len(band)]
        panel(b,a,c,10.7,13.4,edge_crop if i in [0,2] else ribbon_crop,RIBBON,2 if i in [0,2] else 12,4)
    for z in [10.7,13.4]:outline(b,z,CYAN,.015,band)
    for x,y in band:
        b.box(x,y,13.44,.2,.2,.28,GREEN,bevel=.024)
        b.box(x,y,10.7,.19,.19,.23,GREEN,bevel=.024)
        b.box(x,y-.105,13.46,.055,.014,.065,CYAN)
        b.tube((x*.925,y*.917,13.4),(x,y,13.4),.026,STEEL,5)
    # Thin rooftop parapet, two recessed fans, cooling cabinet and antenna cluster.
    b.box(0,0,29.27,7.6,6.8,.14,SILVER,bevel=.025)
    for y in [-3.05,3.05]:
        b.tube((-3.35,y,29.91),(3.35,y,29.91),.025,STEEL,5)
        for x in [-3.35,-1.65,0,1.65,3.35]:b.tube((x,y,29.35),(x,y,29.91),.022,STEEL,4)
    for x in [-3.35,3.35]:
        b.tube((x,-3.05,29.91),(x,3.05,29.91),.025,STEEL,5)
        for y in [-1.5,0,1.5]:b.tube((x,y,29.35),(x,y,29.91),.022,STEEL,4)
    b.box(-1.38,.9,30.14,3.35,2.14,1.6,SILVER,bevel=.07)
    b.vent(-1.38,-.2,30.14,2.98,1.27,8)
    b.box(-.8,-1.08,29.82,1.22,.9,.96,GREEN,bevel=.04)
    for x in [-2.17,-.61]:
        b.tube((x,.9,30.96),(x,.9,31.03),.64,STEEL,16)
        pts=[(x+.58*math.cos(t),.9+.58*math.sin(t),31.05) for t in np.linspace(0,math.tau,21)]
        for a,c in zip(pts,pts[1:]):b.tube(a,c,.02,SILVER,4)
        for a in np.linspace(0,math.tau,7)[:-1]:b.tube((x,.9,31.045),(x+.5*math.cos(a),.9+.5*math.sin(a),31.045),.022,SILVER,4)
    for x,y,top in [(.9,1.55,32.65),(1.5,1.65,32),(2.2,2.05,30.9)]:
        b.box(x,y,29.49,.25,.25,.3,STEEL)
        b.tube((x,y,29.5),(x,y,top),.028,STEEL,5)
    b.box(1.06,1.55,31.3,.23,.15,.76,SILVER)
    b.box(.9,1.55,32.66,.09,.09,.16,RED)
    b.box(2.15,-.9,29.65,1.05,.86,.61,GREEN,bevel=.04)
    return b,band


def ribbon_uv1(mesh, band, delta):
    layer=mesh.uv_layers.new(name='TickerLoop')
    lengths=[math.dist(a,band[(i+1)%len(band)]) for i,a in enumerate(band)]
    perimeter=sum(lengths)
    for poly in mesh.polygons:
        centre=poly.center-Vector(delta)
        distances=[]
        for i,a in enumerate(band):
            c=band[(i+1)%len(band)];dx,dy=c[0]-a[0],c[1]-a[1]
            t=((centre.x-a[0])*dx+(centre.y-a[1])*dy)/(dx*dx+dy*dy)
            q=(a[0]+min(1,max(0,t))*dx,a[1]+min(1,max(0,t))*dy)
            distances.append(math.dist((centre.x,centre.y),q))
        side=int(np.argmin(distances));a=band[side];c=band[(side+1)%len(band)]
        dx,dy=c[0]-a[0],c[1]-a[1];offset=sum(lengths[:side])
        for loop in poly.loop_indices:
            p=mesh.vertices[mesh.loops[loop].vertex_index].co-Vector(delta)
            t=((p.x-a[0])*dx+(p.y-a[1])*dy)/(dx*dx+dy*dy)
            layer.data[loop].uv=((offset+t*lengths[side])/perimeter,(p.z-10.7)/2.7)


def review(scene):
    centre=Vector((0,0,16))
    for name,pos,power,color,size in [('Key',(-17,-24,37),4400,(.68,.84,1),16),
            ('Fill',(19,-17,24),2400,(1,.79,.57),15),('Rim',(4,20,33),5000,(.5,.72,1),14)]:
        data=bpy.data.lights.new(PREFIX+name,'AREA');data.energy=power;data.color=color;data.size=size
        obj=bpy.data.objects.new(data.name,data);scene.collection.objects.link(obj);obj.location=pos
        obj.rotation_euler=(centre-obj.location).to_track_quat('-Z','Y').to_euler()
    data=bpy.data.cameras.new(PREFIX+'Review');cam=bpy.data.objects.new(data.name,data)
    scene.collection.objects.link(cam);scene.camera=cam
    cam.location=(-31,-47,32);cam.rotation_euler=(centre-cam.location).to_track_quat('-Z','Y').to_euler()
    data.type='ORTHO';data.ortho_scale=38
    scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
    scene.render.threads_mode='FIXED';scene.render.threads=4
    scene.render.resolution_x=900;scene.render.resolution_y=1400;scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG'
    scene.render.filepath=str(OUT/'blender-review.png');bpy.ops.render.render(write_still=True)


def main():
    OUT.mkdir(parents=True,exist_ok=True);PUBLIC.mkdir(parents=True,exist_ok=True)
    scene=bpy.data.scenes.new('CyberBase Wallet Tower V1');scene['generator']='scripts/build-wallet-tower.py'
    scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
    previous=bpy.context.window.scene;bpy.context.window.scene=scene
    try:
        module=module_at('wallet_geometry',ROOT/'scripts/build-reference-buildings.py')
        mats,specs=materials();module.SPECS=specs
        collection=bpy.data.collections.new(PREFIX+'Model');scene.collection.children.link(collection)
        builder,band=build(module);root=builder.finish(collection,mats)
        bpy.context.view_layer.update()
        points=[obj.matrix_world@v.co for obj in root.children for v in obj.data.vertices]
        lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)])
        delta=Vector((-(lo.x+hi.x)/2,-(lo.y+hi.y)/2,-lo.z))
        for obj in root.children:
            for v in obj.data.vertices:v.co+=delta
            obj.data.update()
            if obj.data.materials[0]==mats[RIBBON]:
                obj.name=PREFIX+'TickerRibbon';ribbon_uv1(obj.data,band,delta)
                obj['static_ticker']=True;obj['future_uv_channel']='TickerLoop'
            obj.select_set(True)
        root.select_set(True);bpy.context.view_layer.objects.active=root
        path=PUBLIC/'wallet-tower.glb'
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,use_active_scene=True,
            export_apply=True,export_animations=False,export_cameras=False,export_lights=False,
            export_materials='EXPORT',export_image_format='AUTO',export_yup=True,export_extras=True,export_texcoords=True)
        raw=path.read_bytes();length=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+length])
        for mat in doc['materials']:
            index=next(i for i,m in enumerate(mats) if m.name==mat['name'])
            if 'baseColorTexture' in mat.get('pbrMetallicRoughness',{}):
                mat['pbrMetallicRoughness']['baseColorFactor']=list(specs[index][1])
            if index==RIBBON:mat['alphaMode']='BLEND';mat['doubleSided']=False
        encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
        tail=raw[20+length:]
        path.write_bytes(struct.pack('<4sII',b'glTF',2,20+len(encoded)+len(tail))+struct.pack('<I4s',len(encoded),b'JSON')+encoded+tail)
        metrics={'triangles':sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives']),
            'drawCalls':sum(len(m['primitives']) for m in doc['meshes']),
            'width':round(hi.x-lo.x,4),'depth':round(hi.y-lo.y,4),'height':round(hi.z-lo.z,4),
            'bytes':path.stat().st_size,'sourceArtworkSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
            'source':str(OUT/'wallet-tower.blend'),'ticker':'Separate static mesh, UV0 artwork / UV1 perimeter; no animation'}
        scene.world=bpy.data.worlds.new(PREFIX+'World');scene.world.use_nodes=True
        scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.065,.085,.115,1)
        scene.world.node_tree.nodes['Background'].inputs[1].default_value=.4
        bpy.data.libraries.write(str(OUT/'wallet-tower.blend'),{scene},fake_user=True,compress=True)
        (OUT/'metrics.json').write_text(json.dumps(metrics,indent=2),encoding='utf8')
        print(json.dumps(metrics,indent=2));review(scene)
    finally:bpy.context.window.scene=previous


if __name__=='__main__':main()
