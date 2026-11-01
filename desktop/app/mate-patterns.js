/* Original, conservative terminal-position recognizers. No engine or DOM calls.
 * References: ornicar/lichess-puzzler tagger/cook.py (8e24b6d), its regression
 * positions; BobJackson/chess core/mate.js (4b7279b) and daihengdh/XiangQi-online
 * rules.js (d666ec7). Geometry and history are checked independently here.
 * Additional anatomy reference: denialguo/chesstrove. No upstream code
 * or artwork is bundled here. The existing rules engine decides the result.
 */
(function(root){
'use strict';
const DEFINITIONS={
 smothered:['闷杀','马跳入杀点，国王被己方棋子堵住了全部邻格。','cage','#8d75c4'],
 backrank:['底线杀','重子沿底线将军，国王向前的退路被己方棋子封住。','rank','#d9a34a'],
 ladder:['双车梯子杀','两枚重子分守相邻横线或纵线，把国王逐层封到边缘。','ladder','#d6a353'],
 arabian:['阿拉伯杀','车贴边将军，马既保护车，又封住国王的逃路。','horse','#5ba6a6'],
 anastasia:['阿纳斯塔西娅杀','重子沿边线将军，马封住斜向退路，守方棋子堵住国王向内的一格。','gate','#7e9d66'],
 boden:['波登双象杀','双象控制交叉的斜线，国王又被己方棋子挡住其他退路。','cross','#9e82b9'],
 doubleBishop:['双象合围杀','两只象分守不同颜色的斜线，合力封住国王的逃路。','cross','#9e82b9'],
 hook:['钩子杀','车贴身将军，马保护车，兵又保护马，三子环环相扣。','horse','#7eaa92'],
 dovetail:['燕尾杀','后斜贴国王将军，守方的两枚棋子像燕尾一样堵住退路。','crown','#cfa457'],
 queenBishop:['后象协杀','后贴近国王完成将死，象在斜线上保护王后。','crown','#c79b45'],
 queenKnight:['后马协杀','后贴近国王完成将死，马保护王后的落点。','horse','#8c89c1'],
 fools:['愚人杀','开局第二回合，后沿暴露的斜线直取国王。','lightning','#bc785d'],
 scholar:['学者杀','后在 f7 或 f2 配合象，完成经典的四步杀。','cross','#d5a651'],
 doubleCheck:['双将绝杀','两枚棋子同时将军，国王已经没有合法应对。','double','#d47b5e'],
 discovered:['闪击绝杀','移开前面的棋子，露出后方的攻击线路，直接完成将死。','lightning','#6da59f'],
 promotion:['升变绝杀','兵在底线升变，新生的棋子当场完成将死。','promotion','#d6ad4b'],
 enPassant:['过路绝杀','吃过路兵移走两条阻挡，打开攻击线路并完成将死。','lightning','#69a4aa'],
 doubleRook:['双车错','两车连续交替将军，另一车封住退路，最终合围老将。','ladder','#d39a55'],
 doubleCannon:['重炮绝杀','前炮充当炮架，后炮将军，两炮重叠使老将无处可逃。','cannon','#cd8257'],
 horseCannon:['马后炮','炮以马为炮架，其他棋子配合封路，完成绝杀。','horse-cannon','#ac87ba'],
 fishingHorse:['钓鱼马','马占钓鱼位控制宫心，车在底线上完成封杀。','horse','#71a79a'],
 palaceHorse:['卧槽马','马跳入卧槽位将军，其他棋子封住老将的逃路。','horse','#b39a5e'],
 cornerHorse:['挂角马','马占九宫前角，将军与封门形成合围。','horse','#8b9e68'],
 sideHorse:['侧面虎','马占九宫侧前方将军，其他棋子封住老将的逃路。','horse','#8b9e68'],
 heavenEarth:['天地炮','一炮纵向将军，一炮在底线横向将军，双炮交叉封锁九宫。','cannon','#c18a60'],
 rookCannons:['夹车炮','两炮重叠将军，车同时封住老将的退路。','cannon','#c58f58'],
 ironGate:['铁门栓','车兵占住将门，中炮牵制士的防守，锁住九宫完成绝杀。','gate','#9caa75'],
 doublePawn:['二鬼拍门','双兵深入九宫两侧，配合将军子封住老将的退路。','double','#ad9b65'],
 palaceSmother:['闷宫炮','老将的宫内邻格都被己方棋子占住，炮隔子完成绝杀。','cage','#bd855d'],
 facingKing:['白脸将','将帅隔线形成牵制，使老将不能吃掉贴身将军的棋子。','royal','#d3ab63'],
 stalemateWin:['困毙制胜','中国象棋中，无棋可走也判负；对方已经没有合法着法。','gate','#859c74'],
 kingCaptured:['擒将','老将被吃，本局结束。','royal','#b88966'],
 rookMate:['车线绝杀','车的直线攻击与封路配合，完成将死。','rank','#ce9c58'],
 queenMate:['王后绝杀','王后控制逃路，完成将死。','crown','#caa34e'],
 bishopMate:['斜线绝杀','象沿斜线将军，国王已无合法应对。','cross','#9b83b5'],
 knightMate:['跃马绝杀','马跳过阻挡完成将军，逃路也已被封住。','horse','#78a19b'],
 pawnMate:['小兵建功','小兵走到关键位置，完成最后一击。','promotion','#a0aa68'],
 cannonMate:['炮轰绝杀','炮借助炮架完成将军，老将已无合法应对。','cannon','#c68a61'],
 generic:['合围绝杀','攻击与封路形成合围，对方已经没有合法应对。','seal','#b99b69']
};
const catalog=Object.freeze(Object.fromEntries(Object.entries(DEFINITIONS).map(([id,[name,description,effect,color]])=>[id,Object.freeze({id,name,description,effect,color})])));
const key=p=>p.x+','+p.y,same=(a,b)=>a&&b&&a.x===b.x&&a.y===b.y;
function pieces(board,player){const result=[];for(let y=0;y<board.length;y++)for(let x=0;x<board[y].length;x++){const p=board[y][x];if(p&&(!player||p.player===player))result.push({...p,x,y})}return result}
function inside(board,x,y){return y>=0&&y<board.length&&x>=0&&x<board[0].length}
function palace(player,x,y){return x>=3&&x<=5&&(player===1?y>=7&&y<=9:y>=0&&y<=2)}
function between(board,a,b){if(a.x!==b.x&&a.y!==b.y&&Math.abs(a.x-b.x)!==Math.abs(a.y-b.y))return null;const dx=Math.sign(b.x-a.x),dy=Math.sign(b.y-a.y),out=[];if(!dx&&!dy)return out;for(let x=a.x+dx,y=a.y+dy;x!==b.x||y!==b.y;x+=dx,y+=dy)if(board[y][x])out.push({...board[y][x],x,y});return out}
function attacks(board,p,to,game){
 const dx=to.x-p.x,dy=to.y-p.y,ax=Math.abs(dx),ay=Math.abs(dy);if(!ax&&!ay)return false;
 if(game==='chess'){
  if(p.type==='p')return ax===1&&dy===(p.player===1?-1:1);
  if(p.type==='n')return ax*ay===2;
  if(p.type==='k')return Math.max(ax,ay)===1;
  const diagonal=ax===ay,straight=!dx||!dy;if(!(p.type==='q'&&(diagonal||straight)||p.type==='b'&&diagonal||p.type==='r'&&straight))return false;
  return between(board,p,to).length===0;
 }
 if(p.type==='p')return dx===0&&dy===(p.player===1?-1:1)||ay===0&&ax===1&&(p.player===1?p.y<=4:p.y>=5);
 if(p.type==='n'){if(ax*ay!==2)return false;return ax===2?!board[p.y][p.x+Math.sign(dx)]:!board[p.y+Math.sign(dy)][p.x]}
 if(p.type==='a')return ax===1&&ay===1&&palace(p.player,to.x,to.y);
 if(p.type==='b')return ax===2&&ay===2&&!board[p.y+dy/2][p.x+dx/2]&&(p.player===1?to.y>=5:to.y<=4);
 if(p.type==='k'){if(ax+ay===1&&palace(p.player,to.x,to.y))return true;return dx===0&&board[to.y][to.x]?.type==='k'&&between(board,p,to).length===0}
 if((p.type==='r'||p.type==='c')&&(!dx||!dy))return between(board,p,to).length===(p.type==='r'?0:1);
 return false;
}
function attackers(board,to,player,game){return pieces(board,player).filter(p=>attacks(board,p,to,game))}
function analyze(input){
 const state=input&&input.state,game=input&&input.game,status=state&&state.status;
 if(!state||!['chess','xiangqi'].includes(game)||!status?.over||![1,2].includes(status.winner))return null;
 const allowed=game==='chess'?['checkmate']:['checkmate','stalemate-loss','king-captured'];if(!allowed.includes(status.reason))return null;
 const board=state.board;if(!Array.isArray(board)||!Array.isArray(board[0]))return null;
 const winner=status.winner,loser=3-winner,ours=pieces(board,winner),theirs=pieces(board,loser),king=theirs.find(p=>p.type==='k')||pieces(input.before?.board||[],loser).find(p=>p.type==='k');
 if(!king)return null;
 const checking=status.reason==='checkmate'?attackers(board,king,winner,game):[],escapes=[];
 for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
  if(!dx&&!dy||game==='xiangqi'&&Math.abs(dx)+Math.abs(dy)!==1)continue;
  const x=king.x+dx,y=king.y+dy;if(!inside(board,x,y)||game==='xiangqi'&&!palace(loser,x,y))continue;
  const occupant=board[y][x],blocked=occupant?.player===loser;let cover=[];
  if(!blocked){const lifted=board.map(row=>row.slice());lifted[king.y][king.x]=null;lifted[y][x]={type:'k',player:loser};cover=attackers(lifted,{x,y},winner,game)}
  escapes.push({x,y,blocked,occupant,cover});
 }
 const free=escapes.filter(e=>!e.blocked),covers=(p,e)=>e.cover.some(q=>same(p,q)),helpers=p=>free.filter(e=>covers(p,e)),matches=[];
 function add(id,actors,extra){matches.push({...catalog[id],actors:actors||checking,...extra})}
 if(status.reason==='stalemate-loss')add('stalemateWin',ours.filter(p=>free.some(e=>covers(p,e))));
 else if(status.reason==='king-captured')add('kingCaptured',ours.filter(p=>same(p,input.move&&square(input.move.to,game))));
 else if(game==='chess'){
  const move=input.move||{},to=square(move.to,game),moved=ours.find(p=>same(p,to)),history=input.history||[];
  if(String(move.flags||'').includes('e'))add('enPassant',[moved,...checking].filter(Boolean));
  if(move.promotion)add('promotion',[moved,...checking].filter(Boolean));
  if(input.standardStart&&winner===2&&history.length===4&&move.from==='d8'&&move.to==='h4'&&king.x===4&&king.y===7){const white=history.filter(h=>h.player===1).map(h=>h.move);if(white.some(m=>m.from==='f2'&&['f3','f4'].includes(m.to))&&white.some(m=>m.from==='g2'&&m.to==='g4'))add('fools',checking)}
  for(const q of checking.filter(p=>p.type==='q')){
   const bishops=ours.filter(p=>p.type==='b'&&attacks(board,p,q,game));
   if(input.standardStart&&((winner===1&&history.length===7&&q.x===5&&q.y===1&&king.x===4&&king.y===0)||(winner===2&&history.length===8&&q.x===5&&q.y===6&&king.x===4&&king.y===7))&&bishops.some(p=>p.x===2&&p.y===(winner===1?4:3)))add('scholar',[q,...bishops]);
  }
  if(checking.length===1&&checking[0].type==='n'&&escapes.length&&escapes.every(e=>e.blocked))add('smothered',checking);
  for(const r of checking.filter(p=>p.type==='r'))for(const n of ours.filter(p=>p.type==='n')){
   if((king.x===0||king.x===7)&&(king.y===0||king.y===7)&&Math.abs(r.x-king.x)+Math.abs(r.y-king.y)===1&&Math.abs(n.x-king.x)===2&&Math.abs(n.y-king.y)===2&&attacks(board,n,r,game)&&free.some(e=>!same(e,r)&&covers(n,e)))add('arabian',[r,n]);
   if(Math.max(Math.abs(r.x-king.x),Math.abs(r.y-king.y))===1&&Math.max(Math.abs(n.x-king.x),Math.abs(n.y-king.y))===1&&attacks(board,n,r,game)){const pawn=ours.find(p=>p.type==='p'&&attacks(board,p,n,game));if(pawn)add('hook',[r,n,pawn])}
  }
  for(const r of checking.filter(p=>['r','q'].includes(p.type))){
   const inward=[];if(king.x===0||king.x===7)inward.push({x:king.x===0?1:-1,y:0});if(king.y===0||king.y===7)inward.push({x:0,y:king.y===0?1:-1});
   for(const v of inward){const p={x:king.x+v.x,y:king.y+v.y},a={x:p.x-v.y,y:p.y+v.x},b={x:p.x+v.y,y:p.y-v.x};
    const partner=ours.find(o=>['r','q'].includes(o.type)&&!same(o,r)&&(v.x?o.x===p.x:o.y===p.y)&&helpers(o).length>=1);
    if(partner&&(v.x?r.x===king.x:r.y===king.y))add('ladder',[r,partner],r.type==='r'&&partner.type==='r'?null:{name:'重子梯子杀'});
    if(!inside(board,a.x,a.y)||!inside(board,b.x,b.y))continue;
    const block=board[p.y][p.x];if(v.x&&block?.player===loser&&r.x===king.x){const n=ours.find(n=>n.type==='n'&&attacks(board,n,a,game)&&attacks(board,n,b,game));if(n)add('anastasia',[r,n])}
   }
  }
  for(const b of checking.filter(p=>p.type==='b'))for(const other of ours.filter(p=>p.type==='b'&&!same(p,b)&&(p.x+p.y)%2!==(b.x+b.y)%2))if(helpers(other).length&&free.every(e=>covers(b,e)||covers(other,e))&&free.every(e=>e.cover.every(p=>p.type==='b'))){const cross=(b.x-king.x)*(other.x-king.x)<0;add(cross?'boden':'doubleBishop',[b,other])}
  for(const r of checking.filter(p=>['r','q'].includes(p.type)))if(king.y===(loser===1?7:0)&&r.y===king.y){const forward=king.y+(loser===1?-1:1),cells=[-1,0,1].map(dx=>({x:king.x+dx,y:forward})).filter(p=>inside(board,p.x,p.y));if(cells.every(p=>board[p.y][p.x]?.player===loser&&!attackers(board,p,winner,game).length))add('backrank',[r])}
  for(const q of checking.filter(p=>p.type==='q'))if(king.x>0&&king.x<7&&king.y>0&&king.y<7&&Math.abs(q.x-king.x)===1&&Math.abs(q.y-king.y)===1){const dx=Math.sign(q.x-king.x),dy=Math.sign(q.y-king.y),rear=[{x:king.x-dx,y:king.y},{x:king.x,y:king.y-dy}];if(rear.every(p=>board[p.y][p.x]?.player===loser)&&free.every(e=>same(e,q)||e.cover.length===1&&same(e.cover[0],q)))add('dovetail',[q,...ours.filter(p=>!same(p,q)&&attacks(board,p,q,game))])}
  for(const q of checking.filter(p=>p.type==='q'))if(Math.max(Math.abs(q.x-king.x),Math.abs(q.y-king.y))===1){for(const [type,id]of [['b','queenBishop'],['n','queenKnight']]){const p=ours.find(p=>p.type===type&&attacks(board,p,q,game));if(p)add(id,[q,p])}}
  if(checking.length>=2)add('doubleCheck',checking);
  if(to&&checking.length&&!checking.some(p=>same(p,to)))add('discovered',[moved,...checking].filter(Boolean));
 }else{
  const rooks=checking.filter(p=>p.type==='r'),cannons=checking.filter(p=>p.type==='c'),knights=checking.filter(p=>p.type==='n'),home=loser===2?0:9,front=loser===2?1:-1;
  const turns=(input.recent||[]).filter(h=>h.player===winner).slice(-3);
  if(rooks.length&&turns.length===3&&turns.every(h=>String(h.type).toLowerCase()==='r'&&h.check)&&turns[0].to===turns[2].from&&turns[1].from!==turns[0].to){const other=ours.find(p=>p.type==='r'&&!checking.some(c=>same(c,p))&&helpers(p).length);if(other)add('doubleRook',[...rooks,other],{trail:turns.map(h=>({from:square(h.from,game),to:square(h.to,game)}))})}
  const netRooks=ours.filter(p=>p.type==='r'&&helpers(p).length);
  if(cannons.some(p=>p.x===king.x)&&cannons.some(p=>p.y===home))add('heavenEarth',cannons);
  for(const c of cannons){const screen=between(board,c,king);if(screen.length!==1)continue;const s=screen[0];
   if(s.player===winner&&s.type==='c')add(netRooks.length?'rookCannons':'doubleCannon',[c,s,...netRooks]);
   if(s.player===winner&&s.type==='n')add('horseCannon',[c,s]);
  }
  for(const r of rooks){const n=ours.find(p=>p.type==='n'&&[2,6].includes(p.x)&&p.y===home+front*2&&free.some(e=>e.x===4&&e.y===home+front&&covers(p,e)));if(n&&r.y===home)add('fishingHorse',[r,n])}
  for(const n of knights){let id=null;if([2,6].includes(n.x)){if(n.y===home+front)id='palaceHorse';if(n.y===home+front*2)id='fishingHorse';if(n.y===home+front*3)id='sideHorse'}if([3,5].includes(n.x)&&n.y===home+front*2)id='cornerHorse';if(id)add(id,[n,...ours.filter(p=>helpers(p).length)])}
  if(cannons.length===1&&escapes.length&&escapes.every(e=>e.blocked)){const screen=between(board,cannons[0],king);if(screen.length===1&&screen[0].player===loser&&screen[0].type==='a'&&Math.abs(screen[0].x-king.x)+Math.abs(screen[0].y-king.y)===1)add('palaceSmother',cannons)}
  for(const r of checking.filter(p=>['r','p'].includes(p.type)&&p.x===king.x&&p.y===king.y+front))for(const c of ours.filter(p=>p.type==='c'&&p.x===king.x)){const screen=between(board,c,king);if(screen.length===1&&same(screen[0],r)&&theirs.some(a=>a.type==='a'&&attacks(board,a,r,game)))add('ironGate',[r,c])}
  const doorPawns=[3,5].map(x=>ours.find(p=>p.type==='p'&&p.x===x&&palace(loser,p.x,p.y)&&(helpers(p).length||checking.some(c=>same(c,p)))));if(doorPawns.every(Boolean))add('doublePawn',[...checking,...doorPawns]);
  for(const r of rooks)if(free.some(e=>same(e,r)&&e.cover.some(p=>p.type==='k')))add('facingKing',[r,...ours.filter(p=>p.type==='k')]);
 }
 if(!matches.length){const checker=checking[0],fallback={r:'rookMate',q:'queenMate',b:'bishopMate',n:'knightMate',p:'pawnMate',c:'cannonMate'};add(fallback[checker?.type]||'generic',checking)}
 const chosen=matches[0],unique=list=>[...new Map(list.filter(Boolean).map(p=>[key(p),{x:p.x,y:p.y,type:p.type}])).values()];
 const routes=chosen.actors.filter(Boolean).map(p=>{const target=checking.some(c=>same(c,p))?king:checking.find(c=>attacks(board,p,c,game))||free.find(e=>covers(p,e));return target?{from:{x:p.x,y:p.y},to:{x:target.x,y:target.y},type:p.type}:null}).filter(Boolean);
 return {...chosen,game,winner,king:{x:king.x,y:king.y},actors:unique(chosen.actors),checkers:unique(checking),routes,move:input.move?{from:square(input.move.from,game),to:square(input.move.to,game)}:null,blocked:escapes.filter(e=>e.blocked).map(e=>({x:e.x,y:e.y})),flights:free.map(e=>({x:e.x,y:e.y})),tags:[...new Set(matches.slice(1).map(m=>m.name))].filter(n=>n!==chosen.name).slice(0,3)};
}
function square(value,game){if(typeof value==='string'&&/^[a-i][0-9]$/.test(value))return {x:value.charCodeAt(0)-97,y:(game==='chess'?8:9)-Number(value[1])};if(value&&Number.isInteger(value.x)&&Number.isInteger(value.y))return value;return null}
const api={catalog,analyze,attacks,square};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.PigMatePatterns=api;
})(typeof window!=='undefined'?window:globalThis);
