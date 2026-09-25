'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { skinRenderUrl, kategorieFuerKanal, thumbnailKonzeptPrompt, beschreibungKonzeptPrompt, konzeptLesen, hintergrundPrompt, mcNameRein, POSEN, KATEGORIEN } = require('../src/main/content/thumbnails');

test('mcNameRein: nur gültige Minecraft-Namen', () => {
  assert.equal(mcNameRein('Moin_Julia'), 'Moin_Julia');
  assert.equal(mcNameRein('bö se!'), '');
  assert.equal(mcNameRein('a'.repeat(20)), '');
  assert.equal(mcNameRein(''), '');
});

test('skinRenderUrl: baut die NMSR-URL, prüft die Pose, leer ohne Name', () => {
  assert.equal(skinRenderUrl('Notch', { pose: 'fullbodyiso' }), 'https://nmsr.nickac.dev/fullbodyiso/Notch');
  // unbekannte Pose → sichere Vorgabe fullbody
  assert.equal(skinRenderUrl('Notch', { pose: 'quatsch' }), 'https://nmsr.nickac.dev/fullbody/Notch');
  assert.equal(skinRenderUrl(''), '', 'ohne Namen keine URL (kein Raten)');
  assert.ok(POSEN.includes('fullbody') && POSEN.includes('bust'));
});

test('kategorieFuerKanal: feste Kanal-Kategorie schlägt die Auswahl, sonst Auswahl', () => {
  // Fester Minecraft-Kanal (MoinMornhart) → immer minecraft-gaming, egal was gewählt ist
  const fest = kategorieFuerKanal({ kategorie: 'minecraft-gaming' }, 'reaction');
  assert.equal(fest.kategorie, 'minecraft-gaming');
  assert.equal(fest.festgelegt, true);
  assert.equal(fest.pose, KATEGORIEN['minecraft-gaming'].pose);
  // Freier Kanal (MoinMoni) → Auswahl gilt (Reaction ODER Gaming)
  const wahl = kategorieFuerKanal({ kategorie: '' }, 'reaction');
  assert.equal(wahl.kategorie, 'reaction');
  assert.equal(wahl.festgelegt, false);
  // gar nichts → sinnvoller Fallback
  assert.equal(kategorieFuerKanal({}, '').kategorie, 'gaming');
});

test('thumbnailKonzeptPrompt: fordert echtes Ansehen + Skin-Pose, wenn MC-Name gesetzt', () => {
  const p = thumbnailKonzeptPrompt({ kategorie: 'minecraft-gaming', label: 'Minecraft-Gaming', mcName: 'Julia', titel: 'Krass!', sprache: 'de', frameAnzahl: 6 });
  assert.match(p.system, /ACTUALLY LOOK/);
  assert.match(p.auftrag, /Julia/); // Skin-Hinweis nennt den Namen
  assert.match(p.auftrag, /BESTER FRAME|SKIN-POSE/);
  // Ohne MC-Name kein Skin-Pose-Punkt erzwungen
  const q = thumbnailKonzeptPrompt({ mcName: '', sprache: 'en' });
  assert.match(q.auftrag, /no skin/i);
});

test('beschreibungKonzeptPrompt: fordert festes Label-Format an', () => {
  const p = beschreibungKonzeptPrompt({ beschreibung: 'Ich baue eine riesige Villa', label: 'Minecraft-Gaming', mcName: 'Julia' });
  assert.match(p.system, /TEXT:/);
  assert.match(p.system, /FARBEN:/);
  assert.match(p.system, /SKIN-POSE:/);
  assert.match(p.auftrag, /Villa/);
});

test('konzeptLesen: zieht Headline, Farben und (gültige) Pose aus dem Modelltext', () => {
  const t = 'TEXT: "RIESIGE VILLA"\nFARBEN: #ff2d2d, #ffd400\nHINTERGRUND: sonnige Minecraft-Landschaft\nSKIN-POSE: bust';
  const k = konzeptLesen(t);
  assert.equal(k.headline, 'RIESIGE VILLA');
  assert.deepEqual(k.farben, ['#ff2d2d', '#ffd400']);
  assert.equal(k.pose, 'bust');
  assert.equal(k.hintergrund, 'sonnige Minecraft-Landschaft');
  // Pose außerhalb der NMSR-Modi fällt weg (dann gilt die Kategorie-Pose)
  assert.equal(konzeptLesen('SKIN-POSE: ultimate').pose, '');
});

test('hintergrundPrompt: baut einen Bild-Prompt ohne Text/Figur', () => {
  const p = hintergrundPrompt({ beschreibung: 'riesige Villa', hintergrund: 'sonnige Landschaft', label: 'Minecraft-Gaming' });
  assert.match(p, /Villa/);
  assert.match(p, /Minecraft/);
  assert.match(p, /NO text|no words/i);
});
