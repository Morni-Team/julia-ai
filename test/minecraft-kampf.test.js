'use strict';

// Tests für die Kampf-/Überlebens-Verbesserungen (Issue #93): Rückzug bei
// Unterlegenheit, sparsame Wahl der seltenen Heilung, Rüstungs-Craft-Plan.
const test = require('node:test');
const assert = require('node:assert/strict');
const { rueckzugPlan, heilWahl, ruestungCraftPlan } = require('../src/main/minecraft');

test('rueckzugPlan: sehr wenig Leben → heilen wenn möglich, sonst fliehen', () => {
  assert.equal(rueckzugPlan({ health: 5, feinde: 1, hatHeilung: true }), 'heilen');
  assert.equal(rueckzugPlan({ health: 5, feinde: 1, hatHeilung: false }), 'rueckzug');
});

test('rueckzugPlan: in Unterzahl und angeschlagen → zurückziehen', () => {
  assert.equal(rueckzugPlan({ health: 12, feinde: 3, hatHeilung: false }), 'rueckzug');
  assert.equal(rueckzugPlan({ health: 13, feinde: 4, hatHeilung: true }), 'rueckzug');
});

test('rueckzugPlan: knappes Leben mit Heilung → heilen; sonst kämpfen', () => {
  assert.equal(rueckzugPlan({ health: 8, feinde: 1, hatHeilung: true }), 'heilen');
  assert.equal(rueckzugPlan({ health: 8, feinde: 1, hatHeilung: false }), 'kaempfen');
  assert.equal(rueckzugPlan({ health: 20, feinde: 2, hatHeilung: true }), 'kaempfen');
});

test('heilWahl: verzauberten Goldapfel für den Notfall sparen', () => {
  // genug Leben: normaler Goldapfel, obwohl ein verzauberter da ist
  assert.equal(heilWahl({ golden_apple: 2, enchanted_golden_apple: 1 }, 8), 'golden_apple');
  // sehr wenig Leben: den verzauberten nehmen
  assert.equal(heilWahl({ golden_apple: 2, enchanted_golden_apple: 1 }, 5), 'enchanted_golden_apple');
  // nur der verzauberte da: dann eben den (auch bei mehr Leben)
  assert.equal(heilWahl({ golden_apple: 0, enchanted_golden_apple: 1 }, 8), 'enchanted_golden_apple');
  // nichts da
  assert.equal(heilWahl({ golden_apple: 0, enchanted_golden_apple: 0 }, 5), null);
});

test('ruestungCraftPlan: beste erreichbare Stufe pro Teil, Material wird abgezogen', () => {
  // Genug Eisen für alle vier Teile (5+8+7+4 = 24), nichts getragen
  const plan = ruestungCraftPlan({ iron_ingot: 24 }, {});
  assert.deepEqual(plan.map((p) => p.item).sort(), ['iron_boots', 'iron_chestplate', 'iron_helmet', 'iron_leggings']);
});

test('ruestungCraftPlan: knappes Material landet bei den teuren Teilen zuerst', () => {
  // Nur 8 Eisen: reicht genau für den Brustpanzer (teuerstes Teil zuerst)
  const plan = ruestungCraftPlan({ iron_ingot: 8 }, {});
  assert.equal(plan.length, 1);
  assert.equal(plan[0].item, 'iron_chestplate');
});

test('ruestungCraftPlan: nur bessere Stufe als getragen wird geplant', () => {
  // Trägt schon Diamant-Brust; mit Eisen wird die Brust NICHT „verschlechtert"
  const plan = ruestungCraftPlan({ iron_ingot: 24 }, { chestplate: 'diamond' });
  assert.ok(!plan.some((p) => p.slot === 'chestplate'));
  assert.ok(plan.some((p) => p.item === 'iron_helmet'));
});

test('ruestungCraftPlan: mischt Stufen nach Vorrat (Diamant für ein Teil, Eisen für den Rest)', () => {
  // 8 Diamant → Brustpanzer aus Diamant; Rest aus Eisen
  const plan = ruestungCraftPlan({ diamond: 8, iron_ingot: 16 }, {});
  const brust = plan.find((p) => p.slot === 'chestplate');
  assert.equal(brust.item, 'diamond_chestplate');
  assert.ok(plan.some((p) => p.item === 'iron_helmet'));
});

test('ruestungCraftPlan: nichts craftbar → leerer Plan', () => {
  assert.deepEqual(ruestungCraftPlan({}, {}), []);
});
