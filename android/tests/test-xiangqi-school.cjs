// Run from the public repository: node android/tests/test-xiangqi-school.cjs
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const android=path.resolve(__dirname,'..'),desktop=path.resolve(process.argv[2]||path.join(android,'../desktop'));
global.PigBoardGames=require(path.join(desktop,'app/board-session.js'));
const C=require(path.join(android,'web/xiangqi-coach.js')),D=require(path.join(android,'web/xiangqi-lessons.js'));
for(const item of D.lessons){const s=C.replay(item.fen,item.line);assert(s.status.over&&s.status.winner===(item.id.endsWith('-black')?2:1));for(let i=0;i<item.line.length;i++)assert(C.describe(C.replay(item.fen,item.line,i).view(1).fen,item.line[i]).text);}
for(const item of D.openings){assert(!C.replay(item.fen,item.line).status.over);assert.equal(item.comments.length,item.line.length);assert.deepEqual(C.parseRecord(item.line.join(' ')).line,item.line);}
assert.equal(C.notation(C.game(),'h2e2'),'炮二平五');const s=C.game();s.dispatch(1,C.move('h2e2'));assert.equal(C.notation(s,'h9g7'),'马8进7');
for(const text of ['a0a9','h2e2 h9h0','garbage','[FEN "invalid"]\nh2e2','h2e2 '.repeat(501),'x'.repeat(30001)])assert.throws(()=>C.parseRecord(text));
const html=fs.readFileSync(path.join(android,'assets/game.html'),'utf8');assert(Buffer.byteLength(html)<6*1024*1024);assert(!html.includes('type="application/json" id="pig-engine-'));assert(html.includes('window.PigXiangqiSchool=')&&html.includes("script-src 'self'"));
const catalog=JSON.parse(fs.readFileSync(path.join(desktop,'app/assets/engines/catalog.json'),'utf8'));let parts=0;
for(const engine of Object.values(catalog))for(const file of engine.parts){assert(fs.readFileSync(path.join(android,'assets',file)).equals(fs.readFileSync(path.join(desktop,'app',file))));parts++;}
console.log('PASS 10 mate exercises, 3 annotated records, notation, invalid imports, startup budget, and '+parts+' exact lazy engine parts.');
