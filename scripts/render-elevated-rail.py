"""Create an asset review in the existing Blender, using four CPU threads."""
from pathlib import Path
import math
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]


def render():
    previous=bpy.context.window.scene
    source=bpy.data.scenes['CyberBase Elevated Rail V1']
    scene=bpy.data.scenes.new('CBRail_Review');scene.world=source.world
    bpy.context.window.scene=scene
    made=[]
    def instance(name,x,z,angle=0):
        original=source.objects[name]
        root=bpy.data.objects.new('Review_'+name,None);scene.collection.objects.link(root);made.append(root)
        root.location=(x,3 if name=='RailPier' else 0,z);root.rotation_euler.z=angle
        for child in original.children:
            copy=child.copy();scene.collection.objects.link(copy);copy.parent=root;made.append(copy)
    for x in [-12,-4,4,12,20]:instance('RailDeck',x,14.9)
    for x in [-8,8,24]:instance('RailPier',x,0)
    instance('TrainCar',11,15.0773)
    instance('TrainMiddle',1.15,15.0773)
    instance('TrainCar',-8.7,15.0773,math.pi)
    center=Vector((4,0,9))
    def light(pos,power,color,size):
        data=bpy.data.lights.new('RailReviewLight','AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size
        obj=bpy.data.objects.new(data.name,data);scene.collection.objects.link(obj);made.append(obj)
        obj.location=pos;obj.rotation_euler=(center-obj.location).to_track_quat('-Z','Y').to_euler()
    light((0,-22,38),26000,(.74,.85,1),22)
    light((20,14,30),29000,(1,.72,.48),18)
    light((-25,-8,19),18000,(.47,.7,1),20)
    data=bpy.data.cameras.new('RailReviewCamera');camera=bpy.data.objects.new(data.name,data);scene.collection.objects.link(camera);made.append(camera)
    camera.location=(38,-58,35);camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
    data.type='ORTHO';data.ortho_scale=49;scene.camera=camera
    bpy.ops.mesh.primitive_plane_add(size=500,location=(0,0,-.03));floor=bpy.context.object;made.append(floor)
    ground=bpy.data.materials.new('RailReviewGround');ground.diffuse_color=(.028,.034,.042,1);floor.data.materials.append(ground)
    scene.render.engine='CYCLES';scene.cycles.samples=20;scene.cycles.use_denoising=True
    scene.render.threads_mode='FIXED';scene.render.threads=4
    scene.render.resolution_x=1400;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'
    path=ROOT/'output/elevated-rail/v1/rail-review.png';scene.render.filepath=str(path)
    try:
        bpy.ops.render.render(write_still=True)
        return {'path':str(path)}
    finally:
        bpy.context.window.scene=previous
        for obj in made:
            data=obj.data;bpy.data.objects.remove(obj,do_unlink=True)
            if data and data.users==0:
                if isinstance(data,bpy.types.Mesh):bpy.data.meshes.remove(data)
                elif isinstance(data,bpy.types.Camera):bpy.data.cameras.remove(data)
                elif isinstance(data,bpy.types.Light):bpy.data.lights.remove(data)
        bpy.data.materials.remove(ground);bpy.data.scenes.remove(scene)
