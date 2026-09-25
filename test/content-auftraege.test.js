'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { AuftragSpeicher, auftragBereinigen, STATUS } = require('../src/main/content/auftraege');

function ordner() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'julia-auftr-'));
}

test('auftragBereinigen: festes Format, unbekannter Status → offen', () => {
  const a = auftragBereinigen({ titel: 'Cut A', videoPfad: 'D:/roh.mp4', anweisung: 'Stille raus', status: 'quatsch', boese: 1 });
  assert.equal(a.titel, 'Cut A');
  assert.equal(a.videoPfad, 'D:/roh.mp4');
  assert.equal(a.status, 'offen');
  assert.equal(a.boese, undefined);
  assert.ok(a.id && a.erstellt);
});

test('AuftragSpeicher: hinzufügen, neueste oben, Status setzen, nächster offen, entfernen', () => {
  const o = ordner();
  try {
    const s = new AuftragSpeicher(o);
    assert.deepEqual(s.alle(), []);
    const a = s.hinzufuegen({ titel: 'Erster', anweisung: 'schneide kurz' });
    const b = s.hinzufuegen({ titel: 'Zweiter', anweisung: 'jumpcuts' });
    assert.equal(s.alle()[0].id, b.id, 'neueste oben');
    // ältester offener zuerst
    assert.equal(s.naechsterOffen().id, a.id);
    s.setzenStatus(a.id, 'fertig', 'lief gut');
    assert.equal(s.naechsterOffen().id, b.id, 'fertige zählen nicht mehr als offen');
    const geladen = s.alle().find((x) => x.id === a.id);
    assert.equal(geladen.status, 'fertig');
    assert.equal(geladen.notiz, 'lief gut');
    assert.equal(s.entfernen(b.id), true);
    assert.equal(s.entfernen('gibtsnicht'), false);
    assert.equal(s.alle().length, 1);
  } finally {
    fs.rmSync(o, { recursive: true, force: true });
  }
});

test('AuftragSpeicher: übersteht kaputte Datei', () => {
  const o = ordner();
  try {
    fs.mkdirSync(path.join(o, 'content'), { recursive: true });
    fs.writeFileSync(path.join(o, 'content', 'auftraege.json'), '{ kaputt', 'utf8');
    const s = new AuftragSpeicher(o);
    assert.deepEqual(s.alle(), []);
    s.hinzufuegen({ titel: 'Neu' });
    assert.equal(s.alle().length, 1);
  } finally {
    fs.rmSync(o, { recursive: true, force: true });
  }
});

test('STATUS enthält die erwarteten Werte', () => {
  assert.deepEqual(STATUS, ['offen', 'laeuft', 'fertig', 'fehler']);
});
