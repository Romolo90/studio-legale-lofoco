#!/usr/bin/env node
/**
 * prepara.js — la parte meccanica di ogni pubblicazione, sul branch di lavoro.
 *
 * Uso: npm run prepara               (anche con modifiche non ancora committate)
 *      node scripts/prepara.js --verifica
 *        come sopra, ma fallisce se ha dovuto cambiare qualcosa: lo usa pubblica.js
 *        per accertarsi che il branch committato sia già pronto.
 *
 * Fa, nell'ordine:
 * 1. rigenera le pagine: build:guide se è cambiata una guida, poi build:html;
 * 2. se sono cambiate le Novità, porta al mese corrente la frase «aggiornate a …» /
 *    «updated as of …» dell'introduzione, che è statica e il build non tocca;
 * 3. sposta a oggi il lastmod della sitemap SOLO per le pagine il cui contenuto è
 *    cambiato rispetto a origin/main: conta il testo dentro <main> (link compresi),
 *    il title e la meta description; header, footer, script e JSON-LD no, perché un
 *    commit su icone o footer non è un aggiornamento della pagina e Google ignora i
 *    lastmod gonfiati. Le guide e i loro indici restano esclusi: seguono dateModified
 *    e li controlla check:sitemap;
 * 4. lancia i controlli: JSON leggibili, npm run check, build idempotente, frasi a scadenza.
 *
 * Non fa commit e non pubblica: il push lo lancia l'avvocato con `pubblica-sito`.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { controllaScadenze, stampa } = require('./check-scadenze');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://studiolegalelofoco.com/';
const BASE = 'origin/main';
const VERIFICA = process.argv.includes('--verifica');
const MARKER_GUIDA = 'GENERATO da scripts/build-guide.js';
const INDICI_GUIDE = ['guide.html', 'guides-en.html'];

const MESI_IT = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const MESI_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const INTRO = [
  { file: 'notizie.html', dati: 'data/notizie-it.json', re: new RegExp(`aggiornate a (${MESI_IT.join('|')}) (\\d{4})`), mesi: MESI_IT, forma: (m, a) => `aggiornate a ${m} ${a}` },
  { file: 'notizie-en.html', dati: 'data/notizie-en.json', re: new RegExp(`updated as of (${MESI_EN.join('|')}) (\\d{4})`), mesi: MESI_EN, forma: (m, a) => `updated as of ${m} ${a}` },
];

const oggi = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();

function esegui(cmd, args, { mostra = false } = {}) {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: mostra ? 'inherit' : 'pipe' });
  return { ok: r.status === 0, out: (r.stdout || '') + (r.stderr || '') };
}
const git = (...args) => esegui('git', args);
const leggi = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const hash = (f) => (fs.existsSync(path.join(ROOT, f)) ? crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, f))).digest('hex') : '');

function fileCambiati() {
  const diff = git('diff', '--name-only', BASE).out.split('\n');
  const nuovi = git('ls-files', '--others', '--exclude-standard').out.split('\n');
  return new Set([...diff, ...nuovi].map((s) => s.trim()).filter(Boolean));
}

// Il contenuto che conta per il lastmod (vedi l'intestazione).
function firma(html) {
  const main = (html.match(/<main[\s\S]*?<\/main>/i) || [html])[0];
  const testo = main
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<a\s[^>]*href=["']([^"']*)["'][^>]*>/gi, ' [$1] ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const title = ((html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '').trim();
  const meta = (html.match(/<meta[^>]+name=["']description["'][^>]*>/i) || [''])[0];
  const desc = (meta.match(/content=["']([^"']*)["']/i) || [])[1] || '';
  return [title, desc, testo].join('\n');
}

const pagineRoot = () => fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));
const impronte = () => Object.fromEntries([...pagineRoot(), 'sitemap.xml'].map((f) => [f, hash(f)]));

const scritti = new Set();
const problemi = [];
const note = [];

// 0. punto di partenza
const fetch = git('fetch', 'origin', 'main', '--quiet');
if (!fetch.ok) note.push(`git fetch non riuscito, confronto con l'ultima copia nota di ${BASE}`);
const branch = git('rev-parse', '--abbrev-ref', 'HEAD').out.trim();
if (branch === 'main' && !VERIFICA) note.push('sei su main: di regola si lavora su un branch (novita-AAAA-MM-GG o simile)');

// 1. build
const prima = impronte();
let cambiati = fileCambiati();
if ([...cambiati].some((f) => f.startsWith('content/guide/') && f.endsWith('.json'))) {
  const g = esegui('node', ['scripts/build-guide.js']);
  if (!g.ok) problemi.push('build:guide non riuscito:\n' + g.out.trim().split('\n').slice(-15).join('\n'));
}
const b = esegui('node', ['scripts/build.js']);
if (!b.ok) problemi.push('build:html non riuscito:\n' + b.out.trim().split('\n').slice(-15).join('\n'));
const dopoBuild = impronte();
for (const f of Object.keys(dopoBuild)) if (dopoBuild[f] !== prima[f]) scritti.add(f);
cambiati = fileCambiati();

// 2. introduzione delle Novità
const [annoOggi, meseOggi] = oggi.split('-').map(Number);
for (const v of INTRO) {
  if (!cambiati.has(v.dati)) continue;
  const html = leggi(v.file);
  const m = html.match(v.re);
  if (!m) { problemi.push(`${v.file}: non trovo la frase «${v.forma('…', '…')}» dell'introduzione`); continue; }
  const meseFrase = v.mesi.indexOf(m[1]) + 1;
  const annoFrase = Number(m[2]);
  if (annoFrase * 12 + meseFrase >= annoOggi * 12 + meseOggi) continue;
  fs.writeFileSync(path.join(ROOT, v.file), html.replace(v.re, v.forma(v.mesi[meseOggi - 1], annoOggi)));
  scritti.add(v.file);
  note.push(`${v.file}: introduzione portata a «${v.forma(v.mesi[meseOggi - 1], annoOggi)}»`);
}

// 3. lastmod della sitemap
const sitemap = leggi('sitemap.xml');
const spostati = [];
const nuovaSitemap = sitemap.replace(
  /(<url>\s*<loc>)([^<]+)(<\/loc>\s*<lastmod>)([^<]*)(<\/lastmod>)/g,
  (tutto, a, loc, c, lastmod, e) => {
    const file = loc.trim().slice(SITE.length) || 'index.html';
    if (!file.endsWith('.html') || !fs.existsSync(path.join(ROOT, file))) return tutto;
    if (INDICI_GUIDE.includes(file)) return tutto;
    const ora = leggi(file);
    if (ora.includes(MARKER_GUIDA)) return tutto;
    if (lastmod >= oggi) return tutto;
    const base = git('show', `${BASE}:${file}`);
    if (base.ok && firma(base.out) === firma(ora)) return tutto;
    spostati.push(`${file} (${lastmod} → ${oggi})`);
    return a + loc + c + oggi + e;
  }
);
if (nuovaSitemap !== sitemap) {
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), nuovaSitemap);
  scritti.add('sitemap.xml');
}

// 4. controlli
for (const f of [...fs.readdirSync(path.join(ROOT, 'data')).map((x) => 'data/' + x), ...fs.readdirSync(path.join(ROOT, 'content', 'guide')).map((x) => 'content/guide/' + x), 'content/scadenze-sito.json']) {
  if (!f.endsWith('.json')) continue;
  try { JSON.parse(leggi(f)); } catch (err) { problemi.push(`${f}: JSON non valido (${err.message})`); }
}
const check = esegui('npm', ['run', '--silent', 'check']);
if (!check.ok) problemi.push('npm run check non superato:\n' + check.out.trim().split('\n').slice(-25).join('\n'));
const primaIdem = impronte();
esegui('node', ['scripts/build.js']);
const dopoIdem = impronte();
const nonIdem = Object.keys(dopoIdem).filter((f) => dopoIdem[f] !== primaIdem[f]);
if (nonIdem.length) problemi.push(`il build non è idempotente, ha cambiato di nuovo: ${nonIdem.join(', ')}`);

// riepilogo
const avanti = git('rev-list', '--count', `${BASE}..HEAD`).out.trim();
const sporchi = git('status', '--porcelain').out.split('\n').filter(Boolean);
console.log(`\nBranch ${branch}: ${avanti} commit oltre ${BASE}, ${sporchi.length} file non committati.`);
console.log(scritti.size ? `File rigenerati o aggiornati ora: ${[...scritti].join(', ')}` : 'Nessun file da rigenerare o aggiornare.');
if (spostati.length) console.log(`lastmod spostati a oggi:\n  • ${spostati.join('\n  • ')}`);
for (const n of note) console.log('· ' + n);

console.log('');
try {
  stampa(controllaScadenze(), { compatto: true });
} catch (err) {
  problemi.push(`registro delle scadenze illeggibile: ${err.message}`);
}

if (VERIFICA && scritti.size) {
  problemi.push(`il branch non era pronto: ho dovuto aggiornare ${[...scritti].join(', ')}. Vanno ricontrollati e committati prima di pubblicare.`);
}
if (problemi.length) {
  console.error(`\n❌ Non pronto per la pubblicazione:\n`);
  for (const p of problemi) console.error('  • ' + p.replace(/\n/g, '\n    '));
  process.exit(1);
}
console.log(VERIFICA ? '\n✓ Branch pronto: build, date e controlli a posto.' : '\n✓ Controlli superati. Rileggere le modifiche, committare, poi «pubblica-sito».');
