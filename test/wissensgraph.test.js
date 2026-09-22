'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Wissensgraph } = require('../src/main/wissensgraph');

const neu = () => new Wissensgraph(fs.mkdtempSync(path.join(os.tmpdir(), 'julia-wg-')));

test('Entitäten mit Beobachtungen merken und abfragen (Issue #89)', () => {
  const g = neu();
  const r = g.merken({ entitaeten: [{ name: 'Morni', typ: 'Person', beobachtungen: ['arbeitet an Julia', 'mag Minecraft'] }] });
  assert.equal(r.neueEntitaeten, 1);
  assert.equal(r.neueBeobachtungen, 2);
  const a = g.abfragen('morni');
  assert.equal(a.entitaeten.length, 1);
  assert.equal(a.entitaeten[0].typ, 'Person');
  assert.deepEqual(a.entitaeten[0].beobachtungen, ['arbeitet an Julia', 'mag Minecraft']);
});

test('Suche findet auch über Beobachtungen und Typ', () => {
  const g = neu();
  g.merken({ entitaeten: [{ name: 'Julia', typ: 'Projekt', beobachtungen: ['Electron-Assistent'] }] });
  assert.equal(g.abfragen('electron').entitaeten.length, 1);
  assert.equal(g.abfragen('projekt').entitaeten.length, 1);
  assert.equal(g.abfragen('gibtsnicht').entitaeten.length, 0);
});

test('Relationen verknüpfen Entitäten und legen fehlende an', () => {
  const g = neu();
  g.merken({ relationen: [{ von: 'Morni', art: 'arbeitet an', zu: 'Julia' }] });
  const a = g.abfragen('Morni');
  assert.equal(a.relationen.length, 1);
  assert.equal(a.relationen[0].art, 'arbeitet an');
  // Beide Enden der Relation wurden als Entität angelegt.
  assert.equal(g.abfragen('').gesamt, 2);
});

test('Doppeltes wird zusammengeführt (Beobachtungen und Relationen dedupliziert)', () => {
  const g = neu();
  g.merken({ entitaeten: [{ name: 'Julia', beobachtungen: ['A'] }], relationen: [{ von: 'Morni', art: 'baut', zu: 'Julia' }] });
  const r = g.merken({ entitaeten: [{ name: 'Julia', beobachtungen: ['A', 'B'] }], relationen: [{ von: 'Morni', art: 'baut', zu: 'Julia' }] });
  assert.equal(r.neueBeobachtungen, 1); // nur 'B' ist neu
  assert.equal(r.neueRelationen, 0); // Relation gab es schon
});

test('Entfernen: Beobachtung, Relation und ganze Entität', () => {
  const g = neu();
  g.merken({ entitaeten: [{ name: 'Julia', beobachtungen: ['A', 'B'] }], relationen: [{ von: 'Morni', art: 'baut', zu: 'Julia' }] });
  assert.equal(g.entfernen({ entitaet: 'Julia', beobachtung: 'A' }), true);
  assert.deepEqual(g.abfragen('Julia').entitaeten[0].beobachtungen, ['B']);
  assert.equal(g.entfernen({ relation: { von: 'Morni', art: 'baut', zu: 'Julia' } }), true);
  assert.equal(g.abfragen('Julia').relationen.length, 0);
  assert.equal(g.entfernen({ entitaet: 'Morni' }), true);
  assert.equal(g.abfragen('').gesamt, 1); // nur noch Julia
  assert.equal(g.entfernen({ entitaet: 'gibtsnicht' }), false);
});

test('Zugangsdaten werden nie in den Graphen gemerkt', () => {
  const g = neu();
  assert.throws(() => g.merken({ entitaeten: [{ name: 'WLAN', beobachtungen: ['Passwort ist geheim'] }] }), /Zugangsdaten/);
  assert.throws(() => g.merken({ entitaeten: [{ name: 'Konto', typ: 'sk-ant-api03-abc' }] }), /Zugangsdaten/);
  assert.throws(() => g.merken({ relationen: [{ von: 'A', art: 'hat token', zu: 'B' }] }), /Zugangsdaten/);
  assert.equal(g.abfragen('').gesamt, 0); // nichts halb geschrieben
});

test('alsText: leer und mit Inhalt', () => {
  const g = neu();
  assert.equal(g.alsText(), '(noch leer)');
  g.merken({ entitaeten: [{ name: 'Julia', typ: 'Projekt', beobachtungen: ['X'] }], relationen: [{ von: 'Morni', art: 'baut', zu: 'Julia' }] });
  const t = g.alsText();
  assert.match(t, /Julia \(Projekt\): X/);
  assert.match(t, /Morni —baut→ Julia/);
});

test('Kaputte wissensgraph.json: Lesen meldet es, Schreiben überschreibt nichts', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'julia-wg-'));
  const datei = path.join(dir, 'wissensgraph.json');
  fs.writeFileSync(datei, '{ halb geschrieben');
  const g = new Wissensgraph(dir);
  assert.match(g.alsText(), /nicht lesbar/);
  assert.throws(() => g.merken({ entitaeten: [{ name: 'Julia' }] }));
  assert.equal(fs.readFileSync(datei, 'utf8'), '{ halb geschrieben');
});

test('wissensgraph.json mit BOM wird gelesen', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'julia-wg-'));
  fs.writeFileSync(path.join(dir, 'wissensgraph.json'), '﻿{"entitaeten":{"Julia":{"typ":"Projekt","beobachtungen":["X"]}},"relationen":[]}', 'utf8');
  assert.match(new Wissensgraph(dir).alsText(), /Julia \(Projekt\): X/);
});
