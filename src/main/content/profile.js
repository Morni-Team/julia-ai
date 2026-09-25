'use strict';

const fs = require('fs');
const path = require('path');

// Content-Creation-Modul – Creator-Profile (Auftrag „Content Creation").
// Ein Creator-Profil hält die DAUERHAFTEN Daten eines Kanals (Marke, Musik-/SFX-
// Ordner, Regeln, Stilprofile), die bei JEDEM Projekt automatisch gelten. Rein
// lokal als eine JSON-Datei, robustes Laden, tmp+rename beim Speichern – gleiches
// Muster wie der Wissensgraph. Keine Cloud, keine fremden Abhängigkeiten.
//
// Diese Datei ist bewusst REINE Logik (Bereinigen/Validieren/Speichern), damit sie
// per `node --test` ohne Adobe/FFmpeg abgesichert werden kann.

const clampNum = (v, min, max, fallback) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};
const text = (v, max = 200) => String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max);
const liste = (v, maxEintraege, maxLen) => (Array.isArray(v) ? v : []).map((x) => text(x, maxLen)).filter(Boolean).slice(0, maxEintraege);
const kebab = (s) => text(s, 60).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'profil';

// Erlaubte Werte für die Stil-Parameter (freie Eingaben werden darauf abgebildet).
const HAEUFIGKEIT = ['aus', 'niedrig', 'mittel', 'hoch'];
const einHaeufig = (v, fallback = 'mittel') => (HAEUFIGKEIT.includes(String(v)) ? String(v) : fallback);

// Ein Stilprofil: die messbaren Stell­schrauben, mit denen ein Creator-Stil
// ABSTRAKT nachgebildet wird (nie fremde Assets/Namen/Logos – nur Parameter).
function standardStil(name = 'Standard') {
  return {
    name: text(name, 60) || 'Standard',
    schnitte_pro_min: 14,
    hook_sekunden: 8,
    jumpcut_haeufigkeit: 'mittel',
    zoom_haeufigkeit: 'mittel',
    untertitel_stil: 'wort-fuer-wort',
    broll_anteil: 0.3,
    musikdynamik: 'mittel',
    animationsdichte: 'mittel',
  };
}

function stilBereinigen(roh = {}) {
  return {
    name: text(roh.name, 60) || 'Stil',
    schnitte_pro_min: clampNum(roh.schnitte_pro_min, 1, 60, 14),
    hook_sekunden: clampNum(roh.hook_sekunden, 0, 30, 8),
    jumpcut_haeufigkeit: einHaeufig(roh.jumpcut_haeufigkeit),
    zoom_haeufigkeit: einHaeufig(roh.zoom_haeufigkeit),
    untertitel_stil: text(roh.untertitel_stil, 40) || 'wort-fuer-wort',
    broll_anteil: clampNum(roh.broll_anteil, 0, 1, 0.3),
    musikdynamik: einHaeufig(roh.musikdynamik),
    animationsdichte: einHaeufig(roh.animationsdichte),
  };
}

// Ein vollständiges Creator-Profil mit sinnvollen Vorgaben.
function standardProfil(name = 'Mein Kanal') {
  return {
    id: kebab(name),
    kanalname: text(name, 80) || 'Mein Kanal',
    kanal_link: '', // YouTube-Kanal-Link (das Erste, was der Nutzer einträgt)
    ordner: '', // EIN Arbeits-/Speicherordner (per Auswahl-Dialog) – hier legt die KI alles ab
    zielgruppe: '',
    tonalitaet: '',
    sprache: 'de',
    // Marke/Assets macht die KI selbst und legt sie im Ordner ab; hier nur intern gehalten.
    marke: { logo: '', farben: [], schriften: [], intro: '', outro: '', sfx_ordner: '', musik_ordner: '' },
    regeln: [],
    stilprofile: [standardStil('Standard')],
  };
}

// Erlaubt nur echte YouTube-Kanal-/Video-Links (sonst leer). Kein Netzzugriff.
function linkBereinigen(v) {
  const s = text(v, 300);
  return /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(s) ? s : '';
}

// Bereinigt/validiert ein (evtl. importiertes) Profil auf ein sicheres, festes
// Format. Unbekannte Schlüssel fliegen raus; Zahlen werden geklemmt.
function profilBereinigen(roh = {}) {
  const m = roh.marke || {};
  const stile = (Array.isArray(roh.stilprofile) ? roh.stilprofile : []).map(stilBereinigen);
  return {
    id: kebab(roh.id || roh.kanalname || 'profil'),
    kanalname: text(roh.kanalname, 80) || 'Mein Kanal',
    kanal_link: linkBereinigen(roh.kanal_link),
    ordner: text(roh.ordner, 500),
    zielgruppe: text(roh.zielgruppe, 200),
    tonalitaet: text(roh.tonalitaet, 200),
    sprache: /^(de|en)$/.test(String(roh.sprache)) ? String(roh.sprache) : 'de',
    marke: {
      logo: text(m.logo, 400),
      farben: liste(m.farben, 12, 24),
      schriften: liste(m.schriften, 12, 60),
      intro: text(m.intro, 400),
      outro: text(m.outro, 400),
      sfx_ordner: text(m.sfx_ordner, 400),
      musik_ordner: text(m.musik_ordner, 400),
    },
    regeln: liste(roh.regeln, 50, 200),
    stilprofile: stile.length ? stile : [standardStil('Standard')],
  };
}

// Speichert mehrere Profile lokal in einer JSON-Datei plus die aktive Id.
class ProfilSpeicher {
  constructor(ordner) {
    this.datei = path.join(ordner, 'content', 'profile.json');
  }

  _leer() {
    return { profile: {}, aktivId: null };
  }

  _laden() {
    let roh;
    try {
      roh = fs.readFileSync(this.datei, 'utf8').replace(/^﻿/, '');
    } catch {
      return this._leer();
    }
    let d;
    try { d = JSON.parse(roh); } catch { return this._leer(); }
    if (!d || typeof d.profile !== 'object' || Array.isArray(d.profile)) return this._leer();
    const profile = {};
    for (const p of Object.values(d.profile)) {
      const rein = profilBereinigen(p);
      profile[rein.id] = rein;
    }
    const aktivId = profile[d.aktivId] ? d.aktivId : (Object.keys(profile)[0] || null);
    return { profile, aktivId };
  }

  _speichern(daten) {
    fs.mkdirSync(path.dirname(this.datei), { recursive: true });
    const tmp = `${this.datei}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(daten, null, 2), 'utf8');
    fs.renameSync(tmp, this.datei);
  }

  alle() {
    return Object.values(this._laden().profile);
  }

  holen(id) {
    return this._laden().profile[id] || null;
  }

  // Das bei jedem Projekt automatisch geltende Profil (die aktive Auswahl).
  aktiv() {
    const d = this._laden();
    return d.aktivId ? d.profile[d.aktivId] || null : null;
  }

  // Anlegen oder Ändern. Erste Speicherung wird automatisch aktiv.
  setzen(profil) {
    const d = this._laden();
    const rein = profilBereinigen(profil);
    d.profile[rein.id] = rein;
    if (!d.aktivId) d.aktivId = rein.id;
    this._speichern(d);
    return rein;
  }

  aktivSetzen(id) {
    const d = this._laden();
    if (!d.profile[id]) return false;
    d.aktivId = id;
    this._speichern(d);
    return true;
  }

  loeschen(id) {
    const d = this._laden();
    if (!d.profile[id]) return false;
    delete d.profile[id];
    if (d.aktivId === id) d.aktivId = Object.keys(d.profile)[0] || null;
    this._speichern(d);
    return true;
  }

  // Import aus einem JSON-Text (ein Profil oder eine Liste). Gibt die Anzahl der
  // importierten Profile zurück; bereinigt jedes Profil vorher.
  importieren(jsonText) {
    let roh;
    try { roh = JSON.parse(String(jsonText || '')); } catch { throw new Error('Das ist kein gültiges JSON.'); }
    const eintraege = Array.isArray(roh) ? roh : (roh && roh.profile ? Object.values(roh.profile) : [roh]);
    let n = 0;
    for (const e of eintraege) {
      if (e && typeof e === 'object') { this.setzen(e); n += 1; }
    }
    return n;
  }

  exportieren(id) {
    const p = this.holen(id);
    return p ? JSON.stringify(p, null, 2) : null;
  }
}

module.exports = { standardStil, stilBereinigen, standardProfil, profilBereinigen, linkBereinigen, ProfilSpeicher, HAEUFIGKEIT };
