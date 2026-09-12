#!/usr/bin/env node
/**
 * check-anchors.js — link interni e ancore.
 *
 * La CI controlla già che un href .html punti a un file esistente, ma non che il
 * frammento #qualcosa esista davvero nella pagina di destinazione: un link che
 * atterra a vuoto è indistinguibile da uno rotto, per chi legge.
 * Controlla anche gli url con frammento dentro i blocchi JSON-LD, dove un'ancora
 * inesistente diventa un dato strutturato sbagliato.
 *
 * Uso: npm run check:anchors
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://studiolegalelofoco.com/';

const errori = [];

const files = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html') && !f.startsWith('.'));
const contenuti = new Map(files.map((f) => [f, fs.readFileSync(path.join(ROOT, f), 'utf8')]));

// id presenti in ogni pagina (compresi name= delle ancore storiche)
const idsPerFile = new Map();
for (const [f, c] of contenuti) {
  const ids = new Set();
  for (const m of c.matchAll(/\sid=["']([^"']+)["']/g)) ids.add(m[1]);
  for (const m of c.matchAll(/<a[^>]+name=["']([^"']+)["']/g)) ids.add(m[1]);
  idsPerFile.set(f, ids);
}

function verifica(origine, pagina, frammento, contesto) {
  if (!frammento) return;
  const target = pagina || origine;
  if (!contenuti.has(target)) return; // file mancanti: già coperti dal check dei link interni
  if (!idsPerFile.get(target).has(frammento)) {
    errori.push(`${origine}${contesto}: "#${frammento}" non esiste in ${target}`);
  }
}

for (const [f, c] of contenuti) {
  // href="pagina.html#frammento" oppure href="#frammento"
  for (const m of c.matchAll(/href=["']([^"']*#[^"']+)["']/g)) {
    const val = m[1];
    if (/^https?:\/\//i.test(val) && !val.startsWith(SITE)) continue;
    const pulito = val.replace(SITE, '').replace(/^\.\//, '').replace(/^\//, '');
    const [pagina, frammento] = pulito.split('#');
    if (pagina && !pagina.endsWith('.html')) continue;
    verifica(f, pagina || null, frammento, ' (link)');
  }

  // url con frammento dentro i dati strutturati
  for (const blocco of c.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    for (const m of blocco[1].matchAll(/"url"\s*:\s*"([^"]*#[^"]+)"/g)) {
      const pulito = m[1].replace(SITE, '').replace(/^\//, '');
      const [pagina, frammento] = pulito.split('#');
      verifica(f, pagina || null, frammento, ' (JSON-LD)');
    }
  }
}

if (errori.length) {
  console.error(`❌ ${errori.length} ancore che non esistono:\n`);
  for (const e of errori) console.error('  • ' + e);
  process.exit(1);
}
console.log(`✓ Ancore verificate su ${files.length} pagine: nessun frammento rotto.`);
