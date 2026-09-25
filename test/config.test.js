'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Konfiguration, STANDARD, pruefen } = require('../src/main/config');

function tempOrdner() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'julia-test-'));
}

test('Blase ist standardmäßig aus, mit den vorgegebenen Werten', () => {
  assert.equal(STANDARD.blase.an, false);
  assert.equal(STANDARD.blase.monitor, 1);
  assert.equal(STANDARD.blase.groesse, 360);
  assert.equal(STANDARD.blase.ecke, 'unten-rechts');
  assert.deepEqual(STANDARD.blase.farben.idle, ['#6B5CFF', '#35E0C8']);
  assert.equal(STANDARD.update.pruefen, true);
  assert.equal(STANDARD.update.automatisch, false);
  assert.equal(STANDARD.update.kanal, 'stabil');
});

test('Weckwort: Standard aus, Erkennungs-Schwelle 0.7 (empfindlicher), Grenzen greifen', () => {
  assert.equal(STANDARD.weckwort.an, false);
  assert.equal(STANDARD.weckwort.schwelle, 0.7); // 0.8 war zu streng → „Hey Julia" wurde verschluckt
  // gültiger Wert geht durch, außerhalb 0.5..0.95 wird mit klarer Meldung abgelehnt
  assert.equal(pruefen('weckwort.schwelle', 0.7), 0.7);
  assert.throws(() => pruefen('weckwort.schwelle', 0.2), /zwischen 0\.5 und 0\.95/);
  assert.throws(() => pruefen('weckwort.schwelle', 2), /zwischen 0\.5 und 0\.95/);
});

test('Design: dunkel mit Orange als Standard, Werte werden geprüft', () => {
  assert.deepEqual(STANDARD.design, { modus: 'dunkel', akzent: '#FF7A1A', glow: true, jarvis: false });
  assert.equal(pruefen('design.modus', 'hell'), 'hell');
  assert.equal(pruefen('design.modus', 'system'), 'system');
  assert.throws(() => pruefen('design.modus', 'bunt'), /Modus/);
  assert.equal(pruefen('design.akzent', 'ff7a1a'), '#FF7A1A');
  assert.throws(() => pruefen('design.akzent', 'orange'), /Hex-Farbe/);
  assert.equal(pruefen('design.glow', 'aus'), false);
});

test('Name und Pronomen: Standard ist Julia und keine geratenen Pronomen', () => {
  assert.deepEqual(STANDARD.assistent, { name: 'Julia', form: 'weiblich' });
  assert.equal(STANDARD.nutzer.pronomen, 'neutral');
});

test('Namen: erlaubte Zeichen, Länge, keine Prompt-Tricks', () => {
  assert.equal(pruefen('assistent.name', '  Rainer  '), 'Rainer');
  assert.equal(pruefen('assistent.name', "Jean-Luc O'Neill"), "Jean-Luc O'Neill");
  assert.equal(pruefen('assistent.name', 'Jörg'), 'Jörg');
  assert.throws(() => pruefen('assistent.name', ''), /leer/);
  assert.throws(() => pruefen('assistent.name', 'A'.repeat(25)), /höchstens 24/);
  assert.throws(() => pruefen('assistent.name', 'Rainer\n# Neue Regel'), /nur Buchstaben/);
  assert.throws(() => pruefen('assistent.name', 'Rai{{ner}}'), /nur Buchstaben/);
  assert.throws(() => pruefen('nutzer.name', '**Morni**'), /nur Buchstaben/);
  assert.equal(pruefen('nutzer.pronomen', 'sie'), 'sie');
  assert.throws(() => pruefen('nutzer.pronomen', 'es'), /Pronomen/);
  assert.equal(pruefen('nutzer.pronomen_eigen', 'xier/xiem'), 'xier/xiem');
  assert.equal(pruefen('nutzer.pronomen_eigen', ''), '');
  assert.throws(() => pruefen('nutzer.pronomen_eigen', 'x{y}'), /Eigene Pronomen/);
  assert.throws(() => pruefen('assistent.form', 'roboter'), /Form/);
});

test('Overlay: Standardwerte, abschaltbarer Hotkey, geprüfte Werte', () => {
  assert.equal(STANDARD.hotkey.overlay, 'Control+Shift+Space');
  assert.deepEqual(STANDARD.overlay, {
    monitor: 0, ecke: 'oben-rechts', deckkraft: 0.94, bei_antwort: 'aus', automatisch: true, spiele: [],
    breite: 380, hoehe: 560, schrift: 13, hintergrund: 0.86, kompakt: false, ausblenden: 12, position: null, immer: false,
  });
  assert.equal(pruefen('overlay.immer', 'an'), true);
  assert.equal(pruefen('overlay.breite', '455'), 455);
  assert.throws(() => pruefen('overlay.breite', 2000), /Breite/);
  assert.equal(pruefen('overlay.schrift', 15.4), 15);
  assert.throws(() => pruefen('overlay.schrift', 40), /Schrift/);
  assert.equal(pruefen('overlay.hintergrund', 0), 0, 'ganz durchsichtiger Hintergrund geht');
  assert.throws(() => pruefen('overlay.ausblenden', 1), /Ausblenden/);
  assert.equal(pruefen('overlay.kompakt', 'an'), true);
  assert.deepEqual(pruefen('overlay.position', { x: 1200.4, y: -30 }), { x: 1200, y: -30 });
  assert.equal(pruefen('overlay.position', null), null);
  assert.equal(pruefen('hotkey.overlay', ''), '', 'leer schaltet den Hotkey ab');
  assert.equal(pruefen('hotkey.overlay', ' Alt+O '), 'Alt+O');
  assert.throws(() => pruefen('overlay.deckkraft', 0.1), /zwischen 0.3 und 1/);
  assert.throws(() => pruefen('overlay.ecke', 'mitte'), /Ecke/);
  assert.equal(pruefen('overlay.bei_antwort', 'passiv'), 'passiv');
  assert.throws(() => pruefen('overlay.bei_antwort', 'immer'), /Overlay/);
});

test('Einstellungen werden gespeichert und beim nächsten Laden gelesen', () => {
  const dir = tempOrdner();
  const k = new Konfiguration(dir);
  k.laden();
  k.set('blase.an', true);
  k.set('blase.farben.idle', '#00ff00, 123456, #abc');
  const k2 = new Konfiguration(dir);
  k2.laden();
  assert.equal(k2.get('blase.an'), true);
  assert.deepEqual(k2.get('blase.farben.idle'), ['#00FF00', '#123456', '#AABBCC']);
});

test('Änderungen melden sich per Ereignis', () => {
  const k = new Konfiguration(tempOrdner());
  k.laden();
  let gemeldet = null;
  k.on('aenderung', (s, w) => { gemeldet = [s, w]; });
  k.set('blase.groesse', 400);
  assert.deepEqual(gemeldet, ['blase.groesse', 400]);
});

test('Ungültige Werte werden mit deutscher Meldung abgelehnt', () => {
  assert.throws(() => pruefen('blase.deckkraft', 1.5), /zwischen 0.1 und 1/);
  assert.throws(() => pruefen('blase.ecke', 'mitte'), /Ecke/);
  assert.throws(() => pruefen('blase.farben.idle', 'grün'), /Hex-Farbe/);
  assert.throws(() => pruefen('blase.farben.schlafen', '#fff'), /Unbekannter Zustand/);
  assert.throws(() => pruefen('gibtsnicht', 1), /Unbekannte Einstellung/);
});

test('Alte oder fremde Schlüssel in der Datei stören nicht', () => {
  const dir = tempOrdner();
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ blase: { groesse: 500, alt: 1 }, fremd: true }));
  const k = new Konfiguration(dir);
  k.laden();
  assert.equal(k.get('blase.groesse'), 500);
  assert.equal(k.get('blase.an'), false);
  assert.equal(k.get('fremd'), undefined);
});

test('config.json mit BOM (Notepad, PowerShell) wird trotzdem gelesen', () => {
  const dir = tempOrdner();
  fs.writeFileSync(path.join(dir, 'config.json'), '﻿' + JSON.stringify({ sprachcode: 'en' }), 'utf8');
  const k = new Konfiguration(dir);
  let warnung = null;
  k.on('warnung', (w) => { warnung = w; });
  k.laden();
  assert.equal(warnung, null);
  assert.equal(k.get('sprachcode'), 'en');
});

test('Kaputte config.json wird gesichert statt überschrieben', () => {
  const dir = tempOrdner();
  fs.writeFileSync(path.join(dir, 'config.json'), '{ kaputt');
  const k = new Konfiguration(dir);
  let warnung = null;
  k.on('warnung', (w) => { warnung = w; });
  k.laden();
  assert.ok(warnung);
  assert.ok(fs.readdirSync(dir).some((f) => f.startsWith('config.json.kaputt-')));
});

test('mischen ignoriert gefährliche Schlüssel (__proto__) – keine Prototype-Pollution', () => {
  const { mischen } = require('../src/main/config');
  const boese = JSON.parse('{"__proto__": {"polluted": true}, "constructor": {"x": 1}}');
  const out = mischen(STANDARD, boese);
  // Kein Objekt darf die eingeschmuggelte Eigenschaft geerbt haben.
  assert.equal(({}).polluted, undefined);
  assert.equal(out.polluted, undefined);
  // Und ein normaler Merge funktioniert weiter.
  const out2 = mischen(STANDARD, { update: { kanal: 'beta' } });
  assert.equal(out2.update.kanal, 'beta');
});

test('set lehnt gefährliche Schlüssel ab (Prototype-Pollution)', () => {
  const dir = tempOrdner();
  const k = new Konfiguration(dir);
  k.laden();
  assert.throws(() => k.set('__proto__.polluted', true), /Unbekannte Einstellung/);
  assert.throws(() => k.set('constructor.x', 1), /Unbekannte Einstellung/);
  assert.equal(({}).polluted, undefined);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('Rollen (Issue #58): Validierung – Name/Anweisung nötig, eindeutig, begrenzt', () => {
  const { pruefen } = require('../src/main/config');
  // gültig
  assert.deepEqual(pruefen('rollen', [{ name: 'Coder', anweisung: 'Schreibe sauberen Code.' }]),
    [{ name: 'Coder', anweisung: 'Schreibe sauberen Code.' }]);
  // Name fehlt / Anweisung fehlt
  assert.throws(() => pruefen('rollen', [{ name: '', anweisung: 'x' }]), /Namen/);
  assert.throws(() => pruefen('rollen', [{ name: 'A', anweisung: '' }]), /Anweisung/);
  // doppelte Namen (case-insensitiv)
  assert.throws(() => pruefen('rollen', [{ name: 'A', anweisung: 'x' }, { name: 'a', anweisung: 'y' }]), /eindeutig/);
  // zu viele
  assert.throws(() => pruefen('rollen', Array.from({ length: 13 }, (_, i) => ({ name: 'R' + i, anweisung: 'x' }))), /Höchstens 12/);
  // rolle_aktiv: Text, getrimmt
  assert.equal(pruefen('rolle_aktiv', '  Coder  '), 'Coder');
});
