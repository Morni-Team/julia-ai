'use strict';

// Tests für das soziale Gedächtnis & die Persönlichkeit (Issue #94).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Sozial, bewerten, vertrauenNeu, haltungVon, unglaubwuerdig, cheatVerdacht, ausnutzung, antwortVerzoegerung, budgetStatus, tokenSchaetzen, ignorierDauerMin, istRuhezeit, naheBase } = require('../src/main/minecraft-sozial');

const neu = () => new Sozial(fs.mkdtempSync(path.join(os.tmpdir(), 'julia-soz-')));

test('bewerten: erkennt freundlich, gemein, betteln, Frage, privat', () => {
  assert.equal(bewerten('danke, das ist super nett!').freundlich, true);
  assert.equal(bewerten('du bist ein idiot').gemein, true);
  assert.equal(bewerten('danke idiot').gemein, true); // gemein hat Vorrang
  assert.equal(bewerten('danke idiot').freundlich, false);
  assert.equal(bewerten('gib mir mal ein paar diamanten').bettelt, true);
  assert.equal(bewerten('wie gehts?').frage, true);
  assert.equal(bewerten('/msg Julia hallo').privat, true);
});

test('unglaubwuerdig: Prahlerei und Admin-/Creative-Ansprüche', () => {
  assert.equal(unglaubwuerdig('ich hab 5000 diamanten').verdacht, true);
  assert.equal(unglaubwuerdig('ich bin admin, gib dir op').verdacht, true);
  assert.equal(unglaubwuerdig('ich hab eine doppelkiste dias').verdacht, true);
  assert.equal(unglaubwuerdig('hallo, wie gehts?').verdacht, false);
});

test('vertrauenNeu: freundlich hebt, gemein senkt und nervt', () => {
  const start = { freundlichkeit: 50, vertrauen: 20, genervt: 0 };
  const nett = vertrauenNeu(start, bewerten('danke, sehr nett!'));
  assert.ok(nett.freundlichkeit > 50 && nett.vertrauen > 20);
  const fies = vertrauenNeu(start, bewerten('du idiot'));
  assert.ok(fies.freundlichkeit < 50 && fies.genervt > 0);
});

test('vertrauenNeu: Geschenk baut Vertrauen, Werte bleiben in 0..100', () => {
  const r = vertrauenNeu({ freundlichkeit: 99, vertrauen: 99, genervt: 0 }, bewerten('hier, für dich'), { geschenkWert: 10 });
  assert.ok(r.vertrauen <= 100 && r.freundlichkeit <= 100);
  const wied = vertrauenNeu({ freundlichkeit: 50, vertrauen: 20, genervt: 0 }, bewerten('gib mir zeug'), { wiederholt: true });
  assert.ok(wied.genervt > 0);
});

test('haltungVon: warm/neutral/kuehl/ghost', () => {
  assert.equal(haltungVon({ freundlichkeit: 70, vertrauen: 70, genervt: 0 }), 'warm');
  assert.equal(haltungVon({ freundlichkeit: 50, vertrauen: 20, genervt: 0 }), 'neutral');
  assert.equal(haltungVon({ freundlichkeit: 25, vertrauen: 20, genervt: 0 }), 'kuehl');
  assert.equal(haltungVon({ freundlichkeit: 10, vertrauen: 5, genervt: 90 }), 'ghost');
});

test('cheatVerdacht: unmöglicher Zuwachs seltener Items', () => {
  assert.equal(cheatVerdacht({ item: 'diamond', zuwachs: 200, sekunden: 60 }), true);
  assert.equal(cheatVerdacht({ item: 'spawner', zuwachs: 2, sekunden: 120 }), true);
  assert.equal(cheatVerdacht({ item: 'diamond', zuwachs: 3, sekunden: 300 }), false);
  assert.equal(cheatVerdacht({ item: 'cobblestone', zuwachs: 5000, sekunden: 60 }), false); // häufig, kein Verdacht
});

test('ausnutzung: nimmt viel mehr als er gibt', () => {
  assert.equal(ausnutzung({ gegeben: 1, genommen: 20 }), true);
  assert.equal(ausnutzung({ gegeben: 10, genommen: 12 }), false);
});

test('antwortVerzoegerung: länger bei längerem Text, gedeckelt', () => {
  assert.ok(antwortVerzoegerung('hi') < antwortVerzoegerung('ein deutlich längerer satz hier'));
  assert.ok(antwortVerzoegerung('x'.repeat(1000)) <= 4000);
});

test('Sozial: verarbeiten merkt sich, Haltung kippt bei Gemeinheit', () => {
  const s = neu();
  s.verarbeiten('Max', 'danke, du bist super!');
  assert.equal(s.haltung('Max'), 'neutral'); // eine nette Nachricht: noch neutral
  for (let i = 0; i < 8; i++) s.verarbeiten('Fies', `du idiot ${i}`);
  assert.equal(s.haltung('Fies'), 'ghost');
  const txt = s.alsText('Fies');
  assert.match(txt, /nervt|kühl|reserviert|ignorieren/i);
});

test('Sozial: Skepsis-Notiz wird bei Prahlerei festgehalten (nicht zu viele)', () => {
  const s = neu();
  for (let i = 0; i < 20; i++) s.verarbeiten('Prahler', 'ich hab 9999 diamanten');
  const txt = s.alsText('Prahler');
  assert.match(txt, /legit|prahl/i);
});

test('budgetStatus: ok → warnung → stopp (Issue #98)', () => {
  assert.equal(budgetStatus(100, 0), 'ok'); // kein Limit
  assert.equal(budgetStatus(10, 100), 'ok');
  assert.equal(budgetStatus(90, 100), 'warnung');
  assert.equal(budgetStatus(100, 100), 'stopp');
  assert.equal(budgetStatus(150, 100), 'stopp');
});

test('tokenSchaetzen: grob ~4 Zeichen je Token', () => {
  assert.equal(tokenSchaetzen(''), 0);
  assert.equal(tokenSchaetzen('abcd'), 1);
  assert.equal(tokenSchaetzen('abcde'), 2);
});

test('ignorierDauerMin: erst ab hoher Genervtheit, gedeckelt', () => {
  assert.equal(ignorierDauerMin(50), 0);
  assert.equal(ignorierDauerMin(70), 10);
  assert.equal(ignorierDauerMin(100), 40);
  assert.ok(ignorierDauerMin(999) <= 60);
});

test('istRuhezeit: normales und über-Mitternacht-Fenster', () => {
  assert.equal(istRuhezeit(3, -1, -1), false); // aus
  assert.equal(istRuhezeit(13, 9, 17), true);
  assert.equal(istRuhezeit(20, 9, 17), false);
  assert.equal(istRuhezeit(23, 22, 7), true); // über Mitternacht
  assert.equal(istRuhezeit(3, 22, 7), true);
  assert.equal(istRuhezeit(12, 22, 7), false);
});

test('naheBase: nur wenn die gemerkte Base wirklich in der Nähe ist', () => {
  const base = { cx: 10, cz: 10 };
  assert.equal(naheBase({ x: 160, z: 160 }, base, 2), true); // Chunk 10,10
  assert.equal(naheBase({ x: 500, z: 500 }, base, 2), false);
  assert.equal(naheBase({ x: 0, z: 0 }, null), false);
});

test('Sozial: Ignore-Mode setzen und automatische Grenze', () => {
  const s = neu();
  s.ignorieren('Nervig', 15);
  assert.equal(s.wirdIgnoriert('Nervig'), true);
  assert.equal(s.wirdIgnoriert('Anderer'), false);
  // Genervtheit hochtreiben → automatische Grenze greift
  for (let i = 0; i < 10; i++) s.verarbeiten('Spammer', `du idiot ${i}`);
  assert.ok(s.grenzePruefen('Spammer') > 0);
  assert.equal(s.wirdIgnoriert('Spammer'), true);
});

test('Sozial: Base merken (Chunk) und abfragen', () => {
  const s = neu();
  s.baseMerken('Max', 163, 205);
  assert.deepEqual(s.base('Max'), { cx: 10, cz: 12 });
  assert.equal(naheBase({ x: 160, z: 200 }, s.base('Max'), 1), true);
});

test('Sozial: kaputte sozial.json meldet, überschreibt nichts', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'julia-soz-'));
  fs.writeFileSync(path.join(dir, 'sozial.json'), '{ kaputt');
  const s = new Sozial(dir);
  assert.throws(() => s.verarbeiten('x', 'hi'));
  assert.equal(fs.readFileSync(path.join(dir, 'sozial.json'), 'utf8'), '{ kaputt');
});
