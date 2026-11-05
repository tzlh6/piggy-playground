/* Native socket operations are asynchronous; the WebView retains connect-src 'none'. */
(() => {
  'use strict';
  const native = window.PiggyLanAndroid;
  if (!native) return;
  let serial = 0;
  const pending = new Map(), listeners = new Set();
  function call(operation, data = {}) {
    return new Promise(resolve => {
      const id = ++serial;
      const timer = setTimeout(() => { pending.delete(id); resolve({ok:false,error:'联机操作超时，请检查网络后重试'}); }, 12000);
      pending.set(id, {resolve, timer});
      try { native.call(id, operation, JSON.stringify(data)); }
      catch (error) { clearTimeout(timer); pending.delete(id); resolve({ok:false,error:'无法使用手机联机功能'}); }
    });
  }
  window.PiggyLan = Object.freeze({
    version: 1, android: true,
    host: room => call('host', room), room: room => call('room', room),
    join: (host, port) => call('join', {host,port}), scan: on => call('scan', {on:!!on}),
    send: (to, msg) => call('send', {to,msg}), kick: id => call('kick', {id}),
    leave: () => call('leave'), info: () => call('info'),
    onEvent(cb) { listeners.add(cb); return () => listeners.delete(cb); },
    _reply({id,result}) { const p = pending.get(id); if (p) { pending.delete(id); clearTimeout(p.timer); p.resolve(result); } },
    _event(event) { for (const cb of listeners) { try { cb(event); } catch (error) { console.error('LAN event', error); } } }
  });
})();
