"""Author the three owner-selected v1 concepts in Blender; export portable low-poly GLBs.

Execute main() through Blender MCP. Existing scenes/data are never modified. The
editable source is a separate scene written with libraries.write, not Save As over
the user's open file. Front is Blender -Y / glTF +Z; origin is ground centre.
"""
from __future__ import annotations

import json
import math
from pathlib import Path
import random
import struct

import bpy
import numpy as np
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/building-models/v1'
PUBLIC = ROOT / 'public/game/buildings/reference-v1'
PREFIX = 'CBR1_'
CONCRETE, STEEL, GREEN, RED, GLASS, WARM, GLOW, SILVER = range(8)
SPECS = [
    # Owner's darker revision: cold 0xb5b5b5 tint at 75% linear reflectance.
    ('Concrete', (.33975,.3465,.3555,1), .94, .0, 0),
    ('Gunmetal', (.037, .044, .042, 1), .68, .65, 0),
    ('ServiceGreen', (.065, .105, .08, 1), .73, .48, 0),
    ('OxideRed', (.39, .085, .042, 1), .8, .22, 0),
    ('TealGlass', (.035, .085, .08, 1), .27, .5, 0),
    ('InteriorAmber', (.29, .16, .054, 1), .7, .08, .18),
    ('AmberLight', (1, .48, .12, 1), .4, .0, 2.3),
    ('AgedAluminium', (.43, .44, .41, 1), .64, .65, 0),
]


def surface_image():
    """A deterministic tiling 1K surface, with pores and vertical rain staining.

    This is authored material data, not a projection of the concept photo. All
    sides and roofs therefore have useful UVs and work from arbitrary angles.
    """
    rng = np.random.default_rng(18092026)
    n = 1024
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32) / n
    noise = rng.normal(0, .026, (n, n)).astype(np.float32)
    # Filter random fields in frequency space: irregular concrete mottling,
    # avoiding the conspicuous diagonal bands produced by a handful of sines.
    fy,fx=np.meshgrid(np.fft.fftfreq(n),np.fft.fftfreq(n),indexing='ij')
    for radius,amp in [(80,.05),(17,.035),(3,.023)]:
        field=np.fft.ifft2(np.fft.fft2(rng.normal(size=(n,n)))*np.exp(-(fx*fx+fy*fy)*radius*radius)).real
        noise+=field/max(field.std(),.001)*amp
    stains = np.zeros((n, n), np.float32)
    for _ in range(80):
        x, width, length, phase = rng.random(), rng.uniform(.0015, .009), rng.uniform(.07, .8), rng.random()
        dx = np.minimum(abs(xx-x), 1-abs(xx-x))
        fall = np.mod(yy + phase, 1)
        stains += np.exp(-(dx/width)**2) * np.maximum(0, 1-fall/length) * rng.uniform(.025,.15)
    pores = (rng.random((n,n)) > .994) * rng.uniform(.08,.20,(n,n))
    value = np.clip(.82 + noise - stains - pores, .26, 1)
    rgba = np.ones((n,n,4), np.float32)
    rgba[:,:,:3] = value[:,:,None]
    rgba[:,:,0] += stains*.07
    rgba[:,:,2] -= stains*.10
    image = bpy.data.images.new(PREFIX+'Surface', width=n, height=n, alpha=True)
    image.pixels.foreach_set(np.clip(rgba,0,1).ravel())
    image.filepath_raw = str(OUT/'surface.png')
    image.file_format = 'PNG'
    image.save()
    image.pack()
    return image


def concrete_image():
    """Bake the existing narrow-house / SECTOR 02 atlas concrete into a portable map.

    Matches the linear luma, detail/cloud weights and cold tint of
    components/expedition/cyber-concrete.ts. Metals keep their separate surface.
    One mirrored atlas period covers 5.6 metres, so the pores keep their scale.
    """
    source=bpy.data.images.load(str(ROOT/'public/game/props/salvage/building-atlas.webp'),check_existing=False)
    source.colorspace_settings.name='Non-Color'
    w,h=source.size
    pixels=np.empty(w*h*4,np.float32);source.pixels.foreach_get(pixels)
    rgb=pixels.reshape(h,w,4)[:,:,:3]
    linear=np.where(rgb<=.04045,rgb/12.92,((rgb+.055)/1.055)**2.4)
    luma=linear@np.array([.2126,.7152,.0722],np.float32)
    n=1024
    yy,xx=np.mgrid[0:n,0:n].astype(np.float32)/n*2
    def sample(u,v):
        u=np.abs(np.mod(u*.5,1)*2-1);v=np.abs(np.mod(v*.5,1)*2-1)
        x=(.012+u*.976)/3*(w-1);y=(2.012+v*.976)/3*(h-1)
        ix=x.astype(int);iy=y.astype(int);fx=x-ix;fy=y-iy
        return (luma[iy,ix]*(1-fx)*(1-fy)+luma[iy,ix+1]*fx*(1-fy)
                +luma[iy+1,ix]*(1-fx)*fy+luma[iy+1,ix+1]*fx*fy)
    detail=sample(xx,yy)
    # Mirror the broad coordinates too, keeping the baked tile seamless.
    cloud=sample(np.abs(xx-1)*.742+1.73,np.abs(yy-1)*.742+.39)
    tone=.105+detail*.56+cloud*.14
    encoded=np.where(tone<=.0031308,tone*12.92,1.055*tone**(1/2.4)-.055)
    rgba=np.ones((n,n,4),np.float32);rgba[:,:,:3]=encoded[:,:,None]
    image=bpy.data.images.new(PREFIX+'ColdConcrete',width=n,height=n,alpha=True)
    image.colorspace_settings.name='sRGB'
    image.pixels.foreach_set(rgba.ravel())
    image.filepath_raw=str(OUT/'cold-concrete.png');image.file_format='PNG'
    image.save();image.pack();bpy.data.images.remove(source)
    return image


def materials(image, concrete):
    result=[]
    for name,color,rough,metal,emission in SPECS:
        mat=bpy.data.materials.new(PREFIX+name)
        mat.use_nodes=True
        mat.diffuse_color=color
        p=mat.node_tree.nodes.get('Principled BSDF')
        p.inputs['Base Color'].default_value=color
        p.inputs['Metallic'].default_value=metal
        p.inputs['Roughness'].default_value=rough
        if emission:
            p.inputs['Emission Color'].default_value=color
            p.inputs['Emission Strength'].default_value=emission
        if name not in ('AmberLight','TealGlass','InteriorAmber'):
            tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=concrete if name=='Concrete' else image
            tint=mat.node_tree.nodes.new('ShaderNodeMixRGB');tint.blend_type='MULTIPLY'
            tint.inputs[0].default_value=1;tint.inputs[2].default_value=color
            mat.node_tree.links.new(tex.outputs['Color'],tint.inputs[1])
            mat.node_tree.links.new(tint.outputs[0],p.inputs['Base Color'])
        result.append(mat)
    return result


class Builder:
    def __init__(self, name):
        self.name=name
        self.v=[[] for _ in SPECS];self.f=[[] for _ in SPECS];self.uv=[[] for _ in SPECS]

    def face(self, points, mat, uv=None):
        start=len(self.v[mat]);self.v[mat].extend([tuple(p) for p in points])
        self.f[mat].append(tuple(range(start,start+len(points))))
        if uv is None:
            a,b,c=map(Vector,points[:3]);normal=(b-a).cross(c-a)
            axis=max(range(3),key=lambda i:abs(normal[i]));axes=[i for i in range(3) if i!=axis]
            period=5.6 if mat==CONCRETE else 2.4
            uv=[(p[axes[0]]/period,p[axes[1]]/period) for p in points]
        self.uv[mat].append(uv)

    def box(self,x,y,z,w,d,h,mat=CONCRETE,bevel=0):
        if bevel:
            # One-segment chamfer with analytic planes: 6 faces + 12 edges + 8 corners.
            half=[w/2,d/2,h/2];b=min(bevel,*[a*.35 for a in half]);center=[x,y,z]
            from itertools import product
            def emit(local):
                pts=[Vector(p) for p in local]
                normal=(pts[1]-pts[0]).cross(pts[2]-pts[0])
                centroid=sum(pts,Vector())/len(pts)
                if normal.dot(centroid)<0:pts.reverse()
                self.face([tuple(p[i]+center[i] for i in range(3)) for p in pts],mat)
            for axis in range(3):
                others=[i for i in range(3) if i!=axis]
                for sign in [-1,1]:
                    pts=[]
                    for u,v in [(-1,-1),(1,-1),(1,1),(-1,1)]:
                        p=[0,0,0];p[axis]=sign*half[axis]
                        p[others[0]]=u*(half[others[0]]-b);p[others[1]]=v*(half[others[1]]-b);pts.append(p)
                    emit(pts)
            for axis in range(3):
                i,j=[i for i in range(3) if i!=axis]
                for si,sj in product([-1,1],repeat=2):
                    pts=[]
                    for end,side in [(-1,0),(1,0),(1,1),(-1,1)]:
                        p=[0,0,0];p[axis]=end*(half[axis]-b)
                        p[i]=si*(half[i]-(b if side else 0));p[j]=sj*(half[j]-(0 if side else b));pts.append(p)
                    emit(pts)
            for signs in product([-1,1],repeat=3):
                pts=[]
                for axis in range(3):pts.append([signs[i]*(half[i]-(0 if i==axis else b)) for i in range(3)])
                emit(pts)
            return
        p=[(x+sx*w/2,y+sy*d/2,z+sz*h/2) for sx,sy,sz in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
        for ids in [(3,2,1,0),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)]:self.face([p[i] for i in ids],mat)

    def tube(self,a,b,r,mat=STEEL,n=8,r2=None):
        a,b=Vector(a),Vector(b);axis=(b-a).normalized();ref=Vector((0,0,1) if abs(axis.z)<.9 else (0,1,0))
        u=axis.cross(ref).normalized();v=axis.cross(u).normalized();r2=r if r2 is None else r2
        rings=[[pt+(u*math.cos(i*math.tau/n)+v*math.sin(i*math.tau/n))*rad for i in range(n)] for pt,rad in [(a,r),(b,r2)]]
        self.face(list(reversed(rings[0])),mat);self.face(rings[1],mat)
        for i in range(n):j=(i+1)%n;self.face([rings[0][i],rings[0][j],rings[1][j],rings[1][i]],mat)

    def pipe(self,points,r=.05,mat=GREEN,n=8):
        for a,b in zip(points,points[1:]):self.tube(a,b,r,mat,n)
        for p in points[1:-1]:self.box(*p,r*2.3,r*2.3,r*2.3,mat,bevel=r*.3)

    def front(self,x,y,z,w,h,mat,depth=.08):self.box(x,y,z,w,depth,h,mat)

    def frame(self,x,y,z,w,h,mat=STEEL,bar=.08,depth=.12):
        for xx in [x-w/2,x+w/2]:self.box(xx,y,z,bar,depth,h-bar,mat)
        for zz in [z-h/2,z+h/2]:self.box(x,y,zz,w+bar,depth,bar,mat)

    def vent(self,x,y,z,w,h,rows=8):
        self.front(x,y,z,w,h,STEEL)
        self.frame(x,y-.06,z,w,h,SILVER,.07,.14)
        for i in range(rows):self.box(x,y-.11,z-h/2+.08+(h-.16)*(i+.5)/rows,w-.13,.16,.065,SILVER)

    def window(self,x,y,z,w,h,warm=False,mullions=2):
        self.front(x,y,z,w,h,WARM if warm else GLASS)
        self.frame(x,y-.08,z,w,h,STEEL,.12,.2)
        for i in range(1,mullions):self.box(x-w/2+w*i/mullions,y-.15,z,.05,.09,h,STEEL)
        if warm:self.box(x,y-.17,z+h/2-.13,w*.7,.035,.027,GLOW)

    def lamp(self,x,y,z,w=.28,h=.08):
        self.box(x,y,z,w+.12,.19,h+.13,STEEL,bevel=.025)
        self.front(x,y-.105,z,w,h,GLOW,.014)

    def ac(self,x,y,z):
        self.box(x,y,z,.85,.4,.59,SILVER,bevel=.045)
        self.tube((x-.12,y-.215,z),(x-.12,y-.255,z),.235,STEEL,16)
        for i in range(-3,4):
            off=i*.055;span=math.sqrt(max(0,.22**2-off**2))
            self.tube((x-.12-span,y-.28,z+off),(x-.12+span,y-.28,z+off),.009,SILVER,4)
        self.pipe([(x+.25,y,z-.28),(x+.25,y,z-.55),(x+.4,y+.1,z-.6)],.026,STEEL)
        for xx in [-.29,.29]:self.box(x+xx,y+.04,z-.36,.08,.58,.08,STEEL)

    def ladder(self,x,y,z0,z1):
        for yy in [y-.27,y+.27]:
            self.pipe([(x,yy,z0),(x,yy,z1+.5),(x-.25,yy,z1+.7),(x-.55,yy,z1+.7)],.034,STEEL)
        for z in np.arange(z0+.1,z1+.5,.33):self.tube((x,y-.27,z),(x,y+.27,z),.025,STEEL)
        for z in [z0+.4,(z0+z1)/2,z1-.2]:
            for yy in [y-.27,y+.27]:self.tube((x-.3,yy,z),(x,yy,z),.025,STEEL)

    def text(self,text,x,y,z,width,mat=GLOW,height=None,chinese=False):
        curve=bpy.data.curves.new(PREFIX+'Lettering','FONT');curve.body=text;curve.align_x='CENTER';curve.size=1
        curve.resolution_u=2;curve.extrude=0;curve.fill_mode='BOTH'
        font_path='C:/Windows/Fonts/msyhbd.ttc' if chinese else 'C:/Windows/Fonts/arialbd.ttf'
        curve.font=bpy.data.fonts.load(font_path,check_existing=True)
        obj=bpy.data.objects.new(PREFIX+'Lettering',curve);bpy.context.scene.collection.objects.link(obj)
        bpy.context.view_layer.update()
        mesh=bpy.data.meshes.new_from_object(obj.evaluated_get(bpy.context.evaluated_depsgraph_get()))
        coords=[v.co for v in mesh.vertices]
        if coords:
            minx,maxx=min(v.x for v in coords),max(v.x for v in coords)
            miny,maxy=min(v.y for v in coords),max(v.y for v in coords)
            scale=min(width/max(maxx-minx,.01),(height/(maxy-miny)) if height else 100)
            for poly in mesh.polygons:self.face([(x+(mesh.vertices[i].co.x-(minx+maxx)/2)*scale,y,z+(mesh.vertices[i].co.y-(miny+maxy)/2)*scale) for i in poly.vertices],mat)
        bpy.data.meshes.remove(mesh);bpy.data.objects.remove(obj,do_unlink=True);bpy.data.curves.remove(curve)

    def rifle(self,x,y,z,s=1,mat=STEEL):
        self.box(x,y,z,1.02*s,.08*s,.16*s,mat)
        self.box(x+.72*s,y,z+.035*s,.5*s,.045*s,.06*s,mat)
        self.box(x-.67*s,y,z-.07*s,.36*s,.075*s,.17*s,mat)
        self.box(x-.04*s,y,z-.19*s,.15*s,.075*s,.23*s,mat)
        self.tube((x-.27*s,y,z-.04*s),(x-.37*s,y,z-.28*s),.055*s,mat,4)
        self.box(x-.12*s,y,z+.15*s,.3*s,.055*s,.055*s,mat)
        for xx in [-.23,.02]:self.box(x+xx*s,y,z+.115*s,.025*s,.05*s,.1*s,mat)

    def panels(self,w,d,h):
        # Modest formwork joints: long seams are geometric, pores/stains are texels.
        for x in np.arange(-w/2+1.1,w/2,1.35):self.front(x,-d/2-.004,h/2,.012,h,STEEL,.008)
        for z in np.arange(1.4,h,1.6):
            self.front(0,-d/2-.006,z,w,.012,STEEL,.008)
            self.box(w/2+.006,0,z,.008,d,.012,STEEL)
        for y in np.arange(-d/2+.8,d/2,1.5):self.box(w/2+.005,y,h/2,.008,.012,h,STEEL)

    def finish(self,collection,mats):
        root=bpy.data.objects.new(self.name,None);collection.objects.link(root)
        for i,verts in enumerate(self.v):
            if not verts:continue
            mesh=bpy.data.meshes.new(self.name+'_'+SPECS[i][0]);mesh.from_pydata(verts,[],self.f[i]);mesh.materials.append(mats[i]);mesh.update()
            uv=mesh.uv_layers.new(name='UVMap')
            for poly,coords in zip(mesh.polygons,self.uv[i]):
                for loop,coord in zip(poly.loop_indices,coords):uv.data[loop].uv=coord
            obj=bpy.data.objects.new(mesh.name,mesh);collection.objects.link(obj);obj.parent=root
        return root


def roof(b,w,d,z):
    b.box(0,0,z,w,d,.22,CONCRETE,bevel=.04)
    for y in [-d/2+.15,d/2-.15]:b.box(0,y,z+.3,w,.3,.6,CONCRETE,bevel=.035)
    for x in [-w/2+.15,w/2-.15]:b.box(x,0,z+.3,.3,d-.6,.6,CONCRETE,bevel=.035)
    b.box(-w*.24,.4,z+.45,1.35,1.5,.6,GREEN,bevel=.08)
    b.tube((w*.25,.5,z+.1),(w*.25,.5,z+1.0),.4,SILVER,12)
    b.tube((w*.25,.5,z+1.0),(w*.25,.5,z+1.2),.56,STEEL,12,r2=.3)
    for x in [-.1,.5]:b.pipe([(x,1,z),(x,1,z+.65),(x,1.6,z+.75),(x,1.8,z+.55)],.07,STEEL)


def shop_base(name,restaurant=False):
    b=Builder(name);w,d,h=8.2,5.8,7.0
    b.box(0,-.3,.12,9.1,7.3,.24,CONCRETE,bevel=.04)
    b.box(0,.15,3.5,w,d,6.8,CONCRETE,bevel=.035)
    b.panels(w,d,h)
    # Front recess obscures the core; the storefront is built in front of it.
    b.front(0,-2.81,1.75,7.4,2.95,STEEL)
    for x in [-3.95,3.95]:b.box(x,-3.05,1.95,.4,.75,3.4,CONCRETE,bevel=.035)
    b.box(0,-3.28,3.64,9.0,1.45,.4,CONCRETE,bevel=.045)
    b.box(0,-3.79,4.08,9.0,.38,.62,CONCRETE,bevel=.035)
    b.box(0,-2.88,6.96,8.6,1.0,.8,CONCRETE,bevel=.045)
    roof(b,8.5,6.0,7.08)
    for x in [-3,0,3]:b.box(x,-3.35,3.39,.34,.25,.055,GLOW)
    for x in [-3.4,3.4]:b.tube((x,-3.75,3.48),(x,-3.03,2.88),.09,STEEL,4)
    # Complete side / rear treatment for editor rotation.
    for z in [1.75,4.75]:
        for y in [-.8,1.65]:
            b.box(4.135,y,z,.075,1.32,1.42,STEEL)
            for zz in np.arange(z-.58,z+.6,.16):b.box(4.19,y,zz,.07,1.19,.045,SILVER)
        b.front(-1.4,3.085,z,2.05,1.4,GLASS)
        b.frame(-1.4,3.16,z,2.05,1.4,STEEL,.1,.14)
    for x in [-.8,1.8]:b.pipe([(x,3.14,.3),(x,3.14,6.8),(x+.45,3.14,7.3)],.05,GREEN)
    b.box(4.18,-1.65,1.4,.18,1.05,2.4,GREEN,bevel=.035)
    b.box(4.30,-1.66,2.8,.12,.7,.09,GLOW)
    for yy in [-2.45,-2.13]:b.pipe([(4.24,yy,.25),(4.24,yy,6.7),(4.0,yy,7.38)],.055,GREEN)
    b.ladder(4.45,1.95,.35,7.2)
    for yy in [-2.3,-1.0]:b.tube((4.6,yy,.25),(4.6,yy,1.1),.065,STEEL)
    return b


def armory():
    b=shop_base('ArmoryV1')
    # Two shuttered upstairs windows and the right vertical ventilation stack.
    for x in [-2.3,.4]:
        b.window(x,-2.83,5.37,2.05,1.25,True)
        for z in np.arange(4.86,5.96,.16):b.box(x,-3.02,z,1.9,.09,.075,STEEL)
    b.vent(3.18,-2.92,5.51,.85,2.05,12);b.ac(1.85,-3.22,4.95)
    # Separate pictogram and text plaques across the cantilever.
    b.front(-2.54,-4.003,4.08,2.62,.5,STEEL,.06)
    b.rifle(-2.48,-4.05,4.07,1.15,GLOW)
    b.front(.94,-4.003,4.08,3.75,.5,STEEL,.06)
    b.text('ARMORY',.94,-4.041,4.08,3.28,GLOW,.39)
    # Glassless display recess with three low-poly weapon silhouettes.
    b.front(-2.35,-2.94,1.76,2.23,2.47,WARM)
    b.frame(-2.35,-3.08,1.76,2.28,2.52,STEEL,.17,.3)
    b.box(-2.35,-3.07,2.89,1.91,.12,.055,GLOW)
    for z in [.99,1.63,2.31]:
        b.rifle(-2.36,-3.045,z,.78,STEEL)
        for x in [-2.85,-1.8]:b.box(x,-2.99,z,.035,.07,.25,SILVER)
    for x in [-3.03,-2.62,-2.1]:b.box(x,-3.12,.66,.27,.22,.16,GREEN)
    # Central armoured door and keypad, full-height shutter on its right.
    b.front(.14,-2.99,1.65,1.49,2.63,GREEN,.15)
    b.frame(.14,-3.12,1.65,1.61,2.75,STEEL,.18,.29)
    b.frame(.14,-3.26,1.73,.89,2.13,SILVER,.04,.045)
    # Chamfered inset armour follows the reference door rather than a flat rectangle.
    door=[(-.48,.55),(.48,.55),(.62,.72),(.62,2.58),(.44,2.82),(-.44,2.82),(-.62,2.58),(-.62,.72)]
    b.face([(.14+x,-3.27,z) for x,z in door],GREEN)
    b.pipe([(.14+x,-3.285,z) for x,z in door+[door[0]]],.019,SILVER,4)
    b.front(.14,-3.29,1.98,.23,.76,GLASS,.03)
    b.lamp(.14,-3.13,3.17,.6,.08)
    for x in [-.84,1.11]:b.lamp(x,-3.1,2.32,.065,.4)
    b.box(1.22,-3.21,1.66,.36,.24,.62,STEEL,bevel=.04)
    b.front(1.22,-3.34,1.79,.24,.21,GLASS,.015)
    for x in [1.14,1.22,1.30]:
        for z in [1.42,1.49,1.56]:b.front(x,-3.345,z,.032,.033,GLOW,.012)
    b.vent(2.69,-3.015,1.72,1.76,2.65,18)
    for i in range(2):b.box(.16,-3.6-i*.28,.1+.09*(1-i),2.0,.58,.2+.18*(1-i),CONCRETE,bevel=.025)
    return b


def lantern(b,x,y,z):
    rings=[(.0,-.42),(.17,-.37),(.31,-.23),(.37,0),(.31,.23),(.17,.37),(.0,.42)]
    for (r0,z0),(r1,z1) in zip(rings,rings[1:]):b.tube((x,y,z+z0),(x,y,z+z1),max(r0,.07),RED,12,r2=max(r1,.07))
    for zz in [z-.4,z+.4]:b.tube((x,y,zz-.035),(x,y,zz+.035),.16,STEEL,12)
    for i in range(8):
        a=i*math.tau/8
        pts=[(x+max(r,.07)*math.cos(a),y+max(r,.07)*math.sin(a),z+zz) for r,zz in rings[1:-1]]
        b.pipe(pts,.008,SILVER,4)
    b.tube((x,y,z+.42),(x,y,z+.7),.018,STEEL,6)
    for xx in [-.045,0,.045]:b.tube((x+xx,y,z-.4),(x+xx,y,z-.71),.009,RED,4)


def restaurant():
    b=shop_base('ChineseRestaurantV1',True)
    b.window(-1.72,-2.9,5.35,3.33,1.55,True,3)
    # Shallow room silhouettes retain visual depth without transparent sorting.
    for x in [-2.65,-1.55,-.48]:
        b.box(x,-2.975,4.99,.63,.06,.065,STEEL)
        for dx in [-.24,.24]:b.box(x+dx,-2.98,4.81,.032,.05,.34,STEEL)
    for x in [-2.85,-.55]:
        b.box(x,-2.98,5.10,.15,.07,.18,GREEN)
        for dx in [-.09,0,.09]:b.tube((x,-2.99,5.18),(x+dx,-2.99,5.43),.014,GREEN,4)
    b.window(2.38,-2.9,5.4,1.25,1.8,True,1)
    b.box(2.26,-3.34,4.43,2.01,.85,.18,CONCRETE,bevel=.04)
    for x in np.arange(1.3,3.3,.22):b.box(x,-3.69,4.79,.036,.04,.69,GREEN)
    b.box(2.27,-3.69,5.17,2.08,.085,.085,GREEN)
    for x in [1.24,3.28]:b.tube((x,-3.69,5.17),(x,-2.92,5.17),.04,GREEN)
    b.ac(.75,-3.19,4.99)
    # Kitchen extraction duct is the distinctive right-side silhouette.
    b.box(4.42,-.3,4.61,.58,.68,4.53,SILVER,bevel=.09)
    b.box(4.15,-.3,2.5,.98,.68,.6,SILVER,bevel=.11)
    b.box(4.23,-.3,6.96,1.05,.68,.65,SILVER,bevel=.11)
    for z in np.arange(2.7,6.9,.8):b.box(4.43,-.3,z,.66,.77,.055,STEEL)
    b.box(0,-4.02,3.54,8.7,.08,.18,RED)
    for x in [-3.2,3.15]:lantern(b,x,-3.93,2.91)
    # Tall readable Chinese blade sign with a bowl icon.
    b.box(-4.8,-3.11,5.45,.95,.3,2.31,STEEL,bevel=.04)
    for z in [4.52,6.24]:b.tube((-4.75,-2.98,z),(-3.99,-2.78,z),.055,STEEL)
    b.text('中',-4.8,-3.278,6.06,.63,GLOW,.56,True)
    b.text('餐',-4.8,-3.278,5.33,.64,GLOW,.57,True)
    b.pipe([(-5.09,-3.28,4.83),(-4.97,-3.28,4.61),(-4.64,-3.28,4.61),(-4.5,-3.28,4.83)],.025,GLOW,6)
    b.tube((-4.96,-3.28,4.82),(-4.68,-3.28,4.82),.019,GLOW,6)
    for x in [-4.78,-4.65]:b.tube((x,-3.28,4.83),(x+.15,-3.28,5.06),.014,GLOW,5)
    # Narrow glass entrance left; broad counter and actual shallow kitchen right.
    b.window(-2.32,-2.94,1.74,1.57,2.76,True,2)
    b.frame(-2.32,-3.15,1.74,1.61,2.79,STEEL,.1,.18)
    b.tube((-2.03,-3.28,1.33),(-2.03,-3.28,1.86),.025,SILVER)
    b.front(1.08,-2.97,1.9,4.1,2.33,WARM)
    b.frame(1.08,-3.08,1.91,4.11,2.39,STEEL,.13,.21)
    b.box(1.08,-3.4,1.06,4.45,.68,.11,SILVER,bevel=.025)
    b.box(1.08,-3.0,.66,4.1,.23,.75,STEEL)
    b.box(1.08,-3.1,2.63,3.91,.39,.47,SILVER,bevel=.09)
    for x in np.arange(-.65,2.9,.32):b.box(x,-3.32,2.63,.025,.06,.31,STEEL)
    b.box(1.08,-3.37,2.39,3.53,.035,.036,GLOW)
    b.box(1.08,-3.05,1.49,3.94,.2,.075,SILVER)
    for x in [-.64,.28,1.21,2.32]:
        b.box(x,-3.005,1.91,.63,.035,.052,STEEL)
        for dx in [-.19,.05,.22]:
            b.tube((x+dx,-3.045,1.94),(x+dx,-3.045,2.13),.046,GREEN,6)
            b.box(x+dx,-3.07,2.02,.055,.025,.06,SILVER)
    for x in [-.5,.22,1.08,1.89,2.64]:
        b.tube((x,-3.22,1.12),(x,-3.22,1.3),.15,SILVER,10)
        b.tube((x,-3.22,1.3),(x,-3.22,1.34),.17,STEEL,10,r2=.1)
    for x in [0,1.59]:
        b.box(x,-3.77,.62,.49,.45,.08,RED)
        for dx in [-.2,.2]:
            for dy in [-.16,.16]:b.tube((x+dx*1.16,-3.77+dy*1.3,.24),(x+dx,-3.77+dy,.58),.03,STEEL,5)
    b.front(-3.44,-3.14,1.51,.44,.8,SILVER)
    b.text('MENU',-3.44,-3.19,1.78,.34,STEEL,.1)
    for z in [1.55,1.43,1.31]:b.front(-3.44,-3.19,z,.29,.016,STEEL,.01)
    b.box(-3.78,-3.62,.52,.49,.46,.55,CONCRETE,bevel=.03)
    for i in range(7):
        x=-3.78+math.sin(i*2.3)*.15;y=-3.62+math.cos(i*2.3)*.13
        b.tube((x,y,.8),(x+.12*math.sin(i),y,.98+i*.055),.013,GREEN,4)
        b.face([(x,y,.92+i*.055),(x+.18,y+.045,1.04+i*.055),(x+.01,y+.06,1.08+i*.055)],GREEN)
    return b


def administration():
    b=Builder('CentralAdministrationV1')
    b.box(0,.0,.2,22.1,12.8,.4,CONCRETE,bevel=.06)
    # Recessed base hall and two three-storey wings; five-storey central tower.
    b.box(0,.9,8.8,8.2,8.5,16.8,CONCRETE,bevel=.065)
    for x in [-7.35,7.35]:
        b.box(x,.55,5.38,6.25,8.0,9.9,CONCRETE,bevel=.065)
        for z in [2.2,5.18,8.15]:
            b.window(x,-3.51,z,4.83,1.35,False,4)
            for dx in [-1.4,.8]:b.box(x+dx,-3.60,z+.4,.5,.03,.025,GLOW)
        b.box(x,-3.63,10.26,6.5,.48,.8,CONCRETE,bevel=.05)
        for z in [3.65,6.62]:b.box(x,-3.66,z,6.4,.6,.46,CONCRETE,bevel=.04)
        for dx in [-2.8,2.8]:b.box(x+dx,-3.54,5.38,.48,.47,9.9,CONCRETE,bevel=.03)
        b.box(x,.55,10.43,6.5,8.25,.22,CONCRETE,bevel=.04)
        b.box(x+.8,1.2,11.02,2.1,2.2,1.05,GREEN,bevel=.07)
        for yy in [-3.14,4.34]:
            for xx in np.arange(x-2.9,x+3,.8):b.tube((xx,yy,10.55),(xx,yy,11.14),.028,STEEL,6)
            b.tube((x-3,yy,11.16),(x+3,yy,11.16),.03,STEEL,6)
    # Tower vertical concrete piers and dark deeply set window slots.
    for x in [-3.13,-1.91,1.91,3.13]:
        b.front(x,-3.45,10.24,.59,12.8,GLASS,.05)
        for z in [5.32,7.85,10.38,12.91,15.44]:
            b.box(x,-3.54,z,.57,.035,.045,STEEL)
            b.box(x,-3.56,z+.9,.3,.02,.026,GLOW)
    for x,w in [(-3.9,.52),(-2.53,.51),(0,2.47),(2.53,.51),(3.9,.52)]:
        lower=7.42 if abs(x)<3 else 4.0
        b.box(x,-3.74,(17.315+lower)/2,w,.67,17.315-lower,CONCRETE,bevel=.045)
        for z in np.arange(lower+.8,17,1.45):b.front(x,-4.081,z,w,.016,STEEL,.007)
    b.vent(0,-4.1,15.7,1.84,1.22,9)
    # Monumental portal framing a tall amber glazed lobby.
    b.front(0,-3.71,3.53,4.2,4.95,WARM,.04)
    b.frame(0,-4.08,3.53,4.22,4.95,STEEL,.13,.2)
    for x in [-1.05,0,1.05]:b.box(x,-4.12,3.52,.07,.07,4.88,SILVER)
    for z in [2.75,4.83]:b.box(0,-4.14,z,4.2,.07,.07,STEEL)
    for x in [-.54,.54]:b.box(x,-4.16,2.54,.025,.05,.43,SILVER)
    for x in [-2.66,2.66]:
        b.box(x,-4.01,3.68,.94,1.22,5.92,CONCRETE,bevel=.055)
        b.lamp(x,-4.66,4.35,.055,.92)
    b.box(0,-4.06,6.91,6.58,1.35,.96,CONCRETE,bevel=.05)
    b.text('CENTRAL ADMINISTRATION',0,-4.745,6.9,5.84,STEEL,.29)
    for x in [-1.7,0,1.7]:b.box(x,-4.42,6.39,.39,.2,.033,GLOW)
    # Extruded six-piece geometric emblem, as in the reference.
    emblem=[(-.53,10.5),(-.53,12.57),(0,13.13),(.53,12.57),(.53,10.5),(0,9.96)]
    b.face([(x,-4.16,z) for x,z in emblem],STEEL)
    for side in [-1,1]:
        points=[(.69,10.2),(.69,12.09),(1.1,11.67),(1.1,9.65),(.37,8.99),(.37,9.82)]
        b.face([(x*side,-4.165,z) for x,z in (points if side==1 else list(reversed(points)))],STEEL)
    # Wide twelve-step civic entrance, with substantial sloped cheeks.
    for i in range(12):
        depth=3.0-i*.23;height=.16+i*.105
        b.box(0,-4.0-depth/2,height/2,6.9,depth,height,CONCRETE,bevel=.015)
    for x in [-3.71,3.71]:
        b.box(x,-5.36,.62,.6,2.97,.85,CONCRETE,bevel=.045)
        b.tube((x,-6.64,.61),(x,-4.04,1.81),.12,CONCRETE,4)
    for x in [-8.2,8.2]:b.vent(x,-3.83,1.64,2.01,1.66,10)
    # Side and rear architectural continuity.
    for x in [-10.53,10.53]:
        for z in [2.2,5.2,8.17]:
            for y in [-1.37,1.46,3.66]:b.box(x,y,z,.11,1.65,1.2,GLASS)
        for yy in [-2.2,-1.91]:b.pipe([(x+.05,yy,.45),(x+.05,yy,8.9),(x+.05,yy+.48,9.43)],.073,GREEN)
    for side in [-1,1]:
        for y in [-1.67,1.17,3.74]:
            b.box(side*4.15,y,13.67,.08,.64,6.37,GLASS)
            for z in [11.17,13.7,16.22]:b.box(side*4.2,y,z,.035,.66,.055,STEEL)
    for x in [-7.4,0,7.4]:
        for z in [2.5,5.5,8.5]:
            b.front(x,4.71,z,3.9,1.25,GLASS)
            b.frame(x,4.79,z,3.9,1.25,STEEL,.09,.16)
    b.ladder(10.83,3.25,.45,10.65)
    b.tube((10.7,-.1,8.32),(10.86,-.1,8.32),.78,STEEL,16)
    for z in np.arange(7.75,8.96,.18):b.box(10.94,-.1,z,.085,1.18,.065,SILVER)
    b.box(0,.9,17.38,8.4,8.7,.32,CONCRETE,bevel=.04)
    b.box(-1.3,.8,18.03,3.05,2.23,1.1,STEEL,bevel=.07)
    b.vent(-1.3,-.35,18.03,2.85,.83,6)
    for x in [-.4,.4]:b.tube((x,1.42,17.6),(x,1.42,21),.058,STEEL)
    for z in np.arange(17.8,21,.65):b.tube((-.4,1.42,z),(.4,1.42,z+.55),.031,STEEL,6)
    for z in [18.4,19.6,20.7]:
        b.box(.63,1.43,z,.27,.32,.81,SILVER,bevel=.035)
        b.box(-.62,1.43,z,.2,.31,.61,STEEL,bevel=.025)
    b.tube((0,1.42,20.8),(0,1.42,22.0),.025,STEEL,6)
    for x in [-3.1,2.8]:b.tube((x,1,17.5),(x,1,19.2),.028,STEEL,6)
    b.tube((7.8,1.2,10.6),(7.8,1.2,11.85),.56,SILVER,12)
    return b


BUILDERS=[('armory',armory),('chinese-restaurant',restaurant),('central-administration',administration)]


def patch_factors(path):
    data=path.read_bytes();length=struct.unpack_from('<I',data,12)[0]
    doc=json.loads(data[20:20+length]);byname={PREFIX+n:c for n,c,*_ in SPECS}
    for m in doc['materials']:
        if 'baseColorTexture' in m.get('pbrMetallicRoughness',{}):m['pbrMetallicRoughness']['baseColorFactor']=byname[m['name'].split('.')[0]]
    encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
    tail=data[20+length:];total=12+8+len(encoded)+len(tail)
    path.write_bytes(struct.pack('<4sII',b'glTF',2,total)+struct.pack('<I4s',len(encoded),b'JSON')+encoded+tail)
    return doc


def main():
    OUT.mkdir(parents=True,exist_ok=True);PUBLIC.mkdir(parents=True,exist_ok=True)
    # Regenerate only this script's marked output, never the user's open project.
    previous=bpy.data.scenes.get('CyberBase Reference Buildings V1')
    if previous and previous.get('generator')=='scripts/build-reference-buildings.py':
        if bpy.context.window.scene==previous:
            raise RuntimeError('Switch away from the generated scene before rebuilding it')
        for collection in list(previous.collection.children):
            for obj in list(collection.objects):
                data=obj.data;bpy.data.objects.remove(obj,do_unlink=True)
                if isinstance(data,bpy.types.Mesh) and data.users==0:bpy.data.meshes.remove(data)
            bpy.data.collections.remove(collection)
        world=previous.world;bpy.data.scenes.remove(previous)
        if world and world.users==0:bpy.data.worlds.remove(world)
        for mat in list(bpy.data.materials):
            if mat.name.startswith(PREFIX) and mat.users==0:bpy.data.materials.remove(mat)
        for img in list(bpy.data.images):
            if img.name.startswith(PREFIX) and img.users==0:bpy.data.images.remove(img)
    prior_scene=bpy.context.window.scene
    scene=bpy.data.scenes.new('CyberBase Reference Buildings V1')
    scene['generator']='scripts/build-reference-buildings.py'
    scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
    bpy.context.window.scene=scene
    roots=[];stats={}
    try:
        mats=materials(surface_image(),concrete_image())
        for slug,build in BUILDERS:
            collection=bpy.data.collections.new(PREFIX+slug);scene.collection.children.link(collection)
            root=build().finish(collection,mats);roots.append(root)
            if slug=='central-administration':
                # Apply to mesh data: editor scale 1 and collision bounds agree.
                for obj in root.children:
                    for vertex in obj.data.vertices:vertex.co*=.6
                    for loop in obj.data.uv_layers.active.data:loop.uv*=.6
                    obj.data.update()
            bpy.context.view_layer.update()
            # Ground and centre all geometry including protruding signs and stairs.
            points=[obj.matrix_world@v.co for obj in root.children for v in obj.data.vertices]
            lo=Vector(tuple(min(p[i] for p in points) for i in range(3)))
            hi=Vector(tuple(max(p[i] for p in points) for i in range(3)))
            offset=Vector((-(lo.x+hi.x)/2,-(lo.y+hi.y)/2,-lo.z))
            for obj in root.children:
                for v in obj.data.vertices:v.co+=offset
                obj.data.update()
            for obj in scene.objects:obj.select_set(False)
            root.select_set(True)
            for obj in root.children:obj.select_set(True)
            bpy.context.view_layer.objects.active=root
            path=PUBLIC/(slug+'.glb')
            bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False,export_materials='EXPORT',export_image_format='JPEG',export_image_quality=85,export_jpeg_quality=85,export_yup=True)
            doc=patch_factors(path)
            tris=sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives'])
            primitives=sum(len(m['primitives']) for m in doc['meshes'])
            stats[slug]={'root':root.name,'triangles':tris,'drawCalls':primitives,'width':round(hi.x-lo.x,4),'depth':round(hi.y-lo.y,4),'height':round(hi.z-lo.z,4),'bytes':path.stat().st_size}
            root.location.x=(len(roots)-1)*29
        bpy.context.view_layer.update()
        scene.world=bpy.data.worlds.new(PREFIX+'StudioWorld');scene.world.use_nodes=True
        scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.32,.35,.38,1)
        scene.world.node_tree.nodes['Background'].inputs[1].default_value=.55
        scene.render.engine='CYCLES';scene.cycles.samples=24
        scene.render.threads_mode='FIXED';scene.render.threads=4
        scene.render.resolution_x=1100;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
        scene.view_settings.view_transform='AgX'
        scene.render.image_settings.file_format='PNG'
        # Save only this authoring scene and its dependencies, preserving the open file.
        bpy.data.libraries.write(str(OUT/'cyberbase-buildings-v1.blend'),{scene},fake_user=True,compress=True)
        (OUT/'metrics.json').write_text(json.dumps(stats,indent=2),encoding='utf8')
        return {'scene':scene.name,'assets':stats,'source':str(OUT/'cyberbase-buildings-v1.blend')}
    finally:
        bpy.context.window.scene=prior_scene


if __name__=='__main__':
    print(json.dumps(main(),indent=2))
