const assert=require('node:assert/strict'),G=require('./app/board-session.js'),M=require('./app/mate-patterns.js');
const sq=(x,y,game)=>String.fromCharCode(97+x)+(game==='chess'?8-y:9-y);
function fen(game,entries,turn=2){const height=game==='chess'?8:10,width=game==='chess'?8:9,board=Array.from({length:height},()=>Array(width).fill(null));for(const [type,player,x,y]of entries)board[y][x]={type,player};return board.map(row=>{let s='',empty=0;for(const p of row){if(!p)empty++;else{if(empty)s+=empty;empty=0;s+=p.player===1?p.type.toUpperCase():p.type}}return s+(empty||'')}).join('/')+' '+(turn===1?'w':'b')+' - - 0 1'}
const examples=[
 ['smothered','chess','6rk/5Npp/8/8/8/8/8/K7 b - - 0 1'],
 ['backrank','chess','R5k1/5ppp/8/8/8/8/8/K7 b - - 0 1'],
 ['ladder','chess','R6k/1R6/8/8/8/8/8/K7 b - - 0 1'],
 ['arabian','chess','7k/7R/5N2/8/8/8/8/K7 b - - 0 1'],
 ['anastasia','chess','8/4N1pk/8/8/8/8/8/K6R b - - 0 1'],
 ['boden','chess','1bk5/2pp4/B4B2/8/8/8/8/7K b - - 0 1'],
 ['queenBishop','chess','7k/6Q1/5B2/8/8/8/8/K7 b - - 0 1'],
 ['queenKnight','chess','7k/6Q1/4N3/8/8/8/8/K7 b - - 0 1'],
 ['hook','chess','5K2/5N2/4P1kR/5pp1/8/8/8/8 b - - 0 1'],
 ['dovetail','chess','8/8/4p3/3pk3/5Q2/6B1/8/K7 b - - 0 1'],
 ['doubleCannon','xiangqi',fen('xiangqi',[['k',2,4,0],['a',2,3,0],['a',2,5,0],['c',1,4,2],['c',1,4,3],['k',1,3,9]])],
 ['horseCannon','xiangqi',fen('xiangqi',[['k',2,4,0],['n',1,4,2],['c',1,4,3],['k',1,3,9]])],
 ['fishingHorse','xiangqi',fen('xiangqi',[['k',2,4,0],['n',1,2,2],['r',1,7,0],['k',1,3,9]])],
 ['palaceHorse','xiangqi',fen('xiangqi',[['k',2,4,0],['n',1,2,1],['r',1,3,2],['r',1,5,2],['p',1,4,2],['k',1,3,9]])],
 ['cornerHorse','xiangqi',fen('xiangqi',[['k',2,4,0],['n',1,3,2],['n',1,1,1],['r',1,5,2],['p',1,4,2],['k',1,3,9]])],
 ['palaceSmother','xiangqi',fen('xiangqi',[['k',2,4,0],['r',2,3,0],['r',2,5,0],['a',2,4,1],['n',2,3,2],['n',2,5,2],['c',1,4,3],['k',1,3,9]])],
 ['facingKing','xiangqi',fen('xiangqi',[['k',2,4,0],['n',1,1,1],['n',1,7,1],['r',1,4,1],['k',1,4,9]])],
 // Terminal-position data cross-checked against BobJackson/chess 4b7279b.
 ['horseCannon','xiangqi','3akN2C/4a4/9/9/9/5R3/9/9/9/5K3 b - - 0 1'],
 ['sideHorse','xiangqi','9/R8/3aka3/2N6/9/9/9/9/9/5K3 b - - 0 1'],
 ['heavenEarth','xiangqi','C2aka3/4r4/9/9/4C4/9/9/9/9/5K3 b - - 0 1'],
 ['rookCannons','xiangqi','3aka3/R8/4C4/9/4C4/9/9/9/9/5K3 b - - 0 1'],
 ['ironGate','xiangqi','3aka3/4R4/9/3N5/9/4C4/9/9/9/5K3 b - - 0 1'],
 ['doublePawn','xiangqi','4k4/3P1P3/9/9/9/4R4/9/9/9/4K4 b - - 0 1']
];
const results=[];
function analyze(session,move,extra={}){const before=JSON.stringify(session.save()),state=session.view(1),out=M.analyze({game:session.game,state,move,...extra});assert.equal(JSON.stringify(session.save()),before,'Recognizer must not mutate game');return out}
for(const [expected,game,position]of examples){
 const s=G.create(game,{fen:position});assert.equal(s.status.reason,'checkmate',expected+' must be a real rules-engine checkmate: '+JSON.stringify(s.status));const result=analyze(s);assert.equal(result.id,expected,expected+' recognized as '+JSON.stringify(result));results.push(result.id);
 const board=s.view(1).board,entries=[];for(let y=0;y<board.length;y++)for(let x=0;x<board[y].length;x++){const p=board[y][x];if(p)entries.push([p.type,3-p.player,board[y].length-1-x,board.length-1-y])}const mirror=G.create(game,{fen:fen(game,entries,1)});assert.equal(mirror.status.reason,'checkmate');assert.equal(analyze(mirror).id,expected,'Color/rotation symmetry for '+expected);
}
function play(session,uci,recent){const result=session.dispatch(session.turn,{from:uci.slice(0,2),to:uci.slice(2,4),...(uci[4]?{promotion:uci[4]}:{})});assert(result.ok,'Illegal fixture move '+uci);const e=result.event;if(recent)recent.push({ply:session.actions.length,player:e.player,type:typeof e.piece==='string'?e.piece:e.piece.type,from:e.from,to:e.to,check:!!e.status.check});return e}
const double=G.create('chess',{fen:'7k/4N1Rp/8/8/8/2B5/8/K7 w - - 0 1'}),doubleEvent=play(double,'g7g8');assert.equal(double.status.reason,'checkmate');assert.equal(analyze(double,doubleEvent).id,'doubleCheck');
const promote=G.create('chess',{fen:'7k/5P2/6K1/8/8/8/8/8 w - - 0 1'}),promotion=play(promote,'f7f8q');assert.equal(promote.status.reason,'checkmate');assert.equal(analyze(promote,promotion).id,'promotion');
const ep=G.create('chess',{fen:'2N5/1B6/8/k2pP2R/2K5/8/2B5/8 w - d6 0 1'}),epMove=play(ep,'e5d6');assert.equal(ep.status.reason,'checkmate');assert.equal(analyze(ep,epMove).id,'enPassant');
const fools=G.create('chess');let final;for(const uci of ['f2f3','e7e5','g2g4','d8h4'])final=play(fools,uci);assert.equal(analyze(fools,final,{standardStart:true,history:fools.actions}).id,'fools');
const scholar=G.create('chess');for(const uci of ['e2e4','e7e5','f1c4','b8c6','d1h5','g8f6','h5f7'])final=play(scholar,uci);assert.equal(analyze(scholar,final,{standardStart:true,history:scholar.actions}).id,'scholar');
const crossed=G.create('xiangqi',{fen:fen('xiangqi',[['k',2,4,0],['r',1,3,2],['r',1,5,2],['k',1,3,9]],1)}),recent=[];
for(const uci of ['d7d9','e9e8','f7f8','e8e7','d9d7'])final=play(crossed,uci,recent);assert.equal(crossed.status.reason,'checkmate');assert.equal(analyze(crossed,final,{recent}).id,'doubleRook');assert.notEqual(analyze(crossed,final,{recent:recent.slice(-2)}).id,'doubleRook','No invented alternating-rook history');
for(const game of ['chess','xiangqi']){const s=G.create(game);assert.equal(analyze(s),null);s.dispatch(1,{type:'resign'});assert.equal(analyze(s),null,'Resignation is not mate')}
const stale=G.create('chess',{fen:'7k/5K2/6Q1/8/8/8/8/8 b - - 0 1'});assert.equal(stale.status.reason,'stalemate');assert.equal(analyze(stale),null,'Chess stalemate must not celebrate a win');
const confined=G.create('xiangqi',{fen:'4k4/9/3RPR3/9/9/9/9/9/9/3K5 b - - 0 1'});assert.equal(confined.status.reason,'stalemate-loss');assert.equal(analyze(confined).id,'stalemateWin','Xiangqi stalemate is a win, distinct from chess stalemate');
const missing=G.create('xiangqi',{fen:'4k4/4R4/9/9/9/9/9/9/9/3K5 w - - 0 1'}),beforeCapture=missing.view(1),kingCapture=play(missing,'e8e9');assert.equal(missing.status.reason,'king-captured');assert.equal(analyze(missing),null,'No invented king location in an incomplete terminal snapshot');
const capturedInfo=M.analyze({game:'xiangqi',state:missing.view(1),before:beforeCapture,move:kingCapture});assert.equal(capturedInfo.id,'kingCaptured');
const escape=G.create('chess',{fen:'6rk/5Np1/8/8/8/8/8/K7 b - - 0 1'});assert.equal(escape.status.over,false);assert.equal(analyze(escape),null,'A check with an escape is not mate');
const unrelated=G.create('chess',{fen:'7k/5K1R/8/5B2/8/8/8/N7 b - - 0 1'});assert.equal(unrelated.status.reason,'checkmate');assert.notEqual(analyze(unrelated).id,'arabian','An irrelevant knight cannot create Arabian mate');
// Real game regression positions from ornicar/lichess-puzzler 8e24b6d test_back_rank_mate.
for(const [id,start,moves,expected]of [
 ['tMEri','5r1k/4q1p1/p2pP2p/1p6/1P2Q3/PB6/1BP3PP/6K1 w - - 1 27','e4g6 e7a7 b2d4 a7d4 g1h1 f8f1',true],
 ['08VjT','3r2k1/1bQ3p1/p2p3p/3qp1b1/1p6/1P1B4/P1P3PP/1K3R2 b - - 4 25','d5c6 c7f7 g8h8 f7f8 d8f8 f1f8',false],
 ['LYKY0','r5k1/pQ3ppp/8/8/B1pp4/4q3/PP5P/5R1K b - - 0 26','a8d8 b7f7 g8h8 f7f8 d8f8 f1f8',true],
 ['ABCL2','3r2k1/1b4pp/1p2pr2/p5N1/8/PP2n1P1/1BR2bBP/4R2K w - - 1 27','b2f6 b7g2',false]
]){const s=G.create('chess',{fen:start});let last;for(const m of moves.split(' '))last=play(s,m);const out=analyze(s,last);assert.equal(out?.id==='backrank'||out?.tags.includes(M.catalog.backrank.name),expected,'Lichess back-rank regression '+id)}
let seed=17;const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
for(const game of ['chess','xiangqi']){const s=G.create(game);for(let ply=0;ply<70&&!s.status.over;ply++){const state=s.view(1),board=state.board;let king;const own=[];for(let y=0;y<board.length;y++)for(let x=0;x<board[y].length;x++){const p=board[y][x];if(!p)continue;if(p.type==='k'&&p.player===s.turn)king={x,y};if(p.player!==s.turn)own.push({...p,x,y})}if(king)assert.equal(own.some(p=>M.attacks(board,p,king,game)),!!s.status.check,'Attack geometry differs from rules engine');const moves=s.legalMoves(s.turn);s.dispatch(s.turn,moves[Math.floor(rng()*moves.length)])}}
console.log('PASS mate patterns: '+results.join(', ')+', double check, promotion, en passant, opening mates, alternating rooks; mirrored boards, negatives, unchanged state and rules-engine attack parity.');
