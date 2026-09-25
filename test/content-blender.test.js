'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { skinName, skinUrl, renderArgs, exePfad, BLENDER_URL } = require('../src/main/content/blender');

test('skinName: nur gueltige Minecraft-Namen', () => {
  assert.equal(skinName('MoinMornhart'), 'MoinMornhart');
  assert.equal(skinName('bö se'), '');
  assert.equal(skinName('a'.repeat(20)), '');
  assert.equal(skinName(''), '');
});

test('skinUrl: rohe Textur ueber den Namen, leer ohne Namen', () => {
  assert.equal(skinUrl('Notch'), 'https://minotar.net/skin/Notch');
  assert.equal(skinUrl('!!'), '');
});

test('renderArgs: baut die Blender-CLI-Argumente korrekt', () => {
  const a = renderArgs({ skript: 'r.py', skins: ['a.png', 'b.png'], poses: ['bereit', 'walk'], items: ['sword', 'none'], itemdir: 'd', out: 'o.png' });
  assert.deepEqual(a.slice(0, 4), ['-b', '-P', 'r.py', '--']);
  assert.ok(a.includes('skins=a.png;b.png'));
  assert.ok(a.includes('poses=bereit;walk'));
  assert.ok(a.includes('items=sword;none'));
  assert.ok(a.includes('itemdir=d'));
  assert.ok(a.includes('out=o.png'));
  assert.ok(a.some((x) => x.startsWith('samples=')));
});

test('exePfad: liegt unter dem Datenordner/blender', () => {
  const p = exePfad(path.join('D:', 'daten'));
  assert.ok(p.includes(path.join('daten', 'blender')));
  assert.ok(/blender\.exe$/.test(p));
});

test('BLENDER_URL zeigt auf das offizielle Blender-Release', () => {
  assert.ok(/^https:\/\/download\.blender\.org\/release\/.*windows-x64\.zip$/.test(BLENDER_URL));
});
