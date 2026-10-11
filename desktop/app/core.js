/* Minesweeper mechanics adapted from Ania Kubow (2020), MIT. */
(function(root){
'use strict';
function shuffle(a,rng){rng=rng||Math.random;for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));const t=a[i];a[i]=a[j];a[j]=t}return a}

class Mine{
 constructor(w,h,count){this.w=w;this.h=h;this.count=count;this.status='ready';this.flags=0;this.cells=Array.from({length:w*h},()=>({pig:false,open:false,flag:false,n:0}));this.hit=-1;this.lastOpened=0}
 near(i){const a=[],r=Math.floor(i/this.w),c=i%this.w;for(let y=r-1;y<=r+1;y++)for(let x=c-1;x<=c+1;x++)if(y>=0&&y<this.h&&x>=0&&x<this.w&&(y!==r||x!==c))a.push(y*this.w+x);return a}
 plant(first){shuffle(this.cells.map((_,i)=>i).filter(i=>i!==first)).slice(0,this.count).forEach(i=>this.cells[i].pig=true);this.cells.forEach((c,i)=>c.n=this.near(i).filter(j=>this.cells[j].pig).length);this.status='playing'}
 flag(i){const c=this.cells[i];if(!c||c.open||this.status==='won'||this.status==='lost'||(!c.flag&&this.flags>=this.count))return false;c.flag=!c.flag;this.flags+=c.flag?1:-1;return true}
 reveal(i){
  const cell=this.cells[i];this.lastOpened=0;
  if(!cell||cell.flag||this.status==='won'||this.status==='lost')return false;
  if(this.status==='ready')this.plant(i);
  let queue=[i];
  if(cell.open){if(!cell.n||this.near(i).filter(j=>this.cells[j].flag).length!==cell.n)return false;queue=this.near(i)}
  let changed=false;
  while(queue.length){const j=queue.pop(),c=this.cells[j];if(c.open||c.flag)continue;if(c.pig){this.status='lost';this.hit=j;return true}c.open=true;changed=true;this.lastOpened++;if(!c.n)queue.push(...this.near(j))}
  if(this.cells.every(c=>c.pig||c.open)){this.status='won';this.autoFlag()}
  return changed
 }
 // Windows-style ending: every pig gets a flag once the field is cleared.
 autoFlag(){this.cells.forEach(c=>{if(c.pig&&!c.flag){c.flag=true;this.flags++}})}
 // Order in which pigs wake up after a loss: rippling out from the pig that was hit.
 wakeOrder(rng){rng=rng||Math.random;const hr=Math.floor(this.hit/this.w),hc=this.hit%this.w;return this.cells.map((c,i)=>i).filter(i=>this.cells[i].pig&&i!==this.hit&&!this.cells[i].flag).map(i=>({i,d:Math.hypot(Math.floor(i/this.w)-hr,i%this.w-hc)+rng()*2.2})).sort((a,b)=>a.d-b.d).map(x=>x.i)}
}

function slideLine(line){const values=line.filter(Boolean),out=[],merged=[];let score=0;for(let i=0;i<values.length;i++){if(values[i]===values[i+1]){merged.push(out.length);out.push(values[i]*2);score+=values[i]*2;i++}else out.push(values[i])}return {line:out.concat(Array(line.length-out.length).fill(0)),score,merged}}
// Returns the new board plus how every tile travels, so the UI can slide tiles and pop merges.
function move2048(board,direction){const next=Array(16).fill(0),merged=[],moves=[];let score=0;
 for(let n=0;n<4;n++){const ids=Array.from({length:4},(_,k)=>direction==='left'?n*4+k:direction==='right'?n*4+3-k:direction==='up'?k*4+n:(3-k)*4+n);
  const tiles=ids.filter(i=>board[i]).map(i=>({v:board[i],src:i}));let out=0;
  for(let k=0;k<tiles.length;k++){const to=ids[out],t=tiles[k];
   if(k+1<tiles.length&&tiles[k+1].v===t.v){const v=t.v*2;next[to]=v;score+=v;merged.push(to);moves.push({from:t.src,to,v:t.v,keep:true,merge:true});moves.push({from:tiles[k+1].src,to,v:t.v,keep:false,merge:true});k++}
   else{next[to]=t.v;moves.push({from:t.src,to,v:t.v,keep:true,merge:false})}
   out++}}
 return {board:next,score,merged,moves,top:merged.reduce((m,i)=>Math.max(m,next[i]),0),changed:next.some((v,i)=>v!==board[i])}}
function canMove(board){return board.some(v=>!v)||['left','right','up','down'].some(d=>move2048(board,d).changed)}
function spawnTile(board,rng){rng=rng||Math.random;const empty=board.map((v,i)=>v===0?i:-1).filter(i=>i>=0);if(!empty.length)return -1;const i=empty[Math.floor(rng()*empty.length)];board[i]=rng()<.9?2:4;return i}

// ---------- 贪吃猪 (snake) ----------
const DIRS={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]},OPP={up:'down',down:'up',left:'right',right:'left'};
class Snake{
 constructor(w,h,rng){this.w=w;this.h=h;this.rng=rng||Math.random;const y=Math.floor(h/2),x=Math.floor(w/3);this.body=[[x,y],[x-1,y],[x-2,y]];this.dir='right';this.queue=[];this.grow=0;this.eaten=0;this.score=0;this.dead=false;this.gold=null;this.food=this.freeCell()}
 freeCell(){const taken=new Set(this.body.map(([x,y])=>y*this.w+x));if(this.food)taken.add(this.food[1]*this.w+this.food[0]);if(this.gold)taken.add(this.gold.y*this.w+this.gold.x);const free=[];for(let i=0;i<this.w*this.h;i++)if(!taken.has(i))free.push(i);if(!free.length)return null;const i=free[Math.floor(this.rng()*free.length)];return [i%this.w,Math.floor(i/this.w)]}
 turn(d){if(!DIRS[d])return false;const last=this.queue.length?this.queue[this.queue.length-1]:this.dir;if(d===last||d===OPP[last]||this.queue.length>=2)return false;this.queue.push(d);return true}
 step(){if(this.dead)return {type:'dead'};if(this.queue.length)this.dir=this.queue.shift();const [dx,dy]=DIRS[this.dir],[hx,hy]=this.body[0],nx=hx+dx,ny=hy+dy;
  const tailMoves=this.grow===0,hitsBody=this.body.some(([x,y],k)=>x===nx&&y===ny&&!(tailMoves&&k===this.body.length-1));
  if(nx<0||ny<0||nx>=this.w||ny>=this.h||hitsBody){this.dead=true;return {type:'dead',x:nx,y:ny}}
  this.body.unshift([nx,ny]);if(this.grow>0)this.grow--;else this.body.pop();
  let ev={type:'move'};
  if(this.gold){this.gold.ttl--;if(this.gold.x===nx&&this.gold.y===ny){this.grow+=2;this.score+=50;this.gold=null;ev={type:'gold'}}else if(this.gold.ttl<=0){this.gold=null;ev={type:'goldgone'}}}
  if(this.food&&this.food[0]===nx&&this.food[1]===ny){this.grow+=1;this.eaten++;this.score+=10;this.food=this.freeCell();ev={type:'eat',count:this.eaten};
   if(this.eaten%5===0&&!this.gold){const c=this.freeCell();if(c)this.gold={x:c[0],y:c[1],ttl:Math.max(this.w,this.h)+12}}}
  if(!this.food&&!this.gold)ev={type:'full'};
  return ev}
}

// ---------- 跳跳猪 (runner) ----------
class Runner{
 constructor(rng){this.rng=rng||Math.random;this.W=800;this.ground=184;this.speed=330;this.dist=0;this.score=0;this.time=0;this.obs=[];this.apples=[];this.next=520;this.pig={x:70,y:this.ground,vy:0,air:false,duck:false,jumps:0};this.over=false;this.milestone=0;this.applesTaken=0}
 pigBox(){const p=this.pig,w=p.duck&&!p.air?62:50,h=p.duck&&!p.air?26:40;return {x:p.x+6,y:p.y-h+4,w:w-12,h:h-8}}
 jump(){const p=this.pig;if(this.over)return false;p.cutPending=false;if(!p.air){p.vy=-760;p.air=true;p.duck=false;return 'jump'}if(p.jumps<1&&p.vy>-200){p.vy=-620;p.jumps++;return 'double'}return false}
 // 松开可以跳得低一点，但至少升到 MIN_HOP，单击（立刻松开）也能跳过最高的篱笆和最宽的泥坑
 release(){const p=this.pig;if(!p.air||p.vy>=-320)return;if(this.ground-p.y>=Runner.MIN_HOP)p.vy=-320;else p.cutPending=true}
 duck(on){const p=this.pig;p.duck=on;if(on&&p.air)p.vy=Math.max(p.vy,520)}
 spawn(){const r=this.rng,s=this.score;let o;const kind=s>250&&r()<.28?'crow':r()<.22?'mud':'fence';
  if(kind==='fence'){const w=r()<.35?44:22,h=30+Math.floor(r()*18);o={kind,x:this.W+20,y:this.ground-h,w,h}}
  else if(kind==='mud'){o={kind,x:this.W+20,y:this.ground-12,w:58+Math.floor(r()*30),h:12}}
  else{const high=r()<.5;o={kind,x:this.W+20,y:this.ground-(high?48:28),w:42,h:22,flap:0,high}}
  this.obs.push(o);if(r()<.45)this.apples.push({x:this.W+20+o.w/2+(r()*160-40),y:this.ground-60-Math.floor(r()*70),r:11});
  const minGap=Math.max(260,this.speed*0.62);this.next=minGap+r()*380}
 update(dt){if(this.over)return [];const ev=[];dt=Math.min(dt,.05);this.time+=dt;this.speed=Math.min(820,330+this.time*11);const dx=this.speed*dt;this.dist+=dx;this.score+=dx/18;
  const p=this.pig;if(p.air){p.vy+=2300*dt;p.y+=p.vy*dt;if(p.cutPending&&this.ground-p.y>=Runner.MIN_HOP){p.cutPending=false;if(p.vy<-320)p.vy=-320}if(p.y>=this.ground){p.y=this.ground;p.vy=0;p.air=false;p.jumps=0;p.cutPending=false;ev.push('land')}}
  this.next-=dx;if(this.next<=0)this.spawn();
  this.obs.forEach(o=>{o.x-=dx*(o.kind==='crow'?1.12:1);if(o.kind==='crow')o.flap+=dt});this.obs=this.obs.filter(o=>o.x+o.w>-20);
  this.apples.forEach(a=>a.x-=dx);const b=this.pigBox();
  this.apples=this.apples.filter(a=>{if(a.x+a.r<b.x||a.x-a.r>b.x+b.w||a.y+a.r<b.y||a.y-a.r>b.y+b.h)return a.x>-20;this.score+=25;this.applesTaken++;ev.push('apple');return false});
  for(const o of this.obs){const pad=o.kind==='mud'?6:3;if(b.x<o.x+o.w-pad&&b.x+b.w>o.x+pad&&b.y<o.y+o.h&&b.y+b.h>o.y+pad){this.over=true;ev.push('crash');break}}
  const m=Math.floor(this.score/100);if(m>this.milestone){this.milestone=m;ev.push('milestone')}
  return ev}
}
Runner.MIN_HOP=60;
const api={shuffle,Mine,slideLine,move2048,canMove,spawnTile,Snake,Runner};if(typeof module!=='undefined')module.exports=api;root.PigCore=api;
})(typeof window!=='undefined'?window:globalThis);
