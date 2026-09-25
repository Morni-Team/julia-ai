'use strict';

// Läuft losgelöst von Julia: wartet, bis die alte Fassung beendet ist,
// checkt den neuen Tag aus, zieht die Abhängigkeiten nach, startet Julia neu
// und wartet auf ihr "gesund". Kommt das nicht, geht es zurück auf den
// vorherigen Stand. Ein fehlgeschlagenes Update darf Julia nie unbrauchbar
// zurücklassen.

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

// Dieses Skript wird ALLEIN in den Datenordner kopiert und dort ausgeführt – es
// darf daher KEINE lokalen Module requiren (nur Node-Built-ins). Die kleine
// Wiederhol-Logik ist deshalb hier inline (Schwester von src/main/wiederholen.js).

const auftrag = JSON.parse(Buffer.from(process.argv[2] || '', 'base64').toString('utf8'));
const { repo, ziel, vorher, elternPid, statusDatei, logDatei } = auftrag;

function log(text) {
  fs.appendFileSync(logDatei, `${new Date().toISOString()}  ${text}\n`, 'utf8');
}

function status(daten) {
  fs.writeFileSync(statusDatei, JSON.stringify({ ziel, vorher, ...daten }, null, 2), 'utf8');
}

function lebt(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

const warte = (ms) => new Promise((r) => setTimeout(r, ms));

function lauf(befehl, args) {
  log(`> ${befehl} ${args.join(' ')}`);
  const r = spawnSync(befehl, args, { cwd: repo, encoding: 'utf8', shell: befehl === 'npm', windowsHide: true, timeout: 15 * 60 * 1000 });
  if (r.stdout) log(r.stdout.trim().slice(-2000));
  if (r.stderr) log(r.stderr.trim().slice(-2000));
  // Aussagekräftig loggen, WAS genau schiefging (Issue #119: „keine Info im Log").
  // spawnSync legt bei Prozess-/Dateiproblemen den Fehler in r.error (errno/syscall/
  // path, z. B. EBUSY/EPERM/ENOENT + betroffene Datei) – das ist der entscheidende
  // Hinweis bei „Datei gesperrt". Ohne diese Zeile stand er nirgends.
  if (r.error) {
    const e = r.error;
    log(`FEHLER ${befehl} ${args[0]}: ${e.code || ''} ${e.syscall || ''} ${e.path || ''} – ${e.message}`.trim());
  }
  if (r.status !== 0) {
    const zusatz = r.error ? ` (${r.error.code || r.error.message})` : '';
    throw new Error(`${befehl} ${args[0]} ist fehlgeschlagen (Code ${r.status})${zusatz}.`);
  }
}

// Wie `lauf`, aber wiederholt bei einem Fehlschlag ein paar Mal mit wachsender
// Pause (Issue #119/#120): git-checkout / npm ci scheitern gern an TRANSIENT
// gesperrten Dateien (Virenscanner/Backup-Tool hält kurz ein Handle). Erst nach
// mehreren Versuchen wird endgültig aufgegeben.
async function laufWiederholt(befehl, args, versuche = 3, pauseMs = 2000) {
  let letzter;
  for (let v = 1; v <= versuche; v++) {
    try { lauf(befehl, args); return; } catch (e) {
      letzter = e;
      if (v >= versuche) break;
      log(`Versuch ${v} fehlgeschlagen (${e.message}) – evtl. Datei gesperrt, neuer Versuch in ${pauseMs * v} ms.`);
      await warte(pauseMs * v);
    }
  }
  throw letzter;
}

// Lockfile-genau und ohne die Installationsskripte der Pakete – über solche
// Skripte verbreiten sich Lieferketten-Würmer (Shai-Hulud, 2025). Nur Electrons
// eigenes Skript läuft danach, es lädt das Programm selbst herunter.
async function abhaengigkeiten() {
  await laufWiederholt('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund']);
  await laufWiederholt('node', [path.join('node_modules', 'electron', 'install.js')]);
}

function starten(extraEnv) {
  const exe = path.join(repo, 'node_modules', 'electron', 'dist', 'electron.exe');
  const env = { ...process.env, ...extraEnv };
  delete env.ELECTRON_RUN_AS_NODE;
  const kind = spawn(exe, [repo], { cwd: repo, detached: true, stdio: 'ignore', windowsHide: false, env });
  kind.unref();
  return kind.pid;
}

function gesund() {
  try {
    const s = JSON.parse(fs.readFileSync(statusDatei, 'utf8'));
    return s.gesund === true;
  } catch {
    return false;
  }
}

async function main() {
  log(`Update von ${vorher} auf ${ziel}`);
  for (let i = 0; i < 60 && lebt(elternPid); i++) await warte(500);
  if (lebt(elternPid)) {
    log('Alte Fassung beendet sich nicht, Update abgebrochen.');
    status({ phase: 'fertig', ok: false, fehler: 'Julia hat sich nicht beendet.' });
    return;
  }

  let neuPid = null;
  try {
    await laufWiederholt('git', ['-c', 'advice.detachedHead=false', 'checkout', '--quiet', ziel]);
    await abhaengigkeiten();
    status({ phase: 'probe' });
    neuPid = starten({});
    for (let i = 0; i < 90; i++) {
      await warte(1000);
      if (gesund()) {
        log(`${ziel} läuft.`);
        status({ phase: 'fertig', ok: true, version: ziel });
        return;
      }
      if (!lebt(neuPid)) break;
    }
    throw new Error('Die neue Fassung ist nicht sauber gestartet.');
  } catch (e) {
    log(`Fehler: ${e.message} – zurück auf ${vorher}`);
    if (neuPid && lebt(neuPid)) spawnSync('taskkill', ['/pid', String(neuPid), '/T', '/F'], { windowsHide: true });
    try {
      await laufWiederholt('git', ['-c', 'advice.detachedHead=false', 'checkout', '--quiet', vorher]);
      await abhaengigkeiten();
    } catch (e2) {
      log(`Rückweg hatte Probleme: ${e2.message}`);
    }
    status({ phase: 'fertig', ok: false, version: ziel, fehler: e.message });
    starten({});
  }
}

main().catch((e) => log(`Unerwartet: ${e.stack || e.message}`));
