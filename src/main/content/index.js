'use strict';

const { ProfilSpeicher, standardProfil, profilBereinigen } = require('./profile');
const { AuftragSpeicher } = require('./auftraege');
const { PlanSpeicher } = require('./planung');

// Content-Creation-Modul – Anmeldeobjekt/Fassade. Bündelt (vorerst) die Creator-
// Profile; weitere Bausteine (Analyse, Konzept/Schnittplan, Adapter, Worker)
// hängen sich später hier an. Bewusst schlank und gekapselt: ist das Modul in der
// Config aus (`content.aktiv`), wird es vom Hauptprozess gar nicht erst geladen.
class Content {
  constructor({ ordner } = {}) {
    this.profile = new ProfilSpeicher(ordner);
    this.auftraege = new AuftragSpeicher(ordner);
    this.plan = new PlanSpeicher(ordner);
  }

  // --- Reiter 1: Schnittaufträge ---
  auftragListe() { return { auftraege: this.auftraege.alle() }; }
  auftragHinzufuegen(a) { return this.auftraege.hinzufuegen(a || {}); }
  auftragStatus(id, status, notiz) { return this.auftraege.setzenStatus(String(id || ''), status, notiz); }
  auftragEntfernen(id) { return this.auftraege.entfernen(String(id || '')); }

  // --- Reiter 2: Planung ---
  planListe() { return { plan: this.plan.alle() }; }
  planHinzufuegen(p) { return this.plan.hinzufuegen(p || {}); }
  planAktualisieren(id, felder) { return this.plan.aktualisieren(String(id || ''), felder || {}); }
  planEntfernen(id) { return this.plan.entfernen(String(id || '')); }

  // --- Creator-Profile ---
  profileListe() {
    return { profile: this.profile.alle(), aktivId: (this.profile.aktiv() || {}).id || null };
  }

  profilVorlage(name) {
    return standardProfil(name || 'Mein Kanal');
  }

  profilSpeichern(profil) {
    return this.profile.setzen(profilBereinigen(profil || {}));
  }

  profilAktivSetzen(id) {
    return this.profile.aktivSetzen(id);
  }

  profilLoeschen(id) {
    return this.profile.loeschen(id);
  }

  profilImportieren(jsonText) {
    return this.profile.importieren(jsonText);
  }

  profilExportieren(id) {
    return this.profile.exportieren(id);
  }
}

module.exports = { Content };
