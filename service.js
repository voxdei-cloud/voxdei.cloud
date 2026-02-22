const fetchCorePaths = async () => {
  try {
    const res = await fetch('/cache.json');
    if (!res.ok) throw new Error();
    return await res.json();
  } catch {
    return [];
  }
};

const fetchArticlePaths = async () => {
  try {
    const res = await fetch('/content/articles.json');
    if (!res.ok) throw new Error();
    const list = await res.json();
    return list.map((a) => `/content/${a.id}.md`);
  } catch {
    return [];
  }
};

const populateStore = async () => {
  const store = await caches.open('VoxDei/1');
  const core = await fetchCorePaths();
  const mdPaths = await fetchArticlePaths();
  await Promise.all(
    [...core, ...mdPaths].map((url) =>
      fetch(url)
        .then((res) => { if (res.ok) store.put(url, res); })
        .catch(() => {}),
    ),
  );
};

const refreshStore = async () => {
  const probe = await fetch('/content/articles.json');
  if (!probe.ok) throw new Error('server error');
  const list = await probe.json();
  const store = await caches.open('VoxDei/1');
  const core = await fetchCorePaths();
  const mdPaths = list.map((a) => `/content/${a.id}.md`);
  await Promise.all(
    [...core, ...mdPaths].map((url) =>
      fetch(url)
        .then((res) => { if (res.ok) store.put(url, res); })
        .catch(() => {}),
    ),
  );
};

const broadcast = (msg) =>
  self.clients.matchAll({ includeUncontrolled: true }).then((all) =>
    all.forEach((c) => c.postMessage(msg)),
  );

self.addEventListener('install', (ev) => {
  ev.waitUntil(populateStore().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (ev) => {
  const sweep = caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== 'VoxDei/1').map((k) => caches.delete(k))),
  );
  ev.waitUntil(sweep.then(() => self.clients.claim()));
});

self.addEventListener('message', (ev) => {
  if (ev.data?.type !== 'REFRESH') return;
  refreshStore()
    .then(() => broadcast({ type: 'REFRESHED' }))
    .catch(() => broadcast({ type: 'OFFLINE' }));
});

const fromStore = (req) => caches.open('VoxDei/1').then((s) => s.match(req));

const fromNetwork = async (req) => {
  const res = await fetch(req);
  if (res.ok) {
    const store = await caches.open('VoxDei/1');
    store.put(req, res.clone());
  }
  return res;
};

const respond = async (req) => {
  const cached = await fromStore(req);
  if (cached) return cached;
  try {
    return await fromNetwork(req);
  } catch {
    if (req.mode === 'navigate') {
      const fallback = await fromStore('/index.html');
      if (fallback) return fallback;
    }
    return new Response('Offline — content not available', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
};

self.addEventListener('fetch', (ev) => {
  if (ev.request.method !== 'GET') return;
  if (!ev.request.url.startsWith('http')) return;
  ev.respondWith(respond(ev.request));
});
