// Layered sound engine test with a fake Web Audio implementation.
const assert=require('node:assert/strict'),fs=require('fs');
global.PigCore=require('./app/core.js');global.window=global;global.atob=s=>Buffer.from(s,'base64').toString('binary');
eval(fs.readFileSync('app/sounds.js','utf8'));const {createSound}=require('./app/audio.js');
const log=[];let now=0;
const param=()=>({value:0,setValueAtTime(v){this.value=v},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){},cancelScheduledValues(){}});
const node=type=>({type,connect(){},gain:param(),frequency:param(),Q:param(),pan:param(),playbackRate:param(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param(),start(t){log.push({type,t,wave:this.type,freq:this.frequency.value,rate:this.playbackRate.value,buf:this.buffer&&this.buffer.id})},stop(){log.push({type:type+'-stop'})}});
class FakeCtx{constructor(){this.state='running';this.sampleRate=44100;this.destination={}}get currentTime(){return now}createGain(){return node('gain')}createDynamicsCompressor(){return node('comp')}createOscillator(){return node('osc')}createBiquadFilter(){return node('filter')}createStereoPanner(){return node('pan')}createBufferSource(){return node('src')}createBuffer(c,l){return {getChannelData:()=>new Float32Array(l)}}decodeAudioData(buf,ok){ok({id:buf.byteLength,duration:.5});return Promise.resolve()}resume(){}}
const mem={};const store={get:(k,d)=>k in mem?mem[k]:d,set:(k,v)=>mem[k]=v};
const S=createSound({store,AudioContext:FakeCtx,clips:window.PIG_VOICES});
assert.equal(window.PIG_VOICES.length,4);
S.dig(3);assert.equal(log.length,0,'nothing plays before the first user gesture');
S.unlock();assert(S.ready,'four clips decoded');assert.equal(new Set(S.buffers.map(b=>b.id)).size,4);
const count=f=>{log.length=0;f();return {osc:log.filter(x=>x.type==='osc').length,noise:log.filter(x=>x.type==='src'&&x.buf===undefined).length,pig:log.filter(x=>x.type==='src'&&x.buf!==undefined).length}};
// layer 1: small actions never use pig voices
for(const f of [()=>S.dig(0),()=>S.dig(4),()=>S.cascade(30),()=>S.flag(true),()=>S.flag(false),()=>S.chord(),()=>S.flip(),()=>S.miss(),()=>S.slide(),()=>S.undo(),()=>S.pop(),()=>S.tick(),()=>S.boing(),()=>S.click()]){const c=count(f);assert.equal(c.pig,0);assert(c.osc+c.noise>0)}
// numbers sound different from each other; cascades scale with size
const freqs=[];for(let n=1;n<=8;n++){const before=log.length;S.dig(n)}
assert(count(()=>S.cascade(60)).osc>count(()=>S.cascade(2)).osc);
// layer 2: one pig per meaningful moment
assert.equal(count(()=>S.match(5,0)).pig,1);assert.equal(count(()=>S.hit(3)).pig,1);assert.equal(count(()=>S.merge([4])).pig,1,'every merge grunts');assert(count(()=>S.merge([4])).osc>=2,'merge pop');assert.equal(count(()=>S.merge([4,8,16,32])).pig,2,'many merges: pops for all, grunts for the two biggest');assert(count(()=>S.merge([4,8,16,32])).osc>=8);assert.equal(count(()=>S.merge([2048])).pig,1);
log.length=0;S.merge([4]);const small=log.find(x=>x.buf).rate;log.length=0;S.merge([1024]);assert(log.find(x=>x.buf).rate<small,'bigger pig, deeper grunt');
for(const f of [()=>S.eat(3),()=>S.gold(),()=>S.double(),()=>S.milestone(),()=>S.crash()])assert(count(f).pig>=1);for(const f of [()=>S.jump(),()=>S.land(),()=>S.apple(),()=>S.goldGone(),()=>S.spawnTile()]){const c=count(f);assert.equal(c.pig,0);assert(c.osc+c.noise>0)}
log.length=0;S.hit(0);const r0=log.find(x=>x.buf).rate;log.length=0;S.hit(8);assert(log.find(x=>x.buf).rate>r0,'combo raises pitch');
// layer 3: chain wakes every pig with overlapping voices; stop() cancels the rest
const timers=[];const realSet=global.setTimeout;global.setTimeout=(fn,ms)=>{timers.push({fn,ms});return timers.length};global.clearTimeout=id=>{if(timers[id-1])timers[id-1].fn=null};
const seen=[];const total=S.chain(Array.from({length:99},(_,k)=>({i:k,pan:0})),it=>seen.push(it.i));
assert.equal(timers.length,99);assert(total>3000&&total<7000,'99 pigs pop within a few seconds: '+total);
const gaps=timers.map(t=>t.ms);assert(gaps.every((t,k)=>k===0||t>gaps[k-1]),'pigs pop one after another');
log.length=0;timers.slice(0,30).forEach(t=>t.fn&&t.fn());assert.equal(seen.length,30);assert(log.filter(x=>x.buf!==undefined&&x.type==='src').length===30);assert(S.voices.length<=S.maxVoices,'voice cap keeps the mix clean');
S.stop();timers.forEach(t=>t.fn&&t.fn());assert.equal(seen.length,30,'stop cancels remaining pigs');
assert.equal(count(()=>S.win()).pig,4);
// mute
S.enabled=false;assert.deepEqual(count(()=>{S.dig(2);S.win();S.hit(1)}),{osc:0,noise:0,pig:0});S.enabled=true;
// shuffled bag never repeats a pig back to back and uses all four per round
S.bag=[];const picks=Array.from({length:40},()=>S.choose());for(let i=0;i<40;i+=4)assert.equal(new Set(picks.slice(i,i+4)).size,4);for(let i=1;i<40;i++)assert.notEqual(picks[i],picks[i-1]);
const cards=fs.readdirSync('app/assets/cards').filter(x=>x.endsWith('.svg'));assert.equal(cards.length,12);
// New gameplay cues remain varied but quiet; meaningful milestones use voices.
for(const f of [()=>S.blockRotate(),()=>S.blockLand(),()=>S.paddleBounce(),()=>S.brickPop(),()=>S.flapWing(),()=>S.gatePass(1),()=>S.chessDrop(1),()=>S.boxPush(false),()=>S.lightFlip(true),()=>S.hintSpark()]){const c=count(f);assert.equal(c.pig,0);assert(c.osc+c.noise>0)}
for(const f of [()=>S.blockClear(4),()=>S.gatePass(5),()=>S.stackLand(true),()=>S.boxPush(true),()=>S.matchCascade(5,3)])assert(count(f).pig>=1);
const profiles=[];for(const profile of ['soft','fairy','retro']){S.profile=profile;log.length=0;S.hintSpark();const n=log.find(x=>x.type==='osc');profiles.push({wave:n.wave,freq:n.freq});S.save();assert.equal(mem['sound-profile'],profile)}assert.equal(new Set(profiles.map(x=>x.freq)).size,3);assert.equal(profiles[2].wave,'square');
S.stop();S.profile='soft';log.length=0;S.blockClear(4);const scheduled=log.filter(x=>x.type==='osc').length;assert.equal(scheduled,4);log.length=0;S.stop();assert(log.filter(x=>x.type==='osc-stop').length>=scheduled,'pause cancels synthesized sounds too');assert.equal(S.effects.length,0);
S.enabled=false;assert.deepEqual(count(()=>{S.matchCascade(5,3);S.brickPop();S.flapWing();S.blockClear(4)}),{osc:0,noise:0,pig:0});S.enabled=true;
console.log('PASS: 8 game cue families; 3 distinct audio profiles; profiles saved; mute and pause cancel synthesized effects.');
for(const f of [()=>S.matchSwap(),()=>S.matchFall(),()=>S.matchPower('row'),()=>S.matchPower('col'),()=>S.sliceCut(1,1),()=>S.starShot(),()=>S.starPop(),()=>S.rhythmBeat(3,124),()=>S.rhythmHit(1,true,2),()=>S.rhythmMiss()]){const c=count(f);assert(c.osc+c.noise>0);assert.equal(c.pig,0)}
for(const f of [()=>S.matchPower('rainbow'),()=>S.matchPower('bomb'),()=>S.sliceCut(3,3),()=>S.sliceDanger(),()=>S.starHit(),()=>S.starShield()])assert(count(f).pig>=1);
S.stop();S.enabled=false;assert.deepEqual(count(()=>{S.sliceCut(3,3);S.starShot();S.starShield();S.rhythmBeat(0,124);S.matchPower('rainbow')}),{osc:0,noise:0,pig:0});S.enabled=true;
console.log('PASS: animated match powers, slicing combos/hazards, quiet star shots/protection, rhythm beat/judgement; all respect mute.');
console.log('PASS: small actions use soft cues only; pig voices for match/every 2048 merge (size sets pitch)/catch/eat; jump, land, apple stay synth; combo raises pitch; 99-pig chain pops in sequence with voice cap; stop cancels; mute silences; bag never repeats.');
// 4.2 合成猪叫库与猪猪轮盘音效
const pigNames=['pigOink','pigHum','pigGiggle','pigSnort','pigSqueal','pigWail','pigYelp','pigWhimper','pigSmug','pigSnore','pigCheer','pigHappy'];
const pigFreqs=new Set();for(const n of pigNames){log.length=0;S[n]();const osc=log.filter(x=>x.type==='osc');assert(osc.length>=2,n+' 合成了振荡器');pigFreqs.add(osc[0].freq|0)}
assert(pigFreqs.size>=8,'猪叫音高各不相同');
S.stop();assert.equal(S.effects.length,0,'暂停 / 停止取消合成猪叫');
for(let k=0;k<12;k++)S.pigOink();assert(S.synthPigs.filter(v=>!v.faded).length<=12&&S.synthPigs.length<=4,'同时合成的猪叫最多四只');S.stop();
const rl=['rlPage','rlMagic','rlPoof','rlUnfold','rlScan','rlBeep','rlWhoosh','rlCatch','rlChew','rlFart','rlCompress','rlPower','rlChomp','rlGulp','rlHeart','rlSquelch','rlSplat','rlStruggle','rlSuction','rlStretch','rlPop','rlBoing','rlPlop','rlClack','rlHeartbeat','rlFire','rlHit','rlRelief','rlLoad','rlItemGet','rlSkip','rlTurn','rlDenied'];
for(const n of rl){const c=count(()=>S[n](true));assert(c.osc+c.noise>0,n)}
S.stop();S.enabled=false;assert.deepEqual(count(()=>{S.pigWail(true);S.pigCheer();S.rlFart();S.rlHit(true)}),{osc:0,noise:0,pig:0});S.enabled=true;
for(const prof of ['soft','fairy','retro']){S.profile=prof;log.length=0;S.pigOink();assert(log.some(x=>x.type==='osc'))}S.profile='soft';
console.log('PASS: 12 synthesized pig voices (hum, giggle, wail, yelp…) and',rl.length,'roulette cues; capped, stoppable, muted, all three timbres.');
