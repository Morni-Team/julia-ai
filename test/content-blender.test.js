'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { skinName, skinUrl, serverHost, serverLogoUrl, renderArgs, exePfad, BLENDER_URL } = require('../src/main/content/blender');

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

test('serverHost: nur gueltige Server-Hosts (mit Punkt, optional Port)', () => {
  assert.equal(serverHost('hugosmp.net'), 'hugosmp.net');
  assert.equal(serverHost('Play.HugoSMP.net:25565'), 'play.hugosmp.net:25565');
  assert.equal(serverHost('localhost'), '');   // kein Punkt
  assert.equal(serverHost('a b.net'), '');      // Leerzeichen
  assert.equal(serverHost(''), '');
});

test('serverLogoUrl: echte Icon-URL ueber die Status-API, leer ohne Host', () => {
  assert.equal(serverLogoUrl('hugosmp.net'), 'https://api.mcsrvstat.us/icon/hugosmp.net');
  assert.equal(serverLogoUrl('quatsch'), '');
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
