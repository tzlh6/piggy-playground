/* Android-only Xiangqi lessons. Original UI and annotations, backed by the pinned rules and Pikafish. */
(()=>{
'use strict';
const C=window.PigXiangqiCoach,D=window.PigXiangqiLessons;
if(!C||!D||!window.PigAndroid)return;
const dialog=document.createElement('dialog');dialog.id='xq-school';dialog.className='xqs';dialog.setAttribute('aria-label','军师猪象棋学堂');
dialog.innerHTML=`<header class="xqs-head"><div class="xqs-mascot" aria-hidden="true"></div><div><small>手机专属 · 中国象棋</small><h2>军师猪象棋学堂</h2><p>先想一步，再听军师讲解</p></div><button class="xqs-close" aria-label="关闭象棋学堂">×</button></header><nav class="xqs-tabs" aria-label="学习方式"><button data-mode="coach" aria-pressed="true">AI教练</button><button data-mode="lessons" aria-pressed="false">杀招闯关</button><button data-mode="records" aria-pressed="false">棋谱研习</button></nav><div class="xqs-content"><section class="xqs-picker" id="xqs-picker"></section><div class="xqs-title"><h3 id="xqs-title"></h3><span id="xqs-turn"></span></div><p id="xqs-idea" class="xqs-idea"></p><div class="xqs-board-wrap"><svg class="xqs-lines" viewBox="0 0 900 1000" aria-hidden="true"></svg><div class="xqs-board" role="group" aria-label="教学棋盘"></div></div><p id="xqs-status" role="status" aria-live="polite"></p><div class="xqs-actions"><button id="xqs-reset">重练</button><button id="xqs-flip">翻转棋盘</button><button id="xqs-prev">上一步</button><button id="xqs-next">下一步</button><button id="xqs-demo">看演示</button><button id="xqs-hint">给点提示</button></div><div class="xqs-coach"><div class="xqs-coach-bar"><label>思考 <select id="xqs-time" aria-label="教练思考时间"><option value="1000">1秒</option><option value="2000" selected>2秒</option><option value="4000">4秒</option></select></label><button id="xqs-ask" class="primary">请教军师</button><button id="xqs-stop" hidden>停止分析</button></div><p id="xqs-analysis-status" role="status" aria-live="polite">比较候选走法，看清将军、吃子和后续变化。</p><div id="xqs-analysis"></div></div><details class="xqs-import"><summary>导入或复制棋谱</summary><p>支持ICCS坐标着法，例如 <code>h2e2 h9g7</code>；可带PGN的 FEN、Event 头。粘贴后会逐手检查是否合法。</p><textarea id="xqs-record" aria-label="ICCS棋谱" rows="5" placeholder="h2e2 h9g7 h0g2 b9c7"></textarea><div class="xqs-actions"><button id="xqs-import">读入棋谱</button><button id="xqs-export">生成当前棋谱</button></div><p id="xqs-import-status" role="status"></p></details><p class="xqs-foot">教学棋盘独立保存学习进度。原对局的局面、成绩和存档保持原样。候选分数以当前行棋方为视角；有限时间的分析不等于必胜保证。</p></div>`;
document.body.append(dialog);
dialog.querySelector('.xqs-mascot').innerHTML=PigArt.inline({skin:'peach',role:'wizard',viewBox:'0 -10 160 170'});
const $=id=>dialog.querySelector('#'+id),board=dialog.querySelector('.xqs-board');
const chars={1:{k:'帅',a:'仕',b:'相',n:'马',r:'车',c:'炮',p:'兵'},2:{k:'将',a:'士',b:'象',n:'马',r:'车',c:'炮',p:'卒'}};
const lines=dialog.querySelector('.xqs-lines');let svg='';for(let y=0;y<10;y++)svg+=`<path d="M50 ${50+y*100}H850"/>`;for(let x=0;x<9;x++)svg+=`<path d="M${50+x*100} 50V${x===0||x===8?950:450}${x===0||x===8?'':`M${50+x*100} 550V950`}"/>`;svg+='<path d="M350 50L550 250M550 50L350 250M350 750L550 950M550 750L350 950"/><text x="250" y="515">楚 河</text><text x="650" y="515">汉 界</text>';lines.innerHTML=svg;
let mode='coach',session=C.game(),base=session.view(1).fen,selected=null,item=null,index=0,flip=false,timer=null,busy=false,ticket=0,analysis=null,demonstrating=false;
const done=Store.get('xiangqi-school-passed-v1',{})||{};
function cancel(){ticket++;C.cancel();busy=false;$('xqs-stop').hidden=true;$('xqs-ask').disabled=false;}
function stopDemo(){if(timer)clearTimeout(timer);timer=null;demonstrating=false;}
function say(text){$('xqs-status').textContent=text;}
function resetAnalysis(){cancel();analysis=null;$('xqs-analysis').replaceChildren();$('xqs-analysis-status').textContent='比较候选走法，看清将军、吃子和后续变化。';}
function sessionAt(n){return C.replay(item?.fen,item?.line||[],n);}
function render(){
 const view=session.view(session.turn),b=view.board,legal=session.legalMoves(session.turn),choices=new Set(selected?legal.filter(m=>m.from===selected).map(m=>m.to):[]);board.replaceChildren();
 for(let y=0;y<10;y++)for(let x=0;x<9;x++){
  const xx=flip?8-x:x,yy=flip?9-y:y,sq=String.fromCharCode(97+xx)+(9-yy),p=b[yy][xx],button=document.createElement('button');button.type='button';button.dataset.square=sq;button.className='xqs-square'+(p?' has-piece side-'+p.player:'')+(sq===selected?' selected':'')+(choices.has(sq)?' legal':'');button.setAttribute('aria-label',(p?(p.player===1?'红':'黑')+chars[p.player][p.type]:'空位')+' '+sq);if(p){const span=document.createElement('span');span.textContent=chars[p.player][p.type];button.append(span);}button.addEventListener('click',()=>click(sq));board.append(button);
 }
 $('xqs-turn').textContent=session.status.over?(session.status.winner===1?'红方胜':session.status.winner===2?'黑方胜':'和棋'):(session.turn===1?'红方':'黑方')+'行棋'+(session.status.check?' · 正被将军':'');
 $('xqs-prev').hidden=mode!=='records';$('xqs-next').hidden=mode!=='records';$('xqs-prev').disabled=index<=0;$('xqs-next').disabled=!item||index>=item.line.length;
 $('xqs-hint').hidden=mode!=='lessons';$('xqs-demo').hidden=mode==='coach';$('xqs-reset').textContent=mode==='records'?'回到开头':mode==='lessons'?'重练':'重新摆回';
 if(mode==='records')$('xqs-idea').textContent=index?item.comments?.[index-1]||'先看本步造成的威胁，再判断对方如何应对。':item.idea;
}
function moveUser(u){
 if(busy||timer||session.status.over)return;resetAnalysis();const before=session.view(session.turn).fen,side=session.turn,label=C.notation(session,u),event=session.dispatch(side,C.move(u));if(!event.ok)return;
 selected=null;
 if(mode==='lessons'){
  const won=session.status.over&&session.status.winner===side;
  if(won){done[item.id]=true;Store.set('xiangqi-school-passed-v1',done);say('答对了！'+label+'。'+item.idea);updateProgress();}
  else if(u!==item.line[index]){session.undo();say(label+' 还没有完成本题的收网路线。再检查将军、封路和对方退路。');render();return;}
  else{index++;if(index<item.line.length){const reply=item.line[index++];session.dispatch(session.turn,C.move(reply));say('对方应将后，请继续找下一步。');}else say(item.idea);}
 }else{say(label+'：'+C.describe(before,u).text);}
 render();
}
function click(sq){
 if(mode==='records')return say('棋谱研习可用“上一步”“下一步”，也可以点“请教军师”分析这一刻。');
 if(busy||timer||session.status.over)return;const legal=session.legalMoves(session.turn),p=C.square(sq),piece=session.view(session.turn).board[p.y][p.x];
 if(selected&&legal.some(m=>m.from===selected&&m.to===sq))return moveUser(selected+sq);
 selected=piece?.player===session.turn?sq:null;render();
}
function updateProgress(){const label=$('xqs-progress');if(label)label.textContent='已掌握 '+D.lessons.filter(l=>done[l.id]).length+' / '+D.lessons.length+' 题';}
function picker(){
 const target=$('xqs-picker');target.replaceChildren();
 if(mode==='coach'){
  const p=document.createElement('p');p.textContent='在教学副本里试走，或把当前对局请进来分析。';target.append(p);
  const button=document.createElement('button');button.textContent='取当前中国象棋局面';button.onclick=()=>{const live=typeof state!=='undefined'&&state?.id==='xiangqi'?state:null;if(!live)return say('先进入“中国象棋”下一盘，再来取当前局面。');base=live.m.view(live.m.turn).fen;session=C.game(base);selected=null;resetAnalysis();say('已取当前局面。先试走，也可以直接请教军师。');render();};target.append(button);
 }else{
  const label=document.createElement('label');label.textContent=mode==='lessons'?'选择杀招 ':'选择棋谱 ';const select=document.createElement('select');select.id='xqs-library';select.setAttribute('aria-label',mode==='lessons'?'选择杀招':'选择棋谱');
  const list=mode==='lessons'?D.lessons:D.openings;for(const entry of list){const option=document.createElement('option');option.value=entry.id;option.textContent=entry.title+(entry.difficulty?' · '+entry.difficulty:'');select.append(option);}if(item&&!list.some(l=>l.id===item.id)){const option=document.createElement('option');option.value=item.id;option.textContent=item.title;select.append(option);}if(item)select.value=item.id;select.onchange=()=>load(list.find(l=>l.id===select.value));label.append(select);target.append(label);
  if(mode==='lessons'){const p=document.createElement('p');p.id='xqs-progress';target.append(p);updateProgress();}
 }
}
function setMode(next,entry){
 stopDemo();resetAnalysis();mode=next;selected=null;for(const button of dialog.querySelectorAll('[data-mode]'))button.setAttribute('aria-pressed',String(button.dataset.mode===mode));
 if(mode==='coach'){item=null;session=C.game(base);$('xqs-title').textContent='和军师一起想一步';$('xqs-idea').textContent='先找将军、吃子和直接威胁，再比较候选走法。';say('点自己的棋子，再点亮起的落点。');}
 else load(entry||(mode==='lessons'?D.lessons[0]:D.openings[0]),false);
 picker();render();
}
function load(entry,refresh=true){
 if(!entry)return;stopDemo();resetAnalysis();item=entry;index=0;selected=null;session=sessionAt(0);flip=mode==='lessons'&&session.turn===2;$('xqs-title').textContent=entry.title;$('xqs-idea').textContent=mode==='lessons'?entry.goal+'。'+entry.idea:entry.idea;say(mode==='lessons'?'先自己试一试；需要时可以提示或看演示。':'从第一步开始，边走边看每步的意图。');if(refresh)picker();render();
}
function step(n){stopDemo();resetAnalysis();selected=null;index=Math.max(0,Math.min(item.line.length,index+n));session=sessionAt(index);say(index?`第 ${index} 手：`+C.notation(sessionAt(index-1),item.line[index-1]):'起始局面');render();}
function demonstrate(){
 stopDemo();resetAnalysis();selected=null;index=0;session=sessionAt(0);demonstrating=true;
 const tick=()=>{if(!dialog.open||!demonstrating)return;if(index>=item.line.length){timer=null;demonstrating=false;say(mode==='lessons'?'演示完成，点“重练”再自己走一遍。':item.idea);render();return;}const u=item.line[index],label=C.notation(session,u);if(!session.dispatch(session.turn,C.move(u)).ok){stopDemo();return say('这份棋谱无法继续，请重新选择。');}index++;say(label+(mode==='lessons'?'：'+item.idea:''));render();timer=setTimeout(tick,1100);};timer=setTimeout(tick,300);
}
async function ask(){
 stopDemo();resetAnalysis();const request=++ticket,fen=session.view(session.turn).fen;busy=true;$('xqs-ask').disabled=true;$('xqs-stop').hidden=false;$('xqs-analysis-status').textContent='军师正在准备并比较候选走法……';
 try{const result=await C.analyze(fen,{ms:Number($('xqs-time').value),onProgress:p=>{if(request===ticket)$('xqs-analysis-status').textContent='军师正在比较候选走法 · 已搜索 '+p.depth+' 层';}});if(request!==ticket||!dialog.open)return;analysis=result;$('xqs-analysis-status').textContent=(result.side===1?'红方':'黑方')+'行棋 · 搜索深度 '+result.depth+' · 正分有利于当前行棋方';
  for(const [i,line]of result.lines.entries()){
   const article=document.createElement('article');article.className='xqs-variation';const title=document.createElement('h4');title.textContent=(i===0?'优先考虑':'候选 '+(i+1))+' · '+line.labels[0];const score=document.createElement('span');score.textContent=C.scoreText(line);title.append(score);const explain=document.createElement('p');explain.textContent=line.explanation.text;const pv=document.createElement('p');pv.className='xqs-pv';pv.textContent=line.labels.slice(0,8).map((m,i)=>(i+1)+'. '+m).join(' → ');const button=document.createElement('button');button.textContent='逐步看这条变化';button.onclick=()=>setMode('records',{id:'variation',title:'军师示范 · '+line.labels[0],fen:result.fen,line:line.line,comments:line.line.map((u,j)=>C.describe(C.replay(result.fen,line.line,j).view(1).fen,u).text),idea:line.explanation.text});article.append(title,explain,pv,button);$('xqs-analysis').append(article);
  }
 }catch(error){if(request===ticket)$('xqs-analysis-status').textContent=error.message;}
 finally{if(request===ticket){busy=false;$('xqs-ask').disabled=false;$('xqs-stop').hidden=true;}}
}
function open(){
 window.PigAndroid.pause();C.cancel();if(!dialog.open)dialog.showModal();const live=typeof state!=='undefined'&&state?.id==='xiangqi'?state:null;if(live)base=live.m.view(live.m.turn).fen;setMode('coach');
}
dialog.querySelector('.xqs-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{stopDemo();cancel();});dialog.addEventListener('cancel',()=>{stopDemo();cancel();});
dialog.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>setMode(button.dataset.mode));
$('xqs-reset').onclick=()=>{stopDemo();resetAnalysis();selected=null;if(mode==='coach')session=C.game(base);else{index=0;session=sessionAt(0);}say('重新开始，先观察将军、吃子和退路。');render();};
$('xqs-flip').onclick=()=>{flip=!flip;render();};$('xqs-prev').onclick=()=>step(-1);$('xqs-next').onclick=()=>step(1);$('xqs-demo').onclick=demonstrate;
$('xqs-hint').onclick=()=>{if(session.status.over)return say('这题已经结束，点重练再挑战一次。');selected=item.line[index].slice(0,2);render();say(item.hint+' 先看看亮起的这枚棋子。');};
$('xqs-ask').onclick=ask;$('xqs-stop').onclick=()=>{cancel();$('xqs-analysis-status').textContent='已停止分析，可以换个局面再请教。';};
$('xqs-import').onclick=()=>{try{const record=C.parseRecord($('xqs-record').value);setMode('records',record);$('xqs-import-status').textContent='已检查 '+record.line.length+' 手，均为合法着法。';}catch(error){$('xqs-import-status').textContent=error.message;}};
$('xqs-export').onclick=()=>{const fen=mode==='coach'?base:item?.fen,line=mode==='coach'?session.actions.map(a=>a.move.from+a.move.to):item?.line||[];$('xqs-record').value='[Event "'+(mode==='coach'?'军师练习':item.title.replace(/["\r\n]/g,''))+'"]\n'+(fen?'[FEN "'+fen+'"]\n':'')+'\n'+line.join(' ');$('xqs-import-status').textContent='棋谱已生成，可在上面的文本框中选择并复制。';};
const entry=document.createElement('button');entry.id='android-xiangqi-school';entry.className='xqs-entry';entry.textContent='象棋学堂';entry.onclick=open;document.querySelector('main > header').append(entry);
const hallButton=document.createElement('button');hallButton.className='text-button';hallButton.id='android-xiangqi-school-hall';hallButton.textContent='象棋学堂';hallButton.onclick=open;document.querySelector('.android-hall-footer').prepend(hallButton);
const sync=()=>entry.hidden=document.body.dataset.game!=='xiangqi';new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['data-game']});sync();
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopDemo();cancel();}});
window.PigXiangqiSchool=Object.freeze({open,close:()=>dialog.close()});
})();
