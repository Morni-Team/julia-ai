'use strict';

const fs = require('fs');
const path = require('path');

// Soziales Gedächtnis & Persönlichkeit für Minecraft (Issue #94, BETA).
//
// Julia merkt sich pro Spieler, wie freundlich/gemein jemand war, wie viel
// Vertrauen sie hat, was ihr geschenkt bzw. abgeknöpft wurde und ob jemand
// nervt. Daraus ergibt sich eine HALTUNG (warm/neutral/kühl/ghosten), die ihre
// Antworten färbt – sie kann also auch mal „nein" sagen oder jemanden ghosten.
// Dazu eine Skepsis-Prüfung: unglaubwürdige Prahlerei („ich hab 1000 Diamanten",
// „bin Admin", „creative") und verdächtige, unmögliche Item-Zuwächse (Cheats)
// erkennt sie und glaubt nicht blind. Alles rein lokal als JSON, nie PC-Zugriff.
//
// Der Datei-Teil (Persistenz) und die Entscheidungen sind getrennt: die reinen
// Funktionen unten sind ohne Spielstand testbar (test/minecraft-sozial.test.js).

// --- Reine Bewertung einer Chat-Nachricht ---------------------------------

const GEMEIN = /\b(idiot|idioten|noob|n00b|loser|versager|dumm|dummkopf|blöd|bloed|hurensohn|hs|wichser|arschloch|arsch|fuck|fick dich|fuck you|stfu|halt die fresse|halt dein maul|kill dich|kys|trottel|spast|behindert|nervst|verpiss dich|hässlich|haesslich|müll|muell|trash|kys|noob)\b/i;
const FREUNDLICH = /\b(danke|dank(e|schön)?|thanks|thx|ty|bitte|please|cool|nett|lieb|super|toll|gut gemacht|gj|gg|wp|<3|:\)|:d|freund|hilfst|hilfe|helfen|magst|mag dich|sorry|entschuldigung|entschuldige|willkommen|welcome)\b/i;
const BETTELT = /\b(gib mir|gibst du|gib doch|gimme|give me|give|kann ich .*(haben|kriegen|bekommen)|hast du .*(für mich|über)|brauche|ich brauch|leih|leihst|schenk|schenkst|hast du mal)\b/i;

// Unglaubwürdige Prahlerei / Machtansprüche (Skepsis, Issue #94):
const PRAHLEREI = /(\d{3,}\s*(diamant|diamond|dia|netherite|emerald|smaragd)|doppelkiste|double chest|(stack|stapel)\s*\w*\s*(netherite|diamant|diamond)|hab(e)? alles|alles was es gibt|unendlich|infinite|spawner|beacon|elytra für dich|ganze(n)? (kiste|truhe)\s*\w*\s*(dia|diamant|netherite))/i;
const ADMIN_ANSPRUCH = /\b(ich bin (admin|op|owner|mod|besitzer|gott|god)|bin op|\/op|creative|kreativ|gamemode|\/gamemode|gib dir op|mach dich op|ich bin der (besitzer|chef))\b/i;

// Kam die Nachricht als private Flüster-/Direktnachricht? (Chat-Präfixe.)
const PRIVAT = /^(\/(msg|tell|w|whisper|pm|dm|r)\b|\[.*→.*\]|whispers|flüstert|fluestert)/i;

function bewerten(text = '') {
  const s = String(text).toLowerCase();
  return {
    gemein: GEMEIN.test(s),
    freundlich: FREUNDLICH.test(s) && !GEMEIN.test(s),
    bettelt: BETTELT.test(s),
    frage: /\?/.test(s),
    prahlerei: PRAHLEREI.test(s),
    adminAnspruch: ADMIN_ANSPRUCH.test(s),
    privat: PRIVAT.test(String(text)),
  };
}

// Neue Werte nach einer Interaktion (rein). record-Felder werden geklammert 0..100.
// geschenkWert > 0 = jemand hat Julia etwas gegeben (baut Vertrauen auf).
// wiederholt = dieselbe Nachricht wie zuletzt (nervt).
function vertrauenNeu(record, bewertung, { geschenkWert = 0, wiederholt = false } = {}) {
  const klemm = (n) => Math.max(0, Math.min(100, Math.round(n)));
  let { freundlichkeit = 50, vertrauen = 20, genervt = 0 } = record || {};
  if (bewertung.freundlich) { freundlichkeit += 4; vertrauen += 2; genervt -= 5; }
  if (bewertung.gemein) { freundlichkeit -= 12; vertrauen -= 6; genervt += 18; }
  if (geschenkWert > 0) { vertrauen += Math.min(15, 3 + geschenkWert); freundlichkeit += 3; genervt -= 4; }
  if (bewertung.bettelt && geschenkWert <= 0) genervt += 6;
  if (wiederholt) genervt += 10;
  if (bewertung.prahlerei || bewertung.adminAnspruch) vertrauen -= 3;
  // Genervtheit klingt mit der Zeit von selbst wieder ab (hier: leichte Erholung).
  genervt -= 1;
  return { freundlichkeit: klemm(freundlichkeit), vertrauen: klemm(vertrauen), genervt: klemm(genervt) };
}

// Haltung aus den Werten (rein): warm | neutral | kuehl | ghost.
function haltungVon(record = {}) {
  const { freundlichkeit = 50, vertrauen = 20, genervt = 0 } = record;
  if (genervt >= 80 || freundlichkeit <= 12) return 'ghost';
  if (freundlichkeit < 35 || genervt >= 50) return 'kuehl';
  if (vertrauen >= 60 && freundlichkeit >= 60) return 'warm';
  return 'neutral';
}

// Skepsis: ist eine Behauptung unglaubwürdig / ein Machtanspruch? (rein)
function unglaubwuerdig(text = '') {
  const b = bewerten(text);
  if (b.adminAnspruch) return { verdacht: true, grund: 'Behauptet Admin-/Creative-Rechte – das prüfe ich lieber, statt es zu glauben.' };
  if (b.prahlerei) return { verdacht: true, grund: 'Prahlt mit unrealistisch vielen/seltenen Sachen – klingt nicht legit.' };
  return { verdacht: false, grund: '' };
}

// Cheat-Verdacht bei unmöglichem Zuwachs seltener Items (rein). Beispiel des
// Nutzers: in 5 Minuten Doppeltruhen voller Diamanten/Spawner = nicht legit.
const SELTEN = /(diamond|diamant|netherite|ancient_debris|spawner|elytra|beacon|nether_star|totem)/i;
function cheatVerdacht({ item = '', zuwachs = 0, sekunden = 1 } = {}) {
  if (!SELTEN.test(item)) return false;
  const proMin = zuwachs / Math.max(1, sekunden / 60);
  // Mehr als ~64 seltene Items pro Minute ist per Hand praktisch unmöglich.
  return proMin > 64 || (/(spawner|beacon|elytra|nether_star)/i.test(item) && zuwachs >= 2 && sekunden < 300);
}

// Anti-Ausnutzung (rein): nimmt jemand deutlich mehr als er gibt?
function ausnutzung(record = {}) {
  const { gegeben = 0, genommen = 0 } = record;
  return genommen >= 12 && genommen > gegeben * 3 + 6;
}

// Beim Schreiben Zeit lassen (rein): Antwortdauer grob wie ein Mensch, der tippt.
function antwortVerzoegerung(text = '', { grund = 600, proZeichen = 35, max = 4000 } = {}) {
  return Math.min(max, Math.round(grund + String(text).length * proZeichen));
}

// --- Grenzen, Budget, Ruhezeiten, Base (Issue #98) --------------------------

// Token-Budget fürs Minecraft-Plaudern (rein): limit<=0 heißt „kein Limit".
// Sonst 'ok' → 'warnung' (ab warnAb) → 'stopp' (Limit erreicht). Bei 'stopp'
// verabschiedet sich Julia und hört im Spiel auf zu schreiben.
function budgetStatus(verbraucht = 0, limit = 0, { warnAb = 0.85 } = {}) {
  if (!limit || limit <= 0) return 'ok';
  if (verbraucht >= limit) return 'stopp';
  if (verbraucht >= limit * warnAb) return 'warnung';
  return 'ok';
}

// Grobe Token-Schätzung eines Textes (rein): ~4 Zeichen je Token.
function tokenSchaetzen(text = '') {
  return Math.ceil(String(text).length / 4);
}

// Persönliche Grenze (rein): Ab welcher Genervtheit blockt Julia jemanden, und
// wie lange (Minuten)? Unter 70 gar nicht; darüber 10..60 min, je genervter länger.
function ignorierDauerMin(genervt = 0) {
  if (genervt < 70) return 0;
  return Math.min(60, 10 + (genervt - 70));
}

// Selbstgesetzte Ruhezeit (rein): liegt die aktuelle Stunde im Fenster von..bis?
// von/bis 0..23; -1 = aus. Über Mitternacht (z. B. 22..7) wird korrekt behandelt.
function istRuhezeit(stunde, von = -1, bis = -1) {
  if (von < 0 || bis < 0) return false;
  const h = ((Math.floor(stunde) % 24) + 24) % 24;
  return von <= bis ? (h >= von && h < bis) : (h >= von || h < bis);
}

// Ist eine gemerkte Base in der Nähe? (rein, in Chunk-Radius) – für „ich seh dich
// hier oft / deine Base ist gleich nebenan", aber nur wenn es wirklich stimmt.
function naheBase(pos, base, radiusChunks = 2) {
  if (!pos || !base || typeof base.cx !== 'number') return false;
  const cx = Math.floor(pos.x / 16);
  const cz = Math.floor(pos.z / 16);
  return Math.abs(cx - base.cx) <= radiusChunks && Math.abs(cz - base.cz) <= radiusChunks;
}

// --- Persistenz + Zusammenspiel -------------------------------------------

const START = { freundlichkeit: 50, vertrauen: 20, genervt: 0, gegeben: 0, genommen: 0, begegnungen: 0, notizen: [], letzterText: '', letzter: 0 };

class Sozial {
  constructor(ordner) {
    this.datei = path.join(ordner, 'sozial.json');
  }

  _laden() {
    let text;
    try {
      text = fs.readFileSync(this.datei, 'utf8').replace(/^﻿/, '');
    } catch {
      return { spieler: {} };
    }
    const d = JSON.parse(text);
    if (!d || typeof d.spieler !== 'object') throw new Error('sozial.json hat ein unerwartetes Format.');
    return d;
  }

  _speichern(daten) {
    fs.mkdirSync(path.dirname(this.datei), { recursive: true });
    const tmp = this.datei + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(daten, null, 2), 'utf8');
    fs.renameSync(tmp, this.datei);
  }

  _rec(daten, name) {
    const k = String(name || '').trim();
    if (!daten.spieler[k]) daten.spieler[k] = { name: k, ...START, notizen: [] };
    return daten.spieler[k];
  }

  // Eine Chat-Nachricht eines Spielers verarbeiten: Werte fortschreiben und die
  // aktuelle Haltung + Hinweise zurückgeben (für die Antwort-Färbung).
  verarbeiten(name, text, { geschenkWert = 0 } = {}) {
    const daten = this._laden();
    const rec = this._rec(daten, name);
    const bew = bewerten(text);
    const wiederholt = !!rec.letzterText && rec.letzterText === String(text).toLowerCase();
    const neu = vertrauenNeu(rec, bew, { geschenkWert, wiederholt });
    Object.assign(rec, neu);
    rec.begegnungen = (rec.begegnungen || 0) + 1;
    if (geschenkWert > 0) rec.gegeben = (rec.gegeben || 0) + geschenkWert;
    rec.letzterText = String(text).toLowerCase().slice(0, 200);
    rec.letzter = Date.now();
    const skepsis = unglaubwuerdig(text);
    if (skepsis.verdacht) this._notizAn(rec, skepsis.grund);
    this._speichern(daten);
    return {
      haltung: haltungVon(rec),
      bewertung: bew,
      skepsis,
      ausnutzung: ausnutzung(rec),
      werte: { freundlichkeit: rec.freundlichkeit, vertrauen: rec.vertrauen, genervt: rec.genervt },
    };
  }

  // Julia hat jemandem etwas gegeben (senkt Ausnutzungs-Verdacht ausgewogen).
  gegeben(name, wert = 1) {
    const daten = this._laden();
    const rec = this._rec(daten, name);
    rec.genommen = (rec.genommen || 0) + Math.max(0, wert);
    this._speichern(daten);
    return ausnutzung(rec);
  }

  _notizAn(rec, text) {
    const t = String(text || '').trim();
    if (!t) return;
    rec.notizen = (rec.notizen || []).filter((n) => n.text !== t);
    rec.notizen.push({ text: t, zeit: Date.now() });
    if (rec.notizen.length > 8) rec.notizen = rec.notizen.slice(-8); // „nicht zu viel"
  }

  // Eine bewusste Hintergedanken-Notiz zu einem Spieler festhalten.
  notiz(name, text) {
    const daten = this._laden();
    this._notizAn(this._rec(daten, name), text);
    this._speichern(daten);
  }

  haltung(name) {
    try { return haltungVon(this._laden().spieler[String(name || '').trim()] || {}); } catch { return 'neutral'; }
  }

  // Grenze setzen (Issue #98): jemanden für ein paar Minuten ignorieren. Gibt die
  // Dauer in Minuten zurück (0 = nicht ignoriert).
  ignorieren(name, minuten) {
    const daten = this._laden();
    const rec = this._rec(daten, name);
    rec.ignoriertBis = Date.now() + Math.max(0, minuten) * 60000;
    this._speichern(daten);
    return minuten;
  }

  // Wird dieser Spieler gerade (noch) ignoriert?
  wirdIgnoriert(name) {
    try {
      const rec = this._laden().spieler[String(name || '').trim()];
      return !!(rec && rec.ignoriertBis && Date.now() < rec.ignoriertBis);
    } catch { return false; }
  }

  // Automatische Grenze: ist jemand zu nervig geworden, ignoriert Julia ihn eine
  // Weile von selbst. Gibt die gesetzte Dauer (min) zurück oder 0.
  grenzePruefen(name) {
    const daten = this._laden();
    const rec = this._rec(daten, name);
    const min = ignorierDauerMin(rec.genervt || 0);
    if (min > 0 && !(rec.ignoriertBis && Date.now() < rec.ignoriertBis)) {
      rec.ignoriertBis = Date.now() + min * 60000;
      this._speichern(daten);
      return min;
    }
    return 0;
  }

  // Die Base eines Spielers merken (Chunk-Koordinaten – winzig, kostet keine Tokens).
  baseMerken(name, x, z) {
    const daten = this._laden();
    const rec = this._rec(daten, name);
    rec.base = { cx: Math.floor(x / 16), cz: Math.floor(z / 16) };
    this._speichern(daten);
    return rec.base;
  }

  base(name) {
    try { return (this._laden().spieler[String(name || '').trim()] || {}).base || null; } catch { return null; }
  }

  // Kompakter Beziehungs-Kontext für den Antwort-Prompt (oder null).
  alsText(name) {
    let daten;
    try { daten = this._laden(); } catch { return null; }
    const rec = daten.spieler[String(name || '').trim()];
    if (!rec) return null;
    const hal = { warm: 'du magst diesen Spieler und vertraust ihm', neutral: 'neutral', kuehl: 'du bist reserviert/kühl zu ihm', ghost: 'er nervt dich – kurz angebunden oder ignorieren' }[haltungVon(rec)];
    const teile = [`Haltung: ${hal}`, `Vertrauen ${rec.vertrauen}/100`, `Begegnungen ${rec.begegnungen}`];
    if (ausnutzung(rec)) teile.push('nimmt viel mehr als er gibt – lass dich nicht ausnutzen');
    const letzteNotiz = (rec.notizen || []).slice(-1)[0];
    if (letzteNotiz) teile.push(`Merke: ${letzteNotiz.text}`);
    return teile.join('; ');
  }
}

module.exports = {
  Sozial, bewerten, vertrauenNeu, haltungVon, unglaubwuerdig, cheatVerdacht, ausnutzung, antwortVerzoegerung,
  budgetStatus, tokenSchaetzen, ignorierDauerMin, istRuhezeit, naheBase,
};
