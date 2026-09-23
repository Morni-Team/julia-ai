'use strict';

const crypto = require('crypto');

// Eine Runde über die OpenAI-kompatible Chat-Schnittstelle (OpenAI, Gemini,
// Mistral, Groq, OpenRouter, Ollama, LM Studio …). Julia führt ihren Verlauf im
// Anthropic-Format; hier wird er übersetzt und die Antwort zurück in dieselbe
// Form gebracht. So bleiben Ampel, Freigaben und Werkzeuge für alle Anbieter
// genau gleich.

function textVon(inhalt) {
  if (typeof inhalt === 'string') return inhalt;
  return (inhalt || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
}

function bilderVon(inhalt) {
  return Array.isArray(inhalt) ? inhalt.filter((b) => b.type === 'image' && b.source && b.source.type === 'base64') : [];
}

const bildTeil = (b) => ({ type: 'image_url', image_url: { url: `data:${b.source.media_type};base64,${b.source.data}` } });

// Werkzeug-Schemas als "functions". Felder ohne Typ (z. B. "wert" beim
// Einstellen) werden als JSON-Text beschrieben und nach der Antwort wieder
// eingelesen – manche Anbieter lehnen Schemas ohne Typ ab.
function werkzeugeUmwandeln(defs) {
  const ohneTyp = new Map();
  const tools = (defs || []).map((d) => {
    const schema = JSON.parse(JSON.stringify(d.input_schema || {}));
    schema.type = 'object';
    schema.properties = schema.properties || {};
    for (const [k, p] of Object.entries(schema.properties)) {
      if (!p.type && !p.anyOf && !p.enum) {
        p.type = 'string';
        p.description = `${p.description || ''} Als JSON-Text angeben.`.trim();
        if (!ohneTyp.has(d.name)) ohneTyp.set(d.name, new Set());
        ohneTyp.get(d.name).add(k);
      }
    }
    return { type: 'function', function: { name: d.name, description: d.description || '', parameters: schema } };
  });
  return { tools, ohneTyp };
}

// Zählt, wie viele Bilder (direkt oder in Werkzeug-Ergebnissen) im Verlauf stehen.
function bilderZaehlen(verlauf) {
  let n = 0;
  for (const m of verlauf || []) {
    const bl = typeof m.content === 'string' ? [] : m.content || [];
    for (const b of bl) {
      if (b.type === 'image' && b.source) n++;
      else if (b.type === 'tool_result') n += bilderVon(b.content).length;
    }
  }
  return n;
}

// bildBehalten: nur die letzten N Screenshots mitschicken (ältere kosten bei jeder
// Runde erneut Tokens – wie das serverseitige Clearing auf der Anthropic-Seite).
// 0/false = alle behalten. ohneBild sticht (dann sind sowieso keine Bilder dabei).
function verlaufUmwandeln(system, verlauf, { zwischenAntwort = false, ohneBild = false, bildBehalten = 3 } = {}) {
  const out = [{ role: 'system', content: system }];
  const gesamt = (!ohneBild && bildBehalten) ? bilderZaehlen(verlauf) : 0;
  const abSchnitt = bildBehalten ? Math.max(0, gesamt - bildBehalten) : 0;
  let bildNr = 0;
  // true = dieses Bild ist ein älteres → weglassen (nur die letzten N bleiben).
  const zuAlt = () => (!!bildBehalten && bildNr++ < abSchnitt);
  for (const m of verlauf || []) {
    const bloecke = typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : m.content || [];
    if (m.role === 'assistant') {
      const text = bloecke.filter((b) => b.type === 'text').map((b) => b.text).join('');
      const aufrufe = bloecke.filter((b) => b.type === 'tool_use').map((b) => ({
        id: b.id, type: 'function', function: { name: b.name, arguments: JSON.stringify(b.input || {}) },
      }));
      if (!text && !aufrufe.length) continue;
      out.push({ role: 'assistant', content: text || null, ...(aufrufe.length ? { tool_calls: aufrufe } : {}) });
      continue;
    }
    const bilder = [];
    const teile = [];
    for (const b of bloecke) {
      if (b.type === 'tool_result') {
        const roh = textVon(b.content);
        const eigen = bilderVon(b.content);
        const hatBild = eigen.length > 0;
        let t;
        if (ohneBild && hatBild) t = `${roh ? `${roh} ` : ''}[screenshot omitted: this model has no image support]`;
        else t = roh || (hatBild ? 'Bild folgt in der nächsten Nachricht.' : 'ok');
        out.push({ role: 'tool', tool_call_id: b.tool_use_id, content: b.is_error ? `FEHLER: ${t}` : t });
        if (!ohneBild) for (const bild of eigen) { if (!zuAlt()) bilder.push(bild); }
      } else if (b.type === 'text') {
        teile.push({ type: 'text', text: b.text });
      } else if (b.type === 'image' && b.source) {
        if (ohneBild) teile.push({ type: 'text', text: '[screenshot omitted: this model has no image support]' });
        else if (zuAlt()) teile.push({ type: 'text', text: '[älterer Screenshot entfernt, um Tokens zu sparen]' });
        else teile.push(bildTeil(b));
      }
    }
    // Bilder dürfen in Werkzeug-Nachrichten nicht stehen – sie kommen direkt danach.
    if (bilder.length) {
      if (zwischenAntwort) out.push({ role: 'assistant', content: 'Ich sehe mir die Bilder an.' });
      out.push({ role: 'user', content: [{ type: 'text', text: 'Bilder aus den Werkzeug-Ergebnissen:' }, ...bilder.map(bildTeil)] });
    }
    if (teile.length) out.push({ role: 'user', content: teile.every((t) => t.type === 'text') ? teile.map((t) => t.text).join('\n') : teile });
  }
  return out;
}

async function* zeilen(body) {
  const leser = body.getReader();
  const dekoder = new TextDecoder();
  let rest = '';
  for (;;) {
    const { done, value } = await leser.read();
    if (done) break;
    rest += dekoder.decode(value, { stream: true });
    let i;
    while ((i = rest.indexOf('\n')) >= 0) {
      yield rest.slice(0, i).replace(/\r$/, '');
      rest = rest.slice(i + 1);
    }
  }
  rest += dekoder.decode();
  if (rest) yield rest;
}

function fehlerAus(status, text) {
  let meldung = text;
  try {
    let j = JSON.parse(text);
    if (Array.isArray(j)) j = j[0];
    meldung = (j.error && (j.error.message || (typeof j.error === 'string' ? j.error : ''))) || j.message || j.detail || text;
  } catch { /* Klartext */ }
  meldung = String(meldung || `HTTP ${status}`);
  // Häufiger Fall bei eigenen/anderen Anbietern: das gewählte Modell kann keine
  // Bilder/Screenshots verarbeiten. Statt der kryptischen Anbieter-Meldung ein
  // klarer Hinweis, was zu tun ist.
  if (/\b(image|images|vision|multimodal|modalit|image_url)\b/i.test(meldung)) {
    meldung = `Das gewählte Modell versteht offenbar keine Bilder/Screenshots. Wähle ein Modell mit Bild-Unterstützung, oder arbeite ohne Screenshots (z. B. „Seite abrufen“ für Webinhalte). Meldung des Dienstes: ${meldung}`;
  }
  // Der Anbieter/das Modell kennt „reasoning_effort" nicht (viele Nicht-Denk-Modelle
  // lehnen den Parameter mit 400 ab). Wird als reasoningFehler markiert, damit der
  // Agent die Runde einmal ohne den Parameter wiederholen kann (Issue #79).
  const reasoningFehler = status === 400 && /reasoning[_.\s-]?effort|reasoning/i.test(meldung);
  return Object.assign(new Error(meldung.slice(0, 500)), { status, bildFehler: /versteht offenbar keine Bilder/.test(meldung), reasoningFehler });
}

// Julias Denkaufwand → OpenAI-Wert. xhigh/max gibt es dort nicht → auf „high".
const REASONING_EFFORT = { low: 'low', medium: 'medium', high: 'high', xhigh: 'high', max: 'high' };

// Eine Runde: schickt den Verlauf, streamt den Text über beiText und liefert
// { content, stop_reason, model, usage } im Anthropic-Format zurück.
async function runde({ url, schluessel, modell, system, werkzeuge, verlauf, signal, beiText = () => {}, beiDenken = () => {}, holen = (u, o) => globalThis.fetch(u, o), optionen = {} }) {
  const { tools, ohneTyp } = werkzeugeUmwandeln(werkzeuge);
  const body = {
    model: modell,
    messages: verlaufUmwandeln(system, verlauf, optionen),
    stream: true,
    ...(tools.length ? { tools, tool_choice: 'auto' } : {}),
    ...(optionen.maxTokens ? { max_tokens: optionen.maxTokens } : {}),
    ...(optionen.nutzung ? { stream_options: { include_usage: true } } : {}),
    ...(optionen.aufwand && REASONING_EFFORT[optionen.aufwand] ? { reasoning_effort: REASONING_EFFORT[optionen.aufwand] } : {}),
  };
  const kopf = { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...(optionen.kopf || {}) };
  if (schluessel) kopf.Authorization = `Bearer ${schluessel}`;

  let r;
  try {
    r = await holen(`${url}/chat/completions`, { method: 'POST', headers: kopf, body: JSON.stringify(body), signal });
  } catch (e) {
    if (signal && signal.aborted) throw e;
    let host = url;
    try { host = new URL(url).host; } catch { /* Adresse wie eingegeben */ }
    throw Object.assign(new Error(`Keine Verbindung zu ${host}: ${e.message}`), { verbindung: true });
  }
  if (!r.ok) {
    let text = '';
    try { text = await r.text(); } catch { /* leer */ }
    throw fehlerAus(r.status, text);
  }

  let text = '';
  let grund = null;
  let nutzung = null;
  let modellAntwort = modell;
  const aufrufe = [];
  const verarbeiten = (j) => {
    if (j.error) throw fehlerAus(j.error.code || 500, JSON.stringify(j));
    if (j.model) modellAntwort = j.model;
    if (j.usage) nutzung = j.usage;
    const c = j.choices && j.choices[0];
    if (!c) return;
    const d = c.delta || c.message || {};
    if (typeof d.content === 'string' && d.content) {
      text += d.content;
      beiText(d.content);
    }
    // Reasoning-/Denk-Schritt streamen (Issue #74/#77): viele OpenAI-kompatible
    // Anbieter (z. B. DeepSeek) senden ihn als reasoning_content bzw. reasoning.
    // Die Oberfläche zeigt ihn in der eingeklappten Box; er zählt NICHT zur Antwort.
    const denk = d.reasoning_content ?? d.reasoning;
    if (typeof denk === 'string' && denk) beiDenken(denk);
    for (const t of d.tool_calls || []) {
      const i = Number.isInteger(t.index) ? t.index : aufrufe.length;
      const z = aufrufe[i] || (aufrufe[i] = { id: '', name: '', args: '' });
      if (t.id) z.id = t.id;
      if (t.function && t.function.name && !z.name) z.name = t.function.name;
      if (t.function && t.function.arguments != null) {
        z.args += typeof t.function.arguments === 'string' ? t.function.arguments : JSON.stringify(t.function.arguments);
      }
    }
    if (c.finish_reason) grund = c.finish_reason;
  };

  if (!/event-stream/.test(r.headers.get('content-type') || '')) {
    verarbeiten(await r.json());
  } else {
    for await (const zeile of zeilen(r.body)) {
      if (!zeile.startsWith('data:')) continue;
      const daten = zeile.slice(5).trim();
      if (daten === '[DONE]') break;
      let j;
      try { j = JSON.parse(daten); } catch { continue; }
      verarbeiten(j);
    }
  }

  const content = [];
  if (text) content.push({ type: 'text', text });
  for (const z of aufrufe.filter((x) => x && x.name)) {
    let input = {};
    try { input = z.args ? JSON.parse(z.args) : {}; } catch { input = {}; }
    if (!input || typeof input !== 'object' || Array.isArray(input)) input = {};
    for (const k of ohneTyp.get(z.name) || []) {
      if (typeof input[k] === 'string') {
        try { input[k] = JSON.parse(input[k]); } catch { /* bleibt Text */ }
      }
    }
    content.push({ type: 'tool_use', id: z.id || `call_${crypto.randomBytes(6).toString('hex')}`, name: z.name, input });
  }
  let stop = 'end_turn';
  if (content.some((b) => b.type === 'tool_use')) stop = 'tool_use';
  else if (grund === 'length') stop = 'max_tokens';
  else if (grund === 'content_filter') stop = 'refusal';
  return {
    content,
    stop_reason: stop,
    model: modellAntwort,
    usage: nutzung ? { input_tokens: nutzung.prompt_tokens || 0, output_tokens: nutzung.completion_tokens || 0 } : null,
  };
}

async function modelleLaden({ url, schluessel, holen = (u, o) => globalThis.fetch(u, o) }) {
  const r = await holen(`${url}/models`, { headers: schluessel ? { Authorization: `Bearer ${schluessel}` } : {} });
  if (!r.ok) throw fehlerAus(r.status, await r.text().catch(() => ''));
  const j = await r.json();
  const liste = Array.isArray(j.data) ? j.data : Array.isArray(j.models) ? j.models : [];
  return [...new Set(liste.map((m) => String(m.id || m.name || '').replace(/^models\//, '')).filter(Boolean))].sort();
}

module.exports = { runde, modelleLaden, verlaufUmwandeln, werkzeugeUmwandeln, fehlerAus };
