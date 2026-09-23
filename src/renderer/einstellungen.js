'use strict';

// Einstellungen und Ersteinrichtung. Jede Änderung wird sofort gespeichert und
// wirkt ohne Neustart; nur der API-Schlüssel wird erst mit dem Knopf übernommen.

const $ = (id) => document.getElementById(id);
const einrichtung = new URLSearchParams(location.search).get('einrichtung') === '1';
const ZUSTAENDE = ['idle', 'listening', 'thinking', 'speaking'];
const STANDARDFARBEN = {
  idle: ['#6B5CFF', '#35E0C8'],
  listening: ['#35E0C8', '#FF6F9C'],
  thinking: ['#FFC15E', '#FF6F9C'],
  speaking: ['#FF6F9C', '#6B5CFF'],
};

let T = {};
let cfg = null;
let kontenStand = null;

const AKZENTE = [
  ['glut', '#FF7A1A'],
  ['neon', '#8B5CFF'],
  ['cyber', '#00D1FF'],
  ['toxic', '#39FF88'],
  ['magenta', '#FF3DA5'],
  ['blut', '#FF3B3B'],
  ['gold', '#FFC23D'],
];

const ANLEITUNG = {
  de: 'https://github.com/Morni-Team/julia-ai/blob/main/docs/google-einrichten.md',
  en: 'https://github.com/Morni-Team/julia-ai/blob/main/docs/google-setup.en.md',
};
const ANLEITUNG_OUTLOOK = {
  de: 'https://github.com/Morni-Team/julia-ai/blob/main/docs/outlook-einrichten.md',
  en: 'https://github.com/Morni-Team/julia-ai/blob/main/docs/outlook-setup.en.md',
};

function tx(k, werte) {
  let s = T[k] ?? k;
  if (werte) for (const [a, b] of Object.entries(werte)) s = s.split(`{${a}}`).join(String(b));
  return s;
}

function holen(obj, schluessel) {
  return schluessel.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function texteAnwenden(daten) {
  T = daten.texte;
  document.documentElement.lang = daten.sprachcode;
  document.title = tx('einst.titel');
  document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = tx(el.dataset.t); });
  document.querySelectorAll('[data-tp]').forEach((el) => { el.placeholder = tx(el.dataset.tp); });
  $('speichern').textContent = tx(einrichtung ? 'einst.fertig' : 'einst.speichern');
  if (cfg) {
    monitoreFuellen();
    ordnerZeigen();
    sandboxZeigen();
    farbenZeigen();
    anbieterZeigen();
  }
  $('googleAnleitung').href = ANLEITUNG[daten.sprachcode] || ANLEITUNG.de;
  $('outlookAnleitung').href = ANLEITUNG_OUTLOOK[daten.sprachcode] || ANLEITUNG_OUTLOOK.de;
  if (kontenStand) kontenZeigen(kontenStand);
  if (syncStand) syncZeigen(syncStand);
  if (appStand) appZeigen(appStand);
  if (whisperStand) whisperZeigen(whisperStand);
  if (piperStand) piperZeigen(piperStand);
  if (mcpStand) mcpZeigen(mcpStand);
  if (cfg) designZeigen();
}

// --- Kostenbremse ---

function kostenZeigen(k) {
  const betrag = Number(k && k.usd) || 0;
  const zahl = betrag.toLocaleString(document.documentElement.lang === 'en' ? 'en-GB' : 'de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  $('kostenHeute').textContent = tx('einst.kosten_heute', { usd: zahl, anfragen: (k && k.anfragen) || 0 });
}

// --- Geräte-Abgleich ---

let syncStand = null;

function syncFehlerText(code) {
  const k = `sync.fehler_${code}`;
  const t = tx(k);
  return t !== k ? t : tx('sync.problem', { fehler: code });
}

function syncZeigen(s) {
  syncStand = s;
  $('kontoSync').classList.toggle('verbunden', s.laeuft && s.geraete.length > 0);
  let status = tx('sync.aus');
  if (s.fehler === 'port_belegt') status = tx('sync.fehler_port', { port: cfg ? cfg.sync.port : '' });
  else if (s.fehler) status = s.fehler;
  else if (s.laeuft) status = tx('sync.bereit', { geraet: s.name, n: s.geraete.length });
  $('syncStatus').textContent = status;
  $('syncBereich').hidden = !s.laeuft;
  $('syncAdressen').textContent = s.adressen.length ? tx('sync.adressen', { adressen: s.adressen.join(', ') }) : '';
  const liste = $('syncGeraete');
  liste.innerHTML = '';
  if (!s.geraete.length) {
    const li = document.createElement('li');
    li.className = 'leer';
    li.textContent = tx('sync.keine');
    liste.appendChild(li);
  }
  for (const g of s.geraete) {
    const li = document.createElement('li');
    const text = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = g.name;
    const zeile = document.createElement('small');
    const uhr = g.zuletzt ? new Date(g.zuletzt).toLocaleTimeString(document.documentElement.lang || 'de', { hour: '2-digit', minute: '2-digit' }) : '';
    zeile.textContent = g.fehler ? syncFehlerText(g.fehler) : g.zuletzt ? tx('sync.zuletzt', { zeit: uhr }) : tx('sync.nie');
    text.append(name, zeile);
    const weg = document.createElement('button');
    weg.className = 'zweit';
    weg.textContent = tx('sync.entfernen');
    weg.onclick = async () => syncZeigen(await julia.syncEntfernen(g.id));
    li.append(text, weg);
    liste.appendChild(li);
  }
  $('syncCodeBox').hidden = !s.code;
  $('syncCode').textContent = s.code ? s.code.code : '';
}

function syncMeldung(text, fehler = false) {
  const m = $('syncMeldung');
  m.textContent = text || '';
  m.classList.toggle('fehler', fehler);
}

function syncVerbinden() {
  $('syncCodeZeigen').onclick = async () => {
    syncMeldung('');
    $('syncEingabeBox').hidden = true;
    const r = await julia.syncCode();
    syncZeigen(r.status);
    if (r.fehler) syncMeldung(r.fehler, true);
  };
  $('syncCodeEingeben').onclick = () => {
    syncMeldung('');
    $('syncEingabeBox').hidden = !$('syncEingabeBox').hidden;
    if (!$('syncEingabeBox').hidden) $('syncCodeFeld').focus();
  };
  $('syncVerbinden').onclick = async () => {
    const knopf = $('syncVerbinden');
    knopf.disabled = true;
    syncMeldung(tx('sync.sucht'));
    const r = await julia.syncBeitreten({ code: $('syncCodeFeld').value, adresse: $('syncAdresseFeld').value });
    knopf.disabled = false;
    syncZeigen(r.status);
    if (r.fehler) { syncMeldung(r.fehler, true); return; }
    $('syncCodeFeld').value = '';
    $('syncAdresseFeld').value = '';
    $('syncEingabeBox').hidden = true;
    syncMeldung(tx('sync.gekoppelt', { geraet: r.name }));
  };
  $('syncJetzt').onclick = async () => {
    syncMeldung('');
    syncZeigen(await julia.syncJetzt());
  };
  julia.on('sync:status', syncZeigen);
}

// --- PC-Verbindung für die Android-App ---

let appStand = null;

function appZeigen(s) {
  appStand = s;
  $('kontoApp').classList.toggle('verbunden', s.laeuft && s.gekoppelt);
  let status = tx('app.aus');
  if (s.fehler === 'port_belegt') status = tx('sync.fehler_port', { port: cfg ? cfg.appserver.port : '' });
  else if (s.fehler) status = s.fehler;
  else if (s.laeuft && s.gekoppelt) status = tx('app.gekoppelt');
  else if (s.laeuft) status = tx('app.bereit');
  $('appStatus').textContent = status;
  $('appBereich').hidden = !s.laeuft;
  $('appTrennen').hidden = !s.gekoppelt;
  $('appKoppeln').textContent = tx(s.gekoppelt ? 'app.neu_koppeln' : 'app.koppeln');
  $('appAdressen').textContent = s.adressen && s.adressen.length ? tx('app.adressen', { adressen: s.adressen.join('  ·  ') }) : '';
  const codeOffen = s.koppelnBis && s.koppelnBis > Date.now();
  $('appCodeBox').hidden = !codeOffen;
}

function appMeldung(text, fehler = false) {
  const m = $('appMeldung');
  m.textContent = text || '';
  m.classList.toggle('fehler', fehler);
}

function appVerbinden() {
  $('appKoppeln').onclick = async () => {
    appMeldung('');
    const r = await julia.appserverKoppeln();
    appZeigen(r.status);
    if (r.fehler) { appMeldung(r.fehler, true); return; }
    $('appCode').textContent = r.code;
    $('appCodeBox').hidden = false;
  };
  $('appTrennen').onclick = async () => { appZeigen(await julia.appserverTrennen()); appMeldung(''); };
  julia.on('appserver:status', appZeigen);
}

// --- Design ---

function mischen(hex, ziel, anteil) {
  const a = parseInt(hex.slice(1), 16);
  const b = parseInt(ziel.slice(1), 16);
  const kanal = (x, s) => (x >> s) & 255;
  const m = (s) => Math.round(kanal(a, s) + (kanal(b, s) - kanal(a, s)) * anteil);
  return '#' + [16, 8, 0].map((s) => m(s).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function designZeigen() {
  const d = cfg.design;
  document.querySelectorAll('#modus button').forEach((b) => b.classList.toggle('aktiv', b.dataset.wert === d.modus));
  const box = $('akzente');
  box.innerHTML = '';
  const gleich = (a, b) => String(a).toUpperCase() === String(b).toUpperCase();
  for (const [name, hex] of AKZENTE) {
    const b = document.createElement('button');
    b.className = 'akzent-knopf' + (gleich(hex, d.akzent) ? ' aktiv' : '');
    b.style.setProperty('--farbe', hex);
    const muster = document.createElement('i');
    muster.style.background = hex;
    const text = document.createElement('span');
    text.textContent = tx(`design.p.${name}`);
    b.append(muster, text);
    b.onclick = () => akzentSetzen(hex);
    box.appendChild(b);
  }
  const eigen = document.createElement('label');
  const istEigen = !AKZENTE.some(([, h]) => gleich(h, d.akzent));
  eigen.className = 'akzent-knopf akzent-eigen' + (istEigen ? ' aktiv' : '');
  eigen.style.setProperty('--farbe', d.akzent);
  const muster = document.createElement('i');
  const text = document.createElement('span');
  text.textContent = tx('design.eigene');
  const waehler = document.createElement('input');
  waehler.type = 'color';
  waehler.value = d.akzent.toLowerCase();
  waehler.addEventListener('input', () => window.juliaDesign.setzen({ akzent: waehler.value }));
  waehler.addEventListener('change', () => akzentSetzen(waehler.value));
  eigen.append(muster, text, waehler);
  box.appendChild(eigen);
}

async function akzentSetzen(hex) {
  const r = await setzen('design.akzent', hex);
  if (!r.fehler) {
    cfg.design.akzent = r.wert;
    designZeigen();
  }
}

function designVerbinden() {
  document.querySelectorAll('#modus button').forEach((b) => {
    b.onclick = async () => {
      const r = await setzen('design.modus', b.dataset.wert);
      if (!r.fehler) { cfg.design.modus = r.wert; designZeigen(); }
    };
  });
  // Blasenfarben aus der Akzentfarbe ableiten, damit alles zusammenpasst.
  $('blaseAkzent').onclick = async () => {
    const a = cfg.design.akzent;
    const farben = {
      idle: [a, mischen(a, '#1A1030', 0.55)],
      listening: [mischen(a, '#FFFFFF', 0.25), '#FF6F9C'],
      thinking: [mischen(a, '#FFC15E', 0.4), a],
      speaking: [a, mischen(a, '#FFFFFF', 0.45)],
    };
    const r = await setzen('blase.farben', farben);
    if (!r.fehler) { cfg.blase.farben = r.wert; farbenZeigen(); }
  };
}

function fehlerZeigen(el, text) {
  const behaelter = el.closest('.feld, .regler, .farbe') || el.parentElement;
  let f = behaelter.querySelector('.fehler');
  if (!text) { if (f) f.remove(); return; }
  if (!f) {
    f = document.createElement('small');
    f.className = 'fehler';
    behaelter.appendChild(f);
  }
  f.textContent = text;
}

async function setzen(schluessel, wert, el) {
  const r = await julia.setzen(schluessel, wert);
  if (el) fehlerZeigen(el, r.fehler);
  return r;
}

function wertLesen(el) {
  if (el.type === 'checkbox') return el.checked;
  if ('zahl' in el.dataset) return Number(el.value);
  return el.value;
}

function ausgabe(el) {
  const out = el.parentElement.querySelector('output');
  if (out) out.textContent = el.value;
}

function felderFuellen() {
  document.querySelectorAll('[data-k]').forEach((el) => {
    const w = holen(cfg, el.dataset.k);
    if (el.type === 'checkbox') el.checked = !!w;
    else if (w != null) el.value = Array.isArray(w) ? w.join('\n') : String(w); // Listen: eins pro Zeile
    if (el.type === 'range') ausgabe(el);
  });
}

function felderVerbinden() {
  document.querySelectorAll('[data-k]').forEach((el) => {
    const freigabe = { 'freigabe.immer': julia.alleFreigeben, 'freigabe.fremd': julia.fremdFreigeben }[el.dataset.k];
    if (freigabe) {
      // Einschalten nur über die Rückfrage im Hauptprozess.
      el.addEventListener('change', async () => { el.checked = !!(await freigabe(el.checked)).wert; });
      return;
    }
    if (el.type === 'range') {
      el.addEventListener('input', () => {
        ausgabe(el);
        if ('live' in el.dataset) setzen(el.dataset.k, wertLesen(el), el);
      });
    }
    el.addEventListener('change', async () => {
      const r = await setzen(el.dataset.k, wertLesen(el), el);
      if (!r.fehler && el.dataset.k === 'sprachcode') texteAnwenden(await julia.texte());
    });
  });
}

// Monitorauswahl für Blase und Overlay.
function monitoreFuellen() {
  for (const [id, gewaehlt] of [['monitor', cfg.blase.monitor], ['overlayMonitor', cfg.overlay.monitor]]) {
    const sel = $(id);
    sel.innerHTML = '';
    const liste = cfg.monitore.map((m) => ({ i: m.index, text: `${m.index === 0 ? tx('monitor.0') : tx('monitor.n', { n: m.index + 1 })} · ${m.breite}×${m.hoehe}` }));
    if (!liste.some((m) => m.i === gewaehlt)) liste.push({ i: gewaehlt, text: `${tx('monitor.n', { n: gewaehlt + 1 })} · –` });
    for (const m of liste) {
      const o = document.createElement('option');
      o.value = String(m.i);
      o.textContent = m.text;
      sel.appendChild(o);
    }
    sel.value = String(gewaehlt);
  }
}

function betaEinrichten() {
  const eingabe = $('betaBestaetigung');
  const schalter = ['betaSelbstcode', 'betaAgenten'].map((id) => $(id)).filter(Boolean);
  if (!eingabe || !schalter.length) return;
  const phrase = () => tx('einst.beta_phrase');
  const schonAn = (id) => !!(cfg.beta && cfg.beta[id]);
  // Ein schon aktiver Schalter bleibt bedienbar (zum Ausschalten); sonst erst
  // freigeben, wenn der Nutzer die Bestätigung exakt ausschreibt.
  for (const cb of schalter) cb.disabled = !schonAn(cb.dataset.k.split('.')[1]);
  eingabe.placeholder = phrase();
  eingabe.addEventListener('input', () => {
    const passt = eingabe.value.trim() === phrase().trim();
    for (const cb of schalter) cb.disabled = !passt && !cb.checked;
  });
}

async function geheimZeigen() {
  const ul = $('geheimListe');
  if (!ul) return;
  let namen;
  try { namen = await julia.geheimnisse(); } catch { return; }
  ul.innerHTML = '';
  if (!namen.length) {
    const li = document.createElement('li');
    li.className = 'leer';
    li.textContent = '–';
    ul.appendChild(li);
    return;
  }
  for (const name of namen) {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = name;
    span.title = name;
    const b = document.createElement('button');
    b.textContent = tx('einst.entfernen');
    b.onclick = async () => { const r = await julia.geheimnisLoeschen(name); if (r && r.namen) geheimZeigen(); };
    li.append(span, b);
    ul.appendChild(li);
  }
}

async function geheimSpeichern() {
  const name = $('geheimName').value.trim();
  const wert = $('geheimWert').value;
  if (!name || !wert) return;
  const r = await julia.geheimnisSetzen(name, wert);
  if (r && r.fehler) { $('geheimName').title = r.fehler; return; }
  $('geheimName').value = '';
  $('geheimName').title = '';
  $('geheimWert').value = '';
  geheimZeigen();
}

async function kategorienZeigen() {
  const box = $('kategorienListe');
  if (!box) return;
  let liste;
  try { liste = await julia.werkzeugKategorien(); } catch { return; }
  box.innerHTML = '';
  for (const k of liste) {
    const l = document.createElement('label');
    l.className = 'schalter werkzeug-schalter';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = k.an !== false;
    cb.dataset.id = k.id;
    const span = document.createElement('span');
    span.textContent = `${tx(`einst.kat_${k.id}`)}${k.anzahl ? ` (${k.anzahl})` : ''}`;
    cb.addEventListener('change', async () => {
      const aus = [...box.querySelectorAll('input[type="checkbox"]')].filter((c) => !c.checked).map((c) => c.dataset.id);
      const r = await setzen('kategorien_aus', aus);
      if (r.fehler) cb.checked = !cb.checked;
    });
    l.append(cb, span);
    box.appendChild(l);
  }
}

async function werkzeugeZeigen() {
  const box = $('werkzeugeListe');
  if (!box) return;
  let liste;
  try { liste = await julia.werkzeuge(); } catch { return; }
  box.innerHTML = '';
  for (const w of liste) {
    const l = document.createElement('label');
    l.className = 'schalter werkzeug-schalter';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = w.an !== false;
    cb.dataset.name = w.name;
    const span = document.createElement('span');
    span.innerHTML = `<code>${w.name}</code>${w.beschreibung ? ` – ${w.beschreibung}` : ''}`;
    cb.addEventListener('change', async () => {
      const aus = [...box.querySelectorAll('input[type="checkbox"]')].filter((c) => !c.checked).map((c) => c.dataset.name);
      const r = await setzen('werkzeuge_aus', aus);
      if (r.fehler) cb.checked = !cb.checked; // bei Fehler zurückdrehen
    });
    l.append(cb, span);
    box.appendChild(l);
  }
}

function sandboxZeigen() {
  const el = $('sandboxOrdner');
  if (!el) return;
  const o = cfg.sandbox && cfg.sandbox.ordner;
  el.textContent = o || tx('einst.sandbox_kein_ordner');
  el.title = o || '';
}

function ordnerZeigen() {
  const ul = $('ordnerListe');
  ul.innerHTML = '';
  if (!cfg.arbeitsverzeichnisse.length) {
    const li = document.createElement('li');
    li.className = 'leer';
    li.textContent = '–';
    ul.appendChild(li);
  }
  cfg.arbeitsverzeichnisse.forEach((p, i) => {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = p;
    span.title = p;
    const b = document.createElement('button');
    b.textContent = tx('einst.entfernen');
    b.onclick = async () => {
      const neu = cfg.arbeitsverzeichnisse.filter((_, j) => j !== i);
      const r = await setzen('arbeitsverzeichnisse', neu);
      if (!r.fehler) { cfg.arbeitsverzeichnisse = r.wert; ordnerZeigen(); }
    };
    li.append(span, b);
    ul.appendChild(li);
  });
}

function farbenZeigen() {
  const box = $('farben');
  box.innerHTML = '';
  for (const z of ZUSTAENDE) {
    const zeile = document.createElement('div');
    zeile.className = 'farbe';
    const name = document.createElement('span');
    name.className = 'zname';
    name.textContent = tx(`zustand.${z}`);
    const muster = document.createElement('span');
    muster.className = 'muster';
    const input = document.createElement('input');
    input.value = cfg.blase.farben[z].join(', ');
    input.spellcheck = false;
    const malen = (liste) => {
      muster.innerHTML = '';
      for (const f of liste) {
        const i = document.createElement('i');
        i.style.background = f;
        muster.appendChild(i);
      }
    };
    malen(cfg.blase.farben[z]);
    input.addEventListener('change', async () => {
      const r = await setzen(`blase.farben.${z}`, input.value, input);
      if (!r.fehler) { cfg.blase.farben[z] = r.wert; input.value = r.wert.join(', '); malen(r.wert); }
    });
    zeile.append(name, muster, input);
    box.appendChild(zeile);
  }
}

function schluesselHinweis() {
  $('schluesselHinweis').textContent = cfg.schluesselGesetzt ? tx('einst.schluessel_gesetzt') : tx('einst.schluessel_hinweis');
}

// --- KI-Anbieter ---

function aktuellerAnbieter() {
  const liste = cfg.anbieterListe || [];
  return liste.find((a) => a.id === cfg.anbieter) || liste[0] || { id: 'anthropic', art: 'anthropic', modelle: [], brauchtSchluessel: true };
}

function modelleZeigen(modelle) {
  const dl = $('modelle');
  dl.innerHTML = '';
  for (const m of modelle || []) {
    const o = document.createElement('option');
    o.value = m;
    dl.appendChild(o);
  }
}

function anbieterZeigen() {
  const sel = $('anbieter');
  sel.innerHTML = '';
  for (const a of cfg.anbieterListe || []) {
    const o = document.createElement('option');
    o.value = a.id;
    o.textContent = a.id === 'claude-abo' ? tx('einst.anbieter_abo') : a.name;
    sel.appendChild(o);
  }
  sel.value = cfg.anbieter;
  const a = aktuellerAnbieter();
  $('anbieterUrlFeld').hidden = !a.eigeneUrl;
  $('schluesselFeld').hidden = !(a.brauchtSchluessel || a.eigeneUrl);
  $('schluesselLabel').textContent = tx('einst.schluessel', { anbieter: a.name || '' });
  $('schluessel').placeholder = a.schluessel || '';
  $('schluesselSeite').hidden = !a.seite;
  if (a.seite) $('schluesselSeite').href = a.seite;
  // Denkaufwand jetzt auch für OpenAI-kompatible Anbieter zeigen (Issue #79):
  // wird als reasoning_effort mitgeschickt; kennt ein Modell den Parameter nicht,
  // lässt Julia ihn für dieses Modell automatisch wieder weg.
  $('aufwandFeld').hidden = !(a.art === 'anthropic' || a.art === 'claude-code' || a.art === 'openai');
  const hinweis = a.id === 'claude-abo' ? 'einst.abo_hinweis' : a.lokal ? 'einst.lokal_hinweis' : a.art === 'openai' ? 'einst.fremd_hinweis' : '';
  $('anbieterHinweis').hidden = !hinweis;
  $('anbieterHinweis').textContent = hinweis ? tx(hinweis) : '';
  $('modelleMeldung').textContent = '';
  modelleZeigen(a.modelle);
  schluesselHinweis();
}

function anbieterVerbinden() {
  $('anbieter').addEventListener('change', async () => {
    const r = await julia.anbieterSetzen($('anbieter').value);
    cfg = { ...cfg, ...r.config };
    felderFuellen();
    anbieterZeigen();
    if (r.fehler) melden(r.fehler, true);
  });
  $('modelleLaden').addEventListener('click', async (e) => {
    e.preventDefault();
    $('modelleMeldung').textContent = '…';
    const r = await julia.modelleLaden();
    if (r.fehler) {
      $('modelleMeldung').textContent = r.fehler;
      return;
    }
    modelleZeigen(r.modelle);
    $('modelleMeldung').textContent = tx('einst.modelle_geladen', { anzahl: r.modelle.length });
  });
}

// Stimmen: oben die natürlichen (Piper, lokal), darunter die Windows-Stimmen.
async function stimmenLaden() {
  const sel = $('stimme');
  const [stimmen, p] = await Promise.all([julia.stimmen(), julia.piperStatus()]);
  sel.innerHTML = '';
  const aktuell = cfg.sprache.stimme;
  const gruppe = (label) => {
    const g = document.createElement('optgroup');
    g.label = label;
    sel.appendChild(g);
    return g;
  };
  const natuerlich = gruppe(tx('piper.gruppe'));
  for (const s of p.stimmen) {
    const o = document.createElement('option');
    o.value = `piper:${s.id}`;
    o.textContent = `${s.name} – ${tx(s.geschlecht === 'w' ? 'piper.weiblich' : 'piper.maennlich')}, ${s.sprache === 'de' ? 'Deutsch' : 'English'}`;
    natuerlich.appendChild(o);
  }
  const windows = gruppe(tx('piper.gruppe_windows'));
  if (!aktuell.startsWith('piper:') && !stimmen.some((s) => s.name === aktuell)) stimmen.unshift({ name: aktuell, kultur: '?' });
  for (const s of stimmen) {
    const o = document.createElement('option');
    o.value = s.name;
    o.textContent = `${s.name.replace(/^Microsoft /, '').replace(/ Desktop$/, '')} (${s.kultur})`;
    windows.appendChild(o);
  }
  sel.value = aktuell;
  piperZeigen(p);
}

let piperStand = null;

function piperZeigen(s) {
  piperStand = s;
  const wert = $('stimme').value || '';
  $('piperZeile').hidden = !wert.startsWith('piper:');
  if (!wert.startsWith('piper:')) return;
  const st = s.stimmen.find((x) => `piper:${x.id}` === wert) || { mb: 0, bereit: false };
  let text;
  let knopf = '';
  if (s.laedt) {
    text = tx('piper.laedt', { prozent: Math.floor((s.laedt.geladen / s.laedt.gesamt) * 100), mb: Math.round(s.laedt.gesamt / 1e6) });
    knopf = 'abbrechen';
  } else if (st.bereit) text = tx('piper.bereit_status');
  else {
    text = s.fehler ? tx('piper.fehler_laden', { fehler: s.fehler }) : tx('piper.fehlt', { mb: st.mb });
    knopf = 'laden';
  }
  $('piperStatus').textContent = text;
  const b = $('piperLaden');
  b.hidden = !knopf;
  b.dataset.art = knopf;
  b.textContent = knopf === 'abbrechen' ? tx('piper.abbrechen') : tx('piper.laden', { mb: st.mb });
}

function piperVerbinden() {
  julia.on('piper:status', piperZeigen);
  $('stimme').addEventListener('change', () => { if (piperStand) piperZeigen(piperStand); });
  $('piperLaden').onclick = async () => {
    piperZeigen($('piperLaden').dataset.art === 'abbrechen' ? await julia.piperAbbrechen() : await julia.piperLaden());
  };
}

// Mikrofon und Lautsprecher: "Windows-Standard" oder ein bestimmtes Gerät.
async function geraeteLaden() {
  const g = await julia.audioGeraete();
  $('audioHinweis').textContent = g.fehler ? tx('einst.audio_fehler', { fehler: g.fehler }) : '';
  for (const [id, liste, schluessel] of [['mikrofon', g.eingaenge, 'mikrofon'], ['lautsprecher', g.ausgaenge, 'lautsprecher']]) {
    const sel = $(id);
    const aktuell = cfg.sprache[schluessel] || '';
    sel.innerHTML = '';
    const optionen = [['', tx('einst.standardgeraet')], ...liste.map((n) => [n, n])];
    if (aktuell && !liste.includes(aktuell)) optionen.push([aktuell, `${aktuell} ${tx('einst.nicht_verbunden')}`]);
    for (const [wert, text] of optionen) {
      const o = document.createElement('option');
      o.value = wert;
      o.textContent = text;
      sel.appendChild(o);
    }
    sel.value = aktuell;
  }
}

function melden(text, fehler = false) {
  const m = $('meldung');
  m.textContent = text;
  m.classList.toggle('fehler', fehler);
}

async function speichern() {
  const name = $('name').value.trim();
  const schluessel = $('schluessel').value.trim();
  if (name) await setzen('nutzer.name', name, $('name'));
  if (schluessel) {
    const r = await julia.schluesselSetzen(schluessel);
    if (r.fehler) { melden(r.fehler, true); return; }
    $('schluessel').value = '';
  }
  cfg = await julia.config();
  schluesselHinweis();
  if (einrichtung) {
    if (!name) { melden(tx('einst.fehlt_name'), true); $('name').focus(); return; }
    if (!cfg.bereit) {
      const a = aktuellerAnbieter();
      if (a.eigeneUrl && !cfg.anbieter_url) { melden(tx('einst.fehlt_url'), true); $('anbieterUrl').focus(); return; }
      if (a.id === 'claude-abo') { melden(tx('einst.fehlt_claude'), true); return; }
      melden(tx('einst.fehlt_schluessel'), true);
      $('schluessel').focus();
      return;
    }
    await julia.einrichtungFertig();
    return;
  }
  melden(tx('einst.gespeichert'));
  setTimeout(() => julia.schliessen(), 600);
}

// --- Verbindungen ---

// Mit eingebauter Outlook-ID bleibt das Feld für eine eigene ID versteckt,
// bis man es ausdrücklich öffnet.
let outlookEigene = false;

function kontenZeigen(status) {
  kontenStand = status;
  const g = status.google;
  $('kontoGoogle').classList.toggle('verbunden', g.verbunden);
  $('googleStatus').textContent = g.verbunden ? tx('konten.verbunden_als', { email: g.email || '?' }) : tx('konten.nicht_verbunden');
  $('googleTrennen').hidden = !g.verbunden;
  $('googleEinrichten').hidden = g.verbunden;
  if (g.clientId && !$('googleClientId').value) $('googleClientId').value = g.clientId;
  $('googleSecretHinweis').textContent = g.clientIdGesetzt ? tx('konten.secret_gespeichert') : '';
  const o = status.outlook;
  if (o) {
    $('kontoOutlook').classList.toggle('verbunden', o.verbunden);
    $('outlookStatus').textContent = o.verbunden ? tx('konten.verbunden_als', { email: o.email || '?' }) : tx('konten.nicht_verbunden');
    $('outlookTrennen').hidden = !o.verbunden;
    $('outlookEinrichten').hidden = o.verbunden;
    if (o.clientId && !$('outlookClientId').value) $('outlookClientId').value = o.clientId;
    const einfach = o.eingebaut && !o.clientIdGesetzt && !outlookEigene;
    $('outlookText').textContent = tx(o.eingebaut ? 'konten.outlook_text_einfach' : 'konten.outlook_text');
    $('outlookIdFeld').hidden = einfach;
    $('outlookEigeneId').hidden = !einfach;
  }
}

function kontoMeldung(text, fehler = false, id = 'googleMeldung') {
  const m = $(id);
  m.textContent = text || '';
  m.classList.toggle('fehler', fehler);
}

function kontenVerbinden() {
  $('googleVerbinden').onclick = async () => {
    const knopf = $('googleVerbinden');
    knopf.disabled = true;
    kontoMeldung(tx('konten.warte_browser'));
    const r = await julia.googleVerbinden({
      clientId: $('googleClientId').value.trim(),
      clientSecret: $('googleClientSecret').value.trim(),
    });
    knopf.disabled = false;
    $('googleClientSecret').value = '';
    kontenZeigen(r.status);
    kontoMeldung(r.fehler || '', !!r.fehler);
  };
  $('googleTrennen').onclick = async () => {
    const r = await julia.googleTrennen();
    kontenZeigen(r.status);
    kontoMeldung(r.fehler || '', !!r.fehler);
  };
  $('outlookVerbinden').onclick = async () => {
    const knopf = $('outlookVerbinden');
    knopf.disabled = true;
    kontoMeldung(tx('konten.warte_browser'), false, 'outlookMeldung');
    const r = await julia.outlookVerbinden({ clientId: $('outlookClientId').value.trim() });
    knopf.disabled = false;
    kontenZeigen(r.status);
    kontoMeldung(r.fehler || '', !!r.fehler, 'outlookMeldung');
  };
  $('outlookEigeneId').onclick = (e) => {
    e.preventDefault();
    outlookEigene = true;
    if (kontenStand) kontenZeigen(kontenStand);
    $('outlookClientId').focus();
  };
  $('outlookTrennen').onclick = async () => {
    const r = await julia.outlookTrennen();
    kontenZeigen(r.status);
    kontoMeldung(r.fehler || '', !!r.fehler, 'outlookMeldung');
  };
}

// MCP-Server: anschließen, ein- und ausschalten, Status und Werkzeuge sehen.
let mcpStand = null;

function mcpKnopf(text, klick, klasse = 'zweit') {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = klasse;
  b.textContent = text;
  b.onclick = klick;
  return b;
}

function mcpZeigen(liste) {
  mcpStand = liste;
  const bereit = liste.filter((s) => s.zustand === 'bereit');
  $('mcpStatus').textContent = liste.length
    ? tx('mcp.status', { n: bereit.length, gesamt: liste.length, w: bereit.reduce((a, s) => a + s.werkzeuge, 0) })
    : tx('mcp.keiner');
  const ul = $('mcpListe');
  ul.replaceChildren();
  for (const s of liste) {
    const li = document.createElement('li');
    const kopf = document.createElement('div');
    kopf.className = 'mcp-kopf';
    const name = document.createElement('b');
    name.textContent = s.name;
    const zustand = document.createElement('small');
    zustand.className = `mcp-zustand ${s.zustand}`;
    zustand.textContent = s.zustand === 'bereit' ? tx('mcp.bereit', { n: s.werkzeuge })
      : s.zustand === 'fehler' ? tx('mcp.fehler', { fehler: s.fehler || '?' }) : tx(`mcp.z_${s.zustand}`);
    kopf.append(name, zustand);
    const was = document.createElement('small');
    was.className = 'mcp-was';
    was.textContent = s.art === 'http' ? s.url : s.befehl;
    const knoepfe = document.createElement('div');
    knoepfe.className = 'mcp-knoepfe';
    const schalter = document.createElement('label');
    schalter.className = 'schalter';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = s.an;
    cb.onchange = async () => mcpZeigen(await julia.mcpSchalten(s.id, cb.checked));
    const an = document.createElement('span');
    an.textContent = tx('mcp.an');
    schalter.append(cb, an);
    knoepfe.append(
      schalter,
      mcpKnopf(tx('mcp.neu_starten'), async () => mcpZeigen(await julia.mcpNeu(s.id))),
      mcpKnopf(tx('mcp.entfernen'), async () => {
        if (!confirm(tx('mcp.entfernen_frage', { server: s.name }))) return;
        mcpZeigen(await julia.mcpEntfernen(s.id));
      }),
    );
    li.append(kopf, was, knoepfe);
    if (s.zustand === 'bereit' && s.namen.length) {
      const w = document.createElement('small');
      w.className = 'mcp-werkzeuge';
      w.textContent = s.namen.join(' · ');
      li.append(w);
    }
    ul.append(li);
  }
}

function mcpVerbinden() {
  julia.on('mcp:status', mcpZeigen);
  $('mcpArt').onchange = () => {
    const netz = $('mcpArt').value === 'http';
    $('mcpBefehlFeld').hidden = netz;
    $('mcpUrlFeld').hidden = !netz;
    $('mcpUmgebungLabel').textContent = tx(netz ? 'mcp.kopfzeilen' : 'mcp.umgebung');
    $('mcpUmgebung').placeholder = netz ? 'Authorization=Bearer …' : 'GITHUB_PERSONAL_ACCESS_TOKEN=…';
  };
  $('mcpHinzufuegen').onclick = async () => {
    const m = $('mcpMeldung');
    m.textContent = '';
    m.classList.remove('fehler');
    const r = await julia.mcpHinzufuegen({
      name: $('mcpName').value, art: $('mcpArt').value, befehl: $('mcpBefehl').value, url: $('mcpUrl').value,
      umgebung: $('mcpUmgebung').value, vertraut: $('mcpVertraut').checked,
    });
    mcpZeigen(r.status);
    if (r.fehler) { m.textContent = r.fehler; m.classList.add('fehler'); return; }
    for (const id of ['mcpName', 'mcpBefehl', 'mcpUrl', 'mcpUmgebung']) $(id).value = '';
    $('mcpVertraut').checked = false;
    m.textContent = tx('mcp.hinzugefuegt');
  };

  // Drag-and-Drop einer mcp.json (Issue #75): Datei draufziehen oder anklicken →
  // die enthaltenen Server werden erkannt und übernommen (über die Ampel).
  const drop = $('mcpDrop');
  const datei = $('mcpDatei');
  const meld = $('mcpImportMeldung');
  if (drop && datei && meld) {
    const importiere = async (text) => {
      meld.classList.remove('fehler');
      const r = await julia.mcpImport(text);
      if (r && r.status) mcpZeigen(r.status);
      if (r && r.fehler && !r.anzahl) { meld.textContent = r.fehler; meld.classList.add('fehler'); return; }
      const teile = [tx('mcp.import_ok', { n: (r && r.anzahl) || 0 })];
      if (r && r.fehler && r.fehler.length) teile.push(r.fehler.join(' · '));
      meld.textContent = teile.join(' — ');
    };
    const ausDatei = (f) => { if (!f) return; const leser = new FileReader(); leser.onload = () => importiere(String(leser.result || '')); leser.readAsText(f); };
    drop.onclick = () => datei.click();
    datei.onchange = () => { ausDatei(datei.files && datei.files[0]); datei.value = ''; };
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('drueber'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('drueber'));
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      drop.classList.remove('drueber');
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      ausDatei(f);
    });
  }
}


// Grafik-Reparatur (Issue #55): auf Software-Grafik umstellen (gegen ein leeres
// Fenster) und neu starten – bzw. wieder normale Grafik versuchen.
async function reparaturEinrichten() {
  const knopf = $('reparaturKnopf');
  const status = $('reparaturStatus');
  if (!knopf) return;
  let stand = { software: false };
  try { stand = await julia.reparaturStatus(); } catch { /* Standard: normal */ }
  const software = !!stand.software;
  const malen = () => {
    const basis = tx(software ? 'einst.reparatur_status_software' : 'einst.reparatur_status_normal');
    // Bei einer automatisch gewählten Zwischenstufe der Fallback-Leiter den Modus dazu.
    const extra = stand.modus && !['normal', 'software'].includes(stand.modus) ? ` (${stand.modus})` : '';
    status.textContent = basis + extra;
    knopf.textContent = tx(software ? 'einst.reparatur_normal' : 'einst.reparatur_software');
  };
  malen();
  // Treiber-Hinweis nur zeigen, wenn die Grafik degradiert wirkt oder wir schon im
  // Software-Modus sind – und der Hersteller bekannt ist. Kein Auto-Install, nur Link.
  const tf = $('reparaturTreiber');
  if (tf && stand.treiber && stand.treiber.url && (stand.degradiert || software)) {
    tf.hidden = false;
    tf.textContent = `${tx('einst.reparatur_treiber', { hersteller: stand.treiber.vendor })} `;
    const a = document.createElement('a');
    a.href = '#';
    a.textContent = tx('einst.reparatur_treiber_link');
    a.onclick = (e) => { e.preventDefault(); julia.reparaturTreiber(stand.treiber.url); };
    tf.appendChild(a);
  }
  knopf.onclick = async () => {
    const ziel = !software;
    if (!confirm(tx(ziel ? 'einst.reparatur_frage_software' : 'einst.reparatur_frage_normal'))) return;
    knopf.disabled = true;
    try { await julia.reparaturSoftware(ziel); } catch { knopf.disabled = false; }
    // Julia startet gleich neu; nichts weiter nötig.
  };
}

// Defender-Ausnahme (Issue #97): hilft gegen „Datei in Benutzung"/„kein Zugriff"
// beim Auto-Update. Nur unter Windows sichtbar; braucht Adminrechte (UAC).
async function defenderEinrichten() {
  const feld = $('defenderFeld');
  const knopf = $('defenderKnopf');
  const status = $('defenderStatus');
  if (!feld || !knopf || !julia.defenderStatus) return;
  let stand = { verfuegbar: false, ausgeschlossen: false };
  try { stand = await julia.defenderStatus(); } catch { /* kein Windows/Defender */ }
  if (!stand.verfuegbar) { feld.hidden = true; return; }
  feld.hidden = false;
  const malen = () => {
    status.textContent = tx(stand.ausgeschlossen ? 'einst.defender_aktiv' : 'einst.defender_inaktiv');
    knopf.disabled = !!stand.ausgeschlossen;
  };
  malen();
  knopf.onclick = async () => {
    knopf.disabled = true;
    const r = await julia.defenderAusschliessen();
    if (r && r.ok) { stand.ausgeschlossen = true; malen(); }
    else { alert((r && r.fehler) || tx('einst.defender_fehler')); knopf.disabled = false; }
  };
}

// Agenten-Rollen (Issue #58, BETA): benannte Rollen mit Zusatz-Anweisung anlegen,
// die aktive auswählen. Nur sichtbar, wenn BETA-Agenten an ist.
async function rollenEinrichten() {
  const bereich = $('rollenBereich');
  if (!bereich) return;
  let stand = { an: false, rollen: [], aktiv: '' };
  try { stand = await julia.rollenLesen(); } catch { /* Standard */ }

  const malen = () => {
    bereich.hidden = !stand.an;
    const sel = $('rolleAktiv');
    sel.innerHTML = `<option value="">${esc(tx('einst.rolle_keine'))}</option>`
      + stand.rollen.map((r) => `<option value="${esc(r.name)}"${r.name === stand.aktiv ? ' selected' : ''}>${esc(r.name)}</option>`).join('');
    const ul = $('rollenListe');
    ul.innerHTML = stand.rollen.map((r, i) => `<li><div class="rl-text"><b>${esc(r.name)}</b><small>${esc(r.anweisung.slice(0, 120))}${r.anweisung.length > 120 ? '…' : ''}</small></div><button class="klein" data-i="${i}">${esc(tx('einst.rolle_entfernen'))}</button></li>`).join('')
      || `<li class="hinweis">${esc(tx('einst.rolle_keine_da'))}</li>`;
    ul.querySelectorAll('button[data-i]').forEach((b) => { b.onclick = () => speichern(stand.rollen.filter((_, j) => j !== Number(b.dataset.i)), stand.aktiv); });
  };

  const speichern = async (rollen, aktiv) => {
    const r = await julia.rollenSpeichern(rollen, aktiv);
    const m = $('rolleMeldung');
    if (r && r.fehler) { m.textContent = r.fehler; m.classList.add('fehler'); return; }
    m.textContent = ''; m.classList.remove('fehler');
    stand.rollen = (r && r.rollen) || rollen; stand.aktiv = (r && r.aktiv) || '';
    malen();
  };

  $('rolleAktiv').onchange = (e) => speichern(stand.rollen, e.target.value);
  $('rolleHinzufuegen').onclick = () => {
    const name = $('rolleName').value.trim();
    const anweisung = $('rolleAnweisung').value.trim();
    if (!name || !anweisung) { const m = $('rolleMeldung'); m.textContent = tx('einst.rolle_unvollstaendig'); m.classList.add('fehler'); return; }
    speichern([...stand.rollen, { name, anweisung }], stand.aktiv);
    $('rolleName').value = ''; $('rolleAnweisung').value = '';
  };
  // Der BETA-Agenten-Schalter zeigt/versteckt den Bereich sofort.
  const toggle = $('betaAgenten');
  if (toggle) toggle.addEventListener('change', () => { stand.an = toggle.checked; malen(); });
  malen();
}

// Whisper: genaue Spracherkennung auf diesem PC – Status und einmaliger Download.
let whisperStand = null;

function whisperZeigen(s) {
  whisperStand = s;
  const an = s.erkennung === 'whisper';
  $('whisperModell').disabled = !an;
  const m = s.modelle[s.stufe] || { bereit: false, mb: 0 };
  let text;
  let knopf = '';
  if (!an) text = tx('whisper.aus');
  else if (!s.programm) text = tx('whisper.kein_programm');
  else if (s.laedt) {
    text = tx('whisper.laedt', { prozent: Math.floor((s.laedt.geladen / s.laedt.gesamt) * 100), mb: Math.round(s.laedt.gesamt / 1e6) });
    knopf = 'abbrechen';
  } else if (m.bereit) text = tx('whisper.bereit_status');
  else {
    text = s.fehler ? tx('whisper.fehler_laden', { fehler: s.fehler }) : tx('whisper.fehlt', { mb: m.mb });
    knopf = 'laden';
  }
  $('whisperStatus').textContent = text;
  const b = $('whisperLaden');
  b.hidden = !knopf;
  b.dataset.art = knopf;
  b.textContent = knopf === 'abbrechen' ? tx('whisper.abbrechen') : tx('whisper.laden', { mb: m.mb });
}

function whisperVerbinden() {
  julia.on('whisper:status', whisperZeigen);
  $('whisperLaden').onclick = async () => {
    whisperZeigen($('whisperLaden').dataset.art === 'abbrechen' ? await julia.whisperAbbrechen() : await julia.whisperLaden());
  };
}

// Mikrofon-Test: zeigt, ob Ton ankommt und was verstanden wird – mit einem
// Bericht zum Kopieren für die Fehlersuche.
function mikroBericht(r) {
  const i = r.info;
  const w = i.whisper || {};
  const zeilen = [
    `Julia ${i.version} · Sitzung: ${i.sitzung || '–'} · Sprache: ${i.sprachcode}`,
    `Erkennung: ${w.an ? `Whisper (${w.modell}, ${w.bereit ? 'bereit' : 'Modell fehlt'})` : 'Windows'}`,
    `Spracherkennung: ${i.erkenner.length ? i.erkenner.join(', ') : 'keine'}`,
    `Windows-Sperre: ${i.sperre || 'keine'}`,
    `Mikrofone: ${i.eingaenge.length ? i.eingaenge.join(' | ') : 'keine gefunden'}${i.geraeteFehler ? ` (${i.geraeteFehler})` : ''}`,
    `Ausgewählt: ${i.gewaehlt || 'Windows-Standard'}`,
  ];
  r.laeufe.forEach((l, n) => {
    const name = l.art === 'gewaehlt' ? `„${l.geraet}“` : 'Windows-Standard';
    const wh = l.whisper ? `, Whisper ${l.whisper.sekunden} s${l.whisper.fehler ? ` (Fehler: ${l.whisper.fehler})` : ''}, Windows verstand: „${l.windows}“` : '';
    const extra = `${wh}${l.hinweise.length ? `, Hinweise: ${l.hinweise.join(', ')}` : ''}${l.fehler ? `, Fehler: ${l.fehler}` : ''}`;
    zeilen.push(`${n + 1}) ${name}: Pegel ${Math.round(l.pegel)} %, verstanden: „${l.text}“, ${l.sekunden} s${extra}`);
  });
  return zeilen.join('\n');
}

function mikroTestVerbinden() {
  julia.on('mikrotest', (s) => {
    $('mikroTestStatus').textContent = tx('mikrotest.sprich', { n: s.n, gesamt: s.gesamt, geraet: s.art === 'gewaehlt' ? s.geraet : tx('mikrotest.standard') });
  });
  $('mikroTesten').onclick = async () => {
    const knopf = $('mikroTesten');
    knopf.disabled = true;
    $('mikroTest').hidden = false;
    $('mikroDiagnose').replaceChildren();
    $('mikroBericht').textContent = '';
    $('mikroKopieren').hidden = true;
    $('mikroTestStatus').textContent = tx('mikrotest.vorbereiten');
    const r = await julia.mikrofonTest();
    knopf.disabled = false;
    if (r.fehler) {
      $('mikroTestStatus').textContent = r.fehler === 'beschaeftigt' ? tx('mikrotest.beschaeftigt') : tx('mikrotest.fehler', { fehler: r.fehler });
      return;
    }
    $('mikroTestStatus').textContent = tx('mikrotest.fertig');
    for (const d of r.diagnose) {
      const li = document.createElement('li');
      li.textContent = tx(d.k, d.p || {});
      $('mikroDiagnose').append(li);
    }
    $('mikroBericht').textContent = mikroBericht(r);
    $('mikroKopieren').hidden = false;
  };
  $('mikroKopieren').onclick = async () => {
    try {
      await navigator.clipboard.writeText($('mikroBericht').textContent);
      $('mikroKopieren').textContent = tx('mikrotest.kopiert');
      setTimeout(() => { $('mikroKopieren').textContent = tx('mikrotest.kopieren'); }, 2000);
    } catch {
      window.getSelection().selectAllChildren($('mikroBericht')); // dann eben Strg+C
    }
  };
}

// Filtert die Einstellungs-Abschnitte live nach dem Suchtext. Es werden ganze
// Gruppen ein-/ausgeblendet (nie einzelne Zeilen), damit komplexe Unterlisten
// wie Konten oder Sprache unangetastet bleiben. In der Ersteinrichtung ist die
// Suche aus (dort führt der Assistent).
function sucheEinrichten() {
  const feld = $('einstSuche');
  const leiste = $('suchLeiste');
  if (!feld || !leiste) return;
  if (einrichtung) { leiste.hidden = true; return; }
  const filtern = () => {
    const q = feld.value;
    let treffer = 0;
    document.querySelectorAll('.huelle > section.gruppe').forEach((sec) => {
      const zeigen = window.Suche.passt(sec.textContent, q);
      sec.classList.toggle('such-weg', !zeigen);
      if (zeigen) treffer += 1;
    });
    $('suchLeer').hidden = !q.trim() || treffer > 0;
  };
  feld.addEventListener('input', filtern);
  feld.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && feld.value) { e.preventDefault(); feld.value = ''; filtern(); }
  });
}

async function init() {
  cfg = await julia.config();
  texteAnwenden(await julia.texte());
  $('version').textContent = `${tx('einst.version')} ${cfg.version}`;
  $('willkommen').hidden = !einrichtung;
  felderFuellen();
  felderVerbinden();
  const pronomenUmschalten = () => { $('pronomenEigenFeld').hidden = $('pronomen').value !== 'eigene'; };
  $('pronomen').addEventListener('change', pronomenUmschalten);
  pronomenUmschalten();
  // Neuer Name: Titel und Texte der Seite sofort nachziehen.
  $('assistentName').addEventListener('change', async () => texteAnwenden(await julia.texte()));
  monitoreFuellen();
  ordnerZeigen();
  farbenZeigen();
  anbieterZeigen();
  anbieterVerbinden();

  $('ordnerHinzu').onclick = async () => {
    const p = await julia.ordnerWaehlen();
    if (!p || cfg.arbeitsverzeichnisse.includes(p)) return;
    const r = await setzen('arbeitsverzeichnisse', [...cfg.arbeitsverzeichnisse, p]);
    if (!r.fehler) { cfg.arbeitsverzeichnisse = r.wert; ordnerZeigen(); }
  };
  $('blasePosition').onclick = async (e) => {
    e.preventDefault();
    await setzen('blase.position', null);
  };
  $('standardfarben').onclick = async () => {
    const r = await setzen('blase.farben', STANDARDFARBEN);
    if (!r.fehler) { cfg.blase.farben = r.wert; farbenZeigen(); }
  };
  $('speichern').onclick = speichern;
  kontenVerbinden();
  kontenZeigen(await julia.kontenStatus());
  syncVerbinden();
  syncZeigen(await julia.syncStatus());
  appVerbinden();
  appZeigen(await julia.appserverStatus());
  designVerbinden();
  designZeigen();
  kostenZeigen(await julia.kostenHeute());
  julia.on('kosten', kostenZeigen);

  julia.on('config:geaendert', (neu) => {
    const fokus = document.activeElement;
    cfg = { ...neu };
    if (!document.activeElement || !document.activeElement.closest('#akzente')) designZeigen();
    document.querySelectorAll('[data-k]').forEach((el) => {
      if (el === fokus) return;
      const w = holen(cfg, el.dataset.k);
      if (el.type === 'checkbox') el.checked = !!w;
      else if (w != null) {
        const text = Array.isArray(w) ? w.join('\n') : String(w);
        if (el.value !== text) { el.value = text; if (el.type === 'range') ausgabe(el); }
      }
    });
    sandboxZeigen();
  });
  julia.on('texte:geaendert', texteAnwenden);

  stimmenLaden();
  geraeteLaden();
  $('stimmeTesten').onclick = async () => {
    $('stimmeTesten').disabled = true;
    await julia.spracheTesten();
    $('stimmeTesten').disabled = false;
  };
  mikroTestVerbinden();
  whisperVerbinden();
  whisperZeigen(await julia.whisperStatus());
  piperVerbinden();
  mcpVerbinden();
  mcpZeigen(await julia.mcpStatus());
  reparaturEinrichten();
  defenderEinrichten();
  $('overlayVorschau').onclick = () => julia.overlayVorschau();
  $('overlayPositionWeg').onclick = () => julia.setzen('overlay.position', null);
  sandboxZeigen();
  kategorienZeigen();
  werkzeugeZeigen();
  geheimZeigen();
  betaEinrichten();
  rollenEinrichten();
  $('geheimSpeichern').onclick = geheimSpeichern;
  $('geheimWert').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); geheimSpeichern(); } });
  $('sandboxWaehlen').onclick = async () => {
    const p = await julia.ordnerWaehlen();
    if (!p) return;
    const r = await setzen('sandbox.ordner', p);
    if (!r.fehler) { cfg.sandbox = { ...cfg.sandbox, ordner: r.wert }; sandboxZeigen(); }
  };
  sucheEinrichten();
  if (einrichtung) $('name').focus();
}

init();
