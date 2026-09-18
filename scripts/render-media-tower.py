"""Review the authored tower without changing the user's open scene."""
from pathlib import Path
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]


def main():
    source=bpy.data.scenes['CyberBase Media Tower V1']
    previous=bpy.context.window.scene
    scene=bpy.data.scenes.new('CBM1_Review');scene.collection.children.link(source.collection.children[0])
    scene.world=source.world;bpy.context.window.scene=scene
    made=[];center=Vector((0,0,16.2))
    def light(name,pos,power,color,size):
        data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size
        obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);made.append(obj)
        obj.location=pos;obj.rotation_euler=(center-obj.location).to_track_quat('-Z','Y').to_euler()
    light('CBM1_Key',(-19,-30,42),9000,(.72,.84,1),22)
    light('CBM1_Fill',(23,-15,24),3500,(1,.78,.51),18)
    light('CBM1_Rim',(6,22,39),11000,(.53,.74,1),18)
    data=bpy.data.cameras.new('CBM1_ReviewCamera');camera=bpy.data.objects.new(data.name,data)
    scene.collection.objects.link(camera);made.append(camera)
    camera.location=(-39,-62,37);camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
    data.type='ORTHO';data.ortho_scale=42;scene.camera=camera
    scene.render.engine='CYCLES';scene.cycles.samples=20;scene.cycles.use_denoising=True
    scene.render.threads_mode='FIXED';scene.render.threads=4
    scene.render.resolution_x=840;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG'
    path=ROOT/'output/building-models/media-tower-v1/blender-review.png';scene.render.filepath=str(path)
    try:
        bpy.ops.render.render(write_still=True)
        return {'path':str(path)}
    finally:
        bpy.context.window.scene=previous
        for obj in made:
            data=obj.data;bpy.data.objects.remove(obj,do_unlink=True)
            if isinstance(data,bpy.types.Camera):bpy.data.cameras.remove(data)
            elif isinstance(data,bpy.types.Light):bpy.data.lights.remove(data)
        bpy.data.scenes.remove(scene)


if __name__=='__main__':print(main())
