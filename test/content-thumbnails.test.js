'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { skinRenderUrl, kategorieFuerKanal, thumbnailKonzeptPrompt, beschreibungKonzeptPrompt, konzeptLesen, mcNameRein, POSEN, KATEGORIEN } = require('../src/main/content/thumbnails');

test('mcNameRein: nur gültige Minecraft-Namen', () => {
  assert.equal(mcNameRein('Moin_Julia'), 'Moin_Julia');
  assert.equal(mcNameRein('bö se!'), '');
  assert.equal(mcNameRein('a'.repeat(20)), '');
  assert.equal(mcNameRein(''), '');
});

test('skinRenderUrl: baut die Starlight-URL, prüft Pose/Crop, leer ohne Name', () => {
  assert.equal(skinRenderUrl('Notch', { pose: 'ultimate', crop: 'full' }),
    'https://starlightskins.lunareclipse.studio/render/ultimate/Notch/full');
  // unbekannte Pose/Crop → sichere Vorgaben
  assert.equal(skinRenderUrl('Notch', { pose: 'quatsch', crop: 'quatsch' }),
    'https://starlightskins.lunareclipse.studio/render/default/Notch/full');
  assert.equal(skinRenderUrl(''), '', 'ohne Namen keine URL (kein Raten)');
  assert.ok(POSEN.includes('ultimate') && POSEN.includes('pointing'));
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

test('konzeptLesen: zieht Headline, Farben und Pose aus dem Modelltext', () => {
  const t = 'TEXT: "RIESIGE VILLA"\nFARBEN: #ff2d2d, #ffd400\nHINTERGRUND: sonnige Minecraft-Landschaft\nSKIN-POSE: ultimate';
  const k = konzeptLesen(t);
  assert.equal(k.headline, 'RIESIGE VILLA');
  assert.deepEqual(k.farben, ['#ff2d2d', '#ffd400']);
  assert.equal(k.pose, 'ultimate');
  // unbekannte Pose fällt weg
  assert.equal(konzeptLesen('SKIN-POSE: quatschpose').pose, '');
});
