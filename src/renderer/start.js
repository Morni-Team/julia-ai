'use strict';

// Seitenleiste und Startseite des Hauptfensters. Läuft nach chat.js und nutzt
// dessen Helfer ($, tx, esc, absenden). Im Overlay gibt es nur den Chat.

(() => {
  if (imOverlay) return;

  const ICONS = {
    start: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h5v-6h4v6h5V9.5"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/></svg>',
    einst: ICON.einst,
    funken: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/></svg>',
    kalender: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 3v3M16 3v3"/></svg>',
    post: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/></svg>',
    glocke: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15Z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>',
    pc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
    muenze: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M14.8 9.2c-.5-.9-1.6-1.4-2.8-1.4-1.7 0-2.8.9-2.8 2.1 0 2.9 5.8 1.5 5.8 4.3 0 1.2-1.2 2.1-3 2.1-1.3 0-2.4-.5-3-1.5M12 6v1.8M12 16.2V18"/></svg>',
    code: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 7-5 5 5 5M16 7l5 5-5 5M13.5 4l-3 16"/></svg>',
    datei: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>',
    film: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M7 5v14M17 5v14M3 9.5h4M3 14.5h4M17 9.5h4M17 14.5h4"/></svg>',
    ordner: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2.5h6.5A2.5 2.5 0 0 1 21 10v7.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5Z"/></svg>',
    blitz: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7Z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.9l10-6.5a1 1 0 0 0 0-1.7l-10-6.5A1 1 0 0 0 8 5.5Z"/></svg>',
    uhr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"/><path d="M3 4v4h4"/><path d="M12 7.5V12l3 2"/></svg>',
    lupe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    'neu-laden': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.3-5.6L20 8.5"/><path d="M20 3.5v5h-5"/></svg>',
    wuerfel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.8 20.5 7.4v9.2L12 21.2l-8.5-4.6V7.4Z"/><path d="m3.5 7.4 8.5 4.6 8.5-4.6M12 12v9.2"/></svg>',
    schluessel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4.5"/><path d="m11.2 11.8 8.8-8.8M16.5 6.5l2.5 2.5M14 9l2 2"/></svg>',
  };

  const VORSCHLAEGE = ['start.v1', 'start.v2', 'start.v3', 'start.v4'];
  let ansicht = 'chat';
  let daten = null;
  let laedt = false;
  let cfg = null;

  const lang = () => document.documentElement.lang || 'de';
  const uhr = (ms) => new Date(ms).toLocaleTimeString(lang(), { hour: '2-digit', minute: '2-digit' });

  function speichern(k, v) { try { localStorage.setItem(k, v); } catch { /* egal */ } }
  function lesen(k) { try { return localStorage.getItem(k); } catch { return null; } }

  function iconsSetzen(wurzel = document) {
    wurzel.querySelectorAll('[data-ico]').forEach((el) => { if (ICONS[el.dataset.ico]) el.innerHTML = ICONS[el.dataset.ico]; });
  }

  // --- Ansichten ---

  const BEREICHE = { start: 'ansichtStart', chat: 'ansichtChat', verlauf: 'ansichtVerlauf', routinen: 'ansichtRoutinen', clips: 'ansichtClips', code: 'ansichtCode', minecraft: 'ansichtMinecraft', boost: 'ansichtBoost' };
  // Weitere Ansichten (Verlauf …) hängen sich hier ein: beim Öffnen aufgerufen.
  window.juliaAnsichtBeimOeffnen = {};

  function ansichtSetzen(neu) {
    if (!BEREICHE[neu]) return;
    ansicht = neu;
    document.body.dataset.ansicht = neu;
    for (const [name, id] of Object.entries(BEREICHE)) $(id).hidden = name !== neu;
    if (window.juliaAnsichtBeimOeffnen[neu]) window.juliaAnsichtBeimOeffnen[neu]();
    document.querySelectorAll('.nav-punkt[data-ansicht]').forEach((b) => b.classList.toggle('aktiv', b.dataset.ansicht === neu));
    speichern('julia-ansicht', neu);
    if (neu === 'start') {
      laden(false);
      $('ansichtStart').scrollTop = 0;
      setTimeout(() => $('schnellText').focus({ preventScroll: true }), 0);
    } else if (neu === 'chat') {
      $('navChatMarke').hidden = true;
      setTimeout(() => $('text').focus(), 0);
    }
  }
  window.juliaAnsicht = ansichtSetzen;

  function fragen(text) {
    if (!text) return;
    ansichtSetzen('chat');
    $('text').value = text;
    absenden();
  }

  // --- Texte ---

  function gruss() {
    const h = new Date().getHours();
    const k = h < 5 ? 'start.gruss_nacht' : h < 11 ? 'start.gruss_morgen' : h < 18 ? 'start.gruss_tag' : h < 23 ? 'start.gruss_abend' : 'start.gruss_nacht';
    const n = daten && daten.nutzer;
    return n ? `${tx(k)}, ${n}${k === 'start.gruss_nacht' ? '?' : ''}` : `${tx(k)}${k === 'start.gruss_nacht' ? '?' : ''}`;
  }

  function texteSetzen() {
    document.querySelectorAll('[data-nav]').forEach((el) => { el.textContent = tx(el.dataset.nav); });
    document.querySelectorAll('.nav-punkt').forEach((b) => { const t = b.querySelector('.nav-text'); if (t) b.title = t.textContent; });
    $('startDatum').textContent = new Date().toLocaleDateString(lang(), { weekday: 'long', day: 'numeric', month: 'long' });
    $('startGruss').textContent = gruss();
    $('startUnter').textContent = tx('start.unter');
    $('schnellText').placeholder = tx('start.platzhalter');
    $('vorschlaege').innerHTML = VORSCHLAEGE.map((k) => `<button class="vorschlag" type="button" data-k="${k}">${esc(tx(k))}</button>`).join('');
    $('vorschlaege').querySelectorAll('.vorschlag').forEach((b) => { b.onclick = () => fragen(tx(b.dataset.k)); });
    if (daten) malen();
  }

  function chipSetzen() {
    if (!cfg) return;
    const a = (cfg.anbieterListe || []).find((x) => x.id === cfg.anbieter);
    $('chipAnbieter').textContent = a ? (a.id === 'claude-abo' ? 'Claude-Abo' : a.name) : '';
    $('chipName').textContent = cfg.modell || '';
    $('chipModell').title = `${$('chipAnbieter').textContent} · ${cfg.modell || ''}`;
  }

  // --- Kacheln ---

  function inhalt(id, html) { $(id).querySelector('.kachel-inhalt').innerHTML = html; }
  const hinweis = (t) => `<p class="leer-hinweis">${esc(t)}</p>`;

  function googleFehlt() {
    return `${hinweis(tx('start.google_hinweis'))}<button class="knopf klein" data-einst="1">${esc(tx('start.google_verbinden'))}</button>`;
  }

  function termineMalen() {
    const t = daten.termine;
    $('kachelTermine').querySelector('.kachel-aktion').hidden = !!t.aus;
    if (t.aus) return inhalt('kachelTermine', googleFehlt());
    if (t.fehler) return inhalt('kachelTermine', hinweis(tx('start.fehler')));
    const heute = new Date(); heute.setHours(0, 0, 0, 0);
    const morgen = new Date(heute); morgen.setDate(morgen.getDate() + 1);
    const danach = new Date(morgen); danach.setDate(danach.getDate() + 1);
    const tagVon = (s) => { const d = new Date(s); d.setHours(0, 0, 0, 0); return d.getTime(); };
    const jetzt = Date.now();
    const liste = t.daten
      .filter((x) => { const tag = tagVon(x.start); return (tag === heute.getTime() && (x.ganztaegig || Date.parse(x.ende || x.start) > jetzt)) || tag === morgen.getTime(); })
      .slice(0, 5);
    if (!liste.length) return inhalt('kachelTermine', hinweis(tx('start.keine_termine')));
    let letzterTag = null;
    const zeilen = [];
    for (const x of liste) {
      const tag = tagVon(x.start) === heute.getTime() ? 'start.heute' : 'start.morgen';
      if (tag !== letzterTag) { zeilen.push(`<li class="voll"><span class="tag">${esc(tx(tag))}</span></li>`); letzterTag = tag; }
      const zeit = x.ganztaegig ? tx('start.ganztaegig') : uhr(Date.parse(x.start));
      zeilen.push(`<li><span class="zeit">${esc(zeit)}</span><span><span class="titel">${esc(x.titel)}</span>${x.ort ? `<span class="klein">${esc(x.ort)}</span>` : ''}</span></li>`);
    }
    inhalt('kachelTermine', `<ul class="eintraege">${zeilen.join('')}</ul>`);
  }

  function mailsMalen() {
    const m = daten.mails;
    $('kachelMails').querySelector('.kachel-aktion').hidden = !!m.aus || !(m.daten && m.daten.anzahl);
    if (m.aus) return inhalt('kachelMails', googleFehlt());
    if (m.fehler) return inhalt('kachelMails', hinweis(tx('start.fehler')));
    const { anzahl, mails } = m.daten;
    if (!anzahl) return inhalt('kachelMails', `<div class="zahl">0</div>${hinweis(tx('start.keine_mails'))}`);
    inhalt('kachelMails', `<div class="zahl">${anzahl}<small>${esc(tx('start.ungelesen'))}</small></div><ul class="eintraege">${mails.slice(0, 3).map((x) => `<li class="voll"><span><span class="titel">${esc(x.betreff || '–')}</span><span class="klein">${esc(x.von)}</span></span></li>`).join('')}</ul>`);
  }

  function relativ(ms) {
    const min = Math.round((ms - Date.now()) / 60000);
    if (min < 1) return tx('start.gleich');
    if (min < 60) return tx('start.in_min', { n: min });
    if (min < 24 * 60 && new Date(ms).getDate() === new Date().getDate()) return uhr(ms);
    return new Date(ms).toLocaleDateString(lang(), { weekday: 'short' }) + ' ' + uhr(ms);
  }

  function erinnerungenMalen() {
    const l = daten.erinnerungen;
    if (!l.length) return inhalt('kachelErinnerungen', hinweis(tx('start.keine_erinnerungen')));
    inhalt('kachelErinnerungen', `<ul class="eintraege">${l.map((e) => `<li><span class="zeit">${esc(relativ(e.zeit))}</span><span class="titel">${esc(e.text)}</span></li>`).join('')}</ul>`);
  }

  function messung(name, wert, prozent, schwellen = [75, 90]) {
    const p = Math.max(0, Math.min(100, Math.round(prozent)));
    const art = p >= schwellen[1] ? ' kritisch' : p >= schwellen[0] ? ' warn' : '';
    return `<div class="messung"><span>${esc(name)}</span><b>${esc(wert)}</b><div class="balken${art}"><i style="width:${p}%"></i></div></div>`;
  }

  function pcMalen() {
    const p = daten.pc;
    if (p.aus || p.fehler) return inhalt('kachelPc', hinweis(tx('start.fehler')));
    const s = p.daten;
    const teile = [];
    if (s.akku && Number.isFinite(s.akku.prozent)) {
      teile.push(messung(tx('start.akku'), `${s.akku.prozent} %${s.akku.am_netz ? ` · ${tx('start.netz')}` : ''}`, s.akku.prozent, [101, 101]));
    }
    if (s.ram_gesamt_gb) {
      const belegt = s.ram_gesamt_gb - s.ram_frei_gb;
      teile.push(messung(tx('start.ram'), `${belegt.toFixed(1)} / ${s.ram_gesamt_gb} GB`, (100 * belegt) / s.ram_gesamt_gb));
    }
    const lw = (s.laufwerke || []).slice().sort((a, b) => a.frei_prozent - b.frei_prozent)[0];
    if (lw) teile.push(messung(tx('start.platte', { lw: lw.laufwerk }), tx('start.frei', { gb: Math.round(lw.frei_gb) }), 100 - lw.frei_prozent, [85, 95]));
    inhalt('kachelPc', `<div class="messwerte">${teile.join('')}</div>`);
  }

  function kostenMalen() {
    const k = daten.kosten;
    if (k.lokal) return inhalt('kachelKosten', `<div class="zahl">0 $</div>${hinweis(tx('start.kosten_lokal'))}`);
    const betrag = (Number(k.usd) || 0).toLocaleString(lang(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const teile = [`<div class="zahl">${betrag} $<small>${esc(tx('start.anfragen', { n: k.anfragen || 0 }))}</small></div>`];
    if (k.limit) teile.push(messung(tx('start.limit'), tx('start.von_limit', { limit: k.limit }), (100 * (k.usd || 0)) / k.limit, [80, 100]));
    inhalt('kachelKosten', teile.join(''));
  }

  function malen() {
    $('startGruss').textContent = gruss();
    termineMalen();
    mailsMalen();
    erinnerungenMalen();
    pcMalen();
    kostenMalen();
    $('startStand').textContent = tx('start.stand', { zeit: uhr(daten.jetzt) });
    document.querySelectorAll('[data-einst]').forEach((b) => { b.onclick = () => julia.einstellungen(); });
  }

  // Schnellaktionen: die ersten Routinen als Knöpfe unter den Vorschlägen.
  async function schnellaktionen() {
    const liste = (await julia.routinenListe()).slice(0, 6);
    $('schnellaktionen').hidden = !liste.length;
    $('saKnoepfe').innerHTML = liste.map((r) => `<button class="sa-knopf" type="button" data-id="${esc(r.id)}"><span class="sa-symbol">${esc(r.symbol)}</span><span>${esc(r.name)}</span></button>`).join('');
    $('saKnoepfe').querySelectorAll('.sa-knopf').forEach((b) => { b.onclick = () => julia.routineStarten(b.dataset.id); });
  }

  async function laden(neu) {
    schnellaktionen().catch(() => {});
    if (laedt) return;
    laedt = true;
    $('btnAktualisieren').classList.add('dreht');
    document.querySelectorAll('.kachel').forEach((k) => k.classList.add('laedt'));
    try {
      daten = await julia.startUeberblick(neu);
      malen();
    } catch { /* bleibt beim alten Stand */ } finally {
      laedt = false;
      $('btnAktualisieren').classList.remove('dreht');
      document.querySelectorAll('.kachel').forEach((k) => k.classList.remove('laedt'));
    }
  }

  // --- Verdrahten ---

  iconsSetzen();
  $('schnellSenden').innerHTML = ICON.senden;
  document.querySelectorAll('.nav-punkt[data-ansicht]').forEach((b) => { b.onclick = () => ansichtSetzen(b.dataset.ansicht); });
  $('navEinst').onclick = () => julia.einstellungen();
  $('btnBriefing').onclick = () => fragen(tx('start.briefing_frage'));
  $('btnAktualisieren').onclick = () => laden(true);
  document.querySelectorAll('.kachel-aktion').forEach((b) => { b.onclick = () => fragen(tx(b.dataset.frage)); });
  $('schnellForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const t = $('schnellText').value.trim();
    $('schnellText').value = '';
    fragen(t);
  });

  julia.on('ansicht', (a) => ansichtSetzen(a));
  julia.on('routinen:geaendert', () => schnellaktionen().catch(() => {}));
  julia.on('texte:geaendert', () => setTimeout(texteSetzen, 0));
  julia.on('config:geaendert', (c) => { cfg = c; chipSetzen(); });
  julia.on('kosten', () => { if (ansicht === 'start') laden(true); });
  julia.on('erinnerung', () => { if (ansicht === 'start') laden(true); });
  // Antwortet Julia, während die Startseite offen ist: Punkt am Chat.
  julia.on('agent:text', () => { if (ansicht !== 'chat') $('navChatMarke').hidden = false; });
  julia.on('agent:freigabe', () => ansichtSetzen('chat'));

  bereit.then(async () => {
    // Beschriftungen zuerst – auch wenn danach etwas hakt, ist die Oberfläche
    // sichtbar und bedienbar (kein leeres Fenster mehr, Issue #26/#45).
    try { texteSetzen(); } catch { /* nie die ganze Oberfläche blockieren */ }
    try { cfg = await julia.config(); chipSetzen(); } catch { /* Chip bleibt leer */ }
    // Andere Skripte (verlauf.js) sind erst nach diesem hier geladen.
    setTimeout(() => { try { ansichtSetzen(lesen('julia-ansicht') || 'start'); } catch { /* egal */ } }, 0);
  });
  window.juliaIcons = iconsSetzen;
  window.juliaFragen = fragen;
  // Kommen die Texte verspätet nach (langsamer Start-IPC), Beschriftungen neu füllen.
  window.juliaTexteNach = () => { try { texteSetzen(); } catch { /* egal */ } };
  // Uhrzeit und Gruß frisch halten
  setInterval(() => { if (ansicht === 'start' && daten) malen(); }, 60000);
})();
