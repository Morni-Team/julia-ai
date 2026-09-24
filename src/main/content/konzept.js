'use strict';

const { schnittplanBereinigen } = require('./schnittplan');

// Content-Creation-Modul – KONZEPT: aus Transkript + Creator-Profil + Stilprofil
// baut Julia (per Claude) einen Schnittplan. HIER liegt die REINE Logik: den
// Prompt zusammenbauen und die JSON-Antwort des Modells robust herauslösen. Der
// eigentliche Modell-Aufruf ist IO und passiert in der Pipeline.
//
// Bewusst ENGLISCHER System-Prompt (das Modell befolgt ihn zuverlässiger); die
// Inhalte (Titel/Untertitel) kommen in der Sprache des Creator-Profils. Nur TEXT
// geht an die KI – nie Mediendateien. Fremde Assets/Namen/Logos werden nie kopiert;
// ein Stil wird nur ABSTRAKT über die Stil-Parameter nachgebildet.

const text = (v, max = 4000) => String(v == null ? '' : v).replace(/\u0000/g, '').slice(0, max);

function profilKurz(profil = {}) {
  const m = profil.marke || {};
  const teile = [
    `channel: ${profil.kanalname || '—'}`,
    profil.zielgruppe ? `audience: ${profil.zielgruppe}` : '',
    profil.tonalitaet ? `tone: ${profil.tonalitaet}` : '',
    m.farben && m.farben.length ? `brand colors: ${m.farben.join(', ')}` : '',
    m.schriften && m.schriften.length ? `fonts: ${m.schriften.join(', ')}` : '',
    (profil.regeln && profil.regeln.length) ? `HARD RULES (always): ${profil.regeln.join(' | ')}` : '',
  ].filter(Boolean);
  return teile.join('\n');
}

function stilKurz(stil = {}) {
  return [
    `cuts/min ~${stil.schnitte_pro_min ?? 14}`,
    `hook ~${stil.hook_sekunden ?? 8}s`,
    `jumpcuts: ${stil.jumpcut_haeufigkeit || 'mittel'}`,
    `zoom: ${stil.zoom_haeufigkeit || 'mittel'}`,
    `subtitles: ${stil.untertitel_stil || 'wort-fuer-wort'}`,
    `b-roll share ~${Math.round((stil.broll_anteil ?? 0.3) * 100)}%`,
    `music dynamics: ${stil.musikdynamik || 'mittel'}`,
    `animation density: ${stil.animationsdichte || 'mittel'}`,
  ].join(', ');
}

// Baut { system, user } für den Modell-Aufruf. `transkript` sind die (evtl. bereits
// abschnittsweise vorbereiteten) Segmente [{ von_s, bis_s, quelle, text }].
function konzeptPrompt({ profil = {}, stil = {}, transkript = [], briefing = '', ziellaenge_s = 0 } = {}) {
  const sprache = profil.sprache === 'en' ? 'English' : 'German';
  const system = [
    'You are a top-tier YouTube video editor. From the raw transcript you design a tight, high-retention edit:',
    'a strong hook (first 5–10 s using the strongest moment), clear structure/chapters, pacing and jumpcuts on dead air,',
    'captions, b-roll, music and SFX cues. Follow the creator profile and the style profile exactly.',
    'Reproduce a style ONLY abstractly via the style parameters — never copy other creators\' assets, names, logos or wording.',
    `Write all titles and on-screen/caption text in ${sprache}.`,
    'Respect every HARD RULE. Cut only from the given sources and their timestamps; never invent footage.',
    'Output ONLY one valid JSON object (a "Schnittplan"), no prose, no code fences. Shape:',
    '{ "version", "projekt", "ziellaenge_s", "stilprofil", "titelvorschlaege":[…3…], "hook":{ "von_s","bis_s","quelle_clip","quelle_von_s","begruendung" }, "kapitel":[{"titel","von_s","bis_s"}], "clips":[{ "id","quelle","in_s","out_s","spur","uebergang","zoom":{"start","ende"},"untertitel":[{"t","von_s","bis_s"}],"begruendung" }], "musik":[{"datei","von_s","bis_s","ducking"}], "sfx":[{"datei","bei_s"}], "animationen":[{"vorlage","platzhalter":{},"von_s","bis_s"}], "broll":[{"quelle","von_s","bis_s"}] }',
    'Every clip needs a source id and out_s > in_s. Give a short "begruendung" (reason) for each important cut.',
  ].join(' ');

  const segZeilen = (Array.isArray(transkript) ? transkript : [])
    .map((s) => `[${s.quelle || 'A'} ${Math.round(s.von_s || 0)}-${Math.round(s.bis_s || 0)}s] ${text(s.text, 500)}`)
    .join('\n');

  const user = [
    'CREATOR PROFILE:',
    profilKurz(profil),
    '',
    `STYLE PROFILE: ${stilKurz(stil)}`,
    ziellaenge_s ? `TARGET LENGTH: ~${Math.round(ziellaenge_s)} s` : '',
    briefing ? `BRIEFING: ${text(briefing, 2000)}` : '',
    '',
    'TRANSCRIPT (source, timestamps in seconds):',
    segZeilen || '(no transcript – build from briefing only)',
    '',
    'Return the Schnittplan JSON now.',
  ].filter((z) => z !== '').join('\n');

  return { system, user };
}

// Löst aus einer Modell-Antwort das JSON heraus (auch wenn Codefences/Text drumrum
// stehen) und bereinigt es zu einem gültigen Schnittplan. Wirft bei Unbrauchbarem.
function planAusAntwort(antwort) {
  const roh = String(antwort || '');
  // Codefence bevorzugen, sonst die erste bis letzte geschweifte Klammer.
  let kandidat = null;
  const fence = roh.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) kandidat = fence[1];
  if (!kandidat) {
    const von = roh.indexOf('{');
    const bis = roh.lastIndexOf('}');
    if (von >= 0 && bis > von) kandidat = roh.slice(von, bis + 1);
  }
  if (!kandidat) throw new Error('Die Antwort enthielt keinen Schnittplan (kein JSON gefunden).');
  let obj;
  try { obj = JSON.parse(kandidat); } catch { throw new Error('Der Schnittplan war kein gültiges JSON.'); }
  const plan = schnittplanBereinigen(obj);
  if (!plan.clips.length) throw new Error('Der Schnittplan hatte keine verwertbaren Clips.');
  return plan;
}

module.exports = { konzeptPrompt, planAusAntwort, profilKurz, stilKurz };
