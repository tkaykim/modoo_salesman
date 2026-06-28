// modoo_salesman service worker (basic shell — 캐싱 전략은 향후 확장)
const CACHE_NAME = 'modoo-salesman-shell-v2';
const SHELL_ASSETS = [
  '/',
  '/login',
  '/icon.svg',
  '/icons/modoo-partners-icon-192.png',
  '/icons/modoo-partners-icon-512.png',
  '/apple-touch-icon.png',
  '/brand/modoo-partners-logo.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS).catch(() => null))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // API/auth 요청은 항상 네트워크
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase.co')) {
    return;
  }

  // 정적 자원: 캐시 우선, 없으면 네트워크
  if (request.destination === 'image' || request.destination === 'style' || request.destination === 'script') {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached ||
        fetch(request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return res;
        }).catch(() => cached || new Response('', { status: 503 }))
      )
    );
    return;
  }

  // HTML: 네트워크 우선, 실패 시 캐시
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/') || new Response('Offline', { status: 503 }))
    );
  }
});
