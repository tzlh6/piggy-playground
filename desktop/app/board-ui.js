/* 棋类六款：猪猪象棋、猪猪国际象棋、猪猪五子棋、猪猪黑白棋、猪猪海战、猪猪围栏。
 * 规则、电脑、悔棋与存档全部来自 board-session.js；这里只负责 Canvas 画面、动画、输入与人机节奏。 */
(function(root){
'use strict';
const G=root.PigBoardGames,BS=root.PigBattleshipCore;
const VS=[['easy','人机 · 入门'],['normal','人机 · 聪明'],['hard','人机 · 高手'],['local','同屏双人']];
const configs={
 xiangqi:{name:'猪猪象棋',icon:'i-xiangqi',title:'楚河汉界，粉猪对黑猪。',subtitle:'马走日，象走田，炮要隔一子——困住对面的老将就赢。',tag:'中国象棋 · 三档人机 · 同屏双人 · 悔棋与提示',eyebrow:'24 / THE RIVER DUEL',note:'红方先走。点一枚棋子，亮点就是它能去的地方。',defaultLevel:'normal',levels:VS,labels:['手数','吃子','胜场'],
  tips:[['点子再点点','先点自己的棋子，棋盘上会亮出它能走的点，再点亮点落子；点空处取消。'],['蹩马腿、塞象眼','马被紧挨着的棋子挡住不能走，象的田字中心有子也不能走；炮吃子必须隔一枚。'],['将死或困毙就赢','对方被将军且无法解围，或者无棋可走，都算你赢。一方一直将军造成重复局面判负。']]},
 chess:{name:'猪猪国际象棋',icon:'i-chess',title:'小猪骑士，冲向对面的国王。',subtitle:'王车易位、吃过路兵、兵到底线变身——规则一个不少。',tag:'国际象棋 · Elo可调 · 同屏双人 · 升变自选',eyebrow:'25 / THE PIGGY KNIGHTS',note:'白方先走。拖动棋力滑块或输入目标Elo，选择适合你的对手。',defaultLevel:'normal',levels:[['easy','人机 · 快想'],['normal','人机 · 标准'],['hard','人机 · 深思'],['local','同屏双人']],labels:['手数','吃子','胜场'],
  tips:[['点子再点格','先点自己的棋子，能走的格子会亮出小圆点，能吃的格子亮出圆圈。'],['特殊走法','王车易位：点王再点向车方向两格。吃过路兵、兵的升变也都支持，升变时会弹出四个选项。'],['将死获胜','对方国王被将军且无路可逃即获胜；逼和、三次重复、五十回合无吃子和子力不足都是和棋。']]},
 gomoku:{name:'猪猪五子棋',icon:'i-gomoku',title:'五只小猪，排成一排。',subtitle:'横、竖、斜都算。先连成五只就赢，也别忘了堵住对面。',tag:'15 路自由五子 · 三档人机 · 同屏双人',eyebrow:'26 / FIVE IN A ROW',note:'先手先下。电脑会抢五、挡四，冲四要小心。',defaultLevel:'normal',levels:VS,labels:['手数','轮到','胜场'],
  tips:[['点交叉点落子','把小猪放在线的交叉点上。鼠标移上去会先显示半透明的预览。'],['五连就赢','横、竖、斜任意方向连成五只（或更多）同色小猪立即获胜。'],['先堵再攻','对方出现活三、冲四时先挡住；自己做出两个活三，对方就挡不过来了。']]},
 reversi:{name:'猪猪黑白棋',icon:'i-reversi',title:'夹住它，翻成自己的猪。',subtitle:'落子要夹住对方一条线，被夹的小猪全部翻面。最后谁的猪多谁赢。',tag:'8×8 黑白棋 · 三档人机 · 同屏双人',eyebrow:'27 / FLIP THE PIGS',note:'小圆点是能下的位置。角落最安全，靠近角的格子要小心。',defaultLevel:'normal',levels:VS,labels:['手数','比分','胜场'],
  tips:[['只能下在亮点上','落子必须在横、竖、斜任意方向夹住对方至少一只小猪，被夹住的全部翻面。'],['没地方下就跳过','一方无处可下时自动跳过，由对方继续；双方都下不了时数子定胜负。'],['抢角落','角上的小猪永远不会被翻回去。尽量别把角旁边的格子让给对方当跳板。']]},
 battleship:{name:'猪猪海战',icon:'i-battle',title:'猪猪舰队，出海！',subtitle:'先把五艘猪猪舰藏进自己的海域，再轮流开炮，找出对面的舰队。',tag:'10×10 海战棋 · 三档人机 · 同屏轮流（交接遮挡）',eyebrow:'28 / PIGGY NAVY',note:'先布舰：点海面放下舰只，空格或右键旋转，也可以一键随机。',defaultLevel:'normal',levels:VS,labels:['开炮','剩余舰只','胜场'],
  tips:[['先布舰','依次放下 5、4、3、3、2 格长的舰只。空格或右键切换横竖，“随机布舰”一键摆好。'],['轮流开炮','点对方海域开炮：水花是落空，火焰是命中，整艘被打中会沉没并显出舰身。每次开炮后换人。'],['先击沉全部者胜','打中后沿着上下左右继续找，舰只是直的。同屏双人时每次换人会先遮住屏幕。']]},
 dots:{name:'猪猪围栏',icon:'i-dots',title:'一条一条画栅栏，把小猪圈起来。',subtitle:'围住一格就得一分并且再画一条。小心别给对面留下第三条边。',tag:'5×5 点格棋 · 三档人机 · 同屏双人',eyebrow:'29 / FENCE THE PIGS',note:'画上一格的第四条边就圈住一只猪，还能接着画。',defaultLevel:'normal',levels:VS,labels:['已画栅栏','比分','胜场'],
  tips:[['点两点之间画栅栏','把鼠标移到两颗松露之间，亮起的就是要画的栅栏，点一下画上。'],['围住得分再画','补上一格的第四条边就围住一只小猪得 1 分，并且必须继续画一条。一条边可能同时围住两格。'],['别送第三条边','一格已经有两条边时，再画第三条就是把分送给对方。后期常常要计算“长链”让谁先进。']]}
};
const OPTIONS={gomoku:()=>({size:15}),dots:()=>({width:5,height:5}),battleship:()=>({seed:Math.floor(Math.random()*4294967295)})};
const SIDES={xiangqi:['红方','黑方'],chess:['白方','黑方'],gomoku:['先手','后手'],reversi:['先手','后手'],battleship:['一号舰队','二号舰队'],dots:['先手','后手']};
const ROLES={xiangqi:['scarf','wizard'],chess:['crown','pirate'],gomoku:['glasses','detective'],reversi:['flower','music'],battleship:['pirate','space'],dots:['chef','bee']};
const AI_NAMES={easy:'小黑 · 认真下',normal:'小黑 · 深思熟虑',hard:'黑猪大师'};
const REASONS={checkmate:'将死','stalemate':'逼和',threefold:'三次重复局面','insufficient-material':'双方子力都不足以将死','fifty-move':'五十回合没有吃子或动兵','king-captured':'老将被吃','stalemate-loss':'困毙，无棋可走','perpetual-check-loss':'长将判负','threefold-casual':'重复局面','sixty-move':'六十回合没有吃子',five:'五子连珠','board-full':'棋盘下满','no-moves':'双方都无处落子','fleet-sunk':'全部舰只被击沉','all-boxes':'所有格子都围完了',resignation:'认输'};
const XQ={1:{k:'帥',a:'仕',b:'相',n:'傌',r:'俥',c:'炮',p:'兵'},2:{k:'將',a:'士',b:'象',n:'馬',r:'車',c:'砲',p:'卒'}};
const CG={k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'};
const CHESS_FONT='"Segoe UI Symbol","Noto Sans Symbols 2","Noto Sans Symbols2","DejaVu Sans","Arial Unicode MS",serif';
const KAI='"KaiTi","STKaiti","Kaiti SC","楷体","SimSun","Noto Serif CJK SC",serif';
const START={xiangqi:{k:1,a:2,b:2,n:2,r:2,c:2,p:5},chess:{k:1,q:1,r:2,b:2,n:2,p:8}};
const ORDER={xiangqi:'rcnbap',chess:'qrbnp'};
const PROMO=[['q','后'],['r','车'],['b','象'],['n','马']];
const reduce=()=>root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const ease=p=>1-Math.pow(1-clamp(p,0,1),3);
const back=p=>{p=clamp(p,0,1);return 1+2.7*Math.pow(p-1,3)+1.7*Math.pow(p-1,2)};
function rr(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()}
function circle(c,x,y,r){c.beginPath();c.arc(x,y,Math.max(0,r),0,Math.PI*2)}
function alpha(hex,a){const n=parseInt(hex.slice(1),16);return 'rgba('+(n>>16)+','+((n>>8)&255)+','+(n&255)+','+a+')'}
// 圆圆的猪头棋子。sx 用于翻面（0–1），expr：normal / happy / shock。
function pigToken(c,x,y,r,pal,o){
 o=o||{};const sx=o.sx===undefined?1:o.sx,lift=o.lift||0;
 c.save();
 if(!o.flat){c.fillStyle='rgba(50,28,28,'+(.24-lift/r*.08)+')';c.beginPath();c.ellipse(x+r*.06,y+r*.2,r*.92*Math.max(.25,sx)+lift*.1,r*.8,0,0,Math.PI*2);c.fill()}
 c.translate(x,y-lift);c.scale(Math.max(.02,sx),1);
 c.fillStyle=pal.ear;c.strokeStyle=pal.line;c.lineWidth=Math.max(1,r*.06);
 for(const s of [-1,1]){c.beginPath();c.moveTo(s*r*.82,-r*.28);c.quadraticCurveTo(s*r*1.02,-r*1.02,s*r*.26,-r*.8);c.closePath();c.fill();c.stroke()}
 const g=c.createRadialGradient(-r*.32,-r*.42,r*.08,0,0,r*.95);g.addColorStop(0,pal.belly);g.addColorStop(.55,pal.body);g.addColorStop(1,pal.shade);
 c.fillStyle=g;circle(c,0,0,r*.86);c.fill();c.lineWidth=Math.max(1,r*.07);c.stroke();
 if(pal.spots){c.fillStyle=pal.spots;c.beginPath();c.ellipse(r*.42,-r*.42,r*.2,r*.15,.5,0,Math.PI*2);c.fill();c.beginPath();c.ellipse(-r*.5,r*.32,r*.14,r*.11,-.3,0,Math.PI*2);c.fill()}
 c.globalAlpha=.55;c.fillStyle=pal.blush;for(const s of [-1,1]){c.beginPath();c.ellipse(s*r*.55,r*.12,r*.15,r*.09,0,0,Math.PI*2);c.fill()}c.globalAlpha=1;
 const eye=pal.eye||'#3b2730',expr=o.expr||'normal';c.fillStyle=eye;c.strokeStyle=eye;c.lineWidth=Math.max(1,r*.08);c.lineCap='round';
 for(const s of [-1,1]){if(expr==='happy'){c.beginPath();c.arc(s*r*.3,-r*.14,r*.1,Math.PI*1.1,Math.PI*1.9);c.stroke()}else if(expr==='shock'){circle(c,s*r*.3,-r*.16,r*.11);c.fill()}else{circle(c,s*r*.3,-r*.16,r*.075);c.fill();if(pal.eyeHi){c.fillStyle=pal.eyeHi;circle(c,s*r*.3+r*.02,-r*.18,r*.025);c.fill();c.fillStyle=eye}}}
 c.fillStyle=pal.snout;c.strokeStyle=pal.line;c.lineWidth=Math.max(1,r*.05);c.beginPath();c.ellipse(0,r*.24,r*.34,r*.23,0,0,Math.PI*2);c.fill();c.stroke();
 c.fillStyle=pal.nostril||pal.line;for(const s of [-1,1]){c.beginPath();c.ellipse(s*r*.12,r*.24,r*.055,r*.09,0,0,Math.PI*2);c.fill()}
 if(expr==='shock'){c.fillStyle=pal.line;circle(c,0,r*.6,r*.07);c.fill()}
 c.restore();
}
function create(ui){
 const {$,Sound,Store,stats,record,message,result}=ui;
 let t=null,worker=null,workerBroken=false;
 const has=id=>Object.prototype.hasOwnProperty.call(configs,id);
 const active=()=>!!(t&&has(ui.get().game)&&ui.get().state===t);
 const local=()=>t.mode==='local';
 const P=()=>root.PigArt.PALETTES;
 function skins(){const me=root.PigLook&&P()[root.PigLook.active]?root.PigLook.active:'peach',rival=me==='darkchoc'?'whitechoc':'darkchoc';
  if(t.id==='chess'||t.id==='xiangqi')return {1:me==='darkchoc'?'peach':me,2:'darkchoc',me,rival};
  const human=local()?1:t.human;return {[human]:me,[3-human]:rival,me,rival}}
 const pal=p=>P()[skins()[p]];
 const flipped=()=>(t.id==='chess'||t.id==='xiangqi')&&!local()&&t.human===2;
 const disp=(x,y)=>flipped()?[t.g.W-1-x,t.g.H-1-y]:[x,y];
 function playerName(p){return local()?['一号猪手','二号猪手'][p-1]:p===t.human?'你':t.id==='chess'?'小黑 · Elo '+t.elo:AI_NAMES[t.mode]}
 function humanTurn(){if(!active()||ui.get().paused||t.m.status.over||t.clock<t.lockUntil||t.curtain||t.pick)return false;if(t.id==='battleship'&&local())return t.m.turn===t.viewer&&!t.handoff;return local()||t.m.turn===t.human}

 // ---------- 初始化与 DOM ----------
 function init(id){
  if(t)cancelAI();
  if(t&&t.timer)clearTimeout(t.timer);
  const mode=ui.get().level;
  t={boardGame:true,id,mode,human:id==='battleship'||mode==='local'?1:Store.get('board-side-'+id,1)===2?2:1,clock:0,fx:[],sel:null,hover:null,cursor:null,lockUntil:0,aiPending:false,aiReply:null,aiToken:null,aiJob:null,aiAt:0,finishAt:0,finished:false,horizontal:true,viewer:1,curtain:null,handoff:0,pick:null,dirty:true,portrait:false,exprs:{},resignArm:0,avatarKey:''};
  t.elo=root.PigStrongAI.normalizeChessElo(Store.get('board-elo-chess',root.PigStrongAI.chessElo.default));
  t.m=G.create(id,OPTIONS[id]?OPTIONS[id]():undefined);
  ui.setState(t);ui.setRunning(true);
  const card=p=>`<div class="bd-player" id="bd-p${p}"><div class="bd-ava" id="bd-ava${p}"></div><div class="bd-info"><b id="bd-name${p}"></b><small id="bd-side${p}"></small><span class="bd-tray" id="bd-tray${p}"></span></div><i class="bd-flag" id="bd-flag${p}"></i></div>`;
  $('board').innerHTML=`<div class="bd-shell bd-${id}"><div class="bd-match">${card(1)}<div class="bd-vs"><b>VS</b><small>${configs[id].name.replace('猪猪','')}</small></div>${card(2)}</div><div class="bd-stage" id="bd-stage"><canvas id="bd-canvas" tabindex="0" role="img" aria-label="${configs[id].name}棋盘：点击操作，方向键移动光标，回车确认"></canvas><div class="bd-pick" id="bd-pick" hidden></div></div><div class="bd-status" id="bd-status" role="status" aria-live="polite"></div></div>`;
  toolbar();
  t.cv=$('bd-canvas');t.c=t.cv.getContext('2d');
  t.cv.onpointerdown=pointerDown;t.cv.onpointermove=pointerMove;t.cv.onpointerleave=()=>{t.hover=null;t.dirty=true};
  t.cv.oncontextmenu=e=>{e.preventDefault();if(t.id==='battleship'&&placing())rotate()};
  refresh();resize();
  if(t.human===2&&!local())message('这局你后手（'+SIDES[id][1]+'），电脑先走'+(id==='xiangqi'||id==='chess'?'，棋盘已翻转，你的棋子在下方。':'。'));else message({xiangqi:'红方先走。点自己的棋子，再点亮起的落点。',chess:'白方先走。点棋子看看它能去哪儿。',gomoku:'点交叉点放下小猪，先连成五只就赢。',reversi:'下在小圆点上，夹住的小猪会翻成你的颜色。',battleship:'先布舰：点海面放下舰只，空格或右键旋转。',dots:'点两颗松露之间画栅栏，围住一格得一分。'}[id]);
  maybeAI();
 }
 function saveKey(){return 'board-save-'+t.id+'-'+t.mode}
 function toolbar(){
  const saved=Store.get(saveKey(),null),b=(id,label,title)=>`<button class="secondary" id="${id}"${title?' title="'+title+'"':''}>${label}</button>`;
  let html=b('bd-undo','悔棋','悔棋（U）')+b('bd-hint','提示','给我一个建议（H）');
  if(t.id==='battleship')html+=b('bd-rotate','旋转 · 横','切换横放 / 竖放（空格或右键）')+b('bd-random','随机布舰');
  else if(!local())html+=b('bd-side',t.human===1?'我先手 · '+SIDES[t.id][0]:'我后手 · '+SIDES[t.id][1],'切换先后手，重新开始');
  html+=b('bd-resign','认输');
  if(saved&&saved.save&&saved.save.actions&&saved.save.actions.length)html+='<button class="primary" id="bd-resume">接着上一局 · '+saved.save.actions.length+' 步</button>';
  if(t.id==='chess'&&!local()){const range=root.PigStrongAI.chessElo;html+=`<div class="bd-strength"><label for="bd-elo-number">目标Elo</label><input id="bd-elo-range" type="range" min="${range.min}" max="${range.max}" step="1" value="${t.elo}" aria-label="调整人机Elo" aria-describedby="bd-elo-note"><input id="bd-elo-number" type="number" inputmode="numeric" min="${range.min}" max="${range.max}" step="1" value="${t.elo}" aria-label="输入人机Elo" aria-describedby="bd-elo-note"><small id="bd-elo-note">${range.min}–${range.max} · 自动记住选择，电脑下一步和提示使用新等级。Elo为练习目标。</small></div>`}
  $('play-toolbar').innerHTML=html;
  $('bd-undo').onclick=undo;$('bd-hint').onclick=hint;$('bd-resign').onclick=resign;
  if($('bd-rotate')){$('bd-rotate').onclick=rotate;$('bd-random').onclick=randomFleet}
  if($('bd-side'))$('bd-side').onclick=()=>{Store.set('board-side-'+t.id,t.human===1?2:1);Sound.click();ui.nextLevel(t.mode)};
  if($('bd-resume'))$('bd-resume').onclick=resume;
  if($('bd-elo-range')){const slider=$('bd-elo-range'),number=$('bd-elo-number');slider.oninput=()=>{number.value=slider.value};slider.onchange=()=>setChessElo(slider.value);number.oninput=()=>{if(number.value!==''&&Number.isFinite(+number.value))slider.value=number.value};number.onchange=()=>setChessElo(number.value);number.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();number.blur()}}}
 }
 function setChessElo(value){
  if(!active()||t.id!=='chess'||local())return;
  const valid=String(value).trim()!==''&&Number.isFinite(+value),next=valid?root.PigStrongAI.normalizeChessElo(value):t.elo;
  $('bd-elo-range').value=$('bd-elo-number').value=String(next);
  if(!valid)return message('请输入支持范围内的Elo数字。','warn');
  Store.set('board-elo-chess',next);if(next===t.elo)return;
  t.elo=next;cancelAI();refresh();message('目标Elo已设为 '+next+'，电脑下一步和提示使用新等级。','ok');maybeAI();
 }
 function resume(){const saved=Store.get(saveKey(),null);if(!saved)return;try{const m=G.restore(saved.save);cancelAI();t.m=m;t.human=saved.human===2?2:1;t.fx=[];t.sel=null;t.finished=false;t.finishAt=0;t.viewer=t.m.turn;t.curtain=null;$('bd-resume').remove();refresh();resize();Sound.chessDrop(1);message('接着上一局，已经走了 '+t.m.actions.length+' 步。','ok');maybeAI()}catch(e){Store.set(saveKey(),null);$('bd-resume').remove();message('上一局的存档读不出来了，已经清掉。','warn')}}
 function persist(){if(t.m.status.over||!t.m.actions.length)Store.set(saveKey(),null);else Store.set(saveKey(),{save:t.m.save(),human:t.human,at:Date.now()})}

 // ---------- 局面刷新与面板 ----------
 function viewFor(){if(t.id!=='battleship')return t.m.view(1);if(!local())return t.m.view(1);return t.m.view(t.viewer)}
 function refresh(){t.view=viewFor();t.legal=t.m.status.over?[]:t.m.legalMoves(t.m.turn);t.dirty=true;panel()}
 function captured(p){// 从当前局面反推被吃掉的子，悔棋后自动正确。
  if(!START[t.id])return [];const left={};for(const row of t.view.board)for(const q of row)if(q&&q.player===3-p)left[q.type]=(left[q.type]||0)+1;// 升变出来的子多于开局数量时，相应少算被吃的兵。
  let promoted=0;for(const k of ORDER[t.id])if(k!=='p')promoted+=Math.max(0,(left[k]||0)-START[t.id][k]);left.p=(left.p||0)+promoted;
  const out=[];for(const k of ORDER[t.id])for(let i=(left[k]||0);i<START[t.id][k];i++)out.push(k);return out}
 function panel(){
  const v=t.view,st=t.m.status,turn=t.m.turn,sk=skins();
  for(const p of [1,2]){
   $('bd-name'+p).textContent=playerName(p);
   let side=SIDES[t.id][p-1];if(t.id==='reversi'||t.id==='dots')side+=' · '+v.scores[p-1]+(t.id==='dots'?' 格':' 只');
   if(t.id==='battleship'){const left=t.m.engine.ships[p-1].filter(s=>s.hits<s.length).length;side+=v.phase==='placement'?(v.players[p-1].ready?' · 布舰完毕':' · 布舰中'):' · 剩 '+left+' 艘'}
   $('bd-side'+p).textContent=side;
   const cap=captured(p);$('bd-tray'+p).innerHTML=cap.map(k=>t.id==='xiangqi'?'<i class="bd-cap xq p'+(3-p)+'">'+XQ[3-p][k]+'</i>':'<i class="bd-cap ch p'+(3-p)+'">'+CG[k]+'︎</i>').join('');
   const el=$('bd-p'+p);el.classList.toggle('current',!st.over&&turn===p);el.classList.toggle('thinking',t.aiPending&&turn===p);el.classList.toggle('winner',st.over&&st.winner===p);
   $('bd-flag'+p).textContent=st.over?(st.winner===p?'胜利':st.winner===0?'和棋':'结束'):turn===p?(t.aiPending?'思考中':'行动'):'等待';
  }
  const key=[sk[1],sk[2],t.exprs[1],t.exprs[2],st.winner,st.over].join(':');
  if(key!==t.avatarKey){t.avatarKey=key;for(const p of [1,2]){const expr=st.over?(st.winner===p?'happy':st.winner===0?'normal':'cry'):t.exprs[p]||'normal';$('bd-ava'+p).innerHTML=root.PigArt.inline({skin:sk[p],role:ROLES[t.id][p-1],expr,cls:'bd-avatar',viewBox:'0 -10 160 170'})}}
  const turnText=st.over?(st.winner===0?'和棋 · ':(playerName(st.winner)+'赢了 · '))+(REASONS[st.reason]||''):
   t.id==='battleship'&&v.phase==='placement'?(local()?playerName(turn)+'布舰：还剩 '+(v.fleet.length-t.m.engine.ships[turn-1].length)+' 艘':(turn===1?'布舰：下一艘 '+(v.fleet[t.m.engine.ships[0].length]||0)+' 格，'+(t.horizontal?'横放':'竖放'):'对手正在布舰……')):
   (t.aiPending?playerName(turn)+'正在想……':(local()?playerName(turn)+'（'+SIDES[t.id][turn-1]+'）行动':turn===t.human?'轮到你了':'等待对手'))+(st.check?' · 将军！':'');
  $('bd-status').textContent=turnText;$('bd-status').classList.toggle('alert',!!st.check&&!st.over);
  let s2='';
  if(START[t.id])s2=captured(1).length+' : '+captured(2).length;
  else if(t.id==='gomoku')s2=st.over?'—':playerName(turn);
  else if(t.id==='reversi'||t.id==='dots')s2=v.scores[0]+' : '+v.scores[1];
  else if(t.id==='battleship'){const e=t.m.engine;s2=e.ships[0].filter(s=>s.hits<s.length).length+' : '+e.ships[1].filter(s=>s.hits<s.length).length}
  const moves=t.id==='battleship'?t.m.actions.filter(a=>a.move.type==='fire').length:t.m.actions.filter(a=>a.move.type!=='resign').length;
  stats(moves,s2);
  if($('bd-rotate')){$('bd-rotate').textContent='旋转 · '+(t.horizontal?'横':'竖');$('bd-rotate').disabled=$('bd-random').disabled=!placing()}
  if($('bd-undo'))$('bd-undo').disabled=!t.m.actions.length||(t.id==='battleship'&&v.phase==='battle');
 }
 function setExpr(p,expr,ms){t.exprs[p]=expr;panel();clearTimeout(t['exprTimer'+p]);t['exprTimer'+p]=setTimeout(()=>{if(t&&t.exprs){t.exprs[p]='normal';if(active())panel()}},ms||1600)}

 // ---------- 几何 ----------
 function layout(){
  const id=t.id,v=t.view;let g;
  if(id==='xiangqi')g={VW:580,VH:640,S:60,ox:50,oy:50,W:9,H:10};
  else if(id==='chess')g={VW:612,VH:606,S:70,ox:36,oy:14,W:8,H:8};
  else if(id==='gomoku')g={VW:(v.size-1)*40+80,VH:(v.size-1)*40+80,S:40,ox:40,oy:40,W:v.size,H:v.size};
  else if(id==='reversi')g={VW:608,VH:608,S:70,ox:24,oy:24,W:8,H:8};
  else if(id==='dots')g={VW:v.width*100+100,VH:v.height*100+100,S:100,ox:50,oy:50,W:v.width,H:v.height};
  else{const n=v.size,B=44,s=26;g=t.portrait?{VW:530,VH:64+n*B+64+n*s+28,big:{x:45,y:64,S:B},small:{x:45,y:64+n*B+64,S:s},list:{x:45+n*s+28,y:64+n*B+64},W:n,H:n}:{VW:880,VH:64+n*B+40,big:{x:40,y:64,S:B},small:{x:40+n*B+60,y:96,S:s},list:{x:40+n*B+60,y:96+n*s+40},W:n,H:n}}
  t.g=g;
 }
 function resize(){
  if(!active())return;const width=Math.max(240,$('board').getBoundingClientRect().width);
  if(t.id==='battleship'){const p=width<700;if(p!==t.portrait||!t.g){t.portrait=p}}
  layout();const g=t.g,maxH=Math.max(440,root.innerHeight-110);
  const scale=Math.min(width/g.VW,maxH/g.VH,1.05),dpr=Math.min(2,root.devicePixelRatio||1);
  t.cv.width=Math.round(g.VW*scale*dpr);t.cv.height=Math.round(g.VH*scale*dpr);t.cv.style.width=Math.round(g.VW*scale)+'px';t.cv.style.height=Math.round(g.VH*scale)+'px';
  t.c.setTransform(t.cv.width/g.VW,0,0,t.cv.height/g.VH,0,0);t.dirty=true;draw();
 }
 function world(e){const r=t.cv.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*t.g.VW,y:(e.clientY-r.top)/r.height*t.g.VH}}
 // 交叉点类（象棋、五子棋）与格子类（国际象棋、黑白棋）的屏幕坐标，均已考虑翻转。
 function pos(x,y){const g=t.g,[dx,dy]=disp(x,y);return t.id==='xiangqi'||t.id==='gomoku'?{x:g.ox+dx*g.S,y:g.oy+dy*g.S}:{x:g.ox+(dx+.5)*g.S,y:g.oy+(dy+.5)*g.S}}
 function cellAt(p){const g=t.g;let dx,dy;if(t.id==='xiangqi'||t.id==='gomoku'){dx=Math.round((p.x-g.ox)/g.S);dy=Math.round((p.y-g.oy)/g.S);if(Math.hypot(p.x-g.ox-dx*g.S,p.y-g.oy-dy*g.S)>g.S*.5)return null}else{dx=Math.floor((p.x-g.ox)/g.S);dy=Math.floor((p.y-g.oy)/g.S)}if(dx<0||dy<0||dx>=g.W||dy>=g.H)return null;const [x,y]=disp(dx,dy);return {x,y}}
 const sqName=(x,y)=>t.id==='chess'?'abcdefgh'[x]+(8-y):'abcdefghi'[x]+(9-y);
 const sqXY=s=>t.id==='chess'?{x:s.charCodeAt(0)-97,y:8-Number(s[1])}:{x:s.charCodeAt(0)-97,y:9-Number(s[1])};
 function edgeAt(p){const g=t.g,v=t.view;let best=null,dist=g.S*.28;
  const test=(o,x,y,ax,ay,bx,by)=>{const vx=bx-ax,vy=by-ay,k=clamp(((p.x-ax)*vx+(p.y-ay)*vy)/(vx*vx+vy*vy),.12,.88),d=Math.hypot(p.x-ax-vx*k,p.y-ay-vy*k);if(d<dist){dist=d;best={orientation:o,x,y}}};
  for(let y=0;y<=v.height;y++)for(let x=0;x<v.width;x++)test('h',x,y,g.ox+x*g.S,g.oy+y*g.S,g.ox+(x+1)*g.S,g.oy+y*g.S);
  for(let y=0;y<v.height;y++)for(let x=0;x<=v.width;x++)test('v',x,y,g.ox+x*g.S,g.oy+y*g.S,g.ox+x*g.S,g.oy+(y+1)*g.S);
  return best}
 function edgeTaken(e){const v=t.view;return e.orientation==='h'?v.h[e.y*v.width+e.x]:v.v[e.y*(v.width+1)+e.x]}
 function placing(){return t.id==='battleship'&&t.view.phase==='placement'}
 function seaCell(p,b){const n=t.g.W,x=Math.floor((p.x-b.x)/b.S),y=Math.floor((p.y-b.y)/b.S);return x>=0&&y>=0&&x<n&&y<n?{x,y}:null}
 function boards(){return placing()?{own:t.g.big,target:t.g.small}:{own:t.g.small,target:t.g.big}}

 // ---------- 输入 ----------
 function pointerMove(e){if(!active())return;const p=world(e);let h=null;
  if(t.id==='dots')h=edgeAt(p);else if(t.id==='battleship'){const b=boards();h=placing()?seaCell(p,b.own):seaCell(p,b.target)}else h=cellAt(p);
  if(JSON.stringify(h)!==JSON.stringify(t.hover)){t.hover=h;t.dirty=true}
  t.cv.style.cursor=h&&humanTurn()?'pointer':'default'}
 function pointerDown(e){
  if(!active()||e.button>0||!e.isPrimary)return;
  if(t.curtain){e.preventDefault();t.curtain=null;t.viewer=t.m.turn;refresh();Sound.click();message(playerName(t.viewer)+'，'+(placing()?'请布舰，别让对方偷看。':'选一格开炮！'));return}
  if(ui.get().paused)return;
  const p=world(e);t.cv.focus({preventScroll:true});
  if(t.id==='dots'){const h=edgeAt(p);if(h)act(h);return}
  if(t.id==='battleship'){const b=boards();if(placing()){const c=seaCell(p,b.own);if(c)act({type:'place',x:c.x,y:c.y,horizontal:t.horizontal})}else{const c=seaCell(p,b.target);if(c)act({type:'fire',x:c.x,y:c.y})}return}
  const c=cellAt(p);if(c)clickCell(c);
 }
 function clickCell(c){
  if(!humanTurn())return notYet();
  if(t.id==='gomoku'||t.id==='reversi'){act({x:c.x,y:c.y});return}
  const name=sqName(c.x,c.y),piece=t.view.board[c.y][c.x];
  if(t.sel){const list=t.legal.filter(m=>m.from===t.sel&&m.to===name);
   if(list.length>1){openPick(list);return}if(list.length===1){act(list[0]);return}}
  if(piece&&piece.player===t.m.turn&&t.legal.some(m=>m.from===name)){t.sel=t.sel===name?null:name;Sound.click();t.dirty=true;return}
  if(piece&&piece.player===t.m.turn){t.sel=null;t.dirty=true;message('这枚棋子现在没有地方可以走。','warn');return}
  if(t.sel){t.sel=null;t.dirty=true;message('那里走不到，换个亮点试试。','warn')}
 }
 function notYet(){if(!active()||t.m.status.over)return;if(t.aiPending)message('对手还在想，稍等一下。');}
 function openPick(list){const piece=t.view.board[sqXY(list[0].from).y][sqXY(list[0].from).x],box=$('bd-pick');t.pick=list;
  box.innerHTML='<b>兵变成：</b>'+PROMO.map(([k,n])=>`<button data-promo="${k}"><span class="bd-pick-glyph p${piece.player}">${CG[k]}︎</span>${n}</button>`).join('')+'<button class="bd-pick-cancel" data-promo="">取消</button>';box.hidden=false;
  box.querySelectorAll('button').forEach(b=>b.onclick=()=>{const k=b.dataset.promo,list2=t.pick;t.pick=null;box.hidden=true;if(!k){t.sel=null;t.dirty=true;return}const m=list2.find(x=>x.promotion===k);if(m)act(m)});box.querySelector('button').focus()}
 function rotate(){if(!placing())return;t.horizontal=!t.horizontal;Sound.click();panel();t.dirty=true}
 function randomFleet(){if(!placing()||!humanTurn())return;act({type:'auto-place'})}
 function act(move){
  if(!humanTurn())return notYet();
  if(t.id==='dots'&&edgeTaken(move))return message('这条栅栏已经画好了。','warn');
  if(t.id==='battleship'&&move.type==='fire'&&t.view.target[move.y*t.view.size+move.x])return message('这里已经打过了，换一格。','warn');
  const actor=t.m.turn,before=t.view,res=t.m.dispatch(actor,move);
  if(!res.ok){Sound.miss();return message({gomoku:'这里已经有小猪了。',reversi:'这里夹不住对方的小猪，换个小圆点。',battleship:'这里放不下，换个位置或旋转一下。',dots:'这条栅栏画不了。'}[t.id]||'这一步不合规则。','warn')}
  after(res.event,actor,before);
 }

 // ---------- 行动之后：动画、声音、文字 ----------
 function fx(o){o.at=o.at===undefined?t.clock:o.at;t.fx.push(o);t.lockUntil=Math.max(t.lockUntil,o.at+(o.lock===false?0:o.dur*(o.lockShare||1)));return o}
 function burst(x,y,color,n,at,spread){const parts=[];for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=(.4+Math.random())*(spread||1);parts.push({vx:Math.cos(a)*s,vy:Math.sin(a)*s-.25,r:2+Math.random()*3})}fx({k:'burst',x,y,color,parts,at,dur:620,lock:false})}
 function banner(text,color,at){fx({k:'banner',text,color:color||'#b6476a',at,dur:1300,lock:false})}
 function floatText(text,x,y,color,at){fx({k:'float',text,x,y,color:color||'#b6476a',at,dur:900,lock:false})}
 function after(ev,actor,before){
  t.hintPending=false;
  t.sel=null;t.hover=t.id==='battleship'?t.hover:null;
  const speed=reduce()?.35:1,now=t.clock;
  if(ev.type==='resign'){Sound.pigWhimper&&Sound.pigWhimper();banner(playerName(actor)+'认输了','#7d6a64')}
  else if(t.id==='xiangqi'||t.id==='chess')animateMove(ev,actor,before,speed);
  else if(t.id==='gomoku'){const p=pos(ev.x,ev.y);fx({k:'drop',x:ev.x,y:ev.y,dur:300*speed});fx({k:'ring',x:p.x,y:p.y,r:t.g.S*.5,color:pal(actor).ear,dur:520*speed,lock:false});Sound.chessDrop(actor);
   if(ev.line&&ev.line.length&&ev.status.over){fx({k:'line',line:ev.line,player:actor,at:now+260*speed,dur:900,lock:false});Sound.later(300,()=>Sound.pigCheer&&Sound.pigCheer());banner('五猪连珠！',pal(actor).line,now+300*speed)}}
  else if(t.id==='reversi')animateReversi(ev,actor,speed);
  else if(t.id==='dots')animateDots(ev,actor,speed);
  else animateSea(ev,actor,before,speed);
  t.finished=false;if($('bd-resume'))$('bd-resume').remove();refresh();persist();
  if(t.m.status.over)t.finishAt=Math.max(t.lockUntil,now)+700*speed;else maybeAI();
  if(t.id==='battleship'&&local()&&!t.m.status.over&&t.m.turn!==actor){t.handoff=t.lockUntil+(ev.type==='fire'?1100:300)}
 }
 function animateMove(ev,actor,before,speed){
  const from=sqXY(ev.from),to=sqXY(ev.to),piece=before.board[from.y][from.x],dur=300*speed,now=t.clock;
  fx({k:'slide',from,to,piece,dur});
  if(t.id==='chess'&&ev.flags&&/[kq]/.test(ev.flags)){const y=to.y,r=ev.flags.includes('k')?{a:7,b:5}:{a:0,b:3};fx({k:'slide',from:{x:r.a,y},to:{x:r.b,y},piece:before.board[y][r.a],dur:dur*1.1})}
  if(ev.captured){let cx=to.x,cy=to.y;if(t.id==='chess'&&ev.flags&&ev.flags.includes('e'))cy=from.y;const cp=before.board[cy][cx]||{type:ev.captured,player:3-actor},p=pos(cx,cy);
   fx({k:'poof',x:cx,y:cy,piece:cp,at:now+dur*.82,dur:520*speed,lock:false});burst(p.x,p.y,t.id==='xiangqi'?'#e9c38c':'#f2c6d2',14,now+dur*.82);
   Sound.later(dur*.8,()=>{Sound.boom({gain:.5});Sound.pigYelp&&Sound.pigYelp()});setExpr(actor,'smug');setExpr(3-actor,'shock')}
  else Sound.later(dur*.85,()=>Sound.chessDrop(actor));
  const p=pos(to.x,to.y);fx({k:'ring',x:p.x,y:p.y,r:t.g.S*.42,color:'rgba(120,80,40,.5)',at:now+dur,dur:380*speed,lock:false});
  if(ev.promotion){burst(p.x,p.y,'#ffd66e',22,now+dur);Sound.later(dur,()=>Sound.hintSpark());floatText('升变！',p.x,p.y-30,'#c48a12',now+dur)}
  if(ev.status.over&&ev.status.reason==='checkmate'){banner(t.id==='xiangqi'?'绝杀！':'将死！','#c43d3d',now+dur);t.shake=8}
  else if(ev.status.check){banner(t.id==='xiangqi'?'将军！':'将军！Check','#d2453f',now+dur);Sound.later(dur,()=>Sound.pigSqueal&&Sound.pigSqueal());t.shakeAt=now+dur;setExpr(3-actor,'shock',1800)}
 }
 function animateReversi(ev,actor,speed){
  const now=t.clock,d=280*speed;fx({k:'drop',x:ev.x,y:ev.y,dur:260*speed});Sound.chessDrop(actor);
  ev.flipped.forEach(c=>{const dist=Math.max(Math.abs(c.x-ev.x),Math.abs(c.y-ev.y));fx({k:'flip',x:c.x,y:c.y,from:3-actor,to:actor,at:now+120*speed+dist*90*speed,dur:d});Sound.later(120*speed+dist*90*speed,()=>Sound.flip())});
  const center=pos(ev.x,ev.y);if(ev.flipped.length>=4){floatText('翻 '+ev.flipped.length+' 只！',center.x,center.y-28,pal(actor).line,now+200*speed);if(ev.flipped.length>=6)setExpr(actor,'happy')}
  if((ev.x===0||ev.x===7)&&(ev.y===0||ev.y===7)){banner('抢到角啦！',pal(actor).line,now+150*speed)}
  if(ev.passedPlayer&&!ev.status.over){banner(playerName(ev.passedPlayer)+'无处可下，跳过','#5f7d6a',t.lockUntil);Sound.later(400,()=>Sound.oops&&Sound.oops())}
 }
 function animateDots(ev,actor,speed){
  const now=t.clock,d=220*speed;fx({k:'edge',e:ev,player:actor,dur:d});Sound.chessDrop(actor);
  ev.captured.forEach((b,i)=>{const g=t.g,x=g.ox+(b.x+.5)*g.S,y=g.oy+(b.y+.5)*g.S;fx({k:'box',x:b.x,y:b.y,player:actor,at:now+d+i*120,dur:460*speed});floatText('+1',x,y-26,pal(actor).line,now+d+i*120);burst(x,y,pal(actor).ear,10,now+d+i*120);Sound.later(d+i*120,()=>{Sound.pop();Sound.pigOink&&Sound.pigOink()})});
  if(ev.captured.length&&!ev.status.over){setExpr(actor,'happy',1200);message(playerName(actor)+'围住了 '+ev.captured.length+' 格，'+(local()||actor===t.human?'再画一条！':'对手再画一条。'),'ok')}
 }
 function animateSea(ev,actor,before,speed){
  const now=t.clock;
  if(ev.type==='placement'){if(local()||actor===t.human){const b=t.g.big;ev.cells.forEach((c,i)=>{fx({k:'splash',x:b.x+(c.x+.5)*b.S,y:b.y+(c.y+.5)*b.S,r:b.S*.5,at:now+i*40,dur:420*speed,lock:false})});Sound.rlPlop?Sound.rlPlop():Sound.pop();if(ev.ready){Sound.later(200,()=>Sound.hintSpark());banner(local()?playerName(actor)+'布舰完毕':'舰队就位！','#2f6f9e',now+200);if(!local())message('开战！点左边（或上方）的敌方海域开炮。','ok')}}return}
  // 开炮：炮弹从本方一侧飞出，落点后水花 / 火焰 / 沉没。
  const mine=local()?actor===t.viewer:actor===t.human,b=mine?t.g.big:t.g.small,S=b.S,x=b.x+(ev.x+.5)*S,y=b.y+(ev.y+.5)*S,n=t.g.W,fly=(mine?420:340)*speed,land=now+fly;
  const sx=mine?b.x+n*S/2:b.x+n*S*.5,sy=mine?b.y+n*S+40:b.y-30;
  fx({k:'shell',x0:sx,y0:sy,x,y,dur:fly});Sound.rlWhoosh?Sound.rlWhoosh():Sound.flip();
  if(ev.hit){fx({k:'blast',x,y,r:S*.9,at:land,dur:520*speed,lock:false});burst(x,y,'#ff9b3d',mine?18:10,land,mine?1.2:.8);Sound.later(fly,()=>Sound.boom({big:!!ev.sunk,gain:.7}))}
  else{fx({k:'splash',x,y,r:S*.62,at:land,dur:560*speed,lock:false});burst(x,y,'#ffffff',mine?12:7,land,.7);Sound.later(fly,()=>Sound.rlSplat?Sound.rlSplat(false):Sound.miss())}
  if(ev.sunk){fx({k:'sunk',cells:ev.sunk,board:mine?'big':'small',at:land+120,dur:900*speed,lock:false});banner((mine?'击沉':'我方被击沉')+' '+ev.sunk.length+' 格舰！',mine?'#c4513d':'#4c6a8a',land+120);Sound.later(fly+150,()=>Sound.pigWail?Sound.pigWail():Sound.crash());setExpr(actor,'happy');setExpr(3-actor,'cry',2000);if(mine)t.shake=6}
  else if(ev.hit){floatText('命中！',x,y-S*.7,'#c4513d',land);setExpr(3-actor,'shock')}
  else floatText('落空',x,y-S*.6,'#3f6f96',land);
  const cell='ABCDEFGHIJKL'[ev.x]+(ev.y+1),who=mine?'':(local()?playerName(actor):'对手')+'打在我方 ';
  message(who+cell+'：'+(ev.sunk?'击沉 '+ev.sunk.length+' 格舰！':ev.hit?'命中！'+(mine?'沿上下左右接着找。':''):'落空。'),mine&&ev.hit?'ok':'');
  t.lockUntil=Math.max(t.lockUntil,land+260*speed);
 }

 // ---------- 电脑对手 ----------
 function getWorker(){if(workerBroken)return null;if(worker)return worker;try{worker=G.createWorker('board-worker.js');worker.onmessage=e=>{const d=e.data;if(!t||!t.aiPending||d.token!==t.aiToken)return;t.aiReply=d.ok?d:{fallback:true}};worker.onerror=e=>{if(e&&e.preventDefault)e.preventDefault();workerBroken=true;try{worker.terminate()}catch(err){}worker=null;if(t&&t.aiPending&&t.aiJob&&!t.aiReply)solveLater(t.aiJob)}}catch(e){workerBroken=true;worker=null}return worker}
 function solveLater(job){setTimeout(()=>{if(!t||t.aiToken!==job.token)return;try{t.aiReply=G.solveJob(job)}catch(e){t.aiReply={fallback:true}}},16)}
 function cancelAI(){if(root.PigStrongAI)root.PigStrongAI.cancel();if(!t)return;t.aiPending=false;t.aiReply=null;t.aiToken=null;t.aiJob=null;t.hintPending=false;t.hintTicket=null}
 function maybeAI(){
  if(!t||local()||t.m.status.over||t.m.turn===t.human||t.aiPending)return;
  t.aiPending=true;t.aiAt=t.clock;t.aiReply=null;panel();
  const job=t.m.aiJob({level:t.mode,maxMs:{easy:600,normal:1600,hard:3200}[t.mode],elo:t.id==='chess'?t.elo:undefined,seed:Math.floor(Math.random()*4294967296)});t.aiToken=job.token;t.aiJob=job;
  if(root.PigStrongAI&&root.PigStrongAI.supports(t.m)){const state=t;root.PigStrongAI.think(t.m,job.options).then(reply=>{if(t===state&&t.aiPending&&t.aiJob===job&&t.aiToken===job.token)t.aiReply=reply}).catch(error=>{if(t!==state||!t.aiPending||t.aiJob!==job||t.aiToken!==job.token)return;t.aiReply={fallback:true};if(!t.engineWarned){t.engineWarned=true;message(t.id==='chess'?'本次使用兼容对手，所选Elo未生效。':'强引擎未能完成，正在使用兼容对手。','warn')}if(root.console)root.console.warn('Strong AI:',error.message)});return}
  const w=getWorker();if(w){try{w.postMessage(job)}catch(e){workerBroken=true;solveLater(job)}}else solveLater(job);
 }
 function runAI(){
  const reply=t.aiReply,actor=t.m.turn,before=t.view;t.aiPending=false;t.aiReply=null;
  let res;
  if(reply.fallback){try{res=t.m.applyAI(t.m.suggest({level:t.mode,maxMs:500}))}catch(e){res={ok:false}}}
  else res=t.m.applyAI(reply);
  t.aiToken=null;t.aiJob=null;
  if(!res||!res.ok){try{res=t.m.applyAI(t.m.suggest({level:t.mode,maxMs:500}))}catch(e){}if(!res||!res.ok){panel();maybeAI();return}}
  after(res.event,actor,before);
 }

 // ---------- 工具栏动作 ----------
 function undo(){
  if(!active())return;if(t.id==='battleship'&&t.view.phase==='battle')return message('开炮以后就不能悔棋了，不然会偷看到结果。','warn');
  if(!t.m.actions.length)return message('还没有可以悔的棋。','warn');
  cancelAI();let n=0;
  if(local()){if(t.m.undo())n=1}
  else while(t.m.actions.length){const a=t.m.actions[t.m.actions.length-1];t.m.undo();n++;if(a.player===t.human&&t.m.turn===t.human)break}
  t.fx=[];t.lockUntil=t.clock;t.finishAt=0;t.finished=false;t.sel=null;t.pick=null;$('bd-pick').hidden=true;$('result').hidden=true;ui.setRunning(true);
  if(t.id==='battleship'&&local())t.viewer=t.m.turn;
  refresh();persist();Sound.undo();message('悔了一步'+(n>1?'（连同对手那步）':'')+'，再想想。');maybeAI();
 }
 function hint(){
  if(!humanTurn())return notYet();
  if(t.hintPending)return;
  if(t.id==='battleship'){if(placing())return randomFleet();const s=BS.chooseShot(t.m.view(t.m.turn),{level:'hard'});if(!s)return;const b=t.g.big;fx({k:'hint',x:b.x+(s.x+.5)*b.S,y:b.y+(s.y+.5)*b.S,r:b.S*.5,dur:1400,lock:false});Sound.hintSpark();return message('亮圈处命中的可能最大。')}
  if(root.PigStrongAI&&root.PigStrongAI.supports(t.m)){const state=t,token=t.m.token(),ticket={};t.hintPending=true;t.hintTicket=ticket;message('正在想提示……');root.PigStrongAI.think(t.m,{level:'hard',maxMs:1600,elo:t.id==='chess'?t.elo:undefined}).then(reply=>{if(t!==state||t.hintTicket!==ticket||t.m.token()!==token)return;t.hintPending=false;t.hintTicket=null;showHint(reply)}).catch(()=>{if(t!==state||t.hintTicket!==ticket||t.m.token()!==token)return;t.hintPending=false;t.hintTicket=null;try{showHint(t.m.suggest({level:'hard',maxMs:500}));if(t.id==='chess')message('本次提示使用兼容策略，所选Elo未生效。','warn')}catch(e){}});return}
  let s;try{s=t.m.suggest({level:'hard',maxMs:800})}catch(e){return}
  showHint(s);
 }
 function showHint(s){
  if(!s||!s.move)return;const m=s.move;Sound.hintSpark();
  if(m.from){const a=sqXY(m.from),b=sqXY(m.to),pa=pos(a.x,a.y),pb=pos(b.x,b.y);fx({k:'hint',x:pa.x,y:pa.y,r:t.g.S*.45,dur:1400,lock:false});fx({k:'hint',x:pb.x,y:pb.y,r:t.g.S*.45,dur:1400,lock:false,arrow:pa});t.sel=m.from;t.dirty=true;message('建议：走亮圈里的这步。已经帮你选中了棋子。')}
  else if(m.orientation){const g=t.g,x=g.ox+(m.x+(m.orientation==='h'?.5:0))*g.S,y=g.oy+(m.y+(m.orientation==='v'?.5:0))*g.S;fx({k:'hint',x,y,r:g.S*.3,dur:1400,lock:false});message('建议画亮圈里的这条栅栏。')}
  else{const p=pos(m.x,m.y);fx({k:'hint',x:p.x,y:p.y,r:t.g.S*.5,dur:1400,lock:false});message('建议下在亮圈这里。')}
 }
 function resign(){
  if(!active()||t.m.status.over)return;if(!local()&&t.m.turn!==t.human)return message('等轮到你时才能认输。','warn');
  const btn=$('bd-resign');if(t.clock>t.resignArm){t.resignArm=t.clock+3000;btn.textContent='确定认输？';btn.classList.add('danger');setTimeout(()=>{if(btn.isConnected){btn.textContent='认输';btn.classList.remove('danger')}},3000);return}
  t.resignArm=0;btn.textContent='认输';btn.classList.remove('danger');cancelAI();const actor=t.m.turn,res=t.m.dispatch(actor,{type:'resign'});if(res.ok)after(res.event,actor,t.view);
 }
 function finish(){
  if(t.finished)return;t.finished=true;const st=t.m.status,why=REASONS[st.reason]||'';
  if(local()){Sound.win();if(st.winner)ui.confetti(30);result(st.winner?playerName(st.winner)+'（'+SIDES[t.id][st.winner-1]+'）获胜！':'握手言和！',why+'。共 '+t.m.actions.length+' 步。'+(t.id==='reversi'||t.id==='dots'?' 比分 '+t.view.scores[0]+' : '+t.view.scores[1]+'。':''),true);return}
  const win=st.winner===t.human,draw=st.winner===0;
  if(win){const k='board-wins-'+t.id+'-'+t.mode,n=Store.get(k,0)+1;Store.set(k,n);record(n);Sound.win();ui.confetti(36)}else if(draw)Sound.chord();else Sound.lose();
  panel();
  const score=t.id==='reversi'||t.id==='dots'?' 比分 '+t.view.scores[t.human-1]+' : '+t.view.scores[2-t.human]+'。':'';
  if(!win&&!draw&&st.reason==='resignation')return result('这局先认输，下次再战！','对手：'+AI_NAMES[t.mode]+'。共走了 '+t.m.actions.filter(a=>a.move.type!=='resign').length+' 步，可以点“悔棋”撤回认输接着下。',false);
  result(win?{xiangqi:'绝杀！红旗插上对岸。',chess:'将死！小猪骑士胜利。',gomoku:'五猪连珠，你赢啦！',reversi:'满盘都是你的猪！',battleship:'敌方舰队全军覆没！',dots:'围栏大王就是你！'}[t.id]:draw?'和棋，下次再分高下。':{xiangqi:'这局被黑猪将住了。',chess:'国王被困住了……',gomoku:'被对面抢先连成五只。',reversi:'这局黑猪更多一点。',battleship:'我方舰队沉没了……',dots:'对面圈到的猪更多。'}[t.id],why+'。'+score+(win?'（'+configs[t.id].levels.find(l=>l[0]===t.mode)[1]+'）':'可以点“悔棋”回到上一步再试。'),win||draw);
 }

 // ---------- 绘制 ----------
 function drawWood(c,x,y,w,h,r,c1,c2){const g=c.createLinearGradient(x,y,x+w,y+h);g.addColorStop(0,c1);g.addColorStop(1,c2);c.fillStyle=g;rr(c,x,y,w,h,r);c.fill();c.save();rr(c,x,y,w,h,r);c.clip();c.globalAlpha=.07;c.strokeStyle='#5a3416';c.lineWidth=2;for(let i=0;i<14;i++){c.beginPath();const yy=y+h*(i+.5)/14;c.moveTo(x,yy);c.bezierCurveTo(x+w*.3,yy+8*Math.sin(i),x+w*.6,yy-8*Math.cos(i*1.7),x+w,yy+4);c.stroke()}c.restore()}
 function sliding(){const hide=new Set();for(const f of t.fx)if(f.k==='slide'&&t.clock<f.at+f.dur)hide.add(f.to.x+','+f.to.y);return hide}
 function xqPiece(c,x,y,r,piece,lift){
  lift=lift||0;const red=piece.player===1,ink=red?'#c3312c':'#2f2a28';
  c.save();c.fillStyle='rgba(60,30,10,'+(.3-lift/r*.08)+')';c.beginPath();c.ellipse(x+2,y+r*.16,r*1.02+lift*.15,r*.92,0,0,Math.PI*2);c.fill();
  c.translate(x,y-lift);const ep=pal(piece.player);c.fillStyle=ep.ear;c.strokeStyle='#8a5a2e';c.lineWidth=1.4;
  for(const s of [-1,1]){c.beginPath();c.moveTo(s*r*.78,-r*.5);c.quadraticCurveTo(s*r*1.02,-r*1.12,s*r*.3,-r*.9);c.closePath();c.fill();c.stroke()}
  const g=c.createRadialGradient(-r*.3,-r*.35,r*.1,0,0,r);g.addColorStop(0,'#fff6e2');g.addColorStop(.7,'#f1d5a2');g.addColorStop(1,'#d9ae6e');
  c.fillStyle='#b9874c';circle(c,0,r*.08,r);c.fill();c.fillStyle=g;circle(c,0,0,r);c.fill();c.strokeStyle='#9a6a3a';c.lineWidth=r*.06;c.stroke();
  c.strokeStyle=ink;c.lineWidth=r*.05;circle(c,0,0,r*.8);c.stroke();
  c.fillStyle=ink;c.font='bold '+Math.round(r*1.05)+'px '+KAI;c.textAlign='center';c.textBaseline='middle';c.fillText(XQ[piece.player][piece.type],0,r*.05);
  c.restore();
 }
 function chessPiece(c,x,y,S,piece,lift){
  lift=lift||0;const pp=pal(piece.player);c.save();c.fillStyle='rgba(60,30,30,.22)';c.beginPath();c.ellipse(x,y+S*.3,S*.28+lift*.1,S*.08,0,0,Math.PI*2);c.fill();
  c.font=Math.round(S*.78)+'px '+CHESS_FONT;c.textAlign='center';c.textBaseline='middle';const ch=CG[piece.type]+'︎',yy=y-lift+S*.02;
  c.lineJoin='round';c.lineWidth=S*.09;c.strokeStyle=piece.player===1?pp.line:'#f6e7d8';c.strokeText(ch,x,yy);c.fillStyle=piece.player===1?pp.body:pp.body;c.fillText(ch,x,yy);
  // 小猪鼻子贴在棋子身上，一眼看出是猪猪棋。
  c.fillStyle=pp.snout;c.strokeStyle=piece.player===1?pp.line:'#f6e7d8';c.lineWidth=1.3;c.beginPath();c.ellipse(x,yy+S*.17,S*.08,S*.055,0,0,Math.PI*2);c.fill();c.stroke();c.fillStyle=pp.nostril||pp.line;circle(c,x-S*.028,yy+S*.17,S*.014);c.fill();circle(c,x+S*.028,yy+S*.17,S*.014);c.fill();
  c.restore();
 }
 function drawPiece(c,x,y,piece,lift){if(t.id==='xiangqi')xqPiece(c,x,y,t.g.S*.43,piece,lift);else chessPiece(c,x,y,t.g.S,piece,lift)}
 function drawXiangqi(c){
  const g=t.g,S=g.S,ox=g.ox,oy=g.oy;drawWood(c,6,6,g.VW-12,g.VH-12,20,'#f7dfad','#e7bd7f');
  c.strokeStyle='#7a4f27';c.lineWidth=3.5;c.strokeRect(ox-8,oy-8,8*S+16,9*S+16);c.lineWidth=1.6;
  c.beginPath();for(let y=0;y<10;y++){c.moveTo(ox,oy+y*S);c.lineTo(ox+8*S,oy+y*S)}for(let x=0;x<9;x++){if(x===0||x===8){c.moveTo(ox+x*S,oy);c.lineTo(ox+x*S,oy+9*S)}else{c.moveTo(ox+x*S,oy);c.lineTo(ox+x*S,oy+4*S);c.moveTo(ox+x*S,oy+5*S);c.lineTo(ox+x*S,oy+9*S)}}
  for(const y0 of [0,7]){c.moveTo(ox+3*S,oy+y0*S);c.lineTo(ox+5*S,oy+(y0+2)*S);c.moveTo(ox+5*S,oy+y0*S);c.lineTo(ox+3*S,oy+(y0+2)*S)}c.stroke();
  const mark=(x,y)=>{const px=ox+x*S,py=oy+y*S,a=5,b=13;c.beginPath();for(const sx of [-1,1])for(const sy of [-1,1]){if((x===0&&sx<0)||(x===8&&sx>0))continue;c.moveTo(px+sx*a,py+sy*b);c.lineTo(px+sx*a,py+sy*a);c.lineTo(px+sx*b,py+sy*a)}c.stroke()};
  c.lineWidth=1.3;[[1,2],[7,2],[1,7],[7,7],[0,3],[2,3],[4,3],[6,3],[8,3],[0,6],[2,6],[4,6],[6,6],[8,6]].forEach(([x,y])=>mark(x,y));
  c.fillStyle='rgba(122,79,39,.62)';c.font='30px '+KAI;c.textAlign='center';c.textBaseline='middle';c.fillText('楚　河',ox+2*S,oy+4.5*S);c.fillText('漢　界',ox+6*S,oy+4.5*S);
  c.font='14px '+KAI;c.fillStyle='rgba(122,79,39,.45)';c.fillText('猪 猪 象 棋',ox+4*S,oy+4.5*S);
  boardOverlays(c);piecesLayer(c);
 }
 function drawChess(c){
  const g=t.g,S=g.S,ox=g.ox,oy=g.oy;drawWood(c,4,4,g.VW-8,g.VH-8,18,'#c99a72','#a8754f');
  for(let y=0;y<8;y++)for(let x=0;x<8;x++){c.fillStyle=(x+y)%2?'#e8a9b9':'#fdf0e4';c.fillRect(ox+x*S,oy+y*S,S,S)}
  c.strokeStyle='#7b4b33';c.lineWidth=3;c.strokeRect(ox,oy,8*S,8*S);
  c.fillStyle='#fff3e3';c.font='bold 14px sans-serif';c.textAlign='center';c.textBaseline='middle';
  for(let i=0;i<8;i++){const [fx2]=disp(i,0),[,ry]=disp(0,i);c.fillText('abcdefgh'[i],ox+(fx2+.5)*S,oy+8*S+15);c.fillText(String(8-i),ox-17,oy+(ry+.5)*S)}
  boardOverlays(c);piecesLayer(c);
 }
 function boardOverlays(c){
  const g=t.g,S=g.S,v=t.view,last=v.history&&v.history.length&&t.m.actions.length?lastMove():null,cellish=t.id==='chess';
  const mark=(x,y,color)=>{const p=pos(x,y);if(cellish){c.fillStyle=color;c.fillRect(p.x-S/2,p.y-S/2,S,S)}else{c.strokeStyle=color;c.lineWidth=3;const a=S*.46,b=S*.18;c.beginPath();for(const sx of [-1,1])for(const sy of [-1,1]){c.moveTo(p.x+sx*a,p.y+sy*(a-b));c.lineTo(p.x+sx*a,p.y+sy*a);c.lineTo(p.x+sx*(a-b),p.y+sy*a)}c.stroke()}};
  if(last){mark(last.from.x,last.from.y,cellish?'rgba(255,214,102,.45)':'rgba(214,92,120,.55)');mark(last.to.x,last.to.y,cellish?'rgba(255,200,70,.6)':'rgba(214,92,120,.9)')}
  if(t.cursor&&humanTurn()){const p=pos(t.cursor.x,t.cursor.y);c.strokeStyle='#4f8ad9';c.lineWidth=3;c.setLineDash([6,4]);circle(c,p.x,p.y,S*.47);c.stroke();c.setLineDash([])}
  if(t.m.status.check&&!t.m.status.over){for(let y=0;y<g.H;y++)for(let x=0;x<g.W;x++){const q=v.board[y][x];if(q&&q.type==='k'&&q.player===t.m.turn){const p=pos(x,y),pulse=.55+.35*Math.sin(t.clock/150),gr=c.createRadialGradient(p.x,p.y,S*.1,p.x,p.y,S*.62);gr.addColorStop(0,'rgba(255,60,60,'+pulse+')');gr.addColorStop(1,'rgba(255,60,60,0)');c.fillStyle=gr;circle(c,p.x,p.y,S*.62);c.fill()}}t.dirty=true}
  if(t.sel){const a=sqXY(t.sel),p=pos(a.x,a.y);c.fillStyle='rgba(120,200,140,.35)';circle(c,p.x,p.y,S*.5);c.fill();
   for(const m of t.legal)if(m.from===t.sel){const b=sqXY(m.to),q=pos(b.x,b.y),occ=v.board[b.y][b.x];if(occ){c.strokeStyle='rgba(214,70,80,.85)';c.lineWidth=4;circle(c,q.x,q.y,S*.46);c.stroke()}else{c.fillStyle='rgba(60,150,90,.7)';circle(c,q.x,q.y,S*.13);c.fill()}}}
  if(t.hover&&humanTurn()&&!t.sel){const q=v.board[t.hover.y]&&v.board[t.hover.y][t.hover.x];if(q&&q.player===t.m.turn){const p=pos(t.hover.x,t.hover.y);c.strokeStyle='rgba(255,255,255,.75)';c.lineWidth=3;circle(c,p.x,p.y,S*.47);c.stroke()}}
 }
 function lastMove(){for(let i=t.m.actions.length-1;i>=0;i--){const m=t.m.actions[i].move;if(m.from){const f=typeof m.from==='string'?sqXY(m.from):m.from,to=typeof m.to==='string'?sqXY(m.to):m.to;return {from:f,to}}if(m.type==='resign')continue;return null}return null}
 function piecesLayer(c){
  const v=t.view,hide=sliding();
  for(let y=0;y<t.g.H;y++)for(let x=0;x<t.g.W;x++){const q=v.board[y][x];if(!q||hide.has(x+','+y))continue;const p=pos(x,y),lift=t.sel===sqName(x,y)?6+Math.sin(t.clock/180)*2:0;if(lift)t.dirty=true;drawPiece(c,p.x,p.y,q,lift)}
  for(const f of t.fx){if(f.k==='poof'){const p=pos(f.x,f.y),a=(t.clock-f.at)/f.dur;if(a<0){drawPiece(c,p.x,p.y,f.piece,0);continue}if(a>1)continue;c.save();c.globalAlpha=1-a;c.translate(p.x+a*30,p.y-a*50+a*a*90);c.rotate(a*4);c.scale(1-a*.4,1-a*.4);drawPiece(c,0,0,f.piece,0);c.restore()}}
  for(const f of t.fx){if(f.k!=='slide')continue;const a=ease((t.clock-f.at)/f.dur);if(a>=1)continue;const p0=pos(f.from.x,f.from.y),p1=pos(f.to.x,f.to.y),lift=Math.sin(a*Math.PI)*t.g.S*.38;drawPiece(c,p0.x+(p1.x-p0.x)*a,p0.y+(p1.y-p0.y)*a,f.piece,lift+2)}
 }
 function drawGomoku(c){
  const g=t.g,S=g.S,n=g.W,v=t.view;drawWood(c,4,4,g.VW-8,g.VH-8,20,'#f3d394','#e0b26c');
  c.strokeStyle='#7d5126';c.lineWidth=1.3;c.beginPath();for(let i=0;i<n;i++){c.moveTo(g.ox,g.oy+i*S);c.lineTo(g.ox+(n-1)*S,g.oy+i*S);c.moveTo(g.ox+i*S,g.oy);c.lineTo(g.ox+i*S,g.oy+(n-1)*S)}c.stroke();c.lineWidth=2.6;c.strokeRect(g.ox,g.oy,(n-1)*S,(n-1)*S);
  const k=n>=13?3:2,mid=(n-1)/2;c.fillStyle='#7d5126';[[k,k],[n-1-k,k],[mid,mid],[k,n-1-k],[n-1-k,n-1-k]].forEach(([x,y])=>{circle(c,g.ox+x*S,g.oy+y*S,4);c.fill()});
  const drops={},winners=new Set();for(const f of t.fx)if(f.k==='drop')drops[f.x+','+f.y]=f;if(v.status.over&&v.line)v.line.forEach(p=>winners.add(p.x+','+p.y));
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){const p=v.board[y*n+x];if(!p)continue;const q=pos(x,y),d=drops[x+','+y];let r=S*.45,lift=0,al=1;if(d){const a=(t.clock-d.at)/d.dur;if(a<1){lift=(1-ease(a))*S*.9;r*=1+(1-back(a))*.25;al=clamp(a*2,0,1)}}c.globalAlpha=al;pigToken(c,q.x,q.y,r,pal(p),{lift,expr:winners.has(x+','+y)?'happy':'normal'});c.globalAlpha=1}
  if(v.lastMove&&!v.status.over){const q=pos(v.lastMove.x,v.lastMove.y);c.strokeStyle='#ff5d8a';c.lineWidth=2.4;circle(c,q.x,q.y,S*.5+Math.sin(t.clock/220)*1.5);c.stroke();t.dirty=true}
  hoverGhost(c,(x,y)=>!v.board[y*n+x],S*.42);
 }
 function hoverGhost(c,ok,r){const h=t.cursor||t.hover;if(!h||!humanTurn()||!ok(h.x,h.y))return;const q=pos(h.x,h.y);c.globalAlpha=.45;pigToken(c,q.x,q.y,r,pal(t.m.turn),{flat:true});c.globalAlpha=1;if(t.cursor){c.strokeStyle='#4f8ad9';c.lineWidth=2.5;c.setLineDash([5,4]);circle(c,q.x,q.y,r*1.15);c.stroke();c.setLineDash([])}}
 function drawReversi(c){
  const g=t.g,S=g.S,v=t.view;drawWood(c,2,2,g.VW-4,g.VH-4,22,'#8a5a3a','#6c4229');
  const felt=c.createRadialGradient(g.ox+4*S,g.oy+4*S,S,g.ox+4*S,g.oy+4*S,S*6);felt.addColorStop(0,'#6fbf88');felt.addColorStop(1,'#3e8c5d');c.fillStyle=felt;rr(c,g.ox,g.oy,8*S,8*S,10);c.fill();
  c.strokeStyle='rgba(20,60,35,.55)';c.lineWidth=1.5;c.beginPath();for(let i=1;i<8;i++){c.moveTo(g.ox+i*S,g.oy);c.lineTo(g.ox+i*S,g.oy+8*S);c.moveTo(g.ox,g.oy+i*S);c.lineTo(g.ox+8*S,g.oy+i*S)}c.stroke();
  c.fillStyle='rgba(20,60,35,.7)';[[2,2],[6,2],[2,6],[6,6]].forEach(([x,y])=>{circle(c,g.ox+x*S,g.oy+y*S,4.5);c.fill()});
  const flips={},drops={};for(const f of t.fx){if(f.k==='flip')flips[f.x+','+f.y]=f;if(f.k==='drop')drops[f.x+','+f.y]=f}
  for(let y=0;y<8;y++)for(let x=0;x<8;x++){let p=v.board[y*8+x];if(!p)continue;const q=pos(x,y);let sx=1,lift=0,r=S*.42;const f=flips[x+','+y],d=drops[x+','+y];
   if(f){const a=(t.clock-f.at)/f.dur;if(a<0)p=f.from;else if(a<1){sx=Math.abs(Math.cos(a*Math.PI));p=a<.5?f.from:f.to;lift=Math.sin(a*Math.PI)*S*.25}}
   if(d){const a=(t.clock-d.at)/d.dur;if(a<1){lift=(1-ease(a))*S*.7;r*=1+(1-back(a))*.2}}
   pigToken(c,q.x,q.y,r,pal(p),{sx,lift,expr:v.status.over&&v.status.winner===p?'happy':'normal'})}
  if(humanTurn()){for(const m of t.legal){const q=pos(m.x,m.y);c.fillStyle=alpha(pal(t.m.turn).ear,.45+.15*Math.sin(t.clock/260));circle(c,q.x,q.y,S*.11);c.fill()}t.dirty=true}
  if(v.lastMove){const q=pos(v.lastMove.x,v.lastMove.y);c.fillStyle='#ff5d8a';circle(c,q.x+S*.3,q.y-S*.3,4.5);c.fill()}
  hoverGhost(c,(x,y)=>t.legal.some(m=>m.x===x&&m.y===y),S*.4);
 }
 function drawDots(c){
  const g=t.g,S=g.S,v=t.view,W=v.width,H=v.height;
  c.fillStyle='#fff8ec';rr(c,4,4,g.VW-8,g.VH-8,22);c.fill();c.strokeStyle='#e9d6b8';c.lineWidth=2;c.stroke();
  c.save();rr(c,4,4,g.VW-8,g.VH-8,22);c.clip();c.globalAlpha=.25;c.strokeStyle='#b8d6a0';c.lineWidth=1;for(let i=0;i<g.VW;i+=18){c.beginPath();c.moveTo(i,g.VH);c.lineTo(i+30,g.VH-26);c.stroke()}c.restore();
  const boxFx={};for(const f of t.fx)if(f.k==='box')boxFx[f.x+','+f.y]=f;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const p=v.boxes[y*W+x];if(!p)continue;const f=boxFx[x+','+y];let s=1;if(f){const a=(t.clock-f.at)/f.dur;if(a<0)continue;s=back(a)}const cx=g.ox+(x+.5)*S,cy=g.oy+(y+.5)*S;c.fillStyle=alpha(pal(p).ear,.22);c.save();c.translate(cx,cy);c.scale(s,s);rr(c,-S/2+7,-S/2+7,S-14,S-14,12);c.fill();c.restore();pigToken(c,cx,cy+4,S*.3*s,pal(p),{expr:'happy'})}
  const edgeFx=t.fx.filter(f=>f.k==='edge');
  const line=(o,x,y,p,k)=>{const x0=g.ox+x*S,y0=g.oy+y*S,x1=o==='h'?x0+S*k:x0,y1=o==='v'?y0+S*k:y0;c.strokeStyle=pal(p).line;c.lineWidth=11;c.lineCap='round';c.beginPath();c.moveTo(x0,y0);c.lineTo(x1,y1);c.stroke();c.strokeStyle=pal(p).ear;c.lineWidth=7;c.stroke();c.strokeStyle='rgba(255,255,255,.35)';c.lineWidth=2;c.beginPath();c.moveTo(x0,y0-2);c.lineTo(x1,y1-2);c.stroke()};
  for(const o of ['h','v']){const arr=v[o],w=W+(o==='v'?1:0);arr.forEach((p,i)=>{if(!p)return;const x=i%w,y=Math.floor(i/w),f=edgeFx.find(e=>e.e.orientation===o&&e.e.x===x&&e.e.y===y);line(o,x,y,p,f?ease((t.clock-f.at)/f.dur):1)})}
  const lm=v.lastMove;if(lm&&!v.status.over){const x=g.ox+(lm.x+(lm.orientation==='h'?.5:0))*S,y=g.oy+(lm.y+(lm.orientation==='v'?.5:0))*S;c.fillStyle='#fff';circle(c,x,y,4);c.fill()}
  if(t.hover&&humanTurn()&&!edgeTaken(t.hover)){const h=t.hover,x0=g.ox+h.x*S,y0=g.oy+h.y*S;c.strokeStyle=alpha(pal(t.m.turn).ear,.55);c.lineWidth=9;c.lineCap='round';c.setLineDash([2,14]);c.beginPath();c.moveTo(x0,y0);c.lineTo(h.orientation==='h'?x0+S:x0,h.orientation==='v'?y0+S:y0);c.stroke();c.setLineDash([])}
  for(let y=0;y<=H;y++)for(let x=0;x<=W;x++){const px=g.ox+x*S,py=g.oy+y*S;c.fillStyle='#5b3a2b';circle(c,px,py+1.5,8);c.fill();c.fillStyle='#7a5240';circle(c,px,py,7.5);c.fill();c.fillStyle='rgba(255,255,255,.35)';circle(c,px-2.4,py-2.4,2.4);c.fill()}
 }
 function sea(c,b,n,fog){
  const S=b.S;c.save();rr(c,b.x,b.y,n*S,n*S,10);c.clip();
  const gr=c.createLinearGradient(b.x,b.y,b.x,b.y+n*S);gr.addColorStop(0,fog?'#5c9cc4':'#7cc2e4');gr.addColorStop(1,fog?'#3f7fa8':'#4f9ccc');c.fillStyle=gr;c.fillRect(b.x,b.y,n*S,n*S);
  if(!reduce()){c.strokeStyle='rgba(255,255,255,.18)';c.lineWidth=1.5;for(let i=0;i<n*2;i++){const y=b.y+(i+.5)*S/2,ph=t.clock/900+i*1.3;c.beginPath();for(let x=0;x<=n*S;x+=8){const yy=y+Math.sin(ph+x/26)*2.5;if(!x)c.moveTo(b.x+x,yy);else c.lineTo(b.x+x,yy)}c.stroke()}}
  c.strokeStyle='rgba(255,255,255,.28)';c.lineWidth=1;c.beginPath();for(let i=1;i<n;i++){c.moveTo(b.x+i*S,b.y);c.lineTo(b.x+i*S,b.y+n*S);c.moveTo(b.x,b.y+i*S);c.lineTo(b.x+n*S,b.y+i*S)}c.stroke();c.restore();
  c.strokeStyle='#2c5d80';c.lineWidth=2.5;rr(c,b.x,b.y,n*S,n*S,10);c.stroke();
  if(S>=34){c.fillStyle='#2c5d80';c.font='bold 12px sans-serif';c.textAlign='center';c.textBaseline='middle';for(let i=0;i<n;i++){c.fillText('ABCDEFGHIJKL'[i],b.x+(i+.5)*S,b.y-11);c.fillText(String(i+1),b.x-14,b.y+(i+.5)*S)}}
 }
 function hull(c,b,cells,p,o){
  o=o||{};const S=b.S,xs=cells.map(q=>q.x),ys=cells.map(q=>q.y),x0=Math.min(...xs),y0=Math.min(...ys),w=Math.max(...xs)-x0+1,h=Math.max(...ys)-y0+1,pp=pal(p);
  c.save();c.globalAlpha=o.alpha||1;const X=b.x+x0*S+3,Y=b.y+y0*S+3,Wd=w*S-6,Ht=h*S-6;
  c.fillStyle='rgba(20,40,60,.25)';rr(c,X+2,Y+3,Wd,Ht,Math.min(Wd,Ht)/2);c.fill();
  const gr=c.createLinearGradient(X,Y,X+(w>1?0:Wd),Y+(w>1?Ht:0));gr.addColorStop(0,o.wreck?'#8b8f96':'#eef2f6');gr.addColorStop(1,o.wreck?'#5d636c':'#aeb9c6');c.fillStyle=gr;rr(c,X,Y,Wd,Ht,Math.min(Wd,Ht)/2);c.fill();c.strokeStyle=o.wreck?'#3e434a':'#55667a';c.lineWidth=Math.max(1.5,S*.06);c.stroke();
  c.fillStyle=o.wreck?'#6d5960':pp.ear;rr(c,X+(w>1?S*.35:Wd*.25),Y+(w>1?Ht*.25:S*.35),w>1?Wd-S*.7:Wd*.5,w>1?Ht*.5:Ht-S*.7,4);c.fill();
  if(S>=30)for(const q of cells){const cx=b.x+(q.x+.5)*S,cy=b.y+(q.y+.5)*S;pigToken(c,cx,cy,S*.26,o.wreck?P().darkchoc:pp,{flat:true,expr:o.wreck?'shock':'normal'})}
  c.restore();
 }
 function flame(c,x,y,r){const f=Math.sin(t.clock/90+x)*.15;c.save();const gr=c.createRadialGradient(x,y,1,x,y,r);gr.addColorStop(0,'#fff3a6');gr.addColorStop(.4,'#ffa23a');gr.addColorStop(1,'rgba(220,60,30,0)');c.fillStyle=gr;c.beginPath();c.moveTo(x-r*.6,y+r*.4);c.quadraticCurveTo(x-r*.7,y-r*(.4+f),x,y-r*(1.1+f));c.quadraticCurveTo(x+r*.7,y-r*(.4-f),x+r*.6,y+r*.4);c.closePath();c.fill();c.restore();t.dirty=true}
 function drawShots(c,b,shots,n,ownShips){
  const S=b.S;shots.forEach((s,i)=>{if(!s)return;const x=b.x+(i%n+.5)*S,y=b.y+(Math.floor(i/n)+.5)*S;
   if(s===1){c.strokeStyle='rgba(255,255,255,.85)';c.lineWidth=Math.max(1.5,S*.06);circle(c,x,y,S*.2);c.stroke();c.fillStyle='#fff';circle(c,x,y,S*.07);c.fill()}
   else{c.fillStyle='rgba(60,30,20,.55)';circle(c,x,y,S*.3);c.fill();flame(c,x,y-S*.05,S*.42);c.strokeStyle='#a32a1c';c.lineWidth=Math.max(2,S*.08);c.beginPath();c.moveTo(x-S*.2,y-S*.2);c.lineTo(x+S*.2,y+S*.2);c.moveTo(x+S*.2,y-S*.2);c.lineTo(x-S*.2,y+S*.2);c.stroke()}})}
 function drawSea(c){
  const g=t.g,v=t.view,n=g.W,me=local()?t.viewer:t.human,foe=3-me,b=boards();
  const bg=c.createLinearGradient(0,0,0,g.VH);bg.addColorStop(0,'#eaf6fb');bg.addColorStop(1,'#d3ebf6');c.fillStyle=bg;rr(c,2,2,g.VW-4,g.VH-4,22);c.fill();
  c.fillStyle='#2c5d80';c.font='bold 18px sans-serif';c.textAlign='left';c.textBaseline='middle';
  const label=(bb,text)=>{c.textAlign='left';c.textBaseline='middle';c.fillStyle='#2c5d80';c.font=(bb.S>30?'bold 18px':'bold 14px')+' sans-serif';c.fillText(text,bb.x,bb.y-(bb.S>30?36:16))};
  if(t.curtain){drawCurtain(c);return}
  const own=b.own,target=b.target;
  sea(c,own,n,false);label(own,placing()?'我方海域 · 布舰':'我方舰队');
  (v.ownShips||[]).forEach(s=>hull(c,own,s.cells.map(i=>({x:i%n,y:Math.floor(i/n)})),me,{wreck:s.hits===s.length}));
  drawShots(c,own,v.players[me-1].shots,n);
  sea(c,target,n,true);label(target,placing()?'敌方海域（待开战）':'敌方海域 · 点格开炮');
  v.players[foe-1].sunk.forEach(s=>hull(c,target,s.cells,foe,{wreck:true,alpha:.92}));
  if(v.target)drawShots(c,target,v.target.map(s=>s===3?2:s),n);
  // 布舰预览
  if(placing()&&humanTurn()&&t.hover){const len=v.fleet[(v.ownShips||[]).length];if(len){const cells=[];for(let k=0;k<len;k++)cells.push({x:t.hover.x+(t.horizontal?k:0),y:t.hover.y+(t.horizontal?0:k)});const ok=cells.every(q=>q.x<n&&q.y<n&&!v.ownBoard[q.y*n+q.x]);c.globalAlpha=.6;if(ok)hull(c,own,cells,me);else{c.fillStyle='rgba(220,60,60,.45)';cells.forEach(q=>{if(q.x<n&&q.y<n)c.fillRect(own.x+q.x*own.S+2,own.y+q.y*own.S+2,own.S-4,own.S-4)})}c.globalAlpha=1}}
  if(!placing()&&humanTurn()&&t.hover){const h=t.hover,x=target.x+(h.x+.5)*target.S,y=target.y+(h.y+.5)*target.S,S=target.S,known=v.target[h.y*n+h.x];c.strokeStyle=known?'rgba(255,255,255,.5)':'#ffef9a';c.lineWidth=2.5;circle(c,x,y,S*.36);c.stroke();c.beginPath();c.moveTo(x-S*.5,y);c.lineTo(x-S*.18,y);c.moveTo(x+S*.18,y);c.lineTo(x+S*.5,y);c.moveTo(x,y-S*.5);c.lineTo(x,y-S*.18);c.moveTo(x,y+S*.18);c.lineTo(x,y+S*.5);c.stroke()}
  // 舰队名单
  const L=g.list;c.textAlign='left';c.textBaseline='middle';c.font='bold 14px sans-serif';c.fillStyle='#2c5d80';c.fillText(placing()?'待布舰只':'敌方剩余',L.x,L.y);
  const list=placing()?v.fleet.slice((v.ownShips||[]).length):v.remainingFleet||[];list.forEach((len,i)=>{const yy=L.y+22+i*24;for(let k=0;k<len;k++){c.fillStyle=i===0&&placing()?pal(me).ear:'#8aa3b8';rr(c,L.x+k*20,yy-8,17,16,5);c.fill()}c.fillStyle='#2c5d80';c.font='12px sans-serif';c.fillText(len+' 格',L.x+len*20+6,yy)});
  if(!list.length){c.font='13px sans-serif';c.fillText(placing()?'全部就位':'—',L.x,L.y+22)}
 }
 function drawCurtain(c){const g=t.g;c.fillStyle='#244a66';rr(c,2,2,g.VW-4,g.VH-4,22);c.fill();c.save();c.globalAlpha=.12;c.strokeStyle='#fff';c.lineWidth=2;for(let i=0;i<12;i++){c.beginPath();const y=40+i*(g.VH/12);for(let x=0;x<=g.VW;x+=10)c.lineTo(x,y+Math.sin(t.clock/700+x/40+i)*6);c.stroke()}c.restore();
  pigToken(c,g.VW/2,g.VH/2-60,46,pal(t.m.turn),{expr:'happy'});c.fillStyle='#fff';c.textAlign='center';c.textBaseline='middle';c.font='bold 24px sans-serif';c.fillText(t.curtain,g.VW/2,g.VH/2+20);c.font='16px sans-serif';c.fillStyle='#cfe6f4';c.fillText('对方请转过身去，准备好后点一下屏幕',g.VW/2,g.VH/2+56);t.dirty=true}
 function drawFx(c){
  for(const f of t.fx){const a=(t.clock-f.at)/f.dur;if(a<0||a>1)continue;
   if(f.k==='ring'){c.strokeStyle=f.color;c.globalAlpha=1-a;c.lineWidth=3*(1-a)+1;circle(c,f.x,f.y,f.r*(1+a*.8));c.stroke();c.globalAlpha=1}
   else if(f.k==='burst'){for(const p of f.parts){const d=a*60;c.globalAlpha=1-a;c.fillStyle=f.color;circle(c,f.x+p.vx*d,f.y+p.vy*d+a*a*30,p.r*(1-a*.5));c.fill()}c.globalAlpha=1}
   else if(f.k==='splash'){for(let i=0;i<3;i++){const b=clamp(a*1.3-i*.15,0,1);if(!b)continue;c.strokeStyle='rgba(255,255,255,'+(1-b)+')';c.lineWidth=2.5;circle(c,f.x,f.y,f.r*b);c.stroke()}}
   else if(f.k==='blast'){const gr=c.createRadialGradient(f.x,f.y,0,f.x,f.y,f.r*(.4+a));gr.addColorStop(0,'rgba(255,245,170,'+(1-a)+')');gr.addColorStop(.5,'rgba(255,140,40,'+(1-a)*.8+')');gr.addColorStop(1,'rgba(200,50,30,0)');c.fillStyle=gr;circle(c,f.x,f.y,f.r*(.4+a));c.fill()}
   else if(f.k==='shell'){const e=ease(a),x=f.x0+(f.x-f.x0)*e,y=f.y0+(f.y-f.y0)*e-Math.sin(e*Math.PI)*90;c.fillStyle='rgba(30,40,50,.25)';circle(c,f.x0+(f.x-f.x0)*e,f.y0+(f.y-f.y0)*e,4);c.fill();c.fillStyle='#2b2f36';circle(c,x,y,6);c.fill();c.fillStyle='#ffd27a';circle(c,x-2,y-2,2);c.fill()}
   else if(f.k==='sunk'){const b=f.board==='big'?t.g.big:t.g.small;c.strokeStyle='rgba(255,220,120,'+(1-a)+')';c.lineWidth=4;for(const q of f.cells){rr(c,b.x+q.x*b.S+1,b.y+q.y*b.S+1,b.S-2,b.S-2,6);c.stroke()}}
   else if(f.k==='line'){const p0=pos(f.line[0].x,f.line[0].y),p1=pos(f.line[f.line.length-1].x,f.line[f.line.length-1].y),e=ease(a*1.6);c.strokeStyle='rgba(255,230,120,.85)';c.lineWidth=10;c.lineCap='round';c.beginPath();c.moveTo(p0.x,p0.y);c.lineTo(p0.x+(p1.x-p0.x)*e,p0.y+(p1.y-p0.y)*e);c.stroke()}
   else if(f.k==='hint'){c.strokeStyle='rgba(255,200,60,'+(1-a*.6)+')';c.lineWidth=4;circle(c,f.x,f.y,f.r*(1+.12*Math.sin(t.clock/120)));c.stroke();if(f.arrow){c.setLineDash([8,6]);c.beginPath();c.moveTo(f.arrow.x,f.arrow.y);c.lineTo(f.x,f.y);c.stroke();c.setLineDash([])}}
   else if(f.k==='float'){c.globalAlpha=1-a;c.fillStyle=f.color;c.strokeStyle='#fff';c.lineWidth=4;c.font='bold 22px sans-serif';c.textAlign='center';c.textBaseline='middle';c.strokeText(f.text,f.x,f.y-a*34);c.fillText(f.text,f.x,f.y-a*34);c.globalAlpha=1}
   else if(f.k==='banner'){const g=t.g,s=a<.2?back(a/.2):1,o=a>.75?1-(a-.75)/.25:1;c.save();c.globalAlpha=o;c.translate(g.VW/2,g.VH/2);c.scale(s,s);c.font='bold 34px sans-serif';const w=c.measureText(f.text).width+56;c.fillStyle='rgba(255,250,244,.94)';rr(c,-w/2,-32,w,64,32);c.fill();c.strokeStyle=f.color;c.lineWidth=4;c.stroke();c.fillStyle=f.color;c.textAlign='center';c.textBaseline='middle';c.fillText(f.text,0,2);c.restore()}
  }
 }
 function draw(){
  if(!active()||!t.c||!t.g)return;const c=t.c,g=t.g;t.dirty=false;c.clearRect(0,0,g.VW,g.VH);c.save();
  if(t.shake&&!reduce())c.translate(Math.sin(t.clock*.09)*t.shake,Math.cos(t.clock*.11)*t.shake*.6);
  ({xiangqi:drawXiangqi,chess:drawChess,gomoku:drawGomoku,reversi:drawReversi,dots:drawDots,battleship:drawSea})[t.id](c);
  if(!t.curtain)drawFx(c);c.restore();
 }

 // ---------- 帧循环与键盘 ----------
 function tick(dt){
  if(!active()||ui.get().paused)return;
  t.clock+=dt;if(t.shakeAt&&t.clock>=t.shakeAt){t.shake=5;t.shakeAt=0}if(t.shake){t.shake*=Math.exp(-dt/90);if(t.shake<.05)t.shake=0}
  const before=t.fx.length;t.fx=t.fx.filter(f=>t.clock<=f.at+f.dur);
  if(t.aiPending&&t.aiReply&&t.clock>=t.lockUntil&&t.clock-t.aiAt>={easy:420,normal:520,hard:560}[t.mode])runAI();
  if(t.handoff&&t.clock>=t.handoff){t.handoff=0;if(!t.m.status.over){t.curtain='请把屏幕交给'+playerName(t.m.turn);t.hover=null;panel()}}
  if(t.finishAt&&t.clock>=t.finishAt){t.finishAt=0;finish()}
  if(t.fx.length||before||t.dirty||t.shake||t.id==='battleship')draw();
 }
 function moveCursor(dx,dy){const g=t.g;if(!t.cursor){const c=t.id==='battleship'?{x:0,y:0}:{x:Math.floor(g.W/2),y:Math.floor(g.H/2)};t.cursor=c}else{const [cx,cy]=disp(t.cursor.x,t.cursor.y),[nx,ny]=disp(clamp(cx+dx,0,g.W-1),clamp(cy+dy,0,g.H-1));t.cursor={x:nx,y:ny}}if(t.id==='battleship')t.hover={...t.cursor};t.dirty=true}
 function keyDown(e){
  if(!active()||e.target.closest&&e.target.closest('input,select,textarea'))return false;const k=e.key.toLowerCase();
  if(t.curtain&&(k==='enter'||k===' ')){e.preventDefault();t.curtain=null;t.viewer=t.m.turn;refresh();return true}
  if(k==='u'){e.preventDefault();undo();return true}if(k==='h'){e.preventDefault();hint();return true}
  if(e.target.closest&&e.target.closest('button'))return false;
  if(t.id==='battleship'&&k===' '&&placing()){e.preventDefault();rotate();return true}
  if(k==='escape'&&(t.sel||t.cursor)){t.sel=null;t.cursor=null;t.dirty=true;return true}
  if(t.id==='dots')return false;
  const dir={arrowleft:[-1,0],arrowright:[1,0],arrowup:[0,-1],arrowdown:[0,1]}[k];if(dir){e.preventDefault();moveCursor(dir[0],dir[1]);return true}
  if((k==='enter'||k===' ')&&t.cursor){e.preventDefault();if(t.id==='battleship'){if(placing())act({type:'place',x:t.cursor.x,y:t.cursor.y,horizontal:t.horizontal});else act({type:'fire',x:t.cursor.x,y:t.cursor.y})}else clickCell(t.cursor);return true}
  return false;
 }
 function leave(prev){if(has(prev)&&t){cancelAI();if(t.timer)clearTimeout(t.timer)}}
 return {configs,has,init,tick,resize,keyDown,keyUp:()=>{},clearKeys:()=>{},changeLook:()=>{if(active()){t.avatarKey='';panel();t.dirty=true;draw()}},leave};
}
root.PigBoardUI={configs,create,pigToken};
})(typeof window!=='undefined'?window:globalThis);
