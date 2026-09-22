'use strict';

// Tests für die KI-gesteuerte Handy-Bedienung (Issue #6): Bildschirm-Verdichtung
// und Aktions-Parser. Reine Logik – läuft in der normalen Root-Testsuite mit.
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../julia-android/src/bildschirm');

const el = (o) => ({ text: '', desc: '', klasse: '', id: '', clickable: false, editable: false, scrollable: false, x: 0, y: 0, tiefe: 0, ...o });

test('verdichten: filtert Rauschen, nummeriert, behält Bedienbares', () => {
  const roh = [
    el({ klasse: 'FrameLayout' }), // leerer Container → raus
    el({ text: 'Anmelden', clickable: true, x: 100, y: 200 }),
    el({ desc: 'Menü öffnen', clickable: true, x: 10, y: 10 }),
    el({ editable: true, x: 50, y: 300 }), // Eingabefeld ohne Text → bleibt (per Koordinate)
    el({ text: '   ' }), // nur Whitespace, nicht bedienbar → raus
  ];
  const d = B.verdichten(roh);
  assert.equal(d.length, 3);
  assert.deepEqual(d.map((x) => x.n), [1, 2, 3]);
  assert.equal(d[0].label, 'Anmelden');
  assert.equal(d[0].rolle, 'klick');
  assert.equal(d[2].rolle, 'eingabe');
  assert.equal(d[2].hatText, false);
});

test('verdichten: Dubletten (gleiches Label + Rolle) fallen weg', () => {
  const roh = [
    el({ text: 'OK', clickable: true }),
    el({ text: 'OK', clickable: true, x: 5 }), // Dublette
    el({ text: 'OK', editable: true }), // andere Rolle → bleibt
  ];
  const d = B.verdichten(roh);
  assert.equal(d.length, 2);
});

test('verdichten: max begrenzt die Länge', () => {
  const roh = Array.from({ length: 100 }, (_, i) => el({ text: `Knopf ${i}`, clickable: true }));
  assert.equal(B.verdichten(roh, { max: 10 }).length, 10);
});

test('alsText: knappe, nummerierte Darstellung; leer sauber', () => {
  assert.match(B.alsText([]), /leer|nichts/i);
  const t = B.alsText(B.verdichten([el({ text: 'Senden', clickable: true }), el({ editable: true })]));
  assert.match(t, /1\. .*Senden/);
  assert.match(t, /2\. \[✎\]/); // Eingabe-Markierung
});

test('aktionLesen: alle Kommandos', () => {
  assert.deepEqual(B.aktionLesen('KLICK 3'), { art: 'klick', n: 3 });
  assert.deepEqual(B.aktionLesen('tippe 2 "Hallo Welt"'), { art: 'tippe', n: 2, text: 'Hallo Welt' });
  assert.deepEqual(B.aktionLesen('TIPPE "ohne Nummer"'), { art: 'tippe', n: null, text: 'ohne Nummer' });
  assert.deepEqual(B.aktionLesen('SCROLL runter'), { art: 'scroll', vorwaerts: true });
  assert.deepEqual(B.aktionLesen('scroll hoch'), { art: 'scroll', vorwaerts: false });
  assert.deepEqual(B.aktionLesen('ZURUECK'), { art: 'zurueck' });
  assert.deepEqual(B.aktionLesen('zurück'), { art: 'zurueck' });
  assert.equal(B.aktionLesen('FERTIG "erledigt"').art, 'fertig');
  assert.equal(B.aktionLesen('FERTIG "erledigt"').text, 'erledigt');
});

test('aktionLesen: englische Kommandos und Geschwätz davor', () => {
  assert.deepEqual(B.aktionLesen('TAP 1'), { art: 'klick', n: 1 });
  assert.deepEqual(B.aktionLesen('BACK'), { art: 'zurueck' });
  // KI plaudert erst, dann das Kommando in einer eigenen Zeile:
  assert.deepEqual(B.aktionLesen('Ich tippe jetzt auf Anmelden.\nKLICK 5'), { art: 'klick', n: 5 });
});

test('aktionLesen: Unbekanntes wird als solches gemeldet (kein Absturz)', () => {
  assert.equal(B.aktionLesen('bla bla').art, 'unbekannt');
  assert.equal(B.aktionLesen('').art, 'unbekannt');
});

test('aktionText: menschenlesbar mit Element-Label', () => {
  const d = B.verdichten([el({ text: 'Anmelden', clickable: true })]);
  assert.match(B.aktionText({ art: 'klick', n: 1 }, d), /Anmelden/);
  assert.match(B.aktionText({ art: 'scroll', vorwaerts: true }, d), /unten/);
});
