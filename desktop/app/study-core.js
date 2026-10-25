/* 猪猪爱学习 · 题库规则（不碰页面，Node 里也能测）
 * 题库文件由「猪猪爱学习题库工具」从排版项目的 LaTeX 套卷生成，放在游戏旁边的「猪猪题库」文件夹；
 * 这里负责：检查与整理题库、按学科细分题型、估难度、定分值、挑题、判分（单选、多选部分分、
 * 数学填空 / 英语语法填空输入判分、主观题自评、整篇阅读逐小题作答）、错题本。
 */
(function(root){
'use strict';
const FORMAT='piggy-study-bank';
const SUBJECTS=[['math','数学'],['physics','物理'],['chem','化学'],['bio','生物'],['chinese','语文'],['english','英语'],['other','其他']];
const SUBJECT_NAME=Object.fromEntries(SUBJECTS);
const TYPES={single:'单选题',multi:'多选题',blank:'填空题',solve:'解答题'};
// 各学科的细分题型（选课页的“题型”按这个列；没有题的题型会自动隐藏）
const KINDS={
 math:['单选题','多选题','填空题','解答题'],
 physics:['单选题','多选题','实验题','填空题','计算题'],
 chem:['选择题','化学实验题','工艺流程题','反应原理题','物质结构题','有机化学题','其他非选择题'],
 bio:['单选题','不定项选择题','遗传题','实验探究题','其他非选择题'],
 chinese:['信息类阅读','文学类阅读','文言文阅读','古代诗歌阅读','名句默写','语言文字运用','写作'],
 english:['阅读理解','七选五','完形填空','语法填空','阅读表达','应用文写作','读后续写','概要写作'],
 other:['单选题','多选题','填空题','解答题']};
// “全部学科”时用的大类
const CATS=['选择题','填空题','解答题','阅读题组','写作'];
const LEVELS={1:'基础',2:'中档',3:'较难'};
// 没有原卷分值时的默认分值（新高考常见卷面）
const DEFAULT_POINTS={
 math:{single:5,multi:6,blank:5,solve:15},physics:{single:4,multi:5,blank:8,solve:13},chem:{single:3,multi:4,blank:14,solve:14},
 bio:{single:2,multi:4,blank:12,solve:12},chinese:{single:3,multi:3,blank:6,solve:6},english:{single:2.5,multi:2.5,blank:1.5,solve:15},other:{single:5,multi:6,blank:5,solve:12}};
// 旧接口：数学默认分值
const POINTS=DEFAULT_POINTS.math;
const str=(v,max)=>typeof v==='string'?v.slice(0,max||200000):'';
const plain=html=>String(html||'').replace(/<span class="sx-(?:m|dm)">[\s\S]*?<\/span>/g,'x').replace(/<[^>]+>/g,' ').replace(/&[a-z]+;/g,' ').replace(/\s+/g,' ');
const fmt=n=>Number.isInteger(n)?String(n):String(Math.round(n*10)/10);

// 文件头里先读出名称、学科、题数，列表时不必解析整份题库
function peekHeader(text){
 const head=String(text||'').slice(0,4096);
 if(!new RegExp('"format"\\s*:\\s*"'+FORMAT+'"').test(head))return null;
 const pick=k=>{const m=new RegExp('"'+k+'"\\s*:\\s*("(?:[^"\\\\]|\\\\.)*"|\\d+)').exec(head);if(!m)return null;try{return JSON.parse(m[1])}catch(e){return null}};
 return {id:pick('id'),title:pick('title'),subject:pick('subject'),subjectName:pick('subjectName'),count:pick('count'),built:pick('built'),book:pick('book'),chapter:pick('chapter'),topic:pick('topic')};
}

// 选书时先列书名，再逐层展开目录；文件位置不决定目录，安卓导入后也保留同一层级。
function libraryTree(entries){
 const roots=[],byKey=Object.create(null),bookMap=new Map();let papers=null;
 const make=(key,label,kind,children=[])=>{const n={key,label,kind,children,entries:[],count:0};byKey[key]=n;return n};
 const add=(n,b)=>{n.entries.push(b);n.count+=+b.count||0};
 for(const b of entries||[]){
  const book=String(b.book||(/必刷题|解题觉醒|数学好题组合|晶体与配合物四组/.test(b.title||'')?b.title:''));
  if(!book){if(!papers){papers=make('papers','综合试卷与练习','papers');roots.push(papers)}const leaf=make('bank:'+b.id,b.title,'bank');leaf.subject=b.subject;leaf.subjectName=b.subjectName;leaf.bankId=b.id;add(leaf,b);add(papers,b);papers.children.push(leaf);continue}
  const bk=JSON.stringify([b.subject,book]);let root=bookMap.get(bk);
  if(!root){root=make('book:'+bk,(b.title||book).split(/\s+·\s+/)[0]||book,'book');root.book=book;root.subject=b.subject;root.subjectName=b.subjectName;bookMap.set(bk,root);roots.push(root)}
  add(root,b);
  const chapter=String(b.chapter||'全书内容');let topic=String(b.topic||'全部内容');
  if(topic.startsWith(chapter))topic=topic.slice(chapter.length).replace(/^[\s·]+/,'');
  const parts=[chapter,...topic.split(/\s*·\s*|\s*[-—]\s*(?=课时\s*\d)/).filter(Boolean)];if(parts.length===1)parts.push('全部内容');
  let parent=root;
  for(let i=0;i<parts.length-1;i++){
   const key='dir:'+JSON.stringify([b.subject,book,...parts.slice(0,i+1)]);let child=byKey[key];
   if(!child){child=make(key,parts[i],i===0?'chapter':'section');child.path=[book.replace(/_配套课件$/,''),...parts.slice(0,i+1)];parent.children.push(child)}add(child,b);parent=child;
  }
  const leaf=make('bank:'+b.id,parts[parts.length-1],'bank');leaf.path=[book.replace(/_配套课件$/,''),...parts];leaf.subject=b.subject;leaf.subjectName=b.subjectName;leaf.bankId=b.id;add(leaf,b);parent.children.push(leaf);
 }
 const number=s=>{const m=/^(?:第|专题|专练|课时|专项觉醒\s*)([0-9一二三四五六七八九十百]+)/.exec(s);if(!m)return 10000;const n=m[1];if(/^\d+$/.test(n))return +n;const nums={'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};if(n==='十')return 10;if(n.includes('十')){const p=n.split('十');return (nums[p[0]]||1)*10+(nums[p[1]]||0)}return nums[n]||10000};
 const rank=s=>/^第|^课时/.test(s)?0:/^(?:专题|专练|专项)/.test(s)?1:2;
 const sort=n=>{n.children.sort((a,b)=>rank(a.label)-rank(b.label)||number(a.label)-number(b.label)||a.label.localeCompare(b.label,'zh',{numeric:true}));n.children.forEach(sort)};roots.forEach(sort);
 roots.sort((a,b)=>a.kind==='papers'?1:b.kind==='papers'?-1:SUBJECTS.findIndex(x=>x[0]===a.subject)-SUBJECTS.findIndex(x=>x[0]===b.subject)||a.label.localeCompare(b.label,'zh',{numeric:true}));
 return {roots,byKey,books:bookMap.size,papers:papers?papers.entries.length:0};
}

// ---------- 题型细分 ----------
function classify(q,subject,bankTitle){
 if(q.kind&&(KINDS[subject]||[]).includes(q.kind))return q.kind;
 const head=(q.part||'')+' '+(q.title||''),stem=plain(q.stem).slice(0,1500),all=head+' '+stem;
 if(subject==='english'){
  const subs=q.subs||[];
  if(/七选五/.test(head)||q.shared&&q.shared.length>=6||/阅读/.test(head)&&/第二节/.test(head))return '七选五';
  if(/完形/.test(head)||/语言运用|知识运用/.test(head)&&/第一节/.test(head))return '完形填空';
  if(/语法填空/.test(head)||/语言运用|知识运用/.test(head)&&/第二节/.test(head)||subs.length&&subs.every(s=>s.type==='blank'))return '语法填空';
  if(/阅读表达/.test(head)||subs.length>1&&subs.every(s=>s.type==='solve'))return '阅读表达';
  if(/概要/.test(head))return '概要写作';
  if(/续写/.test(all)||/写作|书面表达/.test(head)&&/第二节/.test(head))return '读后续写';
  if(/写作|书面表达|应用文/.test(head)||!subs.length&&q.type==='solve'&&!q.grouped)return '应用文写作';
  return '阅读理解';
 }
 if(subject==='chinese'){
  const subTxt=(q.subs||[]).map(s=>plain(s.stem)).join(' ')||stem;
  if(/写作|作文/.test(head))return '写作';
  if(/文言/.test(head)||/翻译成现代汉语|断句|加点的?词/.test(subTxt))return '文言文阅读';
  if(/诗歌|古诗|诗词/.test(head)||/(这首|本诗|该诗|此诗|诗中|词中|本词|这首词|颔联|颈联|尾联|首联)/.test(subTxt))return '古代诗歌阅读';
  if(/默写/.test(head)||!q.subs&&/名篇名句|默写/.test(subTxt))return '名句默写';
  if(/语言文字运用|语用/.test(head))return '语言文字运用';
  if(/小说|散文|人物形象|情节|叙述|艺术特色|文学/.test(subTxt))return '文学类阅读';
  return '信息类阅读';
 }
 const t=q.type;
 if(subject==='math'||subject==='other')return TYPES[t];
 if(subject==='physics'){
  if(t==='single'||t==='multi')return TYPES[t];
  if(/实验/.test(head)||/实验|测量|测定|探究/.test(stem.slice(0,200)))return '实验题';
  return t==='blank'?'填空题':'计算题';
 }
 if(subject==='chem'){
  if(t==='single'||t==='multi')return '选择题';
  if(/流程|工艺|浸出|焙烧|滤渣|酸浸/.test(stem))return '工艺流程题';
  if(/有机|合成路线|官能团|同分异构/.test(stem))return '有机化学题';
  if(/晶胞|晶体|杂化|电子排布|配合物|价层电子|配位/.test(stem))return '物质结构题';
  if(/实验|装置|仪器|滴定/.test(stem))return '化学实验题';
  if(/平衡常数|反应速率|焓变|ΔH|转化率|电极|化学平衡|活化能/.test(stem))return '反应原理题';
  return '其他非选择题';
 }
 if(subject==='bio'){
  if(t==='single')return '单选题';if(t==='multi')return '不定项选择题';
  if(/遗传|杂交|基因型|显性|隐性|纯合|F[_ ]?1|F₁/.test(stem))return '遗传题';
  if(/实验|探究|对照组|自变量/.test(stem))return '实验探究题';
  return '其他非选择题';
 }
 return TYPES[t];
}
function catOf(q,kind){
 if(/写作/.test(kind))return '写作';
 if(q.subs)return '阅读题组';
 return q.type==='single'||q.type==='multi'?'选择题':q.type==='blank'?'填空题':'解答题';
}

// ---------- 分值 ----------
function pointsInText(t){const m=/^\s*[（(]\s*(?:本(?:小)?题)?\s*(?:满分)?\s*(\d{1,2}(?:\.\d)?)\s*分\s*[)）]/.exec(t)||/[（(]\s*(\d{1,2}(?:\.\d)?)\s*分\s*[)）]\s*$/.exec(t.slice(0,400).trim());return m?+m[1]:0}
function eachInPart(part){const m=/每(?:小)?题\s*(?:各)?\s*(\d{1,2}(?:\.\d)?)\s*分/.exec(part||'');return m?+m[1]:0}
function pointsFor(q,subject,kind,bankTitle){
 if(+q.points>0&&+q.points<=150)return +q.points;
 if(q.subs&&q.subs.length)return q.subs.reduce((s,x)=>s+x.points,0);
 const own=pointsInText(plain(q.stem));if(own)return own;
 const each=eachInPart(q.part);if(each)return each;
 const head=q.part||'';const full=[...head.matchAll(/满分\s*(\d{1,2})\s*分/g)].pop();
 if(subject==='english'){if(kind==='读后续写')return 25;if(/写作/.test(kind))return full?+full[1]:15}
 if(subject==='chinese'&&kind==='写作')return 60;
 const comp=/竞赛|联赛|奥林匹克/.test(bankTitle||'');
 if(subject==='math'&&comp)return q.type==='blank'?8:/加试/.test(bankTitle)?45:20;
 return (DEFAULT_POINTS[subject]||DEFAULT_POINTS.other)[q.type];
}
// 多选的部分分规则：数学按选对个数；物理、生物等“选对但不全得 x 分”
function partialRule(q,subject,max){
 const m=/选对但不全的?得\s*(\d{1,2})\s*分/.exec(q.part||'');if(m)return +m[1];
 if(/部分选对的?得部分分/.test(q.part||'')||subject==='math'||subject==='other')return 'prop';
 if(subject==='physics')return max>=6?3:Math.round(max*0.6);
 return max/2;
}

// ---------- 难度：没有原卷难度标记，按题在卷中的位置和栏目估计 ----------
const PART_LEVEL=[[/刷基础|基础练|夯实基础|课时基础/,1],[/刷难关|压轴|培优|拓展|刷素养|挑战|难点|竞赛/,3],[/刷提升|提升|能力|刷易错|易错|综合/,2]];
function estimateLevels(list,subject,bankTitle){
 const comp=/竞赛|联赛|奥林匹克|强基/.test(bankTitle||'');
 const byType={};list.forEach(q=>(byType[q.type]=byType[q.type]||[]).push(q));
 for(const q of list){
  if(q.level)continue;
  if(comp){q.level=3;continue}
  const pl=PART_LEVEL.find(([re])=>re.test(q.part||''));if(pl){q.level=pl[1];continue}
  if(subject==='english'){q.level={七选五:2,完形填空:2,语法填空:2,阅读表达:2,应用文写作:2,读后续写:3,概要写作:3}[q.kind]||0;if(q.level)continue}
  if(subject==='chinese'){q.level={语言文字运用:1,名句默写:1,信息类阅读:2,文学类阅读:2,写作:2,文言文阅读:3,古代诗歌阅读:3}[q.kind]||2;continue}
  const peers=subject==='english'?list.filter(x=>x.kind===q.kind):byType[q.type];
  const n=peers.length,r=n>1?peers.indexOf(q)/(n-1):.5;
  q.level=n<2?2:r<.34?1:r<.75?2:3;
 }
}

// ---------- 检查并整理一份题库；不合格返回 {error} ----------
function letters(a){return [...new Set(String(a||'').toUpperCase().replace(/[^A-H]/g,''))].sort().join('')}
function normalizeSub(s,subject,bankTitle,group){
 if(!s||!['single','multi','blank','solve','pick'].includes(s.type))return null;
 const sub={no:+s.no||0,type:s.type,stem:str(s.stem,40000),options:Array.isArray(s.options)?s.options.map(o=>str(o,4000)).slice(0,8):[],answer:str(s.answer,20000).trim(),shared:!!s.shared,picks:[]};
 const nOpt=sub.shared?group.shared.length:sub.options.length;
 if(sub.type==='single'||sub.type==='multi'){
  sub.answer=letters(sub.answer);
  if(!sub.answer||nOpt<2||[...sub.answer].some(c=>c.charCodeAt(0)-65>=nOpt)){sub.type='solve';sub.answer=str(s.answer,20000)}
 }
 if(sub.type==='pick'){sub.answer=letters(sub.answer);sub.picks=Array.isArray(s.picks)?s.picks.filter(x=>/^[A-H]$/.test(x)).slice(0,8):[];if(!sub.answer||sub.picks.length<=sub.answer.length)sub.type='solve'}
 sub.points=+s.points>0&&+s.points<=60?+s.points:pointsInText(plain(sub.stem))||eachInPart(group.part)||
  (subject==='chinese'&&sub.type==='solve'&&/翻译成现代汉语/.test(plain(sub.stem))?8:0)||
  (subject==='english'?(sub.options.length===4&&/^\s*第\s*\d+\s*空/.test(plain(sub.stem))?1:sub.type==='blank'?1.5:2.5):(DEFAULT_POINTS[subject]||DEFAULT_POINTS.other)[sub.type==='pick'?'single':sub.type]);
 // 只有英语语法填空自动判；语文默写、简答对照答案自评
 sub.mode=sub.type==='single'||sub.type==='multi'?'choice':sub.type==='pick'?'pick':sub.type==='blank'&&subject==='english'&&textAnswers(sub.answer).length?'text':'self';
 return sub;
}
function normalizeBank(obj,fallbackName){
 if(!obj||typeof obj!=='object'||obj.format!==FORMAT)return {error:'不是猪猪题库文件'};
 if(+obj.version>2)return {error:'题库版本太新，请先更新游乐场'};
 const subject=SUBJECT_NAME[obj.subject]?obj.subject:'other';
 const bank={id:str(obj.id,64)||('b'+hash(str(obj.title)||fallbackName||'')),title:str(obj.title,120)||str(fallbackName,120)||'未命名题库',
  subject,subjectName:str(obj.subjectName,10)||SUBJECT_NAME[subject],source:str(obj.source,300),built:str(obj.built,20),book:str(obj.book,160),chapter:str(obj.chapter,160),topic:str(obj.topic,240),
  macros:{},figures:{},units:[],questions:[]};
 if(obj.macros&&typeof obj.macros==='object')for(const [k,v] of Object.entries(obj.macros))if(/^\\[A-Za-z]+$/.test(k)&&typeof v==='string'&&v.length<400)bank.macros[k]=v;
 if(obj.figures&&typeof obj.figures==='object')for(const [k,f] of Object.entries(obj.figures)){
  if(!/^[\w-]{1,40}$/.test(k)||!f||typeof f.src!=='string'||!/^data:image\/(webp|png|jpeg|gif);base64,[A-Za-z0-9+/=]+$/.test(f.src))continue;
  bank.figures[k]={src:f.src,w:Math.max(8,Math.min(1600,+f.w||300)),h:Math.max(8,Math.min(2400,+f.h||200))};
 }
 const units=Array.isArray(obj.units)?obj.units:[];
 units.forEach((u,ui)=>{
  if(!u||!Array.isArray(u.questions))return;const name=str(u.name,120),list=[];
  for(const q of u.questions){
   if(!q||!TYPES[q.type])continue;
   const options=Array.isArray(q.options)?q.options.map(o=>str(o,20000)).slice(0,8):[];
   let answer=str(q.answer,20000).trim();
   if(q.type==='single'||q.type==='multi'){
    answer=letters(answer);
    if(!answer||options.length<2||[...answer].some(c=>c.charCodeAt(0)-65>=options.length))continue;
   }
   const stem=str(q.stem);if(!stem)continue;
   const id=bank.id+'/'+(str(q.id,60)||ui+'-'+q.no);
   const item={id,bankId:bank.id,bank:bank.title,unit:name,no:+q.no||0,label:str(q.label,60),type:q.type,part:str(q.part,200),title:str(q.title,200),stem,options,answer,solution:str(q.solution),
    grouped:!!q.grouped,sourceNos:Array.isArray(q.sourceNos)?q.sourceNos.map(Number).filter(Boolean).slice(0,40):null,level:[1,2,3].includes(+q.level)?+q.level:0,points:+q.points||0,kind:str(q.kind,20)};
   if(Array.isArray(q.shared))item.shared=q.shared.map(o=>str(o,4000)).slice(0,8);
   if(Array.isArray(q.subs)&&q.subs.length){item.subs=[];
    for(const s of q.subs.slice(0,40)){const n=normalizeSub(s,subject,bank.title,{shared:item.shared||[],part:item.part});if(n)item.subs.push(n)}
    if(!item.subs.length)delete item.subs}
   item.kind=classify(item,subject,bank.title);
   item.cat=catOf(item,item.kind);
   item.points=pointsFor(item,subject,item.kind,bank.title);
   if(item.type==='multi')item.partial=partialRule(item,subject,item.points);
   item.mode=item.subs?'group':item.type==='single'||item.type==='multi'?'choice':item.type==='blank'&&subject==='english'&&textAnswers(item.answer).length?'text':item.type==='blank'&&subject==='math'?'math':'self';
   list.push(item);
  }
  estimateLevels(list,subject,bank.title);
  bank.questions.push(...list);
  bank.units.push(name);
 });
 bank.count=bank.questions.length;
 if(!bank.count)return {error:'题库里没有可用的题目'};
 return bank;
}
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)}

// ---------- 挑题：学科 / 套卷 / 题型 / 难度；先挑最近没做过的，再随机 ----------
function filterPool(banks,opt){
 opt=opt||{};const out=[];
 for(const b of banks){
  if(opt.subject&&opt.subject!=='all'&&b.subject!==opt.subject)continue;
  if(opt.bankId&&opt.bankId!=='all'&&b.id!==opt.bankId)continue;
  for(const q of b.questions){
   if(opt.types&&!opt.types.includes(q.type))continue;
   if(opt.kinds&&!opt.kinds.includes(q.kind))continue;
   if(opt.cats&&!opt.cats.includes(q.cat))continue;
   if(opt.levels&&opt.levels.length&&!opt.levels.includes(q.level))continue;
   out.push(q);
  }
 }
 return out;
}
function pickRound(pool,n,rand,recent,wrongIds){
 rand=rand||Math.random;const seen=new Set(recent||[]);
 let list=pool;
 if(wrongIds){const w=new Set(wrongIds);list=pool.filter(q=>w.has(q.id))}
 const fresh=list.filter(q=>!seen.has(q.id)),old=list.filter(q=>seen.has(q.id));
 const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
 return shuffle(fresh).concat(shuffle(old)).slice(0,n);
}

// ---------- 判分 ----------
function maxOf(q){return q.points||POINTS[q.type]||5}
function gradeChoice(q,picked){
 const max=maxOf(q);const p=letters(picked);
 if(!p)return {points:0,max,verdict:'wrong',picked:p};
 if(q.type==='single')return p===q.answer?{points:max,max,verdict:'right',picked:p}:{points:0,max,verdict:'wrong',picked:p};
 const ans=new Set(q.answer);
 if([...p].some(c=>!ans.has(c)))return {points:0,max,verdict:'wrong',picked:p};
 if(p.length===ans.size)return {points:max,max,verdict:'right',picked:p};
 const rule=q.partial==null?'prop':q.partial;
 const pts=rule==='prop'?Math.round(max/ans.size*p.length*10)/10:+rule;
 return {points:pts,max,verdict:'partial',picked:p};
}
// 断句一类：每选对一处得分，选的个数超过答案个数不得分
function gradePick(q,picked){
 const max=maxOf(q),p=letters(picked);
 if(!p||p.length>q.answer.length)return {points:0,max,verdict:'wrong',picked:p};
 const hit=[...p].filter(c=>q.answer.includes(c)).length;
 const pts=Math.round(max/q.answer.length*hit*10)/10;
 return {points:pts,max,verdict:pts>=max?'right':pts>0?'partial':'wrong',picked:p};
}
// 自评：全对 / 大部分 / 一半 / 少量 / 不会（分值小的题只分全对、一半、不会）
const SELF_LEVELS=[['right','全对',1],['most','大部分对',.75],['partial','对一半',.5],['few','只对一点',.25],['wrong','不会 / 错了',0]];
const WRITING_LEVELS=[['right','优秀（满分档）',1],['most','较好',.8],['partial','中等',.6],['few','较差',.35],['wrong','没写',0]];
function selfLevels(q,writing){
 if(writing)return WRITING_LEVELS;
 const max=maxOf(q);
 if(q.type==='blank'&&max<=6)return [SELF_LEVELS[0],SELF_LEVELS[4]];
 return max>=10?SELF_LEVELS:[SELF_LEVELS[0],SELF_LEVELS[2],SELF_LEVELS[4]];
}
function gradeSelf(q,level,writing){
 const max=maxOf(q);const lv=SELF_LEVELS.concat(WRITING_LEVELS).find(x=>x[0]===level)||SELF_LEVELS[4];
 const share=writing?(WRITING_LEVELS.find(x=>x[0]===level)||lv)[2]:lv[2];
 if(q.type==='blank'&&max<=6&&share>0&&share<1)return {points:0,max,verdict:'wrong',self:true};
 const pts=Math.round(max*share*10)/10;
 return {points:pts,max,verdict:share>=1?'right':pts>0?'partial':'wrong',self:true};
}
// 英语语法填空：参考答案可能写成“have advanced/have been advancing”，大小写、首尾标点不计
function textAnswers(ans){
 const t=plain(ans).replace(/（[^）]*）|\([^)]*\)/g,' ').trim();
 if(!t||/[一-鿿]/.test(t.replace(/或/g,''))||t.length>60)return [];
 return t.split(/\s*(?:\/|／|或|;|；)\s*/).map(normText).filter(Boolean);
}
function normText(s){return String(s||'').toLowerCase().replace(/[’‘`]/g,"'").replace(/[^a-z0-9' -]+/g,' ').replace(/\s+/g,' ').trim()}
function gradeText(q,input){
 const max=maxOf(q),acc=textAnswers(q.answer),u=normText(input);
 const ok=!!u&&acc.includes(u);
 return {points:ok?max:0,max,verdict:ok?'right':'wrong',typed:String(input||'').trim()};
}
// 数学填空：每空一个输入框，几空按空数平分（没写的空 0 分）
function gradeMath(q,blanks,inputs){
 const M=root.PigStudyMath,max=maxOf(q);
 const res=blanks.map((b,k)=>M.check(b,inputs[k]));
 const hit=res.filter(r=>r.ok).length;
 const pts=Math.round(max/blanks.length*hit*10)/10;
 return {points:pts,max,verdict:hit===blanks.length?'right':hit?'partial':'wrong',typed:inputs.map(s=>String(s||'').trim()),each:res.map(r=>r.ok)};
}
// 整篇作答：逐小题判分；主观小题由玩家自评后再汇总
function gradeSub(s,value){
 if(s.mode==='choice')return gradeChoice({type:s.type,answer:s.answer,points:s.points,partial:'prop'},value);
 if(s.mode==='pick')return gradePick({answer:s.answer,points:s.points},value);
 if(s.mode==='text')return gradeText({answer:s.answer,points:s.points},value);
 return {points:0,max:s.points,verdict:'pending'};
}
function sumGroup(q,subResults){
 const got=Math.round(subResults.reduce((s,r)=>s+(r.points||0),0)*10)/10,max=Math.round(q.subs.reduce((s,x)=>s+x.points,0)*10)/10;
 const right=subResults.filter(r=>r.verdict==='right').length;
 return {points:got,max,verdict:got>=max-1e-9?'right':got>0?'partial':'wrong',subs:subResults,right,total:q.subs.length};
}
function roundSummary(results){
 const got=Math.round(results.reduce((s,r)=>s+r.points,0)*10)/10,max=Math.round(results.reduce((s,r)=>s+r.max,0)*10)/10;
 const right=results.filter(r=>r.verdict==='right').length;
 const rate=max?got/max:0,stars=rate>=.9?3:rate>=.7?2:rate>=.4?1:0;
 return {got,max,right,total:results.length,rate,stars};
}
// 错题本：答错（含部分对）记入，之后在“错题重练”里答对就移出
function updateWrongBook(book,q,verdict,now){
 book=Object.assign({},book||{});
 if(verdict==='right'){delete book[q.id];return book}
 const old=book[q.id];book[q.id]={n:(old?old.n:0)+1,at:now!=null?now:Date.now(),bank:q.bank,no:q.no};
 const keys=Object.keys(book);
 if(keys.length>400){keys.sort((a,b)=>book[a].at-book[b].at);for(const k of keys.slice(0,keys.length-400))delete book[k]}
 return book;
}
const api={FORMAT,SUBJECTS,SUBJECT_NAME,TYPES,KINDS,CATS,LEVELS,POINTS,DEFAULT_POINTS,fmt,plain,peekHeader,libraryTree,classify,pointsFor,normalizeBank,filterPool,pickRound,
 gradeChoice,gradePick,gradeSelf,selfLevels,textAnswers,gradeText,gradeMath,gradeSub,sumGroup,roundSummary,updateWrongBook};
root.PigStudyCore=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
