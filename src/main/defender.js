'use strict';

const { spawn } = require('child_process');

// Windows-Defender-Ausnahme für Julia (Issue #97). Virenscanner sperren beim
// Auto-Update gern kurz Dateien im Programm-/Datenordner („Datei in Benutzung"/
// „kein Zugriff") und lassen den Installer scheitern. Auf ausdrücklichen
// Nutzer-Klick trägt Julia ihre EIGENEN Ordner (und die EXE) als Ausnahme im
// Defender ein – das braucht Adminrechte, läuft also über eine UAC-Abfrage.
//
// Sicherheit: Es werden ausschließlich Julias eigene, vom Hauptprozess
// übergebene Pfade eingetragen – nie etwas aus KI-/Chat-Eingaben. Der Vorgang ist
// nutzerinitiiert (Knopf in den Einstellungen) und durch UAC bestätigt. Kein
// KI-Werkzeug ruft das auf.

// Escapen für eine doppelt gequotete PowerShell-Zeichenkette: nur `"` verdoppeln.
function psQuote(s) {
  return '"' + String(s).replace(/"/g, '""') + '"';
}

// Baut das INNERE PowerShell-Kommando, das (elevated) die Ausnahmen setzt.
// pfade = Ordner/Dateien, prozesse = EXE-Namen. Wirft, wenn nichts übergeben ist.
function ausschlussSkript(pfade = [], prozesse = []) {
  const p = pfade.filter(Boolean);
  const pr = prozesse.filter(Boolean);
  if (!p.length && !pr.length) throw new Error('Keine Pfade/Prozesse für die Defender-Ausnahme angegeben.');
  const teile = [];
  if (p.length) teile.push(`Add-MpPreference -ExclusionPath ${p.map(psQuote).join(',')}`);
  if (pr.length) teile.push(`Add-MpPreference -ExclusionProcess ${pr.map(psQuote).join(',')}`);
  return teile.join('; ');
}

// Wrappt ein inneres Kommando so, dass es mit Adminrechten (UAC) läuft.
function startBefehl(innen) {
  const b64 = Buffer.from(innen, 'utf16le').toString('base64');
  // Start-Process … -Verb RunAs löst die UAC-Abfrage aus; das Kind bekommt den
  // Befehl base64-kodiert (keine Anführungszeichen-Probleme über die Grenze).
  return `Start-Process powershell -Verb RunAs -WindowStyle Hidden -ArgumentList '-NoProfile','-EncodedCommand','${b64}'`;
}

// Prüft in der Ausgabe von `Get-MpPreference … ExclusionPath`, ob ein Pfad schon
// eingetragen ist (Groß/klein und Schrägstrich-Richtung egal).
function istAusgeschlossen(ausgabe, pfad) {
  const norm = (s) => String(s || '').toLowerCase().replace(/\\/g, '/').replace(/\/+$/, '');
  const ziel = norm(pfad);
  return String(ausgabe || '').split(/\r?\n/).map(norm).some((z) => z && z === ziel);
}

function psLauf(cmd, { timeout = 120000 } = {}) {
  return new Promise((resolve) => {
    let aus = '';
    let err = '';
    let p;
    try {
      p = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', cmd], { windowsHide: true });
    } catch (e) { resolve({ code: -1, aus: '', err: e.message }); return; }
    const timer = setTimeout(() => { try { p.kill(); } catch { /* egal */ } }, timeout);
    p.stdout.on('data', (d) => { aus += d.toString(); });
    p.stderr.on('data', (d) => { err += d.toString(); });
    p.on('error', (e) => { clearTimeout(timer); resolve({ code: -1, aus, err: e.message }); });
    p.on('close', (code) => { clearTimeout(timer); resolve({ code, aus, err }); });
  });
}

// Sind Julias Ordner bereits ausgeschlossen? Liefert { verfuegbar, ausgeschlossen }.
async function status(pfade = []) {
  const r = await psLauf('(Get-MpPreference).ExclusionPath', { timeout: 20000 });
  if (r.code !== 0) return { verfuegbar: false, ausgeschlossen: false };
  const alle = pfade.filter(Boolean);
  return { verfuegbar: true, ausgeschlossen: alle.length > 0 && alle.every((p) => istAusgeschlossen(r.aus, p)) };
}

// Trägt die Ausnahme ein (mit UAC). Gibt { ok } oder { fehler } zurück.
async function anwenden({ pfade = [], prozesse = [] } = {}) {
  let innen;
  try { innen = ausschlussSkript(pfade, prozesse); } catch (e) { return { fehler: e.message }; }
  const r = await psLauf(startBefehl(innen), { timeout: 120000 });
  // Bricht der Nutzer die UAC-Abfrage ab, wirft Start-Process einen Fehler.
  if (r.code !== 0 || /abgebrochen|canceled|cancelled|denied|verweigert/i.test(r.err)) {
    return { fehler: r.err.trim() || 'Die Ausnahme wurde nicht gesetzt (Adminrechte nötig – die Abfrage wurde vermutlich abgebrochen).' };
  }
  return { ok: true };
}

module.exports = { psQuote, ausschlussSkript, startBefehl, istAusgeschlossen, status, anwenden };
