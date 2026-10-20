import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const DEVICE_TOKEN = process.env.DEVICE_TOKEN || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';
const topics = ['HEART', 'BRAIN', 'LUNGS', 'PHARMACY'];
const facts = {
  HEART: 'The heart pumps blood through the pulmonary and systemic circulations. What is the difference between arteries and veins?',
  BRAIN: 'The brain integrates sensory input and controls movement, memory, and behavior. Which lobe is primarily associated with vision?',
  LUNGS: 'Gas exchange occurs across the alveolar-capillary membrane. What is the role of surfactant?',
  PHARMACY: 'Pharmacokinetics describes absorption, distribution, metabolism, and excretion. How does half-life affect dosing intervals?'
};
let state = { topic: 'HEART', distance: null, gesture: 'WAITING', connected: false, lastSeen: 0, command: 'HEART', commandId: 1 };
let lastSwitch = 0;
let lastAiStatus = { mode: 'DEMO', reason: 'AI not verified yet' };
let lastProbeAt = 0;
let probeInFlight = null;
const PROBE_INTERVAL_MS = 120000;

function json(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}
async function readBody(req) {
  let input = '';
  for await (const chunk of req) {
    input += chunk;
    if (input.length > 12000) throw new Error('Request too large');
  }
  return JSON.parse(input || '{}');
}
function setTopic(topic) {
  if (!topics.includes(topic)) return;
  state.topic = topic;
  state.command = topic;
  state.commandId += 1;
}
async function callOpenAI(systemPrompt, userPrompt, maxTokens = 300) {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error('OPENAI_API_KEY is missing');
  if (!/^[a-zA-Z0-9._:-]+$/.test(OPENAI_MODEL)) throw new Error('Invalid OPENAI_MODEL');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_completion_tokens: maxTokens
      })
    });
    if (!response.ok) {
      // Do not expose secrets or upstream error details to the browser.
      console.error('OpenAI response error:', response.status);
      throw new Error(`OpenAI HTTP ${response.status}`);
    }
    const data = await response.json();
    const output = data.choices?.[0]?.message?.content?.trim();
    if (!output) throw new Error('OpenAI returned no text');
    return output;
  } finally { clearTimeout(timeout); }
}
async function verifyAiAvailability() {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    lastAiStatus = { mode: 'DEMO', reason: 'OPENAI_API_KEY is missing' };
    return;
  }
  if (Date.now() - lastProbeAt < PROBE_INTERVAL_MS) return;
  if (probeInFlight) return probeInFlight;
  probeInFlight = (async () => {
    lastProbeAt = Date.now();
    try {
      await callOpenAI('Reply with the word OK.', 'Say OK.', 30);
      lastAiStatus = { mode: 'OPENAI', reason: 'AI connection verified' };
    } catch (err) {
      lastAiStatus = { mode: 'DEMO', reason: 'AI unavailable; check Render logs' };
      console.error('AI availability check failed:', err.message);
    }
  })().finally(() => { probeInFlight = null; });
  return probeInFlight;
}
function publicAiStatus() {
  // Keep engine branding off the visitor dashboard.
  return { mode: lastAiStatus.mode, configured: Boolean(process.env.OPENAI_API_KEY?.trim()), reason: lastAiStatus.reason };
}
async function answer(question, topic) {
  const fallback = `A.R.I.A. educational simulation — ${facts[topic]} Your question: ${question}. Discuss the reasoning with your team. This is not clinical advice.`;
  if (!process.env.OPENAI_API_KEY?.trim()) {
    lastAiStatus = { mode: 'DEMO', reason: 'OPENAI_API_KEY is missing' };
    return { answer: fallback, mode: 'DEMO' };
  }
  try {
    const systemPrompt = `You are A.R.I.A., a concise, friendly English-speaking medical and pharmacy education booth assistant. Current topic: ${topic}. Respond in 2-4 short sentences with one interesting quiz question. No diagnosis, dosing instructions, or personalized treatment. For urgent real symptoms, recommend qualified medical care. All scenarios are fictional.`;
    const output = await callOpenAI(systemPrompt, question, 350);
    lastAiStatus = { mode: 'OPENAI', reason: 'AI answered successfully' };
    lastProbeAt = Date.now();
    return { answer: output, mode: 'OPENAI' };
  } catch (err) {
    console.error('AI unavailable:', err.message);
    lastAiStatus = { mode: 'DEMO', reason: 'AI request failed; check Render logs' };
    lastProbeAt = Date.now();
    return { answer: fallback, mode: 'DEMO' };
  }
}
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;
    if (req.method === 'GET' && p === '/api/ai-status') {
      await verifyAiAvailability();
      return json(res, 200, publicAiStatus());
    }
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
      console.log('Arduino telemetry accepted:', state.gesture, state.distance);
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
      const name = p === '/' ? 'index.html' : p.slice(1);
      const content = await fs.readFile(path.join(root, 'public', name));
      res.writeHead(200, { 'Content-Type': mime[path.extname(name)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      return res.end(content);
    }
    return json(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error('Request failed:', err);
    return json(res, 500, { error: 'Server error' });
  }
}).listen(PORT, '0.0.0.0', () => console.log(`A.R.I.A. listening on ${PORT}; AI configured: ${Boolean(process.env.OPENAI_API_KEY?.trim())}`));
