/* Transactional, injected-storage facade. Importing this module has no side effects. */
(function(root) {
  'use strict';
  const common=typeof module!=='undefined'&&module.exports;
  const P=common?require('./pet-core.js'):root.PigPet;
  const D=common?require('./pet-data.js'):root.PigPetData;
  const KEY='piggy2-pet', BACKUP=KEY+'-bak';
  function error(code){const e=new Error(D.reasons[code]||code);e.code=code;return e;}
  function checksum(text){let n=2166136261;for(let i=0;i<text.length;i++){n^=text.charCodeAt(i);n=Math.imul(n,16777619);}return (n>>>0).toString(16).padStart(8,'0');}
  function encode(save){
    const payload=JSON.stringify(P.validate(save));
    const raw=JSON.stringify({format:'piggy-pet-file',version:1,checksum:checksum(payload),payload});
    // Escaping the payload can nearly double its size. Never write a file decode rejects.
    if(raw.length>D.limits.saveBytes)throw error('save-invalid');
    return raw;
  }
  function decode(raw){
    if(typeof raw!=='string'||raw.length>D.limits.saveBytes)throw error('save-invalid');
    let file;try{file=JSON.parse(raw);}catch(e){throw error('save-invalid');}
    if(file&&file.format===D.FORMAT)return P.validate(file);
    if(file&&file.format==='piggy-pet-file'&&file.version>1)throw error('save-newer');
    if(!file||file.format!=='piggy-pet-file'||file.version!==1||typeof file.payload!=='string'||checksum(file.payload)!==file.checksum)throw error('save-invalid');
    return P.validate(file.payload);
  }
  function read(storage,key){try{return storage.getItem(key);}catch(e){throw error('storage-read');}}
  function commandKey(method,input){
    // Equivalent retry parameters may have been reconstructed in another key order.
    return JSON.stringify([method,input],(key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?
      Object.fromEntries(Object.keys(value).sort().map(k=>[k,value[k]])):value);
  }
  function legacy(storage){
    function value(key,fallback){const raw=read(storage,'piggy2-'+key);if(raw===null)return fallback;try{return JSON.parse(raw);}catch(e){throw error('save-invalid');}}
    const balance=value('ddz-truffles',0),stats=value('play-stats',{});
    if(!Number.isSafeInteger(balance)||Math.abs(balance)>D.limits.maxCoins)throw error('save-invalid');
    return {truffles:balance,oldPlayer:balance!==0||!!(stats&&typeof stats==='object'&&Object.values(stats).some(s=>s&&Number.isSafeInteger(s.n)&&s.n>0)),
      look:value('look','peach'),acc:value('acc','none')};
  }
  function open(options){
    const o=options||{},storage=o.storage;
    if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function')return {ok:false,reason:'storage-read',events:[]};
    let pet,seenMain,lastGoodRaw,created=false,recovered=false;
    try{
      seenMain=read(storage,KEY);const backup=read(storage,BACKUP);
      if(seenMain===null&&backup===null){
        pet=P.create({name:o.name,now:o.now,seed:o.seed,rng:o.rng,timezoneMinutes:o.timezoneMinutes,legacy:legacy(storage)});created=true;lastGoodRaw=null;
      }else{
        let firstError;
        if(seenMain!==null){try{pet=P.restore(decode(seenMain));lastGoodRaw=seenMain;}catch(e){firstError=e;if(e.code==='save-newer')throw e;}}
        if(!pet&&backup!==null){pet=P.restore(decode(backup));lastGoodRaw=backup;recovered=true;}
        if(!pet)throw firstError||error('save-invalid');
      }
    }catch(e){return {ok:false,reason:e.code||'save-invalid',events:[]};}
    let committed=pet.save(),pending=null;
    const failure=reason=>({ok:false,reason,events:[],revision:committed.revision,persisted:false});
    function adopt(write){
      seenMain=write.encoded;lastGoodRaw=write.encoded;pet=write.candidate;committed=write.save;pending=null;
    }
    function synchronize(command,now){
      let raw;
      try{raw=read(storage,KEY);}catch(e){return failure(e.code);}
      // A completed setItem may be followed by a failed verification read. Confirm only
      // our exact candidate; an unrelated writer must still cause a conflict.
      if(pending&&raw===pending.encoded){
        const confirmed=pending;adopt(confirmed);
        if(confirmed.command===command&&Number.isSafeInteger(now)&&now>=committed.lastNow&&now<=8640000000000000)
          return {...confirmed.result,persisted:true,reconciled:true};
      }else if(raw!==seenMain)return failure('save-conflict');
      else pending=null;
      return null;
    }
    function persist(candidate,command,result){
      let write;
      try{
        if(read(storage,KEY)!==seenMain)return 'save-conflict';
        const save=candidate.save(),encoded=encode(save);
        if(lastGoodRaw!==null){
          storage.setItem(BACKUP,lastGoodRaw);
          if(read(storage,BACKUP)!==lastGoodRaw)return 'storage-write';
        }
        if(read(storage,KEY)!==seenMain)return 'save-conflict';
        write={candidate,save,encoded,command,result};pending=write;
        storage.setItem(KEY,encoded);
        if(read(storage,KEY)!==encoded)return 'storage-write';
      }catch(e){return e.code==='storage-read'?'storage-read':'storage-write';}
      adopt(write);return null;
    }
    function run(method,args){
      let command;
      try{command=commandKey(method,args[0]);}catch(e){return failure(method==='reward'?'bad-event':'bad-action');}
      const checked=synchronize(command,args[method==='advance'?0:1]);if(checked)return checked;
      const candidate=P.restore(committed);let result;
      try{result=candidate[method](...args);}catch(e){return failure(e.code||'bad-action');}
      if(result.revision===committed.revision)return {...result,persisted:true};
      const reason=persist(candidate,command,result);
      return reason?failure(reason):{...result,persisted:true};
    }
    const startup=pet.advance(o.now);
    if(startup.reason==='bad-time')return {ok:false,reason:'bad-time',events:[]};
    // A backward clock may still load the pet, but cannot change it or grant rewards.
    if(created||recovered||startup.revision!==committed.revision){
      const reason=persist(pet);if(reason)return {ok:false,reason,events:[]};
    }
    const service={
      view:()=>pet.view(),save:()=>pet.save(),export:()=>encode(pet.save()),
      advance:now=>run('advance',[now]),dispatch:(action,now)=>run('dispatch',[action,now]),reward:(event,now)=>run('reward',[event,now]),
      import(raw,now,options){
        if(typeof raw!=='string')return failure('save-invalid');
        const command=JSON.stringify(['import',raw,!!(options&&options.allowOlder===true)]);
        const checked=synchronize(command,now);if(checked)return checked;
        let candidate;
        try{candidate=P.restore(decode(raw));}catch(e){return failure(e.code||'bad-import');}
        const before=committed,incoming=candidate.save();
        // Import is a complete replacement, never an additive gift or wallet merge.
        if(!(options&&options.allowOlder===true)&&(incoming.lastNow<before.lastNow||incoming.lastNow===before.lastNow&&incoming.revision<before.revision))return failure('import-older');
        const advanced=candidate.advance(now);
        if(!advanced.ok)return {...advanced,persisted:false};
        const result={ok:true,reason:null,events:[...advanced.events,{type:'import'}],revision:advanced.revision};
        const reason=persist(candidate,command,result);
        return reason?failure(reason):{...result,persisted:true};
      },
      bind(shell,options){
        const opts=options||{};
        if(!shell||typeof shell.on!=='function'||typeof opts.now!=='function')throw error('bad-action');
        let active=true;
        const receive=event=>{
          if(!active)return;
          const result=service.reward(event,opts.now());
          if(typeof opts.onResult==='function')opts.onResult(result,event);
        };
        const offs=['game-end','study-session'].map(type=>shell.on(type,receive));
        return ()=>{if(!active)return;active=false;offs.forEach(off=>{if(typeof off==='function')off();});};
      }
    };
    return {ok:true,reason:startup.ok?null:startup.reason,events:startup.events,created,recovered,service:Object.freeze(service)};
  }
  const api=Object.freeze({KEY,BACKUP,open,encode,decode});
  if(common)module.exports=api;
  root.PigPetStore=api;
})(typeof window!=='undefined'?window:globalThis);
