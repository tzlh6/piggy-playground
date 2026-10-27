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
 potential(m,p){if(!m||!inside(m.x,m.y,this.size,this.size)||this.board[m.y*this.size+m.x])return -1;let best=0;
  for(const [dx,dy] of DIRS){const a=this.run(m.x+dx,m.y+dy,dx,dy,p),b=this.run(m.x-dx,m.y-dy,-dx,-dy,p),n=1+a.cells.length+b.cells.length,open=Number(a.open)+Number(b.open);if((this.rule==='freestyle'&&n>=5)||(this.rule==='exact-five'&&n===5))return 1000000;best+=open?Math.pow(8,Math.min(n,4))*(open===2?3:1):0}return best}
 legalMoves(){if(this.status.over)return [];const a=[];for(let y=0;y<this.size;y++)for(let x=0;x<this.size;x++)if(!this.board[y*this.size+x])a.push({x,y});return a}
 aiMoves(){if(!this.moves)return [{x:Math.floor(this.size/2),y:Math.floor(this.size/2)}];const a=this.legalMoves().filter(m=>{for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)if(inside(m.x+dx,m.y+dy,this.size,this.size)&&this.board[(m.y+dy)*this.size+m.x+dx])return true;return false});return a.sort((a,b)=>this.priority(b)-this.priority(a)).slice(0,14)}
 priority(m){const own=this.potential(m,this.turn),opp=this.potential(m,3-this.turn);return own>=1000000?3000000:opp>=1000000?2000000:own*1.05+opp}
 play(m){if(this.status.over||!m||!inside(m.x,m.y,this.size,this.size)||this.board[m.y*this.size+m.x])return null;this.remember();const p=this.turn;this.board[m.y*this.size+m.x]=p;this.moves++;this.lastMove={x:m.x,y:m.y,player:p};
  for(const [dx,dy] of DIRS){const a=this.run(m.x+dx,m.y+dy,dx,dy,p).cells,b=this.run(m.x-dx,m.y-dy,-dx,-dy,p).cells,line=[...b.reverse(),{x:m.x,y:m.y},...a];if((this.rule==='freestyle'&&line.length>=5)||(this.rule==='exact-five'&&line.length===5)){this.line=line;this.status=outcome(p,'five');break}}
  if(!this.status.over&&this.moves===this.board.length)this.status=outcome(0,'board-full');this.turn=3-p;return copy({type:'place',...this.lastMove,line:this.line,status:this.status})}
 evaluate(player){let best=[0,0];for(const m of this.legalMoves())for(let p=1;p<=2;p++)best[p-1]=Math.max(best[p-1],this.potential(m,p));return best[player-1]-best[2-player]}
}

class Reversi extends GridGame{
 constructor(){super('reversi');this.size=8;this.board=Array(64).fill(0);this.board[27]=this.board[36]=2;this.board[28]=this.board[35]=1;this.scores=[2,2];this.moves=0}
 flips(m,p){if(!m||!inside(m.x,m.y,8,8)||this.board[m.y*8+m.x])return [];const out=[];for(const [dx,dy] of ALLDIRS){let x=m.x+dx,y=m.y+dy;const ray=[];while(inside(x,y,8,8)&&this.board[y*8+x]===3-p){ray.push(y*8+x);x+=dx;y+=dy}if(ray.length&&inside(x,y,8,8)&&this.board[y*8+x]===p)out.push(...ray)}return out}
 legalMoves(player){if(this.status.over)return [];const p=player||this.turn,out=[];for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(this.flips({x,y},p).length)out.push({x,y});return out}
 play(m){if(this.status.over)return null;const f=this.flips(m,this.turn);if(!f.length)return null;this.remember();const p=this.turn;this.board[m.y*8+m.x]=p;f.forEach(i=>this.board[i]=p);this.moves++;this.scores=[this.board.filter(v=>v===1).length,this.board.filter(v=>v===2).length];this.turn=3-p;let passedPlayer=null;
  if(!this.legalMoves().length){this.turn=p;if(this.legalMoves().length)passedPlayer=3-p;else this.status=outcome(this.scores[0]===this.scores[1]?0:this.scores[0]>this.scores[1]?1:2,'no-moves')}
  this.lastMove={x:m.x,y:m.y,player:p};return copy({type:'place',...this.lastMove,flipped:f.map(i=>({x:i%8,y:Math.floor(i/8)})),passedPlayer,status:this.status})}
 priority(m){const corner=(m.x===0||m.x===7)&&(m.y===0||m.y===7),edge=m.x===0||m.x===7||m.y===0||m.y===7;let risk=0;for(const [x,y] of [[0,0],[7,0],[0,7],[7,7]])if(!this.board[y*8+x]&&Math.abs(x-m.x)<=1&&Math.abs(y-m.y)<=1)risk=100;return (corner?1000:edge?20:0)-risk+this.flips(m,this.turn).length}
 evaluate(player){let score=0;for(let y=0;y<8;y++)for(let x=0;x<8;x++){const v=this.board[y*8+x];if(v)score+=(v===player?1:-1)*((x===0||x===7)&&(y===0||y===7)?150:x===0||x===7||y===0||y===7?8:1)}return score+8*(this.legalMoves(player).length-this.legalMoves(3-player).length)}
}

class DotsBoxes extends GridGame{
 constructor(options){super('dots');options=options||{};this.width=options.width===undefined?4:options.width;this.height=options.height===undefined?4:options.height;if(!integer(this.width,1,8)||!integer(this.height,1,8))throw Error('点格棋宽高应为 1–8');this.h=Array(this.width*(this.height+1)).fill(0);this.v=Array((this.width+1)*this.height).fill(0);this.boxes=Array(this.width*this.height).fill(0);this.scores=[0,0];this.moves=0}
 edge(m){if(!m)return null;if(m.orientation==='h'&&inside(m.x,m.y,this.width,this.height+1))return [this.h,m.y*this.width+m.x];if(m.orientation==='v'&&inside(m.x,m.y,this.width+1,this.height))return [this.v,m.y*(this.width+1)+m.x];return null}
 legalMoves(){if(this.status.over)return [];const out=[];for(const orientation of ['h','v']){const w=this.width+(orientation==='v'?1:0),h=this.height+(orientation==='h'?1:0);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const m={orientation,x,y};const [a,i]=this.edge(m);if(!a[i])out.push(m)}}return out}
 adjacent(m){const a=m.orientation==='h'?[[m.x,m.y-1],[m.x,m.y]]:[[m.x-1,m.y],[m.x,m.y]];return a.filter(([x,y])=>inside(x,y,this.width,this.height))}
 sides(x,y){return Number(!!this.h[y*this.width+x])+Number(!!this.h[(y+1)*this.width+x])+Number(!!this.v[y*(this.width+1)+x])+Number(!!this.v[y*(this.width+1)+x+1])}
 priority(m){let s=0;for(const [x,y] of this.adjacent(m)){const n=this.sides(x,y);s+=n===3?100:n===2?-35:2}return s}
 play(m){const e=this.edge(m);if(this.status.over||!e||e[0][e[1]])return null;this.remember();const p=this.turn;e[0][e[1]]=p;this.moves++;const captured=[];for(const [x,y] of this.adjacent(m))if(this.sides(x,y)===4&&!this.boxes[y*this.width+x]){this.boxes[y*this.width+x]=p;this.scores[p-1]++;captured.push({x,y})}if(!captured.length)this.turn=3-p;if(this.scores[0]+this.scores[1]===this.boxes.length)this.status=outcome(this.scores[0]===this.scores[1]?0:this.scores[0]>this.scores[1]?1:2,'all-boxes');this.lastMove={orientation:m.orientation,x:m.x,y:m.y,player:p};return copy({type:'edge',...this.lastMove,captured,extraTurn:captured.length>0,status:this.status})}
 evaluate(player){return (this.scores[player-1]-this.scores[2-player])*100}
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
 priority(m){const target=this.rules.get(m.to);return (target?10*(VALUES[target.type]||0):0)+(m.promotion?VALUES[m.promotion]:0)}
 evaluate(player){let value=0;for(const row of this.rules.board())for(const p of row)if(p)value+=(p.color===(player===1?'w':'b')?1:-1)*(VALUES[p.type]||0);return value}
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
 priority(m){const p=this.rules.get(m.to);return p?(p.type==='k'?100000:10*(VALUES[p.type]||0)):0}
 evaluate(player){let value=0;const board=this.rules.board();for(let y=0;y<10;y++)for(let x=0;x<9;x++){const p=board[y][x];if(p){const progress=p.color==='r'?9-y:y;value+=(p.color===(player===1?'r':'b')?1:-1)*((VALUES[p.type]||0)+(p.type==='p'?progress*9+(progress>=5?65:0):p.type==='n'?10*(4-Math.abs(4-x)):0))}}return value}
}

const factories={chess:o=>new Chess(o),xiangqi:o=>new Xiangqi(o),gomoku:o=>new Gomoku(o),reversi:()=>new Reversi(),dots:o=>new DotsBoxes(o)};
function create(type,options){if(!Object.prototype.hasOwnProperty.call(factories,type))throw Error('未知棋类游戏');return factories[type](options)}

// Iterative deepening with a node/time budget. The original position is restored
// with finally, including when a search is interrupted. Extra turns are handled
// by the actual turn field rather than assuming players alternate every ply.
function chooseMove(game,options){options=options||{};if(game.status.over)return {move:null,nodes:0,depth:0,score:0};const level=options.level||'normal',config={easy:[1,180],normal:[2,1400],hard:[3,5000]}[level];if(!config)throw Error('未知电脑难度');const maxDepth=integer(options.depth,1,5)?options.depth:config[0],budget=integer(options.maxNodes,1,100000)?options.maxNodes:config[1],maxMs=Number.isFinite(options.maxMs)?Math.max(1,Math.min(5000,options.maxMs)):800,deadline=Date.now()+maxMs,player=game.turn,halt={};let nodes=0;
 const candidates=()=>{const list=game.aiMoves?game.aiMoves():game.legalMoves();return list.sort((a,b)=>(game.priority?game.priority(b)-game.priority(a):0))};
 const terminal=depth=>game.status.winner===0?0:game.status.winner===player?10000000+depth:-10000000-depth;
 function search(depth,alpha,beta){if(++nodes>budget||Date.now()>deadline)throw halt;if(game.status.over)return terminal(depth);if(depth===0)return game.evaluate(player);const maximizing=game.turn===player;let value=maximizing?-Infinity:Infinity;const moves=candidates();if(!moves.length)return game.evaluate(player);for(const m of moves){if(!game.play(m))continue;let score;try{score=search(depth-1,alpha,beta)}finally{game.undo()}value=maximizing?Math.max(value,score):Math.min(value,score);if(maximizing)alpha=Math.max(alpha,value);else beta=Math.min(beta,value);if(beta<=alpha)break}return value}
 const initial=candidates();if(!initial.length)return {move:null,nodes:0,depth:0,score:0};let best={move:initial[0],score:0,depth:0};
 for(let depth=1;depth<=maxDepth;depth++){let candidate=null,value=-Infinity;try{for(const m of initial){if(!game.play(m))continue;let score;try{score=search(depth-1,-Infinity,Infinity)}finally{game.undo()}if(score>value){value=score;candidate=m}}if(candidate)best={move:candidate,score:value,depth}}catch(error){if(error!==halt)throw error;break}if(value>=10000000)break}
 return {...copy(best),nodes:Math.min(nodes,budget)}
}

const api={Gomoku,Reversi,DotsBoxes,Chess,Xiangqi,create,chooseMove};
if(common)module.exports=api;root.PigBoardCore=api;
})(typeof window!=='undefined'?window:globalThis);
