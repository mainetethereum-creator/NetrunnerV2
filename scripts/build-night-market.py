"""Build and export the Base night-market asset kit in the connected Blender scene.

This script intentionally builds into a dedicated collection and never removes or
relinks pre-existing scene objects.  Blender's local front is -Y; the glTF Y-up
conversion maps that to Three.js +Z, matching the authored building convention.

Run from Blender's Python console/MCP with:
    exec(compile(open(r'D:/V2 Cyber/Netrunner/scripts/build-night-market.py',
                      encoding='utf8').read(), 'build-night-market.py', 'exec'))
"""

from __future__ import annotations

import json
import math
import os
import struct
from collections import defaultdict
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(r"D:/V2 Cyber/Netrunner")
ATLAS_PATH = ROOT / "public/game/props/salvage/building-atlas.webp"
GLB_PATH = ROOT / "public/base/models/night-market-kit.glb"
BLEND_PATH = ROOT / ".dream-loop/night-market-kit.blend"
COLLECTION_NAME = "NightMarketKit"

# Existing 3x3 atlas semantics (see components/expedition/building-props.ts).
# Every global material points at one tile; all assets share these seven slots.
MATERIAL_SPECS = [
    # The atlas is deliberately multiplied by these subdued factors.  The
    # existing Base is a wet, dark refuge; un-tinted atlas tiles otherwise read
    # as clean white plaster and overpower the authored buildings.
    ("NM_Concrete", (0, 0), (0.48, 0.53, 0.60, 1.0), 0.92, 0.04, (0.32, 0.38, 0.46, 1.0), 0.0),
    ("NM_AgedTealPlaster", (1, 0), (0.25, 0.46, 0.44, 1.0), 0.90, 0.0, (0.28, 0.50, 0.47, 1.0), 0.0),
    ("NM_Brick", (2, 0), (0.52, 0.25, 0.18, 1.0), 0.94, 0.0, (0.32, 0.12, 0.08, 1.0), 0.0),
    ("NM_RustedSteel", (0, 1), (0.23, 0.14, 0.10, 1.0), 0.84, 0.72, (0.13, 0.07, 0.045, 1.0), 0.0),
    ("NM_CorrugatedSteel", (1, 1), (0.38, 0.45, 0.48, 1.0), 0.68, 0.74, (0.22, 0.31, 0.35, 1.0), 0.0),
    ("NM_DarkPanelGlass", (2, 1), (0.055, 0.10, 0.14, 1.0), 0.34, 0.32, (0.03, 0.09, 0.13, 1.0), 0.0),
    ("NM_WarmRedGlow", (1, 2), (0.72, 0.18, 0.045, 1.0), 0.32, 0.08, (1.0, 0.20, 0.035, 1.0), 1.25),
]


def _rgba(value):
    return tuple(float(x) for x in value)


class MeshBatch:
    """A tiny material-batched mesh builder.

    Each material receives one indexed mesh object at the end.  Geometry is
    authored directly in metres, avoiding hundreds of temporary Blender objects
    while keeping the exported draw count predictable.
    """

    def __init__(self, asset_name: str):
        self.asset_name = asset_name
        self.vertices = [[] for _ in MATERIAL_SPECS]
        self.faces = [[] for _ in MATERIAL_SPECS]
        self.uvs = [[] for _ in MATERIAL_SPECS]
        self.min_corner = Vector((float("inf"), float("inf"), float("inf")))
        self.max_corner = Vector((float("-inf"), float("-inf"), float("-inf")))

    @staticmethod
    def _tile_uv(material_index: int, u: float, v: float):
        # Keep every sample safely inside its 1/3 atlas tile, avoiding neighbour
        # bleed at mip levels while retaining enough texture scale for facades.
        # MATERIAL_SPECS is authoritative: material 6 deliberately uses the
        # bottom-middle amber-glass tile rather than the index-derived tile 0.
        tile_x, tile_row_from_top = MATERIAL_SPECS[material_index][1]
        tile_y = 2 - tile_row_from_top
        margin = 0.012
        span = 1.0 / 3.0 - margin * 2.0
        uu = max(0.0, min(1.0, float(u)))
        vv = max(0.0, min(1.0, float(v)))
        return (tile_x / 3.0 + margin + uu * span,
                tile_y / 3.0 + margin + vv * span)

    def _append(self, material_index: int, points, face, uv=None):
        if uv is None:
            uv = [(0.0, 0.0)] * len(points)
        offset = len(self.vertices[material_index])
        self.vertices[material_index].extend(tuple(float(c) for c in p) for p in points)
        self.faces[material_index].append(tuple(offset + i for i in face))
        # Box faces reuse one eight-vertex point list but supply four loop UVs;
        # cylinders and arbitrary polygons commonly supply one UV per point.
        if len(uv) == len(face):
            loop_uv = uv
        else:
            loop_uv = [uv[i] for i in face]
        self.uvs[material_index].extend(self._tile_uv(material_index, *loop) for loop in loop_uv)
        for p in points:
            q = Vector(p)
            self.min_corner.x = min(self.min_corner.x, q.x)
            self.min_corner.y = min(self.min_corner.y, q.y)
            self.min_corner.z = min(self.min_corner.z, q.z)
            self.max_corner.x = max(self.max_corner.x, q.x)
            self.max_corner.y = max(self.max_corner.y, q.y)
            self.max_corner.z = max(self.max_corner.z, q.z)

    def box(self, x, y, z, sx, sy, sz, material_index, bevel=0.0, uv_scale=(1.0, 1.0)):
        """Add a cuboid centered at x/y/z; dimensions are metres.

        The bevel argument uses a shallow inset cap rather than a modifier. It
        gives broad architectural edges a highlight while preserving a tiny
        amount of topology and the material batching invariant.
        """
        hx, hy, hz = sx * 0.5, sy * 0.5, sz * 0.5
        p = [
            (x - hx, y - hy, z - hz), (x + hx, y - hy, z - hz),
            (x + hx, y + hy, z - hz), (x - hx, y + hy, z - hz),
            (x - hx, y - hy, z + hz), (x + hx, y - hy, z + hz),
            (x + hx, y + hy, z + hz), (x - hx, y + hy, z + hz),
        ]
        u, v = uv_scale
        faces = [
            ((0, 3, 2, 1), [(0, 0), (u, 0), (u, v), (0, v)]),
            ((4, 5, 6, 7), [(0, 0), (u, 0), (u, v), (0, v)]),
            ((0, 1, 5, 4), [(0, 0), (u, 0), (u, v), (0, v)]),
            ((1, 2, 6, 5), [(0, 0), (u, 0), (u, v), (0, v)]),
            ((2, 3, 7, 6), [(0, 0), (u, 0), (u, v), (0, v)]),
            ((3, 0, 4, 7), [(0, 0), (u, 0), (u, v), (0, v)]),
        ]
        for face, uv in faces:
            self._append(material_index, p, face, uv)
        if bevel > 0.0:
            # Thin corner bands read as chamfers in the isometric scene and keep
            # the silhouette stable even when the camera is close to a shop.
            b = min(bevel, sx * 0.22, sy * 0.22, sz * 0.22)
            for xx in (-1, 1):
                for yy in (-1, 1):
                    self.box(x + xx * (hx - b * 0.5), y + yy * (hy - b * 0.5), z,
                             b, b, max(sz - 2 * b, b), material_index, 0.0, (0.35, 1.0))

    def cylinder(self, x, y, z, radius, depth, material_index, axis="z", segments=12, uv_scale=(1.0, 1.0)):
        """Add a capped cylinder; axis is one of x/y/z."""
        axis = axis.lower()
        rings = []
        for cap in (-1.0, 1.0):
            ring = []
            for i in range(segments):
                a = 2.0 * math.pi * i / segments
                c, s = math.cos(a) * radius, math.sin(a) * radius
                if axis == "x":
                    ring.append((x + cap * depth * 0.5, y + c, z + s))
                elif axis == "y":
                    ring.append((x + c, y + cap * depth * 0.5, z + s))
                else:
                    ring.append((x + c, y + s, z + cap * depth * 0.5))
            rings.append(ring)
        # sides
        for i in range(segments):
            j = (i + 1) % segments
            uv = [((i / segments) * uv_scale[0], 0), (((i + 1) / segments) * uv_scale[0], 0),
                  (((i + 1) / segments) * uv_scale[0], uv_scale[1]), ((i / segments) * uv_scale[0], uv_scale[1])]
            self._append(material_index, [rings[0][i], rings[0][j], rings[1][j], rings[1][i]], (0, 1, 2, 3), uv)
        # caps (reverse one for outward winding)
        self._append(material_index, rings[0], tuple(reversed(range(segments))), [(i / segments, 0.0) for i in range(segments)])
        self._append(material_index, rings[1], tuple(range(segments)), [(i / segments, 1.0) for i in range(segments)])

    def cylinder_between(self, a, b, radius, material_index, segments=8):
        """Add a capped cylinder along arbitrary endpoints."""
        a, b = Vector(a), Vector(b)
        axis = (b - a).normalized()
        # Choose a stable perpendicular basis, avoiding a zero cross product.
        ref = Vector((0, 0, 1)) if abs(axis.z) < 0.92 else Vector((0, 1, 0))
        u = axis.cross(ref).normalized()
        v = axis.cross(u).normalized()
        ra, rb = [], []
        for i in range(segments):
            angle = math.tau * i / segments
            radial = u * math.cos(angle) * radius + v * math.sin(angle) * radius
            ra.append(tuple(a + radial))
            rb.append(tuple(b + radial))
        for i in range(segments):
            j = (i + 1) % segments
            self._append(material_index, [ra[i], ra[j], rb[j], rb[i]], (0, 1, 2, 3),
                         [(i / segments, 0), ((i + 1) / segments, 0), ((i + 1) / segments, 1), (i / segments, 1)])
        self._append(material_index, list(reversed(ra)), tuple(range(segments)), [(i / segments, 0) for i in range(segments)])
        self._append(material_index, rb, tuple(range(segments)), [(i / segments, 1) for i in range(segments)])

    def rod(self, a, b, radius, material_index, segments=8):
        self.cylinder_between(a, b, radius, material_index, segments)

    def ring(self, x, y, z, major, minor, material_index, axis="y", segments=16, tube_segments=5):
        """Low-cost torus used for AC fan guards and lamp collars."""
        axis = axis.lower()
        verts = []
        for i in range(segments):
            a = math.tau * i / segments
            for j in range(tube_segments):
                b = math.tau * j / tube_segments
                rr = major + minor * math.cos(b)
                off = minor * math.sin(b)
                if axis == "x":
                    verts.append((x + off, y + rr * math.cos(a), z + rr * math.sin(a)))
                elif axis == "z":
                    verts.append((x + rr * math.cos(a), y + rr * math.sin(a), z + off))
                else:
                    verts.append((x + rr * math.cos(a), y + off, z + rr * math.sin(a)))
        for i in range(segments):
            ni = (i + 1) % segments
            for j in range(tube_segments):
                nj = (j + 1) % tube_segments
                face = (i * tube_segments + j, ni * tube_segments + j,
                        ni * tube_segments + nj, i * tube_segments + nj)
                self._append(material_index, verts, face,
                             [(i / segments, j / tube_segments), ((i + 1) / segments, j / tube_segments),
                              ((i + 1) / segments, (j + 1) / tube_segments), (i / segments, (j + 1) / tube_segments)])


def _make_materials():
    image = bpy.data.images.get(ATLAS_PATH.name)
    if image is None:
        image = bpy.data.images.load(str(ATLAS_PATH), check_existing=True)
    image.colorspace_settings.name = "sRGB"
    # Pack once so the GLB is portable. The source atlas in public/ remains the
    # canonical runtime texture and is also used by the existing building code.
    try:
        image.pack()
    except RuntimeError:
        pass

    materials = []
    for name, _tile, color, roughness, metallic, emission, emission_strength in MATERIAL_SPECS:
        material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
        material.use_nodes = True
        material.diffuse_color = _rgba(color)
        nodes = material.node_tree.nodes
        links = material.node_tree.links
        nodes.clear()
        output = nodes.new("ShaderNodeOutputMaterial")
        shader = nodes.new("ShaderNodeBsdfPrincipled")
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = image
        tex.interpolation = "Linear"
        tex.extension = "REPEAT"
        links.new(tex.outputs["Color"], shader.inputs["Base Color"])
        # A MixRGB multiply keeps the shared atlas UVs intact while allowing a
        # per-bucket grime/colour factor that glTF exports as a supported
        # base-colour graph. This is what gives the plaster its aged teal cast.
        # (The direct texture was visually too white in the wet refuge scene.)
        tint = nodes.new("ShaderNodeRGB")
        tint.outputs["Color"].default_value = _rgba(color)
        multiply = nodes.new("ShaderNodeMixRGB")
        multiply.blend_type = "MULTIPLY"
        multiply.inputs[0].default_value = 1.0
        links.new(tex.outputs["Color"], multiply.inputs[1])
        links.new(tint.outputs["Color"], multiply.inputs[2])
        links.new(multiply.outputs["Color"], shader.inputs["Base Color"])
        shader.inputs["Roughness"].default_value = roughness
        shader.inputs["Metallic"].default_value = metallic
        if shader.inputs.get("Emission Color"):
            shader.inputs["Emission Color"].default_value = _rgba(emission)
            shader.inputs["Emission Strength"].default_value = emission_strength
        elif shader.inputs.get("Emission"):
            shader.inputs["Emission"].default_value = _rgba(emission)
            shader.inputs["Emission Strength"].default_value = emission_strength
        links.new(shader.outputs["BSDF"], output.inputs["Surface"])
        material["night_market_atlas_tile"] = list(_tile)
        material["night_market_shared_material"] = True
        materials.append(material)
    return materials


def _add_mesh_object(collection, root, asset_name, material_index, batch, material):
    if not batch.faces[material_index]:
        return None
    mesh = bpy.data.meshes.new(f"{asset_name}_mesh_{material_index}")
    verts = batch.vertices[material_index]
    faces = batch.faces[material_index]
    mesh.from_pydata(verts, [], faces)
    mesh.update(calc_edges=True)
    uv_layer = mesh.uv_layers.new(name="UVMap")
    uv_values = batch.uvs[material_index]
    for poly in mesh.polygons:
        for loop_index in poly.loop_indices:
            uv_layer.data[loop_index].uv = uv_values[loop_index]
    mesh.materials.append(material)
    obj = bpy.data.objects.new(f"{asset_name}_mat_{material_index}", mesh)
    collection.objects.link(obj)
    obj.parent = root
    obj["asset"] = asset_name
    obj["material_batch"] = material.name
    obj["atlas_uv_baked"] = True
    obj.display_type = "TEXTURED"
    obj.hide_render = False
    return obj


def _asset_root(collection, asset_name, dimensions, materials, batch):
    root = bpy.data.objects.new(asset_name, None)
    root.empty_display_type = "CUBE"
    root.empty_display_size = 0.35
    root.location = (0.0, 0.0, 0.0)
    root["asset_id"] = asset_name
    root["units"] = "metres"
    root["front"] = "+Z after glTF export"
    root["origin"] = "ground center"
    root["authored_dimensions"] = list(dimensions)
    root["material_budget"] = len(MATERIAL_SPECS)
    collection.objects.link(root)
    children = []
    for material_index, material in enumerate(materials):
        obj = _add_mesh_object(collection, root, asset_name, material_index, batch, material)
        if obj is not None:
            children.append(obj)
    # Keep the root selected as the human-facing asset handle while the children
    # remain visible and independently material-batched in the glTF node tree.
    root["mesh_children"] = len(children)
    return root, children


def _fit_to_authored_dimensions(batch: MeshBatch, dimensions):
    """Normalize each authored batch to its exact metre envelope.

    Detail elements (fan guards, lantern hooks and beveled edges) are allowed to
    be authored naturally, then the complete asset is fitted around a ground
    centered origin. This keeps the collision/layout dimensions deterministic for
    the parent scene while preserving all relative detail proportions.
    """
    target = Vector(dimensions)
    actual = batch.max_corner - batch.min_corner
    if min(actual) <= 0.0:
        raise ValueError(f"invalid empty batch for {batch.asset_name}: {actual}")
    scale = Vector((target.x / actual.x, target.y / actual.y, target.z / actual.z))
    center = (batch.min_corner + batch.max_corner) * 0.5
    for material_vertices in batch.vertices:
        for i, point in enumerate(material_vertices):
            q = (Vector(point) - center) * scale + Vector((0.0, 0.0, target.z * 0.5))
            material_vertices[i] = tuple(q)
    batch.min_corner = Vector((-target.x * 0.5, -target.y * 0.5, 0.0))
    batch.max_corner = Vector((target.x * 0.5, target.y * 0.5, target.z))


def _window(b, x, y, z, w, h, warm=True, mat_frame=4, depth=0.08):
    b.box(x, y, z, w + 0.28, depth, h + 0.28, 0, 0.0, (0.7, 0.7))
    # Windows are primarily dark glazing. Only a pair of narrow, deterministic
    # panes is warm on selected windows, avoiding the giant orange wall effect
    # from the first pass while retaining lived-in light at distance.
    b.box(x, y - depth * 0.6, z, w, depth * 0.6, h, 5, 0.0, (1.2, 1.2))
    if warm:
        b.box(x - w * 0.29, y - depth * 0.94, z, w * 0.18, depth * 0.22, h * 0.76, 6, 0.0, (0.8, 1.1))
        b.box(x + w * 0.27, y - depth * 0.94, z + h * 0.12, w * 0.13, depth * 0.22, h * 0.46, 6, 0.0, (0.8, 1.1))
    # Deep sash and a centre mullion produce the layered shop-house look.
    b.box(x - w * 0.5 - 0.10, y - 0.02, z, 0.10, depth * 1.8, h + 0.18, mat_frame)
    b.box(x + w * 0.5 + 0.10, y - 0.02, z, 0.10, depth * 1.8, h + 0.18, mat_frame)
    b.box(x, y - 0.03, z - h * 0.5 - 0.10, w + 0.24, depth * 1.8, 0.10, mat_frame)
    b.box(x, y - 0.03, z + h * 0.5 + 0.10, w + 0.24, depth * 1.8, 0.10, mat_frame)
    b.box(x, y - 0.06, z, 0.055, depth * 2.1, h, mat_frame)
    for j in (-1, 1):
        b.box(x, y - 0.06, z + j * h * 0.26, w, depth * 2.1, 0.045, mat_frame)


def _shutter(b, x, y, z, w, h, material=4):
    b.box(x, y, z, w, 0.12, h, material)
    for row in range(max(3, int(h / 0.16))):
        b.box(x, y - 0.09, z - h * 0.46 + row * 0.16, w + 0.06, 0.045, 0.045, 0)


def _door(b, x, y, z, w=1.25, h=2.35):
    b.box(x, y, z, w + 0.28, 0.32, h + 0.3, 0, 0.0)
    b.box(x, y - 0.18, z, w, 0.12, h, 5)
    b.box(x - w * 0.5 - 0.12, y - 0.23, z, 0.11, 0.18, h + 0.2, 4)
    b.box(x + w * 0.5 + 0.12, y - 0.23, z, 0.11, 0.18, h + 0.2, 4)
    b.box(x, y - 0.23, z + h * 0.5 + 0.12, w + 0.24, 0.18, 0.11, 4)
    b.box(x + w * 0.28, y - 0.26, z, 0.07, 0.07, 0.46, 6)


def _awning(b, x, y, z, w, d, material=4):
    b.box(x, y, z, w, d, 0.14, material, 0.02, (1.4, 0.9))
    for i in range(7):
        b.box(x - w * 0.44 + i * w * 0.147, y - d * 0.52, z - 0.07, w * 0.11, 0.06, 0.18, 6)
    for sx in (-w * 0.42, w * 0.42):
        b.rod((x + sx, y + d * 0.42, z - 0.02), (x + sx, y - d * 0.40, z - 0.50), 0.028, 4)


def _rail(b, x, y, z, w, d=0.05, height=0.85, material=4):
    for dx in (-w * 0.5, w * 0.5):
        b.rod((x + dx, y, z), (x + dx, y, z + height), 0.035, material)
    b.rod((x - w * 0.5, y, z + height), (x + w * 0.5, y, z + height), 0.035, material)
    b.rod((x - w * 0.5, y + d, z + height * 0.58), (x + w * 0.5, y + d, z + height * 0.58), 0.026, material)
    for i in range(1, max(2, int(w / 0.45))):
        px = x - w * 0.5 + i * w / max(2, int(w / 0.45))
        b.rod((px, y, z), (px, y, z + height), 0.022, material)


def _ac(b, x, y, z, w=0.95, h=0.66, depth=0.38, facing="front"):
    """Detailed HVAC box with guard ring, hub, fan blades and cable riser."""
    b.box(x, y, z, w, depth, h, 4, 0.025, (1.2, 0.8))
    face_y = y - depth * 0.58 if facing == "front" else y + depth * 0.58
    b.ring(x, face_y, z, min(w, h) * 0.27, 0.035, 5, axis="y", segments=16, tube_segments=5)
    b.cylinder(x, face_y, z, min(w, h) * 0.10, 0.05, 5, axis="y", segments=12)
    for i in range(5):
        a = math.tau * i / 5 + 0.24
        px = x + math.cos(a) * min(w, h) * 0.17
        pz = z + math.sin(a) * min(w, h) * 0.17
        b.box(px, face_y - 0.04, pz, min(w, h) * 0.22, 0.055, 0.045, 3, 0.012)
    b.rod((x - w * 0.34, y, z - h * 0.5), (x - w * 0.34, y, z - h * 0.5 - 0.32), 0.032, 3)
    b.rod((x + w * 0.34, y, z - h * 0.5), (x + w * 0.34, y, z - h * 0.5 - 0.32), 0.032, 3)


def _lantern(b, x, y, z, scale=1.0):
    # Distinctive red lantern silhouette for the market frontage; no text mesh.
    b.cylinder(x, y, z + 0.24 * scale, 0.18 * scale, 0.34 * scale, 6, axis="z", segments=12)
    b.cylinder(x, y, z + 0.02 * scale, 0.24 * scale, 0.12 * scale, 6, axis="z", segments=12)
    b.cylinder(x, y, z + 0.46 * scale, 0.12 * scale, 0.08 * scale, 6, axis="z", segments=12)
    b.ring(x, y, z + 0.24 * scale, 0.20 * scale, 0.025 * scale, 4, axis="z", segments=12, tube_segments=4)
    b.rod((x, y, z + 0.50 * scale), (x, y, z + 0.68 * scale), 0.018 * scale, 4)


def _roof_plant(b, x, y, z, width=2.0, depth=1.3, height=0.9):
    b.box(x, y, z + height * 0.5, width, depth, height, 4, 0.035)
    b.box(x, y - depth * 0.56, z + height * 0.52, width * 0.72, 0.06, height * 0.56, 5)
    b.ring(x, y - depth * 0.60, z + height * 0.52, width * 0.22, 0.028, 4, axis="y", segments=14, tube_segments=4)
    for dx in (-width * 0.28, width * 0.28):
        b.rod((x + dx, y + depth * 0.3, z + height), (x + dx, y + depth * 0.3, z + height + 0.35), 0.025, 3)


def _build_armory():
    b = MeshBatch("Armory")
    # exact 8 x 9 x 10 envelope, centred on the ground origin
    b.box(0, 0, 0.10, 7.9, 8.9, 0.20, 0, 0.03)
    b.box(0, 0.15, 4.30, 7.5, 8.20, 8.40, 5, 0.04, (3.0, 2.5))
    # Structural corner piers and broad lintels make the plain body read as a
    # layered shop-house instead of a single game-style cube.
    for x in (-3.65, 3.65):
        b.box(x, -4.08, 4.25, 0.52, 0.36, 8.25, 0, 0.04)
        b.box(x, -4.26, 7.65, 0.26, 0.18, 1.05, 4)
    b.box(0, -4.08, 7.75, 7.5, 0.35, 0.50, 0, 0.04)
    b.box(0, -4.27, 0.95, 6.7, 0.20, 0.45, 3)
    # Deeply inset ground storefront with shutter, armoured entry and warm grille.
    b.box(0, -4.19, 1.96, 5.75, 0.18, 3.20, 5, 0.025)
    _shutter(b, -1.98, -4.38, 1.88, 2.05, 2.52)
    _door(b, 1.70, -4.35, 1.56, 1.30, 2.38)
    b.box(0.0, -4.42, 3.72, 5.95, 0.46, 0.20, 4)
    _awning(b, 0.0, -4.66, 3.55, 6.1, 1.02, 4)
    for x in (-2.90, -0.85, 1.30, 3.20):
        _window(b, x, -4.22, 6.35, 1.45, 1.48, warm=(x > 0))
        for row in range(5):
            b.box(x, -4.45, 5.83 + row * 0.22, 1.38, 0.04, 0.045, 4)
    # Cable risers and service conduits on the street-facing edge.
    for x in (3.18, 3.34, 3.50):
        b.rod((x, -4.38, 3.85), (x + 0.05, -4.38, 7.45), 0.035, 3)
        for z in (4.3, 5.45, 6.6):
            b.box(x, -4.40, z, 0.22, 0.10, 0.07, 6)
    _ac(b, -2.85, -4.31, 7.90, 1.15, 0.76, 0.44)
    _ac(b, 2.68, -4.31, 8.15, 0.92, 0.62, 0.42)
    # Side ventilation grilles and stacked industrial panels.
    for side in (-1, 1):
        x = side * 3.80
        for z in (2.2, 4.45, 6.7):
            b.box(x, -1.65, z, 0.15, 2.10, 0.95, 4)
            for row in range(7):
                b.box(x + side * 0.09, -2.48, z - 0.35 + row * 0.12, 0.04, 0.95, 0.035, 5)
    # Roof parapet, catwalk and service plant.
    b.box(0, 0.15, 8.62, 7.75, 8.35, 0.30, 0, 0.035)
    b.box(0, -3.83, 8.85, 7.65, 0.18, 0.32, 4)
    _rail(b, 0, -3.43, 8.72, 5.3, 0.12, 0.80)
    _roof_plant(b, -1.25, 0.10, 8.78, 2.4, 1.6, 0.95)
    _roof_plant(b, 2.25, 1.35, 8.78, 1.35, 1.15, 0.75)
    for x in (-3.0, -2.2, 2.95):
        b.cylinder(x, 2.55, 9.05, 0.20, 0.70, 3, axis="z", segments=12)
        b.ring(x, 2.55, 9.38, 0.24, 0.025, 4, axis="z", segments=12, tube_segments=4)
    for x, s in ((-3.05, 0.9), (3.10, 0.78)):
        _lantern(b, x, -4.58, 3.95, s)
    # Small teal/cyan accents are blank emission surfaces for the parent's neon atlas.
    for x in (-3.32, 3.32):
        b.box(x, -4.38, 4.95, 0.08, 0.05, 1.1, 6)
    return b


def _build_implants():
    b = MeshBatch("Implants")
    b.box(0, 0, 0.10, 7.9, 8.9, 0.20, 0, 0.03)
    b.box(0, 0.10, 6.20, 7.55, 8.20, 12.25, 1, 0.06, (2.6, 3.8))
    # Aged plaster floor bands and slightly irregular dark concrete edges.
    for z in (0.55, 4.25, 8.10, 11.75, 12.48):
        b.box(0, -4.12, z, 7.85, 0.38, 0.20, 0, 0.02)
    for x in (-3.62, 3.62):
        b.box(x, -4.15, 6.35, 0.34, 0.34, 12.05, 0, 0.03)
    # Three floors of inset sash windows, shutters and small repair patches.
    for floor, z in enumerate((2.48, 6.12, 9.78)):
        for x in (-2.55, -0.85, 1.25, 2.72):
            _window(b, x, -4.30, z, 1.15, 1.52, warm=(floor + int(x * 10)) % 3 != 0)
            if floor == 1 and x < 0:
                for row in range(6):
                    b.box(x, -4.52, z - 0.55 + row * 0.22, 1.02, 0.04, 0.045, 3)
    # Ground clinic frontage and a sheltered side door.
    b.box(0.0, -4.22, 1.55, 6.30, 0.18, 2.60, 5, 0.02)
    _door(b, 0.0, -4.40, 1.45, 1.32, 2.45)
    b.box(-2.15, -4.44, 1.60, 1.85, 0.08, 1.95, 6)
    for row in range(7):
        b.box(-2.15, -4.52, 0.74 + row * 0.23, 1.58, 0.035, 0.04, 4)
    _awning(b, 0.0, -4.65, 3.02, 6.35, 0.95, 4)
    # Side bay, balconies and handrails.
    b.box(-2.10, -4.55, 7.16, 3.0, 0.42, 1.50, 1, 0.04)
    _rail(b, -2.10, -4.85, 7.35, 2.80, 0.12, 0.84)
    b.box(2.52, -4.53, 10.25, 1.78, 0.34, 1.25, 1, 0.04)
    _rail(b, 2.52, -4.79, 10.42, 1.65, 0.12, 0.78)
    # Vertical cable bundle with junction boxes and HVAC fans.
    for x in (3.08, 3.22, 3.36):
        b.rod((x, -4.42, 1.0), (x + 0.06, -4.42, 11.3), 0.028, 3)
        for z in (2.2, 5.9, 9.6):
            b.box(x, -4.47, z, 0.21, 0.08, 0.10, 6)
    _ac(b, -3.00, -4.30, 4.02, 1.08, 0.70, 0.43)
    _ac(b, 2.96, -4.31, 7.82, 1.15, 0.72, 0.42)
    _ac(b, -2.90, -4.29, 11.32, 0.92, 0.60, 0.40)
    # Side vents and an aged-service rear stack.
    for side in (-1, 1):
        x = side * 3.80
        for z in (3.1, 6.8, 10.3):
            b.box(x, 0.25, z, 0.14, 1.65, 0.88, 4)
            for row in range(6):
                b.box(x + side * 0.10, -0.44, z - 0.30 + row * 0.12, 0.05, 0.80, 0.04, 5)
    b.box(0, 0.12, 12.58, 7.75, 8.34, 0.30, 0, 0.04)
    b.box(0, -3.84, 12.82, 7.7, 0.18, 0.30, 4)
    _roof_plant(b, -2.0, 0.5, 12.74, 1.8, 1.35, 0.95)
    _roof_plant(b, 1.4, 1.25, 12.74, 1.55, 1.15, 0.72)
    b.cylinder(2.8, 2.4, 13.05, 0.38, 0.82, 3, axis="z", segments=16)
    b.ring(2.8, 2.4, 13.43, 0.44, 0.03, 4, axis="z", segments=16, tube_segments=4)
    for x, s in ((-3.1, 0.72), (3.08, 0.70)):
        _lantern(b, x, -4.58, 3.28, s)
    # Parent can layer a sign atlas over these clean accent panels.
    b.box(-1.02, -4.48, 3.30, 1.65, 0.05, 0.54, 6)
    b.box(1.08, -4.48, 3.31, 1.12, 0.05, 0.18, 6)
    return b


def _build_noodle_stall():
    b = MeshBatch("NoodleStall")
    b.box(0, 0, 0.08, 3.28, 1.70, 0.16, 0, 0.02)
    b.box(0, 0.04, 1.14, 3.05, 1.45, 2.05, 3, 0.03)
    # Open front service bay and counter.
    b.box(0, -0.79, 1.48, 2.95, 0.15, 1.25, 5)
    b.box(0, -0.89, 0.95, 3.18, 0.20, 0.22, 4)
    b.box(0, -0.88, 1.10, 2.98, 0.16, 0.16, 1)
    # Thin posts, roof fascia and ribbed awning canopy.
    for x in (-1.46, 1.46):
        b.box(x, -0.78, 1.95, 0.14, 0.16, 1.76, 4)
        b.rod((x, -0.80, 1.10), (x, -0.80, 2.64), 0.025, 3)
    b.box(0, -0.01, 2.54, 3.28, 1.70, 0.18, 4, 0.02)
    b.box(0, -0.72, 2.73, 3.35, 0.30, 0.14, 6)
    for x in (-1.20, -0.40, 0.40, 1.20):
        b.box(x, -0.76, 2.63, 0.54, 0.08, 0.13, 6)
    # Back service shelves, hanging pots and a small roof vent.
    for z in (1.55, 1.95):
        b.box(0.0, 0.68, z, 2.55, 0.18, 0.10, 4)
    for x in (-0.82, 0.0, 0.82):
        b.cylinder(x, -0.48, 1.28, 0.15, 0.12, 6, axis="z", segments=12)
        b.cylinder(x, -0.48, 1.42, 0.08, 0.10, 4, axis="z", segments=10)
    b.cylinder(0.92, 0.45, 2.72, 0.13, 0.34, 3, axis="z", segments=10)
    b.ring(0.92, 0.45, 2.89, 0.16, 0.02, 4, axis="z", segments=10, tube_segments=4)
    for x, s in ((-1.10, 0.68), (0.0, 0.78), (1.10, 0.68)):
        _lantern(b, x, -0.92, 2.05, s)
    # Side utility boxes and low stools for silhouette/detail.
    for side in (-1, 1):
        b.box(side * 1.53, 0.25, 1.12, 0.20, 0.62, 1.44, 3)
        b.box(side * 1.64, -0.40, 0.54, 0.42, 0.42, 0.12, 4)
        b.cylinder(side * 1.64, -0.40, 0.28, 0.17, 0.46, 3, axis="z", segments=10)
    return b


def _build_train():
    b = MeshBatch("Train")
    # Ten metre carriage along X, 2.3 m width along Y (which glTF presents as Z).
    b.box(0, 0, 0.10, 9.78, 2.22, 0.20, 3, 0.025)
    b.box(0, 0, 1.42, 9.62, 2.08, 2.08, 5, 0.05, (4.0, 1.6))
    b.box(0, 0, 2.48, 9.72, 2.18, 0.24, 4, 0.03)
    b.box(0, 0, 2.70, 8.55, 1.62, 0.14, 3, 0.02)
    # Side glazing and alternating structural ribs.
    for side in (-1, 1):
        y = side * 1.07
        for x in (-4.05, -2.70, -1.35, 0.0, 1.35, 2.70, 4.05):
            b.box(x, y, 1.70, 1.02, 0.08, 0.90, 5, 0.01, (1.4, 1.0))
            b.box(x, y - side * 0.07, 1.70, 0.88, 0.05, 0.73, 6)
            b.box(x - 0.58, y - side * 0.08, 1.70, 0.08, 0.10, 1.04, 4)
            b.box(x + 0.58, y - side * 0.08, 1.70, 0.08, 0.10, 1.04, 4)
        for x in (-4.65, 4.65):
            b.box(x, y - side * 0.06, 1.42, 0.20, 0.12, 1.82, 4)
    # End caps, driver windows and door seams.
    for side in (-1, 1):
        x = side * 4.84
        b.box(x, 0, 1.40, 0.16, 2.12, 1.92, 4)
        b.box(x + side * 0.09, 0, 1.78, 0.04, 0.92, 0.74, 5)
        b.box(x + side * 0.12, 0, 1.78, 0.04, 0.68, 0.50, 6)
        b.box(x + side * 0.10, -0.56, 0.92, 0.06, 0.06, 0.55, 4)
        b.box(x + side * 0.10, 0.56, 0.92, 0.06, 0.06, 0.55, 4)
    # Underbody machinery, two bogies and four paired steel wheels.
    b.box(-3.15, 0, 0.45, 2.12, 1.58, 0.32, 3)
    b.box(3.15, 0, 0.45, 2.12, 1.58, 0.32, 3)
    for x in (-3.45, -2.85, 2.85, 3.45):
        for y in (-0.82, 0.82):
            b.cylinder(x, y, 0.32, 0.36, 0.18, 3, axis="y", segments=16)
            b.ring(x, y - (0.11 if y < 0 else -0.11), 0.32, 0.25, 0.025, 4, axis="y", segments=12, tube_segments=4)
    for x in (-4.82, 4.82):
        b.box(x, 0, 0.57, 0.30, 0.22, 0.25, 3)
        b.rod((x, -0.10, 0.54), (x + (0.30 if x < 0 else -0.30), -0.10, 0.54), 0.08, 4)
    # Roof conduit/vent details.
    for x in (-3.4, -1.8, 1.8, 3.4):
        b.box(x, 0.0, 2.82, 0.18, 0.72, 0.18, 4)
    b.cylinder(-0.8, 0.18, 2.93, 0.16, 0.30, 3, axis="z", segments=12)
    b.ring(-0.8, 0.18, 3.08, 0.20, 0.025, 4, axis="z", segments=12, tube_segments=4)
    return b


def _build_apartment():
    b = MeshBatch("Apartment")
    b.box(0, 0, 0.10, 9.85, 7.85, 0.20, 0, 0.03)
    b.box(0, 0.06, 9.25, 9.40, 7.42, 18.30, 1, 0.06, (3.2, 4.4))
    # Five shop-house bands with recessed glazing and deep slab eyebrows.
    for floor in range(5):
        base = 0.52 + floor * 3.62
        b.box(0, -3.73, base, 9.62, 0.34, 0.22, 0, 0.025)
        for x in (-3.50, -1.18, 1.18, 3.50):
            _window(b, x, -3.82, base + 1.78, 1.62, 1.68, warm=(floor + int(x)) % 3 != 0)
        if floor in (1, 3):
            b.box(0, -4.03, base + 0.24, 8.9, 0.54, 0.20, 0, 0.02)
            _rail(b, 0, -4.35, base + 0.30, 8.5, 0.12, 0.82)
    _door(b, -1.10, -3.96, 1.30, 1.30, 2.45)
    _shutter(b, 1.40, -3.98, 1.48, 2.20, 2.55)
    _awning(b, 0.5, -4.19, 2.98, 4.6, 0.90, 4)
    # Side fire escape, ducts and repeat HVAC details.
    for floor in range(4):
        z = 3.1 + floor * 3.62
        b.box(4.85, -0.4, z, 0.52, 2.20, 0.18, 4)
        _rail(b, 4.85, -1.45, z + 0.08, 2.0, 0.12, 0.76)
        b.rod((4.75, -1.48, z), (4.75, -1.48, z + 3.1), 0.035, 3)
        b.rod((5.0, -1.48, z), (5.0, -1.48, z + 3.1), 0.035, 3)
    for z in (3.20, 6.82, 10.45, 14.10):
        _ac(b, -4.40, -3.73, z, 0.95, 0.64, 0.40)
    for x in (3.72, 3.86, 4.0):
        b.rod((x, -3.82, 0.7), (x + .05, -3.82, 17.7), 0.027, 3)
    b.box(0, 0.05, 18.56, 9.55, 7.56, 0.30, 0, 0.04)
    b.box(0, -3.58, 18.82, 9.45, 0.18, 0.30, 4)
    _roof_plant(b, -2.45, 0.45, 18.70, 2.0, 1.45, 0.96)
    _roof_plant(b, 1.35, 0.80, 18.70, 1.65, 1.24, 0.72)
    for x in (-3.75, 3.60):
        b.cylinder(x, 2.30, 19.00, 0.22, 0.72, 3, axis="z", segments=14)
    for x, s in ((-3.82, 0.72), (3.75, 0.68)):
        _lantern(b, x, -4.05, 2.88, s)
    b.box(-0.45, -4.02, 3.24, 1.50, 0.06, 0.54, 6)
    return b


BUILDERS = {
    "Armory": ((_build_armory, (8.0, 9.0, 10.0))),
    "Implants": ((_build_implants, (8.0, 9.0, 13.0))),
    "NoodleStall": ((_build_noodle_stall, (3.4, 1.8, 2.8))),
    "Train": ((_build_train, (10.0, 2.3, 2.8))),
    "Apartment": ((_build_apartment, (10.0, 8.0, 19.0))),
}


def _ensure_collection():
    collection = bpy.data.collections.get(COLLECTION_NAME)
    if collection is None:
        collection = bpy.data.collections.new(COLLECTION_NAME)
        bpy.context.scene.collection.children.link(collection)
    return collection


def _clear_previous_build():
    collection = bpy.data.collections.get(COLLECTION_NAME)
    if collection is None:
        return
    # This only clears our own dedicated collection, never startup/user objects.
    for obj in list(collection.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for child in list(collection.children):
        collection.children.unlink(child)


def _triangles(objects):
    result = 0
    for obj in objects:
        if obj.type == "MESH":
            result += sum(max(0, len(poly.vertices) - 2) for poly in obj.data.polygons)
    return result


def _export(collection, roots, meshes):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in roots + meshes:
        obj.select_set(True)
    if roots:
        bpy.context.view_layer.objects.active = roots[0]
    GLB_PATH.parent.mkdir(parents=True, exist_ok=True)
    # No scene cameras or lights are selected/exported. Embed the shared atlas so
    # loading the GLB in isolation remains functional.
    bpy.ops.export_scene.gltf(
        filepath=str(GLB_PATH),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_cameras=False,
        export_lights=False,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_texcoords=True,
        export_normals=True,
        export_animations=False,
    )
    _apply_glb_material_factors()


def _apply_glb_material_factors():
    """Restore atlas tint as glTF baseColorFactor after Blender export.

    Blender's exporter correctly preserves the image texture from the MixRGB
    node but omits its constant multiply from the compact PBR material. A valid
    glTF baseColorFactor is the portable representation of that same multiply,
    so patch the JSON chunk in-place while retaining the embedded image/BIN.
    """
    data = GLB_PATH.read_bytes()
    if data[0:4] != b"glTF":
        raise ValueError("night-market export is not a GLB")
    json_length = struct.unpack_from("<I", data, 12)[0]
    json_start = 20
    json_end = json_start + json_length
    document = json.loads(data[json_start:json_end].decode("utf8"))
    by_name = {spec[0]: spec[2] for spec in MATERIAL_SPECS}
    for material in document.get("materials", []):
        spec_color = by_name.get(material.get("name"))
        if spec_color is not None:
            pbr = material.setdefault("pbrMetallicRoughness", {})
            pbr["baseColorFactor"] = list(spec_color)
    encoded = json.dumps(document, separators=(",", ":"), ensure_ascii=False).encode("utf8")
    padded_length = (len(encoded) + 3) & ~3
    encoded += b" " * (padded_length - len(encoded))
    bin_chunk = data[json_end:]
    total_length = 12 + 8 + padded_length + len(bin_chunk)
    header = bytearray(data[:12])
    struct.pack_into("<I", header, 8, total_length)
    output = bytes(header) + struct.pack("<I4s", padded_length, b"JSON") + encoded + bin_chunk
    GLB_PATH.write_bytes(output)


def main():
    _clear_previous_build()
    collection = _ensure_collection()
    materials = _make_materials()
    roots, meshes = [], []
    stats = {}
    for asset_name, (builder_fn, authored_dimensions) in BUILDERS.items():
        batch = builder_fn()
        _fit_to_authored_dimensions(batch, authored_dimensions)
        root, children = _asset_root(collection, asset_name, authored_dimensions, materials, batch)
        roots.append(root)
        meshes.extend(children)
        stats[asset_name] = {
            "dimensions": list(authored_dimensions),
            "bounds": [list(batch.min_corner), list(batch.max_corner)],
            "triangles": _triangles(children),
            "material_draws": len(children),
            "mesh_objects": len(children),
        }
    _export(collection, roots, meshes)

    # Save a reproducible source scene for visual review without touching the
    # user's existing startup objects. It is intentionally outside public/.
    BLEND_PATH.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))

    total_triangles = sum(item["triangles"] for item in stats.values())
    glb_bytes = GLB_PATH.stat().st_size if GLB_PATH.exists() else 0
    result = {
        "status": "ok",
        "collection": COLLECTION_NAME,
        "assets": stats,
        "total_triangles": total_triangles,
        "total_materials": len(materials),
        "glb": str(GLB_PATH),
        "glb_bytes": glb_bytes,
        "source_blend": str(BLEND_PATH),
        "scene_objects_preserved": [o.name for o in bpy.context.scene.objects if o.name in {"Cube", "Light", "Camera"}],
    }
    print(json.dumps(result, indent=2))
    return result


if __name__ == "__main__":
    main()
