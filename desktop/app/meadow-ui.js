(function(root){
'use strict';
const M=root.PigMeadow;
const configs={
 pipes:{name:'猪猪水管工',icon:'i-pipe',title:'给每一间猪舍通上水。',subtitle:'转动弯管、直管和三通，让水从粉色水泵流遍整块棋盘。',tag:'管道益智 · 每局新谜题',eyebrow:'30 / WATER WORKS',note:'先把指向外墙的管口转回来。',levels:[['easy','4×4'],['normal','5×5'],['hard','6×6']],defaultLevel:'easy',labels:['旋转次数','已通水','最佳步数']},
 nonogram:{name:'猪猪数字画',icon:'i-pixels',title:'数字里藏着一幅画。',subtitle:'看每行和每列的线索，涂出一格格图案。',tag:'数织 · 9 幅像素画',eyebrow:'31 / PIXEL PATCH',note:'同一行的两组墨格中间至少空一格。',levels:[['easy','5×5'],['normal','7×7'],['hard','9×9']],defaultLevel:'easy',labels:['已涂格数','用时（秒）','最快（秒）']},
 crossing:{name:'猪猪过河',icon:'i-crossing',title:'送四只猪仔平安回家。',subtitle:'躲过农场小车，搭木筏过河，再跳进空着的猪舍。',tag:'街机闯关 · 三条命',eyebrow:'32 / RIVER DASH',note:'木筏会带着猪猪漂移。',levels:[['easy','悠闲'],['normal','标准'],['hard','飞快']],defaultLevel:'normal',labels:['本局得分','回家 / 生命','最高得分']}
};
const arrow={ArrowUp:[0,-1],ArrowRight:[1,0],ArrowDown:[0,1],ArrowLeft:[-1,0]};
const moves={...arrow,w:arrow.ArrowUp,d:arrow.ArrowRight,s:arrow.ArrowDown,a:arrow.ArrowLeft};
const pad={up:arrow.ArrowUp,right:arrow.ArrowRight,down:arrow.ArrowDown,left:arrow.ArrowLeft};
const endings={car:'碰到小车了！',water:'没有踩到木筏！',edge:'木筏漂出河面了！',pen:'要跳进空着的猪舍！',time:'这趟来不及了！'};
const bitNames=[[1,'上'],[2,'右'],[4,'下'],[8,'左']];
const pipePaths=[[1,'M20 20V0'],[2,'M20 20H40'],[4,'M20 20V40'],[8,'M20 20H0']];
const cellLabel=(i,n)=>`第 ${Math.floor(i/n)+1} 行第 ${i%n+1} 列`;
const has=id=>Object.prototype.hasOwnProperty.call(configs,id);
function create(ctx){
 const {$,Store,Sound,message,stats,record,result,confetti,rr,dpadHTML,pigSrc,get,setState,setRunning,nextLevel}=ctx;
 const pig=new Image(),noop=()=>{};
 let paintedSecond=-1;
 function bindGrid(grid,size,act){
  const buttons=Array.from(grid.querySelectorAll('[data-cell]'));
  grid.onclick=e=>{const b=e.target.closest('[data-cell]');if(b)act(Number(b.dataset.cell),false)};
  grid.oncontextmenu=e=>{
   const b=e.target.closest('[data-cell]');
   if(b){e.preventDefault();act(Number(b.dataset.cell),true)}
  };
  grid.addEventListener('focusin',e=>{
   if(!e.target.matches('[data-cell]'))return;
   grid.querySelector('[tabindex="0"]')?.setAttribute('tabindex','-1');
   e.target.tabIndex=0;
  });
  grid.onkeydown=e=>{
   if(!arrow[e.key]||!e.target.matches('[data-cell]'))return;
   const i=Number(e.target.dataset.cell),[dx,dy]=arrow[e.key];
   const x=i%size+dx,y=Math.floor(i/size)+dy;
   e.preventDefault();
   if(x>=0&&x<size&&y>=0&&y<size)buttons[y*size+x].focus();
  };
 }
 function complete(title,body){
  get().state.finished=true;Sound.win();confetti(32);message(title,'ok');result(title,body,true,0);
 }
 function initPipes(level){
  const size={easy:4,normal:5,hard:6}[level],model=M.pipes(size);
  setState({...model,steps:0,history:[],assisted:false,finished:false});
  $('play-toolbar').innerHTML='<button class="secondary" id="pipe-undo" disabled>撤一步</button><button class="secondary" id="pipe-hint">提示一步</button>';
  $('board').innerHTML=`<div class="pipe-board" id="pipe-board" role="group" aria-label="管道棋盘" style="--size:${size}">${model.tiles.map((_,i)=>`<button class="pipe-cell" data-cell="${i}" tabindex="${i===0?0:-1}"></button>`).join('')}</div>`;
  bindGrid($('pipe-board'),size,(i,back)=>pipeMove(i,back?-1:1));
  $('pipe-undo').onclick=pipeUndo;$('pipe-hint').onclick=pipeHint;
  paintPipes();
  message('粉色水泵是起点。点格子转管，所有管口都要接上。');
 }
 function paintPipes(){
  const t=get().state,info=M.pipeStatus(t.tiles,t.size,t.source);
  for(const b of $('pipe-board').children){
   const i=Number(b.dataset.cell),mask=t.tiles[i],live=info.connected.has(i),pump=i===t.source;
   const path=pipePaths.filter(([bit])=>mask&bit).map(([,d])=>d).join(' ');
   b.classList.toggle('powered',live);b.classList.toggle('pump',pump);
   b.setAttribute('aria-label',`${cellLabel(i,t.size)}，${pump?'水泵，':''}${bitNames.filter(([bit])=>bit&mask).map(([,n])=>n).join('、')}出管，${live?'已通水':'未通水'}`);
   b.innerHTML=`<svg viewBox="0 0 40 40" aria-hidden="true"><path class="pipe-edge" d="${path}"/><path class="pipe-water" d="${path}"/><circle cx="20" cy="20" r="${pump?8:4}"/></svg>`;
  }
  $('pipe-undo').disabled=t.finished||!t.history.length;
  $('pipe-hint').disabled=t.finished;
  stats(t.steps,`${info.connected.size} / ${t.tiles.length}`);
  return info;
 }
 function pipeMove(i,turn,assist=false){
  const {state:t,paused}=get();if(paused||t.finished)return;
  const next=M.rotate(t.tiles[i],turn);
  if(next===t.tiles[i]){message('这个十字管四面相同，可以先看旁边。');return}
  t.history.push([i,t.tiles[i]]);t.tiles[i]=next;t.steps++;
  if(assist)t.assisted=true;
  setRunning(true);Sound.lightFlip(true);
  const info=paintPipes();
  if(info.solved){
   if(!t.assisted)record(t.steps,true);
   complete('所有猪舍都通水啦！',`旋转 ${t.steps} 次。${t.assisted?'本局用过提示。':''}`);
   paintPipes();
  }else message(`还有 ${info.leaks} 个未接好的管口。${assist?'这一步朝一种可行解旋转。':''}`);
 }
 function pipeUndo(){
  const {state:t,paused}=get();if(paused||t.finished||!t.history.length)return;
  const [i,mask]=t.history.pop();t.tiles[i]=mask;t.steps--;
  paintPipes();Sound.click();message('退回上一次旋转。');
 }
 function pipeHint(){
  const {state:t,paused}=get();if(paused||t.finished)return;
  const i=t.tiles.findIndex((mask,i)=>mask!==t.solution[i]);
  if(i<0)return;
  const turn=M.rotate(t.tiles[i],-1)===t.solution[i]?-1:1;
  pipeMove(i,turn,true);
  if(!t.finished)$('pipe-board').children[i].focus({preventScroll:true});
 }
 function initPicture(level){
  const count=M.drawings[level].length,key='picture-index-'+level,saved=Store.get(key,0);
  const index=Number.isInteger(saved)&&saved>=0&&saved<count?saved:0;
  const picture=M.picture(level,index),n=picture.size;
  setState({...picture,cells:Array(n*n).fill(0),mark:1,finished:false});
  $('play-toolbar').innerHTML=`<div class="pixel-tools" aria-label="绘画工具"><button class="mode" data-mark="1" aria-pressed="true">涂色</button><button class="mode" data-mark="-1" aria-pressed="false">打叉</button><button class="mode" data-mark="0" aria-pressed="false">擦除</button></div><button class="secondary" id="pixel-next">换一幅 · ${index+1}/${count}</button>`;
  $('play-toolbar').querySelectorAll('[data-mark]').forEach(b=>b.onclick=()=>{
   get().state.mark=Number(b.dataset.mark);
   $('play-toolbar').querySelectorAll('[data-mark]').forEach(x=>x.setAttribute('aria-pressed',x===b));Sound.click();
  });
  $('pixel-next').onclick=()=>{Store.set(key,(index+1)%count);nextLevel(level);Sound.click()};
  const clue=(values,label,where)=>`<span class="pixel-clue ${where}" data-${where} aria-label="${label}：${values.join('、')}">${values.map(v=>`<b>${v}</b>`).join('')}</span>`;
  const cols=picture.cols.map((v,i)=>clue(v,`第 ${i+1} 列`,'col')).join('');
  const rows=picture.rows.map((v,y)=>clue(v,`第 ${y+1} 行`,'row')+
   pixelCells(y,n)).join('');
  $('board').innerHTML=`<div class="pixel-board" id="pixel-board" role="group" aria-label="数字画棋盘" style="--size:${n}"><span class="pixel-corner" aria-hidden="true">数字<br>画</span>${cols}${rows}</div>`;
  bindGrid($('pixel-board'),n,(i,alternate)=>pixelMove(i,alternate?-1:get().state.mark));
  paintedSecond=-1;paintPicture();
  message('数字是连续涂色的格数。确定留白时，可以打叉。');
 }
 function pixelCells(y,n){
  return Array.from({length:n},(_,x)=>`<button class="pixel-cell" data-cell="${y*n+x}" tabindex="${x===0&&y===0?0:-1}"></button>`).join('');
 }
 function paintPicture(){
  const {state:t,elapsed}=get(),grid=$('pixel-board'),paint=t.cells.map(c=>c===1?1:0);
  const actual=M.pixelClues(paint,t.size);
  grid.querySelectorAll('[data-cell]').forEach((b,i)=>{
   const c=t.cells[i];b.dataset.ink=c;
   b.textContent=c===-1&&!t.finished?'×':'';
   b.setAttribute('aria-label',`${cellLabel(i,t.size)}，${c===1?'已涂色':c===-1?'已打叉':'未标记'}`);
  });
  const ok=(kind,clues)=>Array.from(grid.querySelectorAll('[data-'+kind+']'),(b,i)=>{
   const matches=clues[i].join()===actual[kind+'s'][i].join();
   b.classList.toggle('matched',matches);
   return matches;
  }).every(Boolean);
  const rowsOK=ok('row',t.rows),colsOK=ok('col',t.cols);
  paintedSecond=t.seconds??Math.floor(elapsed/1000);
  stats(paint.reduce((a,b)=>a+b,0),paintedSecond);
  return rowsOK&&colsOK;
 }
 function pixelMove(i,mark){
  const {state:t,paused,elapsed}=get();if(paused||t.finished)return;
  const next=t.cells[i]===mark?0:mark;
  if(t.cells[i]===next)return;
  t.cells[i]=next;setRunning(true);Sound.lightFlip(next===1);
  if(paintPicture()){
   const seconds=Math.max(1,Math.ceil(elapsed/1000));t.seconds=seconds;record(seconds,true);
   complete('画出来了！',`这幅画是「${t.name}」，用时 ${seconds} 秒。`);
   $('pixel-board').classList.add('revealed');paintPicture();
  }
 }

 const CELL=48,W=M.WIDTH*CELL,H=M.HEIGHT*CELL;
 function initCrossing(level){
  const g=new M.Crossing(level);
  $('board').innerHTML=`<div class="cross-scene"><canvas id="cross-canvas" aria-label="过河场地，从下到上依次是草地、车道、休息带、河面和四间猪舍"></canvas><div class="cross-start" id="cross-start"><button class="primary" id="cross-go">带猪仔出发</button><small>方向键 / WASD / 下方方向按钮</small></div></div><div class="cross-meter" role="progressbar" aria-label="本趟剩余时间（秒）" aria-valuemin="0" aria-valuemax="${g.time}"><i></i></div>${dpadHTML()}`;
  const cv=$('cross-canvas'),dpr=Math.min(2,window.devicePixelRatio||1);
  cv.width=W*dpr;cv.height=H*dpr;
  const c=cv.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);
  setState({g,c,finished:false});
  $('cross-go').onclick=crossStart;
  $('board').querySelectorAll('[data-dir]').forEach(b=>b.onclick=()=>crossMove(pad[b.dataset.dir]));
  pig.onload=()=>{if(get().game==='crossing')drawCrossing()};
  pig.src=pigSrc();
  crossStats();crossTime(g);drawCrossing();message('让四只猪仔各回一间猪舍。到了河边，等木筏漂过来再跳。');
 }
 function crossStart(){
  const {state:{g},paused}=get();if(paused||g.status!=='ready')return;
  g.start();setRunning(true);$('cross-start').hidden=true;Sound.greet();message('先看车，再走！');
 }
 function crossMove([dx,dy]){
  if(get().paused)return;
  crossStart();crossEvent(get().state.g.move(dx,dy));drawCrossing();
 }
 function crossStats(){
  const {g}=get().state;
  stats(g.score,`${g.pens.size}/${M.PENS.length} · ${g.lives}♥`);
 }
 function crossTime(g){
  const meter=document.querySelector('.cross-meter'),second=String(Math.ceil(g.remaining));
  if(meter.getAttribute('aria-valuenow')!==second)meter.setAttribute('aria-valuenow',second);
  meter.firstElementChild.style.width=`${100*g.remaining/g.time}%`;
 }
 function crossEvent(event){
  if(!event)return;
  const {g}=get().state;
  if(event==='step')Sound.jump();
  else if(event==='home'){Sound.win();message('到家一只！下一只从草地出发。','ok')}
  else if(event==='win'){
   record(g.score);complete('四只猪仔都到家啦！',`本局 ${g.score} 分，还剩 ${g.lives} 条命。`);
  }else{
   Sound.crash();message(endings[event]+(g.lives?' 从草地再来。':''),'warn');
   if(!g.lives){record(g.score);get().state.finished=true;result('猪仔先休息一下。',endings[event]+` 本局 ${g.score} 分，${g.pens.size} 只猪仔到家。`,false,500)}
  }
  crossStats();
 }
 function drawCrossing(){
  const {g,c}=get().state;
  for(let y=0;y<M.HEIGHT;y++){
   const water=y>=2&&y<=4,road=y>=6&&y<=8,py=y*CELL;
   c.fillStyle=water?(y%2?'#77b6bf':'#8bc5ca'):road?(y%2?'#5a6270':'#626c78'):(y%2?'#c7dea0':'#b2cc8c');
   c.fillRect(0,py,W,CELL);
   if(water||road){
    c.strokeStyle=water?'#acd7d8':'#e8dabb';c.setLineDash(water?[12,20]:[17,13]);
    c.beginPath();c.moveTo(0,py+CELL-2);c.lineTo(W,py+CELL-2);c.stroke();c.setLineDash([]);
   }else{
    c.fillStyle='#8ba96d';
    for(let x=12;x<W;x+=31){c.fillRect(x,py+9+(x%17),5,2);c.fillRect(x+2,py+7+(x%17),2,6)}
   }
  }
  const box=(x,y,w,h,r,color)=>{c.fillStyle=color;rr(c,x,y,w,h,r);c.fill()};
  for(const lane of g.lanes){
   const y=lane.row*CELL,w=lane.length*CELL;
   for(const pos of M.Crossing.objects(lane)){
    const x=pos*CELL;
    if(lane.type==='water'){
     box(x,y+6,w,36,12,'#835f49');box(x+3,y+6,w-6,28,10,'#bd8958');
     c.fillStyle='#9e6d48';c.fillRect(x+10,y+15,w-20,2);c.fillRect(x+10,y+24,w-20,2);
    }else{
     const front=lane.speed>0?x+w-10:x+5;
     box(x+7,y+6,13,36,3,'#3b414b');box(x+w-20,y+6,13,36,3,'#3b414b');
     box(x,y+9,w,30,9,['#eeb36e','#e38fa3','#8cb3d9'][lane.row-6]);
     box(x+w*.35,y+12,w*.26,24,5,'#455e70');
     c.fillStyle='#fff0a4';c.fillRect(front,y+15,5,5);c.fillRect(front,y+28,5,5);
    }
   }
  }
  const drawPig=(x,y)=>{
   if(pig.complete&&pig.naturalWidth)c.drawImage(pig,x-23,y-25,46,46);
   else{c.fillStyle='#f4b3c0';c.beginPath();c.arc(x,y,16,0,2*Math.PI);c.fill()}
  };
  M.PENS.forEach((pos,i)=>{
   const x=pos*CELL,full=g.pens.has(i);
   box(x-22,3,44,42,10,full?'#f8d2d9':'#f6e4b9');
   box(x-17,8,34,32,8,full?'#fbe7eb':'#c5ab77');
   if(full)drawPig(x,24);
  });
  if(g.status!=='won'&&g.status!=='lost')drawPig(g.x*CELL,(g.y+.5)*CELL);
 }
 function tick(dt){
  const {game,paused,running,elapsed,state}=get();
  if(game==='nonogram'&&running&&!paused){
   const second=Math.floor(elapsed/1000);
   if(paintedSecond!==second){paintedSecond=second;stats(state.cells.filter(c=>c===1).length,second)}
  }
  if(game==='crossing'&&running&&!paused){
   crossEvent(state.g.tick(dt/1000));
   crossTime(state.g);
   drawCrossing();
  }
 }
 function keyDown(e){
  const {game,state}=get(),key=e.key.length===1?e.key.toLowerCase():e.key;
  if(game==='crossing'&&moves[key]){e.preventDefault();crossMove(moves[key]);return true}
  if(game==='pipes'&&(key==='u'||key==='h')){e.preventDefault();if(!e.repeat)(key==='u'?pipeUndo:pipeHint)();return true}
  if(game==='nonogram'&&key==='x'&&e.target.closest('#pixel-board [data-cell]')){
   e.preventDefault();if(!e.repeat&&!state.finished)pixelMove(Number(e.target.dataset.cell),-1);return true;
  }
  return false;
 }
 return {has,init(id){
  const {level}=get();
  if(id==='pipes')initPipes(level);
  else if(id==='nonogram')initPicture(level);
  else initCrossing(level);
 },tick,keyDown,keyUp:noop,clearKeys:noop,resize:noop,changeLook(){if(get().game==='crossing')pig.src=pigSrc()}};
}
root.PigMeadowUI={configs,create};
})(window);
