'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { haengerStatus, haengerAktiv, haengerDauer } = require('../src/main/minecraft');

test('erster Aufruf merkt sich nur den Anker', () => {
  const s = haengerStatus(null, { x: 10, z: 20 }, 100);
  assert.deepEqual(s.neu, { x: 10, z: 20, t: 100, sp: 0 });
  assert.ok(!s.springen);
});

test('kommt sie voran, wird der Anker versetzt und nicht gesprungen', () => {
  const anker = { x: 0, z: 0, t: 100 };
  const s = haengerStatus(anker, { x: 1, z: 0 }, 106); // 1 Block weiter
  assert.ok(!s.springen);
  assert.deepEqual(s.neu, { x: 1, z: 0, t: 106, sp: 0 });
});

test('kaum bewegt und lange genug festgehangen → Sprung-Impuls', () => {
  const anker = { x: 0, z: 0, t: 100 };
  const s = haengerStatus(anker, { x: 0.1, z: 0.05 }, 100 + 12); // <0,35 Block, 12 Ticks
  assert.equal(s.springen, true);
  assert.deepEqual(s.neu, { x: 0.1, z: 0.05, t: 112, sp: 1 });
});

test('nach mehreren Sprüngen ohne Vorankommen → aufgeben (Livelock-Schutz #8)', () => {
  // Simuliert wiederholtes Festhängen am selben Ort; der Zähler wächst mit.
  let anker = { x: 0, z: 0, t: 0 };
  let letzter = null;
  for (let i = 1; i <= 4; i++) {
    letzter = haengerStatus(anker, { x: 0.05, z: 0 }, i * 20, { minTicks: 12, maxSpruenge: 4 });
    assert.equal(letzter.springen, true);
    anker = letzter.neu; // Anker (inkl. Sprung-Zähler) übernehmen
  }
  assert.equal(letzter.neu.sp, 4);
  assert.equal(letzter.aufgeben, true);
});

test('Vorankommen setzt den Sprung-Zähler zurück (kein vorschnelles Aufgeben)', () => {
  let s = haengerStatus({ x: 0, z: 0, t: 0, sp: 3 }, { x: 0.05, z: 0 }, 20, { minTicks: 12, maxSpruenge: 4 });
  assert.equal(s.aufgeben, true); // 4. Sprung
  // Jetzt kommt sie ein Stück voran → Zähler zurück auf 0, kein Aufgeben mehr.
  s = haengerStatus(s.neu, { x: 2, z: 0 }, 40, { minTicks: 12, maxSpruenge: 4 });
  assert.ok(!s.springen);
  assert.equal(s.neu.sp, 0);
});

test('kaum bewegt, aber noch nicht lange genug → abwarten', () => {
  const anker = { x: 0, z: 0, t: 100 };
  const s = haengerStatus(anker, { x: 0.1, z: 0 }, 105); // erst 5 Ticks
  assert.ok(!s.springen);
  assert.ok(!s.neu);
});

test('Schwellen sind einstellbar', () => {
  const anker = { x: 0, z: 0, t: 0 };
  // minWeit 1.0: 0,5 Block gilt als „steht" → nach minTicks Sprung
  assert.equal(haengerStatus(anker, { x: 0.5, z: 0 }, 20, { minWeit: 1, minTicks: 20 }).springen, true);
  // minWeit 0.2: 0,5 Block gilt als vorangekommen → kein Sprung
  assert.ok(!haengerStatus(anker, { x: 0.5, z: 0 }, 20, { minWeit: 0.2, minTicks: 20 }).springen);
});

test('haengerAktiv: am Boden und will vorankommen → prüfen', () => {
  assert.equal(haengerAktiv({ wegsuche: true, selbst: false, onGround: true, imWasser: false }), true);
  assert.equal(haengerAktiv({ wegsuche: false, selbst: true, onGround: true, imWasser: false }), true);
});

test('haengerAktiv: im Wasser (onGround false) und will vorankommen → prüfen (Issue #28)', () => {
  assert.equal(haengerAktiv({ wegsuche: true, selbst: false, onGround: false, imWasser: true }), true);
});

test('haengerAktiv: in der Luft ohne Wasser → nicht prüfen', () => {
  assert.equal(haengerAktiv({ wegsuche: true, selbst: false, onGround: false, imWasser: false }), false);
});

test('haengerAktiv: will gar nicht vorankommen → nie prüfen', () => {
  assert.equal(haengerAktiv({ wegsuche: false, selbst: false, onGround: true, imWasser: true }), false);
});

test('haengerAktiv: passiv im Wasser eingekeilt mit laufender Aufgabe → doch prüfen (Nutzerfall „hängt fest")', () => {
  // Kein Lauf-Wunsch, kein Pathfinder, aber im Wasser UND eine Aufgabe läuft → auftauchen.
  assert.equal(haengerAktiv({ wegsuche: false, selbst: false, onGround: false, imWasser: true, aufgabe: true }), true);
  // An Land passiv (kein Lauf-Wunsch) bleibt es beim Nichtstun, auch mit Aufgabe.
  assert.equal(haengerAktiv({ wegsuche: false, selbst: false, onGround: true, imWasser: false, aufgabe: true }), false);
});

test('haengerDauer: im Wasser länger als an Land', () => {
  assert.ok(haengerDauer(true) > haengerDauer(false));
});
