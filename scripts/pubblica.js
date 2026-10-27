#!/usr/bin/env node
/**
 * pubblica.js — mette online il branch di lavoro e controlla che il sito servito sia
 * quello del repo. Lo lancia l'avvocato, perché il push a Claude è precluso:
 *
 *   ! pubblica-sito          dal prompt di Claude Code
 *   pubblica-sito            dal Terminale (lì senza «!», che inverte l'esito)
 *   pubblica-sito --prova    dice cosa pubblicherebbe e si ferma prima del merge
 *
 * Passi: il branch dev'essere committato e partire dall'ultima versione online;
 * `prepara.js --verifica` rifà build, date e controlli e si ferma se manca qualcosa;
 * poi merge --ff-only su main e push; attesa della CI e del deploy di GitHub Pages
 * (API pubblica, una richiesta al minuto: il limite anonimo è 60 l'ora e il 23/10 un
 * polling ogni 15 s l'ha esaurito); infine ogni file cambiato viene scaricato dal sito
 * e confrontato col repo, al netto di ciò che Cloudflare inietta (offuscamento delle
 * email, script anti-bot). Se combacia tutto, il branch locale viene cancellato.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://studiolegalelofoco.com/';
const API = 'https://api.github.com/repos/Romolo90/studio-legale-lofoco';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const PROVA = process.argv.includes('--prova');
const WORKFLOW = ['CI - Validate site', 'pages build and deployment'];
const ATTESA_DEPLOY_MIN = 20;
const TENTATIVI_CONFRONTO = 10;
const LOG = path.join(ROOT, '.git', 'pubblicazioni.log');

function esegui(cmd, args, { mostra = false } = {}) {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: mostra ? 'inherit' : 'pipe' });
  return { ok: r.status === 0, out: ((r.stdout || '') + (r.stderr || '')).trim() };
}
const git = (...args) => esegui('git', args);
const ora = () => new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
const dorme = (s) => new Promise((r) => setTimeout(r, s * 1000));

function fine(msg, codice = 1) {
  console.error(`\n${codice ? '❌' : '✓'} ${msg}`);
  process.exit(codice);
}

function registra(riga) {
  try { fs.appendFileSync(LOG, `${new Date().toISOString()} ${riga}\n`); } catch { /* il log è un di più */ }
}

// Quello che GitHub Pages non serve (_config.yml → exclude, più le regole di Jekyll).
function servito(file) {
  const exclude = (fs.readFileSync(path.join(ROOT, '_config.yml'), 'utf8').match(/^\s*-\s*(.+)$/gm) || [])
    .map((r) => r.replace(/^\s*-\s*/, '').replace(/^"|"$/g, '').trim());
  if (/(^|\/)[._]/.test(file)) return false;
  for (const e of exclude) {
    if (e.endsWith('/') && file.startsWith(e)) return false;
    if (e.startsWith('*') && file.endsWith(e.slice(1))) return false;
    if (file === e) return false;
  }
  return true;
}

// Toglie dalla pagina servita ciò che aggiunge Cloudflare e rimette le email in chiaro.
function decodificaEmail(hex) {
  const k = parseInt(hex.slice(0, 2), 16);
  let s = '';
  for (let i = 2; i < hex.length; i += 2) s += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ k);
  return s;
}
function normalizza(html) {
  return html
    .replace(/<a href="\/cdn-cgi\/l\/email-protection" class="__cf_email__" data-cfemail="([0-9a-f]+)">\[email&#160;protected\]<\/a>/g, (_, h) => decodificaEmail(h))
    .replace(/<span class="__cf_email__" data-cfemail="([0-9a-f]+)">\[email&#160;protected\]<\/span>/g, (_, h) => decodificaEmail(h))
    .replace(/\/cdn-cgi\/l\/email-protection#([0-9a-f]+)/g, (_, h) => 'mailto:' + decodificaEmail(h))
    .replace(/<script data-cfasync="false" src="\/cdn-cgi\/scripts\/[^"]*email-decode\.min\.js"><\/script>/g, '')
    .replace(/<script>\(function\(\)\{function c\(\)[\s\S]*?challenge-platform[\s\S]*?<\/script>/g, '');
}

function scarica(file, versione) {
  const dest = path.join(os.tmpdir(), `sllf-${process.pid}-${crypto.randomBytes(4).toString('hex')}`);
  const url = SITE + file + `?v=${versione}`;
  const r = spawnSync('curl', ['-s', '-A', UA, '-o', dest, '-w', '%{http_code}', '--max-time', '30', url], { encoding: 'utf8' });
  const codice = Number(r.stdout) || 0;
  const corpo = fs.existsSync(dest) ? fs.readFileSync(dest) : Buffer.alloc(0);
  try { fs.unlinkSync(dest); } catch { /* niente */ }
  return { codice, corpo };
}

function primaDifferenza(a, b) {
  const ra = a.split('\n');
  const rb = b.split('\n');
  for (let i = 0; i < Math.max(ra.length, rb.length); i++) {
    if (ra[i] !== rb[i]) return `riga ${i + 1}: repo «${(ra[i] || '').trim().slice(0, 120)}» / sito «${(rb[i] || '').trim().slice(0, 120)}»`;
  }
  return '';
}

// Confronta un file del repo con quello servito. Restituisce '' se combacia.
function confronta(file, versione, eliminato) {
  const { codice, corpo } = scarica(file, versione);
  if (eliminato) return codice === 404 ? '' : `doveva essere sparito, il sito risponde ${codice}`;
  if (codice !== 200) return `il sito risponde ${codice}`;
  const locale = fs.readFileSync(path.join(ROOT, file));
  if (/\.(html?|json|xml|txt|css|js|svg|webmanifest)$/i.test(file)) {
    const a = locale.toString('utf8');
    const b = file.endsWith('.html') ? normalizza(corpo.toString('utf8')) : corpo.toString('utf8');
    return a === b ? '' : `contenuto diverso, ${primaDifferenza(a, b)}`;
  }
  return Buffer.compare(locale, corpo) === 0 ? '' : 'file binario diverso';
}

async function statoAzioni(sha) {
  try {
    const res = await fetch(`${API}/actions/runs?head_sha=${sha}&per_page=20`, { headers: { 'user-agent': 'SLLF-pubblica/1.0', accept: 'application/vnd.github+json' } });
    if (!res.ok) return { errore: `API GitHub ${res.status}${res.status === 403 ? ' (limite di richieste: riprovo)' : ''}` };
    const j = await res.json();
    return { corse: (j.workflow_runs || []).map((r) => ({ nome: r.name, stato: r.status, esito: r.conclusion, url: r.html_url })) };
  } catch (e) {
    return { errore: `API GitHub non raggiungibile (${e.message})` };
  }
}

async function main() {
  // 1. il branch è pronto?
  if (!git('fetch', 'origin', '--quiet').ok) fine('git fetch non riuscito: niente rete? Non ho fatto niente.');
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD').out;
  const sporchi = git('status', '--porcelain', '--untracked-files=no').out.split('\n').filter(Boolean);
  if (sporchi.length) fine(`ci sono modifiche non committate (${sporchi.length} file): vanno committate o lasciate a Claude. Non ho fatto niente.\n  ${sporchi.slice(0, 10).join('\n  ')}`);
  const nuovi = git('ls-files', '--others', '--exclude-standard').out.split('\n').filter(Boolean);
  if (!git('merge-base', '--is-ancestor', 'origin/main', 'HEAD').ok) fine(`${branch} non parte dall'ultima versione online (origin/main è andato avanti): va riallineato. Non ho fatto niente.`);
  const commit = git('log', '--oneline', '--no-decorate', 'origin/main..HEAD').out.split('\n').filter(Boolean);
  if (!commit.length) fine('niente da pubblicare: il branch coincide con la versione online.', 0);

  console.log(`Da pubblicare (${branch}, ${commit.length} commit):\n  ${commit.join('\n  ')}`);
  if (nuovi.length) console.log(`· File non tracciati che NON vanno online: ${nuovi.slice(0, 8).join(', ')}${nuovi.length > 8 ? '…' : ''}`);

  console.log('\nControlli (build, date, validazione)…');
  const verifica = esegui('node', ['scripts/prepara.js', '--verifica']);
  console.log(verifica.out.split('\n').map((r) => '  ' + r).join('\n'));
  if (!verifica.ok) fine('controlli non superati: non ho pubblicato niente.');

  const base = git('rev-parse', 'origin/main').out;
  const cambi = git('diff', '--name-status', '--no-renames', base, 'HEAD').out.split('\n').filter(Boolean)
    .map((r) => { const [stato, file] = r.split('\t'); return { file, eliminato: stato === 'D' }; })
    .filter((c) => servito(c.file));
  console.log(`\nFile del sito che cambiano: ${cambi.length ? cambi.map((c) => c.file + (c.eliminato ? ' (eliminato)' : '')).join(', ') : 'nessuno (solo file interni)'}`);

  if (PROVA) fine('prova: mi fermo qui, nessun merge e nessun push.', 0);

  // 2. merge e push
  if (branch !== 'main') {
    const co = git('checkout', 'main');
    if (!co.ok) fine(`checkout di main non riuscito:\n${co.out}`);
    const mg = git('merge', '--ff-only', branch);
    if (!mg.ok) fine(`merge --ff-only non riuscito (main locale divergente?):\n${mg.out}`);
  }
  const sha = git('rev-parse', 'HEAD').out;
  console.log(`\n[${ora()}] Push di ${sha.slice(0, 7)} su origin/main…`);
  const push = esegui('git', ['push', 'origin', 'main'], { mostra: true });
  if (!push.ok) fine('push non riuscito. Il merge su main locale è fatto: rilanciando pubblica-sito da main si riprova solo il push.');
  registra(`push ${sha.slice(0, 7)} da ${branch}: ${commit.length} commit`);

  // 3. CI e deploy
  console.log(`\nAttendo CI e GitHub Pages (controllo una volta al minuto, al massimo ${ATTESA_DEPLOY_MIN} minuti)…`);
  let corse = [];
  let apiOk = false;
  for (let i = 0; i < ATTESA_DEPLOY_MIN; i++) {
    await dorme(60);
    const s = await statoAzioni(sha);
    if (s.errore) { console.log(`  [${ora()}] ${s.errore}`); continue; }
    apiOk = true;
    corse = s.corse.filter((c) => WORKFLOW.includes(c.nome));
    console.log(`  [${ora()}] ${WORKFLOW.map((n) => { const c = corse.find((x) => x.nome === n); return `${n}: ${c ? (c.esito || c.stato) : 'non ancora partita'}`; }).join(' · ')}`);
    if (WORKFLOW.every((n) => corse.some((c) => c.nome === n && c.stato === 'completed'))) break;
  }
  const falliti = corse.filter((c) => c.stato === 'completed' && c.esito !== 'success');
  if (falliti.length) {
    registra(`FALLITO ${sha.slice(0, 7)}: ${falliti.map((c) => c.nome + ' ' + c.esito).join(', ')}`);
    fine(`online qualcosa non va: ${falliti.map((c) => `${c.nome} → ${c.esito} (${c.url})`).join('; ')}`);
  }
  const deploy = corse.find((c) => c.nome === WORKFLOW[1] && c.stato === 'completed');
  if (!deploy) console.log(apiOk ? '  Il deploy non risulta concluso nel tempo previsto: confronto lo stesso le pagine.' : '  API GitHub mai raggiungibile: passo direttamente al confronto delle pagine.');

  // 4. confronto con il sito servito
  const versione = sha.slice(0, 7);
  let mancano = cambi;
  for (let t = 1; t <= TENTATIVI_CONFRONTO && mancano.length; t++) {
    if (t > 1) await dorme(60);
    const esiti = mancano.map((c) => ({ ...c, diff: confronta(c.file, versione + t, c.eliminato) }));
    mancano = esiti.filter((e) => e.diff);
    console.log(`  [${ora()}] confronto ${t}/${TENTATIVI_CONFRONTO}: ${cambi.length - mancano.length}/${cambi.length} file identici al repo`);
    if (t === TENTATIVI_CONFRONTO) for (const m of mancano) console.log(`    ✗ ${m.file}: ${m.diff}`);
  }
  if (mancano.length) {
    registra(`DIVERSO ${sha.slice(0, 7)}: ${mancano.map((m) => m.file).join(', ')}`);
    fine(`push fatto, ma ${mancano.length} file online non coincidono ancora col repo (vedi sopra). Il branch ${branch} resta.`);
  }

  if (branch !== 'main') git('branch', '-d', branch);
  registra(`ONLINE ${sha.slice(0, 7)}: ${cambi.length} file verificati${branch !== 'main' ? `, branch ${branch} cancellato` : ''}`);
  fine(`pubblicato e verificato: ${commit.length} commit, ${cambi.length ? `${cambi.length} file identici sul sito` : 'nessun file del sito cambiato'}${branch !== 'main' ? `, branch ${branch} cancellato` : ''}.`, 0);
}

module.exports = { normalizza, servito };

if (require.main === module) main();
