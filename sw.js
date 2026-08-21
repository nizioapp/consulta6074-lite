const C='consulta6074-lite-beta-v081';
const A=['./','index.html','style.css','app.js','manifest.json','infracoes_6074.json','icon-192.png','icon-512.png'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(C).then(c=>c.addAll(A)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==C).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('message',e=>{
  if(e.data && e.data.type==='SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  e.respondWith(
    fetch(e.request)
      .then(resp=>{
        const copy=resp.clone();
        caches.open(C).then(c=>c.put(e.request,copy)).catch(()=>{});
        return resp;
      })
      .catch(()=>caches.match(e.request).then(r=>r || caches.match('./')))
  );
});
