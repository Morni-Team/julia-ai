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

  function formLesen() {
    const csv = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
    const zeilen = (s) => String(s || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    return {
      id: gewaehlt || '',
      kanalname: el('cfKanalname').value,
      zielgruppe: el('cfZielgruppe').value,
      tonalitaet: el('cfTonalitaet').value,
      sprache: el('cfSprache').value,
      marke: {
        logo: el('cfLogo').value, farben: csv(el('cfFarben').value), schriften: csv(el('cfSchriften').value),
        intro: el('cfIntro').value, outro: el('cfOutro').value, sfx_ordner: el('cfSfx').value, musik_ordner: el('cfMusik').value,
      },
      regeln: zeilen(el('cfRegeln').value),
      stilprofile: [{
        name: el('csName').value || 'Standard',
        schnitte_pro_min: Number(el('csSchnitte').value) || 14,
        hook_sekunden: Number(el('csHook').value) || 8,
        broll_anteil: (Number(el('csBroll').value) || 30) / 100,
      }],
    };
  }

  function formFuellen(p) {
    p = p || {};
    const m = p.marke || {};
    gewaehlt = p.id || '';
    el('cfKanalname').value = p.kanalname || '';
    el('cfZielgruppe').value = p.zielgruppe || '';
    el('cfTonalitaet').value = p.tonalitaet || '';
    el('cfSprache').value = p.sprache === 'en' ? 'en' : 'de';
    el('cfLogo').value = m.logo || '';
    el('cfFarben').value = (m.farben || []).join(', ');
    el('cfSchriften').value = (m.schriften || []).join(', ');
    el('cfIntro').value = m.intro || '';
    el('cfOutro').value = m.outro || '';
    el('cfSfx').value = m.sfx_ordner || '';
    el('cfMusik').value = m.musik_ordner || '';
    el('cfRegeln').value = (p.regeln || []).join('\n');
    const s = (p.stilprofile && p.stilprofile[0]) || {};
    el('csName').value = s.name || 'Standard';
    el('csSchnitte').value = s.schnitte_pro_min || 14;
    el('csHook').value = s.hook_sekunden || 8;
    el('csBroll').value = Math.round((s.broll_anteil != null ? s.broll_anteil : 0.3) * 100);
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
  }

  function start() {
    if (!document.getElementById('ansichtContent')) return;
    verdrahten();
    laden();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
