'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { analysePrompt, wortzahl } = require('../src/main/content/analyse-video');

test('analysePrompt: Video-Modus nutzt das Transkript und bittet um Coach-Feedback', () => {
  const { system, user } = analysePrompt({ art: 'video', transkript: 'Hallo, heute zeige ich euch …', titel: 'Mein Video', sprache: 'de' });
  assert.match(system, /YouTube growth coach/i);
  assert.match(system, /German/);
  assert.match(user, /VIDEO/);
  assert.match(user, /TRANSKRIPT/);
  assert.match(user, /Hallo, heute zeige/);
  assert.match(user, /Mein Video/);
});

test('analysePrompt: Kanal-Modus nutzt die Kanal-Infos', () => {
  const { user } = analysePrompt({ art: 'kanal', kanalInfos: 'Video 1: 10k Aufrufe …', sprache: 'de' });
  assert.match(user, /KANAL/);
  assert.match(user, /Video 1: 10k/);
});

test('analysePrompt: englische Zielsprache', () => {
  const { system } = analysePrompt({ art: 'video', sprache: 'en' });
  assert.match(system, /Answer in English/);
});

test('analysePrompt: leeres Transkript → klarer Hinweis statt Absturz', () => {
  const { user } = analysePrompt({ art: 'video', transkript: '' });
  assert.match(user, /kein Transkript/);
});

test('wortzahl', () => {
  assert.equal(wortzahl('eins zwei drei'), 3);
  assert.equal(wortzahl('   '), 0);
  assert.equal(wortzahl(''), 0);
});
