const CACHE='display-pro-system-v1';
const ASSETS=['./','./index.html','./licenca.html','./cliente.html','./admin.html','./catalogo.html','./provador.html','./videos.html','./social.html','./agenda.html','./instalar.html','./style.css','./app.js','./manifest.webmanifest','./MANUAL.txt','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(self.clients.claim())});
self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).catch(()=>caches.match('./index.html'))))});
