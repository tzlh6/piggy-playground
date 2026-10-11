/* Layered sound engine.
   Layer 1 – soft synthesized cues for small actions (ticks, plinks, whooshes).
   Layer 2 – single pig voices for meaningful moments (match, big merge, catch).
   Layer 3 – overlapping pig choruses for endings (pig chain on a loss, cheering on a win).
   Pig voices are the four cartoon clips in sounds.js; everything else is generated with Web Audio. */
(function(root){
'use strict';
const PENTA=[0,2,4,7,9,12,14,16,19,21,24,26,28];
const note=(base,step)=>base*Math.pow(2,PENTA[Math.max(0,Math.min(PENTA.length-1,step))]/12);
const NAMES=['佩奇','乔治','猪妈妈','猪爸爸'];

function createSound(opts){
 const store=opts.store,AC=opts.AudioContext,clips=opts.clips||[];
 const S={
  enabled:store.get('sound',true),volume:store.get('volume',.75),pigVolume:store.get('pigVolume',1),fxVolume:store.get('fxVolume',.8),profile:store.get('sound-profile','soft'),
  ctx:null,buffers:[],ready:false,voices:[],effects:[],timers:[],bag:[],last:-1,generation:0,names:NAMES,onvoice:null,maxVoices:10,

  // AudioContext must be created inside a user gesture (autoplay policy).
  unlock(){
   if(!AC)return false;
   if(!this.ctx){try{this.ctx=new AC();}catch(e){return false}
    const c=this.ctx;this.master=c.createGain();this.pigBus=c.createGain();this.fxBus=c.createGain();
    const comp=c.createDynamicsCompressor();comp.threshold.value=-14;comp.knee.value=10;comp.ratio.value=4;comp.attack.value=.004;comp.release.value=.2;
    this.pigBus.connect(this.master);this.fxBus.connect(this.master);this.master.connect(comp);comp.connect(c.destination);
    const len=Math.floor(c.sampleRate*1.2),nb=c.createBuffer(1,len,c.sampleRate),d=nb.getChannelData(0);for(let i=0;i<len;i++)d[i]=Math.random()*2-1;this.noiseBuf=nb;
    this.applyVolume();
    clips.forEach((src,i)=>{try{const bin=root.atob(src.split(',')[1]),buf=new Uint8Array(bin.length);for(let k=0;k<bin.length;k++)buf[k]=bin.charCodeAt(k);
     const p=c.decodeAudioData(buf.buffer,b=>{this.buffers[i]=b;this.ready=this.buffers.filter(Boolean).length===clips.length},()=>{});if(p&&p.catch)p.catch(()=>{})}catch(e){}});
   }
   if(this.ctx.state==='suspended'&&this.ctx.resume)this.ctx.resume();
   return true;
  },
  get live(){return this.enabled&&this.volume>0&&!!this.ctx},
  applyVolume(){if(!this.ctx)return;const t=this.ctx.currentTime;this.master.gain.setTargetAtTime(this.enabled?this.volume:0,t,.02);this.pigBus.gain.setTargetAtTime(this.pigVolume,t,.02);this.fxBus.gain.setTargetAtTime(this.fxVolume*.9,t,.02)},
  save(){store.set('sound',this.enabled);store.set('volume',this.volume);store.set('pigVolume',this.pigVolume);store.set('fxVolume',this.fxVolume);store.set('sound-profile',this.profile);this.applyVolume()},

  // Cancel everything that is playing or scheduled (pause, new game, game switch).
  stop(){this.generation++;this.timers.forEach(clearTimeout);this.timers=[];[...this.voices,...this.effects].forEach(v=>{try{v.g.gain.cancelScheduledValues(0);v.g.gain.setTargetAtTime(0,this.ctx.currentTime,.015);v.src.stop(this.ctx.currentTime+.08)}catch(e){}});this.voices=[];this.effects=[]},
  later(ms,fn){const gen=this.generation,id=setTimeout(()=>{this.timers=this.timers.filter(x=>x!==id);if(gen===this.generation)fn()},ms);this.timers.push(id);return id},
  now(){return this.ctx?this.ctx.currentTime:0},

  // Shuffled bag: every round uses all four pigs, never the same pig twice in a row.
  choose(){if(!this.bag.length){this.bag=PigCore.shuffle([0,1,2,3]);if(this.bag[3]===this.last){const t=this.bag[0];this.bag[0]=this.bag[3];this.bag[3]=t}}this.last=this.bag.pop();return this.last},

  // ---- primitives ----
  voice(i,o){o=o||{};if(!this.live)return null;if(i===undefined||i===null)i=this.choose();const buf=this.buffers[i];if(!buf)return null;const c=this.ctx,t=c.currentTime+(o.delay||0);
   while(this.voices.length>=this.maxVoices){const old=this.voices.shift();try{old.g.gain.setTargetAtTime(0,c.currentTime,.02);old.src.stop(c.currentTime+.1)}catch(e){}}
   const src=c.createBufferSource(),g=c.createGain();src.buffer=buf;src.playbackRate.value=o.rate||1;g.gain.value=o.gain===undefined?1:o.gain;let node=src;
   if(c.createStereoPanner&&o.pan){const p=c.createStereoPanner();p.pan.value=Math.max(-1,Math.min(1,o.pan));src.connect(p);node=p}
   node.connect(g);g.connect(this.pigBus);const v={src,g,i};this.voices.push(v);src.onended=()=>{this.voices=this.voices.filter(x=>x!==v);if(this.onvoice)this.onvoice(i,false)};if(o.dur){const end=t+o.dur/(o.rate||1),g0=g.gain.value;g.gain.setValueAtTime(g0,Math.max(t,end-.05));g.gain.linearRampToValueAtTime(0.0001,end);src.start(t,o.offset||0,o.dur+.02)}else src.start(t,o.offset||0);if(this.onvoice)this.onvoice(i,true);return v},
  tone(f,o){o=o||{};if(!this.live)return;const retro=this.profile==='retro',fairy=this.profile==='fairy',pitch=fairy?1.18:retro?.93:1,c=this.ctx,t=c.currentTime+(o.delay||0),d=(o.dur||.12)*(fairy?1.22:1),a=o.attack||.004;const osc=c.createOscillator(),g=c.createGain();osc.type=retro?'square':fairy?'sine':o.type||'sine';osc.frequency.setValueAtTime(f*pitch,t);if(o.to)osc.frequency.exponentialRampToValueAtTime(o.to*pitch,t+d);
   g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime((o.gain||.2)*(retro?.55:1),t+a);g.gain.exponentialRampToValueAtTime(0.0001,t+d);osc.connect(g);g.connect(this.fxBus);const tracked={src:osc,g,i:-1};this.effects.push(tracked);osc.onended=()=>{this.effects=this.effects.filter(v=>v!==tracked)};osc.start(t);osc.stop(t+d+.02)},
  noise(o){o=o||{};if(!this.live||!this.noiseBuf)return;const c=this.ctx,t=c.currentTime+(o.delay||0),d=o.dur||.08;const src=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();src.buffer=this.noiseBuf;f.type=o.filter||'bandpass';f.frequency.setValueAtTime(o.freq||1800,t);if(o.to)f.frequency.exponentialRampToValueAtTime(o.to,t+d);f.Q.value=o.q||1;
   g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(o.gain||.15,t+(o.attack||.003));g.gain.exponentialRampToValueAtTime(0.0001,t+d);src.connect(f);f.connect(g);g.connect(this.fxBus);const tracked={src,g,i:-1};this.effects.push(tracked);src.onended=()=>{this.effects=this.effects.filter(v=>v!==tracked)};src.start(t,Math.random()*.5);src.stop(t+d+.02)},

  // ---- layer 1: small actions ----
  click(){this.tone(1400,{dur:.035,gain:.05,type:'triangle'})},
  dig(n){const r=.94+Math.random()*.12;this.noise({freq:2600*r,q:.9,dur:.045,gain:.09});if(n>0)this.tone(note(392,n-1),{dur:.13,gain:.11,type:'triangle',delay:.012});else this.tone(330*r,{dur:.06,gain:.06})},
  cascade(count){const k=Math.min(9,2+Math.round(Math.sqrt(count)));this.noise({freq:900,to:4200,q:.7,dur:.08+k*.03,gain:.07,filter:'bandpass'});for(let s=0;s<k;s++)this.tone(note(392,s),{dur:.16,gain:.085,type:'triangle',delay:.03*s})},
  chord(){this.noise({freq:3000,q:1.2,dur:.04,gain:.08});this.tone(523,{dur:.09,gain:.08,type:'triangle'});this.tone(659,{dur:.09,gain:.07,type:'triangle',delay:.045})},
  flag(on){if(on){this.tone(880,{dur:.09,gain:.1,type:'triangle'});this.tone(1319,{dur:.14,gain:.09,type:'triangle',delay:.06})}else{this.tone(1175,{dur:.08,gain:.07,type:'triangle'});this.tone(784,{dur:.12,gain:.06,type:'triangle',delay:.05})}},
  flip(){this.noise({freq:3800,to:1600,q:.8,dur:.09,gain:.07,filter:'highpass'});this.tone(620+Math.random()*60,{dur:.05,gain:.04})},
  miss(){this.tone(311,{dur:.14,gain:.09,type:'triangle'});this.tone(233,{dur:.2,gain:.08,type:'triangle',delay:.11})},
  slide(){this.noise({freq:500,to:1400,q:.6,dur:.12,gain:.06,filter:'bandpass'})},
  undo(){this.noise({freq:1600,to:500,q:.6,dur:.14,gain:.06,filter:'bandpass'});this.tone(587,{dur:.1,gain:.05,to:440})},
  pop(){this.tone(260,{dur:.11,gain:.06,to:520})},
  tick(last){this.tone(last?1568:1046,{dur:.05,gain:last?.1:.07,type:'square'})},
  boing(){this.tone(420,{dur:.32,gain:.12,to:140,type:'triangle'});this.tone(160,{dur:.18,gain:.08,type:'sine',delay:.02})},
  // 点错 / 被嫌弃时的一声喷鼻（提示音层之外的轻量猪声）
  oops(){this.boing();this.pigSnort({delay:.08})},

  // ---- layer 2: single pig moments ----
  greet(){if(Math.random()<.5||!this.ctx)this.voice(null,{gain:.75});else this.pigHappy()},
  match(card,streak){const i=card%4,rate=.92+(card%3)*.09+Math.min(streak,4)*.03;this.voice(i,{rate,gain:.95});this.tone(note(523,2+Math.min(streak,6)),{dur:.25,gain:.07,type:'triangle',delay:.05});this.tone(note(523,4+Math.min(streak,6)),{dur:.3,gain:.06,type:'triangle',delay:.11})},
  // 2048: every merge goes "pop" plus a pig grunt; small pigs squeak short and high, big pigs grunt long and low.
  merge(values){values=(Array.isArray(values)?values:[values]).filter(Boolean).sort((a,b)=>a-b).slice(-4);
   values.forEach((v,k)=>{const lv=Math.round(Math.log2(v)),d=k*.07;
    this.tone(260+lv*45,{dur:.09,gain:.16,to:620+lv*70,delay:d});this.noise({freq:2600,q:1.5,dur:.035,gain:.08,delay:d});
    this.tone(note(262,Math.min(12,lv-1)),{dur:.22,gain:.09,type:'triangle',delay:d+.03});
    if(k>=values.length-2){if(lv<=5)this.voice(lv%2,{rate:1.55-lv*.05,gain:.75,dur:.2,delay:d+.02});
     else if(lv<=8)this.voice(lv%2?1:2,{rate:1.25-(lv-6)*.08,gain:.85,delay:d+.02});
     else{this.voice(lv%2?2:3,{rate:1-(lv-9)*.05,gain:.95,delay:d+.02});this.tone(note(523,4),{dur:.4,gain:.06,type:'triangle',delay:d+.12});this.tone(note(523,7),{dur:.45,gain:.05,type:'triangle',delay:d+.2})}}})},
  spawnTile(){this.tone(880,{dur:.05,gain:.025,to:1100,delay:.12})},
  // 贪吃猪
  eat(n){this.noise({freq:1400,q:2,dur:.05,gain:.1});this.noise({freq:900,q:2,dur:.05,gain:.08,delay:.06});this.voice(n%2,{rate:Math.min(1.7,1.25+n*.012),gain:.6,dur:.18,delay:.02})},
  gold(){[0,2,4,7].forEach((st,k)=>this.tone(note(784,st),{dur:.18,gain:.08,type:'triangle',delay:k*.05}));this.voice(1,{rate:1.2,gain:.9,delay:.1})},
  goldGone(){this.tone(660,{dur:.15,gain:.04,to:440})},
  turnTick(){this.tone(1500,{dur:.02,gain:.02})},
  // 跳跳猪
  jump(){this.tone(330,{dur:.16,gain:.1,to:760,type:'triangle'})},
  double(){this.tone(500,{dur:.14,gain:.09,to:1100,type:'triangle'});this.voice(0,{rate:1.6,gain:.45,dur:.12})},
  land(){this.noise({freq:500,q:.8,dur:.06,gain:.06,filter:'lowpass'})},
  apple(){this.tone(988,{dur:.08,gain:.08,type:'triangle'});this.tone(1319,{dur:.14,gain:.08,type:'triangle',delay:.06})},
  milestone(){this.tone(784,{dur:.1,gain:.07,type:'square'});this.tone(1046,{dur:.18,gain:.07,type:'square',delay:.1});this.voice(null,{rate:1.15,gain:.6,dur:.25,delay:.12})},
  crash(){this.boom({big:true,voice:3,rate:.95,gain:.95});this.pigWail(false,{delay:.4,rate:.95});[392,311,247].forEach((f,k)=>this.tone(f,{dur:.22,gain:.07,type:'triangle',delay:.35+k*.13}))},
  hit(combo){this.voice(null,{rate:Math.min(1.55,.96+combo*.045),gain:.95});this.tone(note(659,Math.min(combo,10)),{dur:.12,gain:.06,type:'triangle',delay:.03})},
  boom(o){o=o||{};const big=!!o.big,d=o.delay||0;this.noise({freq:big?2400:1600,to:big?120:200,q:.4,dur:big?.55:.26,gain:big?.32:.13,filter:'lowpass',delay:d});this.tone(big?110:150,{dur:big?.45:.2,gain:big?.32:.12,to:40,delay:d});
   this.voice(o.voice===undefined?null:o.voice,{rate:o.rate||1,gain:o.gain===undefined?.6:o.gain,pan:o.pan||0,delay:d+.02})},

  // ---- layer 3: endings ----
  // Pigs are woken one after another; returns the total length in ms.
  chain(list,onEach){const n=list.length,step=Math.max(38,Math.min(170,3800/Math.max(1,n)));let t=0;
   list.forEach((item,k)=>{t+=step*(.75+Math.random()*.5);const at=t;this.later(at,()=>{if(onEach)onEach(item,k);this.boom({pan:item.pan||0,rate:.82+Math.random()*.55,gain:.42+Math.random()*.25})})});
   return t+600},
  // Eight games, eight small sound personalities; all synthesized offline.
  blockRotate(){this.tone(440,{dur:.08,gain:.07,to:660,type:'triangle'})},
  blockLand(){this.noise({freq:430,q:.7,dur:.065,gain:.065});this.tone(190,{dur:.07,gain:.065,to:120})},
  blockClear(n){[523,659,784,1047].slice(0,Math.min(4,n+1)).forEach((f,k)=>this.tone(f,{dur:.19,gain:.07,delay:k*.05,type:'triangle'}));if(n>=2)this.voice(n===4?1:0,{gain:.55,rate:1.2})},
  paddleBounce(){this.tone(240+Math.random()*50,{dur:.08,gain:.055,to:150,type:'sine'})},
  brickPop(){this.tone(720+Math.random()*150,{dur:.11,gain:.07,to:1100,type:'triangle'});this.noise({freq:2200,dur:.025,gain:.035})},
  flapWing(){this.noise({freq:1100,to:3200,dur:.1,gain:.045,filter:'highpass'});this.tone(320,{dur:.1,gain:.055,to:570,type:'triangle'})},
  gatePass(n){this.tone(784,{dur:.1,gain:.075,type:'triangle'});this.tone(1175,{dur:.16,gain:.07,delay:.07,type:'triangle'});if(n%5===0)this.voice(0,{gain:.5,rate:1.4})},
  stackLand(perfect){this.blockLand();if(perfect){[659,880,1175].forEach((f,k)=>this.tone(f,{dur:.14,gain:.065,delay:k*.05}));this.voice(2,{gain:.45,rate:1.18})}},
  chessDrop(p){this.noise({freq:780,q:1.8,dur:.04,gain:.05});this.tone(p===1?392:494,{dur:.12,gain:.065,type:'triangle'})},
  boxPush(goal){this.noise({freq:600,to:300,q:.6,dur:.12,gain:.06});if(goal){this.tone(880,{dur:.16,gain:.07,type:'triangle'});this.voice(2,{gain:.4,rate:1.1})}else this.tone(160,{dur:.06,gain:.035})},
  lightFlip(on){this.tone(on?988:659,{dur:.18,gain:.065,to:on?1319:392});this.tone(on?1480:494,{dur:.11,gain:.035,delay:.06})},
  hintSpark(){this.tone(784,{dur:.1,gain:.05});this.tone(1047,{dur:.15,gain:.05,delay:.08})},
  matchCascade(size,chain){for(let k=0;k<Math.min(size,5);k++)this.tone(note(523,k+Math.min(chain,5)),{dur:.11,gain:.045,delay:k*.032,to:note(659,k+Math.min(chain,5))});this.voice((chain-1)%4,{gain:.45,rate:Math.min(1.5,1+chain*.075),delay:.05})},
  matchSwap(){this.slide();this.tone(440,{dur:.08,gain:.04,to:660});this.tone(660,{dur:.08,gain:.035,delay:.08})},
  matchFall(){this.noise({freq:2400,to:800,dur:.12,gain:.025,filter:'highpass'});this.tone(330,{dur:.08,gain:.03,to:220})},
  matchPower(kind){if(kind==='rainbow'){[0,2,4,5,7,9,12].forEach((v,k)=>this.tone(note(523,v),{dur:.2,gain:.045,delay:k*.045}));this.voice(1,{gain:.35,rate:1.35,dur:.2})}else if(kind==='bomb'){this.noise({freq:850,to:120,dur:.2,gain:.08,filter:'lowpass'});this.tone(130,{dur:.22,gain:.08,to:50});this.voice(3,{gain:.3,rate:1.2,dur:.25})}else{this.noise({freq:800,to:4200,dur:.16,gain:.05});this.tone(390,{dur:.16,gain:.05,to:1400,type:'triangle'})}},
  sliceCut(count,combo){this.noise({freq:4200,to:1300,dur:.075,gain:.065,filter:'highpass'});this.tone(450+Math.min(combo,8)*60,{dur:.1,gain:.06,to:1000});if(count>=2||combo>=3&&combo%3===0)this.voice(combo%4,{gain:.4,rate:Math.min(1.55,1+combo*.06),dur:.2})},
  sliceDanger(){this.noise({freq:500,to:90,dur:.22,gain:.11,filter:'lowpass'});this.tone(140,{dur:.24,gain:.075,to:60});this.voice(3,{gain:.45,dur:.25});this.pigYelp({delay:.12})},
  starShot(){this.tone(1150,{dur:.035,gain:.014,to:650,type:'triangle'})},
  starPop(){this.tone(640,{dur:.09,gain:.04,to:1400});this.noise({freq:2200,dur:.035,gain:.025})},
  starHit(){this.noise({freq:1800,to:200,dur:.22,gain:.08});this.voice(3,{gain:.4,rate:1.1,dur:.25});this.pigYelp({delay:.1,rate:1.1})},
  starShield(){[262,392,523,784].forEach((f,k)=>this.tone(f,{dur:.3,gain:.05,delay:k*.045,to:f*1.5}));this.voice(2,{gain:.35,dur:.25})},
  rhythmBeat(beat,bpm){const melody=[0,4,7,4,2,5,9,5,4,7,11,7,2,5,7,2];this.tone(note(262,melody[beat%16]),{dur:Math.min(.3,45/bpm),gain:.042,type:'triangle'});if(beat%4===0){this.tone(70,{dur:.12,gain:.085,to:38});this.tone(note(131,[0,0,5,7][Math.floor(beat/4)%4]),{dur:.2,gain:.05,type:'triangle'})}else this.noise({freq:5200,dur:.025,gain:.025,filter:'highpass'})},
  rhythmHit(lane,perfect,combo){this.tone([659,784,988,1175][lane],{dur:.09,gain:perfect?.065:.04,type:'triangle'});if(combo>0&&combo%16===0)this.voice(lane,{gain:.3,rate:1.4,dur:.15})},
  rhythmMiss(){this.tone(185,{dur:.085,gain:.035,to:120})},
  // ---- 合成猪叫库：本地 Web Audio 生成，走“猪叫”音量层，暂停 / 静音 / 切换游戏一并停止 ----
  // o: {pts:[[秒,Hz],...] 音高轮廓, dur, gain, am:[Hz,深度] 喉音颤动, vib:[Hz,深度Hz], noise:0–1 气声, nasal:鼻音共鸣强度, pan, delay, wave}
  pigSynth(o){
   if(!this.live)return null;const c=this.ctx,t0=c.currentTime+(o.delay||0),dur=o.dur||.25,retro=this.profile==='retro',fairy=this.profile==='fairy';
   const pitch=(fairy?1.22:1)*(o.rate||1)*(.97+Math.random()*.06),gain=(o.gain||.5)*(retro?.6:1);
   const now=c.currentTime;this.synthPigs=(this.synthPigs||[]).filter(v=>v.end>now);
   while(this.synthPigs.length>=4){const old=this.synthPigs.shift();try{old.g.gain.cancelScheduledValues(0);old.g.gain.setTargetAtTime(0,now,.02)}catch(e){}}
   const out=c.createGain(),am=c.createGain();out.gain.setValueAtTime(.0001,t0);out.gain.exponentialRampToValueAtTime(gain,t0+.018);out.gain.setValueAtTime(gain,t0+Math.max(.03,dur-.07));out.gain.exponentialRampToValueAtTime(.0001,t0+dur);
   let tail=out;if(c.createStereoPanner&&o.pan){const p=c.createStereoPanner();p.pan.value=Math.max(-1,Math.min(1,o.pan));out.connect(p);tail=p}tail.connect(this.pigBus);
   am.gain.value=1;am.connect(out);
   const nodes=[],track=n=>{nodes.push(n);const tr={src:n,g:out,i:-1};this.effects.push(tr);n.onended=()=>{this.effects=this.effects.filter(v=>v!==tr)}};
   const oscA=c.createOscillator(),oscB=c.createOscillator(),mixB=c.createGain();oscA.type=retro?'square':o.wave||'sawtooth';oscB.type=retro?'square':'square';mixB.gain.value=retro?.2:.28;
   const pts=o.pts||[[0,260]];[oscA,oscB].forEach((osc,k)=>{const f=osc.frequency,m=k?1.006:1;f.setValueAtTime(pts[0][1]*pitch*m,t0);for(let i=1;i<pts.length;i++)f.exponentialRampToValueAtTime(Math.max(30,pts[i][1]*pitch*m),t0+pts[i][0])});
   // 鼻腔共鸣：两个带通峰（复古音色时跳过，保持芯片味）
   let bus=am;if(!retro){const f1=c.createBiquadFilter(),f2=c.createBiquadFilter(),lp=c.createBiquadFilter(),g2=c.createGain();f1.type='bandpass';f1.frequency.value=(fairy?1050:780)*(o.formant||1);f1.Q.value=3+(o.nasal||1)*2;f2.type='bandpass';f2.frequency.value=(fairy?2500:1750)*(o.formant||1);f2.Q.value=5;g2.gain.value=.55;lp.type='lowpass';lp.frequency.value=fairy?4200:3200;
    lp.connect(f1);lp.connect(f2);f1.connect(am);f2.connect(g2);g2.connect(am);const dry=c.createGain();dry.gain.value=.22;lp.connect(dry);dry.connect(am);bus=lp}
   oscA.connect(bus);oscB.connect(mixB);mixB.connect(bus);
   if(o.vib){const l=c.createOscillator(),lg=c.createGain();l.frequency.value=o.vib[0];lg.gain.value=o.vib[1]*pitch;l.connect(lg);lg.connect(oscA.frequency);lg.connect(oscB.frequency);track(l);l.start(t0);l.stop(t0+dur+.05)}
   if(o.am){const l=c.createOscillator(),lg=c.createGain();l.type='square';l.frequency.value=o.am[0];lg.gain.value=o.am[1];l.connect(lg);lg.connect(am.gain);track(l);l.start(t0);l.stop(t0+dur+.05)}
   if(o.noise&&this.noiseBuf){const n=c.createBufferSource(),nf=c.createBiquadFilter(),ng=c.createGain();n.buffer=this.noiseBuf;nf.type='bandpass';nf.frequency.value=o.noiseFreq||1300;nf.Q.value=1.4;ng.gain.value=o.noise*.9;n.connect(nf);nf.connect(ng);ng.connect(am);track(n);n.start(t0,Math.random()*.4);n.stop(t0+dur+.02)}
   [oscA,oscB].forEach(osc=>{track(osc);osc.start(t0);osc.stop(t0+dur+.03)});
   const v={g:out,end:t0+dur+.05};this.synthPigs.push(v);return v},
  // 猪猪词汇：每个都带一点随机变化，避免机械重复
  pigOink(o){o=o||{};this.pigSynth({pts:[[0,230],[.05,300],[.2,180]],dur:.22,gain:.5,am:[38,.45],noise:.25,rate:o.rate,delay:o.delay,pan:o.pan})},
  pigHum(o){o=o||{};const d=o.delay||0,r=o.rate||1;this.pigSynth({pts:[[0,320],[.1,380],[.2,380],[.28,470],[.42,430]],dur:.44,gain:.55,wave:'triangle',vib:[6,6],noise:.05,formant:.85,rate:r,delay:d});this.pigSynth({pts:[[0,470],[.08,560],[.2,520]],dur:.22,gain:.36,wave:'triangle',noise:.05,formant:.85,rate:r,delay:d+.5})},
  pigGiggle(o){o=o||{};for(let k=0;k<4;k++)this.pigSynth({pts:[[0,300+k*40],[.04,380+k*45],[.09,280+k*40]],dur:.1,gain:.38,am:[42,.35],noise:.18,rate:o.rate,delay:(o.delay||0)+k*.11})},
  pigSnort(o){o=o||{};this.pigSynth({pts:[[0,150],[.08,120],[.18,135]],dur:.2,gain:.42,am:[62,.6],noise:.85,noiseFreq:900,nasal:2,rate:o.rate,delay:o.delay})},
  pigSqueal(o){o=o||{};this.pigSynth({pts:[[0,620],[.12,1150],[.32,980],[.45,820]],dur:.46,gain:.42,vib:[9,28],noise:.12,formant:1.25,rate:o.rate,delay:o.delay})},
  // 受击哀嚎：先拔高，再颤抖着往下掉；重伤时跟两声抽泣
  pigWail(big,o){o=o||{};const d=o.delay||0;this.pigSynth({pts:[[0,640],[.07,860],[.45,560],[big?.95:.7,300]],dur:big?.98:.72,gain:big?.6:.5,vib:[6.5,big?38:26],am:[26,.22],noise:.16,formant:1.1,rate:o.rate,delay:d,pan:o.pan});
   if(big){[0,1].forEach(k=>this.pigSynth({pts:[[0,420-k*40],[.05,470-k*40],[.13,300-k*40]],dur:.14,gain:.32,am:[40,.4],noise:.25,rate:o.rate,delay:d+1.02+k*.17,pan:o.pan}))}},
  pigYelp(o){o=o||{};this.pigSynth({pts:[[0,880],[.04,1020],[.24,520]],dur:.26,gain:.48,am:[30,.2],noise:.18,formant:1.2,rate:o.rate,delay:o.delay,pan:o.pan})},
  pigWhimper(o){o=o||{};this.pigSynth({pts:[[0,520],[.25,470],[.55,330]],dur:.56,gain:.52,wave:'triangle',vib:[7,14],noise:.12,rate:o.rate,delay:o.delay})},
  pigSmug(o){o=o||{};this.pigSynth({pts:[[0,175],[.1,205],[.27,165]],dur:.28,gain:.62,wave:'triangle',noise:.15,nasal:2.2,formant:.8,rate:o.rate,delay:o.delay})},
  pigSnore(o){o=o||{};const d=o.delay||0;this.pigSynth({pts:[[0,95],[.5,110],[.7,90]],dur:.72,gain:.34,am:[22,.7],noise:.6,noiseFreq:700,nasal:2,rate:o.rate,delay:d});this.noise({freq:2400,q:.8,dur:.55,gain:.035,filter:'highpass',delay:d+.85})},
  pigCheer(o){o=o||{};const d=o.delay||0;[0,1,2].forEach(k=>this.pigSynth({pts:[[0,300+k*70],[.05,380+k*80],[.12,320+k*70]],dur:.13,gain:.42,am:[40,.35],noise:.2,rate:o.rate,delay:d+k*.13}));this.pigSqueal({rate:o.rate,delay:d+.42})},
  // 随机挑一个轻快的猪声（不重复上一个）
  pigHappy(o){const list=['pigOink','pigHum','pigGiggle','pigSmug'];let k;do{k=Math.floor(Math.random()*list.length)}while(k===this.lastHappy&&list.length>1);this.lastHappy=k;this[list[k]](o)},
  // ---- 猪猪轮盘：每个音效都由舞台时间轴在动作关键帧触发 ----
  rlPage(){this.noise({freq:5200,to:2200,q:.7,dur:.13,gain:.07,filter:'highpass'});this.noise({freq:1400,to:3800,q:1.4,dur:.09,gain:.035,delay:.05})},
  rlMagic(){[0,4,7,11,14].forEach((st,k)=>this.tone(note(659,st),{dur:.32,gain:.05,type:'sine',delay:k*.055,to:note(659,st)*1.01}));this.noise({freq:6000,dur:.4,gain:.03,filter:'highpass'});this.voice(0,{rate:1.45,gain:.45,dur:.22,delay:.18})},
  rlPoof(){this.noise({freq:900,to:300,q:.6,dur:.25,gain:.08,filter:'lowpass'});this.tone(520,{dur:.14,gain:.05,to:260,type:'triangle'})},
  rlReveal(real){if(real){this.tone(98,{dur:.5,gain:.13,to:73,type:'triangle'});this.tone(147,{dur:.45,gain:.07,type:'triangle',delay:.02});this.noise({freq:300,dur:.3,gain:.06,filter:'lowpass'})}else{this.tone(880,{dur:.12,gain:.07,type:'triangle'});this.tone(1319,{dur:.2,gain:.06,type:'triangle',delay:.08})}},
  rlUnfold(){this.noise({freq:3200,q:3,dur:.03,gain:.08});this.tone(1200,{dur:.04,gain:.05,type:'square',delay:.09});this.noise({freq:2400,q:3,dur:.03,gain:.07,delay:.16})},
  rlScan(dur){const d=dur||1;this.tone(420,{dur:d,gain:.035,to:1260,type:'sine'});this.noise({freq:1200,to:5000,q:4,dur:d,gain:.025})},
  rlBeep(fast){this.tone(fast?1760:1320,{dur:.05,gain:.05,type:'square'})},
  rlWhoosh(){this.noise({freq:500,to:2600,q:.8,dur:.28,gain:.07})},
  rlCatch(){this.noise({freq:700,q:1,dur:.07,gain:.08,filter:'lowpass'});this.tone(180,{dur:.08,gain:.06,to:120})},
  rlChew(k){const r=.9+((k||0)%3)*.08;this.noise({freq:1800*r,q:2.4,dur:.06,gain:.08});this.noise({freq:900*r,q:2,dur:.05,gain:.06,delay:.07});this.tone(160*r,{dur:.05,gain:.03,delay:.02})},
  rlFart(){const c=this.ctx;if(!this.live)return;const t=c.currentTime,o=c.createOscillator(),f=c.createBiquadFilter(),g=c.createGain();o.type='sawtooth';o.frequency.setValueAtTime(92,t);for(let k=1;k<9;k++)o.frequency.linearRampToValueAtTime(70+((k*37)%30)-k*2,t+k*.07);f.type='lowpass';f.frequency.value=520;f.Q.value=6;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.26,t+.03);g.gain.setValueAtTime(.22,t+.45);g.gain.exponentialRampToValueAtTime(.0001,t+.62);o.connect(f);f.connect(g);g.connect(this.fxBus);const tr={src:o,g,i:-1};this.effects.push(tr);o.onended=()=>{this.effects=this.effects.filter(v=>v!==tr)};o.start(t);o.stop(t+.66);this.noise({freq:260,q:1.2,dur:.55,gain:.06,filter:'lowpass'})},
  rlCompress(){this.tone(300,{dur:.32,gain:.11,to:90,type:'triangle'});this.tone(620,{dur:.2,gain:.05,to:1240,type:'sine',delay:.22});this.noise({freq:3000,to:900,q:.8,dur:.18,gain:.05,delay:.05})},
  rlPower(){[0,4,7,12].forEach((st,k)=>this.tone(note(392,st),{dur:.18,gain:.06,type:'triangle',delay:k*.06}))},
  rlChomp(k){this.noise({freq:1100+(k||0)*120,q:1.6,dur:.09,gain:.09});this.tone(240,{dur:.08,gain:.05,to:140,delay:.03})},
  rlGulp(){this.tone(320,{dur:.12,gain:.09,to:150});this.tone(180,{dur:.16,gain:.07,to:360,delay:.13})},
  rlHeart(){[0,4,7].forEach((st,k)=>this.tone(note(784,st),{dur:.26,gain:.06,type:'sine',delay:k*.07}));this.pigHum({delay:.1})},
  rlSquelch(){this.noise({freq:420,to:900,q:3,dur:.16,gain:.07});this.tone(140,{dur:.12,gain:.04,to:220})},
  rlSplat(big){this.noise({freq:big?700:1000,to:120,q:.7,dur:big?.42:.3,gain:big?.2:.13,filter:'lowpass'});this.tone(big?90:130,{dur:.24,gain:big?.16:.1,to:50});this.noise({freq:2200,q:2,dur:.08,gain:.05,delay:.03})},
  rlStruggle(k){this.tone(700+((k||0)%2)*160,{dur:.07,gain:.035,to:520,type:'triangle'});this.noise({freq:500,q:3,dur:.07,gain:.04})},
  rlSuction(){this.noise({freq:300,to:1200,q:4,dur:.1,gain:.08});this.tone(140,{dur:.08,gain:.06,to:80})},
  rlStretch(dur){this.tone(160,{dur:dur||.7,gain:.06,to:420,type:'sawtooth'});this.noise({freq:600,to:1600,q:5,dur:dur||.7,gain:.025})},
  rlPop(){this.tone(220,{dur:.09,gain:.16,to:880});this.noise({freq:2600,q:1.4,dur:.05,gain:.1});this.pigSqueal({delay:.05,rate:1.1})},
  rlBoing(){this.tone(260,{dur:.42,gain:.09,to:120,type:'triangle'});this.tone(520,{dur:.3,gain:.04,to:260,delay:.04})},
  rlPlop(){this.tone(300,{dur:.1,gain:.07,to:160});this.noise({freq:800,q:1,dur:.05,gain:.05,filter:'lowpass'})},
  rlClack(){this.noise({freq:2600,q:4,dur:.035,gain:.09});this.tone(820,{dur:.04,gain:.05,type:'square',delay:.06})},
  rlHeartbeat(){this.tone(62,{dur:.12,gain:.16,to:44});this.tone(58,{dur:.12,gain:.12,to:42,delay:.2})},
  rlFire(real,boosted){if(real){this.noise({freq:1600,to:300,q:.6,dur:.18,gain:boosted?.18:.12});this.tone(boosted?110:160,{dur:.2,gain:boosted?.18:.12,to:60})}else{this.noise({freq:1200,to:500,q:.8,dur:.22,gain:.06});this.tone(330,{dur:.2,gain:.05,to:220,type:'triangle'})}},
  rlHit(boosted,who){this.rlSplat(boosted);this.pigWail(boosted,{delay:.05,rate:who===0?1.12:.92});if(boosted)this.tone(70,{dur:.4,gain:.14,to:38,delay:.02})},
  rlRelief(){this.tone(523,{dur:.12,gain:.05,type:'triangle'});this.tone(392,{dur:.22,gain:.05,type:'triangle',delay:.1})},
  rlLoad(k){this.tone(1046+((k||0)%4)*90,{dur:.05,gain:.05,type:'triangle'});this.noise({freq:4200,q:5,dur:.03,gain:.05})},
  rlItemGet(k){this.tone(note(659,(k||0)%6),{dur:.12,gain:.05,type:'triangle'})},
  rlSkip(){this.tone(196,{dur:.18,gain:.08,to:147,type:'triangle'});this.rlSquelch()},
  rlTurn(){this.tone(988,{dur:.07,gain:.04,type:'triangle'})},
  rlDenied(){this.tone(233,{dur:.09,gain:.06,type:'triangle'});this.tone(196,{dur:.12,gain:.05,type:'triangle',delay:.08})},
  win(){[523,659,784,1047].forEach((f,k)=>this.tone(f,{dur:.35,gain:.09,type:'triangle',delay:k*.09}));[0,1,2,3].forEach((i,k)=>this.voice(i,{gain:.8,delay:.32+k*.17,pan:[-.6,.6,-.25,.25][k]}));this.later(1150,()=>[0,1,2,3].forEach((i,k)=>this.voice(i,{gain:.55,rate:1.08,delay:k*.04,pan:[-.7,.7,-.3,.3][k]})))},
  lose(){[392,330,262,196].forEach((f,k)=>this.tone(f,{dur:.28,gain:.08,type:'triangle',delay:k*.14}));this.voice(3,{rate:.82,gain:.8,delay:.5});this.pigWhimper({delay:1.25})},
  preview(i){this.stop();this.voice(i,{gain:1})}
 };
 return S;
}
const api={createSound,note,NAMES};if(typeof module!=='undefined')module.exports=api;root.PigAudio=api;
})(typeof window!=='undefined'?window:globalThis);
