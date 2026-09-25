import bpy, bmesh, sys, math, os
from mathutils import Vector, Matrix, Euler

# ============================================================================
# Julia Thumbnail-Studio – Minecraft-3D-Render (Blender headless).
# Baut einen (oder mehrere) Minecraft-Charaktere prozedural aus der rohen Skin-
# Textur (64x64), posiert sie, gibt ein 3D-Item in die Hand, setzt Szene + Licht
# und rendert ein 1280x720-Bild. KEIN externes Rig (keine Lizenzfragen).
# Aufruf:
#   blender -b -P mc_render.py -- skins=A.png;B.png poses=bereit;walk items=sword;none out=x.png
# ============================================================================

argv = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
def arg(name, default=None):
    for a in argv:
        if a.startswith(name+'='):
            return a[len(name)+1:]
    return default

SKINS = [s for s in (arg('skins','') or arg('skin','')).split(';') if s]
POSES = (arg('poses', arg('pose','bereit')) or 'bereit').split(';')
ITEMS = (arg('items', arg('item','sword')) or 'sword').split(';')
OUT = arg('out', 'mc.png')
SCENE = arg('scene', 'gras')
ITEMDIR = arg('itemdir', os.path.dirname(SKINS[0]) if SKINS else '.')
RESX = int(arg('rx','1280')); RESY = int(arg('ry','720'))
SAMP = int(arg('samples','28'))
if not SKINS:
    print('FEHLER: kein Skin angegeben'); sys.exit(1)

bpy.ops.wm.read_factory_settings(use_empty=True)
scn = bpy.context.scene

def hautmaterial(skin_path):
    img = bpy.data.images.load(skin_path); img.alpha_mode='CHANNEL_PACKED'
    mat = bpy.data.materials.new('skin'); mat.use_nodes=True; mat.blend_method='CLIP'
    nt=mat.node_tree; nt.nodes.clear()
    tex=nt.nodes.new('ShaderNodeTexImage'); tex.image=img; tex.interpolation='Closest'
    b=nt.nodes.new('ShaderNodeBsdfPrincipled'); b.inputs['Roughness'].default_value=0.95
    o=nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(tex.outputs['Color'], b.inputs['Base Color'])
    nt.links.new(tex.outputs['Alpha'], b.inputs['Alpha'])
    nt.links.new(b.outputs['BSDF'], o.inputs['Surface'])
    return mat

def region(ox,oy,w,d,h):
    return {'top':(ox+d,oy,ox+d+w,oy+d),'bottom':(ox+d+w,oy,ox+d+2*w,oy+d),
            'right':(ox,oy+d,ox+d,oy+d+h),'front':(ox+d,oy+d,ox+d+w,oy+d+h),
            'left':(ox+d+w,oy+d,ox+2*d+w,oy+d+h),'back':(ox+2*d+w,oy+d,ox+2*d+2*w,oy+d+h)}

def uvrect(px):
    x0,y0,x1,y1=px
    return [(x0/64,1-y1/64),(x1/64,1-y1/64),(x1/64,1-y0/64),(x0/64,1-y0/64)]

def make_part(name,w,d,h,ztop,uv,loc,mat):
    me=bpy.data.meshes.new(name); ob=bpy.data.objects.new(name,me); scn.collection.objects.link(ob)
    bm=bmesh.new(); x0,x1=-w/2,w/2; y0,y1=-d/2,d/2; z0,z1=ztop-h,ztop
    faces={'front':[(x0,y0,z0),(x1,y0,z0),(x1,y0,z1),(x0,y0,z1)],
           'back':[(x1,y1,z0),(x0,y1,z0),(x0,y1,z1),(x1,y1,z1)],
           'right':[(x0,y1,z0),(x0,y0,z0),(x0,y0,z1),(x0,y1,z1)],
           'left':[(x1,y0,z0),(x1,y1,z0),(x1,y1,z1),(x1,y0,z1)],
           'top':[(x0,y0,z1),(x1,y0,z1),(x1,y1,z1),(x0,y1,z1)],
           'bottom':[(x0,y1,z0),(x1,y1,z0),(x1,y0,z0),(x0,y0,z0)]}
    uvl=bm.loops.layers.uv.new()
    for fn,vs in faces.items():
        f=bm.faces.new([bm.verts.new(p) for p in vs])
        for loop,uvc in zip(f.loops, uvrect(uv[fn])): loop[uvl].uv=uvc
    bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=0.001)
    bm.to_mesh(me); bm.free(); me.materials.append(mat)
    ob.location=loc
    for p in me.polygons: p.use_smooth=False
    return ob

def add_item_3d(tex_path, rarm, xoff):
    im=bpy.data.images.load(tex_path); w,h=im.size; px=im.pixels[:]
    me=bpy.data.meshes.new('item'); it=bpy.data.objects.new('item',me); scn.collection.objects.link(it)
    bm=bmesh.new(); col=bm.loops.layers.color.new('Col')
    T=0.8; gx=4.5; gz=4.5
    FACES=[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)]
    def cube(cx,cz,color):
        x0,x1=cx-0.5,cx+0.5; y0,y1=-T/2,T/2; z0,z1=cz-0.5,cz+0.5
        vs=[bm.verts.new((x0,y0,z0)),bm.verts.new((x1,y0,z0)),bm.verts.new((x1,y0,z1)),bm.verts.new((x0,y0,z1)),
            bm.verts.new((x0,y1,z0)),bm.verts.new((x1,y1,z0)),bm.verts.new((x1,y1,z1)),bm.verts.new((x0,y1,z1))]
        for fi in FACES:
            ff=bm.faces.new([vs[k] for k in fi])
            for lo in ff.loops: lo[col]=color
    for yy in range(h):
        for xx in range(w):
            i=(yy*w+xx)*4
            if px[i+3] < 0.5: continue
            cube(xx-gx, yy-gz, (px[i],px[i+1],px[i+2],1.0))
    for v in bm.verts: v.co.rotate(Euler((0.0, math.radians(-45.0), 0.0)))
    bm.normal_update(); bm.to_mesh(me); bm.free()
    m=bpy.data.materials.new('itemmat'); m.use_nodes=True; nt2=m.node_tree; nt2.nodes.clear()
    vc=nt2.nodes.new('ShaderNodeVertexColor'); vc.layer_name='Col'
    b2=nt2.nodes.new('ShaderNodeBsdfPrincipled'); b2.inputs['Roughness'].default_value=0.55
    o2=nt2.nodes.new('ShaderNodeOutputMaterial')
    nt2.links.new(vc.outputs['Color'], b2.inputs['Base Color']); nt2.links.new(b2.outputs['BSDF'], o2.inputs['Surface'])
    me.materials.append(m)
    for p in me.polygons: p.use_smooth=False
    bpy.context.view_layer.update()
    hand = rarm.matrix_world @ Vector((0.0,-2.2,-11.3))
    cam = scn.camera.matrix_world.translation
    zb = Vector((0.0,-0.28,0.96)).normalized()
    camdir = (cam-hand)
    if camdir.length<1e-4: camdir=Vector((0,-1,0))
    camdir.normalize()
    nb = camdir - camdir.dot(zb)*zb
    if nb.length<1e-4: nb=Vector((0,-1,0))
    nb.normalize()
    yb=-nb; xb=yb.cross(zb).normalized(); yb=zb.cross(xb).normalized()
    R=Matrix(((xb.x,yb.x,zb.x),(xb.y,yb.y,zb.y),(xb.z,yb.z,zb.z)))
    it.matrix_world = Matrix.Translation(hand) @ R.to_4x4() @ Matrix.Rotation(math.radians(60),4,'Z') @ Matrix.Scale(0.82,4)
    return it

def rotx(ob,deg): ob.rotation_euler=(math.radians(deg),0,0)

def build_char(skin_path, xoff, pose, item, facing=0.0):
    mat = hautmaterial(skin_path)
    head=make_part('head',8,8,8,8,region(0,0,8,8,8),(0,0,24),mat)
    hat =make_part('hat',9,9,9,9,region(32,0,8,8,8),(0,0,23.5),mat)
    body=make_part('body',8,4,12,12,region(16,16,8,4,12),(0,0,12),mat)
    rarm=make_part('rarm',4,4,12,0,region(40,16,4,4,12),(-6,0,24),mat)
    larm=make_part('larm',4,4,12,0,region(32,48,4,4,12),(6,0,24),mat)
    rleg=make_part('rleg',4,4,12,0,region(0,16,4,4,12),(-2,0,12),mat)
    lleg=make_part('lleg',4,4,12,0,region(16,48,4,4,12),(2,0,12),mat)
    if pose=='walk': rotx(rarm,-35);rotx(larm,35);rotx(rleg,30);rotx(lleg,-30)
    elif pose=='attack': rarm.rotation_euler=(math.radians(-150),0,0);rotx(larm,20);rotx(rleg,15);rotx(lleg,-15)
    elif pose=='bereit': rotx(rarm,-62);rotx(larm,-22);rotx(rleg,18);rotx(lleg,-16)
    elif pose=='angst': rotx(rarm,-120);rotx(larm,-120);rotx(rleg,-10);rotx(lleg,20)  # Abwehr/Schreck
    else: rotx(rarm,-6);rotx(larm,6)
    # Eigener Wurzel-Empty je Figur: Position (xoff) + Blickrichtung (facing).
    root=bpy.data.objects.new('root',None); scn.collection.objects.link(root)
    for ob in [head,hat,body,rarm,larm,rleg,lleg]:
        ob.parent=root; ob.matrix_parent_inverse=Matrix.Identity(4)
    root.location=(xoff,0,0); root.rotation_euler=(0,0,math.radians(facing))
    bpy.context.view_layer.update()
    if item in ('sword','pickaxe'):
        p=os.path.join(ITEMDIR, 'sword.png' if item=='sword' else 'pickaxe.png')
        if os.path.exists(p): add_item_3d(p, rarm, xoff)

# ---- Szene ----
if SCENE=='gras':
    bpy.ops.mesh.primitive_plane_add(size=600, location=(0,0,0))
    g=bpy.context.active_object; gm=bpy.data.materials.new('gras'); gm.use_nodes=True
    gb=gm.node_tree.nodes.get('Principled BSDF'); gb.inputs['Base Color'].default_value=(0.22,0.52,0.12,1); gb.inputs['Roughness'].default_value=1.0
    g.data.materials.append(gm)
world=bpy.data.worlds.new('w'); scn.world=world; world.use_nodes=True
bg=world.node_tree.nodes.get('Background'); bg.inputs['Color'].default_value=(0.34,0.62,0.98,1); bg.inputs['Strength'].default_value=1.0
light=bpy.data.lights.new('sun','SUN'); light.energy=3.3; light.angle=math.radians(4); light.color=(1.0,0.97,0.9)
lo=bpy.data.objects.new('sun',light); scn.collection.objects.link(lo); lo.rotation_euler=(math.radians(52),math.radians(15),math.radians(35))
fill=bpy.data.lights.new('fill','SUN'); fill.energy=0.7; fill.color=(0.8,0.9,1.0)
fo=bpy.data.objects.new('fill',fill); scn.collection.objects.link(fo); fo.rotation_euler=(math.radians(60),0,math.radians(-120))

# ---- Anordnung (Reihe nebeneinander ODER Kampf: einander zugewandt) ----
ANORDNUNG = arg('anordnung','reihe')
n=len(SKINS)
if ANORDNUNG=='kampf' and n>=2:
    offs=[-11.0, 11.0] + [ (i)*13.0 for i in range(2,n) ]
    facings=[-32.0, 32.0] + [0.0]*(max(0,n-2))
    std_poses=['attack','angst']
else:
    offs=[ (i-(n-1)/2.0)*13.0 for i in range(n) ]
    facings=[0.0]*n
    std_poses=None

# ---- Kamera (breiter, je mehr Figuren) ----
cam=bpy.data.cameras.new('cam'); co=bpy.data.objects.new('cam',cam); scn.collection.objects.link(co); scn.camera=co
cam.lens = 38
dist = 92 + (n-1)*22
co.location=(22, -dist, 20)
ziel=Vector((0,0,16))
co.rotation_euler=(ziel-co.location).to_track_quat('-Z','Y').to_euler()

# ---- Charaktere bauen ----
for i,skin in enumerate(SKINS):
    if i < len(POSES) and POSES[i]:
        pose = POSES[i]
    elif std_poses and i < len(std_poses):
        pose = std_poses[i]
    else:
        pose = POSES[-1]
    item = ITEMS[i] if i < len(ITEMS) else 'none'
    build_char(skin, offs[i], pose, item, facings[i])

# ---- Render ----
scn.render.engine='CYCLES'; scn.cycles.device='CPU'; scn.cycles.samples=SAMP; scn.cycles.use_denoising=True
scn.render.resolution_x=RESX; scn.render.resolution_y=RESY
scn.render.film_transparent = (SCENE=='transparent')
try:
    scn.view_settings.view_transform='Standard'; scn.view_settings.look='None'
except Exception: pass
scn.render.filepath=OUT
bpy.ops.render.render(write_still=True)
print('MC RENDER OK ->', OUT)
