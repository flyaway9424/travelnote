import fs from 'fs';
fs.mkdirSync('www/vendor', { recursive: true });
for (const n of ['app', 'firestore', 'auth']) {
  const r = await fetch(`https://www.gstatic.com/firebasejs/10.12.5/firebase-${n}-compat.js`);
  if (!r.ok) throw new Error('download failed ' + n);
  fs.writeFileSync(`www/vendor/firebase-${n}-compat.js`, Buffer.from(await r.arrayBuffer()));
}
