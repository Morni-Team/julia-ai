'use strict';

const fs = require('fs');
const path = require('path');

// Start-Selbstprüfung: Julia soll nie still verschwinden. Bevor das erste
// Fenster entsteht, schreibt sie ein Logbuch, prüft Schreibrechte und die
// mitgegebenen Flags und merkt sich, ob sie wegen GPU-Abstürzen auf
// Software-Rendering ausweichen muss. Läuft etwas schief, sieht der Nutzer
// eine klare Meldung mit Knöpfen zum Logbuch – nie einen wortlosen Abbruch.

const LOG_MAX = 512 * 1024; // ab dieser Größe wird das Logbuch gedreht
const LOG_ALTE = 3; // so viele alte Logbücher bleiben erhalten
const GPU_SCHWELLE = 2; // so viele GPU-Abstürze, dann Software-Rendering

// Flags, die Julia selbst kennt (der Rest wird nur mit einer Warnung geduldet).
const BEKANNTE_FLAGS = new Set([
  '--versteckt', '--updated', '--force-run', '--allow-file-access-from-files',
  '--enable-logging', '--disable-gpu', '--no-sandbox', '/s',
]);

// Chromium-Flags, die sich gegenseitig aufheben und den GPU-Prozess abstürzen
// lassen können. Tauchen beide auf, weicht Julia gleich auf Software aus.
const KONFLIKTE = [['--use-gl=swiftshader', '--disable-software-rasterizer']];

const jetztText = () => new Date().toISOString();

// --- Logbuch mit einfacher Rotation ---

class Logbuch {
  constructor(datei) {
    this.datei = datei;
  }

  _drehen() {
    try {
      if (!fs.existsSync(this.datei) || fs.statSync(this.datei).size < LOG_MAX) return;
      fs.rmSync(`${this.datei}.${LOG_ALTE}`, { force: true });
      for (let i = LOG_ALTE - 1; i >= 1; i--) {
        if (fs.existsSync(`${this.datei}.${i}`)) fs.renameSync(`${this.datei}.${i}`, `${this.datei}.${i + 1}`);
      }
      fs.renameSync(this.datei, `${this.datei}.1`);
    } catch { /* Rotation ist nur Kosmetik – lieber weiterschreiben */ }
  }

  schreiben(stufe, text, daten) {
    try {
      this._drehen();
      const zusatz = daten ? ' ' + JSON.stringify(daten) : '';
      fs.appendFileSync(this.datei, `${jetztText()} [${stufe}] ${text}${zusatz}\n`);
    } catch { /* kein Logbuch möglich – das darf den Start nicht aufhalten */ }
  }
}

// Öffnet das Logbuch im Datenordner. Scheitert das Anlegen des Ordners, gibt es
// trotzdem ein Logbuch zurück, das seine Schreibfehler still schluckt.
function logbuchOeffnen(datenOrdner) {
  try { fs.mkdirSync(datenOrdner, { recursive: true }); } catch { /* siehe schreibbar() */ }
  return new Logbuch(path.join(datenOrdner, 'start.log'));
}

// --- Flags prüfen ---

// Trennt Flags von den übrigen Argumenten und meldet Unbekanntes sowie
// widersprüchliche Kombinationen. Julia bricht daran nie ab – sie warnt nur.
function flaggenPruefen(argv) {
  const flaggen = (argv || []).slice(1).filter((a) => a.startsWith('-') || a.startsWith('/'));
  const nname = (f) => f.split('=')[0].toLowerCase();
  const warnungen = [];
  const unbekannt = flaggen.filter((f) => !BEKANNTE_FLAGS.has(nname(f)));
  for (const f of unbekannt) warnungen.push(`Unbekanntes Startflag wird ignoriert: ${f}`);
  let konflikt = false;
  const roh = new Set(flaggen.map((f) => f.toLowerCase()));
  for (const paar of KONFLIKTE) {
    if (paar.every((f) => roh.has(f))) {
      konflikt = true;
      warnungen.push(`Widersprüchliche Grafik-Flags (${paar.join(' + ')}) – Julia nutzt Software-Rendering.`);
    }
  }
  return { flaggen, unbekannt, konflikt, warnungen };
}

// --- Schreibrechte ---

// Prüft still, ob in einen Ordner geschrieben werden kann (legt ihn dafür an).
// Gibt true/false zurück – ohne zu werfen (für die Ordner-Auswahl).
function ordnerBeschreibbar(ordner, { fsx = fs } = {}) {
  try {
    fsx.mkdirSync(ordner, { recursive: true });
    const probe = path.join(ordner, `.schreibprobe-${process.pid}`);
    fsx.writeFileSync(probe, 'ok');
    fsx.rmSync(probe, { force: true });
    return true;
  } catch {
    return false;
  }
}

// Wählt aus mehreren Kandidaten den ERSTEN wirklich beschreibbaren Datenordner
// (XXL-Robustheit): ist der normale Ordner gesperrt/schreibgeschützt – eine
// häufige Ursache, dass Julia gar nicht erst öffnet – weicht sie auf einen
// Ersatzordner (z. B. im Temp-Verzeichnis) aus, statt am Start zu scheitern.
// Ist keiner beschreibbar, kommt der letzte Kandidat als Notnagel zurück; dann
// meldet `schreibbarPruefen` später sichtbar den echten, unlösbaren Fall.
function beschreibbarerOrdner(kandidaten, { fsx = fs } = {}) {
  const liste = (kandidaten || []).filter(Boolean);
  for (const k of liste) {
    if (ordnerBeschreibbar(k, { fsx })) return k;
  }
  return liste.length ? liste[liste.length - 1] : null;
}

// Legt den Datenordner an und prüft, ob wirklich hineingeschrieben werden kann.
// Wirft mit einer verständlichen Ursache, statt später wortlos zu scheitern.
function schreibbarPruefen(ordner) {
  try {
    fs.mkdirSync(ordner, { recursive: true });
    const probe = path.join(ordner, `.schreibprobe-${process.pid}`);
    fs.writeFileSync(probe, 'ok');
    fs.rmSync(probe, { force: true });
  } catch (e) {
    throw new Error(`Julia kann in ihren Datenordner nicht schreiben (${ordner}): ${e.message}`);
  }
}

// --- Software-Rendering merken ---
// Ein reines Markierungsdatei-Verfahren, weil die Entscheidung schon vor dem
// Laden der Konfiguration (vor app.whenReady) feststehen muss.

function _marker(ordner) {
  return path.join(ordner, 'software-rendering'); // alter Boolean-Marker (Rückwärtskompatibilität)
}
function _modusMarker(ordner) {
  return path.join(ordner, 'grafik-modus'); // neuer Marker mit dem Modusnamen (Issue #57)
}

// Aktueller Grafik-Modus (Fallback-Leiter). Neuer Marker hat Vorrang; sonst gilt
// der alte Boolean-Marker als „software"; sonst „normal".
function grafikModus(ordner) {
  const { gueltig } = require('./grafik');
  try {
    const roh = fs.readFileSync(_modusMarker(ordner), 'utf8').trim();
    if (gueltig(roh)) return roh;
  } catch { /* nicht gesetzt */ }
  try { if (fs.existsSync(_marker(ordner))) return 'software'; } catch { /* egal */ }
  return 'normal';
}

function grafikModusSetzen(ordner, modus) {
  const { gueltig } = require('./grafik');
  const m = gueltig(modus) ? modus : 'normal';
  try {
    fs.rmSync(_marker(ordner), { force: true }); // alten Marker aufräumen
    if (m === 'normal') fs.rmSync(_modusMarker(ordner), { force: true });
    else fs.writeFileSync(_modusMarker(ordner), m);
  } catch { /* nicht schlimm: dann greift es beim nächsten Start eben nicht */ }
}

// Rückwärtskompatibel: „Software-Rendering an?" = Modus ist die volle Software-
// Stufe. Setzen schaltet zwischen normal und software.
function softwareRendering(ordner) {
  return grafikModus(ordner) === 'software';
}

function softwareRenderingSetzen(ordner, an) {
  grafikModusSetzen(ordner, an ? 'software' : 'normal');
}

// Bleibt die Oberfläche leer, OHNE dass ein GPU-/Renderer-Absturz gemeldet wurde
// (Issue #3/#54: auf manchen PCs liefert die GPU keine Infos und der Renderer
// hängt beim Aufbau, statt sauber zu crashen). Dann ist Software-Rendering fast
// immer die Rettung (der Nutzer bestätigte: mit `--disable-gpu` kam das Bild
// zurück). Also: ist Software-Rendering noch nicht aktiv, jetzt einschalten und
// neu starten; ist es schon aktiv und trotzdem leer, nicht endlos neu starten,
// sondern klar melden. Gibt true zurück, wenn neu gestartet wird.
function blankUiAbsichern({ datenOrdner, logbuch, neustart, fatal }) {
  const grafik = require('./grafik');
  const modus = grafikModus(datenOrdner);
  if (grafik.letzte(modus)) {
    logbuch.schreiben('FATAL', `Oberfläche bleibt leer, auch mit Grafik-Modus „${modus}" – Grafik/Treiber oder Start-Hänger. Einzelheiten im Logbuch.`);
    if (fatal) fatal('Die Oberfläche bleibt leer, auch mit dem verträglichsten Grafik-Modus. Bitte das Start-Logbuch schicken – ich grenze es weiter ein.');
    return false;
  }
  const naechster = grafik.naechster(modus);
  grafikModusSetzen(datenOrdner, naechster);
  logbuch.schreiben('GPU', `Oberfläche blieb leer und kein GPU-Absturz gemeldet – nächster Grafik-Modus „${naechster}" wird ab jetzt probiert, ich starte einmal neu.`);
  if (neustart) neustart();
  return true;
}

// --- Fehlermeldung mit Knöpfen ---

// Zeigt eine native Meldung mit klarer Ursache und Knöpfen zum Logbuch. Gibt
// den gewählten Knopf zurück. Braucht ein bereites app-Objekt (dialog).
async function fehlerDialog({ app, dialog, shell, titel = 'Julia', text, logDatei, ordner, zuruecksetzen, treiberUrl }) {
  try {
    await app.whenReady();
  } catch { /* wenn selbst das scheitert, bleibt nur der Text unten */ }
  const knoepfe = ['Schließen'];
  // Wiederherstellen ohne Neuinstallation: Grafik-Einstellung zurücksetzen und neu
  // starten (der übliche Ausweg, den bisher nur eine Neuinstallation brachte).
  if (typeof zuruecksetzen === 'function') knoepfe.push('Grafik zurücksetzen & neu starten');
  if (treiberUrl) knoepfe.push('Grafiktreiber aktualisieren');
  if (logDatei) knoepfe.push('Logdatei öffnen');
  if (ordner) knoepfe.push('Ordner im Explorer zeigen');
  const voll = logDatei ? `${text}\n\nTipp: „Grafik zurücksetzen & neu starten" behebt das oft ohne Neuinstallation. Hilft das nicht, den Grafiktreiber aktualisieren.\n\nEinzelheiten stehen im Logbuch:\n${logDatei}` : text;
  let wahl = 0;
  try {
    wahl = dialog.showMessageBoxSync({ type: 'error', title: titel, message: titel, detail: voll, buttons: knoepfe, defaultId: 0, noLink: true });
  } catch {
    try { dialog.showErrorBox(titel, voll); } catch { /* nichts mehr möglich */ }
    return 0;
  }
  const gewaehlt = knoepfe[wahl];
  try {
    if (gewaehlt === 'Grafik zurücksetzen & neu starten') { zuruecksetzen(); return wahl; }
    if (gewaehlt === 'Grafiktreiber aktualisieren' && treiberUrl) shell.openExternal(treiberUrl);
    else if (gewaehlt === 'Logdatei öffnen' && logDatei) shell.openPath(logDatei);
    else if (gewaehlt === 'Ordner im Explorer zeigen' && ordner) shell.showItemInFolder(logDatei || ordner);
  } catch { /* Explorer/Link nicht erreichbar */ }
  return wahl;
}

// --- GPU-Abstürze überwachen ---

// Hört auf abgestürzte Kind- und Renderer-Prozesse. Stürzt der GPU-Prozess
// wiederholt ab, merkt sich Julia Software-Rendering, sagt es dem Nutzer einmal
// und bietet einen Neustart an. Gibt eine Funktion zum Abschalten zurück.
//
// Wichtig für den Fall, dass der GPU-Prozess schon beim Start in Serie abstürzt
// und Chromium ganz aufgibt ("GPU process isn't usable. Goodbye."): Passiert der
// erste GPU-Absturz kurz nach dem Start, wird der Software-Rendering-Merker
// SOFORT gesetzt. So startet Julia beim nächsten Mal sicher, selbst wenn sie
// diesmal noch abstürzt, bevor der Neustart greift.
const ECHTER_CRASH = /crashed|oom|launch-failed|integrity-failure|abnormal-exit/;

function gpuUeberwachen({ app, logbuch, datenOrdner, melden, neustart, fatal, schwelle = GPU_SCHWELLE, jetzt = Date.now, startFensterMs = 20000 }) {
  const grafik = require('./grafik');
  let gpuAbstuerze = 0;
  let rendererAbstuerze = 0;
  let gemeldet = false;
  let neugestartet = false;
  const start = jetzt();
  const imStart = () => jetzt() - start < startFensterMs;

  const ausweichen = () => {
    if (gemeldet) return;
    gemeldet = true;
    // Eine Stufe tiefer in der Rettungs-Kette: software → gpu-aus → notfall.
    const ziel = grafik.naechsteRettung(grafikModus(datenOrdner));
    grafikModusSetzen(datenOrdner, ziel);
    logbuch.schreiben('GPU', `Wiederholter GPU-Absturz – Grafik-Modus „${ziel}" wird ab dem nächsten Start genutzt.`);
    if (melden) melden();
    if (neustart) neustart();
  };

  // Absturz gleich beim Start (schwarzes Fenster): einmal auf Software-Rendering
  // umstellen und SOFORT neu starten, damit der Nutzer nicht auf ein totes Fenster
  // starrt. Crasht es auch mit Software-Rendering, wird nicht endlos neu gestartet,
  // sondern eine klare Meldung gezeigt.
  const startAbsichern = (grund) => {
    if (neugestartet || gemeldet) return;
    const modus = grafikModus(datenOrdner);
    // Solange es eine tiefere Stufe gibt, dorthin ausweichen und neu starten – erst
    // Software (bewährt), und wenn selbst DA der GPU-Prozess abstürzt, ganz ohne
    // GPU-Prozess (gpu-aus). Erst wenn auch das crasht (letzte Stufe), FATAL.
    if (!grafik.letzte(modus)) {
      neugestartet = true;
      const ziel = grafik.naechsteRettung(modus);
      grafikModusSetzen(datenOrdner, ziel);
      logbuch.schreiben('GPU', `${grund} beim Start – Grafik-Modus „${ziel}" ist ab jetzt aktiv, ich starte neu.`);
      if (neustart) neustart();
    } else {
      gemeldet = true;
      logbuch.schreiben('FATAL', `${grund} trotz Grafik-Modus „${modus}" – Start abgesichert abgebrochen.`);
      // 'notfall' war die letzte Stufe: auch mit --no-sandbox/RendererCodeIntegrity-aus
      // crasht der Renderer → das ist kein Grafik-, sondern ein System-Problem
      // (kaputter Grafiktreiber ODER eine injizierte Fremd-DLL, z. B. Antivirus/Overlay).
      if (fatal) fatal(`${grund}: Julia startet nicht sauber, auch nicht ohne GPU und ohne Sandbox. Das deutet auf einen kaputten Grafiktreiber oder eine dazwischenfunkende Sicherheitssoftware (Antivirus/Overlay) hin, die sich in Julia einklinkt. Bitte den Grafiktreiber aktualisieren und Overlays/Tuning-Tools schließen. Einzelheiten im Logbuch.`);
    }
  };

  const beiKind = (_e, d) => {
    logbuch.schreiben('CRASH', `Kindprozess weg: ${d.type}`, { grund: d.reason, code: d.exitCode });
    if (d.type === 'GPU' && d.reason !== 'clean-exit') {
      gpuAbstuerze += 1;
      if (imStart()) { startAbsichern('GPU-Absturz'); return; }
      if (gpuAbstuerze >= schwelle) ausweichen();
    }
  };
  const beiRenderer = (_e, _wc, d) => {
    logbuch.schreiben('CRASH', 'Renderer weg', { grund: d.reason, code: d.exitCode });
    if (!ECHTER_CRASH.test(String(d.reason || ''))) return; // sauber beendet/abgeschossen: nichts tun
    // Ein echter Renderer-Absturz beim Start führt zum schwarzen Fenster – sofort
    // wie einen GPU-Absturz absichern.
    if (imStart()) { startAbsichern('Renderer-Absturz'); return; }
    // Auch nach dem Start: stürzt der Renderer wiederholt ab (oft dieselbe GPU-
    // Ursache), auf Software-Rendering umstellen und neu starten, statt mit totem
    // Fenster hängen zu bleiben (Issue #41/#3).
    rendererAbstuerze += 1;
    if (rendererAbstuerze >= schwelle) ausweichen();
  };

  app.on('child-process-gone', beiKind);
  app.on('render-process-gone', beiRenderer);
  return () => {
    app.removeListener('child-process-gone', beiKind);
    app.removeListener('render-process-gone', beiRenderer);
  };
}

module.exports = {
  Logbuch, logbuchOeffnen, flaggenPruefen, schreibbarPruefen, ordnerBeschreibbar, beschreibbarerOrdner,
  softwareRendering, softwareRenderingSetzen, grafikModus, grafikModusSetzen, blankUiAbsichern, fehlerDialog, gpuUeberwachen,
  LOG_MAX, LOG_ALTE, GPU_SCHWELLE, BEKANNTE_FLAGS,
};
