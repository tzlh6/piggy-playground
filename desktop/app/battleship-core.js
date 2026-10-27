/* Headless battleship. Placement, fog of war and a public-information AI.
 * Probability-grid approach researched in billmei/battleboat (MIT).
 * This implementation is original and does not import its DOM or artwork.
 */
(function(root){
'use strict';
const copy=v=>JSON.parse(JSON.stringify(v));
const integer=(v,a,b)=>Number.isInteger(v)&&v>=a&&v<=b;
class Battleship{
 constructor(options){options=options||{};this.type='battleship';this.size=options.size===undefined?10:options.size;this.fleet=options.fleet===undefined?[5,4,3,3,2]:copy(options.fleet);if(!integer(this.size,4,12)||!Array.isArray(this.fleet)||!this.fleet.length||this.fleet.length>8||this.fleet.some(n=>!integer(n,1,this.size))||this.fleet.reduce((a,b)=>a+b,0)>this.size*this.size*.65)throw Error('无效战舰棋配置');this.seed=options.seed===undefined?20261027:options.seed;if(!integer(this.seed,0,4294967295))throw Error('随机种子应为 32 位非负整数');this.rngState=this.seed;this.turn=1;this.phase='placement';this.status={over:false,winner:null,reason:null};this.boards=[Array(this.size*this.size).fill(0),Array(this.size*this.size).fill(0)];this.ships=[[],[]];this.shots=[Array(this.size*this.size).fill(0),Array(this.size*this.size).fill(0)];this.past=[];this.lastMove=null}
 random(){this.rngState=(Math.imul(this.rngState,1664525)+1013904223)>>>0;return this.rngState/4294967296}
 cells(move,length){if(!move||!integer(move.x,0,this.size-1)||!integer(move.y,0,this.size-1)||typeof move.horizontal!=='boolean')return null;const out=[];for(let k=0;k<length;k++){const x=move.x+(move.horizontal?k:0),y=move.y+(move.horizontal?0:k);if(x>=this.size||y>=this.size)return null;out.push(y*this.size+x)}return out}
 placements(player){const ships=this.ships[player-1],board=this.boards[player-1],length=this.fleet[ships.length];if(!length)return [];const out=[];for(const horizontal of [true,false])for(let y=0;y<this.size;y++)for(let x=0;x<this.size;x++){const m={type:'place',x,y,horizontal},cells=this.cells(m,length);if(cells&&cells.every(i=>!board[i]))out.push(m)}return out}
 remember(){const s={};for(const k of ['turn','phase','status','boards','ships','shots','rngState','lastMove'])s[k]=copy(this[k]);this.past.push(s)}
 undo(){if(!this.past.length)return false;Object.assign(this,this.past.pop());return true}
 place(player,m){const p=player-1,length=this.fleet[this.ships[p].length],cells=this.cells(m,length);if(!length||!cells||cells.some(i=>this.boards[p][i]))return null;const id=this.ships[p].length+1;cells.forEach(i=>this.boards[p][i]=id);this.ships[p].push({cells,hits:0,length});return cells}
 autoPlace(player){const p=player-1,start=this.ships[p].length;let attempts=0;const fill=()=>{if(this.ships[p].length===this.fleet.length)return true;if(++attempts>10000)return false;const choices=this.placements(player);for(let i=choices.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[choices[i],choices[j]]=[choices[j],choices[i]]}for(const m of choices){const cells=this.place(player,m);if(fill())return true;this.ships[p].pop();cells.forEach(i=>this.boards[p][i]=0)}return false};if(fill())return true;while(this.ships[p].length>start){const ship=this.ships[p].pop();ship.cells.forEach(i=>this.boards[p][i]=0)}return false}
 legalMoves(){if(this.status.over)return [];if(this.phase==='placement')return [...this.placements(this.turn),{type:'auto-place'}];const out=[],shots=this.shots[this.turn-1];for(let y=0;y<this.size;y++)for(let x=0;x<this.size;x++)if(!shots[y*this.size+x])out.push({type:'fire',x,y});return out}
 play(m){if(!m||this.status.over)return null;const player=this.turn,p=player-1;if(this.phase==='placement'){
   if(m.type!=='place'&&m.type!=='auto-place')return null;
   if(m.type==='place'){const length=this.fleet[this.ships[p].length],cells=this.cells(m,length);if(!length||!cells||cells.some(i=>this.boards[p][i]))return null}
   this.remember();let cells;if(m.type==='auto-place'){if(!this.autoPlace(player)){this.undo();return null}cells=this.ships[p].flatMap(s=>s.cells)}else cells=this.place(player,m);
   if(this.ships[p].length===this.fleet.length){if(player===1)this.turn=2;else{this.phase='battle';this.turn=1}}
   this.lastMove={type:m.type,player};return {type:'placement',private:true,player,cells:cells.map(i=>({x:i%this.size,y:Math.floor(i/this.size)})),ready:this.ships[p].length===this.fleet.length,phase:this.phase}
  }
  if(m.type!=='fire'||!integer(m.x,0,this.size-1)||!integer(m.y,0,this.size-1))return null;const i=m.y*this.size+m.x;if(this.shots[p][i])return null;this.remember();const enemy=1-p,id=this.boards[enemy][i];this.shots[p][i]=id?2:1;let sunk=null;
  if(id){const ship=this.ships[enemy][id-1];ship.hits++;if(ship.hits===ship.length){ship.cells.forEach(k=>this.shots[p][k]=3);sunk=ship.cells.map(k=>({x:k%this.size,y:Math.floor(k/this.size)}))}if(this.ships[enemy].every(s=>s.hits===s.length))this.status={over:true,winner:player,reason:'fleet-sunk'}}
  this.turn=3-player;this.lastMove={type:'fire',x:m.x,y:m.y,player,hit:!!id,sunk};return {...copy(this.lastMove),status:copy(this.status)}
 }
 view(player){const valid=player===1||player===2;const publicBoard=p=>({shots:this.shots[1-p].slice(),ready:this.ships[p].length===this.fleet.length,sunk:this.ships[p].filter(s=>s.hits===s.length).map(s=>({length:s.length,cells:s.cells.map(i=>({x:i%this.size,y:Math.floor(i/this.size)}))}))});
  const result={type:this.type,size:this.size,fleet:this.fleet.slice(),turn:this.turn,phase:this.phase,status:copy(this.status),players:[publicBoard(0),publicBoard(1)]};
  if(valid){const p=player-1;result.player=player;result.ownBoard=this.boards[p].slice();result.ownShips=copy(this.ships[p]);result.target=this.shots[p].slice();result.remainingFleet=this.fleet.slice();for(const ship of result.players[1-p].sunk){const i=result.remainingFleet.indexOf(ship.length);if(i>=0)result.remainingFleet.splice(i,1)}}return result}
 state(){return this.view()}
}

// Only the visible shot grid and the publicly known remaining ship lengths
// enter this function. No enemy placement or private save is consulted.
function chooseShot(view,options){options=options||{};if(!view||view.phase!=='battle'||view.status.over||!Array.isArray(view.target))return null;const n=view.size,b=view.target,heat=Array(n*n).fill(0),hits=b.filter(v=>v===2).length;
 for(const length of view.remainingFleet)for(const horizontal of [true,false])for(let y=0;y<n;y++)for(let x=0;x<n;x++){const cells=[];for(let k=0;k<length;k++){const nx=x+(horizontal?k:0),ny=y+(horizontal?0:k);if(nx>=n||ny>=n)break;cells.push(ny*n+nx)}if(cells.length!==length||cells.some(i=>b[i]===1||b[i]===3))continue;const covered=cells.filter(i=>b[i]===2).length;if(hits&&!covered)continue;for(const i of cells)if(!b[i])heat[i]+=1+covered*50}
 let best=-1,value=-1;for(let i=0;i<b.length;i++)if(!b[i]){const score=options.level==='easy'?0:heat[i];if(score>value){best=i;value=score}}return best<0?null:{type:'fire',x:best%n,y:Math.floor(best/n)}
}
function chooseMove(game,options){if(game.status.over)return {move:null,nodes:0,depth:0};return {move:game.phase==='placement'?{type:'auto-place'}:chooseShot(game.view(game.turn),options),nodes:0,depth:1}}
const api={Battleship,chooseShot,chooseMove};if(typeof module!=='undefined')module.exports=api;root.PigBattleshipCore=api;
})(typeof window!=='undefined'?window:globalThis);
