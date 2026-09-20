"""Build the approved unfinished forest bridge and canal kit in a private Blender scene.
Run in the existing Blender session with runpy; restore its active scene in finally.
No existing scene, object, selection or file is overwritten.
"""
from pathlib import Path
import bpy, math, random, json, struct, importlib.util, re
import numpy as np
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/canal'; REF=OUT/'references'; TEX=OUT/'textures'; PUBLIC=ROOT/'public/game/canal/v1'
TEX.mkdir(parents=True,exist_ok=True);PUBLIC.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('canal_builder',ROOT/'scripts/build-reference-buildings.py')
helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
STONE,WOOD,IRON,PAVING,LEAF,PAPER,DARK,LETTER,AMBER,ORANGE,MOSS,ROCK=range(12)
names=['Masonry','Cedar','Iron','Paving','Foliage','Washi','Black','Lettering','Amber','Safety','Moss','Rock']
helper.SPECS=[(n,) for n in names]

def crop(name,col,row,source='surfaces.png'):
    src=bpy.data.images.load(str(REF/source),check_existing=False)
    w,h=src.size;data=np.empty(w*h*4,np.float32);src.pixels.foreach_get(data);data=data.reshape(h,w,4)
    data=data[(1-row)*h//2:(2-row)*h//2,col*w//2:(col+1)*w//2].copy()
    im=bpy.data.images.new('CANAL_'+name,width=data.shape[1],height=data.shape[0],alpha=True)
    im.pixels.foreach_set(data.ravel());im.filepath_raw=str(TEX/(name+'.png'));im.file_format='PNG';im.save();im.pack()
    grey=data[:,:,:3].mean(axis=2)
    dx=(np.roll(grey,-1,1)-np.roll(grey,1,1))*2.2;dy=(np.roll(grey,-1,0)-np.roll(grey,1,0))*2.2
    n=np.stack([-dx,-dy,np.ones_like(dx)],axis=2);n/=np.linalg.norm(n,axis=2)[:,:,None]
    rgba=np.ones_like(data);rgba[:,:,:3]=n*.5+.5
    normal=bpy.data.images.new('CANAL_'+name+'Normal',width=data.shape[1],height=data.shape[0],alpha=False)
    normal.colorspace_settings.name='Non-Color';normal.pixels.foreach_set(rgba.ravel())
    normal.filepath_raw=str(TEX/(name+'-normal.png'));normal.file_format='PNG';normal.save();normal.pack()
    bpy.data.images.remove(src)
    return im,normal

def material(name,color,rough=.7,metal=0,emission=0,images=None,alpha=False):
    mat=bpy.data.materials.new('CANAL_'+name);mat.use_nodes=True;mat.diffuse_color=(*color,1)
    p=mat.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emission
    if images:
        im,normal=images;t=mat.node_tree.nodes.new('ShaderNodeTexImage');t.image=im
        mat.node_tree.links.new(t.outputs['Color'],p.inputs['Base Color'])
        if emission:mat.node_tree.links.new(t.outputs['Color'],p.inputs['Emission Color'])
        if alpha:
            mat.node_tree.links.new(t.outputs['Alpha'],p.inputs['Alpha']);mat.surface_render_method='DITHERED';mat.use_backface_culling=False
        if normal:
            t=mat.node_tree.nodes.new('ShaderNodeTexImage');t.image=normal;n=mat.node_tree.nodes.new('ShaderNodeNormalMap');n.inputs['Strength'].default_value=.45
            mat.node_tree.links.new(t.outputs['Color'],n.inputs['Color']);mat.node_tree.links.new(n.outputs[0],p.inputs['Normal'])
    return mat

class Builder(helper.Builder):
    def face(self,points,mat,uv=None):
        if uv is None:
            a,b,c=map(Vector,points[:3]);n=(b-a).cross(c-a);axis=max(range(3),key=lambda i:abs(n[i]));axes=[i for i in range(3) if i!=axis]
            period={STONE:3.8,WOOD:2.0,PAVING:2.5,MOSS:3.2}.get(mat,1)
            uv=[(p[axes[0]]/period,p[axes[1]]/period) for p in points]
            if mat==WOOD:
                along=max(axes,key=lambda a:max(p[a] for p in points)-min(p[a] for p in points))
                across=next(a for a in axes if a!=along)
                uv=[(p[across]/.55,p[along]/3.) for p in points]
        super().face(points,mat,uv)
    def foliage(self,center,width,height,col,row,angle=0,bend=.15):
        x,y,z=center
        for j in range(4):
            def pt(u,v):
                return (x+math.cos(angle)*(u-.5)*width+math.sin(angle)*math.sin(v*math.pi)*bend,
                        y+math.sin(angle)*(u-.5)*width-math.cos(angle)*math.sin(v*math.pi)*bend,z+v*height)
            lo=j/4;hi=(j+1)/4
            self.face([pt(0,lo),pt(1,lo),pt(1,hi),pt(0,hi)],LEAF,
                [(col*.5,(1-row+lo)*.5),((col+1)*.5,(1-row+lo)*.5),((col+1)*.5,(1-row+hi)*.5),(col*.5,(1-row+hi)*.5)])

def wall():
    b=Builder('Embankment');b.box(0,0,-1.04,4,.9,2.22,STONE,bevel=.055)
    for i in range(4):b.box(-1.5+i,0,.10,.97,1.06,.20,PAVING,bevel=.045)
    # Small relief along mortar courses catches actual moon/lantern lighting.
    for row in range(2):
        for i in range(3):
            x=-1.31+i*1.31+(row%2)*.1
            b.box(x,-.49,-1.50+row*.98,1.21,.13,.88,STONE,bevel=.065)
    return b

def railing():
    b=Builder('CanalRailing')
    for x in [-1.94,1.94]:
        b.box(x,0,.47,.10,.10,.98,IRON,bevel=.01);b.box(x,0,.98,.16,.16,.07,IRON,bevel=.02)
    for z in [.19,.84,.92]:b.box(0,0,z,4,.055,.05,IRON,bevel=.008)
    for x in np.arange(-1.68,1.75,.28):b.box(x,0,.52,.032,.04,.64,IRON)
    return b

def lantern():
    b=Builder('CanalLantern')
    b.box(0,0,.12,.52,.52,.24,STONE,bevel=.045);b.box(0,0,.29,.40,.40,.09,IRON,bevel=.02)
    b.box(0,0,.55,.29,.29,.46,PAPER)
    for x in [-.19,.19]:
        for y in [-.19,.19]:b.box(x,y,.55,.055,.055,.51,IRON,bevel=.008)
    for x,y in [(0,-.16),(0,.16),(-.16,0),(.16,0)]:b.box(x,y,.55,.027,.027,.46,IRON)
    b.box(0,0,.83,.52,.52,.11,IRON,bevel=.03)
    for i in range(4):
        a=i*math.pi/2+math.pi/4;c=a+math.pi/2
        b.face([(.39*math.cos(a),.39*math.sin(a),.88),(.39*math.cos(c),.39*math.sin(c),.88),(0,0,1.04)],IRON)
    return b

def bridge():
    b=Builder('UnfinishedBridge');rng=random.Random(624)
    def deck(y):return .12+1.04*math.sin((y+7)/14*math.pi)
    # Load-bearing curved beams remain continuous through the unlaid deck.
    for x in [-1.98,0,1.98]:
        for j in range(40):
            a=-7+j*.35;c=a+.35;za=deck(a)-.24;zc=deck(c)-.24
            def beamface(points):
                n=(Vector(points[1])-Vector(points[0])).cross(Vector(points[2])-Vector(points[0]))
                across=0 if abs(n.z)>abs(n.x) else 2
                b.face(points,WOOD,[(p[across]/.55,p[1]/3.) for p in points])
            beamface([(x-.26,a,za-.58),(x+.26,a,za-.58),(x+.26,c,zc-.58),(x-.26,c,zc-.58)])
            beamface([(x-.26,a,za),(x-.26,c,zc),(x+.26,c,zc),(x+.26,a,za)])
            for side in [-1,1]:beamface([(x+side*.26,a,za-.58),(x+side*.26,c,zc-.58),(x+side*.26,c,zc),(x+side*.26,a,za)])
    for y in np.arange(-6.85,7,.3):
        if -4.95<y<2.3:continue
        b.box(0,y,deck(y),4.22,.278,.13,WOOD,bevel=.018)
        for x in [-1.7,1.7]:b.tube((x,y,deck(y)+.07),(x,y,deck(y)+.079),.027,IRON,8)
    for y in [-6.5,-4.3,-1.6,1.7,4.3,6.5]:b.box(0,y,deck(y)-.28,4.35,.49,.58,WOOD,bevel=.045)
    # The last few partially laid boards show the direction of construction.
    for x,y,w in [(-1.1,2.0,2.0),(-1.3,1.65,1.6),(1.1,-4.9,1.9)]:
        b.box(x,y,deck(y)+.035,w,.285,.13,WOOD,bevel=.025)
    for x in [-2.04,2.04]:
        for y in [-6.7,-3.35,0,3.35,6.7]:
            b.box(x,y,deck(y)+.55,.32,.32,1.3,WOOD,bevel=.04)
            b.box(x,y,deck(y)+1.25,.37,.37,.09,WOOD,bevel=.035)
            side=1 if x>0 else -1
            for h in [.3,.72]:b.tube((x+side*.165,y,deck(y)+h),(x+side*.185,y,deck(y)+h),.045,IRON,10)
        for height in [.30,1.12]:
            for j in range(28):
                y=-6.8+j*.485;nexty=y+.485
                z1=deck(y)+height;z2=deck(nexty)+height
                for side in [-1,1]:
                    pts=[(x+side*.15,y,z1-.14),(x+side*.15,nexty,z2-.14),(x+side*.15,nexty,z2+.14),(x+side*.15,y,z1+.14)]
                    b.face(pts if side>0 else list(reversed(pts)),WOOD)
                b.face([(x-.15,y,z1+.14),(x+.15,y,z1+.14),(x+.15,nexty,z2+.14),(x-.15,nexty,z2+.14)],WOOD)
                b.face([(x-.15,nexty,z2-.14),(x+.15,nexty,z2-.14),(x+.15,y,z1-.14),(x-.15,y,z1-.14)],WOOD)
                if j==0:b.box(x,y,z1,.30,.02,.28,WOOD)
                if j==27:b.box(x,nexty,z2,.30,.02,.28,WOOD)
    # Construction trestles, diagonal braces, and wrapped steel joints.
    for y in [-4.3,-.5,3.8]:
        for x in [-1.7,1.7]:
            b.box(x,y,-1.1,.32,.32,3.35,WOOD,bevel=.022)
            for z in [-1.8,-.25]:b.box(x,y,z,.25,.25,.11,IRON)
        b.box(0,y,-.45,4.35,.24,.21,WOOD,bevel=.02)
        b.tube((-1.7,y,-2.65),(1.7,y,-.4),.13,WOOD,4)
        b.tube((1.7,y,-2.65),(-1.7,y,-.4),.13,WOOD,4)
    for side in [-1,1]:
        for a,c in [(-4.3,-.5),(-.5,3.8)]:
            b.tube((side*2.0,a,-1.45),(side*2.0,c,deck(c)-.35),.18,WOOD,4)
    for x in [-2.12,2.12]:
        b.box(x,-7,.0,.58,1.05,.5,STONE,bevel=.07);b.box(x,7,.0,.58,1.05,.5,STONE,bevel=.07)
    for vertices in b.v:
        for i,(x,y,z) in enumerate(vertices):vertices[i]=(x*1.10,y,z)
    return b

def gate():
    b=Builder('ForestGate')
    for x in [-2.23,2.23]:
        b.box(x,0,.90,.26,.32,1.96,WOOD,bevel=.025);b.box(x,0,1.89,.34,.39,.14,IRON,bevel=.035)
    for x in np.arange(-2.0,2.01,.25):b.box(x,0,.87,.235,.14,1.55,WOOD,bevel=.012)
    for z in [.2,1.5]:b.box(0,-.09,z,4.25,.085,.16,IRON,bevel=.015)
    for side in [-1,1]:
        y=side*.15
        b.box(0,y,1.02,3.75,.045,1.02,DARK,bevel=.025)
        b.box(0,y,0.35,3.8,.05,.26,DARK)
        for x in np.arange(-1.85,1.64,.4):
            b.face([(x,y+side*.03,.22),(x+.20,y+side*.03,.22),(x+.45,y+side*.03,.48),(x+.25,y+side*.03,.48)],AMBER)
    b.text('ЛЕС',0,-.178,1.25,1.14,LETTER,height=.34)
    b.text('ПРОХОД ЗАКРЫТ',0,-.178,.85,3.05,LETTER,height=.225)
    # Exact same lettering on park-facing side, mirrored in the builder's coordinate space.
    original=len(b.f[LETTER]);b.text('ЛЕС',0,-.179,1.25,1.14,LETTER,height=.34);b.text('ПРОХОД ЗАКРЫТ',0,-.179,.85,3.05,LETTER,height=.225)
    for face in b.f[LETTER][original:]:
        for index in face:
            x,y,z=b.v[LETTER][index];b.v[LETTER][index]=(-x,-y,z)
    return b

def supplies():
    b=Builder('ConstructionSupplies')
    b.box(.35,0,-.60,2.7,2.8,1.4,STONE,bevel=.06)
    for level in range(4):
        for i in range(3):b.box((i-1)*.38,0,.16+level*.13,.35,2.35,.115,WOOD,bevel=.012)
    for y in [-.7,.7]:b.box(0,y,.36,1.19,.04,.52,IRON)
    b.box(1.14,.10,.25,.75,.48,.47,IRON,bevel=.045);b.box(1.14,.10,.5,.79,.51,.09,DARK,bevel=.025)
    for x in [.93,1.35]:b.box(x,-.155,.38,.065,.035,.18,ORANGE)
    b.box(1.14,.1,.61,.35,.045,.035,IRON,bevel=.009)
    return b

def vegetation(name):
    b=Builder(name)
    if name=='IvyDrape':
        b.foliage((0,-.07,-1.85),2.0,2.2,0,0,bend=.16)
        b.foliage((.30,-.20,-1.9),1.4,2.1,1,0,angle=.12,bend=.20)
    elif name=='CanalReeds':
        for i in range(4):b.foliage((math.sin(i)*.13,math.cos(i)*.13,0),1.0,1.35+i*.08,0,1,angle=i*1.71,bend=.12)
    else:
        for i in range(6):b.foliage((0,0,0),1.15,.9+(i%2)*.13,1,1,angle=i*1.047,bend=.45)
    return b

def boulders():
    b=Builder('BankRocks');rng=random.Random(842)
    for x,y,w,d,h in [(-.6,0,2.5,1.9,1.15),(.65,.28,1.9,1.65,1.1),(.8,-.7,1.1,.9,.45)]:
        rings=[]
        for angle in [-1.2,-.6,.08,.65,1.2]:
            ring=[]
            for j in range(12):
                a=j*math.tau/12;noise=rng.uniform(.85,1.14)
                ring.append((x+math.cos(a)*math.cos(angle)*w*.5*noise,
                             y+math.sin(a)*math.cos(angle)*d*.5*noise,
                             h*(.5+.5*math.sin(angle))+rng.uniform(-.06,.06)))
            rings.append(ring)
        for row in range(4):
            for j in range(12):k=(j+1)%12;b.face([rings[row][j],rings[row][k],rings[row+1][k],rings[row+1][j]],ROCK)
        b.face(list(reversed(rings[0])),ROCK);b.face(rings[-1],ROCK)
    return b

def build():
    previous=bpy.context.window.scene
    containers=[bpy.data.objects,bpy.data.collections,bpy.data.scenes,bpy.data.meshes,bpy.data.materials,bpy.data.images,bpy.data.curves]
    existing=[set(container) for container in containers]
    scene=bpy.data.scenes.new('Canal kit / forest crossing');bpy.context.window.scene=scene
    scene.render.threads_mode='FIXED';scene.render.threads=4
    try:
        coll=bpy.data.collections.new('CANAL game-ready sources');scene.collection.children.link(coll)
        foliage=bpy.data.images.load(str(REF/'foliage.png'),check_existing=False);foliage.pack()
        paper=bpy.data.images.load(str(ROOT/'output/sakura-park/textures/Washi.png'),check_existing=False);paper.pack()
        moss=bpy.data.images.load(str(ROOT/'output/sakura-park/textures/Moss.png'),check_existing=False);moss.pack()
        moss_n=bpy.data.images.load(str(ROOT/'output/sakura-park/textures/Moss-normal.png'),check_existing=False);moss_n.colorspace_settings.name='Non-Color';moss_n.pack()
        mats=[material('Masonry',(.55,.59,.60),.76,images=crop('Masonry',1,1,'details-v3.png')),
              material('Cedar',(.48,.29,.18),.52,images=crop('Cedar',0,0,'details-v3.png')),
              material('Iron',(.10,.13,.16),.36,.72,images=crop('Iron',0,1)),
              material('Paving',(.43,.49,.52),.4,.08,images=crop('Paving',1,1)),
              material('Foliage',(.28,.38,.21),.82,images=(foliage,None),alpha=True),
              material('Washi',(1,.52,.17),.62,emission=1.3,images=(paper,None)),
              material('Black',(.023,.033,.039),.64,.2),material('Lettering',(.93,.79,.54),.6,emission=.28),
              material('Amber',(.9,.43,.075),.65),material('Safety',(.82,.17,.025),.5),material('Moss',(.18,.25,.12),.95,images=(moss,moss_n)),
              material('Rock',(.30,.36,.29),.86,images=crop('Rock',0,1,'details-v3.png'))]
        builders=[wall(),railing(),lantern(),bridge(),gate(),supplies(),vegetation('IvyDrape'),vegetation('CanalReeds'),vegetation('BankFern')]
        builders.append(boulders())
        b=Builder('NearBank');b.box(0,0,-.29,96,8,.65,MOSS)
        b.box(19,0,.055,5.0,8,.075,PAVING,bevel=.02);builders.append(b)
        roots=[];metrics={}
        for i,b in enumerate(builders):
            root=b.finish(coll,mats);root.location=(i*18,0,0);roots.append(root)
            metrics[b.name]={'triangles':sum(len(p.vertices)-2 for ob in root.children for p in ob.data.polygons),'draws':len(root.children)}
        bpy.context.view_layer.update();bpy.ops.object.select_all(action='DESELECT')
        for root in roots:
            root.select_set(True)
            for obj in root.children:obj.select_set(True)
        path=PUBLIC/'canal-kit.glb'
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,use_active_scene=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False,export_yup=True)
        raw=path.read_bytes();length=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+length])
        # The open Blender file may already contain our previous kit. Stable GLB
        # names must not inherit Blender's session-local .001 name suffixes.
        for key in ['nodes','meshes','materials','images']:
            for item in doc.get(key,[]):
                if 'name' in item:item['name']=re.sub(r'\.\d{3}$','',item['name'])
        for mat in doc['materials']:
            if mat['name']=='CANAL_Foliage':mat['alphaMode']='MASK';mat['alphaCutoff']=.42;mat['doubleSided']=True
            if mat['name']=='CANAL_Lettering':mat['doubleSided']=True
        encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4);tail=raw[20+length:]
        path.write_bytes(struct.pack('<4sII',b'glTF',2,20+len(encoded)+len(tail))+struct.pack('<I4s',len(encoded),b'JSON')+encoded+tail)
        bpy.data.libraries.write(str(OUT/'canal-kit.blend'),{scene},fake_user=True,compress=True)
        metrics['bytes']=path.stat().st_size;(OUT/'metrics.json').write_text(json.dumps(metrics,indent=2))
        return metrics
    finally:
        bpy.context.window.scene=previous
        # The saved .blend is the editable deliverable. Remove only IDs created
        # by this invocation so the user's open Blender session does not grow.
        for container,original in zip(containers,existing):
            for block in list(container):
                if block not in original:container.remove(block,do_unlink=True)

if __name__=='__main__':
    result=build()
    print(json.dumps(result),flush=True)
