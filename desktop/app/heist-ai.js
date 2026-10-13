/* 猪猪夺宝 AI：仅使用公开快照；固定节点预算，决策可复现。MIT. */
(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./heist-core.js'),require('./heist-search.js'));
  else root.PigHeistAI=factory(root.PigHeistCore,root.PigHeistSearch);
})(typeof globalThis!=='undefined'?globalThis:this,function(H,Search){
  'use strict';
  if(!H||!Search)throw new Error('请先加载 heist-core.js 与 heist-search.js');
  const key=p=>p.q+','+p.r;
  const eq=(a,b)=>a&&b&&a.q===b.q&&a.r===b.r;
  const TIERS=Object.freeze({easy:{nodes:60,width:3},smart:{nodes:240,width:8},devil:{nodes:1000,width:12}});
  function graph(s,seat,ctx){
    const signature=seat+':'+s.board.tiles.filter(t=>t.kind==='spring'||t.kind==='gate').map(t=>t.dir||Number(t.open)).join(',');
    if(ctx.graphs.has(signature))return ctx.graphs.get(signature);
    const edges=new Map(),reverse=new Map();
    for(const t of s.board.tiles){
      const k=key(t),next=[];
      if(t.kind!=='pit'&&!(t.kind==='gate'&&!t.open)&&!(t.kind==='home'&&t.owner!==seat)){
        for(const dir of H.DIRS){const p=H.landing(s,seat,t,dir.id);if(p&&!eq(p,t))next.push(key(p));}
      }
      edges.set(k,Array.from(new Set(next)));reverse.set(k,[]);
    }
    for(const [k,next] of edges)for(const to of next)reverse.get(to).push(k);
    const g={edges,home:bfs(reverse,key(s.players[seat].home)),from:new Map()};
    ctx.graphs.set(signature,g);return g;
  }
  function bfs(edges,start){
    const dist=new Map([[start,0]]),queue=[start];
    for(let i=0;i<queue.length;i++)for(const to of edges.get(queue[i])||[])if(!dist.has(to)){dist.set(to,dist.get(queue[i])+1);queue.push(to);}
    return dist;
  }
  function blastDanger(s,p){
    if(!p.pos||eq(p.pos,p.home))return 0;
    let danger=0;
    for(const b of s.bombs)for(const d of H.DIRS)for(let n=1;n<=2;n++){
      const at={q:b.q+d.q*n,r:b.r+d.r*n},t=s.board.tiles.find(x=>eq(x,at));
      if(!t||t.kind==='home'||(t.kind==='gate'&&!t.open))break;
      if(eq(at,p.pos))danger+=b.dueTurn<=s.turnNumber+1?42:16;
      if(s.bombs.some(x=>eq(x,at)))break;
    }
    return danger;
  }
  function evaluate(s,seat,ctx){
    const p=s.players[seat],others=s.players.filter(x=>x.id!==seat);
    if(s.phase==='finished')return s.result.winners.includes(seat)?(s.result.winners.length===1?100000:20000):-100000;
    const enemy=Math.max(...others.map(x=>x.score*155+x.carry*21));
    let value=p.score*160-enemy*.8-p.falls*4+p.ammo*.3;
    if(!p.pos)return value-28;
    const g=graph(s,seat,ctx),here=key(p.pos),home=g.home.has(here)?g.home.get(here):15;
    value+=p.carry*(36-home*2.2)-(p.carry>=4?home*4:home*p.carry*.6);
    if(p.carry<5){
      if(!g.from.has(here))g.from.set(here,bfs(g.edges,here));
      const distances=g.from.get(here);let opportunity=-30;
      for(const pile of s.piles){
        let d=distances.get(key(pile));if(d===undefined)continue;
        // 爆炸掉在脚下的松露要重新踩入才会捡到，不能误判为零步收益。
        if(d===0)d=2;
        const gain=Math.min(5-p.carry,pile.count);
        opportunity=Math.max(opportunity,24+gain*4-d*5);
      }
      value+=opportunity;
    }
    value-=blastDanger(s,p)*(1+p.carry*.22);
    return value;
  }
  const actionCost=a=>a.type==='end'?1.4:a.type==='plant'?.9:a.type==='toggle'||a.type==='rotate'?.3:0;
  function plans(view,ctx,width){
    const seat=view.turn,finished=[];let frontier=[{view,actions:[],penalty:0}];
    for(let step=0;step<2&&frontier.length;step++){
      const next=[];
      for(const node of frontier){
        for(const a of H.legalActions(node.view)){
          if(ctx.nodes>=ctx.limit)break;
          const r=H.simulate(node.view,a);ctx.nodes++;
          const item={view:r.view,actions:node.actions.concat([a]),penalty:node.penalty+actionCost(a)};
          item.value=evaluate(item.view,seat,ctx)-item.penalty;
          if(item.view.turnNumber!==view.turnNumber||item.view.phase==='finished')finished.push(item);else next.push(item);
        }
        if(ctx.nodes>=ctx.limit)break;
      }
      next.sort((a,b)=>b.value-a.value);
      frontier=next.slice(0,width);
    }
    // 即使预算耗尽，也返回已完成的合法回合；最低预算保证第一层会有 end 候选。
    return finished.sort((a,b)=>b.value-a.value);
  }
  function analyze(view,input){
    const opts=input||{},tier=opts.tier||'smart';
    if(!Object.prototype.hasOwnProperty.call(TIERS,tier))throw new Error('未知 AI 难度');
    const legal=H.legalActions(view);
    if(!legal.length)return {action:null,line:[],tier,nodes:0,searchDepth:0,algorithm:tier==='devil'?'maxn':'turn-beam'};
    const config=TIERS[tier];
    if(opts.maxNodes!==undefined&&(!Number.isInteger(opts.maxNodes)||opts.maxNodes<40||opts.maxNodes>5000))throw new Error('maxNodes 必须为 40～5000');
    const ctx={nodes:0,limit:opts.maxNodes||config.nodes,graphs:new Map()};
    const candidates=plans(view,ctx,config.width);
    let best=candidates[0],searchDepth=1;
    if(tier==='devil'&&best){
      const root={view},cache=new Map([[root,candidates.slice(0,4)]]);
      const adapter={
        isTerminal:node=>node.view.phase==='finished',
        player:node=>node.view.turn,
        evaluate:node=>node.view.players.map(p=>evaluate(node.view,p.id,ctx)),
        children:node=>{
          if(cache.has(node))return cache.get(node);
          if(ctx.limit-ctx.nodes<40)throw new Search.BudgetExceeded();
          const original=ctx.limit;ctx.limit=Math.min(original,ctx.nodes+90);
          let choices;try{choices=plans(node.view,ctx,3).slice(0,2);}finally{ctx.limit=original;}
          cache.set(node,choices);return choices;
        }
      };
      // 逐层加深；只有所有候选都完成该层才替换结果，避免预算偏向先遍历的分支。
      for(let depth=2;depth<=view.players.length+1;depth++){
        const result=Search.maxN(root,adapter,depth,1000);
        if(!result.completed)break;
        if(result.child)best=result.child;searchDepth=depth;
      }
    }
    if(tier==='easy'&&candidates.length>1){
      // 固定局面决定偶尔的次优选择，回放和自动验证可以复现。
      const salt=((view.revision+3)*1103515245+view.turn*12345)>>>0;
      if(salt%4===0)best=candidates[Math.min(2,candidates.length-1)];
    }
    return {action:best?best.actions[0]:legal[0],line:best?best.actions:[legal[0]],tier,nodes:ctx.nodes,searchDepth,algorithm:tier==='devil'?'maxn':'turn-beam'};
  }
  return Object.freeze({TIERS,analyze,choose:(view,opts)=>analyze(view,opts).action});
});
