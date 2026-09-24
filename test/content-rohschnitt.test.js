'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { ffmpegRohschnitt, eindeutigeQuellen } = require('../src/main/content/rohschnitt');
const { schnittplanBereinigen } = require('../src/main/content/schnittplan');

test('eindeutigeQuellen: dedupliziert Dateien, überspringt unbekannte Quellen', () => {
  const clips = [{ quelle: 'A' }, { quelle: 'B' }, { quelle: 'A' }, { quelle: 'X' }];
  const { dateien, index } = eindeutigeQuellen(clips, { A: 'a.mp4', B: 'b.mp4' });
  assert.deepEqual(dateien, ['a.mp4', 'b.mp4']);
  assert.equal(index.A, 0);
  assert.equal(index.B, 1);
  assert.equal(index.X, undefined);
});

test('ffmpegRohschnitt: baut concat-Befehl aus den Clips', () => {
  const plan = schnittplanBereinigen({ clips: [
    { quelle: 'A', in_s: 1, out_s: 3 },
    { quelle: 'B', in_s: 5, out_s: 6.5 },
    { quelle: 'A', in_s: 10, out_s: 12 },
  ] });
  const r = ffmpegRohschnitt(plan, { quellen: { A: 'a.mp4', B: 'b.mp4' }, ziel: 'out.mp4' });
  assert.equal(r.programm, 'ffmpeg');
  assert.equal(r.clips, 3);
  // Zwei eindeutige Inputs
  assert.equal(r.args.filter((a) => a === '-i').length, 2);
  const graph = r.args[r.args.indexOf('-filter_complex') + 1];
  assert.match(graph, /concat=n=3:v=1:a=1\[outv\]\[outa\]/);
  assert.match(graph, /\[0:v\]trim=start=1:end=3/); // erster Clip aus Input 0 (A)
  assert.match(graph, /\[1:v\]trim=start=5:end=6.5/); // zweiter aus Input 1 (B)
  assert.match(graph, /\[0:v\]trim=start=10:end=12/); // dritter wieder aus Input 0 (A)
  assert.equal(r.args[r.args.length - 1], 'out.mp4');
  assert.deepEqual(r.args.slice(-5, -1), ['-map', '[outv]', '-map', '[outa]']);
});

test('ffmpegRohschnitt: klare Fehler bei fehlenden Angaben', () => {
  const plan = schnittplanBereinigen({ clips: [{ quelle: 'A', in_s: 0, out_s: 2 }] });
  assert.throws(() => ffmpegRohschnitt(plan, { quellen: {}, ziel: 'o.mp4' }), /Keine verwertbaren Clips/);
  assert.throws(() => ffmpegRohschnitt(plan, { quellen: { A: 'a.mp4' } }), /Kein Ziel/);
  assert.throws(() => ffmpegRohschnitt(null, { ziel: 'o.mp4' }), /Kein Schnittplan/);
});
