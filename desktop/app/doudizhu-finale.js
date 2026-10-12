/* 斗地猪 · 结算大戏（4.4.1）
   一局结束、结算面板出来之前，牌桌上演一段 7～9 秒的小剧场（可点“跳过”，轻快模式更短，减少动态效果时不播）：
   - 屠夫获胜：撒网抓住邪恶猪猪 → 扔进大锅“洗白白” → 加胡萝卜洋葱辣椒、点火、盖锅盖 → 一团蒸汽后变成烤乳猪 → 两位屠夫系上围兜大快朵颐 → 只剩骨头，猪猪的小幽灵气呼呼飘走。
   - 邪恶猪猪获胜：乌云压顶，猪猪越变越大、红眼放光 → 一声大吼震飞屠夫的刀和擀面杖 → 两道闪电把屠夫劈成爆炸头焦炭 → 天上下松露雨堆成王座 → 焦黑的屠夫跪着给大王扇扇子。
   纯 SVG，时间轴由外部按帧推进（update(T)），暂停即冻结；音效通过 cues 在关键帧触发。 */
(function(root){
'use strict';
const PA=root.PigArt,A=root.PigDdzArt,NS='http://www.w3.org/2000/svg';
const W=1000,H=620,GROUND=478;
// ---- 缓动 ----
const clamp=(v,a,b)=>Math.max(a===undefined?0:a,Math.min(b===undefined?1:b,v));
const lerp=(a,b,p)=>a+(b-a)*p;
const EASE={lin:x=>x,inOut:x=>x<.5?2*x*x:1-Math.pow(-2*x+2,2)/2,out:x=>1-Math.pow(1-x,3),in:x=>x*x*x,
 back:x=>{const c1=1.70158,c3=c1+1;return 1+c3*Math.pow(x-1,3)+c1*Math.pow(x-1,2)},
 elastic:x=>x<=0?0:x>=1?1:Math.pow(2,-10*x)*Math.sin((x*10-.75)*(2*Math.PI)/3)+1};
function kf(T,f){if(T<=f[0][0])return f[0][1];for(let i=1;i<f.length;i++){const q=f[i];if(T<=q[0]){const p=f[i-1],u=(T-p[0])/((q[0]-p[0])||1);return p[1]+(q[1]-p[1])*EASE[q[2]||'inOut'](u)}}return f[f.length-1][1]}
const env=(T,a,b,r)=>{r=r||.15;if(T<a||T>b)return 0;return Math.min(1,(T-a)/r,(b-T)/r)};
const wave=(T,hz,amp)=>Math.sin(T*hz*Math.PI*2)*amp;
const prog=(T,a,b)=>clamp((T-a)/(b-a));
function prng(seed){let s=(seed*2654435761)>>>0||1;return ()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return ((s>>>0)%100000)/100000}}
// ---- SVG 小工具 ----
function el(tag,attrs,parent){const n=document.createElementNS(NS,tag);for(const k in attrs)n.setAttribute(k,attrs[k]);if(parent)parent.appendChild(n);return n}
function grp(parent,html){const n=el('g',{},parent);if(html)n.innerHTML=html;return n}
function place(n,x,y,s,r,o,sy){n.setAttribute('transform',`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(r||0).toFixed(1)}) scale(${(s===undefined?1:s).toFixed(3)} ${(sy===undefined?(s===undefined?1:s):sy).toFixed(3)})`);n.setAttribute('opacity',(o===undefined?1:clamp(o)).toFixed(2))}
const hide=n=>n.setAttribute('opacity',0);
function part(){return {x:0,y:0,r:0,sx:1,sy:1}}
const PARTS=['root','torso','head','earF','earN','tail','legA','legB','legC','legD','eyeF','eyeN','snout','prop'];
function pose(){const o={};PARTS.forEach(k=>o[k]=part());return o}
function mv(o,x,y,r,sx,sy){o.x+=x||0;o.y+=y||0;o.r+=r||0;if(sx!==undefined)o.sx*=sx;if(sy!==undefined)o.sy*=sy}

// ---- 美术 ----
const ART={
 say:(text,o)=>{o=o||{};const w=Math.max(60,text.length*22+30);return `<g><rect x="${-w/2}" y="-24" width="${w}" height="44" rx="22" fill="${o.fill||'#fffaf0'}" stroke="${o.stroke||'#5b4636'}" stroke-width="3"/><path d="M${o.tail==='r'?10:-14} 18l${o.tail==='r'?8:4} 14 8-14" fill="${o.fill||'#fffaf0'}" stroke="${o.stroke||'#5b4636'}" stroke-width="3" stroke-linejoin="round"/><path d="M${o.tail==='r'?11:-13} 17h${o.tail==='r'?14:12}" stroke="${o.fill||'#fffaf0'}" stroke-width="5"/><text y="7" text-anchor="middle" font-size="21" font-weight="900" fill="${o.ink||'#4a3426'}">${text}</text></g>`},
 title:(text,sub,c)=>`<g><text text-anchor="middle" y="0" font-size="58" font-weight="900" fill="${c||'#ffe27a'}" stroke="#3a1c08" stroke-width="10" stroke-linejoin="round" paint-order="stroke" letter-spacing="4">${text}</text>${sub?`<text text-anchor="middle" y="40" font-size="22" font-weight="800" fill="#fff6e2" stroke="#3a1c08" stroke-width="6" paint-order="stroke">${sub}</text>`:''}</g>`,
 word:(text,c,size,rot)=>`<g transform="rotate(${rot||0})"><text text-anchor="middle" y="${(size||30)*.36}" font-size="${size||30}" font-weight="900" fill="${c||'#fff4d6'}" stroke="#3a1c08" stroke-width="7" stroke-linejoin="round" paint-order="stroke">${text}</text></g>`,
 net:()=>{let l='';for(let k=-120;k<=120;k+=20)l+=`<path d="M${k} -110Q${k*.6} 0 ${k*.9} 100" /><path d="M-130 ${k*.8}Q0 ${k*.8+18} 130 ${k*.8}"/>`;return `<g><g fill="none" stroke="#c9a26b" stroke-width="3.4" opacity=".95">${l}</g><path d="M-130-96Q0-130 130-96" fill="none" stroke="#8a6232" stroke-width="7" stroke-linecap="round"/><g fill="#8a6232">${[-120,-60,0,60,120].map(x=>`<circle cx="${x}" cy="${-100-Math.abs(x)*-.1}" r="6"/>`).join('')}</g></g>`},
 potBack:()=>`<g><ellipse cx="0" cy="0" rx="178" ry="34" fill="#2b2530" stroke="#14111a" stroke-width="5"/><ellipse cx="0" cy="4" rx="160" ry="24" fill="#4d7fa2"/></g>`,
 water:()=>`<g><ellipse cx="0" cy="4" rx="160" ry="24" fill="#6fb6dc" opacity=".88"/><path d="M-120 2q30-10 60 0t60 0 60 0 60 0" fill="none" stroke="#e6f7ff" stroke-width="4" stroke-linecap="round" opacity=".8"/></g>`,
 potFront:()=>`<g><path d="M-178 0Q-182 150 0 158Q182 150 178 0Q0 40-178 0Z" fill="#3a3340" stroke="#14111a" stroke-width="5" stroke-linejoin="round"/><path d="M-150 26Q-150 120-40 140" fill="none" stroke="#6a6274" stroke-width="10" stroke-linecap="round" opacity=".6"/><path d="M-178 18q-34-6-38 18 4 22 34 16M178 18q34-6 38 18-4 22-34 16" fill="none" stroke="#14111a" stroke-width="9" stroke-linecap="round"/><path d="M-120 152l-18 30M120 152l18 30" stroke="#14111a" stroke-width="12" stroke-linecap="round"/><ellipse cx="0" cy="0" rx="178" ry="34" fill="none" stroke="#5c5466" stroke-width="7"/></g>`,
 lid:()=>`<g><path d="M-186 6Q-170-70 0-76Q170-70 186 6Q0 26-186 6Z" fill="#4a4250" stroke="#14111a" stroke-width="5" stroke-linejoin="round"/><path d="M-130-30Q-60-62 20-62" fill="none" stroke="#7a7284" stroke-width="9" stroke-linecap="round" opacity=".7"/><rect x="-24" y="-102" width="48" height="26" rx="12" fill="#c98a4a" stroke="#14111a" stroke-width="4"/></g>`,
 flame:(c1,c2)=>`<g><path d="M0 0C-26-10-30-46-6-80C-2-52 18-56 14-90C46-58 40-14 0 0Z" fill="${c1||'#ff7a2f'}"/><path d="M0-4C-12-10-14-30-2-46C0-32 12-34 10-52C26-36 22-10 0-4Z" fill="${c2||'#ffd34d'}"/></g>`,
 logs:()=>`<g><rect x="-110" y="-12" width="220" height="24" rx="12" fill="#7a4b2e" stroke="#3e2414" stroke-width="3" transform="rotate(6)"/><rect x="-110" y="-12" width="220" height="24" rx="12" fill="#8b5a36" stroke="#3e2414" stroke-width="3" transform="rotate(-6)"/></g>`,
 carrot:()=>`<g><path d="M0-22L10 18Q0 26-10 18Z" fill="#ff8a2a" stroke="#b4541a" stroke-width="2.4" stroke-linejoin="round" transform="rotate(180)"/><path d="M0 20q-8 10-4 18M0 20q8 10 4 18M0 20v18" stroke="#4caf50" stroke-width="4" stroke-linecap="round" transform="rotate(180) translate(0 -40)"/></g>`,
 onion:()=>`<g><path d="M0-24Q20-4 14 12Q0 24-14 12Q-20-4 0-24Z" fill="#f2e1f5" stroke="#9a6aa8" stroke-width="2.4"/><path d="M-6 8q6-14 0-28M6 8q-6-14 0-28" fill="none" stroke="#c9a3d6" stroke-width="2"/></g>`,
 chili:()=>`<g><path d="M-18-6Q4-14 22 10Q8 2-16 6Z" fill="#e53935" stroke="#8e1f1f" stroke-width="2.4" stroke-linejoin="round"/><path d="M-18-6q-6-4-6-10" stroke="#4caf50" stroke-width="4" stroke-linecap="round"/></g>`,
 duck:()=>`<g><ellipse cx="0" cy="6" rx="20" ry="13" fill="#ffd54d" stroke="#c29a1c" stroke-width="2.4"/><circle cx="-12" cy="-8" r="11" fill="#ffd54d" stroke="#c29a1c" stroke-width="2.4"/><path d="M-22-8l-10 3 10 3Z" fill="#ff8a2a"/><circle cx="-15" cy="-11" r="2" fill="#2a2326"/></g>`,
 brush:()=>`<g><rect x="-26" y="-8" width="52" height="16" rx="7" fill="#c98a4a" stroke="#6b4426" stroke-width="2.4"/><path d="M-22 8v8M-14 8v8M-6 8v8M2 8v8M10 8v8M18 8v8" stroke="#f3e2b3" stroke-width="3" stroke-linecap="round"/></g>`,
 bubble:(r)=>`<g><circle r="${r||10}" fill="#f2fbff" fill-opacity=".55" stroke="#a6d6ef" stroke-width="2"/><circle cx="${-(r||10)*.35}" cy="${-(r||10)*.35}" r="${(r||10)*.25}" fill="#fff"/></g>`,
 steam:()=>`<g fill="#f6f2ee" opacity=".92"><circle r="34"/><circle cx="30" cy="-12" r="26"/><circle cx="-30" cy="-8" r="24"/><circle cx="8" cy="20" r="24"/></g>`,
 cloud:(c,d)=>`<g><path d="M-170 30Q-200-14-150-34Q-140-90-80-80Q-50-130 10-104Q60-140 110-96Q170-110 180-50Q220-20 180 30Z" fill="${c||'#3b2f52'}" stroke="${d||'#1c1530'}" stroke-width="5" stroke-linejoin="round"/></g>`,
 bolt:()=>`<path d="M20-260L-34-40H8L-20 120 70-90H24L60-260Z" fill="#fff36b" stroke="#ffb800" stroke-width="6" stroke-linejoin="round"/>`,
 ring:(c,w)=>`<circle r="60" fill="none" stroke="${c||'#ff5d73'}" stroke-width="${w||8}"/>`,
 aura:()=>`<g opacity=".9">${[0,1,2,3,4,5,6,7].map(k=>`<path transform="rotate(${k*45}) translate(0 -118)" d="M0 30C-22 18-22-14 0-40C22-14 22 18 0 30Z" fill="${k%2?'#8a2be2':'#d0306a'}" opacity=".7"/>`).join('')}</g>`,
 glow:(c)=>`<circle r="12" fill="${c||'#ff2d55'}" opacity=".85"/>`,
 truffle:()=>`<g transform="translate(-18 -18) scale(1.5)">${A.truffle(24).replace(/<svg[^>]*>/,'').replace('</svg>','')}</g>`,
 pile:()=>`<g><path d="M-170 0Q-150-70-90-96Q-30-130 0-128Q40-130 90-98Q150-70 170 0Z" fill="#6b4630" stroke="#3a2416" stroke-width="5" stroke-linejoin="round"/>${[[-120,-24],[-80,-60],[-40,-88],[10,-98],[60,-80],[110,-40],[-140,-6],[140,-8],[-60,-30],[30,-46],[80,-14],[-10,-16]].map(([x,y],i)=>`<g transform="translate(${x} ${y}) rotate(${(i*47)%60-30})"><g transform="translate(-18 -18) scale(1.5)">${A.truffle(24).replace(/<svg[^>]*>/,'').replace('</svg>','')}</g></g>`).join('')}</g>`,
 leaf:()=>`<g><path d="M0 0C30-40 90-50 130-20C90 10 40 20 0 0Z" fill="#59b35f" stroke="#2f7a36" stroke-width="3" stroke-linejoin="round"/><path d="M0 0C40-14 80-20 128-20" fill="none" stroke="#2f7a36" stroke-width="2.4"/><path d="M40-10l14-14M66-14l16-14M92-18l14-10M40-10l12 10M66-14l12 12" stroke="#2f7a36" stroke-width="1.8"/></g>`,
 plate:()=>`<g><ellipse rx="190" ry="40" fill="#f6f1e6" stroke="#b9ad97" stroke-width="4"/><ellipse rx="150" ry="28" fill="#fffdf6" stroke="#d9cfba" stroke-width="2.4"/><path d="M-170 6q60 26 170 26" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".8"/></g>`,
 table:()=>`<g><rect x="-260" y="-6" width="520" height="22" rx="8" fill="#a8743f" stroke="#5a3a1e" stroke-width="4"/><path d="M-220 16v120M220 16v120" stroke="#5a3a1e" stroke-width="14" stroke-linecap="round"/><path d="M-250 0h500" stroke="#d6a56a" stroke-width="3" opacity=".7"/></g>`,
 apple:()=>`<g><circle r="13" fill="#e53935" stroke="#8e1f1f" stroke-width="2.2"/><path d="M0-12q2-8 8-10" stroke="#5a3a1e" stroke-width="2.4" fill="none"/><path d="M4-14q8-6 12 0q-6 4-12 0Z" fill="#4caf50"/><circle cx="-4" cy="-4" r="3" fill="#fff" opacity=".6"/></g>`,
 parsley:()=>`<g fill="#43a047"><circle r="9"/><circle cx="9" cy="-4" r="7"/><circle cx="-8" cy="-5" r="7"/><circle cx="2" cy="-11" r="6"/></g>`,
 bone:()=>`<g><rect x="-30" y="-6" width="60" height="12" rx="6" fill="#fffaf0" stroke="#c9bda3" stroke-width="2"/>${[[-30,-6],[-30,6],[30,-6],[30,6]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="8" fill="#fffaf0" stroke="#c9bda3" stroke-width="2"/>`).join('')}<rect x="-28" y="-5" width="56" height="10" fill="#fffaf0"/></g>`,
 horn:()=>`<path d="M0 0C-8-10-10-22-4-34C0-22 6-14 12-6Z" fill="#3d2147" stroke="#1f0f26" stroke-width="2"/>`,
 bib:()=>`<g><path d="M-30-8Q0 6 30-8L26 34Q0 44-26 34Z" fill="#fff" stroke="#d6cdc0" stroke-width="2.4"/><path d="M-30-8Q0-20 30-8" fill="none" stroke="#e46a6a" stroke-width="4"/><g fill="#f29ab0"><circle cx="-10" cy="14" r="3.4"/><circle cx="10" cy="20" r="3.4"/><circle cx="0" cy="30" r="3"/></g></g>`,
 fork:()=>`<g><rect x="-3" y="-6" width="6" height="40" rx="3" fill="#c9d3da" stroke="#7d8d98" stroke-width="1.6"/><path d="M-9-6v-18M-3-6v-20M3-6v-20M9-6v-18M-9-6h18" stroke="#c9d3da" stroke-width="3.4" stroke-linecap="round"/></g>`,
 halo:()=>`<ellipse rx="34" ry="9" fill="none" stroke="#ffe27a" stroke-width="6"/>`,
 wing:()=>`<path d="M0 0C20-30 54-34 70-18C56-14 60-2 44 0C52 8 40 16 26 10C24 18 10 16 0 0Z" fill="#fff" stroke="#cfd8e3" stroke-width="2.4"/>`,
 dust:()=>`<g fill="#e9dcc6" opacity=".85"><circle r="14"/><circle cx="12" cy="-6" r="10"/><circle cx="-12" cy="-4" r="9"/></g>`,
 smoke:()=>`<g fill="#6a6470" opacity=".85"><circle r="14"/><circle cx="12" cy="-8" r="11"/><circle cx="-11" cy="-6" r="10"/></g>`,
 sparkle:(c)=>`<path d="M0-14L3-3 14 0 3 3 0 14-3 3-14 0-3-3Z" fill="${c||'#fff6c8'}"/>`,
 crumb:(c)=>`<circle r="5" fill="${c||'#c9772e'}" stroke="#7a3a12" stroke-width="1.2"/>`,
 heart:()=>`<path d="M0 12C-20 0-22-14-12-19q7-4 12 5 5-9 12-5c10 5 8 19-12 31Z" fill="#ff6f91" stroke="#c23d63" stroke-width="2.4"/>`
};
// 烤乳猪配色
const ROAST={name:'烤乳猪',body:'#d9893e',shade:'#a8571f',belly:'#f2b768',ear:'#7a3a12',snout:'#e09a52',leg2:'#b5682a',blush:'#e8833f',line:'#6a2e0c',bg:'#fff',tail:'#b0602a'};
const GHOST={name:'小幽灵',body:'#f3eefc',shade:'#d7cdee',belly:'#ffffff',ear:'#a99ad0',snout:'#e9def8',leg2:'#ddd3f2',blush:'#e8d6f6',line:'#9a8ac0',bg:'#fff',tail:'#cfc3ea'};

// ---- 角色 ----
let uidN=0;
function pigActor(parent,pal,role,expr){
 const uid='fn'+(++uidN),n=grp(parent,PA.defs(pal,uid)+PA.markup({palette:pal,role,uid,expr:expr||'normal'}));
 const rig=new PA.Rig(n.querySelector('.pig-rig'));
 return {n,rig,pal,uid,role,
  setRole(r){if(this.role===r)return;this.role=r;rig.costume(r,pal,uid)},
  draw(x,y,s,flip,r,o,P){n.setAttribute('transform',`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(r||0).toFixed(2)}) scale(${(s*(flip||1)).toFixed(3)} ${s.toFixed(3)}) translate(-78 -137)`);n.setAttribute('opacity',(o===undefined?1:clamp(o)).toFixed(2));
   if(P){PARTS.forEach(k=>rig.set(k,P[k]));rig.face(P.expr||'normal',pal)}}};
}
// 屠夫：A.butcher 的嵌套 SVG；脚底中点为锚点；arm=拿家伙的手、armR=另一只手、head=头
const BPIV={arm:[50,98],armR:[112,98],head:[80,92],body:[80,164]};
function butcherActor(parent,kind){
 const n=grp(parent),a={n,kind,key:'',parts:{}};
 a.look=o=>{const key=JSON.stringify(o);if(a.key===key)return;a.key=key;n.innerHTML=A.butcher(Object.assign({kind},o));const sv=n.firstChild;
  sv.setAttribute('x',-80);sv.setAttribute('y',-164);sv.setAttribute('width',160);sv.setAttribute('height',170);sv.setAttribute('overflow','visible');sv.removeAttribute('class');
  ['body','arm','armR','head'].forEach(k=>a.parts[k]=sv.querySelector(`[data-part="${k}"]`))};
 a.set=(k,t)=>{const p=a.parts[k];if(!p)return;const pv=BPIV[k];p.setAttribute('transform',`translate(${(pv[0]+(t.x||0)).toFixed(1)} ${(pv[1]+(t.y||0)).toFixed(1)}) rotate(${(t.r||0).toFixed(1)}) scale(${(t.sx||1).toFixed(3)} ${(t.sy||1).toFixed(3)}) translate(${-pv[0]} ${-pv[1]})`)};
 a.draw=(x,y,s,flip,r,o)=>{n.setAttribute('transform',`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(r||0).toFixed(1)}) scale(${(s*(flip||1)).toFixed(3)} ${s.toFixed(3)})`);n.setAttribute('opacity',(o===undefined?1:clamp(o)).toFixed(2))};
 // 屠夫局部点 → 舞台坐标（只考虑整体与手臂旋转，够放手里的东西用）
 a.hand=(x,y,s,flip,which,armR)=>{const pv=BPIV[which],tip=which==='arm'?[33,74]:[118,127],r=armR*Math.PI/180,dx=tip[0]-pv[0],dy=tip[1]-pv[1];const lx=pv[0]+dx*Math.cos(r)-dy*Math.sin(r),ly=pv[1]+dx*Math.sin(r)+dy*Math.cos(r);return {x:x+(lx-80)*s*(flip||1),y:y+(ly-164)*s}};
 return a;
}
// ---- 粒子（位置由时间公式算出，可拖动时间轴）----
function Particles(parent){const list=[];return {
 add(markup,n,o,seed){const r=prng(seed||list.length+3);for(let i=0;i<n;i++){const nd=grp(parent,typeof markup==='function'?markup(i,r):markup);const ang=o.ang?lerp(o.ang[0],o.ang[1],r()):r()*Math.PI*2,sp=lerp((o.speed||[80,200])[0],(o.speed||[80,200])[1],r());
  list.push({nd,at:o.at+(o.stagger||0)*i,x:o.x+(o.jx||0)*(r()-.5)*2,y:o.y+(o.jy||0)*(r()-.5)*2,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp,g:o.g===undefined?600:o.g,life:lerp((o.life||[.6,1])[0],(o.life||[.6,1])[1],r()),spin:lerp(-360,360,r()),sc:lerp((o.scale||[.8,1.2])[0],(o.scale||[.8,1.2])[1],r()),drag:o.drag||0,ground:o.ground})}},
 draw(T){for(const p of list){const u=T-p.at;if(u<0||u>p.life){hide(p.nd);continue}const q=u/p.life,k=p.drag?Math.exp(-p.drag*u):1;let x=p.x+(p.drag?p.vx*(1-k)/p.drag:p.vx*u),y=p.y+(p.drag?p.vy*(1-k)/p.drag:p.vy*u)+.5*p.g*u*u;if(p.ground!==undefined&&y>p.ground)y=p.ground;
  place(p.nd,x,y,p.sc*(1-q*.4),p.spin*u,q<.7?1:1-(q-.7)/.3)}}}}
function popAt(n,T,at,x,y,life,rise,s){const u=T-at;if(u<0||u>life){hide(n);return}const q=u/life;place(n,x,y-(rise||0)*EASE.out(q),(s||1)*EASE.back(clamp(u/.22)),0,q<.8?1:1-(q-.8)/.2)}

// ================= 屠夫获胜：宰猪吃肉 =================
function butcherScene(svg,hud,o){
 const D=9.2,L=380,R=640,MID=510;
 const back=el('rect',{x:-20,y:-20,width:W+40,height:H+40,fill:'#1d2a22'},svg);
 const glow=el('ellipse',{cx:MID,cy:GROUND-20,rx:420,ry:150,fill:'#ffd28a',opacity:0},svg);
 const floor=el('ellipse',{cx:MID,cy:GROUND+12,rx:440,ry:44,fill:'#00000055'},svg);
 const L0=grp(svg),potB=grp(L0,ART.potBack()),pigL=grp(L0),water=grp(L0,ART.water()),bubL=grp(L0),potF=grp(L0,ART.potFront()),logs=grp(L0,ART.logs()),flames=[0,1,2,3,4].map(k=>grp(L0,ART.flame(k%2?'#ff5a1f':'#ff7a2f',k%2?'#ffb84d':'#ffd34d'))),lid=grp(L0,ART.lid());
 const duck=grp(L0,ART.duck()),brush=grp(L0,ART.brush());
 const table=grp(svg,ART.table()),plate=grp(svg,ART.plate());
 const roastL=grp(svg),roastMask=el('mask',{id:'fn-bite'+(++uidN)},svg);roastMask.innerHTML='<rect x="-100" y="-100" width="1200" height="900" fill="#fff"/>';const bites=[];
 const roast=pigActor(roastL,ROAST,'pig','sleep');roastL.setAttribute('mask',`url(#${roastMask.id})`);
 const horns=[grp(roastL,ART.horn()),grp(roastL,ART.horn())],apple=grp(roastL,ART.apple()),parsley=[grp(svg,ART.parsley()),grp(svg,ART.parsley())];
 const bones=[grp(svg,ART.bone()),grp(svg,ART.bone()),grp(svg,ART.bone())],bHorns=[grp(svg,ART.horn()),grp(svg,ART.horn())];
 const pig=pigActor(svg,A.EVIL,'devil','shock');
 const net=grp(svg,ART.net());
 const ghostL=grp(svg),ghost=pigActor(ghostL,GHOST,'devil','angry'),halo=grp(ghostL,ART.halo()),wings=[grp(ghostL,ART.wing()),grp(ghostL,ART.wing())];
 const bL=butcherActor(svg,'cleaver'),bR=butcherActor(svg,'pin');
 const bibs=[grp(svg,ART.bib()),grp(svg,ART.bib())],forks=[grp(svg,ART.fork()),grp(svg,ART.fork())];
 const veg=[ART.carrot(),ART.onion(),ART.chili()].map(m=>grp(svg,m));
 const steamBig=[0,1,2,3,4,5,6].map(()=>grp(svg,ART.steam()));
 const fx=grp(svg),P=Particles(fx);
 const bubbles=[0,1,2,3,4,5,6,7,8].map(k=>grp(bubL,ART.bubble(8+k%3*4)));
 const say={help:grp(svg,ART.say('救命啊！')),comfy:grp(svg,ART.say('舒服～',{fill:'#eaf8ff',stroke:'#4b8db3'})),hot:grp(svg,ART.say('水怎么越来越烫？！',{fill:'#ffe9e0',stroke:'#c0392b',ink:'#8e1f1f'})),
  gulu:grp(svg,ART.word('咕嘟咕嘟','#fff',28,-6)),ding:grp(svg,ART.word('叮！','#ffe27a',44,-8)),yum:grp(svg,ART.word('香喷喷的烤乳猪！','#ffd28a',34,0)),
  bj1:grp(svg,ART.word('吧唧','#fff',26,-10)),bj2:grp(svg,ART.word('吧唧','#fff',26,10)),burp:grp(svg,ART.say('嗝～')),ghost:grp(svg,ART.say('哼！下辈子还当邪恶猪猪！',{fill:'#f3eefc',stroke:'#7d6aa8',ink:'#4a3a6e'}))};
 const title=grp(hud,ART.title('屠夫胜利！','邪恶猪猪被做成了烤乳猪'));
 // 动作时间点
 const tNet=.62,tNetLand=1.12,tPot=1.62,tPotLand=1.92,tIn=2.42,tVeg=[3.45,3.68,3.9],tFire=3.5,tLid=4.45,tCloud=5.1,tSwap=5.42,tEat=[6.0,6.3,6.6,6.9,7.2],tBones=7.42,tGhost=7.6;
 const chomp=k=>{const at=tEat[k];return at};
 const cues=[[.05,'whoosh'],[.35,'oink'],[tNet,'throw'],[tNetLand,'net'],[tNetLand+.1,'squeal'],[tPotLand,'thud'],[tIn,'splash'],[2.6,'bubble'],[2.95,'scrub'],[tFire,'fire'],...tVeg.map(t=>[t+.32,'plop']),[3.95,'yelp'],[tLid,'clang'],[4.65,'boil'],[4.85,'clang2'],[tCloud,'ding'],[tCloud+.1,'poof'],[5.75,'sparkle'],...tEat.map((t,k)=>[t,'chomp'+k]),[tBones,'bones'],[7.55,'burp'],[tGhost+.2,'ghost'],[8.4,'tada']];
 // 咬掉的缺口（遮罩里的黑圆）
 const biteSpots=[[MID-112,GROUND-118,30],[MID+118,GROUND-138,32],[MID-30,GROUND-212,32],[MID+50,GROUND-206,30],[MID+20,GROUND-100,30]];
 biteSpots.forEach(()=>{const g=el('g',{},roastMask);bites.push(g);g.innerHTML='<circle r="1" fill="#000"/><circle cx="-.8" cy=".55" r=".55" fill="#000"/><circle cx=".8" cy=".55" r=".55" fill="#000"/><circle cx="0" cy="-.9" r=".5" fill="#000"/>'});
 const spawned={};
 function update(T){
  const ph=T<tSwap?'cook':'eat';
  back.setAttribute('opacity',(.94*prog(T,0,.4)).toFixed(2));floor.setAttribute('opacity',prog(T,0,.4).toFixed(2));glow.setAttribute('opacity',(T>tFire&&T<tCloud?.18+.1*Math.sin(T*20):.1).toFixed(2));
  // ---------- 屠夫 ----------
  const walk=prog(T,.0,.55),hopL=Math.abs(Math.sin(T*Math.PI*5))*(walk<1?1:0);
  let lx=lerp(-140,L-40,EASE.out(walk)),rx=lerp(1140,R+150,EASE.out(walk)),ly=GROUND,ry=GROUND,lr=0,rr=0,lExpr='angry',rExpr='angry',armL=-20,armLR=0,armR_=-20,armRR=0,bodyL=1,bodyR=1,lBib=0;
  ly-=hopL*12;ry-=hopL*12;
  if(T>tNet-.3&&T<tNet+.2){armL=kf(T,[[tNet-.3,-20],[tNet-.05,-150,'out'],[tNet+.1,40,'in'],[tNet+.2,10]])}
  if(T>tNetLand&&T<tPot){lExpr='happy';rExpr='happy'}
  if(T>=tPotLand&&T<tIn+.1){const lift=env(T,tPotLand+.05,tIn+.1,.15);lx=lerp(L-40,MID-150,lift);rx=lerp(R+150,MID+150,lift);armL=-130*lift;armR_=-130*lift;armLR=-120*lift;armRR=-120*lift;lExpr=rExpr='normal'}
  if(T>=tIn+.1&&T<tFire){rx=MID+190;rExpr='happy';armRR=-60+wave(T,3,40);lx=L-80;lExpr='happy'}
  if(T>=tFire-.2&&T<tLid+.4){lx=L-90;rx=MID+230;lExpr='happy';rExpr='happy';const vk=tVeg.findIndex(t=>T>t-.18&&T<t+.12);if(vk>=0)armL=kf(T,[[tVeg[vk]-.18,-30],[tVeg[vk]-.04,-140,'out'],[tVeg[vk]+.12,0,'in']])}
  if(T>=tLid-.1&&T<tCloud){rExpr='happy';lExpr='happy';rr=wave(T,2,3)}
  if(ph==='eat'){lx=MID-250;rx=MID+250;lExpr=rExpr='happy';lBib=1;
   tEat.forEach((at,k)=>{const c=env(T,at-.12,at+.18,.08),left=k%2===0;if(left){lr=lr+18*c;lx+=40*c;lExpr=c>.2?'happy':'normal'}else{rr-=18*c;rx-=40*c}});
   if(T>tBones){const pat=Math.abs(Math.sin((T-tBones)*Math.PI*3));bodyL=bodyR=1+.08*prog(T,tBones,tBones+.3);armLR=-40+20*pat;armRR=-40+20*pat;lr=-6;rr=6}}
  bL.look({expr:lExpr,noWeapon:ph==='eat'?false:false});bR.look({expr:rExpr});
  bL.draw(lx,ly,1.25,-1,lr,1);bR.draw(rx,ry,1.25,1,rr,1);
  bL.set('arm',{r:armL});bL.set('armR',{r:armLR});bL.set('body',{sx:bodyL,sy:1/bodyL*1.0});bR.set('arm',{r:armR_});bR.set('armR',{r:armRR});bR.set('body',{sx:bodyR,sy:1});
  bL.set('head',{r:ph==='eat'?wave(T,2,3):0});bR.set('head',{r:ph==='eat'?-wave(T,2,3):0});
  bibs.forEach((n,k)=>{const x=k?rx:lx;place(n,x,GROUND-122,1.25,k?rr*.5:lr*.5,ph==='eat'?prog(T,tSwap,tSwap+.2):0)});
  forks.forEach((n,k)=>{const h=k?bR.hand(rx,ry,1.25,1,'armR',armRR):bL.hand(lx,ly,1.25,-1,'armR',armLR);place(n,h.x,h.y-16,1.25,k?20:-20,ph==='eat'&&T<tBones+.3?1:0)});
  // ---------- 邪恶猪猪（做菜之前）----------
  if(ph==='cook'){
   const P=pose();let px=MID,py=GROUND,ps=1.55,pr=0,po=1;P.expr='shock';
   if(T<tNetLand){mv(P.root,wave(T,9,2),0,0);mv(P.legA,0,0,wave(T,5,18));mv(P.legB,0,0,-wave(T,5,18));P.expr=T<.4?'shock':'cry'}
   else if(T<tPotLand+.05){const st=env(T,tNetLand,tPotLand+.05,.1);mv(P.root,wave(T,14,4*st),-Math.abs(wave(T,7,6))*st,wave(T,7,6)*st);mv(P.legA,0,0,wave(T,8,30));mv(P.legB,0,0,-wave(T,8,30));P.expr='cry'}
   else if(T<tIn){const p=prog(T,tPotLand+.05,tIn);px=MID;py=lerp(GROUND,GROUND-170,EASE.out(Math.min(1,p*1.6)))+(p>.6?EASE.in((p-.6)/.4)*110:0);P.expr='cry';mv(P.legA,0,0,wave(T,8,30));mv(P.legB,0,0,-wave(T,8,30))}
   else{const sink=prog(T,tIn,tIn+.25);py=GROUND-60+20*(1-EASE.back(sink));P.expr=T<2.6?'shock':T<3.85?'happy':'shock';
    if(T>=3.85){mv(P.root,wave(T,12,3),0,0);P.expr=T<4.2?'shock':'cry'}
    if(T>=tLid)po=1-prog(T,tLid,tLid+.05)}
   if(T>=tIn)pig.setRole('bath');
   pig.draw(px,py,ps,1,pr,po,P);
   // 网：飞出 → 罩住 → 被抬进锅时消失
   if(T<tNet)hide(net);else if(T<tNetLand){const p=prog(T,tNet,tNetLand),h=bL.hand(L-40,GROUND,1.25,-1,'arm',armL);place(net,lerp(h.x,MID,p),lerp(h.y,GROUND-110,p)-Math.sin(p*Math.PI)*150,lerp(.3,1.15,EASE.out(p)),(1-p)*-90,1)}
   else if(T<tIn){const sq=env(T,tNetLand,tNetLand+.18,.06);place(net,px+wave(T,14,3),py-110,1.15+.06*sq,0,1,1.15-.1*sq)}else place(net,px,py-110,1.15,0,1-prog(T,tIn,tIn+.15));
  }else{pig.draw(MID,GROUND,1.55,1,0,0,pose())}
  // ---------- 大锅 ----------
  const potY=GROUND-70,drop=prog(T,tPot,tPotLand),potIn=T<tPot?0:1,potYY=T<tPotLand?lerp(-160,potY,EASE.in(drop)):potY+kf(T,[[tPotLand,0],[tPotLand+.08,8,'out'],[tPotLand+.3,0,'elastic']]),potOn=ph==='cook'&&T>=tPot;
  const shake=T>=tLid&&T<tCloud?wave(T,10,3):0;
  [potB,potF].forEach(n=>place(n,MID+shake,potYY,1,0,potOn?1:0));place(water,MID+shake,potYY-4+(T>tFire?wave(T,6,2):0),1,0,potOn&&T>=tIn-.05?1:0);
  bubbles.forEach((n,k)=>{const r=prng(k+11),bx=MID-130+r()*260,cyc=(T*(.6+r()*.6)+r())%1;place(n,bx+shake,potYY-6-cyc*(T>tFire?70:40),.6+cyc*.8,0,potOn&&T>=2.5&&T<tLid?(1-cyc):0)});
  place(logs,MID,GROUND+86,1,0,potOn&&T>tFire-.3?1:0);
  flames.forEach((n,k)=>{const g=prog(T,tFire+k*.04,tFire+.5);place(n,MID-120+k*60,GROUND+86,(.4+.9*g)*(1+.12*Math.sin(T*18+k*2)),wave(T,3+k*.3,6),potOn&&T>tFire?g:0,(.5+1.0*g)*(1+.16*Math.sin(T*15+k)))});
  const lidDrop=prog(T,tLid-.2,tLid),jumps=T>=tLid?[4.62,4.82,5.0].reduce((a,t)=>a+Math.max(0,Math.sin(clamp((T-t)/.14)*Math.PI))*(T>t&&T<t+.14?1:0),0):0;
  place(lid,MID+shake,(T<tLid?lerp(-140,potY-14,EASE.in(lidDrop)):potY-14)-jumps*26,1,jumps?wave(T,9,6):0,potOn&&T>=tLid-.2?1:0);
  place(duck,MID+90+shake,potYY-14+wave(T,1.5,4),1,wave(T,1,8),potOn&&T>2.55&&T<tLid?prog(T,2.55,2.75):0);
  {const h=bR.hand(rx,ry,1.25,1,'armR',armRR);place(brush,h.x,h.y,1.1,armRR*.4,potOn&&T>tIn+.15&&T<tFire-.1?1:0)}
  veg.forEach((n,k)=>{const t0=tVeg[k],p=prog(T,t0,t0+.34),h={x:L-20,y:GROUND-170};place(n,lerp(h.x,MID-40+k*40,p),lerp(h.y,potY-10,p)-Math.sin(p*Math.PI)*180,1.3,p*720,T>t0&&p<1?1:0)});
  // ---------- 蒸汽大变身 ----------
  steamBig.forEach((n,k)=>{const r=prng(k+40),a=r()*Math.PI*2,d=prog(T,tCloud,tCloud+.35),fade=1-prog(T,tSwap+.05,tSwap+.55);place(n,MID+Math.cos(a)*120*d*(.6+r()*.6),GROUND-120+Math.sin(a)*70*d,(.6+1.9*EASE.out(d))*(1+.05*Math.sin(T*6+k)),0,T>tCloud?fade:0)});
  // ---------- 吃 ----------
  const eatOn=ph==='eat',tblY=GROUND-44;
  place(table,MID,tblY,1,0,eatOn?1:0);place(plate,MID,tblY-14,1,0,eatOn?1:0);
  parsley.forEach((n,k)=>place(n,MID+(k?150:-150),tblY-22,1.2,0,eatOn&&T<tBones+.2?1:0));
  {const P=pose();P.expr='sleep';const lie=1;['legA','legB','legC','legD'].forEach(k=>{P[k].sy=.35;P[k].y-=2});mv(P.root,0,4);
   roastL.setAttribute('opacity',(eatOn?1-prog(T,tBones-.12,tBones+.1):0).toFixed(2));roast.draw(MID,tblY-12,1.6,1,0,1,P);
   const hp=(lx,ly)=>({x:MID+(lx-78)*1.6,y:tblY-12+(ly-137)*1.6});const h0=hp(26,50),h1=hp(57,44);place(horns[0],h0.x,h0.y,1.5,-22,1);place(horns[1],h1.x,h1.y,1.5,6,1);place(apple,MID+(34-78)*1.6,tblY-12+(98-137)*1.6,1.5,0,1)}
  bites.forEach((c,k)=>{const at=tEat[k],[x,y,r]=biteSpots[k];const sc=T>at?r*EASE.back(prog(T,at,at+.12)):.001;c.setAttribute('transform',`translate(${x} ${y}) scale(${sc.toFixed(2)})`)});
  bones.forEach((n,k)=>place(n,MID-80+k*70,tblY-36-(k===1?14:0),1.3,[-20,10,30][k],eatOn&&T>tBones?prog(T,tBones,tBones+.2):0));
  bHorns.forEach((n,k)=>place(n,MID-40+k*90,tblY-44,1.5,k?20:-30,eatOn&&T>tBones?prog(T,tBones,tBones+.2):0));
  // ---------- 小幽灵 ----------
  {const g=prog(T,tGhost,D),P=pose();P.expr=T<tGhost+.5?'shock':'angry';mv(P.tail,0,0,wave(T,2,20));mv(P.legA,0,0,wave(T,2,14));mv(P.legB,0,0,-wave(T,2,14));
   const gx=MID+wave(T,.8,26),gy=tblY-60-g*230;ghost.draw(gx,gy,1.0,1,wave(T,.7,6),T>tGhost?Math.min(.85,prog(T,tGhost,tGhost+.3)):0,P);
   place(halo,gx-34,gy-160*1.0+30,1,0,T>tGhost?.95:0);place(wings[0],gx+20,gy-90,.9,-20+wave(T,3,14),T>tGhost?.9:0);place(wings[1],gx-70,gy-90,-.9,20-wave(T,3,14),T>tGhost?.9:0,.9)}
  // ---------- 对白与字 ----------
  popAt(say.help,T,tNetLand+.05,MID-160,GROUND-280,1.0,10);popAt(say.comfy,T,2.62,MID-130,GROUND-250,.9,10);popAt(say.hot,T,3.95,MID-60,GROUND-260,1.0,8);
  popAt(say.gulu,T,4.6,MID+170,potY-90,.9,30);popAt(say.ding,T,tCloud,MID+120,GROUND-300,.7,20);popAt(say.yum,T,5.65,MID,GROUND-330,1.2,14);
  popAt(say.bj1,T,tEat[0],MID-200,GROUND-250,.6,30);popAt(say.bj2,T,tEat[1],MID+200,GROUND-250,.6,30);if(T>tEat[2]&&T<tEat[4]+.6){popAt(say.bj1,T,tEat[2],MID-200,GROUND-250,.6,30);if(T>tEat[3])popAt(say.bj2,T,tEat[3],MID+200,GROUND-250,.6,30)}
  popAt(say.burp,T,7.55,MID-250,GROUND-290,.9,10);popAt(say.ghost,T,tGhost+.2,MID+170,GROUND-250,1.1,10);
  place(title,500,92,EASE.back(prog(T,8.4,8.7))*(1+.02*Math.sin(T*6)),0,T>8.4?1:0);
  // ---------- 粒子 ----------
  if(T>=tPotLand&&!spawned.dust){spawned.dust=1;P.add(ART.dust(),8,{at:tPotLand,x:MID,y:GROUND+20,ang:[Math.PI,Math.PI*2],speed:[80,200],g:-40,life:[.5,.8],drag:3,jx:120})}
  if(T>=tIn&&!spawned.splash){spawned.splash=1;P.add('<circle r="7" fill="#9fd8f5" stroke="#4b8db3" stroke-width="1.4"/>',12,{at:tIn,x:MID,y:potY-10,ang:[-Math.PI*.95,-Math.PI*.05],speed:[200,380],g:900,life:[.5,.8],jx:80})}
  tVeg.forEach((t0,k)=>{if(T>=t0+.32&&!spawned['v'+k]){spawned['v'+k]=1;P.add('<circle r="6" fill="#9fd8f5"/>',6,{at:t0+.32,x:MID-40+k*40,y:potY-10,ang:[-Math.PI*.9,-Math.PI*.1],speed:[140,260],g:900,life:[.4,.6]},k+5)}});
  if(T>=tLid&&!spawned.lid){spawned.lid=1;[4.62,4.82,5.0].forEach((t0,k)=>P.add(ART.steam(),3,{at:t0,x:MID+(k-1)*120,y:potY-30,ang:[-Math.PI*.8,-Math.PI*.2],speed:[60,140],g:-80,life:[.5,.8],scale:[.3,.6],drag:2},k+20))}
  if(T>=5.7&&!spawned.sp){spawned.sp=1;P.add(t=>ART.sparkle(),10,{at:5.7,x:MID,y:tblY-90,speed:[120,240],g:100,life:[.5,.9],jx:100},31)}
  tEat.forEach((t0,k)=>{if(T>=t0&&!spawned['e'+k]){spawned['e'+k]=1;const [x,y]=biteSpots[k];P.add(ART.crumb(),6,{at:t0,x,y,ang:[-Math.PI,0],speed:[120,240],g:900,life:[.4,.7]},k+50);P.add(ART.heart(),1,{at:t0+.05,x:k%2?MID+230:MID-230,y:GROUND-230,ang:[-Math.PI*.6,-Math.PI*.4],speed:[60,90],g:-20,life:[.8,1],scale:[.7,.9]},k+60)}});
  if(T>=8.4&&!spawned.conf){spawned.conf=1;P.add((i)=>`<rect x="-6" y="-3" width="12" height="6" rx="2" fill="${['#ffd34d','#ff6fa3','#6fd0ff','#9ff07a','#ffffff'][i%5]}"/>`,26,{at:8.4,x:MID,y:60,ang:[Math.PI*.15,Math.PI*.85],speed:[60,260],g:260,life:[1,1.6],jx:300},70)}
  P.draw(T);
  return {shake:(T>=tPotLand&&T<tPotLand+.25?6*(1-prog(T,tPotLand,tPotLand+.25)):0)+(T>=tLid&&T<tCloud?2.5:0)};
 }
 return {dur:D,update,cues};
}

// ================= 邪恶猪猪获胜：大发神威 =================
function evilScene(svg,hud,o){
 const D=7.8,MID=500,L=230,R=770;
 const sky=el('rect',{x:-20,y:-20,width:W+40,height:H+40,fill:'#140a22'},svg);
 const flash=el('rect',{x:-20,y:-20,width:W+40,height:H+40,fill:'#f4ecff',opacity:0},svg);
 const rays=grp(svg,`<path d="${(()=>{let d='';for(let i=0;i<14;i++){const a=i/14*Math.PI*2,b=a+.12;d+=`M0 0L${(Math.cos(a)*600).toFixed(0)} ${(Math.sin(a)*600).toFixed(0)}L${(Math.cos(b)*600).toFixed(0)} ${(Math.sin(b)*600).toFixed(0)}Z`}return d})()}" fill="#ffcf5a" opacity=".16"/>`);
 const floor=el('ellipse',{cx:MID,cy:GROUND+12,rx:460,ry:46,fill:'#00000066'},svg);
 const clouds=[0,1,2].map(k=>grp(svg,ART.cloud(k%2?'#2c2340':'#3b2f52')));
 const pile=grp(svg,ART.pile());
 const aura=grp(svg,ART.aura());
 const pig=pigActor(svg,A.EVIL,'devil','sly');
 const eyes=[grp(svg,ART.glow()),grp(svg,ART.glow())];
 const rings=[0,1,2].map(()=>grp(svg,ART.ring('#ff4d6d',10)));
 const bL=butcherActor(svg,'cleaver'),bR=butcherActor(svg,'pin');
 const wpn=[grp(svg,`<g transform="translate(-31 -60)">${A.weaponArt('cleaver')}</g>`),grp(svg,`<g transform="translate(-31 -60)">${A.weaponArt('pin')}</g>`)];
 const bolts=[grp(svg,ART.bolt()),grp(svg,ART.bolt())];
 const leaf=grp(svg,ART.leaf()),offer=grp(svg,ART.truffle());
 const fx=grp(svg),P=Particles(fx);
 const say={laugh:grp(svg,ART.say('哼哼……哈哈哈哈！',{fill:'#2a1236',stroke:'#ff4d6d',ink:'#ffd1dc'})),roar:grp(svg,ART.word('吼——！！','#ff4d6d',56,-6)),
  cough1:grp(svg,ART.say('咳…咳咳',{fill:'#e8e4ea',stroke:'#3a3340'})),cough2:grp(svg,ART.say('咳！',{fill:'#e8e4ea',stroke:'#3a3340',tail:'r'})),
  mercy:grp(svg,ART.say('大王饶命～',{fill:'#fffaf0',stroke:'#5b4636'})),fan:grp(svg,ART.say('给大王扇扇风～',{fill:'#fffaf0',stroke:'#5b4636',tail:'r'})),
  boss:grp(svg,ART.say('这才像话嘛～',{fill:'#2a1236',stroke:'#ff4d6d',ink:'#ffd1dc'}))};
 const title=grp(hud,ART.title('邪恶猪猪 · 大发神威！','屠夫们被劈成了焦炭','#ff8fb1'));
 const tGrow=.55,tRoar=1.62,tBolt=[2.15,2.45],tRain=3.0,tSit=3.75,tKneel=4.6;
 const cues=[[.05,'thunderLow'],[.6,'rumble'],[.85,'thunder'],[1.0,'evilLaugh'],[1.25,'thunder'],[tRoar,'roar'],[tRoar+.08,'clatter'],[tBolt[0],'zap'],[tBolt[1],'zap'],[2.75,'cough'],[tRain,'rain'],[tSit,'throne'],[tKneel+.3,'mercy'],[5.4,'fan'],[6.5,'bossLaugh'],[6.9,'tada']];
 const spawned={};
 function update(T){
  sky.setAttribute('opacity',(.96*prog(T,0,.45)).toFixed(2));floor.setAttribute('opacity',prog(T,0,.45).toFixed(2));
  // 闪电闪屏
  const fl=[.85,1.25,tBolt[0],tBolt[1]].reduce((a,t)=>Math.max(a,T>=t&&T<t+.18?1-(T-t)/.18:0),0);flash.setAttribute('opacity',(fl*.55).toFixed(2));
  clouds.forEach((n,k)=>place(n,[260,560,820][k]+wave(T,.15,10),lerp(-180,[70,40,80][k],EASE.out(prog(T,0,.6))),[1.2,1.5,1.1][k],0,1));
  // ---------- 邪恶猪猪 ----------
  const grow=EASE.back(prog(T,tGrow,tRoar-.1)),sit=prog(T,tSit-.35,tSit);
  let ps=lerp(1.5,2.35,grow),px=MID,py=GROUND-lerp(0,20,grow);const Pp=pose();
  Pp.expr=T<.5?'sly':T<tRoar?'laugh':T<tRoar+.4?'angry':T<tRain?'laugh':T<tSit+.2?'laugh':'smug';
  if(T<tRoar){mv(Pp.root,wave(T,10,2.5*grow),0);mv(Pp.tail,0,0,wave(T,4,30))}
  else if(T<tRoar+.45){const r=env(T,tRoar,tRoar+.45,.06);mv(Pp.head,0,-6*r,-20*r);mv(Pp.torso,0,0,0,1+.08*r,1+.06*r);mv(Pp.root,wave(T,22,3*r),0)}
  if(T>=tRain){ps=lerp(2.35,1.75,EASE.inOut(sit));py=lerp(GROUND-20,GROUND-150,EASE.inOut(sit))-Math.sin(sit*Math.PI)*60;
   if(T>=tSit){['legA','legB'].forEach(k=>mv(Pp[k],0,0,-50));['legC','legD'].forEach(k=>mv(Pp[k],0,0,40));mv(Pp.root,0,0,-6);mv(Pp.tail,0,0,wave(T,1.6,30));mv(Pp.head,0,0,-8+wave(T,.8,4));
    if(T>6.1&&T<6.8){const lg=env(T,6.1,6.8,.1);mv(Pp.torso,0,-Math.abs(wave(T,5,3))*lg,0);Pp.expr='laugh'}}}
  pig.draw(px,py,ps,1,0,1,Pp);
  place(aura,px,py-70*ps/1.5,(ps/1.5)*(1+.08*Math.sin(T*9)),T*40,T>tGrow?Math.min(.9,prog(T,tGrow,tGrow+.3))*(T>tSit?.5:1):0);
  [[30.5,71],[64.5,77.5]].forEach(([ex,ey],k)=>{const x=px+(ex-78)*ps,y=py+(ey-137)*ps;place(eyes[k],x,y,(.6+.4*Math.sin(T*12+k))*ps/1.5,0,T>tGrow+.2&&T<tRain?.9:T>=tRain?.5:0)});
  place(rays,px,py-90,1+.04*Math.sin(T*3),T*8,T>tSit?prog(T,tSit,tSit+.4):0);
  rings.forEach((n,k)=>{const u=T-tRoar-k*.12;place(n,px,py-120,.3+Math.max(0,u)*9,0,u>0&&u<.6?1-u/.6:0)});
  // 松露王座
  place(pile,px,GROUND,lerp(.2,1.1,EASE.back(prog(T,tRain+.1,tSit))),0,T>tRain+.1?1:0);
  // ---------- 屠夫 ----------
  const ch=[T>=tBolt[0]+.02,T>=tBolt[1]+.02],disarm=T>=tRoar+.05;
  const blow=kf(T,[[tRoar,0],[tRoar+.12,1,'out'],[tRoar+.6,.85],[tKneel-.3,.85],[tKneel,0]]);
  const advance=EASE.out(prog(T,0,.5));
  const kneel=EASE.back(prog(T,tKneel,tKneel+.35));
  let lx=lerp(-120,L+30,advance)-blow*70,rx=lerp(1120,R-30,advance)+blow*70,lr=-blow*14,rr=blow*14,ly=GROUND,ry=GROUND;
  if(T>=tKneel){lx=lerp(L-30,px-210,kneel);rx=lerp(R+30,px+210,kneel);ly=GROUND+8*kneel;ry=GROUND+8*kneel;lr=10*kneel;rr=-10*kneel}
  const lEx=ch[0]?(T<tKneel?(Math.floor(T*3)%3===0?'blink':'shock'):'happy'):T<tGrow+.3?'angry':'shock';
  const rEx=ch[1]?(T<tKneel?(Math.floor(T*3+1)%3===0?'blink':'shock'):'happy'):T<tGrow+.3?'angry':'shock';
  bL.look({charred:ch[0],expr:lEx,noWeapon:disarm});bR.look({charred:ch[1],expr:rEx,noWeapon:disarm});
  const sqk=T>=tKneel?1-.12*kneel:1;
  bL.draw(lx+(ch[0]&&T<tKneel?wave(T,6,2):0),ly,1.25,-1,lr,1);bR.draw(rx+(ch[1]&&T<tKneel?wave(T,6,2):0),ry,1.25,1,rr,1);
  bL.set('body',{sy:sqk});bR.set('body',{sy:sqk});
  let aL=T<tRoar?-40-30*Math.abs(Math.sin(T*3)):disarm&&T<tKneel?30:0,aR=T<tRoar?-40-30*Math.abs(Math.sin(T*3+1)):disarm&&T<tKneel?30:0,aLR=0,aRR=0;
  if(T>=tKneel){aL=-60+wave(T,2.2,50)*prog(T,tKneel+.3,tKneel+.6);aRR=-150;bL.set('head',{r:8});bR.set('head',{r:-8+wave(T,1.2,4)})}else{bL.set('head',{r:0});bR.set('head',{r:0})}
  bL.set('arm',{r:aL});bL.set('armR',{r:aLR});bR.set('arm',{r:aR});bR.set('armR',{r:aRR});
  // 被吼飞的刀和擀面杖
  wpn.forEach((n,k)=>{const u=T-tRoar-.05;if(u<0){hide(n);return}const sx=k?rx-60:lx+60,dir=k?1:-1;place(n,sx+dir*u*520,GROUND-200-u*560+u*u*700,1.25,dir*u*900,u<1?1:0)});
  bolts.forEach((n,k)=>{const t0=tBolt[k],x=k?rx:lx;place(n,x,GROUND-280,1.2,k?-8:8,T>=t0&&T<t0+.22?(Math.floor((T-t0)*40)%2?1:.6):0)});
  {const h=bL.hand(lx,ly,1.25,-1,'arm',aL);place(leaf,h.x,h.y-6,1.3,-150+aL*.6,T>=tKneel+.25?1:0)}
  {const h=bR.hand(rx,ry,1.25,1,'armR',aRR);place(offer,h.x,h.y-20,1.3,0,T>=tKneel+.25?1:0)}
  // ---------- 对白与字 ----------
  popAt(say.laugh,T,1.0,px+190,GROUND-320,.9,10);popAt(say.roar,T,tRoar,px+20,GROUND-340,.75,20,1.15);
  popAt(say.cough1,T,2.75,L-40,GROUND-270,1.0,10);popAt(say.cough2,T,2.95,R+40,GROUND-270,.9,10);
  popAt(say.mercy,T,tKneel+.3,px-260,GROUND-260,1.3,10);popAt(say.fan,T,5.3,px+230,GROUND-260,1.2,10);popAt(say.boss,T,6.5,px+20,GROUND-360,1.0,8);
  place(title,500,88,EASE.back(prog(T,6.85,7.15))*(1+.02*Math.sin(T*6)),0,T>6.85?1:0);
  // ---------- 粒子 ----------
  tBolt.forEach((t0,k)=>{if(T>=t0&&!spawned['b'+k]){spawned['b'+k]=1;const x=k?rx:lx;P.add(ART.smoke(),7,{at:t0+.05,x,y:GROUND-150,ang:[-Math.PI*.9,-Math.PI*.1],speed:[40,110],g:-60,life:[.8,1.3],drag:2,jx:30},k+3);P.add(ART.sparkle('#fff36b'),8,{at:t0,x,y:GROUND-200,speed:[150,300],g:300,life:[.3,.5]},k+9)}});
  if(T>=tRain&&!spawned.rain){spawned.rain=1;P.add(ART.truffle(),24,{at:tRain,x:MID,y:-40,ang:[Math.PI*.45,Math.PI*.55],speed:[60,160],g:900,life:[.7,1.0],jx:280,stagger:.035,ground:GROUND-20,scale:[.9,1.3]},21)}
  if(T>=tRoar&&!spawned.dust){spawned.dust=1;P.add(ART.dust(),10,{at:tRoar,x:MID,y:GROUND+10,ang:[Math.PI,Math.PI*2],speed:[200,380],g:-40,life:[.5,.8],drag:3,jx:60},33)}
  if(T>=6.9&&!spawned.conf){spawned.conf=1;P.add((i)=>`<rect x="-6" y="-3" width="12" height="6" rx="2" fill="${['#ff4d6d','#c18bff','#ffd34d','#ff8fb1','#ffffff'][i%5]}"/>`,26,{at:6.9,x:MID,y:60,ang:[Math.PI*.15,Math.PI*.85],speed:[60,260],g:260,life:[1,1.6],jx:300},70)}
  P.draw(T);
  const rum=T>tGrow&&T<tRoar?2*prog(T,tGrow,tRoar):0,roarS=T>=tRoar&&T<tRoar+.5?12*(1-prog(T,tRoar,tRoar+.5)):0,boltS=tBolt.reduce((a,t)=>a+(T>=t&&T<t+.25?8*(1-(T-t)/.25):0),0);
  return {shake:rum+roarS+boltS};
 }
 return {dur:D,update,cues};
}

// 挂到牌桌上：返回 {dur, update(T), cues:[[时间, 名称]], skip, destroy}
function mount(host,o){
 o=o||{};const wrap=document.createElement('div');wrap.className='dz-finale';
 const svg=el('svg',{viewBox:`0 0 ${W} ${H}`,class:'dz-finale-svg','aria-hidden':'true'});wrap.appendChild(svg);
 const cam=el('g',{},svg),hud=el('g',{},svg);
 const scene=(o.landlordWin?evilScene:butcherScene)(cam,hud,o);const Z=o.landlordWin?[1.18,500,318]:[1.3,510,326];
 const skip=document.createElement('button');skip.className='dz-finale-skip';skip.textContent='跳过 ›';wrap.appendChild(skip);
 host.appendChild(wrap);
 return {dur:scene.dur,cues:scene.cues,skip,
  update(T){const r=scene.update(T)||{};const s=r.shake||0;cam.setAttribute('transform',`translate(${(500+(s?Math.sin(T*61)*s:0)).toFixed(1)} ${(310+(s?Math.cos(T*53)*s*.6:0)).toFixed(1)}) scale(${Z[0]}) translate(${-Z[1]} ${-Z[2]})`);const fade=Math.min(1,T/.25,(scene.dur-T)/.3);wrap.style.opacity=Math.max(0,fade).toFixed(2)},
  destroy(){if(wrap.parentNode)wrap.remove()}};
}
const api={mount,ART};
if(typeof module!=='undefined')module.exports=api;root.PigDdzFinale=api;
})(typeof window!=='undefined'?window:globalThis);
