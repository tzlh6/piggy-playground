/* Piggy Playground 4.0 — standalone, deterministic game rules.
 * Gameplay research: Steven Lambert's CC0 basic Tetris/Breakout examples,
 * Ania Kubow's MIT Connect Four, and mashukui/web-games (MIT).
 * New engines below are written for this project; no remote dependencies.
 */
(function(root){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const directions={left:[-1,0],right:[1,0],up:[0,-1],down:[0,1]};
function shuffled(a,rng){for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}

// Falling blocks: seven-bag, previews, hold, ghost, lock delay and wall kicks.
const SHAPES={I:[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],O:[[2,2],[2,2]],T:[[0,3,0],[3,3,3],[0,0,0]],S:[[0,4,4],[4,4,0],[0,0,0]],Z:[[5,5,0],[0,5,5],[0,0,0]],J:[[6,0,0],[6,6,6],[0,0,0]],L:[[0,0,7],[7,7,7],[0,0,0]]};
class Blocks{
 constructor(rng){this.rng=rng||Math.random;this.board=Array.from({length:20},()=>Array(10).fill(0));this.queue=[];this.score=0;this.lines=0;this.combo=-1;this.hold=null;this.held=false;this.over=false;this.fall=0;this.lockTime=0;this.resets=0;this.spawn()}
 fill(){while(this.queue.length<7)this.queue.push(...shuffled(Object.keys(SHAPES),this.rng))}
 spawn(type){this.fill();const t=type||this.queue.shift();this.piece={type:t,m:SHAPES[t].map(r=>r.slice()),x:Math.floor((10-SHAPES[t].length)/2),y:0};this.fall=0;this.lockTime=0;this.resets=0;if(this.collides(this.piece.m,this.piece.x,this.piece.y))this.over=true;this.fill()}
 get speed(){return Math.max(.09,.72*Math.pow(.81,Math.floor(this.lines/10)))}
 collides(m,x,y){for(let r=0;r<m.length;r++)for(let c=0;c<m[r].length;c++)if(m[r][c]&&(x+c<0||x+c>=10||y+r>=20||(y+r>=0&&this.board[y+r][x+c])))return true;return false}
 resetLock(){if(this.resets<12){this.lockTime=0;this.resets++}}
 move(dx){if(this.over)return false;const p=this.piece;if(this.collides(p.m,p.x+dx,p.y))return false;p.x+=dx;this.resetLock();return true}
 rotate(reverse){if(this.over||this.piece.type==='O')return false;const p=this.piece,n=p.m.length,m=Array.from({length:n},(_,r)=>Array.from({length:n},(_,c)=>reverse?p.m[c][n-1-r]:p.m[n-1-c][r]));
  for(const [dx,dy] of [[0,0],[-1,0],[1,0],[-2,0],[2,0],[0,-1],[-1,-1],[1,-1],[0,-2]])if(!this.collides(m,p.x+dx,p.y+dy)){p.m=m;p.x+=dx;p.y+=dy;this.resetLock();return true}return false}
 down(soft){if(this.over)return false;const p=this.piece;if(this.collides(p.m,p.x,p.y+1))return false;p.y++;this.lockTime=0;if(soft)this.score++;return true}
 ghostY(){let y=this.piece.y;while(!this.collides(this.piece.m,this.piece.x,y+1))y++;return y}
 drop(){if(this.over)return null;const y=this.ghostY();this.score+=(y-this.piece.y)*2;this.piece.y=y;return this.lock()}
 swapHold(){if(this.over||this.held)return false;const old=this.piece.type;this.spawn(this.hold);this.hold=old;this.held=true;return true}
 lock(){if(this.over)return null;const p=this.piece;for(let r=0;r<p.m.length;r++)for(let c=0;c<p.m[r].length;c++)if(p.m[r][c]){if(p.y+r<0){this.over=true;return {lines:0}}this.board[p.y+r][p.x+c]=p.m[r][c]}
  const full=this.board.filter(r=>r.every(Boolean)).length,lv=1+Math.floor(this.lines/10);this.board=this.board.filter(r=>!r.every(Boolean));while(this.board.length<20)this.board.unshift(Array(10).fill(0));
  if(full){this.combo++;this.score+=([0,100,300,500,800][full]+Math.max(0,this.combo)*50)*lv;this.lines+=full}else this.combo=-1;
  this.held=false;this.spawn();return {lines:full,over:this.over}}
 update(dt){if(this.over)return null;dt=clamp(dt,0,.1);this.fall+=dt;while(this.fall>=this.speed){this.fall-=this.speed;if(!this.down(false))break}const p=this.piece;if(this.collides(p.m,p.x,p.y+1)){this.lockTime+=dt;if(this.lockTime>=.45)return this.lock()}else this.lockTime=0;return null}
}

// Breakout: small motion substeps prevent tunnelling through bricks.
class Breakout{
 constructor(hard,rng){this.rng=rng||Math.random;this.hard=!!hard;this.W=760;this.H=420;this.score=0;this.lives=3;this.round=1;this.over=false;this.won=false;this.wide=0;this.drops=[];this.paddle={x:380,y:386,w:hard?90:126,h:13};this.makeBricks();this.resetBall()}
 makeBricks(){this.bricks=[];for(let r=0;r<5;r++)for(let c=0;c<9;c++){if(this.round===2&&(r+c)%5===0)continue;if(this.round===3&&r>2&&c%2===0)continue;this.bricks.push({x:29+c*79,y:45+r*30,w:72,h:22,row:r,hp:(this.hard||this.round===3)&&r===0?2:1})}}
 resetBall(){this.waiting=true;this.ball={x:this.paddle.x,y:this.paddle.y-11,r:8,vx:0,vy:0}}
 launch(){if(!this.waiting||this.over)return false;const speed=(this.hard?370:310)+(this.round-1)*35;this.ball.vx=speed*.4;this.ball.vy=-Math.sqrt(speed*speed-this.ball.vx*this.ball.vx);this.waiting=false;return true}
 aim(x){this.paddle.x=clamp(x,this.paddle.w/2+8,this.W-this.paddle.w/2-8)}
 update(dt,axis){if(this.over)return [];dt=clamp(dt,0,.08);const ev=[],p=this.paddle,b=this.ball;this.wide=Math.max(0,this.wide-dt);p.w=this.wide>0?178:(this.hard?90:126);this.aim(p.x+(axis||0)*620*dt);
  this.drops=this.drops.filter(d=>{d.y+=155*dt;if(d.y>p.y-8&&d.y<p.y+22&&Math.abs(d.x-p.x)<p.w/2+10){this.wide=12;ev.push('wide');return false}return d.y<this.H+20});
  if(this.waiting){b.x=p.x;b.y=p.y-11;return ev}
  const steps=Math.max(1,Math.ceil(Math.hypot(b.vx,b.vy)*dt/4)),sdt=dt/steps;
  for(let k=0;k<steps;k++){const oldX=b.x,oldY=b.y;b.x+=b.vx*sdt;b.y+=b.vy*sdt;
   if(b.x-b.r<8){b.x=8+b.r;b.vx=Math.abs(b.vx);ev.push('bounce')}if(b.x+b.r>this.W-8){b.x=this.W-8-b.r;b.vx=-Math.abs(b.vx);ev.push('bounce')}if(b.y-b.r<8){b.y=8+b.r;b.vy=Math.abs(b.vy);ev.push('bounce')}
   if(b.vy>0&&oldY+b.r<=p.y+4&&b.y+b.r>=p.y&&Math.abs(b.x-p.x)<=p.w/2+b.r){const speed=Math.min(650,Math.hypot(b.vx,b.vy)+5),angle=clamp((b.x-p.x)/(p.w/2),-1,1)*1.12;b.vx=Math.sin(angle)*speed;if(Math.abs(b.vx)<35)b.vx=b.vx<0?-35:35;b.vy=-Math.sqrt(speed*speed-b.vx*b.vx);b.y=p.y-b.r-.1;ev.push('bounce')}
   for(const br of this.bricks){if(!br.hp)continue;const nx=clamp(b.x,br.x,br.x+br.w),ny=clamp(b.y,br.y,br.y+br.h);if((b.x-nx)**2+(b.y-ny)**2>=b.r*b.r)continue;
    if(oldY+b.r<=br.y||oldY-b.r>=br.y+br.h){b.vy=-b.vy;b.y=oldY<br.y?br.y-b.r-.1:br.y+br.h+b.r+.1}else if(oldX+b.r<=br.x||oldX-b.r>=br.x+br.w){b.vx=-b.vx;b.x=oldX<br.x?br.x-b.r-.1:br.x+br.w+b.r+.1}else{b.vy=-b.vy;b.y=oldY}
    br.hp--;this.score+=br.hp?5:(5-br.row)*10;ev.push(br.hp?'bounce':'brick');if(!br.hp&&this.rng()<.09)this.drops.push({x:br.x+br.w/2,y:br.y});break}
   if(b.y-b.r>this.H){this.lives--;ev.push('life');if(!this.lives)this.over=true;else this.resetBall();break}
   if(this.bricks.every(br=>!br.hp)){if(this.round===3){this.over=true;this.won=true;ev.push('win')}else{this.round++;this.makeBricks();this.drops=[];this.resetBall();ev.push('round')}break}
  }return ev}
}

class Flappy{
 constructor(easy,rng){this.rng=rng||Math.random;this.W=760;this.H=420;this.ground=390;this.x=170;this.y=190;this.vy=0;this.r=16;this.score=0;this.distance=0;this.pipes=[];this.gap=easy?160:136;this.next=320;this.over=false}
 flap(){if(this.over)return false;this.vy=-320;return true}
 update(dt){if(this.over)return [];dt=clamp(dt,0,.05);const ev=[],speed=Math.min(250,175+this.score*2);this.distance+=speed*dt;this.vy+=980*dt;this.y+=this.vy*dt;this.next-=speed*dt;
  if(this.next<=0){const cy=110+this.rng()*165;this.pipes.push({x:this.W+10,w:62,cy,passed:false});this.next=250}
  for(const p of this.pipes){p.x-=speed*dt;if(!p.passed&&p.x+p.w<this.x-this.r){p.passed=true;this.score++;ev.push('point')}
   const nx=clamp(this.x,p.x,p.x+p.w),dx=this.x-nx;if(dx*dx<this.r*this.r){const reach=Math.sqrt(this.r*this.r-dx*dx);if(this.y-reach<p.cy-this.gap/2||this.y+reach>p.cy+this.gap/2)this.over=true}}
  this.pipes=this.pipes.filter(p=>p.x+p.w>-10);if(this.y-this.r<=0||this.y+this.r>=this.ground)this.over=true;if(this.over)ev.push('crash');return ev}
}

class Stack{
 constructor(){this.W=600;this.H=460;this.layers=[{x:175,w:250}];this.score=0;this.perfect=0;this.streak=0;this.over=false;this.direction=1;this.active={x:0,w:250};this.cuts=[]}
 update(dt){if(this.over)return;dt=clamp(dt,0,.05);this.active.x+=this.direction*Math.min(410,155+this.score*9)*dt;if(this.active.x<0){this.active.x=0;this.direction=1}else if(this.active.x+this.active.w>this.W){this.active.x=this.W-this.active.w;this.direction=-1}this.cuts.forEach(c=>{c.y+=c.vy*dt;c.vy+=850*dt;c.angle+=dt*1.6});this.cuts=this.cuts.filter(c=>c.y<800)}
 drop(){if(this.over)return {type:'over'};const top=this.layers[this.layers.length-1],a=this.active,delta=a.x-top.x;
  if(Math.abs(delta)<=5){a.x=top.x;a.w=top.w;this.perfect++;this.streak++}else this.streak=0;
  const left=Math.max(top.x,a.x),right=Math.min(top.x+top.w,a.x+a.w),w=right-left;if(w<=2){this.over=true;return {type:'miss'}}
  if(a.x<left)this.cuts.push({x:a.x,w:left-a.x,y:0,vy:0,angle:0});if(a.x+a.w>right)this.cuts.push({x:right,w:a.x+a.w-right,y:0,vy:0,angle:0});
  this.layers.push({x:left,w});this.score++;this.direction=this.score%2?-1:1;this.active={x:this.direction>0?0:this.W-w,w};return {type:this.streak?'perfect':'cut',width:w}}
}

// Four in a row, with immediate tactics and a small minimax opponent.
class Connect{
 constructor(){this.board=Array(42).fill(0);this.turn=1;this.moves=0;this.over=false;this.winner=0;this.line=[]}
 row(c){if(c<0||c>6)return -1;for(let r=5;r>=0;r--)if(!this.board[r*7+c])return r;return -1}
 drop(c){if(this.over)return false;const r=this.row(c);if(r<0)return false;const p=this.turn;this.board[r*7+c]=p;this.moves++;this.line=connectLine(this.board,p);if(this.line.length){this.over=true;this.winner=p}else if(this.moves===42)this.over=true;else this.turn=3-p;return {r,c,p,winner:this.winner}}
}
function connectLine(b,p){for(let r=0;r<6;r++)for(let c=0;c<7;c++)if(b[r*7+c]===p)for(const [dx,dy] of [[1,0],[0,1],[1,1],[-1,1]]){const ids=[];for(let k=0;k<4;k++){const x=c+k*dx,y=r+k*dy;if(x<0||x>6||y>5||b[y*7+x]!==p)break;ids.push(y*7+x)}if(ids.length===4)return ids}return []}
function chooseConnect(b,player,depth,rng){rng=rng||Math.random;const order=[3,2,4,1,5,0,6],row=c=>{for(let r=5;r>=0;r--)if(!b[r*7+c])return r;return -1};
 const evaluate=()=>{let total=0;for(let r=0;r<6;r++){if(b[r*7+3]===player)total+=6;else if(b[r*7+3])total-=6}
  for(let r=0;r<6;r++)for(let c=0;c<7;c++)for(const [dx,dy] of [[1,0],[0,1],[1,1],[-1,1]]){if(c+3*dx<0||c+3*dx>6||r+3*dy>5)continue;let own=0,other=0;for(let k=0;k<4;k++){const v=b[(r+k*dy)*7+c+k*dx];if(v===player)own++;else if(v)other++}if(!other)total+=[0,1,9,70,100000][own];if(!own)total-=[0,1,12,95,100000][other]}return total};
 const search=(left,turn,alpha,beta)=>{if(connectLine(b,player).length)return 100000+left;if(connectLine(b,3-player).length)return -100000-left;if(!left)return evaluate();let best=turn===player?-Infinity:Infinity,any=false;
  for(const c of order){const r=row(c);if(r<0)continue;any=true;b[r*7+c]=turn;const score=search(left-1,3-turn,alpha,beta);b[r*7+c]=0;if(turn===player){best=Math.max(best,score);alpha=Math.max(alpha,best)}else{best=Math.min(best,score);beta=Math.min(beta,best)}if(alpha>=beta)break}return any?best:0};
 for(const p of [player,3-player])for(const c of order){const r=row(c);if(r<0)continue;b[r*7+c]=p;const win=connectLine(b,p).length;b[r*7+c]=0;if(win)return c}
 if(depth<=1&&rng()<.4){const valid=order.filter(c=>row(c)>=0);return valid.length?valid[Math.floor(rng()*valid.length)]:-1}
 let best=-Infinity,choice=-1;for(const c of order){const r=row(c);if(r<0)continue;b[r*7+c]=player;const v=search(Math.max(0,depth-1),3-player,-Infinity,Infinity);b[r*7+c]=0;if(v>best){best=v;choice=c}}return choice}

// Lights Out is generated by legal toggles from the solved board.
function lightNeighbours(n,i){const x=i%n,y=Math.floor(i/n),a=[i];if(x)a.push(i-1);if(x<n-1)a.push(i+1);if(y)a.push(i-n);if(y<n-1)a.push(i+n);return a}
function solveLights(n,board){const count=n*n,rows=board.map((v,i)=>{let bits=0;for(const j of lightNeighbours(n,i))bits|=1<<j;return {bits,rhs:v?1:0}}),pivots=[];let r=0;
 for(let c=0;c<count;c++){let pivot=r;while(pivot<count&&!(rows[pivot].bits&(1<<c)))pivot++;if(pivot===count)continue;[rows[r],rows[pivot]]=[rows[pivot],rows[r]];for(let j=0;j<count;j++)if(j!==r&&(rows[j].bits&(1<<c))){rows[j].bits^=rows[r].bits;rows[j].rhs^=rows[r].rhs}pivots.push(c);r++}
 for(let j=r;j<count;j++)if(!rows[j].bits&&rows[j].rhs)return null;const free=Array.from({length:count},(_,i)=>i).filter(c=>!pivots.includes(c));let best=null;
 for(let k=0;k<(1<<free.length);k++){let mask=0;free.forEach((c,j)=>{if(k&(1<<j))mask|=1<<c});for(let j=r-1;j>=0;j--){let parity=0,t=rows[j].bits&mask;while(t){parity^=1;t&=t-1}if(parity!==rows[j].rhs)mask|=1<<pivots[j]}const solution=[];for(let j=0;j<count;j++)if(mask&(1<<j))solution.push(j);if(best===null||solution.length<best.length)best=solution}return best}
class Lights{
 constructor(n,rng){this.n=n;this.rng=rng||Math.random;this.moves=0;this.history=[];let attempts=0;do{this.board=Array(n*n).fill(0);for(let k=0;k<n*n;k++)if(this.rng()<.5)for(const j of lightNeighbours(n,k))this.board[j]^=1;attempts++}while((!this.board.some(Boolean)||solveLights(n,this.board).length<n)&&attempts<80);if(!this.board.some(Boolean))for(const j of lightNeighbours(n,0))this.board[j]^=1}
 get won(){return !this.board.some(Boolean)}
 press(i){if(i<0||i>=this.board.length||this.won)return false;this.history.push(i);for(const j of lightNeighbours(this.n,i))this.board[j]^=1;this.moves++;return true}
 undo(){if(!this.history.length)return false;const i=this.history.pop();for(const j of lightNeighbours(this.n,i))this.board[j]^=1;this.moves--;return true}
 hint(){const a=solveLights(this.n,this.board);return a&&a.length?a[0]:-1}
}

// Original compact warehouse puzzles; every level is solver-checked.
const SOKO_LEVELS=[
 ['第一颗松露','#######','#     #','# @$ .#','#     #','#######'],
 ['转个弯','######','#  . #','#  $ #','# @  #','######'],
 ['两箱到家','########','#      #','# .  . #','# $  $ #','#   @  #','########'],
 ['绕到背后','#######','#     #','# .$  #','#  #@ #','#     #','#######'],
 ['小小走廊','########','#   #  #','# . $  #','#   #  #','# @    #','########'],
 ['错位仓库','########','#      #','# ..   #','# $$   #','#    @ #','########'],
 ['三份礼物','########','#      #','# . . .#','# $ $ $#','#  @   #','########'],
 ['拐角花园','########','# .    #','# $$ . #','#  #   #','# @    #','########'],
 ['双向通道','########','# .  . #','#   #  #','# $$   #','#   @  #','########'],
 ['交叉搬运','########','#      #','# .$.  #','#  $   #','#  # @ #','#      #','########'],
 ['三箱调度','########','#  ... #','# $ $  #','#   $  #','# @    #','########'],
 ['最后的仓库','########','# .  . #','#  $$  #','# #  # #','#  $ . #','# @    #','########']
];
class Sokoban{
 constructor(index){this.index=clamp(index||0,0,SOKO_LEVELS.length-1);const [name,...rows]=SOKO_LEVELS[this.index];this.name=name;this.w=Math.max(...rows.map(r=>r.length));this.h=rows.length;this.walls=new Set();this.goals=new Set();this.boxes=new Set();this.player=-1;this.moves=0;this.pushes=0;this.history=[];
  rows.forEach((r,y)=>{for(let x=0;x<this.w;x++){const v=r[x]||'#',i=y*this.w+x;if(v==='#')this.walls.add(i);if('.+*'.includes(v))this.goals.add(i);if('$*'.includes(v))this.boxes.add(i);if('@+'.includes(v))this.player=i}})}
 get won(){return [...this.boxes].every(i=>this.goals.has(i))}
 neighbour(i,dir){const d=directions[dir];if(!d)return -1;const x=i%this.w+d[0],y=Math.floor(i/this.w)+d[1];return x<0||x>=this.w||y<0||y>=this.h?-1:y*this.w+x}
 move(dir){if(this.won)return false;const next=this.neighbour(this.player,dir);if(next<0||this.walls.has(next))return false;const pushing=this.boxes.has(next),beyond=this.neighbour(next,dir);if(pushing&&(beyond<0||this.walls.has(beyond)||this.boxes.has(beyond)))return false;
  this.history.push({player:this.player,boxes:[...this.boxes],moves:this.moves,pushes:this.pushes});this.player=next;this.moves++;if(pushing){this.boxes.delete(next);this.boxes.add(beyond);this.pushes++}return {pushing}}
 undo(){const h=this.history.pop();if(!h)return false;this.player=h.player;this.boxes=new Set(h.boxes);this.moves=h.moves;this.pushes=h.pushes;return true}
}
function solveSokoban(game,maxStates){const key=(p,b)=>p+'|'+b.slice().sort((a,c)=>a-c).join(','),initial={p:game.player,b:[...game.boxes],prev:-1,dir:''},queue=[initial],seen=new Set([key(initial.p,initial.b)]);maxStates=maxStates||90000;
 for(let k=0;k<queue.length&&queue.length<=maxStates;k++){const s=queue[k];if(s.b.every(i=>game.goals.has(i))){const solution=[];let j=k;while(queue[j].prev>=0){solution.push(queue[j].dir);j=queue[j].prev}return solution.reverse()}
  for(const dir of Object.keys(directions)){const p=game.neighbour(s.p,dir);if(p<0||game.walls.has(p))continue;const b=s.b.slice(),bi=b.indexOf(p);if(bi>=0){const dest=game.neighbour(p,dir);if(dest<0||game.walls.has(dest)||b.includes(dest))continue;b[bi]=dest;
    if(!game.goals.has(dest)){const blocked=d=>{const n=game.neighbour(dest,d);return n<0||game.walls.has(n)};if((blocked('up')||blocked('down'))&&(blocked('left')||blocked('right')))continue}}
   const id=key(p,b);if(seen.has(id))continue;seen.add(id);queue.push({p,b,prev:k,dir})}}
 return null}

const Match3=(root.PigMatchCore||(typeof require==='function'?require('./match-core.js'):null)).Match3;
const api={Blocks,SHAPES,Breakout,Flappy,Stack,Connect,connectLine,chooseConnect,Lights,lightNeighbours,solveLights,Sokoban,SOKO_LEVELS,solveSokoban,Match3};
if(typeof module!=='undefined')module.exports=api;root.PigArcadeCore=api;
})(typeof window!=='undefined'?window:globalThis);
