'use strict';

const fs = require('fs');
const path = require('path');

// Wissensgraph als Langzeit-Gedächtnis (Issue #89): statt loser Notizen ein
// kleiner Graph aus ENTITÄTEN (Dinge/Personen/Projekte mit „Beobachtungen") und
// RELATIONEN (Verknüpfungen „von –art– zu"). Rein lokal als JSON, ohne fremde
// Abhängigkeiten (kein Vektor-Dienst) – passt zu Julias schlankem, offline-
// tauglichen Ansatz. Zugangsdaten werden – wie beim einfachen Gedächtnis – nie
// gespeichert.

const ZUGANGSDATEN = /(?<![a-zäöüß])(passw(or)?t|password|kennwort|pin|tan|api[-_ ]?(key|schl[üu]ssel)|token|secret|geheimnis|zugangsdaten|login)(?![a-zäöüß])|sk-ant-|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----/i;

const heute = () => new Date().toISOString().slice(0, 10);
const norm = (s) => String(s || '').trim();
const sperre = (s) => ZUGANGSDATEN.test(s);

class Wissensgraph {
  constructor(ordner) {
    this.datei = path.join(ordner, 'wissensgraph.json');
  }

  _leer() {
    return { entitaeten: {}, relationen: [] };
  }

  _laden() {
    let text;
    try {
      text = fs.readFileSync(this.datei, 'utf8').replace(/^﻿/, '');
    } catch {
      return this._leer();
    }
    const d = JSON.parse(text);
    if (!d || typeof d.entitaeten !== 'object' || !Array.isArray(d.relationen)) {
      throw new Error('wissensgraph.json hat ein unerwartetes Format.');
    }
    return d;
  }

  _speichern(daten) {
    fs.mkdirSync(path.dirname(this.datei), { recursive: true });
    const tmp = this.datei + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(daten, null, 2), 'utf8');
    fs.renameSync(tmp, this.datei);
  }

  // Sorgt dafür, dass eine Entität existiert (legt sie bei Bedarf leer an).
  _sicherstellen(daten, name, typ) {
    const n = norm(name);
    if (!n) return null;
    if (!daten.entitaeten[n]) daten.entitaeten[n] = { typ: norm(typ), beobachtungen: [], geaendert: heute() };
    else if (typ && !daten.entitaeten[n].typ) daten.entitaeten[n].typ = norm(typ);
    return daten.entitaeten[n];
  }

  // Entitäten (mit Beobachtungen) und/oder Relationen hinzufügen bzw. ergänzen.
  //   entitaeten: [{ name, typ?, beobachtungen?: string[] }]
  //   relationen: [{ von, art, zu }]  (fehlende Entitäten werden angelegt)
  // Doppeltes wird zusammengeführt; Zugangsdaten werden abgewiesen.
  merken({ entitaeten = [], relationen = [] } = {}) {
    const ents = Array.isArray(entitaeten) ? entitaeten : [entitaeten];
    const rels = Array.isArray(relationen) ? relationen : [relationen];
    // Erst alles prüfen (nichts halb schreiben).
    for (const e of ents) {
      if (sperre(e && e.name) || sperre(e && e.typ) || (Array.isArray(e && e.beobachtungen) && e.beobachtungen.some(sperre))) {
        throw new Error('Das sieht nach Zugangsdaten aus. Die merke ich mir nicht.');
      }
    }
    for (const r of rels) {
      if (sperre(r && r.von) || sperre(r && r.art) || sperre(r && r.zu)) {
        throw new Error('Das sieht nach Zugangsdaten aus. Die merke ich mir nicht.');
      }
    }
    const daten = this._laden();
    let neueEnt = 0;
    let neueBeob = 0;
    let neueRel = 0;
    for (const e of ents) {
      const n = norm(e && e.name);
      if (!n) continue;
      const vorhanden = !!daten.entitaeten[n];
      const ent = this._sicherstellen(daten, n, e && e.typ);
      if (!vorhanden) neueEnt += 1;
      for (const b of (Array.isArray(e && e.beobachtungen) ? e.beobachtungen : [])) {
        const bb = norm(b);
        if (bb && !ent.beobachtungen.includes(bb)) { ent.beobachtungen.push(bb); neueBeob += 1; }
      }
      ent.geaendert = heute();
    }
    for (const r of rels) {
      const von = norm(r && r.von);
      const art = norm(r && r.art);
      const zu = norm(r && r.zu);
      if (!von || !art || !zu) continue;
      this._sicherstellen(daten, von);
      this._sicherstellen(daten, zu);
      const gibt = daten.relationen.some((x) => x.von.toLowerCase() === von.toLowerCase() && x.art.toLowerCase() === art.toLowerCase() && x.zu.toLowerCase() === zu.toLowerCase());
      if (!gibt) { daten.relationen.push({ von, art, zu }); neueRel += 1; }
    }
    this._speichern(daten);
    return { neueEntitaeten: neueEnt, neueBeobachtungen: neueBeob, neueRelationen: neueRel };
  }

  // Suche (Teilstring, Groß/klein egal) über Name, Typ und Beobachtungen. Leer =
  // alles. Liefert die Treffer-Entitäten samt der Relationen, die sie berühren.
  abfragen(suche = '', { grenze = 40 } = {}) {
    const daten = this._laden();
    const s = norm(suche).toLowerCase();
    const alle = Object.entries(daten.entitaeten);
    const treffer = (s
      ? alle.filter(([name, e]) => name.toLowerCase().includes(s)
        || (e.typ || '').toLowerCase().includes(s)
        || (e.beobachtungen || []).some((b) => b.toLowerCase().includes(s)))
      : alle
    ).slice(0, grenze);
    const namen = new Set(treffer.map(([n]) => n.toLowerCase()));
    const relationen = daten.relationen.filter((r) => namen.has(r.von.toLowerCase()) || namen.has(r.zu.toLowerCase()));
    return {
      entitaeten: treffer.map(([name, e]) => ({ name, typ: e.typ || '', beobachtungen: e.beobachtungen || [] })),
      relationen,
      gesamt: alle.length,
    };
  }

  // Entfernt eine Entität (samt ihrer Relationen), eine einzelne Relation oder
  // eine einzelne Beobachtung. Gibt zurück, ob etwas entfernt wurde.
  entfernen({ entitaet, beobachtung, relation } = {}) {
    const daten = this._laden();
    let weg = false;
    if (entitaet && beobachtung) {
      const ent = daten.entitaeten[norm(entitaet)];
      if (ent) {
        const vor = ent.beobachtungen.length;
        ent.beobachtungen = ent.beobachtungen.filter((b) => b.toLowerCase() !== norm(beobachtung).toLowerCase());
        weg = ent.beobachtungen.length !== vor;
      }
    } else if (entitaet) {
      const n = norm(entitaet);
      if (daten.entitaeten[n]) { delete daten.entitaeten[n]; weg = true; }
      const vor = daten.relationen.length;
      daten.relationen = daten.relationen.filter((r) => r.von.toLowerCase() !== n.toLowerCase() && r.zu.toLowerCase() !== n.toLowerCase());
      if (daten.relationen.length !== vor) weg = true;
    } else if (relation && relation.von && relation.art && relation.zu) {
      const vor = daten.relationen.length;
      daten.relationen = daten.relationen.filter((r) => !(r.von.toLowerCase() === norm(relation.von).toLowerCase() && r.art.toLowerCase() === norm(relation.art).toLowerCase() && r.zu.toLowerCase() === norm(relation.zu).toLowerCase()));
      weg = daten.relationen.length !== vor;
    }
    if (weg) this._speichern(daten);
    return weg;
  }

  // Kompakter Überblick für den System-Prompt/Status. Eine kaputte Datei darf
  // Julia nicht lahmlegen (nur lesen); Schreiben bricht dagegen sauber ab.
  alsText({ grenze = 30 } = {}) {
    let daten;
    try {
      daten = this._laden();
    } catch (err) {
      return `(wissensgraph.json ist nicht lesbar: ${err.message} – bitte den Nutzer darauf hinweisen)`;
    }
    const ents = Object.entries(daten.entitaeten);
    if (!ents.length && !daten.relationen.length) return '(noch leer)';
    const zeilen = [];
    for (const [name, e] of ents.slice(0, grenze)) {
      const typ = e.typ ? ` (${e.typ})` : '';
      const beob = (e.beobachtungen || []).slice(0, 5).join('; ');
      zeilen.push(`- ${name}${typ}${beob ? `: ${beob}` : ''}`);
    }
    for (const r of daten.relationen.slice(0, grenze)) zeilen.push(`- ${r.von} —${r.art}→ ${r.zu}`);
    return zeilen.join('\n');
  }
}

module.exports = { Wissensgraph };
