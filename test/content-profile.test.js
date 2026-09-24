'use strict';

// Content-Creation-Modul: Creator-Profile (reine Logik + lokaler Speicher).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { standardProfil, profilBereinigen, stilBereinigen, ProfilSpeicher, HAEUFIGKEIT } = require('../src/main/content/profile');

function ordner() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'julia-content-'));
}

test('standardProfil: sinnvolle Vorgaben, id aus dem Namen', () => {
  const p = standardProfil('Mein Kanal!');
  assert.equal(p.id, 'mein-kanal');
  assert.equal(p.sprache, 'de');
  assert.equal(p.stilprofile.length, 1);
  assert.ok(p.marke && Array.isArray(p.marke.farben));
});

test('stilBereinigen: klemmt Zahlen und normalisiert Häufigkeiten', () => {
  const s = stilBereinigen({ name: 'X', schnitte_pro_min: 999, hook_sekunden: -5, broll_anteil: 2, jumpcut_haeufigkeit: 'quatsch' });
  assert.equal(s.schnitte_pro_min, 60); // auf Max geklemmt
  assert.equal(s.hook_sekunden, 0); // auf Min geklemmt
  assert.equal(s.broll_anteil, 1); // 0..1
  assert.ok(HAEUFIGKEIT.includes(s.jumpcut_haeufigkeit)); // ungültig → Fallback
});

test('profilBereinigen: wirft unbekannte Schlüssel raus, härtet Strings', () => {
  const p = profilBereinigen({ id: 'A B', kanalname: 'Test', boese: 'weg', sprache: 'fr', marke: { farben: ['#fff', ''], hack: 1 }, regeln: ['nie Stille', ''] });
  assert.equal(p.id, 'a-b');
  assert.equal(p.sprache, 'de'); // unbekannte Sprache → de
  assert.equal(p.boese, undefined);
  assert.equal(p.marke.hack, undefined);
  assert.deepEqual(p.marke.farben, ['#fff']); // leere weg
  assert.deepEqual(p.regeln, ['nie Stille']);
  assert.ok(p.stilprofile.length >= 1); // fehlende Stile → ein Standard
});

test('ProfilSpeicher: anlegen, aktiv, laden, löschen', () => {
  const o = ordner();
  try {
    const s = new ProfilSpeicher(o);
    assert.equal(s.aktiv(), null);
    const a = s.setzen(standardProfil('Kanal A'));
    assert.equal(s.aktiv().id, a.id, 'erstes Profil wird automatisch aktiv');
    s.setzen(standardProfil('Kanal B'));
    assert.equal(s.alle().length, 2);
    // Aktiv umschalten
    assert.equal(s.aktivSetzen('kanal-b'), true);
    assert.equal(s.aktiv().id, 'kanal-b');
    // Aktives löschen → ein anderes wird aktiv
    assert.equal(s.loeschen('kanal-b'), true);
    assert.equal(s.aktiv().id, 'kanal-a');
    assert.equal(s.loeschen('gibtsnicht'), false);
  } finally {
    fs.rmSync(o, { recursive: true, force: true });
  }
});

test('ProfilSpeicher: übersteht kaputte Datei (robustes Laden)', () => {
  const o = ordner();
  try {
    fs.mkdirSync(path.join(o, 'content'), { recursive: true });
    fs.writeFileSync(path.join(o, 'content', 'profile.json'), '{ kaputt', 'utf8');
    const s = new ProfilSpeicher(o);
    assert.deepEqual(s.alle(), []); // statt Absturz: leer
    s.setzen(standardProfil('Neu'));
    assert.equal(s.alle().length, 1);
  } finally {
    fs.rmSync(o, { recursive: true, force: true });
  }
});

test('ProfilSpeicher: Import/Export als JSON', () => {
  const o = ordner();
  try {
    const s = new ProfilSpeicher(o);
    s.setzen(standardProfil('Export Kanal'));
    const json = s.exportieren('export-kanal');
    assert.ok(json && json.includes('Export Kanal'));

    const s2 = new ProfilSpeicher(ordner());
    const n = s2.importieren(json);
    assert.equal(n, 1);
    assert.equal(s2.alle().length, 1);
    // Liste importieren
    assert.equal(s2.importieren('[{"kanalname":"L1"},{"kanalname":"L2"}]'), 2);
    assert.throws(() => s2.importieren('kein json'), /gültiges JSON/);
  } finally {
    fs.rmSync(o, { recursive: true, force: true });
  }
});
