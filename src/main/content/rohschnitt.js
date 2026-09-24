'use strict';

// Content-Creation-Modul – FFmpeg-ROHSCHNITT (Notfall-Fallback laut Auftrag).
// Baut aus einem Schnittplan einen FFmpeg-Befehl, der die Clips (mit In/Out je
// Quelle) zu einem echten geschnittenen Video zusammensetzt. REINE Logik: gibt den
// Befehl (Programm + Argumentliste) zurück, führt nichts aus – so testbar und
// unabhängig davon, ob FFmpeg installiert ist. Der Adobe-Weg (Premiere/AE) ist der
// Normalfall; das hier greift nur, wenn kein Adobe-Programm erreichbar ist.

const zahl = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// Ermittelt die eindeutigen Quelldateien (in Reihenfolge des ersten Vorkommens)
// und eine Zuordnung Quelle-Id -> FFmpeg-Input-Index. Clips ohne bekannte Datei
// werden übersprungen.
function eindeutigeQuellen(clips, quellen = {}) {
  const dateien = [];
  const index = {};
  for (const c of clips) {
    const datei = quellen[c.quelle];
    if (!datei) continue;
    if (!(c.quelle in index)) { index[c.quelle] = dateien.length; dateien.push(datei); }
  }
  return { dateien, index };
}

// plan: bereinigter Schnittplan; quellen: { quelleId: dateipfad }; ziel: Ausgabedatei.
// Ergebnis: { programm:'ffmpeg', args:[…], clips: <Zahl verwendeter Clips> }.
function ffmpegRohschnitt(plan, { quellen = {}, ziel } = {}) {
  if (!plan || !Array.isArray(plan.clips)) throw new Error('Kein Schnittplan.');
  if (!ziel) throw new Error('Kein Ziel-Pfad für den Rohschnitt.');
  const nutzbar = plan.clips.filter((c) => c.quelle && quellen[c.quelle] && zahl(c.out_s) > zahl(c.in_s));
  if (!nutzbar.length) throw new Error('Keine verwertbaren Clips (fehlende Quelldateien oder leere Dauer).');

  const { dateien, index } = eindeutigeQuellen(nutzbar, quellen);
  const teile = [];
  const label = [];
  nutzbar.forEach((c, i) => {
    const ii = index[c.quelle];
    const von = zahl(c.in_s);
    const bis = zahl(c.out_s);
    teile.push(`[${ii}:v]trim=start=${von}:end=${bis},setpts=PTS-STARTPTS[v${i}]`);
    teile.push(`[${ii}:a]atrim=start=${von}:end=${bis},asetpts=PTS-STARTPTS[a${i}]`);
    label.push(`[v${i}][a${i}]`);
  });
  const graph = `${teile.join(';')};${label.join('')}concat=n=${nutzbar.length}:v=1:a=1[outv][outa]`;

  const args = ['-y'];
  for (const d of dateien) args.push('-i', d);
  args.push('-filter_complex', graph, '-map', '[outv]', '-map', '[outa]', ziel);

  return { programm: 'ffmpeg', args, clips: nutzbar.length };
}

module.exports = { ffmpegRohschnitt, eindeutigeQuellen };
