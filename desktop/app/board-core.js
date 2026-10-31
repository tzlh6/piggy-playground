/* Headless board games. No DOM, assets, network or storage side effects.
 * Chess and Xiangqi rules use the pinned BSD-2-Clause libraries in vendor/.
 * Grid games and bounded computer opponents are original implementations.
 */
(function(root){
'use strict';
const common=typeof module!=='undefined'&&module.exports;
const {Chess:ChessRules}=common?require('./vendor/chess.js'):root.PigChessVendor;
const {Xiangqi:XiangqiRules}=common?require('./vendor/xiangqi.js'):root.PigXiangqiVendor;
const copy=v=>JSON.parse(JSON.stringify(v));
const integer=(v,a,b)=>Number.isInteger(v)&&v>=a&&v<=b;
const inside=(x,y,w,h)=>integer(x,0,w-1)&&integer(y,0,h-1);
const DIRS=[[1,0],[0,1],[1,1],[1,-1]];
const ALLDIRS=[...DIRS,...DIRS.map(([x,y])=>[-x,-y])];
const outcome=(winner,reason)=>({over:true,winner,reason});
const ongoing=()=>({over:false,winner:null,reason:null});

class GridGame{
 constructor(type){this.type=type;this.turn=1;this.status=ongoing();this.past=[];this.lastMove=null}
 remember(){const s={};for(const key of Object.keys(this))if(key!=='past')s[key]=copy(this[key]);this.past.push(s)}
 undo(){if(!this.past.length)return false;const s=this.past.pop();Object.assign(this,s);return true}
 state(){const s={};for(const key of Object.keys(this))if(key!=='past')s[key]=copy(this[key]);return s}
}

class Gomoku extends GridGame{
 constructor(options){super('gomoku');options=options||{};this.size=options.size===undefined?15:options.size;if(!integer(this.size,9,19))throw Error('五子棋棋盘应为 9–19 路');this.rule=options.rule||'freestyle';if(!['freestyle','exact-five'].includes(this.rule))throw Error('未知五子棋规则');this.board=Array(this.size*this.size).fill(0);this.moves=0;this.line=[]}
 run(x,y,dx,dy,p){const cells=[];while(inside(x,y,this.size,this.size)&&this.board[y*this.size+x]===p){cells.push({x,y});x+=dx;y+=dy}return {cells,open:inside(x,y,this.size,this.size)&&!this.board[y*this.size+x]}}
 potential(m,p){if(!m||!inside(m.x,m.y,this.size,this.size)||this.board[m.y*this.size+m.x])return -1;let score=0,fours=0,threes=0;
  for(const [dx,dy] of DIRS){const line=new Int8Array(11);for(let k=-5;k<=5;k++){const x=m.x+k*dx,y=m.y+k*dy;line[k+5]=k===0?1:x<0||y<0||x>=this.size||y>=this.size?2:this.board[y*this.size+x]===p?1:this.board[y*this.size+x]?2:0}
   let left=4,right=6;while(left>=0&&line[left]===1)left--;while(right<11&&line[right]===1)right++;const n=right-left-1,open=Number(left>=0&&line[left]===0)+Number(right<11&&line[right]===0);if((this.rule==='freestyle'&&n>=5)||(this.rule==='exact-five'&&n===5))return 1000000;
   let wins=0,three=false;for(let start=1;start<=5;start++){let count=0,hole=-1,blocked=false;for(let k=start;k<start+5;k++){if(line[k]===2){blocked=true;break}if(line[k]===1)count++;else hole=k}if(!blocked&&count===4&&(this.rule!=='exact-five'||line[start-1]!==1&&line[start+5]!==1))wins|=1<<hole}
   for(let start=0;start<=5;start++)if(line[start]===0&&line[start+5]===0){let count=0,blocked=false;for(let k=start+1;k<start+5;k++){if(line[k]===2){blocked=true;break}if(line[k]===1)count++}if(!blocked&&count===3)three=true}
   if(wins){fours++;score+=(wins&(wins-1))?180000:25000}else if(three){threes++;score+=4500}else score+=open?Math.pow(6,Math.min(n,3))*(open===2?3:1):0;
  }if(fours>=2||fours&&threes)score+=220000;if(threes>=2)score+=35000;return score}
 legalMoves(){if(this.status.over)return [];const a=[];for(let y=0;y<this.size;y++)for(let x=0;x<this.size;x++)if(!this.board[y*this.size+x])a.push({x,y});return a}
 analysis(){if(!this.moves)return {moves:[{x:Math.floor(this.size/2),y:Math.floor(this.size/2)}],best:[0,0],forced:false};const cells=new Set();for(let i=0;i<this.board.length;i++)if(this.board[i]){const x=i%this.size,y=Math.floor(i/this.size);for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const nx=x+dx,ny=y+dy;if(nx>=0&&ny>=0&&nx<this.size&&ny<this.size&&!this.board[ny*this.size+nx])cells.add(ny*this.size+nx)}}const best=[0,0],a=[];for(const i of cells){const m={x:i%this.size,y:Math.floor(i/this.size)},own=this.potential(m,this.turn),opp=this.potential(m,3-this.turn);best[this.turn-1]=Math.max(best[this.turn-1],own);best[2-this.turn]=Math.max(best[2-this.turn],opp);a.push({m,own,opp})}const wins=a.filter(v=>v.own>=1000000),blocks=a.filter(v=>v.opp>=1000000);return {moves:(wins.length?wins:blocks.length?blocks:a.sort((a,b)=>(b.own*1.12+b.opp)-(a.own*1.12+a.opp)).slice(0,14)).map(v=>v.m),best,forced:!!(wins.length||blocks.length)}}
 aiMoves(){return this.analysis().moves}
 priority(m){const own=this.potential(m,this.turn),opp=this.potential(m,3-this.turn);return own>=1000000?3000000:opp>=1000000?2000000:own*1.05+opp}
 play(m){if(this.status.over||!m||!inside(m.x,m.y,this.size,this.size)||this.board[m.y*this.size+m.x])return null;this.remember();const p=this.turn;this.board[m.y*this.size+m.x]=p;this.moves++;this.lastMove={x:m.x,y:m.y,player:p};
  for(const [dx,dy] of DIRS){const a=this.run(m.x+dx,m.y+dy,dx,dy,p).cells,b=this.run(m.x-dx,m.y-dy,-dx,-dy,p).cells,line=[...b.reverse(),{x:m.x,y:m.y},...a];if((this.rule==='freestyle'&&line.length>=5)||(this.rule==='exact-five'&&line.length===5)){this.line=line;this.status=outcome(p,'five');break}}
  if(!this.status.over&&this.moves===this.board.length)this.status=outcome(0,'board-full');this.turn=3-p;return copy({type:'place',...this.lastMove,line:this.line,status:this.status})}
 evaluate(player){const {best}=this.analysis();return best[player-1]*(this.turn===player?1.1:1)-best[2-player]*(this.turn!==player?1.1:1)}
}

class Reversi extends GridGame{
 constructor(){super('reversi');this.size=8;this.board=Array(64).fill(0);this.board[27]=this.board[36]=2;this.board[28]=this.board[35]=1;this.scores=[2,2];this.moves=0}
 flips(m,p){if(!m||!inside(m.x,m.y,8,8)||this.board[m.y*8+m.x])return [];const out=[];for(const [dx,dy] of ALLDIRS){let x=m.x+dx,y=m.y+dy;const ray=[];while(inside(x,y,8,8)&&this.board[y*8+x]===3-p){ray.push(y*8+x);x+=dx;y+=dy}if(ray.length&&inside(x,y,8,8)&&this.board[y*8+x]===p)out.push(...ray)}return out}
 legalMoves(player){if(this.status.over)return [];const p=player||this.turn,out=[];for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(this.flips({x,y},p).length)out.push({x,y});return out}
 play(m){if(this.status.over)return null;const f=this.flips(m,this.turn);if(!f.length)return null;this.remember();const p=this.turn;this.board[m.y*8+m.x]=p;f.forEach(i=>this.board[i]=p);this.moves++;this.scores=[this.board.filter(v=>v===1).length,this.board.filter(v=>v===2).length];this.turn=3-p;let passedPlayer=null;
  if(!this.legalMoves().length){this.turn=p;if(this.legalMoves().length)passedPlayer=3-p;else this.status=outcome(this.scores[0]===this.scores[1]?0:this.scores[0]>this.scores[1]?1:2,'no-moves')}
  this.lastMove={x:m.x,y:m.y,player:p};return copy({type:'place',...this.lastMove,flipped:f.map(i=>({x:i%8,y:Math.floor(i/8)})),passedPlayer,status:this.status})}
 priority(m){const corner=(m.x===0||m.x===7)&&(m.y===0||m.y===7),edge=m.x===0||m.x===7||m.y===0||m.y===7;let risk=0;for(const [x,y] of [[0,0],[7,0],[0,7],[7,7]])if(!this.board[y*8+x]&&Math.abs(x-m.x)<=1&&Math.abs(y-m.y)<=1)risk=100;return (corner?1000:edge?20:0)-risk+this.flips(m,this.turn).length}
 evaluate(player){const b=this.board,empty=b.filter(v=>!v).length;let score=0,discs=0,frontier=0;const weights=[100,-25,12,6,6,12,-25,100,-25,-45,-4,-3,-3,-4,-45,-25,12,-4,4,2,2,4,-4,12,6,-3,2,1,1,2,-3,6,6,-3,2,1,1,2,-3,6,12,-4,4,2,2,4,-4,12,-25,-45,-4,-3,-3,-4,-45,-25,100,-25,12,6,6,12,-25,100];
  for(let i=0;i<64;i++)if(b[i]){const sign=b[i]===player?1:-1,x=i%8,y=i>>3;score+=sign*weights[i];discs+=sign;if(ALLDIRS.some(([dx,dy])=>inside(x+dx,y+dy,8,8)&&!b[(y+dy)*8+x+dx]))frontier+=sign}
  for(const [x,y] of [[0,0],[7,0],[0,7],[7,7]]){const p=b[y*8+x];if(!p)continue;const sign=p===player?1:-1;score+=sign*160;for(const [dx,dy] of [[x===0?1:-1,0],[0,y===0?1:-1]]){let nx=x+dx,ny=y+dy;while(inside(nx,ny,8,8)&&b[ny*8+nx]===p){score+=sign*20;nx+=dx;ny+=dy}}}
  return score+(empty>12?14:5)*(this.legalMoves(player).length-this.legalMoves(3-player).length)-(empty>12?9:2)*frontier+discs*(empty<12?24:empty<24?3:-1)}
}

class DotsBoxes extends GridGame{
 constructor(options){super('dots');options=options||{};this.width=options.width===undefined?4:options.width;this.height=options.height===undefined?4:options.height;if(!integer(this.width,1,8)||!integer(this.height,1,8))throw Error('点格棋宽高应为 1–8');this.h=Array(this.width*(this.height+1)).fill(0);this.v=Array((this.width+1)*this.height).fill(0);this.boxes=Array(this.width*this.height).fill(0);this.scores=[0,0];this.moves=0}
 edge(m){if(!m)return null;if(m.orientation==='h'&&inside(m.x,m.y,this.width,this.height+1))return [this.h,m.y*this.width+m.x];if(m.orientation==='v'&&inside(m.x,m.y,this.width+1,this.height))return [this.v,m.y*(this.width+1)+m.x];return null}
 legalMoves(){if(this.status.over)return [];const out=[];for(const orientation of ['h','v']){const w=this.width+(orientation==='v'?1:0),h=this.height+(orientation==='h'?1:0);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const m={orientation,x,y};const [a,i]=this.edge(m);if(!a[i])out.push(m)}}return out}
 adjacent(m){const a=m.orientation==='h'?[[m.x,m.y-1],[m.x,m.y]]:[[m.x-1,m.y],[m.x,m.y]];return a.filter(([x,y])=>inside(x,y,this.width,this.height))}
 sides(x,y){return Number(!!this.h[y*this.width+x])+Number(!!this.h[(y+1)*this.width+x])+Number(!!this.v[y*(this.width+1)+x])+Number(!!this.v[y*(this.width+1)+x+1])}
 priority(m){let s=0;for(const [x,y] of this.adjacent(m)){const n=this.sides(x,y);s+=n===3?100:n===2?-35:2}return s}
 aiMoves(){const all=this.legalMoves(),capture=m=>this.adjacent(m).some(([x,y])=>this.sides(x,y)===3),safe=m=>this.adjacent(m).every(([x,y])=>this.sides(x,y)<2),takes=all.filter(capture),quiet=all.filter(safe);if(quiet.length)return takes.length?takes:quiet.sort((a,b)=>this.priority(b)-this.priority(a)).slice(0,18);return all.sort((a,b)=>this.priority(b)-this.priority(a))}
 play(m){const e=this.edge(m);if(this.status.over||!e||e[0][e[1]])return null;this.remember();const p=this.turn;e[0][e[1]]=p;this.moves++;const captured=[];for(const [x,y] of this.adjacent(m))if(this.sides(x,y)===4&&!this.boxes[y*this.width+x]){this.boxes[y*this.width+x]=p;this.scores[p-1]++;captured.push({x,y})}if(!captured.length)this.turn=3-p;if(this.scores[0]+this.scores[1]===this.boxes.length)this.status=outcome(this.scores[0]===this.scores[1]?0:this.scores[0]>this.scores[1]?1:2,'all-boxes');this.lastMove={orientation:m.orientation,x:m.x,y:m.y,player:p};return copy({type:'edge',...this.lastMove,captured,extraTurn:captured.length>0,status:this.status})}
 evaluate(player){let safe=0,threes=0;const all=this.legalMoves();for(const m of all)if(this.adjacent(m).every(([x,y])=>this.sides(x,y)<2))safe++;for(let y=0;y<this.height;y++)for(let x=0;x<this.width;x++)if(!this.boxes[y*this.width+x]&&this.sides(x,y)===3)threes++;
  const sign=this.turn===player?1:-1;return (this.scores[player-1]-this.scores[2-player])*100+sign*(threes*45+(safe?Math.min(safe,8):0))}
}

// The public coordinate system is zero based, x rightwards, y downwards.
function square(value,height,width){if(typeof value==='string'&&new RegExp('^[a-'+String.fromCharCode(96+width)+'][0-'+(height-1)+']$').test(value))return value;if(value&&inside(value.x,value.y,width,height))return String.fromCharCode(97+value.x)+(height-1-value.y);return null}
function chessSquare(value){if(typeof value==='string'&&/^[a-h][1-8]$/.test(value))return value;if(value&&inside(value.x,value.y,8,8))return String.fromCharCode(97+value.x)+(8-value.y);return null}
const VALUES={p:100,n:320,b:330,r:500,q:900,k:0,c:450,a:180};
class Chess{
 constructor(options){this.type='chess';this.rules=new ChessRules(options&&options.fen);this.past=[];this.refresh()}
 refresh(){const r=this.rules;this.turn=r.turn()==='w'?1:2;this.status=r.isCheckmate()?outcome(3-this.turn,'checkmate'):r.isStalemate()?outcome(0,'stalemate'):r.isThreefoldRepetition()?outcome(0,'threefold'):r.isInsufficientMaterial()?outcome(0,'insufficient-material'):r.isDrawByFiftyMoves()?outcome(0,'fifty-move'):ongoing();this.status.check=r.isCheck()}
 legalMoves(){return this.status.over?[]:this.rules.moves({verbose:true}).map(m=>({from:m.from,to:m.to,...(m.promotion?{promotion:m.promotion}:{})}))}
 play(m){if(this.status.over||!m)return null;const from=chessSquare(m.from),to=chessSquare(m.to);if(!from||!to)return null;let event;try{event=this.rules.move({from,to,...(m.promotion?{promotion:m.promotion}:{})})}catch(e){return null}if(!event)return null;this.past.push(copy(this.status));this.refresh();return {type:'move',player:3-this.turn,from,to,piece:event.piece,captured:event.captured||null,promotion:event.promotion||null,san:event.san,flags:event.flags,status:copy(this.status)}}
 undo(){if(!this.past.length)return false;this.rules.undo();this.past.pop();this.refresh();return true}
 state(){return {type:this.type,turn:this.turn,status:copy(this.status),fen:this.rules.fen(),width:8,height:8,board:this.rules.board().map(row=>row.map(p=>p?{type:p.type,player:p.color==='w'?1:2}:null)),history:this.rules.history()}}
 priority(m){const target=this.rules.get(m.to),p=this.rules.get(m.from),x=m.to.charCodeAt(0)-97,y=Number(m.to[1])-1;return (target?16*(VALUES[target.type]||0)-(VALUES[p&&p.type]||0):0)+(m.promotion?VALUES[m.promotion]*12:0)+8*(3.5-Math.abs(3.5-x))+4*(3.5-Math.abs(3.5-y))}
 evaluate(player){let value=0;const board=this.rules.board(),files={w:Array(8).fill(0),b:Array(8).fill(0)},bishops={w:0,b:0};let material=0;for(const row of board)for(const p of row)if(p){if(p.type==='p')files[p.color][p.square.charCodeAt(0)-97]++;if(p.type==='b')bishops[p.color]++;if(!['k','p'].includes(p.type))material+=VALUES[p.type]}
  for(let y=0;y<8;y++)for(let x=0;x<8;x++){const p=board[y][x];if(!p)continue;const sign=p.color===(player===1?'w':'b')?1:-1,advance=p.color==='w'?6-y:y-1,center=7-Math.abs(3.5-x)-Math.abs(3.5-y);let s=VALUES[p.type];
   if(p.type==='n')s+=center*11-(advance<1?12:0);if(p.type==='b')s+=center*5+(advance>0?8:0);if(p.type==='q')s+=center*2-(material>4000&&advance>1?14:0);
   if(p.type==='p'){s+=advance*(material<2200?14:7)+center*3;if(files[p.color][x]>1)s-=14;if(!(files[p.color][x-1]||files[p.color][x+1]))s-=12;let passed=true;for(let yy=y+(p.color==='w'?-1:1);yy>=0&&yy<8;yy+=p.color==='w'?-1:1)for(let xx=Math.max(0,x-1);xx<=Math.min(7,x+1);xx++)if(board[yy][xx]&&board[yy][xx].type==='p'&&board[yy][xx].color!==p.color)passed=false;if(passed)s+=12+advance*advance*4}
   if(p.type==='r'){if(!files[p.color][x])s+=files[p.color==='w'?'b':'w'][x]?12:24;if(advance===5)s+=20}
   if(p.type==='k'){if(material<2300)s+=center*12;else{s-=center*9;if((x<=2||x>=6)&&(y===0||y===7))s+=30;for(let xx=Math.max(0,x-1);xx<=Math.min(7,x+1);xx++){const yy=y+(p.color==='w'?-1:1),shield=board[yy]&&board[yy][xx];if(shield&&shield.type==='p'&&shield.color===p.color)s+=12}}}value+=sign*s}
  return value+((bishops[player===1?'w':'b']>=2?28:0)-(bishops[player===1?'b':'w']>=2?28:0))}
}

class Xiangqi{
 constructor(options){this.type='xiangqi';this.rules=new XiangqiRules();if(options&&options.fen&&!this.rules.load(options.fen))throw Error('中国象棋 FEN 无效');this.trail=[{key:this.key(),player:0,check:false}];this.past=[];this.refresh()}
 key(){return this.rules.fen().split(' ').slice(0,2).join(' ')}
 refresh(){const r=this.rules;this.turn=r.turn()==='r'?1:2;const board=r.board().flat(),red=board.some(p=>p&&p.type==='k'&&p.color==='r'),black=board.some(p=>p&&p.type==='k'&&p.color==='b');this.status=!red||!black?outcome(red?1:2,'king-captured'):!r.moves().length?outcome(3-this.turn,r.in_check()?'checkmate':'stalemate-loss'):ongoing();this.status.check=r.in_check();if(this.status.over)return;
  const occurrences=[];for(let i=0;i<this.trail.length;i++)if(this.trail[i].key===this.key())occurrences.push(i);
  if(occurrences.length>=3){const cycle=this.trail.slice(occurrences[occurrences.length-3]+1),checking=[1,2].filter(p=>{const turns=cycle.filter(t=>t.player===p);return turns.length>0&&turns.every(t=>t.check)});this.status=checking.length===1?outcome(3-checking[0],'perpetual-check-loss'):outcome(0,'threefold-casual')}
  else if(Number(r.fen().split(' ')[4])>=120)this.status=outcome(0,'sixty-move');this.status.check=r.in_check()}
 legalMoves(){return this.status.over?[]:this.rules.moves({verbose:true}).map(m=>({from:m.from,to:m.to}))}
 play(m){if(this.status.over||!m)return null;const from=square(m.from,10,9),to=square(m.to,10,9);if(!from||!to)return null;const p=this.turn,event=this.rules.move({from,to});if(!event)return null;this.past.push(copy(this.status));this.trail.push({key:this.key(),player:p,check:this.rules.in_check()});this.refresh();return {type:'move',player:p,from,to,piece:event.piece,captured:event.captured||null,iccs:event.iccs,status:copy(this.status)}}
 undo(){if(!this.past.length)return false;this.rules.undo();this.trail.pop();this.status=this.past.pop();this.turn=this.rules.turn()==='r'?1:2;return true}
 state(){return {type:this.type,turn:this.turn,status:copy(this.status),fen:this.rules.fen(),width:9,height:10,board:this.rules.board().map(row=>row.map(p=>p?{type:p.type,player:p.color==='r'?1:2}:null)),history:this.rules.history(),repetitionRule:'casual-with-perpetual-check-loss'}}
 priority(m){const p=this.rules.get(m.to),own=this.rules.get(m.from);return p?(p.type==='k'?100000:16*(XQ_VALUES[p.type]||0)-(XQ_VALUES[own&&own.type]||0)):4*(4-Math.abs(4-(m.to.charCodeAt(0)-97)))}
 evaluate(player){let value=0;const board=this.rules.board();for(let y=0;y<10;y++)for(let x=0;x<9;x++){const p=board[y][x];if(p){const progress=p.color==='r'?9-y:y,center=4-Math.abs(4-x);let s=XQ_VALUES[p.type]||0;
   if(p.type==='p')s+=progress*8+(progress>=5?65+center*10:0);if(p.type==='n'){s+=center*12;let legs=0;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])if(inside(x+dx,y+dy,9,10)&&!board[y+dy][x+dx])legs++;s+=legs*7}
   if(p.type==='r'||p.type==='c'){s+=center*4;for(const [dx,dy] of DIRS.slice(0,2))for(const sign of [-1,1]){let xx=x+dx*sign,yy=y+dy*sign;while(inside(xx,yy,9,10)&&!board[yy][xx]){s+=p.type==='r'?3:1;xx+=dx*sign;yy+=dy*sign}}}value+=(p.color===(player===1?'r':'b')?1:-1)*s}}return value}
}
const XQ_VALUES={p:100,n:400,b:190,r:900,c:450,a:190,k:0};

const factories={chess:o=>new Chess(o),xiangqi:o=>new Xiangqi(o),gomoku:o=>new Gomoku(o),reversi:()=>new Reversi(),dots:o=>new DotsBoxes(o)};
function create(type,options){if(!Object.prototype.hasOwnProperty.call(factories,type))throw Error('未知棋类游戏');return factories[type](options)}

// Iterative deepening with a node/time budget. The original position is restored
// with finally, including when a search is interrupted. Extra turns are handled
// by the actual turn field rather than assuming players alternate every ply.
function chooseMove(game,options){options=options||{};if(game.status.over)return {move:null,nodes:0,depth:0,score:0};const level=options.level||'normal',tier=['easy','normal','hard'].indexOf(level);if(tier<0)throw Error('未知电脑难度');
 const configs={chess:[[3,5000],[5,45000],[8,220000]],xiangqi:[[3,6000],[5,50000],[7,240000]],gomoku:[[3,1800],[5,12000],[8,65000]],reversi:[[4,5000],[7,50000],[10,250000]],dots:[[3,5000],[6,60000],[10,260000]]},config=configs[game.type][tier],remaining=game.type==='dots'?game.legalMoves().length:game.type==='reversi'?game.board.filter(v=>!v).length:100;
 const maxDepth=integer(options.depth,1,30)?options.depth:tier===2&&remaining<=(game.type==='dots'?18:12)?remaining+1:config[0],budget=integer(options.maxNodes,1,1000000)?options.maxNodes:config[1],maxMs=Number.isFinite(options.maxMs)?Math.max(1,Math.min(5000,options.maxMs)):[450,1200,2800][tier],deadline=Date.now()+maxMs,player=game.turn,halt={},tt=new Map(),killers=new Map(),fastChess=game.type==='chess';let nodes=0;
 const gomokuCache=new Map(),gomoku=()=>{const k=game.turn+':'+game.board.join('');let data=gomokuCache.get(k);if(!data){data=game.analysis();if(gomokuCache.size<12000)gomokuCache.set(k,data)}return data},evaluate=()=>{if(game.type!=='gomoku')return game.evaluate(player);const {best}=gomoku();return best[player-1]*(game.turn===player?1.1:1)-best[2-player]*(game.turn!==player?1.1:1)};
 const moveKey=m=>m.from?m.from+m.to+(m.promotion||''):m.orientation?m.orientation+m.x+','+m.y:m.x+','+m.y;
 const key=()=>game.type==='chess'?game.rules.fen():game.type==='xiangqi'?game.rules.fen():game.type==='dots'?game.turn+':'+game.h.map(Boolean).map(Number).join('')+game.v.map(Boolean).map(Number).join('')+':'+game.scores.join(','):game.turn+':'+game.board.join('');
 const squareOf=i=>'abcdefgh'[i&15]+(8-(i>>4));
 function candidates(preferred,ply){let list;if(fastChess)list=game.rules._moves().map(raw=>({from:squareOf(raw.from),to:squareOf(raw.to),...(raw.promotion?{promotion:raw.promotion}:{}),raw}));else list=game.type==='gomoku'?gomoku().moves:game.aiMoves?game.aiMoves():game.legalMoves();const killer=killers.get(ply);return list.map((m,i)=>({m,s:moveKey(m)===preferred?1e10:moveKey(m)===killer?1e8:game.aiMoves?-i:game.priority?game.priority(m):0})).sort((a,b)=>b.s-a.s).map(v=>v.m)}
 // The pinned chess.js raw legal moves avoid SAN generation at every search node.
 // Position counts and the complete wrapper state are restored even on budget abort.
 function play(m){if(!fastChess)return game.play(m);const r=game.rules;game.past.push(game.status);r._makeMove(m.raw);r._incPositionCount();game.turn=r.turn()==='w'?1:2;game.status=r.isThreefoldRepetition()?outcome(0,'threefold'):r.isDrawByFiftyMoves()?outcome(0,'fifty-move'):r.isInsufficientMaterial()?outcome(0,'insufficient-material'):ongoing();game.status.check=r.isCheck();return true}
 function undo(){if(!fastChess)return game.undo();const r=game.rules,hash=r._hash;r._undoMove();r._decPositionCount(hash);game.status=game.past.pop();game.turn=r.turn()==='w'?1:2}
 const terminal=ply=>game.status.winner===0?0:game.status.winner===player?10000000-ply:-10000000+ply;
 function visit(){if(++nodes>budget||Date.now()>deadline)throw halt}
 function quiesce(alpha,beta,left,ply){visit();if(game.status.over)return terminal(ply);const maximizing=game.turn===player,check=!!game.status.check;let list=candidates(null,ply);if(!list.length)return fastChess?(check?(maximizing?-10000000+ply:10000000-ply):0):game.evaluate(player);let value=game.evaluate(player);if(!left)return value;
  if(!check){if(maximizing){if(value>=beta)return value;alpha=Math.max(alpha,value)}else{if(value<=alpha)return value;beta=Math.min(beta,value)}list=list.filter(m=>m.promotion||game.rules.get(m.to))}else value=maximizing?-Infinity:Infinity;
  for(const m of list){play(m);let v;try{v=quiesce(alpha,beta,left-1,ply+1)}finally{undo()}value=maximizing?Math.max(value,v):Math.min(value,v);if(maximizing)alpha=Math.max(alpha,value);else beta=Math.min(beta,value);if(alpha>=beta)break}return value}
 function search(depth,alpha,beta,ply){visit();if(game.status.over)return terminal(ply);if(depth<=0){if(game.type==='chess'||game.type==='xiangqi')return quiesce(alpha,beta,tier+2,ply);if(game.type==='gomoku'&&gomoku().forced&&ply<maxDepth+6)depth=1;else if(game.type==='dots'&&game.legalMoves().some(m=>game.adjacent(m).some(([x,y])=>game.sides(x,y)===3)))depth=1;else return evaluate()}
  const k=key(),cached=tt.get(k),origAlpha=alpha,origBeta=beta,maximizing=game.turn===player,reuse=!['chess','xiangqi'].includes(game.type);if(reuse&&cached&&cached.depth>=depth&&cached.ply===ply){if(cached.flag===0)return cached.value;if(cached.flag===1)alpha=Math.max(alpha,cached.value);else beta=Math.min(beta,cached.value);if(alpha>=beta)return cached.value}
  let value=maximizing?-Infinity:Infinity,best=null;const list=candidates(cached&&cached.move,ply);if(!list.length)return fastChess?(game.status.check?(maximizing?-10000000+ply:10000000-ply):0):game.evaluate(player);
  for(const m of list){const turn=game.turn;if(!play(m))continue;let v;try{v=search(depth-(game.type==='dots'&&turn===game.turn?0:1),alpha,beta,ply+1)}finally{undo()}if(maximizing?v>value:v<value){value=v;best=moveKey(m)}if(maximizing)alpha=Math.max(alpha,value);else beta=Math.min(beta,value);if(alpha>=beta){killers.set(ply,moveKey(m));break}}
  if(tt.size<100000)tt.set(k,{value,depth,ply,move:best,flag:value<=origAlpha?-1:value>=origBeta?1:0});return value}
 let initial=candidates(null,0);if(!initial.length)return {move:null,nodes:0,depth:0,score:0};let best={move:initial[0],score:0,depth:0};
 for(let depth=1;depth<=maxDepth;depth++){let candidate=null,value=-Infinity,alpha=-Infinity;try{const scores=new Map();for(const m of initial){const turn=game.turn;if(!play(m))continue;let score;try{score=search(depth-(game.type==='dots'&&turn===game.turn?0:1),alpha,Infinity,1)}finally{undo()}scores.set(moveKey(m),score);if(score>value){value=score;candidate=m}alpha=Math.max(alpha,value)}if(candidate)best={move:candidate,score:value,depth};initial.sort((a,b)=>scores.get(moveKey(b))-scores.get(moveKey(a)))}catch(error){if(error!==halt)throw error;break}if(value>=9999000)break}
 const {raw,...move}=best.move;return {move:copy(move),score:best.score,depth:best.depth,nodes:Math.min(nodes,budget)}
}

const api={Gomoku,Reversi,DotsBoxes,Chess,Xiangqi,create,chooseMove};
if(common)module.exports=api;root.PigBoardCore=api;
})(typeof window!=='undefined'?window:globalThis);
