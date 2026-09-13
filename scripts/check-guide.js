#!/usr/bin/env node
/**
 * check-guide.js — valida le guide in content/guide/*.json.
 *
 * Uso: npm run check:guide            (tutte)
 *      node scripts/check-guide.js content/guide/tc-produzione.json
 *
 * Regole in content/guide/_SCHEMA.md. Il principio: un dato normativo senza fonte
 * non deve poter arrivare in pagina. Il controllo fallisce sul silenzio (refs vuoto
 * dove c'è un dato regolato), mai sulla prosa legittima, che può dichiarare
 * `noSourceReason`.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const GUIDE_DIR = path.join(ROOT, 'content', 'guide');
const STATUSES = ['draft', 'review', 'published'];
const HOST_PRIMARIE = ['normattiva.it', 'gazzettaufficiale.it', 'eur-lex.europa.eu', 'cinema.cultura.gov.it'];

// Marcatori di "dato regolato": se compaiono nel testo, serve una fonte.
const TOKEN_REGOLATO = /(\d+(?:[.,]\d+)?\s*(?:%|per cento))|(€|euro)|\bart\.|\bcomma\b|\bD\.[IMD]\.|\brep\.\s*n?\.?\s*\d|\bn\.\s*\d{1,4}\/\d{4}|\b(19|20)\d{2}\b|\bentro il\b/i;

// Marcatori di "avvertimento operativo": il punto in cui la norma morde, cioè ciò che
// (gli elenchi vanno tenuti severi: un marcatore generico come "deve" o "must" conta
// la prosa invece delle trappole, e rende le due lingue non confrontabili)
// distingue la guida di uno studio dal riassunto di un blog. Non è un dato da imporre,
// è un sintomo da misurare: vedi _SCHEMA.md, "Che cosa si pubblica e che cosa no".
const TOKEN_AVVERTIMENTO = /convien|prima di (impostare|presentare|firmare|programmare|avviare)|pena l|a pena di|blocca|più costoso|va decisa|va verificat|va presentat|va allegat|va integrat|dovrebbe|rischi|non rivela|si ferma|esclude|inammissibil|decaden|revoc|incompatibil|attenzione|non sono eleggibili|non è eleggibile|non sono ammissibili|solo se|non oltre|non deve|obbligo|sanzione|non concorre|salvo deroga|divieto/i;
const TOKEN_AVVERTIMENTO_EN = /on pain of|must not|no later than|deadline|failure to|forfeit|revoc|ineligib|inadmissib|not eligible|not admissible|excluded|penalt|fine of|before (signing|starting|filing)|worth checking|\brisk\b|barred|lapses|recovered with interest|does not count|is not additive/i;
const QUOTA_AVVERTIMENTI = 1 / 3;

const GIORNI_AVVISO = 90;
const GIORNI_ERRORE = 180;

const errori = [];
const avvisi = [];
const err = (f, m) => errori.push(`${f}: ${m}`);
const warn = (f, m) => avvisi.push(`${f}: ${m}`);

const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const giorniDa = (d) => Math.floor((Date.now() - Date.parse(d)) / 86400000);

function contaParole(guida) {
  let testo = guida.abstract || '';
  for (const s of guida.sections || []) {
    testo += ' ' + (s.heading || '');
    for (const p of s.paragraphs || []) testo += ' ' + (p.text || '');
    for (const v of s.list || []) testo += ' ' + v;
  }
  for (const f of guida.faq || []) testo += ' ' + (f.q || '') + ' ' + (f.a || '');
  return testo.split(/\s+/).filter(Boolean).length;
}

const caricate = [];

function valida(file) {
  const nome = path.relative(ROOT, file);
  let g;
  try {
    g = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    err(nome, `JSON non valido: ${e.message}`);
    return;
  }

  caricate.push({ nome, g });

  for (const campo of ['id', 'slug', 'lang', 'status', 'title', 'metaTitle', 'metaDescription', 'abstract', 'author', 'datePublished', 'dateModified', 'verifiedAt', 'sections', 'sources']) {
    if (g[campo] === undefined || g[campo] === null || g[campo] === '') err(nome, `campo obbligatorio mancante: ${campo}`);
  }
  if (g.status && !STATUSES.includes(g.status)) err(nome, `status "${g.status}" non ammesso (${STATUSES.join(', ')})`);
  if (g.slug && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(g.slug)) err(nome, `slug non valido: "${g.slug}"`);
  if (g.metaDescription && (g.metaDescription.length < 80 || g.metaDescription.length > 160)) {
    warn(nome, `metaDescription di ${g.metaDescription.length} caratteri (consigliati 80-160)`);
  }

  for (const campo of ['datePublished', 'dateModified', 'verifiedAt']) {
    if (g[campo] && !isDate(g[campo])) err(nome, `${campo} non è una data YYYY-MM-DD: "${g[campo]}"`);
  }
  if (isDate(g.datePublished) && isDate(g.dateModified) && Date.parse(g.dateModified) < Date.parse(g.datePublished)) {
    err(nome, 'dateModified precedente a datePublished');
  }
  if (isDate(g.verifiedAt) && giorniDa(g.verifiedAt) < 0) err(nome, 'verifiedAt è nel futuro');

  // --- fonti
  const sources = Array.isArray(g.sources) ? g.sources : [];
  const ids = new Set();
  let primarie = 0;
  for (const s of sources) {
    if (!s.id) { err(nome, 'fonte senza id'); continue; }
    if (ids.has(s.id)) err(nome, `fonte duplicata: ${s.id}`);
    ids.add(s.id);
    for (const campo of ['citation', 'url', 'urlType', 'accessedAt', 'checkedAt']) {
      if (!s[campo]) err(nome, `fonte ${s.id}: campo mancante ${campo}`);
    }
    if (s.urlType === 'primaria') {
      primarie++;
      try {
        const host = new URL(s.url).hostname.replace(/^www\./, '');
        if (!HOST_PRIMARIE.some((h) => host === h || host.endsWith('.' + h))) {
          err(nome, `fonte ${s.id}: dichiarata primaria ma l'host ${host} non è tra quelli ammessi`);
        }
      } catch {
        err(nome, `fonte ${s.id}: url non valido`);
      }
    }
    if (isDate(s.checkedAt)) {
      const gg = giorniDa(s.checkedAt);
      if (gg > GIORNI_ERRORE) err(nome, `fonte ${s.id}: verificata ${gg} giorni fa (limite ${GIORNI_ERRORE})`);
      else if (gg > GIORNI_AVVISO) warn(nome, `fonte ${s.id}: verificata ${gg} giorni fa, da ricontrollare`);
    }
  }
  if (sources.length && primarie === 0) err(nome, 'nessuna fonte primaria dichiarata');

  // --- riferimenti dai contenuti
  const usate = new Set();
  const controllaRefs = (dove, testo, refs, noSourceReason) => {
    for (const r of refs || []) {
      usate.add(r);
      if (!ids.has(r)) err(nome, `${dove}: riferimento "${r}" non corrisponde a nessuna fonte`);
    }
    if ((!refs || refs.length === 0) && TOKEN_REGOLATO.test(testo || '') && !noSourceReason) {
      const campione = (testo || '').slice(0, 90).replace(/\s+/g, ' ');
      err(nome, `${dove}: contiene un dato normativo senza fonte → "${campione}…"`);
    }
  };

  (g.sections || []).forEach((s, i) => {
    if (!s.heading) err(nome, `sezione ${i + 1}: heading mancante`);
    if (!s.id) err(nome, `sezione ${i + 1}: id mancante (serve per le ancore)`);
    (s.paragraphs || []).forEach((p, j) => controllaRefs(`sezione "${s.id || i + 1}" paragrafo ${j + 1}`, p.text, p.refs, p.noSourceReason));
    (s.list || []).forEach((v, j) => {
      if (TOKEN_REGOLATO.test(v) && !(s.listRefs || []).length) {
        err(nome, `sezione "${s.id || i + 1}" voce ${j + 1}: dato normativo in elenco senza listRefs`);
      }
    });
    (s.listRefs || []).forEach((r) => { usate.add(r); if (!ids.has(r)) err(nome, `sezione "${s.id}": listRefs "${r}" sconosciuto`); });
  });
  (g.faq || []).forEach((f, i) => controllaRefs(`faq ${i + 1}`, `${f.q} ${f.a}`, f.refs, f.noSourceReason));

  for (const s of sources) if (!usate.has(s.id)) err(nome, `fonte ${s.id} dichiarata ma mai citata`);

  // --- lunghezza (solo per ciò che sta per essere letto da qualcuno)
  if (g.status === 'review' || g.status === 'published') {
    const n = contaParole(g);
    if (n < 800 || n > 2000) err(nome, `lunghezza ${n} parole, fuori dall'intervallo 800-2000`);
    else if (n > 1600) warn(nome, `lunghezza ${n} parole: valutare se dividere la guida`);

    // Mai bloccante: una percentuale imposta produrrebbe avvertimenti finti.
    const capoversi = (g.sections || []).flatMap((s) => (s.paragraphs || []).map((p) => p.text || ''));
    const marcatore = g.lang === 'en' ? TOKEN_AVVERTIMENTO_EN : TOKEN_AVVERTIMENTO;
    const conAvviso = capoversi.filter((t) => marcatore.test(t)).length;
    if (capoversi.length && conAvviso / capoversi.length < QUOTA_AVVERTIMENTI) {
      const pct = Math.round((100 * conAvviso) / capoversi.length);
      warn(nome, `avvertimenti operativi in ${conAvviso} capoversi su ${capoversi.length} (${pct}%): sotto un terzo, la guida sta scivolando verso il manuale`);
    }
  }
}

function main() {
  const argomenti = process.argv.slice(2);
  let files;
  if (argomenti.length) {
    files = argomenti.map((a) => path.resolve(ROOT, a));
  } else if (fs.existsSync(GUIDE_DIR)) {
    files = fs.readdirSync(GUIDE_DIR).filter((f) => f.endsWith('.json')).map((f) => path.join(GUIDE_DIR, f));
  } else {
    files = [];
  }

  if (!files.length) {
    console.log('✓ Nessuna guida da controllare (content/guide/ vuota).');
    return;
  }

  files.forEach(valida);

  // Coppie di lingua: una guida tradotta che resta indietro dice cose non più vere.
  // Il controllo vale solo sul set completo, altrimenti la gemella non è caricata.
  if (!argomenti.length) {
    const perSlug = new Map(caricate.map((x) => [x.g.slug, x]));
    for (const { nome, g } of caricate) {
      for (const [lingua, pagina] of Object.entries(g.altLang || {})) {
        const slug = String(pagina).replace(/^guida-/, '').replace(/\.html$/, '');
        const altra = perSlug.get(slug);
        if (!altra) { err(nome, `altLang "${lingua}" punta a ${pagina}, che non corrisponde a nessuna guida`); continue; }
        const ritorno = Object.values(altra.g.altLang || {}).some((v) => v === `guida-${g.slug}.html`);
        if (!ritorno) err(nome, `altLang "${lingua}": ${altra.nome} non rimanda indietro a questa guida`);
        if (altra.g.dateModified !== g.dateModified) {
          err(nome, `coppia di lingua disallineata: dateModified ${g.dateModified} contro ${altra.g.dateModified} di ${altra.nome}`);
        }
        if (altra.g.status !== g.status) {
          err(nome, `coppia di lingua disallineata: status ${g.status} contro ${altra.g.status} di ${altra.nome}`);
        }
      }
    }
  }

  for (const a of avvisi) console.log('⚠︎ ' + a);
  if (errori.length) {
    console.error(`\n❌ ${errori.length} problemi bloccanti:\n`);
    for (const e of errori) console.error('  • ' + e);
    console.error('\nNessuna guida con questi problemi può essere pubblicata.');
    process.exit(1);
  }
  console.log(`✓ ${files.length} guida/e valide${avvisi.length ? ` (${avvisi.length} avvisi)` : ''}.`);
}

main();
