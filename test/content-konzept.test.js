'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { konzeptPrompt, planAusAntwort, profilKurz, stilKurz } = require('../src/main/content/konzept');

test('konzeptPrompt: baut System+User, honoriert Sprache und Regeln', () => {
  const { system, user } = konzeptPrompt({
    profil: { kanalname: 'Testkanal', sprache: 'de', regeln: ['nie länger als 3 s Stille'], marke: { farben: ['#FFDD00'] } },
    stil: { schnitte_pro_min: 22, hook_sekunden: 8, broll_anteil: 0.35 },
    transkript: [{ quelle: 'A001', von_s: 0, bis_s: 5, text: 'Hallo Leute' }],
    briefing: 'Kurzes Intro-Video', ziellaenge_s: 600,
  });
  assert.match(system, /ONLY one valid JSON/i);
  assert.match(system, /German/); // Sprache aus dem Profil
  assert.match(user, /HARD RULES/); // Regeln landen im Prompt
  assert.match(user, /Testkanal/);
  assert.match(user, /A001 0-5s/); // Transkript-Segment
  assert.match(user, /TARGET LENGTH/);
});

test('konzeptPrompt: englisches Profil → englische Inhalte angewiesen', () => {
  const { system } = konzeptPrompt({ profil: { sprache: 'en' }, stil: {} });
  assert.match(system, /in English/);
});

test('profilKurz / stilKurz: kompakte Zusammenfassung', () => {
  assert.match(profilKurz({ kanalname: 'X', regeln: ['R1', 'R2'] }), /R1 \| R2/);
  assert.match(stilKurz({ schnitte_pro_min: 20, broll_anteil: 0.4 }), /cuts\/min ~20/);
  assert.match(stilKurz({ broll_anteil: 0.4 }), /40%/);
});

test('planAusAntwort: löst JSON aus Codefence heraus und bereinigt', () => {
  const antwort = 'Klar! Hier ist der Plan:\n```json\n{"clips":[{"quelle":"A001","in_s":1,"out_s":3,"begruendung":"Hook"}]}\n```\nViel Erfolg!';
  const plan = planAusAntwort(antwort);
  assert.equal(plan.clips.length, 1);
  assert.equal(plan.clips[0].quelle, 'A001');
});

test('planAusAntwort: findet JSON auch ohne Codefence', () => {
  const plan = planAusAntwort('Text davor {"clips":[{"quelle":"B","in_s":0,"out_s":2}]} Text danach');
  assert.equal(plan.clips.length, 1);
});

test('planAusAntwort: klare Fehler bei Unbrauchbarem', () => {
  assert.throws(() => planAusAntwort('gar kein json hier'), /kein JSON/);
  assert.throws(() => planAusAntwort('{"clips":[]}'), /keine verwertbaren Clips/);
});
