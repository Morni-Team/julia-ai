'use strict';

const { ProfilSpeicher, standardProfil, profilBereinigen } = require('./profile');

// Content-Creation-Modul – Anmeldeobjekt/Fassade. Bündelt (vorerst) die Creator-
// Profile; weitere Bausteine (Analyse, Konzept/Schnittplan, Adapter, Worker)
// hängen sich später hier an. Bewusst schlank und gekapselt: ist das Modul in der
// Config aus (`content.aktiv`), wird es vom Hauptprozess gar nicht erst geladen.
class Content {
  constructor({ ordner } = {}) {
    this.profile = new ProfilSpeicher(ordner);
  }

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
