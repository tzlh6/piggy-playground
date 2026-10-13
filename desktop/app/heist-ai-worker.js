/* 可选 Worker。前端同时核对 requestId / sessionId / revision，再提交 AI 行动。MIT. */
'use strict';
importScripts('heist-core.js','heist-search.js','heist-ai.js');
self.onmessage=function(event){
  const m=event.data||{};
  const response={requestId:m.requestId,sessionId:m.sessionId,revision:m.view&&m.view.revision};
  try {
    const result=PigHeistAI.analyze(m.view,m.options);
    self.postMessage(Object.assign(response,{ok:true,result}));
  } catch(error) {
    self.postMessage(Object.assign(response,{ok:false,error:String(error.message||error)}));
  }
};
