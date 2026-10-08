/* FinanceOS service worker: cache do app shell p/ abrir rapido e funcionar offline */
const CACHE = 'financeos-v244';
const CORE = ['/app', '/app/', '/app/index.html', '/app/manifest.json', '/app/icon-192.png', '/app/icon-512.png'];

// A hospedagem (Vercel) redireciona /index.html -> / (308). Uma resposta "redirecionada"
// NAO pode ser devolvida pelo SW numa navegacao: o navegador recusa com
// "response served by service worker has redirections". Por isso reconstruimos a resposta
// sem a marca de redirect antes de cachear e antes de servir uma navegacao.
async function semRedirect(res){
  if(!res || !res.redirected) return res;
  const body = await res.clone().blob();
  return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
}

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(CORE.map(async url => {
      try {
        const res = await fetch(url, { redirect: 'follow', cache: 'reload' });
        if (res && res.ok) await c.put(url, await semRedirect(res));
      } catch (_) {}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const accept = req.headers.get('accept') || '';
  const isHTML = req.mode === 'navigate' || accept.includes('text/html');

  // HTML / navegacao -> STALE-WHILE-REVALIDATE: entrega a copia salva NA HORA (abre rapido)
  // e busca a versao nova por baixo. Sempre sem a marca de redirect. A versao nova entra
  // quando o proprio sw.js muda (CACHE novo): install pre-carrega o index, activate assume
  // e a pagina recarrega 1x sozinha (controllerchange no index.html). Offline: usa o cache.
  if (isHTML) {
    e.respondWith((async () => {
      const cached = (await caches.match(req)) || (await caches.match('/app')) || (await caches.match('/app/index.html')) || (await caches.match('/app/'));
      const net = fetch(req).then(async res => {
        if (res && res.ok) {
          const limpo = await semRedirect(res);
          try { const c = await caches.open(CACHE); await c.put(req, limpo.clone()); } catch (_) {}
          return limpo;
        }
        return res;
      }).catch(() => cached);
      if (cached) return await semRedirect(cached);
      return net;
    })());
    return;
  }

  // Demais assets (icones, manifest) -> cache-first com atualizacao em segundo plano
  e.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        if (res && res.ok) { const clone = res.clone(); caches.open(CACHE).then(c => c.put(req, clone)); }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});

/* ---- avisos de vencimento: a agenda vem do app pelo IndexedDB ---- */
function _avDB(){ return new Promise((ok,err)=>{ const r=indexedDB.open('financeos-avisos',1); r.onupgradeneeded=()=>{ try{ r.result.createObjectStore('kv'); }catch(e){} }; r.onsuccess=()=>ok(r.result); r.onerror=()=>err(r.error); }); }
function _avLer(){ return _avDB().then(db=>new Promise(ok=>{ const q=db.transaction('kv','readonly').objectStore('kv').get('agenda'); q.onsuccess=()=>ok(q.result||null); q.onerror=()=>ok(null); })).catch(()=>null); }
function _avGravar(o){ return _avDB().then(db=>new Promise(ok=>{ const t=db.transaction('kv','readwrite'); t.objectStore('kv').put(o,'agenda'); t.oncomplete=()=>ok(true); t.onerror=()=>ok(false); })).catch(()=>false); }
async function _avAvisar(){
  const a = await _avLer();
  if(!a || !a.ativo || !a.itens || !a.itens.length) return;
  const hoje = new Date(); const key = hoje.getFullYear()+'-'+String(hoje.getMonth()+1).padStart(2,'0')+'-'+String(hoje.getDate()).padStart(2,'0');
  if(a.avisadoEm === key) return;              // um aviso por dia
  const lim=(a.dias!=null&&a.dias!=='')?Math.max(0,Math.min(15,+a.dias||0)):1; // dias de antecedência escolhidos em Ajustes (0 = só no dia); agenda antiga sem o campo fica em 1
  if(!a.itens.some(i => i.falta <= lim)) return;
  await self.registration.showNotification(a.titulo || 'Vencimento chegando', {
    body: a.corpo || '', icon: '/app/icon-192.png', badge: '/app/icon-192.png', tag: 'financeos-venc', renotify: true, data: { url: '/app' }
  });
  a.avisadoEm = key; await _avGravar(a);
}
self.addEventListener('periodicsync', e => { if(e.tag === 'avisos-vencimento') e.waitUntil(_avAvisar()); });
self.addEventListener('sync', e => { if(e.tag === 'avisos-vencimento') e.waitUntil(_avAvisar()); });
self.addEventListener('message', e => { if(e.data && e.data.tipo === 'checar-avisos') e.waitUntil(_avAvisar()); });
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(lista => {
    for(const c of lista){ if('focus' in c) return c.focus(); }
    return self.clients.openWindow('/app');
  }));
});
