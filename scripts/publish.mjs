// Uploads data.js (kept out of git) to Firestore so only signed-in users can read it.
// Usage: node scripts/publish.mjs   (or set MK_EMAIL / MK_PASSWORD)
import fs from 'node:fs';
import vm from 'node:vm';
import readline from 'node:readline';

const API_KEY = 'AIzaSyB-IzKr5hhvuoXKfSbg4vwMH_viwVPUmWs';
const DOC = 'https://firestore.googleapis.com/v1/projects/miami-keys/databases/(default)/documents/trips/mk26_content';
const REFERER = 'https://rcaram22.github.io/';

const code = fs.readFileSync(new URL('../data.js', import.meta.url), 'utf8');
const content = vm.runInNewContext(code + '\n;({ DAYS, CATS, TODO, LISTS, TRIP })');
for (const k of ['DAYS', 'CATS', 'TODO', 'LISTS', 'TRIP']) {
  if (!content[k]) throw new Error(`data.js is missing ${k}`);
}

function ask(question, hidden) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) rl._writeToOutput = s => { if (s.includes(question)) rl.output.write(question); };
    rl.question(question, answer => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer);
    });
  });
}

const email = process.env.MK_EMAIL || await ask('Correo: ');
const password = process.env.MK_PASSWORD || await ask('Contraseña: ', true);

const auth = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Referer: REFERER },
  body: JSON.stringify({ email, password, returnSecureToken: true }),
}).then(r => r.json());
if (!auth.idToken) {
  console.error('No se pudo iniciar sesión:', auth.error?.message || auth);
  process.exit(1);
}

const json = JSON.stringify(content);
const res = await fetch(`${DOC}?updateMask.fieldPaths=json&updateMask.fieldPaths=updatedAt`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.idToken}`, Referer: REFERER },
  body: JSON.stringify({
    fields: {
      json: { stringValue: json },
      updatedAt: { timestampValue: new Date().toISOString() },
    },
  }),
});
if (!res.ok) {
  console.error('Firestore rechazó la escritura:', res.status, await res.text());
  process.exit(1);
}
console.log(`Publicado: ${content.DAYS.length} días, ${content.LISTS.length} listas, ${(json.length / 1024).toFixed(1)} KB.`);
