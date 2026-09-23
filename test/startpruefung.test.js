'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const sp = require('../src/main/startpruefung');

function ordner() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'julia-start-'));
}

test('Start: Flags – Unbekanntes und Widersprüchliches werden nur bemängelt', () => {
  const r = sp.flaggenPruefen(['electron.exe', '--versteckt', '--irgendwas', 'C:/pfad']);
  assert.deepEqual(r.unbekannt, ['--irgendwas']);
  assert.equal(r.konflikt, false);
  assert.equal(r.warnungen.length, 1);

  const k = sp.flaggenPruefen(['electron.exe', '--use-gl=swiftshader', '--disable-software-rasterizer']);
  assert.equal(k.konflikt, true);
  assert.match(k.warnungen.join(' '), /Software-Rendering/);

  assert.deepEqual(sp.flaggenPruefen(['electron.exe']).unbekannt, []);
});

test('Start: Logbuch dreht sich bei Überlänge und verliert nie den Start', () => {
  const o = ordner();
  try {
    const datei = path.join(o, 'start.log');
    const buch = new sp.Logbuch(datei);
    // Über die Grenze schreiben, dann muss ein .1 entstehen.
    const brocken = 'x'.repeat(20000);
    for (let i = 0; i < Math.ceil(sp.LOG_MAX / 20000) + 2; i++) buch.schreiben('INFO', brocken);
    assert.ok(fs.existsSync(`${datei}.1`), 'altes Logbuch als .1 vorhanden');
    assert.ok(fs.statSync(datei).size < sp.LOG_MAX + 40000);
  } finally {
    fs.rmSync(o, { recursive: true, force: true });
  }
});

test('Start: kaputter Logbuch-Pfad stürzt nicht ab', () => {
  const buch = sp.logbuchOeffnen('\0:/geht/nicht');
  assert.doesNotThrow(() => buch.schreiben('INFO', 'egal'));
});

test('Start: Schreibrechte – geht und geht nicht', () => {
  const o = ordner();
  try {
    assert.doesNotThrow(() => sp.schreibbarPruefen(path.join(o, 'unterordner')));
    assert.throws(() => sp.schreibbarPruefen('\0ungueltig'), /schreiben/);
  } finally {
    fs.rmSync(o, { recursive: true, force: true });
  }
});

test('Start: Software-Rendering wird gemerkt und wieder vergessen', () => {
  const o = ordner();
  try {
    assert.equal(sp.softwareRendering(o), false);
    sp.softwareRenderingSetzen(o, true);
    assert.equal(sp.softwareRendering(o), true);
    sp.softwareRenderingSetzen(o, false);
    assert.equal(sp.softwareRendering(o), false);
  } finally {
    fs.rmSync(o, { recursive: true, force: true });
  }
});

test('Start: leere Oberfläche ohne GPU-Absturz → nächste Grafik-Stufe + Neustart (Issue #3/#54/#57)', () => {
  const o = ordner();
  try {
    let neu = 0; let fatal = 0;
    const r = sp.blankUiAbsichern({ datenOrdner: o, logbuch: { schreiben() {} }, neustart: () => neu++, fatal: () => fatal++ });
    assert.equal(r, true);
    assert.equal(sp.grafikModus(o), 'd3d9', 'erste Fallback-Stufe der Leiter');
    assert.equal(neu, 1);
    assert.equal(fatal, 0);
  } finally {
    fs.rmSync(o, { recursive: true, force: true });
  }
});

test('Start: leere Oberfläche arbeitet sich die Grafik-Leiter hoch, meldet erst auf der letzten Stufe klar', () => {
  const o = ordner();
  try {
    const log = { schreiben() {} };
    // normal → d3d9 → gl → swiftshader → software → gpu-aus, jeweils Neustart …
    for (const erwartet of ['d3d9', 'gl', 'swiftshader', 'software', 'gpu-aus']) {
      let neu = 0;
      const r = sp.blankUiAbsichern({ datenOrdner: o, logbuch: log, neustart: () => neu++, fatal: () => {} });
      assert.equal(r, true);
      assert.equal(sp.grafikModus(o), erwartet);
      assert.equal(neu, 1);
    }
    // … und auf der letzten Stufe (gpu-aus) kein weiterer Neustart, sondern Meldung.
    let neu = 0; let fatal = 0;
    const r = sp.blankUiAbsichern({ datenOrdner: o, logbuch: log, neustart: () => neu++, fatal: () => fatal++ });
    assert.equal(r, false);
    assert.equal(neu, 0, 'kein Endlos-Neustart');
    assert.equal(fatal, 1, 'klare Meldung');
  } finally {
    fs.rmSync(o, { recursive: true, force: true });
  }
});

function fakeApp() {
  return {
    _h: {},
    on(ev, fn) { (this._h[ev] = this._h[ev] || []).push(fn); },
    removeListener() {},
    feuern(ev, ...a) { for (const fn of this._h[ev] || []) fn({}, ...a); },
  };
}

test('Start: GPU-Absturz beim Start heilt sich sofort (Software-Rendering + ein Neustart)', () => {
  const o = ordner();
  try {
    let t = 1000;
    let gemeldet = 0; let neugestartet = 0; let fatal = 0;
    const app = fakeApp();
    sp.gpuUeberwachen({ app, logbuch: { schreiben() {} }, datenOrdner: o, melden: () => gemeldet++, neustart: () => neugestartet++, fatal: () => fatal++, schwelle: 2, jetzt: () => t, startFensterMs: 20000 });

    // Sauberer Abgang zählt nicht.
    app.feuern('render-process-gone', {}, { reason: 'clean-exit' });
    assert.equal(neugestartet, 0);

    // Erster GPU-Absturz im Startfenster: sofort Software-Rendering und einmal neu starten.
    app.feuern('child-process-gone', { type: 'GPU', reason: 'crashed', exitCode: -1 });
    assert.equal(sp.softwareRendering(o), true);
    assert.equal(neugestartet, 1);
    assert.equal(gemeldet, 0);
    // Kein endloses Neustarten bei weiteren Abstürzen.
    app.feuern('child-process-gone', { type: 'GPU', reason: 'crashed', exitCode: -1 });
    app.feuern('render-process-gone', {}, { reason: 'crashed' });
    assert.equal(neugestartet, 1);
    assert.equal(fatal, 0);
  } finally {
    fs.rmSync(o, { recursive: true, force: true });
  }
});

test('Start: GPU-Absturz trotz Software-Modus weicht auf gpu-aus aus, erst danach FATAL (Issue #101)', () => {
  const o = ordner();
  try {
    sp.grafikModusSetzen(o, 'software'); // war schon im Software-Modus
    let neugestartet = 0; let fatal = 0;
    const app = fakeApp();
    sp.gpuUeberwachen({ app, logbuch: { schreiben() {} }, datenOrdner: o, neustart: () => neugestartet++, fatal: () => fatal++, jetzt: () => 1000, startFensterMs: 20000 });
    // GPU crasht trotz Software-Modus → GPU-Prozess ganz aus (gpu-aus) + ein Neustart, KEIN FATAL.
    app.feuern('child-process-gone', { type: 'GPU', reason: 'crashed', exitCode: -2147483645 });
    assert.equal(sp.grafikModus(o), 'gpu-aus', 'letzte Rettung: GPU-Prozess komplett aus');
    assert.equal(neugestartet, 1);
    assert.equal(fatal, 0, 'noch kein FATAL – es gibt eine tiefere Stufe');
  } finally {
    fs.rmSync(o, { recursive: true, force: true });
  }
});

test('Start: GPU-Absturz auch ohne GPU-Prozess (gpu-aus, letzte Stufe) → dann klar FATAL (Issue #101)', () => {
  const o = ordner();
  try {
    sp.grafikModusSetzen(o, 'gpu-aus'); // schon auf der letzten Stufe
    let neugestartet = 0; let fatal = 0;
    const app = fakeApp();
    sp.gpuUeberwachen({ app, logbuch: { schreiben() {} }, datenOrdner: o, neustart: () => neugestartet++, fatal: () => fatal++, jetzt: () => 1000, startFensterMs: 20000 });
    app.feuern('child-process-gone', { type: 'GPU', reason: 'crashed', exitCode: -2147483645 });
    assert.equal(neugestartet, 0, 'keine Schleife mehr');
    assert.equal(fatal, 1, 'jetzt klare Meldung');
  } finally {
    fs.rmSync(o, { recursive: true, force: true });
  }
});

test('Start: nach dem Startfenster erst ab der Schwelle der Software-Rückfall, und nur einmal', () => {
  const o = ordner();
  try {
    let t = 1000; // Start des Startfensters …
    let gemeldet = 0; let neugestartet = 0;
    const app = fakeApp();
    sp.gpuUeberwachen({ app, logbuch: { schreiben() {} }, datenOrdner: o, melden: () => gemeldet++, neustart: () => neugestartet++, schwelle: 2, jetzt: () => t, startFensterMs: 20000 });
    t = 100000; // … jetzt weit danach

    app.feuern('child-process-gone', { type: 'GPU', reason: 'crashed', exitCode: -1 });
    assert.equal(gemeldet, 0, 'ein Absturz reicht noch nicht');
    app.feuern('child-process-gone', { type: 'GPU', reason: 'crashed', exitCode: -1 });
    assert.equal(sp.softwareRendering(o), true);
    assert.equal(gemeldet, 1);
    assert.equal(neugestartet, 1);
    app.feuern('child-process-gone', { type: 'GPU', reason: 'crashed', exitCode: -1 });
    assert.equal(gemeldet, 1, 'nur einmal');
  } finally {
    fs.rmSync(o, { recursive: true, force: true });
  }
});

test('Start: wiederholte Renderer-Abstürze nach dem Start heilen sich (Software + Neustart)', () => {
  const o = ordner();
  try {
    let t = 1000;
    let gemeldet = 0; let neugestartet = 0;
    const app = fakeApp();
    sp.gpuUeberwachen({ app, logbuch: { schreiben() {} }, datenOrdner: o, melden: () => gemeldet++, neustart: () => neugestartet++, schwelle: 2, jetzt: () => t, startFensterMs: 20000 });
    t = 100000; // weit nach dem Startfenster

    app.feuern('render-process-gone', {}, { reason: 'clean-exit' });
    assert.equal(gemeldet, 0, 'ein sauberes Ende zählt nicht');
    app.feuern('render-process-gone', {}, { reason: 'crashed' });
    assert.equal(gemeldet, 0, 'ein Absturz reicht noch nicht');
    app.feuern('render-process-gone', {}, { reason: 'crashed' });
    assert.equal(sp.softwareRendering(o), true);
    assert.equal(gemeldet, 1);
    assert.equal(neugestartet, 1);
    app.feuern('render-process-gone', {}, { reason: 'crashed' });
    assert.equal(gemeldet, 1, 'nur einmal');
  } finally {
    fs.rmSync(o, { recursive: true, force: true });
  }
});

test('Start: ein sauberer GPU-Neustart löst keinen Rückfall aus', () => {
  const o = ordner();
  try {
    const app = { _h: {}, on(ev, fn) { (this._h[ev] = this._h[ev] || []).push(fn); }, removeListener() {}, feuern(ev, ...a) { for (const fn of this._h[ev] || []) fn({}, ...a); } };
    sp.gpuUeberwachen({ app, logbuch: { schreiben() {} }, datenOrdner: o, schwelle: 2 });
    app.feuern('child-process-gone', { type: 'GPU', reason: 'clean-exit', exitCode: 0 });
    app.feuern('child-process-gone', { type: 'GPU', reason: 'clean-exit', exitCode: 0 });
    assert.equal(sp.softwareRendering(o), false);
  } finally {
    fs.rmSync(o, { recursive: true, force: true });
  }
});

test('Start: ein GPU-Absturz beim Start sichert sofort den nächsten Start ab (Issue #2)', () => {
  const o = ordner();
  try {
    const app = { _h: {}, on(ev, fn) { (this._h[ev] = this._h[ev] || []).push(fn); }, removeListener() {}, feuern(ev, ...a) { for (const fn of this._h[ev] || []) fn({}, ...a); } };
    sp.gpuUeberwachen({ app, logbuch: { schreiben() {} }, datenOrdner: o, schwelle: 2, jetzt: () => 1000, startFensterMs: 20000 });
    assert.equal(sp.softwareRendering(o), false);
    // Schon der ERSTE GPU-Absturz kurz nach dem Start setzt den Merker – auch
    // wenn die Schwelle (2) für den Neustart noch nicht erreicht ist.
    app.feuern('child-process-gone', { type: 'GPU', reason: 'crashed', exitCode: -2147483645 });
    assert.equal(sp.softwareRendering(o), true, 'nächster Start nutzt Software-Rendering');
  } finally {
    fs.rmSync(o, { recursive: true, force: true });
  }
});

test('Start: ein späterer einzelner GPU-Absturz setzt den Merker nicht (kein Fehlalarm)', () => {
  const o = ordner();
  try {
    let t = 1000;
    const app = { _h: {}, on(ev, fn) { (this._h[ev] = this._h[ev] || []).push(fn); }, removeListener() {}, feuern(ev, ...a) { for (const fn of this._h[ev] || []) fn({}, ...a); } };
    sp.gpuUeberwachen({ app, logbuch: { schreiben() {} }, datenOrdner: o, schwelle: 2, jetzt: () => t, startFensterMs: 20000 });
    t = 60000; // lange nach dem Start
    app.feuern('child-process-gone', { type: 'GPU', reason: 'crashed', exitCode: -1 });
    assert.equal(sp.softwareRendering(o), false, 'ein einzelner Absturz später greift nicht vor');
  } finally {
    fs.rmSync(o, { recursive: true, force: true });
  }
});
