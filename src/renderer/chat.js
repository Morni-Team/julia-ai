'use strict';

// Chatfenster: zeigt das Gespräch, Werkzeugschritte und Freigabekarten.
// Nachrichten laufen immer über den Hauptprozess, der sie zurückspiegelt.

const $ = (id) => document.getElementById(id);
// Dieselbe Seite dient als Gaming-Overlay (chat.html?overlay=1).
const imOverlay = new URLSearchParams(location.search).get('overlay') === '1';
if (imOverlay) document.body.classList.add('overlay');
let T = {};
let beschaeftigt = false;
let jarvisAn = false;
let hoert = false;
let hotkey = '';
let antwortEl = null;
let antwortRoh = '';
let denkEl = null; // eingeklappte Reasoning-Box (Issue #74)
let denkRoh = '';
const werkzeugEls = new Map();
const freigabeEls = new Map();

const ICON = {
  neu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  einst: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>',
  mikro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><path d="M12 17v5"/></svg>',
  senden: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>',
  stopp: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2.5"/></svg>',
  zu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  klammer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m20.5 11.5-8.2 8.2a5.3 5.3 0 0 1-7.5-7.5l8.6-8.6a3.5 3.5 0 0 1 5 5l-8.6 8.6a1.8 1.8 0 0 1-2.5-2.5l7.9-7.9"/></svg>',
  kopieren: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
  haken: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
};

const ANHANG_ICON = { text: '📄', bild: '🖼', pdf: '📑', auswahl: '✂', fehlt: '⚠' };
let anhaenge = []; // { name, pfad }

function anhangChips(liste) {
  if (!liste || !liste.length) return '';
  return `<div class="anhaenge">${liste.map((a) => `<span class="anhang-chip${a.art === 'fehlt' ? ' fehlt' : ''}"${a.grund ? ` title="${esc(a.grund)}"` : ''}>${ANHANG_ICON[a.art] || '📄'} ${esc(a.name)}${a.grund ? ` – ${esc(a.grund)}` : ''}</span>`).join('')}</div>`;
}

function anhaengeMalen() {
  const l = $('anhangLeiste');
  l.hidden = !anhaenge.length;
  l.innerHTML = anhaenge.map((a, i) => `<span class="anhang-chip">📎 ${esc(a.name)}<button type="button" data-i="${i}" aria-label="×">×</button></span>`).join('');
  l.querySelectorAll('button').forEach((b) => { b.onclick = () => { anhaenge.splice(Number(b.dataset.i), 1); anhaengeMalen(); }; });
}

function dateienHinzu(dateien) {
  for (const d of dateien) {
    const pfad = julia.dateiPfad(d);
    if (!pfad || anhaenge.some((a) => a.pfad === pfad)) continue;
    if (anhaenge.length >= 5) break;
    anhaenge.push({ name: d.name, pfad });
  }
  anhaengeMalen();
  $('text').focus();
}

// Passives Overlay im Spiel: Fährt die Maus über den Chat, wird er greifbar
// (scrollen, klicken); ein Klick hinein macht ihn aktiv zum Tippen. Daneben
// gehen Klicks weiter ans Spiel.
let overlayDrin = false;

function overlayModus(modus) {
  document.body.classList.toggle('passiv', modus === 'passiv');
  overlayDrin = false;
  if (modus !== 'passiv') $('text').focus();
}

// Aussehen des Overlays aus den Einstellungen: Schrift, Hintergrund, kompakt.
function overlayStil(o) {
  if (!imOverlay || !o) return;
  const s = document.body.style;
  s.setProperty('--ov-schrift', `${o.schrift || 13}px`);
  s.setProperty('--ov-hintergrund', String(o.hintergrund ?? 0.86));
  document.body.classList.toggle('kompakt', !!o.kompakt);
}

if (imOverlay) {
  const passiv = () => document.body.classList.contains('passiv');
  document.addEventListener('mousemove', () => {
    if (passiv() && !overlayDrin) { overlayDrin = true; julia.overlayMaus(true); }
  });
  document.documentElement.addEventListener('mouseleave', () => {
    if (overlayDrin) { overlayDrin = false; julia.overlayMaus(false); }
  });
  document.addEventListener('mousedown', () => { if (passiv()) julia.overlayAktivieren(); }, true);
}

function tx(k, werte) {
  let s = T[k] ?? k;
  if (werte) for (const [a, b] of Object.entries(werte)) s = s.split(`{${a}}`).join(String(b));
  return s;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Zeitlimit für Start-IPCs kommt aus zeitlimit.js, das vor chat.js geladen wird
// und `mitZeitlimit` global bereitstellt. NICHT hier erneut deklarieren – ein
// `const mitZeitlimit` würde mit der Funktion aus zeitlimit.js kollidieren
// („Identifier 'mitZeitlimit' has already been declared") und chat.js komplett
// lahmlegen (Issue #70). Die globale Funktion wird direkt verwendet.

// Markdown (Absätze, Listen, Code, fett/kursiv, Links, Tabellen) kommt aus dem
// gemeinsamen, getesteten Modul markdown.js, das vor chat.js geladen wird und
// `md` global bereitstellt. NICHT erneut deklarieren (würde wie bei #70 mit der
// Funktion aus markdown.js kollidieren) – die globale Funktion wird direkt genutzt.

// --- Verlauf ---

const verlauf = $('verlauf');

function amEnde() {
  return verlauf.scrollHeight - verlauf.scrollTop - verlauf.clientHeight < 80;
}

function anhaengen(el) {
  const unten = amEnde();
  $('leer').hidden = true;
  verlauf.appendChild(el);
  if (unten) verlauf.scrollTop = verlauf.scrollHeight;
  return el;
}

function element(klasse, html) {
  const d = document.createElement('div');
  d.className = klasse;
  if (html != null) d.innerHTML = html;
  return d;
}

function nutzerNachricht(text, perSprache, vomHandy, liste) {
  antwortEl = null;
  const meta = vomHandy ? `📱 ${esc(tx('chat.handy'))}` : perSprache ? `🎙 ${esc(tx('chat.sprache'))}` : '';
  anhaengen(element('nachricht nutzer',
    `<div class="blase">${esc(text).replace(/\n/g, '<br>')}</div>${anhangChips(liste)}${meta ? `<div class="meta">${meta}</div>` : ''}`));
}

// Kopierknopf an jeder Antwort – über den Hauptprozess, die Seite selbst darf
// nicht in die Zwischenablage schreiben.
function kopierKnopf(nachricht) {
  const b = document.createElement('button');
  b.className = 'kopier-knopf';
  b.type = 'button';
  b.title = tx('chat.kopieren');
  b.innerHTML = ICON.kopieren;
  b.onclick = async () => {
    await julia.kopieren(nachricht.juliaRoh || '');
    b.innerHTML = ICON.haken;
    b.classList.add('ok');
    setTimeout(() => { b.innerHTML = ICON.kopieren; b.classList.remove('ok'); }, 1400);
  };
  nachricht.appendChild(b);
}

function juliaText(delta, ganz = false) {
  if (!antwortEl) {
    denkBoxAbschliessen(); // beginnt die Antwort: leere Denk-Box weg, volle zuklappen
    antwortEl = anhaengen(element('nachricht julia', '<div class="blase"></div>'));
    if (!imOverlay) kopierKnopf(antwortEl);
    antwortRoh = '';
  }
  antwortRoh = ganz ? delta : antwortRoh + delta;
  antwortEl.juliaRoh = antwortRoh;
  const unten = amEnde();
  antwortEl.firstChild.innerHTML = md(antwortRoh);
  if (unten) verlauf.scrollTop = verlauf.scrollHeight;
}

// Reasoning-/Denk-Schritt live in einer Box zeigen (Issue #74/#79). Die Box
// erscheint SOFORT beim Antwortstart als „Nachdenken …" (aufgeklappt, damit man
// direkt sieht, dass etwas passiert, statt langer Stille) und füllt sich live.
// Liefert der Anbieter/das Modell keinen Reasoning-Schritt, wird die leere Box
// entfernt, sobald die eigentliche Antwort beginnt (juliaText).
function denkBoxAnlegen() {
  if (imOverlay || denkEl) return;
  denkEl = anhaengen(element('nachricht julia',
    `<details class="denken" open><summary>${esc(tx('chat.reasoning'))}</summary><div class="denk-inhalt"></div></details>`));
  denkRoh = '';
}
function juliaDenken(delta) {
  if (!delta) return;
  denkBoxAnlegen();
  denkRoh += delta;
  const unten = amEnde();
  const inhalt = denkEl && denkEl.querySelector('.denk-inhalt');
  if (inhalt) inhalt.textContent = denkRoh;
  if (unten) verlauf.scrollTop = verlauf.scrollHeight;
}
// Leere Denk-Box wegräumen (kein Reasoning gekommen); volle nur zuklappen.
function denkBoxAbschliessen() {
  if (!denkEl) return;
  if (!denkRoh) denkEl.remove();
  else denkEl.open = false;
  denkEl = null;
}

function werkzeug({ id, name, eingabe, eingabeVoll }) {
  antwortEl = null;
  denkBoxAbschliessen(); // vor einem Werkzeug: leere Denk-Box weg, volle zuklappen
  const zeigJson = eingabeVoll && eingabeVoll !== '{}';
  const d = element('werkzeug laeuft',
    `<span class="ico"></span><span class="wname">${esc(name)}</span><span class="weingabe">${esc(eingabe === '{}' ? '' : eingabe || '')}</span>`
    + (zeigJson ? `<button class="w-json" type="button" title="${esc(tx('chat.werkzeug_details'))}" aria-label="${esc(tx('chat.werkzeug_details'))}">{ }</button>` : ''));
  if (zeigJson) {
    const pre = document.createElement('pre');
    pre.className = 'w-details';
    pre.hidden = true;
    pre.textContent = eingabeVoll; // als Text gesetzt: kein HTML-Einschleusen
    d.appendChild(pre);
    d.querySelector('.w-json').addEventListener('click', () => { pre.hidden = !pre.hidden; });
  }
  werkzeugEls.set(id, d);
  anhaengen(d);
  return d;
}

function werkzeugFertig({ id, ok, rot }) {
  const d = werkzeugEls.get(id);
  if (!d) return;
  d.classList.remove('laeuft');
  d.classList.add(ok ? 'ok' : rot ? 'rot' : 'fehler');
}

function freigabe(f) {
  antwortEl = null;
  const auftrag = f.art === 'auftrag';
  const karte = element('karte');
  karte.innerHTML = `
    <div class="k-titel">⚠ ${esc(tx(auftrag ? 'chat.auftrag' : 'chat.freigabe'))}</div>
    <div class="k-text">${auftrag ? esc(f.beschreibung) : String(f.beschreibung).includes('\n') ? `<pre class="k-pre">${esc(f.beschreibung)}</pre>` : `<code>${esc(f.beschreibung)}</code>`}</div>
    ${f.grund ? `<div class="k-grund">${esc(f.grund)}</div>` : ''}
    ${auftrag && f.schritte && f.schritte.length ? `<ol>${f.schritte.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
    ${auftrag && f.kategorien && f.kategorien.length ? `<div class="k-grund">${esc(tx('chat.auftrag_kategorien'))}:</div><div class="chips">${f.kategorien.map((k) => `<span class="chip">${esc(k)}</span>`).join('')}</div>` : ''}
    <div class="k-knoepfe"><button class="ja">${esc(tx('chat.ja'))}</button><button class="nein">${esc(tx('chat.nein'))}</button></div>`;
  karte.querySelector('.ja').onclick = () => julia.freigabe(f.id, true);
  karte.querySelector('.nein').onclick = () => julia.freigabe(f.id, false);
  freigabeEls.set(f.id, karte);
  anhaengen(karte);
  karte.querySelector('.ja').focus();
}

// Teil B von #51: Die KI bittet um einen geheimen Wert. Eine Box mit Passwort-
// Feld; der Wert geht direkt an den Hauptprozess (verschlüsselt), nie über die KI.
function geheimnisFrage({ id, name, zweck }) {
  antwortEl = null;
  const karte = element('karte geheimnis');
  karte.innerHTML = `
    <div class="k-titel">🔒 ${esc(tx('chat.geheim_titel', { name: name || '' }))}</div>
    ${zweck ? `<div class="k-text">${esc(zweck)}</div>` : ''}
    <div class="k-grund">${esc(tx('chat.geheim_hinweis'))}</div>
    <input class="g-wert" type="password" autocomplete="off" spellcheck="false" placeholder="${esc(tx('chat.geheim_platzhalter'))}">
    <div class="k-knoepfe"><button class="ja">${esc(tx('chat.geheim_speichern'))}</button><button class="nein">${esc(tx('chat.abbrechen'))}</button></div>`;
  const feld = karte.querySelector('.g-wert');
  const senden = (abbruch) => {
    const wert = feld.value;
    feld.value = '';
    julia.geheimnisEingabe(abbruch ? { id, abbruch: true } : { id, name, wert });
  };
  karte.querySelector('.ja').onclick = () => senden(false);
  karte.querySelector('.nein').onclick = () => senden(true);
  feld.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); senden(false); } });
  freigabeEls.set(`g${id}`, karte);
  anhaengen(karte);
  feld.focus();
}

function geheimnisErledigt({ id, ok, name }) {
  const karte = freigabeEls.get(`g${id}`);
  if (!karte) return;
  karte.classList.add('erledigt');
  const rest = karte.querySelector('.g-wert');
  if (rest) rest.remove();
  const knoepfe = karte.querySelector('.k-knoepfe');
  if (knoepfe) knoepfe.outerHTML = `<div class="k-ergebnis ${ok ? 'ja-text' : 'nein-text'}">${ok ? '✓ ' + esc(tx('chat.geheim_ok', { name: name || '' })) : '✕ ' + esc(tx('chat.abgebrochen'))}</div>`;
}

function freigabeErledigt({ id, ja }) {
  const karte = freigabeEls.get(id);
  if (!karte) return;
  karte.classList.add('erledigt');
  const knoepfe = karte.querySelector('.k-knoepfe');
  knoepfe.outerHTML = `<div class="k-ergebnis ${ja ? 'ja-text' : 'nein-text'}">${ja ? '✓ ' + esc(tx('chat.freigegeben')) : '✕ ' + esc(tx('chat.abgelehnt'))}</div>`;
}

function systemzeile(text, art = '') {
  antwortEl = null;
  const d = element(`systemzeile ${art}`);
  d.textContent = text;
  anhaengen(d);
}

function leeren() {
  verlauf.querySelectorAll(':scope > :not(#leer)').forEach((e) => e.remove());
  $('leer').hidden = false;
  antwortEl = null;
  antwortRoh = '';
  denkEl = null;
  werkzeugEls.clear();
  freigabeEls.clear();
}

// --- Kopf, Eingabe ---

function statusText(zustand) {
  if (hoert) return tx('chat.hoert');
  if (beschaeftigt || zustand === 'thinking') return tx('chat.denkt');
  return tx(`zustand.${zustand || 'idle'}`);
}

function zustandAnzeigen(z) {
  document.body.dataset.zustand = z;
  $('status').textContent = statusText(z);
}

function knopfSenden() {
  const b = $('btnSenden');
  b.classList.toggle('stopp', beschaeftigt);
  b.innerHTML = beschaeftigt ? ICON.stopp : ICON.senden;
  b.title = tx(beschaeftigt ? 'chat.stopp' : 'chat.senden');
}

function beschaeftigtSetzen(b) {
  beschaeftigt = b;
  knopfSenden();
  zustandAnzeigen(document.body.dataset.zustand || 'idle');
}

// "Control+Alt+Space" so, wie es auf der Tastatur steht.
function tastenAnzeige(kombi) {
  const de = document.documentElement.lang === 'de';
  const namen = de
    ? { Control: 'Strg', CommandOrControl: 'Strg', CmdOrCtrl: 'Strg', Space: 'Leertaste', Shift: 'Umschalt' }
    : { Control: 'Ctrl', CommandOrControl: 'Ctrl', CmdOrCtrl: 'Ctrl' };
  return String(kombi || '').split('+').map((t) => namen[t] || t).join('+');
}

function texteAnwenden(daten) {
  T = daten.texte;
  document.documentElement.lang = daten.sprachcode;
  const hk = tastenAnzeige(hotkey);
  $('assistentName').textContent = tx('chat.titel');
  document.title = tx('chat.titel');
  $('text').placeholder = tx('chat.platzhalter');
  $('kiHinweis').textContent = tx('chat.ki_hinweis');
  $('btnNeu').title = tx('chat.neu');
  $('btnEinst').title = tx('chat.einstellungen');
  $('btnZu').title = tx('chat.schliessen');
  $('btnMikro').title = `${tx('chat.mikro')} (${hk})`;
  $('btnAnhang').title = tx('chat.anhaengen');
  $('ablegenText').textContent = tx('chat.ablegen');
  $('leerText').textContent = tx('chat.leer', { hotkey: hk });
  knopfSenden();
  zustandAnzeigen(document.body.dataset.zustand || 'idle');
}

function hoehe() {
  const t = $('text');
  t.style.height = 'auto';
  t.style.height = Math.min(160, t.scrollHeight) + 'px';
}

function absenden() {
  const t = $('text');
  const text = t.value.trim();
  if (!text && !anhaenge.length) return;
  // Easter-Egg: „jarvis" schaltet den Jarvis-Look samt Sprechweise ein, „julia" zurück.
  const wort = text.toLowerCase().replace(/[\s.!?]+/g, ' ').trim();
  if (!anhaenge.length && (wort === 'jarvis' || wort === 'hey jarvis')) {
    t.value = ''; hoehe();
    julia.jarvisSetzen(true).catch(() => {});
    systemzeile('J.A.R.V.I.S. online. Zu Ihren Diensten, Sir. (Tippe „julia", um zurückzuschalten.)');
    return;
  }
  if (!anhaenge.length && jarvisAn && (wort === 'julia' || wort === 'hey julia')) {
    t.value = ''; hoehe();
    julia.jarvisSetzen(false).catch(() => {});
    systemzeile('Zurück im normalen Modus.');
    return;
  }
  if (beschaeftigt) { systemzeile(tx('chat.beschaeftigt')); return; }
  t.value = '';
  hoehe();
  julia.senden(text, anhaenge.map((a) => a.pfad));
  anhaenge = [];
  anhaengeMalen();
}

// Ein gespeichertes Gespräch zum Weiterschreiben laden (aus dem Verlauf).
function gespraechLaden(eintraege) {
  leeren();
  let n = 0;
  for (const e of eintraege || []) {
    const id = `alt-${n++}`;
    if (e.typ === 'nutzer') nutzerNachricht(e.text, false, e.handy, e.anhaenge);
    else if (e.typ === 'julia') { antwortEl = null; juliaText(e.text, true); antwortEl = null; }
    else if (e.typ === 'werkzeug') { werkzeug({ id, name: e.name, eingabe: e.eingabe }); werkzeugFertig({ id, ok: e.stand === 'ok', rot: e.stand === 'rot' }); }
    else if (e.typ === 'freigabe') { freigabe({ ...e, id }); freigabeErledigt({ id, ja: !!e.ja }); }
    else if (e.typ === 'system') systemzeile(e.text, e.fehler ? 'fehler' : '');
  }
  verlauf.scrollTop = verlauf.scrollHeight;
}

function demo(eintraege) {
  if (window.juliaAnsicht) window.juliaAnsicht('chat');
  leeren();
  for (const e of eintraege) {
    if (e.typ === 'nutzer') nutzerNachricht(e.text, false);
    else if (e.typ === 'julia') { antwortEl = null; juliaText(e.text, true); }
    else if (e.typ === 'werkzeug') { const id = 'demo' + Math.random(); werkzeug({ id, name: e.name, eingabe: e.eingabe }); werkzeugFertig({ id, ok: e.ok }); }
    else if (e.typ === 'freigabe') freigabe(e.f);
  }
  verlauf.scrollTop = verlauf.scrollHeight;
}

async function init() {
  $('btnNeu').innerHTML = ICON.neu;
  $('btnEinst').innerHTML = ICON.einst;
  $('btnMikro').innerHTML = ICON.mikro;
  if (imOverlay) {
    julia.config().then((c) => { jarvisAn = !!(c && c.design && c.design.jarvis); overlayStil(c && c.overlay); }).catch(() => { /* Standard bleibt */ });
    $('btnZu').hidden = false;
    $('btnZu').innerHTML = ICON.zu;
    $('btnZu').onclick = () => julia.schliessen();
  }

  // Beide Start-IPCs PARALLEL holen – höchstens ~4 s statt ~8 s nacheinander.
  // Wichtig auf langsamen/degradierten PCs (Issue #3/#54): so steht die Oberfläche
  // früh, bevor der Healthcheck ein „leeres Fenster" meldet und die Selbstheilung
  // eine Neustart-Schleife auslöst. Kein stiller Abbruch – Hänger landen im Log.
  const [stErg, txErg] = await Promise.all([
    mitZeitlimit(julia.status(), 4000, 'Status').catch((e) => { try { julia.melden && julia.melden('start-status', e && e.message); } catch { /* egal */ } return null; }),
    mitZeitlimit(julia.texte(), 4000, 'Texte').catch((e) => { try { julia.melden && julia.melden('start-texte', e && e.message); } catch { /* egal */ } return null; }),
  ]);
  const st = stErg || {};
  hotkey = st.hotkey || '';
  hoert = !!st.hoert;
  beschaeftigt = !!st.beschaeftigt;
  if (txErg && txErg.texte) {
    texteAnwenden(txErg);
    // Auch die generischen Beschriftungen ([data-nav]/[data-t]) mit dem echten
    // Satz füllen – texteAnwenden setzt nur feste IDs. Sonst blieben sie leer,
    // falls die synchrone Füllung beim Laden nicht griff (Issue #3/#54).
    if (window.juliaTexteNach) window.juliaTexteNach();
  } else {
    // Notdarstellung: Oberfläche bleibt bedienbar (fehlt Text, zeigt tx den Schlüssel);
    // die echten Texte im Hintergrund nachladen und ersetzen.
    texteAnwenden({ sprachcode: document.documentElement.lang || 'de', texte: T });
    julia.texte().then((d) => { if (d && d.texte) { texteAnwenden(d); if (window.juliaTexteNach) window.juliaTexteNach(); } }).catch(() => { /* bleibt bei der Notdarstellung */ });
  }
  zustandAnzeigen(st.zustand || 'idle');
  $('btnMikro').classList.toggle('aktiv', hoert);

  $('btnNeu').onclick = () => julia.neu();
  $('btnEinst').onclick = () => julia.einstellungen();
  $('btnMikro').onclick = () => julia.sprechen();
  $('btnSenden').onclick = () => (beschaeftigt ? julia.abbrechen() : absenden());
  $('text').addEventListener('input', hoehe);
  $('text').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      absenden();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (beschaeftigt) julia.abbrechen();
    else julia.schliessen();
  });

  julia.on('agent:nutzer', ({ text, perSprache, handy, anhaenge: liste }) => nutzerNachricht(text, perSprache, handy, liste));

  // Dateien: Büroklammer oder einfach ins Fenster ziehen.
  $('btnAnhang').innerHTML = ICON.klammer;
  $('btnAnhang').onclick = () => $('dateiWahl').click();
  $('dateiWahl').addEventListener('change', () => { dateienHinzu([...$('dateiWahl').files]); $('dateiWahl').value = ''; });
  $('ablegenIcon').innerHTML = ICON.klammer;
  let ziehTiefe = 0;
  const hatDateien = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
  document.addEventListener('dragenter', (e) => { if (!hatDateien(e)) return; e.preventDefault(); ziehTiefe++; $('ablegen').hidden = false; });
  document.addEventListener('dragover', (e) => { if (hatDateien(e)) e.preventDefault(); });
  document.addEventListener('dragleave', () => { ziehTiefe = Math.max(0, ziehTiefe - 1); if (!ziehTiefe) $('ablegen').hidden = true; });
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    ziehTiefe = 0;
    $('ablegen').hidden = true;
    if (!e.dataTransfer || !e.dataTransfer.files.length) return;
    if (window.juliaAnsicht) window.juliaAnsicht('chat');
    dateienHinzu([...e.dataTransfer.files]);
  });
  julia.on('agent:start', () => { denkEl = null; denkBoxAnlegen(); beschaeftigtSetzen(true); });
  julia.on('agent:text', (d) => juliaText(d));
  julia.on('agent:denken', (d) => juliaDenken(d));
  julia.on('agent:werkzeug', werkzeug);
  julia.on('agent:werkzeugFertig', werkzeugFertig);
  julia.on('agent:freigabe', freigabe);
  julia.on('agent:freigabeErledigt', freigabeErledigt);
  julia.on('agent:geheimnisFrage', geheimnisFrage);
  julia.on('agent:geheimnisErledigt', geheimnisErledigt);
  julia.on('agent:fertig', () => { beschaeftigtSetzen(false); antwortEl = null; denkBoxAbschliessen(); $('text').focus(); });
  julia.on('agent:fehler', (e) => systemzeile(e.art === 'kein_schluessel' ? tx('chat.kein_schluessel') : e.text, 'fehler'));
  julia.on('agent:hinweis', (h) => {
    const k = { abgebrochen: 'chat.abgebrochen', beschaeftigt: 'chat.beschaeftigt', verweigert: 'hinweis.verweigert', max_tokens: 'hinweis.max_tokens', zu_viele_runden: 'hinweis.zu_viele_runden', kosten_warnung: 'hinweis.kosten_warnung', nichts_verstanden: 'hinweis.nichts_verstanden' }[h.art];
    if (k) systemzeile(tx(k));
  });
  julia.on('zustand', zustandAnzeigen);
  julia.on('sprache:hoert', (b) => {
    hoert = b;
    $('btnMikro').classList.toggle('aktiv', b);
    zustandAnzeigen(document.body.dataset.zustand || 'idle');
  });
  julia.on('texte:geaendert', texteAnwenden);
  julia.on('config:geaendert', (c) => {
    jarvisAn = !!(c && c.design && c.design.jarvis);
    overlayStil(c && c.overlay);
    if (c.hotkey && c.hotkey.sprechen !== hotkey) {
      hotkey = c.hotkey.sprechen;
      texteAnwenden({ sprachcode: document.documentElement.lang, texte: T });
    }
  });
  julia.on('chat:geleert', leeren);
  julia.on('chat:laden', ({ eintraege, hinweis }) => { gespraechLaden(eintraege); if (hinweis) systemzeile(hinweis); });
  julia.on('erinnerung', ({ text }) => systemzeile(`⏰ ${text}`, 'erinnerung'));
  julia.on('system:zeile', ({ text, art }) => systemzeile(text, art || ''));

  $('text').focus();
}

// Ereignisse, die schon während des Starts eintreffen (Vorführmodus), warten,
// bis Texte und Status geladen sind.
// Selbst wenn init() an einer unerwarteten Stelle scheitert, muss „bereit"
// auflösen – sonst füllt start.js die Navigation/Beschriftungen nie und die
// Oberfläche bliebe leer. Fehler werden gemeldet, nicht verschluckt.
const bereit = init().catch((e) => { try { julia.melden && julia.melden('start-init', e && e.message); } catch { /* egal */ } });

// WICHTIG (Issue #3/#54): Die Beschriftungen SOFORT beim Laden mit mitgelieferten
// Standard-Texten füllen – unabhängig von IPC/Init. Damit ist das Fenster NIE leer,
// auch auf langsamen oder grafiktreiber-zickigen PCs (dort hing die Beschriftung
// bisher an der IPC/Init-Kette, blieb leer → „leeres Fenster" + Neustart-Schleife).
// Den echten Sprach-/Text-Satz vom Hauptprozess spielt init() danach darüber.
function standardTexteSetzen() {
  try {
    const std = julia.standardTexte;
    if (imOverlay || !std) return;
    const sc = String(navigator.language || 'de').toLowerCase().startsWith('en') ? 'en' : 'de';
    const texte = std[sc] && Object.keys(std[sc]).length ? std[sc] : std.de;
    if (!texte || !Object.keys(texte).length) return;
    texteAnwenden({ sprachcode: sc, texte });
    // Beschriftungen DIREKT füllen – unabhängig davon, ob start.js schon bereit ist
    // (garantiert kein „leeres Fenster", egal was in der Init-Kette hakt).
    document.querySelectorAll('[data-nav]').forEach((el) => { if (el.dataset.nav) el.textContent = tx(el.dataset.nav); });
    document.querySelectorAll('[data-t]').forEach((el) => { if (el.dataset.t) el.textContent = tx(el.dataset.t); });
    if (window.juliaTexteNach) window.juliaTexteNach(); // start.js: restliche Startseite füllen
  } catch { /* egal – init füllt später nach */ }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', standardTexteSetzen);
else standardTexteSetzen();

julia.on('demo', (eintraege) => bereit.then(() => demo(eintraege)));
julia.on('overlay:modus', (modus) => bereit.then(() => overlayModus(modus)));
