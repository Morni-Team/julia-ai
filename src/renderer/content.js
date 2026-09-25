'use strict';

// Renderer für das Content-Creation-Modul (erste Scheibe: Aktivierung + Creator-
// Profile). Alles in einer IIFE gekapselt, damit keine geteilten Renderer-Globals
// (aus chat.js/markdown.js …) kollidieren. Nutzt das globale `$` (getElementById).
(() => {
  if (typeof window === 'undefined' || !window.julia) return;
  const j = window.julia;
  const el = (id) => document.getElementById(id);

  let profile = [];
  let aktivId = null;
  let gewaehlt = null; // id des gerade im Formular bearbeiteten Profils ('' = neu)
  let gewaehltOrdner = ''; // per Dialog gewählter Arbeits-/Speicherordner

  function formLesen() {
    const zeilen = (s) => String(s || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    return {
      id: gewaehlt || '',
      kanalname: el('cfKanalname').value,
      kanal_link: el('cfKanalLink').value,
      ordner: gewaehltOrdner,
      zielgruppe: el('cfZielgruppe').value,
      tonalitaet: el('cfTonalitaet').value,
      sprache: el('cfSprache').value,
      regeln: zeilen(el('cfRegeln').value),
      stilprofile: [{
        name: el('csName').value || 'Standard',
        schnitte_pro_min: Number(el('csSchnitte').value) || 14,
        hook_sekunden: Number(el('csHook').value) || 8,
        broll_anteil: (Number(el('csBroll').value) || 30) / 100,
      }],
    };
  }

  function ordnerAnzeigen() {
    const a = el('cfOrdnerAnzeige');
    if (!a) return;
    if (gewaehltOrdner) { a.textContent = gewaehltOrdner; a.removeAttribute('data-t'); }
    else { a.setAttribute('data-t', 'content.ordner_keiner'); if (window.juliaTexteNach) window.juliaTexteNach(); }
  }

  function formFuellen(p) {
    p = p || {};
    gewaehlt = p.id || '';
    gewaehltOrdner = p.ordner || '';
    el('cfKanalname').value = p.kanalname || '';
    el('cfKanalLink').value = p.kanal_link || '';
    el('cfZielgruppe').value = p.zielgruppe || '';
    el('cfTonalitaet').value = p.tonalitaet || '';
    el('cfSprache').value = p.sprache === 'en' ? 'en' : 'de';
    el('cfRegeln').value = (p.regeln || []).join('\n');
    const s = (p.stilprofile && p.stilprofile[0]) || {};
    el('csName').value = s.name || 'Standard';
    el('csSchnitte').value = s.schnitte_pro_min || 14;
    el('csHook').value = s.hook_sekunden || 8;
    el('csBroll').value = Math.round((s.broll_anteil != null ? s.broll_anteil : 0.3) * 100);
    ordnerAnzeigen();
  }

  function listeFuellen() {
    const wahl = el('contentProfilWahl');
    if (!wahl) return;
    wahl.innerHTML = '';
    for (const p of profile) {
      const o = document.createElement('option');
      o.value = p.id;
      o.textContent = p.id === aktivId ? `★ ${p.kanalname}` : p.kanalname;
      wahl.appendChild(o);
    }
    if (gewaehlt) wahl.value = gewaehlt;
  }

  async function laden() {
    try {
      const st = await j.contentStatus();
      if (st && el('contentAktiv')) el('contentAktiv').checked = st.aktiv === true;
      umschalten(st && st.aktiv === true);
      const d = await j.contentProfileListe();
      profile = (d && d.profile) || [];
      aktivId = (d && d.aktivId) || null;
      if (!profile.length) { formFuellen(await j.contentProfilVorlage('Mein Kanal')); }
      else { const akt = profile.find((p) => p.id === aktivId) || profile[0]; formFuellen(akt); }
      listeFuellen();
    } catch { /* Fenster wird geschlossen */ }
  }

  function umschalten(an) {
    if (el('contentAn')) el('contentAn').hidden = !an;
    if (el('contentAus')) el('contentAus').hidden = !!an;
  }

  function gespeichertZeigen() {
    const g = el('contentGespeichert');
    if (!g) return;
    g.hidden = false;
    setTimeout(() => { g.hidden = true; }, 1500);
  }

  function verdrahten() {
    if (el('contentAktiv')) el('contentAktiv').onchange = async () => {
      const an = el('contentAktiv').checked;
      await j.setzen('content.aktiv', an);
      umschalten(an);
    };
    if (el('contentProfilWahl')) el('contentProfilWahl').onchange = () => {
      const p = profile.find((x) => x.id === el('contentProfilWahl').value);
      if (p) formFuellen(p);
    };
    if (el('contentProfilNeu')) el('contentProfilNeu').onclick = async () => {
      formFuellen(await j.contentProfilVorlage('Neuer Kanal'));
      gewaehlt = ''; // erzwingt neue id aus dem Namen beim Speichern
    };
    if (el('cfOrdnerWaehlen')) el('cfOrdnerWaehlen').onclick = async () => {
      const r = await j.contentOrdnerWaehlen();
      if (r && r.ordner) { gewaehltOrdner = r.ordner; ordnerAnzeigen(); }
      else if (r && r.fehler) alert(r.fehler);
    };
    if (el('contentProfilSpeichern')) el('contentProfilSpeichern').onclick = async () => {
      const r = await j.contentProfilSpeichern(formLesen());
      if (r && r.fehler) { alert(r.fehler); return; }
      gespeichertZeigen();
      await laden();
    };
    if (el('contentProfilAktiv')) el('contentProfilAktiv').onclick = async () => {
      const id = el('contentProfilWahl').value;
      if (id) { await j.contentProfilAktiv(id); await laden(); }
    };
    if (el('contentProfilLoeschen')) el('contentProfilLoeschen').onclick = async () => {
      const id = el('contentProfilWahl').value;
      if (id && confirm('Dieses Profil löschen?')) { await j.contentProfilLoeschen(id); await laden(); }
    };
    if (el('contentProfilExport')) el('contentProfilExport').onclick = async () => {
      const id = el('contentProfilWahl').value;
      const r = await j.contentProfilExport(id);
      if (r && r.json) {
        try { await navigator.clipboard.writeText(r.json); alert('Profil als JSON in die Zwischenablage kopiert.'); }
        catch { alert(r.json); }
      }
    };
    if (el('contentProfilImport')) el('contentProfilImport').onclick = async () => {
      let txt = '';
      try { txt = await navigator.clipboard.readText(); } catch { /* keine Berechtigung */ }
      if (!txt) { alert('Kopiere zuerst ein Profil-JSON in die Zwischenablage, dann erneut auf „Import".'); return; }
      const r = await j.contentProfilImport(txt);
      if (r && r.fehler) { alert(r.fehler); return; }
      alert(`${(r && r.anzahl) || 0} Profil(e) importiert.`);
      await laden();
    };
    // --- Analyse (Video-Transkript / Kanal-Infos) ---
    let analyseArt = 'video';
    const artSegment = el('contentAnalyseArt');
    if (artSegment) artSegment.querySelectorAll('button').forEach((b) => {
      b.onclick = () => {
        analyseArt = b.dataset.wert;
        artSegment.querySelectorAll('button').forEach((x) => x.classList.toggle('aktiv', x === b));
        const lab = el('caTextLabel');
        if (lab) lab.setAttribute('data-t', analyseArt === 'kanal' ? 'content.analyse_kanalinfos' : 'content.analyse_transkript');
        if (window.juliaTexteNach) window.juliaTexteNach();
      };
    });
    if (el('contentAnalysieren')) el('contentAnalysieren').onclick = async () => {
      const txt = el('caText').value.trim();
      if (!txt) { alert('Bitte erst das Transkript bzw. die Kanal-Infos einfügen.'); return; }
      const laeuft = el('caLaeuft'); const bericht = el('caBericht');
      if (laeuft) laeuft.hidden = false;
      if (bericht) bericht.hidden = true;
      try {
        const eingabe = { art: analyseArt, titel: el('caTitel').value, notizen: el('caNotizen').value };
        if (analyseArt === 'kanal') eingabe.kanalInfos = txt; else eingabe.transkript = txt;
        const r = await j.contentAnalysieren(eingabe);
        if (bericht) {
          bericht.hidden = false;
          bericht.textContent = (r && r.fehler) ? r.fehler : ((r && r.antwort) || 'Keine Antwort erhalten.');
        }
      } catch (e) {
        if (bericht) { bericht.hidden = false; bericht.textContent = 'Fehler: ' + (e && e.message); }
      } finally {
        if (laeuft) laeuft.hidden = true;
      }
    };
  }

  function start() {
    if (!document.getElementById('ansichtContent')) return;
    verdrahten();
    laden();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
