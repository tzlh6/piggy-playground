/* 猪猪跳一跳：独立规则，不依赖渲染或时钟。
 * Charge -> horizontal travel, current/next platform landing and midpoint camera
 * are adapted from shenmaxg/web-jump, commit 3fdcb17436f77ddb6664b9aad8f9c5fffdf0fe58.
 * Copyright (c) 2018 Edwin Webb. MIT; see assets/licenses/shenmaxg_web-jump-MIT.txt.
 * This version keeps actual landing offsets, supports square/circular surfaces,
 * and uses elapsed milliseconds instead of frame counts on every device.
 */
(function(root){
'use strict';
const MAX_CHARGE=1500, MIN_DISTANCE=12, MAX_DISTANCE=342, FLIGHT_MS=480;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function distanceFor(ms){return MIN_DISTANCE+(MAX_DISTANCE-MIN_DISTANCE)*clamp(ms,0,MAX_CHARGE)/MAX_CHARGE}
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
 const edge=Math.min(surfaceDistance(current,point),surfaceDistance(next,point))<12;
 return {kind:'miss',reason:edge?'edge':beyond?'long':'short'};
}
class Jump{
 constructor(mode,rng){
  this.mode=mode==='practice'?'practice':'classic';this.rng=rng||Math.random;
  this.score=0;this.steps=0;this.combo=0;this.bestCombo=0;this.perfects=0;
  this.phase='ready';this.charge=0;this.time=0;this.phaseTime=0;this.over=false;
  this.platforms=[{id:0,x:0,z:0,size:116,shape:'square',color:0}];
  this.current=this.platforms[0];this.next=this.makeNext(true);this.platforms.push(this.next);
  this.pig={x:0,z:0,height:0};this.camera={x:this.next.x/2,z:0};
  this.cameraTarget={...this.camera};this.last=null;this.flight=null;
 }
 random(){const n=this.rng();return Number.isFinite(n)?clamp(n,0,1-Number.EPSILON):.5}
 makeNext(first){
  const easy=this.mode==='practice',n=this.steps;
  const size=first?112:(easy?118:104)-Math.min(n,easy?22:28)+(this.random()-.5)*22;
  const gap=first?62:(easy?35:40)+this.random()*(easy?68:92)+Math.min(n,35)*.65;
  const axis=first?'x':this.random()<.5?'x':'z';
  const step=this.current.size/2+gap+size/2;
  return {id:n+1,x:this.current.x+(axis==='x'?step:0),z:this.current.z+(axis==='z'?step:0),
   size,shape:!first&&this.random()<.42?'circle':'square',color:(n+1)%4};
 }
 begin(){
  if(this.phase!=='ready'||this.over)return false;
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
  const end=this.prediction(),landing=classify(this.current,this.next,end);
  this.flight={from:{...this.pig},to:end,landing,charge:this.charge};
  this.phase='flying';this.phaseTime=0;return true;
 }
 land(events){
  const f=this.flight,l=f.landing;this.pig={...f.to,height:0};
  this.last=l;this.charge=0;this.phaseTime=0;
  if(l.kind==='miss'){
   this.combo=0;this.phase='falling';events.push({type:'miss',reason:l.reason});return;
  }
  if(l.kind==='stay'){
   this.combo=0;this.phase='settling';events.push({type:'stay'});return;
  }
  this.steps++;
  if(l.perfect){this.combo++;this.perfects++;this.bestCombo=Math.max(this.combo,this.bestCombo)}else this.combo=0;
  const points=l.perfect?Math.min(10,this.combo*2):1;
  this.score+=points;this.current=this.next;this.next=this.makeNext(false);
  this.platforms.push(this.next);if(this.platforms.length>7)this.platforms.shift();
  this.cameraTarget={x:(this.pig.x+this.next.x)/2,z:(this.pig.z+this.next.z)/2};
  this.phase='settling';events.push({type:'land',perfect:l.perfect,points,combo:this.combo});
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
    const t=Math.min(1,this.phaseTime/FLIGHT_MS),f=this.flight;
    this.pig.x=f.from.x+(f.to.x-f.from.x)*t;this.pig.z=f.from.z+(f.to.z-f.from.z)*t;
    this.pig.height=4*(72+f.charge/MAX_CHARGE*36)*t*(1-t);
    if(t>=1)this.land(events);
   }else if(this.phase==='settling'&&this.phaseTime>=250){this.phase='ready';this.phaseTime=0}
   else if(this.phase==='falling'){
    this.pig.height=-Math.pow(this.phaseTime/550,2)*190;
    if(this.phaseTime>=550){this.phase='over';this.over=true;events.push({type:'over'})}
   }
  }
  return events;
 }
}
const api={Jump,MAX_CHARGE,MIN_DISTANCE,MAX_DISTANCE,FLIGHT_MS,distanceFor,chargeFor,surfaceDistance,classify};
if(typeof module==='object'&&module.exports)module.exports=api;
root.PigJumpCore=api;
})(typeof window!=='undefined'?window:globalThis);
