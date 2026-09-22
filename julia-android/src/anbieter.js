// Anbindung an die KI-Anbieter: Anthropic (Claude) und OpenAI. Direkt vom Handy.
// Der Schlüssel kommt aus dem Keystore und wird nur im Request-Header
// mitgeschickt, nie gespeichert oder geloggt. Zurück kommen Text und – wenn der
// Anbieter sie liefert – die Tokenzahlen für die Kostenanzeige.

import { systemPrompt } from './prompt';

const ANTHROPIC_VERSION = '2023-06-01';

// Grobe Preise in USD je 1 Mio. Tokens (Eingabe/Ausgabe). Nur Schätzung für die
// Anzeige; unbekannte Modelle zählen als 0. Bei Bedarf hier anpassen.
const PREISE = {
  'claude-opus': [15, 75],
  'claude-sonnet': [3, 15],
  'claude-haiku': [0.8, 4],
  'gpt-4o-mini': [0.15, 0.6],
  'gpt-4o': [2.5, 10],
  'gpt-4.1': [2, 8],
  'o4-mini': [1.1, 4.4],
};

function kostenSchaetzen(modell, ein, aus) {
  const key = Object.keys(PREISE).find((k) => String(modell || '').includes(k));
  if (!key) return 0;
  const [pe, pa] = PREISE[key];
  return (ein / 1e6) * pe + (aus / 1e6) * pa;
}

export const ANBIETER = [
  { id: 'anthropic', name: 'Anthropic (Claude)', standardModell: 'claude-sonnet-5', schluesselHinweis: 'sk-ant-…' },
  { id: 'openai', name: 'OpenAI', standardModell: 'gpt-4o-mini', schluesselHinweis: 'sk-…' },
];

// verlauf: [{ rolle: 'user'|'assistant', text }]
// Rückgabe: { text, ein, aus, usd }
export async function antwortHolen({ anbieter = 'anthropic', modell, schluessel, einstellungen, verlauf, signal, system: systemUeber }) {
  if (!schluessel) throw new Error('Kein API-Schlüssel hinterlegt. Trag ihn in den Einstellungen ein.');
  // Eigener System-Prompt (z. B. Steuer-Modus) hat Vorrang; sonst der Chat-Prompt.
  const system = systemUeber || systemPrompt(einstellungen);
  return anbieter === 'openai'
    ? openai({ modell, schluessel, system, verlauf, signal })
    : anthropic({ modell, schluessel, system, verlauf, signal });
}

async function anthropic({ modell, schluessel, system, verlauf, signal }) {
  const m = modell || 'claude-sonnet-5';
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', 'x-api-key': schluessel, 'anthropic-version': ANTHROPIC_VERSION },
    body: JSON.stringify({
      model: m,
      max_tokens: 1024,
      system,
      messages: verlauf.map((x) => ({ role: x.rolle === 'assistant' ? 'assistant' : 'user', content: x.text })),
    }),
  });
  const daten = await pruefen(r);
  const text = Array.isArray(daten.content) ? daten.content.filter((b) => b.type === 'text').map((b) => b.text).join('') : '';
  const ein = daten.usage ? daten.usage.input_tokens || 0 : 0;
  const aus = daten.usage ? daten.usage.output_tokens || 0 : 0;
  return { text: text || '(leere Antwort)', ein, aus, usd: kostenSchaetzen(m, ein, aus) };
}

async function openai({ modell, schluessel, system, verlauf, signal }) {
  const m = modell || 'gpt-4o-mini';
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${schluessel}` },
    body: JSON.stringify({
      model: m,
      max_tokens: 1024,
      messages: [{ role: 'system', content: system }, ...verlauf.map((x) => ({ role: x.rolle === 'assistant' ? 'assistant' : 'user', content: x.text }))],
    }),
  });
  const daten = await pruefen(r);
  const text = daten.choices && daten.choices[0] && daten.choices[0].message ? daten.choices[0].message.content : '';
  const ein = daten.usage ? daten.usage.prompt_tokens || 0 : 0;
  const aus = daten.usage ? daten.usage.completion_tokens || 0 : 0;
  return { text: text || '(leere Antwort)', ein, aus, usd: kostenSchaetzen(m, ein, aus) };
}

async function pruefen(r) {
  if (r.ok) return r.json();
  let grund = `HTTP ${r.status}`;
  try { const j = await r.json(); if (j && j.error && j.error.message) grund = j.error.message; } catch { /* kein JSON */ }
  if (r.status === 401) grund = 'Der API-Schlüssel wird nicht akzeptiert. Stimmt er noch?';
  throw new Error(grund);
}

// Streaming-Variante: liefert die Antwort Wort für Wort über beiText(teilText).
// Für Abbrechen gibt beiXHR das XMLHttpRequest heraus (dann xhr.abort()).
// Fällt Streaming aus, steht am Ende trotzdem der volle Text – nie schlechter.
export function antwortStreamen({ anbieter = 'anthropic', modell, schluessel, einstellungen, verlauf, beiText, beiXHR }) {
  if (!schluessel) return Promise.reject(new Error('Kein API-Schlüssel hinterlegt. Trag ihn in den Einstellungen ein.'));
  const openaiP = anbieter === 'openai';
  const system = systemPrompt(einstellungen);
  const m = modell || (openaiP ? 'gpt-4o-mini' : 'claude-sonnet-5');
  const url = openaiP ? 'https://api.openai.com/v1/chat/completions' : 'https://api.anthropic.com/v1/messages';
  const headers = openaiP
    ? { 'content-type': 'application/json', authorization: `Bearer ${schluessel}` }
    : { 'content-type': 'application/json', 'x-api-key': schluessel, 'anthropic-version': ANTHROPIC_VERSION };
  const nachrichten = verlauf.map((x) => ({ role: x.rolle === 'assistant' ? 'assistant' : 'user', content: x.text }));
  const body = openaiP
    ? { model: m, max_tokens: 1024, stream: true, stream_options: { include_usage: true }, messages: [{ role: 'system', content: system }, ...nachrichten] }
    : { model: m, max_tokens: 1024, stream: true, system, messages: nachrichten };

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    if (beiXHR) beiXHR(xhr);
    let text = '';
    let ein = 0;
    let aus = 0;
    let gelesen = 0;
    let puffer = '';

    xhr.onprogress = () => {
      puffer += xhr.responseText.slice(gelesen);
      gelesen = xhr.responseText.length;
      const zeilen = puffer.split('\n');
      puffer = zeilen.pop(); // unvollständige Zeile behalten
      for (const roh of zeilen) {
        const l = roh.trim();
        if (!l.startsWith('data:')) continue;
        const d = l.slice(5).trim();
        if (!d || d === '[DONE]') continue;
        let j;
        try { j = JSON.parse(d); } catch { continue; }
        if (openaiP) {
          const delta = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
          if (delta) { text += delta; if (beiText) beiText(text); }
          if (j.usage) { ein = j.usage.prompt_tokens || ein; aus = j.usage.completion_tokens || aus; }
        } else {
          if (j.type === 'message_start' && j.message && j.message.usage) ein = j.message.usage.input_tokens || ein;
          else if (j.type === 'content_block_delta' && j.delta && j.delta.text) { text += j.delta.text; if (beiText) beiText(text); }
          else if (j.type === 'message_delta' && j.usage) aus = j.usage.output_tokens || aus;
        }
      }
    };

    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        let grund = `HTTP ${xhr.status}`;
        try { const j = JSON.parse(xhr.responseText); if (j && j.error && j.error.message) grund = j.error.message; } catch { /* kein JSON */ }
        if (xhr.status === 401) grund = 'Der API-Schlüssel wird nicht akzeptiert. Stimmt er noch?';
        reject(new Error(grund));
        return;
      }
      if (!text) {
        // Kein Streaming angekommen: als Ganzes versuchen zu lesen.
        try {
          const j = JSON.parse(xhr.responseText);
          text = openaiP
            ? (j.choices && j.choices[0] && j.choices[0].message ? j.choices[0].message.content : '')
            : (Array.isArray(j.content) ? j.content.filter((b) => b.type === 'text').map((b) => b.text).join('') : '');
        } catch { /* war doch Streaming ohne Text */ }
      }
      resolve({ text: text || '(leere Antwort)', ein, aus, usd: kostenSchaetzen(m, ein, aus) });
    };
    xhr.onerror = () => reject(new Error('Netzwerkfehler – bist du online?'));
    xhr.onabort = () => reject(Object.assign(new Error('abgebrochen'), { abgebrochen: true }));
    xhr.send(JSON.stringify(body));
  });
}
