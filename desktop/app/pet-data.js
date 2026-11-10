/* 6.0 offline pet content and balancing. No clock, DOM, storage or random calls. */
(function(root) {
  'use strict';
  const freeze = value => {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.values(value).forEach(freeze); Object.freeze(value);
    }
    return value;
  };
  const HOUR = 3600000, DAY = 24 * HOUR;
  const items = [
    {id:'grass', name:'青草餐', kind:'food', price:0, level:1, renewable:true, hunger:18, mood:1},
    {id:'apple', name:'苹果', kind:'food', price:4, level:1, hunger:28, mood:4},
    {id:'carrot', name:'胡萝卜', kind:'food', price:8, level:2, hunger:42, mood:6},
    {id:'meal', name:'南瓜饭', kind:'food', price:16, level:5, hunger:65, mood:10},
    {id:'berry-cake', name:'莓莓蛋糕', kind:'food', price:28, level:10, hunger:50, mood:25},
    {id:'ball', name:'小皮球', kind:'toy', price:0, level:1, starter:true, mood:16, energy:8},
    {id:'rattle', name:'摇铃', kind:'toy', price:30, level:3, mood:22, energy:10},
    {id:'puzzle-cube', name:'益智积木', kind:'toy', price:70, level:8, trait:'smart', minimum:20, mood:28, energy:12},
    {id:'food-bowl', name:'小食盆', kind:'furniture', slot:'bowl', price:0, level:1, starter:true},
    {id:'straw-bed', name:'稻草窝', kind:'furniture', slot:'bed', price:0, level:1, starter:true},
    {id:'soft-bed', name:'软绵绵小窝', kind:'furniture', slot:'bed', price:80, level:5},
    {id:'bookcase', name:'小书架', kind:'furniture', slot:'wall', price:100, level:8, trait:'knowledge', minimum:30},
    {id:'flower-pot', name:'窗台花盆', kind:'furniture', slot:'window', price:35, level:3},
    {id:'toy-basket', name:'玩具篮', kind:'furniture', slot:'toys', price:40, level:4},
    {id:'garden-swing', name:'院子秋千', kind:'furniture', slot:'yard', price:160, level:15},
    {id:'star-pin', name:'星星徽章', kind:'accessory', price:60, level:5},
    {id:'scholar-pin', name:'学识徽章', kind:'accessory', price:100, level:10, trait:'knowledge', minimum:100}
  ];
  const api = {
    API_VERSION:1, SAVE_VERSION:1, FORMAT:'piggy-pet', HOUR, DAY,
    defaults:{name:'团子', petCount:1, startView:'home', timezoneMinutes:480, coins:30, oldPlayerGift:30},
    limits:{offlineMs:48*HOUR, needFloor:15, maxLevel:100, maxCoins:1000000000,
      maxTrait:1000000, inventory:999, diary:160, receipts:4096, saveBytes:1048576,
      receiptAgeMs:7*DAY, futureEventMs:5000, maxQuestions:200, maxRoundSeconds:86400, maxDdzDelta:1000000000},
    needs:{hunger:{label:'饱食',hours:10},mood:{label:'心情',hours:16},
      clean:{label:'清洁',hours:36},energy:{label:'精力',hours:14}},
    sleepHours:3,
    stages:[{id:'baby',name:'奶猪仔',level:1},{id:'piglet',name:'小猪',level:5},
      {id:'teen',name:'少年猪',level:15},{id:'adult',name:'大猪',level:30}],
    traits:{smart:'聪明',agile:'灵巧',brave:'勇气',strategy:'谋略',knowledge:'学识'},
    categoryTraits:{puzzle:'smart',action:'agile',arcade:'brave',versus:'strategy',board:'strategy',study:'knowledge'},
    rewards:{
      game:{minimumSeconds:30,participation:3,win:5,record:10,xp:6,winXp:4,recordXp:8,trait:1,
        daily:{coins:120,xp:240,trait:60}},
      study:{secondsPerQuestion:3,correctCoins:4,tenCoins:20,answeredXp:4,correctXp:6,tenXp:20,
        correctTrait:2,daily:{coins:360,xp:720,trait:180}},
      care:{xp:2,dailyXp:40}, wish:{multiplier:2,mood:8}
    },
    cooldowns:{feed:30000,grass:120000,pet:60000,wash:300000,play:60000,poke:2000},
    slots:['bowl','bed','toys','wall','window','yard'],
    looks:['peach','berry','cream','taro','whitechoc','darkchoc','matcha','soda','caramel','cow'],
    accessories:['none','bell','bowtie','pearls','tailbow','earflower','hearts','freckles','mustache','wings','sparkle'],
    costumes:['none','crown','glasses','pirate','chef','space','bow','flower','music','wizard','scarf','detective','bee'],
    items, byId:Object.fromEntries(items.map(item=>[item.id,item])),
    tasks:[{id:'care-three',name:'照顾小猪三次',metric:'care',target:3,coins:6,xp:6},
      {id:'study-ten',name:'完成十道题',metric:'answered',target:10,coins:20,xp:20},
      {id:'study-right-eight',name:'答对八道题',metric:'correct',target:8,coins:20,xp:20}],
    reasons:{'bad-action':'动作或参数无效','bad-time':'时间无效','clock-backward':'时间倒退，等待时钟恢复',
      'sleeping':'小猪正在睡觉','not-sleeping':'小猪还没有睡','not-tired':'现在还不困','too-full':'已经吃饱了',
      'too-tired':'精力不足','already-clean':'已经很干净了','cooldown':'稍等一会再来',
      'not-owned':'尚未拥有','not-enough':'库存不足','locked':'尚未解锁','no-money':'松露不足',
      'already-owned':'已经拥有','inventory-full':'背包数量已到上限','wrong-slot':'摆放位置不匹配',
      'task-not-ready':'任务尚未完成','already-claimed':'已经领取','bad-event':'结算事件无效',
      'duplicate':'这次结算已经入账','event-expired':'结算事件过期','event-future':'结算时间超前',
      'receipt-capacity':'本日结算记录已满','storage-read':'无法读取存档','storage-write':'无法写入存档',
      'save-invalid':'存档损坏或格式不合法','save-newer':'存档来自更新版本','save-conflict':'存档已由其他窗口更新',
      'import-older':'导入的存档比本机养成进度更早','bad-import':'导入内容无效'}
  };
  api.xpForLevel = level => 40 + 20*(level-1);
  api.totalXpForLevel = level => (level-1)*40 + 10*(level-1)*(level-2);
  api.day = (now, timezoneMinutes=480) => Math.floor((now+timezoneMinutes*60000)/DAY);
  api.stageForLevel = level => api.stages.filter(stage=>stage.level<=level).slice(-1)[0];
  freeze(api);
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
  root.PigPetData=api;
})(typeof window !== 'undefined' ? window : globalThis);
