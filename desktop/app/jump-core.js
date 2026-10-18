/* 猪猪跳一跳：独立规则，不依赖渲染或时钟。
 * Charge -> horizontal travel, current/next platform landing and midpoint camera
 * are adapted from shenmaxg/web-jump, commit 3fdcb17436f77ddb6664b9aad8f9c5fffdf0fe58.
 * Copyright (c) 2018 Edwin Webb. MIT; see assets/licenses/shenmaxg_web-jump-MIT.txt.
 * This version keeps actual landing offsets, supports square/circular surfaces,
 * and uses elapsed milliseconds instead of frame counts on every device.
 */
(function(root){
'use strict';
// FLIGHT_MS is the longest airtime; short hops are snappier (see flightFor).
const MAX_CHARGE=1500, MIN_DISTANCE=12, MAX_DISTANCE=342, FLIGHT_MS=520, SETTLE_MS=250, FALL_MS=620;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// 彩蛋平台：落上去后先别蓄力，静静停 EGG_MS 毫秒即得额外分（每座平台一次，不影响连续中心）。
// weight 决定抽中概率（默认 1）；猪猪轮盘系列另有效果：
//  sack 弹料袋：一半假屎 +8、一半真屎 +3；feed 饲料：下一次成功落台得分 ×2；book 魔法书：下一跳显示预估落点；
//  cloth 魔术布：戴上魔术帽；crown 猪王宝座（稀有）：戴上王冠。帽子、王冠只是装扮，不影响判定。
const EGG_MS=2000,EGG_RATE=.08,EGGS={merge:{shape:'square',points:5},pool:{shape:'square',points:8},ddz:{shape:'square',points:10},
 mine:{shape:'square',points:5},puddle:{shape:'circle',points:5},rhythm:{shape:'circle',points:10},
 sack:{shape:'circle',points:8,series:'roulette'},rotten:{shape:'circle',points:5,series:'roulette'},plunger:{shape:'circle',points:6,series:'roulette'},
 cloth:{shape:'square',points:8,series:'roulette'},feed:{shape:'square',points:2,series:'roulette'},xray:{shape:'square',points:5,series:'roulette'},
 book:{shape:'square',points:3,series:'roulette'},crown:{shape:'square',points:15,series:'roulette',weight:.5}};
function distanceFor(ms){return MIN_DISTANCE+(MAX_DISTANCE-MIN_DISTANCE)*clamp(ms,0,MAX_CHARGE)/MAX_CHARGE}
// Airtime and apex grow with distance, so a tiny hop no longer floats as long as a leap.
function flightFor(distance){return clamp(330+distance*.56,330,FLIGHT_MS)}
function apexFor(distance){return 46+clamp(distance,0,MAX_DISTANCE)*.3}
function chargeFor(distance){return clamp((distance-MIN_DISTANCE)/(MAX_DISTANCE-MIN_DISTANCE)*MAX_CHARGE,0,MAX_CHARGE)}
// Signed distance to the real top surface; negative means inside. Visual shadows
// and the pig's round belly do not enlarge its small hoof contact point.
function surfaceDistance(p,point){
 const x=Math.abs(point.x-p.x),z=Math.abs(point.z-p.z),r=p.size/2;
 return p.shape==='circle'?Math.hypot(x,z)-r:Math.max(x,z)-r;
}
function classify(current,next,point){
 if(surfaceDistance(next,point)<=0){
  const offset=Math.hypot(point.x-next.x,point.z-next.z);
  return {kind:'next',perfect:offset<=next.size*.12,offset};
 }
 if(surfaceDistance(current,point)<=0)return {kind:'stay',perfect:false};
 const dx=next.x-current.x,dz=next.z-current.z;
 const beyond=(point.x-next.x)*dx+(point.z-next.z)*dz>0;
 const dc=surfaceDistance(current,point),dn=surfaceDistance(next,point),edge=Math.min(dc,dn)<12;
 // Edge misses tip outward from the platform they clipped; gap misses keep falling forward.
 const from=dn<dc?next:current,ox=edge?point.x-from.x:dx,oz=edge?point.z-from.z:dz,len=Math.hypot(ox,oz)||1;
 return {kind:'miss',reason:edge?'edge':beyond?'long':'short',tip:{x:ox/len,z:oz/len},slide:edge?16:0};
}
class Jump{
 constructor(mode,rng){
  this.mode=mode==='practice'?'practice':'classic';this.rng=rng||Math.random;
  this.score=0;this.steps=0;this.combo=0;this.bestCombo=0;this.perfects=0;this.eggs=[];this.eggTime=0;this.feed=false;this.prophecy=false;this.hat=null;
  this.phase='ready';this.charge=0;this.time=0;this.phaseTime=0;this.over=false;
  this.platforms=[{id:0,x:0,z:0,size:116,shape:'square',color:0}];
  this.current=this.platforms[0];this.next=this.makeNext(true);this.platforms.push(this.next);
  this.pig={x:0,z:0,height:0};this.camera={x:this.next.x/2,z:0};
  this.cameraTarget={...this.camera};this.last=null;this.flight=null;
 }
 random(){const n=this.rng();return Number.isFinite(n)?clamp(n,0,1-Number.EPSILON):.5}
 pickEgg(){
  const keys=Object.keys(EGGS),total=keys.reduce((s,k)=>s+(EGGS[k].weight||1),0);let r=this.random()*total;
  for(const k of keys){r-=EGGS[k].weight||1;if(r<0)return k}return keys[keys.length-1];
 }
 makeNext(first){
  const easy=this.mode==='practice',n=this.steps;
  const size=first?112:(easy?118:104)-Math.min(n,easy?22:28)+(this.random()-.5)*22;
  const gap=first?62:(easy?35:40)+this.random()*(easy?68:92)+Math.min(n,35)*.65;
  const axis=first?'x':this.random()<.5?'x':'z';
  const step=this.current.size/2+gap+size/2;
  let shape=!first&&this.random()<.42?'circle':'square',egg=null;
  // Rare treat: about one in twelve platforms, never two in a row, none in the opening four hops.
  if(!first&&n>=4&&!this.current.egg&&this.random()<EGG_RATE){egg=this.pickEgg();shape=EGGS[egg].shape}
  return {id:n+1,x:this.current.x+(axis==='x'?step:0),z:this.current.z+(axis==='z'?step:0),
   size,shape,color:(n+1)%4,egg,eggDone:false};
 }
 // Landing bounce is cosmetic: a held input may start the next charge right away.
 get canBegin(){return !this.over&&(this.phase==='ready'||this.phase==='settling')}
 // 0..1 while the pig quietly waits on an unopened egg platform.
 get eggProgress(){const p=this.current;return p.egg&&!p.eggDone&&this.phase==='ready'?Math.min(1,this.eggTime/EGG_MS):0}
 begin(){
  if(!this.canBegin)return false;this.eggTime=0;
  this.phase='charging';this.phaseTime=0;this.charge=0;return true;
 }
 cancel(){if(this.phase!=='charging')return false;this.phase='ready';this.charge=0;this.phaseTime=0;return true}
 prediction(ms){
  const dx=this.next.x-this.pig.x,dz=this.next.z-this.pig.z,len=Math.hypot(dx,dz)||1;
  const distance=distanceFor(ms===undefined?this.charge:ms);
  return {x:this.pig.x+dx/len*distance,z:this.pig.z+dz/len*distance};
 }
 release(){
  if(this.phase!=='charging'||this.over)return false;
  const end=this.prediction(),landing=classify(this.current,this.next,end),distance=distanceFor(this.charge);
  this.flight={from:{...this.pig},to:end,landing,charge:this.charge,duration:flightFor(distance),apex:apexFor(distance)};
  this.prophecy=false;
  this.phase='flying';this.phaseTime=0;return true;
 }
 land(events){
  const f=this.flight,l=f.landing;this.pig={...f.to,height:0};
  this.last=l;this.charge=0;this.phaseTime=0;this.eggTime=0;
  if(l.kind==='miss'){
   this.combo=0;this.phase='falling';events.push({type:'miss',reason:l.reason});return;
  }
  if(l.kind==='stay'){
   this.combo=0;this.phase='settling';events.push({type:'stay'});return;
  }
  this.steps++;
  if(l.perfect){this.combo++;this.perfects++;this.bestCombo=Math.max(this.combo,this.bestCombo)}else this.combo=0;
  let points=l.perfect?Math.min(10,this.combo*2):1;const doubled=this.feed;
  if(doubled){points*=2;this.feed=false}
  this.score+=points;this.current=this.next;this.next=this.makeNext(false);
  this.platforms.push(this.next);if(this.platforms.length>7)this.platforms.shift();
  this.cameraTarget={x:(this.pig.x+this.next.x)/2,z:(this.pig.z+this.next.z)/2};
  this.phase='settling';events.push({type:'land',perfect:l.perfect,points,combo:this.combo,doubled});
 }
 update(ms){
  const events=[];if(this.over||!Number.isFinite(ms)||ms<=0)return events;
  // Consume large intervals in small pieces, so a slow frame cannot skip landing
  // or change charge distance. The UI handles pausing; the core never reads Date.
  let remaining=Math.min(ms,10000);
  while(remaining>0&&!this.over){
   const dt=Math.min(remaining,16);remaining-=dt;this.time+=dt;this.phaseTime+=dt;
   const follow=1-Math.exp(-dt/105);
   this.camera.x+=(this.cameraTarget.x-this.camera.x)*follow;
   this.camera.z+=(this.cameraTarget.z-this.camera.z)*follow;
   if(this.phase==='charging')this.charge=Math.min(MAX_CHARGE,this.charge+dt);
   else if(this.phase==='flying'){
    const f=this.flight,t=Math.min(1,this.phaseTime/f.duration);
    this.pig.x=f.from.x+(f.to.x-f.from.x)*t;this.pig.z=f.from.z+(f.to.z-f.from.z)*t;
    this.pig.height=4*f.apex*t*(1-t);
    if(t>=1)this.land(events);
   }else if(this.phase==='settling'&&this.phaseTime>=SETTLE_MS){this.phase='ready';this.phaseTime=0}
   else if(this.phase==='ready'&&this.current.egg&&!this.current.eggDone){
    this.eggTime+=dt;
    if(this.eggTime>=EGG_MS){
     const p=this.current;let points=EGGS[p.egg].points,outcome=null;
     if(p.egg==='sack'){outcome=this.random()<.5?'fake':'real';points=outcome==='fake'?8:3}
     if(p.egg==='feed')this.feed=true;
     if(p.egg==='book')this.prophecy=true;
     if(p.egg==='cloth'&&this.hat!=='crown')this.hat='hat';
     if(p.egg==='crown')this.hat='crown';
     p.eggDone=true;this.score+=points;this.eggs.push(p.egg);events.push({type:'egg',egg:p.egg,points,outcome});
    }
   }
   else if(this.phase==='falling'){
    // Edge misses slide off first, then gravity takes over.
    const l=this.last,f=this.flight,k=Math.min(1,this.phaseTime/220),slide=(l.slide||0)*(1-Math.pow(1-k,2));
    this.pig.x=f.to.x+l.tip.x*slide;this.pig.z=f.to.z+l.tip.z*slide;
    this.pig.height=-Math.pow(Math.max(0,this.phaseTime-(l.slide?90:0))/FALL_MS,2)*210;
    if(this.phaseTime>=FALL_MS){this.phase='over';this.over=true;events.push({type:'over'})}
   }
  }
  return events;
 }
}
const api={Jump,EGGS,EGG_MS,EGG_RATE,MAX_CHARGE,MIN_DISTANCE,MAX_DISTANCE,FLIGHT_MS,SETTLE_MS,FALL_MS,distanceFor,chargeFor,flightFor,apexFor,surfaceDistance,classify};
if(typeof module==='object'&&module.exports)module.exports=api;
root.PigJumpCore=api;
})(typeof window!=='undefined'?window:globalThis);
