const V = 'tn-v1', SHELL = ['./', 'index.html', 'cloud.js', 'firebase-config.js', 'manifest.webmanifest', 'icon-192.png', 'vendor/firebase-app-compat.js', 'vendor/firebase-firestore-compat.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => Promise.allSettled(SHELL.map(u => c.add(u))))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(V).then(x => x.put(e.request, c)); return r; })
    .catch(() => caches.match(e.request).then(m => m || caches.match('index.html'))));
});
