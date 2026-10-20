/* 猪猪爱学习：眼镜猪老师出题，你的小猪作答，答完看原卷解析。
 * 题库不放进游戏本体：电脑版读 exe 旁边的「猪猪题库」文件夹（整个文件夹复制到别的电脑就能用），
 * 安卓版和网页版用“导入题库”把题库文件存进本机。公式用 KaTeX 显示，题图已在题库里。
 * 作答方式：选择题先选再交卷；数学填空、英语语法填空输入后自动判分；整篇阅读逐小题作答；
 * 主观题、作文对照答案自评。
 */
(function(root){
'use strict';
const S=root.PigStudyCore,M=root.PigStudyMath;
const configs={study:{name:'猪猪爱学习',icon:'i-book',title:'眼镜猪老师，今天学什么？',
 subtitle:'用排版好的真题和答案解析来闯关：选择题选好交卷当场判分，数学填空和英语语法填空直接输入答案判分，阅读整篇逐小题作答，主观题看完解析自己打分；答错的题自动进错题本。',
 tag:'真题闯关 · 分科题型 · 难度筛选 · 错题本',eyebrow:'23 / A LITTLE STUDY',
 note:'题库在游戏旁边的「猪猪题库」文件夹，整个文件夹复制到别的电脑就能接着学。',defaultLevel:'all',
 levels:[['all','全部学科'],['math','数学'],['physics','物理'],['chem','化学'],['bio','生物'],['chinese','语文'],['english','英语']],labels:['本轮得分','答对','最高得分'],
 tips:[['先选再交','选择题点选项只是选中，确认后点“交卷”（或按 Enter）才判分；数学填空、英语语法填空把答案输进框里再交卷。'],
  ['数学输入','分数写 3/4，根号 √3 或 sqrt(3)，乘方 2^(n-1)，π、e、ln、log_2(8)、sin 都能用；区间写 (1,+∞)∪[2,3]，几个答案用“或”或逗号隔开。下方按钮也能输入，输入框下面会显示识别出的式子。等价写法都算对。'],
  ['分值与难度','分值按原卷（数学单选 5、多选 6、填空 5，英语阅读每小题 2.5、完形 1、语法填空 1.5 等）；没有原卷分值的按新高考常见卷面。难度按题在卷中的位置与栏目估计。'],
  ['整篇阅读','语文、英语的阅读、完形、七选五、语法填空按整篇出题：每个小题直接点选或填写，最后一起交卷；简答、默写和作文看参考答案自评。'],
  ['错题本','没拿满分的题自动记下；“错题重练”专挑这些题，答对就移出。'],
  ['题库','电脑版：题库放在游戏旁边的「猪猪题库」文件夹。手机和网页版：点“导入题库”选择题库文件。']]}};

const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const TEACH={
 idle:['慢慢想，不着急。','先圈出题目里的关键条件。','这题有意思，试试看！','想好了再动手哦。'],
 right:['答对啦！小猪真棒！','漂亮！思路很清楚。','完全正确，奖励一颗松露！','又对一题，继续保持！'],
 partial:['对了一部分，看看漏了哪里。','差一点点就满分啦！','方向对了，再看看解析。'],
 wrong:['没关系，一起看看解析。','这题有个小陷阱，弄懂它就是你的了。','错题本记下了，下次一定行！'],
 self:['对照解析，看看自己写到哪一步。','诚实打分，错题本才有用哦。']};
const say=k=>TEACH[k][Math.floor(Math.random()*TEACH[k].length)];
const L=k=>String.fromCharCode(65+k);
const stars=n=>'★'.repeat(n)+'☆'.repeat(3-n);

// ---------- 题库来源：电脑版文件夹 / 安卓本机 / 浏览器本机 ----------
function makeHost(){
 if(root.PiggyStudy&&root.PiggyStudy.version>=1){const h=root.PiggyStudy;return {kind:'folder',dir:()=>h.dir(),list:()=>h.list(),head:f=>h.head(f),read:f=>h.read(f),importFiles:()=>h.importFiles(),openFolder:()=>h.openFolder(),canOpen:true}}
 if(root.PiggyStudyAndroid){const b=root.PiggyStudyAndroid;let waiting=null;
  root.PigStudyHost={onPicked:json=>{const w=waiting;waiting=null;if(w){try{w(JSON.parse(json))}catch(e){w({added:0,skipped:0})}}}};
  return {kind:'android',dir:()=>Promise.resolve(''),list:()=>Promise.resolve(JSON.parse(b.list()||'[]')),head:f=>Promise.resolve(b.head(f)),read:f=>Promise.resolve(b.read(f)),
   importFiles:()=>new Promise(res=>{waiting=res;b.pick()}),remove:f=>Promise.resolve(b.remove(f)),canRemove:true}}
 return idbHost();
}
function idbHost(){
 const DB='piggy-study',ST='banks';let dbp=null;
 const open=()=>dbp||(dbp=new Promise((res,rej)=>{if(!root.indexedDB)return rej(new Error('no idb'));const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(ST,{keyPath:'file'});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}));
 const tx=(mode,fn)=>open().then(db=>new Promise((res,rej)=>{const t=db.transaction(ST,mode),s=t.objectStore(ST);const out=fn(s);t.oncomplete=()=>res(out&&out.result!==undefined?out.result:out);t.onerror=()=>rej(t.error)}));
 function pick(dir){
  return new Promise(res=>{const inp=document.createElement('input');inp.type='file';inp.multiple=true;inp.accept='.json,application/json';if(dir)inp.setAttribute('webkitdirectory','');
   inp.onchange=async()=>{let added=0,skipped=0;for(const f of [...inp.files]){if(!/\.json$/i.test(f.name)){continue}
     try{const text=await f.text(),h=S.peekHeader(text);if(!h){skipped++;continue}
      await tx('readwrite',s=>s.put({file:(h.subjectName||'其他')+'/'+(h.title||f.name)+'.json',text,size:text.length,at:Date.now()}));added++}catch(e){skipped++}}
    res({added,skipped})};inp.click()});
 }
 return {kind:'browser',dir:()=>Promise.resolve(''),
  list:()=>tx('readonly',s=>s.getAll()).then(rows=>(rows||[]).map(r=>({file:r.file,size:r.size,head:r.text.slice(0,4096)}))).catch(()=>[]),
  head:f=>tx('readonly',s=>s.get(f)).then(r=>r?r.text.slice(0,4096):''),read:f=>tx('readonly',s=>s.get(f)).then(r=>r?r.text:''),
  importFiles:()=>pick(false),importFolder:()=>pick(true),remove:f=>tx('readwrite',s=>s.delete(f)),canRemove:true,canFolder:true};
}

// ---------- 题目 HTML：白名单清洗 + 题图 + KaTeX ----------
const TAGS=new Set(['B','STRONG','I','EM','U','MARK','SMALL','SUP','SUB','SPAN','DIV','P','BR','H4','H5','OL','UL','LI','TABLE','TBODY','THEAD','TR','TD','TH','IMG']);
function render(html,bank){
 const tpl=document.createElement('template');tpl.innerHTML=html;
 // 静态列表：拆掉不认识的标签后，它的子元素仍会依次检查
 for(const el of [...tpl.content.querySelectorAll('*')]){
  if(/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|LINK|META|TEMPLATE|SVG|MATH|FORM|INPUT|TEXTAREA|SELECT|BUTTON|A|VIDEO|AUDIO|SOURCE)$/i.test(el.tagName)){el.remove();continue}
  if(!TAGS.has(el.tagName)){el.replaceWith(...el.childNodes);continue}
  for(const a of [...el.attributes]){
   const n=a.name;
   if(n==='class'&&/^[\w\- ]{0,80}$/.test(a.value))continue;
   if((n==='colspan'||n==='rowspan')&&/^\d{1,2}$/.test(a.value))continue;
   if(n==='data-fig'&&/^[\w-]{1,40}$/.test(a.value))continue;
   el.removeAttribute(n);
  }
  if(el.tagName==='IMG'){const f=bank.figures[el.getAttribute('data-fig')];if(!f){el.replaceWith(Object.assign(document.createElement('span'),{className:'sx-nofig',textContent:'（此处原有图，题库里没有找到）'}));continue}
   // 题图按印刷尺寸生成；屏幕字号约是印刷的 1.3 倍，题图同比放大（窄屏由 max-width 收回）
   const w=Math.round(f.w*1.3);el.src=f.src;el.alt='题图';el.width=w;el.height=Math.round(f.h*1.3);el.style.width=w+'px';el.draggable=false}
 }
 const box=document.createElement('div');box.appendChild(tpl.content);
 typeset(box,bank.macros);
 return box;
}
function typeset(el,macros){
 if(!root.katex)return;
 el.querySelectorAll('.sx-m,.sx-dm').forEach(n=>{const tex=n.textContent;
  try{root.katex.render(tex,n,{displayMode:n.classList.contains('sx-dm'),throwOnError:false,strict:false,trust:false,macros:Object.assign({},macros),output:'html'})}
  catch(e){n.textContent=tex;n.classList.add('sx-raw')}});
}
function katexInto(el,tex){if(!el)return;if(root.katex){try{root.katex.render(tex,el,{throwOnError:false,strict:false,output:'html'});return}catch(e){}}el.textContent=tex}

// 数学输入键盘：[显示, 插入文字, 光标停在插入内容中的位置]
const KEYPAD=[['a/b','()/()',1],['√','√()',2],['xⁿ','^()',2],['x²','^2'],['π','π'],['e','e'],['i','i'],['ln','ln()',3],['log','log_()()',5],['sin','sin()',4],['cos','cos()',4],['tan','tan()',4],
 ['|x|','||',1],['(','('],[')',')'],['[','['],[']',']'],['∞','∞'],['∪','∪'],['≤','≤'],['≥','≥'],['或',' 或 '],[',',','],['⌫','BACK'],['清空','CLEAR']];

function create(ui){
 const {$,Sound,Store,stats,record,message,result,confetti}=ui,get=()=>ui.get();
 const has=id=>id==='study';
 const active=()=>has(get().game)&&get().state&&get().state.study;
 const host=makeHost();
 // 已读取的题库：file → 整理好的题库
 const lib={list:null,loading:null,full:{},counting:null};
 const prefs=()=>{const p=Object.assign({bank:'all',kinds:{},cats:S.CATS.slice(),levels:[1,2,3],count:10,mode:'new'},Store.get('study-prefs',{}));
  if(!p.kinds||typeof p.kinds!=='object')p.kinds={};if(!Array.isArray(p.cats)||!p.cats.length)p.cats=S.CATS.slice();if(!Array.isArray(p.levels)||!p.levels.length)p.levels=[1,2,3];return p};
 const setPrefs=p=>Store.set('study-prefs',Object.assign(prefs(),p));
 const wrongBook=()=>{const w=Store.get('study-wrong',{});return w&&typeof w==='object'?w:{}};
 const pig=(o)=>root.PigArt?root.PigArt.inline(Object.assign({viewBox:'0 14 160 136'},o)):'';
 const teacher=expr=>pig({skin:'taro',role:'glasses',expr,cls:'st-teacher-pig'});
 const student=expr=>pig({skin:(root.PigLook&&root.PigLook.active)||'peach',role:'pig',expr,cls:'st-student-pig'});
 const sum2=a=>Math.round(a.reduce((s,r)=>s+(r?r.points:0),0)*10)/10;

 async function loadList(force){
  if(lib.list&&!force)return lib.list;
  if(lib.loading&&!force)return lib.loading;
  lib.loading=(async()=>{
   let rows=[];try{rows=await host.list()}catch(e){rows=[]}
   const out=[];
   for(const r of rows||[]){
    let head=r.head;if(head==null){try{head=await host.head(r.file)}catch(e){head=''}}
    const h=S.peekHeader(head);if(!h)continue;
    out.push({file:r.file,size:r.size||0,id:h.id||r.file,title:h.title||r.file.replace(/\.json$/i,''),subject:S.SUBJECT_NAME[h.subject]?h.subject:'other',subjectName:h.subjectName||S.SUBJECT_NAME[h.subject]||'其他',count:h.count||0,built:h.built||''});
   }
   out.sort((a,b)=>a.subject.localeCompare(b.subject)||a.title.localeCompare(b.title,'zh'));
   lib.list=out;lib.loading=null;return out;
  })();
  return lib.loading;
 }
 async function loadBank(entry){
  if(lib.full[entry.file])return lib.full[entry.file];
  const text=await host.read(entry.file);let obj=null;try{obj=JSON.parse(text)}catch(e){}
  const b=S.normalizeBank(obj,entry.title);if(b.error)throw new Error(entry.title+'：'+b.error);
  lib.full[entry.file]=b;return b;
 }

 // ---------- 选课页 ----------
 let again=null; // 一轮结束后点“再来一局”（或按 R）：同一学科直接开下一轮
 function init(){
  const t={study:true,view:'lobby',round:null};ui.setState(t);
  const auto=again===get().level;again=null;
  $('play-toolbar').innerHTML='<span class="key-hint">选择题：数字 1–8 / 字母 A–H 选中，Enter 交卷 · 填空：输入后 Enter 交卷</span>';
  $('board').innerHTML='<div class="st-wrap" id="st-wrap"><div class="st-loading">'+teacher('normal')+'<p>眼镜猪老师正在翻题库……</p></div></div>';
  stats(0,'0/0');
  message('选好套卷、题型和难度，点“开始上课”。题库在游戏旁边的「猪猪题库」文件夹。');
  const show=()=>{if(!active()||get().state!==t)return;lobby();if(auto&&$('st-go')&&!$('st-go').disabled)start()};
  loadList().then(show,show);
 }
 const subjOf=level=>(lib.list||[]).filter(b=>level==='all'||b.subject===level);
 const chosenOf=(level,p)=>{const subj=subjOf(level);return p.bank!=='all'&&subj.some(b=>b.id===p.bank)?subj.filter(b=>b.id===p.bank):subj};
 const kindsFor=(level,p)=>level==='all'?null:(Array.isArray(p.kinds[level])&&p.kinds[level].length?p.kinds[level]:(S.KINDS[level]||S.KINDS.other).slice());
 // 选课页的题数统计要读完整题库；在后台一套一套读，读完刷新
 function countLater(entries){
  const todo=entries.filter(e=>!lib.full[e.file]);if(!todo.length||lib.counting)return;
  lib.counting=(async()=>{for(const e of todo){try{await loadBank(e)}catch(err){}await new Promise(r=>setTimeout(r,0))}})();
  lib.counting.then(()=>{lib.counting=null;if(active()&&get().state.view==='lobby')lobby(true)});
 }
 function lobby(keepScroll){
  const level=get().level,p=prefs(),list=lib.list||[];
  const subj=subjOf(level),chosen=chosenOf(level,p);
  const wrongN=Object.keys(wrongBook()).length;
  const loaded=chosen.every(e=>lib.full[e.file]);
  const pool=loaded?S.filterPool(chosen.map(e=>lib.full[e.file]),{}):null;
  const kinds=kindsFor(level,p),kindList=level==='all'?S.CATS:(S.KINDS[level]||S.KINDS.other);
  const keyOf=q=>level==='all'?q.cat:q.kind,selKinds=level==='all'?p.cats:kinds;
  const cnt=(pred)=>pool?pool.filter(pred).length:null;
  const kindChip=k=>{const n=cnt(q=>keyOf(q)===k&&p.levels.includes(q.level));if(n===0&&pool&&!pool.some(q=>keyOf(q)===k))return '';
   return `<button class="st-chip" data-kind="${esc(k)}" aria-pressed="${selKinds.includes(k)}">${esc(k)}${n!=null?`<small>${n}</small>`:''}</button>`};
  const levelChip=l=>{const n=cnt(q=>q.level===l&&selKinds.includes(keyOf(q)));return `<button class="st-chip" data-lv="${l}" aria-pressed="${p.levels.includes(l)}"><span class="st-stars">${stars(l)}</span> ${S.LEVELS[l]}${n!=null?`<small>${n}</small>`:''}</button>`};
  const avail=pool?pool.filter(q=>selKinds.includes(keyOf(q))&&p.levels.includes(q.level)).length:null;
  const bankSel=chosen.length===1&&p.bank!=='all'?p.bank:'all';
  let html=`<div class="st-lobby"><div class="st-hero"><div class="st-chalk"><div class="st-chalk-t">今天学什么？</div><div class="st-chalk-s">${list.length?`已找到 ${list.length} 套题库，共 ${list.reduce((s,b)=>s+b.count,0)} 道题`:'还没有找到题库'}</div></div>${teacher(list.length?'happy':'worry')}</div>`;
  if(list.length){
   html+=`<div class="st-setup"><label class="st-field"><span>套卷</span><select id="st-bank" aria-label="选择套卷"><option value="all">${level==='all'?'全部学科':S.SUBJECT_NAME[level]}全部套卷（${subj.reduce((s,b)=>s+b.count,0)} 题）</option>${subj.map(b=>`<option value="${esc(b.id)}" ${b.id===bankSel?'selected':''}>${esc(b.subjectName)} · ${esc(b.title)}（${b.count} 题）</option>`).join('')}</select></label>
    <div class="st-field"><span>${level==='all'?'大类':'题型'}</span><div class="st-chips" id="st-kinds">${kindList.map(kindChip).join('')}</div></div>
    <div class="st-field"><span>难度</span><div class="st-chips" id="st-levels">${[1,2,3].map(levelChip).join('')}</div></div>
    <div class="st-field"><span>题数</span><div class="st-chips" id="st-count">${[5,10,20].map(n=>`<button class="st-chip" data-count="${n}" aria-pressed="${p.count===n}">${n} 题</button>`).join('')}</div></div>
    <div class="st-field"><span>模式</span><div class="st-chips" id="st-mode"><button class="st-chip" data-mode="new" aria-pressed="${p.mode!=='wrong'}">新题优先</button><button class="st-chip" data-mode="wrong" aria-pressed="${p.mode==='wrong'}" ${wrongN?'':'disabled'}>错题重练（${wrongN}）</button></div></div>
    <div class="st-go-row"><button class="primary st-go" id="st-go">开始上课</button><span class="st-note">${!subj.length?'这个学科还没有题库，换一个学科试试':avail==null?'正在统计各题型题数……':`可选 ${avail} 题`}</span></div>
    <p class="st-lv-note">难度按题在原卷中的位置与栏目估计（竞赛卷都算较难）。</p></div>`;
  }
  html+=libraryPanel(list)+'</div>';
  const y=window.scrollY;$('st-wrap').innerHTML=html;if(keepScroll)window.scrollTo(0,y);
  const sel=$('st-bank');if(sel)sel.onchange=()=>{setPrefs({bank:sel.value});Sound.click();lobby(true)};
  document.querySelectorAll('#st-kinds [data-kind]').forEach(b=>b.onclick=()=>{const k=b.dataset.kind,pp=prefs();
   let cur=level==='all'?pp.cats.slice():kindsFor(level,pp).slice();cur=cur.includes(k)?cur.filter(x=>x!==k):cur.concat(k);
   if(!cur.length){message('至少留一种题型。','warn');return}
   if(level==='all')setPrefs({cats:cur});else setPrefs({kinds:Object.assign({},pp.kinds,{[level]:cur})});Sound.click();lobby(true)});
  document.querySelectorAll('#st-levels [data-lv]').forEach(b=>b.onclick=()=>{const l=+b.dataset.lv;let cur=prefs().levels.slice();cur=cur.includes(l)?cur.filter(x=>x!==l):cur.concat(l).sort();
   if(!cur.length){message('至少留一档难度。','warn');return}setPrefs({levels:cur});Sound.click();lobby(true)});
  document.querySelectorAll('#st-count [data-count]').forEach(b=>b.onclick=()=>{setPrefs({count:+b.dataset.count});Sound.click();document.querySelectorAll('#st-count [data-count]').forEach(x=>x.setAttribute('aria-pressed',x===b))});
  document.querySelectorAll('#st-mode [data-mode]').forEach(b=>b.onclick=()=>{setPrefs({mode:b.dataset.mode});Sound.click();document.querySelectorAll('#st-mode [data-mode]').forEach(x=>x.setAttribute('aria-pressed',x===b))});
  const go=$('st-go');if(go){go.disabled=!subj.length;go.onclick=()=>start()}
  bindLibrary();
  if(!loaded)countLater(chosen);
 }
 function libraryPanel(list){
  const groups={};for(const b of list)(groups[b.subjectName]=groups[b.subjectName]||[]).push(b);
  const where=host.kind==='folder'?'<p class="st-lib-hint">电脑版从游戏旁边的 <b>「猪猪题库」</b> 文件夹读取题库（每套卷一个 .json 文件，可按学科分子文件夹）。换电脑时，把这个文件夹和游戏放在一起复制过去即可；也可以点“导入题库文件”，游戏会把文件复制进这个文件夹。<br><span class="st-path" id="st-path"></span></p>'
   :host.kind==='android'?'<p class="st-lib-hint">手机上点“导入题库”，在文件管理里选中题库 .json 文件（可多选），会保存在游乐场里；卸载游乐场前请保留原文件。</p>'
   :'<p class="st-lib-hint">网页版点“导入题库文件”或“导入整个文件夹”，选择「猪猪题库」里的 .json 文件，会保存在这个浏览器里。</p>';
  let html=`<div class="st-library"><div class="st-lib-head"><h4>题库</h4><div class="st-lib-actions">`+
   (host.canOpen?'<button class="secondary" id="st-open">打开题库文件夹</button>':'')+
   '<button class="secondary" id="st-import">导入题库文件</button>'+(host.canFolder?'<button class="secondary" id="st-import-dir">导入整个文件夹</button>':'')+
   '<button class="secondary" id="st-refresh">重新读取</button></div></div>'+where;
  if(!list.length)html+='<div class="st-empty">还没有题库。题库由「猪猪爱学习题库工具」从排版好的试卷生成，成品文件夹里的「猪猪题库」就是它；放到游戏旁边，或点上面的按钮导入。</div>';
  else html+='<div class="st-lib-list">'+Object.entries(groups).map(([g,bs])=>`<div class="st-lib-group"><b>${esc(g)}</b><ul>${bs.map(b=>`<li><span>${esc(b.title)}</span><small>${b.count} 题</small>${host.canRemove?`<button class="st-x" data-remove="${esc(b.file)}" aria-label="移除 ${esc(b.title)}" title="从本机移除">×</button>`:''}</li>`).join('')}</ul></div>`).join('')+'</div>';
  return html+'</div>';
 }
 function bindLibrary(){
  if($('st-path')&&host.dir)host.dir().then(d=>{const el=$('st-path');if(el&&d)el.textContent='位置：'+d}).catch(()=>{});
  const after=r=>{lib.full={};return loadList(true).then(()=>{if(!active())return;if(get().state.view==='lobby')lobby();if(r)message(r.added?`导入了 ${r.added} 套题库${r.skipped?`，${r.skipped} 个文件不是题库，已跳过`:''}。`:'没有导入新的题库。',r.added?'ok':'warn')})};
  if($('st-open'))$('st-open').onclick=()=>{Sound.click();host.openFolder()};
  $('st-import').onclick=()=>{Sound.click();host.importFiles().then(after).catch(()=>message('导入没有完成。','warn'))};
  if($('st-import-dir'))$('st-import-dir').onclick=()=>{Sound.click();host.importFolder().then(after).catch(()=>message('导入没有完成。','warn'))};
  $('st-refresh').onclick=()=>{Sound.click();after(null).then(()=>message('题库已重新读取。','ok'))};
  document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{if(!confirm('从本机移除这套题库？（原文件不受影响）'))return;host.remove(b.dataset.remove).then(()=>after(null))});
 }

 // ---------- 一轮 ----------
 async function start(){
  const t=get().state,level=get().level,p=prefs();
  const chosen=chosenOf(level,p);
  if(!chosen.length)return;
  $('st-go').disabled=true;$('st-go').textContent='准备题目……';
  let banks=[];const bad=[];
  for(const e of chosen){try{banks.push(await loadBank(e))}catch(err){bad.push(err.message)}}
  if(!active()||get().state!==t)return;
  const opt=level==='all'?{cats:p.cats,levels:p.levels}:{kinds:kindsFor(level,p),levels:p.levels};
  const pool=S.filterPool(banks,opt);
  const wrong=p.mode==='wrong'?Object.keys(wrongBook()):null;
  const recent=Store.get('study-recent',[]);
  const qs=S.pickRound(pool,p.count,Math.random,Array.isArray(recent)?recent:[],wrong);
  if(!qs.length){lobby();message(wrong?'这些套卷里没有符合条件的错题，去做新题吧！':'所选题型和难度没有题目，换一换试试。','warn');return}
  Store.set('study-recent',qs.map(q=>q.id).concat(Array.isArray(recent)?recent:[]).slice(0,600));
  const byId=Object.fromEntries(banks.map(b=>[b.id,b]));
  t.view='quiz';t.round={qs,byId,i:0,results:[],streak:0,best:0,mode:p.mode};
  ui.setRunning(true);Sound.greet();
  if(bad.length)message('有 '+bad.length+' 套题库读不出来，已跳过。','warn');
  question();
 }
 function curMode(q,bank){
  if(q.mode==='math'){const blanks=M&&M.prepare(q.answer,bank.macros);return blanks?{mode:'math',blanks}:{mode:'self'}}
  return {mode:q.mode||'self'};
 }
 const trivialStem=s=>/^\s*第\s*\d+\s*空\s*[.。]?\s*$/.test(S.plain(s));
 const isWriting=q=>/写作/.test(q.kind||'');
 function question(){
  const t=get().state,R=t.round,q=R.qs[R.i],bank=R.byId[q.bankId];
  const m=curMode(q,bank);
  R.cur={q,picked:new Set(),done:false,stage:'answer',mode:m.mode,blanks:m.blanks||null,subPick:{},subRes:null,warned:false};
  const dots=R.qs.map((_,k)=>{const r=R.results[k];return `<i class="${k===R.i?'now':r?r.verdict:''}"></i>`}).join('');
  const typeCls=q.subs?'group':q.type;
  $('st-wrap').innerHTML=`<div class="st-quiz">
   <div class="st-progress"><div class="st-dots">${dots}</div><span>第 <b>${R.i+1}</b> / ${R.qs.length} 题</span><span class="st-streak" id="st-streak">${R.streak>=2?'连对 ×'+R.streak:''}</span><button class="secondary st-quit" id="st-quit">换一批</button></div>
   <div class="st-class"><div class="st-scene"><div class="st-bubble" id="st-bubble">${esc(say('idle'))}</div><div class="st-teacher" id="st-teacher">${teacher('normal')}</div><div class="st-student" id="st-student">${student('normal')}</div></div>
   <article class="st-card"><div class="st-meta"><span class="st-tag st-${typeCls}">${esc(q.kind||S.TYPES[q.type])}</span><span class="st-lv" title="难度：${S.LEVELS[q.level]}">${stars(q.level)}</span><span class="st-src">${esc(q.bank)}${q.unit?' · '+esc(q.unit):''} · ${q.sourceNos&&q.sourceNos.length>1?'第 '+q.sourceNos[0]+'—'+q.sourceNos[q.sourceNos.length-1]+' 题':'第 '+q.no+' 题'}</span><span class="st-pts">${S.fmt(q.points)} 分</span></div>
   <div class="st-stem sx" id="st-stem"></div>
   ${q.options.length&&m.mode==='choice'?`<div class="st-options ${q.options.some(o=>o.length>160||/sx-fig|sx-dm/.test(o))?'long':''}" id="st-options" role="group" aria-label="选项">${q.options.map((o,k)=>`<button class="st-opt" data-opt="${L(k)}"><b class="st-opt-l">${L(k)}</b><span class="st-opt-t sx" data-otext="${k}"></span></button>`).join('')}</div>`:''}
   <div id="st-work"></div>
   <div class="st-actions" id="st-actions"></div>
   <div class="st-feedback" id="st-feedback" hidden></div>
   <div class="st-solution" id="st-solution" hidden></div></article></div></div>`;
  $('st-stem').appendChild(render(q.stem,bank));
  document.querySelectorAll('[data-otext]').forEach(sp=>sp.appendChild(render(q.options[+sp.dataset.otext],bank)));
  document.querySelectorAll('#st-options [data-opt]').forEach(b=>b.onclick=()=>choose(b.dataset.opt));
  $('st-quit').onclick=()=>{Sound.click();ui.setRunning(false);t.view='lobby';t.round=null;lobby()};
  if(m.mode==='math'||m.mode==='text')buildInputs(q,m);
  if(m.mode==='group')buildGroup(q,bank);
  actions();
  stats(sum2(R.results),R.results.filter(r=>r&&r.verdict==='right').length+'/'+R.results.filter(Boolean).length);
  message(m.mode==='choice'?(q.type==='single'?'选一个选项，再点“交卷”。':'可以选多项，选好后点“交卷”。选错不得分，漏选得部分分。')
   :m.mode==='math'?'把答案输进框里（分数 3/4、根号 √3、π、区间 (1,+∞) 都行），再点“交卷”。':m.mode==='text'?'把单词填进框里，再点“交卷”。'
   :m.mode==='group'?'逐小题作答：选择题点选、语法填空输入；全部做完点最下面的“交卷”。':'先自己写一写，想好了点“看答案”。');
  const wrap=$('st-wrap');if(wrap&&wrap.getBoundingClientRect().top<0)wrap.scrollIntoView({block:'start'});
 }

 // ----- 输入框（数学填空 / 英语单词） -----
 function buildInputs(q,m){
  const n=m.mode==='math'?m.blanks.length:1,box=$('st-work');
  box.innerHTML=`<div class="st-inputs">${Array.from({length:n},(_,k)=>`<div class="st-in-row"><label>${n>1?'第 '+(k+1)+' 空':'答案'}</label><div class="st-in-col"><input class="st-in" id="st-in-${k}" data-k="${k}" autocomplete="off" autocapitalize="off" spellcheck="false" inputmode="${m.mode==='math'?'text':'latin'}" placeholder="${m.mode==='math'?'例如 3/4、2√3、(1,+∞)、2 或 3':'填一个单词或词组'}"><div class="st-preview" id="st-pv-${k}"></div></div><span class="st-in-mark" id="st-mk-${k}"></span></div>`).join('')}</div>`+
   (m.mode==='math'?`<div class="st-keypad" id="st-keypad" aria-label="数学符号">${KEYPAD.map((k,i)=>`<button type="button" class="st-key" data-key="${i}">${esc(k[0])}</button>`).join('')}</div>`:'');
  let focus=0;
  box.querySelectorAll('.st-in').forEach(inp=>{
   inp.addEventListener('focus',()=>{focus=+inp.dataset.k});
   inp.addEventListener('input',()=>{if(m.mode==='math')showPreview(inp);actions()});
   inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();const nx=$('st-in-'+(+inp.dataset.k+1));if(nx&&!get().state.round.cur.done)nx.focus();else enter()}});
  });
  if(m.mode==='math')box.querySelectorAll('[data-key]').forEach(b=>{
   b.addEventListener('mousedown',e=>e.preventDefault()); // 不让输入框失去焦点
   b.onclick=()=>{const inp=$('st-in-'+focus);if(!inp||inp.disabled)return;const [,ins,back]=KEYPAD[+b.dataset.key];
    const s=inp.selectionStart!=null?inp.selectionStart:inp.value.length,e2=inp.selectionEnd!=null?inp.selectionEnd:s;
    if(ins==='BACK'){if(s!==e2)inp.value=inp.value.slice(0,s)+inp.value.slice(e2);else if(s>0){inp.value=inp.value.slice(0,s-1)+inp.value.slice(s);inp.setSelectionRange(s-1,s-1)}}
    else if(ins==='CLEAR')inp.value='';
    else{inp.value=inp.value.slice(0,s)+ins+inp.value.slice(e2);const pos=s+(back!=null?back:ins.length);inp.setSelectionRange(pos,pos)}
    inp.focus();inp.dispatchEvent(new Event('input'))}});
  setTimeout(()=>{const f=$('st-in-0');if(f&&matchMedia('(pointer:fine)').matches)f.focus({preventScroll:true})},30);
 }
 function showPreview(inp){
  const pv=$('st-pv-'+inp.dataset.k);if(!pv)return;const r=M.preview(inp.value);
  pv.className='st-preview'+(r.error?' bad':'');
  if(r.error)pv.textContent='还读不懂：'+r.error;else if(!r.tex)pv.textContent='';else katexInto(pv,r.tex);
 }
 const inputValues=()=>[...document.querySelectorAll('#st-work .st-in')].map(i=>i.value);

 // ----- 整篇阅读：逐小题 -----
 function buildGroup(q,bank){
  const box=$('st-work');
  let html='';
  if(q.shared)html+=`<div class="st-shared"><div class="st-shared-h">备选项（每项最多用一次）</div><ol class="st-shared-list">${q.shared.map((o,k)=>`<li><b>${L(k)}</b><span class="sx" data-shared="${k}"></span></li>`).join('')}</ol></div>`;
  // 完形、七选五、语法填空只有空号没有小题干：排成紧凑的网格，离文章近一些
  html+=`<div class="st-subs${q.subs.every(s=>trivialStem(s.stem))?' grid':''}">`+q.subs.map((s,k)=>{
   let ctl='';
   if(s.mode==='choice'&&s.shared)ctl=`<div class="st-sub-opts letters">${q.shared.map((_,j)=>`<button class="st-sopt" data-sub="${k}" data-opt="${L(j)}"><b>${L(j)}</b></button>`).join('')}</div>`;
   else if(s.mode==='choice'){const short=s.options.every(o=>S.plain(o).length<=26&&!/sx-fig|sx-dm/.test(o));
    ctl=`<div class="st-sub-opts ${short?'short':''}">${s.options.map((_,j)=>`<button class="st-sopt" data-sub="${k}" data-opt="${L(j)}"><b>${L(j)}</b><span class="sx" data-sotext="${k}-${j}"></span></button>`).join('')}</div>`}
   else if(s.mode==='pick')ctl=`<div class="st-sub-opts letters">${s.picks.map(c=>`<button class="st-sopt" data-sub="${k}" data-opt="${c}"><b>${c}</b></button>`).join('')}<span class="st-sub-tip">选 ${s.answer.length} 处</span></div>`;
   else if(s.mode==='text')ctl=`<div class="st-in-row"><input class="st-in st-sub-in" data-sub="${k}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="填写第 ${s.no} 空"><span class="st-in-mark" id="st-smk-${k}"></span></div>`;
   else ctl='<p class="st-sub-note">'+(s.type==='blank'?'默写 / 填空：先写在纸上，交卷后对照答案自评。':'主观题：先在纸上作答，交卷后对照参考答案自评。')+'</p>';
   return `<section class="st-sub" id="st-sub-${k}"><div class="st-sub-head"><b>${s.no}.</b><span class="st-sub-pts">${S.fmt(s.points)} 分</span><span class="st-sub-mark" id="st-sm-${k}"></span></div>`+
    (trivialStem(s.stem)?'':`<div class="st-sub-stem sx" data-substem="${k}"></div>`)+ctl+`<div class="st-sub-ans" id="st-sa-${k}" hidden></div><div class="st-sub-self" id="st-ss-${k}"></div></section>`;
  }).join('')+'</div>';
  box.innerHTML=html;
  box.querySelectorAll('[data-shared]').forEach(sp=>sp.appendChild(render(q.shared[+sp.dataset.shared],bank)));
  box.querySelectorAll('[data-substem]').forEach(sp=>sp.appendChild(render(q.subs[+sp.dataset.substem].stem,bank)));
  box.querySelectorAll('[data-sotext]').forEach(sp=>{const [k,j]=sp.dataset.sotext.split('-').map(Number);sp.appendChild(render(q.subs[k].options[j],bank))});
  box.querySelectorAll('.st-sopt').forEach(b=>b.onclick=()=>subChoose(+b.dataset.sub,b.dataset.opt));
  box.querySelectorAll('.st-sub-in').forEach(inp=>{inp.addEventListener('input',()=>{get().state.round.cur.subPick[+inp.dataset.sub]=inp.value});
   inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();const all=[...box.querySelectorAll('.st-sub-in')],i=all.indexOf(inp);if(all[i+1])all[i+1].focus();else inp.blur()}})});
 }
 function subChoose(k,letter){
  const c=get().state.round.cur;if(!c||c.stage!=='answer'||get().paused)return;const s=c.q.subs[k];
  let cur=c.subPick[k]||'';
  if(s.type==='single')cur=cur===letter?'':letter;
  else cur=cur.includes(letter)?cur.replace(letter,''):[...cur+letter].sort().join('');
  c.subPick[k]=cur;Sound.click();
  document.querySelectorAll(`.st-sopt[data-sub="${k}"]`).forEach(b=>b.setAttribute('aria-pressed',cur.includes(b.dataset.opt)));
 }
 function submitGroup(){
  const R=get().state.round,c=R.cur,q=c.q,bank=R.byId[q.bankId];if(c.stage!=='answer')return;
  const empty=q.subs.filter((s,k)=>s.mode!=='self'&&!String(c.subPick[k]||'').trim()).length;
  if(empty&&!c.warned){c.warned=true;message(`还有 ${empty} 小题没作答，确定交卷就再点一次“交卷”。`,'warn');Sound.click();return}
  c.subRes=q.subs.map((s,k)=>S.gradeSub(s,c.subPick[k]||''));
  c.stage='self';
  q.subs.forEach((s,k)=>{
   const r=c.subRes[k],mark=$('st-sm-'+k),ans=$('st-sa-'+k);
   document.querySelectorAll(`.st-sopt[data-sub="${k}"]`).forEach(b=>{const o=b.dataset.opt;b.disabled=true;b.classList.toggle('is-answer',s.answer.includes(o)&&s.mode!=='self');b.classList.toggle('is-wrong',(c.subPick[k]||'').includes(o)&&!s.answer.includes(o))});
   document.querySelectorAll(`.st-sub-in[data-sub="${k}"]`).forEach(i=>{i.disabled=true;i.classList.add(r.verdict==='right'?'ok':'bad')});
   if(r.verdict!=='pending'){mark.className='st-sub-mark '+r.verdict;mark.textContent=(r.verdict==='right'?'✓':r.verdict==='partial'?'◐':'✗')+' '+S.fmt(r.points)+' 分'}
   if(s.mode==='self'||r.verdict!=='right'){ans.hidden=false;ans.innerHTML='';ans.appendChild(render('<b>答案：</b>'+(s.mode==='choice'||s.mode==='pick'?s.answer:s.answer),bank))}
   if(r.verdict==='pending')selfRow(k);
  });
  showSolution(null);
  if(c.subRes.every(r=>r.verdict!=='pending'))finish(S.sumGroup(q,c.subRes));
  else{actions();bubble(say('self'));setPig('student','worry');message('选择题已判分；剩下的主观小题请对照答案自评。');
   const first=c.subRes.findIndex(r=>r.verdict==='pending');const el=$('st-sub-'+first);if(el)setTimeout(()=>el.scrollIntoView({block:'center',behavior:'smooth'}),80)}
 }
 function selfRow(k){
  const c=get().state.round.cur,s=c.q.subs[k],row=$('st-ss-'+k);
  const levels=S.selfLevels({type:s.type==='blank'?'blank':'solve',points:s.points},false);
  row.innerHTML='<span class="st-ask">自评：</span>'+levels.map(([id,name])=>`<button class="${id==='right'?'primary':'secondary'}" data-sself="${id}">${name}</button>`).join('');
  row.querySelectorAll('[data-sself]').forEach(b=>b.onclick=()=>{
   const r=S.gradeSelf({type:s.type==='blank'?'blank':'solve',points:s.points},b.dataset.sself);c.subRes[k]=r;Sound.click();
   row.querySelectorAll('[data-sself]').forEach(x=>x.setAttribute('aria-pressed',x===b));
   const mark=$('st-sm-'+k);mark.className='st-sub-mark '+r.verdict;mark.textContent=(r.verdict==='right'?'✓':r.verdict==='partial'?'◐':'✗')+' '+S.fmt(r.points)+' 分（自评）';
   if(c.subRes.every(x=>x.verdict!=='pending')&&!c.done){finish(S.sumGroup(c.q,c.subRes))}
   else if(c.done)regrade(S.sumGroup(c.q,c.subRes));
   else{const nx=c.subRes.findIndex(x=>x.verdict==='pending');const el=$('st-sub-'+nx);if(el)el.scrollIntoView({block:'center',behavior:'smooth'})}
  });
 }

 // ----- 操作按钮：题目下方一份；解析展开后，解析末尾再放一份（长解析看完不用往回翻） -----
 function actions(){
  const R=get().state.round,c=R.cur,q=c.q;let html='';
  if(c.done){html=`<button class="primary" data-act="next">${R.i+1<R.qs.length?'下一题 →':'看本轮成绩'}</button>`;
   if(c.canAppeal)html+='<button class="secondary" data-act="appeal" title="判分器没认出等价写法时用">我的写法也对，改判</button>'}
  else if(c.mode==='group'){html=c.stage==='answer'?'<button class="primary" data-act="submit-group">交卷</button>':'<span class="st-ask">还有主观小题待自评（见各小题下方）。</span>'}
  else if(c.stage==='self'){const lv=S.selfLevels(q,isWriting(q));html='<span class="st-ask">对照解析，你答得怎么样？</span>'+lv.map(([id,name])=>`<button class="${id==='right'?'primary':'secondary'}" data-self="${id}">${name}</button>`).join('')}
  else if(c.mode==='choice')html=`<button class="primary" data-act="submit" ${c.picked.size?'':'disabled'}>交卷</button>`;
  else if(c.mode==='math'||c.mode==='text'){const any=inputValues().some(v=>v.trim());html=`<button class="primary" data-act="submit-input" ${any?'':'disabled'}>交卷</button><button class="secondary" data-act="giveup">不会，看答案</button>`}
  else html='<button class="primary" data-act="reveal">想好了，看答案</button>';
  for(const id of ['st-actions','st-sol-foot']){const box=$(id);if(!box)continue;
   box.innerHTML=id==='st-sol-foot'&&!(c.done||c.stage==='self'&&c.mode!=='group')?'':html;
   box.querySelectorAll('[data-self]').forEach(b=>b.onclick=()=>finish(S.gradeSelf(q,b.dataset.self,isWriting(q))));
   box.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>act(b.dataset.act));}
 }
 function act(a){
  const c=get().state.round.cur,q=c.q;
  if(a==='next')next();
  else if(a==='submit'){if(c.picked.size)finish(S.gradeChoice(q,[...c.picked].join('')))}
  else if(a==='submit-input')submitInput(false);
  else if(a==='giveup')submitInput(true);
  else if(a==='submit-group')submitGroup();
  else if(a==='appeal')appeal();
  else reveal();
 }
 function enter(){
  const c=get().state.round.cur;
  if(c.done){next();return}
  if(c.mode==='choice'){if(c.picked.size)act('submit');return}
  if(c.mode==='math'||c.mode==='text'){if(inputValues().some(v=>v.trim()))act('submit-input');return}
  if(c.mode==='self'&&c.stage==='answer')reveal();
 }
 function submitInput(giveup){
  const R=get().state.round,c=R.cur,q=c.q;if(c.done)return;
  const vals=giveup?inputValues().map(()=>''):inputValues();
  const res=c.mode==='math'?S.gradeMath(q,c.blanks,vals):S.gradeText(q,vals[0]);
  document.querySelectorAll('#st-work .st-in').forEach((inp,k)=>{inp.disabled=true;const ok=c.mode==='math'?res.each[k]:res.verdict==='right';inp.classList.add(ok?'ok':'bad');
   const mk=$('st-mk-'+k);if(mk){mk.textContent=ok?'✓':'✗';mk.className='st-in-mark '+(ok?'ok':'bad')}});
  const kp=$('st-keypad');if(kp)kp.hidden=true;
  c.canAppeal=!giveup&&res.verdict!=='right'&&vals.some(v=>v.trim());
  finish(res);
 }
 function appeal(){
  const R=get().state.round,c=R.cur;if(!c.done||!c.canAppeal)return;c.canAppeal=false;
  regrade({...R.results[R.i],points:R.results[R.i].max,verdict:'right',appealed:true});
  document.querySelectorAll('#st-work .st-in').forEach(i=>{i.classList.remove('bad');i.classList.add('ok')});
  message('已改判为答对。','ok');
 }
 function choose(letter){
  const R=get().state.round;if(!R||!R.cur||R.cur.done||get().paused)return;const c=R.cur,q=c.q;
  if(c.mode!=='choice'||!q.options.length||letter.charCodeAt(0)-65>=q.options.length)return;
  if(q.type==='single'){c.picked=c.picked.has(letter)?new Set():new Set([letter])}
  else if(c.picked.has(letter))c.picked.delete(letter);else c.picked.add(letter);
  Sound.click();markPicked();actions();
 }
 function markPicked(){const c=get().state.round.cur;document.querySelectorAll('#st-options [data-opt]').forEach(b=>b.setAttribute('aria-pressed',c.picked.has(b.dataset.opt)))}
 function reveal(){const R=get().state.round,c=R.cur;c.stage='self';Sound.hintSpark();showSolution(null);actions();bubble(say('self'));setPig('student','worry')}
 function finish(res){
  const t=get().state,R=t.round,c=R.cur,q=c.q;if(c.done)return;c.done=true;c.stage='done';
  R.results[R.i]=res;
  R.streak=res.verdict==='right'?R.streak+1:0;R.best=Math.max(R.best,R.streak);
  Store.set('study-wrong',S.updateWrongBook(wrongBook(),q,res.verdict));
  const done=Store.get('study-done',0);Store.set('study-done',(+done||0)+1);
  if(c.mode==='choice'&&q.options.length){document.querySelectorAll('#st-options [data-opt]').forEach(b=>{const o=b.dataset.opt;b.disabled=true;b.classList.toggle('is-answer',q.answer.includes(o));b.classList.toggle('is-wrong',c.picked.has(o)&&!q.answer.includes(o))})}
  react(res);
  showSolution(res);actions();
  stats(sum2(R.results),R.results.filter(r=>r&&r.verdict==='right').length+'/'+R.results.filter(Boolean).length);
  const d=document.querySelectorAll('.st-dots i')[R.i];if(d)d.className=res.verdict;
  message(res.verdict==='right'?`答对了！+${S.fmt(res.points)} 分。`:res.verdict==='partial'?`部分正确，+${S.fmt(res.points)} 分。`:'这题没拿到分，已记进错题本。',res.verdict==='wrong'?'warn':'ok');
 }
 // 交卷后改分（改判、整篇阅读里补自评）
 function regrade(res){
  const R=get().state.round,c=R.cur,q=c.q;R.results[R.i]=res;
  Store.set('study-wrong',S.updateWrongBook(wrongBook(),q,res.verdict));
  feedback(res);react(res,true);
  stats(sum2(R.results),R.results.filter(r=>r&&r.verdict==='right').length+'/'+R.results.filter(Boolean).length);
  const d=document.querySelectorAll('.st-dots i')[R.i];if(d)d.className=res.verdict;actions();
 }
 function react(res,quiet){
  const R=get().state.round;
  if(res.verdict==='right'){setPig('student',R.streak>=3?'star':'happy');setPig('teacher','happy');bubble(say('right'));if(quiet)return;if(R.streak>=3)Sound.pigCheer();else Sound.pigHappy();if(R.streak>=3&&R.streak%3===0&&confetti)confetti(28);bump('st-student')}
  else if(res.verdict==='partial'){setPig('student','smug');setPig('teacher','wink');bubble(say('partial'));if(!quiet)Sound.pigOink({rate:1.1})}
  else{setPig('student','cry');setPig('teacher','worry');bubble(say('wrong'));if(!quiet)Sound.pigWhimper()}
  const st=$('st-streak');if(st)st.textContent=R.streak>=2?'连对 ×'+R.streak:'';
 }
 function feedback(res){
  const c=get().state.round.cur,q=c.q,fb=$('st-feedback');
  let detail='';
  if(c.mode==='choice')detail=`正确答案 <b>${q.answer}</b>，你选了 <b>${res.picked||'—'}</b>`;
  else if(c.mode==='group')detail=`小题对 <b>${res.subs.filter(r=>r.verdict==='right').length}</b> / ${res.subs.length}`;
  else if((c.mode==='math'||c.mode==='text')&&res.typed){detail=res.typed.some(Boolean)?'你填的是 <b>'+res.typed.map(v=>esc(v||'（空）')).join('；')+'</b>':'没有作答'}
  if(res.appealed)detail+='（已改判）';else if(res.self)detail+='（自评）';
  fb.className='st-feedback '+res.verdict;fb.innerHTML=`<span class="st-verdict">${res.verdict==='right'?'✓ 答对了':res.verdict==='partial'?'◐ 部分正确':'✗ 没答对'}</span><span>${detail}</span><span class="st-gain">+${S.fmt(res.points)} / ${S.fmt(res.max)} 分</span>`;fb.hidden=false;
 }
 function showSolution(res){
  const R=get().state.round,q=R.cur.q,bank=R.byId[q.bankId];
  if(res)feedback(res);
  const fb=$('st-feedback'),sol=$('st-solution');if(!sol.hidden&&!res)return;
  if(sol.hidden||!sol.childNodes.length){
   sol.innerHTML='<div class="st-sol-head"><b>答案与解析</b>'+(q.title?`<span>${esc(q.title)}</span>`:'')+'</div><div class="st-answer sx" id="st-answer"></div><div class="st-sol-body sx" id="st-sol-body"></div><div class="st-sol-foot" id="st-sol-foot"></div>';
   $('st-answer').appendChild(render('<b>答案：</b>'+q.answer,bank));
   $('st-sol-body').appendChild(render(q.solution||'（原卷没有解析）',bank));
   sol.hidden=false;
  }
  // 整篇阅读交卷时停在小题区，自评后再往下看
  if(R.cur.mode==='group'&&!res)return;
  const top=fb.hidden?sol:fb;setTimeout(()=>{const r=top.getBoundingClientRect();if(r.top>window.innerHeight*.75||r.top<0)top.scrollIntoView({block:'start',behavior:'smooth'})},60);
 }
 function next(){
  const t=get().state,R=t.round;Sound.click();
  if(R.i+1<R.qs.length){R.i++;question();return}
  const sum=S.roundSummary(R.results);ui.setRunning(false);again=get().level;
  const fresh=record(sum.got);stats(sum.got,sum.right+'/'+sum.total);
  const pct=Math.round(sum.rate*100);
  // 收起长解析，换成本轮小结，成绩卡才会出现在眼前
  const icon=v=>v==='right'?'✓':v==='partial'?'◐':'✗';
  $('st-wrap').innerHTML=`<div class="st-summary"><div class="st-scene st-scene-row"><div class="st-teacher" id="st-teacher">${teacher('normal')}</div><div class="st-bubble" id="st-bubble">${esc(sum.stars>=2?'这一轮学得真好！':'错题本记下了，回头再练练。')}</div><div class="st-student" id="st-student">${student('normal')}</div></div>
   <ol class="st-review">${R.qs.map((q,k)=>{const r=R.results[k];return `<li class="${r.verdict}"><b>${icon(r.verdict)}</b><span>${esc(q.kind||S.TYPES[q.type])} · ${stars(q.level)} · ${esc(q.bank)} ${q.sourceNos&&q.sourceNos.length>1?'第 '+q.sourceNos[0]+'—'+q.sourceNos[q.sourceNos.length-1]+' 题':'第 '+q.no+' 题'}</span><em>${S.fmt(r.points)} / ${S.fmt(r.max)}</em></li>`}).join('')}</ol></div>`;
  const card=document.querySelector('.game-card');if(card&&card.getBoundingClientRect().top<0)card.scrollIntoView({block:'start'});
  setPig('student',sum.stars>=2?'star':sum.stars?'happy':'cry');setPig('teacher',sum.stars>=2?'happy':'normal');
  if(sum.stars>=3&&confetti)confetti(48);
  const wrongN=R.results.filter(r=>r.verdict!=='right').length;
  result(sum.stars>=3?'学霸小猪！':sum.stars===2?'学得真扎实！':sum.stars===1?'继续加油！':'下次一定行！',
   `${'★'.repeat(sum.stars)}${'☆'.repeat(3-sum.stars)}　本轮 ${S.fmt(sum.got)} / ${S.fmt(sum.max)} 分（${pct}%），全对 ${sum.right} / ${sum.total} 题，最长连对 ${R.best}。${wrongN?'没拿满分的 '+wrongN+' 题已记进错题本。':''}${fresh?' 新纪录！':''}`,
   sum.stars>=2,600,{actions:[{id:'st-lobby',label:'换套卷 / 题型',onclick:()=>{again=null;$('result').hidden=true;t.view='lobby';t.round=null;lobby()}}]});
  if(sum.stars>=2)Sound.later(200,()=>Sound.win());else Sound.later(200,()=>Sound.pigOink());
 }
 function setPig(who,expr){const el=$(who==='teacher'?'st-teacher':'st-student');if(el)el.innerHTML=who==='teacher'?teacher(expr):student(expr)}
 function bubble(text){const b=$('st-bubble');if(!b)return;b.textContent=text;b.classList.remove('pop');void b.offsetWidth;b.classList.add('pop')}
 function bump(id){const el=$(id);if(!el)return;el.classList.remove('hop');void el.offsetWidth;el.classList.add('hop')}

 function keyFor(e){
  const t=get().state;if(!active()||t.view!=='quiz'||!t.round||get().paused)return null;
  const k=e.key,c=t.round.cur;
  if(c&&c.mode==='choice'&&!c.done){
   if(/^[1-8]$/.test(k))return {opt:String.fromCharCode(64+ +k)};
   if(/^[a-hA-H]$/.test(k)&&c.q.options.length)return {opt:k.toUpperCase()};
  }
  if(k==='Enter')return {enter:true};
  return null;
 }
 function captureKeys(e){
  const a=keyFor(e);if(!a)return false;
  if(e.target&&e.target.tagName==='BUTTON'&&a.enter)return false; // 让按钮自己响应回车
  e.preventDefault();
  if(a.opt){choose(a.opt);return true}
  enter();return true;
 }
 return {configs,has,init,tick:()=>{},resize:()=>{},keyDown:()=>false,keyUp:()=>{},clearKeys:()=>{},captureKeys,
  changeLook:()=>{if(active()&&get().state.view==='quiz'){const el=$('st-student');if(el)el.innerHTML=student('normal')}},
  leave:()=>{}};
}
root.PigStudyUI={configs,create,render,typeset,makeHost};
})(typeof window!=='undefined'?window:globalThis);
