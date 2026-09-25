'use strict';

// Content-Creation-Modul – die EINFACHE Variante (Nutzerwunsch): Julia schaut sich
// ein hochgeladenes Video (bzw. dessen Transkript) oder die Infos eines YouTube-
// Kanals an und gibt **Creator-Feedback wie ein YouTube-Coach** – Hook, Tempo,
// Retention, Struktur, Titel-/Thumbnail-Ideen und konkrete Verbesserungen.
//
// REINE Logik: baut den Prompt (System+User). Der Modell-Aufruf ist IO und läuft
// über agent.einmalAntwort; das Transkribieren eines Videos über Whisper (sprache.js).
// Nur TEXT geht an die KI – nie Mediendateien.

const text = (v, max = 16000) => String(v == null ? '' : v).replace(/\u0000/g, '').trim().slice(0, max);

// art: 'video' (Transkript eines hochgeladenen Videos) oder 'kanal' (Kanal-/Video-
// Infos, die der Nutzer einfügt: Titel, Beschreibungen, Aufrufe …).
function analysePrompt({ art = 'video', transkript = '', kanalInfos = '', titel = '', notizen = '', sprache = 'de' } = {}) {
  const zielsprache = sprache === 'en' ? 'English' : 'German';
  const system = [
    'You are an experienced YouTube growth coach and editor. Analyze the given material honestly and concretely,',
    'like feedback to a creator. Cover: the hook (first 5–15 s), pacing/retention, structure, clarity, energy,',
    'title ideas (3), thumbnail ideas (3, describable in words), and the 3 most impactful concrete improvements.',
    'Be specific and reference moments/quotes where possible. No fluff, no empty praise, no generic checklists.',
    'Do not invent facts that are not in the material. Never copy other creators\' assets/names – talk about style abstractly.',
    `Answer in ${zielsprache}, well structured with short headings and bullet points.`,
  ].join(' ');

  const teile = [];
  if (titel) teile.push(`TITEL/THEMA: ${text(titel, 300)}`);
  if (art === 'kanal') {
    teile.push('AUFGABE: Analysiere diesen YouTube-KANAL (anhand der folgenden Infos) und gib eine Einschätzung + Wachstums-Tipps.');
    teile.push(`KANAL-INFOS (vom Nutzer eingefügt: Titel, Beschreibungen, Aufrufe, Themen …):\n${text(kanalInfos)}`);
  } else {
    teile.push('AUFGABE: Analysiere dieses VIDEO anhand seines Transkripts und gib Schnitt-/Retention-Feedback.');
    teile.push(`TRANSKRIPT:\n${text(transkript) || '(kein Transkript – bitte auf Basis der Notizen einschätzen)'}`);
  }
  if (notizen) teile.push(`NOTIZEN/ZIEL DES NUTZERS: ${text(notizen, 1000)}`);
  teile.push('Gib jetzt die Analyse aus.');

  return { system, user: teile.join('\n\n') };
}

// Grobe Wortzahl eines Transkripts (für den Hinweis „reicht für ~X Min Redezeit").
function wortzahl(transkript) {
  const w = String(transkript || '').trim();
  return w ? w.split(/\s+/).length : 0;
}

module.exports = { analysePrompt, wortzahl };
