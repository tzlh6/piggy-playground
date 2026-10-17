/* 黑猪8 — deterministic, offline eight-ball core.
 * Collision / rolling / hot-seat architecture informed by neuralsorcerer/8ballpool
 * at 5c7a8b3dd424693ed323583c95fc2587c0d48899 (MIT, Soumyadip Sarkar, 2024).
 * Reimplemented for Piggy Playground: 240 Hz, pocket jaws, called eight, CPU play.
 * See assets/licenses/neuralsorcerer_8ballpool-MIT.txt. No DOM, audio or wall clock.
 */
(function(root){
'use strict';
const W=1000,H=500,R=16,STEP=1/240,MAX_SPEED=1450,DRAG=90;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const group=id=>id===0?'cue':id===8?'eight':id<8?'solid':'stripe';
const POCKETS=[{x:0,y:0},{x:500,y:-4},{x:1000,y:0},{x:0,y:500},{x:500,y:504},{x:1000,y:500}];
// Contact faces are shared by renderer, simulation, and the aiming ray.
const RAILS=[];
function segment(x1,y1,x2,y2){RAILS.push({x1,y1,x2,y2})}
for(const y of [0,H]){
 const sign=y===0?-1:1;
 segment(43,y,466,y);segment(534,y,957,y);
 segment(43,y,23,y+sign*20);segment(466,y,478,y+sign*18);
 segment(534,y,522,y+sign*18);segment(957,y,977,y+sign*20);
}
for(const x of [0,W]){
 const sign=x===0?-1:1;
 segment(x,43,x,457);segment(x,43,x+sign*20,23);segment(x,457,x+sign*20,477);
}
function ball(id,x,y){return {id,x,y,vx:0,vy:0,potted:false,pocket:-1,roll:0}}
function rack(rng){
 const ids=[1,2,9,3,8,10,11,4,12,5,6,13,7,14,15];
 // Keep 8 at the centre of row three, one solid and one stripe in rear corners.
 const pool=[2,3,4,5,7,9,10,11,12,13,14];
 for(let i=pool.length-1;i>0;i--){const j=Math.floor(clamp(rng(),0,.999999)*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}
 let k=0;for(let i=0;i<15;i++)if(![0,4,10,14].includes(i))ids[i]=pool[k++];
 ids[10]=6;ids[14]=15;
 // A fixed rack is preferable to a duplicate if a shuffle used the rear reserves.
 if(new Set(ids).size!==15||ids.some(n=>!n))ids.splice(0,15,1,2,9,3,8,10,11,4,12,5,6,13,7,14,15);
 const out=[ball(0,250,250)];k=0;
 for(let row=0;row<5;row++)for(let col=0;col<=row;col++)out.push(ball(ids[k++],716+row*(R*2+.12)*Math.sqrt(3)/2,250+(col-row/2)*(R*2+.12)));
 return out.sort((a,b)=>a.id-b.id);
}
function closest(p,s){const dx=s.x2-s.x1,dy=s.y2-s.y1,t=clamp(((p.x-s.x1)*dx+(p.y-s.y1)*dy)/(dx*dx+dy*dy),0,1);return {x:s.x1+dx*t,y:s.y1+dy*t}}
function rayCircle(x,y,dx,dy,cx,cy,r){
 const a=cx-x,b=cy-y,proj=a*dx+b*dy,disc=r*r-a*a-b*b+proj*proj;
 if(disc<0||proj<0)return Infinity;const t=proj-Math.sqrt(disc);return t>=-.01?Math.max(0,t):Infinity;
}
function trace(g,angle){
 const q=g.balls[0],dx=Math.cos(angle),dy=Math.sin(angle);let dist=Infinity,hit=null,normal=null;
 for(const b of g.balls)if(b.id&&!b.potted){const d=rayCircle(q.x,q.y,dx,dy,b.x,b.y,R*2);if(d<dist){dist=d;hit=b;normal=null}}
 // Ray against the Minkowski expansion of each rail segment (line + end caps).
 for(const s of RAILS){
  const sx=s.x2-s.x1,sy=s.y2-s.y1,len=Math.hypot(sx,sy),nx=-sy/len,ny=sx/len;
  const denom=dx*nx+dy*ny;
  if(Math.abs(denom)>1e-9)for(const sign of [-1,1]){
   const d=((s.x1-q.x)*nx+(s.y1-q.y)*ny+sign*R)/denom;
   const along=((q.x+dx*d-s.x1)*sx+(q.y+dy*d-s.y1)*sy)/(len*len);
   if(d>=0&&d<dist&&along>=0&&along<=1){dist=d;hit=null;normal={x:nx*sign,y:ny*sign}}
  }
  for(const p of [{x:s.x1,y:s.y1},{x:s.x2,y:s.y2}]){
   const d=rayCircle(q.x,q.y,dx,dy,p.x,p.y,R);
   if(d<dist){dist=d;hit=null;normal={x:(q.x+dx*d-p.x)/R,y:(q.y+dy*d-p.y)/R}}
  }
 }
 dist=Math.min(dist,1400);return {x:q.x+dx*dist,y:q.y+dy*dist,dist,hit:hit?hit.id:null,normal,dx,dy};
}
function clearPath(g,a,b,skip,margin){
 const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;
 for(const c of g.balls){
  if(c.potted||skip.includes(c.id))continue;
  const t=l2?clamp(((c.x-a.x)*dx+(c.y-a.y)*dy)/l2,0,1):0;
  if(Math.hypot(a.x+dx*t-c.x,a.y+dy*t-c.y)<R*2+(margin||0))return false;
 }
 return true;
}
class Pool{
 constructor(mode,rng){
  this.mode=mode==='practice'?'practice':mode==='local'?'local':['easy','hard'].includes(mode)?mode:'normal';
  this.rng=rng||Math.random;this.balls=rack(this.rng);this.turn=0;this.groups=[null,null];
  this.phase='aim';this.break=true;this.ballInHand=false;this.winner=null;this.over=false;
  this.shots=[0,0];this.pottedBy=[[],[]];this.calledPocket=null;this.acc=0;this.time=0;
  this.shot=null;this.last=null;this.history=[];this.events=[];
 }
 remaining(player){return this.balls.filter(b=>!b.potted&&group(b.id)===this.groups[player]).length}
 targets(player){
  if(this.mode==='practice')return this.balls.filter(b=>b.id&&!b.potted).map(b=>b.id);
  const own=this.groups[player];
  return this.balls.filter(b=>!b.potted&&b.id&&(own?(this.remaining(player)?group(b.id)===own:b.id===8):b.id!==8)).map(b=>b.id);
 }
 get canShoot(){return this.phase==='aim'&&!this.over&&!this.ballInHand}
 get needsCall(){return this.mode!=='practice'&&!this.break&&!!this.groups[this.turn]&&this.remaining(this.turn)===0}
 validCue(x,y){
  return Number.isFinite(x)&&Number.isFinite(y)&&x>=R+1&&x<=W-R-1&&y>=R+1&&y<=H-R-1&&
   !POCKETS.some(p=>Math.hypot(x-p.x,y-p.y)<35)&&
   !this.balls.some(b=>b.id&&!b.potted&&Math.hypot(x-b.x,y-b.y)<R*2+.6);
 }
 placeCue(x,y){
  if(!this.ballInHand||this.phase!=='aim'||!this.validCue(x,y))return false;
  Object.assign(this.balls[0],{x,y,vx:0,vy:0,potted:false,pocket:-1});this.ballInHand=false;return true;
 }
 callPocket(index){if(!this.needsCall||!Number.isInteger(index)||index<0||index>5)return false;this.calledPocket=index;return true}
 shoot(angle,power){
  if(!this.canShoot||!Number.isFinite(angle)||!Number.isFinite(power)||power<.025||power>1||(this.needsCall&&this.calledPocket===null))return false;
  const speed=80+power*(MAX_SPEED-80),q=this.balls[0];q.vx=Math.cos(angle)*speed;q.vy=Math.sin(angle)*speed;
  this.shot={player:this.turn,first:null,pots:[],rails:new Set(),afterRail:false,targets:this.targets(this.turn),called:this.calledPocket,wasBreak:this.break,elapsed:0};
  this.shots[this.turn]++;this.phase='moving';this.acc=0;this.events=[];return true;
 }
 pot(b,pocket){
  b.potted=true;b.pocket=pocket;b.vx=b.vy=0;
  this.shot.pots.push({id:b.id,pocket});
  this.events.push({type:'pot',id:b.id,pocket,x:b.x,y:b.y});
 }
 step(){
  const shot=this.shot;this.time+=STEP;shot.elapsed+=STEP;
  for(const b of this.balls){
   if(b.potted)continue;
   b.x+=b.vx*STEP;b.y+=b.vy*STEP;
   const speed=Math.hypot(b.vx,b.vy);b.roll+=speed*STEP/R;
   const next=Math.max(0,speed*Math.exp(-.12*STEP)-DRAG*STEP);
   if(next<2.5)b.vx=b.vy=0;else{b.vx*=next/(speed||1);b.vy*=next/(speed||1)}
   const pocket=POCKETS.findIndex((p,i)=>Math.hypot(b.x-p.x,b.y-p.y)<(i===1||i===4?27:32));
   if(pocket>=0){this.pot(b,pocket);continue}
   for(const s of RAILS){
    const p=closest(b,s),dx=b.x-p.x,dy=b.y-p.y,dist=Math.hypot(dx,dy);
    if(dist>=R||dist<1e-8)continue;
    const nx=dx/dist,ny=dy/dist,v=b.vx*nx+b.vy*ny;
    b.x+=nx*(R-dist+.001);b.y+=ny*(R-dist+.001);
    if(v<0){
     const tangentX=b.vx-v*nx,tangentY=b.vy-v*ny;
     b.vx=tangentX*.985-v*nx*.82;b.vy=tangentY*.985-v*ny*.82;
     if(shot.first!==null)shot.afterRail=true;if(b.id)shot.rails.add(b.id);
     if(-v>7)this.events.push({type:'rail',id:b.id,x:b.x,y:b.y,strength:-v});
    }
   }
   // The open pocket shelf must not leave an unreachable ball outside the table.
   if(b.x<-35||b.x>W+35||b.y<-35||b.y>H+35){
    let pi=0,d=Infinity;POCKETS.forEach((p,i)=>{const k=Math.hypot(b.x-p.x,b.y-p.y);if(k<d){d=k;pi=i}});this.pot(b,pi);
   }
  }
  for(let i=0;i<16;i++){
   const a=this.balls[i];if(a.potted)continue;
   for(let j=i+1;j<16;j++){
    const b=this.balls[j];if(b.potted)continue;
    const dx=b.x-a.x,dy=b.y-a.y,d2=dx*dx+dy*dy;
    if(d2>=R*R*4)continue;
    const d=Math.sqrt(d2)||.0001,nx=d2?dx/d:1,ny=d2?dy/d:0,overlap=R*2-d;
    a.x-=nx*(overlap/2+.001);a.y-=ny*(overlap/2+.001);b.x+=nx*(overlap/2+.001);b.y+=ny*(overlap/2+.001);
    const closing=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;
    if(closing<=0)continue;
    const impulse=closing*.985;a.vx-=impulse*nx;a.vy-=impulse*ny;b.vx+=impulse*nx;b.vy+=impulse*ny;
    if(a.id===0&&shot.first===null)shot.first=b.id;
    if(closing>7)this.events.push({type:'hit',a:a.id,b:b.id,x:(a.x+b.x)/2,y:(a.y+b.y)/2,strength:closing});
   }
  }
  if(!this.balls.some(b=>!b.potted&&(b.vx!==0||b.vy!==0)))this.resolve();
 }
 update(ms){
  this.events=[];if(this.phase!=='moving'||!Number.isFinite(ms)||ms<=0)return this.events;
  this.acc+=Math.min(ms/1000,1);
  while(this.acc+1e-10>=STEP&&this.phase==='moving'){this.acc-=STEP;this.step()}
  return this.events;
 }
 respot(id){
  const b=this.balls[id];let pos=null;
  for(let offset=0;offset<1000&&!pos;offset+=R*2+1)for(const sign of [1,-1]){
   const x=716+offset*sign,y=250;
   if(x>=R&&x<=W-R&&!this.balls.some(c=>c.id!==id&&!c.potted&&Math.hypot(x-c.x,y-c.y)<R*2+.1)){pos={x,y};break}
  }
  if(!pos)for(let y=R+2;y<H-R&&!pos;y+=R*2+2)for(let x=R+2;x<W-R;x+=R*2+2)if(!this.balls.some(c=>c.id!==id&&!c.potted&&Math.hypot(x-c.x,y-c.y)<R*2+.1)){pos={x,y};break}
  Object.assign(b,pos||{x:250,y:250},{vx:0,vy:0,potted:false,pocket:-1});
 }
 resolve(){
  const s=this.shot,p=s.player,op=1-p,pots=s.pots.filter(b=>b.id>0&&b.id!==8),eight=s.pots.find(b=>b.id===8),scratch=this.balls[0].potted;
  let foul=scratch?'白猪落袋':s.first===null?'白猪没有碰到任何球':!s.targets.includes(s.first)?'先碰到了不该打的球':
   s.wasBreak&&!pots.length&&s.rails.size<4?'开球未进球，且不足四颗目标球碰库':!s.wasBreak&&!s.pots.some(b=>b.id)&&!s.afterRail?'碰球后没有球进袋或碰库':'';
  this.break=false;this.phase='aim';this.calledPocket=null;
  let again=false,reason='';
  if(this.mode==='practice'){
   foul='';again=true;this.pottedBy[0].push(...s.pots.filter(b=>b.id).map(b=>b.id));
   if(scratch){this.ballInHand=true;reason='白猪落袋，点桌面重新摆放'}
   else reason=pots.length||eight?'漂亮！继续练下一杆':'调整角度，再来一杆';
   if(this.balls.slice(1).every(b=>b.potted)){this.over=true;this.winner=0;this.phase='over';reason='清台完成'}
  }else{
   if(eight&&s.wasBreak){this.respot(8);reason='开球黑猪入袋，已重新摆回'}
   else if(eight){
    this.over=true;this.phase='over';
    const legal=s.targets.length===1&&s.targets[0]===8&&!foul&&s.called===eight.pocket;
    this.winner=legal?p:op;
    reason=legal?'黑猪归位，拿下这一局！':foul?'打进黑猪时犯规，判负':s.targets.includes(8)?'黑猪进了未指定的球袋，判负':'提前打进黑猪，判负';
   }
   if(!this.over){
    if(!foul&&!s.wasBreak&&!this.groups[p]&&pots.length){this.groups[p]=group(pots[0].id);this.groups[op]=this.groups[p]==='solid'?'stripe':'solid'}
    again=!foul&&(this.groups[p]?pots.some(b=>group(b.id)===this.groups[p]):pots.length>0);
    if(foul){this.turn=op;this.ballInHand=true;reason=foul+' · 对方获得自由球'}
    else{if(!again)this.turn=op;reason=(reason?reason+'；':'')+(again?'合法进球，继续出杆':'换对方出杆')}
   }
   for(const b of s.pots)if(b.id&&!(b.id===8&&s.wasBreak))this.pottedBy[p].push(b.id);
  }
  if(scratch&&!this.over){this.balls[0].vx=this.balls[0].vy=0;this.ballInHand=true}
  this.last={player:p,foul,reason,pots:s.pots.map(b=>({...b})),again,first:s.first};
  this.history.unshift(this.last);if(this.history.length>8)this.history.pop();
  this.events.push({type:'settled',...this.last,over:this.over,winner:this.winner});
 }
}
function candidates(g){
 const q=g.balls[0],out=[];
 for(const id of g.targets(g.turn)){
  const b=g.balls[id];
  for(let pocket=0;pocket<6;pocket++){
   const p=POCKETS[pocket],dist=Math.hypot(p.x-b.x,p.y-b.y),ux=(p.x-b.x)/dist,uy=(p.y-b.y)/dist;
   const ghost={x:b.x-ux*R*2,y:b.y-uy*R*2},d=Math.hypot(ghost.x-q.x,ghost.y-q.y),dx=(ghost.x-q.x)/d,dy=(ghost.y-q.y)/d,cos=dx*ux+dy*uy;
   if(!Number.isFinite(cos)||cos<.24||ghost.x<R||ghost.x>W-R||ghost.y<R||ghost.y>H-R)continue;
   if(!clearPath(g,q,ghost,[0,id],1)||!clearPath(g,b,p,[0,id],.5))continue;
   const speed=Math.sqrt(2*DRAG*(d+(dist+60)/(cos*cos)))*1.12;
   out.push({angle:Math.atan2(dy,dx),power:clamp((speed-80)/(MAX_SPEED-80),.12,.95),pocket,id,quality:cos*cos/(dist+d*.5+60)});
  }
 }
 return out.sort((a,b)=>b.quality-a.quality);
}
function placeForAI(g){
 // Try the extension of a target-to-pocket line; never bypass placement checks.
 for(const id of g.targets(g.turn))for(const p of POCKETS){
  const b=g.balls[id],d=Math.hypot(b.x-p.x,b.y-p.y),pos={x:b.x+(b.x-p.x)/d*135,y:b.y+(b.y-p.y)/d*135};
  if(g.validCue(pos.x,pos.y)){g.placeCue(pos.x,pos.y);return true}
 }
 for(let y=80;y<H;y+=65)for(let x=80;x<W;x+=80)if(g.placeCue(x,y))return true;
 return false;
}
function plan(g,difficulty,rng){
 rng=rng||Math.random;if(g.over||g.phase!=='aim')return null;
 if(g.ballInHand&&!placeForAI(g))return null;
 if(g.break)return {angle:Math.atan2(250-g.balls[0].y,716-g.balls[0].x)+(rng()-.5)*.008,power:.96,pocket:0};
 const options=candidates(g),easy=difficulty==='easy',hard=difficulty==='hard';
 let shot=options[0];
 if(options.length&&easy)shot=options[Math.floor(clamp(rng(),0,.9999)*Math.min(3,options.length))];
 if(!shot){
  const q=g.balls[0],legal=g.targets(g.turn),visible=legal.filter(id=>clearPath(g,q,g.balls[id],[0,id],0));
  const ids=visible.length?visible:legal;let best=null;
  for(const id of ids){const b=g.balls[id],dist=Math.hypot(b.x-q.x,b.y-q.y);if(!best||dist<best.dist)best={angle:Math.atan2(b.y-q.y,b.x-q.x),power:clamp(Math.sqrt(2*DRAG*(dist+550))/MAX_SPEED,.32,.85),pocket:POCKETS.reduce((a,p,i)=>Math.hypot(b.x-p.x,b.y-p.y)<Math.hypot(b.x-POCKETS[a].x,b.y-POCKETS[a].y)?i:a,0),dist}}
  shot=best||{angle:0,power:.5,pocket:0};
 }
 const noise=easy?.024:hard?.0015:.007;
 return {...shot,angle:shot.angle+(rng()-.5)*noise*2,power:clamp(shot.power*(1+(rng()-.5)*(easy?.13:hard?.025:.065)),.03,1)};
}
const api={Pool,W,H,R,STEP,MAX_SPEED,DRAG,POCKETS,RAILS,group,trace,clearPath,candidates,plan,placeForAI,rayCircle};
if(typeof module==='object'&&module.exports)module.exports=api;root.PigPoolCore=api;
})(typeof window!=='undefined'?window:globalThis);
