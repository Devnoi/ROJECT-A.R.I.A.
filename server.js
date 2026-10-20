import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const DEVICE_TOKEN = (process.env.DEVICE_TOKEN || '').trim();
const GEMINI_KEY = (process.env.GEMINI_API_KEY || '').trim();
const GEMINI_MODEL = (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim();
const TOPICS = ['HEART','BRAIN','LUNGS','PHARMACY'];
const INTRO = 'Hello! Welcome to A.R.I.A., your health learning assistant. How can I help you today? You can ask me about your heart, brain, lungs, or medicines.';
const state = { topic:'HEART',distance:null,gesture:'WAITING',lastSeen:0,greetingId:0,greetingAt:0,visitorPresent:false };
let nearHits=0, farHits=0, lastGreeting=0, aiOk=false, lastAiError='Not tested';
let probeTime=0, probePromise=null;
function json(res,status,data){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*'});res.end(JSON.stringify(data));}
async function getBody(req){let raw='';for await(const piece of req){raw+=piece;if(raw.length>12000)throw Error('Body too large');}return JSON.parse(raw||'{}');}
async function gemini(system,user,maxOutputTokens=320){
 if(!GEMINI_KEY)throw Error('GEMINI_API_KEY missing');
 if(!/^[a-zA-Z0-9._-]+$/.test(GEMINI_MODEL))throw Error('Invalid model');
 const ac=new AbortController(), timer=setTimeout(()=>ac.abort(),18000);
 try{
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,{
   method:'POST',signal:ac.signal,headers:{'content-type':'application/json','x-goog-api-key':GEMINI_KEY},
   body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:[{parts:[{text:user}]}],generationConfig:{temperature:0.4,maxOutputTokens}})
  });
  if(!r.ok){const detail=(await r.text()).slice(0,180).replaceAll(GEMINI_KEY,'[redacted]');throw Error(`Gemini HTTP ${r.status} ${detail}`);}
  const data=await r.json();const answer=(data.candidates?.[0]?.content?.parts||[]).map(x=>x.text||'').join('').trim();
  if(!answer)throw Error('Gemini returned no text');return answer;
 }finally{clearTimeout(timer);}
}
async function checkAI(){
 if(!GEMINI_KEY){aiOk=false;lastAiError='No GEMINI_API_KEY';return;}
 if(Date.now()-probeTime<120000)return probePromise;
 if(probePromise)return probePromise;
 probeTime=Date.now();
 probePromise=(async()=>{try{await gemini('Reply with exactly OK.','OK',96);aiOk=true;lastAiError='';}catch(e){aiOk=false;lastAiError=e.message;console.error('Gemini health check:',lastAiError);}})().finally(()=>{probePromise=null;});
 return probePromise;
}
function updatePresence(cm){
 const near=cm!==null&&cm>=2&&cm<=10;
 const far=cm===null||cm>=15||cm<2;
 if(near){nearHits++;farHits=0;}else if(far){farHits++;nearHits=0;}else{nearHits=0;farHits=0;}
 if(!state.visitorPresent&&nearHits>=2&&Date.now()-lastGreeting>5000){
  state.visitorPresent=true;state.greetingId++;state.greetingAt=Date.now();lastGreeting=state.greetingAt;
  console.log('Visitor detected: greeting event',state.greetingId);
 }
 if(state.visitorPresent&&farHits>=2){state.visitorPresent=false;nearHits=0;}
 state.gesture=state.visitorPresent?'VISITOR':'WAITING';
}
const defaults={HEART:'The heart pumps blood around your body.',BRAIN:'The brain helps you think, move, and remember.',LUNGS:'Your lungs help oxygen enter your blood.',PHARMACY:'Medicines can help treat illness, but correct use matters.'};
async function answer(question,topic){
 const fallback=`I'm in demo mode. ${defaults[topic]} For personal health concerns, ask a qualified healthcare professional.`;
 if(!GEMINI_KEY)return {answer:fallback,mode:'DEMO'};
 try{
  const system=`You are A.R.I.A., an English-language health education booth assistant for students and the public. The current topic is ${topic}. Use simple, warm English, 2–4 short sentences. Give general evidence-based educational information, not a personal diagnosis, prescription, medicine dosage or treatment plan. Never claim to have searched the live web. If the question describes serious symptoms (chest pain, severe trouble breathing, stroke signs, severe allergic reaction), direct them to local emergency services promptly. For other personal health concerns recommend a healthcare professional. If uncertain, say so. Do not request personal patient data.`;
  const out=await gemini(system,question,600);aiOk=true;lastAiError='';probeTime=Date.now();return {answer:out,mode:'GEMINI'};
 }catch(e){aiOk=false;lastAiError=e.message;probeTime=Date.now();console.error('Gemini question:',lastAiError);return {answer:fallback,mode:'DEMO'};}
}
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
http.createServer(async(req,res)=>{
 try{
  const p=new URL(req.url,'http://localhost').pathname;
  if(req.method==='GET'&&p==='/api/state')return json(res,200,{...state,connected:Date.now()-state.lastSeen<12000,greetingText:INTRO});
  if(req.method==='GET'&&p==='/api/ai-status'){await checkAI();return json(res,200,{mode:aiOk?'GEMINI':'DEMO',configured:Boolean(GEMINI_KEY),reason:aiOk?'AI responding':'AI unavailable; inspect Render logs'});}
  if(req.method==='POST'&&p==='/api/device'){
   if(!DEVICE_TOKEN||req.headers['x-device-token']!==DEVICE_TOKEN)return json(res,401,{error:'Unauthorized'});
   const b=await getBody(req);const n=Number(b.distance);const cm=b.distance===null||b.distance===undefined||!Number.isFinite(n)||n<0?null:Math.round(n);
   state.distance=cm;state.lastSeen=Date.now();updatePresence(cm);
   return json(res,200,{ok:true,greetingId:state.greetingId,visitorPresent:state.visitorPresent,topic:state.topic});
  }
  if(req.method==='POST'&&p==='/api/topic'){const b=await getBody(req);if(!TOPICS.includes(b.topic))return json(res,400,{error:'Invalid topic'});state.topic=b.topic;return json(res,200,{topic:state.topic});}
  if(req.method==='POST'&&p==='/api/ask'){const b=await getBody(req);const q=String(b.question||'').trim().slice(0,450);if(!q)return json(res,400,{error:'Question required'});return json(res,200,await answer(q,state.topic));}
  if(req.method==='GET'&&['/','/index.html','/style.css','/app.js'].includes(p)){
   const name=p==='/'?'index.html':p.slice(1);const data=await fs.readFile(path.join(root,'public',name));res.writeHead(200,{'content-type':MIME[path.extname(name)],'cache-control':'no-store'});return res.end(data);
  }
  return json(res,404,{error:'Not found'});
 }catch(e){console.error('Request error:',e.message);return json(res,500,{error:'Server error'});}
}).listen(PORT,'0.0.0.0',()=>console.log('A.R.I.A. health greeter listening',PORT));
