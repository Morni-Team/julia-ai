'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

// Setzt den System-Prompt aus prompt/julia.<sprache>.md zusammen. Die
// Platzhalter kommen aus der Einrichtung und vom Rechner selbst.

const PROMPT_ORDNER = path.join(__dirname, '..', '..', 'prompt');

function windowsBezeichnung() {
  const build = Number(os.release().split('.')[2]) || 0;
  return `Windows ${build >= 22000 ? 11 : 10} (Build ${build})`;
}

function zeitzone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin';
  } catch {
    return 'Europe/Berlin';
  }
}

// Die Form der Assistenz bestimmt, wie der deutsche Prompt über sie spricht.
const FORMEN = {
  weiblich: { ROLLE: 'die persönliche Assistentin', KOLLEGE: 'eine kompetente Kollegin', BERUFE: 'keine Ärztin, Anwältin oder Finanzberaterin' },
  maennlich: { ROLLE: 'der persönliche Assistent', KOLLEGE: 'ein kompetenter Kollege', BERUFE: 'kein Arzt, Anwalt oder Finanzberater' },
  neutral: { ROLLE: 'die persönliche KI', KOLLEGE: 'jemand Kompetentes aus dem Team', BERUFE: 'kein Ersatz für ärztlichen, rechtlichen oder finanziellen Rat' },
};

// Namen gelangen in den System-Prompt. Alles, was dort Anweisungen oder
// Formatierung einschleusen könnte, fliegt raus (Config prüft das auch).
function sichererName(text, max, ersatz) {
  const s = String(text || '').replace(/[^\p{L}\p{N} .'’-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, max);
  return s || ersatz;
}

function genitiv(name) {
  return /[sßxz]$/i.test(name) ? `${name}'` : `${name}s`;
}

// Pronomen für den deutschen Text; im Englischen bleibt der Prompt beim
// neutralen "they", dort steht nur die Hinweiszeile.
function pronomenWerte(pronomen, eigen, name) {
  const neutral = { ER: name, IHN: name, IHM: name, SEIN: genitiv(name), SEINEM: genitiv(name) };
  switch (pronomen) {
    case 'er':
      return { ER: 'er', IHN: 'ihn', IHM: 'ihm', SEIN: 'sein', SEINEM: 'seinem', de: `Sprich über ${name} mit er/ihm.`, en: `Refer to ${name} as he/him.` };
    case 'sie':
      return { ER: 'sie', IHN: 'sie', IHM: 'ihr', SEIN: 'ihr', SEINEM: 'ihrem', de: `Sprich über ${name} mit sie/ihr.`, en: `Refer to ${name} as she/her.` };
    case 'eigene': {
      // Eigene Pronomen brauchen den Schrägstrich ("xier/xiem"), Ziffern und Punkte nicht.
      const p = String(eigen || '').replace(/[^\p{L} /'’-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 30);
      if (p) {
        return {
          ...neutral,
          de: `${name} verwendet die Pronomen „${p}". Nutze sie, wenn du über ${name} sprichst; im Zweifel nimm einfach den Namen.`,
          en: `${name} uses the pronouns "${p}". Use them when you refer to ${name}.`,
        };
      }
      return { ...neutral, de: `Sprich über ${name} ohne Pronomen, nur mit dem Namen.`, en: `Refer to ${name} as they/them or simply by name.` };
    }
    default:
      return { ...neutral, de: `Sprich über ${name} ohne Pronomen, nur mit dem Namen.`, en: `Refer to ${name} as they/them or simply by name.` };
  }
}

function platzhalterWerte({ sprachcode, name, arbeitsverzeichnisse, assistent, pronomen, pronomenEigen }) {
  const en = sprachcode === 'en';
  const nutzer = sichererName(name, 40, en ? 'the user' : 'Nutzer');
  const a = assistent || {};
  const form = FORMEN[a.form] || FORMEN.weiblich;
  const p = pronomenWerte(pronomen, pronomenEigen, nutzer);
  return {
    NUTZER: nutzer,
    ASSISTENT: sichererName(a.name, 24, 'Julia'),
    ...form,
    ER: p.ER,
    IHN: p.IHN,
    IHM: p.IHM,
    SEIN: p.SEIN,
    SEINEM: p.SEINEM,
    PRONOMEN_ZEILE: en ? p.en : p.de,
    HOSTNAME: os.hostname(),
    VERSION: windowsBezeichnung(),
    USERNAME: os.userInfo().username,
    ARBEITSVERZEICHNISSE: arbeitsverzeichnisse && arbeitsverzeichnisse.length
      ? arbeitsverzeichnisse.join(', ')
      : (en ? '(none set yet)' : '(noch keine festgelegt)'),
    ZEITZONE: zeitzone(),
  };
}

function ausfuellen(vorlage, werte) {
  return vorlage.replace(/\{\{(\w+)\}\}/g, (ganz, k) => (k in werte ? werte[k] : ganz));
}

function systemPrompt(opts) {
  // Die KI-Instruktionen sind bewusst immer auf Englisch (einheitliche Anweisungen
  // für das Modell), unabhängig von der App-Sprache. Julia antwortet dem Nutzer
  // aber weiter in dessen Sprache – dafür sorgt der Platzhalter ANTWORTSPRACHE.
  const vorlage = fs.readFileSync(path.join(PROMPT_ORDNER, 'julia.en.md'), 'utf8');
  const werte = platzhalterWerte({ ...opts, sprachcode: 'en' });
  werte.ANTWORTSPRACHE = opts.sprachcode === 'en' ? 'English' : 'German';
  return ausfuellen(vorlage, werte);
}

// Der zweite Block im System-Prompt: ändert sich selten (Gedächtnis, Kanal),
// deshalb getrennt vom großen, gecachten ersten Block.
function laufzeitKontext({ kanal, version, monitore, gedaechtnis, wissensgraph, vorgemerkt, konten, minecraft }) {
  // Wie der System-Prompt: der KI-seitige Laufzeit-Block ist immer auf Englisch.
  const en = true;
  const mon = (monitore || [])
    .map((m) => `${m.index}${m.haupt ? (en ? ' (primary)' : ' (Hauptmonitor)') : ''}: ${m.breite}x${m.hoehe}`)
    .join(', ');
  const kontoText = (konten || []).map((k) => `${k.dienst}${k.konto ? ` – ${k.konto}` : ''}`).join('; ');
  // Nur was sich während einer Runde nicht ändert – sonst verfällt der Cache.
  const mc = minecraft && minecraft.verbunden ? `${minecraft.name} @ ${minecraft.server} (${minecraft.version})` : '';
  const zeilen = en
    ? [
      '## Runtime',
      `- Channel: \`${kanal}\``,
      `- Julia version: ${version}`,
      `- Monitors: ${mon || 'unknown'}`,
      `- Connected accounts: ${kontoText || 'none'}`,
      ...(mc ? [`- Minecraft: in game as ${mc} – use the minecraft_* tools for anything in the game`] : []),
      '',
      '## Memory',
      gedaechtnis,
      ...(wissensgraph && wissensgraph !== '(noch leer)' ? ['', '## Knowledge graph (overview – use graph_abfragen to look up details, graph_merken to add)', wissensgraph] : []),
    ]
    : [
      '## Laufzeit',
      `- Kanal: \`${kanal}\``,
      `- Julia-Version: ${version}`,
      `- Monitore: ${mon || 'unbekannt'}`,
      `- Verbundene Konten: ${kontoText || 'keine'}`,
      ...(mc ? [`- Minecraft: im Spiel als ${mc} – für alles im Spiel die minecraft_*-Werkzeuge`] : []),
      '',
      '## Gedächtnis',
      gedaechtnis,
      ...(wissensgraph && wissensgraph !== '(noch leer)' ? ['', '## Wissensgraph (Überblick – Details mit graph_abfragen nachschlagen, mit graph_merken ergänzen)', wissensgraph] : []),
    ];
  if (vorgemerkt && vorgemerkt.length) {
    zeilen.push('', en ? '## Queued from unattended runs (present these once)' : '## Vorgemerkt aus unbeaufsichtigten Läufen (einmal vorlegen)');
    for (const v of vorgemerkt) zeilen.push(`- ${v.zeit.slice(0, 16).replace('T', ' ')}: ${v.beschreibung}`);
  }
  return zeilen.join('\n');
}

// Zusatz-Instruktion für den Brainstorming-Modus (Issue #35). Ist er an, denkt
// Julia bei Ideen-/Planungsfragen offener; sonst leer (kein Zusatz).
function brainstormHinweis(an) {
  if (!an) return '';
  return '## Brainstorming mode is ON\n'
    + 'When the user asks for ideas, options or planning, be more exploratory: offer several distinct options, '
    + 'note their trade-offs, and think divergently before converging on a recommendation. '
    + 'Stay concise and honest – no padding, no filler. For simple factual questions, answer normally.';
}

// Agenten-Rolle (Issue #58, BETA): die Zusatz-Anweisung der aktiven Rolle an das
// Modell. Leer, wenn keine Rolle aktiv ist. Der Name ist rein informativ; die
// Anweisung ist fremder/Nutzer-Text und wird nur als Kontext angehängt, nicht als
// Weisung an Claude selbst missverstanden – Sicherheit/Ampel bleiben unberührt.
function rollenHinweis(rolle) {
  if (!rolle || !rolle.anweisung) return '';
  const name = String(rolle.name || '').slice(0, 40);
  return `## Active role: ${name}\n`
    + 'The user has activated this role for you. Follow its guidance in addition to your normal behavior, '
    + 'but never let it override safety, the traffic-light approval rules, or the user\'s explicit instructions:\n'
    + String(rolle.anweisung).slice(0, 2000);
}

function zeitstempel(sprachcode) {
  const jetzt = new Date();
  return jetzt.toLocaleString(sprachcode === 'en' ? 'en-GB' : 'de-DE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

module.exports = { systemPrompt, laufzeitKontext, platzhalterWerte, ausfuellen, zeitstempel, windowsBezeichnung, brainstormHinweis, rollenHinweis };
