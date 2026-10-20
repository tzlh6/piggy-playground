/* 猪猪爱学习 · 数学填空判分（不碰页面，Node 里也能测）
 * 参考答案（题库里的 LaTeX）和玩家输入（键盘式写法：√3/2、2^(n-1)、(1,+∞)、ln2 或 3……）
 * 化成同一种表达式树，再代入数值比较：等价写法都算对，例如 √3/2 = sin(π/3)，y=5x-2 与 5x-y-2=0。
 */
(function(root){
'use strict';
const FUNCS=['arcsin','arccos','arctan','sqrt','root','sinh','cosh','tanh','sin','cos','tan','cot','sec','csc','exp','abs','ln','lg','log'];
const NOARG={pi:'π',infty:'∞',infin:'∞',cup:'∪',cap:'∩',le:'≤',leq:'≤',leqslant:'≤',ge:'≥',geq:'≥',geqslant:'≥',ne:'≠',neq:'≠',lt:'<',gt:'>',
 cdot:'*',times:'*',div:'/',circ:'°',lbrace:'{',rbrace:'}',vert:'|',lvert:'|',rvert:'|',e:'e',ee:'e',i:'i',
 displaystyle:'',textstyle:'',quad:' ',qquad:' ',enspace:' ',thinspace:' ',thinsp:' ',nolimits:'',limits:'',empty:'∅',varnothing:'∅',emptyset:'∅'};
const DROP=new Set(['left','right','big','Big','bigg','Bigg','bigl','bigr','Bigl','Bigr','biggl','biggr']);
const TEXTY=new Set(['mathrm','mathit','mathbf','mathsf','boldsymbol','bm','text','textrm','textnormal','mbox','operatorname','mathup','symup','symit','symbf','rm','mathnormal']);

// ---------- LaTeX → 键盘式写法 ----------
function texToPlain(s,macros){
 s=String(s||'');
 if(macros)for(const [k,v] of Object.entries(macros))if(!/#/.test(v)&&/^\\[A-Za-z]+$/.test(k))s=s.replace(new RegExp(k.replace(/\\/g,'\\\\')+'(?![A-Za-z])','g'),v);
 return conv(s);
}
function conv(s){
 let i=0,out='';
 const ws=()=>{while(i<s.length&&/\s/.test(s[i]))i++};
 function arg(){
  ws();
  if(s[i]==='{'){let d=0,j=i;for(;j<s.length;j++){if(s[j]==='\\'){j++;continue}if(s[j]==='{')d++;else if(s[j]==='}'&&!--d)break}
   if(j>=s.length)throw new Error('brace');const inner=s.slice(i+1,j);i=j+1;return conv(inner)}
  if(s[i]==='\\'){const m=/^\\([A-Za-z]+|.)/.exec(s.slice(i));i+=m[0].length;return conv(m[0])}
  if(i>=s.length)throw new Error('arg');return conv(s[i++]);
 }
 while(i<s.length){
  const c=s[i];
  if(c==='\\'){
   const m=/^\\([A-Za-z]+|.)/.exec(s.slice(i));i+=m[0].length;const n=m[1];
   if(n==='frac'||n==='dfrac'||n==='tfrac'||n==='cfrac'){const a=arg(),b=arg();out+='(('+a+')/('+b+'))'}
   else if(n==='sqrt'){ws();let k='';if(s[i]==='['){const j=s.indexOf(']',i);if(j<0)throw new Error('sqrt');k=conv(s.slice(i+1,j));i=j+1}
    const a=arg();out+=k?'root(('+k+'),('+a+'))':'sqrt('+a+')'}
   else if(DROP.has(n)){ws();if(s[i]==='.')i++}
   else if(TEXTY.has(n))out+=' '+arg()+' ';
   else if(n in NOARG)out+=NOARG[n];
   else if(FUNCS.includes(n))out+=' '+n+' ';
   else if(n===','||n===';'||n==='!'||n===':'||n===' ')out+=' ';
   else if(n==='{'||n==='}'||n==='|')out+=n;
   else if(n==='%')throw new Error('percent');
   else throw new Error('cmd '+n);
  }
  else if(c==='{'){out+='(';i++}
  else if(c==='}'){out+=')';i++}
  else if(c==='~'){out+=' ';i++}
  else if(c==='&'||c==="'")throw new Error('char');
  else{out+=c;i++}
 }
 return out;
}
const ENT={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'",'&nbsp;':' ','&thinsp;':' ','&ensp;':' ','&emsp;':' '};
const decode=s=>String(s).replace(/&[a-z]+;|&#\d+;/g,e=>ENT[e]!=null?ENT[e]:/^&#\d+;$/.test(e)?String.fromCharCode(+e.slice(2,-1)):' ');
// 题库答案（HTML：正文 + <span class="sx-m">公式</span>）→ 键盘式写法；认不出返回 null
function answerPlain(html,macros){
 try{
  let out='',last=0;const re=/<span class="sx-(?:m|dm)">([\s\S]*?)<\/span>/g;let m;
  while((m=re.exec(html))){out+=decode(html.slice(last,m.index).replace(/<[^>]+>/g,' '))+' '+texToPlain(decode(m[1]),macros)+' ';last=re.lastIndex}
  out+=decode(html.slice(last).replace(/<[^>]+>/g,' '));
  // 括注（“按原卷答案”“均可”等说明）不参与判分；句末句点去掉
  out=out.replace(/（[^（）]*[一-鿿][^（）]*）/g,' ').replace(/\([^()]*[一-鿿][^()]*\)/g,' ').replace(/[.。]\s*$/,'').trim();
  return out;
 }catch(e){return null}
}

// ---------- 词法 ----------
function tokenize(s){
 s=String(s).replace(/[−–—]/g,'-').replace(/[×·∙⋅]/g,'*').replace(/÷/g,'/').replace(/，/g,',').replace(/；/g,';').replace(/（/g,'(').replace(/）/g,')')
  .replace(/【/g,'[').replace(/】/g,']').replace(/｛/g,'{').replace(/｝/g,'}').replace(/｜/g,'|').replace(/²/g,'^2').replace(/³/g,'^3').replace(/<=/g,'≤').replace(/>=/g,'≥').replace(/!=/g,'≠')
  .replace(/\bpi\b/gi,'π').replace(/\b(?:infinity|inf)\b/gi,'∞').replace(/\bor\b/gi,'或').replace(/\s+U\s+/g,'∪').replace(/∁/g,'?');
 const t=[];let i=0;
 while(i<s.length){
  const c=s[i];
  if(/\s/.test(c)){i++;continue}
  const num=/^(?:\d+\.?\d*|\.\d+)/.exec(s.slice(i));
  if(num){t.push({t:'num',v:+num[0]});i+=num[0].length;continue}
  if(/[A-Za-z]/.test(c)){
   const run=/^[A-Za-z]+/.exec(s.slice(i))[0],end=i+run.length;let k=0,next=end;
   while(k<run.length){
    const f=FUNCS.find(f=>run.startsWith(f,k));
    if(f){t.push({t:'fn',v:f});k+=f.length;continue}
    let name=run[k];k++;
    // 下标：a_n、a_(n+1)、x_1
    if(k===run.length&&s[end]==='_'){const j=end+1;
     if(s[j]==='('){let d=0,e=j;for(;e<s.length;e++){if(s[e]==='(')d++;else if(s[e]===')'&&!--d)break}name+='_'+s.slice(j+1,e).replace(/\s+/g,'');next=e+1}
     else{const sub=/^[A-Za-z0-9]+/.exec(s.slice(j));if(sub){name+='_'+sub[0];next=j+sub[0].length}}
    }
    t.push({t:'id',v:name});
   }
   i=next;continue;
  }
  if(c==='π'||c==='∞'){t.push({t:'id',v:c});i++;continue}
  if('+-*/^()[]{},;|!=<>≤≥≠∪∩√°_∅'.includes(c)||c==='或'){t.push({t:'op',v:c});i++;continue}
  throw new Error('不认识的符号 '+c);
 }
 return t;
}

// ---------- 语法 ----------
function parse(text){
 const tk=tokenize(text);let p=0,absDepth=0;
 const peek=()=>tk[p],isOp=v=>tk[p]&&tk[p].t==='op'&&tk[p].v===v,eat=v=>{if(isOp(v)){p++;return true}return false};
 const need=v=>{if(!eat(v))throw new Error('缺少 '+v)};
 function top(){
  const blanks=[];
  do{blanks.push(alt())}while(eat(';'));
  if(p<tk.length)throw new Error('多余的内容');
  return blanks.length>1?{k:'blanks',items:blanks}:blanks[0];
 }
 function alt(){
  const items=[rel()];
  while(isOp(',')||isOp('或')){p++;items.push(rel())}
  return items.length>1?{k:'alt',items}:items[0];
 }
 function rel(){
  const parts=[setx()],ops=[];
  while(peek()&&peek().t==='op'&&'=<>≤≥≠'.includes(peek().v)){ops.push(tk[p++].v);parts.push(setx())}
  return ops.length?{k:'rel',ops,parts}:parts[0];
 }
 function setx(){
  let a=sum();
  while(isOp('∪')||isOp('∩')){const op=tk[p++].v;const b=sum();a={k:op==='∪'?'union':'inter',parts:[].concat(a.k===(op==='∪'?'union':'inter')?a.parts:[a],[b])}}
  return a;
 }
 function sum(){
  let a=term();
  while(isOp('+')||isOp('-')){const op=tk[p++].v;const b=term();a={k:op==='+'?'add':'sub',a,b}}
  return a;
 }
 function startsPrimary(){const x=peek();if(!x)return false;if(x.t!=='op')return true;return x.v==='('||x.v==='√'||(x.v==='|'&&absDepth===0)}
 function term(){
  let a=unary();
  for(;;){
   if(isOp('*')||isOp('/')){const op=tk[p++].v;const b=unary();a={k:op==='*'?'mul':'div',a,b};continue}
   if(startsPrimary()){const b=power();a={k:'mul',a,b};continue}
   return a;
  }
 }
 function unary(){if(eat('-'))return {k:'neg',a:unary()};if(eat('+'))return unary();return power()}
 function power(){const b=postfix();if(eat('^')){const e=unary();return {k:'pow',a:b,b:e}}return b}
 function postfix(){let a=primary();for(;;){if(eat('!'))a={k:'fact',a};else if(eat('°'))a={k:'mul',a,b:{k:'div',a:{k:'const',n:'pi'},b:{k:'num',v:180}}};else return a}}
 function list(close){const items=[sum()];while(eat(','))items.push(sum());const c=peek();if(!c||c.t!=='op'||!close.includes(c.v))throw new Error('括号没有配对');p++;return {items,close:c.v}}
 function primary(){
  const x=tk[p];if(!x)throw new Error('式子不完整');
  if(x.t==='num'){p++;return {k:'num',v:x.v}}
  if(x.t==='id'){p++;
   if(x.v==='π')return {k:'const',n:'pi'};if(x.v==='∞')return {k:'const',n:'inf'};if(x.v==='e')return {k:'const',n:'e'};if(x.v==='i')return {k:'const',n:'i'};
   return {k:'var',n:x.v}}
  if(x.t==='fn'){p++;let base=null,ex=null;
   if(x.v==='log'&&eat('_'))base=primary();
   if(eat('^'))ex=isOp('-')?(p++,{k:'neg',a:primary()}):primary();
   let args;
   if(isOp('(')){p++;args=list(')').items}else args=[x.v==='sqrt'?postfix():power()];
   let f=x.v;
   if(f==='root'){if(args.length!==2)throw new Error('root 需要两个数');}
   else if(f==='log'&&args.length===2){base=args[0];args=[args[1]]}
   else if(args.length!==1)throw new Error(f+' 只要一个数');
   let node={k:'fn',f,args};if(base)node.base=base;
   if(ex)node={k:'pow',a:node,b:ex};
   return node}
  if(x.t==='op'){
   if(x.v==='('){p++;const r=list(')]');if(r.items.length===1&&r.close===')')return {k:'group',a:r.items[0]};if(r.items.length===1)throw new Error('区间要两个端点');return {k:'tuple',lb:'(',rb:r.close,items:r.items}}
   if(x.v==='['){p++;const r=list(')]');if(r.items.length<2)throw new Error('区间要两个端点');return {k:'tuple',lb:'[',rb:r.close,items:r.items}}
   if(x.v==='{'){p++;const r=list('}');return {k:'set',items:r.items}}
   if(x.v==='∅'){p++;return {k:'set',items:[]}}
   if(x.v==='√'){p++;return {k:'fn',f:'sqrt',args:[postfix()]}}
   if(x.v==='|'){p++;absDepth++;const a=sum();need('|');absDepth--;return {k:'fn',f:'abs',args:[a]}}
  }
  throw new Error('这里缺一个数');
 }
 const n=top();
 return strip(n);
}
// 去掉圆括号分组节点（只在打印时用到优先级）
function strip(n){
 if(!n||typeof n!=='object')return n;
 if(n.k==='group')return strip(n.a);
 const o={...n};for(const k of ['a','b','base'])if(o[k])o[k]=strip(o[k]);
 for(const k of ['items','parts','args'])if(o[k])o[k]=o[k].map(strip);
 return o;
}

// ---------- 复数求值 ----------
const C=(re,im)=>({re,im:im||0});
const cadd=(a,b)=>C(a.re+b.re,a.im+b.im),csub=(a,b)=>C(a.re-b.re,a.im-b.im),cmul=(a,b)=>C(a.re*b.re-a.im*b.im,a.re*b.im+a.im*b.re);
const cdiv=(a,b)=>{const d=b.re*b.re+b.im*b.im;if(d===0)return C(NaN);return C((a.re*b.re+a.im*b.im)/d,(a.im*b.re-a.re*b.im)/d)};
const real=a=>Math.abs(a.im)<1e-12*Math.max(1,Math.abs(a.re));
const clog=a=>C(Math.log(Math.hypot(a.re,a.im)),Math.atan2(a.im,a.re));
const cexp=a=>{const r=Math.exp(a.re);return C(r*Math.cos(a.im),r*Math.sin(a.im))};
function cpow(a,b){
 if(real(a)&&real(b)){const x=a.re,y=b.re;if(x>=0||Number.isInteger(y))return C(Math.pow(x,y))}
 if(a.re===0&&a.im===0)return real(b)&&b.re>0?C(0):C(NaN);
 return cexp(cmul(b,clog(a)));
}
function csqrt(a){if(real(a)&&a.re>=0)return C(Math.sqrt(a.re));const m=Math.hypot(a.re,a.im);return C(Math.sqrt((m+a.re)/2),(a.im<0?-1:1)*Math.sqrt((m-a.re)/2))}
function rf(f,a){if(!real(a))return C(NaN);return C(f(a.re))}
function evaluate(n,env){
 switch(n.k){
  case 'num':return C(n.v);
  case 'const':return n.n==='pi'?C(Math.PI):n.n==='e'?C(Math.E):n.n==='i'?C(0,1):C(Infinity);
  case 'var':return n.n in env?C(env[n.n]):C(NaN);
  case 'neg':{const a=evaluate(n.a,env);return C(-a.re,-a.im)}
  case 'add':return cadd(evaluate(n.a,env),evaluate(n.b,env));
  case 'sub':return csub(evaluate(n.a,env),evaluate(n.b,env));
  case 'mul':return cmul(evaluate(n.a,env),evaluate(n.b,env));
  case 'div':return cdiv(evaluate(n.a,env),evaluate(n.b,env));
  case 'pow':return cpow(evaluate(n.a,env),evaluate(n.b,env));
  case 'fact':{const a=evaluate(n.a,env);if(!real(a)||a.re<0||!Number.isInteger(a.re)||a.re>170)return C(NaN);let r=1;for(let k=2;k<=a.re;k++)r*=k;return C(r)}
  case 'fn':{
   const a=evaluate(n.args[n.args.length-1],env);
   switch(n.f){
    case 'sqrt':return csqrt(a);
    case 'root':{const k=evaluate(n.args[0],env);if(real(k)&&real(a)&&a.re<0&&Number.isInteger(k.re)&&k.re%2===1)return C(-Math.pow(-a.re,1/k.re));return cpow(a,cdiv(C(1),k))}
    case 'abs':return C(Math.hypot(a.re,a.im));
    case 'ln':return real(a)&&a.re>0?C(Math.log(a.re)):clog(a);
    case 'lg':return real(a)&&a.re>0?C(Math.log10(a.re)):C(NaN);
    case 'log':{const b=n.base?evaluate(n.base,env):C(10);return real(a)&&a.re>0&&real(b)&&b.re>0&&b.re!==1?C(Math.log(a.re)/Math.log(b.re)):C(NaN)}
    case 'exp':return cexp(a);
    case 'sin':return rf(Math.sin,a);case 'cos':return rf(Math.cos,a);case 'tan':return rf(Math.tan,a);
    case 'cot':return rf(x=>1/Math.tan(x),a);case 'sec':return rf(x=>1/Math.cos(x),a);case 'csc':return rf(x=>1/Math.sin(x),a);
    case 'arcsin':return rf(Math.asin,a);case 'arccos':return rf(Math.acos,a);case 'arctan':return rf(Math.atan,a);
    case 'sinh':return rf(Math.sinh,a);case 'cosh':return rf(Math.cosh,a);case 'tanh':return rf(Math.tanh,a);
   }
   return C(NaN)}
 }
 return C(NaN);
}
function varsOf(n,set){
 set=set||new Set();if(!n||typeof n!=='object')return set;
 if(n.k==='var')set.add(n.n);
 for(const k of ['a','b','base'])if(n[k])varsOf(n[k],set);
 for(const k of ['items','parts','args'])if(n[k])n[k].forEach(x=>varsOf(x,set));
 return set;
}
const isExpr=n=>!['rel','alt','blanks','tuple','set','union','inter'].includes(n.k);
function close(a,b){
 if(Number.isNaN(a.re)||Number.isNaN(b.re)||Number.isNaN(a.im)||Number.isNaN(b.im))return false;
 if(!Number.isFinite(a.re)||!Number.isFinite(b.re))return a.re===b.re&&Math.abs(a.im-b.im)<1e-12;
 const s=Math.max(1,Math.abs(a.re),Math.abs(b.re),Math.abs(a.im),Math.abs(b.im));
 return Math.abs(a.re-b.re)<=1e-9*s&&Math.abs(a.im-b.im)<=1e-9*s;
}
// 固定的“随机”取值点，判分结果每次一样
const SAMPLES=[0.731,1.618,2.214,0.577,1.293,2.659,0.9187,1.871];
function envs(vars){
 const vs=[...vars];return SAMPLES.map((_,k)=>Object.fromEntries(vs.map((v,j)=>[v,SAMPLES[(k+3*j)%SAMPLES.length]+0.37*j])));
}
function key(n){return JSON.stringify(n)}
function equalExpr(a,b){
 const vars=varsOf(a,varsOf(b));
 if(!vars.size){
  const x=evaluate(a,{}),y=evaluate(b,{});
  // 太大溢出（如 3^2026）时只认同样的写法
  if(!Number.isFinite(x.re)&&!Number.isFinite(y.re)&&!(x.re===Infinity&&isInf(a))&&!(y.re===Infinity&&isInf(b)))return key(a)===key(b);
  return close(x,y);
 }
 let valid=0;
 for(const env of envs(vars)){const x=evaluate(a,env),y=evaluate(b,env);
  const fx=Number.isFinite(x.re)&&Number.isFinite(x.im),fy=Number.isFinite(y.re)&&Number.isFinite(y.im);
  if(!fx&&!fy)continue;if(fx!==fy)return false;if(!close(x,y))return false;valid++}
 return valid>=3;
}
const isInf=n=>n.k==='const'&&n.n==='inf'||n.k==='neg'&&isInf(n.a);
function proportional(f,g){
 const vars=varsOf(f,varsOf(g));let ratio=null,valid=0;
 for(const env of envs(vars)){const x=evaluate(f,env),y=evaluate(g,env);
  if(!real(x)||!real(y)||!Number.isFinite(x.re)||!Number.isFinite(y.re))continue;
  if(Math.abs(y.re)<1e-12){if(Math.abs(x.re)>1e-9)return false;continue}
  const r=x.re/y.re;if(ratio===null)ratio=r;else if(Math.abs(r-ratio)>1e-9*Math.max(1,Math.abs(ratio)))return false;valid++}
 return valid>=3&&ratio!==0||!vars.size&&valid===0&&close(evaluate(f,{}),C(0))&&close(evaluate(g,{}),C(0));
}
// 单变量不等式 → 区间：x>2 → (2,+∞)，1<x≤3 → (1,3]
function toInterval(r){
 if(r.k!=='rel'||r.ops.some(o=>!'<>≤≥'.includes(o)))return null;
 const vi=r.parts.findIndex(n=>n.k==='var');if(vi<0)return null;const v=r.parts[vi].n;
 if(r.parts.some((n,k)=>k!==vi&&varsOf(n).size))return null;
 let lo={k:'neg',a:{k:'const',n:'inf'}},hi={k:'const',n:'inf'},lc='(',rc=')';
 const flip={'<':'>','>':'<','≤':'≥','≥':'≤'};
 const apply=(op,c)=>{ // v op c
  if(op==='<'||op==='≤'){hi=c;rc=op==='<'?')':']'}else{lo=c;lc=op==='>'?'(':'['}};
 if(r.parts.length===2){if(vi===0)apply(r.ops[0],r.parts[1]);else apply(flip[r.ops[0]],r.parts[0])}
 else if(r.parts.length===3&&vi===1){apply(flip[r.ops[0]],r.parts[0]);apply(r.ops[1],r.parts[2])}
 else return null;
 return {k:'tuple',lb:lc,rb:rc,items:[lo,hi]};
}
function asList(n){return n.k==='alt'?n.items:[n]}
function matchAll(as,bs,eq){
 if(as.length!==bs.length)return false;const used=new Set();
 for(const a of as){const k=bs.findIndex((b,j)=>!used.has(j)&&eq(a,b));if(k<0)return false;used.add(k)}
 return true;
}
function equalItem(r,u){
 if(r.k==='alt'||u.k==='alt')return matchAll(asList(r),asList(u),equalItem);
 const ri=r.k==='rel'?toInterval(r):null,ui=u.k==='rel'?toInterval(u):null;
 if(ri||ui)return equalItem(ri||r,ui||u);
 const lone=n=>n.k==='rel'&&n.ops.length===1&&n.ops[0]==='='&&n.parts[0].k==='var';
 if(r.k==='rel'&&u.k==='rel'){
  if(r.ops.length===1&&u.ops.length===1&&r.ops[0]==='='&&u.ops[0]==='='){
   if(lone(r)&&lone(u)&&r.parts[0].n===u.parts[0].n)return equalExpr(r.parts[1],u.parts[1]);
   return proportional({k:'sub',a:r.parts[0],b:r.parts[1]},{k:'sub',a:u.parts[0],b:u.parts[1]});
  }
  return r.ops.length===u.ops.length&&r.ops.every((o,k)=>o===u.ops[k])&&r.parts.every((p,k)=>equalExpr(p,u.parts[k]));
 }
 if(r.k==='rel'&&isExpr(u))return lone(r)&&equalExpr(r.parts[1],u);
 if(u.k==='rel'&&isExpr(r))return lone(u)&&equalExpr(r,u.parts[1]);
 if(r.k==='tuple'&&u.k==='tuple')return r.lb===u.lb&&r.rb===u.rb&&r.items.length===u.items.length&&r.items.every((x,k)=>equalExpr(x,u.items[k]));
 if(r.k==='set'&&u.k==='set')return matchAll(r.items,u.items,equalExpr);
 if((r.k==='union'||r.k==='inter')&&r.k===u.k)return matchAll(r.parts,u.parts,equalItem);
 if(isExpr(r)&&isExpr(u))return equalExpr(r,u);
 return false;
}

// ---------- 打印成 LaTeX（输入时预览） ----------
const PREC={add:1,sub:1,neg:2,mul:3,div:3,pow:5,fact:6};
function tex(n,ctx){
 const P=n=>PREC[n.k]||9;
 const wrap=(m,min)=>P(m)<min?'\\left('+tex(m)+'\\right)':tex(m);
 switch(n.k){
  case 'num':return String(n.v);
  case 'const':return {pi:'\\pi',e:'\\mathrm{e}',i:'\\mathrm{i}',inf:'\\infty'}[n.n];
  case 'var':{const [a,s]=n.n.split('_');return s!=null?a+'_{'+s+'}':a}
  case 'neg':return '-'+wrap(n.a,3);
  case 'add':return tex(n.a)+'+'+wrap(n.b,2);
  case 'sub':return tex(n.a)+'-'+wrap(n.b,2);
  case 'mul':{const b=wrap(n.b,4),a=wrap(n.a,3);return a+(/^[\d.]/.test(b)||/^-/.test(b)?'\\cdot ':' ')+b}
  case 'div':return '\\dfrac{'+tex(n.a)+'}{'+tex(n.b)+'}';
  case 'pow':return (P(n.a)<9||n.a.k==='fn'&&n.a.f!=='sqrt'&&n.a.f!=='abs'?'\\left('+tex(n.a)+'\\right)':tex(n.a))+'^{'+tex(n.b)+'}';
  case 'fact':return wrap(n.a,9)+'!';
  case 'fn':{
   if(n.f==='sqrt')return '\\sqrt{'+tex(n.args[0])+'}';
   if(n.f==='root')return '\\sqrt['+tex(n.args[0])+']{'+tex(n.args[1])+'}';
   if(n.f==='abs')return '\\left|'+tex(n.args[0])+'\\right|';
   const name=n.f==='log'&&n.base?'\\log_{'+tex(n.base)+'}':'\\'+n.f;
   const a=n.args[0];return name+(a.k==='num'||a.k==='var'||a.k==='const'?' '+tex(a):'\\left('+tex(a)+'\\right)')}
  case 'tuple':return '\\left'+(n.lb==='('?'(':'[')+n.items.map(x=>tex(x)).join(',')+'\\right'+(n.rb===')'?')':']');
  case 'set':return n.items.length?'\\{'+n.items.map(x=>tex(x)).join(',')+'\\}':'\\varnothing';
  case 'union':return n.parts.map(x=>tex(x)).join('\\cup ');
  case 'inter':return n.parts.map(x=>tex(x)).join('\\cap ');
  case 'rel':return n.parts.map((x,k)=>(k?({'≤':'\\le ','≥':'\\ge ','≠':'\\ne '}[n.ops[k-1]]||n.ops[k-1]):'')+tex(x)).join('');
  case 'alt':return n.items.map(x=>tex(x)).join('\\ \\text{或}\\ ');
  case 'blanks':return n.items.map(x=>tex(x)).join(';\\ ');
 }
 return '';
}

// ---------- 对外 ----------
// 参考答案拆成几个空；每个空都能读懂才自动判分
function prepare(answerHtml,macros){
 const plain=answerPlain(answerHtml,macros);if(plain==null||!plain||/见|略|不存在|证明|无解/.test(plain))return null;
 // 第几空之间用分号；“（1）…（2）…”这样的分问答案不自动判
 const words=String(answerHtml).replace(/<span class="sx-(?:m|dm)">[\s\S]*?<\/span>/g,' ');
 if(/[(（]\s*[1-9]\s*[)）]/.test(words))return null;
 const parts=plain.split(/\s*[;；]\s*/).filter(Boolean);
 const blanks=[];
 for(const s of parts){try{const n=parse(s);if(n.k==='blanks')return null;blanks.push({plain:s,node:n})}catch(e){return null}}
 return blanks.length&&blanks.length<=4?blanks:null;
}
function check(blank,input){
 const s=String(input||'').trim();if(!s)return {ok:false,empty:true};
 let u;try{u=parse(s)}catch(e){return {ok:false,error:e.message}}
 if(u.k==='blanks')return {ok:false,error:'一个空只填一个答案'};
 let ok=false;try{ok=equalItem(blank.node,u)}catch(e){ok=false}
 return {ok};
}
function preview(input){
 const s=String(input||'').trim();if(!s)return {tex:''};
 try{const n=parse(s);return {tex:tex(n)}}catch(e){return {error:e.message}}
}
const api={texToPlain,answerPlain,tokenize,parse,evaluate,equalItem,tex,prepare,check,preview};
root.PigStudyMath=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
