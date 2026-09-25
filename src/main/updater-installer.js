'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const version = require('./version');
const { Updater, hoechsterTag } = require('./updater');
const { mitWiederholung } = require('./wiederholen');

// Updates für die installierte Fassung (Julia-AI-Setup.exe). Statt Git-Tags
// gelten hier die Releases im öffentlichen Repo julia-ai. Julia lädt den
// Installer erst nach deinem Ja und nach der laufenden Aufgabe, prüft ihn gegen
// die SHA-512-Summe aus latest.yml und startet ihn nur, wenn sie stimmt.

const REPO = 'Morni-Team/julia-ai';
const API = `https://api.github.com/repos/${REPO}/releases?per_page=30`;
const DOWNLOAD = `https://github.com/${REPO}/releases/download/`;
// latest.yml über die Release-Download-URL – anders als die GitHub-API (60 Anfragen/
// Stunde/IP, sonst 403) ist dieser Datei-Download NICHT rate-limitiert (Issue #105).
const DOWNLOAD_LATEST = `https://github.com/${REPO}/releases/latest/download/`;
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
    // Update-Debugging (Issue #106): Ereignisse ins Start-Logbuch schreiben –
    // wann geprüft/geladen/installiert wurde und welche Version. Nie störend.
    this.protokoll = typeof opts.protokollieren === 'function' ? opts.protokollieren : () => {};
  }

  _log(text, daten) {
    try { this.protokoll('UPDATE', text, daten); } catch { /* Logging darf nie stören */ }
  }

  async _json(url) {
    const r = await this.holen(url, { headers: { ...KOPF, Accept: 'application/vnd.github+json' } });
    if (!r.ok) throw new Error(`GitHub antwortet mit ${r.status}.`);
    return r.json();
  }

  // Neueste STABILE Version über die Download-URL (kein API-Rate-Limit): liest
  // latest.yml direkt aus dem „latest"-Release. Gibt { version, datei, sha512 }.
  async _neuesteStabil() {
    const r = await this.holen(`${DOWNLOAD_LATEST}latest.yml`, { headers: KOPF });
    if (!r.ok) throw new Error(`GitHub antwortet mit ${r.status}.`);
    return latestYmlLesen(await r.text());
  }

  // Changelog-Zeilen aus den (API-)Releases zwischen aktuell und höchster.
  _zeilen(releases, aktuell, hoechster) {
    return releases
      .filter((r) => version.vergleichen(r.tag_name, aktuell) > 0 && version.vergleichen(r.tag_name, hoechster) <= 0)
      .sort((a, b) => version.vergleichen(b.tag_name, a.tag_name))
      .map((r) => {
        const text = (String(r.body || '').split(/\r?\n/).map((z) => z.trim()).find(Boolean) || '').replace(/^[-*]\s+/, '');
        return text ? `${r.tag_name.slice(1)} – ${text}` : r.tag_name.slice(1);
      });
  }

  async pruefen() {
    const aktuell = this.aktuelleVersion();
    const freundlich = (msg) => (/\b403\b/.test(String(msg)) ? 'GitHub bremst die Update-Prüfung gerade aus (zu viele Anfragen). Bitte später noch einmal versuchen.' : msg);
    try {
      const kanal = this.config.get('update.kanal');
      // Stabiler Kanal: robust über die Download-URL prüfen (umgeht das API-403).
      if (kanal !== 'test') {
        let info;
        try {
          info = await this._neuesteStabil();
        } catch (e) {
          // Download-URL nicht erreichbar → einmal über die API versuchen.
          const releases = passendeReleases(await this._json(API), kanal);
          this.releases = releases;
          const h = hoechsterTag(releases.map((r) => r.tag_name), kanal);
          if (!h || version.vergleichen(h, aktuell) <= 0) return { aktuell, neu: null, zeilen: [] };
          return { aktuell, neu: h, zeilen: this._zeilen(releases, aktuell, h) };
        }
        const neu = `v${info.version}`;
        if (version.vergleichen(neu, aktuell) <= 0) return { aktuell, neu: null, zeilen: [] };
        // Changelog ist nur schmückend – wenn die API bremst (403), ohne Zeilen weiter.
        let zeilen = [];
        try {
          const releases = passendeReleases(await this._json(API), kanal);
          this.releases = releases;
          zeilen = this._zeilen(releases, aktuell, neu);
        } catch { /* Changelog optional */ }
        this._log('Neue Version gefunden', { aktuell, neu });
        return { aktuell, neu, zeilen };
      }
      // Testkanal: Vorabversionen gibt es nur über die API.
      const releases = passendeReleases(await this._json(API), kanal);
      this.releases = releases;
      const hoechster = hoechsterTag(releases.map((r) => r.tag_name), kanal);
      if (!hoechster || version.vergleichen(hoechster, aktuell) <= 0) return { aktuell, neu: null, zeilen: [] };
      return { aktuell, neu: hoechster, zeilen: this._zeilen(releases, aktuell, hoechster) };
    } catch (e) {
      this._log('Prüfung fehlgeschlagen', { aktuell, fehler: freundlich(e.message) });
      return { aktuell, neu: null, zeilen: [], fehler: freundlich(e.message) };
    }
  }

  // Release + Assets über die GitHub-API auflösen (Test-Kanal / Fallback).
  async _aufloesenApi(tag) {
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
    return { tag, info, exeUrl: anhang(release, info.datei).url };
  }

  async _einspielen(tag) {
    const kanal = this.config.get('update.kanal');
    // Stabiler Kanal: alles über die Download-URL auflösen (kein API-403, Issue
    // #105). Streikt die Download-URL, einmal über die API. Test-Kanal: nur API.
    let info; let exeUrl;
    if (kanal !== 'test') {
      try {
        info = await this._neuesteStabil();
        tag = `v${info.version}`;
        exeUrl = `${DOWNLOAD}${encodeURIComponent(tag)}/${info.datei}`;
      } catch {
        ({ tag, info, exeUrl } = await this._aufloesenApi(tag));
      }
    } else {
      ({ tag, info, exeUrl } = await this._aufloesenApi(tag));
    }
    if (version.vergleichen(`v${info.version}`, tag) !== 0) throw new Error('latest.yml passt nicht zu diesem Release.');
    // Nur aus dem offiziellen Release-Download laden.
    if (!exeUrl.startsWith(`${DOWNLOAD}${encodeURIComponent(tag)}/`)) throw new Error('Unerwartete Download-Adresse – ich lade nichts.');

    // Download bei transienten Netzfehlern/abgebrochenen Übertragungen ein paar
    // Mal wiederholen (Issue #119). Größe + SHA-512 werden JEDES Mal geprüft – ein
    // unvollständiger Download fällt so durch und wird erneut geholt, statt kaputt
    // eingespielt zu werden.
    const daten = await mitWiederholung(async () => {
      const antwort = await this.holen(exeUrl, { headers: KOPF });
      if (!antwort.ok) throw new Error(`Download fehlgeschlagen (${antwort.status}).`);
      const buf = Buffer.from(await antwort.arrayBuffer());
      if (!(buf.length > 0 && buf.length <= MAX_GROESSE)) throw new Error('Unerwartete Größe des Installers.');
      const s = crypto.createHash('sha512').update(buf).digest('base64');
      if (s !== info.sha512) throw new Error('Die Prüfsumme des Installers stimmt nicht – ich spiele ihn nicht ein.');
      return buf;
    }, { versuche: 3, pauseMs: 2000, beiFehler: (e, v) => this._log('Download-Versuch fehlgeschlagen, neuer Versuch', { versuch: v, fehler: e.message }) });

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
    this._log('Installer geprüft (SHA-512 ok), wird gestartet', { ziel: tag, von: this.aktuelleVersion() });
    this._installerStarten(datei);
  }

  _installerStarten(datei) {
    // WAS IST WENN der Installer-Start scheitert (Datei gesperrt/fehlt, Elevation
    // nötig)? Bisher wurde blind `beenden()` gerufen – Julia beendete sich also
    // AUCH, wenn der Installer gar nicht anlief, und ließ den Nutzer mit halbem
    // Update und einem Log zurück, das bei „gestartet" endet (Issue #119). Jetzt:
    // Start-Fehler abfangen, klar loggen und Julia NICHT beenden.
    let kind;
    try {
      kind = this.starten(datei, ['/S', '--updated', '--force-run'], { detached: true, stdio: 'ignore', windowsHide: true });
    } catch (e) {
      this._log('Installer-Start sofort fehlgeschlagen – Julia bleibt offen', { datei, code: e && e.code, fehler: e && e.message });
      return false;
    }
    // Ein asynchroner Start-Fehler kommt als 'error'-Ereignis – auch das ins Log,
    // damit die Ursache sichtbar ist, statt dass das Log stumm bei „gestartet" endet.
    if (kind && typeof kind.on === 'function') {
      kind.on('error', (e) => this._log('Installer meldete einen Start-Fehler', { datei, code: e && e.code, fehler: e && e.message }));
    }
    if (kind && typeof kind.unref === 'function') kind.unref();
    this._log('Installer gestartet – Julia beendet sich für das Update', { datei });
    this.beenden();
    return true;
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
    return this._installerStarten(b) ? { ok: true } : { fehler: 'Der Installer ließ sich nicht starten.' };
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
    this._log('Nach dem Start geprüft', { aktion: schritt.aktion, jetzt, ziel: s.ziel });
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
