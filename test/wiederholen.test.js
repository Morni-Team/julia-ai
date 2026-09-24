'use strict';

// Wiederhol-Helfer mit Backoff (Issue #119/#120): scheitert eine Operation an einer
// transient gesperrten Datei / einem Netz-Aussetzer, wird ein paar Mal erneut
// versucht, bevor endgültig aufgegeben wird.
const test = require('node:test');
const assert = require('node:assert/strict');
const { mitWiederholung } = require('../src/main/wiederholen');

const sofort = async () => {}; // kein echtes Warten im Test

test('mitWiederholung: gibt beim ersten Erfolg direkt zurück', async () => {
  let n = 0;
  const r = await mitWiederholung(async () => { n++; return 'ok'; }, { warte: sofort });
  assert.equal(r, 'ok');
  assert.equal(n, 1);
});

test('mitWiederholung: wiederholt bei Fehler und gelingt beim zweiten Mal', async () => {
  let n = 0;
  const r = await mitWiederholung(async () => {
    n++;
    if (n < 2) throw new Error('resource busy or locked');
    return 'endlich';
  }, { versuche: 3, warte: sofort });
  assert.equal(r, 'endlich');
  assert.equal(n, 2);
});

test('mitWiederholung: gibt nach allen Versuchen den letzten Fehler weiter', async () => {
  let n = 0;
  await assert.rejects(
    mitWiederholung(async () => { n++; throw new Error(`EBUSY ${n}`); }, { versuche: 3, warte: sofort }),
    /EBUSY 3/,
  );
  assert.equal(n, 3, 'genau so viele Versuche wie erlaubt');
});

test('mitWiederholung: beiFehler wird je Fehlversuch gemeldet, aber nicht nach dem letzten', async () => {
  const gemeldet = [];
  await assert.rejects(
    mitWiederholung(async () => { throw new Error('x'); }, {
      versuche: 3, warte: sofort, beiFehler: (_e, v) => gemeldet.push(v),
    }),
  );
  assert.deepEqual(gemeldet, [1, 2]); // nach Versuch 3 (dem letzten) kein Melden mehr
});

test('mitWiederholung: ein Fehler im beiFehler-Callback stört nicht', async () => {
  let n = 0;
  const r = await mitWiederholung(async () => { n++; if (n < 2) throw new Error('einmal'); return 'gut'; }, {
    warte: sofort, beiFehler: () => { throw new Error('melden kaputt'); },
  });
  assert.equal(r, 'gut');
});
