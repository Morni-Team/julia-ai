'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'chat.html'), 'utf8');
const startJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'start.js'), 'utf8');

// Alle Navigations-Bereiche aus den Tab-Knöpfen (data-ansicht="…").
function navBereiche() {
  return [...html.matchAll(/class="nav-punkt"[^>]*data-ansicht="([^"]+)"/g)].map((m) => m[1]);
}
// Die BEREICHE-Zuordnung { name: 'ansichtId' } aus start.js.
function bereicheMap() {
  const m = /const BEREICHE = \{([^}]+)\}/.exec(startJs);
  assert.ok(m, 'BEREICHE nicht gefunden');
  const map = {};
  for (const paar of m[1].split(',')) {
    const p = /([\w]+)\s*:\s*'([^']+)'/.exec(paar);
    if (p) map[p[1]] = p[2];
  }
  return map;
}

test('jeder Navigations-Tab ist in BEREICHE registriert (sonst passiert beim Klick nichts)', () => {
  const map = bereicheMap();
  for (const name of navBereiche()) {
    assert.ok(map[name], `Tab „${name}" fehlt in BEREICHE (start.js) – der Klick würde nichts tun`);
  }
});

test('jeder BEREICH hat einen passenden <section>-Block im HTML', () => {
  const map = bereicheMap();
  for (const [name, id] of Object.entries(map)) {
    assert.ok(html.includes(`id="${id}"`), `Bereich „${name}" → #${id} fehlt als <section> in chat.html`);
  }
});
