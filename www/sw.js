const V = 'tn-v3', SHELL = ['./', 'index.html', 'cloud.js', 'firebase-config.js', 'manifest.webmanifest', 'icon-192.png', 'vendor/firebase-app-compat.js', 'vendor/firebase-firestore-compat.js', 'vendor/firebase-auth-compat.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => Promise.allSettled(SHELL.map(u => c.add(u))))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  const keep = r => { if (r.ok) { const c = r.clone(); caches.open(V).then(x => x.put(e.request, c)); } return r; };
  // 라이브러리·아이콘: 저장해 둔 것을 바로 쓰고 뒤에서 새로 받아 둔다 (앱이 빨리 열림)
  if (/\/vendor\/|\.png$/.test(u.pathname)) {
    e.respondWith(caches.match(e.request).then(m => { const n = fetch(e.request).then(keep).catch(() => m); return m || n; }));
    return;
  }
  // 화면·앱 코드: 열 때마다 서버에 새 버전이 있는지 확인 (깃허브에 올리면 바로 반영), 인터넷이 없으면 저장해 둔 것
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(keep)
    .catch(() => caches.match(e.request).then(m => m || caches.match('index.html'))));
});
