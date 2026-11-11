// 여행노트 클라우드: 별명+PIN 로그인(Firebase Auth) + 여행 저장(Firestore)
(function () {
  const cfg = window.FIREBASE_CONFIG;
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
  window.TN = { cloud: false, assetUrl: () => null };
  if (!cfg || !cfg.projectId || !window.firebase || !firebase.auth) return;
  firebase.initializeApp(cfg);
  const auth = firebase.auth(), fs = firebase.firestore(), FV = firebase.firestore.FieldValue;
  fs.enablePersistence({ synchronizeTabs: true }).catch(() => {});
  const say = m => window.toast && window.toast(m);
  const gen = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
  const clone = o => JSON.parse(JSON.stringify(o));
  const norm = e => { const x = new Error(e && e.message); x.code = String(e && e.code || '').replace(/^firestore\//, '').replace(/-/g, '_').replace('resource_exhausted', 'quota_exceeded'); return x; };
  // 오프라인이면 기기에 먼저 저장되고 연결되면 자동 업로드: 5초 넘게 기다리지 않는다
  const ok = (p, ms = 5000) => Promise.race([p.catch(e => { throw norm(e); }), new Promise(r => setTimeout(r, ms))]);
  const TN = window.TN = { cloud: true, user: null };
  let newNick = ''; // 가입 직후 별명이 프로필에 들어가기 전까지 쓰는 값

  // ----- 로그인: 별명을 로그인용 주소로 바꿔 쓴다 (사용자에게는 안 보임) -----
  const emailOf = nick => 'u' + Array.from(new TextEncoder().encode(String(nick).trim().toLowerCase()), b => b.toString(16).padStart(2, '0')).join('')
    + '@' + (cfg.authDomain || cfg.projectId + '.firebaseapp.com');
  TN.onAuth = cb => auth.onAuthStateChanged(u => {
    stopWatch();
    TN.user = u ? { uid: u.uid, nick: u.displayName || newNick } : null;
    cb(TN.user);
  });
  TN.signUp = async (nick, pin) => {
    newNick = nick.trim();
    const c = await auth.createUserWithEmailAndPassword(emailOf(nick), pin);
    await c.user.updateProfile({ displayName: nick.trim() });
    TN.user = { uid: c.user.uid, nick: nick.trim() };
    return TN.user;
  };
  TN.signIn = (nick, pin) => auth.signInWithEmailAndPassword(emailOf(nick), pin);
  TN.signOut = async () => { flushAll(); await new Promise(r => setTimeout(r, 800)); return auth.signOut(); };

  // ----- 여행 저장: 목록은 항목 id별로 저장해서 여러 사람이 동시에 써도 서로 덮어쓰지 않게 -----
  const LISTS = ['exchanges', 'expenses', 'plans', 'notes', 'checklist', 'diary', 'flights', 'stays'];
  // 서버 칸: members = 들어올 수 있는 계정 아이디 목록(앱에서는 t.uids), people = 정산용 '함께 가는 사람'(앱에서는 t.members)
  const APP_SKIP = ['id', 'owner', 'uids', 'names', 'shareCode', 'joinKey'];   // 앱이 저장하지 않는 칸
  const SERVER = ['members', 'owner', 'names', 'shareCode', 'joinKey'];        // 바뀐 칸 계산에서 빼는 서버 칸
  const ID = /^[A-Za-z_][A-Za-z0-9_]*$/;
  const toDoc = t => {
    const d = {};
    for (const k of Object.keys(t)) {
      if (APP_SKIP.includes(k)) continue;
      if (k === 'members') { if (t.members) d.people = t.members; continue; }
      if (LISTS.includes(k)) { d[k] = {}; for (const x of t[k] || []) { if (!ID.test(x.id || '')) x.id = k[0] + '_' + gen(12); d[k][x.id] = x; } }
      else d[k] = t[k];
    }
    return clone(d);
  };
  const fromDoc = (id, d, raw) => {
    const t = { ...clone(d), id }; delete t.members; delete t.people;
    t.uids = d.members || [];
    for (const k of LISTS) { const m = t[k] || {}; t[k] = Array.isArray(m) ? m : Object.keys(m).sort().map(i => m[i]); }
    if (Array.isArray(d.people)) t.members = clone(d.people);
    else if (!raw) {
      // 예전 버전에서 '낸 사람'에 계정 아이디가 들어간 기록을 '나'로 되돌리고, 함께 가는 사람을 기록에서 다시 모은다
      const fix = n => t.uids.includes(n) ? '나' : n;
      for (const x of t.expenses) { if (x.payer) x.payer = fix(x.payer); if (Array.isArray(x.split)) x.split = [...new Set(x.split.map(fix))]; }
      t.members = [...new Set(['나', ...t.expenses.flatMap(x => [x.payer, ...(x.split || [])]).filter(Boolean)])];
    }
    return t;
  };
  // 키 순서와 상관없이 비교
  const stable = v => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, i) => (o[i] = x[i], o), {}) : x);
  // base(이 화면이 불러온 상태) → cur(지금 상태)에서 바뀐 칸만
  function diff(base, cur) {
    const up = {};
    for (const k of new Set([...Object.keys(base), ...Object.keys(cur)])) {
      if (SERVER.includes(k)) continue;
      if (LISTS.includes(k)) {
        const a = base[k] || {}, b = cur[k] || {};
        for (const i of new Set([...Object.keys(a), ...Object.keys(b)])) {
          if (!(i in b)) up[`${k}.${i}`] = FV.delete();
          else if (stable(a[i]) !== stable(b[i])) up[`${k}.${i}`] = b[i];
        }
      } else if (!(k in cur)) up[k] = FV.delete();
      else if (stable(base[k]) !== stable(cur[k])) up[k] = cur[k];
    }
    return up;
  }
  const trips = fs.collection('trips');
  const origin = new WeakMap();           // 여행 객체 → 그 객체가 불러온(또는 마지막으로 저장한) 상태
  const pend = new Map(), inflight = new Set(), latest = new Map();
  let unsub = null, onUp = null, onRm = null;
  function stopWatch() { if (unsub) { unsub(); unsub = null; } latest.clear(); }
  function apply(id, d) { const t = fromDoc(id, d); origin.set(t, toDoc(fromDoc(id, d, true))); onUp && onUp(id, t); }
  TN.watch = (up, rm, first) => {
    stopWatch(); onUp = up; onRm = rm; let firstDone = false;
    unsub = trips.where('members', 'array-contains', TN.user.uid).onSnapshot(snap => {
      for (const ch of snap.docChanges()) {
        const id = ch.doc.id;
        if (ch.type === 'removed') { latest.delete(id); rm(id); continue; }
        if (pend.has(id) || inflight.has(id)) { latest.set(id, ch.doc.data()); continue; } // 내가 고치는 중이면 저장 끝난 뒤 반영
        apply(id, ch.doc.data());
      }
      if (!firstDone) { firstDone = true; first && first(); }
    }, e => { console.warn(e); say(/permission/.test(e.code) ? '저장소 규칙이 아직 옛날 버전이에요. Firebase 규칙을 바꿔 주세요.' : '동기화가 끊겼어요. 페이지를 새로고침해 주세요.'); if (!firstDone) { firstDone = true; first && first(); } });
  };
  TN.save = t => {
    const p = pend.get(t.id); if (p) clearTimeout(p.tm);
    pend.set(t.id, { t, tm: setTimeout(() => flush(t.id), 400) });
  };
  async function flush(id) {
    const p = pend.get(id); if (!p) return;
    if (inflight.has(id)) { p.tm = setTimeout(() => flush(id), 300); return; }
    pend.delete(id);
    const t = p.t, cur = toDoc(t), base = origin.get(t), u = TN.user;
    if (!u) return;
    inflight.add(id);
    try {
      if (!base) await ok(trips.doc(id).set({ ...cur, owner: u.uid, members: [u.uid], names: { [u.uid]: u.nick } }));
      else { const up = diff(base, cur); if (Object.keys(up).length) await ok(trips.doc(id).update(up)); }
      origin.set(t, cur);
    } catch (e) {
      console.warn(e);
      if (e.code === 'invalid_argument') say('저장하지 못했어요. 이 여행의 기록이 너무 많아요. 오래된 노트나 일기를 정리해 주세요.');
      else if (e.code === 'quota_exceeded') say('저장 공간이 가득 찼어요. 지난 여행을 백업한 뒤 삭제해 주세요.');
      else say('저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      inflight.delete(id);
      if (!pend.has(id) && latest.has(id)) { const d = latest.get(id); latest.delete(id); apply(id, d); }
    }
  }
  function flushAll() { for (const [id, p] of pend) { clearTimeout(p.tm); flush(id); } }
  TN.flushAll = flushAll;
  TN.remove = async (id, code) => {
    const p = pend.get(id); if (p) { clearTimeout(p.tm); pend.delete(id); }
    if (code) shares.doc(code).delete().catch(() => {});
    try { await ok(trips.doc(id).delete()); } catch { say('삭제하지 못했어요. 다시 시도해 주세요.'); }
  };

  // ----- 여행별 공유: 공유 코드(shares/코드 → 여행)로 참여 -----
  const shares = fs.collection('shares');
  const coded = c => { const e = new Error(c); e.code = c; return e; };
  // 인터넷이 필요한 작업: 10초 안에 안 되면 실패로 본다
  const until = (p, ms = 10000) => Promise.race([p.catch(e => { throw norm(e); }), new Promise((_, no) => setTimeout(() => no(coded('timeout')), ms))]);
  async function flushNow(id) {
    const p = pend.get(id); if (p) { clearTimeout(p.tm); await flush(id); }
    for (let i = 0; i < 100 && inflight.has(id); i++) await new Promise(r => setTimeout(r, 100));
  }
  const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');
  TN.share = async t => {
    await flushNow(t.id);
    for (let i = 0; i < 5; i++) {
      const code = newCode();
      try { await until(shares.doc(code).set({ trip: t.id, owner: TN.user.uid, at: Date.now() })); }
      catch (e) { if (e.code === 'permission_denied' && i < 4) continue; throw e; } // 이미 쓰는 코드면 다시 뽑기
      await until(trips.doc(t.id).update({ shareCode: code }));
      if (t.shareCode) shares.doc(t.shareCode).delete().catch(() => {});
      return code;
    }
  };
  TN.unshare = async t => {
    if (!t.shareCode) return;
    await until(trips.doc(t.id).update({ shareCode: '' }));
    shares.doc(t.shareCode).delete().catch(() => {});
  };
  TN.join = async raw => {
    const code = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, ''), u = TN.user;
    const s = await until(shares.doc(code).get());
    if (!s.exists) throw coded('not_found');
    const id = s.data().trip;
    const mine = await trips.doc(id).get().then(x => x.exists, () => false); // 읽히면 이미 멤버
    if (mine) throw coded('already');
    await until(trips.doc(id).update({ members: FV.arrayUnion(u.uid), ['names.' + u.uid]: u.nick, joinKey: code }));
    return id;
  };
  TN.leave = id => until(trips.doc(id).update({ members: FV.arrayRemove(TN.user.uid) }));
  TN.kick = (id, uid) => until(trips.doc(id).update({ members: FV.arrayRemove(uid) }));

  // ----- 첨부(사진·PDF): 여행 멤버만 볼 수 있게 여행 id를 함께 저장 -----
  const cache = new Map(), loading = new Set(); let tm;
  const bump = () => { clearTimeout(tm); tm = setTimeout(() => window.render && window.render(), 150); };
  const assets = fs.collection('assets');
  TN.assets = {
    async upload(blob, o) {
      const type = blob.type || (o && o.type) || '';
      const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
      const id = 'a_' + gen(16);
      cache.set(id, data);
      // 서버 응답을 기다리지 않는다: 기기에 먼저 저장되고 뒤에서 올라감 (앱을 닫아도 다음에 열면 이어서 올라감)
      assets.doc(id).set({ type, data, ts: Date.now(), owner: TN.user.uid, trip: (o && o.trip) || '' })
        .catch(e => { console.warn(e); say('사진 하나를 저장하지 못했어요. 인터넷 연결을 확인하고 다시 올려 주세요.'); });
      return { id, contentType: type };
    },
    delete: id => ok(assets.doc(id).delete()),
  };
  TN.assetUrl = id => {
    if (cache.has(id)) return cache.get(id);
    if (!loading.has(id)) {
      loading.add(id);
      const retry = () => setTimeout(() => loading.delete(id), 5000); // 다른 사람이 아직 올리는 중이면 잠시 뒤 다시
      assets.doc(id).get().then(s => { if (s.exists) { cache.set(id, s.data().data); bump(); } else retry(); }).catch(retry);
    }
    return null;
  };

  // ----- 예전 '보관함 코드'의 여행을 내 계정으로 옮기기 (기기마다 한 번) -----
  TN.migrate = async () => {
    const u = TN.user; let room = null; try { room = localStorage.getItem('travelnote:room'); } catch {}
    const flag = 'travelnote:migrated:' + u.uid;
    if (!room || localStorage.getItem(flag) === room) return null;
    const old = fs.collection('rooms').doc(room);
    const snap = await old.collection('trips').get();
    let moved = 0, skipped = 0;
    for (const doc of snap.docs) {
      if (!doc.id.startsWith('t_')) continue;
      const ref = trips.doc(doc.id), ex = await ref.get().catch(() => null);
      if (!ex || ex.exists) { skipped++; continue; } // 이미 옮겨졌거나 다른 사람 계정으로 옮겨진 여행
      const t = doc.data();
      await ref.set({ ...toDoc(t), owner: u.uid, members: [u.uid], names: { [u.uid]: u.nick } });
      const files = ['expenses', 'notes', 'diary', 'flights', 'stays'].flatMap(k => (Array.isArray(t[k]) ? t[k] : Object.values(t[k] || {})).flatMap(x => [...(x.photos || []), ...(x.files || [])]));
      for (const a of files) {
        const s = await old.collection('assets').doc(a.id).get().catch(() => null);
        if (s && s.exists) await assets.doc(a.id).set({ ...s.data(), owner: u.uid, trip: doc.id }).catch(() => {});
      }
      moved++;
    }
    localStorage.setItem(flag, room);
    return { moved, skipped };
  };

  TN.downloads = { async save({ filename, data }) {
    const blob = new Blob([data], { type: /\.csv$/i.test(filename) ? 'text/csv' : 'application/json' });
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: filename }); return; }
      catch (e) { if (e && e.name === 'AbortError') { const x = new Error('declined'); x.code = 'declined'; throw x; } }
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  } };
})();
