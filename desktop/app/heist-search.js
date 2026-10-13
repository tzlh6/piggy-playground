// Copyright 2021 DeepMind Technologies Limited
// Copyright 2026 Piggy Playground contributors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//     https://www.apache.org/licenses/LICENSE-2.0
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// Adapted from OpenSpiel algorithms/maxn.cc at
// 48401890ee9857e611678302371378175a8e4c6b.
// Changes: JavaScript adapter API, bounded search, explicit completion result;
// chance nodes are omitted because this game's rules are deterministic.
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;else root.PigHeistSearch=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  class BudgetExceeded extends Error {}
  function maxN(state,adapter,depth,maxNodes){
    if(!Number.isInteger(depth)||depth<0||depth>8)throw new Error('MaxN depth 必须为 0～8');
    let nodes=0;const limit=maxNodes===undefined?2000:maxNodes;
    if(!Number.isInteger(limit)||limit<1||limit>100000)throw new Error('MaxN 节点上限无效');
    function visit(node,left){
      if(nodes>=limit)throw new BudgetExceeded();nodes++;
      if(adapter.isTerminal(node)||left===0)return {values:adapter.evaluate(node),child:null};
      const player=adapter.player(node),children=adapter.children(node);
      if(!children.length)return {values:adapter.evaluate(node),child:null};
      let best=null;
      for(const child of children){
        const result=visit(child,left-1);
        if(!best||result.values[player]>best.values[player])best={values:result.values,child};
      }
      return best;
    }
    try{return Object.assign({completed:true,nodes:0},visit(state,depth),{nodes});}
    catch(error){if(error instanceof BudgetExceeded)return {completed:false,values:null,child:null,nodes};throw error;}
  }
  return Object.freeze({maxN,BudgetExceeded});
});
