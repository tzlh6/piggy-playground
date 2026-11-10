'use strict';
const assert=require('node:assert/strict');
const M=require('./app/meadow-core.js');

let seed=24689;
const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
for(const size of [4,5,6])for(let n=0;n<120;n++){
 const {source,solution,tiles}=M.pipes(size,random);
 assert.ok(!M.pipeStatus(tiles,size,source).solved);
 assert.ok(M.pipeStatus(solution,size,source).solved);
 assert.equal(solution.reduce((sum,mask)=>sum+[1,2,4,8].filter(bit=>mask&bit).length,0),2*(size*size-1));
 for(let i=0;i<tiles.length;i++){
  for(let n=0;n<4&&tiles[i]!==solution[i];n++)tiles[i]=M.rotate(tiles[i]);
  assert.equal(tiles[i],solution[i]);
  assert.equal(M.rotate(M.rotate(tiles[i]),-1),tiles[i]);
 }
 assert.ok(M.pipeStatus(tiles,size,source).solved);
}
assert.ok(!M.pipeStatus([6,12,0,0],2,0).solved);

function countSolutions(puzzle){
 const {size,rows,cols}=puzzle;
 const byClue=new Map();
 for(let mask=0;mask<(1<<size);mask++){
  const line=Array.from({length:size},(_,i)=>(mask>>i)&1);
  const clue=M.pixelClues([...line,...Array(size*(size-1)).fill(0)],size).rows[0].join();
  if(!byClue.has(clue))byClue.set(clue,[]);
  byClue.get(clue).push(line);
 }
 let count=0;
 function visit(y,options){
  if(y===size){count++;return}
  for(const line of byClue.get(rows[y].join())){
   const next=options.map((lists,x)=>lists.filter(col=>col[y]===line[x]));
   if(next.every(list=>list.length))visit(y+1,next);
   if(count>1)return;
  }
 }
 visit(0,cols.map(clue=>byClue.get(clue.join())));
 return count;
}
for(const [level,drawings] of Object.entries(M.drawings))for(let i=0;i<drawings.length;i++){
 const puzzle=M.picture(level,i);
 assert.equal(puzzle.pixels.length,puzzle.size**2);
 assert.equal(countSolutions(puzzle),1,puzzle.name);
}

const {Crossing}=M;
const game=new Crossing('normal',()=>0);
assert.equal(game.move(0,-1),undefined,'wait for start');
game.start();
game.lanes.find(l=>l.row===8).offset=.4;
assert.equal(game.move(0,-1),'car');
assert.equal(game.lives,2);
assert.equal(game.move(0,-1),undefined,'restart grace period');
game.tick(.5);game.x=3;game.y=5;
const raft=game.lanes.find(l=>l.row===4);raft.offset=3.3;
assert.equal(game.move(0,-1),'water');
assert.equal(game.lives,1);
game.tick(.5);game.remaining=.01;
assert.equal(game.tick(.02),'time');assert.equal(game.status,'lost');
assert.equal(game.tick(1),undefined);assert.equal(game.lives,0);

const win=new Crossing('easy',()=>0);win.start();
const log=win.lanes.find(l=>l.row===4);
win.x=1;win.y=5;assert.equal(win.move(0,-1),'step');
win.tick(.05);assert.equal(win.x,1+log.speed*.05);
M.PENS.forEach((x,i)=>{
 win.x=x;win.y=1;win.wait=0;
 assert.equal(win.move(0,-1),i===M.PENS.length-1?'win':'home');
});
assert.equal(win.status,'won');assert.equal(win.score,450);
const duplicate=new Crossing('normal',()=>0);duplicate.start();
duplicate.x=M.PENS[0];duplicate.y=1;assert.equal(duplicate.move(0,-1),'home');
duplicate.wait=0;duplicate.x=M.PENS[0];duplicate.y=1;assert.equal(duplicate.move(0,-1),'pen');
assert.equal(duplicate.pens.size,1);
console.log('PASS: 360 solvable and scrambled pipe puzzles; 9 nonograms with one solution each; crossing traffic, rafts, timeout, four pens and duplicate-pen checks.');
