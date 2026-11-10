/* One-pig simulation. All time is supplied; the saved PRNG makes restore reproducible. */
(function(root) {
  'use strict';
  const common=typeof module!=='undefined'&&module.exports;
  const D=common?require('./pet-data.js'):root.PigPetData;
  const R=common?require('./pet-rewards.js'):root.PigPetRewards;
  const C=root.PigCatalog, copy=v=>JSON.parse(JSON.stringify(v));
  const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
  const int=(v,a,b)=>Number.isSafeInteger(v)&&v>=a&&v<=b;
  const num=(v,a,b)=>typeof v==='number'&&Number.isFinite(v)&&v>=a&&v<=b;
  const time=v=>int(v,0,8640000000000000);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const nameOK=v=>typeof v==='string'&&v.trim()===v&&v.length>0&&[...v].length<=16&&!/[<>\u0000-\u001f\u007f]/.test(v);
  const fail=code=>{const e=new Error(D.reasons[code]||code);e.code=code;throw e;};
  const counters=()=>({coins:0,xp:0,trait:0});
  const games=C.GAMES.filter(g=>g.cat!=='study').map(g=>g.id);
  const maxXp=D.totalXpForLevel(D.limits.maxLevel);
  function levelOf(xp){let n=1;while(n<D.limits.maxLevel&&xp>=D.totalXpForLevel(n+1))n++;return n;}
  function random(s){s.rngState=(Math.imul(s.rngState,1664525)+1013904223)>>>0;return s.rngState/4294967296;}
  function daily(s,day) {
    return {day,game:counters(),study:counters(),careXp:0,progress:{care:0,answered:0,correct:0},claims:[],
      wish:{game:games[Math.floor(random(s)*games.length)],done:false}};
  }
  function accessible(s,item){return levelOf(s.xp)>=item.level&&(!item.trait||s.traits[item.trait]>=item.minimum);}
  function diary(s,events,type,detail) {
    const entry={at:s.lastNow,type,...detail};s.diary.push(entry);
    if(s.diary.length>D.limits.diary)s.diary.shift();
    events.push({type:'diary',entry:copy(entry)});
  }
  function unlock(s,events) {
    for(const item of D.items)if(accessible(s,item)&&!s.unlocked.includes(item.id)){
      s.unlocked.push(item.id);events.push({type:'unlock',itemId:item.id});
    }
  }
  function xp(s,amount,source,events) {
    const before=levelOf(s.xp),old=s.xp;s.xp=Math.min(maxXp,s.xp+amount);
    if(s.xp!==old)events.push({type:'xp',amount:s.xp-old,total:s.xp,source});
    const after=levelOf(s.xp);
    for(let level=before+1;level<=after;level++){
      events.push({type:'level-up',level});
      const stage=D.stageForLevel(level);
      if(stage.level===level){events.push({type:'stage-up',stage:stage.id,level});diary(s,events,'stage-up',{stage:stage.id,level});}
    }
    unlock(s,events);
  }
  function coins(s,delta,source,events) {
    const before=s.wallet.balance;
    s.wallet.balance=clamp(before+delta,0,D.limits.maxCoins);
    const applied=s.wallet.balance-before;
    if(applied)events.push({type:'truffle',source,amount:applied,requested:delta,balance:s.wallet.balance});
    return applied;
  }
  function progress(s,key,amount,events) {
    const before=s.daily.progress[key];s.daily.progress[key]=Math.min(1000000,before+amount);
    for(const task of D.tasks)if(task.metric===key&&before<task.target&&s.daily.progress[key]>=task.target)
      events.push({type:'task-done',taskId:task.id,day:s.daily.day});
  }
  function care(s,events) {
    const amount=Math.min(D.rewards.care.xp,D.rewards.care.dailyXp-s.daily.careXp,maxXp-s.xp);
    s.daily.careXp+=amount;xp(s,amount,'care',events);progress(s,'care',1,events);
  }
  function grant(s,source,amounts,events) {
    const used=s.daily[source],limit=D.rewards[source].daily,actual={};
    for(const key of ['coins','xp','trait']){
      const requested=amounts[key]||0;
      const room=key==='coins'?D.limits.maxCoins-s.wallet.balance:key==='xp'?maxXp-s.xp:
        amounts.traitId?D.limits.maxTrait-s.traits[amounts.traitId]:0;
      actual[key]=Math.min(requested,limit[key]-used[key],room);used[key]+=actual[key];
    }
    coins(s,actual.coins,source,events);xp(s,actual.xp,source,events);
    if(actual.trait&&amounts.traitId){
      const id=amounts.traitId,before=s.traits[id];
      s.traits[id]=Math.min(D.limits.maxTrait,before+actual.trait);
      if(s.traits[id]!==before)events.push({type:'trait',id,amount:s.traits[id]-before,total:s.traits[id],source});
      unlock(s,events);
    }
    return actual;
  }
  function tick(s,now,events) {
    if(!time(now))return 'bad-time';
    if(now<s.lastNow)return 'clock-backward';
    const gap=now-s.lastNow,dt=Math.min(gap,D.limits.offlineMs),before={...s.needs};
    s.lastNow=now;
    for(const key of ['hunger','mood','clean'])s.needs[key]=Math.max(D.limits.needFloor,s.needs[key]-dt*100/(D.needs[key].hours*D.HOUR));
    if(s.sleeping){
      const toFull=(100-s.needs.energy)*D.sleepHours*D.HOUR/100;
      if(dt>=toFull){
        s.sleeping=false;s.needs.energy=Math.max(D.limits.needFloor,100-(dt-toFull)*100/(D.needs.energy.hours*D.HOUR));
        events.push({type:'wake',automatic:true});
      }else s.needs.energy+=dt*100/(D.sleepHours*D.HOUR);
    }else s.needs.energy=Math.max(D.limits.needFloor,s.needs.energy-dt*100/(D.needs.energy.hours*D.HOUR));
    for(const key of Object.keys(D.needs))if(before[key]>=30&&s.needs[key]<30)events.push({type:'need',id:key,value:s.needs[key]});
    const day=D.day(now,s.timezoneMinutes);
    if(day>s.daily.day){
      s.daily=daily(s,day);events.push({type:'wish-new',day,game:s.daily.wish.game});
      // Evicted receipts cannot be replayed: advancing this floor rejects all older events.
      s.receiptFloor=Math.max(s.receiptFloor,now-D.limits.receiptAgeMs);
      s.receipts=s.receipts.filter(r=>r.at>=s.receiptFloor);
    }
    if(gap>D.limits.offlineMs)events.push({type:'offline-cap',elapsedMs:gap,appliedMs:dt});
    return null;
  }
  function create(options) {
    const o=options||{};if(!time(o.now))fail('bad-time');
    const name=o.name===undefined?D.defaults.name:o.name;if(!nameOK(name))fail('bad-action');
    const timezoneMinutes=o.timezoneMinutes===undefined?D.defaults.timezoneMinutes:o.timezoneMinutes;
    if(!int(timezoneMinutes,-720,840))fail('bad-action');
    let seed=o.seed;
    if(seed===undefined&&o.rng!==undefined){if(typeof o.rng!=='function')fail('bad-action');const n=o.rng();if(!num(n,0,1)||n===1)fail('bad-action');seed=Math.floor(n*4294967296);}
    if(seed===undefined)seed=(o.now^0x51f15e)>>>0;
    if(!int(seed,0,4294967295))fail('bad-action');
    const legacy=o.legacy||{};
    if(!object(legacy)||legacy.truffles!==undefined&&!int(legacy.truffles,-D.limits.maxCoins,D.limits.maxCoins))fail('bad-action');
    const oldPlayer=legacy.oldPlayer===true,oldBalance=legacy.truffles||0;
    const s={format:D.FORMAT,version:D.SAVE_VERSION,revision:0,name,createdAt:o.now,lastNow:o.now,timezoneMinutes,rngState:seed,
      xp:0,needs:{hunger:75,mood:80,clean:90,energy:80},sleeping:false,cooldowns:{},pokeCount:0,
      traits:Object.fromEntries(Object.keys(D.traits).map(k=>[k,0])),
      wallet:{balance:Math.min(D.limits.maxCoins,Math.max(0,oldBalance)+D.defaults.coins+(oldPlayer?D.defaults.oldPlayerGift:0)),
        ddzNet:0,forgiven:Math.max(0,-oldBalance)},
      legacy:{migrated:true,truffles:oldBalance,oldPlayer},inventory:{apple:3,carrot:2},
      owned:D.items.filter(i=>i.starter).map(i=>i.id),placements:{bowl:'food-bowl',bed:'straw-bed',toys:null,wall:null,window:null,yard:null},
      look:{skin:D.looks.includes(legacy.look)?legacy.look:'peach',accessory:D.accessories.includes(legacy.acc)?legacy.acc:'none',costume:'none'},
      unlocked:[],receipts:[],receiptFloor:0,diary:[]};
    s.daily=daily(s,D.day(o.now,timezoneMinutes));unlock(s,[]);
    s.diary.push({at:o.now,type:'welcome',oldPlayer,truffles:s.wallet.balance});
    return session(s);
  }
  function validate(input) {
    let s;
    try{
      const json=typeof input==='string'?input:JSON.stringify(input);
      if(typeof json!=='string'||json.length>D.limits.saveBytes)fail('save-invalid');
      s=JSON.parse(json);
    }catch(e){fail('save-invalid');}
    if(object(s)&&s.format===D.FORMAT&&Number.isInteger(s.version)&&s.version>D.SAVE_VERSION)fail('save-newer');
    const bad=()=>fail('save-invalid');
    if(!object(s)||s.format!==D.FORMAT||s.version!==D.SAVE_VERSION||!nameOK(s.name)||
      !time(s.createdAt)||!time(s.lastNow)||s.lastNow<s.createdAt||!int(s.revision,0,Number.MAX_SAFE_INTEGER-1000)||
      !int(s.timezoneMinutes,-720,840)||!int(s.rngState,0,4294967295)||!int(s.xp,0,maxXp)||typeof s.sleeping!=='boolean')bad();
    if(!object(s.needs)||!Object.keys(D.needs).every(k=>num(s.needs[k],D.limits.needFloor,100))||Object.keys(s.needs).length!==4)bad();
    if(!object(s.traits)||!Object.keys(D.traits).every(k=>int(s.traits[k],0,D.limits.maxTrait))||Object.keys(s.traits).length!==5)bad();
    if(!object(s.wallet)||!int(s.wallet.balance,0,D.limits.maxCoins)||!int(s.wallet.ddzNet,-Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER)||!int(s.wallet.forgiven,0,Number.MAX_SAFE_INTEGER))bad();
    if(!object(s.legacy)||s.legacy.migrated!==true||!int(s.legacy.truffles,-D.limits.maxCoins,D.limits.maxCoins)||typeof s.legacy.oldPlayer!=='boolean')bad();
    if(!object(s.cooldowns)||Object.entries(s.cooldowns).some(([k,v])=>!own(D.cooldowns,k)||!time(v))||!int(s.pokeCount,0,100))bad();
    if(!object(s.inventory)||Object.entries(s.inventory).some(([k,v])=>!own(D.byId,k)||D.byId[k].kind!=='food'||D.byId[k].renewable||!int(v,0,D.limits.inventory)))bad();
    const ids=a=>Array.isArray(a)&&new Set(a).size===a.length&&a.every(id=>typeof id==='string'&&own(D.byId,id));
    if(!ids(s.owned)||s.owned.some(id=>D.byId[id].kind==='food')||!D.items.filter(i=>i.starter).every(i=>s.owned.includes(i.id))||!ids(s.unlocked)||s.unlocked.some(id=>!accessible(s,D.byId[id])))bad();
    if(!object(s.placements)||Object.keys(s.placements).length!==D.slots.length||!D.slots.every(slot=>own(s.placements,slot)&&
      (s.placements[slot]===null||s.owned.includes(s.placements[slot])&&D.byId[s.placements[slot]].slot===slot)))bad();
    if(!object(s.look)||!D.looks.includes(s.look.skin)||!D.costumes.includes(s.look.costume)||
      !(D.accessories.includes(s.look.accessory)||s.owned.includes(s.look.accessory)&&D.byId[s.look.accessory].kind==='accessory'))bad();
    const d=s.daily;
    if(!object(d)||d.day!==D.day(s.lastNow,s.timezoneMinutes)||!int(d.careXp,0,D.rewards.care.dailyXp)||
      !object(d.progress)||!['care','answered','correct'].every(k=>int(d.progress[k],0,1000000))||d.progress.correct>d.progress.answered||
      !object(d.wish)||!games.includes(d.wish.game)||typeof d.wish.done!=='boolean'||
      !Array.isArray(d.claims)||new Set(d.claims).size!==d.claims.length||d.claims.some(id=>!D.tasks.some(t=>t.id===id&&d.progress[t.metric]>=t.target)))bad();
    for(const source of ['game','study'])if(!object(d[source])||!['coins','xp','trait'].every(k=>int(d[source][k],0,D.rewards[source].daily[k])))bad();
    if(!time(s.receiptFloor)||s.receiptFloor>s.lastNow||!Array.isArray(s.receipts)||s.receipts.length>D.limits.receipts||
      s.receipts.some(r=>!object(r)||typeof r.id!=='string'||!r.id.length||r.id.length>160||!time(r.at)||r.at<s.receiptFloor||r.at>s.lastNow+D.limits.futureEventMs)||new Set(s.receipts.map(r=>r.id)).size!==s.receipts.length)bad();
    if(!Array.isArray(s.diary)||s.diary.length>D.limits.diary||s.diary.some(e=>!object(e)||!time(e.at)||e.at>s.lastNow||typeof e.type!=='string'||e.type.length>40))bad();
    return s;
  }
  function session(initial) {
    let s=initial;
    function transaction(now,fn) {
      const events=[],before=JSON.stringify(s),reason=tick(s,now,events);
      if(reason)return {ok:false,reason,events:[],revision:s.revision};
      let result={ok:true,reason:null};
      if(fn){const r=fn(events);if(r)result={...result,...r};}
      if(!result.ok)events.push({type:'refuse',reason:result.reason});
      if(JSON.stringify(s)!==before)s.revision++;
      return {...result,events,revision:s.revision};
    }
    const denied=reason=>({ok:false,reason});
    function dispatch(a,now) {
      return transaction(now,events=>{
        if(!object(a)||typeof a.type!=='string')return denied('bad-action');
        const type=a.type;
        const cooled=k=>(s.cooldowns[k]||0)>now;
        const cool=(k,ms)=>{s.cooldowns[k]=Math.min(8640000000000000,now+(ms===undefined?D.cooldowns[k]:ms));};
        if(['feed','pet','poke','wash','play'].includes(type)&&s.sleeping)return denied('sleeping');
        if(type==='rename'){
          if(!nameOK(a.name))return denied('bad-action');
          if(a.name===s.name)return null;
          s.name=a.name;events.push({type:'rename',name:s.name});return null;
        }
        if(type==='feed'){
          const item=own(D.byId,a.itemId)?D.byId[a.itemId]:null;
          if(!item||item.kind!=='food')return denied('bad-action');
          if(s.needs.hunger>=95)return denied('too-full');
          if(cooled('feed')||item.renewable&&cooled('grass'))return denied('cooldown');
          if(!item.renewable&&!(s.inventory[item.id]>0))return denied('not-enough');
          if(!item.renewable)s.inventory[item.id]--;else cool('grass');
          s.needs.hunger=Math.min(100,s.needs.hunger+item.hunger);s.needs.mood=Math.min(100,s.needs.mood+item.mood);
          cool('feed');events.push({type:'feed',itemId:item.id});care(s,events);return null;
        }
        if(type==='pet'){
          if(cooled('pet'))return denied('cooldown');
          s.needs.mood=Math.min(100,s.needs.mood+8);s.pokeCount=0;cool('pet');events.push({type:'pet'});care(s,events);return null;
        }
        if(type==='poke'){
          if(cooled('poke'))return denied('cooldown');
          if(now>(s.cooldowns.poke||0)+10000)s.pokeCount=0;
          s.pokeCount=Math.min(100,s.pokeCount+1);cool('poke');
          if(s.pokeCount>=3)s.needs.mood=Math.max(D.limits.needFloor,s.needs.mood-3);
          events.push({type:'poke',annoyed:s.pokeCount>=3});return null;
        }
        if(type==='wash'){
          if(s.needs.clean>=95)return denied('already-clean');
          if(cooled('wash'))return denied('cooldown');
          s.needs.clean=Math.min(100,s.needs.clean+50);s.needs.mood=Math.min(100,s.needs.mood+4);
          cool('wash');events.push({type:'wash'});care(s,events);return null;
        }
        if(type==='sleep'){
          if(s.sleeping)return denied('sleeping');if(s.needs.energy>=95)return denied('not-tired');
          s.sleeping=true;events.push({type:'sleep'});return null;
        }
        if(type==='wake'){
          if(!s.sleeping)return denied('not-sleeping');s.sleeping=false;events.push({type:'wake',automatic:false});return null;
        }
        if(type==='play'){
          const item=own(D.byId,a.itemId)?D.byId[a.itemId]:null;
          if(!item||item.kind!=='toy')return denied('bad-action');if(!s.owned.includes(item.id))return denied('not-owned');
          if(s.needs.energy-item.energy<D.limits.needFloor)return denied('too-tired');if(cooled('play'))return denied('cooldown');
          s.needs.energy-=item.energy;s.needs.mood=Math.min(100,s.needs.mood+item.mood);s.needs.clean=Math.max(D.limits.needFloor,s.needs.clean-2);
          cool('play');events.push({type:'play',itemId:item.id});care(s,events);return null;
        }
        if(type==='buy'){
          const item=own(D.byId,a.itemId)?D.byId[a.itemId]:null,quantity=a.quantity===undefined?1:a.quantity;
          if(!item||item.renewable||item.starter||!int(quantity,1,99)||item.kind!=='food'&&quantity!==1)return denied('bad-action');
          if(!accessible(s,item))return denied('locked');
          if(item.kind!=='food'&&s.owned.includes(item.id))return denied('already-owned');
          if(item.kind==='food'&&(s.inventory[item.id]||0)+quantity>D.limits.inventory)return denied('inventory-full');
          const cost=quantity*item.price;if(s.wallet.balance<cost)return denied('no-money');
          coins(s,-cost,'buy',events);
          if(item.kind==='food')s.inventory[item.id]=(s.inventory[item.id]||0)+quantity;else s.owned.push(item.id);
          events.push({type:'buy',itemId:item.id,quantity,cost});return null;
        }
        if(type==='place'){
          if(!D.slots.includes(a.slot))return denied('bad-action');
          if(a.itemId!==null){const item=own(D.byId,a.itemId)?D.byId[a.itemId]:null;
            if(!item||item.kind!=='furniture'||item.slot!==a.slot)return denied('wrong-slot');
            if(!s.owned.includes(item.id))return denied('not-owned');}
          s.placements[a.slot]=a.itemId;events.push({type:'place',slot:a.slot,itemId:a.itemId});return null;
        }
        if(type==='wear'){
          if(!['skin','accessory','costume'].includes(a.slot)||typeof a.itemId!=='string')return denied('bad-action');
          const allowed=a.slot==='skin'?D.looks:a.slot==='costume'?D.costumes:D.accessories;
          if(!allowed.includes(a.itemId)&&!(a.slot==='accessory'&&s.owned.includes(a.itemId)&&D.byId[a.itemId].kind==='accessory'))return denied('not-owned');
          s.look[a.slot]=a.itemId;events.push({type:'wear',slot:a.slot,itemId:a.itemId});return null;
        }
        if(type==='claim'){
          const task=D.tasks.find(t=>t.id===a.taskId);if(!task)return denied('bad-action');
          if(s.daily.claims.includes(task.id))return denied('already-claimed');
          if(s.daily.progress[task.metric]<task.target)return denied('task-not-ready');
          s.daily.claims.push(task.id);
          const source=task.metric==='care'?'game':'study',credited=grant(s,source,{coins:task.coins,xp:task.xp},events);
          events.push({type:'claim',taskId:task.id,day:s.daily.day,...credited});return {credited};
        }
        return denied('bad-action');
      });
    }
    function reward(input,now) {
      return transaction(now,events=>{
        const q=R.quote(input,{wishGame:s.daily.wish.game,wishDone:s.daily.wish.done});
        if(!q.ok)return denied(q.reason);
        const e=q.event;
        if(s.receipts.some(r=>r.id===e.eventId))return denied('duplicate');
        if(e.at<s.receiptFloor||e.at<now-D.limits.receiptAgeMs||D.day(e.at,s.timezoneMinutes)!==s.daily.day)return denied('event-expired');
        if(e.at>now+D.limits.futureEventMs)return denied('event-future');
        if(s.receipts.length>=D.limits.receipts){
          const start=s.daily.day*D.DAY-s.timezoneMinutes*60000;
          s.receiptFloor=Math.max(s.receiptFloor,start);s.receipts=s.receipts.filter(r=>r.at>=s.receiptFloor);
          if(s.receipts.length>=D.limits.receipts)return denied('receipt-capacity');
        }
        s.receipts.push({id:e.eventId,at:e.at});
        let walletApplied=0;
        if(e.id==='doudizhu'){
          // DDZ winnings share the game allowance; losses never replenish it.
          const delta=q.walletDelta>0?Math.min(q.walletDelta,D.rewards.game.daily.coins-s.daily.game.coins,D.limits.maxCoins-s.wallet.balance):q.walletDelta;
          if(delta>0)s.daily.game.coins+=delta;
          walletApplied=coins(s,delta,'doudizhu',events);
          s.wallet.ddzNet=clamp(s.wallet.ddzNet+walletApplied,-Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER);
          if(q.walletDelta<0)s.wallet.forgiven=Math.min(Number.MAX_SAFE_INTEGER,s.wallet.forgiven+walletApplied-q.walletDelta);
        }
        const credited=grant(s,q.source,q,events);
        if(q.wish){s.daily.wish.done=true;s.needs.mood=Math.min(100,s.needs.mood+D.rewards.wish.mood);
          events.push({type:'wish-done',game:e.id,day:s.daily.day});diary(s,events,'wish-done',{game:e.id});}
        if(q.eligible){
          if(q.source==='study'){progress(s,'answered',q.answered,events);progress(s,'correct',q.correct,events);}
          else s.needs.mood=Math.min(100,s.needs.mood+2);
        }
        events.push({type:'reward',eventId:e.eventId,source:q.source,eligible:q.eligible,...credited,walletApplied});
        return {credited:{...credited,walletApplied},eligible:q.eligible};
      });
    }
    function view() {
      const level=levelOf(s.xp),next=level<D.limits.maxLevel?D.totalXpForLevel(level+1):null;
      const status=s.sleeping?'sleeping':s.needs.energy<30?'tired':s.needs.hunger<30?'hungry':s.needs.clean<30?'dirty':s.needs.mood<30?'grumpy':'idle';
      return copy({apiVersion:D.API_VERSION,revision:s.revision,name:s.name,petCount:1,level,stage:D.stageForLevel(level).id,
        xp:{total:s.xp,inLevel:s.xp-D.totalXpForLevel(level),toNext:next===null?0:next-s.xp},
        needs:s.needs,status,sleeping:s.sleeping,traits:s.traits,truffles:s.wallet.balance,wallet:s.wallet,
        inventory:s.inventory,owned:s.owned,placements:s.placements,look:s.look,unlocked:s.unlocked,
        wardrobe:{skins:D.looks,accessories:[...D.accessories,...s.owned.filter(id=>D.byId[id].kind==='accessory')],costumes:D.costumes},
        wish:s.daily.wish,tasks:D.tasks.map(t=>({...t,progress:Math.min(t.target,s.daily.progress[t.metric]),
          done:s.daily.progress[t.metric]>=t.target,claimed:s.daily.claims.includes(t.id)})),
        daily:{...s.daily,limits:{game:D.rewards.game.daily,study:D.rewards.study.daily,careXp:D.rewards.care.dailyXp}},
        cooldowns:s.cooldowns,diary:s.diary,lastNow:s.lastNow,timezoneMinutes:s.timezoneMinutes});
    }
    return Object.freeze({advance:now=>transaction(now),view,dispatch,reward,save:()=>copy(s)});
  }
  const api=Object.freeze({create,restore:input=>session(validate(input)),validate:input=>copy(validate(input)),levelOf});
  if(common)module.exports=api;
  root.PigPet=api;
})(typeof window!=='undefined'?window:globalThis);
