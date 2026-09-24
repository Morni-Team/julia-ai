'use strict';

// Wissen über gängige Video-Schnittprogramme, damit Julia sie über die normale
// PC-Steuerung (Bildschirm sehen + klicken/tippen/Tasten) zuverlässig bedienen
// kann – der Nutzer soll den PC einfach übergeben können. Julia hat keine
// Spezial-Automatisierung je Programm; sie bedient die echte Oberfläche. Dieses
// Modul liefert die richtigen Tastenkürzel und den Ablauf, damit das sicher klappt.
//
// Rein (Daten + Nachschlagen), daher unit-testbar. Das eigentliche Bedienen macht
// die KI mit den Steuer-Werkzeugen; `videoschnitt`-Werkzeug reicht ihr diese
// Spickzettel und öffnet das Programm (win.appOeffnen).

const ALLGEMEIN = [
  'Öffne das Programm zuerst (videoschnitt „oeffnen") und hol sein Fenster nach vorn (fenster_fokussieren), am besten maximiert.',
  'Arbeite Schritt für Schritt und mach nach JEDEM Schritt einen Screenshot, um zu prüfen, ob es geklappt hat, bevor du weitermachst.',
  'Warte auf Lade-/Renderzeiten (Fortschrittsbalken) – nicht blind weiterklicken.',
  'Bist du bei einem Kürzel unsicher, nutze die Menüs oben (Datei/Bearbeiten) statt zu raten.',
  'Vor dem Export: Dateiname und Zielordner setzen; nach dem Export mit einem Screenshot prüfen, dass die Datei fertig ist.',
  'Adobe-Programme arbeiten zusammen: Schnitt in Premiere Pro, Animationen/Effekte in After Effects (per Dynamic Link ohne Zwischenexport), finaler Export über den Adobe Media Encoder. Die Creative-Cloud-App startet/aktualisiert diese Programme.',
];

const PROGRAMME = {
  premiere: {
    name: 'Adobe Premiere Pro',
    suche: 'Premiere Pro',
    aliase: ['premiere', 'premiere pro', 'adobe premiere', 'pr'],
    kuerzel: [
      ['Abspielen/Pause', 'Leertaste'],
      ['Importieren', 'Strg+I (oder Doppelklick ins Projektfenster)'],
      ['In-/Out-Punkt', 'I / O'],
      ['Schnitt am Abspielkopf', 'Strg+K (alle Spuren: Strg+Umschalt+K)'],
      ['Rasierklinge / Auswahl-Werkzeug', 'C / V'],
      ['Löschen / Lücke schließend (Ripple)', 'Entf / Umschalt+Entf'],
      ['Rückgängig / Wiederholen', 'Strg+Z / Strg+Umschalt+Z'],
      ['Speichern', 'Strg+S'],
      ['Exportieren', 'Strg+M → Einstellungen → „Exportieren"'],
      ['Zoom Timeline', '+ / -'],
    ],
    workflow: [
      'Neues Projekt anlegen (Datei → Neu → Projekt) oder vorhandenes öffnen.',
      'Medien importieren (Strg+I), aus dem Projektfenster in die Timeline ziehen.',
      'Abspielkopf an die Schnittstelle setzen, mit Strg+K schneiden, unerwünschtes Stück auswählen und mit Umschalt+Entf lückenlos löschen.',
      'Zum Export Strg+M, Format (z. B. H.264), Ziel/Namen wählen, „Exportieren".',
    ],
  },
  davinci: {
    name: 'DaVinci Resolve',
    suche: 'DaVinci Resolve',
    aliase: ['davinci', 'resolve', 'davinci resolve', 'da vinci'],
    kuerzel: [
      ['Seiten unten', 'Cut / Edit (Schnitt) / … / Deliver (Export)'],
      ['Abspielen', 'Leertaste (J/K/L: rückwärts/stopp/vorwärts)'],
      ['Importieren', 'Strg+I (oder Media-Pool → Rechtsklick → Import Media)'],
      ['In-/Out-Punkt', 'I / O'],
      ['Schneiden am Abspielkopf / Blade-Werkzeug', 'Strg+B / B'],
      ['Löschen / Ripple-Löschen', 'Entf / Umschalt+Entf'],
      ['Auswahl-Werkzeug', 'A'],
      ['Rückgängig', 'Strg+Z'],
      ['Speichern', 'Strg+S'],
    ],
    workflow: [
      'Projekt öffnen/anlegen, auf der Edit-Seite arbeiten.',
      'Medien importieren (Strg+I) in den Media-Pool, in die Timeline ziehen.',
      'Abspielkopf setzen, mit Strg+B schneiden, Stück auswählen und mit Umschalt+Entf ripple-löschen.',
      'Export: unten auf „Deliver", ein Preset wählen (z. B. YouTube 1080p), „Add to Render Queue", dann „Render All".',
    ],
  },
  capcut: {
    name: 'CapCut',
    suche: 'CapCut',
    aliase: ['capcut', 'cap cut'],
    kuerzel: [
      ['Abspielen/Pause', 'Leertaste'],
      ['Importieren', '„Importieren"-Knopf oben links, dann auf die Timeline ziehen'],
      ['Teilen/Schneiden am Abspielkopf', 'Strg+B (oder Scheren-Symbol über der Timeline)'],
      ['Löschen', 'Entf'],
      ['Rückgängig / Wiederholen', 'Strg+Z / Strg+Umschalt+Z'],
      ['Exportieren', '„Exportieren"-Knopf oben rechts'],
      ['Timeline zoomen', 'Regler unten rechts'],
    ],
    workflow: [
      'Neues Projekt starten („Neues Projekt erstellen").',
      'Medien über „Importieren" hinzufügen und auf die Timeline ziehen.',
      'Abspielkopf setzen, mit Strg+B teilen, unerwünschtes Segment anklicken und mit Entf löschen.',
      'Oben rechts „Exportieren", Auflösung/Format/Ziel wählen, exportieren.',
    ],
  },
  shotcut: {
    name: 'Shotcut',
    suche: 'Shotcut',
    aliase: ['shotcut', 'shot cut'],
    kuerzel: [
      ['Abspielen/Pause', 'Leertaste'],
      ['Öffnen/Importieren', 'Datei öffnen (Strg+O)'],
      ['In-/Out-Punkt', 'I / O'],
      ['Teilen am Abspielkopf', 'S'],
      ['Ripple-Löschen / normal löschen', 'X / Entf'],
      ['Rückgängig', 'Strg+Z'],
      ['Speichern', 'Strg+S'],
      ['Exportieren', 'Datei → Exportieren → Video'],
    ],
    workflow: [
      'Datei öffnen, auf die Timeline ziehen (Zeitleiste einblenden, falls nötig).',
      'Abspielkopf setzen, mit S teilen, Segment auswählen, mit X lückenlos entfernen.',
      'Export über Datei → Exportieren, ein Preset (z. B. YouTube) wählen, „Datei exportieren".',
    ],
  },
  filmora: {
    name: 'Wondershare Filmora',
    suche: 'Filmora',
    aliase: ['filmora', 'wondershare filmora'],
    kuerzel: [
      ['Abspielen/Pause', 'Leertaste'],
      ['Importieren', 'Strg+I'],
      ['Teilen am Abspielkopf', 'Strg+B'],
      ['Löschen', 'Entf'],
      ['Rückgängig', 'Strg+Z'],
      ['Exportieren', '„Exportieren"-Knopf oben'],
    ],
    workflow: [
      'Neues Projekt, Medien importieren (Strg+I) und auf die Timeline ziehen.',
      'Abspielkopf setzen, mit Strg+B teilen, Segment mit Entf löschen.',
      'Oben „Exportieren", Format/Ziel wählen, exportieren.',
    ],
  },
  aftereffects: {
    name: 'Adobe After Effects',
    suche: 'After Effects',
    aliase: ['after effects', 'aftereffects', 'ae', 'adobe after effects'],
    kuerzel: [
      ['Neue Komposition', 'Strg+N'],
      ['Importieren', 'Strg+I'],
      ['Vorschau (RAM-Preview)', 'Leertaste oder 0 (Ziffernblock)'],
      ['Eigenschaften einblenden', 'P Position · S Skalierung · R Drehung · T Deckkraft'],
      ['Keyframes einer Ebene zeigen', 'U'],
      ['Keyframe setzen', 'Stoppuhr neben der Eigenschaft aktivieren, dann Abspielkopf bewegen und Wert ändern'],
      ['Ebene an Abspielkopf schneiden', 'Strg+Umschalt+D'],
      ['Rückgängig', 'Strg+Z'],
      ['Rendern', 'Strg+M (Renderliste) oder Komposition → „Zur Adobe Media Encoder-Warteschlange hinzufügen"'],
    ],
    workflow: [
      'Neue Komposition anlegen (Strg+N: Auflösung/Dauer/FPS setzen).',
      'Medien/Ebenen importieren (Strg+I) und in die Komposition/Timeline ziehen.',
      'Animation: die Eigenschaft öffnen (z. B. P für Position), die Stoppuhr aktivieren = erster Keyframe; Abspielkopf weiterbewegen, Wert ändern = nächster Keyframe. So entstehen Bewegungen/Effekte automatisch über die Zeit.',
      'Mit Leertaste/0 vorschauen; Feinschliff über den Diagramm-Editor (weiche Ein-/Ausläufe, F9 = Weiche Übergänge).',
      'Export: Strg+M (Renderliste, Ausgabemodul/Ziel wählen, „Rendern") oder über Adobe Media Encoder (empfohlen für H.264/MP4).',
    ],
  },
  vegas: {
    name: 'VEGAS Pro',
    suche: 'VEGAS Pro',
    aliase: ['vegas', 'vegas pro', 'sony vegas', 'magix vegas'],
    kuerzel: [
      ['Abspielen/Pause', 'Leertaste'],
      ['Teilen am Abspielkopf', 'S'],
      ['Löschen', 'Entf'],
      ['Rückgängig', 'Strg+Z'],
      ['Speichern', 'Strg+S'],
      ['Rendern/Export', 'Datei → Rendern als …'],
    ],
    workflow: [
      'Projekt anlegen, Medien in die Timeline ziehen.',
      'Abspielkopf setzen, mit S teilen, Segment mit Entf löschen (ggf. Lücke schließen).',
      'Export über Datei → „Rendern als", Vorlage/Ziel wählen, rendern.',
    ],
  },
  creativecloud: {
    name: 'Adobe Creative Cloud',
    suche: 'Creative Cloud',
    aliase: ['creative cloud', 'creativecloud', 'adobe creative cloud', 'cc', 'adobe cc'],
    kuerzel: [
      ['App starten/installieren/aktualisieren', 'in der Creative-Cloud-App unter „Apps" → „Öffnen"/„Installieren"/„Aktualisieren"'],
      ['Anmeldung', 'macht der Nutzer selbst (Adobe-Konto) – Julia gibt keine Zugangsdaten ein'],
    ],
    workflow: [
      'Die Creative-Cloud-App öffnen, um Adobe-Programme (Premiere Pro, After Effects, Media Encoder) zu starten, zu installieren oder zu aktualisieren.',
      'Zusammenspiel: In Premiere „Ersetzen durch After-Effects-Komposition" (Dynamic Link) verbindet Schnitt und Animation ohne Zwischenexport.',
      'Für den finalen Export großer/vieler Videos den Adobe Media Encoder nutzen (aus Premiere/AE „In Media Encoder-Warteschlange").',
    ],
  },
};

// Eingabe (Name/Alias) → interner Schlüssel oder null.
function erkennen(text) {
  const s = String(text || '').toLowerCase().trim();
  if (!s) return null;
  if (PROGRAMME[s]) return s;
  for (const [key, p] of Object.entries(PROGRAMME)) {
    if (key === s || p.aliase.some((a) => a === s)) return key;
  }
  // unscharf: enthält einen Alias als Teilstring
  for (const [key, p] of Object.entries(PROGRAMME)) {
    if (p.aliase.some((a) => s.includes(a)) || s.includes(key)) return key;
  }
  return null;
}

function liste() {
  return Object.entries(PROGRAMME).map(([key, p]) => ({ key, name: p.name }));
}

// Suchbegriff zum Öffnen über Get-StartApps (win.appOeffnen).
function suche(programm) {
  const key = erkennen(programm);
  return key ? PROGRAMME[key].suche : String(programm || '').trim();
}

// Formatierter Spickzettel (Kürzel + Ablauf + allgemeine Hinweise) oder null.
function hilfe(programm) {
  const key = erkennen(programm);
  if (!key) return null;
  const p = PROGRAMME[key];
  const zeilen = [`${p.name} – Bedienung:`, '', 'Tastenkürzel:'];
  for (const [was, taste] of p.kuerzel) zeilen.push(`• ${was}: ${taste}`);
  zeilen.push('', 'Ablauf:');
  p.workflow.forEach((w, i) => zeilen.push(`${i + 1}. ${w}`));
  zeilen.push('', 'Allgemein:');
  for (const a of ALLGEMEIN) zeilen.push(`• ${a}`);
  return zeilen.join('\n');
}

module.exports = { PROGRAMME, ALLGEMEIN, erkennen, liste, suche, hilfe };
