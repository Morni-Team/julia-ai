'use strict';

const { ffmpegRohschnitt } = require('./rohschnitt');

// Content-Creation-Modul – automatischer ROHSCHNITT (Jump-Cut) per FFmpeg, ohne
// Adobe. Ablauf: FFmpeg findet mit `silencedetect` die Stillen, wir bilden daraus
// die „Behalten"-Segmente (die geredeten Teile) und schneiden sie mit FFmpeg
// zusammen. HIER ist die REINE Logik (Log parsen, Segmente rechnen, Befehl bauen);
// das eigentliche Ausführen ist IO und passiert in der Pipeline/IPC.

const r3 = (x) => Math.round((Number(x) || 0) * 1000) / 1000;

// Der FFmpeg-Analyse-Befehl: findet Stillen und gibt die Dauer aus (nur Analyse,
// schreibt nichts). noise = Lautstärke-Schwelle in dB, d = Mindest-Stille in s.
function stilleAnalyseBefehl(videoPfad, { noiseDb = -30, minStilleS = 0.5 } = {}) {
  return { programm: 'ffmpeg', args: ['-hide_banner', '-i', videoPfad, '-af', `silencedetect=noise=${noiseDb}dB:d=${minStilleS}`, '-f', 'null', '-'] };
}

// Parst die `silencedetect`-Zeilen aus der FFmpeg-Ausgabe → [{von_s, bis_s}].
function stillenAusLog(text) {
  const zeilen = String(text || '').split(/\r?\n/);
  const stillen = [];
  let start = null;
  for (const z of zeilen) {
    let m = z.match(/silence_start:\s*(-?[\d.]+)/);
    if (m) { start = Math.max(0, parseFloat(m[1])); continue; }
    m = z.match(/silence_end:\s*(-?[\d.]+)/);
    if (m && start != null) { stillen.push({ von_s: start, bis_s: parseFloat(m[1]) }); start = null; }
  }
  return stillen;
}

// Gesamtdauer aus der `Duration: HH:MM:SS.xx`-Zeile (Sekunden), 0 wenn unbekannt.
function dauerAusLog(text) {
  const m = String(text || '').match(/Duration:\s*(\d+):(\d\d):(\d\d(?:\.\d+)?)/);
  if (!m) return 0;
  return r3((+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]));
}

// Die zu BEHALTENDEN Segmente = alles zwischen den Stillen, mit etwas Rand, damit
// Wortanfänge/-enden nicht abgeschnitten werden. Zu kurze Schnipsel fallen raus.
function behaltSegmente(stillen, gesamtdauer, { randS = 0.08, minLen = 0.4 } = {}) {
  const dauer = Number(gesamtdauer) || 0;
  const sortiert = [...(stillen || [])].filter((s) => s && s.bis_s > s.von_s).sort((a, b) => a.von_s - b.von_s);
  const seg = [];
  let cursor = 0;
  for (const s of sortiert) {
    const bis = Math.min(dauer || s.von_s + randS, s.von_s + randS);
    if (bis - cursor >= minLen) seg.push({ von_s: r3(Math.max(0, cursor)), bis_s: r3(bis) });
    cursor = Math.max(cursor, s.bis_s - randS);
  }
  if (dauer && dauer - cursor >= minLen) seg.push({ von_s: r3(Math.max(0, cursor)), bis_s: r3(dauer) });
  return seg;
}

// Baut aus Behalten-Segmenten den FFmpeg-Schneide-Befehl (trim+concat einer Quelle).
function rohschnittBefehl(videoPfad, segmente, ziel) {
  const clips = (segmente || []).map((s, i) => ({ id: `c${i + 1}`, quelle: 'V', in_s: s.von_s, out_s: s.bis_s }));
  return ffmpegRohschnitt({ clips }, { quellen: { V: videoPfad }, ziel });
}

// Kandidaten für kurze Hoch-Clips (TikTok/YouTube Shorts): die längsten geredeten
// Stücke als Highlights, je auf max. `maxS` gekürzt, zu kurze raus. Reine Auswahl.
function shortsAuswahl(segmente, { anzahl = 3, minS = 12, maxS = 60 } = {}) {
  return [...(segmente || [])]
    .map((s) => ({ von_s: s.von_s, bis_s: s.bis_s, laenge: (s.bis_s || 0) - (s.von_s || 0) }))
    .filter((s) => s.laenge >= minS)
    .sort((a, b) => b.laenge - a.laenge)
    .slice(0, Math.max(0, anzahl))
    .map((s) => ({ von_s: r3(s.von_s), bis_s: r3(Math.min(s.bis_s, s.von_s + maxS)) }))
    .sort((a, b) => a.von_s - b.von_s);
}

// FFmpeg-Befehl für einen 9:16-Hoch-Clip (Standard 1080×1920) aus einem Fenster:
// mittig auf 9:16 beschneiden, dann skalieren. Ton als AAC.
function shortsBefehl(videoPfad, { von_s = 0, bis_s = 0, ziel, breite = 1080, hoehe = 1920 } = {}) {
  if (!videoPfad) throw new Error('Kein Video.');
  if (!ziel) throw new Error('Kein Ziel-Pfad.');
  const dauer = r3(Math.max(0.2, (Number(bis_s) || 0) - (Number(von_s) || 0)));
  const vf = `crop=ih*9/16:ih,scale=${breite}:${hoehe}`;
  return { programm: 'ffmpeg', args: ['-y', '-ss', String(r3(von_s)), '-i', videoPfad, '-t', String(dauer), '-vf', vf, '-c:a', 'aac', ziel] };
}

// FFmpeg-Befehl für ein Thumbnail-Standbild (Standard 1280×720) an einem Zeitpunkt.
function thumbnailBefehl(videoPfad, { bei_s = 0, ziel, breite = 1280, hoehe = 720 } = {}) {
  if (!videoPfad) throw new Error('Kein Video.');
  if (!ziel) throw new Error('Kein Ziel-Pfad.');
  const vf = `scale=${breite}:${hoehe}:force_original_aspect_ratio=increase,crop=${breite}:${hoehe}`;
  return { programm: 'ffmpeg', args: ['-y', '-ss', String(r3(bei_s)), '-i', videoPfad, '-frames:v', '1', '-vf', vf, ziel] };
}

// Gleichmäßig verteilte Zeitpunkte für Thumbnail-Vorschläge (Standbilder aus dem
// Video). Bei 3 Vorschlägen z. B. 25 %, 50 %, 75 % der Länge – die Ränder werden
// gemieden (Intro/Abspann sind selten gute Thumbnails). Reine, testbare Rechnung.
function thumbnailZeitpunkte(gesamtdauer, anzahl = 3) {
  const dauer = Number(gesamtdauer) || 0;
  const n = Math.max(1, Math.floor(anzahl) || 1);
  if (dauer <= 0) return [];
  const punkte = [];
  for (let i = 1; i <= n; i++) punkte.push(r3((dauer * i) / (n + 1)));
  return punkte;
}

module.exports = { stilleAnalyseBefehl, stillenAusLog, dauerAusLog, behaltSegmente, rohschnittBefehl, shortsAuswahl, shortsBefehl, thumbnailBefehl, thumbnailZeitpunkte };
