import bpy, bmesh, sys, math, os, json
from mathutils import Vector, Matrix, Euler

# ============================================================================
# Julia Thumbnail-Studio - Minecraft-3D-Render (Blender headless).
# Baut EINE FREIE SZENE aus einer JSON-Beschreibung: beliebig viele Charaktere
# (prozedural aus der rohen 64x64-Skin-Textur), frei posiert (Gelenkwinkel oder
# Preset), mit 3D-Item in der Hand, dazu Props (3D-Logo-Text, Bloecke/TNT) und
# eine Szene (Gras/Nacht/Nether/transparent). Kein externes Rig (keine Lizenz).
#
# Aufruf (bevorzugt, voll flexibel):
#   blender -b -P mc_render.py -- spec=szene.json out=x.png itemdir=assets
# Aufruf (einfach, rueckwaertskompatibel):
#   blender -b -P mc_render.py -- skins=A.png;B.png poses=bereit items=sword out=x.png
# ============================================================================

argv = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
def arg(name, default=None):
    for a in argv:
        if a.startswith(name+'='):
            return a[len(name)+1:]
    return default

OUT = os.path.abspath(arg('out', 'mc.png'))
RESX = int(arg('rx','1280')); RESY = int(arg('ry','720'))
SAMP = int(arg('samples','28'))
ITEMDIR = os.path.abspath(arg('itemdir', '.'))

def _pfad(p):
    # Pfad robust aufloesen: absolut, sonst relativ zum itemdir/spec-Ordner.
    if not p: return p
    if os.path.isabs(p) and os.path.exists(p): return p
    for base in (ITEMDIR, os.path.dirname(os.path.abspath(SPEC_PFAD)) if arg('spec') else '.', '.'):
        c=os.path.join(base, p)
        if os.path.exists(c): return c
    return p

# ---- Szenen-Spezifikation laden (JSON) oder aus einfachen Args bauen ----
def spec_aus_args():
    skins = [s for s in (arg('skins','') or arg('skin','')).split(';') if s]
    poses = (arg('poses', arg('pose','bereit')) or 'bereit').split(';')
    items = (arg('items', arg('item','sword')) or 'sword').split(';')
    anordnung = arg('anordnung','reihe')
    n = len(skins)
    figuren = []
    if anordnung=='kampf' and n>=2:
        offs=[-11.0,11.0]+[i*13.0 for i in range(2,n)]
        facings=[-32.0,32.0]+[0.0]*max(0,n-2)
        std=['attack','angst']
    elif anordnung=='umzingelt' and n>=2:
        # Held Mitte, Rest im Halbkreis dahinter/seitlich, alle greifen an
        offs=[0.0]; facings=[0.0]; std=['bereit']
        import math as _m
        rest=n-1
        for k in range(rest):
            ang = -70 + (140.0*(k+0.5)/max(1,rest))
            r = 20.0
            offs.append(r*_m.sin(_m.radians(ang)))
            facings.append(-ang)  # zum Helden schauen
        std = ['bereit'] + ['attack']*rest
    else:
        offs=[(i-(n-1)/2.0)*13.0 for i in range(n)]
        facings=[0.0]*n
        std=None
    for i,sk in enumerate(skins):
        pose = poses[i] if i<len(poses) and poses[i] else (std[i] if std and i<len(std) else poses[-1])
        figuren.append({'skin':sk,'pos':[offs[i] if i<len(offs) else 0,0],
                        'drehung':facings[i] if i<len(facings) else 0,'pose':pose,
                        'item':items[i] if i<len(items) else 'none'})
    return {'szene':arg('scene','gras'),'figuren':figuren,'props':[]}

SPEC_PFAD = arg('spec')
if SPEC_PFAD and os.path.exists(SPEC_PFAD):
    with open(SPEC_PFAD,'r',encoding='utf-8') as fh: SPEC = json.load(fh)
else:
    SPEC = spec_aus_args()

FIGUREN = SPEC.get('figuren') or SPEC.get('characters') or []
PROPS   = SPEC.get('props') or []
SZENE   = SPEC.get('szene') or SPEC.get('scene') or 'gras'
if not FIGUREN and not PROPS:
    print('FEHLER: leere Szene (keine Figuren/Props)'); sys.exit(1)

bpy.ops.wm.read_factory_settings(use_empty=True)
scn = bpy.context.scene

# Kantenschraege (Bevel) auf die Shading-Normale: die harten Wuerfelkanten fangen
# Licht ein -> weg vom flachen "Spielzeug"-Look, ohne die Silhouette zu aendern.
def _bevel(nt, principled, radius=0.06):
    try:
        bev=nt.nodes.new('ShaderNodeBevel'); bev.samples=4
        bev.inputs['Radius'].default_value=radius
        nt.links.new(bev.outputs['Normal'], principled.inputs['Normal'])
    except Exception: pass

# ---------------------------------------------------------------- Materialien
def hautmaterial(skin_path):
    img = bpy.data.images.load(skin_path); img.alpha_mode='CHANNEL_PACKED'
    mat = bpy.data.materials.new('skin'); mat.use_nodes=True; mat.blend_method='CLIP'
    nt=mat.node_tree; nt.nodes.clear()
    tex=nt.nodes.new('ShaderNodeTexImage'); tex.image=img; tex.interpolation='Closest'
    b=nt.nodes.new('ShaderNodeBsdfPrincipled'); b.inputs['Roughness'].default_value=0.9
    try: b.inputs['Specular IOR Level'].default_value=0.35
    except Exception: pass
    o=nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(tex.outputs['Color'], b.inputs['Base Color'])
    nt.links.new(tex.outputs['Alpha'], b.inputs['Alpha'])
    nt.links.new(b.outputs['BSDF'], o.inputs['Surface'])
    _bevel(nt, b)
    return mat

def farbmaterial(rgb, rough=0.7, emiss=0.0):
    m=bpy.data.materials.new('farb'); m.use_nodes=True
    b=m.node_tree.nodes.get('Principled BSDF')
    c=(rgb[0],rgb[1],rgb[2],1.0)
    b.inputs['Base Color'].default_value=c; b.inputs['Roughness'].default_value=rough
    if emiss>0:
        try:
            b.inputs['Emission Color'].default_value=c; b.inputs['Emission Strength'].default_value=emiss
        except Exception: pass
    _bevel(m.node_tree, b)
    return m

# ---------------------------------------------------------------- Body-Boxen
def region(ox,oy,w,d,h):
    return {'top':(ox+d,oy,ox+d+w,oy+d),'bottom':(ox+d+w,oy,ox+d+2*w,oy+d),
            'right':(ox,oy+d,ox+d,oy+d+h),'front':(ox+d,oy+d,ox+d+w,oy+d+h),
            'left':(ox+d+w,oy+d,ox+2*d+w,oy+d+h),'back':(ox+2*d+w,oy+d,ox+2*d+2*w,oy+d+h)}

def region_slice(ox,oy,w,d,h,part):
    """UV eines halben Gliedmaßen-Kastens (obere/untere Hälfte) für Ellbogen/Knie."""
    hh=h/2.0
    if part=='oben':
        y0,y1=oy+d, oy+d+hh
        return {'top':(ox+d,oy,ox+d+w,oy+d),
                'bottom':(ox+d,y1-0.5,ox+d+w,y1+0.5),
                'right':(ox,y0,ox+d,y1),'front':(ox+d,y0,ox+d+w,y1),
                'left':(ox+d+w,y0,ox+2*d+w,y1),'back':(ox+2*d+w,y0,ox+2*d+2*w,y1)}
    else:
        y0,y1=oy+d+hh, oy+d+h
        return {'top':(ox+d,y0-0.5,ox+d+w,y0+0.5),
                'bottom':(ox+d+w,oy,ox+d+2*w,oy+d),
                'right':(ox,y0,ox+d,y1),'front':(ox+d,y0,ox+d+w,y1),
                'left':(ox+d+w,y0,ox+2*d+w,y1),'back':(ox+2*d+w,y0,ox+2*d+2*w,y1)}

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

# ---------------------------------------------------------------- 3D-Item
def add_item_3d(tex_path, rarm, groesse=0.82):
    im=bpy.data.images.load(tex_path); w,h=im.size; px=im.pixels[:]
    me=bpy.data.meshes.new('item'); it=bpy.data.objects.new('item',me); scn.collection.objects.link(it)
    bm=bmesh.new(); col=bm.loops.layers.color.new('Col')
    T=0.8; gx=w/2.0-0.5; gz=h/2.0-0.5
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
    _bevel(nt2, b2, radius=0.04)
    me.materials.append(m)
    for p in me.polygons: p.use_smooth=False
    bpy.context.view_layer.update()
    hand = rarm.matrix_world @ Vector((0.0,-2.2,-6.6))   # rarm = Unterarm, Hand am Ende
    cam = scn.camera.matrix_world.translation
    zb = Vector((0.0,-0.78,0.63)).normalized()
    hand = hand + Vector((-0.2,-1.1,0.2))   # Griff mittig auf der Handlinie (aussen), leicht vorne
    camdir = (cam-hand)
    if camdir.length<1e-4: camdir=Vector((0,-1,0))
    camdir.normalize()
    nb = camdir - camdir.dot(zb)*zb
    if nb.length<1e-4: nb=Vector((0,-1,0))
    nb.normalize()
    yb=-nb; xb=yb.cross(zb).normalized(); yb=zb.cross(xb).normalized()
    R=Matrix(((xb.x,yb.x,zb.x),(xb.y,yb.y,zb.y),(xb.z,yb.z,zb.z)))
    it.matrix_world = Matrix.Translation(hand) @ R.to_4x4() @ Matrix.Rotation(math.radians(60),4,'Z') @ Matrix.Scale(groesse,4)
    return it

# ---------------------------------------------------------------- Posen
def _rad3(a):
    if isinstance(a,(int,float)): return (math.radians(a),0,0)
    e=[math.radians(x) for x in a]+[0,0,0]
    return (e[0],e[1],e[2])

# Posen mit GELENKEN: rarm/larm/rleg/lleg = Ober (Schulter/Hüfte), *_l = Unter (Ellbogen/Knie).
POSE_PRESETS = {
    'idle':   {'rarm':-6,'rarm_l':-6,'larm':6,'larm_l':-6},
    'stehen': {'rarm':-5,'rarm_l':-9,'larm':5,'larm_l':-9,'rleg':2,'rleg_l':3,'lleg':-2,'lleg_l':3},
    'bereit': {'rarm':[-78,0,0],'rarm_l':[-55,0,0],'larm':[-30,0,0],'larm_l':[-45,0,0],'rleg':16,'rleg_l':14,'lleg':-16,'lleg_l':16,'neigung':6},
    'walk':   {'rarm':-32,'rarm_l':-18,'larm':32,'larm_l':-18,'rleg':30,'rleg_l':12,'lleg':-28,'lleg_l':24},
    'gehen':  {'rarm':-32,'rarm_l':-18,'larm':32,'larm_l':-18,'rleg':30,'rleg_l':12,'lleg':-28,'lleg_l':24},
    'rennen': {'rarm':-58,'rarm_l':-80,'larm':58,'larm_l':-80,'rleg':50,'rleg_l':28,'lleg':-42,'lleg_l':72,'neigung':18},
    'springen':{'rarm':[-140,0,0],'rarm_l':[-28,0,0],'larm':[-140,0,0],'larm_l':[-28,0,0],'rleg':-45,'rleg_l':78,'lleg':-45,'lleg_l':78,'neigung':-5},
    'jubeln': {'rarm':-165,'rarm_l':-16,'larm':-165,'larm_l':-16,'rleg':4,'lleg':-4},
    'jubel':  {'rarm':-165,'rarm_l':-16,'larm':-165,'larm_l':-16,'rleg':4,'lleg':-4},
    'winken': {'rarm':[-150,22,0],'rarm_l':[-42,0,0],'larm':6,'larm_l':-9,'rleg':0,'lleg':0},
    'zeigen': {'rarm':[-92,0,0],'rarm_l':[-8,0,0],'larm':8,'larm_l':-10,'rleg':2,'lleg':-2},
    'cool':   {'rarm':[-16,-24,0],'rarm_l':[-38,0,0],'larm':[-16,24,0],'larm_l':[-38,0,0],'rleg':6,'lleg':-6},
    'lehnen': {'rarm':-7,'rarm_l':-9,'larm':7,'larm_l':-9,'rleg':3,'lleg':-3},
    'schockiert':{'rarm':[-150,0,16],'rarm_l':[-72,0,0],'larm':[-150,0,-16],'larm_l':[-72,0,0],'rleg':-8,'rleg_l':12,'lleg':12,'lleg_l':12,'neigung':-12,'kopf':[-8,0,0]},
    'aengstlich':{'rarm':[-135,0,8],'rarm_l':[-78,0,0],'larm':[-135,0,-8],'larm_l':[-78,0,0],'rleg':-12,'rleg_l':22,'lleg':16,'lleg_l':10,'neigung':-15},
    'angst':  {'rarm':[-135,0,8],'rarm_l':[-78,0,0],'larm':[-135,0,-8],'larm_l':[-78,0,0],'rleg':-12,'rleg_l':22,'lleg':16,'lleg_l':10,'neigung':-15},
    'wuetend':{'rarm':[-30,0,0],'rarm_l':[-48,0,0],'larm':[-30,0,0],'larm_l':[-48,0,0],'rleg':16,'rleg_l':12,'lleg':-14,'lleg_l':14,'neigung':13,'kopf':[6,0,0]},
    'nachdenklich':{'rarm':[-120,0,16],'rarm_l':[-98,0,0],'larm':8,'larm_l':-10,'rleg':2,'lleg':-2,'kopf':[8,0,0]},
    'sitzen': {'rarm':[-12,0,0],'rarm_l':[-82,0,0],'larm':[-12,0,0],'larm_l':[-82,0,0],'rleg':[-92,0,0],'rleg_l':[92,0,0],'lleg':[-92,0,0],'lleg_l':[92,0,0],'zoff':-6},
    'liegen': {'rarm':-18,'larm':18,'rleg':4,'lleg':-4,'neigung':90},
    'kaempfen_schwert':{'rarm':[-92,0,0],'rarm_l':[-72,0,0],'larm':[-32,0,0],'larm_l':[-42,0,0],'rleg':18,'rleg_l':14,'lleg':-18,'lleg_l':16,'neigung':8},
    'attack': {'rarm':[-165,0,0],'rarm_l':[-22,0,0],'larm':[20,0,0],'larm_l':[-30,0,0],'rleg':18,'lleg':-15,'neigung':6},
    'angreifer':{'rarm':[-112,0,0],'rarm_l':[-48,0,0],'larm':[-40,0,0],'larm_l':[-42,0,0],'rleg':38,'rleg_l':42,'lleg':-30,'lleg_l':18,'neigung':14},
    'abbauen_spitzhacke':{'rarm':[-55,0,0],'rarm_l':[-42,0,0],'larm':[-20,0,0],'larm_l':[-30,0,0],'rleg':12,'rleg_l':10,'lleg':-8,'lleg_l':10,'neigung':12,'kopf':[14,0,0]},
    'schleichen':{'rarm':[-16,0,0],'rarm_l':[-22,0,0],'larm':[16,0,0],'larm_l':[-22,0,0],'rleg':[36,0,0],'rleg_l':[46,0,0],'lleg':[30,0,0],'lleg_l':[46,0,0],'neigung':22,'zoff':-3,'kopf':[10,0,0]},
    'fallen': {'rarm':[-120,0,15],'rarm_l':[-42,0,0],'larm':[-120,0,-15],'larm_l':[-42,0,0],'rleg':[-25,0,0],'rleg_l':[42,0,0],'lleg':[20,0,0],'lleg_l':[30,0,0],'neigung':28,'kopf':[-8,0,0]},
    'triumphierend':{'rarm':[-175,0,-10],'rarm_l':[-30,0,0],'larm':[10,0,0],'larm_l':[-16,0,0],'rleg':6,'lleg':-8,'neigung':-5,'kopf':[-6,0,0]},
    'verzweifelt':{'rarm':[-135,0,14],'rarm_l':[-88,0,0],'larm':[-135,0,-14],'larm_l':[-88,0,0],'rleg':4,'lleg':-4,'neigung':10,'kopf':[12,0,0]},
    'lachend':{'rarm':[-42,0,12],'rarm_l':[-72,0,0],'larm':[-42,0,-12],'larm_l':[-72,0,0],'rleg':4,'lleg':-4,'neigung':-8,'kopf':[-20,0,0]},
}

# Knochen-Namen (Spec-Format) -> Blockfigur-Teile. lower_* (Ellbogen/Knie) werden
# beim Block-Look zum jeweiligen upper_* addiert, spine/head kippen Rumpf/Kopf.
BONE_MAP = {'upper_arm.R':'rarm','upper_arm.L':'larm','upper_leg.R':'rleg','upper_leg.L':'lleg',
            'lower_arm.R':'rarm_l','lower_arm.L':'larm_l','lower_leg.R':'rleg_l','lower_leg.L':'lleg_l'}
POSENDIR = arg('posendir')

def lade_pose(name):
    """Pose aus posen/<name>.json (Knochen-Format) laden -> {limb: euler, 'neigung':..,'kopf':..,'gesicht':..}."""
    if not POSENDIR: return None
    p=os.path.join(POSENDIR, name+'.json')
    if not os.path.exists(p): return None
    try:
        with open(p,'r',encoding='utf-8') as fh: d=json.load(fh)
    except Exception as e:
        print('WARN Pose laden:', e); return None
    out={}; kn=d.get('knochen',{})
    for bone,val in kn.items():
        if bone in BONE_MAP:
            limb=BONE_MAP[bone]
            if limb in out and isinstance(out[limb],list) and isinstance(val,list):
                out[limb]=[a+b for a,b in zip(out[limb]+[0,0,0], val+[0,0,0])][:3]
            else:
                out[limb]=val
        elif bone=='spine': out['neigung']=val[0] if isinstance(val,list) else val
        elif bone=='head':  out['kopf']=val
    if d.get('root_offset'): out['root_offset']=d['root_offset']
    if d.get('gesicht'):     out['gesicht']=d['gesicht']
    return out

# --- Gesichtsausdruck als Overlay auf die Kopf-Vorderseite (Augenringe, Weinen, Wut ...) ---
def add_face(head, expr, skin_path=None):
    if not expr or str(expr).lower() in ('normal','keine'): return None
    W=32; px=[0.0]*(W*W*4)
    # Gesichts-Grundfarbe aus dem Skin holen (Ecken der Vorderseite = immer glatte Haut)
    base=(0.95,0.95,0.96)
    try:
        im=bpy.data.images.load(skin_path); sw,sh=im.size; sp=im.pixels[:]
        ecken=[(8,8),(15,8),(8,15),(15,15),(9,9),(14,9)]; acc=[0.0,0.0,0.0]; nn=0
        for (sx,sy) in ecken:
            r=(sh-1-sy); i=(r*sw+sx)*4
            if 0<=i<len(sp)-3 and sp[i+3]>0.5:
                acc[0]+=sp[i]; acc[1]+=sp[i+1]; acc[2]+=sp[i+2]; nn+=1
        if nn: base=(acc[0]/nn,acc[1]/nn,acc[2]/nn)
    except Exception as ex: print('WARN Gesichtsfarbe:', ex)
    for k in range(W*W):  # ganze Gesichtsflaeche mit Hautfarbe fuellen (deckt Original ab)
        j=k*4; px[j]=base[0]; px[j+1]=base[1]; px[j+2]=base[2]; px[j+3]=1.0
    def rect(x0,y0,x1,y1,col):  # scharfe Pixel-Blocke, y0=oben (Minecraft-Look)
        for yy in range(max(0,int(y0)),min(W,int(y1))):
            for xx in range(max(0,int(x0)),min(W,int(x1))):
                i=((W-1-yy)*W+xx)*4; px[i]=col[0]; px[i+1]=col[1]; px[i+2]=col[2]; px[i+3]=1.0
    def pline(x0,y0,x1,y1,th,col):  # dicke, saubere Linie (fuer Brauen/Mund)
        n=int(max(abs(x1-x0),abs(y1-y0)))+1; r=th/2.0
        for i in range(n+1):
            t=i/n; cx=x0+(x1-x0)*t; cy=y0+(y1-y0)*t
            rect(cx-r, cy-r, cx+r+1, cy+r+1, col)
    schwarz=(0.04,0.04,0.05); weiss=(0.97,0.97,0.98); blau=(0.22,0.55,1.0)
    lila=(0.34,0.12,0.42); rot=(0.58,0.14,0.15); drot=(0.28,0.07,0.07)
    # Augen weit aussen: linkes Zentrum ~x8, rechtes ~x24 (32er Gesicht), Augenhoehe y~16
    e=str(expr).lower()
    if e in ('schock','schockiert','ueberrascht','wow'):
        pline(6,9,12,8,1.6,schwarz); pline(26,9,20,8,1.6,schwarz)        # hochgezogene Brauen
        rect(5,11,14,21,weiss); rect(18,11,27,21,weiss)                  # grosse Augen
        rect(7,14,12,20,schwarz); rect(20,14,25,20,schwarz)             # Pupillen
        rect(8,14,10,16,(1,1,1,1)); rect(21,14,23,16,(1,1,1,1))         # Glanzpunkte
        rect(12,24,20,31,schwarz); rect(14,26,18,30,(0.42,0.10,0.12))   # offener Mund
    elif e in ('augenringe','muede','tot','deadeyes'):
        rect(6,15,14,18,schwarz); rect(18,15,26,18,schwarz)             # muede Halbaugen
        rect(6,18,14,21,lila); rect(18,18,26,21,lila)                   # Augenringe
        pline(6,14,14,14,1.2,schwarz); pline(18,14,26,14,1.2,schwarz)   # schwere Lider
        rect(12,26,20,27,drot)                                          # flacher Mund
    elif e in ('weinen','traurig','sad'):
        rect(7,14,13,19,schwarz); rect(19,14,25,19,schwarz)            # Augen
        rect(8,14,10,16,weiss); rect(20,14,22,16,weiss)                # Glanz
        rect(8,19,11,31,blau); rect(21,19,24,31,blau)                  # Traenen
        rect(8,19,10,21,(0.6,0.85,1.0)); rect(21,19,23,21,(0.6,0.85,1.0))  # Traenen-Glanz
        pline(11,29,16,27,2.4,drot); pline(16,27,21,29,2.4,drot)       # trauriger Mund
    elif e in ('wuetend','boese','angry'):
        pline(6,12,15,17,3.0,schwarz); pline(26,12,17,17,3.0,schwarz)  # dicke gefurchte Brauen
        rect(9,17,15,20,schwarz); rect(17,17,23,20,schwarz)            # schmale zornige Augen
        rect(11,25,21,29,schwarz)                                      # geknirschter Mund
        rect(12,25,20,26,weiss)                                        # angedeutete Zaehne (schmal)
        rect(14,26,15,28,(0.35,0.35,0.38)); rect(17,26,18,28,(0.35,0.35,0.38))
    elif e in ('cool','sonnenbrille'):
        rect(5,12,14,19,(0.03,0.03,0.06)); rect(18,12,27,19,(0.03,0.03,0.06))  # zwei Glaeser
        rect(14,14,18,16,(0.03,0.03,0.06))                             # Buegel-Steg
        rect(6,13,9,15,(0.45,0.55,0.70)); rect(19,13,22,15,(0.38,0.48,0.62))   # Reflexe
        pline(11,27,18,29,2.2,drot)                                    # Smirk
    elif e in ('lachen','lachend','froh','happy'):
        pline(6,17,10,13,2.2,schwarz); pline(10,13,14,17,2.2,schwarz)  # ^ Auge links
        pline(18,17,22,13,2.2,schwarz); pline(22,13,26,17,2.2,schwarz) # ^ Auge rechts
        rect(10,23,22,31,schwarz); rect(12,27,20,31,(0.85,0.35,0.40))  # offener Lach-Mund + Zunge
    elif e in ('entschlossen','ernst'):
        pline(6,13,14,14,2.6,schwarz); pline(26,13,18,14,2.6,schwarz)  # schwere gerade Brauen
        rect(8,16,14,19,schwarz); rect(18,16,24,19,schwarz)           # fokussierte Augen
        rect(11,26,21,28,schwarz)                                      # fester Mund
    else:
        return None
    img=bpy.data.images.new('face',W,W,alpha=True); img.pixels=px
    m=bpy.data.materials.new('facemat'); m.use_nodes=True; m.blend_method='HASHED'
    nt=m.node_tree; nt.nodes.clear()
    t=nt.nodes.new('ShaderNodeTexImage'); t.image=img; t.interpolation='Closest'
    b=nt.nodes.new('ShaderNodeBsdfPrincipled'); b.inputs['Roughness'].default_value=0.85
    o=nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    nt.links.new(t.outputs['Alpha'], b.inputs['Alpha'])
    nt.links.new(b.outputs['BSDF'], o.inputs['Surface'])
    bpy.ops.mesh.primitive_plane_add(size=8); pl=bpy.context.active_object
    pl.rotation_euler=(math.radians(90),0,0)  # 8x8 Flaeche, deckt die Gesichtsseite
    pl.data.materials.append(m)
    pl.parent=head; pl.matrix_parent_inverse=Matrix.Identity(4)
    pl.location=(0.0,-4.06,4.0)
    return pl

# Subtile Emotions-Tints auf dem ECHTEN Gesicht (keine Grimasse): wuetend -> Augen
# leicht geroetet, uebermuedet -> leichte Augenringe. Sehr dezent, low-alpha.
def add_emotion(head, emotion, skin_path=None):
    if not emotion: return None
    e=str(emotion).lower()
    if e in ('normal','keine','none'): return None
    W=64; px=[0.0]*(W*W*4)  # transparent -> Original-Gesicht bleibt sichtbar
    def put(x,y,col):
        x=int(round(x)); y=int(round(y))
        if 0<=x<W and 0<=y<W:
            i=((W-1-y)*W+x)*4; a=col[3]
            if a<=0: return
            ba=px[i+3]; na=a+ba*(1-a)
            if na>0:
                for c in range(3): px[i+c]=(col[c]*a+px[i+c]*ba*(1-a))/na
                px[i+3]=na
    def disc(cx,cy,rx,ry,col,feather=2.2):  # weicher, anti-aliased Fleck
        for y in range(int(cy-ry-2),int(cy+ry+3)):
            for x in range(int(cx-rx-2),int(cx+rx+3)):
                dx=(x-cx)/rx; dy=(y-cy)/ry; d=math.sqrt(dx*dx+dy*dy)
                a=col[3]*max(0.0,min(1.0,(1.0-d)*min(rx,ry)/feather))
                if a>0: put(x,y,(col[0],col[1],col[2],a))
    LX,RX,EY=15,49,33   # 2-Pixel-Augen (eine Reihe)
    if e in ('muede','augenringe','tot','tired','uebermuedet','erschoepft'):
        # weiche, GROSSE dunkle Schatten unter dem GANZEN Auge (breit + tiefer reichend)
        for cx in (LX,RX):
            disc(cx,EY+7,11,6,(0.20,0.20,0.25,0.52))
            disc(cx,EY+7,8,4,(0.12,0.12,0.17,0.5))
    elif e in ('krank','blass','uebel'):
        for cx in (LX,RX): disc(cx,EY+6,8,4,(0.22,0.30,0.22,0.45))
        disc(32,20,20,10,(0.55,0.78,0.55,0.10))
    else:
        return None
    img=bpy.data.images.new('emo',W,W,alpha=True); img.pixels=px
    m=bpy.data.materials.new('emomat'); m.use_nodes=True; m.blend_method='BLEND'
    nt=m.node_tree; nt.nodes.clear()
    t=nt.nodes.new('ShaderNodeTexImage'); t.image=img; t.interpolation='Linear'
    b=nt.nodes.new('ShaderNodeBsdfPrincipled'); b.inputs['Roughness'].default_value=0.85
    o=nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    nt.links.new(t.outputs['Alpha'], b.inputs['Alpha'])
    nt.links.new(b.outputs['BSDF'], o.inputs['Surface'])
    bpy.ops.mesh.primitive_plane_add(size=8); pl=bpy.context.active_object
    pl.rotation_euler=(math.radians(90),0,0)
    pl.data.materials.append(m)
    pl.parent=head; pl.matrix_parent_inverse=Matrix.Identity(4)
    pl.location=(0.0,-4.12,4.0)
    return pl

# Winziger, scharfer Mund als hochaufgeloestes Overlay (feiner als das 8x8-Skin-Raster
# -> "Minipixel"). Sitzt mittig unter den Augen.
def add_mund(head, art):
    if not art: return None
    a=str(art).lower()
    if a in ('keiner','none','weg','kein'): return None
    W=64; px=[0.0]*(W*W*4)
    def rect(x0,y0,x1,y1,col):  # y0=oben, scharfe Mini-Pixel
        for yy in range(max(0,y0),min(W,y1)):
            for xx in range(max(0,x0),min(W,x1)):
                i=((W-1-yy)*W+xx)*4; px[i]=col[0]; px[i+1]=col[1]; px[i+2]=col[2]; px[i+3]=1.0
    M=(0.42,0.36,0.38)
    if a in ('striche','zwei','strich','neutral','laecheln','smile','freundlich'):
        # zwei kleine gerade Striche nebeneinander (kein Panzer, nicht nach oben)
        rect(27,48,31,50,M); rect(33,48,37,50,M)
    elif a in ('o','ueberrascht','open','schock'):
        rect(30,46,35,52,M); rect(31,48,34,51,(0.15,0.06,0.08))
    else:
        return None
    img=bpy.data.images.new('mund',W,W,alpha=True); img.pixels=px
    m=bpy.data.materials.new('mundmat'); m.use_nodes=True; m.blend_method='CLIP'
    nt=m.node_tree; nt.nodes.clear()
    t=nt.nodes.new('ShaderNodeTexImage'); t.image=img; t.interpolation='Closest'
    b=nt.nodes.new('ShaderNodeBsdfPrincipled'); b.inputs['Roughness'].default_value=0.85
    o=nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    nt.links.new(t.outputs['Alpha'], b.inputs['Alpha'])
    nt.links.new(b.outputs['BSDF'], o.inputs['Surface'])
    bpy.ops.mesh.primitive_plane_add(size=8); pl=bpy.context.active_object
    pl.rotation_euler=(math.radians(90),0,0)
    pl.data.materials.append(m)
    pl.parent=head; pl.matrix_parent_inverse=Matrix.Identity(4)
    pl.location=(0.0,-4.14,4.0)
    return pl

def make_part2(name,w,d,h,ztop,uvb,uvo,loc,mat,inflate=0.35):
    """Koerperteil MIT zweiter Ebene (Jacke/Aermel/Hose/Haare) - moderne 64x64-Skins.
    Die Overlay-Box ist leicht aufgeblasen und haengt am Basis-Teil (folgt der Pose)."""
    base=make_part(name,w,d,h,ztop,uvb,loc,mat)
    ov=make_part(name+'_o', w+2*inflate, d+2*inflate, h+2*inflate, ztop+inflate, uvo, (0,0,0), mat)
    ov.parent=base; ov.matrix_parent_inverse=Matrix.Identity(4); ov.location=(0,0,0)
    return base

def make_limb(name,w,d,h,ox,oy,ovx,ovy,loc,mat,inflate=0.35):
    """Gliedmaße mit GELENK: Ober- + Unterteil (Ellbogen/Knie), je mit zweiter Ebene.
    Pivot oben = Schulter/Hüfte; Unterteil hängt am Ellbogen/Knie und dreht relativ dazu."""
    hh=h/2.0
    up =make_part(name+'_u', w,d,hh, 0, region_slice(ox,oy,w,d,h,'oben'), loc, mat)
    upo=make_part(name+'_uo', w+2*inflate,d+2*inflate,hh+2*inflate, inflate, region_slice(ovx,ovy,w,d,h,'oben'),(0,0,0),mat)
    upo.parent=up; upo.matrix_parent_inverse=Matrix.Identity(4); upo.location=(0,0,0)
    lo =make_part(name+'_l', w,d,hh, 0, region_slice(ox,oy,w,d,h,'unten'),(0,0,0),mat)
    lo.parent=up; lo.matrix_parent_inverse=Matrix.Identity(4); lo.location=(0,0,-hh)
    loo=make_part(name+'_lo', w+2*inflate,d+2*inflate,hh+2*inflate, inflate, region_slice(ovx,ovy,w,d,h,'unten'),(0,0,0),mat)
    loo.parent=lo; loo.matrix_parent_inverse=Matrix.Identity(4); loo.location=(0,0,0)
    return {'u':up,'l':lo}

def build_char(f):
    skin = _pfad(f.get('skin'))
    mat = hautmaterial(skin)
    head=make_part2('head',8,8,8,8,region(0,0,8,8,8),  region(32,0,8,8,8),  (0,0,24),mat,inflate=0.5)
    body=make_part2('body',8,4,12,12,region(16,16,8,4,12),region(16,32,8,4,12),(0,0,12),mat)
    rarm=make_limb('rarm',4,4,12,40,16,40,32,(-6,0,24),mat)
    larm=make_limb('larm',4,4,12,32,48,48,48,(6,0,24),mat)
    rleg=make_limb('rleg',4,4,12,0,16,0,32,(-2,0,12),mat)
    lleg=make_limb('lleg',4,4,12,16,48,0,48,(2,0,12),mat)
    limbs={'rarm':rarm,'larm':larm,'rleg':rleg,'lleg':lleg}
    # Reihenfolge: JSON-Pose (Datei) -> Preset -> explizite Gelenkwinkel (volle Freiheit)
    posename=f.get('pose','bereit')
    ang = dict(POSE_PRESETS.get(posename, POSE_PRESETS['bereit']))
    kopf_ang=ang.get('kopf'); pose_neigung=ang.get('neigung'); pose_zoff=ang.get('zoff'); gesicht=ang.get('gesicht')
    GELENKE=('rarm','larm','rleg','lleg','rarm_l','larm_l','rleg_l','lleg_l')
    pj=lade_pose(posename)
    if pj:
        for k in GELENKE:
            if k in pj: ang[k]=pj[k]
        if pj.get('kopf') is not None: kopf_ang=pj.get('kopf')
        if pj.get('neigung') is not None: pose_neigung=pj.get('neigung')
        if pj.get('gesicht'): gesicht=pj.get('gesicht')
        if pj.get('root_offset'): pose_zoff=pj['root_offset'][2] if len(pj['root_offset'])>2 else pose_zoff
    for k in GELENKE:
        if k in f: ang[k]=f[k]
    for k,seg in limbs.items():
        seg['u'].rotation_euler=_rad3(ang.get(k,0))         # Ober (Schulter/Hüfte)
        seg['l'].rotation_euler=_rad3(ang.get(k+'_l',0))    # Unter (Ellbogen/Knie)
    if kopf_ang is not None:
        head.rotation_euler=_rad3(kopf_ang)
    # Gesichtsausdruck NUR wenn ausdruecklich gewuenscht - Standard: echtes Skin-Gesicht
    # bleibt (Wunsch Philip: keine gezeichneten Grimassen). Emotion ueber Pose/Licht/Effekte.
    if SPEC.get('gesichter_zeichnen'):
        try: add_face(head, f.get('gesicht', gesicht), skin)
        except Exception as e: print('WARN Gesicht:', e)
    # Augen-Posen / Emotions-Overlay (weich, entsaettigt - wie BastiGHG-Referenz):
    # nur wenn die Figur ausdruecklich 'emotion' oder 'augen' setzt, sonst echtes Gesicht.
    try: add_emotion(head, f.get('emotion') or f.get('augen'), skin)
    except Exception as e: print('WARN Emotion:', e)
    try: add_mund(head, f.get('mund'))
    except Exception as e: print('WARN Mund:', e)
    # Wurzel: Position + Blickrichtung + optionale Ganzkoerper-Neigung
    root=bpy.data.objects.new('root',None); scn.collection.objects.link(root)
    for ob in [head,body,rarm['u'],larm['u'],rleg['u'],lleg['u']]:
        ob.parent=root; ob.matrix_parent_inverse=Matrix.Identity(4)
    pos=f.get('pos',[0,0]); drehung=f.get('drehung',0)
    neigung=f.get('neigung', pose_neigung if pose_neigung is not None else 0)
    zoff=f.get('zoff', pose_zoff if pose_zoff is not None else 0)
    gr=float(f.get('groesse',1.0))
    seit=f.get('seitneigung',0)
    root.location=(pos[0], pos[1] if len(pos)>1 else 0, float(zoff))
    root.rotation_euler=(math.radians(neigung),math.radians(seit),math.radians(drehung))
    root.scale=(gr,gr,gr)
    bpy.context.view_layer.update()
    item=f.get('item','none')
    if item and item!='none':
        p=_pfad(item if item.endswith('.png') else item+'.png')
        if os.path.exists(p):
            add_item_3d(p, rarm['l'], float(f.get('item_groesse',0.82))*gr)

# ---------------------------------------------------------------- Props
def make_logo(pr):
    text=pr.get('text','LOGO'); gr=float(pr.get('groesse',6))
    cur=bpy.data.curves.new('logo','FONT'); cur.body=text; cur.size=gr
    cur.extrude=float(pr.get('tiefe',0.6)); cur.align_x='CENTER'; cur.align_y='BOTTOM'
    ob=bpy.data.objects.new('logo',cur); scn.collection.objects.link(ob)
    ob.data.materials.append(farbmaterial(pr.get('farbe',[0.95,0.78,0.05]), rough=0.4,
                                          emiss=float(pr.get('leuchten',0))))
    pos=pr.get('pos',[0,3,6]); dr=pr.get('drehung',[90,0,0])
    ob.rotation_euler=(math.radians(dr[0]),math.radians(dr[1]),math.radians(dr[2]))
    ob.location=(pos[0], pos[1] if len(pos)>1 else 3, pos[2] if len(pos)>2 else 6)
    # optionale Rueckplatte hinter dem Text
    if pr.get('platte'):
        bpy.ops.mesh.primitive_cube_add(size=1)
        pl=bpy.context.active_object
        pw=pr.get('platte'); pl.scale=(pw[0] if isinstance(pw,list) else len(text)*gr*0.42, 1.0, gr*0.75)
        pl.location=(pos[0], (pos[1] if len(pos)>1 else 3)+1.2, (pos[2] if len(pos)>2 else 6)+gr*0.55)
        pl.data.materials.append(farbmaterial(pr.get('platten_farbe',[0.09,0.10,0.12]),rough=0.6))
    return ob

def make_logobild(pr):
    """Echtes Logo-Bild (z. B. Server-Logo aus dem Netz) auf einer stehenden Flaeche."""
    p=_pfad(pr.get('bild') or pr.get('textur'))
    if not p or not os.path.exists(p):
        print('WARN Logobild fehlt:', p); return None
    img=bpy.data.images.load(p); img.alpha_mode='STRAIGHT'
    w,h=img.size; asp=(w/float(h)) if h else 1.0
    gr=float(pr.get('groesse',14))
    bpy.ops.mesh.primitive_plane_add(size=1); pl=bpy.context.active_object
    pl.scale=(gr*asp/2.0, 1.0, gr/2.0)
    dr=pr.get('drehung',[90,0,0]); pl.rotation_euler=(math.radians(dr[0]),math.radians(dr[1]),math.radians(dr[2]))
    pos=pr.get('pos',[0,6,gr/2]); pl.location=(pos[0], pos[1] if len(pos)>1 else 6, pos[2] if len(pos)>2 else gr/2)
    m=bpy.data.materials.new('logobild'); m.use_nodes=True; m.blend_method='HASHED'
    nt=m.node_tree; nt.nodes.clear()
    t=nt.nodes.new('ShaderNodeTexImage'); t.image=img; t.interpolation='Linear'
    b=nt.nodes.new('ShaderNodeBsdfPrincipled'); b.inputs['Roughness'].default_value=0.5
    e=float(pr.get('leuchten',0.0))
    if e>0:
        try:
            nt.links.new(t.outputs['Color'], b.inputs['Emission Color']); b.inputs['Emission Strength'].default_value=e
        except Exception: pass
    o=nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    nt.links.new(t.outputs['Alpha'], b.inputs['Alpha'])
    nt.links.new(b.outputs['BSDF'], o.inputs['Surface'])
    pl.data.materials.append(m)
    return pl

def _textobj(text, gr, tiefe, mat, font=None):
    cur=bpy.data.curves.new('t','FONT'); cur.body=text; cur.size=gr
    cur.extrude=tiefe; cur.align_x='CENTER'; cur.align_y='CENTER'
    if font:
        try: cur.font=bpy.data.fonts.load(font)
        except Exception as e: print('WARN font:', e)
    ob=bpy.data.objects.new('t',cur); scn.collection.objects.link(ob)
    ob.data.materials.append(mat); return ob

def make_headline(pr):
    """Grosse Schlagzeile (z. B. 'TAG 1') als kamerafestes Overlay mit dickem Rand."""
    text=pr.get('text','TAG 1'); gr=float(pr.get('groesse',6))
    font=_pfad(pr.get('font')) if pr.get('font') else None
    farbe=pr.get('farbe',[1,1,1]); rand=pr.get('rand',[0.02,0.02,0.03])
    # Bildschirmposition: -1..1 (x rechts, y oben)
    sx=float(pr.get('x',-0.42)); sy=float(pr.get('y',0.72)); d=float(pr.get('abstand',30))
    fill=_textobj(text, gr, 0.12, farbmaterial(farbe,rough=0.35,emiss=float(pr.get('leuchten',0.6))), font)
    out =_textobj(text, gr, 0.10, farbmaterial(rand,rough=0.5), font)
    out.scale=(1.16,1.16,1.0)
    cammat=scn.camera.matrix_world
    # ungefaehre Bildbreite/-hoehe auf Abstand d (aus Sensor/Brennweite)
    sensor=scn.camera.data.sensor_width; halfw=d*(sensor*0.5)/scn.camera.data.lens; halfh=halfw*(RESY/float(RESX))
    def platz(ob,zoff):
        loc=cammat @ Vector((sx*halfw, sy*halfh, -d - zoff))
        ob.location=loc; ob.rotation_euler=cammat.to_euler()
    platz(out,0.0); platz(fill,0.3)
    return fill

def make_block(pr):
    gr=float(pr.get('groesse',8)); pos=pr.get('pos',[0,0,4])
    bpy.ops.mesh.primitive_cube_add(size=1)
    b=bpy.context.active_object
    sk=pr.get('skalierung')
    if sk: b.scale=(sk[0],sk[1],sk[2])
    else:  b.scale=(gr,gr,gr)
    b.location=(pos[0], pos[1] if len(pos)>1 else 0, pos[2] if len(pos)>2 else b.scale.z/2)
    dr=pr.get('drehung',[0,0,0]); b.rotation_euler=(math.radians(dr[0]),math.radians(dr[1]),math.radians(dr[2]))
    tex=pr.get('textur')
    if tex:
        p=_pfad(tex if tex.endswith('.png') else tex+'.png')
        if os.path.exists(p):
            img=bpy.data.images.load(p); m=bpy.data.materials.new('blk'); m.use_nodes=True
            nt=m.node_tree; t=nt.nodes.new('ShaderNodeTexImage'); t.image=img; t.interpolation='Closest'
            bb=nt.nodes.get('Principled BSDF'); nt.links.new(t.outputs['Color'],bb.inputs['Base Color'])
            b.data.materials.append(m)
        else:
            b.data.materials.append(farbmaterial(pr.get('farbe',[0.6,0.6,0.6])))
    else:
        b.data.materials.append(farbmaterial(pr.get('farbe',[0.6,0.6,0.6]), emiss=float(pr.get('leuchten',0))))
    return b

def make_burst(pr):
    """Radialer Strahlen-Burst (Energie-Explosion) hinter der Figur - z_olisw-Stil."""
    import random as _r; _r.seed(int(pr.get('seed',3)))
    C=Vector(pr.get('pos',[0,55,22])); col=pr.get('farbe',[0.14,0.42,1.0])
    n=int(pr.get('strahlen',30)); L=float(pr.get('laenge',95)); inner=float(pr.get('innen',5)); w=float(pr.get('breite',1.4))
    me=bpy.data.meshes.new('burst'); ob=bpy.data.objects.new('burst',me); scn.collection.objects.link(ob)
    bm=bmesh.new()
    for i in range(n):
        a=(i/n)*2*math.pi + _r.uniform(-0.04,0.04)
        d=Vector((math.cos(a),0,math.sin(a))); perp=Vector((-math.sin(a),0,math.cos(a)))
        Li=L*_r.uniform(0.45,1.0); ww=w*_r.uniform(0.6,1.3)
        b1=C+d*inner+perp*ww; b2=C+d*inner-perp*ww
        t1=C+d*Li+perp*(ww*0.15); t2=C+d*Li-perp*(ww*0.15)
        vs=[bm.verts.new(b1),bm.verts.new(t1),bm.verts.new(t2),bm.verts.new(b2)]
        bm.faces.new(vs)
    bm.to_mesh(me); bm.free()
    m=bpy.data.materials.new('burstmat'); m.use_nodes=True
    bb=m.node_tree.nodes.get('Principled BSDF')
    try:
        bb.inputs['Emission Color'].default_value=(col[0],col[1],col[2],1)
        bb.inputs['Emission Strength'].default_value=float(pr.get('leuchten',7))
    except Exception: pass
    me.materials.append(m)
    return ob

def make_partikel(pr):
    """Leuchtende Partikel/Funken (Bokeh) - Tiefe + Glow im z_olisw-Stil."""
    import random as _r; _r.seed(int(pr.get('seed',9)))
    C=pr.get('pos',[0,35,22]); col=pr.get('farbe',[0.35,0.6,1.0]); n=int(pr.get('anzahl',46))
    sp=pr.get('streuung',[80,30,55]); gr=float(pr.get('groesse',0.9))
    m=bpy.data.materials.new('partmat'); m.use_nodes=True
    bb=m.node_tree.nodes.get('Principled BSDF')
    try:
        bb.inputs['Emission Color'].default_value=(col[0],col[1],col[2],1)
        bb.inputs['Emission Strength'].default_value=float(pr.get('leuchten',9))
    except Exception: pass
    for i in range(n):
        s=gr*_r.uniform(0.35,1.3)
        bpy.ops.mesh.primitive_cube_add(size=s)
        c=bpy.context.active_object
        c.location=(C[0]+_r.uniform(-0.5,0.5)*sp[0], C[1]+_r.uniform(-0.5,0.5)*sp[1], C[2]+_r.uniform(-0.5,0.5)*sp[2])
        c.rotation_euler=(_r.uniform(0,3),_r.uniform(0,3),_r.uniform(0,3))
        c.data.materials.append(m)

# ---------------------------------------------------------------- Szene/Licht
# Biom -> (grund, himmel_unten, himmel_oben, sonne_staerke, sonne_farbe)
SZENEN={
 'gras':          ((0.20,0.50,0.12),(0.60,0.80,1.00),(0.16,0.40,0.85),3.6,(1.00,0.96,0.86)),
 'wiese':         ((0.22,0.54,0.14),(0.62,0.82,1.00),(0.18,0.44,0.88),3.6,(1.00,0.97,0.88)),
 'wald':          ((0.11,0.32,0.10),(0.42,0.60,0.55),(0.10,0.26,0.28),2.6,(1.00,0.97,0.80)),
 'wueste':        ((0.86,0.74,0.44),(0.92,0.84,0.66),(0.45,0.62,0.92),4.4,(1.00,0.93,0.76)),
 'schnee':        ((0.86,0.90,0.96),(0.86,0.92,1.00),(0.55,0.70,0.95),3.4,(0.90,0.95,1.08)),
 'hoehle':        ((0.10,0.09,0.08),(0.07,0.05,0.05),(0.010,0.010,0.02),1.4,(1.00,0.66,0.36)),
 'dorf':          ((0.24,0.46,0.16),(0.70,0.76,0.90),(0.30,0.46,0.78),3.3,(1.00,0.92,0.76)),
 'nether':        ((0.30,0.06,0.05),(0.52,0.10,0.06),(0.14,0.02,0.02),2.6,(1.00,0.42,0.28)),
 'ende':          ((0.10,0.09,0.14),(0.12,0.07,0.18),(0.02,0.01,0.05),1.8,(0.82,0.76,1.00)),
 'end':           ((0.10,0.09,0.14),(0.12,0.07,0.18),(0.02,0.01,0.05),1.8,(0.82,0.76,1.00)),
 'unterwasser':   ((0.07,0.22,0.28),(0.10,0.38,0.48),(0.02,0.12,0.24),1.9,(0.45,0.80,1.00)),
 'basis_innen':   ((0.26,0.25,0.26),(0.12,0.12,0.13),(0.03,0.03,0.04),2.2,(1.00,0.84,0.58)),
 'basis':         ((0.26,0.25,0.26),(0.12,0.12,0.13),(0.03,0.03,0.04),2.2,(1.00,0.84,0.58)),
 'nacht':         ((0.08,0.10,0.16),(0.06,0.08,0.18),(0.01,0.01,0.05),1.2,(0.58,0.70,1.00)),
 'sonnenuntergang':((0.30,0.26,0.18),(1.00,0.52,0.26),(0.20,0.14,0.34),3.2,(1.00,0.58,0.32)),
 'studio':        ((0.015,0.015,0.02),(0.02,0.02,0.03),(0.004,0.004,0.008),3.0,(1.00,1.00,1.00)),
 'transparent':   ((0.20,0.50,0.12),(0.0,0.0,0.0),(0.0,0.0,0.0),3.6,(1.00,0.96,0.86)),
}
grund,himmel_u,himmel_o,sonne,sonnefarbe = SZENEN.get(SZENE, SZENEN['gras'])

# BELIEBIGES HINTERGRUND-BILD (jede Minecraft-Szene: Biome/Nether/End/Trial-Chamber ...).
# Grosse, selbstleuchtende Flaeche weit hinten, fuellt das 16:9-Bild; DoF macht sie weich.
HB=_pfad(SPEC.get('hintergrund_bild')) if SPEC.get('hintergrund_bild') else None
if HB and os.path.exists(HB):
    img=bpy.data.images.load(HB)
    bpy.ops.mesh.primitive_plane_add(size=1); bg=bpy.context.active_object
    bg.rotation_euler=(math.radians(90),0,0)
    bg.scale=(float(SPEC.get('hg_breite',380)),1,float(SPEC.get('hg_hoehe',214)))
    bg.location=(0, float(SPEC.get('hg_abstand',150)), 55)
    m=bpy.data.materials.new('hg'); m.use_nodes=True; nt=m.node_tree; nt.nodes.clear()
    t=nt.nodes.new('ShaderNodeTexImage'); t.image=img; t.interpolation='Linear'
    e=nt.nodes.new('ShaderNodeEmission'); e.inputs['Strength'].default_value=float(SPEC.get('hg_hell',1.0))
    nt.links.new(t.outputs['Color'], e.inputs['Color'])
    o=nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(e.outputs['Emission'], o.inputs['Surface'])
    bg.data.materials.append(m)
    if SPEC.get('boden'):  # optionaler Boden fuer Standschatten
        bpy.ops.mesh.primitive_plane_add(size=800, location=(0,0,0))
        bpy.context.active_object.data.materials.append(farbmaterial(grund, rough=1.0))

# Boden + Backdrop (nicht im Studio-/Transparent-Modus / nicht wenn Hintergrund-Bild da)
elif SZENE not in ('transparent','studio'):
    bpy.ops.mesh.primitive_plane_add(size=800, location=(0,0,0))
    g=bpy.context.active_object; g.data.materials.append(farbmaterial(grund, rough=1.0))
    # Stehender Hintergrund mit senkrechtem Farbverlauf (Studio-Backdrop, gibt Tiefe)
    bpy.ops.mesh.primitive_plane_add(size=600); bd=bpy.context.active_object
    bd.rotation_euler=(math.radians(90),0,0); bd.location=(0,120,120)
    bm=bpy.data.materials.new('backdrop'); bm.use_nodes=True; bnt=bm.node_tree; bnt.nodes.clear()
    tc=bnt.nodes.new('ShaderNodeTexCoord'); sx=bnt.nodes.new('ShaderNodeSeparateXYZ')
    bnt.links.new(tc.outputs['Generated'], sx.inputs['Vector'])
    rmp=bnt.nodes.new('ShaderNodeValToRGB')
    rmp.color_ramp.elements[0].position=0.30; rmp.color_ramp.elements[0].color=(himmel_u[0],himmel_u[1],himmel_u[2],1)
    rmp.color_ramp.elements[1].position=0.85; rmp.color_ramp.elements[1].color=(himmel_o[0],himmel_o[1],himmel_o[2],1)
    bnt.links.new(sx.outputs['Z'], rmp.inputs['Fac'])
    em=bnt.nodes.new('ShaderNodeEmission'); bnt.links.new(rmp.outputs['Color'], em.inputs['Color'])
    bo=bnt.nodes.new('ShaderNodeOutputMaterial'); bnt.links.new(em.outputs['Emission'], bo.inputs['Surface'])
    bd.data.materials.append(bm)

# Welt: sanftes Umgebungslicht in Himmelsfarbe (Ambient/AO-Fuellung)
world=bpy.data.worlds.new('w'); scn.world=world; world.use_nodes=True
bg=world.node_tree.nodes.get('Background')
amb=[max(himmel_u[i],himmel_o[i])*0.55 for i in range(3)]
bg.inputs['Color'].default_value=(amb[0],amb[1],amb[2],1); bg.inputs['Strength'].default_value=0.5

# 3-Punkt-Licht: Key (warm, vorne-oben-links), Fill (kuehl, schwach), Rim (hell, von hinten)
def sonne_licht(name, energy, farbe, rot, angle=3.0):
    L=bpy.data.lights.new(name,'SUN'); L.energy=energy; L.color=farbe; L.angle=math.radians(angle)
    o=bpy.data.objects.new(name,L); scn.collection.objects.link(o)
    o.rotation_euler=(math.radians(rot[0]),math.radians(rot[1]),math.radians(rot[2])); return o
# Der HELD wird immer kraeftig angestrahlt; weiche Schattierung (grosser Sonnen-Winkel
# = weiche Schatten, wie bei den z_olisw-Renders). Dunkelheit kommt aus dem Hintergrund.
soft=float(SPEC.get('licht_weich', 6.0))
keyE=max(float(sonne), 3.6); fillE=max(float(sonne)*0.36, 1.1)
sonne_licht('key',  keyE,  sonnefarbe,       (52,10,40), angle=soft)
sonne_licht('fill', fillE, (0.75,0.83,1.00), (66,0,-72), angle=soft)
# Farbiges Rim-Light umrandet die Figur (Erkennungsmerkmal). rimfarbe setzt den Ton.
rimcol=SPEC.get('rimfarbe')
if rimcol:
    rE=float(SPEC.get('rim_staerke', 8.0))
    sonne_licht('rimL', rE,     rimcol, (126,0,58), angle=1.5)
    sonne_licht('rimR', rE,     rimcol, (126,0,-58), angle=1.5)
    sonne_licht('rimT', rE*0.7, rimcol, (150,0,0),  angle=1.5)
else:
    sonne_licht('rim',  max(float(sonne)*1.25,3.2), (1.00,0.98,0.94), (118,0,8), angle=2.0)

# ---------------------------------------------------------------- Kamera
kam=SPEC.get('kamera') or {}
n=max(1,len(FIGUREN))
cam=bpy.data.cameras.new('cam'); co=bpy.data.objects.new('cam',cam); scn.collection.objects.link(co); scn.camera=co
cam.lens=float(kam.get('lens',38))
dist=float(kam.get('dist', 92 + (n-1)*20))
co.location=(float(kam.get('x',22)), -dist, float(kam.get('z',20)))
ziel=Vector(kam.get('ziel',[0,0,16]))
co.rotation_euler=(ziel-co.location).to_track_quat('-Z','Y').to_euler()
# Tiefenschaerfe (Hintergrund weich -> cinematisch). Fokus auf das Ziel/Hauptmotiv.
if SPEC.get('dof') or kam.get('dof'):
    try:
        cam.dof.use_dof=True
        cam.dof.focus_distance=(co.location-ziel).length
        cam.dof.aperture_fstop=float(kam.get('blende', 2.2))
    except Exception as e: print('WARN DoF:', e)

# ---------------------------------------------------------------- Aufbau
for f in FIGUREN:
    try: build_char(f)
    except Exception as e: print('WARN Figur:', e)
for pr in PROPS:
    try:
        t=pr.get('typ') or pr.get('type')
        if t in ('kopfzeile','headline','mctext','titel'): make_headline(pr)
        elif t in ('burst','strahlen','explosion'): make_burst(pr)
        elif t in ('partikel','funken','sterne'): make_partikel(pr)
        elif t in ('logobild','serverlogo','bild'): make_logobild(pr)
        elif t in ('logo','text'): make_logo(pr)
        elif t in ('block','quader','tnt'):
            if t=='tnt' and not pr.get('textur') and not pr.get('farbe'): pr['farbe']=[0.75,0.12,0.08]
            make_block(pr)
    except Exception as e: print('WARN Prop:', e)

# ---------------------------------------------------------------- Atmosphaere (Volumen-Nebel)
# Duenner Welt-Nebel -> Tiefe + Godrays vom Licht (episch). Nur auf Wunsch (kostet Rechenzeit).
if SPEC.get('nebel'):
    try:
        wnt=scn.world.node_tree
        vol=wnt.nodes.new('ShaderNodeVolumeScatter')
        vol.inputs['Density'].default_value=float(SPEC.get('nebel_dichte', 0.0016))
        vol.inputs['Anisotropy'].default_value=0.35
        wout=wnt.nodes.get('World Output')
        if wout: wnt.links.new(vol.outputs['Volume'], wout.inputs['Volume'])
    except Exception as e: print('WARN Nebel:', e)

# ---------------------------------------------------------------- Render + Compositor (Bloom/Grade/Vignette)
scn.render.engine='CYCLES'; scn.cycles.device='CPU'; scn.cycles.samples=SAMP; scn.cycles.use_denoising=True
scn.render.resolution_x=RESX; scn.render.resolution_y=RESY
scn.render.film_transparent = (SZENE=='transparent')
try:
    scn.view_settings.view_transform='Standard'; scn.view_settings.look='None'
    scn.view_settings.exposure=float(SPEC.get('belichtung',0.0))
except Exception: pass

# Compositor: Glow (Bloom), leichter Kontrast/Saettigung, Vignette -> weg vom flachen Look.
if SPEC.get('stil', True) and SZENE!='transparent':
    try:
        scn.use_nodes=True; ct=scn.node_tree; ct.nodes.clear()
        rl=ct.nodes.new('CompositorNodeRLayers')
        glare=ct.nodes.new('CompositorNodeGlare'); glare.glare_type='FOG_GLOW'
        glare.quality='HIGH'; glare.threshold=float(SPEC.get('bloom_schwelle',0.85)); glare.mix=float(SPEC.get('bloom',-0.55)); glare.size=7
        bc=ct.nodes.new('CompositorNodeBrightContrast'); bc.inputs['Contrast'].default_value=float(SPEC.get('kontrast',8.0))
        hsv=ct.nodes.new('CompositorNodeHueSat'); hsv.inputs['Saturation'].default_value=float(SPEC.get('saettigung',1.18))
        # Vignette: grosse, weiche Ellipse -> Ecken abdunkeln
        ell=ct.nodes.new('CompositorNodeEllipseMask'); ell.width=0.82; ell.height=0.86
        blur=ct.nodes.new('CompositorNodeBlur'); blur.filter_type='FAST_GAUSS'; blur.size_x=180; blur.size_y=180; blur.use_relative=False
        vign=ct.nodes.new('CompositorNodeMixRGB'); vign.blend_type='MULTIPLY'; vign.inputs['Fac'].default_value=0.35
        comp=ct.nodes.new('CompositorNodeComposite')
        ct.links.new(rl.outputs['Image'], glare.inputs['Image'])
        ct.links.new(glare.outputs['Image'], bc.inputs['Image'])
        ct.links.new(bc.outputs['Image'], hsv.inputs['Image'])
        ct.links.new(ell.outputs['Mask'], blur.inputs['Image'])
        ct.links.new(hsv.outputs['Image'], vign.inputs[1])
        ct.links.new(blur.outputs['Image'], vign.inputs[2])
        ct.links.new(vign.outputs['Image'], comp.inputs['Image'])
    except Exception as e:
        print('WARN Compositor:', e); scn.use_nodes=False

scn.render.filepath=OUT
bpy.ops.render.render(write_still=True)
print('MC RENDER OK ->', OUT)
