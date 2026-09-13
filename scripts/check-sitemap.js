#!/usr/bin/env node
/**
 * check-sitemap.js — la sitemap resta scritta a mano, ma non può divergere dal sito.
 *
 * Fallisce se: una URL in sitemap non ha un file corrispondente; una pagina marcata
 * noindex è in sitemap (Search Console la segnala come errore); una guida pubblicata
 * manca dalla sitemap; il lastmod di una guida non coincide con il suo dateModified;
 * un indice delle guide manca, o non porta la data della guida aggiornata per ultima.
 *
 * Uso: npm run check:sitemap
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://studiolegalelofoco.com/';
const GUIDE_DIR = path.join(ROOT, 'content', 'guide');

const errori = [];
const dateGuide = [];
const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');

const voci = [...sitemap.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*(?:<lastmod>([^<]*)<\/lastmod>)?/g)]
  .map((m) => ({ loc: m[1].trim(), lastmod: (m[2] || '').trim() }));

const inSitemap = new Map();
for (const v of voci) {
  if (!v.loc.startsWith(SITE)) { errori.push(`URL fuori dal sito in sitemap: ${v.loc}`); continue; }
  const file = v.loc.slice(SITE.length) || 'index.html';
  inSitemap.set(file, v);

  if (!fs.existsSync(path.join(ROOT, file))) {
    errori.push(`sitemap cita un file che non esiste: ${file}`);
    continue;
  }
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  if (/<meta[^>]+name=["']robots["'][^>]+noindex/i.test(html)) {
    errori.push(`${file} è marcata noindex ma sta in sitemap`);
  }
}

// guide pubblicate: devono essere in sitemap, con la data giusta
if (fs.existsSync(GUIDE_DIR)) {
  for (const f of fs.readdirSync(GUIDE_DIR).filter((x) => x.endsWith('.json'))) {
    let g;
    try { g = JSON.parse(fs.readFileSync(path.join(GUIDE_DIR, f), 'utf8')); } catch { continue; }
    const pagina = `guida-${g.slug}.html`;
    if (g.status === 'published') {
      dateGuide.push(g.dateModified);
      const voce = inSitemap.get(pagina);
      if (!voce) errori.push(`guida pubblicata assente dalla sitemap: ${pagina}`);
      else if (voce.lastmod !== g.dateModified) {
        errori.push(`${pagina}: lastmod ${voce.lastmod || '(vuoto)'} diverso da dateModified ${g.dateModified}`);
      }
    } else if (inSitemap.has(pagina)) {
      errori.push(`${pagina} è in sitemap ma la guida non è pubblicata (status: ${g.status})`);
    }
  }
}

// indici delle guide: generati, devono stare in sitemap con la data della guida più recente,
// altrimenti il lastmod dell'indice resta fermo mentre le guide si aggiornano
if (dateGuide.length) {
  const ultima = dateGuide.sort().pop();
  for (const indice of ['guide.html', 'guides-en.html']) {
    const voce = inSitemap.get(indice);
    if (!voce) errori.push(`indice delle guide assente dalla sitemap: ${indice}`);
    else if (voce.lastmod !== ultima) errori.push(`${indice}: lastmod ${voce.lastmod || '(vuoto)'} diverso dall'ultimo aggiornamento delle guide ${ultima}`);
  }
}

// pagine indicizzabili non ancora in sitemap: avviso, non errore
const avvisi = [];
for (const f of fs.readdirSync(ROOT).filter((x) => x.endsWith('.html'))) {
  if (f === '404.html' || inSitemap.has(f)) continue;
  const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
  if (!/<meta[^>]+name=["']robots["'][^>]+noindex/i.test(html)) avvisi.push(`${f} non è in sitemap`);
}

for (const a of avvisi) console.log('⚠︎ ' + a);
if (errori.length) {
  console.error(`\n❌ ${errori.length} problemi nella sitemap:\n`);
  for (const e of errori) console.error('  • ' + e);
  process.exit(1);
}
console.log(`✓ Sitemap coerente: ${voci.length} URL${avvisi.length ? `, ${avvisi.length} avvisi` : ''}.`);
