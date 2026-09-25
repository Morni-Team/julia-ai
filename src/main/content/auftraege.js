'use strict';

const fs = require('fs');
const path = require('path');

// Content-Modul – Reiter 1: SCHNITTAUFTRÄGE (Nutzerwunsch).
// Eine geordnete Warteschlange: Der Nutzer lädt einen Rohcut hoch und sagt, wann/
// wie geschnitten werden soll; Julia arbeitet die Aufträge der Reihe nach ab. Rein
// lokal als JSON (tmp+rename, robustes Laden) – dieselbe Bauweise wie die Profile.
// Diese Datei ist REINE Logik + Speicher, damit sie per `node --test` abgesichert ist.

const text = (v, max = 400) => String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max);
const STATUS = ['offen', 'laeuft', 'fertig', 'fehler'];

function neueId() {
  return `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

// Bereinigt einen (evtl. importierten/alten) Auftrag auf ein festes, sicheres Format.
function auftragBereinigen(roh = {}) {
  const status = STATUS.includes(String(roh.status)) ? String(roh.status) : 'offen';
  return {
    id: text(roh.id, 40) || neueId(),
    titel: text(roh.titel, 120) || 'Schnittauftrag',
    videoPfad: text(roh.videoPfad, 600),
    anweisung: text(roh.anweisung, 4000), // „wann/wie schneiden": frei formuliert
    kanalId: text(roh.kanalId, 60),
    status,
    notiz: text(roh.notiz, 2000), // Julias Rückmeldung/Ergebnis
    erstellt: Number(roh.erstellt) || Date.now(),
  };
}

class AuftragSpeicher {
  constructor(ordner) {
    this.datei = path.join(ordner, 'content', 'auftraege.json');
  }

  _laden() {
    let roh;
    try { roh = fs.readFileSync(this.datei, 'utf8').replace(/^﻿/, ''); } catch { return []; }
    let d;
    try { d = JSON.parse(roh); } catch { return []; }
    const liste = Array.isArray(d) ? d : (d && Array.isArray(d.auftraege) ? d.auftraege : []);
    return liste.map(auftragBereinigen);
  }

  _speichern(liste) {
    fs.mkdirSync(path.dirname(this.datei), { recursive: true });
    const tmp = `${this.datei}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ auftraege: liste }, null, 2), 'utf8');
    fs.renameSync(tmp, this.datei);
  }

  // Neueste zuerst – so steht der frischeste Auftrag oben in der Liste.
  alle() {
    return this._laden().sort((a, b) => b.erstellt - a.erstellt);
  }

  hinzufuegen(roh) {
    const liste = this._laden();
    const eintrag = auftragBereinigen({ ...roh, id: neueId(), status: 'offen', erstellt: Date.now() });
    liste.push(eintrag);
    this._speichern(liste);
    return eintrag;
  }

  setzenStatus(id, status, notiz) {
    const liste = this._laden();
    const e = liste.find((x) => x.id === id);
    if (!e) return null;
    if (STATUS.includes(String(status))) e.status = String(status);
    if (notiz != null) e.notiz = text(notiz, 2000);
    this._speichern(liste);
    return e;
  }

  // Der nächste noch offene Auftrag (für die Abarbeitung „der Reihe nach"): der
  // älteste offene zuerst.
  naechsterOffen() {
    return this._laden().filter((a) => a.status === 'offen').sort((a, b) => a.erstellt - b.erstellt)[0] || null;
  }

  entfernen(id) {
    const liste = this._laden();
    const rest = liste.filter((x) => x.id !== id);
    if (rest.length === liste.length) return false;
    this._speichern(rest);
    return true;
  }
}

module.exports = { AuftragSpeicher, auftragBereinigen, STATUS };
