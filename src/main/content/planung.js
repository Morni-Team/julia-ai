'use strict';

const fs = require('fs');
const path = require('path');

// Content-Modul – Reiter 2: PLANUNG (Nutzerwunsch).
// Ein einfacher Redaktionsplan: was mache ich wann für ein Video, wie, plus Platz
// für ein kleines Skript/eine Idee. Rein lokal als JSON. REINE Logik + Speicher.

const text = (v, max = 400) => String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max);
// Skript darf Zeilenumbrüche behalten (Steuerzeichen sonst raus).
const mehrzeilig = (v, max = 8000) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, max);
const STATUS = ['idee', 'geplant', 'in_arbeit', 'fertig', 'veroeffentlicht'];

function neueId() {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

// Datum als YYYY-MM-DD (leer, wenn ungültig) – so lässt sich sauber sortieren.
function datumRein(v) {
  const s = text(v, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

function planBereinigen(roh = {}) {
  return {
    id: text(roh.id, 40) || neueId(),
    datum: datumRein(roh.datum),
    kanalId: text(roh.kanalId, 60),
    titel: text(roh.titel, 160) || 'Neues Video',
    idee: text(roh.idee, 2000),
    skript: mehrzeilig(roh.skript, 8000),
    status: STATUS.includes(String(roh.status)) ? String(roh.status) : 'idee',
    erstellt: Number(roh.erstellt) || Date.now(),
  };
}

class PlanSpeicher {
  constructor(ordner) {
    this.datei = path.join(ordner, 'content', 'planung.json');
  }

  _laden() {
    let roh;
    try { roh = fs.readFileSync(this.datei, 'utf8').replace(/^﻿/, ''); } catch { return []; }
    let d;
    try { d = JSON.parse(roh); } catch { return []; }
    const liste = Array.isArray(d) ? d : (d && Array.isArray(d.plan) ? d.plan : []);
    return liste.map(planBereinigen);
  }

  _speichern(liste) {
    fs.mkdirSync(path.dirname(this.datei), { recursive: true });
    const tmp = `${this.datei}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ plan: liste }, null, 2), 'utf8');
    fs.renameSync(tmp, this.datei);
  }

  // Nach Datum aufsteigend; Einträge ohne Datum („nur Idee") ans Ende.
  alle() {
    return this._laden().sort((a, b) => {
      if (a.datum && b.datum) return a.datum < b.datum ? -1 : (a.datum > b.datum ? 1 : a.erstellt - b.erstellt);
      if (a.datum) return -1;
      if (b.datum) return 1;
      return a.erstellt - b.erstellt;
    });
  }

  hinzufuegen(roh) {
    const liste = this._laden();
    const eintrag = planBereinigen({ ...roh, id: neueId(), erstellt: Date.now() });
    liste.push(eintrag);
    this._speichern(liste);
    return eintrag;
  }

  aktualisieren(id, felder) {
    const liste = this._laden();
    const i = liste.findIndex((x) => x.id === id);
    if (i < 0) return null;
    liste[i] = planBereinigen({ ...liste[i], ...felder, id });
    this._speichern(liste);
    return liste[i];
  }

  entfernen(id) {
    const liste = this._laden();
    const rest = liste.filter((x) => x.id !== id);
    if (rest.length === liste.length) return false;
    this._speichern(rest);
    return true;
  }
}

module.exports = { PlanSpeicher, planBereinigen, datumRein, STATUS };
