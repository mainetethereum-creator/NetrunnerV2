"""Modernized low-poly transit kit, authored in the existing Blender session.

V1 stays intact. Four local-origin prototypes export into a portable GLB; the
separate editable source never overwrites the owner's open file. Curved routing,
city cables and dynamic light are owned by the runtime rather than this kit.
"""
from pathlib import Path
import importlib.util
import json
import math
import struct

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/elevated-rail/v2'
PUBLIC = ROOT / 'public/base/models/elevated-rail-v2.glb'
SCENE = 'CyberBase Elevated Rail V2'
CONCRETE, STEEL, BODY, ALLOY, WINDOW, AMBER, CYAN, WHITE, RED = range(9)


def load_original():
    spec = importlib.util.spec_from_file_location('rail_v2_base', ROOT / 'scripts/build-elevated-rail.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    # Same semantic material names preserve runtime concrete substitution.
    module.SPECS = [
        ('Concrete', (.33975, .3465, .3555, 1), .94, 0, 0),
        ('BlackSteel', (.018, .025, .031, 1), .62, .6, 0),
        ('MidnightBody', (.036, .072, .098, 1), .34, .68, 0),
        ('WornAlloy', (.26, .32, .35, 1), .43, .76, 0),
        ('WarmWindows', (.58, .35, .16, 1), .3, .15, 1.05),
        ('AmberSignal', (1, .48, .15, 1), .4, 0, 3.0),
        ('CyanGuide', (.18, .65, 1, 1), .35, .1, 3.3),
        ('Headlight', (.72, .9, 1, 1), .3, 0, 5.0),
        ('RedSignal', (.8, .055, .035, 1), .4, 0, 2.0),
    ]
    return module


def deck(base, B):
    b = base.deck(B)
    # Narrow luminous kerb top catches a high gameplay view; edge length is exact
    # so adjacent modules meet without dark gaps or overlap outside the envelope.
    for side in [-1, 1]:
        b.box(0, side * 2.075, .333, 8, .055, .014, CYAN)
        for x in [-2.6, 2.6]:
            b.box(x, side * 2.231, -.69, .88, .012, .12, STEEL)
            b.box(x, side * 2.242, -.69, .68, .009, .06, WHITE)
            b.box(x, side * 1.89, .058, .48, .12, .012, AMBER)
        # Encased under-deck warm slots supplement the continuous amber guide.
        b.box(0, side * 1.8, -.994, 2.9, .13, .07, STEEL)
        b.box(0, side * 1.8, -1.036, 2.55, .065, .014, AMBER)
    return b


def pier(base, B):
    b = base.pier(B)
    # Cool service markers complement the existing warm vertical recesses.
    for side in [-1, 1]:
        for z in [3.2, 10.5]:
            b.box(0, side * 1.054, z, .29, .02, .03, CYAN)
        b.box(side * .92, 0, 13.58, .025, 1.75, .045, AMBER)
    return b


def train(base, B, cab):
    b = B('TrainCar' if cab else 'TrainMiddle')
    if cab:
        sections = [(-4.5, 1.08, 2.75, .38), (-4.15, 1.25, 2.92, .32),
                    (2.6, 1.25, 2.92, .32), (3.35, 1.16, 2.6, .36),
                    (4.22, .94, 1.43, .40), (4.5, .78, 1.18, .43)]
    else:
        sections = [(-4.5, 1.08, 2.75, .38), (-4.15, 1.25, 2.92, .32),
                    (4.15, 1.25, 2.92, .32), (4.5, 1.08, 2.75, .38)]
    base.shell(b, sections)
    body_end = 2.57 if cab else 4.12
    center = (-4.12 + body_end) / 2
    length = body_end + 4.12
    for side in [-1, 1]:
        y = side * 1.257
        b.box(center, y, 1.91, length, .045, 1.08, STEEL)
        xs = [-3.62, -2.71, -.88, .02, 1.83]
        if not cab:
            xs += [2.74, 3.64]
        for x in xs:
            b.box(x, y + side * .029, 1.97, .73, .02, .74, WINDOW)
            # A low silhouette and an interior handrail read as occupied glazing.
            b.box(x + .16, y + side * .042, 1.65, .22, .014, .14, STEEL)
            b.box(x - .2, y + side * .044, 1.95, .018, .014, .65, ALLOY)
            b.box(x, y + side * .043, 2.29, .59, .013, .025, AMBER)
        for x in [-1.8, .93]:
            b.box(x, y + side * .01, 1.62, .78, .065, 1.97, ALLOY, .04)
            b.box(x, y + side * .05, 1.64, .66, .025, 1.84, STEEL)
            for shift in [-.17, .17]:
                b.box(x + shift, y + side * .07, 2.02, .26, .02, .6, WINDOW)
            b.box(x, y + side * .085, 1.58, .025, .025, 1.72, ALLOY)
            b.box(x + .46, y + side * .08, 1.32, .055, .02, .09, AMBER)
            b.box(x, y + side * .08, .58, .83, .12, .045, ALLOY)
            b.box(x, y + side * .073, 2.65, .67, .03, .07, STEEL)
            b.box(x, y + side * .094, 2.65, .41, .015, .025, CYAN)
        b.box(center, y, 1.2, length, .05, .075, ALLOY)
        b.box(center, y + side * .032, .89, length, .025, .055, CYAN)
        b.box(center, y, .61, length, .06, .12, STEEL)
        b.box(center, side * 1.068, 2.775, length, .025, .029, CYAN)
        for x in [-3.4, -.6, 2.1]:
            b.box(x, y + side * .04, .7, .055, .015, .085, ALLOY)
        if side == -1:
            b.text('CB / 07', -2.9, y - .064, 1.15, .68, ALLOY, .12)
    # Exact V1 wheel/rail contact and car coupling envelope.
    for x in [-2.9, 2.6]:
        b.box(x, 0, .35, 1.6, 1.9, .42, STEEL, .08)
        for xx in [x - .49, x + .49]:
            b.tube((xx, -1.05, .26), (xx, 1.05, .26), .26, STEEL, 10)
            for side in [-1, 1]:
                b.tube((xx, side * 1.052, .26), (xx, side * 1.078, .26), .14, ALLOY, 8)
    for x in [-2.5, .15]:
        b.box(x, 0, 2.98, 1.65, 1.36, .19, STEEL, .05)
        for xx in [x - .55, x - .33, x - .11, x + .11, x + .33, x + .55]:
            b.box(xx, 0, 3.084, .075, 1.05, .025, ALLOY)
    for y in [-.9, .9]:
        b.box(center, y, 2.935, length, .045, .026, CYAN)
    for x in ([-4.56] if cab else [-4.56, 4.56]):
        b.box(x, 0, 1.45, .12, 1.5, 2.1, STEEL, .07)
        for yy in [-.65, -.4, -.15, .15, .4, .65]:
            b.box(x * 1.009, yy, 1.45, .03, .045, 1.96, ALLOY)
        b.box(x * 1.034, 0, .5, .22, .4, .2, ALLOY)
    if cab:
        # Folded wrap-around dark windscreen on the broad three-facet nose.
        for x1, x2, z1, z2, w1, w2 in [
            (2.72, 3.35, 2.883, 2.616, .86, .78),
            (3.35, 4.14, 2.616, 1.554, .78, .645),
        ]:
            b.face([(x1, -w1, z1), (x2, -w2, z2),
                    (x2, w2, z2), (x1, w1, z1)], STEEL)
        for side in [-1, 1]:
            # Cockpit side pane: lifted a few millimetres beyond the shell facets.
            b.face([(2.7, side * 1.247, 2.44), (3.31, side * 1.176, 2.18),
                    (3.31, side * 1.176, 1.73), (2.7, side * 1.247, 1.73)], STEEL)
            contour = [(2.64, side * .945, 2.927), (3.355, side * .867, 2.612),
                       (4.225, side * .704, 1.444), (4.514, side * .58, 1.195)]
            for a, z in zip(contour, contour[1:]):
                b.tube(a, z, .028, WHITE, 6)
            # Long low cyan swoosh terminates at the separate white main lamps.
            b.tube((2.6, side * 1.261, .89), (4.52, side * .775, .73), .031, CYAN, 6)
            b.box(4.522, side * .48, .91, .028, .33, .16, STEEL, .007)
            b.box(4.542, side * .48, .925, .013, .265, .079, WHITE)
        b.box(4.517, 0, .72, .035, 1.09, .12, STEEL, .011)
        b.box(4.539, 0, .746, .012, .86, .037, CYAN)
        b.tube((3.76, -.36, 2.079), (3.77, .26, 2.068), .015, ALLOY, 4)
    return b


def patch_prototype_names(path):
    data = path.read_bytes()
    length = struct.unpack_from('<I', data, 12)[0]
    doc = json.loads(data[20:20 + length])
    for node in doc['nodes']:
        if node.get('name', '').startswith('CBRailV2_'):
            node['name'] = node['name'].removeprefix('CBRailV2_')
    encoded = json.dumps(doc, separators=(',', ':')).encode()
    encoded += b' ' * ((-len(encoded)) % 4)
    tail = data[20 + length:]
    path.write_bytes(struct.pack('<4sII', b'glTF', 2, 20 + len(encoded) + len(tail))
                     + struct.pack('<I4s', len(encoded), b'JSON') + encoded + tail)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    PUBLIC.parent.mkdir(parents=True, exist_ok=True)
    previous = bpy.context.window.scene
    if bpy.context.mode != 'OBJECT':
        raise RuntimeError('Run from Object mode to preserve the user edit session')
    if bpy.data.scenes.get(SCENE):
        raise RuntimeError('V2 scene exists: retain it and choose an explicit revision')
    scene = bpy.data.scenes.new(SCENE)
    scene['generator'] = 'scripts/build-elevated-rail-v2.py'
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1
    bpy.context.window.scene = scene
    base = load_original()
    helpers = base.builder_module()
    roots = []
    stats = {}
    try:
        mats = base.materials()
        builds = [lambda: deck(base, helpers.Builder), lambda: pier(base, helpers.Builder),
                  lambda: train(base, helpers.Builder, True), lambda: train(base, helpers.Builder, False)]
        for build in builds:
            b = build()
            canonical = b.name
            # Distinct names in the live file: V1 objects and user's selection stay intact.
            b.name = 'CBRailV2_' + canonical
            collection = bpy.data.collections.new(b.name)
            scene.collection.children.link(collection)
            root = b.finish(collection, mats)
            root['prototype'] = canonical
            roots.append(root)
            if canonical == 'RailPier':
                for obj in root.children:
                    for vertex in obj.data.vertices:
                        vertex.co.z *= .92
                    obj.data.update()
            points = [v.co for obj in root.children for v in obj.data.vertices]
            stats[canonical] = {
                'dimensions': [round(max(p[i] for p in points) - min(p[i] for p in points), 4) for i in range(3)],
                'bounds': [[round(f(p[i] for p in points), 5) for i in range(3)] for f in [min, max]],
                'triangles': sum(sum(len(p.vertices) - 2 for p in obj.data.polygons) for obj in root.children),
                'draws': len(root.children),
            }
        bpy.context.view_layer.update()
        for obj in scene.objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = roots[0]
        bpy.ops.export_scene.gltf(
            filepath=str(PUBLIC), export_format='GLB', use_selection=True,
            use_active_scene=True, export_apply=True, export_animations=False,
            export_cameras=False, export_lights=False, export_materials='EXPORT',
            export_image_format='JPEG', export_image_quality=85, export_jpeg_quality=85,
            export_yup=True,
        )
        helpers.patch_factors(PUBLIC)
        patch_prototype_names(PUBLIC)
        for root, x in zip(roots, [-16, 0, 16, 29]):
            root.location.x = x
        scene.world = bpy.data.worlds.new('CBRailV2_World')
        scene.world.use_nodes = True
        scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.035, .055, .085, 1)
        scene.world.node_tree.nodes['Background'].inputs[1].default_value = .3
        scene.render.threads_mode = 'FIXED'
        scene.render.threads = 4
        bpy.data.libraries.write(str(OUT / 'cyberbase-elevated-rail-v2.blend'), {scene}, fake_user=True, compress=True)
        stats['bytes'] = PUBLIC.stat().st_size
        stats['instanced'] = {
            'triangles': stats['RailDeck']['triangles'] * 24 + stats['RailPier']['triangles'] * 9
                         + stats['TrainCar']['triangles'] * 2 + stats['TrainMiddle']['triangles'],
            'draws': sum(stats[name]['draws'] for name in ['RailDeck', 'RailPier', 'TrainCar', 'TrainMiddle']),
        }
        assert stats['instanced']['triangles'] < 45000
        assert stats['instanced']['draws'] <= 28
        (OUT / 'metrics.json').write_text(json.dumps(stats, indent=2), encoding='utf8')
        return {'scene': scene.name, 'file': str(PUBLIC), 'metrics': stats}
    finally:
        bpy.context.window.scene = previous


def render_review():
    """Render one small asset review; no extra Blender process or persistent lights."""
    previous = bpy.context.window.scene
    source = bpy.data.scenes[SCENE]
    scene = bpy.data.scenes.new('CBRailV2_Review')
    scene.world = source.world
    bpy.context.window.scene = scene
    made = []
    ground = None

    def instance(name, x, z, angle=0):
        original = next(obj for obj in source.objects if obj.get('prototype') == name)
        root = bpy.data.objects.new('ReviewV2_' + name, None)
        scene.collection.objects.link(root)
        made.append(root)
        root.location = (x, 3 if name == 'RailPier' else 0, z)
        root.rotation_euler.z = angle
        if name == 'RailPier':
            root.scale.z = 12.1 / 13.8
        for child in original.children:
            copy = child.copy()
            scene.collection.objects.link(copy)
            copy.parent = root
            made.append(copy)

    try:
        for x in [-12, -4, 4, 12, 20]:
            instance('RailDeck', x, 13.2)
        for x in [-8, 8, 24]:
            instance('RailPier', x, 0)
        instance('TrainCar', 11, 13.3773)
        instance('TrainMiddle', 1.15, 13.3773)
        instance('TrainCar', -8.7, 13.3773, math.pi)
        center = Vector((4, 0, 8.5))
        for pos, power, color, size in [
            ((0, -22, 38), 11000, (.65, .8, 1), 22),
            ((20, 14, 30), 13500, (1, .72, .48), 18),
            ((-25, -8, 19), 8500, (.4, .65, 1), 20),
        ]:
            data = bpy.data.lights.new('CBRailV2_ReviewLight', 'AREA')
            data.energy, data.color, data.size = power, color, size
            data.shape = 'DISK'
            obj = bpy.data.objects.new(data.name, data)
            scene.collection.objects.link(obj)
            made.append(obj)
            obj.location = pos
            obj.rotation_euler = (center - obj.location).to_track_quat('-Z', 'Y').to_euler()
        data = bpy.data.cameras.new('CBRailV2_ReviewCamera')
        camera = bpy.data.objects.new(data.name, data)
        scene.collection.objects.link(camera)
        made.append(camera)
        camera.location = (38, -58, 35)
        camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()
        data.type = 'ORTHO'
        data.ortho_scale = 49
        scene.camera = camera
        bpy.ops.mesh.primitive_plane_add(size=500, location=(0, 0, -.03))
        floor = bpy.context.object
        made.append(floor)
        ground = bpy.data.materials.new('CBRailV2_ReviewGround')
        ground.diffuse_color = (.013, .019, .028, 1)
        floor.data.materials.append(ground)
        scene.render.engine = 'CYCLES'
        scene.cycles.samples = 16
        scene.cycles.use_denoising = True
        scene.render.threads_mode = 'FIXED'
        scene.render.threads = 4
        scene.render.resolution_x = 1100
        scene.render.resolution_y = 800
        scene.render.resolution_percentage = 100
        scene.view_settings.view_transform = 'AgX'
        path = OUT / 'rail-review.png'
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        return {'path': str(path)}
    finally:
        bpy.context.window.scene = previous
        for obj in made:
            data = obj.data
            bpy.data.objects.remove(obj, do_unlink=True)
            if data and data.users == 0:
                if isinstance(data, bpy.types.Mesh):
                    bpy.data.meshes.remove(data)
                elif isinstance(data, bpy.types.Camera):
                    bpy.data.cameras.remove(data)
                elif isinstance(data, bpy.types.Light):
                    bpy.data.lights.remove(data)
        if ground:
            bpy.data.materials.remove(ground)
        bpy.data.scenes.remove(scene)


if __name__ == '__main__':
    print(json.dumps(main(), indent=2))
