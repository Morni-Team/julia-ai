'use strict';

// Minecraft: Server beitreten, Konto verbinden, Aufgaben geben, Chat.
// Die Spielfigur selbst läuft im Hauptprozess (src/main/minecraft.js).

(() => {
  if (imOverlay) return;

  let stand = null;
  let timer = null;
  let gefuellt = false; // Felder nur einmal aus der Konfiguration füllen
  let chatAn = true; // In-Game-Chat im Tab anzeigen (per Schalter abschaltbar)

  function fehler(text) {
    $('mcFehler').textContent = text || '';
    $('mcFehler').hidden = !text;
  }

  const voiceText = (v) => tx(`mc.vc_${(v && v.zustand) || 'aus'}`, { version: (v && v.version) || '' });

  function werteZeigen(s) {
    const kachel = $('mcInventarKachel');
    if (kachel) kachel.hidden = !s.verbunden; // Inventar-Bereich nur zeigen, wenn verbunden
    const box = $('mcWerte');
    box.hidden = !s.verbunden;
    if (!s.verbunden) { box.innerHTML = ''; return; }
    const a = s.aufgabe;
    const aufgabe = a ? tx(`mc.l_${a.art}`, { spieler: a.spieler || '', n: a.geschafft || 0, ort: a.ort || '' }) : tx('mc.l_frei');
    const spieler = (s.spieler || []).map((p) => (p.abstand != null ? `${p.name} (${p.abstand} m)` : p.name)).join(', ');
    const feinde = Object.entries(s.feinde_nah || {}).map(([n, z]) => `${z}× ${n}`).join(', ');
    box.innerHTML = [
      ['mc.w_figur', `${s.name} · ${s.version}`],
      ['mc.w_leben', `❤ ${s.leben}/20 · 🍗 ${s.hunger}/20`],
      ['mc.w_ort', `${s.position.x} / ${s.position.y} / ${s.position.z}`],
      ['mc.w_aufgabe', aufgabe],
      ['mc.w_spieler', spieler || '–'],
      ['mc.w_feinde', feinde || '–'],
      ['mc.w_voice', voiceText(s.stimme)],
    ].map(([k, v]) => `<div><span>${esc(tx(k))}</span><b>${esc(v)}</b></div>`).join('');
    inventarZeigen(s);
    erlaubteZeigen(s);
  }

  // Einzelne erlaubte Spieler (auf die Julia zusätzlich hört) als Chips mit ✕.
  function erlaubteZeigen(s) {
    const box = $('mcErlaubteListe');
    if (!box) return;
    const liste = (s && s.erlaubte) || [];
    if (!liste.length) { box.innerHTML = `<span class="mc-inv-leer">${esc(tx('mc.erlaubte_leer'))}</span>`; return; }
    box.innerHTML = '';
    for (const name of liste) {
      const chip = document.createElement('span');
      chip.className = 'mc-erlaubt-chip';
      chip.append(Object.assign(document.createElement('span'), { textContent: name }));
      const weg = document.createElement('button');
      weg.className = 'mc-erlaubt-weg';
      weg.type = 'button';
      weg.textContent = '✕';
      weg.title = tx('mc.erlaubte_weg');
      weg.onclick = () => erlaubteSetzen(liste.filter((n) => n.toLowerCase() !== name.toLowerCase()));
      chip.append(weg);
      box.append(chip);
    }
  }

  async function erlaubteSetzen(neu) {
    const r = await julia.setzen('minecraft.erlaubte', neu);
    if (r && r.fehler) { fehler(r.fehler); return; }
    laden();
  }

  // Einen Gegenstandsnamen lesbar machen: „oak_planks" → „Oak Planks".
  function itemHuebsch(name) {
    return String(name).split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  // Inventar als eigener Bereich (Kachel), als Reihe von Chips „Name ×Anzahl".
  function inventarZeigen(s) {
    const box = $('mcInventar');
    if (!box) return;
    const eintraege = Object.entries((s && s.inventar) || {});
    if (!s || !s.verbunden || !eintraege.length) {
      box.innerHTML = `<p class="mc-inv-leer">${esc(tx('mc.inv_leer'))}</p>`;
      return;
    }
    box.innerHTML = eintraege
      .sort((a, b) => b[1] - a[1])
      .map(([n, z]) => `<span class="mc-inv-item"><span class="mc-inv-name">${esc(itemHuebsch(n))}</span><span class="mc-inv-zahl">${esc(z)}</span></span>`)
      .join('');
  }

  // Crash-Screen: Warum ist die Figur vom Server geflogen – und kommt sie zurück?
  const aufgabeName = (art) => {
    const k = `mc.a_${art}`;
    const t = tx(k);
    return t !== k ? t : tx(`mc.${art}`);
  };

  function dauerText(s) {
    if (s < 60) return tx('mc.dauer_s', { n: s });
    const m = Math.round(s / 60);
    return m < 60 ? tx('mc.dauer_min', { n: m }) : tx('mc.dauer_std', { h: Math.floor(m / 60), m: m % 60 });
  }

  function crashZeigen(t) {
    $('mcCrash').hidden = !t;
    if (!t) return;
    $('mcCrashArt').textContent = tx(t.rauswurf ? 'mc.crash_rauswurf' : 'mc.crash_verbindung');
    $('mcCrashGrund').textContent = t.grund;
    const uhr = new Date(t.zeit).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const infos = [
      [tx('mc.crash_wann'), tx('mc.crash_wann_wert', { zeit: uhr, dauer: dauerText(t.dauerS || 0) })],
      [tx('mc.crash_server'), t.server || '–'],
    ];
    if (t.aufgabe) infos.push([tx('mc.crash_aufgabe'), aufgabeName(t.aufgabe)]);
    if (t.fehler && t.fehler !== t.grund) infos.push([tx('mc.crash_fehler'), t.fehler]);
    $('mcCrashInfos').innerHTML = infos.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
    let v = '';
    if (t.naechsterVersuch) v = tx('mc.crash_versuch', { s: Math.max(0, Math.ceil((t.naechsterVersuch - Date.now()) / 1000)), n: t.versuch, max: 3 });
    else if (t.aufgegeben) v = tx('mc.crash_aufgegeben');
    else if (t.rauswurf) v = tx('mc.crash_kein_versuch');
    $('mcCrashVersuch').textContent = v;
  }

  function kleinerKnopf(text, klick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'knopf klein';
    b.textContent = text;
    b.onclick = klick;
    return b;
  }

  // Voice-Chat-Gruppen: nur neu zeichnen, wenn sich etwas geändert hat –
  // sonst leerte das Aktualisieren alle 1,5 s das Passwortfeld beim Tippen.
  let gruppenSig = '';
  function gruppenZeigen(s) {
    const v = s.stimme || {};
    const gruppen = v.gruppen || [];
    let leer = '';
    if (!s.verbunden) leer = tx('mc.gruppen_offline');
    else if (v.zustand !== 'verbunden') leer = tx('mc.gruppen_kein_vc');
    else if (!gruppen.length) leer = tx('mc.gruppen_keine');
    $('mcGruppenLeer').textContent = leer;
    $('mcGruppenLeer').hidden = !leer;
    $('mcGruppeGemerktZeile').hidden = !s.gruppeGemerkt;
    $('mcGruppeGemerkt').textContent = s.gruppeGemerkt ? tx('mc.gruppe_gemerkt', { gruppe: s.gruppeGemerkt }) : '';
    const sig = JSON.stringify([gruppen, v.gruppe, v.gruppeFehler, document.documentElement.lang]);
    if (sig === gruppenSig) return;
    gruppenSig = sig;
    if (v.gruppeFehler === 'passwort') fehler(tx('mc.gruppe_falsch'));
    const liste = $('mcGruppenListe');
    liste.replaceChildren();
    for (const g of gruppen) {
      const drin = v.gruppe === g.id;
      const li = document.createElement('li');
      li.classList.toggle('drin', drin);
      const kopf = document.createElement('div');
      kopf.className = 'mc-gruppe-kopf';
      const name = document.createElement('b');
      name.textContent = `${g.passwort ? '🔒 ' : ''}${g.name}`;
      const art = document.createElement('small');
      art.textContent = tx(`mc.gruppe_${g.art}`) + (drin ? ` · ${tx('mc.gruppe_drin')}` : '');
      kopf.append(name, art);
      const reihe = document.createElement('div');
      reihe.className = 'mc-zeile';
      if (drin) {
        reihe.append(kleinerKnopf(tx('mc.gruppe_verlassen'), async () => {
          fehler('');
          const r = await julia.mcGruppeVerlassen();
          if (r.fehler) fehler(r.fehler);
        }));
      } else {
        let pw = null;
        if (g.passwort) {
          pw = document.createElement('input');
          pw.type = 'password';
          pw.maxLength = 512;
          pw.autocomplete = 'off';
          pw.placeholder = tx('mc.gruppe_passwort');
          pw.setAttribute('aria-label', `${tx('mc.gruppe_passwort')}: ${g.name}`);
          reihe.append(pw);
        }
        reihe.append(kleinerKnopf(tx('mc.gruppe_beitreten'), async () => {
          fehler('');
          if (pw && !pw.value) { pw.focus(); return; }
          const r = await julia.mcGruppeBeitreten(g.id, pw ? pw.value : '', $('mcGruppeMerken').checked);
          if (pw) pw.value = '';
          if (r.fehler) fehler(r.fehler);
          laden();
        }));
      }
      li.append(kopf, reihe);
      liste.append(li);
    }
  }

  function zielZeigen(s, an) {
    const z = s.ziel || {};
    $('mcZielLos').hidden = !!z.laeuft;
    $('mcZielLos').disabled = !an;
    $('mcZielStopp').hidden = !z.laeuft;
    $('mcZielStand').textContent = z.laeuft ? tx('mc.ziel_laeuft') : '';
    $('mcZielErgebnis').hidden = !z.ergebnis || !!z.laeuft;
    $('mcZielErgebnis').textContent = z.ergebnis || '';
  }

  function zeigen(s) {
    stand = s;
    const an = !!s.verbunden;
    crashZeigen(!an && s.trennung);
    gruppenZeigen(s);
    zielZeigen(s, an);
    $('mcZustand').textContent = an ? tx('mc.verbunden', { server: s.server }) : tx('mc.getrennt');
    $('mcZustand').classList.toggle('an', an);
    $('mcBeitreten').hidden = an;
    $('mcVerlassen').hidden = !an;
    $('mcAdresse').disabled = an;
    $('mcSpieler').disabled = an;
    if (!gefuellt) {
      gefuellt = true;
      $('mcAdresse').value = s.adresse ? (s.port && s.port !== 25565 ? `${s.adresse}:${s.port}` : s.adresse) : '';
      $('mcSpieler').value = s.meinName || '';
    }
    $('mcKontoText').textContent = s.konto ? tx('mc.konto_an', { konto: s.konto }) : tx('mc.konto_aus');
    $('mcKontoVerbinden').hidden = !!s.konto;
    $('mcKontoAbmelden').hidden = !s.konto;
    document.querySelectorAll('#mcAufgaben button, #mcSenden button').forEach((b) => { b.disabled = !an; });
    werteZeigen(s);
    const z = $('mcZeilen');
    z.hidden = !chatAn; // Nachrichtenliste per Schalter aus
    const zeilen = s.chat || [];
    z.innerHTML = zeilen.length
      ? zeilen.map((l) => `<p>${esc(l)}</p>`).join('')
      : `<p class="rt-leer">${esc(tx(an ? 'mc.chat_leer' : 'mc.chat_aus'))}</p>`;
    z.scrollTop = z.scrollHeight;
  }

  async function laden() {
    try { zeigen(await julia.mcStatus()); } catch { /* Fenster wird geschlossen */ }
  }

  // Leben, Aufgabe und Chat aktuell halten, solange der Reiter offen ist.
  function beobachten() {
    clearInterval(timer);
    timer = setInterval(() => {
      if (document.body.dataset.ansicht === 'minecraft') laden();
      else clearInterval(timer);
    }, 1500);
  }

  async function aufgabe(daten) {
    fehler('');
    const r = await julia.mcAufgabe(daten);
    if (r.fehler) fehler(r.fehler);
    laden();
  }

  $('mcBeitreten').onclick = async () => {
    const b = $('mcBeitreten');
    fehler('');
    b.disabled = true;
    const r = await julia.mcBeitreten({ adresse: $('mcAdresse').value, spieler: $('mcSpieler').value });
    b.disabled = false;
    if (r.fehler) fehler(r.fehler);
    laden();
  };
  $('mcVerlassen').onclick = async () => { await julia.mcVerlassen(); laden(); };
  document.querySelectorAll('.mc-aufgabe').forEach((b) => { b.onclick = () => aufgabe({ aufgabe: b.dataset.aufgabe }); });
  $('mcAbbauen').onsubmit = (e) => {
    e.preventDefault();
    const block = $('mcBlock').value.trim();
    if (!block) { $('mcBlock').focus(); return; }
    aufgabe({ aufgabe: 'abbauen', block, anzahl: $('mcAnzahl').value });
  };
  $('mcGeben').onsubmit = (e) => {
    e.preventDefault();
    const item = $('mcGebenItem').value.trim();
    if (!item) { $('mcGebenItem').focus(); return; }
    aufgabe({ aufgabe: 'geben', item, anzahl: $('mcGebenAnzahl').value });
  };
  $('mcHerstellen').onsubmit = (e) => {
    e.preventDefault();
    const item = $('mcHerstellenItem').value.trim();
    if (!item) { $('mcHerstellenItem').focus(); return; }
    aufgabe({ aufgabe: 'herstellen', item, anzahl: $('mcHerstellenAnzahl').value });
  };
  $('mcGehen').onsubmit = (e) => {
    e.preventDefault();
    if ($('mcX').value === '' || $('mcZ').value === '') { ($('mcX').value === '' ? $('mcX') : $('mcZ')).focus(); return; }
    aufgabe({ aufgabe: 'gehen', x: $('mcX').value, y: $('mcY').value, z: $('mcZ').value });
  };
  $('mcZielForm').onsubmit = async (e) => {
    e.preventDefault();
    const text = $('mcZielText').value.trim();
    if (!text) { $('mcZielText').focus(); return; }
    fehler('');
    const r = await julia.mcZiel(text);
    if (r.fehler) fehler(r.fehler);
    laden();
  };
  $('mcZielStopp').onclick = async () => { await julia.mcZielStopp(); laden(); };
  $('mcLogbuch').onclick = () => julia.minecraftLogbuchOeffnen();
  $('mcGruppeVergessen').onclick = async () => { await julia.mcGruppeVergessen(); laden(); };
  $('mcNeu').onclick = () => $('mcBeitreten').onclick();
  $('mcCrashWeg').onclick = async () => { await julia.mcTrennungWeg(); laden(); };
  $('mcSenden').onsubmit = async (e) => {
    e.preventDefault();
    const text = $('mcChatText').value.trim();
    if (!text) return;
    const r = await julia.mcChat(text);
    if (r.fehler) fehler(r.fehler);
    else $('mcChatText').value = '';
    setTimeout(laden, 300);
  };
  $('mcKontoVerbinden').onclick = async () => {
    const b = $('mcKontoVerbinden');
    b.disabled = true;
    fehler('');
    const r = await julia.mcKontoVerbinden();
    b.disabled = false;
    $('mcCode').hidden = true;
    if (r.fehler) fehler(r.fehler);
    laden();
  };
  $('mcKontoAbmelden').onclick = async () => { await julia.mcKontoAbmelden(); laden(); };
  $('mcCodeKopieren').onclick = () => julia.kopieren($('mcCodeWert').textContent);

  // "Hey Julia" beim Spielen – derselbe Schalter wie in den Einstellungen.
  function schalterSetzen(c) {
    if (!c) return;
    if (c.weckwort) $('mcStimme').checked = !!c.weckwort.an;
    if (c.minecraft) $('mcVoice').checked = c.minecraft.stimme !== false;
    if (c.minecraft) $('mcJeder').checked = c.minecraft.jeder === true;
    if (c.minecraft && $('mcBenachrichtigen')) $('mcBenachrichtigen').value = c.minecraft.benachrichtigen || 'wichtige';
    if (c.minecraft) {
      chatAn = c.minecraft.chat_zeigen !== false;
      if ($('mcChatZeigen')) $('mcChatZeigen').checked = chatAn;
      if ($('mcZeilen')) $('mcZeilen').hidden = !chatAn;
    }
    if (c.minecraft && $('mcSozial')) {
      const an = c.minecraft.sozial === true;
      $('mcSozial').checked = an;
      if ($('mcSozialOptionen')) $('mcSozialOptionen').style.display = an ? '' : 'none';
      if ($('mcPersoenlichkeit')) $('mcPersoenlichkeit').value = c.minecraft.persoenlichkeit || 'freundlich';
      if ($('mcSozialVerzoegern')) $('mcSozialVerzoegern').checked = c.minecraft.sozial_verzoegern !== false;
      if ($('mcTokenLimit')) $('mcTokenLimit').value = c.minecraft.token_limit || 0;
      if ($('mcRuheVon')) $('mcRuheVon').value = c.minecraft.ruhe_von ?? -1;
      if ($('mcRuheBis')) $('mcRuheBis').value = c.minecraft.ruhe_bis ?? -1;
    }
  }
  async function stimmeZeigen() {
    try { schalterSetzen(await julia.config()); } catch { /* Fenster wird geschlossen */ }
  }
  $('mcStimme').onchange = async () => {
    const r = await julia.setzen('weckwort.an', $('mcStimme').checked);
    if (r && r.fehler) { fehler(r.fehler); stimmeZeigen(); }
  };
  // Simple Voice Chat: gilt ab dem nächsten Beitreten.
  $('mcVoice').onchange = async () => {
    const r = await julia.setzen('minecraft.stimme', $('mcVoice').checked);
    if (r && r.fehler) { fehler(r.fehler); stimmeZeigen(); }
  };
  // Auf alle Spieler reagieren – gilt sofort, auch im laufenden Spiel.
  $('mcJeder').onchange = async () => {
    const r = await julia.setzen('minecraft.jeder', $('mcJeder').checked);
    if (r && r.fehler) { fehler(r.fehler); stimmeZeigen(); }
  };
  // Einzelnen erlaubten Spieler hinzufügen (auf den Julia zusätzlich hört).
  if ($('mcErlaubtForm')) $('mcErlaubtForm').onsubmit = (e) => {
    e.preventDefault();
    const name = $('mcErlaubtName').value.trim();
    if (!name) return;
    const liste = (stand && stand.erlaubte) || [];
    if (!liste.some((n) => n.toLowerCase() === name.toLowerCase())) erlaubteSetzen([...liste, name]);
    $('mcErlaubtName').value = '';
  };
  // In-Game-Chat im Tab ein-/ausblenden.
  if ($('mcChatZeigen')) $('mcChatZeigen').onchange = async () => {
    chatAn = $('mcChatZeigen').checked;
    if ($('mcZeilen')) $('mcZeilen').hidden = !chatAn;
    const r = await julia.setzen('minecraft.chat_zeigen', chatAn);
    if (r && r.fehler) { fehler(r.fehler); stimmeZeigen(); }
  };
  // Wie oft Minecraft benachrichtigt (nicht ständig beim Bauen).
  if ($('mcBenachrichtigen')) $('mcBenachrichtigen').onchange = async () => {
    const r = await julia.setzen('minecraft.benachrichtigen', $('mcBenachrichtigen').value);
    if (r && r.fehler) { fehler(r.fehler); stimmeZeigen(); }
  };
  // Soziales Gedächtnis & Persönlichkeit (BETA, Issue #94).
  if ($('mcSozial')) $('mcSozial').onchange = async () => {
    const an = $('mcSozial').checked;
    if ($('mcSozialOptionen')) $('mcSozialOptionen').style.display = an ? '' : 'none';
    const r = await julia.setzen('minecraft.sozial', an);
    if (r && r.fehler) { fehler(r.fehler); stimmeZeigen(); }
  };
  if ($('mcPersoenlichkeit')) $('mcPersoenlichkeit').onchange = async () => {
    const r = await julia.setzen('minecraft.persoenlichkeit', $('mcPersoenlichkeit').value);
    if (r && r.fehler) { fehler(r.fehler); stimmeZeigen(); }
  };
  if ($('mcSozialVerzoegern')) $('mcSozialVerzoegern').onchange = async () => {
    const r = await julia.setzen('minecraft.sozial_verzoegern', $('mcSozialVerzoegern').checked);
    if (r && r.fehler) { fehler(r.fehler); stimmeZeigen(); }
  };
  if ($('mcTokenLimit')) $('mcTokenLimit').onchange = async () => {
    const r = await julia.setzen('minecraft.token_limit', Number($('mcTokenLimit').value) || 0);
    if (r && r.fehler) { fehler(r.fehler); stimmeZeigen(); }
  };
  if ($('mcRuheVon')) $('mcRuheVon').onchange = async () => {
    const r = await julia.setzen('minecraft.ruhe_von', Number($('mcRuheVon').value));
    if (r && r.fehler) { fehler(r.fehler); stimmeZeigen(); }
  };
  if ($('mcRuheBis')) $('mcRuheBis').onchange = async () => {
    const r = await julia.setzen('minecraft.ruhe_bis', Number($('mcRuheBis').value));
    if (r && r.fehler) { fehler(r.fehler); stimmeZeigen(); }
  };
  julia.on('config:geaendert', schalterSetzen);

  julia.on('mc:code', (c) => {
    $('mcCodeWert').textContent = c && c.code ? c.code : '';
    $('mcCode').hidden = !(c && c.code);
  });
  julia.on('mc:geaendert', () => { if (document.body.dataset.ansicht === 'minecraft') laden(); });

  function texte() {
    document.querySelectorAll('#ansichtMinecraft [data-nav]').forEach((el) => { el.textContent = tx(el.dataset.nav); });
    $('mcAdresse').placeholder = tx('mc.adresse_platz');
    $('mcSpieler').placeholder = tx('mc.spieler_platz');
    $('mcBlock').placeholder = tx('mc.block_platz');
    $('mcGebenItem').placeholder = tx('mc.item_platz');
    $('mcZielText').placeholder = tx('mc.ziel_platz');
    $('mcZielText').setAttribute('aria-label', tx('mc.ziel'));
    gruppenSig = ''; // Texte neu – Gruppenliste neu zeichnen
    $('mcHerstellenItem').placeholder = tx('mc.herstellen_platz');
    $('mcChatText').placeholder = tx('mc.chat_platz');
    if (stand) zeigen(stand);
  }

  window.juliaAnsichtBeimOeffnen.minecraft = () => { texte(); laden(); stimmeZeigen(); beobachten(); };
  julia.on('texte:geaendert', () => setTimeout(texte, 0));
  bereit.then(() => { if (window.juliaIcons) window.juliaIcons(document.getElementById('ansichtMinecraft')); texte(); });
})();
