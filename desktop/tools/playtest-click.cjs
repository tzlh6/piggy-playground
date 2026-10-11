// 只用鼠标单击（及触屏点按）试玩全部 18 款游戏的主要操作。
// 用法：node tools/playtest-click.cjs [index.html 或单文件网页路径] [截图目录]
// 需要 Playwright（npm i -D playwright，或设置 PLAYWRIGHT_MODULE 指向已安装的模块）。
const path=require('path'),fs=require('fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const FILE=path.resolve(process.argv[2]||path.join(__dirname,'..','app','index.html'));
const OUT=process.argv[3]?path.resolve(process.argv[3]):null;if(OUT)fs.mkdirSync(OUT,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const results=[];
async function run(name,fn,page){const t0=Date.now();try{const note=await fn();results.push({name,ok:true,note:note||'',ms:Date.now()-t0})}catch(e){results.push({name,ok:false,note:String(e.message||e).split('\n')[0],ms:Date.now()-t0})}
 if(OUT)await page.screenshot({path:path.join(OUT,name.replace(/[^\w一-龥-]+/g,'_')+'.png')}).catch(()=>{})}
const must=(c,m)=>{if(!c)throw new Error(m)};

(async()=>{
 const browser=await chromium.launch();
 const ctx=await browser.newContext({viewport:{width:1366,height:860}});const page=await ctx.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto('file://'+FILE);await sleep(400);
 const go=async id=>{await page.click(`.nav[data-game="${id}"]`);await sleep(350)};
 const S=(f,a)=>page.evaluate(f,a);
 // 画布逻辑坐标 → 页面坐标后单击
 const clickCanvas=async(sel,x,y,W,H)=>{const r=await page.locator(sel).boundingBox();await page.mouse.click(r.x+x/W*r.width,r.y+y/H*r.height)};

 await run('01 扫猪',async()=>{await go('mine');await page.click('.mine-cell >> nth=200');must(await S(()=>state.status!=='ready'),'翻开后应开始');
  await page.click('#flag');const i=await S(()=>state.cells.findIndex(c=>!c.open));await page.click(`.mine-cell[data-i="${i}"]`);must(await S(i=>state.cells[i].flag,i),'标记模式单击插旗');await page.click('#dig');return '单击翻开、标记模式插旗'},page);
 await run('02 记忆翻翻乐',async()=>{await go('memory');const cards=await S(()=>state.cards);const a=0,b=cards.indexOf(cards[0],1);await page.click('.memory-card >> nth=0');await page.click(`.memory-card >> nth=${b}`);await sleep(200);must(await S(()=>state.matched.size===2),'配对成功');return '两次单击完成配对'},page);
 await run('03 猪猪 2048',async()=>{await go('merge');let moved=0;for(const d of ['left','up','right','down','left','up']){const before=await S(()=>state.board.join());await page.click(`.dpad [data-dir="${d}"]`);await sleep(140);if(await S(()=>state.board.join())!==before)moved++}must(moved>=3,'方向按钮推动棋盘');return moved+' 次有效推动'},page);
 await run('04 小猪捉迷藏',async()=>{await go('whack');await page.click('#start-whack');let hits=0;for(let k=0;k<60&&hits<3;k++){await sleep(80);const t=await S(()=>state.target>=0&&!state.decoy?state.target:-1);if(t>=0){await page.click(`.hole[data-hole="${t}"]`);await sleep(60);hits=await S(()=>Math.round(state.score/10))}}must(hits>=2,'单击抓到小猪');return '抓到 '+hits+' 只'},page);
 await run('05 贪吃猪',async()=>{await go('snake');await page.click('#snake-go');await page.click('.dpad [data-dir="up"]');await sleep(400);await page.click('.dpad [data-dir="right"]');await sleep(400);must(await S(()=>state.started&&!state.finished),'按钮转向后继续前进');return '开始与转向都靠按钮'},page);
 await run('06 跳跳猪',async()=>{await go('runner');must(await page.locator('#btn-duck').isVisible(),'桌面也显示跳 / 趴下按钮');await page.click('#runner-go');let jumps=0,ducks=0;const end=Date.now()+6000;
  while(Date.now()<end&&!(await S(()=>state.finished))){const o=await S(()=>{const R=state.run,p=R.pig,o=R.obs.find(o=>o.x+o.w>p.x&&o.x-p.x<95);return o?{crow:o.kind!=='fence'&&o.kind!=='mud',high:o.y<R.ground-48,air:p.air}:null});
   if(o&&!o.air){if(o.crow&&o.high){await page.click('#btn-duck');ducks++;const d=await S(()=>state.run.pig.duck);must(d,'单击趴下立即生效')}else{await page.click('#btn-jump');jumps++}await sleep(260)}else await sleep(25)}
  const alive=await S(()=>!state.finished);return `只点按钮跑了 6 秒：跳 ${jumps} 次、趴 ${ducks} 次，${alive?'没有摔倒':'摔倒了'}`},page);
 await run('07 猪猪方块',async()=>{await go('blocks');await page.click('#extra-go');for(const a of ['left','rotate','right','drop','soft','hold','drop'])await page.click(`.arcade-pad [data-extra="${a}"]`);must(await S(()=>state.g.score>0||state.g.board.some(Boolean)),'落下方块');return '左右/旋转/下移/暂存/落底按钮'},page);
 await run('08 弹弹猪',async()=>{await go('breakout');const x0=await S(()=>state.g.paddle.x);await page.click('.arcade-pad [data-extra="right"]');await page.click('.arcade-pad [data-extra="right"]');await sleep(100);const x1=await S(()=>state.g.paddle.x);await page.click('.arcade-pad [data-extra="launch"]');await sleep(300);must(x1>x0,'按钮移动接板');must(await S(()=>state.started),'发球');return '按钮移动接板并发球'},page);
 await run('09 飞天猪',async()=>{await go('flappy');await page.click('#extra-go');let flaps=0;const end=Date.now()+3000;while(Date.now()<end&&!(await S(()=>state.finished))){if(await S(()=>state.g.y>210&&state.g.vy>0)){await page.click('.arcade-pad [data-extra="flap"]');flaps++}await sleep(30)}must(flaps>=3,'单击扑翅');return flaps+' 次扑翅'},page);
 await run('10 叠叠猪',async()=>{await go('stack');await page.click('#extra-go');await sleep(300);await page.click('.arcade-pad [data-extra="drop"]');await sleep(200);must(await S(()=>state.g.layers.length>=2||state.finished),'放下一层');return '单击放下'},page);
 await run('11 猪猪四子棋',async()=>{await go('connect');await page.click('.connect-columns [data-col="3"]');await sleep(900);must(await S(()=>state.g.moves>=2),'玩家落子后电脑应对');return '点列落子，电脑回应'},page);
 await run('12 松露推箱子',async()=>{await go('sokoban');const path=await S(()=>PigArcadeCore.solveSokoban(state.g));for(const d of path){await page.click(`.dpad [data-dir="${d}"]`);await sleep(40)}await sleep(300);must(await S(()=>state.g.won),'按方向按钮推完箱子');return '方向按钮 '+path.length+' 步过关'},page);
 await run('13 猪猪点灯',async()=>{await go('lights');for(let k=0;k<40&&!(await S(()=>state.g.won));k++){await page.click('#play-toolbar [data-extra="hint"]');const h=await S(()=>state.hint);await page.click(`#lights-grid [data-light="${h}"]`)}must(await S(()=>state.g.won),'跟着提示单击关灯');return '提示 + 单击过关'},page);
 await run('14 猪猪消消乐',async()=>{await go('match');const m0=await S(()=>state.g.moves);await page.click('#play-toolbar [data-extra="hint"]');await sleep(100);const h=await S(()=>state.hints);await page.click(`[data-match="${h[0]}"]`);await page.click(`[data-match="${h[1]}"]`);await sleep(1600);must(await S(()=>state.g.moves)<m0,'两次单击完成交换');return '单击两只相邻的猪交换'},page);
 await run('15 切切猪',async()=>{await go('slice');await page.click('#challenge-go');let s=0;for(let k=0;k<80&&s<2;k++){await sleep(60);const it=await S(()=>{const p=state.g.items.find(i=>!i.cut&&i.kind!=='bomb'&&i.y<400&&i.y>40);return p?{x:p.x+p.vx*.05,y:p.y+p.vy*.05}:null});if(it){await clickCanvas('#challenge-canvas',it.x,it.y,760,460);s=await S(()=>state.g.items.filter(i=>i.cut).length+state.g.score/100)}}must(await S(()=>state.g.score>0),'单击切中小猪');return '单击切中，得分 '+(await S(()=>state.g.score))},page);
 await run('16 猪猪星际守卫',async()=>{await go('shooter');await page.click('#challenge-go');const p0=await S(()=>({...state.g.player}));await clickCanvas('#challenge-canvas',600,380,760,460);await sleep(900);const p1=await S(()=>({...state.g.player}));must(Math.hypot(p1.x-600,p1.y-380)<20,'点哪飞哪');must(Math.hypot(p1.x-p0.x,p1.y-p0.y)>100,'平滑移动');await page.click('[data-challenge="shield"]');must(await S(()=>state.g.cooldown>0),'护盾按钮');return '单击目标点平滑飞过去，按钮开护盾'},page);
 await run('17 猪猪节奏派对',async()=>{await go('rhythm');must(await S(()=>state.g.assist),'默认单击模式');await page.click('#challenge-go');const deadline=Date.now()+16000;while(Date.now()<deadline){const n=await S(()=>{const g=state.g;const n=g.notes.find(n=>!n.done&&!n.started&&n.t-g.time<.06&&n.t-g.time>-.1);return n?n.lane:-1});if(n>=0)await page.click(`[data-lane="${n}"]`);else await sleep(8)}const g=await S(()=>({p:state.g.perfect,good:state.g.good,miss:state.g.miss}));must(g.p+g.good>10&&g.p+g.good>g.miss*2,'单击命中音符 '+JSON.stringify(g));return JSON.stringify(g)},page);
 await run('18 猪猪轮盘（整场单击）',async()=>{await go('roulette');const t0=Date.now();let clicks=0;
  while(Date.now()-t0<480000){const st=await S(()=>{const D=PigRouletteDebug,t=D.state();return {fin:t.finished,busy:D.busy(),turn:t.g.turn,phase:t.g.phase}});if(st.fin)break;
   if(st.busy||st.turn!==0||st.phase!=='play'){await sleep(120);continue}
   const a=await S(()=>{const t=PigRouletteDebug.state();return PigRouletteCore.chooseAction(t.g.publicView(0),Math.random,'smart')});
   if(a.type==='shoot')await page.click(a.target==='self'?'#rl-self':'#rl-opp');
   else{const k=await S(it=>PigRouletteDebug.state().g.items[0].indexOf(it),a.item);await page.click(`#rl-bag0 [data-k="${k}"]`);if(a.item==='xray'){await sleep(80);await page.click(`#rl-slots [data-slot="${a.index}"]`)}}
   clicks++;await sleep(150)}
  const r=await S(()=>{const t=PigRouletteDebug.state();return {fin:t.finished,wins:t.g.wins,scored:t.g.scored}});must(r.fin,'整场打完');must(!(await page.locator('#result').isHidden()),'结果窗口');return `比分 ${r.wins.join(':')}，玩家单击 ${clicks} 次`},page);

 // 触屏点按（手机尺寸）
 const mctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2});const m=await mctx.newPage();m.on('pageerror',e=>errors.push('mobile: '+e.message));
 await m.goto('file://'+FILE);await sleep(400);
 const mgo=async id=>{await m.locator(`.nav[data-game="${id}"]`).scrollIntoViewIfNeeded();await m.tap(`.nav[data-game="${id}"]`);await sleep(350)};
 await run('触屏 · 2048 方向键',async()=>{await mgo('merge');const b=await m.evaluate(()=>state.board.join());for(const d of ['left','up','right'])await m.tap(`.dpad [data-dir="${d}"]`);must(await m.evaluate(()=>state.board.join())!==b,'点按推动');return 'ok'},m);
 await run('触屏 · 切切猪点按',async()=>{await mgo('slice');await m.tap('#challenge-go');let ok=false;for(let k=0;k<80&&!ok;k++){await sleep(60);const it=await m.evaluate(()=>{const p=state.g.items.find(i=>!i.cut&&i.kind!=='bomb'&&i.y<400&&i.y>40);return p?{x:p.x,y:p.y}:null});if(it){const r=await m.locator('#challenge-canvas').boundingBox();await m.touchscreen.tap(r.x+it.x/760*r.width,r.y+it.y/460*r.height);ok=await m.evaluate(()=>state.g.score>0)}}must(ok,'点按切中');return 'ok'},m);
 await run('触屏 · 轮盘开枪',async()=>{await mgo('roulette');await m.waitForFunction(()=>{const D=PigRouletteDebug;return !D.busy()&&D.state().g.turn===0},null,{timeout:60000});await m.locator('#rl-opp').scrollIntoViewIfNeeded();await m.tap('#rl-opp');await sleep(200);must(await m.evaluate(()=>PigRouletteDebug.busy()),'点按开枪进入演出');return 'ok'},m);
 await run('触屏 · 节奏点按',async()=>{await mgo('rhythm');await m.locator('[data-lane="0"]').scrollIntoViewIfNeeded();await m.tap('#challenge-go');const end=Date.now()+6000;while(Date.now()<end){const n=await m.evaluate(()=>{const g=state.g;const n=g.notes.find(n=>!n.done&&!n.started&&n.t-g.time<.06&&n.t-g.time>-.1);return n?n.lane:-1});if(n>=0)await m.tap(`[data-lane="${n}"]`);else await sleep(8)}must(await m.evaluate(()=>state.g.perfect+state.g.good>2),'点按命中');return 'ok'},m);
 const sw=await m.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);results.push({name:'手机宽度无横向溢出',ok:sw<=1,note:'溢出 '+sw+' px'});

 await browser.close();
 const pass=results.filter(r=>r.ok).length;
 for(const r of results)console.log((r.ok?'PASS':'FAIL')+'  '+r.name.padEnd(18)+'  '+r.note);
 console.log(`\n${pass}/${results.length} passed; page errors: ${errors.length?errors.join(' | '):'none'}`);
 process.exit(pass===results.length&&!errors.length?0:1);
})();
