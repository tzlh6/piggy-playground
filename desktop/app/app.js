'use strict';
const $=id=>document.getElementById(id),C=PigCore;
const Store={get(k,d){try{const v=localStorage.getItem('piggy2-'+k);return v===null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem('piggy2-'+k,JSON.stringify(v))}catch(e){}}};
const Sound=PigAudio.createSound({store:Store,AudioContext:window.AudioContext||window.webkitAudioContext,clips:window.PIG_VOICES||[]});
['pointerdown','keydown','touchstart'].forEach(t=>document.addEventListener(t,()=>Sound.unlock(),{capture:true,passive:true}));
const reduceMotion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const icon=(id,cls)=>`<svg class="ico ${cls||''}"><use href="#${id}"/></svg>`;

const pigCards=[['crown','皇冠猪'],['glasses','眼镜猪'],['pirate','海盗猪'],['chef','厨师猪'],['space','太空猪'],['bow','蝴蝶结猪'],['flower','花环猪'],['music','耳机猪'],['wizard','魔法猪'],['scarf','围巾猪'],['detective','侦探猪'],['bee','蜜蜂猪']];
const cardSrc=v=>PigLook.src(v);
const pigCardNames=Object.fromEntries(pigCards),pigCardIndex=Object.fromEntries(pigCards.map((p,i)=>[p[0],i]));
const configs={...PigArcadeUI.configs,...PigChallengeUI.configs,...PigRouletteUI.configs,
 mine:{name:'扫猪',icon:'i-flag',title:'草地里，藏着小秘密。',subtitle:'用一点点推理，找到每只熟睡的小猪。',tag:'经典规则 · 仅首格安全',eyebrow:'01 / A LITTLE CHALLENGE',note:'慢慢想，每一个数字都是线索。',levels:[['easy','入门 9×9'],['medium','中级 16×16'],['hard','高级 30×16'],['expert','极限 30×20']],labels:['剩余标记','本局用时','最佳用时'],tips:[['数字是线索','数字代表周围八格的小猪数量。只有第一格保证安全。'],['圈出藏身处','右键插旗，或切换标记模式。F 键也能切换。'],['按住数字连开','旗数吻合时点击数字连开；按住可预览周围格。插错旗也会吵醒猪。']]},
 memory:{name:'记忆翻翻乐',icon:'i-cards',title:'十二种小猪，等你来认。',subtitle:'皇冠猪、海盗猪、太空猪……找到一模一样的猪猪搭档。',tag:'观察与记忆 · 找到所有配对',eyebrow:'02 / A LITTLE MEMORY',note:'每种小猪都有自己的叫声。',levels:[['easy','热身 6 对'],['normal','标准 8 对'],['hard','挑战 12 对']],labels:['已找到','翻牌步数','最佳步数'],tips:[['一次翻两张','图案相同便配对成功，不同会重新盖上。'],['听声音记猪','配对成功时，这种小猪会用自己的声音哼一声。连续配对音调越来越高。'],['耐心胜过手快','翻开的图案停留片刻再盖上；暂停会遮住棋盘。']]},
 merge:{name:'猪猪 2048',icon:'i-spark',title:'一样的小猪，合在一起就长大。',subtitle:'从小猪仔一路长成猪猪国王（2048），再往上还有魔法猪和太空猪。',tag:'滑动合成 · 13 种小猪等你解锁',eyebrow:'03 / A LITTLE MAGIC',note:'每次合成都会“啵”一声，小猪越大叫声越低沉。',levels:[],labels:['本局得分','最大小猪','最高得分'],tips:[['向一个方向推','用方向键、WASD、滑动或下方按钮移动，所有小猪一起滑。'],['一样的才能合','两只一样的小猪相撞会长大一级，每只每步只能合成一次。'],['收集成长图鉴','右侧图鉴记录你见过的最大小猪。给大猪留一个角落，别让牧场住满。']]},
 snake:{name:'贪吃猪',icon:'i-snake',title:'一口一个松露，队伍越排越长。',subtitle:'带着猪仔们在草地上吃松露，别撞到篱笆，也别踩到自己的队伍。',tag:'经典贪吃蛇 · 金松露加分',eyebrow:'05 / A LITTLE APPETITE',note:'每吃 5 颗会冒出金松露，限时出现。',levels:[['easy','慢慢走'],['normal','小跑'],['hard','飞奔']],labels:['本局得分','队伍长度','最高得分'],tips:[['方向键带路','方向键、WASD、滑动或下方按钮转向。不能直接掉头。'],['吃松露长队伍','普通松露 +10，金松露 +50 且多长两节，过一会儿会消失。'],['越吃越快','每吃一颗速度稍快一点。撞墙或撞到自己的队伍就结束。']]},
 runner:{name:'跳跳猪',icon:'i-run',title:'跑起来，跳过去！',subtitle:'小猪一路向前冲，跳过篱笆和泥坑，趴下躲开乌鸦。',tag:'无尽跑酷 · 越跑越快',eyebrow:'06 / A LITTLE RUN',note:'空中还能再跳一次。',levels:[],labels:['本局得分','吃到苹果','最高得分'],tips:[['空格 / ↑ / 点击跳','按住跳得更高，空中再按一次可以二段跳。'],['↓ 趴下','低飞的乌鸦要跳，齐头高的乌鸦趴下就能躲过；空中按 ↓ 快速落地。'],['吃苹果加分','苹果 +25。每满 100 分小猪会哼一声，速度也会越来越快。']]},
 whack:{name:'小猪捉迷藏',icon:'i-target',title:'探出小脑袋，抓住它！',subtitle:'30 秒里找出小猪。小心，花朵可不是小猪。',tag:'限时反应 · 连击加分',eyebrow:'04 / A LITTLE ENERGY',note:'连击越多，小猪叫得越欢。',levels:[['easy','悠闲'],['normal','活泼'],['hard','飞快']],labels:['本局得分','剩余时间','最高得分'],tips:[['看见小猪就点','点中得 10 分，每连击 3 次额外奖励 5 分（最多 +20）。'],['不要碰花朵','点错扣 5 分并中断连击，分数最低为 0。'],['坚持 30 秒','后半程出现更快，漏掉小猪会中断连击。']]}
};
let game='mine',level='hard',state,paused=false,elapsed=0,running=false,lastFrame=performance.now(),mode=false,wonToast=false;
const minePresets={easy:[9,9,10],medium:[16,16,40],hard:[30,16,99],expert:[30,20,150]};
const extraContext={$,Sound,Store,icon,message,stats,record,result,confetti,rr,dpadHTML,pigSrc:role=>PigLook.sprite(role),get:()=>({game,level,state,paused,running,elapsed}),setState:v=>state=v,setRunning:v=>running=v,nextLevel:v=>{level=v;Store.set('level-'+game,v);renderLevels(configs[game]);newGame()}};
const Arcade=PigArcadeUI.create(extraContext),Challenge=PigChallengeUI.create(extraContext),Roulette=PigRouletteUI.create(extraContext);
// 扩展游戏控制器：统一接入初始化、帧循环、键盘、换装与窗口变化
const controllers=[Arcade,Challenge,Roulette],owner=id=>controllers.find(c=>c.has(id));
const Extra={has:id=>!!owner(id),init:id=>owner(id).init(id),tick:dt=>controllers.forEach(c=>c.tick(dt)),resize:()=>controllers.forEach(c=>c.resize()),keyDown:e=>{const c=owner(game);return c?c.keyDown(e):false},keyUp:e=>controllers.forEach(c=>c.keyUp(e)),clearKeys:()=>controllers.forEach(c=>c.clearKeys()),changeLook:()=>controllers.forEach(c=>c.changeLook())};

// ---------- shared UI ----------
function fmt(ms){const s=Math.floor(ms/1000);return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}
function record(value,lower){const key=game+'-'+level,old=Store.get(key,null);if(old===null||(lower?value<old:value>old)){Store.set(key,value);return true}return false}
function best(){const val=Store.get(game+'-'+level,null);return val===null?'—':game==='mine'?fmt(val):String(val)}
function setStat(id,v){const el=$(id),t=String(v);if(el.textContent!==t){el.textContent=t;if(id!=='stat2'||game!=='mine'){el.classList.remove('bump');void el.offsetWidth;el.classList.add('bump')}}}
function stats(a,b){setStat('stat1',a);setStat('stat2',b);setStat('stat3',best())}
// kind：''（普通）/ 'ok'（成功）/ 'warn'（无效操作，附原因）
function message(text,kind){const m=$('message');m.textContent=text;m.className='game-message'+(kind?' '+kind:'');if(kind==='warn'){m.style.animation='none';void m.offsetWidth;m.style.animation=''}}
let speechTimer=0;function say(text){const s=$('speech');s.textContent=text;s.classList.remove('talk');void s.offsetWidth;s.classList.add('talk');$('hero-pig').classList.remove('hop');void $('hero-pig').offsetWidth;$('hero-pig').classList.add('hop');clearTimeout(speechTimer);speechTimer=setTimeout(()=>{s.textContent='哼唧，来玩呀！'},2600)}
function showResult(o){const r=$('result');r.className='layer result '+(o.win?'win':'lose');r.innerHTML=`<div class="result-card">${PigArt.inline({skin:PigLook.active,expr:o.win?'happy':'cry',cls:'result-pig',viewBox:'0 14 160 136'})}<h3>${o.title}</h3><p>${o.body}</p><div class="result-actions"><button class="primary" id="again">${icon('i-restart','sm')}再来一局</button><button class="secondary" id="dismiss">${game==='mine'?'看看棋盘':'收起'}</button></div></div>`;r.hidden=false;$('again').onclick=()=>{newGame();Sound.greet()};$('dismiss').onclick=()=>{r.hidden=true};setTimeout(()=>{const b=$('again');if(b)b.focus({preventScroll:true})},50)}
function result(title,body,win,delay){running=false;const go=()=>showResult({title,body,win});if(delay)Sound.later(delay,go);else go()}
function confetti(n){if(reduceMotion)return;const fx=$('fx'),colors=['#f3a6b8','#f7d58b','#a9c98c','#8ab6d6','#c6a7e0'];for(let k=0;k<(n||36);k++){const p=document.createElement('i');p.className='confetti';p.style.left=(Math.random()*100)+'%';p.style.background=colors[k%colors.length];p.style.animationDelay=(Math.random()*.5)+'s';p.style.animationDuration=(1.6+Math.random()*1.4)+'s';p.style.transform=`rotate(${Math.random()*360}deg)`;fx.appendChild(p);setTimeout(()=>p.remove(),3800)}}
function floatText(text,x,y,cls){const fx=$('fx'),a=$('arena').getBoundingClientRect(),t=document.createElement('span');t.className='float '+(cls||'');t.textContent=text;t.style.left=(x-a.left)+'px';t.style.top=(y-a.top)+'px';fx.appendChild(t);setTimeout(()=>t.remove(),900)}
function pausePig(){$('pause-art').innerHTML=PigArt.inline({skin:PigLook.active,expr:'sleep',cls:'pause-pig',viewBox:'0 14 160 136'})+'<span class="zzz" style="left:58%;top:4px">z</span><span class="zzz" style="left:63%;top:-6px;animation-delay:1.1s">Z</span>'}
function setPause(value){if(!running&&!paused)return;if(value&&!paused)pausePig();paused=value;Extra.clearKeys();$('arena').classList.toggle('paused',value);$('pause-layer').hidden=!value;$('pause').innerHTML=value?icon('i-play','sm')+'<span>继续</span>':icon('i-pause','sm')+'<span>暂停</span>';if(value)Sound.stop()}
function renderLevels(cfg){const box=$('level');box.hidden=!cfg.levels.length;if(cfg.levels.length>4){box.removeAttribute('role');box.innerHTML='<select aria-label="选择关卡">'+cfg.levels.map(([v,n])=>`<option value="${v}" ${v===level?'selected':''}>${n}</option>`).join('')+'</select>';box.querySelector('select').onchange=e=>{level=e.target.value;Store.set('level-'+game,level);Sound.click();newGame()};return}box.setAttribute('role','radiogroup');box.innerHTML=cfg.levels.map(([v,n])=>`<button role="radio" data-level="${v}" aria-checked="${v===level}">${n}</button>`).join('');box.querySelectorAll('button').forEach(b=>b.onclick=()=>{if(level===b.dataset.level)return;level=b.dataset.level;Store.set('level-'+game,level);box.querySelectorAll('button').forEach(x=>x.setAttribute('aria-checked',x===b));Sound.click();newGame()})}
function selectGame(id,audible){if(audible===undefined)audible=true;Sound.stop();Store.set('level-'+game,level);game=id;const cfg=configs[id];level=Store.get('level-'+id,cfg.defaultLevel||(id==='mine'?'hard':id==='memory'?'normal':id==='whack'?'normal':id==='snake'?'normal':'default'));if(cfg.levels.length&&!cfg.levels.some(x=>x[0]===level))level=cfg.levels[0][0];
 document.querySelectorAll('.nav').forEach(b=>{b.classList.toggle('active',b.dataset.game===id);b.setAttribute('aria-current',b.dataset.game===id?'page':'false')});['title','subtitle','eyebrow'].forEach(k=>$(k).textContent=cfg[k]);$('crumb').textContent=$('game-name').textContent=cfg.name;$('game-symbol').setAttribute('href','#'+cfg.icon);$('game-tag').textContent=cfg.tag;$('score-note').textContent=cfg.note;cfg.labels.forEach((s,i)=>$('stat'+(i+1)+'-label').textContent=s);renderLevels(cfg);
 $('tips').innerHTML=cfg.tips.map(([t,d],i)=>`<div class="tip"><span>0${i+1}</span><div><b>${t}</b><p>${d}</p></div></div>`).join('');document.body.dataset.game=id;newGame();if(audible){Sound.greet();say('哼唧！');
  // 小窗口 / 手机：选好游戏后把游戏卡片滚到眼前，屏幕按钮更容易点到
  const card=document.querySelector('.game-card');if(card&&(window.innerHeight<760||window.innerWidth<=760)&&card.getBoundingClientRect().top>8)card.scrollIntoView({block:'start',behavior:reduceMotion?'auto':'smooth'})}}
function newGame(){if(state&&state.pending&&state.pending.timer!==undefined)clearTimeout(state.pending.timer);Sound.stop();Extra.clearKeys();paused=false;running=false;elapsed=0;wonToast=false;lastFrame=performance.now();$('pause-layer').hidden=true;$('arena').classList.remove('paused','shake');$('pause').innerHTML=icon('i-pause','sm')+'<span>暂停</span>';$('result').hidden=true;$('fx').innerHTML='';$('play-toolbar').innerHTML='';$('board').innerHTML='';if(game==='mine')initMine();if(game==='memory')initMemory();if(game==='merge')initMerge();if(game==='whack')initWhack();if(game==='snake')initSnake();if(game==='runner')initRunner();if(Extra.has(game))Extra.init(game);PigLook.apply()}

// ---------- 扫猪 ----------
function initMine(){state=new C.Mine(...minePresets[level]);state.woken=new Set();state.sig=[];mode=false;
 $('play-toolbar').innerHTML=`<button id="dig" class="mode" aria-pressed="true">${icon('i-shovel','sm')}翻开草地</button><button id="flag" class="mode" aria-pressed="false">${icon('i-flag','sm')}标记小猪</button><span class="key-hint">右键标旗 · F 切换 · 按住数字预览</span>`;$('dig').onclick=()=>{setMode(false);Sound.click()};$('flag').onclick=()=>{setMode(true);Sound.click()};
 $('board').innerHTML=`<div class="mine-wrap"><div class="mine-board" style="--cols:${state.w}"></div></div>`;const grid=document.querySelector('.mine-board');
 state.cells.forEach((c,i)=>{const b=document.createElement('button');b.className='mine-cell';b.dataset.i=i;grid.appendChild(b)});
 grid.onclick=e=>{const b=e.target.closest('.mine-cell');if(b)mineAction(+b.dataset.i,mode)};
 grid.oncontextmenu=e=>{e.preventDefault();const b=e.target.closest('.mine-cell');if(b)mineAction(+b.dataset.i,true)};
 grid.onpointerdown=e=>{const b=e.target.closest('.mine-cell');if(!b||e.button>0)return;const i=+b.dataset.i,c=state.cells[i];if(c.open&&c.n&&state.status==='playing')state.near(i).forEach(j=>{if(!state.cells[j].open&&!state.cells[j].flag)grid.children[j].classList.add('peek')})};
 const unpeek=()=>grid.querySelectorAll('.peek').forEach(x=>x.classList.remove('peek'));grid.onpointerup=unpeek;grid.onpointerleave=unpeek;
 grid.onkeydown=e=>{const b=e.target.closest('.mine-cell');if(!b)return;const i=+b.dataset.i,d={ArrowLeft:-1,ArrowRight:1,ArrowUp:-state.w,ArrowDown:state.w}[e.key];if(d){e.preventDefault();const j=i+d;if(j>=0&&j<state.cells.length)grid.children[j].focus()}else if(e.key===' '){e.preventDefault();mineAction(i,true)}};
 fitMine();renderMine();message('首格安全，周围不保底。准备好了，就翻开一格。')}
function fitMine(){const grid=document.querySelector('.mine-board');if(!grid||!state||!state.w)return;const wrap=grid.parentElement,gap=3,pad=18;const availW=wrap.clientWidth-pad,top=wrap.getBoundingClientRect().top+window.scrollY,availH=window.innerHeight-top-58;
 let cell=Math.floor(Math.min((availW-(state.w-1)*gap)/state.w,(availH-(state.h-1)*gap)/state.h));cell=Math.max(22,Math.min(state.w<=9?44:36,cell));grid.style.setProperty('--cell',cell+'px')}
function setMode(v){mode=v;$('dig').setAttribute('aria-pressed',!v);$('flag').setAttribute('aria-pressed',v)}
const PIG_IMG=()=>`<img src="${PigLook.src()}" data-pig-role="pig" alt="" draggable="false">`,FLAG_SVG='<svg class="ico flag-ico"><use href="#i-flag"/></svg>';
function renderMine(origin){const grid=document.querySelector('.mine-board');if(!grid)return;const lost=state.status==='lost',won=state.status==='won';const ow=origin===undefined?-1:origin,or=Math.floor(ow/state.w),oc=ow%state.w;
 for(let i=0;i<state.cells.length;i++){const c=state.cells[i],woke=lost&&(i===state.hit||state.woken.has(i)),wrong=lost&&c.flag&&!c.pig;
  const kind=woke?'pig':wrong?'wrong':c.flag?'flag':c.open?'open'+c.n:'closed';const sig=kind+(i===state.hit?'h':'')+(won&&c.pig?'w':'');if(state.sig[i]===sig)continue;const was=state.sig[i];state.sig[i]=sig;const b=grid.children[i];
  b.className='mine-cell'+(c.open?' open':'')+(c.flag&&!wrong?' flag':'')+(woke?' pig':'')+(wrong?' wrong':'')+(i===state.hit?' hit':'')+(won&&c.pig?' cheer':'');b.dataset.n=c.open?c.n:'';
  b.innerHTML=woke?PIG_IMG():wrong?'<span class="x">×</span>':c.flag?FLAG_SVG:c.open&&c.n?c.n:'';
  if(c.open&&was&&was==='closed'&&ow>=0&&!reduceMotion){const d=Math.hypot(Math.floor(i/state.w)-or,i%state.w-oc);b.style.animationDelay=Math.min(450,d*22)+'ms';b.classList.add('fresh')}
  else b.style.animationDelay='';
  if(won&&c.pig)b.style.animationDelay=(Math.random()*500|0)+'ms';
  b.setAttribute('aria-label',`${Math.floor(i/state.w)+1}行${i%state.w+1}列，${woke?'小猪':wrong?'标错了':c.flag?'已标记':c.open?'周围'+c.n+'只小猪':'未翻开'}`)}
 stats(state.count-state.flags,fmt(elapsed))}
function mineAction(i,flag){if(paused)return;const cell=state.cells[i],wasOpen=cell.open,before=state.status;const changed=flag?state.flag(i):state.reveal(i);
 if(!changed){if(!flag&&wasOpen&&cell.n&&state.status==='playing'){Sound.tone(220,{dur:.06,gain:.04});message('周围的旗数还不等于 '+cell.n+'，先标好小猪再连开。','warn')}else if(flag&&cell.open)message('已经翻开的格子不能插旗。','warn');return}
 if(before==='ready'&&state.status!=='ready')running=true;
 if(state.status==='lost')return wakeAllPigs();
 if(state.status==='won'){const fresh=record(elapsed,true);renderMine(i);Sound.cascade(state.lastOpened);Sound.later(260,()=>Sound.win());confetti(46);say('全都睡得香！');message('完美！所有安全格都已翻开，小猪全被标好啦。');result('牧场守护成功！',`所有小猪都在安睡。本局用时 ${fmt(elapsed)}${fresh?'，刷新了最佳纪录！':'。'}`,true,1400);return}
 if(flag){Sound.flag(cell.flag);renderMine();message(cell.flag?'给这里留一个小记号。':'记号已收起。');return}
 if(wasOpen){Sound.chord();if(state.lastOpened>2)Sound.cascade(state.lastOpened)}else if(state.lastOpened>1)Sound.cascade(state.lastOpened);else Sound.dig(cell.n);
 renderMine(i);message(state.lastOpened>8?`一下翻开了 ${state.lastOpened} 格！`:'每个数字都是周围八格的线索。')}
// Windows-style loss: the pig you stepped on goes off first, then every other pig pops awake one by one.
function wakeAllPigs(){running=false;const grid=document.querySelector('.mine-board');renderMine();$('arena').classList.add('shake');Sound.boom({big:true,voice:3,rate:.92,gain:1});say('哼唧！！');message('嘭！小猪们一个接一个醒来了……');
 const order=state.wakeOrder(),w=state.w;const total=Sound.chain(order.map(i=>({i,pan:w>1?(i%w)/(w-1)*1.6-.8:0})),item=>{state.woken.add(item.i);renderMine();const b=grid.children[item.i];if(b)b.classList.add('boom')});
 result('哼唧，被你发现啦！',`吵醒了 ${order.length+1} 只小猪。再观察一下数字，下一局会更好。`,false,Math.max(900,total))}

// ---------- 记忆翻翻乐 ----------
function initMemory(){const pairs={easy:6,normal:8,hard:12}[level],icons=C.shuffle(pigCards.map(p=>p[0]));state={cards:C.shuffle([...icons.slice(0,pairs),...icons.slice(0,pairs)]),open:[],matched:new Set(),moves:0,lockUntil:0,pairs,finished:false,streak:0};
 $('board').innerHTML=`<div class="memory-board" data-pairs="${pairs}"></div>`;const b=document.querySelector('.memory-board');
 state.cards.forEach((v,i)=>{const el=document.createElement('button');el.className='memory-card';el.innerHTML=`<span class="inner"><span class="back"><svg viewBox="0 0 64 48"><use href="#i-snout"/></svg></span><span class="front"><img src="${cardSrc(v)}" data-pig-role="${v}" alt="" draggable="false"><small>${pigCardNames[v]}</small></span></span>`;el.setAttribute('aria-label',`第${i+1}张，未翻开`);el.onclick=()=>flipCard(i);b.appendChild(el)});
 $('play-toolbar').innerHTML='<span class="key-hint">配对成功时，这只小猪会叫一声</span>';stats('0 / '+pairs,0);message('翻开第一张，记住它的位置。')}
function renderMemory(){document.querySelectorAll('.memory-card').forEach((b,i)=>{const match=state.matched.has(i),open=state.open.includes(i);b.classList.toggle('flipped',open||match);b.classList.toggle('matched',match);b.setAttribute('aria-label',`第${i+1}张，${match?'已配对 '+pigCardNames[state.cards[i]]:open?pigCardNames[state.cards[i]]:'未翻开'}`)});stats(state.matched.size/2+' / '+state.pairs,state.moves)}
function flipCard(i){if(paused||state.finished||state.lockUntil||state.matched.has(i)||state.open.includes(i))return;running=true;state.open.push(i);Sound.flip();
 if(state.open.length===2){state.moves++;const [a,b]=state.open,cards=document.querySelectorAll('.memory-card');
  if(state.cards[a]===state.cards[b]){state.matched.add(a);state.matched.add(b);state.open=[];state.streak++;Sound.match(pigCardIndex[state.cards[a]],state.streak-1);[a,b].forEach(k=>cards[k].classList.add('pair'));message(state.streak>1?`连续配对 ×${state.streak}！`:'找到一对！','ok');
   if(state.matched.size===state.cards.length){state.finished=true;const fresh=record(state.moves,true);Sound.later(450,()=>Sound.win());confetti(40);say('朋友们都到齐啦！');result('朋友们团聚啦！',`${state.moves} 步完成配对，用时 ${fmt(elapsed)}。${fresh?'这是你的新纪录！':''}`,true,1500)}}
  else{state.streak=0;state.lockUntil=elapsed+900;Sound.later(260,()=>Sound.miss());setTimeout(()=>[a,b].forEach(k=>{cards[k].classList.remove('nope');void cards[k].offsetWidth;cards[k].classList.add('nope')}),260);message('记住这两个位置，稍后再来。')}}
 renderMemory()}

// ---------- 猪猪 2048 ----------
// Each number is a pig that grows up: piglet → … → pig king (2048) → wizard → astronaut.
const PIG_LEVELS=[[2,'pig','小猪仔'],[4,'bow','蝴蝶结猪'],[8,'flower','花环猪'],[16,'bee','蜜蜂猪'],[32,'scarf','围巾猪'],[64,'music','耳机猪'],[128,'glasses','眼镜猪'],[256,'chef','厨师猪'],[512,'detective','侦探猪'],[1024,'pirate','海盗猪'],[2048,'crown','猪猪国王'],[4096,'wizard','魔法猪'],[8192,'space','太空猪']];
const pigLevel=v=>PIG_LEVELS.find(p=>p[0]===v)||PIG_LEVELS[PIG_LEVELS.length-1];
const pigSrc=v=>PigLook.sprite(pigLevel(v)[1]);
// Keep every growth sprite decoded in memory so merged tiles never flash an empty frame.
const PIG_SPRITES=PIG_LEVELS.map(([v])=>{const im=new Image();im.src=pigSrc(v);if(im.decode)im.decode().catch(()=>{});return im});
function initMerge(){state={board:Array(16).fill(0),score:0,history:null,finished:false,slots:Array(16).fill(null),pending:null};C.spawnTile(state.board);C.spawnTile(state.board);
 $('play-toolbar').innerHTML=`<button class="mode" id="undo">${icon('i-undo','sm')}撤销一步</button><span class="key-hint">方向键 / WASD / 滑动</span>`;
 $('undo').onclick=()=>{if(paused||!state.history)return;finishSlide();state.board=state.history.board;state.score=state.history.score;state.history=null;state.finished=false;running=true;$('result').hidden=true;buildTiles();Sound.undo();message('已退回上一步。每次移动可撤销一次。')};
 $('board').innerHTML=`<div class="merge-wrap"><div class="merge-board" tabindex="0" aria-label="猪猪 2048 棋盘">${'<i class="cell"></i>'.repeat(16)}<div class="tiles"></div></div><div class="pigdex"><b>猪猪成长图鉴</b><div id="pigdex"></div></div></div><div class="dpad"><button data-dir="left" aria-label="向左" class="l">${icon('i-arrow')}</button><button data-dir="up" aria-label="向上" class="u">${icon('i-arrow')}</button><button data-dir="down" aria-label="向下" class="d">${icon('i-arrow')}</button><button data-dir="right" aria-label="向右">${icon('i-arrow')}</button></div>`;
 document.querySelectorAll('[data-dir]').forEach(b=>b.onclick=()=>arcadeDir(b.dataset.dir));const board=document.querySelector('.merge-board');bindSwipe(board,d=>mergeMove(d));
 buildTiles();message('把一样的小猪推到一起，它们会长大一级。')}
function bindSwipe(el,fn){let touch=null;el.onpointerdown=e=>{touch=[e.clientX,e.clientY];try{el.setPointerCapture(e.pointerId)}catch(err){}};el.onpointerup=e=>{if(!touch)return;const dx=e.clientX-touch[0],dy=e.clientY-touch[1];touch=null;if(Math.max(Math.abs(dx),Math.abs(dy))>25)fn(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up'))};el.onpointercancel=()=>touch=null}
function tileHTML(v){const [,role,name]=pigLevel(v);return `<img src="${pigSrc(v)}" data-pig-role="${role}" data-pig-sprite alt="" draggable="false"><b>${v}</b><small>${name}</small>`}
function placeTile(el,i){el.style.setProperty('--c',i%4);el.style.setProperty('--r',Math.floor(i/4))}
function makeTile(v,i,cls){const el=document.createElement('div');el.className='ptile'+(cls?' '+cls:'');el.dataset.v=v;el.innerHTML=tileHTML(v);el.setAttribute('aria-label',pigLevel(v)[2]+' '+v);placeTile(el,i);document.querySelector('.merge-board .tiles').appendChild(el);return el}
function buildTiles(){const layer=document.querySelector('.merge-board .tiles');layer.innerHTML='';state.slots=state.board.map((v,i)=>v?makeTile(v,i):null);mergeStats()}
function mergeStats(){const top=Math.max(...state.board);stats(state.score,top);$('undo').disabled=!state.history;const bestTile=Math.max(top,Store.get('merge-bestTile',0));if(bestTile>Store.get('merge-bestTile',0))Store.set('merge-bestTile',bestTile);
 const dex=$('pigdex');if(!dex.children.length)dex.innerHTML=PIG_LEVELS.map(([v,role,name])=>`<span data-v="${v}" title="${v} ${name}"><img src="${pigSrc(v)}" data-pig-role="${role}" data-pig-sprite alt="${name}" draggable="false"><i>${v}</i></span>`).join('');
 [...dex.children].forEach(sp=>{const v=+sp.dataset.v;sp.classList.toggle('got',v<=bestTile);sp.classList.toggle('now',v===top)})}
function setTile(el,v){el.dataset.v=v;const [,role,name]=pigLevel(v),img=el.querySelector('img'),src=pigSrc(v);img.dataset.pigRole=role;if(img.getAttribute('src')!==src)img.setAttribute('src',src);el.querySelector('b').textContent=v;el.querySelector('small').textContent=name}
function finishSlide(){const p=state.pending;if(!p)return;clearTimeout(p.timer);state.pending=null;p.gone.forEach(el=>el.remove());p.grow.forEach(([el,v])=>{setTile(el,v);el.setAttribute('aria-label',pigLevel(v)[2]+' '+v);el.classList.remove('merged');void el.offsetWidth;el.classList.add('merged')});if(p.spawn>=0)state.slots[p.spawn]=makeTile(state.board[p.spawn],p.spawn,'new')}
function mergeMove(dir){if(paused||state.finished)return;finishSlide();const r=C.move2048(state.board,dir);if(!r.changed){Sound.tone(180,{dur:.05,gain:.03});message('这个方向推不动了，换个方向试试。','warn');const b=document.querySelector('.merge-board');b.classList.remove('bump-'+dir);void b.offsetWidth;b.classList.add('bump-'+dir);return}
 state.history={board:state.board.slice(),score:state.score};const slots=Array(16).fill(null),gone=[],grow=[];
 r.moves.forEach(m=>{const el=state.slots[m.from];if(!el)return;placeTile(el,m.to);if(m.keep){slots[m.to]=el;if(m.merge)grow.push([el,m.v*2])}else{el.classList.add('sink');gone.push(el)}});
 state.slots=slots;state.board=r.board;state.score+=r.score;running=true;const spawn=C.spawnTile(state.board);record(state.score);
 const movingState=state;state.pending={gone,grow,spawn,timer:setTimeout(()=>{if(game!=='merge'||state!==movingState)return;finishSlide();mergeStats()},reduceMotion?0:115)};
 if(r.score){Sound.merge(r.merged.map(i=>r.board[i]));const big=Math.max(...r.merged.map(i=>r.board[i]));if(big>=128)say(big>=1024?'哇——长这么大了！':pigLevel(big)[2]+'来啦！')}else Sound.slide();Sound.spawnTile();
 if(!wonToast&&state.board.some(v=>v>=2048)){wonToast=true;Sound.later(260,()=>Sound.win());confetti(50);message('猪猪国王诞生！继续挑战魔法猪（4096）吧。')}
 else message(r.score?(r.merged.length>1?`一下合成 ${r.merged.length} 对，+${r.score} 分！`:`${pigLevel(r.top)[2]}，+${r.score} 分。`):'留一点空间，下一步还有机会。');
 if(!C.canMove(state.board)){state.finished=true;Sound.later(260,()=>Sound.lose());result('小牧场住满啦。',`最终得分 ${state.score}，长到了「${pigLevel(Math.max(...state.board))[2]}」。可以撤销最后一步，或再来一局。`,false,900)}}

// ---------- 小猪捉迷藏 ----------
function initWhack(){state={score:0,combo:0,target:-1,decoy:false,next:0,hide:0,finished:false,started:false,lastTick:99};
 $('play-toolbar').innerHTML='<span>点猪加分 · 花朵扣分</span><span class="combo" id="combo">连击 × 0</span>';
 $('board').innerHTML=`<div class="timebar"><i id="timebar"></i></div><div class="start-prompt"><button id="start-whack" class="primary">${icon('i-play','sm')}开始 30 秒挑战</button></div><div class="whack-board">`+Array.from({length:9},(_,i)=>`<button class="hole" data-hole="${i}" aria-label="第${i+1}个洞，空"><span class="mound"></span></button>`).join('')+'</div>';
 document.querySelectorAll('.hole').forEach((b,i)=>{b.onpointerdown=e=>{if(e.button>0)return;hitPig(i,e)};b.onclick=e=>{if(e.detail===0){const r=b.getBoundingClientRect();hitPig(i,{clientX:r.left+r.width/2,clientY:r.top+r.height/3})}}});
 $('start-whack').onclick=()=>{if(state.started)return;state.started=true;running=true;elapsed=0;state.next=400;$('start-whack').hidden=true;Sound.greet();message('小猪马上出现！')};stats(0,'30 s');message('准备好了再开始。只点小猪，不点花朵。')}
function showWhack(){const speed={easy:1050,normal:800,hard:600}[level]*(elapsed>15000?.82:1);const last=state.target;let t;do{t=Math.floor(Math.random()*9)}while(t===last);state.target=t;state.decoy=Math.random()<.22;state.hide=elapsed+speed;state.next=state.hide+220;const b=document.querySelectorAll('.hole')[t];
 b.insertAdjacentHTML('beforeend',state.decoy?'<span class="critter decoy"><svg viewBox="0 0 64 64"><use href="#i-flower"/></svg></span>':'<span class="critter">'+PIG_IMG()+'</span>');void b.offsetWidth;b.classList.add('up');b.setAttribute('aria-label',`第${t+1}个洞，${state.decoy?'花朵，不要点':'小猪，点这里'}`);if(!state.decoy)Sound.pop()}
function clearWhack(keep){document.querySelectorAll('.hole').forEach((b,i)=>{b.classList.remove('up');const c=b.querySelector('.critter');if(c&&i!==keep)c.remove();b.setAttribute('aria-label',`第${i+1}个洞，空`)});state.target=-1}
function hitPig(i,e){if(paused||!running||state.finished||state.target<0||elapsed>=state.hide)return;if(i!==state.target)return;const hole=document.querySelectorAll('.hole')[i];
 if(state.decoy){state.score=Math.max(0,state.score-5);state.combo=0;Sound.oops();hole.classList.add('oops');setTimeout(()=>hole.classList.remove('oops'),400);floatText('-5',e.clientX,e.clientY,'neg');message('这是花朵呀，扣 5 分。')}
 else{state.combo++;const points=10+Math.min(20,Math.floor((state.combo-1)/3)*5);state.score+=points;Sound.hit(state.combo-1);if(state.combo%5===0)Sound.pigGiggle({delay:.2});const c=hole.querySelector('.critter');if(c){c.classList.add('bonk');setTimeout(()=>c.remove(),320)}floatText('+'+points,e.clientX,e.clientY);if(state.combo%5===0)say('连击 ×'+state.combo+'！');message(`抓到啦！+${points} 分`)}
 clearWhack(state.decoy?-1:i);state.hide=0;state.next=elapsed+180;$('combo').textContent='连击 × '+state.combo;$('combo').classList.toggle('hot',state.combo>=5);record(state.score);stats(state.score,Math.max(0,Math.ceil((30000-elapsed)/1000))+' s')}
function whackTick(){if(elapsed>=30000){state.finished=true;clearWhack();record(state.score);stats(state.score,'0 s');$('timebar').style.width='0%';if(state.score>=150){Sound.win();confetti(36)}else if(state.score>0)Sound.win();else Sound.lose();result('捉迷藏结束！',`本局 ${state.score} 分。眼睛和手指都辛苦啦。`,true,700);return}
 if(state.target>=0&&elapsed>=state.hide){if(!state.decoy){state.combo=0;$('combo').textContent='连击 × 0';$('combo').classList.remove('hot');Sound.tone(247,{dur:.1,gain:.035,to:196})}clearWhack()}
 if(elapsed>=state.next&&state.target<0)showWhack();const left=Math.ceil((30000-elapsed)/1000);$('stat2').textContent=left+' s';$('timebar').style.width=(100-elapsed/300)+'%';$('timebar').classList.toggle('low',left<=5);if(left<=5&&left!==state.lastTick){state.lastTick=left;Sound.tick(left===1)}}
function frame(now){const dt=Math.min(now-lastFrame,1000);lastFrame=now;if(running&&!paused){elapsed+=dt;if(game==='mine')$('stat2').textContent=fmt(elapsed);if(game==='memory'&&state.lockUntil&&elapsed>=state.lockUntil){state.open=[];state.lockUntil=0;renderMemory()}if(game==='whack')whackTick();if(game==='snake')snakeTick(dt);if(game==='runner')runnerTick(dt)}if(game==='snake'&&state&&state.cv)drawSnake();if(game==='runner'&&state&&state.cv)drawRunner();if(Extra.has(game))Extra.tick(Math.min(dt,80));requestAnimationFrame(frame)}


// ---------- shared canvas helpers ----------
const PIG_IMAGE=new Image();PIG_IMAGE.src=PigLook.src();
function setupCanvas(el,lw,lh){const dpr=Math.min(2,window.devicePixelRatio||1);el.width=Math.round(lw*dpr);el.height=Math.round(lh*dpr);const ctx=el.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);return ctx}
function rr(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
function arcadeDir(d){if(game==='merge')mergeMove(d);else if(game==='snake')snakeTurn(d)}
function dpadHTML(){return `<div class="dpad"><button data-dir="left" aria-label="向左" class="l">${icon('i-arrow')}</button><button data-dir="up" aria-label="向上" class="u">${icon('i-arrow')}</button><button data-dir="down" aria-label="向下" class="d">${icon('i-arrow')}</button><button data-dir="right" aria-label="向右">${icon('i-arrow')}</button></div>`}

// ---------- 贪吃猪 ----------
function initSnake(){const W=20,H=14;state={game:new C.Snake(W,H),W,H,acc:0,prev:null,started:false,finished:false,interval:{easy:175,normal:128,hard:92}[level]};
 $('play-toolbar').innerHTML='<span class="key-hint">方向键 / WASD / 滑动 / 下方按钮</span>';
 $('board').innerHTML=`<div class="canvas-wrap snake-wrap"><canvas id="snake-cv" aria-label="贪吃猪草地"></canvas><div class="start-overlay" id="snake-start"><button class="primary" id="snake-go">${icon('i-play','sm')}开始带队</button><small>或直接按方向键</small></div></div>${dpadHTML()}`;
 const cv=$('snake-cv');state.cv=cv;fitSnake();document.querySelectorAll('[data-dir]').forEach(b=>b.onclick=()=>arcadeDir(b.dataset.dir));bindSwipe(cv,d=>snakeTurn(d));
 $('snake-go').onclick=()=>snakeStart();stats(0,state.game.body.length);message('猪妈妈带着两只猪仔出发了，去吃松露吧！')}
function fitSnake(){const cv=state.cv,wrap=cv.parentElement,avail=Math.min(wrap.clientWidth,760),availH=Math.max(260,window.innerHeight-wrap.getBoundingClientRect().top-window.scrollY-120);const cell=Math.max(18,Math.floor(Math.min(avail/state.W,availH/state.H)));state.cell=cell;cv.style.width=cell*state.W+'px';cv.style.height=cell*state.H+'px';state.ctx=setupCanvas(cv,cell*state.W,cell*state.H)}
function snakeStart(){if(state.started)return;state.started=true;running=true;$('snake-start').hidden=true;Sound.greet();message('出发！')}
function snakeTurn(d){if(game!=='snake'||state.finished||paused)return;if(!state.started){if(d==='left')return;snakeStart()}if(state.game.turn(d))Sound.turnTick()}
function snakeTick(dt){if(!state.started||state.finished)return;const g=state.game,speed=Math.max(level==='hard'?55:62,state.interval-g.eaten*3);state.acc+=dt;
 while(state.acc>=speed&&!state.finished){state.acc-=speed;state.prev=g.body.map(c=>c.slice());const ev=g.step();
  if(ev.type==='eat'){Sound.eat(ev.count);record(g.score);stats(g.score,g.body.length+g.grow);if(ev.count%5===0)message('金松露出现了！快去吃，它一会儿就会消失。');else message(`吃到第 ${ev.count} 颗松露。`)}
  else if(ev.type==='gold'){Sound.gold();record(g.score);stats(g.score,g.body.length+g.grow);say('金松露！');message('金松露 +50，队伍多了两只猪仔！');floatCell(g.body[0],'+50')}
  else if(ev.type==='goldgone'){Sound.goldGone();message('金松露溜走了。')}
  else if(ev.type==='dead'||ev.type==='full'){state.finished=true;running=false;const full=ev.type==='full';const fresh=record(g.score);
   if(full){Sound.win();confetti(46)}else{Sound.crash();$('arena').classList.add('shake')}
   result(full?'整片草地都是猪仔！':'哎呀，撞到啦！',`吃了 ${g.eaten} 颗松露，队伍长 ${g.body.length} 只，得分 ${g.score}${fresh?'，刷新最高分！':'。'}`,full,1100)}}
 state.frac=Math.min(1,state.acc/speed)}
function floatCell(c,text){const r=state.cv.getBoundingClientRect();floatText(text,r.left+(c[0]+.5)*state.cell,r.top+(c[1]+.2)*state.cell)}
function drawSnake(){const {ctx,cell,W,H,game:g}=state;if(!ctx)return;const t=performance.now()/1000;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){ctx.fillStyle=(x+y)%2?'#d4e3b8':'#cbdcac';ctx.fillRect(x*cell,y*cell,cell,cell)}
 ctx.strokeStyle='#a7b98b';ctx.lineWidth=4;ctx.strokeRect(2,2,W*cell-4,H*cell-4);
 const f=g.food;if(f){const cx=(f[0]+.5)*cell,cy=(f[1]+.55)*cell,bob=Math.sin(t*4)*cell*.04;truffle(ctx,cx,cy+bob,cell*.32,false)}
 if(g.gold){const cx=(g.gold.x+.5)*cell,cy=(g.gold.y+.55)*cell;ctx.save();ctx.globalAlpha=.35+.25*Math.sin(t*8);ctx.fillStyle='#ffe58a';ctx.beginPath();ctx.arc(cx,cy,cell*.62,0,7);ctx.fill();ctx.restore();truffle(ctx,cx,cy,cell*.36,true);
  ctx.strokeStyle='#e0a800';ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx,cy,cell*.55,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.max(0,g.gold.ttl)/(Math.max(W,H)+12));ctx.stroke()}
 const frac=state.prev&&!state.finished?state.frac||0:1,body=g.body,prev=state.prev||body;
 const pos=k=>{const c=body[k],p=prev[Math.min(k,prev.length-1)]||c;const ease=frac;return [(p[0]+(c[0]-p[0])*ease+.5)*cell,(p[1]+(c[1]-p[1])*ease+.5)*cell]};
 for(let k=body.length-1;k>=1;k--){const [x,y]=pos(k),r=cell*.4,wob=Math.sin(t*10+k)*cell*.03;piglet(ctx,x,y+wob,r,k===body.length-1,k)}
 const [hx,hy]=pos(0),hs=cell*1.15;ctx.save();ctx.translate(hx,hy);ctx.rotate({up:0,down:0,left:-.12,right:.12}[g.dir]);if(g.dir==='right')ctx.scale(-1,1);if(PIG_IMAGE.complete)ctx.drawImage(PIG_IMAGE,-hs/2,-hs/2,hs,hs*.9);ctx.restore();
 if(state.finished){ctx.fillStyle='rgba(255,255,255,.25)';ctx.fillRect(0,0,W*cell,H*cell)}}
function truffle(ctx,x,y,r,gold){ctx.fillStyle=gold?'#f2c037':'#7a5236';ctx.beginPath();ctx.ellipse(x,y,r,r*.85,0,0,7);ctx.fill();ctx.fillStyle=gold?'#fff1b0':'#a07552';[[-.35,-.25],[.25,-.1],[-.05,.3],[.35,.35]].forEach(([dx,dy])=>{ctx.beginPath();ctx.arc(x+dx*r,y+dy*r,r*.13,0,7);ctx.fill()});ctx.fillStyle='#6f9e45';ctx.beginPath();ctx.ellipse(x+r*.15,y-r*.95,r*.35,r*.16,-.5,0,7);ctx.fill()}
function piglet(ctx,x,y,r,tail,k){const C=PigLook.colors;ctx.lineCap='round';
 ctx.strokeStyle=C[4];ctx.lineWidth=Math.max(1.5,r*.2);[-1,1].forEach(s=>{ctx.beginPath();ctx.arc(x+s*r*.55,y-r*.78,r*.24,s<0?Math.PI*.2:Math.PI*.8,s<0?Math.PI*1.5:Math.PI*-.5,s>0);ctx.stroke()});
 ctx.fillStyle=k%2?C[0]:C[1];ctx.strokeStyle=C[3];ctx.globalAlpha=1;ctx.lineWidth=Math.max(1,r*.07);ctx.beginPath();ctx.ellipse(x,y,r,r*.92,0,0,7);ctx.fill();ctx.globalAlpha=.35;ctx.stroke();ctx.globalAlpha=1;
 ctx.fillStyle=C[2];ctx.beginPath();ctx.ellipse(x,y+r*.24,r*.42,r*.29,0,0,7);ctx.fill();ctx.fillStyle='#2a2326';ctx.beginPath();ctx.ellipse(x-r*.15,y+r*.24,r*.07,r*.11,0,0,7);ctx.ellipse(x+r*.15,y+r*.24,r*.07,r*.11,0,0,7);ctx.fill();ctx.beginPath();ctx.arc(x-r*.38,y-r*.18,r*.09,0,7);ctx.arc(x+r*.38,y-r*.18,r*.09,0,7);ctx.fill();
 if(tail){ctx.strokeStyle=C[1];ctx.lineWidth=Math.max(1.5,r*.16);ctx.beginPath();ctx.arc(x+r*1.05,y+r*.1,r*.25,Math.PI,Math.PI*2.6);ctx.stroke()}}

// ---------- 跳跳猪 ----------
function initRunner(){state={run:new C.Runner(),started:false,finished:false,lastScore:0};
 $('play-toolbar').innerHTML='<span class="key-hint">点画面或“跳”按钮起跳 · 点“趴下”低头一会儿 · 键盘：空格 / ↑ 跳，↓ 趴下</span>';
 $('board').innerHTML=`<div class="canvas-wrap runner-wrap"><canvas id="runner-cv" aria-label="跳跳猪跑道"></canvas><div class="start-overlay" id="runner-start"><button class="primary" id="runner-go">${icon('i-play','sm')}开跑</button><small>或按空格 / 点击跑道</small></div></div><div class="run-pad"><button id="btn-jump">${icon('i-arrow')}<span>跳</span></button><button id="btn-duck">${icon('i-arrow')}<span>趴下</span></button></div>`;
 const cv=$('runner-cv');state.cv=cv;fitRunner();
 cv.onpointerdown=e=>{e.preventDefault();runnerJump()};cv.onpointerup=()=>state.run.release();
 $('runner-go').onclick=e=>{e.stopPropagation();runnerJump()};const jb=$('btn-jump'),db=$('btn-duck');jb.onpointerdown=e=>{e.preventDefault();runnerJump()};jb.onpointerup=()=>state.run.release();db.onpointerdown=e=>{e.preventDefault();state.duckAt=elapsed;state.duckUntil=0;runnerDuck(true)};db.onpointerup=db.onpointerleave=()=>{if(state.duckAt===undefined)return;const held=elapsed-state.duckAt;state.duckAt=undefined;if(held<650)state.duckUntil=elapsed+650-held;else runnerDuck(false)};
 stats(0,0);message('小猪准备好了。按空格开跑！')}
function fitRunner(){const cv=state.cv,w=Math.min(cv.parentElement.clientWidth,960),h=Math.round(w*220/800);cv.style.width=w+'px';cv.style.height=h+'px';state.ctx=setupCanvas(cv,w,h);state.scale=w/800}
function runnerJump(){if(game!=='runner'||paused||state.finished)return;if(!state.started){state.started=true;running=true;$('runner-start').hidden=true;Sound.greet();message('冲呀！')}const r=state.run.jump();if(r==='jump')Sound.jump();else if(r==='double')Sound.double()}
function runnerDuck(on){if(game!=='runner'||!state.started||state.finished)return;state.run.duck(on)}
function runnerTick(dt){if(!state.started||state.finished)return;const R=state.run;if(state.duckUntil&&elapsed>=state.duckUntil){state.duckUntil=0;runnerDuck(false)}const ev=R.update(dt/1000);
 ev.forEach(e=>{if(e==='land')Sound.land();if(e==='apple'){Sound.apple();const p=R.pig,r=state.cv.getBoundingClientRect();floatText('+25',r.left+(p.x+30)*state.scale,r.top+(p.y-60)*state.scale)}if(e==='milestone'){Sound.milestone();if(R.milestone%5===0)say(R.milestone*100+' 分！')}});
 const sc=Math.floor(R.score);if(sc!==state.lastScore){state.lastScore=sc;$('stat1').textContent=sc;$('stat2').textContent=R.applesTaken}
 if(ev.includes('crash')){state.finished=true;running=false;const fresh=record(sc);stats(sc,R.applesTaken);Sound.crash();$('arena').classList.add('shake');result('哎哟，绊了一跤！',`跑了 ${Math.round(R.dist/40)} 米，吃到 ${R.applesTaken} 个苹果，得分 ${sc}${fresh?'，刷新最高分！':'。'}`,false,1000)}}
function drawRunner(){const {ctx,run:R,scale}=state;if(!ctx)return;const t=performance.now()/1000,d=R.dist;ctx.save();ctx.scale(scale,scale);
 const sky=ctx.createLinearGradient(0,0,0,220);sky.addColorStop(0,'#dff0f7');sky.addColorStop(1,'#fbf6e6');ctx.fillStyle=sky;ctx.fillRect(0,0,800,220);
 ctx.fillStyle='#fde7a6';ctx.beginPath();ctx.arc(690,46,24,0,7);ctx.fill();
 ctx.fillStyle='#ffffff';for(let k=0;k<4;k++){const x=((k*260-d*.12)%1040+1040)%1040-120,y=28+k%2*26;ctx.beginPath();ctx.ellipse(x,y,34,11,0,0,7);ctx.ellipse(x+22,y-7,22,11,0,0,7);ctx.fill()}
 ctx.fillStyle='#cfe0b4';ctx.beginPath();ctx.moveTo(0,R.ground);for(let x=0;x<=800;x+=20)ctx.lineTo(x,R.ground-38-Math.sin((x+d*.25)/90)*18-Math.sin((x+d*.25)/37)*6);ctx.lineTo(800,R.ground);ctx.fill();
 ctx.fillStyle='#b5cf93';for(let k=0;k<7;k++){const x=((k*140-d*.6)%980+980)%980-90;ctx.beginPath();ctx.arc(x,R.ground-4,16,Math.PI,0);ctx.arc(x+18,R.ground-4,12,Math.PI,0);ctx.fill()}
 ctx.fillStyle='#e9dcb8';ctx.fillRect(0,R.ground,800,40);ctx.fillStyle='#a9c48b';ctx.fillRect(0,R.ground-2,800,5);ctx.fillStyle='#d2c194';for(let k=0;k<26;k++){const x=((k*37-d)%962+962)%962-40;ctx.fillRect(x,R.ground+12+(k%3)*7,10+(k%4)*4,2)}
 R.apples.forEach(a=>{ctx.fillStyle='#e8524f';ctx.beginPath();ctx.arc(a.x,a.y+Math.sin(t*5+a.x/50)*2,a.r,0,7);ctx.fill();ctx.fillStyle='#7cae4f';ctx.beginPath();ctx.ellipse(a.x+4,a.y-a.r-1,5,2.5,-.6,0,7);ctx.fill();ctx.fillStyle='rgba(255,255,255,.55)';ctx.beginPath();ctx.arc(a.x-4,a.y-4,3,0,7);ctx.fill()});
 R.obs.forEach(o=>{if(o.kind==='fence'){ctx.fillStyle='#b98552';ctx.strokeStyle='#8a5d33';ctx.lineWidth=2;const posts=o.w>30?3:2;for(let p=0;p<posts;p++){const px=o.x+p*(o.w-8)/(posts-1);rr(ctx,px,o.y,8,o.h,2);ctx.fill();ctx.stroke()}rr(ctx,o.x-2,o.y+7,o.w+4,6,2);ctx.fill();ctx.stroke();rr(ctx,o.x-2,o.y+o.h*.55,o.w+4,6,2);ctx.fill();ctx.stroke()}
  else if(o.kind==='mud'){ctx.fillStyle='#8a6a48';ctx.beginPath();ctx.ellipse(o.x+o.w/2,o.y+8,o.w/2,8,0,0,7);ctx.fill();ctx.fillStyle='#a58561';ctx.beginPath();ctx.arc(o.x+o.w*.3,o.y+5,3,0,7);ctx.arc(o.x+o.w*.65,o.y+7,2.5,0,7);ctx.fill()}
  else{const fl=Math.sin(o.flap*14)>0;ctx.fillStyle='#3d3a40';ctx.beginPath();ctx.ellipse(o.x+22,o.y+12,17,8,0,0,7);ctx.fill();ctx.beginPath();ctx.arc(o.x+6,o.y+9,7,0,7);ctx.fill();ctx.fillStyle='#f0a63a';ctx.beginPath();ctx.moveTo(o.x-6,o.y+10);ctx.lineTo(o.x+2,o.y+7);ctx.lineTo(o.x+2,o.y+13);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(o.x+5,o.y+7,2,0,7);ctx.fill();
   ctx.fillStyle='#55505a';ctx.beginPath();ctx.moveTo(o.x+14,o.y+10);ctx.lineTo(o.x+32,o.y+10);ctx.lineTo(o.x+26,fl?o.y-10:o.y+26);ctx.fill()}});
 runnerPig(ctx,R,t);
 ctx.fillStyle='#6a7660';ctx.font='700 16px Segoe UI, Microsoft YaHei, sans-serif';ctx.textAlign='right';const best=Store.get('runner-default',0);ctx.fillText((best?'最高 '+String(best).padStart(5,'0')+'   ':'')+String(Math.floor(R.score)).padStart(5,'0'),786,24);
 if(R.over){ctx.fillStyle='rgba(255,255,255,.3)';ctx.fillRect(0,0,800,220)}ctx.restore()}
function runnerPig(ctx,R,t){const p=R.pig,duck=p.duck&&!p.air,bob=p.air?0:Math.abs(Math.sin(R.dist/18))*1.8;ctx.save();ctx.translate(p.x+25,p.y-bob);if(R.over)ctx.rotate(.25);if(PIG_IMAGE.complete&&PIG_IMAGE.naturalWidth){ctx.scale(-1,1);ctx.drawImage(PIG_IMAGE,-39,duck?-32:-58,78,duck?36:64)}ctx.restore();ctx.fillStyle='rgba(90,100,60,.12)';ctx.beginPath();ctx.ellipse(p.x+25,R.ground+3,Math.max(5,24-(R.ground-p.y)*.08),4,0,0,7);ctx.fill()}

// ---------- wiring ----------
document.querySelectorAll('[data-game]').forEach(b=>b.onclick=e=>{if(b.dataset.game!==game)selectGame(b.dataset.game);if(e.detail)b.blur();if(game==='merge')document.querySelector('.merge-board').focus({preventScroll:true})});
$('restart').onclick=()=>{newGame();Sound.greet()};$('pause').onclick=()=>{setPause(!paused);Sound.click()};$('resume').onclick=()=>setPause(false);
document.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]')||['SELECT','INPUT','TEXTAREA'].includes(e.target.tagName)||e.ctrlKey||e.altKey||e.metaKey)return;const k=e.key.toLowerCase();
 if(k==='r'){e.preventDefault();newGame();Sound.greet();return}if(k==='p'){e.preventDefault();setPause(!paused);return}if(k==='m'){e.preventDefault();toggleMute();return}
 if(Extra.has(game)&&Extra.keyDown(e))return;
 if(game==='mine'&&k==='f'){e.preventDefault();setMode(!mode)}
 const dir={arrowleft:'left',a:'left',arrowright:'right',d:'right',arrowup:'up',w:'up',arrowdown:'down',s:'down'}[k];if(dir&&(game==='merge'||game==='snake')){e.preventDefault();arcadeDir(dir)}
 if(game==='runner'){if(k===' '||k==='arrowup'||k==='w'){e.preventDefault();if(!e.repeat)runnerJump()}else if(k==='arrowdown'||k==='s'){e.preventDefault();runnerDuck(true)}}});
document.addEventListener('keyup',e=>{Extra.keyUp(e);if(game!=='runner'||!state||!state.run)return;const k=e.key.toLowerCase();if(k===' '||k==='arrowup'||k==='w')state.run.release();if(k==='arrowdown'||k==='s')runnerDuck(false)});
document.addEventListener('visibilitychange',()=>{if(document.hidden)setPause(true)});window.addEventListener('blur',()=>setPause(true));
let resizeTimer=0;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(game==='mine')fitMine();if(game==='snake'&&state.cv)fitSnake();if(game==='runner'&&state.cv)fitRunner();if(Extra.has(game))Extra.resize()},80)});
function openDialog(id){setPause(true);Sound.stop();$(id).showModal()}
$('audio-settings').onclick=()=>openDialog('sound-dialog');$('about').onclick=()=>openDialog('about-dialog');document.querySelectorAll('dialog .close').forEach(b=>b.onclick=()=>b.closest('dialog').close());document.querySelectorAll('dialog').forEach(d=>{d.addEventListener('close',()=>Sound.stop());d.addEventListener('click',e=>{if(e.target===d)d.close()})});
function syncSound(){$('sound-toggle').innerHTML=icon(Sound.enabled?'i-sound':'i-mute');$('sound-toggle').classList.toggle('off',!Sound.enabled);$('sound-toggle').setAttribute('aria-pressed',Sound.enabled);$('sound-toggle').setAttribute('aria-label',Sound.enabled?'关闭声音':'打开声音');
 [['volume','volume-label','volume'],['pig-volume','pig-label','pigVolume'],['fx-volume','fx-label','fxVolume']].forEach(([inp,lab,key])=>{$(inp).value=Math.round(Sound[key]*100);$(lab).textContent=Math.round(Sound[key]*100)+'%'});Sound.save()}
function toggleMute(){Sound.enabled=!Sound.enabled;if(!Sound.enabled)Sound.stop();syncSound();if(Sound.enabled){Sound.unlock();Sound.click()}}
function wake(){Sound.unlock();if(!Sound.enabled||!Sound.volume){Sound.enabled=true;if(!Sound.volume)Sound.volume=.75;syncSound()}}
Sound.onvoice=(i,on)=>{const b=document.querySelector(`[data-voice="${i}"]`);if(b&&$('sound-dialog').open)b.classList.toggle('playing',on);if(on&&$('sound-dialog').open)$('voice-status').textContent='正在播放：'+Sound.names[i]};
document.querySelectorAll('[data-voice]').forEach(b=>b.onclick=()=>{wake();Sound.preview(+b.dataset.voice)});
$('random-voice').onclick=()=>{wake();Sound.stop();Sound.voice(null)};
$('demo-chain').onclick=()=>{wake();Sound.stop();$('voice-status').textContent='连环炸猪：24 只小猪依次醒来';Sound.boom({big:true,voice:3,rate:.92,gain:1});Sound.chain(Array.from({length:24},(_,k)=>({pan:Math.random()*1.6-.8})))};
$('demo-win').onclick=()=>{wake();Sound.stop();$('voice-status').textContent='胜利合唱：四只猪轮流再齐声';Sound.win()};
[['volume','volume'],['pig-volume','pigVolume'],['fx-volume','fxVolume']].forEach(([inp,key])=>$(inp).oninput=()=>{Sound[key]=Number($(inp).value)/100;syncSound()});
$('sound-toggle').onclick=toggleMute;
$('license').textContent=`MIT License\nCopyright (c) 2020 Ania Kubow\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`;
PigLook.onchange=()=>{PIG_IMAGE.src=PigLook.src();PIG_SPRITES.forEach((im,i)=>im.src=pigSrc(PIG_LEVELS[i][0]));Extra.changeLook();Sound.hintSpark();message('新造型已换好，本局进度已保留。')};
$('look-settings').onclick=()=>openDialog('look-dialog');
$('look-choices').innerHTML=PigLook.looks.map(([id,name,color])=>`<button data-look="${id}" aria-pressed="${PigLook.active===id}"><img src="${PigLook.src('pig',id)}" alt=""><b>${name}</b><small>圆滚滚，软乎乎</small></button>`).join('');document.querySelectorAll('[data-look]').forEach(b=>b.onclick=()=>{PigLook.choose(b.dataset.look);renderLookPreview();Sound.pigHappy()});
function renderLookPreview(){$('look-preview').innerHTML=['crown','wizard','chef','space','bow','bee'].map(r=>`<img src="${PigLook.src(r)}" alt="${pigCardNames[r]}" title="${pigCardNames[r]}">`).join('')}renderLookPreview();
// 点主视觉的小猪：随机一声轻快猪哼
const heroLines=['哼唧！','再摸一下嘛～','肚子圆滚滚','今天也要开心哦','哼哼～'];$('hero-pig').onclick=()=>{Sound.unlock();Sound.pigHappy();say(heroLines[Math.floor(Math.random()*heroLines.length)])};
document.querySelectorAll('[data-sound-profile]').forEach(b=>{b.setAttribute('aria-pressed',b.dataset.soundProfile===Sound.profile);b.onclick=()=>{Sound.stop();Sound.profile=b.dataset.soundProfile;Sound.save();document.querySelectorAll('[data-sound-profile]').forEach(x=>x.setAttribute('aria-pressed',x===b));wake();Sound.hintSpark()}});
const demos={bounce:()=>{Sound.paddleBounce();Sound.brickPop()},blocks:()=>Sound.blockClear(4),flap:()=>{Sound.flapWing();Sound.gatePass(1)},stack:()=>Sound.stackLand(true),chess:()=>Sound.chessDrop(1),box:()=>Sound.boxPush(true),light:()=>Sound.lightFlip(true),combo:()=>Sound.matchPower('rainbow'),slice:()=>Sound.sliceCut(3,3),shield:()=>Sound.starShield(),rhythm:()=>[0,1,2,3].forEach((n)=>Sound.later(n*240,()=>Sound.rhythmBeat(n,124))),roulette:()=>[()=>Sound.rlPage(),()=>Sound.rlScan(.6),()=>Sound.rlChew(1),()=>Sound.rlFart(),()=>Sound.rlSplat(false),()=>Sound.rlPop(),()=>Sound.rlHit(true,3)].forEach((f,k)=>Sound.later(k*720,f))};document.querySelectorAll('[data-audio-demo]').forEach(b=>b.onclick=()=>{wake();Sound.stop();demos[b.dataset.audioDemo]();$('voice-status').textContent='正在试听：'+b.textContent});
document.querySelectorAll('[data-pig-sound]').forEach(b=>b.onclick=()=>{wake();Sound.stop();const k=b.dataset.pigSound;if(k==='pigWail')Sound.pigWail(true);else Sound[k]();$('voice-status').textContent='正在试听：'+b.textContent});
$('game-search').oninput=e=>{const word=e.target.value.trim().toLowerCase();let count=0;document.querySelectorAll('.nav').forEach(b=>{b.hidden=!b.textContent.toLowerCase().includes(word);if(!b.hidden)count++});$('search-empty').hidden=!!count;$('game-count').textContent=count+' / '+Object.keys(configs).length+' 款'};
syncSound();selectGame('mine',false);requestAnimationFrame(frame);
