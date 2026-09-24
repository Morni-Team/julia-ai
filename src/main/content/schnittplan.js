'use strict';

// Content-Creation-Modul – der SCHNITTPLAN ist die einzige Wahrheit: Claude gibt
// ihn als JSON aus, das UI zeigt ihn lesbar, die Adapter (Premiere/AE/Photoshop)
// bzw. der FFmpeg-Fallback setzen ihn um, Feedback erzeugt eine neue Version.
// Diese Datei ist REINE Logik: Validieren/Normalisieren eines (evtl. vom Modell
// kommenden) Plans auf ein festes, sicheres Format, plus eine lesbare
// Entscheidungs-Zusammenfassung. So bleibt der Rest testbar und robust gegen
// unerwartete Modell-Ausgaben.

const num = (v, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
const sek = (v) => Math.max(0, num(v, 0));
const text = (v, max = 300) => String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max);
const liste = (v) => (Array.isArray(v) ? v : []);

const UEBERGAENGE = ['hart', 'blende', 'wisch', 'zoom'];
const uebergang = (v) => (UEBERGAENGE.includes(String(v)) ? String(v) : 'hart');

function untertitelBereinigen(roh) {
  return liste(roh).map((u) => ({
    t: text(u && u.t, 120),
    von_s: sek(u && u.von_s),
    bis_s: sek(u && u.bis_s),
  })).filter((u) => u.t && u.bis_s > u.von_s).slice(0, 200);
}

function clipBereinigen(roh, i) {
  const inS = sek(roh.in_s);
  const outS = sek(roh.out_s);
  const c = {
    id: text(roh.id, 40) || `c${i + 1}`,
    quelle: text(roh.quelle, 200),
    in_s: inS,
    out_s: outS,
    spur: text(roh.spur, 8) || 'V1',
    uebergang: uebergang(roh.uebergang),
    untertitel: untertitelBereinigen(roh.untertitel),
    begruendung: text(roh.begruendung, 300),
  };
  if (roh.zoom && (Number.isFinite(Number(roh.zoom.start)) || Number.isFinite(Number(roh.zoom.ende)))) {
    c.zoom = { start: num(roh.zoom.start, 1), ende: num(roh.zoom.ende, 1) };
  }
  return c;
}

// Ein Clip ist gültig, wenn er eine Quelle hat und out>in (sonst leere Dauer).
function clipGueltig(c) {
  return !!c.quelle && c.out_s > c.in_s;
}

function schnittplanBereinigen(roh = {}) {
  const clips = liste(roh.clips).map(clipBereinigen).filter(clipGueltig);
  const plan = {
    version: Math.max(1, Math.round(num(roh.version, 1))),
    projekt: text(roh.projekt, 120),
    ziellaenge_s: sek(roh.ziellaenge_s),
    stilprofil: text(roh.stilprofil, 60),
    titelvorschlaege: liste(roh.titelvorschlaege).map((t) => text(t, 120)).filter(Boolean).slice(0, 10),
    hook: null,
    kapitel: liste(roh.kapitel).map((k) => ({ titel: text(k.titel, 120), von_s: sek(k.von_s), bis_s: sek(k.bis_s) })).filter((k) => k.titel).slice(0, 50),
    clips,
    musik: liste(roh.musik).map((m) => ({ datei: text(m.datei, 400), von_s: sek(m.von_s), bis_s: sek(m.bis_s), ducking: m.ducking !== false })).filter((m) => m.datei).slice(0, 50),
    sfx: liste(roh.sfx).map((s) => ({ datei: text(s.datei, 400), bei_s: sek(s.bei_s) })).filter((s) => s.datei).slice(0, 200),
    animationen: liste(roh.animationen).map((a) => ({
      vorlage: text(a.vorlage, 200),
      platzhalter: (a.platzhalter && typeof a.platzhalter === 'object' && !Array.isArray(a.platzhalter))
        ? Object.fromEntries(Object.entries(a.platzhalter).slice(0, 30).map(([k, v]) => [text(k, 40), text(v, 200)])) : {},
      von_s: sek(a.von_s), bis_s: sek(a.bis_s),
    })).filter((a) => a.vorlage).slice(0, 100),
    broll: liste(roh.broll).map((b) => ({ quelle: text(b.quelle, 200), von_s: sek(b.von_s), bis_s: sek(b.bis_s) })).filter((b) => b.quelle).slice(0, 200),
  };
  if (roh.hook && roh.hook.quelle_clip !== undefined) {
    plan.hook = {
      von_s: sek(roh.hook.von_s), bis_s: sek(roh.hook.bis_s),
      quelle_clip: text(roh.hook.quelle_clip, 40),
      quelle_von_s: sek(roh.hook.quelle_von_s),
      begruendung: text(roh.hook.begruendung, 300),
    };
  }
  return plan;
}

// Gesamtdauer der zusammengeschnittenen Clips (für „Material reicht für X min").
function gesamtdauerS(plan) {
  return (plan.clips || []).reduce((s, c) => s + Math.max(0, c.out_s - c.in_s), 0);
}

// Lesbare Liste aller Schnittentscheidungen (für die UI-Übersicht mit Begründung).
function entscheidungen(plan) {
  const zeilen = [];
  if (plan.hook) zeilen.push(`Hook 0–${Math.round(plan.hook.bis_s)}s: ${plan.hook.begruendung || 'stärkster Moment'}`);
  let t = 0;
  for (const c of plan.clips || []) {
    const d = Math.max(0, c.out_s - c.in_s);
    zeilen.push(`${mmss(t)} · ${c.quelle} (${mmss(c.in_s)}–${mmss(c.out_s)})${c.begruendung ? ` – ${c.begruendung}` : ''}`);
    t += d;
  }
  return zeilen;
}

function mmss(s) {
  const g = Math.max(0, Math.round(num(s, 0)));
  return `${String(Math.floor(g / 60)).padStart(2, '0')}:${String(g % 60).padStart(2, '0')}`;
}

module.exports = { schnittplanBereinigen, clipGueltig, gesamtdauerS, entscheidungen, mmss, UEBERGAENGE };
