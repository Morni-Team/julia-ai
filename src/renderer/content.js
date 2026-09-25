'use strict';

// Content-Modul – „App in der App": Kontoleiste + vier Reiter (Schnittaufträge,
// Planung, Thumbnails, Kanal). Rein die Oberfläche; die Arbeit macht der
// Hauptprozess über die content*-Brücken.
(function () {
  const j = window.julia || {};
  const el = (id) => document.getElementById(id);
  const bildLaden = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const escape = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // #rgb/#rrggbb → rgba(...) mit Alpha (für Glows/Strahlen).
  function hexRgba(hex, a) {
    let h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    if (!/^[0-9a-fA-F]{6}$/.test(h)) h = 'ff8a1e';
    const n = parseInt(h, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }

  let profile = [];
  let aktivId = null;
  let frames = [];         // aktuelle Standbilder (Thumbnail-Analyse)
  let gewaehltesBild = null; // Image-Objekt des gewählten Frames (Video-Modus)
  let skinBild = null;       // Image-Objekt des Skins (falls geholt)
  let thumbKat = 'gaming';
  let thumbModus = 'video';  // 'video' | 'beschreibung'
  let genFarben = [];        // Farben aus dem KI-Konzept (Hintergrund im Beschreibungs-Modus)

  // ---- Profil-Formular (Reiter „Kanal") ----
  function formLesen() {
    return {
      id: aktivId || undefined,
      kanalname: el('cfKanalname').value,
      kanal_link: el('cfKanalLink').value,
      mc_name: el('cfMcName').value,
      kategorie: el('cfKategorie').value,
      avatar: el('cfAvatarBild').dataset.url || '',
      ordner: el('cfOrdnerAnzeige').dataset.pfad || '',
      sprache: el('cfSprache').value,
      zielgruppe: el('cfZielgruppe').value,
      tonalitaet: el('cfTonalitaet').value,
      regeln: el('cfRegeln').value.split('\n').map((s) => s.trim()).filter(Boolean),
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
    el('cfKanalname').value = p.kanalname || '';
    el('cfKanalLink').value = p.kanal_link || '';
    el('cfMcName').value = p.mc_name || '';
    el('cfKategorie').value = p.kategorie || '';
    el('cfSprache').value = p.sprache || 'de';
    el('cfZielgruppe').value = p.zielgruppe || '';
    el('cfTonalitaet').value = p.tonalitaet || '';
    el('cfRegeln').value = (p.regeln || []).join('\n');
    const s = (p.stilprofile && p.stilprofile[0]) || {};
    el('csName').value = s.name || 'Standard';
    el('csSchnitte').value = s.schnitte_pro_min || 14;
    el('csHook').value = s.hook_sekunden || 8;
    el('csBroll').value = Math.round((s.broll_anteil != null ? s.broll_anteil : 0.3) * 100);
    // Ordner
    const o = el('cfOrdnerAnzeige'); o.dataset.pfad = p.ordner || '';
    o.textContent = p.ordner || 'kein Ordner gewählt';
    // Avatar
    const av = el('cfAvatarBild');
    av.dataset.url = p.avatar || '';
    if (p.avatar) { av.src = p.avatar; av.hidden = false; } else { av.hidden = true; }
  }

  // ---- Kontoleiste oben ----
  function barFuellen() {
    const wahl = el('ctKanalWahl');
    if (wahl) {
      wahl.innerHTML = '';
      profile.forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p.id; opt.textContent = (p.id === aktivId ? '★ ' : '') + (p.kanalname || p.id);
        wahl.appendChild(opt);
      });
      if (aktivId) wahl.value = aktivId;
    }
    const aktiv = profile.find((p) => p.id === aktivId) || null;
    const avatar = el('ctAvatar'); const leer = el('ctAvatarLeer');
    if (aktiv && aktiv.avatar) { avatar.src = aktiv.avatar; avatar.hidden = false; if (leer) leer.hidden = true; }
    else { if (avatar) avatar.hidden = true; if (leer) leer.hidden = false; }
    const badge = el('ctKategorieBadge');
    if (badge) {
      const map = { 'minecraft-gaming': 'Minecraft-Gaming', gaming: 'Gaming', reaction: 'Reaction' };
      if (aktiv && aktiv.kategorie && map[aktiv.kategorie]) { badge.textContent = map[aktiv.kategorie]; badge.hidden = false; } else badge.hidden = true;
    }
    const stats = el('ctStats');
    if (stats) stats.textContent = aktiv && aktiv.kanal_link ? aktiv.kanal_link.replace(/^https?:\/\/(www\.)?/, '') : '';
    // Thumbnail-Kategorie-Segment an die feste Kanal-Kategorie anpassen
    thumbKatAnpassen(aktiv);
  }

  function thumbKatAnpassen(aktiv) {
    const seg = el('ctThumbKat'); const fest = el('ctThumbKatFest');
    const map = { 'minecraft-gaming': 'Minecraft-Gaming', gaming: 'Gaming', reaction: 'Reaction' };
    if (aktiv && aktiv.kategorie && map[aktiv.kategorie]) {
      // Fest: Segment sperren und den festen Wert anzeigen
      if (seg) seg.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      if (fest) { fest.textContent = `Dieser Kanal ist fest auf „${map[aktiv.kategorie]}" – wird automatisch verwendet.`; fest.hidden = false; }
    } else {
      // Frei wählbar: klar auffordern, Gaming oder Reaction zu wählen
      if (seg) seg.querySelectorAll('button').forEach((b) => { b.disabled = false; });
      if (fest) { fest.textContent = '👉 Wähle die Videoart: Gaming oder Reaction – das bestimmt Skin-Pose und Stil des Thumbnails.'; fest.hidden = false; }
    }
    // Skin-Info
    const info = el('ctThumbSkinInfo');
    if (info) info.textContent = (aktiv && aktiv.mc_name)
      ? `Skin aus dem Minecraft-Namen „${aktiv.mc_name}" wird cinematisch einkomponiert.`
      : 'Kein Minecraft-Name im Kanal gesetzt – trage ihn im Reiter „Kanal" ein, dann kommt dein Skin ins Thumbnail.';
  }

  async function laden() {
    let st;
    try { st = await j.contentStatus(); } catch { st = {}; }
    const an = !!(st && st.aktiv);
    if (el('contentAktiv')) el('contentAktiv').checked = an;
    if (el('contentAus')) el('contentAus').hidden = an;
    if (el('contentAn')) el('contentAn').hidden = !an;
    if (!an) return;
    let r; try { r = await j.contentProfileListe(); } catch { r = {}; }
    profile = (r && r.profile) || [];
    aktivId = (r && r.aktivId) || (profile[0] && profile[0].id) || null;
    barFuellen();
    formFuellen(profile.find((p) => p.id === aktivId) || {});
    await auftraegeLaden();
    await planLaden();
  }

  // ---- Reiter-Umschaltung ----
  function tabsVerdrahten() {
    const tabs = el('ctTabs'); if (!tabs) return;
    tabs.querySelectorAll('button').forEach((b) => {
      b.onclick = () => {
        tabs.querySelectorAll('button').forEach((x) => x.classList.toggle('aktiv', x === b));
        document.querySelectorAll('#contentAn .ct-panel').forEach((p) => { p.hidden = (p.dataset.panel !== b.dataset.tab); });
      };
    });
  }

  // ---- Reiter 1: Schnittaufträge ----
  async function auftraegeLaden() {
    const box = el('ctAuftragListe'); if (!box) return;
    let r; try { r = await j.contentAuftragListe(); } catch { r = {}; }
    const liste = (r && r.auftraege) || [];
    box.innerHTML = '';
    if (!liste.length) { box.innerHTML = '<p class="ct-klein" data-t="content.auftrag_leer"></p>'; if (window.juliaTexteNach) window.juliaTexteNach(); return; }
    liste.forEach((a) => {
      const div = document.createElement('div');
      div.className = 'ct-eintrag';
      div.innerHTML = `<div class="ct-eintrag-kopf"><b>${escape(a.titel)}</b><span class="ct-status ct-status-${a.status}">${a.status}</span></div>`
        + (a.videoPfad ? `<div class="ct-pfad">${escape(a.videoPfad)}</div>` : '')
        + (a.anweisung ? `<div class="ct-eintrag-text">${escape(a.anweisung)}</div>` : '')
        + `<div class="ct-leiste"><button class="knopf klein" data-fertig="${a.id}">✓ erledigt</button><button class="knopf klein" data-offen="${a.id}">↺ offen</button><button class="knopf klein" data-weg="${a.id}">✕</button></div>`;
      box.appendChild(div);
    });
    box.querySelectorAll('[data-fertig]').forEach((b) => { b.onclick = async () => { await j.contentAuftragStatus(b.dataset.fertig, 'fertig'); auftraegeLaden(); }; });
    box.querySelectorAll('[data-offen]').forEach((b) => { b.onclick = async () => { await j.contentAuftragStatus(b.dataset.offen, 'offen'); auftraegeLaden(); }; });
    box.querySelectorAll('[data-weg]').forEach((b) => { b.onclick = async () => { await j.contentAuftragRemove(b.dataset.weg); auftraegeLaden(); }; });
  }

  function auftraegeVerdrahten() {
    if (el('ctAuftragVideo')) el('ctAuftragVideo').onclick = async () => {
      const r = await j.contentAuftragVideo();
      if (r && r.pfad) { const f = el('ctAuftragVideoPfad'); f.textContent = r.pfad; f.dataset.pfad = r.pfad; }
    };
    if (el('ctAuftragAnlegen')) el('ctAuftragAnlegen').onclick = async () => {
      const titel = el('ctAuftragTitel').value.trim();
      const videoPfad = el('ctAuftragVideoPfad').dataset.pfad || '';
      const anweisung = el('ctAuftragAnweisung').value.trim();
      if (!titel && !videoPfad) { alert('Bitte mindestens einen Titel oder einen Rohcut wählen.'); return; }
      await j.contentAuftragAdd({ titel, videoPfad, anweisung, kanalId: aktivId });
      el('ctAuftragTitel').value = ''; el('ctAuftragAnweisung').value = '';
      const f = el('ctAuftragVideoPfad'); f.dataset.pfad = ''; f.textContent = 'kein Rohcut gewählt';
      auftraegeLaden();
    };
  }

  // ---- Reiter 2: Planung ----
  async function planLaden() {
    const box = el('ctPlanListe'); if (!box) return;
    let r; try { r = await j.contentPlanListe(); } catch { r = {}; }
    const liste = (r && r.plan) || [];
    box.innerHTML = '';
    if (!liste.length) { box.innerHTML = '<p class="ct-klein" data-t="content.plan_leer"></p>'; if (window.juliaTexteNach) window.juliaTexteNach(); return; }
    liste.forEach((p) => {
      const div = document.createElement('div');
      div.className = 'ct-eintrag';
      const opts = ['idee', 'geplant', 'in_arbeit', 'fertig', 'veroeffentlicht']
        .map((s) => `<option value="${s}"${s === p.status ? ' selected' : ''}>${s}</option>`).join('');
      div.innerHTML = `<div class="ct-eintrag-kopf"><b>${escape(p.titel)}</b><span class="ct-datum">${escape(p.datum || '—')}</span></div>`
        + (p.idee ? `<div class="ct-eintrag-text">${escape(p.idee)}</div>` : '')
        + (p.skript ? `<details><summary class="ct-klein">Skript</summary><pre class="ct-skript">${escape(p.skript)}</pre></details>` : '')
        + `<div class="ct-leiste"><select data-status="${p.id}">${opts}</select><button class="knopf klein" data-weg="${p.id}">✕</button></div>`;
      box.appendChild(div);
    });
    box.querySelectorAll('[data-status]').forEach((sel) => { sel.onchange = async () => { await j.contentPlanUpdate(sel.dataset.status, { status: sel.value }); }; });
    box.querySelectorAll('[data-weg]').forEach((b) => { b.onclick = async () => { await j.contentPlanRemove(b.dataset.weg); planLaden(); }; });
  }

  function planVerdrahten() {
    if (el('ctPlanAnlegen')) el('ctPlanAnlegen').onclick = async () => {
      const titel = el('ctPlanTitel').value.trim();
      if (!titel) { alert('Bitte einen Titel für das geplante Video eingeben.'); return; }
      await j.contentPlanAdd({
        titel, datum: el('ctPlanDatum').value, idee: el('ctPlanIdee').value.trim(),
        skript: el('ctPlanSkript').value, kanalId: aktivId,
      });
      el('ctPlanTitel').value = ''; el('ctPlanIdee').value = ''; el('ctPlanSkript').value = ''; el('ctPlanDatum').value = '';
      planLaden();
    };
  }

  // ---- Reiter 3: Thumbnails ----
  function thumbModusAnwenden(m) {
    thumbModus = m;
    const seg = el('ctThumbModus');
    if (seg) seg.querySelectorAll('button').forEach((x) => x.classList.toggle('aktiv', x.dataset.wert === m));
    if (el('ctThumbBeschreibungZeile')) el('ctThumbBeschreibungZeile').hidden = (m !== 'beschreibung');
    if (el('ctThumbAnalyse')) el('ctThumbAnalyse').hidden = (m !== 'video');
    if (el('ctThumbBeschreibungBtn')) el('ctThumbBeschreibungBtn').hidden = (m !== 'beschreibung');
    if (el('ctThumbs')) el('ctThumbs').hidden = (m !== 'video');
  }

  // Beschreibung → KI-Konzept → Compositor (Farbverlauf-Hintergrund + Skin + Text).
  async function beschreibungErzeugen() {
    const status = el('ctThumbStatus'); const konzept = el('ctThumbKonzept');
    const beschreibung = el('ctThumbBeschreibung') ? el('ctThumbBeschreibung').value.trim() : '';
    if (!beschreibung) { alert('Bitte beschreibe kurz, was aufs Thumbnail soll.'); return; }
    if (status) status.textContent = 'Baue ein Konzept aus deiner Beschreibung …';
    if (konzept) konzept.hidden = true;
    let r; try { r = await j.contentThumbnailKonzept({ beschreibung, wahl: thumbKat, titel: el('ctThumbTitel').value }); } catch (e) { r = { fehler: e && e.message }; }
    if (!r || r.fehler) { if (status) status.textContent = (r && r.fehler) || 'Konzept fehlgeschlagen.'; return; }
    genFarben = (r.farben && r.farben.length) ? r.farben : [];
    gewaehltesBild = null; // kein Videoframe → Farbverlauf-Hintergrund
    skinBild = null;
    if (r.skinUrl) { try { const sk = await j.contentSkin({ pose: r.pose, crop: r.crop }); if (sk && sk.datenUrl) skinBild = await bildLaden(sk.datenUrl); } catch { /* ohne Skin weiter */ } }
    if (el('ctThumbText')) el('ctThumbText').value = (r.headline || el('ctThumbText').value || '').toUpperCase();
    if (genFarben[1] && el('ctThumbFarbe')) el('ctThumbFarbe').value = genFarben[1];
    if (konzept && r.konzept) { konzept.hidden = false; konzept.textContent = r.konzept; }
    if (el('ctThumbBauen')) el('ctThumbBauen').hidden = false;
    if (status) status.textContent = 'Konzept fertig – unten dein Thumbnail (anpassbar & speicherbar).';
    thumbnailZeichnen();
  }

  function thumbVerdrahten() {
    const modus = el('ctThumbModus');
    if (modus) modus.querySelectorAll('button').forEach((b) => { b.onclick = () => thumbModusAnwenden(b.dataset.wert); });
    if (el('ctThumbBeschreibungBtn')) el('ctThumbBeschreibungBtn').onclick = beschreibungErzeugen;
    const seg = el('ctThumbKat');
    if (seg) seg.querySelectorAll('button').forEach((b) => {
      b.onclick = () => { if (b.disabled) return; thumbKat = b.dataset.wert; seg.querySelectorAll('button').forEach((x) => x.classList.toggle('aktiv', x === b)); };
    });
    if (el('ctThumbAnalyse')) el('ctThumbAnalyse').onclick = async () => {
      const status = el('ctThumbStatus'); const konzept = el('ctThumbKonzept'); const gitter = el('ctThumbs');
      if (status) status.textContent = 'Sehe mir das Video an … (Frames ziehen + analysieren, kann dauern)';
      if (gitter) gitter.innerHTML = ''; if (konzept) konzept.hidden = true;
      if (el('ctThumbBauen')) el('ctThumbBauen').hidden = true;
      frames = []; gewaehltesBild = null; skinBild = null;
      let r; try { r = await j.contentThumbnailAnalysieren({ wahl: thumbKat, titel: el('ctThumbTitel').value }); } catch (e) { r = { fehler: e && e.message }; }
      if (!r || r.abgebrochen) { if (status) status.textContent = ''; return; }
      if (r.fehler) { if (status) status.textContent = r.fehler; return; }
      frames = r.bilder || [];
      if (status) status.textContent = `${frames.length} Standbilder – klick das beste an, dann baust du dein Thumbnail.`;
      if (konzept && r.konzept) { konzept.hidden = false; konzept.textContent = r.konzept; }
      if (gitter) frames.forEach((b, i) => {
        const img = document.createElement('img');
        img.className = 'ct-thumb'; img.src = b.datenUrl; img.title = `Frame ${i + 1} (bei ${Math.round(b.bei_s)} s)`;
        img.onclick = async () => {
          gitter.querySelectorAll('img').forEach((x) => x.classList.toggle('gewaehlt', x === img));
          try { gewaehltesBild = await bildLaden(b.datenUrl); } catch { gewaehltesBild = null; }
          // Skin (falls Kanal einen MC-Namen hat) in der cinematischen Pose holen
          if (r.skinUrl && !skinBild) {
            try { const sk = await j.contentSkin({ pose: r.pose, crop: r.crop }); if (sk && sk.datenUrl) skinBild = await bildLaden(sk.datenUrl); } catch { /* ohne Skin weiter */ }
          }
          if (el('ctThumbBauen')) el('ctThumbBauen').hidden = false;
          // Textvorschlag aus dem Konzept ziehen (Zeile mit TEXT:)
          const m = /(?:TEXT|Text)\s*:\s*"?([^"\n]{2,40})"?/.exec(r.konzept || '');
          if (m && el('ctThumbText') && !el('ctThumbText').value) el('ctThumbText').value = m[1].trim();
          thumbnailZeichnen();
        };
        gitter.appendChild(img);
      });
    };
    ['ctThumbText', 'ctThumbFarbe', 'ctThumbTextpos', 'ctThumbSkinAn'].forEach((id) => {
      if (el(id)) el(id).oninput = thumbnailZeichnen;
      if (el(id)) el(id).onchange = thumbnailZeichnen;
    });
    if (el('ctThumbNeu')) el('ctThumbNeu').onclick = thumbnailZeichnen;
    if (el('ctThumbSpeichern')) el('ctThumbSpeichern').onclick = () => {
      const c = el('ctThumbCanvas'); if (!c) return;
      try {
        const a = document.createElement('a');
        a.href = c.toDataURL('image/png'); a.download = `thumbnail-${Date.now()}.png`;
        document.body.appendChild(a); a.click(); a.remove();
        const ok = el('ctThumbGespeichert'); if (ok) { ok.hidden = false; setTimeout(() => { ok.hidden = true; }, 2500); }
      } catch (e) { alert('Speichern nicht möglich: ' + (e && e.message)); }
    };
  }

  // Färbt einen (transparenten) Skin-Render einfarbig ein → Silhouette auf einer
  // Offscreen-Leinwand. Damit bauen wir Kontur, Schlagschatten und Glow (der Skin
  // „poppt" so vom Hintergrund, statt flach draufgeklatscht zu wirken).
  function silhouette(img, w, h, farbe) {
    const t = document.createElement('canvas'); t.width = Math.max(1, Math.ceil(w)); t.height = Math.max(1, Math.ceil(h));
    const g = t.getContext('2d');
    g.drawImage(img, 0, 0, w, h);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = farbe; g.fillRect(0, 0, w, h);
    return t;
  }

  // Zeichnet das Thumbnail auf Profi-Niveau: kräftiger Hintergrund (Spotlight +
  // Bokeh + Vignette), die Skin-Figur mit weichem Schlagschatten, Akzent-Glow und
  // weißer Sticker-Kontur (damit sie sich klar abhebt), dann großer, fetter Text
  // mit dickem Rand und Schatten. Best Practices: ein Motiv, hoher Kontrast, lesbar.
  function thumbnailZeichnen() {
    const c = el('ctThumbCanvas'); if (!c) return;
    if (!gewaehltesBild && !(genFarben.length || thumbModus === 'beschreibung')) return;
    const ctx = c.getContext('2d'); const W = c.width; const H = c.height;
    ctx.clearRect(0, 0, W, H); ctx.filter = 'none'; ctx.globalAlpha = 1;
    const pos = el('ctThumbTextpos') ? el('ctThumbTextpos').value : 'links';
    const skinAn = el('ctThumbSkinAn') ? el('ctThumbSkinAn').checked : true;
    const figurX = pos === 'links' ? W * 0.70 : (pos === 'mitte' ? W * 0.5 : W * 0.30);
    const akzent = genFarben[1] || genFarben[0] || '#ff8a1e';

    // --- Hintergrund ---
    if (gewaehltesBild) {
      const iw = gewaehltesBild.width; const ih = gewaehltesBild.height;
      const skala = Math.max(W / iw, H / ih);
      const dw = iw * skala; const dh = ih * skala;
      ctx.drawImage(gewaehltesBild, (W - dw) / 2, (H - dh) / 2, dw, dh);
    } else {
      const f1 = genFarben[0] || '#233a6b'; const f2 = genFarben[2] || '#0a0e18';
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, f1); g.addColorStop(1, f2);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // weiche große Bokeh-Kreise für Tiefe
      ctx.save();
      const bokeh = [[W * 0.2, H * 0.3, 120], [W * 0.85, H * 0.7, 170], [W * 0.6, H * 0.2, 90], [W * 0.4, H * 0.85, 140]];
      bokeh.forEach(([bx, by, br], i) => {
        ctx.globalAlpha = 0.12; ctx.fillStyle = i % 2 ? akzent : '#ffffff';
        ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
      });
      ctx.restore();
    }
    // Spotlight hinter der Figur
    if (skinAn && skinBild) {
      const gl = ctx.createRadialGradient(figurX, H * 0.5, 20, figurX, H * 0.5, H * 0.8);
      gl.addColorStop(0, hexRgba(akzent, 0.6)); gl.addColorStop(0.5, hexRgba(akzent, 0.18)); gl.addColorStop(1, hexRgba(akzent, 0));
      ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
    }
    // Vignette
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, W * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    // Textseite abdunkeln
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    if (pos === 'rechts') { grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(0,0,0,0.62)'); }
    else if (pos === 'mitte') { grad.addColorStop(0, 'rgba(0,0,0,0.18)'); grad.addColorStop(0.5, 'rgba(0,0,0,0.55)'); grad.addColorStop(1, 'rgba(0,0,0,0.18)'); }
    else { grad.addColorStop(0, 'rgba(0,0,0,0.62)'); grad.addColorStop(1, 'rgba(0,0,0,0)'); }
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

    // --- Skin-Figur mit Schatten, Glow und Kontur ---
    if (skinAn && skinBild && skinBild.width) {
      const sh = H * 0.98; const sw = skinBild.width * (sh / skinBild.height);
      const sx = pos === 'links' ? W - sw - 10 : (pos === 'mitte' ? (W - sw) / 2 : 10);
      const sy = H - sh;
      // 1) weicher Schlagschatten
      try {
        ctx.save(); ctx.filter = 'blur(16px)'; ctx.globalAlpha = 0.55;
        ctx.drawImage(silhouette(skinBild, sw, sh, '#000'), sx + 18, sy + 14, sw, sh);
        ctx.restore();
      } catch { /* filter evtl. nicht verfügbar – ohne Schatten weiter */ }
      // 2) Akzent-Glow (weich) direkt hinter der Figur
      try {
        ctx.save(); ctx.filter = 'blur(22px)'; ctx.globalAlpha = 0.7;
        ctx.drawImage(silhouette(skinBild, sw, sh, akzent), sx, sy, sw, sh);
        ctx.restore();
      } catch { /* egal */ }
      // 3) weiße Sticker-Kontur (mehrfach versetzt für gleichmäßigen Rand)
      const weiss = silhouette(skinBild, sw, sh, '#ffffff');
      const ol = Math.max(5, sw * 0.028);
      ctx.save(); ctx.globalAlpha = 1;
      for (let a = 0; a < 20; a++) { const ang = (a / 20) * Math.PI * 2; ctx.drawImage(weiss, sx + Math.cos(ang) * ol, sy + Math.sin(ang) * ol, sw, sh); }
      ctx.restore();
      // 4) der echte Skin obendrauf
      ctx.drawImage(skinBild, sx, sy, sw, sh);
    }

    // --- Text: groß, fett, dicker Rand + Schatten ---
    const text = (el('ctThumbText') ? el('ctThumbText').value : '').toUpperCase().trim();
    if (text) {
      const farbe = el('ctThumbFarbe') ? el('ctThumbFarbe').value : '#ffdd00';
      const worte = text.split(/\s+/);
      const zeilen = []; let z = '';
      worte.forEach((w) => { if ((z + ' ' + w).trim().length > 11) { if (z) zeilen.push(z); z = w; } else z = (z + ' ' + w).trim(); });
      if (z) zeilen.push(z);
      const laengste = Math.max(...zeilen.map((l) => l.length), 4);
      const textBreite = pos === 'mitte' ? W * 0.9 : W * 0.56;
      const groesse = Math.max(46, Math.min(170, Math.floor((textBreite / laengste) * 1.85)));
      ctx.font = `900 ${groesse}px "Arial Black", Arial, sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = pos === 'rechts' ? 'right' : (pos === 'mitte' ? 'center' : 'left');
      const x = pos === 'rechts' ? W - 56 : (pos === 'mitte' ? W / 2 : 56);
      const zh = groesse * 1.02;
      let y = H / 2 - (zeilen.length * zh) / 2 + zh / 2;
      ctx.lineJoin = 'round';
      zeilen.forEach((l) => {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = groesse * 0.12; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = groesse * 0.06;
        ctx.lineWidth = groesse * 0.22; ctx.strokeStyle = '#000'; ctx.strokeText(l, x, y);
        ctx.restore();
        ctx.fillStyle = farbe; ctx.fillText(l, x, y);
        y += zh;
      });
    }
    ctx.filter = 'none';
  }

  // ---- Reiter 4: Kanal (Profil-CRUD) ----
  function kanalVerdrahten() {
    if (el('ctKanalWahl')) el('ctKanalWahl').onchange = async () => {
      await j.contentProfilAktiv(el('ctKanalWahl').value);
      await laden();
    };
    if (el('contentAktiv')) el('contentAktiv').onchange = async () => {
      try { await j.setzen('content.aktiv', el('contentAktiv').checked); } catch { /* egal */ }
      laden();
    };
    if (el('contentProfilNeu')) el('contentProfilNeu').onclick = async () => {
      const name = prompt('Name des neuen Kanals:'); if (!name) return;
      const v = await j.contentProfilVorlage(name);
      const r = await j.contentProfilSpeichern(v);
      if (r && r.profil) { await j.contentProfilAktiv(r.profil.id); }
      await laden();
    };
    if (el('contentProfilLoeschen')) el('contentProfilLoeschen').onclick = async () => {
      if (!aktivId || !confirm('Diesen Kanal wirklich löschen?')) return;
      await j.contentProfilLoeschen(aktivId); await laden();
    };
    if (el('contentProfilExport')) el('contentProfilExport').onclick = async () => {
      const r = await j.contentProfilExport(aktivId);
      if (r && r.json) { try { await navigator.clipboard.writeText(r.json); alert('Kanal-Profil in die Zwischenablage kopiert.'); } catch { alert(r.json); } }
    };
    if (el('contentProfilImport')) el('contentProfilImport').onclick = async () => {
      let txt = ''; try { txt = await navigator.clipboard.readText(); } catch { /* keine Berechtigung */ }
      if (!txt) { alert('Kopiere zuerst ein Profil-JSON in die Zwischenablage.'); return; }
      const r = await j.contentProfilImport(txt);
      if (r && r.fehler) { alert(r.fehler); return; }
      alert(`${(r && r.anzahl) || 0} Profil(e) importiert.`); await laden();
    };
    if (el('cfOrdnerWaehlen')) el('cfOrdnerWaehlen').onclick = async () => {
      const r = await j.contentOrdnerWaehlen();
      if (r && r.ordner) { const o = el('cfOrdnerAnzeige'); o.dataset.pfad = r.ordner; o.textContent = r.ordner; }
    };
    if (el('cfAvatarWaehlen')) el('cfAvatarWaehlen').onclick = async () => {
      const r = await j.contentBildWaehlen();
      if (r && r.datenUrl) { const av = el('cfAvatarBild'); av.dataset.url = r.datenUrl; av.src = r.datenUrl; av.hidden = false; }
    };
    if (el('contentProfilSpeichern')) el('contentProfilSpeichern').onclick = async () => {
      const r = await j.contentProfilSpeichern(formLesen());
      if (r && r.fehler) { alert(r.fehler); return; }
      if (r && r.profil) aktivId = r.profil.id;
      const ok = el('contentGespeichert'); if (ok) { ok.hidden = false; setTimeout(() => { ok.hidden = true; }, 2000); }
      await laden();
    };
  }

  function verdrahten() {
    tabsVerdrahten();
    auftraegeVerdrahten();
    planVerdrahten();
    thumbVerdrahten();
    kanalVerdrahten();
  }

  function start() {
    if (!document.getElementById('ansichtContent')) return;
    verdrahten();
    laden();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
