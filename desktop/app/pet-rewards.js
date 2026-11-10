/* Stateless reward policy. The core owns deduplication, limits and the wallet. */
(function(root) {
  'use strict';
  const common=typeof module!=='undefined'&&module.exports;
  const D=common?require('./pet-data.js'):root.PigPetData;
  if(common)require('./catalog.js');
  const C=root.PigCatalog, own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
  const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
  const text=(v,max)=>typeof v==='string'&&v.length>0&&v.length<=max&&!/[\u0000-\u001f]/.test(v);
  function normalize(input) {
    if(!input||typeof input!=='object'||!text(input.eventId,160)||!integer(input.at,0,8640000000000000))return null;
    const e={eventId:input.eventId,at:input.at,type:input.type};
    if(input.type==='study-session') {
      if(!integer(input.answered,1,D.limits.maxQuestions)||!integer(input.correct,0,input.answered)||
        !finite(input.seconds,0,D.limits.maxRoundSeconds))return null;
      if(input.subject!=null&&!text(input.subject,40))return null;
      return {...e,answered:input.answered,correct:input.correct,seconds:input.seconds,subject:input.subject||null};
    }
    if(input.type!=='game-end'||!own(C.SETTLE,input.id)||C.SETTLE[input.id]==='session'||
      !['solo','duo','lan'].includes(input.mode)||!finite(input.seconds,0,D.limits.maxRoundSeconds)||
      ![true,false,null].includes(input.win)||typeof input.record!=='boolean'||typeof input.first!=='boolean'||
      !text(input.level,80))return null;
    // Do not trust a caller-supplied category or outcome for a score-only game.
    Object.assign(e,{id:input.id,cat:C.byId[input.id].cat,kind:C.SETTLE[input.id],level:input.level,
      mode:input.mode,seconds:input.seconds,win:input.win,record:input.record,first:input.first});
    if(e.kind==='score'||e.mode!=='solo')e.win=null;
    if(C.TALLY.includes(e.id))e.record=e.first=false;
    // One transaction covers both DDZ stakes and pet rewards, even for a short round.
    if(e.id==='doudizhu') {
      if(!integer(input.truffleDelta,-D.limits.maxDdzDelta,D.limits.maxDdzDelta))return null;
      e.truffleDelta=input.truffleDelta;
    } else if(input.truffleDelta!=null) return null;
    return e;
  }
  function quote(input, context) {
    const e=normalize(input);
    if(!e)return {ok:false,reason:'bad-event'};
    const out={ok:true,reason:null,event:e,source:e.type==='study-session'?'study':'game',
      coins:0,xp:0,trait:0,traitId:e.type==='study-session'?'knowledge':D.categoryTraits[e.cat],
      walletDelta:e.truffleDelta||0,eligible:false,wish:false,answered:0,correct:0};
    if(out.source==='study') {
      const r=D.rewards.study;
      if(e.seconds<e.answered*r.secondsPerQuestion)return out;
      out.eligible=true;out.answered=e.answered;out.correct=e.correct;
      out.coins=e.correct*r.correctCoins+(e.answered>=10?r.tenCoins:0);
      out.xp=e.answered*r.answeredXp+e.correct*r.correctXp+(e.answered>=10?r.tenXp:0);
      out.trait=e.correct*r.correctTrait+Math.floor(e.answered/5);
    } else {
      const r=D.rewards.game;
      if(e.seconds<r.minimumSeconds)return out;
      out.eligible=true;out.coins=r.participation;out.xp=r.xp;out.trait=r.trait;
      if(e.mode==='solo') {
        if(e.win===true){out.coins+=r.win;out.xp+=r.winXp;}
        if(e.record&&!e.first){out.coins+=r.record;out.xp+=r.recordXp;}
        if(context&&context.wishGame===e.id&&!context.wishDone){out.wish=true;out.coins*=D.rewards.wish.multiplier;}
      }
    }
    return out;
  }
  const api=Object.freeze({normalize,quote});
  if(common)module.exports=api;
  root.PigPetRewards=api;
})(typeof window!=='undefined'?window:globalThis);
