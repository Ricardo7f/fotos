// Service worker: deixa o app abrir sem internet (a fila de envios já fica no IndexedDB)
const VERSAO = "v8";
const CACHE = "ocorrencias-" + VERSAO;
const SHELL = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;

  // Dados do Firebase (Firestore/Auth) nunca passam pelo cache
  if (url.hostname !== "fonts.googleapis.com" && /googleapis\.com|firebaseio\.com|identitytoolkit|securetoken/.test(url.hostname)) return;

  // Páginas: tenta a rede e, sem internet, usa o cache
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put("./index.html", c)); return r; })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Demais arquivos (ícones, SDK do Firebase no gstatic): cache primeiro, atualiza em segundo plano
  e.respondWith(
    caches.match(req).then(hit => {
      const rede = fetch(req).then(r => {
        if (r && (r.ok || r.type === "opaque")) { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); }
        return r;
      }).catch(() => hit);
      return hit || rede;
    })
  );
});
