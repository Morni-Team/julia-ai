'use strict';

// Content-Creation-Modul – Analyse-ENTSCHEIDUNGEN als reine Logik.
// Das eigentliche Auslesen (Transkript per Whisper, Lautstärke/Szenen per FFmpeg)
// ist IO und passiert in der Pipeline. HIER liegen die reinen Entscheidungen auf
// den extrahierten Signalen (Arrays), damit sie ohne Medien testbar sind:
//  - Stille-/Sprech-Segmente aus einer Lautstärke-Reihe (RMS je Zeitschritt),
//  - Jumpcut-Regel „nie länger als X s Stille",
//  - stärkste Momente / Hook-Kandidat aus Peaks.

const zahl = (v, fb = 0) => (Number.isFinite(Number(v)) ? Number(v) : fb);

// rms: Array von Lautstärkewerten (0..1), gleichmäßig mit `hz` Werten pro Sekunde.
// Liefert die Segmente, in denen die Lautstärke UNTER der Schwelle bleibt und die
// mindestens `minDauerS` lang sind (= Stille/Pausen).
function stilleSegmente(rms, { schwelle = 0.06, minDauerS = 0.35, hz = 20 } = {}) {
  const werte = Array.isArray(rms) ? rms : [];
  const schritt = 1 / Math.max(1, hz);
  const segmente = [];
  let start = null;
  for (let i = 0; i <= werte.length; i++) {
    const leise = i < werte.length && zahl(werte[i], 1) < schwelle;
    if (leise && start === null) start = i;
    if (!leise && start !== null) {
      const von = start * schritt;
      const bis = i * schritt;
      if (bis - von >= minDauerS) segmente.push({ von_s: round3(von), bis_s: round3(bis) });
      start = null;
    }
  }
  return segmente;
}

// Sprech-/Inhalts-Segmente = alles ZWISCHEN den (langen) Stillen. Das sind die
// Clips, die in den Rohschnitt kommen (lange Pausen fallen raus). `randS` lässt an
// den Rändern etwas Luft, damit Wortanfänge nicht abgeschnitten werden.
function sprechSegmente(rms, opts = {}) {
  const { hz = 20, randS = 0.1 } = opts;
  const werte = Array.isArray(rms) ? rms : [];
  const dauer = werte.length / Math.max(1, hz);
  const stille = stilleSegmente(rms, opts);
  const segmente = [];
  let cursor = 0;
  for (const s of stille) {
    if (s.von_s - cursor > 0.05) segmente.push({ von_s: round3(Math.max(0, cursor - randS)), bis_s: round3(s.von_s + randS) });
    cursor = s.bis_s;
  }
  if (dauer - cursor > 0.05) segmente.push({ von_s: round3(Math.max(0, cursor - randS)), bis_s: round3(dauer) });
  return zusammenfassen(segmente);
}

// Überlappende/aneinandergrenzende Segmente verschmelzen.
function zusammenfassen(segmente) {
  const s = [...segmente].sort((a, b) => a.von_s - b.von_s);
  const out = [];
  for (const seg of s) {
    const letzt = out[out.length - 1];
    if (letzt && seg.von_s <= letzt.bis_s) letzt.bis_s = Math.max(letzt.bis_s, seg.bis_s);
    else out.push({ ...seg });
  }
  return out;
}

// Jumpcut-Regel: keine Pause länger als `maxStilleS`. Für jede zu lange Stille ein
// Schnitt, der sie auf `maxStilleS` kürzt (behält vorne eine kurze Atempause).
function jumpcutPunkte(stille, maxStilleS = 3) {
  return (stille || [])
    .filter((s) => s.bis_s - s.von_s > maxStilleS)
    .map((s) => ({ entferne_von_s: round3(s.von_s + maxStilleS), entferne_bis_s: round3(s.bis_s) }));
}

// peaks: Array von { t_s, wert } (z. B. Lautstärke-/Emotions-Spitzen). Die
// stärksten `n` Momente, nach Wert absteigend.
function staerksteMomente(peaks, n = 5) {
  return [...(Array.isArray(peaks) ? peaks : [])]
    .filter((p) => p && Number.isFinite(Number(p.t_s)))
    .sort((a, b) => zahl(b.wert) - zahl(a.wert))
    .slice(0, Math.max(0, n))
    .map((p) => ({ t_s: round3(p.t_s), wert: zahl(p.wert) }));
}

function hookKandidat(peaks) {
  return staerksteMomente(peaks, 1)[0] || null;
}

function round3(x) {
  return Math.round(zahl(x) * 1000) / 1000;
}

module.exports = { stilleSegmente, sprechSegmente, jumpcutPunkte, staerksteMomente, hookKandidat, zusammenfassen };
