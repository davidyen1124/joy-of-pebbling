# Builds everything in the studio (the host, the easel, the palette, the tools) and writes one GLB plus a
# small JSON of anchor points the page needs.
#
#   Blender --background --factory-startup --python assets-src/blender/build_set.py -- public/models/set.glb [hero.png]
#
# Run it from the top of the repository: the two paths after "--" are taken from where it is run.
#
# All modelling here is in the page's coordinates (Y up, +Z towards the viewer, one unit = one Pebble tall).
# The conversion to Blender's Z-up happens once, in Geo.obj().
import bpy
import bmesh
import json
import math
import os
import sys
from mathutils import Vector, Matrix, noise

TAU = math.tau
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = os.path.abspath(argv[0] if argv else 'public/models/set.glb')
HERO = os.path.abspath(argv[1]) if len(argv) > 1 else None


# ── colour ──────────────────────────────────────────────────────────────────
def lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexc(h):
    return (lin((h >> 16 & 255) / 255), lin((h >> 8 & 255) / 255), lin((h & 255) / 255))


def mixc(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def smooth(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


BLUE = hexc(0x5b93d6)       # the host is a blue Pebble, which is also his shirt
BLUE_DK = hexc(0x3f6fb4)
NAVY = hexc(0x33456f)
HAIR = hexc(0x4a2c18)
HAIR_LT = hexc(0x8a5a30)
HAIR_DK = hexc(0x1d0f08)
COLLAR = hexc(0xdfeaf8)
EYE = hexc(0x0b1626)
STEEL = hexc(0xc9ccd1)
BLACK = hexc(0x16161a)
WOOD = hexc(0xcaa46c)
WOOD_DK = hexc(0x8b5a2b)
LINEN = hexc(0xefe9da)
BRISTLE = hexc(0xe4d5ad)
WHITE = hexc(0xffffff)

PAINTS = [  # id, name on the tube, colour; the order they sit round the palette
    ('white', 0xf5f2e8), ('yellow', 0xffd21f), ('ochre', 0xc9952c), ('indian', 0xe8a317),
    ('red', 0xd9281e), ('crimson', 0x8e1b2c), ('sap', 0x3f6b24), ('pgreen', 0x0f4b3e),
    ('pblue', 0x123c8c), ('prussian', 0x0e2244), ('sienna', 0x5a2d1a), ('vandyke', 0x33211a),
    ('black', 0x0b0b0e),
]


# ── coordinates ─────────────────────────────────────────────────────────────
def bl(p):
    """page (x, y, z) to Blender (x, -z, y); a rotation, so winding is kept."""
    return Vector((p[0], -p[2], p[1]))


def T(x=0, y=0, z=0):
    return Matrix.Translation(Vector((x, y, z)))


def RX(a):
    return Matrix.Rotation(a, 4, 'X')


def RY(a):
    return Matrix.Rotation(a, 4, 'Y')


def RZ(a):
    return Matrix.Rotation(a, 4, 'Z')


def S(x, y=None, z=None):
    y = x if y is None else y
    z = x if z is None else z
    return Matrix.Diagonal(Vector((x, y, z, 1)))


# ── the Pebble's body: an egg, a little heavier at the bottom ───────────────
BASE = 0.05
H = 1.0
R = 0.37


def body_r(a):
    return R * max(math.sin(a), 0.0) ** 0.62 * (1 + 0.14 * math.cos(a))


def body_y(a):
    return BASE + H * (1 - math.cos(a)) / 2


def radius_at(y):
    c = max(-1.0, min(1.0, 1 - 2 * (y - BASE) / H))
    return body_r(math.acos(c))


def surf(phi, y, off=0.0):
    r = radius_at(y) + off
    return Vector((math.sin(phi) * r, y, math.cos(phi) * r))


def surf_normal(phi, y):
    dy = 0.01
    slope = (radius_at(y + dy) - radius_at(y - dy)) / (2 * dy)
    return Vector((math.sin(phi), -slope, math.cos(phi))).normalized()


def surf_frame(phi, y, off=0.0):
    """local +Z along the outward normal, local +Y as upright as the slope allows."""
    n = surf_normal(phi, y)
    x = Vector((0, 1, 0)).cross(n).normalized()
    up = n.cross(x)
    m = Matrix(((x.x, up.x, n.x, 0), (x.y, up.y, n.y, 0), (x.z, up.z, n.z, 0), (0, 0, 0, 1)))
    return Matrix.Translation(surf(phi, y, off)) @ m


# ── shapes: each returns (verts, faces) ─────────────────────────────────────
def lathe(profile, segs):
    verts, faces, rows = [], [], []
    for r, y in profile:
        if r < 1e-6:
            rows.append([len(verts)])
            verts.append(Vector((0, y, 0)))
        else:
            row = []
            for i in range(segs):
                phi = TAU * i / segs
                row.append(len(verts))
                verts.append(Vector((math.sin(phi) * r, y, math.cos(phi) * r)))
            rows.append(row)
    for j in range(len(rows) - 1):
        lo, hi = rows[j], rows[j + 1]
        for i in range(segs):
            i2 = (i + 1) % segs
            if len(lo) == 1 and len(hi) == 1:
                continue
            if len(lo) == 1:
                faces.append((lo[0], hi[i2], hi[i]))
            elif len(hi) == 1:
                faces.append((lo[i], lo[i2], hi[0]))
            else:
                faces.append((lo[i], lo[i2], hi[i2], hi[i]))
    return verts, faces


def ellipsoid(rx, ry, rz, segs=20, rings=12):
    prof = [(math.sin(math.pi * j / rings), -math.cos(math.pi * j / rings)) for j in range(rings + 1)]
    prof[0] = (0, -1)
    prof[-1] = (0, 1)
    v, f = lathe(prof, segs)
    return [Vector((p.x * rx, p.y * ry, p.z * rz)) for p in v], f


def tube(p0, p1, r0, r1=None, segs=14, caps=True):
    r1 = r0 if r1 is None else r1
    p0, p1 = Vector(p0), Vector(p1)
    a = (p1 - p0).normalized()
    u = a.cross(Vector((0, 0, 1)) if abs(a.z) < 0.9 else Vector((1, 0, 0))).normalized()
    w = a.cross(u)
    verts, faces = [], []
    for p, r in ((p0, r0), (p1, r1)):
        for i in range(segs):
            t = TAU * i / segs
            verts.append(p + (u * math.cos(t) + w * math.sin(t)) * r)
    for i in range(segs):
        i2 = (i + 1) % segs
        faces.append((i, i2, segs + i2, segs + i))
    if caps:
        verts += [p0, p1]
        for i in range(segs):
            i2 = (i + 1) % segs
            faces.append((2 * segs, i2, i))
            faces.append((2 * segs + 1, segs + i, segs + i2))
    return verts, faces


def box(w, h, d):
    x, y, z = w / 2, h / 2, d / 2
    v = [(-x, -y, -z), (x, -y, -z), (x, y, -z), (-x, y, -z), (-x, -y, z), (x, -y, z), (x, y, z), (-x, y, z)]
    f = [(4, 5, 6, 7), (1, 0, 3, 2), (5, 1, 2, 6), (0, 4, 7, 3), (7, 6, 2, 3), (0, 1, 5, 4)]
    return [Vector(p) for p in v], f


def loft(levels, corner=0.0):
    """Stack rectangles: levels = [(y, width_x, thickness_z), ...]; capped."""
    verts, faces = [], []
    for y, w, t in levels:
        verts += [Vector((-w / 2, y, t / 2)), Vector((w / 2, y, t / 2)), Vector((w / 2, y, -t / 2)), Vector((-w / 2, y, -t / 2))]
    for j in range(len(levels) - 1):
        o = j * 4
        for i in range(4):
            i2 = (i + 1) % 4
            faces.append((o + i, o + i2, o + 4 + i2, o + 4 + i))
    faces.append((3, 2, 1, 0))
    o = (len(levels) - 1) * 4
    faces.append((o, o + 1, o + 2, o + 3))
    return verts, faces


def patch(nu, nv, fn):
    """A grid of fn(u, v) for u, v in 0..1; the normal is du x dv."""
    verts, faces = [], []
    for j in range(nv + 1):
        for i in range(nu + 1):
            verts.append(Vector(fn(i / nu, j / nv)))
    for j in range(nv):
        for i in range(nu):
            a = j * (nu + 1) + i
            faces.append((a, a + 1, a + nu + 2, a + nu + 1))
    return verts, faces


def icosphere(sub):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1.0)
    bm.verts.ensure_lookup_table()
    # Blender (x, y, z) to page (x, z, -y)
    verts = [Vector((v.co.x, v.co.z, -v.co.y)) for v in bm.verts]
    faces = [tuple(v.index for v in f.verts) for f in bm.faces]
    bm.free()
    return verts, faces


def curls(p, scale, seed=0.0):
    """0..1, high in the middle of each curl."""
    q = Vector((p.x * scale + seed, p.y * scale + seed * 1.7, p.z * scale - seed))
    d = noise.voronoi(q, distance_metric='DISTANCE')[0]
    return max(0.0, 1.0 - (d[0] / 0.7) ** 2)


# ── a bag of coloured faces ─────────────────────────────────────────────────
class Geo:
    def __init__(self):
        self.v, self.f, self.c = [], [], []

    def add(self, shape, color, m=None):
        verts, faces = shape
        o = len(self.v)
        for i, p in enumerate(verts):
            p = Vector(p)
            self.v.append(m @ p if m is not None else p)
            self.c.append(color[i] if isinstance(color, list) else color)
        flip = m is not None and m.to_3x3().determinant() < 0
        for f in faces:
            idx = [o + k for k in f]
            self.f.append(idx[::-1] if flip else idx)
        return self

    def obj(self, name, mat, pivot=(0, 0, 0), smooth_shade=True, parent=None, soften=0):
        pv = Vector(pivot)
        me = bpy.data.meshes.new(name)
        me.from_pydata([bl(p - pv) for p in self.v], [], self.f)
        me.update()
        if soften:
            bm = bmesh.new()
            bm.from_mesh(me)
            for _ in range(soften):
                bmesh.ops.smooth_vert(bm, verts=bm.verts, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
            bm.to_mesh(me)
            bm.free()
        ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
        for i, c in enumerate(self.c):
            ca.data[i].color = (c[0], c[1], c[2], 1.0)
        me.color_attributes.active_color = ca
        me.color_attributes.render_color_index = 0
        for p in me.polygons:
            p.use_smooth = smooth_shade
        me.materials.append(mat)
        ob = bpy.data.objects.new(name, me)
        ob.location = bl(pv)
        bpy.context.collection.objects.link(ob)
        if parent is not None:
            ob.parent = parent
            ob.matrix_parent_inverse = parent.matrix_world.inverted()
        return ob


# ── materials ───────────────────────────────────────────────────────────────
def material(name, rough=0.7, metal=0.0, alpha=1.0, vcol=True, color=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if color is not None:
        bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    if vcol:
        vc = nt.nodes.new('ShaderNodeVertexColor')
        vc.layer_name = 'Col'
        nt.links.new(vc.outputs['Color'], bsdf.inputs['Base Color'])
    if alpha < 1.0:
        bsdf.inputs['Alpha'].default_value = alpha
        if hasattr(mat, 'surface_render_method'):
            mat.surface_render_method = 'BLENDED'
        else:
            mat.blend_method = 'BLEND'
    return mat


bpy.ops.wm.read_factory_settings(use_empty=True)

M_CLAY = material('clay', rough=0.62)
M_HAIR = material('hair', rough=1.0)
M_EYE = material('eye', rough=0.12)
M_METAL = material('metal', rough=0.38, metal=1.0)
M_MATTE = material('matte', rough=0.9)
M_WOOD = material('wood', rough=0.55)
M_PALETTE = material('palette', rough=0.3)  # solid, so the hand under it is not seen through it
M_PAINT = material('paint', rough=0.28)
M_PAIL = material('pail', rough=0.48, metal=0.35)
M_TIP = material('tip', rough=0.4, vcol=False, color=WHITE)
M_TIP2 = material('tip_round', rough=0.4, vcol=False, color=WHITE)
M_TIP3 = material('tip_knife', rough=0.3, vcol=False, color=WHITE)

layout = {'body': {'base': BASE, 'h': H, 'r': R}}


def empty(name, at=(0, 0, 0)):
    ob = bpy.data.objects.new(name, None)
    ob.location = bl(at)
    bpy.context.collection.objects.link(ob)
    return ob


# ════════════════════════════════════════════════════════════════════════════
# the host
# ════════════════════════════════════════════════════════════════════════════
cobb = empty('cobb')

# body ---------------------------------------------------------------------
RINGS, SEGS = 40, 56
prof = [(body_r(math.pi * j / RINGS), body_y(math.pi * j / RINGS)) for j in range(RINGS + 1)]
prof[0] = (0, BASE)
prof[-1] = (0, BASE + H)
bv, bf = lathe(prof, SEGS)
bc = []
for p in bv:
    # a little shading baked in: darker under the beard and round the feet, as a Pebble is drawn
    shade = 0.0
    shade += 0.35 * (1 - smooth(0.05, 0.3, p.y))
    c = mixc(BLUE, BLUE_DK, shade)
    bc.append(c)
Geo().add((bv, bf), bc).obj('cobb_body', M_CLAY, parent=cobb)

# feet ---------------------------------------------------------------------
for side, name in ((-1, 'cobb_foot_r'), (1, 'cobb_foot_l')):
    g = Geo().add(ellipsoid(0.125, 0.052, 0.17, 20, 10), NAVY, T(side * 0.15, 0.045, 0.06) @ RY(side * 0.22))
    g.obj(name, M_CLAY, pivot=(side * 0.15, 0.0, 0.06), parent=cobb)

# eyes ---------------------------------------------------------------------
EYE_PHI, EYE_Y = 0.36, 0.80
for side, name in ((-1, 'cobb_eye_r'), (1, 'cobb_eye_l')):
    m = surf_frame(side * EYE_PHI, EYE_Y, 0.004)
    g = Geo().add(ellipsoid(0.034, 0.047, 0.014, 20, 10), EYE, m)
    g.obj(name, M_EYE, pivot=surf(side * EYE_PHI, EYE_Y, 0.004), parent=cobb)

# eyebrows -----------------------------------------------------------------
for side, name in ((-1, 'cobb_brow_r'), (1, 'cobb_brow_l')):
    m = surf_frame(side * (EYE_PHI + 0.03), EYE_Y + 0.105, 0.0) @ RZ(side * -0.2)
    v, f = ellipsoid(0.075, 0.024, 0.03, 18, 8)
    col = []
    for p in v:
        k = curls(p, 26, 3.0)
        p *= 1 + 0.25 * k
        col.append(mixc(HAIR, HAIR_LT, k * 0.5))
    g = Geo().add((v, f), col, m)
    g.obj(name, M_HAIR, pivot=surf(side * (EYE_PHI + 0.03), EYE_Y + 0.105), parent=cobb)

# the afro -----------------------------------------------------------------
AFRO_C = Vector((0.0, 1.035, -0.05))
AFRO_R = Vector((0.52, 0.46, 0.49))
av, af = icosphere(5)
ac = []
out = []
for d in av:
    k = curls(d, 5.2)
    k2 = noise.noise(d * 2.6) * 0.5
    r = 0.97 + 0.15 * k + 0.05 * k2
    p = Vector((AFRO_C.x + d.x * AFRO_R.x * r, AFRO_C.y + d.y * AFRO_R.y * r, AFRO_C.z + d.z * AFRO_R.z * r))
    phi = abs(math.atan2(p.x, p.z))
    # the hairline: high over the forehead, down the temples to the sideburns, low round the back
    line = 1.0 - 0.34 * smooth(0.3, 1.25, phi) - 0.07 * smooth(1.5, 2.6, phi)
    line += 0.025 * noise.noise(Vector((phi * 6, 0.3, 0.7)))
    col = mixc(HAIR_DK, HAIR, smooth(0.0, 0.5, k))
    col = mixc(col, HAIR_LT, smooth(0.55, 1.0, k) * 0.55)
    if p.y < line:
        # below the hairline: tuck it up inside the head, which makes the afro's underside
        rr = math.hypot(p.x, p.z)
        inner = radius_at(max(line, 0.3)) * 0.82
        s = inner / rr if rr > 1e-6 else 0.0
        t = smooth(0.0, 0.16, line - p.y)
        p = Vector((p.x * (1 + (s - 1) * t), line - 0.02 * t + (p.y - line) * (1 - t), p.z * (1 + (s - 1) * t)))
        col = mixc(col, HAIR_DK, 0.7 + 0.3 * t)
    out.append(p)
    ac.append(col)
Geo().add((out, af), ac).obj('cobb_afro', M_HAIR, pivot=AFRO_C, parent=cobb, soften=2)

# the beard ----------------------------------------------------------------
PHI_B = 1.42


def beard_pt(u, v):
    phi = (u * 2 - 1) * PHI_B
    a = abs(phi) / PHI_B
    top = 0.675 + 0.085 * a ** 2
    bot = 0.415 + 0.25 * a ** 2.4
    y = bot + (top - bot) * v
    thick = 0.062 * math.sin(math.pi * v) ** 0.55 * (1 - 0.55 * a ** 2)
    edge = min(1.0, math.sin(math.pi * v) * 3.0) * min(1.0, (1 - a) * 6.0)
    k = curls(surf(phi, y), 8.5, 5.0)
    return surf(phi, y, (thick + 0.03 * k) * edge - 0.004), k


bv2, bf2 = patch(64, 22, lambda u, v: beard_pt(u, v)[0])
bc2 = []
for j in range(23):
    for i in range(65):
        k = beard_pt(i / 64, j / 22)[1]
        c = mixc(HAIR_DK, HAIR, smooth(0.0, 0.5, k))
        bc2.append(mixc(c, HAIR_LT, smooth(0.55, 1.0, k) * 0.5))
beard = Geo().add((bv2, bf2), bc2)
# the moustache: two lobes that droop at the ends
for side in (-1, 1):
    v, f = ellipsoid(0.125, 0.05, 0.05, 24, 12)
    col = []
    for p in v:
        k = curls(p, 11, 9.0 + side)
        p *= 1 + 0.22 * k
        p.y -= 0.9 * p.x * p.x * 4 * 0.05 / 0.125
        c = mixc(HAIR_DK, HAIR, smooth(0.0, 0.5, k))
        col.append(mixc(c, HAIR_LT, smooth(0.5, 1.0, k) * 0.55))
    beard.add((v, f), col, surf_frame(side * 0.19, 0.69, 0.012) @ RZ(side * -0.16))
beard.obj('cobb_beard', M_HAIR, parent=cobb, soften=1)

# the collar: two flaps of a shirt that is otherwise just him ----------------
collar = Geo()
for side in (-1, 1):
    def flap(u, v, side=side):
        # a triangle from the throat out over the chest
        phi = side * (0.05 + 0.52 * u * (1 - 0.15 * v))
        y = 0.455 - 0.20 * v * (1 - 0.72 * u) - 0.035 * u
        return surf(phi, y, 0.012 + 0.012 * math.sin(math.pi * u) * (1 - v))
    v, f = patch(8, 6, flap)
    collar.add((v, f), COLLAR, None if side > 0 else None)
    if side < 0:
        collar.f[-len(f):] = [face[::-1] for face in collar.f[-len(f):]]
for i, y in enumerate((0.27, 0.19)):
    collar.add(ellipsoid(0.017, 0.017, 0.007, 12, 6), COLLAR, surf_frame(0.0, y, 0.002))
collar.obj('cobb_collar', M_MATTE, parent=cobb)

layout['cobb'] = {
    'shoulderR': list(surf(-1.32, 0.47, -0.03)),
    'shoulderL': list(surf(1.32, 0.47, -0.03)),
    'eyeY': EYE_Y,
    'afroTop': AFRO_C.y + AFRO_R.y * 1.1,
    'afroC': list(AFRO_C),
}

# ════════════════════════════════════════════════════════════════════════════
# the easel and the canvas; the origin is the middle of the canvas's painted face
# ════════════════════════════════════════════════════════════════════════════
CW, CH, YC = 0.90, 0.675, 0.98
easel = empty('easel')
g = Geo()
TOP = 0.66
for sx in (-1, 1):
    g.add(tube((sx * 0.03, TOP, -0.055), (sx * 0.52, -YC, -0.045), 0.0135, 0.0135, 12), STEEL)
g.add(tube((0, TOP, -0.06), (0, -YC, -0.86), 0.0135, 0.0135, 12), STEEL)
g.add(box(0.036, 1.5, 0.02), STEEL, T(0, -0.05, -0.05))
kx = 0.03 + 0.49 * (TOP + 0.64) / (TOP + YC)
g.add(tube((-kx, -0.64, -0.047), (kx, -0.64, -0.047), 0.009, 0.009, 10), STEEL)
g.add(box(0.11, 0.05, 0.05), STEEL, T(0, TOP, -0.055))
g.obj('easel_metal', M_METAL, parent=easel)

g = Geo()
g.add(box(0.98, 0.03, 0.085), BLACK, T(0, -CH / 2 - 0.015, -0.0025))
g.add(box(0.98, 0.022, 0.008), BLACK, T(0, -CH / 2 + 0.004, 0.036))
g.add(box(0.12, 0.03, 0.07), BLACK, T(0, CH / 2 + 0.015, -0.005))
g.add(box(0.12, 0.02, 0.008), BLACK, T(0, CH / 2 - 0.002, 0.026))
for x, z in ((-0.52, -0.045), (0.52, -0.045), (0, -0.86)):
    g.add(ellipsoid(0.022, 0.016, 0.022, 10, 6), BLACK, T(x, -YC + 0.012, z))
g.obj('easel_black', M_MATTE, smooth_shade=False, parent=easel)

g = Geo()
g.add(box(CW, CH, 0.028), LINEN, T(0, 0, -0.0145))
bar = 0.045
for x in (-CW / 2 + bar / 2, CW / 2 - bar / 2):
    g.add(box(bar, CH, 0.02), WOOD, T(x, 0, -0.038))
for y in (-CH / 2 + bar / 2, CH / 2 - bar / 2):
    g.add(box(CW, bar, 0.02), WOOD, T(0, y, -0.038))
g.obj('canvas_body', M_MATTE, smooth_shade=False, parent=easel)

layout['canvas'] = {'w': CW, 'h': CH, 'yc': YC}

# ════════════════════════════════════════════════════════════════════════════
# the palette: lies in XZ, held at the origin
# ════════════════════════════════════════════════════════════════════════════
PA, PB, PCX = 0.27, 0.2, 0.2
pal = empty('palette')
prof = [(0, -0.004), (0.96, -0.004), (1.0, 0.0), (0.96, 0.004), (0, 0.004)]
v, f = lathe(prof, 48)
v = [Vector((PCX + p.x * PA * (1 - 0.1 * (p.x > 0) * abs(p.z)), p.y, p.z * PB)) for p in v]
Geo().add((v, f), hexc(0xf2f4f6)).obj('palette_plate', M_PALETTE, parent=pal)

blobs = Geo()
layout['blobs'] = {}
n = len(PAINTS)
for i, (pid, hx) in enumerate(PAINTS):
    # round the far edge and the outer end; the end nearest his body is kept clear for the hand that holds it
    a = math.radians(150 - 210 * i / (n - 1))
    big = 1.6 if pid == 'white' else 1.0
    x = PCX + math.cos(a) * PA * 0.76
    z = -math.sin(a) * PB * 0.74
    bv3, bf3 = ellipsoid(0.021 * big, 0.013 * big, 0.021 * big, 14, 8)
    for p in bv3:
        p *= 1 + 0.22 * noise.noise(p * 60 + Vector((i, 0, 0)))
        p.y = max(p.y, -0.004)
    blobs.add((bv3, bf3), hexc(hx), T(x, 0.008, z))
    layout['blobs'][pid] = [x, 0.016 * big, z]
# where he mixes: a smear in the middle
mv, mf = ellipsoid(0.075, 0.004, 0.05, 20, 6)
blobs.add((mv, mf), hexc(0xb9c6d6), T(PCX + 0.02, 0.005, 0.045))
layout['mix'] = [PCX + 0.02, 0.012, 0.045]
blobs.obj('palette_blobs', M_PAINT, parent=pal)

# ════════════════════════════════════════════════════════════════════════════
# tools: the working tip is the origin, +Y runs up the handle, a flat brush is wide in X
# ════════════════════════════════════════════════════════════════════════════
b2 = empty('brush_big')
Geo().add(loft([(0.0, 0.112, 0.007), (0.036, 0.108, 0.02)]), WHITE).obj('brush_big_tip', M_TIP, smooth_shade=False, parent=b2)
g = Geo()
g.add(loft([(0.036, 0.108, 0.02), (0.088, 0.102, 0.026)]), BRISTLE)
g.obj('brush_big_hair', M_MATTE, smooth_shade=False, parent=b2)
Geo().add(loft([(0.088, 0.106, 0.03), (0.124, 0.106, 0.03)]), STEEL).obj('brush_big_ferrule', M_METAL, smooth_shade=False, parent=b2)
Geo().add(loft([(0.124, 0.1, 0.024), (0.17, 0.062, 0.022), (0.3, 0.04, 0.018), (0.335, 0.046, 0.016)]), WOOD) \
    .obj('brush_big_handle', M_WOOD, smooth_shade=False, parent=b2)

b1 = empty('brush_round')
Geo().add(lathe([(0, 0.0), (0.0075, 0.02), (0.0095, 0.046)], 12), WHITE).obj('brush_round_tip', M_TIP2, parent=b1)
Geo().add(lathe([(0.0095, 0.046), (0.0085, 0.095), (0, 0.095)], 12), STEEL).obj('brush_round_ferrule', M_METAL, parent=b1)
Geo().add(lathe([(0, 0.095), (0.0085, 0.095), (0.01, 0.15), (0.0055, 0.35), (0, 0.352)], 12), hexc(0x9a3324)) \
    .obj('brush_round_handle', M_WOOD, parent=b1)

kn = empty('knife')
blade = [Vector((0, 0, 0)), Vector((0.021, 0.05, 0)), Vector((0.007, 0.112, 0)), Vector((-0.007, 0.112, 0)), Vector((-0.021, 0.05, 0))]
kv = [p + Vector((0, 0, 0.0012)) for p in blade] + [p - Vector((0, 0, 0.0012)) for p in blade]
kf = [(0, 1, 2, 3, 4), (9, 8, 7, 6, 5)] + [(i, 5 + i, 5 + (i + 1) % 5, (i + 1) % 5) for i in range(5)]
Geo().add((kv, kf), WHITE).obj('knife_blade', M_TIP3, smooth_shade=False, parent=kn)
g = Geo().add(tube((0, 0.108, 0), (0, 0.145, 0.022), 0.0035, 0.0035, 8), STEEL)
g.obj('knife_neck', M_METAL, parent=kn)
Geo().add(lathe([(0, 0.0), (0.011, 0.004), (0.013, 0.06), (0.01, 0.125), (0, 0.128)], 12), WOOD_DK, T(0, 0.142, 0.022)) \
    .obj('knife_handle', M_WOOD, parent=kn)

# ════════════════════════════════════════════════════════════════════════════
# the bucket he washes the brush in: a galvanised pail of thinner. The origin is the middle of its base.
# ════════════════════════════════════════════════════════════════════════════
bucket = empty('bucket')
PAIL_H, PAIL_R0, PAIL_R1, LIQUID_Y = 0.215, 0.096, 0.124, 0.15
PAIL = hexc(0xb9bdc4)
PAIL_IN = hexc(0x7d838b)
LABEL = hexc(0xe9dfc6)
LABEL_RED = hexc(0xb5392c)


def pail_r(y):
    return PAIL_R0 + (PAIL_R1 - PAIL_R0) * (y - 0.012) / (PAIL_H - 0.012)


# up the outside (with a paper label round the middle), over the rolled rim, down the inside
rows = [(0, 0.0, PAIL_IN), (0.092, 0.0, PAIL), (PAIL_R0, 0.012, PAIL)]
for y, c in ((0.060, PAIL), (0.061, LABEL_RED), (0.072, LABEL_RED), (0.073, LABEL), (0.137, LABEL),
             (0.138, LABEL_RED), (0.149, LABEL_RED), (0.150, PAIL)):
    rows.append((pail_r(y), y, c))
rows += [(PAIL_R1, PAIL_H, PAIL), (0.131, 0.222, PAIL), (0.131, 0.230, PAIL), (0.122, 0.230, PAIL),
         (0.119, PAIL_H, PAIL_IN), (0.094, 0.02, PAIL_IN), (0, 0.02, PAIL_IN)]
SEG_P = 40
pv, pf = lathe([(r, y) for r, y, _ in rows], SEG_P)
pc = []
for r, y, c in rows:
    pc += [c] * (1 if r < 1e-6 else SEG_P)
Geo().add((pv, pf), pc).obj('bucket_pail', M_PAIL, parent=bucket)

# the thinner, well used
r_in = 0.094 + (0.119 - 0.094) * (LIQUID_Y - 0.02) / (PAIL_H - 0.02)
Geo().add(lathe([(0, LIQUID_Y), (r_in * 0.6, LIQUID_Y), (r_in, LIQUID_Y)], SEG_P), hexc(0x55646e)) \
    .obj('bucket_liquid', M_PAINT, parent=bucket)

# a wire handle, fallen forward against the side, and the two ears it hangs from
g = Geo()
HR, DROP = 0.14, math.radians(35)
pts = [Vector((HR * math.cos(a), 0.212 - HR * math.sin(a) * math.sin(DROP), HR * math.sin(a) * math.cos(DROP)))
       for a in (math.pi * i / 18 for i in range(19))]
for a, b in zip(pts, pts[1:]):
    g.add(tube(a, b, 0.0036, 0.0036, 8, caps=False), STEEL)
for sx in (-1, 1):
    g.add(box(0.012, 0.03, 0.022), STEEL, T(sx * 0.134, 0.208, 0))
g.obj('bucket_handle', M_METAL, parent=bucket)

# where the brush has been wiped on the rim
g = Geo()
for ang, y, hx in ((0.5, 0.2, 0x123c8c), (-0.55, 0.196, 0xf5f2e8), (2.3, 0.2, 0xd9281e), (1.2, 0.19, 0x3f6b24)):
    dv, df = ellipsoid(0.013, 0.024, 0.006, 10, 6)
    g.add((dv, df), hexc(hx), T(math.sin(ang) * (pail_r(y) + 0.002), y, math.cos(ang) * (pail_r(y) + 0.002)) @ RY(ang))
g.obj('bucket_drips', M_PAINT, parent=bucket)

layout['bucket'] = {'h': 0.23, 'r': 0.122, 'liquid': LIQUID_Y}

# ── tidy: consistent normals everywhere ─────────────────────────────────────
for ob in bpy.data.objects:
    if ob.type != 'MESH':
        continue
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()

# ── export ──────────────────────────────────────────────────────────────────
os.makedirs(os.path.dirname(OUT), exist_ok=True)
props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
kw = dict(filepath=OUT, export_format='GLB', export_yup=True, export_apply=True, export_animations=False,
          export_cameras=False, export_lights=False, export_normals=True, export_texcoords=False)
if 'export_vertex_color' in props:
    kw['export_vertex_color'] = 'MATERIAL'
if 'export_all_vertex_colors' in props:
    kw['export_all_vertex_colors'] = False
if 'export_active_vertex_color_when_no_material' in props:
    kw['export_active_vertex_color_when_no_material'] = True
bpy.ops.export_scene.gltf(**kw)
with open(os.path.join(os.path.dirname(OUT), 'layout.json'), 'w') as fh:
    json.dump(layout, fh, indent=1)
tris = sum(len(p.vertices) - 2 for ob in bpy.data.objects if ob.type == 'MESH' for p in ob.data.polygons)
print(f'SET: {len([o for o in bpy.data.objects if o.type == "MESH"])} meshes, {tris} triangles, '
      f'{os.path.getsize(OUT) / 1024:.0f} KB -> {OUT}')

# ════════════════════════════════════════════════════════════════════════════
# optional: a portrait of the host at his easel, used as a reference picture
# ════════════════════════════════════════════════════════════════════════════
if HERO:
    def bez(p0, p1, p2, t):
        return p0 * (1 - t) ** 2 + p1 * 2 * t * (1 - t) + p2 * t * t

    def arm(name, a, b, c):
        g = Geo()
        a, b, c = Vector(a), Vector(b), Vector(c)
        pts = [bez(a, b, c, i / 12) for i in range(13)]
        for i in range(12):
            g.add(tube(pts[i], pts[i + 1], 0.075, 0.075, 14, caps=False), BLUE)
        for p in pts:
            g.add(ellipsoid(0.075, 0.075, 0.075, 14, 8), BLUE, T(*p))
        return g.obj(name, M_CLAY)

    Geo().add(box(CW, CH, 0.001), LINEN, T(0, 0, 0.0008)).obj('canvas_face', M_MATTE, parent=easel)
    # host on the left, turned a little to the canvas; easel on the right
    cobb.location = bl((-0.42, 0, 0.1))
    cobb.rotation_euler = (0, 0, 0.32)          # Blender Z is the page's Y
    easel.location = bl((0.62, YC, -0.1))
    easel.rotation_euler = (0, 0, -0.3)
    bpy.context.view_layer.update()

    def host(p):
        return Matrix.Translation(Vector((-0.42, 0, 0.1))) @ RY(0.32) @ Vector(p)

    sr, sl = Vector(layout['cobb']['shoulderR']), Vector(layout['cobb']['shoulderL'])
    hand_r = Vector((-0.86, 0.5, 0.42))
    arm('arm_r', host(sr), host(sr) + Vector((-0.22, -0.16, 0.12)), hand_r)
    hand_l = host(sl) + Vector((0.2, -0.02, 0.3))
    arm('arm_l', host(sl), host(sl) + Vector((0.16, -0.14, 0.12)), hand_l)
    pal.location = bl(hand_l + Vector((-0.06, 0.07, 0.0)))
    pal.rotation_euler = (math.radians(38), math.radians(8), math.radians(-12))
    b2.location = bl(hand_r + Vector((0.0, 0.27, 0.02)))
    b2.rotation_euler = (math.radians(180), math.radians(12), math.radians(0))
    b1.location = bl((5, 0, 0))
    kn.location = bl((5, 0, 0))
    bucket.location = bl((0.2, 0, 0.42))

    world = bpy.data.worlds.new('w')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (0.0, 0.0, 0.0, 1)
    bpy.context.scene.world = world

    def light(name, kind, at, energy, size, color=(1, 1, 1), target=(0, 0.75, 0)):
        d = bpy.data.lights.new(name, kind)
        d.energy = energy
        d.color = color
        if kind == 'AREA':
            d.size = size
        ob = bpy.data.objects.new(name, d)
        ob.location = bl(at)
        bpy.context.collection.objects.link(ob)
        direction = bl(target) - ob.location
        ob.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
        return ob

    light('key', 'AREA', (-1.6, 2.4, 3.2), 520, 2.2, (1.0, 0.96, 0.9))
    light('fill', 'AREA', (2.6, 1.2, 3.0), 160, 3.0, (0.85, 0.9, 1.0))
    light('hair', 'AREA', (-0.6, 2.8, -2.4), 620, 1.2, (1.0, 0.9, 0.75), target=(-0.4, 1.0, 0))

    fl = Geo().add(box(12, 0.02, 12), hexc(0x0b0b0c), T(0, -0.01, 0)).obj('floor', M_MATTE)

    cam_d = bpy.data.cameras.new('cam')
    cam_d.lens = 62
    cam = bpy.data.objects.new('cam', cam_d)
    cam.location = bl((0.1, 0.86, 4.9))
    bpy.context.collection.objects.link(cam)
    cam.rotation_euler = (bl((0.1, 0.72, 0)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc = bpy.context.scene
    sc.camera = cam
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = 96
    sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = 1440, 1080
    sc.render.filepath = HERO
    sc.view_settings.view_transform = 'Standard'
    bpy.ops.render.render(write_still=True)
    print('HERO ->', HERO)
