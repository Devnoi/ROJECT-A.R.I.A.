const topics=['HEART','BRAIN','LUNGS','PHARMACY'];
const icons={HEART:'♥',BRAIN:'🧠',LUNGS:'🫁',PHARMACY:'⚕'};
const desc={HEART:'Circulatory system • Cardiac physiology',BRAIN:'Nervous system • Neuroscience',LUNGS:'Respiratory system • Gas exchange',PHARMACY:'Drug science • Safe medicine use'};
const examples={HEART:'Why does the heart beat faster during exercise?',BRAIN:'How does sleep help the brain?',LUNGS:'How do lungs work?',PHARMACY:'Why should we follow medicine instructions?'};
const el=id=>document.getElementById(id);
let topic='HEART',speechOn=true,voiceUnlocked=false,asking=false,lastGreetingId=null,startedAt=Date.now();
async function api(url,data){const r=await fetch(url,{method:data?'POST':'GET',headers:{'content-type':'application/json'},body:data?JSON.stringify(data):undefined,cache:'no-store'});if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json();}
function setTopic(t){if(!topics.includes(t))return;topic=t;el('title').innerHTML=`${t} <span>SCAN</span>`;el('organ').textContent=icons[t];el('description').textContent=desc[t];document.querySelectorAll('[data-topic]').forEach(b=>b.classList.toggle('active',b.dataset.topic===t));}
function speak(text){if(!speechOn||!voiceUnlocked||!('speechSynthesis'in window))return;window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='en-US';u.rate=.92;window.speechSynthesis.speak(u);}
function updateLight(data){const on=data.mode==='GEMINI';el('engine').classList.toggle('ai-on',on);el('engine').classList.toggle('ai-off',!on);el('engine').setAttribute('aria-label',on?'AI responding':'AI unavailable');el('engine').title=on?'AI responding':'AI unavailable';}
async function refreshAI(){try{updateLight(await api('/api/ai-status'));}catch{updateLight({mode:'DEMO'});}}
function greet(s){el('answer').textContent=s.greetingText;speak(s.greetingText);}
async function refresh(){try{
 const s=await api('/api/state');el('status').textContent=s.connected?'● ARDUINO ONLINE':'● CLOUD ONLINE / ARDUINO OFFLINE';el('distance').textContent=s.distance===null?'-- cm':`${s.distance} cm`;el('gesture').textContent=s.visitorPresent?'VISITOR DETECTED':'WAITING';if(s.topic!==topic)setTopic(s.topic);
 if(lastGreetingId===null){lastGreetingId=s.greetingId;if(s.greetingAt>=startedAt&&s.greetingId>0)greet(s);}else if(s.greetingId>lastGreetingId){lastGreetingId=s.greetingId;greet(s);}
 }catch{el('status').textContent='● CLOUD OFFLINE';}}
async function ask(text){if(asking)return;asking=true;el('send').disabled=true;el('answer').textContent='A.R.I.A. is thinking...';try{const r=await api('/api/ask',{question:text});el('answer').textContent=r.answer;updateLight(r);speak(r.answer);}catch{el('answer').textContent='Connection unavailable. Please try again.';updateLight({mode:'DEMO'});}finally{asking=false;el('send').disabled=false;}}
for(const t of topics){const b=document.createElement('button');b.dataset.topic=t;b.textContent=t;b.onclick=async()=>{setTopic(t);try{await api('/api/topic',{topic:t});}catch{}};el('topics').append(b);}setTopic(topic);
el('unlock').onclick=()=>{voiceUnlocked=true;speechOn=true;el('unlock').textContent='✓ VOICE ENABLED';el('sound').textContent='🔈 VOICE ON';// user gesture required by Safari
 if('speechSynthesis'in window){const u=new SpeechSynthesisUtterance('Voice ready.');u.lang='en-US';window.speechSynthesis.speak(u);}else el('voice-hint').textContent='This browser cannot speak. You can still read and type questions.';};
el('sound').onclick=()=>{speechOn=!speechOn;el('sound').textContent=speechOn?'🔈 VOICE ON':'🔇 VOICE OFF';if(!speechOn&&'speechSynthesis'in window)window.speechSynthesis.cancel();};
el('form').onsubmit=e=>{e.preventDefault();const q=el('question').value.trim();if(q)ask(q);};el('quiz').onclick=()=>ask(examples[topic]);
const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
if(Recognition){const rec=new Recognition();rec.lang='en-US';rec.interimResults=false;rec.onresult=e=>{const q=e.results[0][0].transcript;el('question').value=q;ask(q);};rec.onerror=e=>{el('voice-hint').textContent='Microphone unavailable. Please type your question.';};rec.onend=()=>{el('voice').textContent='🎙 ASK BY VOICE';};el('voice').onclick=()=>{try{rec.start();el('voice').textContent='● LISTENING';}catch{el('question').focus();}};}else{el('voice').textContent='⌨️ TYPE A QUESTION';el('voice').onclick=()=>el('question').focus();}
refresh();refreshAI();setInterval(refresh,900);setInterval(refreshAI,30000);
