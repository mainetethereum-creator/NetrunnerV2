"""Blender-authored park kit, generated PBR textures and alpha-tested blossom sprays.
Run Blender --background --factory-startup --threads 4 --python this-file.
No user scene is opened or changed. Generated source images stay in references/.
"""
from pathlib import Path
import bpy, bmesh, math, random, json, struct, importlib.util
import numpy as np
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/sakura-park'; REF=OUT/'references'; PUBLIC=ROOT/'public/game/park/sakura-v1'
TEX=OUT/'textures'; TEX.mkdir(exist_ok=True,parents=True)
spec=importlib.util.spec_from_file_location('park_builder',ROOT/'scripts/build-reference-buildings.py')
helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
BARK,WOOD,STONE,MOSS,STEEL,PAPER,RED,CLOTH,FOOD,CERAMIC,BLOSSOM,PAINT,BLACK,CYAN,SIGN,FOLIAGE,WATER=range(17)
names=['Bark','Cedar','Basalt','Moss','Bronze','Washi','RedPaper','Noren','Food','Ceramic','Blossom','RobotPaint','Rubber','Cyan','Sign','Foliage','WaterSpray']
helper.SPECS=[(n,) for n in names]

def cut(source,name,col,row,normal=False):
    image=bpy.data.images.load(str(REF/source),check_existing=True)
    w,h=image.size; pixels=np.empty(w*h*4,np.float32);image.pixels.foreach_get(pixels);pixels=pixels.reshape(h,w,4)
    a=pixels[(1-row)*h//2:(2-row)*h//2,col*w//2:(col+1)*w//2].copy()
    out=bpy.data.images.new(name,width=a.shape[1],height=a.shape[0],alpha=True)
    out.pixels.foreach_set(a.ravel());out.filepath_raw=str(TEX/(name+'.png'));out.file_format='PNG';out.save();out.pack()
    if normal:
        grey=a[:,:,:3].mean(axis=2);dx=(np.roll(grey,-1,1)-np.roll(grey,1,1))*2.5;dy=(np.roll(grey,-1,0)-np.roll(grey,1,0))*2.5
        v=np.stack([-dx,-dy,np.ones_like(dx)],axis=2);v/=np.linalg.norm(v,axis=2)[:,:,None]
        n=np.ones_like(a);n[:,:,:3]=v*.5+.5
        norm=bpy.data.images.new(name+'Normal',width=a.shape[1],height=a.shape[0],alpha=False);norm.colorspace_settings.name='Non-Color'
        norm.pixels.foreach_set(n.ravel());norm.filepath_raw=str(TEX/(name+'-normal.png'));norm.file_format='PNG';norm.save();norm.pack()
        return out,norm
    return out,None

images={}
for name,col,row in [('Bark',0,0),('Cedar',1,0),('Basalt',0,1),('Moss',1,1)]:images[name]=cut('surfaces.png',name,col,row,True)
for name,col,row in [('Noren',0,0),('RedNoren',1,0),('Washi',0,1),('Sign',1,1)]:images[name]=cut('signage.png',name,col,row)
flowers=bpy.data.images.load(str(REF/'blossoms.png'));flowers.pack();images['Blossom']=(flowers,None)
foliage=bpy.data.images.load(str(REF/'understory.png'));foliage.pack();images['Foliage']=(foliage,None)
spray=bpy.data.images.load(str(REF/'water-spray.png'));spray.pack();images['WaterSpray']=(spray,None)

def material(name,color,rough=.7,metal=0,emission=0,texture=None):
    m=bpy.data.materials.new('SAKURA_'+name);m.use_nodes=True;m.diffuse_color=(*color,1)
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emission
    if texture:
        im,normal=images[texture];t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=im
        m.node_tree.links.new(t.outputs['Color'],p.inputs['Base Color'])
        if emission:m.node_tree.links.new(t.outputs['Color'],p.inputs['Emission Color'])
        if texture in ('Blossom','Foliage','WaterSpray'):
            m.node_tree.links.new(t.outputs['Alpha'],p.inputs['Alpha']);m.surface_render_method='DITHERED';m.use_transparency_overlap=False
            m.use_backface_culling=False
        if normal:
            t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=normal;n=m.node_tree.nodes.new('ShaderNodeNormalMap');n.inputs['Strength'].default_value=.55
            m.node_tree.links.new(t.outputs['Color'],n.inputs['Color']);m.node_tree.links.new(n.outputs[0],p.inputs['Normal'])
    return m

mats=[material('Bark',(.6,.52,.48),.94,texture='Bark'),material('Cedar',(.55,.42,.3),.77,texture='Cedar'),
      material('Basalt',(.6,.66,.7),.44,.12,texture='Basalt'),material('Moss',(.4,.5,.2),.95,texture='Moss'),
      material('Bronze',(.17,.14,.10),.39,.78),material('Washi',(1,.67,.29),.65,0,2.5,'Washi'),
      material('RedPaper',(.72,.04,.025),.65,0,1.4),material('Noren',(.1,.1,.2),.92,texture='Noren'),
      material('Food',(.58,.27,.075),.68),material('Ceramic',(.53,.52,.43),.23,.18),
      material('Blossom',(1,.78,.85),.82,0,.14,'Blossom'),material('RobotPaint',(.65,.71,.7),.32,.35),
      material('Rubber',(.025,.036,.04),.79),material('Cyan',(.10,.83,1),.25,.1,3),material('Sign',(1,1,1),.35,.2,1.8,'Sign'),material('Foliage',(.4,.6,.2),.62,0,.035,'Foliage'),material('WaterSpray',(.7,.9,.9),.25,0,.5,'WaterSpray')]

class Builder(helper.Builder):
    def face(self,points,mat,uv=None):
        if uv is None:
            a,b,c=map(Vector,points[:3]);normal=(b-a).cross(c-a);axis=max(range(3),key=lambda i:abs(normal[i]));axes=[i for i in range(3) if i!=axis]
            period={BARK:1.2,WOOD:1.4,STONE:2.6,MOSS:2,STEEL:1,PAPER:1}.get(mat,1)
            uv=[(p[axes[0]]/period,p[axes[1]]/period) for p in points]
        super().face(points,mat,uv)
    def ring(self,r0,r1,z0,z1,mat,n=64):
        for i in range(n):
            a=i*math.tau/n;c=(i+1)*math.tau/n
            for ra,rb,za,zb in [(r0,r1,z1,z1),(r1,r1,z1,z0),(r0,r0,z0,z1)]:
                self.face([(ra*math.cos(a),ra*math.sin(a),za),(rb*math.cos(a),rb*math.sin(a),zb),(rb*math.cos(c),rb*math.sin(c),zb),(ra*math.cos(c),ra*math.sin(c),za)],mat)
    def card(self,center,u,v,mat):
        c=Vector(center);u=Vector(u)/2;v=Vector(v)/2
        self.face([c-u-v,c+u-v,c+u+v,c-u+v],mat,[(0,0),(1,0),(1,1),(0,1)])
    def limb(self,points,radius,tip=.02):
        # Continuous tapered rings share normals: rounded bark, no segmented cylinders.
        rings=[];n=10
        for j,p in enumerate(points):
            axis=(points[min(j+1,len(points)-1)]-points[max(0,j-1)]).normalized()
            u=axis.cross(Vector((0,1,0))).normalized();v=axis.cross(u).normalized()
            r=tip+(radius-tip)*(1-j/(len(points)-1))**1.2
            rings.append([p+(u*math.cos(i*math.tau/n)+v*math.sin(i*math.tau/n))*r for i in range(n)])
        for j in range(len(rings)-1):
            for i in range(n):k=(i+1)%n;self.face([rings[j][i],rings[j][k],rings[j+1][k],rings[j+1][i]],BARK)

def tree():
    b=Builder('SakuraTree');rng=random.Random(20260920)
    b.tube((0,0,-.05),(0,0,.02),.30,MOSS,12)
    trunk=[Vector(p) for p in [(0,0,0),(.22,.04,.6),(.02,.1,1.15),(-.1,.08,1.65)]]
    b.limb(trunk,.43,.27)
    for i in range(7):
        a=i*math.tau/7;b.tube((0,0,.25),(math.cos(a)*.7,math.sin(a)*.7,.01),.15,BARK,7,r2=.025)
    # Four low forks carry an asymmetric layered crown; the inner limbs stay exposed.
    for limb,angle in enumerate([.18,1.85,3.15,4.8]):
        start=trunk[2 if limb%2 else 3];reach=[2.7,2.0,2.85,2.4][limb]
        end=Vector((math.cos(angle)*reach,math.sin(angle)*reach,3.25+limb%2*.7))
        points=[]
        for j in range(9):
            t=j/8;p=start.lerp(end,t);p.z-=math.sin(t*math.pi)*.3;p.x+=math.sin(t*math.pi)*.25;points.append(p)
        b.limb(points,.28,.055)
        for branch in range(5):
            a=angle+(branch-2)*.48;t=.38+branch*.13;origin=points[min(7,round(t*8))]
            tip=origin+Vector((math.cos(a)*rng.uniform(1.0,1.8),math.sin(a)*rng.uniform(1.0,1.7),rng.uniform(.45,1.3)))
            curve=[origin.lerp(tip,k/5)+Vector((0,0,math.sin(k/5*math.pi)*.22)) for k in range(6)]
            b.limb(curve,.085,.012)
            for k in range(7):
                aa=rng.uniform(0,math.tau);rr=rng.uniform(.15,.9)
                q=tip+Vector((math.cos(aa)*rr,math.sin(aa)*rr,rng.uniform(-.2,.6)));size=rng.uniform(.8,1.4)
                for turn in [0,1.57]:
                    b.card(q,(math.cos(aa+turn)*size,math.sin(aa+turn)*size,.15),(0,0,size*.8),BLOSSOM)
            for j in range(4):
                p=origin.lerp(tip,.45+j*.18);ta=a+(-1 if j%2 else 1)*.9
                twig=p+Vector((math.cos(ta)*.75,math.sin(ta)*.75,rng.uniform(-.25,.4)))
                b.tube(p,twig,.024,BARK,6,r2=.005)
                for k in range(3):
                    q=p.lerp(twig,.28+k*.32);size=rng.uniform(.75,1.15)
                    for turn in [0,1.57]:
                        aa=ta+turn;b.card(q,(math.cos(aa)*size,math.sin(aa)*size,rng.uniform(-.3,.3)),(-math.sin(aa)*.18,math.cos(aa)*.18,size*.65),BLOSSOM)
    return b

def lantern(b,x,y,z,scale=1,stone=False):
    mat=STONE if stone else STEEL;s=scale
    b.box(x,y,z+.13*s,.55*s,.55*s,.26*s,mat,bevel=.03*s)
    b.tube((x,y,z+.2*s),(x,y,z+2.32*s),.075*s,mat,8)
    b.box(x,y,z+2.42*s,.57*s,.57*s,.10*s,mat)
    b.box(x,y,z+2.75*s,.34*s,.34*s,.53*s,PAPER)
    for dx in [-.29,.29]:
        for dy in [-.29,.29]:b.box(x+dx*s,y+dy*s,z+2.74*s,.08*s,.08*s,.63*s,mat)
    for dx,dy in [(0,-.23),(0,.23),(-.23,0),(.23,0)]:b.box(x+dx*s,y+dy*s,z+2.74*s,.045*s,.045*s,.58*s,mat)
    b.box(x,y,z+3.065*s,.7*s,.7*s,.11*s,mat)
    apex=(x,y,z+3.38*s)
    for i in range(4):
        a=i*math.pi/2+math.pi/4;c=a+math.pi/2
        b.face([(x+math.cos(a)*.60*s,y+math.sin(a)*.60*s,z+3.12*s),(x+math.cos(c)*.60*s,y+math.sin(c)*.60*s,z+3.12*s),apex],mat)
    b.tube((x,y,z+3.32*s),(x,y,z+3.48*s),.06*s,mat,8)

def stall():
    b=Builder('YataiStall')
    b.box(0,0,.12,3.6,2.55,.24,STONE,bevel=.025)
    for x in [-1.45,1.45]:
        for y in [-.9,.9]:b.box(x,y,1.63,.15,.15,2.95,WOOD,bevel=.015)
    for x in np.arange(-1.38,1.5,.18):b.box(x,.96,1.33,.165,.11,2.35,WOOD)
    for x in [-1.45,1.45]:b.box(x,0,.62,.12,1.85,1.0,WOOD)
    b.box(0,-1,1.16,3.35,.8,.13,WOOD,bevel=.035)
    b.box(0,-.82,.65,3.1,.13,.95,WOOD)
    for x in np.arange(-1.5,1.6,.24):b.box(x,-.902,.66,.035,.035,.87,STEEL)
    for side in [-1,1]:
        b.face([(-1.85,0,3.3),(1.85,0,3.3),(1.9,side*1.5,2.93),(-1.9,side*1.5,2.93)],STONE)
        for x in np.arange(-1.8,1.9,.3):b.tube((x,0,3.33),(x,side*1.52,2.95),.035,STEEL,5)
        b.tube((-1.95,side*1.5,2.95),(1.95,side*1.5,2.95),.065,WOOD,6)
    for i in range(4):
        x=-1.48+i*.74
        b.face([(x,-1.53,2.38),(x+.70,-1.53,2.38),(x+.70,-1.53,2.89),(x,-1.53,2.89)],CLOTH,[(i/4,0),((i+1)/4,0),((i+1)/4,1),(i/4,1)])
    # Cookware, bowls, steamers, chopsticks and stools are geometry, not a facade card.
    for i,x in enumerate([-.95,-.3,.5,1.03]):
        b.tube((x,-.88,1.24),(x,-.88,1.42),.14,CERAMIC,16,r2=.22)
        b.tube((x,-.88,1.425),(x,-.88,1.44),.18,FOOD,16)
        for dx in [-.03,.03]:b.tube((x+dx,-1.07,1.46),(x+.13+dx,-.65,1.5),.008,WOOD,5)
    for x in [-.85,.1]:
        b.tube((x,.25,1.1),(x,.25,1.65),.3,STEEL,20);b.tube((x,.25,1.65),(x,.25,1.68),.32,CERAMIC,20)
        b.tube((x,.25,1.68),(x,.25,1.75),.06,BLACK,8)
    for x in [-1.65,1.65]:
        b.tube((x,-1.59,2.08),(x,-1.59,2.78),.23,PAPER if x>0 else RED,20)
        for z in np.arange(2.1,2.78,.08):b.tube((x,-1.59,z),(x,-1.59,z+.009),.234,STEEL,20)
        b.tube((x,-1.59,2.78),(x,-1.59,3.0),.015,STEEL,5)
    for x in [-1.1,0,1.1]:
        b.box(x,-1.68,.63,.58,.42,.10,WOOD,bevel=.025)
        for dx in [-.21,.21]:
            for dy in [-.14,.14]:b.box(x+dx,-1.68+dy,.33,.055,.055,.58,WOOD)
    return b

def fountain():
    b=Builder('Fountain');b.ring(1.85,2.28,0,.43,STONE)
    b.ring(1.82,2.31,.43,.52,STONE);b.ring(1.80,1.85,.12,.46,STEEL)
    b.tube((0,0,.04),(0,0,.1),1.83,STONE,64)
    for i in range(48):
        a=i*math.tau/48
        b.tube((math.cos(a)*1.86,math.sin(a)*1.86,.526),(math.cos(a)*2.30,math.sin(a)*2.30,.526),.009,BLACK,4)
    for i in range(6):
        a=i*math.tau/6;b.tube((math.cos(a)*1.45,math.sin(a)*1.45,.13),(math.cos(a)*1.45,math.sin(a)*1.45,.15),.13,CYAN,12)
    return b

def robot():
    b=Builder('DeliveryRobot')
    b.box(0,0,.53,.66,.88,.6,PAINT,bevel=.085)
    b.box(0,-.447,.65,.61,.055,.36,BLACK,bevel=.035)
    for x in [-.332,.332]:
        b.box(x,-.15,.65,.027,.5,.36,BLACK,bevel=.015)
        for y in [-.30,-.05]:b.box(x*1.045,y,.67,.015,.09,.105,CYAN,bevel=.008)
    b.box(0,0,.865,.69,.89,.10,STEEL,bevel=.035);b.box(0,0,.93,.6,.77,.045,PAINT,bevel=.02)
    for x in [-.35,.35]:
        for y in [-.29,.29]:
            b.tube((x-.06,y,.19),(x+.06,y,.19),.16,BLACK,16);b.tube((x-.065,y,.19),(x+.065,y,.19),.085,STEEL,12)
    for x in [-.14,.14]:b.tube((x,-.481,.66),(x,-.485,.66),.06,CYAN,16)
    b.tube((.23,.32,.9),(.23,.32,1.16),.012,STEEL,6);b.tube((.23,.32,1.16),(.23,.32,1.22),.017,CYAN,6)
    for x in [-.27,.27]:b.box(x,-.448,.36,.08,.024,.055,CYAN)
    return b

def planting(kind='Planting'):
    b=Builder(kind);rng=random.Random(842)
    if kind=='ForestGrass':
        for i in range(5):
            a=i*2.4;s=rng.uniform(.7,1)
            b.face([(-math.cos(a)*s/2,-math.sin(a)*s/2,0),(math.cos(a)*s/2,math.sin(a)*s/2,0),(math.cos(a)*s*.58,math.sin(a)*s*.58,s),(-math.cos(a)*s*.42,-math.sin(a)*s*.42,s)],FOLIAGE,[(0,0),(.5,0),(.5,.5),(0,.5)])
        return b
    # Curved leaf strips with photographic cutouts: actual volume, no camera-facing billboard.
    for i in range(9 if kind=='GardenShrub' else 12):
        a=i*2.399;col=1 if kind=='GardenShrub' else i%2;row=0 if kind=='GardenShrub' else col
        width=rng.uniform(.48,.72);length=rng.uniform(.6,1.05)
        def point(u,v):
            r=v*length;z=.1+math.sin(v*math.pi*.8)*(.7 if row else .95)
            if kind=='GardenShrub':z=.05+v*(1.1+(i%3)*.13)
            return (math.cos(a)*r-math.sin(a)*(u-.5)*width,math.sin(a)*r+math.cos(a)*(u-.5)*width,z)
        for j in range(4):
            v0=j/4;v1=(j+1)/4
            b.face([point(0,v0),point(1,v0),point(1,v1),point(0,v1)],FOLIAGE,
                   [(col*.5,.5*(1-row)+v0*.5),((col+1)*.5,.5*(1-row)+v0*.5),((col+1)*.5,.5*(1-row)+v1*.5),(col*.5,.5*(1-row)+v1*.5)])
    for x,y in [(-.6,.1),(.25,.4)]:b.box(x,y,.12,.42,.34,.25,STONE,bevel=.1)
    return b

scene=bpy.data.scenes.new('Sakura park asset library');bpy.context.window.scene=scene
coll=bpy.data.collections.new('Game-ready park models');scene.collection.children.link(coll)
builders=[tree(),stall(),fountain(),robot(),planting(),planting('FernCluster'),planting('ForestGrass'),planting('GardenShrub')]
b=Builder('FountainSpray');b.card((0,0,.5),(.55,0,0),(0,0,1),WATER);b.card((0,0,.5),(0,.55,0),(0,0,1),WATER);builders.append(b)
b=Builder('LanternPost');lantern(b,0,0,0);builders.append(b)
b=Builder('StoneLantern')
b.box(0,0,.11,.88,.88,.22,STONE,bevel=.08);b.box(0,0,.42,.3,.3,.5,STONE,bevel=.035)
b.box(0,0,.65,.62,.62,.12,STONE,bevel=.035);b.box(0,0,.91,.39,.39,.4,PAPER)
for x in [-.26,.26]:
    for y in [-.26,.26]:b.box(x,y,.91,.095,.095,.43,STONE,bevel=.015)
b.box(0,0,1.15,.76,.76,.16,STONE,bevel=.06)
for i in range(4):
    a=i*math.pi/2+math.pi/4;c=a+math.pi/2
    b.face([(.6*math.cos(a),.6*math.sin(a),1.2),(.6*math.cos(c),.6*math.sin(c),1.2),(0,0,1.47)],STONE)
b.tube((0,0,1.43),(0,0,1.58),.09,STONE,10);builders.append(b)
b=Builder('ParkBench')
for y in [-.19,-.06,.07,.20]:b.box(0,y,.5,1.8,.11,.085,WOOD,bevel=.018)
for x in [-.68,.68]:b.box(x,0,.25,.075,.48,.5,STEEL);b.box(x,.24,.72,.065,.07,.75,STEEL)
for z in [.78,.93]:b.box(0,.25,z,1.8,.07,.11,WOOD,bevel=.015)
builders.append(b)
b=Builder('GardenSign');b.box(0,0,0,1.1,.15,2.2,STEEL,bevel=.03);b.card((0,-.08,0),(1.04,0,0),(0,0,2.1),SIGN);builders.append(b)
roots=[];stats={}
for i,b in enumerate(builders):
    root=b.finish(coll,mats);root.location=(i*9,0,0);roots.append(root)
    stats[b.name]={'triangles':sum(len(p.vertices)-2 for obj in root.children for p in obj.data.polygons),'drawCalls':len(root.children)}
    for obj in root.children:
        if 'Bark' in obj.name:
            mesh=bmesh.new();mesh.from_mesh(obj.data);bmesh.ops.remove_doubles(mesh,verts=list(mesh.verts),dist=.0001);mesh.to_mesh(obj.data);mesh.free()
            for p in obj.data.polygons:p.use_smooth=True
bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT')
for root in roots:
    root.select_set(True)
    for obj in root.children:obj.select_set(True)
path=PUBLIC/'sakura-kit.glb'
bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,use_active_scene=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False,export_yup=True)
# Foliage uses cutouts with depth writes, never sorted/blended overlapping sheets.
raw=path.read_bytes();length=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+length])
for mat in doc['materials']:
    if mat['name'] in ('SAKURA_Blossom','SAKURA_Foliage'):mat['alphaMode']='MASK';mat['alphaCutoff']=.42;mat['doubleSided']=True
encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4);tail=raw[20+length:]
path.write_bytes(struct.pack('<4sII',b'glTF',2,20+len(encoded)+len(tail))+struct.pack('<I4s',len(encoded),b'JSON')+encoded+tail)
scene.world=bpy.data.worlds.new('ParkWorld');scene.world.color=(.12,.15,.19)
bpy.data.libraries.write(str(OUT/'sakura-kit.blend'),{scene},fake_user=True,compress=True)
stats['bytes']=path.stat().st_size;(OUT/'metrics.json').write_text(json.dumps(stats,indent=2));print(json.dumps(stats),flush=True)
