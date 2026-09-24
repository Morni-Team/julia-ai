'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { InstallerUpdater, latestYmlLesen, updateSchritt } = require('../src/main/updater-installer');

const DL = 'https://github.com/Morni-Team/julia-ai/releases/download';
const DLL = 'https://github.com/Morni-Team/julia-ai/releases/latest/download';

function aufbau({ exe = Buffer.from('MZ – Installer'), summe, urlExe } = {}) {
  const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'julia-upd-'));
  fs.writeFileSync(path.join(ordner, 'package.json'), JSON.stringify({ version: '0.9.3' }));
  const sha = summe || crypto.createHash('sha512').update(exe).digest('base64');
  const yml = `version: 1.0.0\nfiles:\n  - url: Julia-AI-Setup.exe\n    sha512: ${sha}\n    size: ${exe.length}\npath: Julia-AI-Setup.exe\nsha512: ${sha}\nreleaseDate: '2026-09-14T10:00:00.000Z'\n`;
  const releases = [
    {
      tag_name: 'v1.0.0', body: '- Julia gibt es jetzt zum Installieren', draft: false, prerelease: false,
      assets: [
        { name: 'latest.yml', size: yml.length, browser_download_url: `${DL}/v1.0.0/latest.yml` },
        { name: 'Julia-AI-Setup.exe', size: exe.length, browser_download_url: urlExe || `${DL}/v1.0.0/Julia-AI-Setup.exe` },
      ],
    },
    { tag_name: 'v1.1.0-beta.1', body: 'Test', prerelease: true, assets: [] },
    { tag_name: 'v0.9.2', body: 'alt', assets: [] },
  ];
  const antworten = { api: releases, [`${DLL}/latest.yml`]: yml, [`${DL}/v1.0.0/latest.yml`]: yml, [urlExe || `${DL}/v1.0.0/Julia-AI-Setup.exe`]: exe };
  const geholt = [];
  const holen = async (url) => {
    geholt.push(url);
    const k = url.startsWith('https://api.github.com/') ? 'api' : url;
    // API absichtlich auf 403 (Rate-Limit) setzen: antworten.api = null.
    if (k === 'api' && antworten.api === null) return { ok: false, status: 403 };
    if (!(k in antworten)) return { ok: false, status: 404 };
    const d = antworten[k];
    return {
      ok: true,
      status: 200,
      json: async () => d,
      text: async () => String(d),
      arrayBuffer: async () => { const b = Buffer.from(d); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); },
    };
  };
  const gestartet = [];
  let beendet = false;
  const u = new InstallerUpdater({
    appOrdner: ordner,
    datenOrdner: ordner,
    config: { get: (k) => (k === 'update.kanal' ? 'stabil' : undefined) },
    istBeschaeftigt: () => false,
    beiFertig: () => {},
    beenden: () => { beendet = true; },
    holen,
    starten: (datei, args) => { gestartet.push({ datei, args }); return { unref() {} }; },
  });
  return { u, ordner, gestartet, geholt, istBeendet: () => beendet, releases, antworten };
}

test('Installierte Fassung findet das neueste stabile Release samt Versionshinweis', async () => {
  const { u } = aufbau();
  const r = await u.pruefen();
  assert.equal(r.fehler, undefined);
  assert.equal(r.neu, 'v1.0.0', 'Vorabversion bleibt im stabilen Kanal außen vor');
  assert.deepEqual(r.zeilen, ['1.0.0 – Julia gibt es jetzt zum Installieren']);
});

test('Installer wird nur mit passender SHA-512-Summe gestartet', async () => {
  const { u, ordner, gestartet, istBeendet } = aufbau();
  await u.pruefen();
  await u._einspielen('v1.0.0');
  assert.equal(gestartet.length, 1);
  assert.match(gestartet[0].datei, /Julia-AI-Setup-1\.0\.0\.exe$/);
  assert.deepEqual(gestartet[0].args.slice(0, 1), ['/S']);
  assert.equal(fs.readFileSync(gestartet[0].datei, 'utf8'), 'MZ – Installer');
  assert.equal(JSON.parse(fs.readFileSync(path.join(ordner, 'update-status.json'), 'utf8')).phase, 'installer');
  assert.equal(istBeendet(), true);
});

test('Beim Einspielen gilt die neueste Version, nicht ein alter Prüfstand', async () => {
  const { u, gestartet, releases, antworten } = aufbau();
  await u.pruefen();
  const exe = Buffer.from('MZ – neuer');
  const sha = crypto.createHash('sha512').update(exe).digest('base64');
  const yml = `version: 1.1.0\npath: Julia-AI-Setup.exe\nsha512: ${sha}\n`;
  releases.unshift({
    tag_name: 'v1.1.0', body: 'neu', draft: false, prerelease: false,
    assets: [
      { name: 'latest.yml', size: yml.length, browser_download_url: `${DL}/v1.1.0/latest.yml` },
      { name: 'Julia-AI-Setup.exe', size: exe.length, browser_download_url: `${DL}/v1.1.0/Julia-AI-Setup.exe` },
    ],
  });
  antworten[`${DLL}/latest.yml`] = yml; // „latest"-Download zeigt jetzt auf 1.1.0
  antworten[`${DL}/v1.1.0/latest.yml`] = yml;
  antworten[`${DL}/v1.1.0/Julia-AI-Setup.exe`] = exe;
  await u._einspielen('v1.0.0');
  assert.match(gestartet[0].datei, /Julia-AI-Setup-1\.1\.0\.exe$/);
  assert.equal(fs.readFileSync(gestartet[0].datei, 'utf8'), 'MZ – neuer');
});

test('Falsche Prüfsumme: nichts wird gestartet', async () => {
  const falsch = crypto.createHash('sha512').update('etwas anderes').digest('base64');
  const { u, gestartet, istBeendet } = aufbau({ summe: falsch });
  await u.pruefen();
  await assert.rejects(u._einspielen('v1.0.0'), /Prüfsumme/);
  assert.equal(gestartet.length, 0);
  assert.equal(istBeendet(), false);
});

test('Downloads von fremden Adressen werden ignoriert – Julia lädt nur vom offiziellen Release', async () => {
  // Selbst wenn die API eine fremde Asset-URL nennt: der stabile Pfad baut die
  // Download-Adresse aus dem offiziellen Muster selbst und fasst die fremde nie an.
  const { u, gestartet, geholt, antworten } = aufbau({ urlExe: 'https://angreifer.example/Julia-AI-Setup.exe' });
  antworten[`${DL}/v1.0.0/Julia-AI-Setup.exe`] = Buffer.from('MZ – Installer');
  await u.pruefen();
  await u._einspielen('v1.0.0');
  assert.ok(!geholt.some((x) => x.includes('angreifer')), 'die fremde Adresse wird nie geladen');
  assert.equal(gestartet.length, 1, 'installiert nur vom offiziellen Release');
});

test('Update-Prüfung überlebt ein API-403 (Rate-Limit) über die Download-URL (Issue #105)', async () => {
  const { u, antworten } = aufbau();
  antworten.api = null; // API antwortet mit „403" (siehe holen-Mock unten)
  const r = await u.pruefen();
  assert.equal(r.fehler, undefined, 'kein Fehler trotz API-403');
  assert.equal(r.neu, 'v1.0.0', 'neue Version kommt aus der Download-URL');
});

test('latest.yml: nur vollständige Angaben mit harmlosem Dateinamen', () => {
  const sha = crypto.createHash('sha512').update('x').digest('base64');
  assert.deepEqual(latestYmlLesen(`version: 1.0.0\npath: Julia-AI-Setup.exe\nsha512: ${sha}\n`), { version: '1.0.0', datei: 'Julia-AI-Setup.exe', sha512: sha });
  assert.throws(() => latestYmlLesen(`version: 1.0.0\nfiles:\n  - sha512: ${sha}\npath: Julia-AI-Setup.exe\n`), /unvollständig/);
  assert.throws(() => latestYmlLesen(`version: 1.0.0\npath: ../../boese.exe\nsha512: ${sha}\n`), /Installer/);
  assert.throws(() => latestYmlLesen('version: 1.0.0\npath: Julia-AI-Setup.exe\nsha512: kaputt\n'), /SHA-512/);
});

test('Nach dem Installer meldet Julia, ob die neue Version läuft', () => {
  const { u, ordner } = aufbau();
  const status = path.join(ordner, 'update-status.json');
  fs.writeFileSync(status, JSON.stringify({ phase: 'installer', ziel: 'v0.9.3' }));
  assert.equal(u.startStatus().ok, true);
  assert.equal(fs.existsSync(status), false, 'wird nur einmal gemeldet');
  fs.writeFileSync(status, JSON.stringify({ phase: 'installer', ziel: 'v1.0.0' }));
  const s = u.startStatus();
  assert.equal(s.ok, false);
  assert.match(s.fehler, /0\.9\.3/);
});

test('updateSchritt: verifizieren → wiederholen → aufgeben (Issue #100)', () => {
  assert.deepEqual(updateSchritt(null, '1.0.0'), { aktion: 'nichts' });
  assert.equal(updateSchritt({ phase: 'installer', ziel: 'v1.0.0' }, '1.0.0').aktion, 'fertig');
  const w = updateSchritt({ phase: 'installer', ziel: 'v1.0.0', versuch: 0, von: 'v0.9.3' }, '0.9.3');
  assert.equal(w.aktion, 'wiederholen');
  assert.equal(w.versuch, 1);
  const a = updateSchritt({ phase: 'installer', ziel: 'v1.0.0', versuch: 1, von: 'v0.9.3' }, '0.9.3');
  assert.equal(a.aktion, 'aufgeben');
  assert.equal(a.rollbackVon, 'v0.9.3');
});

test('startStatus: kam das Update nicht an, wird der Installer einmal automatisch wiederholt', () => {
  const { u, ordner, gestartet, istBeendet } = aufbau();
  const status = path.join(ordner, 'update-status.json');
  const inst = path.join(ordner, 'updates', 'Julia-AI-Setup-1.0.0.exe');
  fs.mkdirSync(path.dirname(inst), { recursive: true });
  fs.writeFileSync(inst, 'MZ');
  fs.writeFileSync(status, JSON.stringify({ phase: 'installer', ziel: 'v1.0.0', von: 'v0.9.3', versuch: 0, installer: inst }));
  const s = u.startStatus(); // läuft weiter 0.9.3 → einmal wiederholen
  assert.equal(s.phase, 'wiederholung');
  assert.equal(gestartet.length, 1, 'Installer wird erneut gestartet');
  assert.equal(istBeendet(), true);
  assert.equal(JSON.parse(fs.readFileSync(status, 'utf8')).versuch, 1);
  // Zweiter Anlauf scheitert auch → aufgeben, Status weg, kein weiterer Start.
  const s2 = u.startStatus();
  assert.equal(s2.ok, false);
  assert.equal(gestartet.length, 1, 'kein Endlos-Wiederholen');
  assert.equal(fs.existsSync(status), false);
});

test('startStatus: erfolgreiches Update sichert den Installer als Rollback-Backup, zurueckRollen nutzt es', () => {
  const { u, ordner, gestartet } = aufbau();
  const status = path.join(ordner, 'update-status.json');
  const inst = path.join(ordner, 'updates', 'Julia-AI-Setup-0.9.3.exe');
  fs.mkdirSync(path.dirname(inst), { recursive: true });
  fs.writeFileSync(inst, 'MZ-gut');
  fs.writeFileSync(status, JSON.stringify({ phase: 'installer', ziel: 'v0.9.3', von: 'v0.9.2', versuch: 0, installer: inst }));
  const s = u.startStatus(); // läuft jetzt 0.9.3 = ziel → fertig + Backup
  assert.equal(s.ok, true);
  const backup = path.join(ordner, 'update-backup');
  assert.ok(fs.readdirSync(backup).some((n) => /Julia-AI-Setup-0\.9\.3\.exe/.test(n)), 'Backup angelegt');
  // Rollback startet den gesicherten Installer erneut.
  const r = u.zurueckRollen();
  assert.equal(r.ok, true);
  assert.equal(gestartet.length, 1);
});
