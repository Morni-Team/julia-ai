'use strict';

// Chat-Compacting (Issue #119): lange Gespräche werden zu einer Kurzfassung + den
// letzten wörtlichen Runden zusammengezogen – gültig und tokensparend.
const test = require('node:test');
const assert = require('node:assert/strict');
const { verlaufKompaktieren, kompaktierPlan, verlaufDigest, istNutzerRunde } = require('../src/main/agent');

function runde(n) {
  return [
    { role: 'user', content: [{ type: 'text', text: `[Kanal: desktop]\nFrage ${n}` }] },
    { role: 'assistant', content: [{ type: 'text', text: `Antwort ${n}` }] },
  ];
}
function verlauf(anzahl) {
  const v = [];
  for (let i = 1; i <= anzahl; i++) v.push(...runde(i));
  return v;
}

test('kompaktierPlan: erst ab der Schwelle, sonst null', () => {
  assert.equal(kompaktierPlan(verlauf(10), { schwelle: 30, behalten: 12 }), null);
  const plan = kompaktierPlan(verlauf(40), { schwelle: 30, behalten: 12 });
  assert.ok(plan);
  // Es bleiben die letzten 12 Runden wörtlich (24 Nachrichten).
  assert.equal(plan.neu.length, 24);
  assert.ok(istNutzerRunde(plan.neu[0]), 'neu beginnt mit einer Nutzer-Runde');
});

test('verlaufKompaktieren: alte Runden → eine Kurzfassung, Rest wörtlich, gültig', () => {
  const v = verlauf(40);
  const k = verlaufKompaktieren(v, { schwelle: 30, behalten: 12 });
  // 2 Nachrichten Kurzfassung (user+assistant) + 24 wörtliche = 26.
  assert.equal(k.length, 26);
  assert.ok(istNutzerRunde(k[0]), 'beginnt mit einer Nutzer-Runde (kein verwaistes tool_result)');
  assert.match(k[0].content[0].text, /Kurzfassung/);
  // Die Kurzfassung nennt frühe Runden, die letzten bleiben wörtlich erhalten.
  assert.match(k[0].content[0].text, /Frage 1/);
  assert.equal(k[k.length - 1].content[0].text, 'Antwort 40');
  // Die Kopfzeile „[Kanal: …]" wird in der Kurzfassung abgezogen.
  assert.ok(!/\[Kanal/.test(k[0].content[0].text));
});

test('verlaufKompaktieren: kurzer Verlauf bleibt unverändert', () => {
  const v = verlauf(5);
  assert.strictEqual(verlaufKompaktieren(v, { schwelle: 30, behalten: 12 }), v);
});

test('verlaufDigest: fasst Nutzer- und Julia-Zeilen zusammen', () => {
  const d = verlaufDigest(runde(1).concat(runde(2)));
  assert.match(d, /Du: Frage 1/);
  assert.match(d, /Julia: Antwort 1/);
  assert.match(d, /Du: Frage 2/);
});
