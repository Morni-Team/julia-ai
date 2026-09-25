'use strict';

// Regression: Im Claude-Code-Modus warfen die Einmal-Aufrufe („Ein Einmal-Aufruf
// ist im Claude-Code-Modus nicht verfügbar"), sodass z. B. das Content-Thumbnail
// „Aus Beschreibung" scheiterte. `einmalAntwort` läuft jetzt über den Abo-Einmal-
// aufruf (frische claude.exe-Sitzung, ohne Werkzeuge); `bildAntwort` meldet klar,
// dass im Abo keine Bilder gehen.
const test = require('node:test');
const assert = require('node:assert/strict');
const { Agent } = require('../src/main/agent');

function agentClaudeCode() {
  const werte = { anbieter: 'claude-abo', modell: 'sonnet', sprachcode: 'de', aufwand: 'medium' };
  return new Agent({
    config: { get: (k) => werte[k] },
    ctx: { datenOrdner: '.' },
    apiSchluessel: () => '',
    systemPrompt: () => 'S',
    laufzeitKontext: () => '',
    holen: async () => ({}),
    claudeCodeExe: () => 'C:/claude.exe',
  });
}

test('einmalAntwort wirft im Claude-Code-Modus NICHT mehr, sondern nutzt den Abo-Einmalaufruf', async () => {
  const agent = agentClaudeCode();
  let gesehen = null;
  agent._aboEinmal = async ({ system, text }) => { gesehen = { system, text }; return 'KONZEPT'; };
  const r = await agent.einmalAntwort({ system: 'SYS', text: 'Beschreibe ein Thumbnail' });
  assert.equal(r, 'KONZEPT');
  assert.deepEqual(gesehen, { system: 'SYS', text: 'Beschreibe ein Thumbnail' });
});

test('bildAntwort meldet im Claude-Code-Modus klar, dass keine Bilder gehen (Verweis auf „Aus Beschreibung")', async () => {
  const agent = agentClaudeCode();
  await assert.rejects(
    () => agent.bildAntwort({ system: 'S', text: 'T', bilder: ['data:image/png;base64,QUJD'] }),
    /Aus Beschreibung|keine Bilder/,
  );
});
