/* Service worker DIGITAL BOX TECHNOLOGIES : pages consultées disponibles hors connexion. Version 202610020954 */
const V = 'dbt-202610020954', CORE = ["./", "index.html", "offline.html", "panier.html", "suivi-commande.html", "espace-client.html", "assets/css/shop.css", "assets/js/shop.js", "assets/js/pro.js", "assets/img/logo-dbt-h.svg", "assets/img/app/icon-192.png", "assets/img/app/icon-96.png", "produits.json"];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n.startsWith('dbt-') && n !== V).map(n => caches.delete(n)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  if (/\/(api|admin)\//.test(u.pathname)) return;            // données en direct et backoffice : jamais en cache
  if (r.mode === 'navigate') {                                 // pages : réseau d'abord, copie locale si hors connexion
    e.respondWith(fetch(r).then(res => { if (res.ok) { const c = res.clone(); caches.open(V).then(x => x.put(r, c)); } return res; })
      .catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || caches.match('offline.html'))));
    return;
  }
  e.respondWith(caches.match(r).then(m => {                    // images, styles, scripts : copie locale, mise à jour en arrière-plan
    const net = fetch(r).then(res => { if (res.ok) { const c = res.clone(); caches.open(V).then(x => x.put(r, c)); } return res; }).catch(() => m);
    return m || net;
  }));
});
