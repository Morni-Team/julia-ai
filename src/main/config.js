'use strict';

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

// Die config.json liegt außerhalb des Repos (%APPDATA%\Julia) und wird von
// Updates nie angefasst.

const ZUSTAENDE = ['idle', 'listening', 'thinking', 'speaking'];
const ECKEN = ['unten-rechts', 'unten-links', 'oben-rechts', 'oben-links'];

const STANDARD = {
  einrichtung_fertig: false,
  sprachcode: 'de', // 'de' | 'en' – Oberfläche und Julias Sprache
  assistent: {
    name: 'Julia',
    form: 'weiblich', // 'weiblich' | 'maennlich' | 'neutral'
  },
  nutzer: {
    name: '',
    pronomen: 'neutral', // 'er' | 'sie' | 'neutral' (nur Name) | 'eigene'
    pronomen_eigen: '',
  },
  arbeitsverzeichnisse: [],
  // Schlüssel liegen nur DPAPI-verschlüsselt hier: Anthropic im alten Feld,
  // alle anderen Anbieter unter je_anbieter.<id>.
  api: { schluessel_verschluesselt: '', je_anbieter: {} },
  anbieter: 'anthropic', // siehe anbieter/liste.js
  anbieter_url: '', // nur für "eigen": OpenAI-kompatible Adresse
  modell: 'claude-opus-5',
  modelle_ohne_bild: [], // Modelle, die keine Bilder/Screenshots verstehen – dann werden Screenshots nicht mitgeschickt (lernt Julia selbst, wenn ein Anbieter „Vision disabled" meldet)
  modelle_ohne_reasoning: [], // Modelle, die reasoning_effort ablehnen – dann wird der Denkaufwand für sie weggelassen (lernt Julia selbst, wenn ein Anbieter den Parameter mit 400 zurückweist – Issue #79)
  aufwand: 'medium', // Denkaufwand: Standard „mittel" – gute Antworten bei spürbar mehr Tempo (Issue #75). Wer mehr Tiefe will, stellt in den Einstellungen auf high/xhigh/max; für Sprache/Bildschirmsteuerung wird ohnehin schneller gedacht.
  kategorien_aus: [], // Abgeschaltete Werkzeug-Kategorien (Issue #75/#76): ganze Gruppen aus = weniger aktive Werkzeuge = schneller/tokenschonender. Nur der Nutzer (nicht KI-setzbar); Kern-Werkzeuge bleiben immer an.
  kanal: 'desktop',
  video: { ffmpeg: '' }, // Pfad zu ffmpeg.exe (leer = mitgeliefertes/PATH-ffmpeg). Für Video schneiden/Thumbnails.
  autostart: false,
  erinnerung: {
    vorlesen: true,
  },
  verlauf: {
    speichern: true, // Gespräche verschlüsselt auf diesem PC behalten
  },
  code: {
    projekte: [], // Ordner für den Code-Reiter
  },
  clip: {
    methode: 'gamebar', // 'gamebar' | 'nvidia' | 'amd' | 'eigen'
    taste: '', // nur für 'eigen'
    ordner: '', // leer = passend zur Methode (Videos\Captures …)
  },
  kosten: {
    tageslimit_usd: 10, // 0 = keine Bremse
  },
  weckwort: {
    an: false, // Mikrofon bleibt offen – deshalb nur, wenn ausdrücklich eingeschaltet
    schwelle: 0.8,
    phrasen: [], // eigene Aktivierungswörter; leer = "Hey/Hallo/Okay" + Name
  },
  design: {
    modus: 'dunkel', // 'dunkel' | 'hell' | 'system'
    akzent: '#FF7A1A',
    glow: true,
    jarvis: false, // Easter-Egg: „jarvis" im Chat → Jarvis-Look und -Sprechweise, „julia" zurück
  },
  hotkey: {
    sprechen: 'Control+Alt+Space',
    chat: 'Control+Alt+J',
    overlay: 'Control+Shift+Space', // leer = abgeschaltet
    auswahl: 'Control+Alt+T', // markierten Text übernehmen; leer = abgeschaltet
    clip: 'Control+Alt+C', // Gaming-Clip speichern; leer = abgeschaltet
  },
  overlay: {
    monitor: 0,
    ecke: 'oben-rechts',
    deckkraft: 0.94,
    bei_antwort: 'aus', // 'aus' | 'passiv' – bei Sprachbefehlen die Antwort kurz einblenden
    automatisch: true, // beim Spielen von selbst einblenden (passiv)
    spiele: [], // weitere Spiele als Programmnamen, z. B. "valorant"
    breite: 380, // 280–720 px
    hoehe: 560, // 240–1000 px, höchstens so hoch wie der Bildschirm
    schrift: 13, // Schriftgröße 11–18 px
    hintergrund: 0.86, // Deckkraft nur des Hintergrunds – der Text bleibt klar
    kompakt: false, // im Spiel nur die letzten drei Nachrichten
    ausblenden: 12, // Sekunden, bis eingeblendete Antworten wieder verschwinden
    position: null, // { x, y } nach dem Verschieben, sonst Ecke
    immer: false, // dauerhaft zeigen (durchlässig), auch ohne Spiel
  },
  sprache: {
    vorlesen: 'bei-sprache', // 'bei-sprache' | 'immer' | 'nie'
    stimme: 'Microsoft Hedda Desktop',
    tempo: 0,               // -10 bis 10
    mikrofon: '',           // leer = Windows-Standard, sonst Gerätename
    lautsprecher: '',       // leer = Windows-Standard, sonst Gerätename
    erkennung: 'whisper',   // 'whisper' (lokal, genau) | 'windows' (alt, ungenau)
    whisper_modell: 'genau', // 'genau' (190 MB) | 'schnell' (60 MB)
    pause_s: 1.6,           // wie lange Stille das Sprechen beendet (Sekunden) – höher = mehr Pausen-Toleranz, bricht seltener mittendrin ab
  },
  blase: {
    an: false,
    monitor: 1,
    groesse: 360,
    ecke: 'unten-rechts',
    deckkraft: 1.0,
    farben: {
      idle: ['#6B5CFF', '#35E0C8'],
      listening: ['#35E0C8', '#FF6F9C'],
      thinking: ['#FFC15E', '#FF6F9C'],
      speaking: ['#FF6F9C', '#6B5CFF'],
    },
    tempo: 1.0,
    empfindlichkeit: 1.0,
    untertitel: true, // unter der Blase: was du sagst und die Antwort
    position: null, // { x, y } nach dem Verschieben mit der Maus, sonst Ecke
  },
  update: {
    pruefen: true,
    automatisch: false,
    kanal: 'stabil', // 'stabil' | 'test'
  },
  freigabe: {
    immer: false, // "Allem zustimmen": nur von Hand, nach einer Rückfrage
    fremd: false, // dazu auch nach Webseiten/Mails nicht fragen – eigene Warnung
  },
  minecraft: {
    adresse: '', // leer = localhost
    port: 25565,
    spieler: '', // dein Name im Spiel – auf ihn hört die Spielfigur
    botname: '', // leer = Name der KI
    konto: '', // Name des verbundenen Minecraft-Kontos (nur Anzeige; die Anmeldung liegt verschlüsselt extra)
    stimme: true, // Simple Voice Chat nutzen, wenn der Server ihn hat
    gruppe: '', // dieser Voice-Chat-Gruppe von selbst beitreten (Passwort verschlüsselt im Tresor)
    jeder: false, // auf alle Spieler im Chat reagieren statt nur auf den eingetragenen
    erlaubte: [], // zusätzlich zum Besitzer erlaubte Spielernamen (im Spiel per „hör auch auf X“ pflegbar)
    benachrichtigen: 'wichtige', // Windows-Benachrichtigungen aus Minecraft: 'alle' | 'wichtige' | 'keine' (Standard: nur Wichtiges, damit Bauen/Essen nicht ständig pusht)
    chat_zeigen: true, // In-Game-Chat im Minecraft-Tab anzeigen (aus = die Nachrichtenliste ausblenden)
    chat_mitreden: false, // von sich aus (z. B. beim Durchspielen) in den SPIELCHAT schreiben. Standard AUS: dann antwortet Julia im Spielchat nur, wenn ihr jemand schreibt – ihre Durchspiel-Erzählung bleibt im Fenster.
    chat_fortschritt: false, // ihre Status-/Fortschritts-Meldungen (z. B. „16× stick hergestellt", „crafting_table steht bei …") in den SPIELCHAT schreiben. Standard AUS: dann stehen sie nur im Julia-Fenster, spammen aber nicht den Spielchat zu.
    sozial: false, // BETA (Issue #94): soziales Gedächtnis & Persönlichkeit – Julia merkt sich pro Spieler Ruf/Vertrauen, ist skeptisch bei Prahlerei/Cheat-Verdacht und kann kühl/„nein“ reagieren. Standard AUS; wenn an, plaudert sie im Spiel auch mit anderen (nur im Spiel, nie am PC).
    sozial_verzoegern: true, // wenn sozial an: beim Antworten im Chat kurz „Zeit lassen“ (menschlicher), statt sofort zu tippen
    persoenlichkeit: 'freundlich', // Grundton der Persönlichkeit: 'freundlich' | 'ruhig' | 'frech' | 'schlagfertig'
    token_limit: 0, // Issue #98: max. geschätzte Tokens fürs In-Game-Plaudern je Sitzung (0 = kein Limit). Bei Erreichen verabschiedet sich Julia und plaudert nicht mehr.
    ruhe_von: -1, // Ruhezeit-Beginn (Stunde 0..23, -1 = aus): in diesem Fenster ist Julia im Spiel „offline“ und plaudert nicht
    ruhe_bis: -1, // Ruhezeit-Ende (Stunde 0..23, -1 = aus)
  },
  sync: {
    an: false, // Geräte-Abgleich von PC zu PC – standardmäßig aus
    port: 8766,
  },
  appserver: {
    an: false, // Zugriff durch die Julia-Android-App im Heimnetz/VPN – standardmäßig aus
    port: 8770,
  },
  content: {
    // Content-Creation-Modul (eigenständiges Video-Erstellungs-Modul). Standard AUS,
    // sauber gekapselt – ist es aus, wird der Menüpunkt ausgeblendet und nichts geladen.
    aktiv: false,
    modus: 'lokal', // 'lokal' (dieser PC) oder 'worker' (Laptop bedient Adobe, PC steuert)
    tempo: 'normal', // Zuschauen-Modus: 'sofort' | 'normal' | 'zeitlupe'
    bridge_port: 8771, // localhost-WebSocket, mit dem sich die Adobe-Plugins verbinden
    worker_port: 8772, // LAN-Kanal Laptop<->PC (nur Heimnetz/VPN)
    pfade: { premiere: '', aftereffects: '', photoshop: '', audition: '', media_encoder: '', whisper_modell: '', netzwerkfreigabe: '' },
  },
  diagnose: {
    senden: false, // opt-in: bereinigte Diagnose-/Crash-Berichte an VibeWork melden dürfen (nie IP/Tokens)
  },
  sandbox: {
    an: false, // „Nur-in-diesem-Ordner"-Modus: Datei-Aktionen außerhalb sind ROT (gesperrt)
    ordner: '', // der einzige Ordner, in dem gelesen/geschrieben/aufgelistet werden darf
  },
  memos: {
    an: true, // Julia darf sich dauerhafte Lern-Notizen in einem versteckten Ordner (.julia-memos) im Arbeitsordner anlegen
  },
  werkzeuge_aus: [], // Namen abgeschalteter Werkzeuge: die KI darf sie nicht nutzen (rein einschränkend; in den Einstellungen wählbar)
  brainstorming: {
    an: false, // Brainstorming-Modus: Antworten offener/ideenreicher (mehrere Optionen, Abwägungen) – Standard aus
  },
  beta: {
    // BETA/experimentell, sicherheitskritisch, Standard aus. Nur der Nutzer kann
    // das in den Einstellungen (mit ausgeschriebener Bestätigung) einschalten –
    // die KI kann es nicht selbst setzen (nicht in der einstellung_setzen-Freigabe).
    selbstcode: false, // erlaubt Julia (später) im Sandbox-Ordner eigene Werkzeuge zu schreiben/auszuführen
    agenten: false, // Agenten-Rollen (Issue #58): eigene, spezialisierte Julias mit Zusatz-Anweisung
  },
  // Agenten-Rollen (Issue #58, BETA): benannte Rollen mit einer Zusatz-Anweisung
  // an den System-Prompt. rolle_aktiv nennt die gerade aktive Rolle (leer = keine).
  rollen: [], // [{ name, anweisung }]
  rolle_aktiv: '',
  shell: {
    timeout_s: 60, // Standard-Zeitlimit für Shell-Befehle, wenn die KI keines nennt
    max_s: 600, // hartes Maximum: kein Shell-Befehl läuft länger, auch wenn die KI mehr will – hängende Befehle brechen so sicher ab
  },
  mcp: {
    server: [], // angeschlossene MCP-Server; Tokens liegen verschlüsselt im Tresor
  },
};

function klon(x) {
  return JSON.parse(JSON.stringify(x));
}

function istObjekt(x) {
  return x && typeof x === 'object' && !Array.isArray(x);
}

// Übernimmt nur Schlüssel, die es im Standard gibt; Listen werden ersetzt,
// nicht gemischt. So bleiben alte Konfigurationen nach Updates lesbar.
function mischen(standard, datei) {
  const out = klon(standard);
  if (!istObjekt(datei)) return out;
  for (const [k, v] of Object.entries(datei)) {
    // Gefährliche Schlüssel nie mischen (Prototype-Pollution): `k in standard`
    // wäre für `__proto__`/`constructor` über die Prototypenkette sonst wahr.
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    if (!Object.prototype.hasOwnProperty.call(standard, k)) continue;
    if (k === 'je_anbieter') {
      // Freie Schlüssel (Anbieter-IDs), nur Texte übernehmen.
      if (istObjekt(v)) for (const [id, s] of Object.entries(v)) if (typeof s === 'string' && s) out.je_anbieter[id] = s;
    } else if (istObjekt(standard[k]) && k !== 'farben') out[k] = mischen(standard[k], v);
    else if (k === 'farben' && istObjekt(v)) {
      for (const z of ZUSTAENDE) if (Array.isArray(v[z]) && v[z].length) out.farben[z] = v[z];
    } else if (v !== undefined) out[k] = v;
  }
  return out;
}

const HEX = /^#[0-9a-f]{6}$/i;

function zahl(wert, min, max, name) {
  const n = Number(wert);
  if (!Number.isFinite(n)) throw new Error(`${name} muss eine Zahl sein.`);
  if (n < min || n > max) throw new Error(`${name} muss zwischen ${min} und ${max} liegen.`);
  return n;
}

function farbe(wert) {
  let s = String(wert).trim();
  if (/^[0-9a-f]{6}$/i.test(s)) s = '#' + s;
  if (/^#[0-9a-f]{3}$/i.test(s)) s = '#' + s.slice(1).split('').map((c) => c + c).join('');
  if (!HEX.test(s)) throw new Error(`"${wert}" ist keine Hex-Farbe wie #6B5CFF.`);
  return s.toUpperCase();
}

// Prüft und normalisiert einen einzelnen Wert. Gibt den bereinigten Wert
// zurück oder wirft mit einer deutschen Fehlermeldung.
function pruefen(schluessel, wert) {
  const m = /^blase\.farben\.(\w+)$/.exec(schluessel);
  if (m) {
    if (!ZUSTAENDE.includes(m[1])) throw new Error(`Unbekannter Zustand "${m[1]}", erlaubt: ${ZUSTAENDE.join(', ')}.`);
    const liste = Array.isArray(wert) ? wert : String(wert).split(/[\s,]+/).filter(Boolean);
    if (!liste.length) throw new Error('Mindestens eine Farbe angeben.');
    return liste.map(farbe);
  }
  switch (schluessel) {
    case 'blase.an':
    case 'update.pruefen':
    case 'update.automatisch':
    case 'autostart':
    case 'einrichtung_fertig':
    case 'design.glow':
    case 'design.jarvis':
    case 'erinnerung.vorlesen':
    case 'verlauf.speichern':
    case 'blase.untertitel':
    case 'weckwort.an':
    case 'freigabe.immer':
    case 'freigabe.fremd':
    case 'sync.an':
    case 'appserver.an':
    case 'diagnose.senden':
    case 'sandbox.an':
    case 'memos.an':
    case 'brainstorming.an':
    case 'beta.selbstcode':
    case 'beta.agenten':
    case 'minecraft.stimme':
    case 'minecraft.jeder':
    case 'minecraft.chat_zeigen':
    case 'minecraft.sozial':
    case 'minecraft.sozial_verzoegern':
    case 'minecraft.chat_mitreden':
    case 'minecraft.chat_fortschritt':
    case 'content.aktiv':
    case 'overlay.automatisch':
    case 'overlay.kompakt':
    case 'overlay.immer':
      if (typeof wert === 'boolean') return wert;
      if (wert === 'true' || wert === 'an') return true;
      if (wert === 'false' || wert === 'aus') return false;
      throw new Error(`${schluessel} ist an oder aus (true/false).`);
    case 'minecraft.benachrichtigen': {
      const v = String(wert || '').toLowerCase();
      if (!['alle', 'wichtige', 'keine'].includes(v)) throw new Error("minecraft.benachrichtigen muss 'alle', 'wichtige' oder 'keine' sein.");
      return v;
    }
    case 'minecraft.persoenlichkeit': {
      const v = String(wert || '').toLowerCase();
      if (!['freundlich', 'ruhig', 'frech', 'schlagfertig'].includes(v)) throw new Error("minecraft.persoenlichkeit muss 'freundlich', 'ruhig', 'frech' oder 'schlagfertig' sein.");
      return v;
    }
    case 'blase.monitor': return Math.round(zahl(wert, 0, 8, 'Monitor'));
    case 'blase.groesse': return Math.round(zahl(wert, 80, 2000, 'Größe'));
    case 'blase.deckkraft': return zahl(wert, 0.1, 1.0, 'Deckkraft');
    case 'blase.tempo': return zahl(wert, 0, 5, 'Tempo');
    case 'blase.empfindlichkeit': return zahl(wert, 0, 5, 'Empfindlichkeit');
    case 'blase.ecke':
      if (!ECKEN.includes(wert)) throw new Error(`Ecke muss eine von ${ECKEN.join(', ')} sein.`);
      return wert;
    case 'update.kanal':
      if (!['stabil', 'test'].includes(wert)) throw new Error('Update-Kanal ist "stabil" oder "test".');
      return wert;
    case 'sprache.vorlesen':
      if (!['bei-sprache', 'immer', 'nie'].includes(wert)) throw new Error('Vorlesen ist "bei-sprache", "immer" oder "nie".');
      return wert;
    case 'sprache.erkennung':
      if (!['whisper', 'windows'].includes(wert)) throw new Error('Die Spracherkennung ist "whisper" oder "windows".');
      return wert;
    case 'sprache.whisper_modell':
      if (!['genau', 'schnell'].includes(wert)) throw new Error('Das Whisper-Modell ist "genau" oder "schnell".');
      return wert;
    case 'sprache.tempo': return Math.round(zahl(wert, -10, 10, 'Sprechtempo'));
    case 'sprache.pause_s': return Math.round(zahl(wert, 0.5, 5, 'Sprechpause') * 10) / 10;
    case 'sprache.stimme':
    case 'hotkey.sprechen':
    case 'hotkey.chat':
    case 'modell':
      if (typeof wert !== 'string' || !wert.trim()) throw new Error(`${schluessel} darf nicht leer sein.`);
      return wert.trim();
    // Namen landen im System-Prompt: nur Buchstaben, Ziffern, Leerzeichen, Punkt,
    // Apostroph und Bindestrich – keine Zeilenumbrüche, Klammern oder Formatierung.
    case 'nutzer.name':
    case 'assistent.name': {
      const max = schluessel === 'assistent.name' ? 24 : 40;
      const s = String(wert ?? '').replace(/\s+/g, ' ').trim();
      if (!s) throw new Error('Der Name darf nicht leer sein.');
      if (s.length > max) throw new Error(`Der Name darf höchstens ${max} Zeichen haben.`);
      if (!/^[\p{L}\p{N}][\p{L}\p{N} .'’-]*$/u.test(s)) throw new Error('Im Namen sind nur Buchstaben, Ziffern, Leerzeichen, Punkt, Apostroph und Bindestrich erlaubt.');
      return s;
    }
    case 'minecraft.adresse': {
      const s = String(wert ?? '').trim();
      if (s.length > 253 || !/^[A-Za-z0-9.\-:[\]]*$/.test(s)) throw new Error('Das ist keine gültige Serveradresse.');
      return s;
    }
    case 'shell.timeout_s': return Math.round(zahl(wert, 5, 3600, 'Shell-Zeitlimit'));
    case 'shell.max_s': return Math.round(zahl(wert, 5, 3600, 'Shell-Maximum'));
    case 'minecraft.port': return Math.round(zahl(wert, 1, 65535, 'Port'));
    case 'minecraft.gruppe': return String(wert ?? '').replace(/[ -]/g, '').trim().slice(0, 64);
    case 'minecraft.token_limit': return Math.round(zahl(wert, 0, 10000000, 'Token-Limit')); // 0 = kein Limit
    case 'minecraft.ruhe_von':
    case 'minecraft.ruhe_bis': return Math.round(zahl(wert, -1, 23, 'Stunde')); // -1 = keine Ruhezeit
    case 'minecraft.erlaubte': {
      const roh = Array.isArray(wert) ? wert : String(wert ?? '').split(/[\n,;]/);
      const liste = [];
      for (const p of roh) {
        const s = String(p).trim();
        if (!s) continue;
        if (!/^[A-Za-z0-9_]{3,16}$/.test(s)) throw new Error(`„${s.slice(0, 16)}“ ist kein Minecraft-Name (3 bis 16 Zeichen: Buchstaben, Ziffern, Unterstrich).`);
        if (!liste.some((x) => x.toLowerCase() === s.toLowerCase())) liste.push(s);
      }
      if (liste.length > 20) throw new Error('Höchstens 20 erlaubte Spieler.');
      return liste;
    }
    case 'minecraft.spieler':
    case 'minecraft.botname':
    case 'minecraft.konto': {
      const s = String(wert ?? '').trim();
      if (s && !/^[A-Za-z0-9_]{3,16}$/.test(s)) throw new Error('Minecraft-Namen haben 3 bis 16 Zeichen: Buchstaben, Ziffern und Unterstrich.');
      return s;
    }
    case 'assistent.form':
      if (!['weiblich', 'maennlich', 'neutral'].includes(wert)) throw new Error('Form ist "weiblich", "maennlich" oder "neutral".');
      return wert;
    case 'nutzer.pronomen':
      if (!['er', 'sie', 'neutral', 'eigene'].includes(wert)) throw new Error('Pronomen sind "er", "sie", "neutral" oder "eigene".');
      return wert;
    case 'nutzer.pronomen_eigen': {
      const s = String(wert ?? '').replace(/\s+/g, ' ').trim();
      if (s.length > 30) throw new Error('Eigene Pronomen: höchstens 30 Zeichen.');
      if (s && !/^[\p{L} /'’-]+$/u.test(s)) throw new Error('Eigene Pronomen: nur Buchstaben, Schrägstrich, Leerzeichen, Apostroph und Bindestrich.');
      return s;
    }
    case 'aufwand':
      if (!['low', 'medium', 'high', 'xhigh', 'max'].includes(wert)) throw new Error('Aufwand ist low, medium, high, xhigh oder max.');
      return wert;
    case 'kanal':
      if (!['desktop', 'mobile', 'auto'].includes(wert)) throw new Error('Kanal ist desktop, mobile oder auto.');
      return wert;
    case 'sprachcode':
      if (!['de', 'en'].includes(wert)) throw new Error('Sprache ist "de" oder "en".');
      return wert;
    case 'design.modus':
      if (!['dunkel', 'hell', 'system'].includes(wert)) throw new Error('Modus ist "dunkel", "hell" oder "system".');
      return wert;
    case 'design.akzent':
      return farbe(wert);
    case 'hotkey.overlay':
    case 'hotkey.auswahl':
    case 'hotkey.clip':
      return String(wert ?? '').trim();
    case 'clip.methode':
      if (!['gamebar', 'nvidia', 'amd', 'eigen'].includes(wert)) throw new Error('Aufnahme über gamebar, nvidia, amd oder eigen.');
      return wert;
    case 'clip.taste': {
      const s = String(wert ?? '').trim();
      if (s.length > 40 || !/^[\w+ ]*$/.test(s)) throw new Error('Tastenkombination wie Alt+F10.');
      return s;
    }
    case 'clip.ordner': {
      const s = String(wert ?? '').trim();
      if (!s) return '';
      if (!path.isAbsolute(s)) throw new Error('Bitte einen vollständigen Ordnerpfad angeben (z. B. D:\\Clips).');
      return path.resolve(s);
    }
    // Eigene Aktivierungswörter: eins pro Zeile, höchstens acht. Sie gehen an
    // die Spracherkennung – deshalb nur Buchstaben, Ziffern und einfache Zeichen.
    case 'weckwort.phrasen': {
      const roh = Array.isArray(wert) ? wert : String(wert ?? '').split(/[\n;]/);
      const liste = [];
      for (const p of roh) {
        const s = String(p).replace(/\s+/g, ' ').trim();
        if (!s) continue;
        if (s.length < 2 || s.length > 40 || !/^[\p{L}\p{N}][\p{L}\p{N} .,'’-]*$/u.test(s)) {
          throw new Error(`„${s.slice(0, 40)}“ geht nicht als Aktivierungswort: 2 bis 40 Zeichen, nur Buchstaben, Ziffern, Leerzeichen, Punkt, Komma, Apostroph und Bindestrich.`);
        }
        if (!liste.some((x) => x.toLowerCase() === s.toLowerCase())) liste.push(s);
      }
      if (liste.length > 8) throw new Error('Höchstens acht Aktivierungswörter.');
      return liste;
    }
    case 'weckwort.schwelle':
      return Math.round(zahl(wert, 0.5, 0.95, 'Erkennungsschwelle') * 100) / 100;
    case 'kosten.tageslimit_usd':
      return Math.round(zahl(wert, 0, 1000, 'Tageslimit') * 100) / 100;
    case 'overlay.monitor': return Math.round(zahl(wert, 0, 8, 'Monitor'));
    case 'sync.port':
    case 'appserver.port': return Math.round(zahl(wert, 1024, 65535, 'Port'));
    case 'code.projekte': {
      if (!Array.isArray(wert)) throw new Error('Projekte sind eine Liste von Ordnern.');
      const liste = [...new Set(wert.map((p) => String(p || '').trim()).filter((p) => path.isAbsolute(p)).map((p) => path.resolve(p)))];
      if (liste.length > 30) throw new Error('Höchstens 30 Projekte.');
      return liste;
    }
    case 'sprache.mikrofon':
    case 'sprache.lautsprecher': {
      const s = String(wert ?? '').trim();
      if (s.length > 64) throw new Error('Gerätename zu lang.');
      return s;
    }
    case 'blase.position':
    case 'overlay.position':
      if (wert == null) return null;
      if (!istObjekt(wert)) throw new Error('Position ist { x, y } oder null.');
      return { x: Math.round(zahl(wert.x, -100000, 100000, 'x')), y: Math.round(zahl(wert.y, -100000, 100000, 'y')) };
    case 'overlay.deckkraft': return zahl(wert, 0.3, 1.0, 'Deckkraft');
    case 'overlay.hintergrund': return zahl(wert, 0, 1, 'Hintergrund');
    case 'overlay.breite': return Math.round(zahl(wert, 280, 720, 'Breite'));
    case 'overlay.hoehe': return Math.round(zahl(wert, 240, 1000, 'Höhe'));
    case 'overlay.schrift': return Math.round(zahl(wert, 11, 18, 'Schriftgröße'));
    case 'overlay.ausblenden': return Math.round(zahl(wert, 4, 60, 'Ausblenden'));
    case 'overlay.ecke':
      if (!ECKEN.includes(wert)) throw new Error(`Ecke muss eine von ${ECKEN.join(', ')} sein.`);
      return wert;
    case 'mcp.server': {
      if (!Array.isArray(wert)) throw new Error('MCP-Server sind eine Liste.');
      if (wert.length > 20) throw new Error('Höchstens 20 MCP-Server.');
      const { eintragPruefen } = require('./mcp'); // erst hier – kein Kreis beim Laden
      const liste = wert.map(eintragPruefen);
      if (new Set(liste.map((s) => s.id)).size !== liste.length) throw new Error('Doppelte MCP-Server.');
      return liste;
    }
    case 'rollen': {
      if (!Array.isArray(wert)) throw new Error('Rollen sind eine Liste.');
      if (wert.length > 12) throw new Error('Höchstens 12 Rollen.');
      const liste = wert.map((r) => {
        const name = String((r && r.name) || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 40);
        if (!name) throw new Error('Jede Rolle braucht einen Namen.');
        const anweisung = String((r && r.anweisung) || '').slice(0, 2000).trim();
        if (!anweisung) throw new Error(`Die Rolle „${name}“ braucht eine Anweisung.`);
        return { name, anweisung };
      });
      if (new Set(liste.map((r) => r.name.toLowerCase())).size !== liste.length) throw new Error('Rollennamen müssen eindeutig sein.');
      return liste;
    }
    case 'rolle_aktiv':
      return String(wert ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, 40);
    case 'overlay.spiele': {
      const roh = Array.isArray(wert) ? wert : String(wert ?? '').split(/[\n,;]/);
      const liste = [...new Set(roh.map((p) => String(p).trim().replace(/\.exe$/i, '')).filter(Boolean))];
      for (const p of liste) {
        if (p.length > 60 || !/^[\p{L}\p{N}][\p{L}\p{N} ._()-]*$/u.test(p)) throw new Error(`„${p.slice(0, 60)}“ ist kein Programmname (etwa valorant oder eldenring).`);
      }
      if (liste.length > 30) throw new Error('Höchstens 30 eigene Spiele.');
      return liste;
    }
    case 'overlay.bei_antwort':
      if (!['aus', 'passiv'].includes(wert)) throw new Error('Overlay bei Antworten: "aus" oder "passiv".');
      return wert;
    case 'arbeitsverzeichnisse':
      if (!Array.isArray(wert)) throw new Error('Arbeitsverzeichnisse sind eine Liste von Ordnern.');
      return wert.map((p) => path.resolve(String(p)));
    case 'sandbox.ordner':
      return wert ? path.resolve(String(wert)) : '';
    case 'content.modus':
      if (!['lokal', 'worker'].includes(wert)) throw new Error("content.modus ist 'lokal' oder 'worker'.");
      return wert;
    case 'content.tempo':
      if (!['sofort', 'normal', 'zeitlupe'].includes(wert)) throw new Error("content.tempo ist 'sofort', 'normal' oder 'zeitlupe'.");
      return wert;
    case 'content.bridge_port':
    case 'content.worker_port':
      return Math.round(zahl(wert, 1, 65535, 'Port'));
    case 'content.pfade.premiere':
    case 'content.pfade.aftereffects':
    case 'content.pfade.photoshop':
    case 'content.pfade.audition':
    case 'content.pfade.media_encoder':
    case 'content.pfade.whisper_modell':
    case 'content.pfade.netzwerkfreigabe':
      return wert ? String(wert).slice(0, 500) : '';
    case 'content.pfade':
      if (!istObjekt(wert)) throw new Error('content.pfade ist ein Objekt mit Programm-/Ordnerpfaden.');
      return Object.fromEntries(Object.keys(STANDARD.content.pfade).map((k) => [k, wert[k] ? String(wert[k]).slice(0, 500) : '']));
    case 'modelle_ohne_bild':
      if (!Array.isArray(wert)) throw new Error('modelle_ohne_bild ist eine Liste von Modellnamen.');
      return [...new Set(wert.map((m) => String(m).trim()).filter(Boolean))];
    case 'modelle_ohne_reasoning':
      if (!Array.isArray(wert)) throw new Error('modelle_ohne_reasoning ist eine Liste von Modellnamen.');
      return [...new Set(wert.map((m) => String(m).trim()).filter(Boolean))];
    case 'werkzeuge_aus':
      if (!Array.isArray(wert)) throw new Error('werkzeuge_aus ist eine Liste von Werkzeugnamen.');
      return [...new Set(wert.map((m) => String(m).trim()).filter(Boolean))];
    case 'kategorien_aus':
      if (!Array.isArray(wert)) throw new Error('kategorien_aus ist eine Liste von Kategorie-Namen.');
      return [...new Set(wert.map((m) => String(m).trim()).filter(Boolean))];
    case 'blase.farben':
      if (!istObjekt(wert)) throw new Error('blase.farben ist ein Objekt mit Farblisten je Zustand.');
      return Object.fromEntries(ZUSTAENDE.map((z) => [z, wert[z] ? pruefen(`blase.farben.${z}`, wert[z]) : STANDARD.blase.farben[z]]));
    case 'api.schluessel_verschluesselt':
      return String(wert);
    case 'api.je_anbieter': {
      const { IDS } = require('./anbieter/liste');
      if (!istObjekt(wert)) throw new Error('api.je_anbieter ist ein Objekt.');
      return Object.fromEntries(Object.entries(wert).filter(([id, s]) => IDS.includes(id) && typeof s === 'string' && s));
    }
    case 'anbieter': {
      const { IDS } = require('./anbieter/liste');
      if (!IDS.includes(wert)) throw new Error(`Unbekannter Anbieter, erlaubt: ${IDS.join(', ')}.`);
      return wert;
    }
    case 'anbieter_url':
      if (wert === '' || wert == null) return '';
      return require('./anbieter/liste').urlPruefen(wert);
    default:
      throw new Error(`Unbekannte Einstellung "${schluessel}".`);
  }
}

class Konfiguration extends EventEmitter {
  constructor(ordner) {
    super();
    this.ordner = ordner;
    this.datei = path.join(ordner, 'config.json');
    this.daten = klon(STANDARD);
  }

  laden() {
    fs.mkdirSync(this.ordner, { recursive: true });
    if (fs.existsSync(this.datei)) {
      try {
        // Notepad und PowerShell speichern gern mit BOM, daran scheitert JSON.parse.
        const text = fs.readFileSync(this.datei, 'utf8').replace(/^﻿/, '');
        this.daten = mischen(STANDARD, JSON.parse(text));
      } catch (e) {
        // Kaputte Datei nicht überschreiben, sondern daneben sichern.
        const kaputt = this.datei + '.kaputt-' + Date.now();
        fs.copyFileSync(this.datei, kaputt);
        this.daten = klon(STANDARD);
        this.emit('warnung', `config.json war nicht lesbar und wurde als ${path.basename(kaputt)} gesichert.`);
      }
    }
    return this.daten;
  }

  speichern() {
    fs.mkdirSync(this.ordner, { recursive: true });
    const tmp = this.datei + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.daten, null, 2), 'utf8');
    fs.renameSync(tmp, this.datei);
  }

  get(schluessel) {
    if (!schluessel) return this.daten;
    return schluessel.split('.').reduce((o, k) => (o == null ? undefined : o[k]), this.daten);
  }

  set(schluessel, wert) {
    const sauber = pruefen(schluessel, wert);
    const teile = schluessel.split('.');
    // Prototype-Pollution ausschließen: `pruefen` lässt ohnehin nur bekannte
    // Schlüssel durch, aber zur Sicherheit hier zusätzlich sperren.
    if (teile.some((k) => k === '__proto__' || k === 'constructor' || k === 'prototype')) {
      throw new Error('Unbekannte Einstellung.');
    }
    let o = this.daten;
    for (const k of teile.slice(0, -1)) {
      if (!istObjekt(o[k])) o[k] = {};
      o = o[k];
    }
    o[teile[teile.length - 1]] = sauber;
    this.speichern();
    this.emit('aenderung', schluessel, sauber);
    return sauber;
  }
}

module.exports = { Konfiguration, STANDARD, ZUSTAENDE, ECKEN, pruefen, mischen };
