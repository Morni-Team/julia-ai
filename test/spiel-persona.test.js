'use strict';

// Julias In-Game-Persönlichkeit (Neben-KI): sie IST Julia selbst, KEIN Assistent,
// Ich-Form, kurz, kein Befehls-Nagging – auf Englisch instruiert (Issue #117/#118).
const test = require('node:test');
const assert = require('node:assert/strict');
const { spielSystem } = require('../src/main/agent');

test('spielSystem: Julia ist sie selbst, kein Assistent (Issue #117)', () => {
  const s = spielSystem({ name: 'Julia', sprachcode: 'de' });
  assert.match(s, /You ARE Julia/);
  assert.match(s, /NOT an assistant/i);
  assert.match(s, /never say you are "Julia's assistant"/i);
  assert.match(s, /Juli/); // sie ist generell „Juli"
  assert.match(s, /first person/i);
  // Kein Befehls-Nagging (Issue #118).
  assert.match(s, /Never tell anyone to type commands/i);
});

test('spielSystem: Antwortsprache richtet sich nach dem Spieler, Instruktion bleibt englisch', () => {
  assert.match(spielSystem({ name: 'Julia', sprachcode: 'de' }), /Answer in German/);
  assert.match(spielSystem({ name: 'Julia', sprachcode: 'en' }), /Answer in English/);
});

test('spielSystem: Kontext wird angehängt, wenn vorhanden', () => {
  assert.match(spielSystem({ name: 'Julia', kontext: 'Leben 10/20' }), /Leben 10\/20/);
  assert.ok(!/your state/i.test(spielSystem({ name: 'Julia' })));
});
