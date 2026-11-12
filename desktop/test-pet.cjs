'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const D=require('./app/pet-data.js'),P=require('./app/pet-core.js'),R=require('./app/pet-rewards.js'),S=require('./app/pet-store.js');
const T=Date.UTC(2026,10,10),H=D.HOUR,DAY=D.DAY;
let groups=0,serial=0;
function test(name,fn){fn();groups++;console.log('ok',name);}
function pig(extra={}){return P.create({now:T,seed:42,...extra});}
function game(now=T,extra={}){return {type:'game-end',eventId:'game-'+(++serial),at:now,id:'snake',cat:'action',level:'normal',
  win:null,record:false,first:false,seconds:60,mode:'solo',...extra};}
function study(now=T,extra={}){return {type:'study-session',eventId:'study-'+(++serial),at:now,subject:null,answered:10,correct:8,seconds:60,...extra};}
function rich(xp=0){const s=pig({legacy:{truffles:10000}}).save();s.xp=xp;return P.restore(s);}
class MemoryStorage{
  constructor(){this.values=new Map();this.fail=null;}
  getItem(k){if(this.fail==='read')throw Error('denied');return this.values.has(k)?this.values.get(k):null;}
  setItem(k,v){if(this.fail===k)throw Error('quota');this.values.set(k,String(v));}
}
class FaultStorage extends MemoryStorage{
  getItem(k){if(this.readOnce===k){this.readOnce=null;throw Error('temporary read failure');}return super.getItem(k);}
  setItem(k,v){
    if(this.drop===k)return;
    super.setItem(k,v);
    if(this.failAfterWrite===k){this.failAfterWrite=null;this.readOnce=k;}
    if(this.afterBackup&&k===S.BACKUP){const fn=this.afterBackup;this.afterBackup=null;fn();}
  }
}
function open(storage,now=T){const r=S.open({storage,now,seed:42});assert.equal(r.ok,true,JSON.stringify(r));return r;}
function same(a,b){assert.deepEqual(a.save(),b.save());}

test('单猪默认、所有 32 入口分类、旧衣柜与快照隔离',()=>{
  const p=pig(),v=p.view();assert.equal(v.petCount,1);assert.equal(v.name,'团子');assert.equal(v.stage,'baby');assert.equal(v.truffles,30);
  assert.equal(Object.keys(globalThis.PigCatalog.SETTLE).length,32);assert.equal(D.looks.length,10);assert.equal(D.accessories.length,11);
  v.needs.hunger=0;v.placements.bed='hacked';v.wardrobe.skins.push('hacked');const save=p.save();save.daily.wish.done=true;
  assert.equal(p.view().needs.hunger,75);assert.equal(p.view().placements.bed,'straw-bed');assert.equal(p.view().wish.done,false);
  assert.throws(()=>{D.byId.apple.price=0;},TypeError);
  for(const entry of globalThis.PigCatalog.GAMES){if(entry.id==='study')continue;
    const q=R.quote(game(T,{id:entry.id,...(entry.id==='doudizhu'?{truffleDelta:0}:{})}));assert.equal(q.ok,true,entry.id);
    assert.equal(q.event.cat,entry.cat);assert.ok(q.traitId);}
});
test('有效时间、48 小时封顶、需求底线与时间倒退',()=>{
  const p=pig();assert.equal(p.advance(T+H).ok,true);assert.ok(Math.abs(p.view().needs.hunger-65)<1e-8);
  p.advance(T+60*DAY);assert.ok(Object.values(p.view().needs).every(n=>n===15));
  const before=p.save();const r=p.reward(study(T+59*DAY),T+59*DAY);assert.equal(r.reason,'clock-backward');assert.deepEqual(p.save(),before);
  assert.equal(p.advance(NaN).reason,'bad-time');assert.equal(p.advance(Infinity).reason,'bad-time');
  assert.equal(p.advance(T+60*DAY).ok,true);assert.equal(p.view().daily.game.coins,0);
  const step=pig(),jump=pig();for(let i=1;i<=120;i++)step.advance(T+i*30000);jump.advance(T+H);
  for(const k of Object.keys(D.needs))assert.ok(Math.abs(step.view().needs[k]-jump.view().needs[k])<1e-7,k);
});
test('睡眠分段推进、自动醒来与拒绝状态',()=>{
  const p=pig();assert.equal(p.dispatch({type:'sleep'},T).ok,true);
  assert.equal(p.dispatch({type:'feed',itemId:'apple'},T).reason,'sleeping');
  const q=P.restore(p.save());p.advance(T+H);for(let i=1;i<=60;i++)q.advance(T+i*60000);
  assert.equal(p.view().sleeping,false);assert.ok(Math.abs(p.view().needs.energy-q.view().needs.energy)<1e-7);
  assert.equal(p.dispatch({type:'wake'},T+H).reason,'not-sleeping');
  const n=pig();n.dispatch({type:'sleep'},T);n.advance(T+H/4);assert.ok(n.view().needs.energy>80);assert.equal(n.dispatch({type:'wake'},T+H/4).ok,true);
});
test('喂摸洗玩、免费食物、冷却与每日照顾经验上限',()=>{
  const p=pig();assert.equal(p.dispatch({type:'feed',itemId:'apple'},T).ok,true);assert.equal(p.view().inventory.apple,2);
  assert.equal(p.dispatch({type:'feed',itemId:'apple'},T).reason,'too-full');
  assert.equal(p.dispatch({type:'pet'},T).ok,true);assert.equal(p.dispatch({type:'pet'},T).reason,'cooldown');
  assert.equal(p.dispatch({type:'wash'},T).ok,true);assert.equal(p.dispatch({type:'wash'},T).reason,'already-clean');
  assert.equal(p.dispatch({type:'play',itemId:'ball'},T).ok,true);assert.equal(p.dispatch({type:'play',itemId:'rattle'},T).reason,'not-owned');
  for(let i=1;i<=30;i++)p.dispatch({type:'pet'},T+i*60000);
  assert.equal(p.view().daily.careXp,40);assert.equal(p.view().xp.total,40);
  p.advance(T+10*H);assert.equal(p.dispatch({type:'feed',itemId:'grass'},T+10*H).ok,true);
  assert.equal(p.dispatch({type:'feed',itemId:'grass'},T+10*H+60000).reason,'cooldown');
  assert.equal(p.dispatch({type:'play',itemId:'ball'},T+10*H+60000).reason,'too-tired');
  assert.equal(p.dispatch({type:'poke'},T+10*H+60000).ok,true);assert.equal(p.dispatch({type:'poke'},T+10*H+60000).reason,'cooldown');
});
test('消费、背包、解锁、摆放与换装均由核心校验',()=>{
  const p=rich(D.totalXpForLevel(10)),old=p.view().truffles;
  assert.equal(p.dispatch({type:'buy',itemId:'apple',quantity:3},T).ok,true);assert.equal(p.view().truffles,old-12);assert.equal(p.view().inventory.apple,6);
  assert.equal(p.dispatch({type:'buy',itemId:'rattle'},T).ok,true);assert.equal(p.dispatch({type:'buy',itemId:'rattle'},T).reason,'already-owned');
  assert.equal(p.dispatch({type:'buy',itemId:'puzzle-cube'},T).reason,'locked');
  assert.equal(p.dispatch({type:'buy',itemId:'soft-bed'},T).ok,true);assert.equal(p.dispatch({type:'place',slot:'bed',itemId:'soft-bed'},T).ok,true);
  assert.equal(p.dispatch({type:'place',slot:'wall',itemId:'soft-bed'},T).reason,'wrong-slot');
  assert.equal(p.dispatch({type:'wear',slot:'skin',itemId:'cow'},T).ok,true);assert.equal(p.dispatch({type:'wear',slot:'accessory',itemId:'scholar-pin'},T).reason,'not-owned');
  assert.equal(p.dispatch({type:'rename',name:' 小猪 '},T).reason,'bad-action');assert.equal(p.dispatch({type:'rename',name:'团团'},T).ok,true);
  assert.equal(pig().dispatch({type:'buy',itemId:'carrot'},T).reason,'locked');
  const poor=pig();for(let i=0;i<7;i++)assert.equal(poor.dispatch({type:'buy',itemId:'apple'},T).ok,true);
  assert.equal(poor.dispatch({type:'buy',itemId:'apple'},T).reason,'no-money');
  for(const a of [null,{},[],{type:'buy',itemId:'__proto__'},{type:'buy',itemId:'apple',quantity:-1},{type:'buy',itemId:'apple',quantity:Infinity},{type:'place',slot:'constructor',itemId:null}])assert.equal(p.dispatch(a,T).ok,false);
});
test('刷分类胜负忽略、首次成绩不发纪录奖、累计胜场不冒充纪录',()=>{
  let q=R.quote(game(T,{win:true,record:true}));assert.equal(q.coins,13);assert.equal(q.event.win,null);
  q=R.quote(game(T,{record:true,first:true}));assert.equal(q.coins,3);
  q=R.quote(game(T,{id:'chess',win:true,record:true,first:true}));assert.equal(q.coins,8);assert.equal(q.event.record,false);
  q=R.quote(game(T,{id:'pipes',win:true}));assert.equal(q.coins,8);
  q=R.quote(game(T,{seconds:29.99,record:true}));assert.equal(q.eligible,false);assert.equal(q.coins,0);
  q=R.quote(game(T,{seconds:30}));assert.equal(q.coins,3);
  for(const mode of ['duo','lan']){q=R.quote(game(T,{id:'pool',win:true,record:true,mode}),{wishGame:'pool'});assert.equal(q.coins,3);assert.equal(q.wish,false);}
  q=R.quote(game(T,{cat:'study'}));assert.equal(q.traitId,'agile');
});
test('学习倾斜、空学科、十题奖励及有效用时门槛',()=>{
  const q=R.quote(study());assert.equal(q.coins,52);assert.equal(q.xp,108);assert.equal(q.traitId,'knowledge');assert.equal(q.trait,18);
  assert.equal(R.quote(study(T,{seconds:29.99})).eligible,false);
  assert.equal(R.quote(study(T,{answered:9,correct:9})).coins,36);
  assert.equal(R.quote(study(T,{answered:20,correct:20,seconds:60})).coins,100);
  const p=pig();for(let i=0;i<20;i++)p.reward(study(),T);
  assert.equal(p.view().daily.study.coins,360);assert.equal(p.view().daily.study.xp,720);assert.equal(p.view().daily.study.trait,180);
  assert.equal(p.view().traits.knowledge,180);assert.equal(p.view().daily.game.coins,0);
});
test('游戏额度、跨午夜独立刷新、倒退不重置',()=>{
  const midnight=Date.UTC(2026,10,10,16),p=pig({now:midnight-60000});
  for(let i=0;i<100;i++)p.reward(game(midnight-30000),midnight-30000);
  assert.equal(p.view().daily.game.coins,120);assert.ok(p.view().daily.game.xp<=240);
  const coins=p.view().truffles;p.reward(game(midnight),midnight);assert.equal(p.view().daily.game.coins,3);assert.equal(p.view().truffles,coins+3);
  assert.equal(p.reward(game(midnight-1),midnight).reason,'event-expired');
  assert.equal(p.advance(midnight-1).reason,'clock-backward');assert.equal(p.view().daily.game.coins,3);
});
test('心愿只翻倍一次、任务只能领取一次且计入相应额度',()=>{
  const p=pig(),id=p.view().wish.game,e=game(T,{id,...(id==='doudizhu'?{truffleDelta:0}:{})});
  const a=p.reward(e,T);assert.equal(a.credited.coins,6);assert.equal(p.view().wish.done,true);
  const b=p.reward({...e,eventId:'wish-again'},T);assert.equal(b.credited.coins,3);
  p.reward(study(),T);assert.equal(p.view().tasks.find(t=>t.id==='study-ten').done,true);
  assert.equal(p.dispatch({type:'claim',taskId:'study-ten'},T).ok,true);
  assert.equal(p.dispatch({type:'claim',taskId:'study-ten'},T).reason,'already-claimed');
  assert.equal(p.dispatch({type:'claim',taskId:'care-three'},T).reason,'task-not-ready');
  p.advance(T+DAY);assert.equal(p.view().wish.done,false);assert.equal(p.view().tasks.some(t=>t.claimed),false);
});
test('统一斗地猪钱包、短局仍结赌注、损失止于零、赢额共享游戏上限',()=>{
  const p=pig(),e=game(T,{id:'doudizhu',win:true,seconds:1,truffleDelta:10000});
  const r=p.reward(e,T);assert.equal(r.credited.walletApplied,120);assert.equal(r.credited.coins,0);assert.equal(p.view().truffles,150);
  assert.equal(p.reward(e,T).reason,'duplicate');assert.equal(p.view().truffles,150);
  p.reward(game(T,{id:'doudizhu',win:false,seconds:1,truffleDelta:-1000,mode:'lan'}),T);
  assert.equal(p.view().truffles,0);assert.equal(p.view().wallet.forgiven,850);assert.equal(p.view().daily.game.coins,120);
  p.reward(game(T,{id:'doudizhu',win:true,truffleDelta:50}),T);assert.equal(p.view().truffles,0);
  p.reward(study(),T);assert.equal(p.view().truffles,52);
  assert.equal(p.reward(game(T,{id:'doudizhu'}),T).reason,'bad-event');
  assert.equal(p.reward(game(T,{id:'snake',truffleDelta:1}),T).reason,'bad-event');
});
test('事件唯一编号跨恢复去重、过期和未来事件拒绝、非法字段不入账',()=>{
  const p=pig(),e=study();p.reward(e,T);const q=P.restore(p.save()),before=q.view().truffles;
  assert.equal(q.reward({...e,correct:10},T).reason,'duplicate');assert.equal(q.view().truffles,before);
  for(const ev of [{...e,eventId:''},study(T,{correct:11}),study(T,{answered:0}),study(T,{answered:201}),study(T,{seconds:NaN}),game(T,{mode:'remote'}),game(T,{id:'constructor'}),game(T,{record:1}),game(T,{win:'true'})])assert.equal(q.reward(ev,T).reason,'bad-event');
  assert.equal(q.reward(study(T+6000),T).reason,'event-future');
  assert.equal(q.reward(study(T-DAY),T).reason,'event-expired');
  q.advance(T+8*DAY);assert.equal(q.reward(e,T+8*DAY).reason,'event-expired');
});
test('成长四阶段与存档随机序列可重放',()=>{
  for(const [level,stage] of [[1,'baby'],[4,'baby'],[5,'piglet'],[14,'piglet'],[15,'teen'],[29,'teen'],[30,'adult'],[100,'adult']]){
    assert.equal(rich(D.totalXpForLevel(level)).view().stage,stage);
  }
  const p=rich(D.totalXpForLevel(5)-1);const r=p.reward(study(),T);assert.ok(r.events.some(e=>e.type==='stage-up'&&e.stage==='piglet'));
  const q=P.restore(p.save());for(let day=1;day<=12;day++){p.advance(T+day*DAY);q.advance(T+day*DAY);same(p,q);}
  const a=pig({rng:()=>0.123}),b=pig({rng:()=>0.123});same(a,b);
});
test('存档字段、未来版本、超大文件和原型键严格校验',()=>{
  const s=pig().save();P.validate(s);
  const mutations=[x=>x.needs.hunger=-1,x=>x.wallet.balance=-1,x=>x.rngState=NaN,x=>x.xp=1.5,
    x=>x.owned.push('fake'),x=>x.placements.bed='apple',x=>x.daily.study.coins=361,x=>x.daily.claims=['study-ten'],
    x=>x.receipts=[{id:'x',at:T},{id:'x',at:T}],x=>x.cooldowns.constructor=T,x=>x.look.skin='hacked',
    x=>x.daily.day++,x=>x.lastNow=T-1,x=>x.legacy.migrated=false,x=>x.inventory.apple=1000];
  for(const mutate of mutations){const x=structuredClone(s);mutate(x);assert.throws(()=>P.restore(x),e=>e.code==='save-invalid');}
  assert.throws(()=>P.restore({...s,version:2}),e=>e.code==='save-newer');
  assert.throws(()=>P.restore(' '.repeat(D.limits.saveBytes+1)),e=>e.code==='save-invalid');
});
test('旧版余额、负数、配色装饰及老玩家礼只迁移一次',()=>{
  const storage=new MemoryStorage();storage.setItem('piggy2-ddz-truffles','200');storage.setItem('piggy2-look','"cow"');storage.setItem('piggy2-acc','"bell"');
  storage.setItem('piggy2-play-stats',JSON.stringify({snake:{n:3,last:T}}));
  let r=open(storage);assert.equal(r.created,true);assert.equal(r.service.view().truffles,260);assert.equal(r.service.view().look.skin,'cow');
  r.service.reward(study(),T);r=open(storage);assert.equal(r.created,false);assert.equal(r.service.view().truffles,312);
  assert.equal(storage.getItem('piggy2-ddz-truffles'),'200');assert.equal(r.service.view().look.accessory,'bell');
  const debt=new MemoryStorage();debt.setItem('piggy2-ddz-truffles','-500');r=open(debt);assert.equal(r.service.view().truffles,60);assert.equal(r.service.view().wallet.forgiven,500);
});
test('写入失败不提交内存和收据，重试只入账一次',()=>{
  const storage=new MemoryStorage(),service=open(storage).service,e=study();const before=service.save();
  storage.fail=S.KEY;let r=service.reward(e,T);assert.equal(r.reason,'storage-write');assert.deepEqual(service.save(),before);
  storage.fail=null;r=service.reward(e,T);assert.equal(r.ok,true);assert.equal(service.view().truffles,82);
  assert.equal(service.reward(e,T).reason,'duplicate');
  storage.fail=S.BACKUP;r=service.dispatch({type:'rename',name:'新名字'},T);assert.equal(r.reason,'storage-write');assert.equal(service.view().name,'团子');
});
test('坏主档回退、保护好备份、双坏档不静默重置、未来版本不覆盖',()=>{
  const storage=new MemoryStorage(),service=open(storage).service;service.reward(study(),T);
  const backup=storage.getItem(S.BACKUP);storage.setItem(S.KEY,'{broken');const r=open(storage);
  assert.equal(r.recovered,true);assert.equal(r.service.view().truffles,30);assert.equal(storage.getItem(S.BACKUP),backup);
  storage.setItem(S.KEY,'broken');storage.setItem(S.BACKUP,'broken');assert.equal(S.open({storage,now:T}).reason,'save-invalid');assert.equal(storage.getItem(S.KEY),'broken');
  storage.setItem(S.KEY,JSON.stringify({...pig().save(),version:99}));storage.setItem(S.BACKUP,backup);
  assert.equal(S.open({storage,now:T}).reason,'save-newer');assert.equal(JSON.parse(storage.getItem(S.KEY)).version,99);
});
test('导出导入完整替换、校验和、旧档防误覆盖与写冲突',()=>{
  const storage=new MemoryStorage(),a=open(storage).service,original=a.export();
  a.reward(study(),T+1000);const before=a.view().truffles;
  assert.equal(a.import(original,T+1000).reason,'import-older');assert.equal(a.view().truffles,before);
  const file=JSON.parse(a.export());file.payload=file.payload.replace('团子','猪猪');assert.equal(a.import(JSON.stringify(file),T+1000).reason,'save-invalid');
  const storage2=new MemoryStorage(),b=open(storage2,T+1000).service;
  assert.equal(b.import(a.export(),T+1000).ok,true);assert.equal(b.view().truffles,before);assert.equal(b.import(a.export(),T+1000).ok,true);assert.equal(b.view().truffles,before);
  const concurrent=open(storage,T+1000).service;
  a.dispatch({type:'rename',name:'甲'},T+1000);assert.equal(concurrent.dispatch({type:'rename',name:'乙'},T+1000).reason,'save-conflict');
  assert.equal(open(storage,T+1000).service.view().name,'甲');
});
test('事件订阅只接收两种结算、重复投递去重与取消订阅',()=>{
  const storage=new MemoryStorage(),service=open(storage).service,subs={},seen=[];
  const shell={on(type,fn){(subs[type]||(subs[type]=[])).push(fn);return ()=>subs[type]=subs[type].filter(f=>f!==fn);}};
  const off=service.bind(shell,{now:()=>T,onResult:r=>seen.push(r.reason)}),e=study();
  subs['study-session'].forEach(f=>f(e));subs['study-session'].forEach(f=>f(e));
  assert.deepEqual(seen,[null,'duplicate']);assert.equal(service.view().truffles,82);off();off();assert.equal(subs['study-session'].length,0);
  assert.equal(subs['look-change'],undefined);
});
test('浏览器直接加载、禁止核心偷读时钟和全局随机数',()=>{
  const ctx=vm.createContext({console});
  vm.runInContext('Date.now=()=>{throw Error("clock")}; Math.random=()=>{throw Error("rng")};',ctx);
  for(const file of ['catalog.js','pet-data.js','pet-rewards.js','pet-core.js','pet-store.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'app',file),'utf8'),ctx,{filename:file});
  const p=ctx.PigPet.create({now:T,seed:4});assert.equal(p.view().name,'团子');p.advance(T+H);p.dispatch({type:'pet'},T+H);
  p.reward(study(T+H),T+H);ctx.PigPet.restore(p.save()).advance(T+2*H);
  assert.equal(ctx.PigPetStore.decode(ctx.PigPetStore.encode(p.save())).version,1);
});
test('等级、属性、钱包与收据容量边界不产生虚假入账或重复领取',()=>{
  const save=rich(D.totalXpForLevel(100)).save();save.wallet.balance=D.limits.maxCoins;
  save.traits.knowledge=D.limits.maxTrait;
  const p=P.restore(save),r=p.reward(study(),T);
  assert.deepEqual(r.credited,{coins:0,xp:0,trait:0,walletApplied:0});assert.equal(p.view().xp.toNext,0);
  const full=pig().save();full.receipts=Array.from({length:D.limits.receipts},(_,i)=>({id:'full-'+i,at:T}));
  const q=P.restore(full);assert.equal(q.reward(game(),T).reason,'receipt-capacity');
  assert.equal(q.reward({...game(),eventId:'full-0'},T).reason,'duplicate');
  assert.equal(q.reward(game(T+DAY),T+DAY).ok,true);assert.equal(q.save().receipts.length,1);
  assert.equal(q.reward({...game(T),eventId:'full-0'},T+DAY).reason,'event-expired');
  const end=8640000000000000,last=pig({now:end});assert.equal(last.dispatch({type:'pet'},end).ok,true);P.validate(last.save());
});
test('结算与物品编号拒绝隐式字符串转换，非法输入不消耗钱或库存',()=>{
  const p=pig(),before=p.save();
  for(const id of [['snake'],new String('snake'),{toString:()=>{throw Error('coercion');}}]){
    assert.equal(p.reward(game(T,{id}),T).reason,'bad-event');assert.deepEqual(p.save(),before);
  }
  for(const extra of [{eventId:' '},{eventId:'bad\u007f'},{level:'   '}])assert.equal(p.reward(game(T,extra),T).reason,'bad-event');
  assert.equal(p.reward(study(T,{subject:'   '}),T).reason,'bad-event');
  const arr=Object.assign([],game());assert.equal(R.normalize(arr),null);
  for(const [type,item] of [['feed','apple'],['play','ball'],['buy','apple'],['place','straw-bed']]){
    for(const itemId of [[item],new String(item),{toString:()=>item}]){
      assert.equal(p.dispatch({type,itemId,slot:'bed'},T).ok,false);assert.deepEqual(p.save(),before);
    }
  }
});
test('文件封装后的大小也受限，超大导入不会损坏现有主档和备份',()=>{
  const save=pig().save();save.receipts=Array.from({length:D.limits.receipts},(_,i)=>({id:i+'"'.repeat(80),at:T}));
  const raw=JSON.stringify(save);assert.ok(raw.length<D.limits.saveBytes);P.validate(raw);
  assert.throws(()=>S.encode(save),e=>e.code==='save-invalid');
  const storage=new MemoryStorage(),service=open(storage).service,before=service.save(),disk=new Map(storage.values);
  assert.equal(service.import(raw,T).reason,'storage-write');assert.deepEqual(service.save(),before);assert.deepEqual(storage.values,disk);
  save.receipts=save.receipts.slice(0,512);assert.deepEqual(S.decode(S.encode(save)),save);
  const validated=P.validate(save);validated.needs.energy=20;validated.receipts[0].id='changed';
  assert.equal(save.needs.energy,80);assert.notEqual(save.receipts[0].id,'changed');
});
test('写入后的读取故障可确认原结果，重试不重发奖励或重扣购物款',()=>{
  for(const kind of ['reward','buy']){
    const storage=new FaultStorage(),service=open(storage).service,before=service.save();
    const input=kind==='reward'?study():{type:'buy',itemId:'apple',quantity:2};
    const invoke=now=>kind==='reward'?service.reward(input,now):service.dispatch(input,now);
    storage.failAfterWrite=S.KEY;const failed=invoke(T);assert.equal(failed.reason,'storage-read');
    assert.equal(failed.persisted,false);assert.deepEqual(failed.events,[]);assert.deepEqual(service.save(),before);
    const saved=S.decode(storage.getItem(S.KEY));
    const reordered=Object.fromEntries(Object.entries(input).reverse());
    const retried=kind==='reward'?service.reward(reordered,T+1000):service.dispatch(reordered,T+1000);
    assert.equal(retried.ok,true);assert.equal(retried.reconciled,true);assert.equal(retried.persisted,true);
    assert.deepEqual(service.save(),saved);assert.equal(retried.events.filter(e=>e.type===kind).length,1);
    assert.equal(service.view().truffles,kind==='reward'?82:22);
    assert.equal(open(storage,T+1000).service.view().truffles,kind==='reward'?82:22);
  }
});
test('未确认的导入可重试；下一项不同操作从已落盘结果继续',()=>{
  const storage=new FaultStorage(),service=open(storage).service,source=pig();source.reward(study(),T);
  const raw=S.encode(source.save());storage.failAfterWrite=S.KEY;
  assert.equal(service.import(raw,T).reason,'storage-read');
  const imported=service.import(raw,T+1000);assert.equal(imported.reconciled,true);assert.equal(service.view().truffles,82);
  const e=study(T+1000);storage.failAfterWrite=S.KEY;assert.equal(service.reward(e,T+1000).reason,'storage-read');
  assert.equal(service.dispatch({type:'buy',itemId:'apple'},T+2000).ok,true);assert.equal(service.view().truffles,130);
  assert.equal(service.reward(e,T+2000).reason,'duplicate');assert.equal(S.decode(storage.getItem(S.KEY)).wallet.balance,130);
});
test('没有实际写入的事务可以重试，坏备份写入不会替换主档',()=>{
  const storage=new FaultStorage(),service=open(storage).service,e=study(),before=service.save();
  storage.drop=S.KEY;assert.equal(service.reward(e,T).reason,'storage-write');assert.deepEqual(service.save(),before);
  storage.drop=null;assert.equal(service.reward(e,T).ok,true);assert.equal(service.view().truffles,82);
  const main=storage.getItem(S.KEY);storage.drop=S.BACKUP;
  assert.equal(service.dispatch({type:'rename',name:'团团'},T).reason,'storage-write');assert.equal(storage.getItem(S.KEY),main);
  assert.equal(service.view().name,'团子');storage.drop=null;
  assert.equal(service.dispatch({type:'rename',name:'团团'},T).ok,true);
  assert.equal(S.decode(storage.getItem(S.BACKUP)).wallet.balance,82);
  storage.setItem(S.KEY,'broken');assert.equal(open(storage).service.view().truffles,82);
});
test('确认失败期间有外部更新仍报冲突，空操作也不会掩盖旧窗口状态',()=>{
  const storage=new FaultStorage(),a=open(storage).service,e=study();storage.failAfterWrite=S.KEY;
  assert.equal(a.reward(e,T).reason,'storage-read');const b=open(storage).service;
  b.dispatch({type:'rename',name:'另一个窗口'},T);const disk=new Map(storage.values);
  assert.equal(a.reward(e,T).reason,'save-conflict');assert.deepEqual(storage.values,disk);
  const old=open(storage).service;b.dispatch({type:'rename',name:'最新名字'},T);
  assert.equal(old.dispatch({type:'rename',name:'另一个窗口'},T).reason,'save-conflict');
  assert.equal(old.advance(T).reason,'save-conflict');
  assert.equal(open(storage).service.view().name,'最新名字');
});
test('备份期间发生外部写入时，提交前再次检查主档',()=>{
  const storage=new FaultStorage(),service=open(storage).service,other=pig();other.dispatch({type:'rename',name:'外部进度'},T);
  const raw=S.encode(other.save());storage.afterBackup=()=>storage.values.set(S.KEY,raw);
  assert.equal(service.reward(study(),T).reason,'save-conflict');assert.equal(storage.getItem(S.KEY),raw);
  assert.equal(service.view().truffles,30);
});
test('整月模拟：无负余额、无溢出、上限有效、随时可存取',()=>{
  const storage=new MemoryStorage();let service=open(storage).service;
  for(let hour=1;hour<=31*24;hour++){
    const now=T+hour*H;service.advance(now);
    service.dispatch({type:'feed',itemId:'grass'},now);service.dispatch({type:'pet'},now);service.dispatch({type:'wash'},now);
    if(hour%4===0)service.dispatch({type:'sleep'},now);
    service.reward(study(now),now);service.reward(game(now,{id:'doudizhu',win:hour%2===0,truffleDelta:hour%2===0?20:-13}),now);
    for(const task of service.view().tasks)if(task.done&&!task.claimed)service.dispatch({type:'claim',taskId:task.id},now);
    const v=service.view();assert.ok(v.truffles>=0&&v.truffles<=D.limits.maxCoins);
    for(const n of Object.values(v.needs))assert.ok(Number.isFinite(n)&&n>=15&&n<=100);
    assert.ok(v.daily.game.coins<=120&&v.daily.study.coins<=360&&v.daily.careXp<=40);P.validate(service.save());
    if(hour%24===0)service=open(storage,now).service;
  }
  assert.equal(service.view().stage,'adult');assert.ok(service.view().diary.length<=160);assert.ok(service.save().receipts.length<=4096);
});
console.log('pet tests passed:',groups,'groups');
