import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const PORT=Number(process.env.PORT||3000);
const DEVICE_TOKEN=process.env.DEVICE_TOKEN||'change-me-aria-2026';
const topics=['HEART','BRAIN','LUNGS','PHARMACY'];
const facts={HEART:'The heart pumps blood through the pulmonary and systemic circulations. What is the difference between arteries and veins?',BRAIN:'The brain integrates sensory input and controls movement, memory, and behavior. Which lobe is primarily associated with vision?',LUNGS:'Gas exchange occurs across the alveolar-capillary membrane. What is the role of surfactant?',PHARMACY:'Pharmacokinetics describes absorption, distribution, metabolism, and excretion. How does half-life affect dosing intervals?'};
let state={topic:'HEART',distance:null,gesture:'WAITING',connected:false,lastSeen:0,command:'HEART',commandId:1};
let lastSwitch=0;
const json=(res,code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'});res.end(JSON.stringify(data));};
async function body(req){let s='';for await(const part of req){s+=part;if(s.length>12000)throw Error('Request too large');}return JSON.parse(s||'{}');}
function setTopic(topic){if(!topics.includes(topic))return;state.topic=topic;state.command=topic;state.commandId++;}
async function callGemini(systemPrompt, userPrompt, maxOutputTokens = 300) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
  if (!/^[a-zA-Z0-9._-]+$/.test(model)) throw new Error('Invalid GEMINI_MODEL');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', signal: controller.signal,
      headers: {'Content-Type':'application/json', 'x-goog-api-key': apiKey},
      body: JSON.stringify({
        systemInstruction: {parts:[{text:systemPrompt}]},
        contents: [{role:'user',parts:[{text:userPrompt}]}],
        generationConfig: {temperature:0.4, maxOutputTokens}
      })
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 240);
      throw new Error(`Gemini HTTP ${response.status}: ${detail}`);
    }
    const data = await response.json();
    const output = data.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('').trim();
    if (!output) throw new Error('Gemini returned no text');
    return output;
  } finally { clearTimeout(timer); }
}
async function answer(question,topic) {
  const fallback=`A.R.I.A. educational simulation — ${facts[topic]} Your question: ${question}. Discuss the reasoning with your team. This is not clinical advice.`;
  if(!process.env.GEMINI_API_KEY) return {answer:fallback,mode:'DEMO'};
  try {
    const systemPrompt=`You are A.R.I.A., a concise, friendly English-speaking medical and pharmacy education booth assistant. Current topic: ${topic}. Respond in 2-4 short sentences with one interesting quiz question. No diagnosis, dosing instructions, or personalized treatment. For urgent real symptoms, recommend qualified medical care. All scenarios are fictional.`;
    const output=await callGemini(systemPrompt,question,350);
    return {answer:output,mode:'GEMINI'};
  } catch(e) {console.error('Gemini unavailable:',e.message);return {answer:fallback,mode:'DEMO'};}
}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');const p=url.pathname;
 if(req.method==='GET'&&p==='/api/state'){return json(res,200,{...state,connected:Date.now()-state.lastSeen<12000});}
 if(req.method==='POST'&&p==='/api/device'){if(req.headers['x-device-token']!==DEVICE_TOKEN)return json(res,401,{error:'Unauthorized'});const b=await body(req);const distance=Number(b.distance);state.lastSeen=Date.now();state.connected=true;state.distance=Number.isFinite(distance)?Math.round(distance):null;state.gesture=String(b.gesture||'WAITING').slice(0,20);
 // Arduino sends a discrete SWIPE event, not continuous proximity readings.
 if(state.gesture==='SWIPE'&&Date.now()-lastSwitch>1400){setTopic(topics[(topics.indexOf(state.topic)+1)%topics.length]);lastSwitch=Date.now();}
 return json(res,200,{topic:state.topic,command:state.command,commandId:state.commandId});}
 if(req.method==='POST'&&p==='/api/topic'){const b=await body(req);if(!topics.includes(b.topic))return json(res,400,{error:'Invalid topic'});setTopic(b.topic);return json(res,200,{topic:state.topic});}
 if(req.method==='POST'&&p==='/api/ask'){const b=await body(req);const q=String(b.question||'').trim().slice(0,500);if(!q)return json(res,400,{error:'Question required'});return json(res,200,await answer(q,state.topic));}
 if(req.method==='GET'&&(p==='/'||p==='/index.html'||p==='/style.css'||p==='/app.js')){const f=p==='/'?'index.html':p.slice(1);const content=await fs.readFile(path.join(root,'public',f));res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream','Cache-Control':'no-cache'});return res.end(content);}
 json(res,404,{error:'Not found'});
 }catch(e){console.error(e);json(res,500,{error:'Server error'});}}).listen(PORT,'0.0.0.0',()=>console.log(`A.R.I.A. listening on ${PORT}`));
