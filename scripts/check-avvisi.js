#!/usr/bin/env node
/**
 * check-avvisi.js — segnala gli avvisi ufficiali della DG Cinema non ancora
 * presenti in data/notizie-*.json (Ultime Novità).
 *
 * Uso: npm run check:avvisi   (oppure: node scripts/check-avvisi.js)
 *
 * Best-effort: scarica l'elenco pubblico degli avvisi e confronta i link
 * /avvisi/<slug>/ con quelli gia' citati nel JSON. NON aggiorna nulla: stampa
 * solo i nuovi, che vanno verificati e (se pertinenti) aggiunti a mano,
 * seguendo la metodologia forense (verifica su fonte primaria prima di citare).
 */

const fs = require('fs');
const path = require('path');

const INDEX = 'https://cinema.cultura.gov.it/comunicazione/avvisi/';
const ROOT = path.join(__dirname, '..');

function linksFromJson() {
  const set = new Set();
  for (const f of ['data/notizie-it.json', 'data/notizie-en.json']) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
      for (const it of [...(j.newsItems || []), ...(j.articles || [])]) {
        if (it.link) set.add(it.link.replace(/\/$/, ''));
        if (it.secondaryLink && it.secondaryLink.url) set.add(it.secondaryLink.url.replace(/\/$/, ''));
      }
    } catch (e) { /* ignore */ }
  }
  return set;
}

async function main() {
  let html;
  try {
    const res = await fetch(INDEX, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; SLLF-check/1.0)' } });
    if (!res.ok) { console.error('Errore HTTP', res.status, 'su', INDEX); process.exit(1); }
    html = await res.text();
  } catch (e) {
    console.error('Impossibile scaricare l’elenco avvisi:', e.message);
    process.exit(1);
  }

  // estrai i link di dettaglio /avvisi/<slug>/
  const found = new Map(); // url -> slug
  const re = /https:\/\/cinema\.cultura\.gov\.it\/avvisi\/([a-z0-9-]+)\/?/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const url = ('https://cinema.cultura.gov.it/avvisi/' + m[1]).replace(/\/$/, '');
    found.set(url, m[1]);
  }

  const known = linksFromJson();
  const fresh = [...found.keys()].filter(u => !known.has(u));

  if (!fresh.length) {
    console.log('✓ Nessun nuovo avviso: il JSON è allineato all’elenco ufficiale.');
    return;
  }
  console.log(`\nTrovati ${fresh.length} avvisi non ancora citati in data/notizie-*.json:\n`);
  for (const u of fresh) {
    console.log('  •', u + '/');
  }
  console.log('\nVerifica ciascuno sulla pagina ufficiale prima di aggiungerlo (data, D.D. rep., oggetto),');
  console.log('poi inserisci le voci pertinenti in cima a "newsItems" e ricorri a `npm run build:html`.');
}

main();
