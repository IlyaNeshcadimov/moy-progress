const CACHE_NAME = 'fittrack-static-v1';
const FILES = ['./', './index.html', './app.css', './app.js', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
self.addEventListener('install', e => {e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(FILES)));self.skipWaiting();});
self.addEventListener('activate', e => {e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch', e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(resp=>{if(resp.ok){const copy=resp.clone();caches.open(CACHE_NAME).then(c=>c.put(e.request,copy));}return resp;})));});
