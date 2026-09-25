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

# ---------------------------------------------------------------- Materialien
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

def farbmaterial(rgb, rough=0.7, emiss=0.0):
    m=bpy.data.materials.new('farb'); m.use_nodes=True
    b=m.node_tree.nodes.get('Principled BSDF')
    c=(rgb[0],rgb[1],rgb[2],1.0)
    b.inputs['Base Color'].default_value=c; b.inputs['Roughness'].default_value=rough
    if emiss>0:
        try:
            b.inputs['Emission Color'].default_value=c; b.inputs['Emission Strength'].default_value=emiss
        except Exception: pass
    return m

# ---------------------------------------------------------------- Body-Boxen
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
    it.matrix_world = Matrix.Translation(hand) @ R.to_4x4() @ Matrix.Rotation(math.radians(60),4,'Z') @ Matrix.Scale(groesse,4)
    return it

# ---------------------------------------------------------------- Posen
def _rad3(a):
    if isinstance(a,(int,float)): return (math.radians(a),0,0)
    e=[math.radians(x) for x in a]+[0,0,0]
    return (e[0],e[1],e[2])

POSE_PRESETS = {
    'idle':   {'rarm':-6,'larm':6,'rleg':0,'lleg':0},
    'walk':   {'rarm':-35,'larm':35,'rleg':30,'lleg':-30},
    'attack': {'rarm':-150,'larm':20,'rleg':15,'lleg':-15},
    'angreifer': {'rarm':[-128,0,0],'larm':[-38,0,0],'rleg':28,'lleg':-22,'neigung':12},
    'bereit': {'rarm':-62,'larm':-22,'rleg':18,'lleg':-16},
    'angst':  {'rarm':-120,'larm':-120,'rleg':-10,'lleg':20},
    'lehnen': {'rarm':-7,'larm':7,'rleg':3,'lleg':-3},
    'jubel':  {'rarm':-170,'larm':-170,'rleg':3,'lleg':-3},
    'winken': {'rarm':[-165,25,0],'larm':6,'rleg':0,'lleg':0},
    'zeigen': {'rarm':[-95,0,0],'larm':6,'rleg':2,'lleg':-2},
    'cool':   {'rarm':[-18,-30,0],'larm':[-18,30,0],'rleg':6,'lleg':-6},
    # --- Grundausstattung (deutsche Namen) ---
    'stehen':          {'rarm':-5,'larm':5,'rleg':0,'lleg':0},
    'gehen':           {'rarm':-30,'larm':30,'rleg':28,'lleg':-28},
    'rennen':          {'rarm':-58,'larm':58,'rleg':46,'lleg':-46,'neigung':16},
    'springen':        {'rarm':[-125,0,0],'larm':[-125,0,0],'rleg':-38,'lleg':-38,'neigung':-4},
    'jubeln':          {'rarm':-168,'larm':-168,'rleg':4,'lleg':-4},
    'schockiert':      {'rarm':[-142,0,24],'larm':[-142,0,-24],'rleg':-8,'lleg':14,'neigung':-12,'kopf':[-8,0,0]},
    'aengstlich':      {'rarm':[-118,0,10],'larm':[-118,0,-10],'rleg':-10,'lleg':16,'neigung':-15},
    'wuetend':         {'rarm':[-22,0,0],'larm':[-22,0,0],'rleg':16,'lleg':-14,'neigung':13,'kopf':[6,0,0]},
    'nachdenklich':    {'rarm':[-142,0,22],'larm':8,'rleg':2,'lleg':-2,'kopf':[8,0,0]},
    'sitzen':          {'rarm':[-14,0,0],'larm':[14,0,0],'rleg':[-88,0,0],'lleg':[-88,0,0],'zoff':-11},
    'liegen':          {'rarm':-18,'larm':18,'rleg':4,'lleg':-4,'neigung':90},
    'kaempfen_schwert':{'rarm':[-120,0,0],'larm':[-20,0,0],'rleg':18,'lleg':-16,'neigung':8},
    'abbauen_spitzhacke':{'rarm':[-46,0,0],'larm':10,'rleg':10,'lleg':-8,'neigung':10,'kopf':[14,0,0]},
    'schleichen':      {'rarm':[-14,0,0],'larm':[14,0,0],'rleg':[24,0,0],'lleg':[24,0,0],'neigung':22,'kopf':[10,0,0]},
    'fallen':          {'rarm':[-112,0,18],'larm':[-112,0,-18],'rleg':[-30,0,0],'lleg':[22,0,0],'neigung':30,'gesicht':'schock','kopf':[-8,0,0]},
    'triumphierend':   {'rarm':[-182,0,-14],'larm':[8,0,0],'rleg':6,'lleg':-8,'neigung':-5,'kopf':[-6,0,0],'gesicht':'lachen'},
    'verzweifelt':     {'rarm':[-142,0,20],'larm':[-72,0,-38],'rleg':4,'lleg':-4,'neigung':6,'kopf':[10,0,0],'gesicht':'weinen'},
    'lachend':         {'rarm':[-48,0,14],'larm':[10,0,0],'rleg':4,'lleg':-4,'neigung':-8,'kopf':[-22,0,0],'gesicht':'lachen'},
}

# Knochen-Namen (Spec-Format) -> Blockfigur-Teile. lower_* (Ellbogen/Knie) werden
# beim Block-Look zum jeweiligen upper_* addiert, spine/head kippen Rumpf/Kopf.
BONE_MAP = {'upper_arm.R':'rarm','upper_arm.L':'larm','upper_leg.R':'rleg','upper_leg.L':'lleg',
            'lower_arm.R':'rarm','lower_arm.L':'larm','lower_leg.R':'rleg','lower_leg.L':'lleg'}
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
    W=16; px=[0.0]*(W*W*4)
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
    schwarz=(0.05,0.05,0.06); weiss=(0.97,0.97,0.98); blau=(0.20,0.55,1.0)
    lila=(0.34,0.12,0.42); rot=(0.55,0.14,0.16); drot=(0.30,0.08,0.08)
    # Augen des Skins liegen weit aussen: links x2-5, rechts x11-14
    e=str(expr).lower()
    if e in ('schock','schockiert','ueberrascht','wow'):
        rect(2,5,6,10,weiss); rect(10,5,14,10,weiss)               # weisse Augen
        rect(3,7,5,9,schwarz); rect(11,7,13,9,schwarz)             # Pupillen
        rect(6,11,10,15,schwarz); rect(7,12,9,14,rot)              # O-Mund
    elif e in ('augenringe','muede','tot','deadeyes'):
        rect(2,6,5,8,schwarz); rect(11,6,14,8,schwarz)             # muede Halbaugen
        rect(2,8,5,10,lila); rect(11,8,14,10,lila)                 # Augenringe
        rect(6,12,10,13,drot)                                      # flacher Mund
    elif e in ('weinen','traurig','sad'):
        rect(2,6,5,9,schwarz); rect(11,6,14,9,schwarz)             # Augen
        rect(3,6,4,7,weiss); rect(12,6,13,7,weiss)                 # Glanz
        rect(3,9,5,15,blau); rect(11,9,13,15,blau)                 # Traenen
        rect(6,13,10,14,drot); rect(5,12,6,13,drot); rect(10,12,11,13,drot)  # trauriger Mund
    elif e in ('wuetend','boese','angry'):
        rect(2,4,3,5,schwarz); rect(3,5,4,6,schwarz); rect(4,6,6,7,schwarz)   # linke Braue (Treppe)
        rect(13,4,14,5,schwarz); rect(12,5,13,6,schwarz); rect(10,6,12,7,schwarz)  # rechte Braue
        rect(3,7,5,9,schwarz); rect(11,7,13,9,schwarz)             # zornige Augen
        rect(5,12,11,14,weiss); rect(5,12,11,13,schwarz)          # Zaehne + Oberlippe
        rect(7,13,8,14,(0.25,0.25,0.28)); rect(9,13,10,14,(0.25,0.25,0.28))  # Zahnluecken
    elif e in ('cool','sonnenbrille'):
        rect(2,6,14,9,(0.03,0.03,0.06))                            # Sonnenbrille durchgehend
        rect(3,6,5,7,(0.40,0.50,0.62))                             # Glanz
        rect(6,12,11,13,drot)                                      # Grinsen
    elif e in ('lachen','lachend','froh','happy'):
        rect(2,8,3,9,schwarz); rect(3,7,4,8,schwarz); rect(4,8,5,9,schwarz)  # ^ Auge links
        rect(11,8,12,9,schwarz); rect(12,7,13,8,schwarz); rect(13,8,14,9,schwarz)  # ^ Auge rechts
        rect(5,11,11,15,schwarz); rect(6,13,10,15,(0.85,0.35,0.40))  # offener Mund + Zunge
    elif e in ('entschlossen','ernst'):
        rect(2,5,6,6,schwarz); rect(10,5,14,6,schwarz)             # gerade Brauen
        rect(3,7,5,9,schwarz); rect(11,7,13,9,schwarz)             # Augen
        rect(6,12,10,13,schwarz)                                   # ernster Mund
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

def build_char(f):
    skin = _pfad(f.get('skin'))
    mat = hautmaterial(skin)
    head=make_part('head',8,8,8,8,region(0,0,8,8,8),(0,0,24),mat)
    hat =make_part('hat',9,9,9,9,region(32,0,8,8,8),(0,0,23.5),mat)
    body=make_part('body',8,4,12,12,region(16,16,8,4,12),(0,0,12),mat)
    rarm=make_part('rarm',4,4,12,0,region(40,16,4,4,12),(-6,0,24),mat)
    larm=make_part('larm',4,4,12,0,region(32,48,4,4,12),(6,0,24),mat)
    rleg=make_part('rleg',4,4,12,0,region(0,16,4,4,12),(-2,0,12),mat)
    lleg=make_part('lleg',4,4,12,0,region(16,48,4,4,12),(2,0,12),mat)
    limbs={'rarm':rarm,'larm':larm,'rleg':rleg,'lleg':lleg}
    # Reihenfolge: JSON-Pose (Datei) -> Preset -> explizite Gelenkwinkel (volle Freiheit)
    posename=f.get('pose','bereit')
    ang = dict(POSE_PRESETS.get(posename, POSE_PRESETS['bereit']))
    kopf_ang=ang.get('kopf'); pose_neigung=ang.get('neigung'); pose_zoff=ang.get('zoff'); gesicht=ang.get('gesicht')
    pj=lade_pose(posename)
    if pj:
        for k in ('rarm','larm','rleg','lleg'):
            if k in pj: ang[k]=pj[k]
        if pj.get('kopf') is not None: kopf_ang=pj.get('kopf')
        if pj.get('neigung') is not None: pose_neigung=pj.get('neigung')
        if pj.get('gesicht'): gesicht=pj.get('gesicht')
        if pj.get('root_offset'): pose_zoff=pj['root_offset'][2] if len(pj['root_offset'])>2 else pose_zoff
    for k in ('rarm','larm','rleg','lleg'):
        if k in f: ang[k]=f[k]
    for k,ob in limbs.items():
        ob.rotation_euler=_rad3(ang.get(k,0))
    if kopf_ang is not None:
        head.rotation_euler=_rad3(kopf_ang); hat.rotation_euler=_rad3(kopf_ang)
    # Gesichtsausdruck (Figur ueberschreibt Pose)
    try: add_face(head, f.get('gesicht', gesicht), skin)
    except Exception as e: print('WARN Gesicht:', e)
    # Wurzel: Position + Blickrichtung + optionale Ganzkoerper-Neigung
    root=bpy.data.objects.new('root',None); scn.collection.objects.link(root)
    for ob in [head,hat,body,rarm,larm,rleg,lleg]:
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
            add_item_3d(p, rarm, float(f.get('item_groesse',0.82))*gr)

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
 'transparent':   ((0.20,0.50,0.12),(0.0,0.0,0.0),(0.0,0.0,0.0),3.6,(1.00,0.96,0.86)),
}
grund,himmel_u,himmel_o,sonne,sonnefarbe = SZENEN.get(SZENE, SZENEN['gras'])

# Boden
if SZENE!='transparent':
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
sonne_licht('key',  sonne,        sonnefarbe,          (52,10,40))
sonne_licht('fill', sonne*0.28,   (0.72,0.82,1.00),    (66,0,-72))
sonne_licht('rim',  sonne*1.15,   (1.00,0.98,0.94),    (118,0,8), angle=2.0)

# ---------------------------------------------------------------- Kamera
kam=SPEC.get('kamera') or {}
n=max(1,len(FIGUREN))
cam=bpy.data.cameras.new('cam'); co=bpy.data.objects.new('cam',cam); scn.collection.objects.link(co); scn.camera=co
cam.lens=float(kam.get('lens',38))
dist=float(kam.get('dist', 92 + (n-1)*20))
co.location=(float(kam.get('x',22)), -dist, float(kam.get('z',20)))
ziel=Vector(kam.get('ziel',[0,0,16]))
co.rotation_euler=(ziel-co.location).to_track_quat('-Z','Y').to_euler()

# ---------------------------------------------------------------- Aufbau
for f in FIGUREN:
    try: build_char(f)
    except Exception as e: print('WARN Figur:', e)
for pr in PROPS:
    try:
        t=pr.get('typ') or pr.get('type')
        if t in ('kopfzeile','headline','mctext','titel'): make_headline(pr)
        elif t in ('logobild','serverlogo','bild'): make_logobild(pr)
        elif t in ('logo','text'): make_logo(pr)
        elif t in ('block','quader','tnt'):
            if t=='tnt' and not pr.get('textur') and not pr.get('farbe'): pr['farbe']=[0.75,0.12,0.08]
            make_block(pr)
    except Exception as e: print('WARN Prop:', e)

# ---------------------------------------------------------------- Render
scn.render.engine='CYCLES'; scn.cycles.device='CPU'; scn.cycles.samples=SAMP; scn.cycles.use_denoising=True
scn.render.resolution_x=RESX; scn.render.resolution_y=RESY
scn.render.film_transparent = (SZENE=='transparent')
try:
    scn.view_settings.view_transform='Standard'; scn.view_settings.look='None'
except Exception: pass
scn.render.filepath=OUT
bpy.ops.render.render(write_still=True)
print('MC RENDER OK ->', OUT)
