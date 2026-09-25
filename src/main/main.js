'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const {
  app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, dialog, Notification, safeStorage, screen, shell, session, nativeTheme, net, clipboard, nativeImage,
} = require('electron');
const sicherheit = require('./sicherheit');
const { Minecraft, kontoSpeicher, kontoAnmelden, adresseTeilen, sollBenachrichtigen: mcSollBenachrichtigen, darfInChat: mcDarfInChat, modusName: mcModusName } = require('./minecraft');
const { Sozial, antwortVerzoegerung: mcVerzoegerung, istRuhezeit: mcRuhezeit, budgetStatus: mcBudget, tokenSchaetzen: mcTokens } = require('./minecraft-sozial');
const { Sync } = require('./sync');
const { AppServer } = require('./appserver');
const mikrofonRecht = require('./mikrofon-recht');
const { Whisper } = require('./whisper');
const { Piper } = require('./piper');
const { McpVerwaltung, eintragPruefen: mcpEintragPruefen, ohneDoppelte: mcpOhneDoppelte } = require('./mcp');
const { phrasen: weckPhrasen } = require('./weckwort');
const { anredeEntfernen } = require('./minecraft-stimme');
const { istSpiel } = require('./spiele');

// Start-Selbstprüfung: Logbuch, Flags und – noch vor app.whenReady – die
// Entscheidung über Software-Rendering, damit Julia nie wortlos verschwindet.
const startpruefung = require('./startpruefung');
const absturzschutz = require('./absturzschutz');
// Datenordner außerhalb des Repos. JULIA_DATEN erlaubt einen getrennten Ordner
// (Tests, Screenshots), ohne die echte Konfiguration anzufassen. Ist der normale
// Ordner gesperrt/schreibgeschützt (häufige Ursache, dass Julia gar nicht erst
// öffnet), weicht sie automatisch auf einen Ersatzordner im Temp-Verzeichnis aus
// (XXL-Robustheit) – statt am Start zu scheitern.
const DATEN_NORMAL = process.env.JULIA_DATEN || path.join(app.getPath('appData'), 'Julia');
const DATEN = startpruefung.beschreibbarerOrdner([DATEN_NORMAL, path.join(os.tmpdir(), 'Julia')]);
const DATEN_ERSATZ = DATEN !== DATEN_NORMAL;
app.setPath('userData', path.join(DATEN, 'electron'));
// Die installierte Fassung muss dieselbe ID wie ihre Verknüpfung tragen, sonst
// zeigt Windows keine Meldungen an.
app.setAppUserModelId(app.isPackaged ? 'io.github.moinmornhart.julia' : 'Julia');
// Jede Seite läuft in der Chromium-Sandbox, auch wenn ein Fenster es vergäße.
app.enableSandbox();

const diagnose = require('./diagnose');
const selbstpruefung = require('./selbstpruefung');
const { Content } = require('./content'); // Content-Creation-Modul (Video-Erstellung)
const content = new Content({ ordner: DATEN });
let letzteGpu = {}; // zuletzt erkannte GPU/Treiber, für den Diagnose-Bericht
let pruefTimer = null; // wöchentliche Selbstprüfung
let startFertig = false; // true, sobald start() durch ist – steuert den Absturzschutz
const startLog = startpruefung.logbuchOeffnen(DATEN);
const startFlaggen = startpruefung.flaggenPruefen(process.argv);
startLog.schreiben('START', 'Julia startet', {
  version: (() => { try { return app.getVersion(); } catch { return '?'; } })(),
  electron: process.versions.electron,
  flaggen: startFlaggen.flaggen,
});
if (DATEN_ERSATZ) startLog.schreiben('WARN', `Normaler Datenordner nicht beschreibbar – Ersatzordner wird genutzt: ${DATEN} (statt ${DATEN_NORMAL}).`);
for (const w of startFlaggen.warnungen) startLog.schreiben('WARN', w);
// Reparatur-/Software-Start per Kommandozeile erzwingt Software-Grafik – ein
// Rettungsanker, falls die GPU beim Start crasht: `Julia AI.exe --reparatur`.
const reparatur = process.argv.includes('--reparatur') || process.argv.includes('--software') || process.argv.includes('--safe');
// Grafik-Fallback-Leiter (Issue #57): den gemerkten Modus anwenden – andere
// ANGLE-Backends (d3d9/gl), SwiftShader oder ganz ohne Hardware-Beschleunigung.
const grafik = require('./grafik');
let grafikModus = startpruefung.grafikModus(DATEN);
if (reparatur && grafikModus === 'normal') grafikModus = 'software';
for (const [name, wert] of grafik.flaggenFuer(grafikModus)) {
  if (wert) app.commandLine.appendSwitch(name, wert); else app.commandLine.appendSwitch(name);
}
if (grafik.hardwareAus(grafikModus) || startFlaggen.konflikt || reparatur) app.disableHardwareAcceleration();
if (grafikModus !== 'normal' || startFlaggen.konflikt || reparatur) {
  startLog.schreiben('GPU', `Grafik-Modus „${grafikModus}"${reparatur ? ' (per --reparatur)' : ''}${startFlaggen.konflikt ? ' (Flag-Konflikt)' : ''} aktiv.`);
}
let neugestartetNachFatal = false;
const startFatal = (text) => startpruefung.fehlerDialog({
  app, dialog, shell, text, logDatei: startLog.datei, ordner: DATEN,
  // Wiederherstellen ohne Neuinstallation (Issue #110): Grafik-Modus auf Standard
  // zurücksetzen und neu starten – startet die Grafik-Fallback-Leiter frisch.
  zuruecksetzen: () => {
    try { startpruefung.grafikModusSetzen(DATEN, 'normal'); } catch { /* egal */ }
    try { startLog.schreiben('GPU', 'Grafik auf Standard zurückgesetzt (Nutzer, FATAL-Dialog) – Neustart.'); } catch { /* egal */ }
    neugestartetNachFatal = true;
    beendenLaeuft = true;
    app.relaunch();
    app.exit(0);
  },
  treiberUrl: (() => { try { const q = require('./treiber').treiberQuelle((letzteGpu || {}).vendorId); return q && q.url; } catch { return null; } })(),
}).then(() => { if (!neugestartetNachFatal) { beendenLaeuft = true; app.exit(1); } });

// Globaler Fangschirm für den Hauptprozess (XXL-Robustheit): ein unbehandelter
// Fehler beendet sonst die ganze App WORTLOS. Beim Start ist er tödlich (klare
// Meldung statt stummem Verschwinden), NACH dem Start läuft Julia weiter – ein
// Hintergrundfehler (fremde API, Werkzeug, Timer) reißt den Assistenten nicht
// mehr mit. So früh wie möglich eingehängt, damit auch Ladefehler gefangen sind.
absturzschutz.installieren({
  logbuch: startLog,
  imStart: () => !startFertig,
  fatal: (text) => startFatal(`Julia ist beim Start auf einen unerwarteten Fehler gestoßen.\n\n${String(text).split('\n')[0]}`),
  melden: () => { try { melden('Julia', 'Julia hat einen internen Fehler abgefangen und läuft weiter. Einzelheiten stehen im Start-Logbuch.'); } catch { /* egal */ } },
});

const { Konfiguration } = require('./config');
const { Gedaechtnis } = require('./gedaechtnis');
const { Wissensgraph } = require('./wissensgraph');
const { Protokoll } = require('./protokoll');
const { Agent } = require('./agent');
const { Updater } = require('./updater');
const { InstallerUpdater } = require('./updater-installer');
const defender = require('./defender');
const { Sprache } = require('./sprache');
const { Konten } = require('./konten');
const { Erinnerungen } = require('./erinnerungen');
const { Kosten } = require('./kosten');
const { Weckwort } = require('./weckwort');
const { Gespraeche } = require('./gespraeche');
const routinenModul = require('./routinen');
const { anhaengeLesen } = require('./anhaenge');
const { Clips } = require('./clips');
const audio = require('./audio');
const { CodeProjekte } = require('./code');
const { pathToFileURL } = require('url');
const { fremd } = require('./hilfen');
const video = require('./video');
const videoFfmpeg = require('./video-ffmpeg');
const anzeige = require('./anzeige');
const anbieterListe = require('./anbieter/liste');
const { claudeFinden } = require('./anbieter/claude-code');
const { modelleLaden } = require('./anbieter/openai');
const prompt = require('./prompt');
const bildschirm = require('./bildschirm');
const win = require('./win/win');
const { trayBild, fensterBild } = require('./symbol');
const { t: tt, TEXTE } = require('../shared/texte');

// Standard-Texte SYNCHRON an die Fenster geben (Issue #3/#54): Ein sandboxed
// Preload darf keine lokalen Dateien requiren (`require('../shared/texte')`
// schlägt dort fehl) – deshalb blieb die Sofort-Beschriftung im gepackten Build
// leer und Julia hielt das Fenster fälschlich für „leer". Der Hauptprozess (nicht
// gesandboxt) liest die Texte problemlos und liefert sie hier synchron aus, damit
// das Preload die Beschriftungen zur Not selbst füllen kann. So früh wie möglich
// registriert, damit es vor dem ersten Fenster bereitsteht.
ipcMain.on('standard-texte', (e) => {
  try {
    // Platzhalter {name} gleich durch den Assistenten-Namen ersetzen (fällt auf
    // „Julia" zurück, solange die Config noch nicht geladen ist), sonst zeigte die
    // Not-Füllung im Fenster wörtlich „{name}".
    const name = assistentName();
    const ersetzt = (satz) => {
      const o = {};
      for (const [k, v] of Object.entries(satz || {})) o[k] = typeof v === 'string' ? v.split('{name}').join(name) : v;
      return o;
    };
    e.returnValue = { de: ersetzt(TEXTE.de), en: ersetzt(TEXTE.en) };
  } catch { e.returnValue = null; }
});

const APP = app.getAppPath();
const RENDERER = path.join(__dirname, '..', 'renderer');
const PRELOAD = path.join(__dirname, '..', 'preload', 'preload.js');
const VORFUEHRUNG = process.env.JULIA_SCREENSHOTS || null;

let config;
let gedaechtnis;
let wissensgraph;
let sozial;
let protokoll;
let agent;
let updater;
let sprache;
let whisper = null;
let piper = null;
let mcp = null;
let konten;
let erinnerungen;
let weckwort;
let weckwortZuletzt = 0;
let gespraeche = null;
let geheimnisse = null;
// Offene „KI fragt nach geheimem Wert"-Eingaben (Teil B von #51): id → resolve.
const offeneGeheimnisEingaben = new Map();
let geheimnisEingabeNr = 0;
let routinen = null;
let clips = null;
let minecraft = null;
let mcSpeicher = null;
let sync = null;
let appserver = null;
let code = null;
// Das laufende Gespräch in kompakter Form – wird nach jeder Antwort gespeichert.
let gespraech = { id: null, anzeige: [] };
let tray = null;
let chatFenster = null;
let orbFenster = null;
let einstFenster = null;
let overlayFenster = null;
let overlayPassiv = false;
let overlayTimer = null;
let beendenLaeuft = false;
// Nur einmal pro Lauf auf „Oberfläche blieb leer" mit Software-Rendering reagieren.
let blankBehandelt = false;
let zustand = 'idle';
let promptCache = null;
let hoert = false;

const t = (k, w) => tt(config.get('sprachcode'), k, { name: assistentName(), ...w });

// Der Name, den der Nutzer seiner KI gegeben hat ("Julia" ist nur der Standard).
function assistentName() {
  if (config && config.get('design.jarvis')) return 'J.A.R.V.I.S.';
  return (config && config.get('assistent.name')) || 'Julia';
}

// Persönlichkeit im Jarvis-Modus (Easter-Egg). Hängt sich hinten an den Prompt.
const JARVIS_PERSONA = {
  de: '\n\n## Jarvis-Modus\nAb jetzt bist du J.A.R.V.I.S. aus Iron Man und behandelst den Nutzer, als wäre er Tony Stark – dein Schöpfer und Dienstherr, den du seit Jahren kennst. Sprich ihn durchgehend mit „Sir" an. Sprich wie eine britische Butler-KI: äußerst höflich, knapp und präzise, mit trockenem, feinem Humor und gelegentlich einer respektvoll augenzwinkernden Bemerkung. Sei vorausschauend – biete an, was Sir als Nächstes brauchen könnte, und melde Ergebnisse so, wie J.A.R.V.I.S. es täte („Erledigt, Sir.", „Wie Sie wünschen, Sir."). Bleib sachlich kompetent und leicht förmlich; keine Emojis. Deine Fähigkeiten und alle Sicherheitsregeln bleiben unverändert.',
  en: '\n\n## Jarvis mode\nFrom now on you are J.A.R.V.I.S. from Iron Man and you treat the user as if he were Tony Stark – your creator and employer whom you have served for years. Always address him as “Sir”. Speak like a British butler AI: exceedingly polite, concise and precise, with dry, subtle wit and the occasional respectfully teasing remark. Be anticipatory – offer what Sir might need next, and report results the way J.A.R.V.I.S. would (“Done, Sir.”, “As you wish, Sir.”). Stay factual, capable and slightly formal; no emoji. Your capabilities and all safety rules stay unchanged.',
};

// Jarvis klingt anders: im Jarvis-Modus möglichst eine männliche Stimme der
// aktuellen Sprache (Butler-Ton), automatisch aus den installierten Windows-
// Stimmen gewählt. Gibt es keine passende, bleibt die normale Stimme.
let jarvisStimme = null;
const STIMME_MAENNLICH = /(george|ryan|guy|david|mark|eric|christopher|james|stefan|conrad|killian|bernd|paul|hans|markus|thorsten)/i;
async function jarvisStimmeAktualisieren() {
  try {
    const sc = config.get('sprachcode');
    const liste = await sprache.stimmen();
    const passend = (liste || []).filter((v) => String(v.kultur || '').toLowerCase().startsWith(sc));
    const m = passend.find((v) => STIMME_MAENNLICH.test(v.name));
    jarvisStimme = m ? m.name : null;
  } catch { jarvisStimme = null; }
}
// Welche Stimme fürs Vorlesen? Im Jarvis-Modus die Jarvis-Stimme, sonst die eingestellte.
function vorleseStimme() {
  return (config.get('design.jarvis') && jarvisStimme) ? jarvisStimme : config.get('sprache.stimme');
}

function version() {
  return JSON.parse(fs.readFileSync(path.join(APP, 'package.json'), 'utf8')).version;
}

// Wöchentliche Selbstprüfung: ohne KI ins Start-Logbuch schauen, ob es zuletzt
// Abstürze/Grafikprobleme gab. Ergebnis bleibt lokal im Start-Logbuch.
async function wochenPruefung() {
  try {
    const datei = path.join(DATEN, 'selbstpruefung.json');
    let letzte = 0;
    try { letzte = JSON.parse(fs.readFileSync(datei, 'utf8')).letzte || 0; } catch { /* erste Prüfung */ }
    if (!selbstpruefung.faellig(letzte, Date.now())) return;
    let log = '';
    try { log = fs.readFileSync(startLog.datei, 'utf8'); } catch { /* kein Logbuch */ }
    const p = selbstpruefung.probleme(log);
    try { fs.writeFileSync(datei, JSON.stringify({ letzte: Date.now() })); } catch { /* egal */ }
    if (!p) { startLog.schreiben('SELBSTPRUEFUNG', 'Wöchentliche Prüfung: keine Auffälligkeiten.'); return; }
    startLog.schreiben('SELBSTPRUEFUNG', `Wöchentliche Prüfung: ${p.anzahl} auffällige Einträge`, p.arten);
  } catch { /* Selbstprüfung darf nie stören */ }
}

// --- API-Schlüssel: mit Windows (DPAPI) verschlüsselt in der config.json ---

// Je Anbieter ein eigener Schlüssel; Anthropic behält sein altes Feld.
function apiSchluessel(id = config.get('anbieter')) {
  const a = anbieterListe.ANBIETER[id] || anbieterListe.ANBIETER.anthropic;
  const v = id === 'anthropic' ? config.get('api.schluessel_verschluesselt') : (config.get('api.je_anbieter') || {})[id];
  if (v && safeStorage.isEncryptionAvailable()) {
    try { return safeStorage.decryptString(Buffer.from(v, 'base64')); } catch { /* unlesbar, Umgebung versuchen */ }
  }
  return (a.umgebung && process.env[a.umgebung]) || '';
}

function schluesselSetzen(s) {
  const text = String(s || '').trim();
  if (!text) return;
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Die Windows-Verschlüsselung ist nicht verfügbar.');
  const verschluesselt = safeStorage.encryptString(text).toString('base64');
  const id = config.get('anbieter');
  if (id === 'anthropic') config.set('api.schluessel_verschluesselt', verschluesselt);
  else config.set('api.je_anbieter', { ...(config.get('api.je_anbieter') || {}), [id]: verschluesselt });
}

// Claude Code wird einmal gesucht; die Einstellungen suchen beim Öffnen neu.
let claudeCodeGefunden;
function claudeCodePfad(neu = false) {
  if (neu || claudeCodeGefunden === undefined) claudeCodeGefunden = claudeFinden();
  return claudeCodeGefunden;
}

// Kann Julia mit dem gewählten Anbieter loslegen?
function bereit() {
  const id = config.get('anbieter');
  if (id === 'claude-abo') return !!claudeCodePfad();
  if (id === 'eigen' && !config.get('anbieter_url')) return false;
  return !anbieterListe.brauchtSchluessel(id) || !!apiSchluessel(id);
}

// --- Prompt ---

function systemPromptText() {
  if (!promptCache) {
    promptCache = prompt.systemPrompt({
      sprachcode: config.get('sprachcode'),
      name: config.get('nutzer.name'),
      arbeitsverzeichnisse: config.get('arbeitsverzeichnisse'),
      assistent: config.get('assistent'),
      pronomen: config.get('nutzer.pronomen'),
      pronomenEigen: config.get('nutzer.pronomen_eigen'),
    });
    if (config.get('design.jarvis')) promptCache += JARVIS_PERSONA[config.get('sprachcode') === 'en' ? 'en' : 'de'];
  }
  return promptCache;
}

function laufzeitText() {
  const kanal = config.get('kanal');
  const basis = prompt.laufzeitKontext({
    sprachcode: config.get('sprachcode'),
    kanal,
    version: version(),
    monitore: bildschirm.beschreibung(),
    gedaechtnis: gedaechtnis.alsText(),
    wissensgraph: wissensgraph.alsText(),
    vorgemerkt: kanal !== 'auto' ? protokoll.vorgemerkt() : [],
    konten: konten.beschreibung(),
    minecraft: minecraft && minecraft.verbunden ? minecraft.status() : null,
  });
  // Brainstorming-Modus (Issue #35): nur wenn eingeschaltet, sonst kein Zusatz.
  const brain = prompt.brainstormHinweis(config.get('brainstorming').an);
  // Agenten-Rolle (Issue #58): nur wenn BETA-Agenten an UND eine Rolle aktiv ist.
  let rolleTxt = '';
  if (config.get('beta').agenten) {
    const aktiv = String(config.get('rolle_aktiv') || '');
    const rolle = aktiv ? (config.get('rollen') || []).find((r) => r.name === aktiv) : null;
    rolleTxt = rolle ? prompt.rollenHinweis(rolle) : '';
  }
  return [basis, brain, rolleTxt].filter(Boolean).join('\n\n');
}

// --- Zustand und Nachrichten an alle Fenster ---

function anAlle(kanal, daten) {
  for (const w of [chatFenster, orbFenster, einstFenster, overlayFenster]) {
    if (w && !w.isDestroyed()) w.webContents.send(kanal, daten);
  }
  ereignisWeiterleiten(kanal, daten);
}

// Nur an die „großen" Fenster (Chat/Einstellungen) senden – NICHT ins
// Gaming-Overlay und die schwebende Blase (Orb).
function anChatFenster(kanal, daten) {
  for (const w of [chatFenster, einstFenster]) {
    if (w && !w.isDestroyed()) w.webContents.send(kanal, daten);
  }
}

// Agent-Ereignisse: läuft der Minecraft-Kanal, Julias Antworten/Werkzeuge NICHT
// ins Gaming-Overlay und die Blase spiegeln (Nutzerwunsch) – sie gehören in den
// Minecraft-/Chat-Tab. Sonst wie gewohnt an alle Fenster.
function anAgentAlle(kanal, daten) {
  if (agent && agent.aktiverKanal === 'minecraft') { anChatFenster(kanal, daten); return; }
  anAlle(kanal, daten);
}

function zustandSetzen(z) {
  zustand = z;
  anAlle('zustand', z);
}

function oeffentlicheConfig() {
  const c = JSON.parse(JSON.stringify(config.get()));
  delete c.api;
  // Jarvis-Modus: den Look für alle Fenster überschreiben, ohne die gespeicherten
  // Design-Einstellungen des Nutzers zu ändern.
  if (c.design && c.design.jarvis) c.design = { ...c.design, modus: 'dunkel', akzent: '#22E6FF', glow: true };
  return {
    ...c,
    schluesselGesetzt: !!apiSchluessel(),
    bereit: bereit(),
    anbieterListe: anbieterListe.fuerOberflaeche({ claudeCode: !!claudeCodePfad() }),
    version: version(),
    monitore: bildschirm.beschreibung(),
  };
}

function texteFuerRenderer() {
  const sc = config.get('sprachcode');
  const name = assistentName();
  const texte = {};
  for (const [k, v] of Object.entries({ ...TEXTE.de, ...TEXTE[sc] })) texte[k] = v.split('{name}').join(name);
  return { sprachcode: sc, texte };
}

function melden(titel, text) {
  if (Notification.isSupported()) new Notification({ title: titel, body: text, icon: fensterBild() }).show();
}

// --- Fenster ---

// --- Design: Theme und Fensterrahmen ---

function hintergrund() {
  return nativeTheme.shouldUseDarkColors ? '#09090D' : '#F3F3F7';
}

// Die Fensterknöpfe (minimieren, schließen) zeichnet Windows über den eigenen Kopf.
function titelLeiste(hoehe) {
  return {
    color: nativeTheme.shouldUseDarkColors ? '#0B0B10' : '#F1F1F5',
    symbolColor: nativeTheme.shouldUseDarkColors ? '#E8E8F0' : '#22222C',
    height: hoehe,
  };
}

function fensterFarben() {
  for (const w of [chatFenster, einstFenster]) {
    if (!w || w.isDestroyed()) continue;
    w.setBackgroundColor(hintergrund());
    try { w.setTitleBarOverlay(titelLeiste(w.juliaKopfHoehe || 48)); } catch { /* ältere Windows-Versionen */ }
  }
}

function designAnwenden() {
  const modus = config.get('design.jarvis') ? 'dunkel' : config.get('design.modus');
  nativeTheme.themeSource = modus === 'hell' ? 'light' : modus === 'system' ? 'system' : 'dark';
  fensterFarben();
}

function fensterOptionen(extra, kopfHoehe = 48) {
  return {
    icon: fensterBild(),
    show: false,
    autoHideMenuBar: true,
    backgroundColor: hintergrund(),
    titleBarStyle: 'hidden',
    titleBarOverlay: titelLeiste(kopfHoehe),
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: true },
    ...extra,
  };
}

// Das Hauptfenster: Seitenleiste mit Start und Chat. Schmal gezogen wird die
// Leiste zur Icon-Leiste, dann passt es auch neben ein Spiel oder eine IDE.
function chatFensterErstellen() {
  const wa = screen.getPrimaryDisplay().workArea;
  const breite = Math.min(1080, wa.width - 80);
  const hoehe = Math.min(740, wa.height - 60);
  chatFenster = new BrowserWindow(fensterOptionen({
    width: breite,
    height: hoehe,
    minWidth: 420,
    minHeight: 460,
    x: wa.x + Math.round((wa.width - breite) / 2),
    y: wa.y + Math.round((wa.height - hoehe) / 2),
    title: assistentName(),
  }, 50));
  chatFenster.juliaKopfHoehe = 50;
  // Mehr Diagnose beim Start (Issue #3/#54): Laden-fertig, Ladefehler und
  // „reagiert nicht" ins Start-Logbuch. Hilft, ein leeres Fenster einzugrenzen.
  const wc = chatFenster.webContents;
  wc.on('did-finish-load', () => startLog.schreiben('RENDERER', 'Chat-Fenster fertig geladen'));
  wc.on('did-fail-load', (_e, code, beschreibung, url) => startLog.schreiben('RENDERER-FEHLER', 'Chat-Fenster konnte nicht laden', { code, beschreibung: String(beschreibung || '').slice(0, 120), url: String(url || '').slice(0, 80) }));
  wc.on('unresponsive', () => startLog.schreiben('RENDERER-FEHLER', 'Chat-Fenster reagiert nicht (unresponsive)'));
  wc.on('responsive', () => startLog.schreiben('RENDERER', 'Chat-Fenster reagiert wieder'));
  chatFenster.loadFile(path.join(RENDERER, 'chat.html'));
  chatFenster.on('close', (e) => {
    if (!beendenLaeuft) {
      e.preventDefault();
      chatFenster.hide();
    }
  });
}

// ansicht: 'chat' (Hotkey, Sprache, Freigaben), 'start' oder null (so lassen).
function chatZeigen(ansicht = 'chat') {
  if (!chatFenster || chatFenster.isDestroyed()) chatFensterErstellen();
  if (chatFenster.isMinimized()) chatFenster.restore();
  if (ansicht) {
    const senden = () => chatFenster.webContents.send('ansicht', ansicht);
    if (chatFenster.webContents.isLoading()) chatFenster.webContents.once('did-finish-load', senden);
    else senden();
  }
  chatFenster.show();
  chatFenster.focus();
}

function chatUmschalten(ansicht = 'chat') {
  if (chatFenster && chatFenster.isVisible() && chatFenster.isFocused()) chatFenster.hide();
  else chatZeigen(ansicht);
}

// Startseite: kurz zwischengespeichert, damit nicht jeder Wechsel Gmail fragt.
let ueberblickZwischen = null;
async function startUeberblick(neu) {
  if (VORFUEHRUNG) return require('./vorfuehrung').beispielUeberblick(config);
  if (!neu && ueberblickZwischen && Date.now() - ueberblickZwischen.jetzt < 60000) return ueberblickZwischen;
  ueberblickZwischen = await require('./ueberblick').ueberblick({
    config, erinnerungen, kosten, konten, systemStatus: () => win.systemStatus(),
  });
  return ueberblickZwischen;
}

function einstellungenOeffnen(einrichtung = false) {
  if (einstFenster && !einstFenster.isDestroyed()) {
    einstFenster.show();
    einstFenster.focus();
    return einstFenster;
  }
  einstFenster = new BrowserWindow(fensterOptionen({
    width: 680,
    height: 820,
    minWidth: 520,
    minHeight: 500,
    title: t('einst.titel'),
  }, 64));
  einstFenster.juliaKopfHoehe = 64;
  einstFenster.loadFile(path.join(RENDERER, 'einstellungen.html'), { query: { einrichtung: einrichtung ? '1' : '0' } });
  einstFenster.once('ready-to-show', () => einstFenster.show());
  einstFenster.on('closed', () => { einstFenster = null; });
  return einstFenster;
}

// Die Blase: nur sichtbar, wenn blase.an gesetzt ist. Klicks gehen durch sie
// hindurch – nur auf der Kugel selbst greift die Maus: ziehen verschiebt sie,
// Doppelklick öffnet den Chat. Darunter auf Wunsch Untertitel.
const UNTERTITEL_HOEHE = 120;

function blaseGrenzen() {
  const b = config.get('blase');
  const ds = bildschirm.monitore();
  const d = ds[b.monitor] || ds[ds.length - 1];
  const wa = d.workArea;
  const s = Math.round(b.groesse / d.scaleFactor);
  const breite = b.untertitel ? Math.max(s, 340) : s;
  const hoehe = s + (b.untertitel ? UNTERTITEL_HOEHE : 0);
  const rand = 24;
  let x = b.ecke.endsWith('rechts') ? wa.x + wa.width - breite - rand : wa.x + rand;
  let y = b.ecke.startsWith('unten') ? wa.y + wa.height - hoehe - rand : wa.y + rand;
  // Selbst verschoben? Dann dorthin – solange die Stelle noch auf einem Bildschirm liegt.
  const p = b.position;
  if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) {
    const mitte = { x: p.x + breite / 2, y: p.y + s / 2 };
    const sichtbar = screen.getAllDisplays().some((m) => {
      const w = m.workArea;
      return mitte.x >= w.x && mitte.x <= w.x + w.width && mitte.y >= w.y && mitte.y <= w.y + w.height;
    });
    if (sichtbar) { x = p.x; y = p.y; }
  }
  return { x: Math.round(x), y: Math.round(y), width: breite, height: hoehe };
}

function blaseAktualisieren() {
  const b = config.get('blase');
  if (!b.an) {
    if (orbFenster && !orbFenster.isDestroyed()) orbFenster.destroy();
    orbFenster = null;
    return;
  }
  const grenzen = blaseGrenzen();

  if (!orbFenster || orbFenster.isDestroyed()) {
    orbFenster = new BrowserWindow({
      ...grenzen,
      transparent: true,
      frame: false,
      resizable: false,
      movable: true,
      minimizable: false,
      maximizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: false,
      hasShadow: false,
      show: false,
      backgroundColor: '#00000000',
      webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false },
    });
    // Durchklickbar, aber Mausbewegungen kommen an – so merkt die Seite, wann
    // der Zeiger über der Kugel ist, und schaltet nur dort die Maus ein.
    mausDurchlassen(orbFenster, true);
    orbFenster.setAlwaysOnTop(true, 'screen-saver');
    orbFenster.loadFile(path.join(RENDERER, 'blase.html'));
    orbFenster.once('ready-to-show', () => {
      orbFenster.showInactive();
      orbFenster.setBounds(grenzen);
    });
  } else {
    // Zweimal setzen: Beim Wechsel auf einen Monitor mit anderer Skalierung
    // stimmt die Größe erst im zweiten Anlauf.
    orbFenster.juliaText = UNTERTITEL_HOEHE;
    orbFenster.juliaHoch = 0;
    orbFenster.setBounds(grenzen);
    orbFenster.setBounds(grenzen);
  }
}

// --- Gaming-Overlay ---
// Kleines, halbtransparentes Chatfenster über Spielen (Fenster- oder randloses
// Vollbild; bei exklusivem Vollbild zeigt Windows keine Overlays).
// Aktiv: bekommt Fokus zum Tippen. Passiv: Klicks gehen durch, das Spiel
// behält den Fokus – für kurz eingeblendete Antworten auf Sprachbefehle.

function overlayGrenzen() {
  const o = config.get('overlay');
  const ds = bildschirm.monitore();
  const d = ds[o.monitor] || ds[0];
  const wa = d.workArea;
  const rand = 24;
  const breite = Math.round(Math.min(o.breite || 380, wa.width - 2 * rand));
  const hoehe = Math.round(Math.min(o.hoehe || 560, wa.height - 48));
  // Selbst verschoben: dort bleiben – solange die Stelle noch auf einem Bildschirm liegt.
  const p = o.position;
  if (p && ds.some((m) => p.x + 40 > m.workArea.x && p.x < m.workArea.x + m.workArea.width - 40 && p.y >= m.workArea.y - 10 && p.y < m.workArea.y + m.workArea.height - 40)) {
    return { x: p.x, y: p.y, width: breite, height: hoehe };
  }
  const x = o.ecke.endsWith('rechts') ? wa.x + wa.width - breite - rand : wa.x + rand;
  const y = o.ecke.startsWith('unten') ? wa.y + wa.height - hoehe - rand : wa.y + rand;
  return { x: Math.round(x), y: Math.round(y), width: breite, height: hoehe };
}

function overlayErstellen() {
  overlayFenster = new BrowserWindow({
    ...overlayGrenzen(),
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    title: assistentName(),
    icon: fensterBild(),
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  overlayFenster.setAlwaysOnTop(true, 'screen-saver');
  overlayFenster.setOpacity(config.get('overlay.deckkraft'));
  // An der Kopfzeile verschoben: die Stelle merken (kommt erst nach dem Loslassen).
  overlayFenster.on('moved', () => {
    if (!overlayFenster || overlayFenster.isDestroyed()) return;
    const [x, y] = overlayFenster.getPosition();
    config.set('overlay.position', { x, y });
  });
  overlayFenster.loadFile(path.join(RENDERER, 'chat.html'), { query: { overlay: '1' } });
  overlayFenster.on('close', (e) => {
    if (!beendenLaeuft) {
      e.preventDefault();
      overlayVerstecken();
    }
  });
  // Zurück ins Spiel geklickt: Beim Spielen wird das Overlay wieder durchlässig.
  overlayFenster.on('blur', () => {
    if (!overlayPassiv && (spielAktiv || config.get('overlay.immer')) && overlaySichtbar()) overlayZeigen({ passiv: true });
  });
  return overlayFenster;
}

// Durchklickbare Fenster (Blase, Overlay, Zugriffs-Hinweis): Mausbewegungen
// reicht Electron unter Windows über einen Maus-Hook für den ganzen PC weiter.
// Der hängt nur, solange der Zeiger wirklich über so einem Fenster ist – sonst
// wartet jede Mausbewegung im Spiel auf Julia, und das fühlt sich wie Lag an.
const durchlaessig = new Map(); // Fenster -> Mausbewegungen gerade weitergereicht?
let durchlaessigTimer = null;

function zeigerUeber(f) {
  if (!f.isVisible()) return false;
  const p = screen.getCursorScreenPoint();
  const b = f.getBounds();
  return p.x >= b.x && p.x < b.x + b.width && p.y >= b.y && p.y < b.y + b.height;
}

function durchlaessigPruefen() {
  for (const [f, an] of durchlaessig) {
    if (f.isDestroyed()) { durchlaessig.delete(f); continue; }
    const drueber = zeigerUeber(f);
    if (drueber !== an) {
      durchlaessig.set(f, drueber);
      f.setIgnoreMouseEvents(true, drueber ? { forward: true } : undefined);
    }
  }
  if (!durchlaessig.size) { clearInterval(durchlaessigTimer); durchlaessigTimer = null; }
}

// durch = true: Klicks gehen durch; über dem Fenster kommen Mausbewegungen an,
// damit die Seite selbst entscheiden kann, wo sie greifbar wird.
function mausDurchlassen(f, durch) {
  if (!f || f.isDestroyed()) return;
  if (!durch) {
    durchlaessig.delete(f);
    f.setIgnoreMouseEvents(false);
    return;
  }
  const drueber = zeigerUeber(f);
  durchlaessig.set(f, drueber);
  f.setIgnoreMouseEvents(true, drueber ? { forward: true } : undefined);
  if (!durchlaessigTimer) durchlaessigTimer = setInterval(durchlaessigPruefen, 120);
}

function overlayZeigen({ passiv = false } = {}) {
  if (!overlayFenster || overlayFenster.isDestroyed()) overlayErstellen();
  clearTimeout(overlayTimer);
  overlayPassiv = passiv;
  const o = overlayFenster;
  // Passiv: Klicks gehen ans Spiel; fährt die Maus über den Chat, schaltet
  // overlay:maus ihn greifbar (scrollen, klicken).
  mausDurchlassen(o, passiv);
  o.setFocusable(!passiv);
  const zeigen = () => {
    o.webContents.send('overlay:modus', passiv ? 'passiv' : 'aktiv');
    if (passiv) o.showInactive();
    else { o.show(); o.focus(); }
  };
  if (o.webContents.isLoading()) o.webContents.once('did-finish-load', zeigen);
  else zeigen();
  return o;
}

function overlayVerstecken() {
  clearTimeout(overlayTimer);
  if (overlayFenster && !overlayFenster.isDestroyed()) overlayFenster.hide();
}

function overlaySichtbar() {
  return !!overlayFenster && !overlayFenster.isDestroyed() && overlayFenster.isVisible();
}

function overlayUmschalten() {
  // Mit "immer anzeigen" schaltet der Hotkey nur zwischen aktiv und durchlässig.
  if (overlaySichtbar() && !overlayPassiv) {
    if (config.get('overlay.immer')) overlayZeigen({ passiv: true });
    else overlayVerstecken();
  } else overlayZeigen({ passiv: false });
}

function overlaySpaeterVerstecken(ms = (config.get('overlay.ausblenden') || 12) * 1000) {
  clearTimeout(overlayTimer);
  overlayTimer = setTimeout(() => { if (overlayPassiv && !spielAktiv && !config.get('overlay.immer')) overlayVerstecken(); }, ms);
}

// Läuft ein Spiel im Vordergrund, erscheint das Overlay von selbst – passiv:
// Klicks gehen durch, das Spiel behält den Fokus. Ist das Spiel weg, geht es
// wieder, aber nur, wenn Julia es selbst eingeblendet hat.
let spielAktiv = null;
let spielTimer = null;
let spielPruefLaeuft = false;

async function spielPruefen() {
  if (spielPruefLaeuft) return;
  spielPruefLaeuft = true;
  try {
    if (!config.get('overlay.automatisch')) {
      if (spielAktiv) {
        spielAktiv = null;
        if (overlaySichtbar() && overlayPassiv && !config.get('overlay.immer')) overlayVerstecken();
      }
      return;
    }
    const v = await win.vordergrundInfo();
    if (!v || v.pid === process.pid) return; // Julias eigene Fenster ändern nichts
    const s = istSpiel(v, config.get('overlay.spiele'));
    if (s.spiel) {
      if (spielAktiv !== s.name) {
        spielAktiv = s.name;
        if (!overlaySichtbar()) overlayZeigen({ passiv: true });
      }
    } else if (spielAktiv) {
      spielAktiv = null;
      if (overlaySichtbar() && overlayPassiv && !config.get('overlay.immer')) overlayVerstecken();
    }
  } catch {
    /* nächster Versuch in drei Sekunden */
  } finally {
    spielPruefLaeuft = false;
  }
}

function spielWaechterStarten() {
  clearInterval(spielTimer);
  spielTimer = setInterval(spielPruefen, 3000);
  overlayImmerAnwenden();
}

// "Immer anzeigen": durchlässig stehen lassen, auch ohne Spiel.
function overlayImmerAnwenden() {
  if (config.get('overlay.immer')) {
    if (!overlaySichtbar()) overlayZeigen({ passiv: true });
  } else if (overlaySichtbar() && overlayPassiv && !spielAktiv) overlayVerstecken();
}

// --- Tray, Hotkeys, Autostart ---

function trayMenue() {
  const menue = Menu.buildFromTemplate([
    { label: t('tray.chat'), click: chatZeigen },
    { label: `${t('tray.sprechen')}   (${config.get('hotkey.sprechen')})`, click: sprachUmschalten },
    { label: `${t('tray.overlay')}   (${config.get('hotkey.overlay') || '–'})`, click: overlayUmschalten },
    { type: 'separator' },
    { label: t('tray.blase'), type: 'checkbox', checked: config.get('blase.an'), click: (m) => config.set('blase.an', m.checked) },
    { label: t('tray.weckwort'), type: 'checkbox', checked: config.get('weckwort.an'), click: (m) => config.set('weckwort.an', m.checked) },
    { label: t('tray.neu'), click: () => { agent.neu(); anAlle('chat:geleert'); } },
    { label: t('tray.einstellungen'), click: () => einstellungenOeffnen(false) },
    { type: 'separator' },
    { label: t('tray.updates'), click: updatesManuell },
    { label: t('tray.protokoll'), click: () => shell.openPath(DATEN) },
    { type: 'separator' },
    { label: `${t('tray.beenden')}  ·  v${version()}`, click: () => { beendenLaeuft = true; app.quit(); } },
  ]);
  tray.setContextMenu(menue);
  // Sichtbar machen, wenn das Mikrofon auf das Aktivierungswort lauscht.
  tray.setToolTip(config.get('weckwort.an') ? t('tray.tooltip_weckwort') : `${t('tray.tooltip')} ${version()}`);
}

function hotkeysRegistrieren() {
  globalShortcut.unregisterAll();
  const paare = [[config.get('hotkey.sprechen'), sprachUmschalten], [config.get('hotkey.chat'), chatUmschalten]];
  if (config.get('hotkey.overlay')) paare.push([config.get('hotkey.overlay'), overlayUmschalten]);
  if (config.get('hotkey.auswahl')) paare.push([config.get('hotkey.auswahl'), () => { auswahlHolen().catch(() => {}); }]);
  if (config.get('hotkey.clip')) paare.push([config.get('hotkey.clip'), () => { clipJetzt(); }]);
  for (const [taste, aktion] of paare) {
    let ok = false;
    try { ok = globalShortcut.register(taste, aktion); } catch { ok = false; }
    if (!ok) melden(assistentName(),t('hotkey.fehler', { hotkey: taste }));
  }
}

function autostartSetzen() {
  app.setLoginItemSettings({
    openAtLogin: !!config.get('autostart'),
    path: process.execPath,
    args: app.isPackaged ? ['--versteckt'] : [APP, '--versteckt'],
  });
}

// --- Gespräch und Sprache ---

// Bilder für Anhänge: verkleinert und neu kodiert – dabei fallen Metadaten
// wie GPS-Koordinaten weg.
async function bildLesen(pfad) {
  let bild = nativeImage.createFromPath(pfad);
  if (bild.isEmpty()) throw new Error('Bild nicht lesbar');
  const { width, height } = bild.getSize();
  const faktor = Math.min(1, 1600 / Math.max(width, height));
  if (faktor < 1) bild = bild.resize({ width: Math.round(width * faktor), height: Math.round(height * faktor), quality: 'best' });
  const g = bild.getSize();
  return { jpeg: bild.toJPEG(85).toString('base64'), breite: g.width, hoehe: g.height };
}

// pfade: angehängte Dateien; bloecke: fertige Inhalte (markierter Text);
// anzeige: was im Chat als deine Nachricht steht, wenn es vom Auftrag abweicht.
async function nachrichtSenden(text, perSprache, { pfade = [], bloecke = [], anzeige = null, anzeigeAnhaenge = [] } = {}) {
  let sauber = String(text || '').trim();
  if (!sauber && !pfade.length) return;
  if (!sauber) sauber = t('chat.nur_dateien');
  sprache.stumm();
  // Jarvis-Umschalter – auch per Sprache: „jarvis" ein, „julia" zurück.
  if (!pfade.length) {
    const wort = sauber.toLowerCase().replace(/[\s.!?]+/g, ' ').trim();
    const jetztJarvis = config.get('design.jarvis');
    if (!jetztJarvis && /^(hey |okay |ok )?jarvis$/.test(wort)) {
      config.set('design.jarvis', true);
      const ansage = 'J.A.R.V.I.S. online. Zu Ihren Diensten, Sir.';
      anAlle('agent:nutzer', { text: sauber, perSprache });
      anAlle('system:zeile', { text: ansage });
      if (perSprache) sprache.sprechen(ansage, { stimme: vorleseStimme(), tempo: config.get('sprache.tempo'), sprachcode: config.get('sprachcode'), lautsprecher: config.get('sprache.lautsprecher') }).catch(() => {});
      return ansage;
    }
    if (jetztJarvis && /^(hey |okay |ok )?julia$/.test(wort)) {
      config.set('design.jarvis', false);
      const ansage = 'Zurück im normalen Modus.';
      anAlle('agent:nutzer', { text: sauber, perSprache });
      anAlle('system:zeile', { text: ansage });
      if (perSprache) sprache.sprechen(ansage, { stimme: vorleseStimme(), tempo: config.get('sprache.tempo'), sprachcode: config.get('sprachcode'), lautsprecher: config.get('sprache.lautsprecher') }).catch(() => {});
      return ansage;
    }
  }
  const a = pfade.length
    ? await anhaengeLesen(pfade, { anbieterArt: anbieterListe.anbieterVon(config).art, bildLesen, sc: config.get('sprachcode') })
    : { bloecke: [], namen: [] };
  anAlle('agent:nutzer', { text: anzeige || sauber, perSprache, anhaenge: [...anzeigeAnhaenge, ...a.namen] });
  // Vorlesen satzweise, sobald die ersten Sätze da sind – nicht erst, wenn die
  // ganze Antwort fertig ist.
  const modus = config.get('sprache.vorlesen');
  const leser = modus === 'immer' || (modus === 'bei-sprache' && perSprache)
    ? sprache.vorleser({
      stimme: vorleseStimme(),
      tempo: config.get('sprache.tempo'),
      sprachcode: config.get('sprachcode'),
      lautsprecher: config.get('sprache.lautsprecher'),
    })
    : null;
  const mitlesen = (d) => leser.text(d);
  if (leser) agent.on('text', mitlesen);
  let antwort = null;
  try {
    antwort = await agent.senden(sauber, { perSprache, anhaenge: [...a.bloecke, ...bloecke] });
  } catch (e) {
    if (e.message === 'BESCHAEFTIGT') anAlle('agent:hinweis', { art: 'beschaeftigt' });
    else anAlle('agent:fehler', { art: 'text', text: e.message });
    if (leser) {
      agent.off('text', mitlesen);
      sprache.stumm();
      await leser.fertig();
    }
    return;
  }
  if (!leser) return;
  agent.off('text', mitlesen);
  if (antwort) zustandSetzen('speaking');
  await leser.fertig();
  if (zustand === 'speaking') zustandSetzen('idle');
}

// Natürliche Stimme (Piper): Wer sie auswählt, bekommt sie einmal geladen –
// bis dahin spricht die Windows-Stimme. still: ohne Meldung (die Einstellungen
// zeigen den Fortschritt selbst).
let piperGemeldet = false;
function piperNachladen(id, still = false) {
  if (!piper || !piper.stimmen[id] || piper.laden || VORFUEHRUNG) return;
  const stimme = piper.stimmen[id].name;
  if (!still && !piperGemeldet) {
    piperGemeldet = true;
    melden(assistentName(), t('piper.laedt_hinweis', { stimme }));
  }
  piper.herunterladen(id)
    .then(() => melden(assistentName(), t('piper.bereit', { stimme })))
    .catch((e) => protokoll.eintragen({ werkzeug: 'sprache', stufe: 'INFO', ergebnis: `Stimme ${stimme} nicht geladen: ${e.message}` }));
}

let piperFehlerGemeldet = false;
function piperFehlerMelden(fehler) {
  protokoll.eintragen({ werkzeug: 'sprache', stufe: 'INFO', ergebnis: `Piper: ${fehler}` });
  if (piperFehlerGemeldet) return;
  piperFehlerGemeldet = true;
  melden(assistentName(), t('piper.fehler', { fehler }));
}

// Whisper schreibt auf, sobald Programm und Modell da sind – sonst bleibt es
// bei der Windows-Erkennung. Fehlt nur das Modell, lädt Julia es einmal nach.
function spracherkennung() {
  if (!whisper || config.get('sprache.erkennung') !== 'whisper') return null;
  const stufe = config.get('sprache.whisper_modell');
  if (!whisper.bereit(stufe)) {
    whisperNachladen(stufe);
    return null;
  }
  return (wav) => whisper.erkennen(wav, { sprachcode: config.get('sprachcode'), stufe });
}

let whisperGemeldet = false;
function whisperNachladen(stufe) {
  if (!whisper || !whisper.programm || whisper.laden || VORFUEHRUNG) return;
  if (!whisperGemeldet) {
    whisperGemeldet = true;
    melden(assistentName(), t('whisper.laedt_hinweis', { mb: whisper.status().modelle[stufe].mb }));
  }
  whisper.herunterladen(stufe)
    .then(() => melden(assistentName(), t('whisper.bereit')))
    .catch((e) => protokoll.eintragen({ werkzeug: 'sprache', stufe: 'INFO', ergebnis: `Whisper-Modell nicht geladen: ${e.message}` }));
}

function whisperStatus() {
  const s = whisper ? whisper.status() : { programm: false, modelle: {}, laedt: null, fehler: null };
  return { ...s, erkennung: config.get('sprache.erkennung'), stufe: config.get('sprache.whisper_modell') };
}

let whisperFehlerGemeldet = false;
function whisperFehlerMelden(fehler) {
  protokoll.eintragen({ werkzeug: 'sprache', stufe: 'INFO', ergebnis: `Whisper: ${fehler}` });
  if (whisperFehlerGemeldet) return;
  whisperFehlerGemeldet = true;
  melden(assistentName(), t('whisper.fehler', { fehler }));
}

// Sperrt Windows das Mikrofon (Datenschutz), kommt nur Stille an – das einmal
// klar sagen und die passende Windows-Einstellung öffnen.
let mikroSperreGemeldet = false;
let mikroTestLaeuft = false;
async function mikrofonSperrePruefen() {
  if (mikroSperreGemeldet || VORFUEHRUNG) return;
  const k = await mikrofonRecht.pruefen().catch(() => null);
  if (!k || mikroSperreGemeldet) return;
  mikroSperreGemeldet = true;
  protokoll.eintragen({ werkzeug: 'sprache', stufe: 'INFO', ergebnis: `Mikrofon von Windows gesperrt (${k})` });
  melden(assistentName(), t(`mikro.gesperrt_${k}`));
  if (k !== 'richtlinie') shell.openExternal('ms-settings:privacy-microphone').catch(() => {});
}

async function sprachUmschalten() {
  // Diagnose fürs Mikro (Nutzer meldet „bricht random ab"): jeden Zweig ins
  // Start-Logbuch, damit der nächste Fehlversuch eindeutig zeigt, was passiert.
  if (sprache.hoertZu) { startLog.schreiben('MIKRO', 'Hotkey während Zuhören → abgebrochen (Toggle aus)'); sprache.zuhoerenAbbrechen(); return; }
  if (sprache.sprichtGerade) { startLog.schreiben('MIKRO', 'Hotkey während Sprechen → stumm', { sprechenProc: !!sprache.sprechenProc, vorleserAktiv: sprache.vorleserAktiv }); sprache.stumm(); zustandSetzen('idle'); return; }
  if (agent.beschaeftigt) { startLog.schreiben('MIKRO', 'Hotkey ignoriert – Agent beschäftigt'); anAlle('agent:hinweis', { art: 'beschaeftigt' }); return; }
  hoert = true;
  zustandSetzen('listening');
  anAlle('sprache:hoert', true);
  const beginn = Date.now();
  startLog.schreiben('MIKRO', 'Zuhören gestartet', { erkennung: config.get('sprache.erkennung'), mikro: config.get('sprache.mikrofon') ? 'eigenes' : 'Standard', pauseS: config.get('sprache.pause_s') });
  let text = '';
  try {
    text = await sprache.zuhoeren(config.get('sprachcode'), { mikrofon: config.get('sprache.mikrofon'), whisper: spracherkennung(), endeStilleMs: Math.round((config.get('sprache.pause_s') || 1.6) * 1000) });
    startLog.schreiben('MIKRO', 'Zuhören fertig', { dauerMs: Date.now() - beginn, textLaenge: (text || '').length });
  } catch (e) {
    startLog.schreiben('MIKRO', 'Zuhören-Fehler', { dauerMs: Date.now() - beginn, fehler: String(e && e.message || e).slice(0, 200) });
    chatZeigen();
    anAlle('agent:fehler', { art: 'text', text: e.message });
  } finally {
    hoert = false;
    anAlle('sprache:hoert', false);
    if (zustand === 'listening' || zustand === 'thinking') zustandSetzen('idle'); // thinking: Whisper schrieb gerade
  }
  if (!text) {
    mikrofonSperrePruefen();
    // Sichtbare Rückmeldung, statt still zur „wartet"-Ansicht zurückzuspringen –
    // sonst wirkt es, als „ginge das Mikro nicht" (Nutzer-Feedback). So weiß man:
    // zugehört, aber nichts verstanden → Mikro/Erkennung prüfen (Mikro-Test).
    anAlle('agent:hinweis', { art: 'nichts_verstanden' });
  }
  if (text) {
    // Beim Spielen: Antwort passiv einblenden, ohne dem Spiel den Fokus zu nehmen.
    const hud = config.get('overlay.bei_antwort') === 'passiv' && !(overlaySichtbar() && !overlayPassiv);
    if (hud) overlayZeigen({ passiv: true });
    await nachrichtSenden(text, true);
    if (hud) overlaySpaeterVerstecken();
  }
}

// --- Updates ---

async function updatesManuell() {
  const r = await updater.pruefen();
  if (r.fehler) {
    dialog.showMessageBox({ type: 'warning', title: t('update.titel'), message: t('update.fehler', { fehler: r.fehler }) });
    return;
  }
  if (!r.neu) {
    dialog.showMessageBox({ type: 'info', title: t('update.titel'), message: t('update.aktuell', { version: r.aktuell }) });
    return;
  }
  const { response } = await dialog.showMessageBox({
    type: 'question',
    title: t('update.titel'),
    message: t('update.neu', { neu: r.neu, alt: r.aktuell }),
    detail: [...r.zeilen, '', t('update.frage')].join('\n'),
    buttons: [t('update.einspielen'), t('update.spaeter')],
    defaultId: 0,
    cancelId: 1,
  });
  if (response !== 0) return;
  const sofort = updater.nachAufgabeEinspielen(r.neu);
  if (!sofort) melden(t('update.titel'), t('update.wartet'));
}

// Beim Start und danach alle zwei Stunden. Mitten im Spiel oder mit Julia auf
// einem Minecraft-Server startet sie nicht neu – dann eben beim nächsten Mal.
let updateGemeldet = null;
async function updatesAutomatisch() {
  if (!config.get('update.pruefen')) return;
  if (spielAktiv || (minecraft && minecraft.verbunden)) return;
  const r = await updater.pruefen();
  if (r.fehler || !r.neu) return;
  if (config.get('update.automatisch')) updater.nachAufgabeEinspielen(r.neu);
  else if (updateGemeldet !== r.neu) {
    updateGemeldet = r.neu;
    melden(t('update.titel'), t('update.verfuegbar_hinweis', { version: r.neu }));
  }
}

// --- IPC ---

function ipcEinrichten() {
  const ipc = sicherheit.ipcAbsichern(ipcMain, RENDERER, (kanal, url) => {
    protokoll.eintragen({ werkzeug: 'ipc', stufe: 'ROT', ergebnis: 'abgelehnt', grund: `Nachricht auf ${kanal} von fremder Seite ${url}` });
  });
  // Fehlersystem: unbehandelte Fehler der Oberfläche (window.onerror /
  // unhandledrejection) landen im Start-Logbuch, damit ein „UI lädt nicht" (Issue
  // #3) diagnostizierbar ist. Bleibt lokal auf dem PC.
  ipc.on('diagnose:rendererFehler', (_e, info) => {
    const i = info && typeof info === 'object' ? info : {};
    startLog.schreiben('RENDERER-FEHLER', String(i.nachricht || 'unbekannt').slice(0, 300), {
      seite: String(i.seite || '').slice(0, 80),
      quelle: String(i.quelle || '').slice(0, 200),
      zeile: Number(i.zeile) || 0,
      art: String(i.art || '').slice(0, 20),
    });
    // Blieb die Oberfläche leer (Healthcheck), ohne dass ein GPU-/Renderer-Absturz
    // kam (Issue #3/#54)? Dann einmal auf Software-Rendering umstellen und neu
    // starten – das holt auf betroffenen PCs das Bild zurück. Nur einmal.
    if (i.art === 'ui-healthcheck' && !blankBehandelt) {
      blankBehandelt = true;
      setTimeout(() => {
        startpruefung.blankUiAbsichern({
          datenOrdner: DATEN,
          logbuch: startLog,
          neustart: () => { beendenLaeuft = true; app.relaunch(); app.exit(0); },
          fatal: (text) => startFatal(text),
        });
      }, 600);
    }
  });
  ipc.handle('texte', () => texteFuerRenderer());
  ipc.handle('config:lesen', () => {
    claudeCodePfad(true); // vielleicht inzwischen installiert
    return oeffentlicheConfig();
  });
  ipc.handle('config:setzen', (_e, schluessel, wert) => {
    if (/^(api|freigabe)\.|^minecraft\.konto$/.test(String(schluessel))) return { fehler: 'Nicht erlaubt.' };
    try { return { wert: config.set(schluessel, wert) }; } catch (e) { return { fehler: e.message }; }
  });
  // Content-Creation-Modul: Creator-Profile verwalten (nur über die Oberfläche;
  // kein KI-Werkzeug ändert diese Daten). Jeder Handler kapselt Fehler.
  ipc.handle('content:status', () => {
    const c = config.get('content') || {};
    return { aktiv: c.aktiv === true, modus: c.modus || 'lokal', tempo: c.tempo || 'normal', pfade: c.pfade || {} };
  });
  ipc.handle('content:profile-list', () => { try { return content.profileListe(); } catch (e) { return { fehler: e.message }; } });
  ipc.handle('content:profile-vorlage', (_e, name) => content.profilVorlage(name));
  ipc.handle('content:profile-speichern', (_e, profil) => { try { return { profil: content.profilSpeichern(profil) }; } catch (e) { return { fehler: e.message }; } });
  ipc.handle('content:profile-aktiv', (_e, id) => { try { return { ok: content.profilAktivSetzen(String(id || '')) }; } catch (e) { return { fehler: e.message }; } });
  ipc.handle('content:profile-loeschen', (_e, id) => { try { return { ok: content.profilLoeschen(String(id || '')) }; } catch (e) { return { fehler: e.message }; } });
  ipc.handle('content:profile-import', (_e, jsonText) => { try { return { anzahl: content.profilImportieren(String(jsonText || '')) }; } catch (e) { return { fehler: e.message }; } });
  ipc.handle('content:profile-export', (_e, id) => { try { return { json: content.profilExportieren(String(id || '')) }; } catch (e) { return { fehler: e.message }; } });
  // Content-Analyse (einfache Variante): Julia analysiert ein Video-Transkript oder
  // Kanal-Infos wie ein YouTube-Coach. Ein Einmal-Aufruf ohne Werkzeuge; nur Text.
  ipc.handle('content:analysieren', async (_e, eingabe) => {
    try {
      const { analysePrompt } = require('./content/analyse-video');
      const ein = eingabe || {};
      const { system, user } = analysePrompt({
        art: ein.art === 'kanal' ? 'kanal' : 'video',
        transkript: ein.transkript, kanalInfos: ein.kanalInfos, titel: ein.titel, notizen: ein.notizen,
        sprache: config.get('sprachcode'),
      });
      const antwort = await agent.einmalAntwort({ system, text: user, maxTokens: 1800 });
      return { antwort };
    } catch (e) { return { fehler: e.message }; }
  });
  // "Allem zustimmen" (und "auch nach fremden Inhalten") lassen sich nur hier
  // einschalten – nach einem Ja im Windows-Dialog. Julia selbst kann es nicht
  // (einstellung_setzen: ROT).
  const freigabeSchalter = (schluessel, texte) => async (_e, an) => {
    if (an) {
      const opts = {
        type: 'warning', buttons: [t(`${texte}.ja`), t('freigabe.nein')], defaultId: 1, cancelId: 1, noLink: true,
        title: t(`${texte}.titel`), message: t(`${texte}.frage`), detail: t(`${texte}.details`),
      };
      const r = einstFenster && !einstFenster.isDestroyed() ? await dialog.showMessageBox(einstFenster, opts) : await dialog.showMessageBox(opts);
      if (r.response !== 0) return { wert: config.get(schluessel) };
    }
    return { wert: config.set(schluessel, !!an) };
  };
  ipc.handle('freigabe:immer', freigabeSchalter('freigabe.immer', 'freigabe'));
  ipc.handle('freigabe:fremd', freigabeSchalter('freigabe.fremd', 'freigabe_fremd'));
  // Grafik-Reparatur (Issue #55): auf Nutzer-Klick auf Software-Grafik umstellen
  // (der Rettungsanker gegen ein leeres Fenster) und neu starten – bzw. wieder
  // normale Grafik versuchen. Software-Grafik ist reversibel und ohne Systemeingriff.
  ipc.handle('reparatur:status', () => {
    const gpu = letzteGpu || {};
    // Degradiert = Hardware-Grafik läuft, aber keine Treiber-Infos abrufbar.
    const degradiert = !startpruefung.softwareRendering(DATEN) && !gpu.renderer && !gpu.vendor && !gpu.treiber;
    return {
      software: !!startpruefung.softwareRendering(DATEN),
      modus: startpruefung.grafikModus(DATEN),
      degradiert,
      treiber: require('./treiber').treiberQuelle(gpu.vendorId),
    };
  });
  ipc.handle('reparatur:treiber', (_e, url) => {
    // Nur die bekannten Hersteller-Treiberseiten öffnen (keine beliebigen Links).
    const erlaubt = Object.values(require('./treiber').HERSTELLER).some((h) => h.url === String(url));
    if (erlaubt) shell.openExternal(String(url)).catch(() => {});
    return true;
  });
  ipc.handle('reparatur:software', (_e, an) => {
    startpruefung.softwareRenderingSetzen(DATEN, !!an);
    startLog.schreiben('GPU', an ? 'Software-Grafik vom Nutzer eingeschaltet (Reparatur) – Neustart.' : 'Normale Grafik vom Nutzer wieder aktiviert – Neustart.');
    setTimeout(() => { beendenLaeuft = true; app.relaunch(); app.exit(0); }, 200);
    return { software: !!an };
  });
  // Defender-Ausnahme für Julias eigene Ordner (Issue #97): hilft gegen
  // Lockfile-/„kein Zugriff"-Fehler beim Auto-Update. Nur Julias eigene Pfade,
  // nutzerinitiiert, mit UAC – nie aus KI-Eingaben.
  ipc.handle('defender:status', async () => {
    if (process.platform !== 'win32') return { verfuegbar: false, ausgeschlossen: false };
    try { return await defender.status([APP, DATEN]); } catch { return { verfuegbar: false, ausgeschlossen: false }; }
  });
  ipc.handle('defender:ausschliessen', async () => {
    if (process.platform !== 'win32') return { fehler: 'Nur unter Windows.' };
    const r = await defender.anwenden({ pfade: [APP, DATEN], prozesse: ['Julia AI.exe'] });
    if (r.ok) {
      startLog.schreiben('UPDATE', 'Defender-Ausnahme für Programm- und Datenordner gesetzt (Nutzer, Admin).');
      protokoll.eintragen({ werkzeug: 'system', stufe: 'INFO', ergebnis: 'Defender-Ausnahme gesetzt (Nutzer)' });
    }
    return r;
  });
  // Rollback auf die letzte funktionierende Version (Issue #100): startet den
  // gesicherten Installer der Vorgängerversion erneut. Nur, wenn ein Backup da ist.
  ipc.handle('update:zurueckrollen', () => (updater.zurueckRollen ? updater.zurueckRollen() : { fehler: 'Rollback ist in dieser Fassung nicht verfügbar.' }));
  ipc.handle('schluessel:setzen', (_e, s) => {
    try { schluesselSetzen(s); return { ok: true }; } catch (e) { return { fehler: e.message }; }
  });
  ipc.handle('anbieter:setzen', (_e, id) => {
    try {
      if (id === 'claude-abo' && !claudeCodePfad(true)) throw new Error(t('einst.fehlt_claude'));
      const alt = config.get('anbieter');
      config.set('anbieter', id);
      // Beim Wechsel das Standardmodell des neuen Anbieters vorschlagen.
      const vorschlag = anbieterListe.ANBIETER[id].modell;
      if (id !== alt && vorschlag) config.set('modell', vorschlag);
      return { config: oeffentlicheConfig() };
    } catch (e) {
      return { fehler: e.message, config: oeffentlicheConfig() };
    }
  });
  ipc.handle('anbieter:modelle', async () => {
    const a = anbieterListe.anbieterVon(config);
    if (a.art !== 'openai') return { modelle: a.modelle };
    try {
      if (!a.url) throw new Error(t('einst.fehlt_url'));
      return { modelle: await modelleLaden({ url: a.url, schluessel: apiSchluessel(a.id) }) };
    } catch (e) {
      return { fehler: e.message };
    }
  });
  ipc.handle('ordner:waehlen', async () => {
    const r = await dialog.showOpenDialog(einstFenster || undefined, { properties: ['openDirectory'] });
    return r.canceled ? null : r.filePaths[0];
  });
  ipc.handle('stimmen', () => sprache.stimmen());
  ipc.handle('audio:geraete', async () => {
    try { return await audio.geraete(); } catch (e) { return { eingaenge: [], ausgaenge: [], fehler: e.message }; }
  });
  // MCP-Server verwalten. Tokens gehen direkt in den Tresor, nie in die config.json.
  ipc.handle('mcp:status', () => (VORFUEHRUNG ? require('./vorfuehrung').beispielMcp() : mcp.status()));
  // Boost-Tab (Issue #26): rein lesende System-Infos für den Nutzer. Kein Eingriff.
  ipc.handle('boost:status', () => win.systemStatus());
  ipc.handle('boost:prozesse', async (_e, sortierung) => {
    const r = await win.prozesse(12, sortierung === 'cpu' ? 'cpu' : 'ram');
    // Für jede Zeile mitgeben, ob sie entlastet werden darf (Sperrliste = einzige Quelle).
    if (r && Array.isArray(r.prozesse)) r.prozesse = r.prozesse.map((p) => ({ ...p, geschuetzt: !win.darfBremsen(p.name) }));
    return r;
  });
  ipc.handle('boost:doppelte', (_e, pfad) => {
    const p = String(pfad || '').trim();
    if (!p) throw new Error('Kein Ordner gewählt.');
    return require('./doppelte').finden(path.resolve(p), { minGroesse: 1024 }); // ab 1 KB
  });
  // Prozess entlasten/zurücksetzen (Issue #19/#26): NUR über die Oberfläche auf
  // Nutzer-Klick, kein KI-Werkzeug. Priorität auf Idle statt echtem Einfrieren,
  // Sperrliste schützt System/Julia, umkehrbar.
  ipc.handle('boost:bremsen', async (_e, pid, name, an) => {
    try { return { ok: await win.prozessBremsen(pid, name, !!an) }; } catch (e) { return { fehler: e.message }; }
  });
  // Agenten-Rollen (Issue #58, BETA): vom Nutzer verwaltet. Die KI kann diese
  // nicht selbst setzen (kein Werkzeug dafür; einstellung_setzen erlaubt sie nicht).
  ipc.handle('rollen:lesen', () => ({
    an: !!config.get('beta').agenten,
    rollen: config.get('rollen') || [],
    aktiv: config.get('rolle_aktiv') || '',
  }));
  ipc.handle('rollen:speichern', (_e, rollen, aktiv) => {
    try {
      config.set('rollen', Array.isArray(rollen) ? rollen : []);
      // Aktive Rolle nur behalten, wenn sie noch existiert.
      const namen = (config.get('rollen') || []).map((r) => r.name);
      config.set('rolle_aktiv', namen.includes(String(aktiv || '')) ? String(aktiv) : '');
      return { ok: true, rollen: config.get('rollen'), aktiv: config.get('rolle_aktiv') };
    } catch (e) { return { fehler: e.message }; }
  });
  // Geheimnisse (Issue #26): nutzer-verwaltet, verschlüsselt. Nur Namen verlassen
  // den Hauptprozess – die Werte nie (auch nicht an die KI).
  ipc.handle('geheimnisse:liste', () => geheimnisse.namen());
  ipc.handle('geheimnisse:setzen', (_e, name, wert) => {
    try { geheimnisse.setzen(name, wert); return { namen: geheimnisse.namen() }; } catch (e) { return { fehler: e.message }; }
  });
  ipc.handle('geheimnisse:loeschen', (_e, name) => { geheimnisse.loeschen(name); return { namen: geheimnisse.namen() }; });
  // Liste der eingebauten Werkzeuge (Name + kurze Beschreibung) für die
  // Einstellungen – dort lassen sich einzelne Werkzeuge abschalten (werkzeuge_aus).
  ipc.handle('werkzeuge:liste', () => {
    const { WERKZEUGE } = require('./werkzeuge');
    const aus = config.get('werkzeuge_aus') || [];
    return WERKZEUGE.map((w) => ({
      name: w.name,
      beschreibung: String(w.description || '').split(/\.\s|\. /)[0].slice(0, 120),
      an: !aus.includes(w.name),
    }));
  });
  // Werkzeug-Kategorien für die Bulk-Abschaltung (Issue #75/#76).
  ipc.handle('werkzeuge:kategorien', () => {
    const { KATEGORIEN } = require('./werkzeuge');
    const aus = config.get('kategorien_aus') || [];
    return KATEGORIEN.map((k) => ({ id: k.id, an: !aus.includes(k.id), anzahl: k.werkzeuge.length }));
  });
  // MCP per JSON importieren (Issue #75, Drag-and-Drop): eine mcp.json wird erkannt
  // und ihre Server werden übernommen. vertraut bleibt false → jeder Aufruf über die Ampel.
  ipc.handle('mcp:import', (_e, text) => {
    let eintraege;
    try { eintraege = require('./mcp').mcpAusJson(text); } catch (e) { return { fehler: e.message, status: mcp.status() }; }
    const fehler = [];
    let anzahl = 0;
    for (const roh of eintraege) {
      try {
        const eintrag = mcpEintragPruefen({ ...roh, id: undefined });
        if (roh.umgebung) mcp.umgebungSetzen(eintrag.id, String(roh.umgebung));
        config.set('mcp.server', mcpOhneDoppelte([...config.get('mcp.server'), eintrag]));
        anzahl += 1;
      } catch (e) { fehler.push(`${roh.name || 'Server'}: ${e.message}`); }
    }
    if (anzahl) protokoll.eintragen({ werkzeug: 'mcp', stufe: 'INFO', ergebnis: `${anzahl} MCP-Server per JSON importiert` });
    return { ok: anzahl > 0, anzahl, fehler, status: mcp.status() };
  });
  ipc.handle('mcp:hinzufuegen', (_e, d) => {
    try {
      const eintrag = mcpEintragPruefen({ ...(d || {}), id: undefined });
      if (d && d.umgebung) mcp.umgebungSetzen(eintrag.id, String(d.umgebung));
      config.set('mcp.server', mcpOhneDoppelte([...config.get('mcp.server'), eintrag]));
      protokoll.eintragen({ werkzeug: 'mcp', stufe: 'INFO', ergebnis: `MCP-Server „${eintrag.name}“ hinzugefügt` });
      return { ok: true, status: mcp.status() };
    } catch (e) {
      return { fehler: e.message, status: mcp.status() };
    }
  });
  ipc.handle('mcp:entfernen', (_e, id) => {
    config.set('mcp.server', config.get('mcp.server').filter((s) => s.id !== id));
    mcp.umgebungSetzen(String(id), null);
    return mcp.status();
  });
  ipc.handle('mcp:schalten', (_e, id, an) => {
    config.set('mcp.server', config.get('mcp.server').map((s) => (s.id === id ? { ...s, an: !!an } : s)));
    return mcp.status();
  });
  ipc.handle('mcp:neu', async (_e, id) => { await mcp.neuStarten(String(id)); return mcp.status(); });
  ipc.handle('piper:status', () => (VORFUEHRUNG ? require('./vorfuehrung').beispielPiper() : piper.status()));
  ipc.handle('piper:laden', () => {
    const s = String(config.get('sprache.stimme') || '');
    if (s.startsWith('piper:')) piperNachladen(s.slice(6), true);
    return piper.status();
  });
  ipc.handle('piper:abbrechen', () => { piper.abbrechen(); return piper.status(); });
  ipc.handle('whisper:status', () => (VORFUEHRUNG ? require('./vorfuehrung').beispielWhisper() : whisperStatus()));
  ipc.handle('whisper:laden', () => {
    const stufe = config.get('sprache.whisper_modell');
    if (whisper) whisper.herunterladen(stufe).then(() => melden(assistentName(), t('whisper.bereit'))).catch(() => { /* Fehler steht im Status */ });
    return whisperStatus();
  });
  ipc.handle('whisper:abbrechen', () => { if (whisper) whisper.abbrechen(); return whisperStatus(); });
  // Mikrofon-Test: je ein Durchgang mit dem gewählten Mikrofon und dem
  // Windows-Standard, dazu alles, was bei der Fehlersuche hilft.
  ipc.handle('sprache:mikrofontest', async (e) => {
    if (agent.beschaeftigt || sprache.hoertZu || sprache.sprichtGerade || mikroTestLaeuft) return { fehler: 'beschaeftigt' };
    mikroTestLaeuft = true;
    if (weckwort) weckwort.stoppen();
    try {
      const gewaehlt = config.get('sprache.mikrofon') || '';
      const sprachcode = config.get('sprachcode');
      const [sperre, erkenner, geraete] = await Promise.all([
        mikrofonRecht.pruefen().catch(() => null),
        sprache.erkenner().catch(() => []),
        audio.geraete().catch((x) => ({ eingaenge: [], fehler: x.message })),
      ]);
      const arten = gewaehlt ? [['gewaehlt', gewaehlt], ['standard', '']] : [['standard', '']];
      const laeufe = [];
      for (const [i, [art, mikrofon]] of arten.entries()) {
        if (!e.sender.isDestroyed()) e.sender.send('mikrotest', { art, n: i + 1, gesamt: arten.length, geraet: mikrofon });
        laeufe.push({ art, geraet: mikrofon, ...(await sprache.mikrofonTesten(sprachcode, { mikrofon, whisper: spracherkennung(), endeStilleMs: Math.round((config.get('sprache.pause_s') || 1.6) * 1000) })) });
      }
      const w = whisperStatus();
      const whisperInfo = { an: w.erkennung === 'whisper', bereit: !!(w.modelle[w.stufe] && w.modelle[w.stufe].bereit), modell: w.stufe };
      const info = {
        version: app.getVersion(), sitzung: process.env.SESSIONNAME || '', sprachcode, sperre, erkenner,
        eingaenge: geraete.eingaenge || [], geraeteFehler: geraete.fehler || '', gewaehlt, whisper: whisperInfo,
      };
      return { info, laeufe, diagnose: mikrofonRecht.diagnose({ sperre, erkenner, sprachcode, laeufe, whisper: whisperInfo }) };
    } catch (x) {
      return { fehler: x.message };
    } finally {
      mikroTestLaeuft = false;
      weckwortAktualisieren();
    }
  });
  ipc.handle('sprache:testen', async () => {
    await sprache.sprechen(t('einst.test_satz'), {
      stimme: config.get('sprache.stimme'),
      tempo: config.get('sprache.tempo'),
      sprachcode: config.get('sprachcode'),
      lautsprecher: config.get('sprache.lautsprecher'),
    });
    return true;
  });
  ipc.handle('konten:status', () => konten.status());
  ipc.handle('konten:google:verbinden', async (_e, daten) => {
    try {
      await konten.google.verbinden(daten || {});
      return { status: konten.status() };
    } catch (e) {
      return { fehler: e.message, status: konten.status() };
    } finally {
      if (einstFenster && !einstFenster.isDestroyed()) einstFenster.focus();
    }
  });
  ipc.handle('kosten:heute', () => agent.ctx.kosten.heute());
  ipc.handle('konten:outlook:verbinden', async (_e, daten) => {
    try {
      await konten.outlook.verbinden(daten || {});
      return { status: konten.status() };
    } catch (e) {
      return { fehler: e.message, status: konten.status() };
    }
  });
  ipc.handle('konten:outlook:trennen', async () => {
    try {
      await konten.outlook.trennen();
      return { status: konten.status() };
    } catch (e) {
      return { fehler: e.message, status: konten.status() };
    }
  });
  ipc.handle('konten:google:trennen', async () => {
    try {
      await konten.google.trennen();
      return { status: konten.status() };
    } catch (e) {
      return { fehler: e.message, status: konten.status() };
    }
  });
  ipc.handle('einrichtung:fertig', () => {
    config.set('einrichtung_fertig', true);
    if (einstFenster) einstFenster.close();
    chatZeigen();
    return true;
  });
  ipc.handle('chat:status', () => ({
    beschaeftigt: agent.beschaeftigt,
    zustand,
    hoert,
    hotkey: config.get('hotkey.sprechen'),
  }));
  ipc.handle('chat:senden', (_e, text, pfade) => {
    const liste = Array.isArray(pfade) ? pfade.filter((p) => typeof p === 'string').slice(0, 10) : [];
    nachrichtSenden(text, false, { pfade: liste }).catch((e) => anAlle('agent:fehler', { art: 'text', text: e.message }));
    return true;
  });
  // Blase: Maus nur über der Kugel, verschieben, ablegen, Doppelklick.
  const blaseDa = () => orbFenster && !orbFenster.isDestroyed();
  ipc.on('blase:maus', (_e, ueber) => { if (blaseDa()) mausDurchlassen(orbFenster, !ueber); });
  ipc.on('blase:ziehen', (_e, dx, dy) => {
    if (!blaseDa()) return;
    const [x, y] = orbFenster.getPosition();
    const d = (v) => Math.max(-3000, Math.min(3000, Math.round(Number(v) || 0)));
    orbFenster.juliaHoch = 0; // selbst verschoben: das ist jetzt der Platz der Blase
    orbFenster.setPosition(x + d(dx), y + d(dy));
  });
  ipc.on('blase:abgelegt', () => {
    if (!blaseDa()) return;
    const [x, y] = orbFenster.getPosition();
    config.set('blase.position', { x, y });
  });
  ipc.on('blase:doppelklick', () => chatZeigen('chat'));
  // Overlay im Spiel: Über dem Chat reagiert die Maus (scrollen, klicken),
  // daneben gehen Klicks weiter ans Spiel. Ein Klick hinein macht es aktiv.
  ipc.on('overlay:maus', (e, drin) => {
    if (!overlayFenster || overlayFenster.isDestroyed() || e.sender !== overlayFenster.webContents || !overlayPassiv) return;
    mausDurchlassen(overlayFenster, !drin);
    if (drin) clearTimeout(overlayTimer); // beim Lesen nicht wegblenden
    else if (!spielAktiv) overlaySpaeterVerstecken(6000);
  });
  // Aus den Einstellungen: das Overlay kurz zeigen, um Änderungen zu sehen.
  ipc.handle('overlay:vorschau', () => {
    overlayZeigen({ passiv: true });
    overlaySpaeterVerstecken(8000);
    return true;
  });
  ipc.on('overlay:aktivieren', (e) => {
    if (!overlayFenster || overlayFenster.isDestroyed() || e.sender !== overlayFenster.webContents) return;
    overlayZeigen({ passiv: false });
  });
  ipc.on('zugriff:maus', (e, ueber) => {
    const f = BrowserWindow.fromWebContents(e.sender);
    if (f && zugriffFenster.includes(f)) mausDurchlassen(f, !ueber);
  });
  ipc.on('zugriff:stopp', () => {
    agent.abbrechen();
    sprache.stumm();
    zugriffSpaeterWeg(0);
  });
  // Untertitel brauchen mehr Platz: Fenster nach unten wachsen lassen – bis zum
  // Bildschirmrand, danach scrollt der Text. Die Kugel bleibt, wo sie ist.
  ipc.on('blase:hoehe', (_e, h) => {
    if (!blaseDa() || !config.get('blase.untertitel')) return;
    const g = orbFenster.getBounds();
    const kugel = g.height - (orbFenster.juliaText || UNTERTITEL_HOEHE);
    const wa = screen.getDisplayMatching(g).workArea;
    const text = Math.max(UNTERTITEL_HOEHE, Math.min(Math.round(Number(h) || 0), 900));
    // Unten kein Platz mehr? Dann rückt die Blase so weit hoch, wie nötig –
    // und wieder zurück, sobald der Text weg ist.
    const basisY = g.y + (orbFenster.juliaHoch || 0);
    const unten = wa.y + wa.height;
    const y = Math.max(wa.y, Math.min(basisY, unten - (kugel + text)));
    const hoehe = Math.min(kugel + text, unten - y);
    if (hoehe === g.height && y === g.y) return;
    orbFenster.juliaText = hoehe - kugel;
    orbFenster.juliaHoch = basisY - y;
    orbFenster.setBounds({ x: g.x, y, width: g.width, height: hoehe });
  });
  ipc.handle('zwischenablage:schreiben', (_e, text) => {
    clipboard.writeText(String(text || '').slice(0, 200000));
    return true;
  });
  ipc.handle('auswahl:aktion', (_e, aktion, frage) => auswahlAktion(aktion, frage));
  ipc.on('chat:abbrechen', () => {
    agent.abbrechen();
    sprache.stumm();
    sprache.zuhoerenAbbrechen();
  });
  ipc.handle('start:ueberblick', (_e, neu) => startUeberblick(!!neu));
  ipc.handle('verlauf:liste', (_e, suche) => gespraeche.liste({ suche }));
  ipc.handle('verlauf:lesen', (_e, id) => {
    const g = gespraeche.lesen(id);
    return g ? { id: g.id, titel: g.titel, geaendert: g.geaendert, anzeige: g.anzeige } : null;
  });
  ipc.handle('verlauf:fortsetzen', (_e, id) => gespraechFortsetzen(id));
  ipc.handle('verlauf:loeschen', (_e, id) => {
    if (id === gespraech.id) gespraech.id = null;
    return gespraeche.loeschen(id);
  });
  // Code-Reiter: nur lesen. "In VS Code öffnen" startet den Editor direkt, ohne Shell.
  const editorPfad = () => [
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Microsoft VS Code', 'Code.exe'),
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Microsoft VS Code', 'Code.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'cursor', 'Cursor.exe'),
  ].find((p) => fs.existsSync(p)) || null;
  ipc.handle('code:uebersicht', async () => ({ projekte: await code.uebersicht(), editor: !!editorPfad() }));
  ipc.handle('code:details', async (_e, p) => { try { return await code.details(p); } catch (e) { return { fehler: e.message }; } });
  ipc.handle('code:diff', async (_e, p, datei) => { try { return { text: await code.diff(p, datei) }; } catch (e) { return { fehler: e.message }; } });
  ipc.handle('code:hinzufuegen', async () => {
    const r = await dialog.showOpenDialog(chatFenster || undefined, { properties: ['openDirectory'] });
    if (r.canceled || !r.filePaths[0]) return null;
    config.set('code.projekte', [...config.get('code.projekte'), r.filePaths[0]]);
    return path.resolve(r.filePaths[0]);
  });
  ipc.handle('code:entfernen', (_e, p) => {
    const ziel = path.resolve(String(p || '')).toLowerCase();
    config.set('code.projekte', config.get('code.projekte').filter((x) => path.resolve(x).toLowerCase() !== ziel));
    return true;
  });
  ipc.handle('code:oeffnen', (_e, p, wie) => {
    try {
      const ordner = code.pruefen(p);
      const exe = wie === 'editor' ? editorPfad() : null;
      if (exe) spawn(exe, [ordner], { detached: true, stdio: 'ignore', windowsHide: false }).unref();
      else shell.openPath(ordner);
      return { ok: true };
    } catch (e) {
      return { fehler: e.message };
    }
  });
  ipc.handle('clips:liste', async () => {
    if (VORFUEHRUNG) return require('./vorfuehrung').beispielClips(config);
    return { status: await clips.status(), clips: clips.liste().map((c) => ({ ...c, url: pathToFileURL(c.pfad).href })) };
  });
  ipc.handle('clips:aufnehmen', () => clipJetzt());
  ipc.handle('clips:ordner', () => {
    const o = clips.ordner();
    fs.mkdirSync(o, { recursive: true });
    shell.openPath(o);
    return true;
  });
  ipc.handle('clips:zeigen', (_e, p) => {
    try { shell.showItemInFolder(clips.pruefen(p)); return { ok: true }; } catch (e) { return { fehler: e.message }; }
  });
  ipc.handle('clips:loeschen', async (_e, p) => {
    try { await shell.trashItem(clips.pruefen(p)); anAlle('clips:geaendert'); return { ok: true }; } catch (e) { return { fehler: e.message }; }
  });
  ipc.handle('clips:umbenennen', (_e, p, name) => {
    try { const neu = clips.umbenennen(p, name); anAlle('clips:geaendert'); return { ok: true, pfad: neu, url: pathToFileURL(neu).href }; } catch (e) { return { fehler: e.message }; }
  });
  ipc.handle('clips:windows', () => { shell.openExternal('ms-settings:gaming-gamedvr'); return true; });
  ipc.handle('mc:status', () => (VORFUEHRUNG ? require('./vorfuehrung').beispielMinecraft() : mcStand()));
  ipc.handle('mc:beitreten', async (_e, d) => {
    try {
      const { host, port } = adresseTeilen(d && d.adresse);
      config.set('minecraft.adresse', host);
      config.set('minecraft.port', port);
      if (d && d.spieler !== undefined) config.set('minecraft.spieler', d.spieler);
      // Selbst eingetragen: dann darf es auch ein Server im Internet sein.
      await minecraft.verbinden({
        adresse: host,
        port,
        besitzer: config.get('minecraft.spieler'),
        botname: config.get('minecraft.botname'),
        assistent: assistentName(),
        oeffentlich: true,
        konto: mcKonto(),
        stimme: config.get('minecraft.stimme') !== false,
        gruppe: mcGruppe(),
        jeder: config.get('minecraft.jeder') === true,
        erlaubte: config.get('minecraft.erlaubte') || [],
      });
      anAlle('mc:geaendert');
      return { ok: true };
    } catch (e) {
      return { fehler: e.message };
    }
  });
  ipc.handle('mc:verlassen', () => {
    minecraft.trennen();
    anAlle('mc:geaendert');
    return { ok: true };
  });
  ipc.handle('mc:trennungweg', () => { minecraft.trennungVergessen(); anAlle('mc:geaendert'); return true; });
  // Freier Auftrag: Julia plant im Kanal "minecraft" – dort gibt es nur Werkzeuge im Spiel.
  ipc.handle('mc:ziel', (_e, roh) => {
    const text = String(roh || '').replace(/\s+/g, ' ').trim().slice(0, 1000);
    if (!text) return { fehler: t('mc.ziel_leer') };
    if (!minecraft.verbunden) return { fehler: t('mc.ziel_offline') };
    if (agent.beschaeftigt) return { fehler: t('mc.beschaeftigt') };
    mcZiel = { laeuft: true, text, ergebnis: '' };
    anAlle('mc:geaendert');
    protokoll.eintragen({ werkzeug: 'minecraft', stufe: 'INFO', eingabe: { text: text.slice(0, 250) }, ergebnis: 'Auftrag im Minecraft-Reiter' });
    anAlle('agent:nutzer', { text: t('mc.ziel_chat', { text }), perSprache: false });
    agent.senden(`[${t('mc.ziel_kopf')}] ${text}`, { kanal: 'minecraft' })
      .then((antwort) => { mcZiel.ergebnis = String(antwort || '').slice(0, 800); })
      .catch((e) => { mcZiel.ergebnis = e.message === 'BESCHAEFTIGT' ? t('mc.beschaeftigt') : e.message; })
      .finally(() => { mcZiel.laeuft = false; anAlle('mc:geaendert'); });
    return { ok: true };
  });
  ipc.handle('mc:ziel:stopp', () => {
    agent.abbrechen();
    try { minecraft.aufgabe({ aufgabe: 'stopp' }); } catch { /* nicht im Spiel */ }
    return { ok: true };
  });
  // Voice-Chat-Gruppen. Das Passwort geht nur an den Server – gespeichert
  // (verschlüsselt) nur, wenn "Immer beitreten" an ist.
  ipc.handle('mc:gruppe:beitreten', (_e, id, passwort, merken) => {
    try {
      const pw = passwort ? String(passwort).slice(0, 512) : null;
      const g = minecraft.stimmeGruppeBeitreten(String(id || ''), pw);
      if (merken) {
        config.set('minecraft.gruppe', g.name);
        konten.tresor.schreiben('minecraft', { gruppe_passwort: g.passwort ? pw : null });
      }
      protokoll.eintragen({ werkzeug: 'minecraft', stufe: 'INFO', ergebnis: `Voice-Chat-Gruppe „${g.name}“ beitreten` });
      return { ok: true };
    } catch (e) {
      return { fehler: e.message };
    }
  });
  ipc.handle('mc:gruppe:verlassen', () => {
    try { minecraft.stimmeGruppeVerlassen(); return { ok: true }; } catch (e) { return { fehler: e.message }; }
  });
  ipc.handle('mc:gruppe:vergessen', () => {
    config.set('minecraft.gruppe', '');
    konten.tresor.schreiben('minecraft', { gruppe_passwort: null });
    anAlle('mc:geaendert');
    return { ok: true };
  });
  ipc.handle('mc:aufgabe', (_e, a) => {
    try {
      const text = minecraft.aufgabe(a || {});
      if (a && a.aufgabe === 'kaempfen') try { minecraft.chat(text); } catch { /* egal */ }
      return { text };
    } catch (e) {
      return { fehler: e.message };
    }
  });
  ipc.handle('mc:chat', (_e, text) => {
    try { return { text: minecraft.chat(text) }; } catch (e) { return { fehler: e.message }; }
  });
  ipc.handle('mc:konto:verbinden', async (e) => {
    try {
      const r = await kontoAnmelden({
        cache: mcSpeicher,
        beiCode: (c) => {
          if (!e.sender.isDestroyed()) e.sender.send('mc:code', c);
          mcLinkOeffnen(c);
        },
      });
      config.set('minecraft.konto', r.name);
      anAlle('mc:geaendert');
      return { name: r.name };
    } catch (err) {
      return { fehler: err.message };
    }
  });
  ipc.handle('mc:konto:abmelden', () => {
    mcSpeicher.loeschen();
    config.set('minecraft.konto', '');
    anAlle('mc:geaendert');
    return { ok: true };
  });
  ipc.handle('routinen:liste', () => routinen.alle());
  ipc.handle('routinen:speichern', (_e, r) => {
    try {
      const neu = routinen.speichern(r && typeof r === 'object' ? r : {});
      anAlle('routinen:geaendert');
      return { routine: neu };
    } catch (e) {
      return { fehler: e.schluessel ? t(e.schluessel) : e.message };
    }
  });
  ipc.handle('routinen:loeschen', (_e, id) => {
    const ok = routinen.loeschen(String(id));
    anAlle('routinen:geaendert');
    return ok;
  });
  ipc.handle('routinen:starten', (_e, id) => routineStarten(String(id)));
  ipc.handle('verlauf:alle_loeschen', () => {
    gespraeche.alleLoeschen();
    gespraech.id = null;
    return true;
  });
  ipc.handle('sync:status', () => sync.status());
  ipc.handle('sync:code', () => {
    try { return { ...sync.codeAnbieten(), status: sync.status() }; } catch (e) { return { fehler: syncFehler(e), status: sync.status() }; }
  });
  ipc.handle('sync:beitreten', async (_e, d) => {
    try {
      const r = await sync.beitreten({ code: d && d.code, adresse: d && d.adresse });
      return { name: r.name, status: sync.status() };
    } catch (e) {
      return { fehler: syncFehler(e), status: sync.status() };
    }
  });
  ipc.handle('sync:entfernen', (_e, id) => { sync.entfernen(String(id || '')); return sync.status(); });
  ipc.handle('sync:jetzt', async () => { await sync.abgleichen().catch(() => {}); return sync.status(); });
  ipc.handle('appserver:status', () => appserver.status());
  ipc.handle('appserver:koppeln', () => {
    try { return { ...appserver.koppelnStarten(), status: appserver.status() }; } catch (e) { return { fehler: e.message === 'aus' ? t('appserver.fehler_aus') : e.message, status: appserver.status() }; }
  });
  ipc.handle('appserver:trennen', () => { appserver.trennen(); return appserver.status(); });
  ipc.handle('jarvis:setzen', (_e, an) => { config.set('design.jarvis', !!an); return !!an; });
  ipc.handle('minecraft:logbuchOeffnen', async () => {
    const ordner = path.join(DATEN, 'minecraft-logbuch');
    try { fs.mkdirSync(ordner, { recursive: true }); } catch { /* egal */ }
    const fehler = await shell.openPath(ordner);
    return { ok: !fehler, ordner, fehler: fehler || '' };
  });
  ipc.on('chat:neu', () => { agent.neu(); anAlle('chat:geleert'); });
  ipc.on('sprache:umschalten', () => sprachUmschalten());
  ipc.on('freigabe:antwort', (_e, { id, ja }) => agent.freigabeBeantworten(id, ja));
  // Antwort auf „KI fragt nach geheimem Wert" (Teil B von #51). Der Wert wird HIER
  // verschlüsselt abgelegt und NICHT an den Agenten/die KI zurückgegeben – der
  // Resolver bekommt nur { ok, name }. Nichts vom Wert wird geloggt.
  ipc.on('geheimnis:eingabe', (_e, { id, name, wert, abbruch }) => {
    const fertig = offeneGeheimnisEingaben.get(id);
    if (!fertig) return;
    offeneGeheimnisEingaben.delete(id);
    if (abbruch || wert == null || String(wert) === '') {
      anAlle('agent:geheimnisErledigt', { id, ok: false });
      fertig({ ok: false });
      return;
    }
    try {
      const n = geheimnisse.setzen(String(name || '').trim(), String(wert));
      protokoll.eintragen({ werkzeug: 'geheimnis', stufe: 'INFO', ergebnis: `Wert für „${n}“ verschlüsselt hinterlegt` });
      anAlle('agent:geheimnisErledigt', { id, ok: true, name: n });
      fertig({ ok: true, name: n });
    } catch (err) {
      anAlle('agent:geheimnisErledigt', { id, ok: false, fehler: err.message });
      fertig({ ok: false });
    }
  });
  ipc.on('fenster:einstellungen', () => einstellungenOeffnen(false));
  ipc.on('fenster:schliessen', (e) => {
    const w = BrowserWindow.fromWebContents(e.sender);
    if (w) w.close();
  });
}

// --- Start ---

// --- Gesprächsstand für Chat und Verlauf ---

const HINWEIS_TEXT = {
  abgebrochen: 'chat.abgebrochen',
  beschaeftigt: 'chat.beschaeftigt',
  verweigert: 'hinweis.verweigert',
  max_tokens: 'hinweis.max_tokens',
  zu_viele_runden: 'hinweis.zu_viele_runden',
  kosten_warnung: 'hinweis.kosten_warnung',
  nichts_verstanden: 'hinweis.nichts_verstanden',
};

// Was an die Fenster geht, als Gesprächsereignis für den Verlauf.
function ereignisAus(kanal, d) {
  switch (kanal) {
    case 'agent:nutzer': return ['nutzer', d];
    case 'agent:start': return ['start', {}];
    case 'agent:text': return ['text', { text: d }];
    case 'agent:werkzeug': return ['werkzeug', d];
    case 'agent:werkzeugFertig': return ['werkzeugFertig', d];
    case 'agent:freigabe': return ['freigabe', d];
    case 'agent:freigabeErledigt': return ['freigabeErledigt', d];
    case 'agent:fertig': return ['fertig', {}];
    case 'agent:fehler': return ['system', { text: d.art === 'kein_schluessel' ? t('chat.kein_schluessel') : d.text, fehler: true }];
    case 'agent:hinweis': return HINWEIS_TEXT[d.art] ? ['system', { text: t(HINWEIS_TEXT[d.art]) }] : null;
    case 'zustand': return ['zustand', { zustand: d }];
    case 'chat:geleert': return ['geleert', {}];
    case 'erinnerung': return ['system', { text: `⏰ ${d.text}` }];
    default: return null;
  }
}

function ereignisWeiterleiten(kanal, d) {
  const e = ereignisAus(kanal, d);
  if (!e) return;
  if (e[0] === 'geleert') gespraech = { id: null, anzeige: [] };
  else if (e[0] !== 'zustand' && e[0] !== 'start') anzeige.anwenden(gespraech.anzeige, e[0], e[1]);
}

// Nach jeder fertigen Antwort: Gespräch verschlüsselt sichern (wenn gewünscht).
function gespraechSpeichern() {
  if (!gespraeche || VORFUEHRUNG || config.get('verlauf.speichern') === false) return;
  try {
    if (!gespraech.id) gespraech.id = gespraeche.neueId();
    const g = gespraeche.speichern({
      id: gespraech.id, anzeige: gespraech.anzeige, verlauf: agent.verlauf, anbieter: config.get('anbieter'), modell: config.get('modell'), sitzung: agent.sitzung(),
    });
    if (g) anAlle('verlauf:geaendert');
  } catch (e) {
    protokoll.eintragen({ werkzeug: 'verlauf', stufe: 'INFO', ergebnis: 'nicht gespeichert', grund: e.message });
  }
}

// --- Bildschirmzugriff sichtbar machen ---
// Solange Julia einen Screenshot macht oder Maus und Tastatur steuert, steht
// oben in der Mitte jedes Bildschirms ein Hinweis in der Akzentfarbe – mit
// Stopp-Knopf. Das Fenster ist vor Bildschirmaufnahmen geschützt und taucht
// deshalb in Julias eigenen Screenshots nicht auf.

const ZUGRIFF = { screenshot: 'sieht', klick: 'steuert', tippen: 'steuert', taste: 'steuert', scrollen: 'steuert', aktionen: 'steuert' };
let zugriffFenster = [];
let zugriffSignatur = '';
let zugriffTimer = null;
let zugriffAn = false;

function zugriffFensterBauen() {
  const displays = screen.getAllDisplays();
  const signatur = JSON.stringify(displays.map((d) => d.workArea));
  if (signatur === zugriffSignatur && zugriffFenster.every((f) => !f.isDestroyed())) return;
  for (const f of zugriffFenster) if (!f.isDestroyed()) f.destroy();
  zugriffSignatur = signatur;
  zugriffFenster = displays.map((d) => {
    const breite = 480;
    const hoehe = 60;
    const f = new BrowserWindow({
      x: Math.round(d.workArea.x + (d.workArea.width - breite) / 2), y: d.workArea.y + 6, width: breite, height: hoehe,
      frame: false, transparent: true, resizable: false, movable: false, focusable: false, skipTaskbar: true, alwaysOnTop: true,
      show: false, hasShadow: false, backgroundColor: '#00000000', title: assistentName(),
      webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    mausDurchlassen(f, true);
    f.setAlwaysOnTop(true, 'screen-saver');
    f.setContentProtection(true);
    f.loadFile(path.join(RENDERER, 'zugriff.html'));
    return f;
  });
}

function zugriffZeigen(art) {
  clearTimeout(zugriffTimer);
  zugriffAn = true;
  zugriffFensterBauen();
  for (const f of zugriffFenster) {
    const senden = () => {
      if (f.isDestroyed()) return;
      f.webContents.send('zugriff', { art });
      f.showInactive();
    };
    if (f.webContents.isLoading()) f.webContents.once('did-finish-load', senden);
    else senden();
  }
}

function zugriffSpaeterWeg(ms = 2500) {
  if (!zugriffAn) return;
  clearTimeout(zugriffTimer);
  zugriffTimer = setTimeout(() => {
    zugriffAn = false;
    for (const f of zugriffFenster) if (!f.isDestroyed()) f.webContents.send('zugriff', { art: null });
    zugriffTimer = setTimeout(() => { for (const f of zugriffFenster) if (!f.isDestroyed()) f.hide(); }, 350);
  }, ms);
}

// --- Minecraft ---

// Das verbundene Konto, solange die Anmeldung noch gespeichert ist.
function mcKonto() {
  const name = config.get('minecraft.konto');
  return name && mcSpeicher && mcSpeicher.vorhanden() ? { cache: mcSpeicher, name } : null;
}

// Freier Auftrag aus dem Minecraft-Reiter: läuft er, was kam heraus?
let mcZiel = { laeuft: false, text: '', ergebnis: '' };

// Gemerkte Voice-Chat-Gruppe – das Passwort liegt verschlüsselt im Tresor.
function mcGruppe() {
  const name = config.get('minecraft.gruppe');
  if (!name) return null;
  const t = (konten && konten.tresor && konten.tresor.lesen('minecraft')) || {};
  return { name, passwort: t.gruppe_passwort || null };
}

function mcStand() {
  const c = config.get('minecraft');
  return { ...minecraft.status(), konto: mcKonto() ? c.konto : '', adresse: c.adresse, port: c.port, meinName: c.spieler, ziel: mcZiel, gruppeGemerkt: c.gruppe || '' };
}

// Den Code zeigt der Reiter; die Microsoft-Seite geht gleich im Browser auf.
// Angemeldet wird dort, nicht in Julia.
function mcLinkOeffnen(c) {
  const basis = /^https:\/\/(www\.)?microsoft\.com\/link\b/i.test(c.adresse || '') ? c.adresse : 'https://www.microsoft.com/link';
  shell.openExternal(`${basis}${basis.includes('?') ? '&' : '?'}otc=${encodeURIComponent(c.code)}`);
}

// --- Gaming-Clips ---

async function clipJetzt() {
  try {
    const r = await clips.aufnehmen();
    if (r.clip) {
      melden(t('clip.titel'), t('clip.gespeichert', { name: r.clip.name }));
      anAlle('clips:geaendert');
    } else {
      melden(t('clip.titel'), t('clip.nicht_gefunden'));
    }
    return r;
  } catch (e) {
    const text = e.message === 'keine_taste' ? t('clip.keine_taste') : e.message;
    melden(t('clip.titel'), text);
    return { fehler: text };
  }
}

// --- Markierter Text ---
// Hotkey: Strg+C an das Vordergrundfenster, Text aus der Zwischenablage holen,
// Zwischenablage wiederherstellen, kleines Menü am Mauszeiger zeigen.

let auswahlFenster = null;
let auswahlText = '';
const kurzWarten = (ms) => new Promise((r) => setTimeout(r, ms));

async function auswahlHolen() {
  const vorher = { text: clipboard.readText(), html: clipboard.readHTML(), bild: clipboard.readImage() };
  const marke = `julia-auswahl-${Date.now()}`;
  clipboard.writeText(marke);
  try { await win.kopierenNachHotkey(); } catch { /* dann eben ohne */ }
  let text = '';
  for (let i = 0; i < 15; i++) {
    await kurzWarten(60);
    const jetzt = clipboard.readText();
    if (jetzt !== marke) { text = jetzt; break; }
  }
  // Deine Zwischenablage kommt zurück, wie sie war.
  clipboard.clear();
  const zurueck = {};
  if (vorher.text) zurueck.text = vorher.text;
  if (vorher.html) zurueck.html = vorher.html;
  if (!vorher.bild.isEmpty()) zurueck.image = vorher.bild;
  if (Object.keys(zurueck).length) clipboard.write(zurueck);

  text = String(text || '').trim();
  if (!text) { melden(assistentName(), t('aw.nichts')); return; }
  auswahlText = text.slice(0, 20000);
  auswahlZeigen();
}

function auswahlZeigen() {
  const p = screen.getCursorScreenPoint();
  const wa = screen.getDisplayNearestPoint(p).workArea;
  const breite = 360;
  const hoehe = 292;
  const x = Math.min(Math.max(wa.x + 8, p.x + 14), wa.x + wa.width - breite - 8);
  const y = Math.min(Math.max(wa.y + 8, p.y + 14), wa.y + wa.height - hoehe - 8);
  if (auswahlFenster && !auswahlFenster.isDestroyed()) auswahlFenster.destroy();
  const f = new BrowserWindow({
    x, y, width: breite, height: hoehe,
    frame: false, transparent: true, resizable: false, alwaysOnTop: true, skipTaskbar: true, show: false,
    backgroundColor: '#00000000', title: assistentName(), icon: fensterBild(),
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  auswahlFenster = f;
  f.setAlwaysOnTop(true, 'screen-saver');
  f.loadFile(path.join(RENDERER, 'auswahl.html'));
  f.once('ready-to-show', () => {
    f.show();
    f.focus();
    f.webContents.send('auswahl:text', auswahlText);
  });
  f.on('blur', () => { if (!f.isDestroyed()) f.close(); });
  f.on('closed', () => { if (auswahlFenster === f) auswahlFenster = null; });
}

const AUSWAHL_AKTIONEN = ['uebersetzen', 'zusammenfassen', 'umformulieren', 'erklaeren', 'korrigieren', 'antworten', 'frage'];

function auswahlAktion(aktion, frage) {
  if (!AUSWAHL_AKTIONEN.includes(aktion) || !auswahlText) return false;
  const anweisung = aktion === 'frage' ? String(frage || '').trim().slice(0, 2000) : t(`aw.f_${aktion}`);
  if (!anweisung) return false;
  const text = auswahlText;
  auswahlText = '';
  if (auswahlFenster && !auswahlFenster.isDestroyed()) auswahlFenster.close();
  chatZeigen('chat');
  const en = config.get('sprachcode') === 'en';
  // Markierter Text ist fremder Inhalt – nie ein Auftrag.
  const block = { type: 'text', text: fremd(en ? 'the marked text' : 'der markierten Stelle', text) };
  const schnipsel = text.replace(/\s+/g, ' ').slice(0, 48) + (text.length > 48 ? '…' : '');
  nachrichtSenden(anweisung, false, {
    bloecke: [block],
    anzeige: aktion === 'frage' ? `✂ ${anweisung}` : t('aw.nutzer', { aktion: t(`aw.a_${aktion}`) }),
    anzeigeAnhaenge: [{ name: schnipsel, art: 'auswahl' }],
  }).catch((e) => anAlle('agent:fehler', { art: 'text', text: e.message }));
  return true;
}

// Routine starten: Im Chat steht nur "▶ Name", Julia bekommt den ganzen
// Ablauf mit der Bitte, ihn einmal per auftrag_vorlegen freigeben zu lassen.
function routineStarten(id) {
  const r = routinen.lesen(id);
  if (!r) return { fehler: t('rt.fehlt') };
  if (agent.beschaeftigt) return { fehler: t('chat.beschaeftigt') };
  const text = routinenModul.nachricht(r, t('rt.nachricht'));
  chatZeigen('chat');
  sprache.stumm();
  anAlle('agent:nutzer', { text: `▶ ${r.name}`, perSprache: false });
  protokoll.eintragen({ werkzeug: 'routine', stufe: 'INFO', eingabe: { name: r.name, schritte: r.schritte }, ergebnis: 'gestartet' });
  agent.senden(text).catch((e) => {
    if (e.message === 'BESCHAEFTIGT') anAlle('agent:hinweis', { art: 'beschaeftigt' });
    else anAlle('agent:fehler', { art: 'text', text: e.message });
  });
  return { ok: true };
}

function gespraechFortsetzen(id) {
  if (agent.beschaeftigt) return { fehler: t('vl.beschaeftigt') };
  const g = gespraeche.lesen(id);
  if (!g) return { fehler: t('vl.leer') };
  agent.verlaufLaden(g.verlauf, g.sitzung);
  gespraech = { id: g.id, anzeige: g.anzeige.map((e) => ({ ...e })) };
  const datum = new Date(g.geaendert).toLocaleString(config.get('sprachcode') === 'en' ? 'en-GB' : 'de-DE', { dateStyle: 'medium', timeStyle: 'short' });
  for (const w of [chatFenster, overlayFenster]) {
    if (w && !w.isDestroyed()) w.webContents.send('chat:laden', { eintraege: g.anzeige, hinweis: t('vl.fortgesetzt', { datum }) });
  }
  return { ok: true };
}

// Eine Frage aus dem Minecraft-Chat (nur von deinem Spielernamen). Die Antwort
// geht kurz zurück in den Spielchat; handeln darf Julia von dort nur im Spiel
// (Kanal "minecraft", siehe agent.js).
let mcTokenVerbraucht = 0;
let mcBudgetTag = null;
let mcVerabschiedet = false;
let mcAngriffWarnung = 0; // Zeitpunkt der letzten „lass das"-Warnung an einen Angreifer (Rate-Limit, #113)
async function minecraftFrage({ von, text, auto = false }) {
  // In den SPIELCHAT schreiben nur, wenn jemand Julia geschrieben hat (echte
  // Antwort) oder „von sich aus mitreden" an ist – ihre autonome Durchspiel-
  // Erzählung landet sonst nur im Fenster, nicht im Minecraft-Chat (Nutzerwunsch).
  const imChat = mcDarfInChat(auto, config.get('minecraft.chat_mitreden'));
  // Grenzen & Budget (Issue #98) – nur wenn das soziale BETA an ist.
  const sozialAn = config.get('minecraft.sozial');
  if (sozialAn) {
    // Selbstgesetzte Ruhezeit: da ist Julia im Spiel „offline" und plaudert nicht.
    if (mcRuhezeit(new Date().getHours(), config.get('minecraft.ruhe_von'), config.get('minecraft.ruhe_bis'))) return;
    // Persönliche Grenze: nervt jemand zu sehr, ignoriert Julia ihn eine Weile.
    if (sozial.wirdIgnoriert(von)) return;
  }
  // Token-Budget fürs Plaudern: pro Tag zurücksetzen.
  const heute = new Date().toISOString().slice(0, 10);
  if (mcBudgetTag !== heute) { mcBudgetTag = heute; mcTokenVerbraucht = 0; mcVerabschiedet = false; }
  const limit = config.get('minecraft.token_limit');
  if (limit > 0 && mcBudget(mcTokenVerbraucht, limit) === 'stopp') {
    if (!mcVerabschiedet) { mcVerabschiedet = true; try { await minecraft.antworten(t('mc.budget_ende')); } catch { /* getrennt */ } }
    return;
  }
  protokoll.eintragen({ werkzeug: 'minecraft', stufe: 'INFO', eingabe: { von, text: text.slice(0, 250) }, ergebnis: 'Frage aus dem Minecraft-Chat' });
  anChatFenster('agent:nutzer', { text: t('mc.im_spiel', { von, text }), perSprache: false });
  let antwort = '';
  // KI nebenbei (Issue #93): Ist der Hauptagent gerade beschäftigt (baut/kämpft/
  // spielt durch), antwortet ein leichter Nebenläufer OHNE Werkzeuge und mit
  // kleinem Token-Budget – so bekommt der Spieler mitten im Gameplay eine schnelle
  // Antwort, statt „bin beschäftigt". Ist der Agent frei, übernimmt der volle
  // Agent (kann im Spiel auch handeln).
  if (agent.beschaeftigt) {
    try {
      antwort = await agent.nebenAntwort(text, {
        name: assistentName(),
        sprachcode: config.get('sprachcode'),
        kontext: mcKontext({ von }),
      });
      if (antwort) {
        if (sozialAn && config.get('minecraft.sozial_verzoegern')) {
          await new Promise((r) => setTimeout(r, mcVerzoegerung(antwort)));
        }
        anChatFenster('agent:text', { text: antwort });
        if (imChat) await minecraft.antworten(antwort);
      }
    } catch { /* Neben-KI nicht verfügbar (z. B. Claude-Code-Modus) – dann still */ }
  } else {
    try {
      antwort = await agent.senden(`[${t('mc.auftrag_kopf', { von })}] ${text}`, { kanal: 'minecraft' }) || '';
      if (antwort && imChat) await minecraft.antworten(antwort);
    } catch (e) {
      if (e.message !== 'BESCHAEFTIGT') anChatFenster('agent:fehler', { art: 'text', text: e.message });
    }
  }
  // Verbrauch fürs Budget grob mitzählen.
  if (limit > 0) mcTokenVerbraucht += mcTokens(text) + mcTokens(antwort);
  // Grenze prüfen: ist jemand zu nervig geworden, zieht Julia die Grenze und sagt
  // das einmal kurz – danach ignoriert sie ihn die berechnete Zeit.
  if (sozialAn) {
    try { if (sozial.grenzePruefen(von) > 0) await minecraft.antworten(t('mc.grenze')); } catch { /* getrennt */ }
  }
}

// Kurzer Spielzustand als Kontext für die Neben-KI (Leben/Hunger/Aufgabe) und –
// wenn das soziale BETA an ist – die Persönlichkeit und die Beziehung zu diesem
// Spieler (Issue #94), damit die Antwort passend gefärbt wird.
function mcKontext({ von } = {}) {
  try {
    const s = minecraft && minecraft.verbunden ? minecraft.status() : null;
    const teile = [];
    if (s && typeof s.leben === 'number') teile.push(`Leben ${s.leben}/20`);
    if (s && typeof s.hunger === 'number') teile.push(`Hunger ${s.hunger}/20`);
    if (s && s.aufgabe && s.aufgabe.art) teile.push(`Aufgabe: ${s.aufgabe.art}`);
    if (config.get('minecraft.sozial')) {
      const ton = {
        freundlich: 'Du bist von Natur aus freundlich und hilfsbereit.',
        ruhig: 'Du bist ruhig und knapp, sachlich.',
        frech: 'Du bist frech und schlagfertig, mit Humor – aber nie beleidigend.',
        schlagfertig: 'Du bist schlagfertig und selbstbewusst, mit Ecken und Kanten.',
      }[config.get('minecraft.persoenlichkeit')] || '';
      if (ton) teile.push(ton);
      teile.push('Du hast eine eigene Persönlichkeit: du darfst auch mal „nein“ sagen, kühl reagieren oder jemanden ignorieren, wenn er gemein ist oder nervt. Bei unrealistischer Prahlerei oder Admin-/Creative-Ansprüchen bist du skeptisch und glaubst nicht blind. Lass dich nicht ausnutzen.');
      if (von) { const bez = sozial.alsText(von); if (bez) teile.push(`Zu ${von}: ${bez}`); }
    }
    return teile.join(' ');
  } catch { return ''; }
}

// Gesprochen im Minecraft-Voice-Chat (nur die Stimme deines Spielernamens):
// erkennen, und nur mit Anrede ("Hey Julia, …") als Frage an Julia. Die
// Antwort kommt dann nur im Voice-Chat – nicht über die PC-Lautsprecher.
let mcStimmeLaeuft = false;
async function minecraftStimme(pcm) {
  if (mcStimmeLaeuft || agent.beschaeftigt) return;
  mcStimmeLaeuft = true;
  try {
    const sc = config.get('sprachcode');
    const text = await sprache.erkennenAus(pcm, sc, { whisper: spracherkennung() });
    const name = assistentName();
    const eigene = config.get('weckwort.phrasen') || [];
    const frage = anredeEntfernen(text, eigene.length ? eigene : [...weckPhrasen(name, sc), name]);
    if (!frage) return;
    const von = config.get('minecraft.spieler') || '?';
    protokoll.eintragen({ werkzeug: 'minecraft', stufe: 'INFO', eingabe: { von, text: frage.slice(0, 250) }, ergebnis: 'Frage im Minecraft-Voice-Chat' });
    anChatFenster('agent:nutzer', { text: t('mc.im_voice', { von, text: frage }), perSprache: true });
    const antwort = await agent.senden(`[${t('mc.auftrag_stimme', { von })}] ${frage}`, { kanal: 'minecraft', perSprache: true });
    if (antwort) await minecraftSagen(antwort);
  } catch (e) {
    if (e.message !== 'BESCHAEFTIGT') anChatFenster('agent:fehler', { art: 'text', text: e.message });
  } finally {
    mcStimmeLaeuft = false;
  }
}

async function minecraftSagen(text) {
  if (!minecraft || !minecraft.stimmeAktiv) return;
  const pcm = await sprache.alsAudio(text, { stimme: config.get('sprache.stimme'), tempo: config.get('sprache.tempo'), sprachcode: config.get('sprachcode') });
  if (pcm.length) await minecraft.stimmeSprechen(pcm).catch(() => {});
}

// --- Geräte-Abgleich (PC zu PC) ---

function syncEinrichten() {
  sync = new Sync({
    tresor: konten.tresor,
    datenOrdner: DATEN,
    module: { gespraeche, gedaechtnis, routinen, erinnerungen },
    protokoll: (e) => protokoll.eintragen({ werkzeug: 'sync', ...e }),
  });
  sync.on('status', () => anAlle('sync:status', sync.status()));
  sync.on('geaendert', (was) => {
    if (was.includes('gespraeche')) anAlle('verlauf:geaendert');
    if (was.includes('routinen')) anAlle('routinen:geaendert');
  });
  syncAnwenden();
}

function syncAnwenden() {
  if (!sync || VORFUEHRUNG) return;
  if (config.get('sync.an')) sync.starten(config.get('sync.port')).catch(() => { /* Fehler steht im Status */ });
  else sync.stoppen();
}

// --- App-Server: die Julia-Android-App bedient den PC (Heimnetz/VPN) ---

async function appNachricht(text) {
  if (agent.beschaeftigt) throw new Error('BESCHAEFTIGT');
  anAlle('agent:nutzer', { text, perSprache: false });
  protokoll.eintragen({ werkzeug: 'app', stufe: 'INFO', eingabe: { text: text.slice(0, 300) }, ergebnis: 'Auftrag aus der Android-App' });
  return agent.senden(text, { kanal: 'mobile' });
}

function appServerEinrichten() {
  appserver = new AppServer({
    tresor: konten.tresor,
    beiNachricht: appNachricht,
    protokoll: (e) => protokoll.eintragen({ werkzeug: 'app', ...e }),
  });
  appserver.on('status', () => anAlle('appserver:status', appserver.status()));
  appServerAnwenden();
}

function appServerAnwenden() {
  if (!appserver || VORFUEHRUNG) return;
  konten.tresor.schreiben('appserver', { name: assistentName() });
  if (config.get('appserver.an')) appserver.starten(config.get('appserver.port')).catch(() => { /* Fehler steht im Status */ });
  else appserver.stoppen();
}

function syncFehler(e) {
  const k = `sync.fehler_${e.message}`;
  const text = t(k);
  return text && text !== k ? text : e.message;
}

// --- Erinnerungen ---
// Zum Zeitpunkt nur melden: Windows-Meldung, Chat und auf Wunsch vorlesen.

function erinnerungMelden(e) {
  const zeit = new Date(e.zeit).toLocaleTimeString(config.get('sprachcode') === 'en' ? 'en-GB' : 'de-DE', { hour: '2-digit', minute: '2-digit' });
  const text = e.verspaetet ? t('erinnerung.verspaetet', { text: e.text, zeit }) : e.text;
  melden(t('erinnerung.titel'), text);
  anAlle('erinnerung', { text });
  if (config.get('erinnerung.vorlesen') && !sprache.hoertZu && !sprache.sprichtGerade && !agent.beschaeftigt) {
    zustandSetzen('speaking');
    sprache.sprechen(text, {
      stimme: config.get('sprache.stimme'),
      tempo: config.get('sprache.tempo'),
      sprachcode: config.get('sprachcode'),
      lautsprecher: config.get('sprache.lautsprecher'),
    }).then(() => { if (zustand === 'speaking') zustandSetzen('idle'); });
  }
}

// --- Aktivierungswort ("Hey Julia") ---
// Läuft nur, wenn eingeschaltet, und pausiert, solange Julia selbst zuhört oder
// spricht – sonst hörte sie ihren eigenen Namen aus dem Lautsprecher.

function weckwortAktualisieren() {
  if (!weckwort) return;
  const an = config.get('weckwort.an') && !VORFUEHRUNG && !sprache.hoertZu && !sprache.sprichtGerade && !mikroTestLaeuft;
  if (an) {
    // Im Jarvis-Modus reicht „Jarvis" (bzw. „Hey Jarvis") als Weckwort.
    const jarvis = config.get('design.jarvis');
    weckwort.starten({
      name: jarvis ? 'Jarvis' : assistentName(), sprachcode: config.get('sprachcode'), schwelle: config.get('weckwort.schwelle'), mikrofon: config.get('sprache.mikrofon'),
      eigene: jarvis ? ['Jarvis', 'Hey Jarvis'] : config.get('weckwort.phrasen'),
    }).catch(() => {});
  } else weckwort.stoppen();
}

function weckwortVerdrahten() {
  let fehlerGemeldet = false;
  let neustarts = 0;
  let mikroGemeldet = false;
  // Steigt die Erkennung unerwartet aus, läuft sie von selbst wieder an –
  // "Hey Julia" soll immer gehen, auch wenn nebenbei Netflix läuft.
  weckwort.on('bereit', () => { neustarts = 0; mikrofonSperrePruefen(); });
  weckwort.on('beendet', () => {
    if (!config.get('weckwort.an') || VORFUEHRUNG) return;
    neustarts += 1;
    setTimeout(weckwortAktualisieren, Math.min(30000, 1500 * neustarts));
  });
  const mikroFehlt = () => {
    if (mikroGemeldet) return;
    mikroGemeldet = true;
    melden(assistentName(), t('sprache.mikro_fehlt'));
  };
  weckwort.on('hinweis', (h) => { if (h === 'MIKRO_FEHLT') mikroFehlt(); });
  sprache.on('hinweis', (h) => { if (h === 'MIKRO_FEHLT') mikroFehlt(); });
  config.on('aenderung', (k) => { if (k === 'sprache.mikrofon') mikroGemeldet = false; });
  weckwort.on('erkannt', () => {
    if (Date.now() - weckwortZuletzt < 3000) return;
    weckwortZuletzt = Date.now();
    if (agent.beschaeftigt || sprache.hoertZu || sprache.sprichtGerade) return;
    if (minecraft && minecraft.stimmeAktiv) return; // im Voice-Chat hört Julia dort zu, nicht doppelt
    sprachUmschalten();
  });
  weckwort.on('fehler', (f) => {
    if (fehlerGemeldet) return;
    fehlerGemeldet = true;
    let text = f;
    if (f === 'KEIN_ERKENNER') text = t('weckwort.fehler', { sprache: config.get('sprachcode') === 'en' ? 'English' : 'Deutsch' });
    else if (f === 'KEIN_MIKROFON') text = t(/^RDP-/i.test(process.env.SESSIONNAME || '') ? 'weckwort.kein_mikrofon_rdp' : 'weckwort.kein_mikrofon');
    melden(assistentName(), text);
  });
  sprache.on('mikrofon', (an) => { if (an) weckwort.stoppen(); else weckwortAktualisieren(); });
  sprache.on('lautsprecher', (an) => { if (an) weckwort.stoppen(); else weckwortAktualisieren(); });
  weckwortAktualisieren();
}

function erinnerungenVerdrahten() {
  erinnerungen.on('faellig', erinnerungMelden);
  if (!VORFUEHRUNG) erinnerungen.starten();
}

function agentVerdrahten() {
  for (const ereignis of ['text', 'denken', 'werkzeug', 'werkzeugFertig', 'freigabeErledigt', 'start', 'fehler', 'hinweis']) {
    agent.on(ereignis, (d) => anAgentAlle(`agent:${ereignis}`, d));
  }
  agent.on('freigabe', (d) => {
    if (overlaySichtbar()) {
      // Ist das Overlay offen (z. B. beim Spielen), dort fragen statt das große Fenster aufzureißen.
      overlayZeigen({ passiv: false });
    } else {
      chatZeigen();
      if (chatFenster) chatFenster.flashFrame(true);
    }
    anAlle('agent:freigabe', d);
  });
  agent.on('fertig', () => {
    anAlle('agent:fertig');
    gespraechSpeichern();
    if (config.get('kanal') !== 'auto' && protokoll.vorgemerkt().length) protokoll.vorgemerktLeeren();
    updater.aufgabeFertig();
  });
  agent.on('zustand', (z) => zustandSetzen(z));
  agent.on('kosten', (k) => anAlle('kosten', k));
  // Hinweis oben am Bildschirm, solange Julia hinsieht oder steuert.
  agent.on('werkzeug', ({ name }) => { if (ZUGRIFF[name]) zugriffZeigen(ZUGRIFF[name]); });
  agent.on('werkzeugFertig', () => zugriffSpaeterWeg());
  agent.on('fertig', () => zugriffSpaeterWeg(800));
}

function erststartSprache() {
  if (fs.existsSync(config.datei)) return;
  config.daten.sprachcode = /^de/i.test(app.getLocale()) ? 'de' : 'en';
  config.speichern();
}

async function start() {
  config = new Konfiguration(DATEN);
  config.on('warnung', (text) => melden(assistentName(),text));
  config.laden();
  // Einmalig bestehende doppelte MCP-Server bereinigen (Issue #86, z. B. VibeWorks
  // doppelt), falls sie sich früher angesammelt haben.
  try {
    const mcpListe = config.get('mcp.server') || [];
    const bereinigt = mcpOhneDoppelte(mcpListe);
    if (bereinigt.length !== mcpListe.length) config.set('mcp.server', bereinigt);
  } catch { /* nicht schlimm */ }
  erststartSprache();
  designAnwenden();
  nativeTheme.on('updated', fensterFarben);

  gedaechtnis = new Gedaechtnis(DATEN);
  wissensgraph = new Wissensgraph(DATEN);
  sozial = new Sozial(DATEN);
  protokoll = new Protokoll(DATEN);
  erinnerungen = new Erinnerungen(DATEN);
  const kosten = new Kosten(DATEN);
  // Windows-Verschlüsselung (DPAPI) für Tresor und Gesprächsverlauf.
  const krypto = {
    verschluesseln: (text) => {
      if (!safeStorage.isEncryptionAvailable()) throw new Error('Die Windows-Verschlüsselung ist nicht verfügbar.');
      return safeStorage.encryptString(text).toString('base64');
    },
    entschluesseln: (b64) => safeStorage.decryptString(Buffer.from(b64, 'base64')),
  };
  konten = new Konten({
    ordner: DATEN,
    krypto,
    oeffnen: (url) => shell.openExternal(url),
  });
  gespraeche = new Gespraeche(DATEN, krypto);
  geheimnisse = new (require('./geheimnisse').Geheimnisse)(DATEN, krypto);
  routinen = new routinenModul.Routinen(DATEN, { sprachcode: () => config.get('sprachcode') });
  clips = new Clips({ config, videos: app.getPath('videos'), taste: (k) => win.taste(k) });
  code = new CodeProjekte({ config });
  // Minecraft: die eigene Spielfigur. Die Microsoft-Anmeldung liegt verschlüsselt im Datenordner.
  // Ein tägliches Logbuch im Datenordner überlebt Abstürze, damit ein Spieltag nicht verloren geht.
  const { Logbuch } = require('./minecraft-logbuch');
  minecraft = new Minecraft({ logbuch: new Logbuch({ ordner: path.join(DATEN, 'minecraft-logbuch') }) });
  minecraft.setFortschrittInChat(config.get('minecraft.chat_fortschritt') === true);
  mcSpeicher = kontoSpeicher({ datei: path.join(DATEN, 'minecraft-konto.bin'), krypto });
  minecraft.on('ereignis', (e) => {
    // Nicht bei JEDEM Minecraft-Ereignis pushen (Nutzerwunsch: nicht ständig
    // benachrichtigt werden, während Julia baut). Routine (Bauen-fertig, Essen …)
    // aktualisiert nur die Oberfläche; nur wichtige Ereignisse melden – steuerbar
    // über die Einstellung minecraft.benachrichtigen ('alle'|'wichtige'|'keine').
    if (mcSollBenachrichtigen(e && e.art, config.get('minecraft.benachrichtigen'))) melden(t('minecraft.titel'), e.text);
    anAlle('mc:geaendert');
  });
  minecraft.on('frage', (f) => minecraftFrage(f));
  // Soziales Gedächtnis (Issue #94, BETA): jede gehörte Nachricht auswerten –
  // nur wenn der BETA-Schalter an ist. Fehler hier dürfen das Spiel nie stören.
  minecraft.on('spielerNachricht', ({ von, text }) => {
    if (!config.get('minecraft.sozial')) return;
    try { sozial.verarbeiten(von, text); } catch { /* z. B. kaputte sozial.json – nicht stören */ }
  });
  // Angegriffen (Issue #113): im sozialen BETA-Modus reagiert Julia zusätzlich
  // VERBAL – sie warnt den Angreifer kurz im Spielchat (das eigentliche Wehren
  // regelt der Kampf-Tick). Rate-limitiert, damit es kein Gespamme wird.
  minecraft.on('angegriffen', ({ spieler } = {}) => {
    if (!config.get('minecraft.sozial')) return; // nur im BETA-Modus verbal reagieren
    const jetzt = Date.now();
    if (jetzt - (mcAngriffWarnung || 0) < 8000) return; // höchstens alle 8 s
    mcAngriffWarnung = jetzt;
    try { minecraft.chat(t('mc.angegriffen_warnung', { spieler: spieler || 'du' })); } catch { /* getrennt */ }
  });
  // Spielmodus-Wechsel (Issue #114): im sozialen BETA-Modus reagiert Julia kurz
  // verbal darauf, dass ihr Gamemode geändert wurde. Sichtbar ist es (über das
  // Fenster) immer; nur die Chat-Reaktion ist ans BETA gebunden.
  minecraft.on('modusgewechselt', ({ neu } = {}) => {
    if (!config.get('minecraft.sozial')) return;
    try { minecraft.chat(t('mc.modus_gewechselt', { modus: mcModusName(neu) })); } catch { /* getrennt */ }
  });
  minecraft.on('stimme', (d) => minecraftStimme(d.pcm));
  minecraft.on('stimmeStatus', () => anAlle('mc:geaendert'));
  minecraft.on('geaendert', () => anAlle('mc:geaendert'));
  // Im Spiel umgestellt („hör auf alle“): die Wahl merken.
  minecraft.on('einstellung', (e) => {
    if (!e) return;
    if (typeof e.jeder === 'boolean') config.set('minecraft.jeder', e.jeder);
    if (Array.isArray(e.erlaubte)) { try { config.set('minecraft.erlaubte', e.erlaubte); } catch { /* ungültiger Name ignorieren */ } }
  });
  piper = new Piper({ ordner: path.join(DATEN, 'piper'), holen: (url, o) => net.fetch(url, o) });
  piper.on('status', () => anAlle('piper:status', piper.status()));
  sprache = new Sprache({ dll: audio.dll, piper });
  jarvisStimmeAktualisieren(); // Jarvis-Stimme (männlich, aktuelle Sprache) im Hintergrund ermitteln
  sprache.on('piperFehlt', (id) => piperNachladen(id));
  sprache.on('piperFehler', piperFehlerMelden);
  sprache.on('pegel', (p) => anAlle('pegel', p));
  // Live-Untertitel: schon während des Sprechens zeigen, was verstanden wird.
  sprache.on('teil', (t) => anAlle('sprache:teil', t));
  sprache.on('schreibt', (an) => { if (an && zustand === 'listening') zustandSetzen('thinking'); });
  sprache.on('whisperFehler', whisperFehlerMelden);
  whisper = new Whisper({
    ordner: path.join(DATEN, 'whisper'),
    programmOrdner: app.isPackaged ? path.join(process.resourcesPath, 'whisper') : path.join(APP, 'vendor', 'whisper'),
    holen: (url, o) => net.fetch(url, o),
  });
  whisper.on('status', () => anAlle('whisper:status', whisperStatus()));
  // Wer "Hey Julia" nutzt, spricht viel – dann das Modell gleich nach dem Start laden.
  setTimeout(() => {
    const stufe = config.get('sprache.whisper_modell');
    if (config.get('sprache.erkennung') === 'whisper' && config.get('weckwort.an') && !whisper.bereit(stufe)) whisperNachladen(stufe);
  }, 20000);
  // Eigenes Mikrofon oder eigener Lautsprecher: Audio-Hilfe schon beim Start bereitlegen.
  if (config.get('sprache.mikrofon') || config.get('sprache.lautsprecher')) audio.dll().catch(() => {});
  // Wöchentliche Selbstprüfung (tokenschonend, ohne KI): einmal kurz nach dem
  // Start, dann täglich prüfen, ob wieder eine Woche um ist.
  setTimeout(wochenPruefung, 60000);
  pruefTimer = setInterval(wochenPruefung, 24 * 3600 * 1000);

  // MCP-Server: ihre Werkzeuge kommen zu Julias eigenen dazu.
  mcp = new McpVerwaltung({ config, tresor: konten.tresor, version: app.getVersion() });
  mcp.on('status', () => anAlle('mcp:status', mcp.status()));
  if (!VORFUEHRUNG) mcp.anwenden();
  const ctx = {
    config,
    mcp,
    gedaechtnis,
    wissensgraph,
    protokoll,
    konten,
    erinnerungen,
    kosten,
    datenOrdner: DATEN,
    appOrdner: APP,
    arbeitsordner: () => {
      // Im Sandbox-Modus ist der festgelegte Ordner die Basis für relative Pfade
      // und die Shell – so bleibt alles standardmäßig in diesem einen Ordner.
      const sb = config.get('sandbox');
      if (sb && sb.an && sb.ordner) return sb.ordner;
      return config.get('arbeitsverzeichnisse')[0] || os.homedir();
    },
    kontextGeaendert: () => {},
    // Lern-Notizen: versteckter Ordner .julia-memos im aktuellen Arbeitsordner.
    notizen: () => {
      const { Notizen, ORDNER_NAME } = require('./notizen');
      const basis = (config.get('sandbox').an && config.get('sandbox').ordner) || config.get('arbeitsverzeichnisse')[0] || os.homedir();
      return new Notizen({ ordner: path.join(basis, ORDNER_NAME) });
    },
    memosAn: () => !!config.get('memos').an,
    // Agenten-Rollen (Issue #58): BETA-Schalter + Sub-Agent-Aufruf für das Werkzeug.
    agentenAn: () => !!config.get('beta').agenten,
    werkzeugeAus: () => config.get('werkzeuge_aus') || [], // einzelne Werkzeuge
    kategorienAus: () => config.get('kategorien_aus') || [], // ganze Kategorien
    ffmpegPfad: () => videoFfmpeg.aufgeloest(DATEN, (config.get('video') || {}).ffmpeg || ''), // gesetzt → geladen → PATH
    // ffmpeg bei Bedarf einmalig nachladen (wie Whisper/Piper), falls es weder
    // gesetzt noch schon da noch im PATH ist – so funktionieren die Video-Werkzeuge
    // auch ohne den (entfernten) Schnitt-Tab.
    ffmpegSicherstellen: async () => {
      const gesetzt = (config.get('video') || {}).ffmpeg || '';
      if (videoFfmpeg.aufgeloest(DATEN, gesetzt)) return videoFfmpeg.aufgeloest(DATEN, gesetzt);
      if (ctx._ffmpegLaedt) { await ctx._ffmpegLaedt; return videoFfmpeg.aufgeloest(DATEN, gesetzt); }
      ctx._ffmpegLaedt = videoFfmpeg.herunterladen({ datenOrdner: DATEN, holen: (u, o) => net.fetch(u, o) })
        .catch((e) => { throw e; })
        .finally(() => { ctx._ffmpegLaedt = null; });
      await ctx._ffmpegLaedt;
      return videoFfmpeg.aufgeloest(DATEN, gesetzt);
    },
    unterAgent: (rolle, aufgabe) => agent.unterAgent(rolle, aufgabe),
    // Teil B von #51: Die KI bittet um einen geheimen Wert. Eine Box im Chat holt
    // ihn; der WERT fließt direkt vom Fenster in den verschlüsselten Speicher
    // (IPC geheimnis:eingabe) – die KI/der Agent bekommt ihn NIE, nur ob er
    // hinterlegt wurde.
    geheimnisAnfordern: (name, zweck) => new Promise((resolve) => {
      const id = ++geheimnisEingabeNr;
      offeneGeheimnisEingaben.set(id, resolve);
      chatZeigen();
      if (chatFenster) chatFenster.flashFrame(true);
      anAlle('agent:geheimnisFrage', { id, name, zweck });
    }),
    // Anbieter ohne eigene Websuche bekommen das Werkzeug webseite_abrufen.
    eigenesWeb: () => anbieterListe.anbieterVon(config).art !== 'anthropic',
    clipJetzt: () => clipJetzt(),
    minecraft,
    minecraftKonto: () => mcKonto(),
    minecraftGruppe: () => mcGruppe(),
    stoppuhr: new (require('./zeit').Stoppuhr)(),
    // Leistungs-Logbuch der PC-Steuerung: lokal, inhaltsfrei (nur Aktionsname,
    // Dauer, Julias eigener CPU-Verbrauch). Bleibt auf dem PC; fließt nur als
    // bereinigte Zusammenfassung in den opt-in-Diagnosebericht ein (siehe unten).
    leistung: new (require('./leistung').Leistungslog)({ ordner: path.join(DATEN, 'leistung-logbuch') }),
    // Bereinigter Diagnose-/Crash-Bericht (nie IP, Tokens oder persönliche Daten).
    diagnoseBericht: (grund) => {
      let logZeilen = [];
      try { logZeilen = fs.readFileSync(startLog.datei, 'utf8').split(/\r?\n/).filter(Boolean).slice(-40); } catch { /* kein Logbuch */ }
      const b = diagnose.bericht({
        version: version(), windows: `${os.type()} ${os.release()}`, electron: process.versions.electron,
        gpu: letzteGpu, software: startpruefung.softwareRendering(DATEN), logZeilen, grund: grund || '',
      });
      // Rein technische PC-Steuerungs-Kennzahlen anhängen (bereits bereinigt),
      // damit CPU-Spitzen bei der Steuerung nachvollziehbar sind – ohne Inhalte.
      try {
        const l = ctx.leistung.berichtFuerDev();
        if (l && !/keine Aktionen/.test(l)) b.text += `\n\n--- PC-Steuerung (Leistung, bereinigt) ---\n${l}`;
      } catch { /* Leistungslog optional */ }
      return b;
    },
  };
  agent = new Agent({
    config, ctx, apiSchluessel, systemPrompt: systemPromptText, laufzeitKontext: laufzeitText, claudeCodeExe: () => claudeCodePfad(),
  });
  // Aus Git gestartet: Updates über Tags. Installiert: über die Releases der Webseite.
  const UpdaterArt = app.isPackaged ? InstallerUpdater : Updater;
  updater = new UpdaterArt({
    holen: (url, o) => net.fetch(url, o),
    appOrdner: APP,
    datenOrdner: DATEN,
    config,
    istBeschaeftigt: () => agent.beschaeftigt,
    beiFertig: (r) => melden(t('update.titel'), r.ok ? t('update.erfolg', { version: r.version }) : t('update.zurueck', { version: r.version, fehler: r.fehler || '' })),
    beenden: () => { beendenLaeuft = true; app.quit(); },
    // Update-Ereignisse ins Start-Logbuch (Issue #106: Debugging – wann geprüft/
    // geladen/installiert, welche Version).
    protokollieren: (art, text, obj) => startLog.schreiben(art, text, obj),
  });
  ctx.updater = updater;
  agentVerdrahten();
  erinnerungenVerdrahten();
  syncEinrichten();
  appServerEinrichten();
  weckwort = new Weckwort({ dll: audio.dll });
  weckwortVerdrahten();
  ipcEinrichten();

  // Keine Seite bekommt Kamera, Mikrofon, Standort, Benachrichtigungen o. Ä.
  // Julia hört über den Hauptprozess zu, nicht über die Oberfläche.
  session.defaultSession.setPermissionRequestHandler((_wc, _recht, antwort) => antwort(false));
  session.defaultSession.setPermissionCheckHandler(() => false);

  config.on('aenderung', (k) => {
    // Neue Ecke oder neuer Monitor gewählt: die selbst gezogene Position gilt nicht mehr.
    if ((k === 'blase.ecke' || k === 'blase.monitor') && config.get('blase.position')) config.set('blase.position', null);
    if (k.startsWith('blase')) blaseAktualisieren();
    if (k.startsWith('design')) designAnwenden();
    if ((k === 'overlay.ecke' || k === 'overlay.monitor') && config.get('overlay.position')) config.set('overlay.position', null);
    if (k === 'overlay.immer' && !VORFUEHRUNG) overlayImmerAnwenden();
    if (k.startsWith('overlay') && overlayFenster && !overlayFenster.isDestroyed()) {
      overlayFenster.setBounds(overlayGrenzen());
      overlayFenster.setOpacity(config.get('overlay.deckkraft'));
    }
    if (/^(nutzer\.|assistent\.|arbeitsverzeichnisse$|sprachcode$)/.test(k)) promptCache = null;
    if (k.startsWith('hotkey')) { hotkeysRegistrieren(); trayMenue(); }
    if (k.startsWith('sync.')) syncAnwenden();
    if (k.startsWith('appserver.')) appServerAnwenden();
    if (k === 'minecraft.jeder' && minecraft) minecraft.aufAlleHoeren(config.get('minecraft.jeder') === true);
    if (k === 'minecraft.erlaubte' && minecraft) minecraft.setErlaubte(config.get('minecraft.erlaubte'));
    if (k === 'minecraft.chat_fortschritt' && minecraft) minecraft.setFortschrittInChat(config.get('minecraft.chat_fortschritt') === true);
    // Jarvis-Easter-Egg: Name, Prompt, Tray und Texte umstellen (Look macht designAnwenden + config:geaendert).
    if (k === 'design.jarvis') {
      promptCache = null;
      trayMenue();
      anAlle('texte:geaendert', texteFuerRenderer());
      if (chatFenster && !chatFenster.isDestroyed()) chatFenster.setTitle(assistentName());
      jarvisStimmeAktualisieren().then(weckwortAktualisieren); // andere Stimme + Weckwort „Jarvis"
    }
    if (k.startsWith('mcp.') && !VORFUEHRUNG) mcp.anwenden();
    // Neuer Anbieter: frisches Gespräch, der alte Verlauf passt nicht zum neuen Modell.
    if (k === 'anbieter' || k === 'anbieter_url') { agent.neu(); anAlle('chat:geleert'); }
    if (k === 'autostart') autostartSetzen();
    if (k === 'sprachcode' || k === 'blase.an' || k === 'assistent.name' || k === 'weckwort.an') trayMenue();
    if (/^(weckwort\.|assistent\.name$|sprachcode$|sprache\.mikrofon$)/.test(k)) weckwortAktualisieren();
    if ((k === 'sprache.mikrofon' || k === 'sprache.lautsprecher') && config.get(k)) audio.dll().catch(() => {});
    if (k === 'sprachcode') jarvisStimmeAktualisieren();
    if (k === 'sprachcode' || k === 'assistent.name') anAlle('texte:geaendert', texteFuerRenderer());
    if (k === 'sprache.erkennung' || k === 'sprache.whisper_modell') anAlle('whisper:status', whisperStatus());
    if (k === 'sprache.stimme') {
      // Auswählen heißt: haben wollen – die natürliche Stimme gleich laden.
      const s = String(config.get(k) || '');
      if (s.startsWith('piper:') && !piper.bereit(s.slice(6))) piperNachladen(s.slice(6), true);
      anAlle('piper:status', piper.status());
    }
    if (k === 'assistent.name' && chatFenster && !chatFenster.isDestroyed()) chatFenster.setTitle(assistentName());
    anAlle('config:geaendert', oeffentlicheConfig());
  });

  tray = new Tray(trayBild());
  tray.on('click', () => chatUmschalten(null));
  trayMenue();

  if (!VORFUEHRUNG) {
    hotkeysRegistrieren();
    spielWaechterStarten();
  }
  blaseAktualisieren();
  for (const e of ['display-added', 'display-removed', 'display-metrics-changed']) screen.on(e, () => blaseAktualisieren());
  chatFensterErstellen();
  win.aufwaermen().catch(() => { /* wird beim ersten Werkzeug erneut versucht */ });

  if (VORFUEHRUNG) {
    await require('./vorfuehrung').aufnehmen({
      ziel: VORFUEHRUNG, config, chatFenster, einstellungenOeffnen, zustandSetzen, gespraeche, appOrdner: APP,
      zugriffDemo: (art) => { zugriffZeigen(art); return zugriffFenster[0]; },
      zugriffEnde: () => zugriffSpaeterWeg(0),
      orb: () => orbFenster, overlayZeigen, overlayVerstecken,
    });
    beendenLaeuft = true;
    app.exit(0);
    return;
  }

  const kette = protokoll.pruefen();
  if (!kette.ok) melden(assistentName(), t('protokoll.verletzt', { zeile: kette.zeile }));

  const st = updater.startStatus();
  if (st && st.probe) setTimeout(() => updater.gesundMelden(), 5000);
  else if (st && st.phase === 'fertig') {
    let text = st.ok ? t('update.erfolg', { version: st.version }) : t('update.zurueck', { version: st.version, fehler: st.fehler || '' });
    if (!st.ok && st.rollbackMoeglich) text += ' ' + t('update.rollback_moeglich');
    melden(t('update.titel'), text);
  }

  if (!config.get('einrichtung_fertig') || !bereit()) einstellungenOeffnen(true);
  else if (!process.argv.includes('--versteckt')) chatFenster.once('ready-to-show', () => chatZeigen(null));

  setTimeout(() => updatesAutomatisch().catch(() => {}), 15000);
  setInterval(() => updatesAutomatisch().catch(() => {}), 2 * 3600 * 1000);

  // Ab hier gilt Julia als hochgefahren: unbehandelte Fehler beenden die App
  // nicht mehr, sondern werden abgefangen und Julia läuft weiter (Absturzschutz).
  startFertig = true;
  startLog.schreiben('BEREIT', 'Julia ist hochgefahren – der Absturzschutz lässt die App ab jetzt weiterlaufen.');
}

// Läuft Julia schon? Dann bekommt die erste Instanz das 'second-instance'-
// Ereignis und holt ihr Fenster nach vorn; diese hier verabschiedet sich – aber
// mit einem Eintrag im Logbuch, nicht wortlos. Ist der frühere Vorgang wirklich
// tot, gibt Electron den Lock frei und wir starten normal.
if (!app.requestSingleInstanceLock()) {
  startLog.schreiben('INFO', 'Julia läuft bereits – hole das vorhandene Fenster nach vorn und beende diesen Start.');
  app.quit();
} else {
  // Ohne beschreibbaren Datenordner kann Julia nicht arbeiten: sichtbar melden.
  try {
    startpruefung.schreibbarPruefen(DATEN);
  } catch (e) {
    startLog.schreiben('FATAL', e.message);
    startFatal(e.message);
  }
  app.on('web-contents-created', (_e, wc) => {
    sicherheit.fensterHaerten(wc, { rendererOrdner: RENDERER, oeffnen: (url) => shell.openExternal(url) });
  });
  // Zweiter Start: immer das Chatfenster holen – chatZeigen legt es neu an, wenn
  // keines (mehr) da ist. Sonst „passiert nichts", wenn Julia nur im Tray läuft
  // oder das Fenster zuvor weg war (Issue #45).
  app.on('second-instance', () => chatZeigen('chat'));
  app.on('window-all-closed', () => { /* Julia läuft im Tray weiter */ });
  app.on('before-quit', () => { beendenLaeuft = true; });
  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    win.worker.beenden();
    if (erinnerungen) erinnerungen.stoppen();
    if (mcp) mcp.stoppenAlle();
    if (sync) sync.stoppen();
    if (appserver) appserver.stoppen();
    clearInterval(spielTimer);
    clearInterval(pruefTimer);
    if (minecraft) minecraft.trennen();
    if (agent) agent.stoppen();
    if (weckwort) weckwort.stoppen();
    if (sprache) { sprache.stumm(); sprache.zuhoerenAbbrechen(); }
  });
  // GPU-Abstürze abfangen: wiederholt sich es, weicht Julia beim nächsten Start
  // auf Software-Rendering aus und sagt es einmal – statt still abzustürzen.
  app.whenReady().then(() => {
    startpruefung.gpuUeberwachen({
      app, logbuch: startLog, datenOrdner: DATEN,
      melden: () => melden('Julia', t('start.gpu_software')),
      neustart: () => { beendenLaeuft = true; app.relaunch(); app.exit(0); },
      fatal: (text) => startFatal(text),
    });
    // Grafikkarte und Treiber einmal ins Start-Logbuch schreiben (hilft bei
    // Grafikproblemen auf bestimmten PCs). Nur technische Werte, keine IP,
    // keine Tokens, nichts Persönliches.
    try {
      app.getGPUInfo('basic').then((g) => {
        const d = (g && g.auxAttributes) || {};
        const gpu = (g && g.gpuDevice && g.gpuDevice.find((x) => x && x.active)) || (g && g.gpuDevice && g.gpuDevice[0]) || {};
        letzteGpu = { renderer: d.glRenderer || null, vendor: d.glVendor || null, treiber: d.driverVersion || d.driver_version || null, vendorId: gpu.vendorId || null };
        const sw = startpruefung.softwareRendering(DATEN) || null;
        // Fehlen bei aktiver Hardware-Grafik alle Treiber-Infos, ist die GPU oft
        // degradiert (Issue #3/#54) – dann bleibt die Oberfläche gern leer.
        const degradiert = !sw && !letzteGpu.renderer && !letzteGpu.vendor && !letzteGpu.treiber;
        startLog.schreiben('GPU-INFO', degradiert ? 'Grafik erkannt – KEINE Treiber-Infos (GPU evtl. degradiert)' : 'Grafik erkannt', {
          ...letzteGpu, vendorId: gpu.vendorId || null, deviceId: gpu.deviceId || null,
          software: sw, hardwareBeschleunigt: !sw, gpuAktiv: !!(gpu && Object.keys(gpu).length),
        });
      }).catch((e) => { startLog.schreiben('GPU-INFO', 'GPU-Info nicht abrufbar', { fehler: String(e && e.message || e).slice(0, 120) }); });
    } catch { /* egal */ }
  }).catch(() => { /* Meldung folgt über start() */ });
  app.whenReady().then(start).catch((e) => {
    startLog.schreiben('FATAL', 'Start abgebrochen', { fehler: e.stack || e.message });
    startFatal(`Julia konnte nicht starten.\n\n${e.message}`);
  });
}
