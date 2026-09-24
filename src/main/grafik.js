'use strict';

// Grafik-Fallback-Leiter (Issue #57). Eine „eigene Render-Engine" zu schreiben,
// ist nicht der Weg – Chromium IST die Engine. Der bewährte Ansatz bei GPU-/
// Treiber-Zicken ist, Chromium der Reihe nach andere Grafik-Backends zu geben:
//   normal   – Standard (meist ANGLE/Direct3D 11)
//   d3d9     – ANGLE über das ältere, sehr verträgliche Direct3D 9
//   gl       – ANGLE über OpenGL
//   swiftshader – SwiftShader: rendert komplett in Software (ohne GPU)
//   software – Hardware-Beschleunigung ganz aus (Software-Compositing)
//   gpu-aus  – GPU-Prozess KOMPLETT abgeschaltet (--disable-gpu): letzte Rettung,
//              wenn selbst im Software-Modus der GPU-Prozess abstürzt (degradierter
//              Treiber). Dann gibt es keinen GPU-Prozess, der noch crashen könnte.
// Die Auto-Heilung probiert bei einem leeren Fenster diese Stufen nacheinander
// durch und merkt sich die, mit der es klappt.

const MODI = ['normal', 'd3d9', 'gl', 'swiftshader', 'software', 'gpu-aus'];

function gueltig(modus) {
  return MODI.includes(modus);
}

// Command-Line-Schalter für einen Modus: Liste von [name, wert]. Leerer wert =
// Schalter ohne Wert. 'normal' und 'software' brauchen hier nichts ('software'
// läuft über app.disableHardwareAcceleration(), separat).
function flaggenFuer(modus) {
  switch (modus) {
    case 'd3d9': return [['use-angle', 'd3d9']];
    case 'gl': return [['use-angle', 'gl']];
    case 'swiftshader': return [['use-angle', 'swiftshader'], ['use-gl', 'angle'], ['enable-unsafe-swiftshader', '']];
    // Letzte Rettung bei kaputtem Treiber (Issue #107/#109): keinen separaten GPU-
    // Kindprozess starten (der crasht), aber Software-Rendering BEHALTEN. Deshalb
    // `--in-process-gpu` (GPU-/SwiftShader-Arbeit läuft im Browser-Prozess) statt
    // `--disable-software-rasterizer` – letzteres nahm dem Renderer jeden Zeichen-
    // Pfad und ließ ihn abstürzen. Zusammen mit disableHardwareAcceleration = rein
    // Software, ohne crashenden GPU-Prozess.
    case 'gpu-aus': return [['disable-gpu', ''], ['disable-gpu-compositing', ''], ['in-process-gpu', '']];
    default: return [];
  }
}

// Braucht dieser Modus, dass die Hardware-Beschleunigung ganz aus ist?
function hardwareAus(modus) {
  return modus === 'software' || modus === 'gpu-aus';
}

// Nächste Stufe der Leiter (bleibt bei der letzten stehen). Von unbekannt/normal
// geht es auf die erste echte Fallback-Stufe.
function naechster(modus) {
  const i = MODI.indexOf(modus);
  if (i < 0) return MODI[1];
  return MODI[Math.min(i + 1, MODI.length - 1)];
}

// Ist das die letzte Stufe (kein weiterer Fallback mehr möglich)?
function letzte(modus) {
  return MODI.indexOf(modus) >= MODI.length - 1;
}

module.exports = { MODI, gueltig, flaggenFuer, hardwareAus, naechster, letzte };
