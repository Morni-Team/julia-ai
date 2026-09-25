'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { stilleAnalyseBefehl, stillenAusLog, dauerAusLog, behaltSegmente, rohschnittBefehl, shortsAuswahl, shortsBefehl, thumbnailBefehl } = require('../src/main/content/schneiden');

const LOG = `
  Duration: 00:02:30.50, start: 0.000000, bitrate: 1200 kb/s
[silencedetect @ 0x1] silence_start: 5.0
[silencedetect @ 0x1] silence_end: 8.5 | silence_duration: 3.5
[silencedetect @ 0x1] silence_start: 60.2
[silencedetect @ 0x1] silence_end: 61.0 | silence_duration: 0.8
`;

test('stilleAnalyseBefehl: FFmpeg-Analysebefehl mit silencedetect', () => {
  const b = stilleAnalyseBefehl('v.mp4', { noiseDb: -30, minStilleS: 0.5 });
  assert.equal(b.programm, 'ffmpeg');
  assert.ok(b.args.some((a) => /silencedetect=noise=-30dB:d=0.5/.test(a)));
  assert.ok(b.args.includes('v.mp4'));
});

test('stillenAusLog + dauerAusLog: parst FFmpeg-Ausgabe', () => {
  assert.deepEqual(stillenAusLog(LOG), [{ von_s: 5.0, bis_s: 8.5 }, { von_s: 60.2, bis_s: 61.0 }]);
  assert.equal(dauerAusLog(LOG), 150.5);
  assert.equal(dauerAusLog('kein duration'), 0);
});

test('behaltSegmente: Redeteile zwischen den Stillen, mit Rand', () => {
  const seg = behaltSegmente(stillenAusLog(LOG), 150.5, { randS: 0.1, minLen: 0.4 });
  assert.ok(seg.length >= 2);
  assert.equal(seg[0].von_s, 0); // von Anfang bis zur ersten Stille
  assert.ok(seg[0].bis_s > 4.9 && seg[0].bis_s <= 5.2);
  assert.equal(seg[seg.length - 1].bis_s, 150.5); // bis zum Ende
});

test('rohschnittBefehl: baut FFmpeg-Schnitt aus Behalten-Segmenten', () => {
  const r = rohschnittBefehl('v.mp4', [{ von_s: 0, bis_s: 5 }, { von_s: 8.5, bis_s: 60.2 }], 'out.mp4');
  assert.equal(r.programm, 'ffmpeg');
  assert.equal(r.clips, 2);
  assert.equal(r.args[r.args.length - 1], 'out.mp4');
});

test('shortsAuswahl: längste Redeteile als Hoch-Clip-Kandidaten, gekürzt auf maxS', () => {
  const seg = [{ von_s: 0, bis_s: 6 }, { von_s: 10, bis_s: 90 }, { von_s: 100, bis_s: 130 }];
  const s = shortsAuswahl(seg, { anzahl: 2, minS: 12, maxS: 60 });
  assert.equal(s.length, 2);
  // längstes (10..90) → auf 60 s gekürzt
  assert.deepEqual(s[0], { von_s: 10, bis_s: 70 });
  // zu kurzes (0..6) fällt raus; zweitlängstes (100..130) kommt rein
  assert.ok(s.some((x) => x.von_s === 100));
});

test('shortsBefehl: 9:16-Vertikal-Clip', () => {
  const r = shortsBefehl('v.mp4', { von_s: 10, bis_s: 40, ziel: 'short.mp4' });
  assert.equal(r.programm, 'ffmpeg');
  assert.ok(r.args.some((a) => /crop=ih\*9\/16:ih,scale=1080:1920/.test(a)));
  assert.ok(r.args.includes('short.mp4'));
  assert.throws(() => shortsBefehl('', { ziel: 'x' }), /Kein Video/);
});

test('thumbnailBefehl: 1280x720-Standbild an einem Zeitpunkt', () => {
  const r = thumbnailBefehl('v.mp4', { bei_s: 42, ziel: 'thumb.png' });
  assert.equal(r.programm, 'ffmpeg');
  assert.ok(r.args.includes('-frames:v'));
  assert.ok(r.args.some((a) => /scale=1280:720/.test(a)));
  assert.ok(r.args.includes('thumb.png'));
});
