'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { stilleSegmente, sprechSegmente, jumpcutPunkte, staerksteMomente, hookKandidat } = require('../src/main/content/analyse');

// Hilfsreihe: laut (0.5) für a Sekunden, leise (0.0) für b Sekunden, … bei hz=10.
function reihe(muster, hz = 10) {
  const arr = [];
  for (const [pegel, dauer] of muster) for (let i = 0; i < Math.round(dauer * hz); i++) arr.push(pegel);
  return arr;
}

test('stilleSegmente: findet nur ausreichend lange Pausen', () => {
  const rms = reihe([[0.5, 1], [0.0, 2], [0.5, 1], [0.0, 0.2], [0.5, 1]], 10);
  const st = stilleSegmente(rms, { schwelle: 0.06, minDauerS: 0.35, hz: 10 });
  assert.equal(st.length, 1); // die 0.2s-Pause ist zu kurz
  assert.ok(Math.abs(st[0].von_s - 1) < 0.11);
  assert.ok(Math.abs(st[0].bis_s - 3) < 0.11);
});

test('sprechSegmente: Inhalt zwischen den Pausen, Ränder mit Luft', () => {
  const rms = reihe([[0.5, 1], [0.0, 1], [0.5, 1]], 10);
  const sp = sprechSegmente(rms, { schwelle: 0.06, minDauerS: 0.35, hz: 10, randS: 0.1 });
  assert.equal(sp.length, 2);
  assert.ok(sp[0].von_s >= 0);
  assert.ok(sp[1].bis_s <= 3.01);
});

test('jumpcutPunkte: kürzt Pausen über dem Limit (Regel „nie länger als 3 s Stille")', () => {
  const stille = [{ von_s: 10, bis_s: 15 }, { von_s: 20, bis_s: 21 }];
  const cuts = jumpcutPunkte(stille, 3);
  assert.equal(cuts.length, 1); // nur die 5s-Pause
  assert.deepEqual(cuts[0], { entferne_von_s: 13, entferne_bis_s: 15 });
});

test('staerksteMomente / hookKandidat', () => {
  const peaks = [{ t_s: 5, wert: 0.2 }, { t_s: 132, wert: 0.9 }, { t_s: 60, wert: 0.5 }];
  const top = staerksteMomente(peaks, 2);
  assert.deepEqual(top.map((p) => p.t_s), [132, 60]);
  assert.equal(hookKandidat(peaks).t_s, 132);
  assert.equal(hookKandidat([]), null);
});
