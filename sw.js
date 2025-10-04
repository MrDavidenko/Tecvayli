const CACHE='tecvayli-monitor-v23';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  );
});

// App Shell routing: for navigations, always serve index.html (works around GH Pages 404 in PWA)
self.addEventListener('fetch',event=>{
  const req = event.request;
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then(resp=>{
        return resp || fetch('./index.html');
      })
    );
    return;
  }
  event.respondWith(
    caches.match(req).then(res=>{
      return res || fetch(req).then(networkRes=>{
        const copy = networkRes.clone();
        caches.open(CACHE).then(c=>c.put(req, copy));
        return networkRes;
      });
    })
  );
});
