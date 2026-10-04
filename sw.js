// Offline support. The app shell is cached on install; scripts, fonts and audio
// are cached the first time they load. The AI model itself is cached by
// transformers.js in the browser's Cache Storage.
const CACHE = 'sauti-v1';
const SHELL = [
  './', 'index.html', 'daughter.html', 'css/style.css', 'manifest.json', 'icons/icon.svg',
  'js/app.js', 'js/daughter.js', 'js/matcher.js', 'js/store.js', 'js/visuals.js',
  'data/answers.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Model weights are large; transformers.js manages their cache itself.
  if (/huggingface\.co|hf\.co|xethub/.test(url.hostname)) return;

  // Pages and answer data: try the network first so updates show up, fall back offline.
  if (req.mode === 'navigate' || url.pathname.endsWith('answers.json')) {
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('index.html'))));
    return;
  }

  // Everything else: cache first.
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok || res.type === 'opaque') {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
    }
    return res;
  })));
});
