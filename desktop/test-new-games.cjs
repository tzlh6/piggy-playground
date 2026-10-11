const assert=require('node:assert/strict');
const A=require('./app/arcade-core.js');
const seeded=seed=>()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};

// Blocks: bags, hold limit, rotations, hard drop scoring, line clears and topout.
for(let seed=1;seed<=30;seed++){
 const g=new A.Blocks(seeded(seed)),types=[g.piece.type];for(let k=0;k<6;k++){g.spawn();types.push(g.piece.type)}assert.equal(new Set(types).size,7);
 const original=g.piece.type;assert(g.swapHold());assert.equal(g.hold,original);assert(!g.swapHold());g.drop();assert(g.swapHold());assert.equal(g.piece.type,original);
}
{const g=new A.Blocks(()=>.5);g.piece={type:'I',m:A.SHAPES.I.map(r=>r.slice()),x:0,y:18};g.board[19]=Array(10).fill(1);for(let c=0;c<4;c++)g.board[19][c]=0;const ev=g.drop();assert.equal(ev.lines,1);assert.equal(g.lines,1);assert(g.score>=100);assert(g.board[19].every(v=>v===0))}
{const g=new A.Blocks();g.piece={type:'T',m:A.SHAPES.T.map(r=>r.slice()),x:0,y:0};const m=JSON.stringify(g.piece.m);for(let k=0;k<4;k++)assert(g.rotate());assert.equal(JSON.stringify(g.piece.m),m);assert(!g.move(-1));assert(g.move(1))}
{const g=new A.Blocks();g.piece.y=g.ghostY();const p=g.piece;g.update(.1);assert.equal(g.piece,p,'lock delay lets the player adjust');for(let k=0;k<5;k++)g.update(.1);assert.notEqual(g.piece,p);g.board=Array.from({length:20},()=>Array(10).fill(2));g.spawn();assert(g.over)}

// Breakout: paddle edges set the angle, bricks cannot be tunnelled through,
// misses use precisely one life, and all three rounds are reachable.
{const g=new A.Breakout(false,()=>1);g.launch();g.ball.x=g.paddle.x+40;g.ball.y=g.paddle.y-12;g.ball.vx=0;g.ball.vy=500;g.update(.03,0);assert(g.ball.vy<0);assert(g.ball.vx>0)}
{const g=new A.Breakout(true,()=>1);g.launch();g.bricks=[{x:300,y:100,w:100,h:22,row:0,hp:2}];g.ball={x:330,y:70,r:8,vx:0,vy:650};g.update(.08,0);assert.equal(g.bricks[0].hp,1);assert(g.ball.vy<0);assert.equal(g.score,5)}
{const g=new A.Breakout(false);for(let k=0;k<3;k++){g.launch();g.ball.y=450;g.update(.02);assert.equal(g.lives,2-k)}assert(g.over&&!g.won)}
{const g=new A.Breakout(false,()=>1);for(let round=1;round<=3;round++){g.bricks=[{x:300,y:100,w:100,h:22,row:0,hp:1}];g.waiting=false;g.ball={x:330,y:70,r:8,vx:0,vy:450};const ev=g.update(.08);assert(ev.includes(round===3?'win':'round'));assert.equal(g.round,Math.min(3,round+1))}assert(g.won&&g.over)}
{const g=new A.Breakout(false);g.drops=[{x:g.paddle.x,y:g.paddle.y-9}];assert(g.update(.02).includes('wide'));g.update(.02);assert(g.paddle.w>126);g.aim(-100);assert(g.paddle.x>=g.paddle.w/2)}

// Flight: independent of frame rate, one point per gate, real collisions.
{const g=new A.Flappy(true,()=>.5);g.next=1e9;g.pipes=[{x:100,w:40,cy:190,passed:false}];g.update(.02);assert.equal(g.score,1);g.update(.02);assert.equal(g.score,1);g.y=5;assert(g.update(.02).includes('crash'));assert(!g.flap())}
{const g=new A.Flappy(false);g.next=1e9;g.pipes=[{x:155,w:50,cy:320,passed:false}];assert(g.update(.01).includes('crash'))}
{const g=new A.Flappy(true);g.next=1e9;g.pipes=[{x:g.x+g.r+1,w:50,cy:190,passed:false}];g.y=190;assert(!g.update(.001).includes('crash'),'circle clears the gate centre')}

{const g=new A.Stack();g.active.x=175;assert.equal(g.drop().type,'perfect');assert.equal(g.layers[1].w,250);g.active.x=200;assert.equal(g.drop().type,'cut');assert.equal(g.layers[2].w,225);g.active.x=0;assert.equal(g.drop().type,'cut');g.active.x=g.W-g.active.w;assert.equal(g.drop().type,'miss');assert(g.over)}
{const g=new A.Stack();for(let k=0;k<100;k++){g.active.x=g.layers[g.layers.length-1].x;g.drop()}assert.equal(g.score,100);assert.equal(g.layers[100].w,250);assert.equal(g.perfect,100)}

// Four-in-a-row: all line directions, gravity, terminal states, AI tactics.
for(const ids of [[35,36,37,38],[3,10,17,24],[0,8,16,24],[6,12,18,24]]){const b=Array(42).fill(0);ids.forEach(i=>b[i]=1);assert.equal(A.connectLine(b,1).length,4)}
{const g=new A.Connect();for(const c of [0,6,1,6,2,5,3])g.drop(c);assert.equal(g.winner,1);assert(g.over);assert(!g.drop(4));assert.deepEqual(g.line,[35,36,37,38])}
{const g=new A.Connect();for(let k=0;k<6;k++)assert(g.drop(0));assert(!g.drop(0));assert.equal(g.moves,6)}
{const b=Array(42).fill(0);b[35]=b[36]=b[37]=2;const before=b.join();assert.equal(A.chooseConnect(b,2,4),3);assert.equal(b.join(),before);b[35]=b[36]=b[37]=1;assert.equal(A.chooseConnect(b,2,4),3);assert.equal(b[38],0)}
for(let seed=1;seed<=4;seed++){const g=new A.Connect(),rng=seeded(seed);while(!g.over){const col=A.chooseConnect(g.board,g.turn,2,rng);assert(col>=0&&col<7);assert(g.drop(col))}assert(g.moves<=42)}

// Lights: all generated boards are solvable; hints reach a real win.
for(const n of [3,4,5])for(let seed=1;seed<=50;seed++){const g=new A.Lights(n,seeded(seed));assert(!g.won);const original=g.board.slice();const path=A.solveLights(n,g.board);assert(path&&path.length);assert(g.press(path[0]));assert(g.undo());assert.deepEqual(g.board,original);path.forEach(i=>g.press(i));assert(g.won);assert.equal(g.moves,path.length)}

// Warehouses: validate and solve every original level using legal movement.
const levelReport=[];
for(let i=0;i<A.SOKO_LEVELS.length;i++){const g=new A.Sokoban(i);assert(g.player>=0);assert.equal(g.boxes.size,g.goals.size);assert(!g.won);const path=A.solveSokoban(g,180000);assert(path,'unsolvable level '+(i+1));const first=g.player;assert(g.move(path[0]));assert(g.undo());assert.equal(g.player,first);path.forEach(dir=>assert(g.move(dir),'illegal solution move'));assert(g.won);levelReport.push({level:i+1,moves:path.length,pushes:g.pushes})}
{const g=new A.Sokoban(0);assert(!g.move('down')||g.player>=0);const old=g.moves;assert(!g.move('unknown'));assert.equal(g.moves,old)}

// Match3: stable boards, valid swaps, no row-wrapping, exact move cost,
// cascade scoring, automatic playable reshuffles, target/step end conditions.
for(let seed=1;seed<=60;seed++){const g=new A.Match3(seed%2?5:6,24,999999,seeded(seed));assert.equal(g.matches().length,0);assert(!g.adjacent(7,8));assert(!g.swap(0,63));assert.equal(g.moves,24);for(let k=0;k<24;k++){const pair=g.findMove();assert(pair);const ev=g.swap(...pair);assert(ev&&ev.gained>0);assert.equal(g.moves,23-k);assert.equal(g.matches().length,0);assert(g.board.every(v=>v>=0&&v<g.colors));assert(g.findMove());assert.equal(ev.gained,ev.frames.reduce((sum,f)=>sum+f.points,0))}assert(g.over&&!g.won)}
{const g=new A.Match3(5,24,1,seeded(80));g.swap(...g.findMove());assert(g.over&&g.won);assert(!g.swap(...g.findMove()))}
{const g=new A.Match3(5,24,1400,()=>0);assert(g.findMove());assert.equal(g.matches().length,0);g.swap(...g.findMove());assert.equal(g.matches().length,0)}
console.log('PASS: all 8 new engines; 150 solvable light puzzles; 12 warehouses verified; 1440 legal match-3 turns; blocks, paddle physics, flight, stacking and AI.');
console.log('Warehouse solutions:',JSON.stringify(levelReport));
