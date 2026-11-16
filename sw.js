// Versioned app shell; app data lives in browser storage, not in cache.
const CACHE_NAME='fittrack-static-v2.0.0';
const FILES=['./','./index.html','./app.css','./app.js','./v2.js','./manifest.webmanifest','./icons/icon.svg','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(FILES)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('fittrack-static-')&&k!==CACHE_NAME).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;
 if(e.request.mode==='navigate'){
   e.respondWith(fetch(e.request).then(resp=>{if(resp.ok){const copy=resp.clone();caches.open(CACHE_NAME).then(c=>c.put(e.request,copy));}return resp;}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));return;
 }
 e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(resp=>{if(resp.ok){const copy=resp.clone();caches.open(CACHE_NAME).then(c=>c.put(e.request,copy));}return resp;})));
});
