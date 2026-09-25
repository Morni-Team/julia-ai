'use strict';

// Content-Modul – Reiter 3: THUMBNAILS (Nutzerwunsch).
// Julia sieht sich das Video WIRKLICH an (mehrere Frames gehen an ein Vision-Modell)
// und schlägt ein starkes Thumbnail vor; der Minecraft-Skin des Nutzers wird per
// Skin-Render-Dienst (aus dem Spielernamen) geholt und cinematisch einkomponiert.
// HIER ist die REINE Logik: Skin-URL bauen, Kategorie je Kanal bestimmen und den
// Vision-Analyse-Prompt formulieren. Netz/FFmpeg/Compositing sind IO (main/renderer).

// Bekannte Render-Posen der Starlight-Skins-API (frei, cinematisch). Quelle:
// starlightskins.lunareclipse.studio – Endpunkt /render/{pose}/{name}/{crop}.
const POSEN = [
  'default', 'marching', 'walking', 'crouching', 'crossed', 'criss_cross', 'cheering',
  'relaxing', 'trudging', 'cowering', 'pointing', 'lunging', 'dungeons', 'facepalm',
  'sleeping', 'dead', 'archer', 'mojavatar', 'ultimate', 'isometric', 'head',
];
const CROPS = ['full', 'bust', 'face'];
const SKIN_BASIS = 'https://starlightskins.lunareclipse.studio/render';

// Kategorien und die dazu passenden, wirkungsvollen Standard-Posen fürs Thumbnail.
const KATEGORIEN = {
  'minecraft-gaming': { label: 'Minecraft-Gaming', pose: 'ultimate', crop: 'full' },
  gaming: { label: 'Gaming', pose: 'marching', crop: 'full' },
  reaction: { label: 'Reaction', pose: 'pointing', crop: 'bust' },
};

// Ein gültiger Minecraft-Name (3–16 Zeichen, Buchstaben/Ziffern/_). Sonst leer.
function mcNameRein(v) {
  const s = String(v == null ? '' : v).trim();
  return /^[A-Za-z0-9_]{1,16}$/.test(s) ? s : '';
}

// Baut die Skin-Render-URL aus dem Spielernamen. Ohne gültigen Namen: leer (kein
// Zugriff, kein Raten). Pose/Crop werden gegen die bekannten Werte geprüft.
function skinRenderUrl(mcName, { pose = 'default', crop = 'full' } = {}) {
  const name = mcNameRein(mcName);
  if (!name) return '';
  const p = POSEN.includes(String(pose)) ? String(pose) : 'default';
  const c = CROPS.includes(String(crop)) ? String(crop) : 'full';
  return `${SKIN_BASIS}/${p}/${encodeURIComponent(name)}/${c}`;
}

// Welche Kategorie gilt für diesen Kanal? Hat das Profil eine FESTE Kategorie
// (z. B. ein reiner Minecraft-Kanal), gilt die immer; sonst die Auswahl des Nutzers
// (z. B. bei einem Reaction/Gaming-Kanal). Liefert Kategorie-Schlüssel + Pose/Crop.
function kategorieFuerKanal(profil = {}, wahl = '') {
  const fest = String((profil && profil.kategorie) || '');
  const gewaehlt = String(wahl || '');
  const key = (KATEGORIEN[fest] ? fest : (KATEGORIEN[gewaehlt] ? gewaehlt : 'gaming'));
  const k = KATEGORIEN[key];
  return { kategorie: key, label: k.label, pose: k.pose, crop: k.crop, festgelegt: !!KATEGORIEN[fest] };
}

// Kompakte, in den Prompt eingebettete Thumbnail-Best-Practices (recherchiert):
// hoher Kontrast, EIN klares Motiv, großes ausdrucksstarkes Gesicht/Figur, 3–5
// Wörter fetter Text mit dickem Rand, satte Farben, Drittel-Regel, kein Gewusel,
// lesbar auch klein (Handy). Bewusst auf Englisch (Modelle folgen dem zuverlässiger).
const THUMB_REGELN = [
  'ONE clear subject, framed by the rule of thirds; strong focal point, no clutter.',
  'High contrast and saturated, punchy colors; a bright rim/glow to separate subject from background.',
  'Large, expressive facial/character emotion (surprise, hype, focus) — the emotion sells the click.',
  'At most 3–5 words of BOLD text with a thick outline/shadow, huge and readable on a phone.',
  'Leave room for the character (usually one side) and the text (the other side); balanced composition.',
  'Consistent channel branding (colors/style); avoid tiny details that vanish at small sizes.',
  '16:9, 1280×720. It must read in under a second as a thumbnail.',
];

// Baut den Vision-Analyse-Prompt: Julia SIEHT die Frames an und wählt den besten
// Moment + schlägt ein konkretes Thumbnail-Konzept vor (Text, Farben, Aufbau,
// Skin-Pose). frameAnzahl = wie viele Standbilder mitgeschickt werden.
function thumbnailKonzeptPrompt({ kategorie = 'gaming', label = 'Gaming', mcName = '', titel = '', sprache = 'de', frameAnzahl = 6 } = {}) {
  const de = sprache !== 'en';
  const skinHinweis = mcName
    ? (de ? `Der Skin des Creators (Minecraft-Name "${mcName}") wird separat als cinematische Render-Figur einkomponiert – plane einen Platz dafür ein und schlage eine passende Pose vor (z. B. ultimate, marching, pointing).`
      : `The creator's skin (Minecraft name "${mcName}") is composited separately as a cinematic render — leave room for it and suggest a fitting pose (e.g. ultimate, marching, pointing).`)
    : (de ? 'Es ist kein Minecraft-Name gesetzt (keine Skin-Figur).' : 'No Minecraft name is set (no skin figure).');

  const system = [
    'You are a top-tier YouTube thumbnail director. You are shown several still frames sampled from a real video.',
    `Category: ${label}. ${de ? 'Antworte auf Deutsch.' : 'Answer in English.'}`,
    'You must ACTUALLY LOOK at the frames (facial expressions, action, colors, composition) — not guess from a title.',
    'Great-thumbnail rules:',
    ...THUMB_REGELN.map((r) => `- ${r}`),
  ].join('\n');

  const auftrag = de
    ? [
      `Sieh dir die ${frameAnzahl} Standbilder an${titel ? ` (Video-Titel: "${titel}")` : ''}.`,
      skinHinweis,
      'Gib mir GENAU das zurück (kurz, umsetzbar):',
      '1) BESTER FRAME: die Nummer des stärksten Standbilds als Hintergrund + 1 Satz warum.',
      '2) TEXT: 3–5 Wörter, die zum Klicken verleiten (nur der Text, in Großbuchstaben).',
      '3) FARBEN: 2–3 knallige Farben (Hex), die zur Kategorie/zum Bild passen.',
      '4) AUFBAU: wo Figur, wo Text, welcher Blickfang (ein Satz).',
      mcName ? '5) SKIN-POSE: eine der Posen (default, marching, ultimate, cheering, pointing, lunging, archer, facepalm).' : '5) (kein Skin) – lass diesen Punkt weg.',
    ].join('\n')
    : [
      `Look at the ${frameAnzahl} still frames${titel ? ` (video title: "${titel}")` : ''}.`,
      skinHinweis,
      'Return EXACTLY this (short, actionable):',
      '1) BEST FRAME: the number of the strongest still as background + 1 sentence why.',
      '2) TEXT: 3–5 clickworthy words (text only, UPPERCASE).',
      '3) COLORS: 2–3 punchy colors (hex) fitting the category/image.',
      '4) LAYOUT: where the figure, where the text, the focal point (one sentence).',
      mcName ? '5) SKIN POSE: one of (default, marching, ultimate, cheering, pointing, lunging, archer, facepalm).' : '5) (no skin) — omit this point.',
    ].join('\n');

  return { system, auftrag };
}

module.exports = { POSEN, CROPS, KATEGORIEN, SKIN_BASIS, mcNameRein, skinRenderUrl, kategorieFuerKanal, thumbnailKonzeptPrompt, THUMB_REGELN };
