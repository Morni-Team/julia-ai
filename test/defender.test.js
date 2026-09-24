'use strict';

// Tests für die Defender-Ausnahme (Issue #97) – reine Helfer (kein echter Aufruf).
const test = require('node:test');
const assert = require('node:assert/strict');
const { psQuote, ausschlussSkript, startBefehl, istAusgeschlossen, fehlerArt } = require('../src/main/defender');

test('psQuote: verdoppelt Anführungszeichen, klammert', () => {
  assert.equal(psQuote('C:\\Julia'), '"C:\\Julia"');
  assert.equal(psQuote('a"b'), '"a""b"');
});

test('ausschlussSkript: Pfade und Prozesse', () => {
  const s = ausschlussSkript(['C:\\Julia', 'C:\\Data'], ['Julia AI.exe']);
  assert.match(s, /Add-MpPreference -ExclusionPath "C:\\Julia","C:\\Data"/);
  assert.match(s, /Add-MpPreference -ExclusionProcess "Julia AI\.exe"/);
});

test('ausschlussSkript: leer wirft', () => {
  assert.throws(() => ausschlussSkript([], []), /Keine Pfade/);
});

test('startBefehl: nutzt RunAs (UAC) und EncodedCommand', () => {
  const b = startBefehl('Add-MpPreference -ExclusionPath "x"');
  assert.match(b, /Start-Process powershell -Verb RunAs/);
  assert.match(b, /-EncodedCommand/);
  // Das innere Kommando steckt base64-utf16le kodiert drin.
  const b64 = b.match(/'([A-Za-z0-9+/=]+)'\s*$/)[1];
  assert.match(Buffer.from(b64, 'base64').toString('utf16le'), /ExclusionPath "x"/);
});

test('fehlerArt: nur echter UAC-Abbruch (1223) zählt als UAC – nicht „Zugriff verweigert" (Issue #110)', () => {
  // Echtes Abbrechen der UAC-Nachfrage:
  assert.equal(fehlerArt('Der Vorgang wurde durch den Benutzer abgebrochen'), 'uac');
  assert.equal(fehlerArt('The operation was canceled by the user'), 'uac');
  assert.equal(fehlerArt('Ausnahme ... (1223)'), 'uac');
  // „Zugriff verweigert" trotz Ja = Manipulationsschutz, NICHT UAC-Abbruch:
  assert.equal(fehlerArt('Add-MpPreference : Zugriff verweigert'), 'tamper');
  assert.equal(fehlerArt('Access is denied'), 'tamper');
  // Kein Fehler / Manipulationsschutz ohne Ausgabe → Manipulationsschutz-Zweig:
  assert.equal(fehlerArt(''), 'tamper');
  assert.equal(fehlerArt(null), 'tamper');
});

test('istAusgeschlossen: erkennt Pfad unabhängig von Groß/klein und Slash', () => {
  const ausgabe = 'C:\\Program Files\\Julia AI\r\nC:\\Users\\x\\AppData\\Roaming\\Julia AI';
  assert.equal(istAusgeschlossen(ausgabe, 'C:/Program Files/Julia AI'), true);
  assert.equal(istAusgeschlossen(ausgabe, 'c:\\program files\\julia ai\\'), true);
  assert.equal(istAusgeschlossen(ausgabe, 'C:\\Woanders'), false);
  assert.equal(istAusgeschlossen('', 'C:\\Julia'), false);
});
