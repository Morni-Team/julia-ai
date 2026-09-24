'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const g = require('../src/main/grafik');

test('Leiter-Reihenfolge und Gültigkeit', () => {
  assert.deepEqual(g.MODI, ['normal', 'd3d9', 'gl', 'swiftshader', 'software', 'gpu-aus', 'notfall']);
  assert.equal(g.gueltig('swiftshader'), true);
  assert.equal(g.gueltig('gpu-aus'), true);
  assert.equal(g.gueltig('notfall'), true);
  assert.equal(g.gueltig('quatsch'), false);
});

test('naechster geht die Leiter hoch und bleibt oben stehen', () => {
  assert.equal(g.naechster('normal'), 'd3d9');
  assert.equal(g.naechster('d3d9'), 'gl');
  assert.equal(g.naechster('gl'), 'swiftshader');
  assert.equal(g.naechster('swiftshader'), 'software');
  assert.equal(g.naechster('software'), 'gpu-aus');
  assert.equal(g.naechster('gpu-aus'), 'notfall'); // NEU: von gpu-aus in den Notfall
  assert.equal(g.naechster('notfall'), 'notfall'); // letzte Stufe bleibt
  assert.equal(g.naechster('unbekannt'), 'd3d9'); // von unbekannt auf erste Fallback-Stufe
});

test('naechsteRettung: software → gpu-aus → notfall, sonst direkt Software (Issue #109)', () => {
  assert.equal(g.naechsteRettung('normal'), 'software');
  assert.equal(g.naechsteRettung('d3d9'), 'software');
  assert.equal(g.naechsteRettung('swiftshader'), 'software');
  assert.equal(g.naechsteRettung('software'), 'gpu-aus');
  assert.equal(g.naechsteRettung('gpu-aus'), 'notfall'); // NEU: eine Stufe über gpu-aus
  assert.equal(g.naechsteRettung('notfall'), 'software'); // von der letzten aus neu ansetzen
});

test('letzte erkennt die unterste (verträglichste) Stufe', () => {
  assert.equal(g.letzte('notfall'), true); // NEU: notfall ist jetzt die letzte
  assert.equal(g.letzte('gpu-aus'), false);
  assert.equal(g.letzte('software'), false);
  assert.equal(g.letzte('normal'), false);
  assert.equal(g.letzte('swiftshader'), false);
});

test('notfall: Fremd-DLL-/Code-Integrity-Mitigation zusätzlich zu gpu-aus (Issue #109)', () => {
  const f = g.flaggenFuer('notfall');
  const namen = f.map(([n]) => n);
  // Alles von gpu-aus:
  assert.ok(namen.includes('disable-gpu'));
  assert.ok(namen.includes('in-process-gpu'));
  // PLUS die Windows-Mitigation gegen injizierte DLLs / Code-Integrity-Kills:
  assert.ok(namen.includes('no-sandbox'));
  assert.ok(f.some(([n, v]) => n === 'disable-features' && v === 'RendererCodeIntegrity'));
  assert.equal(g.hardwareAus('notfall'), true);
});

test('gpu-aus: kein separater GPU-Prozess, aber Software-Rendering bleibt (Issue #107/#109)', () => {
  const f = g.flaggenFuer('gpu-aus');
  const namen = f.map(([n]) => n);
  assert.ok(namen.includes('disable-gpu'));
  assert.ok(namen.includes('disable-gpu-compositing'));
  // GPU-/SwiftShader-Arbeit im Browser-Prozess statt in einem crashenden GPU-Kind.
  assert.ok(namen.includes('in-process-gpu'));
  // NICHT disable-software-rasterizer – das nahm dem Renderer jeden Zeichen-Pfad (#109).
  assert.ok(!namen.includes('disable-software-rasterizer'));
  assert.equal(g.hardwareAus('gpu-aus'), true);
});

test('flaggenFuer liefert die richtigen ANGLE/SwiftShader-Schalter', () => {
  assert.deepEqual(g.flaggenFuer('normal'), []);
  assert.deepEqual(g.flaggenFuer('software'), []); // läuft über disableHardwareAcceleration
  assert.deepEqual(g.flaggenFuer('d3d9'), [['use-angle', 'd3d9']]);
  assert.deepEqual(g.flaggenFuer('gl'), [['use-angle', 'gl']]);
  const sw = g.flaggenFuer('swiftshader');
  assert.ok(sw.some(([n, v]) => n === 'use-angle' && v === 'swiftshader'));
});

test('hardwareAus nur bei der vollen Software-Stufe', () => {
  assert.equal(g.hardwareAus('software'), true);
  assert.equal(g.hardwareAus('d3d9'), false);
  assert.equal(g.hardwareAus('normal'), false);
});
