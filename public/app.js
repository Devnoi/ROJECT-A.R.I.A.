const topics = ['HEART', 'BRAIN', 'LUNGS', 'PHARMACY'];
const icons = { HEART: '♥', BRAIN: '🧠', LUNGS: '🫁', PHARMACY: '⚕' };
const descriptions = {
  HEART: 'Circulatory system • Cardiac physiology', BRAIN: 'Nervous system • Neuroscience',
  LUNGS: 'Respiratory system • Gas exchange', PHARMACY: 'Drug science • Pharmacokinetics'
};
const prompts = {
  HEART: 'How does the heart pump blood?', BRAIN: 'What is the role of the frontal lobe?',
  LUNGS: 'How does oxygen enter the blood?', PHARMACY: 'What does drug half-life mean?'
};
const el = id => document.getElementById(id);
let topic = '', speechOn = true, busy = false;

async function api(url, data) {
  const r = await fetch(url, { method: data ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' }, body: data ? JSON.stringify(data) : undefined });
  if (!r.ok) throw Error(`HTTP ${r.status}`);
  return r.json();
}
function showAiStatus(data) {
  const engine = el('engine');
  if (!engine) return;
  // Only show green after a real Gemini API request succeeded.
  const active = data.mode === 'GEMINI' || data.mode === 'AI';
  engine.classList.toggle('ai-on', active);
  engine.classList.toggle('ai-off', !active);
  const label = active ? 'AI connected' : 'AI unavailable';
  engine.setAttribute('aria-label', label);
  el('ai-accessible').textContent = label;
  engine.title = active ? 'AI connected and responding' : 'AI unavailable. Check connection and Render logs.';
}
async function refreshAiStatus() {
  try { showAiStatus(await api('/api/ai-status')); }
  catch { showAiStatus({ mode: 'DEMO' }); }
}
function render(t) {
  if (!topics.includes(t)) return;
  topic = t;
  el('title').innerHTML = `${t} <span>SCAN</span>`;
  el('organ').textContent = icons[t];
  el('description').textContent = descriptions[t];
  document.querySelectorAll('[data-topic]').forEach(b => b.classList.toggle('active', b.dataset.topic === t));
}
function speak(s) {
  if (!speechOn || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(s);
  u.lang = 'en-US'; u.rate = .95;
  window.speechSynthesis.speak(u);
}
async function choose(t) {
  render(t);
  try { await api('/api/topic', { topic: t }); }
  catch { el('status').textContent = '● CLOUD OFFLINE'; }
}
for (const t of topics) {
  const b = document.createElement('button');
  b.textContent = t; b.dataset.topic = t; b.onclick = () => choose(t);
  el('topics').append(b);
}
render('HEART');
async function refresh() {
  try {
    const s = await api('/api/state');
    el('status').textContent = s.connected ? '● ARDUINO ONLINE' : '● CLOUD ONLINE / ARDUINO OFFLINE';
    el('status').style.color = s.connected ? '#67f5b0' : '#ffbf7c';
    el('distance').textContent = s.distance == null ? '-- cm' : `${s.distance} cm`;
    el('gesture').textContent = s.gesture;
    if (s.topic !== topic) render(s.topic);
  } catch { el('status').textContent = '● CLOUD OFFLINE'; }
}
setInterval(refresh, 1100);
setInterval(refreshAiStatus, 10000);
refresh(); refreshAiStatus();
async function ask(q) {
  if (busy) return;
  busy = true;
  el('send').disabled = true;
  el('answer').textContent = 'A.R.I.A. is thinking...';
  try {
    const r = await api('/api/ask', { question: q });
    el('answer').textContent = r.answer;
    showAiStatus(r);
    if (r.mode === 'DEMO' && r.reason) console.warn(r.reason);
    speak(r.answer);
  } catch {
    showAiStatus({ mode: 'DEMO' });
    el('answer').textContent = 'Connection unavailable. Try again.';
  } finally { busy = false; el('send').disabled = false; }
}
el('form').onsubmit = e => {
  e.preventDefault();
  const q = el('question').value.trim();
  if (q) ask(q);
};
el('quiz').onclick = () => ask(prompts[topic]);
el('sound').onclick = () => {
  speechOn = !speechOn;
  el('sound').textContent = speechOn ? '🔊 VOICE ON' : '🔇 VOICE OFF';
  if (!speechOn && 'speechSynthesis' in window) window.speechSynthesis.cancel();
};
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  const rec = new SpeechRecognition();
  rec.lang = 'en-US'; rec.interimResults = false;
  rec.onresult = e => { const q = e.results[0][0].transcript; el('question').value = q; ask(q); };
  rec.onerror = () => { el('voice').textContent = '🎙 RETRY'; };
  rec.onend = () => { el('voice').textContent = '🎙 SPEAK'; };
  el('voice').onclick = () => { try { rec.start(); el('voice').textContent = '● LISTENING'; } catch {} };
} else {
  el('voice').textContent = '🎙 TYPE INSTEAD';
  el('voice').onclick = () => el('question').focus();
}
