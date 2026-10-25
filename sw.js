/* 離線快取：目錄與正文一律先上網拿最新（拿不到才用快取），圖片先用快取。
   改了 index.html／app.js／app.css 時，把版本號 +1。 */
var VER='novel-v61';
var SHELL=['./','index.html','app.css?v=19','app.js?v=24','manifest.webmanifest','icon-192.png'];
self.addEventListener('install',function(e){e.waitUntil(caches.open(VER).then(function(c){return c.addAll(SHELL)}));self.skipWaiting()});
self.addEventListener('activate',function(e){e.waitUntil(caches.keys().then(function(ks){return Promise.all(ks.filter(function(k){return k!==VER}).map(function(k){return caches.delete(k)}))}));self.clients.claim()});
self.addEventListener('fetch',function(e){
  var u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin)return;
  var img=/\.(jpg|jpeg|png|webp)$/i.test(u.pathname);
  e.respondWith(img
    ?caches.match(e.request).then(function(r){return r||fetch(e.request).then(function(n){var c=n.clone();caches.open(VER).then(function(x){x.put(e.request,c)});return n})})
    :fetch(e.request).then(function(n){var c=n.clone();caches.open(VER).then(function(x){x.put(e.request,c)});return n}).catch(function(){return caches.match(e.request)}));
});
