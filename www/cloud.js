(function () {
  const cfg = window.FIREBASE_CONFIG, K = 'travelnote:room';
  const gen = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
  window.TN = { cloud: false, room: null, assetUrl: () => null };
  if (!cfg || !cfg.projectId || !window.firebase) return;
  let room = null; try { room = localStorage.getItem(K); } catch {}
  if (!room) { room = gen(); try { localStorage.setItem(K, room); } catch {} }
  firebase.initializeApp(cfg);
  const fs = firebase.firestore();
  fs.enablePersistence({ synchronizeTabs: true }).catch(() => {});
  const base = fs.collection('rooms').doc(room), trips = base.collection('trips'), assets = base.collection('assets');
  const norm = e => { const x = new Error(e && e.message); x.code = String(e && e.code || '').replace(/^firestore\//, '').replace(/-/g, '_').replace('resource_exhausted', 'quota_exceeded'); return x; };
  const ok = (p, ms = 5000) => Promise.race([p.catch(e => { throw norm(e); }), new Promise(r => setTimeout(r, ms))]); // 오프라인이면 기기에 먼저 저장되고 연결되면 자동 업로드
  const cache = new Map(), loading = new Set(); let tm;
  const bump = () => { clearTimeout(tm); tm = setTimeout(() => window.render && window.render(), 150); };
  const A = {
    async upload(blob, o) {
      const type = blob.type || (o && o.type) || '';
      const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
      const id = 'a_' + gen(); await ok(assets.doc(id).set({ type, data, ts: Date.now() })); cache.set(id, data);
      return { id, contentType: type };
    },
    delete: id => ok(assets.doc(id).delete()),
  };
  window.TN = { cloud: true, room, assetUrl(id) {
    if (cache.has(id)) return cache.get(id);
    if (!loading.has(id)) { loading.add(id); assets.doc(id).get().then(s => { if (s.exists) { cache.set(id, s.data().data); bump(); } }).catch(() => loading.delete(id)); }
    return null;
  } };
  const db = { collection: () => ({
    onSnapshot: (cb, err) => trips.onSnapshot(s => cb({ docChanges: () => s.docChanges().map(c => ({ type: c.type, doc: { id: c.doc.id, data: () => c.doc.data() } })) }), err),
    doc: id => ({ set: d => ok(trips.doc(id).set(d)), delete: () => ok(trips.doc(id).delete()) }),
  }) };
  const downloads = { async save({ filename, data }) {
    const blob = new Blob([data], { type: /\.csv$/i.test(filename) ? 'text/csv' : 'application/json' });
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: filename }); return; }
      catch (e) { if (e && e.name === 'AbortError') { const x = new Error('declined'); x.code = 'declined'; throw x; } }
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  } };
  window.claude = { use: async n => ({ db, user: { id: async () => room }, assets: A, downloads })[n] || null };
})();
