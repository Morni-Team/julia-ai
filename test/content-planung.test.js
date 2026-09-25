'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { PlanSpeicher, planBereinigen, datumRein } = require('../src/main/content/planung');

function ordner() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'julia-plan-'));
}

test('datumRein: nur echtes YYYY-MM-DD, sonst leer', () => {
  assert.equal(datumRein('2026-10-01'), '2026-10-01');
  assert.equal(datumRein('01.10.2026'), '');
  assert.equal(datumRein('morgen'), '');
});

test('planBereinigen: Skript behält Zeilenumbrüche, Status-Fallback', () => {
  const p = planBereinigen({ titel: 'Video', skript: 'Zeile 1\nZeile 2', status: 'quatsch', boese: 1 });
  assert.equal(p.titel, 'Video');
  assert.ok(p.skript.includes('\n'), 'Zeilenumbruch im Skript bleibt erhalten');
  assert.equal(p.status, 'idee');
  assert.equal(p.boese, undefined);
});

test('PlanSpeicher: sortiert nach Datum, Ideen ohne Datum ans Ende; ändern/entfernen', () => {
  const o = ordner();
  try {
    const s = new PlanSpeicher(o);
    s.hinzufuegen({ titel: 'Später', datum: '2026-12-01' });
    const frueh = s.hinzufuegen({ titel: 'Früher', datum: '2026-10-01' });
    s.hinzufuegen({ titel: 'Nur Idee' }); // kein Datum
    const alle = s.alle();
    assert.equal(alle[0].titel, 'Früher', 'frühestes Datum zuerst');
    assert.equal(alle[alle.length - 1].titel, 'Nur Idee', 'ohne Datum ans Ende');
    const u = s.aktualisieren(frueh.id, { status: 'geplant', skript: 'Hook\nMittelteil' });
    assert.equal(u.status, 'geplant');
    assert.ok(u.skript.includes('\n'));
    assert.equal(s.entfernen(frueh.id), true);
    assert.equal(s.aktualisieren('gibtsnicht', {}), null);
  } finally {
    fs.rmSync(o, { recursive: true, force: true });
  }
});
