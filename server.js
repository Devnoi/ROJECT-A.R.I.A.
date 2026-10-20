import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const DEVICE_TOKEN = process.env.DEVICE_TOKEN || '';
const topics = ['HEART', 'BRAIN', 'LUNGS', 'PHARMACY'];
const facts = {
  HEART: 'The heart pumps blood through the pulmonary and systemic circulations. What is the difference between arteries and veins?',
  BRAIN: 'The brain integrates sensory input and controls movement, memory, and behavior. Which lobe is primarily associated with vision?',
  LUNGS: 'Gas exchange occurs across the alveolar-capillary membrane. What is the role of surfactant?',
  PHARMACY: 'Pharmacokinetics describes absorption, distribution, metabolism, and excretion. How does half-life affect dosing intervals?'
};
let state = { topic: 'HEART', distance: null, gesture: 'WAITING', connected: false, lastSeen: 0, command: 'HEART', commandId: 1 };
let lastSwitch = 0;
let lastAiStatus = { mode: process.env.GEMINI_API_KEY?.trim() ? 'READY' : 'DEMO', reason: process.env.GEMINI_API_KEY?.trim() ? 'Gemini is configured; send a question to verify' : 'GEMINI_API_KEY is missing' };

function json(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}
async function readBody(req) {
  let value = '';
  for await (const chunk of req) {
    value += chunk;
    if (value.length > 12000) throw new Error('Request too large');
  }
  return JSON.parse(value || '{}');
}
function setTopic(topic) {
  if (!topics.includes(topic)) return;
  state.topic = topic;
  state.command = topic;
  state.commandId += 1;
}
function publicAiStatus() {
  return { mode: lastAiStatus.mode, configured: Boolean(process.env.GEMINI_API_KEY?.trim()), model: process.env.GEMINI_MODEL || 'gemini-2.5-flash', reason: lastAiStatus.reason };
}
async function callGemini(systemPrompt, userPrompt, maxOutputTokens = 600) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
  if (!/^[a-zA-Z0-9._-]+$/.test(model)) throw new Error('Invalid GEMINI_MODEL');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens }
      })
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 350);
      // Never print an API key in logs.
      throw new Error(`Gemini HTTP ${response.status}: ${detail.replaceAll(apiKey, '[redacted]')}`);
    }
    const data = await response.json();
    const output = data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim();
    if (!output) throw new Error(`Gemini returned no text (finishReason: ${data.candidates?.[0]?.finishReason || 'unknown'})`);
    return output;
  } finally {
    clearTimeout(timer);
  }
}
async function answer(question, topic) {
  const fallback = `A.R.I.A. educational simulation — ${facts[topic]} Your question: ${question}. Discuss the reasoning with your team. This is not clinical advice.`;
  if (!process.env.GEMINI_API_KEY?.trim()) {
    lastAiStatus = { mode: 'DEMO', reason: 'GEMINI_API_KEY is missing' };
    return { answer: fallback, mode: 'DEMO', reason: lastAiStatus.reason };
  }
  try {
    const systemPrompt = `You are A.R.I.A., a concise, friendly English-speaking medical and pharmacy education booth assistant. Current topic: ${topic}. Respond in 2-4 short sentences with one interesting quiz question. No diagnosis, dosing instructions, or personalized treatment. For urgent real symptoms, recommend qualified medical care. All scenarios are fictional.`;
    const output = await callGemini(systemPrompt, question);
    lastAiStatus = { mode: 'GEMINI', reason: 'Gemini answered successfully' };
    return { answer: output, mode: 'GEMINI' };
  } catch (err) {
    const reason = err.name === 'AbortError' ? 'Gemini request timed out' : String(err.message).slice(0, 250);
    console.error('Gemini unavailable:', reason);
    lastAiStatus = { mode: 'DEMO', reason };
    return { answer: fallback, mode: 'DEMO', reason: 'Gemini request failed; see Render logs' };
  }
}
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;
    if (req.method === 'GET' && p === '/api/ai-status') return json(res, 200, publicAiStatus());
    if (req.method === 'GET' && p === '/api/state') return json(res, 200, { ...state, connected: Date.now() - state.lastSeen < 12000 });
    if (req.method === 'POST' && p === '/api/device') {
      if (!DEVICE_TOKEN || req.headers['x-device-token'] !== DEVICE_TOKEN) return json(res, 401, { error: 'Unauthorized' });
      const b = await readBody(req);
      const distance = Number(b.distance);
      state.lastSeen = Date.now();
      state.connected = true;
      state.distance = b.distance == null ? null : (Number.isFinite(distance) ? Math.round(distance) : null);
      state.gesture = String(b.gesture || 'WAITING').slice(0, 20);
      if (state.gesture === 'SWIPE' && Date.now() - lastSwitch > 1400) {
        setTopic(topics[(topics.indexOf(state.topic) + 1) % topics.length]);
        lastSwitch = Date.now();
      }
      return json(res, 200, { topic: state.topic, command: state.command, commandId: state.commandId });
    }
    if (req.method === 'POST' && p === '/api/topic') {
      const b = await readBody(req);
      if (!topics.includes(b.topic)) return json(res, 400, { error: 'Invalid topic' });
      setTopic(b.topic);
      return json(res, 200, { topic: state.topic });
    }
    if (req.method === 'POST' && p === '/api/ask') {
      const b = await readBody(req);
      const q = String(b.question || '').trim().slice(0, 500);
      if (!q) return json(res, 400, { error: 'Question required' });
      return json(res, 200, await answer(q, state.topic));
    }
    if (req.method === 'GET' && ['/', '/index.html', '/style.css', '/app.js'].includes(p)) {
      const f = p === '/' ? 'index.html' : p.slice(1);
      const content = await fs.readFile(path.join(root, 'public', f));
      res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      return res.end(content);
    }
    return json(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error('Request failed:', err);
    return json(res, 500, { error: 'Server error' });
  }
}).listen(PORT, '0.0.0.0', () => console.log(`A.R.I.A. listening on ${PORT}; Gemini configured: ${Boolean(process.env.GEMINI_API_KEY?.trim())}`));
