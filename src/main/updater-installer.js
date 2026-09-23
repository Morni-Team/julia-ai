'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const version = require('./version');
const { Updater, hoechsterTag } = require('./updater');

// Updates für die installierte Fassung (Julia-AI-Setup.exe). Statt Git-Tags
// gelten hier die Releases im öffentlichen Repo julia-ai. Julia lädt den
// Installer erst nach deinem Ja und nach der laufenden Aufgabe, prüft ihn gegen
// die SHA-512-Summe aus latest.yml und startet ihn nur, wenn sie stimmt.

const REPO = 'Morni-Team/julia-ai';
const API = `https://api.github.com/repos/${REPO}/releases?per_page=30`;
const DOWNLOAD = `https://github.com/${REPO}/releases/download/`;
const MAX_GROESSE = 400 * 1024 * 1024;
const KOPF = { 'User-Agent': 'Julia-AI' };

// latest.yml von electron-builder – nur die Felder oben auf erster Ebene.
function latestYmlLesen(text) {
  const feld = (name) => {
    const m = new RegExp(`^${name}:[ \\t]*['"]?([^'"\\r\\n]+?)['"]?[ \\t]*$`, 'm').exec(String(text || ''));
    return m ? m[1] : null;
  };
  const r = { version: feld('version'), datei: feld('path'), sha512: feld('sha512') };
  if (!r.version || !r.datei || !r.sha512) throw new Error('latest.yml ist unvollständig.');
  if (!/^[A-Za-z0-9+/]{86}==$/.test(r.sha512)) throw new Error('latest.yml enthält keine gültige SHA-512-Summe.');
  if (!/^[\w.-]+\.exe$/.test(r.datei)) throw new Error('latest.yml nennt keinen gültigen Installer.');
  return r;
}

// Entscheidung nach einem Update (rein, testbar, Issue #100): Läuft die neue
// Version? Sonst einmal automatisch wiederholen, danach aufgeben (mit Rollback-
// Angebot). status = im Datenordner gemerkter Zustand; laeuft = aktuelle Version.
function updateSchritt(status, laeuft, { maxVersuche = 1 } = {}) {
  if (!status || status.phase !== 'installer') return { aktion: 'nichts' };
  if (version.vergleichen(laeuft, status.ziel) === 0) return { aktion: 'fertig', version: status.ziel };
  const versuch = status.versuch || 0;
  if (versuch < maxVersuche) return { aktion: 'wiederholen', versuch: versuch + 1, ziel: status.ziel, von: status.von };
  return { aktion: 'aufgeben', version: laeuft, ziel: status.ziel, rollbackVon: status.von };
}

function passendeReleases(liste, kanal) {
  return (Array.isArray(liste) ? liste : [])
    .filter((r) => r && !r.draft && typeof r.tag_name === 'string' && /^v\d/.test(r.tag_name) && version.parse(r.tag_name))
    .filter((r) => kanal === 'test' || (!r.prerelease && !version.parse(r.tag_name).vorab));
}

// Nur Dateien, die wirklich an diesem Release im offiziellen Repo hängen.
function anhang(release, name) {
  const a = (release.assets || []).find((x) => x && x.name === name);
  if (!a) throw new Error(`Im Release ${release.tag_name} fehlt ${name}.`);
  const url = String(a.browser_download_url || '');
  if (!url.startsWith(`${DOWNLOAD}${encodeURIComponent(release.tag_name)}/`)) throw new Error('Unerwartete Download-Adresse – ich lade nichts.');
  return { url, groesse: Number(a.size) || 0 };
}

class InstallerUpdater extends Updater {
  constructor(opts) {
    super(opts);
    this.holen = opts.holen || ((url, o) => globalThis.fetch(url, o));
    this.starten = opts.starten || spawn;
    this.releases = null;
  }

  async _json(url) {
    const r = await this.holen(url, { headers: { ...KOPF, Accept: 'application/vnd.github+json' } });
    if (!r.ok) throw new Error(`GitHub antwortet mit ${r.status}.`);
    return r.json();
  }

  async pruefen() {
    const aktuell = this.aktuelleVersion();
    try {
      const kanal = this.config.get('update.kanal');
      const releases = passendeReleases(await this._json(API), kanal);
      this.releases = releases;
      const hoechster = hoechsterTag(releases.map((r) => r.tag_name), kanal);
      if (!hoechster || version.vergleichen(hoechster, aktuell) <= 0) return { aktuell, neu: null, zeilen: [] };
      const zeilen = releases
        .filter((r) => version.vergleichen(r.tag_name, aktuell) > 0 && version.vergleichen(r.tag_name, hoechster) <= 0)
        .sort((a, b) => version.vergleichen(b.tag_name, a.tag_name))
        .map((r) => {
          const text = (String(r.body || '').split(/\r?\n/).map((z) => z.trim()).find(Boolean) || '').replace(/^[-*]\s+/, '');
          return text ? `${r.tag_name.slice(1)} – ${text}` : r.tag_name.slice(1);
        });
      return { aktuell, neu: hoechster, zeilen };
    } catch (e) {
      return { aktuell, neu: null, zeilen: [], fehler: e.message };
    }
  }

  async _einspielen(tag) {
    // Unmittelbar vorher frisch nachsehen: Kam seit der Prüfung eine neuere
    // Version dazu, wird gleich die eingespielt – nie ein alter Stand.
    const kanal = this.config.get('update.kanal');
    let releases = this.releases;
    try {
      releases = passendeReleases(await this._json(API), kanal);
      this.releases = releases;
    } catch (e) {
      if (!releases) throw e;
    }
    const neuester = hoechsterTag(releases.map((r) => r.tag_name), kanal);
    if (neuester && version.vergleichen(neuester, tag) > 0) tag = neuester;
    const release = releases.find((r) => r.tag_name === tag);
    if (!release) throw new Error(`Release ${tag} nicht gefunden.`);

    const yml = anhang(release, 'latest.yml');
    const antwortYml = await this.holen(yml.url, { headers: KOPF });
    if (!antwortYml.ok) throw new Error(`latest.yml nicht ladbar (${antwortYml.status}).`);
    const info = latestYmlLesen(await antwortYml.text());
    if (version.vergleichen(info.version, tag) !== 0) throw new Error('latest.yml passt nicht zu diesem Release.');

    const exe = anhang(release, info.datei);
    if (!(exe.groesse > 0 && exe.groesse <= MAX_GROESSE)) throw new Error('Unerwartete Größe des Installers.');
    const antwort = await this.holen(exe.url, { headers: KOPF });
    if (!antwort.ok) throw new Error(`Download fehlgeschlagen (${antwort.status}).`);
    const daten = Buffer.from(await antwort.arrayBuffer());
    if (daten.length !== exe.groesse) throw new Error('Der Download ist unvollständig.');
    const summe = crypto.createHash('sha512').update(daten).digest('base64');
    if (summe !== info.sha512) throw new Error('Die Prüfsumme des Installers stimmt nicht – ich spiele ihn nicht ein.');

    const ordner = path.join(this.datenOrdner, 'updates');
    fs.mkdirSync(ordner, { recursive: true });
    for (const alt of fs.readdirSync(ordner)) {
      try { fs.unlinkSync(path.join(ordner, alt)); } catch { /* egal */ }
    }
    const datei = path.join(ordner, `Julia-AI-Setup-${tag.slice(1)}.exe`);
    fs.writeFileSync(datei, daten);
    // Status merken (für Verifizieren/Wiederholen nach dem Start) inkl. Pfad des
    // neuen Installers und des vorhandenen Backups (Rollback „für den Fall der Fälle").
    fs.writeFileSync(this.statusDatei, JSON.stringify({
      phase: 'installer', ziel: tag, von: this.aktuelleVersion(), versuch: 0, installer: datei, backup: this._backupInstaller(),
    }, null, 2), 'utf8');

    // Still installieren und danach Julia wieder starten.
    this._installerStarten(datei);
  }

  _installerStarten(datei) {
    const kind = this.starten(datei, ['/S', '--updated', '--force-run'], { detached: true, stdio: 'ignore', windowsHide: true });
    kind.unref();
    this.beenden();
  }

  // Ordner/Datei des letzten bekannt-guten Installers (Rollback-Punkt).
  _backupOrdner() { return path.join(this.datenOrdner, 'update-backup'); }
  _backupInstaller() {
    try {
      const d = fs.readdirSync(this._backupOrdner()).filter((n) => /^Julia-AI-Setup-.*\.exe$/.test(n));
      return d.length ? path.join(this._backupOrdner(), d[0]) : null;
    } catch { return null; }
  }

  // Den gerade erfolgreich eingespielten Installer als neuen Rollback-Punkt sichern.
  _backupSetzen(installer, version) {
    if (!installer) return;
    try {
      const ziel = this._backupOrdner();
      fs.mkdirSync(ziel, { recursive: true });
      for (const alt of fs.readdirSync(ziel)) { try { fs.unlinkSync(path.join(ziel, alt)); } catch { /* egal */ } }
      if (fs.existsSync(installer)) fs.copyFileSync(installer, path.join(ziel, `Julia-AI-Setup-${String(version).replace(/^v/, '')}.exe`));
    } catch { /* Backup ist optional – nie den Start blockieren */ }
  }

  // Rollback auf die letzte funktionierende Version (Nutzer-Aktion). Startet den
  // gesicherten Installer erneut, falls vorhanden.
  zurueckRollen() {
    const b = this._backupInstaller();
    if (!b || !fs.existsSync(b)) return { fehler: 'Kein Backup einer vorherigen Version vorhanden.' };
    this._installerStarten(b);
    return { ok: true };
  }

  // Nach dem Installer: Läuft jetzt die neue Version? Prüfen und – wenn nicht –
  // den Installer EINMAL automatisch wiederholen (Issue #100). Klappt es auch dann
  // nicht, klare Meldung mit Rollback-Angebot (Backup der vorherigen Version).
  startStatus() {
    let s;
    try { s = JSON.parse(fs.readFileSync(this.statusDatei, 'utf8')); } catch { return null; }
    if (s.phase !== 'installer') return super.startStatus();
    const jetzt = this.aktuelleVersion();
    const schritt = updateSchritt(s, jetzt);
    if (schritt.aktion === 'fertig') {
      // Neue Version läuft → ihren Installer als Rollback-Punkt sichern, Status weg.
      this._backupSetzen(s.installer, s.ziel);
      try { fs.unlinkSync(this.statusDatei); } catch { /* egal */ }
      return { phase: 'fertig', ok: true, version: s.ziel };
    }
    if (schritt.aktion === 'wiederholen' && s.installer && fs.existsSync(s.installer)) {
      // Update kam nicht an – einmal automatisch wiederholen.
      try { fs.writeFileSync(this.statusDatei, JSON.stringify({ ...s, versuch: schritt.versuch }, null, 2), 'utf8'); } catch { /* egal */ }
      this._installerStarten(s.installer);
      return { phase: 'wiederholung', ok: false, version: jetzt, ziel: s.ziel };
    }
    // Aufgeben: nicht in einer Schleife weiter probieren, klar melden.
    try { fs.unlinkSync(this.statusDatei); } catch { /* egal */ }
    return { phase: 'fertig', ok: false, version: jetzt, fehler: `Es läuft weiter ${jetzt}.`, rollbackMoeglich: !!this._backupInstaller() };
  }
}

module.exports = { InstallerUpdater, latestYmlLesen, passendeReleases, anhang, updateSchritt, REPO };
