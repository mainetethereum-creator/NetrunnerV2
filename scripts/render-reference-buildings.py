"""Render one authored building in the existing Blender instance, using four CPU threads."""
from pathlib import Path
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]


def render(slug):
    source=bpy.data.scenes.get('CyberBase Reference Buildings V1')
    if source is None:raise RuntimeError('Build the reference scene first')
    collection=next(c for c in source.collection.children if c.name=='CBR1_'+slug)
    previous=bpy.context.window.scene
    scene=bpy.data.scenes.new('CBR1_Review_'+slug)
    scene.collection.children.link(collection)
    scene.world=source.world
    bpy.context.window.scene=scene
    root=next(o for o in collection.objects if o.type=='EMPTY')
    bpy.context.view_layer.update()
    points=[o.matrix_world@Vector(p) for o in root.children for p in o.bound_box]
    lo=Vector([min(p[i] for p in points) for i in range(3)])
    hi=Vector([max(p[i] for p in points) for i in range(3)])
    center=(lo+hi)/2;size=hi-lo;span=max(size)
    created=[]
    def light(name,pos,power,color,area):
        data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=area;data.color=color
        o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);created.append(o)
        o.location=pos;o.rotation_euler=(center-o.location).to_track_quat('-Z','Y').to_euler()
    light('CBR1_Key',center+Vector((-span,-span*1.3,span*1.5)),span*span*32,(1,.9,.78),span*.9)
    light('CBR1_Fill',center+Vector((span*.85,-span*.5,span*.65)),span*span*14,(.8,.9,1),span)
    light('CBR1_Rim',center+Vector((span*.5,span,span)),span*span*24,(1,.94,.85),span)
    data=bpy.data.cameras.new('CBR1_ReviewCamera');camera=bpy.data.objects.new(data.name,data);scene.collection.objects.link(camera);created.append(camera)
    camera.location=center+Vector((.8,-1.8,.68))*span;camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
    data.type='ORTHO';data.ortho_scale=span*1.4;scene.camera=camera
    bpy.ops.mesh.primitive_plane_add(size=span*200,location=(center.x,center.y,-.02));floor=bpy.context.object;created.append(floor)
    mat=bpy.data.materials.new('CBR1_ReviewGround');mat.diffuse_color=(.23,.24,.25,1);floor.data.materials.append(mat)
    scene.render.engine='CYCLES';scene.cycles.samples=20;scene.cycles.use_denoising=True
    scene.render.threads_mode='FIXED';scene.render.threads=4
    scene.render.resolution_x=1100;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'
    path=ROOT/'output/building-models/v1'/(slug+'-render.png')
    scene.render.filepath=str(path)
    try:
        bpy.ops.render.render(write_still=True)
        return {'path':str(path)}
    finally:
        bpy.context.window.scene=previous
        for obj in created:
            data=obj.data;bpy.data.objects.remove(obj,do_unlink=True)
            if isinstance(data,bpy.types.Mesh):bpy.data.meshes.remove(data)
            elif isinstance(data,bpy.types.Camera):bpy.data.cameras.remove(data)
            elif isinstance(data,bpy.types.Light):bpy.data.lights.remove(data)
        bpy.data.materials.remove(mat)
        bpy.data.scenes.remove(scene)
