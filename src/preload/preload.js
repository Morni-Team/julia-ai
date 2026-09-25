'use strict';

const { contextBridge, ipcRenderer, webUtils } = require('electron');

// Mitgelieferte Standard-Texte (Deutsch/Englisch) – synchron im Fenster verfügbar,
// damit die Beschriftungen SOFORT beim Laden gesetzt werden können, ohne auf einen
// IPC zu warten (Issue #3/#54: „leeres Fenster" auf langsamen/zickigen PCs). Der
// Hauptprozess liefert später den vollen, an die Einstellung angepassten Satz.
// Mitgelieferte Standard-Texte für die Sofort-/Not-Beschriftung.
// WICHTIG (Issue #3/#54): Dieses Preload läuft in der Chromium-SANDBOX
// (app.enableSandbox()). Dort ist `require()` von lokalen Dateien NICHT erlaubt
// (nur `electron`/Built-ins) – `require('../shared/texte')` schlug im gepackten
// Build also still fehl, die Beschriftungen blieben leer und Julia hielt das
// Fenster fälschlich für „leer" (Neustart-Schleife bis FATAL). Deshalb holen wir
// die Texte SYNCHRON per IPC vom Hauptprozess, der die Datei problemlos liest.
let STANDARD_TEXTE = { de: {}, en: {} };
try {
  const t = ipcRenderer.sendSync('standard-texte');
  if (t && (Object.keys(t.de || {}).length || Object.keys(t.en || {}).length)) STANDARD_TEXTE = t;
} catch { /* Notfalls IPC-only */ }

// NOT-FÜLLUNG (Issue #3/#54): Die Beschriftungen ([data-nav]/[data-t]) werden im
// Renderer per Skript gefüllt; hakt diese Kette auf einem PC, bleibt das Fenster
// leer. Das Preload füllt die Labels dann selbst aus den Standard-Texten – die
// Füll-Logik ist hier INLINE, weil ein sandboxed Preload keine lokalen Module
// requiren darf. Füllt nur LEERE Labels; der Renderer überschreibt später mit dem
// echten, eingestellten Sprachsatz. Gibt die Zahl gefüllter Labels zurück.
function notFuellung() {
  try {
    if (typeof document === 'undefined' || !document.querySelectorAll) return 0;
    const sc = String((typeof navigator !== 'undefined' && navigator.language) || 'de').toLowerCase().startsWith('en') ? 'en' : 'de';
    const satz = (STANDARD_TEXTE[sc] && Object.keys(STANDARD_TEXTE[sc]).length) ? STANDARD_TEXTE[sc]
      : (STANDARD_TEXTE.de && Object.keys(STANDARD_TEXTE.de).length) ? STANDARD_TEXTE.de : null;
    if (!satz) return 0;
    let n = 0;
    const fuell = (sel, attr) => {
      document.querySelectorAll(sel).forEach((el) => {
        const k = el.dataset && el.dataset[attr];
        if (!k) return;
        if (el.textContent && el.textContent.trim()) return;
        const roh = (typeof satz[k] === 'string' && satz[k]) ? satz[k] : k;
        el.textContent = roh.split('{name}').join('Julia'); // stray-Platzhalter abfangen
        n += 1;
      });
    };
    fuell('[data-nav]', 'nav');
    fuell('[data-t]', 't');
    return n;
  } catch { return 0; }
}

// Die einzige Brücke zwischen Oberfläche und Hauptprozess. Die Fenster sehen
// nur diese Funktionen, kein Node und kein Dateisystem.

const KANAELE = [
  'agent:nutzer', 'agent:start', 'agent:text', 'agent:denken', 'agent:werkzeug', 'agent:werkzeugFertig',
  'agent:freigabe', 'agent:freigabeErledigt', 'agent:geheimnisFrage', 'agent:geheimnisErledigt', 'agent:fertig', 'agent:fehler', 'agent:hinweis',
  'zustand', 'pegel', 'sprache:hoert', 'sprache:teil', 'config:geaendert', 'texte:geaendert', 'chat:geleert', 'demo', 'overlay:modus', 'sync:status', 'appserver:status', 'ansicht', 'chat:laden', 'verlauf:geaendert', 'routinen:geaendert', 'auswahl:text', 'clips:geaendert', 'zugriff', 'mc:geaendert', 'mc:code', 'erinnerung', 'kosten', 'mikrotest', 'whisper:status', 'piper:status', 'mcp:status', 'system:zeile',
];

contextBridge.exposeInMainWorld('julia', {
  standardTexte: STANDARD_TEXTE, // synchrone Standard-Texte für die Sofort-Anzeige
  texte: () => ipcRenderer.invoke('texte'),
  config: () => ipcRenderer.invoke('config:lesen'),
  // Aufgefangene Startprobleme (z. B. hängender IPC) ins Start-Logbuch melden,
  // damit „UI bleibt leer" sichtbar wird, statt spurlos zu verschwinden.
  melden: (art, text) => fehlerMelden(String(art || 'melden'), text, '', 0),
  setzen: (schluessel, wert) => ipcRenderer.invoke('config:setzen', schluessel, wert),
  alleFreigeben: (an) => ipcRenderer.invoke('freigabe:immer', !!an),
  fremdFreigeben: (an) => ipcRenderer.invoke('freigabe:fremd', !!an),
  schluesselSetzen: (s) => ipcRenderer.invoke('schluessel:setzen', s),
  anbieterSetzen: (id) => ipcRenderer.invoke('anbieter:setzen', id),
  // Content-Creation-Modul
  contentStatus: () => ipcRenderer.invoke('content:status'),
  contentProfileListe: () => ipcRenderer.invoke('content:profile-list'),
  contentProfilVorlage: (name) => ipcRenderer.invoke('content:profile-vorlage', String(name || '')),
  contentProfilSpeichern: (profil) => ipcRenderer.invoke('content:profile-speichern', profil),
  contentProfilAktiv: (id) => ipcRenderer.invoke('content:profile-aktiv', String(id || '')),
  contentProfilLoeschen: (id) => ipcRenderer.invoke('content:profile-loeschen', String(id || '')),
  contentProfilImport: (json) => ipcRenderer.invoke('content:profile-import', String(json || '')),
  contentProfilExport: (id) => ipcRenderer.invoke('content:profile-export', String(id || '')),
  contentAnalysieren: (eingabe) => ipcRenderer.invoke('content:analysieren', eingabe),
  contentOrdnerWaehlen: () => ipcRenderer.invoke('content:ordner-waehlen'),
  contentVideoWaehlen: () => ipcRenderer.invoke('content:video-waehlen'),
  contentVideoTranskribieren: (pfad) => ipcRenderer.invoke('content:video-transkribieren', String(pfad || '')),
  contentThumbnails: (opts) => ipcRenderer.invoke('content:thumbnails', opts || {}),
  contentThumbnailAnalysieren: (opts) => ipcRenderer.invoke('content:thumbnail-analysieren', opts || {}),
  contentThumbnailKonzept: (opts) => ipcRenderer.invoke('content:thumbnail-konzept', opts || {}),
  contentKiHintergrund: (opts) => ipcRenderer.invoke('content:ki-hintergrund', opts || {}),
  contentSkin: (opts) => ipcRenderer.invoke('content:skin', opts || {}),
  contentAuftragListe: () => ipcRenderer.invoke('content:auftrag-list'),
  contentAuftragAdd: (a) => ipcRenderer.invoke('content:auftrag-add', a || {}),
  contentAuftragStatus: (id, status, notiz) => ipcRenderer.invoke('content:auftrag-status', String(id || ''), String(status || ''), notiz == null ? null : String(notiz)),
  contentAuftragRemove: (id) => ipcRenderer.invoke('content:auftrag-remove', String(id || '')),
  contentAuftragVideo: () => ipcRenderer.invoke('content:auftrag-video'),
  contentPlanListe: () => ipcRenderer.invoke('content:plan-list'),
  contentPlanAdd: (p) => ipcRenderer.invoke('content:plan-add', p || {}),
  contentPlanUpdate: (id, felder) => ipcRenderer.invoke('content:plan-update', String(id || ''), felder || {}),
  contentPlanRemove: (id) => ipcRenderer.invoke('content:plan-remove', String(id || '')),
  contentBildWaehlen: () => ipcRenderer.invoke('content:bild-waehlen'),
  modelleLaden: () => ipcRenderer.invoke('anbieter:modelle'),
  werkzeuge: () => ipcRenderer.invoke('werkzeuge:liste'),
  werkzeugKategorien: () => ipcRenderer.invoke('werkzeuge:kategorien'),
  boostStatus: () => ipcRenderer.invoke('boost:status'),
  boostProzesse: (sortierung) => ipcRenderer.invoke('boost:prozesse', String(sortierung || 'ram')),
  boostDoppelte: (pfad) => ipcRenderer.invoke('boost:doppelte', String(pfad || '')),
  boostBremsen: (pid, name, an) => ipcRenderer.invoke('boost:bremsen', Number(pid) || 0, String(name || ''), !!an),
  rollenLesen: () => ipcRenderer.invoke('rollen:lesen'),
  rollenSpeichern: (rollen, aktiv) => ipcRenderer.invoke('rollen:speichern', rollen, aktiv),
  geheimnisse: () => ipcRenderer.invoke('geheimnisse:liste'),
  geheimnisSetzen: (name, wert) => ipcRenderer.invoke('geheimnisse:setzen', String(name || ''), String(wert || '')),
  geheimnisLoeschen: (name) => ipcRenderer.invoke('geheimnisse:loeschen', String(name || '')),
  ordnerWaehlen: () => ipcRenderer.invoke('ordner:waehlen'),
  stimmen: () => ipcRenderer.invoke('stimmen'),
  audioGeraete: () => ipcRenderer.invoke('audio:geraete'),
  spracheTesten: () => ipcRenderer.invoke('sprache:testen'),
  mikrofonTest: () => ipcRenderer.invoke('sprache:mikrofontest'),
  whisperStatus: () => ipcRenderer.invoke('whisper:status'),
  whisperLaden: () => ipcRenderer.invoke('whisper:laden'),
  whisperAbbrechen: () => ipcRenderer.invoke('whisper:abbrechen'),
  piperStatus: () => ipcRenderer.invoke('piper:status'),
  piperLaden: () => ipcRenderer.invoke('piper:laden'),
  piperAbbrechen: () => ipcRenderer.invoke('piper:abbrechen'),
  kontenStatus: () => ipcRenderer.invoke('konten:status'),
  googleVerbinden: (daten) => ipcRenderer.invoke('konten:google:verbinden', daten),
  googleTrennen: () => ipcRenderer.invoke('konten:google:trennen'),
  outlookVerbinden: (daten) => ipcRenderer.invoke('konten:outlook:verbinden', { clientId: String((daten && daten.clientId) || '') }),
  outlookTrennen: () => ipcRenderer.invoke('konten:outlook:trennen'),
  kostenHeute: () => ipcRenderer.invoke('kosten:heute'),
  startUeberblick: (neu) => ipcRenderer.invoke('start:ueberblick', !!neu),
  verlaufListe: (suche) => ipcRenderer.invoke('verlauf:liste', String(suche || '')),
  verlaufLesen: (id) => ipcRenderer.invoke('verlauf:lesen', String(id)),
  verlaufFortsetzen: (id) => ipcRenderer.invoke('verlauf:fortsetzen', String(id)),
  verlaufLoeschen: (id) => ipcRenderer.invoke('verlauf:loeschen', String(id)),
  verlaufAlleLoeschen: () => ipcRenderer.invoke('verlauf:alle_loeschen'),
  codeUebersicht: () => ipcRenderer.invoke('code:uebersicht'),
  codeDetails: (p) => ipcRenderer.invoke('code:details', String(p)),
  codeDiff: (p, datei) => ipcRenderer.invoke('code:diff', String(p), String(datei)),
  codeHinzufuegen: () => ipcRenderer.invoke('code:hinzufuegen'),
  codeEntfernen: (p) => ipcRenderer.invoke('code:entfernen', String(p)),
  codeOeffnen: (p, wie) => ipcRenderer.invoke('code:oeffnen', String(p), String(wie || '')),
  clipsListe: () => ipcRenderer.invoke('clips:liste'),
  clipAufnehmen: () => ipcRenderer.invoke('clips:aufnehmen'),
  clipsOrdner: () => ipcRenderer.invoke('clips:ordner'),
  clipZeigen: (p) => ipcRenderer.invoke('clips:zeigen', String(p)),
  clipLoeschen: (p) => ipcRenderer.invoke('clips:loeschen', String(p)),
  clipUmbenennen: (p, name) => ipcRenderer.invoke('clips:umbenennen', String(p), String(name)),
  clipsWindows: () => ipcRenderer.invoke('clips:windows'),
  mcStatus: () => ipcRenderer.invoke('mc:status'),
  mcBeitreten: (d) => ipcRenderer.invoke('mc:beitreten', { adresse: String((d && d.adresse) || ''), spieler: String((d && d.spieler) || '') }),
  mcVerlassen: () => ipcRenderer.invoke('mc:verlassen'),
  mcAufgabe: (a) => {
    const d = a || {};
    const text = (v) => (v ? String(v).slice(0, 60) : undefined);
    const zahl = (v) => (v === undefined || v === null || v === '' ? undefined : Number(v));
    return ipcRenderer.invoke('mc:aufgabe', {
      aufgabe: String(d.aufgabe || ''), block: text(d.block), item: text(d.item), tier: text(d.tier),
      anzahl: d.anzahl ? Number(d.anzahl) : undefined, x: zahl(d.x), y: zahl(d.y), z: zahl(d.z),
    });
  },
  mcTrennungWeg: () => ipcRenderer.invoke('mc:trennungweg'),
  mcZiel: (text) => ipcRenderer.invoke('mc:ziel', String(text || '').slice(0, 1000)),
  mcZielStopp: () => ipcRenderer.invoke('mc:ziel:stopp'),
  mcGruppeBeitreten: (id, passwort, merken) => ipcRenderer.invoke('mc:gruppe:beitreten', String(id || ''), String(passwort || '').slice(0, 512), !!merken),
  mcGruppeVerlassen: () => ipcRenderer.invoke('mc:gruppe:verlassen'),
  mcGruppeVergessen: () => ipcRenderer.invoke('mc:gruppe:vergessen'),
  overlayVorschau: () => ipcRenderer.invoke('overlay:vorschau'),
  mcpStatus: () => ipcRenderer.invoke('mcp:status'),
  mcpHinzufuegen: (d) => {
    const x = d || {};
    const s = (v, max) => String(v || '').slice(0, max);
    return ipcRenderer.invoke('mcp:hinzufuegen', {
      name: s(x.name, 60), art: x.art === 'http' ? 'http' : 'stdio', befehl: s(x.befehl, 1000), url: s(x.url, 500), umgebung: s(x.umgebung, 8000), vertraut: x.vertraut === true,
    });
  },
  mcpImport: (text) => ipcRenderer.invoke('mcp:import', String(text || '').slice(0, 200000)),
  mcpEntfernen: (id) => ipcRenderer.invoke('mcp:entfernen', String(id || '')),
  mcpSchalten: (id, an) => ipcRenderer.invoke('mcp:schalten', String(id || ''), !!an),
  mcpNeu: (id) => ipcRenderer.invoke('mcp:neu', String(id || '')),
  reparaturStatus: () => ipcRenderer.invoke('reparatur:status'),
  reparaturSoftware: (an) => ipcRenderer.invoke('reparatur:software', !!an),
  reparaturTreiber: (url) => ipcRenderer.invoke('reparatur:treiber', String(url || '')),
  defenderStatus: () => ipcRenderer.invoke('defender:status'),
  defenderAusschliessen: () => ipcRenderer.invoke('defender:ausschliessen'),
  updateZurueckrollen: () => ipcRenderer.invoke('update:zurueckrollen'),
  mcChat: (text) => ipcRenderer.invoke('mc:chat', String(text || '')),
  mcKontoVerbinden: () => ipcRenderer.invoke('mc:konto:verbinden'),
  mcKontoAbmelden: () => ipcRenderer.invoke('mc:konto:abmelden'),
  routinenListe: () => ipcRenderer.invoke('routinen:liste'),
  routineSpeichern: (r) => ipcRenderer.invoke('routinen:speichern', r),
  routineLoeschen: (id) => ipcRenderer.invoke('routinen:loeschen', String(id)),
  routineStarten: (id) => ipcRenderer.invoke('routinen:starten', String(id)),
  syncStatus: () => ipcRenderer.invoke('sync:status'),
  syncCode: () => ipcRenderer.invoke('sync:code'),
  syncBeitreten: (d) => ipcRenderer.invoke('sync:beitreten', { code: String((d && d.code) || ''), adresse: String((d && d.adresse) || '') }),
  syncEntfernen: (id) => ipcRenderer.invoke('sync:entfernen', String(id || '')),
  syncJetzt: () => ipcRenderer.invoke('sync:jetzt'),
  jarvisSetzen: (an) => ipcRenderer.invoke('jarvis:setzen', !!an),
  appserverStatus: () => ipcRenderer.invoke('appserver:status'),
  appserverKoppeln: () => ipcRenderer.invoke('appserver:koppeln'),
  appserverTrennen: () => ipcRenderer.invoke('appserver:trennen'),
  minecraftLogbuchOeffnen: () => ipcRenderer.invoke('minecraft:logbuchOeffnen'),
  einrichtungFertig: () => ipcRenderer.invoke('einrichtung:fertig'),
  status: () => ipcRenderer.invoke('chat:status'),
  senden: (text, pfade) => ipcRenderer.invoke('chat:senden', text, Array.isArray(pfade) ? pfade : []),
  // Pfad einer hineingezogenen Datei (Electron gibt ihn der Seite nicht direkt).
  dateiPfad: (datei) => { try { return webUtils.getPathForFile(datei) || ''; } catch { return ''; } },
  kopieren: (text) => ipcRenderer.invoke('zwischenablage:schreiben', String(text || '')),
  blaseMaus: (ueber) => ipcRenderer.send('blase:maus', !!ueber),
  blaseZiehen: (dx, dy) => ipcRenderer.send('blase:ziehen', Number(dx) || 0, Number(dy) || 0),
  blaseAbgelegt: () => ipcRenderer.send('blase:abgelegt'),
  blaseDoppelklick: () => ipcRenderer.send('blase:doppelklick'),
  blaseHoehe: (h) => ipcRenderer.send('blase:hoehe', Number(h) || 0),
  overlayMaus: (drin) => ipcRenderer.send('overlay:maus', !!drin),
  overlayAktivieren: () => ipcRenderer.send('overlay:aktivieren'),
  zugriffMaus: (ueber) => ipcRenderer.send('zugriff:maus', !!ueber),
  zugriffStopp: () => ipcRenderer.send('zugriff:stopp'),
  auswahlAktion: (aktion, frage) => ipcRenderer.invoke('auswahl:aktion', String(aktion), String(frage || '')),
  abbrechen: () => ipcRenderer.send('chat:abbrechen'),
  neu: () => ipcRenderer.send('chat:neu'),
  sprechen: () => ipcRenderer.send('sprache:umschalten'),
  freigabe: (id, ja) => ipcRenderer.send('freigabe:antwort', { id, ja }),
  // Antwort auf „KI fragt nach geheimem Wert": der Wert geht direkt an den
  // Hauptprozess (verschlüsselt abgelegt), nie über den Agenten/die KI.
  geheimnisEingabe: (daten) => ipcRenderer.send('geheimnis:eingabe', daten || {}),
  einstellungen: () => ipcRenderer.send('fenster:einstellungen'),
  schliessen: () => ipcRenderer.send('fenster:schliessen'),
  on: (kanal, rueckruf) => {
    if (!KANAELE.includes(kanal)) throw new Error(`Unbekannter Kanal ${kanal}`);
    const f = (_e, daten) => rueckruf(daten);
    ipcRenderer.on(kanal, f);
    return () => ipcRenderer.removeListener(kanal, f);
  },
});

// Fehlersystem: unbehandelte Fehler der Oberfläche ins Start-Logbuch melden,
// damit ein „UI lädt nicht" (Issue #3) sichtbar wird. Läuft in jedem Fenster.
function fehlerMelden(art, nachricht, quelle, zeile) {
  try {
    ipcRenderer.send('diagnose:rendererFehler', {
      art,
      nachricht: String(nachricht == null ? '' : (nachricht.message || nachricht)).slice(0, 500),
      quelle: String(quelle || '').slice(0, 200),
      zeile: Number(zeile) || 0,
      seite: (typeof location !== 'undefined' && location.pathname) || '',
    });
  } catch { /* Melden darf nie selbst stören */ }
}
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('error', (e) => fehlerMelden('fehler', e.error || e.message, e.filename, e.lineno));
  window.addEventListener('unhandledrejection', (e) => fehlerMelden('promise', e.reason, '', 0));

  // Früh-Füllung: sobald das HTML steht, die Beschriftungen direkt aus den
  // mitgelieferten Texten setzen, falls der Renderer sie (noch) nicht gefüllt
  // hat. So ist das Fenster praktisch sofort beschriftet – unabhängig davon, ob
  // die Renderer-Kette (contextBridge/Init) auf diesem PC greift (Issue #3/#54).
  // Der Renderer überschreibt später mit dem echten, eingestellten Sprachsatz.
  const fruehFuellen = () => { try { notFuellung(); } catch { /* egal */ } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fruehFuellen);
  else fruehFuellen();

  // UI-Healthcheck (Issue #45): Manchmal startet ein Fenster, aber die Oberfläche
  // bleibt „leer"/unstyled (Knöpfe und Layout fehlen), weil das CSS nicht griff
  // oder der Inhalt nicht aufgebaut wurde. Kurz nach dem Laden prüfen wir, ob
  // überhaupt Stil (Stylesheets) und Inhalt (Elemente im Body) da sind. Ist die
  // Oberflaeche leer, wird das ins Logbuch gemeldet und EINMAL neu geladen
  // (Selbstheilung); klappt es dann immer noch nicht, nur melden – keine Schleife.
  //
  // WICHTIG (Issue #55/#3): erst NACH dem Start-Zeitlimit prüfen. Der Renderer
  // füllt die Beschriftungen zur Not per Ersatz (chat.js, ~8 s). Prüfte der
  // Healthcheck früher, meldete er fälschlich „leer" und die Selbstheilung
  // startete neu, BEVOR der Ersatz greifen konnte – eine Neustart-Schleife. Darum
  // deutlich später als das Init-Zeitlimit prüfen.
  window.addEventListener('load', () => {
    setTimeout(() => {
      let leer = false;
      let grund = '';
      let renderKaputt = false; // true nur, wenn CSS/Body wirklich fehlen (echtes Grafik-/Render-Problem)
      try {
        const b = document.body;
        const ohneStil = !document.styleSheets || document.styleSheets.length === 0;
        const ohneInhalt = !b || b.childElementCount === 0;
        renderKaputt = ohneStil || ohneInhalt;
        // Zusätzlich (Issue #26/#45): Das HTML ist zwar da, aber die Beschriftungen
        // werden erst per Skript gefüllt. Hängt der Start-IPC, bleiben alle
        // Navigations-Texte leer – für den Nutzer „keine Elemente", ohne Fehler.
        let beschriftet = document.querySelectorAll('[data-nav],[data-t]');
        let leereTexte = beschriftet.length > 0
          && [...beschriftet].every((el) => !el.textContent.trim());
        // Sind alle Beschriftungen leer, ERST die Not-Füllung aus den mitgelieferten
        // Texten versuchen (Issue #3/#54) und dann neu messen. Greift sie, ist das
        // Fenster gerettet – kein „leeres Fenster", kein Neustart, kein FATAL.
        let notGefuellt = 0;
        if (leereTexte && !ohneStil && !ohneInhalt) {
          notGefuellt = notFuellung();
          beschriftet = document.querySelectorAll('[data-nav],[data-t]');
          leereTexte = beschriftet.length > 0 && [...beschriftet].every((el) => !el.textContent.trim());
        }
        leer = ohneStil || ohneInhalt || leereTexte;
        // Konkrete Diagnose ins Log (Issue #3/#54): sagt beim nächsten Mal genau,
        // WAS leer ist – Body-Kinder, wie viele Beschriftungen (leer/gesamt),
        // ob die Not-Füllung griff, wie viele Standard-Texte da sind, Ladezustand, CSS.
        const gesamt = beschriftet.length;
        const leerAnzahl = [...beschriftet].filter((el) => !el.textContent.trim()).length;
        const stdAnzahl = (() => { try { return Object.keys(STANDARD_TEXTE.de || {}).length; } catch { return -1; } })();
        const diag = `body=${b ? b.childElementCount : 0} texte=${leerAnzahl}/${gesamt} notfuellung=${notGefuellt} standardtexte=${stdAnzahl} julia=${typeof window !== 'undefined' && window.julia ? 1 : 0} css=${document.styleSheets ? document.styleSheets.length : 0} readyState=${document.readyState}`;
        grund = (ohneStil ? 'ohne Stil (CSS fehlt)' : ohneInhalt ? 'ohne Inhalt (Body leer)' : leereTexte ? 'Beschriftungen leer – Start hing beim Laden' : '') + ` [${diag}]`;
        if (!leer && notGefuellt > 0) { try { fehlerMelden('ui-healthcheck', `Oberfläche per Not-Füllung gerettet (${notGefuellt} Beschriftungen) – [${diag}]`, '', 0); } catch { /* egal */ } }
      } catch { leer = true; grund = 'Prüfung fehlgeschlagen'; renderKaputt = true; }
      if (!leer) return;
      // Nur ein ECHTES Render-Problem (CSS/Body fehlt) darf über den Hauptprozess
      // die Grafik-Leiter/FATAL auslösen ('ui-healthcheck'). Sind nur die Texte
      // leer, ist das NIE ein Grafikproblem – dann eigener, harmloser Typ, der
      // höchstens einmal neu lädt, aber nie neu startet/FATAL wird (Issue #3/#54).
      fehlerMelden(renderKaputt ? 'ui-healthcheck' : 'ui-texte-leer', `Oberfläche nach dem Laden leer – ${grund}`, '', 0);
      try {
        if (!sessionStorage.getItem('ui-neu-geladen')) {
          sessionStorage.setItem('ui-neu-geladen', '1');
          setTimeout(() => { try { location.reload(); } catch { /* egal */ } }, 400);
        }
      } catch { /* sessionStorage evtl. blockiert – dann nur melden */ }
    }, 20000);
  });
}
