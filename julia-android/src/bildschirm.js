'use strict';

// KI-gesteuerte Handy-Bedienung (Issue #6), tokensparender Kern.
//
// Der Bedienungshilfen-Dienst liefert den Bildschirm als lange, rauschige
// Elementliste (jede View, auch leere Container). Das 1:1 an die KI zu schicken
// wäre teuer. Hier wird die Liste zu einer **kurzen, nummerierten** Auswahl nur
// sinnvoller/bedienbarer Elemente verdichtet und als knapper Text dargestellt.
// Die KI antwortet mit **einem** Kommando aus einer kleinen Grammatik, das hier
// wieder in eine strukturierte Aktion geparst wird. Beides ist reine Logik ohne
// Gerät/Native – dadurch unit-testbar (test/android-bildschirm.test.js).
//
// CommonJS (module.exports), damit sowohl die App (Metro versteht beides) als
// auch die Node-Testsuite am Repo-Wurzel die Datei nutzen können.

// Ein Element ist „interessant", wenn es bedienbar ist oder eine Beschriftung
// trägt. Reine Layout-Container ohne Text/Aktion fallen weg.
function interessant(e) {
  if (!e) return false;
  const label = (e.text || e.desc || '').trim();
  return !!(e.clickable || e.editable || e.scrollable || label);
}

function label(e) {
  return String(e.text || e.desc || '').replace(/\s+/g, ' ').trim();
}

// Rohliste → verdichtete, nummerierte Auswahl. Dubletten (gleiches Label + gleiche
// Rolle) fallen weg, unbeschriftete nur wenn sie bedienbar sind (dann per Koordinate
// ansprechbar). `max` begrenzt die Länge (Standard 40) – neueste/erste zuerst.
function verdichten(elemente, { max = 40 } = {}) {
  const liste = Array.isArray(elemente) ? elemente : [];
  const raus = [];
  const gesehen = new Set();
  for (const e of liste) {
    if (!interessant(e)) continue;
    const lab = label(e);
    if (!lab && !(e.clickable || e.editable || e.scrollable)) continue;
    const rolle = e.editable ? 'eingabe' : e.scrollable ? 'scroll' : e.clickable ? 'klick' : 'text';
    const schluessel = `${rolle}:${lab.toLowerCase()}`;
    if (lab && gesehen.has(schluessel)) continue;
    if (lab) gesehen.add(schluessel);
    raus.push({
      n: raus.length + 1,
      label: lab || '(ohne Text)',
      rolle,
      x: Math.round(e.x || 0),
      y: Math.round(e.y || 0),
      hatText: !!lab,
    });
    if (raus.length >= max) break;
  }
  return raus;
}

// Verdichtete Auswahl → knapper Text für den KI-Prompt (eine Zeile je Element).
function alsText(digest) {
  if (!digest || !digest.length) return '(Bildschirm leer oder nichts Bedienbares erkannt)';
  const mark = { eingabe: '✎', scroll: '↕', klick: '·', text: ' ' };
  return digest
    .map((e) => `${e.n}. [${mark[e.rolle] || ' '}] ${e.label}`)
    .join('\n');
}

// System-Prompt für den Steuer-Modus: die KI sieht Ziel + Bildschirm und
// antwortet mit GENAU EINEM Kommando. Bewusst knapp (spart Tokens).
function steuerPrompt({ sprachcode = 'de' } = {}) {
  if (sprachcode === 'en') {
    return [
      'You control an Android phone via its accessibility service. You are shown the current screen as a numbered list of elements. Reply with EXACTLY ONE command and nothing else:',
      'TAP <n> — tap element n',
      'TYPE <n> "text" — type text into element n (an input field)',
      'SCROLL down | SCROLL up',
      'BACK | HOME | RECENTS',
      'DONE "short message" — the goal is reached (or cannot be done); explain briefly',
      'Pick the single best next step toward the goal. Never invent element numbers that are not listed. If unsure or stuck, use DONE.',
    ].join('\n');
  }
  return [
    'Du steuerst ein Android-Handy über den Bedienungshilfen-Dienst. Du siehst den aktuellen Bildschirm als nummerierte Elementliste. Antworte mit GENAU EINEM Kommando und sonst nichts:',
    'KLICK <n> — Element n antippen',
    'TIPPE <n> "text" — Text in Element n (Eingabefeld) schreiben',
    'SCROLL runter | SCROLL hoch',
    'ZURUECK | START | APPS',
    'FERTIG "kurze Nachricht" — Ziel erreicht (oder nicht machbar); kurz erklären',
    'Wähle den einen besten nächsten Schritt zum Ziel. Erfinde nie Elementnummern, die nicht gelistet sind. Bist du unsicher oder steckst fest, nimm FERTIG.',
  ].join('\n');
}

// KI-Antwort → strukturierte Aktion. Tolerant (Groß/klein, Umlaut-Varianten,
// führendes Geschwätz vor dem Kommando). Unbekannt → { art:'unbekannt' }.
function aktionLesen(text) {
  const roh = String(text || '').trim();
  if (!roh) return { art: 'unbekannt', roh };
  // Erste Zeile, die wie ein Kommando aussieht (falls die KI davor plaudert).
  const zeilen = roh.split('\n').map((z) => z.trim()).filter(Boolean);
  const zeile = zeilen.find((z) => /^(klick|tippe|scroll|zur(ue|ü)ck|start|apps|fertig|tap|type|back|home|recents|done)\b/i.test(z)) || roh;
  const l = zeile.trim();
  const zitat = (l.match(/"([^"]*)"/) || l.match(/'([^']*)'/) || [])[1];

  let m;
  if ((m = l.match(/^(?:klick|tap)\s+(\d+)/i))) return { art: 'klick', n: Number(m[1]) };
  if ((m = l.match(/^(?:tippe|type)\s+(\d+)/i))) return { art: 'tippe', n: Number(m[1]), text: zitat || '' };
  if (/^(?:tippe|type)\b/i.test(l)) return { art: 'tippe', n: null, text: zitat || '' };
  if (/^scroll\b/i.test(l)) {
    const hoch = /(hoch|up|oben)/i.test(l);
    return { art: 'scroll', vorwaerts: !hoch };
  }
  if (/^(?:zur(ue|ü)ck|back)\b/i.test(l)) return { art: 'zurueck' };
  if (/^(?:start|home)\b/i.test(l)) return { art: 'start' };
  if (/^(?:apps|recents)\b/i.test(l)) return { art: 'apps' };
  if (/^(?:fertig|done)\b/i.test(l)) return { art: 'fertig', text: zitat || l.replace(/^(fertig|done)\s*/i, '').trim() };
  return { art: 'unbekannt', roh: l };
}

// Kurze, menschenlesbare Beschreibung einer Aktion (für den Freigabe-Dialog).
function aktionText(aktion, digest) {
  const e = aktion && aktion.n && digest ? digest.find((d) => d.n === aktion.n) : null;
  const ziel = e ? `„${e.label}"` : (aktion && aktion.n ? `Element ${aktion.n}` : '');
  switch (aktion && aktion.art) {
    case 'klick': return `Antippen: ${ziel}`;
    case 'tippe': return `Schreiben${ziel ? ` in ${ziel}` : ''}: „${aktion.text}"`;
    case 'scroll': return aktion.vorwaerts ? 'Nach unten scrollen' : 'Nach oben scrollen';
    case 'zurueck': return 'Zurück';
    case 'start': return 'Startseite';
    case 'apps': return 'Letzte Apps';
    case 'fertig': return `Fertig: ${aktion.text || ''}`;
    default: return 'Unbekannte Aktion';
  }
}

module.exports = { interessant, label, verdichten, alsText, steuerPrompt, aktionLesen, aktionText };
