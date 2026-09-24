'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const s = require('../src/main/schnittprogramme');

test('erkennen: Namen und Aliase auf den Schlüssel abbilden', () => {
  assert.equal(s.erkennen('premiere'), 'premiere');
  assert.equal(s.erkennen('Adobe Premiere Pro'), 'premiere');
  assert.equal(s.erkennen('davinci resolve'), 'davinci');
  assert.equal(s.erkennen('resolve'), 'davinci');
  assert.equal(s.erkennen('CapCut'), 'capcut');
  assert.equal(s.erkennen('after effects'), 'aftereffects');
  assert.equal(s.erkennen('creative cloud'), 'creativecloud');
  assert.equal(s.erkennen('gibtsnicht'), null);
  assert.equal(s.erkennen(''), null);
});

test('erkennen: unscharf (Teilstring)', () => {
  assert.equal(s.erkennen('mach mal davinci auf'), 'davinci');
  assert.equal(s.erkennen('bitte after effects starten'), 'aftereffects');
});

test('suche: Startmenü-Suchbegriff je Programm', () => {
  assert.equal(s.suche('premiere'), 'Premiere Pro');
  assert.equal(s.suche('davinci'), 'DaVinci Resolve');
  assert.equal(s.suche('capcut'), 'CapCut');
  // Unbekanntes wird durchgereicht (Julia kann es trotzdem versuchen)
  assert.equal(s.suche('irgendein editor'), 'irgendein editor');
});

test('hilfe: Spickzettel mit Kürzeln, Ablauf und allgemeinen Hinweisen', () => {
  const h = s.hilfe('premiere');
  assert.match(h, /Adobe Premiere Pro/);
  assert.match(h, /Tastenkürzel:/);
  assert.match(h, /Strg\+M/); // Export
  assert.match(h, /Ablauf:/);
  assert.match(h, /Allgemein:/);
  assert.equal(s.hilfe('gibtsnicht'), null);
});

test('hilfe: After Effects erklärt Keyframe-Animation', () => {
  const h = s.hilfe('after effects');
  assert.match(h, /Keyframe|Stoppuhr/i);
  assert.match(h, /Media Encoder/i);
});

test('liste: enthält die gängigen Programme', () => {
  const namen = s.liste().map((p) => p.name);
  assert.ok(namen.includes('Adobe Premiere Pro'));
  assert.ok(namen.includes('DaVinci Resolve'));
  assert.ok(namen.includes('CapCut'));
  assert.ok(namen.includes('Adobe After Effects'));
});
