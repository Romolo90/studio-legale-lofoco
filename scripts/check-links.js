#!/usr/bin/env node
/**
 * check-links.js — raggiungibilità dei link esterni citati come fonte.
 *
 * Gira settimanale e a mano, MAI in fase di pubblicazione: il deploy non deve
 * dipendere dal firewall di terzi. cinema.cultura.gov.it sta dietro Cloudflare e
 * risponde 403 alle richieste automatiche, quindi 403 e 429 sono avvisi, non errori;
 * sono errori solo 404, 410 e i 5xx, che indicano una fonte davvero sparita.
 *
 * Uso: npm run check:links
 *      node scripts/check-links.js --id tc-produzione
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
const TIMEOUT = 15000;
const CONCORRENZA = 4;

const argId = (() => {
  const i = process.argv.indexOf('--id');
  return i > -1 ? process.argv[i + 1] : null;
})();

function raccogli() {
  const urls = new Map(); // url -> [dove]
  const aggiungi = (url, dove) => {
    if (!/^https?:\/\//i.test(url)) return;
    if (!urls.has(url)) urls.set(url, []);
    if (!urls.get(url).includes(dove)) urls.get(url).push(dove);
  };

  const guideDir = path.join(ROOT, 'content', 'guide');
  if (fs.existsSync(guideDir)) {
    for (const f of fs.readdirSync(guideDir).filter((x) => x.endsWith('.json'))) {
      let g;
      try { g = JSON.parse(fs.readFileSync(path.join(guideDir, f), 'utf8')); } catch { continue; }
      if (argId && g.id !== argId) continue;
      for (const s of g.sources || []) aggiungi(s.url, `${f} (fonte ${s.id})`);
    }
  }

  if (!argId) {
    for (const f of ['data/notizie-it.json', 'data/notizie-en.json']) {
      let d;
      try { d = JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')); } catch { continue; }
      for (const it of [...(d.newsItems || []), ...(d.articles || [])]) {
        if (it.link) aggiungi(it.link, f);
        if (it.secondaryLink && it.secondaryLink.url) aggiungi(it.secondaryLink.url, f);
      }
    }
  }
  return urls;
}

async function prova(url) {
  const opzioni = { redirect: 'follow', headers: { 'user-agent': UA, accept: '*/*' } };
  for (const metodo of ['HEAD', 'GET']) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), TIMEOUT);
    try {
      const r = await fetch(url, { ...opzioni, method: metodo, signal: ac.signal });
      clearTimeout(t);
      if (r.status === 405 || (metodo === 'HEAD' && (r.status === 403 || r.status === 404))) continue; // riprova in GET
      return { status: r.status };
    } catch (e) {
      clearTimeout(t);
      if (metodo === 'GET') return { status: 0, errore: e.name === 'AbortError' ? 'timeout' : e.message };
    }
  }
  return { status: 0, errore: 'nessuna risposta' };
}

async function main() {
  const urls = raccogli();
  if (!urls.size) { console.log('✓ Nessun link esterno da controllare.'); return; }

  const elenco = [...urls.keys()];
  const esiti = new Map();
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(CONCORRENZA, elenco.length) }, async () => {
    while (i < elenco.length) {
      const url = elenco[i++];
      esiti.set(url, await prova(url));
    }
  }));

  const errori = [];
  const avvisi = [];
  for (const [url, e] of esiti) {
    const dove = urls.get(url).join(', ');
    if (e.status >= 200 && e.status < 400) continue;
    if (e.status === 403 || e.status === 429) avvisi.push(`${e.status} (probabile blocco anti-bot) ${url} — ${dove}`);
    else if (e.status === 0) avvisi.push(`nessuna risposta (${e.errore}) ${url} — ${dove}`);
    else errori.push(`${e.status} ${url} — ${dove}`);
  }

  for (const a of avvisi) console.log('⚠︎ ' + a);
  if (errori.length) {
    console.error(`\n❌ ${errori.length} fonti non raggiungibili:\n`);
    for (const e of errori) console.error('  • ' + e);
    process.exit(1);
  }
  console.log(`✓ ${elenco.length} link esterni controllati, nessuno risulta sparito${avvisi.length ? ` (${avvisi.length} avvisi)` : ''}.`);
}

main();
