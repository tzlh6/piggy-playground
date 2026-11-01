const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const Games=require('./app/board-session.js');
const profiles=Games.chessDifficulties,ids=Object.keys(profiles).filter(id=>id!=='custom');
assert.equal(ids.length,8);
assert.deepEqual(Games.chessOptions('hard'),{level:'hard',maxMs:3200,elo:3190});
assert.deepEqual(ids.slice(2).map(id=>Games.chessOptions(id).elo),[1320,1600,2000,2400,2800,3190]);
assert.deepEqual(Games.chessOptions('custom',1900,'easy'),{level:'easy',maxMs:600,elo:1900});
assert.deepEqual(Games.chessOptions('hard',null,'infinite'),{level:'hard',maxMs:0,elo:3190,infinite:true});
assert.equal(Games.chessOptions('master',null,'verylong').maxMs,30000);
assert.equal(Games.chessOptions('beginner',null,'infinite').infinite,undefined);
for(const id of ['beginner','casual'])assert.equal(Games.chessOptions(id).elo,undefined);
const root={PigBoardGames:Games};root.window=root;vm.createContext(root);vm.runInContext(fs.readFileSync(__dirname+'/app/board-ui.js','utf8'),root);
assert.equal(root.PigBoardUI.configs.chess.defaultLevel,'beginner');
assert.equal(root.PigBoardUI.configs.chess.levels.length,10);
const fen='7k/5K2/6Q1/8/8/8/8/8 w - - 0 1',counts={};
for(const id of ['beginner','casual']){
 let mates=0;const choices=new Set();
 for(let i=0;i<80;i++){
  const session=Games.create('chess',{fen}),before=JSON.stringify(session.save());
  const reply=session.suggest({...Games.chessOptions(id),seed:Math.imul(i+1,2654435761)>>>0});
  assert.equal(JSON.stringify(session.save()),before);
  assert.equal(reply.practice,id);assert(session.applyAI(reply).ok);
  choices.add(reply.move.from+reply.move.to);
  if(session.status.reason==='checkmate')mates++;
 }
 assert(choices.size>5,'Practice must sometimes miss the strongest move');counts[id]=mates;
 const session=Games.create('chess',{fen}),hint=session.suggest({...Games.chessOptions(id),hint:true,seed:1});
 assert(session.applyAI(hint).ok);assert.equal(session.status.reason,'checkmate','Hints should not deliberately miss mate');
}
assert(counts.beginner<counts.casual&&counts.casual<80,JSON.stringify(counts));
for(const id of ['beginner','casual']){
 const session=Games.create('chess');
 for(let ply=0;ply<30&&!session.status.over;ply++){
  const before=JSON.stringify(session.save()),reply=session.suggest({...Games.chessOptions(id),seed:Math.imul(ply+3,2246822519)>>>0});
  assert.equal(JSON.stringify(session.save()),before);assert(session.applyAI(reply).ok);
 }
 assert.deepEqual(Games.restore(session.save()).save(),session.save());
}
console.log('PASS eight chess presets, original maximum, custom speed, forgiving practice, useful hints, legal play and replay:',counts);
