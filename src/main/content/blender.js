'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

// Blender-Manager fuers Thumbnail-Studio: laedt Blender EINMALIG bei Bedarf in den
// Datenordner (wie Whisper/Piper/ffmpeg), rendert damit die Minecraft-3D-Figur(en)
// per mitgeliefertem mc_render.py. Reine Logik (URLs/Pfade/Argumente) ist hier
// getrennt und per `node --test` abgesichert; das eigentliche Laden/Rendern ist IO.

// Blender 4.2 LTS portable (Windows). Groesse zur Absicherung gegen Teil-Downloads.
const BLENDER_URL = 'https://download.blender.org/release/Blender4.2/blender-4.2.3-windows-x64.zip';
const BLENDER_GROESSE = 383613057;
const EXE_REL = path.join('blender-4.2.3-windows-x64', 'blender.exe');
const MODELL_MIN = 200 * 1024 * 1024; // Plausibilitaets-Untergrenze

// Gueltiger Minecraft-Name (3–16, Buchstaben/Ziffern/_). Sonst leer.
function skinName(v) {
  const s = String(v == null ? '' : v).trim();
  return /^[A-Za-z0-9_]{1,16}$/.test(s) ? s : '';
}

// Rohe 64x64-Skin-Textur ueber den Namen (kein API-Schluessel noetig).
function skinUrl(name) {
  const n = skinName(name);
  return n ? `https://minotar.net/skin/${encodeURIComponent(n)}` : '';
}

// Blender-Argumente fuer einen headless-Render-Lauf.
function renderArgs({ skript, skins = [], poses = [], items = [], itemdir, out, scene = 'gras', anordnung = 'reihe', samples = 28 }) {
  const a = ['-b', '-P', skript, '--'];
  a.push(`skins=${skins.join(';')}`);
  if (poses.length) a.push(`poses=${poses.join(';')}`);
  if (items.length) a.push(`items=${items.join(';')}`);
  if (itemdir) a.push(`itemdir=${itemdir}`);
  a.push(`scene=${scene}`);
  a.push(`anordnung=${anordnung}`);
  a.push(`samples=${samples}`);
  a.push(`out=${out}`);
  return a;
}

function exePfad(datenOrdner) {
  return path.join(datenOrdner, 'blender', EXE_REL);
}

class Blender {
  // ordner: Datenordner; holen: fetch; starten: spawn; skriptQuelle: Ordner mit
  // mc_render.py + sword.png + pickaxe.png (im Paket, per fs lesbar auch aus asar).
  constructor({ ordner, skriptQuelle, holen = (u, o) => globalThis.fetch(u, o), starten = spawn }) {
    this.ordner = ordner;
    this.skriptQuelle = skriptQuelle || path.join(__dirname, 'blender');
    this.holen = holen;
    this.starten = starten;
  }

  exe() {
    const p = exePfad(this.ordner);
    try { return fs.existsSync(p) ? p : null; } catch { return null; }
  }

  istDa() { return !!this.exe(); }

  // Kopiert das Render-Skript + Item-Texturen an einen ECHTEN Pfad (Blender kann
  // nicht aus dem asar lesen). Gibt den Ordner zurueck.
  _laufOrdner() {
    const ziel = path.join(this.ordner, 'content', 'blender-run');
    fs.mkdirSync(ziel, { recursive: true });
    for (const datei of ['mc_render.py', 'sword.png', 'pickaxe.png']) {
      try { fs.copyFileSync(path.join(this.skriptQuelle, datei), path.join(ziel, datei)); } catch { /* evtl. schon da */ }
    }
    return ziel;
  }

  // Laedt Blender (portable) und entpackt es in den Datenordner. `fortschritt(p)` 0..1.
  async sicherstellen(fortschritt = () => {}) {
    if (this.istDa()) return this.exe();
    const ziel = path.join(this.ordner, 'blender');
    fs.mkdirSync(ziel, { recursive: true });
    const zip = path.join(ziel, '_blender.zip');
    // Download (mit Groessen-Pruefung gegen Teil-Downloads).
    const r = await this.holen(BLENDER_URL, { headers: { 'User-Agent': 'Julia-AI' } });
    if (!r || !r.ok) throw new Error(`Blender-Download fehlgeschlagen (${r && r.status}).`);
    const buf = Buffer.from(await r.arrayBuffer());
    if (!(buf.length > MODELL_MIN)) throw new Error('Blender-Download unvollstaendig.');
    fs.writeFileSync(zip, buf);
    fortschritt(0.9);
    // Entpacken mit Windows-bsdtar (haelt lange Pfade aus, kann ZIP).
    const tar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
    await new Promise((res, rej) => {
      const p = this.starten(tar, ['-xf', zip, '-C', ziel], { windowsHide: true });
      p.on('error', rej);
      p.on('close', (c) => (c === 0 ? res() : rej(new Error(`Entpacken fehlgeschlagen (Code ${c}).`))));
    });
    try { fs.unlinkSync(zip); } catch { /* egal */ }
    fortschritt(1);
    const exe = this.exe();
    if (!exe) throw new Error('Blender wurde entpackt, aber die EXE fehlt.');
    return exe;
  }

  // Holt eine rohe Skin-Textur ueber den Namen und legt sie als PNG ab. Gibt Pfad.
  async skinHolen(name) {
    const url = skinUrl(name);
    if (!url) throw new Error(`Ungueltiger Minecraft-Name: ${name}`);
    const r = await this.holen(url, { headers: { 'User-Agent': 'Julia-AI' } });
    if (!r || !r.ok) throw new Error(`Skin "${name}" nicht ladbar (${r && r.status}).`);
    const buf = Buffer.from(await r.arrayBuffer());
    if (!(buf.length > 100 && buf.length < 2 * 1024 * 1024)) throw new Error('Unerwartete Skin-Groesse.');
    const dir = path.join(this.ordner, 'content', 'skins');
    fs.mkdirSync(dir, { recursive: true });
    const datei = path.join(dir, `${skinName(name)}.png`);
    fs.writeFileSync(datei, buf);
    return datei;
  }

  // Rendert ein 3D-Thumbnail. opts: { namen:[..], poses:[..], items:[..], scene, samples }
  // Gibt { pfad } (PNG) oder wirft. fortschritt(p) fuer den Blender-Download.
  async render(opts = {}, fortschritt = () => {}) {
    const namen = (opts.namen || []).map(skinName).filter(Boolean);
    if (!namen.length) throw new Error('Kein gueltiger Minecraft-Name angegeben.');
    const exe = await this.sicherstellen(fortschritt);
    const laufOrdner = this._laufOrdner();
    const skript = path.join(laufOrdner, 'mc_render.py');
    const skins = [];
    for (const n of namen) { skins.push(await this.skinHolen(n)); } // eslint-disable-line no-await-in-loop
    const out = path.join(os.tmpdir(), `julia-3d-${Date.now()}.png`);
    const args = renderArgs({
      skript, skins,
      poses: opts.poses || ['bereit'],
      items: opts.items || ['sword'],
      itemdir: laufOrdner, out,
      scene: opts.scene || 'gras',
      anordnung: opts.anordnung || 'reihe',
      samples: Math.max(8, Math.min(96, Number(opts.samples) || 28)),
    });
    await new Promise((res, rej) => {
      let err = '';
      const p = this.starten(exe, args, { windowsHide: true });
      if (p.stderr) p.stderr.on('data', (d) => { err = (err + d).slice(-3000); });
      p.on('error', rej);
      p.on('close', (c) => ((c === 0 && fs.existsSync(out)) ? res() : rej(new Error(`Render fehlgeschlagen (Code ${c}). ${err.slice(-300)}`))));
    });
    return { pfad: out };
  }
}

module.exports = { Blender, skinName, skinUrl, renderArgs, exePfad, BLENDER_URL, BLENDER_GROESSE, EXE_REL };
