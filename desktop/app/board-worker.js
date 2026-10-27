/* Optional background AI for browsers/Electron/Android. Pass Session.aiJob().
 * No timer, DOM, fetch, server, account or native bridge is required.
 */
'use strict';
importScripts('vendor/chess.js','vendor/xiangqi.js','board-core.js','battleship-core.js','board-session.js');
self.onmessage=function(event){const job=event.data;try{self.postMessage({ok:true,...self.PigBoardGames.solveJob(job)})}catch(error){self.postMessage({ok:false,token:job&&job.token,error:String(error.message||error)})}};
