const CACHE='display-pro-system-v2';
const OLD_CACHES=['display-pro-system-v1'];
const ASSETS=[
  './',
  './index.html',
  './licenca.html',
  './cliente.html',
  './admin.html',
  './catalogo.html',
  './provador.html',
  './videos.html',
  './social.html',
  './agenda.html',
  './instalar.html',
  './style.css',
  './app.js',
  './manifest.webmanifest',
  './MANUAL.txt',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(ASSETS))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(
        keys.map(key=>{
          if(key!==CACHE && (OLD_CACHES.includes(key) || key.startsWith('display-pro-system-'))){
            return caches.delete(key);
          }
        })
      ))
      .then(()=>self.clients.claim())
  );
});

function isSameOrigin(request){
  try{
    return new URL(request.url).origin===self.location.origin;
  }catch(_){
    return false;
  }
}

function isFreshAsset(request){
  if(!isSameOrigin(request)) return false;
  const url=new URL(request.url);
  return (
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.webmanifest') ||
    url.pathname.endsWith('/display_pro/') ||
    url.pathname.endsWith('/display_pro')
  );
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET') return;

  if(isFreshAsset(request)){
    event.respondWith(
      fetch(request)
        .then(response=>{
          if(response && response.ok){
            const copy=response.clone();
            caches.open(CACHE).then(cache=>cache.put(request,copy));
          }
          return response;
        })
        .catch(async()=>{
          const cached=await caches.match(request);
          if(cached) return cached;
          if(request.mode==='navigate'){
            const fallback=await caches.match('./index.html');
            if(fallback) return fallback;
          }
          throw new Error('offline');
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached=>{
      if(cached) return cached;
      return fetch(request).then(response=>{
        if(response && response.ok && isSameOrigin(request)){
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(request,copy));
        }
        return response;
      }).catch(async()=>{
        if(request.mode==='navigate'){
          const fallback=await caches.match('./index.html');
          if(fallback) return fallback;
        }
        throw new Error('offline');
      });
    })
  );
});