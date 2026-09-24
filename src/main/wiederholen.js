'use strict';

// Kleiner, wiederverwendbarer Wiederhol-Helfer mit Backoff (Issue #119/#120).
// Gedacht für Operationen, die an TRANSIENT gesperrten Dateien scheitern können
// (Virenscanner/Backup-Tool hält kurz ein Handle, „resource busy or locked" /
// EBUSY / EPERM beim Update). Statt beim ersten Fehler aufzugeben, wird ein paar
// Mal mit wachsender Pause erneut versucht; erst danach fliegt der letzte Fehler.
//
// `warte(ms)` ist injizierbar, damit es sich ohne echtes Warten testen lässt.

const echtWarte = (ms) => new Promise((r) => setTimeout(r, ms));

async function mitWiederholung(fn, { versuche = 3, pauseMs = 1500, warte = echtWarte, beiFehler = null } = {}) {
  const max = Math.max(1, versuche | 0);
  let letzter;
  for (let versuch = 1; versuch <= max; versuch++) {
    try {
      return await fn(versuch);
    } catch (e) {
      letzter = e;
      if (versuch >= max) break;
      if (beiFehler) { try { beiFehler(e, versuch); } catch { /* Melden darf nie stören */ } }
      await warte(pauseMs * versuch); // linearer Backoff: 1×, 2×, 3× …
    }
  }
  throw letzter;
}

module.exports = { mitWiederholung };
