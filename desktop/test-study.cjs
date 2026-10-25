/* 猪猪爱学习：题库检查、挑题、判分与错题本。 */
const assert=require('node:assert/strict');
const S=require('./app/study-core.js');
let checks=0;function ok(v,message){assert.ok(v,message);checks++}
const fig='data:image/webp;base64,UklGRg==';
function bank(extra){return Object.assign({format:'piggy-study-bank',version:1,id:'t1',title:'测试卷',subject:'math',subjectName:'数学',count:5,macros:{'\\Hi':'\\textcolor{crimson}{#1}','bad':'x','\\x':'y'.repeat(500)},
 figures:{'t-q0':{src:fig,w:120,h:80},'../evil':{src:fig,w:1,h:1},'t-a0':{src:'javascript:alert(1)',w:1,h:1}},
 units:[{name:'',questions:[
  {no:1,type:'single',stem:'1+1=?',options:['1','2','3','4'],answer:'B',solution:'s'},
  {no:2,type:'multi',stem:'选出偶数',options:['1','2','3','4'],answer:'D, B',solution:'s'},
  {no:3,type:'single',stem:'越界答案',options:['1','2'],answer:'C',solution:'s'},
  {no:4,type:'blank',stem:'填空',options:[],answer:'<span class="sx-m">2</span>',solution:'s'},
  {no:5,type:'solve',stem:'解答',options:[],answer:'见解析',solution:'s'},
  {no:6,type:'weird',stem:'未知题型',options:[],answer:'',solution:''},
  {no:7,type:'single',stem:'',options:['a','b'],answer:'A',solution:''}]}]},extra||{})}

// 文件头
const text=JSON.stringify(bank());
const h=S.peekHeader(text);
ok(h&&h.title==='测试卷'&&h.subject==='math'&&h.count===5&&h.id==='t1','header peek');
ok(S.peekHeader('{"format":"other"}')===null&&S.peekHeader('')===null,'non-bank header');
const meta=S.peekHeader(JSON.stringify(bank({book:'物理书',chapter:'第一章',topic:'第一节 · 课时1'})));
ok(meta.book==='物理书'&&meta.chapter==='第一章'&&meta.topic==='第一节 · 课时1','header preserves book directory metadata');
const library=S.libraryTree([
 {id:'l1',subject:'physics',subjectName:'物理',book:'同名书',title:'物理书 · 第一章',chapter:'第一章',topic:'第一节 · 课时1',count:3},
 {id:'l2',subject:'physics',subjectName:'物理',book:'同名书',title:'物理书 · 第一章',chapter:'第一章',topic:'第一节 · 课时2',count:5},
 {id:'l3',subject:'physics',subjectName:'物理',book:'同名书',title:'物理书 · 第二章',chapter:'第二章',topic:'专题1',count:7},
 {id:'l4',subject:'math',subjectName:'数学',book:'同名书',title:'数学书 · 第一章',chapter:'第一章',topic:'第一章 · 第1节',count:2},
 {id:'p1',subject:'physics',subjectName:'物理',title:'综合试卷',count:15}]);
const physicsBook=library.roots.find(n=>n.kind==='book'&&n.subject==='physics'),firstChapter=physicsBook.children[0];
ok(library.books===2&&library.papers===1&&library.roots.every(n=>n.kind!=='bank'),'top level contains books and the collapsed paper collection');
ok(physicsBook.count===15&&firstChapter.count===8&&firstChapter.entries.map(b=>b.id).join(',')==='l1,l2','whole book and chapter selections contain exactly their own questions');
ok(firstChapter.children[0].label==='第一节'&&firstChapter.children[0].children.map(n=>n.label).join(',')==='课时1,课时2','chapter expands to section, then individual lessons');
ok(library.byKey['bank:l2'].entries[0].id==='l2'&&library.byKey['bank:l2'].count===5,'individual lesson selection remains exact');
ok(library.roots.find(n=>n.subject==='math').children[0].children[0].label==='第1节','duplicate chapter prefix is removed from the leaf label');
ok(S.libraryTree([{id:'old',subject:'physics',title:'2026秋高中必刷题',count:10}]).books===1,'older aggregated book banks remain usable');
const lessons=S.libraryTree([
 {id:'c2',subject:'physics',book:'解题觉醒',chapter:'第一章',topic:'第3节 磁场-课时2 有界磁场',count:4},
 {id:'s1',subject:'physics',book:'解题觉醒',chapter:'第一章',topic:'专项觉醒 1 临界问题',count:3},
 {id:'c1',subject:'physics',book:'解题觉醒',chapter:'第一章',topic:'第3节 磁场-课时1 匀强磁场',count:5}]);
ok(lessons.roots[0].children[0].children.map(n=>n.label).join(',')==='第3节 磁场,专项觉醒 1 临界问题','numbered sections precede special topics');
ok(lessons.roots[0].children[0].children[0].children.map(n=>n.label).join(',')==='课时1 匀强磁场,课时2 有界磁场','legacy hyphenated lessons expand under their section');
ok(lessons.byKey['bank:c1'].path.join(' / ')==='解题觉醒 / 第一章 / 第3节 磁场 / 课时1 匀强磁场','selected lesson has its complete directory path');
ok(S.normalizeBank(bank({units:[{questions:[{no:1,label:'例1',type:'solve',stem:'例题',answer:'见解析',solution:'详细解析'}]}]})).questions[0].label==='例1','original example labels survive normalization');
// 检查与整理
const b=S.normalizeBank(JSON.parse(text));
ok(!b.error&&b.count===4,'keeps four valid questions');
ok(b.questions.find(q=>q.no===2).answer==='BD','multi answer normalized and sorted');
ok(!b.questions.some(q=>q.no===3||q.no===6||q.no===7),'drops out-of-range answer, unknown type and empty stem');
ok(b.figures['t-q0']&&!b.figures['../evil']&&!b.figures['t-a0'],'figure ids and data URIs are whitelisted');
ok(b.macros['\\Hi']&&!b.macros.bad&&!b.macros['\\x'],'macro whitelist');
ok(S.normalizeBank({format:'x'}).error&&S.normalizeBank(null).error&&S.normalizeBank(bank({version:9})).error,'rejects foreign or newer files');
ok(!S.normalizeBank(bank({version:2})).error,'reads version 2 banks');
ok(b.questions.map(q=>q.kind).join()==='单选题,多选题,填空题,解答题'&&b.questions.every(q=>[1,2,3].includes(q.level)),'math kinds and levels');
ok(b.questions.find(q=>q.no===4).mode==='math'&&b.questions[0].mode==='choice'&&solveMode(b),'answer modes');
function solveMode(x){return x.questions.find(q=>q.no===5).mode==='self'}
ok(S.normalizeBank(bank({units:[]})).error,'rejects empty banks');
ok(S.normalizeBank(bank({subject:'???'})).subject==='other','unknown subject falls back');
// 判分
const [q1,q2]=[b.questions[0],b.questions[1]];
ok(S.gradeChoice(q1,'B').points===5&&S.gradeChoice(q1,'B').verdict==='right','single right');
ok(S.gradeChoice(q1,'A').points===0&&S.gradeChoice(q1,'').verdict==='wrong','single wrong / empty');
ok(S.gradeChoice(q2,'BD').points===6,'multi all right');
ok(S.gradeChoice(q2,'D').points===3&&S.gradeChoice(q2,'D').verdict==='partial','multi partial (2 answers → 3 each)');
ok(S.gradeChoice(q2,'ABD').points===0,'multi with wrong pick gets 0');
const q3={type:'multi',answer:'ACD'};ok(S.gradeChoice(q3,'A').points===2&&S.gradeChoice(q3,'AC').points===4&&S.gradeChoice(q3,'DCA').points===6,'multi with three answers → 2 each');
const solve=b.questions.find(q=>q.type==='solve'),blank=b.questions.find(q=>q.type==='blank');
ok(solve.points===15&&S.gradeSelf(solve,'right').points===15&&S.gradeSelf(solve,'partial').points===7.5&&S.gradeSelf(solve,'most').points===11.3&&S.gradeSelf(solve,'wrong').points===0,'solve self grading (math default 15)');
ok(S.gradeSelf(blank,'right').points===5&&S.gradeSelf(blank,'partial').points===0,'blank has no partial credit');
ok(S.gradeSelf({type:'solve',points:25},'most',true).points===20&&S.selfLevels({type:'solve',points:25},true)[0][1].includes('满分'),'writing graded by band');
const sum=S.roundSummary([{points:5,max:5,verdict:'right'},{points:3,max:6,verdict:'partial'},{points:0,max:12,verdict:'wrong'}]);
ok(sum.got===8&&sum.max===23&&sum.right===1&&sum.stars===0,'round summary');
ok(S.roundSummary([{points:5,max:5,verdict:'right'}]).stars===3,'three stars');
// 挑题
let seed=7;const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const b2=S.normalizeBank(JSON.parse(JSON.stringify(bank({id:'t2',subject:'physics'}))));
ok(S.filterPool([b,b2],{subject:'math'}).length===4&&S.filterPool([b,b2],{subject:'all'}).length===8,'subject filter');
ok(S.filterPool([b,b2],{bankId:'t2'}).every(q=>q.bankId==='t2'),'bank filter');
ok(S.filterPool([b],{types:['single','multi']}).length===2,'type filter');
const pool=S.filterPool([b,b2],{});
for(let k=0;k<50;k++){const r=S.pickRound(pool,5,rng,[pool[0].id,pool[1].id]);ok(r.length===5&&new Set(r.map(q=>q.id)).size===5,'no duplicates');ok(!r.slice(0,5).some(q=>q.id===pool[0].id||q.id===pool[1].id),'fresh questions first')}
ok(S.pickRound(pool,20,rng,[]).length===8,'round shorter than requested when pool is small');
ok(S.pickRound(pool,5,rng,[],[pool[2].id]).map(q=>q.id).join()===pool[2].id,'wrong-book mode only picks wrong questions');
// 错题本
let book=S.updateWrongBook({},q1,'wrong',1);book=S.updateWrongBook(book,q1,'partial',2);
ok(book[q1.id].n===2&&book[q1.id].at===2,'wrong book counts');
ok(!S.updateWrongBook(book,q1,'right')[q1.id],'right answer removes from wrong book');
let big={};for(let k=0;k<450;k++)big=S.updateWrongBook(big,{id:'q'+k,bank:'b',no:k},'wrong',k);
ok(Object.keys(big).length===400&&!big.q0&&big.q449,'wrong book keeps newest 400');
// 分值：原卷“每小题 x 分”“（13 分）”、物理多选“选对但不全得 3 分”
const phy=S.normalizeBank({format:'piggy-study-bank',version:1,id:'p',title:'物理卷',subject:'physics',units:[{name:'',questions:[
 {no:1,type:'single',part:'一、单项选择题（本题共6小题，每小题4分）',stem:'s',options:['a','b','c','d'],answer:'A',solution:''},
 {no:8,type:'multi',part:'二、多项选择题（每小题5分，全部选对的得5分，选对但不全的得3分，有选错的得0分）',stem:'m',options:['a','b','c','d'],answer:'ABC',solution:''},
 {no:11,type:'blank',part:'三、非选择题',stem:'用如图装置做实验，测量重力加速度',options:[],answer:'9.8',solution:''},
 {no:14,type:'solve',part:'三、非选择题',stem:'（14分）一列简谐波',options:[],answer:'见解析',solution:''}]}]});
const [p1,p8,p11,p14]=phy.questions;
ok(p1.points===4&&p8.points===5&&p14.points===14,'points from part / stem');
ok(S.gradeChoice(p8,'A').points===3&&S.gradeChoice(p8,'ABC').points===5&&S.gradeChoice(p8,'AD').points===0,'physics multi partial credit is fixed 3');
ok(p11.kind==='实验题'&&p14.kind==='计算题'&&p11.mode==='self','physics kinds; non-math blanks self-graded');
// 英语整篇：逐小题 subs
const eng=S.normalizeBank({format:'piggy-study-bank',version:2,id:'e',title:'英语卷',subject:'english',units:[{name:'',questions:[
 {no:36,type:'solve',grouped:true,sourceNos:[36,37],part:'第二部分 阅读 · 第二节（共5小题；每小题2.5分）',stem:'文章',options:[],answer:'x',solution:'',shared:['a','b','c','d','e','f','g'],
  subs:[{no:36,type:'single',shared:true,stem:'第 36 空.',options:[],answer:'B'},{no:37,type:'single',shared:true,stem:'第 37 空.',options:[],answer:'G'}]},
 {no:56,type:'solve',grouped:true,sourceNos:[56,57],part:'第三部分 语言运用 · 第二节（共10小题；每小题1.5分）',stem:'文章',options:[],answer:'x',solution:'',
  subs:[{no:56,type:'blank',stem:'第 56 空.',options:[],answer:'have advanced/have been advancing'},{no:57,type:'blank',stem:'第 57 空.',options:[],answer:'With'}]},
 {no:67,type:'solve',part:'第四部分 写作 · 第二节（满分25分）',stem:'续写',options:[],answer:'范文',solution:''}]}]});
const [e7,eg,ew]=eng.questions;
ok(e7.kind==='七选五'&&e7.points===5&&e7.subs.every(s=>s.mode==='choice'),'seven-option group');
ok(eg.kind==='语法填空'&&eg.points===3&&eg.subs.every(s=>s.mode==='text'),'grammar group typed');
ok(ew.kind==='读后续写'&&ew.points===25&&ew.mode==='self','continuation writing 25');
const gr=S.sumGroup(eg,[S.gradeSub(eg.subs[0],'Have  been advancing'),S.gradeSub(eg.subs[1],'with')]);
ok(gr.points===3&&gr.verdict==='right','grammar answers: alternatives, case and spaces ignored');
ok(S.sumGroup(e7,[S.gradeSub(e7.subs[0],'B'),S.gradeSub(e7.subs[1],'A')]).points===2.5,'group partial points');
ok(S.gradeSub(eg.subs[1],'within').verdict==='wrong','wrong word');
// 语文：断句点选、主观小题待自评
const chi=S.normalizeBank({format:'piggy-study-bank',version:2,id:'c',title:'语文卷',subject:'chinese',units:[{name:'',questions:[
 {no:10,type:'solve',grouped:true,sourceNos:[10,11],part:'二、文言文阅读',stem:'文',options:[],answer:'x',solution:'',
  subs:[{no:10,type:'pick',stem:'断句（3分）',options:[],answer:'CEG',picks:['A','B','C','D','E','F','G','H']},{no:13,type:'solve',stem:'翻译（8分）',options:[],answer:'译文'}]}]}]});
const cg=chi.questions[0];
ok(cg.kind==='文言文阅读'&&cg.points===11&&cg.subs[0].mode==='pick'&&cg.subs[1].mode==='self','classical Chinese group');
ok(S.gradeSub(cg.subs[0],'CE').points===2&&S.gradeSub(cg.subs[0],'ACEG').points===0&&S.gradeSub(cg.subs[1],'').verdict==='pending','pick scoring and pending self items');
// 数学填空输入
globalThis.PigStudyMath=require('./app/study-math.js');
const MB=globalThis.PigStudyMath.prepare('<span class="sx-m">\\frac{10}{3}</span>；<span class="sx-m">\\frac{\\sqrt{15}}{5}</span>');
const mg=S.gradeMath({type:'blank',points:5},MB,['10/3','√15/5']),mh=S.gradeMath({type:'blank',points:5},MB,['3.3','√(3/5)']);
ok(mg.verdict==='right'&&mg.points===5&&mh.verdict==='partial'&&mh.points===2.5,'math blanks graded per blank');
ok(!globalThis.PigStudyMath.prepare('见解析')&&!globalThis.PigStudyMath.prepare('（1）<span class="sx-m">2</span>（2）<span class="sx-m">3</span>'),'unreadable answers fall back to self grading');
// 数学等价判定：[参考答案 LaTeX, 输入, 应判]
const MM=globalThis.PigStudyMath,mt=s=>'<span class="sx-m">'+s+'</span>';
for(const [ref,inp,want] of [['\\frac{\\sqrt{3}}{2}','√3/2',1],['\\frac{\\sqrt{3}}{2}','sin(pi/3)',1],['\\frac{\\sqrt{3}}{2}','0.866',0],['(2,+\\infty)','x>2',1],['(2,+\\infty)','[2,+∞)',0],
 ['y=5x-2','5x-y-2=0',1],['y=5x-2','y=5x+2',0],['a_n=10^{2^n-n-1}','10^(2^n-n-1)',1],['3^{2026}-1','3^2026-1',1],['3^{2026}-1','3^2027-1',0],['-\\sqrt{\\frac{2\\sqrt3}{3}}+\\mathrm i','i-√(2√3/3)',1],
 ['\\frac1{\\mathrm e}','e^-1',1],['\\{1,2\\}','{2,1}',1],['\\log_{2}3','ln3/ln2',1],['2^{n-1}','2^n/2',1],['2^{n-1}','2^n-1',0],['(-\\infty,1]\\cup[2,+\\infty)','[2,+∞)∪(-∞,1]',1],
 ['\\dfrac{\\pi}{3}','60°',1],['2\\sqrt{2}','√8',1],['\\sqrt[3]{2}','2^(1/3)',1],['\\frac{1}{x+1}','1/x+1',0]]){
 const p=MM.prepare(mt(ref));ok(p&&MM.check(p[0],inp).ok===!!want,'math '+ref+' vs '+inp)}
{const p=MM.prepare(mt('8')+' 或 '+mt('12\\sqrt2-16'));ok(MM.check(p[0],'12√2-16或8').ok&&!MM.check(p[0],'8').ok,'either-or answers need all values')}
ok(MM.preview('√3/2').tex==='\\dfrac{\\sqrt{3}}{2}'&&MM.preview('3+').error,'input preview');
console.log('study checks passed:',checks);
