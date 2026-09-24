'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { schnittplanBereinigen, clipGueltig, gesamtdauerS, entscheidungen, mmss } = require('../src/main/content/schnittplan');

test('schnittplanBereinigen: härtet Rohdaten, wirft ungültige Clips raus', () => {
  const p = schnittplanBereinigen({
    projekt: 'Test', ziellaenge_s: 600, stilprofil: 'Schnell',
    titelvorschlaege: ['A', '', 'B'],
    clips: [
      { quelle: 'A001', in_s: 12, out_s: 13.8, begruendung: '1,8 s Pause davor' },
      { quelle: 'A001', in_s: 5, out_s: 5 }, // leere Dauer → raus
      { in_s: 1, out_s: 2 }, // keine Quelle → raus
    ],
    boese: 'weg',
  });
  assert.equal(p.boese, undefined);
  assert.equal(p.clips.length, 1);
  assert.deepEqual(p.titelvorschlaege, ['A', 'B']);
  assert.equal(p.version, 1);
});

test('schnittplanBereinigen: Hook und Animationen-Platzhalter', () => {
  const p = schnittplanBereinigen({
    hook: { von_s: 0, bis_s: 8, quelle_clip: 'c1', quelle_von_s: 132.4, begruendung: 'Peak' },
    animationen: [{ vorlage: 'lower_third.aep', platzhalter: { TEXT: 'Name', FARBE: '#FFDD00' }, von_s: 20, bis_s: 24 }],
  });
  assert.equal(p.hook.bis_s, 8);
  assert.equal(p.animationen[0].platzhalter.TEXT, 'Name');
});

test('gesamtdauerS + clipGueltig', () => {
  assert.equal(clipGueltig({ quelle: 'x', in_s: 1, out_s: 2 }), true);
  assert.equal(clipGueltig({ quelle: '', in_s: 1, out_s: 2 }), false);
  const p = schnittplanBereinigen({ clips: [{ quelle: 'a', in_s: 0, out_s: 5 }, { quelle: 'b', in_s: 10, out_s: 13 }] });
  assert.equal(gesamtdauerS(p), 8);
});

test('entscheidungen: lesbare Liste mit Zeitmarken', () => {
  const p = schnittplanBereinigen({ clips: [{ quelle: 'A001', in_s: 12, out_s: 14, begruendung: 'Jumpcut' }] });
  const z = entscheidungen(p);
  assert.ok(z[0].includes('A001'));
  assert.ok(z[0].includes('Jumpcut'));
  assert.equal(mmss(75), '01:15');
});
